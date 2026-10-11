// ==========================================
// МОДУЛЬ: УПРАВЛІННЯ ДОКУМЕНТАМИ ТА КОНСТРУКТОР А4 (documents.js)
// + Автоматичне відновлення кнопки "+ Додати автомобіль" (Розробник та Адмін)
// + Видалення "Штабні автомобілі" зі списку категорій
// + Розділення формул "Вантажні автомобілі" та "Автомобілі з AdBlue"
// ==========================================

const DOCS_STORAGE_KEY = 'saved_documents_v2';
const DOCS_IDB_NAME = 'DocumentsFilesDB_v1';
const DOCS_IDB_STORE = 'files';

let currentEditingDocId = null;
let savedSelectionRange = null;
let activeEditableBlockId = 'doc-ed-body-text';
let trackedAppRole = null;

// Актуальний перелік категорій (БЕЗ "Штабні автомобілі")
const VALID_VEHICLE_CATEGORIES = [
    'Легкові автомобілі',
    'Вантажні автомобілі',
    'Позашляховики',
    'Мікроавтобуси',
    'Автомобілі з AdBlue',
    'Автомобілі з милями',
    'Спецтехніка',
    'Мотоцикли',
    'Квадроцикли'
];

// Повний перелік стандартних шрифтів Microsoft Word
const WORD_FONTS_LIST = [
    { label: 'Times New Roman (Стандарт Word)', value: "'Times New Roman', Times, serif" },
    { label: 'Calibri (Стандарт Word)', value: "Calibri, 'Segoe UI', sans-serif" },
    { label: 'Calibri Light', value: "'Calibri Light', Calibri, sans-serif" },
    { label: 'Arial', value: "Arial, Helvetica, sans-serif" },
    { label: 'Arial Narrow', value: "'Arial Narrow', Arial, sans-serif" },
    { label: 'Arial Black', value: "'Arial Black', Gadget, sans-serif" },
    { label: 'Cambria', value: "Cambria, Georgia, serif" },
    { label: 'Georgia', value: "Georgia, serif" },
    { label: 'Verdana', value: "Verdana, Geneva, sans-serif" },
    { label: 'Tahoma', value: "Tahoma, Geneva, sans-serif" },
    { label: 'Trebuchet MS', value: "'Trebuchet MS', Helvetica, sans-serif" },
    { label: 'Segoe UI', value: "'Segoe UI', Tahoma, Geneva, sans-serif" },
    { label: 'Garamond', value: "Garamond, 'Times New Roman', serif" },
    { label: 'Book Antiqua', value: "'Book Antiqua', Palatino, serif" },
    { label: 'Palatino Linotype', value: "'Palatino Linotype', 'Book Antiqua', Palatino, serif" },
    { label: 'Bookman Old Style', value: "'Bookman Old Style', serif" },
    { label: 'Century Gothic', value: "'Century Gothic', AppleGothic, sans-serif" },
    { label: 'Franklin Gothic Medium', value: "'Franklin Gothic Medium', Arial, sans-serif" },
    { label: 'Candara', value: "Candara, Calibri, sans-serif" },
    { label: 'Constantia', value: "Constantia, Georgia, serif" },
    { label: 'Corbel', value: "Corbel, Calibri, sans-serif" },
    { label: 'Sylfaen', value: "Sylfaen, 'Times New Roman', serif" },
    { label: 'Courier New', value: "'Courier New', Courier, monospace" },
    { label: 'Consolas', value: "Consolas, 'Courier New', monospace" },
    { label: 'Lucida Console', value: "'Lucida Console', Monaco, monospace" },
    { label: 'Lucida Sans Unicode', value: "'Lucida Sans Unicode', 'Lucida Grande', sans-serif" },
    { label: 'Microsoft Sans Serif', value: "'Microsoft Sans Serif', Arial, sans-serif" },
    { label: 'Impact', value: "Impact, Charcoal, sans-serif" },
    { label: 'Comic Sans MS', value: "'Comic Sans MS', cursive, sans-serif" },
    { label: 'Monotype Corsiva', value: "'Monotype Corsiva', 'Apple Chancery', cursive" },
    { label: 'Roboto', value: "Roboto, Arial, sans-serif" },
    { label: 'Open Sans', value: "'Open Sans', Arial, sans-serif" },
    { label: 'Montserrat', value: "Montserrat, Arial, sans-serif" }
];

let docLayoutState = getDefaultLayoutState();

function getDefaultLayoutState() {
    return {
        leftHeader: {
            text: 'Міністерство оборони України\nВійськова частина А0000',
            html: '',
            x: 0,
            y: 0,
            rotate: 0,
            width: 240,
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: 12,
            lineHeight: 1.35,
            align: 'left',
            bold: false,
            italic: false,
            underline: false
        },
        rightHeader: {
            text: 'ЗАТВЕРДЖУЮ\nКомандир військової частини\n________________ Ім\'я ПРІЗВИЩЕ\n"___" ____________ 2026 р.',
            html: '',
            x: 0,
            y: 0,
            rotate: 0,
            width: 250,
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: 12,
            lineHeight: 1.35,
            align: 'right',
            bold: false,
            italic: false,
            underline: false
        },
        docTitle: {
            text: 'НАКАЗ / РАПОРТ / ДОВІДКА',
            html: '',
            x: 0,
            y: 0,
            rotate: 0,
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: 16,
            lineHeight: 1.35,
            align: 'center',
            bold: true,
            italic: false,
            underline: false
        },
        bodyStyle: {
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: 14,
            lineHeight: 1.5,
            align: 'justify',
            bold: false,
            italic: false,
            underline: false
        },
        signers: {
            x: 0,
            y: 0,
            rotate: 0,
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: 14,
            lineHeight: 1.35,
            align: 'left',
            bold: true,
            italic: false,
            underline: false,
            rows: [
                { role: 'Командир підрозділу', name: 'Ім\'я ПРІЗВИЩЕ', roleHtml: '', nameHtml: '' }
            ]
        },
        signature: {
            dataUrl: '',
            originalDataUrl: '',
            x: 260,
            y: 420,
            width: 160,
            rotate: 0,
            colorMode: 'original',
            threshold: 215
        }
    };
}

// ==========================================
// ОЧИЩЕННЯ КАТЕГОРІЙ ("ШТАБНІ АВТОМОБІЛІ") ТА ВІДОКРЕМЛЕННЯ ФОРМУЛ ADBLUE ВІД "ВАНТАЖНІ АВТОМОБІЛІ"
// ==========================================

function isAdBlueTerm(str) {
    const s = String(str || '').toLowerCase();
    return s.includes('adblue') || s.includes('адблю') || s.includes('адеблю') || s.includes('сечовин');
}

function cleanCargoObjectFromAdBlue(obj) {
    if (!obj || typeof obj !== 'object') return false;
    let changed = false;

    if (Array.isArray(obj)) {
        for (let i = obj.length - 1; i >= 0; i--) {
            const item = obj[i];
            const itemStr = typeof item === 'string' ? item : JSON.stringify(item || '');
            if (isAdBlueTerm(itemStr)) {
                obj.splice(i, 1);
                changed = true;
            }
        }
        return changed;
    }

    for (const key of Object.keys(obj)) {
        if (isAdBlueTerm(key)) {
            if (typeof obj[key] === 'boolean') {
                if (obj[key] !== false) {
                    obj[key] = false;
                    changed = true;
                }
            } else {
                delete obj[key];
                changed = true;
            }
            continue;
        }

        const val = obj[key];
        if (typeof val === 'string' && isAdBlueTerm(val)) {
            // Якщо у текстовій формулі для "Вантажні автомобілі" дописано AdBlue — прибираємо рядки з AdBlue
            const cleanedLines = val
                .split('\n')
                .filter(line => !isAdBlueTerm(line))
                .join('\n');
            if (cleanedLines !== val) {
                obj[key] = cleanedLines;
                changed = true;
            }
        } else if (Array.isArray(val)) {
            if (cleanCargoObjectFromAdBlue(val)) changed = true;
        } else if (val && typeof val === 'object') {
            if (cleanCargoObjectFromAdBlue(val)) changed = true;
        }
    }
    return changed;
}

function sanitizeCategoriesAndFormulasInStorage() {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || key === DOCS_STORAGE_KEY) continue;
            const raw = localStorage.getItem(key);
            if (!raw || (!raw.startsWith('{') && !raw.startsWith('['))) continue;

            try {
                const parsed = JSON.parse(raw);
                let modified = false;

                function walkAndFix(node) {
                    if (!node || typeof node !== 'object') return;

                    if (Array.isArray(node)) {
                        for (let j = node.length - 1; j >= 0; j--) {
                            const el = node[j];
                            if (typeof el === 'string' && el.toLowerCase().includes('штабн')) {
                                node.splice(j, 1);
                                modified = true;
                            } else if (el && typeof el === 'object') {
                                const nameField = String(el.name || el.category || el.title || el.label || '').toLowerCase();
                                if (nameField.includes('штабн') && !el.plate && !el.number && !el.vin) {
                                    node.splice(j, 1);
                                    modified = true;
                                } else {
                                    if (el.category && String(el.category).toLowerCase().includes('штабн')) {
                                        el.category = 'Легкові автомобілі';
                                        modified = true;
                                    }
                                    // Якщо це конфігурація або авто категорії "Вантажні автомобілі" (НЕ "Автомобілі з AdBlue")
                                    const catName = String(el.category || el.name || el.title || '').trim();
                                    if (catName === 'Вантажні автомобілі' || (catName === 'Вантажний' && el.category !== 'Автомобілі з AdBlue')) {
                                        if (el.hasAdBlue === true) { el.hasAdBlue = false; modified = true; }
                                        if (el.useAdBlue === true) { el.useAdBlue = false; modified = true; }
                                        if (el.adBlue === true) { el.adBlue = false; modified = true; }
                                        if (el.formulas && cleanCargoObjectFromAdBlue(el.formulas)) modified = true;
                                        if (el.fields && cleanCargoObjectFromAdBlue(el.fields)) modified = true;
                                    }
                                    walkAndFix(el);
                                }
                            }
                        }
                        return;
                    }

                    for (const k of Object.keys(node)) {
                        if (k.toLowerCase().includes('штабн')) {
                            delete node[k];
                            modified = true;
                            continue;
                        }
                        // Якщо ключ — це категорія "Вантажні автомобілі"
                        if (k === 'Вантажні автомобілі' || k === 'Вантажні') {
                            if (cleanCargoObjectFromAdBlue(node[k])) {
                                modified = true;
                            }
                        } else {
                            walkAndFix(node[k]);
                        }
                    }
                }

                walkAndFix(parsed);

                if (modified) {
                    localStorage.setItem(key, JSON.stringify(parsed));
                }
            } catch (e) {}
        }
    } catch (err) {}
}

function syncCategorySelectsAndAdBlueDOM() {
    // 1. Прибираємо "Штабні автомобілі" з усіх <select> на сторінці
    const selects = Array.from(document.querySelectorAll('select'));
    let activeCardCategory = null;

    selects.forEach(sel => {
        if (sel.closest('#documents-main-section')) return;

        const options = Array.from(sel.options);
        const isCategorySelect = options.some(o =>
            o.text.includes('Вантажні автомобілі') ||
            o.text.includes('Автомобілі з AdBlue') ||
            o.text.includes('Позашляховики')
        );

        // Видаляємо будь-який option зі словом "Штабні"
        options.forEach(opt => {
            const t = (opt.textContent || '').toLowerCase();
            const v = (opt.value || '').toLowerCase();
            if (t.includes('штабн') || v.includes('штабн')) {
                if (sel.value === opt.value) {
                    sel.value = 'Легкові автомобілі';
                }
                opt.remove();
            }
        });

        if (isCategorySelect) {
            // Перевіряємо, чи це селект у "Повна технічна характеристика"
            const rowText = (sel.closest('tr')?.textContent || sel.parentElement?.textContent || '').toLowerCase();
            if (rowText.includes('категорія') || !activeCardCategory) {
                activeCardCategory = (sel.options[sel.selectedIndex]?.text || sel.value || '').trim();
            }
        }
    });

    // 2. Якщо ми у вкладці "Картка авто" і вибрана категорія НЕ "Автомобілі з AdBlue" (наприклад, вибрано "Вантажні автомобілі"),
    // ховаємо випадково додані поля/рядки/формули AdBlue у розрахунках картки авто
    if (activeCardCategory) {
        const isExplicitAdBlueCategory = activeCardCategory === 'Автомобілі з AdBlue';

        // Шукаємо рядки таблиць або блоки формул у Картці авто, де згадується AdBlue
        const allRowsAndBlocks = Array.from(document.querySelectorAll('tr, .formula-row, .calc-row, .field-row, .form-group, .param-row'));
        allRowsAndBlocks.forEach(el => {
            if (el.closest('#documents-main-section')) return;
            // Не чіпаємо сам селект вибору категорії
            if (el.querySelector('select')) return;

            const txt = (el.textContent || '').trim();
            if (isAdBlueTerm(txt)) {
                // Перевіряємо, що це вузький рядок конкретного параметра/формули AdBlue, а не весь контейнер сторінки
                if (txt.length < 220) {
                    if (isExplicitAdBlueCategory) {
                        if (el.dataset.hiddenByAdBlueFix === 'true') {
                            el.style.display = '';
                            delete el.dataset.hiddenByAdBlueFix;
                        }
                    } else {
                        if (window.getComputedStyle(el).display !== 'none') {
                            el.dataset.hiddenByAdBlueFix = 'true';
                            el.style.display = 'none';
                        }
                    }
                }
            }
        });
    }
}

// ==========================================
// ВИЗНАЧЕННЯ АКТИВНОЇ РОЛІ ТА ВІДНОВЛЕННЯ КНОПКИ "+ ДОДАТИ АВТОМОБІЛЬ"
// ==========================================

function detectActiveUserRole() {
    const allButtons = Array.from(document.querySelectorAll('button, span, div, a'));
    const roleMap = [
        { label: 'розробник', code: 'dev' },
        { label: 'адмін', code: 'admin' },
        { label: 'модератор', code: 'moderator' },
        { label: 'юзер', code: 'user' }
    ];

    for (const r of roleMap) {
        const btn = allButtons.find(el => {
            if (el.children.length > 0) return false;
            const txt = (el.textContent || '').trim().toLowerCase();
            return txt === r.label;
        });
        if (btn) {
            const cls = (btn.className || '').toLowerCase();
            const cs = window.getComputedStyle(btn);
            const bg = cs.backgroundColor || '';
            const isColoredBg = bg &&
                bg !== 'rgba(0, 0, 0, 0)' &&
                bg !== 'transparent' &&
                bg !== 'rgb(44, 53, 69)' &&
                bg !== 'rgb(30, 41, 59)';
            if (cls.includes('active') || cls.includes('selected') || isColoredBg) {
                trackedAppRole = r.code;
                return r.code;
            }
        }
    }

    if (trackedAppRole) return trackedAppRole;

    const stored = String(
        window.currentRole ||
        localStorage.getItem('currentRole') ||
        localStorage.getItem('userRole') ||
        localStorage.getItem('role') ||
        ''
    ).toLowerCase().trim();

    if (stored.includes('dev') || stored.includes('розробник')) return 'dev';
    if (stored.includes('admin') || stored.includes('адмін')) return 'admin';
    if (stored.includes('mod') || stored.includes('модератор')) return 'moderator';
    if (stored.includes('user') || stored.includes('юзер')) return 'user';

    const devBtn = document.getElementById('nav-btn-dev-panel');
    if (devBtn && window.getComputedStyle(devBtn).display !== 'none') {
        return 'dev';
    }

    return 'user';
}

function getCurrentUserRoleForDocs() {
    return detectActiveUserRole();
}

function findRegistryTableElement() {
    const tables = Array.from(document.querySelectorAll('table'));
    for (const tbl of tables) {
        if (tbl.closest('#documents-main-section')) continue;
        const headerText = (tbl.textContent || '').toLowerCase();
        if (
            (headerText.includes('тип авто') && headerText.includes('модель')) ||
            (headerText.includes('підрозділ') && headerText.includes('він код'))
        ) {
            return tbl;
        }
    }
    return null;
}

function findExistingAddCarButton() {
    const byId = document.getElementById('add-car-btn') ||
        document.getElementById('btn-add-car') ||
        document.getElementById('addCarBtn') ||
        document.getElementById('add-vehicle-btn') ||
        document.getElementById('restored-add-car-btn');
    if (byId) return byId;

    const buttons = Array.from(document.querySelectorAll('button, a.btn, input[type="button"]'));
    for (const btn of buttons) {
        if (btn.closest('#documents-main-section')) continue;
        const txt = (btn.textContent || btn.value || '').trim().toLowerCase();
        const onclickAttr = (btn.getAttribute('onclick') || '').toLowerCase();
        if (
            txt.includes('додати автомобіль') ||
            txt.includes('додати авто') ||
            onclickAttr.includes('addcar') ||
            onclickAttr.includes('addvehicle')
        ) {
            return btn;
        }
    }
    return null;
}

function triggerAddCarAction() {
    const fnNames = ['addCar', 'addVehicle', 'addNewCar', 'addNewVehicle', 'addCarRow', 'openAddCarModal', 'showAddCarModal'];
    for (const name of fnNames) {
        if (typeof window[name] === 'function') {
            window[name]();
            return;
        }
    }

    const modal = document.getElementById('add-car-modal') ||
        document.getElementById('addCarModal') ||
        document.getElementById('car-modal');
    if (modal) {
        modal.style.display = 'flex';
        return;
    }

    const table = findRegistryTableElement();
    if (!table) return;
    const tbody = table.querySelector('tbody') || table;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const nextIndex = rows.length + 1;

    const arrayNames = ['cars', 'vehicles', 'carsData', 'carList', 'registryData'];
    for (const arrName of arrayNames) {
        if (Array.isArray(window[arrName])) {
            window[arrName].push({
                id: Date.now(),
                type: 'Легковий',
                category: 'Легкові автомобілі',
                number: 'КІ 000 G',
                plate: 'КІ 000 G',
                model: 'Новий автомобіль',
                unit: 'РМТЗ',
                department: 'РМТЗ',
                fuelRate: '10 л',
                consumption: '10 л',
                fuel: 'ДП',
                fuelType: 'ДП',
                note: '',
                vin: '—',
                year: '2024',
                transmission: 'механіка',
                gearbox: 'механіка',
                tank: '60 л',
                drive: 'повний',
                weight: '2000 кг',
                maxWeight: '2800 кг',
                gears: '6',
                volume: '2000 см³',
                engineVolume: '2000 см³',
                power: '110',
                kw: '110',
                engineNumber: '—',
                driver: 'Водій'
            });
            const renderFns = ['renderTable', 'renderCars', 'renderRegistry', 'renderVehicles', 'updateTable', 'initTable'];
            for (const rFn of renderFns) {
                if (typeof window[rFn] === 'function') {
                    window[rFn]();
                    return;
                }
            }
        }
    }

    if (rows.length > 0) {
        const lastRow = rows[rows.length - 1];
        const newRow = lastRow.cloneNode(true);
        const cells = Array.from(newRow.querySelectorAll('td'));
        if (cells[0]) cells[0].textContent = String(nextIndex);
        if (cells[2] && !cells[2].querySelector('input, select')) cells[2].textContent = 'КІ 000 G';
        if (cells[3] && !cells[3].querySelector('input, select')) cells[3].textContent = 'Новий автомобіль';
        cells.forEach((td, idx) => {
            if (idx === 0) return;
            const inp = td.querySelector('input');
            if (inp) inp.value = idx === 19 ? 'Водій' : '';
        });
        tbody.appendChild(newRow);
        newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function syncAddCarButtonVisibility() {
    const role = detectActiveUserRole();
    const canSeeAddCar = (role === 'dev' || role === 'admin');

    let addCarBtn = findExistingAddCarButton();
    const registryTable = findRegistryTableElement();

    if (!addCarBtn && registryTable) {
        const scrollWrapper = registryTable.parentElement;
        const registryContainer = (scrollWrapper && scrollWrapper.parentElement) ? scrollWrapper.parentElement : registryTable.parentElement;

        if (registryContainer) {
            const btnWrap = document.createElement('div');
            btnWrap.id = 'restored-add-car-wrap';
            btnWrap.style.cssText = 'margin-top: 14px; margin-bottom: 10px; display: flex; align-items: center; justify-content: flex-start;';

            addCarBtn = document.createElement('button');
            addCarBtn.id = 'restored-add-car-btn';
            addCarBtn.type = 'button';
            addCarBtn.innerHTML = '+ Додати автомобіль';
            addCarBtn.style.cssText = [
                'background: #22a559',
                'color: #ffffff',
                'border: none',
                'border-radius: 6px',
                'padding: 10px 20px',
                'font-size: 14px',
                'font-weight: 700',
                'cursor: pointer',
                'box-shadow: 0 2px 6px rgba(34, 165, 89, 0.25)',
                'transition: background 0.15s ease'
            ].join(';');

            addCarBtn.onmouseenter = () => { addCarBtn.style.background = '#16a34a'; };
            addCarBtn.onmouseleave = () => { addCarBtn.style.background = '#22a559'; };
            addCarBtn.onclick = () => triggerAddCarAction();

            btnWrap.appendChild(addCarBtn);

            if (scrollWrapper && scrollWrapper.nextSibling) {
                registryContainer.insertBefore(btnWrap, scrollWrapper.nextSibling);
            } else {
                registryContainer.appendChild(btnWrap);
            }
        }
    }

    if (addCarBtn) {
        const wrap = document.getElementById('restored-add-car-wrap');
        if (canSeeAddCar) {
            addCarBtn.style.setProperty('display', 'inline-flex', 'important');
            addCarBtn.style.setProperty('align-items', 'center', 'important');
            addCarBtn.style.setProperty('gap', '6px', 'important');
            addCarBtn.style.removeProperty('visibility');
            addCarBtn.hidden = false;
            if (wrap) wrap.style.setProperty('display', 'flex', 'important');
            if (addCarBtn.parentElement && addCarBtn.parentElement !== document.body) {
                const parentComp = window.getComputedStyle(addCarBtn.parentElement);
                if (parentComp.display === 'none' && !addCarBtn.parentElement.classList.contains('tab-content')) {
                    addCarBtn.parentElement.style.display = 'block';
                }
            }
        } else {
            addCarBtn.style.setProperty('display', 'none', 'important');
            if (wrap) wrap.style.setProperty('display', 'none', 'important');
        }
    }
}

// ==========================================
// БАЗА ДАНИХ INDEXEDDB ДЛЯ ФАЙЛІВ БУДЬ-ЯКОГО РОЗМІРУ
// ==========================================

function openDocsIndexedDB() {
    return new Promise((resolve) => {
        if (!window.indexedDB) {
            resolve(null);
            return;
        }
        const req = window.indexedDB.open(DOCS_IDB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(DOCS_IDB_STORE)) {
                db.createObjectStore(DOCS_IDB_STORE, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
}

async function saveDocBinaryToIDB(docId, dataObj) {
    const db = await openDocsIndexedDB();
    if (!db) return false;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(DOCS_IDB_STORE, 'readwrite');
            const store = tx.objectStore(DOCS_IDB_STORE);
            store.put({ id: docId, ...dataObj });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        } catch (err) {
            resolve(false);
        }
    });
}

async function getDocBinaryFromIDB(docId) {
    const db = await openDocsIndexedDB();
    if (!db) return null;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(DOCS_IDB_STORE, 'readonly');
            const store = tx.objectStore(DOCS_IDB_STORE);
            const req = store.get(docId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        } catch (err) {
            resolve(null);
        }
    });
}

async function deleteDocBinaryFromIDB(docId) {
    const db = await openDocsIndexedDB();
    if (!db) return;
    try {
        const tx = db.transaction(DOCS_IDB_STORE, 'readwrite');
        tx.objectStore(DOCS_IDB_STORE).delete(docId);
    } catch (e) {}
}

function getSavedDocumentsList() {
    try {
        const raw = localStorage.getItem(DOCS_STORAGE_KEY);
        if (!raw) return getInitialSampleDocuments();
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : getInitialSampleDocuments();
    } catch (e) {
        return getInitialSampleDocuments();
    }
}

function saveDocumentsList(list) {
    try {
        localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(list));
        return true;
    } catch (err) {
        try {
            const slimList = list.map(d => ({
                ...d,
                fileDataUrl: ''
            }));
            localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(slimList));
            return true;
        } catch (e2) {
            alert('Перевищено ліміт пам\'яті браузера. Видаліть старі документи.');
            return false;
        }
    }
}

function getInitialSampleDocuments() {
    const sample = [
        {
            id: 'doc_sample_1',
            name: 'Рапорт на отримання ПММ (Зразок)',
            type: 'Шаблон А4',
            originalFormat: 'a4',
            date: new Date().toLocaleDateString('uk-UA'),
            content: 'Прошу Вашого клопотання перед вищим командуванням щодо виділення пально-мастильних матеріалів для забезпечення виконання бойових завдань підрозділом у повному обсязі.\n\nРозрахунок потреби додається.',
            bodyHtml: '',
            layout: getDefaultLayoutState()
        }
    ];
    localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(sample));
    return sample;
}

// ==========================================
// РОЗПАКОВКА ТА КОНВЕРТАЦІЯ ФАЙЛІВ WORD (.DOCX) У ЧИСТИЙ ФОРМАТОВАНИЙ HTML
// ==========================================

function normalizeWordFontName(rawFont) {
    if (!rawFont) return "'Times New Roman', Times, serif";
    const cleaned = String(rawFont).replace(/['"]/g, '').trim();
    const lower = cleaned.toLowerCase();

    if (lower.includes('times')) return "'Times New Roman', Times, serif";
    if (lower.includes('calibri light')) return "'Calibri Light', Calibri, sans-serif";
    if (lower.includes('calibri') || lower.includes('+mn') || lower.includes('body')) return "Calibri, 'Segoe UI', sans-serif";
    if (lower.includes('cambria') || lower.includes('+mj') || lower.includes('heading')) return "Cambria, Georgia, serif";
    if (lower.includes('arial black')) return "'Arial Black', Gadget, sans-serif";
    if (lower.includes('arial narrow')) return "'Arial Narrow', Arial, sans-serif";
    if (lower.includes('arial') || lower.includes('helvetica')) return "Arial, Helvetica, sans-serif";
    if (lower.includes('georgia')) return "Georgia, serif";
    if (lower.includes('verdana')) return "Verdana, Geneva, sans-serif";
    if (lower.includes('tahoma')) return "Tahoma, Geneva, sans-serif";
    if (lower.includes('trebuchet')) return "'Trebuchet MS', Helvetica, sans-serif";
    if (lower.includes('segoe')) return "'Segoe UI', Tahoma, Geneva, sans-serif";
    if (lower.includes('garamond')) return "Garamond, 'Times New Roman', serif";
    if (lower.includes('courier')) return "'Courier New', Courier, monospace";
    if (lower.includes('consolas')) return "Consolas, 'Courier New', monospace";
    if (lower.includes('century gothic')) return "'Century Gothic', AppleGothic, sans-serif";
    if (lower.includes('book antiqua')) return "'Book Antiqua', Palatino, serif";
    if (lower.includes('palatino')) return "'Palatino Linotype', 'Book Antiqua', Palatino, serif";
    if (lower.includes('sylfaen')) return "Sylfaen, 'Times New Roman', serif";

    const found = WORD_FONTS_LIST.find(f => f.label.toLowerCase().startsWith(lower));
    if (found) return found.value;

    return `'${cleaned}', 'Times New Roman', Times, serif`;
}

async function extractDocxRichHtmlAndText(arrayBuffer) {
    try {
        const bytes = new Uint8Array(arrayBuffer);
        const view = new DataView(arrayBuffer);

        let eocdOffset = -1;
        for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
            if (view.getUint32(i, true) === 0x06054b50) {
                eocdOffset = i;
                break;
            }
        }
        if (eocdOffset === -1) return null;

        const cdCount = view.getUint16(eocdOffset + 10, true);
        const cdOffset = view.getUint32(eocdOffset + 16, true);

        let ptr = cdOffset;
        let docXmlCompressed = null;
        let compressionMethod = 0;

        for (let i = 0; i < cdCount; i++) {
            if (ptr + 46 > bytes.length) break;
            if (view.getUint32(ptr, true) !== 0x02014b50) break;

            const method = view.getUint16(ptr + 10, true);
            const compSize = view.getUint32(ptr + 20, true);
            const nameLen = view.getUint16(ptr + 28, true);
            const extraLen = view.getUint16(ptr + 30, true);
            const commentLen = view.getUint16(ptr + 32, true);
            const localHeaderOffset = view.getUint32(ptr + 42, true);

            const nameBytes = bytes.slice(ptr + 46, ptr + 46 + nameLen);
            const fileName = new TextDecoder('utf-8').decode(nameBytes);

            if (fileName === 'word/document.xml') {
                const lNameLen = view.getUint16(localHeaderOffset + 26, true);
                const lExtraLen = view.getUint16(localHeaderOffset + 28, true);
                const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen;
                docXmlCompressed = bytes.slice(dataStart, dataStart + compSize);
                compressionMethod = method;
                break;
            }
            ptr += 46 + nameLen + extraLen + commentLen;
        }

        if (!docXmlCompressed) return null;

        let xmlString = '';
        if (compressionMethod === 0) {
            xmlString = new TextDecoder('utf-8').decode(docXmlCompressed);
        } else if (compressionMethod === 8 && typeof DecompressionStream !== 'undefined') {
            const ds = new DecompressionStream('deflate-raw');
            const writer = ds.writable.getWriter();
            writer.write(docXmlCompressed);
            writer.close();
            const resp = new Response(ds.readable);
            const decompressedBuffer = await resp.arrayBuffer();
            xmlString = new TextDecoder('utf-8').decode(decompressedBuffer);
        } else {
            return null;
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
        const bodyNode = xmlDoc.getElementsByTagName('w:body')[0] || xmlDoc.documentElement;

        let htmlParts = [];
        let plainParts = [];

        function parseRun(rNode) {
            let text = '';
            const children = Array.from(rNode.childNodes);
            children.forEach(ch => {
                if (ch.nodeName === 'w:t') {
                    text += ch.textContent || '';
                } else if (ch.nodeName === 'w:tab') {
                    text += '\u00A0\u00A0\u00A0\u00A0';
                } else if (ch.nodeName === 'w:br' || ch.nodeName === 'w:cr') {
                    text += '\n';
                }
            });
            if (!text) return { html: '', text: '' };

            let styles = [];
            const rPr = rNode.getElementsByTagName('w:rPr')[0];
            if (rPr) {
                const b = rPr.getElementsByTagName('w:b')[0];
                if (b && b.getAttribute('w:val') !== '0' && b.getAttribute('w:val') !== 'false') {
                    styles.push('font-weight:bold');
                }
                const i = rPr.getElementsByTagName('w:i')[0];
                if (i && i.getAttribute('w:val') !== '0' && i.getAttribute('w:val') !== 'false') {
                    styles.push('font-style:italic');
                }
                const u = rPr.getElementsByTagName('w:u')[0];
                if (u && u.getAttribute('w:val') !== 'none') {
                    styles.push('text-decoration:underline');
                }
                const sz = rPr.getElementsByTagName('w:sz')[0];
                if (sz) {
                    const halfPt = parseInt(sz.getAttribute('w:val'), 10);
                    if (!isNaN(halfPt) && halfPt > 8 && halfPt < 140) {
                        styles.push(`font-size:${Math.round(halfPt / 2)}pt`);
                    }
                }
                const rFonts = rPr.getElementsByTagName('w:rFonts')[0];
                if (rFonts) {
                    const fontAttr = rFonts.getAttribute('w:ascii') || rFonts.getAttribute('w:hAnsi') || rFonts.getAttribute('w:cs');
                    if (fontAttr) {
                        styles.push(`font-family:${normalizeWordFontName(fontAttr)}`);
                    }
                }
            }

            const safeHtmlText = escapeHtml(text).replace(/\n/g, '<br>');
            if (styles.length > 0) {
                return { html: `<span style="${styles.join(';')}">${safeHtmlText}</span>`, text };
            }
            return { html: safeHtmlText, text };
        }

        function parseParagraph(pNode) {
            let align = 'left';
            const pPr = pNode.getElementsByTagName('w:pPr')[0];
            if (pPr) {
                const jc = pPr.getElementsByTagName('w:jc')[0];
                if (jc) {
                    const val = jc.getAttribute('w:val');
                    if (val === 'center') align = 'center';
                    else if (val === 'right' || val === 'end') align = 'right';
                    else if (val === 'both' || val === 'distribute') align = 'justify';
                }
            }

            const runs = Array.from(pNode.getElementsByTagName('w:r'));
            let pHtml = '';
            let pText = '';
            runs.forEach(r => {
                const res = parseRun(r);
                pHtml += res.html;
                pText += res.text;
            });

            if (!pText.trim()) {
                return { html: '<div style="min-height:1em;">&nbsp;</div>', text: '' };
            }
            return {
                html: `<div style="text-align:${align}; margin-bottom:4px;">${pHtml}</div>`,
                text: pText
            };
        }

        Array.from(bodyNode.childNodes).forEach(node => {
            if (node.nodeName === 'w:p') {
                const res = parseParagraph(node);
                htmlParts.push(res.html);
                if (res.text) plainParts.push(res.text);
            } else if (node.nodeName === 'w:tbl') {
                let tblHtml = '<table style="width:100%; border-collapse:collapse; margin:8px 0; border:1px solid #475569;">';
                const rows = Array.from(node.getElementsByTagName('w:tr'));
                rows.forEach(tr => {
                    tblHtml += '<tr>';
                    const cells = Array.from(tr.getElementsByTagName('w:tc'));
                    cells.forEach(tc => {
                        let cellHtml = '';
                        let cellText = [];
                        const ps = Array.from(tc.getElementsByTagName('w:p'));
                        ps.forEach(p => {
                            const pRes = parseParagraph(p);
                            cellHtml += pRes.html;
                            if (pRes.text) cellText.push(pRes.text);
                        });
                        plainParts.push(cellText.join(' '));
                        tblHtml += `<td style="border:1px solid #64748b; padding:4px 6px; vertical-align:top;">${cellHtml}</td>`;
                    });
                    tblHtml += '</tr>';
                });
                tblHtml += '</table>';
                htmlParts.push(tblHtml);
            }
        });

        return {
            html: htmlParts.join(''),
            text: plainParts.join('\n').trim()
        };
    } catch (e) {
        return null;
    }
}

// ==========================================
// ІНТЕГРАЦІЯ КНОПКИ "ДОКУМЕНТИ" У ВЕРХНЄ МЕНЮ
// ==========================================

function syncDocumentsButtonVisibility() {
    syncAddCarButtonVisibility();
    syncCategorySelectsAndAdBlueDOM();

    const devPanelBtn = document.getElementById('nav-btn-dev-panel');
    let navContainer = devPanelBtn ? devPanelBtn.parentElement : null;

    if (!navContainer) {
        navContainer = document.querySelector('.nav-tabs, .nav-bar, header nav, .top-nav, .tabs');
    }
    if (!navContainer) {
        const allBtns = Array.from(document.querySelectorAll('button'));
        const marshrutyBtn = allBtns.find(b => (b.textContent || '').includes('Маршрути'));
        if (marshrutyBtn) navContainer = marshrutyBtn.parentElement;
    }
    if (!navContainer) return;

    let docsBtn = document.getElementById('nav-btn-documents');
    if (!docsBtn) {
        docsBtn = document.createElement('button');
        docsBtn.id = 'nav-btn-documents';

        const sampleTabBtn = Array.from(navContainer.querySelectorAll('button')).find(
            b => b.id !== 'nav-btn-dev-panel' && b.id !== 'nav-btn-documents'
        );
        docsBtn.className = sampleTabBtn ? sampleTabBtn.className.replace(/\bactive\b/g, '').trim() : 'nav-btn';
        docsBtn.innerHTML = 'Документи';
        docsBtn.onclick = (e) => {
            e.preventDefault();
            openDocumentsTabView();
        };

        if (devPanelBtn && devPanelBtn.parentElement === navContainer) {
            navContainer.insertBefore(docsBtn, devPanelBtn);
        } else {
            navContainer.appendChild(docsBtn);
        }

        Array.from(navContainer.querySelectorAll('button')).forEach(btn => {
            if (btn.id === 'nav-btn-documents') return;
            btn.addEventListener('click', () => {
                closeDocumentsTabView();
                setTimeout(() => {
                    syncAddCarButtonVisibility();
                    syncCategorySelectsAndAdBlueDOM();
                }, 50);
            });
        });
    }

    let isDevVisible = false;
    if (devPanelBtn) {
        const comp = window.getComputedStyle(devPanelBtn);
        isDevVisible = comp.display !== 'none' && comp.visibility !== 'hidden' && !devPanelBtn.hidden;
    }

    const role = getCurrentUserRoleForDocs();
    const shouldShow = isDevVisible || role === 'dev';

    if (shouldShow) {
        docsBtn.style.display = 'inline-flex';
        docsBtn.style.alignItems = 'center';
        docsBtn.style.justifyContent = 'center';
    } else {
        docsBtn.style.display = 'none';
        const mainSec = document.getElementById('documents-main-section');
        if (mainSec && mainSec.style.display !== 'none') {
            closeDocumentsTabView();
        }
    }
}

function openDocumentsTabView() {
    initDocumentsModule();
    const section = document.getElementById('documents-main-section');
    if (!section) return;

    const parent = section.parentElement;
    if (parent) {
        Array.from(parent.children).forEach(ch => {
            if (ch.id === 'documents-main-section') return;
            const tag = ch.tagName.toLowerCase();
            if (tag === 'header' || tag === 'nav' || tag === 'script' || tag === 'style') return;
            if (ch.querySelector && ch.querySelector('#nav-btn-documents')) return;

            if (window.getComputedStyle(ch).display !== 'none') {
                ch.dataset.hiddenByDocsTab = 'true';
                ch.style.display = 'none';
            }
        });
    }

    const docsBtn = document.getElementById('nav-btn-documents');
    if (docsBtn && docsBtn.parentElement) {
        Array.from(docsBtn.parentElement.querySelectorAll('button')).forEach(b => {
            if (b.id === 'nav-btn-documents') {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });
    }

    section.style.display = 'block';
    renderDocumentsMainView();
}

function closeDocumentsTabView() {
    const section = document.getElementById('documents-main-section');
    if (section) {
        section.style.display = 'none';
    }

    const docsBtn = document.getElementById('nav-btn-documents');
    if (docsBtn) {
        docsBtn.classList.remove('active');
    }

    if (section && section.parentElement) {
        Array.from(section.parentElement.children).forEach(ch => {
            if (ch.dataset && ch.dataset.hiddenByDocsTab === 'true') {
                ch.style.display = '';
                delete ch.dataset.hiddenByDocsTab;
            }
        });
    }
    syncAddCarButtonVisibility();
    syncCategorySelectsAndAdBlueDOM();
}

function setupDocumentsRoleWatcher() {
    sanitizeCategoriesAndFormulasInStorage();
    syncDocumentsButtonVisibility();

    if (typeof window.updateRoleUI === 'function' && !window._docsPatchedUpdateRole) {
        const orig = window.updateRoleUI;
        window.updateRoleUI = function (...args) {
            const res = orig.apply(this, args);
            setTimeout(syncDocumentsButtonVisibility, 30);
            return res;
        };
        window._docsPatchedUpdateRole = true;
    }

    if (typeof window.selectRole === 'function' && !window._docsPatchedSelectRole) {
        const origSelect = window.selectRole;
        window.selectRole = function (roleArg, ...rest) {
            if (roleArg) trackedAppRole = String(roleArg).toLowerCase();
            const res = origSelect.call(this, roleArg, ...rest);
            setTimeout(syncDocumentsButtonVisibility, 30);
            return res;
        };
        window._docsPatchedSelectRole = true;
    }

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button, span, a');
        if (btn) {
            const txt = (btn.textContent || '').trim().toLowerCase();
            if (txt === 'розробник') trackedAppRole = 'dev';
            else if (txt === 'адмін') trackedAppRole = 'admin';
            else if (txt === 'модератор') trackedAppRole = 'moderator';
            else if (txt === 'юзер') trackedAppRole = 'user';
            else if (txt.includes('вийти')) trackedAppRole = null;
        }
        setTimeout(syncDocumentsButtonVisibility, 50);
    }, true);

    document.addEventListener('change', (e) => {
        if (e.target && e.target.tagName === 'SELECT') {
            sanitizeCategoriesAndFormulasInStorage();
            setTimeout(syncCategorySelectsAndAdBlueDOM, 30);
        }
    }, true);

    const devBtn = document.getElementById('nav-btn-dev-panel');
    if (devBtn) {
        const obs = new MutationObserver(() => {
            syncDocumentsButtonVisibility();
        });
        obs.observe(devBtn, { attributes: true, attributeFilter: ['style', 'class'] });
    }
}

// ==========================================
// ІНІЦІАЛІЗАЦІЯ СЕКЦІЇ ДОКУМЕНТІВ (СВІТЛА ТЕМА)
// ==========================================

function initDocumentsModule() {
    syncDocumentsButtonVisibility();

    if (document.getElementById('documents-main-section')) return;

    const section = document.createElement('div');
    section.id = 'documents-main-section';
    section.className = 'tab-content';
    section.style.cssText = 'display:none; padding: 22px; background: #ffffff; border-radius: 12px; margin: 18px auto; max-width: 1400px; color: #1e293b; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;';

    const existingTab = document.querySelector('.tab-content, #baza, #registry, main, .container');
    if (existingTab && existingTab.parentElement) {
        existingTab.parentElement.appendChild(section);
    } else {
        document.body.appendChild(section);
    }

    renderDocumentsMainView();
}

function renderDocumentsMainView() {
    const section = document.getElementById('documents-main-section');
    if (!section) return;

    const docs = getSavedDocumentsList();

    section.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:20px; border-bottom:2px solid #e2e8f0; padding-bottom:14px;">
            <div>
                <h2 style="margin:0; font-size:22px; color:#0f172a; display:flex; align-items:center; gap:10px; font-weight:800;">
                    📄 Управління документами та конструктор А4
                </h2>
                <p style="margin:4px 0 0 0; font-size:13px; color:#64748b;">
                    Завантажуйте файли у рідному форматі (.docx, .pdf, зображення) або створюйте документи в конструкторі А4
                </p>
            </div>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                <label for="doc-upload-input" style="background:#2563eb; color:#fff; padding:10px 18px; border-radius:8px; cursor:pointer; font-weight:700; font-size:14px; display:inline-flex; align-items:center; gap:8px; box-shadow:0 2px 8px rgba(37,99,235,0.25); margin:0;">
                    ➕ Додати документи (З файлу)
                </label>
                <input type="file" id="doc-upload-input" multiple accept=".txt,.doc,.docx,.pdf,.rtf,.html,.png,.jpg,.jpeg,.webp" style="display:none;" onchange="handleUploadDocumentFile(event)">
                <button onclick="createNewBlankDocument()" style="background:#16a34a; color:#fff; border:none; padding:10px 18px; border-radius:8px; cursor:pointer; font-weight:700; font-size:14px; display:inline-flex; align-items:center; gap:8px; box-shadow:0 2px 8px rgba(22,163,74,0.25);">
                    📝 Створити новий документ А4
                </button>
            </div>
        </div>

        <div style="overflow-x:auto; background:#ffffff; border-radius:10px; border:1px solid #cbd5e1; box-shadow:0 1px 4px rgba(0,0,0,0.04);">
            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:14px; color:#1e293b;">
                <thead>
                    <tr style="background:#2e7d32; color:#ffffff;">
                        <th style="padding:12px 14px; border-right:1px solid rgba(255,255,255,0.15); width:55px; text-align:center;">№</th>
                        <th style="padding:12px 14px; border-right:1px solid rgba(255,255,255,0.15);">Назва документа (можна редагувати)</th>
                        <th style="padding:12px 14px; border-right:1px solid rgba(255,255,255,0.15); width:170px;">Формат / Тип</th>
                        <th style="padding:12px 14px; border-right:1px solid rgba(255,255,255,0.15); width:130px;">Дата</th>
                        <th style="padding:12px 14px; width:360px; text-align:center;">Дії</th>
                    </tr>
                </thead>
                <tbody>
                    ${docs.length === 0 ? `
                        <tr>
                            <td colspan="5" style="padding:28px; text-align:center; color:#64748b; background:#f8fafc;">
                                Немає збережених документів. Натисніть «➕ Додати документи» або «📝 Створити новий документ А4».
                            </td>
                        </tr>
                    ` : docs.map((doc, idx) => `
                        <tr style="border-bottom:1px solid #e2e8f0; background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                            <td style="padding:10px 14px; color:#475569; font-weight:700; text-align:center; border-right:1px solid #e2e8f0;">${idx + 1}</td>
                            <td style="padding:10px 14px; border-right:1px solid #e2e8f0;">
                                <input type="text"
                                    value="${escapeHtml(doc.name || doc.title || 'Без назви')}"
                                    onchange="updateDocumentTitleInline('${doc.id}', this.value)"
                                    style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:6px; padding:7px 10px; font-size:14px; font-weight:600;"
                                    title="Натисніть, щоб змінити назву документа"
                                />
                            </td>
                            <td style="padding:10px 14px; border-right:1px solid #e2e8f0;">
                                <span style="background:#dcfce7; color:#166534; border:1px solid #86efac; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:700; display:inline-block;">
                                    ${escapeHtml(doc.type || 'Документ А4')}
                                </span>
                            </td>
                            <td style="padding:10px 14px; color:#475569; font-weight:500; border-right:1px solid #e2e8f0;">${escapeHtml(doc.date || '—')}</td>
                            <td style="padding:10px 14px; text-align:center;">
                                <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
                                    <button onclick="openDocumentEditorModal('${doc.id}')"
                                        style="background:#2563eb; color:#fff; border:none; padding:7px 13px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600; display:inline-flex; align-items:center; gap:5px;">
                                        👁️ Відкрити / Редагувати
                                    </button>
                                    ${doc.hasOriginalBinary || doc.fileDataUrl ? `
                                        <button onclick="downloadOriginalDocFile('${doc.id}')"
                                            style="background:#059669; color:#fff; border:none; padding:7px 12px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600;"
                                            title="Завантажити у тому форматі, в якому файл був закачаний">
                                            📥 Оригінал
                                        </button>
                                    ` : ''}
                                    <button onclick="deleteDocumentById('${doc.id}')"
                                        style="background:#ef4444; color:#fff; border:none; padding:7px 12px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600;">
                                        🗑️
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div id="doc-editor-workspace" style="display:none; margin-top:24px;"></div>
    `;
}

// ==========================================
// ЗАВАНТАЖЕННЯ ФАЙЛІВ ІЗ ЗБЕРЕЖЕННЯМ ОРИГІНАЛЬНОГО ФОРМАТУ
// ==========================================

window.updateDocumentTitleInline = function (docId, newName) {
    const docs = getSavedDocumentsList();
    const target = docs.find(d => d.id === docId);
    if (!target) return;
    target.name = newName.trim() || 'Без назви';
    target.title = target.name;
    saveDocumentsList(docs);
};

window.handleUploadDocumentFile = async function (event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const docs = getSavedDocumentsList();

    for (const file of files) {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        const newDocId = 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

        let bodyText = '';
        let bodyHtml = '';
        let originalFormat = ext || 'a4';
        const dataUrl = await readFileAsDataURLAsync(file);

        await saveDocBinaryToIDB(newDocId, {
            fileDataUrl: dataUrl,
            originalFileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            ext: ext
        });

        if (ext === 'txt' || ext === 'html' || ext === 'rtf') {
            bodyText = await readFileAsTextAsync(file);
            if (ext === 'html') {
                bodyHtml = bodyText;
            }
        } else if (ext === 'docx') {
            const buffer = await readFileAsArrayBufferAsync(file);
            const parsed = await extractDocxRichHtmlAndText(buffer);
            if (parsed && (parsed.html || parsed.text)) {
                bodyHtml = parsed.html;
                bodyText = parsed.text;
            } else {
                bodyText = `Документ Word: «${file.name}».\nВи можете редагувати текст на аркуші А4 або завантажити оригінал кнопкою «📥 Завантажити оригінал».`;
            }
        } else if (ext === 'pdf') {
            bodyText = `PDF-документ: «${file.name}»`;
        } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
            bodyHtml = `<div style="text-align:center;"><img src="${dataUrl}" style="max-width:100%; height:auto;" /></div>`;
            bodyText = '';
        } else {
            bodyText = `Файл «${file.name}» (${ext.toUpperCase()}) завантажено.`;
        }

        const newDoc = {
            id: newDocId,
            name: cleanName,
            title: cleanName,
            originalFileName: file.name,
            originalFormat: originalFormat,
            type: `Файл .${ext.toUpperCase() || 'DOC'}`,
            date: new Date().toLocaleDateString('uk-UA'),
            content: bodyText,
            bodyHtml: bodyHtml,
            hasOriginalBinary: true,
            fileDataUrl: dataUrl.length < 250000 ? dataUrl : '',
            layout: getDefaultLayoutState()
        };
        newDoc.layout.docTitle.text = cleanName.toUpperCase();
        docs.unshift(newDoc);
    }

    saveDocumentsList(docs);
    event.target.value = '';
    renderDocumentsMainView();

    if (docs[0]) {
        openDocumentEditorModal(docs[0].id);
    }
};

window.downloadOriginalDocFile = async function (docId) {
    const docs = getSavedDocumentsList();
    const doc = docs.find(d => d.id === docId);
    if (!doc) return;

    let dataUrl = doc.fileDataUrl;
    let fileName = doc.originalFileName || ((doc.name || 'document') + '.' + (doc.originalFormat || 'docx'));

    if (!dataUrl) {
        const idbRecord = await getDocBinaryFromIDB(docId);
        if (idbRecord && idbRecord.fileDataUrl) {
            dataUrl = idbRecord.fileDataUrl;
            if (idbRecord.originalFileName) fileName = idbRecord.originalFileName;
        }
    }

    if (!dataUrl) {
        alert('Оригінальний бінарний файл не знайдено. Ви можете роздрукувати документ через «🖨️ Друк А4».');
        return;
    }

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
};

function readFileAsTextAsync(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(String(e.target.result || ''));
        reader.onerror = () => resolve('');
        reader.readAsText(file, 'UTF-8');
    });
}

function readFileAsDataURLAsync(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(String(e.target.result || ''));
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
    });
}

function readFileAsArrayBufferAsync(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => resolve(new ArrayBuffer(0));
        reader.readAsArrayBuffer(file);
    });
}

window.createNewBlankDocument = function () {
    const docs = getSavedDocumentsList();
    const newDoc = {
        id: 'doc_' + Date.now(),
        name: 'Новий документ А4',
        title: 'Новий документ А4',
        originalFormat: 'a4',
        type: 'Конструктор А4',
        date: new Date().toLocaleDateString('uk-UA'),
        content: 'Введіть основний текст документа тут...',
        bodyHtml: '',
        layout: getDefaultLayoutState()
    };
    docs.unshift(newDoc);
    saveDocumentsList(docs);
    renderDocumentsMainView();
    openDocumentEditorModal(newDoc.id);
};

// ==========================================
// КОНСТРУКТОР ТА ПЕРЕГЛЯДАЧ У РІДНОМУ ФОРМАТІ (СВІТЛА ТЕМА)
// ==========================================

window.openDocumentEditorModal = async function (docId) {
    const docs = getSavedDocumentsList();
    const doc = docs.find(d => d.id === docId);
    if (!doc) return;

    currentEditingDocId = docId;

    let binaryDataUrl = doc.fileDataUrl || '';
    if (!binaryDataUrl && doc.hasOriginalBinary) {
        const idbData = await getDocBinaryFromIDB(docId);
        if (idbData && idbData.fileDataUrl) {
            binaryDataUrl = idbData.fileDataUrl;
        }
    }

    const def = getDefaultLayoutState();
    const savedLayout = doc.layout || {};

    docLayoutState = {
        leftHeader: { ...def.leftHeader, ...(savedLayout.leftHeader || {}) },
        rightHeader: { ...def.rightHeader, ...(savedLayout.rightHeader || {}), rotate: 0 },
        docTitle: { ...def.docTitle, ...(savedLayout.docTitle || {}), rotate: 0 },
        bodyStyle: { ...def.bodyStyle, ...(savedLayout.bodyStyle || {}) },
        signers: {
            ...def.signers,
            ...(savedLayout.signers || {}),
            rotate: 0,
            rows: Array.isArray(savedLayout.signers?.rows) && savedLayout.signers.rows.length
                ? savedLayout.signers.rows.map(r => ({ ...r }))
                : [{ role: 'Командир підрозділу', name: 'Ім\'я ПРІЗВИЩЕ', roleHtml: '', nameHtml: '' }]
        },
        signature: { ...def.signature, ...(savedLayout.signature || {}) }
    };

    docLayoutState.leftHeader.fontFamily = normalizeWordFontName(docLayoutState.leftHeader.fontFamily);
    docLayoutState.rightHeader.fontFamily = normalizeWordFontName(docLayoutState.rightHeader.fontFamily);
    docLayoutState.docTitle.fontFamily = normalizeWordFontName(docLayoutState.docTitle.fontFamily);
    docLayoutState.bodyStyle.fontFamily = normalizeWordFontName(docLayoutState.bodyStyle.fontFamily);
    docLayoutState.signers.fontFamily = normalizeWordFontName(docLayoutState.signers.fontFamily);

    const workspace = document.getElementById('doc-editor-workspace');
    if (!workspace) return;
    workspace.style.display = 'block';

    const ext = (doc.originalFormat || '').toLowerCase();
    const isPdf = ext === 'pdf' && binaryDataUrl;

    const fontOptionsHtml = WORD_FONTS_LIST.map(f =>
        `<option value="${escapeHtml(f.value)}">${escapeHtml(f.label)}</option>`
    ).join('');

    workspace.innerHTML = `
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:12px; padding:18px; color:#0f172a; box-shadow:0 4px 16px rgba(0,0,0,0.06);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; padding-bottom:14px; border-bottom:1px solid #cbd5e1; margin-bottom:16px;">
                <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:280px;">
                    <span style="font-weight:700; color:#334155; white-space:nowrap;">📝 Назва документа:</span>
                    <input type="text" id="doc-editor-name-input" value="${escapeHtml(doc.name || doc.title || '')}"
                        style="flex:1; max-width:440px; background:#ffffff; color:#0f172a; border:1px solid #94a3b8; border-radius:8px; padding:8px 12px; font-size:15px; font-weight:700;"
                    />
                    <span style="background:#e2e8f0; color:#334155; padding:5px 10px; border-radius:6px; font-size:12px; font-weight:700;">
                        Формат: ${(ext || 'A4').toUpperCase()}
                    </span>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    ${binaryDataUrl ? `
                        <button onclick="downloadOriginalDocFile('${doc.id}')" style="background:#0284c7; color:#fff; border:none; padding:9px 15px; border-radius:8px; cursor:pointer; font-weight:700; font-size:13px;">
                            📥 Завантажити оригінал (${(ext || 'файл').toUpperCase()})
                        </button>
                    ` : ''}
                    <button onclick="saveCurrentDocumentFromEditor()" style="background:#16a34a; color:#fff; border:none; padding:9px 18px; border-radius:8px; cursor:pointer; font-weight:700; font-size:14px;">
                        💾 Зберегти зміни
                    </button>
                    <button onclick="printCurrentA4Document()" style="background:#2563eb; color:#fff; border:none; padding:9px 16px; border-radius:8px; cursor:pointer; font-weight:700; font-size:14px;">
                        🖨️ Друк А4
                    </button>
                    <button onclick="closeDocumentEditorWorkspace()" style="background:#64748b; color:#fff; border:none; padding:9px 15px; border-radius:8px; cursor:pointer; font-weight:600; font-size:14px;">
                        ✖ Закрити
                    </button>
                </div>
            </div>

            ${isPdf ? `
                <div style="margin-bottom:18px; background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <strong style="color:#0f172a; font-size:14px;">📄 Перегляд оригінального PDF-файлу: ${escapeHtml(doc.originalFileName || doc.name)}</strong>
                        <span style="font-size:12px; color:#64748b;">Відкрито у рідному форматі PDF</span>
                    </div>
                    <iframe src="${binaryDataUrl}" style="width:100%; height:780px; border:1px solid #cbd5e1; border-radius:8px; background:#fff;"></iframe>
                </div>
            ` : ''}

            <div style="display:grid; grid-template-columns: 400px 1fr; gap:20px; align-items:start;">
                <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:14px; max-height:920px; overflow-y:auto; display:block; box-shadow:0 1px 4px rgba(0,0,0,0.04);">
                    
                    <div style="background:#eff6ff; border:1px solid #93c5fd; border-radius:8px; padding:12px; margin-bottom:14px;">
                        <div style="font-weight:800; font-size:13px; color:#1e40af; margin-bottom:6px;">
                            🔤 Шрифт і форматування (Слово або весь блок)
                        </div>
                        <div style="font-size:11px; color:#334155; margin-bottom:8px; line-height:1.35;">
                            Виділіть <b>одне слово/фразу</b> на аркуші А4 — зміниться тільки виділене. Якщо нічого не виділено — зміниться весь активний блок.
                        </div>

                        <div style="display:grid; grid-template-columns: 1fr 78px 78px; gap:6px; margin-bottom:8px;">
                            <div>
                                <label style="font-size:11px; color:#475569; font-weight:600; display:block; margin-bottom:2px;">Шрифт (усі шрифти Word)</label>
                                <select id="ctrl-font-family"
                                    onmousedown="preserveCurrentSelection()"
                                    onchange="applyFormattingControl('fontFamily', this.value)"
                                    style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #94a3b8; border-radius:5px; padding:5px; font-size:12px;">
                                    ${fontOptionsHtml}
                                </select>
                            </div>
                            <div>
                                <label style="font-size:11px; color:#475569; font-weight:600; display:block; margin-bottom:2px;">Розмір</label>
                                <input type="number" id="ctrl-font-size" min="8" max="72" value="${docLayoutState.bodyStyle.fontSize}"
                                    onmousedown="preserveCurrentSelection()"
                                    oninput="applyFormattingControl('fontSize', this.value)"
                                    style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #94a3b8; border-radius:5px; padding:5px; font-size:12px;" />
                            </div>
                            <div>
                                <label style="font-size:11px; color:#475569; font-weight:600; display:block; margin-bottom:2px;">Інтервал</label>
                                <input type="number" id="ctrl-line-height" min="0.8" max="3.0" step="0.05" value="${docLayoutState.bodyStyle.lineHeight}"
                                    onmousedown="preserveCurrentSelection()"
                                    oninput="applyFormattingControl('lineHeight', this.value)"
                                    style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #94a3b8; border-radius:5px; padding:5px; font-size:12px;" />
                            </div>
                        </div>

                        <div style="display:flex; gap:5px; flex-wrap:wrap;">
                            <button type="button" onmousedown="event.preventDefault(); applyFormattingControl('bold')"
                                style="flex:1; background:#ffffff; color:#0f172a; border:1px solid #94a3b8; border-radius:5px; padding:6px 8px; cursor:pointer; font-weight:bold; font-size:13px;">B</button>
                            <button type="button" onmousedown="event.preventDefault(); applyFormattingControl('italic')"
                                style="flex:1; background:#ffffff; color:#0f172a; border:1px solid #94a3b8; border-radius:5px; padding:6px 8px; cursor:pointer; font-style:italic; font-size:13px;">I</button>
                            <button type="button" onmousedown="event.preventDefault(); applyFormattingControl('underline')"
                                style="flex:1; background:#ffffff; color:#0f172a; border:1px solid #94a3b8; border-radius:5px; padding:6px 8px; cursor:pointer; text-decoration:underline; font-size:13px;">U</button>

                            <button type="button" onmousedown="event.preventDefault(); applyFormattingControl('align', 'left')"
                                style="flex:1; background:#ffffff; color:#0f172a; border:1px solid #94a3b8; border-radius:5px; padding:6px 8px; cursor:pointer; font-size:12px;">⬅</button>
                            <button type="button" onmousedown="event.preventDefault(); applyFormattingControl('align', 'center')"
                                style="flex:1; background:#ffffff; color:#0f172a; border:1px solid #94a3b8; border-radius:5px; padding:6px 8px; cursor:pointer; font-size:12px;">↔</button>
                            <button type="button" onmousedown="event.preventDefault(); applyFormattingControl('align', 'right')"
                                style="flex:1; background:#ffffff; color:#0f172a; border:1px solid #94a3b8; border-radius:5px; padding:6px 8px; cursor:pointer; font-size:12px;">➡</button>
                            <button type="button" onmousedown="event.preventDefault(); applyFormattingControl('align', 'justify')"
                                style="flex:1; background:#ffffff; color:#0f172a; border:1px solid #94a3b8; border-radius:5px; padding:6px 8px; cursor:pointer; font-size:12px;">☰</button>
                        </div>
                    </div>

                    <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px; margin-bottom:12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <span style="font-weight:700; font-size:13px; color:#0284c7;">↖️ Верхня ліва шапка:</span>
                            <button type="button" onclick="resetBlockPosition('leftHeader')" style="background:#e2e8f0; color:#0f172a; border:1px solid #94a3b8; border-radius:4px; padding:2px 8px; font-size:11px; cursor:pointer; font-weight:600;">
                                📍 На місце
                            </button>
                        </div>
                        <textarea id="inp-left-header" rows="2"
                            onfocus="setActiveBlockForFormatting('doc-ed-left-header')"
                            oninput="updateBlockTextFromSidebar('leftHeader', this.value)"
                            style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:6px; padding:6px; font-size:12px; resize:vertical;">${escapeHtml(docLayoutState.leftHeader.text)}</textarea>
                        <div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
                            <span style="font-size:11px; color:#475569; white-space:nowrap;">🔄 Поворот: <b id="lbl-rot-left">${docLayoutState.leftHeader.rotate}°</b></span>
                            <input type="range" min="-180" max="180" value="${docLayoutState.leftHeader.rotate}"
                                oninput="updateBlockRotation('leftHeader', this.value)" style="flex:1;" />
                            <button type="button" onclick="updateBlockRotation('leftHeader', 0)" style="background:#e2e8f0; color:#0f172a; border:1px solid #cbd5e1; border-radius:4px; padding:2px 6px; font-size:11px; cursor:pointer;">0°</button>
                        </div>
                    </div>

                    <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px; margin-bottom:12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <span style="font-weight:700; font-size:13px; color:#16a34a;">↗️ Верхня права шапка:</span>
                        </div>
                        <textarea id="inp-right-header" rows="3"
                            onfocus="setActiveBlockForFormatting('doc-ed-right-header')"
                            oninput="updateBlockTextFromSidebar('rightHeader', this.value)"
                            style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:6px; padding:6px; font-size:12px; resize:vertical;">${escapeHtml(docLayoutState.rightHeader.text)}</textarea>
                    </div>

                    <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px; margin-bottom:12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <span style="font-weight:700; font-size:13px; color:#7c3aed;">🎯 Заголовок документа:</span>
                        </div>
                        <input type="text" id="inp-doc-title" value="${escapeHtml(docLayoutState.docTitle.text)}"
                            onfocus="setActiveBlockForFormatting('doc-ed-title')"
                            oninput="updateBlockTextFromSidebar('docTitle', this.value)"
                            style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:6px; padding:7px; font-size:13px; font-weight:700;" />
                    </div>

                    <div style="background:#fffbeb; border:2px solid #f59e0b; border-radius:8px; padding:12px; margin-bottom:12px; height:auto; overflow:visible;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:6px;">
                            <span style="font-weight:800; font-size:13px; color:#b45309;">👤 Хто підписав документ:</span>
                            <button type="button" onclick="addSignerRow()" style="background:#f59e0b; color:#ffffff; border:none; border-radius:5px; padding:5px 10px; font-size:12px; font-weight:700; cursor:pointer;">
                                ➕ Додати рядок
                            </button>
                        </div>
                        <div id="signers-rows-container" style="display:flex; flex-direction:column; gap:10px; height:auto; overflow:visible;"></div>
                    </div>

                    <div style="background:#fdf2f8; border:1px solid #f472b6; border-radius:8px; padding:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <span style="font-weight:700; font-size:13px; color:#be185d;">✍️ Додати підпис (з файлу):</span>
                            ${docLayoutState.signature.dataUrl ? `
                                <button type="button" onclick="removeSignatureImage()" style="background:#ef4444; color:#fff; border:none; border-radius:4px; padding:2px 8px; font-size:11px; cursor:pointer;">Видалити</button>
                            ` : ''}
                        </div>
                        <input type="file" accept="image/*" onchange="handleSignatureFileUpload(event)"
                            style="width:100%; font-size:12px; color:#334155; margin-bottom:8px;" />

                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; margin-bottom:6px;">
                            <div>
                                <label style="font-size:11px; color:#475569; display:block;">Колір підпису:</label>
                                <select id="sig-color-select" onchange="changeSignatureColor(this.value)"
                                    style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:4px; padding:4px; font-size:12px;">
                                    <option value="original" ${docLayoutState.signature.colorMode === 'original' ? 'selected' : ''}>Оригінал (прозорий фон)</option>
                                    <option value="#0033cc" ${docLayoutState.signature.colorMode === '#0033cc' ? 'selected' : ''}>Синя ручка</option>
                                    <option value="#1e1b4b" ${docLayoutState.signature.colorMode === '#1e1b4b' ? 'selected' : ''}>Темно-синій</option>
                                    <option value="#000000" ${docLayoutState.signature.colorMode === '#000000' ? 'selected' : ''}>Чорний</option>
                                    <option value="#6d28d9" ${docLayoutState.signature.colorMode === '#6d28d9' ? 'selected' : ''}>Фіолетовий</option>
                                </select>
                            </div>
                            <div>
                                <label style="font-size:11px; color:#475569; display:block;">Ширина: <b id="lbl-sig-width">${docLayoutState.signature.width}px</b></label>
                                <input type="range" min="60" max="380" value="${docLayoutState.signature.width}"
                                    oninput="updateSignatureSize(this.value)" style="width:100%;" />
                            </div>
                        </div>

                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:11px; color:#475569;">🔄 Поворот: <b id="lbl-sig-rot">${docLayoutState.signature.rotate}°</b></span>
                            <input type="range" min="-180" max="180" value="${docLayoutState.signature.rotate}"
                                oninput="updateSignatureRotation(this.value)" style="flex:1;" />
                            <button type="button" onclick="updateSignatureRotation(0)" style="background:#e2e8f0; color:#0f172a; border:1px solid #cbd5e1; border-radius:4px; padding:2px 6px; font-size:11px; cursor:pointer;">0°</button>
                        </div>
                    </div>

                </div>

                <div style="background:#e2e8f0; border:1px solid #cbd5e1; border-radius:10px; padding:24px; overflow:auto; display:flex; justify-content:center;">
                    <div id="a4-paper-sheet" style="width:210mm; min-height:297mm; background:#ffffff; color:#000000; padding:20mm 18mm 20mm 25mm; box-sizing:border-box; box-shadow:0 8px 30px rgba(0,0,0,0.18); position:relative; overflow:hidden;">
                        
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:22px; position:relative; min-height:65px;">
                            <div id="doc-ed-left-header-wrap"
                                style="position:relative; width:${docLayoutState.leftHeader.width}px; transform:translate(${docLayoutState.leftHeader.x}px, ${docLayoutState.leftHeader.y}px) rotate(${docLayoutState.leftHeader.rotate}deg); transform-origin:center center; z-index:5;">
                                <div id="doc-ed-left-header-handle"
                                    title="Потягніть мишкою, щоб перемістити ліву шапку"
                                    style="display:inline-block; background:#e0f2fe; color:#0369a1; border:1px dashed #0284c7; border-radius:4px; padding:1px 6px; font-size:10px; cursor:move; margin-bottom:3px; user-select:none;">
                                    ✥ Перемістити ліву шапку
                                </div>
                                <div id="doc-ed-left-header"
                                    contenteditable="true"
                                    onfocus="setActiveBlockForFormatting('doc-ed-left-header')"
                                    onmouseup="preserveCurrentSelection()"
                                    onkeyup="preserveCurrentSelection(); syncRichBlockToState('leftHeader')"
                                    style="outline:none; min-height:36px; white-space:pre-wrap; word-break:break-word; padding:3px; border:1px dashed transparent; font-family:${docLayoutState.leftHeader.fontFamily}; font-size:${docLayoutState.leftHeader.fontSize}pt; line-height:${docLayoutState.leftHeader.lineHeight}; text-align:${docLayoutState.leftHeader.align}; font-weight:${docLayoutState.leftHeader.bold ? 'bold' : 'normal'}; font-style:${docLayoutState.leftHeader.italic ? 'italic' : 'normal'}; text-decoration:${docLayoutState.leftHeader.underline ? 'underline' : 'none'};"
                                >${docLayoutState.leftHeader.html || escapeHtml(docLayoutState.leftHeader.text)}</div>
                            </div>

                            <div id="doc-ed-right-header-wrap" style="width:${docLayoutState.rightHeader.width}px; margin-left:auto;">
                                <div id="doc-ed-right-header"
                                    contenteditable="true"
                                    onfocus="setActiveBlockForFormatting('doc-ed-right-header')"
                                    onmouseup="preserveCurrentSelection()"
                                    onkeyup="preserveCurrentSelection(); syncRichBlockToState('rightHeader')"
                                    style="outline:none; min-height:46px; white-space:pre-wrap; word-break:break-word; padding:3px; font-family:${docLayoutState.rightHeader.fontFamily}; font-size:${docLayoutState.rightHeader.fontSize}pt; line-height:${docLayoutState.rightHeader.lineHeight}; text-align:${docLayoutState.rightHeader.align}; font-weight:${docLayoutState.rightHeader.bold ? 'bold' : 'normal'}; font-style:${docLayoutState.rightHeader.italic ? 'italic' : 'normal'}; text-decoration:${docLayoutState.rightHeader.underline ? 'underline' : 'none'};"
                                >${docLayoutState.rightHeader.html || escapeHtml(docLayoutState.rightHeader.text)}</div>
                            </div>
                        </div>

                        <div id="doc-ed-title"
                            contenteditable="true"
                            onfocus="setActiveBlockForFormatting('doc-ed-title')"
                            onmouseup="preserveCurrentSelection()"
                            onkeyup="preserveCurrentSelection(); syncRichBlockToState('docTitle')"
                            style="outline:none; margin:16px 0 18px 0; padding:4px; white-space:pre-wrap; word-break:break-word; font-family:${docLayoutState.docTitle.fontFamily}; font-size:${docLayoutState.docTitle.fontSize}pt; line-height:${docLayoutState.docTitle.lineHeight}; text-align:${docLayoutState.docTitle.align}; font-weight:${docLayoutState.docTitle.bold ? 'bold' : 'normal'}; font-style:${docLayoutState.docTitle.italic ? 'italic' : 'normal'}; text-decoration:${docLayoutState.docTitle.underline ? 'underline' : 'none'};"
                        >${docLayoutState.docTitle.html || escapeHtml(docLayoutState.docTitle.text)}</div>

                        <div id="doc-ed-body-text"
                            contenteditable="true"
                            onfocus="setActiveBlockForFormatting('doc-ed-body-text')"
                            onmouseup="preserveCurrentSelection()"
                            onkeyup="preserveCurrentSelection()"
                            style="outline:none; min-height:380px; width:100%; box-sizing:border-box; white-space:pre-wrap; word-break:break-word; padding:4px 0; font-family:${docLayoutState.bodyStyle.fontFamily}; font-size:${docLayoutState.bodyStyle.fontSize}pt; line-height:${docLayoutState.bodyStyle.lineHeight}; text-align:${docLayoutState.bodyStyle.align}; font-weight:${docLayoutState.bodyStyle.bold ? 'bold' : 'normal'}; font-style:${docLayoutState.bodyStyle.italic ? 'italic' : 'normal'}; text-decoration:${docLayoutState.bodyStyle.underline ? 'underline' : 'none'};"
                        >${doc.bodyHtml ? doc.bodyHtml : escapeHtml(doc.content || '')}</div>

                        <div id="doc-ed-signers-wrap"
                            style="margin-top:28px; width:100%; max-width:100%; box-sizing:border-box; overflow:hidden; font-family:${docLayoutState.signers.fontFamily}; font-size:${docLayoutState.signers.fontSize}pt; line-height:${docLayoutState.signers.lineHeight}; font-weight:${docLayoutState.signers.bold ? 'bold' : 'normal'}; font-style:${docLayoutState.signers.italic ? 'italic' : 'normal'}; text-decoration:${docLayoutState.signers.underline ? 'underline' : 'none'};">
                            <div id="doc-ed-signers-list" style="width:100%; box-sizing:border-box;"></div>
                        </div>

                        <div id="doc-ed-signature-floating"
                            style="display:${docLayoutState.signature.dataUrl ? 'block' : 'none'}; position:absolute; left:${docLayoutState.signature.x}px; top:${docLayoutState.signature.y}px; width:${docLayoutState.signature.width}px; transform:rotate(${docLayoutState.signature.rotate}deg); transform-origin:center center; cursor:move; z-index:20; user-select:none;"
                            title="Перетягніть підпис мишкою у потрібне місце">
                            <img id="doc-ed-signature-img" src="${docLayoutState.signature.dataUrl || ''}"
                                style="width:100%; height:auto; display:block; pointer-events:none;" />
                        </div>

                    </div>
                </div>

            </div>
        </div>
    `;

    const fontSelect = document.getElementById('ctrl-font-family');
    if (fontSelect) {
        fontSelect.value = docLayoutState.bodyStyle.fontFamily;
    }

    renderSignerRowsSidebarAndSheet();
    initDraggableLeftHeader();
    initDraggableSignature();
};

// ==========================================
// ПОСЛОВНЕ ТА БЛОКОВЕ ФОРМАТУВАННЯ ШРИФТІВ
// ==========================================

window.preserveCurrentSelection = function () {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const sheet = document.getElementById('a4-paper-sheet');
    if (sheet && sheet.contains(range.commonAncestorContainer)) {
        savedSelectionRange = range.cloneRange();
        const editableParent = (range.commonAncestorContainer.nodeType === 1
            ? range.commonAncestorContainer
            : range.commonAncestorContainer.parentElement
        )?.closest('[contenteditable="true"]');
        if (editableParent && editableParent.id) {
            activeEditableBlockId = editableParent.id;
        }
    }
};

window.setActiveBlockForFormatting = function (blockId) {
    activeEditableBlockId = blockId;
};

function restoreSavedSelection() {
    if (!savedSelectionRange) return false;
    const sheet = document.getElementById('a4-paper-sheet');
    if (!sheet || !sheet.contains(savedSelectionRange.commonAncestorContainer)) return false;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedSelectionRange);
    return !savedSelectionRange.collapsed;
}

function applyStyleToSelectedRange(styleProp, styleValue) {
    if (!restoreSavedSelection()) return false;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;

    const range = sel.getRangeAt(0);
    const selectedText = range.toString();
    if (!selectedText) return false;

    if (styleProp === 'bold') {
        document.execCommand('bold', false, null);
        preserveCurrentSelection();
        return true;
    }
    if (styleProp === 'italic') {
        document.execCommand('italic', false, null);
        preserveCurrentSelection();
        return true;
    }
    if (styleProp === 'underline') {
        document.execCommand('underline', false, null);
        preserveCurrentSelection();
        return true;
    }

    if (styleProp === 'align') {
        const spanAlign = document.createElement('span');
        spanAlign.style.display = 'inline-block';
        spanAlign.style.width = '100%';
        spanAlign.style.textAlign = styleValue;
        try {
            spanAlign.appendChild(range.extractContents());
            range.insertNode(spanAlign);
            sel.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNodeContents(spanAlign);
            sel.addRange(newRange);
            savedSelectionRange = newRange.cloneRange();
            return true;
        } catch (e) {
            return false;
        }
    }

    const span = document.createElement('span');
    if (styleProp === 'fontFamily') span.style.fontFamily = styleValue;
    if (styleProp === 'fontSize') span.style.fontSize = styleValue + 'pt';
    if (styleProp === 'lineHeight') span.style.lineHeight = styleValue;

    try {
        const fragment = range.extractContents();
        span.querySelectorAll?.('*').forEach(el => {
            if (styleProp === 'fontFamily') el.style.fontFamily = '';
            if (styleProp === 'fontSize') el.style.fontSize = '';
            if (styleProp === 'lineHeight') el.style.lineHeight = '';
        });
        span.appendChild(fragment);
        range.insertNode(span);

        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.addRange(newRange);
        savedSelectionRange = newRange.cloneRange();
        return true;
    } catch (e) {
        return false;
    }
}

window.applyFormattingControl = function (prop, value) {
    const appliedToSelection = applyStyleToSelectedRange(prop, value);
    if (appliedToSelection) {
        syncAllRichBlocksToState();
        return;
    }

    const targetEl = document.getElementById(activeEditableBlockId) || document.getElementById('doc-ed-body-text');
    if (!targetEl) return;

    let stateObj = docLayoutState.bodyStyle;
    if (activeEditableBlockId === 'doc-ed-left-header') stateObj = docLayoutState.leftHeader;
    else if (activeEditableBlockId === 'doc-ed-right-header') stateObj = docLayoutState.rightHeader;
    else if (activeEditableBlockId === 'doc-ed-title') stateObj = docLayoutState.docTitle;
    else if (activeEditableBlockId && activeEditableBlockId.startsWith('signer-')) stateObj = docLayoutState.signers;

    if (prop === 'fontFamily') {
        stateObj.fontFamily = value;
        targetEl.style.fontFamily = value;
        targetEl.querySelectorAll('*').forEach(el => { el.style.fontFamily = value; });
    } else if (prop === 'fontSize') {
        const num = parseFloat(value) || 14;
        stateObj.fontSize = num;
        targetEl.style.fontSize = num + 'pt';
        targetEl.querySelectorAll('*').forEach(el => { el.style.fontSize = num + 'pt'; });
    } else if (prop === 'lineHeight') {
        const num = parseFloat(value) || 1.35;
        stateObj.lineHeight = num;
        targetEl.style.lineHeight = num;
    } else if (prop === 'bold') {
        stateObj.bold = !stateObj.bold;
        targetEl.style.fontWeight = stateObj.bold ? 'bold' : 'normal';
    } else if (prop === 'italic') {
        stateObj.italic = !stateObj.italic;
        targetEl.style.fontStyle = stateObj.italic ? 'italic' : 'normal';
    } else if (prop === 'underline') {
        stateObj.underline = !stateObj.underline;
        targetEl.style.textDecoration = stateObj.underline ? 'underline' : 'none';
    } else if (prop === 'align') {
        stateObj.align = value;
        targetEl.style.textAlign = value;
        targetEl.querySelectorAll('div, p').forEach(el => { el.style.textAlign = value; });
    }

    if (stateObj === docLayoutState.signers) {
        const wrap = document.getElementById('doc-ed-signers-wrap');
        if (wrap) {
            wrap.style.fontFamily = stateObj.fontFamily;
            wrap.style.fontSize = stateObj.fontSize + 'pt';
            wrap.style.lineHeight = stateObj.lineHeight;
            wrap.style.fontWeight = stateObj.bold ? 'bold' : 'normal';
            wrap.style.fontStyle = stateObj.italic ? 'italic' : 'normal';
            wrap.style.textDecoration = stateObj.underline ? 'underline' : 'none';
        }
    }
};

function syncAllRichBlocksToState() {
    syncRichBlockToState('leftHeader');
    syncRichBlockToState('rightHeader');
    syncRichBlockToState('docTitle');
}

window.syncRichBlockToState = function (blockKey) {
    const map = {
        leftHeader: { elId: 'doc-ed-left-header', inpId: 'inp-left-header' },
        rightHeader: { elId: 'doc-ed-right-header', inpId: 'inp-right-header' },
        docTitle: { elId: 'doc-ed-title', inpId: 'inp-doc-title' }
    };
    const item = map[blockKey];
    if (!item) return;
    const el = document.getElementById(item.elId);
    if (!el) return;

    docLayoutState[blockKey].html = el.innerHTML;
    docLayoutState[blockKey].text = el.innerText;

    const inp = document.getElementById(item.inpId);
    if (inp && document.activeElement !== inp) {
        inp.value = el.innerText;
    }
};

window.updateBlockTextFromSidebar = function (blockKey, val) {
    docLayoutState[blockKey].text = val;
    docLayoutState[blockKey].html = escapeHtml(val);

    const idMap = {
        leftHeader: 'doc-ed-left-header',
        rightHeader: 'doc-ed-right-header',
        docTitle: 'doc-ed-title'
    };
    const el = document.getElementById(idMap[blockKey]);
    if (el) {
        el.innerText = val;
    }
};

window.updateBlockRotation = function (blockKey, deg) {
    if (blockKey !== 'leftHeader') return;
    const val = parseInt(deg, 10) || 0;
    docLayoutState.leftHeader.rotate = val;
    const lbl = document.getElementById('lbl-rot-left');
    if (lbl) lbl.textContent = val + '°';

    const wrap = document.getElementById('doc-ed-left-header-wrap');
    if (wrap) {
        wrap.style.transform = `translate(${docLayoutState.leftHeader.x}px, ${docLayoutState.leftHeader.y}px) rotate(${val}deg)`;
    }
};

window.resetBlockPosition = function (blockKey) {
    if (blockKey === 'leftHeader') {
        docLayoutState.leftHeader.x = 0;
        docLayoutState.leftHeader.y = 0;
        docLayoutState.leftHeader.rotate = 0;
        const wrap = document.getElementById('doc-ed-left-header-wrap');
        if (wrap) wrap.style.transform = 'translate(0px, 0px) rotate(0deg)';
        const lbl = document.getElementById('lbl-rot-left');
        if (lbl) lbl.textContent = '0°';
    }
};

// ==========================================
// СТОВПЧИК ПІДПИСАНТІВ ("ХТО ПІДПИСАВ ДОКУМЕНТ")
// ==========================================

function renderSignerRowsSidebarAndSheet() {
    const sidebarContainer = document.getElementById('signers-rows-container');
    const sheetList = document.getElementById('doc-ed-signers-list');
    if (!sidebarContainer || !sheetList) return;

    const rows = docLayoutState.signers.rows;

    sidebarContainer.innerHTML = rows.map((row, idx) => `
        <div style="background:#ffffff; border:1px solid #fcd34d; border-radius:6px; padding:8px; display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:11px; color:#b45309; font-weight:700;">Підписант №${idx + 1}</span>
                ${rows.length > 1 ? `
                    <button type="button" onclick="removeSignerRow(${idx})"
                        style="background:#ef4444; color:#fff; border:none; border-radius:4px; padding:2px 7px; cursor:pointer; font-size:11px;">
                        ✕ Видалити
                    </button>
                ` : ''}
            </div>
            <input type="text" placeholder="Посада / звання" value="${escapeHtml(row.role)}"
                oninput="updateSignerRowField(${idx}, 'role', this.value)"
                style="width:100%; box-sizing:border-box; background:#f8fafc; color:#0f172a; border:1px solid #cbd5e1; border-radius:4px; padding:6px 8px; font-size:12px;" />
            <input type="text" placeholder="Ім'я ПРІЗВИЩЕ" value="${escapeHtml(row.name)}"
                oninput="updateSignerRowField(${idx}, 'name', this.value)"
                style="width:100%; box-sizing:border-box; background:#f8fafc; color:#0f172a; border:1px solid #cbd5e1; border-radius:4px; padding:6px 8px; font-size:12px; font-weight:700;" />
        </div>
    `).join('');

    sheetList.innerHTML = rows.map((row, idx) => `
        <div style="display:grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap:16px; align-items:end; width:100%; max-width:100%; box-sizing:border-box; margin-bottom:10px;">
            <div id="signer-role-${idx}"
                contenteditable="true"
                onfocus="setActiveBlockForFormatting('signer-role-${idx}')"
                onmouseup="preserveCurrentSelection()"
                onkeyup="preserveCurrentSelection(); syncSignerCellFromSheet(${idx}, 'role', this)"
                style="outline:none; text-align:left; word-break:break-word; overflow-wrap:anywhere;">${row.roleHtml || escapeHtml(row.role)}</div>
            <div id="signer-name-${idx}"
                contenteditable="true"
                onfocus="setActiveBlockForFormatting('signer-name-${idx}')"
                onmouseup="preserveCurrentSelection()"
                onkeyup="preserveCurrentSelection(); syncSignerCellFromSheet(${idx}, 'name', this)"
                style="outline:none; text-align:right; word-break:break-word; overflow-wrap:anywhere;">${row.nameHtml || escapeHtml(row.name)}</div>
        </div>
    `).join('');
}

window.addSignerRow = function () {
    docLayoutState.signers.rows.push({
        role: 'Посада / звання',
        name: 'Ім\'я ПРІЗВИЩЕ',
        roleHtml: '',
        nameHtml: ''
    });
    renderSignerRowsSidebarAndSheet();
};

window.removeSignerRow = function (idx) {
    if (docLayoutState.signers.rows.length <= 1) return;
    docLayoutState.signers.rows.splice(idx, 1);
    renderSignerRowsSidebarAndSheet();
};

window.updateSignerRowField = function (idx, field, val) {
    const row = docLayoutState.signers.rows[idx];
    if (!row) return;
    row[field] = val;
    row[field + 'Html'] = escapeHtml(val);

    const cell = document.getElementById(`signer-${field}-${idx}`);
    if (cell) {
        cell.innerText = val;
    }
};

window.syncSignerCellFromSheet = function (idx, field, el) {
    const row = docLayoutState.signers.rows[idx];
    if (!row || !el) return;
    row[field] = el.innerText;
    row[field + 'Html'] = el.innerHTML;
};

// ==========================================
// ПЕРЕТЯГУВАННЯ ЛІВОЇ ШАПКИ ТА ПІДПИСУ МИШКОЮ
// ==========================================

function initDraggableLeftHeader() {
    const handle = document.getElementById('doc-ed-left-header-handle');
    const wrap = document.getElementById('doc-ed-left-header-wrap');
    if (!handle || !wrap) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let origX = 0;
    let origY = 0;

    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        origX = docLayoutState.leftHeader.x || 0;
        origY = docLayoutState.leftHeader.y || 0;
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        docLayoutState.leftHeader.x = origX + dx;
        docLayoutState.leftHeader.y = origY + dy;
        wrap.style.transform = `translate(${docLayoutState.leftHeader.x}px, ${docLayoutState.leftHeader.y}px) rotate(${docLayoutState.leftHeader.rotate}deg)`;
    });

    document.addEventListener('mouseup', () => {
        dragging = false;
    });
}

function initDraggableSignature() {
    const sigBox = document.getElementById('doc-ed-signature-floating');
    const sheet = document.getElementById('a4-paper-sheet');
    if (!sigBox || !sheet) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;

    sigBox.addEventListener('mousedown', (e) => {
        e.preventDefault();
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        origLeft = docLayoutState.signature.x || 0;
        origTop = docLayoutState.signature.y || 0;
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        docLayoutState.signature.x = origLeft + dx;
        docLayoutState.signature.y = origTop + dy;
        sigBox.style.left = docLayoutState.signature.x + 'px';
        sigBox.style.top = docLayoutState.signature.y + 'px';
    });

    document.addEventListener('mouseup', () => {
        dragging = false;
    });
}

// ==========================================
// ОБРОБКА ПІДПИСУ: АВТОМАТИЧНЕ ВИДАЛЕННЯ ФОНУ ТА ЗМІНА КОЛЬОРУ
// ==========================================

window.handleSignatureFileUpload = function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        docLayoutState.signature.originalDataUrl = e.target.result;
        processSignatureImageWithColorAndTransparency();
    };
    reader.readAsDataURL(file);
};

function processSignatureImageWithColorAndTransparency() {
    const src = docLayoutState.signature.originalDataUrl;
    if (!src) return;

    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const mode = docLayoutState.signature.colorMode || 'original';
        const threshold = docLayoutState.signature.threshold || 215;

        let targetR = 0, targetG = 51, targetB = 204;
        if (mode !== 'original' && mode.startsWith('#')) {
            targetR = parseInt(mode.slice(1, 3), 16);
            targetG = parseInt(mode.slice(3, 5), 16);
            targetB = parseInt(mode.slice(5, 7), 16);
        }

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const brightness = (r + g + b) / 3;

            if (brightness > threshold) {
                data[i + 3] = 0;
            } else if (mode !== 'original') {
                data[i] = targetR;
                data[i + 1] = targetG;
                data[i + 2] = targetB;
                data[i + 3] = Math.min(255, Math.round((255 - brightness) * 1.6));
            }
        }

        ctx.putImageData(imgData, 0, 0);
        const processedUrl = canvas.toDataURL('image/png');
        docLayoutState.signature.dataUrl = processedUrl;

        const sigBox = document.getElementById('doc-ed-signature-floating');
        const sigImg = document.getElementById('doc-ed-signature-img');
        if (sigBox && sigImg) {
            sigImg.src = processedUrl;
            sigBox.style.display = 'block';
        }
    };
    img.src = src;
}

window.changeSignatureColor = function (colorMode) {
    docLayoutState.signature.colorMode = colorMode;
    if (docLayoutState.signature.originalDataUrl) {
        processSignatureImageWithColorAndTransparency();
    }
};

window.updateSignatureSize = function (widthPx) {
    const w = parseInt(widthPx, 10) || 160;
    docLayoutState.signature.width = w;
    const lbl = document.getElementById('lbl-sig-width');
    if (lbl) lbl.textContent = w + 'px';
    const sigBox = document.getElementById('doc-ed-signature-floating');
    if (sigBox) sigBox.style.width = w + 'px';
};

window.updateSignatureRotation = function (deg) {
    const r = parseInt(deg, 10) || 0;
    docLayoutState.signature.rotate = r;
    const lbl = document.getElementById('lbl-sig-rot');
    if (lbl) lbl.textContent = r + '°';
    const sigBox = document.getElementById('doc-ed-signature-floating');
    if (sigBox) sigBox.style.transform = `rotate(${r}deg)`;
};

window.removeSignatureImage = function () {
    docLayoutState.signature.dataUrl = '';
    docLayoutState.signature.originalDataUrl = '';
    const sigBox = document.getElementById('doc-ed-signature-floating');
    if (sigBox) sigBox.style.display = 'none';
};

// ==========================================
// ЗБЕРЕЖЕННЯ, ДРУК ТА ВИДАЛЕННЯ ДОКУМЕНТА
// ==========================================

window.saveCurrentDocumentFromEditor = function () {
    if (!currentEditingDocId) return;
    const docs = getSavedDocumentsList();
    const doc = docs.find(d => d.id === currentEditingDocId);
    if (!doc) return;

    const nameInp = document.getElementById('doc-editor-name-input');
    const bodyEl = document.getElementById('doc-ed-body-text');
    syncAllRichBlocksToState();

    if (nameInp && nameInp.value.trim()) {
        doc.name = nameInp.value.trim();
        doc.title = doc.name;
    }
    if (bodyEl) {
        doc.content = bodyEl.innerText;
        doc.bodyHtml = bodyEl.innerHTML;
    }

    doc.layout = JSON.parse(JSON.stringify(docLayoutState));
    doc.date = new Date().toLocaleDateString('uk-UA');

    saveDocumentsList(docs);
    renderDocumentsMainView();
    openDocumentEditorModal(currentEditingDocId);
};

window.closeDocumentEditorWorkspace = function () {
    const ws = document.getElementById('doc-editor-workspace');
    if (ws) ws.style.display = 'none';
    currentEditingDocId = null;
};

window.printCurrentA4Document = function () {
    const sheet = document.getElementById('a4-paper-sheet');
    if (!sheet) return;

    const clone = sheet.cloneNode(true);
    const handle = clone.querySelector('#doc-ed-left-header-handle');
    if (handle) handle.remove();

    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) return;

    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Друк документа А4</title>
            <style>
                @page { size: A4; margin: 0; }
                body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; }
                #a4-paper-sheet { box-shadow: none !important; margin: 0 !important; }
            </style>
        </head>
        <body>${clone.outerHTML}</body>
        </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
        win.print();
    }, 350);
};

window.deleteDocumentById = async function (docId) {
    const docs = getSavedDocumentsList();
    const target = docs.find(d => d.id === docId);
    if (!target) return;
    if (!confirm(`Видалити документ «${target.name || target.title}»?`)) return;

    await deleteDocBinaryFromIDB(docId);
    saveDocumentsList(docs.filter(d => d.id !== docId));
    renderDocumentsMainView();
};

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(setupDocumentsRoleWatcher, 100);
    });
} else {
    setTimeout(setupDocumentsRoleWatcher, 100);
}
setInterval(syncDocumentsButtonVisibility, 600);