(() => {
    const prefix = 'pmm_pdf_link_';

    function allowed(edit = false) {
        const role = getCurrentUserRoleForDocs();
        return window.canRoleAccess?.(role, 'documents') &&
            (!edit || window.canRoleEdit?.(role, 'documents'));
    }

    function pdfUrl(value) {
        const url = new URL(value);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
            throw new Error('Invalid URL');
        }
        return url.href;
    }

    window.openPdfLinks = function () {
        if (!allowed() || document.getElementById('pdf-links-dialog')) return;
        const dialog = document.createElement('dialog');
        dialog.id = 'pdf-links-dialog';
        dialog.setAttribute('aria-labelledby', 'pdf-links-title');
        dialog.innerHTML = `
            <header>
                <h2 id="pdf-links-title">Додати або відкрити PDF</h2>
                <form method="dialog"><button class="doc-green-btn doc-green-btn-small" type="submit">Закрити</button></form>
            </header>
            <form id="pdf-links-form">
                <label>Посилання на PDF
                    <input name="url" type="url" required maxlength="2048" placeholder="https://…">
                </label>
                <label>Опис
                    <input name="description" required maxlength="300">
                </label>
                <button type="submit" class="doc-green-btn">Додати PDF</button>
            </form>
            <p role="status"></p>
            <ul></ul>
        `;
        const form = dialog.querySelector('#pdf-links-form');
        const status = dialog.querySelector('[role="status"]');
        const list = dialog.querySelector('ul');
        form.hidden = !allowed(true);

        function render() {
            if (!allowed()) {
                dialog.close();
                return;
            }
            form.hidden = !allowed(true);
            list.replaceChildren();
            try {
                for (const key of Object.keys(localStorage).filter(key => key.startsWith(prefix))) {
                    let record, url;
                    try {
                        record = JSON.parse(localStorage.getItem(key));
                        url = pdfUrl(record.url);
                    } catch (_) { continue; }
                    if (typeof record.description !== 'string') continue;

                    const item = document.createElement('li');
                    const link = document.createElement('a');
                    link.href = url;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.textContent = 'Відкрити PDF — ' + record.description;
                    link.addEventListener('click', event => {
                        if (!allowed()) event.preventDefault();
                    });
                    const copy = document.createElement('button');
                    copy.type = 'button';
                    copy.className = 'doc-green-btn doc-green-btn-small';
                    copy.textContent = 'Копіювати посилання';
                    copy.addEventListener('click', async () => {
                        if (!allowed()) return;
                        try {
                            await navigator.clipboard.writeText(url);
                            status.textContent = 'Посилання скопійовано.';
                        } catch (_) {
                            status.textContent = 'Не вдалося скопіювати. Скористайтеся меню посилання.';
                        }
                    });
                    item.append(link, ' ', copy);
                    if (allowed(true)) {
                        const remove = document.createElement('button');
                        remove.type = 'button';
                        remove.className = 'doc-green-btn doc-green-btn-small';
                        remove.textContent = 'Видалити';
                        remove.addEventListener('click', () => {
                            if (!allowed(true) || !confirm('Видалити це посилання?')) return;
                            try {
                                localStorage.removeItem(key);
                                status.textContent = 'Посилання видалено.';
                                render();
                            } catch (_) {
                                status.textContent = 'Не вдалося видалити посилання.';
                            }
                        });
                        item.append(' ', remove);
                    }
                    list.append(item);
                }
                if (!list.childElementCount) list.textContent = 'Збережених посилань ще немає.';
            } catch (_) {
                status.textContent = 'Не вдалося прочитати збережені посилання.';
            }
        }

        form.addEventListener('submit', event => {
            event.preventDefault();
            if (!allowed(true)) return;
            const description = form.elements.description.value.trim();
            let url;
            try {
                url = pdfUrl(form.elements.url.value.trim());
                if (!description) throw new Error('Empty description');
            } catch (_) {
                status.textContent = 'Введіть опис і посилання, що починається з https:// або http://.';
                return;
            }
            try {
                localStorage.setItem(prefix + crypto.randomUUID(), JSON.stringify({url, description}));
                form.reset();
                status.textContent = 'Посилання додано.';
                render();
            } catch (_) {
                status.textContent = 'Не вдалося зберегти посилання.';
            }
        });
        document.body.append(dialog);
        dialog.addEventListener('close', () => {
            clearInterval(refresh);
            dialog.remove();
        }, {once: true});
        dialog.showModal();
        let snapshot;
        const refresh = setInterval(() => {
            const current = state();
            if (current !== snapshot) {
                snapshot = current;
                render();
            }
        }, 4000);
        function state() {
            try {
                return JSON.stringify([allowed(), allowed(true), Object.keys(localStorage)
                    .filter(key => key.startsWith(prefix)).map(key => [key, localStorage.getItem(key)])]);
            } catch (_) {
                return null;
            }
        }
        snapshot = state();
        render();
    };
})();
