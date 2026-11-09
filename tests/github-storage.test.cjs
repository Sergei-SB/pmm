const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const {gunzipSync} = require('node:zlib');
const modulePromise = import(pathToFileURL(path.join(__dirname, '..', 'github_storage.ts')).href);
const snapshot = revision => JSON.stringify({ schemaVersion: 2, revision,
    keys: { report_data_test: { value: 'Український звіт ' + revision, rev: revision } }, files: {} });
const savedSnapshot = text => {
    const data = JSON.parse(text);
    return data.format === 'pmm-gzip-v1' ? gunzipSync(Buffer.from(data.payload, 'base64')).toString() : text;
};

function remote(initial = snapshot(1)) {
    const state = { text: initial, sha: initial === null ? null : 'sha1', private: true, puts: [], fail: 0,
        timeoutAfterCommit: false, large: false, offline: false, readBlobs: [] };
    const request = async (url, options = {}) => {
        if (state.offline) throw new Error('offline');
        assert.equal(options.headers.Authorization, 'Bearer test-secret');
        if (options.method === 'PUT') {
            const body = JSON.parse(options.body); state.puts.push(body);
            if (state.fail) return new Response('{}', { status: state.fail });
            if (body.sha !== (state.sha || undefined)) return new Response('{}', { status: 409 });
            state.text = Buffer.from(body.content, 'base64').toString();
            state.sha = 'sha' + (state.puts.length + 1);
            if (state.timeoutAfterCommit) throw new Error('response lost');
            return Response.json({ content: { sha: state.sha } });
        }
        if (url.includes('/git/blobs/')) { state.readBlobs.push(url); return new Response(state.text); }
        if (url.includes('/contents/')) {
            if (state.text === null) return new Response('{}', { status: 404 });
            return Response.json({ type: 'file', sha: state.sha, encoding: state.large ? 'none' : 'base64',
                content: state.large ? '' : Buffer.from(state.text).toString('base64') });
        }
        return Response.json({ private: state.private });
    };
    return { state, request };
}

test('GitHub is authoritative after server restart and preserves Ukrainian reports and files', async () => {
    const { GitHubStorage } = await modulePromise;
    const { state, request } = remote();
    const store = new GitHubStorage('owner/private-data', 'test-secret', 'main', request);
    assert.equal(await store.load(), snapshot(1));
    await store.save(snapshot(2));
    assert.equal(savedSnapshot(state.text), snapshot(2));
    assert.equal(state.puts[0].sha, 'sha1');
    assert.match(state.puts[0].message, /PMM save .* revision 2/);
    assert.ok(!state.text.includes('test-secret'));
    const restarted = new GitHubStorage('owner/private-data', 'test-secret', 'main', request);
    assert.equal(await restarted.load(), snapshot(2));
    const stats = restarted.transferStats;
    assert.equal(stats.days[stats.today].sentBytes, Buffer.byteLength(JSON.stringify(state.puts[0])));
    assert.equal(stats.days[stats.today].saves, 1);
    await restarted.save(snapshot(2));
    assert.equal(state.puts.length, 1, 'no duplicate commit on restart or unchanged save');
});

test('GitHub outages and stale writers cannot silently overwrite newer shared data', async () => {
    const { GitHubStorage } = await modulePromise;
    const { state, request } = remote();
    const a = new GitHubStorage('owner/private-data', 'test-secret', 'main', request);
    const b = new GitHubStorage('owner/private-data', 'test-secret', 'main', request);
    await a.load(); await b.load();
    await a.save(snapshot(3));
    await assert.rejects(b.save(snapshot(2)), /409/);
    assert.equal(savedSnapshot(state.text), snapshot(3));
    state.fail = 403;
    await assert.rejects(a.save(snapshot(4)), /403/);
    assert.equal(savedSnapshot(state.text), snapshot(3));
    assert.equal(a.transferStats.days[a.transferStats.today].saves, 1);
    state.offline = true;
    await assert.rejects(a.save(snapshot(4)), /offline/);
});

test('A lost response is acknowledged only after the exact committed JSON is read back', async () => {
    const { GitHubStorage } = await modulePromise;
    const { state, request } = remote();
    const store = new GitHubStorage('owner/private-data', 'test-secret', 'main', request);
    await store.load(); state.timeoutAfterCommit = true;
    await store.save(snapshot(2));
    assert.equal(store.revisionHash, state.sha);
    await store.save(snapshot(2));
    assert.equal(state.puts.length, 1);
    assert.equal(store.transferStats.days[store.transferStats.today].saves, 1);
});

test('Private repository and valid complete JSON are required, with no empty fallback', async () => {
    const { GitHubStorage, configuredGitHubStorage } = await modulePromise;
    const { state, request } = remote();
    const store = new GitHubStorage('owner/private-data', 'test-secret', 'main', request);
    state.private = false;
    await assert.rejects(store.load(), /must be private/);
    await assert.rejects(store.save(snapshot(2)), /not initialized/);
    state.private = true; state.text = '{}';
    await assert.rejects(store.load(), /Invalid shared/);
    assert.throws(() => configuredGitHubStorage({ PMM_GITHUB_REPOSITORY: 'owner/private-data' }), /Both/);
    assert.equal(configuredGitHubStorage({}), null);
});

test('Large JSON reads use an immutable blob SHA instead of a moving branch', async () => {
    const { GitHubStorage } = await modulePromise;
    const { state, request } = remote(); state.large = true;
    const store = new GitHubStorage('owner/private-data', 'test-secret', 'main', request);
    assert.equal(await store.load(), snapshot(1));
    assert.equal(state.readBlobs.length, 1);
    assert.ok(state.readBlobs[0].endsWith('/git/blobs/sha1'));
});

test('Compressed snapshots preserve documents, reduce request bytes and can return to plain JSON', async () => {
    const {GitHubStorage} = await modulePromise;
    const {state, request} = remote();
    const payload = JSON.parse(snapshot(2));
    payload.files.document = {rev: 2, content: Buffer.from('Документ А4\n'.repeat(6000)).toString('base64')};
    const original = JSON.stringify(payload);
    const store = new GitHubStorage('owner/private-data', 'test-secret', 'main', request);
    await store.load();
    await store.save(original);
    const stats = store.transferStats;
    assert.ok(stats.days[stats.today].sentBytes < stats.days[stats.today].plainBytes);
    assert.equal(savedSnapshot(state.text), original);
    state.large = true;
    const rollback = new GitHubStorage('owner/private-data', 'test-secret', 'main', request, false);
    assert.equal(await rollback.load(), original);
    await rollback.save(original);
    assert.equal(state.text, original);
    state.text = '{"format":"pmm-gzip-v1","payload":"broken"}';
    const damaged = new GitHubStorage('owner/private-data', 'test-secret', 'main', request);
    await assert.rejects(damaged.load());
    await assert.rejects(damaged.save(original), /not initialized/);
});
