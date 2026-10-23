// Local, import-compatible JSON backup. No data is sent to another service.
(function () {
    'use strict';
    var historyDatabase;
    var historyQueue = Promise.resolve();
    function openHistory() {
        if (!historyDatabase) historyDatabase = new Promise(function (resolve, reject) {
            if (!window.indexedDB) { reject(new Error('Браузер не підтримує локальну історію змін')); return; }
            var request = window.indexedDB.open('PmmAutomaticBackups_v1', 1);
            request.onupgradeneeded = function () { request.result.createObjectStore('changes', { keyPath: 'id', autoIncrement: true }); };
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = request.onblocked = function () { historyDatabase = null; reject(new Error('Локальна історія змін недоступна')); };
        });
        return historyDatabase;
    }
    // Changes that never leave this browser (including the aggregate calculator)
    // also have a dated journal. Runtime counters / sync metadata are not edits.
    window.archiveLocalSiteChange = function (kind, key, previous, next) {
        if (kind === 'localStorage' && (/^__sync_/.test(key) || /^(dev_role_time_stats|lastReadBroadcastId_|last_active_)/i.test(key))) return Promise.resolve();
        var record = { kind: kind, key: key, previous: previous, next: next,
            changedAt: new Date().toISOString(), timezone: 'Europe/Kyiv' };
        var operation = historyQueue.catch(function () {}).then(function () {
            return openHistory().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var tx = db.transaction('changes', 'readwrite');
                    tx.objectStore('changes').add(record);
                    tx.oncomplete = function () { resolve(); };
                    tx.onerror = tx.onabort = function () { reject(new Error('Не вдалося зберегти локальну історію змін')); };
                });
            });
        });
        historyQueue = operation;
        operation.catch(function (error) { window.localBackupFailure = error.message; console.warn(error.message); });
        return operation;
    };
    window.downloadLocalSiteHistory = async function () {
        try {
            await historyQueue;
            var db = await openHistory();
            var records = await new Promise(function (resolve, reject) {
                var tx = db.transaction('changes', 'readonly');
                var request = tx.objectStore('changes').getAll();
                tx.oncomplete = function () { resolve(request.result || []); };
                tx.onerror = tx.onabort = function () { reject(new Error('Не вдалося прочитати історію')); };
            });
            var payload = { app: 'ПММ — історія змін', timezone: 'Europe/Kyiv', exportDate: new Date().toISOString(), changes: records };
            var url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }));
            var link = document.createElement('a');
            link.href = url;
            link.download = 'pmm_change_history_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
            document.body.appendChild(link);
            link.click(); link.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        } catch (error) { alert('Історію не завантажено: ' + error.message); }
    };
    function readFiles(openDatabase, storeName) {
        if (typeof openDatabase !== 'function') return Promise.resolve([]);
        return Promise.resolve(openDatabase()).then(function (db) {
            if (!db) throw new Error('Не вдалося відкрити сховище документів');
            return new Promise(function (resolve, reject) {
                var records;
                var tx = db.transaction(storeName, 'readonly');
                var request = tx.objectStore(storeName).getAll();
                request.onsuccess = function () { records = request.result || []; };
                tx.oncomplete = function () { db.close(); resolve(records); };
                tx.onerror = tx.onabort = function () { db.close(); reject(new Error('Не вдалося скопіювати документи')); };
            });
        });
    }
    window.createAutomaticSiteBackup = async function () {
        var now = new Date();
        // Capture local values before awaiting IndexedDB or any server response.
        var storage = {};
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (!key || key.indexOf('__sync_') === 0) continue;
            var raw = localStorage.getItem(key);
            try { storage[key] = JSON.parse(raw); } catch (e) { storage[key] = raw; }
        }
        // Preserve the open A4 editor draft without closing or re-rendering it.
        if (typeof currentEditingDocId !== 'undefined' && currentEditingDocId && typeof docLayoutState !== 'undefined') {
            if (typeof syncAllRichBlocksToState === 'function') syncAllRichBlocksToState();
            var doc = Array.isArray(storage.saved_documents_v2) && storage.saved_documents_v2.find(function (item) { return item.id === currentEditingDocId; });
            if (doc) {
                doc.layout = JSON.parse(JSON.stringify(docLayoutState));
                var body = document.getElementById('doc-ed-body-text');
                var title = document.getElementById('doc-editor-name-input');
                if (body) { doc.content = body.innerText; doc.bodyHtml = body.innerHTML; }
                if (title && title.value.trim()) { doc.name = title.value.trim(); doc.title = doc.name; }
            }
        }
        var warnings = [];
        if (window.localBackupFailure) warnings.push(window.localBackupFailure);
        await historyQueue.catch(function (error) { warnings.push(error.message); });
        var databases = await Promise.all([
            readFiles(window.openDocsIndexedDB, 'files').catch(function (e) { warnings.push(e.message); return []; }),
            readFiles(window.openCarDocsIDB, 'car_files').catch(function (e) { warnings.push(e.message); return []; })
        ]);
        var documents = databases[0];
        var carFiles = databases[1];
        var bins = {};
        documents.concat(carFiles).forEach(function (record) { bins[record.id] = record; });
        // Embed car files in metadata so existing JSON import can recover them
        // even on a device without the original IndexedDB databases.
        Object.keys(storage).forEach(function (key) {
            if (key.indexOf('car_folder_') === 0 && storage[key] && Array.isArray(storage[key].files)) {
                storage[key].files.forEach(function (file) {
                    var bin = bins[file.id];
                    if (bin && bin.dataUrl) file.dataUrl = bin.dataUrl;
                });
            }
        });
        if (Array.isArray(storage.saved_documents_v2)) {
            storage.saved_documents_v2.forEach(function (doc) {
                var bin = bins[doc.id];
                if (bin) {
                    doc.fileDataUrl = bin.fileDataUrl || doc.fileDataUrl || '';
                    doc.extractedHtml = bin.extractedHtml || doc.extractedHtml || '';
                    doc.extractedText = bin.extractedText || doc.extractedText || '';
                }
            });
        }
        var stamp = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
        }).format(now).replace(' ', '_').replace(/:/g, '-');
        var payload = {
            app: 'Облік палива та конструктор документів А4',
            version: '3.1-AUTOMATIC',
            exportDate: now.toISOString(),
            exportDateLocale: now.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }),
            timezone: 'Europe/Kyiv',
            summary: { totalCars: Array.isArray(storage.user_cars_database_v2) ? storage.user_cars_database_v2.length : 0,
                totalLocalStorageKeys: Object.keys(storage).length, totalIndexedDBFiles: documents.length + carFiles.length },
            warnings: warnings,
            localStorageData: storage,
            indexedDBFiles: documents,
            carIndexedDBFiles: carFiles
        };
        var fileName = 'pmm_auto_backup_' + stamp + '_' + String(now.getMilliseconds()).padStart(3, '0') + '.json';
        var url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }));
        var link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        try { link.click(); } finally { link.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 60000); }
        return { fileName: fileName, carsCount: payload.summary.totalCars, warnings: warnings };
    };
})();
