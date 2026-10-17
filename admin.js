// ==========================================
// РОЛІ ТА ПРАВА ДОСТУПУ (admin.js)
// ==========================================
// Версія: оригінал + 2 безпечні правки:
//   1) кнопка «+ Додати автомобіль» знаходиться за id="add-car-btn" і
//      показується лише якщо функція tryAddCarRow справді існує;
//   2) мертвий виклик switchTab() замінено на switchView('base') —
//      такої функції в проєкті немає, тому повернення на «Базу» не працювало.
// Перевірки ролей і паролів не змінені.
// ==========================================

let currentRole = "user";
try {
    const savedRole = localStorage.getItem('app_current_role') || localStorage.getItem('currentRole');
    if (savedRole && ["user", "moderator", "admin", "developer"].includes(savedRole)) {
        currentRole = savedRole;
    }
} catch(e) {}
window.currentRole = currentRole;
let isDeveloperLoggedIn = (currentRole === "developer");

// --- ДОПОМІЖНІ ФУНКЦІЇ ЗВ'ЯЗКУ З ПАНЕЛЛЮ РОЗРОБНИКА ---
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
            type: type, // 'info' | 'warning' | 'danger' | 'success'
            title: title,
            details: details || ''
        });
        if (logs.length > 150) logs.length = 150;
        localStorage.setItem('dev_security_logs', JSON.stringify(logs));
    } catch (e) {}
}

// Таймер обліку реального часу в ролях
setInterval(() => {
    try {
        const stats = JSON.parse(localStorage.getItem('dev_role_time_stats') || '{"user":0,"moderator":0,"admin":0,"developer":0}');
        stats[currentRole] = (Number(stats[currentRole]) || 0) + 1;
        localStorage.setItem('dev_role_time_stats', JSON.stringify(stats));
    } catch (e) {}
}, 1000);

// --- ПЕРЕМИКАННЯ РОЛЕЙ ---
function selectRole(role) {
    if (role === currentRole) return;

    const secCfg = getRoleSecurityConfig();
    const passwords = getSystemPasswords();

    // Якщо Розробник вже авторизований у цій сесії — пускаємо у будь-який кабінет без пароля
    if (isDeveloperLoggedIn) {
        window.currentRole = role;
        currentRole = role;
        try {
            localStorage.setItem('app_current_role', role);
            localStorage.setItem('currentRole', role);
        } catch(e) {}
        addSecurityLog('info', `Швидкий перехід Розробника`, `Перехід у кабінет: ${getRoleDisplayName(role)}`);
        updateRoleUI();
        return;
    }

    // Перевірка, чи не заблокована роль Розробником
    if (role === "user" && secCfg.lockUser) {
        alert("⛔ Доступ до режиму «Юзер» тимчасово призупинено Розробником.");
        return;
    }
    if (role === "moderator" && secCfg.lockModerator) {
        alert("⛔ Доступ до кабінету «Модератор» тимчасово заблоковано Розробником!");
        addSecurityLog('warning', 'Спроба входу в заблоковану роль', 'Кабінет Модератора заблокований');
        return;
    }
    if (role === "admin" && secCfg.lockAdmin) {
        alert("⛔ Доступ до кабінету «Адмін» тимчасово заблоковано Розробником!");
        addSecurityLog('warning', 'Спроба входу в заблоковану роль', 'Кабінет Адміна заблокований');
        return;
    }

    if (role === "user") {
        window.currentRole = "user";
        currentRole = "user";
        try {
            localStorage.setItem('app_current_role', 'user');
            localStorage.setItem('currentRole', 'user');
        } catch(e) {}
        updateRoleUI();
        return;
    }

    if (role === "moderator") {
        showCustomPasswordModal("Введіть пароль Модератора:", (pwd) => {
            if (pwd === null) return;
            // Перевіряємо або загальний пароль Модератора, або індивідуальний пароль користувача з роллю moderator
            if (pwd === passwords.moderator || checkCustomUserPassword('moderator', pwd)) {
                window.currentRole = "moderator";
                currentRole = "moderator";
                try {
                    localStorage.setItem('app_current_role', 'moderator');
                    localStorage.setItem('currentRole', 'moderator');
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
                    localStorage.setItem('app_current_role', 'admin');
                    localStorage.setItem('currentRole', 'admin');
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
                isDeveloperLoggedIn = true;
                try {
                    localStorage.setItem('app_current_role', 'developer');
                    localStorage.setItem('currentRole', 'developer');
                    localStorage.setItem('isDeveloperLoggedIn', 'true');
                } catch(e) {}
                addSecurityLog('success', 'Успішний вхід: Розробник (Супер-доступ)', 'Активовано вільний перехід між кабінетами');
                updateRoleUI();
            } else {
                addSecurityLog('danger', 'Спроба злому кабінету Розробника!', `Введено невірний пароль: "${pwd}"`);
                alert("❌ Невірний пароль Розробника!");
            }
        });
    }
}

function checkCustomUserPassword(targetRole, inputPwd) {
    if (!inputPwd) return false;
    try {
        const users = JSON.parse(localStorage.getItem('dev_managed_users') || '[]');
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

function getRoleDisplayName(role) {
    if (role === 'developer') return 'Розробник';
    if (role === 'admin') return 'Адмін';
    if (role === 'moderator') return 'Модератор';
    return 'Юзер';
}

function logoutDeveloperSession() {
    isDeveloperLoggedIn = false;
    currentRole = "user";
    try { localStorage.setItem('app_current_role', 'user'); } catch(e) {}
    addSecurityLog('info', 'Вихід із режиму Розробника', 'Сесію супер-доступу завершено');
    updateRoleUI();
}

function updateRoleUI() {
    const isModOrHigher = (currentRole === "moderator" || currentRole === "admin" || currentRole === "developer");
    const isAdminOrHigher = (currentRole === "admin" || currentRole === "developer");
    const isDev = (currentRole === "developer");
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
            if (r === currentRole) {
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

    // Кнопка швидкого виходу з режиму Розробника
    let devBadge = document.getElementById('dev-super-badge');
    const roleSwitchContainer = document.getElementById('role-btn-developer')?.parentElement;
    if (isDeveloperLoggedIn && roleSwitchContainer) {
        if (!devBadge) {
            devBadge = document.createElement('button');
            devBadge.id = 'dev-super-badge';
            devBadge.title = 'Ви увійшли як Розробник (перехід без паролів). Натисніть, щоб вийти з режиму Розробника.';
            devBadge.style.cssText = 'background:#2c3e50; color:#f1c40f; border:1px solid #f1c40f; border-radius:4px; padding:4px 8px; font-size:11px; font-weight:bold; cursor:pointer; margin-left:4px;';
            devBadge.innerHTML = '🔓 DEV (Вийти)';
            devBadge.onclick = logoutDeveloperSession;
            roleSwitchContainer.appendChild(devBadge);
        }
        devBadge.style.display = 'inline-block';
    } else if (devBadge) {
        devBadge.style.display = 'none';
    }

    // 1. Вкладка "Звіт (10 днів)"
    const reportNavBtn = document.getElementById("nav-btn-report");
    if (reportNavBtn) {
        reportNavBtn.style.display = isModOrHigher ? "inline-block" : "none";
    }

    // Вкладки "Звіт по підрозділах", "Облік обладнання", "Знищена техніка" — доступні ТІЛЬКИ для Розробника та Адміна!
    const subdivisionsNavBtn = document.getElementById("nav-btn-subdivisions");
    if (subdivisionsNavBtn) {
        subdivisionsNavBtn.style.display = isAdminOrHigher ? "inline-block" : "none";
    }

    const equipmentNavBtn = document.getElementById("nav-btn-equipment");
    if (equipmentNavBtn) {
        equipmentNavBtn.style.display = isAdminOrHigher ? "inline-block" : "none";
    }

    const eqReportNavBtn = document.getElementById("nav-btn-equipment-report");
    if (eqReportNavBtn) {
        eqReportNavBtn.style.display = isModOrHigher ? "inline-block" : "none";
    }

    const destroyedNavBtn = document.getElementById("nav-btn-destroyed");
    if (destroyedNavBtn) {
        destroyedNavBtn.style.display = isAdminOrHigher ? "inline-block" : "none";
    }

    // 2. Вкладка "Панель розробника"
    const devPanelBtn = document.getElementById("nav-btn-dev-panel");
    if (devPanelBtn) {
        devPanelBtn.style.display = isDev ? "inline-block" : "none";
    }

    // Кнопка зміни фавікона — доступна ТІЛЬКИ для Розробника (прихована для Адміна, Модератора, Юзера)
    const faviconUploadBtn = document.getElementById("header-favicon-upload-btn");
    if (faviconUploadBtn) {
        faviconUploadBtn.style.setProperty("display", isDev ? "inline-flex" : "none", "important");
    }

    const reportView = document.getElementById("report-view");
    if (reportView && reportView.style.display !== "none" && !isModOrHigher) {
        if (typeof switchView === "function") switchView("base");
    }

    const subdivisionsView = document.getElementById("subdivisions-view");
    if (subdivisionsView && (subdivisionsView.classList.contains("active") || subdivisionsView.style.display !== "none") && !isAdminOrHigher) {
        if (typeof switchView === "function") switchView("base");
    }

    const equipmentView = document.getElementById("generators-view");
    if (equipmentView && (equipmentView.classList.contains("active") || equipmentView.style.display !== "none") && !isAdminOrHigher) {
        if (typeof switchView === "function") switchView("base");
    }

    const eqReportView = document.getElementById("equipment-report-view");
    if (eqReportView && (eqReportView.classList.contains("active") || eqReportView.style.display !== "none") && !isModOrHigher) {
        if (typeof switchView === "function") switchView("base");
    }

    const destroyedView = document.getElementById("destroyed-view");
    if (destroyedView && (destroyedView.classList.contains("active") || destroyedView.style.display !== "none") && !isAdminOrHigher) {
        if (typeof switchView === "function") switchView("base");
    }

    const devPanelView = document.getElementById("dev-panel-view") || document.getElementById("developer-panel-view");
    if (devPanelView && devPanelView.classList.contains("active") && !isDev) {
        if (typeof switchView === "function") switchView("base");
    }

    // 3. Кнопки на сторінці "База (Реєстр)"
    const addCarBtn = document.getElementById('add-car-btn') ||
        document.querySelector('#base-view .action-bar .btn-green') ||
        document.querySelector('#cars-view .action-bar .btn-green');
    if (addCarBtn) {
        addCarBtn.style.display = (isAdminOrHigher && typeof window.tryAddCarRow === 'function') ? "inline-block" : "none";
    }

    const deleteActionHeader = document.getElementById("delete-action-header");
    if (deleteActionHeader) {
        deleteActionHeader.style.display = isAdminOrHigher ? "" : "none";
    }

    const deleteCells = document.querySelectorAll('#cars-tbody .delete-cell');
    deleteCells.forEach(cell => {
        cell.style.display = isAdminOrHigher ? "" : "none";
    });

     // Кнопка "💾 Зберегти зміни" в Картці авто — видима ТІЛЬКИ для Розробника та Адміна
    const cardSaveBtn = document.getElementById("card-save-btn");
    if (cardSaveBtn) {
        cardSaveBtn.style.setProperty("display", isAdminOrHigher ? "inline-flex" : "none", "important");
    }

    // 4. Кнопки у "Картка авто та Маршрути"
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

    // 5. Розділ "Звіт (10 днів)":
    // Тільки Розробник та Адмін можуть редагувати
    const canEditReport = isAdminOrHigher;
    if (typeof window.applyReportRolePermissions === 'function') {
        window.applyReportRolePermissions();
    } else {
        const reportInputs = document.querySelectorAll('#report-tbody input.report-cell-input, #report-tbody select');
        reportInputs.forEach(input => {
            input.disabled = !canEditReport;
            input.readOnly = !canEditReport;
            input.style.backgroundColor = canEditReport ? "" : "#f0f3f4";
            input.style.cursor = canEditReport ? "text" : "not-allowed";
        });

        const reportPeriodInput = document.getElementById('report-custom-period');
        if (reportPeriodInput) {
            reportPeriodInput.disabled = !canEditReport;
            reportPeriodInput.readOnly = !canEditReport;
        }

        const reportActionButtons = document.querySelectorAll('#report-view button[onclick*="saveReportData"], #rep-save-btn');
        reportActionButtons.forEach(btn => {
            btn.style.display = canEditReport ? "inline-block" : "none";
        });
    }

    // Оновлюємо Панель розробника, якщо вона відкрита
    if (isDev && typeof renderDeveloperPanel === "function") {
        renderDeveloperPanel();
    }
}

function showCustomPasswordModal(titleText, callback) {
    const oldModal = document.getElementById("custom-admin-modal");
    if (oldModal) oldModal.remove();

    const overlay = document.createElement("div");
    overlay.id = "custom-admin-modal";
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:99999;";

    const box = document.createElement("div");
    box.style.cssText = "background:white; padding:25px; border-radius:10px; width:340px; max-width:92%; box-shadow:0 10px 30px rgba(0,0,0,0.35); text-align:center; font-family:sans-serif;";

    const title = document.createElement("h3");
    title.innerText = titleText;
    title.style.cssText = "margin:0 0 15px 0; color:#2c3e50; font-size:18px;";

    const input = document.createElement("input");
    input.type = "password";
    input.placeholder = "Введіть пароль...";
    input.style.cssText = "width:100%; padding:10px; margin-bottom:15px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box; font-size:16px; text-align:center;";

    const btnContainer = document.createElement("div");
    btnContainer.style.cssText = "display:flex; gap:10px; justify-content:center;";

    const okBtn = document.createElement("button");
    okBtn.innerText = "Увійти";
    okBtn.style.cssText = "background:#27ae60; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:bold; flex:1;";

    const cancelBtn = document.createElement("button");
    cancelBtn.innerText = "Скасувати";
    cancelBtn.style.cssText = "background:#e74c3c; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:bold; flex:1;";

    btnContainer.appendChild(okBtn);
    btnContainer.appendChild(cancelBtn);
    box.appendChild(title);
    box.appendChild(input);
    box.appendChild(btnContainer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    input.focus();

    const submit = () => {
        const val = input.value;
        overlay.remove();
        callback(val);
    };

    okBtn.onclick = submit;
    input.onkeydown = (e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") {
            overlay.remove();
            callback(null);
        }
    };
    cancelBtn.onclick = () => {
        overlay.remove();
        callback(null);
    };
}

function toggleAdminLogin() {
    selectRole(currentRole === "user" ? "admin" : "user");
}

document.addEventListener("DOMContentLoaded", () => {
    updateRoleUI();

    const carsTbody = document.getElementById('cars-tbody');
    if (carsTbody) {
        const observer = new MutationObserver(() => {
            updateRoleUI();
        });
        observer.observe(carsTbody, { childList: true, subtree: true });
    }
});
