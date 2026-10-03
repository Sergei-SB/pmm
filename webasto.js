// ==========================================
// ЛОГІКА ОБЛІКУ WEBASTO (webasto.js)
// ==========================================

const CURRENT_WEBASTO_VERSION = 'v4_webasto_unique_models';

let defaultWebastoData = [
    { id: 1, model: "PNI WB300", kw: "5", fuelType: "ДП", consumption: "0.51", max5Days: "30.6", max10Days: "61.2", max30Days: "183.6", motoHoursDay: "12", subdivision: "РМТЗ", responsiblePerson: "Ковальов В.В.", locationSubdivision: "РМТЗ", serialNumber: "Без номера", note: "" },
    { id: 2, model: "Mar-Pol M80950", kw: "8", fuelType: "ДП", consumption: "0.45", max5Days: "27.0", max10Days: "54.0", max30Days: "162.0", motoHoursDay: "12", subdivision: "РМТЗ", responsiblePerson: "Ковальов В.В.", locationSubdivision: "РМТЗ", serialNumber: "Без номера", note: "" },
    { id: 3, model: "Master B150", kw: "8", fuelType: "ДП", consumption: "0.45", max5Days: "27.0", max10Days: "54.0", max30Days: "162.0", motoHoursDay: "12", subdivision: "РМТЗ", responsiblePerson: "Ковальов В.В.", locationSubdivision: "РМТЗ", serialNumber: "Без номера", note: "" },
    { id: 4, model: "Kraft&Dele KD11780", kw: "8", fuelType: "ДП", consumption: "0.45", max5Days: "27.0", max10Days: "54.0", max30Days: "162.0", motoHoursDay: "12", subdivision: "РМТЗ", responsiblePerson: "Ковальов В.В.", locationSubdivision: "РМТЗ", serialNumber: "Без номера", note: "" },
    { id: 5, model: "LF Bros EX 5.0", kw: "5", fuelType: "ДП", consumption: "0.46", max5Days: "27.6", max10Days: "55.2", max30Days: "165.6", motoHoursDay: "12", subdivision: "РМТЗ", responsiblePerson: "Ковальов В.В.", locationSubdivision: "РМТЗ", serialNumber: "Без номера", note: "" },
    { id: 6, model: "Direltron NFO", kw: "8", fuelType: "ДП", consumption: "0.48", max5Days: "28.8", max10Days: "57.6", max30Days: "172.8", motoHoursDay: "12", subdivision: "РМТЗ", responsiblePerson: "Ковальов В.В.", locationSubdivision: "РМТЗ", serialNumber: "Без номера", note: "" },
    { id: 7, model: "Car parking heater WF5001", kw: "5", fuelType: "ДП", consumption: "0.20", max5Days: "12.0", max10Days: "24.0", max30Days: "72.0", motoHoursDay: "12", subdivision: "РМТЗ", responsiblePerson: "Ковальов В.В.", locationSubdivision: "РМТЗ", serialNumber: "Без номера", note: "" },
    { id: 8, model: "\"Джміль\" WF8002", kw: "8", fuelType: "ДП", consumption: "0.20", max5Days: "12.0", max10Days: "24.0", max30Days: "72.0", motoHoursDay: "12", subdivision: "РМТЗ", responsiblePerson: "Ковальов В.В.", locationSubdivision: "РМТЗ", serialNumber: "Без номера", note: "" }
];

let webastoFilters = { model: "", subdivision: "", responsiblePerson: "", locationSubdivision: "" };

function getWebastoList() {
    try {
        const storedVer = localStorage.getItem('webasto_data_version');
        const stored = localStorage.getItem('equipment_data_webasto');
        if (stored && storedVer === CURRENT_WEBASTO_VERSION) return JSON.parse(stored);
    } catch(e) {}
    
    localStorage.setItem('webasto_data_version', CURRENT_WEBASTO_VERSION);
    localStorage.setItem('equipment_data_webasto', JSON.stringify(defaultWebastoData));
    return defaultWebastoData;
}

function saveWebastoList(list) {
    localStorage.setItem('equipment_data_webasto', JSON.stringify(list));
}

function renderWebastoView() {
    const wrapper = document.getElementById('equipment-table-wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = `
        <table id="webasto-table" class="compact-base-table" style="width: 100%; border-collapse: collapse; background: white; font-size: 12px;">
            <thead>
                <tr style="background-color: #2e7d32; color: white;">
                    <th style="padding: 6px 4px; width: 35px;">№</th>
                    <th style="padding: 6px 4px; min-width: 190px;">Модель<br><input type="text" id="filter-web-model" placeholder="Фільтр..." value="${webastoFilters.model}" oninput="updateWebFilter('model', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box;"></th>
                    <th style="padding: 6px 4px; width: 45px;">кВт</th>
                    <th style="padding: 6px 4px; width: 50px;">Тип пал.</th>
                    <th style="padding: 6px 4px; width: 55px;">Розхід літ./год.</th>
                    <th style="padding: 6px 4px; width: 75px;">Макс з. на 5 діб</th>
                    <th style="padding: 6px 4px; width: 75px;">Макс з. на 10 діб</th>
                    <th style="padding: 6px 4px; width: 75px;">Макс з. на 30 діб</th>
                    <th style="padding: 6px 4px; width: 65px;">Норма мотог.</th>
                    <th style="padding: 6px 4px; min-width: 90px;">Підрозділ<br><input type="text" id="filter-web-sub" placeholder="Фільтр..." value="${webastoFilters.subdivision}" oninput="updateWebFilter('subdivision', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box;"></th>
                    <th style="padding: 6px 4px; min-width: 130px;">Мат. Відп. Особа<br><input type="text" id="filter-web-resp" placeholder="Фільтр..." value="${webastoFilters.responsiblePerson}" oninput="updateWebFilter('responsiblePerson', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box;"></th>
                    <th style="padding: 6px 4px; min-width: 100px;">Де знаходиться<br><input type="text" id="filter-web-loc" placeholder="Фільтр..." value="${webastoFilters.locationSubdivision}" oninput="updateWebFilter('locationSubdivision', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box;"></th>
                    <th style="padding: 6px 4px; min-width: 120px;">Серійний номер</th>
                    <th style="padding: 6px 4px; min-width: 80px;">Примітка</th>
                    <th style="padding: 6px 4px; width: 60px;">Дія</th>
                </tr>
            </thead>
            <tbody id="webasto-tbody"></tbody>
        </table>
    `;

    const tbody = document.getElementById('webasto-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let items = getWebastoList();
    const filtered = items.filter(item => {
        if (webastoFilters.model && !String(item.model || "").toLowerCase().includes(webastoFilters.model.toLowerCase())) return false;
        if (webastoFilters.subdivision && !String(item.subdivision || "").toLowerCase().includes(webastoFilters.subdivision.toLowerCase())) return false;
        if (webastoFilters.responsiblePerson && !String(item.responsiblePerson || "").toLowerCase().includes(webastoFilters.responsiblePerson.toLowerCase())) return false;
        if (webastoFilters.locationSubdivision && !String(item.locationSubdivision || "").toLowerCase().includes(webastoFilters.locationSubdivision.toLowerCase())) return false;
        return true;
    });

    filtered.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center; padding: 3px 4px;">${index + 1}</td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${item.model || ''}" oninput="updateWebProp(${item.id}, 'model', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.kw || ''}" oninput="updateWebProp(${item.id}, 'kw', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.fuelType || ''}" oninput="updateWebProp(${item.id}, 'fuelType', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; background-color: #fff9c4; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.consumption || ''}" oninput="updateWebProp(${item.id}, 'consumption', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.max5Days || ''}" oninput="updateWebProp(${item.id}, 'max5Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.max10Days || ''}" oninput="updateWebProp(${item.id}, 'max10Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.max30Days || ''}" oninput="updateWebProp(${item.id}, 'max30Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.motoHoursDay || ''}" oninput="updateWebProp(${item.id}, 'motoHoursDay', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.subdivision || ''}" oninput="updateWebProp(${item.id}, 'subdivision', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${item.responsiblePerson || ''}" oninput="updateWebProp(${item.id}, 'responsiblePerson', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.locationSubdivision || ''}" oninput="updateWebProp(${item.id}, 'locationSubdivision', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${item.serialNumber || ''}" oninput="updateWebProp(${item.id}, 'serialNumber', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${item.note || ''}" oninput="updateWebProp(${item.id}, 'note', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="text-align: center; padding: 3px 4px;"><button class="delete-row-btn" style="padding: 2px 6px; font-size: 10px;" onclick="deleteWebRow(${item.id})">Видалити</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function updateWebFilter(field, val) {
    webastoFilters[field] = val;
    renderWebastoView();
    setTimeout(() => {
        const map = { model: 'filter-web-model', subdivision: 'filter-web-sub', responsiblePerson: 'filter-web-resp', locationSubdivision: 'filter-web-loc' };
        const el = document.getElementById(map[field]);
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }, 0);
}

function updateWebProp(id, prop, val) {
    let items = getWebastoList();
    const item = items.find(i => Number(i.id) === Number(id));
    if (item) { 
        item[prop] = val; 
        if (prop === 'locationSubdivision') {
            item.subdivision = val;
        }
        saveWebastoList(items); 
    }
}

function addWebastoRow() {
    let items = getWebastoList();
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    items.push({ id: newId, model: "Webasto Нова", kw: "5", fuelType: "ДП", consumption: "0.51", max5Days: "30.6", max10Days: "61.2", max30Days: "183.6", motoHoursDay: "12", subdivision: "РМТЗ", responsiblePerson: "", locationSubdivision: "РМТЗ", serialNumber: "", note: "" });
    saveWebastoList(items);
    renderWebastoView();
}

function deleteWebRow(id) {
    if (!confirm("Ви впевнені, що хочете видалити цей рядок?")) return;
    let items = getWebastoList();
    items = items.filter(i => Number(i.id) !== Number(id));
    saveWebastoList(items);
    renderWebastoView();
}