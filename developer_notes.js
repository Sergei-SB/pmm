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

    const calendarKey = '__sync_local_developer_calendar';
    const monthFormat = new Intl.DateTimeFormat('uk-UA', {month: 'long', year: 'numeric', timeZone: 'UTC'});
    const colors = {
        '': ['Без кольору', '#fff'],
        yellow: ['Жовтий', '#ffeb9e'],
        green: ['Зелений', '#bde8c7'],
        blue: ['Блакитний', '#bee0fa'],
        red: ['Червоний', '#fac3c0'],
        purple: ['Фіолетовий', '#e1cdf5']
    };
    let selectedDay;

    function renderCalendar(calendar) {
        selectedDay ||= today();
        calendar.innerHTML = `
            <style>
                .dev-notes-layout { display:grid; grid-template-columns:minmax(0,1fr) minmax(320px, 460px); gap:20px; align-items:start; }
                .dev-notes-calendar { background:#fff; border:1px solid #bbc7cd; border-radius:8px; padding:14px; color:#23384b; }
                .dev-calendar-header { display:flex; justify-content:space-between; align-items:center; gap:8px; }
                .dev-calendar-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:4px; margin:10px 0; text-align:center; }
                .dev-calendar-grid button { min-height:35px; border:1px solid #c6d0d6; border-radius:4px; color:inherit; cursor:pointer; }
                .dev-calendar-grid button[aria-pressed="true"] { outline:2px solid #34495e; outline-offset:-2px; font-weight:bold; }
                .dev-calendar-grid button[aria-current="date"] { text-decoration:underline; }
                .dev-notes-calendar textarea { width:100%; box-sizing:border-box; resize:vertical; }
                @media (max-width:900px) { .dev-notes-layout { grid-template-columns:minmax(0,1fr); } }
            </style>
            <div class="dev-calendar-header">
                <button type="button" class="action-btn" data-month="-1" aria-label="Попередній місяць">‹</button>
                <strong data-month-label aria-live="polite"></strong>
                <button type="button" class="action-btn" data-month="1" aria-label="Наступний місяць">›</button>
            </div>
            <div class="dev-calendar-grid"></div>
            <form>
                <label>Коментар на <strong data-day-label></strong><br>
                    <textarea name="comment" rows="2" maxlength="250"></textarea>
                </label>
                <label>Колір дня <select name="color"></select></label>
                <button class="action-btn" type="submit">Зберегти</button>
                <button type="button" data-clear>Очистити день</button>
                <p role="status" style="margin:6px 0 0"></p>
            </form>
        `;
        const grid = calendar.querySelector('.dev-calendar-grid');
        const form = calendar.querySelector('form');
        const {comment, color} = form.elements;
        const status = form.querySelector('[role="status"]');
        for (const [value, [label]] of Object.entries(colors)) color.add(new Option(label, value));

        function readDays() {
            const days = JSON.parse(localStorage.getItem(calendarKey) || '{}');
            if (!days || typeof days !== 'object' || Array.isArray(days)) throw new Error('Invalid calendar');
            return days;
        }

        function draw() {
            const first = new Date(selectedDay.slice(0, 7) + '-01T00:00:00Z');
            const month = first.toISOString().slice(0, 7);
            calendar.querySelector('[data-month-label]').textContent = monthFormat.format(first);
            calendar.querySelector('[data-day-label]').textContent = selectedDay.split('-').reverse().join('.');
            grid.replaceChildren();
            for (const label of ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']) {
                const weekday = document.createElement('span');
                weekday.textContent = label;
                grid.append(weekday);
            }
            for (let i = 0; i < (first.getUTCDay() + 6) % 7; i++) grid.append(document.createElement('span'));
            let days = {};
            try { days = readDays(); } catch (_) { status.textContent = 'Не вдалося прочитати календар.'; }
            const length = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
            const current = today();
            for (let day = 1; day <= length; day++) {
                const date = month + '-' + String(day).padStart(2, '0');
                const entry = days[date];
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = day + (entry?.comment ? ' •' : '');
                button.title = entry?.comment || date;
                button.setAttribute('aria-label', entry?.comment ? date + ' — ' + entry.comment : date);
                button.setAttribute('aria-pressed', String(selectedDay === date));
                if (date === current) button.setAttribute('aria-current', 'date');
                button.style.backgroundColor = Object.hasOwn(colors, entry?.color) ? colors[entry.color][1] : colors[''][1];
                button.onclick = () => {
                    selectedDay = date;
                    status.textContent = '';
                    draw();
                    comment.focus();
                };
                grid.append(button);
            }
            comment.value = days[selectedDay]?.comment || '';
            color.value = Object.hasOwn(colors, days[selectedDay]?.color) ? days[selectedDay].color : '';
        }

        function saveDay(text, value) {
            if (!isDeveloper()) return;
            try {
                const days = readDays();
                if (text || value) days[selectedDay] = {comment: text, color: value};
                else delete days[selectedDay];
                localStorage.setItem(calendarKey, JSON.stringify(days));
                status.textContent = text || value ? 'Збережено.' : 'День очищено.';
                draw();
            } catch (_) {
                status.textContent = 'Не вдалося зберегти день.';
            }
        }

        calendar.querySelectorAll('[data-month]').forEach(button => {
            button.onclick = () => {
                const month = new Date(selectedDay.slice(0, 7) + '-01T00:00:00Z');
                month.setUTCMonth(month.getUTCMonth() + Number(button.dataset.month));
                selectedDay = month.toISOString().slice(0, 10);
                status.textContent = '';
                draw();
            };
        });
        form.onsubmit = event => {
            event.preventDefault();
            saveDay(comment.value.trim(), color.value);
        };
        form.querySelector('[data-clear]').onclick = () => saveDay('', '');
        draw();
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
            <div class="dev-notes-layout">
            <div>
            <form style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">
                <label style="width:870px;max-width:100%;">Що потрібно зробити<br><input name="task" type="text" required maxlength="500" style="width:100%;box-sizing:border-box;"></label>
                <label>Дата нагадування<br><input name="date" type="text" required maxlength="10" placeholder="15,11 або 15.11.2026"></label>
                <button class="action-btn" type="submit">Додати нагадування</button>
            </form>
            <p role="status"></p>
            <ul></ul>
            </div>
            <aside class="dev-notes-calendar" aria-label="Календар нотаток"></aside>
            </div>
        `;
        const form = target.querySelector('form');
        const status = target.querySelector('[role="status"]');
        const list = target.querySelector('ul');
        renderCalendar(target.querySelector('.dev-notes-calendar'));

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
