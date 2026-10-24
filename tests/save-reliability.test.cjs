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
        if (ts.isBinaryExpression(node) && node.left.getText(source) === 'window.' + name && !ts.isIdentifier(node.right)) found = node.getText(source) + ';';
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

test('Route service timestamps do not create conflicts, even without a base snapshot', () => {
    const c = mergeContext();
    const remote = {topFields: {fuelStart: '24', odo1: '212971', odo2: '212971', updatedAt: '2026-10-24T17:28:11.390Z'}, rows: [{name: 'Маршрут', inputs: ['А', '8:30', '0']}]};
    const local = {...remote, topFields: {...remote.topFields, updatedAt: '2026-10-24T17:29:41.076Z'}};
    const encoded = JSON.stringify(remote);
    assert.equal(c.mergeCarValue('isolated_car_routes_21.10-31.10_9', JSON.stringify(local), encoded), encoded);
    assert.equal(c.mergeCarValue('isolated_car_routes_21.10-31.10_9', JSON.stringify(local), encoded, JSON.stringify(local)), encoded);
    const reordered = {rows: local.rows, topFields: Object.fromEntries(Object.entries(local.topFields).reverse())};
    assert.equal(c.mergeCarValue('isolated_car_routes_1', JSON.stringify(reordered), encoded), encoded);
});

test('Ignoring a route timestamp never hides real fuel, odometer or route row collisions', () => {
    const c = mergeContext(), encode = JSON.stringify;
    const base = {topFields: {fuelStart: '24', odo1: '100', updatedAt: 'old'}, rows: [{name: 'А', km: '10', updatedAt: 'row-date'}]};
    for (const field of ['fuelStart', 'odo1']) {
        const local = {...base, topFields: {...base.topFields, [field]: '30', updatedAt: 'local'}};
        const remote = {...base, topFields: {...base.topFields, [field]: '40', updatedAt: 'remote'}};
        assert.equal(c.mergeCarValue('isolated_car_routes_1', encode(local), encode(remote), encode(base)), null);
        assert.equal(c.mergeCarValue('isolated_car_routes_1', encode(local), encode(remote)), null);
    }
    const local = {...base, rows: [{...base.rows[0], updatedAt: 'row-date-local'}]};
    const remote = {...base, rows: [{...base.rows[0], updatedAt: 'row-date-remote'}]};
    assert.equal(c.mergeCarValue('isolated_car_routes_1', encode(local), encode(remote), encode(base)), null);
    assert.equal(c.mergeCarValue('isolated_car_routes_1', encode(base), '{"topFields":{},"rows":{}}'), null);
});

test('Repeated unchanged route saves preserve the timestamp and never write another local edit', () => {
    const old = {topFields: {fuelStart: '24', updatedAt: 'old'}, rows: [{km: '10'}]};
    let raw = JSON.stringify(old), writes = 0;
    const c = contextWith([['app2.js', 'writeCarRouteSnapshot']], {localStorage: {
        getItem: () => raw, setItem: (_key, value) => {raw = value; writes++;}
    }});
    assert.equal(c.writeCarRouteSnapshot('route', {...old.topFields, updatedAt: 'new'}, old.rows), false);
    assert.equal(writes, 0); assert.equal(JSON.parse(raw).topFields.updatedAt, 'old');
    assert.equal(c.writeCarRouteSnapshot('route', {fuelStart: '30', updatedAt: 'real-edit'}, old.rows), true);
    assert.equal(writes, 1); assert.equal(JSON.parse(raw).topFields.fuelStart, '30');
    assert.equal(c.writeCarRouteSnapshot('route', {updatedAt: 'later', fuelStart: '30'}, old.rows), false);
    assert.equal(writes, 1);
});

function routeRepairContext() {
    const key = 'isolated_car_routes_21.10-31.10_9';
    const remote = JSON.stringify({topFields: {fuelStart: '24', updatedAt: 'old'}, rows: [{km: '10'}]});
    const local = JSON.stringify({topFields: {fuelStart: '24', updatedAt: 'new'}, rows: [{km: '10'}]});
    const values = {[key]: local}, archives = [];
    const c = contextWith([['Shared_sync.js', 'mergeCarValue'], ['Shared_sync.js', 'reconcileSafeRouteRecords']], {
        pending: {[key]: {value: local, blocked: true}}, meta: {carBases: {}}, lastSafetyWarning: 'old warning',
        localGet: k => values[k], localSet: (k,v) => {values[k] = v;},
        archiveLocalSiteChange: async (...args) => {archives.push(args);}, setKeyRev() {}, saveMeta() {}, savePending() {}
    });
    return {c, key, local, remote, values, archives};
}

test('An old timestamp-only blocked queue repairs automatically only after both versions are archived', async () => {
    const {c,key,local,remote,values,archives} = routeRepairContext();
    assert.equal(await c.reconcileSafeRouteRecords({[key]: {value: remote, rev: 10}}), true);
    assert.equal(archives.length, 1); assert.equal(archives[0][2], local); assert.equal(archives[0][3], remote);
    assert.equal(values[key], remote); assert.equal(c.pending[key], undefined); assert.equal(c.lastSafetyWarning, '');
});

test('Failed route history, concurrent typing and real collisions leave the blocked edit intact', async () => {
    let f = routeRepairContext();
    f.c.archiveLocalSiteChange = async () => {throw Error('archive failed');};
    await assert.rejects(f.c.reconcileSafeRouteRecords({[f.key]: {value: f.remote, rev: 10}}), /archive failed/);
    assert.equal(f.values[f.key], f.local); assert.equal(f.c.pending[f.key].blocked, true);
    f = routeRepairContext();
    f.c.archiveLocalSiteChange = async () => {f.values[f.key] = 'new typing';};
    assert.equal(await f.c.reconcileSafeRouteRecords({[f.key]: {value: f.remote, rev: 10}}), false);
    assert.equal(f.values[f.key], 'new typing'); assert.equal(f.c.pending[f.key].blocked, true);
    f = routeRepairContext();
    const remote = JSON.parse(f.remote); remote.topFields.fuelStart = '99';
    assert.equal(await f.c.reconcileSafeRouteRecords({[f.key]: {value: JSON.stringify(remote), rev: 10}}), false);
    assert.equal(f.archives.length, 0); assert.equal(f.values[f.key], f.local);
});

function modificationsContext() {
    return contextWith([['Shared_sync.js', 'mergeCarValue'], ['Shared_sync.js', 'mergeCarModifications'], ['Shared_sync.js', 'retainServerModifications']]);
}

test('A shorter property overlay retains server vehicles and independently changed fields', () => {
    const c = modificationsContext();
    const base = {1: {id: 1, note: 'old', driver: 'A'}, 2: {id: 2}, 3: {id: 3}};
    const local = {1: {id: 1, note: 'new', driver: 'A'}};
    const remote = {...base, 1: {...base[1], driver: 'B'}, 4: {id: 4}};
    const merged = JSON.parse(c.mergeCarModifications(JSON.stringify(local), JSON.stringify(remote), JSON.stringify(base)));
    assert.deepEqual(merged, {...remote, 1: {id: 1, note: 'new', driver: 'B'}});
});

test('Saving a partial visible fleet preserves stored properties of other vehicles and unknown fields', () => {
    let saved, registrySaves = 0;
    const previous = {1: {id: 1, note: 'before', customField: 'retain'}, 2: {id: 2, note: 'other vehicle'}};
    const c = contextWith([['app.js', 'saveCarsModificationsToStorage']], {
        carsData: [{id: 1, model: 'CAR', note: 'after'}],
        localStorage: {getItem: () => JSON.stringify(previous), setItem: (_key, value) => {saved = JSON.parse(value);}},
        saveCarsToStorage: () => {registrySaves++;}
    });
    c.saveCarsModificationsToStorage();
    assert.deepEqual(saved[2], previous[2]); assert.equal(saved[1].customField, 'retain');
    assert.equal(saved[1].note, 'after'); assert.equal(registrySaves, 1);
});

test('Automatic property reconciliation also archives both versions and retains server-only vehicles', async () => {
    const key = 'cars_modifications_data', base = '{"1":{"note":"old"}}', local = '{"1":{"note":"new"}}';
    const remote = '{"1":{"note":"old"},"2":{"id":2}}';
    let value = local, archived = false;
    const c = contextWith([['Shared_sync.js', 'mergeCarValue'], ['Shared_sync.js', 'mergeCarModifications'], ['Shared_sync.js', 'reconcileSafeModificationsRecord']], {
        pending: {[key]: {value: local, baseValue: base, blocked: true}}, meta: {carBases: {}},
        localGet: () => value, localSet: (_k,v) => {assert.equal(archived, true); value = v;},
        archiveLocalSiteChange: async () => {archived = true;}, setKeyRev() {}, saveMeta() {}, savePending() {}, lastSafetyWarning: ''
    });
    assert.equal(await c.reconcileSafeModificationsRecord({value: remote, rev: 2}), true);
    assert.deepEqual(JSON.parse(value), {1: {note: 'new'}, 2: {id: 2}});
    assert.equal(c.pending[key].blocked, false);
});

test('Property reconciliation refuses same-field collisions, unknown bases and edited remote deletions', () => {
    const c = modificationsContext();
    const base = '{"1":{"note":"old"}}', local = '{"1":{"note":"local"}}', remote = '{"1":{"note":"remote"}}';
    assert.equal(c.mergeCarModifications(local, remote, base), null);
    assert.equal(c.mergeCarModifications(local, remote, undefined), null);
    assert.equal(c.mergeCarModifications(local, '{}', base), null);
    assert.equal(c.mergeCarModifications('[]', remote, base), null);
    assert.equal(c.mergeCarModifications('invalid', remote, base), null);
});

test('Module save hooks retain blocked overlay status and its original merge base', () => {
    const c = contextWith([['Shared_sync.js', 'queueLocalChange']], {
        pending: {cars_modifications_data: {value: 'old local', baseValue: 'original server', blocked: true}},
        isCarKey: () => true, meta: {carBases: {cars_modifications_data: 'new server'}},
        awaitingFirstPull: false, MAX_VALUE_BYTES: 10000, PUSH_DEBOUNCE_MS: 400,
        savePending() {}, schedulePush() {}
    });
    c.queueLocalChange('cars_modifications_data', 'edited local', false, 'old local');
    assert.equal(c.pending.cars_modifications_data.blocked, true);
    assert.equal(c.pending.cars_modifications_data.baseValue, 'original server');
    assert.equal(c.pending.cars_modifications_data.value, 'edited local');
});

test('An explicitly chosen local property version retains other server records and fields', async () => {
    const c = modificationsContext();
    const merged = c.retainServerModifications('{"1":{"note":"local"}}', '{"1":{"note":"remote","vin":"KEEP"},"2":{"id":2},"3":{"id":3}}');
    assert.deepEqual(JSON.parse(merged), {1: {note: 'local', vin: 'KEEP'}, 2: {id: 2}, 3: {id: 3}});
    const {registryChangeBlocked} = await import('../storage_backups.ts');
    assert.equal(registryChangeBlocked('cars_modifications_data', '{"1":{},"2":{},"3":{}}', merged), false);
});

test('Registry safety rejection preserves typed notes and blocks retries until resolved', async () => {
    for (const key of ['user_cars_database_v2', 'cars_modifications_data']) {
        const typed = JSON.stringify([{ id: 1, note: 'Нова примітка' }]);
        const older = JSON.stringify([{ id: 1, note: '' }, { id: 2 }, { id: 3 }]);
        const values = { [key]: typed }, revisions = {}, statuses = [];
        let refreshes = 0;
        const c = contextWith([['Shared_sync.js', 'buildPayload'], ['Shared_sync.js', 'flushPending']], {
            pending: { [key]: { value: typed, deleted: false } },
            meta: { carBases: { [key]: older } }, manualBackupInProgress: false,
            pushInFlight: false, pullInFlight: false, awaitingFirstPull: false,
            localSet: (name, value) => { values[name] = value; },
            getKeyRev: name => revisions[name] || 5,
            setKeyRev: (name, value) => { revisions[name] = value; },
            isCarKey: () => true, getRole: () => 'developer', deviceId: 'test',
            SERVER_URL: 'https://test.invalid', PUSH_TIMEOUT_MS: 1000,
            RETRY_MIN_MS: 1000, RETRY_MAX_MS: 15000, retryDelay: 1000,
            setStatus: status => statuses.push(status), saveMeta() {}, savePending() {},
            schedulePush() {}, pullSharedEvent() {},
            refreshAllViewsSafely: () => { refreshes++; },
            fetchWithTimeout: async () => ({ ok: true, json: async () => ({
                applied: {}, rejected: { [key]: { value: older, rev: 10, safetyBlocked: true } }
            }) })
        });
        await c.flushPending();
        assert.equal(values[key], typed, 'visible/local note must not revert');
        assert.equal(values['__sync_car_conflict_' + key], typed);
        assert.equal(c.pending[key].value, typed);
        assert.equal(c.pending[key].blocked, true);
        assert.equal(revisions[key], undefined, 'unresolved edit must retain its base revision');
        assert.equal(Object.keys(c.buildPayload().changes).length, 0);
        assert.equal(refreshes, 0);
        assert.ok(statuses.includes('conflict'));
    }
});

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

function modificationsConflict() {
    const fixture = conflictContext(), {c, values, item} = fixture;
    for (const name of ['mergeCarValue', 'mergeCarModifications', 'conflictMergeValue', 'retainServerModifications']) {
        vm.runInContext(extract('Shared_sync.js', name), c);
    }
    const base = '{"1":{"note":"old","driver":"A"},"2":{"id":2},"3":{"id":3}}';
    const local = '{"1":{"note":"local","driver":"A"}}';
    const remote = '{"1":{"note":"old","driver":"B"},"2":{"id":2},"3":{"id":3}}';
    delete c.pending.report_data_test;
    c.pending.cars_modifications_data = {value: local, baseValue: base, blocked: true};
    values.cars_modifications_data = local;
    Object.assign(item, {id: 'cars_modifications_data', local: {value: local, deleted: false}, remote: {value: remote, rev: 42, deleted: false}});
    return fixture;
}

test('Safe overlay conflict resolution archives both originals before writing the combined version', async () => {
    const {c, values, backups, item} = modificationsConflict();
    await c.resolvePmmSyncConflict(item, 'merge');
    assert.equal(backups.length, 1);
    assert.equal(JSON.parse(backups[0][2]).value, item.local.value);
    assert.equal(JSON.parse(backups[0][3]).value, item.remote.value);
    assert.deepEqual(JSON.parse(values.cars_modifications_data), {1: {note: 'local', driver: 'B'}, 2: {id: 2}, 3: {id: 3}});
    assert.equal(c.pending.cars_modifications_data.blocked, false);
    assert.equal(c.pending.cars_modifications_data.baseValue, item.remote.value);
});

test('A failed archive or a genuine field collision cannot unblock a property conflict', async () => {
    const {c, values, item} = modificationsConflict();
    c.archiveLocalSiteChange = async () => {throw new Error('archive failed');};
    await assert.rejects(c.resolvePmmSyncConflict(item, 'merge'), /archive failed/);
    assert.equal(c.pending.cars_modifications_data.blocked, true);
    assert.equal(values.cars_modifications_data, item.local.value);
    item.remote.value = '{"1":{"note":"another edit","driver":"A"}}';
    await assert.rejects(c.resolvePmmSyncConflict(item, 'merge'), /різні зміни/);
    c.isAdminRole = () => false;
    await assert.rejects(c.resolvePmmSyncConflict(item, 'merge'), /адмін/);
});
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
        localKeys: () => ['report_data_blocked'], isSyncedKey: () => true, localGet: () => 'local conflict',
        pending: {report_data_blocked: {value: 'local conflict', blocked: true}}, documentPending: {}, savePending() {},
        flushPending: async () => { sent++; }, pushChangedDocs: async () => { files++; },
        fetchWithTimeout: async () => { archives++; return { ok: true, json: async () => ({ ok: true }) }; },
        getRole: () => 'admin', deviceId: 'test', SERVER_URL: 'https://test.invalid', DOCS_TIMEOUT_MS: 1000,
        createAutomaticSiteBackup: () => { downloads++; throw new Error('Must not download'); }
    });
    await c.forcePushAllDataToServer(false);
    assert.equal(downloads, 0); assert.equal(sent, 1); assert.equal(files, 1); assert.equal(archives, 1);
    assert.equal(c.manualSavePromise, null);
    assert.equal(c.pending.report_data_blocked.blocked, true, 'ordinary Save cannot silently unblock a conflict');
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
