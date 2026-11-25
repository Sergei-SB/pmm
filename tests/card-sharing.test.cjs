const {test} = require('node:test');
const assert = require('node:assert/strict');

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
