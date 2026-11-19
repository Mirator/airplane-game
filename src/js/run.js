// run.js - run lifecycle: starting a run, populating floors, descending, death tip and the end-of-run summary.

function makeEnemy(type,x,y,f){
 const d=EN[type],s=d.boss?1:1+BAL.enemy.hpPerFloor*(f-1)*(d.range?BAL.enemy.rangedHpFactor:1),sa=d.boss?1:1+BAL.enemy.atkPerFloor*(f-1)*(d.range?BAL.enemy.rangedAtkFactor:1);
 const fl=d.flat?1:s,fa=d.flat?1:sa;
 const em=enemyMul(d),ea=d.boss?1:(BAL.enemy.early[f-1]||1),hp=Math.round(d.hp*fl*em[0]*ea),e={id:G.nid++,t:type,x,y,hp,mhp:hp,atk:Math.round(d.atk*fa*em[1]*ea),awake:false,cd:0,face:pick(DIRS)};
 G.enemies.push(e);return e;
}
function stairsOk(){
 let t=G.map.indexOf(2);
 if(t<0){const d=G.enemies.find(e=>EN[e.t].boss);if(!d)return true;t=ix(d.x,d.y);}
 const p=G.p,blk=new Set(),seen=new Set([ix(p.x,p.y)]),q=[[p.x,p.y]];
 for(let i=0;i<q.length;i++){const [x,y]=q[i];
  for(const [dx,dy] of DIRS){const nx=x+dx,ny=y+dy,k=ix(nx,ny);
   if(!walkable(nx,ny)||seen.has(k)||blk.has(k))continue;seen.add(k);q.push([nx,ny]);}}
 if(!seen.has(t))return false;
 const m=G.merchant;
 if(m&&!DIRS.some(d=>seen.has(ix(m.x+d[0],m.y+d[1]))))return false;
 const sh=G.shrine;
 if(sh&&!seen.has(ix(sh.x,sh.y)))return false;
 return true;
}
// opt = {mod, v}: the floor modifier id (or null) and the theme variant, chosen on the previous floor's exit. A Daily floor is generated from
// the date, the depth and the option alone, so it comes out the same for everyone and whatever happened on earlier floors.
function newFloor(f,opt){
 opt=opt||{mod:null,v:0};
 G.mod=modOf(opt.mod)?opt.mod:null;G.variant=opt.v|0;
 if(G.daily)withStream(hashStr(G.daily+'|F'+f+'|'+G.variant+'|'+(G.mod||'-')),function(){buildFloor(f);});else buildFloor(f);
 const th=themeOf(f,G.variant),m=G.mod?modOf(G.mod):null;
 bannerText='Floor '+f+' - '+th.n;bannerUntil=performance.now()+1800;
 if(m){bannerText+=' - '+m.n;msg(m.n+': '+m.tip);}
 G.opts=null;
 if(f+1<MAXF)G.opts=rollOpts(f+1);
 computeVis();
}
function buildFloor(f){
 const g=genFloor(f);G.map=g.m;G.floor=f;G.enemies=[];G.items=[];G.shrine=null;G.merchant=null;G.treasure=null;G.ssUsed=0;G.swUsed=0;G.flask=0;G.smoke=[];G.brace=null;shrineQ=false;G.water=[];G.cracks=[];G.crackT=0;G.wade=0;G.fz=0;G.lsUsed=0;
 const MM=BAL.mod;
 G.seen=new Array(W*H).fill(false);G.exp=new Array(W*H).fill(false);
 const rooms=g.rooms,p=G.p;p.x=rooms[0].cx;p.y=rooms[0].cy;
 const taken=new Set([ix(p.x,p.y)]);
 const treRoll=rf()<BAL.floor.treasureChance,tre=(f>=BAL.floor.treasureFrom&&f<MAXF&&treRoll&&!modIs('horde'))?carveTreasure(rooms,f):null;
 const reach=bfsDist(p.x,p.y);
 function free(room,minD){
  for(let i=0;i<60;i++){
   const x=rnd(room.x,room.x+room.w-1),y=rnd(room.y,room.y+room.h-1),k=ix(x,y);
   if(G.map[k]===1&&!taken.has(k)&&reach[k]<9999&&(!minD||reach[k]>=minD)){taken.add(k);return [x,y];}
  }
  return null;
 }
 function addEnemy(type,room,x,y){return makeEnemy(type,x,y,f);}
 const others=f===MAXF?rooms.slice(1,-1):rooms.slice(1);
 if(f===MAXF){const r=rooms[rooms.length-1];taken.add(ix(r.cx,r.cy));addEnemy('dragon',r,r.cx,r.cy);}
 let n=BAL.spawn.enemyBase+Math.floor(f*BAL.spawn.enemyPerFloor)+rnd(0,BAL.spawn.enemyExtraMax);
 n-=BAL.spawn.earlyCut[f-1]||0;
 if(gHeat(G)>=2&&f>=2)n+=BAL.heat.extraFoes;
 if(modIs('horde'))n=Math.round(n*MM.horde.countMul);
 const pool=Object.keys(EN).filter(k=>!EN[k].boss&&EN[k].minF<=f&&(!EN[k].maxF||f<=EN[k].maxF)&&(!modIs('horde')||EN[k].hp<=MM.horde.maxHp));
 for(let i=0;i<n;i++){
  const r=pick(others),t=free(r);
  if(!t)continue;
  const type=pickW(Object.fromEntries(pool.map(k=>[k,EN[k]])));
  addEnemy(type,r,t[0],t[1]);
  const gr=EN[type].group;   // swarm types arrive as a pack in the same room
  if(gr){for(let j=rnd(gr[0],gr[1])-1;j>0;j--){const t2=free(r);if(t2)addEnemy(type,r,t2[0],t2[1]);}}
 }
 if(modIs('hunted'))addHunter(f,others,free,reach);
 // items
 function addItem(t,v,tr){const r=pick(rooms),pos=free(r);if(pos)G.items.push({x:pos[0],y:pos[1],t,v,tr:tr||null});}
 for(let i=0;i<BAL.spawn.goldPiles;i++)addItem('gold',rnd(BAL.spawn.goldMin,BAL.spawn.goldMax)+f*BAL.spawn.goldPerFloor);
 addItem('potion',0);if(rf()<(G.hard?BAL.hard.bonusPotion:BAL.spawn.extraPotionChance))addItem('potion',0);
 function addGear(slot){const g=newGear(slot,f,false),r=pick(rooms),pos=free(r);if(pos)G.items.push({x:pos[0],y:pos[1],t:g.t,k:g.k,v:g.v,tr:g.tr});}
 if(rf()<BAL.spawn.weaponChance)addGear('weapon');
 if(rf()<BAL.spawn.armorChance)addGear('armor');
 if(rf()<BAL.gear.offChance)addGear('off');
 if(rf()<BAL.gear.charmChance)addGear('charm');
 if(rf()<BAL.spawn.fireChance)addItem('fire',0);
 if(rf()<BAL.spawn.teleChance)addItem('tele',0);
 // modifier loot
 {const gold=()=>addItem('gold',rnd(BAL.spawn.goldMin,BAL.spawn.goldMax)+f*BAL.spawn.goldPerFloor),gear=()=>addGear(pick(['weapon','armor','off','charm']));
  if(modIs('dark')){for(let i=0;i<MM.dark.extraGold;i++)gold();for(let i=0;i<MM.dark.extraPotions;i++)addItem('potion',0);if(rf()<MM.dark.gearChance)gear();}
  if(modIs('flooded'))for(let i=0;i<MM.flooded.extraGold;i++)gold();
  if(modIs('rich'))for(let i=0;i<MM.rich.extraGold;i++)gold();
  if(modIs('unstable')){for(let i=0;i<MM.unstable.extraGear;i++)gear();for(let i=0;i<MM.unstable.extraGold;i++)gold();}}
 // locked treasure room + marked elite carrying the key
 if(tre){
  const cands=G.enemies.filter(e=>!EN[e.t].boss&&reach[ix(e.x,e.y)]<9999);
  if(!cands.length){G.map[ix(tre.door[0],tre.door[1])]=4;}
  else{
   const e=pick(cands);e.elite=1;e.name=pick(ENAMES)+' '+pick(ETITLES);e.mhp=Math.round(e.mhp*BAL.enemy.eliteHpMul*(gHeat(G)>=3?BAL.heat.eliteHpMul:1));e.hp=e.mhp;e.atk=Math.round(e.atk*BAL.enemy.eliteAtkMul*(gHeat(G)>=3?BAL.heat.eliteAtkMul:1))+BAL.enemy.eliteAtkAdd;
   const g1=forcedGear(f,pick(BAL.treasure.gearSlots)),cs=shuf(tre.cells.slice());
   G.items.push({x:cs[0][0],y:cs[0][1],t:g1.t,k:g1.k,v:g1.v,tr:g1.tr});
   G.items.push({x:cs[1][0],y:cs[1][1],t:'gold',v:BAL.treasure.gold1Base+f*BAL.treasure.gold1PerFloor});
   G.items.push({x:cs[2][0],y:cs[2][1],t:'gold',v:BAL.treasure.gold2Base+f*BAL.treasure.gold2PerFloor});
   if(rf()<BAL.treasure.potionChance)G.items.push({x:cs[3][0],y:cs[3][1],t:'potion',v:0});
   G.treasure={door:tre.door};
  }
 }
 // shrine
 const shrRoll=rf()<BAL.floor.shrineChance;
 if(f>=BAL.floor.shrineFrom&&f<MAXF&&(shrRoll||modIs('cursed'))){let t=null;for(let a=0;a<(modIs('cursed')?10:1)&&!t;a++)t=free(pick(others));if(t)G.shrine={x:t[0],y:t[1],used:0,left:0};}
 // merchant
 if(BAL.merchant.floors.includes(f)){
  for(let a=0;a<40&&!G.merchant;a++){
   const t=free(a<30?pick(others):rooms[0]);if(!t)continue;
   G.merchant={x:t[0],y:t[1],stock:[]};
   if(!stairsOk()){G.merchant=null;}   // never in the way of the stairs, not even on the last tries (no merchant is better than a blocked floor)
  }
  if(G.merchant)G.merchant.stock=buildStock(f);
 }
 if(modIs('flooded'))placeWater(rooms,taken);
}
// opts.daily: a Daily run (seeded from today's date). Otherwise a normal run, on Hard if the title toggle is on (a Daily is never Hard,
// so every Daily is the same game for everyone).
function startRun(cls,opts){
 opts=opts||{};
 if(!CLS[cls]||(cls!=='warrior'&&!meta.unl[cls]))cls='warrior';const C=CLS[cls];
 const daily=opts.daily?todayKey():null,heat=daily?0:(opts.heat!=null?Math.max(0,Math.min(heatMax(),opts.heat|0)):heatSel()),hard=heat>=1;
 const potV=upBonus('pot'),startPots=Math.max(0,1+potV-(hard?BAL.hard.startPotions:0));
 const hpB=upBonus('hp'),p={x:0,y:0,cls:cls,hp:C.hp+hpB,mhp:C.hp+hpB,atk:C.atk+upBonus('atk'),def:C.def+upBonus('def'),
  eq:{weapon:{t:'weapon',k:C.start,v:0,tr:null},armor:null,off:null,charm:null},rage:0,mana:0,mf:0,mbase:C.mana,
  xp:0,lvl:1,gold:0,potCap:Math.max(BAL.player.potCap,1+potV),life:0,crit:C.crit,renew:0,thorns:0,dodge:0,xpMul:1+upBonus('xpf')/100,fireMul:1,regen:0,goldMul:1+upBonus('goldp')/100,dmgMul:1};
 G={ver:SAVE_VER,auto:{on:0,used:0,noticed:0,ms:0,t:0},hard:hard?1:0,heat:heat,daily:daily,rs:0,mod:null,variant:0,opts:null,water:[],cracks:[],crackT:0,wade:0,stats:{pots:0,dragonHit:0},floor:1,p,inv:{pot:startPots,fire:C.fire,tele:0},enemies:[],items:[],log:[],turn:0,nid:1,pending:0,kills:0,over:false,won:false,stopWalk:false,perks:{},cd:{},syn:{},bl:0,ssUsed:0,swUsed:0,flask:0,vanish:0,brace:null,smoke:[],knives:cls==='rogue'?BAL.ability.knife.max:0,shrine:null,merchant:null,treasure:null,keys:0,picks:[],killer:'',fz:0,lsUsed:0};
 for(const q of PAIRS){const l=upLvl(q.k);if(l>0)pairVar(q).f(p,l,G);}
 for(const k of C.kit)G.cd[k]=0;
 autoReset();
 rngS=daily?{a:hashStr(daily+'|combat')}:null;
 p.mana=mmax();
 if(meta.unl.scroll){const k=rf()<BAL.meta.startScrollFireChance?'fire':'tele';G.inv[k]++;}
 if(daily){const d=meta.dly[daily]||(meta.dly[daily]={att:0});if(!d.att)meta.dlyN++;d.att++;saveMeta();checkAch();}
 noticeOld=false;gearQ=null;armed=null;dest=null;tapMark=null;bigMap=false;newFloor(1);
 msg(C.n+' descends'+(daily?' · Daily '+daily:heat>1?' · Heat '+heat:hard?' · Hard':'')+'.');if(meta.unl.scroll)msg('Starting scroll: '+(G.inv.fire>C.fire?'Flames.':'Teleport.'));
 hideTitle();closeModal();save();render();
 if(!meta.seenHelp){meta.seenHelp=1;saveMeta();showHelp(closeModal);}
}
function deathTip(){
 const k=(G.killer||'').toLowerCase();
  if(/poison/.test(k))return 'A potion cures poison. Drink before it stacks with hits.';
 if(/archer|warlock/.test(k))return 'Break the line of sight around a corner, then close in.';
 if(/troll|dragon/.test(k))return 'Red tiles mark the next big hit. One step off and it misses.';
 if(/guard/.test(k))return 'Guards block '+pct(1-BAL.weapon.shieldFront)+' from the front. Stun them (Bash, Charge, Nova) or hit from behind.';
 if(/hound/.test(k))return 'Hounds move twice per turn. Fight them in melee or stun them.';
 if(/cultist/.test(k))return 'Cultists heal allies. Dive them first: Charge, Blink or a knife.';
 if(/\b(rat|bat|whelp)\b/.test(k))return 'Hold a corridor, or use Cleave, Nova, Fireball or Smoke.';
 if(/ogre/.test(k))return 'Hit while the hourglass shows, then step back.';
 if(/wall|impact/.test(k))return 'Knockback into walls adds damage. Keep open floor behind you.';
 if(/shrine|curse/.test(k))return 'Shrine gambles and cursed gear cost HP. Check your HP first.';
 if(/elite/.test(k))return 'Elites are tough. Lure them into a corridor or use Flames.';
 if(G.auto&&G.auto.used)return 'Auto never retreats or kites. Take over for packs and bosses.';   // not "you died holding...": the player did not choose when to drink
 if(G.inv.pot>0)return 'You died holding '+G.inv.pot+' potion'+(G.inv.pot>1?'s':'')+'. Drink at about 40% HP.';
 if(G.p.hp<=0&&G.inv.fire>0)return 'You died holding Flames. Use them when a crowd closes in.';
 return 'Fight in corridors and doorways so only one foe reaches you.';
}
function finish(kind){
 autoStop(null,true);G.over=true;armed=null;gearQ=null;const p=G.p;walkTok++;
 const won=kind==='win',dead=kind==='dead',hard=!!G.hard,heat=gHeat(G),aut=!!(G.auto&&G.auto.used);
 // Auto: the time it played is paid at the idle rate; only the turns the player played themselves keep their share of the run gold
 const rb=runBank(G,won),bonus=rb.bonus,share=rb.share,idle=rb.idle,banked=rb.banked;   // Heat multiplies run gold only: idle pay is by turns played, not by the dungeon. The HUD shows this same number
 G.stats.win=won?1:0;
 const score=scoreOf(G,won);
 meta.gold+=banked;if(won)meta.wins++;meta.best=Math.max(meta.best,G.floor);
 const newRec=recordRun(kind,score);
 const heatUp=won&&!G.daily?heatAfterWin(heat):0,bpD=bpRunDrop(won);
 if(won&&G.daily)earn('daily');
 saveMeta();checkAch();clearSave();
 computeVis();render();
 if(dead){sfx('death');buzz([80,40,120]);}else if(won)sfx('win');
 const kl=G.killer||'unknown causes',killTxt=/^(a |an |poison|your )/.test(kl)?kl:'the '+kl;
 const tags=(G.daily?' &middot; '+ic('cal',16)+' Daily':'')+(hard?' &middot; '+ic('skull',16)+' '+(heat>1?'Heat '+heat:'Hard'):'')+(aut?' &middot; <em class="tag act">Auto</em>':'');
 showModal((dead?'You Died':won?'Victory!':'Run Ended'),
  '<p class="sub">'+(won?'The dragon falls.':dead?'Killed by <b>'+killTxt+'</b>.':'You left the dungeon.')+'</p>'+
  '<div class="portrait">'+ic(clsOf(p).e,56)+'</div><p class="recap"><b>'+clsOf(p).n+'</b> Lv '+p.lvl+tags+'</p><div class="chips3"><span>Floor <b>'+G.floor+'</b></span><span><b>'+G.turn+'</b> turns</span><span><b>'+G.kills+'</b> kills</span></div>'+
  '<p class="recap">Gold <span class="gold">+'+banked+'</span>'+(bonus?' <small>(incl. '+BAL.run.winBonus+' win bonus)</small>':'')+(hard?' <small>('+(heat>1?'Heat '+heat:'Hard')+' ×'+heatGold(heat)+')</small>':'')+' &middot; Score <b class="gold" id="scoreTxt">'+score+'</b>'+(newRec.length?'<br><b style="color:#8fe39a">NEW RECORD: '+newRec.join(', ')+'</b>':'')+'</p>'+
  (aut?'<p id="autoRecap" class="sub">'+ic('auto',16)+' Auto played '+autoTurns(G)+' turns: idle pay '+idle+' gold'+(share<1?', plus run gold of yours':'')+'.</p>':'')+
  (bpD?'<p class="recap" id="bpRecap">'+ic(bpIcon(bpD),20)+' Blueprint found: <b>'+bpD.n+'</b></p>':'')+
  (heatUp?'<p class="recap" id="heatRecap">'+ic('skull',16)+' <b>Heat '+heatUp+'</b> unlocked: '+HEAT[heatUp].n+'.</p>':'')+
  (G.newUnl&&G.newUnl.length?'<p class="recap">New unlock: <b>'+G.newUnl.join(', ')+'</b></p>':'')+
  (G.newAch&&G.newAch.length?'<p class="recap">'+ic('trophy',18)+' Achievement: <b>'+G.newAch.join(', ')+'</b></p>':'')+
  (dead?'<p class="sub tip"><b>Tip:</b> '+deathTip()+'</p>':''),
  [{label:'Back to title',c:1,big:1,fn:function(){closeModal();G=null;rngS=null;showTitle();}}],'end',won?ic('trophy',40):dead?ic('skull',40):'');
 $('modalBox').classList.add(dead?'dead':won?'win':'x');
}

// Tapping the stairs: below floor 1..MAXF-2 you choose between two floors; into the dragon lair there is only one way.
function descend(){
 if(!G||G.over)return;
 if(G.map[ix(G.p.x,G.p.y)]!==2){msg('No stairs here. Stand on the ▼ tile first.');return;}
 walkTok++;
 if(G.pending>0&&!spendNow&&!AUTO.on&&G.nudge!==G.floor){G.nudge=G.floor;msg('A perk is waiting. Pick it, or tap Stairs again.');showPerk();return;}   // one gentle nudge per floor
 const nf=G.floor+1;
 if(nf<MAXF){if(!G.opts)G.opts=rollOpts(nf);showBranch();return;}
 goDown({mod:null,v:0});
}
function goDown(opt){
 if(!G||G.over)return;
 walkTok++;sfx('stairs');
 G.stopWalk=false;
 if(G.mod)meta.mods[G.mod]=1;   // survived a floor of this modifier
 newFloor(G.floor+1,opt);
 const p=G.p;
 if(p.renew>0){p.hp=Math.min(p.mhp,p.hp+Math.round(p.mhp*p.renew));}
 if(G.floor===BAL.ach.noArmorFloor&&!p.eq.armor)earn('bare');
 meta.best=Math.max(meta.best,G.floor);if(!AUTO.self)meta.bestM=Math.max(meta.bestM|0,G.floor);saveMeta();checkAch();   // bestM = the deepest floor the player reached by hand: it limits how deep expeditions go
 msg('Floor '+G.floor+' - '+themeOf(G.floor,G.variant).n+(G.floor===MAXF?' (dragon lair!)':'')+'.');
 save();render();
}
