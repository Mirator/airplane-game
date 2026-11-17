// records.js - run score, personal records, streaks, daily results, achievement checking and the toast that announces them.

function hardUnlocked(){return meta.wins>=1;}
function hardOn(){return hardUnlocked()&&!!meta.hardOn;}
function recOf(cls,hard){
 const t=meta.rec[hard?'h':'n'];
 if(!t[cls]||typeof t[cls]!=='object')t[cls]={};
 const r=t[cls];for(const k of ['runs','wins','best','fast','score'])r[k]=+r[k]||0;   // fast = fewest turns in a win (0 = none yet)
 return r;
}
// read-only view (never creates entries in the save)
function recGet(cls,hard){const r=meta.rec[hard?'h':'n'][cls]||{};return {runs:+r.runs||0,wins:+r.wins||0,best:+r.best||0,fast:+r.fast||0,score:+r.score||0};}
function recWins(cls){return recGet(cls,0).wins+recGet(cls,1).wins;}
function modsDone(){return Object.keys(meta.mods||{}).length;}
function statWin(){return !!G&&!!G.stats&&!!G.stats.win&&!G.stats.legacy;}
function scoreOf(g,won){
 const S=BAL.score,hard=!!g.hard;
 let s=g.floor*S.floor+g.kills*S.kill+g.p.lvl*S.level;
 if(won)s+=S.win+Math.max(0,S.par-g.turn)*S.perTurn;
 return Math.round(s*(hard?BAL.hard.scoreMul:1));
}
function todayKey(){const d=new Date(),z=n=>(n<10?'0':'')+n;return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate());}
// update every record for the run that just ended; returns the list of new-record labels shown on the recap
function recordRun(kind,score){
 const g=G,won=kind==='win',hard=!!g.hard,cls=g.p.cls,r=recOf(cls,hard),nr=[];
 r.runs++;meta.runs++;
 if(g.floor>r.best){if(r.best>0)nr.push('deepest floor');r.best=g.floor;}
 if(score>r.score){if(r.score>0)nr.push('highest score');r.score=score;}
 if(won){
  r.wins++;if(hard)meta.hwins++;
  if(!r.fast||g.turn<r.fast){if(r.fast)nr.push('fastest win');r.fast=g.turn;}
  meta.streak++;meta.bstreak=Math.max(meta.bstreak,meta.streak);
 }else meta.streak=0;
 if(g.daily){
  const d=meta.dly[g.daily]||(meta.dly[g.daily]={att:1});
  if(!d.score||(won&&!d.won)||((won?1:0)===(d.won?1:0)&&score>d.score)){d.cls=cls;d.floor=g.floor;d.won=won?1:0;d.score=score;d.turns=g.turn;}
  const ks=Object.keys(meta.dly).sort();while(ks.length>30)delete meta.dly[ks.shift()];
 }
 return nr;
}
function dailyNote(){
 const d=meta.dly[todayKey()];
 if(!d)return 'not played yet';
 return d.score?('best '+(d.won?'WON':'floor '+d.floor)+' - '+d.score+' pts'):('started'+(d.att>1?' x'+d.att:'')+', no result yet');
}
// ---- achievements ----
function earn(id){
 const a=ACH.find(x=>x.id===id);if(!a||meta.ach[id])return false;
 meta.ach[id]=1;if(a.gold)meta.gold+=a.gold;saveMeta();
 if(G){(G.newAch=G.newAch||[]).push(a.n+(a.gold?' (+'+a.gold+' 💰)':''));toast('🏆 '+a.n+(a.gold?'  +'+a.gold+' 💰':''));}
 return true;
}
function checkAchievements(){
 let any=false;
 for(const a of ACH)if(a.chk&&!meta.ach[a.id]){let ok=false;try{ok=!!a.chk();}catch(e){}if(ok){earn(a.id);any=true;}}
 return any;
}
// ---- toast: a small pill under the HUD that never blocks taps ----
function toast(text,ms){
 toastQ.push({t:text,ms:ms||3200});if(!toastBusy)nextToast();
}
function nextToast(){
 const el=$('toast');if(!el)return;
 const t=toastQ.shift();if(!t){toastBusy=false;el.style.opacity='0';return;}
 toastBusy=true;el.textContent=t.t;el.style.opacity='1';
 setTimeout(function(){el.style.opacity='0';setTimeout(nextToast,260);},t.ms);
}
