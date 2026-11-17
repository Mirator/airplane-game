// walk.js - player movement, auto-walk, Explore, and tap handling.

function tryMove(dx,dy){
 const p=G.p,nx=p.x+dx,ny=p.y+dy;
 if(inb(nx,ny)&&G.map[ix(nx,ny)]===5){
  if(G.keys>0){G.keys--;G.map[ix(nx,ny)]=4;msg('The key turns - the treasure room is open!');endTurn();return true;}
  msg('Locked. The key is carried by the marked elite (gold ring and star) on this floor.');render();return false;}
 if(merchantAt(nx,ny)){showShop();return false;}
 if(!walkable(nx,ny))return false;
 const e=enemyAt(nx,ny);
 if(e){playerAttack(e);endTurn();return true;}
 if(G.map[ix(nx,ny)]===3){G.map[ix(nx,ny)]=4;msg('You open the door.');endTurn();return true;}
 p.x=nx;p.y=ny;pickup();
 if(G.map[ix(nx,ny)]===2){msg('Stairs! Tap yourself to descend.');G.stopWalk=true;}
 endTurn();return true;
}
function wait(){msg('You wait.');endTurn();}
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
   else{msg('A trap blocks the way - walk around it.');stop();return;}
  }
  const nx=path[0][0],ny=path[0][1];
  if(enemyAt(nx,ny)){stop();return;}
  const dz=dangerSet();
  if(dz.size&&(dangerNear(dz)||dz.has(ix(nx,ny)))){msg('Danger tiles! Auto-walk stopped.');stop();return;}
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
 if(G.enemies.some(e=>e.awake&&G.vis[ix(e.x,e.y)])){msg('Enemy in sight - tap it to attack, or tap a tile to move.');render();return;}
 const dz=dangerSet();
 if(dz.size&&dangerNear(dz)){msg('Danger tiles nearby - step away first.');render();return;}
 // unnoticed enemies: keep exploring, but try not to step next to them
const tz=trapSet();
 const sleepers=G.enemies.filter(e=>!e.awake&&G.vis[ix(e.x,e.y)]);
 const near=new Set();for(const e of sleepers)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)near.add(ix(e.x+dx,e.y+dy));
 const search=function(avoid){
  const prev=new Map();prev.set(ix(p.x,p.y),-1);const q=[[p.x,p.y]];let goal=-1;
  for(let i=0;i<q.length&&goal<0;i++){const [x,y]=q[i];
   for(const [dx,dy] of DIRS){const nx=x+dx,ny=y+dy,k=ix(nx,ny);
    if(!inb(nx,ny)||prev.has(k)||!G.seen[k]||G.map[k]===0||G.map[k]===5||merchantAt(nx,ny)||tz.has(k)||enemyAt(nx,ny)||dz.has(k)||(avoid&&near.has(k)))continue;
    prev.set(k,ix(x,y));q.push([nx,ny]);
    if(!G.exp[k]||G.map[k]===3){goal=k;break;}}}
  return {prev:prev,goal:goal};
 };
 let res=search(sleepers.length>0);
 if(res.goal<0&&sleepers.length)res=search(false);
 const prev=res.prev;let goal=res.goal;
 if(goal<0){
  // go to stairs if seen
  for(let k=0;k<W*H;k++)if(G.map[k]===2&&G.seen[k]){const pa=bfsPath(p.x,p.y,k%W,Math.floor(k/W));if(pa&&pa.length){msg('Explored. Heading to the stairs.');startWalk(pa);return;}}
  msg('Nothing left to explore.');render();return;
 }
 const path=[];let k=goal;while(k!==ix(p.x,p.y)){path.push([k%W,Math.floor(k/W)]);k=prev.get(k);}
 startWalk(path.reverse(),{explore:true});
}
function itemName(it){
 const base={gold:'Gold pile',potion:'Health potion',fire:'Flame scroll',tele:'Teleport scroll',knife:'Throwing knife'}[it.t];
 return base||(gearName(it)+': '+itemDesc(it).replace(/\.$/,''));
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
 if(!inb(tx,ty)||!G.seen[ix(tx,ty)]||G.map[ix(tx,ty)]===0){msg('Tap an explored floor tile.');return;}
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
 {const tk=ix(tx,ty),rt=trapSet().has(tk);
  if(rt&&trapConfirm!==tk){const t=G.traps.find(a=>a.x===tx&&a.y===ty&&!a.done);trapConfirm=tk;msg(TRAPS[t.k].n+'! Tap it again if you really want to step on it.');return;}
  if(!rt)trapConfirm=-1;
  if(rt&&!adj){msg('Walk around the trap - Explore and auto-walk avoid it.');return;}}
 const e=enemyAt(tx,ty);
 if(e&&G.vis[ix(tx,ty)]){
  if(Math.abs(e.x-p.x)+Math.abs(e.y-p.y)===1){tryMove(e.x-p.x,e.y-p.y);return;}
  if(reachOk(e)){reachAttack(e);return;}
  const d=EN[e.t];
  msg((e.elite?'ELITE '+d.n+' '+e.name:d.n)+' HP '+e.hp+'/'+e.mhp+', ATK '+e.atk+'. '+d.tr+(e.pois?' Poisoned ('+e.pois.t+'t).':'')+(e.stun>0?' Stunned ('+e.stun+'t).':'')+(e.frz>0?' Frozen ('+e.frz+'t).':'')+(e.blind>0?' Blinded.':'')+(e.wind?' WINDING UP!':'')+(e.awake?'':' Unaware.'));
  const path=bfsPath(p.x,p.y,tx,ty);
  if(path&&path.length>1){path.pop();startWalk(path);}else msg("Can't reach it.");
  return;
 }
 const it=itemAt(tx,ty);if(it)msg(itemName(it)+'.');
 if(Math.abs(tx-p.x)+Math.abs(ty-p.y)===1){tryMove(tx-p.x,ty-p.y);return;}
 const path=bfsPath(p.x,p.y,tx,ty);
 if(!path||!path.length){msg("Can't reach that.");return;}
 startWalk(path);
}
