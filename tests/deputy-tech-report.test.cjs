const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
    const container = {innerHTML: '', querySelectorAll: () => []};
    const calls = [];
    const c = {
        Intl, console,
        document: {getElementById: () => container},
        getCurrentAppRole: () => 'developer',
        getSavedPeriodsList: () => ['01.11-10.11', '11.11-20.11', '21.11-30.11'],
        getAvailableMonthsList: () => ['11.2026'],
        subdivisionAllEquipmentPeriods: () => ['01.12-31.12'],
        parsePeriodDateVal: p => 20260000 + Number(p.split('-')[0].split('.')[1]) * 100 + Number(p.split('.')[0]),
        equipmentFullMonth: p => '01.' + p.split('.')[1] + '-30.' + p.split('.')[1],
        equipmentReportEscape: text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
        getUniqueSubdivisions: () => ['РМТЗ', 'ВТО'],
        buildSubdivisionTopPrintButtonHtml: action => '<button onclick="' + action + '">Друк звіту</button>',
        calculateSubStatsDetailed: (name, periods) => {
            const cars = {dpFuel: periods.length * 100, abFuel: periods.length * 50};
            const eq = {dpFuel: periods.length * 20, abFuel: periods.length * 10};
            return {cars, eq, total: {dpFuel: cars.dpFuel + eq.dpFuel, abFuel: cars.abFuel + eq.abFuel}};
        },
        calculateEquipmentSubdivisionTotals: (periods, name) => {
            calls.push({periods, name});
            return {dpFuel: 400, abFuel: 200};
        }
    };
    c.window = c;
    vm.createContext(c);
    vm.runInContext(fs.readFileSync('deputy_tech_report.js', 'utf8'), c);
    return {c, container, calls};
}

test('Shows period/month vehicle and equipment totals and sums the displayed subdivisions', () => {
    const {c, container, calls} = fixture();
    c.renderDeputyTechReport();
    assert.match(container.innerHTML, /Зведений звіт по підрозділах для зампотехів/);
    assert.match(container.innerHTML, /printDeputyTechReport\(\)/);
    assert.match(container.innerHTML, /<td>100<\/td><td>20<\/td><td>120<\/td><td>300<\/td><td>400<\/td><td>700<\/td>/);
    assert.match(container.innerHTML, /ББССП — усього/);
    assert.match(container.innerHTML, /<td>200<\/td><td>40<\/td><td>240<\/td><td>600<\/td><td>800<\/td><td>1\s400<\/td>/);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].periods[0], '01.11-30.11');
    assert.match(container.innerHTML, /value="12.2026"/);
});

test('Month without vehicle reports still includes monthly equipment receipts', () => {
    const {c, container} = fixture();
    vm.runInContext("deputyTechSelection.month = '12.2026'", c);
    c.renderDeputyTechReport();
    assert.match(container.innerHTML, /<td>0<\/td><td>400<\/td><td>400<\/td>/);
});

test('Unavailable report is not rendered for a role without subdivision access', () => {
    const {c, container} = fixture();
    c.getCurrentAppRole = () => 'user';
    c.canRoleAccess = () => false;
    c.renderDeputyTechReport();
    assert.equal(container.innerHTML, '');
});
