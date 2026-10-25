const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function fixture(){
    const nodes={};const c={console,document:{getElementById:id=>nodes[id]||null},localStorage:{getItem:()=>null,setItem(){}}};c.window=c;
    vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../aggregates_calc.js'),'utf8'),c);
    return {c,nodes};
}
test('Calculator uses current inventory norms with decimal commas for each category and distinct IDs',()=>{
    const {c,nodes}=fixture();let current=[];c.getAllEquipmentList=()=>current;
    for(const category of ['Генератор','Webasto','Теплова пушка','Бензопила','Помпа']){
        current=[{id:1,category,model:'SAME',consumption:'0,60',oilNorm10Days:'0,35'},
            {id:2,category,model:'SAME',consumption:'1,25',oilNorm10Days:'1,1'}];
        c._allCalculatedEquipment=current.map(item=>({...item,consumption:'OLD'}));c._selectedAggIndex=1;
        assert.equal(c.getSelectedEquipment().consumption,1.25);assert.equal(c.getSelectedEquipment().oilNorm10Days,1.1);
        current[1].consumption='0,75';assert.equal(c.getSelectedEquipment().consumption,0.75);
        c._selectedAggIndex=0;assert.equal(c.getSelectedEquipment().consumption,0.6);
        nodes['eq-rates-info-box']={innerHTML:''};c.triggerRecalc=()=>{};c.onSelectedEquipmentChange();
        assert.match(nodes['eq-rates-info-box'].innerHTML,/0.6 л\/год/);assert.match(nodes['eq-rates-info-box'].innerHTML,/0.35 л/);
    }
});
test('An absent inventory norm shows an instruction instead of calculating with a fictitious 1 litre per hour',()=>{
    const {c,nodes}=fixture();c.getSelectedEquipment=()=>({consumption:'',oilNorm10Days:'0'});
    nodes['calc-details-box']={textContent:'OLD'};c.triggerRecalc();assert.match(nodes['calc-details-box'].textContent,/Облік обладнання/);
    for(const value of ['', '-', 'bad','-1'])assert.equal(c.aggregateInventoryNumber(value),0);
    assert.equal(c.aggregateInventoryNumber(' 1,25 '),1.25);
});

test('Refreshing inventory preserves the selected physical unit when the list order changes',()=>{
    const {c,nodes}=fixture();nodes['agg-items-list']={};
    c._allCalculatedEquipment=[{id:1,category:'Генератор'},{id:1,category:'Помпа'}];c._selectedAggIndex=1;
    c.getAllEquipmentList=()=>[{id:1,category:'Помпа',consumption:'0,7'},{id:1,category:'Генератор',consumption:'2'}];
    let refreshed=0;c.renderAggDropdownItems=()=>{};c.onSelectedEquipmentChange=()=>refreshed++;
    c.refreshAggregatesEquipmentList();assert.equal(c._selectedAggIndex,0);assert.equal(c.getSelectedEquipment().category,'Помпа');
    assert.equal(c.getSelectedEquipment().consumption,0.7);assert.equal(refreshed,1);
});
