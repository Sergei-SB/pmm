// Shared fuel limits: litres/hour × operating hours/day × days.
function equipmentLimitNumber(value) {
    const text = String(value ?? '').trim().replace(',', '.');
    if (!/^\d+(?:\.\d*)?$/.test(text)) return null;
    const number = Number(text);
    return Number.isFinite(number) && number >= 0 ? number : null;
}

function applyEquipmentFuelLimits(item, defaultHours = 12, overwrite = false) {
    const rate = equipmentLimitNumber(item.consumption);
    if (rate === null) return item;
    const blank = value => value === undefined || value === null || String(value).trim() === '';
    const hours = blank(item.motoHoursDay) ? defaultHours : equipmentLimitNumber(item.motoHoursDay);
    if (hours === null || hours > 24) return item;
    if (blank(item.motoHoursDay)) item.motoHoursDay = String(hours);
    for (const days of [5,10,30]) {
        const field = 'max' + days + 'Days';
        if (overwrite || blank(item[field])) item[field] = (rate * hours * days).toFixed(2);
    }
    return item;
}

function updateEquipmentFuelLimitCells(item, handler) {
    if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
    document.querySelectorAll('input[oninput]').forEach(input => {
        const action = input.getAttribute('oninput') || '';
        for (const field of ['max5Days','max10Days','max30Days','motoHoursDay']) {
            if (action.startsWith(`${handler}(${item.id}, '${field}',`)) input.value = item[field] ?? '';
        }
    });
}
