// main.js - boot: first render, title screen, and the window.__dbg debug/test API.

for(const k in EN)if(SPR[EN[k].e])SPR[EN[k].e].halo=1;
resize();
showTitle();
syncRunFromIdb();
window.__dbg=function(){return G;};
window.__dbg.setSpendNow=function(v){spendNow=!!v;};
window.__dbg.grant=function(id){const r=addPerk(id);if(G)render();return r;};
window.__dbg.fn={showPerk:showPerk,onTap:onTap,render:render,frameSight:frameSight,genFloor:genFloor,newFloor:newFloor,startRun:startRun,makeEnemy:makeEnemy,enemiesAct:enemiesAct,endTurn:endTurn,tryMove:tryMove,knock:knock,explore:explore,dangerSet:function(){const s=dangerSet();for(const k of crackSet())s.add(k);return Array.from(s);},goDown:goDown,rollOpts:rollOpts,crackTick:crackTick,buildFloor:buildFloor,computeVis:computeVis,descend:descend,save:save,bfsPath:bfsPath,hurtPlayer:hurtPlayer,hurtEnemy:hurtEnemy,use:useAbility,whyNot:whyNot,targetTiles:targetTiles,reachOk:reachOk,reachAttack:reachAttack,playerAttack:playerAttack,toggleAbility:toggleAbility,canShoot:canShoot,shoot:function(x,y){const e=enemyAt(x,y);return !!e&&mageShot(e);},summonWhelps:summonWhelps,shuf:shuf,exploreBlockers:exploreBlockers,bossPhase:bossPhase,dim:{W:W,H:H,MAXF:MAXF}};
window.__dbg.api={perkPool:perkPool,needXp:needXp,gainXp:gainXp,vt:function(){const n=performance.now();return {pflash:flashes.p?flashes.p-n:null,labels:fx.map(f=>({text:f.text,c:!!f.c,at:f.t-n,x:f.x,y:f.y}))};},floatFx:floatFx,labelBoxes:function(T){return fx.filter(f=>!f.c&&T>=f.t&&T<f.t+f.d).map(f=>{const p=lblPos(f,T),w=lblW(f.text,f.sz,f.k),h=f.sz*(f.k==='n'?1.15:1.5);return {text:f.text,k:f.k,l:p[0]-w/2,r:p[0]+w/2,t:p[1]-h/2,b:p[1]+h/2};});},flash:function(){return {full:flashFull,amt:flashAmt,on:flashUntil>performance.now()};},sfx:sfx,toggleSound:toggleSound,deathTip:deathTip,fxState:function(){return {puffs:puffs.length,flashes:Object.keys(flashes).length,shake:shakeUntil>performance.now(),pulse:pulseUntil>performance.now(),AC:!!AC,step:!!stepAnim,fx:fx.length};},finish:finish,UNLOCKS:UNLOCKS,checkAch:checkAch,showTitle:showTitle,afterModals:afterModals,showShrine:showShrine,showShop:showShop,buy:buy,stairsOk:stairsOk,themeOf:themeOf,meta:function(){return meta;},saveMeta:saveMeta,stepEffects:stepEffects,killEnemy:killEnemy,merchantAt:merchantAt};
window.__dbg.mods={MODS:MODS,ACH:ACH,HARD_RULES:HARD_RULES,showBranch:showBranch,earn:earn,checkAchievements:checkAchievements,scoreOf:scoreOf,recordRun:recordRun,recOf:recOf,hardUnlocked:hardUnlocked,hardOn:hardOn,todayKey:todayKey,toast:toast,showRecords:showRecords,showAchievements:showAchievements,showDailyPicker:function(){showClassPicker({daily:true});},waterSet:function(){return Array.from(waterSet());},hashStr:hashStr,setForce:function(id){dbgForce=id||null;}};
window.__dbg.auto={state:function(){return AUTO;},start:function(sync){return autoStart(!!sync);},stop:function(why){autoStop(why||'stopped');},toggle:autoToggle,speed:autoSpeedCycle,step:function(){return autoStep(true);},tick:autoTick,
 runSync:function(cap){cap=cap||12000;let n=0;while(AUTO.on&&G&&!G.over&&n++<cap)autoStep(true);return n;},timers:function(){return AUTO.tm?1:0;},choose:autoChoose,gearScore:autoGearScore,watch:autoWatch};
window.__dbg.insp=function(){return insp;};window.__dbg.view=function(){return view;};window.__dbg.callout=callout;window.__dbg.callouts=function(){const n=performance.now();return fx.filter(f=>f.c&&n-f.t<f.d).map(f=>f.text);};window.__dbg.banner=function(){return bannerUntil>performance.now();};window.__dbg.guard=function(){return guard;};window.__dbg.lowHp=function(){return hpLow;};
window.__dbg.layout=function(){return {wide:isWide(),big:isBig()};};   // which side-panel layout the media queries picked (tests compare it with the CSS)
window.__dbg.labelTiles=function(){const n=performance.now();return fx.filter(f=>!f.c).map(f=>({text:f.text,anchor:[f.x,f.y],drawn:lblTile(f),follows:!!f.fid}));};
window.__dbg.kcursor=function(){return kcGet();};
window.__dbg.walking=function(){return !!dest;};   // a tap-walk / Explore is in progress (tests poll this instead of sleeping)
window.__dbg.hl=function(){return hlFoe;};
window.__dbg.perkIds=PERKS.map(p=>p.id);
window.__dbg.traits=Object.keys(TR);
window.__dbg.tables={BAL:BAL,EN:EN,CLS:CLS,ABIL:ABIL,WP:WP,ARM:ARM,OFF:OFF,CH:CH,PERKS:PERKS,SYN:SYN,TR:TR};
window.__dbg.gear={gearName:gearName,gearDelta:gearDelta,newGear:newGear,equipItem:equipItem,statVec:statVec,sneakMul:sneakMul,maxKnives:maxKnives,mmax:mmax,costOf:costOf,cdFor:cdFor,showEquip:showEquip,showGear:showGear,isFront:isFront,isBehind:isBehind};
// test helper: drop an item (slot, kind, trait, tier value) on a free floor tile next to the player
window.__dbg.spawnGear=function(slot,k,tr,v){
 if(!G)return null;const p=G.p;if(tr&&!TR[tr])return null;
 if(!kindTable(slot)[k])return null;
 for(const [dx,dy] of DIRS){const x=p.x+dx,y=p.y+dy;
  if(walkable(x,y)&&!enemyAt(x,y)&&!itemAt(x,y)&&G.map[ix(x,y)]===1){
   G.items.push({x,y,t:slot,k:k,v:v!=null?v:applyTrait(slot==='weapon'?4:slot==='armor'?3:0,tr||null),tr:tr||null});computeVis();render();return [x,y];}}
 return null;
};
// player-facing text generators, for the text-budget tests
window.__dbg.text={abilityDesc:abilityDesc,classBlurb:classBlurb,classDetail:classDetail,wpRule:wpRule,armRule:armRule,offRule:offRule,charmRule:charmRule,inspectLines:inspectLines,itemRule:itemRule,deathTip:deathTip,optHtml:optHtml,CLASS_TAG:CLASS_TAG};
// art API for the contact sheet and the sprite tests: every sprite id, the bitmap cache, and the list of ids that were asked for but do not exist (must stay empty)
window.__dbg.art={SPR:SPR,spriteBmp:spriteBmp,tileBmp:tileBmp,ic:ic,ENV:ENV,THEMES2:THEMES2,PAL:PAL,missing:function(){return artMissing.slice();},ids:function(){return Object.keys(SPR);},floorVar:floorVar,dimc:dimc,fxCount:function(){return vfx.length+ghosts.length;}};

// idle / meta layer: the pure model and the screens, for the tests and the simulator
window.__dbg.idle={UPG:UPG,PAIRS:PAIRS,HEAT:HEAT,BPS:BPS,EXP_TABLE:EXP_TABLE,upLvl:upLvl,upBuy:upBuy,upSpent:upSpent,upMaxSpent:upMaxSpent,upCost:upCost,upVal:upVal,upMax:upMax,upNext:upNext,upBonus:upBonus,pairSwitch:pairSwitch,pairVar:pairVar,pairFee:pairFee,
 heatMax:heatMax,heatSel:heatSel,heatGold:heatGold,heatAfterWin:heatAfterWin,bpState:bpState,bpOn:bpOn,bpFound:bpFound,bpBuy:bpBuy,bpCounts:bpCounts,bpRunDrop:bpRunDrop,bpTable:bpTable,bpPick:bpPick,
 expRow:expRow,expResult:expResult,expSend:expSend,expCollect:expCollect,expReady:expReady,expElapsed:expElapsed,expEstimate:expEstimate,expBuySlot:expBuySlot,expReadyCount:expReadyCount,expFree:expFree,autoRate:autoRate,autoPay:autoPay,autoGph:autoGph,autoPerTurn:autoPerTurn,autoTurns:autoTurns,runBank:runBank,expBest:expBest,expGph:expGph,expLeft:expLeft,
 showExpeditions:showExpeditions,showUpgrades:showUpgrades,showExpSend:showExpSend,showExpReport:showExpReport,cleanMeta:cleanMeta,mulberry:mulberry,fmtDur:fmtDur};
