function getRouteTrailerMassKg(value) {
    const mass = Number(String(value ?? '').replace(/\s/g, '').replace(/кг$/i, '').replace(',', '.'));
    return Number.isFinite(mass) && mass > 0 ? mass : null;
}

function getRouteTrailerTotal(massKg, cargoText) {
    const cargo = String(cargoText).trim();
    if (cargo && !/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(cargo)) return null;
    const total = (massKg || 0) / 1000 + Number(cargo.replace(',', '.'));
    return Number.isFinite(total) ? Number(total.toFixed(6)) : null;
}

function setRouteTrailer(row, trailer) {
    const tons = row.querySelector('.row-tons');
    if (!tons) return;
    if (trailer) {
        row.dataset.routeTrailer = JSON.stringify(trailer);
        tons.title = `${trailer.plate} · ${trailer.massKg} кг + вантаж. Змінити через «Причіп / лафета».`;
    } else {
        delete row.dataset.routeTrailer;
        tons.removeAttribute('title');
    }
}

function updateRouteTrailerButton(canEdit) {
    const button = document.getElementById('route-trailer-button');
    const car = carsData.find(item => Number(item.id) === Number(currentCarId));
    button.hidden = !isCarTruck(car) || Boolean(getTowedVehicleCategory(car));
    button.disabled = !canEdit;
}

function renderRouteTrailerSummary(rows, visible) {
    const line = document.getElementById('route-trailer-mass-line');
    const numbers = document.getElementById('route-trailer-numbers');
    if (!line || !numbers) return;

    const plates = new Map();
    const masses = new Map();
    for (const row of visible ? rows : []) {
        const trailer = JSON.parse(row.dataset.routeTrailer || 'null');
        if (!trailer) continue;
        const id = String(trailer.id);
        const plate = carsData.find(car => String(car.id) === id)?.plate || trailer.plate;
        if (!plate) continue;
        plates.set(id, plate);
        if (!Number.isFinite(trailer.massKg) || trailer.massKg <= 0) continue;
        const label = `${plate} — ${trailer.massKg.toLocaleString('uk-UA')} кг`;
        masses.set(`${trailer.id}:${trailer.massKg}`, label);
    }
    numbers.textContent = [...plates.values()].join(', ');
    numbers.hidden = plates.size === 0;
    document.getElementById('route-trailer-mass').textContent = [...masses.values()].join('; ');
    line.hidden = masses.size === 0;
}

function readTrailerRouteSnapshot(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (_) {
        return null;
    }
}

function parseTrailerOdometer(value) {
    const reading = String(value ?? '').trim().replace(',', '.');
    return /^\d+(?:\.\d+)?$/.test(reading) && Number.isFinite(Number(reading)) ? Number(reading) : null;
}

function getTrailerMileageForPeriod(period, fleet) {
    const targetDate = parsePeriodDateVal(period);
    const units = new Map(fleet.map(car => [String(car.id), car]));
    const trailers = new Map([...units].filter(([, car]) => getTowedVehicleCategory(car)).map(([id]) => [id, new Map()]));
    if (!trailers.size || !targetDate) return new Map();

    function entry(id, date) {
        const periods = trailers.get(id);
        if (!periods.has(date)) periods.set(date, {distance: 0, base: null, legacy: null});
        return periods.get(date);
    }

    for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        const match = key?.match(/^isolated_car_routes_(\d{2}\.\d{2}(?:\.\d{4})?-\d{2}\.\d{2}(?:\.\d{4})?)_(\d+)$/);
        if (!match) continue;
        const date = parsePeriodDateVal(match[1]);
        if (!date || date > targetDate) continue;
        const vehicleId = match[2];
        const snapshot = readTrailerRouteSnapshot(key);
        if (trailers.has(vehicleId)) {
            const top = snapshot?.topFields;
            if (!top) continue;
            const readings = entry(vehicleId, date);
            if (Object.hasOwn(top, 'trailerOdometerBase')) readings.base = parseTrailerOdometer(top.trailerOdometerBase);
            else readings.legacy = parseTrailerOdometer(top.odo1);
            continue;
        }
        if (!Array.isArray(snapshot?.rows)) continue;
        const multiplier = units.get(vehicleId)?.isMiles ? 1.61 : 1;
        for (const row of snapshot.rows) {
            const trailerId = String(row?.trailer?.id ?? '');
            if (!trailers.has(trailerId)) continue;
            const distance = evaluateExpression(row.inputs?.[4]) * multiplier;
            if (Number.isFinite(distance) && distance > 0) entry(trailerId, date).distance += distance;
        }
    }

    const result = new Map();
    for (const [id, periods] of trailers) {
        let running = null;
        let anchored = false;
        let opening;
        let distance = 0;
        for (const [date, values] of [...periods].sort(([a], [b]) => a - b)) {
            const base = values.base ?? (anchored ? null : values.legacy);
            if (base !== null) {
                running = base;
                anchored = true;
            }
            if (running === null && values.distance) running = 0;
            if (date === targetDate) {
                opening = running;
                distance = values.distance;
            }
            if (running !== null) running += values.distance;
        }
        const display = value => value === null ? '' : String(Number(value.toFixed(6)));
        result.set(id, {prevOdo: display(opening === undefined ? running : opening), odo: display(running), distance});
    }
    return result;
}

document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('route-trailer-button');
    const dialog = document.getElementById('route-trailer-dialog');
    const form = document.getElementById('route-trailer-form');
    const routeSelect = document.getElementById('route-trailer-row');
    const unitSelect = document.getElementById('route-trailer-unit');
    const cargo = document.getElementById('route-trailer-cargo');
    const output = document.getElementById('route-trailer-total');
    let rows = [];
    let units = new Map();
    let carId;
    let period;

    function updateTotal() {
        const mass = units.get(unitSelect.value)?.massKg || 0;
        const total = getRouteTrailerTotal(mass, cargo.value);
        cargo.setCustomValidity(total === null ? 'Введіть невід’ємну масу вантажу в тоннах.' : '');
        output.textContent = total === null ? cargo.validationMessage
            : `Маса з бази ${mass.toLocaleString('uk-UA')} кг · Разом ${total.toLocaleString('uk-UA', {maximumFractionDigits: 6})} т`;
        return total;
    }

    function loadRow() {
        const row = rows[Number(routeSelect.value)];
        const saved = JSON.parse(row.dataset.routeTrailer || 'null');
        units = new Map();
        unitSelect.replaceChildren(new Option('Без причепа / лафети', ''));
        for (const vehicle of carsData) {
            if (!vehicle.plate || !getTowedVehicleCategory(vehicle)) continue;
            const id = String(vehicle.id);
            const massKg = getRouteTrailerMassKg(vehicle.emptyWeight);
            if (massKg === null && saved?.id === id) continue;
            const option = new Option(`${vehicle.plate} — ${vehicle.model || ''}${massKg === null ? ' (масу не вказано)' : ''}`, id);
            option.disabled = massKg === null;
            unitSelect.add(option);
            if (massKg !== null) units.set(id, {id, plate: vehicle.plate, massKg});
        }
        if (saved && !units.has(saved.id)) {
            unitSelect.add(new Option(`${saved.plate} — збережена маса`, saved.id));
            units.set(saved.id, saved);
        }
        unitSelect.value = saved?.id || '';
        const value = row.querySelector('.row-tons').value;
        const cargoTons = Math.max(0, evaluateExpression(value) - (saved?.massKg || 0) / 1000);
        cargo.value = value ? String(Number(cargoTons.toFixed(6))) : '';
        updateTotal();
    }

    button.addEventListener('click', () => {
        carId = currentCarId;
        period = getStrictActivePeriod();
        if (button.hidden || !canEditDriverRoutes() || !isLoadedCarRoute(carId, period)) return;
        rows = [];
        routeSelect.replaceChildren();
        Array.from(document.querySelectorAll('#routes-tbody tr')).filter(row => !row.dataset?.dailyDecoration).forEach((row, index) => {
            const tons = row.querySelector('.row-tons');
            if (!tons || tons.disabled || isRouteRowReadOnly(row)) return;
            const name = row.cells[0]?.querySelector('input')?.value || 'Маршрут';
            routeSelect.add(new Option(`${index + 1}. ${name}`, String(rows.push(row) - 1)));
        });
        if (!rows.length) {
            alert('Немає доступного для редагування рядка маршруту.');
            return;
        }
        if (rows.includes(lastActiveRow)) routeSelect.value = String(rows.indexOf(lastActiveRow));
        loadRow();
        dialog.showModal();
    });

    routeSelect.addEventListener('change', loadRow);
    unitSelect.addEventListener('change', updateTotal);
    cargo.addEventListener('input', updateTotal);
    document.getElementById('route-trailer-cancel').addEventListener('click', () => dialog.close());
    form.addEventListener('submit', event => {
        event.preventDefault();
        const row = rows[Number(routeSelect.value)];
        const tons = row?.querySelector('.row-tons');
        if (!row?.isConnected || !tons || tons.disabled || button.hidden || !canEditDriverRoutes() ||
            isRouteRowReadOnly(row) || !isLoadedCarRoute(carId, period) ||
            Number(carId) !== Number(currentCarId) || period !== getStrictActivePeriod()) {
            output.textContent = 'Картка або рядок оновилися. Закрийте вікно та відкрийте його знову.';
            return;
        }
        const total = updateTotal();
        if (total === null) return;
        const trailer = units.get(unitSelect.value);
        setRouteTrailer(row, trailer);
        tons.value = trailer || cargo.value.trim() ? String(total) : '';
        saveCarRoutesForPeriod(period, carId);
        dialog.close();
    });
});
