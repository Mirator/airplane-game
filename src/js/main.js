// main.js - boot: first render, title screen, and the window.__dbg debug/test API.

resize();
showTitle();
window.__dbg=function(){return G;};
window.__dbg.grant=function(id){const r=addPerk(id);if(G)render();return r;};
window.__dbg.fn={genFloor:genFloor,newFloor:newFloor,startRun:startRun,makeEnemy:makeEnemy,enemiesAct:enemiesAct,endTurn:endTurn,tryMove:tryMove,knock:knock,explore:explore,dangerSet:function(){return Array.from(dangerSet());},computeVis:computeVis,descend:descend,save:save,bfsPath:bfsPath,useBash:useBash,hurtPlayer:hurtPlayer,useBolt:useBolt,useVanish:useVanish,dim:{W:W,H:H,MAXF:MAXF}};
window.__dbg.api={SHOP:SHOP,cost:cost,sfx:sfx,toggleSound:toggleSound,deathTip:deathTip,fxState:function(){return {puffs:puffs.length,flashes:Object.keys(flashes).length,shake:shakeUntil>performance.now(),pulse:pulseUntil>performance.now(),AC:!!AC,step:!!stepAnim,fx:fx.length};},finish:finish,UNLOCKS:UNLOCKS,checkAch:checkAch,showTitle:showTitle,afterModals:afterModals,springPlayer:springPlayer,springEnemy:springEnemy,showShrine:showShrine,showShop:showShop,buy:buy,stairsOk:stairsOk,themeOf:themeOf,meta:function(){return meta;},saveMeta:saveMeta,wakeAll:wakeAll,stepEffects:stepEffects,killEnemy:killEnemy,merchantAt:merchantAt,trapAt:trapAt};
window.__dbg.perkIds=PERKS.map(p=>p.id);
window.__dbg.traits=Object.keys(TR);
window.__dbg.spawnGear=function(slot,tr,v){
 if(!G)return null;const p=G.p;if(tr&&!TR[tr])return null;
 for(const [dx,dy] of DIRS){const x=p.x+dx,y=p.y+dy;
  if(walkable(x,y)&&!enemyAt(x,y)&&!itemAt(x,y)&&G.map[ix(x,y)]===1){
   G.items.push({x,y,t:slot,v:v!=null?v:applyTrait(slot==='weapon'?4:3,tr||null),tr:tr||null});computeVis();render();return [x,y];}}
 return null;
};
