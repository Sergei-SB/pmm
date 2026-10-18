// =========================================================================
// ФІНАЛЬНИЙ КОД developer_panel.js (З ПОВНИМ ЕКСПОРТОМ ТА ІМПОРТОМ БЕКАПІВ JSON)
// =========================================================================

let currentDevSubTab = 'dashboard';

window.isDeveloperLoggedIn = (localStorage.getItem('isDeveloperLoggedIn') === 'true') ||
    (localStorage.getItem('app_current_role') === 'developer') ||
    (localStorage.getItem('currentRole') === 'developer') || false;

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

// =========================================================================
// ДЕТАЛЬНА МАТРИЦЯ ПРАВ ТА ДОСТУПУ ДО СТОРІНОК (dev_page_permissions_matrix_v1)
// =========================================================================

const DEFAULT_PAGE_PERMISSIONS_MATRIX = {
    base: {
        id: "base",
        name: "База (Реєстр авто)",
        desc: "Реєстр авто, пошук, фільтрація категорій, характеристики",
        icon: "🚗",
        admin: { access: true, view: true, edit: true },
        moderator: { access: true, view: true, edit: false },
        user: { access: true, view: true, edit: false }
    },
    card: {
        id: "card",
        name: "Картка авто та Маршрути",
        desc: "Маршрути, час, одометри, заправки, залишки палива, AdBlue",
        icon: "📋",
        admin: { access: true, view: true, edit: true },
        moderator: { access: true, view: true, edit: false },
        user: { access: true, view: true, edit: false }
    },
    car_details: {
        id: "car_details",
        name: "Детальна картка (ТТХ та Документи)",
        desc: "Характеристики авто, примітки ТО, папка документів та сканів",
        icon: "📑",
        admin: { access: true, view: true, edit: true },
        moderator: { access: false, view: false, edit: false },
        user: { access: false, view: false, edit: false }
    },
    report: {
        id: "report",
        name: "Звіт (10 днів)",
        desc: "Зведена відомість палива за декади, залишки та видача",
        icon: "📊",
        admin: { access: true, view: true, edit: true },
        moderator: { access: true, view: true, edit: false },
        user: { access: false, view: false, edit: false }
    },
    subdivisions: {
        id: "subdivisions",
        name: "Звіт по підрозділах",
        desc: "Аналітика та облік палива в розрізі військових підрозділів",
        icon: "🏢",
        admin: { access: true, view: true, edit: true },
        moderator: { access: false, view: false, edit: false },
        user: { access: false, view: false, edit: false }
    },
    equipment: {
        id: "equipment",
        name: "Облік обладнання",
        desc: "Генератори, Webasto, обігрівачі, мотопили, мотогодини",
        icon: "⚡",
        admin: { access: true, view: true, edit: true },
        moderator: { access: false, view: false, edit: false },
        user: { access: false, view: false, edit: false }
    },
    equipment_report: {
        id: "equipment_report",
        name: "Звіт по обладнанню",
        desc: "Відомість напрацювання мотогодин, палива та мастила обладнання",
        icon: "⏱️",
        admin: { access: true, view: true, edit: true },
        moderator: { access: true, view: true, edit: false },
        user: { access: false, view: false, edit: false }
    },
    aggregates_calc: {
        id: "aggregates_calc",
        name: "Розрахунок агрегатів",
        desc: "Калькулятор мотогодин, норми, збереження розрахунків",
        icon: "🧮",
        admin: { access: true, view: true, edit: true },
        moderator: { access: true, view: true, edit: true },
        user: { access: true, view: true, edit: true }
    },
    destroyed: {
        id: "destroyed",
        name: "Знищена техніка",
        desc: "Журнал знищеної та списаної техніки, відновлення техніки",
        icon: "💥",
        admin: { access: true, view: true, edit: true },
        moderator: { access: false, view: false, edit: false },
        user: { access: false, view: false, edit: false }
    },
    documents: {
        id: "documents",
        name: "Документи та Шаблони А4",
        desc: "Конструктор документів А4, шаблони, завантаження оригіналів",
        icon: "📄",
        admin: { access: true, view: true, edit: true },
        moderator: { access: false, view: false, edit: false },
        user: { access: false, view: false, edit: false }
    },
    mail: {
        id: "mail",
        name: "Системна пошта (✉️)",
        desc: "Вхідні листи керівництва, написання та відправка нових листів",
        icon: "✉️",
        admin: { access: true, view: true, edit: true },
        moderator: { access: true, view: true, edit: false },
        user: { access: true, view: true, edit: false }
    },
    header_backup: {
        id: "header_backup",
        name: "Швидкий бекап (💾 / 📂)",
        desc: "Кнопки прямого збереження та завантаження JSON у шапці сайту",
        icon: "💾",
        admin: { access: true, view: true, edit: true },
        moderator: { access: false, view: false, edit: false },
        user: { access: false, view: false, edit: false }
    }
};

const DEFAULT_GRANULAR_PERMISSIONS = {
    base_add_car: { name: "Кнопка «+ Додати автомобіль» у Базі", admin: true, moderator: false, user: false },
    base_delete_car: { name: "Кнопка видалення авто з реєстру (🗑️)", admin: true, moderator: false, user: false },
    base_report_col: { name: "Стовпчик «Звіт» у таблиці Бази авто", admin: true, moderator: false, user: false },
    base_transfer_btn: { name: "Кнопка «Перенесення даних» між авто", admin: true, moderator: false, user: false },
    card_save_btn: { name: "Кнопка «💾 Зберегти зміни» у Картці авто", admin: true, moderator: false, user: false },
    card_routes_edit: { name: "Редагування одометрів, маршрутів та палива", admin: true, moderator: false, user: false },
    card_clear_btn: { name: "Кнопка «🔄 Очистити маршрути»", admin: true, moderator: false, user: false },
    car_details_edit: { name: "Редагування ТТХ авто та приміток ТО", admin: true, moderator: false, user: false },
    car_details_docs: { name: "Завантаження та видалення документів авто", admin: true, moderator: false, user: false },
    report_edit_cells: { name: "Введення чисел у комірки «Звіт (10 днів)»", admin: true, moderator: false, user: false },
    report_save_btn: { name: "Кнопка «Зберегти» у «Звіт (10 днів)»", admin: true, moderator: false, user: false },
    eq_add_item: { name: "Додавання нового обладнання (+ Генератор/Вебасто)", admin: true, moderator: false, user: false },
    eq_edit_hours: { name: "Редагування напрацювання мотогодин обладнання", admin: true, moderator: false, user: false },
    eq_report_edit: { name: "Редагування комірок «Звіт по обладнанню»", admin: true, moderator: false, user: false },
    destroyed_restore: { name: "Відновлення знищеного авто в робочу базу", admin: true, moderator: false, user: false },
    docs_create_a4: { name: "Створення та редагування документів у Конструкторі А4", admin: true, moderator: false, user: false },
    docs_upload_file: { name: "Завантаження та видалення оригіналів документів", admin: true, moderator: false, user: false },
    mail_send_new: { name: "Написання та відправка нових листів у Пошті", admin: true, moderator: false, user: false }
};

function getPagePermissionsMatrix() {
    try {
        const raw = localStorage.getItem('dev_page_permissions_matrix_v1');
        if (!raw) return JSON.parse(JSON.stringify(DEFAULT_PAGE_PERMISSIONS_MATRIX));
        const saved = JSON.parse(raw);
        const merged = JSON.parse(JSON.stringify(DEFAULT_PAGE_PERMISSIONS_MATRIX));
        Object.keys(merged).forEach(k => {
            if (saved[k]) {
                ['admin', 'moderator', 'user'].forEach(r => {
                    if (saved[k][r]) {
                        merged[k][r] = Object.assign({}, merged[k][r], saved[k][r]);
                    }
                });
            }
        });
        return merged;
    } catch (e) {
        return JSON.parse(JSON.stringify(DEFAULT_PAGE_PERMISSIONS_MATRIX));
    }
}

function savePagePermissionsMatrix(matrix) {
    try {
        localStorage.setItem('dev_page_permissions_matrix_v1', JSON.stringify(matrix));
    } catch (e) {}
}

function getGranularPermissions() {
    try {
        const raw = localStorage.getItem('dev_granular_permissions_v1');
        if (!raw) return JSON.parse(JSON.stringify(DEFAULT_GRANULAR_PERMISSIONS));
        const saved = JSON.parse(raw);
        const merged = JSON.parse(JSON.stringify(DEFAULT_GRANULAR_PERMISSIONS));
        Object.keys(merged).forEach(k => {
            if (saved[k]) {
                ['admin', 'moderator', 'user'].forEach(r => {
                    if (typeof saved[k][r] !== 'undefined') {
                        merged[k][r] = !!saved[k][r];
                    }
                });
            }
        });
        return merged;
    } catch (e) {
        return JSON.parse(JSON.stringify(DEFAULT_GRANULAR_PERMISSIONS));
    }
}

function saveGranularPermissions(perms) {
    try {
        localStorage.setItem('dev_granular_permissions_v1', JSON.stringify(perms));
    } catch (e) {}
}

window.canRoleAccess = function(role, moduleKey) {
    if (!role || role === 'developer' || role === 'dev') return true;
    const normRole = (role === 'dev') ? 'developer' : role;
    if (normRole === 'developer') return true;
    const matrix = getPagePermissionsMatrix();
    return matrix[moduleKey]?.[normRole]?.access === true;
};

window.canRoleView = function(role, moduleKey) {
    if (!role || role === 'developer' || role === 'dev') return true;
    const normRole = (role === 'dev') ? 'developer' : role;
    if (normRole === 'developer') return true;
    const matrix = getPagePermissionsMatrix();
    return matrix[moduleKey]?.[normRole]?.view === true;
};

window.canRoleEdit = function(role, moduleKey) {
    if (!role || role === 'developer' || role === 'dev') return true;
    const normRole = (role === 'dev') ? 'developer' : role;
    if (normRole === 'developer') return true;
    const matrix = getPagePermissionsMatrix();
    if (matrix[moduleKey]?.[normRole]?.edit === true) return true;
    if (moduleKey === 'report' && normRole === 'moderator') {
        const secCfg = getRoleSecurityConfig();
        if (secCfg.moderatorCanEditReport) return true;
    }
    return false;
};

window.canRoleDo = function(role, featureKey) {
    if (!role || role === 'developer' || role === 'dev') return true;
    const normRole = (role === 'dev') ? 'developer' : role;
    if (normRole === 'developer') return true;
    const perms = getGranularPermissions();
    return perms[featureKey]?.[normRole] === true;
};

window.canCurrentRoleAccess = function(moduleKey) {
    const role = (typeof window.getCurrentAppRole === 'function')
        ? window.getCurrentAppRole()
        : ((typeof currentRole !== 'undefined') ? currentRole : 'user');
    return window.canRoleAccess(role, moduleKey);
};

window.canCurrentRoleView = function(moduleKey) {
    const role = (typeof window.getCurrentAppRole === 'function')
        ? window.getCurrentAppRole()
        : ((typeof currentRole !== 'undefined') ? currentRole : 'user');
    return window.canRoleView(role, moduleKey);
};

window.canCurrentRoleEdit = function(moduleKey) {
    const role = (typeof window.getCurrentAppRole === 'function')
        ? window.getCurrentAppRole()
        : ((typeof currentRole !== 'undefined') ? currentRole : 'user');
    return window.canRoleEdit(role, moduleKey);
};

window.canCurrentRoleDo = function(featureKey) {
    const role = (typeof window.getCurrentAppRole === 'function')
        ? window.getCurrentAppRole()
        : ((typeof currentRole !== 'undefined') ? currentRole : 'user');
    return window.canRoleDo(role, featureKey);
};

window.getModuleNameUkrainian = function(moduleKey) {
    const matrix = getPagePermissionsMatrix();
    return matrix[moduleKey]?.name || moduleKey;
};

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
        window.currentRole = role;
        currentRole = role;
        try {
            localStorage.setItem('currentRole', role);
            localStorage.setItem('app_current_role', role);
        } catch(e) {}
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
        window.currentRole = "user";
        currentRole = "user";
        try {
            localStorage.setItem('currentRole', 'user');
            localStorage.setItem('app_current_role', 'user');
        } catch(e) {}
        updateRoleUI();
        return;
    }

    if (role === "moderator") {
        showCustomPasswordModal("Введіть пароль Модератора:", (pwd) => {
            if (pwd === null) return;
            if (pwd === passwords.moderator || checkCustomUserPassword('moderator', pwd)) {
                window.currentRole = "moderator";
                currentRole = "moderator";
                try {
                    localStorage.setItem('currentRole', 'moderator');
                    localStorage.setItem('app_current_role', 'moderator');
                } catch(e) {}
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
                window.currentRole = "admin";
                currentRole = "admin";
                try {
                    localStorage.setItem('currentRole', 'admin');
                    localStorage.setItem('app_current_role', 'admin');
                } catch(e) {}
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
                window.currentRole = "developer";
                currentRole = "developer";
                window.isDeveloperLoggedIn = true;
                try {
                    localStorage.setItem('currentRole', 'developer');
                    localStorage.setItem('app_current_role', 'developer');
                    localStorage.setItem('isDeveloperLoggedIn', 'true');
                } catch(e) {}
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
    try {
        localStorage.setItem('currentRole', 'user');
        localStorage.setItem('isDeveloperLoggedIn', 'false');
    } catch(e) {}
    addSecurityLog('info', 'Вихід із режиму Розробника', 'Сесію супер-доступу завершено');
    updateRoleUI();
};

window.applyCarsReportColumnRoleStyle = function(canShowReportCol) {
    let styleEl = document.getElementById('cars-report-col-role-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'cars-report-col-role-style';
        document.head.appendChild(styleEl);
    }
    if (canShowReportCol) {
        styleEl.textContent = `
            #cars-table thead tr th:last-child,
            #cars-table tbody tr td:last-child,
            #cars-table .cars-report-col,
            #cars-report-col-th {
                display: table-cell !important;
            }
            #cars-table tbody tr td:last-child button,
            #cars-table .cars-report-col button {
                display: inline-block !important;
                visibility: visible !important;
                opacity: 1 !important;
            }
        `;
    } else {
        styleEl.textContent = `
            #cars-table thead tr th:last-child,
            #cars-table tbody tr td:last-child,
            #cars-table .cars-report-col,
            #cars-report-col-th {
                display: none !important;
            }
        `;
    }
};

window.updateRoleUI = function() {
    const role = (typeof window.getCurrentAppRole === 'function')
        ? window.getCurrentAppRole()
        : ((typeof currentRole !== 'undefined') ? currentRole : 'user');
    const isDev = (role === "developer");

    // 0. Стовпчик «Звіт» у реєстрі авто
    const showReportCol = isDev || (typeof window.canRoleDo === 'function' ? window.canRoleDo(role, 'base_report_col') : (role === 'admin'));
    window.applyCarsReportColumnRoleStyle(showReportCol);

    // Візуальне підсвічування кнопок ролей у шапці
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

    // Бейдж супер-доступу Розробника
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

    // 1. Управління видимістю кнопок навігації у шапці (ЗАХОДИТИ / ACCESS)
    const setNavBtnDisplay = (id, shouldShow, flex = false) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.style.setProperty('display', shouldShow ? (flex ? 'inline-flex' : 'inline-block') : 'none', 'important');
        }
    };

    setNavBtnDisplay("nav-btn-base", isDev || window.canRoleAccess(role, 'base'));
    setNavBtnDisplay("nav-btn-card", isDev || window.canRoleAccess(role, 'card'));
    setNavBtnDisplay("nav-btn-report", isDev || window.canRoleAccess(role, 'report'));
    setNavBtnDisplay("nav-btn-subdivisions", isDev || window.canRoleAccess(role, 'subdivisions'));
    setNavBtnDisplay("nav-btn-equipment", isDev || window.canRoleAccess(role, 'equipment'));
    setNavBtnDisplay("nav-btn-equipment-report", isDev || window.canRoleAccess(role, 'equipment_report'));
    setNavBtnDisplay("nav-btn-aggregates-calc", isDev || window.canRoleAccess(role, 'aggregates_calc'));
    setNavBtnDisplay("nav-btn-destroyed", isDev || window.canRoleAccess(role, 'destroyed'));
    setNavBtnDisplay("nav-btn-documents", isDev || window.canRoleAccess(role, 'documents'), true);
    setNavBtnDisplay("nav-btn-dev-panel", isDev);

    const faviconUploadBtn = document.getElementById("header-favicon-upload-btn");
    if (faviconUploadBtn) {
        faviconUploadBtn.style.setProperty("display", isDev ? "inline-flex" : "none", "important");
    }

    const envelopeBtn = document.getElementById("broadcast-envelope-btn");
    if (envelopeBtn) {
        envelopeBtn.style.setProperty("display", (isDev || window.canRoleAccess(role, 'mail')) ? "inline-flex" : "none", "important");
    }

    // Кнопки прямого збереження/імпорту у шапці видалено на вимогу користувача

    // 2. Безпечне перенаправлення, якщо активний розділ заборонений для поточної ролі
    const checkRedirect = (viewId, modKey) => {
        const viewEl = document.getElementById(viewId);
        if (viewEl && (viewEl.classList.contains("active") || (viewEl.style.display && viewEl.style.display !== "none"))) {
            if (!isDev && !window.canRoleAccess(role, modKey)) {
                if (typeof switchView === "function") switchView("base");
            }
        }
    };

    checkRedirect("report-view", "report");
    checkRedirect("subdivisions-view", "subdivisions");
    checkRedirect("generators-view", "equipment");
    checkRedirect("equipment-report-view", "equipment_report");
    checkRedirect("destroyed-view", "destroyed");
    checkRedirect("card-view", "card");
    checkRedirect("car-details-view", "car_details");
    checkRedirect("aggregates-calc-view", "aggregates_calc");
    checkRedirect("documents-view", "documents");

    const devPanelView = document.getElementById("dev-panel-view") || document.getElementById("developer-panel-view");
    if (devPanelView && (devPanelView.classList.contains("active") || (devPanelView.style.display && devPanelView.style.display !== "none")) && !isDev) {
        if (typeof switchView === "function") switchView("base");
    }

    const docsMainSec = document.getElementById("documents-main-section");
    const docsViewSec = document.getElementById("documents-view");
    const isDocsActive = (docsViewSec && docsViewSec.classList.contains("active")) || (docsMainSec && docsMainSec.style.display !== "none" && docsMainSec.style.display !== "");
    if (isDocsActive && !isDev && !window.canRoleAccess(role, 'documents')) {
        if (typeof closeDocumentsTabView === 'function') closeDocumentsTabView();
        if (typeof switchView === "function") switchView("base");
    }

    // 3. Управління правами РЕДАГУВАННЯ (EDIT) та ДЕТАЛЬНИМИ ФУНКЦІЯМИ

    // [БАЗА АВТО]
    const canEditBase = isDev || window.canRoleEdit(role, 'base');
    const canAddCar = isDev || (canEditBase && window.canRoleDo(role, 'base_add_car'));
    const canDeleteCar = isDev || (canEditBase && window.canRoleDo(role, 'base_delete_car'));
    const canTransfer = isDev || window.canRoleDo(role, 'base_transfer_btn');

    const addCarBtn = document.getElementById('add-car-btn');
    if (addCarBtn) {
        addCarBtn.style.setProperty('display', canAddCar ? 'inline-block' : 'none', 'important');
    }

    const deleteActionHeader = document.getElementById("delete-action-header");
    if (deleteActionHeader) {
        deleteActionHeader.style.setProperty('display', canDeleteCar ? '' : 'none', 'important');
    }
    const deleteCells = document.querySelectorAll('#cars-tbody .delete-cell');
    deleteCells.forEach(cell => {
        cell.style.setProperty('display', canDeleteCar ? '' : 'none', 'important');
    });

    const transferDataBtn = document.getElementById('transfer-data-btn');
    if (transferDataBtn) {
        transferDataBtn.style.setProperty('display', canTransfer ? 'inline-flex' : 'none', 'important');
    }

    // Стовпчик «Звіт» у Базі авто
    const carsTable = document.getElementById('cars-table');
    if (carsTable) {
        let reportColIdx = -1;
        const headers = carsTable.querySelectorAll('thead th');
        headers.forEach((th, idx) => {
            if (th.id === 'cars-report-col-th' || th.classList.contains('cars-report-col') || (th.textContent || '').trim() === 'Звіт') {
                reportColIdx = idx;
                th.style.setProperty('display', showReportCol ? 'table-cell' : 'none', 'important');
            }
        });
        const rows = carsTable.querySelectorAll('tbody tr');
        rows.forEach(tr => {
            let targetTd = tr.querySelector('.cars-report-col');
            if (!targetTd && reportColIdx >= 0 && tr.children[reportColIdx]) {
                targetTd = tr.children[reportColIdx];
            }
            if (targetTd) {
                targetTd.style.setProperty('display', showReportCol ? 'table-cell' : 'none', 'important');
                const btn = targetTd.querySelector('button');
                if (btn) {
                    btn.style.setProperty('display', showReportCol ? 'inline-block' : 'none', 'important');
                }
            }
        });
    }

    const baseTableInputs = document.querySelectorAll('#cars-tbody input, #cars-tbody select');
    baseTableInputs.forEach(inp => {
        inp.disabled = !canEditBase;
        inp.readOnly = !canEditBase;
        inp.style.backgroundColor = canEditBase ? '' : '#f5f5f5';
        inp.style.cursor = canEditBase ? '' : 'not-allowed';
    });

    // 2b. Перевірка та блокування перегляду (VIEW), якщо заборонено Розробником
    const applyViewLockBanner = (containerId, modKey, mainElementSelector) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const canView = isDev || window.canRoleView(role, modKey);
        let banner = container.querySelector('.perm-view-lock-banner');
        const mainEl = mainElementSelector ? container.querySelector(mainElementSelector) : null;
        if (!canView) {
            if (mainEl) mainEl.style.display = 'none';
            if (!banner) {
                banner = document.createElement('div');
                banner.className = 'perm-view-lock-banner';
                banner.style.cssText = 'padding: 30px; text-align: center; background: #ffffff; border-radius: 8px; border: 2px dashed #e74c3c; color: #c0392b; font-size: 15px; font-weight: bold; margin: 20px 0; box-shadow: 0 4px 12px rgba(231,76,60,0.1);';
                const modName = (typeof window.getModuleNameUkrainian === 'function') ? window.getModuleNameUkrainian(modKey) : modKey;
                banner.innerHTML = `⛔ Перегляд інформації у розділі «${modName}» заборонено Розробником для ролі «${getRoleDisplayName(role)}»!`;
                container.appendChild(banner);
            }
            banner.style.display = 'block';
        } else {
            if (mainEl) mainEl.style.removeProperty('display');
            if (banner) banner.style.display = 'none';
        }
    };

    applyViewLockBanner('base-view', 'base', '.table-container');
    applyViewLockBanner('card-view', 'card', '.car-card-container');
    applyViewLockBanner('car-details-view', 'car_details', '.card-body');
    applyViewLockBanner('report-view', 'report', '#report-table');
    applyViewLockBanner('subdivisions-view', 'subdivisions', '#subdivisions-table');
    applyViewLockBanner('generators-view', 'equipment', '#generators-tabs-container');
    applyViewLockBanner('equipment-report-view', 'equipment_report', '#equipment-report-table');
    applyViewLockBanner('aggregates-calc-view', 'aggregates_calc', '.calc-container');
    applyViewLockBanner('destroyed-view', 'destroyed', '.destroyed-table-container');
    applyViewLockBanner('documents-view', 'documents', '#documents-content-wrapper');
    applyViewLockBanner('documents-main-section', 'documents', '#documents-content-wrapper');

    // [КАРТКА АВТО ТА МАРШРУТИ]
    const canEditCard = isDev || window.canRoleEdit(role, 'card');
    const canSaveCard = isDev || (canEditCard && window.canRoleDo(role, 'card_save_btn'));
    const canClearRoutes = isDev || (canEditCard && window.canRoleDo(role, 'card_clear_btn'));
    const canEditRoutes = isDev || (canEditCard && window.canRoleDo(role, 'card_routes_edit'));

    const cardSaveBtn = document.getElementById("card-save-btn");
    if (cardSaveBtn) {
        cardSaveBtn.style.setProperty("display", canSaveCard ? "inline-flex" : "none", "important");
    }

    const clearRoutesBtns = document.querySelectorAll('#card-view .routes-panel .btn-red, #card-view button[onclick*="clearActiveCarCardRoutes"]');
    clearRoutesBtns.forEach(b => b.style.setProperty("display", canClearRoutes ? "inline-block" : "none", "important"));

    const addRouteBtn = document.querySelector('#card-view button[onclick="addRouteRow()"]');
    if (addRouteBtn) {
        addRouteBtn.style.setProperty("display", canEditRoutes ? "inline-block" : "none", "important");
    }

    const presetBtns = document.querySelectorAll('#card-view .preset-btn');
    presetBtns.forEach(pb => {
        pb.style.setProperty("display", canEditRoutes ? "inline-block" : "none", "important");
    });

    const cardInputs = document.querySelectorAll('#card-view input, #card-view select:not(#card-period-select)');
    cardInputs.forEach(input => {
        if (input.id === 'car-search-input') return;
        input.disabled = !canEditRoutes;
        input.readOnly = !canEditRoutes;
        input.style.backgroundColor = canEditRoutes ? '' : '#f5f5f5';
        input.style.cursor = canEditRoutes ? '' : 'not-allowed';
    });

    // [ДЕТАЛЬНА КАРТКА АВТО (ТТХ ТА ДОКУМЕНТИ)]
    const canEditDetails = isDev || window.canRoleEdit(role, 'car_details');
    const canEditSpecs = isDev || (canEditDetails && window.canRoleDo(role, 'car_details_edit'));
    const canManageCarDocs = isDev || (canEditDetails && window.canRoleDo(role, 'car_details_docs'));

    const detSaveBtn = document.querySelector('button[onclick="saveCarDetailsToBasePath()"]');
    if (detSaveBtn) {
        detSaveBtn.style.setProperty('display', canEditSpecs ? 'inline-block' : 'none', 'important');
    }
    const detInputs = document.querySelectorAll('#car-details-view input, #car-details-view select, #det-maintenance-note');
    detInputs.forEach(inp => {
        if (inp.id === 'car-doc-file-input') return;
        inp.disabled = !canEditSpecs;
        inp.readOnly = !canEditSpecs;
        inp.style.backgroundColor = canEditSpecs ? '' : '#f5f5f5';
        inp.style.cursor = canEditSpecs ? '' : 'not-allowed';
    });
    const fuelPillBtns = document.querySelectorAll('.fuel-select-pill');
    fuelPillBtns.forEach(fp => fp.style.setProperty('display', canEditSpecs ? 'inline-block' : 'none', 'important'));

    const carDocFileInput = document.getElementById('car-doc-file-input');
    if (carDocFileInput) {
        carDocFileInput.style.setProperty('display', canManageCarDocs ? 'inline-block' : 'none', 'important');
    }
    const carDocDelBtns = document.querySelectorAll('#car-docs-list button[onclick*="deleteCarDoc"]');
    carDocDelBtns.forEach(btn => btn.style.setProperty('display', canManageCarDocs ? 'inline-block' : 'none', 'important'));

    // [ЗВІТ 10 ДНІВ ТА ОБЛАДНАННЯ]
    if (typeof window.applyReportRolePermissions === 'function') {
        window.applyReportRolePermissions();
    }
    if (typeof applyModeratorReportLock === 'function') {
        applyModeratorReportLock();
    }
    const repSaveBtn = document.getElementById('rep-save-btn') || document.querySelector('button[onclick*="saveReportData"]');
    if (repSaveBtn) {
        const canSaveReport = isDev || (window.canRoleEdit(role, 'report') && window.canRoleDo(role, 'report_save_btn'));
        repSaveBtn.style.setProperty('display', canSaveReport ? 'inline-block' : 'none', 'important');
    }

    // [ОБЛІК ОБЛАДНАННЯ]
    const canEditEquipment = isDev || window.canRoleEdit(role, 'equipment');
    const canAddEq = isDev || (canEditEquipment && window.canRoleDo(role, 'eq_add_item'));
    const canEditEqHours = isDev || (canEditEquipment && window.canRoleDo(role, 'eq_edit_hours'));
    const eqAddBtns = document.querySelectorAll('#generators-view button[onclick*="add"], #generators-view .btn-add-item');
    eqAddBtns.forEach(btn => btn.style.setProperty('display', canAddEq ? 'inline-block' : 'none', 'important'));

    // [РОЗРАХУНОК АГРЕГАТІВ]
    const canEditAgg = isDev || window.canRoleEdit(role, 'aggregates_calc');
    const aggInputs = document.querySelectorAll('#aggregates-calc-view input, #aggregates-calc-view select');
    aggInputs.forEach(inp => {
        inp.disabled = !canEditAgg;
        inp.readOnly = !canEditAgg;
        inp.style.backgroundColor = canEditAgg ? '' : '#f5f5f5';
        inp.style.cursor = canEditAgg ? '' : 'not-allowed';
    });

    // [ЗНИЩЕНА ТЕХНІКА]
    const canRestoreDestroyed = isDev || (window.canRoleEdit(role, 'destroyed') && window.canRoleDo(role, 'destroyed_restore'));
    const restoreBtns = document.querySelectorAll('#destroyed-view button[onclick*="restoreDestroyedItemFromTable"]');
    restoreBtns.forEach(btn => btn.style.setProperty('display', canRestoreDestroyed ? 'inline-block' : 'none', 'important'));

    // [ДОКУМЕНТИ ТА ШАБЛОНИ А4]
    const canEditDocs = isDev || window.canRoleEdit(role, 'documents');
    const canCreateA4 = isDev || (canEditDocs && window.canRoleDo(role, 'docs_create_a4'));
    const canUploadDocs = isDev || (canEditDocs && window.canRoleDo(role, 'docs_upload_file'));

    const btnNewDocA4 = document.getElementById('btn-new-doc-a4') || document.querySelector('button[onclick*="createNewBlankDocument"]');
    if (btnNewDocA4) btnNewDocA4.style.setProperty('display', canCreateA4 ? 'inline-flex' : 'none', 'important');

    const btnNewTemplate = document.querySelector('button[onclick*="openTemplateEditor"]');
    if (btnNewTemplate) btnNewTemplate.style.setProperty('display', canCreateA4 ? 'inline-flex' : 'none', 'important');

    const docUploadLabel = document.querySelector('label[for="doc-upload-input"]');
    if (docUploadLabel) docUploadLabel.style.setProperty('display', canUploadDocs ? 'inline-flex' : 'none', 'important');

    const docDelBtns = document.querySelectorAll('#documents-main-section button[onclick*="deleteSavedDocument"], #documents-main-section button[onclick*="deleteDocumentById"]');
    docDelBtns.forEach(btn => btn.style.setProperty('display', canUploadDocs ? 'inline-block' : 'none', 'important'));

    // Оновлення Панелі розробника, якщо відкрита
    if (isDev) {
        ensureDevPanelHeaderButtons();
        if (typeof renderDeveloperPanel === 'function') {
            renderDeveloperPanel();
        }
    }
};

function getDevPanelContainer() {
    let el = document.getElementById('dev-panel-main-container');
    if (!el) {
        const devSec = document.getElementById('dev-panel-view') || document.getElementById('developer-panel-view');
        if (devSec) {
            el = document.createElement('div');
            el.id = 'dev-panel-main-container';
            devSec.appendChild(el);
        }
    }
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
        actionsWrap = document.createElement('div');
        actionsWrap.id = 'dev-panel-header-actions';
        actionsWrap.style.cssText = 'display: flex; gap: 10px; align-items: center; flex-wrap: wrap;';
        headerPanel.appendChild(actionsWrap);
    }

    actionsWrap.innerHTML = `
        <button class="action-btn" id="btn-dev-refresh" onclick="refreshDevPanelData()" style="background-color: #2980b9; color: #fff; font-weight: bold; padding: 8px 14px; border-radius: 6px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
            🔄 Оновити дані
        </button>
        <button class="action-btn" id="btn-dev-export" onclick="exportFullDatabaseBackup()" style="background-color: #27ae60; color: #fff; font-weight: bold; padding: 8px 14px; border-radius: 6px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
            📥 Скачати Бекап Бази
        </button>
        <button class="action-btn" id="btn-dev-import" onclick="triggerImportBackupFile()" style="background-color: #e67e22; color: #fff; font-weight: bold; padding: 8px 14px; border-radius: 6px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
            📤 Імпортувати Бекап (JSON)
        </button>
        <input type="file" id="dev-backup-import-input" accept=".json,application/json" multiple style="display: none;" onchange="handleImportBackupFiles(event)">
    `;
}

function flushAllActiveSiteChangesToStorage() {
    try {
        // 1. Зберігаємо відкриту детальну картку авто (car-details-view), якщо користувач редагував характеристики
        const detSec = document.getElementById('car-details-view');
        if (detSec && window.activeReportCarId && typeof carsData !== 'undefined' && Array.isArray(carsData)) {
            const detCar = carsData.find(c => Number(c.id) === Number(window.activeReportCarId));
            if (detCar) {
                const getVal = (id) => document.getElementById(id)?.value;
                if (getVal('det-input-model') !== undefined && getVal('det-input-model') !== '') detCar.model = getVal('det-input-model');
                if (getVal('det-input-plate') !== undefined && getVal('det-input-plate') !== '') detCar.plate = getVal('det-input-plate');
                if (getVal('det-input-subdivision') !== undefined) detCar.subdivision = getVal('det-input-subdivision');
                if (getVal('det-input-driver') !== undefined) detCar.driver = getVal('det-input-driver');
                if (getVal('det-input-vin') !== undefined) detCar.vin = getVal('det-input-vin');
                if (getVal('det-input-year') !== undefined && getVal('det-input-year') !== '') detCar.year = parseInt(getVal('det-input-year'), 10) || getVal('det-input-year');
                if (getVal('det-input-transmission') !== undefined) detCar.transmission = getVal('det-input-transmission');
                if (getVal('det-input-tank') !== undefined && getVal('det-input-tank') !== '') detCar.tankCapacity = parseFloat(getVal('det-input-tank')) || getVal('det-input-tank');
                if (getVal('det-input-drive') !== undefined) detCar.drive = getVal('det-input-drive');
                if (getVal('det-input-emptyWeight') !== undefined && getVal('det-input-emptyWeight') !== '') detCar.emptyWeight = parseFloat(getVal('det-input-emptyWeight')) || getVal('det-input-emptyWeight');
                if (getVal('det-input-totalWeight') !== undefined && getVal('det-input-totalWeight') !== '') detCar.totalWeight = parseFloat(getVal('det-input-totalWeight')) || getVal('det-input-totalWeight');
                if (getVal('det-input-gears') !== undefined && getVal('det-input-gears') !== '') detCar.gears = parseInt(getVal('det-input-gears'), 10) || getVal('det-input-gears');
                if (getVal('det-input-engine') !== undefined && getVal('det-input-engine') !== '') detCar.engineVolume = parseFloat(getVal('det-input-engine')) || getVal('det-input-engine');
                if (getVal('det-input-kw') !== undefined && getVal('det-input-kw') !== '') detCar.kw = parseFloat(getVal('det-input-kw')) || getVal('det-input-kw');
                if (getVal('det-input-engineNo') !== undefined) detCar.engineNo = getVal('det-input-engineNo');
                if (getVal('det-input-consumption') !== undefined && getVal('det-input-consumption') !== '') detCar.consumption = parseFloat(getVal('det-input-consumption')) || getVal('det-input-consumption');
            }
        }

        // 2. Зберігаємо всі автомобілі, їх номери та всі характеристики в localStorage
        if (typeof saveCarsModificationsToStorage === 'function') {
            saveCarsModificationsToStorage();
        }
        if (typeof saveCarsToStorage === 'function') {
            saveCarsToStorage();
        }
        if (typeof carsData !== 'undefined' && Array.isArray(carsData)) {
            localStorage.setItem('user_cars_database_v2', JSON.stringify(carsData));
            localStorage.setItem('cars_backup_array', JSON.stringify(carsData));
        }

        // 3. Зберігаємо поточну відкриту «Картку авто та Маршрути» (маршрути, заправки, одометри, залишки, AdBlue)
        if (typeof updateRouteTotals === 'function') {
            updateRouteTotals();
        }
        if (typeof saveCarRoutesForPeriod === 'function') {
            const activePer = (typeof getStrictActivePeriod === 'function') ? getStrictActivePeriod() : (typeof activeCarPeriod !== 'undefined' ? activeCarPeriod : '01.10-10.10');
            const activeCar = (typeof currentCarId !== 'undefined' && currentCarId) ? currentCarId : 1;
            saveCarRoutesForPeriod(activePer, activeCar);
            localStorage.setItem('last_active_car_id', String(activeCar));
            localStorage.setItem('last_active_car_period', String(activePer));
        }

        // 4. Зберігаємо всі введені комірки у вкладці «Звіт (10 днів)»
        const repInputs = document.querySelectorAll('#report-tbody input.report-cell-input');
        if (repInputs.length > 0) {
            const repPeriod = (typeof activeReportPeriod !== 'undefined' && activeReportPeriod)
                ? activeReportPeriod
                : (document.getElementById('report-period-select')?.value || '01.10-10.10');
            let repStore = {};
            try {
                const rawRep = localStorage.getItem('report_data_' + repPeriod);
                if (rawRep) repStore = JSON.parse(rawRep) || {};
            } catch (e) {}
            repInputs.forEach(inp => {
                const cId = inp.getAttribute('data-car');
                const fld = inp.getAttribute('data-field');
                if (cId && fld) {
                    if (!repStore[cId]) repStore[cId] = {};
                    repStore[cId][fld] = inp.value;
                }
            });
            localStorage.setItem('report_data_' + repPeriod, JSON.stringify(repStore));
            localStorage.setItem('last_active_report_period', String(repPeriod));
        }

        // 5. Зберігаємо стан калькулятора агрегатів та таблиць обладнання
        if (typeof window.saveAggregatesCalcStateToStorage === 'function') {
            window.saveAggregatesCalcStateToStorage();
        }
        if (typeof getGeneratorsList === 'function') getGeneratorsList();
        if (typeof getWebastoList === 'function') getWebastoList();
        if (typeof getHeatersList === 'function') getHeatersList();
        if (typeof getChainsawsList === 'function') getChainsawsList();

        // 6. Якщо відкритий конструктор документа А4 — синхронізуємо поточні блоки
        const docModal = document.getElementById('doc-editor-modal');
        if (docModal && typeof syncAllRichBlocksToState === 'function') {
            try { syncAllRichBlocksToState(); } catch (e) {}
        }
    } catch (err) {
        console.error('Помилка фіксації поточних змін перед експортом:', err);
    }
}

window.exportFullDatabaseBackup = async function() {
    try {
        // Спочатку примусово зберігаємо всі поточні зміни на всіх вкладках сайту
        flushAllActiveSiteChangesToStorage();

        // Отримуємо бінарні файли документів із IndexedDB (DocumentsFilesDB_v1)
        let idbFiles = [];
        if (typeof window.exportAllDocsFromIndexedDB === 'function') {
            try {
                idbFiles = await window.exportAllDocsFromIndexedDB();
            } catch (e) {
                idbFiles = [];
            }
        }

        // Збираємо абсолютно всі ключі з localStorage
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

        // Збираємо sessionStorage (якщо є)
        const allSessionStorage = {};
        try {
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (!key) continue;
                const rawVal = sessionStorage.getItem(key);
                try {
                    allSessionStorage[key] = JSON.parse(rawVal);
                } catch (e) {
                    allSessionStorage[key] = rawVal;
                }
            }
        } catch (e) {}

        // Якщо в IndexedDB є файли документів, вбудовуємо їх також у масив saved_documents_v2 для 100% автономності
        if (Array.isArray(idbFiles) && idbFiles.length > 0 && Array.isArray(allStorage['saved_documents_v2'])) {
            const idbMap = {};
            idbFiles.forEach(item => {
                if (item && item.id) idbMap[item.id] = item;
            });
            allStorage['saved_documents_v2'] = allStorage['saved_documents_v2'].map(doc => {
                if (doc && doc.id && idbMap[doc.id]) {
                    const bin = idbMap[doc.id];
                    return {
                        ...doc,
                        fileDataUrl: doc.fileDataUrl || bin.fileDataUrl || '',
                        extractedText: doc.extractedText || bin.extractedText || '',
                        extractedHtml: doc.extractedHtml || bin.extractedHtml || ''
                    };
                }
                return doc;
            });
        }

        // Формуємо структурований зріз усіх розділів сайту для повної прозорості та надійності
        const carRoutesByPeriod = {};
        const carHistoryByPeriod = {};
        const reports10DaysByPeriod = {};
        const carFoldersDocs = {};

        Object.keys(allStorage).forEach(k => {
            if (k.startsWith('isolated_car_routes_')) {
                carRoutesByPeriod[k] = allStorage[k];
            } else if (k.startsWith('car_history_data_')) {
                carHistoryByPeriod[k] = allStorage[k];
            } else if (k.startsWith('report_data_')) {
                reports10DaysByPeriod[k] = allStorage[k];
            } else if (k.startsWith('car_folder_')) {
                carFoldersDocs[k] = allStorage[k];
            }
        });

        const currentCarsArray = (typeof carsData !== 'undefined' && Array.isArray(carsData))
            ? carsData
            : (allStorage['user_cars_database_v2'] || allStorage['cars_backup_array'] || []);

        const backupPayload = {
            app: "Облік палива та конструктор документів А4 — Повний Бекап Сайту",
            version: "3.0-FULL",
            exportDate: new Date().toISOString(),
            exportDateLocale: new Date().toLocaleString('uk-UA'),
            summary: {
                totalLocalStorageKeys: Object.keys(allStorage).length,
                totalCars: Array.isArray(currentCarsArray) ? currentCarsArray.length : 0,
                totalCarRouteRecords: Object.keys(carRoutesByPeriod).length,
                totalReportPeriods: Object.keys(reports10DaysByPeriod).length,
                totalCarDocumentFolders: Object.keys(carFoldersDocs).length,
                totalA4Documents: Array.isArray(allStorage['saved_documents_v2']) ? allStorage['saved_documents_v2'].length : 0,
                totalIndexedDBFiles: idbFiles.length
            },
            fullSiteSnapshot: {
                carsDatabase: currentCarsArray,
                carsModifications: allStorage['cars_modifications_data'] || {},
                periodsList: allStorage['app_saved_periods_list'] || [],
                carCardsAndRoutesByPeriod: carRoutesByPeriod,
                carHistoryByPeriod: carHistoryByPeriod,
                reports10DaysByPeriod: reports10DaysByPeriod,
                carFoldersDocuments: carFoldersDocs,
                equipmentDatabase: {
                    generators: allStorage['generators_custom_data'] || [],
                    webasto: allStorage['webasto_custom_data'] || [],
                    heaters: allStorage['heaters_custom_data'] || [],
                    chainsaws: allStorage['chainsaws_custom_data'] || [],
                    equipmentPeriods: allStorage['eq_saved_periods_list'] || []
                },
                aggregatesCalculatorState: allStorage['aggregates_calc_saved_state'] || null,
                documentsA4: {
                    savedDocuments: allStorage['saved_documents_v2'] || [],
                    fragmentTemplates: allStorage['doc_fragment_templates_v1'] || {},
                    marginsMmState: allStorage['doc_margins_mm_state_v1'] || null,
                    marginsMmTemplates: allStorage['doc_margins_mm_templates_v1'] || []
                },
                systemSettingsAndMail: {
                    passwords: allStorage['dev_system_passwords'] || {},
                    roleSecurityConfig: allStorage['dev_role_security_config'] || {},
                    permissionsMatrix: allStorage['dev_page_permissions_matrix_v1'] || {},
                    granularPermissions: allStorage['dev_granular_permissions_v1'] || {},
                    managedUsers: allStorage['dev_managed_users'] || [],
                    securityLogs: allStorage['dev_security_logs'] || [],
                    roleTimeStats: allStorage['dev_role_time_stats'] || {},
                    broadcastMail: allStorage['broadcastStorageList_v2'] || []
                }
            },
            indexedDBFiles: idbFiles,
            sessionStorageData: allSessionStorage,
            localStorageData: allStorage
        };

        const jsonStr = JSON.stringify(backupPayload, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
        const a = document.createElement('a');
        a.href = url;
        a.download = `full_site_backup_${dateStamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        const s = backupPayload.summary;
        addSecurityLog(
            'info',
            'Повний експорт бекапу сайту (JSON)',
            `Авто: ${s.totalCars}, Картки/Маршрути: ${s.totalCarRouteRecords}, Звіти: ${s.totalReportPeriods}, Документи А4: ${s.totalA4Documents}, Файли авто: ${s.totalCarDocumentFolders}, Всього розділів: ${s.totalLocalStorageKeys}`
        );
        showDevNotification(
            `✅ Повний Бекап Сайту скачано!<br>Авто: <b>${s.totalCars}</b> | Маршрути/Картки: <b>${s.totalCarRouteRecords}</b> | Звіти: <b>${s.totalReportPeriods}</b> | Документи: <b>${s.totalA4Documents + s.totalCarDocumentFolders}</b>`,
            '#27ae60'
        );
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

async function applyParsedJsonToStorage(parsed) {
    if (!parsed || typeof parsed !== 'object') return 0;
    let importedKeysCount = 0;

    // 0. Відновлення бінарних файлів документів у IndexedDB (якщо присутні)
    if (Array.isArray(parsed.indexedDBFiles) && parsed.indexedDBFiles.length > 0 && typeof window.restoreAllDocsToIndexedDB === 'function') {
        try {
            await window.restoreAllDocsToIndexedDB(parsed.indexedDBFiles);
        } catch (e) {}
    }

    // Якщо в документах А4 є вбудовані fileDataUrl — також записуємо їх у IndexedDB
    const docsCandidate = parsed.fullSiteSnapshot?.documentsA4?.savedDocuments
        || parsed.localStorageData?.saved_documents_v2
        || (Array.isArray(parsed) && parsed[0] && (parsed[0].layout || String(parsed[0].id || '').startsWith('doc_')) ? parsed : null);

    if (Array.isArray(docsCandidate) && typeof window.restoreAllDocsToIndexedDB === 'function') {
        const extractedBins = docsCandidate
            .filter(d => d && d.id && (d.fileDataUrl || d.extractedText || d.extractedHtml))
            .map(d => ({
                id: d.id,
                fileDataUrl: d.fileDataUrl || '',
                extractedText: d.extractedText || '',
                extractedHtml: d.extractedHtml || ''
            }));
        if (extractedBins.length > 0) {
            try { await window.restoreAllDocsToIndexedDB(extractedBins); } catch (e) {}
        }
    }

    // Відновлення sessionStorage (якщо є)
    if (parsed.sessionStorageData && typeof parsed.sessionStorageData === 'object') {
        Object.keys(parsed.sessionStorageData).forEach(k => {
            try {
                const v = parsed.sessionStorageData[k];
                if (v !== undefined && v !== null) {
                    sessionStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
                }
            } catch (e) {}
        });
    }

    // 1. Якщо є структурований fullSiteSnapshot — відновлюємо всі його секції у localStorage
    if (parsed.fullSiteSnapshot && typeof parsed.fullSiteSnapshot === 'object') {
        const snap = parsed.fullSiteSnapshot;
        if (Array.isArray(snap.carsDatabase) && snap.carsDatabase.length > 0) {
            localStorage.setItem('user_cars_database_v2', JSON.stringify(snap.carsDatabase));
            localStorage.setItem('cars_backup_array', JSON.stringify(snap.carsDatabase));
            if (typeof carsData !== 'undefined' && Array.isArray(carsData)) {
                carsData.length = 0;
                snap.carsDatabase.forEach(c => carsData.push(c));
            }
            importedKeysCount++;
        }
        if (snap.carsModifications && typeof snap.carsModifications === 'object') {
            localStorage.setItem('cars_modifications_data', JSON.stringify(snap.carsModifications));
            importedKeysCount++;
        }
        if (Array.isArray(snap.periodsList) && snap.periodsList.length > 0) {
            localStorage.setItem('app_saved_periods_list', JSON.stringify(snap.periodsList));
            importedKeysCount++;
        }
        if (snap.carCardsAndRoutesByPeriod && typeof snap.carCardsAndRoutesByPeriod === 'object') {
            Object.entries(snap.carCardsAndRoutesByPeriod).forEach(([k, v]) => {
                localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
                importedKeysCount++;
            });
        }
        if (snap.carHistoryByPeriod && typeof snap.carHistoryByPeriod === 'object') {
            Object.entries(snap.carHistoryByPeriod).forEach(([k, v]) => {
                localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
                importedKeysCount++;
            });
        }
        if (snap.reports10DaysByPeriod && typeof snap.reports10DaysByPeriod === 'object') {
            Object.entries(snap.reports10DaysByPeriod).forEach(([k, v]) => {
                localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
                importedKeysCount++;
            });
        }
        if (snap.carFoldersDocuments && typeof snap.carFoldersDocuments === 'object') {
            Object.entries(snap.carFoldersDocuments).forEach(([k, v]) => {
                localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
                importedKeysCount++;
            });
        }
        if (snap.equipmentDatabase && typeof snap.equipmentDatabase === 'object') {
            const eq = snap.equipmentDatabase;
            if (Array.isArray(eq.generators)) localStorage.setItem('generators_custom_data', JSON.stringify(eq.generators));
            if (Array.isArray(eq.webasto)) localStorage.setItem('webasto_custom_data', JSON.stringify(eq.webasto));
            if (Array.isArray(eq.heaters)) localStorage.setItem('heaters_custom_data', JSON.stringify(eq.heaters));
            if (Array.isArray(eq.chainsaws)) localStorage.setItem('chainsaws_custom_data', JSON.stringify(eq.chainsaws));
            if (Array.isArray(eq.equipmentPeriods)) localStorage.setItem('eq_saved_periods_list', JSON.stringify(eq.equipmentPeriods));
        }
        if (snap.aggregatesCalculatorState) {
            localStorage.setItem('aggregates_calc_saved_state', JSON.stringify(snap.aggregatesCalculatorState));
        }
        if (snap.documentsA4 && typeof snap.documentsA4 === 'object') {
            if (Array.isArray(snap.documentsA4.savedDocuments)) {
                localStorage.setItem('saved_documents_v2', JSON.stringify(snap.documentsA4.savedDocuments));
            }
            if (snap.documentsA4.fragmentTemplates && typeof snap.documentsA4.fragmentTemplates === 'object') {
                localStorage.setItem('doc_fragment_templates_v1', JSON.stringify(snap.documentsA4.fragmentTemplates));
            }
            if (snap.documentsA4.marginsMmState) {
                localStorage.setItem('doc_margins_mm_state_v1', JSON.stringify(snap.documentsA4.marginsMmState));
            }
            if (Array.isArray(snap.documentsA4.marginsMmTemplates)) {
                localStorage.setItem('doc_margins_mm_templates_v1', JSON.stringify(snap.documentsA4.marginsMmTemplates));
            }
        }
    }

    // 2. Якщо це стандартний файл бекапу з полем localStorageData / localStorage / storage / data
    const storageMap = parsed.localStorageData || parsed.localStorage || parsed.storage || (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data) ? parsed.data : null);

    if (storageMap && typeof storageMap === 'object' && !Array.isArray(storageMap)) {
        Object.keys(storageMap).forEach(key => {
            const val = storageMap[key];
            if (val === undefined || val === null) return;
            const serialized = (typeof val === 'string') ? val : JSON.stringify(val);
            try {
                localStorage.setItem(key, serialized);
                importedKeysCount++;
            } catch (err) {
                // Якщо документ занадто великий для localStorage (бо містить base64 файл), зберігаємо полегшену копію в localStorage, а повний файл вже у IndexedDB
                if (key === 'saved_documents_v2' && Array.isArray(val)) {
                    try {
                        const slim = val.map(d => ({ ...d, fileDataUrl: '' }));
                        localStorage.setItem(key, JSON.stringify(slim));
                        importedKeysCount++;
                    } catch (e2) {}
                }
            }
        });

        // Синхронізуємо carsData у пам'яті з відновленими даними
        const restoredCars = storageMap['user_cars_database_v2'] || storageMap['cars_backup_array'];
        if (Array.isArray(restoredCars) && restoredCars.length > 0 && typeof carsData !== 'undefined' && Array.isArray(carsData)) {
            carsData.length = 0;
            restoredCars.forEach(c => carsData.push(c));
        }

        return importedKeysCount;
    }

    // 3. Якщо це масив документів або автомобілів
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
            localStorage.setItem('user_cars_database_v2', JSON.stringify(parsed));
            localStorage.setItem('cars_backup_array', JSON.stringify(parsed));
            return 1;
        }
        return 0;
    }

    // 4. Якщо це об'єкт шаблонів фрагментів документів (leftHeader, rightHeader, docTitle, bodyText, signers)
    if (parsed.leftHeader && parsed.rightHeader && parsed.docTitle) {
        localStorage.setItem('doc_fragment_templates_v1', JSON.stringify(parsed));
        return 1;
    }

    // 5. Якщо це прямий дамп ключів localStorage
    const metaSkipKeys = new Set(['app', 'version', 'exportDate', 'exportDateLocale', 'summary', 'fullSiteSnapshot', 'indexedDBFiles', 'sessionStorageData']);
    Object.keys(parsed).forEach(key => {
        if (metaSkipKeys.has(key)) return;
        const val = parsed[key];
        if (val === undefined || val === null) return;
        const serialized = (typeof val === 'string') ? val : JSON.stringify(val);
        try {
            localStorage.setItem(key, serialized);
            importedKeysCount++;
        } catch (e) {}
    });

    return importedKeysCount;
}

function refreshAllModulesAfterImport() {
    try {
        if (typeof window.reloadCarsFromStorage === 'function') window.reloadCarsFromStorage();
        if (typeof loadCarsModifications === 'function') loadCarsModifications();

        const savedActiveCar = localStorage.getItem('last_active_car_id');
        if (savedActiveCar && typeof carsData !== 'undefined' && Array.isArray(carsData)) {
            const exists = carsData.some(c => Number(c.id) === Number(savedActiveCar));
            if (exists) window.currentCarId = Number(savedActiveCar);
        }

        const savedActivePeriod = localStorage.getItem('last_active_car_period');
        if (savedActivePeriod && typeof activeCarPeriod !== 'undefined') {
            activeCarPeriod = savedActivePeriod;
        }

        const savedRepPeriod = localStorage.getItem('last_active_report_period');
        if (savedRepPeriod && typeof activeReportPeriod !== 'undefined') {
            activeReportPeriod = savedRepPeriod;
        }

        if (typeof initCardPeriodsSelect === 'function') initCardPeriodsSelect();
        if (typeof populatePeriodDropdown === 'function') populatePeriodDropdown(typeof activeReportPeriod !== 'undefined' ? activeReportPeriod : undefined);
        if (typeof loadCarCard === 'function' && typeof currentCarId !== 'undefined' && currentCarId) {
            loadCarCard(currentCarId);
        } else if (typeof loadCarDataForActivePeriod === 'function') {
            loadCarDataForActivePeriod();
        }
        if (typeof populateCarSelector === 'function') populateCarSelector();
        if (typeof renderCarsTable === 'function') renderCarsTable();
        if (typeof renderReportTable === 'function') renderReportTable();
        if (typeof renderSubdivisionsView === 'function') renderSubdivisionsView();
        if (typeof renderGeneratorsView === 'function') renderGeneratorsView();
        if (typeof renderWebastoView === 'function' && typeof currentEquipmentTabName !== 'undefined' && currentEquipmentTabName === 'webasto') renderWebastoView();
        if (typeof renderHeatersView === 'function' && typeof currentEquipmentTabName !== 'undefined' && currentEquipmentTabName === 'heaters') renderHeatersView();
        if (typeof renderChainsawsView === 'function' && typeof currentEquipmentTabName !== 'undefined' && currentEquipmentTabName === 'chainsaws') renderChainsawsView();
        if (typeof renderAggregatesCalcView === 'function') renderAggregatesCalcView();
        if (typeof renderDestroyedEquipmentView === 'function') renderDestroyedEquipmentView();
        if (typeof renderCarDetailsData === 'function' && window.activeReportCarId) renderCarDetailsData();
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
            const count = await applyParsedJsonToStorage(parsed);
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
        addSecurityLog('success', 'Імпорт повного бекапу бази (JSON)', `Файли: ${importedFileNames.join(', ')} (відновлено розділів: ${totalKeysRestored})`);
        refreshAllModulesAfterImport();
        showDevNotification(
            `✅ Успішно імпортовано повний бекап (${importedFileNames.join(', ')})!<br>Відновлено записів та розділів: <b>${totalKeysRestored}</b>.`,
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
        if (!stored || stored === 'undefined' || stored === 'null') {
            localStorage.setItem('dev_managed_users', JSON.stringify(defaultUsers));
            return defaultUsers;
        }
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        return defaultUsers;
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

let currentDevPermRoleFilter = 'all';

window.switchDevPermissionsFilter = function(filterRole) {
    currentDevPermRoleFilter = filterRole;
    renderDeveloperPanel();
};

window.updateRolePermissionCheckbox = function(moduleKey, targetRole, action, checked) {
    const matrix = getPagePermissionsMatrix();
    if (!matrix[moduleKey]) return;
    if (!matrix[moduleKey][targetRole]) matrix[moduleKey][targetRole] = { access: true, view: true, edit: false };
    matrix[moduleKey][targetRole][action] = !!checked;

    // Якщо увімкнено редагування, обов'язково даємо доступ і перегляд
    if (action === 'edit' && checked) {
        matrix[moduleKey][targetRole].access = true;
        matrix[moduleKey][targetRole].view = true;
    }
    // Якщо вимкнено доступ (Заходити) — обов'язково вимикаємо перегляд та редагування
    if (action === 'access' && !checked) {
        matrix[moduleKey][targetRole].view = false;
        matrix[moduleKey][targetRole].edit = false;
    }
    // Якщо вимкнено перегляд — вимикаємо редагування
    if (action === 'view' && !checked) {
        matrix[moduleKey][targetRole].edit = false;
    }
    // Якщо увімкнено перегляд — вмикаємо доступ
    if (action === 'view' && checked) {
        matrix[moduleKey][targetRole].access = true;
    }

    savePagePermissionsMatrix(matrix);
    const modName = matrix[moduleKey]?.name || moduleKey;
    const actionUa = action === 'access' ? 'Вхід (Заходити)' : (action === 'view' ? 'Перегляд' : 'Редагування');
    addSecurityLog('info', `Зміна прав: ${getRoleDisplayName(targetRole)}`, `Розділ «${modName}» -> ${actionUa}: ${checked ? 'ДОЗВОЛЕНО' : 'ЗАБОРОНЕНО'}`);
    showDevNotification(`🛡️ Оновлено: <b>${getRoleDisplayName(targetRole)}</b> | ${modName} → ${actionUa}: ${checked ? '✅ Дозволено' : '⛔ Заборонено'}`, checked ? '#27ae60' : '#e67e22');
    
    updateRoleUI();

    const scrollY = window.scrollY;
    renderDeveloperPanel();
    window.scrollTo(0, scrollY);
};

window.updateGranularPermissionCheckbox = function(featureKey, targetRole, checked) {
    const perms = getGranularPermissions();
    if (!perms[featureKey]) perms[featureKey] = { name: featureKey, admin: false, moderator: false, user: false };
    perms[featureKey][targetRole] = !!checked;
    saveGranularPermissions(perms);
    const featName = perms[featureKey]?.name || featureKey;
    addSecurityLog('info', `Функціональний дозвіл: ${getRoleDisplayName(targetRole)}`, `Дія «${featName}»: ${checked ? 'ДОЗВОЛЕНО' : 'ЗАБОРОНЕНО'}`);
    showDevNotification(`⚙️ Оновлено: <b>${getRoleDisplayName(targetRole)}</b> | ${featName}: ${checked ? '✅ Дозволено' : '⛔ Заборонено'}`, checked ? '#27ae60' : '#e67e22');
    
    updateRoleUI();

    const scrollY = window.scrollY;
    renderDeveloperPanel();
    window.scrollTo(0, scrollY);
};

window.applyRolePreset = function(presetType, targetRole) {
    const matrix = getPagePermissionsMatrix();
    const perms = getGranularPermissions();

    if (presetType === 'admin_full') {
        Object.keys(matrix).forEach(k => {
            matrix[k].admin = { access: true, view: true, edit: true };
        });
        Object.keys(perms).forEach(k => {
            perms[k].admin = true;
        });
        addSecurityLog('warning', 'Пресет прав: Адмін', 'Встановлено повний доступ до всіх сторінок та редагування');
        showDevNotification('✅ Встановлено повний доступ для ролі <b>Адмін</b>!', '#27ae60');
    } else if (presetType === 'moderator_default') {
        Object.keys(matrix).forEach(k => {
            if (['base', 'card', 'report', 'equipment_report', 'aggregates_calc', 'mail'].includes(k)) {
                matrix[k].moderator = { access: true, view: true, edit: (k === 'aggregates_calc') };
            } else {
                matrix[k].moderator = { access: false, view: false, edit: false };
            }
        });
        Object.keys(perms).forEach(k => {
            perms[k].moderator = false;
        });
        addSecurityLog('info', 'Пресет прав: Модератор', 'Відновлено стандартний профіль Модератора');
        showDevNotification('✅ Встановлено стандартні права для <b>Модератора</b>!', '#2980b9');
    } else if (presetType === 'moderator_view_all') {
        Object.keys(matrix).forEach(k => {
            matrix[k].moderator = { access: true, view: true, edit: false };
        });
        Object.keys(perms).forEach(k => {
            perms[k].moderator = false;
        });
        addSecurityLog('info', 'Пресет прав: Модератор', 'Увімкнено перегляд усіх сторінок без права редагування');
        showDevNotification('👁️ Встановлено перегляд усіх розділів для <b>Модератора</b>!', '#16a085');
    } else if (presetType === 'user_default') {
        Object.keys(matrix).forEach(k => {
            if (['base', 'card', 'aggregates_calc', 'mail'].includes(k)) {
                matrix[k].user = { access: true, view: true, edit: (k === 'aggregates_calc') };
            } else {
                matrix[k].user = { access: false, view: false, edit: false };
            }
        });
        Object.keys(perms).forEach(k => {
            perms[k].user = false;
        });
        addSecurityLog('info', 'Пресет прав: Юзер', 'Встановлено стандартні права Юзера (База, Картка, Агрегати)');
        showDevNotification('✅ Встановлено стандартні права для <b>Юзера</b>!', '#2980b9');
    } else if (presetType === 'user_view_all') {
        Object.keys(matrix).forEach(k => {
            matrix[k].user = { access: true, view: true, edit: false };
        });
        Object.keys(perms).forEach(k => {
            perms[k].user = false;
        });
        addSecurityLog('info', 'Пресет прав: Юзер', 'Відкрито доступ на перегляд усіх розділів для Юзера');
        showDevNotification('👁️ Встановлено перегляд усіх розділів для <b>Юзера</b>!', '#16a085');
    } else if (presetType === 'user_block_all') {
        Object.keys(matrix).forEach(k => {
            matrix[k].user = { access: false, view: false, edit: false };
        });
        Object.keys(perms).forEach(k => {
            perms[k].user = false;
        });
        addSecurityLog('danger', 'Пресет прав: Юзер', 'Повне блокування доступу для Юзера');
        showDevNotification('⛔ Повністю заблоковано доступ для <b>Юзера</b>!', '#e74c3c');
    } else if (presetType === 'reset_all') {
        localStorage.removeItem('dev_page_permissions_matrix_v1');
        localStorage.removeItem('dev_granular_permissions_v1');
        addSecurityLog('warning', 'Скидання матриці прав', 'Всі налаштування прав скинуто до початкових заводських');
        showDevNotification('🔄 Матрицю прав скинуто до стандартних налаштувань!', '#8e44ad');
        updateRoleUI();
        renderDeveloperPanel();
        return;
    }

    savePagePermissionsMatrix(matrix);
    saveGranularPermissions(perms);
    updateRoleUI();
    renderDeveloperPanel();
};

window.saveAllPermissionsNow = function() {
    const matrix = getPagePermissionsMatrix();
    const perms = getGranularPermissions();
    savePagePermissionsMatrix(matrix);
    saveGranularPermissions(perms);
    addSecurityLog('success', 'Фіксація прав доступу', 'Розробник зберіг поточну конфігурацію матриці прав');
    showDevNotification('💾 Всі налаштування прав успішно зафіксовано в системі!', '#27ae60');
    updateRoleUI();
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
    try {
        ensureDevPanelHeaderButtons();

        const container = getDevPanelContainer();
        if (!container) return;

        const passwords = getSystemPasswords();
        const secCfg = getRoleSecurityConfig();
        const permMatrix = getPagePermissionsMatrix();
        const granularPerms = getGranularPermissions();
        let users = [];
        try {
            users = getManagedUsers();
            if (!Array.isArray(users)) users = [];
        } catch(e) {
            users = [];
        }
        const bannedCount = users.filter(u => u && u.status === 'banned').length;

        let logs = [];
        try {
            const rawLogs = localStorage.getItem('dev_security_logs');
            if (rawLogs && rawLogs !== 'undefined' && rawLogs !== 'null') {
                const parsedLogs = JSON.parse(rawLogs);
                if (Array.isArray(parsedLogs)) logs = parsedLogs;
            }
        } catch (e) {
            logs = [];
        }

        const safeCars = (typeof carsData !== 'undefined' && Array.isArray(carsData))
            ? carsData.filter(c => c && !(typeof isItemDestroyed === 'function' && isItemDestroyed(c.note)))
            : [];
        let storageStats = { kb: '0.0', periodsCount: 1, keysCount: 0 };
        try {
            storageStats = getStorageStats();
        } catch(e) {}

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
    } else if (currentDevSubTab === 'permissions') {
        const filterBtnStyle = (roleKey) => {
            const active = currentDevPermRoleFilter === roleKey;
            return `padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; border: 1px solid ${active ? '#8e44ad' : '#cbd5e1'}; background: ${active ? '#8e44ad' : '#ffffff'}; color: ${active ? '#ffffff' : '#334155'}; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px;`;
        };

        const activeRoles = (currentDevPermRoleFilter === 'all')
            ? ['admin', 'moderator', 'user']
            : [currentDevPermRoleFilter];

        const roleColor = {
            admin: '#e74c3c',
            moderator: '#16a085',
            user: '#2980b9'
        };

        const roleBg = {
            admin: '#fef2f2',
            moderator: '#f0fdf4',
            user: '#f0f9ff'
        };

        const granularGroups = [
            {
                title: "🚗 База автомобілів (Реєстр)",
                keys: ['base_add_car', 'base_delete_car', 'base_report_col', 'base_transfer_btn']
            },
            {
                title: "📋 Картка автомобіля та Маршрути",
                keys: ['card_save_btn', 'card_routes_edit', 'card_clear_btn']
            },
            {
                title: "📑 Детальна картка (ТТХ та Документи авто)",
                keys: ['car_details_edit', 'car_details_docs']
            },
            {
                title: "📊 Звіт (10 днів)",
                keys: ['report_edit_cells', 'report_save_btn']
            },
            {
                title: "⚡ Облік обладнання та Мотогодини",
                keys: ['eq_add_item', 'eq_edit_hours', 'eq_report_edit']
            },
            {
                title: "💥 Знищена техніка",
                keys: ['destroyed_restore']
            },
            {
                title: "📄 Документи та Конструктор А4",
                keys: ['docs_create_a4', 'docs_upload_file']
            },
            {
                title: "✉️ Системна пошта",
                keys: ['mail_send_new']
            }
        ];

        subTabContentHtml = `
            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                <!-- Заголовок та опис -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 18px; flex-wrap: wrap;">
                    <div>
                        <h3 style="margin: 0 0 6px 0; color: #2c3e50; font-size: 18px; display: flex; align-items: center; gap: 8px;">
                            🛡️ Матриця прав та контроль доступу для ролей
                            <span style="font-size: 11px; padding: 3px 8px; border-radius: 12px; background: #ede9fe; color: #6d28d9; font-weight: bold;">Тільки для Розробника</span>
                        </h3>
                        <p style="margin: 0; font-size: 13px; color: #64748b; max-width: 820px; line-height: 1.5;">
                            Керуйте можливістю <b>заходити на сторінки</b>, <b>переглядати дані</b> та <b>редагувати вміст</b> для кожного кабінету (<b>Адмін</b>, <b>Модератор</b>, <b>Юзер</b>), а також вмикайте або вимикайте детальні кнопки і функції.
                        </p>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button type="button" onclick="saveAllPermissionsNow()" style="background: #27ae60; color: #fff; border: none; padding: 9px 16px; border-radius: 6px; font-size: 13px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(39, 174, 96, 0.25);">
                            💾 Зафіксувати всі права
                        </button>
                        <button type="button" onclick="applyRolePreset('reset_all')" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 9px 14px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                            🔄 Скинути до заводських
                        </button>
                    </div>
                </div>

                <!-- Панель швидких пресетів -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
                    <div style="font-size: 12px; font-weight: bold; color: #475569; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                        ⚡ Швидкі готові пресети прав для кабінетів:
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button type="button" onclick="applyRolePreset('admin_full')" style="background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; padding: 6px 12px; border-radius: 5px; font-size: 11px; font-weight: bold; cursor: pointer;">
                            🔴 Адмін: Повний доступ
                        </button>
                        <button type="button" onclick="applyRolePreset('moderator_default')" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 6px 12px; border-radius: 5px; font-size: 11px; font-weight: bold; cursor: pointer;">
                            🟢 Модератор: Стандартні права
                        </button>
                        <button type="button" onclick="applyRolePreset('moderator_view_all')" style="background: #e6fffa; color: #234e52; border: 1px solid #81e6d9; padding: 6px 12px; border-radius: 5px; font-size: 11px; font-weight: bold; cursor: pointer;">
                            🟢 Модератор: Перегляд усього
                        </button>
                        <button type="button" onclick="applyRolePreset('user_default')" style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 6px 12px; border-radius: 5px; font-size: 11px; font-weight: bold; cursor: pointer;">
                            🔵 Юзер: Стандартні права
                        </button>
                        <button type="button" onclick="applyRolePreset('user_view_all')" style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; padding: 6px 12px; border-radius: 5px; font-size: 11px; font-weight: bold; cursor: pointer;">
                            🔵 Юзер: Перегляд усього
                        </button>
                        <button type="button" onclick="applyRolePreset('user_block_all')" style="background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 6px 12px; border-radius: 5px; font-size: 11px; font-weight: bold; cursor: pointer;">
                            ⛔ Юзер: Заблокувати все
                        </button>
                    </div>
                </div>

                <!-- Фільтр перегляду за ролями -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span style="font-size: 12px; font-weight: bold; color: #64748b;">Фільтр ролей:</span>
                        <button type="button" onclick="switchDevPermissionsFilter('all')" style="${filterBtnStyle('all')}">
                            📊 Всі ролі (Адмін + Модер + Юзер)
                        </button>
                        <button type="button" onclick="switchDevPermissionsFilter('admin')" style="${filterBtnStyle('admin')}">
                            🔴 Тільки Адмін
                        </button>
                        <button type="button" onclick="switchDevPermissionsFilter('moderator')" style="${filterBtnStyle('moderator')}">
                            🟢 Тільки Модератор
                        </button>
                        <button type="button" onclick="switchDevPermissionsFilter('user')" style="${filterBtnStyle('user')}">
                            🔵 Тільки Юзер
                        </button>
                    </div>
                    <div style="font-size: 12px; color: #64748b;">
                        Всі перемикачі зберігаються <b>миттєво</b> в системі
                    </div>
                </div>

                <!-- ТАБЛИЦЯ 1: МАТРИЦЯ ДОСТУПУ ДО РОЗДІЛІВ ТА СТОРІНОК -->
                <div style="margin-bottom: 26px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
                    <div style="background: #334155; color: #fff; padding: 10px 16px; font-weight: bold; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
                        <span>📋 1. Доступ до розділів (Вхід, Перегляд, Редагування)</span>
                        <span style="font-size: 11px; opacity: 0.85;">Всього розділів: ${Object.keys(permMatrix).length}</span>
                    </div>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                            <thead>
                                <tr style="background: #f1f5f9; color: #334155;">
                                    <th style="padding: 10px 14px; border: 1px solid #cbd5e1; text-align: left; min-width: 260px;">Розділ / Сторінка</th>
                                    ${activeRoles.map(r => `
                                        <th style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: center; min-width: 210px; background: ${roleBg[r]}; color: ${roleColor[r]};">
                                            <b>${getRoleDisplayName(r)}</b>
                                        </th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.keys(permMatrix).map((modKey, idx) => {
                                    const mod = permMatrix[modKey];
                                    const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                                    return `
                                        <tr style="background: ${rowBg};">
                                            <td style="padding: 10px 14px; border: 1px solid #cbd5e1; vertical-align: middle;">
                                                <div style="display: flex; align-items: flex-start; gap: 10px;">
                                                    <span style="font-size: 20px; line-height: 1;">${mod.icon || '📄'}</span>
                                                    <div>
                                                        <div style="font-weight: bold; color: #1e293b; font-size: 13px;">${mod.name || modKey}</div>
                                                        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${mod.desc || ''}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            ${activeRoles.map(r => {
                                                const rPerm = mod[r] || { access: false, view: false, edit: false };
                                                return `
                                                    <td style="padding: 8px 12px; border: 1px solid #cbd5e1; vertical-align: middle; background: ${rPerm.access ? roleBg[r] : '#ffffff'};">
                                                        <div style="display: flex; flex-direction: column; gap: 5px;">
                                                            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; color: ${rPerm.access ? '#166534' : '#64748b'}; font-weight: ${rPerm.access ? 'bold' : 'normal'};">
                                                                <input type="checkbox" ${rPerm.access ? 'checked' : ''} onchange="updateRolePermissionCheckbox('${modKey}', '${r}', 'access', this.checked)" style="width: 15px; height: 15px; accent-color: #27ae60; cursor: pointer;">
                                                                <span>🚪 Заходити (Вхід)</span>
                                                            </label>
                                                            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; color: ${rPerm.view ? '#1e40af' : '#64748b'}; font-weight: ${rPerm.view ? 'bold' : 'normal'};">
                                                                <input type="checkbox" ${rPerm.view ? 'checked' : ''} onchange="updateRolePermissionCheckbox('${modKey}', '${r}', 'view', this.checked)" style="width: 15px; height: 15px; accent-color: #2980b9; cursor: pointer;">
                                                                <span>👁️ Перегляд даних</span>
                                                            </label>
                                                            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; color: ${rPerm.edit ? '#c2410c' : '#64748b'}; font-weight: ${rPerm.edit ? 'bold' : 'normal'};">
                                                                <input type="checkbox" ${rPerm.edit ? 'checked' : ''} onchange="updateRolePermissionCheckbox('${modKey}', '${r}', 'edit', this.checked)" style="width: 15px; height: 15px; accent-color: #e67e22; cursor: pointer;">
                                                                <span>✏️ Редагувати вміст</span>
                                                            </label>
                                                        </div>
                                                    </td>
                                                `;
                                            }).join('')}
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- ТАБЛИЦЯ 2: ДЕТАЛЬНІ ФУНКЦІЇ ТА КНОПКИ -->
                <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
                    <div style="background: #334155; color: #fff; padding: 10px 16px; font-weight: bold; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
                        <span>⚙️ 2. Дозволи для окремих функцій, дій та кнопок</span>
                        <span style="font-size: 11px; opacity: 0.85;">Всього функцій: ${Object.keys(granularPerms).length}</span>
                    </div>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                            <thead>
                                <tr style="background: #f1f5f9; color: #334155;">
                                    <th style="padding: 10px 14px; border: 1px solid #cbd5e1; text-align: left; min-width: 320px;">Функція / Дія / Кнопка</th>
                                    ${activeRoles.map(r => `
                                        <th style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: center; min-width: 150px; background: ${roleBg[r]}; color: ${roleColor[r]};">
                                            <b>${getRoleDisplayName(r)}</b>
                                        </th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${granularGroups.map(grp => `
                                    <tr style="background: #e2e8f0; font-weight: bold; color: #1e293b;">
                                        <td colspan="${activeRoles.length + 1}" style="padding: 8px 14px; border: 1px solid #cbd5e1; font-size: 12px; letter-spacing: 0.5px;">
                                            ${grp.title}
                                        </td>
                                    </tr>
                                    ${grp.keys.map((featKey, fIdx) => {
                                        const feat = granularPerms[featKey] || { name: featKey, admin: false, moderator: false, user: false };
                                        const rowBg = fIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
                                        return `
                                            <tr style="background: ${rowBg};">
                                                <td style="padding: 9px 14px; border: 1px solid #cbd5e1; vertical-align: middle;">
                                                    <span style="font-weight: 600; color: #334155;">${feat.name || featKey}</span>
                                                </td>
                                                ${activeRoles.map(r => {
                                                    const isChecked = !!feat[r];
                                                    return `
                                                        <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: center; vertical-align: middle; background: ${isChecked ? roleBg[r] : '#ffffff'};">
                                                            <label style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; font-size: 12px; color: ${isChecked ? roleColor[r] : '#94a3b8'}; font-weight: ${isChecked ? 'bold' : 'normal'};">
                                                                <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="updateGranularPermissionCheckbox('${featKey}', '${r}', this.checked)" style="width: 16px; height: 16px; accent-color: ${roleColor[r]}; cursor: pointer;">
                                                                <span>${isChecked ? '✅ Дозволено' : '⛔ Вимкнено'}</span>
                                                            </label>
                                                        </td>
                                                    `;
                                                }).join('')}
                                            </tr>
                                        `;
                                    }).join('')}
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
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
            <button type="button" onclick="switchDevSubTab('permissions')" style="${subTabBtnStyle('permissions')}">
                🛡️ Матриця прав та Доступ (Адмін / Модер / Юзер)
            </button>
            <button type="button" onclick="switchDevSubTab('passwords')" style="${subTabBtnStyle('passwords')}">
                🔑 Паролі кабінетів
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
    } catch (err) {
        console.error('Помилка відмальовки панелі розробника:', err);
        const container = getDevPanelContainer();
        if (container) {
            container.innerHTML = `
                <div style="background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #e74c3c; color: #c0392b;">
                    <h4>⚠️ Помилка завантаження Панелі розробника</h4>
                    <p style="font-size: 13px;">${err && err.message ? err.message : String(err)}</p>
                    <button onclick="refreshDevPanelData()" class="action-btn" style="background:#2980b9; margin-top:10px;">🔄 Спробувати оновити</button>
                </div>
            `;
        }
    }
};

window.renderDevPanelView = window.renderDeveloperPanel;
window.developerPanelUpdateRoleUI = window.updateRoleUI;
window.developerPanelSelectRole = window.selectRole;

function initDevPanel() {
    ensureDevPanelHeaderButtons();
    if (typeof updateRoleUI === 'function') {
        updateRoleUI();
    }
    if (typeof currentRole !== 'undefined' && currentRole === 'developer') {
        renderDeveloperPanel();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", () => setTimeout(initDevPanel, 80));
} else {
    setTimeout(initDevPanel, 80);
}
