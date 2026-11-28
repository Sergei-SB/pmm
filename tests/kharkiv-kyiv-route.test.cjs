const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function fixture(){const c={console};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../formulas.js'),'utf8'),c);return c;}
const item=(result,type)=>result.calculatedResults.find(row=>row.type===type);

test('Passenger: 500 km becomes 60 city + 440 highway, with +5% and -15%, without BZ rows',()=>{
 const c=fixture(),r=c.calculateRouteFuel([{name:'Харків – Київ',km:500}],10,[1,2,3,4]);
 assert.equal(item(r,'kharkivKyivCity').km,60);
 assert.equal(item(r,'kharkivKyivHighway').km,440);
 assert.ok(Math.abs(item(r,'kharkivKyivCity').resVal-6.3)<1e-9);
 assert.ok(Math.abs(item(r,'kharkivKyivHighway').resVal-37.4)<1e-9);
 assert.equal(r.totalFuel,43.7);
 assert.deepEqual(Array.from(r.calculatedResults,row=>row.type),['kharkivKyivCity','kharkivKyivHighway']);
});
test('Truck retains work, cargo and AdBlue with city +10% and highway -5%',()=>{
 const c=fixture(),r=c.calculateRouteFuel([{name:'Харків - Київ',km:500,tkm:1000}],20,[5,1,2,3,6,7]);
 assert.ok(Math.abs(item(r,'kharkivKyivCity').resVal-13.2)<1e-9);
 assert.ok(Math.abs(item(r,'kharkivKyivHighway').resVal-83.6)<1e-9);
 assert.equal(item(r,'work').resVal,1000);
 assert.equal(item(r,'cargoTransport').resVal,9);
 assert.equal(r.totalFuel,105.8);
 assert.ok(Math.abs(item(r,'adblue').resVal-5.29)<1e-9);
 assert.equal(item(r,'bz'),undefined);
 assert.equal(item(r,'cityKyiv'),undefined);
 const noAdBlue=c.calculateRouteFuel([{name:'Харків — Київ',km:500}],20,[5,1,2,3,6]);
 assert.equal(item(noAdBlue,'adblue'),undefined);
});
test('Mixed routes keep the original breakdown for their own kilometres without double counting',()=>{
 const c=fixture(),r=c.calculateRouteFuel([{name:'Харків — Київ',km:500},{name:'Виконання БЗ Харків',km:100}],10,[1,2,3,4]);
 assert.equal(item(r,'bz').km,33);
 assert.equal(item(r,'city').km,18);
 assert.equal(item(r,'highway').km,49);
 assert.equal(item(r,'kharkivKyivCity').km,60);
 assert.equal(item(r,'kharkivKyivHighway').km,440);
 assert.equal(r.calculatedResults.reduce((sum,row)=>sum+row.km,0),600);
});
test('Existing route and motorcycle calculations remain unchanged; saved input rows recognize the preset',()=>{
 const c=fixture();
 assert.equal(c.calculateRouteFuel([{name:'Виконання БЗ Харків',km:100}],21.5,[1,2,3]).totalFuel,21.53);
 const saved=c.calculateRouteFuel([{inputs:['Харків – Київ','8:30','','','','500','','0']}],10,[1,2,3,4]);
 assert.equal(saved.totalFuel,43.7);
 const moto=c.calculateRouteFuel([{name:'Харків – Київ',km:500}],5,[8]);
 assert.equal(item(moto,'kharkivKyivCity'),undefined);
 assert.equal(item(moto,'motoBz').km,500);
});
test('Daily mode uses the same route split for each day',()=>{
 const c=fixture();c.document={addEventListener(){},getElementById(){return null;}};
 c.sessionStorage={getItem(){return null;}};c.evaluateExpression=value=>Number(value)||0;
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../daily_routes.js'),'utf8'),c);
 const row={dataset:{routeDay:'1'},querySelector:selector=>({value:selector==='input[type="text"]'?'Харків – Київ':selector==='.total-col'?'500':'0'})};
 const result=c.calculateDailyRoutes([row],10,[1,2,3,4],false);
 assert.equal(result.totalFuel,43.7);
 assert.equal(item(result,'kharkivKyivCity').km,60);
});
