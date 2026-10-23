const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const net = require('node:net');
const root = path.resolve(__dirname, '..');

test('Server archives previous JSON, and refuses overwrite if archive cannot be written', async () => {
    const { writeSnapshotWithBackup } = await import('../storage_backups.ts');
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pmm-backup-tests-'));
    const file = path.join(dir, 'store.json'), tmp = path.join(dir, 'store.tmp'), backups = path.join(dir, 'backups');
    const before = JSON.stringify({ revision: 1, keys: { report: 'previous report', settings: 'previous settings' } });
    const after = JSON.stringify({ revision: 2, keys: { report: 'new report', settings: 'new settings' } });
    await writeSnapshotWithBackup(file, tmp, backups, before);
    await writeSnapshotWithBackup(file, tmp, backups, after);
    const names = await fs.readdir(backups);
    assert.equal(names.length, 1);
    assert.equal(await fs.readFile(path.join(backups, names[0]), 'utf8'), before);
    await writeSnapshotWithBackup(file, tmp, backups, after);
    assert.equal((await fs.readdir(backups)).length, 1);
    const blocked = path.join(dir, 'not-a-directory');
    await fs.writeFile(blocked, 'blocked');
    await assert.rejects(writeSnapshotWithBackup(file, tmp, blocked, before));
    assert.equal(await fs.readFile(file, 'utf8'), after);
});

test('Mass registry loss is blocked, but individual deletion and field edits remain allowed', async () => {
    const { registryChangeBlocked: blocked } = await import('../storage_backups.ts');
    const cars = Array.from({ length: 108 }, (_, i) => ({ id: i + 1, plate: 'TEST ' + i }));
    const old = JSON.stringify(cars);
    assert.equal(blocked('user_cars_database_v2', old, JSON.stringify(cars.slice(0, 68))), true);
    assert.equal(blocked('user_cars_database_v2', old, undefined), true);
    assert.equal(blocked('user_cars_database_v2', old, '[]'), true);
    assert.equal(blocked('user_cars_database_v2', old, JSON.stringify(cars.slice(1))), false);
    assert.equal(blocked('user_cars_database_v2', old, JSON.stringify(cars.map(c => ({ ...c, driver: 'New driver' })))), false);
    assert.equal(blocked('user_cars_database_v2', old, JSON.stringify([cars[0], cars[0]])), true);
    assert.equal(blocked('report_data_period', 'old', 'new'), false);
});

function browserFixture() {
    const values = new Map(Object.entries({
        user_cars_database_v2: JSON.stringify([{ id: 1, plate: 'TEST' }]),
        report_data_period: JSON.stringify({ 1: { refuelFuel: '20' } }),
        dev_system_passwords: JSON.stringify({ admin: 'test-only' }),
        aggregates_calc_saved_state: JSON.stringify({ rows: [1, 2] }),
        car_folder_1: JSON.stringify({ files: [{ id: 'carfile' }] }),
        saved_documents_v2: JSON.stringify([{ id: 'docfile' }]),
        __sync_meta_v1: '{}'
    }));
    const downloads = [], blobs = new Map(), changes = [];
    const fakeDB = (data = []) => ({
        close() {},
        transaction(name, mode) {
            const tx = { objectStore() { return {
                getAll() { const request = {}; queueMicrotask(() => { request.result = data; request.onsuccess?.(); tx.oncomplete?.(); }); return request; },
                add(record) { changes.push(record); queueMicrotask(() => tx.oncomplete?.()); }
            }; } };
            return tx;
        }
    });
    const context = {
        Date, Intl, Blob, console, Promise,
        localStorage: { get length() { return values.size; }, key: i => [...values.keys()][i], getItem: k => values.get(k) ?? null },
        URL: { createObjectURL(blob) { const url = 'blob:' + blobs.size; blobs.set(url, blob); return url; }, revokeObjectURL() {} },
        document: { getElementById() { return null; }, body: { appendChild() {} }, createElement() { return { click() { downloads.push({ name: this.download, blob: blobs.get(this.href) }); }, remove() {} }; } },
        setTimeout() {}, alert(message) { throw new Error(message); },
        openDocsIndexedDB: async () => fakeDB([{ id: 'docfile', fileDataUrl: 'data:doc' }]),
        openCarDocsIDB: async () => fakeDB([{ id: 'carfile', dataUrl: 'data:car' }]),
        indexedDB: { open() { const request = {}; queueMicrotask(() => { request.result = fakeDB(changes); request.onsuccess(); }); return request; } }
    };
    context.window = context;
    return { context, downloads, changes, values };
}

test('Automatic JSON contains every site section and attached documents, in existing import format', async () => {
    const { context, downloads } = browserFixture();
    vm.createContext(context);
    vm.runInContext(await fs.readFile(path.join(root, 'automatic_backup.js'), 'utf8'), context);
    const result = await context.createAutomaticSiteBackup();
    assert.equal(result.carsCount, 1);
    assert.match(result.fileName, /^pmm_auto_backup_\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d_\d{3}\.json$/);
    const json = JSON.parse(await downloads[0].blob.text());
    for (const key of ['user_cars_database_v2', 'report_data_period', 'dev_system_passwords', 'aggregates_calc_saved_state']) assert.ok(json.localStorageData[key]);
    assert.equal(json.localStorageData.__sync_meta_v1, undefined);
    assert.equal(json.localStorageData.car_folder_1.files[0].dataUrl, 'data:car');
    assert.equal(json.localStorageData.saved_documents_v2[0].fileDataUrl, 'data:doc');
    assert.equal(json.indexedDBFiles[0].id, 'docfile');
    assert.equal(json.timezone, 'Europe/Kyiv');
});

test('Local history keeps previous/next values for reports, developer settings, and document deletion', async () => {
    const { context, changes, downloads } = browserFixture();
    vm.createContext(context);
    vm.runInContext(await fs.readFile(path.join(root, 'automatic_backup.js'), 'utf8'), context);
    await context.archiveLocalSiteChange('localStorage', 'report_data_period', 'old report', 'new report');
    await context.archiveLocalSiteChange('localStorage', 'dev_role_security_config', 'old settings', 'new settings');
    await context.archiveLocalSiteChange('CarDocsFilesDB_v2', 'carfile', { dataUrl: 'original' }, null);
    await context.archiveLocalSiteChange('localStorage', 'dev_role_time_stats', '1', '2');
    assert.equal(changes.length, 3);
    assert.equal(changes[0].previous, 'old report');
    assert.equal(changes[2].next, null);
    await context.downloadLocalSiteHistory();
    assert.equal(JSON.parse(await downloads[0].blob.text()).changes.length, 3);
});

test('Server acknowledges durable writes, creates manual JSONs, blocks loss, and rolls back failed writes', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pmm-backup-tests-'));
    const socket = net.createServer();
    await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    const options = {
        cwd: root, env: { ...process.env, DATA_DIR: dir, PORT: String(port), NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe']
    };
    let child = spawn(process.execPath, ['--experimental-strip-types', 'server.ts'], options);
    let output = '';
    child.stdout.on('data', d => { output += d; }); child.stderr.on('data', d => { output += d; });
    t.after(() => child.kill());
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 300; attempt++) {
        try { ready = (await fetch(base + '/api/health')).ok; if (ready) break; } catch {}
        if (child.exitCode !== null) throw new Error(output);
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, output);
    async function post(endpoint, payload) { const r = await fetch(base + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); return { status: r.status, body: await r.json() }; }
    const cars = JSON.stringify(Array.from({ length: 108 }, (_, i) => ({ id: i + 1, plate: 'TEST ' + i })));
    const eventsResponse = await fetch(base + '/api/shared-events');
    assert.equal(eventsResponse.headers.get('content-type'), 'text/event-stream');
    const events = eventsResponse.body.getReader();
    await events.read(); // Initial connection state.
    const eventUpdate = events.read();
    let result = await post('/api/shared-state', { changes: { user_cars_database_v2: { value: cars, baseRev: 0 }, report_data_period: { value: 'report before', baseRev: 0 } } });
    assert.equal(result.status, 200);
    const nextEvent = await Promise.race([eventUpdate, new Promise((_, reject) => setTimeout(() => reject(new Error('No immediate shared update')), 3000))]);
    assert.match(new TextDecoder().decode(nextEvent.value), new RegExp('"revision":' + result.body.revision));
    await events.cancel();
    let disk = JSON.parse(await fs.readFile(path.join(dir, 'shared_site_storage.json'), 'utf8'));
    assert.equal(JSON.parse(disk.keys.user_cars_database_v2.value).length, 108);
    result = await post('/api/shared-state', { changes: { user_cars_database_v2: { value: JSON.stringify(JSON.parse(cars).slice(0, 68)), baseRev: disk.keys.user_cars_database_v2.rev } } });
    assert.equal(result.body.rejected.user_cars_database_v2.safetyBlocked, true);
    assert.equal(JSON.parse(JSON.parse(await fs.readFile(path.join(dir, 'shared_site_storage.json'), 'utf8')).keys.user_cars_database_v2.value).length, 108);
    result = await post('/api/shared-backup', { role: 'admin' });
    assert.equal(result.status, 200);
    const copy = JSON.parse(await fs.readFile(path.join(dir, 'backups', result.body.fileName), 'utf8'));
    assert.equal(JSON.parse(copy.keys.user_cars_database_v2.value).length, 108);
    assert.equal((await post('/api/shared-backup', { role: 'user' })).status, 403);
    let fileResult = await post('/api/shared-idb', { role: 'admin', files: [{ id: 'cardoc_test', fileDataUrl: 'data:old', fileName: 'test.doc', baseRev: 0 }] });
    const fileRev = fileResult.body.applied.cardoc_test;
    assert.ok(fileRev > 0);
    fileResult = await post('/api/shared-idb', { role: 'admin', files: [{ id: 'cardoc_test', fileDataUrl: 'data:new', fileName: 'test.doc', baseRev: 0 }] });
    assert.equal(fileResult.body.rejected.cardoc_test.rev, fileRev);
    fileResult = await post('/api/shared-idb', { role: 'admin', files: [{ id: 'cardoc_test', fileDataUrl: 'data:new', fileName: 'test.doc', baseRev: fileRev }] });
    const nextFileRev = fileResult.body.applied.cardoc_test;
    assert.ok(nextFileRev > fileRev);
    const archivedStates = await Promise.all((await fs.readdir(path.join(dir, 'backups'))).map(async name => JSON.parse(await fs.readFile(path.join(dir, 'backups', name), 'utf8'))));
    assert.ok(archivedStates.some(state => state.files.cardoc_test?.fileDataUrl === 'data:old'));
    fileResult = await post('/api/shared-idb', { role: 'admin', deletedFileIds: [{ id: 'cardoc_test', baseRev: fileRev }] });
    assert.equal(fileResult.body.rejected.cardoc_test.rev, nextFileRev);
    fileResult = await post('/api/shared-idb', { role: 'admin', deletedFileIds: [{ id: 'cardoc_test', baseRev: nextFileRev }] });
    assert.ok(fileResult.body.applied.cardoc_test > nextFileRev);
    const filesState = await (await fetch(base + '/api/shared-idb')).json();
    assert.equal(filesState.files.find(file => file.id === 'cardoc_test').deleted, true);
    assert.equal(filesState.files.find(file => file.id === 'cardoc_test').fileDataUrl, 'data:new');
    assert.equal((await post('/api/presence/ban', { targetType: 'device', targetValue: 'test-banned-device' })).status, 200);
    await new Promise(resolve => { child.once('close', resolve); child.kill(); });
    child = spawn(process.execPath, ['--experimental-strip-types', 'server.ts'], options);
    child.stdout.on('data', d => { output += d; }); child.stderr.on('data', d => { output += d; });
    ready = false;
    for (let attempt = 0; attempt < 300; attempt++) {
        try { ready = (await fetch(base + '/api/health')).ok; if (ready) break; } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, output);
    const restarted = await (await fetch(base + '/api/shared-state')).json();
    assert.equal(JSON.parse(restarted.keys.user_cars_database_v2.value).length, 108);
    assert.equal(restarted.keys.report_data_period.value, 'report before');
    assert.equal((await (await fetch(base + '/api/shared-idb')).json()).files.find(file => file.id === 'cardoc_test').deleted, true);
    assert.equal((await (await fetch(base + '/api/presence/bans')).json()).bans[0].targetValue, 'test-banned-device');
    assert.equal((await post('/api/presence/unban', { targetValue: 'test-banned-device' })).status, 200);
    assert.equal((await (await fetch(base + '/api/presence/bans')).json()).bans.length, 0);
    const filesBefore = await fs.readdir(path.join(dir, 'backups'));
    result = await post('/api/shared-state', { changes: { report_data_period: { value: 'report after', baseRev: disk.keys.report_data_period.rev } } });
    assert.equal(result.status, 200);
    assert.ok((await fs.readdir(path.join(dir, 'backups'))).length > filesBefore.length);
    // Replace archive directory with a file: subsequent write must fail safely.
    await fs.rename(path.join(dir, 'backups'), path.join(dir, 'preserved-backups'));
    await fs.writeFile(path.join(dir, 'backups'), 'blocked');
    disk = JSON.parse(await fs.readFile(path.join(dir, 'shared_site_storage.json'), 'utf8'));
    result = await post('/api/shared-state', { changes: { report_data_period: { value: 'must not persist', baseRev: disk.keys.report_data_period.rev } } });
    assert.equal(result.status, 500);
    assert.equal(JSON.parse(await fs.readFile(path.join(dir, 'shared_site_storage.json'), 'utf8')).keys.report_data_period.value, 'report after');
    const state = await (await fetch(base + '/api/shared-state')).json();
    assert.equal(state.keys.report_data_period.value, 'report after');
});
