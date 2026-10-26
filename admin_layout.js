// Two presentations of the same live controls. No duplicated permissions or data.
(function () {
    'use strict';
    const key = 'pmm_admin_layout_v1';
    let mode = 'classic';
    try { if (sessionStorage.getItem(key) === 'modern') mode = 'modern'; } catch (_) {}

    function developer() {
        const role = typeof window.getCurrentAppRole === 'function' ? window.getCurrentAppRole()
            : (typeof currentRole !== 'undefined' ? currentRole : window.currentRole);
        return role === 'developer';
    }

    window.setDeveloperPanelLayout = function (next) {
        if (!developer() || !['classic','modern'].includes(next)) return false;
        mode = next;
        try { sessionStorage.setItem(key, mode); } catch (_) {}
        // Keep every live form node, value, focus and handler intact while switching.
        window.syncDeveloperPanelLayout();
        return true;
    };

    window.syncDeveloperPanelLayout = function () {
        const panel = document.getElementById('dev-panel-view');
        if (!panel) return;
        panel.classList.toggle('dev-admin-modern', mode === 'modern');
        const header = panel.querySelector('.card-header-panel');
        const actions = document.getElementById('dev-panel-header-actions');
        if (!header || !actions) return;
        let control = document.getElementById('dev-admin-layout-switch');
        if (!control) {
            control = document.createElement('div');
            control.id = 'dev-admin-layout-switch';
            control.className = 'dev-admin-layout-switch';
            control.setAttribute('role','group');
            control.setAttribute('aria-label','Вигляд панелі керування');
            control.innerHTML = '<span>Вигляд</span><button type="button" data-admin-layout="classic">Класична</button><button type="button" data-admin-layout="modern">Нова</button>';
            control.querySelectorAll('[data-admin-layout]').forEach(button => {
                button.addEventListener('click', () => window.setDeveloperPanelLayout(button.dataset.adminLayout));
            });
            header.insertBefore(control, actions);
        }
        control.hidden = !developer();
        control.querySelectorAll('[data-admin-layout]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.adminLayout === mode));
        });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',window.syncDeveloperPanelLayout);
    else window.syncDeveloperPanelLayout();
})();
