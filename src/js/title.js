// title.js - title screen, class picker, permanent-upgrade shop and unlock list.

// class card: icon, name, one short line, the four ability icons. "Details" opens the numbers.
function showClassDetails(k,mode){
 const C=CLS[k];
 let h='<p class="sub">'+classDetail(k)+'</p>';
 for(const a of C.kit)h+='<div class="pl"><b>'+ic(ABIL[a].e,22)+' '+ABIL[a].n+'</b> <small>('+abCost(a)+')<br>'+abilityDesc(a)+'</small></div>';
 showModal(C.n,h,[
  {k:'pick',label:'Play '+C.n,c:1,big:1,fn:function(){closeModal();startRun(k,mode);}},
  {esc:1,label:'Back',c:1,fn:closeModal}
 ],'classinfo',ic(C.e,34));
}
function showClassPicker(mode){
 mode=mode||{};
 const t=$('titleBox');t.innerHTML='';t.className='box pick';
 const h=document.createElement('h1');h.textContent=mode.daily?'Daily: pick a class':'Pick a class';t.appendChild(h);
 if(mode.daily){const p=document.createElement('p');p.className='sub';p.textContent='Same dungeon for everyone today. Normal difficulty.';t.appendChild(p);}
 else if(heatMax()>=1){
  // Heat lives here, next to the choice it changes: 0 = normal, 1 = tougher, each next one adds a rule. A level opens by winning at the one below.
  const lb=document.createElement('p');lb.id='heatLbl';lb.className='sub';lb.innerHTML='<b>Heat</b>: a harder dungeon pays more gold.';t.appendChild(lb);
  const row=document.createElement('div');row.id='heatRow';row.className='heat';
  const hs=heatSel(),p=document.createElement('div');p.id='heatInfo';p.className='sub';
  const lockWhy=h=>h===heatMax()+1?'Win a run at Heat '+heatMax()+' to unlock Heat '+h+'.':'Unlock Heat '+(h-1)+' first.';
  for(let h=0;h<=BAL.heat.max;h++){
   const lk=h>heatMax(),b=document.createElement('button');b.className='c'+(h===hs?' on':'')+(lk?' locked':'');b.dataset.heat=h;
   b.innerHTML=lk?ic('lock',16):'<b>'+h+'</b>';b.setAttribute('aria-label','Heat '+h+(lk?' (locked)':''));if(lk)b.setAttribute('aria-disabled','true');
   b.addEventListener('click',function(){
    if(lk){p.innerHTML='<b>Heat '+h+' is locked.</b> '+lockWhy(h);return;}   // a lock says why it is locked (no screen rebuild)
    meta.heatSel=h;saveMeta();showClassPicker(mode);});
   row.appendChild(b);
  }
  t.appendChild(row);
  // every rule that is active at the selected level, one short line each
  let hh='<b>Heat '+hs+(hs?' · '+HEAT[hs].n:' · Normal')+'</b>, gold ×'+heatGold(hs);
  if(!hs)hh+='<br>The standard dungeon.';
  else{hh+='<br>Heat 1: '+HARD_RULES.slice(0,3).map(r=>r.n.toLowerCase()).join(', ')+'.';for(let i=2;i<=hs;i++)hh+='<br>'+HEAT[i].n+': '+HEAT[i].d;}
  if(heatMax()<BAL.heat.max)hh+='<br><em>Locked: win a run at Heat '+heatMax()+' for Heat '+(heatMax()+1)+'.</em>';
  p.innerHTML=hh;t.appendChild(p);
 }
 for(const k of ['warrior','rogue','mage']){   // the cheaper unlock first
  const C=CLS[k],open=k==='warrior'||!!meta.unl[k],row=document.createElement('div');row.className='cls';
  const b=document.createElement('button');b.className='clsmain';
  if(open){
   b.innerHTML='<span class="hero">'+ic(C.e,52)+'</span><b>'+C.n+'</b><span>'+classBlurb(k)+'</span><span class="ab">'+C.kit.map(a=>'<i>'+ic(ABIL[a].e,26)+'<em>'+ABIL[a].n+'</em></i>').join('')+'</span>';
   b.addEventListener('click',function(){startRun(k,mode);});
   row.appendChild(b);
   const d=document.createElement('button');d.className='clsinfo c';d.innerHTML=ic('info',22)+'<small>Details</small>';d.setAttribute('aria-label',C.n+' details');
   d.addEventListener('click',function(){showClassDetails(k,mode);});row.appendChild(d);
  }else{
   const u=UNLOCKS.find(x=>x.id===k);b.disabled=true;
   b.innerHTML='<b>'+ic('lock',18)+' '+C.n+'</b><span>Unlock in Upgrades: <span class="gold">'+(u?u.cost:'?')+' '+ic('coin',14)+'</span> (you have '+meta.gold+')</span>';row.appendChild(b);
  }
  t.appendChild(row);
 }
 const bk=document.createElement('button');bk.className='c';bk.textContent='Back';bk.dataset.esc='1';bk.addEventListener('click',showTitle);t.appendChild(bk);
}
function hideTitle(){{const a=document.activeElement;if(a&&a!==document.body&&$('titleBox').contains(a))a.blur();}$('title').style.display='none';}
// Title screen: Continue / New run dominate; Daily and Upgrades beside "More" (Records, Achievements, Sound, Controls).
function showTitle(keep){
 const t=$('titleBox'),st=keep?t.scrollTop:0;t.innerHTML='';t.className='box home';document.body.classList.remove('inrun');inRunCls=false;
 const add=(tag,html,cls)=>{const e=document.createElement(tag);e.innerHTML=html;if(cls)e.className=cls;t.appendChild(e);return e;};
 add('div',titleLogo(),'logo');add('h1','Depths of Emberfall');
 add('p','Descend '+MAXF+' floors. Slay the dragon.','sub');
 if(noticeOld)add('p','An old run save could not be loaded. Gold and upgrades are safe.','sub').style.color='#ffd24a';
 const big=b=>{b.style.minHeight='60px';b.style.fontSize='18px';return b;};
 // starting a run over a saved one needs a second tap
 const guard=(b,label,fn)=>{b.addEventListener('click',function(){
  if(hasSave()&&!b.dataset.arm){b.dataset.arm=1;b.innerHTML='<b>Overwrite saved run? Tap again</b>';return;}
  fn();});};
 if(hasSave()){const b=big(add('button','Continue run','c'));b.id='btnContinue';b.addEventListener('click',continueRun);}
 const nb=big(add('button','New run','c'));nb.id='btnNew';guard(nb,'New run',function(){showClassPicker();});
 {const nr=expReadyCount(),na=expActive();
  const eb=big(add('button',ic('map',22)+' Expeditions'+(nr?'<i class="pill rdy">'+(nr>1?nr+' ready':'Ready')+'</i>':na?'<i class="pill">'+expPill()+'</i>':''),'c'));
  eb.id='btnExp';eb.style.position='relative';eb.addEventListener('click',function(){showExpeditions();});}
 expPillTick();
 const g=add('div','');g.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px';
 const cell=(id,html,fn)=>{const b=document.createElement('button');b.id=id;b.className='c';b.innerHTML=html;b.classList.add('tri');b.addEventListener('click',fn);g.appendChild(b);return b;};
 const db=cell('btnDaily',ic('cal',22)+'<span class="tl">Daily</span>'+(meta.dly[todayKey()]?'<small style="display:block;font-size:11px">'+dailyNote()+'</small>':''),null);
 guard(db,'Daily',function(){showClassPicker({daily:true});});
 cell('btnUpg',ic('cart',22)+'<span class="tl">Upgrades</span><i class="pill gold">'+meta.gold+' '+ic('coin',12)+'</i>',function(){showUpgrades();});
 cell('btnMore',ic('menu',22)+'<span class="tl">More</span>',function(){showMore();});
 $('title').style.display='flex';
 if(keep)t.scrollTop=st;
}
// the time left on the title's Expeditions button: the shortest running trip. It follows the clock while the title stays open (one timer, gone when the screen changes).
function expPill(){const l=meta.exp.run.filter(Boolean).map(r=>expLeft(r,Date.now()));return l.length?fmtDur(Math.min(...l)):'';}
let pillTimer=null;
function expPillTick(){
 if(pillTimer){clearInterval(pillTimer);pillTimer=null;}
 if(!expActive())return;
 pillTimer=setInterval(function(){
  const b=$('btnExp');
  if(!b||!b.isConnected||$('title').style.display==='none'||b.parentNode!==$('titleBox')){clearInterval(pillTimer);pillTimer=null;return;}
  const nr=expReadyCount(),pl=b.querySelector('.pill'),rdy=pl&&pl.classList.contains('rdy');
  if(nr&&!rdy||!nr&&rdy){showTitle(true);return;}
  if(pl&&!nr){const tx=expPill();if(pl.textContent!==tx)pl.textContent=tx;}
 },1000);
}
// the rarely used screens
function showMore(){
 const t=$('titleBox');t.innerHTML='';t.className='box';
 const add=(tag,html,cls)=>{const e=document.createElement(tag);e.innerHTML=html;if(cls)e.className=cls;t.appendChild(e);return e;};
 add('h1','More');
 const row=(id,html,fn)=>{const b=add('button',html,'c');b.id=id;b.addEventListener('click',fn);return b;};
 row('btnRecords',ic('medal',20)+' Records',function(){showRecords();});
 row('btnAch',ic('trophy',20)+' Achievements <small>'+ACH.filter(a=>meta.ach[a.id]).length+'/'+ACH.length+'</small>',function(){showAchievements();});
 row('btnControls',ic('info',20)+' Controls',function(){showHelp(closeModal);});
 const sb=row('btnSound',ic('snd',20)+' '+soundLabel(),function(){toggleSound();sb.innerHTML=ic('snd',20)+' '+soundLabel();});
 const rb=row('btnReset',ic('x',20)+' Reset all progress',showResetAsk);rb.classList.add('danger');rb.style.marginTop='10px';
 const bk=add('button','Back','c');bk.dataset.esc='1';bk.addEventListener('click',function(){showTitle();});
}
// reset: two deliberate steps. Step 1 asks (Cancel is the big default), step 2 asks again with the red button at the TOP and Cancel at the bottom.
function showResetAsk(){
 showModal('Reset all progress?','<p class="sub">Gold, upgrades, blueprints, unlocked classes and Heat, records, achievements, settings, running expeditions and your saved run are lost.</p>',[
  {k:'cancel',esc:1,def:1,label:'Cancel',c:1,cls:'keep',fn:closeModal},
  {k:'reset1',label:'Erase everything...',c:1,cls:'danger',fn:function(){closeModal();showResetSure();}}
 ],'reset');
 $('modalBox').classList.add('reset');
}
function showResetSure(){
 showModal('Really erase everything?','<p class="sub">This cannot be undone.</p>',[
  {k:'reset2',label:'Yes, erase all progress',c:1,cls:'danger',fn:function(el){
   for(const b of $('modalBox').querySelectorAll('button'))b.disabled=true;   // no Cancel while the erase runs
   wipeAll(function(){closeModal();noticeOld=false;showTitle();});}},
  {k:'cancel',esc:1,def:1,label:'Cancel',c:1,cls:'keep',fn:closeModal}
 ],'reset');
 $('modalBox').classList.add('reset');
}
// permanent upgrades and unlocks (bought with banked gold): tab Upgrades (levels, either/or pairs, unlocks) and tab Blueprints (idleui.js)
function shopTabs(t,tab){
 const row=document.createElement('div');row.className='tabs';
 const mk=(id,label,k)=>{const b=document.createElement('button');b.id=id;b.className='c'+(tab===k?' on':'');b.textContent=label;b.setAttribute('aria-pressed',tab===k?'true':'false');b.addEventListener('click',function(){showUpgrades(k);});row.appendChild(b);};
 mk('tabUpg','Upgrades','upg');mk('tabBp','Blueprints '+bpCounts().found+'/'+BPS.length,'bp');
 t.appendChild(row);
}
function showUpgrades(tab){
 tab=tab==='bp'?'bp':'upg';
 const t=$('titleBox'),st=t.dataset.tab===tab?t.scrollTop:0;t.innerHTML='';t.className='box';t.dataset.tab=tab;
 const add=(tag,html,cls)=>{const e=document.createElement(tag);e.innerHTML=html;if(cls)e.className=cls;t.appendChild(e);return e;};
 add('h1','Upgrades');
 shopTabs(t,tab);
 add('div','You have <span class="gold">'+meta.gold+' '+ic('coin',16)+'</span>','row').style.justifyContent='center';
 if(tab==='bp')bpTab(t,add);
 else{
 add('h2','Boosts').style.fontSize='16px';
 for(const u of UPG){
  const lv=upLvl(u.k),mx=upMax(u),c=upNext(u),maxed=lv>=mx;
  const b=add('button',cardHtml(u.k,'<b>'+u.n+' '+lv+'/'+mx+'</b><span>'+upText(u)+(maxed?'':' <span class="nw">· <span class="gold">'+c+' '+ic('coin',13)+'</span></span>')+'</span>'),'hasic');
  b.dataset.up=u.k;b.disabled=maxed||meta.gold<c;
  b.addEventListener('click',function(){if(upBuy(u.k))showUpgrades('upg');});
 }
 add('h2','Either / or').style.fontSize='16px';
 for(const q of PAIRS){
  const lv=upLvl(q.k),mx=q.max,c=upNext(q),maxed=lv>=mx,va=pairVar(q),other=q.v[meta.pv[q.k]===1?0:1],fee=pairFee(q);
  const row=add('div','','pair');row.dataset.pair=q.k;
  const b=document.createElement('button');b.className='hasic';b.dataset.up=q.k;
  b.innerHTML=cardHtml(q.k,'<b>'+q.n+': '+va.n+' '+lv+'/'+mx+'</b><span>'+upText(q)+(maxed?'':' <span class="nw">· <span class="gold">'+c+' '+ic('coin',13)+'</span></span>')+'</span>');
  b.style.minHeight='64px';b.disabled=maxed||meta.gold<c;
  b.addEventListener('click',function(){if(upBuy(q.k))showUpgrades('upg');});
  row.appendChild(b);
  const sw=document.createElement('button');sw.className='c swap';sw.dataset.swap=q.k;sw.disabled=meta.gold<fee;
  sw.innerHTML=ic('reload',20)+'<small>'+other.n+'</small>'+(fee?'<small class="gold">'+fee+' '+ic('coin',11)+'</small>':'<small>free</small>');
  sw.setAttribute('aria-label','Switch '+q.n+' to '+other.n+(fee?' for '+fee+' gold':''));
  sw.style.width='76px';sw.style.minWidth='76px';
  sw.addEventListener('click',function(){
   // a swap that costs gold needs a second tap on the same button (a free one does not)
   if(fee>0&&!sw.dataset.arm){sw.dataset.arm='1';sw.innerHTML=ic('reload',20)+'<small>Tap again</small><small class="gold">'+fee+' '+ic('coin',11)+'</small>';sw.setAttribute('aria-label','Tap again to switch '+q.n+' to '+other.n+' for '+fee+' gold');sw.classList.add('armed');return;}
   if(pairSwitch(q.k))showUpgrades('upg');});
  row.appendChild(sw);
  const od=document.createElement('small');od.className='pdesc';od.dataset.other=q.k;od.textContent='Swap: '+pairPer(q,other)+(fee?'':' (free now)');row.appendChild(od);
 }
 add('h2','Unlocks').style.fontSize='16px';
 for(const u of UNLOCKS){
  const have=!!meta.unl[u.id];let sub,dis=true;
  if(have)sub='<span style="color:#6fd08c">Unlocked</span>';
  else if(u.ach)sub=ic('lock',13)+' '+u.ach+' ('+u.prog()+')';
  else{sub='<span class="gold">'+u.cost+' '+ic('coin',13)+'</span>';dis=meta.gold<u.cost;}
  const b=add('button',cardHtml(u.id,'<b>'+u.n+'</b><span>'+u.d+' · '+sub+'</span>'),'hasic');b.disabled=dis;
  if(have){b.style.opacity='.85';b.style.borderColor='#2a8a5a';}
  if(!have&&!u.ach)b.addEventListener('click',function(){if(meta.unl[u.id]||meta.gold<u.cost)return;meta.gold-=u.cost;meta.unl[u.id]=1;saveMeta();showUpgrades('upg');});
 }
 }
 const bk=add('button','Back','c');bk.id='btnBack';bk.dataset.esc='1';bk.addEventListener('click',showTitle);
 t.scrollTop=st;
}

// title scene: flat vector night sky, moon, tower on the hill, a dragon over it and rising embers (no image files)
function titleLogo(){
 const em=[[30,156,2.4],[58,130,1.8],[92,164,2.2],[268,152,2.6],[296,130,1.8],[250,172,2],[170,124,1.6],[130,148,1.8],[214,160,2.2],[110,90,1.6],[300,70,1.8]].map(a=>'<circle cx="'+a[0]+'" cy="'+a[1]+'" r="'+a[2]+'" fill="#ff9a3a" opacity=".85"/>').join('');
 const stars=[[20,20],[60,34],[100,14],[150,26],[40,70],[84,54],[190,12],[286,22],[300,48]].map(a=>'<circle cx="'+a[0]+'" cy="'+a[1]+'" r="1.2" fill="#dfe6ff" opacity=".6"/>').join('');
 return '<svg class="scene" viewBox="0 0 320 210" aria-hidden="true" focusable="false">'+stars+
  '<circle cx="232" cy="64" r="56" fill="#ff9a3a" opacity=".1"/><circle cx="232" cy="64" r="34" fill="#efe8d2"/><circle cx="222" cy="56" r="6" fill="#d9d0b4"/><circle cx="243" cy="76" r="4" fill="#d9d0b4"/>'+
  '<g transform="translate(0 60)"><path d="M0 110 L40 80 L74 100 L118 62 L160 96 L206 70 L252 98 L292 76 L320 94 L320 150 L0 150z" fill="#23284d"/>'+
  '<path d="M0 124 L50 106 L110 120 L170 100 L240 118 L320 104 L320 150 L0 150z" fill="#161a36"/>'+
  '<g fill="#0c0e1f"><rect x="136" y="64" width="48" height="62"/><rect x="128" y="52" width="16" height="74"/><rect x="176" y="48" width="16" height="78"/><path d="M126 52 L136 34 L146 52z"/><path d="M174 48 L184 28 L194 48z"/><rect x="136" y="58" width="6" height="8"/><rect x="148" y="58" width="6" height="8"/><rect x="160" y="58" width="6" height="8"/><rect x="172" y="58" width="6" height="8"/></g>'+
  '<g fill="#ffc93c"><rect x="133" y="76" width="6" height="10" rx="3"/><rect x="181" y="72" width="6" height="10" rx="3"/><rect x="154" y="98" width="12" height="16" rx="6"/><rect x="156" y="82" width="8" height="8" rx="2"/></g>'+
  '<path d="M0 134 Q80 122 160 136 Q240 124 320 134 L320 150 L0 150z" fill="#0a0b18"/></g>'+
  '<g transform="translate(150 6) scale(1.62)">'+svgInner('dragon')+'</g>'+em+'</svg>';
}
