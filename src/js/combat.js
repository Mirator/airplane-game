// combat.js - damage, kills, status effects (poison, stun, freeze), shields, knockback, resource ticks and turn end processing.

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
 const d=EN[e.t];msg((src||'You')+' slew the '+nm(e)+'.');puffAdd(e.x,e.y);ghostAdd(e);
 gainXp(Math.round((d.xp+G.floor)*(modIs('horde')?BAL.mod.horde.xpMul:1)*(e.hunter?BAL.mod.hunted.xpMul:1)));
 if(d.boss){G.won=true;return;}
 if(modIs('horde')&&!G.enemies.length)earn('horde');
 if(traitOf('weapon')==='cursed')curseDrain();
 {const p=G.p,ch=eqKind('charm');
  if(ch==='fang'){const h=BAL.charm.fangHeal+Math.floor(G.floor/BAL.charm.fangFloorDiv);p.hp=Math.min(p.mhp,p.hp+h);floatFx(p.x,p.y,'+'+h,'#6f6');}
  if(ch==='soul'){if(p.cls==='warrior')gainRage(BAL.charm.soulRage,true);else if(p.cls==='mage')p.mana=Math.min(mmax(),p.mana+BAL.charm.soulMana);else for(const k in G.cd)if(G.cd[k]>0)G.cd[k]--;}
  if(p.cls==='mage'){let m=BAL.mana.perKill+(pc('well')?BAL.perk.wellKill:0);if(G.syn.ow)m*=2;p.mana=Math.min(mmax(),p.mana+m);}}
 if(e.hunter)huntReward(e);
 else if(e.elite){dropAt(e.x,e.y,{t:'key',v:0});callout(e.x,e.y,'KEY','#ffd24a');msg('The elite drops a brass key!');}
 else if(rf()<BAL.drops.potionChance*(G.hard?BAL.hard.dropPotionMul:1))G.items.push({x:e.x,y:e.y,t:'potion',v:0});
 else if(rf()<(modIs('horde')?BAL.mod.horde.goldDrop:BAL.drops.goldChance))G.items.push({x:e.x,y:e.y,t:'gold',v:rnd(BAL.drops.goldMin,BAL.drops.goldMax)+G.floor});
 if(pc('midas'))dropAt(e.x,e.y,{t:'gold',v:rnd(BAL.drops.midasMin,BAL.drops.midasMax)+G.floor*BAL.drops.midasPerFloor});
 if(pc('scav')&&!itemAt(e.x,e.y)&&rf()<BAL.drops.scavChance*pc('scav'))G.items.push({x:e.x,y:e.y,t:'potion',v:0});
 if(pc('blood'))G.bl=1;
 if(pc('chain')&&!inChain)chainZap(e);
}
// kind: 'melee' | 'ranged' | 'magic' (shields care), undefined = poison / traps / impact (never reduced)
function hurtEnemy(e,dmg,col,crit,kind){
 if(e.dead)return;
 if(kind&&EN[e.t].shield&&!(e.stun>0||e.frz>0)){
  let m=1;
  if(isFront(e))m=BAL.weapon.shieldFront;
  if(kind!=='melee')m=Math.min(m,BAL.weapon.shieldRanged);
  if(m<1){dmg=Math.max(1,Math.round(dmg*m));floatFx(e.x,e.y,'shield','#9ab');}
 }
 e.hp-=dmg;e.awake=true;flashes[e.id]=performance.now()+holdAt(e.x,e.y);floatFx(e.x,e.y,'-'+dmg+(crit?'!':''),col||'#ffd24a',crit);
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
  const d=e.pois.d,col=e.pois.burn?'#ff9a3a':'#7be04b';e.pois.t--;if(e.pois.t<=0)delete e.pois;
  hurtEnemy(e,d,col);settle(e,e.pois&&e.pois.burn?'Burning':'Poison');
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
function playerDmg(spell){
 const p=G.p;let d=Math.max(1,(spell?spellBase():meleeAtk())+rnd(-BAL.combat.dmgVar,BAL.combat.dmgVar));
 if(pc('berserk'))d*=1+BAL.perk.berserkMax*(1-Math.max(0,p.hp)/p.mhp);
 return Math.max(1,Math.round(d));
}
function lifeSteal(dmg){
 const p=G.p,lr=lifeRate();if(lr<=0)return;
 let h=Math.max(1,Math.round(dmg*lr));
 if(pc('berserk')&&pc('vamp')&&p.hp<p.mhp*BAL.perk.bloodFrenzyHp)h*=BAL.perk.bloodFrenzyMul;
 p.hp=Math.min(p.mhp,p.hp+h);floatFx(p.x,p.y,'+'+h,'#6f6');
}
function sneakMul(){const wk=wpK();let b=G.p.cls==='rogue'?BAL.combat.sneakMul:1;if(modIs('silent'))b=Math.max(b,BAL.mod.silent.sneakMul);return b+(wk&&wk.sneak||0);}
function playerAttack(e){
 const p=G.p,wk=wpK();lunge('p',e.x-p.x,e.y-p.y);let dmg=playerDmg(),crit=rf()<critChance();
 if(crit)dmg*=BAL.combat.critMul;
 const sn=sneakMul();
 if(sn>1&&!e.awake){dmg*=sn;msg('Sneak attack!');}
 if(G.vanish>0){G.vanish=0;msg('You step out of the shadows.');}
 if(G.bl){dmg=Math.round(dmg*BAL.perk.bloodlustMul);G.bl=0;msg('Bloodlust! Your strike is empowered.');}
 dmg=Math.max(1,Math.round(dmg));
 hurtEnemy(e,dmg,crit?'#ff8a3a':'#ffd24a',crit,'melee');
 sfx(crit?'crit':'hit');if(crit||dmg>=Math.max(8,e.mhp*0.5))shake(crit?5:3);
 msg((crit?'Critical! ':'')+'You hit the '+nm(e)+' for '+dmg+'.');
 lifeSteal(dmg);gainRage(BAL.rage.dealt);
 poison(e);
 settle(e);
 if(wk&&wk.sweep){
  const half=Math.max(1,Math.floor(dmg*wk.sweep));
  for(const o of G.enemies.slice()){
   if(o===e||o.dead||(cheb(o,p)>1&&cheb(o,e)>1))continue;
   hurtEnemy(o,half,'#ffb04a',false,'melee');msg('Your axe sweeps the '+nm(o)+' for '+half+'.');poison(o);settle(o);
  }
 }
}
function hurtPlayer(e,dmg,melee,verb){
 const p=G.p;
 if(e&&e.x!=null){e.face=[Math.sign(p.x-e.x),Math.sign(p.y-e.y)];lunge(e.id,p.x-e.x,p.y-e.y);}
 if(e&&e.blind>0&&rf()<BAL.ability.smoke.miss){floatFx(e.x,e.y,'miss','#ccc');msg('The blinded '+nm(e)+' swings wildly and misses.');return false;}
 if(rf()<dodgeChance()){floatFx(p.x,p.y,'dodge','#9cf');msg('You dodge the '+nm(e)+'.');return false;}
 if(eqKind('charm')==='ward'&&!G.ssUsed){G.ssUsed=1;floatFx(p.x,p.y,'blocked','#bbb');msg('Your Ward Sigil negates the '+nm(e)+"'s hit.");return false;}
 dmg=Math.max(1,Math.round(dmg*BAL.combat.armorK/(BAL.combat.armorK+defTotal()))+rnd(-BAL.combat.enemyDmgVar,BAL.combat.enemyDmgVar));
 if(dmg<1)dmg=1;
 const raw=dmg;let refl=0;
 if(G.brace){
  dmg=Math.max(1,Math.round(dmg*BAL.ability.brace.reduce));refl=melee?Math.round(raw*G.brace.reflect):0;
  floatFx(p.x,p.y,'braced','#9cf');if(--G.brace.hits<=0)G.brace=null;
 }
 p.hp-=dmg;G.killer=nm(e);floatFx(p.x,p.y,'-'+dmg,'#ff5a5a');
 msg('The '+nm(e)+' '+(verb||(melee?'hits':'blasts'))+' you for '+dmg+'.');playerHurtFx(dmg);
 gainRage(BAL.rage.taken);
 secondWind();
 if(refl>0&&!e.dead){hurtEnemy(e,refl,'#9cf');msg('Your brace reflects '+refl+' damage.');settle(e,'Reflection');}
 if(melee&&thornsDmg()>0&&!e.dead){hurtEnemy(e,thornsDmg(),'#8f8');settle(e,'Thorns');}
 if(melee&&!e.dead&&p.hp>0&&pc('riposte')&&rf()<BAL.perk.riposteChance*pc('riposte')){
  const d2=playerDmg();hurtEnemy(e,d2,'#fff',false,'melee');msg('Riposte! You counter for '+d2+'.');settle(e);}
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
 if(eqKind('charm')==='hourglass'&&G.turn%BAL.charm.hourglassEvery===0)for(const k in G.cd)if(G.cd[k]>0)G.cd[k]--;
 if(p.cls==='mage'){p.mf=(p.mf||0)+manaRegen();const w=Math.floor(p.mf);p.mf-=w;p.mana=Math.min(mmax(),p.mana+w);}
 if(p.cls==='warrior'&&(p.rage||0)>0&&!G.enemies.some(e=>e.awake&&G.vis[ix(e.x,e.y)]))p.rage=Math.max(0,p.rage-BAL.rage.decay);
 if(G.brace&&--G.brace.t<=0)G.brace=null;
 if(G.smoke){for(const c of G.smoke)c.t--;G.smoke=G.smoke.filter(c=>c.t>0);}
 if(p.hp<p.mhp&&!modIs('cursed')){
  if(p.regen&&G.turn%BAL.player.regenEvery===0)p.hp=Math.min(p.mhp,p.hp+p.regen);
  if(G.turn%BAL.player.baseRegenEvery===0)p.hp=Math.min(p.mhp,p.hp+1);
 }
 if(G.ppois&&p.hp>0){const d=G.ppois.d;p.hp-=d;G.killer='dart poison';floatFx(p.x,p.y,'-'+d,'#7be04b');G.ppois.t--;if(G.ppois.t<=0){G.ppois=null;msg('The poison wears off.');}secondWind();}
 tickPoison();
 if(G.won){finish('win');return;}
 crackTick();
 enemiesAct();
 if(G.wade){G.wade=0;if(p.hp>0&&!G.won&&G.enemies.some(e=>e.awake)){msg('You slog through the water: enemies get a free move.');enemiesAct(true);}}
 if(traitOf('armor')==='heavy'&&G.turn%BAL.trait.heavyEvery===0&&p.hp>0&&!G.won&&G.enemies.some(e=>e.awake)){msg('Your heavy armor slows you: enemies get a free turn.');enemiesAct(true);}
 if(G.vanish>0)G.vanish--;
 if(G.won){finish('win');return;}
 if(p.hp<=0){p.hp=0;msg('You have died...');finish('dead');return;}
 lowHpWatch();computeVis();save();render();
 afterModals();
}
