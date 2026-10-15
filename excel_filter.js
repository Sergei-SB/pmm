// ==========================================
// ФІЛЬТР ЯК В EXCEL ДЛЯ ОБЛІКУ ОБЛАДНАННЯ (excel_filter.js)
// ==========================================

window.excelFiltersState = {
    generators: {},
    webasto: {},
    heaters: {},
    chainsaws: {}
};

window.excelSortState = {
    generators: null,
    webasto: null,
    heaters: null,
    chainsaws: null
};

// Отримання даних за категорією
function getCategoryItemsList(cat) {
    if (cat === 'generators' && typeof getGeneratorsList === 'function') return getGeneratorsList();
    if (cat === 'webasto' && typeof getWebastoList === 'function') return getWebastoList();
    if (cat === 'heaters' && typeof getHeatersList === 'function') return getHeatersList();
    if (cat === 'chainsaws' && typeof getChainsawsList === 'function') return getChainsawsList();
    return [];
}

// Перевірка, чи проходить елемент всі фільтри Excel
function itemMatchesExcelFilters(item, cat) {
    const filters = window.excelFiltersState[cat] || {};
    for (const colKey in filters) {
        const allowedVals = filters[colKey];
        if (!allowedVals || !(allowedVals instanceof Set)) continue;
        
        let cellVal = String(item[colKey] !== undefined && item[colKey] !== null ? item[colKey] : "").trim();
        if (cellVal === "") cellVal = "(Порожні)";
        
        if (!allowedVals.has(cellVal)) {
            return false;
        }
    }
    return true;
}

// Застосування сортування Excel
function applyCategoryExcelSort(list, cat) {
    const sortInfo = window.excelSortState[cat];
    if (!sortInfo || !sortInfo.colKey) return list;

    const colKey = sortInfo.colKey;
    const dir = sortInfo.direction === 'desc' ? -1 : 1;

    return [...list].sort((a, b) => {
        let valA = String(a[colKey] !== undefined ? a[colKey] : "").trim();
        let valB = String(b[colKey] !== undefined ? b[colKey] : "").trim();

        // Спроба числового сортування
        let numA = parseFloat(valA.replace(',', '.'));
        let numB = parseFloat(valB.replace(',', '.'));
        if (!isNaN(numA) && !isNaN(numB)) {
            return (numA - numB) * dir;
        }
        return valA.localeCompare(valB, 'uk', { numeric: true, sensitivity: 'base' }) * dir;
    });
}

// Перевірка, чи активний фільтр на даному стовпці
function isExcelFilterActive(cat, colKey) {
    const filters = window.excelFiltersState[cat] || {};
    const set = filters[colKey];
    return Boolean(set && set instanceof Set);
}

// Перевірка, чи є взагалі якісь активні фільтри
function hasAnyActiveExcelFilters(cat) {
    const filters = window.excelFiltersState[cat] || {};
    for (const k in filters) {
        if (filters[k] && filters[k] instanceof Set) return true;
    }
    return false;
}

// Скидання всіх фільтрів Excel для категорії
function clearAllExcelFiltersForCategory(cat) {
    window.excelFiltersState[cat] = {};
    window.excelSortState[cat] = null;
    triggerCategoryRerender(cat);
}

// Тригер перемальовки таблиці
function triggerCategoryRerender(cat) {
    if (cat === 'generators' && typeof renderGeneratorsView === 'function') renderGeneratorsView();
    else if (cat === 'webasto' && typeof renderWebastoView === 'function') renderWebastoView();
    else if (cat === 'heaters' && typeof renderHeatersView === 'function') renderHeatersView();
    else if (cat === 'chainsaws' && typeof renderChainsawsView === 'function') renderChainsawsView();
}

// Відкриття спливаючого вікна Excel-фільтра
function openExcelFilterPopup(event, cat, colKey, colTitle) {
    event.stopPropagation();
    event.preventDefault();

    closeExcelFilterPopup();

    const triggerBtn = event.currentTarget;
    const rect = triggerBtn.getBoundingClientRect();

    const allItems = getCategoryItemsList(cat).filter(item => !/знищ/ui.test(String(item.note || item.comment || '')));
    
    // Збір унікальних значень та їх кількості
    const countsMap = new Map();
    allItems.forEach(item => {
        let val = String(item[colKey] !== undefined && item[colKey] !== null ? item[colKey] : "").trim();
        if (val === "") val = "(Порожні)";
        countsMap.set(val, (countsMap.get(val) || 0) + 1);
    });

    const uniqueVals = Array.from(countsMap.keys()).sort((a, b) => {
        if (a === "(Порожні)") return 1;
        if (b === "(Порожні)") return -1;
        let numA = parseFloat(a.replace(',', '.'));
        let numB = parseFloat(b.replace(',', '.'));
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b, 'uk', { numeric: true });
    });

    const currentFilterSet = (window.excelFiltersState[cat] && window.excelFiltersState[cat][colKey]) || null;

    // Створення DOM спливаючого вікна
    const popup = document.createElement('div');
    popup.id = 'excel-filter-popup-modal';
    popup.className = 'excel-filter-popup';

    popup.innerHTML = `
        <div class="ef-header">
            <span class="ef-title">Фільтр: <strong>${colTitle}</strong></span>
            <button type="button" class="ef-close-btn" onclick="closeExcelFilterPopup()">✕</button>
        </div>

        <div class="ef-sort-actions">
            <button type="button" class="ef-sort-btn" onclick="applyExcelSort('${cat}', '${colKey}', 'asc')">
                <span>⬆️</span> Сортувати за зростанням (А-Я / 0-9)
            </button>
            <button type="button" class="ef-sort-btn" onclick="applyExcelSort('${cat}', '${colKey}', 'desc')">
                <span>⬇️</span> Сортувати за спаданням (Я-А / 9-0)
            </button>
        </div>

        <div class="ef-divider"></div>

        <div class="ef-clear-action">
            <button type="button" class="ef-clear-btn" onclick="clearSingleExcelFilter('${cat}', '${colKey}')" ${!currentFilterSet ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                🧹 Очистити фільтр з цього стовпця
            </button>
        </div>

        <div class="ef-search-box">
            <input type="text" id="ef-search-input" placeholder="Пошук у списку значень..." oninput="filterExcelPopupList(this.value)">
        </div>

        <div class="ef-select-all-box">
            <label>
                <input type="checkbox" id="ef-select-all" ${!currentFilterSet || currentFilterSet.size === uniqueVals.length ? 'checked' : ''} onchange="toggleExcelSelectAll(this.checked)">
                <strong>(Виділити все)</strong>
            </label>
        </div>

        <div class="ef-values-list" id="ef-values-list">
            ${uniqueVals.map(val => {
                const isChecked = !currentFilterSet || currentFilterSet.has(val);
                const safeVal = val.replace(/"/g, '&quot;');
                const count = countsMap.get(val);
                return `
                    <div class="ef-val-item" data-text="${val.toLowerCase()}">
                        <label>
                            <input type="checkbox" class="ef-val-checkbox" value="${safeVal}" ${isChecked ? 'checked' : ''} onchange="onExcelValCheckboxChange()">
                            <span class="ef-val-label">${val}</span>
                            <span class="ef-val-count">(${count})</span>
                        </label>
                    </div>
                `;
            }).join('')}
        </div>

        <div class="ef-footer">
            <button type="button" class="ef-btn-apply" onclick="confirmExcelFilter('${cat}', '${colKey}')">✅ Застосувати</button>
            <button type="button" class="ef-btn-cancel" onclick="closeExcelFilterPopup()">Скасувати</button>
        </div>
    `;

    document.body.appendChild(popup);

    // Розрахунок позиції, щоб вікно не вилазило за екран
    let top = rect.bottom + window.scrollY + 4;
    let left = rect.left + window.scrollX;
    const popupWidth = 280;

    if (left + popupWidth > window.innerWidth - 10) {
        left = window.innerWidth - popupWidth - 15;
    }
    if (left < 10) left = 10;

    popup.style.top = top + 'px';
    popup.style.left = left + 'px';
    popup.style.display = 'flex';

    // Фокус на пошук
    setTimeout(() => {
        const sInput = document.getElementById('ef-search-input');
        if (sInput) sInput.focus();
    }, 50);

    // Закриття при кліку поза вікном або Escape
    setTimeout(() => {
        document.addEventListener('click', handleOutsideExcelPopupClick);
        document.addEventListener('keydown', handleExcelPopupKeydown);
    }, 100);
}

function handleExcelPopupKeydown(e) {
    if (e.key === 'Escape') {
        closeExcelFilterPopup();
    }
}

function handleOutsideExcelPopupClick(e) {
    const popup = document.getElementById('excel-filter-popup-modal');
    if (popup && !popup.contains(e.target) && !e.target.closest('.excel-header-btn')) {
        closeExcelFilterPopup();
    }
}

function closeExcelFilterPopup() {
    document.removeEventListener('click', handleOutsideExcelPopupClick);
    document.removeEventListener('keydown', handleExcelPopupKeydown);
    const popup = document.getElementById('excel-filter-popup-modal');
    if (popup) popup.remove();
}

function filterExcelPopupList(text) {
    const query = String(text || "").toLowerCase().trim();
    const items = document.querySelectorAll('#ef-values-list .ef-val-item');
    items.forEach(item => {
        const itemText = item.getAttribute('data-text') || '';
        item.style.display = itemText.includes(query) ? 'flex' : 'none';
    });
}

function toggleExcelSelectAll(isChecked) {
    const checkboxes = document.querySelectorAll('#ef-values-list .ef-val-checkbox');
    checkboxes.forEach(cb => {
        // Якщо батьківський елемент видимий
        if (cb.closest('.ef-val-item').style.display !== 'none') {
            cb.checked = isChecked;
        }
    });
}

function onExcelValCheckboxChange() {
    const visibleCheckboxes = Array.from(document.querySelectorAll('#ef-values-list .ef-val-checkbox')).filter(cb => cb.closest('.ef-val-item').style.display !== 'none');
    const checkedCount = visibleCheckboxes.filter(cb => cb.checked).length;
    const selectAll = document.getElementById('ef-select-all');
    if (selectAll) {
        selectAll.checked = checkedCount === visibleCheckboxes.length;
        selectAll.indeterminate = checkedCount > 0 && checkedCount < visibleCheckboxes.length;
    }
}

function applyExcelSort(cat, colKey, direction) {
    window.excelSortState[cat] = { colKey, direction };
    closeExcelFilterPopup();
    triggerCategoryRerender(cat);
}

function clearSingleExcelFilter(cat, colKey) {
    if (window.excelFiltersState[cat]) {
        delete window.excelFiltersState[cat][colKey];
    }
    closeExcelFilterPopup();
    triggerCategoryRerender(cat);
}

function confirmExcelFilter(cat, colKey) {
    const checkboxes = document.querySelectorAll('#ef-values-list .ef-val-checkbox');
    const totalCount = checkboxes.length;
    const selectedVals = new Set();

    checkboxes.forEach(cb => {
        if (cb.checked) {
            selectedVals.add(cb.value);
        }
    });

    if (!window.excelFiltersState[cat]) {
        window.excelFiltersState[cat] = {};
    }

    // Якщо вибрані всі значення - фільтр вимикаємо
    if (selectedVals.size === totalCount) {
        delete window.excelFiltersState[cat][colKey];
    } else {
        window.excelFiltersState[cat][colKey] = selectedVals;
    }

    closeExcelFilterPopup();
    triggerCategoryRerender(cat);
}

// Генерація HTML кнопки для шапки таблиці
function renderExcelHeaderFilterButton(cat, colKey, colTitle) {
    const isActive = isExcelFilterActive(cat, colKey);
    const titleAttr = isActive ? `Фільтр активний (натисніть щоб змінити)` : `Фільтр як в Excel`;
    return `
        <button type="button" class="excel-header-btn ${isActive ? 'active-filter' : ''}" 
                onclick="openExcelFilterPopup(event, '${cat}', '${colKey}', '${colTitle}')" 
                title="${titleAttr}">
            ${isActive ? '▼●' : '▼'}
        </button>
    `;
}
