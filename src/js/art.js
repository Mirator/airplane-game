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
 hpHi:'#4fd97a',hpMid:'#ffb020',hpLow:'#ff4a4a',
 panel:'#171a2b',panel2:'#232845',line:'#3c4272',text:'#ece9f6',dim:'#a7a5bf'
};
// floor themes: dark, desaturated environments (characters carry the saturation). fa/fb floor, fc detail, fs contact shadow, wt wall top, wf wall front, we mortar, wh wall edge light
const ENV=[
 {n:'The Crypt',fa:'#4a5176',fb:'#525a82',fc:'#3a4062',fs:'#14172b',wt:'#2b3052',wf:'#3a4170',we:'#20243f',wh:'#4a5386',mw:'#4b548a',mf:'#8f97c4',mfd:'#4b5078',em:0},
 {n:'The Caverns',fa:'#3d6358',fb:'#446c60',fc:'#2f4d46',fs:'#0f1e1a',wt:'#22392f',wf:'#2f4d43',we:'#1a2e29',wh:'#3f6b5c',mw:'#3f6b5c',mf:'#86b09c',mfd:'#46665a',em:0},
 {n:'The Embers',fa:'#44363a',fb:'#4b3c40',fc:'#33282b',fs:'#1d0f0c',wt:'#34201a',wf:'#4a2a22',we:'#2c130f',wh:'#8a4a30',mw:'#7e3d2c',mf:'#c08460',mfd:'#6b4234',em:1}
];
// ---- colour helpers (tile palettes only; sprites use fixed colours) ----
function hx(c){return [parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];}
function hex3(r,g,b){return '#'+[r,g,b].map(v=>('0'+Math.max(0,Math.min(255,Math.round(v))).toString(16)).slice(-2)).join('');}
function mixc(a,b,t){const A=hx(a),B=hx(b);return hex3(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t);}
function grayc(c){const A=hx(c),l=0.3*A[0]+0.59*A[1]+0.11*A[2];return hex3(l,l,l);}
// remembered (out of sight) version of a colour: desaturated and darker
function dimc(c){return mixc(mixc(c,grayc(c),0.25),'#07080f',0.5);}

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
const RAGE=['#ff5a2a','#a8241a','#ffa070'];   // the enraged boss: hotter body tones
function colOf(d,k,variant){
 let c=Q[k];
 if(!c){const i='abc'.indexOf(k);c=i>=0&&k.length===1?(variant==='rage'?RAGE[i]:d.t[i]):k;}
 return variant==='gray'?grayc(c):c;
}
function paintLayer(c,L,fill,stroke,extra){
 const d=L[1],sw=L[2],tf=L[4];let p=pcache[d];if(!p)p=pcache[d]=new Path2D(d);
 c.save();
 if(tf==='m'){c.translate(100,0);c.scale(-1,1);}else if(tf){c.translate(tf[1],tf[2]);c.rotate(tf[0]*Math.PI/180);c.translate(-tf[1],-tf[2]);}
 if(stroke){c.lineWidth=(sw||0)+OUT*2+(extra||0);c.strokeStyle=stroke;c.stroke(p);if(!sw){c.fillStyle=stroke;c.fill(p);}}
 else if(sw){c.lineWidth=sw;c.strokeStyle=fill;c.stroke(p);}
 else{c.fillStyle=fill;c.fill(p);}
 c.restore();
}
// paint a sprite into a context already scaled to the 100-unit grid. variant: ''|'flash'(white silhouette)|'gray'
function paintSprite(c,s,variant){
 c.lineJoin='round';c.lineCap='round';
 const oc=variant==='flash'?'#fff':INK;
 if(s.halo&&variant!=='flash'&&variant!=='gray'){c.globalAlpha=0.4;for(const L of s.l)if(L[3]!==0)paintLayer(c,L,null,'#f2ecdc',5);c.globalAlpha=1;}   // foes: a faint light rim under the ink keeps them apart from any floor
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
// rounded rect with per-corner radii [tl,tr,br,bl] (0 = square corner)
function rrc(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r[0],y);c.lineTo(x+w-r[1],y);if(r[1])c.arcTo(x+w,y,x+w,y+r[1],r[1]);else c.lineTo(x+w,y);c.lineTo(x+w,y+h-r[2]);if(r[2])c.arcTo(x+w,y+h,x+w-r[2],y+h,r[2]);else c.lineTo(x+w,y+h);c.lineTo(x+r[3],y+h);if(r[3])c.arcTo(x,y+h,x,y+h-r[3],r[3]);else c.lineTo(x,y+h);c.lineTo(x,y+r[0]);if(r[0])c.arcTo(x,y,x+r[0],y,r[0]);else c.lineTo(x,y);c.closePath();}
// flagstone layouts: stones as [x,y,w,h] in tile fractions (the gaps between them show the darker joint colour)
const FLAGS=[
 [[0,0,1,0.52],[0,0.52,0.44,0.48],[0.44,0.52,0.56,0.48]],
 [[0,0,0.56,1],[0.56,0,0.44,0.5],[0.56,0.5,0.44,0.5]],
 [[0,0,0.4,0.6],[0.4,0,0.6,0.6],[0,0.6,1,0.4]],
 [[0,0,1,0.38],[0,0.38,0.62,0.62],[0.62,0.38,0.38,0.62]]
];
function tileBmp(th,kind,v,lit,ts){
 const k=tileKey(th,kind,v,lit,ts);let b=tcache[k];if(b)return b;
 const dpr=view.dpr||1,w=Math.round(ts*dpr);b=mkCanvas(w,w);const c=b.getContext('2d');c.scale(w/ts,w/ts);
 const L=x=>lit?x:dimc(x);
 if(kind==='floor'||kind==='floors'){ // floor; 's' = a wall sits right above it, so it gets a soft contact shadow
  // v: 0..3 = flagstone layout (and which of the two floor tones); layout 2 also gets a chipped corner; the Embers get sparse ember specks
  const g=Math.max(0.8,ts*0.045),lay=FLAGS[v===1?1:v===2?2:v===3?3:0],base=L(v===1||v===3?th.fb:th.fa);
  c.fillStyle=L(th.fc);c.fillRect(0,0,ts,ts);
  c.fillStyle=base;
  for(const q of lay){rrc(c,q[0]*ts+g,q[1]*ts+g,q[2]*ts-2*g,q[3]*ts-2*g,[ts*0.07,ts*0.07,ts*0.07,ts*0.07]);c.fill();}
  if(v===2){c.fillStyle=L(th.fc);c.beginPath();c.moveTo(ts-g,ts-g);c.lineTo(ts-g-ts*0.2,ts-g);c.lineTo(ts-g,ts-g-ts*0.17);c.closePath();c.fill();}
  if(th.em&&v===3){ // a few glowing ember specks (separate dots in a soft glow: a connected shape reads as a dropped item)
   const dot=function(x,y,r){c.beginPath();c.arc(x,y,r,0,7);c.fill();};
   c.fillStyle=lit?'#ffcf6a':L('#ffcf6a');c.globalAlpha=0.2;dot(ts*0.33,ts*0.74,Math.max(2,ts*0.12));c.globalAlpha=0.7;c.fillStyle=lit?'#ff9a3a':L('#ff9a3a');
   dot(ts*0.3,ts*0.72,Math.max(1.5,ts*0.045));dot(ts*0.4,ts*0.8,Math.max(1,ts*0.03));dot(ts*0.7,ts*0.3,Math.max(1,ts*0.03));c.globalAlpha=1;}
  if(kind==='floors'){c.globalAlpha=lit?0.5:0.35;c.fillStyle=L(th.fs);c.fillRect(0,0,ts,ts*0.3);c.globalAlpha=lit?0.25:0.18;c.fillRect(0,ts*0.3,ts,ts*0.12);c.globalAlpha=1;}
 }else if(kind==='water'){
  // one merged pool: v is the 4-bit mask of sides that have water next to them (1 up, 2 right, 4 down, 8 left); open sides are inset (a shore)
  const ins=Math.max(2,ts*0.09),u=!(v&1),r=!(v&2),d=!(v&4),l=!(v&8),R=ts*0.18;
  const x0=l?ins:0,y0=u?ins:0,x1=ts-(r?ins:0),y1=ts-(d?ins:0),cr=[u&&l?R:0,u&&r?R:0,d&&r?R:0,d&&l?R:0];
  c.fillStyle=lit?'rgba(47,111,208,0.72)':'rgba(30,66,130,0.55)';rrc(c,x0,y0,x1-x0,y1-y0,cr);c.fill();
  c.strokeStyle=lit?'rgba(143,196,255,0.7)':'rgba(110,150,200,0.35)';c.lineWidth=Math.max(1.2,ts*0.05);c.lineCap='round';
  const e=c.lineWidth/2;
  c.beginPath();if(u){c.moveTo(x0+cr[0],y0+e);c.lineTo(x1-cr[1],y0+e);}if(d){c.moveTo(x0+cr[3],y1-e);c.lineTo(x1-cr[2],y1-e);}if(l){c.moveTo(x0+e,y0+cr[0]);c.lineTo(x0+e,y1-cr[3]);}if(r){c.moveTo(x1-e,y0+cr[1]);c.lineTo(x1-e,y1-cr[2]);}
  if(cr[0]){c.moveTo(x0+e,y0+cr[0]);c.arcTo(x0+e,y0+e,x0+cr[0],y0+e,Math.max(0.5,cr[0]-e));}   // the corners join the straight rims
  if(cr[1]){c.moveTo(x1-cr[1],y0+e);c.arcTo(x1-e,y0+e,x1-e,y0+cr[1],Math.max(0.5,cr[1]-e));}
  if(cr[2]){c.moveTo(x1-e,y1-cr[2]);c.arcTo(x1-e,y1-e,x1-cr[2],y1-e,Math.max(0.5,cr[2]-e));}
  if(cr[3]){c.moveTo(x0+cr[3],y1-e);c.arcTo(x0+e,y1-e,x0+e,y1-cr[3],Math.max(0.5,cr[3]-e));}
  c.stroke();
  c.strokeStyle=lit?'rgba(205,234,255,0.8)':'rgba(130,170,220,0.35)';c.lineWidth=Math.max(1.3,ts*0.055);c.beginPath();
  const o=(v&1)?ts*0.05:0,wl=ts*0.2,wr=ts*0.8;for(const wy of [ts*0.4,ts*0.68]){c.moveTo(wl+o,wy);c.quadraticCurveTo(wl+ts*0.15+o,wy-ts*0.1,wl+ts*0.3+o,wy);c.quadraticCurveTo(wl+ts*0.45+o,wy+ts*0.1,Math.min(wr,wl+ts*0.6+o),wy);}c.stroke();
 }else if(kind==='fogedge'){ // soft edge of the lit area: v = side (0 up, 1 right, 2 down, 3 left), drawn over a lit tile that borders a remembered one
  const g=v===0?c.createLinearGradient(0,0,0,ts*0.5):v===2?c.createLinearGradient(0,ts,0,ts*0.5):v===1?c.createLinearGradient(ts,0,ts*0.5,0):c.createLinearGradient(0,0,ts*0.5,0);
  g.addColorStop(0,'rgba(7,8,15,0.38)');g.addColorStop(1,'rgba(7,8,15,0)');c.fillStyle=g;c.fillRect(0,0,ts,ts);
 }else{ // wall: tops are the darkest plane and merge into one mass; a front face (when the tile below is open) is a touch lighter, with a highlight lip and brick lines
  const front=kind==='wallf',fh=front?ts*0.42:0,top=ts-fh;
  c.fillStyle=L(th.wt);c.fillRect(0,0,ts,ts);
  if(front){
   c.fillStyle=L(th.wf);c.fillRect(0,top,ts,fh);
   c.fillStyle=L(th.wh);c.globalAlpha=0.75;c.fillRect(0,top,ts,Math.max(1.5,ts*0.07));c.globalAlpha=1;
   c.fillStyle='#000';c.globalAlpha=0.2;c.fillRect(0,top+Math.max(1.5,ts*0.07),ts,Math.max(1,ts*0.05));c.globalAlpha=1;
   c.strokeStyle=L(th.we);c.lineWidth=Math.max(1,ts*0.04);c.beginPath();
   const m=top+fh*0.52;c.moveTo(0,m);c.lineTo(ts,m);
   const o=ts*(v%2?0.7:0.3),o2=(o+ts*0.5)%ts;c.moveTo(o,top);c.lineTo(o,m);c.moveTo(o2,m);c.lineTo(o2,ts);c.stroke();
  }
 }
 return tcache[k]=b;
}
// the unexplored dark: one pre-rendered 4x4-tile patch of angular rock facets, tiled as a pattern in world space
let rockPat=null,rockKey='';
function rockPattern(ts){
 const dpr=view.dpr||1,k=ts+'|'+dpr;
 if(rockKey===k)return rockPat;
 const n=4,w=Math.round(ts*n*dpr),cv2=mkCanvas(w,w),c=cv2.getContext('2d');c.scale(w/(ts*n),w/(ts*n));
 c.fillStyle='#0b0c16';c.fillRect(0,0,ts*n,ts*n);
 for(let gy=0;gy<n*2;gy++)for(let gx=0;gx<n*2;gx++){
  const h=hash2(gx+101,gy+57),cx=(gx+0.5)*ts/2,cy=(gy+0.5)*ts/2,r=ts*(0.28+0.2*((h%7)/7)),a=(h>>3)%628/100;
  c.fillStyle=h&1?'#0f1120':'#0d0e19';c.beginPath();
  for(let i=0;i<4;i++){const an=a+i*1.57+((h>>(4+i))&3)*0.25,rr2=r*(0.7+0.4*(((h>>(8+i))&3)/3));c.lineTo(cx+Math.cos(an)*rr2,cy+Math.sin(an)*rr2);}
  c.closePath();c.fill();
 }
 rockKey=k;rockPat=ctx.createPattern(cv2,'repeat');
 try{rockPat.setTransform(new DOMMatrix().scale(1/dpr));}catch(e){}
 return rockPat;
}
// tiny deterministic hash (no Math.random: map looks must not consume the game's random stream)
function hash2(x,y){let h=(x*374761393+y*668265263)|0;h=(h^(h>>>13))*1274126177|0;return ((h^(h>>>16))>>>0);}
function floorVar(x,y){const h=hash2(x,y)%100;return h<38?0:h<66?1:h<96?2:3;}

// per-frame fast path for the tile loop: a numeric lookup table (no string keys per tile) resolved once per theme / size
const TK={floor:0,floors:1,wallf:2,wallt:3,water:4,fogedge:5};
let lutKey='',lut=null;
function tileLut(th,ts){
 const k=th.n+'|'+ts+'|'+(view.dpr||1);
 if(k!==lutKey){lutKey=k;lut=[];}
 return lut;
}
function tileFast(L,th,kind,v,lit,ts){
 const i=((TK[kind]*16+v)*2)+(lit?1:0);
 return L[i]||(L[i]=tileBmp(th,kind,v,lit,ts));
}
