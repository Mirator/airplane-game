// modals.js - generic modal plumbing plus perk-choice, menu, gear-compare and perk-list screens.

function afterModals(){if(!G||G.over)return;if(G.pending>0)showPerk();else if(gearQ)showGear();else if(shrineQ){shrineQ=false;showShrine();}}
function modalOpen(){return $('modal').style.display!=='none'||$('title').style.display!=='none';}
// kind + button.k are plain labels (data attributes) so Auto can tell dialogs and choices apart without parsing text
function showModal(title,html,buttons,kind){
 armed=null;if(G&&G.p)updateBar();const b=$('modalBox');b.innerHTML='';b.dataset.kind=kind||'';
 const h=document.createElement('h2');h.textContent=title;b.appendChild(h);
 if(html){const d=document.createElement('div');d.innerHTML=html;d.style.display='flex';d.style.flexDirection='column';d.style.gap='8px';b.appendChild(d);}
 for(const bt of buttons){
  const el=document.createElement('button');if(bt.c)el.className='c';if(bt.k)el.dataset.k=bt.k;
  el.innerHTML=bt.html||bt.label;if(bt.off)el.disabled=true;if(bt.big){el.style.minHeight='60px';el.style.fontSize='18px';}
  el.addEventListener('click',function(e){e.stopPropagation();bt.fn(el);});
  b.appendChild(el);
 }
 $('modal').style.display='flex';
}
function closeModal(){$('modal').style.display='none';}
function perkTags(pk){
 let t='';
 if(pk.cls)t+='<em class="tag act">'+CLS[pk.cls].n.toUpperCase()+'</em>';
 if(SYN.some(s=>(s.a===pk.id&&pc(s.b))||(s.b===pk.id&&pc(s.a))))t+='<em class="tag syn">SYNERGY</em>';
 return t;
}
function showPerk(){
 if(!G||G.pending<=0)return;
 walkTok++;
 const pool=perkPool();
 if(!pool.length){G.pending=0;save();return;}
 const opts=pool.sort(()=>rf()-0.5).slice(0,meta.unl.pick4?4:3);
 showModal('Level '+G.p.lvl+': pick a perk','',opts.map(pk=>{
  const c=pc(pk.id),lv=pk.max>1?(c>0?' Lv '+c+'→'+(c+1):' (max '+pk.max+')'):'';
  return {k:pk.id,html:'<b>'+pk.n+lv+perkTags(pk)+'</b><span>'+pk.d+'</span>',fn:function(){
   addPerk(pk.id);G.pending--;closeModal();save();render();
   if(G.pending>0)showPerk();else afterModals();
  }};}),'perk');
}
// equipment card: icon + name, then one short line of what it does
function slotLines(sl){
 const it=G.p.eq[sl];
 if(!it)return '<small>Empty</small>';
 const st=sl==='weapon'?'+'+it.v+' attack · ':sl==='armor'?'Defense '+armorDef(it)+' · ':'';
 return '<small>'+st+itemRule(it)+(it.tr?'<br><b>'+TR[it.tr].n+'</b>: '+TR[it.tr].d:'')+'</small>';
}
function statStrip(){
 const p=G.p;
 return '<div class="stripe"><span>⚔️ '+meleeAtk()+'</span><span>🛡 '+defTotal()+'</span><span>Lv '+p.lvl+' <small>'+p.xp+'/'+needXp(p.lvl)+' XP</small></span></div>';
}
function gearHtml(){
 let h=statStrip();
 for(const sl of SLOTS){const it=G.p.eq[sl];h+='<div class="pl"><small>'+SLOT_LABEL[sl].toUpperCase()+'</small> <b>'+(it?itemIcon(it)+' '+gearName(it):'None')+'</b><br>'+slotLines(sl)+'</div>';}
 return h;
}
function showEquip(back){
 if(!G)return;
 const again=function(){showEquip(back);};
 showModal('Equipment',gearHtml(),[
  {k:'abil',label:'Abilities',c:1,fn:function(){showAbilities(again);}},
  {k:'perks',label:'Perks',c:1,fn:function(){showPerks(again);}},
  {label:'Back',c:1,big:1,fn:function(){if(back)back();else closeModal();}}]);
}
function showAbilities(back){
 const C=clsOf(G.p);
 let h='';for(const k of C.kit){const a=ABIL[k];h+='<div class="pl"><b>'+a.e+' '+a.n+'</b> <small>('+abCost(k)+')<br>'+abilityDesc(k)+'</small></div>';}
 showModal(C.e+' '+C.n,h,[{label:'Back',c:1,big:1,fn:function(){if(back)back();else closeModal();}}]);
}
function showPerks(back){
 let h='';const own=PERKS.filter(pk=>pc(pk.id)>0);
 if(!own.length)h+='<p class="sub">No perks yet. Level up to pick one.</p>';
 for(const pk of own)h+='<div class="pl"><b>'+pk.n+(pk.max>1?' ×'+pc(pk.id):'')+'</b>'+perkTags(pk)+'<br><small>'+pk.d+'</small></div>';
 h+='<p><b>Synergies</b></p>';
 for(const s of SYN){
  const on=pc(s.a)&&pc(s.b);
  h+='<div class="pl'+(on?'':' dim')+'"><b>'+(on?'★ ':'')+s.n+'</b> <small>('+perkById(s.a).n+' + '+perkById(s.b).n+')<br>'+s.d+'</small></div>';
 }
 showModal('Perks',h,[{label:'Back',c:1,big:1,fn:function(){if(back)back();else closeModal();}}]);
}
function showMenu(){
 if(!G||G.over)return;walkTok++;
 const arm={v:false};
 showModal('Menu','',[
  {label:'Resume',c:1,big:1,fn:closeModal},
  {k:'auto',label:'🤖 Auto play',c:1,fn:function(){closeModal();autoStart();}},
  {label:'Perks',c:1,fn:function(){showPerks(showMenu);}},
  {label:'Controls',c:1,fn:function(){showHelp(showMenu);}},
  {label:soundLabel(),c:1,fn:function(el){toggleSound();el.textContent=soundLabel();}},
  {label:'Abandon run',c:1,fn:function(el){
   if(!arm.v){arm.v=true;el.textContent='Tap again to abandon';return;}
   closeModal();finish('abandon');}}
 ],'menu');
}
function showGear(){
 const it=gearQ;gearQ=null;
 if(!G||G.over||!it||G.items.indexOf(it)<0||it.x!==G.p.x||it.y!==G.p.y)return;
 walkTok++;
 const p=G.p,sl=it.t,cur=p.eq[sl],nn=gearName(it);
 // found item, what it replaces, green / red stat changes, then at most two short rule lines
 const rule=itemRuleShort(it),rules=(rule&&rule!=='Balanced.'?'<div class="rl">'+rule+'</div>':'')+(it.tr?'<div class="rl"><b>'+TR[it.tr].n+'</b>: '+TR[it.tr].d+'</div>':'');
 const html='<div class="found"><b>'+itemIcon(it)+' '+nn+'</b><small>replaces '+(cur?itemIcon(cur)+' '+gearName(cur):'nothing')+'</small></div>'+
  '<div class="dl">'+gearDeltaHtml(it)+'</div>'+rules;
 showModal(SLOT_LABEL[sl]+' found',html,[
  {k:'equip',label:'Equip',c:1,big:1,fn:function(){
   if(G.items.indexOf(it)<0){closeModal();return;}
   const old=equipItem(it);
   if(worthKeeping(old)){const on=gearName(old);it.k=old.k;it.v=old.v;it.tr=old.tr||null;msg('Equipped '+nn+'. You drop your '+on+'.');}
   else{G.items=G.items.filter(o=>o!==it);msg('Equipped '+nn+'.');}
   closeModal();save();render();
   if(G.pending>0)showPerk();}},
  {k:'leave',label:'Leave',c:1,big:1,fn:function(){msg('Left the '+nn+'.');closeModal();render();}}
 ],'gear');
}
