// render.js - canvas sizing and the main render() pass (tiles, entities, effects overlays, banner).

function resize(){
 const box=$('cv'),r=box.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
 view.cw=Math.max(50,r.width);view.ch=Math.max(50,r.height);view.dpr=dpr;
 cv.width=Math.round(view.cw*dpr);cv.height=Math.round(view.ch*dpr);
 render();
}
if(window.ResizeObserver)new ResizeObserver(resize).observe($('cv'));
window.addEventListener('resize',resize);
const EF='"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
function glyph(ch,cx,cy,size){ctx.font=Math.round(size)+'px '+EF;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ch,cx,cy);}
function drawTrap(t,px,py,ts,v){
 const c=TRAPS[t.k].c;ctx.save();if(!v||t.done)ctx.globalAlpha=0.55;
 ctx.fillStyle='rgba(0,0,0,0.38)';ctx.fillRect(px+3,py+3,ts-6,ts-6);
 ctx.strokeStyle=c;ctx.lineWidth=2;ctx.strokeRect(px+3.5,py+3.5,ts-7,ts-7);
 if(t.k==='spike'){ctx.fillStyle='#d8dbe6';const n=3,w=(ts-10)/n;
  for(let a=0;a<n;a++)for(let b=0;b<2;b++){const bx=px+5+a*w,by=py+ts*0.45+b*ts*0.26;ctx.beginPath();ctx.moveTo(bx,by+ts*0.22);ctx.lineTo(bx+w/2,by);ctx.lineTo(bx+w,by+ts*0.22);ctx.closePath();ctx.fill();}}
 else if(t.k==='dart'){ctx.strokeStyle=c;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(px+ts*0.2,py+ts*0.7);ctx.lineTo(px+ts*0.75,py+ts*0.3);ctx.stroke();
  ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(px+ts*0.82,py+ts*0.24);ctx.lineTo(px+ts*0.6,py+ts*0.27);ctx.lineTo(px+ts*0.76,py+ts*0.45);ctx.closePath();ctx.fill();
  ctx.fillStyle='#9d5bd6';ctx.beginPath();ctx.arc(px+ts*0.28,py+ts*0.64,ts*0.09,0,7);ctx.fill();}
 else{ctx.fillStyle='#fff';glyph('🔔',px+ts/2,py+ts/2+1,ts*0.52);}
 ctx.restore();
}
function render(){
 updateHud();updateBar();renderLog();
 ctx.setTransform(view.dpr,0,0,view.dpr,0,0);
 ctx.fillStyle='#000';ctx.fillRect(0,0,view.cw,view.ch);
 if(!G)return;
 const now=performance.now(),p=G.p,th=themeOf(G.floor,G.variant),rm=rmo();
 let shk=false;
 if(now<shakeUntil&&!rm){const sa=shakeAmt*(shakeUntil-now)/220;ctx.translate((Math.random()*2-1)*sa,(Math.random()*2-1)*sa);ctx.fillStyle='#000';ctx.fillRect(-12,-12,view.cw+24,view.ch+24);shk=true;}
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
 let more0=false;
 const wset=waterSet();
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  const i=ix(x,y);if(!G.seen[i])continue;
  const px=ox+x*ts,py=oy+y*ts,t=G.map[i];
  const v=G.vis[i];
  if(t===0){ctx.fillStyle=v?th.wl:th.wld;ctx.fillRect(px,py,ts,ts);ctx.fillStyle=v?th.wt:th.wtd;ctx.fillRect(px,py,ts,Math.max(2,ts*0.14));
   ctx.strokeStyle=v?th.we:th.wed;ctx.strokeRect(px+.5,py+.5,ts-1,ts-1);}
  else{ctx.fillStyle=v?(((x+y)&1)?th.fa:th.fb):(((x+y)&1)?th.fda:th.fdb);ctx.fillRect(px,py,ts,ts);
   if(v){ctx.strokeStyle='rgba(0,0,0,0.18)';ctx.strokeRect(px+.5,py+.5,ts-1,ts-1);}
   if(t===3){
    ctx.fillStyle=v?'#7a4a22':'#3a2410';ctx.fillRect(px+2,py+2,ts-4,ts-4);
    ctx.strokeStyle=v?'#2a1606':'#1a0e04';ctx.lineWidth=2;ctx.strokeRect(px+3,py+3,ts-6,ts-6);
    ctx.beginPath();ctx.moveTo(px+ts/2,py+3);ctx.lineTo(px+ts/2,py+ts-3);ctx.stroke();ctx.lineWidth=1;
    ctx.fillStyle='#ffd24a';ctx.beginPath();ctx.arc(px+ts*0.7,py+ts*0.5,Math.max(2,ts*0.07),0,7);ctx.fill();
   }
   if(t===5){
    ctx.fillStyle=v?'#4a4f5c':'#262a33';ctx.fillRect(px+1,py+1,ts-2,ts-2);
    ctx.strokeStyle=v?'#ffb000':'#6a4a10';ctx.lineWidth=3;ctx.strokeRect(px+2.5,py+2.5,ts-5,ts-5);ctx.lineWidth=1;
    ctx.fillStyle='#fff';if(!v)ctx.globalAlpha=0.6;glyph('🔒',px+ts/2,py+ts/2+1,ts*0.55);ctx.globalAlpha=1;
   }
   if(t===4){
    ctx.strokeStyle=v?'#7a4a22':'#3a2410';ctx.lineWidth=4;ctx.strokeRect(px+2,py+2,ts-4,ts-4);ctx.lineWidth=1;
   }
   if(t===2){
    ctx.fillStyle='#08142c';ctx.fillRect(px+2,py+2,ts-4,ts-4);
    ctx.fillStyle='#ffe066';
    for(let s=0;s<4;s++){const w=(ts-10)*(1-s*0.2);ctx.fillRect(px+5,py+5+s*(ts-10)/4,w,(ts-10)/4-2);}
    ctx.strokeStyle='#ffd24a';ctx.lineWidth=3;ctx.strokeRect(px+1.5,py+1.5,ts-3,ts-3);ctx.lineWidth=1;
    ctx.lineWidth=3;ctx.strokeStyle='#000';ctx.font='bold '+Math.round(ts*0.5)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.strokeText('▼',px+ts*0.72,py+ts*0.7);ctx.fillStyle='#fff';ctx.fillText('▼',px+ts*0.72,py+ts*0.7);ctx.lineWidth=1;
   }}
  if(t!==0&&wset.has(i)){ctx.fillStyle=v?'rgba(40,110,220,0.55)':'rgba(30,70,150,0.4)';ctx.fillRect(px,py,ts,ts);ctx.strokeStyle=v?'rgba(190,230,255,0.75)':'rgba(120,160,210,0.4)';ctx.lineWidth=2;ctx.beginPath();const wy=py+ts*0.4;ctx.moveTo(px+ts*0.12,wy);ctx.quadraticCurveTo(px+ts*0.31,wy-ts*0.14,px+ts*0.5,wy);ctx.quadraticCurveTo(px+ts*0.69,wy+ts*0.14,px+ts*0.88,wy);const wy2=py+ts*0.7;ctx.moveTo(px+ts*0.12,wy2);ctx.quadraticCurveTo(px+ts*0.31,wy2-ts*0.14,px+ts*0.5,wy2);ctx.quadraticCurveTo(px+ts*0.69,wy2+ts*0.14,px+ts*0.88,wy2);ctx.stroke();ctx.lineWidth=1;}
  const it=itemAt(x,y);
  {const tp=G.traps.find(a=>a.x===x&&a.y===y&&a.rev);
   if(tp)drawTrap(tp,px,py,ts,v);
   const sh=G.shrine;
   if(sh&&sh.x===x&&sh.y===y){ctx.fillStyle=sh.used?'rgba(120,120,140,0.3)':'rgba(190,140,255,0.35)';ctx.beginPath();ctx.arc(px+ts/2,py+ts/2,ts*0.46,0,7);ctx.fill();ctx.strokeStyle=sh.used?'#778':'#c58aff';ctx.lineWidth=2;ctx.stroke();ctx.lineWidth=1;ctx.fillStyle='#fff';if(!v||sh.used)ctx.globalAlpha=0.6;glyph('🗿',px+ts/2,py+ts/2+1,ts*0.62);ctx.globalAlpha=1;}
   if(merchantAt(x,y)){ctx.fillStyle='rgba(80,220,100,0.35)';ctx.beginPath();ctx.arc(px+ts/2,py+ts/2,ts*0.46,0,7);ctx.fill();ctx.strokeStyle='#4be04b';ctx.lineWidth=2;ctx.stroke();ctx.lineWidth=1;ctx.fillStyle='#fff';if(!v)ctx.globalAlpha=0.6;glyph('🧔',px+ts/2,py+ts/2+1,ts*0.62);glyph('💰',px+ts*0.82,py+ts*0.2,ts*0.3);ctx.globalAlpha=1;}}
  if(it){const em=kindTable(it.t)&&it.k&&kindTable(it.t)[it.k]?itemIcon(it):({gold:'💰',potion:'🧪',fire:'📜',tele:'🌀',key:'🗝️',knife:'🔪'}[it.t]||'❔');ctx.fillStyle='#fff';if(!v)ctx.globalAlpha=0.6;glyph(em,px+ts/2,py+ts/2+1,ts*0.62);if(it.tr)glyph('✨',px+ts*0.8,py+ts*0.22,ts*0.34);ctx.globalAlpha=1;}
 }
 if(dest&&dest.tok===walkTok&&!G.over&&(dest.x!==p.x||dest.y!==p.y)){
  const px=ox+dest.x*ts,py=oy+dest.y*ts;ctx.fillStyle='rgba(80,230,255,0.28)';ctx.fillRect(px,py,ts,ts);
  ctx.strokeStyle='#4ee6ff';ctx.lineWidth=3;ctx.strokeRect(px+2,py+2,ts-4,ts-4);ctx.lineWidth=1;
 }
 if(tapMark){const a=(now-tapMark.t)/600;
  if(a<1){const px=ox+tapMark.x*ts,py=oy+tapMark.y*ts;ctx.globalAlpha=1-a;ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.strokeRect(px+1.5,py+1.5,ts-3,ts-3);ctx.lineWidth=1;ctx.globalAlpha=1;more0=true;}
  else tapMark=null;}
 if(G.smoke&&G.smoke.length){ctx.fillStyle='rgba(205,210,225,0.42)';for(const c of G.smoke)for(const k of c.cells){const x=k%W,y=Math.floor(k/W);if(x<x0||x>x1||y<y0||y>y1||!G.seen[k])continue;ctx.fillRect(ox+x*ts,oy+y*ts,ts,ts);}more0=true;}
 if(armed){
  const col={bash:'#ffb04a',backstab:'#ff5a8a',charge:'#ffb04a',bolt:'#ff5acd',knife:'#e0e6ff',blink:'#4ee6ff',fire:'#ff8a3a',smoke:'#cfd4e6'}[armed]||'#fff',tg=targetTiles(armed),ground=ABIL[armed].tg==='tile';
  for(const t of tg){const px=ox+t[0]*ts,py=oy+t[1]*ts;
   ctx.globalAlpha=ground&&armed!=='blink'?0.2:0.34;ctx.fillStyle=col;ctx.fillRect(px,py,ts,ts);ctx.globalAlpha=1;
   ctx.strokeStyle=col;ctx.lineWidth=ground&&armed!=='blink'?1:2;ctx.strokeRect(px+2,py+2,ts-4,ts-4);ctx.lineWidth=1;}
  more0=true;
 }
 {const dz=dangerSet();
  if(dz.size){
   const pulse=0.5+0.5*Math.sin(now/170);
   for(const k of dz){const x=k%W,y=Math.floor(k/W);if(x<x0||x>x1||y<y0||y>y1||!G.seen[k])continue;
    const px=ox+x*ts,py=oy+y*ts;
    ctx.fillStyle='rgba(255,30,30,'+(0.32+0.25*pulse)+')';ctx.fillRect(px,py,ts,ts);
    ctx.save();ctx.beginPath();ctx.rect(px,py,ts,ts);ctx.clip();
    ctx.strokeStyle='rgba(255,225,200,0.8)';ctx.lineWidth=2;ctx.beginPath();
    for(let o=-ts;o<ts*2;o+=Math.max(8,ts/4)){ctx.moveTo(px+o,py+ts);ctx.lineTo(px+o+ts,py);}
    ctx.stroke();ctx.restore();
    ctx.strokeStyle='#ff2020';ctx.lineWidth=3;ctx.strokeRect(px+1.5,py+1.5,ts-3,ts-3);ctx.lineWidth=1;
   }
   more0=true;
  }}
 if(G.cracks&&G.cracks.length){
  const pulse=0.5+0.5*Math.sin(now/200);
  for(const c of G.cracks){if(c.x<x0||c.x>x1||c.y<y0||c.y>y1||!G.seen[ix(c.x,c.y)])continue;
   const px=ox+c.x*ts,py=oy+c.y*ts;
   ctx.fillStyle='rgba(255,150,30,'+(0.28+0.22*pulse)+')';ctx.fillRect(px,py,ts,ts);
   ctx.strokeStyle='#ffb040';ctx.lineWidth=3;ctx.setLineDash([6,4]);ctx.strokeRect(px+2,py+2,ts-4,ts-4);ctx.setLineDash([]);
   ctx.strokeStyle='#2a1200';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px+ts*0.2,py+ts*0.15);ctx.lineTo(px+ts*0.45,py+ts*0.45);ctx.lineTo(px+ts*0.35,py+ts*0.6);ctx.lineTo(px+ts*0.7,py+ts*0.85);ctx.moveTo(px+ts*0.45,py+ts*0.45);ctx.lineTo(px+ts*0.8,py+ts*0.3);ctx.stroke();ctx.lineWidth=1;
   ctx.font='bold '+Math.round(ts*0.4)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=3;ctx.strokeStyle='#000';ctx.strokeText(c.t,px+ts*0.8,py+ts*0.22);ctx.fillStyle='#fff';ctx.fillText(c.t,px+ts*0.8,py+ts*0.22);ctx.lineWidth=1;}
  more0=true;
 }
 for(const e of G.enemies){
  if(!G.vis[ix(e.x,e.y)])continue;
  const px=ox+e.x*ts,py=oy+e.y*ts,d=EN[e.t];
  ctx.fillStyle=e.elite?'rgba(255,200,40,0.4)':e.awake?'rgba(200,40,40,0.28)':'rgba(0,0,0,0.25)';ctx.beginPath();ctx.arc(px+ts/2,py+ts/2,ts*0.45,0,7);ctx.fill();
  if(e.elite){ctx.strokeStyle='#ffd24a';ctx.lineWidth=3;ctx.stroke();ctx.lineWidth=1;}
  ctx.fillStyle='#fff';if(!e.awake)ctx.globalAlpha=0.6;glyph(d.e,px+ts/2,py+ts/2+1,ts*(d.boss?0.85:0.68));ctx.globalAlpha=1;
  if(!e.awake){ctx.font='bold '+Math.round(ts*0.34)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=3;ctx.strokeStyle='#000';ctx.strokeText('z',px+ts*0.82,py+ts*0.42);ctx.fillStyle='#b9c4ff';ctx.fillText('z',px+ts*0.82,py+ts*0.42);ctx.lineWidth=1;}
  {const fl=flashes[e.id];if(fl&&now-fl<190){ctx.fillStyle='rgba(255,255,255,'+(0.75*(1-(now-fl)/190))+')';ctx.beginPath();ctx.arc(px+ts/2,py+ts/2,ts*0.4,0,7);ctx.fill();more0=true;}}
  if(e.elite)glyph('⭐',px+ts*0.16,py+ts*0.4,ts*0.3);
  if(e.hunter){ctx.strokeStyle='#ff4040';ctx.lineWidth=3;ctx.beginPath();ctx.arc(px+ts/2,py+ts/2,ts*0.45,0,7);ctx.stroke();ctx.lineWidth=1;glyph('🎯',px+ts*0.16,py+ts*0.4,ts*0.3);}
  if(e.wind)glyph('❗',px+ts*0.82,py+ts*0.42,ts*0.38);
  else if(e.rest)glyph('⌛',px+ts*0.82,py+ts*0.42,ts*0.34);
  const fr=Math.max(0,Math.min(1,e.hp/e.mhp)),bh=d.boss?9:7,bx=px+2,bw=ts-4,by=py+1;
  ctx.fillStyle='#000';ctx.fillRect(bx-1,by-1,bw+2,bh+2);ctx.fillStyle='#3a0d0d';ctx.fillRect(bx,by,bw,bh);
  ctx.fillStyle=fr>0.6?'#4be04b':fr>0.3?'#ffcc33':'#ff4040';ctx.fillRect(bx,by,bw*fr,bh);
  if(e.pois){ctx.fillStyle=e.pois.burn?'#ff9a3a':'#7be04b';ctx.beginPath();ctx.arc(px+ts-7,py+ts-7,5,0,7);ctx.fill();ctx.strokeStyle='#000';ctx.stroke();}
  if(e.stun>0)glyph('💫',px+ts*0.5,py+ts*0.25,ts*0.4);
  if(e.frz>0)glyph('❄️',px+ts*0.5,py+ts*0.25,ts*0.4);
  if(e.blind>0)glyph('🌫',px+ts*0.2,py+ts*0.8,ts*0.3);
  if(d.shield&&e.face){ // the guard's shield: a thick bar on the side it faces
   const fx=e.face[0],fy=e.face[1],cx=px+ts/2+fx*ts*0.46,cy=py+ts/2+fy*ts*0.46;
   ctx.fillStyle=(e.stun>0||e.frz>0)?'#777':'#8fd0ff';ctx.strokeStyle='#000';ctx.lineWidth=1;
   if(fx&&!fy){ctx.fillRect(cx-3,py+ts*0.18,6,ts*0.64);ctx.strokeRect(cx-3,py+ts*0.18,6,ts*0.64);}
   else if(fy&&!fx){ctx.fillRect(px+ts*0.18,cy-3,ts*0.64,6);ctx.strokeRect(px+ts*0.18,cy-3,ts*0.64,6);}
   else{ctx.beginPath();ctx.arc(cx,cy,ts*0.14,0,7);ctx.fill();ctx.stroke();}
  }
  if(reachOk(e)){ctx.strokeStyle='#ffe066';ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.strokeRect(px+2,py+2,ts-4,ts-4);ctx.setLineDash([]);ctx.lineWidth=1;}
 }
 puffs=puffs.filter(q=>now-q.t<450);
 for(const q of puffs){const a=(now-q.t)/450,cx=ox+q.x*ts+ts/2,cy=oy+q.y*ts+ts/2;ctx.globalAlpha=1-a;ctx.fillStyle='#e6e6ee';for(let i=0;i<6;i++){const ang=i*1.047+q.s,r=ts*(0.15+0.5*a);ctx.beginPath();ctx.arc(cx+Math.cos(ang)*r,cy+Math.sin(ang)*r,Math.max(1.5,ts*0.12*(1-a)),0,7);ctx.fill();}ctx.globalAlpha=1;more0=true;}
 {const px=ox+vx*ts,py=oy+vy*ts;
  ctx.fillStyle='rgba(90,160,255,0.35)';ctx.beginPath();ctx.arc(px+ts/2,py+ts/2,ts*0.46,0,7);ctx.fill();if(G.vanish>0)ctx.globalAlpha=0.5;
  ctx.fillStyle='#fff';glyph(clsOf(p).e,px+ts/2,py+ts/2+1,ts*0.7);ctx.globalAlpha=1;
  if(G.brace){ctx.strokeStyle='#9cf';ctx.lineWidth=3;ctx.beginPath();ctx.arc(px+ts/2,py+ts/2,ts*0.5,0,7);ctx.stroke();ctx.lineWidth=1;}
  {const fl=flashes.p;if(fl&&now-fl<190){ctx.fillStyle='rgba(255,70,70,'+(0.6*(1-(now-fl)/190))+')';ctx.beginPath();ctx.arc(px+ts/2,py+ts/2,ts*0.42,0,7);ctx.fill();more0=true;}}
  if(now<pulseUntil&&!rm){const a=1-(pulseUntil-now)/700;ctx.strokeStyle='rgba(255,220,90,'+(1-a)+')';ctx.lineWidth=4;ctx.beginPath();ctx.arc(px+ts/2,py+ts/2,ts*(0.5+1.4*a),0,7);ctx.stroke();ctx.lineWidth=1;more0=true;}}
 drawMini(ts);
 let more=more0||shk||!!stepAnim;
 fx=fx.filter(f=>now-f.t<(f.d||800));
 let ci=0;   // second simultaneous callout sits one line higher
 for(const f of fx){
  const du=f.d||800,a=(now-f.t)/du;let px=ox+f.x*ts+ts/2,py=oy+f.y*ts+ts*0.2-(rm?0.25:a)*ts*0.6;
  ctx.globalAlpha=1-a*a;ctx.font='bold '+Math.round(ts*(f.c?0.5:f.big?0.62:0.42))+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  if(f.c){const hw=ctx.measureText(f.text).width/2+6;px=Math.max(hw,Math.min(view.cw-hw,px));py=Math.max(14,py-ts*0.5-ci*ts*0.55);ci++;}   // callouts stay on screen, above the tile
  ctx.lineWidth=3;ctx.strokeStyle='#000';ctx.strokeText(f.text,px,py);ctx.fillStyle=f.color;ctx.fillText(f.text,px,py);ctx.globalAlpha=1;more=true;
 }
 if(guard&&(now>=guard.until||guard.f!==G.floor||!perilAt(guard.k)))guard=null;
 if(guard){ // danger guard: this tile needs a second tap
  const px=ox+guard.x*ts,py=oy+guard.y*ts,pu=0.5+0.5*Math.sin(now/150);
  ctx.fillStyle='rgba(255,200,40,'+(0.18+0.18*pu)+')';ctx.fillRect(px,py,ts,ts);
  ctx.strokeStyle='#ffd24a';ctx.lineWidth=3;ctx.setLineDash([6,4]);ctx.strokeRect(px+2,py+2,ts-4,ts-4);ctx.setLineDash([]);ctx.lineWidth=1;
  ctx.fillStyle='#fff';glyph('⚠️',px+ts/2,py+ts/2+1,ts*0.6);more=true;
 }
 if(insp&&(insp.turn!==G.turn||insp.f!==G.floor))insp=null;
 drawInspect(ox,oy,ts);
 if(now<bannerUntil&&!G.over){const a=Math.min(1,(bannerUntil-now)/600);ctx.globalAlpha=a;let bfs=Math.round(Math.min(26,view.cw/14));ctx.font='bold '+bfs+'px sans-serif';while(bfs>11&&ctx.measureText(bannerText).width>view.cw-34){bfs--;ctx.font='bold '+bfs+'px sans-serif';}ctx.textAlign='center';ctx.textBaseline='middle';const bw=ctx.measureText(bannerText).width+28;ctx.fillStyle='rgba(5,5,12,0.72)';ctx.fillRect(view.cw/2-bw/2,view.ch*0.16,bw,40);ctx.fillStyle=th.wt;ctx.fillRect(view.cw/2-bw/2,view.ch*0.16+38,bw,2);ctx.fillStyle='#fff';ctx.fillText(bannerText,view.cw/2,view.ch*0.16+20);ctx.globalAlpha=1;more=true;}
 if(now<flashUntil){ctx.fillStyle='rgba(220,30,30,'+(0.35*(flashUntil-now)/250)+')';ctx.fillRect(0,0,view.cw,view.ch);more=true;}
 if(more&&!rafPending){rafPending=true;requestAnimationFrame(function(){rafPending=false;render();});}
}
