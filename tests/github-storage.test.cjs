const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const {gzipSync, gunzipSync} = require('node:zlib');
const modulePromise = import(pathToFileURL(path.join(__dirname, '..', 'github_storage.ts')).href);
const snapshot = revision => JSON.stringify({ schemaVersion: 2, revision,
    keys: { report_data_test: { value: 'Український звіт ' + revision, rev: revision } }, files: {} });
const sha = revision => String(revision).padStart(40, '0');
const savedSnapshot = text => {
    const data = JSON.parse(text);
    return data.format === 'pmm-gzip-v1' ? gunzipSync(Buffer.from(data.payload, 'base64')).toString() : text;
};

function remote(initial = snapshot(1)) {
    const state = { text: initial, sha: initial === null ? null : sha(1), private: true, puts: [], fail: 0,
        timeoutAfterCommit: false, large: false, offline: false, readBlobs: [], blobs: new Map([[sha(1), initial]]) };
    const request = async (url, options = {}) => {
        if (state.offline) throw new Error('offline');
        assert.equal(options.headers.Authorization, 'Bearer test-secret');
        if (options.method === 'PUT') {
            const body = JSON.parse(options.body); state.puts.push(body);
            if (state.fail) return new Response('{}', { status: state.fail });
            if (body.sha !== (state.sha || undefined)) return new Response('{}', { status: 409 });
            state.text = Buffer.from(body.content, 'base64').toString();
            state.sha = sha(state.puts.length + 1);
            state.blobs.set(state.sha, state.text);
            if (state.timeoutAfterCommit) throw new Error('response lost');
            return Response.json({ content: { sha: state.sha } });
        }
        if (url.includes('/git/blobs/')) {
            state.readBlobs.push(url);
            const text = state.blobs.get(url.split('/').at(-1));
            return new Response(text, {status: text == null ? 404 : 200});
        }
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
    assert.equal(state.puts[0].sha, sha(1));
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
    assert.ok(state.readBlobs[0].endsWith('/git/blobs/' + sha(1)));
});

test('Delta mode saves only changed records, verifies restart and lost responses, and rejects stale writers', async () => {
    const {GitHubStorage} = await modulePromise;
    const {createHash} = require('node:crypto');
    const data = JSON.parse(snapshot(1));
    data.files.large = {rev: 1, data: Array.from({length: 1000}, (_, i) => createHash('sha256').update(String(i)).digest('hex')).join('')};
    data.keys.untouched = {value: 'залишити', rev: 1};
    data.activity = [{rev: 1}, {rev: 2}];
    const original = JSON.stringify(data);
    const {state, request} = remote(original);
    const store = new GitHubStorage('owner/private-data', 'test-secret', 'main', request, 'delta');
    const stale = new GitHubStorage('owner/private-data', 'test-secret', 'main', request, 'delta');
    await store.load(); await stale.load();
    data.revision++;
    data.keys.report_data_test = {value: 'Новий одометр', rev: 2};
    delete data.keys.untouched;
    data.activity = [{rev: 2}, {rev: 3}];
    const expected = JSON.stringify(data);
    state.timeoutAfterCommit = true;
    await store.save(expected);
    state.timeoutAfterCommit = false;
    const envelope = JSON.parse(state.text);
    assert.equal(envelope.format, 'pmm-delta-v1');
    assert.equal(envelope.parent, sha(1));
    const delta = JSON.parse(gunzipSync(Buffer.from(envelope.payload, 'base64')));
    assert.deepEqual(delta.files, []);
    assert.deepEqual(delta.activity, {drop: 1, append: [{rev: 3}]});
    assert.deepEqual(delta.keys, [['untouched'], ['report_data_test', data.keys.report_data_test]]);
    assert.equal(store.transferStats.days[store.transferStats.today].deltaSaves, 1);
    const today = store.transferStats.days[store.transferStats.today];
    assert.equal(today.sentBytes, Buffer.byteLength(JSON.stringify(state.puts[0])));
    assert.ok(today.sentBytes < today.gzipBytes && today.gzipBytes < today.plainBytes);
    await assert.rejects(stale.save(snapshot(99)), /409/);
    const restarted = new GitHubStorage('owner/private-data', 'test-secret', 'main', request, 'delta');
    assert.equal(await restarted.load(), expected);
    state.blobs.delete(sha(1));
    const broken = new GitHubStorage('owner/private-data', 'test-secret', 'main', request, 'delta');
    await assert.rejects(broken.load(), /download failed/);
    await assert.rejects(broken.save(original), /not initialized/);
    state.blobs.set(sha(1), original);
    const validHead = state.text;
    delta.hash = '0'.repeat(64);
    state.text = JSON.stringify({...envelope, payload: gzipSync(JSON.stringify(delta)).toString('base64')});
    await assert.rejects(broken.load(), /checksum mismatch/);
    state.text = validHead;
    const rollback = new GitHubStorage('owner/private-data', 'test-secret', 'main', request);
    assert.equal(await rollback.load(), expected);
    await rollback.save(expected);
    assert.equal(JSON.parse(state.text).format, 'pmm-gzip-v1');
    assert.equal(savedSnapshot(state.text), expected);
    assert.equal(rollback.transferStats.days[rollback.transferStats.today].deltaSaves, 1);
});

test('Delta history is bounded by a complete compressed checkpoint', async () => {
    const {GitHubStorage} = await modulePromise;
    const {createHash} = require('node:crypto');
    const data = JSON.parse(snapshot(1));
    data.files.large = {data: Array.from({length: 200}, (_, i) => createHash('sha256').update(String(i)).digest('hex')).join('')};
    const {state, request} = remote(JSON.stringify(data));
    const store = new GitHubStorage('owner/private-data', 'test-secret', 'main', request, 'delta');
    await store.load();
    for (let i = 2; i <= 16; i++) {
        data.revision = i;
        await store.save(JSON.stringify(data));
        assert.equal(JSON.parse(state.text).format, 'pmm-delta-v1');
    }
    const restarted = new GitHubStorage('owner/private-data', 'test-secret', 'main', request, 'delta');
    assert.equal(await restarted.load(), JSON.stringify(data));
    data.revision++;
    await restarted.save(JSON.stringify(data));
    assert.equal(JSON.parse(state.text).format, 'pmm-gzip-v1');
    assert.equal(savedSnapshot(state.text), JSON.stringify(data));
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
    state.large = false;
    state.text = '{"format":"pmm-gzip-v1","payload":"broken"}';
    const damaged = new GitHubStorage('owner/private-data', 'test-secret', 'main', request);
    await assert.rejects(damaged.load());
    await assert.rejects(damaged.save(original), /not initialized/);
});
