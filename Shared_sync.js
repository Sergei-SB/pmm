// =========================================================================
// Shared_sync.js — КЛІЄНТ СПІЛЬНОЇ СИНХРОНІЗАЦІЇ (повна версія)
// =========================================================================
// Що виправлено проти попередньої версії:
//  1. Дані з сервера завантажуються ДО першого рендера застосунку
//     (обробники DOMContentLoaded, зареєстровані після цього файлу, відкладаються,
//     запобіжник 3 с)
//  2. Надсилаються лише ЗМІНЕНІ ключі, з базовою ревізією (baseRev) —
//     застарілий ПК не перезаписує новіші дані на сервері
//  3. Черга невідправленого живе в localStorage і повторюється з backoff
//  4. Видалення передаються як tombstones (deleted: true)
//  5. Сторінка перемальовується і під час набору тексту — з відновленням
//     фокуса й позиції каретки
//  6. Опитування раз на 4 с + негайно на focus/visibilitychange/online,
//     інкрементально через ?since=rev
//  7. Закриття вкладки не втрачає зміни (navigator.sendBeacon)
//  8. Маркери версій обладнання (*_data_version) і dev_role_time_stats
//     більше не синхронізуються
//  9. window.syncDebug() показує стан кожного ключа
//
// ВАЖЛИВО: цей файл чіпає localStorage, тому вмикайте його останнім,
// після підтвердження, що застосунок працює як раніше.
// =========================================================================

(function () {
    'use strict';

    /* global currentRole, activeReportPeriod */

    var SERVER_URL = window.APP_SERVER_URL || 'https://pmm-server.onrender.com';
    window.APP_SERVER_URL = SERVER_URL;
    var POLL_MS = 4000;
    var PUSH_DEBOUNCE_MS = 400;
    var BOOT_TIMEOUT_MS = 3000;
    var RETRY_MIN_MS = 1000;
    var RETRY_MAX_MS = 15000;
    var PULL_TIMEOUT_MS = 20000;
    var PUSH_TIMEOUT_MS = 15000;
    var DOCS_TIMEOUT_MS = 60000;
    var DOC_DEBOUNCE_MS = 600;
    var ROLE_REFRESH_MS = 5000;
    var MAX_VALUE_BYTES = 6 * 1024 * 1024;

    var DEVICE_KEY = '__sync_device_id_v1';
    var META_KEY = '__sync_meta_v1';
    var PENDING_KEY = '__sync_pending_v1';
    var IDB_META_KEY = '__sync_idb_meta_v1';

    var LOCAL_ONLY_KEYS = [
        'currentrole', 'app_current_role', 'userrole', 'role', 'isdeveloperloggedin',
        'last_active_car_id', 'last_active_car_period', 'last_active_report_period',
        'dev_role_time_stats', 'aggregates_calc_saved_state'
    ];
    var LOCAL_ONLY_PREFIXES = ['lastreadbroadcastid_', '__sync_'];
    var VERSION_MARKER_SUFFIX = '_data_version';

    function isSyncedKey(key) {
        if (!key || typeof key !== 'string') return false;
        var k = key.toLowerCase();
        if (k.indexOf('__sync_') === 0) return false;
        if (LOCAL_ONLY_KEYS.indexOf(k) !== -1) return false;
        for (var i = 0; i < LOCAL_ONLY_PREFIXES.length; i++) {
            if (k.indexOf(LOCAL_ONLY_PREFIXES[i]) === 0) return false;
        }
        if (k.length >= VERSION_MARKER_SUFFIX.length &&
            k.slice(-VERSION_MARKER_SUFFIX.length) === VERSION_MARKER_SUFFIX) return false;
        return true;
    }

    // --- «сирі» операції зі сховищем (беруться до підміни методів) ----------
    var rawSetItem = Storage.prototype.setItem;
    var rawRemoveItem = Storage.prototype.removeItem;
    var rawGetItem = Storage.prototype.getItem;
    var rawClear = Storage.prototype.clear;

    function localGet(key) {
        try { return rawGetItem.call(window.localStorage, key); } catch (e) { return null; }
    }
    function localSet(key, value) {
        try { rawSetItem.call(window.localStorage, key, value); } catch (e) {}
    }
    function localRemove(key) {
        try { rawRemoveItem.call(window.localStorage, key); } catch (e) {}
    }
    function localKeys() {
        var out = [];
        try {
            for (var i = 0; i < window.localStorage.length; i++) {
                var k = window.localStorage.key(i);
                if (k) out.push(k);
            }
        } catch (e) {}
        return out;
    }
    function readJSON(key, fallback) {
        try {
            var raw = localGet(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) { return fallback; }
    }
    function writeJSON(key, obj) {
        try { localSet(key, JSON.stringify(obj)); } catch (e) {}
    }

    // --- Стан клієнта -------------------------------------------------------
    var deviceId = readJSON(DEVICE_KEY, null);
    if (!deviceId) {
        deviceId = 'dev-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
        writeJSON(DEVICE_KEY, deviceId);
    }

    var meta = readJSON(META_KEY, null) || { lastRev: 0, keys: {} };
    if (!meta.keys) meta.keys = {};
    if (typeof meta.lastRev !== 'number') meta.lastRev = 0;

    var pending = readJSON(PENDING_KEY, null) || {};

    var applyingRemote = false;
    var awaitingFirstPull = true;
    var pushTimer = null;
    var pushInFlight = false;
    var pullInFlight = false;
    var filesInFlight = false;
    var retryDelay = RETRY_MIN_MS;
    var statusText = 'Синхронізація...';
    var statusColor = '#95a5a6';

    function saveMeta() { writeJSON(META_KEY, meta); }
    function savePending() { writeJSON(PENDING_KEY, pending); }

    function getLastRev() { return Number(meta.lastRev) || 0; }
    function setLastRev(rev) { meta.lastRev = Math.max(getLastRev(), Number(rev) || 0); }
    function getKeyRev(key) { return Number(meta.keys[key]) || 0; }
    function setKeyRev(key, rev) {
        var v = Number(rev) || 0;
        if (v > getKeyRev(key)) meta.keys[key] = v;
    }

    function getRole() {
        try {
            if (typeof window.currentRole !== 'undefined' && window.currentRole) {
                return String(window.currentRole).toLowerCase().trim();
            }
        } catch (e) {}
        try {
            if (typeof currentRole !== 'undefined' && currentRole) {
                return String(currentRole).toLowerCase().trim();
            }
        } catch (e) {}
        try {
            if (typeof window.detectActiveUserRole === 'function') {
                return String(window.detectActiveUserRole()).toLowerCase().trim();
            }
        } catch (e) {}
        return 'user';
    }

    function isAdminRole() {
        var r = getRole();
        return r === 'admin' || r === 'developer' || r === 'dev';
    }

    function readActiveReportPeriod() {
        try {
            if (typeof window.activeReportPeriod !== 'undefined') return window.activeReportPeriod;
        } catch (e) {}
        try {
            if (typeof activeReportPeriod !== 'undefined') return activeReportPeriod;
        } catch (e) {}
        return undefined;
    }

    // --- Віджет статусу в шапці --------------------------------------------
    function ensureHeaderWidget() {
        var holder = document.getElementById('top-search-box') ||
            document.querySelector('.nav-right') ||
            document.querySelector('.top-nav');
        if (!holder) return;

        var widget = document.getElementById('cloud-sync-header-widget');
        if (!widget) {
            widget = document.createElement('div');
            widget.id = 'cloud-sync-header-widget';
            widget.style.cssText = 'display:inline-flex;align-items:center;gap:8px;background:rgba(0,0,0,0.32);padding:4px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);font-size:11px;color:#ecf0f1;margin-right:6px;';
            widget.innerHTML =
                '<span id="cloud-sync-status-dot" style="width:8px;height:8px;border-radius:50%;background:#95a5a6;display:inline-block;"></span>' +
                '<span id="cloud-sync-status-text" style="font-weight:600;white-space:nowrap;">Синхронізація...</span>' +
                '<button type="button" id="cloud-sync-push-btn" title="Надіслати всі локальні дані на сервер" style="background:#27ae60;color:#fff;border:none;border-radius:4px;padding:4px 10px;font-size:11px;font-weight:bold;cursor:pointer;white-space:nowrap;display:none;">☁️ Зберегти на сайт</button>';
            var searchInput = document.getElementById('base-search-input');
            if (searchInput && searchInput.parentElement === holder) {
                holder.insertBefore(widget, searchInput);
            } else {
                holder.appendChild(widget);
            }
            var btn = document.getElementById('cloud-sync-push-btn');
            if (btn) {
                btn.onclick = function () { window.forcePushAllDataToServer(true); };
            }
        }

        var dot = document.getElementById('cloud-sync-status-dot');
        var label = document.getElementById('cloud-sync-status-text');
        if (dot) {
            dot.style.backgroundColor = statusColor;
            dot.style.boxShadow = '0 0 6px ' + statusColor;
        }
        if (label) label.textContent = statusText;

        var pushBtn = document.getElementById('cloud-sync-push-btn');
        if (pushBtn) pushBtn.style.display = isAdminRole() ? 'inline-block' : 'none';
    }

    function setStatus(state) {
        if (state === 'ok') { statusText = 'Синхронізовано'; statusColor = '#2ecc71'; }
        else if (state === 'saving') { statusText = 'Збереження...'; statusColor = '#f39c12'; }
        else if (state === 'conflict') { statusText = 'Конфлікт — застосовано з сервера'; statusColor = '#3498db'; }
        else if (state === 'offline') {
            var n = Object.keys(pending).length;
            statusText = n > 0 ? ('Офлайн (' + n + ' у черзі)') : 'Офлайн';
            statusColor = '#e67e22';
        } else {
            statusText = String(state);
            statusColor = '#e74c3c';
        }
        ensureHeaderWidget();
    }

    // --- Перехоплення записів у localStorage -------------------------------
    function queueLocalChange(key, value, deleted) {
        if (deleted) {
            pending[key] = { deleted: true, preBoot: awaitingFirstPull };
        } else {
            var str = String(value);
            if (str.length > MAX_VALUE_BYTES) {
                console.warn('Ключ ' + key + ' завеликий для синхронізації (' + str.length + ' символів) — пропущено');
                return;
            }
            pending[key] = { value: str, deleted: false, preBoot: awaitingFirstPull };
        }
        savePending();
        schedulePush(PUSH_DEBOUNCE_MS);
    }

    var patched = false;
    function patchStorage() {
        if (patched) return;
        patched = true;

        Storage.prototype.setItem = function (key, value) {
            var isLocal = this === window.localStorage;
            var prev = isLocal ? rawGetItem.call(this, key) : null;
            rawSetItem.call(this, key, value);

            if (!isLocal || applyingRemote || !isSyncedKey(key)) return;
            var str = String(value);
            if (prev === str) return;
            queueLocalChange(key, str, false);

            if (key === 'saved_documents_v2') scheduleDocPush();
        };

        Storage.prototype.removeItem = function (key) {
            var isLocal = this === window.localStorage;
            var prev = isLocal ? rawGetItem.call(this, key) : null;
            rawRemoveItem.call(this, key);

            if (!isLocal || applyingRemote || !isSyncedKey(key) || prev === null) return;
            queueLocalChange(key, undefined, true);
        };

        // clear() на одному ПК не має стирати спільні дані в усіх.
        Storage.prototype.clear = function () {
            var isLocal = this === window.localStorage;
            rawClear.call(this);
            if (!isLocal || applyingRemote) return;

            Object.keys(pending).forEach(function (k) { delete pending[k]; });
            meta.keys = {};
            meta.lastRev = 0;
            saveMeta();
            savePending();
            setStatus('offline');
        };
    }

    // --- Відправка змін на сервер ------------------------------------------
    function buildPayload() {
        var changes = {};
        var deletedKeys = [];
        Object.keys(pending).forEach(function (key) {
            var p = pending[key];
            if (!p) return;
            if (p.deleted) deletedKeys.push(key);
            else changes[key] = { value: p.value, baseRev: getKeyRev(key) };
        });
        return { changes: changes, deletedKeys: deletedKeys };
    }

    function schedulePush(delay) {
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(function () { flushPending(); }, typeof delay === 'number' ? delay : PUSH_DEBOUNCE_MS);
    }

    function fetchWithTimeout(url, options, timeoutMs) {
        var opts = {};
        var src = options || {};
        Object.keys(src).forEach(function (k) { opts[k] = src[k]; });

        var timer = null;
        if (typeof AbortController === 'function') {
            var controller = new AbortController();
            opts.signal = controller.signal;
            timer = setTimeout(function () { controller.abort(); }, timeoutMs);
        }
        return fetch(url, opts).then(function (res) {
            if (timer) clearTimeout(timer);
            return res;
        }, function (err) {
            if (timer) clearTimeout(timer);
            throw err;
        });
    }

    function flushPending() {
        if (pushInFlight) { schedulePush(300); return Promise.resolve(); }

        var payload = buildPayload();
        var changeKeys = Object.keys(payload.changes);
        if (changeKeys.length === 0 && payload.deletedKeys.length === 0) {
            setStatus('ok');
            return Promise.resolve();
        }

        pushInFlight = true;
        setStatus('saving');

        return fetchWithTimeout(SERVER_URL + '/api/shared-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId: deviceId,
                role: getRole(),
                changes: payload.changes,
                deletedKeys: payload.deletedKeys
            })
        }, PUSH_TIMEOUT_MS).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        }).then(function (data) {
            // прибираємо з черги лише те, що не змінилося під час запиту
            changeKeys.forEach(function (key) {
                var p = pending[key];
                if (p && !p.deleted && payload.changes[key] && p.value === payload.changes[key].value) {
                    delete pending[key];
                }
            });
            payload.deletedKeys.forEach(function (key) {
                var p = pending[key];
                if (p && p.deleted) delete pending[key];
            });

            var needRefresh = false;

            if (data && data.applied) {
                Object.keys(data.applied).forEach(function (key) {
                    setKeyRev(key, data.applied[key]);
                });
            }

            if (data && data.rejected) {
                Object.keys(data.rejected).forEach(function (key) {
                    var rec = data.rejected[key];
                    if (!rec) return;

                    if (rec.deleted) {
                        if (localGet(key) !== null) {
                            applyingRemote = true;
                            localRemove(key);
                            applyingRemote = false;
                            needRefresh = true;
                        }
                    } else if (typeof rec.value === 'string' && localGet(key) !== rec.value) {
                        applyingRemote = true;
                        localSet(key, rec.value);
                        applyingRemote = false;
                        needRefresh = true;
                    }
                    setKeyRev(key, rec.rev);
                });
                if (Object.keys(data.rejected).length > 0) setStatus('conflict');
            }

            if (data && typeof data.revision === 'number') setLastRev(data.revision);

            retryDelay = RETRY_MIN_MS;
            saveMeta();
            savePending();

            if (needRefresh) refreshAllViewsSafely();

            if (Object.keys(pending).length > 0) schedulePush(300);
            else if (statusText.indexOf('Конфлікт') === -1) setStatus('ok');
        }).catch(function (err) {
            setStatus('offline');
            schedulePush(retryDelay);
            retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
            console.warn('Синхронізація недоступна, повтор через ' + Math.round(retryDelay / 1000) + ' с', err && err.message);
        }).then(function () {
            pushInFlight = false;
        });
    }

    // --- Отримання змін із сервера -----------------------------------------
    function applyRemoteKeys(keys, isFirstPull) {
        applyingRemote = true;
        var changedCount = 0;
        try {
            Object.keys(keys || {}).forEach(function (key) {
                var rec = keys[key];
                if (!rec || !isSyncedKey(key)) return;
                var incoming = Number(rec.rev) || 0;

                if (isFirstPull && pending[key]) {
                    // Перший pull: якщо сервер знає цей ключ — перемагає сервер,
                    // якщо не знає — локальне значення залишається в черзі й піде на сервер.
                    delete pending[key];
                } else if (!isFirstPull && incoming <= getKeyRev(key)) {
                    return;
                }

                if (rec.deleted) {
                    if (localGet(key) !== null) {
                        localRemove(key);
                        changedCount += 1;
                    }
                } else if (typeof rec.value === 'string') {
                    if (localGet(key) !== rec.value) {
                        localSet(key, rec.value);
                        changedCount += 1;
                    }
                }
                setKeyRev(key, incoming);
            });
        } finally {
            applyingRemote = false;
        }
        return changedCount;
    }

    function pullServer(isInitial) {
        if (pullInFlight) return Promise.resolve();
        pullInFlight = true;

        var since = getLastRev();
        var url = SERVER_URL + '/api/shared-state' + (since > 0 ? '?since=' + since : '');

        return fetchWithTimeout(url, { cache: 'no-store' }, isInitial ? PULL_TIMEOUT_MS : PUSH_TIMEOUT_MS)
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                // Сумісність зі старим сервером: він повертає { version, storage },
                // новий — { revision, keys }.
                var incomingKeys = data.keys || data.storage || {};
                var changed = applyRemoteKeys(incomingKeys, awaitingFirstPull);
                if (typeof data.revision === 'number') setLastRev(data.revision);
                else if (typeof data.version === 'number') { /* старий сервер: ревізій немає */ }

                // Якщо на клієнті є локальні спільні дані (реєстр авто, звіти, модифікації),
                // яких ще немає на сервері — ставимо їх у чергу відправки, щоб вони завантажились на сервер
                if (awaitingFirstPull) {
                    var localAll = localKeys();
                    localAll.forEach(function (k) {
                        if (!isSyncedKey(k)) return;
                        if (!incomingKeys[k] && !pending[k]) {
                            var val = localGet(k);
                            if (val !== null && val !== undefined) {
                                pending[k] = { value: String(val), deleted: false, preBoot: false };
                            }
                        }
                    });
                }

                var shouldRefresh = (changed > 0) || isInitial;
                awaitingFirstPull = false;
                saveMeta();
                savePending();

                if (shouldRefresh) refreshAllViewsSafely();
                setStatus(Object.keys(pending).length > 0 ? 'saving' : 'ok');
                if (Object.keys(pending).length > 0) schedulePush(200);
                if (typeof data.filesVersion === 'number') pullDocsIfNewer(data.filesVersion);
            })
            .catch(function () {
                setStatus('offline');
            })
            .then(function () {
                pullInFlight = false;
            });
    }

    // --- Документи (IndexedDB) ---------------------------------------------
    function fingerprintFile(f) {
        var url = String(f && f.fileDataUrl ? f.fileDataUrl : '');
        return String(f && f.id ? f.id : '') + '|' +
            String(f && f.fileName ? f.fileName : '') + '|' +
            url.length + '|' + url.slice(-48);
    }

    var docPushTimer = null;
    function scheduleDocPush() {
        if (docPushTimer) clearTimeout(docPushTimer);
        docPushTimer = setTimeout(function () { pushChangedDocs(false); }, DOC_DEBOUNCE_MS);
    }

    function pushChangedDocs(isFullPush) {
        if (typeof window.exportAllDocsFromIndexedDB !== 'function') return Promise.resolve();
        if (!isFullPush && !isAdminRole()) return Promise.resolve();

        return Promise.resolve(window.exportAllDocsFromIndexedDB()).then(function (files) {
            if (!Array.isArray(files) || files.length === 0) return;

            var idbMeta = readJSON(IDB_META_KEY, null) || { version: 0, fingerprints: {} };
            if (!idbMeta.fingerprints) idbMeta.fingerprints = {};

            var changed = files.filter(function (f) {
                return isFullPush || idbMeta.fingerprints[f.id] !== fingerprintFile(f);
            });
            if (changed.length === 0) return;

            return fetchWithTimeout(SERVER_URL + '/api/shared-idb', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: getRole(),
                    files: changed,
                    deletedFileIds: [],
                    isInitialSeed: false
                })
            }, DOCS_TIMEOUT_MS).then(function (res) {
                if (!res.ok) return null;
                return res.json();
            }).then(function (data) {
                changed.forEach(function (f) { idbMeta.fingerprints[f.id] = fingerprintFile(f); });
                if (data && typeof data.version === 'number') idbMeta.version = data.version;
                writeJSON(IDB_META_KEY, idbMeta);
            });
        }).catch(function () {});
    }

    function pullDocsIfNewer(serverFilesVersion) {
        if (typeof window.restoreAllDocsToIndexedDB !== 'function') return Promise.resolve();
        if (filesInFlight) return Promise.resolve();

        var idbMeta = readJSON(IDB_META_KEY, null) || { version: 0, fingerprints: {} };
        if (!idbMeta.fingerprints) idbMeta.fingerprints = {};

        var serverVersion = Number(serverFilesVersion) || 0;
        if (serverVersion <= (Number(idbMeta.version) || 0)) return Promise.resolve();

        filesInFlight = true;
        return fetchWithTimeout(SERVER_URL + '/api/shared-idb', { cache: 'no-store' }, DOCS_TIMEOUT_MS)
            .then(function (res) {
                if (!res.ok) return null;
                return res.json();
            })
            .then(function (data) {
                if (!data) return;
                var files = Array.isArray(data.files) ? data.files : [];
                if (files.length > 0) {
                    return Promise.resolve(window.restoreAllDocsToIndexedDB(files)).then(function () {
                        files.forEach(function (f) { idbMeta.fingerprints[f.id] = fingerprintFile(f); });
                    });
                }
            })
            .then(function () {
                idbMeta.version = serverVersion;
                writeJSON(IDB_META_KEY, idbMeta);
                callIfExists('renderDocumentsMainView');
            })
            .catch(function () {})
            .then(function () { filesInFlight = false; });
    }

    // --- Перемалювання інтерфейсу ------------------------------------------
    function callIfExists(name, args) {
        try {
            var fn = window[name];
            if (typeof fn === 'function') {
                fn.apply(window, args || []);
                return true;
            }
        } catch (err) {
            console.warn('Помилка оновлення "' + name + '":', err);
        }
        return false;
    }

    function captureFocus() {
        var el = document.activeElement;
        if (!el) return null;
        var tag = (el.tagName || '').toUpperCase();
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') return null;
        if (!el.id) return null;

        var start = null;
        var end = null;
        try { start = el.selectionStart; end = el.selectionEnd; } catch (e) {}
        return { id: el.id, start: start, end: end };
    }

    function restoreFocus(info) {
        if (!info) return;
        var el = document.getElementById(info.id);
        if (!el || el.disabled) return;
        try {
            el.focus({ preventScroll: true });
            if (info.start !== null && typeof el.setSelectionRange === 'function') {
                el.setSelectionRange(info.start, info.end);
            }
        } catch (e) {}
    }

    function refreshAllViewsSafely() {
        if (typeof document === 'undefined' || !document.body) return;
        var focusInfo = captureFocus();

        callIfExists('reloadCarsFromStorage');
        callIfExists('loadCarsModifications');
        callIfExists('initCardPeriodsSelect');
        callIfExists('initPeriodDropdown');
        callIfExists('initEqReportPeriodDropdown');

        var period = readActiveReportPeriod();
        if (period !== undefined) callIfExists('populatePeriodDropdown', [period]);
        else callIfExists('populatePeriodDropdown');

        callIfExists('populateCarSelector');
        callIfExists('renderCarsTable');
        callIfExists('loadCarDataForActivePeriod');
        callIfExists('renderReportTable');
        callIfExists('updateReportTotals');
        callIfExists('renderEquipmentReportView');
        callIfExists('updateEquipmentReportTotals');
        callIfExists('renderSubdivisionsView');
        callIfExists('renderGeneratorsView');
        callIfExists('renderWebastoView');
        callIfExists('renderHeatersView');
        callIfExists('renderChainsawsView');
        callIfExists('refreshAggregatesEquipmentList');
        callIfExists('renderDestroyedEquipmentView');
        if (window.activeReportCarId) callIfExists('renderCarDetailsData');
        callIfExists('renderDocumentsMainView');
        if (getRole() === 'developer') callIfExists('renderDeveloperPanel');
        callIfExists('updateEnvelopeBlinkState');
        callIfExists('applyReportRolePermissions');
        callIfExists('updateRoleUI');

        restoreFocus(focusInfo);
    }

    // --- Публічний API ------------------------------------------------------
    window.forcePushAllDataToServer = function (showNotification) {
        setStatus('saving');

        var period = null;
        try {
            if (typeof window.getStrictActivePeriod === 'function') period = window.getStrictActivePeriod();
        } catch (e) {}
        callIfExists('saveCarRoutesForPeriod', period ? [period] : []);
        callIfExists('saveCarsModificationsToStorage');
        callIfExists('saveCarsToStorage');

        localKeys().forEach(function (key) {
            if (!isSyncedKey(key)) return;
            var value = localGet(key);
            if (value === null) return;
            pending[key] = { value: value, deleted: false, preBoot: false };
        });
        savePending();

        return flushPending()
            .then(function () { return pushChangedDocs(true); })
            .then(function () {
                var left = Object.keys(pending).length;
                setStatus(left > 0 ? 'offline' : 'ok');
                if (!showNotification) return;

                var msg = '☁️ Усі зміни надіслано на сервер. Вони доступні на інших комп\'ютерах.';
                if (left > 0) {
                    msg = '⚠️ Частину змін сервер не прийняв (є новіші дані з іншого ПК). Екран оновлено.';
                }
                if (!callIfExists('showDevNotification', [msg, '#27ae60'])) alert(msg);
            });
    };

    window.syncDebug = function () {
        var rows = [];
        var names = {};

        Object.keys(meta.keys).forEach(function (k) { names[k] = true; });
        Object.keys(pending).forEach(function (k) { names[k] = true; });
        localKeys().forEach(function (k) { if (isSyncedKey(k)) names[k] = true; });

        Object.keys(names).sort().forEach(function (key) {
            var local = localGet(key);
            var p = pending[key];
            rows.push({
                key: key,
                local_chars: local === null ? '(немає)' : local.length,
                server_rev: getKeyRev(key),
                черга: p ? (p.deleted ? 'ВИДАЛИТИ' : 'надіслати') : '—'
            });
        });

        if (console.table) console.table(rows);

        var info = {
            deviceId: deviceId,
            role: getRole(),
            lastRev: getLastRev(),
            статус: statusText,
            у_черзі: Object.keys(pending).length,
            сервер: SERVER_URL
        };
        console.log('Стан синхронізації:', info);
        return info;
    };

    // --- Старт: спершу дані з сервера, потім ініціалізація застосунку -------
    var origDocAdd = document.addEventListener.bind(document);
    var origWinAdd = window.addEventListener.bind(window);
    var deferredHandlers = [];
    var bootFinished = false;

    function releaseAppHandlers() {
        if (bootFinished) return;
        bootFinished = true;

        document.addEventListener = origDocAdd;
        window.addEventListener = origWinAdd;

        var list = deferredHandlers.slice();
        deferredHandlers = [];
        list.forEach(function (fn) {
            try {
                fn.call(document, new Event('DOMContentLoaded'));
            } catch (err) {
                console.warn('Помилка ініціалізації застосунку:', err);
            }
        });

        refreshAllViewsSafely();
    }

    function deferDomContentLoadedHandlers() {
        if (document.readyState !== 'loading') return;

        document.addEventListener = function (type, listener, options) {
            if (type === 'DOMContentLoaded' && !bootFinished && typeof listener === 'function') {
                deferredHandlers.push(listener);
                return;
            }
            return origDocAdd(type, listener, options);
        };

        // window.addEventListener('DOMContentLoaded') у браузері не спрацьовує взагалі —
        // такі обробники теж приймаємо й виконуємо один раз.
        window.addEventListener = function (type, listener, options) {
            if (type === 'DOMContentLoaded' && !bootFinished && typeof listener === 'function') {
                deferredHandlers.push(listener);
                return;
            }
            return origWinAdd(type, listener, options);
        };

        origDocAdd('DOMContentLoaded', function () {
            setTimeout(function () {
                if (!bootFinished) releaseAppHandlers();
            }, 0);
        }, { once: true });
    }

    function beaconFlush() {
        var payload = buildPayload();
        if (Object.keys(payload.changes).length === 0 && payload.deletedKeys.length === 0) return;
        try {
            var body = JSON.stringify({
                deviceId: deviceId,
                role: getRole(),
                changes: payload.changes,
                deletedKeys: payload.deletedKeys
            });
            if (navigator.sendBeacon) {
                navigator.sendBeacon(SERVER_URL + '/api/shared-state', new Blob([body], { type: 'application/json' }));
            } else {
                fetch(SERVER_URL + '/api/shared-state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: body,
                    keepalive: true
                });
            }
        } catch (e) {}
    }

    // --- Запуск -------------------------------------------------------------
    patchStorage();
    deferDomContentLoadedHandlers();
    ensureHeaderWidget();
    setStatus('saving');

    var bootTimer = setTimeout(function () { releaseAppHandlers(); }, BOOT_TIMEOUT_MS);

    pullServer(true).then(function () {
        clearTimeout(bootTimer);
        releaseAppHandlers();
        ensureHeaderWidget();
    });

    setInterval(function () { pullServer(false); }, POLL_MS);
    setInterval(function () { ensureHeaderWidget(); }, ROLE_REFRESH_MS);

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            flushPending();
        } else {
            pullServer(false);
            refreshAllViewsSafely();
        }
    });

    origWinAdd('focus', function () { pullServer(false); });
    origWinAdd('pageshow', function () { pullServer(false); });
    origWinAdd('online', function () { schedulePush(0); pullServer(false); });
    origWinAdd('pagehide', beaconFlush);
    origWinAdd('beforeunload', beaconFlush);
})();
