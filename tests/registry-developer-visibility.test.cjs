const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function fixture(role){
    const source=ts.createSourceFile('app.js',fs.readFileSync(path.join(root,'app.js'),'utf8'),ts.ScriptTarget.Latest,true);
    const names=['isRegistryDeveloper','syncRegistryDeveloperVisibility','filterCarsByCategory','updateCarVehicleType'];
    const functions=source.statements.filter(node=>ts.isFunctionDeclaration(node)&&names.includes(node.name?.text)).map(node=>node.getText(source));
    let renders=0,saves=0;const classes=new Set();
    const c={window:null,currentRole:role,getCurrentAppRole:()=>c.currentRole,document:{documentElement:{classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)}},getElementById:()=>null},
        carsData:[{id:1,vehicleType:'легковий',category:'passenger'}],renderCarsTable:()=>renders++,saveCarsModificationsToStorage:()=>saves++};
    c.window=c;vm.createContext(c);vm.runInContext("let currentCategoryFilter='all';\n"+functions.join('\n'),c);
    return {c,classes,renders:()=>renders,saves:()=>saves};
}
test('Only developer sees registry category controls and can change vehicle type',()=>{
    for(const role of ['user','moderator','admin','developer']){
        const {c,classes,saves}=fixture(role);c.syncRegistryDeveloperVisibility();
        assert.equal(classes.has('registry-developer'),role==='developer');
        c.updateCarVehicleType(1,'вантажний');
        assert.equal(c.carsData[0].vehicleType,role==='developer'?'вантажний':'легковий');assert.equal(saves(),role==='developer'?1:0);
    }
});
test('Leaving developer resets only hidden category filter, without saving fleet data',()=>{
    const {c,classes,saves}=fixture('developer');c.filterCarsByCategory('мотоцикл');
    c.currentRole='admin';c.syncRegistryDeveloperVisibility();
    assert.equal(vm.runInContext('currentCategoryFilter',c),'all');assert.equal(classes.has('registry-developer'),false);assert.equal(saves(),0);
    c.filterCarsByCategory('вантажний');assert.equal(vm.runInContext('currentCategoryFilter',c),'all');
    c.currentRole='developer';c.syncRegistryDeveloperVisibility();assert.equal(classes.has('registry-developer'),true);
});
test('Visibility rule is scoped to registry and applies to header and row cells',()=>{
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
    assert.match(html,/html:not\(\.registry-developer\) #base-view \.registry-developer-only/);
    assert.match(html,/<th class="registry-developer-only">Тип авто<\/th>/);
    assert.match(app,/<td class="registry-developer-only">\s*<select/);
    for(const file of ['admin.js','developer_panel.js'])assert.ok(fs.readFileSync(path.join(root,file),'utf8').includes('syncRegistryDeveloperVisibility()'));
});
