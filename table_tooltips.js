(() => {
    const cellSelector = '.view-section table :is(td, th)';
    const controlSelector = 'input:is(:not([type]), [type="text"], [type="search"], [type="number"], [type="email"], [type="url"]), textarea, select';
    const context = document.createElement('canvas').getContext('2d');
    const originalTitles = new WeakMap();

    function setTooltip(element, text) {
        if (text) {
            if (!originalTitles.has(element)) originalTitles.set(element, element.getAttribute('title'));
            element.title = text;
        } else if (originalTitles.has(element)) {
            const original = originalTitles.get(element);
            if (original === null) element.removeAttribute('title');
            else element.title = original;
            originalTitles.delete(element);
        }
    }

    function clippedControlText(control) {
        const text = control.matches('select') ? control.selectedOptions[0]?.textContent : control.value;
        if (!text) return '';
        if (control.matches('textarea')) {
            return control.scrollHeight > control.clientHeight || control.scrollWidth > control.clientWidth ? text : '';
        }
        if (!context) return '';
        const style = getComputedStyle(control);
        const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const indicator = control.matches('select') ? 18 : 0;
        context.font = style.font || `${style.fontSize} ${style.fontFamily}`;
        return context.measureText(text).width > control.clientWidth - padding - indicator ? text : '';
    }

    function updateTooltip(event) {
        const target = event.target;
        const cell = target.closest?.(cellSelector);
        if (!cell) return;
        const control = target.closest(controlSelector) || (cell.matches('td') && cell.querySelector(controlSelector));
        if (control) {
            const text = clippedControlText(control);
            setTooltip(control, text);
            setTooltip(cell, text);
            return;
        }
        let text = '';
        for (let node = target; node && cell.contains(node); node = node.parentElement) {
            if (node.clientWidth && node.scrollWidth > node.clientWidth + 1) {
                text = cell.textContent.trim();
                break;
            }
        }
        setTooltip(cell, text);
    }

    document.addEventListener('mouseover', updateTooltip);
    document.addEventListener('input', updateTooltip);
    document.addEventListener('change', updateTooltip);
})();
