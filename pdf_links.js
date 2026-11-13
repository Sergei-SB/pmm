(() => {
    const prefix = 'pmm_pdf_link_';
    let refresh;

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
        if (!allowed()) return;
        const page = document.getElementById('pdf-links-view');
        if (!page) return;
        clearInterval(refresh);
        page.innerHTML = `<div id="pdf-links-page">
            <header>
                <h2 id="pdf-links-title" tabindex="-1">📄 Документи PDF</h2>
                <div class="pdf-links-actions">
                    <button class="doc-green-btn" id="pdf-add-btn" type="button" aria-expanded="false" aria-controls="pdf-links-form">＋ Додати PDF</button>
                    <button class="doc-green-btn" type="button" onclick="switchView('documents')">← До документів</button>
                </div>
            </header>
            <form id="pdf-links-form" hidden>
                <label>Посилання на PDF
                    <input name="url" type="url" required maxlength="2048" placeholder="https://…">
                </label>
                <label>Опис
                    <input name="description" required maxlength="300">
                </label>
                <button type="submit" class="doc-green-btn">Зберегти</button>
            </form>
            <p role="status"></p>
            <div class="pdf-links-table"><table>
                <thead><tr><th scope="col">№</th><th scope="col">Назва документа / опис</th><th scope="col">Формат / Тип</th><th scope="col">Дії</th></tr></thead>
                <tbody></tbody>
            </table></div></div>
        `;
        const form = page.querySelector('#pdf-links-form');
        const status = page.querySelector('[role="status"]');
        const list = page.querySelector('tbody');
        const add = page.querySelector('#pdf-add-btn');
        add.addEventListener('click', () => {
            if (!allowed(true)) return;
            form.hidden = !form.hidden;
            add.setAttribute('aria-expanded', String(!form.hidden));
            if (!form.hidden) form.elements.url.focus();
        });

        function render() {
            if (!allowed()) {
                switchView('base');
                return;
            }
            add.hidden = !allowed(true);
            if (add.hidden) {
                form.hidden = true;
                add.setAttribute('aria-expanded', 'false');
            }
            list.replaceChildren();
            try {
                for (const key of Object.keys(localStorage).filter(key => key.startsWith(prefix))) {
                    let record, url;
                    try {
                        record = JSON.parse(localStorage.getItem(key));
                        url = pdfUrl(record.url);
                    } catch (_) { continue; }
                    if (typeof record.description !== 'string') continue;

                    const item = list.insertRow();
                    item.insertCell().textContent = String(list.rows.length);
                    const title = item.insertCell();
                    item.insertCell().textContent = 'PDF';
                    const actions = item.insertCell();
                    const link = document.createElement('a');
                    link.href = url;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.textContent = record.description;
                    title.append(link);
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
                    actions.append(copy);
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
                        actions.append(remove);
                    }
                }
                if (!list.rows.length) {
                    const empty = list.insertRow().insertCell();
                    empty.colSpan = 4;
                    empty.className = 'pdf-links-empty';
                    empty.textContent = 'Збережених PDF ще немає.';
                }
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
        switchView('pdf-links');
        page.querySelector('h2').focus();
        let snapshot = state();
        refresh = setInterval(() => {
            if (!page.classList.contains('active')) {
                clearInterval(refresh);
                page.replaceChildren();
                return;
            }
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
        render();
    };
})();
