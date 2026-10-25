// ==========================================
// ЗВІТ ПО ОБЛАДНАННЮ (equipment_report.js)
// ==========================================

let activeEquipmentReportPeriod = "";

function canEditEquipmentReport() {
    const role = typeof window.getCurrentAppRole === 'function' ? window.getCurrentAppRole()
        : (typeof currentRole !== 'undefined' ? currentRole : 'user');
    return role === 'developer' || role === 'dev' || (typeof window.canRoleEdit === 'function'
        ? window.canRoleEdit(role, 'equipment_report') && window.canRoleDo(role, 'eq_report_edit') : role === 'admin');
}

function equipmentReportPeriod() {
    return document.getElementById('eq-report-custom-period')?.value.trim() || activeEquipmentReportPeriod || '01.10-10.10';
}

function readEquipmentReportData(period) {
    const data = JSON.parse(localStorage.getItem('equipment_report_data_' + period) || '{}');
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Неправильний формат збереженого звіту');
    return data;
}

function equipmentReportEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function collectEquipmentReportInputs(period) {
    // Keep rows hidden by subdivision filters or excluded from this period.
    const data = readEquipmentReportData(period);
    document.querySelectorAll('#equipment-report-tbody .eq-rep-input').forEach(input => {
        const id = input.getAttribute('data-id'), field = input.getAttribute('data-field');
        if (!id || !field) return;
        if (!Object.prototype.hasOwnProperty.call(data, id)) data[id] = {};
        data[id][field] = input.value;
    });
    return data;
}

function getEquipmentReportItems(period, includeExcluded = false) {
    const data = readEquipmentReportData(period);
    const items = getAllEquipmentItemsUnified().map(item => ({...item, ...data[item.uniqueId]?._equipment,
        uniqueId: item.uniqueId,
        subdivision: data[item.uniqueId]?.subdivision ?? data[item.uniqueId]?._equipment?.subdivision ?? item.subdivision ?? '',
        serialNumber: data[item.uniqueId]?.serialNumber ?? item.serialNumber ?? item.rawItem?.serialNumber ?? ''}));
    for (const [id, row] of Object.entries(data)) {
        if (['Генератор','Webasto','Теплова пушка','Бензопила','Помпа'].includes(row?._equipment?.category) && !items.some(item => item.uniqueId === id)) {
            items.push({...row._equipment, uniqueId: id, subdivision: row.subdivision ?? row._equipment.subdivision ?? '',
                serialNumber: row.serialNumber ?? row._equipment.serialNumber ?? ''});
        }
    }
    const categoryOrder = ['Генератор','Webasto','Теплова пушка','Бензопила','Помпа'];
    const rank = item => {
        const index = categoryOrder.indexOf(item.category);
        return index < 0 ? categoryOrder.length : index;
    };
    // Stable grouping keeps the existing order and distinct IDs within each category.
    items.sort((a,b) => rank(a) - rank(b));
    return includeExcluded ? items : items.filter(item => data[item.uniqueId]?._excluded !== true);
}

function normalizeEquipmentGeneratorSearch(value) {
    return String(value ?? '').normalize('NFKC').toLocaleLowerCase('uk-UA').replace(/\s+/g, ' ').trim();
}

function searchEquipmentReportGenerators(period, query = '', category = 'Генератор') {
    const data = readEquipmentReportData(period), needle = normalizeEquipmentGeneratorSearch(query);
    const inventory = getAllEquipmentItemsUnified();
    return getEquipmentReportItems(period, true).filter(item => item.category === category &&
        !/знищ/ui.test(String(item.note || item.rawItem?.note || ''))).map(item => {
        const source = inventory.find(row => row.uniqueId === item.uniqueId);
        return {...item, fromInventory: !!source, sourceModel: source?.model || '',
            serialNumber: data[item.uniqueId]?.serialNumber ?? item.serialNumber ?? '',
            status: data[item.uniqueId]?._excluded ? 'restore' : 'edit'};
    }).filter(item => !needle || normalizeEquipmentGeneratorSearch(
        [item.model,item.sourceModel,item.serialNumber,item.subdivision].join(' ')).includes(needle))
        .sort((a,b) => String(a.model).localeCompare(String(b.model),'uk',{numeric:true}) ||
            String(a.serialNumber).localeCompare(String(b.serialNumber),'uk',{numeric:true}));
}

function addEquipmentReportGenerator(details, existingId = '', period = equipmentReportPeriod()) {
    if (!canEditEquipmentReport()) return false;
    const data = collectEquipmentReportInputs(period);
    let id = existingId;
    if (id) {
        const item = getEquipmentReportItems(period, true).find(item => item.uniqueId === id);
        if (!item) throw new Error('Обладнання немає в обліку або збереженому звіті');
        const changes = {};
        for (const field of ['model','serialNumber','subdivision','fuelType']) {
            if (details[field] !== undefined) changes[field] = String(details[field]).trim();
        }
        if (changes.model !== undefined && !changes.model) throw new Error('Вкажіть модель обладнання');
        if (changes.fuelType !== undefined && !['ДП','АБ'].includes(changes.fuelType)) throw new Error('Виберіть тип пального');
        data[id] = {...(data[id] || {}), _excluded: false};
        if (Object.keys(changes).length) {
            data[id]._equipment = {category:item.category,model:item.model,serialNumber:item.serialNumber,
                subdivision:item.subdivision,fuelType:item.fuelType,...(data[id]._equipment || {}),...changes};
            if (changes.serialNumber !== undefined) data[id].serialNumber = changes.serialNumber;
            if (changes.subdivision !== undefined) data[id].subdivision = changes.subdivision;
        }
    } else {
        const model = String(details.model || '').trim();
        if (!model) throw new Error('Вкажіть модель обладнання');
        const category = details.category || 'Генератор';
        if (!['Генератор','Webasto','Теплова пушка','Бензопила','Помпа'].includes(category)) throw new Error('Виберіть категорію обладнання');
        id = 'report_gen_' + (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).slice(2));
        data[id] = {_excluded: false, serialNumber: String(details.serialNumber || '').trim(),
            _equipment: {category, model, serialNumber: String(details.serialNumber || '').trim(),
                subdivision: String(details.subdivision || '').trim(), fuelType: String(details.fuelType || 'ДП').trim()}};
    }
    localStorage.setItem('equipment_report_data_' + period, JSON.stringify(data));
    return id;
}

function setEquipmentReportGeneratorIncluded(id, included, period = equipmentReportPeriod()) {
    return setEquipmentReportItemIncluded(id, included, period);
}

function setEquipmentReportItemIncluded(id, included, period = equipmentReportPeriod()) {
    if (!canEditEquipmentReport()) return false;
    if (!getEquipmentReportItems(period, true).some(item => item.uniqueId === id)) return false;
    const data = collectEquipmentReportInputs(period);
    data[id] = {...(data[id] || {}), _excluded: !included};
    // Financial values remain recoverable; the equipment registry is untouched.
    localStorage.setItem('equipment_report_data_' + period, JSON.stringify(data));
    return true;
}

function openEquipmentReportGeneratorDialog() {
    if (!canEditEquipmentReport()) return;
    document.getElementById('equipment-report-generator-dialog')?.remove();
    const period = equipmentReportPeriod(), data = readEquipmentReportData(period);
    let category = 'Генератор';
    const candidates = searchEquipmentReportGenerators(period, '', category);
    const dialog = document.createElement('dialog');
    dialog.id = 'equipment-report-generator-dialog';
    dialog.style.cssText = 'width:min(620px,94vw);max-height:90vh;overflow:auto;border:1px solid #94a3b8;border-radius:10px;padding:24px;color:#263747;font:14px Arial,sans-serif;';
    dialog.innerHTML = `<h2 style="margin-top:0">Додати обладнання у звіт</h2><p>Період: ${equipmentReportEscape(period)}. Кожна нова одиниця додається окремим рядком, навіть з однаковою назвою та серійним номером.</p>
        <form id="equipment-report-generator-form" style="display:grid;gap:12px">
        <label for="eq-generator-category">Категорія</label><select name="category" id="eq-generator-category" style="width:100%;padding:8px"><option>Генератор</option><option>Webasto</option><option>Теплова пушка</option><option>Бензопила</option><option>Помпа</option></select>
        <label for="eq-generator-source">Спосіб додавання</label><select name="existingId" id="eq-generator-source" style="width:100%;padding:8px"><option value="">Новий рядок звіту</option>${candidates.map(item => `<option value="${equipmentReportEscape(item.uniqueId)}">${item.status==='restore'?'Повернути':'Редагувати'}: ${equipmentReportEscape(item.model)} · ${equipmentReportEscape(item.serialNumber || 'без серійного номера')} · ${equipmentReportEscape(item.subdivision || 'без підрозділу')}</option>`).join('')}</select>
        <div id="eq-generator-new-fields" style="display:grid;gap:12px"><div id="eq-generator-model-box" style="position:relative"><label for="eq-generator-model">Модель генератора</label><div style="display:flex;gap:6px"><input id="eq-generator-model" name="model" role="combobox" aria-autocomplete="list" aria-controls="eq-generator-suggestions" aria-expanded="false" autocomplete="off" placeholder="Почніть вводити модель або виберіть зі списку…" required style="width:100%;padding:8px;box-sizing:border-box"><button type="button" id="eq-generator-list-btn" aria-label="Показати список генераторів" title="Вибрати генератор з обліку обладнання" style="padding:5px 12px;cursor:pointer">▼</button></div><div id="eq-generator-suggestions" role="listbox" aria-label="Підказки генераторів" hidden style="position:absolute;left:0;right:0;z-index:20;max-height:210px;overflow:auto;background:#fff;border:1px solid #94a3b8;border-radius:5px;box-shadow:0 5px 18px #0002"></div></div>
        <label>Серійний номер<input name="serialNumber" style="width:100%;padding:8px;box-sizing:border-box"></label>
        <label>Підрозділ<input name="subdivision" style="width:100%;padding:8px;box-sizing:border-box"></label>
        <label>Тип пального<select name="fuelType" style="width:100%;padding:8px"><option>ДП</option><option>АБ</option></select></label></div>
        <p id="eq-generator-selection-status" aria-live="polite" style="color:#166534;margin:0;font-size:12px"></p><p id="eq-generator-error" role="status" style="color:#b91c1c;margin:0"></p><div style="display:flex;gap:12px;justify-content:flex-end"><button type="button" id="eq-generator-cancel">Скасувати</button><button type="submit" id="eq-generator-submit" style="background:#27ae60;color:white;border:0;border-radius:5px;padding:10px">Додати у звіт</button></div></form>`;
    dialog.querySelector('label[for="eq-generator-model"]').textContent = 'Модель обладнання';
    dialog.querySelector('#eq-generator-list-btn').setAttribute('aria-label','Показати список обладнання');
    dialog.querySelector('#eq-generator-list-btn').title = 'Вибрати обладнання з обліку';
    dialog.querySelector('#eq-generator-suggestions').setAttribute('aria-label','Підказки обладнання');
    const copyButton = document.createElement('button');
    copyButton.type = 'button'; copyButton.id = 'eq-generator-copy'; copyButton.hidden = true;
    copyButton.textContent = 'Додати ще одну таку одиницю';
    dialog.querySelector('#eq-generator-selection-status').after(copyButton);
    document.body.appendChild(dialog); dialog.showModal();
    const form = dialog.querySelector('form');
    const modelInput = form.elements.model, sourceSelect = form.elements.existingId;
    const suggestions = dialog.querySelector('#eq-generator-suggestions');
    const status = dialog.querySelector('#eq-generator-selection-status');
    let selectedSnapshot = null, matches = [], activeIndex = -1;
    function hideSuggestions() {
        suggestions.hidden = true; modelInput.setAttribute('aria-expanded','false');
        modelInput.removeAttribute('aria-activedescendant'); activeIndex = -1;
    }
    function selectGenerator(id) {
        const item = searchEquipmentReportGenerators(period, '', category).find(row => row.uniqueId === id);
        if (!item) return;
        sourceSelect.value = id;
        selectedSnapshot = {};
        for (const field of ['model','serialNumber','subdivision','fuelType']) {
            const value = String(item[field] ?? '');
            if (field === 'fuelType' && !Array.from(form.elements[field].options).some(option=>option.value===value)) {
                const option = document.createElement('option'); option.value=value; option.textContent=value || 'Не вказано';
                form.elements[field].appendChild(option);
            }
            form.elements[field].value = value; selectedSnapshot[field] = value;
        }
        status.textContent = item.status==='restore'
            ? 'Обладнання буде повернуто до цього звіту зі збереженими цифрами. Або натисніть «Додати ще одну таку одиницю» для нового рядка.'
            : 'Вибрано існуючий рядок для редагування. Для окремої одиниці натисніть «Додати ще одну таку одиницю».';
        copyButton.hidden = false;
        dialog.querySelector('#eq-generator-submit').textContent = item.status==='restore'?'Повернути у звіт':'Зберегти зміни у звіті';
        dialog.querySelector('#eq-generator-error').textContent = '';
        hideSuggestions();
    }
    function showSuggestions(query) {
        const all = searchEquipmentReportGenerators(period,query,category);
        matches = all.slice(0,30); activeIndex = -1; suggestions.replaceChildren();
        for (const [index,item] of matches.entries()) {
            const option = document.createElement('button');
            option.type = 'button'; option.id = 'eq-gen-option-'+index;
            option.setAttribute('role','option'); option.setAttribute('aria-selected','false'); option.tabIndex = -1;
            option.style.cssText = 'display:block;width:100%;padding:10px;text-align:left;border:0;border-bottom:1px solid #e2e8f0;background:#fff;color:#263747;cursor:pointer;font:13px Arial,sans-serif';
            option.textContent = [item.model,item.serialNumber || 'без серійного номера',item.subdivision || 'без підрозділу',item.fromInventory?'Облік обладнання':'Рядок звіту',item.status==='restore'?'Повернути у звіт':'У звіті — редагувати'].join(' · ');
            option.onmousedown = event => event.preventDefault();
            option.onclick = () => selectGenerator(item.uniqueId);
            suggestions.appendChild(option);
        }
        if (!matches.length || all.length > matches.length) {
            const note = document.createElement('div'); note.style.cssText = 'padding:10px;font-size:12px;color:#64748b';
            note.textContent = !matches.length
                ? 'Збігів немає. Можна додати новий рядок або змінити назву вибраного обладнання.'
                : 'Показано перші 30 збігів із '+all.length+'. Уточніть модель, серійний номер або підрозділ.';
            suggestions.appendChild(note);
        }
        suggestions.hidden = false; modelInput.setAttribute('aria-expanded','true');
    }
    dialog.querySelector('#eq-generator-cancel').onclick = () => dialog.remove();
    copyButton.onclick = () => {
        sourceSelect.value = ''; selectedSnapshot = null; copyButton.hidden = true;
        status.textContent = 'Буде додано окрему одиницю обладнання. Існуючий рядок та його цифри залишаться без змін.';
        dialog.querySelector('#eq-generator-submit').textContent = 'Додати у звіт';
        hideSuggestions();
    };
    dialog.querySelector('#eq-generator-category').onchange = event => {
        category = event.target.value;
        sourceSelect.innerHTML = '<option value="">Новий рядок звіту</option>' + searchEquipmentReportGenerators(period, '', category)
            .map(item => `<option value="${equipmentReportEscape(item.uniqueId)}">${item.status==='restore'?'Повернути':'Редагувати'}: ${equipmentReportEscape(item.model)} · ${equipmentReportEscape(item.serialNumber || 'без серійного номера')} · ${equipmentReportEscape(item.subdivision || 'без підрозділу')}</option>`).join('');
        sourceSelect.onchange({target:sourceSelect});
    };
    dialog.querySelector('#eq-generator-source').onchange = event => {
        if (event.target.value) selectGenerator(event.target.value);
        else {
            selectedSnapshot = null;
            copyButton.hidden = true;
            for (const field of ['model','serialNumber','subdivision']) form.elements[field].value = '';
            form.elements.fuelType.value = 'ДП'; status.textContent = '';
            dialog.querySelector('#eq-generator-submit').textContent = 'Додати у звіт';
            hideSuggestions(); modelInput.focus();
        }
    };
    modelInput.oninput = () => {dialog.querySelector('#eq-generator-error').textContent = ''; showSuggestions(modelInput.value);};
    modelInput.onfocus = () => showSuggestions(modelInput.value);
    dialog.querySelector('#eq-generator-list-btn').onclick = () => {modelInput.focus();showSuggestions('');};
    modelInput.onkeydown = event => {
        if (event.key==='Escape'&&!suggestions.hidden) {event.preventDefault();event.stopPropagation();hideSuggestions();return;}
        if (event.key==='ArrowDown'||event.key==='ArrowUp') {
            event.preventDefault();if(suggestions.hidden)showSuggestions(modelInput.value);
            if(!matches.length)return;
            activeIndex = (activeIndex+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length;
            suggestions.querySelectorAll('[role="option"]').forEach((option,index)=>{
                option.setAttribute('aria-selected',String(index===activeIndex));option.style.background=index===activeIndex?'#e8f8f5':'#fff';
            });
            const option=suggestions.children[activeIndex];modelInput.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});
        } else if(event.key==='Enter'&&!suggestions.hidden&&activeIndex>=0) {
            event.preventDefault();selectGenerator(matches[activeIndex].uniqueId);
        }
    };
    form.addEventListener('focusout',event=>{if(!dialog.querySelector('#eq-generator-model-box').contains(event.relatedTarget))hideSuggestions();});
    form.onsubmit = event => {
        event.preventDefault();
        try {
            const values = Object.fromEntries(new FormData(form));
            const changes = selectedSnapshot && values.existingId
                ? Object.fromEntries(['model','serialNumber','subdivision','fuelType'].filter(field=>String(values[field]).trim()!==selectedSnapshot[field]).map(field=>[field,values[field]]))
                : values;
            const id = addEquipmentReportGenerator(changes, values.existingId, period);
            if (!id) return;
            dialog.remove();
            const filter = document.getElementById('equipment-subdivision-filter');
            if (filter) filter.value = 'all';
            for (const fieldId of ['eq-report-model-search','eq-report-serial-search']) {
                const input = document.getElementById(fieldId); if (input) input.value = '';
            }
            renderEquipmentReportView();
            const row = Array.from(document.querySelectorAll('#equipment-report-tbody tr')).find(row=>row.querySelector('.eq-rep-input')?.dataset.id===id);
            if(row){row.scrollIntoView({block:'center',behavior:'smooth'});row.querySelector('.eq-rep-input')?.focus({preventScroll:true});}
        } catch (error) {dialog.querySelector('#eq-generator-error').textContent = error.message;}
    };
}

function removeEquipmentReportItem(id) {
    if (!canEditEquipmentReport()) return;
    const period = equipmentReportPeriod();
    const item = getEquipmentReportItems(period).find(item => item.uniqueId === id);
    if (!item) return;
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'max-width:520px;border:1px solid #94a3b8;border-radius:10px;padding:24px;font:14px Arial,sans-serif;';
    dialog.innerHTML = `<h2>Видалити обладнання зі звіту?</h2><p>${equipmentReportEscape(item.category)} · ${equipmentReportEscape(item.model)} · ${equipmentReportEscape(period)}</p><p>Рядок буде прибрано лише з цього звіту. Основний облік обладнання не зміниться. Значення рядка збережуться для повернення через «Повернути видалене».</p><button id="eq-remove-cancel">Скасувати</button> <button id="eq-remove-confirm">Видалити зі звіту</button>`;
    document.body.appendChild(dialog); dialog.showModal();
    dialog.querySelector('#eq-remove-cancel').onclick = () => dialog.remove();
    dialog.querySelector('#eq-remove-confirm').onclick = () => {setEquipmentReportItemIncluded(id, false, period);dialog.remove();renderEquipmentReportView();};
}

function openEquipmentReportRestoreDialog() {
    if (!canEditEquipmentReport()) return;
    const period = equipmentReportPeriod(), data = readEquipmentReportData(period);
    const excluded = getEquipmentReportItems(period, true).filter(item => data[item.uniqueId]?._excluded === true);
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'max-width:620px;max-height:80vh;overflow:auto;border:1px solid #94a3b8;border-radius:10px;padding:24px;font:14px Arial,sans-serif;';
    dialog.innerHTML = `<h2>Повернути обладнання у звіт</h2><p>Період: ${equipmentReportEscape(period)}. Попередні значення рядків будуть збережені.</p><div>${excluded.map(item => `<p>${equipmentReportEscape(item.category)} · ${equipmentReportEscape(item.model)} · ${equipmentReportEscape(item.serialNumber)} <button type="button" data-restore-eq-id="${equipmentReportEscape(item.uniqueId)}">Повернути у звіт</button></p>`).join('') || '<p>У цьому звіті немає видалених позицій.</p>'}</div><button type="button" id="eq-restore-close">Закрити</button>`;
    document.body.appendChild(dialog); dialog.showModal();
    dialog.querySelector('#eq-restore-close').onclick = () => dialog.remove();
    dialog.querySelectorAll('[data-restore-eq-id]').forEach(button => {
        button.onclick = () => {
            if (setEquipmentReportItemIncluded(button.getAttribute('data-restore-eq-id'), true, period)) {
                dialog.remove(); renderEquipmentReportView();
            }
        };
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        initEqReportPeriodDropdown();
        renderEquipmentReportView();
    }, 120);
});

function getSavedEquipmentPeriodsList() {
    let periods = [];
    if (typeof getSavedPeriodsList === 'function') {
        try {
            periods = [...getSavedPeriodsList()];
        } catch(e) {}
    } else if (typeof getSortedPeriods === 'function') {
        try {
            periods = [...getSortedPeriods()];
        } catch(e) {}
    }
    if (!periods || periods.length === 0) {
        periods = ["01.10-10.10"];
    }

    try {
        const stored = localStorage.getItem('app_saved_periods_list');
        if (stored) {
            const list = JSON.parse(stored);
            if (Array.isArray(list)) {
                list.forEach(p => { if (p && !periods.includes(p)) periods.push(p); });
            }
        }
    } catch(e) {}

    try {
        const eqStored = localStorage.getItem('eq_saved_periods_list');
        if (eqStored) {
            const list = JSON.parse(eqStored);
            if (Array.isArray(list)) {
                list.forEach(p => { if (p && !periods.includes(p)) periods.push(p); });
            }
        }
    } catch(e) {}

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('equipment_report_data_')) {
            const p = key.replace('equipment_report_data_', '');
            if (p && !periods.includes(p)) periods.push(p);
        }
    }
    return periods;
}

function initEqReportPeriodDropdown() {
    const select = document.getElementById('eq-report-period-select');
    if (!select) return;
    const periods = getSavedEquipmentPeriodsList();
    
    if (!activeEquipmentReportPeriod) {
        activeEquipmentReportPeriod = (typeof activeReportPeriod !== 'undefined' && activeReportPeriod)
            ? activeReportPeriod
            : (periods[periods.length - 1] || "01.10-10.10");
    }

    let html = '';
    periods.forEach(p => {
        html += `<option value="${p}" ${p === activeEquipmentReportPeriod ? 'selected' : ''}>${p}</option>`;
    });
    select.innerHTML = html;
    if (periods.includes(activeEquipmentReportPeriod)) {
        select.value = activeEquipmentReportPeriod;
    }

    const customInput = document.getElementById('eq-report-custom-period');
    if (customInput) {
        customInput.value = activeEquipmentReportPeriod;
    }

    updateEquipmentReportHeaders();
}

function updateEquipmentReportHeaders() {
    const periodInput = document.getElementById('eq-report-custom-period');
    const periodStr = periodInput ? periodInput.value.trim() : (activeEquipmentReportPeriod || "01.10-10.10");
    let parts = periodStr.split('-');
    let startDate = parts[0] ? parts[0].trim() : "01.10";
    let endDate = parts[1] ? parts[1].trim() : startDate;

    let monthNum = 10;
    if (startDate.includes('.')) {
        monthNum = parseInt(startDate.split('.')[1], 10) || 10;
    } else if (endDate.includes('.')) {
        monthNum = parseInt(endDate.split('.')[1], 10) || 10;
    }
    const mm = String(monthNum).padStart(2, '0');

    // Кількість днів у місяці (31, 30, 28/29)
    const curYear = (typeof currentYear !== 'undefined' && currentYear) ? currentYear : (new Date().getFullYear());
    const daysInMonth = new Date(curYear, monthNum, 0).getDate() || 31;

    const p1Label = `1-10.${mm}`;
    const p2Label = `11-20.${mm}`;
    const p3Label = `21-${daysInMonth}.${mm}`;

    // Розраховуємо початок наступного періоду
    let nextStartDate = "";
    if (typeof getNextTenDayPeriod === 'function') {
        const nextP = getNextTenDayPeriod(periodStr);
        if (nextP && nextP.includes('-')) {
            nextStartDate = nextP.split('-')[0].trim();
        }
    }
    if (!nextStartDate) {
        const startDay = parseInt(startDate.split('.')[0], 10) || 1;
        if (startDay === 1) nextStartDate = `11.${mm}`;
        else if (startDay === 11) nextStartDate = `21.${mm}`;
        else {
            const nextM = (monthNum % 12) + 1;
            nextStartDate = `01.${String(nextM).padStart(2, '0')}`;
        }
    }

    document.querySelectorAll('.eq-rep-start').forEach(el => el.textContent = startDate);
    document.querySelectorAll('.eq-rep-end').forEach(el => el.textContent = endDate);
    document.querySelectorAll('.eq-rep-next-start').forEach(el => el.textContent = nextStartDate);
    document.querySelectorAll('.eq-rep-p1-label').forEach(el => el.textContent = p1Label);
    document.querySelectorAll('.eq-rep-p2-label').forEach(el => el.textContent = p2Label);
    document.querySelectorAll('.eq-rep-p3-label').forEach(el => el.textContent = p3Label);
}

function getPreviousEquipmentPeriodKey(currentPeriod) {
    if (typeof getPrevPeriodKey === 'function') {
        const p = getPrevPeriodKey(currentPeriod);
        if (p) return p;
    }
    const periods = getSavedEquipmentPeriodsList();
    const cleanCurrent = (currentPeriod || "").trim();
    const idx = periods.indexOf(cleanCurrent);
    if (idx > 0) return periods[idx - 1];

    const parts = cleanCurrent.split('-');
    const startDate = parts[0] ? parts[0].trim() : "";
    if (startDate.includes('.')) {
        const d = parseInt(startDate.split('.')[0], 10);
        const m = parseInt(startDate.split('.')[1], 10);
        const mm = String(m).padStart(2, '0');
        if (d === 11) return `01.${mm}-10.${mm}`;
        if (d === 21) return `11.${mm}-20.${mm}`;
        if (d === 1) {
            const prevM = m === 1 ? 12 : m - 1;
            const prevMm = String(prevM).padStart(2, '0');
            const prevDays = new Date(2024, prevM, 0).getDate();
            return `21.${prevMm}-${prevDays}.${prevMm}`;
        }
    }
    return null;
}

function propagateNextFuelToNextPeriod(periodStr, reportData) {
    if (!periodStr || !reportData) return;
    let nextPeriodKey = null;
    if (typeof getNextTenDayPeriod === 'function') {
        nextPeriodKey = getNextTenDayPeriod(periodStr);
    }
    if (!nextPeriodKey) {
        const parts = periodStr.split('-');
        const s = parts[0] ? parts[0].trim() : "";
        if (s.includes('.')) {
            const d = parseInt(s.split('.')[0], 10);
            const m = parseInt(s.split('.')[1], 10);
            const mm = String(m).padStart(2, '0');
            if (d === 1) nextPeriodKey = `11.${mm}-20.${mm}`;
            else if (d === 11) {
                const daysInM = new Date(2024, m, 0).getDate();
                nextPeriodKey = `21.${mm}-${daysInM}.${mm}`;
            } else {
                const nextM = (m % 12) + 1;
                const nextMm = String(nextM).padStart(2, '0');
                nextPeriodKey = `01.${nextMm}-10.${nextMm}`;
            }
        }
    }
    if (!nextPeriodKey) return;

    try {
        const nextKey = `equipment_report_data_${nextPeriodKey}`;
        let nextData = {};
        const stored = localStorage.getItem(nextKey);
        if (stored) nextData = JSON.parse(stored);

        let changed = false;
        for (let uid in reportData) {
            if (reportData[uid]?._excluded) continue;
            const nextVal = reportData[uid]?.nextFuel;
            if (nextVal !== undefined && nextVal !== null && String(nextVal).trim() !== '') {
                if (!nextData[uid]) {
                    nextData[uid] = { prevFuel: '', prevOil: '', p1Fuel: '', p1Oil: '', p2Fuel: '', p2Oil: '', p3Fuel: '', p3Oil: '', nextFuel: '' };
                }
                nextData[uid].prevFuel = String(nextVal).trim();
                nextData[uid]._autoCarried = true;
                changed = true;
            }
        }
        if (changed) {
            localStorage.setItem(nextKey, JSON.stringify(nextData));
        }
    } catch(e) {}
}

function saveCurrentEquipmentReportSilently() {
    if (!canEditEquipmentReport()) return;
    const periodInput = document.getElementById('eq-report-custom-period');
    const periodStr = periodInput ? periodInput.value.trim() : (activeEquipmentReportPeriod || "01.10-10.10");
    if (!periodStr) return;

    const rows = document.querySelectorAll('#equipment-report-tbody tr');
    if (rows.length === 0) return;

    const storageKey = `equipment_report_data_${periodStr}`;
    const reportData = collectEquipmentReportInputs(periodStr);

    localStorage.setItem(storageKey, JSON.stringify(reportData));
    propagateNextFuelToNextPeriod(periodStr, reportData);
}

function changeEqReportPeriod(val) {
    if (!val) return;
    saveCurrentEquipmentReportSilently();
    activeEquipmentReportPeriod = val;
    const customInput = document.getElementById('eq-report-custom-period');
    if (customInput) customInput.value = val;
    updateEquipmentReportHeaders();
    renderEquipmentReportView();
    if (typeof applyModeratorReportLock === 'function') {
        applyModeratorReportLock();
    }
}

window.navigateEquipmentReportPeriod = function(direction) {
    saveCurrentEquipmentReportSilently();

    let periods = getSavedEquipmentPeriodsList();
    const selectEl = document.getElementById('eq-report-period-select');
    let current = (selectEl && selectEl.value) ? selectEl.value : activeEquipmentReportPeriod;
    let idx = periods.indexOf(current);
    if (idx === -1) idx = periods.length - 1;

    let newIdx = idx + direction;

    if (direction > 0 && newIdx >= periods.length) {
        let nextPeriod = null;
        if (typeof getNextTenDayPeriod === 'function') {
            nextPeriod = getNextTenDayPeriod(periods[periods.length - 1]);
        }
        if (nextPeriod && !periods.includes(nextPeriod)) {
            periods.push(nextPeriod);
            localStorage.setItem('app_saved_periods_list', JSON.stringify(periods));
            localStorage.setItem('eq_saved_periods_list', JSON.stringify(periods));
        }
        if (nextPeriod) {
            newIdx = periods.indexOf(nextPeriod);
        }
    }

    if (newIdx >= 0 && newIdx < periods.length) {
        activeEquipmentReportPeriod = periods[newIdx];
        const customInput = document.getElementById('eq-report-custom-period');
        if (customInput) customInput.value = activeEquipmentReportPeriod;
        initEqReportPeriodDropdown();
        renderEquipmentReportView();
        if (typeof applyModeratorReportLock === 'function') {
            applyModeratorReportLock();
        }
    }
};

function getAllEquipmentItemsUnified() {
    let allItems = [];
    
    let gens = [];
    try { if (typeof getGeneratorsList === 'function') gens = getGeneratorsList(); } catch(e) {}
    if (!gens || gens.length === 0) gens = window.generatorsData || window.generators || [];

    let webs = [];
    try { if (typeof getWebastoList === 'function') webs = getWebastoList(); } catch(e) {}
    if (!webs || webs.length === 0) webs = window.webastoData || window.webasto || [];

    let heats = [];
    try { if (typeof getHeatersList === 'function') heats = getHeatersList(); } catch(e) {}
    if (!heats || heats.length === 0) heats = window.heatersData || window.heaters || [];

    let chains = [];
    try { if (typeof getChainsawsList === 'function') chains = getChainsawsList(); } catch(e) {}
    if (!chains || chains.length === 0) chains = window.chainsawsData || window.chainsaws || [];

    let pumps = [];
    try { if (typeof getPumpsList === 'function') pumps = getPumpsList(); } catch(e) {}

    const sources = [
        { type: 'Генератор', data: gens },
        { type: 'Webasto', data: webs },
        { type: 'Теплова пушка', data: heats },
        { type: 'Бензопила', data: chains },
        { type: 'Помпа', data: pumps }
    ];

    sources.forEach(src => {
        if (Array.isArray(src.data)) {
            src.data.forEach((item, index) => {
                const noteStr = String(item.note || "").toLowerCase();
                if (noteStr.includes('знищ')) return; // Пропускаємо знищені позиції

                const actualSub = item.locationSubdivision || item.subdivision || item.sub || 'РМТЗ';
                allItems.push({
                    uniqueId: `${src.type}_${item.id || index}`,
                    category: src.type,
                    subdivision: actualSub,
                    model: item.model || item.name || `Пристрій #${index + 1}`,
                    fuelType: item.fuelType || item.fuel || 'Бензин', serialNumber: item.serialNumber || ''
                });
            });
        }
    });

    if (allItems.length === 0) {
        allItems = [
            { uniqueId: 'Gen_1', category: 'Генератор', subdivision: 'РМТЗ', model: 'Honda EU22i', fuelType: 'Бензин' },
            { uniqueId: 'Web_1', category: 'Webasto', subdivision: 'ВТО', model: 'Air Top 2000', fuelType: 'ДП' }
        ];
    }

    return allItems;
}

function evaluateExpression(expr) {
    if (!expr) return 0;
    if (typeof expr === 'number') return expr;
    let str = String(expr).trim().replace(',', '.');
    if (str === '' || str === '-') return 0;
    try {
        let sanitized = str.replace(/[^0-9+\-*/().]/g, '');
        if (!sanitized) return 0;
        let result = Function('"use strict"; return (' + sanitized + ')')();
        return isNaN(result) ? 0 : Number(result);
    } catch (e) {
        return 0;
    }
}

function parseFluidEntries(val) {
    if (val === undefined || val === null) return {};
    const str = String(val).trim();
    if (!str) return {};

    let result = {};
    const regex = /([0-9.,+\-*/()]+)\s*\(([^)]+)\)/g;
    let match;
    let foundAny = false;

    while ((match = regex.exec(str)) !== null) {
        foundAny = true;
        let qtyExpr = match[1].trim();
        let qty = evaluateExpression(qtyExpr);
        let type = match[2].trim().toLowerCase();
        if (qty > 0) {
            result[type] = (result[type] || 0) + qty;
        }
    }

    if (!foundAny) {
        let qty = evaluateExpression(str);
        if (qty > 0) {
            result[''] = (result[''] || 0) + qty;
        }
    }

    return result;
}

function formatFluidBreakdown(fluidMap) {
    if (!fluidMap) return '0';
    let parts = [];
    let keys = Object.keys(fluidMap).sort();
    
    for (let type of keys) {
        let qty = fluidMap[type];
        if (qty > 0) {
            if (type === '') {
                parts.push(qty.toFixed(1));
            } else {
                parts.push(`${qty.toFixed(1)} (${type})`);
            }
        }
    }
    return parts.length > 0 ? parts.join(', ') : '0';
}

function mergeFluidMaps(targetMap, sourceMap) {
    for (let t in sourceMap) {
        targetMap[t] = (targetMap[t] || 0) + sourceMap[t];
    }
    return targetMap;
}

function filterEquipmentReportItems(items, subdivision = 'all', model = '', serial = '') {
    const normalize = normalizeEquipmentGeneratorSearch;
    return items.filter(item => {
        const unit = String(item.subdivision || '').trim();
        return (subdivision === 'all' || (subdivision === '__unassigned__' ? !unit : unit === subdivision)) &&
            normalize(item.model).includes(normalize(model)) && normalize(item.serialNumber).includes(normalize(serial));
    });
}

function changeEquipmentReportFilter(kind, value) {
    // Persist editable cells before replacing the visible rows. Hidden rows remain in storage.
    saveCurrentEquipmentReportSilently();
    if (kind === 'subdivision') {
        const toolbar = document.getElementById('equipment-subdivision-filter');
        if (toolbar) toolbar.value = value;
    }
    renderEquipmentReportView();
}

function renderEquipmentReportView() {
    const tbody = document.getElementById('equipment-report-tbody');
    if (!tbody) return;

    const periodInput = document.getElementById('eq-report-custom-period');
    const periodStr = periodInput ? periodInput.value.trim() : (activeEquipmentReportPeriod || "01.10-10.10");
    updateEquipmentReportHeaders();

    const items = getEquipmentReportItems(periodStr);

    const subFilterEl = document.getElementById('equipment-subdivision-filter');
    const currentSubVal = subFilterEl ? subFilterEl.value : 'all';

    if (subFilterEl) {
        const subs = new Set();
        items.forEach(i => { if (i.subdivision) subs.add(i.subdivision.trim()); });
        let opts = '<option value="all">Усі</option>';
        if (items.some(item => !String(item.subdivision || '').trim())) opts += '<option value="__unassigned__">Без підрозділу</option>';
        subs.forEach(sub => {
            opts += `<option value="${equipmentReportEscape(sub)}">${equipmentReportEscape(sub)}</option>`;
        });
        subFilterEl.innerHTML = opts;
        if (subs.has(currentSubVal) || currentSubVal === 'all' || (currentSubVal === '__unassigned__' && items.some(item => !String(item.subdivision || '').trim()))) {
            subFilterEl.value = currentSubVal;
        }
    }
    const selectedSub = subFilterEl ? subFilterEl.value : 'all';

    const headerSub = document.getElementById('eq-report-subdivision-search');
    if (headerSub && subFilterEl) {headerSub.innerHTML = subFilterEl.innerHTML; headerSub.value = selectedSub;}
    const unitOptions = document.getElementById('eq-report-subdivision-options');
    if (unitOptions) unitOptions.innerHTML = [...new Set([...getAllEquipmentItemsUnified(), ...items]
        .map(item => String(item.subdivision || '').trim()).filter(Boolean))]
        .sort((a,b) => a.localeCompare(b,'uk')).map(unit => `<option value="${equipmentReportEscape(unit)}"></option>`).join('');
    const models = document.getElementById('eq-report-model-options');
    const modelOptions = [...new Set(filterEquipmentReportItems(items, selectedSub).map(item => item.model).filter(Boolean))]
        .sort((a,b) => String(a).localeCompare(String(b),'uk',{numeric:true}))
        .map(model => `<option value="${equipmentReportEscape(model)}"></option>`).join('');
    if (models && models.innerHTML !== modelOptions) models.innerHTML = modelOptions;
    const modelQuery = document.getElementById('eq-report-model-search')?.value || '';
    const serialQuery = document.getElementById('eq-report-serial-search')?.value || '';
    const filteredItems = filterEquipmentReportItems(items, selectedSub, modelQuery, serialQuery);
    const resultStatus = document.getElementById('eq-report-search-status');
    if (resultStatus) resultStatus.textContent = `Знайдено: ${filteredItems.length} із ${items.length}` + (filteredItems.length ? '' : '. Змініть або очистьте фільтри.');

    const storageKey = `equipment_report_data_${periodStr}`;
    let savedData = {};
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) savedData = JSON.parse(stored);
    } catch(e) {}

    // Читаємо дані попереднього періоду для автоматичного перенесення залишку палива
    const prevPeriodKey = getPreviousEquipmentPeriodKey(periodStr);
    let prevPeriodSavedData = {};
    if (prevPeriodKey) {
        try {
            const prevStored = localStorage.getItem(`equipment_report_data_${prevPeriodKey}`);
            if (prevStored) prevPeriodSavedData = JSON.parse(prevStored);
        } catch(e) {}
    }

    tbody.innerHTML = '';

    filteredItems.forEach((item, idx) => {
        let itemData = savedData[item.uniqueId] || {
            prevFuel: '', prevOil: '',
            p1Fuel: '', p1Oil: '',
            p2Fuel: '', p2Oil: '',
            p3Fuel: '', p3Oil: '',
            nextFuel: ''
        };

        // Перевіряємо залишок з попереднього періоду (nextFuel попереднього стає prevFuel поточного)
        if (prevPeriodSavedData && prevPeriodSavedData[item.uniqueId] && !prevPeriodSavedData[item.uniqueId]._excluded) {
            const carriedFuel = prevPeriodSavedData[item.uniqueId].nextFuel;
            if (carriedFuel !== undefined && carriedFuel !== null && String(carriedFuel).trim() !== '') {
                if (itemData.prevFuel === '' || itemData.prevFuel === undefined || itemData._autoCarried) {
                    itemData.prevFuel = String(carriedFuel).trim();
                    itemData._autoCarried = true;
                }
            }
        }

        const curRole = (typeof window.getCurrentAppRole === 'function')
            ? window.getCurrentAppRole()
            : ((typeof currentRole !== 'undefined') ? currentRole : 'user');
        const canEditEq = (curRole === 'developer') || (typeof window.canRoleEdit === 'function' ? (window.canRoleEdit(curRole, 'equipment_report') && window.canRoleDo(curRole, 'eq_report_edit')) : (curRole === 'admin'));
        const eqLock = canEditEq ? '' : 'disabled readonly style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px; background-color: #f1f2f6; cursor: not-allowed; color: #2c3e50;" title="Редагування доступне тільки для Адміна та Розробника"';

        const tr = document.createElement('tr');
        tr.setAttribute('data-fuel-type', (item.fuelType || '').toUpperCase());
        tr.innerHTML = `
            <td style="text-align: center;">${idx + 1}</td>
            <td><span style="background: #e8f8f5; padding: 2px 6px; border-radius: 4px; font-size: 11px; color: #16a085; font-weight: bold;">${equipmentReportEscape(item.category)}</span></td>
            <td style="text-align: center;"><input type="text" class="eq-rep-input" data-id="${equipmentReportEscape(item.uniqueId)}" data-field="subdivision" list="eq-report-subdivision-options" aria-label="Підрозділ ${equipmentReportEscape(item.model)}" value="${equipmentReportEscape(item.subdivision)}" onchange="changeEquipmentReportFilter('row-subdivision',this.value)" style="width:100%;box-sizing:border-box;padding:4px;border:1px solid #ccc;text-align:center" ${eqLock}></td>
            <td><strong>${equipmentReportEscape(item.model)}</strong></td>
            <td><input type="text" class="eq-rep-input" data-id="${equipmentReportEscape(item.uniqueId)}" data-field="serialNumber" aria-label="Серійний номер ${equipmentReportEscape(item.model)}" value="${equipmentReportEscape(itemData.serialNumber ?? item.serialNumber ?? '')}" style="width:100%;box-sizing:border-box;padding:4px;border:1px solid #ccc" ${eqLock}></td>
            <td style="text-align: center;" class="eq-row-fuel-type">${equipmentReportEscape(item.fuelType)}</td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="prevFuel" value="${itemData.prevFuel || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px; ${itemData._autoCarried ? 'background-color: #f0fdf4;' : ''}" ${eqLock}></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="prevOil" value="${itemData.prevOil || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;" ${eqLock}></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="p1Fuel" value="${itemData.p1Fuel || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;" ${eqLock}></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="p1Oil" value="${itemData.p1Oil || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;" ${eqLock}></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="p2Fuel" value="${itemData.p2Fuel || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;" ${eqLock}></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="p2Oil" value="${itemData.p2Oil || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;" ${eqLock}></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="p3Fuel" value="${itemData.p3Fuel || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;" ${eqLock}></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="p3Oil" value="${itemData.p3Oil || ''}" style="width: 100%; text-align: center; border: 1px solid #ccc; padding: 4px;" ${eqLock}></td>
            <td><input type="text" class="eq-rep-input" data-id="${item.uniqueId}" data-field="nextFuel" value="${itemData.nextFuel || ''}" style="width: 100%; text-align: center; border: 1px solid #27ae60; background: #f0fdf4; padding: 4px; font-weight: bold; color: #166534;" placeholder="0.0" ${eqLock}></td>
            <td class="eq-report-action"><button type="button" data-remove-eq-id="${equipmentReportEscape(item.uniqueId)}" ${canEditEq?'':'disabled'} style="background:#c0392b;color:white;border:0;border-radius:4px;padding:6px;cursor:pointer">Видалити зі звіту</button></td>
        `;
        tbody.appendChild(tr);
        tr.querySelector('[data-remove-eq-id]')?.addEventListener('click', () => removeEquipmentReportItem(item.uniqueId));
    });

    const curRole2 = (typeof window.getCurrentAppRole === 'function')
        ? window.getCurrentAppRole()
        : ((typeof currentRole !== 'undefined') ? currentRole : 'user');
    const canEditEq2 = (curRole2 === 'developer') || (typeof window.canRoleEdit === 'function' ? window.canRoleEdit(curRole2, 'equipment_report') : (curRole2 === 'admin'));
    const eqSaveBtn = document.querySelector('button[onclick="saveEquipmentReportData()"]');
    if (eqSaveBtn) eqSaveBtn.style.setProperty('display', canEditEq2 ? 'inline-flex' : 'none', 'important');
    const addGeneratorBtn = document.getElementById('eq-report-add-generator-btn');
    if (addGeneratorBtn) addGeneratorBtn.style.display = canEditEquipmentReport() ? 'inline-block' : 'none';
    const restoreBtn = document.getElementById('eq-report-restore-btn');
    if (restoreBtn) restoreBtn.style.display = canEditEquipmentReport() ? 'inline-block' : 'none';

    updateEquipmentReportTotals();
}

function updateEquipmentReportTotals() {
    let table = document.getElementById('equipment-report-table');
    if (!table) return;
    let tfoot = table.querySelector('tfoot');
    if (!tfoot) {
        tfoot = document.createElement('tfoot');
        table.appendChild(tfoot);
    }

    let dpPrevFuel = 0, abPrevFuel = 0;
    let dpP1Fuel = 0, abP1Fuel = 0;
    let dpP2Fuel = 0, abP2Fuel = 0;
    let dpP3Fuel = 0, abP3Fuel = 0;
    let dpNextFuel = 0, abNextFuel = 0;

    let sumPrevOilMap = {};
    let sumP1OilMap = {};
    let sumP2OilMap = {};
    let sumP3OilMap = {};

    document.querySelectorAll('#equipment-report-tbody tr').forEach(row => {
        const fuelTypeCell = row.querySelector('.eq-row-fuel-type');
        const fType = fuelTypeCell ? fuelTypeCell.textContent.trim().toUpperCase() : '';
        
        const prevF = evaluateExpression(row.querySelector('.eq-rep-input[data-field="prevFuel"]')?.value);
        const p1F = evaluateExpression(row.querySelector('.eq-rep-input[data-field="p1Fuel"]')?.value);
        const p2F = evaluateExpression(row.querySelector('.eq-rep-input[data-field="p2Fuel"]')?.value);
        const p3F = evaluateExpression(row.querySelector('.eq-rep-input[data-field="p3Fuel"]')?.value);
        const nextF = evaluateExpression(row.querySelector('.eq-rep-input[data-field="nextFuel"]')?.value);

        if (fType.includes('ДП')) {
            dpPrevFuel += prevF;
            dpP1Fuel += p1F;
            dpP2Fuel += p2F;
            dpP3Fuel += p3F;
            dpNextFuel += nextF;
        } else {
            abPrevFuel += prevF;
            abP1Fuel += p1F;
            abP2Fuel += p2F;
            abP3Fuel += p3F;
            abNextFuel += nextF;
        }

        mergeFluidMaps(sumPrevOilMap, parseFluidEntries(row.querySelector('.eq-rep-input[data-field="prevOil"]')?.value));
        mergeFluidMaps(sumP1OilMap, parseFluidEntries(row.querySelector('.eq-rep-input[data-field="p1Oil"]')?.value));
        mergeFluidMaps(sumP2OilMap, parseFluidEntries(row.querySelector('.eq-rep-input[data-field="p2Oil"]')?.value));
        mergeFluidMaps(sumP3OilMap, parseFluidEntries(row.querySelector('.eq-rep-input[data-field="p3Oil"]')?.value));
    });

    const subFilterEl = document.getElementById('equipment-subdivision-filter');
    let footerLabel = 'ВСЬОГО ПО ОБЛАДНАННЮ:';
    if (subFilterEl && subFilterEl.value !== 'all') {
        footerLabel = `ВСЬОГО ПО ПІДРОЗДІЛУ (${subFilterEl.value === '__unassigned__' ? 'Без підрозділу' : equipmentReportEscape(subFilterEl.value)}):`;
    }
    if (document.getElementById('eq-report-model-search')?.value || document.getElementById('eq-report-serial-search')?.value) {
        footerLabel = 'ВСЬОГО ЗА ФІЛЬТРОМ:';
    }

    const totalDpPeriod = dpP1Fuel + dpP2Fuel + dpP3Fuel;
    const totalAbPeriod = abP1Fuel + abP2Fuel + abP3Fuel;

    let totalOilPeriodMap = {};
    mergeFluidMaps(totalOilPeriodMap, sumP1OilMap);
    mergeFluidMaps(totalOilPeriodMap, sumP2OilMap);
    mergeFluidMaps(totalOilPeriodMap, sumP3OilMap);

    tfoot.innerHTML = `
        <tr style="background-color: #eaeaea; font-weight: bold; border-top: 2px solid #bdc3c7;">
            <td colspan="6" style="text-align: right; padding-right: 10px; border-bottom: 1px solid #dcdcdc;">${footerLabel} (ДП)</td>
            <td style="text-align: center; color: #27ae60; border-bottom: 1px solid #dcdcdc;">${dpPrevFuel !== 0 ? dpPrevFuel.toFixed(1) + ' л' : '0 л'}</td>
            <td rowspan="2" style="text-align: center; vertical-align: middle; border-left: 1px solid #dcdcdc; border-right: 1px solid #dcdcdc; font-size: 11px;">${formatFluidBreakdown(sumPrevOilMap)}</td>
            <td style="text-align: center; color: #27ae60; border-bottom: 1px solid #dcdcdc;">${dpP1Fuel !== 0 ? dpP1Fuel.toFixed(1) + ' л' : '0 л'}</td>
            <td rowspan="2" style="text-align: center; vertical-align: middle; border-left: 1px solid #dcdcdc; border-right: 1px solid #dcdcdc; font-size: 11px;">${formatFluidBreakdown(sumP1OilMap)}</td>
            <td style="text-align: center; color: #27ae60; border-bottom: 1px solid #dcdcdc;">${dpP2Fuel !== 0 ? dpP2Fuel.toFixed(1) + ' л' : '0 л'}</td>
            <td rowspan="2" style="text-align: center; vertical-align: middle; border-left: 1px solid #dcdcdc; border-right: 1px solid #dcdcdc; font-size: 11px;">${formatFluidBreakdown(sumP2OilMap)}</td>
            <td style="text-align: center; color: #27ae60; border-bottom: 1px solid #dcdcdc;">${dpP3Fuel !== 0 ? dpP3Fuel.toFixed(1) + ' л' : '0 л'}</td>
            <td rowspan="2" style="text-align: center; vertical-align: middle; border-left: 1px solid #dcdcdc; border-right: 1px solid #dcdcdc; font-size: 11px;">${formatFluidBreakdown(sumP3OilMap)}</td>
            <td style="text-align: center; color: #27ae60; border-bottom: 1px solid #dcdcdc; font-weight: bold;">${dpNextFuel !== 0 ? dpNextFuel.toFixed(1) + ' л' : '0 л'}</td>
            <td class="eq-report-action" rowspan="2"></td>
        </tr>
        <tr style="background-color: #eaeaea; font-weight: bold; border-bottom: 2px solid #bdc3c7;">
            <td colspan="6" style="text-align: right; padding-right: 10px; border-bottom: 2px solid #bdc3c7;">${footerLabel} (АБ)</td>
            <td style="text-align: center; color: #2980b9; border-bottom: 2px solid #bdc3c7;">${abPrevFuel !== 0 ? abPrevFuel.toFixed(1) + ' л' : '0 л'}</td>
            <td style="text-align: center; color: #2980b9; border-bottom: 2px solid #bdc3c7;">${abP1Fuel !== 0 ? abP1Fuel.toFixed(1) + ' л' : '0 л'}</td>
            <td style="text-align: center; color: #2980b9; border-bottom: 2px solid #bdc3c7;">${abP2Fuel !== 0 ? abP2Fuel.toFixed(1) + ' л' : '0 л'}</td>
            <td style="text-align: center; color: #2980b9; border-bottom: 2px solid #bdc3c7;">${abP3Fuel !== 0 ? abP3Fuel.toFixed(1) + ' л' : '0 л'}</td>
            <td style="text-align: center; color: #2980b9; border-bottom: 2px solid #bdc3c7; font-weight: bold;">${abNextFuel !== 0 ? abNextFuel.toFixed(1) + ' л' : '0 л'}</td>
        </tr>
        <tr style="background-color: #d5f5e3; font-weight: bold; border-top: 2px solid #27ae60; border-bottom: 2px solid #27ae60;">
            <td colspan="6" style="text-align: right; padding-right: 10px; color: #145a32;">ВСЬОГО ЗА ПЕРІУД:</td>
            <td colspan="2" style="text-align: center; color: #27ae60;">Початковий: ДП ${dpPrevFuel.toFixed(1)} л | АБ ${abPrevFuel.toFixed(1)} л</td>
            <td colspan="6" style="text-align: left; padding-left: 15px; color: #2c3e50;">Заправка: ДП <strong style="color: #27ae60;">${totalDpPeriod.toFixed(1)} л</strong> | АБ <strong style="color: #2980b9;">${totalAbPeriod.toFixed(1)} л</strong> | Мастило <strong style="color: #8e44ad;">${formatFluidBreakdown(totalOilPeriodMap)}</strong></td>
            <td style="text-align: center; color: #145a32; font-weight: bold;">${(dpNextFuel + abNextFuel) > 0 ? (dpNextFuel + abNextFuel).toFixed(1) + ' л' : '0 л'}</td>
            <td class="eq-report-action"></td>
        </tr>
    `;
}

function saveEquipmentReportData() {
    if (!canEditEquipmentReport()) return;
    const periodInput = document.getElementById('eq-report-custom-period');
    const periodStr = periodInput ? periodInput.value.trim() : "01.10-10.10";

    let periods = getSavedEquipmentPeriodsList();
    if (!periods.includes(periodStr)) {
        periods.push(periodStr);
        localStorage.setItem('eq_saved_periods_list', JSON.stringify(periods));
    }
    initEqReportPeriodDropdown();

    const storageKey = `equipment_report_data_${periodStr}`;
    const reportData = collectEquipmentReportInputs(periodStr);

    localStorage.setItem(storageKey, JSON.stringify(reportData));
    propagateNextFuelToNextPeriod(periodStr, reportData);
    alert(`Звіт по обладнанню за період "${periodStr}" успішно збережено!`);
}

function printEquipmentReport() {
    const table = document.getElementById('equipment-report-table');
    if (!table) {
        window.print();
        return;
    }
    // Синхронізуємо атрибути value для коректного відображення у вікні друку
    table.querySelectorAll('input').forEach(inp => inp.setAttribute('value', inp.value));

    const periodInput = document.getElementById('eq-report-custom-period');
    const periodStr = periodInput ? periodInput.value.trim() : "01.10-10.10";
    const subFilterEl = document.getElementById('equipment-subdivision-filter');
    const subVal = subFilterEl ? subFilterEl.value : 'all';
    const subLabel = subVal !== 'all' ? ` (Підрозділ: ${equipmentReportEscape(subVal)})` : '';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        window.print();
        return;
    }
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Звіт по обладнанню (${periodStr})</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 10px; }
                h2 { text-align: center; margin-bottom: 12px; font-size: 14px; color: #2c3e50; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
                th, td { border: 1px solid #333; padding: 4px 5px; text-align: center; }
                th { background-color: #2e7d32 !important; color: white !important; font-size: 10px; }
                td:nth-child(4) { text-align: left; }
                .eq-report-action, .eq-report-search { display:none !important; }
                input { border: none; text-align: center; width: 100%; font-size: 10px; background: transparent; }
                tfoot tr { font-weight: bold; background: #eee; }
                @media print {
                    @page { size: landscape; margin: 6mm; }
                    body { -webkit-print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <h2>ДЕСЯТИДЕННИЙ ЗВІТ ПО ОБЛАДНАННЮ${subLabel} — Період: ${periodStr}</h2>
            ${table.outerHTML}
        </body>
        </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}

document.addEventListener('input', function(e) {
    if (e.target.classList.contains('eq-rep-input')) {
        if (!canEditEquipmentReport()) return;
        const periodInput = document.getElementById('eq-report-custom-period');
        const periodStr = periodInput ? periodInput.value.trim() : "01.10-10.10";
        const storageKey = `equipment_report_data_${periodStr}`;
        
        const reportData = collectEquipmentReportInputs(periodStr);

        localStorage.setItem(storageKey, JSON.stringify(reportData));
        propagateNextFuelToNextPeriod(periodStr, reportData);
        updateEquipmentReportTotals();
    }
});
