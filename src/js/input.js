// input.js - canvas tap, keyboard and top-bar button listeners.

cv.addEventListener('click',function(ev){
 if(!G)return;
 if(lpDone){lpDone=false;return;}   // the release of a press-and-hold (inspect): not a tap
 bannerUntil=0;                      // any tap clears the floor banner
 if(insp){clearInspect();if(!armed)return;}   // a tap dismisses the inspect card (while aiming it also goes on to target)
 const r=cv.getBoundingClientRect();
 if(bigMap){bigMap=false;render();return;}
 const mm=view.mm,cx=ev.clientX-r.left,cy=ev.clientY-r.top;
 if(mm&&!G.over&&cx>=mm.x&&cx<=mm.x+mm.w&&cy>=mm.y&&cy<=mm.y+mm.h){bigMap=true;render();return;}
 const tx=Math.floor((ev.clientX-r.left-view.ox)/view.ts),ty=Math.floor((ev.clientY-r.top-view.oy)/view.ts);
 onTap(tx,ty);
});
// ---- keyboard. Arrows / WASD move or attack (same as tapping the adjacent tile, danger guard included), 1-4 abilities, Space or . wait, E explore,
// I items, Q potion, > or Enter stairs (only while standing on them), Esc cancels aiming / closes the top dialog / opens the menu.
let lastKeyAct=0;
function kbUsed(){if(!document.body.classList.contains('kb')){let touch=false;try{touch=matchMedia('(hover:none) and (pointer:coarse)').matches;}catch(e){}if(!touch)document.body.classList.add('kb');}}
// first real key press shows the key hints (never on a touch-first device)
document.addEventListener('keydown',function(ev){if(ev.isTrusted&&!/^(Shift|Control|Alt|Meta|CapsLock)$/.test(ev.key))kbUsed();},true);
// a mouse click leaves the button focused; Space / Enter would then press it a second time
document.addEventListener('click',function(ev){if(ev.detail>0&&ev.target&&ev.target.closest){const b=ev.target.closest('button');if(b&&b.blur)setTimeout(function(){b.blur();},0);}},true);
function topBack(box){return [...box.querySelectorAll('button')].reverse().find(x=>!x.disabled&&/^(back|resume|close|leave|got it|cancel|keep|later)/i.test(x.textContent.trim()));}
function keyModal(ev){
 const m=$('modal'),box=$('modalBox'),k=box.dataset.kind;
 if(ev.key==='Escape'){if(k==='end')return;const b=topBack(box);if(b){ev.preventDefault();b.click();}return;}
 if(ev.key==='Enter'&&!ev.repeat){
  const bs=[...box.querySelectorAll('button')].filter(x=>!x.disabled);
  const one=bs.length===1?bs[0]:null,menu=k==='menu'?bs[0]:null;
  const b=one||menu;if(b){ev.preventDefault();b.click();}
 }
}
function keyTitle(ev){
 if(ev.key!=='Escape')return;
 const t=$('titleBox'),b=[...t.querySelectorAll('button')].reverse().find(x=>!x.disabled&&/^back/i.test(x.textContent.trim()));
 if(b){ev.preventDefault();b.click();}
}
// the key form of a tap on an adjacent tile: a red tile / cracking tile needs a second, separate key press (held-key repeats never confirm)
function keyStep(dx,dy,ev){
 const p=G.p,nx=p.x+dx,ny=p.y+dy,now=performance.now();
 if(ev.repeat&&now-lastKeyAct<90)return;
 lastKeyAct=now;
 if(!inb(nx,ny))return;
 const e=enemyAt(nx,ny);
 if(!(e&&G.vis[ix(nx,ny)])){
  const k=ix(nx,ny),pr=perilAt(k);
  if(pr){
   if(ev.repeat)return;
   if(!(guard&&guard.k===k&&guard.f===G.floor&&now<guard.until)){
    guard={k:k,x:nx,y:ny,f:G.floor,until:now+BAL.ui.guardMs};
    msg('Danger: press again to go.');render();return;}
  }
  guard=null;
 }
 if(insp)clearInspect();
 tryMove(dx,dy);
}
// aiming: an arrow key fires at the nearest target in a straight line that way
function keyAim(dx,dy){
 const p=G.p,A=ABIL[armed];if(!A||A.tg==='tile'||A.tg==='self')return;
 const tg=view.tg||targetTiles(armed);let best=null,bd=1e9;
 for(const t of tg){const ox=t[0]-p.x,oy=t[1]-p.y;
  if((dx&&oy===0&&Math.sign(ox)===dx)||(dy&&ox===0&&Math.sign(oy)===dy)){const d=Math.abs(ox)+Math.abs(oy);if(d<bd){bd=d;best=t;}}}
 if(!best){msg('No target that way.');render();return;}
 useAbility(armed,best[0],best[1]);render();
}
document.addEventListener('keydown',function(ev){
 if(ev.ctrlKey||ev.metaKey||ev.altKey)return;
 const tg=ev.target&&ev.target.tagName;
 if((ev.key==='Enter'||ev.key===' ')&&tg==='BUTTON')return;   // a Tab-focused button does its own press
 if($('modal').style.display!=='none'){keyModal(ev);return;}
 if($('title').style.display!=='none'){keyTitle(ev);return;}
 if(!G||G.over)return;
 const k=ev.key.length===1?ev.key.toLowerCase():ev.key;let d=null;
 if(k==='Escape'){
  ev.preventDefault();
  if(bigMap){bigMap=false;render();}else if(insp){clearInspect();render();}else if(armed)cancelTarget();else if(trayOpen())setTray(false);else showMenu();
  return;}
 if(k==='ArrowUp'||k==='w')d=[0,-1];else if(k==='ArrowDown'||k==='s')d=[0,1];
 else if(k==='ArrowLeft'||k==='a')d=[-1,0];else if(k==='ArrowRight'||k==='d')d=[1,0];
 else if(k===' '||k==='.'){ev.preventDefault();if(ev.repeat)return;walkTok++;if(armed){cancelTarget();return;}wait();return;}
 else if(k==='e'){if(!ev.repeat)explore();return;}
 else if(k>='1'&&k<='4'&&k.length===1){if(!ev.repeat)toggleAbility(kit()[+k-1]);return;}
 else if(k==='q'){if(!ev.repeat){walkTok++;drink();}return;}
 else if(k==='p'){if(!ev.repeat)gearOrPick();return;}
 else if(k==='i'){if(!ev.repeat)$('b_items').click();return;}
 else if(k==='>'||k==='Enter'){ev.preventDefault();if(ev.repeat)return;walkTok++;if(armed&&ABIL[armed].tg==='self'){useAbility(armed);return;}if(G.map[ix(G.p.x,G.p.y)]===2)descend();return;}
 if(d){
  ev.preventDefault();walkTok++;
  if(armed){if(!ev.repeat)keyAim(d[0],d[1]);return;}
  keyStep(d[0],d[1],ev);}
});
$('menuBtn').addEventListener('click',showMenu);
// a tap on any button also dismisses the inspect card (the button still does its job)
document.addEventListener('click',function(ev){if(insp&&ev.target!==cv)clearInspect();});
