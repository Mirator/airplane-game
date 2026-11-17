// effects.js - cosmetic effects state: screen shake, floating combat text, hurt flash.

function shake(a){if(rmo())return;shakeUntil=performance.now()+220;shakeAmt=a;}
function playerHurtFx(d){
 const p=G.p,now=performance.now();flashes.p=now;flashUntil=now+250;sfx('hurt');
 const big=d>=Math.max(6,p.mhp*0.2);buzz(big?70:30);if(big)shake(6);
}

function floatFx(x,y,text,color,big){fx.push({x,y,text,color,big:!!big,t:performance.now()});}
