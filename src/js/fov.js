// fov.js - line of sight, field of view, breadth-first distance maps and click-to-walk path finding.

function los(x0,y0,x1,y1,ub){
 let dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,err=dx-dy,x=x0,y=y0;
 while(!(x===x1&&y===y1)){
  if(!(x===x0&&y===y0)){const t=G.map[ix(x,y)];if(t===0||t===3||t===5)return false;if(ub&&enemyAt(x,y))return false;}
  const e2=2*err;
  if(e2>-dy){err-=dy;x+=sx;}
  if(e2<dx){err+=dx;y+=sy;}
 }
 return true;
}
function bfsDist(sx,sy){
 const d=new Array(W*H).fill(9999);d[ix(sx,sy)]=0;const q=[[sx,sy]];
 for(let i=0;i<q.length;i++){const [x,y]=q[i];
  for(const [dx,dy] of DIRS){const nx=x+dx,ny=y+dy;
   if(walkable(nx,ny)&&d[ix(nx,ny)]===9999){d[ix(nx,ny)]=d[ix(x,y)]+1;q.push([nx,ny]);}}}
 return d;
}

function computeVis(){
 const p=G.p,R=visRadius();G.vis=new Array(W*H).fill(false);
 for(let y=p.y-R;y<=p.y+R;y++)for(let x=p.x-R;x<=p.x+R;x++){
  if(!inb(x,y))continue;
  if((x-p.x)*(x-p.x)+(y-p.y)*(y-p.y)>R*R+1)continue;
  if(!los(p.x,p.y,x,y))continue;
  const i=ix(x,y);G.vis[i]=true;G.seen[i]=true;
  if(G.map[i]!==0){G.exp[i]=true;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(inb(x+dx,y+dy))G.seen[ix(x+dx,y+dy)]=true;}
 }
 const rr=pc('trapper')?BAL.vis.trapfinderRange:1;
 for(const t of G.traps)if(!t.rev&&!t.done&&Math.max(Math.abs(t.x-p.x),Math.abs(t.y-p.y))<=rr&&(rr===1||los(p.x,p.y,t.x,t.y))){t.rev=1;G.seen[ix(t.x,t.y)]=true;msg('You spot '+(t.k==='alarm'?'an ':'a ')+TRAPS[t.k].n.toLowerCase()+'!');}
 eliteWatch();
}

function bfsPath(sx,sy,tx,ty){
 const dz=dangerSet(),tz=trapSet(),cz=crackSet();
 const prev=new Map(),start=ix(sx,sy);prev.set(start,-1);const q=[[sx,sy]];
 const goal=ix(tx,ty);
 for(let i=0;i<q.length;i++){const [x,y]=q[i];if(ix(x,y)===goal)break;
  for(const [dx,dy] of DIRS){const nx=x+dx,ny=y+dy,k=ix(nx,ny);
   if(!inb(nx,ny)||prev.has(k)||!G.seen[k]||G.map[k]===0||dz.has(k)||(cz.has(k)&&k!==goal))continue;
   if(k!==goal&&(enemyAt(nx,ny)||G.map[k]===5||merchantAt(nx,ny)||tz.has(k)))continue;
   prev.set(k,ix(x,y));q.push([nx,ny]);}}
 if(!prev.has(goal))return null;
 const path=[];let k=goal;while(k!==start){path.push([k%W,Math.floor(k/W)]);k=prev.get(k);}
 return path.reverse();
}
function visIds(){return G.enemies.filter(e=>G.vis[ix(e.x,e.y)]).map(e=>e.id);}
