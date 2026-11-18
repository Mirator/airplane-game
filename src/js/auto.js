// auto.js - Auto (autopilot): plays the run by calling the same action functions a tap would (tryMove, useAbility, drink, descend, the dialog buttons).
// One decision per timer tick (one turn, or one dialog choice). It is deliberately a simple player: no kiting, no retreating to regenerate.

const AUTO_SPEED_KEY='dcr_auto_speed',RANGED=['cultist','archer','warlock'];
const AUTO={on:false,tm:null,pick:null,speed:1,self:false,uiKey:'',ignore:new Set(),shopped:{},bad:new Set(),uses:{},uses8:{},ticks:0,modals:0,idle:0,mrun:0,hold:0,lastProg:0,pf:0,pexp:0,hp:1e9,kills:0,err:null,lastStop:''};
try{const s=+localStorage.getItem(AUTO_SPEED_KEY);if(BAL.auto.speeds.indexOf(s)>=0)AUTO.speed=s;}catch(e){}
// what the player is told about Auto's pay: gold per hour (the 30-minute expedition rate at the current upgrade power; Heat does not change it)
function autoRateText(){return '~'+Math.max(1,Math.round(autoPerTurn()*1000))+' gold per 1000 turns';}
function autoDelay(flash){return Math.max(15,(flash?BAL.auto.flashMs:BAL.auto.tickMs)/AUTO.speed);}
// exactly one pending timer, ever: scheduling always cancels the previous one
function autoSchedule(ms){if(AUTO.tm)clearTimeout(AUTO.tm);AUTO.tm=setTimeout(autoTick,ms);}
function autoReset(){
 if(AUTO.tm){clearTimeout(AUTO.tm);AUTO.tm=null;}
 AUTO.on=false;AUTO.pick=null;AUTO.self=false;AUTO.ignore=new Set();AUTO.shopped={};AUTO.bad=new Set();AUTO.uses={};AUTO.uses8={};AUTO.ticks=0;AUTO.modals=0;AUTO.idle=0;AUTO.mrun=0;AUTO.hp=1e9;AUTO.kills=0;AUTO.err=null;AUTO.lastStop='';AUTO.pf=0;AUTO.pexp=0;AUTO.lastProg=0;AUTO.uiKey='';AUTO.fg=null;AUTO.sg=null;AUTO.last='';AUTO.tr=[];AUTO.pos=[];AUTO.loops=0;AUTO.hold=0;AUTO.crossed=0;
}
function autoStart(sync){
 if(!G||G.over||!G.auto||$('title').style.display!=='none')return false;
 walkTok++;armed=null;
 G.auto.on=1;AUTO.on=true;AUTO.pick=null;AUTO.idle=0;AUTO.mrun=0;AUTO.hp=1e9;AUTO.kills=G.kills;AUTO.pf=G.floor;AUTO.pexp=-1;AUTO.lastProg=G.turn;AUTO.lastStop='';AUTO.err=null;
 if(!G.auto.noticed){G.auto.noticed=1;const t='Auto pays '+autoRateText()+'.';msg(t);toast(t,4200);}
 AUTO.lastT=performance.now();
 msg('Auto on.');
 save();render();
 if(!sync)autoSchedule(autoDelay(false));
 return true;
}
// why = log line (null: none). quiet = no save/render (the run is ending or being replaced).
function autoStop(why,quiet){
 if(AUTO.tm){clearTimeout(AUTO.tm);AUTO.tm=null;}
 const was=AUTO.on;AUTO.on=false;
 if(AUTO.pick){try{AUTO.pick.btn.classList.remove('autopick');}catch(e){}AUTO.pick=null;}
 if(G&&G.auto)G.auto.on=0;
 if(!was)return;
 AUTO.lastStop=why||'run ended';
 if(quiet||!G||G.over)return;
 if(why)msg(why);
 save();render();
}
function autoToggle(){if(!G||G.over)return;if(AUTO.on)autoStop('Auto off.');else autoStart();}
function autoSpeedCycle(){
 const sp=BAL.auto.speeds;AUTO.speed=sp[(sp.indexOf(AUTO.speed)+1)%sp.length];
 try{localStorage.setItem(AUTO_SPEED_KEY,String(AUTO.speed));}catch(e){}
 if(AUTO.on&&AUTO.tm)autoSchedule(autoDelay(!!AUTO.pick));
 AUTO.uiKey='';autoUi();
}
// the top-bar strip (indicator, speed, stop; shown only while Auto runs) and the thin amber frame (called from updateHud, so it follows every render)
function autoUi(){
 const on=!!G&&!G.over&&!!(G.auto&&G.auto.on),key=(on?1:0)+'|'+AUTO.speed;
 if(key===AUTO.uiKey)return;AUTO.uiKey=key;
 $('autoBox').style.display=on?'flex':'none';
 $('autoBtn').setAttribute('aria-pressed',on?'true':'false');
 $('autoSpd').textContent=AUTO.speed+'×';
 $('cv').classList.toggle('auto',on);
}
$('autoBtn').addEventListener('click',function(){autoToggle();});
$('autoSpd').addEventListener('click',function(){autoSpeedCycle();});
// any tap that is not on the Auto controls gives control back. A tap on the map is swallowed (it must not also move you);
// a tap on a real button (potion, a dialog choice) stops Auto and then does what that button does.
document.addEventListener('click',function(ev){
 if(!AUTO.on||AUTO.self||!G||!G.auto||!G.auto.on)return;
 const t=ev.target;if(t&&t.closest&&t.closest('#autoBox'))return;
 autoStop('Auto off.');
 if(t===cv)ev.stopPropagation();
},true);
document.addEventListener('keydown',function(ev){
 if(!AUTO.on||AUTO.self||!G||!G.auto||!G.auto.on||ev.ctrlKey||ev.metaKey||ev.altKey||ev.key==='Shift')return;
 autoStop('Auto off.');ev.stopPropagation();ev.preventDefault();
},true);
document.addEventListener('visibilitychange',function(){if(document.hidden&&AUTO.on)autoStop('Page hidden: Auto paused.');});

function autoTick(){
 AUTO.tm=null;
 if(!AUTO.on)return;
 if(!G||G.over||!G.auto||!G.auto.on){autoStop(null,true);return;}
 if(document.hidden){autoStop('Page hidden: Auto paused.');return;}
 let r='off';
 {const now=performance.now();if(G.auto)G.auto.ms=(G.auto.ms|0)+Math.round(Math.min(now-(AUTO.lastT||now),4*BAL.auto.flashMs));AUTO.lastT=now;}   // real time played, one slow tick (a throttled page) never counts more than 4 flash delays
 try{r=autoStep(false);}catch(e){AUTO.err=String(e&&e.stack||e);autoStop('Auto stopped: internal error.');return;}
 if(AUTO.on)autoSchedule(autoDelay(r==='flash'));
}
// one decision. sync=true (simulator / tests) resolves dialogs at once instead of flashing them.
function autoStep(sync){
 if(!AUTO.on||!G||G.over||!G.auto)return 'off';
 if($('title').style.display!=='none'){autoStop('Auto paused: title screen.');return 'off';}
 AUTO.self=true;
 try{
  G.auto.used=1;AUTO.ticks++;
  if(sync)G.auto.ms=(G.auto.ms|0)+Math.round(autoDelay(false));   // simulator / tests: virtual time, as if the timer ran at the current speed
  const t0=AUTO.t0=G.turn;
  try{
   if($('modal').style.display!=='none')return autoModal(sync);
   return autoAct();
  }finally{if(G&&G.auto)G.auto.t=(G.auto.t|0)+Math.max(0,G.turn-t0);}
 }finally{AUTO.self=false;}
}

// ---------------- dialogs ----------------
function autoModal(sync){
 const box=$('modalBox');
 if(++AUTO.mrun>40){autoStop('Auto stopped: stuck in dialogs.');return 'off';}
 let pk=AUTO.pick;
 if(!pk||!box.contains(pk.btn)||pk.btn.disabled){
  pk=autoChoose(box.dataset.kind||'',box);
  if(!pk||!pk.btn){AUTO.pick=null;autoStop('Auto stopped: an unknown dialog needs you.');return 'off';}
  AUTO.pick=pk;pk.btn.classList.add('autopick');msg('Auto: '+pk.why);
  if(!sync)return 'flash';
 }
 AUTO.pick=null;pk.btn.classList.remove('autopick');AUTO.modals++;
 pk.btn.click();
 return 'modal';
}
function autoBtn(box,k){return box.querySelector('button[data-k="'+k+'"]:not(:disabled)');}
function autoChoose(kind,box){
 const p=G.p,A=BAL.auto,btns=[...box.querySelectorAll('button')].filter(b=>!b.disabled);
 if(kind==='perk'){
  const list=AUTO_PERKS[p.cls]||[],ids=btns.map(b=>b.dataset.k);
  const id=list.find(k=>ids.indexOf(k)>=0)||ids[0],b=autoBtn(box,id)||btns[0];
  return b?{btn:b,why:'takes perk '+((perkById(b.dataset.k)||{n:'?'}).n)+'.'}:null;
 }
 if(kind==='gear'){
  const it=G.items.find(i=>i.x===p.x&&i.y===p.y&&SLOTS.indexOf(i.t)>=0);
  const key=it?it.x+','+it.y+','+G.floor:null;
  if(key)AUTO.ignore.add(key);   // whichever way it goes, do not walk back for what is left on this tile
  if(it&&(it.t!=='off'||(OFF[it.k]&&OFF[it.k].cls===p.cls))&&autoGearScore(it.t,it)>autoGearScore(it.t,p.eq[it.t])+A.gearMargin)
   return {btn:autoBtn(box,'equip'),why:'equips the '+gearName(it)+'.'};
  return {btn:autoBtn(box,'leave'),why:'leaves the '+(it?gearName(it):'item')+'.'};
 }
 if(kind==='shrine'){
  const s=autoBtn(box,'bless')?'bless':autoBtn(box,'sac')?'sac':'leave';   // only options that cost no HP
  return {btn:autoBtn(box,s),why:s==='bless'?'takes the shrine blessing.':s==='sac'?'sacrifices gold at the shrine for a perk.':'leaves the shrine (no safe offer).'};
 }
 if(kind==='path'){
  const nf=G.floor+1,hp=p.hp/p.mhp,opts=(G.opts||[]).map((o,i)=>({o:o,i:i}));
  let best=opts.find(x=>!x.o.mod);   // plain floor by default
  if(hp>=A.branchHp){
   let rank=99;for(const x of opts){const r=AUTO_MODS.reward.indexOf(x.o.mod);if(x.o.mod&&r>=0&&r<rank){rank=r;best=x;}}
  }else if(!best){
   let rank=99;for(const x of opts){const r=AUTO_MODS.safe.indexOf(x.o.mod);if(r<rank){rank=r;best=x;}}
  }
  best=best||opts[0];
  const b=best&&autoBtn(box,'opt'+best.i);if(!b)return null;
  const m=best.o.mod?modOf(best.o.mod):null;
  return {btn:b,why:'takes the '+(m?m.n+' route':'plain floor')+' to floor '+nf+'.'};
 }
 if(kind==='shop'){
  const bi=autoShopBest(),m=G.merchant;
  if(bi>=0&&m&&autoBtn(box,'buy'+bi))return {btn:autoBtn(box,'buy'+bi),why:'buys '+m.stock[bi].n+'.'};
  return {btn:autoBtn(box,'leave'),why:'leaves the merchant.'};
 }
 const b=btns.find(x=>/^(got it|back|leave|resume|close|ok|continue)/i.test(x.textContent.trim()));
 return b?{btn:b,why:'closes the dialog.'}:null;
}
// a small, class-aware worth for an item in a slot: derived stats (read by briefly equipping it) plus trait adjustments. Off-hands / charms:
// any class-legal one beats an empty slot, but Auto never swaps one for another.
function autoGearScore(slot,it){
 if(!it)return slot==='weapon'||slot==='armor'?0:-1;
 if(slot==='off'||slot==='charm')return 2;
 const p=G.p,old=p.eq[slot],mage=p.cls==='mage';
 p.eq[slot]={t:it.t,k:it.k,v:it.v,tr:it.tr||null};const v=statVec(),sb=spellBase();p.eq[slot]=old;   // a mage's spells ignore the weapon's melee offset
 const TB={cursed:-5,heavy:-2,leaden:-2,brutal:-0.5,vamp:1.5,keen:1,spiked:0.5};
 return (mage?sb:v.attack)+v.defense*1.2+v.crit*0.15+v.dodge*0.15+v.spell*(mage?0.2:0.05)+v.mana*(mage?0.25:0.02)+(it.tr&&TB[it.tr]||0);
}
// merchant: potions first (up to the belt), then the best-scoring affordable upgrade. -1 = nothing worth buying.
function autoShopBest(){
 const m=G.merchant,p=G.p;if(!m)return -1;
 let bi=-1,bv=0;
 m.stock.forEach(function(it,i){
  if(it.sold||p.gold<it.price)return;let v=0;
  if(it.k==='pot')v=G.inv.pot<p.potCap?100:0;
  else if(it.k==='elixir')v=9;
  else if(it.k==='perk')v=perkPool().some(x=>x.id===it.id)?8:0;
  else if(it.k==='fire')v=G.inv.fire<2?5:0;
  else if(it.k==='gear'){const sl=it.item.t;if(sl!=='off'||(OFF[it.item.k]&&OFF[it.item.k].cls===p.cls)){const d=autoGearScore(sl,it.item)-autoGearScore(sl,p.eq[sl]);v=d>BAL.auto.gearMargin?3+d:0;}}
  if(v>bv){bv=v;bi=i;}
 });
 return bi;
}

// ---------------- watchdog ----------------
function autoCountExp(){let n=0;for(let i=0;i<G.exp.length;i++)if(G.exp[i])n++;return n;}
// progress = a new floor, a new explored tile, a kill, or a new low of the enemies' total HP on this floor (so a healer undoing our damage
// is not progress). Returns a reason string if Auto must switch off.
function autoWatch(t0,f0){
 const exp=autoCountExp();let prog=false,tot=0;
 for(const e of G.enemies)tot+=Math.max(0,e.hp);
 if(G.floor!==AUTO.pf){AUTO.pf=G.floor;AUTO.pexp=exp;AUTO.bad=new Set();AUTO.pos=[];AUTO.fg=null;AUTO.sg=null;AUTO.hp=tot;AUTO.kills=G.kills;prog=true;}
 else{
  if(exp>AUTO.pexp){AUTO.pexp=exp;prog=true;}
  if(G.kills>AUTO.kills){AUTO.kills=G.kills;prog=true;}
  if(tot<AUTO.hp){AUTO.hp=tot;prog=true;}
 }
 if(prog)AUTO.lastProg=G.turn;
 const idle=G.turn===t0&&G.floor===f0&&$('modal').style.display==='none';
 AUTO.idle=idle?AUTO.idle+1:0;
 if(G.turn-AUTO.lastProg>=BAL.auto.stuckTurns)return 'no progress for '+BAL.auto.stuckTurns+' turns'+(G.enemies.some(e=>e.t==='cultist'&&e.awake&&G.vis[ix(e.x,e.y)])?': a Cultist keeps healing its allies. Your move':'');
 if(AUTO.idle>=BAL.auto.idleTicks)return 'its actions had no effect';
 return '';
}

// ---------------- acting ----------------
function autoAct(){
 AUTO.mrun=0;
 const t0=G.turn,f0=G.floor;
 autoDecide();
 if(G.over||!AUTO.on)return 'off';
 const why=autoWatch(t0,f0);
 if(why){autoStop('Auto stopped: '+why+'.');return 'off';}
 return 'turn';
}
// who to shoot first: healers, then archers / warlocks, then the nearest
function autoPrio(e){return (e.t==='cultist'?-100:(e.t==='archer'||e.t==='warlock')?-50:0)+manh(e,G.p);}
// tough foes (a Guard's shield, an Ogre, a Troll, elites, the boss) are worth a stun / freeze / blind before trading blows; not if already disabled
function autoGuarded(e){return (e.t==='guard'||e.t==='ogre'||e.t==='troll'||e.elite||EN[e.t].boss)&&!(e.stun>0||e.frz>0||e.blind>0);}
function autoUse(k,tx,ty){
 if(whyNot(k))return false;
 if(ABIL[k].tg!=='self'&&!targetTiles(k).some(t=>t[0]===tx&&t[1]===ty))return false;
 const t=G.turn,f8=G.floor===MAXF;
 if(!useAbility(k,tx,ty)&&G.turn===t)return false;
 AUTO.uses[k]=(AUTO.uses[k]||0)+1;if(f8)AUTO.uses8[k]=(AUTO.uses8[k]||0)+1;
 return true;
}
function autoNote(s){(AUTO.tr||(AUTO.tr=[])).push(G.turn+':'+G.p.x+','+G.p.y+' '+s);if(AUTO.tr.length>24)AUTO.tr.shift();}   // short trail of what Auto did, for the dbg API / watchdog reports
function autoDid(fn){const t=G.turn,f=G.floor;fn();return G.turn!==t||G.floor!==f||G.over;}
// breadth-first search over explored tiles. block = tiles never entered; passEnemies = path through enemy tiles (the last step is an attack).
function autoBfs(block,passEnemies){
 const dist=new Int16Array(W*H).fill(-1),prev=new Int16Array(W*H).fill(-1),order=[],en=new Set(G.enemies.map(e=>ix(e.x,e.y)));
 const s=ix(G.p.x,G.p.y);dist[s]=0;const q=[s];
 for(let i=0;i<q.length;i++){
  const k=q[i],x=k%W,y=(k/W)|0;order.push(k);
  for(const [dx,dy] of DIRS){
   const nx=x+dx,ny=y+dy;if(!inb(nx,ny))continue;const nk=ix(nx,ny);
   if(dist[nk]>=0||!G.seen[nk]||G.map[nk]===0||G.map[nk]===5||merchantAt(nx,ny)||block.has(nk))continue;
   if(!passEnemies&&en.has(nk))continue;
   dist[nk]=dist[k]+1;prev[nk]=k;q.push(nk);
  }
 }
 return {dist:dist,prev:prev,order:order};
}
function autoFirstStep(r,goal){let k=goal;if(r.dist[k]<=0)return -1;while(r.prev[k]!==ix(G.p.x,G.p.y)){k=r.prev[k];if(k<0)return -1;}return k;}
function autoGo(r,goal,tag){
 const k=autoFirstStep(r,goal);if(k<0)return false;
 const x=k%W,y=(k/W)|0,p=G.p;
 autoNote(tag+'->'+(goal%W)+','+((goal/W)|0));
 if(autoDid(()=>tryMove(x-p.x,y-p.y))){AUTO.last=tag+':'+goal;return true;}
 AUTO.bad.add(tag+':'+goal);return false;   // the step was refused: do not pick this goal again on this floor
}
// nearest tile next to (x,y) that r can reach, or -1
function autoNextTo(r,x,y){let bk=-1,bd=1e9;for(const [dx,dy] of DIRS){const nx=x+dx,ny=y+dy;if(!inb(nx,ny))continue;const k=ix(nx,ny);if(r.dist[k]>=0&&r.dist[k]<bd){bd=r.dist[k];bk=k;}}return bk;}
function autoSidestep(dz,cz,tz){
 const p=G.p;let best=null,bs=-1e9;
 for(const [dx,dy] of DIRS){
  const nx=p.x+dx,ny=p.y+dy,k=ix(nx,ny);
  if(!walkable(nx,ny)||enemyAt(nx,ny)||G.map[k]===3||dz.has(k)||cz.has(k)||tz.has(k))continue;
  let s=0;for(const e of G.enemies)if(e.wind)s+=Math.abs(e.x-nx)+Math.abs(e.y-ny);
  if(s>bs){bs=s;best=[dx,dy];}
 }
 return !!best&&autoDid(()=>tryMove(best[0],best[1]));
}
function autoDecide(){
 const p=G.p,A=BAL.auto,me=ix(p.x,p.y),hpf=p.hp/p.mhp;
 AUTO.tr=AUTO.tr||[];
 const dz=dangerSet(),cz=crackSet(),tz=trapSet();
 const adj=G.enemies.filter(e=>!e.dead&&manh(e,p)===1);
 const awake=G.enemies.filter(e=>!e.dead&&e.awake&&G.vis[ix(e.x,e.y)]);
 // 0. loop breaker: 16 decisions with no enemy in sight that never left a 3-tile patch = two goals are tugging at each other; drop the one in use
 if(awake.length)AUTO.pos=[];
 else{
  AUTO.pos.push(me);if(AUTO.pos.length>16)AUTO.pos.shift();
  if(AUTO.pos.length>=16&&new Set(AUTO.pos).size<=3){
   if(AUTO.last)AUTO.bad.add(AUTO.last);if(AUTO.sg)AUTO.bad.add('sleeper:'+AUTO.sg.id);
   AUTO.fg=null;AUTO.sg=null;AUTO.last='';AUTO.pos=[];AUTO.loops++;autoNote('loop broken');
  }
 }
 // 1. telegraphed danger or a cracking tile under us: step off it
 if((dz.has(me)||cz.has(me))&&autoSidestep(dz,cz,tz))return;
 // 2. potion
 if(hpf<A.potionHp&&G.inv.pot>0&&p.hp<p.mhp&&autoDid(drink))return;
 if(awake.length||adj.length){
  // 3. scrolls: when surrounded or against an elite / the boss
  const big=awake.some(e=>e.elite||EN[e.t].boss);
  const stuck=G.turn-AUTO.lastProg>=Math.floor(A.stuckTurns/3);   // a long stalemate (usually a healer behind a tough front-liner): burn a scroll to break it
  if(G.inv.fire>0&&awake.length&&(adj.length>=A.surround||stuck||(big&&awake.some(e=>manh(e,p)<=6)))&&autoDid(fireball)){if(stuck)AUTO.lastProg=G.turn-Math.floor(A.stuckTurns/2);return;}
  if(G.inv.tele>0&&adj.length&&((G.inv.pot<=0&&adj.length>=A.surround&&hpf<A.scrollHp)||stuck)&&autoDid(teleport)){if(stuck)AUTO.lastProg=G.turn-Math.floor(A.stuckTurns/2);return;}
  // 4. class abilities, then plain melee / closing in
  if(autoAbilities(adj,awake,hpf))return;
  if(adj.length){
   const t=adj.slice().sort((a,b)=>(RANGED.indexOf(a.t)>=0?-100:0)+a.hp-(RANGED.indexOf(b.t)>=0?-100:0)-b.hp)[0];
   if(autoDid(()=>tryMove(t.x-p.x,t.y-p.y)))return;
  }
  if(awake.length){
   // melee foes are left to come to us for a few turns (a corridor beats open floor); shooters and healers are closed in on at once
   const far=awake.some(e=>RANGED.indexOf(e.t)>=0);
   if(!far&&AUTO.hold<A.hold){AUTO.hold++;autoNote('hold');wait();return;}
   const r=autoBfs(new Set([...dz,...tz]),false);let bk=-1,bd=1e9;
   for(const e of awake){const k=autoNextTo(r,e.x,e.y);if(k>=0&&r.dist[k]<bd){bd=r.dist[k];bk=k;}}
   if(bk>=0&&bd>0&&autoGo(r,bk,'foe'))return;
   // no free tile gets next to any awake foe (a corridor full of them): go through them, the first step attacks whatever blocks the way
   // (otherwise Auto walks off to explore and comes back, and never fights: the "combat stalemate" watchdog trips)
   {const r2=autoBfs(new Set([...dz,...tz]),true);let b2=-1,d2=1e9;
    for(const e of awake){const k=autoNextTo(r2,e.x,e.y);if(k>=0&&r2.dist[k]<d2){d2=r2.dist[k];b2=k;}}
    if(b2>=0&&d2>0&&autoGo(r2,b2,'push'))return;}
  }
 }else AUTO.hold=0;
 autoTravel(dz,cz,tz);
}
function autoAbilities(adj,awake,hpf){
 const p=G.p,A=BAL.auto,n=adj.length,S=A.surround;
 if(p.cls==='warrior'){
  if(n>=S){
   if(autoUse('cleave'))return true;
   if(hpf<A.braceHp&&!G.brace&&autoUse('brace'))return true;
   if(autoUse('bash',adj[0].x,adj[0].y))return true;
  }
  if(n){
   const t=adj.find(e=>e.wind||autoGuarded(e));if(t&&autoUse('bash',t.x,t.y))return true;
   if((p.rage||0)>=BAL.rage.max-10&&autoUse('cleave'))return true;
  }else{const c=targetTiles('charge').find(t=>{const e=enemyAt(t[0],t[1]);return e&&e.awake;});if(c&&autoUse('charge',c[0],c[1]))return true;}
 }else if(p.cls==='mage'){
  if((n>=S||adj.some(autoGuarded))&&autoUse('nova'))return true;
  if(n>=S){
   if(n>=3&&hpf<A.blinkHp){
    let best=null,bs=-1;for(const t of targetTiles('blink')){const d=Math.min(...awake.concat(adj).map(e=>Math.abs(e.x-t[0])+Math.abs(e.y-t[1])));if(d>bs){bs=d;best=t;}}
    if(best&&autoUse('blink',best[0],best[1]))return true;
   }
  }
  if(awake.length&&!whyNot('fire')){
   const R=BAL.ability.fire.radius+(eqKind('off')==='prism'?BAL.offhand.prismRadius:0);let best=null,bw=0;
   for(const t of targetTiles('fire')){let w=0;for(const e of awake)if(Math.max(Math.abs(e.x-t[0]),Math.abs(e.y-t[1]))<=R)w+=EN[e.t].boss?3:1;if(w>bw){bw=w;best=t;}}
   if(best&&bw>=2&&autoUse('fire',best[0],best[1]))return true;
  }
  const bt=targetTiles('bolt').map(t=>enemyAt(t[0],t[1])).filter(e=>e&&e.awake).sort((a,b)=>autoPrio(a)-autoPrio(b))[0];
  if(bt&&autoUse('bolt',bt.x,bt.y))return true;
 }else{
  if((n>=S||adj.some(autoGuarded))&&!whyNot('smoke')){
   const R=BAL.ability.smoke.radius+(eqKind('off')==='satchel'?BAL.offhand.satchelRadius:0);let best=null,bw=0;
   for(const t of targetTiles('smoke')){let w=0;for(const e of awake)if(!e.blind&&Math.max(Math.abs(e.x-t[0]),Math.abs(e.y-t[1]))<=R)w++;if(w>bw){bw=w;best=t;}}
   if(best&&(bw>=S||(bw>=1&&adj.some(autoGuarded)))&&autoUse('smoke',best[0],best[1]))return true;
  }
  if(n>=3&&hpf<A.vanishHp&&autoUse('vanish'))return true;
  const bs=adj.find(e=>!e.awake||e.stun>0||e.frz>0||e.blind>0||isBehind(e));
  if(bs&&autoUse('backstab',bs.x,bs.y))return true;
  if(!n){const kt=targetTiles('knife').map(t=>enemyAt(t[0],t[1])).filter(e=>e&&e.awake&&manh(e,p)>=2).sort((a,b)=>autoPrio(a)-autoPrio(b))[0];if(kt&&autoUse('knife',kt.x,kt.y))return true;}
 }
 return false;
}
// out of combat: loot, key door, merchant, shrine, unexplored ground, stairs, the dragon
function autoTravel(dz,cz,tz){
 const p=G.p,A=BAL.auto,fl=G.floor,me=ix(p.x,p.y);
 const block=new Set([...dz,...tz]);   // cracked tiles are not blocked: they only hurt whoever is still standing on one when they collapse, and Auto steps off at once
 let r=autoBfs(block,false);
 // items
 let bi=-1,bd=1e9;
 for(const it of G.items){
  const k=ix(it.x,it.y);if(r.dist[k]<=0||r.dist[k]>A.lootDist+(AUTO.last==='item:'+k?A.hysteresis:0)||r.dist[k]>=bd)continue;   // hysteresis: a goal being walked to is kept a little beyond the limit, or Auto flips between two goals at the border
  if(AUTO.ignore.has(it.x+','+it.y+','+fl)||AUTO.bad.has('item:'+k))continue;
  if(it.t==='potion'&&G.inv.pot>=p.potCap)continue;
  if(it.t==='knife'&&G.knives>=maxKnives())continue;
  bd=r.dist[k];bi=k;
 }
 if(bi>=0&&autoGo(r,bi,'item'))return;
 // locked treasure door (only with a key, and only if it is close)
 if(G.keys>0&&G.treasure&&G.map[ix(G.treasure.door[0],G.treasure.door[1])]===5){
  const dx=G.treasure.door[0],dy=G.treasure.door[1];
  if(Math.abs(dx-p.x)+Math.abs(dy-p.y)===1&&autoDid(()=>tryMove(dx-p.x,dy-p.y)))return;
  const k=autoNextTo(r,dx,dy);
  if(k>=0&&r.dist[k]>0&&r.dist[k]<=A.keyDist+(AUTO.last==='door:'+k?A.hysteresis:0)&&!AUTO.bad.has('door:'+k)&&autoGo(r,k,'door'))return;
 }
 // merchant
 const m=G.merchant;
 if(m&&G.seen[ix(m.x,m.y)]&&!AUTO.shopped[fl]&&autoShopBest()>=0){
  if(Math.abs(m.x-p.x)+Math.abs(m.y-p.y)===1){AUTO.shopped[fl]=1;showShop();return;}
  const k=autoNextTo(r,m.x,m.y);
  if(k>=0&&r.dist[k]>0&&!AUTO.bad.has('merch:'+k)&&autoGo(r,k,'merch'))return;
 }
 // shrine
 const sh=G.shrine;
 if(sh&&!sh.used&&!sh.left&&G.seen[ix(sh.x,sh.y)]){
  if(sh.x===p.x&&sh.y===p.y){showShrine();return;}
  const k=ix(sh.x,sh.y);
  if(r.dist[k]>0&&!AUTO.bad.has('shrine:'+k)&&autoGo(r,k,'shrine'))return;
 }
 // sleeping enemies in sight: walk up and strike first (sneak damage), unless HP is low. The target is remembered until it wakes or dies:
 // re-choosing every step flip-flops with the frontier goal whenever the sleeper drops out of sight.
 {const hpf=p.hp/p.mhp,sg=AUTO.sg;
  let be=sg&&sg.f===fl?G.enemies.find(e=>e.id===sg.id&&!e.dead&&!e.awake&&!AUTO.bad.has('sleeper:'+e.id)):null,bk=-1;
  if(be&&hpf>=A.sleeperHp-0.15){bk=autoNextTo(r,be.x,be.y);if(bk<0||r.dist[bk]<=0)be=null;}else be=null;
  if(!be){
   const sl=G.enemies.filter(e=>!e.dead&&!e.awake&&G.vis[ix(e.x,e.y)]&&!AUTO.bad.has('sleeper:'+e.id));
   if(sl.length&&hpf>=(sl.some(e=>e.elite)?A.sleeperEliteHp:A.sleeperHp)){
    let bd=1e9;
    for(const e of sl){const k=autoNextTo(r,e.x,e.y);if(k>=0&&r.dist[k]<bd){bd=r.dist[k];bk=k;be=e;}}
    if(!(bk>=0&&bd>0))be=null;
   }
  }
  if(be){AUTO.sg={id:be.id,f:fl};if(autoGo(r,bk,'sleeper'))return;AUTO.bad.add('sleeper:'+be.id);}
 }
 // unexplored ground: first keep clear of sleepers, then allow passing them, then path through them (= attack what blocks the way)
 const near=new Set();
 for(const e of G.enemies)if(!e.awake&&G.vis[ix(e.x,e.y)])for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)near.add(ix(e.x+dx,e.y+dy));
 const frontier=function(rr){for(const k of rr.order){if(k===me||AUTO.bad.has('front:'+k))continue;if(!G.exp[k]||G.map[k]===3)return k;}return -1;};
 let fk=-1;
 // sticky goal: keep walking to the frontier tile chosen earlier until it is explored (re-picking every step can flip-flop between two tiles)
 const g=AUTO.fg;
 if(g&&g.f===fl&&g.k!==me&&(!G.exp[g.k]||G.map[g.k]===3)&&!AUTO.bad.has('front:'+g.k)){
  const rs=[near.size?autoBfs(new Set([...block,...near]),false):null,autoBfs(block,false)];
  for(const x of rs)if(x&&x.dist[g.k]>0){fk=g.k;r=x;break;}
 }
 if(fk<0&&near.size){const r2=autoBfs(new Set([...block,...near]),false);fk=frontier(r2);if(fk>=0){r=r2;}}
 if(fk<0){r=autoBfs(block,false);fk=frontier(r);}
 if(fk<0){r=autoBfs(block,true);fk=frontier(r);}
 if(fk>=0){AUTO.fg={k:fk,f:fl};if(autoGo(r,fk,'front'))return;}
 // stairs
 for(let k=0;k<W*H;k++)if(G.map[k]===2&&G.seen[k]){
  if(k===me){descend();return;}
  let r2=autoBfs(block,false);if(r2.dist[k]<0)r2=autoBfs(block,true);
  if(r2.dist[k]>0&&autoGo(r2,k,'stairs'))return;
 }
 // the dragon lair has no stairs: walk up to the dragon
 const dr=G.enemies.find(e=>EN[e.t].boss);
 if(dr){const r2=autoBfs(block,true),k=autoNextTo(r2,dr.x,dr.y);if(k>=0&&r2.dist[k]>0&&autoGo(r2,k,'dragon'))return;}
 // last resort: the only way on is across a revealed trap (a spike / dart / alarm costs less than being stuck here)
 {const r3=autoBfs(new Set([...dz,...cz]),true);let fk3=-1;
  for(const k of r3.order){if(k===me||AUTO.bad.has('trapfront:'+k))continue;if(!G.exp[k]||G.map[k]===3||G.map[k]===2){fk3=k;break;}}
  if(fk3>=0&&r3.dist[fk3]>0){if(!AUTO.crossed){AUTO.crossed=1;msg('Auto: no other way on, so it crosses a trap.');}if(autoGo(r3,fk3,'trapfront'))return;}}
 autoNote('wait');wait();
}

// a phone turned sideways covers the game with a rotate hint (styles.css #rot): Auto must not keep playing unseen behind it
try{const mq=window.matchMedia('(orientation:landscape) and (max-height:520px) and (max-width:1000px)');
 const rotCheck=function(e){if(e.matches&&AUTO.on)autoStop('Auto paused: rotate your phone.');};
 if(mq.addEventListener)mq.addEventListener('change',rotCheck);else if(mq.addListener)mq.addListener(rotCheck);}catch(e){}
