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
const THREAT_RING={dragon:'#ffc93c'};
// the soft light falloff, pre-rendered once per screen size (the camera keeps the player centred, so it is only ever shifted)
let fogC=null,fogKey='';
function fogBmp(ts){
 const dpr=view.dpr||1,k=view.cw+'|'+view.ch+'|'+dpr+'|'+ts;
 if(fogKey===k)return fogC;
 const w=view.cw+2*ts,h=view.ch+2*ts;fogC=mkCanvas(Math.round(w*dpr),Math.round(h*dpr));fogKey=k;
 const c=fogC.getContext('2d');c.scale(dpr,dpr);
 const g=c.createRadialGradient(w/2,h/2,ts*3.2,w/2,h/2,ts*9.5);g.addColorStop(0,'rgba(4,5,12,0)');g.addColorStop(1,'rgba(4,5,12,0.42)');c.fillStyle=g;c.fillRect(0,0,w,h);
 return fogC;
}
function drawFoe(e,px,py,ts,now,rm){
 const d=EN[e.t],boss=!!d.boss,S=boss?ts*1.9:ts*(e.elite?1.08:1),cx=px+ts/2;
 let ox=0,oy=0;
 {const lg=lunges[e.id];if(lg){const k=(now-lg.t)/150;if(k<1){const o=Math.sin(Math.PI*k)*ts*0.3;ox=lg.dx*o;oy=lg.dy*o;}else delete lunges[e.id];}}
 const fy=py+ts*0.9;
 gshadow(cx+ox,fy,ts*(boss?0.62:0.32),ts*(boss?0.12:0.075),0.34);
 if(e.elite){disc(cx,py+ts*0.55,ts*0.5,'#ffc93c',0.3);ring(cx,fy,ts*0.38,'#ffc93c',2,0.9);}
 else if(e.awake)disc(cx,fy,ts*(boss?0.6:0.36),'#ff3b3b',0.2);
 const sx=cx-S/2+ox,sy=boss?py+ts*0.5-S*0.58+oy:py+ts-S+oy-2;
 const sleep=!e.awake;
 if(sleep)ctx.globalAlpha=0.7;
 drawSpr(d.e,sx,sy,S,'');
 ctx.globalAlpha=1;
 {const fl=flashes[e.id];if(fl&&now-fl<190){ctx.globalAlpha=0.8*(1-(now-fl)/190);drawSpr(d.e,sx,sy,S,'flash');ctx.globalAlpha=1;}}
 if(e.frz>0){ctx.globalAlpha=0.6;drawSpr('st_frz',cx-ts*0.42,py+ts*0.08,ts*0.84,'');ctx.globalAlpha=1;}
 // marks: top row above the head
 if(e.elite)drawSpr('crown',cx-ts*0.22,sy-ts*0.2+(boss?ts*0.1:0),ts*0.44,'');
 if(e.hunter){ring(cx,fy,ts*0.45,'#ff3b3b',3,0.9);drawSpr('st_hunt',px-ts*0.04,py+ts*0.06,ts*0.34,'');}
 if(e.wind)drawSpr('st_wind',px+ts*0.68,py+ts*0.0,ts*0.4,'');
 else if(e.rest)drawSpr('st_rest',px+ts*0.7,py+ts*0.02,ts*0.34,'');
 if(sleep)drawSpr('st_sleep',px+ts*0.66,py+ts*0.04,ts*0.34,'');
 if(e.stun>0){const a=rm?0:now/220;for(let i=0;i<3;i++){const q=a+i*2.09;drawSpr('st_stun',cx+Math.cos(q)*ts*0.3-ts*0.09,py+ts*0.02+Math.sin(q)*ts*0.07,ts*0.2,'');}}
 if(e.blind>0)drawSpr('st_blind',px+ts*0.02,py+ts*0.62,ts*0.34,'');
 if(e.pois)drawSpr(e.pois.burn?'st_burn':'st_pois',px+ts*0.7,py+ts*0.6,ts*0.3,'');
 // hp bar (bottom edge; bosses get a wide one above)
 const fr=Math.max(0,Math.min(1,e.hp/e.mhp)),col=fr>0.6?PAL.hpHi:fr>0.3?PAL.hpMid:PAL.hpLow;
 if(boss){const bw=ts*1.6,bx=cx-bw/2,by=sy-4;ctx.fillStyle=INK;rrect(bx-2,by-2,bw+4,10,5);ctx.fill();ctx.fillStyle='#4a1420';rrect(bx,by,bw,6,3);ctx.fill();ctx.fillStyle=col;if(fr>0){rrect(bx,by,Math.max(6,bw*fr),6,3);ctx.fill();}}
 else{const bw=ts-8,bx=px+4,by=py+ts-5;ctx.fillStyle=INK;rrect(bx-1.5,by-1.5,bw+3,7,3.5);ctx.fill();ctx.fillStyle='#4a1420';rrect(bx,by,bw,4,2);ctx.fill();ctx.fillStyle=col;if(fr>0){rrect(bx,by,Math.max(4,bw*fr),4,2);ctx.fill();}}
 if(d.shield&&e.face){ // the guard's shield: a steel plate on the side it faces (grey when stunned / frozen)
  const fx=e.face[0],fy2=e.face[1],cxs=cx+fx*ts*0.4+ox,cys=py+ts*0.55+fy2*ts*0.36+oy,down=(e.stun>0||e.frz>0);
  ctx.fillStyle=down?'#7d8294':'#9fd0ff';ctx.strokeStyle=INK;ctx.lineWidth=2.5;ctx.lineJoin='round';
  if(fx&&!fy2){rrect(cxs-4,py+ts*0.2,8,ts*0.62,4);ctx.fill();ctx.stroke();ctx.fillStyle=down?'#a2a7b8':'#e6f4ff';ctx.fillRect(cxs-2,py+ts*0.26,2.5,ts*0.4);}
  else if(fy2&&!fx){rrect(px+ts*0.19,cys-4,ts*0.62,8,4);ctx.fill();ctx.stroke();ctx.fillStyle=down?'#a2a7b8':'#e6f4ff';ctx.fillRect(px+ts*0.26,cys-2,ts*0.4,2.5);}
  else{ctx.beginPath();ctx.arc(cxs,cys,ts*0.15,0,7);ctx.fill();ctx.stroke();}
  ctx.lineWidth=1;
 }
 if(reachOk(e)){ctx.strokeStyle='#ffe066';ctx.lineWidth=2;ctx.setLineDash([4,3]);rrect(px+2,py+2,ts-4,ts-4,6);ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=1;}
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
 const wset=waterSet();LUT=tileLut(th,ts);
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  const i=ix(x,y);if(!G.seen[i])continue;
  const px=ox+x*ts,py=oy+y*ts,t=G.map[i],L=fogLit[i],v=L>0.5;
  if(t===0){
   drawTileLayer(th,(y+1<H&&G.map[ix(x,y+1)]!==0)?'wallf':'wallt',(x+y)&1,L,px,py,ts);
  }else{
   drawTileLayer(th,(y>0&&G.map[ix(x,y-1)]===0)?'floors':'floor',floorVar(x,y),L,px,py,ts);
   if(t===3)drawSprL('door',px,py,ts,L);
   else if(t===5)drawSprL('door_locked',px,py,ts,L);
   else if(t===4)drawSprL('door_open',px,py,ts,L);
   else if(t===2)drawSprL('stairs',px,py,ts,L);
  }
  if(t!==0&&wset.has(i))drawTileLayer(th,'water',(x+y)&1,L,px,py,ts);
  const it=itemAt(x,y);
  {const tp=G.traps.find(a=>a.x===x&&a.y===y&&a.rev);
   if(tp){ctx.globalAlpha=(!v||tp.done)?0.5:1;drawSpr('trap_'+tp.k,px+ts*0.06,py+ts*0.06,ts*0.88,'');ctx.globalAlpha=1;}
   const sh=G.shrine;
   if(sh&&sh.x===x&&sh.y===y){if(!sh.used)disc(px+ts/2,py+ts*0.55,ts*0.46,'#46dcf5',0.22);gshadow(px+ts/2,py+ts*0.9,ts*0.34,ts*0.07,0.3);ctx.globalAlpha=v?1:0.6;drawSpr('shrine',px,py-2,ts,sh.used?'gray':'');ctx.globalAlpha=1;}
   if(merchantAt(x,y)){disc(px+ts/2,py+ts*0.55,ts*0.46,'#46dcf5',0.22);gshadow(px+ts/2,py+ts*0.9,ts*0.3,ts*0.07,0.3);ctx.globalAlpha=v?1:0.6;drawSpr('merchant',px,py-2,ts,'');ctx.globalAlpha=1;}}
  if(it){
   const bob=0;
   disc(px+ts/2,py+ts*0.56,ts*0.4,'#ffc93c',v?0.15:0.08);
   gshadow(px+ts/2,py+ts*0.84,ts*0.24,ts*0.05,0.3);
   ctx.globalAlpha=v?1:0.6;drawSpr(itemSprite(it),px+ts*0.14,py+ts*0.1+bob,ts*0.72,'');
   if(it.tr)drawSpr('star',px+ts*0.64,py+ts*0.02,ts*0.3,'');
   ctx.globalAlpha=1;
  }
 }
 if(dest&&dest.tok===walkTok&&!G.over&&(dest.x!==p.x||dest.y!==p.y)){
  const px=ox+dest.x*ts,py=oy+dest.y*ts;ctx.fillStyle='rgba(70,220,245,0.22)';rrect(px+2,py+2,ts-4,ts-4,7);ctx.fill();
  ctx.strokeStyle=PAL.accent;ctx.lineWidth=2.5;rrect(px+2,py+2,ts-4,ts-4,7);ctx.stroke();ctx.lineWidth=1;
 }
 if(tapMark){const a=(now-tapMark.t)/600;
  if(a<1){const px=ox+tapMark.x*ts,py=oy+tapMark.y*ts;ctx.globalAlpha=1-a;ctx.strokeStyle='#fff';ctx.lineWidth=3;rrect(px+1.5,py+1.5,ts-3,ts-3,7);ctx.stroke();ctx.lineWidth=1;ctx.globalAlpha=1;more0=true;}
  else tapMark=null;}
 if(G.smoke&&G.smoke.length){ctx.fillStyle='rgba(196,202,220,0.4)';for(const c of G.smoke)for(const k of c.cells){const x=k%W,y=Math.floor(k/W);if(x<x0||x>x1||y<y0||y>y1||!G.seen[k])continue;ctx.beginPath();ctx.arc(ox+x*ts+ts/2,oy+y*ts+ts/2,ts*0.62,0,7);ctx.fill();}more0=true;}
 if(armed){
  const col={bash:'#ffb04a',backstab:'#ff5a8a',charge:'#ffb04a',bolt:'#c08cff',knife:'#e0e6ff',blink:'#46dcf5',fire:'#ff8a3a',smoke:'#cfd4e6'}[armed]||'#fff',tg=targetTiles(armed),ground=ABIL[armed].tg==='tile';
  for(const t of tg){const px=ox+t[0]*ts,py=oy+t[1]*ts;
   ctx.globalAlpha=ground&&armed!=='blink'?0.2:0.34;ctx.fillStyle=col;rrect(px+1.5,py+1.5,ts-3,ts-3,7);ctx.fill();ctx.globalAlpha=1;
   ctx.strokeStyle=col;ctx.lineWidth=ground&&armed!=='blink'?1.2:2.4;rrect(px+2,py+2,ts-4,ts-4,7);ctx.stroke();ctx.lineWidth=1;}
  more0=true;
 }
 {const dz=dangerSet();
  if(dz.size){
   const pulse=0.5+0.5*Math.sin(now/170);
   for(const k of dz){const x=k%W,y=Math.floor(k/W);if(x<x0||x>x1||y<y0||y>y1||!G.seen[k])continue;
    const px=ox+x*ts,py=oy+y*ts;
    ctx.fillStyle='rgba(255,40,40,'+(0.34+0.24*pulse)+')';ctx.fillRect(px,py,ts,ts);
    ctx.save();ctx.beginPath();ctx.rect(px,py,ts,ts);ctx.clip();
    ctx.strokeStyle='rgba(255,226,206,0.75)';ctx.lineWidth=2.4;ctx.beginPath();
    for(let o=-ts;o<ts*2;o+=Math.max(8,ts/4)){ctx.moveTo(px+o,py+ts);ctx.lineTo(px+o+ts,py);}
    ctx.stroke();ctx.restore();
    ctx.strokeStyle=PAL.danger;ctx.lineWidth=3;rrect(px+1.5,py+1.5,ts-3,ts-3,4);ctx.stroke();ctx.lineWidth=1;
   }
   more0=true;
  }}
 if(G.cracks&&G.cracks.length){
  const pulse=0.5+0.5*Math.sin(now/200);
  for(const c of G.cracks){if(c.x<x0||c.x>x1||c.y<y0||c.y>y1||!G.seen[ix(c.x,c.y)])continue;
   const px=ox+c.x*ts,py=oy+c.y*ts;
   ctx.fillStyle='rgba(255,150,30,'+(0.26+0.2*pulse)+')';ctx.fillRect(px,py,ts,ts);
   ctx.strokeStyle='#ffb040';ctx.lineWidth=3;ctx.setLineDash([6,4]);rrect(px+2,py+2,ts-4,ts-4,6);ctx.stroke();ctx.setLineDash([]);
   ctx.strokeStyle=INK;ctx.lineWidth=2.6;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();ctx.moveTo(px+ts*0.2,py+ts*0.15);ctx.lineTo(px+ts*0.45,py+ts*0.45);ctx.lineTo(px+ts*0.35,py+ts*0.6);ctx.lineTo(px+ts*0.7,py+ts*0.85);ctx.moveTo(px+ts*0.45,py+ts*0.45);ctx.lineTo(px+ts*0.8,py+ts*0.3);ctx.stroke();ctx.lineWidth=1;
   ctx.font='800 '+Math.round(ts*0.4)+'px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=3.5;ctx.strokeStyle=INK;ctx.strokeText(c.t,px+ts*0.8,py+ts*0.22);ctx.fillStyle='#fff';ctx.fillText(c.t,px+ts*0.8,py+ts*0.22);ctx.lineWidth=1;}
  more0=true;
 }
 // foes (the dragon first: it is drawn larger than its tile and must never hide a neighbour)
 {const list=G.floor>=MAXF?G.enemies.slice().sort((a,b)=>(EN[b.t].boss?1:0)-(EN[a.t].boss?1:0)):G.enemies;
  for(const e of list){if(!G.vis[ix(e.x,e.y)])continue;drawFoe(e,ox+e.x*ts,oy+e.y*ts,ts,now,rm);if(e.stun>0&&!rm)more0=true;}}
 // fresh kills: a quick white pop and fade
 ghosts=ghosts.filter(g=>now-g.t<280);
 for(const g of ghosts){const k=(now-g.t)/280,px=ox+g.x*ts,py=oy+g.y*ts,S=ts*(g.boss?1.9:1)*(1+0.3*k);ctx.globalAlpha=1-k;drawSpr(g.id,px+ts/2-S/2,py+ts-S+(g.boss?-ts*0.4:-2),S,k<0.5?'flash':'');ctx.globalAlpha=1;more0=true;}
 puffs=puffs.filter(q=>now-q.t<450);
 for(const q of puffs){const a=(now-q.t)/450,cx=ox+q.x*ts+ts/2,cy=oy+q.y*ts+ts/2;ctx.globalAlpha=1-a;ctx.fillStyle='#f3e9d8';for(let i=0;i<6;i++){const ang=i*1.047+q.s,r=ts*(0.15+0.5*a);ctx.beginPath();ctx.arc(cx+Math.cos(ang)*r,cy+Math.sin(ang)*r,Math.max(1.5,ts*0.12*(1-a)),0,7);ctx.fill();}ctx.globalAlpha=1;more0=true;}
 {const px=ox+vx*ts,py=oy+vy*ts,cx=px+ts/2,cls=clsOf(p);let hx=0,hy=0;
  {const lg=lunges.p;if(lg){const k=(now-lg.t)/150;if(k<1){const o=Math.sin(Math.PI*k)*ts*0.3;hx=lg.dx*o;hy=lg.dy*o;more0=true;}else delete lunges.p;}}
  disc(cx,py+ts*0.58,ts*0.46,PAL[p.cls]||PAL.accent,0.3);
  gshadow(cx+hx,py+ts*0.9,ts*0.32,ts*0.075,0.34);
  if(G.vanish>0)ctx.globalAlpha=0.5;
  drawSpr(cls.e,px+hx,py-2+hy,ts,'');ctx.globalAlpha=1;
  if(G.brace){ctx.strokeStyle='#97c6ff';ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3+Math.PI/6,qx=cx+Math.cos(a)*ts*0.52,qy=py+ts*0.55+Math.sin(a)*ts*0.52;i?ctx.lineTo(qx,qy):ctx.moveTo(qx,qy);}ctx.closePath();ctx.stroke();ctx.lineWidth=1;}
  {const fl=flashes.p;if(fl&&now-fl<190){const a=1-(now-fl)/190;ctx.globalAlpha=0.7*a;drawSpr(cls.e,px+hx,py-2+hy,ts,'flash');ctx.fillStyle='rgba(255,70,70,'+(0.4*a)+')';ctx.beginPath();ctx.arc(cx,py+ts*0.55,ts*0.44,0,7);ctx.fill();ctx.globalAlpha=1;more0=true;}}
  if(now<pulseUntil&&!rm){const a=1-(pulseUntil-now)/700;ctx.strokeStyle='rgba(255,220,90,'+(1-a)+')';ctx.lineWidth=4;ctx.beginPath();ctx.arc(cx,py+ts/2,ts*(0.5+1.4*a),0,7);ctx.stroke();ctx.lineWidth=1;more0=true;}}
 if(drawVfx(ox,oy,ts,now))more0=true;
 // soft light around the player: the far edge of the screen fades into the dark
 {const fb=fogBmp(ts);ctx.drawImage(fb,Math.round(ox+(vx+0.5)*ts-view.cw/2-ts),Math.round(oy+(vy+0.5)*ts-view.ch/2-ts),view.cw+2*ts,view.ch+2*ts);}
 drawMini(ts);
 let more=more0||shk||!!stepAnim;
 fx=fx.filter(f=>now-f.t<(f.d||800));
 let ci=0;   // second simultaneous callout sits one line higher
 for(const f of fx){
  const du=f.d||800,a=(now-f.t)/du;let px=ox+f.x*ts+ts/2,py=oy+f.y*ts+ts*0.2-(rm?0.25:a)*ts*0.6;
  const fs=Math.round(ts*(f.c?0.46:f.big?0.6:0.42));
  ctx.font='800 '+fs+'px system-ui,-apple-system,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  if(f.c){ // callout: a small dark pill with a coloured edge
   const tw=ctx.measureText(f.text).width,hw=tw/2+10;px=Math.max(hw,Math.min(view.cw-hw,px));py=Math.max(16,py-ts*0.5-ci*ts*0.6);ci++;
   ctx.globalAlpha=1-a*a;ctx.fillStyle='rgba(12,12,24,0.88)';rrect(px-hw,py-fs*0.75,hw*2,fs*1.5,fs*0.75);ctx.fill();ctx.strokeStyle=f.color;ctx.lineWidth=2;ctx.stroke();
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
 if(now<bannerUntil&&!G.over){const a=Math.min(1,(bannerUntil-now)/600);ctx.globalAlpha=a;let bfs=Math.round(Math.min(24,view.cw/15));ctx.font='800 '+bfs+'px system-ui,sans-serif';while(bfs>11&&ctx.measureText(bannerText).width>view.cw-50){bfs--;ctx.font='800 '+bfs+'px system-ui,sans-serif';}ctx.textAlign='center';ctx.textBaseline='middle';const bw=ctx.measureText(bannerText).width+34,bx=view.cw/2-bw/2,by=view.ch*0.16;ctx.fillStyle='rgba(8,8,18,0.82)';rrect(bx,by,bw,42,14);ctx.fill();ctx.strokeStyle=th.wt;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff';ctx.fillText(bannerText,view.cw/2,by+22);ctx.globalAlpha=1;more=true;}
 if(now<flashUntil){ctx.fillStyle='rgba(220,30,30,'+(0.3*(flashUntil-now)/250)+')';ctx.fillRect(0,0,view.cw,view.ch);more=true;}
 if(more&&!rafPending){rafPending=true;requestAnimationFrame(function(){rafPending=false;render();});}
}
