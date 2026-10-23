(function () {
    'use strict';
    function node(tag, text, parent) {
        var element = document.createElement(tag);
        if (text !== undefined) element.textContent = text;
        if (parent) parent.appendChild(element);
        return element;
    }
    function label(item) {
        if (item.kind === 'file') return 'Документ: ' + (item.local.file?.fileName || item.remote.fileName || item.id);
        var names = {user_cars_database_v2: 'Реєстр автомобілів', cars_modifications_data: 'Характеристики автомобілів',
            saved_documents_v2: 'Список документів', aggregates_calc_saved_state: 'Розрахунок агрегатів'};
        if (names[item.id]) return names[item.id];
        if (item.id.indexOf('report_data_') === 0) return 'Звіт: ' + item.id.slice(12);
        if (item.id.indexOf('equipment_report_data_') === 0) return 'Звіт обладнання: ' + item.id.slice(22);
        if (item.id.indexOf('car_folder_') === 0) return 'Документи автомобіля: ' + item.id.slice(11);
        return item.id;
    }
    function preview(item, side) {
        var data = side === 'local' ? item.local : item.remote;
        if (data.deleted) return 'Цю версію видалено';
        if (item.kind === 'file') {
            var file = side === 'local' ? data.file : data;
            return file ? file.fileName + '\nРозмір даних: ' + (file.fileDataUrl || '').length + ' символів' : 'Файл відсутній';
        }
        try {
            return JSON.stringify(JSON.parse(data.value), function (_key, value) {
                return typeof value === 'string' && value.indexOf('data:') === 0 ? '[Вкладення: ' + value.length + ' символів]' : value;
            }, 2);
        } catch (_) { return String(data.value || ''); }
    }
    window.showPmmSyncConflicts = async function () {
        document.getElementById('pmm-sync-conflicts')?.remove();
        var dialog = node('dialog');
        dialog.id = 'pmm-sync-conflicts';
        dialog.style.cssText = 'width:min(1000px,92vw);max-height:85vh;border:1px solid #94a3b8;border-radius:10px;padding:22px;color:#172033;background:#fff;box-sizing:border-box;overflow:auto;font:15px Arial,sans-serif;';
        var heading = node('div', undefined, dialog);
        heading.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:15px;';
        node('h2', 'Перевірка синхронізації', heading).style.margin = '0';
        var close = node('button', 'Закрити ✕', heading);
        close.type = 'button'; close.onclick = function () {dialog.close(); dialog.remove();};
        node('p', 'Порівняйте обидві версії. Різні дані не замінюються автоматично. Перед вибором обидві версії записуються в історію цього браузера.', dialog);
        var message = node('p', '', dialog);
        message.setAttribute('role', 'status');
        var content = node('div', undefined, dialog);
        var refresh = node('button', 'Оновити перевірку', dialog);
        refresh.type = 'button';
        document.body.appendChild(dialog); dialog.showModal();
        async function load() {
            refresh.disabled = true;
            message.style.color = '#334155'; message.textContent = 'Перевіряю сервер…';
            content.replaceChildren();
            try {
                var report = await window.inspectPmmSyncConflicts();
                message.textContent = report.conflicts.length ? 'Відмінностей, що потребують вибору: ' + report.conflicts.length
                    : report.queued ? 'Конфліктів немає. Змін у черзі збереження: ' + report.queued : 'Конфліктів немає. Дані синхронізовано.';
                if (report.warning) node('p', report.warning, content).style.color = '#9a3412';
                report.conflicts.forEach(function (item) {
                    var section = node('section', undefined, content);
                    section.style.cssText = 'border:1px solid #cbd5e1;border-radius:7px;margin:15px 0;padding:15px;';
                    node('h3', label(item), section).style.marginTop = '0';
                    var columns = node('div', undefined, section);
                    columns.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;';
                    ['local', 'server'].forEach(function (side) {
                        var column = node('div', undefined, columns);
                        column.style.cssText = 'flex:1 1 300px;min-width:0;';
                        node('strong', side === 'local' ? 'Ваш браузер' : 'Сайт / GitHub', column);
                        var pre = node('pre', preview(item, side), column);
                        pre.style.cssText = 'max-height:260px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f5f9;padding:10px;font:13px monospace;';
                        if (item.kind === 'file') {
                            var file = side === 'local' ? item.local.file : item.remote;
                            if (file && !file.deleted && /^data:/i.test(file.fileDataUrl || '')) {
                                var download = node('a', 'Завантажити цю версію файла', column);
                                download.href = file.fileDataUrl; download.download = file.fileName || item.id;
                            }
                        }
                    });
                    var actions = node('div', undefined, section);
                    actions.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;';
                    ['local', 'server'].forEach(function (choice) {
                        var button = node('button', choice === 'local' ? 'Зберегти мою версію на сайт' : 'Використати версію із сайту', actions);
                        button.type = 'button';
                        button.style.cssText = 'padding:9px 12px;border-radius:5px;border:1px solid #64748b;cursor:pointer;';
                        button.disabled = choice === 'local' && !report.canUpload;
                        button.onclick = async function () {
                            actions.querySelectorAll('button').forEach(function (b) {b.disabled = true;});
                            try { await window.resolvePmmSyncConflict(item, choice); await load(); }
                            catch (error) {
                                message.style.color = '#b91c1c'; message.textContent = error.message;
                                actions.querySelectorAll('button').forEach(function (b) {b.disabled = !report.canUpload && b.textContent === 'Зберегти мою версію на сайт';});
                            }
                        };
                    });
                });
            } catch (error) { message.style.color = '#b91c1c'; message.textContent = error.message; }
            finally {refresh.disabled = false;}
        }
        refresh.onclick = load;
        await load();
    };
})();
