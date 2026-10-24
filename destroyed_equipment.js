// ==========================================
// ОБЛІК ЗНИЩЕНОЇ ТЕХНІКИ ТА ОБЛАДНАННЯ (destroyed_equipment.js)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    // Надійне перехоплення перемикання вкладок
    if (typeof window.switchView === 'function' && !window._destroyedHooked) {
        window._destroyedHooked = true;
        const originalSwitchView = window.switchView;
        window.switchView = function(viewName) {
            try {
                originalSwitchView(viewName);
            } catch (e) {}

            document.querySelectorAll('.view-section').forEach(sec => {
                sec.classList.remove('active');
                sec.style.display = 'none';
            });

            const target = document.getElementById(viewName + '-view') || document.getElementById(viewName);
            if (target) {
                target.classList.add('active');
                target.style.display = 'block';
            }

            if (viewName === 'destroyed') {
                setTimeout(renderDestroyedEquipmentView, 10);
            }
        };
    }

    // Слухач на клік по кнопці навігації "Знищена техніка"
    document.querySelectorAll('button').forEach(btn => {
        if (btn.textContent.includes('Знищена техніка')) {
            btn.addEventListener('click', () => {
                window.switchView('destroyed');
            });
        }
    });

    // Автоматичний рендеринг при завантаженні, якщо активна секція
    setTimeout(() => {
        const destroyedView = document.getElementById('destroyed-view');
        if (destroyedView && (destroyedView.classList.contains('active') || destroyedView.style.display === 'block')) {
            renderDestroyedEquipmentView();
        }
    }, 100);
});

function getDestroyedEquipmentList() {
    let destroyedItems = [];
    
    try {
        // 1. Збір автомобілів із Реєстру (carsData)
        const sourceCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : [];
        sourceCars.forEach(car => {
            const note = String(car.note || '');
            if (/знищ/ui.test(note)) {
                destroyedItems.push({
                    type: 'car',
                    id: car.id,
                    model: car.model || 'Автомобіль',
                    plate: car.plate || '',
                    name: `${car.model || 'Авто'} (${car.plate || ''})`,
                    subdivision: car.subdivision || 'РМТЗ',
                    note: note,
                    category: 'Автомобіль',
                    uniqueId: `car_${car.id}`
                });
            }
        });

        // 2. Збір обладнання безпосередньо з localStorage
        const eqCategories = [
            { key: 'generators_custom_data', cat: 'Генератор' },
            { key: 'webasto_custom_data', cat: 'Webasto' },
            { key: 'heaters_custom_data', cat: 'Теплова пушка' },
            { key: 'chainsaws_custom_data', cat: 'Бензопила' },
            { key: 'pumps_custom_data', cat: 'Помпа' }
        ];

        eqCategories.forEach(source => {
            const raw = localStorage.getItem(source.key);
            if (raw) {
                try {
                    const list = JSON.parse(raw);
                    if (Array.isArray(list)) {
                        list.forEach(item => {
                            const note = String(item.note || item.comment || '');
                            if (/знищ/ui.test(note)) {
                                destroyedItems.push({
                                    type: 'equipment',
                                    id: item.id,
                                    model: item.model || 'Об\'єкт',
                                    name: `${source.cat} — ${item.model || 'Об\'єкт'}`,
                                    subdivision: item.subdivision || item.locationSubdivision || 'РМТЗ',
                                    note: note,
                                    category: source.cat,
                                    uniqueId: `eq_${source.cat}_${item.id}`,
                                    storageKey: source.key
                                });
                            }
                        });
                    }
                } catch(e) {}
            }
        });
    } catch (e) {
        console.error('Помилка збору знищеної техніки:', e);
    }

    return destroyedItems;
}

function renderDestroyedEquipmentView() {
    let container = document.getElementById('destroyed-equipment-container');
    if (!container) {
        let viewSection = document.getElementById('destroyed-view');
        if (!viewSection) {
            viewSection = document.createElement('section');
            viewSection.id = 'destroyed-view';
            viewSection.className = 'view-section';
            document.querySelector('.main-container')?.appendChild(viewSection);
        }
        viewSection.innerHTML = `<div id="destroyed-equipment-container"></div>`;
        container = document.getElementById('destroyed-equipment-container');
    }

    const destroyedItems = getDestroyedEquipmentList();

    let html = `
        <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #bdc3c7; max-width: 1350px; margin: 0 auto;">
            <h3 style="color: #c0392b; margin-top: 0; margin-bottom: 15px; font-size: 18px; text-align: center; font-weight: bold;">Облік знищеної техніки та обладнання</h3>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; background: white;">
                    <thead>
                        <tr style="background-color: #2e7d32; color: white;">
                            <th style="padding: 8px 6px; text-align: center; width: 40px;">№ з/п</th>
                            <th style="padding: 8px 6px; text-align: left; min-width: 180px;">Назва / Номер</th>
                            <th style="padding: 8px 6px; text-align: center; width: 100px;">Підрозділ</th>
                            <th style="padding: 8px 6px; text-align: center; width: 110px; background-color: #1b5e20;">Залишок пального</th>
                            <th style="padding: 8px 6px; text-align: center; width: 110px; background-color: #1b5e20;">Кінцевий одометр</th>
                            <th style="padding: 8px 6px; text-align: center; width: 120px;">Дата знищення</th>
                            <th style="padding: 8px 6px; text-align: center; width: 90px;">Час знищення</th>
                            <th style="padding: 8px 6px; text-align: left; min-width: 180px;">Місто / Позиція</th>
                            <th style="padding: 8px 6px; text-align: center; width: 90px;">Дія</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    if (destroyedItems.length === 0) {
        html += `<tr><td colspan="9" style="text-align: center; padding: 20px; color: #7f8c8d; font-style: italic;">Немає знищеної техніки або обладнання</td></tr>`;
    } else {
        destroyedItems.forEach((item, idx) => {
            const safeId = String(item.id);

            html += `
                <tr>
                    <td style="text-align: center; padding: 6px; border-bottom: 1px solid #ddd;">${idx + 1}</td>
                    <td style="padding: 6px; border-bottom: 1px solid #ddd;">
                        <strong>${item.name}</strong><br>
                        <span style="font-size: 10px; color: #16a085; font-weight: bold;">[${item.category}]</span> 
                        <span style="font-size: 10px; color: #7f8c8d;">Примітка: ${item.note}</span>
                    </td>
                    <td style="text-align: center; padding: 6px; border-bottom: 1px solid #ddd; font-weight: bold;">${item.subdivision}</td>
                    <td style="text-align: center; padding: 6px; border-bottom: 1px solid #ddd; color: #c0392b; font-weight: bold; background-color: #fcf3cf;">—</td>
                    <td style="text-align: center; padding: 6px; border-bottom: 1px solid #ddd; font-weight: bold; background-color: #eaf2f8;">—</td>
                    <td style="text-align: center; padding: 6px; border-bottom: 1px solid #ddd;">
                        <input type="date" value="${item.destroyDate || ''}" onchange="updateDestroyedItemProp('${item.type}', '${safeId}', 'destroyDate', this.value, '${item.storageKey || ''}')" style="padding: 4px; font-size: 11px; border: 1px solid #ccc; border-radius: 3px; width: 100%; box-sizing: border-box;">
                    </td>
                    <td style="text-align: center; padding: 6px; border-bottom: 1px solid #ddd;">
                        <input type="time" value="${item.destroyTime || ''}" onchange="updateDestroyedItemProp('${item.type}', '${safeId}', 'destroyTime', this.value, '${item.storageKey || ''}')" style="padding: 4px; font-size: 11px; border: 1px solid #ccc; border-radius: 3px; width: 100%; box-sizing: border-box;">
                    </td>
                    <td style="padding: 6px; border-bottom: 1px solid #ddd;">
                        <input type="text" value="${item.destroyLocation || ''}" placeholder="Введіть місто або позицію..." oninput="updateDestroyedItemProp('${item.type}', '${safeId}', 'destroyLocation', this.value, '${item.storageKey || ''}')" style="width: 100%; padding: 5px; font-size: 11px; border: 1px solid #ccc; border-radius: 3px; box-sizing: border-box;">
                    </td>
                    <td style="text-align: center; padding: 6px; border-bottom: 1px solid #ddd;">
                        <button onclick="restoreDestroyedItemFromTable('${item.type}', '${safeId}', '${item.storageKey || ''}')" style="background-color: #27ae60; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold;">Відновити</button>
                    </td>
                </tr>
            `;
        });
    }

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

function updateDestroyedItemProp(type, itemId, propName, value, storageKey) {
    try {
        if (type === 'car') {
            const sourceCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : [];
            const car = sourceCars.find(c => Number(c.id) === Number(itemId));
            if (car) {
                car[propName] = value;
                if (typeof saveCarsModificationsToStorage === 'function') saveCarsModificationsToStorage();
            }
            return;
        }

        if (storageKey) {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                let arr = JSON.parse(raw);
                let updated = false;
                arr.forEach(item => {
                    if (String(item.id) === String(itemId)) {
                        item[propName] = value;
                        updated = true;
                    }
                });
                if (updated) {
                    localStorage.setItem(storageKey, JSON.stringify(arr));
                }
            }
        }
    } catch (e) {
        console.error('Помилка збереження властивості:', e);
    }
}

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

function stripDestroyedNote(text) {
    if (!text) return '';
    let str = String(text);
    if (/^[\s\-\,\.\;\:\(\)\[\]]*знищ/i.test(str) && str.length < 60) {
        return '';
    }
    str = str.replace(/\([^\)]*знищ[^\)]*\)/gi, '');
    str = str.replace(/\[[^\]]*знищ[^\]]*\]/gi, '');
    str = str.replace(/знищ[\wа-яіїєґ\.\-]*/gi, '');
    str = str.replace(/\s{2,}/g, ' ').trim();
    str = str.replace(/[\s\-\,\.\;\:\(\)\[\]]+$/g, '').trim();
    if (/^[\s\-\,\.\;\:\(\)\[\]0-9\.\/]*$/.test(str)) {
        str = '';
    }
    return str;
}

function restoreDestroyedItemFromTable(type, id, storageKey) {
    try {
        if (type === 'car') {
            const sourceCars = (typeof carsData !== 'undefined' && Array.isArray(carsData)) ? carsData : (window.carsData || []);
            const car = sourceCars.find(c => String(c.id) === String(id) || Number(c.id) === Number(id));
            if (car) {
                car.note = stripDestroyedNote(car.note);
                delete car.destroyDate;
                delete car.destroyTime;
                delete car.destroyLocation;
                delete car.isDestroyed;

                if (typeof saveCarsModificationsToStorage === 'function') saveCarsModificationsToStorage();
                if (typeof saveCarsToStorage === 'function') saveCarsToStorage();
                if (typeof renderCarsTable === 'function') renderCarsTable();
                renderDestroyedEquipmentView();
                showToastNotification("✅ Автомобіль успішно відновлено та повернуто до Бази!", "#27ae60");
                return;
            }
        }

        let restored = false;
        const eqCategories = [
            'generators_custom_data',
            'webasto_custom_data',
            'heaters_custom_data',
            'chainsaws_custom_data',
            'pumps_custom_data'
        ];

        const keysToCheck = storageKey ? [storageKey, ...eqCategories.filter(k => k !== storageKey)] : eqCategories;
        for (const sKey of keysToCheck) {
            const raw = localStorage.getItem(sKey);
            if (!raw) continue;
            try {
                let arr = JSON.parse(raw);
                if (!Array.isArray(arr)) continue;
                let modified = false;
                arr.forEach(item => {
                    if (String(item.id) === String(id) || Number(item.id) === Number(id)) {
                        if (item.note) {
                            item.note = stripDestroyedNote(item.note);
                        }
                        if (item.comment) {
                            item.comment = stripDestroyedNote(item.comment);
                        }
                        delete item.destroyDate;
                        delete item.destroyTime;
                        delete item.destroyLocation;
                        delete item.isDestroyed;
                        modified = true;
                        restored = true;
                    }
                });
                if (modified) {
                    localStorage.setItem(sKey, JSON.stringify(arr));
                }
            } catch (e) {}
            if (restored) break;
        }

        renderDestroyedEquipmentView();
        if (typeof switchEquipmentTab === 'function') {
            switchEquipmentTab(typeof currentEquipmentTabName !== 'undefined' ? currentEquipmentTabName : 'generators');
        }

        showToastNotification("✅ Об'єкт успішно відновлено та повернуто до обліку!", "#27ae60");
    } catch (err) {
        console.error("Помилка відновлення об'єкта:", err);
        showToastNotification("Помилка при відновленні об'єкта", "#c0392b");
    }
}
window.restoreDestroyedItemFromTable = restoreDestroyedItemFromTable;
