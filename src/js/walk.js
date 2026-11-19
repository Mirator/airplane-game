// walk.js - player movement, auto-walk, Explore, and tap handling.

function tryMove(dx,dy){
 const p=G.p,nx=p.x+dx,ny=p.y+dy;
 if(inb(nx,ny)&&G.map[ix(nx,ny)]===5){
  if(G.keys>0){G.keys--;G.map[ix(nx,ny)]=4;msg('Vault opened.');callout(nx,ny,'UNLOCKED','#ffd24a');endTurn();return true;}
  msg('Locked. The marked elite has the key.');render();return false;}
 if(merchantAt(nx,ny)){showShop();return false;}
 if(!walkable(nx,ny))return false;
 const e=enemyAt(nx,ny);
 if(e){if(canShoot(e))return mageShot(e);playerAttack(e);endTurn();return true;}
 if(G.map[ix(nx,ny)]===3){G.map[ix(nx,ny)]=4;msg('Door opened.');endTurn();return true;}
 p.x=nx;p.y=ny;pickup();
 if(waterSet().has(ix(nx,ny)))G.wade=1;
 if(G.map[ix(nx,ny)]===2){msg('On the stairs.');G.stopWalk=true;}
 endTurn();return true;
}
function wait(){msg('Wait.');endTurn();}
function startWalk(path,opts){
 opts=opts||{};
 const tok=++walkTok;
 const stop=function(){if(dest&&dest.tok===tok){dest=null;if(G)render();}};
 const step=function(){
  if(tok!==walkTok||!G||G.over||modalOpen()||!path.length)return;
  const p=G.p;
  const nx=path[0][0],ny=path[0][1];
  if(enemyAt(nx,ny)){stop();return;}
  const dz=dangerSet();
  if(dz.size&&(dangerNear(dz)||dz.has(ix(nx,ny)))){msg('Danger ahead. Stopped.');stop();return;}
  if(G.cracks.length&&crackSet().has(ix(nx,ny))){msg('Floor ahead is cracking.');stop();return;}
  if(G.map[ix(nx,ny)]!==3&&G.map[ix(nx,ny)]!==5)path.shift();
  const hp0=p.hp,v0=visIds(),f0=G.floor;G.stopWalk=false;
  if(!tryMove(nx-p.x,ny-p.y)){stop();return;}
  if(!G||G.over||G.floor!==f0||p.hp<hp0||G.stopWalk||modalOpen()){stop();return;}
  const v1=visIds();if(v1.some(id=>v0.indexOf(id)<0)){frameSight();stop();return;}
  if(opts.explore&&G.enemies.some(e=>e.awake&&G.vis[ix(e.x,e.y)])){frameSight();stop();return;}
  if(path.length)setTimeout(step,70);else{stop();if(opts.done&&G&&!G.over&&!modalOpen())opts.done();}
 };
 if(path.length){const l=path[path.length-1];dest={x:l[0],y:l[1],tok:tok};}
 step();
}
function explore(){
 if(!G||G.over||modalOpen())return;walkTok++;
 const p=G.p;
 if(G.enemies.some(e=>e.awake&&G.vis[ix(e.x,e.y)])){msg('Enemy in sight. Tap it, or Wait.');frameSight();render();return;}
 const dz=dangerSet();
 if(dz.size&&dangerNear(dz)){msg('Danger nearby: step away.');render();return;}
 // unnoticed enemies: keep exploring, but try not to step next to them
const cz=crackSet();
 // loot already seen and worth taking is a goal too (otherwise Explore says "nothing left" with gold lying in a visited room)
 const loot=new Set();
 for(const it of G.items){const k=ix(it.x,it.y);if(!G.seen[k]||it.skip||enemyAt(it.x,it.y))continue;
  if((it.t==='potion'&&G.inv.pot>=G.p.potCap)||(it.t==='knife'&&(G.knives||0)>=maxKnives()))continue;
  if(it.x===p.x&&it.y===p.y)continue;loot.add(k);}
 const sleepers=G.enemies.filter(e=>!e.awake&&G.vis[ix(e.x,e.y)]);
 const near=new Set();for(const e of sleepers)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)near.add(ix(e.x+dx,e.y+dy));
 const search=function(avoid){
  const prev=new Map();prev.set(ix(p.x,p.y),-1);const q=[[p.x,p.y]];let goal=-1;
  for(let i=0;i<q.length&&goal<0;i++){const [x,y]=q[i];
   for(const [dx,dy] of DIRS){const nx=x+dx,ny=y+dy,k=ix(nx,ny);
    if(!inb(nx,ny)||prev.has(k)||!G.seen[k]||G.map[k]===0||G.map[k]===5||merchantAt(nx,ny)||cz.has(k)||enemyAt(nx,ny)||dz.has(k)||(avoid&&near.has(k)))continue;
    prev.set(k,ix(x,y));q.push([nx,ny]);
    if(!G.exp[k]||G.map[k]===3||loot.has(k)){goal=k;break;}}}
  return {prev:prev,goal:goal};
 };
 let res=search(sleepers.length>0);
 if(res.goal<0&&sleepers.length)res=search(false);
 const prev=res.prev;let goal=res.goal;
 if(goal<0&&cz.size){
  // unexplored ground (or the stairs' way) exists only through a cracking tile: walk up to it and say so, instead of "nothing left" (Wait lets it settle)
  const q=[[p.x,p.y]],pv=new Map([[ix(p.x,p.y),-1]]);let g3=-1;
  for(let i=0;i<q.length&&g3<0;i++){const [x,y]=q[i];
   for(const [dx,dy] of DIRS){const nx=x+dx,ny=y+dy,k=ix(nx,ny);
    if(!inb(nx,ny)||pv.has(k)||!G.seen[k]||G.map[k]===0||G.map[k]===5||merchantAt(nx,ny)||enemyAt(nx,ny)||dz.has(k))continue;
    pv.set(k,ix(x,y));q.push([nx,ny]);
    if(!G.exp[k]||G.map[k]===3||loot.has(k)||G.map[k]===2){g3=k;break;}}}
  if(g3>=0){
   const full=[];let k=g3;while(k!==ix(p.x,p.y)){full.push([k%W,Math.floor(k/W)]);k=pv.get(k);}full.reverse();
   const i=full.findIndex(t=>cz.has(ix(t[0],t[1])));
   if(i>=0){msg('The floor is cracking ahead. Wait for it to settle.');if(i>0)startWalk(full.slice(0,i),{explore:true});else render();return;}
  }
 }
 if(goal<0){
  // go to stairs if seen
  for(let k=0;k<W*H;k++)if(G.map[k]===2&&G.seen[k]){const pa=bfsPath(p.x,p.y,k%W,Math.floor(k/W));if(pa&&pa.length){msg('Explored. To the stairs.');startWalk(pa);return;}}
  msg('Nothing left to explore.');render();return;
 }
 const path=[];let k=goal;while(k!==ix(p.x,p.y)){path.push([k%W,Math.floor(k/W)]);k=prev.get(k);}
 startWalk(path.reverse(),{explore:true});
}
function itemName(it){
 const base={gold:'Gold pile',potion:'Potion',fire:'Flames',tele:'Teleport',knife:'Knife',key:'Brass key'}[it.t];
 return base||(gearName(it)+': '+(it.tr&&TR[it.tr]?TR[it.tr].d:itemRuleShort(it)).replace(/\.$/,''));
}
// Stale taps. A tap lands where a foe WAS: it died to the previous tap, or it stepped away while the finger was on its way down. That must never
// turn into a walk. Rule: a tap on an EMPTY tile is ignored (no move, no turn) when (1) a foe left or died on that tile in the turn that has just
// resolved, less than BAL.ui.staleMs ago (it is what the player aimed at), or (2) it is the tile the previous tap attacked or closed in on, less
// than BAL.ui.burstMs after that tap (a burst of taps at one spot); every ignored burst tap extends that window. A foe standing on the tile NOW
// is attacked as usual; any other tap acts at once.
function markGone(x,y){if(goneT.size>64)goneT.clear();goneT.set(ix(x,y),performance.now());}
function staleTap(tx,ty){
 const k=ix(tx,ty),now=performance.now();
 if(enemyAt(tx,ty))return false;
 const g=goneT.get(k);
 if(g!=null&&now-g<BAL.ui.staleMs)return true;
 if(lastAtk&&lastAtk.k===k&&lastAtk.g===G&&now-lastAtk.t<BAL.ui.burstMs){lastAtk.t=now;return true;}
 return false;
}
function onTap(tx,ty){
 walkTok++;
 if(!G||G.over||modalOpen())return;
 const p=G.p;
 if(armed){
  if(!inb(tx,ty))return;
  if(ABIL[armed].tg==='self'){   // armed Cleave / Brace / Nova / Vanish: you or a lit tile uses it, anywhere else cancels (the tap is spent, it never walks)
   const k=armed;tapMark={x:tx,y:ty,t:performance.now()};
   if((tx===p.x&&ty===p.y)||targetTiles(k).some(t=>t[0]===tx&&t[1]===ty))useAbility(k);else cancelTarget();
   render();return;}
  if(tx===p.x&&ty===p.y){cancelTarget();return;}
  tapMark={x:tx,y:ty,t:performance.now()};
  useAbility(armed,tx,ty);
  render();return;
 }
 if(inb(tx,ty)){tapMark={x:tx,y:ty,t:performance.now()};render();}
 if(tx===p.x&&ty===p.y){
  const sh=G.shrine;
  if(sh&&!sh.used&&sh.x===p.x&&sh.y===p.y){showShrine();return;}
  const gi=G.items.find(i=>i.x===p.x&&i.y===p.y&&SLOTS.indexOf(i.t)>=0);
  if(gi&&gi.skip){gi.skip=0;gearQ=gi;showGear();return;}   // tap yourself on a gear item you declined: its card again
  if(G.map[ix(tx,ty)]===2)descend();else wait();return;}
 if(!inb(tx,ty)||!G.seen[ix(tx,ty)]||G.map[ix(tx,ty)]===0){msg('Tap an explored tile.');return;}
 if(staleTap(tx,ty)){msg('That foe is gone.');return;}
 const adj=Math.abs(tx-p.x)+Math.abs(ty-p.y)===1;
 if(merchantAt(tx,ty)){
  if(adj){showShop();return;}
  const mp=bfsPath(p.x,p.y,tx,ty);
  if(mp&&mp.length>1){mp.pop();startWalk(mp,{done:showShop});}else msg("Can't reach the merchant.");
  return;}
 if(G.map[ix(tx,ty)]===5){
  if(adj){tryMove(tx-p.x,ty-p.y);return;}
  const lp=bfsPath(p.x,p.y,tx,ty);
  if(lp&&lp.length>1){lp.pop();startWalk(lp,{done:function(){if(G&&!G.over)tryMove(tx-G.p.x,ty-G.p.y);}});}else msg("Can't reach the locked door.");
  return;}
 const e=enemyAt(tx,ty);
 if(!(e&&G.vis[ix(tx,ty)])){
  const pr=perilAt(ix(tx,ty));
  if(pr){ // a tile about to be hit: the first tap only marks it, a second tap on it goes ahead
   const now=performance.now();
   if(!(guard&&guard.k===ix(tx,ty)&&guard.f===G.floor&&now<guard.until)){
    guard={k:ix(tx,ty),x:tx,y:ty,f:G.floor,until:now+BAL.ui.guardMs};
    msg('Danger: tap again to go.');render();return;}
   guard.until=now+BAL.ui.guardMs;
   if(adj){guard=null;tryMove(tx-p.x,ty-p.y);return;}
   let best=null;
   for(const [dx,dy] of DIRS){const nx=tx+dx,ny=ty+dy;
    if(!walkable(nx,ny)||enemyAt(nx,ny)||perilAt(ix(nx,ny)))continue;
    const pa=bfsPath(p.x,p.y,nx,ny);if(pa&&pa.length&&(!best||pa.length<best.length))best=pa;}
   if(!best){msg("Can't reach that.");return;}
   startWalk(best,{done:function(){
    if(!G||G.over||modalOpen()||Math.abs(G.p.x-tx)+Math.abs(G.p.y-ty)!==1)return;
    guard=null;tryMove(tx-G.p.x,ty-G.p.y);}});
   return;
  }
  guard=null;
 }
 if(e&&G.vis[ix(tx,ty)]){
  lastAtk={k:ix(tx,ty),t:performance.now(),g:G};
  if(canShoot(e)){mageShot(e);return;}   // Mage: a free shot instead of walking up to it
  if(Math.abs(e.x-p.x)+Math.abs(e.y-p.y)===1){tryMove(e.x-p.x,e.y-p.y);return;}
  // melee is straight only (up / down / left / right): a foe on a diagonal cannot hit you either. A tap never steps out of position for it.
  if(cheb(e,p)===1&&!reachOk(e)){msg('Diagonal: no strike either way. Wait, or step in line.');return;}
  if(reachOk(e)){reachAttack(e);return;}
  const d=EN[e.t];   // short log line; hold the foe for the full card (trait, state)
  msg((e.elite?'ELITE '+d.n+' '+e.name:d.n)+' HP '+e.hp+'/'+e.mhp+', ATK '+e.atk+'.'+(e.wind?' WINDING UP!':'')+(e.awake?'':' Unaware.'));
  const path=bfsPath(p.x,p.y,tx,ty);
  if(path&&path.length>1){path.pop();startWalk(path);}else msg("Can't reach it.");
  return;
 }
 const it=itemAt(tx,ty);if(it)msg(itemName(it)+'.');
 if(Math.abs(tx-p.x)+Math.abs(ty-p.y)===1){tryMove(tx-p.x,ty-p.y);return;}
 const path=bfsPath(p.x,p.y,tx,ty);
 if(!path||!path.length){
  // no way round a red tile: walk up to it and stop (the tile itself is then tapped twice to cross)
  const raw=rawPath(p.x,p.y,tx,ty);
  if(raw&&raw.length){
   const i=raw.findIndex(t=>perilAt(ix(t[0],t[1])));
   if(i>=0){msg('Danger in the way.');if(i>0)startWalk(raw.slice(0,i));else render();return;}
  }
  msg("Can't reach that.");return;}
 startWalk(path);
}
// what makes a tile unsafe to step on right now: a wind-up tile (fires when this turn ends), a crack about to break
function perilAt(k){
 if(!G)return null;
 if(dangerSet().has(k))return 'danger';
 for(const c of G.cracks||[])if(ix(c.x,c.y)===k&&c.t<=1)return 'danger';
 return null;
}
// like bfsPath but through cracks and red tiles (used only to find out where a walk has to stop)
function rawPath(sx,sy,tx,ty){
 const prev=new Map(),start=ix(sx,sy);prev.set(start,-1);const q=[[sx,sy]],goal=ix(tx,ty);
 for(let i=0;i<q.length;i++){const [x,y]=q[i];if(ix(x,y)===goal)break;
  for(const [dx,dy] of DIRS){const nx=x+dx,ny=y+dy,k=ix(nx,ny);
   if(!inb(nx,ny)||prev.has(k)||!G.seen[k]||G.map[k]===0)continue;
   if(k!==goal&&(enemyAt(nx,ny)||G.map[k]===5||merchantAt(nx,ny)))continue;
   prev.set(k,ix(x,y));q.push([nx,ny]);}}
 if(!prev.has(goal))return null;
 const path=[];let k=goal;while(k!==start){path.push([k%W,Math.floor(k/W)]);k=prev.get(k);}
 return path.reverse();
}
