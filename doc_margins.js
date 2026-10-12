// =========================================================================
// ОКРЕМИЙ МОДУЛЬ: КАТЕГОРІЯ ВІДСТУПІВ ДО ТЕКСТУ В МІЛІМЕТРАХ (doc_margins.js)
// Додає окрему спеціальну категорію в ліву колонку під блоком графічного підпису
// Чітко вимірює та регулює відступи в ММ: Зліва до тексту, Справа до тексту, Зверху та Знизу
// =========================================================================

(function () {
    const MM_STORAGE_KEY = 'doc_margins_mm_state_v2';
    const MM_TEMPLATES_KEY = 'doc_margins_mm_templates_v1';
    const A4_WIDTH_MM = 210;
    const A4_HEIGHT_MM = 297;

    // Стан усіх відступів у міліметрах (мм)
    let marginsMm = {
        left: 25,           // Відступ зліва від краю аркуша А4 до тексту (мм)
        right: 15,          // Відступ справа від краю аркуша А4 до тексту (мм)
        top: 20,            // Відступ зверху від краю аркуша А4 до шапки/тексту (мм)
        bottom: 20,         // Відступ знизу від краю аркуша А4 (мм)
        bodyExtraLeft: 0,   // Додатковий відступ зліва для основного тексту (мм)
        bodyExtraRight: 0,  // Додатковий відступ справа для основного тексту (мм)
        headersGap: 4,      // Відстань між лівою та правою шапкою (мм)
        headersToTitle: 6,  // Відстань зверху від шапок до заголовка (мм)
        titleToBody: 5,     // Відстань від заголовка до основного тексту (мм)
        bodyToSigners: 8,   // Відстань від основного тексту до підписантів (мм)
        showGuides: true    // Візуальні лінійки вимірювання в мм на аркуші А4
    };

    function getDefaultMarginTemplates() {
        return [
            { id: 'mtpl_dstu', name: 'ДСТУ 4163 (Наказ: Ліва 30, Права 10, Верх 20, Низ 20 мм)', left: 30, right: 10, top: 20, bottom: 20, bodyExtraLeft: 0, bodyExtraRight: 0, headersGap: 4, headersToTitle: 6, titleToBody: 5, bodyToSigners: 8 },
            { id: 'mtpl_raport', name: 'Стандарт Рапорт (Ліва 25, Права 15, Верх 20, Низ 20 мм)', left: 25, right: 15, top: 20, bottom: 20, bodyExtraLeft: 0, bodyExtraRight: 0, headersGap: 4, headersToTitle: 6, titleToBody: 5, bodyToSigners: 8 },
            { id: 'mtpl_akt', name: 'Акт списання ПММ (Ліва 20, Права 10, Верх 15, Низ 15 мм)', left: 20, right: 10, top: 15, bottom: 15, bodyExtraLeft: 0, bodyExtraRight: 0, headersGap: 4, headersToTitle: 5, titleToBody: 4, bodyToSigners: 6 },
            { id: 'mtpl_narrow', name: 'Вузькі поля (Ліва 15, Права 15, Верх 15, Низ 15 мм)', left: 15, right: 15, top: 15, bottom: 15, bodyExtraLeft: 0, bodyExtraRight: 0, headersGap: 4, headersToTitle: 4, titleToBody: 4, bodyToSigners: 6 }
        ];
    }

    function getSavedMarginTemplates() {
        try {
            const raw = localStorage.getItem(MM_TEMPLATES_KEY);
            if (!raw) {
                const def = getDefaultMarginTemplates();
                localStorage.setItem(MM_TEMPLATES_KEY, JSON.stringify(def));
                return def;
            }
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) && parsed.length ? parsed : getDefaultMarginTemplates();
        } catch (e) {
            return getDefaultMarginTemplates();
        }
    }

    function saveMarginTemplates(list) {
        try {
            localStorage.setItem(MM_TEMPLATES_KEY, JSON.stringify(list));
        } catch (e) {}
    }

    // Точний коефіцієнт пікселів на 1 міліметр на реальному аркуші А4 (210 мм)
    function getPxPerMm() {
        const sheet = document.getElementById('a4-paper-sheet');
        if (sheet && sheet.offsetWidth > 100) {
            return sheet.offsetWidth / A4_WIDTH_MM;
        }
        return 3.7795275591;
    }

    function pxToMm(px) {
        const ratio = getPxPerMm();
        return Math.round((Number(px || 0) / ratio) * 10) / 10;
    }

    function mmToPx(mm) {
        const ratio = getPxPerMm();
        return Math.round(Number(mm || 0) * ratio);
    }

    // Зчитування збережених відступів із поточного документа
    function loadMarginsStateFromDoc() {
        try {
            if (typeof docLayoutState !== 'undefined' && docLayoutState) {
                const pm = docLayoutState.pageMargins || {};
                if (typeof pm.left === 'number') marginsMm.left = pm.left;
                if (typeof pm.right === 'number') marginsMm.right = pm.right;
                if (typeof pm.top === 'number') marginsMm.top = pm.top;
                if (typeof pm.bottom === 'number') marginsMm.bottom = pm.bottom;
                if (typeof pm.headersGapMm === 'number') marginsMm.headersGap = pm.headersGapMm;
                else if (typeof pm.headersGap === 'number') marginsMm.headersGap = pxToMm(pm.headersGap);

                if (docLayoutState.bodyStyle) {
                    if (typeof docLayoutState.bodyStyle.paddingLeftMm === 'number') {
                        marginsMm.bodyExtraLeft = docLayoutState.bodyStyle.paddingLeftMm;
                    } else if (typeof docLayoutState.bodyStyle.paddingLeft === 'number') {
                        marginsMm.bodyExtraLeft = pxToMm(docLayoutState.bodyStyle.paddingLeft);
                    }
                    if (typeof docLayoutState.bodyStyle.paddingRightMm === 'number') {
                        marginsMm.bodyExtraRight = docLayoutState.bodyStyle.paddingRightMm;
                    } else if (typeof docLayoutState.bodyStyle.paddingRight === 'number') {
                        marginsMm.bodyExtraRight = pxToMm(docLayoutState.bodyStyle.paddingRight);
                    }
                }
                if (docLayoutState.docTitle) {
                    if (typeof docLayoutState.docTitle.gapFromHeadersMm === 'number') {
                        marginsMm.headersToTitle = docLayoutState.docTitle.gapFromHeadersMm;
                    } else if (typeof docLayoutState.docTitle.gapFromHeaders === 'number') {
                        marginsMm.headersToTitle = pxToMm(docLayoutState.docTitle.gapFromHeaders);
                    }
                    if (typeof docLayoutState.docTitle.gapToBodyMm === 'number') {
                        marginsMm.titleToBody = docLayoutState.docTitle.gapToBodyMm;
                    } else if (typeof docLayoutState.docTitle.gapToBody === 'number') {
                        marginsMm.titleToBody = pxToMm(docLayoutState.docTitle.gapToBody);
                    }
                }
                if (docLayoutState.signers) {
                    if (typeof docLayoutState.signers.gapFromBodyMm === 'number') {
                        marginsMm.bodyToSigners = docLayoutState.signers.gapFromBodyMm;
                    } else if (typeof docLayoutState.signers.gapFromBody === 'number') {
                        marginsMm.bodyToSigners = pxToMm(docLayoutState.signers.gapFromBody);
                    }
                }
                return;
            }
            const raw = localStorage.getItem(MM_STORAGE_KEY);
            if (raw) {
                marginsMm = { ...marginsMm, ...JSON.parse(raw) };
            }
        } catch (e) {}
    }

    // Збереження у стан документа
    function syncStateWithMainDoc() {
        try {
            localStorage.setItem(MM_STORAGE_KEY, JSON.stringify(marginsMm));
            if (typeof docLayoutState !== 'undefined' && docLayoutState) {
                if (!docLayoutState.pageMargins) docLayoutState.pageMargins = {};
                docLayoutState.pageMargins.left = marginsMm.left;
                docLayoutState.pageMargins.right = marginsMm.right;
                docLayoutState.pageMargins.top = marginsMm.top;
                docLayoutState.pageMargins.bottom = marginsMm.bottom;
                docLayoutState.pageMargins.headersGapMm = marginsMm.headersGap;
                docLayoutState.pageMargins.headersGap = mmToPx(marginsMm.headersGap);

                if (!docLayoutState.bodyStyle) docLayoutState.bodyStyle = {};
                docLayoutState.bodyStyle.paddingLeftMm = marginsMm.bodyExtraLeft;
                docLayoutState.bodyStyle.paddingRightMm = marginsMm.bodyExtraRight;
                docLayoutState.bodyStyle.paddingLeft = mmToPx(marginsMm.bodyExtraLeft);
                docLayoutState.bodyStyle.paddingRight = mmToPx(marginsMm.bodyExtraRight);

                if (!docLayoutState.docTitle) docLayoutState.docTitle = {};
                docLayoutState.docTitle.gapFromHeadersMm = marginsMm.headersToTitle;
                docLayoutState.docTitle.gapFromHeaders = mmToPx(marginsMm.headersToTitle);
                docLayoutState.docTitle.gapToBodyMm = marginsMm.titleToBody;
                docLayoutState.docTitle.gapToBody = mmToPx(marginsMm.titleToBody);

                if (!docLayoutState.signers) docLayoutState.signers = {};
                docLayoutState.signers.gapFromBodyMm = marginsMm.bodyToSigners;
                docLayoutState.signers.gapFromBody = mmToPx(marginsMm.bodyToSigners);
            }
        } catch (e) {}
    }

    // Реальне вимірювання фактичних відступів від країв аркуша А4 до тексту в ММ
    function measureActualTextDistancesMm() {
        const sheet = document.getElementById('a4-paper-sheet');
        const bodyEl = document.getElementById('doc-ed-body-text');
        const headersRow = document.getElementById('doc-ed-headers-row');
        const titleEl = document.getElementById('doc-ed-title');
        if (!sheet) return null;

        const sheetRect = sheet.getBoundingClientRect();
        const ratio = sheetRect.width > 100 ? (sheetRect.width / A4_WIDTH_MM) : 3.7795275591;

        let leftToBodyMm = Math.round((marginsMm.left + marginsMm.bodyExtraLeft) * 10) / 10;
        let rightToBodyMm = Math.round((marginsMm.right + marginsMm.bodyExtraRight) * 10) / 10;
        let topToFirstTextMm = marginsMm.top;
        let topToBodyTextMm = marginsMm.top;

        if (bodyEl) {
            const bodyRect = bodyEl.getBoundingClientRect();
            const padL = parseFloat(window.getComputedStyle(bodyEl).paddingLeft) || 0;
            const padR = parseFloat(window.getComputedStyle(bodyEl).paddingRight) || 0;
            leftToBodyMm = Math.round(((bodyRect.left - sheetRect.left + padL) / ratio) * 10) / 10;
            rightToBodyMm = Math.round(((sheetRect.right - bodyRect.right + padR) / ratio) * 10) / 10;
            topToBodyTextMm = Math.round(((bodyRect.top - sheetRect.top) / ratio) * 10) / 10;
        }

        const firstElem = headersRow || titleEl || bodyEl;
        if (firstElem) {
            const firstRect = firstElem.getBoundingClientRect();
            topToFirstTextMm = Math.round(((firstRect.top - sheetRect.top) / ratio) * 10) / 10;
        }

        return {
            leftToPageMm: marginsMm.left,
            rightToPageMm: marginsMm.right,
            topToPageMm: marginsMm.top,
            bottomToPageMm: marginsMm.bottom,
            leftToBodyMm,
            rightToBodyMm,
            topToFirstTextMm,
            topToBodyTextMm,
            textWidthMm: Math.max(0, Math.round((A4_WIDTH_MM - leftToBodyMm - rightToBodyMm) * 10) / 10)
        };
    }

    // Застосування усіх відступів у мм до елементів аркуша А4
    function applyAllMarginsToSheetDOM() {
        const sheet = document.getElementById('a4-paper-sheet');
        if (sheet) {
            sheet.style.paddingTop = marginsMm.top + 'mm';
            sheet.style.paddingRight = marginsMm.right + 'mm';
            sheet.style.paddingBottom = marginsMm.bottom + 'mm';
            sheet.style.paddingLeft = marginsMm.left + 'mm';
        }

        const bodyEl = document.getElementById('doc-ed-body-text');
        if (bodyEl) {
            bodyEl.style.paddingLeft = marginsMm.bodyExtraLeft + 'mm';
            bodyEl.style.paddingRight = marginsMm.bodyExtraRight + 'mm';
        }

        const headersRow = document.getElementById('doc-ed-headers-row');
        if (headersRow) {
            headersRow.style.gap = marginsMm.headersGap + 'mm';
            headersRow.style.marginBottom = marginsMm.headersToTitle + 'mm';
        }

        const titleEl = document.getElementById('doc-ed-title');
        if (titleEl) {
            titleEl.style.marginBottom = marginsMm.titleToBody + 'mm';
        }

        const signersWrap = document.getElementById('doc-ed-signers-wrap');
        if (signersWrap) {
            signersWrap.style.marginTop = marginsMm.bodyToSigners + 'mm';
        }
    }

    window.applyDocMarginMm = function (key, rawValue) {
        const val = Math.max(0, Math.min(120, Math.round((parseFloat(rawValue) || 0) * 10) / 10));
        marginsMm[key] = val;
        applyAllMarginsToSheetDOM();
        syncStateWithMainDoc();
        updateAllMarginInputsUI();
        renderVisualMmGuidesOnSheet();
    };

    window.stepDocMarginMm = function (key, deltaMm) {
        const current = Number(marginsMm[key] || 0);
        const next = Math.max(0, Math.min(120, Math.round((current + deltaMm) * 10) / 10));
        window.applyDocMarginMm(key, next);
    };

    window.applyStandardMarginsPresetMm = function (leftMm, rightMm, topMm, bottomMm) {
        marginsMm.left = leftMm;
        marginsMm.right = rightMm;
        marginsMm.top = topMm;
        marginsMm.bottom = bottomMm;
        marginsMm.bodyExtraLeft = 0;
        marginsMm.bodyExtraRight = 0;
        applyAllMarginsToSheetDOM();
        syncStateWithMainDoc();
        updateAllMarginInputsUI();
        renderVisualMmGuidesOnSheet();
    };

    window.applyMarginTemplateById = function (tplId) {
        if (!tplId) return;
        const list = getSavedMarginTemplates();
        const found = list.find(t => t.id === tplId);
        if (!found) return;
        marginsMm.left = Number(found.left ?? 25);
        marginsMm.right = Number(found.right ?? 15);
        marginsMm.top = Number(found.top ?? 20);
        marginsMm.bottom = Number(found.bottom ?? 20);
        marginsMm.bodyExtraLeft = Number(found.bodyExtraLeft ?? 0);
        marginsMm.bodyExtraRight = Number(found.bodyExtraRight ?? 0);
        marginsMm.headersGap = Number(found.headersGap ?? 4);
        marginsMm.headersToTitle = Number(found.headersToTitle ?? 6);
        marginsMm.titleToBody = Number(found.titleToBody ?? 5);
        marginsMm.bodyToSigners = Number(found.bodyToSigners ?? 8);
        applyAllMarginsToSheetDOM();
        syncStateWithMainDoc();
        updateAllMarginInputsUI();
        renderVisualMmGuidesOnSheet();
        if (typeof showDocToast === 'function') {
            showDocToast(`✅ Застосовано відступи: Ліва ${marginsMm.left} мм, Права ${marginsMm.right} мм, Верх ${marginsMm.top} мм, Низ ${marginsMm.bottom} мм`, '#0284c7');
        }
    };

    window.saveCurrentMarginsAsTemplate = function () {
        const nameInp = document.getElementById('mm-custom-tpl-name');
        const customName = nameInp && nameInp.value.trim()
            ? nameInp.value.trim()
            : `Відступи: Л-${marginsMm.left} / П-${marginsMm.right} / В-${marginsMm.top} / Н-${marginsMm.bottom} мм`;
        const list = getSavedMarginTemplates();
        const newTpl = {
            id: 'mtpl_' + Date.now(),
            name: customName,
            left: marginsMm.left,
            right: marginsMm.right,
            top: marginsMm.top,
            bottom: marginsMm.bottom,
            bodyExtraLeft: marginsMm.bodyExtraLeft,
            bodyExtraRight: marginsMm.bodyExtraRight,
            headersGap: marginsMm.headersGap,
            headersToTitle: marginsMm.headersToTitle,
            titleToBody: marginsMm.titleToBody,
            bodyToSigners: marginsMm.bodyToSigners
        };
        list.unshift(newTpl);
        saveMarginTemplates(list);
        if (nameInp) nameInp.value = '';
        refreshMarginTemplatesSelectUI();
        if (typeof showDocToast === 'function') {
            showDocToast(`💾 Шаблон відступів «${customName}» збережено!`, '#16a34a');
        }
    };

    window.deleteSelectedMarginTemplate = function () {
        const sel = document.getElementById('mm-tpl-select');
        if (!sel || !sel.value) return;
        const list = getSavedMarginTemplates().filter(t => t.id !== sel.value);
        saveMarginTemplates(list);
        refreshMarginTemplatesSelectUI();
        if (typeof showDocToast === 'function') {
            showDocToast('🗑️ Шаблон відступів видалено', '#dc2626');
        }
    };

    function refreshMarginTemplatesSelectUI() {
        const sel = document.getElementById('mm-tpl-select');
        if (!sel) return;
        const list = getSavedMarginTemplates();
        sel.innerHTML = `<option value="">📂 Обрати шаблон відступів у мм (${list.length})...</option>` +
            list.map((t, i) => `<option value="${t.id}">${i + 1}. ${t.name}</option>`).join('');
    }

    window.toggleVisualMmGuides = function (checked) {
        marginsMm.showGuides = !!checked;
        renderVisualMmGuidesOnSheet();
    };

    // Візуальні лінійки та стрілки в ММ прямо на аркуші А4
    function renderVisualMmGuidesOnSheet() {
        const sheet = document.getElementById('a4-paper-sheet');
        if (!sheet) return;

        let overlay = document.getElementById('a4-mm-measurement-overlay');
        if (!marginsMm.showGuides) {
            if (overlay) overlay.remove();
            return;
        }

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'a4-mm-measurement-overlay';
            overlay.className = 'a4-non-print-helper';
            overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:30;overflow:hidden;font-family:Arial,sans-serif;';
            sheet.appendChild(overlay);
        }

        const measured = measureActualTextDistancesMm() || {
            leftToPageMm: marginsMm.left,
            rightToPageMm: marginsMm.right,
            topToPageMm: marginsMm.top,
            bottomToPageMm: marginsMm.bottom,
            leftToBodyMm: marginsMm.left + marginsMm.bodyExtraLeft,
            rightToBodyMm: marginsMm.right + marginsMm.bodyExtraRight,
            topToFirstTextMm: marginsMm.top,
            topToBodyTextMm: marginsMm.top,
            textWidthMm: A4_WIDTH_MM - marginsMm.left - marginsMm.right
        };

        const totalLeftMm = Math.round((marginsMm.left + marginsMm.bodyExtraLeft) * 10) / 10;
        const totalRightMm = Math.round((marginsMm.right + marginsMm.bodyExtraRight) * 10) / 10;

        overlay.innerHTML = `
            <!-- Межа та стрілка ЗЛІВА до тексту (мм) -->
            <div style="position:absolute;top:0;bottom:0;left:${totalLeftMm}mm;border-left:1.5px dashed rgba(2,132,199,0.6);"></div>
            <div style="position:absolute;top:50%;left:0;width:${totalLeftMm}mm;display:flex;align-items:center;justify-content:center;">
                <div style="width:100%;border-top:2px solid #0284c7;position:relative;display:flex;justify-content:center;">
                    <span style="background:#0284c7;color:#fff;font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;margin-top:-9px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2);">⬅️ ${totalLeftMm} мм</span>
                </div>
            </div>

            <!-- Межа та стрілка СПРАВА до тексту (мм) -->
            <div style="position:absolute;top:0;bottom:0;right:${totalRightMm}mm;border-right:1.5px dashed rgba(22,163,74,0.6);"></div>
            <div style="position:absolute;top:50%;right:0;width:${totalRightMm}mm;display:flex;align-items:center;justify-content:center;">
                <div style="width:100%;border-top:2px solid #16a34a;position:relative;display:flex;justify-content:center;">
                    <span style="background:#16a34a;color:#fff;font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;margin-top:-9px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2);">${totalRightMm} мм ➡️</span>
                </div>
            </div>

            <!-- Межа та стрілка ЗВЕРХУ до тексту (мм) -->
            <div style="position:absolute;left:0;right:0;top:${marginsMm.top}mm;border-top:1.5px dashed rgba(109,40,217,0.6);"></div>
            <div style="position:absolute;top:0;left:50%;height:${marginsMm.top}mm;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;">
                <div style="height:100%;border-left:2px solid #6d28d9;display:flex;align-items:center;">
                    <span style="background:#6d28d9;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;margin-left:4px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2);">⬆️ Зверху: ${marginsMm.top} мм (до тексту: ${measured.topToBodyTextMm} мм)</span>
                </div>
            </div>

            <!-- Межа та стрілка ЗНИЗУ аркуша (мм) -->
            <div style="position:absolute;left:0;right:0;bottom:${marginsMm.bottom}mm;border-bottom:1.5px dashed rgba(180,83,9,0.6);"></div>
            <div style="position:absolute;bottom:0;left:50%;height:${marginsMm.bottom}mm;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;">
                <div style="height:100%;border-left:2px solid #b45309;display:flex;align-items:center;">
                    <span style="background:#b45309;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;margin-left:4px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2);">⬇️ Знизу: ${marginsMm.bottom} мм</span>
                </div>
            </div>
        `;
    }

    function updateAllMarginInputsUI() {
        const measured = measureActualTextDistancesMm();
        const keys = ['left', 'right', 'top', 'bottom', 'bodyExtraLeft', 'bodyExtraRight', 'headersGap', 'headersToTitle', 'titleToBody', 'bodyToSigners'];
        keys.forEach(k => {
            const val = marginsMm[k];
            document.querySelectorAll(`[data-mm-input="${k}"]`).forEach(el => {
                if (document.activeElement !== el) el.value = val;
            });
            document.querySelectorAll(`[data-mm-label="${k}"]`).forEach(el => {
                el.textContent = val + ' мм';
            });
        });

        if (measured) {
            const box = document.getElementById('mm-category-live-meter');
            if (box) {
                box.innerHTML = `
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;">
                        <div>⬅️ Зліва до тексту: <b style="color:#0284c7;">${measured.leftToBodyMm} мм</b></div>
                        <div>➡️ Справа до тексту: <b style="color:#16a34a;">${measured.rightToBodyMm} мм</b></div>
                        <div>⬆️ Зверху до шапки: <b style="color:#6d28d9;">${measured.topToPageMm} мм</b></div>
                        <div>⬆️ Зверху до тексту: <b style="color:#6d28d9;">${measured.topToBodyTextMm} мм</b></div>
                        <div>⬇️ Знизу аркуша: <b style="color:#b45309;">${measured.bottomToPageMm} мм</b></div>
                        <div>📏 Ширина тексту: <b style="color:#0f172a;">${measured.textWidthMm} мм</b></div>
                    </div>
                `;
            }
        }
    }

    // HTML окремої спеціальної категорії у лівій колонці (під блоком "Додати графічний підпис")
    function buildDedicatedLeftCategoryHtml() {
        const list = getSavedMarginTemplates();
        const measured = measureActualTextDistancesMm() || {
            leftToBodyMm: marginsMm.left + marginsMm.bodyExtraLeft,
            rightToBodyMm: marginsMm.right + marginsMm.bodyExtraRight,
            topToPageMm: marginsMm.top,
            topToBodyTextMm: marginsMm.top,
            bottomToPageMm: marginsMm.bottom,
            textWidthMm: A4_WIDTH_MM - marginsMm.left - marginsMm.right
        };

        return `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
                <span style="font-weight:800;font-size:13px;color:#b45309;">📐 7. Відступи до тексту в міліметрах (мм):</span>
                <button type="button" onclick="applyStandardMarginsPresetMm(25, 15, 20, 20)" style="background:#fef08a;color:#713f12;border:1px solid #facc15;border-radius:5px;padding:3px 8px;font-size:11px;font-weight:700;cursor:pointer;">🔄 Стандарт (25/15/20/20 мм)</button>
            </div>

            <!-- Шаблони відступів у мм -->
            <div style="background:#ffffff;border:1px solid #fde68a;border-radius:6px;padding:7px;margin-bottom:8px;">
                <div style="display:flex;gap:4px;align-items:center;margin-bottom:5px;">
                    <select id="mm-tpl-select" onchange="if(this.value) applyMarginTemplateById(this.value)" style="flex:1;min-width:0;background:#f8fafc;color:#0f172a;border:1px solid #94a3b8;border-radius:4px;padding:4px 6px;font-size:11px;font-weight:600;cursor:pointer;">
                        <option value="">📂 Обрати шаблон відступів у мм (${list.length})...</option>
                        ${list.map((t, i) => `<option value="${t.id}">${i + 1}. ${t.name}</option>`).join('')}
                    </select>
                    <button type="button" onclick="deleteSelectedMarginTemplate()" style="background:#ef4444;color:#fff;border:none;border-radius:4px;padding:4px 7px;font-size:11px;cursor:pointer;" title="Видалити обраний шаблон">🗑️</button>
                </div>
                <div style="display:flex;gap:4px;align-items:center;">
                    <input type="text" id="mm-custom-tpl-name" placeholder="Назва нового шаблону відступів..." style="flex:1;min-width:0;background:#ffffff;color:#0f172a;border:1px solid #cbd5e1;border-radius:4px;padding:4px 6px;font-size:11px;" />
                    <button type="button" onclick="saveCurrentMarginsAsTemplate()" style="background:#d97706;color:#ffffff;border:none;border-radius:4px;padding:4px 9px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">💾 Зберегти</button>
                </div>
            </div>

            <!-- Табло точного вимірювання в реальному часі (в мм) -->
            <div style="background:#ffffff;border:1px solid #facc15;border-radius:6px;padding:7px 9px;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="font-size:11px;font-weight:800;color:#854d0e;">📏 Фактичний вимір до тексту (А4 = 210×297 мм):</span>
                    <label style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:#0369a1;cursor:pointer;">
                        <input type="checkbox" ${marginsMm.showGuides ? 'checked' : ''} onchange="toggleVisualMmGuides(this.checked)" style="cursor:pointer;" />
                        Лінійки на А4
                    </label>
                </div>
                <div id="mm-category-live-meter">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;">
                        <div>⬅️ Зліва до тексту: <b style="color:#0284c7;">${measured.leftToBodyMm} мм</b></div>
                        <div>➡️ Справа до тексту: <b style="color:#16a34a;">${measured.rightToBodyMm} мм</b></div>
                        <div>⬆️ Зверху до шапки: <b style="color:#6d28d9;">${measured.topToPageMm} мм</b></div>
                        <div>⬆️ Зверху до тексту: <b style="color:#6d28d9;">${measured.topToBodyTextMm} мм</b></div>
                        <div>⬇️ Знизу аркуша: <b style="color:#b45309;">${measured.bottomToPageMm} мм</b></div>
                        <div>📏 Ширина тексту: <b style="color:#0f172a;">${measured.textWidthMm} мм</b></div>
                    </div>
                </div>
            </div>

            <!-- 1. ВІДСТУП ЗЛІВА ДО ТЕКСТУ (ММ) -->
            <div style="background:#f0f9ff;border:1px solid #7dd3fc;border-radius:6px;padding:7px 8px;margin-bottom:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:800;color:#0369a1;margin-bottom:4px;">
                    <span>⬅️ Відступ ЗЛІВА до тексту (мм):</span>
                    <b data-mm-label="left">${marginsMm.left} мм</b>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                    <button type="button" onclick="stepDocMarginMm('left', -1)" style="background:#0284c7;color:#fff;border:none;border-radius:4px;width:24px;height:24px;cursor:pointer;font-weight:bold;">−</button>
                    <input type="range" data-mm-input="left" min="0" max="70" step="0.5" value="${marginsMm.left}" oninput="applyDocMarginMm('left', this.value)" style="flex:1;" />
                    <button type="button" onclick="stepDocMarginMm('left', 1)" style="background:#0284c7;color:#fff;border:none;border-radius:4px;width:24px;height:24px;cursor:pointer;font-weight:bold;">+</button>
                    <input type="number" data-mm-input="left" min="0" max="100" step="0.5" value="${marginsMm.left}" oninput="applyDocMarginMm('left', this.value)" style="width:48px;text-align:center;border:1px solid #0284c7;border-radius:4px;padding:2px;font-size:12px;font-weight:bold;" />
                    <span style="font-size:11px;font-weight:700;color:#0369a1;">мм</span>
                </div>
            </div>

            <!-- 2. ВІДСТУП СПРАВА ДО ТЕКСТУ (ММ) -->
            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:7px 8px;margin-bottom:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:800;color:#15803d;margin-bottom:4px;">
                    <span>➡️ Відступ СПРАВА до тексту (мм):</span>
                    <b data-mm-label="right">${marginsMm.right} мм</b>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                    <button type="button" onclick="stepDocMarginMm('right', -1)" style="background:#16a34a;color:#fff;border:none;border-radius:4px;width:24px;height:24px;cursor:pointer;font-weight:bold;">−</button>
                    <input type="range" data-mm-input="right" min="0" max="70" step="0.5" value="${marginsMm.right}" oninput="applyDocMarginMm('right', this.value)" style="flex:1;" />
                    <button type="button" onclick="stepDocMarginMm('right', 1)" style="background:#16a34a;color:#fff;border:none;border-radius:4px;width:24px;height:24px;cursor:pointer;font-weight:bold;">+</button>
                    <input type="number" data-mm-input="right" min="0" max="100" step="0.5" value="${marginsMm.right}" oninput="applyDocMarginMm('right', this.value)" style="width:48px;text-align:center;border:1px solid #16a34a;border-radius:4px;padding:2px;font-size:12px;font-weight:bold;" />
                    <span style="font-size:11px;font-weight:700;color:#15803d;">мм</span>
                </div>
            </div>

            <!-- 3. ВІДСТУП ЗВЕРХУ ДО ТЕКСТУ (ММ) -->
            <div style="background:#f5f3ff;border:1px solid #c4b5fd;border-radius:6px;padding:7px 8px;margin-bottom:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:800;color:#6d28d9;margin-bottom:4px;">
                    <span>⬆️ Відступ ЗВЕРХУ до тексту (мм):</span>
                    <b data-mm-label="top">${marginsMm.top} мм</b>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                    <button type="button" onclick="stepDocMarginMm('top', -1)" style="background:#6d28d9;color:#fff;border:none;border-radius:4px;width:24px;height:24px;cursor:pointer;font-weight:bold;">−</button>
                    <input type="range" data-mm-input="top" min="0" max="80" step="0.5" value="${marginsMm.top}" oninput="applyDocMarginMm('top', this.value)" style="flex:1;" />
                    <button type="button" onclick="stepDocMarginMm('top', 1)" style="background:#6d28d9;color:#fff;border:none;border-radius:4px;width:24px;height:24px;cursor:pointer;font-weight:bold;">+</button>
                    <input type="number" data-mm-input="top" min="0" max="120" step="0.5" value="${marginsMm.top}" oninput="applyDocMarginMm('top', this.value)" style="width:48px;text-align:center;border:1px solid #6d28d9;border-radius:4px;padding:2px;font-size:12px;font-weight:bold;" />
                    <span style="font-size:11px;font-weight:700;color:#6d28d9;">мм</span>
                </div>
            </div>

            <!-- 4. ВІДСТУП ЗНИЗУ АРКУША (ММ) -->
            <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:6px;padding:7px 8px;margin-bottom:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:800;color:#c2410c;margin-bottom:4px;">
                    <span>⬇️ Відступ ЗНИЗУ аркуша (мм):</span>
                    <b data-mm-label="bottom">${marginsMm.bottom} мм</b>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                    <button type="button" onclick="stepDocMarginMm('bottom', -1)" style="background:#ea580c;color:#fff;border:none;border-radius:4px;width:24px;height:24px;cursor:pointer;font-weight:bold;">−</button>
                    <input type="range" data-mm-input="bottom" min="0" max="80" step="0.5" value="${marginsMm.bottom}" oninput="applyDocMarginMm('bottom', this.value)" style="flex:1;" />
                    <button type="button" onclick="stepDocMarginMm('bottom', 1)" style="background:#ea580c;color:#fff;border:none;border-radius:4px;width:24px;height:24px;cursor:pointer;font-weight:bold;">+</button>
                    <input type="number" data-mm-input="bottom" min="0" max="120" step="0.5" value="${marginsMm.bottom}" oninput="applyDocMarginMm('bottom', this.value)" style="width:48px;text-align:center;border:1px solid #ea580c;border-radius:4px;padding:2px;font-size:12px;font-weight:bold;" />
                    <span style="font-size:11px;font-weight:700;color:#c2410c;">мм</span>
                </div>
            </div>

            <!-- 5. ВНУТРІШНІ ВІДСТУПИ МІЖ БЛОКАМИ В ММ -->
            <div style="background:#ffffff;border:1px solid #fde68a;border-radius:6px;padding:7px 8px;display:flex;flex-direction:column;gap:5px;">
                <div style="font-size:11px;font-weight:800;color:#854d0e;margin-bottom:2px;">📐 Відступи між блоками документа (у мм):</div>
                
                <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:11px;">
                    <span style="color:#0f766e;font-weight:700;">📝 Текст додатково зліва:</span>
                    <div style="display:flex;align-items:center;gap:3px;">
                        <button type="button" onclick="stepDocMarginMm('bodyExtraLeft', -1)" style="background:#e2e8f0;border:1px solid #94a3b8;border-radius:3px;width:20px;height:20px;cursor:pointer;font-weight:bold;">−</button>
                        <input type="number" data-mm-input="bodyExtraLeft" min="0" max="80" step="0.5" value="${marginsMm.bodyExtraLeft}" oninput="applyDocMarginMm('bodyExtraLeft', this.value)" style="width:44px;text-align:center;border:1px solid #cbd5e1;border-radius:3px;padding:1px;font-weight:bold;" />
                        <button type="button" onclick="stepDocMarginMm('bodyExtraLeft', 1)" style="background:#e2e8f0;border:1px solid #94a3b8;border-radius:3px;width:20px;height:20px;cursor:pointer;font-weight:bold;">+</button>
                        <b>мм</b>
                    </div>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:11px;">
                    <span style="color:#0f766e;font-weight:700;">📝 Текст додатково справа:</span>
                    <div style="display:flex;align-items:center;gap:3px;">
                        <button type="button" onclick="stepDocMarginMm('bodyExtraRight', -1)" style="background:#e2e8f0;border:1px solid #94a3b8;border-radius:3px;width:20px;height:20px;cursor:pointer;font-weight:bold;">−</button>
                        <input type="number" data-mm-input="bodyExtraRight" min="0" max="80" step="0.5" value="${marginsMm.bodyExtraRight}" oninput="applyDocMarginMm('bodyExtraRight', this.value)" style="width:44px;text-align:center;border:1px solid #cbd5e1;border-radius:3px;padding:1px;font-weight:bold;" />
                        <button type="button" onclick="stepDocMarginMm('bodyExtraRight', 1)" style="background:#e2e8f0;border:1px solid #94a3b8;border-radius:3px;width:20px;height:20px;cursor:pointer;font-weight:bold;">+</button>
                        <b>мм</b>
                    </div>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:11px;">
                    <span style="color:#6d28d9;font-weight:700;">↕️ Від шапок до заголовка:</span>
                    <div style="display:flex;align-items:center;gap:3px;">
                        <button type="button" onclick="stepDocMarginMm('headersToTitle', -1)" style="background:#e2e8f0;border:1px solid #94a3b8;border-radius:3px;width:20px;height:20px;cursor:pointer;font-weight:bold;">−</button>
                        <input type="number" data-mm-input="headersToTitle" min="0" max="90" step="0.5" value="${marginsMm.headersToTitle}" oninput="applyDocMarginMm('headersToTitle', this.value)" style="width:44px;text-align:center;border:1px solid #cbd5e1;border-radius:3px;padding:1px;font-weight:bold;" />
                        <button type="button" onclick="stepDocMarginMm('headersToTitle', 1)" style="background:#e2e8f0;border:1px solid #94a3b8;border-radius:3px;width:20px;height:20px;cursor:pointer;font-weight:bold;">+</button>
                        <b>мм</b>
                    </div>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:11px;">
                    <span style="color:#6d28d9;font-weight:700;">↕️ Від заголовка до тексту:</span>
                    <div style="display:flex;align-items:center;gap:3px;">
                        <button type="button" onclick="stepDocMarginMm('titleToBody', -1)" style="background:#e2e8f0;border:1px solid #94a3b8;border-radius:3px;width:20px;height:20px;cursor:pointer;font-weight:bold;">−</button>
                        <input type="number" data-mm-input="titleToBody" min="0" max="90" step="0.5" value="${marginsMm.titleToBody}" oninput="applyDocMarginMm('titleToBody', this.value)" style="width:44px;text-align:center;border:1px solid #cbd5e1;border-radius:3px;padding:1px;font-weight:bold;" />
                        <button type="button" onclick="stepDocMarginMm('titleToBody', 1)" style="background:#e2e8f0;border:1px solid #94a3b8;border-radius:3px;width:20px;height:20px;cursor:pointer;font-weight:bold;">+</button>
                        <b>мм</b>
                    </div>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:11px;">
                    <span style="color:#b45309;font-weight:700;">↕️ Від тексту до підписантів:</span>
                    <div style="display:flex;align-items:center;gap:3px;">
                        <button type="button" onclick="stepDocMarginMm('bodyToSigners', -1)" style="background:#e2e8f0;border:1px solid #94a3b8;border-radius:3px;width:20px;height:20px;cursor:pointer;font-weight:bold;">−</button>
                        <input type="number" data-mm-input="bodyToSigners" min="0" max="100" step="0.5" value="${marginsMm.bodyToSigners}" oninput="applyDocMarginMm('bodyToSigners', this.value)" style="width:44px;text-align:center;border:1px solid #cbd5e1;border-radius:3px;padding:1px;font-weight:bold;" />
                        <button type="button" onclick="stepDocMarginMm('bodyToSigners', 1)" style="background:#e2e8f0;border:1px solid #94a3b8;border-radius:3px;width:20px;height:20px;cursor:pointer;font-weight:bold;">+</button>
                        <b>мм</b>
                    </div>
                </div>
            </div>
        `;
    }

    // Вбудовування окремої категорії в ліву колонку прямо під блоком "Додати графічний підпис"
    function ensureMarginsMmCategoryMounted() {
        const sheet = document.getElementById('a4-paper-sheet');
        if (!sheet) return;

        // Знаходимо ліву колонку (де знаходиться блок графічного підпису #sig-color-select)
        const sigSelect = document.getElementById('sig-color-select');
        const sigBlock = sigSelect ? sigSelect.closest('div[style*="fdf2f8"]') : null;
        const leftSidebar = sigBlock ? sigBlock.parentElement : null;

        if (leftSidebar) {
            // Прибираємо штучне обмеження висоти лівої панелі, щоб нова категорія знизу була повністю відкрита
            leftSidebar.style.maxHeight = 'none';
            leftSidebar.style.overflowY = 'visible';

            let catBox = document.getElementById('doc-margins-mm-dedicated-category');
            if (!catBox) {
                loadMarginsStateFromDoc();
                catBox = document.createElement('div');
                catBox.id = 'doc-margins-mm-dedicated-category';
                catBox.style.cssText = 'background:#fefce8;border:2px solid #f59e0b;border-radius:8px;padding:12px;margin-top:12px;box-shadow:0 2px 8px rgba(245,158,11,0.15);';
                leftSidebar.appendChild(catBox);
                catBox.innerHTML = buildDedicatedLeftCategoryHtml();

                applyAllMarginsToSheetDOM();
                renderVisualMmGuidesOnSheet();
            } else {
                renderVisualMmGuidesOnSheet();
                updateAllMarginInputsUI();
            }
        }
    }

    setInterval(ensureMarginsMmCategoryMounted, 350);
})();