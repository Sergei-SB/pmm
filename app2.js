// ==========================================
// ФІНАЛЬНИЙ РОБОЧИЙ КОД app2.js (ВИПРАВЛЕНИЙ)
// ==========================================

let activeCarPeriod = getDefaultPeriodByCurrentDate();
let isRestoringState = false;

function getDefaultPeriodByCurrentDate() {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

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

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        hookIntoLoadCarCard();
        loadCarDataForActivePeriod();
    }, 500);
});

function parsePeriodDateVal(periodStr) {
    if (!periodStr) return 0;
    const cleanStr = periodStr.split('-')[0].trim();
    const parts = cleanStr.split('.');
    if (parts.length >= 2) {
        const day = parseInt(parts[0], 10) || 0;
        const month = parseInt(parts[1], 10) || 0;
        const year = parts[2] ? parseInt(parts[2], 10) : 2026;
        return year * 10000 + month * 100 + day;
    }
    return 0;
}

function getSortedPeriods() {
    let currentAuto = getDefaultPeriodByCurrentDate();
    let basePeriods = [
        "21.05-31.05", "01.06-10.06", "11.06-20.06", "21.06-30.06",
        "01.07-10.07", "11.07-20.07", "21.07-31.07", "01.08-10.08",
        "11.08-20.08", "21.08-31.08", "01.09-10.09", "11.09-20.09",
        "21.09-30.09", "01.10-10.10", "11.10-20.10", "21.10-31.10",
        "01.11-10.11", "11.11-20.11", "21.11-30.11", "01.12-10.12",
        "11.12-20.12", "21.12-31.12"
    ];
    
    if (!basePeriods.includes(currentAuto)) {
        basePeriods.push(currentAuto);
    }

    try {
        const stored = localStorage.getItem('app_saved_periods_list');
        if (stored) {
            const customList = JSON.parse(stored);
            customList.forEach(p => {
                if (!basePeriods.includes(p)) basePeriods.push(p);
            });
        }
    } catch(e) {}

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('_isolated_car_routes_')) {
            const parts = key.split('_isolated_car_routes_');
            if (parts.length > 1) {
                const p = parts[1].split('_')[0];
                if (p && !basePeriods.includes(p)) basePeriods.push(p);
            }
        }
    }

    basePeriods.sort((a, b) => parsePeriodDateVal(a) - parsePeriodDateVal(b));
    return basePeriods;
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
    const selectEl = document.getElementById('car-period-select');
    if (selectEl && selectEl.value) {
        activeCarPeriod = selectEl.value;
    }
    return activeCarPeriod;
}

function shiftCarPeriod(direction) {
    manualSaveCarRoutes(); 
    const periods = getSortedPeriods();
    let current = getStrictActivePeriod();
    let idx = periods.indexOf(current);
    if (idx !== -1) {
        idx += direction;
        if (idx >= 0 && idx < periods.length) {
            activeCarPeriod = periods[idx];
            const selectEl = document.getElementById('car-period-select');
            if (selectEl) selectEl.value = activeCarPeriod;
            loadCarDataForActivePeriod();
        }
    }
}

function onCarPeriodChange(val) {
    if (!val) return;
    manualSaveCarRoutes(); 
    activeCarPeriod = val;
    loadCarDataForActivePeriod();
}

function hookIntoLoadCarCard() {
    if (typeof window.loadCarCard === 'function') {
        const originalLoadCarCard = window.loadCarCard;
        window.loadCarCard = function(carId) {
            originalLoadCarCard.apply(this, arguments);
            if (!isRestoringState) {
                setTimeout(() => loadCarDataForActivePeriod(), 50);
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
    } catch(e) {}

    // 1. Відновлюємо нижню таблицю маршрутів
    const tbody = document.getElementById('routes-tbody');
    if (tbody) {
        if (periodData && periodData.rows && Array.isArray(periodData.rows) && periodData.rows.length > 0) {
            tbody.innerHTML = '';
            periodData.rows.forEach(rData => {
                if (typeof addRouteRow === 'function') {
                    addRouteRow(rData.name || '', rData.time || '8:30', '');
                    const lastRow = tbody.lastElementChild;
                    if (lastRow && rData.inputs) {
                        const inputs = lastRow.querySelectorAll('input');
                        rData.inputs.forEach((val, idx) => {
                            if (inputs[idx]) inputs[idx].value = val;
                        });
                    }
                }
            });
        } else {
            const safeCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : [];
            const car = safeCars.find(c => Number(c.id) === Number(currentCarId));
            if (car && typeof initDefaultRoutes === 'function' && typeof isCarTruck === 'function') {
                initDefaultRoutes(isCarTruck(car));
            }
        }
    }

    // 2. Отримуємо дані попереднього періоду
    const prevKey = getPrevPeriodKey(period);
    let prevData = null;
    if (prevKey) {
        try {
            const prevStored = localStorage.getItem(getRoutesKey(currentCarId, prevKey));
            if (prevStored) prevData = JSON.parse(prevStored);
        } catch(e) {}
    }

    // Початковий одометр
    const odo1El = document.getElementById('odo-1');
    if (odo1El) {
        if (prevData && prevData.topFields && prevData.topFields.odo2 !== undefined && prevData.topFields.odo2 !== '') {
            odo1El.value = prevData.topFields.odo2; 
        } else if (periodData && periodData.topFields && periodData.topFields.odo1 !== undefined) {
            odo1El.value = periodData.topFields.odo1;
        } else {
            odo1El.value = '';
        }
    }

    // Паливо на початок
    const fuelStartEl = document.getElementById('fuel-start');
    if (fuelStartEl) {
        if (prevData && prevData.topFields && prevData.topFields.savedFuelLeft !== undefined && prevData.topFields.savedFuelLeft !== '') {
            fuelStartEl.value = prevData.topFields.savedFuelLeft; 
        } else if (periodData && periodData.topFields && periodData.topFields.fuelStart !== undefined) {
            fuelStartEl.value = periodData.topFields.fuelStart;
        } else {
            fuelStartEl.value = '';
        }
    }

    const fuelRecEl = document.getElementById('fuel-received');
    if (fuelRecEl) {
        fuelRecEl.value = (periodData && periodData.topFields) ? (periodData.topFields.fuelReceived || '') : '';
    }

    // AdBlue на початок
    const adBlueStartEl = document.getElementById('adblue-start');
    if (adBlueStartEl) {
        if (prevData && prevData.topFields && prevData.topFields.savedAdblueLeft !== undefined && prevData.topFields.savedAdblueLeft !== '') {
            adBlueStartEl.value = prevData.topFields.savedAdblueLeft; 
        } else if (periodData && periodData.topFields && periodData.topFields.adblueStart !== undefined) {
            adBlueStartEl.value = periodData.topFields.adblueStart;
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

    setTimeout(() => {
        isRestoringState = false;
    }, 200);
}

function manualSaveCarRoutes() {
    if (typeof currentCarId === 'undefined' || !currentCarId) return;

    const period = getStrictActivePeriod();
    if (!period) return;

    const dataKey = getRoutesKey(currentCarId, period);
    
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

    const topFields = {
        fuelStart: document.getElementById('fuel-start')?.value || '',
        fuelReceived: document.getElementById('fuel-received')?.value || '',
        odo1: document.getElementById('odo-1')?.value || '',
        odo2: document.getElementById('odo-2')?.value || '', 
        savedFuelLeft: document.getElementById('fuel-left')?.textContent || '', 
        adblueStart: document.getElementById('adblue-start')?.value || '',
        adblueReceived: document.getElementById('adblue-received')?.value || '',
        savedAdblueLeft: document.getElementById('adblue-left')?.textContent || '' 
    };

    const packageData = {
        topFields: topFields,
        rows: rowsData
    };

    localStorage.setItem(dataKey, JSON.stringify(packageData));

    const saveBtn = document.getElementById('manual-save-period-btn');
    if (saveBtn) {
        const originalText = saveBtn.textContent;
        saveBtn.textContent = "✔ Збережено!";
        saveBtn.style.background = "#2ecc71";
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.background = "#27ae60";
        }, 1200);
    }
}

// ==========================================
// ВИПРАВЛЕННЯ ТА АКТИВАЦІЯ ВЕРХНІХ КНОПОК НАВІГАЦІЇ
// ==========================================

window.switchView = function(viewName) {
    const viewMapping = {
        'base': 'base-view',
        'card': 'card-view',
        'report': 'report-view',
        'subdivisions': 'subdivisions-view',
        'generators': 'generators-view',
        'aggregates-calc': 'aggregates-calc-view',
        'destroyed': 'destroyed-view'
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

    if (viewName === 'subdivisions' && typeof renderSubdivisionsView === 'function') {
        renderSubdivisionsView();
    } else if (viewName === 'generators' && typeof switchEquipmentTab === 'function') {
        switchEquipmentTab('generators');
    } else if (viewName === 'report' && typeof renderReportTable === 'function') {
        renderReportTable();
    } else if (viewName === 'aggregates-calc' && typeof renderAggregatesCalcView === 'function') {
        renderAggregatesCalcView();
    } else if (viewName === 'destroyed' && typeof renderDestroyedEquipmentView === 'function') {
        renderDestroyedEquipmentView();
    }
};