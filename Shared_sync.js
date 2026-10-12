// =========================================================================
// МОДУЛЬ СПІЛЬНОЇ ХМАРНОЇ СИНХРОНІЗАЦІЇ САЙТУ (shared_sync.js)
// Автоматично зберігає та синхронізує Звіти, Маршрути, Картки авто,
// Реєстр авто та Документи А4 на сервері між усіма користувачами за ролями.
// =========================================================================

(function () {
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
        if (localOnly.has(key)) return false;

        return (
            key.startsWith('report_data_') ||
            key.startsWith('isolated_car_routes_') ||
            key.startsWith('car_history_data_') ||
            key.startsWith('car_folders_') ||
            key === 'saved_documents_v2' ||
            key === 'doc_fragment_templates_v1' ||
            key === 'doc_margins_mm_state_v1' ||
            key === 'doc_margins_mm_templates_v1' ||
            key === 'user_cars_database_v2' ||
            key === 'cars_backup_array' ||
            key === 'cars_modifications_data' ||
            key === 'app_saved_periods_list' ||
            key === 'eq_saved_periods_list' ||
            key === 'generators_custom_data' ||
            key === 'webasto_custom_data' ||
            key === 'heaters_custom_data' ||
            key === 'chainsaws_custom_data' ||
            key === 'aggregates_calc_saved_state' ||
            key === 'destroyed_custom_records' ||
            key === 'broadcastStorageList_v2' ||
            key === 'dev_managed_users' ||
            key === 'dev_role_security_config' ||
            key === 'dev_system_passwords'
        );
    }

    function canCurrentRoleWriteKey(key) {
        if (!isKeyShared(key)) return false;
        const role = getActiveUserRole();
        if (role === 'developer' || role === 'dev' || role === 'admin') {
            return true;
        }
        if (role === 'moderator') {
            return (
                key.startsWith('report_data_') ||
                key === 'app_saved_periods_list' ||
                key === 'eq_saved_periods_list' ||
                key === 'generators_custom_data' ||
                key === 'webasto_custom_data' ||
                key === 'heaters_custom_data' ||
                key === 'chainsaws_custom_data' ||
                key === 'aggregates_calc_saved_state'
            );
        }
        if (role === 'user') {
            return key === 'aggregates_calc_saved_state';
        }
        return false;
    }

    function updateSyncStatusBadge(text, color = '#2ecc71') {
        ensureHeaderSyncWidget();
        const badge = document.getElementById('cloud-sync-status-dot');
        const label = document.getElementById('cloud-sync-status-text');
        if (badge) badge.style.backgroundColor = color;
        if (label) label.textContent = text;
    }

    function ensureHeaderSyncWidget() {
        const header = document.querySelector('.top-header');
        if (!header) return;

        let widget = document.getElementById('cloud-sync-header-widget');
        if (!widget) {
            widget = document.createElement('div');
            widget.id = 'cloud-sync-header-widget';
            widget.style.cssText = 'display: inline-flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.28); padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.18); font-size: 11px; color: #ecf0f1; margin-left: 8px;';
            widget.innerHTML = `
                <span id="cloud-sync-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #2ecc71; display: inline-block; box-shadow: 0 0 6px #2ecc71;"></span>
                <span id="cloud-sync-status-text" style="font-weight: 600; white-space: nowrap;">Синхронізовано</span>
                <button type="button" id="cloud-sync-push-btn" onclick="forcePushAllDataToServer(true)" title="Зберегти всі звіти, маршрути та документи на сервері сайту для всіх користувачів" style="background: #27ae60; color: #fff; border: none; border-radius: 4px; padding: 3px 8px; font-size: 11px; font-weight: bold; cursor: pointer; display: none; white-space: nowrap;">☁️ Зберегти на сайт</button>
            `;
            header.appendChild(widget);
        }

        const pushBtn = document.getElementById('cloud-sync-push-btn');
        if (pushBtn) {
            const role = getActiveUserRole();
            const canPush = (role === 'developer' || role === 'dev' || role === 'admin' || role === 'moderator');
            pushBtn.style.display = canPush ? 'inline-block' : 'none';
        }
    }

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
            const res = await fetch('/api/shared-state', {
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

    async function pushAllIndexedDBFilesToServer(isInitialSeed = false) {
        if (typeof window.exportAllDocsFromIndexedDB !== 'function') return;
        const role = getActiveUserRole();
        if (!isInitialSeed && role !== 'admin' && role !== 'developer' && role !== 'dev') return;

        try {
            const files = await window.exportAllDocsFromIndexedDB();
            if (!Array.isArray(files) || files.length === 0) return;

            const res = await fetch('/api/shared-idb', {
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
            const res = await fetch('/api/shared-idb');
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
            }
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
                const newVal = String(remoteStorage[key]);
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

    window.forcePushAllDataToServer = async function (showNotification = false) {
        const role = getActiveUserRole();
        if (role !== 'developer' && role !== 'dev' && role !== 'admin' && role !== 'moderator') {
            if (showNotification && typeof showDevNotification === 'function') {
                showDevNotification('⚠️ Тільки Модератор, Адмін або Розробник можуть зберігати зміни на сервері!', '#e67e22');
            }
            return;
        }

        updateSyncStatusBadge('Збереження на сайт...', '#f39c12');

        if ((role === 'developer' || role === 'dev' || role === 'admin') && typeof saveCarRoutesForPeriod === 'function' && typeof getStrictActivePeriod === 'function') {
            saveCarRoutesForPeriod(getStrictActivePeriod());
        }
        if ((role === 'developer' || role === 'dev' || role === 'admin') && typeof saveCarsModificationsToStorage === 'function') {
            saveCarsModificationsToStorage();
        }

        const allLocal = collectAllLocalSharedStorage();
        const allowedLocal = {};
        Object.keys(allLocal).forEach(k => {
            if (canCurrentRoleWriteKey(k)) {
                allowedLocal[k] = allLocal[k];
            }
        });

        try {
            const res = await fetch('/api/shared-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: role,
                    changes: allowedLocal,
                    deletedKeys: [],
                    isInitialSeed: false
                })
            });

            if (role === 'developer' || role === 'dev' || role === 'admin') {
                await pushAllIndexedDBFilesToServer(false);
            }

            if (res.ok) {
                const data = await res.json();
                if (data && data.version) {
                    knownServerVersion = Number(data.version);
                }
                updateSyncStatusBadge('Синхронізовано', '#2ecc71');
                if (showNotification) {
                    const msg = '☁️ Усі звіти, маршрути та документи збережено на сайті! Інші користувачі вже бачать оновлення.';
                    if (typeof showDevNotification === 'function') {
                        showDevNotification(msg, '#27ae60');
                    }
                }
            }
        } catch (err) {
            console.error('Помилка збереження на сервер:', err);
            updateSyncStatusBadge('Помилка з’єднання', '#e74c3c');
        }
    };

    async function initSharedCloudSync() {
        ensureHeaderSyncWidget();
        try {
            const res = await fetch('/api/shared-state');
            if (!res.ok) return;
            const data = await res.json();
            const serverStorage = (data && data.storage) ? data.storage : {};
            const serverKeysCount = Object.keys(serverStorage).length;

            if (serverKeysCount === 0) {
                const initialLocal = collectAllLocalSharedStorage();
                if (Object.keys(initialLocal).length > 0) {
                    const seedRes = await fetch('/api/shared-state', {
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

    async function pollServerUpdates() {
        if (isSyncInFlight || Object.keys(pendingChanges).length > 0) return;
        isSyncInFlight = true;
        try {
            ensureHeaderSyncWidget();
            const res = await fetch('/api/shared-version');
            if (!res.ok) return;
            const info = await res.json();

            if (Number(info.version) > knownServerVersion) {
                const stateRes = await fetch('/api/shared-state');
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

    document.addEventListener('DOMContentLoaded', () => {
        hookDocumentAndCardSaveFunctions();
        setTimeout(() => {
            initSharedCloudSync();
        }, 250);
        setInterval(pollServerUpdates, 4000);
    });
})();