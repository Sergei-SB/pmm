// =========================================================================
// ФІНАЛЬНИЙ КОД developer_panel.js (З ПОВНИМ ЕКСПОРТОМ ТА ІМПОРТОМ БЕКАПІВ JSON)
// =========================================================================

let currentDevSubTab = 'dashboard';

if (typeof window.isDeveloperLoggedIn === 'undefined') {
    window.isDeveloperLoggedIn = false;
}

window.togglePasswordVisibility = function(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (btnEl) btnEl.innerHTML = '🙈';
    } else {
        input.type = 'password';
        if (btnEl) btnEl.innerHTML = '👁️';
    }
};

window.toggleTablePinVisibility = function(spanId, realPin, btnEl) {
    const span = document.getElementById(spanId);
    if (!span) return;
    if (span.dataset.visible === '1') {
        span.textContent = '••••••';
        span.dataset.visible = '0';
        if (btnEl) btnEl.innerHTML = '👁️';
    } else {
        span.textContent = realPin;
        span.dataset.visible = '1';
        if (btnEl) btnEl.innerHTML = '🙈';
    }
};

function getSystemPasswords() {
    const defaultPasswords = {
        moderator: "2121",
        admin: "4343",
        developer: "02031985"
    };
    try {
        const saved = JSON.parse(localStorage.getItem('dev_system_passwords') || '{}');
        return {
            moderator: saved.moderator || defaultPasswords.moderator,
            admin: saved.admin || defaultPasswords.admin,
            developer: saved.developer || defaultPasswords.developer
        };
    } catch (e) {
        return defaultPasswords;
    }
}

function getRoleSecurityConfig() {
    const defaultCfg = {
        lockUser: false,
        lockModerator: false,
        lockAdmin: false,
        moderatorCanEditReport: false
    };
    try {
        const saved = JSON.parse(localStorage.getItem('dev_role_security_config') || '{}');
        return Object.assign({}, defaultCfg, saved);
    } catch (e) {
        return defaultCfg;
    }
}

function addSecurityLog(type, title, details) {
    try {
        const logs = JSON.parse(localStorage.getItem('dev_security_logs') || '[]');
        logs.unshift({
            id: Date.now() + Math.random(),
            time: new Date().toLocaleString('uk-UA'),
            type: type,
            title: title,
            details: details || ''
        });
        if (logs.length > 150) logs.length = 150;
        localStorage.setItem('dev_security_logs', JSON.stringify(logs));
    } catch (e) {}
}

function getRoleDisplayName(role) {
    if (role === 'developer') return 'Розробник';
    if (role === 'admin') return 'Адмін';
    if (role === 'moderator') return 'Модератор';
    return 'Юзер';
}

function checkCustomUserPassword(targetRole, inputPwd) {
    if (!inputPwd) return false;
    try {
        const users = getManagedUsers();
        const matched = users.find(u => u.role === targetRole && u.pin && String(u.pin) === String(inputPwd));
        if (matched) {
            if (matched.status === 'banned') {
                alert(`🚫 Ваш обліковий запис (${matched.name}) ЗАБЛОКОВАНО!\nПричина: ${matched.banReason || 'Порушення правил'}`);
                addSecurityLog('danger', `Спроба входу забаненого користувача`, `Користувач: ${matched.name} (${targetRole})`);
                return false;
            }
            addSecurityLog('success', `Персональний вхід: ${matched.name}`, `Роль: ${targetRole}, Підрозділ: ${matched.subdivision || '-'}`);
            return true;
        }
    } catch (e) {}
    return false;
}

window.selectRole = function(role) {
    if (typeof currentRole !== 'undefined' && role === currentRole && role !== 'developer') {
        updateRoleUI();
        return;
    }

    const secCfg = getRoleSecurityConfig();
    const passwords = getSystemPasswords();

    if (window.isDeveloperLoggedIn) {
        currentRole = role;
        addSecurityLog('info', `Швидкий перехід Розробника`, `Перехід у кабінет: ${getRoleDisplayName(role)}`);
        updateRoleUI();
        return;
    }

    if (role === "moderator" && secCfg.lockModerator) {
        alert("⛔ Доступ до кабінету «Модератор» тимчасово заблоковано Розробником!");
        addSecurityLog('warning', 'Спроба входу в заблокований кабінет', 'Модератор');
        return;
    }
    if (role === "admin" && secCfg.lockAdmin) {
        alert("⛔ Доступ до кабінету «Адмін» тимчасово заблоковано Розробником!");
        addSecurityLog('warning', 'Спроба входу в заблокований кабінет', 'Адмін');
        return;
    }

    if (role === "user") {
        currentRole = "user";
        updateRoleUI();
        return;
    }

    if (role === "moderator") {
        showCustomPasswordModal("Введіть пароль Модератора:", (pwd) => {
            if (pwd === null) return;
            if (pwd === passwords.moderator || checkCustomUserPassword('moderator', pwd)) {
                currentRole = "moderator";
                addSecurityLog('success', 'Успішний вхід: Модератор', 'Авторизація пройдена');
                updateRoleUI();
            } else {
                addSecurityLog('danger', 'Невірний пароль Модератора', `Введено: "${pwd}"`);
                alert("❌ Невірний пароль Модератора!");
            }
        });
    } else if (role === "admin") {
        showCustomPasswordModal("Введіть пароль Адміна:", (pwd) => {
            if (pwd === null) return;
            if (pwd === passwords.admin || checkCustomUserPassword('admin', pwd)) {
                currentRole = "admin";
                addSecurityLog('success', 'Успішний вхід: Адмін', 'Авторизація пройдена');
                updateRoleUI();
            } else {
                addSecurityLog('danger', 'Невірний пароль Адміна', `Введено: "${pwd}"`);
                alert("❌ Невірний пароль Адміна!");
            }
        });
    } else if (role === "developer") {
        showCustomPasswordModal("Введіть пароль Розробника:", (pwd) => {
            if (pwd === null) return;
            if (pwd === passwords.developer) {
                currentRole = "developer";
                window.isDeveloperLoggedIn = true;
                addSecurityLog('success', 'Успішний вхід: Розробник (Супер-доступ)', 'Активовано вільний перехід між кабінетами');
                updateRoleUI();
            } else {
                addSecurityLog('danger', 'Спроба злому кабінету Розробника!', `Введено: "${pwd}"`);
                alert("❌ Невірний пароль Розробника!");
            }
        });
    }
};

window.logoutDeveloperSession = function() {
    window.isDeveloperLoggedIn = false;
    currentRole = "user";
    addSecurityLog('info', 'Вихід із режиму Розробника', 'Сесію супер-доступу завершено');
    updateRoleUI();
};

window.updateRoleUI = function() {
    const role = (typeof currentRole !== 'undefined') ? currentRole : 'user';
    const isModOrHigher = (role === "moderator" || role === "admin" || role === "developer");
    const isAdminOrHigher = (role === "admin" || role === "developer");
    const isDev = (role === "developer");
    const secCfg = getRoleSecurityConfig();

    const roles = ["user", "moderator", "admin", "developer"];
    const activeColors = {
        user: "#3498db",
        moderator: "#16a085",
        admin: "#e74c3c",
        developer: "#8e44ad"
    };

    roles.forEach(r => {
        const btn = document.getElementById(`role-btn-${r}`);
        if (btn) {
            if (r === role) {
                btn.style.background = activeColors[r];
                btn.style.color = "white";
                btn.style.boxShadow = "0 0 8px " + activeColors[r];
            } else {
                btn.style.background = "transparent";
                btn.style.color = "#bdc3c7";
                btn.style.boxShadow = "none";
            }
        }
    });

    let devBadge = document.getElementById('dev-super-badge');
    const roleSwitchContainer = document.getElementById('role-btn-developer')?.parentElement;
    if (window.isDeveloperLoggedIn && roleSwitchContainer) {
        if (!devBadge) {
            devBadge = document.createElement('button');
            devBadge.id = 'dev-super-badge';
            devBadge.title = 'Ви увійшли як Розробник (перехід у всі кабінети без паролів). Натисніть, щоб вийти.';
            devBadge.style.cssText = 'background:#2c3e50; color:#f1c40f; border:1px solid #f1c40f; border-radius:4px; padding:4px 8px; font-size:11px; font-weight:bold; cursor:pointer; margin-left:4px;';
            devBadge.innerHTML = '🔓 DEV (Вийти)';
            devBadge.onclick = window.logoutDeveloperSession;
            roleSwitchContainer.appendChild(devBadge);
        }
        devBadge.style.display = 'inline-block';
    } else if (devBadge) {
        devBadge.style.display = 'none';
    }

    const allNavBtns = document.querySelectorAll('.top-nav button, .nav-links button, header .nav-btn');
    allNavBtns.forEach(btn => {
        const txt = (btn.innerText || '').trim();
        const id = btn.id || '';

        if (id.startsWith('role-btn-') || id === 'dev-super-badge') return;
        if (!btn.classList.contains('nav-btn') && !btn.closest('.nav-links') && txt.length <= 3) return;

        const isAllowedForUser = (
            txt.includes('База (Реєстр)') ||
            txt.includes('Картка авто та Маршрути') ||
            txt.includes('Розрахунок агрегатів')
        );

        const isAllowedForModerator = (
            isAllowedForUser ||
            id === 'nav-btn-report' ||
            txt.includes('Звіт (10 днів)')
        );

        if (id === 'nav-btn-dev-panel' || txt.includes('Панель розробника')) {
            btn.style.display = isDev ? 'inline-block' : 'none';
        } else if (id === 'nav-btn-documents' || txt.includes('Документи')) {
            btn.style.display = isAdminOrHigher ? 'inline-block' : 'none';
        } else if (role === 'user') {
            btn.style.display = isAllowedForUser ? 'inline-block' : 'none';
        } else if (role === 'moderator') {
            btn.style.display = isAllowedForModerator ? 'inline-block' : 'none';
        } else {
            btn.style.display = 'inline-block';
        }
    });

    const addCarBtn = document.getElementById('add-car-btn');
    if (addCarBtn) {
        addCarBtn.style.display = isAdminOrHigher ? 'inline-block' : 'none';
    }

    if (isDev) {
        ensureDevPanelHeaderButtons();
        renderDeveloperPanel();
    }
};

function getDevPanelContainer() {
    let el = document.getElementById('dev-panel-main-container') || document.getElementById('developer-panel-view') || document.getElementById('dev-panel-view');
    return el;
}

window.refreshDevPanelData = function() {
    ensureDevPanelHeaderButtons();
    renderDeveloperPanel();
};

// =========================================================================
// ЕКСПОРТ ТА ІМПОРТ БЕКАПУ БАЗИ (JSON)
// =========================================================================

function ensureDevPanelHeaderButtons() {
    const devSection = document.getElementById('dev-panel-view') || document.getElementById('developer-panel-view');
    if (!devSection) return;

    const headerPanel = devSection.querySelector('.card-header-panel');
    if (!headerPanel) return;

    headerPanel.style.display = 'flex';
    headerPanel.style.justifyContent = 'space-between';
    headerPanel.style.alignItems = 'center';
    headerPanel.style.flexWrap = 'wrap';
    headerPanel.style.gap = '10px';

    let actionsWrap = document.getElementById('dev-panel-header-actions');
    if (!actionsWrap) {
        const oldBtns = Array.from(headerPanel.querySelectorAll('button'));
        oldBtns.forEach(b => b.remove());

        actionsWrap = document.createElement('div');
        actionsWrap.id = 'dev-panel-header-actions';
        actionsWrap.style.cssText = 'display: flex; gap: 10px; align-items: center; flex-wrap: wrap;';
        headerPanel.appendChild(actionsWrap);
    }

    if (!actionsWrap.querySelector('#btn-dev-export-backup') || !actionsWrap.querySelector('#btn-dev-import-backup')) {
        actionsWrap.innerHTML = `
            <button class="action-btn" id="btn-dev-refresh" onclick="refreshDevPanelData()" style="background-color: #2980b9; color: #fff; font-weight: bold; padding: 8px 14px; border-radius: 6px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                🔄 Оновити дані
            </button>
            <button class="action-btn" id="btn-dev-export-backup" onclick="exportFullDatabaseBackup()" style="background-color: #27ae60; color: #fff; font-weight: bold; padding: 8px 14px; border-radius: 6px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                📥 Скачати Бекап Бази
            </button>
            <button class="action-btn" id="btn-dev-import-backup" onclick="triggerImportBackupFile()" style="background-color: #e67e22; color: #fff; font-weight: bold; padding: 8px 14px; border-radius: 6px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" title="Завантажити збережений файл або файли .json у систему">
                📤 Імпортувати Бекап (JSON)
            </button>
            <input type="file" id="dev-backup-import-input" accept=".json,application/json" multiple style="display: none;" onchange="handleImportBackupFiles(event)">
        `;
    }
}

window.exportFullDatabaseBackup = function() {
    try {
        const allStorage = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            const rawVal = localStorage.getItem(key);
            try {
                allStorage[key] = JSON.parse(rawVal);
            } catch (e) {
                allStorage[key] = rawVal;
            }
        }

        const backupPayload = {
            app: "Облік палива та конструктор документів А4",
            version: "2.0",
            exportDate: new Date().toISOString(),
            exportDateLocale: new Date().toLocaleString('uk-UA'),
            localStorageData: allStorage
        };

        const jsonStr = JSON.stringify(backupPayload, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_fuel_system_${dateStamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        addSecurityLog('info', 'Експорт бекапу бази (JSON)', `Збережено ключів: ${Object.keys(allStorage).length}`);
        showDevNotification(`✅ Бекап бази успішно скачано (${Object.keys(allStorage).length} розділів даних)!`, '#27ae60');
        renderDeveloperPanel();
    } catch (err) {
        console.error(err);
        showDevNotification('❌ Помилка під час створення бекапу: ' + (err.message || err), '#e74c3c');
    }
};

window.triggerImportBackupFile = function() {
    ensureDevPanelHeaderButtons();
    let input = document.getElementById('dev-backup-import-input');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = 'dev-backup-import-input';
        input.accept = '.json,application/json';
        input.multiple = true;
        input.style.display = 'none';
        input.onchange = window.handleImportBackupFiles;
        document.body.appendChild(input);
    }
    input.value = '';
    input.click();
};

function applyParsedJsonToStorage(parsed) {
    if (!parsed || typeof parsed !== 'object') return 0;
    let importedKeysCount = 0;

    // 1. Стандартний файл бекапу з полем localStorageData / localStorage / storage / data
    const storageMap = parsed.localStorageData || parsed.localStorage || parsed.storage || (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data) ? parsed.data : null);

    if (storageMap && typeof storageMap === 'object' && !Array.isArray(storageMap)) {
        Object.keys(storageMap).forEach(key => {
            const val = storageMap[key];
            if (val === undefined || val === null) return;
            const serialized = (typeof val === 'string') ? val : JSON.stringify(val);
            localStorage.setItem(key, serialized);
            importedKeysCount++;
        });
        return importedKeysCount;
    }

    // 2. Якщо це масив документів або автомобілів
    if (Array.isArray(parsed)) {
        if (parsed.length > 0 && parsed[0] && (parsed[0].layout || parsed[0].originalFormat || String(parsed[0].id || '').startsWith('doc_'))) {
            localStorage.setItem('saved_documents_v2', JSON.stringify(parsed));
            return 1;
        }
        if (parsed.length > 0 && parsed[0] && (parsed[0].plate || parsed[0].fuelType || parsed[0].consumption !== undefined)) {
            if (typeof carsData !== 'undefined' && Array.isArray(carsData)) {
                carsData.length = 0;
                parsed.forEach(c => carsData.push(c));
                if (typeof saveCarsModificationsToStorage === 'function') saveCarsModificationsToStorage();
            }
            localStorage.setItem('cars_backup_array', JSON.stringify(parsed));
            return 1;
        }
        return 0;
    }

    // 3. Якщо це об'єкт шаблонів фрагментів документів
    if (parsed.leftHeader && parsed.rightHeader && parsed.docTitle) {
        localStorage.setItem('doc_fragment_templates_v1', JSON.stringify(parsed));
        return 1;
    }

    // 4. Прямий дамп ключів localStorage
    const metaSkipKeys = new Set(['app', 'version', 'exportDate', 'exportDateLocale']);
    Object.keys(parsed).forEach(key => {
        if (metaSkipKeys.has(key)) return;
        const val = parsed[key];
        if (val === undefined || val === null) return;
        const serialized = (typeof val === 'string') ? val : JSON.stringify(val);
        localStorage.setItem(key, serialized);
        importedKeysCount++;
    });

    return importedKeysCount;
}

function refreshAllModulesAfterImport() {
    try {
        if (typeof loadCarsModifications === 'function') loadCarsModifications();
        if (typeof initCardPeriodsSelect === 'function') initCardPeriodsSelect();
        if (typeof loadCarDataForActivePeriod === 'function') loadCarDataForActivePeriod();
        if (typeof populateCarSelector === 'function') populateCarSelector();
        if (typeof renderCarsTable === 'function') renderCarsTable();
        if (typeof renderReportTable === 'function') renderReportTable();
        if (typeof renderSubdivisionsView === 'function') renderSubdivisionsView();
        if (typeof renderGeneratorsView === 'function') renderGeneratorsView();
        if (typeof renderAggregatesCalcView === 'function') renderAggregatesCalcView();
        if (typeof renderDestroyedEquipmentView === 'function') renderDestroyedEquipmentView();
        if (typeof renderDocumentsMainView === 'function') renderDocumentsMainView();
        if (typeof refreshAllFragmentTemplateWidgets === 'function') refreshAllFragmentTemplateWidgets();
        if (typeof renderDeveloperPanel === 'function') renderDeveloperPanel();
    } catch (e) {
        console.error('Помилка оновлення інтерфейсу після імпорту:', e);
    }
}

window.handleImportBackupFiles = async function(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    let totalKeysRestored = 0;
    let importedFileNames = [];
    let failedFileNames = [];

    for (const file of files) {
        try {
            const text = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(String(e.target.result || ''));
                reader.onerror = () => reject(new Error('Не вдалося прочитати файл'));
                reader.readAsText(file, 'UTF-8');
            });

            const parsed = JSON.parse(text);
            const count = applyParsedJsonToStorage(parsed);
            if (count > 0) {
                totalKeysRestored += count;
                importedFileNames.push(file.name);
            } else {
                failedFileNames.push(file.name);
            }
        } catch (err) {
            console.error(`Помилка імпорту файлу ${file.name}:`, err);
            failedFileNames.push(file.name);
        }
    }

    event.target.value = '';

    if (importedFileNames.length > 0) {
        addSecurityLog('success', 'Імпорт бекапу бази (JSON)', `Файли: ${importedFileNames.join(', ')} (відновлено розділів: ${totalKeysRestored})`);
        refreshAllModulesAfterImport();
        showDevNotification(
            `✅ Успішно імпортовано (${importedFileNames.join(', ')})! Відновлено записів/розділів: ${totalKeysRestored}.`,
            '#27ae60'
        );
    } else {
        addSecurityLog('warning', 'Невдалий імпорт JSON', `Файли: ${failedFileNames.join(', ')}`);
        showDevNotification(
            `⚠️ Не вдалося розпізнати дані у файлі: ${failedFileNames.join(', ')}. Перевірте формат .json.`,
            '#e74c3c'
        );
    }
};

function showDevNotification(msg, bgColor = '#27ae60') {
    const old = document.getElementById('dev-toast-notification');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.id = 'dev-toast-notification';
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: ${bgColor};
        color: #ffffff;
        padding: 13px 20px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        z-index: 999999;
        max-width: 480px;
        line-height: 1.4;
    `;
    toast.innerHTML = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 3800);
}

// =========================================================================
// УПРАВЛІННЯ КОРИСТУВАЧАМИ, ЧАСОМ РОЛЕЙ ТА НАЛАШТУВАННЯМИ ПАНЕЛІ
// =========================================================================

function getManagedUsers() {
    const defaultUsers = [
        { id: 1, name: "Головний Розробник", subdivision: "Штаб / ІТ", role: "developer", pin: "02031985", ip: "192.168.1.10", status: "active", banReason: "", lastSeen: "Онлайн" },
        { id: 2, name: "Черговий Адмін ПММ", subdivision: "Служба ПММ", role: "admin", pin: "4343", ip: "192.168.1.25", status: "active", banReason: "", lastSeen: "Сьогодні" },
        { id: 3, name: "Модератор Звітів", subdivision: "1БрОП", role: "moderator", pin: "2121", ip: "192.168.1.42", status: "active", banReason: "", lastSeen: "Сьогодні" },
        { id: 4, name: "Оператор обліку (Юзер)", subdivision: "БТрО", role: "user", pin: "", ip: "192.168.1.88", status: "active", banReason: "", lastSeen: "Вчора" }
    ];
    try {
        const stored = localStorage.getItem('dev_managed_users');
        if (!stored) {
            localStorage.setItem('dev_managed_users', JSON.stringify(defaultUsers));
            return defaultUsers;
        }
        return JSON.parse(stored);
    } catch (e) {
        return defaultUsers;
    }
}

function formatRoleDuration(seconds) {
    const sec = Math.max(0, Math.floor(Number(seconds) || 0));
    if (sec < 60) return `${sec} сек`;
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const remSec = sec % 60;
    if (hrs > 0) {
        return `${hrs} год ${mins} хв ${remSec} с`;
    }
    return `${mins} хв ${remSec} с`;
}

function getStorageStats() {
    let totalBytes = 0;
    let periodsSet = new Set();
    try {
        const savedPeriods = JSON.parse(localStorage.getItem('app_saved_periods_list') || '[]');
        if (Array.isArray(savedPeriods)) {
            savedPeriods.forEach(p => periodsSet.add(p));
        }
    } catch (e) {}

    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        const v = localStorage.getItem(k) || '';
        totalBytes += (k.length + v.length) * 2;
        if (k.startsWith('isolated_car_routes_')) {
            const parts = k.replace('isolated_car_routes_', '').split('_');
            if (parts[0]) periodsSet.add(parts[0]);
        }
    }

    return {
        kb: (totalBytes / 1024).toFixed(1),
        periodsCount: Math.max(1, periodsSet.size),
        keysCount: localStorage.length
    };
}

window.switchDevSubTab = function(tabName) {
    currentDevSubTab = tabName;
    renderDeveloperPanel();
};

window.resetRoleTimeStats = function() {
    localStorage.setItem('dev_role_time_stats', JSON.stringify({ user: 0, moderator: 0, admin: 0, developer: 0 }));
    addSecurityLog('info', 'Скинуто статистику часу ролей', 'Час роботи всіх ролей обнулено');
    renderDeveloperPanel();
};

window.saveDevSystemPasswords = function() {
    const modPwd = document.getElementById('dev-inp-pwd-mod')?.value.trim() || '2121';
    const admPwd = document.getElementById('dev-inp-pwd-admin')?.value.trim() || '4343';
    const devPwd = document.getElementById('dev-inp-pwd-dev')?.value.trim() || '02031985';

    localStorage.setItem('dev_system_passwords', JSON.stringify({
        moderator: modPwd,
        admin: admPwd,
        developer: devPwd
    }));

    addSecurityLog('warning', 'Змінено системні паролі ролей', `Модератор / Адмін / Розробник оновлено`);
    showDevNotification('✅ Системні паролі успішно збережено!', '#27ae60');
    renderDeveloperPanel();
};

window.toggleDevSecurityFlag = function(flagName, checked) {
    const cfg = getRoleSecurityConfig();
    cfg[flagName] = !!checked;
    localStorage.setItem('dev_role_security_config', JSON.stringify(cfg));
    addSecurityLog('info', `Оновлено налаштування безпеки (${flagName})`, `Значення: ${checked ? 'Увімкнено' : 'Вимкнено'}`);
    updateRoleUI();
};

window.addNewManagedUser = function() {
    const name = document.getElementById('dev-new-user-name')?.value.trim();
    const sub = document.getElementById('dev-new-user-sub')?.value.trim();
    const role = document.getElementById('dev-new-user-role')?.value || 'user';
    const pin = document.getElementById('dev-new-user-pin')?.value.trim() || '';

    if (!name) {
        showDevNotification('⚠️ Введіть ПІБ або позивний користувача!', '#e67e22');
        return;
    }

    const users = getManagedUsers();
    const newId = users.length > 0 ? Math.max(...users.map(u => Number(u.id) || 0)) + 1 : 1;
    users.push({
        id: newId,
        name: name,
        subdivision: sub || 'РМТЗ',
        role: role,
        pin: pin,
        ip: `192.168.1.${Math.floor(20 + Math.random() * 200)}`,
        status: 'active',
        banReason: '',
        lastSeen: 'Щойно'
    });

    localStorage.setItem('dev_managed_users', JSON.stringify(users));
    addSecurityLog('success', 'Додано нового користувача', `${name} (${getRoleDisplayName(role)})`);
    showDevNotification(`✅ Користувача «${name}» додано!`, '#27ae60');
    renderDeveloperPanel();
};

window.toggleBanManagedUser = function(userId) {
    const users = getManagedUsers();
    const u = users.find(x => Number(x.id) === Number(userId));
    if (!u) return;

    if (u.status === 'banned') {
        u.status = 'active';
        u.banReason = '';
        addSecurityLog('info', `Розблоковано користувача: ${u.name}`, `ID: ${u.id}`);
    } else {
        u.status = 'banned';
        u.banReason = 'Заблоковано адміністратором безпеки';
        addSecurityLog('danger', `Заблоковано користувача: ${u.name}`, `ID: ${u.id}`);
    }
    localStorage.setItem('dev_managed_users', JSON.stringify(users));
    renderDeveloperPanel();
};

window.deleteManagedUser = function(userId) {
    let users = getManagedUsers();
    const target = users.find(x => Number(x.id) === Number(userId));
    users = users.filter(x => Number(x.id) !== Number(userId));
    localStorage.setItem('dev_managed_users', JSON.stringify(users));
    if (target) {
        addSecurityLog('warning', `Видалено користувача: ${target.name}`, `Роль: ${target.role}`);
    }
    renderDeveloperPanel();
};

window.clearAllSecurityLogs = function() {
    localStorage.setItem('dev_security_logs', '[]');
    renderDeveloperPanel();
};

// =========================================================================
// ВІДМАЛЬОВКА ПАНЕЛІ РОЗРОБНИКА (5 ВКЛАДОК + ГРАФІКИ + БЕКАП JSON)
// =========================================================================

window.renderDeveloperPanel = function() {
    ensureDevPanelHeaderButtons();

    const container = getDevPanelContainer();
    if (!container) return;

    const passwords = getSystemPasswords();
    const secCfg = getRoleSecurityConfig();
    const users = getManagedUsers();
    const bannedCount = users.filter(u => u.status === 'banned').length;
    const logs = JSON.parse(localStorage.getItem('dev_security_logs') || '[]');
    const safeCars = (typeof carsData !== 'undefined' && Array.isArray(carsData))
        ? carsData.filter(c => !(typeof isItemDestroyed === 'function' && isItemDestroyed(c.note)))
        : [];
    const storageStats = getStorageStats();

    let roleTime = { user: 476, moderator: 30, admin: 355, developer: 11726 };
    try {
        const storedTime = JSON.parse(localStorage.getItem('dev_role_time_stats') || 'null');
        if (storedTime && typeof storedTime === 'object') {
            roleTime = {
                user: Number(storedTime.user) || 0,
                moderator: Number(storedTime.moderator) || 0,
                admin: Number(storedTime.admin) || 0,
                developer: Number(storedTime.developer) || 0
            };
        }
    } catch (e) {}

    const maxTimeVal = Math.max(60, roleTime.user, roleTime.moderator, roleTime.admin, roleTime.developer);
    const barHeight = (val) => Math.max(24, Math.round((val / maxTimeVal) * 190));

    const subTabBtnStyle = (tabKey) => {
        const active = currentDevSubTab === tabKey;
        return `
            background: ${active ? '#8e44ad' : '#34495e'};
            color: #ffffff;
            border: none;
            padding: 9px 16px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: bold;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            box-shadow: ${active ? '0 3px 10px rgba(142, 68, 173, 0.35)' : 'none'};
        `;
    };

    let subTabContentHtml = '';

    if (currentDevSubTab === 'dashboard') {
        subTabContentHtml = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 20px;">
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                    <div style="font-size: 13px; color: #64748b; font-weight: bold; margin-bottom: 8px;">Активні сесії / Профілі</div>
                    <div style="font-size: 28px; font-weight: 800; color: #27ae60;">${users.length}</div>
                </div>
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                    <div style="font-size: 13px; color: #64748b; font-weight: bold; margin-bottom: 8px;">Заблоковані (Юзери / IP)</div>
                    <div style="font-size: 28px; font-weight: 800; color: #e74c3c;">${bannedCount}</div>
                </div>
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                    <div style="font-size: 13px; color: #64748b; font-weight: bold; margin-bottom: 8px;">Автомобілів у базі</div>
                    <div style="font-size: 28px; font-weight: 800; color: #2980b9;">${safeCars.length}</div>
                </div>
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                    <div style="font-size: 13px; color: #64748b; font-weight: bold; margin-bottom: 8px;">Періодів / Пам'ять</div>
                    <div style="font-size: 22px; font-weight: 800; color: #8e44ad;">${storageStats.periodsCount} пер. (${storageStats.kb} КБ)</div>
                </div>
            </div>

            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
                    <div style="font-size: 15px; font-weight: bold; color: #2c3e50;">📈 Аналітика завантаженості та часу роботи ролей у системі</div>
                    <button onclick="resetRoleTimeStats()" style="background: #ecf0f1; color: #2c3e50; border: 1px solid #bdc3c7; padding: 5px 12px; border-radius: 5px; font-size: 12px; cursor: pointer; font-weight: bold;">Скинути час</button>
                </div>

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; align-items: end; height: 235px; padding: 20px 16px 0 16px; border-left: 2px solid #2c3e50; border-bottom: 2px solid #2c3e50;">
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <div style="font-size: 11px; font-weight: bold; color: #2980b9; margin-bottom: 5px;">${formatRoleDuration(roleTime.user)}</div>
                        <div style="width: 100%; height: ${barHeight(roleTime.user)}px; background: #3498db; border-radius: 6px 6px 0 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 6px; color: #fff; font-weight: bold; font-size: 12px;">Юзери</div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <div style="font-size: 11px; font-weight: bold; color: #27ae60; margin-bottom: 5px;">${formatRoleDuration(roleTime.moderator)}</div>
                        <div style="width: 100%; height: ${barHeight(roleTime.moderator)}px; background: #2ecc71; border-radius: 6px 6px 0 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 6px; color: #fff; font-weight: bold; font-size: 12px;">Модератори</div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <div style="font-size: 11px; font-weight: bold; color: #c0392b; margin-bottom: 5px;">${formatRoleDuration(roleTime.admin)}</div>
                        <div style="width: 100%; height: ${barHeight(roleTime.admin)}px; background: #e74c3c; border-radius: 6px 6px 0 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 6px; color: #fff; font-weight: bold; font-size: 12px;">Адміни</div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <div style="font-size: 11px; font-weight: bold; color: #8e44ad; margin-bottom: 5px;">${formatRoleDuration(roleTime.developer)}</div>
                        <div style="width: 100%; height: ${barHeight(roleTime.developer)}px; background: #9b59b6; border-radius: 6px 6px 0 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 6px; color: #fff; font-weight: bold; font-size: 12px;">Розробник</div>
                    </div>
                </div>
                <div style="text-align: center; font-size: 12px; color: #7f8c8d; margin-top: 8px;">Розподіл активності ролей у системі обліку</div>
            </div>
        `;
    } else if (currentDevSubTab === 'passwords') {
        subTabContentHtml = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px;">
                    <h3 style="margin: 0 0 14px 0; color: #2c3e50; font-size: 16px;">🔑 Системні паролі кабінетів</h3>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div>
                            <label style="font-size: 12px; font-weight: bold; color: #34495e; display: block; margin-bottom: 4px;">Пароль Модератора:</label>
                            <div style="display: flex; gap: 6px;">
                                <input type="password" id="dev-inp-pwd-mod" value="${passwords.moderator}" style="flex: 1; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px;">
                                <button type="button" onclick="togglePasswordVisibility('dev-inp-pwd-mod', this)" style="padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc; cursor: pointer;">👁️</button>
                            </div>
                        </div>
                        <div>
                            <label style="font-size: 12px; font-weight: bold; color: #34495e; display: block; margin-bottom: 4px;">Пароль Адміна:</label>
                            <div style="display: flex; gap: 6px;">
                                <input type="password" id="dev-inp-pwd-admin" value="${passwords.admin}" style="flex: 1; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px;">
                                <button type="button" onclick="togglePasswordVisibility('dev-inp-pwd-admin', this)" style="padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc; cursor: pointer;">👁️</button>
                            </div>
                        </div>
                        <div>
                            <label style="font-size: 12px; font-weight: bold; color: #34495e; display: block; margin-bottom: 4px;">Пароль Розробника:</label>
                            <div style="display: flex; gap: 6px;">
                                <input type="password" id="dev-inp-pwd-dev" value="${passwords.developer}" style="flex: 1; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px;">
                                <button type="button" onclick="togglePasswordVisibility('dev-inp-pwd-dev', this)" style="padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc; cursor: pointer;">👁️</button>
                            </div>
                        </div>
                        <button type="button" onclick="saveDevSystemPasswords()" style="background: #27ae60; color: #fff; border: none; padding: 10px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 6px;">💾 Зберегти паролі</button>
                    </div>
                </div>

                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px;">
                    <h3 style="margin: 0 0 14px 0; color: #2c3e50; font-size: 16px;">🛡️ Блокування доступу та права ролей</h3>
                    <div style="display: flex; flex-direction: column; gap: 14px; font-size: 14px; color: #2c3e50;">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" ${secCfg.lockModerator ? 'checked' : ''} onchange="toggleDevSecurityFlag('lockModerator', this.checked)" style="width: 18px; height: 18px;">
                            <span>⛔ Тимчасово заблокувати вхід у кабінет <b>Модератора</b></span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" ${secCfg.lockAdmin ? 'checked' : ''} onchange="toggleDevSecurityFlag('lockAdmin', this.checked)" style="width: 18px; height: 18px;">
                            <span>⛔ Тимчасово заблокувати вхід у кабінет <b>Адміна</b></span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" ${secCfg.moderatorCanEditReport ? 'checked' : ''} onchange="toggleDevSecurityFlag('moderatorCanEditReport', this.checked)" style="width: 18px; height: 18px;">
                            <span>✏️ Дозволити <b>Модератору</b> редагувати таблицю «Звіт (10 днів)»</span>
                        </label>
                    </div>
                </div>
            </div>
        `;
    } else if (currentDevSubTab === 'users') {
        subTabContentHtml = `
            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px;">
                <h3 style="margin: 0 0 14px 0; color: #2c3e50; font-size: 16px;">👥 Управління користувачами та персональними PIN-паролями</h3>
                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1;">
                    <input type="text" id="dev-new-user-name" placeholder="ПІБ або Позивний..." style="flex: 1; min-width: 180px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px;">
                    <input type="text" id="dev-new-user-sub" placeholder="Підрозділ (напр. РМТЗ)..." style="width: 180px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px;">
                    <select id="dev-new-user-role" style="padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px;">
                        <option value="user">Юзер</option>
                        <option value="moderator">Модератор</option>
                        <option value="admin">Адмін</option>
                    </select>
                    <input type="text" id="dev-new-user-pin" placeholder="Персональний пароль..." style="width: 170px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px;">
                    <button type="button" onclick="addNewManagedUser()" style="background: #27ae60; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">+ Додати</button>
                </div>

                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="background: #34495e; color: #fff;">
                                <th style="padding: 10px; border: 1px solid #cbd5e1;">ID</th>
                                <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left;">Користувач</th>
                                <th style="padding: 10px; border: 1px solid #cbd5e1;">Підрозділ</th>
                                <th style="padding: 10px; border: 1px solid #cbd5e1;">Роль</th>
                                <th style="padding: 10px; border: 1px solid #cbd5e1;">PIN / Пароль</th>
                                <th style="padding: 10px; border: 1px solid #cbd5e1;">Статус</th>
                                <th style="padding: 10px; border: 1px solid #cbd5e1;">Дії</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(u => `
                                <tr style="background: ${u.status === 'banned' ? '#fff5f5' : '#fff'};">
                                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">${u.id}</td>
                                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: bold; text-align: left;">${u.name}</td>
                                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">${u.subdivision || '—'}</td>
                                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">${getRoleDisplayName(u.role)}</td>
                                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">
                                        <span id="pin-span-${u.id}" data-visible="0">••••••</span>
                                        <button type="button" onclick="toggleTablePinVisibility('pin-span-${u.id}', '${u.pin || '—'}', this)" style="margin-left: 6px; border: none; background: transparent; cursor: pointer;">👁️</button>
                                    </td>
                                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">
                                        <span style="padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background: ${u.status === 'banned' ? '#fee2e2' : '#dcfce7'}; color: ${u.status === 'banned' ? '#b91c1c' : '#15803d'};">
                                            ${u.status === 'banned' ? '🚫 Заблокований' : '✅ Активний'}
                                        </span>
                                    </td>
                                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">
                                        <button type="button" onclick="toggleBanManagedUser(${u.id})" style="background: ${u.status === 'banned' ? '#27ae60' : '#e67e22'}; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; margin-right: 4px;">
                                            ${u.status === 'banned' ? 'Розблокувати' : 'Бан'}
                                        </button>
                                        <button type="button" onclick="deleteManagedUser(${u.id})" style="background: #e74c3c; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">🗑️</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else if (currentDevSubTab === 'logs') {
        subTabContentHtml = `
            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                    <h3 style="margin: 0; color: #2c3e50; font-size: 16px;">⚠️ Журнал подій безпеки та імпорту/експорту (${logs.length})</h3>
                    <button type="button" onclick="clearAllSecurityLogs()" style="background: #e74c3c; color: #fff; border: none; padding: 7px 14px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer;">🗑️ Очистити логи</button>
                </div>
                <div style="max-height: 420px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
                    ${logs.length === 0 ? `<div style="padding: 20px; text-align: center; color: #7f8c8d;">Журнал подій порожній.</div>` : logs.map(l => `
                        <div style="padding: 10px 14px; border-radius: 6px; border-left: 4px solid ${l.type === 'danger' ? '#e74c3c' : (l.type === 'warning' ? '#f39c12' : (l.type === 'success' ? '#27ae60' : '#3498db'))}; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                            <div>
                                <div style="font-weight: bold; font-size: 13px; color: #2c3e50;">${l.title}</div>
                                <div style="font-size: 12px; color: #64748b;">${l.details || ''}</div>
                            </div>
                            <div style="font-size: 11px; color: #94a3b8; white-space: nowrap;">${l.time || ''}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else if (currentDevSubTab === 'database') {
        subTabContentHtml = `
            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px;">
                <h3 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 17px;">💾 Резервне копіювання (Експорт та Імпорт файлів JSON)</h3>
                <p style="margin: 0 0 18px 0; font-size: 13px; color: #64748b;">
                    Ви можете зберегти всю базу даних (автомобілі, маршрути за всі періоди, звіти, генератори, шаблони та документи А4) у файл <b>.json</b> або завантажити збережені файли <b>.json</b> назад у систему.
                </p>
                <div style="display: flex; gap: 14px; flex-wrap: wrap; align-items: center; padding: 18px; background: #f8fafc; border: 1px dashed #94a3b8; border-radius: 10px;">
                    <button type="button" onclick="exportFullDatabaseBackup()" style="background: #27ae60; color: #fff; border: none; padding: 12px 20px; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
                        📥 Скачати Повний Бекап Бази (.JSON)
                    </button>
                    <button type="button" onclick="triggerImportBackupFile()" style="background: #e67e22; color: #fff; border: none; padding: 12px 20px; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
                        📤 Імпортувати Бекап із файлу (.JSON)
                    </button>
                    <span style="font-size: 12px; color: #475569;">
                        Розділів у пам'яті: <b>${storageStats.keysCount}</b> | Загальний обсяг: <b>${storageStats.kb} КБ</b>
                    </span>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 18px;">
            <button type="button" onclick="switchDevSubTab('dashboard')" style="${subTabBtnStyle('dashboard')}">
                📊 Статистика та графіки
            </button>
            <button type="button" onclick="switchDevSubTab('passwords')" style="${subTabBtnStyle('passwords')}">
                🔑 Паролі та Ролі (Адмін / Модер)
            </button>
            <button type="button" onclick="switchDevSubTab('users')" style="${subTabBtnStyle('users')}">
                👥 Користувачі та Бани (${users.length} / 🚫 ${bannedCount})
            </button>
            <button type="button" onclick="switchDevSubTab('logs')" style="${subTabBtnStyle('logs')}">
                ⚠️ Попередження і Логи (${logs.length})
            </button>
            <button type="button" onclick="switchDevSubTab('database')" style="${subTabBtnStyle('database')}">
                💾 База даних та Бекап
            </button>
        </div>

        ${subTabContentHtml}
    `;
};

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        ensureDevPanelHeaderButtons();
        updateRoleUI();
        renderDeveloperPanel();
    }, 150);
});