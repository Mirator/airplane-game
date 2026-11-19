// enemies.js - enemy AI: waking, movement, kiting, pack surround, healing casters, wind-up telegraphed attacks, dragon phases.

function dangerSet(){const st=new Set();if(!G)return st;for(const e of G.enemies)if(e.wind&&!e.dead)for(const t of e.wind.tiles)st.add(ix(t[0],t[1]));return st;}
function dangerNear(dz){const p=G.p;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dz.has(ix(p.x+dx,p.y+dy))&&inb(p.x+dx,p.y+dy))return true;return false;}
// a wind-up is only started if the player has a free adjacent tile outside the marked area
function canEscape(tiles){
 const p=G.p,st=new Set(tiles.map(t=>ix(t[0],t[1])));
 for(const [dx,dy] of DIRS){const nx=p.x+dx,ny=p.y+dy;if(!inb(nx,ny))continue;const t=G.map[ix(nx,ny)];
  if(t===0||t===3||t===5||merchantAt(nx,ny)||enemyAt(nx,ny))continue;if(!st.has(ix(nx,ny)))return true;}
 return false;
}
function smashWind(e){
 const p=G.p,dx=p.x-e.x,dy=p.y-e.y,px=Math.abs(dy),py=Math.abs(dx),tiles=[];
 for(const o of [0,1,-1]){const x=p.x+px*o,y=p.y+py*o;if(inb(x,y)&&G.map[ix(x,y)]!==0&&G.map[ix(x,y)]!==3&&G.map[ix(x,y)]!==5&&!(x===e.x&&y===e.y))tiles.push([x,y]);}
 if(!canEscape(tiles))return null;
 return {k:'smash',tiles:tiles,dx:dx,dy:dy};
}
function breathWind(e){
 const p=G.p,dx=p.x-e.x,dy=p.y-e.y;let ax=0,ay=0,off,k;
 if(Math.abs(dx)>=Math.abs(dy)){ax=Math.sign(dx);off=dy;k=Math.abs(dx);}else{ay=Math.sign(dy);off=dx;k=Math.abs(dy);}
 if(k<1||k>BAL.enemyAi.breathRange||Math.abs(off)>1)return null;
 const px=ay!==0?1:0,py=ax!==0?1:0;
 const s0=off>0?-1:off<0?1:(rf()<0.5?1:-1);
 for(const sd of [s0,-s0]){
  const offs=[off,off+sd,off+2*sd],tiles=[];
  for(const o of offs){
   for(let kk=1;kk<=BAL.enemyAi.breathLength;kk++){
    const x=e.x+ax*kk+px*o,y=e.y+ay*kk+py*o;
    if(!inb(x,y)||G.map[ix(x,y)]===0||G.map[ix(x,y)]===3||G.map[ix(x,y)]===5)break;
    tiles.push([x,y]);
   }
  }
  if(tiles.some(t=>t[0]===p.x&&t[1]===p.y)&&canEscape(tiles))return {k:'breath',tiles:tiles,dx:ax,dy:ay};
 }
 return null;
}
// enraged dragon: telegraphed sweep over the ring of tiles around it (only started when you are next to it and can step out)
function sweepWind(e){
 const tiles=[];
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const x=e.x+dx,y=e.y+dy;
  if(inb(x,y)&&G.map[ix(x,y)]!==0&&G.map[ix(x,y)]!==3&&G.map[ix(x,y)]!==5)tiles.push([x,y]);}
 if(!canEscape(tiles))return null;
 return {k:'sweep',tiles:tiles,dx:0,dy:0};
}
function summonWhelps(e){
 const c=[];
 for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const x=e.x+dx,y=e.y+dy;
  if(inb(x,y)&&G.map[ix(x,y)]===1&&!enemyAt(x,y)&&!(x===G.p.x&&y===G.p.y))c.push([x,y]);}
 c.sort(()=>rf()-0.5);
 let n=0;
 for(const t of c){if(n>=BAL.enemyAi.summonN)break;const w=makeEnemy('whelp',t[0],t[1],G.floor);w.awake=true;n++;}
 msg('The '+EN[e.t].n+' calls its brood: '+n+' whelps!');floatFx(e.x,e.y,'BROOD','#f95',true);
}
function summonList(){return G.hard?[BAL.hard.extraSummonAt].concat(BAL.enemyAi.summonAt):BAL.enemyAi.summonAt;}
function bossPhase(e){
 const at=summonList();
 while((e.sm||0)<at.length&&e.hp<e.mhp*at[e.sm||0]){e.sm=(e.sm||0)+1;summonWhelps(e);}
}
function resolveWind(e,d){
 const w=e.wind,p=G.p;e.wind=null;e.cd=w.k==='smash'?BAL.enemyAi.smashCooldown:w.k==='sweep'?BAL.enemyAi.sweepCd:Math.max(1,(e.enraged?BAL.enemyAi.enrageBreathCd:BAL.enemyAi.breathCooldown)-(d.boss&&gHeat(G)>=5?BAL.heat.breathCut:0));
 if(w.tiles.some(t=>t[0]===p.x&&t[1]===p.y)){
  if(d.boss&&w.k!=='smash')G.stats.dragonHit=1;
  const dmg=Math.round(e.atk*(w.k==='sweep'?BAL.enemyAi.sweepMul:(d.windMul||BAL.enemyAi.defaultWindMul)));
  if(w.k==='sweep')hurtPlayer(e,dmg,true,'sweeps');
  else if(w.k==='smash'){if(hurtPlayer(e,dmg,true,'SMASHES')&&p.hp>0)knock(p,w.dx,w.dy);}
  else hurtPlayer(e,dmg,false,'scorches');
 }else{msg('The '+d.n+"'s attack hits empty ground.");floatFx(e.x,e.y,'miss','#ccc');}
}
function moveEnemy(e,x,y){
 const i=ix(x,y);markGone(e.x,e.y);if(vOff>0)holdSet(e.x,e.y,vOff);   // the step is drawn after the player's own action
 if(waterSet().has(i))e.wade=1;
 if(G.map[i]===3){G.map[i]=4;if(G.vis[i])msg('The '+nm(e)+' opens the door.');}
 e.face=[Math.sign(x-e.x),Math.sign(y-e.y)];e.x=x;e.y=y;
}
function fleeStep(e,p){
 let best=null,bd=Math.abs(e.x-p.x)+Math.abs(e.y-p.y);
 for(const [dx,dy] of DIRS){const nx=e.x+dx,ny=e.y+dy;
  if(!walkable(nx,ny)||G.map[ix(nx,ny)]===3||enemyAt(nx,ny)||(nx===p.x&&ny===p.y))continue;
  const nd=Math.abs(nx-p.x)+Math.abs(ny-p.y);if(nd>bd){bd=nd;best=[nx,ny];}}
 return best;
}
// pack AI: head for a free tile next to the player rather than queueing behind others
function surroundStep(e,p){
 const dm=bfsDist(e.x,e.y);let tg=null,bd=9999;
 for(const [dx,dy] of DIRS){const tx=p.x+dx,ty=p.y+dy,k=ix(tx,ty);
  if(!walkable(tx,ty)||G.map[k]===3||enemyAt(tx,ty)||claimed.has(k))continue;
  if(dm[k]<bd){bd=dm[k];tg=[tx,ty];}}
 if(!tg||bd>=9999)return null;
 claimed.add(ix(tg[0],tg[1]));
 const dt=bfsDist(tg[0],tg[1]);let best=null,cd=dt[ix(e.x,e.y)];
 for(const [dx,dy] of DIRS){const nx=e.x+dx,ny=e.y+dy;
  if(!walkable(nx,ny)||enemyAt(nx,ny)||(nx===p.x&&ny===p.y))continue;
  if(dt[ix(nx,ny)]<cd){cd=dt[ix(nx,ny)];best=[nx,ny];}}
 return best;
}
function enemiesAct(free){
 const p=G.p,dist=bfsDist(p.x,p.y);claimed=new Set();let beat=0;
 try{
 for(const e of G.enemies.slice()){
  if(p.hp<=0)break;if(e.dead)continue;
  // everything the enemy phase shows starts 140 ms behind the player's own action, attackers 60 ms apart (at most 300 ms): cause, then effect
  vOff=Math.min(300,140+60*beat);if(e.awake&&G.vis[ix(e.x,e.y)])beat++;
  const d=EN[e.t];if(!free&&e.cd>0)e.cd--;if(!free&&e.hcd>0)e.hcd--;
  if(d.boss&&!free)bossPhase(e);
  if(e.stun>0||e.frz>0){e.wind=null;if(!free){if(e.stun>0)e.stun--;if(e.frz>0)e.frz--;}continue;}
  if(e.wade){if(!free)e.wade=0;continue;}   // Flooded: it waded into water and loses this move
  if(G.smoke&&inSmoke(e.x,e.y))e.blind=Math.max(e.blind||0,2);
  const blindNow=e.blind>0;if(!free&&e.blind>0)e.blind--;
  if(G.vanish>0){e.awake=false;e.wind=null;continue;}
  if(free&&(e.wind||d.slowAct))continue;
  if(e.wind){resolveWind(e,d);continue;}
  const md=Math.abs(e.x-p.x)+Math.abs(e.y-p.y);
  const sightR=Math.max(1,enemySight()-(eqKind('charm')==='veil'?BAL.charm.veilSight:0));
  const see=!blindNow&&md<=(G.smoke&&inSmoke(p.x,p.y)?1:sightR)&&los(e.x,e.y,p.x,p.y);
  if(see)e.awake=true;
  if(!e.awake)continue;
  if(!see&&!e.alarm&&dist[ix(e.x,e.y)]>BAL.enemyAi.loseTrackDist){e.awake=false;continue;}
  if(d.slowAct){if(e.rest){e.rest=0;continue;}e.rest=1;}
  if(d.boss&&!e.enraged&&e.hp<e.mhp*(gHeat(G)>=5?BAL.heat.enrageFrac:G.hard?BAL.hard.enrageFrac:BAL.enemyAi.enrageFrac)){e.enraged=1;e.atk=Math.round(e.atk*BAL.enemyAi.enrageAtkMul);msg('The '+d.n+' roars in fury!');callout(e.x,e.y,'ENRAGED','#f55');}
  if(d.heal&&!free&&!(e.hcd>0)){
   let tg=null,bf=BAL.enemyAi.healBelow;
   for(const o of G.enemies){if(o===e||o.dead)continue;const fr=o.hp/o.mhp;
    if(fr<bf&&manh(o,e)<=BAL.enemyAi.healRange&&los(e.x,e.y,o.x,o.y)){bf=fr;tg=o;}}
   if(tg){const h=Math.max(1,Math.round(tg.mhp*BAL.enemyAi.healFrac));tg.hp=Math.min(tg.mhp,tg.hp+h);e.hcd=BAL.enemyAi.healEvery;
    floatFx(tg.x,tg.y,'+'+h,'#8f8');if(G.vis[ix(tg.x,tg.y)])msg('The '+d.n+' mends the '+nm(tg)+'.');continue;}
  }
  const steps=(d.speed||1)+((d.lunge&&!free&&md>1&&(G.turn+e.id)%BAL.enemyAi.lungeEvery===0)?1:0);
  for(let s=0;s<steps;s++){
   if(e.dead)break;
   const dd=Math.abs(e.x-p.x)+Math.abs(e.y-p.y);
   if(d.sweep&&e.enraged&&!free&&dd===1&&e.cd<=0){const w=sweepWind(e);if(w){e.wind=w;msg('The '+d.n+' whips its tail around!');floatFx(e.x,e.y,'!','#f55');break;}}
   if(d.breath&&!free&&e.cd<=0&&see){const w=breathWind(e);if(w){e.wind=w;msg(d.windMsg);floatFx(e.x,e.y,'!','#f55');break;}}
   if(d.wind&&!free&&dd===1&&e.cd<=0){const w=smashWind(e);if(w){e.wind=w;msg(d.windMsg);floatFx(e.x,e.y,'!','#f55');break;}}
   if(dd===1){
    if(d.kite){
     if(e.tired>0)e.tired--;
     else{const fs=fleeStep(e,p);if(fs){e.fl=(e.fl||0)+1;if(e.fl>=BAL.enemyAi.fleeSteps){e.tired=BAL.enemyAi.tiredTurns;e.fl=0;}moveEnemy(e,fs[0],fs[1]);break;}}
    }
    hurtPlayer(e,e.atk,true);break;}
   if(d.range&&see&&dd<=d.range&&e.cd<=0&&los(e.x,e.y,p.x,p.y,true)){hurtPlayer(e,e.atk,false);e.cd=d.cdmax||0;break;}
   if(d.kite&&see&&dd===2&&e.cd>0){const fs=fleeStep(e,p);if(fs){moveEnemy(e,fs[0],fs[1]);break;}}
   if(d.slow&&G.turn%2)break;
   let best=null;
   if(d.pack&&dd>1)best=surroundStep(e,p);
   if(!best){let bd=dist[ix(e.x,e.y)];
    for(const [dx,dy] of DIRS){const nx=e.x+dx,ny=e.y+dy;
     if(!walkable(nx,ny)||enemyAt(nx,ny)||(nx===p.x&&ny===p.y))continue;
     if(dist[ix(nx,ny)]<bd){bd=dist[ix(nx,ny)];best=[nx,ny];}}}
   if(best)moveEnemy(e,best[0],best[1]);else break;
  }
 }
}finally{vOff=0;}
}
