// mapgen.js - dungeon layout: rooms, corridors, doors, caves, the locked treasure room.

function genFloor(f){
 for(let attempt=0;attempt<BAL.map.attempts;attempt++){
  const m=new Array(W*H).fill(0),rooms=[];
  for(let i=0;i<BAL.map.roomTries&&rooms.length<BAL.map.maxRooms;i++){
   const big=f===MAXF&&rooms.length===0;
   const w=big?BAL.map.bossRoomW:rnd(BAL.map.roomMinW,BAL.map.roomMaxW),h=big?BAL.map.bossRoomH:rnd(BAL.map.roomMinH,BAL.map.roomMaxH),x=rnd(1,Math.min(W,BAL.map.span)-w-1),y=rnd(1,Math.min(H,BAL.map.span)-h-1);   // rooms only use the top-left span x span corner: shorter corridors, shorter runs
   if(rooms.some(r=>x<r.x+r.w+1&&x+w+1>r.x&&y<r.y+r.h+1&&y+h+1>r.y))continue;
   const rcx=x+(w>>1),rcy=y+(h>>1);
   rooms.push({x,y,w,h,cx:rcx,cy:rcy});
   const cave=f>=BAL.map.caveFrom&&f<=BAL.map.caveTo&&!big&&Math.random()<BAL.map.caveChance;
   for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){
    m[ix(xx,yy)]=1;
    if(cave&&xx!==rcx&&yy!==rcy){
     const ring=(xx===x||xx===x+w-1||yy===y||yy===y+h-1);
     if(Math.random()<(ring?BAL.map.caveRingWall:BAL.map.caveInnerWall))m[ix(xx,yy)]=0;
    }
   }
  }
  if(rooms.length<BAL.map.minRooms)continue;
  if(f===MAXF)rooms.push(rooms.shift());
  for(let i=0;i<rooms.length-1;i++){
   const a=rooms[i],b=rooms[i+1];let x=a.cx,y=a.cy;
   while(x!==b.cx){m[ix(x,y)]=1;x+=b.cx>x?1:-1;}
   while(y!==b.cy){m[ix(x,y)]=1;y+=b.cy>y?1:-1;}
   m[ix(x,y)]=1;
  }
  const last=rooms[rooms.length-1];
  if(f<MAXF)m[ix(last.cx,last.cy)]=2;
  // verify connectivity
  const seen=new Array(W*H).fill(false),q=[[rooms[0].cx,rooms[0].cy]];seen[ix(q[0][0],q[0][1])]=true;
  for(let i=0;i<q.length;i++){const [x,y]=q[i];for(const [dx,dy] of DIRS){const nx=x+dx,ny=y+dy;
   if(inb(nx,ny)&&m[ix(nx,ny)]!==0&&!seen[ix(nx,ny)]){seen[ix(nx,ny)]=true;q.push([nx,ny]);}}}
  if(!seen[ix(last.cx,last.cy)])continue;
  let ok=true;for(const r of rooms)if(!seen[ix(r.cx,r.cy)])ok=false;
  if(!ok)continue;
  // doors on straight corridor tiles right next to a room
  const inRoom=(x,y)=>rooms.some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h);
  const fl=(x,y)=>inb(x,y)&&m[ix(x,y)]!==0;
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
   if(m[ix(x,y)]!==1||inRoom(x,y))continue;
   let isD=false;
   if(fl(x-1,y)&&fl(x+1,y)&&!fl(x,y-1)&&!fl(x,y+1)&&(inRoom(x-1,y)||inRoom(x+1,y)))isD=true;
   if(fl(x,y-1)&&fl(x,y+1)&&!fl(x-1,y)&&!fl(x+1,y)&&(inRoom(x,y-1)||inRoom(x,y+1)))isD=true;
   if(isD&&Math.random()<BAL.map.doorChance)m[ix(x,y)]=3;
  }
  return {m,rooms};
 }
 // fallback: simple open map
 const m=new Array(W*H).fill(0);for(let y=2;y<W-2;y++)for(let x=2;x<W-2;x++)m[ix(x,y)]=1;
 if(f<MAXF)m[ix(W-4,H-4)]=2;
 return {m,rooms:[{x:2,y:2,w:26,h:26,cx:3,cy:3},{x:2,y:2,w:26,h:26,cx:W-4,cy:H-4}]};
}
function carveTreasure(rooms,f){
 const cand=rooms.filter((r,i)=>i>0&&!(f===MAXF&&i===rooms.length-1));
 for(let a=0;a<60&&cand.length;a++){
  const r=pick(cand),side=rnd(0,3),dx=[1,-1,0,0][side],dy=[0,0,1,-1][side];
  const ddx=dx?(dx>0?r.x+r.w:r.x-1):r.cx,ddy=dx?r.cy:(dy>0?r.y+r.h:r.y-1);
  const cx=ddx+dx*2,cy=ddy+dy*2;let ok=true;
  for(let y=cy-2;y<=cy+2&&ok;y++)for(let x=cx-2;x<=cx+2;x++){if(x<1||y<1||x>W-2||y>H-2||G.map[ix(x,y)]!==0){ok=false;break;}}
  if(!ok||G.map[ix(ddx-dx,ddy-dy)]!==1)continue;
  G.map[ix(ddx,ddy)]=5;const cells=[];
  for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++){G.map[ix(x,y)]=1;cells.push([x,y]);}
  return {door:[ddx,ddy],cells:cells};
 }
 return null;
}
