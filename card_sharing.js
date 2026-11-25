(() => {
    const labels = {admin: 'Адмін', moderator: 'Модератор', user: 'Юзер'};
    const sessions = new Map();
    const cards = new Map();
    const controls = document.createElement('span');
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    let role = 'user';
    let active;
    let pending = Promise.resolve();

    const currentRole = () => window.getCurrentAppRole?.() ?? window.currentRole ?? 'user';
    const cardKey = (id, period) => JSON.stringify([String(id), period]);
    const result = (text) => { status.textContent = text; };
    const redraw = () => {
        if (typeof loadCarDataForActivePeriod === 'function') loadCarDataForActivePeriod();
    };

    async function request(card, action, fields = {}) {
        const {id, period, owner, session} = card;
        if (owner !== 'user' && !session) throw new Error('Потрібно повторно увійти під своєю роллю.');
        const base = window.APP_SERVER_URL || 'https://pmm-server.onrender.com';
        const response = await fetch(base + '/api/vehicle-cards/' + encodeURIComponent(id) + '/' + encodeURIComponent(period), {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action, session, ...fields}),
            signal: AbortSignal.timeout(20000)
        });
        if (!response.ok) throw new Error(response.status === 401
            ? 'Потрібно повторно увійти під своєю роллю.' : 'Сервер карток недоступний або відхилив запит.');
        return response.json();
    }

    function addButton(title, handler) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'action-btn';
        button.textContent = title;
        button.onclick = handler;
        controls.append(button);
        return button;
    }

    function renderControls() {
        controls.replaceChildren();
        if (!active) return;
        const card = active;
        const readOnly = card.owner !== 'developer' || !card.ready;
        document.querySelectorAll('#routes-tbody, #driver-routes-tbody, #add-card-route-row, #fuel-start, #fuel-received, #adblue-start, #adblue-received, #odo-1, #card-save-btn, #transfer-data-btn, .preset-buttons-group')
            .forEach(element => { element.inert = readOnly; });
        if (card.owner === 'developer') {
            if (!card.ready) addButton('Завантажити картку', () => fetchCard(card));
            const select = document.createElement('select');
            select.setAttribute('aria-label', 'Отримувач картки');
            select.add(new Option('Вибрати роль', ''));
            for (const [value, label] of Object.entries(labels)) select.add(new Option(label, value));
            controls.append(select);
            const send = addButton('Перенести', async () => {
                const recipient = select.value;
                if (!Object.hasOwn(labels, recipient) || card !== active || currentRole() !== 'developer') return;
                if (recipient === 'user' && !confirm('Картка буде доступна всім, хто відкриє сайт як Юзер. Перенести?')) return;
                send.disabled = true;
                try {
                    saveCarRoutesForPeriod(card.period, card.id);
                    await pending;
                    if (card !== active || currentRole() !== 'developer') return;
                    if (card.unsaved) throw new Error('Не вдалося зберегти картку перед перенесенням.');
                    await request(card, 'send', {recipient});
                    if (card === active) result('Картку перенесено. Роль: ' + labels[recipient] + '.');
                } catch (error) {
                    if (card === active) result(error.message);
                } finally { send.disabled = false; }
            });
            send.disabled = !card.ready;
        } else {
            addButton('Оновити картку', () => fetchCard(card));
        }
    }

    async function fetchCard(card) {
        try {
            const data = await request(card, 'read');
            if (active !== card || currentRole() !== card.owner) return;
            if (!card.ready) card.draft = data.draft;
            card.ready = true;
            card.received = data.received;
            if (!card.unsaved) result(card.owner !== 'developer' && !card.received ? 'Розробник ще не переніс картку для цієї ролі.' : '');
            redraw();
        } catch (error) {
            if (active === card && currentRole() === card.owner) result(error.message);
        }
    }

    window.vehicleCardSharing = {
        setSession(owner, token) {
            if (typeof token === 'string' && token) sessions.set(owner, token);
            else sessions.delete(owner);
            if (owner === role) {
                cards.clear();
                active = null;
                redraw();
            }
        },
        refreshRole() {
            const next = currentRole();
            if (role === next) return;
            sessions.delete(role);
            cards.clear();
            role = next;
            active = null;
            result('');
            renderControls();
            redraw();
        },
        read(id, period) {
            const key = cardKey(id, period);
            if (role !== currentRole()) return null;
            if (active?.key !== key) {
                active = cards.get(key);
                result('');
                if (!active) {
                    active = {id, period, key, owner: role, session: sessions.get(role), ready: false};
                    cards.set(key, active);
                }
                if (!active.ready || role !== 'developer') fetchCard(active);
            }
            renderControls();
            return this.previous(id, period);
        },
        previous(id, period) {
            const key = cardKey(id, period);
            const card = cards.get(key);
            return JSON.stringify((role === 'developer' ? card?.draft : card?.received?.snapshot) ?? null);
        },
        canSave(id, period) {
            return Boolean(role === 'developer' && active?.ready && active.key === cardKey(id, period) && role === currentRole());
        },
        saveCurrent(id, period) {
            if (!this.canSave(id, period)) return;
            const card = active;
            saveCarRoutesForPeriod(period, id, true);
            pending.then(() => {
                if (card === active && !card.unsaved) result('Картку збережено.');
            });
        },
        save(id, period, snapshot) {
            if (!this.canSave(id, period)) return;
            const card = active;
            card.draft = snapshot;
            card.unsaved = true;
            pending = pending.then(async () => {
                if (card.draft !== snapshot) return;
                try {
                    const clean = data => data && JSON.stringify({...data, topFields: {...data.topFields, updatedAt: undefined}});
                    if (card.savedContent !== clean(snapshot)) {
                        await request(card, 'save', {snapshot});
                        card.savedContent = clean(snapshot);
                    }
                    if (card.draft === snapshot) card.unsaved = false;
                } catch (error) {
                    if (card === active) result(error.message);
                }
            });
        }
    };

    const toolbar = document.querySelector('.card-period-box');
    if (toolbar) toolbar.append(controls, status);
})();
