// ==========================================
// КАЛЬКУЛЯТОР АГРЕГАТІВ (aggregates_calc.js)
// ==========================================

function renderAggregatesCalcView() {
    const container = document.getElementById('aggregates-calc-container');
    if (!container) return;

    let allEquipment = [];
    
    try {
        const gens = JSON.parse(localStorage.getItem('generators_custom_data')) || [];
        gens.forEach(i => allEquipment.push({ ...i, category: 'Генератор' }));
    } catch(e) {}

    ['webasto', 'heaters', 'chainsaws'].forEach(type => {
        try {
            const data = JSON.parse(localStorage.getItem(`equipment_data_${type}`)) || [];
            let catName = type === 'webasto' ? 'Webasto' : (type === 'heaters' ? 'Теплова пушка' : 'Бензопила');
            data.forEach(i => allEquipment.push({ ...i, category: catName }));
        } catch(e) {}
    });

    window._allCalculatedEquipment = allEquipment;
    if (window._selectedAggIndex === undefined) window._selectedAggIndex = 'custom';
    if (window._customAggText === undefined) window._customAggText = '';

    let currentSelectedText = 'Свій агрегат';
    if (window._selectedAggIndex === 'custom') {
        currentSelectedText = 'Свій агрегат';
    } else if (window._selectedAggIndex !== null && window._selectedAggIndex >= 0 && allEquipment[window._selectedAggIndex]) {
        let eq = allEquipment[window._selectedAggIndex];
        currentSelectedText = `${eq.category}: ${eq.model || 'Без назви'} (${eq.locationSubdivision || eq.subdivision || 'РМТЗ'})`;
    } else if (window._customAggText) {
        currentSelectedText = window._customAggText;
    }

    let html = `
        <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #bdc3c7; max-width: 1050px; margin: 0 auto;">
            <!-- ЦЕНТРАЛЬНИЙ ЗАГОЛОВОК ТА КНОПКА ДРУКУ -->
            <div style="position: relative; display: flex; align-items: center; justify-content: center; border-bottom: 2px solid #2e7d32; padding-bottom: 10px; margin-bottom: 15px;">
                <h3 style="color: #2e7d32; margin: 0; font-size: 18px; text-align: center; font-weight: bold;">Розрахунок витрати палива та мастил агрегатів</h3>
                <button class="action-btn" style="position: absolute; right: 0; background-color: #2980b9; padding: 6px 12px; font-size: 12px; font-weight: bold; cursor: pointer; color: white; border: none; border-radius: 4px;" onclick="printAggregatesReport()">🖨️ Друк розрахунку</button>
            </div>
            
            <!-- ДВА СТОВПЧИКИ ЗВЕРХУ -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <!-- Стовпчик 1: Випадаючий список з пошуком -->
                <div style="position: relative;">
                    <label style="display: block; font-weight: bold; margin-bottom: 5px; font-size: 13px;">1. Оберіть або введіть назву агрегата:</label>
                    <div id="agg-dropdown-box" style="position: relative; width: 100%;">
                        <div id="agg-dropdown-header" onclick="toggleAggDropdown(event)" style="width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #bdc3c7; font-size: 13px; background: #fff; box-sizing: border-box; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                            <span id="agg-header-text" style="color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${currentSelectedText}</span>
                            <span style="font-size: 11px; color: #7f8c8d; margin-left: 5px;">▼</span>
                        </div>
                        
                        <div id="agg-dropdown-panel" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #bdc3c7; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; margin-top: 3px;">
                            <div style="padding: 8px; border-bottom: 1px solid #e0e0e0; background: #f9f9f9;">
                                <input type="text" id="agg-search-input" placeholder="Пошук або введіть назву..." oninput="filterAggDropdown(this.value)" onclick="event.stopPropagation()" style="width: 100%; padding: 8px; border: 1px solid #bdc3c7; border-radius: 4px; font-size: 12px; box-sizing: border-box; outline: none;">
                            </div>
                            <div id="agg-items-list" style="max-height: 220px; overflow-y: auto;">
                                <!-- Елементи списку -->
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Стовпчик 2: Розхід в годинах + мастило -->
                <div>
                    <label style="display: block; font-weight: bold; margin-bottom: 5px; font-size: 13px;">2. Розхід агрегата (год) та мастило:</label>
                    <div id="eq-rates-info-box" style="padding: 9px 12px; background: #f4f6f7; border-radius: 4px; border: 1px solid #bdc3c7; font-size: 13px; color: #555; height: 38px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between;">
                        <span style="color: #7f8c8d; font-style: italic;">Оберіть агрегат ліворуч...</span>
                    </div>
                </div>
            </div>

            <!-- ТРИ БЛОКИ ПАРАМЕТРІВ РОЗРАХУНКУ -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <!-- Варіант А -->
                <div style="background: #f4f6f7; padding: 12px; border-radius: 6px; border: 1px solid #dcdcdc;">
                    <div style="font-weight: bold; margin-bottom: 8px; font-size: 12px; color: #2e7d32;">Варіант А: За мото-годинами</div>
                    <label style="display: block; margin-bottom: 3px; font-size: 11px; color: #555;">Мото-годин на день (сер.):</label>
                    <input type="number" id="calc-hours-per-day" value="12" step="0.5" min="0" max="24" oninput="calculateFromHours()" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #bdc3c7; font-size: 13px; box-sizing: border-box; margin-bottom: 8px;">
                    
                    <label style="display: block; margin-bottom: 3px; font-size: 11px; color: #555;">Кількість днів (до 31):</label>
                    <input type="number" id="calc-days-count" value="20" step="1" min="1" max="31" oninput="calculateFromHours()" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #bdc3c7; font-size: 13px; box-sizing: border-box;">
                </div>

                <!-- Варіант Б -->
                <div style="background: #f4f6f7; padding: 12px; border-radius: 6px; border: 1px solid #dcdcdc;">
                    <div style="font-weight: bold; margin-bottom: 8px; font-size: 12px; color: #c0392b;">Варіант Б: За паливом</div>
                    <label style="display: block; margin-bottom: 3px; font-size: 11px; color: #555;">Загальний літраж палива:</label>
                    <input type="number" id="calc-fuel-input" value="380" step="0.1" min="0" placeholder="Напр. 380..." oninput="calculateFromFuel()" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #bdc3c7; font-size: 13px; box-sizing: border-box; margin-bottom: 8px;">
                    
                    <label style="display: block; margin-bottom: 3px; font-size: 11px; color: #555;">На скільки днів розбити:</label>
                    <input type="number" id="calc-fuel-days-count" value="20" step="1" min="1" max="31" oninput="calculateFromFuel()" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #bdc3c7; font-size: 13px; box-sizing: border-box;">
                </div>

                <!-- Ліміт годин на день -->
                <div style="background: #fef9e7; padding: 12px; border-radius: 6px; border: 1px solid #f39c12;">
                    <div style="font-weight: bold; margin-bottom: 8px; font-size: 12px; color: #d35400;">Ліміт часу на день</div>
                    <label style="display: block; margin-bottom: 3px; font-size: 11px; color: #555;" title="Максимально можлива кількість годин роботи агрегата на добу">Макс. годин на день (ліміт):</label>
                    <input type="number" id="calc-max-daily-hours" value="16" step="0.5" min="1" max="24" oninput="triggerRecalc()" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #f39c12; font-size: 13px; box-sizing: border-box; background: #fff; margin-bottom: 8px;">
                    <div style="font-size: 10px; color: #7f8c8d; font-style: italic; line-height: 1.2;">Гарантує, що жоден день не перевищить цей ліміт годин.</div>
                </div>
            </div>

            <div id="calc-details-box" style="margin-bottom: 20px;">
                <p style="color: #7f8c8d; font-style: italic; text-align: center; margin: 0;">Оберіть обладнання вище та введіть параметри для розрахунку.</p>
            </div>
        </div>
    `;

    container.innerHTML = html;
    renderAggDropdownItems(allEquipment);
    onSelectedEquipmentChange();

    document.addEventListener('click', function closeAggDropdown(e) {
        const box = document.getElementById('agg-dropdown-box');
        if (box && !box.contains(e.target)) {
            const panel = document.getElementById('agg-dropdown-panel');
            if (panel) panel.style.display = 'none';
        }
    }, { once: true });
}

function toggleAggDropdown(event) {
    event.stopPropagation();
    const panel = document.getElementById('agg-dropdown-panel');
    if (!panel) return;
    const isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        const searchInput = document.getElementById('agg-search-input');
        if (searchInput) {
            searchInput.focus();
            searchInput.value = '';
            filterAggDropdown('');
        }
    }
}

function renderAggDropdownItems(items) {
    const listContainer = document.getElementById('agg-items-list');
    if (!listContainer) return;

    let html = `<div onclick="selectCustomAggOption()" style="padding: 9px 12px; cursor: pointer; border-bottom: 1px solid #e0e0e0; color: #2e7d32; font-weight: bold; background: #f4f6f7;" onmouseover="this.style.background='#eaf2f8'" onmouseout="this.style.background='#f4f6f7'">➕ Свій агрегат</div>`;

    items.forEach((eq, idx) => {
        const title = `${eq.category}: ${eq.model || 'Без назви'} (${eq.locationSubdivision || eq.subdivision || 'РМТЗ'})`;
        html += `<div onclick="selectAggItem(${idx}, '${title.replace(/'/g, "\\'")}')" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f2f2f2; font-size: 12px;" onmouseover="this.style.background='#eaf2f8'" onmouseout="this.style.background='#fff'">${title}</div>`;
    });

    listContainer.innerHTML = html;
}

function filterAggDropdown(query) {
    const q = query.toLowerCase().trim();
    const all = window._allCalculatedEquipment || [];
    
    let html = `<div onclick="selectCustomAggOption()" style="padding: 9px 12px; cursor: pointer; border-bottom: 1px solid #e0e0e0; color: #2e7d32; font-weight: bold; background: #f4f6f7;" onmouseover="this.style.background='#eaf2f8'" onmouseout="this.style.background='#f4f6f7'">➕ Свій агрегат</div>`;

    const filtered = all.filter(eq => {
        const title = `${eq.category}: ${eq.model || ''} (${eq.locationSubdivision || eq.subdivision || 'РМТЗ'})`.toLowerCase();
        return title.includes(q);
    });

    if (filtered.length === 0 && q) {
        html += `<div onclick="selectCustomAggText('${query.replace(/'/g, "\\'")}')" style="padding: 10px 12px; cursor: pointer; color: #2980b9; font-weight: bold; font-size: 12px;" onmouseover="this.style.background='#eaf2f8'" onmouseout="this.style.background='#fff'">➕ Використати власне: "${query}"</div>`;
    } else {
        filtered.forEach((eq) => {
            const originalIdx = all.indexOf(eq);
            const title = `${eq.category}: ${eq.model || 'Без назви'} (${eq.locationSubdivision || eq.subdivision || 'РМТЗ'})`;
            html += `<div onclick="selectAggItem(${originalIdx}, '${title.replace(/'/g, "\\'")}')" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f2f2f2; font-size: 12px;" onmouseover="this.style.background='#eaf2f8'" onmouseout="this.style.background='#fff'">${title}</div>`;
        });
    }

    const listContainer = document.getElementById('agg-items-list');
    if (listContainer) listContainer.innerHTML = html;
}

function selectCustomAggOption() {
    window._selectedAggIndex = 'custom';
    window._customAggText = '';

    const headerText = document.getElementById('agg-header-text');
    if (headerText) {
        headerText.textContent = 'Свій агрегат';
        headerText.style.color = '#333';
    }

    const panel = document.getElementById('agg-dropdown-panel');
    if (panel) panel.style.display = 'none';

    onSelectedEquipmentChange();
}

function selectAggItem(index, titleText) {
    window._selectedAggIndex = index;
    window._customAggText = '';

    const headerText = document.getElementById('agg-header-text');
    if (headerText) {
        headerText.textContent = titleText;
        headerText.style.color = '#333';
    }

    const panel = document.getElementById('agg-dropdown-panel');
    if (panel) panel.style.display = 'none';

    onSelectedEquipmentChange();
}

function selectCustomAggText(customText) {
    window._selectedAggIndex = -1;
    window._customAggText = customText;

    const headerText = document.getElementById('agg-header-text');
    if (headerText) {
        headerText.textContent = customText;
        headerText.style.color = '#333';
    }

    const panel = document.getElementById('agg-dropdown-panel');
    if (panel) panel.style.display = 'none';

    onSelectedEquipmentChange();
}

function getSelectedEquipment() {
    if (window._selectedAggIndex === 'custom') {
        const cons = parseFloat(document.getElementById('custom-cons-input')?.value) || 3.0;
        const oil = parseFloat(document.getElementById('custom-oil-input')?.value) || 1.0;
        return {
            model: 'Свій агрегат',
            category: 'Власний',
            consumption: cons,
            oilNorm10Days: oil,
            fuelType: 'ДП',
            subdivision: 'РМТЗ'
        };
    }
    if (window._selectedAggIndex !== null && window._selectedAggIndex >= 0 && window._allCalculatedEquipment) {
        return window._allCalculatedEquipment[window._selectedAggIndex];
    }
    if (window._customAggText) {
        return {
            model: window._customAggText,
            category: 'Власне обладнання',
            consumption: 3.33,
            oilNorm10Days: 1.1,
            fuelType: 'ДП',
            subdivision: 'РМТЗ'
        };
    }
    const cons = parseFloat(document.getElementById('custom-cons-input')?.value) || 3.33;
    const oil = parseFloat(document.getElementById('custom-oil-input')?.value) || 1.1;
    return {
        model: 'Свій агрегат',
        category: 'Власний',
        consumption: cons,
        oilNorm10Days: oil,
        fuelType: 'ДП',
        subdivision: 'РМТЗ'
    };
}

function onSelectedEquipmentChange() {
    const infoBox = document.getElementById('eq-rates-info-box');
    if (!infoBox) return;

    if (window._selectedAggIndex === 'custom') {
        infoBox.innerHTML = `
            <div style="display: flex; gap: 8px; align-items: center; width: 100%; font-size: 11px;">
                <div><strong>Розхід:</strong> <input type="number" id="custom-cons-input" value="3.33" step="0.1" min="0.1" oninput="calculateFromHours()" style="width: 50px; padding: 3px; font-size: 11px; border: 1px solid #bdc3c7; border-radius: 3px;"> л/год</div>
                <div><strong>Мастило(10д):</strong> <input type="number" id="custom-oil-input" value="1.1" step="0.1" min="0" oninput="calculateFromHours()" style="width: 50px; padding: 3px; font-size: 11px; border: 1px solid #bdc3c7; border-radius: 3px;"> л</div>
            </div>
        `;
        calculateFromHours();
        return;
    }

    const eq = getSelectedEquipment();
    if (!eq) return;

    if (eq.motoHoursDay) {
        const hoursInput = document.getElementById('calc-hours-per-day');
        if (hoursInput) hoursInput.value = eq.motoHoursDay;
    }

    const hourlyConsumption = parseFloat(eq.consumption) || 0;
    const oilNorm = parseFloat(eq.oilNorm10Days) || 0;

    infoBox.innerHTML = `
        <span><strong>Розхід:</strong> <span style="color: #c0392b;">${hourlyConsumption} л/год</span></span>
        <span><strong>Мастило (10 дн):</strong> <span style="color: #2980b9;">${oilNorm > 0 ? oilNorm + ' л' : '—'}</span></span>
    `;

    calculateFromHours();
}

function triggerRecalc() {
    calculateFromFuel();
}

function calculateFromHours() {
    const eq = getSelectedEquipment();
    if (!eq) return;

    let hoursPerDay = parseFloat(document.getElementById('calc-hours-per-day').value) || 0;
    let daysCount = parseInt(document.getElementById('calc-days-count').value) || 1;
    if (daysCount > 31) daysCount = 31;

    const hourlyRate = parseFloat(eq.consumption) || 0;
    const totalMotoHours = hoursPerDay * daysCount;
    const totalFuel = hourlyRate * totalMotoHours;

    const fuelInput = document.getElementById('calc-fuel-input');
    const fuelDaysInput = document.getElementById('calc-fuel-days-count');
    if (fuelInput) fuelInput.value = totalFuel > 0 ? totalFuel.toFixed(1) : '';
    if (fuelDaysInput) fuelDaysInput.value = daysCount;

    let baseOilNorm10Days = parseFloat(eq.oilNorm10Days) || 0;
    let totalOil = baseOilNorm10Days > 0 ? (baseOilNorm10Days / 120) * totalMotoHours : totalFuel * 0.025;

    let dailyFuels = [];
    let dailyHours = [];
    let dailyOils = [];
    for (let i = 0; i < daysCount; i++) {
        let f = hourlyRate * hoursPerDay;
        dailyFuels.push(f);
        dailyHours.push(hoursPerDay);
        dailyOils.push(totalOil / daysCount);
    }

    displayCalcResults(eq, totalMotoHours, daysCount, totalFuel, totalOil, dailyFuels, dailyHours, dailyOils);
}

function calculateFromFuel() {
    const eq = getSelectedEquipment();
    if (!eq) return;

    const totalFuel = parseFloat(document.getElementById('calc-fuel-input').value) || 0;
    let daysCount = parseInt(document.getElementById('calc-fuel-days-count').value) || 10;
    if (daysCount > 31) daysCount = 31;
    if (daysCount < 1) daysCount = 1;

    let maxDailyHours = parseFloat(document.getElementById('calc-max-daily-hours')?.value) || 24;
    const hourlyRate = parseFloat(eq.consumption) || 0;
    if (hourlyRate <= 0 || totalFuel <= 0) return;

    let dailyFuels = [];
    let allocatedSum = 0;

    for (let i = 0; i < daysCount; i++) {
        if (i === daysCount - 1) {
            let rest = totalFuel - allocatedSum;
            let maxRest = hourlyRate * maxDailyHours;
            if (rest > maxRest) rest = maxRest;
            dailyFuels.push(Math.round(rest * 10) / 10);
        } else {
            let w = Math.random() * 0.6 + 0.7;
            let f = (totalFuel / daysCount) * w;
            let maxDayFuel = hourlyRate * maxDailyHours;
            if (f > maxDayFuel) f = maxDayFuel;
            
            let rounded = Math.round(f * 10) / 10;
            dailyFuels.push(rounded);
            allocatedSum += rounded;
        }
    }

    let currentSum = dailyFuels.reduce((a, b) => a + b, 0);
    let diff = Math.round((totalFuel - currentSum) * 10) / 10;
    if (diff !== 0) {
        dailyFuels[daysCount - 1] = Math.round((dailyFuels[daysCount - 1] + diff) * 10) / 10;
        if (dailyFuels[daysCount - 1] < 0) dailyFuels[daysCount - 1] = 0;
    }

    let totalMotoHours = 0;
    let dailyHours = [];
    let dailyOils = [];

    let baseOilNorm10Days = parseFloat(eq.oilNorm10Days) || 0;
    let totalOil = baseOilNorm10Days > 0 ? (baseOilNorm10Days / 120) * (totalFuel / hourlyRate) : totalFuel * 0.025;

    for (let i = 0; i < daysCount; i++) {
        let dHours = dailyFuels[i] / hourlyRate;
        if (dHours > maxDailyHours) {
            dHours = maxDailyHours;
            dailyFuels[i] = Math.round((dHours * hourlyRate) * 10) / 10;
        }
        totalMotoHours += dHours;
        let dOil = totalOil * (dailyFuels[i] / totalFuel);
        dailyHours.push(dHours);
        dailyOils.push(dOil);
    }

    const hoursPerDayInput = document.getElementById('calc-hours-per-day');
    if (hoursPerDayInput) {
        hoursPerDayInput.value = (totalMotoHours / daysCount).toFixed(1);
    }

    displayCalcResults(eq, totalMotoHours, daysCount, totalFuel, totalOil, dailyFuels, dailyHours, dailyOils);
}

function displayCalcResults(eq, totalMotoHours, daysCount, totalFuel, totalOil, dailyFuels, dailyHours, dailyOils) {
    const box = document.getElementById('calc-details-box');
    if (!box) return;

    const hourlyRate = parseFloat(eq.consumption) || 0;
    const avgFuelPerDay = totalFuel / (daysCount || 1);
    const avgOilPerDay = totalOil / (daysCount || 1);

    let dailyTableRows = '';
    for (let day = 0; day < daysCount; day++) {
        dailyTableRows += '<tr>' +
            '<td style="text-align: center; padding: 5px; border-bottom: 1px solid #e0e0e0;"><strong>День ' + (day + 1) + '</strong></td>' +
            '<td style="text-align: center; padding: 5px; border-bottom: 1px solid #e0e0e0;">' + dailyHours[day].toFixed(1) + ' год</td>' +
            '<td style="text-align: center; padding: 5px; border-bottom: 1px solid #e0e0e0; color: #c0392b; font-weight: bold;">' + dailyFuels[day].toFixed(1) + ' л</td>' +
            '<td style="text-align: center; padding: 5px; border-bottom: 1px solid #e0e0e0; color: #2980b9;">' + dailyOils[day].toFixed(2) + ' л</td>' +
            '</tr>';
    }

    box.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center; margin-bottom: 20px;">
            <div style="background: white; padding: 12px; border-radius: 4px; border: 1px solid #dcdcdc;">
                <div style="color: #7f8c8d; font-size: 11px;">Загалом мото-годин</div>
                <div style="font-weight: bold; color: #2c3e50; font-size: 16px; margin-top: 4px;">${totalMotoHours.toFixed(1)} год</div>
                <div style="color: #2e7d32; font-size: 11px; margin-top: 2px;">За ${daysCount} днів</div>
            </div>
            <div style="background: white; padding: 12px; border-radius: 4px; border: 1px solid #dcdcdc;">
                <div style="color: #7f8c8d; font-size: 11px;">Всього палива (${eq.fuelType || 'ДП'})</div>
                <div style="font-weight: bold; color: #c0392b; font-size: 18px; margin-top: 4px;">${totalFuel.toFixed(1)} л</div>
                <div style="color: #7f8c8d; font-size: 11px; margin-top: 2px;">Сер. розхід: ${avgFuelPerDay.toFixed(1)} л/день</div>
            </div>
            <div style="background: white; padding: 12px; border-radius: 4px; border: 1px solid #dcdcdc;">
                <div style="color: #7f8c8d; font-size: 11px;">Всього мастила</div>
                <div style="font-weight: bold; color: #2980b9; font-size: 18px; margin-top: 4px;">${totalOil.toFixed(2)} л</div>
                <div style="color: #7f8c8d; font-size: 11px; margin-top: 2px;">Сер. розхід: ${avgOilPerDay.toFixed(2)} л/день</div>
            </div>
        </div>

        <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #dcdcdc;">
            <h4 style="color: #2c3e50; margin-top: 0; margin-bottom: 10px; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 5px;">Поденний хаотичний розклад витрати (${eq.model}):</h4>
            <div style="max-height: 300px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background: #2e7d32; color: white;">
                            <th style="padding: 6px; text-align: center;">Період</th>
                            <th style="padding: 6px; text-align: center;">Мото-години</th>
                            <th style="padding: 6px; text-align: center;">Витрата палива</th>
                            <th style="padding: 6px; text-align: center;">Витрата мастила</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dailyTableRows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function printAggregatesReport() {
    const box = document.getElementById('calc-details-box');
    const eq = getSelectedEquipment();

    if (!box || !eq || !box.innerHTML.trim() || box.innerHTML.includes('Оберіть обладнання')) {
        alert('Будь ласка, оберіть агрегат та виконайте розрахунок перед друком.');
        return;
    }

    const headerText = document.getElementById('agg-header-text');
    const eqName = headerText ? headerText.textContent : 'Агрегат';

    let printContent = box.innerHTML.replace(/max-height:\s*300px;\s*overflow-y:\s*auto;/g, 'max-height: none; overflow: visible;');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Розрахунок витрати палива та мастил — ${eqName}</title>
                <style>
                    @page { size: portrait; margin: 6mm 10mm; }
                    body { font-family: Arial, sans-serif; padding: 5px; color: #333; margin: 0; font-size: 11px; }
                    h2 { text-align: center; color: #2e7d32; margin: 0 0 8px 0; font-size: 16px; }
                    .subtitle { text-align: center; color: #555; margin-bottom: 10px; font-size: 11px; }
                    
                    /* Компактні блоки підсумків для єдиного листа */
                    div[style*="grid-template-columns"] {
                        gap: 6px !important;
                        margin-bottom: 10px !important;
                    }
                    div[style*="background: white; padding: 12px"] {
                        padding: 6px !important;
                    }

                    h4 { font-size: 12px !important; margin-bottom: 6px !important; }

                    table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 11px; }
                    tr { page-break-inside: avoid; }
                    th, td { border: 1px solid #bdc3c7; padding: 3px 5px !important; text-align: center; }
                    th { background: #2e7d32 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                </style>
            </head>
            <body>
                <h2>Розрахунок витрати палива та мастил агрегатів</h2>
                <div class="subtitle"><strong>Обладнання:</strong> ${eqName} | <strong>Розхід:</strong> ${eq.consumption} л/год</div>
                ${printContent}
                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}