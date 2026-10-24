const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function fixture(role='admin') {
    const period='21.10-31.10', values=new Map(), listeners={};
    const inventory=[{uniqueId:'gen_1',category:'Генератор',model:'GEN',subdivision:'РМТЗ',fuelType:'ДП',rawItem:{serialNumber:'GEN-001'}},
        {uniqueId:'pump_1',category:'Помпа',model:'PUMP',subdivision:'ВТО',fuelType:'АБ',rawItem:{serialNumber:'PUMP-001'}}];
    let inputs=[];
    const c={console,alert(){},localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},
        document:{addEventListener:(event,fn)=>{listeners[event]=fn;},getElementById:id=>id==='eq-report-custom-period'?{value:period}:null,querySelectorAll:selector=>selector==='#equipment-report-tbody tr'?[{}]:inputs},
        getCurrentAppRole:()=>role,canRoleEdit:()=>role==='admin',canRoleDo:()=>role==='admin'};
    c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../equipment_report.js'),'utf8'),c);
    c.getAllEquipmentItemsUnified=()=>inventory.map(item=>({...item}));c.updateEquipmentReportTotals=()=>{};c.initEqReportPeriodDropdown=()=>{};c.getSavedEquipmentPeriodsList=()=>[period];c.propagateNextFuelToNextPeriod=()=>{};
    const storageKey='equipment_report_data_'+period;
    return {c,values,listeners,inventory,period,storageKey,setInputs:items=>{inputs=items.map(([id,field,value])=>({value,getAttribute:name=>name==='data-id'?id:field}));}};
}
test('Report serial numbers come from equipment without changing identifiers or registry data',()=>{
    const {c,inventory,period}=fixture();const rows=c.getEquipmentReportItems(period);
    assert.equal(rows[0].serialNumber,'GEN-001');assert.equal(rows[1].serialNumber,'PUMP-001');
    assert.equal(rows[0].uniqueId,'gen_1');assert.equal(inventory[0].serialNumber,undefined);
});
test('A report-only generator survives reload and remains scoped to its period',()=>{
    const {c,values,inventory,period,storageKey}=fixture();
    const id=c.addEquipmentReportGenerator({model:'NEW GEN',serialNumber:'SERIAL-02',subdivision:'ВТО',fuelType:'АБ'},'',period);
    assert.ok(id.startsWith('report_gen_'));assert.equal(inventory.length,2);
    const saved=JSON.parse(values.get(storageKey));assert.equal(saved[id]._equipment.model,'NEW GEN');assert.equal(saved[id].serialNumber,'SERIAL-02');
    assert.ok(c.getEquipmentReportItems(period).some(item=>item.uniqueId===id));
    assert.equal(c.getEquipmentReportItems('01.11-10.11').length,2);
});
test('Removing/restoring a report generator retains its financial values and the equipment registry',()=>{
    const {c,values,inventory,period,storageKey,setInputs}=fixture();
    values.set(storageKey,JSON.stringify({gen_1:{serialNumber:'HISTORIC',p1Fuel:'25',nextFuel:'10'}}));
    setInputs([['gen_1','p1Fuel','30']]);assert.equal(c.setEquipmentReportGeneratorIncluded('gen_1',false,period),true);
    assert.equal(c.getEquipmentReportItems(period).some(item=>item.uniqueId==='gen_1'),false);
    assert.equal(JSON.parse(values.get(storageKey)).gen_1.p1Fuel,'30');assert.equal(inventory[0].model,'GEN');
    setInputs([]);c.addEquipmentReportGenerator({},'gen_1',period);
    assert.ok(c.getEquipmentReportItems(period).some(item=>item.uniqueId==='gen_1'));
    assert.equal(JSON.parse(values.get(storageKey)).gen_1.nextFuel,'10');assert.equal(JSON.parse(values.get(storageKey)).gen_1.serialNumber,'HISTORIC');
    assert.equal(c.setEquipmentReportGeneratorIncluded('pump_1',false,period),false);
});
test('All save paths preserve filtered/excluded rows, custom metadata and serial edits',()=>{
    for(const method of ['saveCurrentEquipmentReportSilently','saveEquipmentReportData','input']){
        const {c,values,listeners,storageKey,setInputs}=fixture();
        const before={gen_1:{p1Fuel:'10'},pump_1:{p1Fuel:'99',serialNumber:'KEEP'},report_gen_saved:{_equipment:{category:'Генератор',model:'CUSTOM'},_excluded:true,nextFuel:'8'}};
        values.set(storageKey,JSON.stringify(before));setInputs([['gen_1','p1Fuel','20'],['gen_1','serialNumber','EDIT-001']]);
        if(method==='input')listeners.input({target:{classList:{contains:()=>true}}});else c[method]();
        const after=JSON.parse(values.get(storageKey));assert.deepEqual(after.pump_1,before.pump_1);assert.deepEqual(after.report_gen_saved,before.report_gen_saved);assert.equal(after.gen_1.p1Fuel,'20');assert.equal(after.gen_1.serialNumber,'EDIT-001');
    }
});
test('Read-only roles cannot add or exclude report rows, and malformed reports are not overwritten',()=>{
    const f=fixture('user');assert.equal(f.c.addEquipmentReportGenerator({model:'NO'},'',f.period),false);assert.equal(f.c.setEquipmentReportGeneratorIncluded('gen_1',false,f.period),false);f.c.saveEquipmentReportData();assert.equal(f.values.size,0);
    const other=fixture();other.values.set(other.storageKey,'[]');assert.throws(()=>other.c.addEquipmentReportGenerator({model:'NEW'},'',other.period));assert.equal(other.values.get(other.storageKey),'[]');
});
