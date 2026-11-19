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
function dlgButtons(root){return [...root.querySelectorAll('button,summary')].filter(b=>!b.disabled&&b.getClientRects().length>0);}   // a folded help section (summary) is a stop too: Enter / Space open it
function focusFirst(root){
 if(!document.body.classList.contains('kb'))return;   // the ring only appears for keyboard users (the first real key press sets body.kb)
 const bs=dlgButtons(root),d=bs.find(b=>b.dataset.def)||bs[0];
 if(d){try{d.focus({preventScroll:true});}catch(e){d.focus();}}
}
// the button nearest in the pressed direction (rects overlap across the other axis), -1 when none: the caller falls back to the list order
function geoNext(bs,i,k){
 const c=bs[i].getBoundingClientRect(),v=k==='ArrowDown'||k==='ArrowUp';let best=-1,bd=1e9;
 for(let j=0;j<bs.length;j++){if(j===i)continue;const r=bs[j].getBoundingClientRect();
  const ov=v?Math.min(c.right,r.right)-Math.max(c.left,r.left):Math.min(c.bottom,r.bottom)-Math.max(c.top,r.top);if(ov<=4)continue;
  const d=k==='ArrowDown'?r.top-c.bottom:k==='ArrowUp'?c.top-r.bottom:k==='ArrowRight'?r.left-c.right:c.left-r.right;
  if(d>=-2&&d<bd){bd=d;best=j;}}
 return best;
}
function dlgKey(ev,root){
 const k=ev.key,bs=dlgButtons(root),ae=document.activeElement,i=bs.indexOf(ae);
 if(k==='Escape'){
  if(root===$('modalBox')&&root.dataset.kind==='end')return;
  const b=[...root.querySelectorAll('button[data-esc]')].reverse().find(x=>!x.disabled);
  if(b){ev.preventDefault();b.click();}return;}
 if((k==='ArrowDown'||k==='ArrowUp')&&bs.length<=1&&root.scrollHeight>root.clientHeight+2){ev.preventDefault();root.scrollBy(0,k==='ArrowDown'?60:-60);return;}   // one button (Back) and a long text: the arrows scroll it
 if(k==='Tab'||k==='ArrowDown'||k==='ArrowUp'||k==='ArrowLeft'||k==='ArrowRight'){
  ev.preventDefault();if(!bs.length)return;
  const back=k==='ArrowUp'||k==='ArrowLeft'||(k==='Tab'&&ev.shiftKey);
  let n=i<0?(back?bs.length-1:0):(i+(back?-1:1)+bs.length)%bs.length;
  if(i>=0&&k!=='Tab'){const g=geoNext(bs,i,k);if(g>=0)n=g;}   // two-column screens: Down is the button below, not the one in the other column
  bs[n].focus();return;}
 if(k==='Enter'||k===' '){
  if(ev.repeat){ev.preventDefault();return;}   // a held key never presses a second dialog's button
  if(ae&&(ae.tagName==='BUTTON'||ae.tagName==='SUMMARY')&&root.contains(ae)){
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
// aiming by keyboard: an armed targeted ability (and the Mage shot, armed by F) has a CURSOR on one of its valid lit tiles. It starts on the nearest target (a ground ability: the nearest
// foe, if any), the arrows / WASD move it to the next valid tile that way (no straight-line rule), Tab / Shift+Tab step through the foes, Enter or the ability's own key fires, Esc cancels.
function kcOn(){return !!armed&&!!ABIL[armed]&&ABIL[armed].tg!=='self';}
function kcGet(){
 if(!G||!kcOn()){kcur=null;return null;}
 const tg=targetTiles(armed);
 if(!tg.length){kcur=null;return null;}
 if(kcur&&kcur.a===armed&&kcur.f===G.floor&&tg.some(t=>t[0]===kcur.x&&t[1]===kcur.y))return kcur;
 const p=G.p,foes=tg.filter(t=>enemyAt(t[0],t[1])),own=t=>t[0]===p.x&&t[1]===p.y;
 const pool=(ABIL[armed].tg==='tile'&&foes.length&&armed!=='blink')?foes:tg.filter(t=>!own(t)).length?tg.filter(t=>!own(t)):tg;
 let best=pool[0],bd=1e9;
 for(const t of pool){const d=Math.abs(t[0]-p.x)+Math.abs(t[1]-p.y)+0.01*Math.max(Math.abs(t[0]-p.x),Math.abs(t[1]-p.y));if(d<bd){bd=d;best=t;}}
 kcur={a:armed,f:G.floor,x:best[0],y:best[1]};return kcur;
}
function kcMove(dx,dy){
 const c=kcGet();if(!c){msg(armed&&ABIL[armed]?ABIL[armed].n+': no target.':'No target.');render();return;}
 let best=null,bs=1e9;
 for(const t of targetTiles(armed)){const ox=t[0]-c.x,oy=t[1]-c.y;if(!ox&&!oy)continue;
  const along=dx?ox*dx:oy*dy,perp=dx?Math.abs(oy):Math.abs(ox);if(along<=0)continue;
  const s=along+2*perp;if(s<bs){bs=s;best=t;}}
 if(!best){msg('No target that way.');render();return;}
 kcur={a:armed,f:G.floor,x:best[0],y:best[1]};render();
}
function kcTab(back){
 const c=kcGet();if(!c){msg(armed&&ABIL[armed]?ABIL[armed].n+': no target.':'No target.');render();return;}
 const p=G.p,foes=targetTiles(armed).filter(t=>enemyAt(t[0],t[1])).sort((a,b)=>(Math.abs(a[0]-p.x)+Math.abs(a[1]-p.y))-(Math.abs(b[0]-p.x)+Math.abs(b[1]-p.y))||a[1]-b[1]||a[0]-b[0]);
 if(!foes.length)return;
 let i=foes.findIndex(t=>t[0]===c.x&&t[1]===c.y);i=i<0?(back?foes.length-1:0):(i+(back?-1:1)+foes.length)%foes.length;
 kcur={a:armed,f:G.floor,x:foes[i][0],y:foes[i][1]};render();
}
function kcConfirm(){
 const c=kcGet();if(!c){msg(armed&&ABIL[armed]?ABIL[armed].n+': no target.':'No target.');render();return;}
 useAbility(armed,c.x,c.y);render();
}
function keyAim(dx,dy){
 if(!armed||!ABIL[armed])return;
 if(ABIL[armed].tg==='self'){msg('Enter or '+(kit().indexOf(armed)+1)+' to use, Esc to cancel.');render();return;}
 kcMove(dx,dy);
}
document.addEventListener('keydown',function(ev){
 if(ev.ctrlKey||ev.metaKey||ev.altKey)return;
 {const root=dlgRoot();if(root){dlgKey(ev,root);return;}}
 if(!G||G.over)return;
 const k=ev.key.length===1?ev.key.toLowerCase():ev.key;let d=null;
 // in a run the game keys always win: a panel button that took the focus (Tab, or a click) never turns Space / Enter / arrows into a button press (only the open Items tray keeps its buttons)
 {const ae=document.activeElement;
  if(ae&&ae!==document.body&&ae.tagName==='BUTTON'&&!(ae.closest&&ae.closest('#tray')&&(k==='Enter'||k===' '))&&/^(Enter| |ArrowUp|ArrowDown|ArrowLeft|ArrowRight|w|a|s|d|e|q|i|p|f|\.|>|[1-4])$/.test(k)){try{ae.blur();}catch(e){}}}
 if(k==='Tab'&&kcOn()){ev.preventDefault();if(!ev.repeat)kcTab(ev.shiftKey);return;}
 if(k==='Escape'){
  ev.preventDefault();
  if(bigMap){bigMap=false;render();}else if(insp){clearInspect();render();}else if(armed)cancelTarget();else if(trayOpen())setTray(false);else showMenu();
  return;}
 if(k==='ArrowUp'||k==='w')d=[0,-1];else if(k==='ArrowDown'||k==='s')d=[0,1];
 else if(k==='ArrowLeft'||k==='a')d=[-1,0];else if(k==='ArrowRight'||k==='d')d=[1,0];
 else if(k===' '||k==='.'){ev.preventDefault();if(ev.repeat)return;walkTok++;if(armed){cancelTarget();return;}wait();return;}
 else if(k==='e'){if(!ev.repeat)explore();return;}
 else if(k>='1'&&k<='4'&&k.length===1){if(ev.repeat)return;const ak=kit()[+k-1];if(armed&&armed===ak&&kcOn()){kcConfirm();return;}toggleAbility(ak,true);return;}
 else if(k==='f'){if(ev.repeat)return;if(G.p.cls!=='mage'){msg('Only the Mage shoots.');render();return;}if(armed==='shot'){kcConfirm();return;}toggleAbility('shot',true);return;}
 else if(k==='q'){if(!ev.repeat){walkTok++;drink();}return;}
 else if(k==='p'){if(!ev.repeat)gearOrPick();return;}
 else if(k==='i'){if(!ev.repeat)$('b_items').click();return;}
 else if(k==='>'||k==='Enter'){ev.preventDefault();if(ev.repeat)return;walkTok++;if(armed){if(ABIL[armed].tg==='self')useAbility(armed);else kcConfirm();return;}if(G.map[ix(G.p.x,G.p.y)]===2)descend();return;}
 if(d){
  ev.preventDefault();walkTok++;
  if(armed){if(!ev.repeat||kcOn())keyAim(d[0],d[1]);return;}
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
