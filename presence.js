// =========================================================================
// presence.js — МОНІТОРИНГ ОНЛАЙН-КОРИСТУВАЧІВ ТА СИСТЕМА БАНУ В РЕАЛЬНОМУ ЧАСІ
// =========================================================================

(function () {
    'use strict';

    // Presence and data synchronization must use the same server on every device.
    window.APP_SERVER_URL = window.APP_SERVER_URL || 'https://pmm-server.onrender.com';
    var HEARTBEAT_INTERVAL_MS = 3000;
    var heartbeatInFlight = null;

    window.presenceRequest = async function (route, options) {
        var controller = new AbortController();
        var timeout = setTimeout(function () { controller.abort(); }, 20000);
        try {
            var base = String(window.APP_SERVER_URL).replace(/\/+$/, '');
            var response = await fetch(base + '/api/presence/' + route, Object.assign({}, options, {
                cache: 'no-store', signal: controller.signal
            }));
            if (!response.ok) throw new Error('Сервер онлайн-моніторингу: HTTP ' + response.status);
            var data = await response.json();
            if (data.ok === false) throw new Error(data.error || 'Помилка сервера онлайн-моніторингу');
            return data;
        } finally {
            clearTimeout(timeout);
        }
    };
    var DEVICE_KEY = '__sync_device_id_v1';
    var OVERLAY_ID = 'app-banned-screen-overlay';
    var clientIpCache = '';
    var isCurrentlyBanned = false;
    var heartbeatTimer = null;

    function getDeviceId() {
        var raw = localStorage.getItem(DEVICE_KEY);
        var id = raw;
        try { id = JSON.parse(raw); } catch (e) {}
        if (typeof id !== 'string' || !id.trim()) {
            id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        }
        // Shared_sync.js stores this key as JSON; use the same encoding.
        if (raw !== JSON.stringify(id)) localStorage.setItem(DEVICE_KEY, JSON.stringify(id));
        return id;
    }

    function getActiveRole() {
        if (typeof window.getCurrentAppRole === 'function') {
            return window.getCurrentAppRole();
        }
        return window.currentRole || 'user';
    }

    function getActiveUserName() {
        var custom = localStorage.getItem('active_user_callsign') || localStorage.getItem('current_user_name');
        if (custom && custom.trim()) return custom.trim();

        var r = getActiveRole();
        if (r === 'developer' || r === 'dev') return 'Головний Розробник';
        if (r === 'admin') return 'Черговий Адмін ПММ';
        if (r === 'moderator') return 'Модератор Звітів';
        return 'Оператор обліку (Юзер)';
    }

    function getActiveSubdivision() {
        var sub = localStorage.getItem('active_user_subdivision');
        if (sub && sub.trim()) return sub.trim();
        var r = getActiveRole();
        if (r === 'developer' || r === 'dev') return 'Штаб / IT';
        if (r === 'admin') return 'Служба ПММ';
        if (r === 'moderator') return '1БрОП';
        return 'РМТЗ';
    }

    function getCurrentPageName() {
        var activeSec = document.querySelector('.view-section.active');
        if (!activeSec) return 'База (Реєстр)';
        var id = activeSec.id;
        if (id.includes('base')) return 'База (Реєстр)';
        if (id.includes('card')) return 'Картка авто';
        if (id.includes('equipment-report')) return 'Звіт по обладнанню';
        if (id.includes('generators')) return 'Облік обладнання';
        if (id.includes('report')) return 'Звіт (10 днів)';
        if (id.includes('subdivisions')) return 'Звіт по підрозділах';
        if (id.includes('aggregates')) return 'Розрахунок агрегатів';
        if (id.includes('destroyed')) return 'Знищена техніка';
        if (id.includes('documents')) return 'Документи та Шаблони';
        if (id.includes('dev-panel')) return 'Панель розробника';
        return id;
    }

    // --- ВІДОБРАЖЕННЯ НАПІВПРОЗОРОГО НАПИСУ БАНУ ---
    function showBanOverlay(reason, ip) {
        isCurrentlyBanned = true;
        var existing = document.getElementById(OVERLAY_ID);
        if (!existing) {
            existing = document.createElement('div');
            existing.id = OVERLAY_ID;
            existing.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                z-index: 2147483647;
                background: rgba(15, 23, 42, 0.88);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #ffffff;
                text-align: center;
                padding: 30px;
                box-sizing: border-box;
                user-select: none;
                pointer-events: all;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                animation: fadeInBan 0.3s ease-out;
            `;

            existing.innerHTML = `
                <div style="max-width: 780px; width: 100%; display: flex; flex-direction: column; align-items: center;">
                    <div style="font-size: 80px; line-height: 1; margin-bottom: 20px; filter: drop-shadow(0 0 25px rgba(239, 68, 68, 0.6));">
                        ⛔
                    </div>
                    <h1 id="ban-overlay-title" style="font-size: 38px; line-height: 1.25; font-weight: 900; color: #ff4d4f; margin: 0 0 16px 0; text-shadow: 0 4px 30px rgba(255, 77, 79, 0.6); text-transform: uppercase; letter-spacing: 1.5px;">
                        Вас забанив розробник зверніться до нього
                    </h1>
                    <p id="ban-overlay-desc" style="font-size: 17px; color: #e2e8f0; line-height: 1.6; max-width: 620px; margin: 0 0 24px 0; font-weight: 500;">
                        Доступ до перегляду та редагування бази даних, обліку техніки та модулів сайту повністю призупинено.
                    </p>
                    <div style="background: rgba(0, 0, 0, 0.45); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 10px; padding: 14px 24px; font-size: 14px; color: #94a3b8; display: flex; gap: 24px; flex-wrap: wrap; justify-content: center;">
                        <span>Ваша IP-адреса: <strong id="ban-overlay-ip" style="color: #38bdf8;">${ip || clientIpCache || 'Визначається...'}</strong></span>
                        <span>Статус: <strong style="color: #ef4444; background: rgba(239,68,68,0.2); padding: 2px 8px; border-radius: 4px;">🚫 ЗАБЛОКОВАНО</strong></span>
                    </div>
                </div>
            `;
            document.body.appendChild(existing);
        } else {
            var ipSpan = document.getElementById('ban-overlay-ip');
            if (ipSpan && (ip || clientIpCache)) {
                ipSpan.textContent = ip || clientIpCache;
            }
        }

        // Блокуємо прокрутку тіла сторінки
        document.body.style.overflow = 'hidden';
    }

    function removeBanOverlay() {
        isCurrentlyBanned = false;
        var existing = document.getElementById(OVERLAY_ID);
        if (existing) {
            existing.remove();
        }
        document.body.style.overflow = '';
    }

    // Блокування клавіатури для забаненого користувача
    window.addEventListener('keydown', function (e) {
        if (isCurrentlyBanned) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, true);

    window.addEventListener('contextmenu', function (e) {
        if (isCurrentlyBanned) {
            e.preventDefault();
            return false;
        }
    }, true);

    // --- ВІДПРАВКА HEARTBEAT НА СЕРВЕР ---
    function sendHeartbeat() {
        if (!heartbeatInFlight) {
            heartbeatInFlight = performHeartbeat().finally(function () { heartbeatInFlight = null; });
        }
        return heartbeatInFlight;
    }

    async function performHeartbeat() {
        try {
            var payload = {
                deviceId: getDeviceId(),
                role: getActiveRole(),
                userName: getActiveUserName(),
                subdivision: getActiveSubdivision(),
                currentView: getCurrentPageName()
            };

            var data = await window.presenceRequest('heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (data.clientIp) {
                clientIpCache = data.clientIp;
            }

            if (data.isBanned) {
                showBanOverlay(data.reason, data.clientIp);
            } else {
                if (isCurrentlyBanned) {
                    removeBanOverlay();
                }
            }
        } catch (e) {
            // У разі помилки зв'язку перевіряємо локальний список банів
            checkLocalBans();
        }
    }

    function checkLocalBans() {
        try {
            var localBans = JSON.parse(localStorage.getItem('dev_banned_clients_v1') || '[]');
            var devId = getDeviceId();
            var userName = getActiveUserName().toLowerCase();
            var found = localBans.some(function (b) {
                if (b.targetType === 'device' && b.targetValue === devId) return true;
                if (b.targetType === 'user' && b.targetValue.toLowerCase() === userName) return true;
                if (b.targetType === 'ip' && clientIpCache && b.targetValue === clientIpCache) return true;
                return false;
            });

            if (found) {
                showBanOverlay('Вас забанив розробник зверніться до нього', clientIpCache);
            } else if (isCurrentlyBanned) {
                removeBanOverlay();
            }
        } catch (e) {}
    }

    // --- ПУБЛІЧНИЙ API ДЛЯ ПАНЕЛІ РОЗРОБНИКА ---
    window.fetchOnlineUsers = async function () {
        await sendHeartbeat();
        var data = await window.presenceRequest('online');
        if (!Array.isArray(data.sessions)) throw new Error('Сервер повернув некоректний список пристроїв');
        return data.sessions;
    };

    window.banTarget = async function (targetType, targetValue, targetName, reason) {
        try {
            await window.presenceRequest('ban', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetType: targetType,
                    targetValue: targetValue,
                    targetName: targetName || targetValue,
                    reason: reason || 'Вас забанив розробник зверніться до нього',
                    bannedBy: 'Головний Розробник'
                })
            });

            // Дублюємо у локальне сховище для надійності
            var localBans = JSON.parse(localStorage.getItem('dev_banned_clients_v1') || '[]');
            localBans.push({ targetType: targetType, targetValue: targetValue, targetName: targetName });
            localStorage.setItem('dev_banned_clients_v1', JSON.stringify(localBans));

            if (typeof window.showToastNotification === 'function') {
                window.showToastNotification('🚫 Користувача/IP ' + (targetName || targetValue) + ' успішно заблоковано!', '#c0392b');
            }

            // Перевіряємо свій статус негайно
            sendHeartbeat();
            if (typeof window.renderDeveloperPanel === 'function') {
                window.renderDeveloperPanel();
            }
            return true;
        } catch (e) {
            console.error('Помилка блокування:', e);
            return false;
        }
    };

    window.unbanTarget = async function (targetValue) {
        try {
            await window.presenceRequest('unban', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetValue: targetValue })
            });

            var localBans = JSON.parse(localStorage.getItem('dev_banned_clients_v1') || '[]');
            localBans = localBans.filter(function (b) { return b.targetValue !== targetValue; });
            localStorage.setItem('dev_banned_clients_v1', JSON.stringify(localBans));

            if (typeof window.showToastNotification === 'function') {
                window.showToastNotification('✅ Блокування для ' + targetValue + ' успішно знято!', '#27ae60');
            }

            sendHeartbeat();
            if (typeof window.renderDeveloperPanel === 'function') {
                window.renderDeveloperPanel();
            }
            return true;
        } catch (e) {
            console.error('Помилка розблокування:', e);
            return false;
        }
    };

    window.updateCallsignBadge = function() {
        var el = document.getElementById('user-callsign-display');
        if (el) {
            var name = localStorage.getItem('active_user_callsign');
            el.textContent = name ? (name + ' ✎') : 'Вказати ✎';
        }
    };

    window.promptSetUserCallsign = function() {
        if (typeof window.canRoleDo === 'function' && !window.canRoleDo(getActiveRole(), 'user_callsign')) return;
        var current = localStorage.getItem('active_user_callsign') || '';
        var inputModal = document.createElement('div');
        inputModal.id = 'callsign-prompt-modal';
        inputModal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.6); z-index: 100000;
            display: flex; align-items: center; justify-content: center;
        `;
        inputModal.innerHTML = `
            <div style="background: white; border-radius: 8px; padding: 20px; width: 340px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); font-family: sans-serif;">
                <h3 style="margin-top: 0; margin-bottom: 12px; color: #1e293b; font-size: 16px;">Вкажіть ваш позивний або ПІБ</h3>
                <p style="font-size: 12px; color: #64748b; margin-bottom: 12px;">Це імʼя буде відображатись у моніторингу активних користувачів на сайті.</p>
                <input type="text" id="callsign-input-field" value="${current}" placeholder="Напр: Ворон / Іванов І.І." style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; margin-bottom: 15px;">
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button type="button" id="callsign-cancel-btn" style="padding: 6px 12px; border: 1px solid #cbd5e1; background: #f1f5f9; border-radius: 4px; cursor: pointer; font-size: 12px;">Скасувати</button>
                    <button type="button" id="callsign-save-btn" style="padding: 6px 14px; border: none; background: #2563eb; color: white; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">Зберегти</button>
                </div>
            </div>
        `;
        document.body.appendChild(inputModal);
        var input = document.getElementById('callsign-input-field');
        input.focus();
        input.select();

        document.getElementById('callsign-cancel-btn').onclick = function() {
            inputModal.remove();
        };
        var handleSave = function() {
            var val = (input.value || '').trim();
            if (val) {
                localStorage.setItem('active_user_callsign', val);
            } else {
                localStorage.removeItem('active_user_callsign');
            }
            inputModal.remove();
            window.updateCallsignBadge();
            sendHeartbeat();
            if (typeof window.showToastNotification === 'function') {
                window.showToastNotification('✅ Позивний / ПІБ оновлено!', '#27ae60');
            }
        };
        document.getElementById('callsign-save-btn').onclick = handleSave;
        input.onkeydown = function(e) {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') inputModal.remove();
        };
    };

    window.refreshPresenceHeartbeat = sendHeartbeat;

    // Запуск відстеження
    document.addEventListener('DOMContentLoaded', function () {
        window.updateCallsignBadge();
        sendHeartbeat();
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    });

    window.addEventListener('online', sendHeartbeat);

    window.addEventListener('focus', function() {
        window.updateCallsignBadge();
        sendHeartbeat();
    });
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) sendHeartbeat();
    });

})();

