// ==========================================
// ЛОГІКА ОБЛІКУ ГЕНЕРАТОРІВ (generators.js)
// ==========================================

let defaultGeneratorsData = [
    { id: 1, model: "Firman SDG 8500 CLE", kw: "6", fuelType: "ДП", consumption: "3.33", max5Days: "199.80", max10Days: "399.6", max30Days: "1198.8", motoHoursDay: "12", oilNorm10Days: "1.10", subdivision: "", responsiblePerson: "Беспалько М. О.", locationSubdivision: "", serialNumber: "SDG2012M2690", note: "" },
    { id: 2, model: "EnterSol ES208G", kw: "3", fuelType: "АБ", consumption: "0.35", max5Days: "21.00", max10Days: "42.0", max30Days: "126.0", motoHoursDay: "12", oilNorm10Days: "1.00", subdivision: "", responsiblePerson: "Беспалько М. О.", locationSubdivision: "", serialNumber: "M0-2210310018", note: "" },
    { id: 3, model: "GSEm 10000 SDE", kw: "11", fuelType: "ДП", consumption: "2.20", max5Days: "132.00", max10Days: "264.0", max30Days: "792.0", motoHoursDay: "12", oilNorm10Days: "1.60", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "SC2022120045", note: "" },
    { id: 4, model: "Gucbir GJD10000S", kw: "8", fuelType: "ДП", consumption: "2.00", max5Days: "120.00", max10Days: "240.0", max30Days: "720.0", motoHoursDay: "12", oilNorm10Days: "2.00", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "110022/203014", note: "" },
    { id: 5, model: "Konner&Sohnen KS8102HDE", kw: "7", fuelType: "ДП", consumption: "1.80", max5Days: "108.00", max10Days: "216.0", max30Days: "648.0", motoHoursDay: "12", oilNorm10Days: "1.60", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "202302074", note: "" },
    { id: 6, model: "Konner&Sohnen KS 9300DE-1/3 ATSR", kw: "7", fuelType: "ДП", consumption: "1.80", max5Days: "108.00", max10Days: "216.0", max30Days: "648.0", motoHoursDay: "12", oilNorm10Days: "1.60", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "20221122538", note: "" },
    { id: 7, model: "MSW-AVR 8500F", kw: "8", fuelType: "ДП", consumption: "2.70", max5Days: "162.00", max10Days: "324.0", max30Days: "972.0", motoHoursDay: "12", oilNorm10Days: "1.50", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "ICDBA0132", note: "" },
    { id: 8, model: "Y-BOX KDE 8500E", kw: "6", fuelType: "ДП", consumption: "1.60", max5Days: "96.00", max10Days: "192.0", max30Days: "576.0", motoHoursDay: "12", oilNorm10Days: "1.20", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "HR192FD21083417", note: "" },
    { id: 9, model: "CROSS TOOLS CPG3000V", kw: "4", fuelType: "АБ", consumption: "1.20", max5Days: "72.00", max10Days: "144.0", max30Days: "432.0", motoHoursDay: "12", oilNorm10Days: "0.60", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "2215CT0257", note: "" },
    { id: 10, model: "ENDRESS GT LINE", kw: "6", fuelType: "АБ", consumption: "2.00", max5Days: "120.00", max10Days: "240.0", max30Days: "720.0", motoHoursDay: "12", oilNorm10Days: "0.60", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "EX40a404L0079927", note: "" },
    { id: 11, model: "EXPERT, NXG2900", kw: "3", fuelType: "АБ", consumption: "2.00", max5Days: "120.00", max10Days: "240.0", max30Days: "720.0", motoHoursDay: "12", oilNorm10Days: "0.60", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "1006016", note: "" },
    { id: 12, model: "EXPERT, NXG3400", kw: "3", fuelType: "АБ", consumption: "1.50", max5Days: "90.00", max10Days: "180.0", max30Days: "540.0", motoHoursDay: "12", oilNorm10Days: "0.60", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "9330002", note: "" },
    { id: 13, model: "GUDE GSE 4701 RS", kw: "8", fuelType: "АБ", consumption: "1.25", max5Days: "75.00", max10Days: "150.0", max30Days: "450.0", motoHoursDay: "12", oilNorm10Days: "0.60", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "80700-2301-0303", note: "" },
    { id: 14, model: "Hoteche G820004", kw: "5", fuelType: "АБ", consumption: "2.00", max5Days: "120.00", max10Days: "240.0", max30Days: "720.0", motoHoursDay: "12", oilNorm10Days: "1.00", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "39019T040040", note: "" },
    { id: 15, model: "Predator 3500", kw: "3,0", fuelType: "АБ", consumption: "0.70", max5Days: "42.00", max10Days: "84.0", max30Days: "252.0", motoHoursDay: "12", oilNorm10Days: "0.60", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "1807800350001 (1)", note: "" },
    { id: 16, model: "Predator 4000 (4375/3500)", kw: "4,0", fuelType: "АБ", consumption: "0.77", max5Days: "46.20", max10Days: "92.4", max30Days: "277.2", motoHoursDay: "12", oilNorm10Days: "0.60", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "A2107038254", note: "" },
    { id: 17, model: "Predator 9000", kw: "7,2", fuelType: "АБ", consumption: "2.60", max5Days: "156.00", max10Days: "312.0", max30Days: "936.0", motoHoursDay: "12", oilNorm10Days: "1.10", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "G420FDA370152114", note: "" },
    { id: 18, model: "FELISATTI F93500/ІБГ -3500К", kw: "2.8 кВт", fuelType: "АБ", consumption: "0.60", max5Days: "36.00", max10Days: "72.0", max30Days: "216.0", motoHoursDay: "12", oilNorm10Days: "0.50", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "KM165FX2408095328", note: "" },
    { id: 19, model: "SENCI SC8000C", kw: "6.5 кВт", fuelType: "ДП", consumption: "1.50", max5Days: "90.00", max10Days: "180.0", max30Days: "540.0", motoHoursDay: "12", oilNorm10Days: "1.10", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "KDFG03031640", note: "" },
    { id: 20, model: "KOMPAK KS100SE-3", kw: "6.9 кВт", fuelType: "ДП", consumption: "1.20", max5Days: "72.00", max10Days: "144.0", max30Days: "432.0", motoHoursDay: "12", oilNorm10Days: "1.65", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "D400CCBB2693Z", note: "" },
    { id: 21, model: "ZIPPER ZI-STE6700DH", kw: "4.6 кВт", fuelType: "ДП", consumption: "1.80", max5Days: "108.00", max10Days: "216.0", max30Days: "648.0", motoHoursDay: "12", oilNorm10Days: "1.10", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "HP186FAЕНP22100320", note: "" },
    { id: 22, model: "EnerSol GP 1400F-E", kw: "4,0", fuelType: "АБ", consumption: "1.40", max5Days: "84.00", max10Days: "168.0", max30Days: "504.0", motoHoursDay: "12", oilNorm10Days: "0.60", subdivision: "", responsiblePerson: "Паламарчук Ігор", locationSubdivision: "", serialNumber: "Без номера 17", note: "" },
    { id: 23, model: "FOGO F3001IS", kw: "2,8", fuelType: "АБ", consumption: "1.10", max5Days: "66.00", max10Days: "132.0", max30Days: "396.0", motoHoursDay: "12", oilNorm10Days: "0.40", subdivision: "", responsiblePerson: "Савоненко С.", locationSubdivision: "", serialNumber: "Без номера", note: "" },
    { id: 24, model: "Predator 6500", kw: "6,0", fuelType: "АБ", consumption: "2.08", max5Days: "124.80", max10Days: "249.6", max30Days: "748.8", motoHoursDay: "12", oilNorm10Days: "1.10", subdivision: "", responsiblePerson: "Савоненко С.", locationSubdivision: "", serialNumber: "370152128", note: "" },
    { id: 25, model: "Scheppach SG5200D", kw: "5,0", fuelType: "АБ", consumption: "1.45", max5Days: "87.00", max10Days: "174.0", max30Days: "522.0", motoHoursDay: "12", oilNorm10Days: "1.65", subdivision: "", responsiblePerson: "Матеуш Сергій", locationSubdivision: "", serialNumber: "D53S679Z", note: "" },
    { id: 26, model: "Scheppach SG2500i", kw: "1,6", fuelType: "АБ", consumption: "1.07", max5Days: "64.20", max10Days: "128.4", max30Days: "385.2", motoHoursDay: "12", oilNorm10Days: "0.30", subdivision: "", responsiblePerson: "Пась П.", locationSubdivision: "", serialNumber: "80/22112400499", note: "" },
    { id: 27, model: "CROSS TOOLS,CPG3000V", kw: "3,8", fuelType: "АБ", consumption: "1.20", max5Days: "72.00", max10Days: "144.0", max30Days: "432.0", motoHoursDay: "12", oilNorm10Days: "0.60", subdivision: "", responsiblePerson: "Ковальов В.В.", locationSubdivision: "", serialNumber: "2301CT0342", note: "" },
    { id: 28, model: "RNG Power DG10000E", kw: "7,0", fuelType: "ДП", consumption: "2.46", max5Days: "147.60", max10Days: "295.2", max30Days: "885.6", motoHoursDay: "12", oilNorm10Days: "1.10", subdivision: "", responsiblePerson: "Патрікєєв О.", locationSubdivision: "", serialNumber: "HR186FA22094821", note: "" },
    { id: 29, model: "Champion 6800 (5500)", kw: "5,5", fuelType: "АБ", consumption: "2.65", max5Days: "159.00", max10Days: "318.0", max30Days: "954.0", motoHoursDay: "12", oilNorm10Days: "1.10", subdivision: "", responsiblePerson: "Патрікєєв О.", locationSubdivision: "", serialNumber: "1109C1101991", note: "" },
    { id: 30, model: "EnerSol ES-210G", kw: "2,8", fuelType: "АБ", consumption: "0.87", max5Days: "52.20", max10Days: "104.4", max30Days: "313.2", motoHoursDay: "12", oilNorm10Days: "0.60", subdivision: " ", responsiblePerson: "Патрікєєв О.", locationSubdivision: "", serialNumber: "S/07606", note: "" },
    { id: 31, model: "Konner&Sohnen KS 9100DE-1/3 ATSR", kw: "7,0", fuelType: "ДП", consumption: "1.80", max5Days: "108.00", max10Days: "216.0", max30Days: "648.0", motoHoursDay: "12", oilNorm10Days: "1.60", subdivision: "", responsiblePerson: "Даценко Роман", locationSubdivision: "", serialNumber: "20251115099", note: "" },
    { id: 32, model: "Genecet RZ3900CX/E", kw: "2,8/3,1", fuelType: "АБ", consumption: "1.77", max5Days: "106.20", max10Days: "212.4", max30Days: "637.2", motoHoursDay: "12", oilNorm10Days: "0.60", subdivision: "", responsiblePerson: "Даценко Роман", locationSubdivision: "", serialNumber: "Без номера 10", note: "" },
    { id: 33, model: "GENERGY ISASA", kw: "1,0", fuelType: "АБ", consumption: "0.44", max5Days: "26.40", max10Days: "52.8", max30Days: "158.4", motoHoursDay: "12", oilNorm10Days: "0.30", subdivision: "", responsiblePerson: "Даценко Роман", locationSubdivision: "", serialNumber: "Без номера 11", note: "" },
    { id: 34, model: "Gucbir GJD7000H", kw: "6,0", fuelType: "ДП", consumption: "1.97", max5Days: "118.20", max10Days: "236.4", max30Days: "709.2", motoHoursDay: "12", oilNorm10Days: "1.70", subdivision: "", responsiblePerson: "Жоргло В.", locationSubdivision: "", serialNumber: "8KDFE11134842", note: "" },
    { id: 35, model: "TMG Power DG7500ME", kw: "7,5", fuelType: "ДП", consumption: "1.60", max5Days: "96.00", max10Days: "192.0", max30Days: "576.0", motoHoursDay: "12", oilNorm10Days: "1.60", subdivision: "", responsiblePerson: "Жоргло В.", locationSubdivision: "", serialNumber: "Без номера 13", note: "" },
    { id: 36, model: "Predator 4375/3500", kw: "3,5", fuelType: "АБ", consumption: "1.14", max5Days: "68.40", max10Days: "136.8", max30Days: "410.4", motoHoursDay: "12", oilNorm10Days: "0.60", subdivision: "", responsiblePerson: "Мельниченко", locationSubdivision: "", serialNumber: "G300FP370152137", note: "" },
    { id: 37, model: "Tagret AVR 3500W", kw: "3,5", fuelType: "АБ", consumption: "0.70", max5Days: "42.00", max10Days: "84.0", max30Days: "252.0", motoHoursDay: "12", oilNorm10Days: "0.60", subdivision: "", responsiblePerson: "Мельниченко", locationSubdivision: "", serialNumber: "Без номера 14", note: "" },
    { id: 38, model: "HYUNDAI DIYI 8000 LE", kw: "6,0", fuelType: "ДП", consumption: "2.40", max5Days: "144.00", max10Days: "288.0", max30Days: "864.0", motoHoursDay: "12", oilNorm10Days: "1.30", subdivision: "", responsiblePerson: "Позняк Олександр", locationSubdivision: "", serialNumber: "1014068160/XP12120434X", note: "" },
    { id: 39, model: "FORTE FG6500", kw: "5/5,5", fuelType: "АБ", consumption: "2.30", max5Days: "138.00", max10Days: "276.0", max30Days: "828.0", motoHoursDay: "12", oilNorm10Days: "1.10", subdivision: "", responsiblePerson: "Позняк Олександр", locationSubdivision: "", serialNumber: "FG20070250060", note: "" },
    { id: 40, model: "EF Power YH9000AE", kw: "7,0", fuelType: "ДП", consumption: "2.64", max5Days: "158.40", max10Days: "316.8", max30Days: "950.4", motoHoursDay: "12", oilNorm10Days: "1.70", subdivision: "", responsiblePerson: "Шарапов О.", locationSubdivision: "", serialNumber: "YH192F/A-E / 1523010975", note: "" },
    { id: 41, model: "EnerSol SKD-5EB", kw: "5,0", fuelType: "ДП", consumption: "1.40", max5Days: "84.00", max10Days: "168.0", max30Days: "504.0", motoHoursDay: "12", oilNorm10Days: "1.65", subdivision: "", responsiblePerson: "Шарапов О.", locationSubdivision: "", serialNumber: "HR186FA/23093608", note: "" },
    { id: 42, model: "AL-KO 2500 C 2кВт", kw: "2,0", fuelType: "АБ", consumption: "0.70", max5Days: "42.00", max10Days: "84.0", max30Days: "252.0", motoHoursDay: "12", oilNorm10Days: "0.60", subdivision: "", responsiblePerson: "Шарапов О.", locationSubdivision: "", serialNumber: "G1041048", note: "" },
    { id: 43, model: "Konner&Sohnen BASIC KSB 22iS", kw: "2,0", fuelType: "АБ", consumption: "0.70", max5Days: "42.00", max10Days: "84.0", max30Days: "252.0", motoHoursDay: "12", oilNorm10Days: "0.35", subdivision: "", responsiblePerson: "Паламарчук Ігор", locationSubdivision: "", serialNumber: "sn202212030089", note: "" },
];
let generatorsFilters = { model: "", subdivision: "", responsiblePerson: "", locationSubdivision: "" };
let currentEquipmentTabName = 'generators';

function getGeneratorsList() {
    try {
        const stored = localStorage.getItem('generators_custom_data');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch(e) {}
    localStorage.setItem('generators_custom_data', JSON.stringify(defaultGeneratorsData));
    return defaultGeneratorsData;
}

function saveGeneratorsList(list) {
    localStorage.setItem('generators_custom_data', JSON.stringify(list));
}

function switchEquipmentTab(tabName) {
    currentEquipmentTabName = tabName;
    document.querySelectorAll('.eq-tab-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.getElementById('tab-' + tabName);
    if (targetBtn) targetBtn.classList.add('active');

    if (tabName === 'generators') renderGeneratorsView();
    else if (tabName === 'webasto' && typeof renderWebastoView === 'function') renderWebastoView();
    else if (tabName === 'heaters' && typeof renderHeatersView === 'function') renderHeatersView();
    else if (tabName === 'chainsaws' && typeof renderChainsawsView === 'function') renderChainsawsView();
}

function addCurrentEquipmentRow() {
    if (currentEquipmentTabName === 'generators' && typeof addGeneratorRow === 'function') addGeneratorRow();
    else if (currentEquipmentTabName === 'webasto' && typeof addWebastoRow === 'function') addWebastoRow();
    else if (currentEquipmentTabName === 'heaters' && typeof addHeatersRow === 'function') addHeatersRow();
    else if (currentEquipmentTabName === 'chainsaws' && typeof addChainsawsRow === 'function') addChainsawsRow();
}

function printCurrentEquipmentTable() {
    if (currentEquipmentTabName === 'generators') {
        printGeneratorsTable();
    } else if (currentEquipmentTabName === 'webasto' && typeof printWebastoTable === 'function') {
        printWebastoTable();
    } else if (currentEquipmentTabName === 'heaters' && typeof printHeatersTable === 'function') {
        printHeatersTable();
    } else if (currentEquipmentTabName === 'chainsaws' && typeof printChainsawsTable === 'function') {
        printChainsawsTable();
    }
}

function printGeneratorsTable() {
    const printWindow = window.open('', '_blank');
    let list = getGeneratorsList().filter(item => !/знищ/ui.test(String(item.note || item.comment || '')));
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8"><title>Облік генераторів</title>
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
            <h2>ОБЛІК ТА НОРМИ ВИТРАТ ПАЛИВА І МАСТИЛ ГЕНЕРАТОРІВ</h2>
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

function renderGeneratorsView() {
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
        <table id="generators-table" class="compact-base-table" style="width: 100%; border-collapse: collapse; background: white; font-size: 12px;">
            <thead>
                <tr style="background-color: #2e7d32; color: white;">
                    <th style="padding: 6px 4px; width: 35px;">№</th>
                    <th style="padding: 6px 4px; min-width: 190px;">Модель<br><input type="text" id="filter-gen-model" placeholder="Фільтр..." value="${generatorsFilters.model}" oninput="updateGenFilter('model', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box;"></th>
                    <th style="padding: 6px 4px; width: 45px;">кВт</th>
                    <th style="padding: 6px 4px; width: 50px;">Тип пал.</th>
                    <th style="padding: 6px 4px; width: 55px;">Розхід літ./год.</th>
                    <th style="padding: 6px 4px; width: 65px;">Норма мастил</th>
                    <th style="padding: 6px 4px; width: 75px;">Макс з. на 5 діб</th>
                    <th style="padding: 6px 4px; width: 75px;">Макс з. на 10 діб</th>
                    <th style="padding: 6px 4px; width: 75px;">Макс з. на 30 діб</th>
                    <th style="padding: 6px 4px; width: 65px;">Норма мотог.</th>
                    <th style="padding: 6px 4px; min-width: 90px;">Підрозділ<br><input type="text" id="filter-gen-sub" placeholder="Фільтр..." value="${generatorsFilters.subdivision}" oninput="updateGenFilter('subdivision', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box;"></th>
                    <th style="padding: 6px 4px; min-width: 130px;">Мат. Відп. Особа<br><input type="text" id="filter-gen-resp" placeholder="Фільтр..." value="${generatorsFilters.responsiblePerson}" oninput="updateGenFilter('responsiblePerson', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box;"></th>
                    <th style="padding: 6px 4px; min-width: 100px;">Де знаходиться<br><input type="text" id="filter-gen-loc" placeholder="Фільтр..." value="${generatorsFilters.locationSubdivision}" oninput="updateGenFilter('locationSubdivision', this.value)" style="width: 100%; font-size: 11px; padding: 2px; border-radius: 2px; border: 1px solid #1b5e20; box-sizing: border-box;"></th>
                    <th style="padding: 6px 4px; min-width: 120px;">Серійний номер</th>
                    <th style="padding: 6px 4px; min-width: 80px;">Примітка</th>
                    <th style="padding: 6px 4px; width: 60px;">Дія</th>
                </tr>
            </thead>
            <tbody id="generators-tbody"></tbody>
        </table>
        <datalist id="generators-model-datalist">
            ${defaultGeneratorsData.map(item => `<option value="${item.model}">`).join('')}
        </datalist>
    `;

    const tbody = document.getElementById('generators-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let list = getGeneratorsList();
    const filtered = list.filter(item => {
        if (/знищ/ui.test(String(item.note || item.comment || ''))) return false;

        if (generatorsFilters.model && !String(item.model || "").toLowerCase().includes(generatorsFilters.model.toLowerCase())) return false;
        if (generatorsFilters.subdivision && !String(item.subdivision || "").toLowerCase().includes(generatorsFilters.subdivision.toLowerCase())) return false;
        if (generatorsFilters.responsiblePerson && !String(item.responsiblePerson || "").toLowerCase().includes(generatorsFilters.responsiblePerson.toLowerCase())) return false;
        if (generatorsFilters.locationSubdivision && !String(item.locationSubdivision || "").toLowerCase().includes(generatorsFilters.locationSubdivision.toLowerCase())) return false;
        return true;
    });

    filtered.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center; padding: 3px 4px;">${index + 1}</td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" list="generators-model-datalist" value="${item.model || ''}" placeholder="Новий генератор" onchange="updateGeneratorProp(${item.id}, 'model', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.kw || ''}" oninput="updateGeneratorProp(${item.id}, 'kw', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.fuelType || ''}" oninput="updateGeneratorProp(${item.id}, 'fuelType', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; background-color: #fff9c4; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.consumption || ''}" oninput="updateGeneratorProp(${item.id}, 'consumption', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.oilNorm10Days || ''}" oninput="updateGeneratorProp(${item.id}, 'oilNorm10Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.max5Days || ''}" oninput="updateGeneratorProp(${item.id}, 'max5Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.max10Days || ''}" oninput="updateGeneratorProp(${item.id}, 'max10Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.max30Days || ''}" oninput="updateGeneratorProp(${item.id}, 'max30Days', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.motoHoursDay || ''}" oninput="updateGeneratorProp(${item.id}, 'motoHoursDay', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.subdivision || ''}" oninput="updateGeneratorProp(${item.id}, 'subdivision', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${item.responsiblePerson || ''}" oninput="updateGeneratorProp(${item.id}, 'responsiblePerson', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" style="text-align:center; width: 100%; box-sizing: border-box; padding: 3px;" value="${item.locationSubdivision || ''}" oninput="updateGeneratorProp(${item.id}, 'locationSubdivision', this.value)"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${item.serialNumber || ''}" oninput="updateGeneratorProp(${item.id}, 'serialNumber', this.value)" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="padding: 3px 4px;"><input type="text" class="table-cell-input" value="${item.note || ''}" oninput="updateGeneratorProp(${item.id}, 'note', this.value); if(/знищ/ui.test(this.value)) { renderGeneratorsView(); }" style="width: 100%; box-sizing: border-box; padding: 3px;"></td>
            <td style="text-align: center; padding: 3px 4px;"><button class="delete-row-btn" style="padding: 2px 6px; font-size: 10px;" onclick="deleteGeneratorRow(${item.id})">Видалити</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function updateGenFilter(field, val) {
    generatorsFilters[field] = val;
    renderGeneratorsView();
    setTimeout(() => {
        const inputMap = { model: 'filter-gen-model', subdivision: 'filter-gen-sub', responsiblePerson: 'filter-gen-resp', locationSubdivision: 'filter-gen-loc' };
        const el = document.getElementById(inputMap[field]);
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }, 0);
}

function updateGeneratorProp(id, prop, val) {
    let list = getGeneratorsList();
    const item = list.find(i => Number(i.id) === Number(id));
    if (item) {
        item[prop] = val;
        if (prop === 'locationSubdivision') item.subdivision = val;
        if (prop === 'model') {
            const foundRef = defaultGeneratorsData.find(ref => ref.model.toLowerCase().trim() === val.toLowerCase().trim());
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
        saveGeneratorsList(list);
        if (prop === 'model') renderGeneratorsView();
    }
}

function addGeneratorRow() {
    let list = getGeneratorsList();
    const newId = list.length > 0 ? Math.max(...list.map(i => i.id)) + 1 : 1;
    list.push({ id: newId, model: "", kw: "", fuelType: "", consumption: "", max5Days: "", max10Days: "", max30Days: "", motoHoursDay: "", oilNorm10Days: "", subdivision: "РМТЗ", responsiblePerson: "Ковальов В.В.", locationSubdivision: "РМТЗ", serialNumber: "000000", note: "" });
    saveGeneratorsList(list);
    renderGeneratorsView();
}

function deleteGeneratorRow(id) {
    if (!confirm("Ви впевнені, що хочете видалити цей запис?")) return;
    let list = getGeneratorsList();
    list = list.filter(i => Number(i.id) !== Number(id));
    saveGeneratorsList(list);
    renderGeneratorsView();
}