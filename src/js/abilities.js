// abilities.js - active abilities: dash, shield bash, vanish, arcane bolt, and their arming/cooldowns.

function dashTiles(){
 const p=G.p,out=[];
 for(const [dx,dy] of DIRS){for(let k=1;k<=BAL.ability.dashRange;k++){const x=p.x+dx*k,y=p.y+dy*k;
  if(!walkable(x,y)||G.map[ix(x,y)]===3||!G.seen[ix(x,y)]||enemyAt(x,y))break;out.push([x,y]);}}
 return out;
}
function boltOk(e){return !e.dead&&G.vis[ix(e.x,e.y)]&&Math.abs(e.x-G.p.x)+Math.abs(e.y-G.p.y)<=BAL.ability.boltRange;}
function useDash(tx,ty){
 if(!dashTiles().some(t=>t[0]===tx&&t[1]===ty)){msg('Dash: tap a highlighted tile (straight line, up to 3).');return;}
 const p=G.p;armed=null;walkTok++;G.cd.dash=BAL.ability.dashCd;p.x=tx;p.y=ty;msg('You dash!');
 if(pc('arcane')&&G.cd.bolt>0){G.cd.bolt=Math.max(0,G.cd.bolt-BAL.ability.phaseHunterCut);msg('Phase Hunter: Bolt recharges faster.');}
 pickup();
 if(G.map[ix(tx,ty)]===2)msg('Stairs! Tap yourself to descend.');
 endTurn();
}
function bashOk(e){return !e.dead&&G.vis[ix(e.x,e.y)]&&Math.abs(e.x-G.p.x)+Math.abs(e.y-G.p.y)===1;}
function useBash(tx,ty){
 const e=enemyAt(tx,ty);
 if(!e||!bashOk(e)){msg('Shield Bash: tap an adjacent enemy.');return;}
 armed=null;walkTok++;G.cd.bash=BAL.ability.bashCd;
 const dmg=playerDmg();hurtEnemy(e,dmg,'#ffb04a');
 msg('Shield Bash hits the '+nm(e)+' for '+dmg+'.');lifeSteal(dmg);
 if(!e.dead&&e.hp>0){e.stun=EN[e.t].boss?BAL.ability.bashStunBoss:BAL.ability.bashStun;e.wind=null;floatFx(e.x,e.y,'stunned','#ffe066');msg('The '+nm(e)+' is stunned.');
  if(e.hp>0)knock(e,e.x-G.p.x,e.y-G.p.y);}
 settle(e);endTurn();
}
function useVanish(){
 armed=null;walkTok++;G.cd.vanish=BAL.ability.vanishCd;G.vanish=BAL.ability.vanishTurns;
 for(const e of G.enemies)e.awake=false;
 floatFx(G.p.x,G.p.y,'vanish','#cfc');msg('You vanish. Enemies lose track of you.');endTurn();
}
function useBolt(tx,ty){
 const e=enemyAt(tx,ty);
 if(!e||!boltOk(e)){msg('Arcane Bolt: tap a visible enemy.');return;}
 const mg=G.p.cls==='mage';armed=null;walkTok++;G.cd.bolt=mg?BAL.ability.boltCdMage:BAL.ability.boltCd;
 const dmg=Math.round(playerDmg()*BAL.ability.boltMul)+BAL.ability.boltAdd;
 hurtEnemy(e,dmg,'#b48cff');msg('Arcane Bolt hits the '+nm(e)+' for '+dmg+'.');
 poison(e);settle(e);
 endTurn();
}
function toggleAbility(k){
 walkTok++;if(!G||G.over||modalOpen())return;
 if(armed===k){armed=null;msg('Cancelled.');render();return;}
 if(G.cd[k]>0){msg('Still recharging ('+G.cd[k]+').');return;}
 if(k==='vanish'){useVanish();return;}
 armed=k;msg(k==='dash'?'Dash armed: tap a highlighted tile.':k==='bash'?'Shield Bash armed: tap an adjacent enemy.':'Arcane Bolt armed: tap a visible enemy.');render();
}

