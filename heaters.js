// ==========================================
// ЛОГІКА ОБЛІКУ ТЕПЛОВИХ ПУШОК (heaters.js)
// ==========================================

const CURRENT_HEAT_VERSION = 'v2_full_list';

let defaultHeatersData = [
    { id: 1, model: "ITA-35THL", kw: "35", fuelType: "ДП", consumption: "2.40", max5Days: "144.00", max10Days: "288.0", max30Days: "864.0", motoHoursDay: "12", oilNorm10Days: "0.50", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "ITA-35-1", note: "" },
];

let heatersFilters = { model: "", subdivision: "", responsiblePerson: "", locationSubdivision: "" };

function getHeatersList() {
    try {
        const storedVer = localStorage.getItem('heaters_data_version');
        const stored = localStorage.getItem('heaters_custom_data');
        if (stored && storedVer === CURRENT_HEAT_VERSION) return JSON.parse(stored);
    } catch(e) {}
    localStorage.setItem('heaters_data_version', CURRENT_HEAT_VERSION);
    localStorage.setItem('heaters_custom_data', JSON.stringify(defaultHeatersData));
    return defaultHeatersData;
}

function saveHeatersList(list) { localStorage.setItem('heaters_custom_data', JSON.stringify(list)); }

function printHeatersTable() {
    const printWindow = window.open('', '_blank');
    let list = getHeatersList().filter(item => !/знищ/ui.test(String(item.note || item.comment || '')));
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8"><title>Облік теплових пушок</title>
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
            <h2>ОБЛІК ТА НОРМИ ВИТРАТ ПАЛИВА І МАСТИЛ ТЕПЛОВИХ ПУШОК</h2>
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
            <td>${index + 1}</td><td>${item.model || ''}</td><td>${item.kw || ''}</td><td>${item.fuelType || ''}</td>
            <td>${item.consumption || ''}</td><td>${item.oilNorm10Days || ''}</td><td>${item.max5Days || ''}</td>
            <td>${item.max10Days || ''}</td><td>${item.max30Days || ''}</td><td>${item.motoHoursDay || ''}</td>
            <td>${item.subdivision || ''}</td><td>${item.responsiblePerson || ''}</td><td>${item.locationSubdivision || ''}</td>
            <td>${item.serialNumber || ''}</td><td>${item.note || ''}</td>
        </tr>`;
    });
    html += `</tbody></table></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
}

function renderHeatersView() {
    const wrapper = document.getElementById('equipment-table-wrapper');
    if (!wrapper) return;

    ['print-generators-btn', 'print-webasto-btn', 'print-heaters-btn', 'print-chainsaws-btn'].forEach(btnId => {
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

            let printBtn = document.getElementById('universal-print-btn');
            if (!printBtn) {
                printBtn = document.createElement('button');
                printBtn.id = 'universal-print-btn';
                printBtn.className = 'action-btn print-btn';
                parentBar.insertBefore(printBtn, addBtn);
            }
            printBtn.onclick = printCurrentEquipmentTable;
            printBtn.innerHTML = '<span style="font-size: 14px; margin-right: 6px; vertical-align: middle;">🖨️</span> Друк';
            printBtn.style.cssText = 'background-color: #337ab7; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; white-space: nowrap; margin-left: auto; margin-right: 10px;';
        }
    }

    wrapper.innerHTML = `
        <table id="heaters-table" class="compact-base-table" style="width: 100%; border-collapse: collapse; background: white; font-size: 12px;">
            <thead>
                <tr style="background-color: #2e7d32; color: white;">
                    <th style="padding: 6px 4px; width: 35px;">№</th>
                    <th style="padding: 6px 4px; min-width: 190px;">Модель<br><input type="text" id="filter-heat-model" placeholder="Фільтр..." value="${heatersFilters.model}" oninput="updateHeatFilter('model', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box;"></th>
                    <th style="padding: 6px 4px; width: 45px;">кВт</th>
                    <th style="padding: 6px 4px; width: 50px;">Тип пал.</th>
                    <th style="padding: 6px 4px; width: 55px;">Розхід літ./год.</th>
                    <th style="padding: 6px 4px; width: 65px;">Норма мастил</th>
                    <th style="padding: 6px 4px; width: 75px;">Макс з. на 5 діб</th>
                    <th style="padding: 6px 4px; width: 75px;">Макс з. на 10 діб</th>
                    <th style="padding: 6px 4px; width: 75px;">Макс з. на 30 діб</th>
                    <th style="padding: 6px 4px; width: 65px;">Норма мотог.</th>
                    <th style="padding: 6px 4px; min-width: 90px;">Підрозділ<br><input type="text" id="filter-heat-sub" placeholder="Фільтр..." value="${heatersFilters.subdivision}" oninput="updateHeatFilter('subdivision', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box;"></th>
                    <th style="padding: 6px 4px; min-width: 130px;">Мат. Відп. Особа<br><input type="text" id="filter-heat-resp" placeholder="Фільтр..." value="${heatersFilters.responsiblePerson}" oninput="updateHeatFilter('responsiblePerson', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box;"></th>
                    <th style="padding: 6px 4px; min-width: 100px;">Де знаходиться<br><input type="text" id="filter-heat-loc" placeholder="Фільтр..." value="${heatersFilters.locationSubdivision}" oninput="updateHeatFilter('locationSubdivision', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box;"></th>
                    <th style="padding: 6px 4px; min-width: 120px;">Серійний номер</th>
                    <th style="padding: 6px 4px; min-width: 80px;">Примітка</th>
                    <th style="padding: 6px 4px; width: 60px;">Дія</th>
                </tr>
            </thead>
            <tbody id="heaters-tbody"></tbody>
        </table>
        <datalist id="heaters-model-datalist">
            ${defaultHeatersData.map(item => `<option value="${item.model}">`).join('')}
        </datalist>
    `;

    const tbody = document.getElementById('heaters-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let list = getHeatersList();
    const filtered = list.filter(item => {
        if (/знищ/ui.test(String(item.note || item.comment || ''))) return false;

        if (heatersFilters.model && !String(item.model || "").toLowerCase().includes(heatersFilters.model.toLowerCase())) return false;
        if (heatersFilters.subdivision && !String(item.subdivision || "").toLowerCase().includes(heatersFilters.subdivision.toLowerCase())) return false;
        if (heatersFilters.responsiblePerson && !String(item.responsiblePerson || "").toLowerCase().includes(heatersFilters.responsiblePerson.toLowerCase())) return false;
        if (heatersFilters.locationSubdivision && !String(item.locationSubdivision || "").toLowerCase().includes(heatersFilters.locationSubdivision.toLowerCase())) return false;
        return true;
    });

    filtered.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center; padding: 3px 4px;">${index + 1}</td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" list="heaters-model-datalist" value="${item.model || ''}" placeholder="Нова теплова пушка" onchange="updateHeatersProp(${item.id}, 'model', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.kw || ''}" oninput="updateHeatersProp(${item.id}, 'kw', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.fuelType || ''}" oninput="updateHeatersProp(${item.id}, 'fuelType', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; background-color: #fff9c4; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.consumption || ''}" oninput="updateHeatersProp(${item.id}, 'consumption', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.oilNorm10Days || ''}" oninput="updateHeatersProp(${item.id}, 'oilNorm10Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.max5Days || ''}" oninput="updateHeatersProp(${item.id}, 'max5Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.max10Days || ''}" oninput="updateHeatersProp(${item.id}, 'max10Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.max30Days || ''}" oninput="updateHeatersProp(${item.id}, 'max30Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.motoHoursDay || ''}" oninput="updateHeatersProp(${item.id}, 'motoHoursDay', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.subdivision || ''}" oninput="updateHeatersProp(${item.id}, 'subdivision', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${item.responsiblePerson || ''}" oninput="updateHeatersProp(${item.id}, 'responsiblePerson', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.locationSubdivision || ''}" oninput="updateHeatersProp(${item.id}, 'locationSubdivision', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${item.serialNumber || ''}" oninput="updateHeatersProp(${item.id}, 'serialNumber', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${item.note || ''}" oninput="updateHeatersProp(${item.id}, 'note', this.value); if(/знищ/ui.test(this.value)) { renderHeatersView(); }" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="text-align: center; padding: 3px 4px;"><button class="delete-row-btn" style="padding: 2px 6px; font-size: 10px;" onclick="deleteHeatersRow(${item.id})">Видалити</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function updateHeatFilter(field, val) {
    heatersFilters[field] = val;
    renderHeatersView();
    setTimeout(() => {
        const inputMap = { model: 'filter-heat-model', subdivision: 'filter-heat-sub', responsiblePerson: 'filter-heat-resp', locationSubdivision: 'filter-heat-loc' };
        const el = document.getElementById(inputMap[field]);
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }, 0);
}

function updateHeatersProp(id, prop, val) {
    let list = getHeatersList();
    const item = list.find(i => Number(i.id) === Number(id));
    if (item) {
        item[prop] = val;
        if (prop === 'locationSubdivision') item.subdivision = val;
        if (prop === 'model') {
            const foundRef = defaultHeatersData.find(ref => ref.model.toLowerCase().trim() === val.toLowerCase().trim());
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
        saveHeatersList(list);
        if (prop === 'model') renderHeatersView();
    }
}

function addHeatersRow() {
    let list = getHeatersList();
    const newId = list.length > 0 ? Math.max(...list.map(i => i.id)) + 1 : 1;
    list.push({ id: newId, model: "", kw: "", fuelType: "", consumption: "", max5Days: "", max10Days: "", max30Days: "", motoHoursDay: "", oilNorm10Days: "", subdivision: "РМТЗ", responsiblePerson: "Ковальов В.В.", locationSubdivision: "РМТЗ", serialNumber: "000000", note: "" });
    saveHeatersList(list);
    renderHeatersView();
}

function deleteHeatersRow(id) {
    if (!confirm("Ви впевнені, що хочете видалити цей запис?")) return;
    let list = getHeatersList();
    list = list.filter(i => Number(i.id) !== Number(id));
    saveHeatersList(list);
    renderHeatersView();
}