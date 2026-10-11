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

// Блокування полів звіту для модератора, залишаючи активним лише фільтр "Підр."
function applyModeratorReportLock() {
    if (typeof currentRole !== 'undefined' && currentRole === 'moderator') {
        const reportInputs = document.querySelectorAll('#report-table input, #report-table select');
        reportInputs.forEach(input => {
            if (input.id === 'report-subdivision-filter') {
                input.removeAttribute('disabled');
                input.style.backgroundColor = 'white';
                input.style.cursor = 'pointer';
                return;
            }

            input.setAttribute('disabled', 'true');
            input.style.backgroundColor = '#f1f2f6';
            input.style.color = '#2c3e50';
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const reportNavBtn = document.getElementById('nav-btn-report');
    if (reportNavBtn) {
        reportNavBtn.addEventListener('click', () => {
            setTimeout(applyModeratorReportLock, 300);
        });
    }
});