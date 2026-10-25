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
    assert.equal(c.setEquipmentReportItemIncluded('pump_1',false,period),true);
});

test('All equipment categories can be removed and restored only in the selected report, retaining every value',()=>{
    const {c,values,inventory,period,storageKey,setInputs}=fixture();
    for (const [id,category] of [['web_1','Webasto'],['heat_1','Теплова пушка'],['saw_1','Бензопила']]) {
        inventory.push({uniqueId:id,category,model:category,subdivision:'ВТО',fuelType:'ДП'});
    }
    const registry=JSON.stringify(inventory);
    for (const item of inventory) {
        const original={serialNumber:'SN-'+item.uniqueId,p1Fuel:'25',p2Oil:'3',nextFuel:'10'};
        const data=JSON.parse(values.get(storageKey)||'{}');data[item.uniqueId]=original;
        values.set(storageKey,JSON.stringify(data));
        setInputs([[item.uniqueId,'p1Fuel','30']]);
        assert.equal(c.setEquipmentReportItemIncluded(item.uniqueId,false,period),true);
        assert.ok(!c.getEquipmentReportItems(period).some(row=>row.uniqueId===item.uniqueId));
        assert.ok(c.getEquipmentReportItems('01.11-10.11').some(row=>row.uniqueId===item.uniqueId));
        setInputs([]);
        assert.equal(c.setEquipmentReportItemIncluded(item.uniqueId,true,period),true);
        assert.ok(c.getEquipmentReportItems(period).some(row=>row.uniqueId===item.uniqueId));
        assert.deepEqual(JSON.parse(values.get(storageKey))[item.uniqueId],{...original,p1Fuel:'30',_excluded:false});
    }
    assert.equal(JSON.stringify(inventory),registry);
    assert.equal(c.setEquipmentReportItemIncluded('unknown',false,period),false);
    const readOnly=fixture('user');
    assert.equal(readOnly.c.setEquipmentReportItemIncluded('pump_1',false,readOnly.period),false);
    assert.equal(readOnly.values.size,0);
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

test('Generator suggestions search inventory names, serials and units without mixing other categories',()=>{
    const {c,inventory,period}=fixture();
    inventory[0].model='Hyundai HHY 10050SI';
    inventory.push({uniqueId:'gen_2',category:'Генератор',model:'Hyundai HHY 10050SI',subdivision:'ВТО',fuelType:'АБ',serialNumber:'SECOND-02'});
    inventory.push({uniqueId:'gen_3',category:'Генератор',model:'Hyundai DESTROYED',note:'Знищено'});
    assert.equal(c.searchEquipmentReportGenerators(period,'  HYUNDAI  ').length,2);
    assert.equal(c.searchEquipmentReportGenerators(period,'second-02')[0].uniqueId,'gen_2');
    assert.equal(c.searchEquipmentReportGenerators(period,'ВТО')[0].uniqueId,'gen_2');
    assert.equal(c.searchEquipmentReportGenerators(period,'PUMP').length,0);
});

test('Selecting an inventory generator edits the existing report row and keeps financial data and inventory intact',()=>{
    const {c,inventory,period,values,storageKey}=fixture();
    values.set(storageKey,JSON.stringify({gen_1:{p1Fuel:'25',nextFuel:'10'}}));
    const id=c.addEquipmentReportGenerator({serialNumber:'REPORT-001',model:'GEN updated',subdivision:'ВТО'},'gen_1',period);
    assert.equal(id,'gen_1');assert.equal(c.getEquipmentReportItems(period).length,2);
    const stored=JSON.parse(values.get(storageKey));assert.equal(stored.gen_1.p1Fuel,'25');assert.equal(stored.gen_1.nextFuel,'10');
    assert.equal(c.getEquipmentReportItems(period)[0].model,'GEN updated');
    assert.equal(c.getEquipmentReportItems(period)[0].serialNumber,'REPORT-001');assert.equal(c.getEquipmentReportItems(period)[0].subdivision,'ВТО');
    assert.equal(inventory[0].model,'GEN');assert.equal(inventory[0].rawItem.serialNumber,'GEN-001');
    assert.equal(c.getEquipmentReportItems('01.11-10.11')[0].serialNumber,'GEN-001');
    assert.equal(c.searchEquipmentReportGenerators(period,'GEN')[0].sourceModel,'GEN');
});

test('Matching a model requires an explicit selection or a different serial instead of making duplicates',()=>{
    const {c,period}=fixture();
    assert.throws(()=>c.addEquipmentReportGenerator({model:' gen ',serialNumber:'gen-001'},'',period),/вже є/);
    assert.throws(()=>c.addEquipmentReportGenerator({model:'GEN'},'',period),/вже є/);
    const id=c.addEquipmentReportGenerator({model:'GEN',serialNumber:'ANOTHER-001'},'',period);
    assert.ok(id.startsWith('report_gen_'));assert.equal(c.getEquipmentReportItems(period).length,3);
});

test('Suggestions identify excluded rows and restore their original financial values',()=>{
    const {c,period,values,storageKey}=fixture();
    values.set(storageKey,JSON.stringify({gen_1:{_excluded:true,p1Fuel:'42',serialNumber:'SN42'}}));
    const option=c.searchEquipmentReportGenerators(period,'SN42')[0];assert.equal(option.status,'restore');assert.equal(option.fromInventory,true);
    c.addEquipmentReportGenerator({},option.uniqueId,period);
    assert.equal(c.searchEquipmentReportGenerators(period,'SN42')[0].status,'edit');assert.equal(JSON.parse(values.get(storageKey)).gen_1.p1Fuel,'42');
});

test('Report searches combine subdivision, partial model and partial serial, ignoring case and excluding removed rows',()=>{
    const {c,inventory,period,values,storageKey}=fixture();
    inventory.push({uniqueId:'web_1',category:'Webasto',model:'Webasto Air TOP',subdivision:'ВТО',serialNumber:'WF-8002-A'});
    inventory.push({uniqueId:'saw_1',category:'Бензопила',model:'STIHL MS 180',subdivision:'',serialNumber:'ABC-123'});
    values.set(storageKey,JSON.stringify({pump_1:{serialNumber:'REPORT-99'},gen_1:{_excluded:true}}));
    const items=c.getEquipmentReportItems(period);
    assert.equal(c.filterEquipmentReportItems(items,'ВТО',' air ','wf-8')[0].uniqueId,'web_1');
    assert.equal(c.filterEquipmentReportItems(items,'ВТО','air','9').length,0);
    assert.equal(c.filterEquipmentReportItems(items,'all','','report-')[0].uniqueId,'pump_1');
    assert.equal(c.filterEquipmentReportItems(items,'__unassigned__','stihl','abc')[0].uniqueId,'saw_1');
    assert.equal(c.filterEquipmentReportItems(items,'all','GEN').length,0);
    assert.equal(c.filterEquipmentReportItems(items).length,3);
});

test('Changing search filters saves pending edits and preserves rows hidden by previous searches',()=>{
    const {c,values,storageKey,setInputs}=fixture();
    values.set(storageKey,JSON.stringify({gen_1:{p1Fuel:'10'},pump_1:{p1Fuel:'99',serialNumber:'KEEP'}}));
    let renders=0;c.renderEquipmentReportView=()=>{renders++;};
    setInputs([['gen_1','p1Fuel','35'],['gen_1','serialNumber','UPDATED']]);
    c.changeEquipmentReportFilter('model','PUMP');
    setInputs([['pump_1','p1Fuel','101']]);
    c.changeEquipmentReportFilter('serial','KEEP');
    const saved=JSON.parse(values.get(storageKey));
    assert.equal(saved.gen_1.p1Fuel,'35');assert.equal(saved.gen_1.serialNumber,'UPDATED');
    assert.equal(saved.pump_1.p1Fuel,'101');assert.equal(saved.pump_1.serialNumber,'KEEP');assert.equal(renders,2);
    const readOnly=fixture('user');readOnly.c.renderEquipmentReportView=()=>{};
    readOnly.c.changeEquipmentReportFilter('model','PUMP');assert.equal(readOnly.values.size,0);
});
