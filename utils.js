// ==========================================
// ДОПОМІЖНІ СКРИПТИ ТА УТИЛІТИ (utils.js)
// ==========================================

// Автоматичне додавання атрибута title для всіх комірок таблиці при наведенні
document.addEventListener("mouseover", function(e) {
    const td = e.target.closest('td');
    if (td && td.textContent.trim() !== '') {
        if (!td.getAttribute('title')) {
            td.setAttribute('title', td.textContent.trim());
        }
    }
});