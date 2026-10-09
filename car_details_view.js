// ==========================================
// МОДУЛЬ ДЕТАЛЬНОЇ КАРТКИ ТА ЗВІТІВ АВТОМОБІЛЯ (car_details_view.js)
// ==========================================

window.activeReportCarId = null; 

// Точне відкриття звіту за унікальним ID автомобіля
window.openCarDetails = function(carId) {
    window.activeReportCarId = Number(carId);
    
    let sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const car = sourceCars.find(c => Number(c.id) === window.activeReportCarId);
    
    if (!car) {
        alert("Помилка: автомобіль з таким ID не знайдено в базі!");
        return;
    }

    document.querySelectorAll('.view-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });

    const detSec = document.getElementById('car-details-view');
    if (detSec) {
        detSec.classList.add('active');
        detSec.style.display = 'block';
    }

    document.querySelectorAll('.top-nav .nav-btn, .nav-btn').forEach(btn => btn.classList.remove('active'));

    renderCarDetailsData();
}

function getActiveReportCar() {
    if (typeof carsData === 'undefined' || !Array.isArray(carsData)) return null;
    return carsData.find(c => Number(c.id) === Number(window.activeReportCarId)) || null;
}

function renderCarDetailsData() {
    const car = getActiveReportCar();
    if (!car) return;

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
        'tank': car.tankCapacity || car.tank,
        'drive': car.drive,
        'emptyWeight': car.emptyWeight,
        'totalWeight': car.totalWeight,
        'gears': car.gears,
        'engine': car.engineVolume || car.engine,
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

    const catSelect = document.getElementById('det-input-category');
    if (catSelect && car.category) {
        catSelect.value = car.category.toLowerCase();
    }

    renderCarPeriodsAndStats(car);
    
    if (typeof renderCarDocuments === 'function') {
        renderCarDocuments(car);
    }
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
}

window.updateCarCategoryFromDetails = function(newCategoryKey) {
    let car = getActiveReportCar();
    if (!car) return;
    if (typeof applyCategoryChangesToCar === 'function') {
        applyCategoryChangesToCar(car, newCategoryKey);
    } else {
        car.category = newCategoryKey.toLowerCase();
    }
    if (typeof saveCarsToStorage === 'function') saveCarsToStorage();
    if (typeof renderCarsTable === 'function') renderCarsTable();
}

window.saveCarDetailsToBasePath = function() {
    let car = getActiveReportCar();
    if (!car) {
        alert("Помилка: автомобіль не обрано!");
        return;
    }

    if (typeof saveCarsToStorage === 'function') saveCarsToStorage();
    if (typeof saveCarsModificationsToStorage === 'function') saveCarsModificationsToStorage();
    if (typeof renderCarsTable === 'function') renderCarsTable();

    alert(`Зміни для автомобіля "${car.plate}" успішно збережено в базу!`);
    if (typeof switchView === 'function') switchView('base');
}

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

                const refAdBlue = parseFloat(rowData.refuelAdBlue) || 0;
                totalReceivedAdBlue += refAdBlue;

                periodsHtml += `
                    <tr>
                        <td><strong>${period}</strong></td>
                        <td>${prevOdo || '—'}</td>
                        <td>${currOdo || '—'}</td>
                        <td><strong>${driven > 0 ? driven + ' км' : '0 км'}</strong></td>
                        <td style="color: #27ae60;">${refFuel ? refFuel + ' л' : '0'}</td>
                        <td style="color: #c0392b;">${rowData.leftFuel || '—'}</td>
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
    
    const storageKey = `car_folder_${car.id}`;
    let folderData = { path: `Doc/car_${car.id}`, files: [] };
    
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

    const storageKey = `car_folder_${car.id}`;
    let folderData = { path: `Doc/${car.plate}`, files: [] };
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) folderData = JSON.parse(stored);
    } catch(e) {}

    if (folderData.files.length === 0) {
        docsList.innerHTML = '<span style="color: #7f8c8d; font-style: italic;">Папка порожня. Документи не завантажено.</span>';
        return;
    }

    let html = `<div style="margin-bottom: 6px; font-weight: bold; color: #2980b9;">Шлях: ${folderData.path}</div><ul style="padding-left: 15px; margin: 0;">`;
    folderData.files.forEach((doc, idx) => {
        html += `<li style="padding: 3px 0; display: flex; justify-content: space-between; align-items: center;">
            <span>📄 ${doc.name} (${doc.size})</span>
            <button class="action-btn" style="padding: 2px 6px; font-size: 11px;" onclick="viewCarDoc(${car.id}, ${idx})">Переглянути</button>
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
                win.document.write(`<iframe src="${doc.dataUrl}" style="width:100%; height:100%; border:none;"></iframe>`);
            }
        }
    } catch(e) {
        alert('Не вдалося відкрити документ.');
    }
}