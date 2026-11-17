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
function abCdTxt(k){const c=BAL.ability[k].cd;return c?' Recharges in '+c+' turns.':'';}
function abilityDesc(k){
 const a=BAL.ability[k],O=BAL.offhand;
 switch(k){
  case 'bash':return 'Hit an adjacent enemy, stun it '+a.stun+' turns ('+a.stunBoss+' on bosses) and knock it back a tile. Free.'+abCdTxt(k);
  case 'cleave':return 'Hit EVERY adjacent enemy for '+pct(a.mul)+' damage. Costs '+a.rage+' rage.';
  case 'charge':return 'Rush '+a.minDist+'-'+a.maxDist+' tiles in a straight line to an enemy, hit it for '+pct(a.mul)+' and stun it '+a.stun+' turns. Costs '+a.rage+' rage.'+abCdTxt(k);
  case 'brace':return 'Halve the next '+a.hits+' hits you take (for up to '+a.turns+' turns) and reflect '+pct(a.reflect)+' of melee damage back. Costs '+a.rage+' rage.';
  case 'bolt':return 'Ranged blast at a visible enemy up to '+a.range+' tiles away. Cheap filler: '+a.mana+' mana.';
  case 'nova':return 'Freeze every adjacent enemy for '+a.freeze+' turns ('+a.freezeBoss+' on bosses) and deal '+pct(a.mul)+' damage. Costs '+a.mana+' mana.'+abCdTxt(k);
  case 'blink':return 'Teleport up to '+a.range+' tiles to a visible tile you choose. Costs '+a.mana+' mana.'+abCdTxt(k);
  case 'fire':return 'Explode a tile within '+a.range+': every enemy within '+a.radius+' tile'+(a.radius>1?'s':'')+' takes '+Math.round(a.base+a.perFloor)+' damage on floor 1, more deeper. Costs '+a.mana+' mana.';
  case 'backstab':return 'Strike an adjacent enemy for x'+a.mul+' damage if it is unaware, stunned, frozen, blinded, or you are behind it. Otherwise only '+pct(a.weakMul)+'.'+abCdTxt(k);
  case 'vanish':return 'Enemies lose track of you for '+a.turns+' turns. Attacking breaks it.'+abCdTxt(k);
  case 'knife':return 'Throw a knife (range '+a.range+', '+pct(a.mul)+' damage). It drops on the target tile: walk over it to pick it up. You carry up to '+a.max+'.';
  case 'smoke':return 'Blind enemies in a '+(a.radius*2+1)+'x'+(a.radius*2+1)+' cloud (range '+a.range+'): they lose track, and for '+a.turns+' turns the cloud makes enemies miss '+pct(a.miss)+' of attacks.'+abCdTxt(k);
 }
 return '';
}
function classBlurb(k){
 const C=CLS[k],R=BAL.rage,M=BAL.mana;
 if(k==='warrior')return C.hp+' HP, +'+C.def+' defense. Rage (max '+R.max+') builds when you hit or get hit and fades out of combat. Wants to stand in the middle of a pack.';
 if(k==='mage')return C.hp+' HP. Mana pool of '+C.mana+', +'+M.regen+' per turn and +'+M.perKill+' per kill. Wants distance and careful mana management. Starts with '+C.fire+' flame scrolls.';
 return C.hp+' HP, '+pct(C.crit)+' crit, x'+BAL.combat.sneakMul+' damage on enemies that have not noticed you. No resource bar: cooldowns, '+BAL.ability.knife.max+' throwing knives and positioning. Never takes a fair fight.';
}
function classKitHtml(k,full){
 return CLS[k].kit.map(a=>{const A=ABIL[a];return '<div class="pl"><b>'+A.e+' '+A.n+'</b> <small>('+abCost(a)+')'+(full?'<br>'+abilityDesc(a):'')+'</small></div>';}).join('');
}
function wpRule(k){
 const w=WP[k],t=[];
 if(w.atk)t.push(sgn(w.atk)+' melee attack');
 if(w.sweep)t.push('melee hits also strike other enemies next to you or the target for '+pct(w.sweep));
 if(w.reach)t.push('reach '+w.reach+': attacks an enemy two tiles away in a straight line');
 if(w.crit)t.push(sgn(Math.round(w.crit*100))+'% crit');
 if(w.sneak)t.push('sneak attacks and Backstab get +'+w.sneak+' to their multiplier');
 if(w.spell)t.push(sgn(Math.round(w.spell*100))+'% spell power');
 if(w.mana)t.push(sgn(w.mana)+' max mana');
 return t.length?t.join('; ')+'.':'Balanced: no modifiers.';
}
function armRule(k){
 const a=ARM[k],t=[];
 if(a.noDef)t.push('no defense');else if(a.def)t.push(sgn(a.def)+' defense');
 if(a.dodge)t.push(sgn(Math.round(a.dodge*100))+'% dodge');
 if(a.spell)t.push(sgn(Math.round(a.spell*100))+'% spell power');
 if(a.manaBase)t.push('+'+a.manaBase+' max mana, more with tier');
 if(a.mana)t.push(sgn(a.mana)+' max mana');
 if(a.manaRegenMul)t.push('mana regenerates at '+pct(a.manaRegenMul));
 if(a.rageMul)t.push('rage gain at '+pct(a.rageMul));
 return t.length?t.join('; ')+'.':'Balanced: no modifiers.';
}
function offRule(k){
 const O=BAL.offhand,A=BAL.ability;
 return {
  tower:'Bash hits the target and the enemies behind it in a line of '+O.towerLine+' tiles.',
  bulwark:'Brace blocks '+O.bulwarkHits+' more hits and reflects '+pct(O.bulwarkReflect)+' of the damage.',
  totem:'Cleave refunds '+O.totemRage+' rage per enemy hit.',
  tome:'Frost Nova also burns every enemy it freezes ('+O.tomeBurnTurns+' turns).',
  prism:'Fireball radius +'+O.prismRadius+', but '+pct(1-O.prismMul)+' less damage.',
  lens:'Bolt pierces: also hits up to '+O.lensPierce+' more enemies behind the target in a line.',
  dagger2:'Backstab strikes twice (the second hit at '+pct(O.dagger2Frac)+').',
  satchel:'Smoke Bomb radius +'+O.satchelRadius+' and lasts '+O.satchelTurns+' turns longer.',
  quiver:'+'+O.quiverKnives+' knives carried.'
 }[k]||'';
}
function charmRule(k){
 const C=BAL.charm;
 return {
  fang:'Heal '+C.fangHeal+' HP (more on deeper floors) whenever you kill an enemy.',
  ward:'The first hit you take on each floor is free.',
  eye:'Every trap on the floor is revealed when you arrive.',
  hourglass:'Ability cooldowns recharge faster: one extra turn every '+C.hourglassEvery+' turns.',
  veil:'Enemies notice you from '+C.veilSight+' tiles closer.',
  flask:'The first potion you drink on each floor takes no turn.',
  soul:'Each kill refunds: '+C.soulRage+' rage (Warrior), '+C.soulMana+' mana (Mage), 1 turn off every cooldown (Rogue).'
 }[k]||'';
}
