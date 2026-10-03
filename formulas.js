// ==========================================
// ФОРМУЛИ ТА РОЗРАХУНКИ ВИТРАТИ ПАЛИВА ЗА НОМЕРАМИ (formulas.js)
// ==========================================

const formulaDefinitions = {
    1: { label: "БЗ:", coeff: 1.20, textOp: "+ 20%", type: "bz" },
    2: { label: "Місто:", coeff: 1.05, textOp: "+ 5%", type: "city" },
    3: { label: "Траса:", coeff: 0.85, textOp: "- 15%", type: "highway" },
    4: { label: "Місто(Київ Харків):", coeff: 1.15, textOp: "+ 15%", type: "cityKyiv" },
    5: { label: "Виконана робота:", type: "work" },
    6: { label: "Перевезення вантажу:", type: "cargoTransport" },
    7: { label: "Витрата AdBlue:", type: "adblue" },
    8: { label: "БЗ (мото/квадро):", coeff: 1.35, textOp: "+ 35%", type: "motoBz" },
    9: { label: "Місто (мото):", coeff: 1.05, textOp: "+ 5%", type: "motoCity" }
};

function calculateRouteFuel(rows, baseRate, carFormulas = [1, 2, 3, 4], isMiles = false) {
    let totalBzKm = 0;
    let totalCityKm = 0;
    let totalHighwayKm = 0;
    let totalCityKyivKm = 0;
    let totalMotoBzKm = 0;
    let totalMotoCityKm = 0;
    let totalTkm = 0;
    let totalRawKm = 0;
    const multiplier = isMiles ? 1.61 : 1;

    rows.forEach(row => {
        const nameInput = row.querySelector('input[type="text"]');
        const kmInput = row.querySelector('.total-col') || row.querySelectorAll('input')[5];
        const tkmInput = row.querySelector('.row-tkm');
        
        const routeName = nameInput ? nameInput.value.toLowerCase() : "";
        const tripValRaw = parseFloat(kmInput?.value) || 0;
        const tripVal = tripValRaw * multiplier; 
        totalRawKm += tripVal;
        const tkmVal = parseFloat(tkmInput?.value) || 0;

        totalTkm += tkmVal;

        if (routeName.includes("міста-мільйонники")) {
            totalBzKm += tripVal * 0.06;
            totalCityKm += tripVal * 0.26;
            totalHighwayKm += tripVal * 0.59;
            totalCityKyivKm += tripVal * 0.09;
            totalMotoBzKm += tripVal * 0.80;
            totalMotoCityKm += tripVal * 0.20;
        } else {
            totalBzKm += tripVal * 0.33;
            totalCityKm += tripVal * 0.18;
            totalHighwayKm += tripVal * 0.49;
            totalCityKyivKm += 0;
            totalMotoBzKm += tripVal * 0.80;
            totalMotoCityKm += tripVal * 0.20;
        }
    });

    let isMotoBzRoute = false;
    rows.forEach(row => {
        const nameInput = row.querySelector('input[type="text"]');
        if (nameInput && nameInput.value.toLowerCase().includes("виконання бз харків")) {
            isMotoBzRoute = true;
        }
    });

    // Базові значення з жорстким захистом від мінусових чисел (Math.max(0, ...))
    let bz = Math.max(0, parseFloat(totalBzKm.toFixed(1)));
    let city = Math.max(0, parseFloat(totalCityKm.toFixed(1)));
    let highway = Math.max(0, parseFloat(totalHighwayKm.toFixed(1)));
    let cityKyiv = Math.max(0, parseFloat(totalCityKyivKm.toFixed(1)));
    let motoBz = 0;
    let motoCity = 0;

    // Логіка для мотоциклів та квадроциклів
    if (carFormulas.includes(9) && isMotoBzRoute) {
        motoBz = Math.max(0, parseFloat((totalRawKm * 0.80).toFixed(1)));
        motoCity = Math.max(0, parseFloat((totalRawKm * 0.20).toFixed(1)));
        bz = 0; city = 0; highway = 0; cityKyiv = 0;
    } else if (carFormulas.includes(8) && !carFormulas.includes(9) && isMotoBzRoute) {
        motoBz = Math.max(0, parseFloat(totalRawKm.toFixed(1)));
        motoCity = 0;
        bz = 0; city = 0; highway = 0; cityKyiv = 0;
    }

    // СТРИКТЕ ПРАВИЛО: жоден кілометр не може бути меншим за 0
    let kmMap = {
        bz: Math.max(0, bz),
        city: Math.max(0, city),
        highway: Math.max(0, highway),
        cityKyiv: Math.max(0, cityKyiv),
        motoBz: Math.max(0, motoBz),
        motoCity: Math.max(0, motoCity),
        work: Math.max(0, totalTkm),
        cargoTransport: Math.max(0, totalTkm)
    };

    let totalFuel = 0;

    carFormulas.forEach(fId => {
        const formula = formulaDefinitions[fId];
        if (formula && formula.type !== 'work' && formula.type !== 'adblue') {
            let km = kmMap[formula.type] || 0;
            let resVal = 0;
            if (formula.type === 'cargoTransport') {
                resVal = (km * 0.9) / 100;
            } else {
                resVal = (km * baseRate / 100) * formula.coeff;
            }
            totalFuel += Math.max(0, resVal);
        }
    });

    let calculatedResults = [];

    carFormulas.forEach(fId => {
        const formula = formulaDefinitions[fId];
        if (formula) {
            let resVal = 0;
            let km = 0;

            if (formula.type === 'work') {
                km = kmMap.work;
                resVal = km;
            } else if (formula.type === 'cargoTransport') {
                km = kmMap.cargoTransport;
                resVal = (km * 0.9) / 100;
            } else if (formula.type === 'adblue') {
                km = totalFuel;
                resVal = totalFuel * 0.05;
            } else {
                km = kmMap[formula.type] || 0;
                resVal = (km * baseRate / 100) * formula.coeff;
            }

            calculatedResults.push({
                id: fId,
                label: formula.label,
                km: Math.max(0, km),
                textOp: formula.textOp || "",
                type: formula.type,
                resVal: Math.max(0, resVal)
            });
        }
    });

    return {
        calculatedResults,
        totalFuel: Math.max(0, totalFuel)
    };
}