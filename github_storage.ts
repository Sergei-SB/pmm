// Server-only GitHub persistence. Credentials never enter the browser or JSON.
type GitFile = { sha: string; content?: string; encoding?: string; type?: string };
type Request = typeof fetch;

export class GitHubStorage {
    private sha: string | undefined;
    private saved: string | undefined;
    private initialized = false;
    private readonly base: string;
    private readonly file: string;
    private readonly token: string;
    private readonly branch: string;
    private readonly request: Request;
    constructor(repo: string, token: string, branch = 'main', request: Request = fetch) {
        if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !token) throw new Error('Invalid GitHub storage configuration');
        this.base = 'https://api.github.com/repos/' + repo;
        this.file = this.base + '/contents/shared_site_storage.json';
        this.token = token;
        this.branch = branch;
        this.request = request;
    }
    private async api(url: string, method = 'GET', body?: unknown, accept = 'application/vnd.github+json'): Promise<Response> {
        return this.request(url, { method, headers: { Authorization: 'Bearer ' + this.token,
            Accept: accept, 'User-Agent': 'PMM-shared-storage', 'X-GitHub-Api-Version': '2022-11-28',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
    }
    private async readFile(): Promise<{ sha: string; snapshot: string } | null> {
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
        this.validate(snapshot);
        return { sha: file.sha, snapshot };
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
        this.initialized = true;
        return file?.snapshot ?? null;
    }
    async save(snapshot: string): Promise<void> {
        if (!this.initialized) throw new Error('GitHub storage not initialized');
        this.validate(snapshot);
        if (this.saved === snapshot) return;
        // Keep below GitHub's single-file limit, including future attached documents.
        if (Buffer.byteLength(snapshot) > 95 * 1024 * 1024) throw new Error('GitHub JSON size limit reached; changes remain queued');
        const data = JSON.parse(snapshot) as { revision: number };
        const content = Buffer.from(snapshot).toString('base64');
        const message = 'PMM save ' + new Date().toISOString() + ' revision ' + data.revision;
        try {
            const response = await this.api(this.file, 'PUT', { message, content, branch: this.branch,
                ...(this.sha ? { sha: this.sha } : {}) });
            if (!response.ok) throw new Error('GitHub storage write failed: HTTP ' + response.status);
            const result = await response.json() as { content?: { sha?: string } };
            if (!result.content?.sha) throw new Error('GitHub did not confirm saved JSON');
            this.sha = result.content.sha;
            this.saved = snapshot;
        } catch (error) {
            // A timeout can happen after GitHub committed. Verify before reporting failure.
            const latest = await this.readFile().catch(() => null);
            if (latest?.snapshot !== snapshot) throw error;
            this.sha = latest.sha;
            this.saved = snapshot;
        }
    }
    get revisionHash(): string | undefined { return this.sha; }
}

export function configuredGitHubStorage(env: NodeJS.ProcessEnv = process.env): GitHubStorage | null {
    const repo = env.PMM_GITHUB_REPOSITORY;
    const token = env.PMM_GITHUB_TOKEN;
    if (!repo && !token) return null;
    if (!repo || !token) throw new Error('Both PMM_GITHUB_REPOSITORY and PMM_GITHUB_TOKEN are required');
    return new GitHubStorage(repo, token, env.PMM_GITHUB_BRANCH || 'main');
}
