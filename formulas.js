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
        } else {
            totalBzKm += tripVal * 0.33;
            totalCityKm += tripVal * 0.18;
            totalHighwayKm += tripVal * 0.49;
            totalCityKyivKm += 0;
        }
    });

    let bz = parseFloat(totalBzKm.toFixed(1));
    let city = parseFloat(totalCityKm.toFixed(1));
    let highway = parseFloat(totalHighwayKm.toFixed(1));
    let cityKyiv = parseFloat(totalCityKyivKm.toFixed(1));
    
    // Жорсткий захист: за замовчуванням 0 для всіх звичайних авто
    let motoBz = 0;
    let motoCity = 0;

    // Рахуємо мотоциклетні кілометри ТІЛЬКИ якщо у машини є формула 8 або 9
    if (carFormulas.includes(8) || carFormulas.includes(9)) {
        let isMotoBzRoute = false;
        rows.forEach(row => {
            const nameInput = row.querySelector('input[type="text"]');
            if (nameInput && nameInput.value.toLowerCase().includes("виконання бз харків")) {
                isMotoBzRoute = true;
            }
        });

        if (carFormulas.includes(9) && isMotoBzRoute) {
            motoBz = parseFloat((totalRawKm * 0.80).toFixed(1));
            motoCity = parseFloat((totalRawKm * 0.20).toFixed(1));
        } else if (carFormulas.includes(8)) {
            motoBz = parseFloat(totalRawKm.toFixed(1));
            motoCity = 0;
        }
    }

    const targetTotalKm = parseFloat((totalRawKm).toFixed(1));
    let currentSum = parseFloat((bz + city + highway + cityKyiv + motoBz + motoCity).toFixed(1));
    let diff = parseFloat((targetTotalKm - currentSum).toFixed(1));

    if (Math.abs(diff) >= 0.1) {
        if (highway > 0) highway = parseFloat((highway + diff).toFixed(1));
        else if (motoBz > 0) motoBz = parseFloat((motoBz + diff).toFixed(1));
        else if (city > 0) city = parseFloat((city + diff).toFixed(1));
        else if (bz > 0) bz = parseFloat((bz + diff).toFixed(1));
    }

    let kmMap = {
        bz: bz,
        city: city,
        highway: highway,
        cityKyiv: cityKyiv,
        motoBz: motoBz,
        motoCity: motoCity,
        work: totalTkm,
        cargoTransport: totalTkm
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
            totalFuel += resVal;
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
                km: km,
                textOp: formula.textOp || "",
                type: formula.type,
                resVal: resVal
            });
        }
    });

    let calculatedFuelRounded = Math.round(totalFuel * 100) / 100;

    return {
        calculatedResults,
        totalFuel: calculatedFuelRounded
    };
}