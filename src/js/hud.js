// hud.js - bottom action bar and the four ability buttons, HUD (HP / resource / XP / stats) and message-log rendering.

// bottom area: four ability buttons (#bar2), then Items / Explore / Wait / Stairs (#bar). Potion, Flames and Teleport live in the
// Items tray (#tray, drawn over the log line area only - never over the map).
const act=fn=>()=>{walkTok++;if(!G||G.over||modalOpen())return;fn();};
const BTNS=[
 {id:'b_items',fn:function(){
  walkTok++;if(!G||G.over||modalOpen())return;
  if(trayOpen()){setTray(false);return;}
  const n=G.inv.pot+G.inv.fire+G.inv.tele;
  if(n<=0){msg('No items.');render();return;}
  armed=null;setTray(true);render();}},
 {id:'b_exp',fn:explore},
 {id:'b_wait',fn:act(function(){if(armed){cancelTarget();return;}wait();})},   // armed: Wait is a cancel, no turn spent
 {id:'b_down',fn:act(descend)}
];
const TRAYBTNS=[{id:'b_pot',fn:act(drink)},{id:'b_fire',fn:act(fireball)},{id:'b_tele',fn:act(teleport)}];
const KEYS={b_items:'I',b_exp:'E',b_wait:'␣',b_down:'↵',b_pot:'Q'};   // Space / Enter as one-glyph chips, so they never reach the icon
for(const b of BTNS){const el=document.createElement('button');el.id=b.id;el.dataset.key=KEYS[b.id];el.addEventListener('click',b.fn);$('bar').appendChild(el);}
for(const b of TRAYBTNS){const el=document.createElement('button');el.id=b.id;if(KEYS[b.id])el.dataset.key=KEYS[b.id];el.addEventListener('click',function(){setTray(false);b.fn();});$('tray').appendChild(el);}
function trayOpen(){return $('tray').style.display!=='none';}
function setTray(on){
 $('tray').style.display=on?'flex':'none';
 $('b_items').classList.toggle('open',!!on);
}
// a tap anywhere else (map, another button) closes the tray; the Items button and the tray buttons handle themselves
document.addEventListener('click',function(ev){
 if(!trayOpen())return;const t=ev.target;
 if(t&&t.closest&&(t.closest('#tray')||t.closest('#b_items')))return;
 setTray(false);
});
const ab2=$('bar2');
for(let i=0;i<4;i++){const el=document.createElement('button');el.id='a_'+i;el.dataset.key=String(i+1);el.addEventListener('click',()=>{if(G&&!G.over)toggleAbility(kit()[i]);});ab2.appendChild(el);}
$('menuBtn').dataset.key='Esc';$('gearBtn').innerHTML=ic('equip',28);$('menuBtn').innerHTML=ic('menu',26);
for(const el of document.querySelectorAll('[data-slot]'))el.innerHTML=ic(el.dataset.slot==='stop'?'x':'auto',16);
// the Equipment button doubles as the level-up badge: with a pick pending it opens the perk choice (which has an Equipment button of its own)
function gearOrPick(){if(!G||G.over)return;walkTok++;if(modalOpen())return;if(G.pending>0)showPerk(true);else showEquip(closeModal);}
$('gearBtn').addEventListener('click',gearOrPick);$('gearBtn').dataset.key='P';
{const bd=document.createElement('i');bd.id='perkBadge';bd.className='bd';bd.style.display='none';$('gearBtn').appendChild(bd);}
function bset(id,icn,lab,badge,dis){
 // only touch the DOM when the content changes: rewriting a button mid-press drops the tap
 const el=$(id),h='<span class="bi">'+ic(icn,24)+'</span><small>'+lab+'</small>'+(badge!==''&&badge!=null?'<i class="bd" style="font-style:normal">'+badge+'</i>':'');
 if(el._h!==h){el._h=h;el.innerHTML=h;}
 el.classList.toggle('dis',!!dis);
}
// cheap status for a button: never scans the map for tile targets (render runs every animation frame)
function abStatus(k){
 const A=ABIL[k],c=costOf(k),p=G.p;
 if(G.cd[k]>0)return {dis:1,sub:ic('hourglass',11)+' '+G.cd[k]};
 if(c.rage&&(p.rage||0)<c.rage)return {dis:1,sub:c.rage+' rage'};
 if(c.mana&&(p.mana||0)<c.mana)return {dis:1,sub:c.mana+' mana'};
 if(k==='knife'&&(G.knives||0)<1)return {dis:1,sub:'no knives'};
 // why a targeted ability cannot fire: only O(visible foes) checks, no map scan
 if((k==='cleave'||k==='nova'||k==='bash'||k==='backstab')&&!(k==='bash'||k==='backstab'?advEnemies(true):chebEnemies()).length)return {dis:1,sub:(k==='bash'||k==='backstab')&&chebEnemies().length?'diagonal':G.enemies.some(e=>G.vis[ix(e.x,e.y)])?'too far':'no target'};
 if(k==='charge'&&!chargeLines().length)return {dis:1,sub:G.enemies.some(e=>G.vis[ix(e.x,e.y)])?'no line':'no target'};
 if((k==='bolt'||k==='knife')&&!enemyShots(BAL.ability[k].range).length){
  const R=BAL.ability[k].range,vis=G.enemies.filter(e=>G.vis[ix(e.x,e.y)]);
  return {dis:1,sub:!vis.length?'no target':vis.some(e=>manh(e,p)<=R)?'no line':'too far'};}
 return {dis:0,sub:k==='knife'?'×'+G.knives:costLabel(k)};
}
function updateBar(){
 if(!G)return;
 const kt=kit();
 for(let i=0;i<4;i++){
  const k=kt[i],A=ABIL[k],el=$('a_'+i),st=abStatus(k),isA=armed===k;
  el.classList.toggle('armed',isA);el.classList.toggle('dis',!isA&&!!st.dis);
  const h='<span class="ai">'+ic(isA?(A.tg==='self'?'check':'x'):A.e,26)+'</span><small>'+(isA?(A.tg==='self'?'Use':'Cancel'):A.n)+'</small>'+(isA?'':'<small class="sub">'+st.sub+'</small>');
  if(el._h!==h){el._h=h;el.innerHTML=h;}
 }
 $('cv').classList.toggle('arming',!!armed); // nothing may cover map tiles while a target is being picked
 if((armed||modalOpen())&&trayOpen())setTray(false);
 const inv=G.inv,onS=G.map[ix(G.p.x,G.p.y)]===2,n=inv.pot+inv.fire+inv.tele;
 bset('b_items','bag','Items',n>0?n:'',n<=0);
 bset('b_pot','potion','Potion','×'+inv.pot,inv.pot<=0);
 bset('b_fire','fire','Flames','×'+inv.fire,inv.fire<=0);
 bset('b_tele','tele','Teleport','×'+inv.tele,inv.tele<=0);
 bset('b_exp','compass','Explore','',false);
 bset('b_wait','hourglass','Wait','',false);
 bset('b_down','down','Stairs','',!onS);
 $('b_down').classList.toggle('here',onS);
}
// only touch the DOM when the markup changes
function setH(el,h){if(el._h!==h){el._h=h;el.innerHTML=h;}}
let inRunCls=false;
function updateHud(){
 if(!G)return;const p=G.p;
 $('hpfill').style.width=Math.max(0,100*p.hp/p.mhp)+'%';
 {const fr=p.hp/p.mhp,col=fr>0.6?PAL.hpHi:fr>0.3?PAL.hpMid:PAL.hpLow,f=$('hpfill');if(f._c!==col){f._c=col;f.style.background=col;}}
 setH($('hptxt'),ic(clsOf(p).e,17)+' HP '+p.hp+'/'+p.mhp);
 const rb=$('resbar'),rf=$('resfill'),rt=$('restxt');
 if(p.cls==='warrior'){rb.className='res rage';rf.style.width=Math.min(100,100*(p.rage||0)/BAL.rage.max)+'%';setH(rt,'Rage '+Math.floor(p.rage||0));}
 else if(p.cls==='mage'){const m=mmax();rb.className='res mana';rf.style.width=Math.min(100,100*(p.mana||0)/m)+'%';setH(rt,'Mana '+Math.floor(p.mana||0)+'/'+m);}
 else{const m=maxKnives();rb.className='res knives';rf.style.width=Math.min(100,100*(G.knives||0)/m)+'%';setH(rt,ic('knife',16)+' Knives '+(G.knives||0)+'/'+m);}
 $('xpfill').style.width=(100*p.xp/needXp(p.lvl))+'%';
 setH($('stats'),'<span>'+ic('keep',16)+' '+G.floor+'/'+MAXF+'</span><span>Lv '+p.lvl+'</span><span>'+ic('coin',16)+' '+p.gold+'</span>'+(G.keys>0?'<span>'+ic('key',16)+' '+G.keys+'</span>':'')+(G.daily?'<span title="Daily">'+ic('cal',16)+'</span>':'')+(G.hard?'<span title="Heat">'+ic('skull',16)+' Heat '+Math.max(1,G.heat|0)+'</span>':'')+(G.bl?'<span>'+ic('bloodlust',16)+'</span>':'')+(G.vanish>0?'<span>'+ic('ab_vanish',16)+' '+G.vanish+'</span>':'')+(G.brace?'<span>'+ic('ab_brace',16)+' '+G.brace.hits+'</span>':''));
 {const ch=modChipHtml();if(ch!==chipHtml){chipHtml=ch;$('chips').innerHTML=ch;}}
 {const n=G.pending|0,b=$('perkBadge'),t=n>0?String(n):'';if(b._t!==t){b._t=t;b.textContent=t;b.style.display=t?'':'none';$('gearBtn').classList.toggle('pick',n>0);$('gearBtn').setAttribute('aria-label',n>0?'Pick a perk ('+n+' waiting)':'Equipment');}}
 autoUi();sightUpdate();
 {const ir=!G.over;if(ir!==inRunCls){inRunCls=ir;document.body.classList.toggle('inrun',ir);}}
}
// the wide side panel's "In sight" list: every visible foe by distance (icon, name, HP bar); a click inspects it and rings it on the map
let hlFoe=null;
function sightUpdate(){
 if(!isBig())return;
 const el=$('sightList'),vis=G.over?[]:G.enemies.filter(e=>!e.dead&&e.hp>0&&G.vis[ix(e.x,e.y)]).sort((a,b)=>manh(a,G.p)-manh(b,G.p));
 let h='';
 if(!vis.length)h='<div class="none">Nothing in sight.</div>';
 else{
  for(const e of vis.slice(0,6)){const d=EN[e.t];
   h+='<button class="srow" data-id="'+e.id+'" aria-label="'+d.n+' '+e.hp+' of '+e.mhp+' HP">'+ic(d.e,24)+'<span class="sn">'+(e.elite&&e.name?e.name:d.n)+(e.awake?'':' (asleep)')+'</span><span class="sh"><i style="width:'+Math.max(0,Math.min(100,100*e.hp/e.mhp))+'%"></i></span><span class="sv">'+e.hp+'</span></button>';}
  if(vis.length>6)h+='<div class="none">+'+(vis.length-6)+' more</div>';
 }
 if(el._h!==h){el._h=h;el.innerHTML=h;}
}
function sightFoe(ev){const b=ev.target.closest&&ev.target.closest('button.srow');return b&&G?G.enemies.find(e=>e.id===+b.dataset.id):null;}
$('sightList').addEventListener('click',function(ev){
 const e=sightFoe(ev);if(!e||!G||G.over||modalOpen())return;
 hlFoe={id:e.id,until:performance.now()+2500};showInspect(e.x,e.y);render();
});
$('sightList').addEventListener('mouseover',function(ev){const e=sightFoe(ev);if(e&&G){hlFoe={id:e.id,until:1e12};render();}});
$('sightList').addEventListener('mouseleave',function(){if(hlFoe&&hlFoe.until>1e11){hlFoe=null;if(G)render();}});
function renderLog(){
 if(!G)return;const l=G.log.slice(-LOGN);
 $('log').innerHTML=l.map(t=>'<div></div>').join('');
 const ch=$('log').children;for(let i=0;i<l.length;i++)ch[i].textContent=l[i];
}
