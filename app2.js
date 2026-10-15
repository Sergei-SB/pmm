// ==========================================
// ФІНАЛЬНИЙ РОБОЧИЙ КОД app2.js 
// (СТАРТ З 01.10-10.10, АВТОМАТИЧНА ГЕНЕРАЦІЯ ПЕРІОДІВ ТА ПЕРЕНОС ЗАЛИШКІВ)
// ==========================================
// Версія: оригінал + одна безпечна правка — обгортка навколо
// loadCarDataForActivePeriod, яка гарантовано повертає isRestoringState у false
// (інакше після будь-якої помилки авто-збереження мовчки вимикається).
// Логіка розрахунків і формул не змінена.
// ==========================================

let activeCarPeriod = getDefaultPeriodByCurrentDate();
let isRestoringState = false;

function getDefaultPeriodByCurrentDate() {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    if (year < 2026 || (year === 2026 && month < 10)) {
        return "01.10-10.10";
    }

    const mm = String(month).padStart(2, '0');
    const lastDayOfMonth = new Date(year, month, 0).getDate();

    if (day <= 10) {
        return `01.${mm}-10.${mm}`;
    } else if (day <= 20) {
        return `11.${mm}-20.${mm}`;
    } else {
        return `21.${mm}-${lastDayOfMonth}.${mm}`;
    }
}

function getNextTenDayPeriod(periodStr, yearHint = 2026) {
    if (!periodStr) return "01.10-10.10";
    const startPart = periodStr.split('-')[0].trim();
    const parts = startPart.split('.');
    const day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parts[2] ? parseInt(parts[2], 10) : yearHint;

    const mm = String(month).padStart(2, '0');

    if (day === 1) {
        return `11.${mm}-20.${mm}`;
    } else if (day === 11) {
        const lastDay = new Date(year, month, 0).getDate();
        return `21.${mm}-${lastDay}.${mm}`;
    } else {
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
        const nextMm = String(month).padStart(2, '0');
        return `01.${nextMm}-10.${nextMm}`;
    }
}

function parsePeriodDateVal(periodStr) {
    if (!periodStr) return 0;
    const cleanStr = periodStr.split('-')[0].trim();
    const parts = cleanStr.split('.');
    if (parts.length >= 2) {
        const day = parseInt(parts[0], 10) || 0;
        const month = parseInt(parts[1], 10) || 0;
        const defaultYear = month >= 10 ? 2026 : 2027;
        const year = parts[2] ? parseInt(parts[2], 10) : defaultYear;
        return year * 10000 + month * 100 + day;
    }
    return 0;
}

function isValidPeriodFromOctober(periodStr) {
    if (!periodStr || !periodStr.includes('-')) return false;
    const cleanStr = periodStr.split('-')[0].trim();
    const parts = cleanStr.split('.');
    if (parts.length < 2) return false;
    const month = parseInt(parts[1], 10);
    return month >= 10;
}

function getSortedPeriods() {
    let periods = ["01.10-10.10"];
    const targetCurrent = getDefaultPeriodByCurrentDate();

    let curr = "01.10-10.10";
    let safetyCounter = 0;
    while (parsePeriodDateVal(curr) < parsePeriodDateVal(targetCurrent) && safetyCounter < 36) {
        curr = getNextTenDayPeriod(curr);
        if (!periods.includes(curr)) {
            periods.push(curr);
        }
        safetyCounter++;
    }

    try {
        const stored = localStorage.getItem('app_saved_periods_list');
        if (stored) {
            const customList = JSON.parse(stored);
            if (Array.isArray(customList)) {
                customList.forEach(p => {
                    if (isValidPeriodFromOctober(p) && !periods.includes(p)) {
                        periods.push(p);
                    }
                });
            }
        }
    } catch (e) {}

    periods.sort((a, b) => parsePeriodDateVal(a) - parsePeriodDateVal(b));
    localStorage.setItem('app_saved_periods_list', JSON.stringify(periods));
    return periods;
}

function getPrevPeriodKey(currPeriod) {
    const periods = getSortedPeriods();
    const idx = periods.indexOf((currPeriod || "").trim());
    if (idx > 0) return periods[idx - 1];
    return null;
}

function getRoutesKey(carId, period) {
    return `isolated_car_routes_${period}_${carId}`;
}

function getStrictActivePeriod() {
    const selectEl = document.getElementById('card-period-select') || document.getElementById('car-period-select');
    if (selectEl && selectEl.value) {
        activeCarPeriod = selectEl.value;
    }
    return activeCarPeriod;
}

function isCardSaveRoleAllowed() {
    const r = (typeof currentRole !== 'undefined' && currentRole) ? String(currentRole).toLowerCase().trim() : 'user';
    return (r === 'admin' || r === 'developer' || r === 'dev');
}

function ensureCardSaveChangesButton() {
    const periodBox = document.querySelector('#card-view .card-period-box');
    if (!periodBox) return;

    let saveBtn = document.getElementById('card-save-btn');
    if (!saveBtn) {
        saveBtn = document.createElement('button');
        saveBtn.id = 'card-save-btn';
        saveBtn.type = 'button';
        saveBtn.className = 'action-btn';
        periodBox.appendChild(saveBtn);
    }

    saveBtn.onclick = window.saveActiveCardPeriodData;
    if (!saveBtn.dataset.initializedLabel) {
        saveBtn.innerHTML = '💾 Зберегти зміни';
        saveBtn.dataset.initializedLabel = '1';
    }
    const canSee = isCardSaveRoleAllowed();
    saveBtn.style.cssText = `background-color: #27ae60; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; display: ${canSee ? 'inline-flex' : 'none'} !important; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); white-space: nowrap; margin-left: 4px;`;
}

window.initCardPeriodsSelect = function() {
    ensureCardSaveChangesButton();
    const selectEl = document.getElementById('card-period-select') || document.getElementById('car-period-select');
    if (!selectEl) return;

    const periods = getSortedPeriods();
    if (!periods.includes(activeCarPeriod)) {
        activeCarPeriod = periods[0] || "01.10-10.10";
    }

    selectEl.innerHTML = periods.map(p => `<option value="${p}" ${p === activeCarPeriod ? 'selected' : ''}>${p}</option>`).join('');
    selectEl.value = activeCarPeriod;
};

window.onCardPeriodChange = function(val) {
    if (!val) return;
    saveCarRoutesForPeriod(activeCarPeriod);
    activeCarPeriod = val;
    const selectEl = document.getElementById('card-period-select') || document.getElementById('car-period-select');
    if (selectEl) selectEl.value = activeCarPeriod;
    loadCarDataForActivePeriod();
};
window.onCarPeriodChange = window.onCardPeriodChange;

window.navigateCardPeriod = function(direction) {
    saveCarRoutesForPeriod(activeCarPeriod);

    let periods = getSortedPeriods();
    let idx = periods.indexOf(activeCarPeriod);
    if (idx === -1) idx = 0;

    let newIdx = idx + direction;

    if (direction > 0 && newIdx >= periods.length) {
        const nextPeriod = getNextTenDayPeriod(periods[periods.length - 1]);
        if (!periods.includes(nextPeriod)) {
            periods.push(nextPeriod);
            localStorage.setItem('app_saved_periods_list', JSON.stringify(periods));
            initCardPeriodsSelect();
            if (typeof populatePeriodDropdown === 'function') {
                populatePeriodDropdown(nextPeriod);
            }
        }
        newIdx = periods.indexOf(nextPeriod);
    }

    if (newIdx >= 0 && newIdx < periods.length) {
        activeCarPeriod = periods[newIdx];
        const selectEl = document.getElementById('card-period-select') || document.getElementById('car-period-select');
        if (selectEl) selectEl.value = activeCarPeriod;
        loadCarDataForActivePeriod();
    }
};
window.shiftCarPeriod = window.navigateCardPeriod;

window.saveActiveCardPeriodData = function() {
    isRestoringState = false;
    const period = getStrictActivePeriod();
    const targetCarId = (typeof currentCarId !== 'undefined' && currentCarId) ? currentCarId : 1;

    if (typeof updateRouteTotals === 'function') {
        updateRouteTotals();
    }

    saveCarRoutesForPeriod(period, targetCarId, true);

    if (typeof saveCarsModificationsToStorage === 'function') {
        saveCarsModificationsToStorage();
    }

    const fuelLeft = document.getElementById('fuel-left')?.textContent?.trim() || '0';
    const odoEnd = document.getElementById('odo-2')?.value || document.getElementById('odo-1')?.value || '0';
    const safeCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : [];
    const car = safeCars.find(c => Number(c.id) === Number(targetCarId));
    const carLabel = car ? `${car.plate} (${car.model})` : `ID #${targetCarId}`;

    const saveBtn = document.getElementById('card-save-btn');
    if (saveBtn) {
        saveBtn.innerHTML = '✅ Збережено!';
        saveBtn.style.backgroundColor = '#1e8449';
        setTimeout(() => {
            saveBtn.innerHTML = '💾 Зберегти зміни';
            saveBtn.style.backgroundColor = '#27ae60';
        }, 1800);
    }

    const msg = `✅ Зміни для авто <b>${carLabel}</b> за період <b>${period}</b> збережено!<br>Залишок палива: <b>${fuelLeft} л</b> | Одометр: <b>${odoEnd}</b>`;
    if (typeof showDevNotification === 'function') {
        showDevNotification(msg, '#27ae60');
    } else {
        let toast = document.getElementById('card-save-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'card-save-toast';
            document.body.appendChild(toast);
        }
        toast.style.cssText = 'position:fixed; bottom:24px; right:24px; background:#27ae60; color:#fff; padding:12px 20px; border-radius:8px; font-size:13px; font-weight:bold; box-shadow:0 6px 20px rgba(0,0,0,0.25); z-index:999999; line-height:1.4;';
        toast.innerHTML = msg;
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 3000);
    }
};

function hookIntoLoadCarCard() {
    if (typeof window.loadCarCard === 'function' && !window._loadCarCardHooked) {
        window._loadCarCardHooked = true;
        const originalLoadCarCard = window.loadCarCard;
        window.loadCarCard = function(carId) {
            if (!isRestoringState && typeof currentCarId !== 'undefined' && currentCarId && Number(currentCarId) !== Number(carId)) {
                saveCarRoutesForPeriod(activeCarPeriod, currentCarId);
            }
            originalLoadCarCard.apply(this, arguments);
            if (!isRestoringState) {
                loadCarDataForActivePeriod();
            }
        };
    }
}

function loadCarDataForActivePeriod() {
    if (typeof currentCarId === 'undefined' || !currentCarId) return;
    isRestoringState = true;

    const period = getStrictActivePeriod();
    const dataKey = getRoutesKey(currentCarId, period);
    let periodData = null;

    try {
        const stored = localStorage.getItem(dataKey);
        if (stored) periodData = JSON.parse(stored);
    } catch (e) {}

    const safeCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : [];
    const car = safeCars.find(c => Number(c.id) === Number(currentCarId));
    const truckActive = (car && typeof isCarTruck === 'function') ? isCarTruck(car) : false;

    const tbody = document.getElementById('routes-tbody');
    if (tbody) {
        if (periodData && periodData.rows && Array.isArray(periodData.rows) && periodData.rows.length > 0) {
            tbody.innerHTML = '';
            periodData.rows.forEach(rData => {
                if (typeof addRouteRow === 'function') {
                    addRouteRow(rData.name || 'Виконання БЗ Харків', rData.time || '8:30', '', truckActive);
                    const lastRow = tbody.lastElementChild;
                    if (lastRow && Array.isArray(rData.inputs)) {
                        const inputs = lastRow.querySelectorAll('input');
                        rData.inputs.forEach((val, idx) => {
                            if (inputs[idx] && !inputs[idx].hasAttribute('readonly')) {
                                inputs[idx].value = val;
                            }
                        });
                    }
                }
            });
        } else {
            if (typeof initDefaultRoutes === 'function') {
                initDefaultRoutes(truckActive);
            }
        }
    }

    const prevKey = getPrevPeriodKey(period);
    let prevEndOdo = '';
    let prevLeftFuel = '';
    let prevLeftAdblue = '';

    if (prevKey) {
        try {
            const prevStored = localStorage.getItem(getRoutesKey(currentCarId, prevKey));
            if (prevStored) {
                const prevData = JSON.parse(prevStored);
                if (prevData && prevData.topFields) {
                    if (prevData.topFields.odo2 !== undefined && prevData.topFields.odo2 !== '') {
                        prevEndOdo = prevData.topFields.odo2;
                    }
                    if (prevData.topFields.savedFuelLeft !== undefined && prevData.topFields.savedFuelLeft !== '') {
                        prevLeftFuel = prevData.topFields.savedFuelLeft;
                    }
                    if (prevData.topFields.savedAdblueLeft !== undefined && prevData.topFields.savedAdblueLeft !== '') {
                        prevLeftAdblue = prevData.topFields.savedAdblueLeft;
                    }
                }
            }
        } catch (e) {}

        try {
            const repStored = localStorage.getItem('report_data_' + prevKey);
            if (repStored) {
                const repData = JSON.parse(repStored);
                if (repData && repData[currentCarId]) {
                    if (repData[currentCarId].leftFuel !== undefined && repData[currentCarId].leftFuel !== '') {
                        prevLeftFuel = repData[currentCarId].leftFuel;
                    }
                    if (repData[currentCarId].odo !== undefined && repData[currentCarId].odo !== '') {
                        prevEndOdo = repData[currentCarId].odo;
                    }
                    if (repData[currentCarId].leftAdBlue !== undefined && repData[currentCarId].leftAdBlue !== '') {
                        prevLeftAdblue = repData[currentCarId].leftAdBlue;
                    }
                }
            }
        } catch (e) {}
    }

    const odo1El = document.getElementById('odo-1');
    if (odo1El) {
        if (periodData && periodData.topFields && periodData.topFields.odo1 !== undefined && periodData.topFields.odo1 !== '') {
            odo1El.value = periodData.topFields.odo1;
        } else if (prevEndOdo !== '') {
            odo1El.value = prevEndOdo;
        } else {
            odo1El.value = '';
        }
    }

    const fuelStartEl = document.getElementById('fuel-start');
    if (fuelStartEl) {
        if (periodData && periodData.topFields && periodData.topFields.fuelStart !== undefined && periodData.topFields.fuelStart !== '') {
            fuelStartEl.value = periodData.topFields.fuelStart;
        } else if (prevLeftFuel !== '') {
            fuelStartEl.value = prevLeftFuel;
        } else {
            fuelStartEl.value = '';
        }
    }

    const fuelRecEl = document.getElementById('fuel-received');
    if (fuelRecEl) {
        fuelRecEl.value = (periodData && periodData.topFields) ? (periodData.topFields.fuelReceived || '') : '';
    }

    const adBlueStartEl = document.getElementById('adblue-start');
    if (adBlueStartEl) {
        if (periodData && periodData.topFields && periodData.topFields.adblueStart !== undefined && periodData.topFields.adblueStart !== '') {
            adBlueStartEl.value = periodData.topFields.adblueStart;
        } else if (prevLeftAdblue !== '') {
            adBlueStartEl.value = prevLeftAdblue;
        } else {
            adBlueStartEl.value = '';
        }
    }

    const adBlueRecEl = document.getElementById('adblue-received');
    if (adBlueRecEl) {
        adBlueRecEl.value = (periodData && periodData.topFields) ? (periodData.topFields.adblueReceived || '') : '';
    }

    if (typeof updateRouteTotals === 'function') {
        updateRouteTotals();
    }

    const odo2El = document.getElementById('odo-2');
    if (odo2El && !odo2El.value && periodData && periodData.topFields && periodData.topFields.odo2) {
        odo2El.value = periodData.topFields.odo2;
    }

    isRestoringState = false;
}

// Обгортка: гарантує повернення isRestoringState у false навіть при помилці
// (інакше авто-збереження мовчки перестає працювати до перезавантаження).
const _loadCarDataForActivePeriodOriginal = loadCarDataForActivePeriod;
loadCarDataForActivePeriod = function () {
    try {
        return _loadCarDataForActivePeriodOriginal.apply(this, arguments);
    } finally {
        isRestoringState = false;
    }
};

function saveCarRoutesForPeriod(periodToSave, carIdToSave, isManualSave = false) {
    if (isRestoringState) return;
    const targetCarId = carIdToSave || (typeof currentCarId !== 'undefined' ? currentCarId : null);
    if (!targetCarId) return;

    const period = periodToSave || getStrictActivePeriod();
    if (!period) return;

    if (typeof updateRouteTotals === 'function') {
        updateRouteTotals();
    }

    const dataKey = getRoutesKey(targetCarId, period);
    const rowsData = [];
    const rows = document.querySelectorAll('#routes-tbody tr');

    rows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        const inputValues = Array.from(inputs).map(inp => inp.value);
        rowsData.push({
            name: inputs[0] ? inputs[0].value : '',
            time: inputs[1] ? inputs[1].value : '8:30',
            inputs: inputValues
        });
    });

    const odo1Val = document.getElementById('odo-1')?.value || '';
    let odo2Val = document.getElementById('odo-2')?.value || '';
    if (!odo2Val && odo1Val) {
        odo2Val = odo1Val;
    }

    const savedFuelLeftVal = document.getElementById('fuel-left')?.textContent?.trim() || '';
    const savedFuelSpentVal = document.getElementById('fuel-spent')?.textContent?.trim() || '';
    const savedAdblueLeftVal = document.getElementById('adblue-left')?.textContent?.trim() || '';

    const topFields = {
        fuelStart: document.getElementById('fuel-start')?.value || '',
        fuelReceived: document.getElementById('fuel-received')?.value || '',
        fuelSpent: savedFuelSpentVal,
        odo1: odo1Val,
        odo2: odo2Val,
        savedFuelLeft: savedFuelLeftVal,
        adblueStart: document.getElementById('adblue-start')?.value || '',
        adblueReceived: document.getElementById('adblue-received')?.value || '',
        savedAdblueLeft: savedAdblueLeftVal,
        updatedAt: new Date().toISOString()
    };

    localStorage.setItem(dataKey, JSON.stringify({
        topFields: topFields,
        rows: rowsData
    }));

    const periods = getSortedPeriods();
    const curIdx = periods.indexOf(period);
    if (curIdx >= 0 && curIdx + 1 < periods.length) {
        const nextPeriodKey = periods[curIdx + 1];
        const nextStorageKey = getRoutesKey(targetCarId, nextPeriodKey);
        try {
            const nextRaw = localStorage.getItem(nextStorageKey);
            if (nextRaw) {
                const nextObj = JSON.parse(nextRaw);
                if (nextObj && nextObj.topFields) {
                    if (odo2Val !== '') nextObj.topFields.odo1 = odo2Val;
                    if (savedFuelLeftVal !== '') nextObj.topFields.fuelStart = savedFuelLeftVal;
                    if (savedAdblueLeftVal !== '') nextObj.topFields.adblueStart = savedAdblueLeftVal;
                    localStorage.setItem(nextStorageKey, JSON.stringify(nextObj));
                }
            }
        } catch (e) {}
    }
}

function manualSaveCarRoutes() {
    saveCarRoutesForPeriod(getStrictActivePeriod());
}

document.addEventListener('input', function(e) {
    if (isRestoringState) return;
    if (
        e.target.closest('#routes-tbody') ||
        e.target.id === 'fuel-start' ||
        e.target.id === 'fuel-received' ||
        e.target.id === 'adblue-start' ||
        e.target.id === 'adblue-received' ||
        e.target.id === 'odo-1' ||
        e.target.id === 'odo-2'
    ) {
        saveCarRoutesForPeriod(getStrictActivePeriod());
    }
});

document.addEventListener("DOMContentLoaded", () => {
    initCardPeriodsSelect();
    hookIntoLoadCarCard();
    setTimeout(() => {
        loadCarDataForActivePeriod();
    }, 150);
});

window.switchView = function(viewName) {
    const viewMapping = {
        'base': 'base-view',
        'card': 'card-view',
        'report': 'report-view',
        'subdivisions': 'subdivisions-view',
        'generators': 'generators-view',
        'aggregates-calc': 'aggregates-calc-view',
        'destroyed': 'destroyed-view',
        'dev-panel': 'dev-panel-view',
        'car-details': 'car-details-view'
    };

    let targetSectionId = viewMapping[viewName] || (viewName + '-view');

    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });

    let targetSection = document.getElementById(targetSectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.display = 'block';
    }

    document.querySelectorAll('.top-nav .nav-btn').forEach(btn => {
        btn.classList.remove('active');
        const onclickAttr = btn.getAttribute('onclick') || '';
        if (onclickAttr.includes(`'${viewName}'`) || onclickAttr.includes(`"${viewName}"`)) {
            btn.classList.add('active');
        }
    });

    const topSearchBox = document.getElementById('top-search-box');
    if (topSearchBox) {
        topSearchBox.style.display = (viewName === 'base') ? 'flex' : 'none';
    }

    if (viewName === 'base' && typeof renderCarsTable === 'function') {
        renderCarsTable();
    } else if (viewName === 'card') {
        initCardPeriodsSelect();
        loadCarDataForActivePeriod();
    } else if (viewName === 'subdivisions' && typeof renderSubdivisionsView === 'function') {
        renderSubdivisionsView();
    } else if (viewName === 'generators' && typeof switchEquipmentTab === 'function') {
        switchEquipmentTab('generators');
    } else if (viewName === 'report' && typeof renderReportTable === 'function') {
        renderReportTable();
    } else if (viewName === 'aggregates-calc' && typeof renderAggregatesCalcView === 'function') {
        renderAggregatesCalcView();
    } else if (viewName === 'destroyed' && typeof renderDestroyedEquipmentView === 'function') {
        renderDestroyedEquipmentView();
    } else if (viewName === 'dev-panel' && typeof renderDevPanelView === 'function') {
        renderDevPanelView();
    } else if (viewName === 'dev-panel' && typeof renderDeveloperPanel === 'function') {
        renderDeveloperPanel();
    }
};
