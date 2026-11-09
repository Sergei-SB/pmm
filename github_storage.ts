// Server-only GitHub persistence. Credentials never enter the browser or JSON.
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { buildGitHubDelta, replayGitHubDelta } from './github_delta.ts';

type GitFile = { sha: string; content?: string; encoding?: string; type?: string };
type Request = typeof fetch;
type TransferDay = { sentBytes: number; plainBytes: number; saves: number; gzipBytes?: number; deltaSaves?: number };
type TransferDays = Record<string, TransferDay>;
type StorageMode = 'plain' | 'gzip' | 'delta';
type Decoded = {snapshot: string; format: StorageMode; depth: number; days: TransferDays};
const maxFileBytes = 95 * 1024 * 1024;
const maxDeltaDepth = 15;
const compress = promisify(gzip);
const decompress = promisify(gunzip);
const kyivDate = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit'});

export class GitHubStorage {
    private sha: string | undefined;
    private saved: string | undefined;
    private storedFormat: StorageMode = 'plain';
    private depth = 0;
    private days: TransferDays = {};
    private initialized = false;
    private readonly base: string;
    private readonly file: string;
    private readonly token: string;
    private readonly branch: string;
    private readonly request: Request;
    private readonly mode: StorageMode;
    constructor(repo: string, token: string, branch = 'main', request: Request = fetch, compression: boolean | 'delta' = true) {
        if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !token) throw new Error('Invalid GitHub storage configuration');
        this.base = 'https://api.github.com/repos/' + repo;
        this.file = this.base + '/contents/shared_site_storage.json';
        this.token = token;
        this.branch = branch;
        this.request = request;
        this.mode = compression === 'delta' ? 'delta' : (compression ? 'gzip' : 'plain');
    }
    private async api(url: string, method = 'GET', body?: unknown, accept = 'application/vnd.github+json'): Promise<Response> {
        return this.request(url, { method, headers: { Authorization: 'Bearer ' + this.token,
            Accept: accept, 'User-Agent': 'PMM-shared-storage', 'X-GitHub-Api-Version': '2022-11-28',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
    }
    private async readBlob(sha: string): Promise<string> {
        const raw = await this.api(this.base + '/git/blobs/' + sha, 'GET', undefined, 'application/vnd.github.raw+json');
        if (!raw.ok) throw new Error('GitHub storage download failed: HTTP ' + raw.status);
        return raw.text();
    }

    private async readFile(): Promise<(Decoded & {sha: string}) | null> {
        const metadata = await this.api(this.file + '?ref=' + encodeURIComponent(this.branch), 'GET', undefined, 'application/vnd.github.object+json');
        if (metadata.status === 404) return null;
        if (!metadata.ok) throw new Error('GitHub storage read failed: HTTP ' + metadata.status);
        const file = await metadata.json() as GitFile;
        if (file.type !== 'file' || !file.sha) throw new Error('Invalid GitHub storage file');
        let snapshot: string;
        if (file.encoding === 'base64' && file.content) snapshot = Buffer.from(file.content, 'base64').toString('utf8');
        else {
            // Pin large-file reads to the blob, so a concurrent commit cannot mix SHA and data.
            snapshot = await this.readBlob(file.sha);
        }
        return {sha: file.sha, ...await this.decode(snapshot)};
    }

    private async decode(snapshot: string, level = 0): Promise<Decoded> {
        const envelope = JSON.parse(snapshot);
        const format: StorageMode = envelope?.format === 'pmm-delta-v1' ? 'delta'
            : envelope?.format === 'pmm-gzip-v1' ? 'gzip' : 'plain';
        const days: TransferDays = {};
        let depth = 0;
        if (format !== 'plain') {
            if (typeof envelope.payload !== 'string') throw new Error('Invalid compressed GitHub snapshot');
            snapshot = (await decompress(Buffer.from(envelope.payload, 'base64'), {maxOutputLength: maxFileBytes})).toString('utf8');
            for (const [day, value] of Object.entries((envelope.days ?? {}) as TransferDays)) {
                if (/^\d{4}-\d{2}-\d{2}$/.test(day) && value &&
                    [value.sentBytes, value.plainBytes, value.saves].every(n => Number.isSafeInteger(n) && n >= 0)) {
                    days[day] = {sentBytes: value.sentBytes, plainBytes: value.plainBytes, saves: value.saves,
                        gzipBytes: Number.isSafeInteger(value.gzipBytes) && value.gzipBytes! >= 0 ? value.gzipBytes : value.sentBytes,
                        deltaSaves: Number.isSafeInteger(value.deltaSaves) && value.deltaSaves! >= 0 ? value.deltaSaves : 0};
                }
            }
        }
        if (format === 'delta') {
            if (level >= maxDeltaDepth || typeof envelope.parent !== 'string' || !/^[a-f0-9]{40}$/.test(envelope.parent)) {
                throw new Error('Invalid GitHub delta history');
            }
            const previous = await this.decode(await this.readBlob(envelope.parent), level + 1);
            snapshot = replayGitHubDelta(previous.snapshot, JSON.parse(snapshot));
            depth = previous.depth + 1;
        }
        this.validate(snapshot);
        return {snapshot, format, depth, days};
    }
    private validate(snapshot: string): void {
        const data = JSON.parse(snapshot);
        if (data.schemaVersion !== 2 || !data.keys || Array.isArray(data.keys) || !data.files || Array.isArray(data.files)
            || !Number.isFinite(data.revision)) throw new Error('Invalid shared GitHub JSON; refusing replacement');
    }
    async load(): Promise<string | null> {
        const response = await this.api(this.base);
        if (!response.ok) throw new Error('GitHub repository unavailable: HTTP ' + response.status);
        const repo = await response.json() as { private?: boolean };
        if (repo.private !== true) throw new Error('Shared data repository must be private');
        const file = await this.readFile();
        this.sha = file?.sha;
        this.saved = file?.snapshot;
        this.storedFormat = file?.format ?? 'plain';
        this.depth = file?.depth ?? 0;
        this.days = file?.days ?? {};
        this.initialized = true;
        return file?.snapshot ?? null;
    }
    async save(snapshot: string): Promise<void> {
        if (!this.initialized) throw new Error('GitHub storage not initialized');
        this.validate(snapshot);
        if (this.saved === snapshot && (this.mode === 'delta' || this.storedFormat === this.mode ||
            (this.mode === 'gzip' && this.storedFormat === 'plain'))) return;
        // Keep below GitHub's single-file limit, including future attached documents.
        if (Buffer.byteLength(snapshot) > maxFileBytes) throw new Error('GitHub JSON size limit reached; changes remain queued');
        const data = JSON.parse(snapshot) as { revision: number };
        const message = 'PMM save ' + new Date().toISOString() + ' revision ' + data.revision;
        const body = { message, content: Buffer.from(snapshot).toString('base64'), branch: this.branch,
            ...(this.sha ? { sha: this.sha } : {}) };
        let nextDays: TransferDays = {};
        let format: StorageMode = 'plain';
        let depth = 0;
        if (this.mode !== 'plain') {
            const now = new Date();
            const day = kyivDate.format(now);
            const cutoff = new Date(Date.parse(day + 'T00:00:00Z') - 89 * 86400000).toISOString().slice(0, 10);
            nextDays = Object.fromEntries(Object.entries(this.days).filter(([date]) => date >= cutoff));
            const previous = nextDays[day] ?? {sentBytes: 0, plainBytes: 0, saves: 0};
            const today: TransferDay = {...previous, plainBytes: previous.plainBytes + Buffer.byteLength(JSON.stringify(body)), saves: previous.saves + 1};
            nextDays[day] = today;
            const full = (await compress(snapshot)).toString('base64');
            const delta = this.mode === 'delta' && this.saved && this.sha && /^[a-f0-9]{40}$/.test(this.sha) &&
                this.depth < maxDeltaDepth ? buildGitHubDelta(this.saved, snapshot) : null;
            const changes = delta ? (await compress(JSON.stringify(delta))).toString('base64') : '';
            const useDelta = Boolean(changes && changes.length + 100 < full.length);
            format = useDelta ? 'delta' : 'gzip';
            depth = useDelta ? this.depth + 1 : 0;
            const frame = useDelta ? {format: 'pmm-delta-v1', parent: this.sha, payload: changes}
                : {format: 'pmm-gzip-v1', payload: full};
            const gzipEstimate = useDelta ? Buffer.byteLength(JSON.stringify({...body,
                content: Buffer.from(JSON.stringify({format: 'pmm-gzip-v1', payload: full, days: this.days})).toString('base64')})) : 0;
            const priorGzipBytes = previous.gzipBytes ?? previous.sentBytes;
            today.deltaSaves = (previous.deltaSaves ?? 0) + (useDelta ? 1 : 0);
            let requestBytes = 0;
            // Only the counter's digit width affects the encoded request size.
            do {
                today.sentBytes = previous.sentBytes + requestBytes;
                today.gzipBytes = priorGzipBytes + (useDelta ? gzipEstimate : requestBytes);
                const envelope = JSON.stringify({...frame, days: nextDays});
                if (Buffer.byteLength(envelope) > maxFileBytes) throw new Error('GitHub snapshot size limit reached; changes remain queued');
                body.content = Buffer.from(envelope).toString('base64');
                requestBytes = Buffer.byteLength(JSON.stringify(body));
            } while (today.sentBytes !== previous.sentBytes + requestBytes);
        }
        try {
            const response = await this.api(this.file, 'PUT', body);
            if (!response.ok) throw new Error('GitHub storage write failed: HTTP ' + response.status);
            const result = await response.json() as { content?: { sha?: string } };
            if (!result.content?.sha) throw new Error('GitHub did not confirm saved JSON');
            this.sha = result.content.sha;
            this.saved = snapshot;
            this.storedFormat = format;
            this.depth = depth;
            this.days = nextDays;
        } catch (error) {
            // A timeout can happen after GitHub committed. Verify before reporting failure.
            const latest = await this.readFile().catch(() => null);
            if (latest?.snapshot !== snapshot || latest.format !== format) throw error;
            this.sha = latest.sha;
            this.saved = snapshot;
            this.storedFormat = latest.format;
            this.depth = latest.depth;
            this.days = latest.days;
        }
    }
    get revisionHash(): string | undefined { return this.sha; }
    get transferStats() { return {today: kyivDate.format(new Date()), days: this.days, compression: this.mode !== 'plain', mode: this.mode}; }
}

export function configuredGitHubStorage(env: NodeJS.ProcessEnv = process.env): GitHubStorage | null {
    const repo = env.PMM_GITHUB_REPOSITORY;
    const token = env.PMM_GITHUB_TOKEN;
    if (!repo && !token) return null;
    if (!repo || !token) throw new Error('Both PMM_GITHUB_REPOSITORY and PMM_GITHUB_TOKEN are required');
    const mode = env.PMM_GITHUB_MODE ?? (env.PMM_GITHUB_COMPRESSION === 'off' ? 'plain' : 'delta');
    if (mode !== 'plain' && mode !== 'gzip' && mode !== 'delta') throw new Error('Invalid PMM_GITHUB_MODE');
    return new GitHubStorage(repo, token, env.PMM_GITHUB_BRANCH || 'main', fetch, mode === 'delta' ? mode : mode === 'gzip');
}
