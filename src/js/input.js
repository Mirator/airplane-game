// input.js - canvas tap, keyboard and top-bar button listeners.

cv.addEventListener('click',function(ev){
 if(!G)return;
 const r=cv.getBoundingClientRect();
 if(bigMap){bigMap=false;render();return;}
 const mm=view.mm,cx=ev.clientX-r.left,cy=ev.clientY-r.top;
 if(mm&&!G.over&&cx>=mm.x&&cx<=mm.x+mm.w&&cy>=mm.y&&cy<=mm.y+mm.h){bigMap=true;render();return;}
 const tx=Math.floor((ev.clientX-r.left-view.ox)/view.ts),ty=Math.floor((ev.clientY-r.top-view.oy)/view.ts);
 onTap(tx,ty);
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
