// minimap.js - minimap / big-map drawing (rounded dark panel, theme colours, round markers).

function drawMini(){
 const th=themeOf(G.floor,G.variant),big=bigMap,cs=big?Math.max(4,Math.floor(Math.min(view.cw-8,view.ch-8)/W)):3,S=cs*W;
 const mx=big?Math.round((view.cw-S)/2):Math.round(view.cw-S-6),my=big?Math.round((view.ch-S)/2):6;
 view.mm={x:mx,y:my,w:S,h:S};
 ctx.globalAlpha=big?0.95:0.84;ctx.fillStyle='#07080f';rrect(mx-3,my-3,S+6,S+6,8);ctx.fill();ctx.globalAlpha=1;
 ctx.strokeStyle='#3c4272';ctx.lineWidth=1.5;rrect(mx-3,my-3,S+6,S+6,8);ctx.stroke();
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=ix(x,y);if(!G.seen[i])continue;const t=G.map[i];
  if(t===2)continue;
  ctx.fillStyle=t===0?th.mw:t===3?'#a0642e':t===5?'#ffc93c':(G.vis[i]?th.mf:th.mfd);
  ctx.fillRect(mx+x*cs,my+y*cs,cs,cs);
 }
 const dot=function(x,y,col,r){r=r||Math.max(cs+1,4);ctx.fillStyle=INK;ctx.beginPath();ctx.arc(mx+x*cs+cs/2,my+y*cs+cs/2,r/2+1,0,7);ctx.fill();ctx.fillStyle=col;ctx.beginPath();ctx.arc(mx+x*cs+cs/2,my+y*cs+cs/2,r/2,0,7);ctx.fill();};
 for(let k=0;k<W*H;k++)if(G.map[k]===2&&G.seen[k])dot(k%W,Math.floor(k/W),PAL.gold,Math.max(cs+1,5));
 for(const t of G.traps)if(t.rev&&!t.done&&G.seen[ix(t.x,t.y)])dot(t.x,t.y,'#ff5acd',Math.max(cs,3));
 if(G.shrine&&G.seen[ix(G.shrine.x,G.shrine.y)])dot(G.shrine.x,G.shrine.y,G.shrine.used?'#7a6a90':PAL.accent);
 if(G.merchant&&G.seen[ix(G.merchant.x,G.merchant.y)])dot(G.merchant.x,G.merchant.y,PAL.accent);
 for(const e of G.enemies)if(G.vis[ix(e.x,e.y)]){if(e.elite)dot(e.x,e.y,'#ff9a1f',Math.max(cs+2,6));else{ctx.fillStyle='#ff4040';ctx.fillRect(mx+e.x*cs,my+e.y*cs,cs,cs);}}
 const q=G.p;dot(q.x,q.y,'#ffffff',Math.max(cs+2,6));
}
