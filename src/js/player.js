// player.js - class lookup and XP / level-up progression.

function clsOf(p){return CLS[p.cls]||CLS.warrior;}
function needXp(l){return BAL.xp.base+l*BAL.xp.perLevel;}
function gainXp(n){
 const p=G.p;p.xp+=Math.round(n*p.xpMul);
 while(p.xp>=needXp(p.lvl)){p.xp-=needXp(p.lvl);p.lvl++;{const o=rollPick();if(o.length){G.pending++;G.picks.push({l:p.lvl,o:o});}}const lg=LG[p.cls]||LG.warrior;p.mhp+=lg.hp;p.hp+=lg.hp;if(lg.atkE&&p.lvl%lg.atkE===0)p.atk++;msg('Level up! You are level '+p.lvl+'.');if(!spendNow)msg('Level up: tap the badge to pick a perk.');pulseUntil=performance.now()+700;callout(p.x,p.y,'LEVEL UP','#ffd24a');sfx('level');try{if(!rmo()){const h=$('hpbar');h.classList.remove('pulse');void h.offsetWidth;h.classList.add('pulse');}}catch(e){}}
}
