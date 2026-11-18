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
// Escape: closes the open dialog through its own Back / Resume / Leave button (never a forced choice: perk pick, end of run), else cancels aiming
document.addEventListener('keydown',function(ev){
 if(ev.key!=='Escape')return;
 const m=$('modal');
 if(m.style.display!=='none'){
  const box=$('modalBox'),k=box.dataset.kind;if(k==='perk'||k==='end')return;
  const b=[...box.querySelectorAll('button')].reverse().find(x=>!x.disabled&&/^(back|resume|close|leave|got it)/i.test(x.textContent.trim()));
  if(b){ev.preventDefault();b.click();}
  return;
 }
 if(!G||G.over||$('title').style.display!=='none')return;
 if(bigMap){bigMap=false;render();}else if(insp){clearInspect();render();}else if(armed)cancelTarget();
});
document.addEventListener('keydown',function(ev){
 if(!G||G.over||modalOpen()||$('title').style.display!=='none')return;
 const k=ev.key.toLowerCase();let d=null;
 if(k==='arrowup'||k==='w')d=[0,-1];else if(k==='arrowdown'||k==='s')d=[0,1];
 else if(k==='arrowleft'||k==='a')d=[-1,0];else if(k==='arrowright'||k==='d')d=[1,0];
 else if(k===' '||k==='.'){walkTok++;if(G.map[ix(G.p.x,G.p.y)]===2)descend();else wait();ev.preventDefault();return;}
 else if(k==='e'){explore();return;}
 else if(k>='1'&&k<='4'){toggleAbility(kit()[+k-1]);return;}
 else if(k==='q'){walkTok++;drink();return;}
 if(d){ev.preventDefault();walkTok++;tryMove(d[0],d[1]);}
});
$('menuBtn').addEventListener('click',showMenu);
// a tap on any button also dismisses the inspect card (the button still does its job)
document.addEventListener('click',function(ev){if(insp&&ev.target!==cv)clearInspect();});
