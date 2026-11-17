(() => {
    const prefix = 'equipment_report_data_';
    const number = new Intl.NumberFormat('uk-UA', {maximumFractionDigits: 3});
    const hasValue = value => String(value ?? '').trim() !== '';

    function receiptDates(value, year) {
        return Array.from(String(value ?? '').matchAll(/\b(?:(\d{4}-\d{2}-\d{2})|(\d{1,2})[.,](\d{1,2})(?:[.,](\d{4}))?)\b/g),
            ([, iso, day, month, explicitYear]) => iso || `${explicitYear || year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
            .filter(date => {
                const parsed = new Date(date + 'T00:00:00Z');
                return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === date;
            });
    }

    function entries(from, to) {
        const reports = new Map();
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key?.startsWith(prefix)) continue;
            const period = key.slice(prefix.length);
            const info = equipmentHoursMonth(period);
            if (info) reports.set(info.month, equipmentFullMonth(period));
        }
        const rows = [];
        for (const [month, period] of [...reports].sort(([a], [b]) => a.localeCompare(b))) {
            const year = month.slice(0, 4);
            const first = month + '-01';
            const last = month + '-' + period.split('-')[1].slice(0, 2);
            if (first > to || last < from) continue;
            const fullMonth = first >= from && last <= to;
            const data = readEquipmentReportData(period);
            for (const item of getEquipmentReportItems(period, true)) {
                const record = data[item.uniqueId];
                if (!record) continue;
                const oils = {};
                let fuel = 0;
                let uncertain = false;
                let included = false;
                for (let group = 1; group <= 3; group++) {
                    const groupStart = month + '-' + ['01', '11', '21'][group - 1];
                    const groupEnd = group === 3 ? last : month + '-' + ['10', '20'][group - 1];
                    const received = evaluateExpression(record['p' + group + 'Fuel']);
                    const oil = parseFluidEntries(record['p' + group + 'Oil']);
                    if (!received && !Object.keys(oil).length) continue;
                    const field = 'p' + group + 'Date';
                    const dates = receiptDates(record[field], record[field + 'Year'] || year);
                    const inside = dates.filter(date => date >= from && date <= to).length;
                    if (fullMonth || (dates.length ? inside === dates.length : groupStart >= from && groupEnd <= to)) {
                        fuel += received;
                        mergeFluidMaps(oils, oil);
                        included = true;
                    } else if (dates.length ? inside > 0 : groupStart <= to && groupEnd >= from) {
                        uncertain = true;
                    }
                }
                const used = fullMonth && !uncertain && hasValue(record.prevFuel) && hasValue(record.nextFuel)
                    ? evaluateExpression(record.prevFuel) + [1, 2, 3].reduce((sum, group) => sum + evaluateExpression(record['p' + group + 'Fuel']), 0) - evaluateExpression(record.nextFuel)
                    : null;
                if (included || uncertain || used !== null) rows.push({month, item, fuel, oils, used, uncertain});
            }
        }
        return rows;
    }

    window.openEquipmentRangeReport = function () {
        if (document.getElementById('equipment-range-dialog')) return;
        const dialog = document.createElement('dialog');
        dialog.id = 'equipment-range-dialog';
        dialog.setAttribute('aria-labelledby', 'equipment-range-title');
        dialog.style.cssText = 'width:min(1040px,94vw);max-height:88vh;border:1px solid #bdc3c7;border-radius:10px;padding:18px;box-sizing:border-box';
        dialog.innerHTML = `
            <h2 id="equipment-range-title">Звіт по обладнанню за датами</h2>
            <form style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0">
                <label>З <input type="date" name="from" required></label>
                <label>По <input type="date" name="to" required></label>
                <button class="action-btn">Сформувати</button>
                <button type="button" class="action-btn" data-close>Закрити</button>
            </form>
            <p role="status"></p>
            <div style="overflow:auto"><table style="width:100%;border-collapse:collapse">
                <thead><tr><th>Місяць</th><th>Модель</th><th>Серійний номер</th><th>Тип палива</th><th>Отримано палива</th><th>Отримано мастила</th><th>Витрачено палива</th></tr></thead>
                <tbody></tbody>
            </table></div>`;
        const form = dialog.querySelector('form');
        const body = dialog.querySelector('tbody');
        const status = dialog.querySelector('[role="status"]');
        form.addEventListener('submit', event => {
            event.preventDefault();
            body.replaceChildren();
            const from = form.elements.from.value;
            const to = form.elements.to.value;
            if (!from || !to || from > to) { status.textContent = 'Вкажіть правильний проміжок дат.'; return; }
            try {
                saveCurrentEquipmentReportSilently();
                const rows = entries(from, to);
                for (const {month, item, fuel, oils, used, uncertain} of rows) {
                    const row = body.insertRow();
                    for (const value of [month, item.model, item.serialNumber, item.fuelType,
                        number.format(fuel) + ' л' + (uncertain ? ' + невизначено' : ''),
                        formatFluidBreakdown(oils).replace(/<[^>]*>/g, ' ') + (uncertain ? ' + невизначено' : ''),
                        used === null ? '—' : used < 0 ? 'Перевірте залишки' : number.format(used) + ' л']) {
                        row.insertCell().textContent = value ?? '';
                    }
                }
                status.textContent = (rows.length ? 'Знайдено записів: ' + rows.length + '. ' : 'За ці дати записів немає. ') +
                    'Витрата палива визначається за балансом повного місяця. Для частини місяця доступні записи заправок. Витрата мастила окремо не фіксується.';
            } catch (_) {
                status.textContent = 'Не вдалося прочитати або зберегти дані звіту.';
            }
        });
        dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
        dialog.addEventListener('close', () => dialog.remove(), {once: true});
        document.body.append(dialog);
        dialog.showModal();
    };
})();
