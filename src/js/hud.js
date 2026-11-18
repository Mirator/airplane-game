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
 {id:'b_wait',fn:act(wait)},
 {id:'b_down',fn:act(descend)}
];
const TRAYBTNS=[{id:'b_pot',fn:act(drink)},{id:'b_fire',fn:act(fireball)},{id:'b_tele',fn:act(teleport)}];
for(const b of BTNS){const el=document.createElement('button');el.id=b.id;el.addEventListener('click',b.fn);$('bar').appendChild(el);}
for(const b of TRAYBTNS){const el=document.createElement('button');el.id=b.id;el.addEventListener('click',function(){setTray(false);b.fn();});$('tray').appendChild(el);}
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
for(let i=0;i<4;i++){const el=document.createElement('button');el.id='a_'+i;el.addEventListener('click',()=>{if(G&&!G.over)toggleAbility(kit()[i]);});ab2.appendChild(el);}
$('gearBtn').addEventListener('click',function(){if(!G||G.over)return;walkTok++;if(modalOpen())return;showEquip(closeModal);});
function bset(id,ic,lab,badge,dis){
 // only touch the DOM when the content changes: rewriting a button mid-press drops the tap
 const el=$(id),h='<span style="font-size:19px;display:block;line-height:1.1">'+ic+'</span><small>'+lab+'</small>'+(badge!==''&&badge!=null?'<i class="bd" style="font-style:normal">'+badge+'</i>':'');
 if(el._h!==h){el._h=h;el.innerHTML=h;}
 el.classList.toggle('dis',!!dis);
}
// cheap status for a button: never scans the map for tile targets (render runs every animation frame)
function abStatus(k){
 const A=ABIL[k],c=costOf(k),p=G.p;
 if(G.cd[k]>0)return {dis:1,sub:'⏳ '+G.cd[k]};
 if(c.rage&&(p.rage||0)<c.rage)return {dis:1,sub:c.rage+' rage'};
 if(c.mana&&(p.mana||0)<c.mana)return {dis:1,sub:c.mana+' mana'};
 if(k==='knife'&&(G.knives||0)<1)return {dis:1,sub:'no knives'};
 // why a targeted ability cannot fire: only O(visible foes) checks, no map scan
 if((k==='cleave'||k==='nova'||k==='bash'||k==='backstab')&&!(k==='bash'||k==='backstab'?advEnemies(true):chebEnemies()).length)return {dis:1,sub:G.enemies.some(e=>G.vis[ix(e.x,e.y)])?'too far':'no target'};
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
  const h='<span class="ai">'+(isA?'✖':A.e)+'</span><small>'+(isA?'Cancel':A.n)+'</small>'+(isA?'':'<small class="sub">'+st.sub+'</small>');
  if(el._h!==h){el._h=h;el.innerHTML=h;}
 }
 $('cv').classList.toggle('arming',!!armed); // nothing may cover map tiles while a target is being picked
 if((armed||modalOpen())&&trayOpen())setTray(false);
 const inv=G.inv,onS=G.map[ix(G.p.x,G.p.y)]===2,n=inv.pot+inv.fire+inv.tele;
 bset('b_items','🎒','Items',n>0?n:'',n<=0);
 bset('b_pot','🧪','Potion','×'+inv.pot,inv.pot<=0);
 bset('b_fire','📜','Flames','×'+inv.fire,inv.fire<=0);
 bset('b_tele','🌀','Teleport','×'+inv.tele,inv.tele<=0);
 bset('b_exp','🧭','Explore','',false);
 bset('b_wait','⏳','Wait','',false);
 bset('b_down','⬇️','Stairs','',!onS);
 $('b_down').classList.toggle('here',onS);
}
function updateHud(){
 if(!G)return;const p=G.p;
 $('hpfill').style.width=Math.max(0,100*p.hp/p.mhp)+'%';
 $('hptxt').textContent=clsOf(p).e+' HP '+p.hp+'/'+p.mhp;
 const rb=$('resbar'),rf=$('resfill'),rt=$('restxt');
 if(p.cls==='warrior'){rb.className='res rage';rf.style.width=Math.min(100,100*(p.rage||0)/BAL.rage.max)+'%';rt.textContent='Rage '+Math.floor(p.rage||0);}
 else if(p.cls==='mage'){const m=mmax();rb.className='res mana';rf.style.width=Math.min(100,100*(p.mana||0)/m)+'%';rt.textContent='Mana '+Math.floor(p.mana||0)+'/'+m;}
 else{const m=maxKnives();rb.className='res knives';rf.style.width=Math.min(100,100*(G.knives||0)/m)+'%';rt.textContent='🔪 Knives '+(G.knives||0)+'/'+m;}
 $('xpfill').style.width=(100*p.xp/needXp(p.lvl))+'%';
 $('stats').innerHTML='<span>🏰 '+G.floor+'/'+MAXF+'</span><span>Lv '+p.lvl+'</span><span>💰 '+p.gold+'</span>'+(G.keys>0?'<span>🔑 '+G.keys+'</span>':'')+(G.daily?'<span title="Daily">📅</span>':'')+(G.hard?'<span title="Hard">💀</span>':'')+(G.ppois?'<span style="color:#7be04b">☠ '+G.ppois.t+'</span>':'')+(G.bl?'<span>🩸</span>':'')+(G.vanish>0?'<span>👻 '+G.vanish+'</span>':'')+(G.brace?'<span>🧱 '+G.brace.hits+'</span>':'');
 {const ch=modChipHtml();if(ch!==chipHtml){chipHtml=ch;$('chips').innerHTML=ch;}}
 autoUi();
}
function renderLog(){
 if(!G)return;const l=G.log.slice(-3);
 $('log').innerHTML=l.map(t=>'<div></div>').join('');
 const ch=$('log').children;for(let i=0;i<l.length;i++)ch[i].textContent=l[i];
}
