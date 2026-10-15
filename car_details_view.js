// ==========================================
// МОДУЛЬ ДЕТАЛЬНОЇ КАРТКИ ТА ЗВІТІВ АВТОМОБІЛЯ (car_details_view.js)
// ==========================================

window.activeReportCarId = null; 

// Допоміжна функція для визначення ключа категорії автомобіля
function resolveCarCategoryKey(car) {
    if (!car) return 'passenger';
    const cat = String(car.category || '').toLowerCase().trim();
    if (cat === 'adblue' || cat === 'truck_adblue') return 'adblue';

    // Для вантажних автомобілів: якщо є AdBlue -> adblue, якщо немає -> truck
    const isTruckLike = (cat === 'truck' || String(car.vehicleType || '').toLowerCase().includes('вантаж'));
    if (isTruckLike) {
        return car.hasAdBlue ? 'adblue' : 'truck';
    }

    const validKeys = ['passenger', 'truck', 'adblue', 'suv', 'minibus', 'miles', 'hq', 'special', 'motorcycle', 'quad'];
    if (validKeys.includes(cat)) {
        return cat;
    }

    // Якщо car.category порожнє або українською — визначаємо за властивостями авто
    if (car.isMiles) return 'miles';
    if (car.hasAdBlue) return 'adblue';

    const vType = String(car.vehicleType || '').toLowerCase().trim();
    if (vType.includes('вантаж')) return 'truck';
    if (vType.includes('мото')) return 'motorcycle';
    if (vType.includes('квадро')) return 'quad';
    return 'passenger';
}

// Заповнення списків категорій (якщо ще не заповнені або застарілі)
function ensureCategoryDropdownsPopulated() {
    const categoriesMap = (typeof VEHICLE_CATEGORIES !== 'undefined') ? VEHICLE_CATEGORIES : {
        PASSENGER: "Легкові автомобілі",
        TRUCK: "Вантажні автомобілі",
        ADBLUE: "Вантажні автомобілі з AdBlue",
        SUV: "Позашляховики",
        MINIBUS: "Мікроавтобуси",
        MILES: "Автомобілі з милями",
        HQ: "Штабні автомобілі",
        SPECIAL: "Спецтехніка",
        MOTORCYCLE: "Мотоцикли",
        QUAD: "Квадроцикли"
    };

    ['det-input-category', 'card-input-category'].forEach(selectId => {
        const selectEl = document.getElementById(selectId);
        if (selectEl) {
            const hasNewText = Array.from(selectEl.options).some(o => o.textContent === "Вантажні автомобілі з AdBlue");
            if (selectEl.options.length === 0 || !hasNewText) {
                const currentVal = selectEl.value;
                selectEl.innerHTML = '';
                for (let key in categoriesMap) {
                    let opt = document.createElement('option');
                    opt.value = key.toLowerCase();
                    opt.textContent = categoriesMap[key];
                    selectEl.appendChild(opt);
                }
                if (currentVal) selectEl.value = currentVal;
            }
        }
    });
}

// Точне відкриття звіту за унікальним ID автомобіля
window.openCarDetails = function(carId) {
    window.activeReportCarId = Number(carId);
    window.currentCarId = Number(carId);
    activeDetailCarId = Number(carId);
    
    let sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const car = sourceCars.find(c => Number(c.id) === window.activeReportCarId);
    
    if (!car) {
        alert("Помилка: автомобіль з таким ID не знайдено в базі!");
        return;
    }

    ensureCategoryDropdownsPopulated();

    document.querySelectorAll('.view-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });

    const detSec = document.getElementById('car-details-view');
    if (detSec) {
        detSec.classList.add('active');
        detSec.style.display = 'block';
    }

    const topSearchBox = document.getElementById('top-search-box');
    if (topSearchBox) topSearchBox.style.display = 'none';

    document.querySelectorAll('.top-nav .nav-btn, .nav-btn').forEach(btn => btn.classList.remove('active'));

    renderCarDetailsData();
};

function getActiveReportCar() {
    if (typeof carsData === 'undefined' || !Array.isArray(carsData)) return null;
    return carsData.find(c => Number(c.id) === Number(window.activeReportCarId)) || null;
}

function renderCarDetailsData() {
    const car = getActiveReportCar();
    if (!car) return;

    ensureCategoryDropdownsPopulated();

    const modelInput = document.getElementById('det-input-model');
    const plateInput = document.getElementById('det-input-plate');
    const subInput = document.getElementById('det-input-subdivision');
    const driverInput = document.getElementById('det-input-driver');

    if (modelInput) modelInput.value = car.model || '';
    if (plateInput) plateInput.value = car.plate || '';
    if (subInput) subInput.value = car.subdivision || '';
    if (driverInput) driverInput.value = car.driver || '';

    const subSpan = document.getElementById('detail-car-sub');
    if (subSpan) subSpan.textContent = car.subdivision || '—';

    const fuelSpan = document.getElementById('detail-car-fuel');
    if (fuelSpan) fuelSpan.textContent = car.fuelType || car.fuel || 'ДП';

    const fieldsMap = {
        'vin': car.vin,
        'year': car.year,
        'transmission': car.transmission,
        'tank': car.tankCapacity !== undefined ? car.tankCapacity : car.tank,
        'drive': car.drive,
        'emptyWeight': car.emptyWeight,
        'totalWeight': car.totalWeight,
        'gears': car.gears,
        'engine': car.engineVolume !== undefined ? car.engineVolume : car.engine,
        'kw': car.kw,
        'engineNo': car.engineNo,
        'consumption': car.consumption,
        'fuelType': car.fuelType || car.fuel || 'ДП'
    };

    for (let key in fieldsMap) {
        const el = document.getElementById('det-input-' + key);
        if (el) {
            el.value = fieldsMap[key] !== undefined && fieldsMap[key] !== null ? fieldsMap[key] : '';
        }
    }

    // Встановлюємо поточну категорію у випадаючий список
    const catSelect = document.getElementById('det-input-category');
    if (catSelect) {
        const resolvedCat = resolveCarCategoryKey(car);
        car.category = resolvedCat;
        catSelect.value = resolvedCat;
    }

    renderCarPeriodsAndStats(car);
    renderCarDocuments(car);
}

// Пряме оновлення характеристик активного авто та миттєве збереження
window.updateCarPropertyFromDetails = function(prop, val) {
    let car = getActiveReportCar();
    if (!car) return;

    if (prop === 'model') car.model = val;
    else if (prop === 'plate') car.plate = val;
    else if (prop === 'subdivision') {
        car.subdivision = val;
        const subSpan = document.getElementById('detail-car-sub');
        if (subSpan) subSpan.textContent = val || '—';
    }
    else if (prop === 'driver') car.driver = val;
    else if (prop === 'fuelType') {
        car.fuelType = val;
        car.fuel = val;
        const fuelSpan = document.getElementById('detail-car-fuel');
        if (fuelSpan) fuelSpan.textContent = val || '—';
        const detFuelInput = document.getElementById('det-input-fuelType');
        if (detFuelInput && detFuelInput !== document.activeElement) detFuelInput.value = val;
        const cardFuelInput = document.getElementById('card-input-fuel-type');
        if (cardFuelInput) cardFuelInput.value = val;
        const specFuel = document.getElementById('spec-fuel-type');
        if (specFuel) specFuel.textContent = val || '—';
    }
    else if (prop === 'vin') car.vin = val;
    else if (prop === 'year') car.year = parseInt(val, 10) || val;
    else if (prop === 'transmission') car.transmission = val;
    else if (prop === 'tankCapacity') car.tankCapacity = parseFloat(val) || val;
    else if (prop === 'drive') car.drive = val;
    else if (prop === 'emptyWeight') car.emptyWeight = parseFloat(val) || val;
    else if (prop === 'totalWeight') car.totalWeight = parseFloat(val) || val;
    else if (prop === 'gears') car.gears = parseInt(val, 10) || val;
    else if (prop === 'engineVolume') car.engineVolume = parseFloat(val) || val;
    else if (prop === 'kw') car.kw = parseFloat(val) || val;
    else if (prop === 'engineNo') car.engineNo = val;
    else if (prop === 'consumption') car.consumption = parseFloat(val) || val;

    if (typeof saveCarsToStorage === 'function') saveCarsToStorage();
    if (typeof saveCarsModificationsToStorage === 'function') saveCarsModificationsToStorage();
    if (typeof renderCarsTable === 'function') renderCarsTable();
};

window.updateCardFuelType = function(val) {
    let car = getActiveReportCar();
    if (!car && typeof currentCarId !== 'undefined' && currentCarId) {
        const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
        car = sourceCars.find(c => Number(c.id) === Number(currentCarId));
    }
    if (!car) return;

    car.fuelType = val;
    car.fuel = val;

    const specFuel = document.getElementById('spec-fuel-type');
    if (specFuel) specFuel.textContent = val || '—';

    const detFuelInput = document.getElementById('det-input-fuelType');
    if (detFuelInput) detFuelInput.value = val;

    const detFuelSpan = document.getElementById('detail-car-fuel');
    if (detFuelSpan) detFuelSpan.textContent = val || '—';

    if (typeof saveCarsToStorage === 'function') saveCarsToStorage();
    if (typeof saveCarsModificationsToStorage === 'function') saveCarsModificationsToStorage();
    if (typeof renderCarsTable === 'function') renderCarsTable();
};

// Оновлення категорії прямо зі звіту автомобіля
window.updateCarCategoryFromDetails = function(newCategoryKey) {
    let car = getActiveReportCar();
    if (!car || !newCategoryKey) return;

    if (typeof applyCategoryChangesToCar === 'function') {
        applyCategoryChangesToCar(car, newCategoryKey);
    } else {
        car.category = newCategoryKey.toLowerCase();
    }

    if (typeof saveCarsToStorage === 'function') saveCarsToStorage();
    if (typeof saveCarsModificationsToStorage === 'function') saveCarsModificationsToStorage();
    if (typeof renderCarsTable === 'function') renderCarsTable();

    // Також оновлюємо картку авто, якщо воно зараз вибране
    if (typeof currentCarId !== 'undefined' && Number(currentCarId) === Number(car.id)) {
        const cardCatSelect = document.getElementById('card-input-category');
        if (cardCatSelect) cardCatSelect.value = car.category;
    }
};

window.saveCarDetailsToBasePath = function() {
    let car = getActiveReportCar();
    if (!car) {
        alert("Помилка: автомобіль не обрано!");
        return;
    }

    const catSelect = document.getElementById('det-input-category');
    if (catSelect && catSelect.value) {
        if (typeof applyCategoryChangesToCar === 'function') {
            applyCategoryChangesToCar(car, catSelect.value);
        } else {
            car.category = catSelect.value;
        }
    }

    if (typeof saveCarsToStorage === 'function') saveCarsToStorage();
    if (typeof saveCarsModificationsToStorage === 'function') saveCarsModificationsToStorage();
    if (typeof renderCarsTable === 'function') renderCarsTable();

    alert(`Зміни для автомобіля "${car.plate}" успішно збережено в базу!`);
    if (typeof switchView === 'function') switchView('base');
};

function renderCarPeriodsAndStats(car) {
    const periodsTbody = document.getElementById('det-periods-tbody');
    if (!periodsTbody) return;
    periodsTbody.innerHTML = '';

    let totalMileage = 0;
    let totalReceivedFuel = 0;
    let totalSpentFuel = 0;
    let totalReceivedAdBlue = 0;
    let latestLeftFuel = 0;
    let reportsCount = 0;

    let periods = [];
    if (typeof getSavedPeriodsList === 'function') {
        periods = getSavedPeriodsList();
    } else {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('report_data_')) {
                const p = key.replace('report_data_', '');
                if (!periods.includes(p)) periods.push(p);
            }
        }
    }

    // Також підтягуємо періоди, для яких збережені маршрути цього автомобіля
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('isolated_car_routes_') && k.endsWith('_' + car.id)) {
            const p = k.replace('isolated_car_routes_', '').replace('_' + car.id, '');
            if (p && !periods.includes(p)) {
                periods.push(p);
            }
        }
    }

    if (typeof sortPeriodsArray === 'function') {
        periods = sortPeriodsArray(periods);
    }

    const evalNum = function(val) {
        if (val === undefined || val === null || val === '') return 0;
        if (typeof evaluateExpression === 'function') {
            return evaluateExpression(val) || 0;
        }
        return parseFloat(val) || 0;
    };

    let periodsHtml = '';

    periods.forEach(period => {
        try {
            let rowData = null;
            let cardObj = null;

            const storedRep = localStorage.getItem('report_data_' + period);
            if (storedRep) {
                const repObj = JSON.parse(storedRep);
                if (repObj && repObj[car.id]) {
                    rowData = repObj[car.id];
                }
            }

            const storedCard = localStorage.getItem(`isolated_car_routes_${period}_${car.id}`);
            if (storedCard) {
                try {
                    cardObj = JSON.parse(storedCard);
                } catch(e) {}
            }

            if (rowData || (cardObj && (cardObj.rows?.length > 0 || cardObj.topFields))) {
                reportsCount++;

                // Одометри та пройдений кілометраж
                let prevOdo = '';
                let currOdo = '';

                if (rowData && rowData.prevOdo !== undefined && rowData.prevOdo !== '') {
                    prevOdo = rowData.prevOdo;
                } else if (cardObj && cardObj.topFields && cardObj.topFields.odo1 !== undefined && cardObj.topFields.odo1 !== '') {
                    prevOdo = cardObj.topFields.odo1;
                }

                if (rowData && rowData.odo !== undefined && rowData.odo !== '') {
                    currOdo = rowData.odo;
                } else if (cardObj && cardObj.topFields && cardObj.topFields.odo2 !== undefined && cardObj.topFields.odo2 !== '') {
                    currOdo = cardObj.topFields.odo2;
                }

                const prevOdoNum = parseFloat(prevOdo) || 0;
                const currOdoNum = parseFloat(currOdo) || 0;
                let driven = (currOdoNum > prevOdoNum) ? (currOdoNum - prevOdoNum) : 0;

                // Якщо одометр не заповнений, але є рядки маршрутів
                if (driven === 0 && cardObj && Array.isArray(cardObj.rows) && cardObj.rows.length > 0) {
                    let rKm = 0;
                    cardObj.rows.forEach(r => {
                        if (r.inputs && r.inputs[5]) rKm += parseFloat(r.inputs[5]) || 0;
                    });
                    if (rKm > 0) driven = rKm;
                }
                totalMileage += driven;

                // Отримано палива
                let refFuel = 0;
                if (rowData && rowData.refuelFuel !== undefined && rowData.refuelFuel !== '') {
                    refFuel = evalNum(rowData.refuelFuel);
                } else if (cardObj && cardObj.topFields && cardObj.topFields.fuelReceived !== undefined && cardObj.topFields.fuelReceived !== '') {
                    refFuel = evalNum(cardObj.topFields.fuelReceived);
                }
                totalReceivedFuel += refFuel;

                // Витрачено палива (визначається точно: з розрахунку маршрутів, збереженого fuelSpent, або з балансу палива)
                let periodSpent = 0;

                // 1. Пряме значення з картки авто (topFields.fuelSpent)
                if (cardObj && cardObj.topFields && cardObj.topFields.fuelSpent !== undefined && cardObj.topFields.fuelSpent !== '') {
                    const spVal = evalNum(cardObj.topFields.fuelSpent);
                    if (spVal > 0) periodSpent = spVal;
                }

                // 2. Розрахунок за формулами маршрутів для цього періоду
                if (!periodSpent && cardObj && Array.isArray(cardObj.rows) && cardObj.rows.length > 0 && typeof calculateRouteFuel === 'function') {
                    const cRes = calculateRouteFuel(cardObj.rows, car.consumption, car.formulas, car.isMiles);
                    if (cRes && cRes.totalFuel > 0) {
                        periodSpent = cRes.totalFuel;
                    }
                }

                // 3. Значення spentFuel із report_data
                if (!periodSpent && rowData && rowData.spentFuel !== undefined && rowData.spentFuel !== '') {
                    const spVal = evalNum(rowData.spentFuel);
                    if (spVal > 0) periodSpent = spVal;
                }

                // 4. Фізичний баланс: На початку + Отримано - Залишок
                if (!periodSpent) {
                    const pFuel = evalNum(rowData?.prevFuel || cardObj?.topFields?.fuelStart);
                    const lFuel = evalNum(rowData?.leftFuel || cardObj?.topFields?.savedFuelLeft);
                    if ((pFuel > 0 || refFuel > 0) && lFuel >= 0 && (pFuel + refFuel > lFuel)) {
                        periodSpent = (pFuel + refFuel) - lFuel;
                    }
                }

                // 5. Розрахунок за базовою нормою від пройденого кілометражу
                if (!periodSpent && driven > 0 && car.consumption > 0) {
                    periodSpent = (driven * parseFloat(car.consumption)) / 100;
                }

                totalSpentFuel += periodSpent;

                // Залишок палива на кінець періоду (визначається з report_data, картки або балансу)
                let periodLeftFuel = null;
                if (rowData && rowData.leftFuel !== undefined && rowData.leftFuel !== '') {
                    periodLeftFuel = evalNum(rowData.leftFuel);
                } else if (cardObj && cardObj.topFields && cardObj.topFields.savedFuelLeft !== undefined && cardObj.topFields.savedFuelLeft !== '') {
                    periodLeftFuel = evalNum(cardObj.topFields.savedFuelLeft);
                } else {
                    const pFuel = evalNum(rowData?.prevFuel || cardObj?.topFields?.fuelStart);
                    if (pFuel > 0 || refFuel > 0) {
                        periodLeftFuel = (pFuel + refFuel) - periodSpent;
                        if (periodLeftFuel < 0) periodLeftFuel = 0;
                    }
                }
                if (periodLeftFuel !== null) {
                    latestLeftFuel = periodLeftFuel;
                }

                // AdBlue
                let refAdBlue = 0;
                if (rowData && rowData.refuelAdBlue !== undefined && rowData.refuelAdBlue !== '') {
                    refAdBlue = evalNum(rowData.refuelAdBlue);
                } else if (cardObj && cardObj.topFields && cardObj.topFields.adblueReceived !== undefined && cardObj.topFields.adblueReceived !== '') {
                    refAdBlue = evalNum(cardObj.topFields.adblueReceived);
                }
                totalReceivedAdBlue += refAdBlue;

                const oilVal = (rowData && rowData.refuelOil) || '';
                const washerVal = (rowData && rowData.refuelWasher) || '';
                const noteVal = (rowData && rowData.note) || (cardObj && cardObj.topFields && cardObj.topFields.note) || '—';

                periodsHtml += `
                    <tr>
                        <td><strong>${period}</strong></td>
                        <td>${prevOdo || '—'}</td>
                        <td>${currOdo || '—'}</td>
                        <td><strong>${driven > 0 ? driven + ' км' : '0 км'}</strong></td>
                        <td style="color: #27ae60;">${refFuel > 0 ? refFuel + ' л' : '0'}</td>
                        <td style="color: #c0392b; font-weight: bold;">${periodSpent > 0 ? periodSpent.toFixed(1) + ' л' : '0 л'}</td>
                        <td style="color: #2980b9; font-weight: bold;">${periodLeftFuel !== null ? periodLeftFuel.toFixed(1) + ' л' : '—'}</td>
                        <td>${refAdBlue > 0 ? refAdBlue + ' л' : '0'}</td>
                        <td>${oilVal || '—'}</td>
                        <td>${washerVal || '—'}</td>
                        <td>${noteVal || '—'}</td>
                    </tr>
                `;
            }
        } catch(e) {}
    });

    if (periodsHtml === '') {
        periodsHtml = `<tr><td colspan="11" style="text-align: center; color: #7f8c8d; font-style: italic; padding: 15px;">Немає збережених звітів по цьому автомобілю в періодах</td></tr>`;
    }

    periodsTbody.innerHTML = periodsHtml;

    // Резервні джерела для визначення залишку палива, якщо в періодах він не зафіксований явно
    if (latestLeftFuel === 0) {
        if (typeof currentCarId !== 'undefined' && Number(currentCarId) === Number(car.id)) {
            const screenLeft = evalNum(document.getElementById('fuel-left')?.textContent);
            if (screenLeft > 0) {
                latestLeftFuel = screenLeft;
            }
        }
    }
    if (latestLeftFuel === 0) {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith('isolated_car_routes_') && k.endsWith('_' + car.id)) {
                try {
                    const c = JSON.parse(localStorage.getItem(k));
                    if (c && c.topFields) {
                        const sLeft = evalNum(c.topFields.savedFuelLeft);
                        if (sLeft > 0) {
                            latestLeftFuel = sLeft;
                            break;
                        }
                        const sStart = evalNum(c.topFields.fuelStart);
                        const sRec = evalNum(c.topFields.fuelReceived);
                        const sSpent = evalNum(c.topFields.fuelSpent);
                        if (sStart > 0 || sRec > 0) {
                            const diff = (sStart + sRec) - sSpent;
                            if (diff > 0) {
                                latestLeftFuel = diff;
                                break;
                            }
                        }
                    }
                } catch(e) {}
            }
        }
    }
    if (latestLeftFuel === 0 && (totalReceivedFuel - totalSpentFuel) > 0) {
        latestLeftFuel = totalReceivedFuel - totalSpentFuel;
    }

    const elMileage = document.getElementById('det-total-mileage');
    const elFuel = document.getElementById('det-total-fuel');
    const elSpent = document.getElementById('det-total-spent-fuel');
    const elLeftFuel = document.getElementById('det-current-left-fuel');
    const elAdblue = document.getElementById('det-total-adblue');
    const elCount = document.getElementById('det-reports-count');

    if (elMileage) elMileage.textContent = totalMileage + ' км';
    if (elFuel) elFuel.textContent = totalReceivedFuel.toFixed(1) + ' л';
    if (elSpent) elSpent.textContent = totalSpentFuel.toFixed(1) + ' л';
    if (elLeftFuel) elLeftFuel.textContent = latestLeftFuel.toFixed(1) + ' л';
    if (elAdblue) elAdblue.textContent = totalReceivedAdBlue.toFixed(1) + ' л';
    if (elCount) elCount.textContent = reportsCount;
}

function uploadCarDocument(input) {
    const files = input.files;
    let car = getActiveReportCar();
    if (!files || files.length === 0 || !car) return;
    
    const folderName = `Doc/${car.plate.replace(/[^a-zA-Z0-9А-Яа-яІіЇїЄє]/g, '_')}`;
    const storageKey = `car_folder_${car.id}`;
    let folderData = { path: folderName, files: [] };
    
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) folderData = JSON.parse(stored);
    } catch(e) {}

    let processedCount = 0;
    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        let reader = new FileReader();
        reader.onload = function(e) {
            folderData.files.push({
                name: file.name,
                size: (file.size / 1024).toFixed(1) + ' KB',
                date: new Date().toLocaleDateString(),
                dataUrl: e.target.result
            });
            processedCount++;
            if (processedCount === files.length) {
                localStorage.setItem(storageKey, JSON.stringify(folderData));
                input.value = '';
                renderCarDocuments(car);
            }
        };
        reader.readAsDataURL(file);
    }
}

function renderCarDocuments(car) {
    if (!car) return;
    const docsList = document.getElementById('car-docs-list');
    if (!docsList) return;

    const folderName = `Doc/${car.plate.replace(/[^a-zA-Z0-9А-Яа-яІіЇїЄє]/g, '_')}`;
    const storageKey = `car_folder_${car.id}`;
    let folderData = { path: folderName, files: [] };
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) folderData = JSON.parse(stored);
    } catch(e) {}

    let headerHtml = `<div style="margin-bottom: 8px; font-weight: bold; color: #2980b9; font-size: 12px;">📁 Шлях папки: ${folderData.path}</div>`;

    if (!folderData.files || folderData.files.length === 0) {
        docsList.innerHTML = headerHtml + '<span style="color: #7f8c8d; font-style: italic;">Папка порожня. Документи не завантажено.</span>';
        return;
    }

    let html = headerHtml + '<ul style="list-style-type: none; padding: 0; margin: 0;">';
    folderData.files.forEach((doc, idx) => {
        html += `<li style="padding: 6px 0; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; color: #2980b9;" onclick="viewCarDoc(${car.id}, ${idx})">📄 <strong>${doc.name}</strong> <small style="color: #7f8c8d;">(${doc.size})</small></span>
            <div style="display: flex; gap: 5px; flex-shrink: 0;">
                <button class="action-btn" style="padding: 2px 6px; font-size: 11px; background-color: #2980b9;" onclick="viewCarDoc(${car.id}, ${idx})">Переглянути</button>
                <button class="delete-row-btn" onclick="deleteCarDoc(${car.id}, ${idx})">Видалити</button>
            </div>
        </li>`;
    });
    html += '</ul>';
    docsList.innerHTML = html;
}

window.deleteCarDoc = function(carId, index) {
    let sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const car = sourceCars.find(c => Number(c.id) === Number(carId)) || getActiveReportCar();
    if (!car) return;

    const storageKey = `car_folder_${car.id}`;
    let folderData = { files: [] };
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) folderData = JSON.parse(stored);
    } catch(e) {}

    if (!folderData.files || !folderData.files[index]) return;

    const fileName = folderData.files[index].name || 'файл';
    const isConfirmed = confirm(`Дійсно видалити файл "${fileName}"?`);
    if (!isConfirmed) return;

    folderData.files.splice(index, 1);
    localStorage.setItem(storageKey, JSON.stringify(folderData));
    renderCarDocuments(car);
};

window.viewCarDoc = function(carId, index) {
    try {
        const stored = localStorage.getItem(`car_folder_${carId}`);
        if (!stored) return;
        const folderData = JSON.parse(stored);
        const doc = folderData.files[index];
        if (!doc || !doc.dataUrl) return;

        const isImage = doc.dataUrl.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.name);

        let win = null;
        try {
            win = window.open();
        } catch(e) {}

        if (win) {
            win.document.write(`
                <html>
                    <head><title>Перегляд: ${doc.name}</title></head>
                    <body style="margin:0; background:#222; display:flex; justify-content:center; align-items:center; height:100vh;">
                        ${isImage ? `<img src="${doc.dataUrl}" style="max-width:100%; max-height:100%; object-fit:contain;" />` : `<iframe src="${doc.dataUrl}" style="width:100%; height:100%; border:none;"></iframe>`}
                    </body>
                </html>
            `);
        } else {
            let modal = document.getElementById('car-doc-view-modal');
            if (modal) modal.remove();
            modal = document.createElement('div');
            modal.id = 'car-doc-view-modal';
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:99999; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:20px;';
            modal.innerHTML = `
                <div style="background:white; border-radius:8px; width:90%; max-width:900px; height:85vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.5);">
                    <div style="background:#2c3e50; color:white; padding:10px 16px; display:flex; justify-content:space-between; align-items:center;">
                        <strong>📄 ${doc.name}</strong>
                        <button onclick="document.getElementById('car-doc-view-modal').remove()" style="background:none; border:none; color:white; font-size:20px; cursor:pointer; font-weight:bold;">✕</button>
                    </div>
                    <div style="flex:1; display:flex; justify-content:center; align-items:center; background:#f4f6f7; overflow:auto; padding:10px;">
                        ${isImage ? `<img src="${doc.dataUrl}" style="max-width:100%; max-height:100%; object-fit:contain;" />` : `<iframe src="${doc.dataUrl}" style="width:100%; height:100%; border:none;"></iframe>`}
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
    } catch(e) {
        alert('Не вдалося відкрити документ.');
    }
};