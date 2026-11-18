// art.js - the one place for the art direction: palette constants, the flat-vector sprite engine (canvas cache + inline SVG) and the tile painters.
// Style rule: flat filled shapes, 2-3 tones per object (a = base, b = shadow, c = highlight), ONE uniform dark outline (INK, OUT units) on every
// sprite, no outlines on the environment. Sprites are data (sprites.js): layers of [fill, svgPathData, strokeWidth?, outline?, transform?] on a 100x100 grid,
// painted twice by the same code: onto cached offscreen canvases (map) and as inline SVG (interface icons). No image files, no fonts.

const INK='#14111d',OUT=4.2;
// named flat colours used by sprite layers (a/b/c are the sprite's own three tones)
const Q={k:INK,w:'#f2ecdc',W:'#ffffff',y:'#ffc93c',Y:'#d38f1f',z:'#ffe58a',s:'#aeb9d0',S:'#6f7c99',T:'#e4eaf6',n:'#8c5a2e',N:'#5c3718',m:'#bd864d',r:'#e5483f',R:'#9c2a35',o:'#ff9a3a',f:'#ffd95a',u:'#46dcf5',U:'#b9eeff',p:'#a463ff',g:'#58d36b',G:'#2f8f4a',h:'#f2c9a0',H:'#c99468',d:'#3a3550',e:'#9a4a2a'};
// meaning of colour (one restrained palette): classes cool + saturated, foes warm by threat, loot gold, danger red, interactables one cyan accent
const PAL={
 ink:INK,gold:'#ffc93c',goldS:'#d38f1f',danger:'#ff3b3b',accent:'#46dcf5',
 warrior:'#3f86ff',mage:'#a463ff',rogue:'#2fcf8a',
 hpHi:'#4fd97a',hpMid:'#ffcc33',hpLow:'#ff4a4a',
 panel:'#171a2b',panel2:'#232845',line:'#3c4272',text:'#ece9f6',dim:'#a7a5bf'
};
// floor themes: dark, desaturated environments (characters carry the saturation). fa/fb floor, fc detail, fs contact shadow, wt wall top, wf wall front, we mortar, wh wall edge light
const ENV=[
 {n:'The Crypt',fa:'#454b6e',fb:'#4c5378',fc:'#343a5c',fs:'#14172b',wt:'#666fa2',wf:'#2e3358',we:'#1f2342',wh:'#8f98c8',mw:'#4b548a',mf:'#8f97c4',mfd:'#4b5078'},
 {n:'The Caverns',fa:'#385a50',fb:'#3f6358',fc:'#2a4640',fs:'#0f1e1a',wt:'#5a8a78',wf:'#27413a',we:'#1a2e29',wh:'#86bba6',mw:'#3f6b5c',mf:'#86b09c',mfd:'#46665a'},
 {n:'The Embers',fa:'#5a3a33',fb:'#63413a',fc:'#442a26',fs:'#1d0f0c',wt:'#94503a',wf:'#43201b',we:'#2c130f',wh:'#c47a58',mw:'#7e3d2c',mf:'#c08460',mfd:'#6b4234'}
];
// ---- colour helpers (tile palettes only; sprites use fixed colours) ----
function hx(c){return [parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];}
function hex3(r,g,b){return '#'+[r,g,b].map(v=>('0'+Math.max(0,Math.min(255,Math.round(v))).toString(16)).slice(-2)).join('');}
function mixc(a,b,t){const A=hx(a),B=hx(b);return hex3(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t);}
function grayc(c){const A=hx(c),l=0.3*A[0]+0.59*A[1]+0.11*A[2];return hex3(l,l,l);}
// remembered (out of sight) version of a colour: desaturated and darker
function dimc(c){return mixc(mixc(c,grayc(c),0.55),'#07080f',0.58);}

// ---- path helpers: everything is an SVG path string so one definition serves canvas (Path2D) and inline SVG ----
const rr=v=>Math.round(v*10)/10;
function C(x,y,r){return E(x,y,r,r);}
function E(x,y,rx,ry){return 'M'+rr(x-rx)+' '+y+'a'+rx+' '+ry+' 0 1 0 '+rr(rx*2)+' 0a'+rx+' '+ry+' 0 1 0 '+rr(-rx*2)+' 0z';}
function R(x,y,w,h,r){r=Math.min(r||0,w/2,h/2);return 'M'+(x+r)+' '+y+'h'+rr(w-2*r)+'a'+r+' '+r+' 0 0 1 '+r+' '+r+'v'+rr(h-2*r)+'a'+r+' '+r+' 0 0 1 '+(-r)+' '+r+'h'+rr(-(w-2*r))+'a'+r+' '+r+' 0 0 1 '+(-r)+' '+(-r)+'v'+rr(-(h-2*r))+'a'+r+' '+r+' 0 0 1 '+r+' '+(-r)+'z';}
function P(){const a=arguments;let s='M'+a[0]+' '+a[1];for(let i=2;i<a.length;i+=2)s+='L'+a[i]+' '+a[i+1];return s+'z';}
// a mirrored copy (about x=50) follows the layer: symmetric parts are written once
function mm(l){return [l,[l[0],l[1],l[2],l[3],'m']];}
// rotate a whole list of layers about (cx,cy)
function rot(ls,deg,cx,cy){return ls.map(l=>[l[0],l[1],l[2],l[3],[deg,cx==null?50:cx,cy==null?50:cy]]);}

const SPR={};
function def(id,tones,layers){SPR[id]={t:tones,l:layers};}
const cache={},pcache={};
let artMissing=[];
function colOf(d,k,variant){
 let c=Q[k];
 if(!c){const i='abc'.indexOf(k);c=i>=0&&k.length===1?d.t[i]:k;}
 return variant==='gray'?grayc(c):c;
}
function paintLayer(c,L,fill,stroke){
 const d=L[1],sw=L[2],tf=L[4];let p=pcache[d];if(!p)p=pcache[d]=new Path2D(d);
 c.save();
 if(tf==='m'){c.translate(100,0);c.scale(-1,1);}else if(tf){c.translate(tf[1],tf[2]);c.rotate(tf[0]*Math.PI/180);c.translate(-tf[1],-tf[2]);}
 if(stroke){c.lineWidth=(sw||0)+OUT*2;c.strokeStyle=stroke;c.stroke(p);if(!sw){c.fillStyle=stroke;c.fill(p);}}
 else if(sw){c.lineWidth=sw;c.strokeStyle=fill;c.stroke(p);}
 else{c.fillStyle=fill;c.fill(p);}
 c.restore();
}
// paint a sprite into a context already scaled to the 100-unit grid. variant: ''|'flash'(white silhouette)|'gray'
function paintSprite(c,s,variant){
 c.lineJoin='round';c.lineCap='round';
 const oc=variant==='flash'?'#fff':INK;
 for(const L of s.l)if(L[3]!==0)paintLayer(c,L,null,oc);
 for(const L of s.l)paintLayer(c,L,variant==='flash'?'#fff':colOf(s,L[0],variant),null);
}
function mkCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
// cached offscreen bitmap of a sprite at `size` CSS px (times the device pixel ratio)
function spriteBmp(id,size,variant){
 const dpr=view.dpr||1,w=Math.max(2,Math.round(size*dpr)),key=id+'|'+w+'|'+(variant||'');
 let b=cache[key];if(b)return b;
 const s=SPR[id];
 b=mkCanvas(w,w);
 if(!s){if(artMissing.indexOf(id)<0)artMissing.push(id);const c=b.getContext('2d');c.fillStyle='#f0f';c.fillRect(0,0,w,w);return cache[key]=b;}
 const c=b.getContext('2d');c.scale(w/100,w/100);paintSprite(c,s,variant);
 return cache[key]=b;
}
// blit a sprite onto the main canvas: (x,y) top-left in CSS px, size in CSS px
function drawSpr(id,x,y,size,variant){ctx.drawImage(spriteBmp(id,size,variant),x,y,size,size);}
// ---- inline SVG for interface icons (same layers, same outline) ----
const svgCache={};
function svgLayer(L,s,outline){
 const sw=L[2],tf=L[4];
 let t='';if(tf==='m')t=' transform="matrix(-1 0 0 1 100 0)"';else if(tf)t=' transform="rotate('+tf[0]+' '+tf[1]+' '+tf[2]+')"';
 if(outline)return '<path d="'+L[1]+'"'+(sw?' fill="none"':' fill="'+INK+'"')+' stroke="'+INK+'" stroke-width="'+rr((sw||0)+OUT*2)+'"'+t+'/>';
 return sw?'<path d="'+L[1]+'" fill="none" stroke="'+colOf(s,L[0])+'" stroke-width="'+sw+'"'+t+'/>':'<path d="'+L[1]+'" fill="'+colOf(s,L[0])+'"'+t+'/>';
}
function svgInner(id){
 const s=SPR[id];if(!s){if(artMissing.indexOf(id)<0)artMissing.push(id);return '<rect width="100" height="100" fill="#f0f"/>';}
 let h='<g stroke-linejoin="round" stroke-linecap="round">';
 for(const L of s.l)if(L[3]!==0)h+=svgLayer(L,s,true);
 for(const L of s.l)h+=svgLayer(L,s,false);
 return h+'</g>';
}
// ic('potion',20) -> '<svg class="ic" ...>'. Safe to put inside any innerHTML. cls adds a class (for tinting rules in CSS).
function ic(id,px,cls){
 px=px||18;const k=id+'|'+px+'|'+(cls||'');
 return svgCache[k]||(svgCache[k]='<svg class="ic'+(cls?' '+cls:'')+'" data-ic="'+id+'" width="'+px+'" height="'+px+'" viewBox="0 0 100 100" aria-hidden="true" focusable="false">'+svgInner(id)+'</svg>');
}
// ---- environment tiles: pre-rendered once per theme / size / look, then blitted ----
function tileKey(th,kind,v,lit,ts){return th.n+'|'+kind+'|'+v+'|'+(lit?1:0)+'|'+ts+'|'+(view.dpr||1);}
const tcache={};
function tileBmp(th,kind,v,lit,ts){
 const k=tileKey(th,kind,v,lit,ts);let b=tcache[k];if(b)return b;
 const dpr=view.dpr||1,w=Math.round(ts*dpr);b=mkCanvas(w,w);const c=b.getContext('2d');c.scale(w/ts,w/ts);
 const L=x=>lit?x:dimc(x);
 if(kind==='floor'||kind==='floors'){ // floor; 's' = a wall sits right above it, so it gets a soft contact shadow
  c.fillStyle=L(v===1?th.fb:th.fa);c.fillRect(0,0,ts,ts);
  c.fillStyle=L(th.fc);c.globalAlpha=0.55;
  if(v===2){c.beginPath();c.moveTo(ts*0.2,ts*0.62);c.lineTo(ts*0.42,ts*0.5);c.lineTo(ts*0.52,ts*0.6);c.lineTo(ts*0.78,ts*0.4);c.lineWidth=Math.max(1.2,ts*0.045);c.strokeStyle=L(th.fc);c.lineJoin='round';c.stroke();}
  else if(v===3){c.beginPath();c.arc(ts*0.3,ts*0.66,ts*0.07,0,7);c.arc(ts*0.62,ts*0.4,ts*0.055,0,7);c.arc(ts*0.7,ts*0.74,ts*0.04,0,7);c.fill();}
  c.globalAlpha=0.16;c.fillStyle='#000';c.fillRect(0,ts-1,ts,1);c.fillRect(ts-1,0,1,ts);c.globalAlpha=1;
  if(kind==='floors'){c.globalAlpha=lit?0.5:0.35;c.fillStyle=L(th.fs);c.fillRect(0,0,ts,ts*0.3);c.globalAlpha=lit?0.25:0.18;c.fillRect(0,ts*0.3,ts,ts*0.12);c.globalAlpha=1;}
 }else if(kind==='water'){
  c.fillStyle=lit?'rgba(48,120,230,0.5)':'rgba(30,70,150,0.38)';c.fillRect(0,0,ts,ts);
  c.strokeStyle=lit?'rgba(205,234,255,0.85)':'rgba(130,170,220,0.4)';c.lineWidth=Math.max(1.5,ts*0.06);c.lineCap='round';c.beginPath();
  const o=v?ts*0.2:0;for(const wy of [ts*0.36,ts*0.7]){c.moveTo(ts*0.1+o,wy);c.quadraticCurveTo(ts*0.28+o,wy-ts*0.14,ts*0.46+o,wy);c.quadraticCurveTo(ts*0.64+o,wy+ts*0.14,ts*0.8+o,wy);}c.stroke();
 }else{ // wall: top face + (when the tile below is open) a darker front face with brick lines
  const front=kind==='wallf',fh=front?ts*0.42:0,top=ts-fh;
  c.fillStyle=L(th.wt);c.fillRect(0,0,ts,ts);
  c.fillStyle=L(th.wh);c.globalAlpha=0.45;c.fillRect(0,0,ts,Math.max(1.5,ts*0.07));c.globalAlpha=1;
  if(front){
   c.fillStyle=L(th.wf);c.fillRect(0,top,ts,fh);
   c.fillStyle='#000';c.globalAlpha=0.28;c.fillRect(0,top,ts,Math.max(1.5,ts*0.06));c.globalAlpha=1;
   c.strokeStyle=L(th.we);c.lineWidth=Math.max(1,ts*0.04);c.beginPath();
   const m=top+fh*0.52;c.moveTo(0,m);c.lineTo(ts,m);
   const o=ts*(v%2?0.7:0.3),o2=(o+ts*0.5)%ts;c.moveTo(o,top);c.lineTo(o,m);c.moveTo(o2,m);c.lineTo(o2,ts);c.stroke();
  }else{c.strokeStyle=L(th.we);c.globalAlpha=0.5;c.lineWidth=1;c.strokeRect(0.5,0.5,ts-1,ts-1);c.globalAlpha=1;}
 }
 return tcache[k]=b;
}
// tiny deterministic hash (no Math.random: map looks must not consume the game's random stream)
function hash2(x,y){let h=(x*374761393+y*668265263)|0;h=(h^(h>>>13))*1274126177|0;return ((h^(h>>>16))>>>0);}
function floorVar(x,y){const h=hash2(x,y)%10;return h<4?0:h<7?1:h<8?2:h<9?3:0;}

// per-frame fast path for the tile loop: a numeric lookup table (no string keys per tile) resolved once per theme / size
const TK={floor:0,floors:1,wallf:2,wallt:3,water:4};
let lutKey='',lut=null;
function tileLut(th,ts){
 const k=th.n+'|'+ts+'|'+(view.dpr||1);
 if(k!==lutKey){lutKey=k;lut=[];}
 return lut;
}
function tileFast(L,th,kind,v,lit,ts){
 const i=((TK[kind]*4+v)*2)+(lit?1:0);
 return L[i]||(L[i]=tileBmp(th,kind,v,lit,ts));
}
