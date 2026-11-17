// minimap.js - minimap / big-map drawing.

function drawMini(){
 const th=themeOf(G.floor),big=bigMap,cs=big?Math.max(4,Math.floor(Math.min(view.cw-8,view.ch-8)/W)):3,S=cs*W;
 const mx=big?Math.round((view.cw-S)/2):Math.round(view.cw-S-4),my=big?Math.round((view.ch-S)/2):4;
 view.mm={x:mx,y:my,w:S,h:S};
 ctx.globalAlpha=big?0.95:0.82;ctx.fillStyle='#05060c';ctx.fillRect(mx-2,my-2,S+4,S+4);ctx.globalAlpha=1;
 ctx.strokeStyle='#8a93d0';ctx.lineWidth=1;ctx.strokeRect(mx-1.5,my-1.5,S+3,S+3);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=ix(x,y);if(!G.seen[i])continue;const t=G.map[i];
  if(t===2)continue;
  ctx.fillStyle=t===0?th.mw:t===3?'#a0602a':t===5?'#ff6a3a':(G.vis[i]?th.mf:th.mfd);
  if(t===0&&!G.exp[i]&&!big){}
  ctx.fillRect(mx+x*cs,my+y*cs,cs,cs);
 }
 for(let k=0;k<W*H;k++)if(G.map[k]===2&&G.seen[k]){const x=k%W,y=Math.floor(k/W),r=Math.max(cs,5);
  ctx.fillStyle='#000';ctx.fillRect(mx+x*cs+cs/2-r/2-1,my+y*cs+cs/2-r/2-1,r+2,r+2);ctx.fillStyle='#ffd24a';ctx.fillRect(mx+x*cs+cs/2-r/2,my+y*cs+cs/2-r/2,r,r);}
 const dot=function(x,y,col,r){r=r||Math.max(cs,4);ctx.fillStyle='#000';ctx.fillRect(mx+x*cs+cs/2-r/2-1,my+y*cs+cs/2-r/2-1,r+2,r+2);ctx.fillStyle=col;ctx.fillRect(mx+x*cs+cs/2-r/2,my+y*cs+cs/2-r/2,r,r);};
 for(const t of G.traps)if(t.rev&&!t.done&&G.seen[ix(t.x,t.y)])dot(t.x,t.y,'#ff5acd',Math.max(cs,3));
 if(G.shrine&&G.seen[ix(G.shrine.x,G.shrine.y)])dot(G.shrine.x,G.shrine.y,G.shrine.used?'#7a6a90':'#c58aff');
 if(G.merchant&&G.seen[ix(G.merchant.x,G.merchant.y)])dot(G.merchant.x,G.merchant.y,'#4be04b');
 for(const e of G.enemies)if(G.vis[ix(e.x,e.y)]){if(e.elite)dot(e.x,e.y,'#ff9a1f',Math.max(cs+1,5));else{ctx.fillStyle='#ff4040';ctx.fillRect(mx+e.x*cs,my+e.y*cs,cs,cs);}}
 const q=G.p,r=Math.max(cs,4);ctx.fillStyle='#000';ctx.fillRect(mx+q.x*cs+cs/2-r/2-1,my+q.y*cs+cs/2-r/2-1,r+2,r+2);
 ctx.fillStyle='#4ee6ff';ctx.fillRect(mx+q.x*cs+cs/2-r/2,my+q.y*cs+cs/2-r/2,r,r);
}
