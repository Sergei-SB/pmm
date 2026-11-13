(() => {
    const storageKey = '__sync_local_developer_notes';
    const kyivDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit'
    });

    function today() {
        const parts = Object.fromEntries(kyivDate.formatToParts().map(({type, value}) => [type, value]));
        return parts.year + '-' + parts.month + '-' + parts.day;
    }

    function reminderDate(input) {
        const match = /^(\d{1,2})[.,](\d{1,2})(?:[.,](\d{4}))?$/.exec(input.trim());
        if (!match) return null;
        const [, day, month, year] = match;
        const current = today();
        const suffix = '-' + month.padStart(2, '0') + '-' + day.padStart(2, '0');
        let date = (year || current.slice(0, 4)) + suffix;
        if (!year && date < current) date = String(Number(current.slice(0, 4)) + 1) + suffix;
        const parsed = new Date(date + 'T00:00:00Z');
        return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === date ? date : null;
    }

    function readNotes() {
        const notes = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (!Array.isArray(notes)) throw new Error('Invalid notes');
        return notes;
    }

    function isDeveloper() {
        return typeof isRegistryDeveloper === 'function' && isRegistryDeveloper();
    }

    window.refreshDeveloperNotesBell = function () {
        const bell = document.getElementById('dev-notes-bell');
        if (!bell) return;
        bell.hidden = !isDeveloper();
        let due = false;
        if (!bell.hidden) {
            try {
                const date = today();
                due = readNotes().some(note => note.date === date);
            } catch (_) {}
        }
        bell.toggleAttribute('data-due', due);
        bell.title = due ? 'Є нагадування на сьогодні' : 'Нотатки';
        bell.setAttribute('aria-label', bell.title);
    };

    window.renderDeveloperNotes = function () {
        const target = document.getElementById('dev-notes-content');
        if (!target) return;
        target.replaceChildren();
        if (!isDeveloper()) return;
        target.innerHTML = `
            <form style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">
                <label style="width:870px;max-width:100%;">Що потрібно зробити<br><input name="task" type="text" required maxlength="500" style="width:100%;box-sizing:border-box;"></label>
                <label>Дата нагадування<br><input name="date" type="text" required maxlength="10" placeholder="15,11 або 15.11.2026"></label>
                <button class="action-btn" type="submit">Додати нагадування</button>
            </form>
            <p role="status">Без року використовується найближча дата за київським часом. Нотатки зберігаються в цьому браузері.</p>
            <ul></ul>
        `;
        const form = target.querySelector('form');
        const status = target.querySelector('[role="status"]');
        const list = target.querySelector('ul');

        function save(notes) {
            localStorage.setItem(storageKey, JSON.stringify(notes));
            window.refreshDeveloperNotesBell();
            window.renderDeveloperNotes();
        }

        try {
            const notes = readNotes().sort((a, b) => a.date.localeCompare(b.date));
            for (const note of notes) {
                const item = document.createElement('li');
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.textContent = 'Видалити';
                remove.addEventListener('click', () => {
                    if (!isDeveloper()) return;
                    try {
                        save(readNotes().filter(entry => entry.id !== note.id));
                    } catch (_) {
                        status.textContent = 'Не вдалося видалити нагадування.';
                    }
                });
                item.append(note.date.split('-').reverse().join('.') + ' — ' + note.task + ' ', remove);
                list.append(item);
            }
        } catch (_) {
            status.textContent = 'Не вдалося прочитати нотатки з браузера.';
        }

        form.addEventListener('submit', event => {
            event.preventDefault();
            if (!isDeveloper()) return;
            const task = form.elements.task.value.trim();
            const date = reminderDate(form.elements.date.value);
            if (!task || !date) {
                status.textContent = 'Введіть завдання та дійсну дату, наприклад 15,11.';
                return;
            }
            try {
                save([...readNotes(), {id: crypto.randomUUID(), task, date}]);
                target.querySelector('[name="task"]').focus();
            } catch (_) {
                status.textContent = 'Не вдалося зберегти нагадування в браузері.';
            }
        });
    };

    document.getElementById('dev-notes-bell')?.addEventListener('click', () => {
        if (!isDeveloper()) return;
        window.switchView('dev-panel');
        window.switchDevSubTab('notes');
    });
    window.addEventListener('focus', window.refreshDeveloperNotesBell);
    window.addEventListener('storage', event => {
        if (event.key === storageKey || event.key === null) window.refreshDeveloperNotesBell();
    });
    setInterval(window.refreshDeveloperNotesBell, 15000);
})();
