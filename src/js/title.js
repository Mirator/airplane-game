// title.js - title screen, class picker, permanent-upgrade shop and unlock list.

// class card: icon, name, one short line, the four ability icons. "Details" opens the numbers.
function showClassDetails(k,mode){
 const C=CLS[k];
 let h='<p class="sub">'+classDetail(k)+'</p>';
 for(const a of C.kit)h+='<div class="pl"><b>'+ic(ABIL[a].e,22)+' '+ABIL[a].n+'</b> <small>('+abCost(a)+')<br>'+abilityDesc(a)+'</small></div>';
 showModal(C.n,h,[
  {k:'pick',label:'Play '+C.n,c:1,big:1,fn:function(){closeModal();startRun(k,mode);}},
  {label:'Back',c:1,fn:closeModal}
 ],'classinfo',ic(C.e,34));
}
function showClassPicker(mode){
 mode=mode||{};
 const t=$('titleBox');t.innerHTML='';
 const h=document.createElement('h1');h.textContent=mode.daily?'Daily: pick a class':'Pick a class';t.appendChild(h);
 if(mode.daily){const p=document.createElement('p');p.className='sub';p.textContent='Same dungeon for everyone today. Normal difficulty.';t.appendChild(p);}
 else if(heatMax()>=1){
  // Heat lives here, next to the choice it changes: 0 = normal, 1 = Hard, each next one adds a rule. A level opens by winning at the one below.
  const row=document.createElement('div');row.id='heatRow';row.className='heat';
  const hs=heatSel();
  for(let h=0;h<=BAL.heat.max;h++){
   const b=document.createElement('button');b.className='c'+(h===hs?' on':'');b.dataset.heat=h;b.disabled=h>heatMax();
   b.innerHTML=h>heatMax()?ic('lock',16):'<b>'+h+'</b>';b.setAttribute('aria-label','Heat '+h+(h>heatMax()?' (locked)':''));
   b.addEventListener('click',function(){meta.heatSel=h;saveMeta();showClassPicker(mode);});
   row.appendChild(b);
  }
  t.appendChild(row);
  const p=document.createElement('p');p.id='heatInfo';p.className='sub';
  p.innerHTML=hs>0?'<b>Heat '+hs+' · '+HEAT[hs].n+'</b>: '+HEAT[hs].d+' Gold ×'+heatGold(hs)+'.':'<b>Heat 0</b>: the standard dungeon. Win to climb.';
  t.appendChild(p);
 }
 for(const k of Object.keys(CLS)){
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
 const bk=document.createElement('button');bk.className='c';bk.textContent='Back';bk.addEventListener('click',showTitle);t.appendChild(bk);
}
function hideTitle(){$('title').style.display='none';}
// Title screen: Continue / New run dominate; Daily and Upgrades beside "More" (Records, Achievements, Sound, Controls).
function showTitle(keep){
 const t=$('titleBox'),st=keep?t.scrollTop:0;t.innerHTML='';
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
  const eb=big(add('button',ic('map',22)+' Expeditions'+(nr?'<i class="pill rdy">'+(nr>1?nr+' ready':'Ready')+'</i>':na?'<i class="pill">'+fmtDur(Math.min(...meta.exp.run.filter(Boolean).map(r=>r.t0+r.dur*60000-Date.now())))+'</i>':''),'c'));
  eb.id='btnExp';eb.style.position='relative';eb.addEventListener('click',function(){showExpeditions();});}
 const g=add('div','');g.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px';
 const cell=(id,html,fn)=>{const b=document.createElement('button');b.id=id;b.className='c';b.innerHTML=html;b.classList.add('tri');b.addEventListener('click',fn);g.appendChild(b);return b;};
 const db=cell('btnDaily',ic('cal',22)+'<span class="tl">Daily</span>'+(meta.dly[todayKey()]?'<small style="display:block;font-size:11px">'+dailyNote()+'</small>':''),null);
 guard(db,'Daily',function(){showClassPicker({daily:true});});
 cell('btnUpg',ic('cart',22)+'<span class="tl">Upgrades</span><i class="pill gold">'+meta.gold+' '+ic('coin',12)+'</i>',function(){showUpgrades();});
 cell('btnMore',ic('menu',22)+'<span class="tl">More</span>',function(){showMore();});
 $('title').style.display='flex';
 if(keep)t.scrollTop=st;
}
// the rarely used screens
function showMore(){
 const t=$('titleBox');t.innerHTML='';
 const add=(tag,html,cls)=>{const e=document.createElement(tag);e.innerHTML=html;if(cls)e.className=cls;t.appendChild(e);return e;};
 add('h1','More');
 const row=(id,html,fn)=>{const b=add('button',html,'c');b.id=id;b.addEventListener('click',fn);return b;};
 row('btnRecords',ic('medal',20)+' Records',function(){showRecords();});
 row('btnAch',ic('trophy',20)+' Achievements <small>'+ACH.filter(a=>meta.ach[a.id]).length+'/'+ACH.length+'</small>',function(){showAchievements();});
 row('btnControls',ic('info',20)+' Controls',function(){showHelp(closeModal);});
 const sb=row('btnSound',ic('snd',20)+' '+soundLabel(),function(){toggleSound();sb.innerHTML=ic('snd',20)+' '+soundLabel();});
 const bk=add('button','Back','c');bk.addEventListener('click',function(){showTitle();});
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
 const t=$('titleBox'),st=t.dataset.tab===tab?t.scrollTop:0;t.innerHTML='';t.dataset.tab=tab;
 const add=(tag,html,cls)=>{const e=document.createElement(tag);e.innerHTML=html;if(cls)e.className=cls;t.appendChild(e);return e;};
 add('h1','Upgrades');
 shopTabs(t,tab);
 add('div','You have <span class="gold">'+meta.gold+' '+ic('coin',16)+'</span>','row').style.justifyContent='center';
 if(tab==='bp')bpTab(t,add);
 else{
 add('h2','Boosts').style.fontSize='16px';
 for(const u of UPG){
  const lv=upLvl(u.k),mx=upMax(u),c=upNext(u),maxed=lv>=mx;
  const b=add('button',cardHtml(u.k,'<b>'+u.n+' '+lv+'/'+mx+'</b><span>'+upText(u)+(maxed?'':' · <span class="gold">'+c+' '+ic('coin',13)+'</span>')+'</span>'),'hasic');
  b.dataset.up=u.k;b.disabled=maxed||meta.gold<c;
  b.addEventListener('click',function(){if(upBuy(u.k))showUpgrades('upg');});
 }
 add('h2','Either / or').style.fontSize='16px';
 for(const q of PAIRS){
  const lv=upLvl(q.k),mx=q.max,c=upNext(q),maxed=lv>=mx,va=pairVar(q),other=q.v[meta.pv[q.k]===1?0:1],fee=pairFee(q);
  const row=add('div','','pair');row.dataset.pair=q.k;
  const b=document.createElement('button');b.className='hasic';b.dataset.up=q.k;
  b.innerHTML=cardHtml(q.k,'<b>'+q.n+': '+va.n+' '+lv+'/'+mx+'</b><span>'+upText(q)+(maxed?'':' · <span class="gold">'+c+' '+ic('coin',13)+'</span>')+'</span>');
  b.style.minHeight='64px';b.disabled=maxed||meta.gold<c;
  b.addEventListener('click',function(){if(upBuy(q.k))showUpgrades('upg');});
  row.appendChild(b);
  const sw=document.createElement('button');sw.className='c swap';sw.dataset.swap=q.k;sw.disabled=meta.gold<fee;
  sw.innerHTML=ic('reload',20)+'<small>'+other.n+'</small>'+(fee?'<small class="gold">'+fee+' '+ic('coin',11)+'</small>':'<small>free</small>');
  sw.setAttribute('aria-label','Switch '+q.n+' to '+other.n+(fee?' for '+fee+' gold':''));
  sw.style.width='76px';sw.style.minWidth='76px';
  sw.addEventListener('click',function(){if(pairSwitch(q.k))showUpgrades('upg');});
  row.appendChild(sw);
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
 const bk=add('button','Back','c');bk.id='btnBack';bk.addEventListener('click',showTitle);
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
