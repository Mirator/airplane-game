// combat.js - damage, kills, status effects (poison, stun), knockback, turn end processing.

function secondWind(){
 const p=G.p;
 if(p.hp<=0&&pc('second')&&!G.swUsed){G.swUsed=1;p.hp=1;msg('Second Wind! You cling to life at 1 HP.');return true;}
 if(p.hp<=0&&pc('phoenix')&&!G.phxUsed){G.phxUsed=1;p.hp=Math.max(1,Math.ceil(p.mhp*BAL.perk.phoenixFrac));floatFx(p.x,p.y,'REBORN','#ffb04a');msg('Phoenix Heart! You rise from the ashes at half HP.');return true;}
 return false;
}
function curseDrain(){
 const p=G.p;if(p.hp<=0)return;
 p.hp-=BAL.trait.cursedDrain;G.killer='a cursed blade';floatFx(p.x,p.y,'-'+BAL.trait.cursedDrain,'#c6f');msg('The cursed blade drinks '+BAL.trait.cursedDrain+' HP.');secondWind();
}
function killEnemy(e,src){
 if(e.dead)return;
 e.dead=true;G.enemies=G.enemies.filter(o=>o!==e);G.kills++;meta.kills++;if(e.elite)meta.elites++;metaDirty=true;checkAch();
 const d=EN[e.t];msg((src||'You')+' slew the '+nm(e)+'.');if(!rmo())puffs.push({x:e.x,y:e.y,t:performance.now(),s:Math.random()*6});
 gainXp(d.xp+G.floor);
 if(d.boss){G.won=true;return;}
 if(G.p.wt==='cursed')curseDrain();
 if(e.elite){dropAt(e.x,e.y,{t:'key',v:0});floatFx(e.x,e.y,'KEY','#ffd24a');msg('The elite drops a brass key!');}
 else if(Math.random()<BAL.drops.potionChance)G.items.push({x:e.x,y:e.y,t:'potion',v:0});
 else if(Math.random()<BAL.drops.goldChance)G.items.push({x:e.x,y:e.y,t:'gold',v:rnd(BAL.drops.goldMin,BAL.drops.goldMax)+G.floor});
 if(pc('midas'))dropAt(e.x,e.y,{t:'gold',v:rnd(BAL.drops.midasMin,BAL.drops.midasMax)+G.floor*BAL.drops.midasPerFloor});
 if(pc('scav')&&!itemAt(e.x,e.y)&&Math.random()<BAL.drops.scavChance*pc('scav'))G.items.push({x:e.x,y:e.y,t:'potion',v:0});
 if(pc('blood'))G.bl=1;
 if(pc('chain')&&!inChain)chainZap(e);
}
function hurtEnemy(e,dmg,col,crit){
 if(e.dead)return;
 e.hp-=dmg;e.awake=true;flashes[e.id]=performance.now();floatFx(e.x,e.y,'-'+dmg+(crit?'!':''),col||'#ffd24a',crit);
}
// resolve a hit: kill if dead, else maybe execute
function settle(e,src){
 if(e.dead)return;
 if(e.hp<=0){killEnemy(e,src);return;}
 if(!pc('exec')||EN[e.t].boss)return;
 if(e.hp/e.mhp<(pc('blood')?BAL.perk.execBlood:BAL.perk.execBase)){floatFx(e.x,e.y,'EXECUTE','#f55');msg('Executed the '+nm(e)+'!');killEnemy(e);}
}
function poison(e){
 const s=pc('venom');if(!s||e.dead||e.hp<=0)return;
 let d=BAL.perk.venomBase+s;if(EN[e.t].boss)d=Math.max(1,Math.floor(d/2));
 e.pois={t:BAL.perk.venomTurns,d:d};floatFx(e.x,e.y,'poison','#7be04b');
}
function tickPoison(){
 for(const e of G.enemies.slice()){
  if(e.dead||!e.pois)continue;
  const d=e.pois.d;e.pois.t--;if(e.pois.t<=0)delete e.pois;
  hurtEnemy(e,d,'#7be04b');settle(e,'Poison');
 }
}
function chainZap(from){
 inChain=true;
 try{
  let best=null,bd=99;
  for(const o of G.enemies){if(o.dead||o===from||!G.vis[ix(o.x,o.y)])continue;
   const dd=Math.abs(o.x-from.x)+Math.abs(o.y-from.y);if(dd<bd&&dd<=BAL.perk.chainRange){bd=dd;best=o;}}
  if(best){const dmg=BAL.perk.chainBase+G.floor*BAL.perk.chainPerFloor;hurtEnemy(best,dmg,'#9cf');
   msg('Chain Lightning arcs to the '+nm(best)+' for '+dmg+'.');
   if(pc('venom'))poison(best);
   settle(best,'Lightning');}
 }finally{inChain=false;}
}
function playerDmg(){
 const p=G.p;let d=Math.max(1,p.atk+p.wb+atkMod()+rnd(-BAL.combat.dmgVar,BAL.combat.dmgVar));
 if(pc('berserk'))d*=1+BAL.perk.berserkMax*(1-Math.max(0,p.hp)/p.mhp);
 return Math.max(1,Math.round(d));
}
function lifeSteal(dmg){
 const p=G.p,lr=lifeRate();if(lr<=0)return;
 let h=Math.max(1,Math.round(dmg*lr));
 if(pc('berserk')&&pc('vamp')&&p.hp<p.mhp*BAL.perk.bloodFrenzyHp)h*=BAL.perk.bloodFrenzyMul;
 p.hp=Math.min(p.mhp,p.hp+h);floatFx(p.x,p.y,'+'+h,'#6f6');
}
function playerAttack(e){
 const p=G.p;let dmg=playerDmg(),crit=Math.random()<critChance();
 if(crit)dmg*=BAL.combat.critMul;
 if(p.cls==='rogue'&&!e.awake){dmg*=BAL.combat.sneakMul;msg('Sneak attack!');}
 if(G.vanish>0){G.vanish=0;msg('You step out of the shadows.');}
 if(G.bl){dmg=Math.round(dmg*BAL.perk.bloodlustMul);G.bl=0;msg('Bloodlust! Your strike is empowered.');}
 hurtEnemy(e,dmg,crit?'#ff8a3a':'#ffd24a',crit);
 sfx(crit?'crit':'hit');if(crit||dmg>=Math.max(8,e.mhp*0.5))shake(crit?5:3);
 msg((crit?'Critical! ':'')+'You hit the '+nm(e)+' for '+dmg+'.');
 lifeSteal(dmg);
 poison(e);
 settle(e);
 if(pc('cleave')){
  const half=Math.max(1,Math.floor(dmg*BAL.perk.cleaveFrac));
  for(const o of G.enemies.slice()){
   if(o===e||o.dead||Math.max(Math.abs(o.x-p.x),Math.abs(o.y-p.y))>1)continue;
   hurtEnemy(o,half,'#ffb04a');msg('Cleave hits the '+nm(o)+' for '+half+'.');
   if(pc('venom'))poison(o);
   settle(o);
  }
 }
}
function hurtPlayer(e,dmg,melee,verb){
 const p=G.p;
 if(Math.random()<dodgeChance()){floatFx(p.x,p.y,'dodge','#9cf');msg('You dodge the '+nm(e)+'.');return false;}
 if(pc('stone')&&!G.ssUsed){G.ssUsed=1;floatFx(p.x,p.y,'blocked','#bbb');msg('Stone Skin negates the '+nm(e)+"'s hit.");return false;}
 dmg=Math.max(1,Math.round(dmg*BAL.combat.armorK/(BAL.combat.armorK+p.def+p.ab))+rnd(-BAL.combat.enemyDmgVar,BAL.combat.enemyDmgVar));
 if(dmg<1)dmg=1;
 p.hp-=dmg;G.killer=nm(e);flashUntil=performance.now()+250;floatFx(p.x,p.y,'-'+dmg,'#ff5a5a');
 msg('The '+nm(e)+' '+(verb||(melee?'hits':'blasts'))+' you for '+dmg+'.');playerHurtFx(dmg);
 secondWind();
 if(melee&&thornsDmg()>0&&!e.dead){hurtEnemy(e,thornsDmg(),'#8f8');settle(e,'Thorns');}
 if(melee&&!e.dead&&p.hp>0&&pc('riposte')&&Math.random()<BAL.perk.riposteChance*pc('riposte')){
  const d2=playerDmg();hurtEnemy(e,d2,'#fff');msg('Riposte! You counter for '+d2+'.');settle(e);}
 return true;
}
function kbDmg(){return BAL.combat.knockBase+Math.floor(G.floor/BAL.combat.knockFloorDiv);}
// push a unit one tile; never into walls/doors/units/out of bounds (those cause bump damage instead)
function knock(u,dx,dy){
 const p=G.p,isP=u===p;
 if(!isP&&EN[u.t].boss){msg('The '+nm(u)+' is too heavy to push.');return false;}
 const nx=u.x+dx,ny=u.y+dy;let bump=false,other=null,what='the wall';
 if(!inb(nx,ny)||G.map[ix(nx,ny)]===0||G.map[ix(nx,ny)]===3||G.map[ix(nx,ny)]===5||merchantAt(nx,ny))bump=true;
 else{other=(nx===p.x&&ny===p.y&&!isP)?p:enemyAt(nx,ny);if(other){bump=true;what=other===p?'you':'the '+nm(other);}}
 const hitU=(t,d)=>{
  if(t===p){p.hp-=d;G.killer='a wall slam';playerHurtFx(d);floatFx(p.x,p.y,'-'+d,'#ff5a5a');secondWind();}
  else{hurtEnemy(t,d,'#ffb04a');settle(t,'Impact');}
 };
 if(bump){
  const d=kbDmg();
  msg((isP?'You are':'The '+nm(u)+' is')+' slammed into '+what+' for '+d+'!');
  floatFx(u.x,u.y,'BUMP','#ffb04a');
  if(!isP)u.wind=null;
  hitU(u,d);
  if(other&&!other.dead)hitU(other,Math.max(1,Math.floor(d/2)));
  return false;
 }
 u.x=nx;u.y=ny;
 if(isP){pickup();}else{u.wind=null;}
 return true;
}
function endTurn(){
 const p=G.p;
 if(G.won){finish('win');return;}
 G.turn++;
 for(const k in G.cd)if(G.cd[k]>0)G.cd[k]--;
 if(p.hp<p.mhp){
  if(p.regen&&G.turn%BAL.player.regenEvery===0)p.hp=Math.min(p.mhp,p.hp+p.regen);
  if(G.turn%BAL.player.baseRegenEvery===0)p.hp=Math.min(p.mhp,p.hp+1);
 }
 if(G.ppois&&p.hp>0){const d=G.ppois.d;p.hp-=d;G.killer='dart poison';floatFx(p.x,p.y,'-'+d,'#7be04b');G.ppois.t--;if(G.ppois.t<=0){G.ppois=null;msg('The poison wears off.');}secondWind();}
 tickPoison();
 if(G.won){finish('win');return;}
 enemiesAct();
 if(p.at==='heavy'&&G.turn%BAL.trait.heavyEvery===0&&p.hp>0&&!G.won&&G.enemies.some(e=>e.awake)){msg('Your heavy armor slows you: enemies get a free turn.');enemiesAct(true);}
 if(G.vanish>0)G.vanish--;
 if(G.won){finish('win');return;}
 if(p.hp<=0){p.hp=0;msg('You have died...');finish('dead');return;}
 computeVis();save();render();
 afterModals();
}
