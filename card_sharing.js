(() => {
 const labels={admin:'Адмін',moderator:'Модератор',user:'Юзер'};
 const sessionKey='__sync_local_vehicle_card_sessions', sessions=new Map(), cards=new Map();
 try {const saved=JSON.parse(sessionStorage.getItem(sessionKey)||'{}');for(const r of ['developer','admin','moderator'])if(typeof saved[r]==='string')sessions.set(r,saved[r]);}catch{}
 const controls=document.createElement('span'),status=document.createElement('span');status.setAttribute('role','status');
 const currentRole=()=>window.getCurrentAppRole?.()??window.currentRole??'user';
 let role=currentRole(),active,pending=Promise.resolve();
 const key=(id,p,owner=role)=>`__sync_local_vehicle_card_${owner}_${p}_${id}`;
 const clean=v=>v&&JSON.stringify({...v,topFields:{...v.topFields,updatedAt:undefined}});
 const local=name=>{try{return JSON.parse(localStorage.getItem(name)||'null');}catch{return null;}};
 const redraw=()=>{if(typeof loadCarDataForActivePeriod==='function')loadCarDataForActivePeriod();};
 const message=(card,text,error=false)=>{if(active!==card||currentRole()!==card.owner)return;status.textContent=text;status.hidden=card.owner!=='developer'&&!error;};
 function cache(card){localStorage.setItem(card.key,JSON.stringify(card.draft));if(card.unsaved)localStorage.setItem(card.key+'_pending',JSON.stringify({snapshot:card.draft,version:card.version}));else localStorage.removeItem(card.key+'_pending');}
 async function request(card,action,fields={}){
  const session=sessions.get(card.owner)||sessions.get('developer');
  if(card.owner!=='user'&&!session)throw Error('Зміни збережено на цьому пристрої; для синхронізації потрібна чинна сесія ролі.');
  const base=window.APP_SERVER_URL||'https://pmm-server.onrender.com';
  const response=await fetch(base+'/api/vehicle-cards/'+encodeURIComponent(card.id)+'/'+encodeURIComponent(card.period),{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,session,viewRole:card.owner,...fields}),signal:AbortSignal.timeout(20000)});
  if(!response.ok){const error=Error(response.status===409?'Інший користувач цієї ролі змінив картку. Локальні зміни збережено; потрібно звірити версії.':'Не вдалося синхронізувати картку. Ваші зміни залишилися на цьому пристрої.');error.conflict=response.status===409;throw error;}
  return response.json();
 }
 function enqueueSave(card){
  if(!card.unsaved||!card.ready||card.conflict||card.saving)return;card.saving=true;
  pending=pending.then(async()=>{try{
   while(card.unsaved&&!card.conflict){const snapshot=card.draft;const data=await request(card,'save',{snapshot,baseVersion:card.version});card.version=data.version;if(card.draft===snapshot)card.unsaved=false;cache(card);}
   message(card,'Картку збережено для цієї ролі.');
  }catch(error){card.conflict=Boolean(error.conflict);message(card,error.message,true);}finally{card.saving=false;}});
 }
 async function fetchCard(card){
  if(card.fetching||card.saving||card.conflict)return;card.fetching=true;
  try{const data=await request(card,'read');
   if(card.unsaved){if(!card.ready){if((card.version&&card.version!==data.version)||(!card.version&&data.draft)){card.conflict=true;message(card,'На сервері вже є інша версія цієї ролі. Локальні зміни збережено.',true);return;}card.version=data.version;card.ready=true;}}
   else{const changed=clean(card.draft)!==clean(data.draft);card.draft=data.draft;card.version=data.version;card.ready=true;cache(card);if(changed&&active===card&&currentRole()===card.owner)redraw();}
   enqueueSave(card);
  }catch(error){if(card.unsaved||card.owner==='developer')message(card,error.message,true);}finally{card.fetching=false;}
 }
 function renderControls(){
  controls.replaceChildren();controls.hidden=role!=='developer';if(!active||role!=='developer')return;
  const card=active,select=document.createElement('select');select.setAttribute('aria-label','Отримувач картки');select.add(new Option('Вибрати роль',''));for(const[value,label]of Object.entries(labels))select.add(new Option(label,value));controls.append(select);
  const send=document.createElement('button');send.type='button';send.className='action-btn';send.textContent='Перенести';controls.append(send);
  send.onclick=async()=>{const recipient=select.value;if(!Object.hasOwn(labels,recipient)||currentRole()!=='developer'||active!==card)return;
   if(recipient==='user'&&!confirm('Картка буде доступна всім Юзерам. Перенести?'))return;send.disabled=true;
   try{saveCarRoutesForPeriod(card.period,card.id);await pending;if(card.unsaved||!card.ready)throw Error('Спочатку потрібно синхронізувати картку розробника.');await request(card,'send',{recipient});message(card,'Картку перенесено. Роль: '+labels[recipient]+'.');}catch(error){message(card,error.message,true);}finally{send.disabled=false;}
  };
 }
 window.vehicleCardSharing={
  storageKey:(id,p)=>key(id,p,currentRole()),
  setSession(owner,token){if(typeof token==='string'&&token)sessions.set(owner,token);else sessions.delete(owner);try{sessionStorage.setItem(sessionKey,JSON.stringify(Object.fromEntries(sessions)));}catch{}if(owner===role&&active)fetchCard(active);},
  refreshRole(){const next=currentRole();if(role===next)return;role=next;active=null;cards.clear();controls.replaceChildren();status.textContent='';status.hidden=true;redraw();},
  read(id,period){if(role!==currentRole())this.refreshRole();const name=key(id,period);
   if(active?.key!==name){active=cards.get(name);if(!active){const queued=local(name+'_pending');active={id,period,key:name,owner:role,draft:queued?.snapshot??local(name),version:queued?.version,unsaved:Boolean(queued),ready:false};cards.set(name,active);}status.hidden=true;status.textContent='';fetchCard(active);}
   renderControls();return this.previous(id,period);
  },
  previous(id,p){const name=key(id,p,currentRole());return JSON.stringify(cards.get(name)?.draft??local(name));},
  canSave(id,p){return Boolean(active?.key===key(id,p,currentRole()));},
  saveCurrent(id,p){saveCarRoutesForPeriod(p,id,true);},
  save(id,p,snapshot){if(!this.canSave(id,p))return;const card=active;if(clean(card.draft)===clean(snapshot))return;card.draft=snapshot;card.unsaved=true;cache(card);if(card.ready)enqueueSave(card);else fetchCard(card);}
 };
 const toolbar=document.querySelector('.card-period-box');if(toolbar)toolbar.append(controls,status);
 setInterval(()=>{if(!document.hidden&&active&&currentRole()===active.owner)fetchCard(active);},5000);
})();