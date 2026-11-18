// render.js - canvas sizing and the main render() pass: tiles (pre-rendered, blitted), sprites (pre-rendered, blitted), effects overlays, fog, banner.

function resize(){
 const box=$('cv'),r=box.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
 view.cw=Math.max(50,r.width);view.ch=Math.max(50,r.height);view.dpr=dpr;
 cv.width=Math.round(view.cw*dpr);cv.height=Math.round(view.ch*dpr);
 render();
}
if(window.ResizeObserver)new ResizeObserver(resize).observe($('cv'));
window.addEventListener('resize',resize);
function rrect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
// ground shadow under a standing thing
function gshadow(cx,cy,rx,ry,al){ctx.fillStyle='rgba(6,6,14,'+(al||0.32)+')';ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,7);ctx.fill();}
// smooth fog of war: per-tile light eases towards 1 (in sight) or 0 (remembered); reduced motion snaps
let fogLit=null,fogG=null,fogF=-1;
function stepFog(x0,x1,y0,y1,rm){
 if(!fogLit||fogLit.length!==W*H)fogLit=new Float32Array(W*H);
 let moving=false;
 if(fogG!==G||fogF!==G.floor){fogG=G;fogF=G.floor;for(let i=0;i<W*H;i++)fogLit[i]=G.vis[i]?1:0;}
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  const i=ix(x,y),t=G.vis[i]?1:0,l=fogLit[i];
  if(l===t)continue;
  if(rm){fogLit[i]=t;continue;}
  const d=t-l;fogLit[i]=Math.abs(d)<0.04?t:l+d*0.45;moving=true;
 }
 return moving;
}
let LUT=null;
function drawTileLayer(th,kind,v,L,px,py,ts){
 if(L<0.999)ctx.drawImage(tileFast(LUT,th,kind,v,false,ts),px,py,ts,ts);
 if(L>0.001){if(L<0.999)ctx.globalAlpha=L;ctx.drawImage(tileFast(LUT,th,kind,v,true,ts),px,py,ts,ts);if(L<0.999)ctx.globalAlpha=1;}
}
function drawSprL(id,px,py,s,L){ // sprite that follows the fog: remembered = grey and faint
 if(L>=0.5)drawSpr(id,px,py,s,'');
 else{ctx.globalAlpha=0.55;drawSpr(id,px,py,s,'gray');ctx.globalAlpha=1;}
}
// the soft light falloff, pre-rendered once per screen size (the camera keeps the player centred, so it is only ever shifted)
let fogC=null,fogKey='';
function fogBmp(ts){
 const dpr=view.dpr||1,k=view.cw+'|'+view.ch+'|'+dpr+'|'+ts;
 if(fogKey===k)return fogC;
 const w=view.cw+2*ts,h=view.ch+2*ts;fogC=mkCanvas(Math.round(w*dpr),Math.round(h*dpr));fogKey=k;
 const c=fogC.getContext('2d');c.scale(dpr,dpr);
 const g=c.createRadialGradient(w/2,h/2,ts*3.2,w/2,h/2,ts*9.5);g.addColorStop(0,'rgba(4,5,12,0)');g.addColorStop(0.45,'rgba(4,5,12,0.1)');g.addColorStop(1,'rgba(4,5,12,0.42)');c.fillStyle=g;c.fillRect(0,0,w,h);
 return fogC;
}
// ---- foes ----
const SIDE_VIEW={hound:1,rat:1,whelp:1,archer:1};   // drawn facing left; mirrored when the foe last moved / attacked to the right
const TRAP_COL={spike:'#ff8a3a',dart:'#7be04b',alarm:'#ffc93c'};
let fdraw={},litD=null,idleT=0;
// where a foe is DRAWN: it slides from its old tile over 110 ms, and waits at the old tile while a hit on it is still in flight (see holdAt)
function foePos(e,now,rm){
 let s=fdraw[e.id];
 if(!s||s.g!==G||now-s.last>300)s=fdraw[e.id]={g:G,x:e.x,y:e.y,fx:e.x,fy:e.y,t:0,last:now,dx:e.x,dy:e.y,face:s&&s.g===G?s.face:0};
 s.last=now;
 if(s.x!==e.x||s.y!==e.y){
  if(e.x!==s.x)s.face=Math.sign(e.x-s.x);
  if(!rm&&Math.abs(e.x-s.x)<=3&&Math.abs(e.y-s.y)<=3){s.fx=s.dx;s.fy=s.dy;s.t=now+holdAt(s.x,s.y);}else{s.fx=e.x;s.fy=e.y;s.t=0;}
  s.x=e.x;s.y=e.y;
 }
 const k=(now-s.t)/110;
 if(k>=1||s.t===0&&s.fx===s.x&&s.fy===s.y){s.dx=s.x;s.dy=s.y;s.mv=false;}
 else{const q=Math.max(0,k),ek=q*(2-q);s.dx=s.fx+(s.x-s.fx)*ek;s.dy=s.fy+(s.y-s.fy)*ek;s.mv=true;}
 const fc=faces[e.id];if(fc)s.face=fc;
 return s;
}
function badge(cx,cy,r,id,col){ctx.fillStyle=INK;ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.stroke();drawSpr(id,cx-r*0.66,cy-r*0.66,r*1.32,'');}
// the status badge row: poison / burn / blind / rest / hunter, max 3 then "+"
function badgeRow(e,x,y,r,k){
 const list=[];
 if(e.pois)list.push([e.pois.burn?'st_burn':'st_pois',e.pois.burn?'#ff9a3a':'#58d36b']);
 if(e.blind>0)list.push(['st_blind','#cfd4e6']);
 if(e.rest)list.push(['st_rest','#ffc93c']);
 if(e.hunter)list.push(['st_hunt','#ff5acd']);
 for(let i=0;i<list.length&&i<3;i++)badge(x+r+i*r*1.75*k,y,r,list[i][0],list[i][1]);
 if(list.length>3){ctx.font='800 '+Math.round(r*1.5)+'px system-ui,sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';ctx.lineWidth=3;ctx.strokeStyle=INK;ctx.strokeText('+',x+r+3*r*1.75*k-r*0.4,y);ctx.fillStyle='#fff';ctx.fillText('+',x+r+3*r*1.75*k-r*0.4,y);}
}
// the Guard's shield: a heater shield held on the side it faces, pointing that way (45 degree steps); steel when up, grey and tilted when stunned / frozen
const SHIELD_P=new Path2D('M-6 -7 L6 -7 L6 1 Q6 8 0 11 Q-6 8 -6 1z');
function drawShield(e,px,py,ts,ox,oy){
 const fx=e.face[0],fy=e.face[1],down=(e.stun>0||e.frz>0),s=ts/33;
 let cxs=px+ts/2+fx*ts*0.36+ox,cys=py+ts*0.5+fy*ts*0.36+oy;if(fy>0)cys=Math.min(cys,py+ts*0.72+oy);
 const ang=Math.atan2(-fx,fy)+(down?0.44:0);
 ctx.save();ctx.translate(cxs,cys);ctx.rotate(ang);ctx.scale(s,s);ctx.lineJoin='round';
 ctx.fillStyle=down?'#7d8294':'#9fd0ff';ctx.fill(SHIELD_P);ctx.lineWidth=2.5/s;ctx.strokeStyle=INK;ctx.stroke(SHIELD_P);
 ctx.fillStyle=down?'#a2a7b8':'#e6f4ff';ctx.fillRect(-1,-5,2,12);
 ctx.restore();
}
function itemMark(it,x,y,s,al){ // an item (or trap) shown small in a tile corner when a foe stands on it
 disc(x+s/2,y+s/2,s*0.52,'#14111d',0.55*al);disc(x+s/2,y+s/2,s*0.52,'#ffc93c',0.3*al);ctx.globalAlpha=al;drawSpr(itemSprite(it),x+s*0.06,y+s*0.04,s*0.88,'');ctx.globalAlpha=1;
}
// the boss: drawn at 2.6 tiles, feet on its own tile; its head is redrawn after everything else (bossHead) so neighbours never cover it
const BOSS_K=2.6;
function bossGeom(px,py,ts){const S=ts*BOSS_K;return {S:S,sx:px+ts/2-S*0.57,sy:py+ts*0.93-S*0.95};}
function drawBossSpr(e,g,variant,al,crop){
 const d=EN[e.t],v=variant||(e.enraged?'rage':''),bmp=spriteBmp(d.e,g.S,v);
 ctx.globalAlpha=al;
 if(crop){const w=bmp.width/100,H=DRAGON_HEAD;ctx.drawImage(bmp,H[0]*w,H[1]*w,H[2]*w,H[3]*w,g.sx+H[0]/100*g.S,g.sy+H[1]/100*g.S,H[2]/100*g.S,H[3]/100*g.S);}
 else ctx.drawImage(bmp,g.sx,g.sy,g.S,g.S);
 ctx.globalAlpha=1;
}
function drawDanger(dz,x0,x1,y0,y1,ox,oy,ts,now,am,clip){
 const pulse=0.5+0.5*Math.sin(now/170);
 for(const k of dz){const x=k%W,y=Math.floor(k/W);if(x<x0||x>x1||y<y0||y>y1||!G.seen[k])continue;
  const px=ox+x*ts,py=oy+y*ts;
  if(clip&&(px+ts<clip[0]||px>clip[2]||py+ts<clip[1]||py>clip[3]))continue;
  ctx.save();ctx.globalAlpha=am;ctx.fillStyle='rgba(255,40,40,'+(0.34+0.24*pulse)+')';ctx.fillRect(px,py,ts,ts);
  ctx.beginPath();ctx.rect(px,py,ts,ts);ctx.clip();
  ctx.strokeStyle='rgba(255,226,206,0.75)';ctx.lineWidth=2.4;ctx.beginPath();
  for(let o=-ts;o<ts*2;o+=Math.max(8,ts/4)){ctx.moveTo(px+o,py+ts);ctx.lineTo(px+o+ts,py);}
  ctx.stroke();ctx.restore();
  ctx.globalAlpha=am;ctx.strokeStyle=PAL.danger;ctx.lineWidth=3;rrect(px+1.5,py+1.5,ts-3,ts-3,4);ctx.stroke();ctx.lineWidth=1;ctx.globalAlpha=1;
 }
}
// targeting: enemy targets get a bracket reticle; ground abilities get their reachable area as one shape with a single outline
function drawArmed(ox,oy,ts,now,x0,x1,y0,y1){
 const col={bash:'#ffb04a',backstab:'#ff5a8a',charge:'#ffb04a',bolt:'#c08cff',knife:'#e0e6ff',blink:'#46dcf5',fire:'#ff8a3a',smoke:'#cfd4e6'}[armed]||'#fff',tg=targetTiles(armed),ground=ABIL[armed].tg==='tile';
 if(ground){
  const set=new Set(tg.map(t=>ix(t[0],t[1])));
  ctx.globalAlpha=0.14;ctx.fillStyle=col;for(const t of tg)ctx.fillRect(ox+t[0]*ts,oy+t[1]*ts,ts,ts);ctx.globalAlpha=1;
  ctx.strokeStyle=col;ctx.lineWidth=2;ctx.lineCap='round';ctx.beginPath();
  for(const t of tg){const px=ox+t[0]*ts,py=oy+t[1]*ts;
   if(!set.has(ix(t[0],t[1]-1))){ctx.moveTo(px,py);ctx.lineTo(px+ts,py);}
   if(!set.has(ix(t[0],t[1]+1))){ctx.moveTo(px,py+ts);ctx.lineTo(px+ts,py+ts);}
   if(!set.has(ix(t[0]-1,t[1]))){ctx.moveTo(px,py);ctx.lineTo(px,py+ts);}
   if(!set.has(ix(t[0]+1,t[1]))){ctx.moveTo(px+ts,py);ctx.lineTo(px+ts,py+ts);}}
  ctx.stroke();ctx.lineWidth=1;ctx.lineCap='butt';
 }else{
  const sc=0.92+0.08*Math.sin(now*Math.PI*2/600),L=ts*0.26;
  for(const t of tg){
   const dl=fdraw&&G.enemies.find(e=>e.x===t[0]&&e.y===t[1]),fp=dl&&fdraw[dl.id],tx=fp&&fp.g===G?fp.dx:t[0],ty=fp&&fp.g===G?fp.dy:t[1];
   const cx=ox+(tx+0.5)*ts,cy=oy+(ty+0.5)*ts,h=ts*0.5*sc-1;
   for(let pass=0;pass<2;pass++){
    ctx.strokeStyle=pass?col:'#fff';ctx.lineWidth=pass?1:3;ctx.lineCap='round';ctx.beginPath();
    for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){ctx.moveTo(cx+sx*h,cy+sy*(h-L));ctx.lineTo(cx+sx*h,cy+sy*h);ctx.lineTo(cx+sx*(h-L),cy+sy*h);}
    ctx.stroke();
   }
   ctx.lineCap='butt';ctx.lineWidth=1;
  }
 }
}
function render(){
 updateHud();updateBar();renderLog();
 ctx.setTransform(view.dpr,0,0,view.dpr,0,0);
 ctx.fillStyle='#07070d';ctx.fillRect(0,0,view.cw,view.ch);
 if(!G)return;
 const now=performance.now(),p=G.p,th=themeOf(G.floor,G.variant),rm=rmo();
 let shk=false;
 if(now<shakeUntil&&!rm){const sa=shakeAmt*(shakeUntil-now)/220;ctx.translate((Math.random()*2-1)*sa,(Math.random()*2-1)*sa);ctx.fillStyle='#07070d';ctx.fillRect(-12,-12,view.cw+24,view.ch+24);shk=true;}
 const ts=Math.max(28,Math.floor(Math.min(view.cw,view.ch)/11.5));
 const fox=Math.round(view.cw/2-(p.x+0.5)*ts),foy=Math.round(view.ch/2-(p.y+0.5)*ts);
 if(lastPos&&lastPos.f===G.floor&&(lastPos.x!==p.x||lastPos.y!==p.y)){
  if(!rm&&Math.abs(lastPos.x-p.x)+Math.abs(lastPos.y-p.y)<=3)stepAnim={fx:visX,fy:visY,t:now};else stepAnim=null;
 }else if(!lastPos||lastPos.f!==G.floor)stepAnim=null;
 lastPos={x:p.x,y:p.y,f:G.floor};
 let vx=p.x,vy=p.y;
 if(stepAnim){const k=(now-stepAnim.t)/110;if(k>=1)stepAnim=null;else{const ek=k*(2-k);vx=stepAnim.fx+(p.x-stepAnim.fx)*ek;vy=stepAnim.fy+(p.y-stepAnim.fy)*ek;}}
 visX=vx;visY=vy;
 const ox=Math.round(view.cw/2-(vx+0.5)*ts),oy=Math.round(view.ch/2-(vy+0.5)*ts);
 view.ts=ts;view.ox=fox;view.oy=foy;
 const x0=Math.max(0,Math.floor(-ox/ts)),x1=Math.min(W-1,Math.ceil((view.cw-ox)/ts)),
       y0=Math.max(0,Math.floor(-oy/ts)),y1=Math.min(H-1,Math.ceil((view.ch-oy)/ts));
 let more0=stepFog(x0,x1,y0,y1,rm);
 const ord=view.order=[],marks=view.marks=[];view.bossBar=null;   // what was drawn in this frame, in order (the art tests read it)
 const wset=waterSet();LUT=tileLut(th,ts);
 // the unexplored dark is a low-contrast rock texture, not a flat black
 {const pat=rockPattern(ts);if(pat){ctx.save();ctx.translate(ox,oy);ctx.fillStyle=pat;ctx.fillRect(-ox,-oy,view.cw,view.ch);ctx.restore();}}
 // light per tile as drawn: a wall counts as lit when an open tile next to it is (no dark single blocks inside lit rooms)
 if(!litD||litD.length!==W*H)litD=new Float32Array(W*H);
 for(let y=Math.max(0,y0-1);y<=Math.min(H-1,y1+1);y++)for(let x=Math.max(0,x0-1);x<=Math.min(W-1,x1+1);x++){
  const i=ix(x,y);let L=fogLit[i];
  if(G.map[i]===0&&L<1){for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const j=ix(nx,ny);if(G.map[j]!==0&&fogLit[j]>L)L=fogLit[j];}}
  litD[i]=L;
 }
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  const i=ix(x,y),px=ox+x*ts,py=oy+y*ts;
  if(!G.seen[i]){ // one ring of implied wall around what has been seen
   let near=false;for(let dy=-1;dy<=1&&!near;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const j=ix(nx,ny);if(G.seen[j]&&G.map[j]!==0){near=true;break;}}
   if(near){ctx.globalAlpha=0.35;ctx.drawImage(tileFast(LUT,th,'wallt',0,false,ts),px,py,ts,ts);ctx.globalAlpha=1;}
   continue;
  }
  const t=G.map[i],L=litD[i];
  if(t===0){
   drawTileLayer(th,(y+1<H&&G.map[ix(x,y+1)]!==0)?'wallf':'wallt',(x+y)&1,L,px,py,ts);
  }else{
   drawTileLayer(th,(y>0&&G.map[ix(x,y-1)]===0)?'floors':'floor',floorVar(x,y),L,px,py,ts);
   if(t===3)drawSprL('door',px,py,ts,L);
   else if(t===5)drawSprL('door_locked',px,py,ts,L);
   else if(t===4)drawSprL('door_open',px,py,ts,L);
   else if(t===2)drawSprL('stairs',px,py,ts,L);
  }
  if(t!==0&&wset.has(i)){
   const m=(wset.has(ix(x,y-1))?1:0)|(wset.has(ix(x+1,y))?2:0)|(wset.has(ix(x,y+1))?4:0)|(wset.has(ix(x-1,y))?8:0);
   drawTileLayer(th,'water',m,L,px,py,ts);
  }
  if(L>0.05){ // soft edge where the lit area meets remembered ground
   for(let s=0;s<4;s++){const nx=x+(s===1?1:s===3?-1:0),ny=y+(s===0?-1:s===2?1:0);if(nx<0||ny<0||nx>=W||ny>=H||!G.seen[ix(nx,ny)])continue;
    const d=L-litD[ix(nx,ny)];if(d>0.05){ctx.globalAlpha=Math.min(1,d);ctx.drawImage(tileFast(LUT,th,'fogedge',s,true,ts),px,py,ts,ts);ctx.globalAlpha=1;}}
  }
 }
 ord.push('terrain');
 // revealed traps tint their tile
 for(const tp of G.traps){if(!tp.rev||tp.x<x0||tp.x>x1||tp.y<y0||tp.y>y1||!G.seen[ix(tp.x,tp.y)])continue;
  ctx.globalAlpha=tp.done?0.1:0.18;ctx.fillStyle=TRAP_COL[tp.k]||'#fff';ctx.fillRect(ox+tp.x*ts,oy+tp.y*ts,ts,ts);ctx.globalAlpha=1;}
 // foes, in drawing order (visible ones only); the boss body goes in first so it can never hide a neighbour
 const fl=[];let boss=null,idle=false;
 for(const e of G.enemies){
  if(!G.vis[ix(e.x,e.y)])continue;
  const s=foePos(e,now,rm);if(s.mv)more0=true;
  if(s.dx<x0-3||s.dx>x1+3||s.dy<y0-3||s.dy>y1+3)continue;
  const o={e:e,s:s,px:ox+s.dx*ts,py:oy+s.dy*ts,boss:!!EN[e.t].boss};
  if(o.boss)boss=o;else{fl.push(o);if(!rm&&e.awake)idle=true;}
 }
 fl.sort((a,b)=>a.py-b.py);
 let bg=null;
 if(boss){
  const e=boss.e,px=boss.px,py=boss.py,cx=px+ts/2;bg=bossGeom(px,py,ts);
  let ox2=0,oy2=0;{const lg=lunges[e.id];if(lg){const k=(now-lg.t)/150;if(k<1){const o=Math.sin(Math.PI*k)*ts*0.3;ox2=lg.dx*o;oy2=lg.dy*o;more0=true;}else delete lunges[e.id];}}
  bg.sx+=ox2;bg.sy+=oy2;boss.g=bg;boss.ox=ox2;boss.oy=oy2;
  gshadow(cx,py+ts*0.93,ts*0.7,ts*0.14,0.38);ring(cx,py+ts*0.88,ts*0.6,'#ffc93c',2,0.9);
  if(e.enraged&&!rm){const pu=0.5+0.5*Math.sin(now/260);ring(cx,py+ts*0.88,ts*(0.75+0.15*pu),'#ff9a3a',3,0.5+0.4*pu);more0=true;}
  ord.push('dragonBody');drawBossSpr(e,bg,'',e.awake?1:0.7);
  {const fl2=flashes[e.id],d=now-fl2;if(fl2&&d<190){if(d>=0){drawBossSpr(e,bg,'flash',0.8*(1-d/190));}more0=true;}}
  if(e.enraged&&!rm){for(let i=0;i<3;i++){const ph=((now/1000)+i/3+(e.id%7)*0.13)%1,q=bg.S*(((i*53+e.id*17)%100)/100-0.5)*0.8;disc(cx+q,bg.sy+bg.S*0.62-ph*bg.S*0.7,ts*0.07,i&1?'#ffd95a':'#ff9a3a',1-ph);}}
 }
 if(dest&&dest.tok===walkTok&&!G.over&&(dest.x!==p.x||dest.y!==p.y)){
  const px=ox+dest.x*ts,py=oy+dest.y*ts;ctx.fillStyle='rgba(70,220,245,0.22)';rrect(px+2,py+2,ts-4,ts-4,7);ctx.fill();
  ctx.strokeStyle=PAL.accent;ctx.lineWidth=2.5;rrect(px+2,py+2,ts-4,ts-4,7);ctx.stroke();ctx.lineWidth=1;
 }
 if(tapMark){const a=(now-tapMark.t)/600;
  if(a<1){const px=ox+tapMark.x*ts,py=oy+tapMark.y*ts;ctx.globalAlpha=1-a;ctx.strokeStyle='#fff';ctx.lineWidth=3;rrect(px+1.5,py+1.5,ts-3,ts-3,7);ctx.stroke();ctx.lineWidth=1;ctx.globalAlpha=1;more0=true;}
  else tapMark=null;}
 if(G.smoke&&G.smoke.length){ // smoke: overlapping blobs of two tones, no outline
  for(const c of G.smoke)for(const k of c.cells){const x=k%W,y=Math.floor(k/W);if(x<x0||x>x1||y<y0||y>y1||!G.seen[k])continue;
   const h=hash2(x,y),cx=ox+x*ts+ts/2,cy=oy+y*ts+ts/2;
   for(let b=0;b<4;b++){const hb=hash2(h+b,b*7+1),a=(hb%628)/100,r=ts*(0.35+0.25*(((hb>>5)%10)/10)),d=ts*0.2*(b?1:0);
    ctx.globalAlpha=0.42;ctx.fillStyle=b&1?'#9aa0b8':'#c4cadc';ctx.beginPath();ctx.arc(cx+Math.cos(a)*d,cy+Math.sin(a)*d,r,0,7);ctx.fill();}}
  ctx.globalAlpha=1;more0=true;}
 {const dz=dangerSet();
  if(dz.size){drawDanger(dz,x0,x1,y0,y1,ox,oy,ts,now,1,null);more0=true;}
  var dzs=dz;}
 if(G.cracks&&G.cracks.length){
  const pulse=0.5+0.5*Math.sin(now/200);
  for(const c of G.cracks){if(c.x<x0||c.x>x1||c.y<y0||c.y>y1||!G.seen[ix(c.x,c.y)])continue;
   const px=ox+c.x*ts,py=oy+c.y*ts;
   ctx.fillStyle='rgba(255,150,30,'+(0.26+0.2*pulse)+')';ctx.fillRect(px,py,ts,ts);
   ctx.strokeStyle='#ffb040';ctx.lineWidth=3;ctx.setLineDash([6,4]);rrect(px+2,py+2,ts-4,ts-4,6);ctx.stroke();ctx.setLineDash([]);
   ctx.strokeStyle=INK;ctx.lineWidth=2.6;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();ctx.moveTo(px+ts*0.2,py+ts*0.15);ctx.lineTo(px+ts*0.45,py+ts*0.45);ctx.lineTo(px+ts*0.35,py+ts*0.6);ctx.lineTo(px+ts*0.7,py+ts*0.85);ctx.moveTo(px+ts*0.45,py+ts*0.45);ctx.lineTo(px+ts*0.8,py+ts*0.3);ctx.stroke();ctx.lineWidth=1;
   ctx.font='800 '+Math.round(ts*0.34)+'px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=3.5;ctx.strokeStyle=INK;ctx.strokeText(c.t,px+ts*0.8,py+ts*0.8);ctx.fillStyle='#fff';ctx.fillText(c.t,px+ts*0.8,py+ts*0.8);ctx.lineWidth=1;}
  more0=true;
 }
 ord.push('danger');
 // things on the floor (after the danger tint, so a red tile never washes them out)
 const wasteUnder=[];
 for(const tp of G.traps){if(!tp.rev||tp.x<x0||tp.x>x1||tp.y<y0||tp.y>y1||!G.seen[ix(tp.x,tp.y)])continue;
  const px=ox+tp.x*ts,py=oy+tp.y*ts,v=fogLit[ix(tp.x,tp.y)]>0.5;
  ctx.globalAlpha=(!v||tp.done)?0.5:1;drawSpr('trap_'+tp.k,px,py,ts,'');ctx.globalAlpha=1;}
 {const sh=G.shrine;
  if(sh&&sh.x>=x0&&sh.x<=x1&&sh.y>=y0&&sh.y<=y1&&G.seen[ix(sh.x,sh.y)]){const px=ox+sh.x*ts,py=oy+sh.y*ts,v=fogLit[ix(sh.x,sh.y)]>0.5;
   if(!sh.used)disc(px+ts/2,py+ts*0.55,ts*0.46,'#46dcf5',0.22);gshadow(px+ts/2,py+ts*0.9,ts*0.34,ts*0.07,0.3);ctx.globalAlpha=v?1:0.6;drawSpr('shrine',px,py-2,ts,sh.used?'gray':'');ctx.globalAlpha=1;}
  const m=G.merchant;
  if(m&&m.x>=x0&&m.x<=x1&&m.y>=y0&&m.y<=y1&&G.seen[ix(m.x,m.y)]){const px=ox+m.x*ts,py=oy+m.y*ts,v=fogLit[ix(m.x,m.y)]>0.5;
   disc(px+ts/2,py+ts*0.55,ts*0.46,'#46dcf5',0.22);gshadow(px+ts/2,py+ts*0.9,ts*0.3,ts*0.07,0.3);ctx.globalAlpha=v?1:0.6;drawSpr('merchant',px,py-2,ts,'');ctx.globalAlpha=1;}}
 for(const it of G.items){
  if(it.x<x0||it.x>x1||it.y<y0||it.y>y1||!G.seen[ix(it.x,it.y)])continue;
  const px=ox+it.x*ts,py=oy+it.y*ts,v=fogLit[ix(it.x,it.y)]>0.5;
  disc(px+ts/2,py+ts*0.56,ts*0.42,'#14111d',v?0.35:0.2);disc(px+ts/2,py+ts*0.56,ts*0.42,'#ffc93c',v?0.22:0.1);
  gshadow(px+ts/2,py+ts*0.84,ts*0.24,ts*0.05,0.3);
  ctx.globalAlpha=v?1:0.6;drawSpr(itemSprite(it),px+ts*0.14,py+ts*0.1,ts*0.72,'');
  if(it.tr)drawSpr('star',px+ts*0.64,py+ts*0.02,ts*0.3,'');
  ctx.globalAlpha=1;
 }
 ord.push('objects');
 // normal foes: ground marks, sprite, overlays
 for(const o of fl){
  const e=o.e,d=EN[e.t],px=o.px,py=o.py,cx=px+ts/2,S=ts*(e.elite?1.08:1),sleep=!e.awake;
  let ox2=0,oy2=0;
  {const lg=lunges[e.id];if(lg){const k=(now-lg.t)/150;if(k<1){const q=Math.sin(Math.PI*k)*ts*0.3;ox2=lg.dx*q;oy2=lg.dy*q;more0=true;}else delete lunges[e.id];}}
  const fy=py+ts*0.9;
  gshadow(cx+ox2,fy,ts*0.32,ts*0.075,0.34);
  if(e.elite)ring(cx,fy,ts*0.4,'#ffc93c',2.5,0.95);
  if(e.hunter){ctx.setLineDash([5,4]);ring(cx,fy,ts*0.34,'#ff5acd',2,0.95);ctx.setLineDash([]);}
  const bob=(!rm&&!sleep&&!e.stun&&!e.frz)?Math.round(Math.sin(Math.floor(now/125)*125/1600*6.283+e.id*1.3)*0.6):0;
  const sx=cx-S/2+ox2,sy=py+ts-S+oy2-2+bob,mir=SIDE_VIEW[d.e]&&o.s.face>0;
  ctx.globalAlpha=sleep?0.7:1;
  if(mir){ctx.save();ctx.translate(sx+S,0);ctx.scale(-1,1);drawSpr(d.e,0,sy,S,'');ctx.restore();}else drawSpr(d.e,sx,sy,S,'');
  ctx.globalAlpha=1;
  {const fl2=flashes[e.id],dd=now-fl2;if(fl2&&dd<190){if(dd>=0){ctx.globalAlpha=0.8*(1-dd/190);if(mir){ctx.save();ctx.translate(sx+S,0);ctx.scale(-1,1);drawSpr(d.e,0,sy,S,'flash');ctx.restore();}else drawSpr(d.e,sx,sy,S,'flash');ctx.globalAlpha=1;}more0=true;}}
  if(e.frz>0){ctx.globalAlpha=0.6;drawSpr('st_frz',cx-ts*0.42,py+ts*0.08,ts*0.84,'');ctx.globalAlpha=1;}
  if(e.elite)drawSpr('crown',cx-ts*0.22,sy-ts*0.2,ts*0.44,'');
  if(e.wind)drawSpr('st_wind',px+ts*0.68,py,ts*0.4,'');
  if(sleep)drawSpr('st_sleep',px+ts*0.66,py+ts*0.04,ts*0.34,'');
  if(e.stun>0){const a=rm?0:now/220;for(let i=0;i<3;i++){const q=a+i*2.09;drawSpr('st_stun',cx+Math.cos(q)*ts*0.3-ts*0.09,py+ts*0.02+Math.sin(q)*ts*0.07,ts*0.2,'');}if(!rm)more0=true;}
  badgeRow(e,px+1,py+ts-ts*0.5,ts*0.2,1);
  if(d.shield&&e.face)drawShield(e,px,py,ts,ox2,oy2);
  if(reachOk(e)){ctx.strokeStyle='#ffe066';ctx.lineWidth=2;ctx.setLineDash([4,3]);rrect(px+2,py+2,ts-4,ts-4,6);ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=1;}
 }
 ord.push('foes');
 // fresh kills: the foe stays until the blow lands, then pops (the boss dies slowly: flashes, scale, embers)
 ghosts=ghosts.filter(g=>now-g.t<(g.boss?900:280));
 for(const g of ghosts){
  const k=(now-g.t)/(g.boss?900:280),px=ox+g.x*ts,py=oy+g.y*ts;more0=true;
  if(g.boss){
   const bgg=bossGeom(px,py,ts),cxx=px+ts/2,fakeE={t:'dragon',enraged:g.rage},kk=Math.max(0,k);
   const sc=kk<0.44?1:1+0.25*((kk-0.44)/0.56),al=kk<0.44?1:Math.max(0,1-(kk-0.44)/0.56);
   ctx.save();ctx.translate(cxx,py+ts*0.93);ctx.scale(sc,sc);ctx.translate(-cxx,-(py+ts*0.93));
   if(k<0)drawBossSpr(fakeE,bgg,'',1,false);else{drawBossSpr(fakeE,bgg,'',al,false);const f3=kk*900,fl3=f3<45||(f3>150&&f3<195)||(f3>300&&f3<345);if(fl3)drawBossSpr(fakeE,bgg,'flash',0.9*al,false);}
   ctx.restore();
   if(k>0.15){const q=(k-0.15)/0.85;for(let i=0;i<14;i++){const a=i*0.449+((hash2(i,3)%100)/100)*0.3,r=ts*3*q*(0.45+0.55*((i*37%10)/10));disc(cxx+Math.cos(a)*r,py+ts*0.4+Math.sin(a)*r*0.8,Math.max(1,ts*0.11*(1-q)),i&1?'#ffd95a':'#ff9a3a',1-q);}}
   continue;
  }
  const sd=SPR[g.id]&&g.id,S=ts*(1+0.3*Math.max(0,k));
  if(k<0){drawSpr(g.id,px,py+ts-ts-2,ts,'');continue;}
  ctx.globalAlpha=1-k;drawSpr(g.id,px+ts/2-S/2,py+ts-S-2,S,k<0.5?'flash':'');ctx.globalAlpha=1;
 }
 puffs=puffs.filter(q=>now-q.t<450);
 for(const q of puffs){const a=(now-q.t)/450;if(a<0){more0=true;continue;}const cx=ox+q.x*ts+ts/2,cy=oy+q.y*ts+ts/2;ctx.globalAlpha=1-a;ctx.fillStyle='#f3e9d8';for(let i=0;i<6;i++){const ang=i*1.047+q.s,r=ts*(0.15+0.5*a);ctx.beginPath();ctx.arc(cx+Math.cos(ang)*r,cy+Math.sin(ang)*r,Math.max(1.5,ts*0.12*(1-a)),0,7);ctx.fill();}ctx.globalAlpha=1;more0=true;}
 // the player
 {const px=ox+vx*ts,py=oy+vy*ts,cx=px+ts/2,cls=clsOf(p);let hx=0,hy=0;
  {const lg=lunges.p;if(lg){const k=(now-lg.t)/150;if(k<1){const o=Math.sin(Math.PI*k)*ts*0.3;hx=lg.dx*o;hy=lg.dy*o;more0=true;}else delete lunges.p;}}
  ctx.strokeStyle='#fff';ctx.globalAlpha=0.8;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(cx+hx,py+ts*0.9,ts*0.4,ts*0.14,0,0,7);ctx.stroke();ctx.globalAlpha=1;ctx.lineWidth=1;
  gshadow(cx+hx,py+ts*0.9,ts*0.32,ts*0.075,0.34);
  if(G.vanish>0)ctx.globalAlpha=0.5;
  drawSpr(cls.e,px+hx,py-2+hy,ts,'');ctx.globalAlpha=1;
  if(G.brace){ctx.strokeStyle='#97c6ff';ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3+Math.PI/6,qx=cx+Math.cos(a)*ts*0.52,qy=py+ts*0.55+Math.sin(a)*ts*0.52;i?ctx.lineTo(qx,qy):ctx.moveTo(qx,qy);}ctx.closePath();ctx.stroke();ctx.lineWidth=1;}
  {const fl=flashes.p;if(fl&&now-fl<190){const a=1-(now-fl)/190;ctx.globalAlpha=0.7*a;drawSpr(cls.e,px+hx,py-2+hy,ts,'flash');ctx.fillStyle='rgba(255,70,70,'+(0.4*a)+')';ctx.beginPath();ctx.arc(cx,py+ts*0.55,ts*0.44,0,7);ctx.fill();ctx.globalAlpha=1;more0=true;}}
  if(now<pulseUntil&&!rm){const a=1-(pulseUntil-now)/700;ctx.strokeStyle='rgba(255,220,90,'+(1-a)+')';ctx.lineWidth=4;ctx.beginPath();ctx.arc(cx,py+ts/2,ts*(0.5+1.4*a),0,7);ctx.stroke();ctx.lineWidth=1;more0=true;}
  view.pl={px:px,py:py};}
 ord.push('player');
 // loot / traps under a foe stay readable: small marks in the tile corners (above the sprite)
 for(const o of fl){
  const it=itemAt(o.e.x,o.e.y),tp=G.traps.find(a=>a.x===o.e.x&&a.y===o.e.y&&a.rev&&!a.done);
  if(it){itemMark(it,o.px+1,o.py+1,ts*0.45,1);marks.push({k:'item',x:o.e.x,y:o.e.y});}
  if(tp){marks.push({k:'trap',x:o.e.x,y:o.e.y});const s=ts*0.42,x=o.px+ts-s-1,y=o.py+1;disc(x+s/2,y+s/2,s*0.55,'#14111d',0.7);ctx.strokeStyle=TRAP_COL[tp.k]||'#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+s/2,y+s/2,s*0.55,0,7);ctx.stroke();ctx.lineWidth=1;drawSpr('trap_'+tp.k,x,y,s,'');}
 }
 // normal HP bars: only once hurt, after all sprites so nothing covers them; the white tick marks 30%
 for(const o of fl){
  const e=o.e;if(e.hp>=e.mhp)continue;
  const fr=Math.max(0,Math.min(1,e.hp/e.mhp)),col=fr>0.6?PAL.hpHi:fr>0.3?PAL.hpMid:PAL.hpLow,bw=ts*0.7,bx=o.px+(ts-bw)/2,by=o.py+ts-5;
  ctx.fillStyle=INK;rrect(bx-1.5,by-1.5,bw+3,6,3);ctx.fill();ctx.fillStyle='#4a1420';ctx.fillRect(bx,by,bw,3);ctx.fillStyle=col;if(fr>0)ctx.fillRect(bx,by,Math.max(2,bw*fr),3);
  ctx.fillStyle='#fff';ctx.fillRect(bx+bw*0.3-0.5,by-0.5,1,4);
 }
 // the boss: head back on top of everything, then its marks and its ring around the player when the sprite covers him
 if(boss){
  const e=boss.e,g=boss.g,px=boss.px,py=boss.py,cx=px+ts/2+boss.ox,H=DRAGON_HEAD;
  ord.push('dragonHead');drawBossSpr(e,g,'',e.awake?1:0.7,true);
  {const fl2=flashes[e.id],d2=now-fl2;if(fl2&&d2>=0&&d2<190)drawBossSpr(e,g,'flash',0.8*(1-d2/190),true);}
  const hr=[g.sx+H[0]/100*g.S,g.sy+H[1]/100*g.S,g.sx+(H[0]+H[2])/100*g.S,g.sy+(H[1]+H[3])/100*g.S];
  if(dzs&&dzs.size)drawDanger(dzs,x0,x1,y0,y1,ox,oy,ts,now,0.55,hr);
  const pp=view.pl;
  if(pp&&pp.px+ts>g.sx&&pp.px<g.sx+g.S&&pp.py+ts>g.sy&&pp.py<g.sy+g.S&&!(pp.px+ts<=hr[0]||pp.px>=hr[2]||pp.py+ts<=hr[1]||pp.py>=hr[3])){
   drawSpr(clsOf(p).e,pp.px,pp.py-2,ts,'');ctx.strokeStyle='#fff';ctx.globalAlpha=0.85;ctx.lineWidth=2;ctx.beginPath();ctx.arc(pp.px+ts/2,pp.py+ts*0.55,ts*0.5,0,7);ctx.stroke();ctx.globalAlpha=1;ctx.lineWidth=1;}
  const bx=g.sx+g.S*0.55,by=g.sy+g.S*0.58;
  if(e.frz>0){const fs2=g.S*0.62;ctx.globalAlpha=0.6;drawSpr('st_frz',bx-fs2/2,by-fs2/2-g.S*0.02,fs2,'');ctx.globalAlpha=1;}
  if(e.wind)drawSpr('st_wind',cx+ts*0.2,g.sy+g.S*0.08,ts*0.5,'');
  if(!e.awake)drawSpr('st_sleep',g.sx+g.S*0.1,g.sy-ts*0.1,ts*0.5,'');
  if(e.stun>0){const a=rm?0:now/220,hx2=g.sx+g.S*0.2,hy2=g.sy+g.S*0.15;for(let i=0;i<3;i++){const q=a+i*2.09;drawSpr('st_stun',hx2+Math.cos(q)*g.S*0.16-g.S*0.05,hy2-g.S*0.12+Math.sin(q)*g.S*0.04,g.S*0.1,'');}if(!rm)more0=true;}
  badgeRow(e,bx-ts*0.7,by+g.S*0.22,ts*0.3,1.0);
  if(reachOk(e)){ctx.strokeStyle='#ffe066';ctx.lineWidth=2;ctx.setLineDash([4,3]);rrect(px+2,py+2,ts-4,ts-4,6);ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=1;}
 }
 if(armed){drawArmed(ox,oy,ts,now,x0,x1,y0,y1);more0=true;}
 if(drawVfx(ox,oy,ts,now))more0=true;
 // soft light around the player: the far edge of the screen fades into the dark
 {const fb=fogBmp(ts);ctx.drawImage(fb,Math.round(ox+(vx+0.5)*ts-view.cw/2-ts),Math.round(oy+(vy+0.5)*ts-view.ch/2-ts),view.cw+2*ts,view.ch+2*ts);}
 drawMini(ts);
 // the boss bar lives in a fixed strip at the top of the map, never under a neighbour
 if(boss){
  const e=boss.e,fr=Math.max(0,Math.min(1,e.hp/e.mhp)),col=fr>0.6?PAL.hpHi:fr>0.3?PAL.hpMid:PAL.hpLow,nm0=EN[e.t].n,chipsW=($('chips').children.length?52:0);
  ctx.font='800 13px system-ui,sans-serif';const nw=ctx.measureText(nm0).width,bx0=8+chipsW,bx=bx0+nw+8,mmx=view.mm?view.mm.x-6:view.cw,bw=Math.max(60,Math.min(260,mmx-bx-8)),by=10;
  ctx.textAlign='left';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=3.5;ctx.strokeStyle=INK;ctx.strokeText(nm0,bx0,by+5);ctx.fillStyle='#fff';ctx.fillText(nm0,bx0,by+5);
  ord.push('bossBar');view.bossBar={x:bx-2,y:by-2,w:bw+4,h:14};
  ctx.fillStyle=INK;rrect(bx-2,by-2,bw+4,14,7);ctx.fill();ctx.fillStyle='#4a1420';rrect(bx,by,bw,10,5);ctx.fill();
  if(fr>0){ctx.fillStyle=col;rrect(bx,by,Math.max(10,bw*fr),10,5);ctx.fill();}
  ctx.fillStyle='rgba(255,255,255,0.9)';ctx.fillRect(bx+bw*0.3-0.5,by,1,10);
 }
 let more=more0||shk||!!stepAnim;
 // floating labels (laid out when spawned, see effects.js): numbers are bare outlined digits, status words small pills, announcements upper-case pills
 fx=fx.filter(f=>now-f.t<f.d);
 let ci=0;   // second simultaneous callout sits one line higher
 for(const f of fx){
  if(now<f.t){more=true;continue;}
  const du=f.d,a=(now-f.t)/du;let px=ox+(f.x+0.5)*ts+(f.dxo||0)*ts,py=oy+(f.y+0.2+(f.off||0))*ts-(rm?0.25:(now-f.t)/800)*ts*0.6;
  const fs=Math.round(ts*(f.c?0.46:f.sz));
  ctx.font='800 '+fs+'px system-ui,-apple-system,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  if(f.c||f.k!=='n'){ // pill
   const tw=ctx.measureText(f.text).width,hw=tw/2+fs*0.55;px=Math.max(hw,Math.min(view.cw-hw,px));
   if(f.c){py=Math.max(16,py-ts*0.5-ci*ts*0.6);ci++;}else py=Math.max(fs*0.8,py);
   const ap=f.k==='s'?Math.min(1,a*8):1;
   ctx.globalAlpha=Math.min(1-a*a,ap);ctx.fillStyle='rgba(12,12,24,0.88)';rrect(px-hw,py-fs*0.75,hw*2,fs*1.5,fs*0.75);ctx.fill();ctx.strokeStyle=f.color;ctx.lineWidth=f.c||f.k==='a'?2:1.5;ctx.stroke();
   ctx.fillStyle=f.color;ctx.fillText(f.text,px,py+1);ctx.globalAlpha=1;more=true;continue;
  }
  const pop=rm?1:1+0.4*Math.max(0,1-a*7);
  ctx.save();ctx.translate(px,py);ctx.scale(pop,pop);ctx.globalAlpha=1-a*a;
  ctx.lineWidth=Math.max(3,fs*0.28);ctx.strokeStyle=INK;ctx.strokeText(f.text,0,0);ctx.fillStyle=f.color;ctx.fillText(f.text,0,0);ctx.restore();ctx.globalAlpha=1;more=true;
 }
 if(guard&&(now>=guard.until||guard.f!==G.floor||!perilAt(guard.k)))guard=null;
 if(guard){ // danger guard: this tile needs a second tap
  const px=ox+guard.x*ts,py=oy+guard.y*ts,pu=0.5+0.5*Math.sin(now/150);
  ctx.fillStyle='rgba(255,200,40,'+(0.16+0.16*pu)+')';rrect(px+1,py+1,ts-2,ts-2,6);ctx.fill();
  ctx.strokeStyle='#ffc93c';ctx.lineWidth=3;ctx.setLineDash([6,4]);rrect(px+2,py+2,ts-4,ts-4,6);ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=1;
  drawSpr('warn',px+ts*0.14,py+ts*0.12,ts*0.72,'');more=true;
 }
 if(insp&&(insp.turn!==G.turn||insp.f!==G.floor))insp=null;
 drawInspect(ox,oy,ts);
 if(now<bannerUntil&&!G.over){
  const el=now-(bannerUntil-1800),a=Math.min(1,(bannerUntil-now)/400),ent=rm?1:Math.min(1,el/160),sc=0.92+0.08*ent;
  let bfs=Math.round(Math.min(24,view.cw/15));ctx.font='800 '+bfs+'px system-ui,sans-serif';while(bfs>11&&ctx.measureText(bannerText).width>view.cw-50){bfs--;ctx.font='800 '+bfs+'px system-ui,sans-serif';}
  ctx.textAlign='center';ctx.textBaseline='middle';
  const bw=ctx.measureText(bannerText).width+34,mmb=view.mm?view.mm.y+view.mm.h+3:0,by=Math.max(view.ch*0.16,mmb+10),cx=view.cw/2;
  ctx.save();ctx.globalAlpha=a*ent;ctx.translate(cx,by+21);ctx.scale(sc,sc);ctx.translate(-cx,-(by+21));
  ctx.fillStyle='rgba(8,8,18,0.82)';rrect(cx-bw/2,by,bw,42,14);ctx.fill();ctx.strokeStyle=th.wh;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff';ctx.fillText(bannerText,cx,by+22);ctx.restore();more=true;}
 if(now<flashUntil&&!rm){
  const k=(flashUntil-now)/(flashFull?250:180);
  if(flashFull){ctx.fillStyle='rgba(220,30,30,'+(0.3*k)+')';ctx.fillRect(0,0,view.cw,view.ch);}
  else{const hd=Math.hypot(view.cw,view.ch)/2,g=ctx.createRadialGradient(view.cw/2,view.ch/2,hd*0.55,view.cw/2,view.ch/2,hd);g.addColorStop(0,'rgba(220,30,30,0)');g.addColorStop(1,'rgba(220,30,30,'+(flashAmt*k)+')');ctx.fillStyle=g;ctx.fillRect(0,0,view.cw,view.ch);}
  more=true;
 }
 if(more&&!rafPending){rafPending=true;requestAnimationFrame(function(){rafPending=false;render();});}
 else if(idle&&!more&&!rafPending&&!idleT){idleT=setTimeout(function(){idleT=0;if(G)render();},125);}  // foes breathe: a calm 8 fps redraw while one is awake in view
}
