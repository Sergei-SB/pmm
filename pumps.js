// ==========================================
// ЛОГІКА ОБЛІКУ ПОМП (pumps.js)
// ==========================================

const CURRENT_PUMP_VERSION = 'v2_full_list';

let defaultPumpsData = [];

let pumpsFilters = { model: "", subdivision: "", responsiblePerson: "", locationSubdivision: "" };

function getPumpsList() {
    const stored = localStorage.getItem('pumps_custom_data');
    if (stored === null) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error('Неправильний формат збережених помп');
    return parsed.map(item => typeof applyEquipmentFuelLimits === 'function' ? applyEquipmentFuelLimits(item) : item);
}

function canManagePumps(feature = 'eq_edit_hours') {
    const role = typeof window.getCurrentAppRole === 'function' ? window.getCurrentAppRole() : (window.currentRole || 'user');
    if (role === 'developer' || role === 'dev') return true;
    return typeof window.canRoleEdit === 'function' && window.canRoleEdit(role, 'equipment') &&
        (typeof window.canRoleDo !== 'function' || window.canRoleDo(role, feature));
}

function escapePumpValue(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function savePumpsList(list) { localStorage.setItem('pumps_custom_data', JSON.stringify(list)); }

function printPumpsTable() {
    const printWindow = window.open('', '_blank');
    let list = getPumpsList().filter(item => !/знищ/ui.test(String(item.note || item.comment || '')));
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8"><title>Облік помп</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 10px; }
                h2 { text-align: center; margin-bottom: 15px; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #333; padding: 4px 6px; text-align: center; }
                th { background-color: #2e7d32 !important; color: white !important; font-size: 11px; }
                td:nth-child(2) { text-align: left; }
                @media print { @page { size: landscape; margin: 10mm; } }
            </style>
        </head>
        <body>
            <h2>ОБЛІК ТА НОРМИ ВИТРАТ ПАЛИВА І МАСТИЛ ПОМП</h2>
            <table>
                <thead>
                    <tr>
                        <th>№</th><th>Модель</th><th>кВт</th><th>Тип пал.</th><th>Розхід літ./год.</th><th>Норма мастил</th>
                        <th>Макс з. на 5 діб</th><th>Макс з. на 10 діб</th><th>Макс з. на 30 діб</th><th>Норма мотог.</th>
                        <th>Підрозділ</th><th>Мат. Відп. Особа</th><th>Де знаходиться</th><th>Серійний номер</th><th>Примітка</th>
                    </tr>
                </thead>
                <tbody>
    `;
    list.forEach((item, index) => {
        html += `<tr>
            <td>${index + 1}</td><td>${escapePumpValue(item.model)}</td><td>${escapePumpValue(item.kw)}</td><td>${escapePumpValue(item.fuelType)}</td>
            <td>${escapePumpValue(item.consumption)}</td><td>${escapePumpValue(item.oilNorm10Days)}</td><td>${escapePumpValue(item.max5Days)}</td>
            <td>${escapePumpValue(item.max10Days)}</td><td>${escapePumpValue(item.max30Days)}</td><td>${escapePumpValue(item.motoHoursDay)}</td>
            <td>${escapePumpValue(item.subdivision)}</td><td>${escapePumpValue(item.responsiblePerson)}</td><td>${escapePumpValue(item.locationSubdivision)}</td>
            <td>${escapePumpValue(item.serialNumber)}</td><td>${escapePumpValue(item.note)}</td>
        </tr>`;
    });
    html += `</tbody></table></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
}

function renderPumpsView() {
    const wrapper = document.getElementById('equipment-table-wrapper');
    if (!wrapper) return;

    ['print-generators-btn', 'print-webasto-btn', 'print-heaters-btn', 'print-pumps-btn'].forEach(btnId => {
        const oldB = document.getElementById(btnId);
        if (oldB) oldB.remove();
    });

    const addBtn = document.querySelector('button[onclick*="addCurrentEquipmentRow"]') || document.querySelector('.equipment-actions-bar button');
    if (addBtn) {
        const parentBar = addBtn.parentElement;
        if (parentBar) {
            parentBar.style.display = 'flex';
            parentBar.style.justifyContent = 'space-between';
            parentBar.style.alignItems = 'center';
            parentBar.style.width = '100%';

            // Кнопка скидання фільтрів
            let resetBtn = document.getElementById('reset-pump-filters-btn');
            const hasFilters = (typeof hasAnyActiveExcelFilters === 'function' && hasAnyActiveExcelFilters('pumps')) || 
                               pumpsFilters.model || pumpsFilters.subdivision || pumpsFilters.responsiblePerson || pumpsFilters.locationSubdivision;
            
            if (hasFilters) {
                if (!resetBtn) {
                    resetBtn = document.createElement('button');
                    resetBtn.id = 'reset-pump-filters-btn';
                    resetBtn.className = 'action-btn';
                    parentBar.insertBefore(resetBtn, addBtn);
                }
                resetBtn.style.cssText = 'background-color: #e67e22; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; margin-left: auto; margin-right: 10px; display: inline-flex; align-items: center; gap: 4px;';
                resetBtn.innerHTML = '<span>🔄</span> Скинути фільтри';
                resetBtn.onclick = () => {
                    pumpsFilters = { model: "", subdivision: "", responsiblePerson: "", locationSubdivision: "" };
                    if (typeof clearAllExcelFiltersForCategory === 'function') clearAllExcelFiltersForCategory('pumps');
                    renderPumpsView();
                };
            } else if (resetBtn) {
                resetBtn.remove();
            }

            let printBtn = document.getElementById('universal-print-btn');
            if (!printBtn) {
                printBtn = document.createElement('button');
                printBtn.id = 'universal-print-btn';
                printBtn.className = 'action-btn print-btn';
                parentBar.insertBefore(printBtn, addBtn);
            }
            printBtn.onclick = printCurrentEquipmentTable;
            printBtn.innerHTML = '<span style="font-size: 14px; margin-right: 6px; vertical-align: middle;">🖨️</span> Друк';
            printBtn.style.cssText = 'background-color: #337ab7; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; white-space: nowrap; margin-right: 10px;' + (!hasFilters ? ' margin-left: auto;' : '');
        }
    }

    const efBtn = (colKey, title) => typeof renderExcelHeaderFilterButton === 'function' ? renderExcelHeaderFilterButton('pumps', colKey, title) : '';

    wrapper.innerHTML = `
        <table id="pumps-table" class="compact-base-table" style="width: 100%; border-collapse: collapse; background: white; font-size: 12px;">
            <thead>
                <tr style="background-color: #2e7d32; color: white;">
                    <th style="padding: 6px 4px; width: 35px;">№</th>
                    <th style="padding: 6px 4px; min-width: 190px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                            <span>Модель</span>
                            ${efBtn('model', 'Модель')}
                        </div>
                        <input type="text" id="filter-pump-model" placeholder="Фільтр..." value="${escapePumpValue(pumpsFilters.model)}" oninput="updatePumpFilter('model', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box; margin-top: 2px;">
                    </th>
                    <th style="padding: 6px 4px; width: 50px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                            <span>кВт</span>
                            ${efBtn('kw', 'Потужність (кВт)')}
                        </div>
                    </th>
                    <th style="padding: 6px 4px; width: 55px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                            <span>Тип пал.</span>
                            ${efBtn('fuelType', 'Тип пального')}
                        </div>
                    </th>
                    <th style="padding: 6px 4px; width: 60px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                            <span>Розхід літ./год.</span>
                            ${efBtn('consumption', 'Розхід')}
                        </div>
                    </th>
                    <th style="padding: 6px 4px; width: 65px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                            <span>Норма мастил</span>
                            ${efBtn('oilNorm10Days', 'Норма мастил')}
                        </div>
                    </th>
                    <th style="padding: 6px 4px; width: 75px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                            <span>Макс 5 діб</span>
                            ${efBtn('max5Days', 'Макс на 5 діб')}
                        </div>
                    </th>
                    <th style="padding: 6px 4px; width: 75px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                            <span>Макс 10 діб</span>
                            ${efBtn('max10Days', 'Макс на 10 діб')}
                        </div>
                    </th>
                    <th style="padding: 6px 4px; width: 75px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                            <span>Макс 30 діб</span>
                            ${efBtn('max30Days', 'Макс на 30 діб')}
                        </div>
                    </th>
                    <th style="padding: 6px 4px; width: 65px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                            <span>Норма мотог.</span>
                            ${efBtn('motoHoursDay', 'Норма мотог.')}
                        </div>
                    </th>
                    <th style="padding: 6px 4px; min-width: 90px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                            <span>Підрозділ</span>
                            ${efBtn('subdivision', 'Підрозділ')}
                        </div>
                        <input type="text" id="filter-pump-sub" placeholder="Фільтр..." value="${escapePumpValue(pumpsFilters.subdivision)}" oninput="updatePumpFilter('subdivision', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box; margin-top: 2px;">
                    </th>
                    <th style="padding: 6px 4px; min-width: 130px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                            <span>Мат. Відп. Особа</span>
                            ${efBtn('responsiblePerson', 'Відповідальна особа')}
                        </div>
                        <input type="text" id="filter-pump-resp" placeholder="Фільтр..." value="${escapePumpValue(pumpsFilters.responsiblePerson)}" oninput="updatePumpFilter('responsiblePerson', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box; margin-top: 2px;">
                    </th>
                    <th style="padding: 6px 4px; min-width: 100px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                            <span>Де знаходиться</span>
                            ${efBtn('locationSubdivision', 'Де знаходиться')}
                        </div>
                        <input type="text" id="filter-pump-loc" placeholder="Фільтр..." value="${escapePumpValue(pumpsFilters.locationSubdivision)}" oninput="updatePumpFilter('locationSubdivision', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box; margin-top: 2px;">
                    </th>
                    <th style="padding: 6px 4px; min-width: 120px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                            <span>Серійний номер</span>
                            ${efBtn('serialNumber', 'Серійний номер')}
                        </div>
                    </th>
                    <th style="padding: 6px 4px; min-width: 80px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                            <span>Примітка</span>
                            ${efBtn('note', 'Примітка')}
                        </div>
                    </th>
                    <th style="padding: 6px 4px; width: 60px;">Дія</th>
                </tr>
            </thead>
            <tbody id="pumps-tbody"></tbody>
        </table>
        <datalist id="pumps-model-datalist">
            ${defaultPumpsData.map(item => `<option value="${item.model}">`).join('')}
        </datalist>
    `;

    const tbody = document.getElementById('pumps-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let list = getPumpsList();
    if (typeof applyCategoryExcelSort === 'function') {
        list = applyCategoryExcelSort(list, 'pumps');
    }

    const filtered = list.filter(item => {
        if (/знищ/ui.test(String(item.note || item.comment || ''))) return false;

        // Построковий текстовий пошук (швидкий)
        if (pumpsFilters.model && !String(item.model || "").toLowerCase().includes(pumpsFilters.model.toLowerCase())) return false;
        if (pumpsFilters.subdivision && !String(item.subdivision || "").toLowerCase().includes(pumpsFilters.subdivision.toLowerCase())) return false;
        if (pumpsFilters.responsiblePerson && !String(item.responsiblePerson || "").toLowerCase().includes(pumpsFilters.responsiblePerson.toLowerCase())) return false;
        if (pumpsFilters.locationSubdivision && !String(item.locationSubdivision || "").toLowerCase().includes(pumpsFilters.locationSubdivision.toLowerCase())) return false;

        // Excel-фільтри (мультиселект чекбокси)
        if (typeof itemMatchesExcelFilters === 'function' && !itemMatchesExcelFilters(item, 'pumps')) return false;

        return true;
    });

    filtered.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center; padding: 3px 4px;">${index + 1}</td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" list="pumps-model-datalist" value="${escapePumpValue(item.model)}" placeholder="Нова помпа" oninput="updatePumpsProp(${item.id}, 'model', this.value, false)" onchange="updatePumpsProp(${item.id}, 'model', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${escapePumpValue(item.kw)}" oninput="updatePumpsProp(${item.id}, 'kw', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${escapePumpValue(item.fuelType)}" oninput="updatePumpsProp(${item.id}, 'fuelType', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; background-color: #fff9c4; width: 100%; box-sizing: border-box; padding: 3px;" value="${escapePumpValue(item.consumption)}" oninput="updatePumpsProp(${item.id}, 'consumption', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${escapePumpValue(item.oilNorm10Days)}" oninput="updatePumpsProp(${item.id}, 'oilNorm10Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${escapePumpValue(item.max5Days)}" oninput="updatePumpsProp(${item.id}, 'max5Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${escapePumpValue(item.max10Days)}" oninput="updatePumpsProp(${item.id}, 'max10Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${escapePumpValue(item.max30Days)}" oninput="updatePumpsProp(${item.id}, 'max30Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${escapePumpValue(item.motoHoursDay)}" oninput="updatePumpsProp(${item.id}, 'motoHoursDay', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${escapePumpValue(item.subdivision)}" oninput="updatePumpsProp(${item.id}, 'subdivision', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${escapePumpValue(item.responsiblePerson)}" oninput="updatePumpsProp(${item.id}, 'responsiblePerson', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${escapePumpValue(item.locationSubdivision)}" oninput="updatePumpsProp(${item.id}, 'locationSubdivision', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${escapePumpValue(item.serialNumber)}" oninput="updatePumpsProp(${item.id}, 'serialNumber', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${escapePumpValue(item.note)}" oninput="updatePumpsProp(${item.id}, 'note', this.value); if(/знищ/ui.test(this.value)) { renderPumpsView(); }" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="text-align: center; padding: 3px 4px;"><button class="delete-row-btn" style="padding: 2px 6px; font-size: 10px;" onclick="deletePumpsRow(${item.id})">Видалити</button></td>
        `;
        if (!canManagePumps()) tr.querySelectorAll('input, button').forEach(el => {el.disabled = true;});
        tbody.appendChild(tr);
    });
    if (!filtered.length) tbody.innerHTML = '<tr><td colspan="16" style="padding:24px;text-align:center;color:#64748b">Помп за цими умовами немає. Для нової позиції натисніть «+ Додати позицію».</td></tr>';
}

function updatePumpFilter(field, val) {
    pumpsFilters[field] = val;
    renderPumpsView();
    setTimeout(() => {
        const inputMap = { model: 'filter-pump-model', subdivision: 'filter-pump-sub', responsiblePerson: 'filter-pump-resp', locationSubdivision: 'filter-pump-loc' };
        const el = document.getElementById(inputMap[field]);
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }, 0);
}

function updatePumpsProp(id, prop, val, rerender = true) {
    if (!canManagePumps()) return;
    let list = getPumpsList();
    const item = list.find(i => Number(i.id) === Number(id));
    if (item) {
        item[prop] = val;
        if (prop === 'locationSubdivision') item.subdivision = val;
        if (prop === 'model') {
            const foundRef = defaultPumpsData.find(ref => ref.model.toLowerCase().trim() === val.toLowerCase().trim());
            if (foundRef) {
                item.kw = foundRef.kw;
                item.fuelType = foundRef.fuelType;
                item.consumption = foundRef.consumption;
                item.max5Days = foundRef.max5Days;
                item.max10Days = foundRef.max10Days;
                item.max30Days = foundRef.max30Days;
                item.motoHoursDay = foundRef.motoHoursDay;
                item.oilNorm10Days = foundRef.oilNorm10Days;
            }
        }
        if (['consumption','motoHoursDay'].includes(prop) && typeof applyEquipmentFuelLimits === 'function') {
            applyEquipmentFuelLimits(item, 12, true);
            updateEquipmentFuelLimitCells(item, 'updatePumpsProp');
        }
        savePumpsList(list);
        if (prop === 'model' && rerender) renderPumpsView();
    }
}

function addPumpsRow() {
    if (!canManagePumps('eq_add_item')) return;
    let list = getPumpsList();
    const newId = list.length > 0 ? Math.max(...list.map(i => i.id)) + 1 : 1;
    list.push({ id: newId, model: "", kw: "", fuelType: "", consumption: "", max5Days: "", max10Days: "", max30Days: "", motoHoursDay: "", oilNorm10Days: "", subdivision: "РМТЗ", responsiblePerson: "", locationSubdivision: "РМТЗ", serialNumber: "", note: "" });
    savePumpsList(list);
    renderPumpsView();
}

function deletePumpsRow(id) {
    if (!canManagePumps()) return;
    if (!confirm("Ви впевнені, що хочете видалити цей запис?")) return;
    let list = getPumpsList();
    list = list.filter(i => Number(i.id) !== Number(id));
    savePumpsList(list);
    renderPumpsView();
}

