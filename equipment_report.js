// ==========================================
// ЗВІТ ПО ОБЛАДНАННЮ (equipment_report.js)
// ==========================================

let activeEquipmentReportPeriod = "";

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        initEqReportPeriodDropdown();
        renderEquipmentReportView();
    }, 120);
});

function getSavedEquipmentPeriodsList() {
    let periods = [];
    if (typeof getSavedPeriodsList === 'function') {
        try {
            periods = [...getSavedPeriodsList()];
        } catch(e) {}
    } else if (typeof getSortedPeriods === 'function') {
        try {
            periods = [...getSortedPeriods()];
        } catch(e) {}
    }
    if (!periods || periods.length === 0) {
        periods = ["01.10-10.10"];
    }

    try {
        const stored = localStorage.getItem('app_saved_periods_list');
        if (stored) {
            const list = JSON.parse(stored);
            if (Array.isArray(list)) {
                list.forEach(p => { if (p && !periods.includes(p)) periods.push(p); });
            }
        }
    } catch(e) {}

    try {
        const eqStored = localStorage.getItem('eq_saved_periods_list');
        if (eqStored) {
            const list = JSON.parse(eqStored);
            if (Array.isArray(list)) {
                list.forEach(p => { if (p && !periods.includes(p)) periods.push(p); });
            }
        }
    } catch(e) {}

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('equipment_report_data_')) {
            const p = key.replace('equipment_report_data_', '');
            if (p && !periods.includes(p)) periods.push(p);
        }
    }
    return periods;
}

function initEqReportPeriodDropdown() {
    const select = document.getElementById('eq-report-period-select');
    if (!select) return;
    const periods = getSavedEquipmentPeriodsList();
    
    if (!activeEquipmentReportPeriod) {
        activeEquipmentReportPeriod = (typeof activeReportPeriod !== 'undefined' && activeReportPeriod)
            ? activeReportPeriod
            : (periods[periods.length - 1] || "01.10-10.10");
    }

    let html = '';
    periods.forEach(p => {
        html += `<option value="${p}" ${p === activeEquipmentReportPeriod ? 'selected' : ''}>${p}</option>`;
    });
    select.innerHTML = html;
    if (periods.includes(activeEquipmentReportPeriod)) {
        select.value = activeEquipmentReportPeriod;
    }

    const customInput = document.getElementById('eq-report-custom-period');
    if (customInput) {
        customInput.value = activeEquipmentReportPeriod;
    }

    updateEquipmentReportHeaders();
}

function updateEquipmentReportHeaders() {
    const periodInput = document.getElementById('eq-report-custom-period');
    const periodStr = periodInput ? periodInput.value.trim() : (activeEquipmentReportPeriod || "01.10-10.10");
    let parts = periodStr.split('-');
    let startDate = parts[0] ? parts[0].trim() : "01.10";
    let endDate = parts[1] ? parts[1].trim() : startDate;

    let monthNum = 10;
    if (startDate.includes('.')) {
        monthNum = parseInt(startDate.split('.')[1], 10) || 10;
    } else if (endDate.includes('.')) {
        monthNum = parseInt(endDate.split('.')[1], 10) || 10;
    }
    const mm = String(monthNum).padStart(2, '0');

    // Кількість днів у місяці (31, 30, 28/29)
    const curYear = (typeof currentYear !== 'undefined' && currentYear) ? currentYear : (new Date().getFullYear());
    const daysInMonth = new Date(curYear, monthNum, 0).getDate() || 31;

    const p1Label = `1-10.${mm}`;
    const p2Label = `11-20.${mm}`;
    const p3Label = `21-${daysInMonth}.${mm}`;

    // Розраховуємо початок наступного періоду
    let nextStartDate = "";
    if (typeof getNextTenDayPeriod === 'function') {
        const nextP = getNextTenDayPeriod(periodStr);
        if (nextP && nextP.includes('-')) {
            nextStartDate = nextP.split('-')[0].trim();
        }
    }
    if (!nextStartDate) {
        const startDay = parseInt(startDate.split('.')[0], 10) || 1;
        if (startDay === 1) nextStartDate = `11.${mm}`;
        else if (startDay === 11) nextStartDate = `21.${mm}`;
        else {
            const nextM = (monthNum % 12) + 1;
            nextStartDate = `01.${String(nextM).padStart(2, '0')}`;
        }
    }

    document.querySelectorAll('.eq-rep-start').forEach(el => el.textContent = startDate);
    document.querySelectorAll('.eq-rep-end').forEach(el => el.textContent = endDate);
    document.querySelectorAll('.eq-rep-next-start').forEach(el => el.textContent = nextStartDate);
    document.querySelectorAll('.eq-rep-p1-label').forEach(el => el.textContent = p1Label);
    document.querySelectorAll('.eq-rep-p2-label').forEach(el => el.textContent = p2Label);
    document.querySelectorAll('.eq-rep-p3-label').forEach(el => el.textContent = p3Label);
}

function getPreviousEquipmentPeriodKey(currentPeriod) {
    if (typeof getPrevPeriodKey === 'function') {
        const p = getPrevPeriodKey(currentPeriod);
        if (p) return p;
    }
    const periods = getSavedEquipmentPeriodsList();
    const cleanCurrent = (currentPeriod || "").trim();
    const idx = periods.indexOf(cleanCurrent);
    if (idx > 0) return periods[idx - 1];

    const parts = cleanCurrent.split('-');
    const startDate = parts[0] ? parts[0].trim() : "";
    if (startDate.includes('.')) {
        const d = parseInt(startDate.split('.')[0], 10);
        const m = parseInt(startDate.split('.')[1], 10);
        const mm = String(m).padStart(2, '0');
        if (d === 11) return `01.${mm}-10.${mm}`;
        if (d === 21) return `11.${mm}-20.${mm}`;
        if (d === 1) {
            const prevM = m === 1 ? 12 : m - 1;
            const prevMm = String(prevM).padStart(2, '0');
            const prevDays = new Date(2024, prevM, 0).getDate();
            return `21.${prevMm}-${prevDays}.${prevMm}`;
        }
    }
    return null;
}

function propagateNextFuelToNextPeriod(periodStr, reportData) {
    if (!periodStr || !reportData) return;
    let nextPeriodKey = null;
    if (typeof getNextTenDayPeriod === 'function') {
        nextPeriodKey = getNextTenDayPeriod(periodStr);
    }
    if (!nextPeriodKey) {
        const parts = periodStr.split('-');
        const s = parts[0] ? parts[0].trim() : "";
        if (s.includes('.')) {
            const d = parseInt(s.split('.')[0], 10);
            const m = parseInt(s.split('.')[1], 10);
            const mm = String(m).padStart(2, '0');
            if (d === 1) nextPeriodKey = `11.${mm}-20.${mm}`;
            else if (d === 11) {
                const daysInM = new Date(2024, m, 0).getDate();
                nextPeriodKey = `21.${mm}-${daysInM}.${mm}`;
            } else {
                const nextM = (m % 12) + 1;
                const nextMm = String(nextM).padStart(2, '0');
                nextPeriodKey = `01.${nextMm}-10.${nextMm}`;
            }
        }
    }
    if (!nextPeriodKey) return;

    try {
        const nextKey = `equipment_report_data_${nextPeriodKey}`;
        let nextData = {};
        const stored = localStorage.getItem(nextKey);
        if (stored) nextData = JSON.parse(stored);

        let changed = false;
        for (let uid in reportData) {
            const nextVal = reportData[uid]?.nextFuel;
            if (nextVal !== undefined && nextVal !== null && String(nextVal).trim() !== '') {
                if (!nextData[uid]) {
                    nextData[uid] = { prevFuel: '', prevOil: '', p1Fuel: '', p1Oil: '', p2Fuel: '', p2Oil: '', p3Fuel: '', p3Oil: '', nextFuel: '' };
                }
                nextData[uid].prevFuel = String(nextVal).trim();
                nextData[uid]._autoCarried = true;
                changed = true;
            }
        }
        if (changed) {
            localStorage.setItem(nextKey, JSON.stringify(nextData));
        }
    } catch(e) {}
}

function saveCurrentEquipmentReportSilently() {
    const periodInput = document.getElementById('eq-report-custom-period');
    const periodStr = periodInput ? periodInput.value.trim() : (activeEquipmentReportPeriod || "01.10-10.10");
    if (!periodStr) return;

    const rows = document.querySelectorAll('#equipment-report-tbody tr');
    if (rows.length === 0) return;

    const storageKey = `equipment_report_data_${periodStr}`;
    let reportData = {};
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) reportData = JSON.parse(stored);
    } catch(e) {}

    const inputs = document.querySelectorAll('.eq-rep-input');
    inputs.forEach(input => {
        const id = input.getAttribute('data-id');
        const field = input.getAttribute('data-field');
        const val = input.value;
        if (id && field) {
            if (!reportData[id]) {
                reportData[id] = { prevFuel: '', prevOil: '', p1Fuel: '', p1Oil: '', p2Fuel: '', p2Oil: '', p3Fuel: '', p3Oil: '', nextFuel: '' };
            }
            reportData[id][field] = val;
        }
    });

    localStorage.setItem(storageKey, JSON.stringify(reportData));
    propagateNextFuelToNextPeriod(periodStr, reportData);
}

function changeEqReportPeriod(val) {
    if (!val) return;
    saveCurrentEquipmentReportSilently();
    activeEquipmentReportPeriod = val;
    const customInput = document.getElementById('eq-report-custom-period');
    if (customInput) customInput.value = val;
    updateEquipmentReportHeaders();
    renderEquipmentReportView();
    if (typeof applyModeratorReportLock === 'function') {
        applyModeratorReportLock();
    }
}

window.navigateEquipmentReportPeriod = function(direction) {
    saveCurrentEquipmentReportSilently();

    let periods = getSavedEquipmentPeriodsList();
    const selectEl = document.getElementById('eq-report-period-select');
    let current = (selectEl && selectEl.value) ? selectEl.value : activeEquipmentReportPeriod;
    let idx = periods.indexOf(current);
    if (idx === -1) idx = periods.length - 1;

    let newIdx = idx + direction;

    if (direction > 0 && newIdx >= periods.length) {
        let nextPeriod = null;
        if (typeof getNextTenDayPeriod === 'function') {
            nextPeriod = getNextTenDayPeriod(periods[periods.length - 1]);
        }
        if (nextPeriod && !periods.includes(nextPeriod)) {
            periods.push(nextPeriod);
            localStorage.setItem('app_saved_periods_list', JSON.stringify(periods));
            localStorage.setItem('eq_saved_periods_list', JSON.stringify(periods));
        }
        if (nextPeriod) {
            newIdx = periods.indexOf(nextPeriod);
        }
    }

    if (newIdx >= 0 && newIdx < periods.length) {
        activeEquipmentReportPeriod = periods[newIdx];
        const customInput = document.getElementById('eq-report-custom-period');
        if (customInput) customInput.value = activeEquipmentReportPeriod;
        initEqReportPeriodDropdown();
        renderEquipmentReportView();
        if (typeof applyModeratorReportLock === 'function') {
            applyModeratorReportLock();
        }
    }
};

function getAllEquipmentItemsUnified() {
    let allItems = [];
    
    let gens = [];
    try { if (typeof getGeneratorsList === 'function') gens = getGeneratorsList(); } catch(e) {}
    if (!gens || gens.length === 0) gens = window.generatorsData || window.generators || [];

    let webs = [];
    try { if (typeof getWebastoList === 'function') webs = getWebastoList(); } catch(e) {}
    if (!webs || webs.length === 0) webs = window.webastoData || window.webasto || [];

    let heats = [];
    try { if (typeof getHeatersList === 'function') heats = getHeatersList(); } catch(e) {}
    if (!heats || heats.length === 0) heats = window.heatersData || window.heaters || [];

    let chains = [];
    try { if (typeof getChainsawsList === 'function') chains = getChainsawsList(); } catch(e) {}
    if (!chains || chains.length === 0) chains = window.chainsawsData || window.chainsaws || [];

    let pumps = [];
    try { if (typeof getPumpsList === 'function') pumps = getPumpsList(); } catch(e) {}

    const sources = [
        { type: 'Генератор', data: gens },
        { type: 'Webasto', data: webs },
        { type: 'Теплова пушка', data: heats },
        { type: 'Бензопила', data: chains },
        { type: 'Помпа', data: pumps }
    ];

    sources.forEach(src => {
        if (Array.isArray(src.data)) {
            src.data.forEach((item, index) => {
                const noteStr = String(item.note || "").toLowerCase();
                if (noteStr.includes('знищ')) return; // Пропускаємо знищені позиції

                const actualSub = item.locationSubdivision || item.subdivision || item.sub || 'РМТЗ';
                allItems.push({
                    uniqueId: `${src.type}_${item.id || index}`,
                    category: src.type,
                    subdivision: actualSub,
                    model: item.model || item.name || `Пристрій #${index + 1}`,
                    fuelType: item.fuelType || item.fuel || 'Бензин'
                });
            });
        }
    });

    if (allItems.length === 0) {
        allItems = [
            { uniqueId: 'Gen_1', category: 'Генератор', subdivision: 'РМТЗ', model: 'Honda EU22i', fuelType: 'Бензин' },
            { uniqueId: 'Web_1', category: 'Webasto', subdivision: 'ВТО', model: 'Air Top 2000', fuelType: 'ДП' }
        ];
    }

    return allItems;
}

function evaluateExpression(expr) {
    if (!expr) return 0;
    if (typeof expr === 'number') return expr;
    let str = String(expr).trim().replace(',', '.');
    if (str === '' || str === '-') return 0;
    try {
        let sanitized = str.replace(/[^0-9+\-*/().]/g, '');
        if (!sanitized) return 0;
        let result = Function('"use strict"; return (' + sanitized + ')')();
        return isNaN(result) ? 0 : Number(result);
    } catch (e) {
        return 0;
    }
}

function parseFluidEntries(val) {
    if (val === undefined || val === null) return {};
    const str = String(val).trim();
    if (!str) return {};

    let result = {};
    const regex = /([0-9.,+\-*/()]+)\s*\(([^)]+)\)/g;
    let match;
    let foundAny = false;

    while ((match = regex.exec(str)) !== null) {
        foundAny = true;
        let qtyExpr = match[1].trim();
        let qty = evaluateExpression(qtyExpr);
        let type = match[2].trim().toLowerCase();
        if (qty > 0) {
            result[type] = (result[type] || 0) + qty;
        }
    }

    if (!foundAny) {
        let qty = evaluateExpression(str);
        if (qty > 0) {
            result[''] = (result[''] || 0) + qty;
        }
    }

    return result;
}

function formatFluidBreakdown(fluidMap) {
    if (!fluidMap) return '0';
    let parts = [];
    let keys = Object.keys(fluidMap).sort();
    
    for (let type of keys) {
        let qty = fluidMap[type];
        if (qty > 0) {
            if (type === '') {
                parts.push(qty.toFixed(1));
            } else {
                parts.push(`${qty.toFixed(1)} (${type})`);
            }
        }
    }
    return parts.length > 0 ? parts.join(', ') : '0';
}

function mergeFluidMaps(targetMap, sourceMap) {
    for (let t in sourceMap) {
        targetMap[t] = (targetMap[t] || 0) + sourceMap[t];
    }
    return targetMap;
}

function renderEquipmentReportView() {
    const tbody = document.getElementById('equipment-report-tbody');
    if (!tbody) return;

    const periodInput = document.getElementById('eq-report-custom-period');
    const periodStr = periodInput ? periodInput.value.trim() : (activeEquipmentReportPeriod || "01.10-10.10");
    updateEquipmentReportHeaders();

    const items = getAllEquipmentItemsUnified();

    const subFilterEl = document.getElementById('equipment-subdivision-filter');
    const currentSubVal = subFilterEl ? subFilterEl.value : 'all';

    if (subFilterEl) {
        const subs = new Set();
        items.forEach(i => { if (i.subdivision) subs.add(i.subdivision.trim()); });
        let opts = '<option value="all">Усі</option>';
        subs.forEach(sub => {
            opts += `<option value="${sub}">${sub}</option>`;
        });
        subFilterEl.innerHTML = opts;
        if (subs.has(currentSubVal) || currentSubVal === 'all') {
            subFilterEl.value = currentSubVal;
        }
    }
    const selectedSub = subFilterEl ? subFilterEl.value : 'all';

    const filteredItems = items.filter(item => {
        if (selectedSub !== 'all' && item.subdivision.trim() !== selectedSub) {
            return false;
        }
        return true;
    });

    const storageKey = `equipment_report_data_${periodStr}`;
    let savedData = {};
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) savedData = JSON.parse(stored);
    } catch(e) {}

    // Читаємо дані попереднього періоду для автоматичного перенесення залишку палива
    const prevPeriodKey = getPreviousEquipmentPeriodKey(periodStr);
    let prevPeriodSavedData = {};
    if (prevPeriodKey) {
        try {
            const prevStored = localStorage.getItem(`equipment_report_data_${prevPeriodKey}`);
            if (prevStored) prevPeriodSavedData = JSON.parse(prevStored);
        } catch(e) {}
    }

    tbody.innerHTML = '';

    filteredItems.forEach((item, idx) => {
        let itemData = savedData[item.uniqueId] || {
            prevFuel: '', prevOil: '',
            p1Fuel: '', p1Oil: '',
            p2Fuel: '', p2Oil: '',
            p3Fuel: '', p3Oil: '',
            nextFuel: ''
        };

        // Перевіряємо залишок з попереднього періоду (nextFuel попереднього стає prevFuel поточного)
        if (prevPeriodSavedData && prevPeriodSavedData[item.uniqueId]) {
            const carriedFuel = prevPeriodSavedData[item.uniqueId].nextFuel;
            if (carriedFuel !== undefined && carriedFuel !== null && String(carriedFuel).trim() !== '') {
                if (itemData.prevFuel === '' || itemData.prevFuel === undefined || itemData._autoCarried) {
                    itemData.prevFuel = String(carriedFuel).trim();
                    itemData._autoCarried = true;
                }
            }
        }

        const curRole = (typeof window.getCurrentAppRole === 'function')
            ? window.getCurrentAppRole()
            : ((typeof currentRole !== 'undefined') ? currentRole : 'user');
        const canEditEq = (curRole === 'developer') || (typeof window.canRoleEdit === 'function' ? (window.canRoleEdit(curRole, 'equipment_report') && window.canRoleDo(curRole, 'eq_report_edit')) : (curRole === 'admin'));
        const eqLock = canEditEq ? '' : 'disabled readonly style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px; background-color: #f1f2f6; cursor: not-allowed; color: #2c3e50;" title="Редагування доступне тільки для Адміна та Розробника"';

        const tr = document.createElement('tr');
        tr.setAttribute('data-fuel-type', (item.fuelType || '').toUpperCase());
        tr.innerHTML = `
            <td style="text-align: center;">${idx + 1}</td>
            <td><span style="background: #e8f8f5; padding: 2px 6px; border-radius: 4px; font-size: 11px; color: #16a085; font-weight: bold;">${item.category}</span></td>
            <td style="text-align: center;"><strong>${item.subdivision}</strong></td>
            <td><strong>${item.model}</strong></td>
            <td style="text-align: center;" class="eq-row-fuel-type">${item.fuelType}</td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="prevFuel" value="${itemData.prevFuel || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px; ${itemData._autoCarried ? 'background-color: #f0fdf4;' : ''}" ${eqLock}></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="prevOil" value="${itemData.prevOil || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;" ${eqLock}></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="p1Fuel" value="${itemData.p1Fuel || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;" ${eqLock}></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="p1Oil" value="${itemData.p1Oil || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;" ${eqLock}></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="p2Fuel" value="${itemData.p2Fuel || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;" ${eqLock}></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="p2Oil" value="${itemData.p2Oil || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;" ${eqLock}></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="p3Fuel" value="${itemData.p3Fuel || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;" ${eqLock}></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="p3Oil" value="${itemData.p3Oil || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;" ${eqLock}></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="nextFuel" value="${itemData.nextFuel || ''}" style="width: 100%; text-align: center; border: 1px solid #27ae60; background: #f0fdf4; padding: 4px; font-weight: bold; color: #166534;" placeholder="0.0" ${eqLock}></td>
        `;
        tbody.appendChild(tr);
    });

    const curRole2 = (typeof window.getCurrentAppRole === 'function')
        ? window.getCurrentAppRole()
        : ((typeof currentRole !== 'undefined') ? currentRole : 'user');
    const canEditEq2 = (curRole2 === 'developer') || (typeof window.canRoleEdit === 'function' ? window.canRoleEdit(curRole2, 'equipment_report') : (curRole2 === 'admin'));
    const eqSaveBtn = document.querySelector('button[onclick="saveEquipmentReportData()"]');
    if (eqSaveBtn) eqSaveBtn.style.setProperty('display', canEditEq2 ? 'inline-flex' : 'none', 'important');

    updateEquipmentReportTotals();
}

function updateEquipmentReportTotals() {
    let table = document.getElementById('equipment-report-table');
    if (!table) return;
    let tfoot = table.querySelector('tfoot');
    if (!tfoot) {
        tfoot = document.createElement('tfoot');
        table.appendChild(tfoot);
    }

    let dpPrevFuel = 0, abPrevFuel = 0;
    let dpP1Fuel = 0, abP1Fuel = 0;
    let dpP2Fuel = 0, abP2Fuel = 0;
    let dpP3Fuel = 0, abP3Fuel = 0;
    let dpNextFuel = 0, abNextFuel = 0;

    let sumPrevOilMap = {};
    let sumP1OilMap = {};
    let sumP2OilMap = {};
    let sumP3OilMap = {};

    document.querySelectorAll('#equipment-report-tbody tr').forEach(row => {
        const fuelTypeCell = row.querySelector('.eq-row-fuel-type');
        const fType = fuelTypeCell ? fuelTypeCell.textContent.trim().toUpperCase() : '';
        
        const prevF = evaluateExpression(row.querySelector('.eq-rep-input[data-field="prevFuel"]')?.value);
        const p1F = evaluateExpression(row.querySelector('.eq-rep-input[data-field="p1Fuel"]')?.value);
        const p2F = evaluateExpression(row.querySelector('.eq-rep-input[data-field="p2Fuel"]')?.value);
        const p3F = evaluateExpression(row.querySelector('.eq-rep-input[data-field="p3Fuel"]')?.value);
        const nextF = evaluateExpression(row.querySelector('.eq-rep-input[data-field="nextFuel"]')?.value);

        if (fType.includes('ДП')) {
            dpPrevFuel += prevF;
            dpP1Fuel += p1F;
            dpP2Fuel += p2F;
            dpP3Fuel += p3F;
            dpNextFuel += nextF;
        } else {
            abPrevFuel += prevF;
            abP1Fuel += p1F;
            abP2Fuel += p2F;
            abP3Fuel += p3F;
            abNextFuel += nextF;
        }

        mergeFluidMaps(sumPrevOilMap, parseFluidEntries(row.querySelector('.eq-rep-input[data-field="prevOil"]')?.value));
        mergeFluidMaps(sumP1OilMap, parseFluidEntries(row.querySelector('.eq-rep-input[data-field="p1Oil"]')?.value));
        mergeFluidMaps(sumP2OilMap, parseFluidEntries(row.querySelector('.eq-rep-input[data-field="p2Oil"]')?.value));
        mergeFluidMaps(sumP3OilMap, parseFluidEntries(row.querySelector('.eq-rep-input[data-field="p3Oil"]')?.value));
    });

    const subFilterEl = document.getElementById('equipment-subdivision-filter');
    let footerLabel = 'ВСЬОГО ПО ОБЛАДНАННЮ:';
    if (subFilterEl && subFilterEl.value !== 'all') {
        footerLabel = `ВСЬОГО ПО ПІДРОЗДІЛУ (${subFilterEl.value}):`;
    }

    const totalDpPeriod = dpP1Fuel + dpP2Fuel + dpP3Fuel;
    const totalAbPeriod = abP1Fuel + abP2Fuel + abP3Fuel;

    let totalOilPeriodMap = {};
    mergeFluidMaps(totalOilPeriodMap, sumP1OilMap);
    mergeFluidMaps(totalOilPeriodMap, sumP2OilMap);
    mergeFluidMaps(totalOilPeriodMap, sumP3OilMap);

    tfoot.innerHTML = `
        <tr style="background-color: #eaeaea; font-weight: bold; border-top: 2px solid #bdc3c7;">
            <td colspan="5" style="text-align: right; padding-right: 10px; border-bottom: 1px solid #dcdcdc;">${footerLabel} (ДП)</td>
            <td style="text-align: center; color: #27ae60; border-bottom: 1px solid #dcdcdc;">${dpPrevFuel !== 0 ? dpPrevFuel.toFixed(1) + ' л' : '0 л'}</td>
            <td rowspan="2" style="text-align: center; vertical-align: middle; border-left: 1px solid #dcdcdc; border-right: 1px solid #dcdcdc; font-size: 11px;">${formatFluidBreakdown(sumPrevOilMap)}</td>
            <td style="text-align: center; color: #27ae60; border-bottom: 1px solid #dcdcdc;">${dpP1Fuel !== 0 ? dpP1Fuel.toFixed(1) + ' л' : '0 л'}</td>
            <td rowspan="2" style="text-align: center; vertical-align: middle; border-left: 1px solid #dcdcdc; border-right: 1px solid #dcdcdc; font-size: 11px;">${formatFluidBreakdown(sumP1OilMap)}</td>
            <td style="text-align: center; color: #27ae60; border-bottom: 1px solid #dcdcdc;">${dpP2Fuel !== 0 ? dpP2Fuel.toFixed(1) + ' л' : '0 л'}</td>
            <td rowspan="2" style="text-align: center; vertical-align: middle; border-left: 1px solid #dcdcdc; border-right: 1px solid #dcdcdc; font-size: 11px;">${formatFluidBreakdown(sumP2OilMap)}</td>
            <td style="text-align: center; color: #27ae60; border-bottom: 1px solid #dcdcdc;">${dpP3Fuel !== 0 ? dpP3Fuel.toFixed(1) + ' л' : '0 л'}</td>
            <td rowspan="2" style="text-align: center; vertical-align: middle; border-left: 1px solid #dcdcdc; border-right: 1px solid #dcdcdc; font-size: 11px;">${formatFluidBreakdown(sumP3OilMap)}</td>
            <td style="text-align: center; color: #27ae60; border-bottom: 1px solid #dcdcdc; font-weight: bold;">${dpNextFuel !== 0 ? dpNextFuel.toFixed(1) + ' л' : '0 л'}</td>
        </tr>
        <tr style="background-color: #eaeaea; font-weight: bold; border-bottom: 2px solid #bdc3c7;">
            <td colspan="5" style="text-align: right; padding-right: 10px; border-bottom: 2px solid #bdc3c7;">${footerLabel} (АБ)</td>
            <td style="text-align: center; color: #2980b9; border-bottom: 2px solid #bdc3c7;">${abPrevFuel !== 0 ? abPrevFuel.toFixed(1) + ' л' : '0 л'}</td>
            <td style="text-align: center; color: #2980b9; border-bottom: 2px solid #bdc3c7;">${abP1Fuel !== 0 ? abP1Fuel.toFixed(1) + ' л' : '0 л'}</td>
            <td style="text-align: center; color: #2980b9; border-bottom: 2px solid #bdc3c7;">${abP2Fuel !== 0 ? abP2Fuel.toFixed(1) + ' л' : '0 л'}</td>
            <td style="text-align: center; color: #2980b9; border-bottom: 2px solid #bdc3c7;">${abP3Fuel !== 0 ? abP3Fuel.toFixed(1) + ' л' : '0 л'}</td>
            <td style="text-align: center; color: #2980b9; border-bottom: 2px solid #bdc3c7; font-weight: bold;">${abNextFuel !== 0 ? abNextFuel.toFixed(1) + ' л' : '0 л'}</td>
        </tr>
        <tr style="background-color: #d5f5e3; font-weight: bold; border-top: 2px solid #27ae60; border-bottom: 2px solid #27ae60;">
            <td colspan="5" style="text-align: right; padding-right: 10px; color: #145a32;">ВСЬОГО ЗА ПЕРІУД:</td>
            <td colspan="2" style="text-align: center; color: #27ae60;">Початковий: ДП ${dpPrevFuel.toFixed(1)} л | АБ ${abPrevFuel.toFixed(1)} л</td>
            <td colspan="6" style="text-align: left; padding-left: 15px; color: #2c3e50;">Заправка: ДП <strong style="color: #27ae60;">${totalDpPeriod.toFixed(1)} л</strong> | АБ <strong style="color: #2980b9;">${totalAbPeriod.toFixed(1)} л</strong> | Мастило <strong style="color: #8e44ad;">${formatFluidBreakdown(totalOilPeriodMap)}</strong></td>
            <td style="text-align: center; color: #145a32; font-weight: bold;">${(dpNextFuel + abNextFuel) > 0 ? (dpNextFuel + abNextFuel).toFixed(1) + ' л' : '0 л'}</td>
        </tr>
    `;
}

function saveEquipmentReportData() {
    const periodInput = document.getElementById('eq-report-custom-period');
    const periodStr = periodInput ? periodInput.value.trim() : "01.10-10.10";

    let periods = getSavedEquipmentPeriodsList();
    if (!periods.includes(periodStr)) {
        periods.push(periodStr);
        localStorage.setItem('eq_saved_periods_list', JSON.stringify(periods));
    }
    initEqReportPeriodDropdown();

    const storageKey = `equipment_report_data_${periodStr}`;
    const inputs = document.querySelectorAll('.eq-rep-input');
    let reportData = {};

    inputs.forEach(input => {
        const id = input.getAttribute('data-id');
        const field = input.getAttribute('data-field');
        const val = input.value;

        if (!reportData[id]) {
            reportData[id] = { prevFuel: '', prevOil: '', p1Fuel: '', p1Oil: '', p2Fuel: '', p2Oil: '', p3Fuel: '', p3Oil: '', nextFuel: '' };
        }
        reportData[id][field] = val;
    });

    localStorage.setItem(storageKey, JSON.stringify(reportData));
    propagateNextFuelToNextPeriod(periodStr, reportData);
    alert(`Звіт по обладнанню за період "${periodStr}" успішно збережено!`);
}

function printEquipmentReport() {
    const table = document.getElementById('equipment-report-table');
    if (!table) {
        window.print();
        return;
    }
    // Синхронізуємо атрибути value для коректного відображення у вікні друку
    table.querySelectorAll('input').forEach(inp => inp.setAttribute('value', inp.value));

    const periodInput = document.getElementById('eq-report-custom-period');
    const periodStr = periodInput ? periodInput.value.trim() : "01.10-10.10";
    const subFilterEl = document.getElementById('equipment-subdivision-filter');
    const subVal = subFilterEl ? subFilterEl.value : 'all';
    const subLabel = subVal !== 'all' ? ` (Підрозділ: ${subVal})` : '';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        window.print();
        return;
    }
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Звіт по обладнанню (${periodStr})</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 10px; }
                h2 { text-align: center; margin-bottom: 12px; font-size: 14px; color: #2c3e50; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
                th, td { border: 1px solid #333; padding: 4px 5px; text-align: center; }
                th { background-color: #2e7d32 !important; color: white !important; font-size: 10px; }
                td:nth-child(4) { text-align: left; }
                input { border: none; text-align: center; width: 100%; font-size: 10px; background: transparent; }
                tfoot tr { font-weight: bold; background: #eee; }
                @media print {
                    @page { size: landscape; margin: 6mm; }
                    body { -webkit-print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <h2>ДЕСЯТИДЕННИЙ ЗВІТ ПО ОБЛАДНАННЮ${subLabel} — Період: ${periodStr}</h2>
            ${table.outerHTML}
        </body>
        </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}

document.addEventListener('input', function(e) {
    if (e.target.classList.contains('eq-rep-input')) {
        const periodInput = document.getElementById('eq-report-custom-period');
        const periodStr = periodInput ? periodInput.value.trim() : "01.10-10.10";
        const storageKey = `equipment_report_data_${periodStr}`;
        
        let reportData = {};
        const inputs = document.querySelectorAll('.eq-rep-input');
        inputs.forEach(input => {
            const id = input.getAttribute('data-id');
            const field = input.getAttribute('data-field');
            const val = input.value;

            if (!reportData[id]) {
                reportData[id] = { prevFuel: '', prevOil: '', p1Fuel: '', p1Oil: '', p2Fuel: '', p2Oil: '', p3Fuel: '', p3Oil: '', nextFuel: '' };
            }
            reportData[id][field] = val;
        });

        localStorage.setItem(storageKey, JSON.stringify(reportData));
        propagateNextFuelToNextPeriod(periodStr, reportData);
        updateEquipmentReportTotals();
    }
});
