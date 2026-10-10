// ==========================================
// СИСТЕМНА ПОШТА (broadcast_mail.js)
// ==========================================

let broadcastStorage = [
    { id: 1, sender: "Розробник", role: "developer", date: "10.10.2026 01:50", title: "Оновлення безпеки системи", text: "Увага всім користувачам! Оновлено протоколи захисту та правила ієрархії." }
];

// За замовчуванням нових непрочитаних листів немає (конверт НЕ блимає)
let hasUnreadBroadcasts = false; 

function updateEnvelopeBlinkState() {
    const btn = document.getElementById('broadcast-envelope-btn');
    if (!btn) return;

    if (hasUnreadBroadcasts) {
        btn.classList.add('envelope-blinking');
    } else {
        btn.classList.remove('envelope-blinking');
        btn.style.backgroundColor = '#2980b9';
        btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    }
}

function openBroadcastMailModal() {
    // Користувач відкрив пошту — позначаємо все як прочитане і вимикаємо блимання
    hasUnreadBroadcasts = false;
    updateEnvelopeBlinkState();

    const oldModal = document.getElementById('broadcast-mail-modal');
    if (oldModal) oldModal.remove();

    const isAuthorizedWriter = (typeof currentRole !== 'undefined' && (currentRole === 'developer' || currentRole === 'admin'));

    const overlay = document.createElement('div');
    overlay.id = 'broadcast-mail-modal';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 10005; padding: 20px; box-sizing: border-box;';

    const box = document.createElement('div');
    box.style.cssText = 'background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); width: 550px; max-width: 100%; max-height: 90vh; overflow-y: auto; font-family: Arial, sans-serif; box-sizing: border-box;';

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2c3e50; padding-bottom: 10px; margin-bottom: 15px;">
            <h3 style="margin: 0; color: #2c3e50; font-size: 18px;">✉️ Системна пошта (Оголошення для всіх)</h3>
            <button onclick="document.getElementById('broadcast-mail-modal').remove()" style="background: #c0392b; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: bold;">✕</button>
        </div>
    `;

    if (isAuthorizedWriter) {
        html += `
            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #cbd5e1; margin-bottom: 20px;">
                <h4 style="margin: 0 0 8px 0; color: #2c3e50; font-size: 14px;">✍️ Написати новий лист (Доступно Розробнику та Адміну)</h4>
                <input type="text" id="broadcast-title" placeholder="Тема листа..." style="width: 100%; padding: 6px; margin-bottom: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                <textarea id="broadcast-text" rows="3" placeholder="Повідомлення для всіх користувачів..." style="width: 100%; padding: 6px; margin-bottom: 8px; border: 1px solid #ccc; border-radius: 4px; resize: vertical; box-sizing: border-box;"></textarea>
                <button onclick="sendBroadcastMessage()" style="background: #27ae60; color: white; border: none; padding: 6px 14px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px;">📤 Надіслати всім</button>
            </div>
        `;
    } else {
        html += `<p style="color: #7f8c8d; font-style: italic; font-size: 13px; margin-bottom: 15px;">📫 Офіційні сповіщення від керівництва системи для всіх користувачів.</p>`;
    }

    html += `<h4 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 14px;">📥 Усі отримані листи та оголошення:</h4>`;
    
    if (broadcastStorage.length === 0) {
        html += `<p style="color: #7f8c8d; font-size: 13px;">Немає повідомлень.</p>`;
    } else {
        html += `<div style="display: flex; flex-direction: column; gap: 10px;">`;
        broadcastStorage.forEach(m => {
            html += `
                <div style="background: #fff; padding: 12px; border-radius: 6px; border-left: 4px solid #2980b9; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <strong style="color: #2980b9; font-size: 14px;">📌 ${m.title}</strong>
                        <span style="font-size: 11px; color: #7f8c8d; background: #f1f2f6; padding: 2px 6px; border-radius: 3px;">${m.date} (${m.sender})</span>
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
    const title = document.getElementById('broadcast-title').value;
    const text = document.getElementById('broadcast-text').value;

    if (!title.trim() || !text.trim()) {
        alert("Будь ласка, заповніть тему та текст листа!");
        return;
    }

    const senderName = (typeof currentRole !== 'undefined' && currentRole === 'developer') ? 'Розробник' : 'Адмін';

    broadcastStorage.unshift({
        id: Date.now(),
        sender: senderName,
        role: typeof currentRole !== 'undefined' ? currentRole : 'admin',
        date: new Date().toLocaleString(),
        title: title,
        text: text
    });

    // З'явився новий непрочитаний лист — активуємо блимання конверта
    hasUnreadBroadcasts = true;
    updateEnvelopeBlinkState();

    alert("Офіційний лист успішно надіслано всім користувачам системи!");
    document.getElementById('broadcast-mail-modal').remove();
    openBroadcastMailModal();
}

window.addEventListener('DOMContentLoaded', () => {
    updateEnvelopeBlinkState();
});