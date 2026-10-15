// ==========================================
// ДОПОМІЖНІ СКРИПТИ ТА УТИЛІТИ (utils.js)
// ==========================================

document.addEventListener("mouseover", function(e) {
    const td = e.target.closest('td');
    if (td && td.textContent.trim() !== '') {
        if (!td.getAttribute('title')) {
            td.setAttribute('title', td.textContent.trim());
        }
    }
});

// ==========================================
// ФУНКЦІЇ ДОДАВАННЯ АВТОМОБІЛІВ З КАТЕГОРІЯМИ ТА ФОРМУЛАМИ
// ==========================================

function tryAddCarRow() {
    if (typeof currentRole !== 'undefined' && (currentRole === 'developer' || currentRole === 'admin')) {
        promptAndAddCar();
    } else if (typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn) {
        promptAndAddCar();
    } else {
        if (typeof showCustomPasswordModal === 'function') {
            showCustomPasswordModal((pass) => {
                if (pass === "02031985" || pass === "4343") {
                    promptAndAddCar();
                } else if (pass !== null) {
                    alert("Неправильний пароль!");
                }
            });
        } else {
            promptAndAddCar();
        }
    }
}

function promptAndAddCar() {
    if (typeof VEHICLE_CATEGORIES === 'undefined') {
        alert("Помилка: об'єкт категорій VEHICLE_CATEGORIES не знайдено!");
        return;
    }

    let catKeys = Object.keys(VEHICLE_CATEGORIES);
    let menuText = "Оберіть категорію для нового автомобіля (введіть номер):\n\n";
    
    catKeys.forEach((key, index) => {
        menuText += `${index + 1}. ${VEHICLE_CATEGORIES[key]}\n`;
    });

    let choice = prompt(menuText, "1");
    if (choice === null) return;

    let index = parseInt(choice, 10) - 1;
    if (isNaN(index) || index < 0 || index >= catKeys.length) {
        alert("Невірний вибір категорії! Спробуйте ще раз.");
        return;
    }

    let selectedKey = catKeys[index];
    let selectedCategoryName = VEHICLE_CATEGORIES[selectedKey];

    let vehicleTypeUA = "легковий";
    const upperKey = selectedKey.toUpperCase();
    if (upperKey === "TRUCK" || upperKey === "MINIBUS" || upperKey === "SPECIAL" || upperKey === "ADBLUE") {
        vehicleTypeUA = "вантажний";
    } else if (upperKey === "MOTORCYCLE") {
        vehicleTypeUA = "мотоцикл";
    } else if (upperKey === "QUAD") {
        vehicleTypeUA = "квадроцикл";
    }

    executeAddCarWithCategory(selectedKey, vehicleTypeUA, selectedCategoryName);
}

function executeAddCarWithCategory(categoryKey, vehicleTypeStr, categoryDisplayName) {
    if (typeof carsData === 'undefined') {
        window.carsData = [];
    }

    const newId = carsData.length > 0 ? Math.max(...carsData.map(i => Number(i.id) || 0)) + 1 : 1;
    const upperKey = categoryKey.toUpperCase();

    let assignedFormulas = [1, 2, 3, 4];
    if (upperKey === 'TRUCK' || upperKey === 'SPECIAL' || upperKey === 'ADBLUE' || upperKey === 'MINIBUS') {
        assignedFormulas = [5, 1, 2, 3, 6, 7]; 
    } else if (upperKey === 'MOTORCYCLE') {
        assignedFormulas = [8, 9];
    } else if (upperKey === 'QUAD') {
        assignedFormulas = [8];
    }

    const hasAdBlueFlag = (upperKey === 'ADBLUE');

    const newCar = {
        id: newId,
        plate: "NEW 0000",
        model: `Новий авто (${categoryDisplayName})`,
        subdivision: "РМТЗ",
        consumption: (upperKey === 'MOTORCYCLE' || upperKey === 'QUAD') ? 4.0 : (vehicleTypeStr === 'вантажний' ? 25.0 : 10.0),
        fuelType: "ДП",
        note: "",
        vin: "",
        year: 2024,
        transmission: "автомат",
        tankCapacity: vehicleTypeStr === 'вантажний' ? 200 : 60,
        drive: "повний",
        emptyWeight: vehicleTypeStr === 'вантажний' ? 7500 : 1800,
        totalWeight: vehicleTypeStr === 'вантажний' ? 14000 : 2500,
        gears: 6,
        engineVolume: 2000,
        kw: 110,
        engineNo: "",
        driver: "Водій",
        category: categoryKey.toLowerCase(),
        vehicleType: vehicleTypeStr,     
        hasAdBlue: hasAdBlueFlag,
        isMiles: upperKey === 'MILES',
        formulas: assignedFormulas
    };

    carsData.push(newCar);

    if (typeof saveCarsToStorage === 'function') {
        saveCarsToStorage();
    }
    if (typeof saveCarsModificationsToStorage === 'function') {
        saveCarsModificationsToStorage();
    }
    if (typeof renderCarsTable === 'function') {
        renderCarsTable();
    }

    alert(`Автомобіль успішно додано до категорії: "${categoryDisplayName}"!`);
}

// ==========================================
// УПРАВЛІННЯ КАТЕГОРІЄЮ У ЗВІТАХ ТА МАРШРУТАХ
// ==========================================

function initCategorySelects() {
    if (typeof ensureCategoryDropdownsPopulated === 'function') {
        ensureCategoryDropdownsPopulated();
        return;
    }

    const selectDet = document.getElementById('det-input-category');
    if (selectDet && typeof VEHICLE_CATEGORIES !== 'undefined' && selectDet.options.length === 0) {
        for (let key in VEHICLE_CATEGORIES) {
            let opt = document.createElement('option');
            opt.value = key.toLowerCase();
            opt.textContent = VEHICLE_CATEGORIES[key];
            selectDet.appendChild(opt);
        }
    }

    const selectCard = document.getElementById('card-input-category');
    if (selectCard && typeof VEHICLE_CATEGORIES !== 'undefined' && selectCard.options.length === 0) {
        for (let key in VEHICLE_CATEGORIES) {
            let opt = document.createElement('option');
            opt.value = key.toLowerCase();
            opt.textContent = VEHICLE_CATEGORIES[key];
            selectCard.appendChild(opt);
        }
    }
}

function updateCardCarCategory(newCategoryKey) {
    const targetId = (typeof currentCarId !== 'undefined' && currentCarId) ? currentCarId : null;
    if (!targetId) return;

    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const car = sourceCars.find(c => Number(c.id) === Number(targetId));
    if (!car) return;

    applyCategoryChangesToCar(car, newCategoryKey);

    if (typeof loadCarCard === 'function') {
        loadCarCard(car.id);
    }
}

function applyCategoryChangesToCar(car, newCategoryKey) {
    if (!car || !newCategoryKey) return;
    car.category = newCategoryKey.toLowerCase();
    const upperKey = newCategoryKey.toUpperCase();

    let assignedFormulas = [1, 2, 3, 4];
    let vehicleTypeUA = "легковий";

    if (upperKey === 'TRUCK' || upperKey === 'SPECIAL' || upperKey === 'ADBLUE' || upperKey === 'MINIBUS') {
        assignedFormulas = [5, 1, 2, 3, 6, 7];
        vehicleTypeUA = "вантажний";
    } else if (upperKey === 'MOTORCYCLE') {
        assignedFormulas = [8, 9];
        vehicleTypeUA = "мотоцикл";
    } else if (upperKey === 'QUAD') {
        assignedFormulas = [8];
        vehicleTypeUA = "квадроцикл";
    }

    car.formulas = assignedFormulas;
    car.vehicleType = vehicleTypeUA;
    car.hasAdBlue = (upperKey === 'ADBLUE');
    car.isMiles = (upperKey === 'MILES');

    // Оновлюємо відображення панелі AdBlue, якщо це авто зараз відкрите в Картці
    if (typeof currentCarId !== 'undefined' && Number(currentCarId) === Number(car.id)) {
        const abBox = document.getElementById('adblue-panel-box');
        if (abBox) abBox.style.display = car.hasAdBlue ? 'block' : 'none';
        if (typeof updateRouteTotals === 'function') {
            try { updateRouteTotals(); } catch (e) {}
        }
    }

    if (typeof saveCarsToStorage === 'function') {
        saveCarsToStorage();
    }
    if (typeof saveCarsModificationsToStorage === 'function') {
        saveCarsModificationsToStorage();
    }
    if (typeof renderCarsTable === 'function') {
        renderCarsTable();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initCategorySelects();

    // Автоматично синхронізуємо випадаючий список категорії у Картці авто при її відкритті
    if (typeof window.loadCarCard === 'function' && !window._categoryCardSyncHooked) {
        window._categoryCardSyncHooked = true;
        const origLoadCard = window.loadCarCard;
        window.loadCarCard = function(carId) {
            initCategorySelects();
            origLoadCard.apply(this, arguments);
            const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
            const car = sourceCars.find(c => Number(c.id) === Number(carId));
            const cardCatSelect = document.getElementById('card-input-category');
            if (car && cardCatSelect) {
                const resolved = (typeof resolveCarCategoryKey === 'function') ? resolveCarCategoryKey(car) : (car.category || 'passenger');
                cardCatSelect.value = resolved;
            }
        };
    }
});
