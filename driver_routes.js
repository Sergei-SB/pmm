// Driver readings update the existing route total used by the card and reports.
function parseDriverOdometer(value) {
    const text = String(value ?? '').trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(text)) return null;
    const number = Number(text.replace(',', '.'));
    return Number.isFinite(number) && number <= Number.MAX_SAFE_INTEGER ? number : null;
}

function applyDriverOdometer(row, totalInput, previous) {
    const reading = row.dataset.driverOdometer || '';
    row.driverReadingError = '';
    row.driverReadingIsBaseline = false;
    if (!totalInput) return null;
    const odometer = parseDriverOdometer(reading);
    if (reading && odometer === null) row.driverReadingError = 'Введіть коректний показник';
    else if (odometer !== null && previous !== null && odometer < previous) {
        row.driverReadingError = 'Менше попереднього показника';
    }

    if (odometer === null || row.driverReadingError) {
        // Retain the original technical entry if the driver reading is removed or invalid.
        if (row.dataset.driverManualTotal !== undefined) totalInput.value = row.dataset.driverManualTotal;
        if (!reading) delete row.dataset.driverManualTotal;
        return null;
    }
    if (row.dataset.driverManualTotal === undefined) row.dataset.driverManualTotal = totalInput.value;
    row.driverReadingIsBaseline = previous === null;
    totalInput.value = previous === null ? '0' : String(Number((odometer - previous).toFixed(8)));
    return odometer;
}

function canEditDriverRoutes() {
    const role = typeof window.getCurrentAppRole === 'function' ? window.getCurrentAppRole()
        : (typeof currentRole !== 'undefined' ? currentRole : window.currentRole);
    return role === 'developer' || Boolean(window.canRoleEdit?.(role, 'card') && window.canRoleDo?.(role, 'card_routes_edit'));
}

function refreshDriverRouteView(car) {
    const panel = document.getElementById('driver-route-panel');
    if (!panel || panel.hidden) return;
    const tbody = document.getElementById('driver-routes-tbody');
    const sourceRows = Array.from(document.querySelectorAll('#routes-tbody tr'));
    if (!car && typeof carsData !== 'undefined' && Array.isArray(carsData) && typeof currentCarId !== 'undefined') {
        car = carsData.find(item => Number(item.id) === Number(currentCarId));
    }
    const inMiles = Boolean(car?.isMiles);
    document.getElementById('driver-odometer-heading').textContent = inMiles ? 'Одометр, милі' : 'Одометр, км';
    const truck = isCarTruck(car);
    document.getElementById('driver-cargo-heading').textContent = inMiles ? 'Вантаж, милі' : 'Вантаж, км';
    document.getElementById('driver-trailer-heading').textContent = inMiles ? 'Причіп, милі' : 'Причіп, км';
    document.getElementById('driver-tons-heading').hidden = !truck;
    document.getElementById('driver-tkm-heading').hidden = !truck;
    const canEdit = canEditDriverRoutes();

    // Keep the same inputs while a driver is typing. Rebuild only when the route rows change.
    if (tbody.rows.length !== sourceRows.length || sourceRows.some((row, index) => tbody.rows[index]?.sourceRoute !== row)) {
        tbody.replaceChildren();
        sourceRows.forEach((sourceRoute, index) => {
            const row = tbody.insertRow();
            row.sourceRoute = sourceRoute;
            row.insertCell().textContent = index + 1;
            row.insertCell();
            const input = document.createElement('input');
            input.type = 'text';
            input.inputMode = 'decimal';
            input.maxLength = 24;
            input.setAttribute('aria-label', `Одометр, рядок ${index + 1}`);
            row.insertCell().appendChild(input);
            row.insertCell();
            for (const [selector, label] of [['.row-cargo', 'З вантажем'], ['.row-trailer', 'З причепом'], ['.row-tons', 'Кількість тонн']]) {
                const cell = row.insertCell();
                const sourceInput = sourceRoute.querySelector(selector);
                if (!sourceInput) { cell.hidden = true; continue; }
                const field = document.createElement('input');
                field.type = 'text';
                field.inputMode = 'decimal';
                field.setAttribute('aria-label', `${label}, рядок ${index + 1}`);
                cell.appendChild(field);
                field.addEventListener('input', () => {
                    if (panel.hidden || !canEditDriverRoutes()) { field.value = sourceInput.value; return; }
                    sourceInput.value = field.value;
                    saveCarRoutesForPeriod();
                });
            }
            row.insertCell().hidden = !truck;
            row.addEventListener('click', () => { lastActiveRow = sourceRoute; });
            input.addEventListener('input', () => {
                if (panel.hidden || !canEditDriverRoutes()) {
                    input.value = sourceRoute.dataset.driverOdometer || '';
                    return;
                }
                sourceRoute.dataset.driverOdometer = input.value.trim();
                updateRouteTotals();
                if (!sourceRoute.driverReadingError) saveCarRoutesForPeriod();
            });
        });
    }

    Array.from(tbody.rows).forEach((row, index) => {
        const sourceRoute = sourceRows[index];
        const input = row.cells[2].firstElementChild;
        row.cells[1].textContent = sourceRoute.cells[0]?.querySelector('input')?.value || '—';
        if (document.activeElement !== input) input.value = sourceRoute.dataset.driverOdometer || '';
        input.disabled = !canEdit;
        input.readOnly = !canEdit;
        const total = sourceRoute.querySelector('.total-col')?.value;
        const km = total && !sourceRoute.driverReadingIsBaseline ? evaluateExpression(total) * (inMiles ? 1.61 : 1) : null;
        const error = sourceRoute.driverReadingError;
        input.setAttribute('aria-invalid', String(Boolean(error)));
        row.cells[3].textContent = error || (km === null ? '—' : km.toLocaleString('uk-UA', { maximumFractionDigits: 2 }));
        row.cells[3].classList.toggle('driver-route-error', Boolean(error));
        ['.row-cargo', '.row-trailer', '.row-tons'].forEach((selector, fieldIndex) => {
            const field = row.cells[4 + fieldIndex].firstElementChild;
            if (!field) return;
            if (document.activeElement !== field) field.value = sourceRoute.querySelector(selector).value;
            field.disabled = !canEdit;
            field.readOnly = !canEdit;
        });
        row.cells[7].textContent = sourceRoute.querySelector('.row-tkm')?.value || '—';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const modeSwitch = document.getElementById('route-mode-switch');
    const card = document.getElementById('card-view');
    const panel = document.getElementById('driver-route-panel');
    if (!modeSwitch || !card || !panel) return;
    modeSwitch.addEventListener('click', event => {
        const button = event.target.closest('[data-route-mode]');
        if (!button) return;
        const driverMode = button.dataset.routeMode === 'driver';
        panel.hidden = !driverMode;
        card.classList.toggle('driver-route-mode', driverMode);
        modeSwitch.querySelectorAll('button').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
        if (driverMode) refreshDriverRouteView();
    });
});
