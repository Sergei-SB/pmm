// ==========================================
// МОДУЛЬ УПРАВЛІННЯ РОЛЯМИ ТА ПРАВАМИ (admin.js)
// ==========================================

let currentRole = "user"; // за замовчуванням при вході — юзер
const ADMIN_PASSWORD = "4343";
let isDeveloperLoggedIn = false;

// Функція вибору ролі користувачем при кліку на панель
function selectRole(role) {
    if (role === currentRole) return;

    if (role === "developer") {
        if (typeof checkDeveloperPassword === 'function') {
            checkDeveloperPassword((success) => {
                if (success) {
                    isDeveloperLoggedIn = true;
                    applyRoleChange("developer", "Режим Розробника активовано!");
                }
            });
        }
    } else if (role === "admin") {
        isDeveloperLoggedIn = false;
        showCustomPasswordModal((pass) => {
            if (pass === ADMIN_PASSWORD) {
                applyRoleChange("admin", "Режим Адміна активовано!");
            } else if (pass !== null) {
                alert("Неправильний пароль Адміна!");
            }
        }, "•");
    } else if (role === "moderator") {
        isDeveloperLoggedIn = false;
        if (typeof checkModeratorPassword === 'function') {
            checkModeratorPassword((success) => {
                if (success) {
                    applyRoleChange("moderator", "Режим Модератора активовано!");
                }
            });
        }
    } else if (role === "user") {
        isDeveloperLoggedIn = false;
        applyRoleChange("user", "Увімкнено режим Юзера.");
    }
}

function applyRoleChange(role, message) {
    currentRole = role;
    if (message) alert(message);
    updateRoleUI();
}

function updateRoleUI() {
    const roles = ["developer", "admin", "moderator", "user"];
    roles.forEach(r => {
        const btn = document.getElementById(`role-btn-${r}`);
        if (btn) {
            if (r === currentRole) {
                btn.style.backgroundColor = "#c0392b";
                btn.style.borderColor = "#e74c3c";
            } else {
                btn.style.backgroundColor = "#34495e";
                btn.style.borderColor = "transparent";
            }
        }
    });

    const isDev = (currentRole === "developer");
    const isAdmin = (currentRole === "admin");
    const isDevOrAdmin = (isDev || isAdmin);
    const isMod = (currentRole === "moderator");

    const btnReport = document.getElementById('nav-btn-report');
    const btnSubdivisions = document.getElementById('nav-btn-subdivisions');
    const btnEquipment = document.getElementById('nav-btn-equipment');
    const btnDestroyed = document.getElementById('nav-btn-destroyed');
    const addCarBtn = document.getElementById('add-car-btn');
    const transferBtn = document.getElementById('transfer-data-btn');

    // Кнопки збереження та імпорту (тільки для Розробника)
    const saveBtn = document.getElementById('header-direct-save-btn');
    const importBtn = document.getElementById('header-direct-import-btn');
    if (saveBtn) saveBtn.style.display = isDev ? 'inline-flex' : 'none';
    if (importBtn) importBtn.style.display = isDev ? 'inline-flex' : 'none';

    // Кнопка збереження на картці авто (для Розробника та Адміна)
    const cardSaveBtn = document.getElementById('card-save-btn');
    if (cardSaveBtn) cardSaveBtn.style.display = isDevOrAdmin ? 'inline-flex' : 'none';

    if (isDev) {
        if (btnReport) btnReport.style.display = 'inline-block';
        if (btnSubdivisions) btnSubdivisions.style.display = 'inline-block';
        if (btnEquipment) btnEquipment.style.display = 'inline-block';
        if (btnDestroyed) btnDestroyed.style.display = 'inline-block';
        if (addCarBtn) addCarBtn.style.display = 'inline-block';
        if (transferBtn) transferBtn.style.display = 'inline-block';
    } else if (isAdmin) {
        if (btnReport) btnReport.style.display = 'inline-block';
        if (btnSubdivisions) btnSubdivisions.style.display = 'inline-block';
        if (btnEquipment) btnEquipment.style.display = 'inline-block';
        if (btnDestroyed) btnDestroyed.style.display = 'inline-block';
        if (addCarBtn) addCarBtn.style.display = 'none';
        if (transferBtn) transferBtn.style.display = 'inline-block';
    } else if (isMod) {
        if (btnReport) btnReport.style.display = 'inline-block';
        if (btnSubdivisions) btnSubdivisions.style.display = 'none';
        if (btnEquipment) btnEquipment.style.display = 'none';
        if (btnDestroyed) btnDestroyed.style.display = 'none';
        if (addCarBtn) addCarBtn.style.display = 'none';
        if (transferBtn) transferBtn.style.display = 'none';
    } else {
        if (btnReport) btnReport.style.display = 'none';
        if (btnSubdivisions) btnSubdivisions.style.display = 'none';
        if (btnEquipment) btnEquipment.style.display = 'none';
        if (btnDestroyed) btnDestroyed.style.display = 'none';
        if (addCarBtn) addCarBtn.style.display = 'none';
        if (transferBtn) transferBtn.style.display = 'none';

        const activeView = document.querySelector('.view-section.active');
        if (activeView && activeView.id !== 'base-view' && activeView.id !== 'card-view' && activeView.id !== 'aggregates-calc-view') {
            if (typeof switchView === 'function') switchView('base');
        }
    }

    if (isAdmin) {
        setTimeout(() => {
            const reportInputs = document.querySelectorAll('#report-table input, #report-table select');
            reportInputs.forEach(input => {
                if (input.id === 'report-subdivision-filter') {
                    input.removeAttribute('disabled');
                    input.style.backgroundColor = 'white';
                    return;
                }
                input.setAttribute('disabled', 'true');
                input.style.backgroundColor = '#f1f2f6';
            });
        }, 300);
    }

    const carsTable = document.getElementById('cars-table');
    if (carsTable) {
        const headers = carsTable.querySelectorAll('thead th');
        const rows = carsTable.querySelectorAll('tbody tr');

        if (headers.length > 0) {
            const lastHeader = headers[headers.length - 1];
            if (lastHeader.textContent.trim().toLowerCase() === 'звіт') {
                lastHeader.style.display = isDevOrAdmin ? '' : 'none';
            }
        }

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 0) {
                const lastCell = cells[cells.length - 1];
                if (lastCell.querySelector('button, a') || lastCell.textContent.trim().toLowerCase() === 'звіт') {
                    lastCell.style.display = isDevOrAdmin ? '' : 'none';
                }
            }
        });
    }

    // Керування показом окремої сторінки Панелі розробника в шапці
    const devPanelNavBtn = document.getElementById('nav-btn-dev-panel');
    if (devPanelNavBtn) {
        devPanelNavBtn.style.display = isDev ? 'inline-block' : 'none';
        if (!isDev) {
            const activeView = document.querySelector('.view-section.active');
            if (activeView && activeView.id === 'dev-panel-view') {
                if (typeof switchView === 'function') switchView('base');
            }
        }
    }
}

function showCustomPasswordModal(callback, maskChar = "🖕") {
    const oldModal = document.getElementById('custom-admin-modal');
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'custom-admin-modal';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999;';

    const box = document.createElement('div');
    box.style.cssText = 'background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); width: 320px; text-align: center; font-family: Arial, sans-serif;';

    box.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 15px; color: #2c3e50; font-size: 16px;">Введіть пароль доступу:</h3>
        <div style="position: relative; margin-bottom: 15px;">
            <input type="password" id="admin-pass-field" style="width: 100%; padding: 8px; font-size: 16px; border: 1px solid #ccc; border-radius: 4px; text-align: center; box-sizing: border-box;" autocomplete="current-password">
            <div id="admin-masked-display" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: white; border: 1px solid #ccc; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 18px; letter-spacing: 3px; pointer-events: none; box-sizing: border-box; overflow: hidden; white-space: nowrap; padding: 0 10px;"></div>
        </div>
        <div style="display: flex; gap: 10px;">
            <button id="admin-modal-ok" style="flex: 1; background: #27ae60; color: white; border: none; padding: 8px; border-radius: 4px; font-weight: bold; cursor: pointer;">OK</button>
            <button id="admin-modal-cancel" style="flex: 1; background: #7f8c8d; color: white; border: none; padding: 8px; border-radius: 4px; font-weight: bold; cursor: pointer;">Скасувати</button>
        </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const inputField = document.getElementById('admin-pass-field');
    const maskedDisplay = document.getElementById('admin-masked-display');
    const okBtn = document.getElementById('admin-modal-ok');
    const cancelBtn = document.getElementById('admin-modal-cancel');

    inputField.focus();

    let realValue = "";
    inputField.addEventListener('input', () => {
        const val = inputField.value;
        if (val.length > realValue.length) {
            realValue += val.slice(realValue.length);
        } else {
            realValue = realValue.slice(0, val.length);
        }
        maskedDisplay.textContent = maskChar.repeat(realValue.length);
        inputField.value = "•".repeat(realValue.length);
    });

    const submit = () => {
        const pwd = realValue;
        overlay.remove();
        callback(pwd);
    };

    okBtn.onclick = submit;
    inputField.onkeydown = (e) => {
        if (e.key === 'Enter') submit();
        if (e.key === 'Escape') overlay.remove();
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