// items.js - gear names and traits, derived combat stats from traits, item drops, pickup, consumables.

function gearName(slot,v,tr){
 const base=slot==='weapon'?WNAMES[Math.min(5,Math.floor(v/2))]:ANAMES[Math.min(5,Math.floor(v))];
 if(tr&&TR[tr]){if(tr==='vamp')return 'Vampiric Dagger';return TR[tr].n+' '+base;}
 return base;
}
function rollTrait(slot,f){
 if(Math.random()>=Math.min(BAL.trait.chanceCap,BAL.trait.chanceBase+BAL.trait.chancePerFloor*f))return null;
 const pool=Object.keys(TR).filter(k=>TR[k].slot===slot&&TR[k].minF<=f);
 return pool.length?pick(pool):null;
}
function applyTrait(v,tr){return tr&&TR[tr]?Math.max(1,v+TR[tr].dv):v;}
function atkMod(){const p=G.p;return p.at==='spiked'?BAL.trait.spikedAtk:0;}
function critChance(){const p=G.p;return Math.max(0,Math.min(1,p.crit+(p.wt==='keen'?BAL.trait.keenCrit:0)+(p.wt==='brutal'?BAL.trait.brutalCrit:0)));}
function lifeRate(){const p=G.p;return Math.max(0,p.life+(p.wt==='vamp'?BAL.trait.vampLife:0));}
function dodgeChance(){const p=G.p;return Math.min(BAL.combat.dodgeCap,p.dodge+(p.at==='light'?BAL.trait.lightDodge:0));}
function thornsDmg(){const p=G.p;return p.thorns+(p.at==='spiked'?BAL.trait.spikedThorns:0);}
function traitLine(tr){return tr&&TR[tr]?TR[tr].n+': '+TR[tr].d:'No trait.';}
function forcedGear(f,slot){
 const pool=Object.keys(TR).filter(k=>TR[k].slot===slot&&TR[k].minF<=Math.max(f,BAL.forcedGear.minTraitFloor)),tr=pick(pool);
 return {t:slot,tr:tr,v:applyTrait(slot==='weapon'?rnd(BAL.forcedGear.weaponMin,BAL.forcedGear.weaponMax)+Math.floor(f*BAL.forcedGear.weaponPerFloor):Math.floor((f+rnd(BAL.forcedGear.armorRandMin,BAL.forcedGear.armorRandMax))/BAL.forcedGear.armorDiv)+BAL.forcedGear.armorBase,tr)};
}
function dropAt(x,y,it){
 let t=[x,y];
 if(itemAt(x,y)){for(const [dx,dy] of DIRS){const a=x+dx,b=y+dy;if(inb(a,b)&&G.map[ix(a,b)]===1&&!itemAt(a,b)&&!trapAt(a,b)&&!merchantAt(a,b)){t=[a,b];break;}}}
 it.x=t[0];it.y=t[1];G.items.push(it);
}
function pickup(){
 const p=G.p;stepEffects();
 const here=G.items.filter(i=>i.x===p.x&&i.y===p.y);
 for(const it of here)pickOne(it);
}
function pickOne(it){
 const p=G.p;
 let take=true;
 if(it.t==='gold'){const g=Math.round(it.v*p.goldMul);p.gold+=g;msg('You pick up '+g+' gold.');}
 else if(it.t==='potion'){
  if(G.inv.pot<p.potCap){G.inv.pot++;msg('You pick up a health potion.');}
  else{msg('Potion belt is full.');take=false;}
 }
 else if(it.t==='weapon'||it.t==='armor'){
  const w=it.t==='weapon',cv=w?p.wb:p.ab,ct=w?p.wt:p.at,nm=gearName(it.t,it.v,it.tr);
  if(!it.tr&&!ct){
   if(it.v>cv){if(w){p.wb=it.v;p.wn=nm;}else{p.ab=it.v;p.an=nm;}msg('Equipped '+nm+' (+'+it.v+(w?' attack).':' defense).'));}
   else{const g=Math.round((BAL.item.weakSaleBase+G.floor)*p.goldMul);p.gold+=g;msg('Weak '+nm+' sold for '+g+' gold.');}
  }else{gearQ=it;take=false;}
 }
 else if(it.t==='fire'){G.inv.fire++;msg('Found a Fireball scroll.');}
 else if(it.t==='tele'){G.inv.tele++;msg('Found a Teleport scroll.');}
 else if(it.t==='key'){G.keys=(G.keys||0)+1;msg('You pick up a brass key!');}
 if(take){G.items=G.items.filter(o=>o!==it);sfx('pickup');}
 G.stopWalk=true;
}
function drink(){
 const p=G.p;
 if(G.inv.pot<=0){msg('No potions. Find them in the dungeon.');return;}
 if(p.hp>=p.mhp){msg('Already at full health.');return;}
 G.ppois=null;G.inv.pot--;let h=Math.max(BAL.potion.minHeal,Math.round(p.mhp*BAL.potion.healFrac*(1+BAL.potion.sageBonus*pc('sage'))));if(p.at==='leaden')h=Math.max(1,Math.round(h*BAL.potion.leadenMul));p.hp=Math.min(p.mhp,p.hp+h);
 floatFx(p.x,p.y,'+'+h,'#6f6');msg('You drink a potion (+'+h+' HP).');endTurn();
}
function fireball(){
 if(G.inv.fire<=0){msg('No fireball scrolls. Find them in the dungeon.');return;}
 const t=G.enemies.filter(e=>G.vis[ix(e.x,e.y)]);
 if(!t.length){msg('No visible enemies - scroll kept.');return;}
 G.inv.fire--;const dmg=Math.round((BAL.fireball.base+G.floor*BAL.fireball.perFloor)*G.p.fireMul);
 msg('Fireball! '+dmg+' damage to all in sight.');
 for(const e of t){hurtEnemy(e,dmg,'#ff7a2a');settle(e);}
 endTurn();
}
function teleport(){
 if(G.inv.tele<=0){msg('No teleport scrolls. Find them in the dungeon.');return;}
 const p=G.p,c=[],reach=bfsDist(p.x,p.y);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)
  if(G.map[ix(x,y)]===1&&reach[ix(x,y)]<9999&&!enemyAt(x,y)&&!itemAt(x,y)&&!trapAt(x,y)&&!merchantAt(x,y)&&Math.abs(x-p.x)+Math.abs(y-p.y)>=BAL.teleport.minDist)c.push([x,y]);
 if(!c.length){msg('The scroll fizzles.');return;}
 G.inv.tele--;const t=pick(c);p.x=t[0];p.y=t[1];msg('You teleport away!');walkTok++;endTurn();
}

