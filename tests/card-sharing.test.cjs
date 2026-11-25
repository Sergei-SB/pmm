const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');

test('Save changes keeps the normal save path even when card sharing is unavailable', () => {
    const file = require('node:path').join(__dirname, '../app2.js');
    const ast = ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
    let source;
    function visit(node) {
        if (ts.isBinaryExpression(node) && node.left.getText(ast)==='window.saveActiveCardPeriodData') source=node.getText(ast);
        ts.forEachChild(node,visit);
    }
    visit(ast);assert.ok(source);
    const saved=[];
    const c={currentCarId:123,getStrictActivePeriod:()=> '21.11-30.11',
        vehicleCardSharing:{saveCurrent(){throw Error('must not replace normal saving');}},
        saveCarRoutesForPeriod:(...args)=>saved.push(args),
        document:{getElementById:()=>null},showDevNotification(){}};
    c.window=c;vm.createContext(c);vm.runInContext(source,c);
    c.saveActiveCardPeriodData();
    assert.deepEqual(saved, [['21.11-30.11',123,true]]);
});

async function fixture() {
    const {installCardSharing} = await import('../card_sharing.ts');
    let handler;
    const state = {drafts: {}, shared: {}};
    let fail = false;
    const issue = installCardSharing({use() {}, post(path, fn) {handler = fn;}}, {
        read: async () => state,
        change: async fn => {if (fail) throw Error('storage unavailable'); fn(state);}
    });
    const call = async body => {
        const response = {status: 200, data: undefined, json(data) {this.data=data;}, sendStatus(status) {this.status=status;}};
        await handler({params: {carId: '123', period: '11.11-20.11'}, body}, response);
        return response;
    };
    return {state, issue, call, setFailure: () => {fail = true;}};
}

test('Only the developer can save or transfer a card; recipients receive isolated snapshots', async () => {
    const {call, issue} = await fixture();
    const session = issue('developer');
    const snapshot = {topFields: {fuelStart: '40'}, rows: [{name: 'Маршрут', km: '10'}]};
    assert.equal((await call({action:'save', session:issue('admin'), snapshot})).status,403);
    assert.equal((await call({action:'send', recipient:'admin'})).status,403);
    assert.equal((await call({action:'save',session,snapshot})).status,200);
    assert.equal((await call({action:'send',session,recipient:'admin'})).status,200);
    const received = await call({action:'read',session:issue('admin')});
    assert.deepEqual(received.data.received.snapshot,snapshot);
    assert.equal(received.data.draft,null);
    assert.equal((await call({action:'read',session:issue('moderator')})).data.received,null);
    assert.equal((await call({action:'read'})).data.received,null);
    await call({action:'save',session,snapshot:{topFields:{fuelStart:'55'},rows:[]}});
    assert.equal(received.data.received.snapshot.topFields.fuelStart,'40');
});

test('Invalid sessions, recipients and oversized cards are rejected', async () => {
    const {call,issue} = await fixture();
    const session = issue('developer');
    assert.equal((await call({action:'read',session:'wrong'})).status,401);
    assert.equal((await call({action:'send',session,recipient:'developer'})).status,400);
    assert.equal((await call({action:'save',session,snapshot:{topFields:{},rows:Array(1001).fill({})}})).status,400);
    assert.equal((await call({action:'send',session,recipient:'admin'})).status,404);
});

test('Failed persistence never reports a successful transfer', async () => {
    const {call,issue,setFailure} = await fixture();
    setFailure();
    assert.equal((await call({action:'save',session:issue('developer'),snapshot:{topFields:{},rows:[]}})).status,503);
});

test('Existing route cards remain available to developer without being shared automatically', async () => {
    const {call,issue,state} = await fixture();
    state.legacyDraft = {topFields:{fuelStart:'70'},rows:[]};
    assert.equal((await call({action:'read',session:issue('developer')})).data.draft.topFields.fuelStart,'70');
    const user = await call({action:'read'});
    assert.equal(user.data.draft,null);
    assert.equal(user.data.received,null);
});

for (const role of ['admin', 'moderator', 'user']) {
    test(`${role} has no refresh button or login notice and receives updates automatically`, async () => {
        const elements = [], callbacks = [];
        const makeElement = () => {
            const element = {children:[],setAttribute(){},append(...items){this.children.push(...items);},replaceChildren(){this.children=[];}};
            elements.push(element); return element;
        };
        let value = '10', reads = 0;
        const editable = [{inert:true},{inert:true}];
        const c = {console, AbortSignal, Map, JSON, Object, Promise,
            sessionStorage: {getItem:()=>JSON.stringify({[role]:'valid-session'}),setItem(){}},
            document: {hidden:false,createElement:makeElement,querySelector:()=>({append(){}}),querySelectorAll:()=>editable},
            getCurrentAppRole:()=>role, loadCarDataForActivePeriod(){},
            setInterval:fn=>callbacks.push(fn),
            fetch:async()=>{reads++;return {ok:true,json:async()=>({draft:null,received:{snapshot:{topFields:{fuelStart:value},rows:[]}}})};}
        };
        c.window=c;vm.createContext(c);
        vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../card_sharing.js'),'utf8'),c);
        c.vehicleCardSharing.refreshRole();
        c.vehicleCardSharing.read(123,'11.11-20.11');
        await new Promise(resolve=>setImmediate(resolve));
        assert.equal(elements[0].hidden,true);
        assert.equal(elements[1].hidden,true);
        assert.equal(elements[0].children.length,0);
        assert.ok(editable.every(element => element.inert === false));
        assert.equal(reads,1);
        value='25';callbacks[0]();
        await new Promise(resolve=>setImmediate(resolve));
        assert.equal(JSON.parse(c.vehicleCardSharing.previous(123,'11.11-20.11')).topFields.fuelStart,'25');
        assert.equal(reads,2);
    });
}
