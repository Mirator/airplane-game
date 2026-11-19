// save.js - permanent meta save (banked gold, shop levels, unlocks), achievements, and the run autosave / Continue.

let meta={seenHelp:0,gold:0,wins:0,best:0,unl:{}};
// meta fields added with floor modifiers / daily / records / achievements / Hard / idle layer: every one gets a safe default when an older save lacks it.
// mv = meta version: 1 (no field) had the flat shop (hp atk pot goldp def) and the Hard toggle, 2 has meta.up / pv (upgrade levels, pair variants), bp (blueprints),
// heat / heatSel, exp (expeditions).
const META_DEFAULTS=()=>({rec:{n:{},h:{}},ach:{},dly:{},dlyN:0,mods:{},runs:0,streak:0,bstreak:0,hwins:0,hardOn:0,aruns:0,up:{},pv:{},bp:{},leg:{},heat:0,heatSel:0,bestM:0,exp:{}});
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
 for(const k of ['dlyN','runs','streak','bstreak','hwins','hardOn','aruns'])meta[k]=+meta[k]||0;}
// Old (mv 1) shop levels become the same level of the new upgrade of that name (the first levels are identical to the old ones, so nothing gets worse); gold carries over;
// "Hard unlocked" (a win) is Heat 1 unlocked, and a Hard toggle that was on selects Heat 1. Runs once: mv is set afterwards.
// A new level can give less than the old one did, so the difference is kept as a permanent "veteran" bonus (meta.leg): no migrated save ever loses stats.
if(hadMeta&&!(+metaRaw.mv>=2)){
 meta.leg={};
 for(const u of UPG){
  const n=Math.floor(+metaRaw[u.k]),g=BAL.upg.legacy[u.k];if(!(n>0)||!g)continue;
  const l=Math.min(n,upMax(u)),was=n*g,now=u.int?Math.round(upVal(u,l)):upVal(u,l);
  meta.up[u.k]=l;if(was>now)meta.leg[u.k]=was-now;
 }
 for(const k of ['hp','atk','def','pot','goldp','hardOn'])delete meta[k];   // the flat fields of the old shop and the Hard toggle: replaced by up / leg / heatSel
 if(+metaRaw.wins>=1)meta.heat=Math.max(+meta.heat||0,1);
 if(metaRaw.hardOn&&+metaRaw.wins>=1)meta.heatSel=1;
 migrated=true;
}
meta.mv=2;delete meta.unl.trapper;   // the removed Trapfinder unlock
if(hadMeta&&metaRaw.bestM===undefined)meta.bestM=+meta.best||0;   // a save from before the gate: the deepest floor it ever reached counts (Auto runs included, we cannot tell)
// every field of the idle layer is checked on every boot: anything missing or damaged is replaced by a safe value, never an exception
function expRecOk(r){return !!r&&typeof r==='object'&&!!CLS[r.cls]&&BAL.exp.durs.some(d=>d.min===+r.dur)&&isFinite(+r.t0)&&isFinite(+r.seed)&&isFinite(+r.pw)&&+r.pw>=0;}
function expRepOk(r){return !!r&&typeof r==='object'&&!!CLS[r.cls]&&['dur','el','delves','floor','kills','deaths','gold'].every(k=>isFinite(+r[k]))&&(r.bp==null||BPS.some(b=>b.id===r.bp));}
function cleanMeta(){
 const isO=v=>!!v&&typeof v==='object'&&!Array.isArray(v),cl=(v,lo,hi)=>{v=Math.floor(+v);return isFinite(v)?Math.max(lo,Math.min(hi,v)):lo;};
 meta.gold=cl(meta.gold,0,1e9);
 if(!isO(meta.up))meta.up={};if(!isO(meta.pv))meta.pv={};if(!isO(meta.bp))meta.bp={};if(!isO(meta.exp))meta.exp={};
 const up={},pv={},bp={};
 for(const u of UPG)up[u.k]=cl(meta.up[u.k],0,upMax(u));
 for(const q of PAIRS){up[q.k]=cl(meta.up[q.k],0,q.max);pv[q.k]=meta.pv[q.k]===1?1:0;}
 for(const b of BPS){const v=meta.bp[b.id];if(v===1||v===2)bp[b.id]=v;}
 meta.up=up;meta.pv=pv;meta.bp=bp;
 const leg={};if(isO(meta.leg))for(const k in BAL.upg.legacy){const v=Math.floor(+meta.leg[k]);if(isFinite(v)&&v>0)leg[k]=Math.min(v,1000);}meta.leg=leg;
 meta.bestM=cl(meta.bestM,0,MAXF);meta.heat=cl(meta.heat,0,BAL.heat.max);meta.heatSel=cl(meta.heatSel,0,BAL.heat.max);
 const e=meta.exp,run=[null,null];
 for(let i=0;i<2;i++){const r=Array.isArray(e.run)?e.run[i]:null;if(expRecOk(r))run[i]={cls:r.cls,dur:+r.dur,t0:Math.min(+r.t0,Date.now()),seed:Math.floor(+r.seed)>>>0,pw:+r.pw,bf:cl(r.bf,0,MAXF)};}
 const rp=expRepOk(e.rep)?{cls:e.rep.cls,dur:+e.rep.dur,el:+e.rep.el,delves:+e.rep.delves,floor:+e.rep.floor,kills:+e.rep.kills,deaths:+e.rep.deaths,gold:+e.rep.gold,bp:e.rep.bp||null,early:e.rep.early?1:0}:null;
 meta.exp={s2:e.s2?1:0,run:run,rep:rp};
}
cleanMeta();
// Another tab erased the progress (Reset): this tab still holds the old meta and run in memory and would write them straight back with its next save. It stops writing and reloads.
let staleTab=false;
function saveMeta(){if(staleTab)return;try{localStorage.setItem(META_KEY,JSON.stringify(meta));}catch(e){}}
window.addEventListener('storage',function(ev){
 if(resetting||staleTab)return;
 if(ev.key===null||(ev.key===META_KEY&&ev.newValue===null)){staleTab=true;try{location.reload();}catch(e){}}
});
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
// Chromium commits localStorage to disk in batches at most about once a minute, so after a hard kill of the browser (crash,
// OS killing the tab/app, "restart") the newest run saves - up to the whole run - are gone and Continue is missing. The run is
// therefore mirrored into IndexedDB, which commits per transaction and survives a kill. Value: JSON string, or '' = "cleared".
let idbConn=null,idbWant,idbBusy=false;
function idbOpen(cb){
 if(idbConn)return cb(idbConn);
 try{
  const rq=indexedDB.open(IDB_NAME,1);
  rq.onupgradeneeded=function(){rq.result.createObjectStore('s');};
  rq.onsuccess=function(){idbConn=rq.result;idbConn.onclose=function(){idbConn=null;};idbConn.onversionchange=function(){try{idbConn.close();}catch(e){}idbConn=null;};/* another tab's deleteDatabase must not be blocked by this connection */cb(idbConn);};
  rq.onerror=rq.onblocked=function(){cb(null);};
 }catch(e){cb(null);}
}
// writes are coalesced: one transaction in flight, only the newest value waits behind it
function idbFlush(){
 if(resetting||idbBusy||idbWant===undefined)return;idbBusy=true;
 idbOpen(function(db){
  const v=idbWant;idbWant=undefined;
  if(!db){idbBusy=false;return;}
  const done=function(){idbBusy=false;idbFlush();};
  try{const tx=db.transaction('s','readwrite');tx.objectStore('s').put(v,'run2');tx.oncomplete=tx.onerror=tx.onabort=done;}catch(e){idbBusy=false;}
 });
}
function idbPutRun(v){idbWant=v;idbFlush();}
function save(){
 if(!G||G.over||staleTab)return;if(metaDirty){saveMeta();metaDirty=false;}
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
 let autoWas=false;
 try{
  const raw=localStorage.getItem(RUN_KEY);if(!runStrOk(raw))throw 0;
  const g=JSON.parse(raw);
  G=g;G.ver=SAVE_VER;G.stopWalk=false;rngS=G.daily?{a:G.rs>>>0}:null;
  if(!G.stats){G.stats={pots:0,dragonHit:0,legacy:1};}   // run from before records/achievements: its history is unknown, so run-history achievements are skipped
  G.mod=modOf(G.mod)?G.mod:null;G.variant=G.variant|0;G.water=Array.isArray(G.water)?G.water:[];G.cracks=Array.isArray(G.cracks)?G.cracks.filter(c=>c&&inb(c.x,c.y)):[];G.crackT=G.crackT|0;G.wade=0;G.hard=G.hard?1:0;G.heat=Math.max(0,Math.min(BAL.heat.max,Math.floor(+G.heat)||(G.hard?1:0)));G.hard=G.heat>=1?1:0;G.fz=G.fz|0;G.lsUsed=G.lsUsed|0;G.daily=typeof G.daily==='string'?G.daily:null;
  G.opts=Array.isArray(G.opts)&&G.opts.length===2?G.opts.map(o=>({mod:modOf(o&&o.mod)?o.mod:null,v:(o&&o.v)|0})):null;{const had=Array.isArray(G.picks);G.picks=had?G.picks.filter(q=>q&&Array.isArray(q.o)&&q.o.every(i=>perkById(i))).map(q=>({l:q.l|0,o:q.o.slice()})):[];G.pending=had?G.picks.length:Math.max(0,Math.min(9,Math.floor(+G.pending)||0));}   // an older save has no stored picks: its pending count stays and showPerk rolls the options
  G.perks=G.perks||{};for(const k of Object.keys(G.perks))if(!PERKS.some(q=>q.id===k))delete G.perks[k];   // a removed perk (Trapfinder) is dropped silently
  G.syn=G.syn||{};G.vanish=G.vanish||0;
  {const a=(G.auto&&typeof G.auto==='object')?G.auto:{},wasOn=!!a.on;G.auto={on:0,used:a.used?1:0,noticed:a.noticed?1:0,t:Math.max(0,Math.floor(+a.t)||0)};autoReset();autoWas=wasOn;}   // Auto never starts acting on load: the run comes back paused
  if(!CLS[G.p.cls])G.p.cls='warrior';
  G.cd=Object.assign({},G.cd||{});for(const k of CLS[G.p.cls].kit)G.cd[k]=G.cd[k]||0;
  for(const sl of SLOTS){const it=G.p.eq[sl];if(it&&!(kindTable(sl)[it.k]))G.p.eq[sl]=null;else if(it&&it.tr&&!TR[it.tr])it.tr=null;}
  G.enemies=(G.enemies||[]).filter(e=>EN[e.t]);
  for(const e of G.enemies)if(e.wind&&!(Array.isArray(e.wind.tiles)&&e.wind.tiles.every(t=>Array.isArray(t)&&inb(t[0],t[1]))))e.wind=null;
  gearQ=null;G.bl=G.bl||0;G.knives=G.knives||0;G.smoke=Array.isArray(G.smoke)?G.smoke:[];G.brace=G.brace||null;
  delete G.traps;delete G.ppois;   // traps and dart poison were removed: an old run loads without them
  G.shrine=(G.shrine&&inb(G.shrine.x,G.shrine.y))?G.shrine:null;
  G.merchant=(G.merchant&&inb(G.merchant.x,G.merchant.y)&&Array.isArray(G.merchant.stock))?G.merchant:null;
  G.treasure=G.treasure||null;G.keys=G.keys||0;G.killer=G.killer||'';
  shrineQ=false;G.items=(G.items||[]).filter(i=>i&&inb(i.x,i.y));G.ssUsed=G.ssUsed||0;G.swUsed=G.swUsed||0;
  armed=null;dest=null;tapMark=null;bigMap=false;computeVis();hideTitle();closeModal();render();
  if(autoWas)msg('Auto is paused. Tap AUTO to resume.');
 }catch(e){clearSave();G=null;showTitle();}
}

// ---- reset: wipes everything this game stored (meta save, run save, Auto speed; localStorage and the IndexedDB mirror) and nothing else on the origin
let resetting=false;
function freshMeta(){
 for(const k of Object.keys(meta))delete meta[k];
 Object.assign(meta,{seenHelp:0,gold:0,wins:0,best:0,unl:{}},META_DEFAULTS());
 meta.kills=0;meta.elites=0;meta.sound=0;meta.mv=2;cleanMeta();
}
function wipeAll(done){
 resetting=true;idbWant=undefined;
 try{for(const k of [META_KEY,RUN_KEY].concat(OLD_RUN_KEYS,[AUTO_SPEED_KEY]))localStorage.removeItem(k);}catch(e){}
 freshMeta();noticeOld=false;G=null;armed=null;
 try{AUTO.speed=BAL.auto.speeds[0];}catch(e){}
 let fin=false;const end=function(){if(fin)return;fin=true;resetting=false;try{if(idbConn){idbConn.close();idbConn=null;}}catch(e){}if(done)done();};
 const drop=function(){try{if(idbConn){idbConn.close();idbConn=null;}const r=indexedDB.deleteDatabase(IDB_NAME);r.onsuccess=r.onerror=r.onblocked=end;}catch(e){end();}};
 setTimeout(end,1500);
 const wait=function(){if(idbBusy)return setTimeout(wait,30);
  idbOpen(function(db){if(!db){end();return;}try{const tx=db.transaction('s','readwrite');tx.objectStore('s').clear();tx.oncomplete=drop;tx.onerror=tx.onabort=end;}catch(e){end();}});};
 wait();
}
