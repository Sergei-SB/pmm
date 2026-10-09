// ==========================================
// МОДУЛЬ АРХІВУ ПЕРІОДІВ АВТОМОБІЛЯ (car_history.js)
// ==========================================

let activeHistoryCarId = null;
let activeHistoryPeriod = "";

// Головна функція відкриття модального вікна архіву для конкретного авто
function openCarHistoryModal(carId) {
    activeHistoryCarId = carId;
    
    const periods = getCarHistoryPeriodsList();
    if (periods.length === 0) {
        alert("Немає збережених періодів у системі.");
        return;
    }
    
    activeHistoryPeriod = periods[0];
    
    renderCarHistoryModalHTML();
    loadCarHistoryDataIntoModal();
    
    const modal = document.getElementById('car-history-modal');
    if (modal) modal.style.display = 'flex';
}

function getCarHistoryPeriodsList() {
    let periods = [];
    try {
        if (typeof getSavedPeriodsList === 'function') {
            periods = getSavedPeriodsList();
        }
    } catch(e) {}
    if (!periods || periods.length === 0) {
        periods = ["01.10-10.10"];
    }
    return periods;
}

// Рендер розширеного каркаса модального вікна з формулами та маршрутами
function renderCarHistoryModalHTML() {
    let oldModal = document.getElementById('car-history-modal');
    if (oldModal) oldModal.remove();

    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const car = sourceCars.find(c => Number(c.id) === Number(activeHistoryCarId));
    const carTitle = car ? `${car.plate} — ${car.model}` : 'Автомобіль';

    const modalDiv = document.createElement('div');
    modalDiv.id = 'car-history-modal';
    modalDiv.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.6); z-index: 9999;
        display: flex; justify-content: center; align-items: center; padding: 15px;
    `;

    modalDiv.innerHTML = `
        <div style="background: white; width: 98%; max-width: 1350px; height: 95vh; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 5px 25px rgba(0,0,0,0.4);">
            
            <!-- Шапка модалки -->
            <div style="background: #2c3e50; color: white; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <h3 style="margin: 0; font-size: 16px;">Архів періодів авто: <span style="color: #f1c40f;">${carTitle}</span></h3>
                <button onclick="closeCarHistoryModal()" style="background: transparent; border: none; color: white; font-size: 22px; cursor: pointer; font-weight: bold;">&times;</button>
            </div>

            <!-- Панель управління періодами (скоригована: без випадаючого списку та стрілок) -->
            <div style="background: #ecf0f1; padding: 10px 20px; display: flex; justify-content: flex-end; align-items: center; border-bottom: 1px solid #bdc3c7; flex-wrap: wrap; gap: 10px; flex-shrink: 0;">
                <div style="display: flex; gap: 10px;">
                    <button class="action-btn" onclick="saveCarHistoryModalData()" style="background: #27ae60; padding: 6px 16px; font-size: 13px; font-weight: bold;">💾 Зберегти та перерахувати каскад</button>
                    <button class="action-btn" onclick="closeCarHistoryModal()" style="background: #e74c3c; padding: 6px 14px; font-size: 13px;">Закрити</button>
                </div>
            </div>

            <!-- Тіло модалки з повним розписом -->
            <div style="padding: 15px; overflow-y: auto; flex-grow: 1; background: #f8f9fa;" id="car-history-modal-body">
                <!-- Динамічно заповнюється -->
            </div>
        </div>
    `;

    document.body.appendChild(modalDiv);
}

function closeCarHistoryModal() {
    const modal = document.getElementById('car-history-modal');
    if (modal) modal.remove();
    if (typeof loadCarCard === 'function' && typeof currentCarId !== 'undefined' && currentCarId) {
        loadCarCard(currentCarId);
    }
    if (typeof renderReportTable === 'function') renderReportTable();
}

function onModalPeriodChange(val) {
    activeHistoryPeriod = val;
    loadCarHistoryDataIntoModal();
}

function navigateHistoryPeriod(direction) {
    const periods = getCarHistoryPeriodsList();
    let idx = periods.indexOf(activeHistoryPeriod);
    if (idx !== -1) {
        let newIdx = idx - direction; 
        if (newIdx >= 0 && newIdx < periods.length) {
            activeHistoryPeriod = periods[newIdx];
            loadCarHistoryDataIntoModal();
        }
    }
}

function getHistoryStorageKey(carId, period) {
    return `car_history_data_${carId}_${period}`;
}

// Завантаження повних даних у модальне вікно
function loadCarHistoryDataIntoModal() {
    const bodyContainer = document.getElementById('car-history-modal-body');
    if (!bodyContainer) return;

    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const car = sourceCars.find(c => Number(c.id) === Number(activeHistoryCarId));
    const isTruck = car ? (typeof isCarTruck === 'function' ? isCarTruck(car) : false) : false;

    const storageKey = getHistoryStorageKey(activeHistoryCarId, activeHistoryPeriod);
    let periodData = null;

    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            periodData = JSON.parse(stored);
        } else {
            periodData = getFallbackDataForPeriod(activeHistoryCarId, activeHistoryPeriod);
        }
    } catch(e) {
        periodData = getFallbackDataForPeriod(activeHistoryCarId, activeHistoryPeriod);
    }

    let routesRowsHtml = '';
    const routes = periodData.routes || [];
    
    routes.forEach((r, idx) => {
        if (isTruck) {
            routesRowsHtml += `
                <tr data-row-idx="${idx}">
                    <td><input type="text" class="table-cell-input hist-route-name" data-row="${idx}" value="${r.routeName || ''}" placeholder="Напр: Виконання БЗ Харків" oninput="recalcModalTotals()"></td>
                    <td><input type="text" class="table-cell-input hist-time" data-row="${idx}" value="${r.timeVal || '8:30'}" style="width: 65px; text-align: center;"></td>
                    <td><input type="text" class="table-cell-input hist-km-1" data-row="${idx}" value="${r.c1 || ''}" style="width: 70px; text-align: center;" oninput="recalcModalTotals()"></td>
                    <td><input type="text" class="table-cell-input hist-km-2" data-row="${idx}" value="${r.c2 || ''}" style="width: 70px; text-align: center;" oninput="recalcModalTotals()"></td>
                    <td><input type="text" class="table-cell-input hist-km-3" data-row="${idx}" value="${r.c3 || ''}" style="width: 70px; text-align: center;" oninput="recalcModalTotals()"></td>
                    <td><strong class="hist-row-total">0</strong></td>
                    <td><button class="delete-row-btn" onclick="this.closest('tr').remove(); recalcModalTotals()">X</button></td>
                    <td>
                        <select class="table-cell-input hist-cargo" data-row="${idx}">
                            <option value="o/c" ${r.cargoType === 'o/c' ? 'selected' : ''}>о/с</option>
                            <option value="БК" ${r.cargoType === 'БК' ? 'selected' : ''}>БК</option>
                            <option value="ПММ" ${r.cargoType === 'ПММ' ? 'selected' : ''}>ПММ</option>
                            <option value="РЕЧ" ${r.cargoType === 'РЕЧ' ? 'selected' : ''}>РЕЧ</option>
                            <option value="ПРОД" ${r.cargoType === 'ПРОД' ? 'selected' : ''}>ПРОД</option>
                            <option value="ІНШЕ" ${r.cargoType === 'ІНШЕ' ? 'selected' : ''}>ІНШЕ</option>
                        </select>
                    </td>
                    <td><input type="text" class="table-cell-input hist-tons" data-row="${idx}" value="${r.tons || ''}" style="width: 70px; text-align: center;" oninput="recalcModalTotals()"></td>
                    <td><strong class="hist-row-tkms">0</strong></td>
                    <td><strong class="hist-row-odo">0</strong></td>
                </tr>
            `;
        } else {
            routesRowsHtml += `
                <tr data-row-idx="${idx}">
                    <td><input type="text" class="table-cell-input hist-route-name" data-row="${idx}" value="${r.routeName || ''}" placeholder="Напр: Виконання БЗ Харків" oninput="recalcModalTotals()"></td>
                    <td><input type="text" class="table-cell-input hist-time" data-row="${idx}" value="${r.timeVal || '8:30'}" style="width: 75px; text-align: center;"></td>
                    <td><input type="text" class="table-cell-input hist-km-1" data-row="${idx}" value="${r.c1 || ''}" style="width: 80px; text-align: center;" oninput="recalcModalTotals()"></td>
                    <td><input type="text" class="table-cell-input hist-km-2" data-row="${idx}" value="${r.c2 || ''}" style="width: 80px; text-align: center;" oninput="recalcModalTotals()"></td>
                    <td><input type="text" class="table-cell-input hist-km-3" data-row="${idx}" value="${r.c3 || ''}" style="width: 80px; text-align: center;" oninput="recalcModalTotals()"></td>
                    <td><strong class="hist-row-total">0</strong></td>
                    <td><button class="delete-row-btn" onclick="this.closest('tr').remove(); recalcModalTotals()">X</button></td>
                    <td>
                        <select class="table-cell-input hist-cargo" data-row="${idx}">
                            <option value="o/c" ${r.cargoType === 'o/c' ? 'selected' : ''}>о/с</option>
                            <option value="БК" ${r.cargoType === 'БК' ? 'selected' : ''}>БК</option>
                            <option value="ПММ" ${r.cargoType === 'ПММ' ? 'selected' : ''}>ПММ</option>
                            <option value="РЕЧ" ${r.cargoType === 'РЕЧ' ? 'selected' : ''}>РЕЧ</option>
                            <option value="ПРОД" ${r.cargoType === 'ПРОД' ? 'selected' : ''}>ПРОД</option>
                            <option value="ІНШЕ" ${r.cargoType === 'ІНШЕ' ? 'selected' : ''}>ІНШЕ</option>
                        </select>
                    </td>
                    <td><strong class="hist-row-odo">0</strong></td>
                </tr>
            `;
        }
    });

    const theadHtml = isTruck ? `
        <tr>
            <th style="width: 250px;">Маршрути</th><th style="width: 65px;">Час</th><th style="width: 70px;">Вантаж</th><th style="width: 70px;">Пустий</th><th style="width: 70px;">Прицеп</th><th style="width: 70px;">Всього</th><th style="width: 45px;">Дія</th><th style="width: 75px;">Груз</th><th style="width: 75px;">Кількість, т</th><th style="width: 80px;">Т-км</th><th style="width: 80px;">Одометр</th>
        </tr>
    ` : `
        <tr>
            <th style="width: 300px;">Маршрути</th><th style="width: 75px;">Час</th><th style="width: 85px;">Вантаж</th><th style="width: 85px;">Пустий</th><th style="width: 85px;">Прицеп</th><th style="width: 85px;">Всього</th><th style="width: 50px;">Дія</th><th style="width: 85px;">Груз</th><th style="width: 95px;">Одометр</th>
        </tr>
    `;

    bodyContainer.innerHTML = `
        <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 15px;">
            <div style="background: white; border: 1px solid #bdc3c7; padding: 12px; border-radius: 5px; flex: 1; min-width: 260px;">
                <table style="width: 100%; font-size: 13px;">
                    <tr><th colspan="2" style="background: #2e7d32; color: white; padding: 5px;">Паливо</th></tr>
                    <tr><td>На початку:</td><td><input type="text" class="hist-input" data-field="fuelStart" value="${periodData.fuelStart || ''}" style="width: 100%; text-align: center;"></td></tr>
                    <tr><td>Отримано:</td><td><input type="text" class="hist-input" data-field="fuelReceived" value="${periodData.fuelReceived || ''}" style="width: 100%; text-align: center;"></td></tr>
                    <tr><td>Залишок:</td><td><strong id="hist-fuel-left">0.0</strong> л</td></tr>
                    <tr><td>Витрачено:</td><td><strong id="hist-fuel-spent">0.0</strong> л</td></tr>
                </table>
            </div>

            <div style="background: white; border: 1px solid #bdc3c7; padding: 12px; border-radius: 5px; flex: 1; min-width: 260px; display: ${car && car.hasAdBlue ? 'block' : 'none'};">
                <table style="width: 100%; font-size: 13px;">
                    <tr><th colspan="2" style="background: #2980b9; color: white; padding: 5px;">AdBlue</th></tr>
                    <tr><td>На початку:</td><td><input type="text" class="hist-input" data-field="adblueStart" value="${periodData.adblueStart || ''}" style="width: 100%; text-align: center;"></td></tr>
                    <tr><td>Отримано:</td><td><input type="text" class="hist-input" data-field="adblueReceived" value="${periodData.adblueReceived || ''}" style="width: 100%; text-align: center;"></td></tr>
                    <tr><td>Залишок:</td><td><strong id="hist-adblue-left">0.0</strong> л</td></tr>
                    <tr><td>Витрачено:</td><td><strong id="hist-adblue-spent">0.0</strong> л</td></tr>
                </table>
            </div>

            <div style="background: white; border: 1px solid #bdc3c7; padding: 12px; border-radius: 5px; flex: 1; min-width: 280px;">
                <table style="width: 100%; font-size: 13px;">
                    <tr><th colspan="2" style="background: #2e7d32; color: white; padding: 5px;">Одометри та рідини</th></tr>
                    <tr><td>Початковий одометр:</td><td><input type="text" class="hist-input" data-field="odo1" id="hist-odo1" value="${periodData.odo1 || ''}" style="width: 100%; text-align: center;" oninput="recalcModalTotals()"></td></tr>
                    <tr><td>Кінцевий одометр:</td><td><input type="text" class="hist-input" data-field="odo2" id="hist-odo2" value="${periodData.odo2 || ''}" style="width: 100%; text-align: center;" readonly></td></tr>
                    <tr><td>Мастило:</td><td><input type="text" class="hist-input" data-field="refuelOil" value="${periodData.refuelOil || ''}" style="width: 100%; text-align: center;"></td></tr>
                    <tr><td>Омивач:</td><td><input type="text" class="hist-input" data-field="refuelWasher" value="${periodData.refuelWasher || ''}" style="width: 100%; text-align: center;"></td></tr>
                </table>
            </div>
        </div>

        <div style="background: white; border: 1px solid #bdc3c7; padding: 12px; border-radius: 5px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h4 style="margin: 0; color: #2c3e50;">Маршрути та поїздки за період</h4>
                <button class="action-btn" onclick="addModalRouteRow(${isTruck})" style="padding: 4px 10px; font-size: 12px; background-color: #27ae60;">+ Додати рядок маршруту</button>
            </div>
            
            <div style="max-height: 250px; overflow-y: auto; border: 1px solid #ccc;">
                <table class="data-table" style="width: 100%; font-size: 11px;">
                    <thead>${theadHtml}</thead>
                    <tbody id="hist-routes-tbody">${routesRowsHtml}</tbody>
                </table>
            </div>

            <!-- Блок формул та швидких пресетів -->
            <div style="margin-top: 15px; border-top: 1px solid #bdc3c7; padding-top: 10px; display: flex; gap: 20px; flex-wrap: wrap; align-items: flex-start;">
                <div style="display: flex; flex-direction: column; gap: 6px; width: 220px; flex-shrink: 0;">
                    <button type="button" class="preset-btn" onclick="applyModalPreset('Виконання БЗ Харків')" style="background: #34495e; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">Виконання БЗ Харків</button>
                    <button type="button" class="preset-btn" onclick="applyModalPreset('Міста-мільйонники (Харків, Київ, Львів)')" style="background: #34495e; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">Міста-мільйонники (Харків, Київ, Львів)</button>
                </div>

                <div style="flex-grow: 1; font-size: 12px;">
                    <div id="hist-formulas-container" style="display: flex; flex-direction: column; gap: 4px; border-bottom: 1px solid #ddd; padding-bottom: 6px; margin-bottom: 6px;"></div>
                    <div style="font-weight: bold; display: flex; justify-content: space-between;">
                        <span>Всього пройдено: <strong id="hist-sum-km">0</strong> км</span>
                        <span>Витрачено палива: <strong id="hist-sum-fuel">0.00</strong> л &approx; <strong id="hist-sum-fuel-round">0</strong> л</span>
                    </div>
                    <div style="font-size: 11px; color: #666; margin-top: 2px;">Базова норма витрати: <span>${car ? car.consumption : 13}</span> л/100 км</div>
                </div>
            </div>
        </div>
    `;

    applyHistoryVisuals(periodData);
    recalcModalTotals();
}

// Додавання нового рядка маршруту у модалці
function addModalRouteRow(isTruck) {
    const tbody = document.getElementById('hist-routes-tbody');
    if (!tbody) return;
    const idx = tbody.rows.length;

    const tr = document.createElement('tr');
    tr.setAttribute('data-row-idx', idx);

    if (isTruck) {
        tr.innerHTML = `
            <td><input type="text" class="table-cell-input hist-route-name" data-row="${idx}" value="Виконання БЗ Харків" placeholder="Напр: Виконання БЗ Харків" oninput="recalcModalTotals()"></td>
            <td><input type="text" class="table-cell-input hist-time" data-row="${idx}" value="8:30" style="width: 65px; text-align: center;"></td>
            <td><input type="text" class="table-cell-input hist-km-1" data-row="${idx}" value="" style="width: 70px; text-align: center;" oninput="recalcModalTotals()"></td>
            <td><input type="text" class="table-cell-input hist-km-2" data-row="${idx}" value="" style="width: 70px; text-align: center;" oninput="recalcModalTotals()"></td>
            <td><input type="text" class="table-cell-input hist-km-3" data-row="${idx}" value="" style="width: 70px; text-align: center;" oninput="recalcModalTotals()"></td>
            <td><strong class="hist-row-total">0</strong></td>
            <td><button class="delete-row-btn" onclick="this.closest('tr').remove(); recalcModalTotals()">X</button></td>
            <td>
                <select class="table-cell-input hist-cargo" data-row="${idx}">
                    <option value="o/c">о/с</option><option value="БК">БК</option><option value="ПММ">ПММ</option><option value="РЕЧ">РЕЧ</option><option value="ПРОД">ПРОД</option><option value="ІНШЕ">ІНШЕ</option>
                </select>
            </td>
            <td><input type="text" class="table-cell-input hist-tons" data-row="${idx}" value="" style="width: 70px; text-align: center;" oninput="recalcModalTotals()"></td>
            <td><strong class="hist-row-tkms">0</strong></td>
            <td><strong class="hist-row-odo">0</strong></td>
        `;
    } else {
        tr.innerHTML = `
            <td><input type="text" class="table-cell-input hist-route-name" data-row="${idx}" value="Виконання БЗ Харків" placeholder="Напр: Виконання БЗ Харків" oninput="recalcModalTotals()"></td>
            <td><input type="text" class="table-cell-input hist-time" data-row="${idx}" value="8:30" style="width: 75px; text-align: center;"></td>
            <td><input type="text" class="table-cell-input hist-km-1" data-row="${idx}" value="" style="width: 80px; text-align: center;" oninput="recalcModalTotals()"></td>
            <td><input type="text" class="table-cell-input hist-km-2" data-row="${idx}" value="" style="width: 80px; text-align: center;" oninput="recalcModalTotals()"></td>
            <td><input type="text" class="table-cell-input hist-km-3" data-row="${idx}" value="" style="width: 80px; text-align: center;" oninput="recalcModalTotals()"></td>
            <td><strong class="hist-row-total">0</strong></td>
            <td><button class="delete-row-btn" onclick="this.closest('tr').remove(); recalcModalTotals()">X</button></td>
            <td>
                <select class="table-cell-input hist-cargo" data-row="${idx}">
                    <option value="o/c">о/с</option><option value="БК">БК</option><option value="ПММ">ПММ</option><option value="РЕЧ">РЕЧ</option><option value="ПРОД">ПРОД</option><option value="ІНШЕ">ІНШЕ</option>
                </select>
            </td>
            <td><strong class="hist-row-odo">0</strong></td>
        `;
    }
    tbody.appendChild(tr);
    recalcModalTotals();
}

function applyModalPreset(presetName) {
    const tbody = document.getElementById('hist-routes-tbody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    let targetRow = null;
    rows.forEach(r => {
        const inp = r.querySelector('.hist-route-name');
        if (inp && !inp.value.trim() && !targetRow) targetRow = r;
    });
    if (!targetRow && rows.length > 0) targetRow = rows[0];

    if (targetRow) {
        const nameInp = targetRow.querySelector('.hist-route-name');
        if (nameInp) nameInp.value = presetName;
        recalcModalTotals();
    }
}

// Перерахунок підсумків, одометрів та формул у модалці в реальному часі
function recalcModalTotals() {
    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const car = sourceCars.find(c => Number(c.id) === Number(activeHistoryCarId));
    const isTruck = car ? (typeof isCarTruck === 'function' ? isCarTruck(car) : false) : false;
    const baseRate = car ? (parseFloat(car.consumption) || 13.0) : 13.0;

    let totalKmSum = 0;
    let bzKm = 0, cityKm = 0, highwayKm = 0, cargoKm = 0, totalTkms = 0;

    let startOdo = parseFloat(document.getElementById('hist-odo1')?.value) || 0;
    let runningOdo = startOdo;

    const rows = document.querySelectorAll('#hist-routes-tbody tr');
    rows.forEach(row => {
        const c1 = parseFloat(row.querySelector('.hist-km-1')?.value.toString().replace(',', '.')) || 0;
        const c2 = parseFloat(row.querySelector('.hist-km-2')?.value.toString().replace(',', '.')) || 0;
        const c3 = parseFloat(row.querySelector('.hist-km-3')?.value.toString().replace(',', '.')) || 0;
        const rowSum = c1 + c2 + c3;

        const totalEl = row.querySelector('.hist-row-total');
        if (totalEl) totalEl.textContent = rowSum.toFixed(0);

        totalKmSum += rowSum;
        runningOdo += rowSum;

        const odoEl = row.querySelector('.hist-row-odo');
        if (odoEl) odoEl.textContent = runningOdo.toFixed(0);

        const routeName = (row.querySelector('.hist-route-name')?.value || '').toLowerCase();
        if (routeName.includes('бз') || routeName.includes('харків') || routeName.includes('бойов')) {
            bzKm += rowSum;
        } else if (routeName.includes('місто') || routeName.includes('київ') || routeName.includes('львів')) {
            cityKm += rowSum;
        } else {
            highwayKm += rowSum;
        }

        if (isTruck) {
            const tonsInp = row.querySelector('.hist-tons');
            const tons = tonsInp ? (parseFloat(tonsInp.value.toString().replace(',', '.')) || 0) : 0;
            const tkms = rowSum * tons;
            totalTkms += tkms;
            const tkmsEl = row.querySelector('.hist-row-tkms');
            if (tkmsEl) tkmsEl.textContent = tkms.toFixed(1);
            if (rowSum > 0 && tons > 0) cargoKm += rowSum;
        }
    });

    const odo2El = document.getElementById('hist-odo2');
    if (odo2El) odo2El.value = runningOdo > 0 ? runningOdo.toFixed(0) : '';

    // Формули палива
    const bzFuel = bzKm * (baseRate / 100) * 1.20;
    const cityFuel = cityKm * (baseRate / 100) * 1.05;
    const highwayFuel = highwayKm * (baseRate / 100) * 0.85;
    const cargoFuel = isTruck ? (totalTkms * 0.009) : 0;
    const adblueFuel = (car && car.hasAdBlue) ? (totalKmSum * 0.05) : 0;

    const totalFuelCalc = bzFuel + cityFuel + highwayFuel + cargoFuel;
    const roundFuel = Math.round(totalFuelCalc);

    // Відображення формул
    const formContainer = document.getElementById('hist-formulas-container');
    if (formContainer) {
        if (isTruck) {
            formContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between;"><span>Виконана робота: ${totalTkms.toFixed(1)} т-км</span><strong>${cargoFuel.toFixed(2)} л</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>БЗ: ${bzKm} км * ${baseRate}/100 + 20%</span><strong>${bzFuel.toFixed(2)} л</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>Місто: ${cityKm} км * ${baseRate}/100 + 5%</span><strong>${cityFuel.toFixed(2)} л</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>Траса: ${highwayKm} км * ${baseRate}/100 - 15%</span><strong>${highwayFuel.toFixed(2)} л</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>Перевезення вантажу: ${cargoKm} км * 0.9/100</span><strong>${cargoFuel.toFixed(2)} л</strong></div>
                ${car && car.hasAdBlue ? `<div style="display: flex; justify-content: space-between; color: #2980b9;"><span>Витрата AdBlue: ${totalKmSum} км * 0.05</span><strong>${adblueFuel.toFixed(2)} л</strong></div>` : ''}
            `;
        } else {
            formContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between;"><span>БЗ: ${bzKm} км * ${baseRate}/100 + 20%</span><strong>${bzFuel.toFixed(2)} л</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>Місто: ${cityKm} км * ${baseRate}/100 + 5%</span><strong>${cityFuel.toFixed(2)} л</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>Траса: ${highwayKm} км * ${baseRate}/100 - 15%</span><strong>${highwayFuel.toFixed(2)} л</strong></div>
                ${car && car.hasAdBlue ? `<div style="display: flex; justify-content: space-between; color: #2980b9;"><span>Витрата AdBlue: ${totalKmSum} км * 0.05</span><strong>${adblueFuel.toFixed(2)} л</strong></div>` : ''}
            `;
        }
    }

    if (document.getElementById('hist-sum-km')) document.getElementById('hist-sum-km').textContent = totalKmSum;
    if (document.getElementById('hist-sum-fuel')) document.getElementById('hist-sum-fuel').textContent = totalFuelCalc.toFixed(2);
    if (document.getElementById('hist-sum-fuel-round')) document.getElementById('hist-sum-fuel-round').textContent = roundFuel;

    if (document.getElementById('hist-fuel-spent')) document.getElementById('hist-fuel-spent').textContent = totalFuelCalc.toFixed(1);
    const fStart = parseFloat(document.querySelector('.hist-input[data-field="fuelStart"]')?.value) || 0;
    const fRec = parseFloat(document.querySelector('.hist-input[data-field="fuelReceived"]')?.value) || 0;
    if (document.getElementById('hist-fuel-left')) document.getElementById('hist-fuel-left').textContent = ((fStart + fRec) - totalFuelCalc).toFixed(1);

    if (car && car.hasAdBlue) {
        if (document.getElementById('hist-adblue-spent')) document.getElementById('hist-adblue-spent').textContent = adblueFuel.toFixed(1);
        const abStart = parseFloat(document.querySelector('.hist-input[data-field="adblueStart"]')?.value) || 0;
        const abRec = parseFloat(document.querySelector('.hist-input[data-field="adblueReceived"]')?.value) || 0;
        if (document.getElementById('hist-adblue-left')) document.getElementById('hist-adblue-left').textContent = ((abStart + abRec) - adblueFuel).toFixed(1);
    }
}

function getFallbackDataForPeriod(carId, period) {
    let data = { fuelStart: '', fuelReceived: '', adblueStart: '', adblueReceived: '', odo1: '', odo2: '', refuelOil: '', refuelWasher: '', routes: [], original: {} };
    try {
        const storedRep = localStorage.getItem('report_data_' + period);
        if (storedRep) {
            const repObj = JSON.parse(storedRep);
            if (repObj[carId]) {
                const r = repObj[carId];
                data.fuelStart = r.prevFuel || '';
                data.fuelReceived = r.refuelFuel || '';
                data.adblueStart = r.prevAdBlue || '';
                data.adblueReceived = r.refuelAdBlue || '';
                data.odo1 = r.prevOdo || '';
                data.odo2 = r.odo || '';
                data.refuelOil = r.refuelOil || '';
                data.refuelWasher = r.refuelWasher || '';
            }
        }
    } catch(e) {}
    
    data.routes = [
        { routeName: "Виконання БЗ Харків", timeVal: "8:30", c1: "", c2: "", c3: "", cargoType: "о/с", tons: "" },
        { routeName: "Виконання БЗ Харків", timeVal: "8:30", c1: "", c2: "", c3: "", cargoType: "о/с", tons: "" },
        { routeName: "Виконання БЗ Харків", timeVal: "8:30", c1: "", c2: "", c3: "", cargoType: "о/с", tons: "" },
        { routeName: "Виконання БЗ Харків", timeVal: "8:30", c1: "", c2: "", c3: "", cargoType: "о/с", tons: "" },
        { routeName: "Виконання БЗ Харків", timeVal: "8:30", c1: "", c2: "", c3: "", cargoType: "о/с", tons: "" },
        { routeName: "Виконання БЗ Харків", timeVal: "8:30", c1: "", c2: "", c3: "", cargoType: "о/с", tons: "" },
        { routeName: "Виконання БЗ Харків", timeVal: "8:30", c1: "", c2: "", c3: "", cargoType: "о/с", tons: "" }
    ];
    return data;
}

function applyHistoryVisuals(periodData) {
    const original = periodData.original || {};
    const inputs = document.querySelectorAll('#car-history-modal-body .hist-input');

    inputs.forEach(input => {
        const field = input.getAttribute('data-field');
        let origVal = original[field] !== undefined ? original[field] : '';

        if (origVal !== '' && String(input.value).trim() !== String(origVal).trim()) {
            input.style.backgroundColor = '#fff3cd';
            input.style.border = '1px solid #ffeeba';
            input.title = `Було до виправлення: "${origVal}"`;
            
            let parent = input.parentElement;
            if (parent && !parent.querySelector('.history-tip')) {
                let span = document.createElement('span');
                span.className = 'history-tip';
                span.style.cssText = 'font-size: 10px; color: #856404; display: block; margin-top: 1px;';
                span.textContent = `Було: ${origVal}`;
                parent.appendChild(span);
            }
        }
    });
}

// Збереження даних з модалки з урахуванням повних маршрутів і каскадним перерахунком
function saveCarHistoryModalData() {
    const storageKey = getHistoryStorageKey(activeHistoryCarId, activeHistoryPeriod);
    
    let oldData = null;
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) oldData = JSON.parse(stored);
    } catch(e) {}

    let original = oldData ? (oldData.original || {}) : {};
    if (!oldData || Object.keys(original).length === 0) {
        original = getFallbackDataForPeriod(activeHistoryCarId, activeHistoryPeriod);
    }

    let newData = {
        fuelStart: document.querySelector('.hist-input[data-field="fuelStart"]')?.value || '',
        fuelReceived: document.querySelector('.hist-input[data-field="fuelReceived"]')?.value || '',
        adblueStart: document.querySelector('.hist-input[data-field="adblueStart"]')?.value || '',
        adblueReceived: document.querySelector('.hist-input[data-field="adblueReceived"]')?.value || '',
        odo1: document.querySelector('.hist-input[data-field="odo1"]')?.value || '',
        odo2: document.querySelector('.hist-input[data-field="odo2"]')?.value || '',
        refuelOil: document.querySelector('.hist-input[data-field="refuelOil"]')?.value || '',
        refuelWasher: document.querySelector('.hist-input[data-field="refuelWasher"]')?.value || '',
        routes: [],
        original: original
    };

    const rows = document.querySelectorAll('#hist-routes-tbody tr');
    rows.forEach(tr => {
        newData.routes.push({
            routeName: tr.querySelector('.hist-route-name')?.value || '',
            timeVal: tr.querySelector('.hist-time')?.value || '8:30',
            c1: tr.querySelector('.hist-km-1')?.value || '',
            c2: tr.querySelector('.hist-km-2')?.value || '',
            c3: tr.querySelector('.hist-km-3')?.value || '',
            cargoType: tr.querySelector('.hist-cargo')?.value || 'о/с',
            tons: tr.querySelector('.hist-tons') ? tr.querySelector('.hist-tons').value : ''
        });
    });

    localStorage.setItem(storageKey, JSON.stringify(newData));
    syncHistoryDataToReport(activeHistoryCarId, activeHistoryPeriod, newData);
    runCascadeRecalculation(activeHistoryCarId, activeHistoryPeriod);

    alert(`Зміни для періоду "${activeHistoryPeriod}" успішно збережено, каскадний перерахунок виконано!`);
    loadCarHistoryDataIntoModal();
}

function syncHistoryDataToReport(carId, period, data) {
    const reportKey = 'report_data_' + period;
    let repObj = {};
    try {
        const stored = localStorage.getItem(reportKey);
        if (stored) repObj = JSON.parse(stored);
    } catch(e) {}

    if (!repObj[carId]) repObj[carId] = {};
    repObj[carId].prevFuel = data.fuelStart;
    repObj[carId].refuelFuel = data.fuelReceived;
    repObj[carId].prevAdBlue = data.adblueStart;
    repObj[carId].refuelAdBlue = data.adblueReceived;
    repObj[carId].prevOdo = data.odo1;
    repObj[carId].odo = data.odo2;
    repObj[carId].refuelOil = data.refuelOil;
    repObj[carId].refuelWasher = data.refuelWasher;

    localStorage.setItem(reportKey, JSON.stringify(repObj));
}

// Каскадний перерахунок одометрів для наступних періодів
function runCascadeRecalculation(carId, changedPeriod) {
    const periods = getCarHistoryPeriodsList();
    const idx = periods.indexOf(changedPeriod);
    if (idx === -1) return;

    for (let i = idx - 1; i >= 0; i--) {
        const currentPer = periods[i];
        const prevPer = periods[i + 1];

        let prevEndOdo = '';
        try {
            const prevStorageKey = getHistoryStorageKey(carId, prevPer);
            const prevData = JSON.parse(localStorage.getItem(prevStorageKey));
            if (prevData) prevEndOdo = prevData.odo2;
        } catch(e) {}

        if (!prevEndOdo) {
            try {
                const repPrev = JSON.parse(localStorage.getItem('report_data_' + prevPer));
                if (repPrev && repPrev[carId]) prevEndOdo = repPrev[carId].odo;
            } catch(e) {}
        }

        if (prevEndOdo) {
            try {
                const currStorageKey = getHistoryStorageKey(carId, currentPer);
                let currData = JSON.parse(localStorage.getItem(currStorageKey)) || getFallbackDataForPeriod(carId, currentPer);
                currData.odo1 = prevEndOdo;
                localStorage.setItem(currStorageKey, JSON.stringify(currData));
                syncHistoryDataToReport(carId, currentPer, currData);
            } catch(e) {}
        }
    }
}