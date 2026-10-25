const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const [file,getter,update,key,hours] of [
    ['generators.js','getGeneratorsList','updateGeneratorProp','generators_custom_data',12],
    ['webasto.js','getWebastoList','updateWebastoProp','webasto_custom_data',12],
    ['heaters.js','getHeatersList','updateHeatersProp','heaters_custom_data',12],
    ['chainsaws.js','getChainsawsList','updateChainsawsProp','chainsaws_custom_data',4],
    ['pumps.js','getPumpsList','updatePumpsProp','pumps_custom_data',12]
]) test(file+': hourly consumption and operating hours update all limits, storage and visible cells',()=>{
    const rows=[{id:1,model:'CUSTOM',consumption:'0,6',motoHoursDay:'',serialNumber:'KEEP',oilNorm10Days:'1.5'},
        {id:2,model:'OTHER',consumption:'2',motoHoursDay:'8',max5Days:'MANUAL',note:'KEEP'}];
    const values=new Map([[key,JSON.stringify(rows)]]);
    const cells=['max5Days','max10Days','max30Days','motoHoursDay'].map(field=>({value:'',getAttribute:()=>`${update}(1, '${field}', this.value)`}));
    const c={console,localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},
        document:{querySelectorAll:()=>cells},getCurrentAppRole:()=> 'admin',canRoleEdit:()=>true,canRoleDo:()=>true};
    c.window=c;vm.createContext(c);
    for(const source of ['equipment_limits.js',file])vm.runInContext(fs.readFileSync(path.join(root,source),'utf8'),c);
    const derived=c[getter]();assert.equal(derived[0].max5Days,(0.6*hours*5).toFixed(2));
    assert.equal(derived[1].max5Days,'MANUAL');assert.equal(values.get(key),JSON.stringify(rows));
    c[update](1,'consumption','1,25');
    let saved=JSON.parse(values.get(key));
    assert.equal(saved[0].max5Days,(1.25*hours*5).toFixed(2));assert.equal(cells[0].value,saved[0].max5Days);
    c[update](1,'motoHoursDay','8');saved=JSON.parse(values.get(key));
    assert.equal(saved[0].max5Days,'50.00');assert.equal(saved[0].max10Days,'100.00');assert.equal(saved[0].max30Days,'300.00');
    assert.equal(saved[0].serialNumber,'KEEP');assert.equal(saved[0].oilNorm10Days,'1.5');assert.equal(saved[1].max5Days,'MANUAL');
    c[update](1,'consumption','0');assert.equal(JSON.parse(values.get(key))[0].max30Days,'0.00');
});

test('Incomplete or invalid numeric entries preserve saved limits and zero remains valid',()=>{
    const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'equipment_limits.js'),'utf8'),c);
    for(const consumption of ['', '-', 'abc','1/2','-2','Infinity']) {
        const item={consumption,motoHoursDay:'12',max5Days:'KEEP'};c.applyEquipmentFuelLimits(item,12,true);assert.equal(item.max5Days,'KEEP');
    }
    for(const hours of ['bad','25','-1']) {
        const item={consumption:'1',motoHoursDay:hours,max5Days:'KEEP'};c.applyEquipmentFuelLimits(item,12,true);assert.equal(item.max5Days,'KEEP');
    }
    const item={consumption:'1',motoHoursDay:'0'};c.applyEquipmentFuelLimits(item);assert.equal(item.max30Days,'0.00');
});
