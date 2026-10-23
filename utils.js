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

function showToastNotification(message, bgColor = '#27ae60') {
    let toast = document.getElementById('app-floating-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-floating-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 25px;
            right: 25px;
            z-index: 999999;
            color: #ffffff;
            padding: 12px 22px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 8px 24px rgba(0,0,0,0.25);
            transition: opacity 0.3s ease, transform 0.3s ease;
            opacity: 0;
            transform: translateY(15px);
            pointer-events: none;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        document.body.appendChild(toast);
    }
    toast.style.backgroundColor = bgColor;
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(15px)';
    }, 3200);
}
window.showToastNotification = showToastNotification;

function tryAddCarRow() {
    const role = (typeof window.getCurrentAppRole === 'function')
        ? window.getCurrentAppRole()
        : ((typeof window.currentRole !== 'undefined') ? window.currentRole : ((typeof currentRole !== 'undefined') ? currentRole : 'admin'));

    const isDev = (role === 'developer' || role === 'dev');
    const isAdmin = (role === 'admin' || (typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn));
    const canDo = isDev || isAdmin || (typeof window.canRoleDo === 'function' && window.canRoleDo(role, 'base_add_car'));

    if (canDo) {
        openAddCarModal();
    } else {
        if (typeof showCustomPasswordModal === 'function') {
            showCustomPasswordModal((pass) => {
                if (pass === "02031985" || pass === "4343") {
                    openAddCarModal();
                } else if (pass !== null) {
                    showToastNotification("Неправильний пароль!", "#c0392b");
                }
            });
        } else {
            openAddCarModal();
        }
    }
}
window.tryAddCarRow = tryAddCarRow;

function promptAndAddCar() {
    openAddCarModal();
}
window.promptAndAddCar = promptAndAddCar;

function openAddCarModal() {
    let existingModal = document.getElementById('add-car-custom-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const categories = (typeof VEHICLE_CATEGORIES !== 'undefined') ? VEHICLE_CATEGORIES : {
        PASSENGER: "Легкові автомобілі",
        TRUCK: "Вантажні автомобілі",
        ADBLUE: "Вантажні автомобілі з AdBlue",
        SUV: "Позашляховики",
        MINIBUS: "Мікроавтобуси",
        MILES: "Автомобілі з милями",
        HQ: "Штабні автомобілі",
        SPECIAL: "Спецтехніка",
        MOTORCYCLE: "Мотоцикли",
        QUAD: "Квадроцикли"
    };

    const nextNumber = (typeof carsData !== 'undefined' && Array.isArray(carsData) && carsData.length > 0)
        ? Math.max(...carsData.map(i => Number(i.id) || 0)) + 1
        : 1;

    let catOptionsHtml = '';
    for (const [key, label] of Object.entries(categories)) {
        catOptionsHtml += `<option value="${key}">${label}</option>`;
    }

    const modal = document.createElement('div');
    modal.id = 'add-car-custom-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(15, 23, 42, 0.65);
        backdrop-filter: blur(3px);
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
    `;

    modal.innerHTML = `
        <div style="background: white; border-radius: 10px; max-width: 520px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.3); overflow: hidden; animation: popIn 0.2s ease-out; font-family: inherit;">
            <div style="background: #2c3e50; color: white; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 16px; font-weight: bold; display: flex; align-items: center; gap: 8px;">
                    🚗 Додати новий автомобіль у Реєстр
                </h3>
                <button type="button" id="close-add-car-modal-btn" style="background: transparent; border: none; color: white; font-size: 20px; cursor: pointer; line-height: 1;">&times;</button>
            </div>
            <form id="add-car-form" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
                <div>
                    <label style="display: block; font-size: 12px; font-weight: bold; color: #34495e; margin-bottom: 5px;">Категорія транспортного засобу:</label>
                    <select id="newcar-category" style="width: 100%; padding: 8px 10px; border: 1px solid #bdc3c7; border-radius: 5px; font-size: 13px; font-weight: bold; background: white; cursor: pointer;">
                        ${catOptionsHtml}
                    </select>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 12px;">
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: bold; color: #34495e; margin-bottom: 5px;">Номерний знак:</label>
                        <input type="text" id="newcar-plate" value="NEW ${String(nextNumber).padStart(4, '0')}" required style="width: 100%; padding: 8px 10px; border: 1px solid #bdc3c7; border-radius: 5px; font-size: 13px; font-weight: bold; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: bold; color: #34495e; margin-bottom: 5px;">Марка / Модель:</label>
                        <input type="text" id="newcar-model" value="Новий авто" required style="width: 100%; padding: 8px 10px; border: 1px solid #bdc3c7; border-radius: 5px; font-size: 13px; box-sizing: border-box;">
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: bold; color: #34495e; margin-bottom: 5px;">Підрозділ:</label>
                        <input type="text" id="newcar-subdivision" value="РМТЗ" style="width: 100%; padding: 8px 10px; border: 1px solid #bdc3c7; border-radius: 5px; font-size: 13px; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: bold; color: #34495e; margin-bottom: 5px;">Вид пального:</label>
                        <select id="newcar-fuel" style="width: 100%; padding: 8px 10px; border: 1px solid #bdc3c7; border-radius: 5px; font-size: 13px; background: white; cursor: pointer; box-sizing: border-box;">
                            <option value="ДП">ДП (Дизель)</option>
                            <option value="АБ">АБ (Бензин)</option>
                            <option value="ДП / AdBlue">ДП / AdBlue</option>
                            <option value="АБ / AdBlue">АБ / AdBlue</option>
                        </select>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: bold; color: #34495e; margin-bottom: 5px;">Базова витрата (л/100км):</label>
                        <input type="number" step="0.1" id="newcar-consumption" value="10.0" min="1" max="99" style="width: 100%; padding: 8px 10px; border: 1px solid #bdc3c7; border-radius: 5px; font-size: 13px; font-weight: bold; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: bold; color: #34495e; margin-bottom: 5px;">Водій:</label>
                        <input type="text" id="newcar-driver" value="Водій" style="width: 100%; padding: 8px 10px; border: 1px solid #bdc3c7; border-radius: 5px; font-size: 13px; box-sizing: border-box;">
                    </div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
                    <button type="button" id="cancel-add-car-btn" style="background: #95a5a6; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-size: 13px; font-weight: bold; cursor: pointer;">Скасувати</button>
                    <button type="submit" id="submit-add-car-btn" style="background: #27ae60; color: white; border: none; padding: 8px 20px; border-radius: 4px; font-size: 13px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        ➕ Додати автомобіль
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    const catSelect = modal.querySelector('#newcar-category');
    const fuelSelect = modal.querySelector('#newcar-fuel');
    const consInput = modal.querySelector('#newcar-consumption');
    const plateInput = modal.querySelector('#newcar-plate');

    catSelect.addEventListener('change', () => {
        const uKey = catSelect.value.toUpperCase();
        if (uKey === 'TRUCK' || uKey === 'SPECIAL' || uKey === 'ADBLUE' || uKey === 'MINIBUS') {
            consInput.value = '25.0';
            fuelSelect.value = (uKey === 'ADBLUE') ? 'ДП / AdBlue' : 'ДП';
        } else if (uKey === 'MOTORCYCLE' || uKey === 'QUAD') {
            consInput.value = '4.0';
            fuelSelect.value = 'АБ';
        } else {
            consInput.value = '10.0';
            fuelSelect.value = 'ДП';
        }
    });

    const closeModal = () => {
        modal.remove();
    };

    modal.querySelector('#close-add-car-modal-btn').onclick = closeModal;
    modal.querySelector('#cancel-add-car-btn').onclick = closeModal;
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    setTimeout(() => {
        plateInput.focus();
        plateInput.select();
    }, 50);

    const form = modal.querySelector('#add-car-form');
    form.onsubmit = (e) => {
        e.preventDefault();
        const selKey = catSelect.value;
        const selName = categories[selKey] || selKey;
        const plateVal = plateInput.value.trim() || `NEW ${String(nextNumber).padStart(4, '0')}`;
        const modelVal = modal.querySelector('#newcar-model').value.trim() || `Новий авто (${selName})`;
        const subVal = modal.querySelector('#newcar-subdivision').value.trim() || 'РМТЗ';
        const fuelVal = fuelSelect.value;
        const consVal = parseFloat(consInput.value) || 10.0;
        const driverVal = modal.querySelector('#newcar-driver').value.trim() || 'Водій';

        let vehicleTypeUA = "легковий";
        const upperKey = selKey.toUpperCase();
        if (upperKey === "TRUCK" || upperKey === "MINIBUS" || upperKey === "SPECIAL" || upperKey === "ADBLUE") {
            vehicleTypeUA = "вантажний";
        } else if (upperKey === "MOTORCYCLE") {
            vehicleTypeUA = "мотоцикл";
        } else if (upperKey === "QUAD") {
            vehicleTypeUA = "квадроцикл";
        }

        executeAddCarWithCategory(selKey, vehicleTypeUA, selName, {
            plate: plateVal,
            model: modelVal,
            subdivision: subVal,
            fuelType: fuelVal,
            consumption: consVal,
            driver: driverVal
        });

        closeModal();
    };
}
window.openAddCarModal = openAddCarModal;

function executeAddCarWithCategory(categoryKey, vehicleTypeStr, categoryDisplayName, customDetails = {}) {
    if (typeof carsData === 'undefined') {
        window.carsData = [];
    }

    const newId = carsData.length > 0 ? Math.max(...carsData.map(i => Number(i.id) || 0)) + 1 : 1;
    const upperKey = (categoryKey || 'PASSENGER').toUpperCase();

    let assignedFormulas = [1, 2, 3, 4];
    if (upperKey === 'TRUCK' || upperKey === 'SPECIAL' || upperKey === 'ADBLUE' || upperKey === 'MINIBUS') {
        assignedFormulas = [5, 1, 2, 3, 6, 7]; 
    } else if (upperKey === 'MOTORCYCLE') {
        assignedFormulas = [8, 9];
    } else if (upperKey === 'QUAD') {
        assignedFormulas = [8];
    }

    const hasAdBlueFlag = (upperKey === 'ADBLUE' || (customDetails.fuelType && customDetails.fuelType.includes('AdBlue')));

    const finalPlate = customDetails.plate || `NEW ${String(newId).padStart(4, '0')}`;
    const finalModel = customDetails.model || `Новий авто (${categoryDisplayName})`;
    const finalSubdivision = customDetails.subdivision || "РМТЗ";
    const finalFuel = customDetails.fuelType || (upperKey === 'MOTORCYCLE' || upperKey === 'QUAD' ? "АБ" : "ДП");
    const finalConsumption = (customDetails.consumption !== undefined && !isNaN(customDetails.consumption))
        ? Number(customDetails.consumption)
        : ((upperKey === 'MOTORCYCLE' || upperKey === 'QUAD') ? 4.0 : (vehicleTypeStr === 'вантажний' ? 25.0 : 10.0));
    const finalDriver = customDetails.driver || "Водій";

    const newCar = {
        id: newId,
        plate: finalPlate,
        model: finalModel,
        subdivision: finalSubdivision,
        consumption: finalConsumption,
        fuelType: finalFuel,
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
        driver: finalDriver,
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

    showToastNotification(`✅ Автомобіль ${finalPlate} (${finalModel}) успішно додано!`, '#27ae60');

    // Плавна прокрутка до нового рядка у таблиці
    setTimeout(() => {
        const tbody = document.getElementById('cars-tbody');
        if (tbody && tbody.lastElementChild) {
            tbody.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
            tbody.lastElementChild.style.transition = 'background-color 0.5s ease';
            tbody.lastElementChild.style.backgroundColor = '#d4edda';
            setTimeout(() => {
                if (tbody.lastElementChild) {
                    tbody.lastElementChild.style.backgroundColor = '';
                }
            }, 2000);
        }
    }, 100);

    return newCar;
}
window.executeAddCarWithCategory = executeAddCarWithCategory;

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

        // Plain DOC text must never be interpreted as HTML.
        const bodyContent = richHtml || (extractedPlain ? escapeHtml(extractedPlain).replace(/\n/g, '<br>') : '');

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
                            <span style="font-size:11px; color:#64748b; display:block;">${ext === 'doc' ? 'Текст документа' : 'Перегляд документа'}</span>
                            <button type="button" onclick="copyDocumentBodyText()" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; border-radius:4px; padding:3px 8px; font-size:11px; cursor:pointer; margin-top:4px; font-weight:600;">
                                📋 Копіювати текст
                            </button>
                        </div>
                    </div>
                    <div id="word-doc-body-container" style="word-break:break-word; white-space:${richHtml ? 'normal' : 'pre-wrap'}; tab-size:4; min-height:350px;">
                        ${bodyContent || '<p style="color:#64748b; font-style:italic;">Не вдалося прочитати текст цього документа. Файл може бути захищений або мати непідтримуваний формат. Натисніть «📥 Скачати», щоб відкрити оригінал у Word.</p>'}
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

// Read CFB streams and the Word piece table, never raw file metadata.
// Format: Microsoft [MS-CFB] and [MS-DOC] section 2.4.1.
window.extractDocBinaryText = function(arrayBuffer) {
    try {
        const bytes = new Uint8Array(arrayBuffer);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const u16 = (offset) => view.getUint16(offset, true);
        const u32 = (offset) => view.getUint32(offset, true);
        const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
        if (bytes.length < 512 || !signature.every((b, i) => bytes[i] === b)) return '';
        const major = u16(26);
        const shift = u16(30);
        if (u16(28) !== 0xfffe || !((major === 3 && shift === 9) || (major === 4 && shift === 12)) || u16(32) !== 6) return '';
        const sectorSize = 2 ** shift;
        const sectorCount = Math.floor(bytes.length / sectorSize) - 1;
        const validSector = (id) => Number.isInteger(id) && id >= 0 && id < sectorCount;
        const sector = (id) => {
            if (!validSector(id)) throw new Error('Invalid CFB sector');
            return bytes.subarray((id + 1) * sectorSize, (id + 2) * sectorSize);
        };
        const words = (data) => {
            const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
            return Array.from({ length: data.length / 4 }, (_, i) => dv.getUint32(i * 4, true));
        };
        const difat = [];
        for (let i = 0; i < 109; i++) {
            const id = u32(76 + i * 4);
            if (id !== 0xffffffff) difat.push(id);
        }
        let difatId = u32(68);
        const difatSeen = new Set();
        const difatCount = u32(72);
        if (difatCount > sectorCount) return '';
        for (let i = 0; i < difatCount; i++) {
            if (difatSeen.has(difatId)) return '';
            difatSeen.add(difatId);
            const ids = words(sector(difatId));
            difatId = ids.pop();
            ids.forEach(id => { if (id !== 0xffffffff) difat.push(id); });
        }
        const fatCount = u32(44);
        if (fatCount > sectorCount || difat.length < fatCount) return '';
        const fat = [];
        for (let i = 0; i < fatCount; i++) {
            for (const id of words(sector(difat[i]))) fat.push(id);
        }
        const readChain = (first, table, unitSize, readUnit, size) => {
            const chunks = [];
            const seen = new Set();
            let id = first;
            let total = 0;
            while (id !== 0xfffffffe && (size === undefined || total < size)) {
                if (!Number.isInteger(id) || id < 0 || id >= table.length || seen.has(id)) throw new Error('Invalid CFB chain');
                seen.add(id);
                const chunk = readUnit(id);
                if (chunk.length !== unitSize) throw new Error('Truncated CFB stream');
                chunks.push(chunk);
                total += unitSize;
                if (total > bytes.length) throw new Error('Oversized CFB chain');
                id = table[id];
            }
            if (size !== undefined && total < size) throw new Error('Incomplete CFB stream');
            const result = new Uint8Array(size === undefined ? total : size);
            chunks.forEach((chunk, i) => result.set(chunk.subarray(0, Math.max(0, Math.min(unitSize, result.length - i * unitSize))), i * unitSize));
            return result;
        };
        const readRegular = (id, size) => readChain(id, fat, sectorSize, sector, size);
        const directory = readRegular(u32(48));
        const dirView = new DataView(directory.buffer);
        const entries = [];
        const utf16 = new TextDecoder('utf-16le');
        for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
            const type = directory[offset + 66];
            const nameLength = dirView.getUint16(offset + 64, true);
            if (!type || nameLength < 2 || nameLength > 64 || nameLength % 2) continue;
            const size = dirView.getUint32(offset + 120, true) + (major === 4 ? dirView.getUint32(offset + 124, true) * 4294967296 : 0);
            if (size > bytes.length) return '';
            entries.push({ name: utf16.decode(directory.subarray(offset, offset + nameLength - 2)), type, start: dirView.getUint32(offset + 116, true), size });
        }
        const root = entries.find(entry => entry.type === 5);
        if (!root) return '';
        let miniFat;
        let miniStream;
        const readStream = (name) => {
            const entry = entries.find(item => item.type === 2 && item.name === name);
            if (!entry) throw new Error('Missing Word stream');
            if (!entry.size) return new Uint8Array();
            if (entry.size >= u32(56)) return readRegular(entry.start, entry.size);
            if (!miniFat) {
                miniFat = words(readRegular(u32(60), u32(64) * sectorSize));
                miniStream = readRegular(root.start, root.size);
            }
            return readChain(entry.start, miniFat, 64, id => miniStream.subarray(id * 64, (id + 1) * 64), entry.size);
        };
        const word = readStream('WordDocument');
        const fib = new DataView(word.buffer, word.byteOffset, word.byteLength);
        if (word.length < 34 || fib.getUint16(0, true) !== 0xa5ec || fib.getUint16(2, true) < 0xc1) return '';
        const flags = fib.getUint16(10, true);
        if (flags & 0x8100) return ''; // Encrypted / obfuscated documents need Word.
        const table = readStream(flags & 0x0200 ? '1Table' : '0Table');
        let offset = 32;
        const csw = fib.getUint16(offset, true);
        offset += 2 + csw * 2;
        const cslw = fib.getUint16(offset, true);
        const lwStart = offset + 2;
        if (cslw < 4) return '';
        const textLength = fib.getUint32(lwStart + 12, true);
        offset = lwStart + cslw * 4;
        const pairCount = fib.getUint16(offset, true);
        if (pairCount <= 33) return '';
        const clxOffset = fib.getUint32(offset + 2 + 33 * 8, true);
        const clxLength = fib.getUint32(offset + 6 + 33 * 8, true);
        const clxEnd = clxOffset + clxLength;
        if (!clxLength || clxEnd > table.length) return '';
        const tv = new DataView(table.buffer, table.byteOffset, table.byteLength);
        let cursor = clxOffset;
        while (cursor < clxEnd && table[cursor] === 1) {
            if (cursor + 3 > clxEnd) return '';
            cursor += 3 + tv.getUint16(cursor + 1, true);
        }
        if (cursor + 5 > clxEnd || table[cursor] !== 2) return '';
        const plcLength = tv.getUint32(cursor + 1, true);
        const plc = cursor + 5;
        if (plcLength < 4 || (plcLength - 4) % 12 || plc + plcLength > clxEnd) return '';
        const count = (plcLength - 4) / 12;
        const pcdStart = plc + (count + 1) * 4;
        const parts = [];
        let consumed = 0;
        for (let i = 0; i < count && consumed < textLength; i++) {
            const cp = tv.getUint32(plc + i * 4, true);
            const nextCp = tv.getUint32(plc + (i + 1) * 4, true);
            if (cp !== consumed || nextCp <= cp) return '';
            const length = Math.min(nextCp, textLength) - cp;
            const fc = tv.getUint32(pcdStart + i * 8 + 2, true);
            const compressed = !!(fc & 0x40000000);
            const start = (fc & 0x3fffffff) / (compressed ? 2 : 1);
            const end = start + length * (compressed ? 1 : 2);
            if (!Number.isInteger(start) || end > word.length) return '';
            // MS-DOC compressed pieces are Unicode U+00xx, not Windows-1251.
            const special = {128:0x20ac,130:0x201a,131:0x0192,132:0x201e,133:0x2026,134:0x2020,135:0x2021,136:0x02c6,137:0x2030,138:0x0160,139:0x2039,140:0x0152,142:0x017d,145:0x2018,146:0x2019,147:0x201c,148:0x201d,149:0x2022,150:0x2013,151:0x2014,152:0x02dc,153:0x2122,154:0x0161,155:0x203a,156:0x0153,158:0x017e,159:0x0178};
            parts.push(compressed ? Array.from(word.subarray(start, end), b => String.fromCharCode(special[b] || b)).join('') : utf16.decode(word.subarray(start, end)));
            consumed += length;
        }
        if (consumed !== textLength) return '';
        // Keep field results, omit field instructions (PAGE, REF, etc.).
        const fields = [];
        let text = '';
        for (const char of parts.join('')) {
            if (char === '\x13') { fields.push(false); continue; }
            if (char === '\x14' && fields.length) { fields[fields.length - 1] = true; continue; }
            if (char === '\x15' && fields.length) { fields.pop(); continue; }
            if (fields.every(Boolean)) text += char;
        }
        return text.replace(/\r\x07/g, '\t').replace(/\x07/g, '\t').replace(/[\r\v\f]/g, '\n').replace(/[\x00-\x08\x0e-\x1f]/g, '').trim();
    } catch (e) {
        console.warn('Не вдалося прочитати структуру DOC:', e.message);
        return '';
    }
};
