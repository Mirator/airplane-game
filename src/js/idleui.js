// idleui.js - the idle screens, drawn into the title box: Expeditions (slots, send, report) and the Blueprints tab of the shop. Logic: idle.js.

let expTimer=null,expPick='warrior',expOpenAt=0;
// a screen that puts a commit button under the button that opened it ignores real taps for the dialog grace (and a tap that began before it opened)
function expBlocked(e){return !!(e&&e.isTrusted&&BAL.ui.modalGraceMs&&(performance.now()-expOpenAt<BAL.ui.modalGraceMs||(e.detail>0&&lastDown<expOpenAt)));}
function expLeave(){if(expTimer){clearInterval(expTimer);expTimer=null;}}
function expScreen(title,name){
 expLeave();
 const t=screenFrame(title);t.dataset.tab='';t.dataset.screen=name;t.dataset.screenName=name;
 return t;
}
function expAdd(t,tag,html,cls){const e=document.createElement(tag);e.innerHTML=html;if(cls)e.className=cls;t.appendChild(e);return e;}
function expBack(t,fn,label){const b=expAdd(t,'button',label||'Back','c');b.id='btnBack';b.dataset.esc='1';b.addEventListener('click',function(){expLeave();(fn||showTitle)();});return b;}
// the list of slots: an empty slot sends a hero, a running one counts down (Recall pays the part done), a finished one is collected
function showExpeditions(){
 if(meta.exp.rep){showExpReport(meta.exp.rep);return;}
 const t=expScreen('Expeditions','exp'),now=Date.now();
 expAdd(t,'p','Heroes bring back gold and blueprints while you are away.','sub');
 for(let i=0;i<2;i++){
  const rec=meta.exp.run[i],card=expAdd(t,'div','','xslot');card.dataset.slot=i;
  if(i===1&&!meta.exp.s2){
   const b=expAdd(card,'button',ic('lock',20)+' Second slot <span class="gold">'+BAL.exp.secondSlot+' '+ic('coin',14)+'</span>','c');b.id='btnSlot2';b.disabled=meta.gold<BAL.exp.secondSlot;
   b.addEventListener('click',function(){if(expBuySlot())showExpeditions();});
   continue;
  }
  if(!rec){
   const b=expAdd(card,'button',ic('map',22)+' Send a hero','c');b.dataset.send=i;b.style.minHeight='64px';
   b.addEventListener('click',function(){showExpSend(i);});
   continue;
  }
  const rdy=expReady(rec,now),left=expLeft(rec,now),pct=Math.min(100,100*expElapsed(rec,now)/rec.dur);
  expAdd(card,'div','<span class="hero">'+ic(CLS[rec.cls].e,40)+'</span><span class="xi"><b>'+CLS[rec.cls].n+' · '+expDur(rec.dur).n+'</b><span class="xt" data-left="'+i+'">'+(rdy?'Back home':'Back in '+fmtDur(left))+'</span></span>','xhead');
  expAdd(card,'div','<i style="width:'+pct+'%"></i>','xbar');
  const b=expAdd(card,'button',rdy?ic('check',22)+' Collect':'Recall now','c');b.dataset.collect=i;b.style.minHeight='56px';if(rdy)b.classList.add('go');
  b.addEventListener('click',function(){
   if(!rdy&&!b.dataset.arm){b.dataset.arm=1;b.textContent='Recall: pays '+expResult(rec,Date.now()).gold+'. Tap again';return;}   // a recall pays only the part done: say so first
   expCollect(i);showExpReport(meta.exp.rep);});
 }
 expBack(t,showTitle);
 $('title').style.display='flex';
 // the countdown text and bar follow the clock; nothing else is rewritten, and a slot turning ready redraws the screen once
 expTimer=setInterval(function(){
  if(!$('titleBox').querySelector('.xslot')){expLeave();return;}
  const n=Date.now();
  for(let i=0;i<2;i++){const r=meta.exp.run[i];if(!r)continue;
   if(expReady(r,n)&&!($('titleBox').querySelector('[data-collect="'+i+'"]')||{classList:{contains:()=>false}}).classList.contains('go')){showExpeditions();return;}
   const el=$('titleBox').querySelector('[data-left="'+i+'"]');const tx='Back in '+fmtDur(expLeft(r,n));if(el&&el.textContent!==tx&&!expReady(r,n))el.textContent=tx;}
 },1000);
}
function showExpSend(slot){
 const t=expScreen('Send a hero','send');expOpenAt=performance.now();
 expAdd(t,'p','Heroes go as deep as you have: floor '+expBest()+'.','sub').id='expGate';
 const open=Object.keys(CLS).filter(k=>k==='warrior'||meta.unl[k]);
 if(open.indexOf(expPick)<0)expPick=open[0];
 const row=expAdd(t,'div','','xcls');
 for(const k of open){
  const b=expAdd(row,'button',ic(CLS[k].e,34)+'<small>'+CLS[k].n+'</small>','c'+(k===expPick?' on':''));b.dataset.cls=k;b.setAttribute('aria-pressed',k===expPick?'true':'false');
  b.addEventListener('click',function(){expPick=k;showExpSend(slot);});
 }
 const pw=upSpent();
 for(const d of BAL.exp.durs){
  const b=expAdd(t,'button','<b>'+d.n+'</b><span>about <span class="gold">'+expEstimate(expPick,d.min,pw)+' '+ic('coin',13)+'</span>'+(d.hint?' · '+d.hint:'')+'</span>','c');
  b.dataset.dur=d.min;b.style.minHeight='60px';
  b.addEventListener('click',function(e){if(expBlocked(e))return;if(expSend(slot,expPick,d.min))showExpeditions();});
 }
 expBack(t,showExpeditions);
 $('title').style.display='flex';
}
function showExpReport(r){
 const t=expScreen('Expedition report','report'),C=CLS[r.cls]||CLS.warrior;
 expAdd(t,'div',ic(C.e,56),'portrait');
 expAdd(t,'p','<b>'+C.n+'</b> · '+(r.early?'recalled after '+fmtDur(r.el*60000):expDur(r.dur).n),'recap');
 expAdd(t,'div','<span>Deepest floor <b>'+(r.floor||'-')+'</b></span><span>Kills <b>'+r.kills+'</b></span><span>Delves <b>'+r.delves+'</b></span>','chips3');
 expAdd(t,'p','Gold <span class="gold" id="repGold">+'+r.gold+' '+ic('coin',16)+'</span>','recap');
 if(r.bp){const b=bpOf(r.bp);if(b)expAdd(t,'p',ic(bpIcon(b),24)+' Blueprint found: <b>'+b.n+'</b>','recap').id='repBp';}
 if(!r.delves)expAdd(t,'p',r.early?'Recalled before the first delve: nothing found.':'No delve this time.','sub');
 const d=expAdd(t,'button','Done','c');d.id='btnDone';d.style.minHeight='56px';
 d.addEventListener('click',function(){meta.exp.rep=null;saveMeta();showExpeditions();});
 $('title').style.display='flex';
}
// the Blueprints tab: found ones can be bought, bought ones are listed, the rest only as counts by where they drop
function bpTab(t,add){
 const c=bpCounts();
 add('p','Found <b>'+c.found+'</b>/'+c.total+' · Bought <b>'+c.unlocked+'</b>. Bought ones can drop in runs.','sub');
 const list=BPS.filter(b=>bpState(b.id)>=1).sort((a,b)=>bpState(a.id)-bpState(b.id)||'cbr'.indexOf(a.tier)-'cbr'.indexOf(b.tier));
 for(const b of list){
  const st=bpState(b.id),cost=BAL.bp.cost[b.tier];
  const inner='<b>'+b.n+'</b><span class="bpk">'+bpKind(b)+'</span><span>'+bpDesc(b)+(st===2?' · <span style="color:#6fd08c">Bought</span>':' <span class="nw">· <span class="gold">'+cost+' '+ic('coin',13)+'</span></span>')+'</span>';
  const el=add('button','<span class="chp">'+ic(bpIcon(b),28)+'</span><span class="ct">'+inner+'</span>','hasic');
  el.dataset.bp=b.id;el.dataset.state=st;
  if(st===2){el.disabled=true;el.style.opacity='.85';el.style.borderColor='#2a8a5a';}
  else{el.disabled=meta.gold<cost;el.addEventListener('click',function(){if(bpBuy(b.id))showUpgrades('bp');});}
 }
 for(const tier of ['c','r','b']){
  const n=BPS.filter(b=>b.tier===tier&&!bpState(b.id)).length;
  if(!n)continue;
  const d=add('div','<span class="chp">'+ic('lock',22)+'</span><span class="ct"><b>'+n+' not found</b><span>'+BP_SRC[tier]+'</span></span>','pl lockrow');d.dataset.locked=tier;
 }
}
