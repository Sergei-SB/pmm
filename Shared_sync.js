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
        'dev_role_time_stats'
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
    if (!meta.carBases) meta.carBases = {};

    function isCarKey(key) {
        return key === 'user_cars_database_v2' || key === 'cars_modifications_data' || key === 'saved_documents_v2' ||
            /^(car_folder_|report_data_|equipment_report_data_|isolated_car_routes_)/.test(key);
    }

    // Three-way merge: retain offline additions and independent field edits;
    // never restore a vehicle deleted remotely from an unchanged local snapshot.
    function mergeCarValue(key, localValue, remoteValue, baseValue) {
        try {
            var local = JSON.parse(localValue);
            var remote = JSON.parse(remoteValue);
            var base = baseValue ? JSON.parse(baseValue) : null;
            var folder = key.indexOf('car_folder_') === 0;
            var envelope = folder ? Object.assign({}, remote) : null;
            if (folder) { local = local.files || []; remote = remote.files || []; base = base && base.files || []; }
            var array = key === 'user_cars_database_v2' || key === 'saved_documents_v2' || folder;
            if (array && (!Array.isArray(local) || !Array.isArray(remote))) return null;
            if (!array && (!local || !remote || Array.isArray(local) || Array.isArray(remote))) return null;
            function map(value) {
                var result = Object.create(null);
                if (array) (value || []).forEach(function (car) { if (car && car.id != null) result[String(car.id)] = car; });
                else Object.keys(value || {}).forEach(function (id) { result[id] = value[id]; });
                return result;
            }
            var l = map(local), r = map(remote), b = map(base);
            var result = map(remote);
            Object.keys(b).forEach(function (id) {
                if (!l[id] && JSON.stringify(r[id]) === JSON.stringify(b[id])) delete result[id];
                else if (!l[id] && r[id]) throw new Error('Local deletion conflicts with remote edits');
            });
            Object.keys(l).forEach(function (id) {
                if (!b[id]) {
                    if (!r[id]) result[id] = l[id];
                    else if (JSON.stringify(l[id]) !== JSON.stringify(r[id])) {
                        throw new Error('Conflicting additions with the same ID');
                    }
                    return;
                }
                if (!r[id]) {
                    if (JSON.stringify(l[id]) !== JSON.stringify(b[id])) throw new Error('Remote deletion conflicts with local edits');
                    return;
                }
                if (Array.isArray(l[id]) || Array.isArray(r[id])) {
                    if (JSON.stringify(l[id]) === JSON.stringify(b[id])) return;
                    if (JSON.stringify(r[id]) !== JSON.stringify(b[id]) && JSON.stringify(l[id]) !== JSON.stringify(r[id])) throw new Error('Conflicting row changes');
                    result[id] = l[id];
                    return;
                }
                var row = Object.assign({}, r[id]);
                Object.keys(l[id]).forEach(function (field) {
                    var changed = JSON.stringify(l[id][field]) !== JSON.stringify(b[id][field]);
                    var remoteUnchanged = JSON.stringify(r[id][field]) === JSON.stringify(b[id][field]);
                    if (changed && !remoteUnchanged && JSON.stringify(l[id][field]) !== JSON.stringify(r[id][field])) throw new Error('Conflicting edits');
                    if (changed && (remoteUnchanged || JSON.stringify(l[id][field]) === JSON.stringify(r[id][field]))) row[field] = l[id][field];
                });
                result[id] = row;
            });
            if (!array) return JSON.stringify(result);
            var order = remote.map(function (car) { return String(car.id); });
            local.forEach(function (car) { if (order.indexOf(String(car.id)) === -1) order.push(String(car.id)); });
            var merged = order.filter(function (id) { return result[id]; }).map(function (id) { return result[id]; });
            if (folder) { envelope.files = merged; return JSON.stringify(envelope); }
            return JSON.stringify(merged);
        } catch (e) { return null; }
    }

    var applyingRemote = false;
    var awaitingFirstPull = true;
    var pushTimer = null;
    var pushInFlight = false;
    var pullInFlight = false;
    var sharedEventPending = false;

    function pullSharedEvent() {
        if (!sharedEventPending || manualBackupInProgress || pullInFlight || pushInFlight) return;
        sharedEventPending = false;
        pullServer(false);
    }
    var filesInFlight = false;
    var manualBackupInProgress = false;
    var manualSavePromise = null;
    var lastSafetyWarning = '';
    var storageErrors = {};
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
                '<button type="button" id="cloud-sync-status-text" style="font:inherit;color:inherit;background:none;border:0;padding:0;font-weight:600;white-space:nowrap;">Синхронізація...</button>' +
                '<button type="button" id="cloud-sync-push-btn" title="Зберегти спільні дані на сайті в GitHub" style="background:#27ae60;color:#fff;border:none;border-radius:4px;padding:4px 10px;font-size:11px;font-weight:bold;cursor:pointer;white-space:nowrap;display:none;">☁️ Зберегти на сайт</button>';
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
        if (label) {
            label.textContent = statusText;
            label.style.cursor = 'pointer';
            label.title = 'Переглянути незбережені зміни та конфлікти';
            label.onclick = function () {
                if (typeof window.showPmmSyncConflicts === 'function') window.showPmmSyncConflicts();
                else alert('Оновіть сторінку Ctrl+F5 для перегляду конфліктів. Локальні дані не очищайте.');
            };
        }

        var pushBtn = document.getElementById('cloud-sync-push-btn');
        if (pushBtn) pushBtn.style.display = isAdminRole() ? 'inline-block' : 'none';
    }

    function setStatus(state) {
        if (state === 'ok' && Object.keys(storageErrors).length) state = 'Браузер не зберіг частину змін';
        if (state === 'ok') {
            var docIds = Object.keys(documentPending || {});
            var blocked = docIds.some(function (id) { return documentPending[id].blocked; }) || Object.keys(pending).some(function (key) { return pending[key].blocked; });
            if (blocked) state = 'conflict';
            else if (docIds.length || Object.keys(pending).length) state = 'saving';
        }
        if (state === 'ok') { statusText = 'Синхронізовано'; statusColor = '#2ecc71'; }
        else if (state === 'saving') { statusText = 'Збереження...'; statusColor = '#f39c12'; }
        else if (state === 'conflict') { statusText = 'Конфлікт — натисніть для перегляду'; statusColor = '#d97706'; }
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
    function queueLocalChange(key, value, deleted, previousValue) {
        var prior = pending[key];
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
        if (isCarKey(key) && !deleted) {
            pending[key].baseValue = prior && prior.baseValue !== undefined ? prior.baseValue
                : (meta.carBases[key] !== undefined ? meta.carBases[key] : previousValue);
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
            if (isLocal && prev !== String(value) && typeof window.archiveLocalSiteChange === 'function') {
                window.archiveLocalSiteChange('localStorage', String(key), prev, String(value)).catch(function () {});
            }
            try {
                rawSetItem.call(this, key, value);
                if (isLocal) delete storageErrors[key];
            } catch (error) {
                if (isLocal) {
                    storageErrors[key] = true;
                    setStatus('Браузер не зберіг частину змін');
                    callIfExists('showDevNotification', ['Не вистачає місця у браузері. Частину змін не збережено. Завантажте резервний JSON перед закриттям сторінки.', '#e74c3c']);
                }
                throw error;
            }

            if (!isLocal || applyingRemote || !isSyncedKey(key)) return;
            var str = String(value);
            if (prev === str) return;
            queueLocalChange(key, str, false, prev);

            if (key === 'saved_documents_v2') scheduleDocPush();
        };

        Storage.prototype.removeItem = function (key) {
            var isLocal = this === window.localStorage;
            var prev = isLocal ? rawGetItem.call(this, key) : null;
            rawRemoveItem.call(this, key);

            if (isLocal && prev !== null && typeof window.archiveLocalSiteChange === 'function') {
                window.archiveLocalSiteChange('localStorage', String(key), prev, null).catch(function () {});
            }

            if (!isLocal || applyingRemote || !isSyncedKey(key) || prev === null) return;
            queueLocalChange(key, undefined, true);
        };

        // clear() на одному ПК не має стирати спільні дані в усіх.
        Storage.prototype.clear = function () {
            var isLocal = this === window.localStorage;
            if (isLocal && typeof window.archiveLocalSiteChange === 'function') {
                localKeys().forEach(function (key) {
                    window.archiveLocalSiteChange('localStorage', key, localGet(key), null).catch(function () {});
                });
            }
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
            if (!p || p.blocked) return;
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
        if (manualBackupInProgress || pushInFlight || pullInFlight || awaitingFirstPull) { schedulePush(300); return Promise.resolve(); }

        var payload = buildPayload();
        var changeKeys = Object.keys(payload.changes);
        if (changeKeys.length === 0 && payload.deletedKeys.length === 0) {
            setStatus(Object.keys(pending).some(function (key) { return pending[key].blocked; }) ? 'conflict' : 'ok');
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
                if (data.applied && Object.prototype.hasOwnProperty.call(data.applied, key) && p && !p.deleted && payload.changes[key] && p.value === payload.changes[key].value) {
                    delete pending[key];
                }
            });
            payload.deletedKeys.forEach(function (key) {
                var p = pending[key];
                if (data.applied && Object.prototype.hasOwnProperty.call(data.applied, key) && p && p.deleted) delete pending[key];
            });

            var needRefresh = false;

            if (data && data.applied) {
                Object.keys(data.applied).forEach(function (key) {
                    setKeyRev(key, data.applied[key]);
                    if (isCarKey(key) && payload.changes[key]) {
                        meta.carBases[key] = payload.changes[key].value;
                        if (pending[key] && !pending[key].deleted) pending[key].baseValue = payload.changes[key].value;
                    }
                });
            }

            if (data && data.rejected) {
                Object.keys(data.rejected).forEach(function (key) {
                    var rec = data.rejected[key];
                    if (!rec) return;

                    if (rec.safetyBlocked) {
                        var candidate = pending[key];
                        if (candidate && candidate.value) localSet('__sync_car_conflict_' + key, candidate.value);
                        delete pending[key];
                        if (typeof rec.value === 'string') {
                            localSet(key, rec.value);
                            if (isCarKey(key)) meta.carBases[key] = rec.value;
                        }
                        setKeyRev(key, rec.rev);
                        lastSafetyWarning = 'Сервер заблокував зменшення реєстру. Попередній список авто збережено; оновіть сторінку для перевірки.';
                        needRefresh = true;
                        setStatus('conflict');
                        return;
                    }

                    var oneKey = {};
                    oneKey[key] = rec;
                    if (isCarKey(key)) {
                        if (applyRemoteKeys(oneKey, false) > 0) needRefresh = true;
                    } else {
                        var latest = pending[key];
                        var sent = payload.changes[key];
                        var hasNewerEdit = latest && !latest.deleted && sent && latest.value !== sent.value;
                        if (latest && !latest.deleted && latest.value !== rec.value) {
                            localSet('__sync_value_conflict_' + key, latest.value);
                            latest.blocked = true;
                            lastSafetyWarning = 'Є конфлікт змін. Ваш варіант збережений у браузері та резервній копії; серверний варіант не перезаписано.';
                            setStatus('conflict');
                            return;
                        }
                        if (!hasNewerEdit) {
                            delete pending[key];
                            if (applyRemoteKeys(oneKey, false) > 0) needRefresh = true;
                        }
                    }
                    setKeyRev(key, rec.rev);
                });
                if (Object.keys(data.rejected).length > 0) setStatus('conflict');
            }

            // Only a completed GET advances the pull cursor. POST acknowledgements
            // do not include other devices' changes and must never skip them.

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
            pullSharedEvent();
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
                if (pending[key] && pending[key].blocked) {
                    var blocked = pending[key];
                    if (((blocked.deleted && rec.deleted) || (!blocked.deleted && !rec.deleted && blocked.value === rec.value))
                        && localGet(key) === (blocked.deleted ? null : blocked.value)) {
                        delete pending[key];
                        setKeyRev(key, incoming);
                        if (isCarKey(key)) meta.carBases[key] = rec.deleted ? null : rec.value;
                    } else setStatus('conflict');
                    return;
                }
                if (pending[key] && !pending[key].deleted && !isCarKey(key) && incoming > getKeyRev(key) && pending[key].value !== rec.value) {
                    localSet('__sync_value_conflict_' + key, pending[key].value);
                    pending[key].blocked = true;
                    setStatus('conflict');
                    return;
                }

                // A smaller server snapshot must not silently erase a previously
                // saved local fleet on startup. Keep server edits and add the
                // missing local vehicles, preserving their original IDs.
                if (key === 'user_cars_database_v2' && !rec.deleted && window.__pmmHadSavedCars) {
                    try {
                        var localCars = JSON.parse(localGet(key) || '[]');
                        var remoteCars = JSON.parse(rec.value);
                        var remoteIds = new Set(remoteCars.map(function (car) { return String(car.id); }));
                        var missingCars = localCars.filter(function (car) { return !remoteIds.has(String(car.id)); });
                        if (localCars.length > remoteCars.length && missingCars.length > 1) {
                            var kept = JSON.stringify(remoteCars.concat(missingCars));
                            localSet(key, kept);
                            pending[key] = { value: kept, deleted: false, preBoot: false, baseValue: rec.value };
                            meta.carBases[key] = rec.value;
                            setKeyRev(key, incoming);
                            changedCount += 1;
                            return;
                        }
                    } catch (e) { /* Normal validation / conflict handling below. */ }
                }

                if (pending[key] && !pending[key].deleted && isCarKey(key) && !rec.deleted && typeof rec.value === 'string') {
                    var p = pending[key];
                    var merged = mergeCarValue(key, p.value, rec.value, p.baseValue);
                    if (merged === null) {
                        localSet('__sync_car_conflict_' + key, p.value);
                        p.blocked = true;
                        setStatus('conflict');
                        return;
                    }
                    if (localGet(key) !== merged) { localSet(key, merged); changedCount += 1; }
                    meta.carBases[key] = rec.value;
                    setKeyRev(key, incoming);
                    if (merged === rec.value) delete pending[key];
                    else pending[key] = {value: merged, deleted: false, preBoot: false, baseValue: rec.value};
                    return;
                }

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
                if (isCarKey(key)) meta.carBases[key] = rec.deleted ? null : rec.value;
            });
        } finally {
            applyingRemote = false;
        }
        return changedCount;
    }

    function pullServer(isInitial) {
        if (manualBackupInProgress || pullInFlight || pushInFlight) return Promise.resolve();
        pullInFlight = true;

        var since = isInitial || awaitingFirstPull ? 0 : getLastRev();
        var url = SERVER_URL + '/api/shared-state' + (since > 0 ? '?since=' + since : '');

        return fetchWithTimeout(url, { cache: 'no-store' }, isInitial ? PULL_TIMEOUT_MS : PUSH_TIMEOUT_MS)
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                if (typeof data.revision === 'number' && data.revision < getLastRev()) {
                    meta.lastRev = 0;
                    meta.keys = {};
                    awaitingFirstPull = true;
                    if (since > 0) return fetchWithTimeout(SERVER_URL + '/api/shared-state', {cache: 'no-store'}, PULL_TIMEOUT_MS)
                        .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); });
                }
                return data;
            })
            .then(function (data) {
                // Сумісність зі старим сервером: він повертає { version, storage },
                // новий — { revision, keys }.
                var wasFirstPull = awaitingFirstPull;
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
                if (typeof data.filesVersion === 'number') return pullDocsIfNewer(data.filesVersion, wasFirstPull);
            })
            .catch(function () {
                setStatus('offline');
            })
            .then(function () {
                pullInFlight = false;
                pullSharedEvent();
            });
    }

    // --- Документи (IndexedDB) ---------------------------------------------
    var documentPending = readJSON('__sync_doc_pending_v1', {}) || {};
    var docPushTimer = null;
    var docPushPromise = null;
    var docRetryDelay = RETRY_MIN_MS;
    function saveDocumentPending() { writeJSON('__sync_doc_pending_v1', documentPending); }
    function fingerprintFile(file) {
        var value = String(file.fileName || '') + '|' + String(file.fileDataUrl || '');
        var a = 2166136261, b = 3339675911;
        for (var i = 0; i < value.length; i++) { a = Math.imul(a ^ value.charCodeAt(i), 16777619); b = Math.imul(b ^ value.charCodeAt(i), 2246822519); }
        return value.length + '|' + (a >>> 0).toString(16) + (b >>> 0).toString(16);
    }
    function queueDocument(id, deleted) {
        var info = readJSON(IDB_META_KEY, {}) || {};
        var previous = documentPending[id];
        documentPending[id] = { deleted: !!deleted, token: Date.now() + '_' + Math.random(),
            baseRev: previous ? previous.baseRev : Number(info.revisions && info.revisions[id]) || 0 };
        saveDocumentPending();
        setStatus('saving');
        scheduleDocPush();
    }
    window.addEventListener('pmm-document-changed', function (event) {
        if (event.detail && event.detail.id) queueDocument(event.detail.id, event.detail.deleted);
    });
    function scheduleDocPush(delay) {
        if (docPushTimer) clearTimeout(docPushTimer);
        docPushTimer = setTimeout(function () { pushChangedDocs(false); }, typeof delay === 'number' ? delay : DOC_DEBOUNCE_MS);
    }
    function pushChangedDocs(isFullPush) {
        if (docPushPromise) return docPushPromise;
        if (manualBackupInProgress || awaitingFirstPull || filesInFlight) { scheduleDocPush(500); return Promise.resolve(); }
        if (typeof window.exportAllDocsFromIndexedDB !== 'function' || !isAdminRole()) return Promise.resolve();
        var metadataKeys = Object.keys(pending).filter(function (key) { return key === 'saved_documents_v2' || key.indexOf('car_folder_') === 0; });
        if (metadataKeys.some(function (key) { return pending[key].blocked; })) return Promise.resolve();
        if (metadataKeys.length) { scheduleDocPush(500); return Promise.resolve(); }
        docPushPromise = Promise.resolve(window.exportAllDocsFromIndexedDB()).then(function (files) {
            var info = readJSON(IDB_META_KEY, {}) || {};
            if (!info.fingerprints) info.fingerprints = {};
            if (!info.revisions) info.revisions = {};
            if (isFullPush) files.forEach(function (file) {
                if (!documentPending[file.id] && info.fingerprints[file.id] !== fingerprintFile(file)) queueDocument(file.id, false);
            });
            var batch = JSON.parse(JSON.stringify(documentPending));
            var byId = {};
            files.forEach(function (file) { byId[file.id] = file; });
            var changed = [], deleted = [];
            Object.keys(batch).forEach(function (id) {
                if (batch[id].blocked) return;
                if (batch[id].deleted) deleted.push({ id: id, baseRev: batch[id].baseRev });
                else if (byId[id]) changed.push(Object.assign({}, byId[id], { baseRev: batch[id].baseRev }));
                // A missing local file is an error, never an inferred deletion.
            });
            if (!changed.length && !deleted.length) return;
            return fetchWithTimeout(SERVER_URL + '/api/shared-idb', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: getRole(), files: changed, deletedFileIds: deleted })
            }, DOCS_TIMEOUT_MS).then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            }).then(function (data) {
                if (!data.ok || !data.applied) throw new Error('Сервер ще не підтвердив надійне збереження файлів');
                // Reload: a concurrent GET may have learned newer revisions.
                info = readJSON(IDB_META_KEY, {}) || {};
                if (!info.fingerprints) info.fingerprints = {};
                if (!info.revisions) info.revisions = {};
                Object.keys(data.applied).forEach(function (id) {
                    info.revisions[id] = Math.max(Number(info.revisions[id]) || 0, Number(data.applied[id]) || 0);
                    if (documentPending[id] && batch[id] && documentPending[id].token === batch[id].token) {
                        if (batch[id].deleted) delete info.fingerprints[id];
                        else if (byId[id]) info.fingerprints[id] = fingerprintFile(byId[id]);
                        delete documentPending[id];
                    } else if (documentPending[id]) documentPending[id].baseRev = info.revisions[id];
                });
                Object.keys(data.rejected || {}).forEach(function (id) {
                    if (documentPending[id]) documentPending[id].blocked = true;
                    lastSafetyWarning = 'Конфлікт документа: локальний файл збережено, автоматичну заміну серверного файлу зупинено.';
                });
                writeJSON(IDB_META_KEY, info);
                saveDocumentPending();
                docRetryDelay = RETRY_MIN_MS;
                setStatus(Object.keys(data.rejected || {}).length ? 'conflict' : 'ok');
                if (Object.keys(documentPending).some(function (id) { return !documentPending[id].blocked; })) scheduleDocPush(300);
            });
        }).catch(function (error) {
            setStatus('offline');
            scheduleDocPush(docRetryDelay);
            docRetryDelay = Math.min(docRetryDelay * 2, RETRY_MAX_MS);
            if (isFullPush) throw error;
        }).finally(function () { docPushPromise = null; });
        return docPushPromise;
    }
    function pullDocsIfNewer(serverVersion, force) {
        if (typeof window.restoreAllDocsToIndexedDB !== 'function' || filesInFlight || docPushPromise) return Promise.resolve();
        var initialInfo = readJSON(IDB_META_KEY, {}) || {};
        if (!force && serverVersion <= (Number(initialInfo.version) || 0)) return Promise.resolve();
        filesInFlight = true;
        return fetchWithTimeout(SERVER_URL + '/api/shared-idb', { cache: 'no-store' }, DOCS_TIMEOUT_MS).then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        }).then(async function (data) {
            var local = await window.exportAllDocsFromIndexedDB();
            var byId = {}, serverIds = {};
            local.forEach(function (file) { byId[file.id] = file; });
            var info = readJSON(IDB_META_KEY, {}) || {};
            if (!info.fingerprints) info.fingerprints = {};
            if (!info.revisions) info.revisions = {};
            var restore = [];
            (data.files || []).forEach(function (file) {
                serverIds[file.id] = true;
                var existing = byId[file.id];
                var remoteFingerprint = file.deleted ? null : fingerprintFile(file);
                var queued = documentPending[file.id];
                if (queued) {
                    if (queued.blocked && ((queued.deleted && file.deleted && !existing)
                        || (!queued.deleted && !file.deleted && existing && fingerprintFile(existing) === remoteFingerprint))) {
                        delete documentPending[file.id];
                    } else return;
                }
                if (existing && fingerprintFile(existing) !== remoteFingerprint && info.fingerprints[file.id] !== fingerprintFile(existing)) {
                    // An old / offline browser has an unacknowledged local file.
                    queueDocument(file.id, false);
                    if (!info.fingerprints[file.id]) documentPending[file.id].blocked = true;
                    return;
                }
                info.revisions[file.id] = Number(file.rev) || 0;
                if ((!file.deleted && (!existing || fingerprintFile(existing) !== remoteFingerprint)) || (file.deleted && existing)) restore.push(file);
                if (file.deleted) delete info.fingerprints[file.id];
                else info.fingerprints[file.id] = remoteFingerprint;
            });
            await window.restoreAllDocsToIndexedDB(restore, true);
            // Only GET advances the file cursor; POST must not skip other PCs.
            info.version = Number(data.version) || 0;
            writeJSON(IDB_META_KEY, info);
            local.forEach(function (file) { if (!serverIds[file.id] && !documentPending[file.id]) queueDocument(file.id, false); });
            saveDocumentPending();
            if (Object.keys(documentPending).length) scheduleDocPush();
            callIfExists('renderDocumentsMainView');
        }).catch(function () { setStatus('offline'); }).finally(function () { filesInFlight = false; });
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
        if (manualSavePromise) return manualSavePromise;
        manualBackupInProgress = true;
        lastSafetyWarning = '';
        setStatus('saving');

        var period = null;
        try {
            if (typeof window.getStrictActivePeriod === 'function') period = window.getStrictActivePeriod();
        } catch (e) {}
        callIfExists('saveCarRoutesForPeriod', period ? [period] : []);
        callIfExists('saveCarsModificationsToStorage');
        callIfExists('saveCarsToStorage');
        callIfExists('saveDocumentEditorDraft');

        [['report-view', 'saveCurrentReportSilently'], ['equipment-report-view', 'saveCurrentEquipmentReportSilently'],
            ['aggregates-calc-view', 'saveAggCalcState']].forEach(function (entry) {
            var section = document.getElementById(entry[0]);
            if (section && (section.classList.contains('active') || section.style.display === 'block')) callIfExists(entry[1]);
        });

        localKeys().forEach(function (key) {
            if (!isSyncedKey(key)) return;
            var value = localGet(key);
            if (value === null) return;
            var previous = pending[key];
            if (previous && previous.blocked) return;
            pending[key] = { value: value, deleted: false, preBoot: false };
            if (isCarKey(key)) pending[key].baseValue = previous && previous.baseValue !== undefined ? previous.baseValue : meta.carBases[key];
        });
        savePending();

        // Saving to the shared site does not download files onto the computer.
        // Local history remains a recovery aid; GitHub is server-side persistence.
        var serverBackup = false;
        manualSavePromise = Promise.resolve().then(function () {
            manualBackupInProgress = false;
            return flushPending();
        })
            .then(function () { return pushChangedDocs(true); })
            .then(function () {
                return fetchWithTimeout(SERVER_URL + '/api/shared-backup', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role: getRole(), deviceId: deviceId })
                }, DOCS_TIMEOUT_MS).then(function (res) {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return res.json();
                }).then(function (data) { serverBackup = !!(data && data.ok); }).catch(function () {});
            })
            .then(function () {
                var left = Object.keys(pending).length + Object.keys(documentPending).length;
                var hasConflicts = Object.keys(pending).some(function (key) { return pending[key].blocked; }) || Object.keys(documentPending).some(function (id) { return documentPending[id].blocked; });
                setStatus(lastSafetyWarning || hasConflicts ? 'conflict' : (left > 0 ? 'saving' : 'ok'));
                if (!showNotification) return;

                var msg = lastSafetyWarning || (hasConflicts ? 'Є конфлікт. Ваш варіант збережено локально; серверний варіант не перезаписано.' : left > 0 ? 'Частина змін ще у черзі — збереження на сайт не завершено.' : 'Дані збережено на сайті та доступні всім користувачам.');
                msg += serverBackup ? ' Серверна резервна копія створена.' : ' Серверну резервну копію не підтверджено.';
                var color = left > 0 || lastSafetyWarning || !serverBackup ? '#d97706' : '#27ae60';
                if (!callIfExists('showDevNotification', [msg, color])) alert(msg);
            }).catch(function (error) {
                setStatus('offline');
                var msg = 'Збереження на сайт не завершено: ' + error.message + '. Зміни залишилися в черзі для повторного надсилання.';
                if (!callIfExists('showDevNotification', [msg, '#e74c3c'])) alert(msg);
            }).finally(function () {
                manualBackupInProgress = false;
                manualSavePromise = null;
            });
        return manualSavePromise;
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

    // A visible review is required for genuinely different versions. Never
    // clear a blocked outbox or choose the server merely to turn the dot green.
    window.inspectPmmSyncConflicts = async function () {
        var response = await fetchWithTimeout(SERVER_URL + '/api/shared-state', {cache: 'no-store'}, PULL_TIMEOUT_MS);
        if (!response.ok) throw new Error('Сервер недоступний: HTTP ' + response.status);
        var state = await response.json();
        var result = [];
        Object.keys(pending).forEach(function (key) {
            var p = pending[key];
            if (!p.blocked) return;
            var remote = state.keys[key] || {deleted: true, rev: 0};
            result.push({kind: 'key', id: key, local: {value: p.value, deleted: !!p.deleted}, remote: remote});
        });
        if (Object.keys(documentPending).some(function (id) { return documentPending[id].blocked; })) {
            var filesResponse = await fetchWithTimeout(SERVER_URL + '/api/shared-idb', {cache: 'no-store'}, DOCS_TIMEOUT_MS);
            if (!filesResponse.ok) throw new Error('Не вдалося перевірити документи');
            var files = (await filesResponse.json()).files || [];
            var local = await window.exportAllDocsFromIndexedDB();
            Object.keys(documentPending).forEach(function (id) {
                var p = documentPending[id];
                if (!p.blocked) return;
                result.push({kind: 'file', id: id, token: p.token,
                    local: {deleted: !!p.deleted, file: local.find(function (file) {return file.id === id;})},
                    remote: files.find(function (file) {return file.id === id;}) || {id: id, deleted: true, rev: 0}});
            });
        }
        return {conflicts: result, queued: Object.keys(pending).length + Object.keys(documentPending).length,
            warning: lastSafetyWarning || window.localBackupFailure || '', canUpload: isAdminRole()};
    };
    window.resolvePmmSyncConflict = async function (item, choice) {
        if (choice !== 'local' && choice !== 'server') throw new Error('Невідомий вибір');
        if (choice === 'local' && !isAdminRole()) throw new Error('Для запису на сайт увійдіть як адмін або розробник');
        function checkCurrent() {
            var p = item.kind === 'key' ? pending[item.id] : documentPending[item.id];
            if (!p || !p.blocked || (item.kind === 'key' ? p.value !== item.local.value || !!p.deleted !== item.local.deleted : p.token !== item.token)) {
                throw new Error('Дані вже змінилися. Оновіть список конфліктів перед вибором.');
            }
            if (item.kind === 'key' && localGet(item.id) !== (p.deleted ? null : p.value)) throw new Error('Локальні дані змінилися в іншій вкладці. Оновіть список.');
            return p;
        }
        checkCurrent();
        if (typeof window.archiveLocalSiteChange !== 'function') throw new Error('Модуль історії змін недоступний');
        await window.archiveLocalSiteChange('conflict-review', item.id, JSON.stringify(item.local), JSON.stringify(item.remote));
        var p = checkCurrent();
        if (item.kind === 'key') {
            // Preserve the local candidate even when the server is selected.
            if (!item.local.deleted) localSet('__sync_value_conflict_' + item.id, item.local.value);
            setKeyRev(item.id, Number(item.remote.rev) || 0);
            if (choice === 'server') {
                if (item.remote.deleted) localRemove(item.id); else localSet(item.id, item.remote.value);
                delete pending[item.id];
            } else {
                p.blocked = false;
                if (isCarKey(item.id)) p.baseValue = item.remote.deleted ? null : item.remote.value;
            }
            if (isCarKey(item.id)) meta.carBases[item.id] = item.remote.deleted ? null : item.remote.value;
            saveMeta(); savePending();
        } else {
            var currentFiles = await window.exportAllDocsFromIndexedDB();
            var currentFile = currentFiles.find(function (file) { return file.id === item.id; });
            if (!!currentFile !== !!item.local.file || (currentFile && fingerprintFile(currentFile) !== fingerprintFile(item.local.file))) throw new Error('Локальний файл уже змінився. Оновіть список.');
            p = checkCurrent();
            var info = readJSON(IDB_META_KEY, {}) || {};
            if (!info.revisions) info.revisions = {};
            if (!info.fingerprints) info.fingerprints = {};
            if (choice === 'server') {
                if (typeof window.restoreAllDocsToIndexedDB !== 'function') throw new Error('Переглядач документів недоступний');
                await window.restoreAllDocsToIndexedDB([item.remote], true);
                if (documentPending[item.id]?.token !== item.token) throw new Error('Документ змінився під час перевірки');
                delete documentPending[item.id];
                info.revisions[item.id] = Number(item.remote.rev) || 0;
                if (item.remote.deleted) delete info.fingerprints[item.id]; else info.fingerprints[item.id] = fingerprintFile(item.remote);
            } else {
                if (!item.local.deleted && !item.local.file) throw new Error('Локальний файл відсутній');
                p.blocked = false;
                p.baseRev = Number(item.remote.rev) || 0;
            }
            info.version = 0;
            writeJSON(IDB_META_KEY, info); saveDocumentPending();
        }
        lastSafetyWarning = '';
        meta.lastRev = 0;
        saveMeta();
        refreshAllViewsSafely();
        setStatus('ok');
        pullServer(false);
        schedulePush(0); scheduleDocPush(0);
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
    if (typeof EventSource === 'function') {
        var sharedEvents = new EventSource(SERVER_URL + '/api/shared-events');
        sharedEvents.onmessage = function () { sharedEventPending = true; pullSharedEvent(); };
    }
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
