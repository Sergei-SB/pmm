// ==========================================
// МОДУЛЬ МОДЕРАТОРА (moderator.js)
// ==========================================

const MODERATOR_PASSWORD = "2121";

function checkModeratorPassword(callback) {
    // Передаємо "•", щоб у модератора при введенні пароля були кружечки
    showCustomPasswordModal((pass) => {
        if (pass === MODERATOR_PASSWORD) {
            callback(true);
        } else if (pass !== null) {
            alert("Неправильний пароль Модератора!");
            callback(false);
        } else {
            callback(false);
        }
    }, "•");
}

// Блокування полів звіту для модератора, залишаючи активним лише фільтр "Підр." та перемикання періодів
function applyModeratorReportLock() {
    const role = (typeof window.getCurrentAppRole === 'function')
        ? window.getCurrentAppRole()
        : ((typeof window.currentRole !== 'undefined') ? window.currentRole : ((typeof currentRole !== 'undefined') ? currentRole : 'user'));

    const canEdit = (role === 'developer') || (typeof window.canRoleEdit === 'function' ? window.canRoleEdit(role, 'report') : (role === 'admin'));

    if (!canEdit) {
        const reportInputs = document.querySelectorAll(
            '#report-tbody input, #report-tbody select, #report-table tbody input, #report-table tbody select, ' +
            '#equipment-report-tbody input, #equipment-report-tbody select, #equipment-report-table tbody input, #equipment-report-table tbody select'
        );
        reportInputs.forEach(input => {
            input.setAttribute('disabled', 'true');
            input.setAttribute('readonly', 'true');
            input.disabled = true;
            input.readOnly = true;
            input.style.backgroundColor = '#f1f2f6';
            input.style.color = '#2c3e50';
            input.style.cursor = 'not-allowed';
            input.title = 'Редагування доступне тільки для Адміна та Розробника';
        });

        const saveBtns = document.querySelectorAll(
            '#report-view button[onclick*="saveReportData"], #rep-save-btn, #report-view .report-save-btn, ' +
            '#equipment-report-view button[onclick*="saveEquipmentReportData"], button[onclick*="saveEquipmentReportData"]'
        );
        saveBtns.forEach(btn => btn.style.setProperty('display', 'none', 'important'));

        // Фільтр підрозділу та вибір періоду залишаються активними для перегляду
        const periodSelect = document.getElementById('report-period-select');
        if (periodSelect) {
            periodSelect.removeAttribute('disabled');
            periodSelect.disabled = false;
            periodSelect.style.backgroundColor = 'white';
            periodSelect.style.cursor = 'pointer';
        }
        const subFilter = document.getElementById('report-subdivision-filter');
        if (subFilter) {
            subFilter.removeAttribute('disabled');
            subFilter.disabled = false;
            subFilter.style.backgroundColor = 'white';
            subFilter.style.cursor = 'pointer';
        }
        const prevBtn = document.getElementById('rep-nav-prev-btn');
        if (prevBtn) {
            prevBtn.removeAttribute('disabled');
            prevBtn.disabled = false;
            prevBtn.style.cursor = 'pointer';
        }
        const nextBtn = document.getElementById('rep-nav-next-btn');
        if (nextBtn) {
            nextBtn.removeAttribute('disabled');
            nextBtn.disabled = false;
            nextBtn.style.cursor = 'pointer';
        }

        const eqPeriodSelect = document.getElementById('eq-report-period-select');
        if (eqPeriodSelect) {
            eqPeriodSelect.removeAttribute('disabled');
            eqPeriodSelect.disabled = false;
            eqPeriodSelect.style.cursor = 'pointer';
        }
        const eqPrevBtn = document.getElementById('eq-rep-nav-prev-btn');
        if (eqPrevBtn) {
            eqPrevBtn.removeAttribute('disabled');
            eqPrevBtn.disabled = false;
            eqPrevBtn.style.cursor = 'pointer';
        }
        const eqNextBtn = document.getElementById('eq-rep-nav-next-btn');
        if (eqNextBtn) {
            eqNextBtn.removeAttribute('disabled');
            eqNextBtn.disabled = false;
            eqNextBtn.style.cursor = 'pointer';
        }
    }
}
window.applyModeratorReportLock = applyModeratorReportLock;

// Захист на рівні подій: перевіряємо право редагування звіту
document.addEventListener('focusin', function(e) {
    const role = (typeof window.getCurrentAppRole === 'function')
        ? window.getCurrentAppRole()
        : ((typeof window.currentRole !== 'undefined') ? window.currentRole : ((typeof currentRole !== 'undefined') ? currentRole : 'user'));
    const canEdit = (role === 'developer') || (typeof window.canRoleEdit === 'function' ? window.canRoleEdit(role, 'report') : (role === 'admin'));
    if (!canEdit) {
        const target = e.target;
        if (target && target.closest && (target.closest('#report-tbody') || target.closest('#equipment-report-tbody'))) {
            target.setAttribute('disabled', 'true');
            target.setAttribute('readonly', 'true');
            target.disabled = true;
            target.readOnly = true;
            target.blur();
        }
    }
}, true);

document.addEventListener('DOMContentLoaded', () => {
    const reportNavBtn = document.getElementById('nav-btn-report');
    if (reportNavBtn) {
        reportNavBtn.addEventListener('click', () => {
            setTimeout(applyModeratorReportLock, 100);
            setTimeout(applyModeratorReportLock, 350);
        });
    }
    const eqReportNavBtn = document.getElementById('nav-btn-equipment-report');
    if (eqReportNavBtn) {
        eqReportNavBtn.addEventListener('click', () => {
            setTimeout(applyModeratorReportLock, 100);
            setTimeout(applyModeratorReportLock, 350);
        });
    }
});