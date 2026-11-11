(function () {
    'use strict';

    const key = 'dev_maintenance_editor_v1';
    const roles = {admin: 'Адмін', moderator: 'Модератор', user: 'Юзер'};
    const toggle = document.getElementById('permission-editor-toggle');
    const main = document.querySelector('.main-container');
    const header = document.querySelector('.top-nav');
    if (!toggle || !main || !header) return;

    const screen = document.createElement('section');
    screen.id = 'maintenance-screen';
    screen.hidden = true;
    screen.innerHTML = '<h1 tabindex="-1">Сайт на реконструкції</h1><button type="button" class="action-btn">Вхід розробника</button>';
    screen.querySelector('button').onclick = () => window.selectRole('developer');
    const markers = document.createElement('div');
    markers.id = 'permission-editor-markers';
    const menu = document.createElement('div');
    menu.id = 'permission-editor-menu';
    menu.hidden = true;
    document.body.append(screen, markers, menu);

    let frame = 0;
    let openKey = '';
    let previouslyFocused = null;
    const madeInert = new Set();
    const activeTargets = new Map();
    const navigation = {
        'nav-btn-base': 'base', 'nav-btn-card': 'card', 'nav-btn-report': 'report',
        'nav-btn-subdivisions': 'subdivisions', 'nav-btn-equipment': 'equipment',
        'nav-btn-equipment-report': 'equipment_report', 'nav-btn-aggregates-calc': 'aggregates_calc',
        'nav-btn-destroyed': 'destroyed', 'nav-btn-documents': 'documents'
    };
    const features = {
        'card-save-btn': 'card_save_btn', 'transfer-data-btn': 'base_transfer_btn',
        'add-card-route-row': 'card_routes_edit', 'add-car-btn': 'base_add_car'
    };

    function currentRole() {
        return window.getCurrentAppRole?.() || 'user';
    }

    function isDeveloper(role) {
        return role === 'developer' || role === 'dev';
    }

    function state() {
        try {
            const value = JSON.parse(localStorage.getItem(key) || '{}');
            return {enabled: value.enabled === true, rules: value.rules || {}};
        } catch (_) {
            return {enabled: false, rules: {}};
        }
    }

    function write(value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (_) {
            alert('Не вдалося зберегти налаштування прав.');
        }
        refresh();
    }

    function closeMenu() {
        openKey = '';
        menu.hidden = true;
    }

    function updateScreen(blocked) {
        if (blocked === !screen.hidden) return;
        screen.hidden = !blocked;
        document.body.classList.toggle('maintenance-blocked', blocked);
        if (blocked) {
            previouslyFocused = document.activeElement;
            for (const element of [header, main]) {
                if (!element.inert) {
                    element.inert = true;
                    madeInert.add(element);
                }
            }
            screen.querySelector('h1').focus();
        } else {
            madeInert.forEach(element => { element.inert = false; });
            madeInert.clear();
            previouslyFocused?.focus();
        }
    }

    function label(element) {
        return (element.getAttribute('data-permission-name') || element.getAttribute('aria-label') ||
            element.title || element.placeholder || element.textContent || element.name || element.id || '')
            .replace(/\s+/g, ' ').trim().slice(0, 100);
    }

    function tableColumns(table) {
        const columns = new Map();
        const occupied = [];
        for (const [rowIndex, row] of Array.from(table.rows).entries()) {
            let column = 0;
            for (const cell of row.cells) {
                while (occupied[column] > rowIndex) column++;
                if (cell.colSpan === 1) {
                    if (!columns.has(column)) columns.set(column, []);
                    columns.get(column).push(cell);
                }
                for (let index = column; index < column + cell.colSpan; index++) {
                    occupied[index] = rowIndex + (cell.rowSpan || table.rows.length);
                }
                column += cell.colSpan;
            }
        }
        return columns;
    }

    function targets() {
        const sections = [header, ...main.querySelectorAll('.view-section.active')];
        const entries = [];
        for (const section of sections) {
            if (section.matches('#dev-panel-view, #developer-panel-view')) continue;
            const scope = section.id || 'navigation';
            for (const table of section.querySelectorAll('table')) {
                if (!table.tHead) continue;
                const rows = Array.from(table.tHead.rows);
                const signature = table.id || JSON.stringify(rows.map(row => Array.from(row.cells, label)));
                for (const [column, affected] of tableColumns(table)) {
                    const cell = affected.findLast(field => field.parentElement.parentElement === table.tHead);
                    if (!cell) continue;
                    const name = label(cell);
                    if (name) entries.push({id: JSON.stringify([scope, 'column', signature, column]), name, element: cell, affected});
                }
            }
            const selector = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [onclick], [data-permission-key]';
            for (const element of section.querySelectorAll(selector)) {
                if (element.closest('#nav-btn-dev-panel, #dev-panel-view, #developer-panel-view, [id^="role-btn-"], [data-permission-ignore]')) continue;
                const handler = element.getAttribute('onclick') || element.getAttribute('onchange') || element.getAttribute('oninput');
                const identity = element.dataset.permissionKey || element.id || element.name || handler || label(element);
                if (!identity) continue;
                const stable = identity.replace(/\b\d+\b/g, '#');
                entries.push({id: JSON.stringify([scope, 'control', stable]), name: label(element) || stable,
                    element, affected: [element]});
            }
        }
        return entries;
    }

    function allowed(entry, role, value) {
        const override = value.rules[entry.id]?.[role];
        if (typeof override === 'boolean') return override;
        if (entry.element.classList.contains('registry-developer-only')) return false;
        if (entry.element.classList.contains('registry-admin-only')) return role === 'admin';
        const page = navigation[entry.element.id];
        if (page) return window.canRoleAccess(role, page);
        const feature = entry.element.dataset.permissionKey || features[entry.element.id];
        return feature ? window.canRoleDo(role, feature) : true;
    }

    function openMenu(entry, marker) {
        if (openKey === entry.id) { closeMenu(); return; }
        openKey = entry.id;
        const title = document.createElement('strong');
        title.textContent = entry.name;
        menu.replaceChildren(title);
        for (const [role, name] of Object.entries(roles)) {
            const row = document.createElement('label');
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = allowed(entry, role, state());
            input.onchange = () => {
                const value = state();
                if (!value.enabled || !isDeveloper(currentRole())) return;
                const page = navigation[entry.element.id];
                const feature = entry.element.dataset.permissionKey || features[entry.element.id];
                if (page) {
                    const matrix = getPagePermissionsMatrix();
                    if (matrix[page]?.[role]) {
                        matrix[page][role].access = input.checked;
                        savePagePermissionsMatrix(matrix);
                    }
                } else if (feature) {
                    const permissions = getGranularPermissions();
                    if (permissions[feature]) {
                        permissions[feature][role] = input.checked;
                        saveGranularPermissions(permissions);
                    }
                }
                (value.rules[entry.id] ||= {})[role] = input.checked;
                write(value);
            };
            row.append(input, 'Дозволити · ' + name);
            menu.append(row);
        }
        const rect = marker.getBoundingClientRect();
        menu.hidden = false;
        menu.style.left = Math.max(4, Math.min(rect.left, innerWidth - menu.offsetWidth - 8)) + 'px';
        menu.style.top = Math.max(4, Math.min(rect.bottom + 4, innerHeight - menu.offsetHeight - 8)) + 'px';
        menu.querySelector('input').focus();
    }

    function refresh() {
        const role = currentRole();
        const developer = isDeveloper(role);
        const value = state();
        const editing = developer && value.enabled;
        updateScreen(value.enabled && !developer);
        toggle.setAttribute('aria-pressed', String(editing));
        const toggleLabel = editing ? 'Права · завершити реконструкцію' : 'Права';
        if (toggle.textContent !== toggleLabel) toggle.textContent = toggleLabel;

        const denied = new Set();
        const allowedRegistryColumns = new Set();
        activeTargets.clear();
        if (editing || (!developer && Object.keys(value.rules).length)) {
            for (const entry of targets()) {
                if (!developer && value.rules[entry.id]?.[role] === false) entry.affected.forEach(element => denied.add(element));
                if (!developer && value.rules[entry.id]?.[role] === true && entry.element.classList.contains('registry-admin-only')) {
                    entry.affected.forEach(element => allowedRegistryColumns.add(element));
                }
                if (!editing || activeTargets.has(entry.id) || !entry.element.getClientRects().length) continue;
                const rect = entry.element.getBoundingClientRect();
                if (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) continue;
                activeTargets.set(entry.id, {entry, rect});
            }
        }
        document.querySelectorAll('[data-editor-denied]').forEach(element => {
            if (!denied.has(element)) element.removeAttribute('data-editor-denied');
        });
        denied.forEach(element => element.setAttribute('data-editor-denied', ''));
        document.querySelectorAll('[data-editor-allowed]').forEach(element => {
            if (!allowedRegistryColumns.has(element)) element.removeAttribute('data-editor-allowed');
        });
        allowedRegistryColumns.forEach(element => element.setAttribute('data-editor-allowed', ''));
        if (!editing || (openKey && !activeTargets.has(openKey))) closeMenu();
        const fragment = document.createDocumentFragment();
        for (const {entry, rect} of activeTargets.values()) {
            const marker = document.createElement('button');
            marker.type = 'button';
            marker.className = 'permission-editor-marker';
            marker.textContent = '+';
            marker.setAttribute('aria-label', 'Права · ' + entry.name);
            marker.style.left = Math.max(0, Math.min(rect.left + rect.width / 2 - 9, innerWidth - 18)) + 'px';
            marker.style.top = Math.max(0, rect.top - 15) + 'px';
            marker.onclick = () => openMenu(entry, marker);
            fragment.append(marker);
        }
        markers.replaceChildren(fragment);
    }

    function schedule() {
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            refresh();
        });
    }

    toggle.onclick = () => {
        if (!isDeveloper(currentRole())) return;
        const value = state();
        value.enabled = !value.enabled;
        write(value);
    };
    const previousUpdateRoleUI = window.updateRoleUI;
    window.updateRoleUI = function () {
        const result = previousUpdateRoleUI?.apply(this, arguments);
        schedule();
        return result;
    };
    window.developerPanelUpdateRoleUI = window.updateRoleUI;
    const observer = new MutationObserver(schedule);
    observer.observe(main, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
    observer.observe(header, {childList: true, subtree: true});
    window.addEventListener('storage', schedule);
    window.addEventListener('pmm-maintenance-sync', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', () => {
        if (toggle.getAttribute('aria-pressed') === 'true') schedule();
    }, true);
    document.addEventListener('pointerdown', event => {
        if (!menu.contains(event.target) && !markers.contains(event.target)) closeMenu();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeMenu();
    });
    schedule();
})();
