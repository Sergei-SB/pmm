// ==========================================
// МОДУЛЬ ЗАХИСТУ АДМІНІСТРАТОРА (admin.js)
// ==========================================

let isAdminLoggedIn = false;
const ADMIN_PASSWORD = "02031985"; // Пароль адміністратора

function updateAdminUI() {
    const btn = document.getElementById('admin-login-btn');
    
    // Усі елементи, які бачить тільки адмін
    const adminElements = [
        document.getElementById('nav-btn-report'),
        document.getElementById('nav-btn-equipment'),
        document.getElementById('nav-btn-destroyed'),
        document.getElementById('transfer-data-btn'),
        document.getElementById('add-car-btn')
    ];

    adminElements.forEach(el => {
        if (el) {
            el.style.display = isAdminLoggedIn ? 'inline-block' : 'none';
        }
    });

    // Динамічне приховування/показування стовпчика "Звіт" та самих кнопок у таблиці Реєстру
    const carsTable = document.getElementById('cars-table');
    if (carsTable) {
        const headers = carsTable.querySelectorAll('thead th');
        const rows = carsTable.querySelectorAll('tbody tr');

        if (headers.length > 0) {
            const lastHeader = headers[headers.length - 1];
            if (lastHeader.textContent.trim().toLowerCase() === 'звіт') {
                lastHeader.style.display = isAdminLoggedIn ? '' : 'none';
            }
        }

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 0) {
                const lastCell = cells[cells.length - 1];
                if (lastCell.querySelector('button, a') || lastCell.textContent.trim().toLowerCase() === 'звіт') {
                    lastCell.style.display = isAdminLoggedIn ? '' : 'none';
                }
            }
        });
    }

    if (btn) {
        if (isAdminLoggedIn) {
            btn.textContent = "🔓 Адмін (Вийти)";
            btn.style.backgroundColor = "#c0392b";
        } else {
            btn.textContent = "🔒 Вхід для адміна";
            btn.style.backgroundColor = "#34495e";
        }
    }
}

// Функція для виклику власного захищеного модального вікна з маскуванням через 🖕
function showCustomPasswordModal(callback) {
    const oldModal = document.getElementById('custom-admin-modal');
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'custom-admin-modal';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999;';

    const box = document.createElement('div');
    box.style.cssText = 'background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); width: 320px; text-align: center; font-family: Arial, sans-serif;';

    box.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 15px; color: #2c3e50; font-size: 16px;">Введіть пароль адміністратора:</h3>
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
        maskedDisplay.textContent = "🖕".repeat(realValue.length);
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
    if (!isAdminLoggedIn) {
        showCustomPasswordModal((pass) => {
            if (pass === null) return;
            if (pass === ADMIN_PASSWORD) {
                isAdminLoggedIn = true;
                alert("Режим адміністратора активовано!");
                updateAdminUI();
            } else {
                alert("Неправильний пароль!");
            }
        });
    } else {
        isAdminLoggedIn = false;
        alert("Вийшли з режиму адміністратора.");
        updateAdminUI();
        
        const activeView = document.querySelector('.view-section.active');
        if (activeView && (activeView.id === 'report-view' || activeView.id === 'generators-view' || activeView.id === 'destroyed-view')) {
            if (typeof switchView === 'function') switchView('base');
        }
    }
}

// Автоматичне застосування та відстеження оновлень сторінки
window.addEventListener("DOMContentLoaded", () => {
    updateAdminUI();

    const carsTbody = document.getElementById('cars-tbody');
    if (carsTbody) {
        const observer = new MutationObserver(() => {
            updateAdminUI();
        });
        observer.observe(carsTbody, { childList: true, subtree: true });
    }

    // Захист теплових пушок (heaters.js)
    if (typeof window.deleteHeatersRow === 'function') {
        const origDelHeat = window.deleteHeatersRow;
        window.deleteHeatersRow = function(id) {
            if (isAdminLoggedIn) {
                origDelHeat(id);
            } else {
                showCustomPasswordModal((pass) => {
                    if (pass === ADMIN_PASSWORD) {
                        isAdminLoggedIn = true;
                        updateAdminUI();
                        origDelHeat(id);
                    } else if (pass !== null) {
                        alert("Неправильний пароль!");
                    }
                });
            }
        };
    }
    if (typeof window.addHeatersRow === 'function') {
        const origAddHeat = window.addHeatersRow;
        window.addHeatersRow = function() {
            if (isAdminLoggedIn) {
                origAddHeat();
            } else {
                showCustomPasswordModal((pass) => {
                    if (pass === ADMIN_PASSWORD) {
                        isAdminLoggedIn = true;
                        updateAdminUI();
                        origAddHeat();
                    } else if (pass !== null) {
                        alert("Неправильний пароль!");
                    }
                });
            }
        };
    }

    // Захист Webasto (webasto.js)
    if (typeof window.deleteWebastoRow === 'function') {
        const origDelWeb = window.deleteWebastoRow;
        window.deleteWebastoRow = function(id) {
            if (isAdminLoggedIn) {
                origDelWeb(id);
            } else {
                showCustomPasswordModal((pass) => {
                    if (pass === ADMIN_PASSWORD) {
                        isAdminLoggedIn = true;
                        updateAdminUI();
                        origDelWeb(id);
                    } else if (pass !== null) {
                        alert("Неправильний пароль!");
                    }
                });
            }
        };
    }
    if (typeof window.addWebastoRow === 'function') {
        const origAddWeb = window.addWebastoRow;
        window.addWebastoRow = function() {
            if (isAdminLoggedIn) {
                origAddWeb();
            } else {
                showCustomPasswordModal((pass) => {
                    if (pass === ADMIN_PASSWORD) {
                        isAdminLoggedIn = true;
                        updateAdminUI();
                        origAddWeb();
                    } else if (pass !== null) {
                        alert("Неправильний пароль!");
                    }
                });
            }
        };
    }

    // Захист імпорту даних (report.js)
    if (typeof window.importDataFromJson === 'function') {
        const origImport = window.importDataFromJson;
        window.importDataFromJson = function(input) {
            if (isAdminLoggedIn) {
                origImport(input);
            } else {
                showCustomPasswordModal((pass) => {
                    if (pass === ADMIN_PASSWORD) {
                        isAdminLoggedIn = true;
                        updateAdminUI();
                        origImport(input);
                    } else {
                        input.value = '';
                        if (pass !== null) alert("Неправильний пароль!");
                    }
                });
            }
        };
    }
});