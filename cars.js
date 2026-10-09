// ==========================================
// БАЗА ДАНИХ АВТОМОБІЛІВ ТА КАТЕГОРІЙ (cars.js)
// ==========================================

const VEHICLE_CATEGORIES = {
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

let carsData = [
    {
        id: 1,
        plate: "KI 100 G",
        model: "Skoda Octavia",
        subdivision: "РМТЗ",
        consumption: 7.5,
        fuelType: "ДП",
        note: "Основний",
        vin: "TMBJJ7NE0J0123456",
        year: 2018,
        transmission: "механіка",
        tankCapacity: 50,
        drive: "передній",
        emptyWeight: 1250,
        totalWeight: 1800,
        gears: 6,
        engineVolume: 1968,
        kw: 110,
        engineNo: "CKFB123",
        driver: "Сидоренко С.С.",
        category: "passenger",
        vehicleType: "легковий",
        hasAdBlue: false,
        isMiles: false,
        formulas: [1, 2, 3, 4]
    },
    {
        id: 2,
        plate: "АІ 487 G",
        model: "Renault D14 HIGH P4*4 280 E3",
        subdivision: "РМТЗ",
        consumption: 25.0,
        fuelType: "ДП",
        note: "Резерв",
        vin: "VF640K831PB000231",
        year: 2022,
        transmission: "механіка",
        tankCapacity: 200,
        drive: "Задній, повний ручний",
        emptyWeight: 7500,
        totalWeight: 14000,
        gears: 6,
        engineVolume: 7698,
        kw: 210,
        engineNo: "22625483-4201027G22AXW",
        driver: "Іванов І.І.",
        category: "truck",
        vehicleType: "вантажний",
        hasAdBlue: false,
        isMiles: false,
        formulas: [5, 2, 3, 6]
    },
    {
        id: 3,
        plate: "TІ 666 G",
        model: "MAN TGS 33.400 6x6",
        subdivision: "РМТЗ",
        consumption: 32.3,
        fuelType: "ДП",
        note: "Вантажний з AdBlue",
        vin: "Y69SKS334R0C18170",
        year: 2024,
        transmission: "автомат",
        tankCapacity: 400,
        drive: "3 мости задн. Повний ручний",
        emptyWeight: 14200,
        totalWeight: 31000,
        gears: 0,
        engineVolume: 10518,
        kw: 294,
        engineNo: "5101101-3401",
        driver: "Водій / Старший водій",
        category: "truck",
        vehicleType: "вантажний",
        hasAdBlue: true,
        isMiles: false,
        formulas: [5, 1, 2, 3, 6, 7]
    },
    {
        id: 4,
        plate: "КІ 103 G",
        model: "Ford Explorer (US)",
        subdivision: "РМТЗ",
        consumption: 14.0,
        fuelType: "АБ",
        note: "Американська версія (милі)",
        vin: "1FM5K8F8LGA123789",
        year: 2016,
        transmission: "автомат",
        tankCapacity: 70,
        drive: "повний",
        emptyWeight: 2100,
        totalWeight: 2850,
        gears: 6,
        engineVolume: 3496,
        kw: 213,
        engineNo: "US35V6",
        driver: "Коваленко К.К.",
        category: "miles",
        vehicleType: "легковий",
        hasAdBlue: false,
        isMiles: true,
        formulas: [1, 2, 3, 4]
    },
    {
        id: 5,
        plate: "КІ 104 G",
        model: "TOYOTA LAND CRUISER",
        subdivision: "БПЛА",
        consumption: 12.5,
        fuelType: "АБ",
        note: "Штабний з AdBlue",
        vin: "JTEBZ22J30K987654",
        year: 2021,
        transmission: "автомат",
        tankCapacity: 93,
        drive: "повний",
        emptyWeight: 2450,
        totalWeight: 3260,
        gears: 6,
        engineVolume: 3346,
        kw: 227,
        engineNo: "F33A-FTV",
        driver: "Петров П.П.",
        category: "adblue",
        vehicleType: "вантажний",
        hasAdBlue: true,
        isMiles: false,
        formulas: [5, 1, 2, 3, 6, 7]
    },
    {
        id: 6,
        plate: "КІ 105 G",
        model: "Ford Explorer (US)",
        subdivision: "БПЛА",
        consumption: 14.0,
        fuelType: "АБ",
        note: "Американська версія (милі)",
        vin: "1FM5K8F8LGA123456",
        year: 2016,
        transmission: "автомат",
        tankCapacity: 70,
        drive: "повний",
        emptyWeight: 2100,
        totalWeight: 2850,
        gears: 6,
        engineVolume: 3496,
        kw: 213,
        engineNo: "US35V6",
        driver: "Мельник М.М.",
        category: "miles",
        vehicleType: "легковий",
        hasAdBlue: false,
        isMiles: true,
        formulas: [1, 2, 3, 4]
    },
    {
        id: 7,
        plate: "КІ 106 G",
        model: "Toyota Camry",
        subdivision: "БПЛА",
        consumption: 8.5,
        fuelType: "АБ",
        note: "Штабний",
        vin: "4T1B11HK5JU987654",
        year: 2020,
        transmission: "автомат",
        tankCapacity: 60,
        drive: "передній",
        emptyWeight: 1550,
        totalWeight: 2100,
        gears: 8,
        engineVolume: 2487,
        kw: 151,
        engineNo: "A25AFKS",
        driver: "Командувач",
        category: "hq",
        vehicleType: "легковий",
        hasAdBlue: false,
        isMiles: false,
        formulas: [1, 2, 3, 4]
    },
    {
        id: 8,
        plate: "КІ 107 G",
        model: "MAN TGS (Евакуатор)",
        subdivision: "ВТО",
        consumption: 25.0,
        fuelType: "ДП",
        note: "Спецтехніка важка",
        vin: "WMA13XZZ5MW123456",
        year: 2019,
        transmission: "механіка",
        tankCapacity: 300,
        drive: "повний",
        emptyWeight: 11000,
        totalWeight: 26000,
        gears: 16,
        engineVolume: 12419,
        kw: 353,
        engineNo: "D2676LF",
        driver: "Технік Т.Т.",
        category: "special",
        vehicleType: "вантажний",
        hasAdBlue: true,
        isMiles: false,
        formulas: [5, 1, 2, 3, 6, 7]
    },
    {
        id: 9,
        plate: "ТІ 102 G",
        model: "MAN TGM13.320 ВВ СН 4*4",
        subdivision: "ВТО",
        consumption: 21.5,
        fuelType: "ДП",
        note: "Вантажний з AdBlue",
        vin: "1J8G2E8A54Y140225",
        year: 2004,
        transmission: "автомат",
        tankCapacity: 78,
        drive: "повний",
        emptyWeight: 2260,
        totalWeight: 2750,
        gears: 5,
        engineVolume: 2987,
        kw: 160,
        engineNo: "—",
        driver: "Водій / Старший водій",
        category: "truck",
        vehicleType: "вантажний",
        hasAdBlue: true,
        isMiles: false,
        formulas: [5, 1, 2, 3, 6, 7]
    },
    {
        id: 10,
        plate: "ТІ 254 G",
        model: "Suzuki GSX250R",
        subdivision: "РМТЗ",
        consumption: 3.5,
        fuelType: "ДП",
        note: "",
        vin: "WMA13XZZ5",
        year: 2020,
        transmission: "автомат",
        tankCapacity: 15,
        drive: "задній",
        emptyWeight: 178,
        totalWeight: 250,
        gears: 6,
        engineVolume: 248,
        kw: 40,
        engineNo: "12452",
        driver: "водій",
        category: "motorcycle",
        vehicleType: "мотоцикл",
        hasAdBlue: false,
        isMiles: false,
        formulas: [8, 9]
    },
    {
        id: 11,
        plate: "ТІ 255 G",
        model: "CFORCE 1000 MV",
        subdivision: "РМТЗ",
        consumption: 9.0,
        fuelType: "ДП",
        note: "",
        vin: "WMA13XZZ5",
        year: 2020,
        transmission: "автомат",
        tankCapacity: 15,
        drive: "задній",
        emptyWeight: 178,
        totalWeight: 250,
        gears: 6,
        engineVolume: 248,
        kw: 40,
        engineNo: "12452",
        driver: "водій",
        category: "quad",
        vehicleType: "квадроцикл",
        hasAdBlue: false,
        isMiles: false,
        formulas: [8, 9]
    },
    {
        id: 12,
        plate: "ТІ 255 G",
        model: "CFORCE 1000 MV",
        subdivision: "РМТЗ",
        consumption: 9.0,
        fuelType: "ДП",
        note: "",
        vin: "WMA13XZZ5",
        year: 2020,
        transmission: "автомат",
        tankCapacity: 15,
        drive: "задній",
        emptyWeight: 178,
        totalWeight: 250,
        gears: 6,
        engineVolume: 248,
        kw: 40,
        engineNo: "12452",
        driver: "водій",
        category: "quad",
        vehicleType: "квадроцикл",
        hasAdBlue: false,
        isMiles: false,
        formulas: [8, 9]
    },
    {
        id: 13,
        plate: "TІ 659 G",
        model: "MAN TGS 33.400 6x6",
        subdivision: "РМТЗ",
        consumption: 32.3,
        fuelType: "ДП",
        note: "Вантажний з AdBlue",
        vin: "Y69SKS334R0C18170",
        year: 2024,
        transmission: "автомат",
        tankCapacity: 400,
        drive: "3 мости задн. Повний ручний",
        emptyWeight: 14200,
        totalWeight: 31000,
        gears: 0,
        engineVolume: 10518,
        kw: 294,
        engineNo: "5101101-3401",
        driver: "Водій / Старший водій",
        category: "truck",
        vehicleType: "вантажний",
        hasAdBlue: true,
        isMiles: false,
        formulas: [5, 1, 2, 3, 6, 7]
    }
];

function isValidPlate(plate) {
    if (!plate) return false;
    const trimmed = String(plate).trim();
    return trimmed !== '' && trimmed !== '—' && !/^\s*$/.test(trimmed);
}

function saveCarsToStorage() {
    try {
        // Очищаємо масив від машин без номерів перед збереженням
        const validCars = carsData.filter(c => isValidPlate(c.plate));
        localStorage.setItem('user_cars_database_v2', JSON.stringify(validCars));
    } catch (e) {
        console.error("Помилка збереження даних:", e);
    }
}

(function loadCarsFromStorage() {
    try {
        const saved = localStorage.getItem('user_cars_database_v2');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                carsData = parsed.filter(c => isValidPlate(c.plate));
            }
        }
    } catch (e) {
        console.error("Помилка завантаження даних:", e);
    }
})();

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
            if (!isItemDestroyed(c.note) && isValidPlate(c.plate) && c.subdivision) {
                subs.add(c.subdivision.trim()); 
            }
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
    
    // Сувора фільтрація: пропускаємо знищені та ті, у яких немає валідного номера
    const filteredCars = safeCars.filter(car => {
        if (isItemDestroyed(car.note)) return false;
        if (!isValidPlate(car.plate)) return false;

        if (selectedSub !== 'all' && (car.subdivision || '').trim() !== selectedSub) {
            return false;
        }

        const carCatGroup = getCarGroup(car);

        if (typeof currentCategoryFilter !== 'undefined' && currentCategoryFilter !== 'all' && carCatGroup !== currentCategoryFilter) {
            return false;
        }
        if (!upperVal) return true;
        return (
            car.plate.toUpperCase().includes(upperVal) || 
            car.model.toUpperCase().includes(upperVal) ||
            (car.subdivision || '').toUpperCase().includes(upperVal) ||
            car.fuelType.toUpperCase().includes(upperVal) ||
            car.note.toUpperCase().includes(upperVal) ||
            car.driver.toUpperCase().includes(upperVal)
        );
    });

    filteredCars.forEach((car, index) => {
        const tr = document.createElement('tr');
        const group = getCarGroup(car);
        
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <select class="table-cell-input" onchange="updateCarVehicleType(${car.id}, this.value)" style="font-size: 11px; padding: 2px; cursor: pointer;">
                    <option value="легковий" ${group === 'легковий' ? 'selected' : ''}>Легковий</option>
                    <option value="вантажний" ${group === 'вантажний' ? 'selected' : ''}>Вантажний</option>
                    <option value="мотоцикл" ${group === 'мотоцикл' ? 'selected' : ''}>Мотоцикл</option>
                    <option value="квадроцикл" ${group === 'квадроцикл' ? 'selected' : ''}>Квадроцикл</option>
                </select>
            </td>
            <td><span onclick="openCarCard(${car.id})" style="cursor: pointer; color: #000; font-weight: bold; text-decoration: none;" title="Відкрити картку авто">${car.plate || ''}</span></td>
            <td>${car.model}</td>
            <td>${car.subdivision || '—'}</td>
            <td>${car.consumption} л</td>
            <td>${car.fuelType}</td>
            <td><input type="text" class="table-cell-input" value="${car.note}" oninput="updateCarProp(${car.id}, 'note', this.value)"></td>
            <td>${car.vin}</td>
            <td>${car.year}</td>
            <td>${car.transmission}</td>
            <td>${car.tankCapacity} л</td>
            <td>${car.drive}</td>
            <td>${car.emptyWeight} кг</td>
            <td>${car.totalWeight} кг</td>
            <td>${car.gears}</td>
            <td>${car.engineVolume} см³</td>
            <td>${car.kw}</td>
            <td>${car.engineNo}</td>
            <td><input type="text" class="table-cell-input" value="${car.driver}" oninput="updateCarProp(${car.id}, 'driver', this.value)"></td>
            <td><button class="action-btn" style="padding: 3px 8px; font-size: 11px;" onclick="openCarDetails(${car.id})">Звіт</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function updateCarField(carId, field, val) {
    const car = carsData.find(c => Number(c.id) === Number(carId));
    if (car) {
        car[field] = val;
        saveCarsToStorage();
    }
}

if (typeof window.openCarCard !== 'function' || true) {
    window.openCarCard = function(carId) {
        const car = carsData.find(c => Number(c.id) === Number(carId));
        if (!car) return;

        window.currentCarId = car.id;
        window.currentCar = car;

        if (typeof loadCarCard === 'function') {
            loadCarCard(car.id);
        }

        if (typeof switchView === 'function') {
            switchView('card');
        } else {
            document.querySelectorAll('.view-section').forEach(sec => {
                sec.classList.remove('active');
                sec.style.display = 'none';
            });
            const cardView = document.getElementById('card-view');
            if (cardView) {
                cardView.classList.add('active');
                cardView.style.display = 'block';
            }
        }
    };
}

if (typeof window.openCarDetails !== 'function') {
    window.openCarDetails = function(carId) {
        const car = carsData.find(c => Number.c.id === Number(carId));
        if (!car) return;

        window.currentCarId = car.id;
        window.currentCar = car;

        if (typeof switchView === 'function') {
            switchView('car-details');
        } else {
            document.querySelectorAll('.view-section').forEach(sec => {
                sec.classList.remove('active');
                sec.style.display = 'none';
            });
            const detailsView = document.getElementById('car-details-view');
            if (detailsView) {
                detailsView.classList.add('active');
                detailsView.style.display = 'block';
            }
        }
    };
}

document.addEventListener("DOMContentLoaded", () => {
    renderCarsTable();
});

function openCarCardFromBase(carId) {
    currentCarId = Number(carId);
    if (typeof switchView === 'function') {
        switchView('card');
    }
    loadCarCard(currentCarId);
}