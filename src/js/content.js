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
const WNAMES=['Dagger','Short Sword','Mace','Longsword','Warhammer','Runeblade'];
const ANAMES=['Rags','Leather','Chainmail','Scale Mail','Plate','Dragon Mail'];
const THEMES=[
 {n:'The Crypt',wl:'#3d4678',wt:'#6d7ab8',we:'#252b52',wld:'#171a2e',wtd:'#272c4a',wed:'#0d0f1c',fa:'#a8996f',fb:'#b2a37a',fda:'#35322a',fdb:'#38352d',mw:'#3a4270',mf:'#cbbd90',mfd:'#8a8060'},
 {n:'The Caverns',wl:'#2d4a45',wt:'#5f9484',we:'#173029',wld:'#13211e',wtd:'#1f3631',wed:'#0a1411',fa:'#8a9a78',fb:'#94a482',fda:'#2b3328',fdb:'#2e362b',mw:'#2f5a50',mf:'#a8b890',mfd:'#6a7a5a'},
 {n:'The Embers',wl:'#5a2a22',wt:'#b0482e',we:'#2e100c',wld:'#241210',wtd:'#3a1b15',wed:'#140807',fa:'#a8704a',fb:'#b47a52',fda:'#3a2619',fdb:'#3e291c',mw:'#7a3224',mf:'#d08a58',mfd:'#7a5030'}
];
function themeOf(f){return f<=3?THEMES[0]:f<=6?THEMES[1]:THEMES[2];}
const ENAMES=['Gorak','Vexa','Morn','Sable','Thrain','Ilsa','Brakk','Nyx'],ETITLES=['the Cruel','the Bloodied','Ironhide','the Hungry','Gravecaller','Emberhand'];
const ABIL=[{k:'bash',cls:'warrior',e:'🛡',n:'Bash'},{k:'vanish',cls:'rogue',e:'👻',n:'Vanish'},{k:'dash',perk:'dash',e:'💨',n:'Dash'},{k:'bolt',perk:'arcane',e:'🔮',n:'Bolt'}];
