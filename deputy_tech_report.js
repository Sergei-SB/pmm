function canViewDeputyTechReport() {
    const role = window.getCurrentAppRole?.() ?? window.currentRole ?? 'user';
    return role === 'developer' || Boolean(window.canRoleAccess?.(role, 'subdivisions'));
}

const deputyTechSelection = { period: '', month: '' };
const deputyTechLitres = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 });

function renderDeputyTechReport(keepSelection = false) {
    if (!canViewDeputyTechReport()) return;
    const container = document.getElementById('deputy-tech-report');
    const periods = [...getSavedPeriodsList()];
    const months = [...getAvailableMonthsList()];
    const [yearToday, monthToday, dayToday] = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date()).split('-');
    const currentMonth = monthToday + '.' + yearToday;
    const day = Number(dayToday);
    const startDay = day <= 10 ? '01' : day <= 20 ? '11' : '21';
    const endDay = day <= 10 ? 10 : day <= 20 ? 20 : new Date(Number(yearToday), Number(monthToday), 0).getDate();
    const shortPeriod = startDay + '.' + monthToday + '-' + endDay + '.' + monthToday;
    const datedPeriod = startDay + '.' + currentMonth + '-' + endDay + '.' + currentMonth;
    const currentPeriod = String(parsePeriodDateVal(shortPeriod)).slice(0, 4) === yearToday
        ? shortPeriod : datedPeriod;
    if (!periods.includes(currentPeriod)) periods.push(currentPeriod);
    periods.sort((a, b) => parsePeriodDateVal(a) - parsePeriodDateVal(b));
    if (!months.includes(currentMonth)) months.push(currentMonth);
    const monthKey = period => {
        const date = Math.floor(parsePeriodDateVal(period) / 100);
        return String(date % 100).padStart(2, '0') + '.' + Math.floor(date / 100);
    };
    const monthRange = key => {
        const [month, year] = key.split('.');
        return '01.' + month + '–' + new Date(Number(year), Number(month), 0).getDate() + '.' + month + '.' + year;
    };

    // Include equipment-only months even when no vehicle report was created.
    for (const entry of subdivisionAllEquipmentPeriods([])) {
        const key = monthKey(entry);
        if (/^\d{2}\.\d{4}$/.test(key) && !months.includes(key)) months.push(key);
    }
    months.sort((a, b) => Number(a.slice(3) + a.slice(0, 2)) - Number(b.slice(3) + b.slice(0, 2)));

    if (!keepSelection || !periods.includes(deputyTechSelection.period)) deputyTechSelection.period = currentPeriod;
    if (!keepSelection || !months.includes(deputyTechSelection.month)) deputyTechSelection.month = currentMonth;
    const { period, month } = deputyTechSelection;
    const monthlyPeriods = periods.filter(entry => monthKey(entry) === month);
    const [monthNumber, year] = month.split('.');
    const equipmentMonth = equipmentFullMonth('01.' + monthNumber + '.' + year);
    const escape = equipmentReportEscape;
    const subdivisions = new Set(getUniqueSubdivisions());
    const equipmentPeriods = new Set([equipmentFullMonth(period), equipmentMonth]);
    for (const equipmentPeriod of equipmentPeriods) {
        if (!equipmentPeriod) continue;
        for (const item of getEquipmentReportItems(equipmentPeriod)) {
            const name = normalizeSubdivision(item.subdivision);
            if (name) subdivisions.add(name);
        }
    }
    const reportSubdivisions = [...subdivisions].filter(name => name.toUpperCase() !== 'ББССП');
    const format = value => deputyTechLitres.format(value);
    const cells = (stats, fuel) => [stats.cars[fuel], stats.eq[fuel], stats.total[fuel]]
        .map(value => '<td>' + format(value) + '</td>').join('');
    const fluidCells = ({total}) => [
        formatFluidBreakdown(total.oilMap),
        formatFluidBreakdown(total.washerMap),
        format(total.adblue ?? 0)
    ].map(value => '<td rowspan="2">' + escape(value) + '</td>').join('');
    const rows = (label, periodStats, monthStats) => ['dpFuel', 'abFuel'].map((fuel, index) =>
        '<tr>' + (index === 0 ? '<th rowspan="2" scope="rowgroup">' + escape(label) + '</th>' : '') +
        '<th scope="row" class="deputy-tech-fuel">' + (index === 0 ? 'ДП' : 'АБ') + '</th>' +
        cells(periodStats, fuel) + (index === 0 ? fluidCells(periodStats) : '') +
        cells(monthStats, fuel) + (index === 0 ? fluidCells(monthStats) : '') + '</tr>'
    ).join('');
    const summary = { period: {cars: {dpFuel: 0, abFuel: 0}, eq: {dpFuel: 0, abFuel: 0}, total: {dpFuel: 0, abFuel: 0}}, month: {cars: {dpFuel: 0, abFuel: 0}, eq: {dpFuel: 0, abFuel: 0}, total: {dpFuel: 0, abFuel: 0}} };
    for (const stats of Object.values(summary)) {
        Object.assign(stats.total, {oilMap: {}, washerMap: {}, adblue: 0});
    }
    const group = (label, calculate) => {
        const periodStats = calculate([period]);
        const monthStats = calculate(monthlyPeriods);
        // Equipment is stored by calendar month, including months without vehicle reports.
        monthStats.eq = calculateEquipmentSubdivisionTotals([equipmentMonth], label);
        for (const [key, stats] of [['period', periodStats], ['month', monthStats]]) {
            for (const field of ['oilMap', 'washerMap']) {
                stats.total[field] = mergeFluidMaps(
                    mergeFluidMaps({}, stats.cars[field] ?? {}), stats.eq[field] ?? {}
                );
                mergeFluidMaps(summary[key].total[field], stats.total[field]);
            }
            stats.total.adblue = (stats.cars.adblue ?? 0) + (stats.eq.adblue ?? 0);
            summary[key].total.adblue += stats.total.adblue;
        }
        for (const fuel of ['dpFuel', 'abFuel']) {
            monthStats.total[fuel] = monthStats.cars[fuel] + monthStats.eq[fuel];
            for (const [key, stats] of [['period', periodStats], ['month', monthStats]]) {
                for (const source of ['cars', 'eq', 'total']) summary[key][source][fuel] += stats[source][fuel];
            }
        }
        return rows(label, periodStats, monthStats);
    };
    const selector = (field, title, values, label) => {
        const index = values.indexOf(deputyTechSelection[field]);
        return '<div class="deputy-tech-selector"><label for="deputy-tech-' + field + '">' + title + '</label>' +
            '<button type="button" class="action-btn" aria-label="Попередній ' + title.toLowerCase() + '" data-field="' + field + '" data-step="-1"' + (index <= 0 ? ' disabled' : '') + '>◄</button>' +
            '<select id="deputy-tech-' + field + '" data-field="' + field + '">' + values.map(value =>
                '<option value="' + escape(value) + '"' + (value === deputyTechSelection[field] ? ' selected' : '') + '>' + escape(label(value)) + '</option>'
            ).join('') + '</select>' +
            '<button type="button" class="action-btn" aria-label="Наступний ' + title.toLowerCase() + '" data-field="' + field + '" data-step="1"' + (index >= values.length - 1 ? ' disabled' : '') + '>►</button></div>';
    };

    container.innerHTML = `
        ${buildSubdivisionTopPrintButtonHtml('printDeputyTechReport()')}
        <h2>Зведений звіт по підрозділам для зампотехів</h2>
        <div class="deputy-tech-controls no-print">
            ${selector('period', 'Період', periods, value => value)}
            ${selector('month', 'Місяць', months, monthRange)}
        </div>
        <div class="deputy-tech-table">
            <table>
                <colgroup><col style="width:12%"><col style="width:4%">${'<col style="width:8%"><col style="width:9%"><col style="width:8.5%"><col style="width:7.5%"><col style="width:5%"><col style="width:4%">'.repeat(2)}</colgroup>
                <thead>
                    <tr><th rowspan="2" scope="col">Підрозділ</th><th rowspan="2" scope="col">Пальне</th>
                        <th colspan="6" scope="colgroup">Період ${escape(period)}</th>
                        <th colspan="6" scope="colgroup">За місяць ${escape(monthRange(month))}</th></tr>
                    <tr>${'<th scope="col">Авто, л</th><th scope="col">Обладнання, л</th><th scope="col">Усього, л</th><th scope="col">Мастила, л</th><th scope="col">Омивач, л</th><th scope="col">AdBlue, л</th>'.repeat(2)}</tr>
                </thead>
                ${reportSubdivisions.map(name => '<tbody>' + group(name, dates => calculateSubStatsDetailed(name, dates)) + '</tbody>').join('')}
                <tfoot>${rows('ББССП — усього', summary.period, summary.month)}</tfoot>
            </table>
        </div>`;

    for (const control of container.querySelectorAll('[data-field]')) {
        const { field, step } = control.dataset;
        const event = step ? 'click' : 'change';
        control.addEventListener(event, () => {
            const values = field === 'period' ? periods : months;
            deputyTechSelection[field] = step ? values[values.indexOf(deputyTechSelection[field]) + Number(step)] : control.value;
            renderDeputyTechReport(true);
            const replacement = container.querySelector(step
                ? 'button[data-field="' + field + '"][data-step="' + step + '"]:not(:disabled)'
                : 'select[data-field="' + field + '"]');
            (replacement || container.querySelector('select[data-field="' + field + '"]')).focus();
        });
    }
}

function printDeputyTechReport() {
    if (!canViewDeputyTechReport()) return;
    const content = document.getElementById('deputy-tech-report');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Дозвольте відкривати спливні вікна, щоб надрукувати звіт.');
        return;
    }
    printWindow.document.write(`<!doctype html><html lang="uk"><meta charset="utf-8">
        <title>Звіт для зампотехів</title><style>
        @page { size: A4 landscape; margin: 9mm; margin-bottom: 4mm; @bottom-left { content: "ПММ: Стропа & Компанія"; font: 8pt Arial, sans-serif; } @bottom-right { content: counter(page) "/" counter(pages); font: 8pt Arial, sans-serif; } }
        body { margin: 0; font: 10pt Arial, sans-serif; color: #172533; }
        main { width: 279mm; display: flow-root; }
        h2 { font-size: 14pt; text-align: center; margin: 0 0 3mm; }
        table { width: 100%; border-collapse: collapse; text-align: center; }
        th, td { border: 1px solid #a5adb2; padding: 1px 4px; overflow-wrap: anywhere; }
        table { table-layout: fixed; }
        tbody, tfoot, tr { break-inside: avoid; }
        tbody th[scope="rowgroup"], tfoot th[scope="rowgroup"] { text-align: left; }
        thead, tfoot { background: #edf1f3; font-weight: bold; }
        td:nth-last-child(4), td:last-child { font-weight: bold; }
        .ruler { position: absolute; height: 190mm; width: 0; visibility: hidden; }
        </style><body><div class="ruler"></div><main></main></body></html>`);
    printWindow.document.close();
    const sheet = printWindow.document.querySelector('main');
    sheet.append(content.querySelector('h2').cloneNode(true), content.querySelector('table').cloneNode(true));
    const availableHeight = printWindow.document.querySelector('.ruler').getBoundingClientRect().height;
    const scale = Math.min(1, availableHeight / sheet.getBoundingClientRect().height);
    // Keep the measured column widths: enlarging the sheet after measuring
    // could change wrapping and push the last rows onto another page.
    sheet.style.zoom = scale;
    printWindow.focus();
    printWindow.print();
}
