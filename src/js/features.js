// features.js - floor features: traps, shrine, merchant (stock + buying). The locked room lives in mapgen/run/walk.

function buildStock(f){
 const s=[],pr=(a,b)=>Math.round(a+b*f);
 s.push({k:'pot',n:'🧪 Health potion',d:'Heals about 40% of max HP.',price:pr(...BAL.merchant.price.potion)});
 s.push({k:'pot',n:'🧪 Health potion',d:'Heals about 40% of max HP.',price:pr(...BAL.merchant.price.potion)});
 s.push({k:'fire',n:'📜 Fireball scroll',d:'Damages every enemy in sight.',price:pr(...BAL.merchant.price.fire)});
 s.push({k:'tele',n:'🌀 Teleport scroll',d:'Jump to a random far spot.',price:pr(...BAL.merchant.price.tele)});
 const slot=Math.random()<BAL.merchant.weaponChance?'weapon':'armor',g=forcedGear(f,slot);
 s.push({k:'gear',slot:slot,v:g.v,tr:g.tr,n:(slot==='weapon'?'⚔️ ':'🛡 ')+gearName(slot,g.v,g.tr),d:'+'+g.v+(slot==='weapon'?' attack. ':' defense. ')+TR[g.tr].d+' Replaces your current '+(slot==='weapon'?'weapon.':'armor.'),price:pr(...BAL.merchant.price.gear)});
 const pool=PERKS.filter(pk=>(!pk.lock||meta.unl[pk.lock])&&pc(pk.id)<pk.max);
 if(pool.length){const pk=pick(pool);s.push({k:'perk',id:pk.id,n:'✨ Perk: '+pk.n,d:pk.d,price:pr(...BAL.merchant.price.perk)});}
 if(meta.unl.elixir)s.push({k:'elixir',n:'🧿 Elixir of Vigor',d:'+'+BAL.merchant.elixirHp+' max HP and a full heal.',price:pr(...BAL.merchant.price.elixir)});
 return s;
}
function wakeAll(){for(const e of G.enemies){e.awake=true;e.alarm=1;}}
function springEnemy(e,t){
 const vis=G.vis[ix(e.x,e.y)];if(vis)t.rev=1;
 if(t.k==='spike'){const d=BAL.trap.spikeBase+G.floor;hurtEnemy(e,d,'#c9c');if(vis)msg('The '+nm(e)+' steps on a spike trap!');settle(e,'A spike trap');}
 else if(t.k==='dart'){e.pois={t:BAL.trap.dartEnemyTurns,d:BAL.trap.dartEnemyDmg};e.awake=true;floatFx(e.x,e.y,'poison','#7be04b');if(vis)msg('The '+nm(e)+' is hit by a poison dart!');}
 else{wakeAll();t.done=1;msg(vis?'The '+nm(e)+' sets off an alarm! Everything is awake.':'A distant alarm shrieks. Everything is awake.');}
}
function springPlayer(t){
 const p=G.p;t.rev=1;G.stopWalk=true;walkTok++;
 if(t.k==='spike'){
  let d=BAL.trap.spikeBase+G.floor;if(pc('trapper'))d=Math.max(1,Math.ceil(d/2));
  p.hp-=d;G.killer='a spike trap';playerHurtFx(d);floatFx(p.x,p.y,'-'+d,'#ff5a5a');
  msg('You step on a spike trap! -'+d+' HP.');secondWind();
 }else if(t.k==='dart'){
  G.ppois={t:pc('trapper')?BAL.trap.dartTurnsTrapfinder:BAL.trap.dartTurns,d:BAL.trap.dartDmgBase+Math.floor(G.floor/BAL.trap.dartDmgFloorDiv)};G.killer='dart poison';floatFx(p.x,p.y,'poison','#7be04b');
  msg('A dart hits you - poisoned for '+G.ppois.t+' turns!');
 }else{wakeAll();t.done=1;floatFx(p.x,p.y,'ALARM','#ffd24a');msg('An alarm shrieks! Every enemy on the floor is awake.');}
}
function stepEffects(){
 const p=G.p,t=trapAt(p.x,p.y);
 if(t)springPlayer(t);
 const s=G.shrine;if(s&&!s.used&&!s.left&&s.x===p.x&&s.y===p.y){shrineQ=true;G.stopWalk=true;}
}
function showShrine(){
 const s=G&&G.shrine;if(!s||s.used||G.over)return;walkTok++;
 const p=G.p,better=!!meta.unl.shrine,heal=better?BAL.shrine.healBetter:BAL.shrine.healBase,loss=better?BAL.shrine.lossBetter:BAL.shrine.lossBase,pct=n=>Math.round(n*100);
 const done=function(t){s.used=1;closeModal();msg(t);save();render();afterModals();};
 const opts=[
  {html:'<b>🙏 Pray</b><span>'+pct(heal)+'% chance of a full heal, '+pct(1-heal)+'% chance you lose '+pct(loss)+'% of max HP.</span>',fn:function(){
   if(Math.random()<heal){const h=p.mhp-p.hp;p.hp=p.mhp;floatFx(p.x,p.y,'+'+h,'#6f6');done('The shrine glows. You are fully healed.');}
   else{const l=Math.max(1,Math.round(p.mhp*loss));p.hp=Math.max(1,p.hp-l);G.killer='a cursed shrine';floatFx(p.x,p.y,'-'+l,'#ff5a5a');playerHurtFx(l);done('The shrine rejects you: -'+l+' HP.');}}},
  {html:'<b>🪙 Sacrifice '+BAL.shrine.sacrificeGold+' gold</b><span>Gain a random perk. You have '+p.gold+' gold.</span>',off:p.gold<BAL.shrine.sacrificeGold,fn:function(){
   const id=randomPerkId();if(!id){msg('No perks left to offer.');return;}
   p.gold-=BAL.shrine.sacrificeGold;addPerk(id);done('The shrine accepts your gold.');}},
  {html:'<b>🩸 Blood pact</b><span>-'+BAL.shrine.pactHp+' max HP, +'+BAL.shrine.pactAtk+' attack for the rest of the run. Only once per run.</span>',off:p.mhp<=BAL.shrine.pactMinHp||!!G.pact,fn:function(){
   G.pact=1;p.mhp=Math.max(BAL.shrine.pactMinHp,p.mhp-BAL.shrine.pactHp);p.hp=Math.min(p.hp,p.mhp);p.atk+=BAL.shrine.pactAtk;done('You sign in blood: -'+BAL.shrine.pactHp+' max HP, +'+BAL.shrine.pactAtk+' attack.');}}
 ];
 if(better)opts.splice(1,0,{html:'<b>✨ Blessing</b><span>Safe: heal 30% of max HP and gain +1 defense.</span>',fn:function(){
  const h=Math.round(p.mhp*BAL.shrine.blessHeal);p.hp=Math.min(p.mhp,p.hp+h);p.def++;floatFx(p.x,p.y,'+'+h,'#6f6');done('A warm light blesses you: +1 defense.');}});
 opts.push({label:'Leave',c:1,fn:function(){s.left=1;closeModal();render();}});
 showModal('🗿 Ancient shrine','<p>A strange altar hums with power. Choose carefully - it works only once.</p>',opts);
}
function showShop(){
 if(!G||G.over||!G.merchant)return;walkTok++;
 const m=G.merchant,p=G.p;
 const btns=m.stock.map(function(it,i){return {html:'<b>'+it.n+(it.sold?' (sold)':'')+' - <span class="gold">'+it.price+' 💰</span></b><span>'+it.d+'</span>',off:!!it.sold||p.gold<it.price,fn:function(){buy(i);}};});
 btns.push({label:'Leave',c:1,fn:closeModal});
 showModal('🧔 Merchant','<p>"Fine wares for fine coin." You have <span class="gold">'+p.gold+' 💰</span>.</p>',btns);
}
function buy(i){
 const m=G&&G.merchant,it=m&&m.stock[i],p=G&&G.p;if(!it||it.sold||p.gold<it.price)return;
 if(it.k==='pot'){if(G.inv.pot>=p.potCap){msg('Your potion belt is full.');return;}G.inv.pot++;}
 else if(it.k==='fire')G.inv.fire++;
 else if(it.k==='tele')G.inv.tele++;
 else if(it.k==='gear'){const w=it.slot==='weapon',nn=gearName(it.slot,it.v,it.tr);if(w){p.wb=it.v;p.wn=nn;p.wt=it.tr;}else{p.ab=it.v;p.an=nn;p.at=it.tr;}}
 else if(it.k==='perk'){if(!addPerk(it.id)){msg('You cannot take that perk.');return;}}
 else if(it.k==='elixir'){p.mhp+=BAL.merchant.elixirHp;p.hp=p.mhp;}
 p.gold-=it.price;it.sold=1;msg('Bought: '+it.n.replace(/^\S+ /,'')+'.');save();render();showShop();
}
