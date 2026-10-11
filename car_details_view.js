// ==========================================
// МОДУЛЬ ДЕТАЛЬНОЇ КАРТКИ ТА ЗВІТІВ АВТОМОБІЛЯ (car_details_view.js)
// ==========================================

window.activeReportCarId = null; 

// Допоміжна функція для визначення ключа категорії автомобіля
function resolveCarCategoryKey(car) {
    if (!car) return 'passenger';
    const cat = String(car.category || '').toLowerCase().trim();
    const validKeys = ['passenger', 'truck', 'suv', 'minibus', 'adblue', 'miles', 'hq', 'special', 'motorcycle', 'quad'];
    if (validKeys.includes(cat)) {
        return cat;
    }

    // Якщо car.category порожнє або українською — визначаємо за властивостями авто
    if (car.isMiles) return 'miles';
    if (car.hasAdBlue && (!car.vehicleType || !String(car.vehicleType).toLowerCase().includes('вантаж'))) return 'adblue';

    const vType = String(car.vehicleType || '').toLowerCase().trim();
    if (vType.includes('вантаж')) return 'truck';
    if (vType.includes('мото')) return 'motorcycle';
    if (vType.includes('квадро')) return 'quad';
    return 'passenger';
}

// Заповнення списків категорій (якщо ще не заповнені)
function ensureCategoryDropdownsPopulated() {
    const categoriesMap = (typeof VEHICLE_CATEGORIES !== 'undefined') ? VEHICLE_CATEGORIES : {
        PASSENGER: "Легкові автомобілі",
        TRUCK: "Вантажні автомобілі",
        SUV: "Позашляховики",
        MINIBUS: "Мікроавтобуси",
        ADBLUE: "Автомобілі з AdBlue",
        MILES: "Автомобілі з милями",
        HQ: "Штабні автомобілі",
        SPECIAL: "Спецтехніка",
        MOTORCYCLE: "Мотоцикли",
        QUAD: "Квадроцикли"
    };

    ['det-input-category', 'card-input-category'].forEach(selectId => {
        const selectEl = document.getElementById(selectId);
        if (selectEl && selectEl.options.length === 0) {
            for (let key in categoriesMap) {
                let opt = document.createElement('option');
                opt.value = key.toLowerCase();
                opt.textContent = categoriesMap[key];
                selectEl.appendChild(opt);
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
        'consumption': car.consumption
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
    let reportsCount = 0;

    let periods = [];
    if (typeof getSavedPeriodsList === 'function') {
        periods = getSavedPeriodsList();
    } else {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('report_data_')) {
                periods.push(key.replace('report_data_', ''));
            }
        }
    }

    let periodsHtml = '';

    periods.forEach(period => {
        try {
            const storedRep = localStorage.getItem('report_data_' + period);
            let rowData = null;

            if (storedRep) {
                const repObj = JSON.parse(storedRep);
                if (repObj && repObj[car.id]) {
                    rowData = repObj[car.id];
                }
            }
            
            if (rowData) {
                reportsCount++;
                const prevOdo = parseFloat(rowData.prevOdo) || 0;
                const currOdo = parseFloat(rowData.odo) || 0;
                const driven = (currOdo > prevOdo) ? (currOdo - prevOdo) : 0;
                totalMileage += driven;

                const refFuel = parseFloat(rowData.refuelFuel) || 0;
                totalReceivedFuel += refFuel;

                const prevF = parseFloat(rowData.prevFuel) || 0;
                const leftF = parseFloat(rowData.leftFuel) || 0;
                const spentF = (prevF + refFuel - leftF) > 0 ? (prevF + refFuel - leftF) : 0;
                totalSpentFuel += spentF;

                const refAdBlue = parseFloat(rowData.refuelAdBlue) || 0;
                totalReceivedAdBlue += refAdBlue;

                periodsHtml += `
                    <tr>
                        <td><strong>${period}</strong></td>
                        <td>${prevOdo || '—'}</td>
                        <td>${currOdo || '—'}</td>
                        <td><strong>${driven > 0 ? driven + ' км' : '0 км'}</strong></td>
                        <td style="color: #27ae60;">${refFuel ? refFuel + ' л' : '0'}</td>
                        <td style="color: #c0392b;">${spentF > 0 ? spentF.toFixed(1) + ' л' : (rowData.leftFuel || '—')}</td>
                        <td>${refAdBlue ? refAdBlue + ' л' : '0'}</td>
                        <td>${rowData.refuelOil || '—'}</td>
                        <td>${rowData.refuelWasher || '—'}</td>
                        <td>${rowData.note || '—'}</td>
                    </tr>
                `;
            }
        } catch(e) {}
    });

    if (periodsHtml === '') {
        periodsHtml = `<tr><td colspan="10" style="text-align: center; color: #7f8c8d; font-style: italic; padding: 15px;">Немає збережених звітів по цьому автомобілю в періодах</td></tr>`;
    }

    periodsTbody.innerHTML = periodsHtml;

    const elMileage = document.getElementById('det-total-mileage');
    const elFuel = document.getElementById('det-total-fuel');
    const elSpent = document.getElementById('det-total-spent-fuel');
    const elAdblue = document.getElementById('det-total-adblue');
    const elCount = document.getElementById('det-reports-count');

    if (elMileage) elMileage.textContent = totalMileage + ' км';
    if (elFuel) elFuel.textContent = totalReceivedFuel.toFixed(1) + ' л';
    if (elSpent) elSpent.textContent = totalSpentFuel.toFixed(1) + ' л';
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

function viewCarDoc(carId, index) {
    try {
        const stored = localStorage.getItem(`car_folder_${carId}`);
        if (stored) {
            const folderData = JSON.parse(stored);
            const doc = folderData.files[index];
            if (doc && doc.dataUrl) {
                const win = window.open();
                const isImage = doc.dataUrl.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.name);
                win.document.write(`
                    <html>
                        <head><title>Перегляд: ${doc.name}</title></head>
                        <body style="margin:0; background:#222; display:flex; justify-content:center; align-items:center; height:100vh;">
                            ${isImage ? `<img src="${doc.dataUrl}" style="max-width:100%; max-height:100%; object-fit:contain;" />` : `<iframe src="${doc.dataUrl}" style="width:100%; height:100%; border:none;"></iframe>`}
                        </body>
                    </html>
                `);
            }
        }
    } catch(e) {
        alert('Не вдалося відкрити документ.');
    }
}