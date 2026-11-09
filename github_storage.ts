// Server-only GitHub persistence. Credentials never enter the browser or JSON.
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';

type GitFile = { sha: string; content?: string; encoding?: string; type?: string };
type Request = typeof fetch;
type TransferDay = { sentBytes: number; plainBytes: number; saves: number };
type TransferDays = Record<string, TransferDay>;
const maxFileBytes = 95 * 1024 * 1024;
const compress = promisify(gzip);
const decompress = promisify(gunzip);
const kyivDate = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit'});

export class GitHubStorage {
    private sha: string | undefined;
    private saved: string | undefined;
    private storedCompressed = false;
    private days: TransferDays = {};
    private initialized = false;
    private readonly base: string;
    private readonly file: string;
    private readonly token: string;
    private readonly branch: string;
    private readonly request: Request;
    private readonly compression: boolean;
    constructor(repo: string, token: string, branch = 'main', request: Request = fetch, compression = true) {
        if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !token) throw new Error('Invalid GitHub storage configuration');
        this.base = 'https://api.github.com/repos/' + repo;
        this.file = this.base + '/contents/shared_site_storage.json';
        this.token = token;
        this.branch = branch;
        this.request = request;
        this.compression = compression;
    }
    private async api(url: string, method = 'GET', body?: unknown, accept = 'application/vnd.github+json'): Promise<Response> {
        return this.request(url, { method, headers: { Authorization: 'Bearer ' + this.token,
            Accept: accept, 'User-Agent': 'PMM-shared-storage', 'X-GitHub-Api-Version': '2022-11-28',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
    }
    private async readFile(): Promise<{ sha: string; snapshot: string; compressed: boolean; days: TransferDays } | null> {
        const metadata = await this.api(this.file + '?ref=' + encodeURIComponent(this.branch), 'GET', undefined, 'application/vnd.github.object+json');
        if (metadata.status === 404) return null;
        if (!metadata.ok) throw new Error('GitHub storage read failed: HTTP ' + metadata.status);
        const file = await metadata.json() as GitFile;
        if (file.type !== 'file' || !file.sha) throw new Error('Invalid GitHub storage file');
        let snapshot: string;
        if (file.encoding === 'base64' && file.content) snapshot = Buffer.from(file.content, 'base64').toString('utf8');
        else {
            // Pin large-file reads to the blob, so a concurrent commit cannot mix SHA and data.
            const raw = await this.api(this.base + '/git/blobs/' + file.sha, 'GET', undefined, 'application/vnd.github.raw+json');
            if (!raw.ok) throw new Error('GitHub storage download failed: HTTP ' + raw.status);
            snapshot = await raw.text();
        }
        const envelope = JSON.parse(snapshot);
        const compressed = envelope?.format === 'pmm-gzip-v1';
        const days: TransferDays = {};
        if (compressed) {
            if (typeof envelope.payload !== 'string') throw new Error('Invalid compressed GitHub snapshot');
            snapshot = (await decompress(Buffer.from(envelope.payload, 'base64'), {maxOutputLength: maxFileBytes})).toString('utf8');
            for (const [day, value] of Object.entries((envelope.days ?? {}) as TransferDays)) {
                if (/^\d{4}-\d{2}-\d{2}$/.test(day) && value &&
                    [value.sentBytes, value.plainBytes, value.saves].every(n => Number.isSafeInteger(n) && n >= 0)) days[day] = value;
            }
        }
        this.validate(snapshot);
        return { sha: file.sha, snapshot, compressed, days };
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
        this.storedCompressed = file?.compressed ?? false;
        this.days = file?.days ?? {};
        this.initialized = true;
        return file?.snapshot ?? null;
    }
    async save(snapshot: string): Promise<void> {
        if (!this.initialized) throw new Error('GitHub storage not initialized');
        this.validate(snapshot);
        if (this.saved === snapshot && (this.compression || !this.storedCompressed)) return;
        // Keep below GitHub's single-file limit, including future attached documents.
        if (Buffer.byteLength(snapshot) > maxFileBytes) throw new Error('GitHub JSON size limit reached; changes remain queued');
        const data = JSON.parse(snapshot) as { revision: number };
        const message = 'PMM save ' + new Date().toISOString() + ' revision ' + data.revision;
        const body = { message, content: Buffer.from(snapshot).toString('base64'), branch: this.branch,
            ...(this.sha ? { sha: this.sha } : {}) };
        let nextDays: TransferDays = {};
        if (this.compression) {
            const now = new Date();
            const day = kyivDate.format(now);
            const cutoff = new Date(Date.parse(day + 'T00:00:00Z') - 89 * 86400000).toISOString().slice(0, 10);
            nextDays = Object.fromEntries(Object.entries(this.days).filter(([date]) => date >= cutoff));
            const previous = nextDays[day] ?? {sentBytes: 0, plainBytes: 0, saves: 0};
            const today = {...previous, plainBytes: previous.plainBytes + Buffer.byteLength(JSON.stringify(body)), saves: previous.saves + 1};
            nextDays[day] = today;
            const payload = (await compress(snapshot)).toString('base64');
            let requestBytes = 0;
            // Only the counter's digit width affects the encoded request size.
            do {
                today.sentBytes = previous.sentBytes + requestBytes;
                const envelope = JSON.stringify({format: 'pmm-gzip-v1', payload, days: nextDays});
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
            this.storedCompressed = this.compression;
            this.days = nextDays;
        } catch (error) {
            // A timeout can happen after GitHub committed. Verify before reporting failure.
            const latest = await this.readFile().catch(() => null);
            if (latest?.snapshot !== snapshot || latest.compressed !== this.compression) throw error;
            this.sha = latest.sha;
            this.saved = snapshot;
            this.storedCompressed = latest.compressed;
            this.days = latest.days;
        }
    }
    get revisionHash(): string | undefined { return this.sha; }
    get transferStats() { return {today: kyivDate.format(new Date()), days: this.days, compression: this.compression}; }
}

export function configuredGitHubStorage(env: NodeJS.ProcessEnv = process.env): GitHubStorage | null {
    const repo = env.PMM_GITHUB_REPOSITORY;
    const token = env.PMM_GITHUB_TOKEN;
    if (!repo && !token) return null;
    if (!repo || !token) throw new Error('Both PMM_GITHUB_REPOSITORY and PMM_GITHUB_TOKEN are required');
    return new GitHubStorage(repo, token, env.PMM_GITHUB_BRANCH || 'main', fetch, env.PMM_GITHUB_COMPRESSION !== 'off');
}
