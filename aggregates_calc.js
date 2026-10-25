// ==========================================
// КАЛЬКУЛЯТОР АГРЕГАТІВ (aggregates_calc.js)
// ==========================================

const AGG_CALC_STATE_KEY = 'aggregates_calc_saved_state';

// Завантаження збереженого стану
function loadAggCalcState() {
    try {
        const raw = localStorage.getItem(AGG_CALC_STATE_KEY);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch (e) {}
    return null;
}

// Збереження повного стану калькулятора
function saveAggCalcState() {
    try {
        const rows = [];
        for (let i = 1; i <= 10; i++) {
            rows.push({
                days: document.getElementById(`b-days-${i}`)?.value || '',
                start: document.getElementById(`b-start-${i}`)?.value || '',
                rec: document.getElementById(`b-rec-${i}`)?.value || '',
                end: document.getElementById(`b-end-${i}`)?.value || '',
                spent: document.getElementById(`b-spent-${i}`)?.value || ''
            });
        }

        const state = {
            selectedAggIndex: window._selectedAggIndex !== undefined ? window._selectedAggIndex : 'custom',
            customAggText: window._customAggText || '',
            customCons: document.getElementById('custom-cons-input')?.value || '3.33',
            customOil: document.getElementById('custom-oil-input')?.value || '1.1',
            maxDailyHours: document.getElementById('calc-max-daily-hours')?.value || '12',
            oilCalcExpr: document.getElementById('oil-calc-input')?.value || '',
            isVerification: !!window._isVerificationMode,
            isIntegerHours: !!window._isIntegerHours,
            manualMotoHours: window._manualMotoHours || {},
            periodRandomSeeds: window._periodRandomSeeds || {},
            rows: rows
        };

        localStorage.setItem(AGG_CALC_STATE_KEY, JSON.stringify(state));
    } catch (e) {}
}

// Завантаження всього списку обладнання з усіх категорій
function getAllEquipmentList() {
    let allEquipment = [];
    
    // 1. Генератори
    try {
        let gens = [];
        if (typeof getGeneratorsList === 'function') {
            gens = getGeneratorsList();
        } else {
            const stored = localStorage.getItem('generators_custom_data');
            gens = stored ? JSON.parse(stored) : (typeof defaultGeneratorsData !== 'undefined' ? defaultGeneratorsData : []);
        }
        if (Array.isArray(gens)) {
            gens.forEach(i => allEquipment.push({ ...i, category: 'Генератор' }));
        }
    } catch(e) {}

    // 2. Webasto
    try {
        let web = [];
        if (typeof getWebastoList === 'function') {
            web = getWebastoList();
        } else {
            const stored = localStorage.getItem('webasto_custom_data');
            web = stored ? JSON.parse(stored) : (typeof defaultWebastoData !== 'undefined' ? defaultWebastoData : []);
        }
        if (Array.isArray(web)) {
            web.forEach(i => allEquipment.push({ ...i, category: 'Webasto' }));
        }
    } catch(e) {}

    // 3. Теплові пушки
    try {
        let heat = [];
        if (typeof getHeatersList === 'function') {
            heat = getHeatersList();
        } else {
            const stored = localStorage.getItem('heaters_custom_data');
            heat = stored ? JSON.parse(stored) : (typeof defaultHeatersData !== 'undefined' ? defaultHeatersData : []);
        }
        if (Array.isArray(heat)) {
            heat.forEach(i => allEquipment.push({ ...i, category: 'Теплова пушка' }));
        }
    } catch(e) {}

    // 4. Бензопили
    try {
        let saws = [];
        if (typeof getChainsawsList === 'function') {
            saws = getChainsawsList();
        } else {
            const stored = localStorage.getItem('chainsaws_custom_data');
            saws = stored ? JSON.parse(stored) : (typeof defaultChainsawsData !== 'undefined' ? defaultChainsawsData : []);
        }
        if (Array.isArray(saws)) {
            saws.forEach(i => allEquipment.push({ ...i, category: 'Бензопила' }));
        }
    } catch(e) {}

    // 5. Помпи — та сама схема норм і розрахунку, окремі збережені записи.
    try {
        const pumps = typeof getPumpsList === 'function' ? getPumpsList()
            : JSON.parse(localStorage.getItem('pumps_custom_data') || '[]');
        if (Array.isArray(pumps)) pumps.filter(item => !/знищ/ui.test(String(item.note || item.comment || '')))
            .forEach(item => allEquipment.push({...item, category: 'Помпа'}));
    } catch(e) {}
    return allEquipment;
}

// Оновлення списку в дропдауні без стирання форми (для фонової синхронізації)
window.refreshAggregatesEquipmentList = function() {
    const listContainer = document.getElementById('agg-items-list');
    if (!listContainer) return;
    const selected = window._allCalculatedEquipment?.[window._selectedAggIndex];
    const all = getAllEquipmentList();
    if (selected) {
        const index = all.findIndex(item => item.category === selected.category && String(item.id) === String(selected.id));
        if (index >= 0) window._selectedAggIndex = index;
    }
    window._allCalculatedEquipment = all;
    renderAggDropdownItems(all);
    onSelectedEquipmentChange();
};

// ГОЛОВНЕ ВІДОБРАЖЕННЯ КАЛЬКУЛЯТОРА
function renderAggregatesCalcView() {
    const container = document.getElementById('aggregates-calc-container');
    if (!container) return;

    const savedState = loadAggCalcState();

    if (savedState) {
        window._selectedAggIndex = savedState.selectedAggIndex !== undefined ? savedState.selectedAggIndex : 'custom';
        window._customAggText = savedState.customAggText || '';
        window._isVerificationMode = !!savedState.isVerification;
        window._isIntegerHours = !!savedState.isIntegerHours;
        window._manualMotoHours = savedState.manualMotoHours || {};
        window._periodRandomSeeds = savedState.periodRandomSeeds || {};
    } else {
        if (window._selectedAggIndex === undefined) window._selectedAggIndex = 'custom';
        if (window._customAggText === undefined) window._customAggText = '';
        if (window._isVerificationMode === undefined) window._isVerificationMode = false;
        if (window._isIntegerHours === undefined) window._isIntegerHours = false;
        if (!window._manualMotoHours) window._manualMotoHours = {};
        if (!window._periodRandomSeeds) window._periodRandomSeeds = {};
    }

    const allEquipment = getAllEquipmentList();
    window._allCalculatedEquipment = allEquipment;

    let currentSelectedText = 'Свій агрегат';
    if (window._selectedAggIndex === 'custom') {
        currentSelectedText = 'Свій агрегат';
    } else if (window._selectedAggIndex !== null && window._selectedAggIndex >= 0 && allEquipment[window._selectedAggIndex]) {
        let eq = allEquipment[window._selectedAggIndex];
        currentSelectedText = `${eq.category}: ${eq.model || 'Без назви'} (${eq.locationSubdivision || eq.subdivision || 'РМТЗ'})`;
    } else if (window._customAggText) {
        currentSelectedText = window._customAggText;
    }

    const maxH = (savedState && savedState.maxDailyHours) ? savedState.maxDailyHours : '12';
    const oilExpr = (savedState && savedState.oilCalcExpr) ? savedState.oilCalcExpr : '';

    let html = `
        <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #bdc3c7; max-width: 1050px; margin: 0 auto;">
            <!-- ЦЕНТРАЛЬНИЙ ЗАГОЛОВОК ТА КНОПКИ -->
            <div style="position: relative; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #2e7d32; padding-bottom: 10px; margin-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button id="btn-reset-agg-calc" class="action-btn" style="background-color: #95a5a6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; display: inline-flex; align-items: center;" onclick="resetAggregatesCalc()">
                        <span style="font-size: 13px; margin-right: 5px;">🔄</span> Очистити
                    </button>
                </div>

                <h3 style="color: #2e7d32; margin: 0; font-size: 18px; text-align: center; font-weight: bold; flex-grow: 1;">Розрахунок витрати палива та мастил агрегатів</h3>
                
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="action-btn print-btn" style="background-color: #337ab7; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; white-space: nowrap;" onclick="printAggregatesReport()">
                        <span style="font-size: 14px; margin-right: 6px; vertical-align: middle;">🖨️</span> Друк
                    </button>
                </div>
            </div>
            
            <!-- ДВА СТОВПЧИКИ ЗВЕРХУ -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <!-- Стовпчик 1: Випадаючий список з пошуком -->
                <div style="position: relative;">
                    <label style="display: block; font-weight: bold; margin-bottom: 5px; font-size: 13px;">1. Оберіть або введіть назву агрегата:</label>
                    <div id="agg-dropdown-box" style="position: relative; width: 100%;">
                        <div id="agg-dropdown-header" onclick="toggleAggDropdown(event)" style="width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #bdc3c7; font-size: 13px; background: #fff; box-sizing: border-box; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                            <span id="agg-header-text" style="color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${currentSelectedText}</span>
                            <span style="font-size: 11px; color: #7f8c8d; margin-left: 5px;">▼</span>
                        </div>
                        
                        <div id="agg-dropdown-panel" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #bdc3c7; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; margin-top: 3px;">
                            <div style="padding: 8px; border-bottom: 1px solid #e0e0e0; background: #f9f9f9;">
                                <input type="text" id="agg-search-input" placeholder="Пошук або введіть назву..." oninput="filterAggDropdown(this.value)" onclick="event.stopPropagation()" style="width: 100%; padding: 8px; border: 1px solid #bdc3c7; border-radius: 4px; font-size: 12px; box-sizing: border-box; outline: none;">
                            </div>
                            <div id="agg-items-list" style="max-height: 220px; overflow-y: auto;">
                                <!-- Елементи списку -->
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Стовпчик 2: Розхід в годинах + мастило -->
                <div>
                    <div style="margin-bottom: 5px;">
                        <label style="font-weight: bold; font-size: 13px; margin: 0;">2. Розхід агрегата (год) та мастило:</label>
                    </div>
                    <div id="eq-rates-info-box" style="padding: 9px 12px; background: #f4f6f7; border-radius: 4px; border: 1px solid #bdc3c7; font-size: 13px; color: #555; height: 38px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between;">
                        <span style="color: #7f8c8d; font-style: italic;">Оберіть агрегат ліворуч...</span>
                    </div>
                </div>
            </div>

            <!-- ДВА БЛОКИ ПАРАМЕТРІВ РОЗРАХУНКУ ЗВЕРХУ -->
            <div style="display: grid; grid-template-columns: 1.8fr 0.9fr; gap: 15px; margin-bottom: 20px;">
                <!-- Лівий блок: Таблиця залишків (Варіант Б) -->
                <div style="background: #f4f6f7; padding: 12px; border-radius: 6px; border: 1px solid #dcdcdc;">
                    <div style="max-height: 220px; overflow-y: auto; margin-bottom: 8px;">
                        <table style="width: 100%; border-collapse: collapse; background: white; font-size: 11px;">
                            <thead>
                                <tr style="background: #c0392b; color: white;">
                                    <th style="padding: 4px; border: 1px solid #bdc3c7; font-size: 10px; width: 18%;">Кільк. днів</th>
                                    <th style="padding: 4px; border: 1px solid #bdc3c7; font-size: 10px; width: 20.5%;">Залишок на поч.</th>
                                    <th style="padding: 4px; border: 1px solid #bdc3c7; font-size: 10px; width: 20.5%;">Отримано</th>
                                    <th style="padding: 4px; border: 1px solid #bdc3c7; font-size: 10px; width: 20.5%;">Залишок на кін.</th>
                                    <th style="padding: 4px; border: 1px solid #bdc3c7; font-size: 10px; width: 20.5%;">Витрачено ПММ</th>
                                </tr>
                            </thead>
                            <tbody>
    `;

    for (let i = 1; i <= 10; i++) {
        const rowData = (savedState && savedState.rows && savedState.rows[i - 1]) ? savedState.rows[i - 1] : { days: '', start: '', rec: '', end: '', spent: '' };
        html += `
            <tr>
                <td style="padding: 2px; border: 1px solid #bdc3c7;"><input type="number" step="1" min="0" max="31" id="b-days-${i}" value="${rowData.days || ''}" oninput="onDaysInputChange(${i})" style="width: 100%; border: none; text-align: center; font-size: 11px; padding: 3px;" placeholder=""></td>
                <td style="padding: 2px; border: 1px solid #bdc3c7;"><input type="number" step="0.1" id="b-start-${i}" value="${rowData.start || ''}" oninput="this.dataset.auto='false'; calculateVariantBRow(${i})" style="width: 100%; border: none; text-align: center; font-size: 11px; padding: 3px;" placeholder=""></td>
                <td style="padding: 2px; border: 1px solid #bdc3c7;"><input type="number" step="0.1" id="b-rec-${i}" value="${rowData.rec || ''}" oninput="calculateVariantBRow(${i})" style="width: 100%; border: none; text-align: center; font-size: 11px; padding: 3px;" placeholder=""></td>
                <td style="padding: 2px; border: 1px solid #bdc3c7;"><input type="number" step="0.1" id="b-end-${i}" value="${rowData.end || ''}" oninput="calculateVariantBRow(${i})" style="width: 100%; border: none; text-align: center; font-size: 11px; padding: 3px;" placeholder=""></td>
                <td style="padding: 2px; border: 1px solid #bdc3c7;"><input type="number" step="0.1" id="b-spent-${i}" value="${rowData.spent || ''}" readonly style="width: 100%; border: none; text-align: center; font-size: 11px; padding: 3px; font-weight: bold; color: #c0392b; background: #f9f9f9;" placeholder=""></td>
            </tr>
        `;
    }

    html += `
                            </tbody>
                        </table>
                    </div>

                    <!-- ПІДСУМОК ТАБЛИЦІ ЗЛІВА -->
                    <div id="variant-b-summary-box" style="display: grid; grid-template-columns: 18% 20.5% 20.5% 20.5% 20.5%; gap: 2px; text-align: center; font-size: 10px;">
                        <div style="background: white; padding: 4px 2px; border-radius: 3px; border: 1px solid #bdc3c7;">
                            <div id="sum-b-days" style="font-weight: bold; color: #2c3e50; font-size: 11px;">0</div>
                        </div>
                        <div style="background: white; padding: 4px 2px; border-radius: 3px; border: 1px solid #bdc3c7;">
                            <div id="sum-b-start" style="font-weight: bold; color: #2c3e50; font-size: 11px;">0.0</div>
                        </div>
                        <div style="background: white; padding: 4px 2px; border-radius: 3px; border: 1px solid #bdc3c7;">
                            <div id="sum-b-rec" style="font-weight: bold; color: #2e7d32; font-size: 11px;">0.0</div>
                        </div>
                        <div style="background: white; padding: 4px 2px; border-radius: 3px; border: 1px solid #bdc3c7;">
                            <div id="sum-b-end" style="font-weight: bold; color: #2980b9; font-size: 11px;">0.0</div>
                        </div>
                        <div style="background: white; padding: 4px 2px; border-radius: 3px; border: 1px solid #bdc3c7;">
                            <div id="sum-b-spent" style="font-weight: bold; color: #c0392b; font-size: 11px;">0.0</div>
                        </div>
                    </div>
                </div>

                <!-- Правий блок: Ліміт часу + Калькулятор мастила і Всього мастила -->
                <div style="background: #f4f6f7; padding: 12px; border-radius: 6px; border: 1px solid #dcdcdc; display: flex; flex-direction: column; justify-content: flex-start; gap: 10px;">
                    <!-- Ліміт часу на день -->
                    <div style="background: #fef9e7; padding: 10px; border-radius: 4px; border: 1px solid #f39c12;">
                        <div style="font-weight: bold; margin-bottom: 6px; font-size: 11px; color: #d35400;">Ліміт часу на день</div>
                        <label style="display: block; margin-bottom: 3px; font-size: 10px; color: #555;" title="Максимально можлива кількість годин роботи агрегата на добу">Макс. годин на день (ліміт):</label>
                        <input type="number" id="calc-max-daily-hours" value="${maxH}" step="0.5" min="1" max="24" oninput="saveAggCalcState(); triggerRecalc();" style="width: 100%; padding: 5px; border-radius: 4px; border: 1px solid #f39c12; font-size: 12px; box-sizing: border-box; background: #fff; margin-bottom: 4px;">
                        <div style="font-size: 9px; color: #7f8c8d; font-style: italic; line-height: 1.1;">Гарантує, що жоден день не перевищить цей ліміт годин.</div>
                    </div>

                    <!-- ДВОКОЛОНКОВИЙ БЛОК: Калькулятор мастила зліва, Всього мастила справа -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <!-- Ліва колонка: Калькулятор мастила -->
                        <div style="background: white; padding: 8px; border-radius: 4px; border: 1px solid #dcdcdc; display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <div style="font-weight: bold; font-size: 10px; color: #2c3e50; margin-bottom: 3px;">Калькулятор мастила:</div>
                                <input type="text" id="oil-calc-input" value="${oilExpr}" placeholder="0.3+0.3" oninput="calculateOilExpr(this.value); saveAggCalcState();" style="width: 100%; padding: 4px; border: 1px solid #bdc3c7; border-radius: 3px; font-size: 11px; box-sizing: border-box; margin-bottom: 4px; outline: none;">
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; border-top: 1px solid #eee; padding-top: 3px;">
                                <span style="color: #7f8c8d;">Сума:</span>
                                <span id="oil-calc-result" style="font-weight: bold; color: #2980b9; font-size: 11px;">0.00 л</span>
                            </div>
                        </div>

                        <!-- Права колонка: Всього мастила -->
                        <div style="background: white; padding: 8px; border-radius: 4px; border: 1px solid #dcdcdc; text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <div style="color: #7f8c8d; font-size: 9px; margin-bottom: 1px;">Всього мастила</div>
                                <div id="oil-total-val" style="font-weight: bold; color: #2980b9; font-size: 13px;">0.00 л</div>
                            </div>
                            <div id="oil-avg-val" style="color: #7f8c8d; font-size: 8px; border-top: 1px solid #eee; padding-top: 3px;">Сер. розхід: 0.00 л/д</div>
                        </div>
                    </div>

                    <!-- ВІКОНЦЕ: Режим перевірки -->
                    <div id="verification-summary-container" style="background: #fff; padding: 10px; border-radius: 4px; border: 1px solid #c0392b; text-align: center; display: ${window._isVerificationMode ? 'block' : 'none'};">
                        <div style="font-weight: bold; color: #c0392b; font-size: 11px; margin-bottom: 4px;">Режим перевірки</div>
                        <div style="display: flex; justify-content: space-around; font-size: 11px;">
                            <div>
                                <div style="color: #7f8c8d; font-size: 9px;">Мото-години</div>
                                <div id="verif-total-hours" style="font-weight: bold; color: #2c3e50; font-size: 14px;">0.0 год</div>
                            </div>
                            <div>
                                <div style="color: #7f8c8d; font-size: 9px;">Витрата палива</div>
                                <div id="verif-total-fuel" style="font-weight: bold; color: #c0392b; font-size: 14px;">0.0 л</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="calc-details-box" style="margin-bottom: 20px;">
                <p style="color: #7f8c8d; font-style: italic; text-align: center; margin: 0;">Оберіть обладнання вище та введіть параметри для розрахунку.</p>
            </div>
        </div>
    `;

    container.innerHTML = html;
    renderAggDropdownItems(allEquipment);
    onSelectedEquipmentChange();

    if (savedState) {
        if (savedState.customCons && document.getElementById('custom-cons-input')) {
            document.getElementById('custom-cons-input').value = savedState.customCons;
        }
        if (savedState.customOil && document.getElementById('custom-oil-input')) {
            document.getElementById('custom-oil-input').value = savedState.customOil;
        }
    }

    if (oilExpr) {
        calculateOilExpr(oilExpr);
    }

    updateVariantBSummary();
    triggerRecalc();

    // Закриття дропдауну при кліку поза ним
    document.addEventListener('click', function closeAggDropdown(e) {
        const box = document.getElementById('agg-dropdown-box');
        if (box && !box.contains(e.target)) {
            const panel = document.getElementById('agg-dropdown-panel');
            if (panel) panel.style.display = 'none';
        }
    });
}

// Очистити всі поля таблиці калькулятора
function resetAggregatesCalc() {
    for (let i = 1; i <= 10; i++) {
        const daysIn = document.getElementById(`b-days-${i}`);
        const startIn = document.getElementById(`b-start-${i}`);
        const recIn = document.getElementById(`b-rec-${i}`);
        const endIn = document.getElementById(`b-end-${i}`);
        const spentIn = document.getElementById(`b-spent-${i}`);

        if (daysIn) daysIn.value = '';
        if (startIn) { 
            startIn.value = ''; 
            startIn.dataset.auto = 'false'; 
        }
        if (recIn) recIn.value = '';
        if (endIn) endIn.value = '';
        if (spentIn) spentIn.value = '';
    }

    window._periodRandomSeeds = {};
    window._manualMotoHours = {};

    updateVariantBSummary();
    saveAggCalcState();
    triggerRecalc();

    // Візуальний індикатор успішного очищення на кнопці
    const btn = document.getElementById('btn-reset-agg-calc');
    if (btn) {
        const origHtml = btn.innerHTML;
        btn.innerHTML = '<span style="font-size: 13px; margin-right: 5px;">✓</span> Очищено';
        btn.style.backgroundColor = '#27ae60';
        setTimeout(() => {
            btn.innerHTML = origHtml;
            btn.style.backgroundColor = '#95a5a6';
        }, 1200);
    }
}

// Калькулятор виразу мастила
function calculateOilExpr(expr) {
    const resEl = document.getElementById('oil-calc-result');
    if (!resEl) return;

    if (!expr || !expr.trim()) {
        resEl.textContent = '0.00 л';
        return;
    }

    try {
        let cleanExpr = expr.replace(/,/g, '.').replace(/[^0-9.+\-*/]/g, '');
        let sum = Function('"use strict"; return (' + cleanExpr + ')')();
        
        if (isNaN(sum) || !isFinite(sum)) {
            resEl.textContent = 'Помилка';
        } else {
            resEl.textContent = sum.toFixed(2) + ' л';
        }
    } catch (e) {
        resEl.textContent = '...';
    }
}

// Обробка зміни кількості днів
function onDaysInputChange(rowIdx) {
    updateVariantBSummary();
    saveAggCalcState();
    triggerRecalc();
}

// Розрахунок рядка таблиці B
function calculateVariantBRow(rowIdx, skipPropagate) {
    const startInput = document.getElementById(`b-start-${rowIdx}`);
    const recInput = document.getElementById(`b-rec-${rowIdx}`);
    const endInput = document.getElementById(`b-end-${rowIdx}`);
    const spentInput = document.getElementById(`b-spent-${rowIdx}`);

    if (!startInput || !recInput || !endInput || !spentInput) return;

    let startVal = parseFloat(startInput.value);
    let recVal = parseFloat(recInput.value) || 0;
    let endVal = parseFloat(endInput.value);

    let isIntegerHours = !!window._isIntegerHours;

    if (!isNaN(startVal) && !isNaN(endVal)) {
        let spent = startVal + recVal - endVal;
        spentInput.value = spent >= 0 ? (isIntegerHours ? Math.round(spent) : spent.toFixed(1)) : (isIntegerHours ? '0' : '0.0');
    } else {
        spentInput.value = '';
    }

    if (!skipPropagate && rowIdx < 10 && !isNaN(endVal)) {
        let nextStartInput = document.getElementById(`b-start-${rowIdx + 1}`);
        if (nextStartInput && (!nextStartInput.value || nextStartInput.dataset.auto === 'true')) {
            nextStartInput.value = isIntegerHours ? Math.round(endVal) : endVal.toFixed(1);
            nextStartInput.dataset.auto = 'true';
            calculateVariantBRow(rowIdx + 1, false);
        }
    }

    updateVariantBSummary();
    saveAggCalcState();
    triggerRecalc();
}

// Підсумок таблиці залишків
function updateVariantBSummary() {
    let totalDays = 0;
    let firstStart = 0;
    let totalRec = 0;
    let lastEnd = 0;
    let totalSpent = 0;

    let foundFirstStart = false;
    let isIntegerHours = !!window._isIntegerHours;

    for (let i = 1; i <= 10; i++) {
        const daysIn = document.getElementById(`b-days-${i}`);
        const startIn = document.getElementById(`b-start-${i}`);
        const recIn = document.getElementById(`b-rec-${i}`);
        const endIn = document.getElementById(`b-end-${i}`);
        const spentIn = document.getElementById(`b-spent-${i}`);

        if (daysIn && daysIn.value) {
            let d = parseInt(daysIn.value) || 0;
            if (d > 0) totalDays += d;
        }

        if (startIn && startIn.value !== '') {
            let s = parseFloat(startIn.value) || 0;
            if (!foundFirstStart) {
                firstStart = s;
                foundFirstStart = true;
            }
        }

        if (recIn && recIn.value !== '') {
            totalRec += parseFloat(recIn.value) || 0;
        }

        if (endIn && endIn.value !== '') {
            let e = parseFloat(endIn.value) || 0;
            if (!isNaN(e)) {
                lastEnd = e;
            }
        }

        if (spentIn && spentIn.value !== '') {
            let sp = parseFloat(spentIn.value) || 0;
            totalSpent += sp;
        }
    }

    const dEl = document.getElementById('sum-b-days');
    const sEl = document.getElementById('sum-b-start');
    const rEl = document.getElementById('sum-b-rec');
    const eEl = document.getElementById('sum-b-end');
    const spEl = document.getElementById('sum-b-spent');

    if (dEl) dEl.textContent = totalDays;
    if (sEl) sEl.textContent = isIntegerHours ? Math.round(firstStart) : firstStart.toFixed(1);
    if (rEl) rEl.textContent = isIntegerHours ? Math.round(totalRec) : totalRec.toFixed(1);
    if (eEl) eEl.textContent = isIntegerHours ? Math.round(lastEnd) : lastEnd.toFixed(1);
    if (spEl) spEl.textContent = isIntegerHours ? Math.round(totalSpent) : totalSpent.toFixed(1);
}

// Випадаючий список агрегатів
function toggleAggDropdown(event) {
    if (event) event.stopPropagation();
    const panel = document.getElementById('agg-dropdown-panel');
    if (!panel) return;
    const isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        const searchInput = document.getElementById('agg-search-input');
        if (searchInput) {
            searchInput.focus();
            searchInput.value = '';
            filterAggDropdown('');
        }
    }
}

function renderAggDropdownItems(items) {
    const listContainer = document.getElementById('agg-items-list');
    if (!listContainer) return;

    let html = `<div onclick="selectCustomAggOption()" style="padding: 9px 12px; cursor: pointer; border-bottom: 1px solid #e0e0e0; color: #2e7d32; font-weight: bold; background: #f4f6f7;" onmouseover="this.style.background='#eaf2f8'" onmouseout="this.style.background='#f4f6f7'">➕ Свій агрегат</div>`;

    items.forEach((eq, idx) => {
        const title = `${eq.category}: ${eq.model || 'Без назви'} (${eq.locationSubdivision || eq.subdivision || 'РМТЗ'})`;
        html += `<div onclick="selectAggItem(${idx}, '${title.replace(/'/g, "\\'")}')" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f2f2f2; font-size: 12px;" onmouseover="this.style.background='#eaf2f8'" onmouseout="this.style.background='#fff'">${title}</div>`;
    });

    listContainer.innerHTML = html;
}

function filterAggDropdown(query) {
    const q = (query || '').toLowerCase().trim();
    const all = window._allCalculatedEquipment || [];
    
    let html = `<div onclick="selectCustomAggOption()" style="padding: 9px 12px; cursor: pointer; border-bottom: 1px solid #e0e0e0; color: #2e7d32; font-weight: bold; background: #f4f6f7;" onmouseover="this.style.background='#eaf2f8'" onmouseout="this.style.background='#f4f6f7'">➕ Свій агрегат</div>`;

    const filtered = all.filter(eq => {
        const title = `${eq.category}: ${eq.model || ''} (${eq.locationSubdivision || eq.subdivision || 'РМТЗ'})`.toLowerCase();
        return title.includes(q);
    });

    if (filtered.length === 0 && q) {
        html += `<div onclick="selectCustomAggText('${query.replace(/'/g, "\\'")}')" style="padding: 10px 12px; cursor: pointer; color: #2980b9; font-weight: bold; font-size: 12px;" onmouseover="this.style.background='#eaf2f8'" onmouseout="this.style.background='#fff'">➕ Використати власне: "${query}"</div>`;
    } else {
        filtered.forEach((eq) => {
            const originalIdx = all.indexOf(eq);
            const title = `${eq.category}: ${eq.model || 'Без назви'} (${eq.locationSubdivision || eq.subdivision || 'РМТЗ'})`;
            html += `<div onclick="selectAggItem(${originalIdx}, '${title.replace(/'/g, "\\'")}')" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f2f2f2; font-size: 12px;" onmouseover="this.style.background='#eaf2f8'" onmouseout="this.style.background='#fff'">${title}</div>`;
        });
    }

    const listContainer = document.getElementById('agg-items-list');
    if (listContainer) listContainer.innerHTML = html;
}

function selectCustomAggOption() {
    window._selectedAggIndex = 'custom';
    window._customAggText = '';

    const headerText = document.getElementById('agg-header-text');
    if (headerText) {
        headerText.textContent = 'Свій агрегат';
        headerText.style.color = '#333';
    }

    const panel = document.getElementById('agg-dropdown-panel');
    if (panel) panel.style.display = 'none';

    onSelectedEquipmentChange();
    saveAggCalcState();
}

function selectAggItem(index, titleText) {
    window._selectedAggIndex = index;
    window._customAggText = '';

    const headerText = document.getElementById('agg-header-text');
    if (headerText) {
        headerText.textContent = titleText;
        headerText.style.color = '#333';
    }

    const panel = document.getElementById('agg-dropdown-panel');
    if (panel) panel.style.display = 'none';

    onSelectedEquipmentChange();
    saveAggCalcState();
}

function aggregateInventoryNumber(value) {
    const text = String(value ?? '').trim().replace(',', '.');
    if (!/^\d+(?:\.\d*)?$/.test(text)) return 0;
    const number = Number(text);
    return Number.isFinite(number) ? number : 0;
}

function selectCustomAggText(customText) {
    window._selectedAggIndex = -1;
    window._customAggText = customText;

    const headerText = document.getElementById('agg-header-text');
    if (headerText) {
        headerText.textContent = customText;
        headerText.style.color = '#333';
    }

    const panel = document.getElementById('agg-dropdown-panel');
    if (panel) panel.style.display = 'none';

    onSelectedEquipmentChange();
    saveAggCalcState();
}

function getSelectedEquipment() {
    if (window._selectedAggIndex === 'custom') {
        const cons = parseFloat(document.getElementById('custom-cons-input')?.value) || 3.33;
        const oil = parseFloat(document.getElementById('custom-oil-input')?.value) || 1.1;
        return {
            model: 'Свій агрегат',
            category: 'Власний',
            consumption: cons,
            oilNorm10Days: oil,
            fuelType: 'ДП',
            subdivision: 'РМТЗ'
        };
    }
    if (window._selectedAggIndex !== null && window._selectedAggIndex >= 0 && window._allCalculatedEquipment) {
        const selected = window._allCalculatedEquipment[window._selectedAggIndex];
        if (!selected) return null;
        // The cached dropdown identifies the unit; current registry values supply its norms.
        const current = getAllEquipmentList().find(item => item.category === selected.category && String(item.id) === String(selected.id));
        if (!current) return null;
        return {...current, consumption: aggregateInventoryNumber(current.consumption),
            oilNorm10Days: aggregateInventoryNumber(current.oilNorm10Days)};
    }
    if (window._customAggText) {
        const cons = parseFloat(document.getElementById('custom-cons-input')?.value) || 3.33;
        const oil = parseFloat(document.getElementById('custom-oil-input')?.value) || 1.1;
        return {
            model: window._customAggText,
            category: 'Власне обладнання',
            consumption: cons,
            oilNorm10Days: oil,
            fuelType: 'ДП',
            subdivision: 'РМТЗ'
        };
    }
    const cons = parseFloat(document.getElementById('custom-cons-input')?.value) || 3.33;
    const oil = parseFloat(document.getElementById('custom-oil-input')?.value) || 1.1;
    return {
        model: 'Свій агрегат',
        category: 'Власний',
        consumption: cons,
        oilNorm10Days: oil,
        fuelType: 'ДП',
        subdivision: 'РМТЗ'
    };
}

function onSelectedEquipmentChange() {
    const infoBox = document.getElementById('eq-rates-info-box');
    if (!infoBox) return;

    let currentHoursText = document.getElementById('top-total-hours')?.textContent || '0.0 год';
    let currentDaysText = document.getElementById('top-total-days-sub')?.textContent || '(0 дн)';

    let hoursBlockHtml = `
        <div id="top-total-hours-container" style="background: #fff; padding: 2px 8px; border-radius: 4px; border: 1px solid #bdc3c7; font-size: 11px; display: flex; gap: 4px; align-items: center;">
            <span style="color: #7f8c8d;">Заплановано м/г:</span>
            <span id="top-total-hours" style="font-weight: bold; color: #2c3e50;">${currentHoursText}</span>
            <span id="top-total-days-sub" style="color: #2e7d32; font-size: 10px;">${currentDaysText}</span>
        </div>
    `;

    if (window._selectedAggIndex === 'custom' || window._selectedAggIndex === -1) {
        const savedState = loadAggCalcState();
        const savedCons = savedState?.customCons || '3.33';
        const savedOil = savedState?.customOil || '1.1';
        infoBox.innerHTML = `
            <div style="display: flex; gap: 8px; align-items: center; width: 100%; font-size: 11px; justify-content: space-between;">
                <div style="display: flex; gap: 8px; align-items: center;">
                    <div><strong>Розхід:</strong> <input type="number" id="custom-cons-input" value="${savedCons}" step="0.1" min="0.1" oninput="saveAggCalcState(); triggerRecalc();" style="width: 50px; padding: 3px; font-size: 11px; border: 1px solid #bdc3c7; border-radius: 3px;"> л/год</div>
                    <div><strong>Мастило(10д):</strong> <input type="number" id="custom-oil-input" value="${savedOil}" step="0.1" min="0" oninput="saveAggCalcState(); triggerRecalc();" style="width: 50px; padding: 3px; font-size: 11px; border: 1px solid #bdc3c7; border-radius: 3px;"> л</div>
                </div>
                ${hoursBlockHtml}
            </div>
        `;
        triggerRecalc();
        return;
    }

    const eq = getSelectedEquipment();
    if (!eq) return;

    const hourlyConsumption = aggregateInventoryNumber(eq.consumption);
    const oilNorm = aggregateInventoryNumber(eq.oilNorm10Days);

    infoBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div style="display: flex; gap: 12px; align-items: center;">
                <span><strong>Розхід:</strong> <span style="color: #c0392b;">${hourlyConsumption > 0 ? hourlyConsumption + ' л/год' : 'Вкажіть норму в «Облік обладнання»'}</span></span>
                <span><strong>Мастило (10 дн):</strong> <span style="color: #2980b9;">${oilNorm > 0 ? oilNorm + ' л' : '—'}</span></span>
            </div>
            ${hoursBlockHtml}
        </div>
    `;

    triggerRecalc();
}

// ПЕРЕМИКАННЯ РЕЖИМІВ
function setAggCalcMode(isVerif) {
    window._isVerificationMode = !!isVerif;
    saveAggCalcState();
    triggerRecalc();
}

function toggleAggCalcMode() {
    setAggCalcMode(!window._isVerificationMode);
}

function setAggHoursMode(isInteger) {
    window._isIntegerHours = !!isInteger;

    // Якщо перемикаємо у Цілі (0), округлюємо всі збережені ручні мото-години
    if (window._isIntegerHours && window._manualMotoHours) {
        Object.keys(window._manualMotoHours).forEach(k => {
            let val = parseFloat(window._manualMotoHours[k]);
            if (!isNaN(val)) {
                window._manualMotoHours[k] = Math.round(val);
            }
        });
    }

    for (let i = 1; i <= 10; i++) {
        calculateVariantBRow(i, true);
    }
    saveAggCalcState();
    triggerRecalc();
}

function toggleAggHoursMode() {
    setAggHoursMode(!window._isIntegerHours);
}

// ПЕРЕРАХУНОК ХАОТИЧНОГО РОЗПОДІЛУ З НОВИМИ ВАГАМИ
function reseedChaosDistribution() {
    window._periodRandomSeeds = {};
    saveAggCalcState();
    triggerRecalc();
}

// ОСНОВНА ФУНКЦІЯ РОЗРАХУНКУ
function triggerRecalc() {
    const eq = getSelectedEquipment();
    if (!eq) return;

    let maxDailyHours = parseFloat(document.getElementById('calc-max-daily-hours')?.value) || 24;
    const hourlyRate = aggregateInventoryNumber(eq.consumption);
    if (hourlyRate <= 0) {
        const results = document.getElementById('calc-details-box');
        if (results) results.textContent = 'Для розрахунку вкажіть розхід палива в «Облік обладнання» для вибраного агрегату.';
        return;
    }
    let baseOilNorm10Days = parseFloat(eq.oilNorm10Days) || 0;
    let isIntegerHours = !!window._isIntegerHours;
    let isVerification = !!window._isVerificationMode;

    let totalMotoHoursAll = 0;
    let totalFuelAll = 0;
    let totalOilAll = 0;
    let allDailyFuels = [];
    let allDailyHours = [];
    let allDailyOils = [];
    let allDayColors = [];

    const periodColors = ['#ffffff', '#f4f6f7', '#eaf2f8', '#fef9e7', '#f2f4f4'];

    if (!window._periodRandomSeeds) {
        window._periodRandomSeeds = {};
    }

    let globalDayIndex = 0;

    for (let i = 1; i <= 10; i++) {
        const daysInput = document.getElementById(`b-days-${i}`);
        const spentInput = document.getElementById(`b-spent-${i}`);

        if (!daysInput || !spentInput) continue;

        let periodDays = parseInt(daysInput.value) || 0;
        let periodSpent = parseFloat(spentInput.value) || 0;

        if (periodDays <= 0 || periodSpent <= 0) continue;

        let targetFuelToSpend = periodSpent;
        if (targetFuelToSpend < 0) targetFuelToSpend = 0;

        let periodDailyFuels = [];

        if (isVerification) {
            let periodSpentSum = 0;
            for (let d = 0; d < periodDays; d++) {
                let mInputKey = `${i}_${d}`;
                let rawVal = (window._manualMotoHours && window._manualMotoHours[mInputKey] !== undefined) 
                    ? window._manualMotoHours[mInputKey] 
                    : (targetFuelToSpend / periodDays / hourlyRate);
                
                let dHours = isIntegerHours ? Math.round(parseFloat(rawVal) || 0) : (parseFloat(rawVal) || 0);
                if (window._manualMotoHours && window._manualMotoHours[mInputKey] === undefined) {
                    window._manualMotoHours[mInputKey] = dHours;
                }

                let dFuel = isIntegerHours ? Math.round(dHours * hourlyRate) : (dHours * hourlyRate);
                periodDailyFuels.push(dFuel);
                periodSpentSum += dFuel;
            }
            targetFuelToSpend = periodSpentSum;
        } else {
            if (!window._periodRandomSeeds[i] || window._periodRandomSeeds[i].length !== periodDays) {
                let seedWeights = [];
                let sumW = 0;
                for (let d = 0; d < periodDays; d++) {
                    let w = Math.random() * 0.6 + 0.7;
                    seedWeights.push(w);
                    sumW += w;
                }
                window._periodRandomSeeds[i] = seedWeights.map(w => w / sumW * periodDays);
            }

            let weights = window._periodRandomSeeds[i];
            let allocatedSum = 0;

            for (let d = 0; d < periodDays; d++) {
                if (d === periodDays - 1) {
                    let rest = targetFuelToSpend - allocatedSum;
                    let maxRest = hourlyRate * maxDailyHours;
                    if (rest > maxRest) rest = maxRest;
                    periodDailyFuels.push(isIntegerHours ? Math.round(rest) : (Math.round(rest * 10) / 10));
                } else {
                    let f = (targetFuelToSpend / periodDays) * weights[d];
                    let maxDayFuel = hourlyRate * maxDailyHours;
                    if (f > maxDayFuel) f = maxDayFuel;
                    
                    let rounded = isIntegerHours ? Math.round(f) : (Math.round(f * 10) / 10);
                    periodDailyFuels.push(rounded);
                    allocatedSum += rounded;
                }
            }

            let currentSum = periodDailyFuels.reduce((a, b) => a + b, 0);
            let diff = isIntegerHours ? Math.round(targetFuelToSpend - currentSum) : (Math.round((targetFuelToSpend - currentSum) * 10) / 10);
            if (diff !== 0 && periodDays > 0) {
                let adjusted = isIntegerHours ? Math.round(periodDailyFuels[periodDays - 1] + diff) : (Math.round((periodDailyFuels[periodDays - 1] + diff) * 10) / 10);
                periodDailyFuels[periodDays - 1] = Math.max(0, adjusted);
            }
        }

        let periodOil = baseOilNorm10Days > 0 ? (baseOilNorm10Days / 120) * (targetFuelToSpend / hourlyRate) : targetFuelToSpend * 0.025;

        for (let d = 0; d < periodDays; d++) {
            let dHours = periodDailyFuels[d] / hourlyRate;
            if (dHours > maxDailyHours && !isVerification) {
                dHours = maxDailyHours;
                periodDailyFuels[d] = isIntegerHours ? Math.round(dHours * hourlyRate) : (Math.round((dHours * hourlyRate) * 10) / 10);
            }
            if (isIntegerHours && !isVerification) {
                dHours = Math.round(dHours);
            }
            totalMotoHoursAll += dHours;
            let dOil = periodOil * (targetFuelToSpend > 0 ? (periodDailyFuels[d] / targetFuelToSpend) : 0);

            allDailyFuels.push(periodDailyFuels[d]);
            allDailyHours.push(dHours);
            allDailyOils.push(dOil);
            allDayColors.push(periodColors[(i - 1) % periodColors.length]);
            globalDayIndex++;
        }

        totalFuelAll += targetFuelToSpend;
        totalOilAll += periodOil;
    }

    let totalDaysCount = allDailyFuels.length;

    const oilTotalEl = document.getElementById('oil-total-val');
    const oilAvgEl = document.getElementById('oil-avg-val');
    if (oilTotalEl) oilTotalEl.textContent = (isIntegerHours ? Math.round(totalOilAll) : totalOilAll.toFixed(2)) + ' л';
    if (oilAvgEl) oilAvgEl.textContent = `Сер. розхід: ${(totalDaysCount > 0 ? (isIntegerHours ? Math.round(totalOilAll / totalDaysCount) : (totalOilAll / totalDaysCount).toFixed(2)) : 0)} л/д`;

    updateVariantBSummary();
    displayCalcResults(eq, totalMotoHoursAll, totalDaysCount, totalFuelAll, totalOilAll, allDailyFuels, allDailyHours, allDailyOils, allDayColors);
}

// ЗМІНА РУЧНИХ МОТО-ГОДИН У РЕЖИМІ ПЕРЕВІРКИ
function onManualMotoHourChange(periodIdx, dayIdx, val) {
    if (!window._manualMotoHours) window._manualMotoHours = {};
    let isIntegerHours = !!window._isIntegerHours;
    let rawNum = parseFloat(val) || 0;
    let parsedVal = isIntegerHours ? Math.round(rawNum) : parsedNumWithOneDec(rawNum);
    window._manualMotoHours[`${periodIdx}_${dayIdx}`] = parsedVal;
    saveAggCalcState();
    
    const eq = getSelectedEquipment();
    if (!eq) return;

    let hourlyRate = aggregateInventoryNumber(eq.consumption);
    if (hourlyRate <= 0) return;
    let baseOilNorm10Days = parseFloat(eq.oilNorm10Days) || 0;

    let totalMotoHoursAll = 0;
    let totalFuelAll = 0;
    let totalOilAll = 0;
    let globalDayCounter = 0;

    for (let i = 1; i <= 10; i++) {
        const daysInput = document.getElementById(`b-days-${i}`);
        let pDays = parseInt(daysInput?.value) || 0;
        if (pDays <= 0) continue;

        let periodSpentSum = 0;
        let periodDailyFuels = [];

        for (let d = 0; d < pDays; d++) {
            let mInputKey = `${i}_${d}`;
            let manualVal = (window._manualMotoHours && window._manualMotoHours[mInputKey] !== undefined) 
                ? window._manualMotoHours[mInputKey] 
                : 0;
            
            let dHours = isIntegerHours ? Math.round(parseFloat(manualVal) || 0) : (parseFloat(manualVal) || 0);
            let dFuel = isIntegerHours ? Math.round(dHours * hourlyRate) : (dHours * hourlyRate);
            periodDailyFuels.push(dFuel);
            periodSpentSum += dFuel;
        }

        let periodOil = baseOilNorm10Days > 0 ? (baseOilNorm10Days / 120) * (periodSpentSum / hourlyRate) : periodSpentSum * 0.025;
        totalOilAll += periodOil;
        totalFuelAll += periodSpentSum;

        for (let d = 0; d < pDays; d++) {
            let mInputKey = `${i}_${d}`;
            let dHours = window._manualMotoHours[mInputKey] || 0;
            totalMotoHoursAll += dHours;

            let adaptedFuel = isIntegerHours ? Math.round(dHours * hourlyRate) : (dHours * hourlyRate);
            let adaptedOil = periodOil * (periodSpentSum > 0 ? (periodDailyFuels[d] / periodSpentSum) : 0);

            const fuelCell = document.getElementById(`row-fuel-${i}-${d}`);
            const oilCell = document.getElementById(`row-oil-${i}-${d}`);
            if (fuelCell) fuelCell.textContent = (isIntegerHours ? Math.round(adaptedFuel) : adaptedFuel.toFixed(1)) + ' л';
            if (oilCell) oilCell.textContent = (isIntegerHours ? Math.round(adaptedOil) : adaptedOil.toFixed(2)) + ' л';

            globalDayCounter++;
        }
    }

    const topHoursEl = document.getElementById('top-total-hours');
    if (topHoursEl) topHoursEl.textContent = (isIntegerHours ? Math.round(totalMotoHoursAll) : totalMotoHoursAll.toFixed(1)) + ' год';

    const oilTotalEl = document.getElementById('oil-total-val');
    const oilAvgEl = document.getElementById('oil-avg-val');
    if (oilTotalEl) oilTotalEl.textContent = (isIntegerHours ? Math.round(totalOilAll) : totalOilAll.toFixed(2)) + ' л';
    if (oilAvgEl) oilAvgEl.textContent = `Сер. розхід: ${(globalDayCounter > 0 ? (isIntegerHours ? Math.round(totalOilAll / globalDayCounter) : (totalOilAll / globalDayCounter).toFixed(2)) : 0)} л/д`;

    const verifHoursEl = document.getElementById('verif-total-hours');
    const verifFuelEl = document.getElementById('verif-total-fuel');
    if (verifHoursEl) verifHoursEl.textContent = (isIntegerHours ? Math.round(totalMotoHoursAll) : totalMotoHoursAll.toFixed(1)) + ' год';
    if (verifFuelEl) verifFuelEl.textContent = (isIntegerHours ? Math.round(totalFuelAll) : totalFuelAll.toFixed(1)) + ' л';
}

function parsedNumWithOneDec(n) {
    return Math.round(n * 10) / 10;
}

// ВІДОБРАЖЕННЯ РЕЗУЛЬТАТІВ РОЗРАХУНКУ
function displayCalcResults(eq, totalMotoHours, daysCount, totalFuel, totalOil, dailyFuels, dailyHours, dailyOils, dayColors) {
    const box = document.getElementById('calc-details-box');
    if (!box) return;

    let isIntegerHours = !!window._isIntegerHours;
    let isVerification = !!window._isVerificationMode;
    let hourlyRate = aggregateInventoryNumber(eq.consumption);
    if (hourlyRate <= 0) return;

    const verifContainer = document.getElementById('verification-summary-container');
    if (verifContainer) {
        verifContainer.style.display = isVerification ? 'block' : 'none';
    }

    if (daysCount === 0) {
        box.innerHTML = `
            <div style="background: white; padding: 25px; border-radius: 6px; border: 1px solid #dcdcdc; text-align: center;">
                <p style="color: #7f8c8d; font-style: italic; margin: 0; font-size: 13px;">Введіть кількість днів та залишки палива у таблиці ліворуч для формування розкладу.</p>
            </div>
        `;
        const topHoursEl = document.getElementById('top-total-hours');
        const topDaysSubEl = document.getElementById('top-total-days-sub');
        if (topHoursEl) topHoursEl.textContent = isIntegerHours ? '0 год' : '0.0 год';
        if (topDaysSubEl) topDaysSubEl.textContent = '(0 дн)';
        return;
    }

    let displayTotalMotoHours = 0;
    let verificationTotalFuel = 0;
    let dailyTableRows = '';
    
    let globalDayCounter = 0;
    for (let i = 1; i <= 10; i++) {
        const daysInput = document.getElementById(`b-days-${i}`);
        let pDays = parseInt(daysInput?.value) || 0;
        if (pDays <= 0) continue;

        for (let d = 0; d < pDays; d++) {
            let dayIdx = globalDayCounter;
            let rowBg = dayColors && dayColors[dayIdx] ? dayColors[dayIdx] : '#fff';
            
            let hVal = dailyHours[dayIdx] || 0;
            let mInputKey = `${i}_${d}`;

            let motoCellContent = '';
            if (isVerification) {
                let rawVal = (window._manualMotoHours && window._manualMotoHours[mInputKey] !== undefined) 
                    ? window._manualMotoHours[mInputKey] 
                    : (isIntegerHours ? Math.round(hVal) : parseFloat(hVal.toFixed(1)));
                
                let currentVal = isIntegerHours ? Math.round(parseFloat(rawVal) || 0) : (parseFloat(Number(rawVal).toFixed(1)) || 0);

                if (window._manualMotoHours[mInputKey] === undefined || (isIntegerHours && window._manualMotoHours[mInputKey] !== currentVal)) {
                    window._manualMotoHours[mInputKey] = currentVal;
                }

                let stepVal = isIntegerHours ? "1" : "0.1";
                motoCellContent = `<input type="number" step="${stepVal}" min="0" value="${currentVal}" oninput="onManualMotoHourChange(${i}, ${d}, this.value)" style="width: 70px; border: 1px solid #bdc3c7; border-radius: 3px; text-align: center; font-size: 11px; padding: 2px;"> год`;
            } else {
                let formattedH = isIntegerHours ? Math.round(hVal) : parseFloat(hVal.toFixed(1));
                motoCellContent = `${formattedH} год`;
            }

            let effectiveH = isVerification 
                ? (isIntegerHours ? Math.round(parseFloat(window._manualMotoHours?.[mInputKey] !== undefined ? window._manualMotoHours[mInputKey] : hVal) || 0) : (parseFloat(window._manualMotoHours?.[mInputKey] !== undefined ? window._manualMotoHours[mInputKey] : hVal) || 0))
                : (isIntegerHours ? Math.round(hVal) : hVal);

            displayTotalMotoHours += parseFloat(effectiveH) || 0;

            let adaptedFuel = isIntegerHours ? Math.round(effectiveH * hourlyRate) : (effectiveH * hourlyRate);
            verificationTotalFuel += adaptedFuel;

            let rawOil = dailyOils[dayIdx] || 0;
            let rawFuel = dailyFuels[dayIdx] || 0;
            let adaptedOil = rawOil * (rawFuel > 0 ? (adaptedFuel / rawFuel) : 1);
            
            let fuelDisplay = isIntegerHours ? `${Math.round(adaptedFuel)} л` : `${adaptedFuel.toFixed(1)} л`;
            let oilDisplay = isIntegerHours ? `${Math.round(adaptedOil)} л` : `${adaptedOil.toFixed(2)} л`;

            dailyTableRows += '<tr style="background-color: ' + rowBg + ';">' +
                '<td style="text-align: center; padding: 5px; border-bottom: 1px solid #e0e0e0;"><strong>День ' + (dayIdx + 1) + '</strong></td>' +
                '<td style="text-align: center; padding: 5px; border-bottom: 1px solid #e0e0e0;">' + motoCellContent + '</td>' +
                '<td id="row-fuel-' + i + '-' + d + '" style="text-align: center; padding: 5px; border-bottom: 1px solid #e0e0e0; color: #c0392b; font-weight: bold;">' + fuelDisplay + '</td>' +
                '<td id="row-oil-' + i + '-' + d + '" style="text-align: center; padding: 5px; border-bottom: 1px solid #e0e0e0; color: #2980b9;">' + oilDisplay + '</td>' +
                '</tr>';

            globalDayCounter++;
        }
    }

    const topHoursEl = document.getElementById('top-total-hours');
    const topDaysSubEl = document.getElementById('top-total-days-sub');
    if (topHoursEl) topHoursEl.textContent = (isIntegerHours ? Math.round(displayTotalMotoHours) : displayTotalMotoHours.toFixed(1)) + ' год';
    if (topDaysSubEl) topDaysSubEl.textContent = `(${daysCount} дн)`;

    const verifHoursEl = document.getElementById('verif-total-hours');
    const verifFuelEl = document.getElementById('verif-total-fuel');
    if (verifHoursEl) verifHoursEl.textContent = (isIntegerHours ? Math.round(displayTotalMotoHours) : displayTotalMotoHours.toFixed(1)) + ' год';
    if (verifFuelEl) verifFuelEl.textContent = (isIntegerHours ? Math.round(verificationTotalFuel) : verificationTotalFuel.toFixed(1)) + ' л';

    box.innerHTML = `
        <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #dcdcdc;">
            <!-- ШАПКА ТАБЛИЦІ З ПЕРЕМИКАЧАМИ ТА КНОПКОЮ ПЕРЕРАХУНКУ -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <h4 style="color: #2c3e50; margin: 0; font-size: 14px;">Поденний розклад витрати (${eq.model || 'Агрегат'}):</h4>
                    ${!isVerification ? `
                        <button onclick="reseedChaosDistribution()" title="Згенерувати новий випадковий розподіл" style="background: #eaf2f8; border: 1px solid #2980b9; color: #2980b9; font-size: 11px; padding: 2px 8px; border-radius: 3px; cursor: pointer; font-weight: bold;">
                            🎲 Перемішати
                        </button>
                    ` : ''}
                </div>
                
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <!-- Перемикач Режиму: Підрахунок / Перевірка -->
                    <div style="display: flex; align-items: center; gap: 8px; background: #f4f6f7; padding: 4px 10px; border-radius: 4px; border: 1px solid #bdc3c7;">
                        <span style="font-size: 11px; font-weight: bold; color: #2c3e50;">Режим:</span>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span onclick="setAggCalcMode(false)" style="font-size: 11px; cursor: pointer; color: ${!isVerification ? '#2e7d32; font-weight: bold;' : '#7f8c8d;'}">Підрахунок</span>
                            <div onclick="toggleAggCalcMode()" style="position: relative; display: inline-block; width: 34px; height: 18px; margin: 0; cursor: pointer; user-select: none;">
                                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: ${isVerification ? '#c0392b' : '#bdc3c7'}; transition: .3s; border-radius: 18px;"></div>
                                <div style="position: absolute; height: 14px; width: 14px; left: ${isVerification ? '18px' : '2px'}; bottom: 2px; background-color: white; transition: .3s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>
                            </div>
                            <span onclick="setAggCalcMode(true)" style="font-size: 11px; cursor: pointer; color: ${isVerification ? '#c0392b; font-weight: bold;' : '#7f8c8d;'}">Перевірка</span>
                        </div>
                    </div>

                    <!-- Перемикач Мото-годин: Десяткові / Цілі -->
                    <div style="display: flex; align-items: center; gap: 8px; background: #f4f6f7; padding: 4px 10px; border-radius: 4px; border: 1px solid #bdc3c7;">
                        <span style="font-size: 11px; font-weight: bold; color: #2c3e50;">Формат:</span>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span onclick="setAggHoursMode(false)" style="font-size: 11px; cursor: pointer; color: ${!isIntegerHours ? '#2e7d32; font-weight: bold;' : '#7f8c8d;'}">Десяткові (0.0)</span>
                            <div onclick="toggleAggHoursMode()" style="position: relative; display: inline-block; width: 34px; height: 18px; margin: 0; cursor: pointer; user-select: none;">
                                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: ${isIntegerHours ? '#2e7d32' : '#bdc3c7'}; transition: .3s; border-radius: 18px;"></div>
                                <div style="position: absolute; height: 14px; width: 14px; left: ${isIntegerHours ? '18px' : '2px'}; bottom: 2px; background-color: white; transition: .3s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>
                            </div>
                            <span onclick="setAggHoursMode(true)" style="font-size: 11px; cursor: pointer; color: ${isIntegerHours ? '#2e7d32; font-weight: bold;' : '#7f8c8d;'}">Цілі (0)</span>
                        </div>
                    </div>
                </div>
            </div>

            <div style="max-height: 300px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background: #2e7d32; color: white;">
                            <th style="padding: 6px; text-align: center;">Період</th>
                            <th style="padding: 6px; text-align: center;">Мото-години</th>
                            <th style="padding: 6px; text-align: center;">Витрата палива</th>
                            <th style="padding: 6px; text-align: center;">Витрата мастила</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dailyTableRows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ДРУК ЗВІТУ
function printAggregatesReport() {
    const box = document.getElementById('calc-details-box');
    const eq = getSelectedEquipment();

    if (!box || !eq || !box.innerHTML.trim() || box.innerHTML.includes('Оберіть обладнання') || box.innerHTML.includes('Введіть кількість днів')) {
        alert('Будь ласка, оберіть агрегат та заповніть розрахунок перед друком.');
        return;
    }

    const headerText = document.getElementById('agg-header-text');
    const eqName = headerText ? headerText.textContent : 'Агрегат';

    let summaryBoxHtml = document.getElementById('variant-b-summary-box')?.outerHTML || '';
    let printContent = box.innerHTML.replace(/max-height:\s*300px;\s*overflow-y:\s*auto;/g, 'max-height: none; overflow: visible;');
    
    // Приховуємо панель перемикачів і кнопки перемішування при друку
    printContent = printContent.replace(/<div style="display: flex; align-items: center; gap: 12px;[\s\S]*?<\/div>\s*<\/div>/, '</div>');
    printContent = printContent.replace(/<button[\s\S]*?<\/button>/g, '');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Не вдалося відкрити вікно друку. Дозвольте спливаючі вікна для цього сайту.');
        return;
    }

    printWindow.document.write(`
        <html>
            <head>
                <title>Розрахунок витрати палива та мастил — ${eqName}</title>
                <style>
                    @page { size: portrait; margin: 6mm 10mm; }
                    body { font-family: Arial, sans-serif; padding: 5px; color: #333; margin: 0; font-size: 11px; }
                    h2 { text-align: center; color: #2e7d32; margin: 0 0 8px 0; font-size: 16px; }
                    .subtitle { text-align: center; color: #555; margin-bottom: 10px; font-size: 11px; }
                    
                    div[style*="grid-template-columns"] {
                        gap: 6px !important;
                        margin-bottom: 10px !important;
                    }
                    div[style*="background: white; padding: 12px"] {
                        padding: 6px !important;
                    }

                    h4 { font-size: 12px !important; margin-bottom: 0 !important; }

                    table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 11px; }
                    tr { page-break-inside: avoid; }
                    th, td { border: 1px solid #bdc3c7; padding: 3px 5px !important; text-align: center; }
                    th { background: #2e7d32 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                </style>
            </head>
            <body>
                <h2>Розрахунок витрати палива та мастил агрегатів</h2>
                <div class="subtitle"><strong>Обладнання:</strong> ${eqName} | <strong>Розхід:</strong> ${eq.consumption} л/год</div>
                ${summaryBoxHtml}
                ${printContent}
                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}
