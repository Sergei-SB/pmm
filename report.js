// ==========================================
// ЛОГІКА ДЕСЯТИДЕННОГО ЗВІТУ ТА ЗВІТУ ПО ПІДРОЗДІЛАХ (report.js)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    initPeriodDropdown();
    restoreDirectoryHandle();
    injectSaveButtonToHeader();
    
    if (typeof renderReportTable === 'function') {
        renderReportTable();
    }
    if (typeof renderSubdivisionsView === 'function') {
        renderSubdivisionsView();
    }
});

let projectDirectoryHandle = null;

function isItemDestroyed(note) {
    return /знищ/ui.test(note || '');
}

// Перевірка, чи потрібно приховувати об'єкт у звіті за конкретний період
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

    // Якщо дата знищення ще не введена, вважаємо поточним місяцем (жовтень 2026)
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

    // Якщо рік звіту пізніший за рік знищення або місяць звіту пізніший за місяць знищення — приховуємо
    if (repYear > destYear) return true;
    if (repYear === destYear && repMonth > destMonth) return true;

    return false; // До кінця місяця знищення залишаємо у звітах
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
    const searchInput = document.querySelector('input[type="text"][placeholder*="Пошук"]');
    if (searchInput && !document.getElementById('header-direct-save-btn')) {
        const parentContainer = searchInput.parentElement;
        if (parentContainer) {
            parentContainer.style.display = 'flex';
            parentContainer.style.alignItems = 'center';
            parentContainer.style.gap = '10px';

            const saveBtn = document.createElement('button');
            saveBtn.id = 'header-direct-save-btn';
            saveBtn.innerHTML = '💾 Зберегти';
            saveBtn.style.cssText = 'background-color: #27ae60; color: white; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
            saveBtn.onclick = saveAllDataDirectlyToDoc;
            
            parentContainer.insertBefore(saveBtn, searchInput);
        }
    }
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

function getStandardPeriods() {
    return [
        "01.10-10.10"
    ];
}

function getSavedPeriodsList() {
    let periods = getStandardPeriods();
    try {
        const stored = localStorage.getItem('app_saved_periods_list');
        if (stored) {
            const customList = JSON.parse(stored);
            customList.forEach(p => {
                if (!periods.includes(p)) periods.push(p);
            });
        }
    } catch(e) {}
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('report_data_')) {
            const p = key.replace('report_data_', '');
            if (!periods.includes(p)) {
                periods.push(p);
            }
        }
    }

    periods.sort((a, b) => {
        const parseDateVal = (str) => {
            if (!str) return 0;
            const cleanStr = str.split('-')[0].trim();
            const parts = cleanStr.split('.');
            if (parts.length >= 2) {
                const day = parseInt(parts[0]) || 0;
                const month = parseInt(parts[1]) || 0;
                const year = parts[2] ? parseInt(parts[2]) : 2026;
                return year * 10000 + month * 100 + day;
            }
            return 0;
        };
        return parseDateVal(b) - parseDateVal(a);
    });

    return periods;
}

function populatePeriodDropdown(selectedVal) {
    const select = document.getElementById('report-period-select');
    if (select) {
        const periods = getSavedPeriodsList();
        let html = '';
        periods.forEach(p => {
            html += '<option value="' + p + '">' + p + '</option>';
        });
        html += '<option value="custom">Власний період...</option>';
        select.innerHTML = html;
        if (periods.includes(selectedVal)) {
            select.value = selectedVal;
        } else {
            select.value = 'custom';
        }
    }

    const subSelect = document.getElementById('sub-custom-period-select');
    if (subSelect) {
        const periods = getSavedPeriodsList();
        let html = '';
        periods.forEach(p => {
            html += '<option value="' + p + '">' + p + '</option>';
        });
        html += '<option value="custom">Власний...</option>';
        subSelect.innerHTML = html;
        if (periods.includes(selectedVal)) {
            subSelect.value = selectedVal;
        } else {
            subSelect.value = 'custom';
        }
    }
}

function initPeriodDropdown() {
    const periods = getSavedPeriodsList();
    const defaultPeriod = periods.length > 0 ? periods[0] : "01.10-10.10";
    populatePeriodDropdown(defaultPeriod);
    const customInput = document.getElementById('report-custom-period');
    if (customInput) customInput.value = defaultPeriod;
    const subCustomInput = document.getElementById('sub-custom-period-input');
    if (subCustomInput) subCustomInput.value = defaultPeriod;
}

function changeReportPeriod(val) {
    const customInput = document.getElementById('report-custom-period');
    if (val === 'custom') {
        customInput.value = '';
        customInput.focus();
    } else {
        customInput.value = val;
        updateReportHeaders();
        renderReportTable();
    }
}

function changeSubCustomPeriod(val) {
    const customInput = document.getElementById('sub-custom-period-input');
    if (!customInput) return;
    if (val === 'custom') {
        customInput.value = '';
        customInput.focus();
    } else {
        customInput.value = val;
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
}

function changePolkCustomPeriod(val) {
    const customInput = document.getElementById('sub-custom-period-input');
    if (!customInput) return;
    if (val === 'custom') {
        customInput.value = '';
        customInput.focus();
    } else {
        customInput.value = val;
        showPolkDetails();
    }
}

function updateReportHeaders() {
    const periodInput = document.getElementById('report-custom-period');
    const periodStr = periodInput ? periodInput.value.trim() : "01.10-10.10";
    
    let parts = periodStr.split('-');
    let startDate = parts[0] ? parts[0].trim() : "01.10";
    let endDate = parts[1] ? parts[1].trim() : startDate;

    document.querySelectorAll('.rep-p').forEach(el => el.textContent = periodStr);
    document.querySelectorAll('.rep-start').forEach(el => el.textContent = startDate);
    document.querySelectorAll('.rep-end').forEach(el => el.textContent = endDate);
}

function getPreviousPeriodKey(currentPeriod) {
    const periods = getSavedPeriodsList();
    const cleanCurrent = currentPeriod.trim();
    const idx = periods.indexOf(cleanCurrent);
    if (idx !== -1 && idx < periods.length - 1) {
        return periods[idx + 1];
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

function renderReportTable() {
    updateReportHeaders();
    const table = document.getElementById('report-table');
    if (!table) return;

    const saveBtn = document.querySelector('button[onclick*="saveReportData"]') || document.querySelector('.btn-success');
    if (saveBtn && !document.getElementById('print-ten-days-report-btn')) {
        const printBtn = document.createElement('button');
        printBtn.id = 'print-ten-days-report-btn';
        printBtn.innerHTML = '<span style="font-size: 14px; margin-right: 6px; vertical-align: middle;">🖨️️</span> Друк звіту';
        printBtn.style.cssText = 'background-color: #337ab7; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; white-space: nowrap; margin-right: 5px;';
        printBtn.onclick = printTenDaysReport;
        saveBtn.parentNode.insertBefore(printBtn, saveBtn.nextSibling);
    }
    
    let tbody = document.getElementById('report-tbody');
    if (!tbody) {
        tbody = document.createElement('tbody');
        tbody.id = 'report-tbody';
        table.appendChild(tbody);
    }
    tbody.innerHTML = '';

    const periodInput = document.getElementById('report-custom-period');
    const periodStr = periodInput ? periodInput.value.trim() : "01.10-10.10";
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
        if (selectedSub !== 'all' && (car.subdivision || '').trim() && normalizeSubdivision(car.subdivision) !== normalizeSubdivision(selectedSub)) {
            return false;
        }
        return true;
    });

    filteredCars.forEach((car, index) => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-fuel-type', (car.fuelType || '').toUpperCase());
        let carData = savedReportData[car.id];

        if (!carData) {
            let autoPrevFuel = '';
            let autoPrevAdBlue = '';
            let autoPrevOdo = '';

            if (prevPeriodSavedData[car.id]) {
                autoPrevFuel = prevPeriodSavedData[car.id].leftFuel || '';
                autoPrevAdBlue = prevPeriodSavedData[car.id].leftAdBlue || '';
                autoPrevOdo = prevPeriodSavedData[car.id].odo || '';
            }

            carData = {
                prevFuel: autoPrevFuel,
                prevAdBlue: autoPrevAdBlue,
                prevOdo: autoPrevOdo,
                refuelFuel: '',
                refuelAdBlue: '',
                refuelOil: '',
                refuelWasher: '',
                note: car.note || '',
                docNo: '',
                leftFuel: '',
                leftAdBlue: '',
                odo: ''
            };
        } else {
            if ((carData.prevFuel === '' || carData.prevFuel == null) && prevPeriodSavedData[car.id]) {
                carData.prevFuel = prevPeriodSavedData[car.id].leftFuel || '';
            }
            if ((carData.prevAdBlue === '' || carData.prevAdBlue == null) && prevPeriodSavedData[car.id]) {
                carData.prevAdBlue = prevPeriodSavedData[car.id].leftAdBlue || '';
            }
            if ((carData.prevOdo === '' || carData.prevOdo == null) && prevPeriodSavedData[car.id]) {
                carData.prevOdo = prevPeriodSavedData[car.id].odo || '';
            }
        }

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${car.plate}</strong></td>
            <td>${car.subdivision}</td>
            <td class="rep-row-fuel-type">${car.fuelType}</td>
            <td style="text-align: left; padding-left: 10px;">${car.model}</td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="prevFuel" value="${carData.prevFuel}"></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="prevAdBlue" value="${carData.prevAdBlue}" ${car.hasAdBlue ? '' : 'disabled style="background:#e0e0e0;"'}></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="prevOdo" value="${carData.prevOdo}"></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="refuelFuel" value="${carData.refuelFuel}"></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="refuelAdBlue" value="${carData.refuelAdBlue}" ${car.hasAdBlue ? '' : 'disabled style="background:#e0e0e0;"'}></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="refuelOil" value="${carData.refuelOil}"></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="refuelWasher" value="${carData.refuelWasher}"></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="note" value="${carData.note}"></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="docNo" value="${carData.docNo}"></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="leftFuel" value="${carData.leftFuel}"></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="leftAdBlue" value="${carData.leftAdBlue}" ${car.hasAdBlue ? '' : 'disabled style="background:#e0e0e0;"'}></td>
            <td><input type="text" class="report-cell-input" data-car="${car.id}" data-field="odo" value="${carData.odo}"></td>
        `;
        tbody.appendChild(tr);
    });

    updateReportTotals();
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
        const fCell = row.querySelector('.rep-row-fuel-type');
        const fType = fCell ? fCell.textContent.trim().toUpperCase() : '';

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
            <td colspan="8" style="text-align: right; padding-right: 10px; color: #145a32;">ВСЬОГО ЗА ПЕРІУД:</td>
            <td colspan="9" style="text-align: left; padding-left: 20px; color: #2c3e50;">Пальне: <strong style="color: #27ae60;">ДП: ${dpRefF.toFixed(1)} л</strong>, <strong style="color: #2980b9;">АБ: ${abRefF.toFixed(1)} л</strong> &nbsp;|&nbsp; AdBlue: <strong>${sumRefAd.toFixed(1)} л</strong> &nbsp;|&nbsp; Мастило: <strong style="color: #8e44ad;">${formatFluidBreakdown(totalOilMap)}</strong> &nbsp;|&nbsp; Омивач: <strong>${formatFluidBreakdown(totalWasherMap)}</strong></td>
        </tr>
    `;
}

// ==========================================
// НОРМАЛІЗАЦІЯ ПІДРОЗДІЛІВ (Об'єднання РМТЗ / PMT3)
// ==========================================
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
    const customPeriodInput = document.getElementById('sub-custom-period-input');
    const customPeriodSelect = document.getElementById('sub-custom-period-select');
    
    let currentCustomPeriod = customPeriodInput ? customPeriodInput.value.trim() : "";
    if (!currentCustomPeriod) {
        currentCustomPeriod = customPeriodSelect ? customPeriodSelect.value : (periods[0] || "01.10-10.10");
        if (customPeriodInput) customPeriodInput.value = currentCustomPeriod;
    }

    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const subCars = sourceCars.filter(c => !shouldHideItemInReport('car', c.id, c.note, currentCustomPeriod) && c.subdivision && normalizeSubdivision(c.subdivision) === normalizeSubdivision(subName));
    
    let eqItems = [];
    try {
        if (typeof getAllEquipmentItemsUnified === 'function') {
            eqItems = getAllEquipmentItemsUnified().filter(i => !shouldHideItemInReport('equipment', i.uniqueId || i.id, i.note || i.description, currentCustomPeriod) && i.subdivision && normalizeSubdivision(i.subdivision) === normalizeSubdivision(subName));
        }
    } catch(e) {}

    let statsCustom = calculateSubStatsDetailed(subName, [currentCustomPeriod]);
    let last3Periods = periods.slice(0, 3);
    let stats30 = calculateSubStatsDetailed(subName, last3Periods);
    let statsAll = calculateSubStatsDetailed(subName, periods);

    let carsListHtml = subCars.length > 0 ? subCars.map(c => '<li style="margin-bottom: 4px;"><strong>' + c.plate + '</strong> — ' + c.model + ' (<span style="color: #555;">паливо: ' + c.fuelType + '</span>)</li>').join('') : '<li style="color: #888; font-style: italic; list-style: none; margin-left: -15px;">Немає автомобілів</li>';
    let eqListHtml = eqItems.length > 0 ? eqItems.map(i => '<li style="margin-bottom: 4px;"><span style="background: #e8f8f5; padding: 1px 4px; border-radius: 3px; font-size: 11px; color: #16a085; font-weight: bold;">' + i.category + '</span> <strong>' + i.model + '</strong> (<span style="color: #555;">паливо: ' + i.fuelType + '</span>)</li>').join('') : '<li style="color: #888; font-style: italic; list-style: none; margin-left: -15px;">Немає обладнання</li>';
    let periodsOptionsHtml = periods.map(p => '<option value="' + p + '" ' + (p === currentCustomPeriod ? 'selected' : '') + '>' + p + '</option>').join('');

    let html = `
        <div id="subdivision-print-area" style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); position: relative;">
            
            <div class="no-print" style="position: absolute; top: 20px; right: 20px; display: flex; align-items: center; gap: 8px; background: #f8f9fa; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1;">
                <label style="font-weight: bold; font-size: 13px; color: #2c3e50;">Період:</label>
                <select id="sub-custom-period-select" onchange="changeSubCustomPeriod(this.value)" style="padding: 4px; font-size: 13px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer;">
                    ${periodsOptionsHtml}
                    <option value="custom" ${!periods.includes(currentCustomPeriod) ? 'selected' : ''}>Власний...</option>
                </select>
                <input type="text" id="sub-custom-period-input" value="${currentCustomPeriod}" placeholder="01.10-10.10" oninput="showSubdivisionDetails('${subName}')" style="width: 100px; text-align: center; padding: 4px; font-size: 13px; border-radius: 4px; border: 1px solid #ccc;">
                <button class="action-btn print-btn" onclick="printSubdivisionReport()" style="background-color: #337ab7; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; white-space: nowrap;"><span style="font-size: 14px; margin-right: 6px; vertical-align: middle;">🖨️</span> Друк звіту</button>
            </div>

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
                        <th style="text-align: left; width: 220px;">Період звіту / Категорія</th>
                        <th style="text-align: center;">Паливо ДП</th>
                        <th style="text-align: center;">Паливо АБ</th>
                        <th style="text-align: center;">AdBlue</th>
                        <th style="text-align: center;">Мастило</th>
                        <th style="text-align: center;">Омивач</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background: #eef9ff;">
                        <td rowspan="3" style="vertical-align: middle; border-bottom: 2px solid #2980b9;">
                            <strong style="color: #2980b9;">Обраний період</strong> <small style="color: #7f8c8d;">(${currentCustomPeriod})</small>
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
                        <td rowspan="3" style="vertical-align: middle; border-bottom: 2px solid #ccc;">
                            <strong>30 днів</strong> <small style="color: #7f8c8d;">(останні 3 періоди)</small>
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
    const customPeriodInput = document.getElementById('sub-custom-period-input');
    const customPeriodSelect = document.getElementById('sub-custom-period-select');
    
    let currentCustomPeriod = customPeriodInput ? customPeriodInput.value.trim() : "";
    if (!currentCustomPeriod) {
        currentCustomPeriod = customPeriodSelect ? customPeriodSelect.value : (periods[0] || "01.10-10.10");
        if (customPeriodInput) customPeriodInput.value = currentCustomPeriod;
    }

    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const subCars = sourceCars.filter(c => !shouldHideItemInReport('car', c.id, c.note, currentCustomPeriod) && (!c.subdivision || c.subdivision.trim() === ''));
    
    let eqItems = [];
    try {
        if (typeof getAllEquipmentItemsUnified === 'function') {
            eqItems = getAllEquipmentItemsUnified().filter(i => !shouldHideItemInReport('equipment', i.uniqueId || i.id, i.note || i.description, currentCustomPeriod) && (!i.subdivision || i.subdivision.trim() === ''));
        }
    } catch(e) {}

    let statsCustom = calculateNoSubStatsDetailed([currentCustomPeriod]);
    let last3Periods = periods.slice(0, 3);
    let stats30 = calculateNoSubStatsDetailed(last3Periods);
    let statsAll = calculateNoSubStatsDetailed(periods);

    let carsListHtml = subCars.length > 0 ? subCars.map(c => '<li style="margin-bottom: 4px;"><strong>' + c.plate + '</strong> — ' + c.model + ' (<span style="color: #555;">паливо: ' + c.fuelType + '</span>)</li>').join('') : '<li style="color: #888; font-style: italic; list-style: none; margin-left: -15px;">Немає не задіяних автомобілів</li>';
    let eqListHtml = eqItems.length > 0 ? eqItems.map(i => '<li style="margin-bottom: 4px;"><span style="background: #e8f8f5; padding: 1px 4px; border-radius: 3px; font-size: 11px; color: #16a085; font-weight: bold;">' + i.category + '</span> <strong>' + i.model + '</strong> (<span style="color: #555;">паливо: ' + i.fuelType + '</span>)</li>').join('') : '<li style="color: #888; font-style: italic; list-style: none; margin-left: -15px;">Немає не задіяного обладнання</li>';
    let periodsOptionsHtml = periods.map(p => '<option value="' + p + '" ' + (p === currentCustomPeriod ? 'selected' : '') + '>' + p + '</option>').join('');

    let html = `
        <div id="subdivision-print-area" style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); position: relative;">
            
            <div class="no-print" style="position: absolute; top: 20px; right: 20px; display: flex; align-items: center; gap: 8px; background: #f8f9fa; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1;">
                <label style="font-weight: bold; font-size: 13px; color: #2c3e50;">Період:</label>
                <select id="sub-custom-period-select" onchange="changeSubCustomPeriod(this.value)" style="padding: 4px; font-size: 13px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer;">
                    ${periodsOptionsHtml}
                    <option value="custom" ${!periods.includes(currentCustomPeriod) ? 'selected' : ''}>Власний...</option>
                </select>
                <input type="text" id="sub-custom-period-input" value="${currentCustomPeriod}" placeholder="01.10-10.10" oninput="showNoSubdivisionDetails()" style="width: 100px; text-align: center; padding: 4px; font-size: 13px; border-radius: 4px; border: 1px solid #ccc;">
                <button class="action-btn print-btn" onclick="printSubdivisionReport()" style="background-color: #337ab7; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; white-space: nowrap;"><span style="font-size: 14px; margin-right: 6px; vertical-align: middle;">🖨️</span> Друк звіту</button>
            </div>

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
                        <th style="text-align: left; width: 220px;">Період звіту / Категорія</th>
                        <th style="text-align: center;">Паливо ДП</th>
                        <th style="text-align: center;">Паливо АБ</th>
                        <th style="text-align: center;">AdBlue</th>
                        <th style="text-align: center;">Мастило</th>
                        <th style="text-align: center;">Омивач</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background: #eef9ff;">
                        <td rowspan="3" style="vertical-align: middle; border-bottom: 2px solid #2980b9;">
                            <strong style="color: #2980b9;">Обраний період</strong> <small style="color: #7f8c8d;">(${currentCustomPeriod})</small>
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
                        <td rowspan="3" style="vertical-align: middle; border-bottom: 2px solid #ccc;">
                            <strong>30 днів</strong> <small style="color: #7f8c8d;">(останні 3 періоди)</small>
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
    const customPeriodInput = document.getElementById('sub-custom-period-input');
    const customPeriodSelect = document.getElementById('sub-custom-period-select');
    
    let currentCustomPeriod = customPeriodInput ? customPeriodInput.value.trim() : "";
    if (!currentCustomPeriod) {
        currentCustomPeriod = customPeriodSelect ? customPeriodSelect.value : (periods[0] || "01.10-10.10");
        if (customPeriodInput) customPeriodInput.value = currentCustomPeriod;
    }

    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const activePolkCars = sourceCars.filter(c => !shouldHideItemInReport('car', c.id, c.note, currentCustomPeriod));
    
    let allEqItems = [];
    try {
        if (typeof getAllEquipmentItemsUnified === 'function') {
            allEqItems = getAllEquipmentItemsUnified().filter(i => !shouldHideItemInReport('equipment', i.uniqueId || i.id, i.note || i.description, currentCustomPeriod));
        }
    } catch(e) {}

    let statsCustom = calculatePolkStatsDetailed([currentCustomPeriod]);
    let last3Periods = periods.slice(0, 3);
    let stats30 = calculatePolkStatsDetailed(last3Periods);
    let statsAll = calculatePolkStatsDetailed(periods);

    let polkCarsHtml = activePolkCars.length > 0 ? activePolkCars.map(c => '<li style="margin-bottom: 4px;"><strong>' + c.plate + '</strong> — ' + c.model + ' (<span style="color: #2980b9; font-weight: bold;">' + (c.subdivision || 'Без підрозділу') + '</span>, паливо: ' + c.fuelType + ')</li>').join('') : '<li style="color: #888; font-style: italic; list-style: none; margin-left: -15px;">Немає техніки</li>';
    let polkEqHtml = allEqItems.length > 0 ? allEqItems.map(i => '<li style="margin-bottom: 4px;"><span style="background: #e8f8f5; padding: 1px 4px; border-radius: 3px; font-size: 11px; color: #16a085; font-weight: bold;">' + i.category + '</span> <strong>' + i.model + '</strong> (<span style="color: #2980b9; font-weight: bold;">' + (i.subdivision || 'Без підрозділу') + '</span>, паливо: ' + i.fuelType + ')</li>').join('') : '<li style="color: #888; font-style: italic; list-style: none; margin-left: -15px;">Немає обладнання</li>';
    let periodsOptionsHtml = periods.map(p => '<option value="' + p + '" ' + (p === currentCustomPeriod ? 'selected' : '') + '>' + p + '</option>').join('');

    let html = `
        <div id="subdivision-print-area" style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); position: relative;">
            
            <div class="no-print" style="position: absolute; top: 20px; right: 20px; display: flex; align-items: center; gap: 8px; background: #f8f9fa; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1;">
                <label style="font-weight: bold; font-size: 13px; color: #2c3e50;">Період:</label>
                <select id="sub-custom-period-select" onchange="changePolkCustomPeriod(this.value)" style="padding: 4px; font-size: 13px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer;">
                    ${periodsOptionsHtml}
                    <option value="custom" ${!periods.includes(currentCustomPeriod) ? 'selected' : ''}>Власний...</option>
                </select>
                <input type="text" id="sub-custom-period-input" value="${currentCustomPeriod}" placeholder="01.10-10.10" oninput="showPolkDetails()" style="width: 100px; text-align: center; padding: 4px; font-size: 13px; border-radius: 4px; border: 1px solid #ccc;">
                <button class="action-btn print-btn" onclick="printSubdivisionReport()" style="background-color: #337ab7; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; white-space: nowrap;"><span style="font-size: 14px; margin-right: 6px; vertical-align: middle;">🖨️</span> Друк звіту</button>
            </div>

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
                        <th style="text-align: left; width: 220px;">Період звіту / Категорія</th>
                        <th style="text-align: center;">Паливо ДП</th>
                        <th style="text-align: center;">Паливо АБ</th>
                        <th style="text-align: center;">AdBlue</th>
                        <th style="text-align: center;">Мастило</th>
                        <th style="text-align: center;">Омивач</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background: #eef9ff;">
                        <td rowspan="3" style="vertical-align: middle; border-bottom: 2px solid #2980b9;">
                            <strong style="color: #2980b9;">Обраний період</strong> <small style="color: #7f8c8d;">(${currentCustomPeriod})</small>
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
                        <td rowspan="3" style="vertical-align: middle; border-bottom: 2px solid #ccc;">
                            <strong>30 днів</strong> <small style="color: #7f8c8d;">(останні 3 періоди)</small>
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

        try {
            const stored = localStorage.getItem('report_data_' + p);
            if (stored) {
                const data = JSON.parse(stored);
                subCars.forEach(car => {
                    if (data[car.id]) {
                        const refFuel = evaluateExpression(data[car.id].refuelFuel);
                        const fType = (car.fuelType || '').toUpperCase();
                        if (fType.includes('ДП')) {
                            carsStat.dpFuel += refFuel;
                        } else {
                            carsStat.abFuel += refFuel;
                        }
                        carsStat.adblue += evaluateExpression(data[car.id].refuelAdBlue);
                        
                        let oilParsed = parseFluidEntries(data[car.id].refuelOil);
                        mergeFluidMaps(carsStat.oilMap, oilParsed);

                        let washerParsed = parseFluidEntries(data[car.id].refuelWasher);
                        mergeFluidMaps(carsStat.washerMap, washerParsed);
                    }
                });
            }
        } catch(e) {}

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

        try {
            const stored = localStorage.getItem('report_data_' + p);
            if (stored) {
                const data = JSON.parse(stored);
                subCars.forEach(car => {
                    if (data[car.id]) {
                        const refFuel = evaluateExpression(data[car.id].refuelFuel);
                        const fType = (car.fuelType || '').toUpperCase();
                        if (fType.includes('ДП')) {
                            carsStat.dpFuel += refFuel;
                        } else {
                            carsStat.abFuel += refFuel;
                        }
                        carsStat.adblue += evaluateExpression(data[car.id].refuelAdBlue);
                        
                        let oilParsed = parseFluidEntries(data[car.id].refuelOil);
                        mergeFluidMaps(carsStat.oilMap, oilParsed);

                        let washerParsed = parseFluidEntries(data[car.id].refuelWasher);
                        mergeFluidMaps(carsStat.washerMap, washerParsed);
                    }
                });
            }
        } catch(e) {}

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

        try {
            const stored = localStorage.getItem('report_data_' + p);
            if (stored) {
                const data = JSON.parse(stored);
                activePolkCars.forEach(car => {
                    if (data[car.id]) {
                        const refFuel = evaluateExpression(data[car.id].refuelFuel);
                        const fType = (car.fuelType || '').toUpperCase();
                        if (fType.includes('ДП')) {
                            carsStat.dpFuel += refFuel;
                        } else {
                            carsStat.abFuel += refFuel;
                        }
                        carsStat.adblue += evaluateExpression(data[car.id].refuelAdBlue);

                        let oilParsed = parseFluidEntries(data[car.id].refuelOil);
                        mergeFluidMaps(carsStat.oilMap, oilParsed);

                        let washerParsed = parseFluidEntries(data[car.id].refuelWasher);
                        mergeFluidMaps(carsStat.washerMap, washerParsed);
                    }
                });
            }
        } catch(e) {}

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
    const periodStr = document.getElementById('report-custom-period').value.trim() || "01.10-10.10";
    
    let periods = getSavedPeriodsList();
    if (!periods.includes(periodStr)) {
        periods.push(periodStr);
        localStorage.setItem('app_saved_periods_list', JSON.stringify(periods));
    }
    populatePeriodDropdown(periodStr);

    const storageKey = 'report_data_' + periodStr;
    let savedReportData = {};
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) savedReportData = JSON.parse(stored);
    } catch (e) {
        console.error(e);
    }

    const fuelReceived = document.getElementById('fuel-received')?.value || '';
    const adblueReceived = document.getElementById('adblue-received')?.value || '';
    const fuelLeft = document.getElementById('fuel-left')?.textContent || '';
    const adblueLeft = document.getElementById('adblue-left')?.textContent || '';
    const finalOdo = document.getElementById('odo-2')?.value || '';

    if (!savedReportData[currentCarId]) {
        let autoPrevFuel = '';
        let autoPrevAdBlue = '';
        let autoPrevOdo = '';
        const prevPeriodKey = getPreviousPeriodKey(periodStr);
        if (prevPeriodKey) {
            try {
                const storedPrev = localStorage.getItem('report_data_' + prevPeriodKey);
                if (storedPrev) {
                    const prevData = JSON.parse(storedPrev);
                    if (prevData[currentCarId]) {
                        autoPrevFuel = prevData[currentCarId].leftFuel || '';
                        autoPrevAdBlue = prevData[currentCarId].leftAdBlue || '';
                        autoPrevOdo = prevData[currentCarId].odo || '';
                    }
                }
            } catch(e) {}
        }

        const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
        const car = sourceCars.find(c => Number(c.id) === Number(currentCarId));
        savedReportData[currentCarId] = {
            prevFuel: autoPrevFuel,
            prevAdBlue: autoPrevAdBlue,
            prevOdo: autoPrevOdo,
            refuelFuel: '',
            refuelAdBlue: '',
            refuelOil: '',
            refuelWasher: '',
            note: car ? car.note : '',
            docNo: '',
            leftFuel: '',
            leftAdBlue: '',
            odo: ''
        };
    }

    savedReportData[currentCarId].refuelFuel = fuelReceived;
    if (adblueReceived !== '') {
        savedReportData[currentCarId].refuelAdBlue = adblueReceived;
    }
    if (fuelLeft && fuelLeft !== '0.0') {
        savedReportData[currentCarId].leftFuel = fuelLeft;
    }
    if (adblueLeft && adblueLeft !== '0.0') {
        savedReportData[currentCarId].leftAdBlue = adblueLeft;
    }
    if (finalOdo) {
        savedReportData[currentCarId].odo = finalOdo;
    }

    localStorage.setItem(storageKey, JSON.stringify(savedReportData));

    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const currentCar = sourceCars.find(c => Number(c.id) === Number(currentCarId));
    const carName = currentCar ? currentCar.plate + ' (' + currentCar.model + ')' : 'автомобіля';
    
    alert('Дані для ' + carName + ' успішно перенесено у звіт за період "' + periodStr + '"!');
}

function saveReportData() {
    const periodStr = document.getElementById('report-custom-period').value.trim() || "01.10-10.10";
    
    let periods = getSavedPeriodsList();
    if (!periods.includes(periodStr)) {
        periods.push(periodStr);
        localStorage.setItem('app_saved_periods_list', JSON.stringify(periods));
    }
    populatePeriodDropdown(periodStr);

    const storageKey = 'report_data_' + periodStr;
    const rows = document.querySelectorAll('#report-tbody tr');
    let reportData = {};

    rows.forEach(row => {
        const carIdInput = row.querySelector('.report-cell-input');
        if (carIdInput) {
            const carId = carIdInput.getAttribute('data-car');
            reportData[carId] = {
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
                odo: row.querySelector('.report-cell-input[data-field="odo"]')?.value || ''
            };
        }
    });

    localStorage.setItem(storageKey, JSON.stringify(reportData));
    alert('Звіт за період "' + periodStr + '" успішно збережено!');
}

document.addEventListener('input', function(e) {
    if (e.target.classList.contains('report-cell-input')) {
        const periodStr = document.getElementById('report-custom-period').value.trim() || "01.10-10.10";
        const storageKey = 'report_data_' + periodStr;
        const rows = document.querySelectorAll('#report-tbody tr');
        let reportData = {};

        rows.forEach(row => {
            const carIdInput = row.querySelector('.report-cell-input');
            if (carIdInput) {
                const carId = carIdInput.getAttribute('data-car');
                reportData[carId] = {
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
                    odo: row.querySelector('.report-cell-input[data-field="odo"]')?.value || ''
                };
            }
        });
        localStorage.setItem(storageKey, JSON.stringify(reportData));
        updateReportTotals();
    }
});