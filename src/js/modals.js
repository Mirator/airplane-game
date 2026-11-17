// modals.js - generic modal plumbing plus perk-choice, menu, gear-compare and perk-list screens.

function afterModals(){if(!G||G.over)return;if(G.pending>0)showPerk();else if(gearQ)showGear();else if(shrineQ){shrineQ=false;showShrine();}}
function modalOpen(){return $('modal').style.display!=='none'||$('title').style.display!=='none';}
function showModal(title,html,buttons){
 armed=null;if(G&&G.p)updateBar();const b=$('modalBox');b.innerHTML='';
 const h=document.createElement('h2');h.textContent=title;b.appendChild(h);
 if(html){const d=document.createElement('div');d.innerHTML=html;d.style.display='flex';d.style.flexDirection='column';d.style.gap='8px';b.appendChild(d);}
 for(const bt of buttons){
  const el=document.createElement('button');if(bt.c)el.className='c';
  el.innerHTML=bt.html||bt.label;if(bt.off)el.disabled=true;if(bt.big){el.style.minHeight='60px';el.style.fontSize='18px';}
  el.addEventListener('click',function(e){e.stopPropagation();bt.fn(el);});
  b.appendChild(el);
 }
 $('modal').style.display='flex';
}
function closeModal(){$('modal').style.display='none';}
function perkTags(pk){
 let t='';
 if(pk.cls)t+='<em class="tag act">'+CLS[pk.cls].n.toUpperCase()+'</em>';else if(pk.beh)t+='<em class="tag">BEHAVIOUR</em>';
 if(SYN.some(s=>(s.a===pk.id&&pc(s.b))||(s.b===pk.id&&pc(s.a))))t+='<em class="tag syn">SYNERGY</em>';
 return t;
}
function showPerk(){
 if(!G||G.pending<=0)return;
 walkTok++;
 const pool=perkPool();
 if(!pool.length){G.pending=0;save();return;}
 const opts=pool.sort(()=>Math.random()-0.5).slice(0,meta.unl.pick4?4:3);
 showModal('Level '+G.p.lvl+'!','<p>Choose a perk:</p>',opts.map(pk=>{
  const c=pc(pk.id),lv=pk.max>1?(c>0?' Lv '+c+'→'+(c+1):' (max '+pk.max+')'):'';
  return {html:'<b>'+pk.n+lv+perkTags(pk)+'</b><span>'+pk.d+'</span>',fn:function(){
   addPerk(pk.id);G.pending--;closeModal();save();render();
   if(G.pending>0)showPerk();else afterModals();
  }};}));
}
// the equipment cards: one per slot, with what it does. full = also list the class abilities.
function slotLines(sl){
 const it=G.p.eq[sl];
 if(!it)return '<small>Empty</small>';
 const st=sl==='weapon'?'+'+it.v+' attack':sl==='armor'?'defense '+armorDef(it):sl==='off'?'modifies '+ABIL[OFF[it.k].ab].n:'passive charm';
 return '<small>'+st+'. '+itemRule(it)+(it.tr?'<br><b>'+TR[it.tr].n+'</b>: '+TR[it.tr].d:'')+'</small>';
}
function gearHtml(full){
 const p=G.p,C=clsOf(p);
 let h='<div class="pl"><b>'+C.e+' '+C.n+'</b> <small>('+C.res+')</small>'+(full?classKitHtml(p.cls,true):'<br><small>'+C.kit.map(k=>ABIL[k].n).join(' / ')+'</small>')+'</div>';
 for(const sl of SLOTS){const it=p.eq[sl];h+='<div class="pl"><small>'+SLOT_LABEL[sl].toUpperCase()+'</small><br><b>'+(it?itemIcon(it)+' ':'')+(it?gearName(it):'None')+'</b><br>'+slotLines(sl)+'</div>';}
 return h;
}
function showEquip(back){
 if(!G)return;
 showModal('Equipment',gearHtml(true),[{label:'Back',c:1,big:1,fn:function(){if(back)back();else closeModal();}}]);
}
function showPerks(back){
 let h=gearHtml(true);const own=PERKS.filter(pk=>pc(pk.id)>0);
 h+='<p><b>Perks</b></p>';
 if(!own.length)h+='<p>No perks yet. Level up to pick some.</p>';
 for(const pk of own)h+='<div class="pl"><b>'+pk.n+(pk.max>1?' ×'+pc(pk.id):'')+'</b>'+perkTags(pk)+'<br><small>'+pk.d+'</small></div>';
 h+='<p><b>Synergies</b></p>';
 for(const s of SYN){
  const on=pc(s.a)&&pc(s.b);
  h+='<div class="pl'+(on?'':' dim')+'"><b>'+(on?'★ ':'')+s.n+'</b> <small>('+perkById(s.a).n+' + '+perkById(s.b).n+')'+(on?' ACTIVE':'')+'<br>'+s.d+'</small></div>';
 }
 showModal('Equipment, perks & synergies',h,[{label:'Back',c:1,fn:function(){if(back)back();else closeModal();}}]);
}
function showMenu(){
 if(!G||G.over)return;walkTok++;
 const arm={v:false};
 showModal('Menu',gearHtml(false),[
  {label:'Resume',c:1,fn:closeModal},
  {label:'Equipment, perks & synergies',c:1,fn:function(){showPerks(showMenu);}},
  {label:'Controls',c:1,fn:function(){showHelp(showMenu);}},
  {label:soundLabel(),c:1,fn:function(el){toggleSound();el.textContent=soundLabel();}},
  {label:'Abandon run',c:1,fn:function(el){
   if(!arm.v){arm.v=true;el.textContent='Tap again to confirm (gold is banked)';return;}
   closeModal();finish('abandon');}}
 ]);
}
function showGear(){
 const it=gearQ;gearQ=null;
 if(!G||G.over||!it||G.items.indexOf(it)<0||it.x!==G.p.x||it.y!==G.p.y)return;
 walkTok++;
 const p=G.p,sl=it.t,cur=p.eq[sl],nn=gearName(it);
 const stat=x=>!x?'':sl==='weapon'?'+'+x.v+' attack':sl==='armor'?'defense '+armorDef(x):sl==='off'?'modifies '+ABIL[OFF[x.k].ab].n:'passive';
 const card=(lab,x,hl)=>'<div class="pl" style="border:2px solid '+(hl?'#ffd24a':'#4b5080')+';border-radius:10px;padding:8px"><small>'+lab+'</small><br><b>'+(x?itemIcon(x)+' '+gearName(x):'Nothing')+'</b><br><small>'+(x?stat(x)+'.<br>'+itemRule(x)+(x.tr?'<br><b>'+TR[x.tr].n+'</b>: '+TR[x.tr].d:''):'Empty slot.')+'</small></div>';
 const dl=gearDelta(it);
 const html='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+card('EQUIPPED',cur,false)+card('FOUND',it,true)+'</div>'+
  '<p style="text-align:center">If you equip it: <b>'+(dl.length?dl.join(', '):'no stat change (rules differ)')+'</b></p>';
 showModal(SLOT_LABEL[sl]+' found',html,[
  {label:'Equip',c:1,big:1,fn:function(){
   if(G.items.indexOf(it)<0){closeModal();return;}
   const old=equipItem(it);
   if(worthKeeping(old)){const on=gearName(old);it.k=old.k;it.v=old.v;it.tr=old.tr||null;msg('Equipped '+nn+'. You drop your '+on+'.');}
   else{G.items=G.items.filter(o=>o!==it);msg('Equipped '+nn+'.');}
   closeModal();save();render();
   if(G.pending>0)showPerk();}},
  {label:'Leave',c:1,big:1,fn:function(){msg('You leave the '+nn+' on the floor.');closeModal();render();}}
 ]);
}
