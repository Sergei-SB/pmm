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

    function shareAddress(key) {
        const address = new URL(location.pathname, location.origin);
        address.searchParams.set('pdf', key);
        return address.href;
    }

    const requestedPdf = new URLSearchParams(location.search).get('pdf');
    if (requestedPdf && /^pmm_pdf_link_[a-z0-9-]+$/i.test(requestedPdf)) {
        document.addEventListener('DOMContentLoaded', () => {
            const notice = document.createElement('aside');
            notice.className = 'pdf-share-notice';
            notice.style.cssText = 'padding:12px 18px;background:#eef8ef;color:#14532d;border-bottom:1px solid #bbd5c4';
            const message = document.createElement('span');
            message.setAttribute('role', 'status');
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'doc-green-btn doc-green-btn-small';
            retry.textContent = 'Відкрити PDF';
            notice.append(message, ' ', retry);
            document.querySelector('main').before(notice);
            let opening = false;
            let attempts = 0;
            async function openRequestedPdf() {
                if (opening) return;
                if (!allowed()) {
                    message.textContent = 'Щоб відкрити PDF за посиланням, увійдіть під роллю з доступом до «Документів та шаблонів».';
                    return;
                }
                opening = true;
                message.textContent = ++attempts < 8
                    ? 'Шукаємо PDF у спільній базі…'
                    : 'PDF поки недоступний. Перевірте, чи файл синхронізовано на комп’ютері, з якого його додали.';
                try {
                    const record = JSON.parse(localStorage.getItem(requestedPdf));
                    if (!record?.fileName || typeof record.fileName !== 'string') return;
                    const binary = await getDocBinaryFromIDB(requestedPdf);
                    if (!binary?.fileDataUrl || !allowed()) return;
                    window.openPdfLinks();
                    await openUniversalFilePreviewModal({
                        name: record.fileName, ext: 'pdf', dataUrl: binary.fileDataUrl,
                        shareUrl: shareAddress(requestedPdf)
                    });
                    clearInterval(timer);
                    notice.remove();
                } catch (_) {
                    // A shared file can arrive after its list entry.
                } finally {
                    opening = false;
                }
            }
            retry.addEventListener('click', openRequestedPdf);
            const timer = setInterval(openRequestedPdf, 2000);
            openRequestedPdf();
        });
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
                    <input name="url" type="url" maxlength="2048" placeholder="Введіть, вставте або перетягніть посилання">
                </label>
                <div id="pdf-drop-zone">
                    Перетягніть PDF сюди або
                    <button type="button" class="doc-green-btn doc-green-btn-small" id="pdf-pick-file">Вибрати файл</button>
                    <input type="file" name="pdfFile" accept=".pdf,application/pdf" hidden>
                    <span id="pdf-selected-file"></span>
                    <a id="pdf-open-selected" class="doc-green-btn doc-green-btn-small" target="_blank" rel="noopener noreferrer" hidden>Відкрити файл</a>
                </div>
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
        const urlInput = form.elements.url;
        const fileInput = form.elements.pdfFile;
        const dropZone = page.querySelector('#pdf-drop-zone');
        const selectedFile = page.querySelector('#pdf-selected-file');
        const preview = page.querySelector('#pdf-open-selected');
        let previewUrl;
        function clearPreview() {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = undefined;
            preview.hidden = true;
            preview.removeAttribute('href');
        }
        let file;
        let saving = false;
        let selectionVersion = 0;

        async function selectFile(candidate) {
            if (!allowed(true) || saving || !candidate) return;
            const version = ++selectionVersion;
            try {
                const valid = (await candidate.slice(0, 1024).text()).includes('%PDF-');
                if (version !== selectionVersion || saving || !allowed(true)) return;
                if (!valid) {
                    status.textContent = 'Виберіть дійсний PDF-файл.';
                    return;
                }
                file = candidate;
                clearPreview();
                previewUrl = URL.createObjectURL(new Blob([candidate], {type: 'application/pdf'}));
                preview.href = previewUrl;
                preview.hidden = false;
                urlInput.value = '';
                selectedFile.textContent = candidate.name;
                if (!form.elements.description.value.trim()) {
                    form.elements.description.value = candidate.name.replace(/\.pdf$/i, '').slice(0, 300);
                }
                status.textContent = '';
            } catch (_) {
                status.textContent = 'Не вдалося прочитати файл.';
            }
        }
        page.querySelector('#pdf-pick-file').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            selectFile(fileInput.files[0]);
            fileInput.value = '';
        });
        urlInput.addEventListener('input', () => {
            selectionVersion++;
            file = undefined;
            clearPreview();
            selectedFile.textContent = '';
        });
        urlInput.addEventListener('paste', event => {
            const pastedFile = event.clipboardData?.files[0];
            if (!pastedFile) return;
            event.preventDefault();
            selectFile(pastedFile);
        });
        for (const target of [urlInput, dropZone]) {
            target.addEventListener('dragover', event => event.preventDefault());
            target.addEventListener('drop', event => {
                event.preventDefault();
                if (!allowed(true) || saving) return;
                const data = event.dataTransfer;
                if (data.files.length) {
                    selectFile(data.files[0]);
                    return;
                }
                const value = (data.getData('text/uri-list') || data.getData('text/plain'))
                    .split(/\r?\n/).find(line => line.trim() && !line.startsWith('#'));
                try {
                    urlInput.value = pdfUrl(value?.trim());
                    urlInput.dispatchEvent(new Event('input'));
                    status.textContent = '';
                } catch (_) {
                    status.textContent = 'Перетягніть PDF-файл або посилання HTTP чи HTTPS.';
                }
            });
        }
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
                        if (!record.fileName) url = pdfUrl(record.url);
                    } catch (_) { continue; }
                    if (typeof record.description !== 'string') continue;

                    const item = list.insertRow();
                    item.insertCell().textContent = String(list.rows.length);
                    const title = item.insertCell();
                    item.insertCell().textContent = 'PDF';
                    const actions = item.insertCell();
                    const link = document.createElement(url ? 'a' : 'button');
                    if (url) {
                        link.href = url;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                    } else {
                        link.type = 'button';
                        link.className = 'doc-green-btn doc-green-btn-small';
                    }
                    link.textContent = record.description;
                    title.append(link);
                    link.addEventListener('click', async event => {
                        if (!allowed()) {
                            event.preventDefault();
                            return;
                        }
                        if (url) return;
                        try {
                            const binary = await getDocBinaryFromIDB(key);
                            if (!binary?.fileDataUrl) throw new Error('Missing PDF');
                            if (allowed()) await openUniversalFilePreviewModal({
                                name: record.fileName, ext: 'pdf', dataUrl: binary.fileDataUrl, shareUrl: shareAddress(key)
                            });
                        } catch (_) {
                            status.textContent = 'Файл ще недоступний. Спробуйте після синхронізації.';
                        }
                    });
                    if (allowed(true)) {
                        const remove = document.createElement('button');
                        remove.type = 'button';
                        remove.className = 'doc-green-btn doc-green-btn-small';
                        remove.textContent = 'Видалити';
                        remove.addEventListener('click', async () => {
                            if (!allowed(true) || !confirm('Видалити цей запис PDF?')) return;
                            remove.disabled = true;
                            try {
                                if (!url) await deleteDocBinaryFromIDB(key);
                                localStorage.removeItem(key);
                                status.textContent = 'Запис видалено.';
                                render();
                            } catch (_) {
                                status.textContent = 'Не вдалося видалити запис.';
                                remove.disabled = false;
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

        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (!allowed(true) || saving) return;
            const description = form.elements.description.value.trim();
            const selected = file;
            let url;
            try {
                if (!selected) url = pdfUrl(urlInput.value.trim());
                if (!description) throw new Error('Empty description');
            } catch (_) {
                status.textContent = 'Введіть опис і додайте PDF-файл або посилання HTTP чи HTTPS.';
                return;
            }
            const key = prefix + crypto.randomUUID();
            const submit = form.querySelector('[type="submit"]');
            saving = submit.disabled = true;
            let binarySaved = false;
            try {
                if (selected) {
                    const fileDataUrl = await readFileAsDataURLAsync(new Blob([selected], {type: 'application/pdf'}));
                    if (!allowed(true)) return;
                    binarySaved = await saveDocBinaryToIDB(key, {
                        fileDataUrl, originalFileName: selected.name, mimeType: 'application/pdf', ext: 'pdf'
                    });
                    if (!binarySaved) throw new Error('File save failed');
                }
                localStorage.setItem(key, JSON.stringify({url, description, fileName: selected?.name}));
                form.reset();
                file = undefined;
                clearPreview();
                selectedFile.textContent = '';
                status.textContent = 'PDF додано.';
                render();
            } catch (_) {
                if (binarySaved) await deleteDocBinaryFromIDB(key).catch(() => {});
                status.textContent = 'Не вдалося зберегти PDF. Файл можна відкрити напряму або додати посилання на нього.';
            } finally {
                saving = submit.disabled = false;
            }
        });
        switchView('pdf-links');
        page.querySelector('h2').focus();
        let snapshot = state();
        refresh = setInterval(() => {
            if (!page.classList.contains('active')) {
                clearInterval(refresh);
                clearPreview();
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
