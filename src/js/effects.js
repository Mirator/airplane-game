// effects.js - cosmetic effects state: screen shake, floating combat text, hurt flash.

function shake(a){if(rmo())return;shakeUntil=performance.now()+220;shakeAmt=a;}
function playerHurtFx(d){
 const p=G.p,now=performance.now();flashes.p=now;flashUntil=now+250;sfx('hurt');
 const big=d>=Math.max(6,p.mhp*0.2);buzz(big?70:30);if(big)shake(6);
}

function floatFx(x,y,text,color,big){fx.push({x,y,text,color,big:!!big,t:performance.now()});}
// callout: a brief on-map word or two (<=3 words, ~1 s) for the few events worth seeing without reading the log. Drawn on the canvas (so it can
// never take a tap), at most BAL.ui.calloutMax at once (a third one is dropped; the log keeps the history), no motion with reduced motion.
function callout(x,y,text,color){
 const now=performance.now(),d=BAL.ui.calloutMs;let n=0;
 for(const f of fx)if(f.c&&now-f.t<d)n++;
 if(n>=BAL.ui.calloutMax)return;
 fx.push({x,y,text,color,big:true,t:now,c:1,d:d});
}
// HP below 30%: one callout per crossing (it re-arms once HP is back above 40%). The first look at a run only records the state.
function lowHpWatch(){
 const p=G.p,U=BAL.ui;
 if(hpLowG!==G){hpLowG=G;hpLow=p.hp<p.mhp*U.lowHp;return;}
 if(p.hp>=p.mhp*U.lowHpReset)hpLow=false;
 else if(!hpLow&&p.hp>0&&p.hp<p.mhp*U.lowHp){hpLow=true;callout(p.x,p.y,'LOW HP','#ff5a5a');}
}
// an elite coming into view for the first time on a floor
function eliteWatch(){
 if(!G.enemies)return;
 if(eliteG!==G){eliteG=G;eliteSeen=new Set();}
 for(const e of G.enemies)if(e.elite&&G.vis[ix(e.x,e.y)]){const k=G.floor+':'+e.id;if(!eliteSeen.has(k)){eliteSeen.add(k);callout(e.x,e.y,'ELITE','#ffd24a');}}
}
