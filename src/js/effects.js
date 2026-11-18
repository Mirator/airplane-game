// effects.js - cosmetic effects state: screen shake, floating combat text, hurt flash.

function shake(a){if(rmo())return;shakeUntil=performance.now()+220;shakeAmt=a;}
// hurt flash: a red vignette at the screen edge, scaled by the share of max HP lost (0.12..0.5); only a hit of >=20% max HP washes the whole screen. None with reduced motion.
let flashAmt=0,flashFull=false,flashFrom=0;
function playerHurtFx(d){
 const p=G.p,now=performance.now()+vOff;flashes.p=now;sfx('hurt');
 const share=d/Math.max(1,p.mhp),big=d>=Math.max(6,p.mhp*0.2);
 if(!rmo()){
  const a=Math.max(0.12,Math.min(0.5,share*2.2)),live=now<flashUntil;
  flashFull=(live&&flashFull)||share>=0.2;flashAmt=live?Math.max(flashAmt,a):a;flashUntil=now+(flashFull?250:180);flashFrom=now;
 }
 buzz(big?70:30);if(big)shake(6);
}

// ---- sequencing: something that travels lands later than the action that threw it. What it hits (flash, number, death, the foe's own
// step) waits for it: holds[x,y] = the moment a projectile arrives on that tile. Cosmetic only; the game state has already moved on.
let holds={},faces={};
const TRAVEL={bolt:210,knife:190,fire:160,charge:130};
function holdAt(x,y){const h=holds[x+','+y];if(!h)return 0;const d=h-performance.now();return d>0?d:0;}
function holdSet(x,y,ms){const k=x+','+y,t=performance.now()+ms;if(!holds[k]||holds[k]<t)holds[k]=t;}
// ---- floating labels. kind n = damage / heal number (bare outlined digits), s = status word (small pill, lower case), a = announcement (upper-case pill).
// Every label is placed when it is spawned: its box is tested against the labels already alive on the screen (at the moment it appears) and it
// is stacked upward until it overlaps none. A status word waits 250 ms behind the number on its tile; the same word twice within 160 ms is one label.
const LBL_SZ={n:0.42,s:0.30,a:0.34},LBL_MS={n:800,s:700,a:900};
let lblCtx=null;const lblWc={};
function lblW(text,sz,k){ // box width in tile units
 const key=text+'|'+k;let w=lblWc[key];
 if(w==null){if(!lblCtx)lblCtx=mkCanvas(4,4).getContext('2d');lblCtx.font='800 100px system-ui,-apple-system,sans-serif';w=lblWc[key]=lblCtx.measureText(text).width/100;}
 return w*sz+(k==='n'?0.12:sz*1.1);
}
function lblBox(f){return lblW(f.text+(f.n>1?' x'+f.n:''),f.sz,f.k);}
function lblPos(f,T){ // centre of the label's box at time T, in tile units
 const a=Math.max(0,(T-f.t)/800);
 return [f.x+0.5+(f.dxo||0),f.y+0.2+(f.off||0)-a*0.6];
}
let vOff=0;   // while the enemy phase is drawn: how far behind the player's own action its visuals start (see enemiesAct)
const DEALT='#ffd24a',TAKEN='#ff5a5a';
function hpPulse(){const b=$('hpbar');if(!b)return;b.classList.remove('pulse');void b.offsetWidth;b.classList.add('pulse');}
// Numbers: damage the player TAKES is red, on the left of the player's tile; damage DEALT is gold, on the right of the foe's tile. Within 450 ms a number of
// the same kind on the same tile is added to the one already there (a "x3" tag counts the hits) instead of stacking; a tile holds at most 3 rows of labels
// (1.2 tiles of height) and a fourth replaces the oldest; a heal of less than 5 HP only pulses the HP bar; numbers never wait for pills (pills dodge numbers).
function floatFx(x,y,text,color,big){
 const now=performance.now();
 const k=/^[-+]?\d|^!$/.test(text)?'n':(text===text.toUpperCase()&&/[A-Z]/.test(text))?'a':'s';
 const mine=!!G&&!!G.p&&x===G.p.x&&y===G.p.y;
 let dxo=0,col=color,base=0;
 if(k==='n'){
  if(/^\+\d+$/.test(text)&&mine&&+text.slice(1)<5){hpPulse();return;}
  if(text[0]==='-'){
   if(mine){dxo=-0.42;col=TAKEN;}
   else if(color!=='#7be04b'&&color!=='#ff9a3a'&&color!=='#c6f'){dxo=0.3;col=/!$/.test(text)?'#fff1b0':DEALT;}
  }
 }
 if(G&&G.enemies){const bo=G.enemies.find(e=>e.x===x&&e.y===y&&EN[e.t].boss);if(bo)base=-1.6;}   // the boss is 2.6 tiles tall: labels sit at its head, not its belly
 if(k==='a'&&big)base=Math.min(base,-0.9);                                                       // area pills (BOOM, NOVA, SMOKE) ride above the numbers
 let t=now+holdAt(x,y)+vOff;const t0=t;
 for(const g of fx){if(g.c)continue;
  if(k!=='n'&&g.text===text&&Math.abs(g.t0-t0)<160)return;                       // one word per volley
  if(k==='s'&&g.k==='n'&&g.x===x&&g.y===y&&g.t>now-300)t=Math.max(t,g.t+250);}  // after the number, not on top of it
 if(k==='n'){
  for(const g of fx){
   if(g.c||g.k!=='n'||g.x!==x||g.y!==y||g.dxo!==dxo||g.color!==col||g.big!==!!big)continue;
   if(!/^[-+]?\d+!?$/.test(g.text)||t-g.t>450||t<g.t)continue;
   const a=parseInt(g.text,10),b=parseInt(text,10);
   g.text=(a+b<0?'-':'+')+Math.abs(a+b)+(/!$/.test(text)||/!$/.test(g.text)?'!':'');g.n=(g.n||1)+1;g.t=t;g.t0=t;return;
  }
 }
 const live=fx.filter(g=>!g.c&&now<g.t+g.d).length;
 const sz=LBL_SZ[k]*(k==='n'&&big?1.4:1),f={x:x,y:y,text:text,color:col,big:!!big,t:t,t0:t0,k:k,sz:sz,d:k==='n'&&live>4?550:LBL_MS[k],off:base,dxo:dxo,n:1};
 const w=lblW(text,sz,k),h=sz*(k==='n'?1.15:1.5),step=Math.max(0.3,h);
 let row=-1;
 for(let i=0;i<3&&row<0;i++){
  f.off=base-i*step;
  let hit=false;const pa=lblPos(f,t);
  for(const g of fx){if(g.c||t>g.t+g.d||g.t>t+f.d)continue;if(k==='n'&&g.k!=='n')continue;
   const Tc=Math.max(t,g.t),A=lblPos(f,Tc),B=lblPos(g,Tc),gw=lblBox(g),gh=g.sz*(g.k==='n'?1.15:1.5);
   if(Math.abs(A[0]-B[0])<(w+gw)/2&&Math.abs(A[1]-B[1])<(h+gh)/2){hit=true;break;}}
  if(!hit)row=i;
 }
 if(row<0){   // no room within the cap: the oldest label on this tile makes way
  let old=null;for(const g of fx)if(!g.c&&g.x===x&&g.y===y&&g.k===k&&(!old||g.t<old.t))old=g;
  if(old)fx.splice(fx.indexOf(old),1);
  f.off=base;
 }
 fx.push(f);
}
// callout: a brief on-map word or two (<=3 words, ~1 s) for the few events worth seeing without reading the log. Drawn on the canvas (so it can
// never take a tap), at most BAL.ui.calloutMax at once (a third one is dropped; the log keeps the history), no motion with reduced motion.
let calloutDelay=0;   // a boss's death plays for ~900 ms: pills born in the same turn (LEVEL UP) wait for it
function callout(x,y,text,color){
 const now=performance.now(),d=BAL.ui.calloutMs;let n=0;
 for(const f of fx)if(f.c&&now-f.t<d)n++;
 if(n>=BAL.ui.calloutMax)return;
 fx.push({x,y,text,color,big:true,t:now+calloutDelay,c:1,d:d});
}
// HP below 30%: one callout per crossing (it re-arms once HP is back above 40%). The first look at a run only records the state.
function lowHpWatch(){
 const p=G.p,U=BAL.ui;
 if(hpLowG!==G){hpLowG=G;hpLow=p.hp<p.mhp*U.lowHp;return;}
 if(p.hp>=p.mhp*U.lowHpReset)hpLow=false;
 else if(!hpLow&&p.hp>0&&p.hp<p.mhp*U.lowHp){hpLow=true;callout(p.x,p.y,'LOW HP','#ff5a5a');}
}
// an elite coming into view for the first time on a floor
function eliteWatch(){
 if(!G.enemies)return;
 if(eliteG!==G){eliteG=G;eliteSeen=new Set();}
 for(const e of G.enemies)if(e.elite&&G.vis[ix(e.x,e.y)]){const k=G.floor+':'+e.id;if(!eliteSeen.has(k)){eliteSeen.add(k);callout(e.x,e.y,'ELITE','#ffd24a');}}
}

// ---- motion: lunges, death pops and per-ability effects. All cosmetic, all <= 450 ms, none blocks input, none uses Math.random
// (a seeded run must play out identically with or without them), and all are skipped with prefers-reduced-motion. ----
let lunges={},ghosts=[],vfx=[];
const VFX_MS={bolt:300,knife:240,nova:380,blink:320,fire:440,cleave:240,charge:280,bash:240,brace:340,backstab:260,vanish:340,smoke:430};
function lunge(id,dx,dy){if(dx)faces[id]=Math.sign(dx);if(rmo())return;lunges[id]={t:performance.now()+vOff,dx:Math.sign(dx),dy:Math.sign(dy)};}
function ghostAdd(e){if(rmo())return;const boss=!!EN[e.t].boss;ghosts.push({id:EN[e.t].e,x:e.x,y:e.y,elite:!!e.elite,boss:boss,rage:!!e.enraged,t:performance.now()+holdAt(e.x,e.y)+vOff});if(boss)shake(8);}
function puffAdd(x,y){if(rmo())return;puffs.push({x:x,y:y,t:performance.now()+holdAt(x,y),s:Math.random()*6});}
function vfxAdd(k,x,y,x2,y2,r){
 if(rmo())return;
 vfx.push({k:k,x:x,y:y,x2:x2==null?x:x2,y2:y2==null?y:y2,r:r||1,t:performance.now(),d:VFX_MS[k]||300});
 if(TRAVEL[k]){const R=k==='fire'?(r||1):0;for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++)holdSet(x2+dx,y2+dy,TRAVEL[k]);}
 else if(k==='nova'){for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)holdSet(x+dx,y+dy,55*Math.max(Math.abs(dx),Math.abs(dy)));}
}
const lerp=(a,b,t)=>a+(b-a)*t;
function ring(cx,cy,r,col,w,al){ctx.globalAlpha=Math.max(0,al);ctx.strokeStyle=col;ctx.lineWidth=w;ctx.beginPath();ctx.arc(cx,cy,Math.max(0.5,r),0,7);ctx.stroke();ctx.globalAlpha=1;}
function ringE(cx,cy,rx,ry,col,w,al){ctx.globalAlpha=Math.max(0,al);ctx.strokeStyle=col;ctx.lineWidth=w;ctx.beginPath();ctx.ellipse(cx,cy,Math.max(0.5,rx),Math.max(0.5,ry),0,0,7);ctx.stroke();ctx.globalAlpha=1;}
function disc(cx,cy,r,col,al){ctx.globalAlpha=Math.max(0,al);ctx.fillStyle=col;ctx.beginPath();ctx.arc(cx,cy,Math.max(0.5,r),0,7);ctx.fill();ctx.globalAlpha=1;}
function star4(cx,cy,r,col,al,rot){ctx.save();ctx.translate(cx,cy);ctx.rotate(rot||0);ctx.globalAlpha=Math.max(0,al);ctx.fillStyle=col;ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rr=i%2?r*0.28:r;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();ctx.fill();ctx.restore();ctx.globalAlpha=1;}
// draws the live effects; returns true while any is still running (render keeps animating)
function drawVfx(ox,oy,ts,now){
 vfx=vfx.filter(f=>now-f.t<f.d);
 for(const f of vfx){
  const k=(now-f.t)/f.d,ax=ox+(f.x+0.5)*ts,ay=oy+(f.y+0.5)*ts,bx=ox+(f.x2+0.5)*ts,by=oy+(f.y2+0.5)*ts,e=1-(1-k)*(1-k);
  switch(f.k){
   case 'bolt':{const m=Math.min(1,k/0.7),px=lerp(ax,bx,m),py=lerp(ay,by,m);
    for(let i=1;i<=4;i++){const q=Math.max(0,m-i*0.07);disc(lerp(ax,bx,q),lerp(ay,by,q),ts*0.16*(1-i*0.17),'#c08cff',0.5*(1-i*0.2));}
    if(k<0.75){disc(px,py,ts*0.22,'#e9d6ff',1);disc(px,py,ts*0.13,'#fff',1);}
    else{const q=(k-0.7)/0.3;ring(bx,by,ts*(0.2+0.4*q),'#c08cff',3,1-q);star4(bx,by,ts*0.4*(1-q*0.4),'#fff',1-q,q*2);}break;}
   case 'knife':{const m=Math.min(1,k/0.8),px=lerp(ax,bx,m),py=lerp(ay,by,m);
    ctx.save();ctx.translate(px,py);ctx.rotate(m*12);ctx.globalAlpha=1-Math.max(0,(k-0.8)*5);ctx.drawImage(spriteBmp('knife',Math.round(ts*0.55)),-ts*0.275,-ts*0.275,ts*0.55,ts*0.55);ctx.restore();ctx.globalAlpha=1;
    if(k>0.75)star4(bx,by,ts*0.35,'#fff',1-(k-0.75)*4,0);break;}
   case 'nova':{ring(ax,ay,ts*(0.3+1.5*e),'#8fe3ff',4*(1-k)+1,1-k);ring(ax,ay,ts*(0.2+1.0*e),'#fff',2,0.8*(1-k));
    for(let i=0;i<6;i++){const a=i*Math.PI/3+0.4,rr=ts*(0.4+1.1*e);star4(ax+Math.cos(a)*rr,ay+Math.sin(a)*rr,ts*0.2*(1-k),'#e6fbff',1-k,a);}break;}
   case 'blink':{const m=Math.min(1,k/0.5);ring(ax,ay,ts*(0.5*(1-m)+0.05),'#d4ccff',3,1-m*0.5);disc(ax,ay,ts*0.4*(1-m),'#8f7bff',0.6);
    ctx.globalAlpha=0.5*(1-k);ctx.strokeStyle='#d4ccff';ctx.lineWidth=ts*0.14;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(lerp(ax,bx,Math.min(1,k*2.5)),lerp(ay,by,Math.min(1,k*2.5)));ctx.stroke();ctx.globalAlpha=1;
    const q=Math.max(0,(k-0.3)/0.7);ring(bx,by,ts*(0.1+0.7*q),'#fff',3,1-q);star4(bx,by,ts*0.5*(1-q),'#d4ccff',1-q,q*3);break;}
   case 'fire':{const m=Math.min(1,k/0.36);
    if(k<0.36){const px=lerp(ax,bx,m),py=lerp(ay,by,m)-Math.sin(m*Math.PI)*ts*0.5;disc(px,py,ts*0.2,'#ff9a3a',1);disc(px,py,ts*0.11,'#ffe08a',1);}
    else{const q=(k-0.36)/0.64,R=(f.r+0.55)*ts*(0.5+0.5*(1-(1-q)*(1-q)));disc(bx,by,R,'#d4421a',0.55*(1-q));disc(bx,by,R*0.72,'#ff9a3a',0.7*(1-q));disc(bx,by,R*0.4,'#ffe08a',0.9*(1-q));}break;}
   case 'cleave':{const a0=-2.2+e*5.2;ctx.save();ctx.globalAlpha=1-k*k;ctx.strokeStyle='#ffd9a0';ctx.lineCap='round';ctx.lineWidth=ts*0.2*(1-k*0.6);ctx.beginPath();ctx.arc(ax,ay,ts*0.95,a0-1.5,a0);ctx.stroke();
    ctx.strokeStyle='#fff';ctx.lineWidth=ts*0.07;ctx.beginPath();ctx.arc(ax,ay,ts*0.95,a0-1.1,a0);ctx.stroke();ctx.restore();ctx.globalAlpha=1;break;}
   case 'charge':{ctx.globalAlpha=0.6*(1-k);ctx.strokeStyle='#97c6ff';ctx.lineCap='round';
    const dx=bx-ax,dy=by-ay,n=Math.hypot(dx,dy)||1,nx=-dy/n,ny=dx/n;
    for(const o of [-0.28,0,0.28]){ctx.lineWidth=ts*0.1;ctx.beginPath();ctx.moveTo(ax+nx*o*ts,ay+ny*o*ts);ctx.lineTo(lerp(ax,bx,Math.min(1,k*2.2))+nx*o*ts,lerp(ay,by,Math.min(1,k*2.2))+ny*o*ts);ctx.stroke();}
    ctx.globalAlpha=1;if(k>0.3){const q=(k-0.3)/0.7;ring(bx,by,ts*(0.2+0.6*q),'#fff',3,1-q);star4(bx,by,ts*0.55*(1-q*0.5),'#ffe066',1-q,0.4);}break;}
   case 'bash':{ring(bx,by,ts*(0.2+0.7*e),'#ffb04a',5*(1-k)+1,1-k);star4(bx,by,ts*0.7*(1-k*0.4),'#ffe066',1-k,0.2);star4(bx,by,ts*0.4*(1-k),'#fff',1-k,0.8);break;}
   case 'brace':{ring(ax,ay,ts*(0.45+0.5*e),'#97c6ff',4*(1-k)+1,1-k);ring(ax,ay,ts*(0.35+0.3*e),'#fff',2,0.7*(1-k));break;}
   case 'backstab':{ctx.save();ctx.globalAlpha=1-k;ctx.lineCap='round';
    for(const s of [[-1,-1,1,1],[1,-1,-1,1]]){const m=Math.min(1,k*3),L=ts*0.5;ctx.strokeStyle='#ff5a8a';ctx.lineWidth=ts*0.16*(1-k);ctx.beginPath();ctx.moveTo(ax+s[0]*L,ay+s[1]*L);ctx.lineTo(ax+(s[0]+(s[2]-s[0])*m)*L,ay+(s[1]+(s[3]-s[1])*m)*L);ctx.stroke();
     ctx.strokeStyle='#fff';ctx.lineWidth=ts*0.05;ctx.stroke();}
    ctx.restore();ctx.globalAlpha=1;star4(ax,ay,ts*0.45*(1-k),'#ffb0c8',1-k,0.5);break;}
   case 'vanish':{for(let i=0;i<8;i++){const a=i*Math.PI/4+0.3,rr=ts*(0.9*(1-e)+0.1);disc(ax+Math.cos(a)*rr,ay+Math.sin(a)*rr,ts*0.17,'#9fe8c6',0.7*(1-k));}ring(ax,ay,ts*(0.3+0.4*e),'#eafff4',2,1-k);break;}
   case 'smoke':{const R=(f.r+0.5)*ts*(0.4+0.6*e);const al=0.55*(1-k*k);
    for(let i=0;i<7;i++){const a=i*2.4,rr=R*(0.25+0.65*((i*37%10)/10));disc(bx+Math.cos(a)*rr,by+Math.sin(a)*rr,ts*(0.45+0.2*((i*13%5)/5)),'#c4cadc',al);}
    disc(bx,by,R*0.6,'#e6e9f6',al*0.7);break;}
  }
 }
 return vfx.length>0;
}
