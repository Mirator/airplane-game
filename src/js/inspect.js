// inspect.js - long-press / right-click inspect card (enemy, yourself, trap, shrine, item) drawn on the canvas; press-and-hold detection.

const TRAP_TIP={spike:'Hurts whoever steps on it.',dart:'Poisons whoever steps on it.',alarm:'Wakes every foe when stepped on.'};
const DIR_N={'1,0':'east','-1,0':'west','0,1':'south','0,-1':'north'};
const CARD_CH=55;   // one card line is at most this many characters (same budget as the other one-line texts)
function cutTo(s,n){return s.length>n?s.slice(0,n-1)+'…':s;}
function wrapTo(s,n){
 const out=[];let cur='';
 for(const w of String(s).split(' ')){
  if(cur&&(cur+' '+w).length>n){out.push(cur);cur=w;}else cur=cur?cur+' '+w:w;
 }
 if(cur)out.push(cur);
 return out;
}
const turns=n=>n+(n===1?' turn':' turns');
// what a foe is doing right now, as short phrases
function enemyStates(e){
 const d=EN[e.t],s=[];
 if(e.wind)s.push('Winding up: leave the red tiles');
 if(e.stun>0)s.push('Stunned '+turns(e.stun));
 if(e.frz>0)s.push('Frozen '+turns(e.frz));
 if(e.blind>0)s.push('Blinded '+turns(e.blind));
 if(e.pois)s.push((e.pois.burn?'Burning ':'Poisoned ')+turns(e.pois.t));
 if(e.rest)s.push('Resting');
 if(!e.awake)s.push('Asleep');
 if(d.shield&&e.face)s.push((e.stun>0||e.frz>0)?'Shield down':'Shield faces '+(DIR_N[e.face[0]+','+e.face[1]]||'you'));
 if(e.hunter)s.push('Stalker: hunting you');
 if(e.elite)s.push('Carries the vault key');
 return s;
}
// the card text for a tile: an array of lines (first = title) or null when there is nothing to say
function inspectLines(tx,ty){
 if(!G||!inb(tx,ty)||!G.seen[ix(tx,ty)])return null;
 const p=G.p,k=ix(tx,ty),L=[];
 if(tx===p.x&&ty===p.y){
  L.push('You  HP '+p.hp+'/'+p.mhp);
  const b=[];
  if(G.ppois)b.push('Poisoned '+turns(G.ppois.t));
  if(G.vanish>0)b.push('Unseen '+turns(G.vanish));
  if(G.brace)b.push('Brace: '+G.brace.hits+(G.brace.hits===1?' hit':' hits')+' left');
  if(G.bl)b.push('Bloodlust ready');
  if(inSmoke(p.x,p.y))b.push('In smoke');
  if(waterSet().has(k))b.push('In water');
  L.push(b.length?b.join(' · '):'No effects.');
  return chunk(L);
 }
 const e=enemyAt(tx,ty);
 if(e&&G.vis[k]){
  const d=EN[e.t];
  L.push(cutTo((e.elite&&e.name?e.name:d.n)+'  HP '+e.hp+'/'+e.mhp,CARD_CH));
  L.push(d.tr);
  const st=enemyStates(e);if(st.length)L.push(st.join(' · '));
  return chunk(L);
 }
 if(merchantAt(tx,ty))return chunk(['Merchant','Tap him to trade.']);
 const t=G.traps.find(a=>a.x===tx&&a.y===ty&&a.rev&&!a.done);
 if(t)return chunk([TRAPS[t.k].n,TRAP_TIP[t.k]]);
 const sh=G.shrine;
 if(sh&&sh.x===tx&&sh.y===ty)return chunk(['Shrine',sh.used?'Used up.':'Step on it for a gamble.']);
 const it=itemAt(tx,ty);
 if(it)return chunk([itemName(it)+'.']);
 const m=G.map[k];
 if(m===2)return chunk(['Stairs down']);
 if(m===3)return chunk(['Door','Tap to open.']);
 if(m===5)return chunk(['Vault door','The marked elite has the key.']);
 return null;
}
// sprite id shown at the left of the card's first line (null = none)
function inspectIcon(tx,ty){
 if(!G||!inb(tx,ty)||!G.seen[ix(tx,ty)])return null;
 const p=G.p,k=ix(tx,ty);
 if(tx===p.x&&ty===p.y)return clsOf(p).e;
 const e=enemyAt(tx,ty);if(e&&G.vis[k])return EN[e.t].e;
 if(merchantAt(tx,ty))return 'merchant';
 const t=G.traps.find(a=>a.x===tx&&a.y===ty&&a.rev&&!a.done);if(t)return 'trap_'+t.k;
 if(G.shrine&&G.shrine.x===tx&&G.shrine.y===ty)return 'shrine';
 const it=itemAt(tx,ty);if(it)return itemSprite(it);
 const m=G.map[k];return m===2?'stairs':m===3?'door':m===5?'door_locked':null;
}
function chunk(lines){const o=[];for(const l of lines)for(const w of wrapTo(l,CARD_CH))o.push(w);return o;}
function showInspect(tx,ty){
 if(!G||G.over||modalOpen())return false;
 const lines=inspectLines(tx,ty);
 if(!lines)return false;
 insp={x:tx,y:ty,icon:inspectIcon(tx,ty),elite:!!(enemyAt(tx,ty)&&enemyAt(tx,ty).elite&&G.vis[ix(tx,ty)]),lines:lines,turn:G.turn,f:G.floor};
 render();return true;
}
function clearInspect(){if(insp){insp=null;if(G)render();}}
function drawInspect(ox,oy,ts){
 if(!insp)return;
 const px=ox+insp.x*ts,py=oy+insp.y*ts,lh=17,pad=10,F='system-ui,-apple-system,sans-serif';
 ctx.strokeStyle='#ffe9a8';ctx.lineWidth=2.5;rrect(px+1.5,py+1.5,ts-3,ts-3,7);ctx.stroke();ctx.lineWidth=1;
 let fs=13;const fit=()=>{ctx.font='500 '+fs+'px '+F;let w=0;for(const l of insp.lines)w=Math.max(w,ctx.measureText(l).width+(l===insp.lines[0]&&insp.icon?lh+6:0));return w;};
 let w=fit();while(fs>9&&w+pad*2+4>view.cw-8){fs--;w=fit();}
 w+=pad*2+4;const h=insp.lines.length*lh+pad;
 const x=Math.max(4,Math.min(view.cw-w-4,px+ts/2-w/2));
 let y=py-h-9,below=false;if(y<4){y=py+ts+9;below=true;}y=Math.max(4,Math.min(view.ch-h-4,y));
 // pointer toward the tile
 const ax=Math.max(x+14,Math.min(x+w-14,px+ts/2)),pdir=below?-1:1,ay=below?y:y+h;
 ctx.fillStyle='rgba(23,26,43,0.96)';ctx.beginPath();ctx.moveTo(ax-6,ay);ctx.lineTo(ax+6,ay);ctx.lineTo(ax,ay+6*(below?-1:1));ctx.closePath();ctx.fill();
 rrect(x,y,w,h,10);ctx.fill();ctx.strokeStyle='#3c4272';ctx.lineWidth=1.5;ctx.stroke();ctx.lineWidth=1;
 ctx.fillStyle='#ffc93c';rrect(x,y+4,3,h-8,1.5);ctx.fill();
 ctx.textAlign='left';ctx.textBaseline='middle';
 insp.lines.forEach(function(l,i){ctx.font=(i===0?'700 ':'500 ')+fs+'px '+F;ctx.fillStyle=i===0?'#ffe9a8':'#e8e6f0';ctx.fillText(l,x+pad+4+(i===0&&insp.icon?lh+6:0),y+pad/2+lh*(i+0.5));if(i===0&&insp.icon)drawSpr(insp.icon,x+pad+2,y+pad/2-1,lh+4);if(i===0&&insp.elite)drawSpr('crown',x+w-pad-12,y+pad/2+2,12);});
}
// tile under a client point (null over the minimap / big map / outside the canvas)
function tileAt(clientX,clientY){
 const r=cv.getBoundingClientRect(),cx=clientX-r.left,cy=clientY-r.top,mm=view.mm;
 if(bigMap)return null;
 if(mm&&!G.over&&cx>=mm.x&&cx<=mm.x+mm.w&&cy>=mm.y&&cy<=mm.y+mm.h)return null;
 return [Math.floor((cx-view.ox)/view.ts),Math.floor((cy-view.oy)/view.ts)];
}
// press and hold (~BAL.ui.longPressMs, cancelled by moving more than BAL.ui.longPressMove px or a second finger) inspects; the click that
// follows the release is swallowed so a long-press never also moves or attacks. A normal tap is untouched: no timer delays it.
function lpCancel(){if(lp){clearTimeout(lp.tm);lp=null;}}
cv.addEventListener('pointerdown',function(ev){
 lpCancel();lpDone=false;
 if(!G||G.over||modalOpen()||(ev.pointerType==='mouse'&&ev.button!==0)||!ev.isPrimary)return;
 const x=ev.clientX,y=ev.clientY;
 lp={id:ev.pointerId,x:x,y:y,tm:setTimeout(function(){
  lp=null;
  if(!G||G.over||modalOpen())return;
  const t=tileAt(x,y);
  lpDone=true;lpAt=performance.now();   // swallow the click even when there is nothing to show: a press-and-hold is not a tap
  if(t)showInspect(t[0],t[1]);
 },BAL.ui.longPressMs)};
});
cv.addEventListener('pointermove',function(ev){
 if(lp&&ev.pointerId===lp.id&&Math.hypot(ev.clientX-lp.x,ev.clientY-lp.y)>BAL.ui.longPressMove)lpCancel();
});
for(const n of ['pointerup','pointercancel','pointerleave'])cv.addEventListener(n,function(){lpCancel();});
// right-click (two-finger tap on a touchpad) inspects; also keeps the browser's own menu from opening after a long touch
cv.addEventListener('contextmenu',function(ev){
 ev.preventDefault();
 if(!G||G.over||modalOpen()||performance.now()-lpAt<1500)return;
 const t=tileAt(ev.clientX,ev.clientY);if(t)showInspect(t[0],t[1]);
});
