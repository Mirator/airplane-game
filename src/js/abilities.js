// abilities.js - the 12 class abilities (4 per class): costs, cooldowns, target rules, effects, arming; plus reach attacks and smoke.

function kit(){return CLS[G.p.cls].kit;}
function cheb(a,b){return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));}
function manh(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
function cdFor(k){
 let c=BAL.ability[k].cd||0;if(!c)return 0;
 if(k==='blink'&&pc('phase'))return 0;
 if(pc('tempo'))c-=BAL.perk.tempoCut;
 if(k==='backstab'&&pc('assassin'))c-=BAL.perk.assassinCd;
 if(k==='vanish'&&pc('shadow'))c-=BAL.perk.shadowCd;
 return Math.max(1,c);
}
function costOf(k){
 const a=BAL.ability[k];let rage=a.rage||0,mana=a.mana||0;
 if(k==='charge'&&pc('stampede'))rage=Math.max(0,rage-BAL.perk.stampedeCost);
 if(k==='blink'&&pc('phase'))mana=Math.max(0,mana-BAL.perk.phaseCost);
 return {rage:rage,mana:mana};
}
function costLabel(k){const c=costOf(k);return c.rage?c.rage+' rage':c.mana?c.mana+' mana':k==='knife'?'1 knife':cdFor(k)?'ready':'free';}
function inSmoke(x,y){const k=ix(x,y);if(G.smoke)for(const c of G.smoke)if(c.cells.indexOf(k)>=0)return true;return false;}
function isFront(e){const p=G.p;if(!e.face)return true;return e.face[0]*(p.x-e.x)+e.face[1]*(p.y-e.y)>0;}
function isBehind(e){const p=G.p;if(!e.face)return false;return e.face[0]*(p.x-e.x)+e.face[1]*(p.y-e.y)<0;}
function gainRage(n,raw){
 const p=G.p;if(p.cls!=='warrior'||n<=0)return;
 if(!raw){n*=(armK()&&armK().rageMul||1)*(1+pc('fury')*BAL.perk.furyMul)*((G.syn&&G.syn.fb&&p.hp<p.mhp*0.5)?BAL.perk.bloodRageMul:1);}
 p.rage=Math.min(BAL.rage.max,(p.rage||0)+Math.max(1,Math.round(n)));
}
function advEnemies(vis){return G.enemies.filter(e=>!e.dead&&manh(e,G.p)===1&&(!vis||G.vis[ix(e.x,e.y)]));}
function chebEnemies(){return G.enemies.filter(e=>!e.dead&&cheb(e,G.p)===1&&G.vis[ix(e.x,e.y)]);}
function enemyShots(range){return G.enemies.filter(e=>!e.dead&&G.vis[ix(e.x,e.y)]&&manh(e,G.p)<=range&&los(G.p.x,G.p.y,e.x,e.y,true));}
function chargeLines(){
 const p=G.p,a=BAL.ability.charge,out=[];
 for(const [dx,dy] of DIRS){
  for(let k=1;k<=a.maxDist+(eqKind('off')==='gauntlet'?BAL.offhand.gauntletRange:0);k++){
   const x=p.x+dx*k,y=p.y+dy*k;
   if(!inb(x,y)||!walkable(x,y)||G.map[ix(x,y)]===3)break;
   const e=enemyAt(x,y);
   if(e){if(k>=a.minDist&&G.vis[ix(x,y)])out.push({e:e,lx:p.x+dx*(k-1),ly:p.y+dy*(k-1),dx:dx,dy:dy});break;}
  }
 }
 return out;
}
function blinkTiles(){
 const p=G.p,R=BAL.ability.blink.range,out=[],reach=bfsDist(p.x,p.y);   // only tiles you could also walk to: cave walls can leave sealed floor pockets that are visible but unreachable
 for(let y=p.y-R;y<=p.y+R;y++)for(let x=p.x-R;x<=p.x+R;x++){
  if(!inb(x,y)||Math.abs(x-p.x)+Math.abs(y-p.y)>R||(x===p.x&&y===p.y)||reach[ix(x,y)]>=9999)continue;
  const t=G.map[ix(x,y)];
  if(!G.vis[ix(x,y)]||(t!==1&&t!==2&&t!==4)||enemyAt(x,y)||merchantAt(x,y)||!los(p.x,p.y,x,y))continue;
  out.push([x,y]);
 }
 return out;
}
function groundTiles(range){
 const p=G.p,out=[];
 for(let y=p.y-range;y<=p.y+range;y++)for(let x=p.x-range;x<=p.x+range;x++){
  if(!inb(x,y)||Math.abs(x-p.x)+Math.abs(y-p.y)>range||!G.vis[ix(x,y)])continue;
  const t=G.map[ix(x,y)];if(t===0||t===5||merchantAt(x,y))continue;
  if(!los(p.x,p.y,x,y))continue;
  out.push([x,y]);
 }
 return out;
}
// valid target tiles for a targeted ability (also drives the highlight)
function targetTiles(k){
 if(!G)return [];
 switch(k){
  case 'bash':case 'backstab':return advEnemies(true).map(e=>[e.x,e.y]);
  case 'charge':return chargeLines().map(c=>[c.e.x,c.e.y]);
  case 'bolt':return enemyShots(BAL.ability.bolt.range).map(e=>[e.x,e.y]);
  case 'knife':return enemyShots(BAL.ability.knife.range).map(e=>[e.x,e.y]);
  case 'blink':return blinkTiles();
  case 'fire':return groundTiles(BAL.ability.fire.range);
  case 'smoke':return groundTiles(BAL.ability.smoke.range);
 // self abilities (armed first, used by a second tap): the area they act on, as tiles; Brace / Vanish act on you alone
 case 'cleave':case 'nova':return DIRS8.map(d=>[G.p.x+d[0],G.p.y+d[1]]).filter(t=>inb(t[0],t[1])&&G.map[ix(t[0],t[1])]!==0);
 case 'brace':case 'vanish':return [[G.p.x,G.p.y]];
 }
 return [];
}
// reason an ability cannot be used right now ('' = usable)
function whyNot(k){
 const A=ABIL[k],c=costOf(k),p=G.p;
 if(G.cd[k]>0)return A.n+': '+G.cd[k]+' turn'+(G.cd[k]>1?'s':'')+' to recharge.';
 if(c.rage&&(p.rage||0)<c.rage)return A.n+' needs '+c.rage+' rage (have '+Math.floor(p.rage||0)+').';
 if(c.mana&&(p.mana||0)<c.mana)return A.n+' needs '+c.mana+' mana (have '+Math.floor(p.mana||0)+').';
 if(k==='knife'&&(G.knives||0)<1)return 'No knives. Walk over one to pick it up.';
 if((k==='cleave'||k==='nova')&&!chebEnemies().length)return A.n+': no enemy next to you.';
 if(A.tg!=='self'&&!targetTiles(k).length){
  return k==='charge'?'Charge: need a foe in line, '+BAL.ability.charge.minDist+'-'+BAL.ability.charge.maxDist+' tiles.':
   (k==='bash'||k==='backstab')?(chebEnemies().length?A.n+': that foe is diagonal. Straight lines only.':A.n+': no enemy next to you.'):A.n+': no target.';
 }
 return '';
}
function spend(k){
 const c=costOf(k),p=G.p;
 if(c.rage)p.rage=Math.max(0,(p.rage||0)-c.rage);
 if(c.mana)p.mana=Math.max(0,(p.mana||0)-c.mana);
 if(k==='knife')G.knives--;
 const cd=cdFor(k);if(cd)G.cd[k]=cd;
}
function breakVanish(){if(G.vanish>0){G.vanish=0;msg('You step out of the shadows.');}}
function stunEnemy(e,t,tb){
 if(e.dead||e.hp<=0)return;
 e.stun=Math.max(e.stun||0,EN[e.t].boss?tb:t);e.wind=null;floatFx(e.x,e.y,'stunned','#ffe066');
}
function lineDir(e){return [Math.sign(e.x-G.p.x),Math.sign(e.y-G.p.y)];}
// ---- the abilities. Each spends its cost, acts, then ends the turn. ----
const DO={
 bash:function(tx,ty){
  const e=enemyAt(tx,ty),a=BAL.ability.bash,p=G.p,[dx,dy]=lineDir(e);
  const victims=[e];
  if(eqKind('off')==='tower'){for(let k=2;k<=BAL.offhand.towerLine;k++){const x=p.x+dx*k,y=p.y+dy*k;if(!inb(x,y)||G.map[ix(x,y)]===0||G.map[ix(x,y)]===3||G.map[ix(x,y)]===5)break;const o=enemyAt(x,y);if(o)victims.push(o);}}
  spend('bash');breakVanish();
  for(const v of victims){vfxAdd('bash',v.x,v.y,p.x,p.y);
   const dmg=Math.max(1,Math.round(playerDmg()*a.mul));
   hurtEnemy(v,dmg,'#ffb04a',false,'melee');msg('Bash hits the '+nm(v)+' for '+dmg+'.');lifeSteal(dmg);gainRage(BAL.rage.dealt);
   if(!v.dead&&v.hp>0){stunEnemy(v,a.stun,a.stunBoss);msg('The '+nm(v)+' is stunned.');if(v===e&&v.hp>0)knock(v,dx,dy);}
   settle(v);
  }
  endTurn();
 },
 cleave:function(){
  const a=BAL.ability.cleave,tg=chebEnemies();spend('cleave');breakVanish();
  msg('Cleave!');vfxAdd('cleave',G.p.x,G.p.y);
  const strikes=eqKind('off')==='warbanner'?[1,BAL.offhand.bannerFrac]:[1];
  for(const e of tg){
   for(const f of strikes){
    if(e.dead||e.hp<=0)break;
    const dmg=Math.max(1,Math.round(playerDmg()*a.mul*f));
    hurtEnemy(e,dmg,'#ffb04a',false,'melee');lifeSteal(dmg);poison(e);
    gainRage(BAL.rage.dealt/2);if(eqKind('off')==='totem')gainRage(BAL.offhand.totemRage,true);
    settle(e);
   }
   if(pc('warcry')&&!e.dead&&e.hp>0)stunEnemy(e,BAL.perk.warcryStun,BAL.perk.warcryStun);
  }
  endTurn();
 },
 charge:function(tx,ty){
  const c=chargeLines().find(l=>l.e.x===tx&&l.e.y===ty),a=BAL.ability.charge,p=G.p;
  spend('charge');breakVanish();walkTok++;
  vfxAdd('charge',p.x,p.y,c.e.x,c.e.y);p.x=c.lx;p.y=c.ly;msg('You charge!');
  const e=c.e,dmg=Math.max(1,Math.round(playerDmg()*a.mul));
  hurtEnemy(e,dmg,'#ffb04a',false,'melee');msg('Charge hits the '+nm(e)+' for '+dmg+'.');lifeSteal(dmg);gainRage(BAL.rage.dealt);
  if(!e.dead&&e.hp>0)stunEnemy(e,a.stun,a.stunBoss);
  if(eqKind('off')==='gauntlet'&&!e.dead&&e.hp>0)knock(e,c.dx,c.dy);
  if(pc('stampede'))for(const o of G.enemies)if(o!==e&&!o.dead&&cheb(o,p)<=1)stunEnemy(o,a.stun,a.stunBoss);
  settle(e);
  pickup();endTurn();
 },
 brace:function(){
  const a=BAL.ability.brace,O=BAL.offhand;
  const bulwark=eqKind('off')==='bulwark',retrib=pc('retrib');
  spend('brace');
  G.brace={hits:a.hits+(bulwark?O.bulwarkHits:0)+(retrib?BAL.perk.retribHits:0),t:a.turns,reflect:Math.max(a.reflect,bulwark?O.bulwarkReflect:0,retrib?BAL.perk.retribReflect:0)};
  vfxAdd('brace',G.p.x,G.p.y);floatFx(G.p.x,G.p.y,'BRACE','#9cf');msg('Braced: next '+G.brace.hits+' hits halved.');
  endTurn();
 },
 bolt:function(tx,ty){
  const e=enemyAt(tx,ty),a=BAL.ability.bolt,p=G.p;spend('bolt');breakVanish();
  const hit=[e];
  if(eqKind('off')==='lens'){
   const dx=e.x-p.x,dy=e.y-p.y,n=Math.max(Math.abs(dx),Math.abs(dy));
   for(let s=n+1;s<=n+BAL.ability.bolt.range&&hit.length<1+BAL.offhand.lensPierce;s++){
    const x=Math.round(p.x+dx*s/n),y=Math.round(p.y+dy*s/n);
    if(!inb(x,y)||G.map[ix(x,y)]===0||G.map[ix(x,y)]===3||G.map[ix(x,y)]===5)break;
    const o=enemyAt(x,y);if(o&&hit.indexOf(o)<0)hit.push(o);
   }
  }
  for(const v of hit){vfxAdd('bolt',p.x,p.y,v.x,v.y);
   const dmg=Math.max(1,Math.round((playerDmg(true)*a.mul+a.add)*spellMul()*(eqKind('off')==='focus'&&(v.stun>0||v.frz>0)?BAL.offhand.focusMul:1)));
   hurtEnemy(v,dmg,'#b48cff',false,'ranged');msg('Bolt hits the '+nm(v)+' for '+dmg+'.');
   poison(v);settle(v);
  }
  endTurn();
 },
 nova:function(){
  const a=BAL.ability.nova,tg=chebEnemies();spend('nova');breakVanish();
  vfxAdd('nova',G.p.x,G.p.y);floatFx(G.p.x,G.p.y,'NOVA','#9fe8ff');msg('Nova!');
  const burn=BAL.offhand.tomeBurnBase+Math.floor(G.floor/BAL.offhand.tomeBurnFloorDiv);
  for(const e of tg){
   const dmg=Math.max(1,Math.round(playerDmg(true)*a.mul*spellMul()));
   hurtEnemy(e,dmg,'#9fe8ff',false,'magic');
   if(!e.dead&&e.hp>0){
    e.frz=Math.max(e.frz||0,EN[e.t].boss?a.freezeBoss:a.freeze+(pc('deepfreeze')?BAL.perk.freezeExtra:0));e.wind=null;floatFx(e.x,e.y,'frozen','#9fe8ff');
    if(eqKind('off')==='tome')e.pois={t:BAL.offhand.tomeBurnTurns,d:burn,burn:1};
   }
   settle(e);
  }
  endTurn();
 },
 blink:function(tx,ty){
  const p=G.p;spend('blink');walkTok++;
  if(eqKind('off')==='shard'){
   const dmg=Math.max(1,Math.round((BAL.ability.fire.base+BAL.ability.fire.perFloor*G.floor)*p.fireMul*spellMul()*BAL.offhand.shardMul));
   for(const o of G.enemies.slice())if(!o.dead&&cheb(o,p)<=1){hurtEnemy(o,dmg,'#ff7a2a',false,'magic');settle(o,'Shards');}
  }
  vfxAdd('blink',p.x,p.y,tx,ty);floatFx(p.x,p.y,'blink','#d9c6ff');p.x=tx;p.y=ty;msg('You blink away.');
  pickup();if(G.map[ix(tx,ty)]===2)msg('On the stairs.');
  endTurn();
 },
 fire:function(tx,ty){
  const a=BAL.ability.fire,O=BAL.offhand,prism=eqKind('off')==='prism';
  spend('fire');breakVanish();
  const R=a.radius+(prism?O.prismRadius:0);
  const dmg=Math.max(1,Math.round((a.base+a.perFloor*G.floor)*G.p.fireMul*spellMul()*(prism?O.prismMul:1)));
  vfxAdd('fire',G.p.x,G.p.y,tx,ty,R);floatFx(tx,ty,'BOOM','#ff9a3a',true);msg('Fireball: '+dmg+' damage.');
  puffAdd(tx,ty);
  for(const e of G.enemies.slice())if(!e.dead&&Math.max(Math.abs(e.x-tx),Math.abs(e.y-ty))<=R){hurtEnemy(e,dmg,'#ff7a2a',false,'magic');settle(e);}
  endTurn();
 },
 backstab:function(tx,ty){
  const e=enemyAt(tx,ty),a=BAL.ability.backstab,p=G.p;
  const cond=!e.awake||e.stun>0||e.frz>0||e.blind>0||isBehind(e);
  spend('backstab');breakVanish();vfxAdd('backstab',e.x,e.y);
  let mul=cond?a.mul*(1+(pc('assassin')?BAL.perk.assassinMul:0))+(wpK()&&wpK().sneak||0):a.weakMul;
  const strikes=eqKind('off')==='dagger2'?[1,BAL.offhand.dagger2Frac]:[1];
  for(const f of strikes){
   if(e.dead||e.hp<=0)break;
   const crit=rf()<critChance();let dmg=Math.max(1,Math.round(playerDmg()*mul*f*(crit?BAL.combat.critMul:1)));
   hurtEnemy(e,dmg,cond?'#ff5a8a':'#ffd24a',crit,'melee');
   msg((cond?'Backstab! ':'Clumsy stab. ')+'You hit the '+nm(e)+' for '+dmg+'.');sfx(cond?'crit':'hit');if(cond)shake(4);
   lifeSteal(dmg);poison(e);if(cond)bleed(e);settle(e);
  }
  if(e.dead&&eqKind('off')==='garrote'){G.cd.backstab=0;msg('Garrote: Backstab is ready again.');}
  endTurn();
 },
 vanish:function(){
  spend('vanish');walkTok++;G.vanish=BAL.ability.vanish.turns+(pc('shadow')?BAL.perk.shadowTurns:0);
  for(const e of G.enemies)e.awake=false;
  vfxAdd('vanish',G.p.x,G.p.y);floatFx(G.p.x,G.p.y,'vanish','#cfc');msg('You vanish.');endTurn();
 },
 knife:function(tx,ty){
  const e=enemyAt(tx,ty),a=BAL.ability.knife,p=G.p;spend('knife');breakVanish();
  vfxAdd('knife',p.x,p.y,tx,ty);
  const crit=rf()<critChance();
  let dmg=Math.round(playerDmg()*a.mul)+a.add;
  const sn=(p.cls==='rogue'?BAL.combat.sneakMul:1)+(wpK()&&wpK().sneak||0);
  if(crit)dmg*=BAL.combat.critMul;
  const unaware=!e.awake&&sn>1;
  if(unaware){dmg*=sn;msg('Sneak attack!');}
  dmg=Math.max(1,dmg);
  hurtEnemy(e,dmg,crit?'#ff8a3a':'#ffd24a',crit,'ranged');msg('Your knife hits the '+nm(e)+' for '+dmg+'.');
  lifeSteal(dmg);poison(e);if(unaware)bleed(e);settle(e);
  if(e.dead&&G.syn.sd){G.knives=Math.min(maxKnives(),G.knives+1);msg('Silent Death: the knife returns to your hand.');}
  else dropAt(tx,ty,{t:'knife',v:0});
  endTurn();
 },
 smoke:function(tx,ty){
  const a=BAL.ability.smoke,O=BAL.offhand,sat=eqKind('off')==='satchel';
  const R=a.radius+(sat?O.satchelRadius:0),cells=[];
  spend('smoke');breakVanish();
  for(let y=ty-R;y<=ty+R;y++)for(let x=tx-R;x<=tx+R;x++)if(inb(x,y)&&G.map[ix(x,y)]!==0&&G.map[ix(x,y)]!==5)cells.push(ix(x,y));
  (G.smoke=G.smoke||[]).push({cells:cells,t:a.turns+(sat?O.satchelTurns:0)});
  vfxAdd('smoke',G.p.x,G.p.y,tx,ty,R);floatFx(tx,ty,'SMOKE','#ccd',true);msg('Smoke: foes inside are blinded.');
  for(const e of G.enemies){
   if(cells.indexOf(ix(e.x,e.y))<0)continue;
   e.blind=a.blindTurns;e.wind=null;if(eqKind('off')==='caltrops')stunEnemy(e,BAL.offhand.caltropStun,1);if(!EN[e.t].boss)e.awake=false;
  }
  endTurn();
 }
};
// run an ability by key (the bot and the buttons both come through here). Returns true if the turn was used.
function useAbility(k,tx,ty){
 if(!G||G.over||modalOpen())return false;
 const why=whyNot(k);
 if(why){msg(why);render();return false;}
 const A=ABIL[k];
 if(A.tg!=='self'){
  if(tx==null||!targetTiles(k).some(t=>t[0]===tx&&t[1]===ty)){msg(A.n+': tap a lit tile.');render();return false;}
 }
 armed=null;
 DO[k](tx,ty);
 return true;
}
function toggleAbility(k){
 walkTok++;if(!G||G.over||modalOpen())return;
 if(armed===k){if(ABIL[k].tg==='self'){useAbility(k);return;}cancelTarget();return;}   // armed self ability: the second tap uses it
 const why=whyNot(k);
 if(why){msg(why);if(armed){armed=null;}render();return;}
 armed=k;msg(ABIL[k].n+(ABIL[k].tg==='self'?': tap again to use.':': tap a target.'));render();
}
function cancelTarget(){if(armed){armed=null;msg('Cancelled.');}render();}
// ---- the Mage's free shot: a weak ranged attack on a visible foe within BAL.shot.range (also next to you: the Mage never melees). No mana, no cooldown, one turn.
// Damage = the normal attack formula (so the weapon matters) x BAL.shot.mul; crit, sneak, lifesteal and poison weapons apply, knock-back / sweep (melee only) do not.
// Shield rules are the ranged ones, as for Bolt.
function canShoot(e){return !!G&&G.p.cls==='mage'&&!!e&&!e.dead&&G.vis[ix(e.x,e.y)]&&manh(e,G.p)<=BAL.shot.range&&los(G.p.x,G.p.y,e.x,e.y,true);}
function mageShot(e){
 if(!G||G.over||!canShoot(e))return false;
 const p=G.p;walkTok++;breakVanish();
 let dmg=playerDmg()*BAL.shot.mul;const crit=rf()<critChance();if(crit)dmg*=BAL.combat.critMul;
 const sn=sneakMul(),unaware=!e.awake;if(sn>1&&unaware){dmg*=sn;msg('Sneak attack!');}
 dmg=Math.max(1,Math.round(dmg));
 vfxAdd('shot',p.x,p.y,e.x,e.y);sfx('shot');
 hurtEnemy(e,dmg,crit?'#ff8a3a':'#cfe3ff',crit,'ranged');
 msg((crit?'Critical! ':'')+'Your shot hits the '+nm(e)+' for '+dmg+'.');
 lifeSteal(dmg);poison(e);settle(e);
 endTurn();return true;
}
// ---- weapon reach (spear) ----
function reachOk(e){
 const wk=wpK();if(!wk||!wk.reach||!e||e.dead||!G.vis[ix(e.x,e.y)])return false;
 const p=G.p,dx=e.x-p.x,dy=e.y-p.y;
 if(!((dx===0&&Math.abs(dy)===wk.reach)||(dy===0&&Math.abs(dx)===wk.reach)))return false;
 const sx=Math.sign(dx),sy=Math.sign(dy);
 for(let k=1;k<wk.reach;k++){const x=p.x+sx*k,y=p.y+sy*k;if(!walkable(x,y)||G.map[ix(x,y)]===3||enemyAt(x,y))return false;}
 return true;
}
function reachAttack(e){
 if(!G||G.over||!reachOk(e))return false;
 walkTok++;msg('You thrust your spear.');playerAttack(e);endTurn();return true;
}
