// balance.js - every tunable game number: scalar knobs in BAL plus the enemy, class, perk, synergy,
// gear-trait, unlock and shop tables. A balance pass should only need to touch this file.

const W=30,H=30,MAXF=8;   // map size and number of floors (floor 8 = dragon lair)

// ===== BAL: scalar balance knobs, grouped by system. Expressions in the code are unchanged; only literals moved here. =====
// NOTE: descriptive strings in the tables below (perk/trait/unlock text, help screen) still contain hand-written copies of
// some numbers - update them together when changing a value.
const BAL = {
  // --- dungeon layout (mapgen.js) ---
  map: {
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
    hpPerFloor: 0.45, atkPerFloor: 0.45,        // +45% of base per floor above 1
    rangedHpFactor: 0.6, rangedAtkFactor: 0.7,  // ranged enemies scale slower
    eliteHpMul: 2, eliteAtkMul: 1.2, eliteAtkAdd: 1
  },
  spawn: {
    enemyBase: 4, enemyPerFloor: 0.9, enemyExtraMax: 2, ratLastFloor: 5,
    goldPiles: 3, goldMin: 3, goldMax: 6, goldPerFloor: 2,
    extraPotionChance: 0.4,
    weaponChance: 0.5, weaponMin: 1, weaponMax: 2, weaponPerFloor: 0.7,
    armorChance: 0.5, armorRand: 2, armorDiv: 2, armorBase: 1,
    fireChance: 0.5, teleChance: 0.35
  },
  treasure: { weaponChance: 0.5, gold1Base: 12, gold1PerFloor: 4, gold2Base: 10, gold2PerFloor: 3, potionChance: 0.6 },
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
  item: { weakSaleBase: 3 },    // weak plain gear is sold for (weakSaleBase + floor) gold
  potion: { minHeal: 12, healFrac: 0.4, sageBonus: 0.5, leadenMul: 0.6 },
  fireball: { base: 10, perFloor: 3 },
  teleport: { minDist: 8 },
  // --- combat core (combat.js) ---
  combat: { critMul: 2, sneakMul: 2, dmgVar: 1, enemyDmgVar: 1, armorK: 12, dodgeCap: 0.75, knockBase: 3, knockFloorDiv: 2 },
  drops: { potionChance: 0.08, goldChance: 0.3, goldMin: 2, goldMax: 5, midasMin: 3, midasMax: 6, midasPerFloor: 2, scavChance: 0.2 },
  perk: {
    venomBase: 1, venomTurns: 3,
    execBase: 0.2, execBlood: 0.3,
    chainBase: 4, chainPerFloor: 2, chainRange: 8,
    berserkMax: 0.8, bloodFrenzyMul: 2, bloodFrenzyHp: 0.5, bloodlustMul: 1.75,
    cleaveFrac: 0.5, riposteChance: 0.2, phoenixFrac: 0.5
  },
  player: { regenEvery: 5, baseRegenEvery: 16, potCap: 3 },
  xp: { base: 12, perLevel: 11 },           // XP to next level = base + perLevel * level
  // --- enemy AI (enemies.js) ---
  enemyAi: {
    sightRange: 9, loseTrackDist: 14,
    smashCooldown: 2, breathCooldown: 3, defaultWindMul: 2, breathRange: 7, breathLength: 8,
    fleeSteps: 2, tiredTurns: 3,
    lungeEvery: 3,                 // goblins/skeletons (EN lunge:true) take an extra step every Nth turn while chasing: a kiter cannot back away forever
    enrageFrac: 0.5, enrageAtkMul: 1.4, enrageBreathCd: 2   // boss below this HP fraction: hits harder, breathes more often
  },
  // --- active abilities (abilities.js) ---
  ability: {
    dashRange: 3, dashCd: 6, phaseHunterCut: 2,
    bashCd: 7, bashStun: 2, bashStunBoss: 1,
    vanishCd: 9, vanishTurns: 3,
    boltCd: 7, boltCdMage: 6, boltMul: 1.4, boltAdd: 2, boltRange: 8
  },
  // --- floor features (features.js) ---
  merchant: {
    floors: [3, 6], weaponChance: 0.5, elixirHp: 10,
    price: { potion: [12, 2], fire: [22, 3], tele: [18, 2], gear: [40, 8], perk: [60, 10], elixir: [65, 8] }   // [base, per floor]
  },
  shrine: { healBase: 0.6, healBetter: 0.75, lossBase: 0.25, lossBetter: 0.15, sacrificeGold: 30, pactHp: 8, pactMinHp: 10, pactAtk: 3, blessHeal: 0.3 },
  // --- permanent progression (save.js, run.js) ---
  meta: {
    hpPerLevel: 6, atkPerLevel: 1, defPerLevel: 1, potPerLevel: 1, potMaxLevel: 4, goldPerLevel: 0.15,
    costGrowth: 0.5,                 // shop price = base * (level+1) * (1 + level * costGrowth)
    startScrollFireChance: 0.5
  },
  run: { winBonus: 150 }
};

// ===== Tables: enemies, perks, synergies, classes, gear traits, traps, shop, unlocks =====
const SHOP=[
 {k:'hp',n:'Hardy',d:'+6 starting HP',base:30},
 {k:'atk',n:'Sharpened',d:'+1 starting attack',base:55},
 {k:'pot',n:'Supplies',d:'+1 starting potion (and belt space), up to Lv '+BAL.meta.potMaxLevel,base:40,max:BAL.meta.potMaxLevel},
 {k:'goldp',n:'Greed',d:'+15% gold found',base:50},
 {k:'def',n:'Padded',d:'+1 starting defense',base:70}
];
const SHOPMAX=8;
function shopMax(s){return s.max||SHOPMAX;}   // per-item level cap (Supplies is capped lower: potions are limited by belt space)
const UNLOCKS=[
 {id:'rogue',n:'🗡 Rogue class',d:'High crit, double damage on unaware enemies, Vanish ability.',cost:150},
 {id:'mage',n:'🧙 Mage class',d:'Arcane Bolt from the start and an extra fireball scroll.',cost:200},
 {id:'warlord',n:'Perk: Warlord',d:'Adds Warlord (+3 attack, +1 defense) to the level-up pool.',cost:180},
 {id:'elixir',n:'Merchant: Elixir',d:'Merchants also stock an Elixir of Vigor (+10 max HP, full heal).',cost:110},
 {id:'scroll',n:'Starting scroll',d:'Begin every run with a random scroll (fireball or teleport).',cost:90},
 {id:'pick4',n:'Fourth choice',d:'Level-ups offer 4 perks to choose from instead of 3.',cost:220},
 {id:'shrine',n:'Shrine favour',d:'Shrines offer a safe Blessing and better odds when you pray.',cost:110},
 {id:'phoenix',n:'Perk: Phoenix Heart',d:'Adds Phoenix Heart (revive once per run) to the pool.',ach:'Defeat the dragon',chk:function(){return meta.wins>=1;},prog:function(){return meta.wins+'/1 wins';}},
 {id:'trapper',n:'Perk: Trapfinder',d:'Adds Trapfinder (see traps from 3 tiles, take half trap damage) to the pool.',ach:'Reach floor 4',chk:function(){return meta.best>=4;},prog:function(){return 'best floor '+meta.best+'/4';}},
 {id:'midas',n:'Perk: Midas Touch',d:'Adds Midas Touch (every kill drops gold) to the pool.',ach:'Slay 50 enemies in total',chk:function(){return meta.kills>=50;},prog:function(){return meta.kills+'/50 kills';}},
 {id:'sage',n:'Perk: Alchemist',d:'Adds Alchemist (potions heal 50% more) to the pool.',ach:'Slay an elite enemy',chk:function(){return meta.elites>=1;},prog:function(){return meta.elites+'/1 elites';}}
];
const EN={
 rat:{n:'Rat',e:'🐀',hp:6,atk:2,speed:2,pack:true,xp:3,minF:1,tr:'Fast pack animal: moves twice per turn and tries to surround you.'},
 goblin:{n:'Goblin',e:'👺',hp:10,atk:3,lunge:true,xp:5,minF:1,tr:'Plain melee brute. Lunges: takes an extra step every '+BAL.enemyAi.lungeEvery+' turns while chasing, so you cannot back away from it for long.'},
 archer:{n:'Archer',e:'🏹',hp:8,atk:4,range:6,cdmax:2,kite:true,xp:6,minF:2,tr:'Shoots from up to 6 tiles (needs a clear line). Keeps its distance and flees when you get close.'},
 skeleton:{n:'Skeleton',e:'💀',hp:15,atk:5,lunge:true,xp:8,minF:3,tr:'Tough melee fighter. Lunges like the goblin (an extra step every '+BAL.enemyAi.lungeEvery+' turns while chasing).'},
 ogre:{n:'Ogre',e:'👹',hp:26,atk:8,slowAct:true,xp:13,minF:3,tr:'Acts only every other turn, but hits very hard. The hourglass shows it is recovering.'},
 troll:{n:'Troll',e:'🧌',hp:34,atk:7,slow:true,wind:true,windMul:2,windMsg:'The Troll raises its club!',xp:16,minF:4,tr:'Slow, lots of HP. Winds up a club smash (red tiles) that hurts and knocks you back.'},
 warlock:{n:'Warlock',e:'🦹',hp:10,atk:6,range:6,cdmax:2,kite:true,xp:12,minF:5,tr:'Casts blasts from 6 tiles (needs a clear line). Keeps its distance.'},
 dragon:{n:'Dragon',e:'🐉',hp:520,atk:36,breath:true,windMul:2,windMsg:'The Dragon rears back, flames gathering!',xp:100,minF:99,boss:true,tr:'Boss: winds up a 3-wide fire breath (red tiles). Step out of it. Too heavy to push. Enrages at half health: hits much harder and breathes more often.'}
};
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
 {id:'pyro',n:'Pyromancer',d:'Fireball +50% damage, +1 scroll',f:p=>{p.fireMul+=0.5;G.inv.fire++;}},
 {id:'regen',n:'Regeneration',d:'+1 HP every 5 turns',f:p=>{p.regen+=1;}},
 {id:'treasure',n:'Treasure Hunter',d:'+25% gold found',f:p=>{p.goldMul+=0.25;}},
 // behaviour perks
 {id:'cleave',n:'Cleave',beh:1,d:'Melee hits also strike adjacent enemies for half damage'},
 {id:'venom',n:'Venom',beh:1,max:3,d:'Hits poison for 3 turns (+1 poison damage per level; halved on bosses)'},
 {id:'chain',n:'Chain Lightning',beh:1,d:'Kills zap the nearest visible enemy (once, no further chains)'},
 {id:'blood',n:'Bloodlust',beh:1,d:'After a kill, your next hit deals +75% damage'},
 {id:'riposte',n:'Riposte',beh:1,max:3,d:'20% chance per level to counterattack when hit in melee'},
 {id:'dash',n:'Dash',beh:1,act:1,d:'ACTIVE: move up to '+BAL.ability.dashRange+' tiles in a line as one turn (usable every '+BAL.ability.dashCd+' turns)'},
 {id:'arcane',n:'Arcane Bolt',beh:1,act:1,d:'ACTIVE: ranged blast at a visible enemy (usable every '+BAL.ability.boltCd+' turns; Mage '+BAL.ability.boltCdMage+')'},
 {id:'second',n:'Second Wind',beh:1,d:'Once per floor, a lethal hit leaves you at 1 HP instead'},
 {id:'glass',n:'Glass Cannon',beh:1,d:'+5 attack but -25% max HP',f:p=>{p.atk+=5;p.mhp=Math.max(8,Math.round(p.mhp*0.75));p.hp=Math.min(p.hp,p.mhp);}},
 {id:'scav',n:'Scavenger',beh:1,max:2,d:'Slain enemies drop an extra potion 20% of the time (per level)'},
 {id:'berserk',n:'Berserk',beh:1,d:'Up to +80% damage as your HP drops'},
 {id:'stone',n:'Stone Skin',beh:1,d:'The first hit you take each floor is negated'},
 {id:'exec',n:'Executioner',beh:1,d:'Instantly slay non-boss enemies below 20% HP after a hit'},
 // unlockable perks (only in the pool once unlocked in the title shop / by achievements)
 {id:'warlord',n:'Warlord',lock:'warlord',max:2,d:'+3 attack and +1 defense',f:p=>{p.atk+=3;p.def+=1;}},
 {id:'phoenix',n:'Phoenix Heart',lock:'phoenix',beh:1,d:'Once per run, a lethal hit revives you at half HP'},
 {id:'trapper',n:'Trapfinder',lock:'trapper',beh:1,d:'Spot traps from 3 tiles away; traps do half damage to you and poison is shorter'},
 {id:'midas',n:'Midas Touch',lock:'midas',beh:1,d:'Every slain enemy drops some gold'},
 {id:'sage',n:'Alchemist',lock:'sage',beh:1,max:2,d:'Potions heal 50% more (per level)'}
];
PERKS.forEach(p=>{if(!p.max)p.max=p.beh?1:5;});
const SYN=[
 {id:'vc',a:'venom',b:'cleave',n:'Toxic Sweep',d:'Cleave also spreads poison'},
 {id:'bv',a:'berserk',b:'vamp',n:'Blood Frenzy',d:'Lifesteal is doubled below half HP'},
 {id:'be',a:'blood',b:'exec',n:'Bloody Verdict',d:'Executioner threshold rises to 30%'},
 {id:'cv',a:'chain',b:'venom',n:'Storm Toxin',d:'Chain Lightning also poisons its target'},
 {id:'db',a:'dash',b:'arcane',n:'Phase Hunter',d:'Dash cuts Arcane Bolt cooldown by '+BAL.ability.phaseHunterCut}
];
const CLS={
 warrior:{n:'Warrior',e:'🛡',hp:42,atk:4,def:3,crit:0.05,fire:1,d:'42 HP, +3 defense, slow attack growth.',ab:'Shield Bash: hit an adjacent enemy, stun it for '+BAL.ability.bashStun+' turns and knock it back one tile (usable every '+BAL.ability.bashCd+' turns).'},
 mage:{n:'Mage',e:'🧙',hp:24,atk:4,def:0,crit:0.05,fire:2,d:'24 HP. Starts with Arcane Bolt (stronger, faster than the perk) and an extra fireball scroll.',ab:'Arcane Bolt: ranged blast at a visible enemy (usable every '+BAL.ability.boltCdMage+' turns).'},
 rogue:{n:'Rogue',e:'🗡',hp:34,atk:4,def:0,crit:0.12,fire:1,d:'34 HP, high crit. Your first attack on an enemy that has not noticed you deals double damage.',ab:'Vanish: enemies lose track of you for '+BAL.ability.vanishTurns+' turns (usable every '+BAL.ability.vanishCd+' turns). Attacking breaks it.'}
};
const LG={warrior:{hp:4,atkE:4},mage:{hp:3,atkE:3},rogue:{hp:3,atkE:2}};
const TR={
 cursed:{slot:'weapon',n:'Cursed',dv:3,minF:2,d:'+3 attack, but you lose 1 HP per kill.'},
 vamp:{slot:'weapon',n:'Vampiric',dv:-2,minF:1,d:'-2 attack, but heal 25% of damage dealt.'},
 brutal:{slot:'weapon',n:'Brutal',dv:2,minF:2,d:'+2 attack, but -10% crit chance.'},
 keen:{slot:'weapon',n:'Keen',dv:-1,minF:1,d:'-1 attack, but +15% crit chance.'},
 heavy:{slot:'armor',n:'Heavy',dv:2,minF:2,d:'+2 defense, but enemies get a free turn every 4th turn.'},
 spiked:{slot:'armor',n:'Spiked',dv:0,minF:1,d:'Melee attackers take 3 damage, but -1 attack.'},
 light:{slot:'armor',n:'Light',dv:-1,minF:1,d:'-1 defense, but +12% dodge.'},
 leaden:{slot:'armor',n:'Leaden',dv:2,minF:3,d:'+2 defense, but potions heal 40% less.'}
};
const TRAPS={spike:{n:'Spike trap',c:'#ff5a5a'},dart:{n:'Dart trap',c:'#7be04b'},alarm:{n:'Alarm trap',c:'#ffd24a'}};
