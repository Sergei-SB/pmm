const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'utils.js'), 'utf8');
const modals = [];
const document = {
    addEventListener() {},
    getElementById() { return null; },
    createElement() { return { style: {}, remove() {} }; },
    body: { appendChild(node) { modals.push(node); } }
};
const context = { document, TextDecoder, Uint8Array, DataView, console,
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    escapeHtml: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') };
context.window = context;
vm.createContext(context);
vm.runInContext(source, context);
const parse = buffer => context.extractDocBinaryText(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length));

// Small deterministic CFB with Word97 piece table. Supports both regular
// streams and mini streams, and pieces stored out of document order.
function fixture({ mini = false, table1 = true, encrypted = false } = {}) {
    const pieces = [Buffer.from('BMW <test>\r', 'latin1'), Buffer.from('Акт технічного стану\rУкраїна № 581\r', 'utf16le')];
    const word = Buffer.alloc(mini ? 1024 : 4096);
    word.writeUInt16LE(0xa5ec, 0); word.writeUInt16LE(0xc1, 2);
    word.writeUInt16LE((table1 ? 0x200 : 0) | (encrypted ? 0x100 : 0), 10);
    word.writeUInt16LE(14, 32); word.writeUInt16LE(22, 62);
    word.writeUInt32LE(pieces[0].length + pieces[1].length / 2, 76);
    word.writeUInt16LE(93, 152);
    const table = Buffer.alloc(mini ? 64 : 4096);
    table[0] = 1; table.writeUInt16LE(2, 1); // Prc before Pcdt.
    table[5] = 2; table.writeUInt32LE(28, 6);
    table.writeUInt32LE(0, 10); table.writeUInt32LE(pieces[0].length, 14);
    table.writeUInt32LE(pieces[0].length + pieces[1].length / 2, 18);
    table.writeUInt32LE(0x40000000 + 900 * 2, 24);
    table.writeUInt32LE(700, 32);
    pieces[0].copy(word, 900); pieces[1].copy(word, 700);
    word.writeUInt32LE(0, 418); word.writeUInt32LE(38, 422);
    const sectors = Array.from({ length: mini ? 6 : 18 }, () => Buffer.alloc(512));
    const header = Buffer.alloc(512);
    Buffer.from('d0cf11e0a1b11ae1', 'hex').copy(header);
    header.writeUInt16LE(3, 26); header.writeUInt16LE(0xfffe, 28);
    header.writeUInt16LE(9, 30); header.writeUInt16LE(6, 32);
    header.writeUInt32LE(1, 44); header.writeUInt32LE(1, 48); header.writeUInt32LE(4096, 56);
    header.writeUInt32LE(mini ? 2 : 0xfffffffe, 60); header.writeUInt32LE(mini ? 1 : 0, 64);
    header.writeUInt32LE(0xfffffffe, 68);
    for (let i = 76; i < 512; i += 4) header.writeUInt32LE(0xffffffff, i);
    header.writeUInt32LE(0, 76);
    const fat = sectors[0]; fat.fill(0xff);
    fat.writeUInt32LE(0xfffffffd, 0); fat.writeUInt32LE(0xfffffffe, 4);
    function chain(first, count) { for (let i = 0; i < count; i++) fat.writeUInt32LE(i + 1 < count ? first + i + 1 : 0xfffffffe, (first + i) * 4); }
    function entry(index, name, type, first, size) {
        const offset = index * 128;
        Buffer.from(name + '\0', 'utf16le').copy(sectors[1], offset);
        sectors[1].writeUInt16LE((name.length + 1) * 2, offset + 64);
        sectors[1][offset + 66] = type;
        sectors[1].writeUInt32LE(first, offset + 116); sectors[1].writeUInt32LE(size, offset + 120);
    }
    if (mini) {
        chain(2, 1); chain(3, 3);
        sectors[2].fill(0xff);
        for (let i = 0; i < 16; i++) sectors[2].writeUInt32LE(i === 15 ? 0xfffffffe : i + 1, i * 4);
        sectors[2].writeUInt32LE(0xfffffffe, 64);
        const stream = Buffer.concat([word, table, Buffer.alloc(448)]);
        for (let i = 0; i < 3; i++) stream.copy(sectors[3 + i], 0, i * 512, (i + 1) * 512);
        entry(0, 'Root Entry', 5, 3, 1088);
        entry(1, 'WordDocument', 2, 0, word.length); entry(2, table1 ? '1Table' : '0Table', 2, 16, table.length);
    } else {
        chain(2, 8); chain(10, 8);
        for (let i = 0; i < 8; i++) { word.copy(sectors[2 + i], 0, i * 512, (i + 1) * 512); table.copy(sectors[10 + i], 0, i * 512, (i + 1) * 512); }
        entry(0, 'Root Entry', 5, 0xfffffffe, 0);
        entry(1, 'WordDocument', 2, 2, word.length); entry(2, table1 ? '1Table' : '0Table', 2, 10, table.length);
    }
    return Buffer.concat([header, ...sectors]);
}

for (const mini of [false, true]) for (const table1 of [false, true]) {
    test(`DOC text order, Unicode and ASCII, mini=${mini}, 1Table=${table1}`, () => {
        assert.equal(parse(fixture({ mini, table1 })), 'BMW <test>\nАкт технічного стану\nУкраїна № 581');
    });
}
test('Real Ukrainian Word document excludes binary metadata and keeps final paragraphs', () => {
    const name = fs.readdirSync(path.join(__dirname, '..', 'Doc')).find(name => name.endsWith('.doc'));
    const text = parse(fs.readFileSync(path.join(__dirname, '..', 'Doc', name)));
    for (const expected of ['FORD TRANSIT', '169121', 'Акт №', 'Висновок командира', 'Прим. № 2 ФВ', 'М.П.']) assert.ok(text.includes(expected), expected);
    assert.ok(!/я{12}|DocumentSummaryInformation|Шрифт абзацу/.test(text));
});
test('Invalid, truncated, cyclic and password protected files do not show binary garbage', () => {
    for (const data of [Buffer.alloc(512), fixture().subarray(0, 1024), fixture({ encrypted: true })]) assert.equal(parse(data), '');
    const cyclic = fixture(); cyclic.writeUInt32LE(1, 512 + 4); assert.equal(parse(cyclic), '');
});
test('DOC preview escapes literal HTML and retains paragraphs', async () => {
    await context.openUniversalFilePreviewModal({ name: 'test.doc', dataUrl: 'data:application/msword;base64,' + fixture().toString('base64') });
    const html = modals.at(-1).innerHTML;
    assert.ok(html.includes('BMW &lt;test&gt;<br>Акт технічного стану'));
    assert.ok(html.includes('white-space:pre-wrap'));
});
test('DOCX rich preview keeps its existing conversion path', async () => {
    context.mammoth = { async convertToHtml() { return { value: '<p>DOCX текст</p>' }; } };
    await context.openUniversalFilePreviewModal({ name: 'test.docx', dataUrl: 'data:application/octet-stream;base64,UEs=' });
    assert.ok(modals.at(-1).innerHTML.includes('<p>DOCX текст</p>'));
    assert.ok(modals.at(-1).innerHTML.includes('white-space:normal'));
});
test('Text, image and CSV preview branches still render', async () => {
    for (const [info, expected] of [
        [{ name: 'test.txt', content: '<текст>' }, '&lt;текст&gt;'],
        [{ name: 'test.png', dataUrl: 'data:image/png;base64,AA==' }, 'universal-preview-img'],
        [{ name: 'test.csv', content: 'Назва,Кількість\nПаливо,10' }, 'Паливо']
    ]) {
        await context.openUniversalFilePreviewModal(info);
        assert.ok(modals.at(-1).innerHTML.includes(expected));
    }
});
