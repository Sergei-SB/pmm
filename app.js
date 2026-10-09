// ==========================================
// ЛОГІКА ІНТЕРФЕЙСУ ТА МАРШРУТІВ (app.js)
// ==========================================

let lastActiveRow = null;
if (typeof window.currentCarId === 'undefined') {
    window.currentCarId = 1;
}
let currentCategoryFilter = 'all';
let activeDetailCarId = null;

document.addEventListener("DOMContentLoaded", () => {
    loadCarsModifications();
    renderCarsTable();
    populateCarSelector();
    injectCardPrintButton();
    initDestroyedViewFeature();
    
    const safeCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : [];
    const activeCars = safeCars.filter(c => !isItemDestroyed(c.note));
    if (activeCars.length > 0) {
        loadCarCard(activeCars[0].id);
    }
    updateRouteTotals();
});

function isItemDestroyed(note) {
    return /знищ/ui.test(note || '');
}

function initDestroyedViewFeature() {
    if (!document.getElementById('nav-btn-destroyed')) {
        const navButtons = document.querySelectorAll('.top-nav .nav-btn, .nav-left .nav-btn, .top-nav button');
        let targetBtn = null;
        navButtons.forEach(btn => {
            if (btn.textContent.includes('Звіт по обладнанню')) {
                targetBtn = btn;
            }
        });
        
        if (targetBtn && targetBtn.parentNode) {
            const destBtn = document.createElement('button');
            destBtn.id = 'nav-btn-destroyed';
            destBtn.className = 'nav-btn';
            destBtn.setAttribute('onclick', "switchView('destroyed-view')");
            destBtn.innerHTML = 'Знищена техніка';
            targetBtn.parentNode.insertBefore(destBtn, targetBtn.nextSibling);
        }
    }

    if (!document.getElementById('destroyed-view')) {
        const baseView = document.getElementById('base-view');
        if (baseView && baseView.parentNode) {
            const destView = document.createElement('div');
            destView.id = 'destroyed-view';
            destView.className = 'view-section';
            destView.style.padding = '20px';
            destView.innerHTML = `
                <h2 style="color: #c0392b; margin-top: 0; margin-bottom: 20px;">Облік знищеної техніки та обладнання</h2>
                <div id="destroyed-table-container"></div>
            `;
            baseView.parentNode.appendChild(destView);
        }
    }
}

function injectCardPrintButton() {
    const searchInput = document.getElementById('car-search-input');
    if (searchInput && !document.getElementById('print-car-card-btn')) {
        const parentContainer = searchInput.parentElement;
        if (parentContainer) {
            parentContainer.style.display = 'flex';
            parentContainer.style.alignItems = 'center';
            parentContainer.style.gap = '10px';

            const printBtn = document.createElement('button');
            printBtn.id = 'print-car-card-btn';
            printBtn.innerHTML = '<span style="font-size: 14px; margin-right: 6px; vertical-align: middle;">🖨️</span> Друк';
            printBtn.style.cssText = 'background-color: #337ab7; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
            printBtn.onclick = printCarCardReport;
            
            parentContainer.insertBefore(printBtn, parentContainer.firstChild);
        }
    }
}

function printCarCardReport() {
    const safeCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : [];
    const car = safeCars.find(c => Number(c.id) === Number(currentCarId));
    if (!car) return;

    const printWindow = window.open('', '_blank');
    
    let routesRowsHtml = '';
    const rows = document.querySelectorAll('#routes-tbody tr');
    rows.forEach((row, idx) => {
        const inputs = row.querySelectorAll('input');
        const routeName = inputs[0] ? inputs[0].value : '';
        const timeVal = inputs[1] ? inputs[1].value : '';
        const c1 = inputs[2] ? inputs[2].value : '';
        const c2 = inputs[3] ? inputs[3].value : '';
        const c3 = inputs[4] ? inputs[4].value : '';
        const totalKm = inputs[5] ? inputs[5].value : '';
        const cargoType = inputs[7] ? inputs[7].value : 'о/с';
        const odoVal = row.querySelector('.row-odo') ? row.querySelector('.row-odo').value : '';

        routesRowsHtml += `
            <tr>
                <td>${idx + 1}</td>
                <td style="text-align: left; padding-left: 4px;">${routeName}</td>
                <td>${timeVal}</td>
                <td>${c1}</td>
                <td>${c2}</td>
                <td>${c3}</td>
                <td><b>${totalKm}</b></td>
                <td>${cargoType}</td>
                <td>${odoVal}</td>
            </tr>
        `;
    });

    const formulasContainer = document.getElementById('formulas-group-container');
    const formulasHtml = formulasContainer ? formulasContainer.innerHTML : '';

    const sumKm = document.getElementById('sum-km')?.textContent || '0';
    const sumFuel = document.getElementById('sum-fuel')?.textContent || '0';
    const sumFuelRound = document.getElementById('sum-fuel-round')?.textContent || '0';
    const fuelStart = document.getElementById('fuel-start')?.value || '0';
    const fuelReceived = document.getElementById('fuel-received')?.value || '0';
    const fuelLeft = document.getElementById('fuel-left')?.textContent || '0';
    const baseLineText = document.querySelector('.fuel-base-line')?.textContent || '';
    const subLineText = document.querySelector('.fuel-sub-line')?.textContent || '';

    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Картка авто та маршрути — ${car.plate}</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 9px; color: #000; margin: 5mm; }
                h2 { text-align: center; margin: 0 0 4px 0; font-size: 12px; }
                .header-info { text-align: center; margin-bottom: 6px; font-size: 10px; font-weight: bold; color: #2c3e50; }
                .main-layout { display: flex; gap: 10px; width: 100%; }
                .left-col { flex: 2; }
                .right-col { flex: 1; }
                table { width: 100%; border-collapse: collapse; margin-top: 3px; }
                th, td { border: 1px solid #333; padding: 2px 4px; text-align: center; font-size: 9px; }
                th { background-color: #2e7d32 !important; color: white !important; }
                .specs-table td { text-align: left; padding: 2px 4px; font-size: 8px; }
                .specs-table td:first-child { font-weight: bold; width: 55%; color: #333; }
                .calc-box { border: 1px solid #333; padding: 4px; margin-top: 6px; background: #fdfdfd; font-size: 9px; }
                .calc-row { display: flex; justify-content: space-between; margin-bottom: 1px; }
                .summary-box { margin-top: 4px; font-weight: bold; font-size: 9px; border-top: 1px solid #333; padding-top: 3px; }
                @media print {
                    @page { size: landscape; margin: 5mm; }
                    body { -webkit-print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <h2>КАРТКА ТРАНСПОРТНОГО ЗАСОБУ ТА МАРШРУТИ</h2>
            <div class="header-info">${car.model} &nbsp;|&nbsp; Держ. номер: ${car.plate} &nbsp;|&nbsp; Підрозділ: ${car.subdivision || '—'} &nbsp;|&nbsp; Водій: ${car.driver || '—'}</div>
            
            <div class="main-layout">
                <div class="left-col">
                    <div style="font-weight: bold; font-size: 9px; margin-bottom: 2px; color: #2e7d32;">МАРШРУТИ ТА ПРОБІГ:</div>
                    <table>
                        <thead>
                            <tr>
                                <th>№</th>
                                <th>Маршрути</th>
                                <th>Час</th>
                                <th>Вант.</th>
                                <th>Пуст.</th>
                                <th>Приц.</th>
                                <th>Всього</th>
                                <th>Груз</th>
                                <th>Одометр</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${routesRowsHtml}
                        </tbody>
                    </table>

                    <div class="calc-box">
                        <div style="font-weight: bold; margin-bottom: 2px; border-bottom: 1px solid #ccc; padding-bottom: 1px;">РОЗРАХУНОК ВИТРАТИ ПАЛИВА:</div>
                        ${formulasHtml}
                        <div style="margin-top: 2px; color: #555; font-size: 8px;">${baseLineText} ${subLineText ? '| ' + subLineText : ''}</div>
                    </div>

                    <div class="summary-box">
                        Всього пройдено: ${sumKm} км &nbsp;|&nbsp; Витрачено: ${sumFuel} л (&approx; ${sumFuelRound} л) &nbsp;|&nbsp; Залишок: ${fuelLeft} л (Поч: ${fuelStart} л, Отрим: ${fuelReceived} л)
                    </div>
                </div>

                <div class="right-col">
                    <div style="font-weight: bold; font-size: 9px; margin-bottom: 2px; color: #2980b9;">ТЕХНІЧНА ХАРАКТЕРИСТИКА:</div>
                    <table class="specs-table">
                        <tr><td>Підрозділ, рота</td><td>${car.subdivision || '—'}</td></tr>
                        <tr><td>Тип пального</td><td>${car.fuelType || '—'}</td></tr>
                        <tr><td>Примітка</td><td>${car.note || '—'}</td></tr>
                        <tr><td>Він код</td><td>${car.vin || '—'}</td></tr>
                        <tr><td>Рік випуску</td><td>${car.year || '—'}</td></tr>
                        <tr><td>Тип КПП</td><td>${car.transmission || '—'}</td></tr>
                        <tr><td>Ємність баку</td><td>${car.tankCapacity || '—'} л</td></tr>
                        <tr><td>Привід</td><td>${car.drive || '—'}</td></tr>
                        <tr><td>Маса без вантажу</td><td>${car.emptyWeight || '—'} кг</td></tr>
                        <tr><td>Повна маса</td><td>${car.totalWeight || '—'} кг</td></tr>
                        <tr><td>Кількість передач</td><td>${car.gears || '—'}</td></tr>
                        <tr><td>Об'єм двигуна</td><td>${car.engineVolume || '—'} см³</td></tr>
                        <tr><td>кВт</td><td>${car.kw || '—'}</td></tr>
                        <tr><td>№ двигуна</td><td>${car.engineNo || '—'}</td></tr>
                        <tr><td>Водій</td><td>${car.driver || '—'}</td></tr>
                        <tr><td>Витрата палива</td><td>${car.consumption || '—'} л/100км</td></tr>
                    </table>
                </div>
            </div>
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

function loadCarsModifications() {
    if (typeof carsData === 'undefined' || !Array.isArray(carsData)) return;
    try {
        const stored = localStorage.getItem('cars_modifications_data');
        if (stored) {
            const mods = JSON.parse(stored);
            carsData.forEach(car => {
                if (mods[car.id]) {
                    if (mods[car.id].model !== undefined) car.model = mods[car.id].model;
                    if (mods[car.id].plate !== undefined) car.plate = mods[car.id].plate;
                    if (mods[car.id].note !== undefined) car.note = mods[car.id].note;
                    if (mods[car.id].driver !== undefined) car.driver = mods[car.id].driver;
                    if (mods[car.id].engineNo !== undefined) car.engineNo = mods[car.id].engineNo;
                    if (mods[car.id].vin !== undefined) car.vin = mods[car.id].vin;
                    if (mods[car.id].vehicleType !== undefined) car.vehicleType = mods[car.id].vehicleType;
                    if (mods[car.id].category !== undefined) car.category = mods[car.id].category;
                    if (mods[car.id].subdivision !== undefined) car.subdivision = mods[car.id].subdivision;
                }
            });
        }
    } catch(e) {
        console.error(e);
    }
}

function saveCarsModificationsToStorage() {
    if (typeof carsData === 'undefined' || !Array.isArray(carsData)) return;
    let mods = {};
    carsData.forEach(car => {
        mods[car.id] = {
            model: car.model,
            plate: car.plate,
            note: car.note,
            driver: car.driver,
            engineNo: car.engineNo,
            vin: car.vin,
            vehicleType: car.vehicleType,
            category: car.category,
            subdivision: car.subdivision
        };
    });
    localStorage.setItem('cars_modifications_data', JSON.stringify(mods));
}

function fmt(val, decimals = 2) {
    if (isNaN(val)) return val;
    return parseFloat(Number(val).toFixed(decimals)).toString();
}

function fmtKm(val, isMiles = false) {
    if (isNaN(val)) return val;
    const dec = isMiles ? 1 : 0;
    return parseFloat(Number(val).toFixed(dec)).toString();
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
        const result = Function('"use strict"; return (' + sanitized + ')')();
        return isNaN(result) ? 0 : Number(result);
    } catch (e) {
        return 0;
    }
}

function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    const topSearchBox = document.getElementById('top-search-box');
    const navButtons = document.querySelectorAll('.top-nav .nav-btn, .nav-left .nav-btn, .top-nav button');

    navButtons.forEach(btn => {
        const onclickAttr = btn.getAttribute('onclick') || '';
        if (onclickAttr.includes(`switchView('${viewName}')`) || onclickAttr.includes(`switchView("${viewName}")`)) {
            btn.classList.add('active');
        }
    });

    if (viewName === 'base') {
        document.getElementById('base-view').classList.add('active');
        if (navButtons[0]) navButtons[0].classList.add('active');
        if (topSearchBox) topSearchBox.style.display = 'block';
        renderCarsTable(); 
    } else if (viewName === 'card') {
        document.getElementById('card-view').classList.add('active');
        if (topSearchBox) topSearchBox.style.display = 'none';
        loadCarCard(currentCarId);
    } else if (viewName === 'report') {
        document.getElementById('report-view').classList.add('active');
        if (topSearchBox) topSearchBox.style.display = 'none';
        if (typeof renderReportTable === 'function') {
            renderReportTable();
        }
    } else if (viewName === 'subdivisions') {
        document.getElementById('subdivisions-view').classList.add('active');
        if (topSearchBox) topSearchBox.style.display = 'none';
        if (typeof renderSubdivisionsView === 'function') {
            renderSubdivisionsView();
        }
    } else if (viewName === 'generators') {
        document.getElementById('generators-view').classList.add('active');
        if (topSearchBox) topSearchBox.style.display = 'none';
        
        // Примусово відкриваємо вкладку генераторів при кожному вході в розділ
        if (typeof switchEquipmentTab === 'function') {
            switchEquipmentTab('generators');
        } else if (typeof renderGeneratorsView === 'function') {
            renderGeneratorsView();
        }
    } else if (viewName === 'aggregates-calc') {
        const calcView = document.getElementById('aggregates-calc-view');
        if (calcView) calcView.classList.add('active');
        if (topSearchBox) topSearchBox.style.display = 'none';
        if (typeof renderAggregatesCalcView === 'function') {
            renderAggregatesCalcView();
        }
    } else if (viewName === 'equipment-report-view') {
        document.getElementById('equipment-report-view').classList.add('active');
        if (topSearchBox) topSearchBox.style.display = 'none';
        if (typeof renderEquipmentReportView === 'function') {
            renderEquipmentReportView();
        }
    } else if (viewName === 'destroyed-view') {
        const destView = document.getElementById('destroyed-view');
        if (destView) destView.classList.add('active');
        navButtons.forEach(btn => {
            if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes('destroyed-view')) {
                btn.classList.add('active');
            }
        });
        if (topSearchBox) topSearchBox.style.display = 'none';
        if (typeof renderDestroyedEquipmentView === 'function') {
            renderDestroyedEquipmentView();
        }
    } else if (viewName === 'car-details') {
        document.getElementById('car-details-view').classList.add('active');
        if (topSearchBox) topSearchBox.style.display = 'none';
    }
}

function getAllEquipmentItemsUnified() {
    let items = [];
    
    let genArr = [];
    try { if (typeof getGeneratorsList === 'function') genArr = getGeneratorsList(); } catch(e) {}
    if (!genArr || genArr.length === 0) genArr = (typeof generatorsData !== 'undefined') ? generatorsData : [];
    if (Array.isArray(genArr)) {
        genArr.forEach((item, index) => {
            const uid = 'gen_' + (item.id !== undefined ? item.id : index);
            let note = item.note || '';
            let subdivision = item.locationSubdivision || item.subdivision || '';
            let model = item.model || item.name || 'Генератор #' + (index + 1);
            
            items.push({
                uniqueId: uid,
                category: 'Генератор',
                model: model,
                subdivision: subdivision,
                note: note,
                rawItem: item,
                arrayType: 'generators'
            });
        });
    }
    
    let webArr = [];
    try { if (typeof getWebastoList === 'function') webArr = getWebastoList(); } catch(e) {}
    if (!webArr || webArr.length === 0) webArr = (typeof webastoData !== 'undefined') ? webastoData : [];
    if (Array.isArray(webArr)) {
        webArr.forEach((item, index) => {
            const uid = 'web_' + (item.id !== undefined ? item.id : index);
            let note = item.note || '';
            let subdivision = item.locationSubdivision || item.subdivision || '';
            let model = item.model || item.name || 'Webasto #' + (index + 1);

            items.push({
                uniqueId: uid,
                category: 'Webasto',
                model: model,
                subdivision: subdivision,
                note: note,
                rawItem: item,
                arrayType: 'webasto'
            });
        });
    }
    
    let heatArr = [];
    try { if (typeof getHeatersList === 'function') heatArr = getHeatersList(); } catch(e) {}
    if (!heatArr || heatArr.length === 0) heatArr = (typeof teplovipushkiData !== 'undefined') ? teplovipushkiData : ((typeof heatersData !== 'undefined') ? heatersData : []);
    if (Array.isArray(heatArr)) {
        heatArr.forEach((item, index) => {
            const uid = 'heat_' + (item.id !== undefined ? item.id : index);
            let note = item.note || '';
            let subdivision = item.locationSubdivision || item.subdivision || '';
            let model = item.model || item.name || 'Пушка #' + (index + 1);

            items.push({
                uniqueId: uid,
                category: 'Теплова пушка',
                model: model,
                subdivision: subdivision,
                note: note,
                rawItem: item,
                arrayType: 'heaters'
            });
        });
    }
    
    let sawArr = [];
    try { if (typeof getChainsawsList === 'function') sawArr = getChainsawsList(); } catch(e) {}
    if (!sawArr || sawArr.length === 0) sawArr = (typeof benzopiliData !== 'undefined') ? benzopiliData : ((typeof chainsawsData !== 'undefined') ? chainsawsData : []);
    if (Array.isArray(sawArr)) {
        sawArr.forEach((item, index) => {
            const uid = 'saw_' + (item.id !== undefined ? item.id : index);
            let note = item.note || '';
            let subdivision = item.locationSubdivision || item.subdivision || '';
            let model = item.model || item.name || 'Пила #' + (index + 1);

            items.push({
                uniqueId: uid,
                category: 'Бензопила',
                model: model,
                subdivision: subdivision,
                note: note,
                rawItem: item,
                arrayType: 'chainsaws'
            });
        });
    }

    return items;
}

function filterCarsByCategory(category) {
    currentCategoryFilter = category;
    
    document.getElementById('btn-cat-all')?.classList.remove('active');
    document.getElementById('btn-cat-car')?.classList.remove('active');
    document.getElementById('btn-cat-truck')?.classList.remove('active');
    document.getElementById('btn-cat-moto')?.classList.remove('active');
    document.getElementById('btn-cat-quad')?.classList.remove('active');

    if (category === 'all') document.getElementById('btn-cat-all')?.classList.add('active');
    if (category === 'легковий') document.getElementById('btn-cat-car')?.classList.add('active');
    if (category === 'вантажний') document.getElementById('btn-cat-truck')?.classList.add('active');
    if (category === 'мотоцикл') document.getElementById('btn-cat-moto')?.classList.add('active');
    if (category === 'квадроцикл') document.getElementById('btn-cat-quad')?.classList.add('active');

    const searchInput = document.getElementById('base-search-input');
    renderCarsTable(searchInput ? searchInput.value : '');
}

function isCarTruck(car) {
    if (!car) return false;
    const carId = Number(car.id);
    if (carId === 2 || carId === 3 || carId === 8 || carId === 9) return true;
    
    const vType = String(car.vehicleType || "").toLowerCase();
    const cat = String(car.category || "").toLowerCase();
    const model = String(car.model || "").toLowerCase();
    
    return (
        vType.includes("вантаж") || 
        cat === "truck" || 
        cat === "minibus" || 
        cat === "special" ||
        model.includes("transporter") ||
        model.includes("sprinter") ||
        model.includes("man") ||
        model.includes("tgs") ||
        model.includes("d14") ||
        model.includes("tgm") ||
        model.includes("евакуатор")
    );
}

function getCarGroup(car) {
    if (!car) return 'легковий';
    const vType = String(car.vehicleType || "").toLowerCase();
    const cat = String(car.category || "").toLowerCase();
    
    if (vType === 'мотоцикл' || cat === 'motorcycle') return 'мотоцикл';
    if (vType === 'квадроцикл' || cat === 'quad') return 'квадроцикл';
    if (isCarTruck(car)) return 'вантажний';
    return 'легковий';
}

function updateCarVehicleType(carId, newType) {
    const safeCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : [];
    const car = safeCars.find(c => Number(c.id) === Number(carId));
    if (car) {
        car.vehicleType = newType;
        if (newType === 'мотоцикл') car.category = 'motorcycle';
        else if (newType === 'квадроцикл') car.category = 'quad';
        else if (newType === 'вантажний') car.category = 'truck';
        else car.category = 'passenger';
        
        saveCarsModificationsToStorage();
        renderCarsTable();
    }
}

function renderCarsTable(filterQuery = '') {
    const tbody = document.getElementById('cars-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const safeCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : [];
    if (safeCars.length === 0) return;

    const subFilterEl = document.getElementById('base-subdivision-filter');
    const currentSubVal = subFilterEl ? subFilterEl.value : 'all';

    if (subFilterEl) {
        const subs = new Set();
        safeCars.forEach(c => { 
            if (c.subdivision) subs.add(c.subdivision.trim()); 
        });
        let opts = '<option value="all">Усі</option>';
        subs.forEach(sub => {
            opts += `<option value="${sub}">${sub}</option>`;
        });
        subFilterEl.innerHTML = opts;
        if (subs.has(currentSubVal) || currentSubVal === 'all') {
            subFilterEl.value = currentSubVal;
        }
    }
    const selectedSub = subFilterEl ? subFilterEl.value : 'all';

    const searchInput = document.getElementById('base-search-input');
    const query = filterQuery !== '' ? filterQuery : (searchInput ? searchInput.value : '');
    const upperVal = query.toUpperCase().trim();
    
    const filteredCars = safeCars.filter(car => {
        if (selectedSub !== 'all' && (car.subdivision || '').trim() !== selectedSub) {
            return false;
        }

        if (!upperVal) return true;
        return (
            (car.plate || '').toUpperCase().includes(upperVal) || 
            (car.model || '').toUpperCase().includes(upperVal) ||
            (car.subdivision || '').toUpperCase().includes(upperVal) ||
            (car.fuelType || '').toUpperCase().includes(upperVal) ||
            (car.note || '').toUpperCase().includes(upperVal) ||
            (car.driver || '').toUpperCase().includes(upperVal)
        );
    });

    filteredCars.forEach((car, index) => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <select class="table-cell-input" onchange="updateCarVehicleType(${car.id}, this.value)" style="font-size: 11px; padding: 2px; cursor: pointer;">
                    <option value="легковий" ${car.vehicleType === 'легковий' ? 'selected' : ''}>Легковий</option>
                    <option value="вантажний" ${car.vehicleType === 'вантажний' ? 'selected' : ''}>Вантажний</option>
                    <option value="мотоцикл" ${car.vehicleType === 'мотоцикл' ? 'selected' : ''}>Мотоцикл</option>
                    <option value="квадроцикл" ${car.vehicleType === 'квадроцикл' ? 'selected' : ''}>Квадроцикл</option>
                </select>
            </td>
            <td><span onclick="openCarCardFromBase(${car.id})" title="Відкрити картку та маршрути" <td><span onclick="openCarCard(${car.id})" style="cursor: pointer; color: #000; font-weight: bold; text-decoration: none;" title="Відкрити картку авто">${car.plate || ''}</span></td>
            <td>${car.model || ''}</td>
            <td>${car.subdivision || '—'}</td>
            <td>${car.consumption || 0} л</td>
            <td>${car.fuelType || ''}</td>
            <td><input type="text" class="table-cell-input" value="${car.note || ''}" oninput="updateCarProp(${car.id}, 'note', this.value)"></td>
            <td>${car.vin || ''}</td>
            <td>${car.year || ''}</td>
            <td>${car.transmission || ''}</td>
            <td>${car.tankCapacity || 0} л</td>
            <td>${car.drive || ''}</td>
            <td>${car.emptyWeight || 0} кг</td>
            <td>${car.totalWeight || 0} кг</td>
            <td>${car.gears || ''}</td>
            <td>${car.engineVolume || 0} см³</td>
            <td>${car.kw || 0}</td>
            <td>${car.engineNo || ''}</td>
            <td><input type="text" class="table-cell-input" value="${car.driver || ''}" oninput="updateCarProp(${car.id}, 'driver', this.value)"></td>
            <td style="text-align: center;"><button class="action-btn" style="padding: 2px 8px; font-size: 11px;" onclick="openCarDetails(${car.id})">Звіт</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function updateCarProp(carId, propName, val) {
    const safeCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : [];
    const car = safeCars.find(c => Number(c.id) === Number(carId));
    if (car) {
        car[propName] = val;
        saveCarsModificationsToStorage();
        if (Number(currentCarId) === Number(carId)) {
            loadCarCard(currentCarId);
        }
        populateCarSelector();
    }
}

function filterBaseTable(val) {
    renderCarsTable(val);
}

function populateCarSelector() {
    const datalist = document.getElementById('cars-list');
    if (!datalist) return;
    
    datalist.innerHTML = '';
    const safeCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : [];
    safeCars.forEach(car => {
        if (!isItemDestroyed(car.note)) {
            const option = document.createElement('option');
            option.value = `${car.plate} — ${car.model}`;
            datalist.appendChild(option);
        }
    });
}

function handleCarSearchInput(val, event) {
    const upperVal = val.toUpperCase().trim();
    if (!upperVal) return;

    const isEnter = event && event.key === 'Enter';
    const safeCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : [];

    let foundCar = safeCars.find(car => 
        !isItemDestroyed(car.note) && (
            car.plate.toUpperCase() === upperVal || 
            car.model.toUpperCase() === upperVal ||
            `${car.plate} — ${car.model}`.toUpperCase() === upperVal
        )
    );

    if (!foundCar) {
        const matches = safeCars.filter(car => 
            !isItemDestroyed(car.note) && (
                car.plate.toUpperCase().includes(upperVal) || 
                car.model.toUpperCase().includes(upperVal) ||
                `${car.plate} — ${car.model}`.toUpperCase().includes(upperVal)
            )
        );

        if (isEnter && matches.length > 0) {
            foundCar = matches[0];
        } else if (matches.length === 1 && upperVal.length >= 3) {
            foundCar = matches[0];
        }
    }

    if (foundCar) {
        loadCarCard(foundCar.id);
        const searchInput = document.getElementById('car-search-input');
        if (searchInput) {
            searchInput.value = "";
            searchInput.blur();
        }
    }
}

function openCarCard(carId) {
    currentCarId = Number(carId); // Жорстко фіксуємо ID обраного автомобіля
    switchView('card');
    loadCarCard(currentCarId);
}

function uploadCarDocument(input) {
    if (!activeDetailCarId) return;
    const files = input.files;
    if (!files || files.length === 0) return;

    const safeCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : [];
    const car = safeCars.find(c => Number(c.id) === Number(activeDetailCarId));
    if (!car) return;

    const folderName = `Doc/${car.plate.replace(/[^a-zA-Z0-9А-Яа-яІіЇїЄє]/g, '_')}`;
    const storageKey = `car_folder_${car.id}`;
    
    let folderData = { path: folderName, files: [] };
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) folderData = JSON.parse(stored);
    } catch(e) {
        console.error(e);
    }

    let processedCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

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
                input.value = "";
                renderCarDocuments(car);
            }
        };

        reader.readAsDataURL(file);
    }
}

function renderCarDocuments(car) {
    const docsContainer = document.getElementById('car-docs-list');
    if (!docsContainer) return;

    const folderName = `Doc/${car.plate.replace(/[^a-zA-Z0-9А-Яа-яІіЇїЄє]/g, '_')}`;
    const storageKey = `car_folder_${car.id}`;
    
    let folderData = { path: folderName, files: [] };
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) folderData = JSON.parse(stored);
    } catch(e) {
        console.error(e);
    }

    let headerHtml = `<div style="margin-bottom: 8px; font-weight: bold; color: #2980b9; font-size: 12px;">📁 Шлях папки: ${folderData.path}</div>`;

    if (folderData.files.length === 0) {
        docsContainer.innerHTML = headerHtml + '<span style="color: #7f8c8d; font-style: italic;">Папка порожня. Документи не завантажено.</span>';
        return;
    }

    let html = headerHtml + '<ul style="list-style-type: none; padding: 0; margin: 0;">';
    folderData.files.forEach((doc, idx) => {
        html += `
            <li style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #e0e0e0; gap: 10px;">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; color: #2980b9;" onclick="viewCarDoc(${car.id},${idx})" title="Натисніть для перегляду">📄 <strong>${doc.name}</strong> <small style="color: #7f8c8d;">(${doc.size}, ${doc.date})</small></span>
                <div style="display: flex; gap: 5px; flex-shrink: 0;">
                    ${doc.dataUrl ? `<button class="action-btn" style="padding: 2px 6px; font-size: 11px; background-color: #2980b9;" onclick="viewCarDoc(${car.id},${idx})">Переглянути</button>` : ''}
                    <button class="delete-row-btn" onclick="deleteCarDoc(${car.id}, ${idx})">Видалити</button>
                </div>
            </li>
        `;
    });
    html += '</ul>';
    docsContainer.innerHTML = html;
}

function viewCarDoc(carId, index) {
    const storageKey = `car_folder_${carId}`;
    try {
        const stored = localStorage.getItem(storageKey);
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
        console.error(e);
        alert('Не вдалося відкрити документ.');
    }
}

function deleteCarDoc(carId, index) {
    if (!confirm("Ви впевнені, що хочете видалити цей документ/фото?")) {
        return;
    }

    const storageKey = `car_folder_${carId}`;
    let folderData = null;
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) folderData = JSON.parse(stored);
    } catch(e) {
        console.error(e);
    }

    if (folderData && folderData.files) {
        folderData.files.splice(index, 1);
        localStorage.setItem(storageKey, JSON.stringify(folderData));
        const safeCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : [];
        const car = safeCars.find(c => Number(c.id) === Number(carId));
        if (car) renderCarDocuments(car);
    }
}

function loadCarCard(carId) {
    currentCarId = carId;
    const safeCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : [];
    const car = safeCars.find(c => Number(c.id) === Number(carId));
    if (!car) return;

    document.getElementById('card-model').textContent = car.model;
    document.getElementById('card-plate').textContent = car.plate;
    
    const searchInput = document.getElementById('car-search-input');
    if (searchInput && document.activeElement !== searchInput) {
        searchInput.value = "";
    }

    document.getElementById('spec-subdivision').textContent = car.subdivision;
    document.getElementById('spec-fuel-type').textContent = car.fuelType;
    document.getElementById('spec-note').textContent = car.note;
    document.getElementById('spec-vin').textContent = car.vin;
    document.getElementById('spec-year').textContent = car.year;
    document.getElementById('spec-transmission').textContent = car.transmission;
    document.getElementById('spec-tank').textContent = car.tankCapacity + ' л';
    document.getElementById('spec-drive').textContent = car.drive;
    document.getElementById('spec-empty-weight').textContent = car.emptyWeight + ' кг';
    document.getElementById('spec-total-weight').textContent = car.totalWeight + ' кг';
    document.getElementById('spec-gears').textContent = car.gears;
    document.getElementById('spec-engine').textContent = car.engineVolume + ' см³';
    document.getElementById('spec-kw').textContent = car.kw;
    document.getElementById('spec-engine-no').textContent = car.engineNo;
    document.getElementById('spec-driver').textContent = car.driver;
    document.getElementById('spec-consumption').textContent = car.consumption + ' л';

    const fuelReceivedLabel = document.getElementById('fuel-received-label');
    if (fuelReceivedLabel) {
        fuelReceivedLabel.textContent = `Отримано ${car.fuelType}`;
    }

    document.getElementById('fuel-start').value = "";
    document.getElementById('fuel-received').value = "";

    const adbluePanelBox = document.getElementById('adblue-panel-box');
    if (adbluePanelBox) {
        if (car.hasAdBlue) {
            adbluePanelBox.style.display = 'block';
            document.getElementById('adblue-start').value = "";
            document.getElementById('adblue-received').value = "";
        } else {
            adbluePanelBox.style.display = 'none';
        }
    }

    document.getElementById('odo-1').value = "";
    document.getElementById('odo-2').value = "";

    const truckActive = isCarTruck(car);

    renderTableHeaders(truckActive);
    initDefaultRoutes(truckActive);
    updateRouteTotals();
}

function renderTableHeaders(isTruck) {
    const thead = document.getElementById('routes-thead');
    if (!thead) return;

    if (isTruck) {
        thead.innerHTML = `
            <tr>
                <th>Маршрути</th>
                <th>Час</th>
                <th>Вантаж</th>
                <th>Пустий</th>
                <th>Прицеп</th>
                <th>Всього</th>
                <th>Дія</th>
                <th>Груз</th>
                <th>Кількість, т</th>
                <th>Т-км</th>
                <th>Одометр</th>
            </tr>
        `;
    } else {
        thead.innerHTML = `
            <tr>
                <th>Маршрути</th>
                <th>Час</th>
                <th>Вантаж</th>
                <th>Пустий</th>
                <th>Прицеп</th>
                <th>Всього</th>
                <th>Дія</th>
                <th>Груз</th>
                <th>Одометр</th>
            </tr>
        `;
    }
}

function initDefaultRoutes(isTruck) {
    const tbody = document.getElementById('routes-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    for (let i = 0; i < 7; i++) {
        addRouteRow('Виконання БЗ Харків', '8:30', '', isTruck);
    }
}

function addRouteRow(routeName = 'Виконання БЗ Харків', dateVal = '8:30', totalVal = '', forceIsTruck = null) {
    const tbody = document.getElementById('routes-tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    
    const safeCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : [];
    const car = safeCars.find(c => Number(c.id) === Number(currentCarId));
    const truckActive = forceIsTruck !== null ? forceIsTruck : isCarTruck(car);

    if (truckActive) {
        tr.innerHTML = `
            <td><input type="text" value="${routeName}" style="width: 190px; text-align: left; padding-left: 5px;" oninput="updateRouteTotals()"></td>
            <td><input type="text" value="${dateVal}" style="width: 45px; text-align: center;"></td>
            <td><input type="text" class="row-cargo" value="" style="width: 38px;" oninput="updateRouteTotals()"></td>
            <td><input type="text" value="" style="width: 38px;" oninput="updateRouteTotals()"></td>
            <td><input type="text" value="" style="width: 38px;" oninput="updateRouteTotals()"></td>
            <td><input type="text" class="total-col" value="${totalVal}" style="width: 45px;" oninput="updateRouteTotals()"></td>
            <td><button class="delete-row-btn" onclick="this.closest('tr').remove(); updateRouteTotals();">X</button></td>
            <td><input type="text" value="о/с" style="width: 38px; text-align: center;"></td>
            <td><input type="text" class="row-tons" value="" style="width: 55px;" oninput="updateRouteTotals()"></td>
            <td><input type="text" class="row-tkm" value="" style="width: 55px;" readonly></td>
            <td><input type="text" class="row-odo" value="0" style="width: 70px;" readonly></td>
        `;
    } else {
        tr.innerHTML = `
            <td><input type="text" value="${routeName}" style="width: 340px; text-align: left; padding-left: 5px;" oninput="updateRouteTotals()"></td>
            <td><input type="text" value="${dateVal}" style="width: 50px;"></td>
            <td><input type="text" value="" style="width: 40px;"></td>
            <td><input type="text" value="" style="width: 40px;"></td>
            <td><input type="text" value="" style="width: 40px;"></td>
            <td><input type="text" class="total-col" value="${totalVal}" style="width: 50px;" oninput="updateRouteTotals()"></td>
            <td><button class="delete-row-btn" onclick="this.closest('tr').remove(); updateRouteTotals();">X</button></td>
            <td><input type="text" value="о/с" style="width: 40px;"></td>
            <td><input type="text" class="row-odo" style="width: 90px;" readonly></td>
        `;
    }

    tr.addEventListener('click', () => {
        lastActiveRow = tr;
    });

    tbody.appendChild(tr);
    lastActiveRow = tr;
    updateRouteTotals();
}

function applyPresetToActiveRow(text) {
    if (!lastActiveRow) {
        const rows = document.querySelectorAll('#routes-tbody tr');
        if (rows.length > 0) {
            lastActiveRow = rows[rows.length - 1];
        } else {
            const safeCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : [];
            const car = safeCars.find(c => Number(c.id) === Number(currentCarId));
            addRouteRow(text, '8:30', '', isCarTruck(car));
            return;
        }
    }

    const input = lastActiveRow.querySelector('input[type="text"]');
    if (input) {
        input.value = text;
        updateRouteTotals();
    }
}

function updateRouteTotals() {
    let totalKm = 0;
    let startOdoInput = document.getElementById('odo-1')?.value || '0';
    let startOdo = evaluateExpression(startOdoInput);
    let currentOdo = startOdo;

    const safeCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : [];
    const car = safeCars.find(c => Number(c.id) === Number(currentCarId));
    const isMilesCar = car && car.isMiles;
    const group = getCarGroup(car);

    const rows = document.querySelectorAll('#routes-tbody tr');
    rows.forEach(row => {
        const kmInput = row.querySelector('.total-col');
        const odoInput = row.querySelector('.row-odo');
        const tripVal = evaluateExpression(kmInput?.value);
        
        totalKm += tripVal;
        currentOdo += tripVal;
        if (odoInput) odoInput.value = currentOdo;

        const cargoInput = row.querySelector('.row-cargo');
        const tonsInput = row.querySelector('.row-tons');
        const tkmInput = row.querySelector('.row-tkm');
        if (cargoInput && tonsInput && tkmInput) {
            const cargo = evaluateExpression(cargoInput.value);
            const tons = evaluateExpression(tonsInput.value);
            if (cargoInput.value !== '' && tonsInput.value !== '') {
                const tkm = cargo * tons;
                tkmInput.value = fmt(tkm, 1);
            } else {
                tkmInput.value = '';
            }
        }
    });

    const odo2 = document.getElementById('odo-2');
    if (odo2) {
        odo2.value = currentOdo > 0 ? currentOdo : "";
    }

    document.querySelectorAll('#sum-km').forEach(el => {
        el.textContent = totalKm;
    });

    const fuelSummaryLine = document.querySelector('.fuel-summary-line');
    let totalFuelRounded = 0;

    let baseConsumption = car ? car.consumption : 13.0;
    let carFormulas = car && car.formulas ? [...car.formulas] : [1, 2, 3];

    const truckActive = isCarTruck(car);
    const hasAdBlue = car && car.hasAdBlue;

    let presetButtonsHtml = `
        <button type="button" class="preset-btn" onclick="applyPresetToActiveRow('Виконання БЗ Харків')">Виконання БЗ Харків</button>
        <button type="button" class="preset-btn" onclick="applyPresetToActiveRow('Міста-мільйонники (Харків, Київ, Львів)')">Міста-мільйонники (Харків, Київ, Львів)</button>
    `;

    if (group === 'мотоцикл') {
        carFormulas = [8, 9];
        presetButtonsHtml = `
            <button type="button" class="preset-btn" onclick="applyPresetToActiveRow('Виконання БЗ Харків')">Виконання БЗ Харків</button>
        `;
    } else if (group === 'квадроцикл') {
        carFormulas = [8];
        presetButtonsHtml = `
            <button type="button" class="preset-btn" onclick="applyPresetToActiveRow('Виконання БЗ Харків')">Виконання БЗ Харків</button>
        `;
    } else if (truckActive) {
        let hasMillion = false;
        rows.forEach(row => {
            const nameInput = row.querySelector('input[type="text"]');
            const routeName = nameInput ? nameInput.value.toLowerCase() : "";
            if (routeName.includes("міста-мільйонники")) {
                hasMillion = true;
            }
        });

        carFormulas = [5, 1, 2, 3];
        if (hasMillion) {
            carFormulas.push(4);
        }
        carFormulas.push(6);
        if (hasAdBlue) {
            carFormulas.push(7);
        }
    }

    const presetGroupContainer = document.querySelector('.preset-buttons-group');
    if (presetGroupContainer) {
        presetGroupContainer.innerHTML = presetButtonsHtml;
    }

    let markupPercent = 0;
    let descriptionText = "";

    if (currentOdo >= 400000) {
        markupPercent = 9;
        descriptionText = "9% для а/м віком від 14 рок. або пробігом понад 400т.км";
    } else if (currentOdo >= 250000) {
        markupPercent = 7;
        descriptionText = "7% для а/м віком від 11 рок. або пробігом понад 250т.км";
    } else if (currentOdo >= 150000) {
        markupPercent = 5;
        descriptionText = "5% для а/м віком від 8 рок. або пробігом понад 150т.км";
    } else {
        markupPercent = 0;
        descriptionText = "";
    }

    let baseRate = baseConsumption * (1 + markupPercent / 100);

    const calcResult = calculateRouteFuel(rows, baseRate, carFormulas, isMilesCar);

    totalFuelRounded = Math.round(calcResult.totalFuel);

    if (fuelSummaryLine) {
        if (isMilesCar) {
            let convertedKm = totalKm * 1.61;
            fuelSummaryLine.innerHTML = `
                <span>Всього пройдено: <strong id="sum-km">${totalKm}</strong> mil * 1.61 = <strong>${fmt(convertedKm, 1)}</strong> км</span>
                <span>Витрачено <strong id="sum-fuel-copy">${calcResult.totalFuel.toFixed(2)}</strong> л &approx; <strong id="sum-fuel-round-copy">${totalFuelRounded}</strong> л</span>
            `;
        } else {
            fuelSummaryLine.innerHTML = `
                <span>Всього пройдено: <strong id="sum-km">${totalKm}</strong> км</span>
                <span>Витрачено <strong id="sum-fuel-copy">${fmt(calcResult.totalFuel, 2)}</strong> л &approx; <strong id="sum-fuel-round-copy">${totalFuelRounded}</strong> л</span>
            `;
        }
    }

    const baseLineEl = document.querySelector('.fuel-base-line');
    const subLineEl = document.querySelector('.fuel-sub-line');

    if (baseLineEl) {
        if (markupPercent > 0) {
            baseLineEl.innerHTML = `<span>Витрата палива базова : <span id="base-val-text">${fmt(baseConsumption, 1)}</span> л + <span class="markup-percent-text">${markupPercent}</span>% = <strong id="adjusted-base-text">${fmt(baseRate, 2)}</strong> л</span>`;
        } else {
            baseLineEl.innerHTML = `<span>Витрата палива базова : <span id="base-val-text">${fmt(baseConsumption, 1)}</span> л</span>`;
        }
    }

    if (subLineEl) {
        subLineEl.innerHTML = `<span id="markup-desc-text">${descriptionText}</span>`;
    }

    const formulasContainer = document.getElementById('formulas-group-container');
    if (formulasContainer) {
        formulasContainer.innerHTML = calcResult.calculatedResults.map(item => {
            if (item.type === 'work') {
                return `
                    <div class="calc-row">
                        <span class="c-label">${item.label}</span>
                        <span class="c-val-full" style="grid-column: 2 / span 5; text-align: left; font-weight: bold; padding-left: 0;">${fmt(item.resVal, 1)} т-км</span>
                    </div>
                `;
            } else if (item.type === 'cargoTransport') {
                return `
                    <div class="calc-row">
                        <span class="c-label">${item.label}</span>
                        <span class="c-km">${fmtKm(item.km, isMilesCar)}</span>
                        <span class="c-rate">* 0.9 / 100</span>
                        <span class="c-mod"></span>
                        <span class="c-eq">=</span>
                        <span class="c-val">${fmt(item.resVal, 2)} л</span>
                    </div>
                `;
            } else if (item.type === 'adblue') {
                return `
                    <div class="calc-row">
                        <span class="c-label">${item.label}</span>
                        <span class="c-km">${fmtKm(item.km, isMilesCar)}</span>
                        <span class="c-rate">* 0.05</span>
                        <span class="c-mod"></span>
                        <span class="c-eq">=</span>
                        <span class="c-val">${fmt(item.resVal, 2)} л</span>
                    </div>
                `;
            } else {
                return `
                    <div class="calc-row">
                        <span class="c-label">${item.label}</span>
                        <span class="c-km">${fmtKm(item.km, isMilesCar)}</span>
                        <span class="c-rate">* <span class="current-base-rate">${fmt(baseRate, 2)}</span> / 100</span>
                        <span class="c-mod">${item.textOp}</span>
                        <span class="c-eq">=</span>
                        <span class="c-val">${fmt(item.resVal, 2)} л</span>
                    </div>
                `;
            }
        }).join('');
    }

    document.querySelectorAll('#sum-fuel, #sum-fuel-copy').forEach(el => {
        el.textContent = fmt(calcResult.totalFuel, 2);
    });
    document.querySelectorAll('#sum-fuel-round, #sum-fuel-round-copy').forEach(el => {
        el.textContent = totalFuelRounded;
    });

    let fuelStart = evaluateExpression(document.getElementById('fuel-start')?.value);
    let fuelReceived = evaluateExpression(document.getElementById('fuel-received')?.value);
    let fuelSpent = calcResult.totalFuel;
    let fuelLeft = fuelReceived + fuelStart - fuelSpent;

    const fuelSpentEl = document.getElementById('fuel-spent');
    if (fuelSpentEl) fuelSpentEl.textContent = fmt(fuelSpent, 1);

    const fuelLeftEl = document.getElementById('fuel-left');
    if (fuelLeftEl) fuelLeftEl.textContent = fmt(fuelLeft, 1);

    if (car && car.hasAdBlue) {
        let adblueStart = evaluateExpression(document.getElementById('adblue-start')?.value);
        let adblueReceived = evaluateExpression(document.getElementById('adblue-received')?.value);
        let adblueSpent = 0;
        const adblueResult = calcResult.calculatedResults.find(item => item.type === 'adblue');
        if (adblueResult) {
            adblueSpent = adblueResult.resVal;
        }
        let adblueLeft = adblueReceived + adblueStart - adblueSpent;

        const adblueSpentEl = document.getElementById('adblue-spent');
        if (adblueSpentEl) adblueSpentEl.textContent = fmt(adblueSpent, 2);

        const adblueLeftEl = document.getElementById('adblue-left');
        if (adblueLeftEl) adblueLeftEl.textContent = fmt(adblueLeft, 2);
    }
}

document.addEventListener('click', function(e) {
    const tr = e.target.closest('#routes-tbody tr');
    if (tr) {
        lastActiveRow = tr;
    }
});

document.addEventListener('input', function(e) {
    if (e.target.closest('#routes-tbody') || 
        e.target.id === 'fuel-start' || 
        e.target.id === 'fuel-received' || 
        e.target.id === 'adblue-start' || 
        e.target.id === 'adblue-received' || 
        e.target.id === 'odo-1') {
        updateRouteTotals();
    }
});