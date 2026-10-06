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
    if (typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn) {
        promptAndAddCar();
    } else {
        if (typeof showCustomPasswordModal === 'function') {
            showCustomPasswordModal((pass) => {
                if (pass === "02031985") {
                    isAdminLoggedIn = true;
                    if (typeof updateAdminUI === 'function') updateAdminUI();
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
    const lowerName = selectedCategoryName.toLowerCase();
    if (lowerName.includes("вантаж") || lowerName.includes("adblue")) vehicleTypeUA = "вантажний";
    else if (lowerName.includes("мотоцикл")) vehicleTypeUA = "мотоцикл";
    else if (lowerName.includes("квадроцикл")) vehicleTypeUA = "квадроцикл";

    executeAddCarWithCategory(selectedKey, vehicleTypeUA, selectedCategoryName);
}

function executeAddCarWithCategory(categoryKey, vehicleTypeStr, categoryDisplayName) {
    if (typeof carsData === 'undefined') {
        window.carsData = [];
    }

    const newId = carsData.length > 0 ? Math.max(...carsData.map(i => Number(i.id) || 0)) + 1 : 1;
    const upperKey = categoryKey.toUpperCase();

    // Автоматичний підбір формул (AdBlue та вантажівки отримують розкладку MAN)
    let assignedFormulas = [1, 2, 3, 4];
    if (upperKey === 'TRUCK' || upperKey === 'SPECIAL' || upperKey === 'ADBLUE') {
        assignedFormulas = [5, 1, 2, 3, 6, 7]; 
    } else if (upperKey === 'MOTORCYCLE' || upperKey === 'QUAD') {
        assignedFormulas = [8, 9];
    }

    const newCar = {
        id: newId,
        plate: "NEW 0000",
        model: `Новий авто (${categoryDisplayName})`,
        subdivision: "РМТЗ",
        consumption: (upperKey === 'MOTORCYCLE' || upperKey === 'QUAD') ? 4.0 : 25.0,
        fuelType: "ДП",
        note: "",
        vin: "",
        year: 2024,
        transmission: "автомат",
        tankCapacity: 200,
        drive: "повний",
        emptyWeight: 7500,
        totalWeight: 14000,
        gears: 6,
        engineVolume: 7698,
        kw: 210,
        engineNo: "",
        driver: "Водій",
        category: categoryKey.toLowerCase(),
        vehicleType: vehicleTypeStr,     
        hasAdBlue: true,
        isMiles: upperKey === 'MILES',
        formulas: assignedFormulas
    };

    carsData.push(newCar);

    // Надійне збереження у пам'ять браузера
    if (typeof saveCarsToStorage === 'function') {
        saveCarsToStorage();
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

function updateCarCategoryFromDetails(newCategoryKey) {
    if (typeof currentCarId === 'undefined' || !currentCarId) return;
    
    let sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const car = sourceCars.find(c => Number(c.id) === Number(currentCarId));
    
    if (car) {
        applyCategoryChangesToCar(car, newCategoryKey);
        alert("Категорію та формули успішно змінено й збережено!");
    }
}

function updateCardCarCategory(newCategoryKey) {
    if (typeof currentCar === 'undefined' || !currentCar) return;

    applyCategoryChangesToCar(currentCar, newCategoryKey);

    if (typeof renderFormulas === 'function') {
        renderFormulas(currentCar.formulas);
    }
    if (typeof calculateFuel === 'function') {
        calculateFuel();
    }

    alert("Категорію та формули успішно оновлено й збережено!");
}

function applyCategoryChangesToCar(car, newCategoryKey) {
    car.category = newCategoryKey.toLowerCase();
    const upperKey = newCategoryKey.toUpperCase();

    let assignedFormulas = [1, 2, 3, 4];
    let vehicleTypeUA = "легковий";

    if (upperKey === 'TRUCK' || upperKey === 'SPECIAL' || upperKey === 'ADBLUE') {
        assignedFormulas = [5, 1, 2, 3, 6, 7]; // Вантажна розкладка MAN
        vehicleTypeUA = "вантажний";
    } else if (upperKey === 'MOTORCYCLE' || upperKey === 'QUAD') {
        assignedFormulas = [8, 9];
        vehicleTypeUA = upperKey === 'MOTORCYCLE' ? "мотоцикл" : "квадроцикл";
    }

    car.formulas = assignedFormulas;
    car.vehicleType = vehicleTypeUA;
    car.hasAdBlue = true;
    car.isMiles = (upperKey === 'MILES');

    // Зберігаємо зміни у сховище браузера
    if (typeof saveCarsToStorage === 'function') {
        saveCarsToStorage();
    }

    if (typeof renderCarsTable === 'function') {
        renderCarsTable();
    }
}

if (typeof window.openCarDetails === 'function') {
    const originalOpenDetails = window.openCarDetails;
    window.openCarDetails = function(carId) {
        originalOpenDetails(carId);
        initCategorySelects();
        
        const car = carsData.find(c => Number(c.id) === Number(carId));
        if (car) {
            const modelInput = document.getElementById('det-input-model');
            const plateInput = document.getElementById('det-input-plate');
            if (modelInput) modelInput.value = car.model || '';
            if (plateInput) plateInput.value = car.plate || '';

            const catSelect = document.getElementById('det-input-category');
            if (catSelect && car.category) {
                catSelect.value = car.category.toLowerCase();
            }
        }
    };
}

if (typeof window.loadCarIntoCard === 'function') {
    const origLoadCar = window.loadCarIntoCard;
    window.loadCarIntoCard = function(car) {
        origLoadCar(car);
        initCategorySelects();
        const catSelect = document.getElementById('card-input-category');
        if (catSelect && car && car.category) {
            catSelect.value = car.category.toLowerCase();
        }
    };
}

document.addEventListener("DOMContentLoaded", () => {
    initCategorySelects();
});