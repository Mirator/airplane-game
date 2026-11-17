// save.js - permanent meta save (banked gold, shop levels, unlocks), achievements, and the run autosave / Continue.

let meta={seenHelp:0,gold:0,hp:0,atk:0,pot:0,goldp:0,def:0,wins:0,best:0,unl:{}};
let metaRaw=null,metaDirty=false;
try{metaRaw=JSON.parse(localStorage.getItem(META_KEY));}catch(e){}
const hadMeta=!!(metaRaw&&typeof metaRaw==='object'&&!Array.isArray(metaRaw));
if(hadMeta)Object.assign(meta,metaRaw);
if(!meta.unl||typeof meta.unl!=='object'||Array.isArray(meta.unl))meta.unl={};
// migration: players with an older meta save keep every class they could already play
let migrated=false;
if(hadMeta&&!metaRaw.unl){meta.unl.rogue=1;meta.unl.mage=1;migrated=true;}
meta.kills=+meta.kills||0;meta.elites=+meta.elites||0;meta.sound=meta.sound?1:0;
function saveMeta(){try{localStorage.setItem(META_KEY,JSON.stringify(meta));}catch(e){}}
function checkAch(){
 let any=false;
 for(const u of UNLOCKS)if(u.chk&&!meta.unl[u.id]&&u.chk()){
  meta.unl[u.id]=1;any=true;
  if(G){msg('Unlocked: '+u.n.replace(/^Perk: /,'')+'! ('+u.ach+')');(G.newUnl=G.newUnl||[]).push(u.n);}
 }
 if(any)saveMeta();
}
checkAch();if(migrated)saveMeta();
function cost(s){const l=meta[s.k];return Math.round(s.base*(l+1)*(1+l*BAL.meta.costGrowth));}
// Chromium commits localStorage to disk in batches at most about once a minute, so after a hard kill of the browser (crash,
// OS killing the tab/app, "restart") the newest run saves - up to the whole run - are gone and Continue is missing. The run is
// therefore mirrored into IndexedDB, which commits per transaction and survives a kill. Value: JSON string, or '' = "cleared".
let idbConn=null,idbWant,idbBusy=false;
function idbOpen(cb){
 if(idbConn)return cb(idbConn);
 try{
  const rq=indexedDB.open(IDB_NAME,1);
  rq.onupgradeneeded=function(){rq.result.createObjectStore('s');};
  rq.onsuccess=function(){idbConn=rq.result;idbConn.onclose=idbConn.onversionchange=function(){idbConn=null;};cb(idbConn);};
  rq.onerror=rq.onblocked=function(){cb(null);};
 }catch(e){cb(null);}
}
// writes are coalesced: one transaction in flight, only the newest value waits behind it
function idbFlush(){
 if(idbBusy||idbWant===undefined)return;idbBusy=true;
 idbOpen(function(db){
  const v=idbWant;idbWant=undefined;
  if(!db){idbBusy=false;return;}
  const done=function(){idbBusy=false;idbFlush();};
  try{const tx=db.transaction('s','readwrite');tx.objectStore('s').put(v,'run');tx.oncomplete=tx.onerror=tx.onabort=done;}catch(e){idbBusy=false;}
 });
}
function idbPutRun(v){idbWant=v;idbFlush();}
function save(){
 if(!G||G.over)return;if(metaDirty){saveMeta();metaDirty=false;}
 G.ts=Date.now();let js;try{js=JSON.stringify(G);}catch(e){return;}
 try{localStorage.setItem(RUN_KEY,js);}catch(e){}
 idbPutRun(js);
}
function clearSave(){try{localStorage.removeItem(RUN_KEY);}catch(e){}idbPutRun('');}
// boot: if the IndexedDB mirror is newer than (or contradicts) localStorage, adopt it and refresh the title screen
function syncRunFromIdb(){
 idbOpen(function(db){if(!db)return;let g;try{g=db.transaction('s','readonly').objectStore('s').get('run');}catch(e){return;}g.onsuccess=function(){
  const v=g.result;if(v===undefined||G)return;
  let ls=null,lsTs=-1;try{const r=localStorage.getItem(RUN_KEY);if(r){ls=r;lsTs=JSON.parse(r).ts||0;}}catch(e){}
  try{
   if(v===''){if(ls)localStorage.removeItem(RUN_KEY);else return;}
   else{const o=JSON.parse(v);if(ls&&lsTs>=(o.ts||0))return;localStorage.setItem(RUN_KEY,v);}
  }catch(e){return;}
  if($('title').style.display!=='none'&&$('modal').style.display==='none')showTitle(1);
 };});
}
function hasSave(){try{return !!localStorage.getItem(RUN_KEY);}catch(e){return false;}}
function continueRun(){
 try{
  const g=JSON.parse(localStorage.getItem(RUN_KEY));
  if(!g||!g.p||!g.map||g.map.length!==W*H)throw 0;
  G=g;G.stopWalk=false;G.perks=G.perks||{};G.cd=Object.assign({dash:0,bolt:0,bash:0,vanish:0},G.cd||{});G.vanish=G.vanish||0;G.syn=G.syn||{};if(!CLS[G.p.cls])G.p.cls='warrior';G.p.wt=TR[G.p.wt]?G.p.wt:null;G.p.at=TR[G.p.at]?G.p.at:null;G.enemies=(G.enemies||[]).filter(e=>EN[e.t]);for(const e of G.enemies)if(e.wind&&!(Array.isArray(e.wind.tiles)&&e.wind.tiles.every(t=>Array.isArray(t)&&inb(t[0],t[1]))))e.wind=null;gearQ=null;G.bl=G.bl||0;G.traps=Array.isArray(G.traps)?G.traps.filter(t=>t&&inb(t.x,t.y)&&TRAPS[t.k]):[];G.shrine=(G.shrine&&inb(G.shrine.x,G.shrine.y))?G.shrine:null;G.merchant=(G.merchant&&inb(G.merchant.x,G.merchant.y)&&Array.isArray(G.merchant.stock))?G.merchant:null;G.treasure=G.treasure||null;G.keys=G.keys||0;G.ppois=(G.ppois&&G.ppois.t>0)?G.ppois:null;G.killer=G.killer||'';shrineQ=false;trapConfirm=-1;G.items=(G.items||[]).filter(i=>i&&inb(i.x,i.y));G.ssUsed=G.ssUsed||0;G.swUsed=G.swUsed||0;armed=null;dest=null;tapMark=null;bigMap=false;computeVis();hideTitle();closeModal();render();
  if(G.pending>0)showPerk();
 }catch(e){clearSave();G=null;showTitle();}
}
