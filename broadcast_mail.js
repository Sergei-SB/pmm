// ==========================================
// СИСТЕМНА ПОШТА ТА СПОВІЩЕННЯ (broadcast_mail.js)
// Повна ізоляція адресатів, розширені смайлики та історія
// ==========================================

let activeMailTab = 'inbox'; // 'inbox' | 'sent'
let lastFocusedInputId = 'broadcast-text';

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

// Перевірка видимості листа ВИКЛЮЧНО за адресатом (без жодних винятків)
function isMessageVisibleForRole(m, role) {
    if (!m) return false;
    const target = m.target || 'all';

    // 1. Загальне для всіх
    if (target === 'all') return true;

    // 2. Сувора адресна доставка для конкретної ролі:
    // "якщо відправляє хтось тільки адміну то бачить це письмо тільки адмін і так по кожному пункту"
    if (target === 'admin') return role === 'admin';
    if (target === 'moderator') return role === 'moderator';
    if (target === 'developer') return role === 'developer';
    if (target === 'user') return role === 'user';

    // 3. Групові варіанти
    if (target === 'all_except_user') return role !== 'user';
    if (target === 'admin_moderator') return (role === 'admin' || role === 'moderator');
    if (target === 'dev_admin') return (role === 'developer' || role === 'admin');
    if (target === 'dev_admin_moderator') return (role === 'developer' || role === 'admin' || role === 'moderator');

    return false;
}

function getUnreadMessagesForRole(role) {
    const allMessages = getStoredBroadcasts();
    const visible = allMessages.filter(m => isMessageVisibleForRole(m, role));
    if (visible.length === 0) return [];

    const readKey = `lastReadBroadcastId_${role}`;
    const lastReadId = Number(localStorage.getItem(readKey) || 0);

    return visible.filter(m => Number(m.id) > lastReadId);
}

function updateEnvelopeBlinkState() {
    const btn = document.getElementById('broadcast-envelope-btn');
    if (!btn) return;

    const currentRoleName = (typeof currentRole !== 'undefined') ? currentRole : 'user';
    const unread = getUnreadMessagesForRole(currentRoleName);

    // Видаляємо старий бейдж, якщо був
    const oldBadge = btn.querySelector('.mail-unread-badge');
    if (oldBadge) oldBadge.remove();

    if (unread.length > 0) {
        btn.classList.add('envelope-blinking');
        btn.title = `Системна пошта: ${unread.length} нових листів для ролі «${getRoleDisplayNameUa(currentRoleName)}»`;
        
        const badge = document.createElement('span');
        badge.className = 'mail-unread-badge';
        badge.textContent = unread.length > 99 ? '99+' : unread.length;
        badge.style.cssText = 'position: absolute; top: -6px; right: -6px; background: #e74c3c; color: white; border-radius: 10px; font-size: 10px; font-weight: bold; padding: 1px 5px; min-width: 14px; text-align: center; border: 1.5px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); pointer-events: none;';
        btn.style.position = 'relative';
        btn.appendChild(badge);
    } else {
        btn.classList.remove('envelope-blinking');
        btn.title = `Системна пошта (Поточна роль: ${getRoleDisplayNameUa(currentRoleName)})`;
        btn.style.backgroundColor = '#2980b9';
        btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    }
}

function getRoleDisplayNameUa(role) {
    if (role === 'developer') return 'Розробник 💻';
    if (role === 'admin') return 'Адмін 🛡️';
    if (role === 'moderator') return 'Модератор 👮';
    return 'Юзер 👤';
}

function getTargetBadgeInfo(target) {
    switch (target) {
        case 'admin':
            return { label: '🛡️ Тільки Адмінам', color: '#c0392b' };
        case 'moderator':
            return { label: '👮 Тільки Модераторам', color: '#16a085' };
        case 'developer':
            return { label: '💻 Тільки Розробникам', color: '#8e44ad' };
        case 'user':
            return { label: '👤 Тільки Юзерам', color: '#2980b9' };
        case 'admin_moderator':
            return { label: '🛡️👮 Адмінам і Модераторам', color: '#d35400' };
        case 'dev_admin':
            return { label: '💻🛡️ Розробникам і Адмінам', color: '#6c5ce7' };
        case 'dev_admin_moderator':
            return { label: '⚡🛡️👮 Керівництву', color: '#2c3e50' };
        case 'all_except_user':
            return { label: '⚡ Всім крім Юзерів', color: '#34495e' };
        case 'all':
        default:
            return { label: '🌐 Усім користувачам', color: '#27ae60' };
    }
}

// Вставка емодзі в активне або останнє вибране поле
function insertEmoji(fieldId, emoji) {
    const targetId = fieldId || lastFocusedInputId || 'broadcast-text';
    const field = document.getElementById(targetId);
    if (!field) return;

    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? field.value.length;
    const text = field.value;

    field.value = text.substring(0, start) + emoji + text.substring(end);
    field.focus();
    field.selectionStart = field.selectionEnd = start + emoji.length;
    lastFocusedInputId = targetId;
}

// Каталог смайликів з розширеними категоріями
const EMOJI_CATEGORIES = [
    {
        name: "😀 Смайлики, емоції та реакції",
        emojis: [
            '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
            '😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥',
            '😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','🤯','🤠','🥳','🥸','😎','🤓',
            '🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣',
            '😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'
        ]
    },
    {
        name: "🫡 Військова справа, ЗСУ, захист та зброя",
        emojis: [
            '🪖','🇺🇦','🎖️','🏆','🏅','🥇','🥈','🥉','⭐','🌟','🛡️','⚔️','🗡️','🎯','🚀','🛰️','📡','🚁','✈️','🛩️',
            '🛸','🧭','🗺️','🔭','🔬','🔦','🕯️','🦺','🥾','🎒','🧰','⚡','🔥','💥','🧨','⚠️','🚨','⛔','🚫','❌',
            '⭕','❗','❓','‼️','⁉️','✅','🟢','🟡','🔴','🔵','🟣','⚪','⚫','💯','🦅','⚓','🚩','🏴','🏳️','💪','🦾'
        ]
    },
    {
        name: "🚗 Автотранспорт, техніка, паливо та ПММ",
        emojis: [
            '⛽','🛢️','🚗','🚙','🛻','🚚','🚛','🚜','🏎️','🏍️','🛵','🚲','🛴','🚌','🚐','🚑','🚒','🚓','🚕','🛞',
            '🧰','🔧','🔩','⚙️','🗜️','🔋','🔌','💡','🔑','🗝️','🧯','🅿️','🚦','🚥','🚧','🛑','📦','🏷️','⚖️','📉',
            '📈','📊','📋','🧾','🛣️','🛤️','🗺️','⏱️','🧲','🔨'
        ]
    },
    {
        name: "👍 Жести, руки, люди та статуси",
        emojis: [
            '👍','👎','🫡','🤝','👏','🙌','👐','🤲','🙏','✍️','👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞',
            '🫰','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✊','👊','🤛','🤜','💅','🤳','💪','🦾','👂','👃','🧠',
            '👁️','👑','⚡','👮','👮‍♂️','👮‍♀️','🕵️','🕵️‍♂️','👷','🧑‍💻','👨‍💼','👩‍💼','🧑‍🔧','🧑‍🏫','🧑‍⚕️'
        ]
    },
    {
        name: "📄 Документи, пошта, канцелярія та офіс",
        emojis: [
            '✉️','📩','📨','📧','📬','📮','📁','📂','🗂️','📋','📌','📍','📎','🖇️','📏','📐','✂️','🖊️','🖋️','✒️',
            '📝','✏️','🔍','🔎','🗃️','🗄️','🗑️','💬','🗨️','💭','📢','📣','🔔','🔕','🔒','🔓','🔐','🔑','🏷️','💼'
        ]
    },
    {
        name: "☕ Кава, польова кухня, їжа та напої",
        emojis: [
            '☕','🍵','🥤','🧃','🧋','🥛','🍾','🍷','🍸','🍹','🍺','🍻','🥂','🥃','🍕','🍔','🍟','🌭','🍿','🥪',
            '🌮','🌯','🥗','🥙','🍝','🍜','🍲','🍛','🍚','🍙','🥟','🍣','🍱','🥩','🍗','🍖','🍞','🧀','🥐','🥖',
            '🥨','🥯','🥞','🧇','🍳','🥘','🥣','🍫','🍬','🍭','🎂','🍰','🧁','🍩','🍪','🍎','🍊','🍋','🍌','🍉'
        ]
    },
    {
        name: "🌤️ Погода, стихії, природа та час",
        emojis: [
            '☀️','🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄','🌬️','💨','🌪️','🌫️','🌈','💧','💦',
            '☔','☂️','⚡','🌊','🌍','🌎','🌏','🪐','🌙','🌕','🌑','⏱️','⏰','🕰️','⌛','⏳','📅','📆','🗓️','🌲','🌳'
        ]
    },
    {
        name: "❤️ Серця, прапори та кольорові символи",
        emojis: [
            '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💟',
            '🇺🇦','💎','💍','👑','✨','🌟','💥','🔥','⚡','⭐','💫','☮️','✝️','☪️','☯️','🆔','♾️','➕','➖','✔️'
        ]
    }
];

// Панель вибору смайликів
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
    container.style.cssText = 'background: #ffffff; border: 2px solid #2980b9; border-radius: 8px; padding: 12px; margin-top: 6px; max-height: 280px; overflow-y: auto; font-size: 22px; box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; z-index: 10020; box-shadow: 0 6px 18px rgba(0,0,0,0.15);';

    // Заголовок панелі
    const head = document.createElement('div');
    head.style.cssText = 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;';
    head.innerHTML = `<span style="font-size: 13px; font-weight: bold; color: #2c3e50;">🎭 Каталог смайликів та емодзі (натисніть, щоб вставити):</span>
                      <button type="button" onclick="this.closest('.inline-emoji-panel').remove()" style="background:#e74c3c; color:white; border:none; border-radius:3px; padding:2px 7px; font-size:11px; cursor:pointer; font-weight:bold;">✕</button>`;
    container.appendChild(head);

    EMOJI_CATEGORIES.forEach(cat => {
        const title = document.createElement('div');
        title.textContent = cat.name;
        title.style.cssText = 'font-size: 11px; font-weight: bold; color: #1e293b; background: #f1f5f9; padding: 3px 8px; border-radius: 4px; margin-top: 4px;';
        container.appendChild(title);

        const grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; padding: 2px;';

        cat.emojis.forEach(e => {
            const span = document.createElement('span');
            span.textContent = e;
            span.style.cssText = 'cursor: pointer; text-align: center; padding: 4px; border-radius: 4px; transition: all 0.1s; user-select: none; font-size: 20px;';
            span.onmouseover = () => {
                span.style.background = '#e0f2fe';
                span.style.transform = 'scale(1.25)';
            };
            span.onmouseout = () => {
                span.style.background = 'transparent';
                span.style.transform = 'scale(1)';
            };
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

// Генерація швидкої стрічки популярних смайликів
function renderQuickEmojiBar(fieldId) {
    const quickList = [
    
    ];
    let html = `<div style="display: flex; gap: 4px; overflow-x: auto; padding: 4px 2px; margin-bottom: 6px; align-items: center; border-bottom: 1px dashed #cbd5e1; user-select: none;">`;
   
    quickList.forEach(e => {
        html += `<span onclick="insertEmoji('${fieldId}', '${e}')" title="Вставити ${e}" style="cursor: pointer; font-size: 18px; padding: 2px 4px; border-radius: 4px; transition: transform 0.1s; display: inline-block;" onmouseover="this.style.background='#e2e8f0'; this.style.transform='scale(1.2)';" onmouseout="this.style.background='transparent'; this.style.transform='scale(1)';">${e}</span>`;
    });
    html += `</div>`;
    return html;
}

// Відкриття модального вікна пошти
function openBroadcastMailModal(tab) {
    if (tab) activeMailTab = tab;

    const allMessages = getStoredBroadcasts();
    const currentRoleName = (typeof currentRole !== 'undefined') ? currentRole : 'user';

    // Повідомлення, що видимі поточній ролі у «Вхідних»
    const visibleInbox = allMessages.filter(m => isMessageVisibleForRole(m, currentRoleName));

    // Повідомлення, надіслані цією роллю
    const sentByMe = allMessages.filter(m => {
        if (m.senderRole) return m.senderRole === currentRoleName;
        if (currentRoleName === 'developer') return m.sender === 'Розробник';
        if (currentRoleName === 'admin') return m.sender === 'Адмін';
        if (currentRoleName === 'moderator') return m.sender === 'Модератор';
        return m.sender === 'Юзер';
    });

    // Оновлюємо відмітку прочитаного: фіксуємо максимальний ID тільки з тих, що бачить ця роль!
    if (visibleInbox.length > 0) {
        const latestVisibleId = Math.max(...visibleInbox.map(m => Number(m.id) || 0));
        const readKey = getLastReadIdKey();
        localStorage.setItem(readKey, String(latestVisibleId));
    }
    updateEnvelopeBlinkState();

    const oldModal = document.getElementById('broadcast-mail-modal');
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'broadcast-mail-modal';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.65); backdrop-filter: blur(2px); display: flex; justify-content: center; align-items: center; z-index: 10005; padding: 15px; box-sizing: border-box;';

    const box = document.createElement('div');
    box.style.cssText = 'background: white; border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,0.4); width: 680px; max-width: 100%; max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; box-sizing: border-box;';

    // ШАПКА
    let headerHtml = `
        <div style="background: #2c3e50; color: white; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 22px;">✉️</span>
                <div>
                    <h3 style="margin: 0; font-size: 17px; font-weight: bold; color: white;">Системна пошта та сповіщення</h3>
                    <div style="font-size: 11px; color: #cbd5e1; margin-top: 2px;">
                        Ваш кабінет: <strong style="color: #f1c40f;">${getRoleDisplayNameUa(currentRoleName)}</strong>
                    </div>
                </div>
            </div>
            <button onclick="document.getElementById('broadcast-mail-modal').remove()" style="background: rgba(255,255,255,0.15); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px; transition: background 0.1s;" onmouseover="this.style.background='#e74c3c'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">✕</button>
        </div>
    `;

    // ВКЛАДКИ (Вхідні / Надіслані)
    let tabsHtml = `
        <div style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; padding: 8px 16px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <div style="display: flex; gap: 6px;">
                <button onclick="openBroadcastMailModal('inbox')" style="padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: bold; cursor: pointer; border: 1px solid ${activeMailTab === 'inbox' ? '#2980b9' : '#cbd5e1'}; background: ${activeMailTab === 'inbox' ? '#2980b9' : 'white'}; color: ${activeMailTab === 'inbox' ? 'white' : '#334155'};">
                    📥 Вхідні листи (${visibleInbox.length})
                </button>
                <button onclick="openBroadcastMailModal('sent')" style="padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: bold; cursor: pointer; border: 1px solid ${activeMailTab === 'sent' ? '#2980b9' : '#cbd5e1'}; background: ${activeMailTab === 'sent' ? '#2980b9' : 'white'}; color: ${activeMailTab === 'sent' ? 'white' : '#334155'};">
                    📤 Надіслані мною (${sentByMe.length})
                </button>
            </div>
            <div style="display: flex; gap: 6px;">
                ${(currentRoleName === 'developer' || currentRoleName === 'admin') ? `
                    <button onclick="clearAllBroadcastHistory()" style="background: #f87171; color: white; border: none; padding: 5px 10px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px;" title="Очистити всю історію листів">🗑️ Очистити архів</button>
                ` : ''}
            </div>
        </div>
    `;

    // ТІЛО (ФОРМА ВІДПРАВКИ + СПИСОК ПОВІДОМЛЕНЬ)
    let contentHtml = `<div style="padding: 16px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px;">`;

    // ФОРМА НАПИСАННЯ НОВОГО ЛИСТА
    contentHtml += `
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h4 style="margin: 0; color: #1e293b; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                    <span>✍️</span> <strong>Створити новий лист</strong> 
                    <small style="color: #64748b; font-weight: normal;">(від імені: ${getRoleDisplayNameUa(currentRoleName)})</small>
                </h4>
            </div>

            <!-- Вибір адресата -->
            <label style="display: block; font-weight: bold; font-size: 12px; margin-bottom: 4px; color: #334155;">
                🎯 Адресат (кому надіслати):
            </label>
            <select id="broadcast-target" style="width: 100%; padding: 8px; margin-bottom: 10px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-size: 13px; background: white; color: #1e293b; font-weight: 500;">
                <option value="admin">🛡️ Тільки Адмінам (побачить виключно Адміністратор)</option>
                <option value="moderator">👮 Тільки Модераторам (побачить виключно Модератор)</option>
                <option value="developer">💻 Тільки Розробникам (побачить виключно Розробник)</option>
                <option value="user">👤 Тільки Юзерам (побачить виключно звичайний Юзер)</option>
                <option value="admin_moderator">🛡️👮 Тільки Адмінам і Модераторам</option>
                <option value="dev_admin">💻🛡️ Тільки Розробникам і Адмінам</option>
                <option value="dev_admin_moderator">⚡🛡️👮 Для Розробників, Адмінів і Модераторів</option>
                <option value="all_except_user">⚡ Всім крім Юзерів (Командний склад)</option>
                <option value="all">🌐 Усім користувачам системи (Загальне оголошення для всіх)</option>
            </select>

            <!-- Швидка панель смайликів -->
            ${renderQuickEmojiBar('broadcast-text')}

            <!-- Поле Тема -->
            <div id="broadcast-title-container" style="margin-bottom: 8px;">
                <div style="display: flex; gap: 6px; align-items: center;">
                    <input type="text" id="broadcast-title" onfocus="lastFocusedInputId='broadcast-title'" placeholder="📌 Тема листа / сповіщення..." style="flex: 1; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-size: 13px;">
                    <button type="button" onclick="toggleInlineEmojiPicker('title-emoji-box', 'broadcast-title')" style="background: #e2e8f0; border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 11px; cursor: pointer; font-size: 15px; font-weight: bold; color: #1e293b; white-space: nowrap; display: flex; align-items: center; gap: 4px;" title="Відкрити повний каталог смайликів">
                        <span>🛡️</span> <small style="font-size: 11px;">Смайлики</small>
                    </button>
                </div>
                <div id="title-emoji-box"></div>
            </div>

            <!-- Поле Текст -->
            <div id="broadcast-text-container" style="margin-bottom: 10px;">
                <div style="display: flex; gap: 6px; align-items: flex-start;">
                    <textarea id="broadcast-text" rows="3" onfocus="lastFocusedInputId='broadcast-text'" placeholder="💬 Текст листа або повідомлення... (Використовуйте смайлики з панелі нижче або вгорі)" style="flex: 1; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; resize: vertical; box-sizing: border-box; font-size: 13px; line-height: 1.4;"></textarea>
                    <button type="button" onclick="toggleInlineEmojiPicker('text-emoji-box', 'broadcast-text')" style="background: #e2e8f0; border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 11px; cursor: pointer; font-size: 15px; font-weight: bold; color: #1e293b; white-space: nowrap; display: flex; align-items: center; gap: 4px;" title="Відкрити повний каталог смайликів">
                        <span>🛡️</span> <small style="font-size: 11px;">Смайлики</small>
                    </button>
                </div>
                <div id="text-emoji-box"></div>
            </div>

            <!-- Кнопка Відправити -->
            <div style="display: flex; justify-content: flex-end; align-items: center;">
                <button onclick="sendBroadcastMessage()" style="background: #27ae60; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(39, 174, 96, 0.3);">
                    <span>📤</span> Надіслати лист адресату
                </button>
            </div>
        </div>
    `;

    // СПИСОК ПОВІДОМЛЕНЬ В ЗАЛЕЖНОСТІ ВІД ВКЛАДКИ
    const displayList = (activeMailTab === 'inbox') ? visibleInbox : sentByMe;
    const tabTitle = (activeMailTab === 'inbox') ? '📥 Отримані листи для вашої ролі:' : '📤 Листи, які ви надіслали:';

    contentHtml += `
        <div>
            <h4 style="margin: 0 0 10px 0; color: #1e293b; font-size: 14px; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                <span>${tabTitle}</span>
                <span style="font-size: 12px; color: #64748b; font-weight: normal;">Всього: ${displayList.length}</span>
            </h4>
    `;

    if (displayList.length === 0) {
        contentHtml += `
            <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 25px; text-align: center; color: #64748b;">
                <div style="font-size: 32px; margin-bottom: 6px;">📭</div>
                <div style="font-size: 13px; font-weight: 500;">
                    ${activeMailTab === 'inbox' ? 'Немає вхідних повідомлень для вашої ролі.' : 'Ви ще не надсилали жодного листа.'}
                </div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">
                    ${activeMailTab === 'inbox' ? 'Листи, надіслані іншим категоріям (наприклад тільки Адміну чи тільки Модератору), суворо приховані від сторонніх очей.' : 'Надішліть свій перший лист за формою вище.'}
                </div>
            </div>
        `;
    } else {
        contentHtml += `<div style="display: flex; flex-direction: column; gap: 10px;">`;
        displayList.forEach(m => {
            const badge = getTargetBadgeInfo(m.target);
            const canDeleteThis = (currentRoleName === 'developer' || currentRoleName === 'admin' || (m.senderRole && m.senderRole === currentRoleName));

            contentHtml += `
                <div style="background: white; padding: 12px 14px; border-radius: 8px; border: 1px solid #e2e8f0; border-left: 4px solid ${badge.color}; box-shadow: 0 1px 3px rgba(0,0,0,0.05); position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 6px;">
                        <div style="font-weight: bold; color: #1e293b; font-size: 14px;">
                            ${m.title}
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                            <span style="font-size: 11px; background: ${badge.color}15; color: ${badge.color}; border: 1px solid ${badge.color}40; padding: 2px 7px; border-radius: 4px; font-weight: bold;">
                                ${badge.label}
                            </span>
                            <span style="font-size: 11px; color: #64748b; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">
                                ${m.date}
                            </span>
                            ${canDeleteThis ? `
                                <button onclick="deleteSingleBroadcastMessage(${m.id})" title="Видалити цей лист" style="background: transparent; border: none; cursor: pointer; color: #94a3b8; padding: 2px 4px; font-size: 12px; border-radius: 3px;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">🗑️</button>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
                        Відправник: <strong style="color: #334155;">${m.sender || 'Невідомий'}</strong> 
                        ${m.senderRole ? `(${getRoleDisplayNameUa(m.senderRole)})` : ''}
                    </div>

                    <div style="color: #334155; font-size: 13px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; background: #f8fafc; padding: 8px 10px; border-radius: 6px; border: 1px solid #f1f5f9;">
                        ${m.text}
                    </div>
                </div>
            `;
        });
        contentHtml += `</div>`;
    }

    contentHtml += `</div></div>`; // кінець списку і контенту

    box.innerHTML = headerHtml + tabsHtml + contentHtml;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

// Надсилання сповіщення
function sendBroadcastMessage() {
    const target = document.getElementById('broadcast-target')?.value || 'all';
    const title = document.getElementById('broadcast-title')?.value || '';
    const text = document.getElementById('broadcast-text')?.value || '';

    if (!title.trim() || !text.trim()) {
        alert("Будь ласка, заповніть тему та текст листа!");
        return;
    }

    const currentRoleName = (typeof currentRole !== 'undefined') ? currentRole : 'user';
    let senderName = 'Юзер';
    if (currentRoleName === 'developer') senderName = 'Розробник';
    else if (currentRoleName === 'admin') senderName = 'Адмін';
    else if (currentRoleName === 'moderator') senderName = 'Модератор';

    let broadcastStorage = getStoredBroadcasts();

    const newMsg = {
        id: Date.now(),
        sender: senderName,
        senderRole: currentRoleName,
        target: target,
        date: new Date().toLocaleString(),
        title: title.trim(),
        text: text.trim()
    };

    broadcastStorage.unshift(newMsg);
    localStorage.setItem('broadcastStorageList_v2', JSON.stringify(broadcastStorage));

    // Якщо поточна роль є адресатом — позначаємо прочитаним, щоб свій же лист не блимав
    if (isMessageVisibleForRole(newMsg, currentRoleName)) {
        localStorage.setItem(getLastReadIdKey(), String(newMsg.id));
    }

    updateEnvelopeBlinkState();

    const targetInfo = getTargetBadgeInfo(target);
    alert(`Лист успішно надіслано!\nАдресат: ${targetInfo.label}\nЛист побачать виключно призначені користувачі.`);

    // Якщо це була вкладка «Надіслані» або роль не бачить лист у вхідних — відкриваємо вкладку «sent»
    if (!isMessageVisibleForRole(newMsg, currentRoleName)) {
        openBroadcastMailModal('sent');
    } else {
        openBroadcastMailModal('inbox');
    }
}

// Видалення одного листа
function deleteSingleBroadcastMessage(msgId) {
    if (!confirm("Ви дійсно хочете видалити цей лист?")) return;

    let broadcastStorage = getStoredBroadcasts();
    broadcastStorage = broadcastStorage.filter(m => Number(m.id) !== Number(msgId));
    localStorage.setItem('broadcastStorageList_v2', JSON.stringify(broadcastStorage));

    updateEnvelopeBlinkState();
    openBroadcastMailModal(activeMailTab);
}

// Повне очищення історії
function clearAllBroadcastHistory() {
    if (confirm("Ви дійсно хочете повністю очистити всю історію системної пошти?")) {
        localStorage.setItem('broadcastStorageList_v2', JSON.stringify([]));
        updateEnvelopeBlinkState();
        alert("Історію сповіщень успішно очищено!");
        openBroadcastMailModal(activeMailTab);
    }
}

// Перехоплення selectRole для миттєвого оновлення стану конверта при зміні ролі
if (typeof selectRole === 'function') {
    const originalSelectRole = selectRole;
    selectRole = function(role) {
        originalSelectRole(role);
        setTimeout(updateEnvelopeBlinkState, 50);
    };
}

// Глобальний експорт функцій
window.openBroadcastMailModal = openBroadcastMailModal;
window.sendBroadcastMessage = sendBroadcastMessage;
window.clearAllBroadcastHistory = clearAllBroadcastHistory;
window.deleteSingleBroadcastMessage = deleteSingleBroadcastMessage;
window.updateEnvelopeBlinkState = updateEnvelopeBlinkState;
window.toggleInlineEmojiPicker = toggleInlineEmojiPicker;
window.insertEmoji = insertEmoji;

window.addEventListener('DOMContentLoaded', () => {
    updateEnvelopeBlinkState();
});

window.addEventListener('storage', (e) => {
    if (e.key === 'broadcastStorageList_v2' || (e.key && e.key.startsWith('lastReadBroadcastId'))) {
        updateEnvelopeBlinkState();
        const modal = document.getElementById('broadcast-mail-modal');
        if (modal) {
            openBroadcastMailModal(activeMailTab);
        }
    }
});