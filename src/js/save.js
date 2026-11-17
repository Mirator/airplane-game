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
function save(){if(!G||G.over)return;if(metaDirty){saveMeta();metaDirty=false;}try{localStorage.setItem(RUN_KEY,JSON.stringify(G));}catch(e){}}
function clearSave(){try{localStorage.removeItem(RUN_KEY);}catch(e){}}
function hasSave(){try{return !!localStorage.getItem(RUN_KEY);}catch(e){return false;}}
function continueRun(){
 try{
  const g=JSON.parse(localStorage.getItem(RUN_KEY));
  if(!g||!g.p||!g.map||g.map.length!==W*H)throw 0;
  G=g;G.stopWalk=false;G.perks=G.perks||{};G.cd=Object.assign({dash:0,bolt:0,bash:0,vanish:0},G.cd||{});G.vanish=G.vanish||0;G.syn=G.syn||{};if(!CLS[G.p.cls])G.p.cls='warrior';G.p.wt=TR[G.p.wt]?G.p.wt:null;G.p.at=TR[G.p.at]?G.p.at:null;G.enemies=(G.enemies||[]).filter(e=>EN[e.t]);for(const e of G.enemies)if(e.wind&&!(Array.isArray(e.wind.tiles)&&e.wind.tiles.every(t=>Array.isArray(t)&&inb(t[0],t[1]))))e.wind=null;gearQ=null;G.bl=G.bl||0;G.traps=Array.isArray(G.traps)?G.traps.filter(t=>t&&inb(t.x,t.y)&&TRAPS[t.k]):[];G.shrine=(G.shrine&&inb(G.shrine.x,G.shrine.y))?G.shrine:null;G.merchant=(G.merchant&&inb(G.merchant.x,G.merchant.y)&&Array.isArray(G.merchant.stock))?G.merchant:null;G.treasure=G.treasure||null;G.keys=G.keys||0;G.ppois=(G.ppois&&G.ppois.t>0)?G.ppois:null;G.killer=G.killer||'';shrineQ=false;trapConfirm=-1;G.items=(G.items||[]).filter(i=>i&&inb(i.x,i.y));G.ssUsed=G.ssUsed||0;G.swUsed=G.swUsed||0;armed=null;dest=null;tapMark=null;bigMap=false;computeVis();hideTitle();closeModal();render();
  if(G.pending>0)showPerk();
 }catch(e){clearSave();G=null;showTitle();}
}
