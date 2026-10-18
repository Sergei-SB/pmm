// ==========================================
// ЛОГІКА ДЕСЯТИДЕННОГО ЗВІТУ ТА ЗВІТУ ПО ПІДРОЗДІЛАХ (report.js)
// (ПЕРЕМИКАЧІ ПЕРІОДУ ТА МІСЯЦЯ ПРЯМО В ТАБЛИЦІ ПІДРОЗДІЛІВ)
// ==========================================

let activeReportPeriod = "";
let activeSubdivisionPeriod = "";
let activeSubdivisionMonth = "10.2026";

const UKRAINIAN_MONTH_NAMES = {
    1: "Січень",
    2: "Лютий",
    3: "Березень",
    4: "Квітень",
    5: "Травень",
    6: "Червень",
    7: "Липень",
    8: "Серпень",
    9: "Вересень",
    10: "Жовтень",
    11: "Листопад",
    12: "Грудень"
};

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        upgradeReportControlsUI();
        initPeriodDropdown();
        restoreDirectoryHandle();
        
        if (typeof renderReportTable === 'function') {
            renderReportTable();
        }
        if (typeof renderSubdivisionsView === 'function') {
            renderSubdivisionsView();
        }
    }, 100);
});

let projectDirectoryHandle = null;

function isItemDestroyed(note) {
    return /знищ/ui.test(note || '');
}

// ==========================================
// ЛОГІКА МІСЯЦІВ ДЛЯ РЯДКА "30 ДНІВ" У ЗВІТІ ПО ПІДРОЗДІЛАХ
// ==========================================

function getAvailableMonthsList() {
    let months = ["10.2026"];

    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;
    if (curY > 2026 || (curY === 2026 && curM >= 10)) {
        let y = 2026, m = 10;
        let safety = 0;
        while ((y < curY || (y === curY && m <= curM)) && safety < 24) {
            const key = `${String(m).padStart(2, '0')}.${y}`;
            if (!months.includes(key)) months.push(key);
            m++;
            if (m > 12) { m = 1; y++; }
            safety++;
        }
    }

    const periods = getSavedPeriodsList();
    periods.forEach(p => {
        if (!p || !p.includes('-')) return;
        const startPart = p.split('-')[0].trim();
        const parts = startPart.split('.');
        if (parts.length >= 2) {
            const m = parseInt(parts[1], 10);
            if (!isNaN(m)) {
                const y = parts[2] ? parseInt(parts[2], 10) : (m >= 10 ? 2026 : 2027);
                const key = `${String(m).padStart(2, '0')}.${y}`;
                if (!months.includes(key)) months.push(key);
            }
        }
    });

    try {
        const stored = localStorage.getItem('app_saved_months_list');
        if (stored) {
            const arr = JSON.parse(stored);
            if (Array.isArray(arr)) {
                arr.forEach(k => {
                    if (k && !months.includes(k)) months.push(k);
                });
            }
        }
    } catch (e) {}

    months.sort((a, b) => {
        const [mA, yA] = a.split('.').map(Number);
        const [mB, yB] = b.split('.').map(Number);
        return (yA * 100 + mA) - (yB * 100 + mB);
    });

    localStorage.setItem('app_saved_months_list', JSON.stringify(months));
    return months;
}

function getNextMonthKey(monthKey) {
    const parts = (monthKey || "10.2026").split('.');
    let m = parseInt(parts[0], 10) || 10;
    let y = parseInt(parts[1], 10) || 2026;
    m++;
    if (m > 12) {
        m = 1;
        y++;
    }
    return `${String(m).padStart(2, '0')}.${y}`;
}

function formatMonthLabel(monthKey) {
    const parts = (monthKey || "10.2026").split('.');
    const m = parseInt(parts[0], 10) || 10;
    const y = parseInt(parts[1], 10) || 2026;
    const name = UKRAINIAN_MONTH_NAMES[m] || m;
    const mm = String(m).padStart(2, '0');
    return y === 2026 ? `${name} (${mm})` : `${name} (${mm}.${y})`;
}

function getThreePeriodsForMonth(monthKey) {
    const parts = (monthKey || "10.2026").split('.');
    const m = parseInt(parts[0], 10) || 10;
    const y = parseInt(parts[1], 10) || 2026;
    const mm = String(m).padStart(2, '0');
    const lastDay = new Date(y, m, 0).getDate();

    const standardThree = [
        `01.${mm}-10.${mm}`,
        `11.${mm}-20.${mm}`,
        `21.${mm}-${lastDay}.${mm}`
    ];

    const allPeriods = getSavedPeriodsList();
    allPeriods.forEach(p => {
        if (p && p.includes(`.${mm}`) && !standardThree.includes(p)) {
            standardThree.push(p);
        }
    });

    return standardThree;
}

window.changeSubdivisionMonth = function(val) {
    if (!val) return;
    activeSubdivisionMonth = val;
    refreshActiveSubdivisionView();
};

window.navigateSubdivisionMonth = function(direction) {
    let months = getAvailableMonthsList();
    let idx = months.indexOf(activeSubdivisionMonth);
    if (idx === -1) idx = 0;

    let newIdx = idx + direction;

    if (direction > 0 && newIdx >= months.length) {
        const nextM = getNextMonthKey(months[months.length - 1]);
        if (!months.includes(nextM)) {
            months.push(nextM);
            localStorage.setItem('app_saved_months_list', JSON.stringify(months));
        }
        newIdx = months.indexOf(nextM);
    }

    if (newIdx >= 0 && newIdx < months.length) {
        activeSubdivisionMonth = months[newIdx];
        refreshActiveSubdivisionView();
    }
};

// Блок перемикання ПЕРІОДУ всередині клітинки "Обраний період" у таблиці підрозділів
function buildPeriodSelectorWidgetHtml(periodsOptionsHtml, currentCustomPeriod) {
    return `
        <div class="card-period-box" style="display: inline-flex; align-items: center; gap: 6px; background: #ecf0f1; padding: 4px 8px; border-radius: 4px; border: 1px solid #bdc3c7; margin-top: 6px;">
            <label style="font-weight: bold; font-size: 12px; color: #2c3e50;">Період:</label>
            <button type="button" class="action-btn no-print" onclick="navigateSubdivisionPeriod(-1)" style="background: #34495e; padding: 3px 7px; font-size: 10px; color: white; border: none; border-radius: 3px; cursor: pointer;">◄</button>
            <select id="sub-custom-period-select" onchange="changeSubCustomPeriod(this.value)" style="padding: 3px 6px; font-size: 12px; border-radius: 3px; border: 1px solid #7f8c8d; background: white; cursor: pointer; font-weight: bold; color: #2c3e50;">
                ${periodsOptionsHtml}
            </select>
            <button type="button" class="action-btn no-print" onclick="navigateSubdivisionPeriod(1)" style="background: #34495e; padding: 3px 7px; font-size: 10px; color: white; border: none; border-radius: 3px; cursor: pointer;">►</button>
            <input type="hidden" id="sub-custom-period-input" value="${currentCustomPeriod}">
        </div>
    `;
}

// Блок перемикання МІСЯЦЯ всередині клітинки "30 днів (за місяць)" у таблиці підрозділів
function buildMonthSelectorWidgetHtml() {
    const months = getAvailableMonthsList();
    if (!activeSubdivisionMonth || !months.includes(activeSubdivisionMonth)) {
        activeSubdivisionMonth = months[0] || "10.2026";
    }

    const optionsHtml = months.map(mKey => 
        `<option value="${mKey}" ${mKey === activeSubdivisionMonth ? 'selected' : ''}>${formatMonthLabel(mKey)}</option>`
    ).join('');

    return `
        <div class="card-period-box" style="display: inline-flex; align-items: center; gap: 6px; background: #ecf0f1; padding: 4px 8px; border-radius: 4px; border: 1px solid #bdc3c7; margin-top: 6px;">
            <label style="font-weight: bold; font-size: 12px; color: #2c3e50;">Місяць:</label>
            <button type="button" class="action-btn no-print" onclick="navigateSubdivisionMonth(-1)" style="background: #34495e; padding: 3px 7px; font-size: 10px; color: white; border: none; border-radius: 3px; cursor: pointer;">◄</button>
            <select id="sub-month-select" onchange="changeSubdivisionMonth(this.value)" style="padding: 3px 6px; font-size: 12px; border-radius: 3px; border: 1px solid #7f8c8d; background: white; cursor: pointer; font-weight: bold; color: #2c3e50;">
                ${optionsHtml}
            </select>
            <button type="button" class="action-btn no-print" onclick="navigateSubdivisionMonth(1)" style="background: #34495e; padding: 3px 7px; font-size: 10px; color: white; border: none; border-radius: 3px; cursor: pointer;">►</button>
        </div>
    `;
}

// Зверху праворуч у Звіті по підрозділах тепер залишається тільки кнопка "Друк звіту"
function buildSubdivisionTopPrintButtonHtml() {
    return `
        <div class="no-print" style="position: absolute; top: 15px; right: 20px; display: flex; align-items: center; gap: 10px;">
            <button class="action-btn print-btn" onclick="printSubdivisionReport()" style="background-color: #337ab7; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; white-space: nowrap;">
                <span style="font-size: 14px; margin-right: 6px; vertical-align: middle;">🖨️</span> Друк звіту
            </button>
        </div>
    `;
}

function upgradeReportControlsUI() {
    const controls = document.querySelector('#report-view .report-controls');
    if (!controls || document.getElementById('rep-nav-prev-btn')) return;

    const currentPeriods = getSavedPeriodsList();
    if (!activeReportPeriod) {
        activeReportPeriod = (typeof activeCarPeriod !== 'undefined' && activeCarPeriod)
            ? activeCarPeriod
            : (currentPeriods[currentPeriods.length - 1] || "01.10-10.10");
    }

    controls.style.display = 'flex';
    controls.style.alignItems = 'center';
    controls.style.gap = '12px';

    controls.innerHTML = `
        <div class="card-period-box" style="display: flex; align-items: center; gap: 10px; background: #ecf0f1; padding: 6px 12px; border-radius: 4px; border: 1px solid #bdc3c7;">
            <label style="font-weight: bold; font-size: 13px; color: #2c3e50;">Період:</label>
            <button id="rep-nav-prev-btn" type="button" class="action-btn" onclick="navigateReportPeriod(-1)" style="background: #34495e; padding: 4px 8px; font-size: 11px; color: white; border: none; border-radius: 3px; cursor: pointer;">◄</button>
            <select id="report-period-select" onchange="changeReportPeriod(this.value)" style="padding: 4px 8px; font-size: 13px; border-radius: 3px; border: 1px solid #7f8c8d; background: white; cursor: pointer; font-weight: bold;"></select>
            <button id="rep-nav-next-btn" type="button" class="action-btn" onclick="navigateReportPeriod(1)" style="background: #34495e; padding: 4px 8px; font-size: 11px; color: white; border: none; border-radius: 3px; cursor: pointer;">►</button>
        </div>
        <input type="hidden" id="report-custom-period" value="${activeReportPeriod}">
        <button id="rep-save-btn" class="action-btn" onclick="saveReportData()" style="background-color: #27ae60; font-weight: bold;">💾 Зберегти звіт</button>
        <button id="print-ten-days-report-btn" class="action-btn print-btn" onclick="printTenDaysReport()" style="background-color: #337ab7; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; white-space: nowrap;">
            <span style="font-size: 14px; margin-right: 6px; vertical-align: middle;">🖨️</span> Друк звіту
        </button>
    `;
}

function shouldHideItemInReport(itemType, itemId, itemNote, reportPeriodStr) {
    if (!isItemDestroyed(itemNote)) return false;

    let meta = { date: '' };
    try {
        const stored = localStorage.getItem(`destroyed_meta_${itemType}_${itemId}`);
        if (stored) meta = JSON.parse(stored);
    } catch(e) {}

    let destMonth = null;
    let destYear = 2026;

    if (meta.date) {
        const parts = meta.date.split('.');
        if (parts.length >= 2) {
            destMonth = parseInt(parts[1], 10);
            destYear = parts[2] ? parseInt(parts[2], 10) : 2026;
        }
    }

    if (!destMonth || isNaN(destMonth)) {
        destMonth = 10; 
        destYear = 2026;
    }

    let repMonth = null;
    let repYear = 2026;

    if (reportPeriodStr) {
        const match = reportPeriodStr.match(/\.(\d{2})(?:\.(\d{4}))?/);
        if (match) {
            repMonth = parseInt(match[1], 10);
            if (match[2]) repYear = parseInt(match[2], 10);
        }
    }

    if (!repMonth || isNaN(repMonth)) {
        repMonth = 10;
    }

    if (repYear > destYear) return true;
    if (repYear === destYear && repMonth > destMonth) return true;

    return false;
}

async function restoreDirectoryHandle() {
    try {
        const storedHandle = window.projectDirHandle;
        if (storedHandle && (await storedHandle.queryPermission({ mode: 'readwrite' })) === 'granted') {
            projectDirectoryHandle = storedHandle;
        }
    } catch(e) {}
}

function injectSaveButtonToHeader() {
    // Видалено на вимогу користувача
}

async function saveAllDataDirectlyToDoc() {
    let exportData = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
            exportData[key] = localStorage.getItem(key);
        }
    }

    try {
        if (!projectDirectoryHandle) {
            alert("Будь ласка, вкажіть вашу папку F:\\ПОЛК\\Doc (або просто папку Doc для збереження).");
            projectDirectoryHandle = await window.showDirectoryPicker();
        }

        let targetHandle = projectDirectoryHandle;
        if (projectDirectoryHandle.name.toLowerCase() !== 'doc') {
            try {
                targetHandle = await projectDirectoryHandle.getDirectoryHandle('Doc', { create: true });
            } catch(e) {
                targetHandle = projectDirectoryHandle;
            }
        }

        const fileHandle = await targetHandle.getFileHandle('data.json', { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(exportData, null, 2));
        await writable.close();

        alert("Успішно збережено всі дані та звіти у файл data.json у папку Doc!");
    } catch (err) {
        if (err.name === 'AbortError') return;
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "data.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        alert("Файл data.json звантажено через браузер. Перемістіть його у папку Doc.");
    }
}

function evaluateExpression(val) {
    if (val === undefined || val === null || val === '') return 0;
    const str = String(val).trim();
    if (!isNaN(str)) {
        return parseFloat(str) || 0;
    }
    try {
        const sanitized = str.replace(/,/g, '.').replace(/[^0-9+\-*/().\s]/g, '');
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

// ==========================================
// ЄДИНА СИСТЕМА ПЕРІОДІВ (ЯК У КАРТЦІ АВТО)
// ==========================================

function getStandardPeriods() {
    if (typeof getSortedPeriods === 'function') {
        return getSortedPeriods();
    }
    return ["01.10-10.10"];
}

function getSavedPeriodsList() {
    if (typeof getSortedPeriods === 'function') {
        return getSortedPeriods();
    }
    let periods = ["01.10-10.10"];
    try {
        const stored = localStorage.getItem('app_saved_periods_list');
        if (stored) {
            const customList = JSON.parse(stored);
            if (Array.isArray(customList)) {
                customList.forEach(p => {
                    if (p && p.includes('-') && parseInt(p.split('-')[0].split('.')[1], 10) >= 10 && !periods.includes(p)) {
                        periods.push(p);
                    }
                });
            }
        }
    } catch(e) {}
    return periods;
}

function populatePeriodDropdown(selectedVal) {
    const periods = getSavedPeriodsList();
    const targetVal = selectedVal || activeReportPeriod || periods[periods.length - 1] || "01.10-10.10";

    const select = document.getElementById('report-period-select');
    if (select) {
        select.innerHTML = periods.map(p => `<option value="${p}" ${p === targetVal ? 'selected' : ''}>${p}</option>`).join('');
        if (periods.includes(targetVal)) {
            select.value = targetVal;
        }
    }

    const customInput = document.getElementById('report-custom-period');
    if (customInput && periods.includes(targetVal)) {
        customInput.value = targetVal;
    }

    const subTargetVal = activeSubdivisionPeriod || targetVal;
    const subSelect = document.getElementById('sub-custom-period-select');
    if (subSelect) {
        subSelect.innerHTML = periods.map(p => `<option value="${p}" ${p === subTargetVal ? 'selected' : ''}>${p}</option>`).join('');
        if (periods.includes(subTargetVal)) {
            subSelect.value = subTargetVal;
        }
    }

    const subCustomInput = document.getElementById('sub-custom-period-input');
    if (subCustomInput && periods.includes(subTargetVal)) {
        subCustomInput.value = subTargetVal;
    }

    if (typeof initCardPeriodsSelect === 'function') {
        initCardPeriodsSelect();
    }
}

function initPeriodDropdown() {
    upgradeReportControlsUI();
    const periods = getSavedPeriodsList();
    const defaultPeriod = (typeof activeCarPeriod !== 'undefined' && periods.includes(activeCarPeriod))
        ? activeCarPeriod
        : (periods[periods.length - 1] || "01.10-10.10");

    activeReportPeriod = defaultPeriod;
    activeSubdivisionPeriod = defaultPeriod;

    populatePeriodDropdown(defaultPeriod);
    const customInput = document.getElementById('report-custom-period');
    if (customInput) customInput.value = defaultPeriod;
    const subCustomInput = document.getElementById('sub-custom-period-input');
    if (subCustomInput) subCustomInput.value = defaultPeriod;
}

function saveCurrentReportSilently() {
    const periodInput = document.getElementById('report-custom-period');
    const periodStr = periodInput ? periodInput.value.trim() : activeReportPeriod;
    if (!periodStr) return;

    const rows = document.querySelectorAll('#report-tbody tr');
    if (rows.length === 0) return;

    const storageKey = 'report_data_' + periodStr;
    let reportData = {};
    try {
        const existing = localStorage.getItem(storageKey);
        if (existing) reportData = JSON.parse(existing);
    } catch (e) {}

    rows.forEach(row => {
        const carIdInput = row.querySelector('.report-cell-input');
        if (carIdInput) {
            const carId = carIdInput.getAttribute('data-car');
            reportData[carId] = {
                fuelType: row.querySelector('.report-cell-input[data-field="fuelType"]')?.value || '',
                prevFuel: row.querySelector('.report-cell-input[data-field="prevFuel"]')?.value || '',
                prevAdBlue: row.querySelector('.report-cell-input[data-field="prevAdBlue"]')?.value || '',
                prevOdo: row.querySelector('.report-cell-input[data-field="prevOdo"]')?.value || '',
                refuelFuel: row.querySelector('.report-cell-input[data-field="refuelFuel"]')?.value || '',
                refuelAdBlue: row.querySelector('.report-cell-input[data-field="refuelAdBlue"]')?.value || '',
                refuelOil: row.querySelector('.report-cell-input[data-field="refuelOil"]')?.value || '',
                refuelWasher: row.querySelector('.report-cell-input[data-field="refuelWasher"]')?.value || '',
                note: row.querySelector('.report-cell-input[data-field="note"]')?.value || '',
                docNo: row.querySelector('.report-cell-input[data-field="docNo"]')?.value || '',
                leftFuel: row.querySelector('.report-cell-input[data-field="leftFuel"]')?.value || '',
                leftAdBlue: row.querySelector('.report-cell-input[data-field="leftAdBlue"]')?.value || '',
                odo: row.querySelector('.report-cell-input[data-field="odo"]')?.value || '',
                spentFuel: reportData[carId]?.spentFuel || ''
            };
        }
    });

    localStorage.setItem(storageKey, JSON.stringify(reportData));
}

window.getCurrentAppRole = function() {
    let r = '';
    try {
        if (typeof window.currentRole !== 'undefined' && window.currentRole) r = window.currentRole;
    } catch(e) {}
    if (!r) {
        try {
            if (typeof currentRole !== 'undefined' && currentRole) r = currentRole;
        } catch(e) {}
    }
    if (!r) {
        try {
            r = localStorage.getItem('currentRole') || localStorage.getItem('app_current_role') || '';
        } catch(e) {}
    }
    r = String(r || 'user').toLowerCase().trim();
    if (!['user', 'moderator', 'admin', 'developer'].includes(r)) r = 'user';
    return r;
};

function changeReportPeriod(val) {
    if (!val) return;
    saveCurrentReportSilently();
    activeReportPeriod = val;
    const customInput = document.getElementById('report-custom-period');
    if (customInput) customInput.value = val;
    updateReportHeaders();
    renderReportTable();
    if (typeof window.applyReportRolePermissions === 'function') {
        window.applyReportRolePermissions();
    }
    if (typeof applyModeratorReportLock === 'function') {
        applyModeratorReportLock();
    }
}

window.navigateReportPeriod = function(direction) {
    saveCurrentReportSilently();

    let periods = getSavedPeriodsList();
    const selectEl = document.getElementById('report-period-select');
    let current = (selectEl && selectEl.value) ? selectEl.value : activeReportPeriod;
    let idx = periods.indexOf(current);
    if (idx === -1) idx = periods.length - 1;

    let newIdx = idx + direction;

    if (direction > 0 && newIdx >= periods.length && typeof getNextTenDayPeriod === 'function') {
        const nextPeriod = getNextTenDayPeriod(periods[periods.length - 1]);
        if (!periods.includes(nextPeriod)) {
            periods.push(nextPeriod);
            localStorage.setItem('app_saved_periods_list', JSON.stringify(periods));
        }
        newIdx = periods.indexOf(nextPeriod);
    }

    if (newIdx >= 0 && newIdx < periods.length) {
        activeReportPeriod = periods[newIdx];
        const customInput = document.getElementById('report-custom-period');
        if (customInput) customInput.value = activeReportPeriod;
        populatePeriodDropdown(activeReportPeriod);
        updateReportHeaders();
        renderReportTable();
        if (typeof window.applyReportRolePermissions === 'function') {
            window.applyReportRolePermissions();
        }
        if (typeof applyModeratorReportLock === 'function') {
            applyModeratorReportLock();
        }
    }
};

function changeSubCustomPeriod(val) {
    if (!val) return;
    activeSubdivisionPeriod = val;
    const customInput = document.getElementById('sub-custom-period-input');
    if (customInput) customInput.value = val;
    refreshActiveSubdivisionView();
}

function changePolkCustomPeriod(val) {
    changeSubCustomPeriod(val);
}

window.navigateSubdivisionPeriod = function(direction) {
    let periods = getSavedPeriodsList();
    const selectEl = document.getElementById('sub-custom-period-select');
    let current = (selectEl && selectEl.value) ? selectEl.value : activeSubdivisionPeriod;
    let idx = periods.indexOf(current);
    if (idx === -1) idx = periods.length - 1;

    let newIdx = idx + direction;

    if (direction > 0 && newIdx >= periods.length && typeof getNextTenDayPeriod === 'function') {
        const nextPeriod = getNextTenDayPeriod(periods[periods.length - 1]);
        if (!periods.includes(nextPeriod)) {
            periods.push(nextPeriod);
            localStorage.setItem('app_saved_periods_list', JSON.stringify(periods));
        }
        newIdx = periods.indexOf(nextPeriod);
    }

    if (newIdx >= 0 && newIdx < periods.length) {
        activeSubdivisionPeriod = periods[newIdx];
        const customInput = document.getElementById('sub-custom-period-input');
        if (customInput) customInput.value = activeSubdivisionPeriod;
        populatePeriodDropdown(activeReportPeriod);
        refreshActiveSubdivisionView();
    }
};

function refreshActiveSubdivisionView() {
    const activeSubEl = document.querySelector('#subdivisions-buttons-container .action-btn.active-sub');
    if (activeSubEl) {
        const activeSubName = activeSubEl.getAttribute('data-subname');
        if (activeSubName === 'ПОЛК') {
            showPolkDetails();
        } else if (activeSubName === 'НЕ ЗАДІЯНА ТЕХНІКА') {
            showNoSubdivisionDetails();
        } else {
            showSubdivisionDetails(activeSubName);
        }
    }
}

function updateReportHeaders() {
    const periodInput = document.getElementById('report-custom-period');
    const periodStr = periodInput ? periodInput.value.trim() : (activeReportPeriod || "01.10-10.10");
    
    let parts = periodStr.split('-');
    let startDate = parts[0] ? parts[0].trim() : "01.10";
    let endDate = parts[1] ? parts[1].trim() : startDate;

    document.querySelectorAll('.rep-p').forEach(el => el.textContent = periodStr);
    document.querySelectorAll('.rep-start').forEach(el => el.textContent = startDate);
    document.querySelectorAll('.rep-end').forEach(el => el.textContent = endDate);
}

function getPreviousPeriodKey(currentPeriod) {
    const periods = getSavedPeriodsList();
    const cleanCurrent = (currentPeriod || "").trim();
    const idx = periods.indexOf(cleanCurrent);
    if (idx > 0) {
        return periods[idx - 1];
    }
    return null;
}

function printTenDaysReport() {
    const printWindow = window.open('', '_blank');
    const tableElement = document.getElementById('report-table');
    const periodInput = document.getElementById('report-custom-period');
    const periodValue = periodInput ? periodInput.value : 'десятиденний період';

    let tableHtml = tableElement ? tableElement.outerHTML : '<p>Таблиця звіту не знайдена</p>';

    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Десятиденний звіт по автопарку</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 5px; }
                h2 { text-align: center; margin-bottom: 10px; font-size: 13px; }
                table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                th, td { border: 1px solid #333; padding: 3px 4px; text-align: center; font-size: 9px; }
                th { background-color: #2e7d32 !important; color: white !important; }
                input, select { border: none; background: transparent; text-align: center; font-size: 9px; width: 100%; }
                @media print {
                    @page { size: landscape; margin: 5mm; }
                    body { -webkit-print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <h2>ДЕСЯТИДЕННИЙ ЗВІТ ПО АВТОПАРКУ (Період: ${periodValue})</h2>
            ${tableHtml}
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

window.applyReportRolePermissions = function() {
    const role = (typeof window.getCurrentAppRole === 'function')
        ? window.getCurrentAppRole()
        : ((typeof currentRole !== 'undefined') ? currentRole : 'user');
    const canEdit = (role === 'developer') || (typeof window.canRoleEdit === 'function' ? (window.canRoleEdit(role, 'report') && window.canRoleDo(role, 'report_edit_cells')) : (role === 'admin'));

    const inputs = document.querySelectorAll('#report-tbody input.report-cell-input, #report-tbody select, #report-table tbody input, #report-table tbody select');
    inputs.forEach(inp => {
        if (!canEdit) {
            inp.setAttribute('disabled', 'true');
            inp.setAttribute('readonly', 'true');
            inp.disabled = true;
            inp.readOnly = true;
            inp.style.backgroundColor = '#f1f2f6';
            inp.style.cursor = 'not-allowed';
            inp.style.color = '#2c3e50';
            inp.title = 'Редагування доступне тільки для Адміна та Розробника';
        } else {
            if (inp.getAttribute('data-no-adblue') === 'true') {
                inp.setAttribute('disabled', 'true');
                inp.disabled = true;
                inp.style.backgroundColor = '#e0e0e0';
                inp.style.cursor = 'not-allowed';
            } else {
                inp.removeAttribute('disabled');
                inp.removeAttribute('readonly');
                inp.disabled = false;
                inp.readOnly = false;
                inp.style.backgroundColor = '';
                inp.style.cursor = '';
                inp.style.color = '';
                inp.removeAttribute('title');
            }
        }
    });

    const customPeriodInput = document.getElementById('report-custom-period');
    if (customPeriodInput) {
        customPeriodInput.disabled = !canEdit;
        customPeriodInput.readOnly = !canEdit;
    }

    const saveBtns = document.querySelectorAll('#report-view button[onclick*="saveReportData"], #rep-save-btn');
    saveBtns.forEach(btn => {
        btn.style.setProperty('display', canEdit ? 'inline-block' : 'none', 'important');
    });

    // Підрозділ та період завжди активні для модератора для перегляду та фільтрації
    const periodSelect = document.getElementById('report-period-select');
    if (periodSelect) {
        periodSelect.removeAttribute('disabled');
        periodSelect.disabled = false;
        periodSelect.style.cursor = 'pointer';
    }
    const subFilter = document.getElementById('report-subdivision-filter');
    if (subFilter) {
        subFilter.removeAttribute('disabled');
        subFilter.disabled = false;
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
};

function renderReportTable() {
    upgradeReportControlsUI();
    const periods = getSavedPeriodsList();
    if (!activeReportPeriod || !periods.includes(activeReportPeriod)) {
        activeReportPeriod = periods[periods.length - 1] || "01.10-10.10";
    }
    populatePeriodDropdown(activeReportPeriod);
    updateReportHeaders();

    const table = document.getElementById('report-table');
    if (!table) return;
    
    let tbody = document.getElementById('report-tbody');
    if (!tbody) {
        tbody = document.createElement('tbody');
        tbody.id = 'report-tbody';
        table.appendChild(tbody);
    }
    tbody.innerHTML = '';

    const periodInput = document.getElementById('report-custom-period');
    const periodStr = periodInput ? periodInput.value.trim() : activeReportPeriod;
    const storageKey = 'report_data_' + periodStr;
    
    let savedReportData = {};
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) savedReportData = JSON.parse(stored);
    } catch (e) {
        console.error(e);
    }

    let prevPeriodSavedData = {};
    const prevPeriodKey = getPreviousPeriodKey(periodStr);
    if (prevPeriodKey) {
        try {
            const storedPrev = localStorage.getItem('report_data_' + prevPeriodKey);
            if (storedPrev) prevPeriodSavedData = JSON.parse(storedPrev);
        } catch (e) {
            console.error(e);
        }
    }

    const subFilterEl = document.getElementById('report-subdivision-filter');
    const currentSubVal = subFilterEl ? subFilterEl.value : 'all';

    if (subFilterEl) {
        const subs = getUniqueSubdivisions();
        let opts = '<option value="all">Усі</option>';
        subs.forEach(sub => {
            opts += '<option value="' + sub + '">' + sub + '</option>';
        });
        subFilterEl.innerHTML = opts;
        if (subs.includes(currentSubVal) || currentSubVal === 'all') {
            subFilterEl.value = currentSubVal;
        }
    }
    const selectedSub = subFilterEl ? subFilterEl.value : 'all';

    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const filteredCars = sourceCars.filter(car => {
        if (shouldHideItemInReport('car', car.id, car.note, periodStr)) return false;
        if (!car.plate || String(car.plate).trim() === '' || String(car.plate).trim() === '—') return false;
        if (selectedSub !== 'all' && (car.subdivision || '').trim() && normalizeSubdivision(car.subdivision) !== normalizeSubdivision(selectedSub)) {
            return false;
        }
        return true;
    });

    filteredCars.forEach((car, index) => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-fuel-type', (car.fuelType || '').toUpperCase());
        let carData = savedReportData[car.id];
        if (carData && carData.fuelType) {
            car.fuelType = carData.fuelType;
        }
        tr.setAttribute('data-fuel-type', (car.fuelType || '').toUpperCase());

        let autoPrevFuel = '';
        let autoPrevAdBlue = '';
        let autoPrevOdo = '';

        if (prevPeriodKey) {
            try {
                const prevCardRaw = localStorage.getItem(`isolated_car_routes_${prevPeriodKey}_${car.id}`);
                if (prevCardRaw) {
                    const prevCard = JSON.parse(prevCardRaw);
                    if (prevCard && prevCard.topFields) {
                        if (prevCard.topFields.savedFuelLeft !== undefined && prevCard.topFields.savedFuelLeft !== '') {
                            autoPrevFuel = prevCard.topFields.savedFuelLeft;
                        }
                        if (prevCard.topFields.savedAdblueLeft !== undefined && prevCard.topFields.savedAdblueLeft !== '') {
                            autoPrevAdBlue = prevCard.topFields.savedAdblueLeft;
                        }
                        if (prevCard.topFields.odo2 !== undefined && prevCard.topFields.odo2 !== '') {
                            autoPrevOdo = prevCard.topFields.odo2;
                        }
                    }
                }
            } catch (e) {}

            if (prevPeriodSavedData[car.id]) {
                if (prevPeriodSavedData[car.id].leftFuel) autoPrevFuel = prevPeriodSavedData[car.id].leftFuel;
                if (prevPeriodSavedData[car.id].leftAdBlue) autoPrevAdBlue = prevPeriodSavedData[car.id].leftAdBlue;
                if (prevPeriodSavedData[car.id].odo) autoPrevOdo = prevPeriodSavedData[car.id].odo;
            }
        }

        let currCardTop = null;
        try {
            const currCardRaw = localStorage.getItem(`isolated_car_routes_${periodStr}_${car.id}`);
            if (currCardRaw) {
                const currCard = JSON.parse(currCardRaw);
                if (currCard && currCard.topFields) currCardTop = currCard.topFields;
            }
        } catch (e) {}

        if (!carData) {
            let initLeftFuel = currCardTop?.savedFuelLeft || '';
            if (initLeftFuel === '' && currCardTop && (currCardTop.fuelStart || currCardTop.fuelReceived)) {
                const st = evaluateExpression(currCardTop.fuelStart) || 0;
                const rc = evaluateExpression(currCardTop.fuelReceived) || 0;
                const sp = evaluateExpression(currCardTop.fuelSpent) || 0;
                if (st > 0 || rc > 0) {
                    initLeftFuel = Math.max(0, (st + rc) - sp).toFixed(2);
                }
            } else if (initLeftFuel === '' && autoPrevFuel !== '') {
                initLeftFuel = autoPrevFuel;
            }

            carData = {
                fuelType: car.fuelType || '',
                prevFuel: autoPrevFuel !== '' ? autoPrevFuel : (currCardTop?.fuelStart || ''),
                prevAdBlue: autoPrevAdBlue !== '' ? autoPrevAdBlue : (currCardTop?.adblueStart || ''),
                prevOdo: autoPrevOdo !== '' ? autoPrevOdo : (currCardTop?.odo1 || ''),
                refuelFuel: currCardTop?.fuelReceived || '',
                refuelAdBlue: currCardTop?.adblueReceived || '',
                refuelOil: '',
                refuelWasher: '',
                note: car.note || '',
                docNo: '',
                leftFuel: initLeftFuel,
                leftAdBlue: currCardTop?.savedAdblueLeft || '',
                odo: currCardTop?.odo2 || ''
            };
        } else {
            if ((carData.prevFuel === '' || carData.prevFuel == null) && autoPrevFuel !== '') {
                carData.prevFuel = autoPrevFuel;
            }
            if ((carData.prevAdBlue === '' || carData.prevAdBlue == null) && autoPrevAdBlue !== '') {
                carData.prevAdBlue = autoPrevAdBlue;
            }
            if ((carData.prevOdo === '' || carData.prevOdo == null) && autoPrevOdo !== '') {
                carData.prevOdo = autoPrevOdo;
            }
            if (carData.leftFuel === '' || carData.leftFuel == null) {
                if (currCardTop?.savedFuelLeft) {
                    carData.leftFuel = currCardTop.savedFuelLeft;
                } else if (currCardTop && (currCardTop.fuelStart || currCardTop.fuelReceived)) {
                    const st = evaluateExpression(currCardTop.fuelStart) || 0;
                    const rc = evaluateExpression(currCardTop.fuelReceived) || 0;
                    const sp = evaluateExpression(currCardTop.fuelSpent) || 0;
                    if (st > 0 || rc > 0) {
                        carData.leftFuel = Math.max(0, (st + rc) - sp).toFixed(2);
                    }
                } else if (carData.prevFuel || carData.refuelFuel) {
                    const st = evaluateExpression(carData.prevFuel) || 0;
                    const rc = evaluateExpression(carData.refuelFuel) || 0;
                    const sp = evaluateExpression(carData.spentFuel) || 0;
                    if (st > 0 || rc > 0) {
                        carData.leftFuel = Math.max(0, (st + rc) - sp).toFixed(2);
                    }
                }
            }
            if ((carData.leftAdBlue === '' || carData.leftAdBlue == null) && currCardTop?.savedAdblueLeft) {
                carData.leftAdBlue = currCardTop.savedAdblueLeft;
            }
            if ((carData.odo === '' || carData.odo == null) && currCardTop?.odo2) {
                carData.odo = currCardTop.odo2;
            }
        }

        const role = (typeof window.getCurrentAppRole === 'function')
            ? window.getCurrentAppRole()
            : ((typeof currentRole !== 'undefined') ? currentRole : 'user');
        const canEditReport = (role === 'admin' || role === 'developer');
        const lockAttr = canEditReport ? '' : 'disabled readonly style="background:#f1f2f6; cursor:not-allowed; color:#2c3e50;" title="Редагування доступне тільки для Адміна та Розробника"';

        const noAdblueAttr = car.hasAdBlue ? '' : 'disabled data-no-adblue="true" style="background:#e0e0e0; cursor:not-allowed;"';

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${car.plate}</strong></td>
            <td>${car.subdivision}</td>
            <td class="rep-row-fuel-type" style="padding: 2px;">
                <input type="text" class="report-cell-input rep-fuel-type-input" data-car="${car.id}" data-field="fuelType" value="${car.fuelType || ''}" list="fuel-types-list" oninput="updateCarFuelTypeFromReport(${car.id}, this.value)" style="width: 100%; text-align: center; font-weight: bold; padding: 2px; border: 1px solid #bdc3c7; border-radius: 2px; font-size: 11px;" ${lockAttr}>
            </td>
            <td style="text-align: left; padding-left: 10px;">${car.model}</td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="prevFuel" value="${carData.prevFuel}" ${lockAttr}></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="prevAdBlue" value="${carData.prevAdBlue}" ${noAdblueAttr || lockAttr}></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="prevOdo" value="${carData.prevOdo}" ${lockAttr}></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="refuelFuel" value="${carData.refuelFuel}" ${lockAttr}></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="refuelAdBlue" value="${carData.refuelAdBlue}" ${noAdblueAttr || lockAttr}></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="refuelOil" value="${carData.refuelOil}" ${lockAttr}></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="refuelWasher" value="${carData.refuelWasher}" ${lockAttr}></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="note" value="${carData.note}" ${lockAttr}></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="docNo" value="${carData.docNo}" ${lockAttr}></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="leftFuel" value="${carData.leftFuel}" ${lockAttr}></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="leftAdBlue" value="${carData.leftAdBlue}" ${noAdblueAttr || lockAttr}></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="odo" value="${carData.odo}" ${lockAttr}></td>
        `;
        tbody.appendChild(tr);
    });

    updateReportTotals();
    if (typeof window.applyReportRolePermissions === 'function') {
        window.applyReportRolePermissions();
    }
    if (typeof applyModeratorReportLock === 'function') {
        applyModeratorReportLock();
    }
    if (typeof updateRoleUI === 'function') {
        updateRoleUI();
    }
}

function updateCarFuelTypeFromReport(carId, val) {
    const newVal = String(val || '').trim();
    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const car = sourceCars.find(c => Number(c.id) === Number(carId));
    if (car) {
        car.fuelType = newVal;
        try {
            localStorage.setItem('cars_custom_data', JSON.stringify(sourceCars));
        } catch(e) {}
    }
    const row = document.querySelector(`.report-cell-input[data-car="${carId}"][data-field="fuelType"]`)?.closest('tr');
    if (row) {
        row.setAttribute('data-fuel-type', newVal.toUpperCase());
    }
    saveCurrentReportSilently();
    updateReportTotals();
    if (typeof renderSubdivisionsView === 'function') {
        const subView = document.getElementById('subdivisions-view');
        if (subView && subView.classList.contains('active')) {
            renderSubdivisionsView();
        }
    }
}

function updateReportTotals() {
    let tfoot = document.querySelector('#report-table tfoot');
    const table = document.getElementById('report-table');
    if (!table) return;

    if (!tfoot) {
        tfoot = document.createElement('tfoot');
        table.appendChild(tfoot);
    }

    let dpStartF = 0, abStartF = 0, sumStartAd = 0;
    let dpRefF = 0, abRefF = 0, sumRefAd = 0;
    let totalOilMap = {};
    let totalWasherMap = {};
    let dpEndF = 0, abEndF = 0, sumEndAd = 0;

    document.querySelectorAll('#report-tbody tr').forEach(row => {
        const fInput = row.querySelector('.report-cell-input[data-field="fuelType"]');
        const fType = fInput ? fInput.value.trim().toUpperCase() : (row.querySelector('.rep-row-fuel-type')?.textContent.trim().toUpperCase() || '');

        const startF = evaluateExpression(row.querySelector('.report-cell-input[data-field="prevFuel"]')?.value);
        const refF = evaluateExpression(row.querySelector('.report-cell-input[data-field="refuelFuel"]')?.value);
        const endF = evaluateExpression(row.querySelector('.report-cell-input[data-field="leftFuel"]')?.value);

        if (fType.includes('ДП')) {
            dpStartF += startF;
            dpRefF += refF;
            dpEndF += endF;
        } else {
            abStartF += startF;
            abRefF += refF;
            abEndF += endF;
        }

        sumStartAd += evaluateExpression(row.querySelector('.report-cell-input[data-field="prevAdBlue"]')?.value);
        sumRefAd += evaluateExpression(row.querySelector('.report-cell-input[data-field="refuelAdBlue"]')?.value);
        
        let oilVal = row.querySelector('.report-cell-input[data-field="refuelOil"]')?.value;
        let oilParsed = parseFluidEntries(oilVal);
        mergeFluidMaps(totalOilMap, oilParsed);

        let washerVal = row.querySelector('.report-cell-input[data-field="refuelWasher"]')?.value;
        let washerParsed = parseFluidEntries(washerVal);
        mergeFluidMaps(totalWasherMap, washerParsed);

        sumEndAd += evaluateExpression(row.querySelector('.report-cell-input[data-field="leftAdBlue"]')?.value);
    });

    const subFilterEl = document.getElementById('report-subdivision-filter');
    let footerLabel = 'ВСЬОГО ПО АВТОПАРКУ:';
    if (subFilterEl && subFilterEl.value !== 'all') {
        footerLabel = 'ВСЬОГО ПО ПІДРОЗДІЛУ (' + subFilterEl.value + '):';
    }

    tfoot.innerHTML = `
        <tr style="background-color: #eaeaea; font-weight: bold; border-top: 2px solid #bdc3c7;">
            <td colspan="8" style="text-align: right; padding-right: 10px; border-bottom: 1px solid #dcdcdc;">${footerLabel} (ДП)</td>
            <td style="text-align: center; color: #27ae60; border-bottom: 1px solid #dcdcdc;">${dpRefF !== 0 ? dpRefF.toFixed(1) + ' л' : '0 л'}</td>
            <td rowspan="2" style="text-align: center; vertical-align: middle; border-left: 1px solid #dcdcdc; border-right: 1px solid #dcdcdc;">${sumRefAd !== 0 ? sumRefAd.toFixed(1) + ' л' : '0'}</td>
            <td rowspan="2" style="text-align: center; vertical-align: middle; border-right: 1px solid #dcdcdc; font-size: 11px;">${formatFluidBreakdown(totalOilMap)}</td>
            <td rowspan="2" style="text-align: center; vertical-align: middle; border-right: 1px solid #dcdcdc; font-size: 11px;">${formatFluidBreakdown(totalWasherMap)}</td>
            <td rowspan="2" colspan="2"></td>
            <td style="text-align: center; color: #c0392b; border-bottom: 1px solid #dcdcdc;">${dpEndF !== 0 ? dpEndF.toFixed(1) + ' л' : '0 л'}</td>
            <td rowspan="2" style="text-align: center; vertical-align: middle; border-left: 1px solid #dcdcdc; border-right: 1px solid #dcdcdc;">${sumEndAd !== 0 ? sumEndAd.toFixed(1) + ' л' : '0'}</td>
            <td></td>
        </tr>
        <tr style="background-color: #eaeaea; font-weight: bold; border-bottom: 2px solid #bdc3c7;">
            <td colspan="8" style="text-align: right; padding-right: 10px; border-bottom: 2px solid #bdc3c7;">${footerLabel} (АБ)</td>
            <td style="text-align: center; color: #2980b9; border-bottom: 2px solid #bdc3c7;">${abRefF !== 0 ? abRefF.toFixed(1) + ' л' : '0 л'}</td>
            <td style="text-align: center; color: #c0392b; border-bottom: 2px solid #bdc3c7;">${abEndF !== 0 ? abEndF.toFixed(1) + ' л' : '0 л'}</td>
            <td></td>
        </tr>
        <tr style="background-color: #d5f5e3; font-weight: bold; border-top: 2px solid #27ae60; border-bottom: 2px solid #27ae60;">
            <td colspan="8" style="text-align: right; padding-right: 10px; color: #145a32;">ВСЬОГО ЗА ПЕРІОД:</td>
            <td colspan="9" style="text-align: left; padding-left: 20px; color: #2c3e50;">Пальне: <strong style="color: #27ae60;">ДП: ${dpRefF.toFixed(1)} л</strong>, <strong style="color: #2980b9;">АБ: ${abRefF.toFixed(1)} л</strong> &nbsp;|&nbsp; AdBlue: <strong>${sumRefAd.toFixed(1)} л</strong> &nbsp;|&nbsp; Мастило: <strong style="color: #8e44ad;">${formatFluidBreakdown(totalOilMap)}</strong> &nbsp;|&nbsp; Омивач: <strong>${formatFluidBreakdown(totalWasherMap)}</strong></td>
        </tr>
    `;
}

function normalizeSubdivision(sub) {
    if (!sub || !sub.trim()) return '';
    let trimmed = sub.trim();
    let upper = trimmed.toUpperCase();
    if (upper === 'PMT3' || upper === 'PMTЗ' || upper === 'РМТЗ') {
        return 'РМТЗ';
    }
    return trimmed;
}

// ==========================================
// ЗВІТ ПО ПІДРОЗДІЛАХ ТА ПОЛКУ (ВКЛАДКА)
// ==========================================

function renderSubdivisionsView() {
    const container = document.getElementById('subdivisions-buttons-container');
    if (!container) return;

    const periods = getSavedPeriodsList();
    if (!activeSubdivisionPeriod || !periods.includes(activeSubdivisionPeriod)) {
        activeSubdivisionPeriod = periods[periods.length - 1] || "01.10-10.10";
    }

    const subs = getUniqueSubdivisions();
    let html = '';
    subs.forEach(sub => {
        html += '<button class="action-btn sub-nav-btn" data-subname="' + sub + '" style="padding: 10px 20px; font-size: 14px; background-color: #2980b9; cursor: pointer;" onclick="showSubdivisionDetails(\'' + sub + '\')">' + sub + '</button>';
    });
    html += '<button class="action-btn sub-nav-btn" data-subname="НЕ ЗАДІЯНА ТЕХНІКА" style="padding: 10px 20px; font-size: 14px; background-color: #7f8c8d; cursor: pointer;" onclick="showNoSubdivisionDetails()">Не задіяна техніка</button>';
    html += '<button class="action-btn sub-nav-btn" data-subname="ПОЛК" style="padding: 10px 20px; font-size: 14px; background-color: #8e44ad; cursor: pointer;" onclick="showPolkDetails()">ПОЛК</button>';
    container.innerHTML = html;

    if (subs.length > 0) {
        showSubdivisionDetails(subs[0]);
    } else {
        showNoSubdivisionDetails();
    }
}

function getUniqueSubdivisions() {
    const subs = new Set();
    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    sourceCars.forEach(car => {
        if (car.subdivision && car.subdivision.trim() !== '') {
            let norm = normalizeSubdivision(car.subdivision);
            if (norm) subs.add(norm);
        }
    });
    try {
        if (typeof getAllEquipmentItemsUnified === 'function') {
            getAllEquipmentItemsUnified().forEach(item => {
                if (item.subdivision && item.subdivision.trim() !== '') {
                    let norm = normalizeSubdivision(item.subdivision);
                    if (norm) subs.add(norm);
                }
            });
        }
    } catch(e) {}
    return Array.from(subs).filter(s => s && s.trim() !== '');
}

function showSubdivisionDetails(subName) {
    document.querySelectorAll('#subdivisions-buttons-container .sub-nav-btn').forEach(btn => {
        const bName = btn.getAttribute('data-subname');
        if (bName === subName) {
            btn.style.backgroundColor = '#27ae60';
            btn.classList.add('active-sub');
        } else {
            if (bName === 'ПОЛК') btn.style.backgroundColor = '#8e44ad';
            else if (bName === 'НЕ ЗАДІЯНА ТЕХНІКА') btn.style.backgroundColor = '#7f8c8d';
            else btn.style.backgroundColor = '#2980b9';
            btn.classList.remove('active-sub');
        }
    });

    const container = document.getElementById('subdivisions-content-container');
    if (!container) return;

    const periods = getSavedPeriodsList();
    if (!activeSubdivisionPeriod || !periods.includes(activeSubdivisionPeriod)) {
        activeSubdivisionPeriod = periods[periods.length - 1] || "01.10-10.10";
    }
    let currentCustomPeriod = activeSubdivisionPeriod;

    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const subCars = sourceCars.filter(c => !shouldHideItemInReport('car', c.id, c.note, currentCustomPeriod) && c.subdivision && normalizeSubdivision(c.subdivision) === normalizeSubdivision(subName));
    
    let eqItems = [];
    try {
        if (typeof getAllEquipmentItemsUnified === 'function') {
            eqItems = getAllEquipmentItemsUnified().filter(i => !shouldHideItemInReport('equipment', i.uniqueId || i.id, i.note || i.description, currentCustomPeriod) && i.subdivision && normalizeSubdivision(i.subdivision) === normalizeSubdivision(subName));
        }
    } catch(e) {}

    let statsCustom = calculateSubStatsDetailed(subName, [currentCustomPeriod]);
    let monthPeriods = getThreePeriodsForMonth(activeSubdivisionMonth);
    let stats30 = calculateSubStatsDetailed(subName, monthPeriods);
    let statsAll = calculateSubStatsDetailed(subName, periods);

    let carsListHtml = subCars.length > 0 ? subCars.map(c => '<li style="margin-bottom: 4px;"><strong>' + c.plate + '</strong> — ' + c.model + ' (<span style="color: #27ae60; font-weight: bold;">паливо: ' + (c.fuelType || 'ДП') + '</span>)</li>').join('') : '<li style="color: #888; font-style: italic; list-style: none; margin-left: -15px;">Немає автомобілів</li>';
    let eqListHtml = eqItems.length > 0 ? eqItems.map(i => '<li style="margin-bottom: 4px;"><span style="background: #e8f8f5; padding: 1px 4px; border-radius: 3px; font-size: 11px; color: #16a085; font-weight: bold;">' + i.category + '</span> <strong>' + i.model + '</strong> (<span style="color: #27ae60; font-weight: bold;">паливо: ' + (i.fuelType || (i.category === 'Бензопила' ? 'АБ' : 'ДП')) + '</span>)</li>').join('') : '<li style="color: #888; font-style: italic; list-style: none; margin-left: -15px;">Немає обладнання</li>';
    let periodsOptionsHtml = periods.map(p => '<option value="' + p + '" ' + (p === currentCustomPeriod ? 'selected' : '') + '>' + p + '</option>').join('');

    let html = `
        <div id="subdivision-print-area" style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); position: relative;">
            
            ${buildSubdivisionTopPrintButtonHtml()}

            <h3 style="color: #2c3e50; margin-top: 0; margin-bottom: 15px;">Підрозділ: <span style="color: #2980b9;">${subName}</span></h3>
            
            <h4 style="margin: 15px 0 8px 0; color: #7f8c8d;">Автомобілі підрозділу (${subCars.length}):</h4>
            <div class="print-scroll-box" style="border: 1px solid #e0e0e0; padding: 10px 10px 10px 25px; border-radius: 4px; background: #f9f9f9; margin-bottom: 15px;">
                <ol style="margin: 0; padding-left: 15px; font-size: 14px;">
                    ${carsListHtml}
                </ol>
            </div>

            <h4 style="margin: 15px 0 8px 0; color: #7f8c8d;">Обладнання підрозділу (${eqItems.length}):</h4>
            <div class="print-scroll-box" style="border: 1px solid #e0e0e0; padding: 10px 10px 10px 25px; border-radius: 4px; background: #f9f9f9; margin-bottom: 20px;">
                <ol style="margin: 0; padding-left: 15px; font-size: 14px;">
                    ${eqListHtml}
                </ol>
            </div>

            <h4 style="margin: 15px 0 10px 0; color: #2c3e50;">Отримані матеріали та рідини:</h4>
            <table class="data-table" style="width: 100%;">
                <thead>
                    <tr>
                        <th style="text-align: left; width: 250px;">Період звіту / Категорія</th>
                        <th style="text-align: center;">Паливо ДП</th>
                        <th style="text-align: center;">Паливо АБ</th>
                        <th style="text-align: center;">AdBlue</th>
                        <th style="text-align: center;">Мастило</th>
                        <th style="text-align: center;">Омивач</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background: #eef9ff;">
                        <td rowspan="3" style="vertical-align: middle; border-bottom: 2px solid #2980b9; text-align: center;">
                            <div><strong style="color: #2980b9;">Обраний період</strong> <small style="color: #7f8c8d;">(${currentCustomPeriod})</small></div>
                            ${buildPeriodSelectorWidgetHtml(periodsOptionsHtml, currentCustomPeriod)}
                        </td>
                        <td style="text-align: center; color: #555; font-size: 12px;">🚗 ${statsCustom.cars.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">🚗 ${statsCustom.cars.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${statsCustom.cars.adblue.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${formatFluidBreakdown(statsCustom.cars.oilMap)}</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${formatFluidBreakdown(statsCustom.cars.washerMap)}</td>
                    </tr>
                    <tr style="background: #eef9ff;">
                        <td style="text-align: center; color: #16a085; font-size: 12px;">⚙️ ${statsCustom.eq.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #16a085; font-size: 12px;">⚙️ ${statsCustom.eq.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #888; font-size: 12px;">-</td>
                        <td style="text-align: center; color: #16a085; font-size: 12px;">${formatFluidBreakdown(statsCustom.eq.oilMap)}</td>
                        <td style="text-align: center; color: #888; font-size: 12px;">-</td>
                    </tr>
                    <tr style="background: #d4effc; font-weight: bold; border-bottom: 2px solid #2980b9;">
                        <td style="text-align: center; color: #27ae60;">Разом: ${statsCustom.total.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #2980b9;">Разом: ${statsCustom.total.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #2980b9;">${statsCustom.total.adblue.toFixed(1)} л</td>
                        <td style="text-align: center; color: #8e44ad;">${formatFluidBreakdown(statsCustom.total.oilMap)}</td>
                        <td style="text-align: center;">${formatFluidBreakdown(statsCustom.total.washerMap)}</td>
                    </tr>

                    <tr style="background: #fafafa;">
                        <td rowspan="3" style="vertical-align: middle; border-bottom: 2px solid #ccc; text-align: center;">
                            <div><strong>30 днів</strong> <small style="color: #7f8c8d;">(за місяць)</small></div>
                            ${buildMonthSelectorWidgetHtml()}
                        </td>
                        <td style="text-align: center; color: #555; font-size: 12px;">🚗 ${stats30.cars.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">🚗 ${stats30.cars.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${stats30.cars.adblue.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${formatFluidBreakdown(stats30.cars.oilMap)}</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${formatFluidBreakdown(stats30.cars.washerMap)}</td>
                    </tr>
                    <tr style="background: #fafafa;">
                        <td style="text-align: center; color: #16a085; font-size: 12px;">⚙️ ${stats30.eq.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #16a085; font-size: 12px;">⚙️ ${stats30.eq.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #888; font-size: 12px;">-</td>
                        <td style="text-align: center; color: #16a085; font-size: 12px;">${formatFluidBreakdown(stats30.eq.oilMap)}</td>
                        <td style="text-align: center; color: #888; font-size: 12px;">-</td>
                    </tr>
                    <tr style="background: #f2f9f6; font-weight: bold; border-bottom: 2px solid #bdc3c7;">
                        <td style="text-align: center; color: #27ae60;">Разом: ${stats30.total.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #2980b9;">Разом: ${stats30.total.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #2980b9;">${stats30.total.adblue.toFixed(1)} л</td>
                        <td style="text-align: center; color: #8e44ad;">${formatFluidBreakdown(stats30.total.oilMap)}</td>
                        <td style="text-align: center;">${formatFluidBreakdown(stats30.total.washerMap)}</td>
                    </tr>

                    <tr style="background: #fafafa;">
                        <td rowspan="3" style="vertical-align: middle;">
                            <strong>Всього за всі періоди</strong>
                        </td>
                        <td style="text-align: center; color: #555; font-size: 12px;">🚗 ${statsAll.cars.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">🚗 ${statsAll.cars.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${statsAll.cars.adblue.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${formatFluidBreakdown(statsAll.cars.oilMap)}</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${formatFluidBreakdown(statsAll.cars.washerMap)}</td>
                    </tr>
                    <tr style="background: #fafafa;">
                        <td style="text-align: center; color: #16a085; font-size: 12px;">⚙️ ${statsAll.eq.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #16a085; font-size: 12px;">⚙️ ${statsAll.eq.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #888; font-size: 12px;">-</td>
                        <td style="text-align: center; color: #16a085; font-size: 12px;">${formatFluidBreakdown(statsAll.eq.oilMap)}</td>
                        <td style="text-align: center; color: #888; font-size: 12px;">-</td>
                    </tr>
                    <tr style="background: #d5f5e3; font-weight: bold;">
                        <td style="text-align: center; color: #27ae60;">Разом: ${statsAll.total.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #2980b9;">Разом: ${statsAll.total.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #2980b9;">${statsAll.total.adblue.toFixed(1)} л</td>
                        <td style="text-align: center; color: #8e44ad;">${formatFluidBreakdown(statsAll.total.oilMap)}</td>
                        <td style="text-align: center;">${formatFluidBreakdown(statsAll.total.washerMap)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
    container.innerHTML = html;
}

function showNoSubdivisionDetails() {
    document.querySelectorAll('#subdivisions-buttons-container .sub-nav-btn').forEach(btn => {
        const bName = btn.getAttribute('data-subname');
        if (bName === 'НЕ ЗАДІЯНА ТЕХНІКА') {
            btn.style.backgroundColor = '#27ae60';
            btn.classList.add('active-sub');
        } else {
            if (bName === 'ПОЛК') btn.style.backgroundColor = '#8e44ad';
            else if (bName === 'НЕ ЗАДІЯНА ТЕХНІКА') btn.style.backgroundColor = '#7f8c8d';
            else btn.style.backgroundColor = '#2980b9';
            btn.classList.remove('active-sub');
        }
    });

    const container = document.getElementById('subdivisions-content-container');
    if (!container) return;

    const periods = getSavedPeriodsList();
    if (!activeSubdivisionPeriod || !periods.includes(activeSubdivisionPeriod)) {
        activeSubdivisionPeriod = periods[periods.length - 1] || "01.10-10.10";
    }
    let currentCustomPeriod = activeSubdivisionPeriod;

    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const subCars = sourceCars.filter(c => !shouldHideItemInReport('car', c.id, c.note, currentCustomPeriod) && (!c.subdivision || c.subdivision.trim() === ''));
    
    let eqItems = [];
    try {
        if (typeof getAllEquipmentItemsUnified === 'function') {
            eqItems = getAllEquipmentItemsUnified().filter(i => !shouldHideItemInReport('equipment', i.uniqueId || i.id, i.note || i.description, currentCustomPeriod) && (!i.subdivision || i.subdivision.trim() === ''));
        }
    } catch(e) {}

    let statsCustom = calculateNoSubStatsDetailed([currentCustomPeriod]);
    let monthPeriods = getThreePeriodsForMonth(activeSubdivisionMonth);
    let stats30 = calculateNoSubStatsDetailed(monthPeriods);
    let statsAll = calculateNoSubStatsDetailed(periods);

    let carsListHtml = subCars.length > 0 ? subCars.map(c => '<li style="margin-bottom: 4px;"><strong>' + c.plate + '</strong> — ' + c.model + ' (<span style="color: #27ae60; font-weight: bold;">паливо: ' + (c.fuelType || 'ДП') + '</span>)</li>').join('') : '<li style="color: #888; font-style: italic; list-style: none; margin-left: -15px;">Немає не задіяних автомобілів</li>';
    let eqListHtml = eqItems.length > 0 ? eqItems.map(i => '<li style="margin-bottom: 4px;"><span style="background: #e8f8f5; padding: 1px 4px; border-radius: 3px; font-size: 11px; color: #16a085; font-weight: bold;">' + i.category + '</span> <strong>' + i.model + '</strong> (<span style="color: #27ae60; font-weight: bold;">паливо: ' + (i.fuelType || (i.category === 'Бензопила' ? 'АБ' : 'ДП')) + '</span>)</li>').join('') : '<li style="color: #888; font-style: italic; list-style: none; margin-left: -15px;">Немає не задіяного обладнання</li>';
    let periodsOptionsHtml = periods.map(p => '<option value="' + p + '" ' + (p === currentCustomPeriod ? 'selected' : '') + '>' + p + '</option>').join('');

    let html = `
        <div id="subdivision-print-area" style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); position: relative;">
            
            ${buildSubdivisionTopPrintButtonHtml()}

            <h3 style="color: #2c3e50; margin-top: 0; margin-bottom: 15px;">Категорія: <span style="color: #7f8c8d;">Не задіяна техніка</span></h3>
            
            <h4 style="margin: 15px 0 8px 0; color: #7f8c8d;">Автомобілі без підрозділу (${subCars.length}):</h4>
            <div class="print-scroll-box" style="border: 1px solid #e0e0e0; padding: 10px 10px 10px 25px; border-radius: 4px; background: #f9f9f9; margin-bottom: 15px;">
                <ol style="margin: 0; padding-left: 15px; font-size: 14px;">
                    ${carsListHtml}
                </ol>
            </div>

            <h4 style="margin: 15px 0 8px 0; color: #7f8c8d;">Обладнання без підрозділу (${eqItems.length}):</h4>
            <div class="print-scroll-box" style="border: 1px solid #e0e0e0; padding: 10px 10px 10px 25px; border-radius: 4px; background: #f9f9f9; margin-bottom: 20px;">
                <ol style="margin: 0; padding-left: 15px; font-size: 14px;">
                    ${eqListHtml}
                </ol>
            </div>

            <h4 style="margin: 15px 0 10px 0; color: #2c3e50;">Отримані матеріали та рідини:</h4>
            <table class="data-table" style="width: 100%;">
                <thead>
                    <tr>
                        <th style="text-align: left; width: 250px;">Період звіту / Категорія</th>
                        <th style="text-align: center;">Паливо ДП</th>
                        <th style="text-align: center;">Паливо АБ</th>
                        <th style="text-align: center;">AdBlue</th>
                        <th style="text-align: center;">Мастило</th>
                        <th style="text-align: center;">Омивач</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background: #eef9ff;">
                        <td rowspan="3" style="vertical-align: middle; border-bottom: 2px solid #2980b9; text-align: center;">
                            <div><strong style="color: #2980b9;">Обраний період</strong> <small style="color: #7f8c8d;">(${currentCustomPeriod})</small></div>
                            ${buildPeriodSelectorWidgetHtml(periodsOptionsHtml, currentCustomPeriod)}
                        </td>
                        <td style="text-align: center; color: #555; font-size: 12px;">🚗 ${statsCustom.cars.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">🚗 ${statsCustom.cars.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${statsCustom.cars.adblue.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${formatFluidBreakdown(statsCustom.cars.oilMap)}</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${formatFluidBreakdown(statsCustom.cars.washerMap)}</td>
                    </tr>
                    <tr style="background: #eef9ff;">
                        <td style="text-align: center; color: #16a085; font-size: 12px;">⚙️ ${statsCustom.eq.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #16a085; font-size: 12px;">⚙️ ${statsCustom.eq.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #888; font-size: 12px;">-</td>
                        <td style="text-align: center; color: #16a085; font-size: 12px;">${formatFluidBreakdown(statsCustom.eq.oilMap)}</td>
                        <td style="text-align: center; color: #888; font-size: 12px;">-</td>
                    </tr>
                    <tr style="background: #d4effc; font-weight: bold; border-bottom: 2px solid #2980b9;">
                        <td style="text-align: center; color: #27ae60;">Разом: ${statsCustom.total.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #2980b9;">Разом: ${statsCustom.total.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #2980b9;">${statsCustom.total.adblue.toFixed(1)} л</td>
                        <td style="text-align: center; color: #8e44ad;">${formatFluidBreakdown(statsCustom.total.oilMap)}</td>
                        <td style="text-align: center;">${formatFluidBreakdown(statsCustom.total.washerMap)}</td>
                    </tr>

                    <tr style="background: #fafafa;">
                        <td rowspan="3" style="vertical-align: middle; border-bottom: 2px solid #ccc; text-align: center;">
                            <div><strong>30 днів</strong> <small style="color: #7f8c8d;">(за місяць)</small></div>
                            ${buildMonthSelectorWidgetHtml()}
                        </td>
                        <td style="text-align: center; color: #555; font-size: 12px;">🚗 ${stats30.cars.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">🚗 ${stats30.cars.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${stats30.cars.adblue.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${formatFluidBreakdown(stats30.cars.oilMap)}</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${formatFluidBreakdown(stats30.cars.washerMap)}</td>
                    </tr>
                    <tr style="background: #fafafa;">
                        <td style="text-align: center; color: #16a085; font-size: 12px;">⚙️ ${stats30.eq.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #16a085; font-size: 12px;">⚙️ ${stats30.eq.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #888; font-size: 12px;">-</td>
                        <td style="text-align: center; color: #16a085; font-size: 12px;">${formatFluidBreakdown(stats30.eq.oilMap)}</td>
                        <td style="text-align: center; color: #888; font-size: 12px;">-</td>
                    </tr>
                    <tr style="background: #f2f9f6; font-weight: bold; border-bottom: 2px solid #bdc3c7;">
                        <td style="text-align: center; color: #27ae60;">Разом: ${stats30.total.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #2980b9;">Разом: ${stats30.total.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #2980b9;">${stats30.total.adblue.toFixed(1)} л</td>
                        <td style="text-align: center; color: #8e44ad;">${formatFluidBreakdown(stats30.total.oilMap)}</td>
                        <td style="text-align: center;">${formatFluidBreakdown(stats30.total.washerMap)}</td>
                    </tr>

                    <tr style="background: #fafafa;">
                        <td rowspan="3" style="vertical-align: middle;">
                            <strong>Всього за всі періоди</strong>
                        </td>
                        <td style="text-align: center; color: #555; font-size: 12px;">🚗 ${statsAll.cars.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">🚗 ${statsAll.cars.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${statsAll.cars.adblue.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${formatFluidBreakdown(statsAll.cars.oilMap)}</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${formatFluidBreakdown(statsAll.cars.washerMap)}</td>
                    </tr>
                    <tr style="background: #fafafa;">
                        <td style="text-align: center; color: #16a085; font-size: 12px;">⚙️ ${statsAll.eq.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #16a085; font-size: 12px;">⚙️ ${statsAll.eq.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #888; font-size: 12px;">-</td>
                        <td style="text-align: center; color: #16a085; font-size: 12px;">${formatFluidBreakdown(statsAll.eq.oilMap)}</td>
                        <td style="text-align: center; color: #888; font-size: 12px;">-</td>
                    </tr>
                    <tr style="background: #d5f5e3; font-weight: bold;">
                        <td style="text-align: center; color: #27ae60;">Разом: ${statsAll.total.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #2980b9;">Разом: ${statsAll.total.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #2980b9;">${statsAll.total.adblue.toFixed(1)} л</td>
                        <td style="text-align: center; color: #8e44ad;">${formatFluidBreakdown(statsAll.total.oilMap)}</td>
                        <td style="text-align: center;">${formatFluidBreakdown(statsAll.total.washerMap)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
    container.innerHTML = html;
}

function showPolkDetails() {
    document.querySelectorAll('#subdivisions-buttons-container .sub-nav-btn').forEach(btn => {
        const bName = btn.getAttribute('data-subname');
        if (bName === 'ПОЛК') {
            btn.style.backgroundColor = '#27ae60';
            btn.classList.add('active-sub');
        } else {
            if (bName === 'НЕ ЗАДІЯНА ТЕХНІКА') btn.style.backgroundColor = '#7f8c8d';
            else btn.style.backgroundColor = '#2980b9';
            btn.classList.remove('active-sub');
        }
    });

    const container = document.getElementById('subdivisions-content-container');
    if (!container) return;

    const periods = getSavedPeriodsList();
    if (!activeSubdivisionPeriod || !periods.includes(activeSubdivisionPeriod)) {
        activeSubdivisionPeriod = periods[periods.length - 1] || "01.10-10.10";
    }
    let currentCustomPeriod = activeSubdivisionPeriod;

    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const activePolkCars = sourceCars.filter(c => !shouldHideItemInReport('car', c.id, c.note, currentCustomPeriod));
    
    let allEqItems = [];
    try {
        if (typeof getAllEquipmentItemsUnified === 'function') {
            allEqItems = getAllEquipmentItemsUnified().filter(i => !shouldHideItemInReport('equipment', i.uniqueId || i.id, i.note || i.description, currentCustomPeriod));
        }
    } catch(e) {}

    let statsCustom = calculatePolkStatsDetailed([currentCustomPeriod]);
    let monthPeriods = getThreePeriodsForMonth(activeSubdivisionMonth);
    let stats30 = calculatePolkStatsDetailed(monthPeriods);
    let statsAll = calculatePolkStatsDetailed(periods);

    let polkCarsHtml = activePolkCars.length > 0 ? activePolkCars.map(c => '<li style="margin-bottom: 4px;"><strong>' + c.plate + '</strong> — ' + c.model + ' (<span style="color: #2980b9; font-weight: bold;">' + (c.subdivision || 'Без підрозділу') + '</span>, <span style="color: #27ae60; font-weight: bold;">паливо: ' + (c.fuelType || 'ДП') + '</span>)</li>').join('') : '<li style="color: #888; font-style: italic; list-style: none; margin-left: -15px;">Немає техніки</li>';
    let polkEqHtml = allEqItems.length > 0 ? allEqItems.map(i => '<li style="margin-bottom: 4px;"><span style="background: #e8f8f5; padding: 1px 4px; border-radius: 3px; font-size: 11px; color: #16a085; font-weight: bold;">' + i.category + '</span> <strong>' + i.model + '</strong> (<span style="color: #2980b9; font-weight: bold;">' + (i.subdivision || 'Без підрозділу') + '</span>, <span style="color: #27ae60; font-weight: bold;">паливо: ' + (i.fuelType || (i.category === 'Бензопила' ? 'АБ' : 'ДП')) + '</span>)</li>').join('') : '<li style="color: #888; font-style: italic; list-style: none; margin-left: -15px;">Немає обладнання</li>';
    let periodsOptionsHtml = periods.map(p => '<option value="' + p + '" ' + (p === currentCustomPeriod ? 'selected' : '') + '>' + p + '</option>').join('');

    let html = `
        <div id="subdivision-print-area" style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); position: relative;">
            
            ${buildSubdivisionTopPrintButtonHtml()}

            <h3 style="color: #2c3e50; margin-top: 0; margin-bottom: 15px;">Зведений звіт по всьому <span style="color: #8e44ad;">ПОЛКУ</span></h3>
            
            <h4 style="margin: 15px 0 8px 0; color: #7f8c8d;">Вся техніка полку (${activePolkCars.length}):</h4>
            <div class="print-scroll-box" style="border: 1px solid #e0e0e0; padding: 10px 10px 10px 25px; border-radius: 4px; background: #f9f9f9; margin-bottom: 15px;">
                <ol style="margin: 0; padding-left: 15px; font-size: 14px;">
                    ${polkCarsHtml}
                </ol>
            </div>

            <h4 style="margin: 15px 0 8px 0; color: #7f8c8d;">Все обладнання та агрегати полку (${allEqItems.length}):</h4>
            <div class="print-scroll-box" style="border: 1px solid #e0e0e0; padding: 10px 10px 10px 25px; border-radius: 4px; background: #f9f9f9; margin-bottom: 20px;">
                <ol style="margin: 0; padding-left: 15px; font-size: 14px;">
                    ${polkEqHtml}
                </ol>
            </div>

            <h4 style="margin: 15px 0 10px 0; color: #2c3e50;">Отримані матеріали та рідини по всьому полку:</h4>
            <table class="data-table" style="width: 100%;">
                <thead>
                    <tr>
                        <th style="text-align: left; width: 250px;">Період звіту / Категорія</th>
                        <th style="text-align: center;">Паливо ДП</th>
                        <th style="text-align: center;">Паливо АБ</th>
                        <th style="text-align: center;">AdBlue</th>
                        <th style="text-align: center;">Мастило</th>
                        <th style="text-align: center;">Омивач</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background: #eef9ff;">
                        <td rowspan="3" style="vertical-align: middle; border-bottom: 2px solid #2980b9; text-align: center;">
                            <div><strong style="color: #2980b9;">Обраний період</strong> <small style="color: #7f8c8d;">(${currentCustomPeriod})</small></div>
                            ${buildPeriodSelectorWidgetHtml(periodsOptionsHtml, currentCustomPeriod)}
                        </td>
                        <td style="text-align: center; color: #555; font-size: 12px;">🚗 ${statsCustom.cars.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">🚗 ${statsCustom.cars.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${statsCustom.cars.adblue.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${formatFluidBreakdown(statsCustom.cars.oilMap)}</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${formatFluidBreakdown(statsCustom.cars.washerMap)}</td>
                    </tr>
                    <tr style="background: #eef9ff;">
                        <td style="text-align: center; color: #16a085; font-size: 12px;">⚙️ ${statsCustom.eq.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #16a085; font-size: 12px;">⚙️ ${statsCustom.eq.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #888; font-size: 12px;">-</td>
                        <td style="text-align: center; color: #16a085; font-size: 12px;">${formatFluidBreakdown(statsCustom.eq.oilMap)}</td>
                        <td style="text-align: center; color: #888; font-size: 12px;">-</td>
                    </tr>
                    <tr style="background: #d4effc; font-weight: bold; border-bottom: 2px solid #2980b9;">
                        <td style="text-align: center; color: #27ae60;">Разом: ${statsCustom.total.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #2980b9;">Разом: ${statsCustom.total.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #2980b9;">${statsCustom.total.adblue.toFixed(1)} л</td>
                        <td style="text-align: center; color: #8e44ad;">${formatFluidBreakdown(statsCustom.total.oilMap)}</td>
                        <td style="text-align: center;">${formatFluidBreakdown(statsCustom.total.washerMap)}</td>
                    </tr>

                    <tr style="background: #fafafa;">
                        <td rowspan="3" style="vertical-align: middle; border-bottom: 2px solid #ccc; text-align: center;">
                            <div><strong>30 днів</strong> <small style="color: #7f8c8d;">(за місяць)</small></div>
                            ${buildMonthSelectorWidgetHtml()}
                        </td>
                        <td style="text-align: center; color: #555; font-size: 12px;">🚗 ${stats30.cars.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">🚗 ${stats30.cars.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${stats30.cars.adblue.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${formatFluidBreakdown(stats30.cars.oilMap)}</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${formatFluidBreakdown(stats30.cars.washerMap)}</td>
                    </tr>
                    <tr style="background: #fafafa;">
                        <td style="text-align: center; color: #16a085; font-size: 12px;">⚙️ ${stats30.eq.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #16a085; font-size: 12px;">⚙️ ${stats30.eq.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #888; font-size: 12px;">-</td>
                        <td style="text-align: center; color: #16a085; font-size: 12px;">${formatFluidBreakdown(stats30.eq.oilMap)}</td>
                        <td style="text-align: center; color: #888; font-size: 12px;">-</td>
                    </tr>
                    <tr style="background: #f2f9f6; font-weight: bold; border-bottom: 2px solid #bdc3c7;">
                        <td style="text-align: center; color: #27ae60;">Разом: ${stats30.total.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #2980b9;">Разом: ${stats30.total.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #2980b9;">${stats30.total.adblue.toFixed(1)} л</td>
                        <td style="text-align: center; color: #8e44ad;">${formatFluidBreakdown(stats30.total.oilMap)}</td>
                        <td style="text-align: center;">${formatFluidBreakdown(stats30.total.washerMap)}</td>
                    </tr>

                    <tr style="background: #fafafa;">
                        <td rowspan="3" style="vertical-align: middle;">
                            <strong>Всього за всі періоди</strong>
                        </td>
                        <td style="text-align: center; color: #555; font-size: 12px;">🚗 ${statsAll.cars.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">🚗 ${statsAll.cars.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${statsAll.cars.adblue.toFixed(1)} л</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${formatFluidBreakdown(statsAll.cars.oilMap)}</td>
                        <td style="text-align: center; color: #555; font-size: 12px;">${formatFluidBreakdown(statsAll.cars.washerMap)}</td>
                    </tr>
                    <tr style="background: #fafafa;">
                        <td style="text-align: center; color: #16a085; font-size: 12px;">⚙️ ${statsAll.eq.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #16a085; font-size: 12px;">⚙️ ${statsAll.eq.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #888; font-size: 12px;">-</td>
                        <td style="text-align: center; color: #16a085; font-size: 12px;">${formatFluidBreakdown(statsAll.eq.oilMap)}</td>
                        <td style="text-align: center; color: #888; font-size: 12px;">-</td>
                    </tr>
                    <tr style="background: #d5f5e3; font-weight: bold;">
                        <td style="text-align: center; color: #27ae60;">Разом: ${statsAll.total.dpFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #2980b9;">Разом: ${statsAll.total.abFuel.toFixed(1)} л</td>
                        <td style="text-align: center; color: #2980b9;">${statsAll.total.adblue.toFixed(1)} л</td>
                        <td style="text-align: center; color: #8e44ad;">${formatFluidBreakdown(statsAll.total.oilMap)}</td>
                        <td style="text-align: center;">${formatFluidBreakdown(statsAll.total.washerMap)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
    container.innerHTML = html;
}

function printSubdivisionReport() {
    let printStyleEl = document.getElementById('subdivision-print-style');
    if (!printStyleEl) {
        printStyleEl = document.createElement('style');
        printStyleEl.id = 'subdivision-print-style';
        printStyleEl.innerHTML = `
            @media print {
                body * {
                    visibility: hidden !important;
                }
                #subdivisions-view, #subdivisions-view *, #subdivision-print-area, #subdivision-print-area * {
                    visibility: visible !important;
                }
                #subdivisions-view {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    background: white !important;
                }
                .no-print {
                    display: none !important;
                }
                .print-scroll-box {
                    max-height: none !important;
                    overflow: visible !important;
                    height: auto !important;
                }
            }
        `;
        document.head.appendChild(printStyleEl);
    }
    window.print();
}

function calculateSubStatsDetailed(subName, periodList) {
    let carsStat = { dpFuel: 0, abFuel: 0, adblue: 0, oilMap: {}, washerMap: {} };
    let eqStat = { dpFuel: 0, abFuel: 0, adblue: 0, oilMap: {}, washerMap: {} };

    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];

    periodList.forEach(p => {
        const subCars = sourceCars.filter(c => !shouldHideItemInReport('car', c.id, c.note, p) && c.subdivision && normalizeSubdivision(c.subdivision) === normalizeSubdivision(subName));
        let eqItems = [];
        try {
            if (typeof getAllEquipmentItemsUnified === 'function') {
                eqItems = getAllEquipmentItemsUnified().filter(i => !shouldHideItemInReport('equipment', i.uniqueId || i.id, i.note || i.description, p) && i.subdivision && normalizeSubdivision(i.subdivision) === normalizeSubdivision(subName));
            }
        } catch(e) {}

        let repData = {};
        try {
            const stored = localStorage.getItem('report_data_' + p);
            if (stored) repData = JSON.parse(stored);
        } catch(e) {}

        subCars.forEach(car => {
            let carRec = repData[car.id];
            if (!carRec) {
                try {
                    const cardRaw = localStorage.getItem(`isolated_car_routes_${p}_${car.id}`);
                    if (cardRaw) {
                        const cardObj = JSON.parse(cardRaw);
                        if (cardObj && cardObj.topFields) {
                            carRec = {
                                refuelFuel: cardObj.topFields.fuelReceived || '',
                                refuelAdBlue: cardObj.topFields.adblueReceived || ''
                            };
                        }
                    }
                } catch (e) {}
            }

            if (carRec) {
                const refFuel = evaluateExpression(carRec.refuelFuel);
                const fType = (carRec.fuelType || car.fuelType || '').toUpperCase();
                if (fType.includes('ДП')) {
                    carsStat.dpFuel += refFuel;
                } else {
                    carsStat.abFuel += refFuel;
                }
                carsStat.adblue += evaluateExpression(carRec.refuelAdBlue);
                
                let oilParsed = parseFluidEntries(carRec.refuelOil);
                mergeFluidMaps(carsStat.oilMap, oilParsed);

                let washerParsed = parseFluidEntries(carRec.refuelWasher);
                mergeFluidMaps(carsStat.washerMap, washerParsed);
            }
        });

        try {
            const eqStored = localStorage.getItem('equipment_report_data_' + p);
            if (eqStored) {
                const eqDataMap = JSON.parse(eqStored);
                eqItems.forEach(item => {
                    const eqData = eqDataMap[item.uniqueId];
                    if (eqData) {
                        const f1 = evaluateExpression(eqData.p1Fuel);
                        const f2 = evaluateExpression(eqData.p2Fuel);
                        const f3 = evaluateExpression(eqData.p3Fuel);
                        const totalEqFuel = f1 + f2 + f3;

                        const fType = (item.fuelType || '').toUpperCase();
                        if (fType.includes('ДП')) {
                            eqStat.dpFuel += totalEqFuel;
                        } else {
                            eqStat.abFuel += totalEqFuel;
                        }

                        ['p1Oil', 'p2Oil', 'p3Oil'].forEach(field => {
                            let oParsed = parseFluidEntries(eqData[field]);
                            mergeFluidMaps(eqStat.oilMap, oParsed);
                        });
                    }
                });
            }
        } catch(e) {}
    });

    let totalOilMap = {};
    mergeFluidMaps(totalOilMap, carsStat.oilMap);
    mergeFluidMaps(totalOilMap, eqStat.oilMap);

    let totalWasherMap = {};
    mergeFluidMaps(totalWasherMap, carsStat.washerMap);
    mergeFluidMaps(totalWasherMap, eqStat.washerMap);

    let totalStat = {
        dpFuel: carsStat.dpFuel + eqStat.dpFuel,
        abFuel: carsStat.abFuel + eqStat.abFuel,
        adblue: carsStat.adblue + eqStat.adblue,
        oilMap: totalOilMap,
        washerMap: totalWasherMap
    };

    return { cars: carsStat, eq: eqStat, total: totalStat };
}

function calculateNoSubStatsDetailed(periodList) {
    let carsStat = { dpFuel: 0, abFuel: 0, adblue: 0, oilMap: {}, washerMap: {} };
    let eqStat = { dpFuel: 0, abFuel: 0, adblue: 0, oilMap: {}, washerMap: {} };

    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];

    periodList.forEach(p => {
        const subCars = sourceCars.filter(c => !shouldHideItemInReport('car', c.id, c.note, p) && (!c.subdivision || c.subdivision.trim() === ''));
        let eqItems = [];
        try {
            if (typeof getAllEquipmentItemsUnified === 'function') {
                eqItems = getAllEquipmentItemsUnified().filter(i => !shouldHideItemInReport('equipment', i.uniqueId || i.id, i.note || i.description, p) && (!i.subdivision || i.subdivision.trim() === ''));
            }
        } catch(e) {}

        let repData = {};
        try {
            const stored = localStorage.getItem('report_data_' + p);
            if (stored) repData = JSON.parse(stored);
        } catch(e) {}

        subCars.forEach(car => {
            let carRec = repData[car.id];
            if (!carRec) {
                try {
                    const cardRaw = localStorage.getItem(`isolated_car_routes_${p}_${car.id}`);
                    if (cardRaw) {
                        const cardObj = JSON.parse(cardRaw);
                        if (cardObj && cardObj.topFields) {
                            carRec = {
                                refuelFuel: cardObj.topFields.fuelReceived || '',
                                refuelAdBlue: cardObj.topFields.adblueReceived || ''
                            };
                        }
                    }
                } catch (e) {}
            }

            if (carRec) {
                const refFuel = evaluateExpression(carRec.refuelFuel);
                const fType = (carRec.fuelType || car.fuelType || '').toUpperCase();
                if (fType.includes('ДП')) {
                    carsStat.dpFuel += refFuel;
                } else {
                    carsStat.abFuel += refFuel;
                }
                carsStat.adblue += evaluateExpression(carRec.refuelAdBlue);
                
                let oilParsed = parseFluidEntries(carRec.refuelOil);
                mergeFluidMaps(carsStat.oilMap, oilParsed);

                let washerParsed = parseFluidEntries(carRec.refuelWasher);
                mergeFluidMaps(carsStat.washerMap, washerParsed);
            }
        });

        try {
            const eqStored = localStorage.getItem('equipment_report_data_' + p);
            if (eqStored) {
                const eqDataMap = JSON.parse(eqStored);
                eqItems.forEach(item => {
                    const eqData = eqDataMap[item.uniqueId];
                    if (eqData) {
                        const f1 = evaluateExpression(eqData.p1Fuel);
                        const f2 = evaluateExpression(eqData.p2Fuel);
                        const f3 = evaluateExpression(eqData.p3Fuel);
                        const totalEqFuel = f1 + f2 + f3;

                        const fType = (item.fuelType || '').toUpperCase();
                        if (fType.includes('ДП')) {
                            eqStat.dpFuel += totalEqFuel;
                        } else {
                            eqStat.abFuel += totalEqFuel;
                        }

                        ['p1Oil', 'p2Oil', 'p3Oil'].forEach(field => {
                            let oParsed = parseFluidEntries(eqData[field]);
                            mergeFluidMaps(eqStat.oilMap, oParsed);
                        });
                    }
                });
            }
        } catch(e) {}
    });

    let totalOilMap = {};
    mergeFluidMaps(totalOilMap, carsStat.oilMap);
    mergeFluidMaps(totalOilMap, eqStat.oilMap);

    let totalWasherMap = {};
    mergeFluidMaps(totalWasherMap, carsStat.washerMap);
    mergeFluidMaps(totalWasherMap, eqStat.washerMap);

    let totalStat = {
        dpFuel: carsStat.dpFuel + eqStat.dpFuel,
        abFuel: carsStat.abFuel + eqStat.abFuel,
        adblue: carsStat.adblue + eqStat.adblue,
        oilMap: totalOilMap,
        washerMap: totalWasherMap
    };

    return { cars: carsStat, eq: eqStat, total: totalStat };
}

function calculatePolkStatsDetailed(periodList) {
    let carsStat = { dpFuel: 0, abFuel: 0, adblue: 0, oilMap: {}, washerMap: {} };
    let eqStat = { dpFuel: 0, abFuel: 0, adblue: 0, oilMap: {}, washerMap: {} };

    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];

    periodList.forEach(p => {
        const activePolkCars = sourceCars.filter(c => !shouldHideItemInReport('car', c.id, c.note, p));
        let allEqItems = [];
        try {
            if (typeof getAllEquipmentItemsUnified === 'function') {
                allEqItems = getAllEquipmentItemsUnified().filter(i => !shouldHideItemInReport('equipment', i.uniqueId || i.id, i.note || i.description, p));
            }
        } catch(e) {}

        let repData = {};
        try {
            const stored = localStorage.getItem('report_data_' + p);
            if (stored) repData = JSON.parse(stored);
        } catch(e) {}

        activePolkCars.forEach(car => {
            let carRec = repData[car.id];
            if (!carRec) {
                try {
                    const cardRaw = localStorage.getItem(`isolated_car_routes_${p}_${car.id}`);
                    if (cardRaw) {
                        const cardObj = JSON.parse(cardRaw);
                        if (cardObj && cardObj.topFields) {
                            carRec = {
                                refuelFuel: cardObj.topFields.fuelReceived || '',
                                refuelAdBlue: cardObj.topFields.adblueReceived || ''
                            };
                        }
                    }
                } catch (e) {}
            }

            if (carRec) {
                const refFuel = evaluateExpression(carRec.refuelFuel);
                const fType = (carRec.fuelType || car.fuelType || '').toUpperCase();
                if (fType.includes('ДП')) {
                    carsStat.dpFuel += refFuel;
                } else {
                    carsStat.abFuel += refFuel;
                }
                carsStat.adblue += evaluateExpression(carRec.refuelAdBlue);

                let oilParsed = parseFluidEntries(carRec.refuelOil);
                mergeFluidMaps(carsStat.oilMap, oilParsed);

                let washerParsed = parseFluidEntries(carRec.refuelWasher);
                mergeFluidMaps(carsStat.washerMap, washerParsed);
            }
        });

        try {
            const eqStored = localStorage.getItem('equipment_report_data_' + p);
            if (eqStored) {
                const eqDataMap = JSON.parse(eqStored);
                allEqItems.forEach(item => {
                    const eqData = eqDataMap[item.uniqueId];
                    if (eqData) {
                        const f1 = evaluateExpression(eqData.p1Fuel);
                        const f2 = evaluateExpression(eqData.p2Fuel);
                        const f3 = evaluateExpression(eqData.p3Fuel);
                        const totalEqFuel = f1 + f2 + f3;

                        const fType = (item.fuelType || '').toUpperCase();
                        if (fType.includes('ДП')) {
                            eqStat.dpFuel += totalEqFuel;
                        } else {
                            eqStat.abFuel += totalEqFuel;
                        }

                        ['p1Oil', 'p2Oil', 'p3Oil'].forEach(field => {
                            let oParsed = parseFluidEntries(eqData[field]);
                            mergeFluidMaps(eqStat.oilMap, oParsed);
                        });
                    }
                });
            }
        } catch(e) {}
    });

    let totalOilMap = {};
    mergeFluidMaps(totalOilMap, carsStat.oilMap);
    mergeFluidMaps(totalOilMap, eqStat.oilMap);

    let totalWasherMap = {};
    mergeFluidMaps(totalWasherMap, carsStat.washerMap);
    mergeFluidMaps(totalWasherMap, eqStat.washerMap);

    let totalStat = {
        dpFuel: carsStat.dpFuel + eqStat.dpFuel,
        abFuel: carsStat.abFuel + eqStat.abFuel,
        adblue: carsStat.adblue + eqStat.adblue,
        oilMap: totalOilMap,
        washerMap: totalWasherMap
    };

    return { cars: carsStat, eq: eqStat, total: totalStat };
}

function importDataFromJson(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importData = JSON.parse(e.target.result);
            localStorage.clear();
            for (let key in importData) {
                localStorage.setItem(key, importData[key]);
            }
            alert("Усі дані та зміни успішно відновлено з файлу data.json!");
            location.reload();
        } catch (err) {
            console.error(err);
            alert("Помилка при читанні файлу JSON.");
        }
    };
    reader.readAsText(file);
    input.value = "";
}

function transferDataToReport() {
    let targetCarId = (typeof currentCarId !== 'undefined' && currentCarId) ? currentCarId : 
                      ((typeof activeDetailCarId !== 'undefined' && activeDetailCarId) ? activeDetailCarId : null);

    if (!targetCarId) {
        alert("Помилка: не вибрано автомобіль для перенесення даних!");
        return;
    }

    const cardPeriodSelect = document.getElementById('card-period-select');
    const periodStr = (cardPeriodSelect && cardPeriodSelect.value) 
        ? cardPeriodSelect.value.trim() 
        : (document.getElementById('report-custom-period')?.value.trim() || "01.10-10.10");

    if (typeof saveCarRoutesForPeriod === 'function') {
        saveCarRoutesForPeriod(periodStr, targetCarId);
    }

    let periods = getSavedPeriodsList();
    if (!periods.includes(periodStr)) {
        periods.push(periodStr);
        localStorage.setItem('app_saved_periods_list', JSON.stringify(periods));
    }

    activeReportPeriod = periodStr;
    activeSubdivisionPeriod = periodStr;
    populatePeriodDropdown(periodStr);

    const storageKey = 'report_data_' + periodStr;
    let savedReportData = {};
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) savedReportData = JSON.parse(stored);
    } catch (e) {
        console.error(e);
    }

    const fuelStart = document.getElementById('fuel-start')?.value || '';
    const adblueStart = document.getElementById('adblue-start')?.value || '';
    const startOdo = document.getElementById('odo-1')?.value || '';
    const fuelReceived = document.getElementById('fuel-received')?.value || '';
    const adblueReceived = document.getElementById('adblue-received')?.value || '';
    const fuelSpent = document.getElementById('fuel-spent')?.textContent?.trim() || '';
    const fuelLeft = document.getElementById('fuel-left')?.textContent?.trim() || '';
    const adblueLeft = document.getElementById('adblue-left')?.textContent?.trim() || '';
    const finalOdo = document.getElementById('odo-2')?.value || startOdo || '';

    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const car = sourceCars.find(c => Number(c.id) === Number(targetCarId));

    if (!savedReportData[targetCarId]) {
        savedReportData[targetCarId] = {
            prevFuel: fuelStart,
            prevAdBlue: adblueStart,
            prevOdo: startOdo,
            refuelFuel: '',
            refuelAdBlue: '',
            refuelOil: '',
            refuelWasher: '',
            note: car ? car.note : '',
            docNo: '',
            leftFuel: '',
            leftAdBlue: '',
            odo: '',
            spentFuel: ''
        };
    } else {
        if (fuelStart !== '') savedReportData[targetCarId].prevFuel = fuelStart;
        if (adblueStart !== '') savedReportData[targetCarId].prevAdBlue = adblueStart;
        if (startOdo !== '') savedReportData[targetCarId].prevOdo = startOdo;
    }

    savedReportData[targetCarId].refuelFuel = fuelReceived;
    if (fuelSpent !== '') {
        savedReportData[targetCarId].spentFuel = fuelSpent;
    }
    if (adblueReceived !== '') {
        savedReportData[targetCarId].refuelAdBlue = adblueReceived;
    }
    if (fuelLeft !== '') {
        savedReportData[targetCarId].leftFuel = fuelLeft;
    }
    if (adblueLeft !== '' && car && car.hasAdBlue) {
        savedReportData[targetCarId].leftAdBlue = adblueLeft;
    }
    if (finalOdo !== '') {
        savedReportData[targetCarId].odo = finalOdo;
    }

    localStorage.setItem(storageKey, JSON.stringify(savedReportData));

    const carName = car ? car.plate + ' (' + car.model + ')' : 'автомобіля';
    alert('Дані для ' + carName + ' успішно перенесено у звіт за період "' + periodStr + '"!');
}

function saveReportData() {
    saveCurrentReportSilently();
    const periodStr = document.getElementById('report-custom-period')?.value.trim() || activeReportPeriod || "01.10-10.10";
    alert('Звіт за період "' + periodStr + '" успішно збережено!');
}

document.addEventListener('input', function(e) {
    if (e.target.classList.contains('report-cell-input')) {
        saveCurrentReportSilently();
        updateReportTotals();
    }
});