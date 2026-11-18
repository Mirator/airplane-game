#!/usr/bin/env node
// Mutation check for the test suite: implants one realistic bug at a time into a COPY of the game, rebuilds it, runs the suite and
// records which test caught it (or that it SURVIVED = the suite would not notice that bug).
//
//   node tests/mutate.js                 every mutation, stop each run at the first failing test (fast, ~10 min)
//   node tests/mutate.js --all           run the whole suite per mutation and list EVERY test that fails (kill matrix, slow)
//   node tests/mutate.js --only M07,M12  just these ids (comma separated; also matches the area, e.g. --only save)
//   node tests/mutate.js --check         only verify that every mutation still applies to src/ (each `find` occurs exactly once)
//   node tests/mutate.js --json out.json also write the results as JSON
//   node tests/mutate.js --jobs 2        mutations in parallel (each in its own copy). Parallel load can cause false "kills": keep 1 for reports.
//   node tests/mutate.js --no-confirm    do not re-run the failing test file(s) to confirm a kill (default: a kill must fail twice,
//                                        otherwise it is reported as FLAKY and counted as NOT killed - a flaky failure proves nothing)
//   node tests/mutate.js --recheck R.json  re-run only the mutations R.json (from --json) recorded as KILLED, and only the test files that
//                                        killed them; one that no longer fails is reported FLAKY (used to audit a first run)
//   node tests/mutate.js --tests DIR     use the tests/ folder of another checkout (e.g. an older version of the suite) with this src/
//
// Safety: the real src/, build.js and index.html are only READ. Every mutation is applied in a temporary copy of the repo
// (os.tmpdir()), which is deleted at the end (also on Ctrl-C / crash), so there is nothing to restore. A fingerprint of src/ is
// compared before and after as a sanity check. Exit code: 0 if every mutation was killed, 1 if any survived, 2 if the list is broken.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const TESTS_DIR = process.argv.includes('--tests') ? path.resolve(process.argv[process.argv.indexOf('--tests') + 1]) : __dirname;

// ---------------------------------------------------------------------------------------------------------------------------
// The mutation list. {id, area, desc, file (relative to src/js/, or src/... / index.html), find (must occur EXACTLY once), repl,
// rebuild (default true: run build.js after the edit; false = leave index.html stale)}. Each one is a bug that really could happen.
// ---------------------------------------------------------------------------------------------------------------------------
const M = (id, area, desc, file, find, repl, extra) => Object.assign({ id, area, desc, file, find, repl }, extra);
const MUTATIONS = [
  // ---- art: sprites, icons, effects
  M('MA0', 'art', 'the Rat has no sprite (a table id points at a missing picture)', 'sprites.js', "def('rat',", "def('rat_x',"),
  M('MA1', 'art', 'two foes share one picture (Troll drawn as the Ogre)', 'balance.js', "e:'troll'", "e:'ogre'"),
  M('MA2', 'art', 'an ability button shows the wrong icon (Bolt uses the Nova picture)', 'content.js', "bolt:{e:'ab_bolt'", "bolt:{e:'ab_nova'"),
  M('MA3', 'art', 'the stats row shows no gold icon', 'hud.js', "ic('coin',16)+' '+p.gold", "p.gold"),
  M('MA4', 'art', 'effects ignore prefers-reduced-motion', 'effects.js', "function vfxAdd(k,x,y,x2,y2,r){\n if(rmo())return;", "function vfxAdd(k,x,y,x2,y2,r){\n "),
  M('MA5', 'art', 'the renderer silently draws nothing for a missing sprite instead of reporting it', 'art.js', "if(artMissing.indexOf(id)<0)artMissing.push(id);const c=b.getContext('2d');", "const c=b.getContext('2d');"),
  M('MA6', 'art', 'the Guard\'s shield is not drawn', 'render.js', "if(d.shield&&e.face)drawShield(", "if(false&&d.shield&&e.face)drawShield("),
  M('MA7', 'art', 'the dragon is drawn at tile size (no boss scale)', 'render.js', "const BOSS_K=2.6;", "const BOSS_K=1.0;"),
  M('MA8', 'art', 'the sprite bitmap cache never hits (every frame re-draws the paths)', 'art.js', "let b=cache[key];if(b)return b;", "let b=null;"),
  M('MA9', 'art', 'the emoji-free log: a message gets an emoji prefix again', 'run.js', "msg(C.n+' descends", "msg('\u{1F5E1} '+C.n+' descends"),
  M('MA10', 'art', 'floating labels are no longer laid out (every one sits on the tile centre again)', 'effects.js', "f.off=-i*Math.max(0.3,h);", "f.off=0;"),
  M('MA11', 'art', 'the dragon head is drawn before the foes and the player (neighbours cover it again)', 'render.js', "ord.push('dragonHead');", "ord.splice(1,0,'dragonHead');"),
  M('MA12', 'art', 'the boss bar goes back onto the map under its neighbours', 'render.js', "view.bossBar={x:bx-2,y:by-2,w:bw+4,h:14};", "view.bossBar={x:bx-2,y:by+300,w:bw+4,h:14};"),
  M('MA13', 'art', 'every hit washes the whole screen red again', 'effects.js', "flashFull=(live&&flashFull)||share>=0.2;", "flashFull=true;"),
  M('MA14', 'art', 'the red flash plays with reduced motion', 'effects.js', "if(!rmo()){\n  const a=Math.max(0.12", "if(true){\n  const a=Math.max(0.12"),
  M('MA15', 'art', 'a foe on loot hides the loot again (no corner marker)', 'render.js', "if(it){itemMark(", "if(false&&it){itemMark("),
  M('MA16', 'art', 'the Warlock goes back to a crimson tone that sinks into the floor', 'sprites.js', "def('warlock',['#d63c78'", "def('warlock',['#8a1a3a'"),
  M('MA17', 'art', 'wall tops are the brightest plane again (Crypt wall top lighter than its floor)', 'art.js', "wt:'#2b3052',wf:'#3a4170'", "wt:'#8890c8',wf:'#3a4170'"),
  // ---- damage, crit, defense
  M('M01', 'combat', 'enemy hits ignore the player\'s defense', 'combat.js', 'dmg*BAL.combat.armorK/(BAL.combat.armorK+defTotal())', 'dmg*BAL.combat.armorK/(BAL.combat.armorK+0)'),
  M('M02', 'combat', 'melee crits do no extra damage', 'combat.js', 'if(crit)dmg*=BAL.combat.critMul;\n const sn=sneakMul();', 'const sn=sneakMul();'),
  M('M03', 'combat', 'sneak attack bonus applies to AWAKE enemies instead of sleeping ones', 'combat.js', "if(sn>1&&!e.awake){dmg*=sn;", "if(sn>1&&e.awake){dmg*=sn;"),
  M('M04', 'perks', 'perks with a stat effect (pk.f) are granted but never applied', 'perks.js', 'if(pk.f)pk.f(G.p);', ''),
  M('M05', 'perks', 'Second Wind perk never saves you', 'combat.js', "pc('second')&&!G.swUsed", "pc('second')&&G.swUsed"),
  // ---- warrior
  M('M06', 'warrior', 'Cleave costs no rage', 'abilities.js', "spend('cleave');breakVanish();", 'breakVanish();'),
  M('M07', 'warrior', 'Cleave hits only one adjacent enemy', 'abilities.js', "tg=chebEnemies();spend('cleave')", "tg=chebEnemies().slice(0,1);spend('cleave')"),
  M('M08', 'abilities', 'cooldown is never set after using an ability', 'abilities.js', 'const cd=cdFor(k);if(cd)G.cd[k]=cd;', ''),
  M('M09', 'warrior', 'Charge also works on an enemy standing right next to you (min distance ignored)', 'abilities.js', 'if(e){if(k>=a.minDist&&G.vis[ix(x,y)])', 'if(e){if(k>=1&&G.vis[ix(x,y)])'),
  M('M10', 'warrior', 'Brace no longer halves incoming damage', 'combat.js', 'dmg=Math.max(1,Math.round(dmg*BAL.ability.brace.reduce));', 'dmg=Math.max(1,dmg);'),
  M('M11', 'warrior', 'melee hits give no rage', 'combat.js', 'lifeSteal(dmg);gainRage(BAL.rage.dealt);\n poison(e);', 'lifeSteal(dmg);\n poison(e);'),
  M('M12', 'warrior', 'rage never decays out of combat', 'combat.js', 'p.rage=Math.max(0,p.rage-BAL.rage.decay)', 'p.rage=p.rage'),
  M('M13', 'warrior', 'taking a hit gives no rage', 'combat.js', 'gainRage(BAL.rage.taken);', ''),
  // ---- mage
  M('M14', 'mage', 'Arcane Bolt costs no mana', 'abilities.js', "spend('bolt');breakVanish();", 'breakVanish();'),
  M('M15', 'mage', 'Blink offers tiles you cannot walk to (sealed cave pockets)', 'abilities.js', '(x===p.x&&y===p.y)||reach[ix(x,y)]>=9999)continue;', '(x===p.x&&y===p.y))continue;'),
  M('M16', 'mage', 'Fireball only hits the centre tile', 'abilities.js', 'Math.max(Math.abs(e.x-tx),Math.abs(e.y-ty))<=R', '(e.x===tx&&e.y===ty)'),
  M('M17', 'mage', 'mana never regenerates per turn', 'combat.js', 'p.mf=(p.mf||0)+manaRegen();', 'p.mf=(p.mf||0)+0;'),
  M('M18', 'mage', 'kills give no mana', 'combat.js', "let m=BAL.mana.perKill+(pc('well')?BAL.perk.wellKill:0);", 'let m=0;'),
  M('M19', 'mage', 'Frost Nova does not freeze', 'abilities.js', "a.freeze+(pc('deepfreeze')?BAL.perk.freezeExtra:0)", '0'),
  // ---- rogue
  M('M20', 'rogue', 'thrown knives vanish instead of dropping (not recoverable)', 'abilities.js', "else dropAt(tx,ty,{t:'knife',v:0});", ''),
  M('M21', 'rogue', 'knives on the floor cannot be picked up', 'items.js', 'if(G.knives<maxKnives()){G.knives++;', 'if(false){G.knives++;'),
  M('M22', 'rogue', 'Throwing Knife is free (knife count never drops)', 'abilities.js', "if(k==='knife')G.knives--;", ''),
  M('M23', 'rogue', 'Backstab ignores the "enemy facing away" condition', 'abilities.js', '||e.blind>0||isBehind(e);', '||e.blind>0;'),
  M('M24', 'rogue', 'Smoke Bomb blinds nobody', 'abilities.js', 'e.blind=a.blindTurns;e.wind=null;', 'e.wind=null;'),
  M('M25', 'rogue', 'enemies keep hunting you while you are vanished', 'enemies.js', 'if(G.vanish>0){e.awake=false;e.wind=null;continue;}', ''),
  // ---- gear
  M('M26', 'gear', 'off-hand drops ignore the class lock (mage can find warrior shields)', 'items.js', 'pick(classOffs(G.p.cls))', 'pick(Object.keys(OFF))'),
  M('M27', 'gear', 'axe weapon type has no sweep', 'combat.js', 'if(wk&&wk.sweep){', 'if(false){'),
  M('M28', 'gear', 'dagger gives no extra sneak multiplier', 'combat.js', 'return b+(wk&&wk.sneak||0);}', 'return b;}'),
  M('M29', 'gear', 'plate armor gives no defense bonus beyond its tier', 'items.js', 'return Math.max(0,it.v+(a.def||0));', 'return Math.max(0,it.v);'),
  M('M30', 'gear', 'weapon tier (+N attack) is not added to melee attack', 'items.js', 'Math.max(1,G.p.atk+wv()+(k?k.atk:0)+atkMod())', 'Math.max(1,G.p.atk+(k?k.atk:0)+atkMod())'),
  M('M31', 'gear', 'Vampire Fang charm heals nothing on kill', 'combat.js', "if(ch==='fang'){", 'if(false){'),
  // ---- enemy AI
  M('M32', 'enemies', 'wind-up attacks hit even if you stepped off the marked tiles', 'enemies.js', 'if(w.tiles.some(t=>t[0]===p.x&&t[1]===p.y)){\n  if(d.boss', 'if(true){\n  if(d.boss'),
  M('M33', 'enemies', 'Guard shield is ignored', 'combat.js', 'if(kind&&EN[e.t].shield&&!(e.stun>0||e.frz>0)){', 'if(false){'),
  M('M34', 'enemies', 'Cultist never heals allies', 'enemies.js', 'if(d.heal&&!free&&!(e.hcd>0)){', 'if(false){'),
  M('M35', 'enemies', 'Hound moves one tile per turn (speed ignored)', 'enemies.js', 'const steps=(d.speed||1)+', 'const steps=1+'),
  M('M36', 'enemies', 'dragon never enrages', 'enemies.js', 'if(d.boss&&!e.enraged&&e.hp<e.mhp*(', 'if(false&&d.boss&&!e.enraged&&e.hp<e.mhp*('),
  M('M37', 'enemies', 'Ogre acts every turn (slow-act ignored)', 'enemies.js', 'if(d.slowAct){if(e.rest){e.rest=0;continue;}e.rest=1;}', ''),
  // ---- floor modifiers, path choice, stairs
  M('M38', 'modifiers', 'Cursed ground still lets you regenerate', 'combat.js', "if(p.hp<p.mhp&&!modIs('cursed')){", 'if(p.hp<p.mhp){'),
  M('M39', 'modifiers', 'Dark floors have normal sight', 'mods.js', "return modIs('dark')?BAL.mod.dark.sight:BAL.vis.radius;", 'return BAL.vis.radius;'),
  M('M40', 'modifiers', 'Rich vein gold is not doubled', 'mods.js', "return modIs('rich')?BAL.mod.rich.goldMul:1;", 'return 1;'),
  M('M41', 'modifiers', 'Flooded: wading gives enemies no free move', 'combat.js', "if(G.wade){G.wade=0;if(p.hp>0&&!G.won&&G.enemies.some(e=>e.awake)){", 'if(G.wade){G.wade=0;if(false){'),
  M('M42', 'modifiers', 'Unstable: collapsing floor does not hurt the player', 'mods.js', 'if(p.hp>0&&p.x===c.x&&p.y===c.y){p.hp-=d;', 'if(false){p.hp-=d;'),
  M('M43', 'modifiers', 'Hunted: killing the stalker gives no achievement', 'mods.js', "spoils!');\n earn('hunt');", "spoils!');"),
  M('M44', 'modifiers', 'Silent floors: enemies notice you from normal range', 'mods.js', "return modIs('silent')?BAL.mod.silent.sight:BAL.enemyAi.sightRange;", 'return BAL.enemyAi.sightRange;'),
  M('M45', 'mapgen', 'no stairs on floor 7 (last floor before the dragon)', 'mapgen.js', 'if(f<MAXF)m[ix(last.cx,last.cy)]=2;', 'if(f<MAXF-1)m[ix(last.cx,last.cy)]=2;'),
  M('M46', 'mapgen', 'treasure room door is left open (not locked)', 'mapgen.js', 'G.map[ix(ddx,ddy)]=5;const cells=[];', 'G.map[ix(ddx,ddy)]=4;const cells=[];'),
  M('M47', 'mapgen', 'stairsOk ignores an unreachable merchant', 'run.js', 'if(m&&!DIRS.some(d=>seen.has(ix(m.x+d[0],m.y+d[1]))))return false;', ''),
  M('M48', 'path', 'exit choice can offer two plain floors', 'mods.js', 'if(!a&&!b){const m=pick(avail).id;if(rf()<0.5)a=m;else b=m;}', ''),
  M('M49', 'path', 'choosing the second route takes the first', 'mods.js', 'fn:function(){closeModal();goDown(o);}', 'fn:function(){closeModal();goDown(G.opts[0]);}'),
  M('M50', 'keys', 'elite never drops the treasure key', 'combat.js', "else if(e.elite){dropAt(e.x,e.y,{t:'key',v:0});", 'else if(e.elite){'),
  M('M51', 'keys', 'locked door opens without a key', 'walk.js', 'if(G.keys>0){G.keys--;', 'if(true){G.keys--;'),
  // ---- merchant, shrine, traps, consumables, levels
  M('M52', 'merchant', 'merchant items cost nothing', 'features.js', 'p.gold-=it.price;it.sold=1;', 'it.sold=1;'),
  M('M53', 'merchant', 'merchant sells potions beyond the belt capacity', 'features.js', "if(G.inv.pot>=p.potCap){msg('Your potion belt is full.');return;}G.inv.pot++;", 'G.inv.pot++;'),
  M('M54', 'shrine', 'shrine blessing gives no defense', 'features.js', "p.def++;floatFx(p.x,p.y,'+'+h,'#6f6');", "floatFx(p.x,p.y,'+'+h,'#6f6');"),
  M('M55', 'shrine', 'shrine can be used again and again', 'features.js', 'const done=function(t){s.used=1;', 'const done=function(t){'),
  M('M56', 'traps', 'spike traps do no damage to the player', 'features.js', "p.hp-=d;G.killer='a spike trap';", "G.killer='a spike trap';"),
  M('M57', 'traps', 'alarm trap does not wake the floor', 'features.js', "else{wakeAll();t.done=1;floatFx(p.x,p.y,'ALARM'", "else{t.done=1;floatFx(p.x,p.y,'ALARM'"),
  M('M58', 'items', 'potions are not used up', 'items.js', 'G.ppois=null;G.inv.pot--;G.stats.pots++;', 'G.ppois=null;G.stats.pots++;'),
  M('M59', 'items', 'level-up gives no max HP', 'player.js', 'p.mhp+=lg.hp;p.hp+=lg.hp;', ''),
  // ---- save / load
  M('M60', 'save', 'knife count is not persisted in the run save', 'save.js', 'js=JSON.stringify(G);', "js=JSON.stringify(G,function(k,v){return k==='knives'?undefined:v;});"),
  M('M61', 'save', 'ability cooldowns are not persisted in the run save', 'save.js', 'js=JSON.stringify(G);', "js=JSON.stringify(G,function(k,v){return k==='cd'?undefined:v;});"),
  M('M62', 'save', 'run is not mirrored into IndexedDB', 'save.js', 'try{localStorage.setItem(RUN_KEY,js);}catch(e){}\n idbPutRun(js);', 'try{localStorage.setItem(RUN_KEY,js);}catch(e){}'),
  M('M63', 'save', 'finished run is not cleared from the IndexedDB mirror (resurrects)', 'save.js', "catch(e){}idbPutRun('');}", 'catch(e){}}'),
  M('M64', 'save', 'run saves of any version are accepted', 'save.js', 'RUN_VERS.indexOf(o.ver)>=0&&', ''),
  M('M65', 'save', 'v2 run upgraded without the "history unknown" flag', 'save.js', 'G.stats={pots:0,dragonHit:0,legacy:1}', 'G.stats={pots:0,dragonHit:0,legacy:0}'),
  M('M66', 'save', 'a loaded run comes back with Auto still on', 'save.js', 'G.auto={on:0,used:a.used?1:0', 'G.auto={on:wasOn?1:0,used:a.used?1:0'),
  // ---- meta gold, records, achievements, daily, Hard
  M('M67', 'meta', 'Auto runs bank full gold', 'run.js', '*(aut?BAL.auto.goldMul:1)', '*1'),
  M('M68', 'meta', 'Hard runs bank no extra gold', 'run.js', '(hard?BAL.hard.goldMul:1)', '1'),
  M('M69', 'meta', 'win bonus gold is not banked', 'run.js', 'banked=Math.round((p.gold+bonus)*', 'banked=Math.round((p.gold)*'),
  M('M70', 'records', 'win streak is not reset by a loss', 'records.js', '}else meta.streak=0;', '}'),
  M('M71', 'records', 'fastest win keeps the SLOWEST time', 'records.js', 'if(!r.fast||g.turn<r.fast){', 'if(!r.fast||g.turn>r.fast){'),
  M('M72', 'records', 'achievement reward gold is not paid', 'records.js', 'if(a.gold)meta.gold+=a.gold;saveMeta();', 'saveMeta();'),
  M('M73', 'records', 'achievements can be earned (and paid) repeatedly', 'records.js', 'if(!a||meta.ach[id])return false;', 'if(!a)return false;'),
  M('M74', 'daily', 'Daily floors are not seeded from the date', 'run.js', 'if(G.daily)withStream(hashStr(G.daily+\'|F\'', 'if(false)withStream(hashStr(G.daily+\'|F\''),
  M('M75', 'daily', 'Daily combat rolls are not seeded', 'run.js', "rngS=daily?{a:hashStr(daily+'|combat')}:null;", 'rngS=null;'),
  M('M76', 'daily', 'Daily date key is off by one month', 'records.js', 'd.getMonth()+1', 'd.getMonth()'),
  M('M77', 'daily', 'Daily honours the Hard toggle', 'run.js', 'const hard=!opts.daily&&hardOn()', 'const hard=hardOn()'),
  M('M78', 'hard', 'Hard enemies are not tougher', 'mods.js', 'if(G.hard){hp*=H.hpMul;atk*=H.atkMul;}', ''),
  M('M79', 'hard', 'Hard dragon has no extra whelp wave', 'enemies.js', 'function summonList(){return G.hard?', 'function summonList(){return false?'),
  M('M80', 'hard', 'Hard is available before the first win', 'records.js', 'return meta.wins>=1;', 'return meta.wins>=0;'),
  M('M81', 'hard', 'Hard keeps the starting potion', 'run.js', '-(hard?BAL.hard.startPotions:0)', '-0'),
  M('M82', 'hard', 'Hard score is not multiplied', 'records.js', 'Math.round(s*(hard?BAL.hard.scoreMul:1))', 'Math.round(s)'),
  // ---- Auto
  M('M83', 'auto', 'a tap on the map does not stop Auto', 'auto.js', "autoStop('Auto off.');\n if(t===cv)ev.stopPropagation();", 'if(t===cv)ev.stopPropagation();'),
  M('M84', 'auto', 'a tap that stops Auto also moves the player', 'auto.js', 'if(t===cv)ev.stopPropagation();', ''),
  M('M85', 'auto', 'a key press does not stop Auto', 'auto.js', "autoStop('Auto off.');ev.stopPropagation();ev.preventDefault();", 'ev.stopPropagation();ev.preventDefault();'),
  M('M86', 'auto', 'rescheduling Auto does not cancel the previous timer (two timers)', 'auto.js', 'if(AUTO.tm)clearTimeout(AUTO.tm);AUTO.tm=setTimeout(autoTick,ms);', 'AUTO.tm=setTimeout(autoTick,ms);'),
  M('M87', 'auto', 'Auto decisions do not mark the run as an Auto run (full gold)', 'auto.js', 'G.auto.used=1;AUTO.ticks++;', 'AUTO.ticks++;'),
  M('M88', 'auto', 'watchdog: "no progress" check disabled', 'auto.js', 'if(G.turn-AUTO.lastProg>=BAL.auto.stuckTurns)return', 'if(false)return'),
  M('M89', 'auto', 'watchdog: "actions had no effect" check disabled', 'auto.js', 'if(AUTO.idle>=BAL.auto.idleTicks)return', 'if(false)return'),
  M('M90', 'auto', 'a hidden page does not pause Auto', 'auto.js', "function(){if(document.hidden&&AUTO.on)autoStop(", "function(){if(false)autoStop("),
  M('M91', 'auto', 'Auto equips another class\'s off-hand', 'auto.js', "(it.t!=='off'||(OFF[it.k]&&OFF[it.k].cls===p.cls))&&autoGearScore(it.t,it)", 'autoGearScore(it.t,it)'),
  // ---- HUD
  M('M92', 'hud', 'ability button is not disabled without mana', 'hud.js', "if(c.mana&&(p.mana||0)<c.mana)return {dis:1,sub:c.mana+' mana'};", ''),
  M('M93', 'hud', 'Stairs button is enabled away from the stairs', 'hud.js', "bset('b_down','down','Stairs','',!onS);", "bset('b_down','down','Stairs','',false);"),
  M('M94', 'hud', 'Potion button is not disabled with 0 potions', 'hud.js', "bset('b_pot','potion','Potion','×'+inv.pot,inv.pot<=0);", "bset('b_pot','potion','Potion','×'+inv.pot,false);"),
  // ---- declutter pass: Items tray, menu, class pick, gear compare
  M('M98', 'ui', 'Items opens an empty tray instead of saying there is nothing', 'hud.js', "if(n<=0){msg('No items.');render();return;}", ''),
  M('M99', 'ui', 'the Items tray stays open after an item is used', 'hud.js', "el.addEventListener('click',function(){setTray(false);b.fn();});", "el.addEventListener('click',function(){b.fn();});"),
  M('M100', 'ui', 'arming an ability leaves the Items tray open', 'hud.js', 'if((armed||modalOpen())&&trayOpen())setTray(false);', 'if(modalOpen()&&trayOpen())setTray(false);'),
  M('M101', 'ui', 'Items while an ability is armed does not cancel the aim', 'hud.js', 'armed=null;setTray(true);render();}}', 'setTray(true);render();}}'),
  M('M102', 'ui', 'the Items tray is drawn over the map', 'src/styles.css', '#tray{position:absolute;inset:0;', '#tray{position:absolute;left:0;right:0;bottom:0;height:260px;'),
  M('M103', 'ui', 'a tap elsewhere does not close the Items tray', 'hud.js', 'if(!trayOpen())return;const t=ev.target;', 'return;const t=ev.target;'),
  M('M104', 'ui', 'the Items button shows no count', 'hud.js', "bset('b_items','bag','Items',n>0?n:'',n<=0);", "bset('b_items','bag','Items','',n<=0);"),
  M('M105', 'ui', 'the Flames tray button drinks a potion instead', 'hud.js', '{id:\'b_fire\',fn:act(fireball)}', '{id:\'b_fire\',fn:act(drink)}'),
  M('M106', 'ui', 'a class tagline grows into a paragraph', 'content.js', "warrior:'Tough brawler. Wades into packs.'", "warrior:'Tough brawler. Wades into the middle of a pack and builds rage as it hits and is hit, which it spends on its abilities.'"),
  M('M107', 'ui', 'the Hard toggle on the class pick is not saved', 'title.js', 'meta.hardOn=on?0:1;saveMeta();showClassPicker(mode);', 'meta.hardOn=on?0:1;showClassPicker(mode);'),
  M('M108', 'ui', 'the menu has no Auto play button', 'modals.js', "  {k:'auto',label:ic('auto',20)+' Auto play',c:1,fn:function(){closeModal();autoStart();}},\n", ''),
  M('M109', 'ui', 'gear compare colours a gain red and a loss green', 'items.js', "(x[1]>0?'up':'dn')", "(x[1]>0?'dn':'up')"),
  M('M110', 'ui', 'the Details button on a class card starts the run at once', 'title.js', "d.addEventListener('click',function(){showClassDetails(k,mode);});", "d.addEventListener('click',function(){startRun(k,mode);});"),
  // ---- UX pass 2: inspect, ability reasons, danger guard, callouts, banner, help
  M('M111', 'inspect', 'the click after a long-press is not swallowed (a long-press also walks / attacks)', 'input.js', "if(lpDone){lpDone=false;return;}", ''),
  M('M112', 'inspect', 'the long-press timer fires at once (every tap shows a card)', 'balance.js', 'longPressMs:400', 'longPressMs:0'),
  M('M113', 'inspect', 'moving the finger never cancels a long-press', 'inspect.js', 'Math.hypot(ev.clientX-lp.x,ev.clientY-lp.y)>BAL.ui.longPressMove', 'Math.hypot(ev.clientX-lp.x,ev.clientY-lp.y)>9999'),
  M('M114', 'inspect', 'the tap that closes the card also acts as a tap on the map', 'input.js', 'if(insp){clearInspect();if(!armed)return;}', 'if(insp){clearInspect();}'),
  M('M115', 'inspect', 'right-click / contextmenu does not inspect', 'inspect.js', "if(!G||G.over||modalOpen()||performance.now()-lpAt<1500)return;", 'return;'),
  M('M116', 'inspect', 'the card leaves out the foe\'s state (asleep, stunned, shield facing...)', 'inspect.js', "const st=enemyStates(e);if(st.length)L.push(st.join(' · '));", ''),
  M('M117', 'inspect', 'the card leaves out the own-tile buffs', 'inspect.js', "if(G.ppois)b.push('Poisoned '+turns(G.ppois.t));", ''),
  M('M118', 'inspect', 'long-press is ignored while an ability is armed', 'inspect.js', "if(!G||G.over||modalOpen())return false;\n const lines", "if(!G||G.over||modalOpen()||armed)return false;\n const lines"),
  M('M119', 'inspect', 'a long-press while armed fires the ability (the click is not swallowed)', 'inspect.js', "lpDone=true;lpAt=performance.now();", "lpDone=!armed;lpAt=performance.now();"),
  M('M120', 'ui', 'the Guard card line is over the 55 character budget', 'balance.js', "% ranged. Flank it.'", "% ranged. Flank it by stepping behind it.'"),
  M('M121', 'hud', 'a foe in sight but out of range still says no target', 'hud.js', "return {dis:1,sub:!vis.length?'no target':vis.some(e=>manh(e,p)<=R)?'no line':'too far'};}", "return {dis:1,sub:'no target'};}"),
  M('M122', 'hud', 'melee abilities with a distant foe say no target instead of too far', 'hud.js', "advEnemies(true):chebEnemies()).length)return {dis:1,sub:G.enemies.some(e=>G.vis[ix(e.x,e.y)])?'too far':'no target'};", "advEnemies(true):chebEnemies()).length)return {dis:1,sub:'no target'};"),
  M('M123', 'hud', 'a cooldown shows no turns left', 'hud.js', "return {dis:1,sub:ic('hourglass',11)+' '+G.cd[k]};", "return {dis:1,sub:ic('hourglass',11)};"),
  M('M124', 'hud', 'Charge off the line says no target', 'hud.js', "sub:G.enemies.some(e=>G.vis[ix(e.x,e.y)])?'no line':'no target'}", "sub:'no target'}"),
  M('M125', 'guard', 'the first tap on a trap walks onto it', 'walk.js', "if(!(guard&&guard.k===ix(tx,ty)&&guard.f===G.floor&&now<guard.until)){", "if(false){"),
  M('M126', 'guard', 'the danger mark never expires', 'balance.js', 'guardMs:4000', 'guardMs:4e9'),
  M('M127', 'guard', 'revealed traps are not treated as dangerous', 'walk.js', "if(trapSet().has(k))return 'trap';", ''),
  M('M128', 'guard', 'red wind-up tiles are not treated as dangerous', 'walk.js', "if(dangerSet().has(k))return 'danger';", ''),
  M('M129', 'guard', 'a crack about to break is not treated as dangerous', 'walk.js', "if(ix(c.x,c.y)===k&&c.t<=1)return 'danger';", ''),
  M('M130', 'guard', 'a fresh crack (breaks in several turns) is treated as dangerous', 'walk.js', "if(ix(c.x,c.y)===k&&c.t<=1)return 'danger';", "if(ix(c.x,c.y)===k)return 'danger';"),
  M('M131', 'guard', 'the guard does not log a warning', 'walk.js', "msg(pr==='trap'?'Trap: tap again to go.':'Danger: tap again to go.');render();return;}", "render();return;}"),
  M('M132', 'guard', 'a blocked tap-to-walk does not stop in front of the trap', 'walk.js', "if(i>0)startWalk(raw.slice(0,i));else render();return;}", "render();return;}"),
  M('M133', 'guard', 'Explore does not stop in front of a trap that blocks the only way', 'walk.js', "if(i>0){msg('Trap in the way.');startWalk(full.slice(0,i),{explore:true});return;}", ''),
  M('M134', 'guard', 'a confirmed tap on a far trap only walks next to it and never steps on it', 'walk.js', "guard=null;tryMove(tx-G.p.x,ty-G.p.y);}});", "guard=null;}});"),
  M('M135', 'guard', 'tap-to-walk may step through a revealed trap (routing ignores traps)', 'fov.js', "if(k!==goal&&(enemyAt(nx,ny)||G.map[k]===5||merchantAt(nx,ny)||tz.has(k)))continue;", "if(k!==goal&&(enemyAt(nx,ny)||G.map[k]===5||merchantAt(nx,ny)))continue;"),
  M('M136', 'guard', 'Explore may step onto a revealed trap', 'walk.js', "||merchantAt(nx,ny)||tz.has(k)||cz.has(k)||enemyAt(nx,ny)||dz.has(k)||(avoid&&near.has(k)))continue;", "||merchantAt(nx,ny)||cz.has(k)||enemyAt(nx,ny)||dz.has(k)||(avoid&&near.has(k)))continue;"),
  M('M137', 'callout', 'the low-HP callout repeats every turn while low', 'effects.js', "else if(!hpLow&&p.hp>0&&p.hp<p.mhp*U.lowHp){", "else if(p.hp>0&&p.hp<p.mhp*U.lowHp){"),
  M('M138', 'callout', 'the low-HP callout never re-arms after healing', 'effects.js', "if(p.hp>=p.mhp*U.lowHpReset)hpLow=false;", ''),
  M('M139', 'callout', 'the low-HP callout fires at 50% instead of 30%', 'balance.js', 'lowHp:0.3,', 'lowHp:0.5,'),
  M('M140', 'callout', 'callouts stack without a limit', 'effects.js', "if(n>=BAL.ui.calloutMax)return;", ''),
  M('M141', 'callout', 'the elite callout repeats on every look', 'effects.js', "if(!eliteSeen.has(k)){eliteSeen.add(k);", "if(true){eliteSeen.add(k);"),
  M('M142', 'callout', 'boss enrage has no callout', 'enemies.js', "callout(e.x,e.y,'ENRAGED','#f55');", ''),
  M('M143', 'callout', 'opening the vault has no callout', 'walk.js', "callout(nx,ny,'UNLOCKED','#ffd24a');", ''),
  M('M144', 'callout', 'level up has no callout', 'player.js', "callout(p.x,p.y,'LEVEL UP','#ffd24a');", ''),
  M('M145', 'callout', 'picking up the key has no callout', 'items.js', "callout(G.p.x,G.p.y,'KEY','#ffd24a');", ''),
  M('M146', 'callout', 'a callout text is longer than three words', 'player.js', "callout(p.x,p.y,'LEVEL UP','#ffd24a');", "callout(p.x,p.y,'LEVEL UP, WELL DONE HERO','#ffd24a');"),
  M('M147', 'banner', 'a tap does not clear the floor banner', 'input.js', 'bannerUntil=0;                      // any tap clears the floor banner', ''),
  M('M148', 'help', 'the Controls essentials lose the hold-to-inspect line', 'help.js', "'<p><b>Hold</b> (or right-click) a foe, a tile or yourself to inspect it. Tap to close.</p>'+", ''),
  M('M149', 'help', 'Controls sections start expanded', 'help.js', "'<details class=\"hsec\">", "'<details class=\"hsec\" open>"),
  // ---- build
  M('M95', 'build', 'index.html is stale (src changed, build not re-run)', 'balance.js', 'run: { winBonus: 150 }', 'run: { winBonus: 151 }', { rebuild: false }),
  M('M96', 'build', 'an external stylesheet sneaks into the template', 'src/index.template.html', '<title>Depths of Emberfall</title>', '<title>Depths of Emberfall</title><link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Cinzel">'),
  M('M97', 'build', 'an external request sneaks into the game code', 'main.js', 'resize();\nshowTitle();', "resize();\ntry{new Image().src='https://example.com/t.gif';}catch(e){}\nshowTitle();"),
];

// ---------------------------------------------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const srcPath = (m) => (m.file.startsWith('src/') || m.file === 'index.html' ? m.file : 'src/js/' + m.file);

function fingerprint() {
  const h = crypto.createHash('sha256');
  const walk = (d) => { for (const n of fs.readdirSync(d).sort()) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) walk(p); else { h.update(p); h.update(fs.readFileSync(p)); } } };
  walk(path.join(ROOT, 'src')); h.update(fs.readFileSync(path.join(ROOT, 'build.js'))); h.update(fs.readFileSync(path.join(ROOT, 'index.html')));
  return h.digest('hex');
}

function applyTo(text, m) {
  const parts = text.split(m.find);
  if (parts.length !== 2) return { err: parts.length === 1 ? 'find string not found' : 'find string occurs ' + (parts.length - 1) + ' times' };
  const out = parts[0] + m.repl + parts[1];
  return out === text ? { err: 'mutation changes nothing' } : { out };
}

function validate() {
  let bad = 0;
  const ids = new Set();
  for (const m of MUTATIONS) {
    if (ids.has(m.id)) { console.log('DUPLICATE ID ' + m.id); bad++; } ids.add(m.id);
    const r = applyTo(fs.readFileSync(path.join(ROOT, srcPath(m)), 'utf8'), m);
    if (r.err) { console.log('INVALID ' + m.id + ' (' + srcPath(m) + '): ' + r.err); bad++; }
  }
  return bad;
}

function runSuite(dir, all, only) {
  return new Promise((resolve) => {
    const args = [path.join(dir, 'tests', 'run.js')].concat(all ? [] : ['--bail'], only || []);
    const child = spawn(process.execPath, args, { cwd: dir, env: Object.assign({}, process.env, { QUIET_FAILS: '1' }), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), 8 * 60 * 1000);
    child.on('close', (code) => {
      clearTimeout(timer);
      const fails = [...out.matchAll(/^FAILED: (.+)$/gm)].map((m) => m[1]);
      resolve({ code, fails, out });
    });
  });
}

const sandboxes = [];
function makeSandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emberfall-mut-'));
  sandboxes.push(dir);
  for (const n of ['build.js', 'index.html', 'package.json']) if (fs.existsSync(path.join(ROOT, n))) fs.copyFileSync(path.join(ROOT, n), path.join(dir, n));
  fs.cpSync(path.join(ROOT, 'src'), path.join(dir, 'src'), { recursive: true });
  fs.cpSync(TESTS_DIR, path.join(dir, 'tests'), { recursive: true });
  return dir;
}
function cleanup() { for (const d of sandboxes.splice(0)) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* best effort */ } } }
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { cleanup(); process.exit(130); });
process.on('uncaughtException', (e) => { console.error(e); cleanup(); process.exit(2); });

const RECHECK = arg('--recheck') ? Object.fromEntries(JSON.parse(fs.readFileSync(arg('--recheck'), 'utf8')).filter((r) => r.status === 'KILLED').map((r) => [r.id, [...new Set(r.by.map((b) => b.split(' :: ')[0]).filter((f) => /\.test\.js$/.test(f)).map((f) => f.replace('.test.js', '')))]])) : null;

async function runOne(dir, m, all) {
  const t0 = Date.now(), rel = srcPath(m), file = path.join(dir, rel), pristine = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const r = applyTo(pristine, m);
  if (r.err) return Object.assign({ status: 'INVALID', note: r.err }, { ms: 0 });
  try {
    fs.writeFileSync(file, r.out);
    if (m.rebuild !== false) {
      try { execFileSync(process.execPath, [path.join(dir, 'build.js')], { cwd: dir, stdio: 'pipe' }); }
      catch (e) { return { status: 'INVALID', note: 'build failed: ' + String(e.stderr || e.message).split('\n')[0], ms: Date.now() - t0 }; }
    }
    if (RECHECK) {
      const res = await runSuite(dir, false, RECHECK[m.id]);
      return { status: res.code === 0 ? 'FLAKY' : 'KILLED', by: res.fails, ms: Date.now() - t0, note: res.code === 0 ? 'killing test(s) pass on the re-run' : '' };
    }
    const res = await runSuite(dir, all);
    let status = res.code === 0 ? 'SURVIVED' : 'KILLED', note = res.code !== 0 && !res.fails.length ? res.out.split('\n').slice(-5).join(' | ') : '';
    if (status === 'KILLED' && !has('--no-confirm')) {      // a kill must reproduce: run just the failing file(s) once more
      const files = [...new Set(res.fails.map((f) => f.split(' :: ')[0]).filter((f) => /\.test\.js$/.test(f)))].map((f) => f.replace('.test.js', ''));
      const again = await runSuite(dir, false, files);
      if (again.code === 0) { status = 'FLAKY'; note = 'failed once (' + files.join(',') + ') but passed on the re-run'; }
    }
    return { status, by: res.fails, ms: Date.now() - t0, note };
  } finally {
    fs.writeFileSync(file, pristine);                                            // sandbox only; back to pristine for the next mutation
    fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(dir, 'index.html'));
  }
}

async function main() {
  const bad = validate();
  if (bad) { console.log(bad + ' broken mutation(s): fix the list'); process.exit(2); }
  if (has('--check')) { console.log('all ' + MUTATIONS.length + ' mutations apply cleanly'); return; }

  const only = (arg('--only') || '').split(',').filter(Boolean);
  const list = MUTATIONS.filter((m) => (!only.length || only.some((o) => o === m.id || o === m.area)) && (!RECHECK || RECHECK[m.id]));
  const all = has('--all'), jobs = Math.max(1, +arg('--jobs') || 1);
  const before = fingerprint(), t0 = Date.now();
  console.log('running ' + list.length + ' mutations' + (all ? ' (full suite each)' : ' (stop at first failure)') + ', ' + jobs + ' at a time');

  const results = new Array(list.length);
  let next = 0;
  const worker = async () => {
    const dir = makeSandbox();
    while (next < list.length) {
      const i = next++, m = list[i];
      const r = await runOne(dir, m, all);
      results[i] = Object.assign({ id: m.id, area: m.area, desc: m.desc }, r);
      const by = r.by && r.by.length ? ' <- ' + r.by.slice(0, all ? 1 : 1).join(' ; ').slice(0, 130) + (all && r.by.length > 1 ? ' (+' + (r.by.length - 1) + ' more)' : '') : r.note ? ' (' + r.note + ')' : '';
      console.log(r.status.padEnd(9) + m.id + ' ' + m.desc + by + '  [' + (r.ms / 1000).toFixed(0) + 's]');
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, list.length) }, worker));

  const killed = results.filter((r) => r.status === 'KILLED').length, survived = results.filter((r) => r.status === 'SURVIVED' || r.status === 'FLAKY');
  const invalid = results.filter((r) => r.status === 'INVALID');
  console.log('\nKILLED ' + killed + '/' + results.length + ' (' + Math.round(100 * killed / results.length) + '%)  survived ' + survived.length + '  invalid ' + invalid.length + '  in ' + Math.round((Date.now() - t0) / 1000) + 's');
  for (const r of survived) console.log('  ' + r.status + ' ' + r.id + ' [' + r.area + '] ' + r.desc);
  if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(results, null, 1));
  const after = fingerprint();
  if (before !== after) { console.log('!! src/ changed while the mutation run was going - this must never happen'); process.exit(2); }
  process.exit(invalid.length ? 2 : survived.length ? 1 : 0);
}
main();
