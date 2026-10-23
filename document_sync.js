// Binary documents use the same durable outbox as ordinary site data.
(function () {
    'use strict';
    function all(open, name) {
        if (typeof open !== 'function') return Promise.resolve([]);
        return open().then(function (db) {
            if (!db) throw new Error('Сховище документів недоступне');
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(name, 'readonly');
                var request = tx.objectStore(name).getAll();
                tx.oncomplete = function () { db.close(); resolve(request.result || []); };
                tx.onerror = tx.onabort = function () { db.close(); reject(new Error('Не вдалося прочитати файли')); };
            });
        });
    }
    window.exportAllDocsFromIndexedDB = async function () {
        var sets = await Promise.all([all(window.openDocsIndexedDB, 'files'), all(window.openCarDocsIDB, 'car_files')]);
        return sets[0].concat(sets[1]).map(function (file) {
            return { id: file.id, fileDataUrl: file.fileDataUrl || file.dataUrl || '',
                fileName: file.originalFileName || file.fileName || '', updatedAt: file.updatedAt || 0 };
        }).filter(function (file) { return file.fileDataUrl; });
    };
    window.restoreAllDocsToIndexedDB = async function (files, fromServer) {
        for (var file of files) {
            var car = String(file.id).indexOf('cardoc_') === 0;
            if (file.deleted) {
                if (car) await window.deleteCarDocBinaryFromIDB(file.id, !!fromServer);
                else await window.deleteDocBinaryFromIDB(file.id, !!fromServer);
                continue;
            }
            var data = { fileDataUrl: file.fileDataUrl, originalFileName: file.fileName,
                fileName: file.fileName, ext: String(file.fileName || '').split('.').pop().toLowerCase(), updatedAt: file.updatedAt };
            if (car) data.dataUrl = file.fileDataUrl;
            var ok = car ? await window.saveCarDocBinaryToIDB(file.id, data, !!fromServer) : await window.saveDocBinaryToIDB(file.id, data, !!fromServer);
            if (!ok) throw new Error('Не вдалося зберегти отриманий документ: ' + file.fileName);
        }
    };
    window.notifyPmmDocumentChange = function (id, deleted) {
        window.dispatchEvent(new CustomEvent('pmm-document-changed', { detail: { id: id, deleted: !!deleted } }));
    };
})();
