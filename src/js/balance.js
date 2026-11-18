// balance.js - every tunable game number: scalar knobs in BAL plus the enemy, class, perk, synergy,
// gear-trait, unlock and shop tables. A balance pass should only need to touch this file.

const W=30,H=30,MAXF=8;   // map size and number of floors (floor 8 = dragon lair)

// ===== BAL: scalar balance knobs, grouped by system. Expressions in the code are unchanged; only literals moved here. =====
// NOTE: descriptive strings in the tables below (perk/trait/unlock text, help screen) still contain hand-written copies of
// some numbers - update them together when changing a value.
const BAL = {
 ui:{lowHp:0.3,lowHpReset:0.4,longPressMs:400,longPressMove:10,calloutMs:1000,calloutMax:2,guardMs:4000,modalGraceMs:400,staleMs:350,burstMs:900,camMinTs:22},   // UI only (no rules): low-HP callout, long-press inspect, danger-guard confirm window; modalGraceMs = a dialog opened by a game event ignores real taps this long (and any tap that began before it); staleMs = a tap on the tile a foe left / died on in the turn just resolved does nothing for this long; burstMs = repeat taps on the tile of the previous tap's target do nothing once it is empty, for this long after the last one; camMinTs = smallest tile size when the camera zooms out to frame targets
  // --- dungeon layout (mapgen.js) ---
  map: {
    span: 22,              // rooms are placed inside the top-left span x span corner of the 30x30 grid (shorter floors)
    attempts: 50,          // full regenerations before the open-room fallback
    roomTries: 80,         // room placement tries per attempt
    maxRooms: 4, minRooms: 3,
    roomMinW: 4, roomMaxW: 8, roomMinH: 4, roomMaxH: 7,
    bossRoomW: 11, bossRoomH: 9,
    caveFrom: 4, caveTo: 6,        // floors that may have cave-like rooms
    caveChance: 0.75, caveRingWall: 0.5, caveInnerWall: 0.1,
    doorChance: 0.6        // chance a doorway-shaped corridor tile becomes a door
  },
  vis: { radius: 7, trapfinderRange: 3 },   // sight radius; Trapfinder trap-reveal range (normal range is 1)
  // --- floor population (run.js) ---
  floor: { treasureFrom: 2, treasureChance: 0.7, shrineFrom: 2, shrineChance: 0.55 },
  enemy: {
    hpPerFloor: 0.78, atkPerFloor: 0.73,        // +78% / +73% of base per floor above 1
    rangedHpFactor: 0.6, rangedAtkFactor: 0.7,  // ranged enemies scale slower
    early: [1, 0.92, 0.9, 0.93],                        // extra hp / attack multiplier on floors 1-4 (a smoother start; rewards are untouched, so levels and gold keep pace)
    eliteHpMul: 2, eliteAtkMul: 1.2, eliteAtkAdd: 1
  },
  spawn: {
    enemyBase: 5, enemyPerFloor: 1.0, enemyExtraMax: 2, ratLastFloor: 5,
    earlyCut: [2, 1],         // fewer enemy groups on floors 1 and 2 (later floors are untouched, so XP and gold keep their pace)
    goldPiles: 3, goldMin: 3, goldMax: 6, goldPerFloor: 2,
    extraPotionChance: 0.4,
    weaponChance: 0.5, weaponMin: 1, weaponMax: 2, weaponPerFloor: 0.7,
    armorChance: 0.5, armorRand: 2, armorDiv: 2, armorBase: 1,
    fireChance: 0.5, teleChance: 0.35
  },
  treasure: { gearSlots: ['weapon', 'weapon', 'armor', 'armor', 'off', 'charm'], gold1Base: 12, gold1PerFloor: 4, gold2Base: 10, gold2PerFloor: 3, potionChance: 0.6 },
  forcedGear: {                 // trait gear in treasure rooms / merchant
    minTraitFloor: 2, weaponMin: 2, weaponMax: 3, weaponPerFloor: 0.7,
    armorRandMin: 1, armorRandMax: 3, armorDiv: 2, armorBase: 1
  },
  trap: {
    countMin: 1, countMax: 2, floorsPerExtra: 2, minDistFromStart: 4,
    spikeBelow: 0.45, dartBelow: 0.75, dartOnlyBelowFloor: 2,   // roll < spikeBelow: spike; < dartBelow (or floor < dartOnlyBelowFloor): dart; else alarm
    spikeBase: 3,                                               // spike damage = spikeBase + floor
    dartEnemyTurns: 4, dartEnemyDmg: 2,
    dartTurns: 4, dartTurnsTrapfinder: 2, dartDmgBase: 1, dartDmgFloorDiv: 3
  },
  // --- gear traits (items.js; the trait table itself is TR below) ---
  trait: {
    chanceBase: 0.2, chancePerFloor: 0.07, chanceCap: 0.65,   // chance a dropped weapon/armor has a trait
    keenCrit: 0.15, brutalCrit: -0.1, vampLife: 0.25, lightDodge: 0.12,
    spikedThorns: 3, spikedAtk: -1, cursedDrain: 1, heavyEvery: 4
  },
  gear: { offChance: 0.18, charmChance: 0.2, tierDiv: 2 },   // floor drop chances for an off-hand (own class) / a charm; weapon tier = floor(v/tierDiv)
  item: { weakSaleBase: 3 },    // weak plain gear is sold for (weakSaleBase + floor) gold
  potion: { minHeal: 12, healFrac: 0.4, sageBonus: 0.5, leadenMul: 0.6 },
  fireball: { base: 10, perFloor: 3 },   // the Flame SCROLL item (hits everything in sight); the mage's Fireball spell is BAL.ability.fire
  teleport: { minDist: 8 },
  // --- combat core (combat.js) ---
  combat: { critMul: 2, sneakMul: 2, dmgVar: 1, enemyDmgVar: 1, armorK: 12, dodgeCap: 0.75, knockBase: 3, knockFloorDiv: 2 },
  drops: { potionChance: 0.08, goldChance: 0.3, goldMin: 2, goldMax: 5, midasMin: 3, midasMax: 6, midasPerFloor: 2, scavChance: 0.2 },
  perk: {
    venomBase: 1, venomTurns: 3,
    execBase: 0.2, execBlood: 0.3,
    chainBase: 4, chainPerFloor: 2, chainRange: 8,
    berserkMax: 0.8, bloodFrenzyMul: 2, bloodFrenzyHp: 0.5, bloodlustMul: 1.75,
    riposteChance: 0.2, phoenixFrac: 0.5,
    furyMul: 0.4, retribHits: 2, retribReflect: 1, stampedeCost: 10,
    arcanaSpell: 0.25, wellMana: 10, wellKill: 2, freezeExtra: 2, phaseCost: 3, tempoCut: 1, pyroFire: 0.4,
    assassinMul: 0.5, assassinCd: 2, bandoMax: 3, shadowCd: 3, shadowTurns: 2, bloodRageMul: 2,
    stalkerMul: 0.4, warcryStun: 1, frostbiteMul: 0.5, lacerateBase: 2, lacerateTurns: 3
  },
  player: { regenEvery: 5, baseRegenEvery: 16, potCap: 3 },
  xp: { base: 12, perLevel: 11 },           // XP to next level = base + perLevel * level
  // --- enemy AI (enemies.js) ---
  enemyAi: {
    sightRange: 9, loseTrackDist: 14,
    smashCooldown: 2, breathCooldown: 2, defaultWindMul: 2, breathRange: 7, breathLength: 8,
    fleeSteps: 2, tiredTurns: 3,
    healEvery: 3, healFrac: 0.35, healBelow: 0.75, healRange: 8,   // Cultist: heals a hurt ally instead of attacking
    lungeEvery: 3,                 // goblins/skeletons (EN lunge:true) take an extra step every Nth turn while chasing: a kiter cannot back away forever
    enrageFrac: 0.5, enrageAtkMul: 1.5, enrageBreathCd: 2,  // boss below this HP fraction: hits harder, breathes more often
    sweepMul: 1.2, sweepCd: 3,                              // enraged dragon: telegraphed tail sweep over the 8 tiles around it
    summonAt: [0.75, 0.5, 0.25], summonN: 4                      // dragon calls whelps when its HP first drops below each fraction
  },
  // --- resources (combat.js endTurn) ---
  rage: { max: 100, dealt: 8, taken: 12, decay: 4 },    // warrior: +dealt per melee hit landed, +taken per hit suffered; -decay per turn with no awake enemy in sight
  mana: { regen: 1.25, perKill: 3 },                       // mage: base pool lives in CLS.mage.mana; regen per turn (accumulates fractions) and per kill
  // --- active abilities (abilities.js). cost = resource spent; cd = turns before reuse (0 = none) ---
  ability: {
    bash:     { cd: 6, stun: 2, stunBoss: 1, mul: 1.0 },
    cleave:   { rage: 30, mul: 1.0, cd: 0 },
    charge:   { rage: 15, cd: 2, minDist: 2, maxDist: 6, mul: 0.8, stun: 2, stunBoss: 1 },
    brace:    { rage: 35, cd: 0, hits: 3, turns: 6, reduce: 0.5, reflect: 0.5 },
    bolt:     { mana: 7, cd: 0, mul: 1.3, add: 1, range: 8 },
    nova:     { mana: 7, cd: 2, freeze: 3, freezeBoss: 1, mul: 0.6 },
    blink:    { mana: 4, cd: 2, range: 5 },
    fire:     { mana: 13, cd: 0, base: 10, perFloor: 3, range: 7, radius: 1 },
    backstab: { cd: 5, mul: 2.4, weakMul: 0.5 },
    vanish:   { cd: 10, turns: 3 },
    knife:    { cd: 0, max: 4, mul: 0.7, add: 1, range: 6 },
    smoke:    { cd: 14, range: 5, radius: 1, turns: 4, blindTurns: 3, miss: 0.75 }   // radius 1 = 3x3 cloud; blindTurns = how long enemies stay blind after impact
  },
  // --- off-hand and charm numbers (items.js, abilities.js) ---
  offhand: {
    towerLine: 3,                         // Tower Shield: Bash hits this many tiles in a line
    bulwarkHits: 2, bulwarkReflect: 1,    // Iron Bulwark: Brace blocks +hits and reflects this fraction
    totemRage: 6,                         // Blood Totem: Cleave refunds this much rage per enemy hit
    tomeBurnTurns: 3, tomeBurnBase: 2, tomeBurnFloorDiv: 3,   // Tome: Nova also burns
    prismRadius: 1, prismMul: 0.8,        // Prism: Fireball radius +, but damage multiplied
    lensPierce: 2,                        // Lens: Bolt also hits this many extra enemies behind the target in line
    dagger2Frac: 0.6,                     // Second dagger: Backstab strikes twice, the second hit at this fraction
    satchelRadius: 1, satchelTurns: 2,    // Alchemist satchel: Smoke Bomb radius + and turns +
    quiverKnives: 3,                      // Quiver: +knives
    bannerFrac: 0.6,                      // War Banner: Cleave strikes twice, the second hit at this fraction
    gauntletRange: 2,                     // Ram Gauntlet: Charge reaches this much further (and slams the foe back)
    shardMul: 0.5,                        // Mirror Shard: Blink scorches foes next to where you stood, this share of Fireball damage
    focusMul: 2,                          // Focus Crystal: Bolt damage vs stunned or frozen foes
    caltropStun: 2                        // Caltrops: Smoke stuns foes inside this many turns
  },
  charm: { fangHeal: 3, fangFloorDiv: 2, veilSight: 3, soulRage: 12, soulMana: 5, hourglassEvery: 2,
           gildedPer: 4, frenzyMax: 4, lastBelow: 0.3, lastHeal: 0.35, aegisCap: 0.3, cinderBase: 3, cinderFloorDiv: 2 },
  weapon: { shieldFront: 0.4, shieldRanged: 0.5, viperDmg: 2, viperTurns: 3, rapierCounter: 0.25 },   // shielded enemies: damage multipliers (front melee / any ranged hit); stunned or frozen = no guard
  // --- floor features (features.js) ---
  merchant: {
    floors: [3, 6], gearSlots: ['weapon', 'weapon', 'armor', 'armor', 'off', 'charm'], elixirHp: 10,   // gearSlots: one stocked per visit, drawn from this list (repeat = likelier)
    price: { potion: [12, 2], fire: [22, 3], tele: [18, 2], gear: [40, 8], perk: [60, 10], elixir: [65, 8] }   // [base, per floor]
  },
  shrine: { healBase: 0.6, healBetter: 0.75, lossBase: 0.25, lossBetter: 0.15, sacrificeGold: 30, pactHp: 8, pactMinHp: 10, pactAtk: 3, blessHeal: 0.3 },
  // --- permanent progression (save.js, run.js) ---
  meta: { startScrollFireChance: 0.5 },
  // --- permanent upgrades (UPG / PAIRS below, idle.js). price of level l+1 (l owned) = base*(l+1)*(1+l*rise), the old shop curve. A pair's variant can be swapped for switchFee once the pair has a level.
  // legacy = what one level of each of the old flat boosts gave (migration keeps an old save's stats exactly, see save.js).
  upg: { rise: 0.3, switchFee: 50, legacy: { hp: 8, atk: 1, def: 1, pot: 1, goldp: 15 } },
  run: { winBonus: 150 },
  // --- Auto (autopilot, auto.js). Deliberately a simple player: no kiting, no retreating to regenerate ---
  auto: {
    // Auto no longer banks run gold: the time it plays (real ms, or virtual ms in the simulator) is paid at the 30-minute expedition rate (BAL.exp, EXP_TABLE).
    // A run that was only partly Auto keeps its manual share of the run gold. Heat multiplies both.
    tickMs: 250,                  // 1x = one decision per tick = 4 turns per second; speeds below divide this
    speeds: [1, 2, 4],
    flashMs: 400,                 // an Auto-resolved dialog stays on screen this long at 1x so a watcher sees the choice
    potionHp: 0.35,               // drink a potion below this share of max HP
    scrollHp: 0.4,                // teleport scroll when surrounded and below this share of max HP with no potion
    branchHp: 0.8,                // take a rewarding floor modifier only at or above this share of max HP
    blinkHp: 0.5,                 // mage: Blink out when 3+ enemies are adjacent and HP is below this share
    vanishHp: 0.5,                // rogue: Vanish when surrounded and HP is below this share
    braceHp: 0.7,                 // warrior: Brace when 2+ enemies are adjacent and HP is below this share
    hold: 3,                      // melee foes in sight: wait this many turns for them to come, then close in
    sleeperHp: 0.55, sleeperEliteHp: 0.75,   // walk up to a sleeping enemy and strike first only at or above this share of max HP
    surround: 2,                  // this many adjacent enemies = "surrounded" (area ability / stun / freeze)
    gearMargin: 0.5,              // equip only if the simple score beats the current item by this much
    keyDist: 25,                  // go to the locked treasure door only if it is at most this many steps away
    lootDist: 40,                 // pick up items at most this many steps away
    hysteresis: 10,               // a goal Auto is already walking to is kept this many steps beyond keyDist / lootDist (stops flip-flopping at the border)
    stuckTurns: 150,              // watchdog: no new tile, no damage dealt and no floor change for this many turns -> Auto switches off
    idleTicks: 12                 // watchdog: this many decisions in a row that used no turn and resolved no dialog -> Auto switches off
  },
  // --- floor modifiers (mods.js). chance = per exit option; each modifier's numbers live here, its text in MODS below ---
  mod: {
    chance: 0.5,
    dark:     { sight: 4, extraGold: 3, extraPotions: 0, gearChance: 0.5 },
    flooded:  { poolMin: 5, poolMax: 9, extraGold: 2 },                 // water: the player's step lets enemies act once more; an enemy entering water loses its next action
    cursed:   { potionMul: 0.6 },                                        // no natural regeneration; potions heal this fraction; the floor always has a shrine (with the safe blessing)
    horde:    { countMul: 1.6, hpMul: 0.75, atkMul: 0.8, maxHp: 15, xpMul: 0.6, goldDrop: 0.45 },   // maxHp: enemy types above this base HP do not appear
    hunted:   { minFloor: 3, hpMul: 2.2, atkMul: 1.25, rewardGold: 14, rewardGoldPerFloor: 5, xpMul: 3 },
    rich:     { goldMul: 2, hpMul: 1.15, atkMul: 1.1, extraGold: 2 },
    silent:   { sight: 4, sneakMul: 2, trapMul: 2, alarmShare: 0.5 },
    unstable: { every: 4, count: 2, onPlayer: 0.35, radius: 5, warn: 2, dmgBase: 3, dmgFloorDiv: 2, enemyMul: 2, extraGear: 1, extraGold: 1 }
  },
  // --- run score, shown on the recap and kept in the records (records.js) ---
  score: { floor: 100, kill: 2, level: 15, win: 600, par: 1500, perTurn: 0.3 },   // + win bonus and 'perTurn' for every turn under 'par'
  // --- Hard mode (unlocked by the first win): a stack of named rules, see HARD_RULES ---
  hard: { hpMul: 1.25, atkMul: 1.2, bossAtkMul: 1.1, startPotions: 1, bonusPotion: 0, dropPotionMul: 0.5, extraSummonAt: 0.9, enrageFrac: 0.6, goldMul: 1.5, scoreMul: 1.5 },
  // --- Heat 0-5 (HEAT below). Heat 1 is exactly Hard (BAL.hard); each further level adds one rule. gold / score multipliers per level ---
  heat: { max: 5, goldMul: [1, 1.5, 1.75, 2, 2.25, 2.5], scoreMul: [1, 1.5, 1.75, 2, 2.25, 2.5],
          extraFoes: 2,                  // Heat 2: more foes on every floor
          eliteHpMul: 1.6, eliteAtkMul: 1.3,   // Heat 3: the key-carrying elite
          potionMul: 0.7,                // Heat 4: potions heal this fraction
          enrageFrac: 0.8, breathCut: 1 },     // Heat 5: the dragon enrages at this HP share and its breath comes this many turns sooner
  // --- expeditions (idle.js): the hero is away up to capMin minutes; every delveMin minutes it makes one delve whose outcome is drawn from EXP_TABLE.
  // rate = share of the manual gold per hour (bot play at the same upgrade power, ~turnSec per human turn) the expedition pays; 30 min is the best rate, 8 h the best total.
  exp: { capMin: 480, delveMin: 10, turnSec: 1.2, secondSlot: 500, bpChance: 0.04, bpMinFloor: 3,
         durs: [{ min: 30, n: '30 min', rate: 0.33, hint: 'Best rate' }, { min: 120, n: '2 hours', rate: 0.30, hint: '' }, { min: 480, n: '8 hours', rate: 0.25, hint: 'Best total' }] },
  // --- blueprints (idle.js): found in expeditions (tier c), deep manual runs (r, floor deepFrom+), the dragon / Heat 1+ runs (b); then bought with gold
  bp: { cost: { c: 80, r: 200, b: 450 }, deepFrom: 5, deepChance: 0.3, bestWin: 0.5, bestHeat: 0.15, bestHeatWin: 0.9 },
  ach: { kills: 200, elites: 10, streak: 3, dailyDays: 3, hoard: 200, fastTurns: 1000, noArmorFloor: 5 }
};

// ===== Tables: enemies, perks, synergies, classes, gear traits, traps, shop, unlocks =====
// ===== Permanent upgrades (bought with banked gold on the title screen). steps = [[levels, gain per level], ...]: the first levels of the five old boosts are exactly
// the old ones (Hardy 1-5, Sharpened / Padded 1-3, Supplies 1-2), the later levels give much less (diminishing returns); int = whole numbers (half levels round). pct = a percentage. =====
const UPG=[
 {k:'hp',n:'Hardy',base:30,u:' HP',steps:[[5,8],[3,1.5]],int:1},
 {k:'atk',n:'Sharpened',base:55,u:' attack',steps:[[3,1],[1,0.5]],int:1},
 {k:'def',n:'Padded',base:70,u:' defense',steps:[[3,1],[1,0.5]],int:1},
 {k:'pot',n:'Supplies',base:40,u:' potion',steps:[[2,1]],int:1},
 {k:'goldp',n:'Greed',base:50,u:'% gold',steps:[[4,10],[2,5]],pct:1},
 {k:'xpf',n:'Insight',base:45,u:'% XP',steps:[[3,2]],pct:1}
];
function upMax(u){return u.max||u.steps.reduce((a,s)=>a+s[0],0);}
function upVal(u,l){let v=0,r=l;for(const s of u.steps){const t=Math.min(r,s[0]);v+=t*s[1];r-=t;if(r<=0)break;}return v;}
function upCost(u,l){return Math.round(u.base*(l+1)*(1+l*BAL.upg.rise));}
// either / or pairs: one shared level counter, the chosen variant decides what each level gives. f(p, l, G) applies it at the start of a run.
const PAIRS=[
 {k:'edge',n:'Edge',base:60,max:3,v:[
  {id:'keen',n:'Keen',d:l=>'+'+l+'% crit',f:(p,l)=>{p.crit+=0.01*l;}},
  {id:'vicious',n:'Vicious',d:l=>'+'+(1.5*l)+'% damage',f:(p,l)=>{p.dmgMul=1+0.015*l;}}]},
 {k:'vigor',n:'Vigor',base:60,max:3,v:[
  {id:'regrow',n:'Regrowth',d:l=>'heal '+(1.5*l)+'% HP on each new floor',f:(p,l)=>{p.renew+=0.015*l;}},
  {id:'drink',n:'Lifedrinker',d:l=>'heal '+l+'% of damage dealt',f:(p,l)=>{p.life+=0.01*l;}}]},
 {k:'prep',n:'Scrolls',base:70,max:1,v:[
  {id:'flames',n:'Flames',d:l=>'+'+l+' starting Flames',f:(p,l,g)=>{g.inv.fire+=l;}},
  {id:'tele',n:'Teleport',d:l=>'+'+l+' starting Teleport',f:(p,l,g)=>{g.inv.tele+=l;}}]}
];
const UNLOCKS=[
 {id:'rogue',n:'Rogue class',d:'Backstab, Vanish, Knife, Smoke. Cooldown based.',cost:150},
 {id:'mage',n:'Mage class',d:'Bolt, Nova, Blink, Fireball. Runs on mana.',cost:200},
 {id:'warlord',n:'Perk: Warlord',d:'Adds Warlord to level-ups.',cost:180},
 {id:'elixir',n:'Merchant: Elixir',d:'Merchants sell an Elixir (+'+BAL.merchant.elixirHp+' max HP, full heal).',cost:110},
 {id:'scroll',n:'Starting scroll',d:'Start each run with a random scroll.',cost:90},
 {id:'pick4',n:'Fourth choice',d:'Level-ups offer 4 perks, not 3.',cost:220},
 {id:'shrine',n:'Shrine favour',d:'Shrines offer a safe Blessing; better prayer odds.',cost:110},
 {id:'phoenix',n:'Perk: Phoenix Heart',d:'Adds Phoenix Heart to level-ups.',ach:'Defeat the dragon',chk:function(){return meta.wins>=1;},prog:function(){return meta.wins+'/1 wins';}},
 {id:'trapper',n:'Perk: Trapfinder',d:'Adds Trapfinder to level-ups.',ach:'Reach floor 4',chk:function(){return meta.best>=4;},prog:function(){return 'best floor '+meta.best+'/4';}},
 {id:'midas',n:'Perk: Midas Touch',d:'Adds Midas Touch to level-ups.',ach:'Slay 50 enemies in total',chk:function(){return meta.kills>=50;},prog:function(){return meta.kills+'/50 kills';}},
 {id:'sage',n:'Perk: Alchemist',d:'Adds Alchemist to level-ups.',ach:'Slay an elite enemy',chk:function(){return meta.elites>=1;},prog:function(){return meta.elites+'/1 elites';}}
];
const EN={
 rat:{n:'Rat',e:'rat',hp:6,atk:2,speed:2,pack:true,group:[2,3],w:2,maxF:BAL.spawn.ratLastFloor,xp:5,minF:1,tr:'Packs of fast biters. Area attacks shred them.'},
 goblin:{n:'Goblin',e:'goblin',hp:10,atk:3,lunge:true,xp:5,minF:1,tr:'Plain brute; lunges to keep up with you.'},
 archer:{n:'Archer',e:'archer',hp:8,atk:4,range:6,cdmax:2,kite:true,xp:6,minF:2,tr:'Shoots from 6 tiles with a clear line; keeps away.'},
 hound:{n:'Hound',e:'hound',hp:12,atk:4,speed:2,xp:7,minF:3,tr:'Moves twice per turn. Fight it in melee or stun it.'},
 guard:{n:'Guard',e:'guard',hp:20,atk:5,shield:true,xp:10,minF:4,tr:'Shield blocks front hits and shots. Flank or stun it.'},
 skeleton:{n:'Skeleton',e:'skeleton',hp:15,atk:5,lunge:true,xp:8,minF:3,tr:'Tough melee fighter; lunges like the goblin.'},
 ogre:{n:'Ogre',e:'ogre',hp:26,atk:8,slowAct:true,xp:13,minF:4,tr:'Acts every other turn, hits hard. Hourglass: resting.'},
 troll:{n:'Troll',e:'troll',hp:34,atk:7,slow:true,wind:true,windMul:2,windMsg:'The Troll raises its club!',xp:16,minF:4,tr:'Slow and sturdy. Winds up a smash (red tiles).'},
 cultist:{n:'Cultist',e:'cultist',hp:14,atk:5,range:6,cdmax:2,kite:true,heal:true,xp:12,minF:4,tr:'Heals allies, else blasts from 6 tiles. Kill first.'},
 bat:{n:'Bat',e:'bat',hp:5,atk:3,speed:2,pack:true,group:[4,6],w:2,xp:3,minF:5,tr:'Flock of fragile, fast biters. Use area attacks.'},
 warlock:{n:'Warlock',e:'warlock',hp:10,atk:6,range:6,cdmax:2,kite:true,xp:12,minF:5,tr:'Casts from 6 tiles with a clear line; keeps away.'},
 whelp:{n:'Whelp',e:'whelp',hp:16,atk:8,speed:2,pack:true,flat:true,xp:2,minF:99,tr:'Fast, fragile dragon spawn.'},
 dragon:{n:'Dragon',e:'dragon',hp:1500,atk:58,breath:true,sweep:true,windMul:2,windMsg:'The Dragon rears back, flames gathering!',xp:100,minF:99,boss:true,tr:'Boss: breath (red tiles), whelps at '+BAL.enemyAi.summonAt.map(x=>Math.round(x*100)+'%').join('/')+' HP.'}
};
// perk fields: cls = only offered to that class; beh = behaviour (no stat change); max = levels. f(p) applies stat effects.
const PERKS=[
 {id:'vit',n:'Vitality',d:'+12 max HP and heal 12',f:p=>{p.mhp+=12;p.hp=Math.min(p.mhp,p.hp+12);}},
 {id:'might',n:'Might',d:'+2 attack',f:p=>{p.atk+=2;}},
 {id:'bul',n:'Bulwark',d:'+1 defense',f:p=>{p.def+=1;}},
 {id:'vamp',n:'Vampirism',d:'Heal 10% of damage dealt',f:p=>{p.life+=0.1;}},
 {id:'keen',n:'Keen Eye',d:'+12% crit chance',f:p=>{p.crit+=0.12;}},
 {id:'renew',n:'Renewal',d:'Heal 30% HP on each new floor',f:p=>{p.renew+=0.3;}},
 {id:'thorns',n:'Thorns',d:'Melee attackers take 2 damage',f:p=>{p.thorns+=2;}},
 {id:'pockets',n:'Deep Pockets',d:'+2 potion capacity',f:p=>{p.potCap+=2;}},
 {id:'evade',n:'Evasion',d:'+8% dodge',f:p=>{p.dodge+=0.08;}},
 {id:'scholar',n:'Scholar',d:'+30% XP',f:p=>{p.xpMul+=0.3;}},
 {id:'pyro',n:'Pyromancer',d:'Flames and Fireball +'+Math.round(BAL.perk.pyroFire*100)+'% damage; +1 Flames',f:p=>{p.fireMul+=BAL.perk.pyroFire;G.inv.fire++;}},
 {id:'regen',n:'Regeneration',d:'+1 HP every 5 turns',f:p=>{p.regen+=1;}},
 {id:'treasure',n:'Treasure Hunter',d:'+25% gold',f:p=>{p.goldMul+=0.25;}},
 {id:'tempo',n:'Tempo',d:'Ability cooldowns '+BAL.perk.tempoCut+' turn shorter',beh:1},
 // behaviour perks
 {id:'venom',n:'Venom',beh:1,max:3,d:'Hits poison for 3 turns; +1 damage per level'},
 {id:'chain',n:'Chain Lightning',beh:1,d:'Kills zap the nearest visible foe'},
 {id:'blood',n:'Bloodlust',beh:1,d:'After a kill, your next hit deals +75%'},
 {id:'riposte',n:'Riposte',beh:1,max:3,d:'20% per level to counter melee hits'},
 {id:'second',n:'Second Wind',beh:1,d:'Once per floor, a lethal hit leaves 1 HP'},
 {id:'glass',n:'Glass Cannon',beh:1,d:'+5 attack, -25% max HP',f:p=>{p.atk+=5;p.mhp=Math.max(8,Math.round(p.mhp*0.75));p.hp=Math.min(p.hp,p.mhp);}},
 {id:'scav',n:'Scavenger',beh:1,max:2,d:'20% per level: kills drop a potion'},
 {id:'berserk',n:'Berserk',beh:1,d:'Up to +80% damage as HP drops'},
 {id:'exec',n:'Executioner',beh:1,d:'Slay non-boss foes below 20% HP'},
 // class perks: they modify the class kit
 {id:'fury',cls:'warrior',n:'Fury',beh:1,d:'Rage gain +'+Math.round(BAL.perk.furyMul*100)+'%'},
 {id:'retrib',cls:'warrior',n:'Retribution',beh:1,d:'Brace: +'+BAL.perk.retribHits+' blocks, reflects '+Math.round(BAL.perk.retribReflect*100)+'%'},
 {id:'stampede',cls:'warrior',n:'Stampede',beh:1,d:'Charge costs '+BAL.perk.stampedeCost+' less, stuns neighbours'},
 {id:'arcana',cls:'mage',n:'Arcane Mastery',beh:1,d:'+'+Math.round(BAL.perk.arcanaSpell*100)+'% spell power'},
 {id:'well',cls:'mage',n:'Wellspring',beh:1,d:'+'+BAL.perk.wellMana+' max mana, +'+BAL.perk.wellKill+' mana per kill',f:p=>{p.mbase+=BAL.perk.wellMana;if(G)p.mana+=BAL.perk.wellMana;}},
 {id:'deepfreeze',cls:'mage',n:'Deep Freeze',beh:1,d:'Nova freezes '+BAL.perk.freezeExtra+' turns longer'},
 {id:'phase',cls:'mage',n:'Phase Step',beh:1,d:'Blink: '+BAL.perk.phaseCost+' less mana, no cooldown'},
 {id:'assassin',cls:'rogue',n:'Assassin',beh:1,d:'Backstab +'+Math.round(BAL.perk.assassinMul*100)+'% damage, '+BAL.perk.assassinCd+' turns sooner'},
 {id:'bando',cls:'rogue',n:'Bandolier',beh:1,d:'+'+BAL.perk.bandoMax+' knives carried'},
 {id:'shadow',cls:'rogue',n:'Shadow Cloak',beh:1,d:'Vanish: '+BAL.perk.shadowCd+' turns sooner, '+BAL.perk.shadowTurns+' longer'},
 // unlockable perks (only in the pool once unlocked in the title shop / by achievements)
 {id:'warlord',n:'Warlord',lock:'warlord',max:2,d:'+3 attack and +1 defense',f:p=>{p.atk+=3;p.def+=1;}},
 {id:'phoenix',n:'Phoenix Heart',lock:'phoenix',beh:1,d:'Once per run, a lethal hit revives you at half HP'},
 {id:'trapper',n:'Trapfinder',lock:'trapper',beh:1,d:'See traps from 3 tiles; half trap damage'},
 {id:'midas',n:'Midas Touch',lock:'midas',beh:1,d:'Every kill drops some gold'},
 {id:'sage',n:'Alchemist',lock:'sage',beh:1,max:2,d:'Potions heal 50% more per level'},
 // blueprint perks (bp = tier): only offered at level-up once found and bought
 {id:'stalker',bp:'c',n:'Stalker',beh:1,d:'+'+Math.round(BAL.perk.stalkerMul*100)+'% damage to unaware foes'},
 {id:'warcry',bp:'r',cls:'warrior',n:'Warcry',beh:1,d:'Cleave also stuns each foe it hits '+BAL.perk.warcryStun+' turn'},
 {id:'frostbite',bp:'r',cls:'mage',n:'Frostbite',beh:1,d:'Frozen foes take +'+Math.round(BAL.perk.frostbiteMul*100)+'% damage'},
 {id:'lacerate',bp:'r',cls:'rogue',n:'Lacerate',beh:1,d:'Sneak hits and Backstab leave foes bleeding'}
];
PERKS.forEach(p=>{if(!p.max)p.max=p.beh?1:5;});
const SYN=[
 {id:'bv',a:'berserk',b:'vamp',n:'Blood Frenzy',d:'Lifesteal doubled below half HP'},
 {id:'be',a:'blood',b:'exec',n:'Bloody Verdict',d:'Executioner threshold rises to 30%'},
 {id:'cv',a:'chain',b:'venom',n:'Storm Toxin',d:'Chain Lightning also poisons'},
 {id:'fb',a:'fury',b:'berserk',n:'Blood Rage',d:'Rage gain x'+BAL.perk.bloodRageMul+' below half HP'},
 {id:'ow',a:'arcana',b:'well',n:'Overflow',d:'Kills restore double mana'},
 {id:'sd',a:'assassin',b:'bando',n:'Silent Death',d:'A knife that kills returns to you'}
];
// kit = the four ability keys (defs in content.js ABIL); start = starting weapon kind; mana = base mana pool (0 = none)
const CLS={
 warrior:{n:'Warrior',e:'warrior',hp:46,atk:4,def:3,crit:0.05,fire:1,mana:0,kit:['bash','cleave','charge','brace'],start:'sword',res:'Rage'},
 mage:{n:'Mage',e:'mage',hp:28,atk:4,def:0,crit:0.05,fire:2,mana:28,kit:['bolt','nova','blink','fire'],start:'staff',res:'Mana'},
 rogue:{n:'Rogue',e:'rogue',hp:32,atk:4,def:0,crit:0.12,fire:1,mana:0,kit:['backstab','vanish','knife','smoke'],start:'dagger',res:'Knives'}
};
const LG={warrior:{hp:4,atkE:4},mage:{hp:5,atkE:3},rogue:{hp:3,atkE:2}};
// weapon kinds: atk = melee attack offset (spells ignore it); crit/sneak/spell/mana = extras; sweep = splash fraction; reach = attack distance
const WP={
 sword:{n:'Sword',e:'sword',w:3,atk:0},
 axe:{n:'Axe',e:'axe',w:2,atk:-1,sweep:0.5},
 spear:{n:'Spear',e:'spear',w:2,atk:-1,reach:2},
 dagger:{n:'Dagger',e:'dagger',w:2,atk:-2,crit:0.12,sneak:1},
 staff:{n:'Staff',e:'staff',w:2,atk:-3,spell:0.25,mana:4},
 // blueprint weapons (bp = tier c / r / b): only in the loot pool once found and bought
 maul:{n:'Maul',e:'maul',w:2,atk:1,knock:1,bp:'c'},
 rapier:{n:'Rapier',e:'rapier',w:2,atk:-1,crit:0.1,riposte:BAL.weapon.rapierCounter,bp:'c'},
 viper:{n:'Viperblade',e:'viper',w:2,atk:-2,pois:1,bp:'c'},
 stormrod:{n:'Storm Rod',e:'stormrod',w:2,atk:-4,spell:0.2,mana:6,chain:1,bp:'b'},
 reaper:{n:'Reaper',e:'reaper',w:2,atk:-1,sweep:1,bp:'b'}
};
// armor kinds: def = defense offset on top of its tier value; noDef = no defense at all; mana/spell/dodge/manaRegenMul/rageMul = resource trade-offs
const ARM={
 mail:{n:'Mail',e:'mail',w:3,def:0},
 plate:{n:'Plate',e:'plate',w:2,def:2,manaRegenMul:0.5,rageMul:0.75,mana:-6},
 robe:{n:'Robe',e:'robe',w:2,noDef:1,spell:0.15,manaBase:6,manaPerV:2},
 leather:{n:'Leather',e:'leather',w:2,def:-1,dodge:0.1}
};
const TIERS=['Old','Plain','Fine','Steel','Runed','Dragon'];
// class-locked off-hands, each modifies one ability (numbers: BAL.offhand)
const OFF={
 tower:{cls:'warrior',n:'Tower Shield',e:'tower',ab:'bash'},
 bulwark:{cls:'warrior',n:'Iron Bulwark',e:'bulwark',ab:'brace'},
 totem:{cls:'warrior',n:'Blood Totem',e:'totem',ab:'cleave'},
 tome:{cls:'mage',n:'Ember Tome',e:'tome',ab:'nova'},
 prism:{cls:'mage',n:'Fire Prism',e:'prism',ab:'fire'},
 lens:{cls:'mage',n:'Piercing Lens',e:'lens',ab:'bolt'},
 dagger2:{cls:'rogue',n:'Second Dagger',e:'dagger2',ab:'backstab'},
 satchel:{cls:'rogue',n:"Smoker's Satchel",e:'satchel',ab:'smoke'},
 quiver:{cls:'rogue',n:'Deep Quiver',e:'quiver',ab:'knife'}
};
// charms: one passive rule each (numbers: BAL.charm)
const CH={
 fang:{n:'Vampire Fang',e:'fang'},
 ward:{n:'Ward Sigil',e:'ward'},
 eye:{n:'Seer Eye',e:'eye'},
 hourglass:{n:'Hourglass',e:'hourglass'},
 veil:{n:'Shadow Veil',e:'veil'},
 flask:{n:'Bottomless Flask',e:'flask'},
 soul:{n:'Soulstone',e:'soul'},
 gilded:{n:'Gilded Coin',e:'gilded',bp:'c'},
 frenzy:{n:'Blood Brand',e:'frenzy',bp:'c'},
 laststand:{n:'Last Stand',e:'laststand',bp:'r'},
 aegis:{n:'Stone Heart',e:'aegis',bp:'b'},
 cinder:{n:'Cinder Charm',e:'cinder',bp:'b'}
};
const TR={
 cursed:{slot:'weapon',n:'Cursed',dv:3,minF:2},
 vamp:{slot:'weapon',n:'Vampiric',dv:-2,minF:1},
 brutal:{slot:'weapon',n:'Brutal',dv:2,minF:2},
 keen:{slot:'weapon',n:'Keen',dv:-1,minF:1},
 heavy:{slot:'armor',n:'Heavy',dv:2,minF:2},
 spiked:{slot:'armor',n:'Spiked',dv:0,minF:1},
 leaden:{slot:'armor',n:'Leaden',dv:2,minF:3}
};
{const sg=n=>(n>=0?'+':'')+n,pc100=x=>Math.round(Math.abs(x)*100)+'%',B=BAL.trait;
 TR.cursed.d=sg(TR.cursed.dv)+' attack; lose '+B.cursedDrain+' HP per kill.';
 TR.vamp.d=sg(TR.vamp.dv)+' attack; heal '+pc100(B.vampLife)+' of damage dealt.';
 TR.brutal.d=sg(TR.brutal.dv)+' attack; '+sg(Math.round(B.brutalCrit*100))+'% crit.';
 TR.keen.d=sg(TR.keen.dv)+' attack; +'+pc100(B.keenCrit)+' crit.';
 TR.heavy.d=sg(TR.heavy.dv)+' defense; foes get a free turn every '+B.heavyEvery+'th turn.';
 TR.spiked.d=sg(B.spikedAtk)+' attack; melee attackers take '+B.spikedThorns+'.';
 TR.leaden.d=sg(TR.leaden.dv)+' defense; potions heal '+pc100(1-BAL.potion.leadenMul)+' less.';}
const TRAPS={spike:{n:'Spike trap',c:'#ff5a5a'},dart:{n:'Dart trap',c:'#7be04b'},alarm:{n:'Alarm trap',c:'#ffd24a'}};

// ===== Floor modifiers (rules: mods.js; numbers: BAL.mod). down = the price you pay, up = what you get. minF = first floor it can appear on. =====
const MODS=(function(){
 const M=BAL.mod,p=x=>Math.round(x*100)+'%';
 // tip = one line for the chip; r / g = a few words of risk and reward for the path choice
 return [
  {id:'dark',tip:'Sight '+M.dark.sight+' tiles, more loot.',e:'m_dark',n:'Dark',minF:2,r:'See only '+M.dark.sight+' tiles',g:'More loot'},
  {id:'flooded',tip:'Water slows you; foes in it lose a move.',e:'m_flooded',n:'Flooded',minF:2,r:'Water slows you',g:'Water slows foes; +gold'},
  {id:'cursed',tip:'No regen, weaker potions, a safe shrine.',e:'m_cursed',n:'Cursed ground',minF:2,r:'No regen, potions '+p(M.cursed.potionMul),g:'Safe shrine'},
  {id:'horde',tip:'Many weak foes, no treasure room.',e:'m_horde',n:'Horde',minF:2,r:p(M.horde.countMul-1)+' more foes, no vault',g:'Weaker foes, more gold'},
  {id:'hunted',tip:'A stalker hunts you: slay it for spoils.',e:'m_hunted',n:'Hunted',minF:M.hunted.minFloor,r:'A stalker hunts you',g:'Slay it for loot'},
  {id:'rich',tip:'Gold x'+M.rich.goldMul+', tougher enemies.',e:'m_rich',n:'Rich vein',minF:2,r:'Foes +'+p(M.rich.hpMul-1)+' HP',g:'Gold x'+M.rich.goldMul},
  {id:'silent',tip:'More traps and alarms; easy sneak attacks.',e:'m_silent',n:'Silent',minF:2,r:'Twice the traps',g:'Easy sneak attacks'},
  {id:'unstable',tip:'Cracked tiles collapse: step off them.',e:'m_unstable',n:'Unstable',minF:2,r:'Floor collapses',g:'Extra gear and gold'}
 ];
})();
function modOf(id){return MODS.find(m=>m.id===id)||null;}
// ===== Hard mode: named rule changes, all numbers from BAL.hard =====
const HARD_RULES=(function(){
 const H=BAL.hard,p=x=>Math.round(x*100)+'%';
 return [
  {n:'Tougher foes',d:'Foes +'+p(H.hpMul-1)+' HP, +'+p(H.atkMul-1)+' attack; dragon +'+p(H.bossAtkMul-1)+'.'},
  {n:'Scarce potions',d:H.startPotions+' fewer starting potion'+(H.startPotions>1?'s':'')+', '+p(1-H.dropPotionMul)+' fewer drops.'},
  {n:'Brood mother',d:'Extra whelps at '+p(H.extraSummonAt)+' dragon HP; enrages at '+p(H.enrageFrac)+'.'},
  {n:'Spoils',d:'Banked gold and score x'+H.goldMul+'.'}
 ];
})();
// ===== Expedition outcome table: per class, per upgrade power (gold spent on boosts), measured with the bot (tests/sim.js). Regenerate with `node tests/calibrate.js`. =====
// reach[f-1] = share of runs that ended on floor f (index 8 = won); gold / kills = mean per run ending there; turns = mean turns per run; gph = manual gold per hour (turns x BAL.exp.turnSec)
// BEGIN EXP_TABLE
const EXP_TABLE={warrior:[{pw:0,reach:[.1,.1,.1,.1,.1,.2,.1,.1,.1],gold:[20,40,60,80,100,120,140,160,300],kills:[5,10,15,20,25,30,35,40,60],turns:700,gph:500}],mage:[{pw:0,reach:[.1,.1,.1,.1,.1,.2,.1,.1,.1],gold:[20,40,60,80,100,120,140,160,300],kills:[5,10,15,20,25,30,35,40,60],turns:700,gph:500}],rogue:[{pw:0,reach:[.1,.1,.1,.1,.1,.2,.1,.1,.1],gold:[20,40,60,80,100,120,140,160,300],kills:[5,10,15,20,25,30,35,40,60],turns:700,gph:500}]};
// END EXP_TABLE
// ===== Heat 0-5. HEAT[h] = the rule added at that level (Heat 1 is Hard: HARD_RULES lists its parts). Numbers: BAL.heat / BAL.hard =====
const HEAT=(function(){
 const T=BAL.heat,p=x=>Math.round(x*100)+'%';
 return [
  {n:'Normal',d:'The standard dungeon.'},
  {n:'Hard',d:'Tougher foes, scarce potions, a brood mother.'},
  {n:'Reinforced',d:'+'+T.extraFoes+' foes on every floor.'},
  {n:'Iron elites',d:'Key elites get +'+p(T.eliteHpMul-1)+' HP, +'+p(T.eliteAtkMul-1)+' attack.'},
  {n:'Weak potions',d:'Potions heal '+p(1-T.potionMul)+' less.'},
  {n:'Fury',d:'The dragon enrages at '+p(T.enrageFrac)+' HP, breathes sooner.'}
 ];
})();
// ===== Blueprints: every item / perk carrying a bp tier (c = expeditions, r = deep manual runs, b = the dragon or Heat 1+ runs). Found = 1, unlocked (bought) = 2 in meta.bp =====
const BPS=(function(){
 const o=[];
 for(const x of [['weapon',WP],['off',OFF],['charm',CH]])for(const k in x[1])if(x[1][k].bp)o.push({id:k,t:x[0],tier:x[1][k].bp,n:x[1][k].n,e:x[1][k].e});
 for(const pk of PERKS)if(pk.bp)o.push({id:pk.id,t:'perk',tier:pk.bp,n:pk.n,e:'p_'+pk.id});
 return o;
})();
const BP_SRC={c:'Expeditions',r:'Deep runs, floor '+BAL.bp.deepFrom+'+',b:'The dragon, or Heat 1+ runs'};
// ===== Achievements. chk = state-derived check (run at kills, floor changes, run end); no chk = granted directly by the event in code.
// gold = one-time reward added to the permanent wallet. prog = progress text for countable goals. =====
const ACH=[
 {id:'win1',n:'First Victory',d:'Slay the dragon.',chk:()=>meta.wins>=1,prog:()=>Math.min(1,meta.wins)+'/1'},
 {id:'winW',n:'Shieldbearer',d:'Win a run as the Warrior.',chk:()=>recWins('warrior')>=1},
 {id:'winR',n:'Shadow Blade',d:'Win a run as the Rogue.',chk:()=>recWins('rogue')>=1},
 {id:'winM',n:'Archmage',d:'Win a run as the Mage.',chk:()=>recWins('mage')>=1},
 {id:'all3',n:'Triple Crown',d:'Win with all three classes.',gold:60,chk:()=>['warrior','rogue','mage'].every(c=>recWins(c)>=1),prog:()=>['warrior','rogue','mage'].filter(c=>recWins(c)>=1).length+'/3'},
 {id:'dry',n:'Teetotaler',d:'Win without drinking a potion.',gold:50,chk:()=>statWin()&&!G.stats.pots},
 {id:'dance',n:'Dragon Dancer',d:'Win without a dragon wind-up hitting you.',gold:60,chk:()=>statWin()&&!G.stats.dragonHit},
 {id:'bare',n:'Bare Essentials',d:'Reach floor '+BAL.ach.noArmorFloor+' with no armor.',gold:40},
 {id:'horde',n:'Hordebreaker',d:'Clear every enemy on a Horde floor.',gold:30},
 {id:'hunt',n:'Stalker Stalked',d:'Slay the stalker on a Hunted floor.',gold:30},
 {id:'daily',n:'Daily Champion',d:'Win a Daily run.',gold:40},
 {id:'hardwin',n:'Hardened',d:'Win a run on Hard.',gold:100,chk:()=>meta.hwins>=1},
 {id:'habit',n:'Daily Habit',d:'Play the Daily on '+BAL.ach.dailyDays+' different days.',chk:()=>meta.dlyN>=BAL.ach.dailyDays,prog:()=>Math.min(meta.dlyN,BAL.ach.dailyDays)+'/'+BAL.ach.dailyDays},
 {id:'lair',n:'Into the Lair',d:'Reach floor '+MAXF+'.',chk:()=>meta.best>=MAXF},
 {id:'slayer',n:'Slayer',d:'Slay '+BAL.ach.kills+' enemies in total.',chk:()=>meta.kills>=BAL.ach.kills,prog:()=>Math.min(meta.kills,BAL.ach.kills)+'/'+BAL.ach.kills},
 {id:'elite',n:'Elite Hunter',d:'Slay '+BAL.ach.elites+' elite enemies in total.',chk:()=>meta.elites>=BAL.ach.elites,prog:()=>Math.min(meta.elites,BAL.ach.elites)+'/'+BAL.ach.elites},
 {id:'roll',n:'On a Roll',d:'Win '+BAL.ach.streak+' runs in a row.',gold:60,chk:()=>meta.bstreak>=BAL.ach.streak,prog:()=>Math.min(meta.bstreak,BAL.ach.streak)+'/'+BAL.ach.streak},
 {id:'terrain',n:'Terrain Master',d:'Survive a floor of every modifier.',gold:80,chk:()=>modsDone()>=MODS.length,prog:()=>modsDone()+'/'+MODS.length},
 {id:'hoard',n:'Dragon\'s Hoard',d:'Carry '+BAL.ach.hoard+' gold at once.',chk:()=>!!G&&!!G.p&&G.p.gold>=BAL.ach.hoard},
 {id:'swift',n:'Swift Death',d:'Win a run in '+BAL.ach.fastTurns+' turns or fewer.',gold:50,chk:()=>statWin()&&G.turn<=BAL.ach.fastTurns}
];
// Auto's fixed perk priority per class (first one offered wins; if none is offered it takes the first card)
const AUTO_PERKS={
 warrior:['second','vit','bul','retrib','vamp','fury','might','regen','renew','thorns','warlord','phoenix','keen','evade','tempo','exec','blood','riposte','berserk'],
 mage:['arcana','well','vit','pyro','second','bul','deepfreeze','might','regen','renew','phase','warlord','phoenix','keen','evade','tempo','exec'],
 rogue:['assassin','vit','second','bul','vamp','shadow','keen','might','regen','renew','evade','bando','warlord','phoenix','tempo','exec','blood','riposte']
};
// Auto's floor-modifier ranking: rewarding ones it may take when HP is high, and the safest-first order it falls back to
const AUTO_MODS={reward:['rich','dark','unstable','flooded'],safe:['silent','flooded','dark','rich','cursed','unstable','hunted','horde']};

