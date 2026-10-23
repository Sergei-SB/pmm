const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function extract(file, name) {
    const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
    let found;
    function visit(node) {
        if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(source);
        if (ts.isBinaryExpression(node) && node.left.getText(source) === 'window.' + name) found = node.getText(source) + ';';
        ts.forEachChild(node, visit);
    }
    visit(source); assert.ok(found, name); return found;
}
function contextWith(functions, context = {}) {
    context.window = context; vm.createContext(context);
    for (const [file, name] of functions) vm.runInContext(extract(file, name), context);
    return context;
}
const mergeContext = () => contextWith([['Shared_sync.js', 'mergeCarValue']]);

test('An identical blocked key is acknowledged without overwriting either version', () => {
    const values = { setting: 'same' };
    let revision;
    const c = contextWith([['Shared_sync.js', 'applyRemoteKeys']], {
        pending: { setting: { value: 'same', blocked: true } }, applyingRemote: false,
        isSyncedKey: () => true, isCarKey: () => false, setKeyRev: (_key, rev) => {revision = rev;},
        localGet: key => values[key], localSet() {throw new Error('Must not overwrite');}, setStatus() {}
    });
    c.applyRemoteKeys({ setting: { value: 'same', rev: 12, deleted: false } }, false);
    assert.equal(c.pending.setting, undefined); assert.equal(revision, 12); assert.equal(values.setting, 'same');
    c.pending.setting = {value: 'different', blocked: true};
    c.applyRemoteKeys({setting: {value: 'same', rev: 13, deleted: false}}, false);
    assert.equal(c.pending.setting.blocked, true); assert.equal(revision, 12);
});

function conflictContext() {
    const values = { report_data_test: 'local' }, revisions = {}, backups = [];
    const c = contextWith([['Shared_sync.js', 'resolvePmmSyncConflict']], {
        pending: { report_data_test: { value: 'local', blocked: true } }, documentPending: {},
        isAdminRole: () => true, localGet: key => values[key] ?? null, localSet: (key, value) => {values[key] = value;},
        localRemove: key => {delete values[key];}, setKeyRev: (key, rev) => {revisions[key] = rev;},
        isCarKey: () => true, meta: {lastRev: 99, carBases: {}},
        archiveLocalSiteChange: async (...args) => {backups.push(args);},
        saveMeta() {}, savePending() {}, refreshAllViewsSafely() {}, setStatus() {}, pullServer() {}, schedulePush() {}, scheduleDocPush() {}
    });
    const item = {kind: 'key', id: 'report_data_test', local: {value: 'local', deleted: false}, remote: {value: 'server', rev: 42, deleted: false}};
    return {c, values, revisions, backups, item};
}
test('Explicit conflict decisions archive both versions and recheck the server cursor', async () => {
    let {c, values, revisions, backups, item} = conflictContext();
    await c.resolvePmmSyncConflict(item, 'server');
    assert.equal(backups.length, 1); assert.match(backups[0][2], /local/); assert.match(backups[0][3], /server/);
    assert.equal(values.report_data_test, 'server'); assert.equal(values.__sync_value_conflict_report_data_test, 'local');
    assert.equal(c.pending.report_data_test, undefined); assert.equal(revisions.report_data_test, 42); assert.equal(c.meta.lastRev, 0);
    ({c, values, revisions, item} = conflictContext());
    await c.resolvePmmSyncConflict(item, 'local');
    assert.equal(values.report_data_test, 'local'); assert.equal(c.pending.report_data_test.blocked, false);
    assert.equal(c.pending.report_data_test.baseValue, 'server'); assert.equal(revisions.report_data_test, 42);
});
test('A failed history write or a changed local candidate prevents conflict replacement', async () => {
    let {c, values, item} = conflictContext();
    c.archiveLocalSiteChange = async () => {throw new Error('history unavailable');};
    await assert.rejects(c.resolvePmmSyncConflict(item, 'server'), /history unavailable/);
    assert.equal(values.report_data_test, 'local'); assert.equal(c.pending.report_data_test.blocked, true);
    c.archiveLocalSiteChange = async () => {c.pending.report_data_test.value = 'newer'; values.report_data_test = 'newer';};
    await assert.rejects(c.resolvePmmSyncConflict(item, 'server'), /змінилися/);
    assert.equal(values.report_data_test, 'newer');
});
test('A normal user cannot choose to overwrite the shared site with a local conflict', async () => {
    const {c, item, backups} = conflictContext(); c.isAdminRole = () => false;
    await assert.rejects(c.resolvePmmSyncConflict(item, 'local'), /адмін/);
    assert.equal(backups.length, 0);
});
test('Identical blocked documents are acknowledged using server revisions without replacing files', async () => {
    const file = {id: 'a', fileName: 'a.doc', fileDataUrl: 'data:same', rev: 10, deleted: false};
    let info = {version: 0, fingerprints: {}, revisions: {}};
    const c = contextWith([['Shared_sync.js', 'fingerprintFile'], ['Shared_sync.js', 'pullDocsIfNewer']], {
        filesInFlight: false, docPushPromise: null, documentPending: {a: {blocked: true, deleted: false}},
        readJSON: () => info, writeJSON: (_key, next) => {info = next;}, IDB_META_KEY: 'metadata', DOCS_TIMEOUT_MS: 1000, SERVER_URL: 'test',
        exportAllDocsFromIndexedDB: async () => [file], restoreAllDocsToIndexedDB: async files => {assert.equal(files.length, 0);},
        fetchWithTimeout: async () => ({ok: true, json: async () => ({files: [file], version: 10})}),
        queueDocument() {throw new Error('Must not requeue identical file');}, saveDocumentPending() {}, scheduleDocPush() {}, callIfExists() {}, setStatus() {}
    });
    await c.pullDocsIfNewer(10, true);
    assert.equal(c.documentPending.a, undefined); assert.equal(info.revisions.a, 10);
});

test('GitHub save remains successful when the temporary disk is unavailable, and remote failure never updates the cache', async () => {
    let commits = 0, cacheWrites = 0, failRemote = false;
    const c = {
        githubStorage: { save: async () => { if (failRemote) throw new Error('GitHub unavailable'); commits++; } },
        fs: { promises: { mkdir: async () => { cacheWrites++; throw new Error('Disk full'); } } },
        DATA_DIR: 'cache', TMP_FILE: 'temp', STORE_FILE: 'store', console: { warn() {} }
    };
    vm.createContext(c);
    vm.runInContext(ts.transpile(extract('server.ts', 'writeSnapshot'), { target: ts.ScriptTarget.ES2022 }), c);
    await c.writeSnapshot('{"revision":1}');
    assert.equal(commits, 1); assert.equal(cacheWrites, 1);
    failRemote = true;
    await assert.rejects(c.writeSnapshot('{"revision":2}'), /GitHub unavailable/);
    assert.equal(cacheWrites, 1);
});

test('Cloud save sends reports and documents to the shared server without downloading a computer JSON', async () => {
    let downloads = 0, sent = 0, files = 0, archives = 0;
    const c = contextWith([['Shared_sync.js', 'forcePushAllDataToServer']], {
        manualSavePromise: null, manualBackupInProgress: false, lastSafetyWarning: '',
        setStatus() {}, callIfExists() {}, document: { getElementById: () => null },
        localKeys: () => [], pending: {}, documentPending: {}, savePending() {},
        flushPending: async () => { sent++; }, pushChangedDocs: async () => { files++; },
        fetchWithTimeout: async () => { archives++; return { ok: true, json: async () => ({ ok: true }) }; },
        getRole: () => 'admin', deviceId: 'test', SERVER_URL: 'https://test.invalid', DOCS_TIMEOUT_MS: 1000,
        createAutomaticSiteBackup: () => { downloads++; throw new Error('Must not download'); }
    });
    await c.forcePushAllDataToServer(false);
    assert.equal(downloads, 0); assert.equal(sent, 1); assert.equal(files, 1); assert.equal(archives, 1);
    assert.equal(c.manualSavePromise, null);
});
test('Independent report fields from two computers merge without losing either edit', () => {
    const c = mergeContext();
    const base = { 1: { refuelFuel: '10', note: 'old' } };
    const local = { 1: { refuelFuel: '20', note: 'old' } };
    const remote = { 1: { refuelFuel: '10', note: 'new' } };
    const actual = c.mergeCarValue('report_data_period', JSON.stringify(local), JSON.stringify(remote), JSON.stringify(base));
    assert.deepEqual(JSON.parse(actual), { 1: { refuelFuel: '20', note: 'new' } });
    assert.equal(c.mergeCarValue('report_data_period', JSON.stringify(local), JSON.stringify({ 1: { refuelFuel: '30', note: 'old' } }), JSON.stringify(base)), null);
});
test('Concurrent new documents and car attachments are retained, conflicting deletion is blocked', () => {
    const c = mergeContext();
    assert.deepEqual(JSON.parse(c.mergeCarValue('saved_documents_v2', '[{"id":"a"}]', '[{"id":"b"}]', '[]')).map(d => d.id).sort(), ['a', 'b']);
    const folder = c.mergeCarValue('car_folder_1', '{"path":"Doc/1","files":[{"id":"a"}]}', '{"path":"Doc/1","files":[{"id":"b"}]}', '{"path":"Doc/1","files":[]}');
    assert.deepEqual(JSON.parse(folder).files.map(f => f.id).sort(), ['a', 'b']);
    assert.equal(c.mergeCarValue('saved_documents_v2', '[{"id":"a","content":"edited"}]', '[]', '[{"id":"a","content":"old"}]'), null);
});
test('Route arrays retain their array shape and independent top-field edits', () => {
    const c = mergeContext();
    const base = { rows: [{ km: '10' }], topFields: { fuel: '1' } };
    const local = { rows: [{ km: '20' }], topFields: { fuel: '1' } };
    const remote = { rows: [{ km: '10' }], topFields: { fuel: '2' } };
    const actual = JSON.parse(c.mergeCarValue('isolated_car_routes_1', JSON.stringify(local), JSON.stringify(remote), JSON.stringify(base)));
    assert.ok(Array.isArray(actual.rows)); assert.equal(actual.rows[0].km, '20'); assert.equal(actual.topFields.fuel, '2');
});
test('Opening site with a smaller server registry preserves missing real local cars', () => {
    const local = Array.from({ length: 108 }, (_, i) => ({ id: i + 1, model: 'car' }));
    const remote = local.slice(0, 68); remote[0] = { id: 1, model: 'newer server model' };
    const values = { user_cars_database_v2: JSON.stringify(local) };
    const c = contextWith([['Shared_sync.js', 'isCarKey'], ['Shared_sync.js', 'mergeCarValue'], ['Shared_sync.js', 'applyRemoteKeys']], {
        __pmmHadSavedCars: true, pending: {}, meta: { carBases: {} }, applyingRemote: false,
        isSyncedKey: () => true, localGet: key => values[key] ?? null, localSet: (key, value) => { values[key] = value; },
        localRemove: key => { delete values[key]; }, setKeyRev() {}, getKeyRev: () => 0, setStatus() {}
    });
    c.applyRemoteKeys({ user_cars_database_v2: { value: JSON.stringify(remote), rev: 20, deleted: false } }, true);
    const kept = JSON.parse(values.user_cars_database_v2);
    assert.equal(kept.length, 108); assert.equal(kept[0].model, 'newer server model');
    assert.equal(JSON.parse(c.pending.user_cars_database_v2.value).length, 108);
});
test('Fresh demo data is not added to an existing real server registry', () => {
    const values = { user_cars_database_v2: '[{"id":1},{"id":2},{"id":3}]' };
    const c = contextWith([['Shared_sync.js', 'isCarKey'], ['Shared_sync.js', 'mergeCarValue'], ['Shared_sync.js', 'applyRemoteKeys']], {
        __pmmHadSavedCars: false, pending: {}, meta: { carBases: {} }, applyingRemote: false,
        isSyncedKey: () => true, localGet: key => values[key] ?? null, localSet: (key, value) => { values[key] = value; },
        localRemove() {}, setKeyRev() {}, getKeyRev: () => 0, setStatus() {}
    });
    c.applyRemoteKeys({ user_cars_database_v2: { value: '[{"id":5}]', rev: 20, deleted: false } }, true);
    assert.deepEqual(JSON.parse(values.user_cars_database_v2), [{ id: 5 }]);
});
test('A4 draft saves content, layout and title without closing or re-rendering editor', () => {
    let saved = [{ id: 'doc_1', name: 'old', content: 'old', layout: {} }];
    const elements = { 'doc-editor-name-input': { value: 'new title' }, 'doc-ed-body-text': { innerText: 'новий текст', innerHTML: '<p>новий текст</p>' } };
    const c = contextWith([['documents.js', 'saveDocumentEditorDraft']], {
        currentEditingDocId: 'doc_1', documentEditorLoading: false, docLayoutState: { bodyStyle: { fontSize: 16 } },
        getSavedDocumentsList: () => JSON.parse(JSON.stringify(saved)), syncAllRichBlocksToState() {},
        document: { getElementById: id => elements[id] }, saveDocumentsList: docs => { saved = docs; return true; }
    });
    assert.equal(c.saveDocumentEditorDraft(), true);
    assert.equal(saved[0].content, 'новий текст'); assert.equal(saved[0].name, 'new title'); assert.equal(saved[0].layout.bodyStyle.fontSize, 16);
    c.documentEditorLoading = true; elements['doc-ed-body-text'].innerText = 'loading old document';
    assert.equal(c.saveDocumentEditorDraft(), false); assert.equal(saved[0].content, 'новий текст');
});
for (const car of [false, true]) test(`Binary ${car ? 'car' : 'A4'} file is backed up before writing, and acknowledged only on transaction completion`, async () => {
    const name = car ? 'CarDoc' : 'Doc', file = car ? 'car_details_view.js' : 'documents.js';
    const order = [], events = []; let current = { id: 'file', fileDataUrl: 'old' };
    const db = { transaction() {
        const tx = { objectStore() { return {
            put(data) { order.push('write'); queueMicrotask(() => { current = data; tx.oncomplete(); }); },
            delete() { order.push('delete'); queueMicrotask(() => { current = null; tx.oncomplete(); }); }
        }; } }; return tx;
    } };
    const c = { archiveLocalSiteChange: async () => { order.push('backup'); }, notifyPmmDocumentChange: (id, deleted) => events.push({ id, deleted }) };
    c[car ? 'openCarDocsIDB' : 'openDocsIndexedDB'] = async () => db;
    c['get' + name + 'BinaryFromIDB'] = async () => current;
    c[car ? 'CAR_DOCS_IDB_STORE' : 'DOCS_IDB_STORE'] = 'files';
    contextWith([[file, 'save' + name + 'BinaryToIDB'], [file, 'delete' + name + 'BinaryFromIDB']], c);
    assert.equal(await c['save' + name + 'BinaryToIDB']('file', { fileDataUrl: 'new' }), true);
    assert.deepEqual(order, ['backup', 'write']); assert.equal(events.length, 1);
    await c['save' + name + 'BinaryToIDB']('file', { fileDataUrl: 'remote' }, true);
    assert.equal(events.length, 1); // Remote pull must not start an upload loop.
    await c['delete' + name + 'BinaryFromIDB']('file');
    assert.equal(current, null); assert.deepEqual(events.at(-1), { id: 'file', deleted: true });
});
test('Automatic JSON and server archive both import original report and attachment values', async () => {
    const values = {}, attachments = [];
    const c = contextWith([['developer_panel.js', 'applyParsedJsonToStorage']], {
        carsData: [], localStorage: { setItem: (key, value) => { values[key] = value; } }, sessionStorage: { setItem() {} },
        saveDocBinaryToIDB: async (id, file) => { attachments.push(file); return true; },
        saveCarDocBinaryToIDB: async (id, file) => { attachments.push(file); return true; }
    });
    await c.applyParsedJsonToStorage({ localStorageData: { report_data_test: { 1: { note: 'original' } }, user_cars_database_v2: [{ id: 1 }] },
        indexedDBFiles: [{ id: 'doc_1', fileDataUrl: 'original-doc' }], carIndexedDBFiles: [{ id: 'cardoc_1', dataUrl: 'original-car-doc' }] });
    assert.equal(JSON.parse(values.report_data_test)[1].note, 'original'); assert.equal(attachments.length, 2);
    await c.applyParsedJsonToStorage({ schemaVersion: 2, keys: { report_data_test: { value: '{"restored":true}', deleted: false }, stale: { value: 'bad', deleted: true } }, files: {} });
    assert.equal(values.report_data_test, '{"restored":true}'); assert.equal(values.stale, undefined);
});

function binarySyncContext({ fail = false, reject = false, concurrent = false, deletion = false } = {}) {
    const info = { version: 1, fingerprints: { file: 'old' }, revisions: { file: 3 } };
    const requests = [], timers = [];
    const c = {
        documentPending: { file: { token: 'first', baseRev: 3, deleted: deletion } },
        pending: {}, docPushPromise: null, manualBackupInProgress: false, awaitingFirstPull: false, filesInFlight: false,
        docRetryDelay: 1000, RETRY_MIN_MS: 1000, RETRY_MAX_MS: 15000, DOCS_TIMEOUT_MS: 1000,
        IDB_META_KEY: 'meta', SERVER_URL: 'https://test.invalid', lastSafetyWarning: '',
        readJSON: () => info, writeJSON() {}, saveDocumentPending() {}, setStatus() {},
        scheduleDocPush: ms => timers.push(ms), isAdminRole: () => true, getRole: () => 'admin',
        exportAllDocsFromIndexedDB: async () => deletion ? [] : [{ id: 'file', fileName: 'test.doc', fileDataUrl: 'data:new' }],
        fetchWithTimeout: async (url, options) => {
            requests.push(JSON.parse(options.body));
            if (concurrent) c.documentPending.file.token = 'second';
            if (fail) throw new Error('offline');
            return { ok: true, json: async () => ({ ok: true, version: 99, applied: reject ? {} : { file: 4 }, rejected: reject ? { file: { rev: 4, deleted: false } } : {} }) };
        }
    };
    contextWith([['Shared_sync.js', 'fingerprintFile'], ['Shared_sync.js', 'pushChangedDocs']], c);
    return { c, info, requests, timers };
}
test('Offline file upload remains queued and retries; same-size edits are detected', async () => {
    const { c, timers } = binarySyncContext({ fail: true });
    await c.pushChangedDocs(false);
    assert.equal(c.documentPending.file.token, 'first'); assert.ok(timers.length);
    assert.notEqual(c.fingerprintFile({ fileDataUrl: 'AAAA1' + 'x'.repeat(100) }), c.fingerprintFile({ fileDataUrl: 'AAAA2' + 'x'.repeat(100) }));
});
test('A file acknowledgement cannot erase a newer local edit or advance the GET cursor', async () => {
    const { c, info } = binarySyncContext({ concurrent: true });
    await c.pushChangedDocs(true);
    assert.equal(c.documentPending.file.token, 'second'); assert.equal(c.documentPending.file.baseRev, 4);
    assert.equal(info.version, 1);
});
test('File deletion is explicit, revision checked and acknowledged without resurrecting it', async () => {
    const { c, info, requests } = binarySyncContext({ deletion: true });
    await c.pushChangedDocs(true);
    assert.deepEqual(requests[0].deletedFileIds, [{ id: 'file', baseRev: 3 }]);
    assert.equal(c.documentPending.file, undefined); assert.equal(info.fingerprints.file, undefined);
});
test('Conflicting file upload stays local; metadata conflict prevents destructive binary deletion', async () => {
    const { c } = binarySyncContext({ reject: true });
    await c.pushChangedDocs(true); assert.equal(c.documentPending.file.blocked, true);
    const other = binarySyncContext({ deletion: true });
    other.c.pending.saved_documents_v2 = { blocked: true };
    await other.c.pushChangedDocs(true);
    assert.equal(other.requests.length, 0); assert.ok(other.c.documentPending.file);
});
test('Remote file download skips unsent local documents', async () => {
    const info = { version: 1, fingerprints: {}, revisions: {} }, restored = [];
    const c = contextWith([['Shared_sync.js', 'fingerprintFile'], ['Shared_sync.js', 'pullDocsIfNewer']], {
        IDB_META_KEY: 'meta', SERVER_URL: 'https://test.invalid', DOCS_TIMEOUT_MS: 1000,
        filesInFlight: false, docPushPromise: null, documentPending: { file: { deleted: false, token: 'pending' } },
        readJSON: () => info, writeJSON() {}, setStatus() {}, queueDocument() {}, saveDocumentPending() {}, scheduleDocPush() {}, callIfExists() {},
        exportAllDocsFromIndexedDB: async () => [{ id: 'file', fileDataUrl: 'data:local' }],
        restoreAllDocsToIndexedDB: async files => restored.push(...files),
        fetchWithTimeout: async () => ({ ok: true, json: async () => ({ version: 5, files: [{ id: 'file', fileDataUrl: 'data:remote', rev: 4 }] }) })
    });
    await c.pullDocsIfNewer(5, true);
    assert.equal(restored.length, 0); assert.ok(c.documentPending.file); assert.equal(info.version, 5);
});
