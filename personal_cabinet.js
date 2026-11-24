(() => {
    const views = new Set(['generators', 'aggregates-calc']);
    let login = '';
    window.personalCabinetAllowsView = view => !login || views.has(view);
    window.isPersonalCabinetActive = () => Boolean(login);

    window.isKesCabinetActive = () => login === 'КЕС';
    let developerPreview = false;

    window.isEquipmentVisibleInCurrentInventory = item =>
        window.isKesCabinetActive() ? !item.kesHidden : !item.kesOnly;

    window.kesEquipmentPublishButton = (category, item) =>
        developerPreview && window.isKesCabinetActive() && String(item.model ?? '').trim()
            ? '<button type="button" class="action-btn" title="Додати до загального обліку" aria-label="Додати до загального обліку" onclick="publishKesEquipment(&quot;' + category + '&quot;,' + Number(item.id) + ')"' + (item.kesOnly ? '' : ' disabled') + '>+</button>'
            : '';

    window.publishKesEquipment = (category, id) => {
        if (!developerPreview || !window.isKesCabinetActive()) return;
        const suffix = {generators: 'Generators', webasto: 'Webasto', heaters: 'Heaters', chainsaws: 'Chainsaws', pumps: 'Pumps'}[category];
        if (!suffix) return;
        const items = window['get' + suffix + 'List']();
        const item = items.find(entry => Number(entry.id) === id);
        if (!item?.kesOnly || item.kesHidden || !String(item.model ?? '').trim()) return;
        delete item.kesOnly;
        item.subdivision = 'КЕС';
        window['save' + suffix + 'List'](items);
        window['render' + suffix + 'View']();
    };


    if (typeof window.getAllEquipmentList === 'function') {
        const getAllEquipment = window.getAllEquipmentList;
        window.getAllEquipmentList = () => getAllEquipment().filter(window.isEquipmentVisibleInCurrentInventory);
    }

    const storageKey = '__sync_local_personal_cabinets';
    const readAccounts = () => JSON.parse(localStorage.getItem(storageKey) || '[]');
    const normalize = value => String(value ?? '').trim();
    async function hash(password, salt) {
        const bytes = new TextEncoder().encode(salt + ':' + password);
        return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
            byte => byte.toString(16).padStart(2, '0')).join('');
    }

    async function request(action, body) {
        if (action === 'login') {
            const account = readAccounts().find(entry => entry.login === body.login);
            if (!account || account.hash !== await hash(body.password, account.salt)) {
                throw new Error('Невірний логін або пароль.');
            }
            return {login: account.login};
        }
        if (window.getCurrentAppRole?.() !== 'developer') throw new Error('Потрібен доступ розробника.');
        const accounts = readAccounts();
        if (action === 'save') {
            const login = normalize(body.login);
            const existing = accounts.find(account => account.id === body.id);
            if (!login || accounts.some(account => account !== existing && account.login === login)
                || (!existing && !body.password)) throw new Error('Вкажи унікальний логін і пароль для нового кабінету.');
            const account = existing || {id: crypto.randomUUID()};
            account.login = login;
            if (body.password) {
                account.salt = crypto.randomUUID();
                account.hash = await hash(body.password, account.salt);
                if (body.allowReveal === 'on') account.revealablePassword = body.password;
                else delete account.revealablePassword;
            }
            if (!existing) accounts.push(account);
            localStorage.setItem(storageKey, JSON.stringify(accounts));
        }
        return {accounts: accounts.map(({id, login}) => ({id, login}))};
    }

    function openDialog(title, fields, submitLabel, submit) {
        const dialog = document.createElement('dialog');
        dialog.style.cssText = 'border:1px solid #95a5a6;border-radius:6px;padding:20px;width:min(360px,85vw)';
        dialog.innerHTML = '<form style="display:grid;gap:12px"><h3 style="margin:0"></h3><div aria-live="polite"></div><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="action-btn">Скасувати</button><button type="submit" class="action-btn"></button></div></form>';
        const form = dialog.querySelector('form');
        const status = form.querySelector('[aria-live]');
        form.querySelector('h3').textContent = title;
        form.querySelector('[type=button]').onclick = () => dialog.close();
        const button = form.querySelector('[type=submit]');
        button.textContent = submitLabel;
        for (const field of fields) {
            form.insertBefore(field, status);
        }
        form.onsubmit = async event => {
            event.preventDefault();
            button.disabled = true;
            status.textContent = '';
            try {
                await submit(Object.fromEntries(new FormData(form)));
                dialog.close();
            } catch (error) {
                status.textContent = error.message;
            } finally {
                button.disabled = false;
            }
        };
        dialog.addEventListener('close', () => dialog.remove(), {once: true});
        document.body.append(dialog);
        dialog.showModal();
    }

    function input(label, name, options) {
        const field = document.createElement('label');
        field.textContent = label;
        field.style.cssText = 'display:grid;gap:4px';
        const control = document.createElement('input');
        control.name = name;
        Object.assign(control, options);
        field.append(control);
        return field;
    }

    function openPasswordLogin() {
        openDialog('Вхід до особистого кабінету', [
            input('Логін', 'login', {required: true, maxLength: 64, autocomplete: 'username'}),
            input('Пароль', 'password', {required: true, type: 'password', maxLength: 256, autocomplete: 'current-password'})
        ], 'Увійти', async fields => {
            const account = await request('login', {...fields, login: fields.login.trim()});
            enterCabinet(account.login);
        });
    }

    function enterCabinet(name) {
        developerPreview = window.getCurrentAppRole?.() === 'developer';
        login = name;
        document.body.classList.add('personal-cabinet-active');
        document.body.classList.toggle('personal-cabinet-kes', login === 'КЕС');
        document.getElementById('personal-cabinet-name').textContent = login;
        switchView('generators');
    }

    window.openPersonalCabinetLogin = async () => {
        if (window.getCurrentAppRole?.() !== 'developer') return openPasswordLogin();
        try {
            const {accounts} = await request('list');
            const field = document.createElement('label');
            field.style.cssText = 'display:grid;gap:4px';
            const select = document.createElement('select');
            select.name = 'id';
            select.required = true;
            select.add(new Option(accounts.length ? 'Оберіть кабінет' : 'У цьому браузері ще немає кабінетів', ''));
            for (const account of accounts) select.add(new Option(account.login, account.id));
            field.append('Особистий кабінет', select);
            openDialog('Особисті кабінети', [field], 'Відкрити', async ({id}) => {
                const {accounts: current} = await request('list');
                const account = current.find(entry => entry.id === id);
                if (!account) throw new Error('Кабінет більше недоступний.');
                enterCabinet(account.login);
            });
        } catch (error) {
            alert(error.message);
        }
    };

    window.exitPersonalCabinet = () => {
        developerPreview = false;
        login = '';
        document.body.classList.remove('personal-cabinet-active', 'personal-cabinet-kes');
        switchView('base');
    };

    function showAccounts(form, accounts, selectedId) {
        const select = form.elements.namedItem('id');
        const list = form.querySelector('#personal-cabinet-list');
        list.replaceChildren();
        for (const account of accounts) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px';
            const name = document.createElement('strong');
            name.textContent = account.login;
            const password = document.createElement('span');
            password.textContent = '••••••••';
            const eye = document.createElement('button');
            eye.type = 'button';
            eye.textContent = '👁';
            eye.setAttribute('aria-label', 'Показати пароль: ' + account.login);
            eye.setAttribute('aria-pressed', 'false');
            eye.onclick = () => {
                if (window.getCurrentAppRole?.() !== 'developer') return;
                const revealed = eye.getAttribute('aria-pressed') === 'true';
                const saved = readAccounts().find(entry => entry.id === account.id);
                password.textContent = revealed ? '••••••••' : saved?.revealablePassword ??
                    'Щоб переглядати пароль, введи його нижче й познач «Запам’ятати пароль для перегляду».';
                eye.setAttribute('aria-pressed', String(!revealed));
                eye.setAttribute('aria-label', (revealed ? 'Показати пароль: ' : 'Сховати пароль: ') + account.login);
            };
            row.append(name, password, eye);
            list.append(row);
        }
        if (!accounts.length) list.textContent = 'У цьому браузері ще немає кабінетів.';
        const newAccount = new Option('Новий кабінет', '');
        select.replaceChildren(...accounts.map(account => new Option(account.login, account.id)), newAccount);
        if (selectedId !== undefined) select.value = selectedId;
        const fields = form.querySelector('fieldset');
        fields.hidden = false;
        fields.disabled = false;
        window.selectPersonalCabinetSettings(form);
    }

    window.selectPersonalCabinetSettings = form => {
        const select = form.elements.namedItem('id');
        const password = form.elements.namedItem('password');
        const hasExisting = Boolean(select.value);
        form.elements.namedItem('login').value = hasExisting
            ? select.selectedOptions[0].textContent : (select.options.length === 1 ? 'КЕС' : '');
        password.value = '';
        password.required = !hasExisting;
        password.placeholder = hasExisting ? 'Залиш порожнім, щоб зберегти чинний' : '';
    };

    async function updateSettings(form, action) {
        if (!form.reportValidity() || form.dataset.pending) return;
        const status = form.querySelector('[role=status]');
        const body = Object.fromEntries(new FormData(form));
        form.dataset.pending = 'true';
        status.textContent = 'Зачекай…';
        try {
            const {accounts} = await request(action, body);
            const saved = action === 'save' ? accounts.find(account => account.login === body.login.trim()) : null;
            showAccounts(form, accounts, saved?.id);
            status.textContent = saved ? 'Кабінет збережено.' : '';
        } catch (error) {
            status.textContent = error.message;
        } finally {
            delete form.dataset.pending;
        }
    }

    window.loadPersonalCabinetSettings = form => {
        if (form.dataset.pending) return;
        const fields = form.querySelector('fieldset');
        fields.hidden = true;
        fields.disabled = true;
        return updateSettings(form, 'list');
    };

    window.savePersonalCabinetSettings = event => {
        event.preventDefault();
        return updateSettings(event.currentTarget, 'save');
    };
})();
