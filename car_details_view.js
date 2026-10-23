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
    const role = (typeof window.getCurrentAppRole === 'function')
        ? window.getCurrentAppRole()
        : ((typeof currentRole !== 'undefined') ? currentRole : 'user');
    if (role !== 'developer' && typeof window.canRoleAccess === 'function' && !window.canRoleAccess(role, 'car_details')) {
        const roleName = (typeof getRoleDisplayName === 'function') ? getRoleDisplayName(role) : role;
        alert("⛔ Доступ до Детальної картки авто (ТТХ та Документи) заблоковано Розробником для вашої ролі (" + roleName + ")!");
        return;
    }

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
    if (typeof updateRoleUI === 'function') {
        updateRoleUI();
    }
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
        if (typeof currentCarId !== 'undefined' && Number(currentCarId) === Number(car.id)) {
            const specSub = document.getElementById('spec-subdivision');
            if (specSub) specSub.textContent = val || '—';
        }
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
        const specCat = document.getElementById('spec-category');
        if (specCat) {
            specCat.textContent = (typeof window.getCarCategoryDisplayName === 'function')
                ? window.getCarCategoryDisplayName(car)
                : car.category;
        }
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
// ==========================================
// УПРАВЛІННЯ ДОКУМЕНТАМИ ТА СКАНАМИ АВТОМОБІЛЯ
// ==========================================

const CAR_DOCS_IDB_NAME = 'CarDocsFilesDB_v2';
const CAR_DOCS_IDB_STORE = 'car_files';

function openCarDocsIDB() {
    return new Promise((resolve) => {
        if (!window.indexedDB) return resolve(null);
        try {
            const req = window.indexedDB.open(CAR_DOCS_IDB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(CAR_DOCS_IDB_STORE)) {
                    db.createObjectStore(CAR_DOCS_IDB_STORE, { keyPath: 'id' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
}

async function saveCarDocBinaryToIDB(docId, binaryObj, fromServer = false) {
    const db = await openCarDocsIDB();
    if (!db) return false;
    if (typeof window.archiveLocalSiteChange === 'function') {
        try { await window.archiveLocalSiteChange('CarDocsFilesDB_v2', docId, await getCarDocBinaryFromIDB(docId), { id: docId, ...binaryObj }); }
        catch (error) { console.error(error); return false; }
    }
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(CAR_DOCS_IDB_STORE, 'readwrite');
            const store = tx.objectStore(CAR_DOCS_IDB_STORE);
            store.put({ id: docId, ...binaryObj });
            tx.oncomplete = () => {
                if (!fromServer && typeof window.notifyPmmDocumentChange === 'function') window.notifyPmmDocumentChange(docId, false);
                resolve(true);
            };
            tx.onerror = () => resolve(false);
        } catch (err) {
            resolve(false);
        }
    });
}

async function getCarDocBinaryFromIDB(docId) {
    const db = await openCarDocsIDB();
    if (!db) return null;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(CAR_DOCS_IDB_STORE, 'readonly');
            const store = tx.objectStore(CAR_DOCS_IDB_STORE);
            const req = store.get(docId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        } catch (err) {
            resolve(null);
        }
    });
}

async function deleteCarDocBinaryFromIDB(docId, fromServer = false) {
    if (typeof window.archiveLocalSiteChange === 'function') {
        await window.archiveLocalSiteChange('CarDocsFilesDB_v2', docId, await getCarDocBinaryFromIDB(docId), null);
    }
    const db = await openCarDocsIDB();
    if (!db) throw new Error('Сховище файлів авто недоступне');
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CAR_DOCS_IDB_STORE, 'readwrite');
        tx.objectStore(CAR_DOCS_IDB_STORE).delete(docId);
        tx.oncomplete = () => {
            if (!fromServer && typeof window.notifyPmmDocumentChange === 'function') window.notifyPmmDocumentChange(docId, true);
            resolve();
        };
        tx.onerror = tx.onabort = () => reject(new Error('Файл авто не видалено зі сховища'));
    });
}

function getCarFileIcon(ext) {
    ext = (ext || '').toLowerCase();
    if (ext === 'pdf') return '📕';
    if (['doc', 'docx', 'rtf'].includes(ext)) return '📘';
    if (['xls', 'xlsx', 'csv', 'tsv'].includes(ext)) return '📊';
    if (['png', 'jpg', 'jpeg', 'webp', 'jfif', 'gif', 'svg', 'bmp'].includes(ext)) return '🖼️';
    if (['txt', 'json', 'log', 'xml', 'md'].includes(ext)) return '📄';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';
    if (['mp3', 'wav', 'ogg'].includes(ext)) return '🎵';
    if (['mp4', 'webm', 'mov'].includes(ext)) return '🎬';
    return '📁';
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
    const fileCount = files.length;
    function finishFile() {
        processedCount++;
        if (processedCount === fileCount) {
            try {
                localStorage.setItem(storageKey, JSON.stringify(folderData));
            } catch(quotaErr) {
                // Якщо localStorage переповнено, очищаємо dataUrl і зберігаємо тільки посилання на IDB
                const slimFiles = folderData.files.map(f => ({ ...f, dataUrl: '' }));
                localStorage.setItem(storageKey, JSON.stringify({ ...folderData, files: slimFiles }));
            }
            input.value = '';
            renderCarDocuments(car);
        }
    }
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = (file.name.includes('.') ? file.name.split('.').pop() : '').toLowerCase();
        const docId = 'cardoc_' + car.id + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

        const reader = new FileReader();
        reader.onload = async function(e) {
            const dataUrl = e.target.result;

            // Зберігаємо повний файл у IndexedDB
            const binarySaved = await saveCarDocBinaryToIDB(docId, {
                dataUrl: dataUrl,
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                ext: ext,
                size: (file.size / 1024).toFixed(1) + ' KB'
            });
            if (!binarySaved) { alert('Файл «' + file.name + '» не збережено. Перевірте вільне місце у браузері.'); finishFile(); return; }

            // У localStorage зберігаємо метадані та легкий dataUrl (якщо менше 120КБ)
            folderData.files.push({
                id: docId,
                name: file.name,
                ext: ext,
                size: (file.size / 1024).toFixed(1) + ' KB',
                date: new Date().toLocaleDateString('uk-UA'),
                hasBinary: true,
                dataUrl: dataUrl.length < 120000 ? dataUrl : ''
            });

            finishFile();
        };
        reader.onerror = function () { alert('Не вдалося прочитати файл «' + file.name + '».'); finishFile(); };
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

    let headerHtml = `
        <div style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
            <div style="font-weight:bold; color:#1e40af; font-size:12px;">📁 Шлях папки: <code>${folderData.path}</code></div>
            <span style="font-size:11px; background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; font-weight:700;">
                Файлів: ${(folderData.files || []).length}
            </span>
        </div>
    `;

    if (!folderData.files || folderData.files.length === 0) {
        docsList.innerHTML = headerHtml + '<div style="padding:16px; text-align:center; color:#64748b; font-style:italic; background:#fff; border-radius:6px; border:1px dashed #cbd5e1;">Папка документів порожня. Завантажте файл кнопкою «Вибрати файли» вгорі (підтримуються будь-які формати: PDF, Word, Excel, фото, скани).</div>';
        return;
    }

    let html = headerHtml + '<ul style="list-style-type:none; padding:0; margin:0; display:flex; flex-direction:column; gap:6px;">';
    folderData.files.forEach((doc, idx) => {
        const ext = (doc.ext || (doc.name.includes('.') ? doc.name.split('.').pop() : '') || 'файл').toLowerCase();
        const icon = getCarFileIcon(ext);

        html += `
            <li style="padding:8px 10px; background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; display:flex; justify-content:space-between; align-items:center; gap:10px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                <div style="display:flex; align-items:center; gap:8px; overflow:hidden; flex:1; cursor:pointer;" onclick="viewCarDoc(${car.id}, ${idx})">
                    <span style="font-size:18px; flex-shrink:0;">${icon}</span>
                    <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <span style="font-weight:700; color:#1e293b; font-size:13px;" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</span>
                        <div style="font-size:11px; color:#64748b; display:flex; gap:8px;">
                            <span>${doc.size || '—'}</span>
                            <span>•</span>
                            <span>${doc.date || '—'}</span>
                            <span style="background:#f1f5f9; color:#475569; padding:0 4px; border-radius:3px; text-transform:uppercase; font-weight:bold;">${ext}</span>
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:6px; flex-shrink:0; align-items:center;">
                    <button class="action-btn"
                        style="padding:5px 10px; font-size:12px; background-color:#2563eb; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:600; display:inline-flex; align-items:center; gap:4px;"
                        onclick="viewCarDoc(${car.id}, ${idx})"
                        title="Відкрити та переглянути файл у рідному форматі (${ext.toUpperCase()})">
                        👁️ Відкрити
                    </button>
                    <button class="action-btn"
                        style="padding:5px 10px; font-size:12px; background-color:#059669; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:600; display:inline-flex; align-items:center; gap:4px;"
                        onclick="downloadCarDoc(${car.id}, ${idx})"
                        title="Скачати файл на комп'ютер у вихідному форматі">
                        📥 Скачати
                    </button>
                    <button class="delete-row-btn"
                        style="padding:5px 8px; font-size:12px; background-color:#ef4444; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;"
                        onclick="deleteCarDoc(${car.id}, ${idx})"
                        title="Видалити цей файл">
                        🗑️
                    </button>
                </div>
            </li>
        `;
    });
    html += '</ul>';
    docsList.innerHTML = html;
}

window.deleteCarDoc = async function(carId, index) {
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

    const doc = folderData.files[index];
    const fileName = doc.name || 'файл';
    const isConfirmed = confirm(`Дійсно видалити файл «${fileName}» з папки авто?`);
    if (!isConfirmed) return;

    if (doc.id) {
        await deleteCarDocBinaryFromIDB(doc.id);
    }

    folderData.files.splice(index, 1);
    localStorage.setItem(storageKey, JSON.stringify(folderData));
    renderCarDocuments(car);
};

window.downloadCarDoc = async function(carId, index) {
    try {
        const stored = localStorage.getItem(`car_folder_${carId}`);
        if (!stored) return;
        const folderData = JSON.parse(stored);
        const doc = folderData.files[index];
        if (!doc) return;

        let dataUrl = doc.dataUrl || '';
        if (!dataUrl && doc.id) {
            const idbRecord = await getCarDocBinaryFromIDB(doc.id);
            if (idbRecord && idbRecord.dataUrl) {
                dataUrl = idbRecord.dataUrl;
            }
        }

        if (!dataUrl) {
            alert('Не вдалося отримати вміст файлу для завантаження.');
            return;
        }

        downloadUniversalFile(encodeURIComponent(dataUrl), encodeURIComponent(doc.name || 'document'));
    } catch(e) {
        console.error('Помилка скачування файлу авто:', e);
        alert('Помилка під час завантаження файлу.');
    }
};

window.viewCarDoc = async function(carId, index) {
    try {
        const stored = localStorage.getItem(`car_folder_${carId}`);
        if (!stored) return;
        const folderData = JSON.parse(stored);
        const doc = folderData.files[index];
        if (!doc) return;

        let dataUrl = doc.dataUrl || '';
        if (!dataUrl && doc.id) {
            const idbRecord = await getCarDocBinaryFromIDB(doc.id);
            if (idbRecord && idbRecord.dataUrl) {
                dataUrl = idbRecord.dataUrl;
            }
        }

        const ext = (doc.ext || (doc.name.includes('.') ? doc.name.split('.').pop() : '') || 'файл').toLowerCase();

        openUniversalFilePreviewModal({
            name: doc.name,
            ext: ext,
            dataUrl: dataUrl,
            size: doc.size,
            date: doc.date
        });
    } catch(e) {
        console.error('Помилка відкриття документа авто:', e);
        alert('Не вдалося відкрити документ.');
    }
};
