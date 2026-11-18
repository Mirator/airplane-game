// content.js - non-numeric content: themes (colours), sound effect tables, name lists, ability button defs.

const SFX={
 hit:[[190,.07,'square',.07,95]],
 crit:[[330,.05,'square',.08],[560,.1,'square',.08,280]],
 hurt:[[150,.14,'sawtooth',.08,70]],
 pickup:[[660,.05,'sine',.07],[880,.08,'sine',.07]],
 level:[[523,.09,'triangle',.09],[659,.09,'triangle',.09],[784,.09,'triangle',.09],[1047,.2,'triangle',.09]],
 stairs:[[420,.09,'triangle',.08,320],[320,.09,'triangle',.08,230],[230,.14,'triangle',.08,130]],
 death:[[300,.16,'sawtooth',.09,200],[200,.2,'sawtooth',.09,110],[110,.45,'sawtooth',.09,40]],
 win:[[523,.12,'triangle',.09],[659,.12,'triangle',.09],[784,.12,'triangle',.09],[1047,.35,'triangle',.09]]
};
const THEMES=[
 {n:'The Crypt',wl:'#3d4678',wt:'#6d7ab8',we:'#252b52',wld:'#171a2e',wtd:'#272c4a',wed:'#0d0f1c',fa:'#a8996f',fb:'#b2a37a',fda:'#35322a',fdb:'#38352d',mw:'#3a4270',mf:'#cbbd90',mfd:'#8a8060'},
 {n:'The Caverns',wl:'#2d4a45',wt:'#5f9484',we:'#173029',wld:'#13211e',wtd:'#1f3631',wed:'#0a1411',fa:'#8a9a78',fb:'#94a482',fda:'#2b3328',fdb:'#2e362b',mw:'#2f5a50',mf:'#a8b890',mfd:'#6a7a5a'},
 {n:'The Embers',wl:'#5a2a22',wt:'#b0482e',we:'#2e100c',wld:'#241210',wtd:'#3a1b15',wed:'#140807',fa:'#a8704a',fb:'#b47a52',fda:'#3a2619',fdb:'#3e291c',mw:'#7a3224',mf:'#d08a58',mfd:'#7a5030'}
];
// each depth band has a second look for the "other" exit: same colours rotated in hue, with its own name
function tintTheme(t,name,deg){
 const f=c=>{
  const r=parseInt(c.slice(1,3),16)/255,g=parseInt(c.slice(3,5),16)/255,b=parseInt(c.slice(5,7),16)/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;
  let h=0,s=0;
  if(d){s=d/(1-Math.abs(2*l-1));h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;}
  h=(h+deg+360)%360;
  const C=(1-Math.abs(2*l-1))*s,X=C*(1-Math.abs((h/60)%2-1)),m=l-C/2,k=Math.floor(h/60),rgb=[[C,X,0],[X,C,0],[0,C,X],[0,X,C],[X,0,C],[C,0,X]][k%6];
  return '#'+rgb.map(v=>('0'+Math.round((v+m)*255).toString(16)).slice(-2)).join('');
 },o={n:name};
 for(const k in t)if(k!=='n')o[k]=f(t[k]);
 return o;
}
const THEMES2=[tintTheme(THEMES[0],'The Ossuary',70),tintTheme(THEMES[1],'The Fungal Grotto',-75),tintTheme(THEMES[2],'The Ashen Halls',-35)];
function themeOf(f,v){const i=f<=3?0:f<=6?1:2;return v===1&&f<MAXF?THEMES2[i]:THEMES[i];}
const ENAMES=['Gorak','Vexa','Morn','Sable','Thrain','Ilsa','Brakk','Nyx'],ETITLES=['the Cruel','the Bloodied','Ironhide','the Hungry','Gravecaller','Emberhand'];
// Ability button defs per key: icon, short name, targeting (adj = adjacent enemy, line = enemy in a straight line,
// enemy = visible enemy, tile = visible tile, self = no target). The class kit order lives in CLS[cls].kit.
const ABIL={
 bash:{e:'🛡',n:'Bash',tg:'adj'},cleave:{e:'💢',n:'Cleave',tg:'self'},charge:{e:'⚡',n:'Charge',tg:'line'},brace:{e:'🧱',n:'Brace',tg:'self'},
 bolt:{e:'🔮',n:'Bolt',tg:'enemy'},nova:{e:'❄️',n:'Nova',tg:'self'},blink:{e:'✨',n:'Blink',tg:'tile'},fire:{e:'🔥',n:'Fireball',tg:'tile'},
 backstab:{e:'🗡',n:'Backstab',tg:'adj'},vanish:{e:'👻',n:'Vanish',tg:'self'},knife:{e:'🔪',n:'Knife',tg:'enemy'},smoke:{e:'🌫',n:'Smoke',tg:'tile'}
};
// ---- descriptive text: every number below is read from BAL / the tables, never hand-copied ----
const pct=x=>Math.round(x*100)+'%',sgn=n=>(n>=0?'+':'')+n;
function abCost(k){const a=BAL.ability[k];return a.rage?a.rage+' rage':a.mana?a.mana+' mana':k==='knife'?'1 knife':a.cd?'cooldown '+a.cd:'free';}
// short player-facing hints (budget: <= 60 characters each; the cost / cooldown is shown next to the name)
function abilityDesc(k){
 const a=BAL.ability[k];
 switch(k){
  case 'bash':return 'Stun an adjacent foe '+a.stun+' turns and push it back.';
  case 'cleave':return 'Hit every adjacent foe for '+pct(a.mul)+'.';
  case 'charge':return 'Dash '+a.minDist+'-'+a.maxDist+' tiles, hit for '+pct(a.mul)+', stun '+a.stun+' turns.';
  case 'brace':return 'Halve the next '+a.hits+' hits; reflect '+pct(a.reflect)+' of melee.';
  case 'bolt':return 'Ranged hit on a visible foe, up to '+a.range+' tiles.';
  case 'nova':return 'Freeze adjacent foes '+a.freeze+' turns and hit for '+pct(a.mul)+'.';
  case 'blink':return 'Teleport up to '+a.range+' tiles.';
  case 'fire':return 'Blast radius '+a.radius+': '+Math.round(a.base+a.perFloor)+' damage, more deeper.';
  case 'backstab':return 'x'+a.mul+' on unaware, stunned or flanked foes; else '+pct(a.weakMul)+'.';
  case 'vanish':return 'Foes lose you for '+a.turns+' turns. Attacking breaks it.';
  case 'knife':return 'Throw it ('+a.range+' tiles, '+pct(a.mul)+'); walk over it to reuse.';
  case 'smoke':return 'Blind foes in a '+(a.radius*2+1)+'x'+(a.radius*2+1)+' cloud; '+pct(a.miss)+' miss for '+a.turns+' turns.';
 }
 return '';
}
// class card line (budget: <= 45 characters). The numbers live in classDetail.
const CLASS_TAG={warrior:'Tough brawler. Wades into packs.',mage:'Fragile caster. Blasts from afar.',rogue:'Sneaky striker. Ambush, then vanish.'};
function classBlurb(k){return CLASS_TAG[k]||'';}
function classDetail(k){
 const C=CLS[k],R=BAL.rage,M=BAL.mana;
 if(k==='warrior')return C.hp+' HP, +'+C.def+' defense. Rage (max '+R.max+') builds as you fight.';
 if(k==='mage')return C.hp+' HP. '+C.mana+' mana, +'+M.regen+' per turn, +'+M.perKill+' per kill. Starts with '+C.fire+' Flames.';
 return C.hp+' HP, '+pct(C.crit)+' crit, x'+BAL.combat.sneakMul+' on unaware foes. '+BAL.ability.knife.max+' knives, no resource bar.';
}
// gear rule lines (budget: <= 60 characters). noStat drops the +attack part (the comparison shows it as a number).
function wpRule(k,noStat){
 const w=WP[k],t=[];
 if(w.atk&&!noStat)t.push(sgn(w.atk)+' attack');
 if(w.sweep)t.push('hits neighbours for '+pct(w.sweep));
 if(w.reach)t.push('reach '+w.reach);
 if(w.crit)t.push(sgn(Math.round(w.crit*100))+'% crit');
 if(w.sneak)t.push('sneak +'+w.sneak);
 if(w.spell)t.push(sgn(Math.round(w.spell*100))+'% spell power');
 if(w.mana)t.push(sgn(w.mana)+' mana');
 return t.length?t.join(', '):'Balanced.';
}
function armRule(k){
 const a=ARM[k],t=[];
 if(a.noDef)t.push('no defense');else if(a.def)t.push(sgn(a.def)+' defense');
 if(a.dodge)t.push(sgn(Math.round(a.dodge*100))+'% dodge');
 if(a.spell)t.push(sgn(Math.round(a.spell*100))+'% spell power');
 if(a.manaBase)t.push('+'+a.manaBase+' mana');
 if(a.mana)t.push(sgn(a.mana)+' mana');
 if(a.manaRegenMul)t.push('mana regen '+pct(a.manaRegenMul));
 if(a.rageMul)t.push('rage gain '+pct(a.rageMul));
 return t.length?t.join(', '):'Balanced.';
}
function offRule(k){
 const O=BAL.offhand;
 return {
  tower:'Bash hits a line of '+O.towerLine+' tiles.',
  bulwark:'Brace: +'+O.bulwarkHits+' blocks, reflects '+pct(O.bulwarkReflect)+'.',
  totem:'Cleave refunds '+O.totemRage+' rage per foe.',
  tome:'Nova also burns frozen foes '+O.tomeBurnTurns+' turns.',
  prism:'Fireball radius +'+O.prismRadius+', '+pct(1-O.prismMul)+' less damage.',
  lens:'Bolt pierces '+O.lensPierce+' more foes in line.',
  dagger2:'Backstab strikes twice (2nd at '+pct(O.dagger2Frac)+').',
  satchel:'Smoke: radius +'+O.satchelRadius+', '+O.satchelTurns+' turns longer.',
  quiver:'+'+O.quiverKnives+' knives carried.'
 }[k]||'';
}
function charmRule(k){
 const C=BAL.charm;
 return {
  fang:'Heal '+C.fangHeal+'+ HP on each kill.',
  ward:'The first hit each floor is free.',
  eye:'Reveals every trap on arrival.',
  hourglass:'Cooldowns tick +1 every '+C.hourglassEvery+' turns.',
  veil:'Foes notice you '+C.veilSight+' tiles later.',
  flask:'First potion each floor takes no turn.',
  soul:'Kills refund '+C.soulRage+' rage / '+C.soulMana+' mana / 1 cooldown.'
 }[k]||'';
}
