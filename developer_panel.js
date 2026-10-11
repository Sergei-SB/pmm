// =========================================================================
// ФІНАЛЬНИЙ КОД developer_panel.js
// (ПАРОЛІ ПІД ЗІРОЧКАМИ З "ОКОМ" 👁️, КНОПКИ РОЛЕЙ, ФІЛЬТР НОМЕРІВ, ПАНЕЛЬ РОЗРОБНИКА)
// =========================================================================

let currentDevSubTab = 'dashboard';

if (typeof window.isDeveloperLoggedIn === 'undefined') {
    window.isDeveloperLoggedIn = false;
}

// Функція перемикання видимості пароля (зірочки <-> текст)
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

// Перемикання видимості пароля у таблиці користувачів
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

// --- 1. ПАРОЛІ ТА НАЛАШТУВАННЯ БЕЗПЕКИ ---
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

// --- 2. РОЗУМНА ФІЛЬТРАЦІЯ НОМЕРІВ АВТО ПО ОБРАНОМУ ПІДРОЗДІЛУ ---
window.syncPlateDropdownWithSubdivision = function() {
    const subSelect = document.getElementById('subdivision-filter');
    const plateSelect = document.getElementById('plate-filter');
    if (!plateSelect || typeof carsData === 'undefined' || !Array.isArray(carsData)) return;

    const selectedSub = subSelect ? subSelect.value : 'all';
    const currentPlateVal = plateSelect.value || 'all';
    const activeCat = (typeof currentCategoryFilter !== 'undefined') ? currentCategoryFilter : 'all';

    const filteredCars = carsData.filter(car => {
        if (selectedSub !== 'all' && (car.subdivision || '').trim() !== selectedSub) {
            return false;
        }
        if (activeCat !== 'all') {
            const catKey = (typeof resolveCarCategoryKey === 'function')
                ? resolveCarCategoryKey(car)
                : (car.category || 'passenger');
            if (catKey !== activeCat) return false;
        }
        return true;
    });

    const uniquePlates = [];
    filteredCars.forEach(car => {
        const p = (car.plate || '').trim();
        if (p && !uniquePlates.includes(p)) {
            uniquePlates.push(p);
        }
    });

    plateSelect.innerHTML = `<option value="all">Усі</option>` +
        uniquePlates.map(p => `<option value="${p}">${p}</option>`).join('');

    if (currentPlateVal !== 'all' && uniquePlates.includes(currentPlateVal)) {
        plateSelect.value = currentPlateVal;
    } else {
        plateSelect.value = 'all';
    }
};

window.populatePlateFilter = function() {
    window.syncPlateDropdownWithSubdivision();
};

// --- 3. ПЕРЕМИКАННЯ РОЛЕЙ ---
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

// --- 4. ОНОВЛЕННЯ ІНТЕРФЕЙСУ, КНОПОК МЕНЮ ТА КОЛОНКИ "ЗВІТ" ---
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

    // Керування кнопками верхнього меню
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

        if (id === 'nav-btn-dev-panel' || txt.includes('Панель розробника') || id === 'nav-btn-documents' || txt.includes('Документи')) {
            btn.style.display = isDev ? 'inline-block' : 'none';
        } else if (role === 'user') {
            btn.style.display = isAllowedForUser ? 'inline-block' : 'none';
        } else if (role === 'moderator') {
            btn.style.display = isAllowedForModerator ? 'inline-block' : 'none';
        } else {
            btn.style.display = 'inline-block';
        }
    });

    if (role === 'user') {
        const allowedViewsForUser = ['cars-view', 'car-card-view', 'aggregates-calc-view', 'aggregates-view'];
        document.querySelectorAll('.view-section').forEach(sec => {
            if (sec.style.display !== 'none' && !allowedViewsForUser.includes(sec.id)) {
                if (typeof switchTab === 'function') switchTab('cars');
            }
        });
    } else if (role === 'moderator') {
        const allowedViewsForMod = ['cars-view', 'car-card-view', 'report-view', 'aggregates-calc-view', 'aggregates-view'];
        document.querySelectorAll('.view-section').forEach(sec => {
            if (sec.style.display !== 'none' && !allowedViewsForMod.includes(sec.id)) {
                if (typeof switchTab === 'function') switchTab('cars');
            }
        });
    } else if (!isDev) {
        const devContainer = getDevPanelContainer();
        if (devContainer && devContainer.style.display !== 'none') {
            if (typeof switchTab === 'function') switchTab('cars');
        }
        const docContainer = document.getElementById('documents-view');
        if (docContainer && docContainer.style.display !== 'none') {
            if (typeof switchTab === 'function') switchTab('cars');
        }
    }

    // Повне приховування колонки "Звіт" у Реєстрі авто для Юзера та Модератора
    const carsTbodyEl = document.getElementById('cars-tbody');
    const carsTableEl = carsTbodyEl ? carsTbodyEl.closest('table') : document.querySelector('#cars-view table');

    if (carsTableEl) {
        const allHeaderRows = carsTableEl.querySelectorAll('thead tr, tr');
        let reportColIndex = -1;

        if (allHeaderRows.length > 0) {
            const headerCells = allHeaderRows[0].children;
            for (let i = 0; i < headerCells.length; i++) {
                const cellText = (headerCells[i].textContent || '').trim();
                if (cellText === 'Звіт') {
                    reportColIndex = i;
                    if (isAdminOrHigher) {
                        headerCells[i].style.removeProperty('display');
                    } else {
                        headerCells[i].style.setProperty('display', 'none', 'important');
                    }
                }
            }
        }

        if (carsTbodyEl) {
            const bodyRows = carsTbodyEl.querySelectorAll('tr');
            bodyRows.forEach(tr => {
                if (reportColIndex !== -1 && tr.children[reportColIndex]) {
                    if (isAdminOrHigher) {
                        tr.children[reportColIndex].style.removeProperty('display');
                    } else {
                        tr.children[reportColIndex].style.setProperty('display', 'none', 'important');
                    }
                }
                const btns = tr.querySelectorAll('button');
                btns.forEach(b => {
                    if ((b.textContent || '').trim() === 'Звіт' || (b.getAttribute('onclick') || '').includes('openCarDetails')) {
                        const td = b.closest('td');
                        if (td) {
                            if (isAdminOrHigher) {
                                td.style.removeProperty('display');
                            } else {
                                td.style.setProperty('display', 'none', 'important');
                            }
                        }
                    }
                });
            });
        }
    }

    const addCarBtn = document.querySelector('#cars-view .action-bar .btn-green');
    if (addCarBtn) {
        addCarBtn.style.display = isAdminOrHigher ? "inline-block" : "none";
    }

    const deleteActionHeader = document.getElementById("delete-action-header");
    if (deleteActionHeader) {
        if (isAdminOrHigher) {
            deleteActionHeader.style.removeProperty('display');
        } else {
            deleteActionHeader.style.setProperty('display', 'none', 'important');
        }
    }

    const deleteCells = document.querySelectorAll('#cars-tbody .delete-cell');
    deleteCells.forEach(cell => {
        if (isAdminOrHigher) {
            cell.style.removeProperty('display');
        } else {
            cell.style.setProperty('display', 'none', 'important');
        }
    });

    const registryInputs = document.querySelectorAll('#cars-tbody input, #cars-tbody select');
    registryInputs.forEach(el => {
        el.disabled = !isAdminOrHigher;
    });

    const saveCardBtn = document.querySelector('#car-card-view .card-panel .btn-blue');
    if (saveCardBtn) {
        saveCardBtn.style.display = isAdminOrHigher ? "block" : "none";
    }

    const clearRoutesBtn = document.querySelector('#car-card-view .routes-panel .btn-red');
    if (clearRoutesBtn) {
        clearRoutesBtn.style.display = isAdminOrHigher ? "inline-block" : "none";
    }

    const addPeriodBtn = document.getElementById("btn-add-period");
    if (addPeriodBtn) {
        addPeriodBtn.style.display = isDev ? "inline-block" : "none";
    }
    const delPeriodBtn = document.getElementById("btn-del-period");
    if (delPeriodBtn) {
        delPeriodBtn.style.display = isDev ? "inline-block" : "none";
    }

    const cardInputs = document.querySelectorAll('#car-card-view .card-panel input, #car-card-view .card-panel select');
    cardInputs.forEach(input => {
        if (input.id === "card-period-select") {
            input.disabled = false;
            return;
        }
        input.disabled = !isAdminOrHigher;
        input.style.backgroundColor = isAdminOrHigher ? "" : "#f5f5f5";
        input.style.cursor = isAdminOrHigher ? "" : "not-allowed";
    });

    const canEditReport = isAdminOrHigher || (role === "moderator" && secCfg.moderatorCanEditReport);

    const reportInputs = document.querySelectorAll('#report-tbody input.report-cell-input');
    reportInputs.forEach(input => {
        input.disabled = !canEditReport;
        input.readOnly = !canEditReport;
        input.style.backgroundColor = canEditReport ? "" : "#f0f3f4";
        input.style.cursor = canEditReport ? "text" : "not-allowed";
    });

    const reportActionButtons = document.querySelectorAll('#report-view .report-header button');
    reportActionButtons.forEach(btn => {
        const text = (btn.innerText || "").trim();
        if (text.includes("Друк") || text === "◄" || text === "►") {
            btn.style.display = "inline-block";
            btn.disabled = false;
        } else {
            btn.style.display = canEditReport ? "inline-block" : "none";
        }
    });
};

// --- 5. ПОШУК КОНТЕЙНЕРА ПАНЕЛІ РОЗРОБНИКА ---
function getDevPanelContainer() {
    let el = document.getElementById('developer-panel-view') || document.getElementById('dev-panel-view');
    if (el) return el;

    const headings = document.querySelectorAll('h1, h2, h3');
    for (const h of headings) {
        if ((h.innerText || '').includes('Панель управління та безпеки Розробника')) {
            const sec = h.closest('.view-section') || h.parentElement?.parentElement;
            if (sec) return sec;
        }
    }
    return null;
}

window.refreshDevPanelData = function() {
    renderDeveloperPanel();
};

// --- 6. ДАНІ КОРИСТУВАЧІВ ТА ІНСТРУМЕНТИ ПАНЕЛІ РОЗРОБНИКА ---
function getManagedUsers() {
    const defaultUsers = [
        {
            id: 1,
            name: "Головний Розробник",
            subdivision: "Штаб / ІТ",
            role: "developer",
            pin: "02031985",
            ip: "192.168.1.10",
            status: "active",
            banReason: "",
            lastSeen: "Онлайн"
        },
        {
            id: 2,
            name: "Черговий Адмін ПММ",
            subdivision: "Служба ПММ",
            role: "admin",
            pin: "4343",
            ip: "192.168.1.25",
            status: "active",
            banReason: "",
            lastSeen: "Сьогодні"
        },
        {
            id: 3,
            name: "Модератор Звітів",
            subdivision: "1БрОП",
            role: "moderator",
            pin: "2121",
            ip: "192.168.1.42",
            status: "active",
            banReason: "",
            lastSeen: "Сьогодні"
        },
        {
            id: 4,
            name: "Оператор обліку (Юзер)",
            subdivision: "БТрО",
            role: "user",
            pin: "",
            ip: "192.168.1.88",
            status: "active",
            banReason: "",
            lastSeen: "Вчора"
        }
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

function saveManagedUsers(users) {
    localStorage.setItem('dev_managed_users', JSON.stringify(users));
}

function getBannedIPs() {
    try {
        return JSON.parse(localStorage.getItem('dev_banned_ips') || '[]');
    } catch (e) {
        return [];
    }
}

function saveBannedIPs(ips) {
    localStorage.setItem('dev_banned_ips', JSON.stringify(ips));
}

function formatDuration(seconds) {
    const sec = Math.max(0, Number(seconds) || 0);
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (hrs > 0) return `${hrs} год ${mins} хв ${s} с`;
    if (mins > 0) return `${mins} хв ${s} с`;
    return `${s} сек`;
}

function getStorageSizeKB() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k) || '';
        total += (k.length + v.length) * 2;
    }
    return (total / 1024).toFixed(1);
}

// --- 7. ВІДМАЛЬОВКА ПАНЕЛІ РОЗРОБНИКА ---
window.renderDeveloperPanel = function() {
    const container = getDevPanelContainer();
    if (!container) return;

    const users = getManagedUsers();
    const bannedUsersCount = users.filter(u => u.status === 'banned').length;
    const bannedIPs = getBannedIPs();
    const logs = JSON.parse(localStorage.getItem('dev_security_logs') || '[]');
    const dangerLogsCount = logs.filter(l => l.type === 'danger' || l.type === 'warning').length;

    const tabBtnStyle = (tabKey) => {
        const active = currentDevSubTab === tabKey;
        return `
            padding: 10px 16px;
            border: none;
            border-radius: 7px;
            font-weight: bold;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: ${active ? 'linear-gradient(135deg, #8e44ad, #6c3483)' : '#34495e'};
            color: white;
            box-shadow: ${active ? '0 4px 10px rgba(142,68,173,0.4)' : 'none'};
        `;
    };

    container.innerHTML = `
        <div style="background: #eef2f5; border-radius: 10px; padding: 16px;">
            <div style="background: #dfe6e9; border: 1px solid #bdc3c7; color: #2c3e50; padding: 16px 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
                <h2 style="margin: 0; font-size: 20px; display: flex; align-items: center; gap: 10px; color: #2c3e50;">
                    ⚙️ Окрема Панель управління та безпеки Розробника
                </h2>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button onclick="renderDeveloperPanel()" style="background: #2980b9; color: white; border: none; padding: 9px 15px; border-radius: 6px; cursor: pointer; font-weight: bold;">
                        🔄 Оновити дані
                    </button>
                    <button onclick="exportFullDatabaseBackup()" style="background: #27ae60; color: white; border: none; padding: 9px 15px; border-radius: 6px; cursor: pointer; font-weight: bold;">
                        📥 Скачати Бекап Бази
                    </button>
                </div>
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 2px solid #cfd8dc;">
                <button style="${tabBtnStyle('dashboard')}" onclick="switchDevSubTab('dashboard')">
                    📊 Статистика та графіки
                </button>
                <button style="${tabBtnStyle('passwords')}" onclick="switchDevSubTab('passwords')">
                    🔑 Паролі та Ролі (Адмін / Модер)
                </button>
                <button style="${tabBtnStyle('users')}" onclick="switchDevSubTab('users')">
                    👥 Користувачі та Бани (${users.length} / 🚫${bannedUsersCount + bannedIPs.length})
                </button>
                <button style="${tabBtnStyle('logs')}" onclick="switchDevSubTab('logs')">
                    ⚠️ Попередження і Логи (${dangerLogsCount})
                </button>
                <button style="${tabBtnStyle('database')}" onclick="switchDevSubTab('database')">
                    💾 База даних та Бекап
                </button>
            </div>

            <div id="dev-subtab-content">
                ${renderDevSubTabContent()}
            </div>
        </div>
    `;
};

window.switchDevSubTab = function(tabName) {
    currentDevSubTab = tabName;
    renderDeveloperPanel();
};

function renderDevSubTabContent() {
    if (currentDevSubTab === 'dashboard') return renderDevDashboardTab();
    if (currentDevSubTab === 'passwords') return renderDevPasswordsTab();
    if (currentDevSubTab === 'users') return renderDevUsersTab();
    if (currentDevSubTab === 'logs') return renderDevLogsTab();
    if (currentDevSubTab === 'database') return renderDevDatabaseTab();
    return renderDevDashboardTab();
}

function renderDevDashboardTab() {
    const users = getManagedUsers();
    const activeUsers = users.filter(u => u.status === 'active').length;
    const bannedUsers = users.filter(u => u.status === 'banned').length;
    const bannedIPs = getBannedIPs();

    const carsCount = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData.length : 0;
    const periodsCount = (typeof getSortedPeriods === 'function') ? getSortedPeriods().length : 1;
    const timeStats = JSON.parse(localStorage.getItem('dev_role_time_stats') || '{"user":120,"moderator":45,"admin":90,"developer":150}');

    const maxTime = Math.max(10, timeStats.user || 1, timeStats.moderator || 1, timeStats.admin || 1, timeStats.developer || 1);
    const barHeight = (val) => Math.max(24, Math.round(((val || 0) / maxTime) * 180));

    return `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 18px;">
            <div style="background: white; padding: 18px; border-radius: 10px; border: 1px solid #e0e0e0; text-align: center;">
                <div style="color: #7f8c8d; font-size: 14px; font-weight: bold;">Активні сесії / Профілі</div>
                <div style="font-size: 30px; font-weight: bold; color: #27ae60; margin-top: 8px;">${activeUsers}</div>
            </div>

            <div style="background: white; padding: 18px; border-radius: 10px; border: 1px solid #e0e0e0; text-align: center;">
                <div style="color: #7f8c8d; font-size: 14px; font-weight: bold;">Заблоковані (Юзери / IP)</div>
                <div style="font-size: 30px; font-weight: bold; color: #e74c3c; margin-top: 8px;">${bannedUsers + bannedIPs.length}</div>
            </div>

            <div style="background: white; padding: 18px; border-radius: 10px; border: 1px solid #e0e0e0; text-align: center;">
                <div style="color: #7f8c8d; font-size: 14px; font-weight: bold;">Автомобілів у базі</div>
                <div style="font-size: 30px; font-weight: bold; color: #2980b9; margin-top: 8px;">${carsCount}</div>
            </div>

            <div style="background: white; padding: 18px; border-radius: 10px; border: 1px solid #e0e0e0; text-align: center;">
                <div style="color: #7f8c8d; font-size: 14px; font-weight: bold;">Періодів / Пам'ять</div>
                <div style="font-size: 24px; font-weight: bold; color: #8e44ad; margin-top: 10px;">${periodsCount} пер. (${getStorageSizeKB()} КБ)</div>
            </div>
        </div>

        <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 16px;">
                <h3 style="margin: 0; color: #2c3e50; font-size: 16px;">📈 Аналітика завантаженості та часу роботи ролей у системі</h3>
                <button onclick="resetRoleTimeStats()" style="background: #ecf0f1; color: #2c3e50; border: 1px solid #bdc3c7; padding: 5px 12px; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: bold;">
                    Скинути час
                </button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; align-items: end; min-height: 210px; padding: 20px 10px 0 10px; border-left: 2px solid #2c3e50; border-bottom: 2px solid #2c3e50;">
                <div style="text-align: center;">
                    <div style="font-size: 12px; font-weight: bold; color: #2980b9; margin-bottom: 6px;">${formatDuration(timeStats.user)}</div>
                    <div style="height: ${barHeight(timeStats.user)}px; background: #3498db; border-radius: 6px 6px 0 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 10px; color: white; font-weight: bold; font-size: 13px;">
                        Юзери
                    </div>
                </div>

                <div style="text-align: center;">
                    <div style="font-size: 12px; font-weight: bold; color: #16a085; margin-bottom: 6px;">${formatDuration(timeStats.moderator)}</div>
                    <div style="height: ${barHeight(timeStats.moderator)}px; background: #2ecc71; border-radius: 6px 6px 0 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 10px; color: white; font-weight: bold; font-size: 13px;">
                        Модератори
                    </div>
                </div>

                <div style="text-align: center;">
                    <div style="font-size: 12px; font-weight: bold; color: #c0392b; margin-bottom: 6px;">${formatDuration(timeStats.admin)}</div>
                    <div style="height: ${barHeight(timeStats.admin)}px; background: #e74c3c; border-radius: 6px 6px 0 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 10px; color: white; font-weight: bold; font-size: 13px;">
                        Адміни
                    </div>
                </div>

                <div style="text-align: center;">
                    <div style="font-size: 12px; font-weight: bold; color: #8e44ad; margin-bottom: 6px;">${formatDuration(timeStats.developer)}</div>
                    <div style="height: ${barHeight(timeStats.developer)}px; background: #9b59b6; border-radius: 6px 6px 0 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 10px; color: white; font-weight: bold; font-size: 13px;">
                        Розробник
                    </div>
                </div>
            </div>
            <div style="text-align: center; color: #7f8c8d; font-size: 12px; margin-top: 10px;">
                Розподіл активності ролей у системі обліку
            </div>
        </div>
    `;
}

window.resetRoleTimeStats = function() {
    localStorage.setItem('dev_role_time_stats', JSON.stringify({ user: 0, moderator: 0, admin: 0, developer: 0 }));
    addSecurityLog('info', 'Скинуто статистику часу ролей', 'Виконано Розробником');
    renderDeveloperPanel();
};

// ВКЛАДКА 2: ПАРОЛІ ПІД ЗІРОЧКАМИ + ОКО 👁️ СПРАВА
function renderDevPasswordsTab() {
    const passwords = getSystemPasswords();
    const secCfg = getRoleSecurityConfig();

    const eyeBtnStyle = `
        position: absolute;
        right: 6px;
        top: 50%;
        transform: translateY(-50%);
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 5px;
        padding: 4px 10px;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
    `;

    return `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 18px;">
            <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0;">
                <h3 style="margin: 0 0 12px 0; color: #2c3e50; font-size: 16px;">🔑 Зміна паролів на Адмін, Модератор, Розробник</h3>
                <p style="font-size: 12px; color: #7f8c8d; margin-bottom: 16px;">
                    Паролі приховані під зірочками. Натисніть на око <b>👁️</b> справа, щоб переглянути або відредагувати пароль.
                </p>

                <div style="margin-bottom: 14px;">
                    <label style="display:block; font-weight:bold; font-size:13px; color:#16a085; margin-bottom:5px;">
                        Пароль кабінету «Модератор»:
                    </label>
                    <div style="position: relative; display: flex; align-items: center;">
                        <input type="password" id="dev-pwd-moderator" value="${passwords.moderator}" style="width:100%; padding:9px 48px 9px 12px; border:1px solid #bdc3c7; border-radius:6px; font-weight:bold; font-size:15px; box-sizing:border-box; letter-spacing:2px;">
                        <button type="button" onclick="togglePasswordVisibility('dev-pwd-moderator', this)" style="${eyeBtnStyle}" title="Показати / Сховати пароль">👁️</button>
                    </div>
                </div>

                <div style="margin-bottom: 14px;">
                    <label style="display:block; font-weight:bold; font-size:13px; color:#e74c3c; margin-bottom:5px;">
                        Пароль кабінету «Адмін»:
                    </label>
                    <div style="position: relative; display: flex; align-items: center;">
                        <input type="password" id="dev-pwd-admin" value="${passwords.admin}" style="width:100%; padding:9px 48px 9px 12px; border:1px solid #bdc3c7; border-radius:6px; font-weight:bold; font-size:15px; box-sizing:border-box; letter-spacing:2px;">
                        <button type="button" onclick="togglePasswordVisibility('dev-pwd-admin', this)" style="${eyeBtnStyle}" title="Показати / Сховати пароль">👁️</button>
                    </div>
                </div>

                <div style="margin-bottom: 18px;">
                    <label style="display:block; font-weight:bold; font-size:13px; color:#8e44ad; margin-bottom:5px;">
                        Пароль кабінету «Розробник»:
                    </label>
                    <div style="position: relative; display: flex; align-items: center;">
                        <input type="password" id="dev-pwd-developer" value="${passwords.developer}" style="width:100%; padding:9px 48px 9px 12px; border:1px solid #bdc3c7; border-radius:6px; font-weight:bold; font-size:15px; box-sizing:border-box; letter-spacing:2px;">
                        <button type="button" onclick="togglePasswordVisibility('dev-pwd-developer', this)" style="${eyeBtnStyle}" title="Показати / Сховати пароль">👁️</button>
                    </div>
                </div>

                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button onclick="saveSystemPasswordsFromPanel()" style="background:#27ae60; color:white; border:none; padding:10px 18px; border-radius:6px; cursor:pointer; font-weight:bold; flex:1;">
                        💾 Зберегти паролі
                    </button>
                    <button onclick="resetSystemPasswordsToDefault()" style="background:#95a5a6; color:white; border:none; padding:10px 14px; border-radius:6px; cursor:pointer; font-weight:bold;">
                        Стандартні (2121 / 4343)
                    </button>
                </div>
            </div>

            <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0;">
                <h3 style="margin: 0 0 12px 0; color: #2c3e50; font-size: 16px;">🛡️ Блокування кабінетів та Дозволи</h3>
                <p style="font-size: 12px; color: #7f8c8d; margin-bottom: 16px;">
                    Тимчасове закриття доступу до кабінетів (для Розробника вхід завжди відкритий).
                </p>

                <div style="display:flex; flex-direction:column; gap:12px;">
                    <label style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:${secCfg.lockAdmin ? '#fdedec' : '#f8f9fa'}; border:1px solid ${secCfg.lockAdmin ? '#e74c3c' : '#e0e0e0'}; border-radius:8px; cursor:pointer;">
                        <div>
                            <div style="font-weight:bold; color:#c0392b;">🚫 Заблокувати кабінет «Адмін»</div>
                            <div style="font-size:11px; color:#7f8c8d;">Тимчасово заборонити вхід усім Адмінам</div>
                        </div>
                        <input type="checkbox" id="cfg-lock-admin" ${secCfg.lockAdmin ? 'checked' : ''} onchange="saveRoleSecurityConfigFromPanel()" style="width:20px; height:20px; cursor:pointer;">
                    </label>

                    <label style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:${secCfg.lockModerator ? '#fdedec' : '#f8f9fa'}; border:1px solid ${secCfg.lockModerator ? '#e74c3c' : '#e0e0e0'}; border-radius:8px; cursor:pointer;">
                        <div>
                            <div style="font-weight:bold; color:#16a085;">🚫 Заблокувати кабінет «Модератор»</div>
                            <div style="font-size:11px; color:#7f8c8d;">Тимчасово заборонити вхід усім Модераторам</div>
                        </div>
                        <input type="checkbox" id="cfg-lock-moderator" ${secCfg.lockModerator ? 'checked' : ''} onchange="saveRoleSecurityConfigFromPanel()" style="width:20px; height:20px; cursor:pointer;">
                    </label>

                    <label style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:${secCfg.moderatorCanEditReport ? '#e8f8f5' : '#f8f9fa'}; border:1px solid ${secCfg.moderatorCanEditReport ? '#1abc9c' : '#e0e0e0'}; border-radius:8px; cursor:pointer;">
                        <div>
                            <div style="font-weight:bold; color:#2c3e50;">✏️ Дозволити Модератору редагувати «Звіт (10 днів)»</div>
                            <div style="font-size:11px; color:#7f8c8d;">Якщо вимкнено — Модератор може лише переглядати</div>
                        </div>
                        <input type="checkbox" id="cfg-mod-edit-report" ${secCfg.moderatorCanEditReport ? 'checked' : ''} onchange="saveRoleSecurityConfigFromPanel()" style="width:20px; height:20px; cursor:pointer;">
                    </label>
                </div>
            </div>
        </div>
    `;
}

window.saveSystemPasswordsFromPanel = function() {
    const modPwd = document.getElementById('dev-pwd-moderator')?.value.trim();
    const admPwd = document.getElementById('dev-pwd-admin')?.value.trim();
    const devPwd = document.getElementById('dev-pwd-developer')?.value.trim();

    if (!modPwd || !admPwd || !devPwd) {
        alert("Паролі не можуть бути порожніми!");
        return;
    }

    localStorage.setItem('dev_system_passwords', JSON.stringify({
        moderator: modPwd,
        admin: admPwd,
        developer: devPwd
    }));

    addSecurityLog('warning', 'Змінено системні паролі ролей', 'Паролі кабінетів оновлено Розробником');
    alert("✅ Нові паролі успішно збережено!");
    renderDeveloperPanel();
};

window.resetSystemPasswordsToDefault = function() {
    if (!confirm("Скинути паролі до стандартних?")) return;
    localStorage.removeItem('dev_system_passwords');
    addSecurityLog('info', 'Скинуто паролі до стандартних', 'Виконано Розробником');
    renderDeveloperPanel();
};

window.saveRoleSecurityConfigFromPanel = function() {
    const cfg = {
        lockAdmin: !!document.getElementById('cfg-lock-admin')?.checked,
        lockModerator: !!document.getElementById('cfg-lock-moderator')?.checked,
        moderatorCanEditReport: !!document.getElementById('cfg-mod-edit-report')?.checked
    };
    localStorage.setItem('dev_role_security_config', JSON.stringify(cfg));
    addSecurityLog('info', 'Оновлено налаштування доступу ролей', JSON.stringify(cfg));
    updateRoleUI();
    renderDeveloperPanel();
};

function renderDevUsersTab() {
    const users = getManagedUsers();
    const bannedIPs = getBannedIPs();

    const roleBadge = (role) => {
        if (role === 'developer') return `<span style="background:#8e44ad; color:white; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold;">Розробник</span>`;
        if (role === 'admin') return `<span style="background:#e74c3c; color:white; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold;">Адмін</span>`;
        if (role === 'moderator') return `<span style="background:#16a085; color:white; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold;">Модератор</span>`;
        return `<span style="background:#3498db; color:white; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold;">Юзер</span>`;
    };

    const rowsHtml = users.map(u => {
        const isBanned = u.status === 'banned';
        const pinCellHtml = u.pin
            ? `<div style="display:inline-flex; align-items:center; gap:6px;">
                <span id="user-pin-span-${u.id}" data-visible="0" style="font-family:monospace; font-weight:bold; letter-spacing:1px;">••••••</span>
                <button type="button" onclick="toggleTablePinVisibility('user-pin-span-${u.id}', '${u.pin}', this)" style="background:#ecf0f1; border:1px solid #bdc3c7; border-radius:4px; padding:2px 6px; cursor:pointer; font-size:12px;" title="Показати / Сховати пароль">👁️</button>
               </div>`
            : `<span style="color:#95a5a6;">Загальний</span>`;

        return `
            <tr style="background: ${isBanned ? '#fff5f5' : 'white'}; border-bottom: 1px solid #ecf0f1;">
                <td style="padding:10px; font-weight:bold; color:#2c3e50;">${u.name}</td>
                <td style="padding:10px;">${u.subdivision || '-'}</td>
                <td style="padding:10px; text-align:center;">${roleBadge(u.role)}</td>
                <td style="padding:10px; text-align:center;">${pinCellHtml}</td>
                <td style="padding:10px; text-align:center; font-family:monospace;">${u.ip || '-'}</td>
                <td style="padding:10px; text-align:center;">
                    ${isBanned
                        ? `<span style="background:#e74c3c; color:white; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:bold;">🚫 ЗАБАНЕНИЙ (${u.banReason || 'Блок'})</span>`
                        : `<span style="background:#2ecc71; color:white; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:bold;">✅ Активний</span>`
                    }
                </td>
                <td style="padding:10px; text-align:center; white-space:nowrap;">
                    <button onclick="openEditManagedUserModal(${u.id})" style="background:#3498db; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold; margin-right:4px;">
                        ✏️ Редагувати
                    </button>
                    ${u.role !== 'developer' ? `
                        <button onclick="toggleBanManagedUser(${u.id})" style="background:${isBanned ? '#27ae60' : '#e67e22'}; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold; margin-right:4px;">
                            ${isBanned ? '✅ Розбанити' : '🚫 Забанити'}
                        </button>
                        <button onclick="deleteManagedUser(${u.id})" style="background:#e74c3c; color:white; border:none; padding:5px 9px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;">
                            🗑️
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0; margin-bottom: 18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
                <div>
                    <h3 style="margin:0; color:#2c3e50; font-size:16px;">👥 Керування Адмінами, Модераторами та Юзерами</h3>
                    <div style="font-size:12px; color:#7f8c8d;">Редагування ролей, персональних паролів, бан та розбан користувачів</div>
                </div>
                <button onclick="openEditManagedUserModal(null)" style="background:#27ae60; color:white; border:none; padding:9px 16px; border-radius:6px; cursor:pointer; font-weight:bold;">
                    ➕ Додати користувача
                </button>
            </div>

            <div class="table-container" style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                        <tr style="background:#2c3e50; color:white;">
                            <th style="padding:10px; text-align:left;">ПІБ / Позивний</th>
                            <th style="padding:10px; text-align:left;">Підрозділ</th>
                            <th style="padding:10px; text-align:center;">Роль</th>
                            <th style="padding:10px; text-align:center;">Персональний пароль</th>
                            <th style="padding:10px; text-align:center;">IP-адреса</th>
                            <th style="padding:10px; text-align:center;">Статус</th>
                            <th style="padding:10px; text-align:center;">Дії</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        </div>

        <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0;">
            <h3 style="margin:0 0 10px 0; color:#2c3e50; font-size:16px;">🌐 Блокування за IP-адресою</h3>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px;">
                <input type="text" id="new-ban-ip-input" placeholder="Введіть IP (напр. 192.168.1.99)" style="padding:8px 12px; border:1px solid #bdc3c7; border-radius:6px; width:240px;">
                <input type="text" id="new-ban-ip-reason" placeholder="Причина блокування..." style="padding:8px 12px; border:1px solid #bdc3c7; border-radius:6px; flex:1; min-width:180px;">
                <button onclick="addBannedIPFromPanel()" style="background:#e74c3c; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:bold;">
                    🚫 Заблокувати IP
                </button>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${bannedIPs.length === 0
                    ? `<div style="color:#7f8c8d; font-size:13px;">Заблокованих IP немає.</div>`
                    : bannedIPs.map((item, idx) => `
                        <div style="background:#fdedec; border:1px solid #e74c3c; color:#c0392b; padding:6px 12px; border-radius:6px; font-size:12px; display:flex; align-items:center; gap:8px;">
                            <strong>${item.ip}</strong> (${item.reason || 'Блок'})
                            <button onclick="removeBannedIP(${idx})" style="background:#27ae60; color:white; border:none; padding:2px 7px; border-radius:4px; cursor:pointer; font-size:11px;">Розбанити</button>
                        </div>
                    `).join('')
                }
            </div>
        </div>
    `;
}

window.openEditManagedUserModal = function(userId) {
    const users = getManagedUsers();
    const existing = userId ? users.find(u => u.id === userId) : null;

    const old = document.getElementById('dev-user-edit-modal');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dev-user-edit-modal';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:99999;';

    overlay.innerHTML = `
        <div style="background:white; padding:24px; border-radius:10px; width:400px; max-width:94%; box-shadow:0 10px 30px rgba(0,0,0,0.3);">
            <h3 style="margin:0 0 16px 0; color:#2c3e50;">${existing ? '✏️ Редагувати користувача' : '➕ Новий користувач'}</h3>
            
            <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:4px;">ПІБ або Позивний:</label>
            <input type="text" id="modal-u-name" value="${existing ? existing.name : ''}" placeholder="Напр. Іваненко / Сокіл" style="width:100%; padding:8px; margin-bottom:12px; border:1px solid #ccc; border-radius:5px; box-sizing:border-box;">

            <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:4px;">Підрозділ:</label>
            <input type="text" id="modal-u-sub" value="${existing ? existing.subdivision : ''}" placeholder="Напр. РМТЗ, БПЛА, ВТО" style="width:100%; padding:8px; margin-bottom:12px; border:1px solid #ccc; border-radius:5px; box-sizing:border-box;">

            <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:4px;">Роль у системі:</label>
            <select id="modal-u-role" style="width:100%; padding:8px; margin-bottom:12px; border:1px solid #ccc; border-radius:5px; box-sizing:border-box; font-weight:bold;">
                <option value="user" ${existing?.role === 'user' ? 'selected' : ''}>Юзер</option>
                <option value="moderator" ${existing?.role === 'moderator' ? 'selected' : ''}>Модератор</option>
                <option value="admin" ${existing?.role === 'admin' ? 'selected' : ''}>Адмін</option>
                <option value="developer" ${existing?.role === 'developer' ? 'selected' : ''}>Розробник</option>
            </select>

            <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:4px;">Персональний пароль (необов'язково):</label>
            <div style="position:relative; display:flex; align-items:center; margin-bottom:12px;">
                <input type="password" id="modal-u-pin" value="${existing ? (existing.pin || '') : ''}" placeholder="Індивідуальний пароль" style="width:100%; padding:8px 42px 8px 8px; border:1px solid #ccc; border-radius:5px; box-sizing:border-box;">
                <button type="button" onclick="togglePasswordVisibility('modal-u-pin', this)" style="position:absolute; right:5px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; padding:3px 8px; cursor:pointer;">👁️</button>
            </div>

            <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:4px;">IP-адреса:</label>
            <input type="text" id="modal-u-ip" value="${existing ? (existing.ip || '192.168.1.50') : '192.168.1.' + Math.floor(Math.random() * 200 + 20)}" style="width:100%; padding:8px; margin-bottom:18px; border:1px solid #ccc; border-radius:5px; box-sizing:border-box;">

            <div style="display:flex; gap:10px;">
                <button onclick="saveManagedUserFromModal(${userId ? userId : 'null'})" style="flex:1; background:#27ae60; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold;">Зберегти</button>
                <button onclick="document.getElementById('dev-user-edit-modal').remove()" style="flex:1; background:#95a5a6; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold;">Скасувати</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
};

window.saveManagedUserFromModal = function(userId) {
    const name = document.getElementById('modal-u-name')?.value.trim();
    const subdivision = document.getElementById('modal-u-sub')?.value.trim();
    const role = document.getElementById('modal-u-role')?.value || 'user';
    const pin = document.getElementById('modal-u-pin')?.value.trim();
    const ip = document.getElementById('modal-u-ip')?.value.trim();

    if (!name) {
        alert("Вкажіть ПІБ або позивний користувача!");
        return;
    }

    const users = getManagedUsers();
    if (userId) {
        const idx = users.findIndex(u => u.id === userId);
        if (idx !== -1) {
            users[idx] = Object.assign({}, users[idx], { name, subdivision, role, pin, ip });
        }
        addSecurityLog('info', `Відредаговано профіль: ${name}`, `Роль: ${role}, Підрозділ: ${subdivision}`);
    } else {
        users.push({
            id: Date.now(),
            name,
            subdivision,
            role,
            pin,
            ip,
            status: 'active',
            banReason: '',
            lastSeen: 'Щойно доданий'
        });
        addSecurityLog('success', `Додано користувача: ${name}`, `Роль: ${role}`);
    }

    saveManagedUsers(users);
    document.getElementById('dev-user-edit-modal')?.remove();
    renderDeveloperPanel();
};

window.toggleBanManagedUser = function(userId) {
    const users = getManagedUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (user.status === 'banned') {
        user.status = 'active';
        user.banReason = '';
        addSecurityLog('success', `Розбанено користувача: ${user.name}`, `Роль: ${user.role}`);
    } else {
        const reason = prompt(`Вкажіть причину бану для "${user.name}":`, "Порушення правил ведення звітності");
        if (reason === null) return;
        user.status = 'banned';
        user.banReason = reason.trim() || 'Заблоковано Розробником';
        addSecurityLog('danger', `Забанено користувача: ${user.name}`, `Причина: ${user.banReason}`);
    }

    saveManagedUsers(users);
    renderDeveloperPanel();
};

window.deleteManagedUser = function(userId) {
    const users = getManagedUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return;
    if (!confirm(`Видалити користувача "${user.name}" зі списку?`)) return;

    saveManagedUsers(users.filter(u => u.id !== userId));
    addSecurityLog('warning', `Видалено користувача: ${user.name}`, `Роль: ${user.role}`);
    renderDeveloperPanel();
};

window.addBannedIPFromPanel = function() {
    const ip = document.getElementById('new-ban-ip-input')?.value.trim();
    const reason = document.getElementById('new-ban-ip-reason')?.value.trim() || 'Блокування безпеки';
    if (!ip) {
        alert("Введіть IP-адресу!");
        return;
    }
    const list = getBannedIPs();
    list.push({ ip, reason, date: new Date().toLocaleDateString('uk-UA') });
    saveBannedIPs(list);
    addSecurityLog('danger', `Заблоковано IP: ${ip}`, `Причина: ${reason}`);
    renderDeveloperPanel();
};

window.removeBannedIP = function(index) {
    const list = getBannedIPs();
    const removed = list.splice(index, 1);
    saveBannedIPs(list);
    if (removed[0]) addSecurityLog('info', `Розблоковано IP: ${removed[0].ip}`, '');
    renderDeveloperPanel();
};

function renderDevLogsTab() {
    const logs = JSON.parse(localStorage.getItem('dev_security_logs') || '[]');

    const badgeForType = (t) => {
        if (t === 'danger') return `<span style="background:#e74c3c; color:white; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:bold;">🚨 ТРИВОГА</span>`;
        if (t === 'warning') return `<span style="background:#f39c12; color:white; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:bold;">⚠️ УВАГА</span>`;
        if (t === 'success') return `<span style="background:#27ae60; color:white; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:bold;">✅ УСПІШНО</span>`;
        return `<span style="background:#3498db; color:white; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:bold;">ℹ️ ІНФО</span>`;
    };

    return `
        <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
                <div>
                    <h3 style="margin:0; color:#2c3e50; font-size:16px;">⚠️ Журнал безпеки та спроб входу</h3>
                    <div style="font-size:12px; color:#7f8c8d;">Усі входи, неправильні паролі, зміни ролей та блокування</div>
                </div>
                <button onclick="clearSecurityLogs()" style="background:#e74c3c; color:white; border:none; padding:8px 14px; border-radius:6px; cursor:pointer; font-weight:bold;">
                    🗑️ Очистити журнал
                </button>
            </div>

            ${logs.length === 0
                ? `<div style="padding:25px; text-align:center; color:#7f8c8d;">Журнал подій порожній.</div>`
                : `<div style="max-height:420px; overflow-y:auto; border:1px solid #ecf0f1; border-radius:8px;">
                    <table style="width:100%; border-collapse:collapse; font-size:13px;">
                        <thead>
                            <tr style="background:#34495e; color:white;">
                                <th style="padding:10px; text-align:left; width:160px;">Час</th>
                                <th style="padding:10px; text-align:center; width:110px;">Рівень</th>
                                <th style="padding:10px; text-align:left;">Подія</th>
                                <th style="padding:10px; text-align:left;">Деталі</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${logs.map(l => `
                                <tr style="border-bottom:1px solid #ecf0f1; background:${l.type === 'danger' ? '#fff5f5' : 'white'};">
                                    <td style="padding:9px 10px; color:#7f8c8d; font-family:monospace;">${l.time}</td>
                                    <td style="padding:9px 10px; text-align:center;">${badgeForType(l.type)}</td>
                                    <td style="padding:9px 10px; font-weight:bold; color:#2c3e50;">${l.title}</td>
                                    <td style="padding:9px 10px; color:#555;">${l.details || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`
            }
        </div>
    `;
}

window.clearSecurityLogs = function() {
    if (!confirm("Очистити весь журнал подій безпеки?")) return;
    localStorage.setItem('dev_security_logs', '[]');
    renderDeveloperPanel();
};

function renderDevDatabaseTab() {
    return `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap:18px;">
            <div style="background:white; padding:20px; border-radius:10px; border:1px solid #e0e0e0;">
                <h3 style="margin:0 0 10px 0; color:#2c3e50; font-size:16px;">💾 Повний Бекап та Відновлення системи</h3>
                <p style="font-size:12px; color:#7f8c8d; margin-bottom:16px;">
                    Збережіть повну копію бази даних у файл <b>.json</b> або завантажте раніше збережений файл.
                </p>

                <button onclick="exportFullDatabaseBackup()" style="width:100%; background:#27ae60; color:white; border:none; padding:12px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px; margin-bottom:14px;">
                    📥 Завантажити повну копію бази (.JSON)
                </button>

                <div style="border-top:1px dashed #ccc; padding-top:14px;">
                    <label style="display:block; font-weight:bold; font-size:13px; color:#2c3e50; margin-bottom:8px;">
                        📤 Відновити базу даних із файлу (.JSON):
                    </label>
                    <input type="file" id="dev-restore-file-input" accept=".json" onchange="importFullDatabaseBackup(event)" style="width:100%; padding:8px; border:1px solid #bdc3c7; border-radius:6px; background:#f8f9fa; box-sizing:border-box;">
                </div>
            </div>

            <div style="background:white; padding:20px; border-radius:10px; border:1px solid #e0e0e0;">
                <h3 style="margin:0 0 10px 0; color:#c0392b; font-size:16px;">🧹 Службове очищення розділів</h3>
                <p style="font-size:12px; color:#7f8c8d; margin-bottom:16px;">
                    Точкове очищення окремих журналів без видалення автомобілів.
                </p>

                <div style="display:flex; flex-direction:column; gap:10px;">
                    <button onclick="clearOnlyBroadcastMail()" style="background:#f39c12; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold; text-align:left;">
                        ✉️ Очистити всі листи внутрішньої пошти
                    </button>
                    <button onclick="clearAllSavedReports10Days()" style="background:#e67e22; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold; text-align:left;">
                        📋 Очистити збережені ручні дані «Звіту (10 днів)»
                    </button>
                </div>
            </div>
        </div>
    `;
}

window.exportFullDatabaseBackup = function() {
    const dump = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) dump[key] = localStorage.getItem(key);
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `fuel_system_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    addSecurityLog('success', 'Створено резервну копію бази (Backup)', `Файл: fuel_system_backup_${dateStr}.json`);
};

window.importFullDatabaseBackup = function(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!confirm("Відновити базу даних із вибраного файлу? Поточні дані будуть замінені!")) {
        event.target.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data || typeof data !== 'object') throw new Error("Невірний формат файлу");
            Object.keys(data).forEach(k => localStorage.setItem(k, data[k]));
            alert("✅ Базу даних успішно відновлено! Зараз сторінка оновиться.");
            location.reload();
        } catch (err) {
            alert("❌ Помилка читання файлу: " + err.message);
        }
    };
    reader.readAsText(file);
};

window.clearOnlyBroadcastMail = function() {
    if (!confirm("Видалити всі повідомлення внутрішньої пошти?")) return;
    localStorage.removeItem('system_broadcast_messages_v1');
    addSecurityLog('warning', 'Очищено внутрішню пошту', 'Виконано Розробником');
    alert("Пошту очищено!");
    renderDeveloperPanel();
};

window.clearAllSavedReports10Days = function() {
    if (!confirm("Очистити всі збережені записи у розділі «Звіт (10 днів)»?")) return;
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('report_data_')) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    addSecurityLog('warning', 'Очищено дані «Звіту (10 днів)»', `Видалено періодів: ${keysToRemove.length}`);
    alert("Дані «Звіту (10 днів)» очищено!");
    renderDeveloperPanel();
};

// --- 8. АВТОМАТИЧНА ІНІЦІАЛІЗАЦІЯ ---
document.addEventListener("DOMContentLoaded", () => {
    const subSelect = document.getElementById('subdivision-filter');
    if (subSelect) {
        subSelect.addEventListener('change', () => {
            window.syncPlateDropdownWithSubdivision();
            if (typeof renderCarsTable === 'function') {
                renderCarsTable();
            }
        });
    }

    document.addEventListener("click", (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const txt = (btn.innerText || '').trim();
        if (btn.id === 'nav-btn-dev-panel' || txt.includes('Панель розробника') || txt.includes('Оновити дані')) {
            setTimeout(renderDeveloperPanel, 30);
        }
        if (btn.classList.contains('filter-btn') || btn.closest('.category-filters')) {
            setTimeout(window.syncPlateDropdownWithSubdivision, 20);
        }
    });

    const carsTbody = document.getElementById('cars-tbody');
    if (carsTbody) {
        const obs = new MutationObserver(() => {
            updateRoleUI();
        });
        obs.observe(carsTbody, { childList: true });
    }

    setTimeout(() => {
        window.syncPlateDropdownWithSubdivision();
        updateRoleUI();
        renderDeveloperPanel();
    }, 150);
});