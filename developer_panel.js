// ==========================================
// ОКРЕМА СТОРІНКА ПАНЕЛІ РОЗРОБНИКА (developer_panel.js)
// ==========================================

let devStorage = {
    messages: [
        { id: 1, date: "10.10.2026 01:25", role: "Адмін", ip: "192.168.1.15", car: "JEEP Grand Cherokee (AI465G)", notes: "Помилка у розрахунку витрати палива за період." }
    ],
    activeUsers: [
        { id: "u1", role: "Розробник", ip: "127.0.0.1", lastActive: "Щойно", status: "Активний", timeStats: { "10 днів": "18 год", "20 днів": "36 год", "30 днів": "52 год", "1 місяць": "55 год", "2 місяці": "110 год" } },
        { id: "u2", role: "Адмін", ip: "192.168.1.15", lastActive: "2 хв тому", status: "Активний", timeStats: { "10 днів": "12 год", "20 днів": "24 год", "30 днів": "38 год", "1 місяць": "40 год", "2 місяці": "82 год" } },
        { id: "u3", role: "Модератор", ip: "192.168.1.42", lastActive: "15 хв тому", status: "Активний", timeStats: { "10 днів": "5 год", "20 днів": "11 год", "30 днів": "16 год", "1 місяць": "18 год", "2 місяці": "35 год" } }
    ],
    bannedIPs: ["192.168.1.99"],
    auditLogs: [
        { time: "10.10.2026 01:00", event: "Успішний вхід Розробника", ip: "127.0.0.1" },
        { time: "10.10.2026 01:15", event: "Спроба неавторизованого доступу", ip: "192.168.1.99" }
    ]
};

// Рендеринг сторінки розробника при перемиканні view
function renderDevPanelView() {
    const container = document.getElementById('dev-panel-main-container');
    if (!container) return;

    container.innerHTML = `
        <!-- Вкладки панелі (включно з новою кнопкою Статистика часу) -->
        <div style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #bdc3c7; padding-bottom: 10px; flex-wrap: wrap;">
            <button class="dev-sub-tab active-sub-tab" onclick="switchDevSubTab('analytics')" id="tab-btn-analytics" style="padding: 8px 16px; background: #34495e; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">📊 Статистика та графіки</button>
            <button class="dev-sub-tab" onclick="switchDevSubTab('time-stats')" id="tab-btn-time-stats" style="padding: 8px 16px; background: #7f8c8d; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">⏳ Статистика часу</button>
            <button class="dev-sub-tab" onclick="switchDevSubTab('messages')" id="tab-btn-messages" style="padding: 8px 16px; background: #7f8c8d; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">📥 Вхідні листи (${devStorage.messages.length})</button>
            <button class="dev-sub-tab" onclick="switchDevSubTab('users')" id="tab-btn-users" style="padding: 8px 16px; background: #7f8c8d; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">👥 Користувачі та IP-бази</button>
            <button class="dev-sub-tab" onclick="switchDevSubTab('security')" id="tab-btn-security" style="padding: 8px 16px; background: #7f8c8d; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">⚠️ Попередження і Логи</button>
        </div>

        <div id="dev-sub-tab-content"></div>
    `;

    switchDevSubTab('analytics');
}

function switchDevSubTab(tabName) {
    document.querySelectorAll('.dev-sub-tab').forEach(b => {
        b.style.background = '#7f8c8d';
    });
    const activeBtn = document.getElementById(`tab-btn-${tabName}`);
    if (activeBtn) activeBtn.style.background = '#34495e';

    const content = document.getElementById('dev-sub-tab-content');
    if (!content) return;

    if (tabName === 'analytics') {
        content.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 25px;">
                <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #bdc3c7; text-align: center;">
                    <h4 style="color: #7f8c8d; margin: 0 0 10px 0;">Активні сесії</h4>
                    <span style="font-size: 28px; font-weight: bold; color: #27ae60;">${devStorage.activeUsers.length}</span>
                </div>
                <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #bdc3c7; text-align: center;">
                    <h4 style="color: #7f8c8d; margin: 0 0 10px 0;">Заблоковані IP</h4>
                    <span style="font-size: 28px; font-weight: bold; color: #c0392b;">${devStorage.bannedIPs.length}</span>
                </div>
                <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #bdc3c7; text-align: center;">
                    <h4 style="color: #7f8c8d; margin: 0 0 10px 0;">Вхідні запити</h4>
                    <span style="font-size: 28px; font-weight: bold; color: #2980b9;">${devStorage.messages.length}</span>
                </div>
            </div>
            <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #bdc3c7;">
                <h3 style="margin-top:0; color:#2c3e50;">📈 Аналітика завантаженості системи (Псевдо-графік)</h3>
                <div style="display: flex; align-items: flex-end; gap: 15px; height: 180px; padding-top: 20px; border-bottom: 2px solid #333; border-left: 2px solid #333; padding-left: 10px;">
                    <div style="flex: 1; background: #3498db; height: 60%; display: flex; justify-content: center; color: white; font-weight: bold; padding-top: 5px; border-radius: 4px 4px 0 0;">Юзери</div>
                    <div style="flex: 1; background: #2ecc71; height: 30%; display: flex; justify-content: center; color: white; font-weight: bold; padding-top: 5px; border-radius: 4px 4px 0 0;">Модератори</div>
                    <div style="flex: 1; background: #e74c3c; height: 80%; display: flex; justify-content: center; color: white; font-weight: bold; padding-top: 5px; border-radius: 4px 4px 0 0;">Адміни</div>
                    <div style="flex: 1; background: #8e44ad; height: 100%; display: flex; justify-content: center; color: white; font-weight: bold; padding-top: 5px; border-radius: 4px 4px 0 0;">Розробник</div>
                </div>
                <p style="text-align: center; color: #7f8c8d; margin-top: 10px; font-size: 13px;">Розподіл активності ролей у системі обліку</p>
            </div>
        `;
    } else if (tabName === 'time-stats') {
        let html = `
            <h3 style="margin-top:0; color:#2c3e50;">⏳ Статистика часу перебування користувачів у системі</h3>
            <p style="color: #555; font-size: 13px; margin-bottom: 15px;">Час активності кожного користувача та ролі за різні періоди:</p>
            <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <thead>
                    <tr style="background: #2c3e50; color: white; text-align: left;">
                        <th style="padding: 12px;">Роль / Користувач</th>
                        <th style="padding: 12px;">IP-адреса</th>
                        <th style="padding: 12px; text-align: center;">10 днів</th>
                        <th style="padding: 12px; text-align: center;">20 днів</th>
                        <th style="padding: 12px; text-align: center;">30 днів</th>
                        <th style="padding: 12px; text-align: center;">1 місяць</th>
                        <th style="padding: 12px; text-align: center;">2 місяці</th>
                    </tr>
                </thead>
                <tbody>
        `;
        devStorage.activeUsers.forEach(u => {
            const stats = u.timeStats || {};
            html += `
                <tr style="border-bottom: 1px solid #e0e0e0;">
                    <td style="padding: 12px; font-weight: bold; color: #2c3e50;">${u.role}</td>
                    <td style="padding: 12px; font-family: monospace; color: #555;">${u.ip}</td>
                    <td style="padding: 12px; text-align: center;">${stats["10 днів"] || "0 год"}</td>
                    <td style="padding: 12px; text-align: center;">${stats["20 днів"] || "0 год"}</td>
                    <td style="padding: 12px; text-align: center;">${stats["30 днів"] || "0 год"}</td>
                    <td style="padding: 12px; text-align: center; font-weight: bold; color: #2980b9;">${stats["1 місяць"] || "0 год"}</td>
                    <td style="padding: 12px; text-align: center; font-weight: bold; color: #27ae60;">${stats["2 місяці"] || "0 год"}</td>
                </tr>
            `;
        });
        html += `</tbody></table>`;
        content.innerHTML = html;
    } else if (tabName === 'messages') {
        let html = `<h3 style="margin-top:0; color:#2c3e50;">📥 Архів вхідних запитів та звітів від користувачів</h3>`;
        if (devStorage.messages.length === 0) {
            html += `<p style="color: #7f8c8d; font-style: italic;">Немає нових повідомлень.</p>`;
        } else {
            html += `<div style="display: flex; flex-direction: column; gap: 10px;">`;
            devStorage.messages.forEach(m => {
                html += `
                    <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #bdc3c7; display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <strong style="color: #2980b9;">[${m.role}] IP: ${m.ip}</strong> <span style="color: #7f8c8d; font-size: 12px;">(${m.date})</span>
                            <div style="margin-top: 6px; font-weight: bold;">Авто: ${m.car}</div>
                            <div style="margin-top: 4px; color: #333; background: #f9f9f9; padding: 8px; border-radius: 4px;">Нотатки: ${m.notes}</div>
                        </div>
                        <button onclick="deleteDevMessage(${m.id})" style="background: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">Видалити</button>
                    </div>
                `;
            });
            html += `</div>`;
        }
        content.innerHTML = html;
    } else if (tabName === 'users') {
        let html = `
            <h3 style="margin-top:0; color:#2c3e50;">👥 Керування користувачами, сесіями та IP-банами</h3>
            <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 25px;">
                <thead>
                    <tr style="background: #2c3e50; color: white; text-align: left;">
                        <th style="padding: 12px;">Роль</th>
                        <th style="padding: 12px;">IP-адреса</th>
                        <th style="padding: 12px;">Остання активність</th>
                        <th style="padding: 12px;">Статус</th>
                        <th style="padding: 12px; text-align: center;">Дії</th>
                    </tr>
                </thead>
                <tbody>
        `;
        devStorage.activeUsers.forEach(u => {
            const isBanned = devStorage.bannedIPs.includes(u.ip);
            html += `
                <tr style="border-bottom: 1px solid #e0e0e0;">
                    <td style="padding: 12px; font-weight: bold;">${u.role}</td>
                    <td style="padding: 12px; font-family: monospace;">${u.ip}</td>
                    <td style="padding: 12px; color: #7f8c8d;">${u.lastActive}</td>
                    <td style="padding: 12px; color: ${isBanned ? '#c0392b' : '#27ae60'}; font-weight: bold;">${isBanned ? 'Заблоковано (Бан)' : u.status}</td>
                    <td style="padding: 12px; text-align: center; display: flex; gap: 8px; justify-content: center;">
                        <button onclick="toggleBanIP('${u.ip}')" style="background: ${isBanned ? '#27ae60' : '#e67e22'}; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">${isBanned ? 'Розбанити IP' : 'Забанити IP'}</button>
                        <button onclick="kickUser('${u.id}')" style="background: #c0392b; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">Кікнути</button>
                    </td>
                </tr>
            `;
        });
        html += `</tbody></table>`;

        html += `
            <h3 style="color: #2c3e50; margin-bottom: 10px;">⛔ Список заблокованих IP-адрес</h3>
            <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #bdc3c7;">
        `;
        if (devStorage.bannedIPs.length === 0) {
            html += `<p style="color: #7f8c8d; font-style: italic; margin: 0;">Немає заблокованих IP.</p>`;
        } else {
            devStorage.bannedIPs.forEach(ip => {
                html += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee;">
                        <span style="font-family: monospace; font-weight: bold; color: #c0392b;">${ip}</span>
                        <button onclick="removeFromBanList('${ip}')" style="background: #27ae60; color: white; border: none; padding: 4px 10px; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold;">Видалити з бану</button>
                    </div>
                `;
            });
        }
        html += `</div>`;
        content.innerHTML = html;
    } else if (tabName === 'security') {
        content.innerHTML = `
            <h3 style="margin-top:0; color:#2c3e50;">⚠️ Безпека та попередження ієрархії</h3>
            <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #bdc3c7; margin-bottom: 20px;">
                <h4 style="margin-top:0; color:#2c3e50;">Надіслати попередження по ієрархії</h4>
                <label style="display: block; font-weight: bold; font-size: 13px; margin-bottom: 5px;">Цільова роль:</label>
                <select id="warning-target-role" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 12px;">
                    <option value="Адмін">Адмін (пароль 4343)</option>
                    <option value="Модератор">Модератор (пароль 2121)</option>
                    <option value="Усі">Усім користувачам системи</option>
                </select>
                <label style="display: block; font-weight: bold; font-size: 13px; margin-bottom: 5px;">Текст попередження:</label>
                <textarea id="warning-text-msg" rows="3" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; resize: vertical; margin-bottom: 12px;" placeholder="Увага! Оновлено правила безпеки та паролі доступу..."></textarea>
                <button onclick="sendHierarchyWarning()" style="background: #27ae60; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer;">📢 Надіслати попередження</button>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #bdc3c7;">
                <h3 style="margin-top:0; color:#2c3e50;">🛡️ Аудит подій безпеки (Logs)</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #f1f2f6; text-align: left;">
                            <th style="padding: 8px;">Час</th>
                            <th style="padding: 8px;">Подія</th>
                            <th style="padding: 8px;">IP</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${devStorage.auditLogs.map(l => `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px;">${l.time}</td><td style="padding: 8px;">${l.event}</td><td style="padding: 8px; font-family: monospace;">${l.ip}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
}

function deleteDevMessage(id) {
    devStorage.messages = devStorage.messages.filter(m => m.id !== id);
    switchDevSubTab('messages');
}

function toggleBanIP(ip) {
    if (devStorage.bannedIPs.includes(ip)) {
        devStorage.bannedIPs = devStorage.bannedIPs.filter(item => item !== ip);
        alert(`IP ${ip} розблоковано!`);
    } else {
        devStorage.bannedIPs.push(ip);
        alert(`⚠️ IP ${ip} занесено у бан-лист!`);
    }
    switchDevSubTab('users');
}

function removeFromBanList(ip) {
    devStorage.bannedIPs = devStorage.bannedIPs.filter(item => item !== ip);
    alert(`IP ${ip} успішно видалено з бану!`);
    switchDevSubTab('users');
}

function kickUser(id) {
    devStorage.activeUsers = devStorage.activeUsers.filter(u => u.id !== id);
    alert("Користувача відключено від системи.");
    switchDevSubTab('users');
}

function sendHierarchyWarning() {
    const target = document.getElementById('warning-target-role').value;
    const msg = document.getElementById('warning-text-msg').value;
    if (!msg.trim()) {
        alert("Введіть текст попередження!");
        return;
    }
    alert(`Попередження успішно розіслано для ролі [${target}]:\n\n"${msg}"`);
    document.getElementById('warning-text-msg').value = "";
}

function refreshDevPanelData() {
    alert("Дані панелі оновлено!");
    renderDevPanelView();
}

function saveDeveloperMailSubmission(formData) {
    const newMsg = {
        id: Date.now(),
        date: new Date().toLocaleString(),
        role: typeof currentRole !== 'undefined' ? currentRole : 'Юзер',
        ip: "127.0.0.1",
        car: `${formData.model} (${formData.plate})`,
        notes: formData.notes || "Без нотаток"
    };
    devStorage.messages.unshift(newMsg);
}