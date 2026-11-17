// save.js - permanent meta save (banked gold, shop levels, unlocks), achievements, and the run autosave / Continue.

let meta={seenHelp:0,gold:0,hp:0,atk:0,pot:0,goldp:0,def:0,wins:0,best:0,unl:{}};
// meta fields added with floor modifiers / daily / records / achievements / Hard: every one gets a safe default when an older save lacks it
const META_DEFAULTS=()=>({rec:{n:{},h:{}},ach:{},dly:{},dlyN:0,mods:{},runs:0,streak:0,bstreak:0,hwins:0,hardOn:0});
let metaRaw=null,metaDirty=false;
try{metaRaw=JSON.parse(localStorage.getItem(META_KEY));}catch(e){}
const hadMeta=!!(metaRaw&&typeof metaRaw==='object'&&!Array.isArray(metaRaw));
if(hadMeta)Object.assign(meta,metaRaw);
if(!meta.unl||typeof meta.unl!=='object'||Array.isArray(meta.unl))meta.unl={};
// migration: players with an older meta save keep every class they could already play
let migrated=false;
if(hadMeta&&!metaRaw.unl){meta.unl.rogue=1;meta.unl.mage=1;migrated=true;}
meta.kills=+meta.kills||0;meta.elites=+meta.elites||0;meta.sound=meta.sound?1:0;
{const D=META_DEFAULTS();for(const k in D){if(meta[k]===undefined||meta[k]===null||(typeof D[k]==='object'&&(typeof meta[k]!=='object'||Array.isArray(meta[k]))))meta[k]=D[k];}
 for(const k of ['n','h'])if(!meta.rec[k]||typeof meta.rec[k]!=='object')meta.rec[k]={};
 for(const k of ['dlyN','runs','streak','bstreak','hwins','hardOn'])meta[k]=+meta[k]||0;}
function saveMeta(){try{localStorage.setItem(META_KEY,JSON.stringify(meta));}catch(e){}}
function checkAch(){
 let any=checkAchievements();
 for(const u of UNLOCKS)if(u.chk&&!meta.unl[u.id]&&u.chk()){
  meta.unl[u.id]=1;any=true;
  if(G){msg('Unlocked: '+u.n.replace(/^Perk: /,'')+'! ('+u.ach+')');(G.newUnl=G.newUnl||[]).push(u.n);}
 }
 if(any)saveMeta();
}
checkAch();if(migrated)saveMeta();
// run saves are versioned (SAVE_VER). A run saved by an older version is discarded on boot (no migration) and the title shows a notice.
try{for(const k of OLD_RUN_KEYS){if(localStorage.getItem(k)!==null){localStorage.removeItem(k);noticeOld=true;}}}catch(e){}
function runStrOk(s){try{const o=JSON.parse(s);return !!o&&RUN_VERS.indexOf(o.ver)>=0&&!!o.p&&!!o.p.eq&&Array.isArray(o.map)&&o.map.length===W*H;}catch(e){return false;}}
try{const r=localStorage.getItem(RUN_KEY);if(r&&!runStrOk(r)){localStorage.removeItem(RUN_KEY);noticeOld=true;}}catch(e){}
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
  try{const tx=db.transaction('s','readwrite');tx.objectStore('s').put(v,'run2');tx.oncomplete=tx.onerror=tx.onabort=done;}catch(e){idbBusy=false;}
 });
}
function idbPutRun(v){idbWant=v;idbFlush();}
function save(){
 if(!G||G.over)return;if(metaDirty){saveMeta();metaDirty=false;}
 if(rngS)G.rs=rngS.a;G.ts=Date.now();let js;try{js=JSON.stringify(G);}catch(e){return;}
 try{localStorage.setItem(RUN_KEY,js);}catch(e){}
 idbPutRun(js);
}
function clearSave(){try{localStorage.removeItem(RUN_KEY);}catch(e){}idbPutRun('');}
// boot: if the IndexedDB mirror is newer than (or contradicts) localStorage, adopt it and refresh the title screen
function syncRunFromIdb(){
 idbOpen(function(db){if(!db)return;let g;try{g=db.transaction('s','readonly').objectStore('s').get('run2');}catch(e){return;}g.onsuccess=function(){
  try{db.transaction('s','readwrite').objectStore('s').delete('run');}catch(e){}   // stale pre-v2 mirror entry
  const v=g.result;if(v===undefined||G)return;
  let ls=null,lsTs=-1;try{const r=localStorage.getItem(RUN_KEY);if(r){ls=r;lsTs=JSON.parse(r).ts||0;}}catch(e){}
  try{
   if(v===''){if(ls)localStorage.removeItem(RUN_KEY);else return;}
   else{if(!runStrOk(v))return;const o=JSON.parse(v);if(ls&&lsTs>=(o.ts||0))return;localStorage.setItem(RUN_KEY,v);}
  }catch(e){return;}
  if($('title').style.display!=='none'&&$('modal').style.display==='none')showTitle(1);
 };});
}
function hasSave(){try{const r=localStorage.getItem(RUN_KEY);return !!r&&runStrOk(r);}catch(e){return false;}}
function continueRun(){
 try{
  const raw=localStorage.getItem(RUN_KEY);if(!runStrOk(raw))throw 0;
  const g=JSON.parse(raw);
  G=g;G.ver=SAVE_VER;G.stopWalk=false;rngS=G.daily?{a:G.rs>>>0}:null;
  if(!G.stats){G.stats={pots:0,dragonHit:0,legacy:1};}   // run from before records/achievements: its history is unknown, so run-history achievements are skipped
  G.mod=modOf(G.mod)?G.mod:null;G.variant=G.variant|0;G.water=Array.isArray(G.water)?G.water:[];G.cracks=Array.isArray(G.cracks)?G.cracks.filter(c=>c&&inb(c.x,c.y)):[];G.crackT=G.crackT|0;G.wade=0;G.hard=G.hard?1:0;G.daily=typeof G.daily==='string'?G.daily:null;
  G.opts=Array.isArray(G.opts)&&G.opts.length===2?G.opts.map(o=>({mod:modOf(o&&o.mod)?o.mod:null,v:(o&&o.v)|0})):null;G.perks=G.perks||{};G.syn=G.syn||{};G.vanish=G.vanish||0;
  if(!CLS[G.p.cls])G.p.cls='warrior';
  G.cd=Object.assign({},G.cd||{});for(const k of CLS[G.p.cls].kit)G.cd[k]=G.cd[k]||0;
  for(const sl of SLOTS){const it=G.p.eq[sl];if(it&&!(kindTable(sl)[it.k]))G.p.eq[sl]=null;else if(it&&it.tr&&!TR[it.tr])it.tr=null;}
  G.enemies=(G.enemies||[]).filter(e=>EN[e.t]);
  for(const e of G.enemies)if(e.wind&&!(Array.isArray(e.wind.tiles)&&e.wind.tiles.every(t=>Array.isArray(t)&&inb(t[0],t[1]))))e.wind=null;
  gearQ=null;G.bl=G.bl||0;G.knives=G.knives||0;G.smoke=Array.isArray(G.smoke)?G.smoke:[];G.brace=G.brace||null;
  G.traps=Array.isArray(G.traps)?G.traps.filter(t=>t&&inb(t.x,t.y)&&TRAPS[t.k]):[];
  G.shrine=(G.shrine&&inb(G.shrine.x,G.shrine.y))?G.shrine:null;
  G.merchant=(G.merchant&&inb(G.merchant.x,G.merchant.y)&&Array.isArray(G.merchant.stock))?G.merchant:null;
  G.treasure=G.treasure||null;G.keys=G.keys||0;G.ppois=(G.ppois&&G.ppois.t>0)?G.ppois:null;G.killer=G.killer||'';
  shrineQ=false;trapConfirm=-1;G.items=(G.items||[]).filter(i=>i&&inb(i.x,i.y));G.ssUsed=G.ssUsed||0;G.swUsed=G.swUsed||0;
  armed=null;dest=null;tapMark=null;bigMap=false;computeVis();hideTitle();closeModal();render();
  if(G.pending>0)showPerk();
 }catch(e){clearSave();G=null;showTitle();}
}
