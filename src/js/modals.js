// modals.js - generic modal plumbing plus perk-choice, menu, gear-compare and perk-list screens.

function afterModals(){if(!G||G.over)return;if(G.pending>0)showPerk();else if(gearQ)showGear();else if(shrineQ){shrineQ=false;showShrine();}}
function modalOpen(){return $('modal').style.display!=='none'||$('title').style.display!=='none';}
// kind + button.k are plain labels (data attributes) so Auto can tell dialogs and choices apart without parsing text
// A dialog that opens because of something that happened (level-up, gear underfoot, shrine, exit choice, merchant, end of run) may appear
// under a finger that is still tapping the map. Real taps are ignored for BAL.ui.modalGraceMs after it opens, and so is any tap whose finger
// went down BEFORE it opened (never both counted). Clicks made through the DOM (Auto, bots) and keyboard activations are not touched.
const GRACE_KINDS={perk:1,gear:1,shrine:1,path:1,shop:1,end:1};
document.addEventListener('pointerdown',function(){lastDown=performance.now();},true);
function modalBlocked(e){
 if(!modalGrace||!e||!e.isTrusted)return false;
 return performance.now()-modalAt<modalGrace||(e.detail>0&&lastDown<modalAt);
}
function showModal(title,html,buttons,kind,icon){
 const wasOpen=$('modal').style.display!=='none';
 modalAt=performance.now();modalGrace=!wasOpen&&GRACE_KINDS[kind]?BAL.ui.modalGraceMs:0;
 armed=null;if(G&&G.p)updateBar();const b=$('modalBox');b.innerHTML='';b.dataset.kind=kind||'';b.classList.remove('dead','win');
 const h=document.createElement('h2');if(icon){const s=document.createElement('span');s.className='mic';s.innerHTML=icon;h.appendChild(s);}h.appendChild(document.createTextNode(title));b.appendChild(h);
 if(html){const d=document.createElement('div');d.innerHTML=html;d.style.display='flex';d.style.flexDirection='column';d.style.gap='8px';b.appendChild(d);}
 for(const bt of buttons){
  const el=document.createElement('button');if(bt.c)el.className='c';if(bt.cls)el.classList.add(bt.cls);if(bt.k)el.dataset.k=bt.k;
  el.innerHTML=bt.html||bt.label;if(bt.off)el.disabled=true;if(bt.big){el.style.minHeight='60px';el.style.fontSize='18px';}
  el.addEventListener('click',function(e){e.stopPropagation();if(modalBlocked(e))return;bt.fn(el);});
  b.appendChild(el);
 }
 $('modal').style.alignItems=kind==='help'?'flex-start':'';   // an open section must not move the headings under the finger
 $('modal').style.display='flex';
}
function closeModal(){$('modal').style.display='none';if(G&&G.p)render();}
function perkTags(pk){
 let t='';
 if(pk.cls)t+='<em class="tag act">'+CLS[pk.cls].n.toUpperCase()+'</em>';
 if(SYN.some(s=>(s.a===pk.id&&pc(s.b))||(s.b===pk.id&&pc(s.a))))t+='<em class="tag syn">SYNERGY</em>';
 return t;
}
// leading icon chip for choice cards (perks / upgrades): a few specific icons, the rest share the generic perk mark
const CARD_IC={vit:'heart',might:'sword',bul:'tower',vamp:'bloodlust',keen:'lens',renew:'elixir',thorns:'spear',pockets:'bag',evade:'ab_vanish',scholar:'tome',pyro:'fire',regen:'potion',treasure:'gold',venom:'st_pois',chain:'ab_bolt',blood:'bloodlust',riposte:'dagger',second:'pray',scav:'satchel',berserk:'ab_bash',exec:'axe',fury:'ab_cleave',stampede:'ab_charge',arcana:'staff',deepfreeze:'st_frz',phase:'ab_blink',assassin:'ab_backstab',shadow:'ab_smoke',phoenix:'pray',trapper:'trap_spike',midas:'coin',sage:'tome',warlord:'crown',hp:'heart',atk:'sword',pot:'potion',goldp:'coin',def:'tower',xpf:'tome',edge:'lens',vigor:'heart',prep:'fire',stalker:'p_stalker',warcry:'p_warcry',frostbite:'p_frostbite',lacerate:'p_lacerate',rogue:'rogue',mage:'mage',scroll:'tome',pick4:'perk',shrine:'shrine'};
// perk categories tint the icon chip: offence orange, defence blue, utility violet
const PERK_CAT={might:'o',vamp:'o',keen:'o',venom:'o',chain:'o',blood:'o',berserk:'o',exec:'o',glass:'o',fury:'o',stampede:'o',assassin:'o',arcana:'o',deepfreeze:'o',pyro:'o',warlord:'o',riposte:'o',
 vit:'d',bul:'d',thorns:'d',evade:'d',second:'d',phoenix:'d',renew:'d',regen:'d',retrib:'d',shadow:'d'};
const CAT_COL={o:'#ff8a3a',d:'#3f86ff',u:'#b38bff'};
function perkChip(id,px){const c=CAT_COL[PERK_CAT[id]||'u'];return '<span class="chp" style="border-color:'+c+';background:'+c+'26">'+ic(CARD_IC[id]||'perk',px||28)+'</span>';}
function cardHtml(id,inner){return (CARD_IC[id]&&PERK_CAT[id]!==undefined||PERKS.some(p=>p.id===id)?perkChip(id):'<span class="chp">'+ic(CARD_IC[id]||'perk',28)+'</span>')+'<span class="ct">'+inner+'</span>';}
function showPerk(){
 if(!G||G.pending<=0)return;
 walkTok++;
 const pool=perkPool();
 if(!pool.length){G.pending=0;save();return;}
 const opts=pool.sort(()=>rf()-0.5).slice(0,meta.unl.pick4?4:3);
 showModal('Level '+G.p.lvl+': pick a perk','',opts.map(pk=>{
  const c=pc(pk.id),lv=pk.max>1?(c>0?' Lv '+c+'→'+(c+1):' (max '+pk.max+')'):'';
  return {k:pk.id,html:cardHtml(pk.id,'<b>'+pk.n+lv+perkTags(pk)+'</b><span>'+pk.d+'</span>'),cls:'hasic',fn:function(){
   addPerk(pk.id);G.pending--;closeModal();save();render();
   if(G.pending>0)showPerk();else afterModals();
  }};}),'perk');
}
// equipment card: icon + name, then one short line of what it does
function slotLines(sl){
 const it=G.p.eq[sl];
 if(!it)return '';
 const st=sl==='weapon'?sgn(it.v+(WP[it.k]?WP[it.k].atk:0))+' attack · ':sl==='armor'?'Defense '+armorDef(it)+' · ':'';
 const r=itemRuleShort(it);
 return '<small>'+st+(r==='Balanced.'?'':r)+(it.tr?'<br><b>'+TR[it.tr].n+'</b>: '+TR[it.tr].d:'')+'</small>';
}
function statStrip(){
 const p=G.p;
 return '<div class="stripe"><span>'+ic('sword',20)+' '+meleeAtk()+'</span><span>'+ic('mail',20)+' '+defTotal()+'</span><span>Lv '+p.lvl+' <small>'+p.xp+'/'+needXp(p.lvl)+' XP</small></span></div>';
}
function gearHtml(){
 let h=statStrip();
 for(const sl of SLOTS){const it=G.p.eq[sl];h+='<div class="pl"><small>'+SLOT_LABEL[sl].toUpperCase()+'</small> <b>'+(it?ic(itemIcon(it),22)+' '+gearName(it):'None')+'</b>'+(it?'<br>'+slotLines(sl):'')+'</div>';}
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
 let h='';for(const k of C.kit){const a=ABIL[k];h+='<div class="pl"><b>'+ic(a.e,22)+' '+a.n+'</b> <small>('+abCost(k)+')<br>'+abilityDesc(k)+'</small></div>';}
 showModal(C.n,h,[{label:'Back',c:1,big:1,fn:function(){if(back)back();else closeModal();}}],'',ic(C.e,30));
}
function showPerks(back){
 let h='';const own=PERKS.filter(pk=>pc(pk.id)>0);
 if(!own.length)h+='<p class="sub">No perks yet. Level up to pick one.</p>';
 for(const pk of own)h+='<div class="pl"><b>'+ic(CARD_IC[pk.id]||'perk',20)+' '+pk.n+(pk.max>1?' ×'+pc(pk.id):'')+'</b>'+perkTags(pk)+'<br><small>'+pk.d+'</small></div>';
 h+='<p><b>Synergies</b></p>';
 for(const s of SYN){
  const on=pc(s.a)&&pc(s.b);
  h+='<div class="pl'+(on?'':' dim')+'"><b>'+(on?'★ ':'')+s.n+'</b> <small>('+perkById(s.a).n+' + '+perkById(s.b).n+')<br>'+s.d+'</small></div>';
 }
 showModal('Perks',h,[{label:'Back',c:1,big:1,fn:function(){if(back)back();else closeModal();}}]);
}
function showMenu(){
 if(!G||G.over)return;walkTok++;
 const arm={v:false},armAuto={v:false};
 showModal('Menu','',[
  {html:ic('check',20)+' Resume',c:1,big:1,fn:closeModal},
  {k:'auto',label:ic('auto',20)+' Auto play',c:1,fn:function(el){
   // the cost is stated BEFORE the first activation: the first tap only says it, the second starts (no alert / confirm)
   if(!(G.auto&&G.auto.used)&&!armAuto.v){armAuto.v=true;el.innerHTML=ic('auto',20)+' Idle pay '+autoRateText()+', not run gold. Tap again';return;}
   closeModal();autoStart();}},
  {html:ic('perk',20)+' Perks',c:1,fn:function(){showPerks(showMenu);}},
  {html:ic('info',20)+' Controls',c:1,fn:function(){showHelp(showMenu);}},
  {html:ic('snd',20)+' '+soundLabel(),c:1,fn:function(el){toggleSound();el.innerHTML=ic('snd',20)+' '+soundLabel();}},
  {html:ic('x',20)+' Abandon run',c:1,fn:function(el){
   if(!arm.v){arm.v=true;el.innerHTML=ic('x',20)+' Tap again to abandon';return;}
   closeModal();finish('abandon');}}
 ],'menu');
}
function showGear(){
 const it=gearQ;gearQ=null;
 if(!G||G.over||!it||G.items.indexOf(it)<0||it.x!==G.p.x||it.y!==G.p.y)return;
 walkTok++;
 const p=G.p,sl=it.t,cur=p.eq[sl],nn=gearName(it);
 // found item, what it replaces, green / red stat changes, then at most two short rule lines
 const rule=itemRuleShort(it),gone=itemTerms(cur).filter(x=>itemTerms(it).indexOf(x)<0),
  rules=(rule&&rule!=='Balanced.'?'<div class="rl">'+rule+'</div>':'')+(it.tr?'<div class="rl"><b>'+TR[it.tr].n+'</b>: '+TR[it.tr].d+'</div>':'')+(gone.length?'<div class="rl lose">Gives up: '+gone.join(', ')+'</div>':'');
 const html='<div class="found"><b>'+ic(itemIcon(it),28)+' '+nn+'</b><small>replaces '+(cur?ic(itemIcon(cur),16)+' '+gearName(cur):'nothing')+'</small></div>'+
  '<div class="dl">'+gearDeltaHtml(it)+'</div>'+rules;
 showModal(SLOT_LABEL[sl]+' found',html,[
  {k:'equip',label:'Equip',c:1,big:1,fn:function(){
   if(G.items.indexOf(it)<0){closeModal();return;}
   const old=equipItem(it);
   if(worthKeeping(old)){const on=gearName(old);it.k=old.k;it.v=old.v;it.tr=old.tr||null;msg('Equipped '+nn+'. You drop your '+on+'.');}
   else{G.items=G.items.filter(o=>o!==it);msg('Equipped '+nn+'.');}
   closeModal();save();render();
   if(G.pending>0)showPerk();}},
  {k:'leave',label:'Leave',c:1,big:1,fn:function(){it.skip=1;msg('Left the '+nn+'. Tap yourself to see it again.');closeModal();render();}}
 ],'gear');
}
