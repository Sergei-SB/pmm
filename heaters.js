// ==========================================
// ЛОГІКА ОБЛІКУ ТЕПЛОВИХ ПУШОК (heaters.js)
// ==========================================

const CURRENT_HEATERS_VERSION = 'v3_heaters_autofill';

let defaultHeatersData = [
    { id: 1, model: "ITA-35THL", kw: "35", fuelType: "ДП", consumption: "2.40", max5Days: "144.0", max10Days: "288.0", max30Days: "864.0", motoHoursDay: "12", subdivision: "ВМТЗ", responsiblePerson: "Ковальов В.В.", locationSubdivision: "ВМТЗ", serialNumber: "Без номера", note: "" }
];

let heatersFilters = { model: "", subdivision: "", responsiblePerson: "", locationSubdivision: "" };

function getHeatersList() {
    try {
        const storedVer = localStorage.getItem('heaters_data_version');
        const stored = localStorage.getItem('equipment_data_heaters');
        if (stored && storedVer === CURRENT_HEATERS_VERSION) return JSON.parse(stored);
    } catch(e) {}
    
    localStorage.setItem('heaters_data_version', CURRENT_HEATERS_VERSION);
    localStorage.setItem('equipment_data_heaters', JSON.stringify(defaultHeatersData));
    return defaultHeatersData;
}

function saveHeatersList(list) {
    localStorage.setItem('equipment_data_heaters', JSON.stringify(list));
}

function renderHeatersView() {
    const wrapper = document.getElementById('equipment-table-wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = `
        <table id="heaters-table" class="compact-base-table" style="width: 100%; border-collapse: collapse; background: white; font-size: 12px;">
            <thead>
                <tr style="background-color: #2e7d32; color: white;">
                    <th style="padding: 6px 4px; width: 35px;">№</th>
                    <th style="padding: 6px 4px; min-width: 190px;">Модель<br><input type="text" id="filter-heat-model" placeholder="Фільтр..." value="${heatersFilters.model}" oninput="updateHeatFilter('model', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box;"></th>
                    <th style="padding: 6px 4px; width: 45px;">кВт</th>
                    <th style="padding: 6px 4px; width: 50px;">Тип пал.</th>
                    <th style="padding: 6px 4px; width: 55px;">Розхід літ./год.</th>
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
        <datalist id="heaters-autocomplete-list">
            ${defaultHeatersData.map(d => `<option value="${d.model}">`).join('')}
        </datalist>
    `;

    const tbody = document.getElementById('heaters-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let items = getHeatersList();
    const filtered = items.filter(item => {
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
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${item.model || ''}" list="heaters-autocomplete-list" oninput="onHeaterModelInput(${item.id}, this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="padding: 3px 4px;"><input type="text" id="heat-kw-${item.id}" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.kw || ''}" oninput="updateHeatProp(${item.id}, 'kw', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" id="heat-fuel-${item.id}" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.fuelType || ''}" oninput="updateHeatProp(${item.id}, 'fuelType', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" id="heat-cons-${item.id}" class="table-cell-input" style="text-align:center; background-color: #fff9c4; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.consumption || ''}" oninput="updateHeatProp(${item.id}, 'consumption', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" id="heat-m5-${item.id}" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.max5Days || ''}" oninput="updateHeatProp(${item.id}, 'max5Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" id="heat-m10-${item.id}" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.max10Days || ''}" oninput="updateHeatProp(${item.id}, 'max10Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" id="heat-m30-${item.id}" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.max30Days || ''}" oninput="updateHeatProp(${item.id}, 'max30Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" id="heat-moto-${item.id}" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.motoHoursDay || ''}" oninput="updateHeatProp(${item.id}, 'motoHoursDay', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.subdivision || ''}" oninput="updateHeatProp(${item.id}, 'subdivision', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${item.responsiblePerson || ''}" oninput="updateHeatProp(${item.id}, 'responsiblePerson', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.locationSubdivision || ''}" oninput="updateHeatProp(${item.id}, 'locationSubdivision', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${item.serialNumber || ''}" oninput="updateHeatProp(${item.id}, 'serialNumber', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${item.note || ''}" oninput="updateHeatProp(${item.id}, 'note', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="text-align: center; padding: 3px 4px;"><button class="delete-row-btn" style="padding: 2px 6px; font-size: 10px;" onclick="deleteHeatRow(${item.id})">Видалити</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function onHeaterModelInput(id, val) {
    let items = getHeatersList();
    const item = items.find(i => Number(i.id) === Number(id));
    if (!item) return;

    item.model = val;
    const trimmedVal = val.trim().toLowerCase();
    const matchedBase = defaultHeatersData.find(b => b.model && b.model.trim().toLowerCase() === trimmedVal);

    if (matchedBase) {
        item.kw = matchedBase.kw;
        item.fuelType = matchedBase.fuelType;
        item.consumption = matchedBase.consumption;
        item.max5Days = matchedBase.max5Days;
        item.max10Days = matchedBase.max10Days;
        item.max30Days = matchedBase.max30Days;
        item.motoHoursDay = matchedBase.motoHoursDay;

        const elKw = document.getElementById(`heat-kw-${id}`);
        const elFuel = document.getElementById(`heat-fuel-${id}`);
        const elCons = document.getElementById(`heat-cons-${id}`);
        const elM5 = document.getElementById(`heat-m5-${id}`);
        const elM10 = document.getElementById(`heat-m10-${id}`);
        const elM30 = document.getElementById(`heat-m30-${id}`);
        const elMoto = document.getElementById(`heat-moto-${id}`);

        if (elKw) elKw.value = matchedBase.kw;
        if (elFuel) elFuel.value = matchedBase.fuelType;
        if (elCons) elCons.value = matchedBase.consumption;
        if (elM5) elM5.value = matchedBase.max5Days;
        if (elM10) elM10.value = matchedBase.max10Days;
        if (elM30) elM30.value = matchedBase.max30Days;
        if (elMoto) elMoto.value = matchedBase.motoHoursDay;
    }
    saveHeatersList(items);
}

function updateHeatFilter(field, val) {
    heatersFilters[field] = val;
    renderHeatersView();
    setTimeout(() => {
        const map = { model: 'filter-heat-model', subdivision: 'filter-heat-sub', responsiblePerson: 'filter-heat-resp', locationSubdivision: 'filter-heat-loc' };
        const el = document.getElementById(map[field]);
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }, 0);
}

function updateHeatProp(id, prop, val) {
    let items = getHeatersList();
    const item = items.find(i => Number(i.id) === Number(id));
    if (item) { 
        item[prop] = val; 
        if (prop === 'locationSubdivision') {
            item.subdivision = val;
        }
        saveHeatersList(items); 
    }
}

function addHeatersRow() {
    let items = getHeatersList();
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    items.push({ id: newId, model: "Теплова пушка Нова", kw: "35", fuelType: "ДП", consumption: "2.40", max5Days: "144.0", max10Days: "288.0", max30Days: "864.0", motoHoursDay: "12", subdivision: "РМТЗ", responsiblePerson: "", locationSubdivision: "РМТЗ", serialNumber: "", note: "" });
    saveHeatersList(items);
    renderHeatersView();
}

function deleteHeatRow(id) {
    if (!confirm("Ви впевнені, що хочете видалити цей рядок?")) return;
    let items = getHeatersList();
    items = items.filter(i => Number(i.id) !== Number(id));
    saveHeatersList(items);
    renderHeatersView();
}