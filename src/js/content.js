// content.js - non-numeric content: themes (colours), sound effect tables, name lists, ability button defs.

const SFX={
 hit:[[190,.07,'square',.07,95]],
 shot:[[620,.04,'sine',.05,440]],
 crit:[[330,.05,'square',.08],[560,.1,'square',.08,280]],
 hurt:[[150,.14,'sawtooth',.08,70]],
 pickup:[[660,.05,'sine',.07],[880,.08,'sine',.07]],
 level:[[523,.09,'triangle',.09],[659,.09,'triangle',.09],[784,.09,'triangle',.09],[1047,.2,'triangle',.09]],
 stairs:[[420,.09,'triangle',.08,320],[320,.09,'triangle',.08,230],[230,.14,'triangle',.08,130]],
 death:[[300,.16,'sawtooth',.09,200],[200,.2,'sawtooth',.09,110],[110,.45,'sawtooth',.09,40]],
 win:[[523,.12,'triangle',.09],[659,.12,'triangle',.09],[784,.12,'triangle',.09],[1047,.35,'triangle',.09]]
};
const THEMES=ENV;
// each depth band has a second, hand-picked look for the "other" exit (own palette and name)
const THEMES2=[
 {n:'The Ossuary',fa:'#4f4a44',fb:'#57514a',fc:'#3d3934',fs:'#17130f',wt:'#2f2b27',wf:'#433d36',we:'#25211d',wh:'#8a7f6c',mw:'#6a6050',mf:'#b0a58e',mfd:'#5a5246',em:0},
 {n:'The Fungal Grotto',fa:'#3f5a63',fb:'#46636c',fc:'#2f4650',fs:'#0e1b20',wt:'#232a3a',wf:'#2f3a50',we:'#1b2130',wh:'#5a4a86',mw:'#5c4f94',mf:'#8ab0bf',mfd:'#4a6670',em:0},
 {n:'The Ashen Halls',fa:'#4a4748',fb:'#524f50',fc:'#383536',fs:'#161212',wt:'#2d2a2b',wf:'#433f40',we:'#201c1d',wh:'#c0702f',mw:'#6a5a52',mf:'#b0a8a4',mfd:'#5c5652',em:1}
];
function themeOf(f,v){const i=f<=3?0:f<=6?1:2;return v===1&&f<MAXF?THEMES2[i]:THEMES[i];}
const ENAMES=['Gorak','Vexa','Morn','Sable','Thrain','Ilsa','Brakk','Nyx'],ETITLES=['the Cruel','the Bloodied','Ironhide','the Hungry','Gravecaller','Emberhand'];
// Ability button defs per key: icon, short name, targeting (adj = adjacent enemy, line = enemy in a straight line,
// enemy = visible enemy, tile = visible tile, self = no target). The class kit order lives in CLS[cls].kit.
const ABIL={
 bash:{e:'ab_bash',n:'Bash',tg:'adj'},cleave:{e:'ab_cleave',n:'Cleave',tg:'self'},charge:{e:'ab_charge',n:'Charge',tg:'line'},brace:{e:'ab_brace',n:'Brace',tg:'self'},
 bolt:{e:'ab_bolt',n:'Bolt',tg:'enemy'},nova:{e:'ab_nova',n:'Nova',tg:'self'},blink:{e:'ab_blink',n:'Blink',tg:'tile'},fire:{e:'ab_fire',n:'Fireball',tg:'tile'},
 backstab:{e:'ab_backstab',n:'Backstab',tg:'adj'},vanish:{e:'ab_vanish',n:'Vanish',tg:'self'},knife:{e:'ab_knife',n:'Knife',tg:'enemy'},smoke:{e:'ab_smoke',n:'Smoke',tg:'tile'},
 shot:{e:'ab_bolt',n:'Shot',tg:'enemy'}   // not on any button: the Mage's free shot, armed by the F key so a keyboard cursor can pick its target
};
// ---- descriptive text: every number below is read from BAL / the tables, never hand-copied ----
const pct=x=>Math.round(x*100)+'%',sgn=n=>(n>=0?'+':'')+n;
function abCost(k){const a=BAL.ability[k];return a.rage?a.rage+' rage':a.mana?a.mana+' mana':k==='knife'?'1 knife':a.cd?'cooldown '+a.cd:'free';}
// short player-facing hints (budget: <= 60 characters each; the cost / cooldown is shown next to the name)
function abilityDesc(k){
 const a=BAL.ability[k];
 switch(k){
  case 'bash':return 'Stun the foe in front '+a.stun+' turns and push it back.';
  case 'cleave':return 'Hit all 8 neighbours, diagonals too, for '+pct(a.mul)+'.';
  case 'charge':return 'Dash '+a.minDist+'-'+a.maxDist+' tiles, hit for '+pct(a.mul)+', stun '+a.stun+' turns.';
  case 'brace':return 'Halve the next '+a.hits+' hits; reflect '+pct(a.reflect)+' of melee.';
  case 'bolt':return 'Ranged hit on a visible foe, up to '+a.range+' tiles.';
  case 'nova':return 'Freeze all 8 neighbours '+a.freeze+' turns, hit for '+pct(a.mul)+'.';
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
 if(k==='mage')return C.hp+' HP. '+(C.mana+WP[C.start].mana)+' mana, +'+M.regen+' per turn, +'+M.perKill+' per kill. Starts with '+C.fire+' Flames. Free shot: tap a foe within '+BAL.shot.range+' tiles.';
 return C.hp+' HP, '+pct(C.crit)+' crit, x'+BAL.combat.sneakMul+' on unaware foes. '+BAL.ability.knife.max+' knives, no resource bar.';
}
// gear rule lines (budget: <= 60 characters). noStat drops the attack / defense part (the comparison shows it as a number). cls hides what means
// nothing to that class (mana and spell power for a Warrior or Rogue, rage for a Mage or Rogue).
function wpTerms(k,noStat,cls){
 const w=WP[k],t=[],mage=!cls||cls==='mage';
 if(w.atk&&!noStat)t.push(sgn(w.atk)+' attack');
 if(w.sweep)t.push('hits neighbours for '+pct(w.sweep));
 if(w.reach)t.push('reach '+w.reach);
 if(w.crit)t.push(sgn(Math.round(w.crit*100))+'% crit');
 if(w.sneak)t.push('sneak +'+w.sneak);
 if(w.spell&&mage)t.push(sgn(Math.round(w.spell*100))+'% spell power');
 if(w.mana&&mage)t.push(sgn(w.mana)+' mana');
 if(w.knock)t.push('knocks foes back');
 if(w.riposte)t.push(pct(w.riposte)+' counter');
 if(w.pois)t.push('hits poison');
 if(w.chain)t.push('kills zap a foe');
 return t;
}
function wpRule(k,noStat,cls){const t=wpTerms(k,noStat,cls);return t.length?t.join(', '):'Balanced.';}
function armTerms(k,noStat,cls){
 const a=ARM[k],t=[],mage=!cls||cls==='mage',war=!cls||cls==='warrior';
 if(!noStat){if(a.noDef)t.push('no defense');else if(a.def)t.push(sgn(a.def)+' defense');}
 if(a.dodge)t.push(sgn(Math.round(a.dodge*100))+'% dodge');
 if(a.spell&&mage)t.push(sgn(Math.round(a.spell*100))+'% spell power');
 if(a.manaBase&&mage)t.push('+'+a.manaBase+' mana');
 if(a.mana&&mage)t.push(sgn(a.mana)+' mana');
 if(a.manaRegenMul&&mage)t.push('mana regen '+pct(a.manaRegenMul));
 if(a.rageMul&&war)t.push('rage gain '+pct(a.rageMul));
 return t;
}
function armRule(k,noStat,cls){const t=armTerms(k,noStat,cls);return t.length?t.join(', '):'Balanced.';}
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
  quiver:'+'+O.quiverKnives+' knives carried.',
  garrote:'A Backstab kill resets its cooldown.',
  focus:'Bolt hits stunned or frozen foes for x'+O.focusMul+'.',
  warbanner:'Cleave strikes twice (2nd at '+pct(O.bannerFrac)+').',
  gauntlet:'Charge +'+O.gauntletRange+' range and slams the foe back.',
  shard:'Blink scorches foes next to where you stood.',
  caltrops:'Smoke also stuns foes inside '+O.caltropStun+' turns.'
 }[k]||'';
}
function charmRule(k){
 const C=BAL.charm;
 return {
  fang:'Heal '+C.fangHeal+'+ HP on each kill.',
  ward:'The first hit each floor is free.',
  hourglass:'Cooldowns tick +1 every '+C.hourglassEvery+' turns.',
  veil:'Foes notice you '+C.veilSight+' tiles later.',
  flask:'First potion each floor takes no turn.',
  soul:'Kills refund '+C.soulRage+' rage / '+C.soulMana+' mana / 1 cooldown.',
  gilded:'Gold heals 1 HP per '+C.gildedPer+' gold picked up.',
  frenzy:'Kills give +1 attack this floor (max '+C.frenzyMax+').',
  laststand:'Once a floor, below '+pct(C.lastBelow)+' HP: heal '+pct(C.lastHeal)+'.',
  aegis:'No hit takes more than '+pct(C.aegisCap)+' of max HP.',
  cinder:'Kills burn neighbours for '+C.cinderBase+'+ damage.'
 }[k]||'';
}
