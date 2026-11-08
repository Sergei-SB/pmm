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
        document.querySelectorAll('#routes-tbody tr').forEach((row, index) => {
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
