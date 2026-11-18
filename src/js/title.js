// title.js - title screen, class picker, permanent-upgrade shop and unlock list.

// class card: icon, name, one short line, the four ability icons. "Details" opens the numbers.
function showClassDetails(k,mode){
 const C=CLS[k];
 let h='<p class="sub">'+classDetail(k)+'</p>';
 for(const a of C.kit)h+='<div class="pl"><b>'+ABIL[a].e+' '+ABIL[a].n+'</b> <small>('+abCost(a)+')<br>'+abilityDesc(a)+'</small></div>';
 showModal(C.e+' '+C.n,h,[
  {k:'pick',label:'Play '+C.n,c:1,big:1,fn:function(){closeModal();startRun(k,mode);}},
  {label:'Back',c:1,fn:closeModal}
 ],'classinfo');
}
function showClassPicker(mode){
 mode=mode||{};
 const t=$('titleBox');t.innerHTML='';
 const h=document.createElement('h1');h.textContent=mode.daily?'📅 Daily: pick a class':'Pick a class';t.appendChild(h);
 if(mode.daily){const p=document.createElement('p');p.className='sub';p.textContent='Same dungeon for everyone today. Normal difficulty.';t.appendChild(p);}
 else if(hardUnlocked()){
  // Hard mode lives here, next to the choice it changes
  const on=hardOn(),hb=document.createElement('button');hb.id='hardBtn';hb.className='c'+(on?' hardon':'');
  hb.style.minHeight='44px';hb.innerHTML='💀 Hard mode: <b style="display:inline">'+(on?'ON':'OFF')+'</b>';
  hb.addEventListener('click',function(){meta.hardOn=on?0:1;saveMeta();showClassPicker(mode);});
  t.appendChild(hb);
  if(on){const p=document.createElement('p');p.className='sub';p.textContent=HARD_RULES.map(r=>r.n).join(' · ');t.appendChild(p);}
 }
 for(const k of Object.keys(CLS)){
  const C=CLS[k],open=k==='warrior'||!!meta.unl[k],row=document.createElement('div');row.className='cls';
  const b=document.createElement('button');b.className='clsmain';
  if(open){
   b.innerHTML='<b>'+C.e+' '+C.n+'</b><span>'+classBlurb(k)+'</span><span class="ab">'+C.kit.map(a=>'<i>'+ABIL[a].e+'<em>'+ABIL[a].n+'</em></i>').join('')+'</span>';
   b.addEventListener('click',function(){startRun(k,mode);});
   row.appendChild(b);
   const d=document.createElement('button');d.className='clsinfo c';d.innerHTML='ⓘ<small>Details</small>';d.setAttribute('aria-label',C.n+' details');
   d.addEventListener('click',function(){showClassDetails(k,mode);});row.appendChild(d);
  }else{
   const u=UNLOCKS.find(x=>x.id===k);b.disabled=true;
   b.innerHTML='<b>🔒 '+C.e+' '+C.n+'</b><span>Unlock in Upgrades: <span class="gold">'+(u?u.cost:'?')+' 💰</span> (you have '+meta.gold+')</span>';row.appendChild(b);
  }
  t.appendChild(row);
 }
 const bk=document.createElement('button');bk.className='c';bk.textContent='Back';bk.addEventListener('click',showTitle);t.appendChild(bk);
}
function hideTitle(){$('title').style.display='none';}
// Title screen: Continue / New run dominate; Daily and Upgrades beside "More" (Records, Achievements, Sound, Controls).
function showTitle(keep){
 const t=$('titleBox'),st=keep?t.scrollTop:0;t.innerHTML='';
 const add=(tag,html,cls)=>{const e=document.createElement(tag);e.innerHTML=html;if(cls)e.className=cls;t.appendChild(e);return e;};
 add('h1','🗡 Depths of Emberfall');
 add('p','Descend '+MAXF+' floors. Slay the dragon.','sub');
 if(noticeOld)add('p','An old run save could not be loaded. Gold and upgrades are safe.','sub').style.color='#ffd24a';
 const big=b=>{b.style.minHeight='60px';b.style.fontSize='18px';return b;};
 // starting a run over a saved one needs a second tap
 const guard=(b,label,fn)=>{b.addEventListener('click',function(){
  if(hasSave()&&!b.dataset.arm){b.dataset.arm=1;b.innerHTML='<b>Overwrite saved run? Tap again</b>';return;}
  fn();});};
 if(hasSave()){const b=big(add('button','Continue run','c'));b.id='btnContinue';b.addEventListener('click',continueRun);}
 const nb=big(add('button','New run','c'));nb.id='btnNew';guard(nb,'New run',function(){showClassPicker();});
 const g=add('div','');g.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px';
 const cell=(id,html,fn)=>{const b=document.createElement('button');b.id=id;b.className='c';b.innerHTML=html;b.style.minHeight='56px';b.style.padding='6px 4px';b.style.whiteSpace='nowrap';b.addEventListener('click',fn);g.appendChild(b);return b;};
 const db=cell('btnDaily','📅 Daily'+(meta.dly[todayKey()]?'<small style="display:block;font-size:11px">'+dailyNote()+'</small>':''),null);
 guard(db,'Daily',function(){showClassPicker({daily:true});});
 cell('btnUpg','🛒 Upgrades<small style="display:block;font-size:11px" class="gold">'+meta.gold+' 💰</small>',function(){showUpgrades();});
 cell('btnMore','More',function(){showMore();});
 $('title').style.display='flex';
 if(keep)t.scrollTop=st;
}
// the rarely used screens
function showMore(){
 const t=$('titleBox');t.innerHTML='';
 const add=(tag,html,cls)=>{const e=document.createElement(tag);e.innerHTML=html;if(cls)e.className=cls;t.appendChild(e);return e;};
 add('h1','More');
 const row=(id,html,fn)=>{const b=add('button',html,'c');b.id=id;b.addEventListener('click',fn);return b;};
 row('btnRecords','🏅 Records',function(){showRecords();});
 row('btnAch','🏆 Achievements <small>'+ACH.filter(a=>meta.ach[a.id]).length+'/'+ACH.length+'</small>',function(){showAchievements();});
 row('btnControls','Controls',function(){showHelp(closeModal);});
 const sb=row('btnSound',soundLabel(),function(){toggleSound();sb.textContent=soundLabel();});
 const bk=add('button','Back','c');bk.addEventListener('click',function(){showTitle();});
}
// permanent upgrades and unlocks (bought with banked gold)
function showUpgrades(){
 const t=$('titleBox'),st=t.scrollTop;t.innerHTML='';
 const add=(tag,html,cls)=>{const e=document.createElement(tag);e.innerHTML=html;if(cls)e.className=cls;t.appendChild(e);return e;};
 add('h1','🛒 Upgrades');
 add('div','You have <span class="gold">'+meta.gold+' 💰</span>','row').style.justifyContent='center';
 add('h2','Boosts').style.fontSize='16px';
 for(const s of SHOP){
  const c=cost(s),lv=meta[s.k],maxed=lv>=shopMax(s);
  const b=add('button','<b>'+s.n+' '+Math.min(lv,shopMax(s))+'/'+shopMax(s)+'</b><span>'+s.d+' · '+(maxed?'MAX':'<span class="gold">'+c+' 💰</span>')+'</span>');
  b.disabled=maxed||meta.gold<c;
  b.addEventListener('click',function(){if(meta[s.k]>=shopMax(s)||meta.gold<cost(s))return;meta.gold-=cost(s);meta[s.k]++;saveMeta();showUpgrades();});
 }
 add('h2','Unlocks').style.fontSize='16px';
 for(const u of UNLOCKS){
  const have=!!meta.unl[u.id];let sub,dis=true;
  if(have)sub='<span style="color:#6fd08c">✓ Unlocked</span>';
  else if(u.ach)sub='🔒 '+u.ach+' ('+u.prog()+')';
  else{sub='<span class="gold">'+u.cost+' 💰</span>';dis=meta.gold<u.cost;}
  const b=add('button','<b>'+u.n+'</b><span>'+u.d+' · '+sub+'</span>');b.disabled=dis;
  if(have){b.style.opacity='.85';b.style.borderColor='#2a8a5a';}
  if(!have&&!u.ach)b.addEventListener('click',function(){if(meta.unl[u.id]||meta.gold<u.cost)return;meta.gold-=u.cost;meta.unl[u.id]=1;saveMeta();showUpgrades();});
 }
 const bk=add('button','Back','c');bk.addEventListener('click',showTitle);
 t.scrollTop=st;
}
