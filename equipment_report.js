// ==========================================
// ЗВІТ ПО ОБЛАДНАННЮ (equipment_report.js)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    initEqReportPeriodDropdown();
    renderEquipmentReportView();
});

function getSavedEquipmentPeriodsList() {
    let periods = ["01.10-10.10"];
    try {
        const stored = localStorage.getItem('eq_saved_periods_list');
        if (stored) {
            const customList = JSON.parse(stored);
            customList.forEach(p => { if (!periods.includes(p)) periods.push(p); });
        }
    } catch(e) {}
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('equipment_report_data_')) {
            const p = key.replace('equipment_report_data_', '');
            if (!periods.includes(p)) periods.push(p);
        }
    }
    return periods;
}

function initEqReportPeriodDropdown() {
    const select = document.getElementById('eq-report-period-select');
    if (!select) return;
    const periods = getSavedEquipmentPeriodsList();
    let html = '';
    periods.forEach(p => { html += `<option value="${p}">${p}</option>`; });
    html += `<option value="custom">Власний період...</option>`;
    select.innerHTML = html;
    
    const customInput = document.getElementById('eq-report-custom-period');
    const currentVal = customInput ? customInput.value : periods[0];
    if (periods.includes(currentVal)) {
        select.value = currentVal;
    } else {
        select.value = 'custom';
    }
}

function changeEqReportPeriod(val) {
    const customInput = document.getElementById('eq-report-custom-period');
    if (val === 'custom') {
        customInput.value = '';
        customInput.focus();
    } else {
        customInput.value = val;
        renderEquipmentReportView();
    }
}

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

    const sources = [
        { type: 'Генератор', data: gens },
        { type: 'Webasto', data: webs },
        { type: 'Теплова пушка', data: heats },
        { type: 'Бензопила', data: chains }
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
    const periodStr = periodInput ? periodInput.value.trim() : "01.10-10.10";

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

    tbody.innerHTML = '';

    filteredItems.forEach((item, idx) => {
        const itemData = savedData[item.uniqueId] || {
            prevFuel: '', prevOil: '',
            p1Fuel: '', p1Oil: '',
            p2Fuel: '', p2Oil: '',
            p3Fuel: '', p3Oil: ''
        };

        const tr = document.createElement('tr');
        tr.setAttribute('data-fuel-type', (item.fuelType || '').toUpperCase());
        tr.innerHTML = `
            <td style="text-align: center;">${idx + 1}</td>
            <td><span style="background: #e8f8f5; padding: 2px 6px; border-radius: 4px; font-size: 11px; color: #16a085; font-weight: bold;">${item.category}</span></td>
            <td style="text-align: center;"><strong>${item.subdivision}</strong></td>
            <td><strong>${item.model}</strong></td>
            <td style="text-align: center;" class="eq-row-fuel-type">${item.fuelType}</td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="prevFuel" value="${itemData.prevFuel || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;"></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="prevOil" value="${itemData.prevOil || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;"></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="p1Fuel" value="${itemData.p1Fuel || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;"></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="p1Oil" value="${itemData.p1Oil || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;"></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="p2Fuel" value="${itemData.p2Fuel || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;"></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="p2Oil" value="${itemData.p2Oil || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;"></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="p3Fuel" value="${itemData.p3Fuel || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;"></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="p3Oil" value="${itemData.p3Oil || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;"></td>
        `;
        tbody.appendChild(tr);
    });

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

        if (fType.includes('ДП')) {
            dpPrevFuel += prevF;
            dpP1Fuel += p1F;
            dpP2Fuel += p2F;
            dpP3Fuel += p3F;
        } else {
            abPrevFuel += prevF;
            abP1Fuel += p1F;
            abP2Fuel += p2F;
            abP3Fuel += p3F;
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
        </tr>
        <tr style="background-color: #eaeaea; font-weight: bold; border-bottom: 2px solid #bdc3c7;">
            <td colspan="5" style="text-align: right; padding-right: 10px; border-bottom: 2px solid #bdc3c7;">${footerLabel} (АБ)</td>
            <td style="text-align: center; color: #2980b9; border-bottom: 2px solid #bdc3c7;">${abPrevFuel !== 0 ? abPrevFuel.toFixed(1) + ' л' : '0 л'}</td>
            <td style="text-align: center; color: #2980b9; border-bottom: 2px solid #bdc3c7;">${abP1Fuel !== 0 ? abP1Fuel.toFixed(1) + ' л' : '0 л'}</td>
            <td style="text-align: center; color: #2980b9; border-bottom: 2px solid #bdc3c7;">${abP2Fuel !== 0 ? abP2Fuel.toFixed(1) + ' л' : '0 л'}</td>
            <td style="text-align: center; color: #2980b9; border-bottom: 2px solid #bdc3c7;">${abP3Fuel !== 0 ? abP3Fuel.toFixed(1) + ' л' : '0 л'}</td>
        </tr>
        <tr style="background-color: #d5f5e3; font-weight: bold; border-top: 2px solid #27ae60; border-bottom: 2px solid #27ae60;">
            <td colspan="5" style="text-align: right; padding-right: 10px; color: #145a32;">ВСЬОГО ЗА ПЕРІУД:</td>
            <td colspan="2" style="text-align: center; color: #27ae60;">ДП: ${totalDpPeriod.toFixed(1)} л | АБ: ${totalAbPeriod.toFixed(1)} л</td>
            <td colspan="6" style="text-align: left; padding-left: 20px; color: #2c3e50;">ДП: <strong style="color: #27ae60;">${totalDpPeriod.toFixed(1)} л</strong> &nbsp;|&nbsp; АБ: <strong style="color: #2980b9;">${totalAbPeriod.toFixed(1)} л</strong> &nbsp;|&nbsp; Мастило: <strong style="color: #8e44ad;">${formatFluidBreakdown(totalOilPeriodMap)}</strong></td>
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
            reportData[id] = { prevFuel: '', prevOil: '', p1Fuel: '', p1Oil: '', p2Fuel: '', p2Oil: '', p3Fuel: '', p3Oil: '' };
        }
        reportData[id][field] = val;
    });

    localStorage.setItem(storageKey, JSON.stringify(reportData));
    alert(`Звіт по обладнанню за період "${periodStr}" успішно збережено!`);
}

function printEquipmentReport() {
    window.print();
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
                reportData[id] = { prevFuel: '', prevOil: '', p1Fuel: '', p1Oil: '', p2Fuel: '', p2Oil: '', p3Fuel: '', p3Oil: '' };
            }
            reportData[id][field] = val;
        });

        localStorage.setItem(storageKey, JSON.stringify(reportData));
        updateEquipmentReportTotals();
    }
});