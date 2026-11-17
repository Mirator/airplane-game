// hud.js - bottom action bar construction, HUD (HP/XP/stats) and message-log rendering.

const BTNS=[
 {id:'b_pot',fn:()=>{walkTok++;if(!G||G.over||modalOpen())return;drink();}},
 {id:'b_fire',fn:()=>{walkTok++;if(!G||G.over||modalOpen())return;fireball();}},
 {id:'b_tele',fn:()=>{walkTok++;if(!G||G.over||modalOpen())return;teleport();}},
 {id:'b_exp',fn:explore},
 {id:'b_wait',fn:()=>{walkTok++;if(!G||G.over||modalOpen())return;wait();}},
 {id:'b_down',fn:()=>{walkTok++;if(!G||G.over||modalOpen())return;descend();}}
];
for(const b of BTNS){const el=document.createElement('button');el.id=b.id;el.addEventListener('click',b.fn);$('bar').appendChild(el);}
const ab2=$('bar2');
for(const a of ABIL){const el=document.createElement('button');el.id='b_'+a.k;el.addEventListener('click',()=>toggleAbility(a.k));ab2.appendChild(el);}
function bset(id,ic,lab,badge,dis){
 const el=$(id);el.innerHTML='<span style="font-size:19px;display:block;line-height:1.1">'+ic+'</span><small>'+lab+'</small>'+(badge!==''&&badge!=null?'<i class="bd" style="font-style:normal">'+badge+'</i>':'');
 el.classList.toggle('dis',!!dis);
}
function updateBar(){
 if(!G)return;
 let any=false;
 for(const a of ABIL){const el=$('b_'+a.k),own=a.cls?G.p.cls===a.cls:pc(a.perk)>0,cd=G.cd[a.k]||0;
  if(own)any=true;el.style.display=own?'':'none';
  el.classList.toggle('armed',armed===a.k);
  bset('b_'+a.k,a.e,armed===a.k?'Cancel':a.n,cd>0&&armed!==a.k?cd:'',cd>0&&armed!==a.k);}
 ab2.style.display=any?'flex':'none';const inv=G.inv,onS=G.map[ix(G.p.x,G.p.y)]===2;
 bset('b_pot','🧪','Potion','×'+inv.pot,inv.pot<=0);
 bset('b_fire','🔥','Fireball','×'+inv.fire,inv.fire<=0);
 bset('b_tele','🌀','Teleport','×'+inv.tele,inv.tele<=0);
 bset('b_exp','🧭','Explore','',false);
 bset('b_wait','⏳','Wait','',false);
 bset('b_down','⬇️','Stairs','',!onS);
}
function updateHud(){
 if(!G)return;const p=G.p;
 $('hpfill').style.width=Math.max(0,100*p.hp/p.mhp)+'%';
 $('hptxt').textContent=clsOf(p).e+' '+clsOf(p).n+'  HP '+p.hp+' / '+p.mhp;
 $('xpfill').style.width=(100*p.xp/needXp(p.lvl))+'%';
 $('stats').innerHTML='<span>🏰 F'+G.floor+'/'+MAXF+'</span><span>Lv '+p.lvl+' ('+p.xp+'/'+needXp(p.lvl)+')</span><span>⚔️ '+Math.max(1,p.atk+p.wb+atkMod())+'</span><span>🛡 '+(p.def+p.ab)+'</span><span>💰 '+p.gold+'</span>'+(G.keys>0?'<span>🔑 '+G.keys+'</span>':'')+(G.ppois?'<span style="color:#7be04b">☠ '+G.ppois.t+'</span>':'')+(G.bl?'<span>🩸 primed</span>':'')+(G.vanish>0?'<span>👻 '+G.vanish+'</span>':'');
}
function renderLog(){
 if(!G)return;const l=G.log.slice(-3);
 $('log').innerHTML=l.map(t=>'<div></div>').join('');
 const ch=$('log').children;for(let i=0;i<l.length;i++)ch[i].textContent=l[i];
}

