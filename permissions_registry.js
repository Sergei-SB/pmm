// Register only explicitly marked project features in the existing permissions table.
// New feature: add data-permission-key, data-permission-name and optionally data-permission-group.
(function () {
    'use strict';
    const CATALOG_KEY = 'dev_registered_features_v2';
    const roles = ['admin', 'moderator', 'user'];
    const selector = '[data-permission-key]';
    const excluded = '#dev-panel-view, #developer-panel-view, #dev-super-badge, [id^="role-btn-"], #header-favicon-upload-btn, [data-permission-ignore]';
    let catalog = Object.create(null);
    let timer = null;
    const bindings = new WeakMap();
    // Remove only the catalog and generated permissions from the superseded scanner.
    try {
        if (localStorage.getItem('dev_feature_catalog_v1') !== null) {
            const saved = JSON.parse(localStorage.getItem('dev_granular_permissions_v1') || '{}');
            let changed = false;
            Object.keys(saved).forEach(key => { if (key.startsWith('auto_')) { delete saved[key]; changed = true; } });
            if (changed) localStorage.setItem('dev_granular_permissions_v1', JSON.stringify(saved));
            localStorage.removeItem('dev_feature_catalog_v1');
        }
    } catch (e) { console.warn(e); }

    function readCatalog() {
        try {
            const saved = JSON.parse(localStorage.getItem(CATALOG_KEY) || '{}');
            if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
                Object.entries(saved).forEach(([key, value]) => {
                    if (/^[a-zA-Z0-9_:-]+$/.test(key) && value && typeof value.name === 'string') {
                        catalog[key] = {name: value.name.slice(0, 180), group: value.group || 'base', admin: value.admin !== false,
                            moderator: value.moderator !== false, user: value.user !== false};
                    }
                });
            }
        } catch (e) { console.warn('Не вдалося прочитати каталог функцій', e); }
    }
    readCatalog();

    function role() {
        return typeof window.getCurrentAppRole === 'function' ? window.getCurrentAppRole()
            : (window.currentRole || 'user');
    }

    function descriptor(element) {
        if (element.closest(excluded)) return null;
        const key = element.getAttribute('data-permission-key');
        if (!key || !/^[a-zA-Z0-9_:-]+$/.test(key)) return null;
        const section = element.closest('.view-section');
        const modules = {'base-view':'base', 'card-view':'card', 'car-details-view':'car_details',
            'report-view':'report', 'generators-view':'equipment', 'equipment-report-view':'equipment',
            'destroyed-view':'destroyed', 'documents-view':'documents'};
        const group = element.getAttribute('data-permission-group') || modules[section?.id] || 'base';
        const name = (element.getAttribute('data-permission-name') || element.getAttribute('aria-label')
            || element.title || element.textContent || element.id || key).replace(/\s+/g, ' ').trim().slice(0, 180);
        return {key, name: name || key, group};
    }

    function applyControl(element, key, perms, activeRole) {
        const blocked = activeRole !== 'developer' && activeRole !== 'dev' && perms[key]?.[activeRole] !== true;
        if (blocked !== element.hasAttribute('data-permission-blocked')) {
            element.toggleAttribute('data-permission-blocked', blocked);
        }
    }

    window.getAutoFeatureDefaults = function () {
        return Object.assign({}, catalog);
    };

    window.refreshFeaturePermissions = function () {
        readCatalog();
        let added = false;
        const controls = [];
        document.querySelectorAll('[data-permission-blocked]:not([data-permission-key])').forEach(element => element.removeAttribute('data-permission-blocked'));
        document.querySelectorAll(selector).forEach(element => {
            const entry = descriptor(element);
            if (!entry) return;
            bindings.set(element, entry.key);
            controls.push([element, entry.key]);
            if (!catalog[entry.key] && !(typeof DEFAULT_GRANULAR_PERMISSIONS !== 'undefined' && DEFAULT_GRANULAR_PERMISSIONS[entry.key])) {
                catalog[entry.key] = {name: entry.name, group: entry.group, admin: true, moderator: true, user: true};
                added = true;
            }
        });
        if (added) {
            // Merge discoveries from another tab before persisting the catalog.
            readCatalog();
            try { localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog)); } catch (e) { console.warn(e); }
        }
        const perms = getGranularPermissions();
        const activeRole = role();
        controls.forEach(([element, key]) => applyControl(element, key, perms, activeRole));
        return added;
    };

    function scheduleRefresh() {
        if (timer !== null) return;
        timer = setTimeout(function () {
            timer = null;
            const added = window.refreshFeaturePermissions();
            if (added && typeof currentDevSubTab !== 'undefined' && currentDevSubTab === 'permissions'
                && (role() === 'developer' || role() === 'dev')) window.renderDeveloperPanel();
        }, 80);
    }

    // Do not change the application's own display state when applying permissions.
    const style = document.createElement('style');
    style.textContent = '[data-permission-blocked] { display: none !important; }';
    document.head.appendChild(style);
    document.addEventListener('click', function (event) {
        const element = event.target.closest && event.target.closest(selector);
        if (!element) return;
        const entry = descriptor(element);
        if (!entry) return;
        const key = bindings.get(element) || entry.key;
        if (!window.canRoleDo(role(), key)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);

    const previousUpdateRoleUI = window.updateRoleUI;
    window.updateRoleUI = function () {
        const result = previousUpdateRoleUI.apply(this, arguments);
        window.refreshFeaturePermissions();
        return result;
    };
    window.developerPanelUpdateRoleUI = window.updateRoleUI;
    window.addEventListener('storage', function (event) {
        if (event.key === CATALOG_KEY) readCatalog();
        if (!event.key || [CATALOG_KEY, 'dev_granular_permissions_v1', 'app_current_role', 'currentRole'].includes(event.key)) scheduleRefresh();
    });

    function start() {
        window.refreshFeaturePermissions();
        new MutationObserver(function (records) {
            if (records.some(record => !record.target.closest || !record.target.closest('#dev-panel-view, #developer-panel-view'))) scheduleRefresh();
        }).observe(document.body, {childList: true, subtree: true, attributes: true,
            attributeFilter: ['data-permission-key', 'data-permission-name', 'data-permission-group']});
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
