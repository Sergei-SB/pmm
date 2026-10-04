// ==========================================
// ЛОГІКА ОБЛІКУ БЕНЗОПИЛ (chainsaws.js)
// ==========================================

const CURRENT_CHAINSAWS_VERSION = 'v3_chainsaws_autofill';

let defaultChainsawsData = [
    { id: 1, model: "DNIPRO-M DSG-45H", kw: "-", fuelType: "АБ", consumption: "1.10", max5Days: "66.00", max10Days: "44.0", max30Days: "132.0", motoHoursDay: "4", subdivision: "БПЛА", responsiblePerson: "Паламарчук Ігор", locationSubdivision: "ВМТЗ", serialNumber: "Без номера", note: "" }
];

let chainsawsFilters = { model: "", subdivision: "", responsiblePerson: "", locationSubdivision: "" };

function getChainsawsList() {
    try {
        const storedVer = localStorage.getItem('chainsaws_data_version');
        const stored = localStorage.getItem('equipment_data_chainsaws');
        if (stored && storedVer === CURRENT_CHAINSAWS_VERSION) return JSON.parse(stored);
    } catch(e) {}
    
    localStorage.setItem('chainsaws_data_version', CURRENT_CHAINSAWS_VERSION);
    localStorage.setItem('equipment_data_chainsaws', JSON.stringify(defaultChainsawsData));
    return defaultChainsawsData;
}

function saveChainsawsList(list) {
    localStorage.setItem('equipment_data_chainsaws', JSON.stringify(list));
}

function renderChainsawsView() {
    const wrapper = document.getElementById('equipment-table-wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = `
        <table id="chainsaws-table" class="compact-base-table" style="width: 100%; border-collapse: collapse; background: white; font-size: 12px;">
            <thead>
                <tr style="background-color: #2e7d32; color: white;">
                    <th style="padding: 6px 4px; width: 35px;">№</th>
                    <th style="padding: 6px 4px; min-width: 190px;">Модель<br><input type="text" id="filter-chain-model" placeholder="Фільтр..." value="${chainsawsFilters.model}" oninput="updateChainFilter('model', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box;"></th>
                    <th style="padding: 6px 4px; width: 45px;">кВт</th>
                    <th style="padding: 6px 4px; width: 50px;">Тип пал.</th>
                    <th style="padding: 6px 4px; width: 55px;">Розхід літ./год.</th>
                    <th style="padding: 6px 4px; width: 75px;">Макс з. на 5 діб</th>
                    <th style="padding: 6px 4px; width: 75px;">Макс з. на 10 діб</th>
                    <th style="padding: 6px 4px; width: 75px;">Макс з. на 30 діб</th>
                    <th style="padding: 6px 4px; width: 65px;">Норма мотог.</th>
                    <th style="padding: 6px 4px; min-width: 90px;">Підрозділ<br><input type="text" id="filter-chain-sub" placeholder="Фільтр..." value="${chainsawsFilters.subdivision}" oninput="updateChainFilter('subdivision', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box;"></th>
                    <th style="padding: 6px 4px; min-width: 130px;">Мат. Відп. Особа<br><input type="text" id="filter-chain-resp" placeholder="Фільтр..." value="${chainsawsFilters.responsiblePerson}" oninput="updateChainFilter('responsiblePerson', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box;"></th>
                    <th style="padding: 6px 4px; min-width: 100px;">Де знаходиться<br><input type="text" id="filter-chain-loc" placeholder="Фільтр..." value="${chainsawsFilters.locationSubdivision}" oninput="updateChainFilter('locationSubdivision', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box;"></th>
                    <th style="padding: 6px 4px; min-width: 120px;">Серійний номер</th>
                    <th style="padding: 6px 4px; min-width: 80px;">Примітка</th>
                    <th style="padding: 6px 4px; width: 60px;">Дія</th>
                </tr>
            </thead>
            <tbody id="chainsaws-tbody"></tbody>
        </table>
        <datalist id="chainsaws-autocomplete-list">
            ${defaultChainsawsData.map(d => `<option value="${d.model}">`).join('')}
        </datalist>
    `;

    const tbody = document.getElementById('chainsaws-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let items = getChainsawsList();
    const filtered = items.filter(item => {
        if (chainsawsFilters.model && !String(item.model || "").toLowerCase().includes(chainsawsFilters.model.toLowerCase())) return false;
        if (chainsawsFilters.subdivision && !String(item.subdivision || "").toLowerCase().includes(chainsawsFilters.subdivision.toLowerCase())) return false;
        if (chainsawsFilters.responsiblePerson && !String(item.responsiblePerson || "").toLowerCase().includes(chainsawsFilters.responsiblePerson.toLowerCase())) return false;
        if (chainsawsFilters.locationSubdivision && !String(item.locationSubdivision || "").toLowerCase().includes(chainsawsFilters.locationSubdivision.toLowerCase())) return false;
        return true;
    });

    filtered.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center; padding: 3px 4px;">${index + 1}</td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${item.model || ''}" list="chainsaws-autocomplete-list" oninput="onChainsawModelInput(${item.id}, this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="padding: 3px 4px;"><input type="text" id="chain-kw-${item.id}" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.kw || ''}" oninput="updateChainProp(${item.id}, 'kw', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" id="chain-fuel-${item.id}" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.fuelType || ''}" oninput="updateChainProp(${item.id}, 'fuelType', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" id="chain-cons-${item.id}" class="table-cell-input" style="text-align:center; background-color: #fff9c4; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.consumption || ''}" oninput="updateChainProp(${item.id}, 'consumption', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" id="chain-m5-${item.id}" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.max5Days || ''}" oninput="updateChainProp(${item.id}, 'max5Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" id="chain-m10-${item.id}" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.max10Days || ''}" oninput="updateChainProp(${item.id}, 'max10Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" id="chain-m30-${item.id}" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.max30Days || ''}" oninput="updateChainProp(${item.id}, 'max30Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" id="chain-moto-${item.id}" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.motoHoursDay || ''}" oninput="updateChainProp(${item.id}, 'motoHoursDay', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.subdivision || ''}" oninput="updateChainProp(${item.id}, 'subdivision', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${item.responsiblePerson || ''}" oninput="updateChainProp(${item.id}, 'responsiblePerson', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.locationSubdivision || ''}" oninput="updateChainProp(${item.id}, 'locationSubdivision', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${item.serialNumber || ''}" oninput="updateChainProp(${item.id}, 'serialNumber', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${item.note || ''}" oninput="updateChainProp(${item.id}, 'note', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="text-align: center; padding: 3px 4px;"><button class="delete-row-btn" style="padding: 2px 6px; font-size: 10px;" onclick="deleteChainRow(${item.id})">Видалити</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function onChainsawModelInput(id, val) {
    let items = getChainsawsList();
    const item = items.find(i => Number(i.id) === Number(id));
    if (!item) return;

    item.model = val;
    const trimmedVal = val.trim().toLowerCase();
    const matchedBase = defaultChainsawsData.find(b => b.model && b.model.trim().toLowerCase() === trimmedVal);

    if (matchedBase) {
        item.kw = matchedBase.kw;
        item.fuelType = matchedBase.fuelType;
        item.consumption = matchedBase.consumption;
        item.max5Days = matchedBase.max5Days;
        item.max10Days = matchedBase.max10Days;
        item.max30Days = matchedBase.max30Days;
        item.motoHoursDay = matchedBase.motoHoursDay;

        const elKw = document.getElementById(`chain-kw-${id}`);
        const elFuel = document.getElementById(`chain-fuel-${id}`);
        const elCons = document.getElementById(`chain-cons-${id}`);
        const elM5 = document.getElementById(`chain-m5-${id}`);
        const elM10 = document.getElementById(`chain-m10-${id}`);
        const elM30 = document.getElementById(`chain-m30-${id}`);
        const elMoto = document.getElementById(`chain-moto-${id}`);

        if (elKw) elKw.value = matchedBase.kw;
        if (elFuel) elFuel.value = matchedBase.fuelType;
        if (elCons) elCons.value = matchedBase.consumption;
        if (elM5) elM5.value = matchedBase.max5Days;
        if (elM10) elM10.value = matchedBase.max10Days;
        if (elM30) elM30.value = matchedBase.max30Days;
        if (elMoto) elMoto.value = matchedBase.motoHoursDay;
    }
    saveChainsawsList(items);
}

function updateChainFilter(field, val) {
    chainsawsFilters[field] = val;
    renderChainsawsView();
    setTimeout(() => {
        const map = { model: 'filter-chain-model', subdivision: 'filter-chain-sub', responsiblePerson: 'filter-chain-resp', locationSubdivision: 'filter-chain-loc' };
        const el = document.getElementById(map[field]);
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }, 0);
}

function updateChainProp(id, prop, val) {
    let items = getChainsawsList();
    const item = items.find(i => Number(i.id) === Number(id));
    if (item) { 
        item[prop] = val; 
        if (prop === 'locationSubdivision') {
            item.subdivision = val;
        }
        saveChainsawsList(items); 
    }
}

function addChainsawsRow() {
    let items = getChainsawsList();
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    items.push({ id: newId, model: "Бензопила Нова", kw: "-", fuelType: "АБ", consumption: "1.10", max5Days: "66.00", max10Days: "44.0", max30Days: "132.0", motoHoursDay: "4", subdivision: "РМТЗ", responsiblePerson: "", locationSubdivision: "РМТЗ", serialNumber: "", note: "" });
    saveChainsawsList(items);
    renderChainsawsView();
}

function deleteChainRow(id) {
    if (!confirm("Ви впевнені, що хочете видалити цей рядок?")) return;
    let items = getChainsawsList();
    items = items.filter(i => Number(i.id) !== Number(id));
    saveChainsawsList(items);
    renderChainsawsView();
}