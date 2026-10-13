// =========================================================================
// МОДУЛЬ СПІЛЬНОЇ ХМАРНОЇ СИНХРОНІЗАЦІЇ САЙТУ (shared_sync.js)
// Автоматично зберігає та синхронізує Звіти, Маршрути, Картки авто,
// Реєстр авто та Документи А4 на сервері між усіма користувачами за ролями.
// =========================================================================

(function () {
    const SERVER_URL = 'https://pmm-server.onrender.com';

    let knownServerVersion = 0;
    let knownServerIdbVersion = 0;
    let isApplyingRemoteState = false;
    let pendingChanges = {};
    let pendingDeletedKeys = new Set();
    let syncTimer = null;
    let isSyncInFlight = false;

    const rawSetItem = Storage.prototype.setItem;
    const rawRemoveItem = Storage.prototype.removeItem;

    function getActiveUserRole() {
        if (typeof currentRole !== 'undefined' && currentRole) {
            return String(currentRole).toLowerCase().trim();
        }
        if (typeof window.detectActiveUserRole === 'function') {
            return String(window.detectActiveUserRole()).toLowerCase().trim();
        }
        return 'user';
    }

    function isKeyShared(key) {
        if (!key || typeof key !== 'string') return false;
        const localOnly = new Set([
            'currentRole',
            'userRole',
            'role',
            'isDeveloperLoggedIn',
            'last_active_car_id',
            'last_active_car_period',
            'last_active_report_period'
        ]);
        return !localOnly.has(key);
    }

    function canCurrentRoleWriteKey(key) {
        if (!isKeyShared(key)) return false;
        return true;
    }

    function updateSyncStatusBadge(text, color = '#2ecc71') {
        ensureHeaderSyncWidget();
        const badge = document.getElementById('cloud-sync-status-dot');
        const label = document.getElementById('cloud-sync-status-text');
        if (badge) badge.style.backgroundColor = color;
        if (label) label.textContent = text;
    }

    function ensureHeaderSyncWidget() {
        const navRight = document.getElementById('top-search-box') || document.querySelector('.nav-right') || document.querySelector('.top-nav');
        if (!navRight) return;

        let widget = document.getElementById('cloud-sync-header-widget');
        if (!widget) {
            widget = document.createElement('div');
            widget.id = 'cloud-sync-header-widget';
            widget.style.cssText = 'display: inline-flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.32); padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); font-size: 11px; color: #ecf0f1; margin-right: 6px;';
            widget.innerHTML = `
                <span id="cloud-sync-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #2ecc71; display: inline-block; box-shadow: 0 0 6px #2ecc71;"></span>
                <span id="cloud-sync-status-text" style="font-weight: 600; white-space: nowrap;">Синхронізовано</span>
                <button type="button" id="cloud-sync-push-btn" onclick="forcePushAllDataToServer(true)" title="Зберегти всі звіти, маршрути та документи на сервері для всіх пристроїв" style="background: #27ae60; color: #fff; border: none; border-radius: 4px; padding: 4px 10px; font-size: 11px; font-weight: bold; cursor: pointer; white-space: nowrap;">☁️ Зберегти на сайт</button>
            `;
            const searchInput = document.getElementById('base-search-input');
            if (searchInput && searchInput.parentElement === navRight) {
                navRight.insertBefore(widget, searchInput);
            } else {
                navRight.appendChild(widget);
            }
        }
    }

    // Перехоплення localStorage.setItem та removeItem для миттєвої відправки змін на сервер
    Storage.prototype.setItem = function (key, value) {
        const prevVal = this === window.localStorage ? this.getItem(key) : null;
        rawSetItem.call(this, key, value);

        if (this === window.localStorage && !isApplyingRemoteState && prevVal !== String(value)) {
            if (canCurrentRoleWriteKey(key)) {
                pendingChanges[key] = String(value);
                pendingDeletedKeys.delete(key);
                schedulePushChanges();
            }
        }
    };

    Storage.prototype.removeItem = function (key) {
        rawRemoveItem.call(this, key);

        if (this === window.localStorage && !isApplyingRemoteState) {
            if (canCurrentRoleWriteKey(key)) {
                delete pendingChanges[key];
                pendingDeletedKeys.add(key);
                schedulePushChanges();
            }
        }
    };

    function schedulePushChanges() {
        updateSyncStatusBadge('Збереження...', '#f39c12');
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
            flushPendingChangesToServer();
        }, 350);
    }

    async function flushPendingChangesToServer() {
        const keysToSend = Object.keys(pendingChanges);
        const delsToSend = Array.from(pendingDeletedKeys);
        if (keysToSend.length === 0 && delsToSend.length === 0) {
            updateSyncStatusBadge('Синхронізовано', '#2ecc71');
            return;
        }

        const payloadChanges = { ...pendingChanges };
        const payloadDeleted = [...delsToSend];
        pendingChanges = {};
        pendingDeletedKeys.clear();

        try {
            const res = await fetch(`${SERVER_URL}/api/shared-state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: getActiveUserRole(),
                    changes: payloadChanges,
                    deletedKeys: payloadDeleted,
                    isInitialSeed: false
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.version) {
                    knownServerVersion = Math.max(knownServerVersion, Number(data.version));
                }
                updateSyncStatusBadge('Синхронізовано', '#2ecc71');
            }
        } catch (err) {
            console.warn('Помилка синхронізації з сервером:', err);
            updateSyncStatusBadge('Локальний режим', '#e67e22');
        }
    }

    // Синхронізація файлів документів з IndexedDB на сервер
    async function pushAllIndexedDBFilesToServer(isInitialSeed = false) {
        if (typeof window.exportAllDocsFromIndexedDB !== 'function') return;
        const role = getActiveUserRole();
        if (!isInitialSeed && role !== 'admin' && role !== 'developer' && role !== 'dev') return;

        try {
            const files = await window.exportAllDocsFromIndexedDB();
            if (!Array.isArray(files) || files.length === 0) return;

            const res = await fetch(`${SERVER_URL}/api/shared-idb`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: role,
                    files: files,
                    isInitialSeed: isInitialSeed
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.version) {
                    knownServerIdbVersion = Math.max(knownServerIdbVersion, Number(data.version));
                }
            }
        } catch (err) {
            console.warn('Не вдалося відправити файли документів на сервер:', err);
        }
    }

    async function pullIndexedDBFilesFromServer() {
        if (typeof window.restoreAllDocsToIndexedDB !== 'function') return;
        try {
            const res = await fetch(`${SERVER_URL}/api/shared-idb`);
            if (!res.ok) return;
            const data = await res.json();
            if (data && Array.isArray(data.files) && data.files.length > 0) {
                await window.restoreAllDocsToIndexedDB(data.files);
            }
            if (data && data.version) {
                knownServerIdbVersion = Number(data.version);
            }
        } catch (err) {
            console.warn('Не вдалося завантажити файли документів із сервера:', err);
        }
    }

    function collectAllLocalSharedStorage() {
        const result = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && isKeyShared(k)) {
                const v = localStorage.getItem(k);
                if (v !== null) result[k] = v;
            }
        }
        return result;
    }

    function refreshAllViewsSafely() {
        const activeEl = document.activeElement;
        const isTyping = activeEl && (
            activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.isContentEditable
        );

        try {
            if (typeof window.reloadCarsFromStorage === 'function') window.reloadCarsFromStorage();
            if (typeof loadCarsModifications === 'function') loadCarsModifications();
            if (typeof initCardPeriodsSelect === 'function') initCardPeriodsSelect();
            if (typeof populatePeriodDropdown === 'function') {
                populatePeriodDropdown(typeof activeReportPeriod !== 'undefined' ? activeReportPeriod : undefined);
            }
            if (typeof populateCarSelector === 'function') populateCarSelector();

            if (!isTyping) {
                if (typeof renderCarsTable === 'function') renderCarsTable();
                if (typeof loadCarDataForActivePeriod === 'function') loadCarDataForActivePeriod();
                if (typeof renderReportTable === 'function') renderReportTable();
                if (typeof renderSubdivisionsView === 'function') renderSubdivisionsView();
                if (typeof renderGeneratorsView === 'function') renderGeneratorsView();
                if (typeof renderAggregatesCalcView === 'function') renderAggregatesCalcView();
                if (typeof renderDestroyedEquipmentView === 'function') renderDestroyedEquipmentView();
                if (typeof renderCarDetailsData === 'function' && window.activeReportCarId) renderCarDetailsData();
                if (typeof renderDocumentsMainView === 'function') renderDocumentsMainView();
                if (typeof refreshAllFragmentTemplateWidgets === 'function') refreshAllFragmentTemplateWidgets();
                if (typeof renderDeveloperPanel === 'function' && typeof currentRole !== 'undefined' && currentRole === 'developer') renderDeveloperPanel();
            }
            if (typeof updateRoleUI === 'function') updateRoleUI();
        } catch (err) {
            console.warn('Помилка оновлення інтерфейсу під час синхронізації:', err);
        }
    }

    function applyRemoteStorageMap(remoteStorage) {
        if (!remoteStorage || typeof remoteStorage !== 'object') return false;
        isApplyingRemoteState = true;
        let hasChanges = false;

        try {
            Object.keys(remoteStorage).forEach(key => {
                if (!isKeyShared(key)) return;
                const rawVal = remoteStorage[key];
                if (rawVal === undefined || rawVal === null || rawVal === 'undefined') return;
                const newVal = String(rawVal);
                const curVal = localStorage.getItem(key);
                if (curVal !== newVal) {
                    rawSetItem.call(localStorage, key, newVal);
                    hasChanges = true;
                }
            });
        } finally {
            isApplyingRemoteState = false;
        }

        if (hasChanges) {
            refreshAllViewsSafely();
        }
        return hasChanges;
    }

    // Примусове збереження всіх даних на сервер
    window.forcePushAllDataToServer = async function (showNotification = false) {
        updateSyncStatusBadge('Збереження на сайт...', '#f39c12');

        if (typeof saveCarRoutesForPeriod === 'function' && typeof getStrictActivePeriod === 'function') {
            try { saveCarRoutesForPeriod(getStrictActivePeriod()); } catch(e) {}
        }
        if (typeof saveCarsModificationsToStorage === 'function') {
            try { saveCarsModificationsToStorage(); } catch(e) {}
        }
        if (typeof saveCarsToStorage === 'function') {
            try { saveCarsToStorage(); } catch(e) {}
        }

        const allLocal = collectAllLocalSharedStorage();

        try {
            const res = await fetch(`${SERVER_URL}/api/shared-state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: getActiveUserRole(),
                    changes: allLocal,
                    deletedKeys: [],
                    isInitialSeed: false
                })
            });

            await pushAllIndexedDBFilesToServer(false);

            if (res.ok) {
                const data = await res.json();
                if (data && data.version) {
                    knownServerVersion = Number(data.version);
                }
                updateSyncStatusBadge('Синхронізовано', '#2ecc71');
                if (showNotification) {
                    const msg = '☁️ Усі зміни успішно збережено на сайті! Вони доступні на всіх інших ваших пристроях.';
                    if (typeof showDevNotification === 'function') {
                        showDevNotification(msg, '#27ae60');
                    } else {
                        alert(msg);
                    }
                }
            }
        } catch (err) {
            console.error('Помилка збереження на сервер:', err);
            updateSyncStatusBadge('Помилка з’єднання', '#e74c3c');
        }
    };

    // Початкова синхронізація при відкритті сайту
    async function initSharedCloudSync() {
        ensureHeaderSyncWidget();
        try {
            const res = await fetch(`${SERVER_URL}/api/shared-state`);
            if (!res.ok) return;
            const data = await res.json();
            const serverStorage = (data && data.storage) ? data.storage : {};
            const serverKeysCount = Object.keys(serverStorage).length;

            if (serverKeysCount === 0) {
                const initialLocal = collectAllLocalSharedStorage();
                if (Object.keys(initialLocal).length > 0) {
                    const seedRes = await fetch(`${SERVER_URL}/api/shared-state`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            role: 'developer',
                            changes: initialLocal,
                            deletedKeys: [],
                            isInitialSeed: true
                        })
                    });
                    if (seedRes.ok) {
                        const seedInfo = await seedRes.json();
                        knownServerVersion = Number(seedInfo.version) || 1;
                    }
                }
                await pushAllIndexedDBFilesToServer(true);
            } else {
                knownServerVersion = Number(data.version) || 1;
                applyRemoteStorageMap(serverStorage);
                refreshAllViewsSafely();

                if (Number(data.idbVersion) > knownServerIdbVersion) {
                    await pullIndexedDBFilesFromServer();
                    if (typeof renderDocumentsMainView === 'function') {
                        renderDocumentsMainView();
                    }
                }
            }
            updateSyncStatusBadge('Синхронізовано', '#2ecc71');
        } catch (err) {
            console.warn('Сервер синхронізації недоступний, робота з локальним сховищем:', err);
            updateSyncStatusBadge('Локальна база', '#95a5a6');
        }
    }

    // Періодична перевірка оновлень від інших користувачів
    async function pollServerUpdates() {
        if (isSyncInFlight || Object.keys(pendingChanges).length > 0) return;
        isSyncInFlight = true;
        try {
            ensureHeaderSyncWidget();
            const res = await fetch(`${SERVER_URL}/api/shared-version`);
            if (!res.ok) return;
            const info = await res.json();

            if (Number(info.version) > knownServerVersion) {
                const stateRes = await fetch(`${SERVER_URL}/api/shared-state`);
                if (stateRes.ok) {
                    const stateData = await stateRes.json();
                    knownServerVersion = Number(stateData.version) || knownServerVersion;
                    applyRemoteStorageMap(stateData.storage || {});
                }
            }

            if (Number(info.idbVersion) > knownServerIdbVersion) {
                await pullIndexedDBFilesFromServer();
                if (typeof renderDocumentsMainView === 'function') {
                    renderDocumentsMainView();
                }
            }
        } catch (e) {
            // Ігноруємо тимчасові мережеві збої при фоновому опитуванні
        } finally {
            isSyncInFlight = false;
        }
    }

    function hookDocumentAndCardSaveFunctions() {
        if (typeof window.saveActiveCardPeriodData === 'function' && !window.saveActiveCardPeriodData._cloudHooked) {
            const origSaveCard = window.saveActiveCardPeriodData;
            const wrappedSaveCard = function () {
                const res = origSaveCard.apply(this, arguments);
                window.forcePushAllDataToServer(false);
                return res;
            };
            wrappedSaveCard._cloudHooked = true;
            window.saveActiveCardPeriodData = wrappedSaveCard;
        }

        const origSet = Storage.prototype.setItem;
        if (!origSet._idbDocHooked) {
            const wrappedSet = function (key, value) {
                const r = origSet.call(this, key, value);
                if (this === window.localStorage && !isApplyingRemoteState && key === 'saved_documents_v2') {
                    setTimeout(() => {
                        pushAllIndexedDBFilesToServer(false);
                    }, 500);
                }
                return r;
            };
            wrappedSet._idbDocHooked = true;
            Storage.prototype.setItem = wrappedSet;
        }
    }

    function startCloudSync() {
        hookDocumentAndCardSaveFunctions();
        setTimeout(() => {
            initSharedCloudSync();
        }, 120);
        setInterval(pollServerUpdates, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startCloudSync);
    } else {
        startCloudSync();
    }

    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flushPendingChangesToServer();
        }
    });

    window.addEventListener('beforeunload', () => {
        flushPendingChangesToServer();
    });
})();