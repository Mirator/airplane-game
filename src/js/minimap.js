// minimap.js - minimap / big-map drawing (rounded dark panel, theme colours, round markers).

function drawMini(){
 const th=themeOf(G.floor,G.variant),big=bigMap,cs=big?Math.max(4,Math.floor(Math.min(view.cw-8,view.ch-8)/W)):Math.max(3,Math.round(baseTs()/12));
 // the small map is cropped to what has been seen (+2 cells, at least 48 px), anchored top-right; the big map is the whole floor
 let bx0=0,by0=0,bx1=W-1,by1=H-1;
 if(!big){
  bx0=W;by0=H;bx1=-1;by1=-1;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(G.seen[ix(x,y)]){if(x<bx0)bx0=x;if(x>bx1)bx1=x;if(y<by0)by0=y;if(y>by1)by1=y;}
  if(bx1<0){bx0=by0=0;bx1=by1=15;}
  bx0=Math.max(0,bx0-2);by0=Math.max(0,by0-2);bx1=Math.min(W-1,bx1+2);by1=Math.min(H-1,by1+2);
  const mc=Math.ceil(48/cs);while(bx1-bx0+1<mc){if(bx0>0)bx0--;if(bx1-bx0+1<mc&&bx1<W-1)bx1++;if(bx0===0&&bx1===W-1)break;}
  while(by1-by0+1<mc){if(by0>0)by0--;if(by1-by0+1<mc&&by1<H-1)by1++;if(by0===0&&by1===H-1)break;}
 }
 const SW=cs*(bx1-bx0+1),SH=cs*(by1-by0+1);
 const mx=big?Math.round((view.cw-SW)/2):Math.round(view.cw-SW-6),my=big?Math.round((view.ch-SH)/2):6;
 view.mm={x:mx,y:my,w:SW,h:SH};
 ctx.globalAlpha=big?0.95:0.84;ctx.fillStyle='#07080f';rrect(mx-3,my-3,SW+6,SH+6,8);ctx.fill();ctx.globalAlpha=1;
 ctx.strokeStyle='#3c4272';ctx.lineWidth=1.5;rrect(mx-3,my-3,SW+6,SH+6,8);ctx.stroke();
 for(let y=by0;y<=by1;y++)for(let x=bx0;x<=bx1;x++){
  const i=ix(x,y);if(!G.seen[i])continue;const t=G.map[i];
  if(t===2)continue;
  ctx.fillStyle=t===0?th.mw:t===3?'#a0642e':t===5?'#ffc93c':(G.vis[i]?th.mf:th.mfd);
  ctx.fillRect(mx+(x-bx0)*cs,my+(y-by0)*cs,cs,cs);
 }
 const dot=function(x,y,col,r){if(x<bx0||x>bx1||y<by0||y>by1)return;r=r||Math.max(cs+1,4);const cx=mx+(x-bx0)*cs+cs/2,cy=my+(y-by0)*cs+cs/2;ctx.fillStyle=INK;ctx.beginPath();ctx.arc(cx,cy,r/2+1,0,7);ctx.fill();ctx.fillStyle=col;ctx.beginPath();ctx.arc(cx,cy,r/2,0,7);ctx.fill();};
 for(let k=0;k<W*H;k++)if(G.map[k]===2&&G.seen[k])dot(k%W,Math.floor(k/W),PAL.gold,Math.max(cs+1,5));
 if(G.shrine&&G.seen[ix(G.shrine.x,G.shrine.y)])dot(G.shrine.x,G.shrine.y,G.shrine.used?'#7a6a90':PAL.accent);
 if(G.merchant&&G.seen[ix(G.merchant.x,G.merchant.y)])dot(G.merchant.x,G.merchant.y,PAL.accent);
 for(const e of G.enemies)if(G.vis[ix(e.x,e.y)]){if(e.elite)dot(e.x,e.y,'#ff9a1f',Math.max(cs+2,6));else if(e.x>=bx0&&e.x<=bx1&&e.y>=by0&&e.y<=by1){ctx.fillStyle='#ff4040';ctx.fillRect(mx+(e.x-bx0)*cs,my+(e.y-by0)*cs,cs,cs);}}
 const q=G.p;dot(q.x,q.y,'#ffffff',Math.max(cs+2,6));
}
