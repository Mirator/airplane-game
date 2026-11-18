// idle.js - the idle / meta layer: upgrade levels and prices, blueprints, Heat, expeditions (the offline outcome model) and Auto's idle pay.
// The screens are in idleui.js; every number is in balance.js (BAL.upg / heat / exp / bp, UPG, PAIRS, HEAT, BPS, EXP_TABLE).

// ---------- upgrades ----------
function upLvl(k){return (meta.up&&meta.up[k])|0;}
function upItem(k){return UPG.find(u=>u.k===k)||PAIRS.find(q=>q.k===k)||null;}
function upShown(u,l){const v=upVal(u,l);return u.int?Math.round(v):v;}   // atk / def are whole numbers (half levels round)
function upBonus(k){const u=UPG.find(x=>x.k===k);return u?upShown(u,upLvl(k))+((meta.leg&&meta.leg[k])|0):0;}   // level bonus plus the veteran bonus of a migrated save
function upNext(it){const l=upLvl(it.k);return l>=upMax(it)?0:upCost(it,l);}
function upSpent(){let t=0;for(const it of UPG.concat(PAIRS))for(let l=0;l<upLvl(it.k);l++)t+=upCost(it,l);return t;}   // the "upgrade power": gold put into levels
function upMaxSpent(){let t=0;for(const it of UPG.concat(PAIRS))for(let l=0;l<upMax(it);l++)t+=upCost(it,l);return t;}
function upBuy(k){
 const it=upItem(k);if(!it)return false;
 const l=upLvl(k),c=upNext(it);
 if(l>=upMax(it)||meta.gold<c)return false;
 meta.gold-=c;meta.up[k]=l+1;saveMeta();return true;
}
function pairVar(q){return q.v[meta.pv[q.k]===1?1:0];}
function pairFee(q){return upLvl(q.k)>0?BAL.upg.switchFee:0;}   // a pair with no level yet is free to set
function pairSwitch(k){
 const q=PAIRS.find(x=>x.k===k);if(!q)return false;
 const fee=pairFee(q);if(meta.gold<fee)return false;
 meta.gold-=fee;meta.pv[k]=meta.pv[k]===1?0:1;saveMeta();return true;
}
// text for a card: what the current level gives and what the next one adds
function upText(it){
 const l=upLvl(it.k),mx=upMax(it);
 if(it.steps){
  const v=upShown(it,l),n=l<mx?upShown(it,l+1)-v:0,u=it.u;
  return '+'+v+u+(n?' · next +'+n:' · MAX');
 }
 const va=pairVar(it);
 return (l?va.d(l):'no effect yet')+(l<mx?' · next '+va.d(l+1).replace(/^\+/,'+'):' · MAX');
}

// ---------- Heat ----------
function heatMax(){return Math.min(BAL.heat.max,Math.max(meta.heat|0,meta.wins>=1?1:0));}   // highest Heat that can be started (a win has always unlocked Heat 1)
function heatSel(){return Math.min(heatMax(),meta.heatSel|0);}
function heatGold(h){return BAL.heat.goldMul[Math.max(0,Math.min(BAL.heat.max,h|0))]||1;}
function heatScore(h){return BAL.heat.scoreMul[Math.max(0,Math.min(BAL.heat.max,h|0))]||1;}
// a won run at the highest unlocked Heat opens the next one. Returns the new Heat or 0.
function heatAfterWin(h){
 if(h<1||h<heatMax()||h>=BAL.heat.max)return 0;
 meta.heat=h+1;return h+1;
}

// ---------- blueprints ----------
function bpState(id){return (meta.bp&&meta.bp[id])|0;}
function bpOn(id){return bpState(id)===2;}
function bpOf(id){return BPS.find(b=>b.id===id)||null;}
function bpCounts(){let f=0,u=0;for(const b of BPS){const s=bpState(b.id);if(s>=1)f++;if(s===2)u++;}return {found:f,unlocked:u,total:BPS.length};}
function bpFound(id){if(!bpOf(id)||bpState(id))return false;meta.bp[id]=1;saveMeta();return true;}
function bpBuy(id){
 const b=bpOf(id);if(!b||bpState(id)!==1)return false;
 const c=BAL.bp.cost[b.tier];if(meta.gold<c)return false;
 meta.gold-=c;meta.bp[id]=2;saveMeta();return true;
}
// a blueprint of one of `tiers` that is not found yet (rng() in [0,1)), or null
function bpPick(tiers,rng){
 const pool=BPS.filter(b=>tiers.indexOf(b.tier)>=0&&!bpState(b.id));
 return pool.length?pool[Math.floor(rng()*pool.length)]:null;
}
// blueprint dropped by a finished manual run: best ones from the dragon or Heat 1+ runs, better ones from floor 5+. Auto runs find none. Returns the blueprint or null.
function bpRunDrop(won){
 const B=BAL.bp,g=G;if(!g||(g.auto&&g.auto.used))return null;
 const rng=Math.random,heat=g.heat|0,deep=g.floor>=B.deepFrom;
 let b=null;
 if(won&&rng()<(heat>=1?B.bestHeatWin:B.bestWin))b=bpPick(['b'],rng);
 else if(deep&&heat>=1&&rng()<B.bestHeat)b=bpPick(['b'],rng);
 if(!b&&deep&&rng()<B.deepChance)b=bpPick(['r'],rng)||bpPick(['c'],rng);
 if(b)bpFound(b.id);
 return b;
}
function bpIcon(b){return b.t==='perk'?'p_'+b.id:b.e;}
function bpDesc(b){
 if(b.t==='weapon')return wpRule(b.id,false);
 if(b.t==='off')return offRule(b.id);
 if(b.t==='charm')return charmRule(b.id);
 const pk=perkById(b.id);return pk?pk.d:'';
}
// loot pools only contain unlocked blueprints
function bpTable(T){const o={};for(const k in T)if(!T[k].bp||bpOn(k))o[k]=T[k];return o;}

// ---------- expeditions ----------
function mulberry(a){return function(){a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
const lerpA=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
// the table row for a class at upgrade power pw: linear blend of the two nearest calibrated rows
function expRow(cls,pw){
 const rows=EXP_TABLE[cls]||EXP_TABLE.warrior;
 if(pw<=rows[0].pw||rows.length===1)return rows[0];
 for(let i=1;i<rows.length;i++){
  if(pw<=rows[i].pw){
   const a=rows[i-1],b=rows[i],t=(pw-a.pw)/Math.max(1,b.pw-a.pw);
   return {pw:pw,reach:lerpA(a.reach,b.reach,t),gold:lerpA(a.gold,b.gold,t),kills:lerpA(a.kills,b.kills,t),turns:a.turns+(b.turns-a.turns)*t,gph:a.gph+(b.gph-a.gph)*t};
  }
 }
 return rows[rows.length-1];
}
function expDur(min){return BAL.exp.durs.find(d=>d.min===min)||BAL.exp.durs[0];}
// expected gold of an expedition of `dur` minutes (shown on the send screen)
function expEstimate(cls,dur,pw){return Math.round(expRow(cls,pw==null?upSpent():pw).gph*expDur(dur).rate*dur/60);}
function expElapsed(rec,now){const m=(now-rec.t0)/60000;return m>0?Math.min(m,BAL.exp.capMin):0;}   // never negative, never more than the cap
function expReady(rec,now){return !!rec&&expElapsed(rec,now)>=rec.dur;}
// The outcome of an expedition after `now`: pure (the record, the clock and which blueprints are already found decide it), so a reload cannot reroll it.
// The hero is back after rec.dur minutes (or `now` if recalled earlier) and made one delve per delveMin minutes; each delve draws the floor it
// ended on from the class row; its gold / kills are that floor's means scaled so the expedition pays rate x manual gold per hour on average.
function expResult(rec,now,found){
 const X=BAL.exp,D=expDur(rec.dur),el=expElapsed(rec,now),eff=Math.min(el,rec.dur);
 const row=expRow(rec.cls,rec.pw);
 let avg=0;for(let i=0;i<9;i++)avg+=row.reach[i]*row.gold[i];
 const scale=avg>0?row.gph*(X.delveMin/60)*D.rate/avg:0;
 const phase=mulberry(hashStr(rec.cls+'|'+rec.seed+'|'+rec.t0))();
 const n=Math.max(0,Math.floor(eff/X.delveMin+phase));
 let gold=0,kills=0,deaths=0,floor=0,bp=null;
 for(let i=0;i<n;i++){
  const rng=mulberry(hashStr(rec.seed+'|'+rec.t0+'|'+rec.pw.toFixed(1)+'|'+i));
  let u=rng(),f=0;for(;f<8;f++){u-=row.reach[f];if(u<0)break;}
  gold+=scale*row.gold[f];kills+=scale*row.kills[f];
  if(f<8)deaths++;
  floor=Math.max(floor,Math.min(f+1,MAXF));
  const roll=rng();
  if(!bp&&f+1>=X.bpMinFloor&&roll<X.bpChance){
   const pool=BPS.filter(b=>b.tier==='c'&&!bpState(b.id)&&!(found&&found.has(b.id)));
   if(pool.length)bp=pool[Math.floor(rng()*pool.length)].id;
  }
 }
 return {cls:rec.cls,dur:rec.dur,el:Math.round(eff),delves:n,floor:floor,kills:Math.round(kills),deaths:deaths,gold:Math.round(gold),bp:bp,early:el<rec.dur?1:0};
}
function expFree(){const e=meta.exp;for(let i=0;i<(e.s2?2:1);i++)if(!e.run[i])return i;return -1;}
function expSend(slot,cls,dur){
 const e=meta.exp;
 if(slot<0||slot>1||(slot===1&&!e.s2)||e.run[slot]||!CLS[cls]||(cls!=='warrior'&&!meta.unl[cls])||!BAL.exp.durs.some(d=>d.min===dur))return false;
 e.run[slot]={cls:cls,dur:dur,t0:Date.now(),seed:Math.floor(Math.random()*4294967296)>>>0,pw:upSpent()};
 saveMeta();return true;
}
// pay the result of a slot (done or recalled early) and free it; the report is kept until the player closes it
function expCollect(slot,now){
 const e=meta.exp,rec=e.run[slot];if(!rec)return null;
 const r=expResult(rec,now==null?Date.now():now);
 meta.gold+=r.gold;if(r.bp)bpFound(r.bp);
 e.run[slot]=null;e.rep=r;saveMeta();
 return r;
}
function expBuySlot(){if(meta.exp.s2||meta.gold<BAL.exp.secondSlot)return false;meta.gold-=BAL.exp.secondSlot;meta.exp.s2=1;saveMeta();return true;}
function expReadyCount(now){now=now==null?Date.now():now;let n=0;for(const r of meta.exp.run)if(r&&expReady(r,now))n++;return n;}
function expActive(){return meta.exp.run.filter(Boolean).length;}
function fmtDur(ms){
 const m=Math.max(0,Math.ceil(ms/60000));
 return m>=60?Math.floor(m/60)+'h '+(m%60<10?'0':'')+(m%60)+'m':m+'m';
}

// ---------- Auto's idle pay ----------
// Auto earns the 30-minute expedition rate for the time it plays (gold per hour of the class at the current upgrade power), not the gold of the run.
function autoRate(cls){return expRow(cls,upSpent()).gph*BAL.exp.durs[0].rate;}
function autoPay(g){const ms=(g.auto&&g.auto.ms)|0;return Math.round(autoRate(g.p.cls)*ms/3600000);}
