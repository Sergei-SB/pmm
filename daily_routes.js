(function () {
    'use strict';

    const modeKey = 'pmm_daily_route_calculation';
    let daily = false;
    try { daily = sessionStorage.getItem(modeKey) === 'true'; } catch (_) {}

    function syncMode() {
        document.getElementById('card-view')?.classList.toggle('daily-route-mode', daily);
        document.getElementById('btn-dev-ten-day-calculation')?.setAttribute('aria-pressed', String(!daily));
        document.getElementById('btn-dev-daily-calculation')?.setAttribute('aria-pressed', String(daily));
    }

    window.isDailyRouteCalculation = () => daily;
    window.setDailyRouteCalculation = function (enabled) {
        if (routeEditorRole() !== 'developer') return;
        daily = enabled === true;
        try { sessionStorage.setItem(modeKey, String(daily)); } catch (_) {}
        syncMode();
        if (!daily) document.querySelectorAll('#routes-tbody [data-daily-decoration]').forEach(row => row.remove());
        updateRouteTotals();
    };
    document.addEventListener('DOMContentLoaded', syncMode);

    window.calculateDailyRoutes = function (rows, baseRate, carFormulas, isMiles) {
        const groups = [];
        let lastDay = 0;
        for (const row of rows) {
            const storedDay = Number(row.dataset.routeDay);
            const day = Number.isInteger(storedDay) && storedDay >= 1 && storedDay <= 31 ? storedDay : 0;
            for (let missingDay = lastDay + 1; day && missingDay < day; missingDay++) {
                groups.push({day: missingDay, rows: []});
            }
            lastDay = Math.max(lastDay, day);
            if (groups.at(-1)?.day !== day) groups.push({day, rows: []});
            groups.at(-1).rows.push(row);
        }
        if (!groups.length) groups.push({day: 1, rows: []});

        let totalFuelCents = 0;
        const totals = new Map();
        for (const group of groups) {
            const routes = group.rows.map(row => ({
                name: row.querySelector('input[type="text"]')?.value,
                km: evaluateExpression(row.querySelector('.total-col')?.value),
                tkm: evaluateExpression(row.querySelector('.row-tkm')?.value)
            })).filter(route => route.km || route.tkm);
            const result = calculateRouteFuel(routes, baseRate, carFormulas, isMiles);
            group.distance = routes.reduce((sum, route) => sum + route.km, 0) * (isMiles ? 1.61 : 1);
            group.result = result;
            totalFuelCents += Math.round(result.totalFuel * 100);
            for (const item of result.calculatedResults) {
                const total = totals.get(item.id);
                if (total) {
                    total.km += item.km;
                    total.resVal += item.resVal;
                } else {
                    totals.set(item.id, {...item});
                }
            }
        }
        return {groups, baseRate, totalFuel: totalFuelCents / 100, calculatedResults: [...totals.values()]};
    };

    function periodDays() {
        const match = /^(\d{1,2})\.(\d{1,2})(?:\.\d{4})?\s*-\s*(\d{1,2})\.\2(?:\.\d{4})?$/.exec(getStrictActivePeriod());
        if (!match) return [];
        const start = Number(match[1]);
        const count = Number(match[3]) - start + 1;
        return Array.from({length: count}, (_, index) =>
            String(start + index).padStart(2, '0') + '.' + match[2].padStart(2, '0'));
    }

    function formatNumber(value, digits = 2) {
        return new Intl.NumberFormat('uk-UA', {maximumFractionDigits: digits, useGrouping: false}).format(value);
    }

    function formulaLine(group, baseRate) {
        const parts = group.result.calculatedResults
            .filter(item => item.type !== 'work' && item.type !== 'adblue' && item.km)
            .map(item => {
                const rate = item.type === 'cargoTransport' ? '0,9' : formatNumber(baseRate, 6);
                const modifier = item.textOp ? ' ' + item.textOp : '';
                return `${formatNumber(item.km)} × ${rate} / 100${modifier} = ${formatNumber(item.resVal)}`;
            });
        const fuel = group.result.totalFuel;
        return `${parts.length ? parts.join('; ') + ' · Разом ' : 'Витрачено '}${formatNumber(fuel)} л ≈ ${Math.round(fuel)} л`;
    }

    function addDayButton(label, insert, routeDay, disabled, unavailable = false) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'action-btn daily-route-action';
        button.textContent = label;
        if (unavailable) button.dataset.unavailable = 'true';
        button.disabled = disabled || unavailable;
        button.addEventListener('click', () => {
            if (unavailable || !canEditDriverRoutes() || isAwaitingRouteProtection()) return;
            addRouteRow(undefined, undefined, '', null, routeDay, insert());
            saveCarRoutesForPeriod();
        });
        return button;
    }

    window.renderDailyRoutes = function (dailyResult, closingFuel) {
        const tbody = document.getElementById('routes-tbody');
        if (!tbody) return;
        tbody.querySelectorAll('[data-daily-decoration]').forEach(row => row.remove());
        const days = periodDays();
        const columns = document.getElementById('routes-thead').rows[0].cells.length;
        const disabled = !canEditDriverRoutes() || isAwaitingRouteProtection();
        const {groups, baseRate, calculatedResults} = dailyResult;
        function insertDecoration(position, className) {
            const row = document.createElement('tr');
            row.dataset.dailyDecoration = 'true';
            row.className = className;
            tbody.insertBefore(row, position);
            const cell = row.insertCell();
            cell.colSpan = columns;
            return cell;
        }

        for (const [index, group] of groups.entries()) {
            const nextRoute = groups.slice(index + 1).find(item => item.rows.length)?.rows[0] ?? null;
            const start = group.rows[0] ?? nextRoute;
            const end = group.rows.at(-1)?.nextSibling ?? nextRoute;
            const title = group.day ? days[group.day - 1] || `День ${group.day}` : 'Маршрути без дати';
            insertDecoration(start, 'daily-route-date').textContent = title;
            const cell = insertDecoration(end, 'daily-route-footer');
            cell.appendChild(addDayButton('+ Додати рядок маршруту', () => cell.parentElement, group.day, disabled));
            const line = document.createElement('div');
            line.className = 'daily-route-formula';
            line.textContent = `${formatNumber(group.distance)} км · ${formulaLine(group, baseRate)}`;
            if (group === groups.at(-1)) {
                line.textContent += ` · Залишок ${formatNumber(closingFuel)} л`;
            }
            cell.appendChild(line);

            const nextDay = group.day + 1;
            const unavailable = nextDay > days.length || groups.some(item => item.day === nextDay);
            cell.appendChild(addDayButton('+ Додати день', () => cell.parentElement.nextSibling, nextDay, disabled, unavailable));
        }
        const modifiers = calculatedResults.filter(item => item.textOp)
            .map(item => `${item.label.replace(/:$/, '')} = ${item.textOp.replace(/\s/g, '')}`);
        const adBlue = calculatedResults.find(item => item.type === 'adblue');
        if (adBlue) modifiers.push(`Витрата AdBlue: ${formatNumber(adBlue.resVal)} л`);
        document.getElementById('daily-route-legend').textContent = modifiers.join(' · ');
    };
})();
