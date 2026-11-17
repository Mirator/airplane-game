// items.js - gear (weapon / armor / off-hand / charm): names, derived stats, generation, comparison, drops, pickup, consumables.

const SLOTS=['weapon','armor','off','charm'];
const SLOT_LABEL={weapon:'Weapon',armor:'Armor',off:'Off-hand',charm:'Charm'};
function eqi(slot){return G.p.eq[slot]||null;}
function eqKind(slot){const i=eqi(slot);return i?i.k:null;}
function traitOf(slot){const i=eqi(slot);return i&&i.tr?i.tr:null;}
function kindTable(slot){return slot==='weapon'?WP:slot==='armor'?ARM:slot==='off'?OFF:CH;}
function itemIcon(it){const t=it&&kindTable(it.t)[it.k];return t?t.e:'❔';}
function gearName(it){
 if(!it)return 'Nothing';
 const kt=kindTable(it.t)[it.k];if(!kt)return 'Strange item';
 let base=kt.n;
 if(it.t==='weapon')base=TIERS[Math.min(5,Math.floor(it.v/BAL.gear.tierDiv))]+' '+base;
 else if(it.t==='armor')base=TIERS[Math.min(5,it.v)]+' '+base;
 return it.tr&&TR[it.tr]?TR[it.tr].n+' '+base:base;
}
function itemRule(it){
 if(!it)return '';
 return it.t==='weapon'?wpRule(it.k):it.t==='armor'?armRule(it.k):it.t==='off'?offRule(it.k):charmRule(it.k);
}
function armorDef(it){if(!it)return 0;const a=ARM[it.k];if(!a||a.noDef)return 0;return Math.max(0,it.v+(a.def||0));}
function wpK(){const w=eqi('weapon');return w?WP[w.k]:null;}
function armK(){const a=eqi('armor');return a?ARM[a.k]:null;}
function wv(){const w=eqi('weapon');return w?w.v:0;}
function atkMod(){return traitOf('armor')==='spiked'?BAL.trait.spikedAtk:0;}
function meleeAtk(){const k=wpK();return Math.max(1,G.p.atk+wv()+(k?k.atk:0)+atkMod());}
function spellBase(){return Math.max(1,G.p.atk+wv()+atkMod());}   // spells ignore the weapon's melee offset
function defTotal(){return G.p.def+armorDef(eqi('armor'));}
function critChance(){const p=G.p,k=wpK(),t=traitOf('weapon');return Math.max(0,Math.min(1,p.crit+(k&&k.crit||0)+(t==='keen'?BAL.trait.keenCrit:0)+(t==='brutal'?BAL.trait.brutalCrit:0)));}
function lifeRate(){return Math.max(0,G.p.life+(traitOf('weapon')==='vamp'?BAL.trait.vampLife:0));}
function dodgeChance(){const k=armK();return Math.min(BAL.combat.dodgeCap,G.p.dodge+(k&&k.dodge||0));}
function thornsDmg(){return G.p.thorns+(traitOf('armor')==='spiked'?BAL.trait.spikedThorns:0);}
function spellMul(){const k=wpK(),a=armK();return 1+(k&&k.spell||0)+(a&&a.spell||0)+pc('arcana')*BAL.perk.arcanaSpell;}
function mmax(){
 const p=G.p;if(!(p.mbase>0))return 0;
 const k=wpK(),a=armK(),ar=eqi('armor');let m=p.mbase+(k&&k.mana||0);
 if(a){m+=(a.mana||0);if(a.manaBase)m+=a.manaBase+a.manaPerV*ar.v;}
 return Math.max(1,m);
}
function manaRegen(){const a=armK();return BAL.mana.regen*(a&&a.manaRegenMul||1);}
function maxKnives(){return BAL.ability.knife.max+(eqKind('off')==='quiver'?BAL.offhand.quiverKnives:0)+(pc('bando')?BAL.perk.bandoMax:0);}
// stat vector used by the equip comparison: what changes if `it` replaces the current item in its slot
function statVec(){return {attack:meleeAtk(),defense:defTotal(),crit:Math.round(critChance()*100),dodge:Math.round(dodgeChance()*100),spell:Math.round((spellMul()-1)*100),mana:mmax()};}
function gearDelta(it){
 const p=G.p,old=p.eq[it.t],a=statVec();p.eq[it.t]={t:it.t,k:it.k,v:it.v,tr:it.tr||null};const b=statVec();p.eq[it.t]=old;
 const o=[];for(const k in a){const d=b[k]-a[k];if(d)o.push(k+' '+sgn(d)+((k==='crit'||k==='dodge'||k==='spell')?'%':''));}
 return o;
}
function itemDesc(it){
 let t=it.t==='weapon'?'+'+it.v+' attack. ':it.t==='armor'?'Defense '+armorDef(it)+'. ':'';
 t+=itemRule(it);if(it.tr)t+=' '+traitLine(it.tr);return t;
}
function traitLine(tr){return tr&&TR[tr]?TR[tr].n+': '+TR[tr].d:'';}
function applyTrait(v,tr){return tr&&TR[tr]?Math.max(1,v+TR[tr].dv):v;}
function rollTrait(slot,f){
 if(Math.random()>=Math.min(BAL.trait.chanceCap,BAL.trait.chanceBase+BAL.trait.chancePerFloor*f))return null;
 const pool=Object.keys(TR).filter(k=>TR[k].slot===slot&&TR[k].minF<=f);
 return pool.length?pick(pool):null;
}
function pickW(tbl){
 const ks=Object.keys(tbl);let tot=0;for(const k of ks)tot+=tbl[k].w||1;
 let r=Math.random()*tot;for(const k of ks){r-=tbl[k].w||1;if(r<0)return k;}return ks[0];
}
function classOffs(cls){return Object.keys(OFF).filter(k=>OFF[k].cls===cls);}
// a fresh piece of gear for floor f. forced = treasure room / merchant: weapon and armor always carry a trait.
function newGear(slot,f,forced){
 if(slot==='off')return {t:'off',k:pick(classOffs(G.p.cls)),v:0,tr:null};
 if(slot==='charm')return {t:'charm',k:pick(Object.keys(CH)),v:0,tr:null};
 const fg=BAL.forcedGear,sp=BAL.spawn;
 let tr=null;
 if(forced){const pool=Object.keys(TR).filter(k=>TR[k].slot===slot&&TR[k].minF<=Math.max(f,fg.minTraitFloor));tr=pick(pool);}
 else tr=rollTrait(slot,f);
 if(slot==='weapon'){
  const raw=forced?rnd(fg.weaponMin,fg.weaponMax)+Math.floor(f*fg.weaponPerFloor):rnd(sp.weaponMin,sp.weaponMax)+Math.floor(f*sp.weaponPerFloor);
  return {t:'weapon',k:pickW(WP),v:applyTrait(raw,tr),tr:tr};
 }
 const raw=forced?Math.floor((f+rnd(fg.armorRandMin,fg.armorRandMax))/fg.armorDiv)+fg.armorBase:Math.floor((f+rnd(0,sp.armorRand))/sp.armorDiv)+sp.armorBase;
 return {t:'armor',k:pickW(ARM),v:applyTrait(raw,tr),tr:tr};
}
function forcedGear(f,slot){return newGear(slot,f,true);}
function dropAt(x,y,it){
 let t=[x,y];
 if(itemAt(x,y)){for(const [dx,dy] of DIRS){const a=x+dx,b=y+dy;if(inb(a,b)&&G.map[ix(a,b)]===1&&!itemAt(a,b)&&!trapAt(a,b)&&!merchantAt(a,b)){t=[a,b];break;}}}
 it.x=t[0];it.y=t[1];G.items.push(it);
}
function clampRes(){const p=G.p;p.mana=Math.min(p.mana||0,mmax());G.knives=Math.min(G.knives||0,maxKnives());}
// put `it` on the player and return what it replaced
function equipItem(it){
 const p=G.p,old=p.eq[it.t];p.eq[it.t]={t:it.t,k:it.k,v:it.v,tr:it.tr||null};clampRes();return old;
}
function worthKeeping(old){return !!old&&(old.v>0||!!old.tr||old.t==='off'||old.t==='charm');}
function pickup(){
 const p=G.p;stepEffects();
 const here=G.items.filter(i=>i.x===p.x&&i.y===p.y);
 for(const it of here)pickOne(it);
}
function sellGear(it,why){const g=Math.round((BAL.item.weakSaleBase+G.floor)*G.p.goldMul);G.p.gold+=g;msg(why+' '+gearName(it)+' sold for '+g+' gold.');}
function pickOne(it){
 const p=G.p;
 let take=true;
 if(it.t==='gold'){const g=Math.round(it.v*p.goldMul);p.gold+=g;msg('You pick up '+g+' gold.');}
 else if(it.t==='potion'){
  if(G.inv.pot<p.potCap){G.inv.pot++;msg('You pick up a health potion.');}
  else{msg('Potion belt is full.');take=false;}
 }
 else if(it.t==='knife'){
  if(G.knives<maxKnives()){G.knives++;msg('You pick up a throwing knife.');}
  else take=false;
 }
 else if(SLOTS.indexOf(it.t)>=0){
  const cur=p.eq[it.t];
  if(cur&&cur.k===it.k&&!it.tr&&!cur.tr){
   if(it.t==='off'||it.t==='charm')sellGear(it,'You already own this:');
   else if(it.v>cur.v){equipItem(it);msg('Equipped '+gearName(it)+'.');}
   else sellGear(it,'Weak');
  }else{gearQ=it;take=false;}
 }
 else if(it.t==='fire'){G.inv.fire++;msg('Found a flame scroll.');}
 else if(it.t==='tele'){G.inv.tele++;msg('Found a Teleport scroll.');}
 else if(it.t==='key'){G.keys=(G.keys||0)+1;msg('You pick up a brass key!');}
 if(take){G.items=G.items.filter(o=>o!==it);sfx('pickup');}
 G.stopWalk=true;
}
function drink(){
 const p=G.p;
 if(G.inv.pot<=0){msg('No potions. Find them in the dungeon.');return;}
 if(p.hp>=p.mhp){msg('Already at full health.');return;}
 G.ppois=null;G.inv.pot--;let h=Math.max(BAL.potion.minHeal,Math.round(p.mhp*BAL.potion.healFrac*(1+BAL.potion.sageBonus*pc('sage'))));if(traitOf('armor')==='leaden')h=Math.max(1,Math.round(h*BAL.potion.leadenMul));p.hp=Math.min(p.mhp,p.hp+h);
 floatFx(p.x,p.y,'+'+h,'#6f6');msg('You drink a potion (+'+h+' HP).');
 if(eqKind('charm')==='flask'&&!G.flask){G.flask=1;msg('The flask refills itself: no turn used.');save();render();return;}
 endTurn();
}
function fireball(){
 if(G.inv.fire<=0){msg('No flame scrolls. Find them in the dungeon.');return;}
 const t=G.enemies.filter(e=>G.vis[ix(e.x,e.y)]);
 if(!t.length){msg('No visible enemies - scroll kept.');return;}
 G.inv.fire--;const dmg=Math.round((BAL.fireball.base+G.floor*BAL.fireball.perFloor)*G.p.fireMul);
 msg('Flames! '+dmg+' damage to all in sight.');
 for(const e of t){hurtEnemy(e,dmg,'#ff7a2a',false,'magic');settle(e);}
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
