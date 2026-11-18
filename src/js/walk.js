// walk.js - player movement, auto-walk, Explore, and tap handling.

function tryMove(dx,dy){
 const p=G.p,nx=p.x+dx,ny=p.y+dy;
 if(inb(nx,ny)&&G.map[ix(nx,ny)]===5){
  if(G.keys>0){G.keys--;G.map[ix(nx,ny)]=4;msg('Vault opened.');callout(nx,ny,'UNLOCKED','#ffd24a');endTurn();return true;}
  msg('Locked. The marked elite has the key.');render();return false;}
 if(merchantAt(nx,ny)){showShop();return false;}
 if(!walkable(nx,ny))return false;
 const e=enemyAt(nx,ny);
 if(e){playerAttack(e);endTurn();return true;}
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
  const p=G.p,tz=trapSet();
  if(tz.has(ix(path[0][0],path[0][1]))){
   const l=path[path.length-1],np=bfsPath(p.x,p.y,l[0],l[1]);
   if(np&&np.length&&!np.some(t=>tz.has(ix(t[0],t[1])))){path.length=0;for(const t of np)path.push(t);}
   else{msg('Trap ahead: go around.');stop();return;}
  }
  const nx=path[0][0],ny=path[0][1];
  if(enemyAt(nx,ny)){stop();return;}
  const dz=dangerSet();
  if(dz.size&&(dangerNear(dz)||dz.has(ix(nx,ny)))){msg('Danger ahead. Stopped.');stop();return;}
  if(G.cracks.length&&crackSet().has(ix(nx,ny))){msg('Floor ahead is cracking.');stop();return;}
  if(G.map[ix(nx,ny)]!==3&&G.map[ix(nx,ny)]!==5)path.shift();
  const hp0=p.hp,v0=visIds(),f0=G.floor;G.stopWalk=false;
  if(!tryMove(nx-p.x,ny-p.y)){stop();return;}
  if(!G||G.over||G.floor!==f0||p.hp<hp0||G.stopWalk||modalOpen()){stop();return;}
  const v1=visIds();if(v1.some(id=>v0.indexOf(id)<0)){stop();return;}
  if(opts.explore&&G.enemies.some(e=>e.awake&&G.vis[ix(e.x,e.y)])){stop();return;}
  if(path.length)setTimeout(step,70);else{stop();if(opts.done&&G&&!G.over&&!modalOpen())opts.done();}
 };
 if(path.length){const l=path[path.length-1];dest={x:l[0],y:l[1],tok:tok};}
 step();
}
function explore(){
 if(!G||G.over||modalOpen())return;walkTok++;
 const p=G.p;
 if(G.enemies.some(e=>e.awake&&G.vis[ix(e.x,e.y)])){msg('Enemy in sight.');render();return;}
 const dz=dangerSet();
 if(dz.size&&dangerNear(dz)){msg('Danger nearby: step away.');render();return;}
 // unnoticed enemies: keep exploring, but try not to step next to them
const tz=trapSet(),cz=crackSet();
 const sleepers=G.enemies.filter(e=>!e.awake&&G.vis[ix(e.x,e.y)]);
 const near=new Set();for(const e of sleepers)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)near.add(ix(e.x+dx,e.y+dy));
 const search=function(avoid){
  const prev=new Map();prev.set(ix(p.x,p.y),-1);const q=[[p.x,p.y]];let goal=-1;
  for(let i=0;i<q.length&&goal<0;i++){const [x,y]=q[i];
   for(const [dx,dy] of DIRS){const nx=x+dx,ny=y+dy,k=ix(nx,ny);
    if(!inb(nx,ny)||prev.has(k)||!G.seen[k]||G.map[k]===0||G.map[k]===5||merchantAt(nx,ny)||tz.has(k)||cz.has(k)||enemyAt(nx,ny)||dz.has(k)||(avoid&&near.has(k)))continue;
    prev.set(k,ix(x,y));q.push([nx,ny]);
    if(!G.exp[k]||G.map[k]===3){goal=k;break;}}}
  return {prev:prev,goal:goal};
 };
 let res=search(sleepers.length>0);
 if(res.goal<0&&sleepers.length)res=search(false);
 const prev=res.prev;let goal=res.goal;
 if(goal<0&&tz.size){
  // unexplored ground exists but only behind a revealed trap: walk up to the trap and stop there
  const q=[[p.x,p.y]],pv=new Map([[ix(p.x,p.y),-1]]);let g2=-1;
  for(let i=0;i<q.length&&g2<0;i++){const [x,y]=q[i];
   for(const [dx,dy] of DIRS){const nx=x+dx,ny=y+dy,k=ix(nx,ny);
    if(!inb(nx,ny)||pv.has(k)||!G.seen[k]||G.map[k]===0||G.map[k]===5||merchantAt(nx,ny)||cz.has(k)||enemyAt(nx,ny)||dz.has(k))continue;
    pv.set(k,ix(x,y));q.push([nx,ny]);
    if(!G.exp[k]||G.map[k]===3){g2=k;break;}}}
  if(g2>=0){
   const full=[];let k=g2;while(k!==ix(p.x,p.y)){full.push([k%W,Math.floor(k/W)]);k=pv.get(k);}full.reverse();
   const i=full.findIndex(t=>tz.has(ix(t[0],t[1])));
   if(i>0){msg('Trap in the way.');startWalk(full.slice(0,i),{explore:true});return;}
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
 const base={gold:'Gold pile',potion:'Potion',fire:'Flames',tele:'Teleport',knife:'Knife'}[it.t];
 return base||(gearName(it)+': '+itemRuleShort(it).replace(/\.$/,''));
}
function onTap(tx,ty){
 walkTok++;
 if(!G||G.over||modalOpen())return;
 const p=G.p;
 if(armed){
  if(!inb(tx,ty))return;
  if(tx===p.x&&ty===p.y){cancelTarget();return;}
  tapMark={x:tx,y:ty,t:performance.now()};
  useAbility(armed,tx,ty);
  render();return;
 }
 if(inb(tx,ty)){tapMark={x:tx,y:ty,t:performance.now()};render();}
 if(tx===p.x&&ty===p.y){
  const sh=G.shrine;
  if(sh&&!sh.used&&sh.x===p.x&&sh.y===p.y){showShrine();return;}
  if(G.map[ix(tx,ty)]===2)descend();else wait();return;}
 if(!inb(tx,ty)||!G.seen[ix(tx,ty)]||G.map[ix(tx,ty)]===0){msg('Tap an explored tile.');return;}
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
  if(pr){ // a revealed trap or a tile about to be hit: the first tap only marks it, a second tap on it goes ahead
   const now=performance.now();
   if(!(guard&&guard.k===ix(tx,ty)&&guard.f===G.floor&&now<guard.until)){
    guard={k:ix(tx,ty),x:tx,y:ty,f:G.floor,until:now+BAL.ui.guardMs};
    msg(pr==='trap'?'Trap: tap again to go.':'Danger: tap again to go.');render();return;}
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
  if(Math.abs(e.x-p.x)+Math.abs(e.y-p.y)===1){tryMove(e.x-p.x,e.y-p.y);return;}
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
  // no way round a trap / red tile: walk up to it and stop (the tile itself is then tapped twice to cross)
  const raw=rawPath(p.x,p.y,tx,ty);
  if(raw&&raw.length){
   const i=raw.findIndex(t=>perilAt(ix(t[0],t[1])));
   if(i>=0){msg(perilAt(ix(raw[i][0],raw[i][1]))==='trap'?'Trap in the way.':'Danger in the way.');if(i>0)startWalk(raw.slice(0,i));else render();return;}
  }
  msg("Can't reach that.");return;}
 startWalk(path);
}
// what makes a tile unsafe to step on right now: a revealed trap, a wind-up tile (fires when this turn ends), a crack about to break
function perilAt(k){
 if(!G)return null;
 if(dangerSet().has(k))return 'danger';
 if(trapSet().has(k))return 'trap';
 for(const c of G.cracks||[])if(ix(c.x,c.y)===k&&c.t<=1)return 'danger';
 return null;
}
// like bfsPath but through traps, cracks and red tiles (used only to find out where a walk has to stop)
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
