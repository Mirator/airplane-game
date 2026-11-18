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
// what one level of a pair variant gives, said BEFORE paying: 'Keen +2% crit per level'
function pairPer(q,v){return v.n+' '+v.d(1)+(q.max>1?' per level':'');}
function upText(it){
 const l=upLvl(it.k),mx=upMax(it);
 if(it.steps){
  const v=upBonus(it.k),leg=(meta.leg&&meta.leg[it.k])|0,n=l<mx?upShown(it,l+1)-upShown(it,l):0,u=it.u;   // the real total, veteran bonus of a migrated save included
  return '+'+v+u+(it.k==='pot'&&v!==1?'s':'')+(leg?' (incl. '+leg+' veteran)':'')+(n?' · next +'+n:' · MAX');
 }
 const va=pairVar(it);
 return (l?va.d(l):pairPer(it,va))+(l&&l>=mx?' · MAX':'');
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
// the kind and class of a blueprint, said on its card: 'Off-hand · Rogue only'
function bpKind(b){
 const k={weapon:'Weapon',off:'Off-hand',charm:'Charm',perk:'Perk'}[b.t]||'Item',c=b.t==='off'?OFF[b.id].cls:b.t==='perk'?(perkById(b.id)||{}).cls:null;
 return k+' · '+(c?CLS[c].n+' only':'any class');
}
function bpDesc(b){
 const d=b.t==='weapon'?wpRule(b.id,false).replace(/(-?\+?\d+ attack)/,'$1 vs Sword'):b.t==='off'?offRule(b.id):b.t==='charm'?charmRule(b.id):(perkById(b.id)||{d:''}).d;
 return d.replace(/\.$/,'');
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
// the deepest floor the player reached in MANUAL play (Auto does not count; at least 1): a hero never delves deeper
function expBest(rec){const b=rec&&rec.bf>0?rec.bf:meta.bestM|0;return Math.max(1,Math.min(MAXF,b));}   // a trip sent by an older build has no bf: it follows the current best
// gold per hour at the 8 h rate for a best floor and upgrade power
function expGph(best,pw){
 const X=BAL.exp,B=Math.max(1,Math.min(MAXF,best|0)),c=X.boost;let k=c[c.length-1][1];
 if(pw<=c[0][0])k=c[0][1];else for(let i=1;i<c.length;i++)if(pw<=c[i][0]){k=c[i-1][1]+(c[i][1]-c[i-1][1])*(pw-c[i-1][0])/(c[i][0]-c[i-1][0]);break;}
 return X.gph[B-1]*(1+k);
}
// expected gold of an expedition of `dur` minutes (shown on the send screen); cls is kept for callers, every class pays the same
function expEstimate(cls,dur,pw,best){return Math.round(expGph(best==null?expBest():best,pw==null?upSpent():pw)*expDur(dur).rate*dur/60);}
function expElapsed(rec,now){const m=(now-rec.t0)/60000;return m>0?Math.min(m,BAL.exp.capMin):0;}   // never negative, never more than the cap
function expReady(rec,now){return !!rec&&expElapsed(rec,now)>=rec.dur;}
function expLeft(rec,now){return Math.max(0,Math.min(rec.dur,rec.dur-expElapsed(rec,now)))*60000;}   // ms to go, never more than the trip length (a clock set back does not add time)
// The outcome of an expedition after `now`: pure (the record, the clock and which blueprints are already found decide it), so a reload cannot reroll it.
// The hero is back after rec.dur minutes (or `now` if recalled earlier) and made one delve per delveMin minutes; each delve draws the floor it
// ended on from the class row (every floor above the player's best manual floor is folded into it); gold / kills follow that floor's shape, scaled so the
// expedition pays expGph x rate per hour on average (BAL.exp.flat of every delve is the same on every floor, so a short trip is not a lottery).
function expResult(rec,now,found){
 const X=BAL.exp,D=expDur(rec.dur),el=expElapsed(rec,now),eff=Math.min(el,rec.dur),B=expBest(rec);
 const row=expRow(rec.cls,rec.pw);
 const reach=Array(9).fill(0),wg=Array(9).fill(0),wk=Array(9).fill(0);
 for(let i=0;i<9;i++){const t=B<MAXF&&i>B-1?B-1:i;reach[t]+=row.reach[i];wg[t]+=row.reach[i]*row.gold[i];wk[t]+=row.reach[i]*row.kills[i];}
 let tot=0,mg=0;for(let i=0;i<9;i++)tot+=reach[i];
 for(let i=0;i<9;i++)mg+=wg[i];mg=tot>0?mg/tot:1;
 const gold=reach.map((r,i)=>r>0?X.flat*mg+(1-X.flat)*wg[i]/r:0),kills=reach.map((r,i)=>r>0?wk[i]/r:0);
 let avg=0;for(let i=0;i<9;i++)avg+=reach[i]/Math.max(tot,1e-9)*gold[i];
 const scale=avg>0?expGph(B,rec.pw)*(X.delveMin/60)*D.rate/avg:0;
 const phase=mulberry(hashStr(rec.cls+'|'+rec.seed+'|'+rec.t0))();
 const n=Math.max(0,Math.floor(eff/X.delveMin+phase));
 let g=0,kl=0,deaths=0,floor=0,bp=null;
 for(let i=0;i<n;i++){
  const rng=mulberry(hashStr(rec.seed+'|'+rec.t0+'|'+rec.pw.toFixed(1)+'|'+i));
  let u=rng()*tot,f=0;for(;f<8;f++){u-=reach[f];if(u<0)break;}
  f=Math.min(f,8);
  g+=scale*gold[f];kl+=scale*kills[f];
  if(f<8)deaths++;
  floor=Math.max(floor,Math.min(f+1,B));
  const roll=rng();
  if(!bp&&Math.min(f+1,B)>=X.bpMinFloor&&roll<X.bpChance){
   const pool=BPS.filter(b=>b.tier==='c'&&!bpState(b.id)&&!(found&&found.has(b.id)));
   if(pool.length)bp=pool[Math.floor(rng()*pool.length)].id;
  }
 }
 return {cls:rec.cls,dur:rec.dur,el:Math.round(eff),delves:n,floor:floor,kills:Math.round(kl),deaths:deaths,gold:Math.round(g),bp:bp,early:el<rec.dur?1:0};
}
function expFree(){const e=meta.exp;for(let i=0;i<(e.s2?2:1);i++)if(!e.run[i])return i;return -1;}
function expSend(slot,cls,dur){
 const e=meta.exp;
 if(slot<0||slot>1||(slot===1&&!e.s2)||e.run[slot]||!CLS[cls]||(cls!=='warrior'&&!meta.unl[cls])||!BAL.exp.durs.some(d=>d.min===dur))return false;
 e.run[slot]={cls:cls,dur:dur,t0:Date.now(),seed:Math.floor(Math.random()*4294967296)>>>0,pw:upSpent(),bf:expBest()};
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
// Auto pays by the TURNS it played (so 1x / 2x / 4x pay the same), at the 30-minute expedition rate for the player's best manual floor and upgrade power.
function autoGph(){return expGph(expBest(),upSpent())*BAL.exp.durs[0].rate;}
function autoRate(){return autoGph();}   // gold per hour of play (1 turn = BAL.exp.turnSec)
function autoPerTurn(){return autoGph()*BAL.exp.turnSec/3600;}
function autoTurns(g){return g&&g.auto?(g.auto.t|0)+(AUTO.self?Math.max(0,g.turn-AUTO.t0):0):0;}   // turns Auto played, including the one being resolved
function autoPay(g,turns){return Math.round(autoPerTurn()*(turns==null?autoTurns(g):turns));}
// what a run banks (and what the HUD shows once Auto has played in it): run gold of the turns the player played themselves (x Heat), plus idle pay for Auto's turns
function runBank(g,won){
 const aut=!!(g.auto&&g.auto.used),bonus=won?BAL.run.winBonus:0,heat=gHeat(g);
 const share=aut?Math.min(1,autoTurns(g)/Math.max(1,g.turn)):0,idle=aut?autoPay(g):0;
 return {banked:Math.round((g.p.gold+bonus)*(1-share)*heatGold(heat)+idle),idle:idle,share:share,bonus:bonus,heat:heat};
}
