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
document.addEventListener('click',function(ev){if(ev.detail>0&&ev.target&&ev.target.closest){const b=ev.target.closest('button');if(b&&b.blur)b.blur();}},true);   // at once (capture phase): the press itself is already decided by the event target, and a Space / Enter a moment later must not press the button again
// ---- dialogs by keyboard. The top dialog (a modal, else the title-side screen) owns every key: Tab / arrows move a gold focus ring between its enabled buttons
// (focus never leaves the dialog), Enter presses the focused one, Esc presses the one marked data-esc (Back, Leave, Later, Stay here, Cancel...; the end card has none).
function dlgRoot(){return $('modal').style.display!=='none'?$('modalBox'):$('title').style.display!=='none'?$('titleBox'):null;}
function dlgButtons(root){return [...root.querySelectorAll('button')].filter(b=>!b.disabled&&b.getClientRects().length>0);}
function focusFirst(root){
 if(!document.body.classList.contains('kb'))return;   // the ring only appears for keyboard users (the first real key press sets body.kb)
 const bs=dlgButtons(root),d=bs.find(b=>b.dataset.def)||bs[0];
 if(d){try{d.focus({preventScroll:true});}catch(e){d.focus();}}
}
function dlgKey(ev,root){
 const k=ev.key,bs=dlgButtons(root),ae=document.activeElement,i=bs.indexOf(ae);
 if(k==='Escape'){
  if(root===$('modalBox')&&root.dataset.kind==='end')return;
  const b=[...root.querySelectorAll('button[data-esc]')].reverse().find(x=>!x.disabled);
  if(b){ev.preventDefault();b.click();}return;}
 if(k==='Tab'||k==='ArrowDown'||k==='ArrowUp'||k==='ArrowLeft'||k==='ArrowRight'){
  ev.preventDefault();if(!bs.length)return;
  const back=k==='ArrowUp'||k==='ArrowLeft'||(k==='Tab'&&ev.shiftKey);
  const n=i<0?(back?bs.length-1:0):(i+(back?-1:1)+bs.length)%bs.length;
  bs[n].focus();return;}
 if(k==='Enter'||k===' '){
  if(ev.repeat){ev.preventDefault();return;}   // a held key never presses a second dialog's button
  if(ae&&ae.tagName==='BUTTON'&&root.contains(ae)){
   // the key press itself clicks the focused button (a trusted click: the open-grace of an event dialog applies to it); a disabled / hidden one is ignored
   return;}
  const b=bs.find(x=>x.dataset.def)||bs[0];
  if(b&&!(root===$('modalBox')&&performance.now()-modalAt<modalGrace)){ev.preventDefault();b.click();}
  else ev.preventDefault();
 }
}
// the key form of a tap on an adjacent tile: a red tile / cracking tile needs a second, separate key press (held-key repeats never confirm)
function keyStep(dx,dy,ev){
 const p=G.p,nx=p.x+dx,ny=p.y+dy,now=performance.now();
 if(ev.repeat&&now-lastKeyAct<90)return;
 lastKeyAct=now;
 if(!inb(nx,ny))return;
 if(p.cls==='mage'){   // the Mage's key form of a tap on a foe in range: the first visible foe in line that way is shot instead of walked up to
  for(let k=1;k<=BAL.shot.range;k++){const x=p.x+dx*k,y=p.y+dy*k;if(!inb(x,y)||!walkable(x,y))break;
   const e=enemyAt(x,y);if(e){if(canShoot(e)){if(insp)clearInspect();mageShot(e);return;}break;}}
 }
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
 const p=G.p,A=ABIL[armed];if(!A||A.tg==='tile')return;
 if(A.tg==='self'){msg('Enter or '+(kit().indexOf(armed)+1)+' to use, Esc to cancel.');render();return;}
 const tg=view.tg||targetTiles(armed);let best=null,bd=1e9;
 for(const t of tg){const ox=t[0]-p.x,oy=t[1]-p.y;
  if((dx&&oy===0&&Math.sign(ox)===dx)||(dy&&ox===0&&Math.sign(oy)===dy)){const d=Math.abs(ox)+Math.abs(oy);if(d<bd){bd=d;best=t;}}}
 if(!best){msg('No target that way.');render();return;}
 useAbility(armed,best[0],best[1]);render();
}
document.addEventListener('keydown',function(ev){
 if(ev.ctrlKey||ev.metaKey||ev.altKey)return;
 const tg=ev.target&&ev.target.tagName;
 {const root=dlgRoot();if(root){dlgKey(ev,root);return;}}
 if((ev.key==='Enter'||ev.key===' ')&&tg==='BUTTON')return;   // a Tab-focused button does its own press
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
 else if(k==='>'||k==='Enter'){ev.preventDefault();if(ev.repeat)return;walkTok++;if(armed){if(ABIL[armed].tg==='self')useAbility(armed);else{msg(ABIL[armed].n+': pick a lit tile, or Esc to cancel.');render();}return;}if(G.map[ix(G.p.x,G.p.y)]===2)descend();return;}
 if(d){
  ev.preventDefault();walkTok++;
  if(armed){if(!ev.repeat)keyAim(d[0],d[1]);return;}
  keyStep(d[0],d[1],ev);}
});
$('menuBtn').addEventListener('click',showMenu);
// a tap on any button also dismisses the inspect card (the button still does its job)
document.addEventListener('click',function(ev){if(insp&&ev.target!==cv&&!(ev.target.closest&&ev.target.closest('#sightList')))clearInspect();});

// while a dialog or title screen is up the game underneath is inert (no Tab stop, no focus behind it)
function syncInert(){$('app').inert=$('modal').style.display!=='none'||$('title').style.display!=='none';}
for(const id of ['modal','title'])new MutationObserver(syncInert).observe($(id),{attributes:true,attributeFilter:['style']});
syncInert();
// a title-side screen that is rebuilt (a new screen, or the same one after a purchase) hands the focus back: the same row when it is the same screen, else the first button
{let lastIdx=0,lastH='';
 document.addEventListener('focusin',function(ev){const t=$('titleBox');if(t.contains(ev.target))lastIdx=dlgButtons(t).indexOf(ev.target);});
 new MutationObserver(function(){
  const t=$('titleBox');if($('title').style.display==='none'||$('modal').style.display!=='none'||!document.body.classList.contains('kb')||t.contains(document.activeElement))return;
  const bs=dlgButtons(t);if(!bs.length)return;
  const h=(t.querySelector('h1')||{}).textContent||'',n=h===lastH?Math.max(0,Math.min(lastIdx,bs.length-1)):0;lastH=h;
  try{bs[n].focus({preventScroll:true});}catch(e){bs[n].focus();}
 }).observe($('titleBox'),{childList:true});
}
