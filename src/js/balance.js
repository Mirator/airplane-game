// balance.js - every tunable game number: scalar knobs in BAL plus the enemy, class, perk, synergy,
// gear-trait, unlock and shop tables. A balance pass should only need to touch this file.

const W=30,H=30,MAXF=8;   // map size and number of floors (floor 8 = dragon lair)

// ===== BAL: scalar balance knobs, grouped by system. Expressions in the code are unchanged; only literals moved here. =====
// NOTE: descriptive strings in the tables below (perk/trait/unlock text, help screen) still contain hand-written copies of
// some numbers - update them together when changing a value.
const BAL = {
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
    eliteHpMul: 2, eliteAtkMul: 1.2, eliteAtkAdd: 1
  },
  spawn: {
    enemyBase: 5, enemyPerFloor: 1.0, enemyExtraMax: 2, ratLastFloor: 5,
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
    assassinMul: 0.5, assassinCd: 2, bandoMax: 3, shadowCd: 3, shadowTurns: 2, bloodRageMul: 2
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
  mana: { regen: 1, perKill: 2 },                       // mage: base pool lives in CLS.mage.mana; regen per turn (accumulates fractions) and per kill
  // --- active abilities (abilities.js). cost = resource spent; cd = turns before reuse (0 = none) ---
  ability: {
    bash:     { cd: 6, stun: 2, stunBoss: 1, mul: 1.0 },
    cleave:   { rage: 30, mul: 1.0, cd: 0 },
    charge:   { rage: 20, cd: 2, minDist: 2, maxDist: 6, mul: 0.8, stun: 2, stunBoss: 1 },
    brace:    { rage: 35, cd: 0, hits: 3, turns: 6, reduce: 0.5, reflect: 0.5 },
    bolt:     { mana: 7, cd: 0, mul: 1.3, add: 1, range: 8 },
    nova:     { mana: 8, cd: 3, freeze: 3, freezeBoss: 1, mul: 0.6 },
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
    quiverKnives: 3                       // Quiver: +knives
  },
  charm: { fangHeal: 3, fangFloorDiv: 2, veilSight: 3, soulRage: 12, soulMana: 5, hourglassEvery: 2 },
  weapon: { shieldFront: 0.4, shieldRanged: 0.5 },   // shielded enemies: damage multipliers (front melee / any ranged hit); stunned or frozen = no guard
  // --- floor features (features.js) ---
  merchant: {
    floors: [3, 6], gearSlots: ['weapon', 'weapon', 'armor', 'armor', 'off', 'charm'], elixirHp: 10,   // gearSlots: one stocked per visit, drawn from this list (repeat = likelier)
    price: { potion: [12, 2], fire: [22, 3], tele: [18, 2], gear: [40, 8], perk: [60, 10], elixir: [65, 8] }   // [base, per floor]
  },
  shrine: { healBase: 0.6, healBetter: 0.75, lossBase: 0.25, lossBetter: 0.15, sacrificeGold: 30, pactHp: 8, pactMinHp: 10, pactAtk: 3, blessHeal: 0.3 },
  // --- permanent progression (save.js, run.js) ---
  meta: {
    hpPerLevel: 8, atkPerLevel: 1, defPerLevel: 1, potPerLevel: 1, potMaxLevel: 4, goldPerLevel: 0.15,
    costGrowth: 0.3,                 // shop price = base * (level+1) * (1 + level * costGrowth)
    startScrollFireChance: 0.5
  },
  run: { winBonus: 150 },
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
  ach: { kills: 200, elites: 10, streak: 3, dailyDays: 3, hoard: 200, fastTurns: 1000, noArmorFloor: 5 }
};

// ===== Tables: enemies, perks, synergies, classes, gear traits, traps, shop, unlocks =====
const SHOP=[
 {k:'hp',n:'Hardy',d:'+'+BAL.meta.hpPerLevel+' starting HP',base:30},
 {k:'atk',n:'Sharpened',d:'+'+BAL.meta.atkPerLevel+' starting attack',base:55},
 {k:'pot',n:'Supplies',d:'+'+BAL.meta.potPerLevel+' starting potion (and belt space), up to Lv '+BAL.meta.potMaxLevel,base:40,max:BAL.meta.potMaxLevel},
 {k:'goldp',n:'Greed',d:'+'+Math.round(BAL.meta.goldPerLevel*100)+'% gold found',base:50},
 {k:'def',n:'Padded',d:'+'+BAL.meta.defPerLevel+' starting defense',base:70}
];
const SHOPMAX=8;
function shopMax(s){return s.max||SHOPMAX;}   // per-item level cap (Supplies is capped lower: potions are limited by belt space)
const UNLOCKS=[
 {id:'rogue',n:'🗡 Rogue class',d:'Backstab, Vanish, Throwing Knife and Smoke Bomb. No resource bar: cooldowns, knives and positioning.',cost:150},
 {id:'mage',n:'🧙 Mage class',d:'Arcane Bolt, Frost Nova, Blink and Fireball, fuelled by a mana pool. Starts with an extra flame scroll.',cost:200},
 {id:'warlord',n:'Perk: Warlord',d:'Adds Warlord to the level-up pool.',cost:180},
 {id:'elixir',n:'Merchant: Elixir',d:'Merchants also stock an Elixir of Vigor (+'+BAL.merchant.elixirHp+' max HP, full heal).',cost:110},
 {id:'scroll',n:'Starting scroll',d:'Begin every run with a random scroll (fireball or teleport).',cost:90},
 {id:'pick4',n:'Fourth choice',d:'Level-ups offer 4 perks to choose from instead of 3.',cost:220},
 {id:'shrine',n:'Shrine favour',d:'Shrines offer a safe Blessing and better odds when you pray.',cost:110},
 {id:'phoenix',n:'Perk: Phoenix Heart',d:'Adds Phoenix Heart (revive once per run) to the pool.',ach:'Defeat the dragon',chk:function(){return meta.wins>=1;},prog:function(){return meta.wins+'/1 wins';}},
 {id:'trapper',n:'Perk: Trapfinder',d:'Adds Trapfinder (see traps from 3 tiles, take half trap damage) to the pool.',ach:'Reach floor 4',chk:function(){return meta.best>=4;},prog:function(){return 'best floor '+meta.best+'/4';}},
 {id:'midas',n:'Perk: Midas Touch',d:'Adds Midas Touch (every kill drops gold) to the pool.',ach:'Slay 50 enemies in total',chk:function(){return meta.kills>=50;},prog:function(){return meta.kills+'/50 kills';}},
 {id:'sage',n:'Perk: Alchemist',d:'Adds Alchemist (potions heal 50% more) to the pool.',ach:'Slay an elite enemy',chk:function(){return meta.elites>=1;},prog:function(){return meta.elites+'/1 elites';}}
];
const EN={
 rat:{n:'Rat',e:'🐀',hp:6,atk:2,speed:2,pack:true,group:[3,4],w:2,maxF:BAL.spawn.ratLastFloor,xp:3,minF:1,tr:'Swarm animal: arrives in packs, moves twice per turn and surrounds you. Weak alone; Cleave, Frost Nova and Fireball shred a pack.'},
 goblin:{n:'Goblin',e:'👺',hp:10,atk:3,lunge:true,xp:5,minF:1,tr:'Plain melee brute. Lunges: takes an extra step every '+BAL.enemyAi.lungeEvery+' turns while chasing, so you cannot back away from it for long.'},
 archer:{n:'Archer',e:'🏹',hp:8,atk:4,range:6,cdmax:2,kite:true,xp:6,minF:2,tr:'Shoots from up to 6 tiles (needs a clear line). Keeps its distance and flees when you get close.'},
 hound:{n:'Hound',e:'🐺',hp:12,atk:4,speed:2,xp:7,minF:3,tr:'Fast closer: moves twice per turn, so it crosses the room before a stationary shooter can kill it. Fight it in melee or stun it.'},
 guard:{n:'Guard',e:'🤺',hp:20,atk:5,shield:true,xp:10,minF:4,tr:'Shielded: takes only '+Math.round(BAL.weapon.shieldFront*100)+'% damage from the front and '+Math.round(BAL.weapon.shieldRanged*100)+'% from ranged hits. Stun or freeze it, or strike it from behind (opposite the way it faces).'},
 skeleton:{n:'Skeleton',e:'💀',hp:15,atk:5,lunge:true,xp:8,minF:3,tr:'Tough melee fighter. Lunges like the goblin (an extra step every '+BAL.enemyAi.lungeEvery+' turns while chasing).'},
 ogre:{n:'Ogre',e:'👹',hp:26,atk:8,slowAct:true,xp:13,minF:3,tr:'Acts only every other turn, but hits very hard. The hourglass shows it is recovering.'},
 troll:{n:'Troll',e:'🧌',hp:34,atk:7,slow:true,wind:true,windMul:2,windMsg:'The Troll raises its club!',xp:16,minF:4,tr:'Slow, lots of HP. Winds up a club smash (red tiles) that hurts and knocks you back.'},
 cultist:{n:'Cultist',e:'🧛',hp:14,atk:5,range:6,cdmax:2,kite:true,heal:true,xp:12,minF:4,tr:'Caster that stays behind its friends. Heals a wounded ally instead of attacking, otherwise blasts from 6 tiles. Priority target: dive it.'},
 bat:{n:'Bat',e:'🦇',hp:5,atk:3,speed:2,pack:true,group:[4,6],w:2,xp:3,minF:5,tr:'Swarm: a flock of fragile, fast biters. Area attacks wipe them out.'},
 warlock:{n:'Warlock',e:'🦹',hp:10,atk:6,range:6,cdmax:2,kite:true,xp:12,minF:5,tr:'Casts blasts from 6 tiles (needs a clear line). Keeps its distance.'},
 whelp:{n:'Whelp',e:'🦎',hp:16,atk:8,speed:2,pack:true,flat:true,xp:2,minF:99,tr:'A dragon whelp, called by the Dragon. Fast and fragile in numbers.'},
 dragon:{n:'Dragon',e:'🐉',hp:1500,atk:58,breath:true,sweep:true,windMul:2,windMsg:'The Dragon rears back, flames gathering!',xp:100,minF:99,boss:true,tr:'Boss: winds up a 3-wide fire breath (red tiles). Calls whelps at '+BAL.enemyAi.summonAt.map(x=>Math.round(x*100)+'%').join(' and ')+' health. Too heavy to push; stun, freeze or blind it to cancel an attack. Enraged at half health: hits harder, breathes more often and sweeps the tiles around it.'}
};
// perk fields: cls = only offered to that class; beh = behaviour (no stat change); max = levels. f(p) applies stat effects.
const PERKS=[
 {id:'vit',n:'Vitality',d:'+12 max HP and heal 12',f:p=>{p.mhp+=12;p.hp=Math.min(p.mhp,p.hp+12);}},
 {id:'might',n:'Might',d:'+2 attack',f:p=>{p.atk+=2;}},
 {id:'bul',n:'Bulwark',d:'+1 defense',f:p=>{p.def+=1;}},
 {id:'vamp',n:'Vampirism',d:'Heal 10% of damage dealt (min 1)',f:p=>{p.life+=0.1;}},
 {id:'keen',n:'Keen Eye',d:'+12% critical chance (x2 damage)',f:p=>{p.crit+=0.12;}},
 {id:'renew',n:'Renewal',d:'Heal 30% HP on each new floor',f:p=>{p.renew+=0.3;}},
 {id:'thorns',n:'Thorns',d:'Melee attackers take 2 damage',f:p=>{p.thorns+=2;}},
 {id:'pockets',n:'Deep Pockets',d:'+2 potion capacity',f:p=>{p.potCap+=2;}},
 {id:'evade',n:'Evasion',d:'+8% chance to dodge attacks',f:p=>{p.dodge+=0.08;}},
 {id:'scholar',n:'Scholar',d:'+30% XP gained',f:p=>{p.xpMul+=0.3;}},
 {id:'pyro',n:'Pyromancer',d:'Flame scrolls and the Fireball spell deal +'+Math.round(BAL.perk.pyroFire*100)+'% damage; +1 flame scroll',f:p=>{p.fireMul+=BAL.perk.pyroFire;G.inv.fire++;}},
 {id:'regen',n:'Regeneration',d:'+1 HP every 5 turns',f:p=>{p.regen+=1;}},
 {id:'treasure',n:'Treasure Hunter',d:'+25% gold found',f:p=>{p.goldMul+=0.25;}},
 {id:'tempo',n:'Tempo',d:'All ability cooldowns are '+BAL.perk.tempoCut+' turn shorter (min 1)',beh:1},
 // behaviour perks
 {id:'venom',n:'Venom',beh:1,max:3,d:'Hits poison for 3 turns (+1 poison damage per level; halved on bosses)'},
 {id:'chain',n:'Chain Lightning',beh:1,d:'Kills zap the nearest visible enemy (once, no further chains)'},
 {id:'blood',n:'Bloodlust',beh:1,d:'After a kill, your next hit deals +75% damage'},
 {id:'riposte',n:'Riposte',beh:1,max:3,d:'20% chance per level to counterattack when hit in melee'},
 {id:'second',n:'Second Wind',beh:1,d:'Once per floor, a lethal hit leaves you at 1 HP instead'},
 {id:'glass',n:'Glass Cannon',beh:1,d:'+5 attack but -25% max HP',f:p=>{p.atk+=5;p.mhp=Math.max(8,Math.round(p.mhp*0.75));p.hp=Math.min(p.hp,p.mhp);}},
 {id:'scav',n:'Scavenger',beh:1,max:2,d:'Slain enemies drop an extra potion 20% of the time (per level)'},
 {id:'berserk',n:'Berserk',beh:1,d:'Up to +80% damage as your HP drops'},
 {id:'exec',n:'Executioner',beh:1,d:'Instantly slay non-boss enemies below 20% HP after a hit'},
 // class perks: they modify the class kit
 {id:'fury',cls:'warrior',n:'Fury',beh:1,d:'Rage gain +'+Math.round(BAL.perk.furyMul*100)+'%'},
 {id:'retrib',cls:'warrior',n:'Retribution',beh:1,d:'Brace blocks '+BAL.perk.retribHits+' more hits and reflects '+Math.round(BAL.perk.retribReflect*100)+'% of the damage'},
 {id:'stampede',cls:'warrior',n:'Stampede',beh:1,d:'Charge costs '+BAL.perk.stampedeCost+' less rage and stuns every enemy next to where you land'},
 {id:'arcana',cls:'mage',n:'Arcane Mastery',beh:1,d:'+'+Math.round(BAL.perk.arcanaSpell*100)+'% spell power'},
 {id:'well',cls:'mage',n:'Wellspring',beh:1,d:'+'+BAL.perk.wellMana+' max mana and +'+BAL.perk.wellKill+' mana per kill',f:p=>{p.mbase+=BAL.perk.wellMana;if(G)p.mana+=BAL.perk.wellMana;}},
 {id:'deepfreeze',cls:'mage',n:'Deep Freeze',beh:1,d:'Frost Nova freezes '+BAL.perk.freezeExtra+' turns longer'},
 {id:'phase',cls:'mage',n:'Phase Step',beh:1,d:'Blink costs '+BAL.perk.phaseCost+' less mana and has no cooldown'},
 {id:'assassin',cls:'rogue',n:'Assassin',beh:1,d:'Backstab deals +'+Math.round(BAL.perk.assassinMul*100)+'% damage and recharges '+BAL.perk.assassinCd+' turns sooner'},
 {id:'bando',cls:'rogue',n:'Bandolier',beh:1,d:'+'+BAL.perk.bandoMax+' throwing knives carried'},
 {id:'shadow',cls:'rogue',n:'Shadow Cloak',beh:1,d:'Vanish recharges '+BAL.perk.shadowCd+' turns sooner and lasts '+BAL.perk.shadowTurns+' turns longer'},
 // unlockable perks (only in the pool once unlocked in the title shop / by achievements)
 {id:'warlord',n:'Warlord',lock:'warlord',max:2,d:'+3 attack and +1 defense',f:p=>{p.atk+=3;p.def+=1;}},
 {id:'phoenix',n:'Phoenix Heart',lock:'phoenix',beh:1,d:'Once per run, a lethal hit revives you at half HP'},
 {id:'trapper',n:'Trapfinder',lock:'trapper',beh:1,d:'Spot traps from 3 tiles away; traps do half damage to you and poison is shorter'},
 {id:'midas',n:'Midas Touch',lock:'midas',beh:1,d:'Every slain enemy drops some gold'},
 {id:'sage',n:'Alchemist',lock:'sage',beh:1,max:2,d:'Potions heal 50% more (per level)'}
];
PERKS.forEach(p=>{if(!p.max)p.max=p.beh?1:5;});
const SYN=[
 {id:'bv',a:'berserk',b:'vamp',n:'Blood Frenzy',d:'Lifesteal is doubled below half HP'},
 {id:'be',a:'blood',b:'exec',n:'Bloody Verdict',d:'Executioner threshold rises to 30%'},
 {id:'cv',a:'chain',b:'venom',n:'Storm Toxin',d:'Chain Lightning also poisons its target'},
 {id:'fb',a:'fury',b:'berserk',n:'Blood Rage',d:'Rage gain is x'+BAL.perk.bloodRageMul+' below half HP'},
 {id:'ow',a:'arcana',b:'well',n:'Overflow',d:'Kills restore double mana'},
 {id:'sd',a:'assassin',b:'bando',n:'Silent Death',d:'A throwing knife that kills returns to your hand'}
];
// kit = the four ability keys (defs in content.js ABIL); start = starting weapon kind; mana = base mana pool (0 = none)
const CLS={
 warrior:{n:'Warrior',e:'🛡',hp:46,atk:4,def:3,crit:0.05,fire:1,mana:0,kit:['bash','cleave','charge','brace'],start:'sword',res:'Rage'},
 mage:{n:'Mage',e:'🧙',hp:28,atk:4,def:0,crit:0.05,fire:2,mana:28,kit:['bolt','nova','blink','fire'],start:'staff',res:'Mana'},
 rogue:{n:'Rogue',e:'🗡',hp:32,atk:4,def:0,crit:0.12,fire:1,mana:0,kit:['backstab','vanish','knife','smoke'],start:'dagger',res:'Knives'}
};
const LG={warrior:{hp:4,atkE:4},mage:{hp:5,atkE:3},rogue:{hp:3,atkE:2}};
// weapon kinds: atk = melee attack offset (spells ignore it); crit/sneak/spell/mana = extras; sweep = splash fraction; reach = attack distance
const WP={
 sword:{n:'Sword',e:'⚔️',w:3,atk:0},
 axe:{n:'Axe',e:'🪓',w:2,atk:-1,sweep:0.5},
 spear:{n:'Spear',e:'🔱',w:2,atk:-1,reach:2},
 dagger:{n:'Dagger',e:'🗡',w:2,atk:-2,crit:0.12,sneak:1},
 staff:{n:'Staff',e:'🪄',w:2,atk:-3,spell:0.25,mana:4}
};
// armor kinds: def = defense offset on top of its tier value; noDef = no defense at all; mana/spell/dodge/manaRegenMul/rageMul = resource trade-offs
const ARM={
 mail:{n:'Mail',e:'🛡',w:3,def:0},
 plate:{n:'Plate',e:'🛡',w:2,def:2,manaRegenMul:0.5,rageMul:0.75,mana:-6},
 robe:{n:'Robe',e:'👘',w:2,noDef:1,spell:0.15,manaBase:6,manaPerV:2},
 leather:{n:'Leather',e:'🥋',w:2,def:-1,dodge:0.1}
};
const TIERS=['Old','Plain','Fine','Steel','Runed','Dragon'];
// class-locked off-hands, each modifies one ability (numbers: BAL.offhand)
const OFF={
 tower:{cls:'warrior',n:'Tower Shield',e:'🛡',ab:'bash'},
 bulwark:{cls:'warrior',n:'Iron Bulwark',e:'🧱',ab:'brace'},
 totem:{cls:'warrior',n:'Blood Totem',e:'🩸',ab:'cleave'},
 tome:{cls:'mage',n:'Ember Tome',e:'📖',ab:'nova'},
 prism:{cls:'mage',n:'Fire Prism',e:'💎',ab:'fire'},
 lens:{cls:'mage',n:'Piercing Lens',e:'🔭',ab:'bolt'},
 dagger2:{cls:'rogue',n:'Second Dagger',e:'🗡',ab:'backstab'},
 satchel:{cls:'rogue',n:"Smoker's Satchel",e:'🎒',ab:'smoke'},
 quiver:{cls:'rogue',n:'Deep Quiver',e:'🎯',ab:'knife'}
};
// charms: one passive rule each (numbers: BAL.charm)
const CH={
 fang:{n:'Vampire Fang',e:'🦷'},
 ward:{n:'Ward Sigil',e:'🔰'},
 eye:{n:'Seer Eye',e:'👁'},
 hourglass:{n:'Hourglass',e:'⏳'},
 veil:{n:'Shadow Veil',e:'🌑'},
 flask:{n:'Bottomless Flask',e:'⚗️'},
 soul:{n:'Soulstone',e:'🔮'}
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
 TR.cursed.d=sg(TR.cursed.dv)+' attack, but you lose '+B.cursedDrain+' HP per kill.';
 TR.vamp.d=sg(TR.vamp.dv)+' attack, but heal '+pc100(B.vampLife)+' of damage dealt.';
 TR.brutal.d=sg(TR.brutal.dv)+' attack, but '+sg(Math.round(B.brutalCrit*100))+'% crit chance.';
 TR.keen.d=sg(TR.keen.dv)+' attack, but +'+pc100(B.keenCrit)+' crit chance.';
 TR.heavy.d=sg(TR.heavy.dv)+' defense, but enemies get a free turn every '+B.heavyEvery+'th turn.';
 TR.spiked.d='Melee attackers take '+B.spikedThorns+' damage, but '+sg(B.spikedAtk)+' attack.';
 TR.leaden.d=sg(TR.leaden.dv)+' defense, but potions heal '+pc100(1-BAL.potion.leadenMul)+' less.';}
const TRAPS={spike:{n:'Spike trap',c:'#ff5a5a'},dart:{n:'Dart trap',c:'#7be04b'},alarm:{n:'Alarm trap',c:'#ffd24a'}};

// ===== Floor modifiers (rules: mods.js; numbers: BAL.mod). down = the price you pay, up = what you get. minF = first floor it can appear on. =====
const MODS=(function(){
 const M=BAL.mod,p=x=>Math.round(x*100)+'%';
 return [
  {id:'dark',tip:'Sight '+M.dark.sight+' tiles, more loot.',e:'🌑',n:'Dark',minF:2,down:'You only see '+M.dark.sight+' tiles around you.',up:'More loot: +'+M.dark.extraGold+' gold piles'+(M.dark.extraPotions?', +'+M.dark.extraPotions+' potion':'')+' and a '+p(M.dark.gearChance)+' chance of a gear drop.'},
  {id:'flooded',tip:'Water slows you; enemies in it lose a move.',e:'🌊',n:'Flooded',minF:2,down:'Wading through water gives enemies an extra move.',up:'Enemies that enter water lose their next move; +'+M.flooded.extraGold+' gold piles.'},
  {id:'cursed',tip:'No regen, weaker potions, a safe shrine.',e:'☠️',n:'Cursed ground',minF:2,down:'No natural regeneration and potions heal '+p(M.cursed.potionMul)+'.',up:'A shrine is guaranteed, and it offers the safe Blessing.'},
  {id:'horde',tip:'Many weak foes, no treasure room.',e:'🐀',n:'Horde',minF:2,down:p(M.horde.countMul-1)+' more enemies, no locked treasure room, and each gives only '+p(M.horde.xpMul)+' XP.',up:'Foes have '+p(M.horde.hpMul)+' HP and '+p(1-M.horde.atkMul)+' less attack; they drop more gold.'},
  {id:'hunted',tip:'A stalker hunts you: slay it for spoils.',e:'🎯',n:'Hunted',minF:M.hunted.minFloor,down:'A tough stalker hunts you from the start.',up:'Slay it for a trait item, gold, a potion and bonus XP.'},
  {id:'rich',tip:'Gold x'+M.rich.goldMul+', tougher enemies.',e:'💰',n:'Rich vein',minF:2,down:'Enemies have +'+p(M.rich.hpMul-1)+' HP and +'+p(M.rich.atkMul-1)+' attack.',up:'Gold is doubled; +'+M.rich.extraGold+' gold piles.'},
  {id:'silent',tip:'More traps, alarms and easy sneak attacks.',e:'🤫',n:'Silent',minF:2,down:'Twice the traps, and half of them are alarms.',up:'Enemies notice you only from '+M.silent.sight+' tiles; sneak attacks do x'+M.silent.sneakMul+' for everyone.'},
  {id:'unstable',tip:'Cracked tiles collapse: step off them.',e:'🕳️',n:'Unstable',minF:2,down:'Tiles crack, then collapse after '+M.unstable.warn+' turns: standing on one hurts.',up:'Collapses hit enemies for x'+M.unstable.enemyMul+'; extra gear and gold.'}
 ];
})();
function modOf(id){return MODS.find(m=>m.id===id)||null;}
// ===== Hard mode: named rule changes, all numbers from BAL.hard =====
const HARD_RULES=(function(){
 const H=BAL.hard,p=x=>Math.round(x*100)+'%';
 return [
  {n:'Tougher foes',d:'Enemies have +'+p(H.hpMul-1)+' HP and +'+p(H.atkMul-1)+' attack; the dragon hits +'+p(H.bossAtkMul-1)+' harder.'},
  {n:'Scarce potions',d:H.startPotions+' fewer starting potion'+(H.startPotions>1?'s':'')+', '+(H.bonusPotion?'the bonus floor potion is only '+p(H.bonusPotion)+' likely':'no bonus potion on floors')+', '+p(1-H.dropPotionMul)+' fewer potion drops.'},
  {n:'Brood mother',d:'The dragon calls an extra brood of whelps at '+p(H.extraSummonAt)+' health and enrages at '+p(H.enrageFrac)+'.'},
  {n:'Spoils',d:'Banked gold and score are x'+H.goldMul+'.'}
 ];
})();
// ===== Achievements. chk = state-derived check (run at kills, floor changes, run end); no chk = granted directly by the event in code.
// gold = one-time reward added to the permanent wallet. prog = progress text for countable goals. =====
const ACH=[
 {id:'win1',n:'First Victory',d:'Slay the dragon.',chk:()=>meta.wins>=1,prog:()=>Math.min(1,meta.wins)+'/1'},
 {id:'winW',n:'Shieldbearer',d:'Win a run as the Warrior.',chk:()=>recWins('warrior')>=1},
 {id:'winR',n:'Shadow Blade',d:'Win a run as the Rogue.',chk:()=>recWins('rogue')>=1},
 {id:'winM',n:'Archmage',d:'Win a run as the Mage.',chk:()=>recWins('mage')>=1},
 {id:'all3',n:'Triple Crown',d:'Win with all three classes.',gold:60,chk:()=>['warrior','rogue','mage'].every(c=>recWins(c)>=1),prog:()=>['warrior','rogue','mage'].filter(c=>recWins(c)>=1).length+'/3'},
 {id:'dry',n:'Teetotaler',d:'Win without drinking a potion.',gold:50,chk:()=>statWin()&&!G.stats.pots},
 {id:'dance',n:'Dragon Dancer',d:'Win without ever being hit by the dragon\'s telegraphed attacks.',gold:60,chk:()=>statWin()&&!G.stats.dragonHit},
 {id:'bare',n:'Bare Essentials',d:'Reach floor '+BAL.ach.noArmorFloor+' without wearing any armor.',gold:40},
 {id:'horde',n:'Hordebreaker',d:'Clear every enemy on a Horde floor.',gold:30},
 {id:'hunt',n:'Stalker Stalked',d:'Slay the stalker on a Hunted floor.',gold:30},
 {id:'daily',n:'Daily Champion',d:'Win a Daily run.',gold:40},
 {id:'hardwin',n:'Hardened',d:'Win a run on Hard.',gold:100,chk:()=>meta.hwins>=1},
 {id:'habit',n:'Daily Habit',d:'Play the Daily on '+BAL.ach.dailyDays+' different days.',chk:()=>meta.dlyN>=BAL.ach.dailyDays,prog:()=>Math.min(meta.dlyN,BAL.ach.dailyDays)+'/'+BAL.ach.dailyDays},
 {id:'lair',n:'Into the Lair',d:'Reach floor '+MAXF+'.',chk:()=>meta.best>=MAXF},
 {id:'slayer',n:'Slayer',d:'Slay '+BAL.ach.kills+' enemies in total.',chk:()=>meta.kills>=BAL.ach.kills,prog:()=>Math.min(meta.kills,BAL.ach.kills)+'/'+BAL.ach.kills},
 {id:'elite',n:'Elite Hunter',d:'Slay '+BAL.ach.elites+' elite enemies in total.',chk:()=>meta.elites>=BAL.ach.elites,prog:()=>Math.min(meta.elites,BAL.ach.elites)+'/'+BAL.ach.elites},
 {id:'roll',n:'On a Roll',d:'Win '+BAL.ach.streak+' runs in a row.',gold:60,chk:()=>meta.bstreak>=BAL.ach.streak,prog:()=>Math.min(meta.bstreak,BAL.ach.streak)+'/'+BAL.ach.streak},
 {id:'terrain',n:'Terrain Master',d:'Leave a floor of each of the '+MODS.length+' modifiers alive.',gold:80,chk:()=>modsDone()>=MODS.length,prog:()=>modsDone()+'/'+MODS.length},
 {id:'hoard',n:'Dragon\'s Hoard',d:'Carry '+BAL.ach.hoard+' gold at once.',chk:()=>!!G&&!!G.p&&G.p.gold>=BAL.ach.hoard},
 {id:'swift',n:'Swift Death',d:'Win a run in '+BAL.ach.fastTurns+' turns or fewer.',gold:50,chk:()=>statWin()&&G.turn<=BAL.ach.fastTurns}
];
