// screens.js - the Records and Achievements screens (opened from the title; drawn into the title box).

function screenFrame(title){
 const t=$('titleBox');t.innerHTML='';
 const h=document.createElement('h1');h.textContent=title;t.appendChild(h);
 return t;
}
function backBtn(t){const b=document.createElement('button');b.className='c';b.textContent='Back';b.id='btnBack';b.addEventListener('click',function(){showTitle();});t.appendChild(b);}
function recLine(r){
 return 'Deepest floor <b>'+(r.best||'-')+'</b> &middot; Wins <b>'+r.wins+'</b>/'+r.runs+' &middot; Fastest win <b>'+(r.fast?r.fast+' turns':'-')+'</b> &middot; Best score <b>'+(r.score||'-')+'</b>'+(r.aruns?' &middot; <em class="tag act">Auto</em> <b>'+r.awins+'</b>/'+r.aruns+' won':'');
}
function showRecords(){
 const t=screenFrame('🏅 Records'),add=(html,style)=>{const d=document.createElement('div');d.className='pl';d.innerHTML=html;if(style)d.style.cssText=style;t.appendChild(d);return d;};
 const wr=meta.runs?Math.round(100*(meta.wins/Math.max(1,meta.runs))):0;
 add('<b>Totals</b><br>Runs <b>'+meta.runs+'</b> &middot; Wins <b>'+meta.wins+'</b> ('+wr+'%) &middot; Hard wins <b>'+meta.hwins+'</b><br>Win streak <b>'+meta.streak+'</b> &middot; Best streak <b>'+meta.bstreak+'</b>'+(meta.aruns?'<br><em class="tag act">Auto</em> runs <b>'+meta.aruns+'</b> (half gold)':''),'border:1px solid #4b5080;border-radius:10px;padding:8px');
 for(const k of Object.keys(CLS)){
  const C=CLS[k],n=recGet(k,0),h=recGet(k,1);
  add('<b>'+C.e+' '+C.n+'</b><br><small>'+recLine(n)+'</small>'+(h.runs?'<br><small>💀 Hard: '+recLine(h)+'</small>':''),'border:1px solid #3a3f64;border-radius:10px;padding:8px');
 }
 const days=Object.keys(meta.dly).sort().reverse().slice(0,7);
 let dh='<b>📅 Recent dailies</b>';
 if(!days.length)dh+='<br><small>No Daily played yet. Today: '+dailyNote()+'.</small>';
 for(const d of days){const r=meta.dly[d];dh+='<br><small>'+d+': '+(r.score?(CLS[r.cls]?CLS[r.cls].e+' ':'')+(r.won?'<b style="color:#8fe39a">WON</b>':'floor '+r.floor)+' &middot; '+r.score+' pts':'started, no result')+(r.auto?' <em class="tag act">Auto</em>':'')+(r.att>1?' &middot; '+r.att+' tries':'')+'</small>';}
 add(dh,'border:1px solid #3a3f64;border-radius:10px;padding:8px');
 add('<small>Score = '+BAL.score.floor+' per floor, '+BAL.score.kill+' per kill, '+BAL.score.level+' per level; a win adds '+BAL.score.win+' plus '+BAL.score.perTurn+' for each turn under '+BAL.score.par+'. Hard x'+BAL.hard.scoreMul+'. Records are kept on this device only.</small>');
 backBtn(t);
 $('title').style.display='flex';
}
function showAchievements(){
 const done=ACH.filter(a=>meta.ach[a.id]).length;
 const t=screenFrame('🏆 Achievements');
 const s=document.createElement('p');s.style.textAlign='center';s.textContent=done+' of '+ACH.length+' earned';t.appendChild(s);
 for(const a of ACH){
  const have=!!meta.ach[a.id],d=document.createElement('div');d.className='pl';d.dataset.ach=a.id;d.dataset.have=have?'1':'0';
  d.style.cssText='border:1px solid '+(have?'#2a8a5a':'#3a3f64')+';border-radius:10px;padding:8px;'+(have?'':'opacity:.75');
  let prog='';if(!have&&a.prog){let p='';try{p=a.prog();}catch(e){}if(p)prog=' <small>('+p+')</small>';}
  d.innerHTML='<b>'+(have?'🏆':'🔒')+' '+a.n+'</b>'+(a.gold?' <span class="gold" style="font-size:12px">'+(have?'✓ ':'')+'+'+a.gold+' 💰</span>':'')+prog+'<br><small>'+a.d+'</small>';
  t.appendChild(d);
 }
 backBtn(t);
 $('title').style.display='flex';
}
