const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function fixture(){
    const local=new Map(),session=new Map(),classes=new Set();let writes=0;
    const buttons=['classic','modern'].map(mode=>({dataset:{adminLayout:mode},attributes:{},setAttribute(k,v){this.attributes[k]=v;}}));
    const control={querySelectorAll:()=>buttons},header={},panel={classList:{toggle:(key,on)=>on?classes.add(key):classes.delete(key)},querySelector:()=>header};
    const nodes={'dev-panel-view':panel,'dev-panel-header-actions':{},'dev-admin-layout-switch':control};
    const c={console,currentRole:'developer',getCurrentAppRole:()=>c.currentRole,setTimeout(){},clearInterval(){},
        document:{readyState:'loading',addEventListener(){},getElementById:id=>nodes[id]||null},
        localStorage:{getItem:k=>local.get(k)??null,setItem:(k,v)=>{writes++;local.set(k,v);}},
        sessionStorage:{getItem:k=>session.get(k)??null,setItem:(k,v)=>session.set(k,v)}};
    c.window=c;vm.createContext(c);
    for(const file of ['developer_panel.js','admin_layout.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
    return {c,local,session,classes,buttons,writes:()=>writes};
}
test('Both admin layouts share real canonical page and feature permissions without extra writes or rendering',()=>{
    const {c,writes,classes,buttons}=fixture();
    c.renderDeveloperPanel=()=>{throw Error('Switch must preserve live form nodes');};
    const matrix=c.getPagePermissionsMatrix(),features=c.getGranularPermissions();
    matrix.base.user.access=false;features.base_add_car.admin=false;
    c.savePagePermissionsMatrix(matrix);
    c.localStorage.setItem('dev_granular_permissions_v1',JSON.stringify(features));
    const before=writes();
    assert.equal(c.setDeveloperPanelLayout('modern'),true);assert.ok(classes.has('dev-admin-modern'));
    assert.equal(c.getPagePermissionsMatrix().base.user.access,false);assert.equal(c.getGranularPermissions().base_add_car.admin,false);
    matrix.base.user.access=true;c.savePagePermissionsMatrix(matrix);
    const afterSave=writes();
    assert.equal(c.setDeveloperPanelLayout('classic'),true);assert.ok(!classes.has('dev-admin-modern'));
    assert.equal(c.getPagePermissionsMatrix().base.user.access,true);assert.equal(writes(),afterSave);assert.equal(afterSave,before+1);
    assert.equal(buttons[0].attributes['aria-pressed'],'true');assert.equal(buttons[1].attributes['aria-pressed'],'false');
});
test('Non-developers cannot change layout and invalid options leave stored layout unchanged',()=>{
    const {c,session}=fixture();
    for(const role of ['admin','moderator','user']){c.currentRole=role;assert.equal(c.setDeveloperPanelLayout('modern'),false);}
    assert.equal(session.size,0);c.currentRole='developer';assert.equal(c.setDeveloperPanelLayout('invalid'),false);
    c.setDeveloperPanelLayout('modern');assert.equal(session.get('pmm_admin_layout_v1'),'modern');
});
