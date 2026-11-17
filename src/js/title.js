// title.js - title screen, class picker, permanent-upgrade shop and unlock list.

function showClassPicker(mode){
 mode=mode||{};
 const t=$('titleBox');t.innerHTML='';
 const h=document.createElement('h1');h.textContent=mode.daily?'📅 Daily: choose your class':'Choose your class';t.appendChild(h);
 if(mode.daily){const p=document.createElement('p');p.style.cssText='text-align:center;font-size:13px';p.textContent='Everyone who plays on '+todayKey()+' gets the same dungeon. Today: '+dailyNote()+'. Daily runs are always normal difficulty.';t.appendChild(p);}
 else if(hardOn()){const p=document.createElement('p');p.style.cssText='font-size:12px;color:#ffb0a4;line-height:1.35';p.innerHTML='<b>💀 Hard mode is on:</b><br>'+HARD_RULES.map(r=>'<b>'+r.n+'</b>: '+r.d).join('<br>');t.appendChild(p);}
 for(const k of Object.keys(CLS)){
  const C=CLS[k],b=document.createElement('button'),open=k==='warrior'||!!meta.unl[k];b.style.minHeight='120px';
  if(open){b.innerHTML='<b style="font-size:18px">'+C.e+' '+C.n+'</b><span>'+classBlurb(k)+'</span><span><br><i>'+C.kit.map(a=>ABIL[a].e+' '+ABIL[a].n+' ('+abCost(a)+')').join(' · ')+'</i></span>';b.addEventListener('click',function(){startRun(k,mode);});}
  else{const u=UNLOCKS.find(x=>x.id===k);b.disabled=true;b.innerHTML='<b style="font-size:18px">🔒 '+C.e+' '+C.n+'</b><span>Locked. Buy it under Upgrades on the title screen for <span class="gold">'+(u?u.cost:'?')+' 💰</span> (you have '+meta.gold+').</span>';}
  t.appendChild(b);
 }
 const bk=document.createElement('button');bk.className='c';bk.textContent='Back';bk.addEventListener('click',showTitle);t.appendChild(bk);
}
function hideTitle(){$('title').style.display='none';}
// Title screen: Continue / New run are the big primary buttons; everything else is a 2x2 grid of secondary screens.
function showTitle(keep){
 const t=$('titleBox'),st=keep?t.scrollTop:0;t.innerHTML='';
 const add=(tag,html,cls)=>{const e=document.createElement(tag);e.innerHTML=html;if(cls)e.className=cls;t.appendChild(e);return e;};
 add('h1','🗡 Depths of Emberfall');
 add('p','Descend '+MAXF+' floors. Slay the dragon. Die often, grow stronger.').style.textAlign='center';
 add('p','Banked gold: <span class="gold">'+meta.gold+' 💰</span> &nbsp; Best floor: '+meta.best+' &nbsp; Wins: '+meta.wins).style.textAlign='center';
 if(noticeOld)add('p','A run saved by an older version of the game could not be loaded and was discarded. Your gold, upgrades and unlocks are untouched.').style.cssText='font-size:13px;text-align:center;color:#ffd24a';
 const big=b=>{b.style.minHeight='60px';b.style.fontSize='18px';return b;};
 // starting a run over a saved one needs a second tap
 const guard=(b,label,fn)=>{b.addEventListener('click',function(){
  if(hasSave()&&!b.dataset.arm){b.dataset.arm=1;b.innerHTML='<b>Overwrite saved run? Tap again</b>';return;}
  fn();});};
 if(hasSave()){const b=big(add('button','Continue run','c'));b.id='btnContinue';b.addEventListener('click',continueRun);}
 const nb=big(add('button','New run','c'));nb.id='btnNew';guard(nb,'New run',function(){showClassPicker();});
 // Hard mode toggle (locked until the first win)
 const hb=add('button','');hb.id='hardBtn';
 if(!hardUnlocked()){hb.disabled=true;hb.className='c';hb.innerHTML='🔒 Hard mode &mdash; win a run to unlock';}
 else{
  const on=hardOn();hb.className='c';hb.innerHTML='💀 Hard mode: <b style="display:inline">'+(on?'ON':'OFF')+'</b><span style="display:block;font-size:12px">'+HARD_RULES.map(r=>r.n).join(' · ')+'</span>';
  if(on){hb.style.borderColor='#ff6a5a';hb.style.background='#4a1c24';}
  hb.addEventListener('click',function(){meta.hardOn=on?0:1;saveMeta();showTitle(1);});
 }
 const g=add('div','');g.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:8px';
 const cell=(id,html,fn)=>{const b=document.createElement('button');b.id=id;b.innerHTML=html;b.style.minHeight='64px';b.style.padding='6px 8px';b.addEventListener('click',fn);g.appendChild(b);return b;};
 const dnote=dailyNote();
 const db=cell('btnDaily','<b>📅 Daily</b><span style="font-size:12px">Today: '+dnote+'</span>',null);
 guard(db,'Daily',function(){showClassPicker({daily:true});});
 cell('btnRecords','<b>🏅 Records</b><span style="font-size:12px">'+meta.runs+' runs, '+meta.wins+' wins</span>',function(){showRecords();});
 cell('btnAch','<b>🏆 Achievements</b><span style="font-size:12px">'+ACH.filter(a=>meta.ach[a.id]).length+'/'+ACH.length+' earned</span>',function(){showAchievements();});
 cell('btnUpg','<b>🛒 Upgrades</b><span style="font-size:12px">Shop and unlocks</span>',function(){showUpgrades();});
 const g2=add('div','');g2.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:8px';
 const sb=document.createElement('button');sb.className='c';sb.textContent=soundLabel();sb.addEventListener('click',function(){toggleSound();sb.textContent=soundLabel();});g2.appendChild(sb);
 const cb=document.createElement('button');cb.className='c';cb.textContent='Controls';cb.addEventListener('click',function(){showHelp(closeModal);});g2.appendChild(cb);
 $('title').style.display='flex';
 if(keep)t.scrollTop=st;
}
// permanent upgrades and unlocks (the shop)
function showUpgrades(){
 const t=$('titleBox'),st=t.scrollTop;t.innerHTML='';
 const add=(tag,html,cls)=>{const e=document.createElement(tag);e.innerHTML=html;if(cls)e.className=cls;t.appendChild(e);return e;};
 add('h1','🛒 Upgrades');
 add('div','Banked gold: <span class="gold">'+meta.gold+' 💰</span>','row').style.justifyContent='center';
 add('h2','Permanent upgrades').style.fontSize='16px';
 for(const s of SHOP){
  const c=cost(s),lv=meta[s.k],maxed=lv>=shopMax(s);
  const b=add('button','<b>'+s.n+' (Lv '+Math.min(lv,shopMax(s))+'/'+shopMax(s)+')</b><span>'+s.d+' - '+(maxed?'MAXED':'<span class="gold">'+c+' 💰</span>')+'</span>');
  b.disabled=maxed||meta.gold<c;
  b.addEventListener('click',function(){if(meta[s.k]>=shopMax(s)||meta.gold<cost(s))return;meta.gold-=cost(s);meta[s.k]++;saveMeta();showUpgrades();});
 }
 add('h2','Unlocks').style.fontSize='16px';
 add('p','Buy these with banked gold. Locked perks only appear in the level-up pool once unlocked; the last four unlock by playing.').style.fontSize='13px';
 for(const u of UNLOCKS){
  const have=!!meta.unl[u.id];let sub,dis=true;
  if(have)sub='<span style="color:#6fd08c">✓ Unlocked</span>';
  else if(u.ach)sub='🔒 Locked - '+u.ach+' ('+u.prog()+')';
  else{sub='🔒 <span class="gold">'+u.cost+' 💰</span>';dis=meta.gold<u.cost;}
  const b=add('button','<b>'+u.n+'</b><span>'+u.d+'<br>'+sub+'</span>');b.disabled=dis;
  if(have){b.style.opacity='.85';b.style.borderColor='#2a8a5a';}
  if(!have&&!u.ach)b.addEventListener('click',function(){if(meta.unl[u.id]||meta.gold<u.cost)return;meta.gold-=u.cost;meta.unl[u.id]=1;saveMeta();showUpgrades();});
 }
 const bk=add('button','Back','c');bk.addEventListener('click',showTitle);
 t.scrollTop=st;
}
