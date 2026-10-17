// ==========================================
// ДОПОМІЖНІ СКРИПТИ ТА УТИЛІТИ (utils.js)
// ==========================================

document.addEventListener("mouseover", function(e) {
    const td = e.target.closest('td');
    if (td && td.textContent.trim() !== '') {
        if (!td.getAttribute('title')) {
            td.setAttribute('title', td.textContent.trim());
        }
    }
});

// ==========================================
// ФУНКЦІЇ ДОДАВАННЯ АВТОМОБІЛІВ З КАТЕГОРІЯМИ ТА ФОРМУЛАМИ
// ==========================================

function tryAddCarRow() {
    if (typeof currentRole !== 'undefined' && (currentRole === 'developer' || currentRole === 'admin')) {
        promptAndAddCar();
    } else if (typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn) {
        promptAndAddCar();
    } else {
        if (typeof showCustomPasswordModal === 'function') {
            showCustomPasswordModal((pass) => {
                if (pass === "02031985" || pass === "4343") {
                    promptAndAddCar();
                } else if (pass !== null) {
                    alert("Неправильний пароль!");
                }
            });
        } else {
            promptAndAddCar();
        }
    }
}

function promptAndAddCar() {
    if (typeof VEHICLE_CATEGORIES === 'undefined') {
        alert("Помилка: об'єкт категорій VEHICLE_CATEGORIES не знайдено!");
        return;
    }

    let catKeys = Object.keys(VEHICLE_CATEGORIES);
    let menuText = "Оберіть категорію для нового автомобіля (введіть номер):\n\n";
    
    catKeys.forEach((key, index) => {
        menuText += `${index + 1}. ${VEHICLE_CATEGORIES[key]}\n`;
    });

    let choice = prompt(menuText, "1");
    if (choice === null) return;

    let index = parseInt(choice, 10) - 1;
    if (isNaN(index) || index < 0 || index >= catKeys.length) {
        alert("Невірний вибір категорії! Спробуйте ще раз.");
        return;
    }

    let selectedKey = catKeys[index];
    let selectedCategoryName = VEHICLE_CATEGORIES[selectedKey];

    let vehicleTypeUA = "легковий";
    const upperKey = selectedKey.toUpperCase();
    if (upperKey === "TRUCK" || upperKey === "MINIBUS" || upperKey === "SPECIAL" || upperKey === "ADBLUE") {
        vehicleTypeUA = "вантажний";
    } else if (upperKey === "MOTORCYCLE") {
        vehicleTypeUA = "мотоцикл";
    } else if (upperKey === "QUAD") {
        vehicleTypeUA = "квадроцикл";
    }

    executeAddCarWithCategory(selectedKey, vehicleTypeUA, selectedCategoryName);
}

function executeAddCarWithCategory(categoryKey, vehicleTypeStr, categoryDisplayName) {
    if (typeof carsData === 'undefined') {
        window.carsData = [];
    }

    const newId = carsData.length > 0 ? Math.max(...carsData.map(i => Number(i.id) || 0)) + 1 : 1;
    const upperKey = categoryKey.toUpperCase();

    let assignedFormulas = [1, 2, 3, 4];
    if (upperKey === 'TRUCK' || upperKey === 'SPECIAL' || upperKey === 'ADBLUE' || upperKey === 'MINIBUS') {
        assignedFormulas = [5, 1, 2, 3, 6, 7]; 
    } else if (upperKey === 'MOTORCYCLE') {
        assignedFormulas = [8, 9];
    } else if (upperKey === 'QUAD') {
        assignedFormulas = [8];
    }

    const hasAdBlueFlag = (upperKey === 'ADBLUE');

    const newCar = {
        id: newId,
        plate: "NEW 0000",
        model: `Новий авто (${categoryDisplayName})`,
        subdivision: "РМТЗ",
        consumption: (upperKey === 'MOTORCYCLE' || upperKey === 'QUAD') ? 4.0 : (vehicleTypeStr === 'вантажний' ? 25.0 : 10.0),
        fuelType: "ДП",
        note: "",
        vin: "",
        year: 2024,
        transmission: "автомат",
        tankCapacity: vehicleTypeStr === 'вантажний' ? 200 : 60,
        drive: "повний",
        emptyWeight: vehicleTypeStr === 'вантажний' ? 7500 : 1800,
        totalWeight: vehicleTypeStr === 'вантажний' ? 14000 : 2500,
        gears: 6,
        engineVolume: 2000,
        kw: 110,
        engineNo: "",
        driver: "Водій",
        category: categoryKey.toLowerCase(),
        vehicleType: vehicleTypeStr,     
        hasAdBlue: hasAdBlueFlag,
        isMiles: upperKey === 'MILES',
        formulas: assignedFormulas
    };

    carsData.push(newCar);

    if (typeof saveCarsToStorage === 'function') {
        saveCarsToStorage();
    }
    if (typeof saveCarsModificationsToStorage === 'function') {
        saveCarsModificationsToStorage();
    }
    if (typeof renderCarsTable === 'function') {
        renderCarsTable();
    }

    alert(`Автомобіль успішно додано до категорії: "${categoryDisplayName}"!`);
}

// ==========================================
// УПРАВЛІННЯ КАТЕГОРІЄЮ У ЗВІТАХ ТА МАРШРУТАХ
// ==========================================

function initCategorySelects() {
    if (typeof ensureCategoryDropdownsPopulated === 'function') {
        ensureCategoryDropdownsPopulated();
        return;
    }

    const selectDet = document.getElementById('det-input-category');
    if (selectDet && typeof VEHICLE_CATEGORIES !== 'undefined' && selectDet.options.length === 0) {
        for (let key in VEHICLE_CATEGORIES) {
            let opt = document.createElement('option');
            opt.value = key.toLowerCase();
            opt.textContent = VEHICLE_CATEGORIES[key];
            selectDet.appendChild(opt);
        }
    }

    const selectCard = document.getElementById('card-input-category');
    if (selectCard && typeof VEHICLE_CATEGORIES !== 'undefined' && selectCard.options.length === 0) {
        for (let key in VEHICLE_CATEGORIES) {
            let opt = document.createElement('option');
            opt.value = key.toLowerCase();
            opt.textContent = VEHICLE_CATEGORIES[key];
            selectCard.appendChild(opt);
        }
    }
}

function updateCardCarCategory(newCategoryKey) {
    const targetId = (typeof currentCarId !== 'undefined' && currentCarId) ? currentCarId : null;
    if (!targetId) return;

    const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
    const car = sourceCars.find(c => Number(c.id) === Number(targetId));
    if (!car) return;

    applyCategoryChangesToCar(car, newCategoryKey);

    if (typeof loadCarCard === 'function') {
        loadCarCard(car.id);
    }
}

function applyCategoryChangesToCar(car, newCategoryKey) {
    if (!car || !newCategoryKey) return;
    car.category = newCategoryKey.toLowerCase();
    const upperKey = newCategoryKey.toUpperCase();

    let assignedFormulas = [1, 2, 3, 4];
    let vehicleTypeUA = "легковий";

    if (upperKey === 'TRUCK' || upperKey === 'SPECIAL' || upperKey === 'ADBLUE' || upperKey === 'MINIBUS') {
        assignedFormulas = [5, 1, 2, 3, 6, 7];
        vehicleTypeUA = "вантажний";
    } else if (upperKey === 'MOTORCYCLE') {
        assignedFormulas = [8, 9];
        vehicleTypeUA = "мотоцикл";
    } else if (upperKey === 'QUAD') {
        assignedFormulas = [8];
        vehicleTypeUA = "квадроцикл";
    }

    car.formulas = assignedFormulas;
    car.vehicleType = vehicleTypeUA;
    car.hasAdBlue = (upperKey === 'ADBLUE');
    car.isMiles = (upperKey === 'MILES');

    // Оновлюємо відображення панелі AdBlue, якщо це авто зараз відкрите в Картці
    if (typeof currentCarId !== 'undefined' && Number(currentCarId) === Number(car.id)) {
        const abBox = document.getElementById('adblue-panel-box');
        if (abBox) abBox.style.display = car.hasAdBlue ? 'block' : 'none';
        if (typeof updateRouteTotals === 'function') {
            try { updateRouteTotals(); } catch (e) {}
        }
    }

    if (typeof saveCarsToStorage === 'function') {
        saveCarsToStorage();
    }
    if (typeof saveCarsModificationsToStorage === 'function') {
        saveCarsModificationsToStorage();
    }
    if (typeof renderCarsTable === 'function') {
        renderCarsTable();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initCategorySelects();

    // Автоматично синхронізуємо дані Картки авто при її відкритті
    if (typeof window.loadCarCard === 'function' && !window._categoryCardSyncHooked) {
        window._categoryCardSyncHooked = true;
        const origLoadCard = window.loadCarCard;
        window.loadCarCard = function(carId) {
            initCategorySelects();
            origLoadCard.apply(this, arguments);
            const sourceCars = typeof carsData !== 'undefined' ? carsData : [];
            const car = sourceCars.find(c => Number(c.id) === Number(carId));
            if (car) {
                const resolved = (typeof resolveCarCategoryKey === 'function') ? resolveCarCategoryKey(car) : (car.category || 'passenger');
                const cardCatSelect = document.getElementById('card-input-category');
                if (cardCatSelect) cardCatSelect.value = resolved;

                const specCat = document.getElementById('spec-category');
                if (specCat) {
                    specCat.textContent = (typeof window.getCarCategoryDisplayName === 'function')
                        ? window.getCarCategoryDisplayName(car)
                        : ((typeof VEHICLE_CATEGORIES !== 'undefined' && VEHICLE_CATEGORIES[resolved.toUpperCase()]) || car.category || 'Легкові автомобілі');
                }

                const specSub = document.getElementById('spec-subdivision');
                if (specSub) {
                    specSub.textContent = car.subdivision || '—';
                }

                const specFuel = document.getElementById('spec-fuel-type');
                if (specFuel) {
                    specFuel.textContent = car.fuelType || car.fuel || 'ДП';
                }
            }
        };
    }
});

// ==========================================
// УНІВЕРСАЛЬНИЙ МОДАЛЬНИЙ ПЕРЕГЛЯДАЧ БУДЬ-ЯКИХ ФАЙЛІВ ТА ДОКУМЕНТІВ
// ==========================================

function dataURItoBlob(dataURI) {
    try {
        var parts = dataURI.split(',');
        var byteString = atob(parts[1]);
        var mimeString = parts[0].split(':')[1].split(';')[0];
        var ab = new ArrayBuffer(byteString.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], { type: mimeString });
    } catch(e) {
        return null;
    }
}

function dataURIToArrayBuffer(dataURI) {
    try {
        var base64 = dataURI.split(',')[1];
        var binaryString = atob(base64);
        var len = binaryString.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    } catch(e) {
        return null;
    }
}

window.openUniversalFilePreviewModal = async function(fileInfo) {
    if (!fileInfo) return;

    let existing = document.getElementById('universal-file-preview-modal');
    if (existing) {
        // Очищаємо blob-URL якщо був створений
        if (existing._pdfBlobUrl) {
            try { URL.revokeObjectURL(existing._pdfBlobUrl); } catch(e) {}
        }
        existing.remove();
    }

    const fileName = fileInfo.name || fileInfo.originalFileName || 'Документ';
    const ext = (fileInfo.ext || (fileName.includes('.') ? fileName.split('.').pop() : '') || 'файл').toLowerCase();
    const dataUrl = fileInfo.dataUrl || fileInfo.fileDataUrl || '';
    const size = fileInfo.size || '';
    const date = fileInfo.date || '';

    const isImage = (dataUrl && dataUrl.startsWith('data:image/')) || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'jfif', 'bmp', 'ico'].includes(ext);
    const isPdf = ext === 'pdf' || (dataUrl && dataUrl.startsWith('data:application/pdf'));
    const isWord = ['doc', 'docx', 'rtf'].includes(ext);
    const isExcel = ['xlsx', 'xls', 'csv', 'tsv'].includes(ext);
    const isText = ['txt', 'html', 'json', 'log', 'xml', 'md'].includes(ext);
    const isAudio = ['mp3', 'wav', 'ogg', 'm4a'].includes(ext);
    const isVideo = ['mp4', 'webm', 'mov'].includes(ext);

    let contentHtml = '';
    let pdfBlobUrl = null;

    // 1. ЗОБРАЖЕННЯ
    if (isImage) {
        contentHtml = `
            <div style="display:flex; flex-direction:column; height:100%; width:100%;">
                <div style="display:flex; justify-content:center; align-items:center; gap:8px; padding:8px; background:#1e293b; border-bottom:1px solid #334155; flex-wrap:wrap;">
                    <span style="color:#94a3b8; font-size:12px; margin-right:6px;">Масштаб & Орієнтація:</span>
                    <button type="button" onclick="previewImageZoom(-0.2)" style="background:#334155; color:white; border:none; padding:4px 10px; border-radius:4px; font-weight:bold; cursor:pointer;" title="Зменшити">−</button>
                    <span id="img-zoom-val" style="color:#f8fafc; font-size:12px; font-weight:bold; min-width:45px; text-align:center;">100%</span>
                    <button type="button" onclick="previewImageZoom(0.2)" style="background:#334155; color:white; border:none; padding:4px 10px; border-radius:4px; font-weight:bold; cursor:pointer;" title="Збільшити">+</button>
                    <button type="button" onclick="previewImageReset()" style="background:#334155; color:white; border:none; padding:4px 10px; border-radius:4px; font-size:11px; cursor:pointer;">100%</button>
                    <button type="button" onclick="previewImageRotate()" style="background:#334155; color:white; border:none; padding:4px 10px; border-radius:4px; font-size:11px; cursor:pointer;">🔄 Повернути 90°</button>
                    <button type="button" onclick="toggleImgBg()" style="background:#334155; color:white; border:none; padding:4px 10px; border-radius:4px; font-size:11px; cursor:pointer;">🌓 Фон</button>
                </div>
                <div id="img-container-wrapper" style="flex:1; overflow:auto; display:flex; justify-content:center; align-items:center; background:#0f172a; padding:20px; transition:background 0.2s;">
                    <img id="universal-preview-img" src="${dataUrl}" alt="${fileName}" style="max-width:95%; max-height:78vh; object-fit:contain; border-radius:4px; box-shadow:0 8px 30px rgba(0,0,0,0.5); transform-origin:center center; transition:transform 0.15s ease-out;" />
                </div>
            </div>
        `;
    }
    // 2. PDF ДОКУМЕНТ
    else if (isPdf) {
        if (dataUrl) {
            const blob = dataURItoBlob(dataUrl);
            if (blob) {
                pdfBlobUrl = URL.createObjectURL(blob);
            }
        }
        const activePdfUrl = pdfBlobUrl || dataUrl;

        contentHtml = `
            <div style="display:flex; flex-direction:column; height:100%; width:100%;">
                <div style="background:#334155; color:#cbd5e1; padding:6px 14px; font-size:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <span>📄 Перегляд оригінального PDF документа: <strong>${fileName}</strong></span>
                    <div style="display:flex; gap:6px;">
                        ${activePdfUrl ? `
                            <a href="${activePdfUrl}" target="_blank" rel="noopener noreferrer" style="background:#0284c7; color:white; text-decoration:none; padding:4px 10px; border-radius:4px; font-weight:bold; font-size:11px;">
                                ⛶ На весь екран
                            </a>
                        ` : ''}
                    </div>
                </div>
                <div style="flex:1; width:100%; height:100%; position:relative; background:#525659;">
                    ${activePdfUrl ? `
                        <iframe src="${activePdfUrl}#view=FitH&toolbar=1" style="width:100%; height:100%; min-height:75vh; border:none; background:#525659;" allowfullscreen title="${fileName}"></iframe>
                    ` : `
                        <div style="padding:40px; text-align:center; color:#fff;">
                            <p style="font-size:16px;">PDF-документ готовий. Натисніть кнопку «📥 Скачати» вгорі для збереження або перегляду.</p>
                        </div>
                    `}
                </div>
            </div>
        `;
    }
    // 3. ДОКУМЕНТИ WORD (.DOCX, .DOC, .RTF)
    else if (isWord) {
        let richHtml = fileInfo.bodyHtml || '';
        let extractedPlain = fileInfo.content || '';

        // Якщо маємо dataUrl, пробуємо витягнути максимальний HTML
        if (!richHtml && dataUrl) {
            const arrayBuffer = dataURIToArrayBuffer(dataUrl);
            if (arrayBuffer && ext === 'docx') {
                if (typeof window.mammoth !== 'undefined' && window.mammoth.convertToHtml) {
                    try {
                        const mRes = await window.mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
                        if (mRes && mRes.value) {
                            richHtml = mRes.value;
                        }
                    } catch(e) {}
                }
                if (!richHtml && typeof extractDocxRichHtmlAndText === 'function') {
                    try {
                        const parsed = await extractDocxRichHtmlAndText(arrayBuffer);
                        if (parsed) {
                            richHtml = parsed.html || '';
                            if (!extractedPlain) extractedPlain = parsed.text || '';
                        }
                    } catch(e) {}
                }
            } else if (arrayBuffer && ext === 'doc' && typeof extractDocBinaryText === 'function') {
                extractedPlain = extractDocBinaryText(arrayBuffer);
            }
        }

        const bodyContent = richHtml || (extractedPlain ? extractedPlain.replace(/\n/g, '<br>') : '');

        contentHtml = `
            <div style="padding:15px; overflow-y:auto; height:100%; box-sizing:border-box;">
                <div style="background:#ffffff; max-width:880px; margin:0 auto; padding:45px 55px; border-radius:6px; box-shadow:0 8px 30px rgba(0,0,0,0.12); min-height:80vh; font-family:'Times New Roman', 'Liberation Serif', serif; font-size:14pt; line-height:1.55; color:#0f172a; border:1px solid #cbd5e1;">
                    <div style="border-bottom:2px solid #1e3a8a; padding-bottom:12px; margin-bottom:28px; display:flex; justify-content:space-between; align-items:center; font-family:Arial, sans-serif;">
                        <div>
                            <span style="background:#dbeafe; color:#1e40af; font-weight:bold; font-size:12px; padding:3px 10px; border-radius:4px; border:1px solid #bfdbfe; text-transform:uppercase;">
                                📘 Документ Microsoft Word (.${ext.toUpperCase()})
                            </span>
                            <h2 style="margin:8px 0 0 0; color:#0f172a; font-size:18px; font-weight:800;">${fileName}</h2>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:11px; color:#64748b; display:block;">Оригінальний формат</span>
                            <button type="button" onclick="copyDocumentBodyText()" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; border-radius:4px; padding:3px 8px; font-size:11px; cursor:pointer; margin-top:4px; font-weight:600;">
                                📋 Копіювати текст
                            </button>
                        </div>
                    </div>
                    <div id="word-doc-body-container" style="word-break:break-word; min-height:350px;">
                        ${bodyContent || '<p style="color:#64748b; font-style:italic;">Текстовий вміст документа відображено. Для роботи з оригінальним форматуванням у MS Word скористайтесь кнопкою «📥 Скачати» вгорі.</p>'}
                    </div>
                </div>
            </div>
        `;
    }
    // 4. ТАБЛИЦІ EXCEL ТА CSV (.XLSX, .XLS, .CSV, .TSV)
    else if (isExcel) {
        let excelParsedHtml = '';
        let sheetTabsHtml = '';
        let totalRows = 0;

        // Якщо маємо XLSX бібліотеку і dataUrl
        if (dataUrl && typeof window.XLSX !== 'undefined' && (ext === 'xlsx' || ext === 'xls')) {
            try {
                const arrayBuffer = dataURIToArrayBuffer(dataUrl);
                if (arrayBuffer) {
                    const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
                    window._currentPreviewWorkbook = workbook;

                    const sheetNames = workbook.SheetNames || [];
                    if (sheetNames.length > 0) {
                        sheetTabsHtml = sheetNames.map((name, idx) => `
                            <button type="button" class="excel-sheet-tab-btn ${idx === 0 ? 'active' : ''}" onclick="switchPreviewExcelSheet('${escapeHtml(name)}', this)"
                                style="background:${idx === 0 ? '#15803d' : '#334155'}; color:white; border:none; padding:5px 12px; border-radius:4px 4px 0 0; font-size:12px; font-weight:bold; cursor:pointer;">
                                📊 ${escapeHtml(name)}
                            </button>
                        `).join('');

                        const firstSheet = workbook.Sheets[sheetNames[0]];
                        excelParsedHtml = window.XLSX.utils.sheet_to_html(firstSheet, {
                            header: '',
                            footer: '',
                            editable: false
                        });
                    }
                }
            } catch(e) {
                console.error('Помилка парсингу Excel:', e);
            }
        } else if (ext === 'csv' || ext === 'tsv' || !excelParsedHtml) {
            let csvText = fileInfo.content || '';
            if (!csvText && dataUrl) {
                try {
                    const base64 = dataUrl.split(',')[1];
                    csvText = decodeURIComponent(escape(atob(base64)));
                } catch(e) {
                    try { csvText = atob(dataUrl.split(',')[1]); } catch(e2) {}
                }
            }
            if (csvText) {
                const lines = csvText.trim().split(/\r?\n/);
                totalRows = lines.length;
                const delimiter = ext === 'tsv' ? '\t' : (lines[0].includes(';') ? ';' : ',');
                
                let tHtml = '<table style="width:100%; border-collapse:collapse; font-size:13px; color:#1e293b; background:#fff;">';
                lines.forEach((line, rIdx) => {
                    const cells = line.split(delimiter);
                    const tag = rIdx === 0 ? 'th' : 'td';
                    const bg = rIdx === 0 ? '#15803d' : (rIdx % 2 === 0 ? '#ffffff' : '#f8fafc');
                    const color = rIdx === 0 ? '#ffffff' : '#1e293b';
                    tHtml += `<tr style="background:${bg}; color:${color};">`;
                    cells.forEach((c) => {
                        tHtml += `<${tag} style="border:1px solid #cbd5e1; padding:6px 10px; text-align:left; font-weight:${rIdx === 0 ? 'bold' : 'normal'};">${escapeHtml(c.trim())}</${tag}>`;
                    });
                    tHtml += `</tr>`;
                });
                tHtml += '</table>';
                excelParsedHtml = tHtml;
            }
        }

        contentHtml = `
            <div style="display:flex; flex-direction:column; height:100%; width:100%;">
                <div style="background:#14532d; color:white; padding:8px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:16px;">📊</span>
                        <strong style="font-size:13px;">Таблиця Excel / CSV: ${fileName}</strong>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="text" id="excel-search-input" placeholder="🔍 Пошук по клітинках..." oninput="filterExcelPreviewTable(this.value)"
                            style="background:#ffffff; color:#0f172a; border:none; border-radius:4px; padding:4px 8px; font-size:12px; width:180px;" />
                        <button type="button" onclick="copyExcelTableHtml()" style="background:#16a34a; color:white; border:none; padding:4px 10px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">
                            📋 Копіювати
                        </button>
                    </div>
                </div>
                ${sheetTabsHtml ? `
                    <div style="background:#1e293b; padding:6px 16px 0 16px; display:flex; gap:6px; border-bottom:2px solid #15803d; overflow-x:auto;">
                        ${sheetTabsHtml}
                    </div>
                ` : ''}
                <div id="excel-table-container" style="flex:1; overflow:auto; background:#ffffff; padding:12px;">
                    ${excelParsedHtml || '<p style="padding:20px; color:#64748b; text-align:center;">Файл таблиці завантажено. Скористайтесь кнопкою «📥 Скачати» вгорі для відкриття в Excel.</p>'}
                </div>
            </div>
        `;
    }
    // 5. ТЕКСТОВІ ФАЙЛИ (.TXT, .JSON, .XML, .LOG, .HTML, .MD)
    else if (isText) {
        let textContent = fileInfo.content || '';
        if (!textContent && dataUrl) {
            try {
                const base64 = dataUrl.split(',')[1];
                textContent = decodeURIComponent(escape(atob(base64)));
            } catch(e) {
                try { textContent = atob(dataUrl.split(',')[1]); } catch(e2) {}
            }
        }
        contentHtml = `
            <div style="padding:15px; height:100%; box-sizing:border-box; display:flex; flex-direction:column;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-size:12px; color:#475569; font-weight:bold;">📄 Текстовий вміст файлу:</span>
                    <button type="button" onclick="copyDocumentBodyText()" style="background:#2563eb; color:white; border:none; padding:4px 10px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">
                        📋 Копіювати весь текст
                    </button>
                </div>
                <div id="word-doc-body-container" style="flex:1; background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; padding:20px; font-family:Consolas, Monaco, monospace; font-size:13px; line-height:1.6; white-space:pre-wrap; word-break:break-word; color:#0f172a; overflow:auto; box-shadow:inset 0 1px 4px rgba(0,0,0,0.05);">
                    ${escapeHtml(textContent || 'Текст відсутній або файл порожній')}
                </div>
            </div>
        `;
    }
    // 6. АУДІО
    else if (isAudio) {
        contentHtml = `
            <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100%; gap:20px; padding:40px;">
                <div style="font-size:64px;">🎵</div>
                <div style="font-weight:bold; font-size:18px; color:#0f172a;">${fileName}</div>
                <audio controls src="${dataUrl}" style="width:100%; max-width:550px;"></audio>
            </div>
        `;
    }
    // 7. ВІДЕО
    else if (isVideo) {
        contentHtml = `
            <div style="display:flex; justify-content:center; align-items:center; height:100%; padding:20px; background:#000;">
                <video controls src="${dataUrl}" style="max-width:100%; max-height:80vh; border-radius:6px; box-shadow:0 8px 30px rgba(0,0,0,0.5);"></video>
            </div>
        `;
    }
    // 8. БУДЬ-ЯКІ ІНШІ ФАЙЛИ
    else {
        contentHtml = `
            <div style="background:#ffffff; max-width:620px; margin:50px auto; padding:40px; border-radius:12px; text-align:center; box-shadow:0 8px 30px rgba(0,0,0,0.1); border:1px solid #e2e8f0;">
                <div style="font-size:60px; margin-bottom:15px;">📁</div>
                <h3 style="color:#0f172a; margin:0 0 10px 0; font-size:20px; font-weight:800;">${fileName}</h3>
                <p style="color:#64748b; font-size:14px; margin-bottom:25px;">
                    Файл формату <strong>.${ext.toUpperCase()}</strong> (${size || 'оригінальний файл'}) готовий для відкриття та завантаження на ваш пристрій.
                </p>
                <button onclick="downloadUniversalFile('${encodeURIComponent(dataUrl)}', '${encodeURIComponent(fileName)}')"
                    style="background:#059669; color:white; border:none; padding:12px 28px; border-radius:8px; font-size:15px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:8px; box-shadow:0 4px 14px rgba(5,150,105,0.3);">
                    📥 Скачати файл (${ext.toUpperCase()})
                </button>
            </div>
        `;
    }

    const modal = document.createElement('div');
    modal.id = 'universal-file-preview-modal';
    modal._pdfBlobUrl = pdfBlobUrl;
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15, 23, 42, 0.88); backdrop-filter:blur(4px); z-index:999999; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:14px; box-sizing:border-box;';

    modal.innerHTML = `
        <div style="background:#f8fafc; border-radius:12px; width:96vw; max-width:1250px; height:92vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 25px 60px rgba(0,0,0,0.6); border:1px solid #475569;">
            <!-- ШАПКА ВІКНА ПЕРЕГЛЯДУ -->
            <div style="background:#1e293b; color:white; padding:12px 20px; display:flex; justify-content:space-between; align-items:center; flex-shrink:0; border-bottom:1px solid #334155;">
                <div style="display:flex; align-items:center; gap:10px; overflow:hidden;">
                    <span style="font-size:20px;">📄</span>
                    <strong style="font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:600px;" title="${fileName}">${fileName}</strong>
                    <span style="background:#2563eb; color:white; padding:3px 9px; border-radius:5px; font-size:11px; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px;">
                        ${ext.toUpperCase() || 'ФАЙЛ'}
                    </span>
                    ${size ? `<span style="font-size:12px; color:#94a3b8;">(${size})</span>` : ''}
                </div>
                <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                    ${dataUrl ? `
                        <button onclick="downloadUniversalFile('${encodeURIComponent(dataUrl)}', '${encodeURIComponent(fileName)}')" 
                            style="background:#059669; color:white; border:none; padding:7px 16px; border-radius:6px; font-size:13px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(5,150,105,0.3);">
                            📥 Скачати
                        </button>
                    ` : ''}
                    <button onclick="printUniversalFilePreview()" 
                        style="background:#334155; color:white; border:none; padding:7px 14px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
                        🖨️ Друк
                    </button>
                    <button onclick="closeUniversalFilePreviewModal()" 
                        style="background:#ef4444; color:white; border:none; width:32px; height:32px; border-radius:6px; font-size:16px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; margin-left:6px;" title="Закрити (Esc)">
                        ✕
                    </button>
                </div>
            </div>

            <!-- ВМІСТ ДОКУМЕНТА -->
            <div id="universal-file-preview-body" style="flex:1; overflow:hidden; display:flex; flex-direction:column; background:${isImage ? '#0f172a' : '#f1f5f9'}; position:relative;">
                ${contentHtml}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const escListener = function(e) {
        if (e.key === 'Escape') {
            closeUniversalFilePreviewModal();
            document.removeEventListener('keydown', escListener);
        }
    };
    document.addEventListener('keydown', escListener);
};

window.closeUniversalFilePreviewModal = function() {
    const modal = document.getElementById('universal-file-preview-modal');
    if (modal) {
        if (modal._pdfBlobUrl) {
            try { URL.revokeObjectURL(modal._pdfBlobUrl); } catch(e) {}
        }
        modal.remove();
    }
};

window.downloadUniversalFile = function(encodedDataUrl, encodedFileName) {
    try {
        const dataUrl = decodeURIComponent(encodedDataUrl);
        const fileName = decodeURIComponent(encodedFileName);

        if (!dataUrl) {
            alert('Файл недоступний для завантаження.');
            return;
        }

        const a = document.createElement('a');
        if (dataUrl.startsWith('data:')) {
            const blob = dataURItoBlob(dataUrl);
            if (blob) {
                const blobUrl = URL.createObjectURL(blob);
                a.href = blobUrl;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    a.remove();
                    URL.revokeObjectURL(blobUrl);
                }, 1000);
                return;
            }
        }
        a.href = dataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } catch(e) {
        console.error('Помилка завантаження файлу:', e);
    }
};

window.printUniversalFilePreview = function() {
    const body = document.getElementById('universal-file-preview-body');
    if (!body) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        window.print();
        return;
    }
    printWindow.document.write(`
        <html>
            <head>
                <title>Друк документа</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; color: #000; }
                    img { max-width: 100%; height: auto; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #666; padding: 6px; }
                    iframe { width: 100%; height: 100vh; border: none; }
                </style>
            </head>
            <body>
                ${body.innerHTML}
                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
};

// Допоміжні функції для інтерактивного перегляду
let currentImgZoom = 1.0;
let currentImgRot = 0;
let currentImgBgDark = true;

window.previewImageZoom = function(delta) {
    const img = document.getElementById('universal-preview-img');
    const lbl = document.getElementById('img-zoom-val');
    if (!img) return;
    currentImgZoom = Math.max(0.2, Math.min(5.0, currentImgZoom + delta));
    img.style.transform = `scale(${currentImgZoom}) rotate(${currentImgRot}deg)`;
    if (lbl) lbl.textContent = Math.round(currentImgZoom * 100) + '%';
};

window.previewImageReset = function() {
    const img = document.getElementById('universal-preview-img');
    const lbl = document.getElementById('img-zoom-val');
    if (!img) return;
    currentImgZoom = 1.0;
    img.style.transform = `scale(1) rotate(${currentImgRot}deg)`;
    if (lbl) lbl.textContent = '100%';
};

window.previewImageRotate = function() {
    const img = document.getElementById('universal-preview-img');
    if (!img) return;
    currentImgRot = (currentImgRot + 90) % 360;
    img.style.transform = `scale(${currentImgZoom}) rotate(${currentImgRot}deg)`;
};

window.toggleImgBg = function() {
    const wrap = document.getElementById('img-container-wrapper');
    if (!wrap) return;
    currentImgBgDark = !currentImgBgDark;
    wrap.style.background = currentImgBgDark ? '#0f172a' : '#ffffff';
};

window.copyDocumentBodyText = function() {
    const box = document.getElementById('word-doc-body-container');
    if (!box) return;
    const txt = box.innerText || box.textContent || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(() => {
            alert('✓ Текст скопійовано в буфер обміну!');
        });
    } else {
        alert('Текст:\n' + txt.substring(0, 500) + '...');
    }
};

window.copyExcelTableHtml = function() {
    const box = document.getElementById('excel-table-container');
    if (!box) return;
    const txt = box.innerText || box.textContent || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(() => {
            alert('✓ Дані таблиці скопійовано!');
        });
    }
};

window.switchPreviewExcelSheet = function(sheetName, btn) {
    if (!window._currentPreviewWorkbook || !window.XLSX) return;
    const sheet = window._currentPreviewWorkbook.Sheets[sheetName];
    if (!sheet) return;
    const container = document.getElementById('excel-table-container');
    if (container) {
        container.innerHTML = window.XLSX.utils.sheet_to_html(sheet, { header: '', footer: '', editable: false });
    }
    const allTabs = document.querySelectorAll('.excel-sheet-tab-btn');
    allTabs.forEach(b => {
        b.style.background = '#334155';
    });
    if (btn) btn.style.background = '#15803d';
};

window.filterExcelPreviewTable = function(query) {
    const q = (query || '').toLowerCase().trim();
    const rows = document.querySelectorAll('#excel-table-container tr');
    rows.forEach((r, idx) => {
        if (idx === 0) return; // заголовок не ховаємо
        const txt = (r.textContent || '').toLowerCase();
        r.style.display = (!q || txt.includes(q)) ? '' : 'none';
    });
};

window.extractDocBinaryText = function(arrayBuffer) {
    try {
        const bytes = new Uint8Array(arrayBuffer);
        const len = bytes.length;
        if (len < 512) return '';

        const cp1251 = [
            'Ђ','Ѓ','‚','ѓ','„','…','†','‡','€','‰','Љ','‹','Њ','Ќ','Ћ','Џ',
            'ђ','‘','’','“','”','•','–','—','\u0098','™','љ','›','њ','ќ','ћ','џ',
            ' ','Ў','ў','Ј','¤','Ґ','¦','§','Ё','©','Є','«','¬','\u00AD','®','Ї',
            '°','±','І','і','ґ','µ','¶','·','ё','№','є','»','ј','Ѕ','ѕ','ї',
            'А','Б','В','Г','Д','Е','Ж','З','И','Й','К','Л','М','Н','О','П',
            'Р','С','Т','У','Ф','Х','Ц','Ч','Ш','Щ','Ъ','Ы','Ь','Э','Ю','Я',
            'а','б','в','г','д','е','ж','з','и','й','к','л','м','н','о','п',
            'р','с','т','у','ф','х','ц','ч','ш','щ','ъ','ы','ь','э','ю','я'
        ];

        let utf16Strings = [];
        let currUtf16 = '';
        for (let i = 0; i < len - 1; i += 2) {
            let code = bytes[i] | (bytes[i + 1] << 8);
            if (code === 0x0D || code === 0x0A) {
                if (currUtf16.trim().length >= 3) utf16Strings.push(currUtf16.trim());
                currUtf16 = '';
            } else if ((code >= 0x0020 && code <= 0x007E) || (code >= 0x0400 && code <= 0x04FF) || code === 0x2116) {
                currUtf16 += String.fromCharCode(code);
            } else {
                if (currUtf16.trim().length >= 4) utf16Strings.push(currUtf16.trim());
                currUtf16 = '';
            }
        }
        if (currUtf16.trim().length >= 4) utf16Strings.push(currUtf16.trim());

        let cp1251Strings = [];
        let currCp = '';
        for (let i = 0; i < len; i++) {
            let b = bytes[i];
            if (b === 0x0D || b === 0x0A) {
                if (currCp.trim().length >= 3) cp1251Strings.push(currCp.trim());
                currCp = '';
            } else if (b >= 0x20 && b <= 0x7E) {
                currCp += String.fromCharCode(b);
            } else if (b >= 0x80) {
                currCp += cp1251[b - 0x80] || '';
            } else {
                if (currCp.trim().length >= 4) cp1251Strings.push(currCp.trim());
                currCp = '';
            }
        }
        if (currCp.trim().length >= 4) cp1251Strings.push(currCp.trim());

        const filterJunk = (arr) => arr.filter(s => s.length >= 3 && !/^[0-9\s.,!?:;*+\-_=]+$/.test(s));
        const clean16 = filterJunk(utf16Strings);
        const clean8 = filterJunk(cp1251Strings);

        const totalChars16 = clean16.reduce((acc, s) => acc + s.length, 0);
        const totalChars8 = clean8.reduce((acc, s) => acc + s.length, 0);

        const bestList = totalChars16 > totalChars8 ? clean16 : clean8;
        return bestList.join('\n\n');
    } catch(e) {
        return '';
    }
};
