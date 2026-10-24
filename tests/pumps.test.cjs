const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function extract(file,name){const source=ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true);let found;function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name)found=node.getText(source);ts.forEachChild(node,visit)}visit(source);assert.ok(found,name);return found}
function fixture(role='admin'){
    const values=new Map([['generators_custom_data','[{"id":1,"model":"KEEP"}]']]);
    const c={window:null,localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},getCurrentAppRole:()=>role,canRoleEdit:()=>role==='admin',canRoleDo:()=>role==='admin',confirm:()=>true,console};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'pumps.js'),'utf8'),c);c.renderPumpsView=()=>{};return {c,values};
}
function load(c,file,name){vm.runInContext(extract(file,name),c)}
test('Pumps use isolated storage, retain every field, and do not resurrect deleted last records',()=>{
    const {c,values}=fixture();assert.deepEqual(Array.from(c.getPumpsList()),[]);assert.equal(values.has('pumps_custom_data'),false);
    c.addPumpsRow();const id=c.getPumpsList()[0].id;
    for(const [field,value]of Object.entries({model:'Помпа "А"',kw:'4',fuelType:'АБ',consumption:'1.5',oilNorm10Days:'0.5',max5Days:'90',max10Days:'180',max30Days:'540',motoHoursDay:'12',responsiblePerson:'Оператор',serialNumber:'TEST',note:'Робоча'}))c.updatePumpsProp(id,field,value);
    c.updatePumpsProp(id,'locationSubdivision','ВТО');const item=c.getPumpsList()[0];assert.equal(item.model,'Помпа "А"');assert.equal(item.consumption,'1.5');assert.equal(item.subdivision,'ВТО');assert.equal(item.locationSubdivision,'ВТО');assert.equal(item.max30Days,'540');
    assert.equal(values.get('generators_custom_data'),'[{"id":1,"model":"KEEP"}]');c.deletePumpsRow(id);assert.equal(values.get('pumps_custom_data'),'[]');assert.equal(c.getPumpsList().length,0);
});
test('Pumps enforce equipment role permissions and preserve invalid stored data',()=>{
    const {c,values}=fixture('user');c.addPumpsRow();assert.equal(values.has('pumps_custom_data'),false);values.set('pumps_custom_data','[{"id":1,"model":"KEEP"}]');c.updatePumpsProp(1,'model','changed');c.deletePumpsRow(1);assert.equal(c.getPumpsList()[0].model,'KEEP');
    const other=fixture();other.values.set('pumps_custom_data','invalid');assert.throws(()=>other.c.addPumpsRow());assert.equal(other.values.get('pumps_custom_data'),'invalid');
});
test('Both report collectors and aggregate calculator include pumps with noncolliding identifiers',()=>{
    const {c}=fixture();c.savePumpsList([{id:1,model:'PUMP',fuelType:'АБ',consumption:'1.5',subdivision:'РМТЗ',locationSubdivision:'ВТО',note:''},{id:2,model:'DESTROYED',note:'Знищено'}]);
    c.getGeneratorsList=()=>[{id:1,model:'GEN',fuelType:'ДП'}];c.getWebastoList=()=>[];c.getHeatersList=()=>[];c.getChainsawsList=()=>[];
    load(c,'equipment_report.js','getAllEquipmentItemsUnified');let items=c.getAllEquipmentItemsUnified();assert.equal(items.filter(x=>x.category==='Помпа').length,1);assert.equal(items.find(x=>x.category==='Помпа').subdivision,'ВТО');assert.equal(new Set(items.map(x=>x.uniqueId)).size,items.length);
    load(c,'app.js','getAllEquipmentItemsUnified');items=c.getAllEquipmentItemsUnified();assert.equal(items.find(x=>x.category==='Помпа').uniqueId,'pump_1');assert.equal(items.find(x=>x.category==='Помпа').rawItem.consumption,'1.5');assert.equal(new Set(items.map(x=>x.uniqueId)).size,items.length);
    load(c,'aggregates_calc.js','getAllEquipmentList');const all=c.getAllEquipmentList();assert.equal(all.filter(x=>x.category==='Помпа').length,1);assert.equal(all.find(x=>x.category==='Помпа').consumption,'1.5');assert.ok(all.some(x=>x.model==='GEN'));
});
test('Pumps participate in Excel filters, sorting and selected category dispatch',()=>{
    const {c}=fixture();c.savePumpsList([{id:1,model:'Pump B'},{id:2,model:'Pump A'}]);vm.runInContext('let currentEquipmentTabName="pumps";',c);let rendered=0,added=0,printed=0;c.renderPumpsView=()=>rendered++;c.addPumpsRow=()=>added++;c.printPumpsTable=()=>printed++;c.document={querySelectorAll:()=>[],getElementById:()=>({classList:{add(){}}})};
    for(const name of ['switchEquipmentTab','addCurrentEquipmentRow','printCurrentEquipmentTable'])load(c,'generators.js',name);c.switchEquipmentTab('pumps');c.addCurrentEquipmentRow();c.printCurrentEquipmentTable();assert.equal(rendered,1);assert.equal(added,1);assert.equal(printed,1);
    for(const name of ['getCategoryItemsList','itemMatchesExcelFilters','applyCategoryExcelSort','triggerCategoryRerender'])load(c,'excel_filter.js',name);
    vm.runInContext('window.excelFiltersState={pumps:{model:new Set(["Pump A"])}};',c);c.excelSortState={pumps:{colKey:'model',direction:'asc'}};assert.equal(c.getCategoryItemsList('pumps').length,2);assert.equal(c.itemMatchesExcelFilters(c.getPumpsList()[0],'pumps'),false);assert.equal(c.itemMatchesExcelFilters(c.getPumpsList()[1],'pumps'),true);assert.equal(c.applyCategoryExcelSort(c.getPumpsList(),'pumps')[0].model,'Pump A');c.triggerCategoryRerender('pumps');assert.equal(rendered,2);
});
test('Destroyed pumps retain their storage key and can be restored without modifying another category',()=>{
    const {c,values}=fixture();c.savePumpsList([{id:1,model:'PUMP',subdivision:'ВТО',note:'Знищено',isDestroyed:true}]);c.carsData=[];load(c,'destroyed_equipment.js','getDestroyedEquipmentList');const items=c.getDestroyedEquipmentList();const pump=items.find(x=>x.category==='Помпа');assert.ok(pump);assert.equal(pump.storageKey,'pumps_custom_data');
    load(c,'destroyed_equipment.js','stripDestroyedNote');load(c,'destroyed_equipment.js','restoreDestroyedItemFromTable');c.renderDestroyedEquipmentView=()=>{};c.switchEquipmentTab=()=>{};c.showToastNotification=()=>{};c.restoreDestroyedItemFromTable('equipment',1,'pumps_custom_data');assert.equal(c.getPumpsList()[0].isDestroyed,undefined);assert.ok(!/знищ/ui.test(c.getPumpsList()[0].note));assert.equal(values.get('generators_custom_data'),'[{"id":1,"model":"KEEP"}]');
});
test('Pump print output is escaped and excludes destroyed positions',()=>{
    const {c}=fixture();c.savePumpsList([{id:1,model:'<script>BAD</script>'},{id:2,model:'DESTROYED',note:'Знищено'}]);let html='';c.open=()=>({document:{write:v=>html=v,close(){}},focus(){},print(){},close(){}});c.setTimeout=()=>{};c.printPumpsTable();assert.ok(html.includes('ОБЛІК ТА НОРМИ ВИТРАТ ПАЛИВА І МАСТИЛ ПОМП'));assert.ok(html.includes('&lt;script&gt;BAD'));assert.ok(!html.includes('DESTROYED'));
});
