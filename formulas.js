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
    9: { label: "Місто (мото):", coeff: 1.05, textOp: "+ 5%", type: "motoCity" },
    10: { label: "Місто:", coeff: 1.05, textOp: "+ 5%", type: "kharkivKyivCity" },
    11: { label: "Траса:", coeff: 0.85, textOp: "− 15%", type: "kharkivKyivHighway" }
};

function isKharkivKyivRoute(name) {
    return /^харків\s*[-–—]\s*київ$/iu.test(String(name ?? '').trim());
}

function calculateRouteFuel(rows, baseRate, carFormulas = [1, 2, 3, 4], isMiles = false) {
    let totalBzKm = 0;
    let totalCityKm = 0;
    let totalHighwayKm = 0;
    let totalCityKyivKm = 0;
    let totalTkm = 0;
    let totalRawKm = 0;
    let kharkivKyivKm = 0;
    const isStandardCar = carFormulas.some(id => id >= 1 && id <= 4);
    const multiplier = isMiles ? 1.61 : 1;

    if (!Array.isArray(rows) && !(rows && typeof rows.forEach === 'function')) {
        return { calculatedResults: [], totalFuel: 0 };
    }

    rows.forEach(row => {
        let routeName = "";
        let tripValRaw = 0;
        let tkmVal = 0;

        if (row && typeof row.querySelector === 'function') {
            const nameInput = row.querySelector('input[type="text"]');
            const kmInput = row.querySelector('.total-col') || row.querySelectorAll('input')[5];
            const tkmInput = row.querySelector('.row-tkm');
            routeName = nameInput ? nameInput.value.toLowerCase() : "";
            tripValRaw = parseFloat(kmInput?.value) || 0;
            tkmVal = parseFloat(tkmInput?.value) || 0;
        } else if (row) {
            routeName = (row.name || row.routeName || (row.inputs && row.inputs[0]) || "").toLowerCase();
            if (row.inputs && Array.isArray(row.inputs)) {
                tripValRaw = parseFloat(row.inputs[5]) || 0;
                tkmVal = parseFloat(row.inputs[7]) || 0;
            } else {
                tripValRaw = parseFloat(row.km || row.totalKm) || 0;
                tkmVal = parseFloat(row.tkm) || 0;
            }
        }

        const tripVal = tripValRaw * multiplier; 
        totalRawKm += tripVal;
        totalTkm += tkmVal;

        if (isStandardCar && isKharkivKyivRoute(routeName)) {
            kharkivKyivKm += tripVal;
        } else if (routeName.includes("міста-мільйонники")) {
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

    let isMotoBzRoute = false;
    rows.forEach(row => {
        let routeName = "";
        if (row && typeof row.querySelector === 'function') {
            const nameInput = row.querySelector('input[type="text"]');
            routeName = nameInput ? nameInput.value.toLowerCase() : "";
        } else if (row) {
            routeName = (row.name || row.routeName || (row.inputs && row.inputs[0]) || "").toLowerCase();
        }
        if (routeName.includes("виконання бз харків")) {
            isMotoBzRoute = true;
        }
    });

    // СУВОРЕ РОЗДІЛЕННЯ: якщо це стандартний автомобіль (є формули 1-4), 
    // мото-формули примусово дорівнюють 0, щоб уникнути подвійного рахунку пробігу!

    let bz = 0;
    let city = 0;
    let highway = 0;
    let cityKyiv = 0;
    let motoBz = 0;
    let motoCity = 0;

    if (isStandardCar) {
        bz = parseFloat(totalBzKm.toFixed(1));
        city = parseFloat(totalCityKm.toFixed(1));
        highway = parseFloat(totalHighwayKm.toFixed(1));
        cityKyiv = parseFloat(totalCityKyivKm.toFixed(1));
        motoBz = 0;
        motoCity = 0;
    } else if (carFormulas.includes(8) || carFormulas.includes(9)) {
        bz = 0;
        city = 0;
        highway = 0;
        cityKyiv = 0;
        if (carFormulas.includes(9) && isMotoBzRoute) {
            motoBz = parseFloat((totalRawKm * 0.80).toFixed(1));
            motoCity = parseFloat((totalRawKm * 0.20).toFixed(1));
        } else if (carFormulas.includes(8)) {
            motoBz = parseFloat(totalRawKm.toFixed(1));
            motoCity = 0;
        }
    }

    const targetTotalKm = parseFloat((totalRawKm - kharkivKyivKm).toFixed(1));
    let currentSum = parseFloat((bz + city + highway + cityKyiv + motoBz + motoCity).toFixed(1));
    let diff = parseFloat((targetTotalKm - currentSum).toFixed(1));

    if (Math.abs(diff) >= 0.1) {
        if (highway > 0) highway = parseFloat((highway + diff).toFixed(1));
        else if (motoBz > 0) motoBz = parseFloat((motoBz + diff).toFixed(1));
        else if (city > 0) city = parseFloat((city + diff).toFixed(1));
        else if (bz > 0) bz = parseFloat((bz + diff).toFixed(1));
    }

    const kharkivKyivCity = Number((kharkivKyivKm * 0.12).toFixed(1));
    const kmMap = {
        bz: bz,
        city: city,
        highway: highway,
        cityKyiv: cityKyiv,
        motoBz: motoBz,
        motoCity: motoCity,
        kharkivKyivCity,
        kharkivKyivHighway: Number((kharkivKyivKm - kharkivKyivCity).toFixed(1)),
        work: totalTkm,
        cargoTransport: totalTkm
    };

    const truck = carFormulas.includes(5) || carFormulas.includes(6);
    const definitions = truck ? {
        ...formulaDefinitions,
        10: {...formulaDefinitions[10], coeff: 1.10, textOp: '+ 10%'},
        11: {...formulaDefinitions[11], coeff: 0.95, textOp: '− 5%'}
    } : formulaDefinitions;
    if (kharkivKyivKm) {
        const legacy = carFormulas.filter(id => id !== 10 && id !== 11 && (targetTotalKm !== 0 || id < 1 || id > 4));
        const highwayIndex = legacy.findIndex(id => id === 6 || id === 7);
        legacy.splice(highwayIndex < 0 ? legacy.length : highwayIndex, 0, 10, 11);
        carFormulas = legacy;
    }

    let totalFuel = 0;

    carFormulas.forEach(fId => {
        const formula = definitions[fId];
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
        const formula = definitions[fId];
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
