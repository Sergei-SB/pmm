// ==========================================
// СІСТЕМНА ПОШТА (КНОПКИ-ТАНЧИКИ ТА ЕМОДЖІ) (broadcast_mail.js)
// ==========================================

function getStoredBroadcasts() {
    try {
        const data = localStorage.getItem('broadcastStorageList_v2');
        if (data) {
            return JSON.parse(data);
        }
    } catch(e) {}
    
    const defaultList = [];
    localStorage.setItem('broadcastStorageList_v2', JSON.stringify(defaultList));
    return defaultList;
}

function getLastReadIdKey() {
    const role = (typeof currentRole !== 'undefined') ? currentRole : 'user';
    return `lastReadBroadcastId_${role}`;
}

function updateEnvelopeBlinkState() {
    const btn = document.getElementById('broadcast-envelope-btn');
    if (!btn) return;

    const allMessages = getStoredBroadcasts();
    if (allMessages.length === 0) {
        btn.classList.remove('envelope-blinking');
        return;
    }

    const latestMessageId = allMessages[0].id;
    const readKey = getLastReadIdKey();
    const lastReadId = Number(localStorage.getItem(readKey) || 0);

    if (latestMessageId > lastReadId) {
        btn.classList.add('envelope-blinking');
    } else {
        btn.classList.remove('envelope-blinking');
        btn.style.backgroundColor = '#2980b9';
        btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    }
}

// Вставка емодзі в активне поле
function insertEmoji(fieldId, emoji) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const text = field.value;
    
    field.value = text.substring(0, start) + emoji + text.substring(end);
    field.focus();
    field.selectionStart = field.selectionEnd = start + emoji.length;
}

// Панель емодзі з усіма категоріями
function toggleInlineEmojiPicker(containerId, fieldId) {
    let container = document.getElementById(containerId);
    if (container) {
        container.remove();
        return;
    }

    const existing = document.querySelectorAll('.inline-emoji-panel');
    existing.forEach(e => e.remove());

    container = document.createElement('div');
    container.id = containerId;
    container.className = 'inline-emoji-panel';
    container.style.cssText = 'background: #f8f9fa; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; margin-top: 5px; max-height: 250px; overflow-y: auto; font-size: 20px; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; z-index: 10020;';

    const categories = [
        { name: "🎖️ Військова справа та тактика", emojis: ['🎖️','🏆','⭐','🛡️','⚔️','🎯','🚀','🛰️','📡','🚁','✈️','🛩️','🛸','🧭','🗺️','🔭','🔦','🪖','🦺','🎒','🧰','⚡','🔥','💥','🧨','⚠️','⛔','🚫','❌','✅','🟢','🟡','🔴','💯','🇺🇦','💪','🦾','🦅','🎯','⚓'] },
        { name: "🚙 Автомобілі, транспорт та паливо", emojis: ['🚗','🚙','🛻','🚚','🚛','🚜','🏎️','🏍️','🛵','🚲','⛽','🛢️','🛞','🧰','🔧','🔩','⚙️','🔋','🔌','💡','🔑','🧯','🅿️','🚦','🚥','🚧','📦','🏷️','⚖️','📉','📈','📋'] },
        { name: "😀 Емоції та обличчя", emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😎','🥳','😏','😒','😞','😔','😟','😕','🙁','😣','😫','😩','🥺','😢','😭','😤','😠','😡','🤯','😳','🥶','😱','😷','🤖','👻'] },
        { name: "🛡️ Статуси, офіс та документи", emojis: ['👑','⚡','👮','🕵️‍♂️','👷','🧑‍💻','👨‍💼','🔑','🔓','🔒','🔐','💬','💭','📢','🔔','🔕','✉️','📩','📨','📧','📬','📁','📂','📋','📌','📍','📎','✂️','🖊️','📝','🔍'] },
        { name: "🍕 Їжа та кава на зміні", emojis: ['☕','🍵','🧃','🍾','🍷','🍸','🍹','🍺','🍻','🥂','🥃','🥤','🧋','🍕','🍔','🍟','🌭','🍿','🥪','🌮','🌯','🥗','🍝','🍜','🍲','🍣','🍱','🍛','🍚','🍙','🎂','🍰','🧁','🍫'] },
        { name: "🌟 Природа, погода та час", emojis: ['☀️','🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','🌬️','🌪️','🌫️','💧','💦','☔','🌱','🌲','🌳','🌴','🌵','🍀','🍁','🍂','🍃','🌍','🪐','⏱️','⏰','⌛'] },
        { name: "❤️ Серця та символи", emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','💕','💞','💓','💗','💖','💘','💝','👍','👎','👏','🙌','🤝','🙏','💪','🦾','💍','💎'] }
    ];

    categories.forEach(cat => {
        const title = document.createElement('div');
        title.textContent = cat.name;
        title.style.cssText = 'font-size: 11px; font-weight: bold; color: #334155; margin-top: 4px; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px;';
        container.appendChild(title);

        const grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px;';

        cat.emojis.forEach(e => {
            const span = document.createElement('span');
            span.textContent = e;
            span.style.cssText = 'cursor: pointer; text-align: center; padding: 3px; border-radius: 4px; transition: background 0.1s; user-select: none;';
            span.onmouseover = () => span.style.background = '#e2e8f0';
            span.onmouseout = () => span.style.background = 'transparent';
            span.onclick = () => insertEmoji(fieldId, e);
            grid.appendChild(span);
        });
        container.appendChild(grid);
    });

    const targetDiv = document.getElementById(fieldId + '-container');
    if (targetDiv) {
        targetDiv.appendChild(container);
    }
}

function openBroadcastMailModal() {
    const allMessages = getStoredBroadcasts();
    if (allMessages.length > 0) {
        const readKey = getLastReadIdKey();
        localStorage.setItem(readKey, allMessages[0].id);
    }
    updateEnvelopeBlinkState();

    const oldModal = document.getElementById('broadcast-mail-modal');
    if (oldModal) oldModal.remove();

    const currentRoleName = (typeof currentRole !== 'undefined') ? currentRole : 'user';
    const isAuthorizedWriter = (currentRoleName === 'developer' || currentRoleName === 'admin' || currentRoleName === 'moderator');

    const overlay = document.createElement('div');
    overlay.id = 'broadcast-mail-modal';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 10005; padding: 20px; box-sizing: border-box;';

    const box = document.createElement('div');
    box.style.cssText = 'background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); width: 600px; max-width: 100%; max-height: 90vh; overflow-y: auto; font-family: Arial, sans-serif; box-sizing: border-box;';

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2c3e50; padding-bottom: 10px; margin-bottom: 15px;">
            <h3 style="margin: 0; color: #2c3e50; font-size: 18px;">✉️ Системна пошта (Архів сповіщень)</h3>
            <button onclick="document.getElementById('broadcast-mail-modal').remove()" style="background: #c0392b; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: bold;">✕</button>
        </div>
    `;

    if (isAuthorizedWriter) {
        html += `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border: 1px solid #cbd5e1; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 14px;">✍️ Надіслати нове сповіщення</h4>
                
                <label style="display: block; font-weight: bold; font-size: 12px; margin-bottom: 4px; color: #333;">Оберіть групу отримувачів:</label>
                <select id="broadcast-target" style="width: 100%; padding: 7px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 13px; background: white;">
                    <option value="all">🌐 Усім користувачам (Розробники, Адміни, Модератори, Юзери)</option>
                    <option value="all_except_user">⚡ Всім крім Юзерів (Розробники, Адміни, Модератори)</option>
                    <option value="admin">🛡️ Тільки Адмінам</option>
                    <option value="moderator">👮 Тільки Модераторам</option>
                    <option value="user">👤 Тільки Юзерам</option>
                    <option value="admin_moderator">🛡️👮 Тільки Адмінам і Модераторам</option>
                    <option value="dev_admin_moderator">⚡🛡️👮 Для Розробників, Адмінів і Модераторів</option>
                </select>

                <!-- Контейнер Теми з кнопкою-танчиком -->
                <div id="broadcast-title-container" style="margin-bottom: 8px;">
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <input type="text" id="broadcast-title" placeholder="Тема листа..." style="flex: 1; padding: 7px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 13px;">
                        <button type="button" onclick="toggleInlineEmojiPicker('title-emoji-box', 'broadcast-title')" style="background: #e2e8f0; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 16px;" title="Вибрати емодзі">🛡️</button>
                    </div>
                    <div id="title-emoji-box"></div>
                </div>

                <!-- Контейнер Тексту з кнопкою-танчиком -->
                <div id="broadcast-text-container" style="margin-bottom: 10px;">
                    <div style="display: flex; gap: 5px; align-items: flex-start;">
                        <textarea id="broadcast-text" rows="3" placeholder="Текст повідомлення..." style="flex: 1; padding: 7px; border: 1px solid #ccc; border-radius: 4px; resize: vertical; box-sizing: border-box; font-size: 13px;"></textarea>
                        <button type="button" onclick="toggleInlineEmojiPicker('text-emoji-box', 'broadcast-text')" style="background: #e2e8f0; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 16px;" title="Вибрати емодзі">🛡️</button>
                    </div>
                    <div id="text-emoji-box"></div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <button onclick="sendBroadcastMessage()" style="background: #27ae60; color: white; border: none; padding: 7px 16px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 13px;">📤 Надіслати сповіщення</button>
                    <button onclick="clearAllBroadcastHistory()" style="background: #c0392b; color: white; border: none; padding: 7px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px;" title="Очистити всю історію повідомлень">🗑️ Очистити історію</button>
                </div>
            </div>
        `;
    } else {
        html += `<p style="color: #7f8c8d; font-style: italic; font-size: 13px; margin-bottom: 15px;">📫 Архів офіційних сповіщень та листів для вашої ролі.</p>`;
    }

    html += `<h4 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 14px;">📥 Історія всіх повідомлень:</h4>`;
    
    const filteredMessages = allMessages.filter(m => {
        if (!m.target || m.target === 'all') return true;
        if (m.target === currentRoleName) return true;
        
        if (m.target === 'all_except_user' && currentRoleName !== 'user') return true;
        if (m.target === 'admin_moderator' && (currentRoleName === 'admin' || currentRoleName === 'moderator')) return true;
        if (m.target === 'dev_admin_moderator' && (currentRoleName === 'developer' || currentRoleName === 'admin' || currentRoleName === 'moderator')) return true;

        if (isAuthorizedWriter) return true;
        
        return false;
    });

    if (filteredMessages.length === 0) {
        html += `<p style="color: #7f8c8d; font-size: 13px;">Немає повідомлень в архіві.</p>`;
    } else {
        html += `<div style="display: flex; flex-direction: column; gap: 10px;">`;
        filteredMessages.forEach(m => {
            let targetBadge = "🌐 Усім";
            if (m.target === 'all_except_user') targetBadge = "⚡ Всім крім Юзерів";
            else if (m.target === 'admin') targetBadge = "🛡️ Адмінам";
            else if (m.target === 'moderator') targetBadge = "👮 Модераторам";
            else if (m.target === 'user') targetBadge = "👤 Юзерам";
            else if (m.target === 'admin_moderator') targetBadge = "🛡️👮 Адмінам і Модераторам";
            else if (m.target === 'dev_admin_moderator') targetBadge = "⚡🛡️👮 Керівництву";

            html += `
                <div style="background: #fff; padding: 12px; border-radius: 6px; border-left: 4px solid #2980b9; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <strong style="color: #2980b9; font-size: 14px;">📌 ${m.title}</strong>
                        <span style="font-size: 11px; color: #7f8c8d; background: #f1f2f6; padding: 2px 6px; border-radius: 3px;">${m.date} (${m.sender} ➔ ${targetBadge})</span>
                    </div>
                    <p style="margin: 0; color: #333; font-size: 13px; white-space: pre-wrap; line-height: 1.4;">${m.text}</p>
                </div>
            `;
        });
        html += `</div>`;
    }

    box.innerHTML = html;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

function sendBroadcastMessage() {
    const target = document.getElementById('broadcast-target').value;
    const title = document.getElementById('broadcast-title').value;
    const text = document.getElementById('broadcast-text').value;

    if (!title.trim() || !text.trim()) {
        alert("Будь ласка, заповніть тему та текст листа!");
        return;
    }

    const currentRoleName = (typeof currentRole !== 'undefined') ? currentRole : 'moderator';
    let senderName = 'Адмін';
    if (currentRoleName === 'developer') senderName = 'Розробник';
    else if (currentRoleName === 'moderator') senderName = 'Модератор';

    let broadcastStorage = getStoredBroadcasts();
    
    const newMsg = {
        id: Date.now(),
        sender: senderName,
        target: target,
        date: new Date().toLocaleString(),
        title: title,
        text: text
    };

    broadcastStorage.unshift(newMsg);
    localStorage.setItem('broadcastStorageList_v2', JSON.stringify(broadcastStorage));

    updateEnvelopeBlinkState();

    alert("Сповіщення успішно надіслано та зафіксовано!");
    openBroadcastMailModal();
}

function clearAllBroadcastHistory() {
    if (confirm("Ви дійсно хочете повністю очистити всю історію сповіщень?")) {
        localStorage.setItem('broadcastStorageList_v2', JSON.stringify([]));
        updateEnvelopeBlinkState();
        alert("Історію сповіщень успішно очищено!");
        openBroadcastMailModal();
    }
}

if (typeof selectRole === 'function') {
    const originalSelectRole = selectRole;
    selectRole = function(role) {
        originalSelectRole(role);
        setTimeout(updateEnvelopeBlinkState, 100);
    };
}

window.addEventListener('DOMContentLoaded', () => {
    updateEnvelopeBlinkState();
});

window.addEventListener('storage', (e) => {
    if (e.key === 'broadcastStorageList_v2' || (e.key && e.key.startsWith('lastReadBroadcastId'))) {
        updateEnvelopeBlinkState();
        const modal = document.getElementById('broadcast-mail-modal');
        if (modal) {
            openBroadcastMailModal();
        }
    }
});