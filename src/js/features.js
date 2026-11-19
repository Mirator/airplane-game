// features.js - floor features: shrine, merchant (stock + buying). The locked room lives in mapgen/run/walk.

function buildStock(f){
 const s=[],pr=(a,b)=>Math.round(a+b*f);
 s.push({k:'pot',n:'Potion',ic:'potion',d:'Heals '+pct(BAL.potion.healFrac)+' of max HP.',price:pr(...BAL.merchant.price.potion)});
 s.push({k:'pot',n:'Potion',ic:'potion',d:'Heals '+pct(BAL.potion.healFrac)+' of max HP.',price:pr(...BAL.merchant.price.potion)});
 s.push({k:'fire',n:'Flames',ic:'fire',d:'Burns every foe in sight.',price:pr(...BAL.merchant.price.fire)});
 s.push({k:'tele',n:'Teleport',ic:'tele',d:'Jump to a random far spot.',price:pr(...BAL.merchant.price.tele)});
 const slot=pick(BAL.merchant.gearSlots),g=forcedGear(f,slot);
 s.push({k:'gear',item:g,n:gearName(g),ic:itemIcon(g),d:itemDesc(g),price:pr(...BAL.merchant.price.gear)});
 const pool=perkPool();
 if(pool.length){const pk=pick(pool);s.push({k:'perk',id:pk.id,n:'Perk: '+pk.n,ic:'perk',d:pk.d,price:pr(...BAL.merchant.price.perk)});}
 if(meta.unl.elixir)s.push({k:'elixir',n:'Elixir',ic:'elixir',d:'+'+BAL.merchant.elixirHp+' max HP and a full heal.',price:pr(...BAL.merchant.price.elixir)});
 return s;
}
function stepEffects(){
 const p=G.p;
 const s=G.shrine;if(s&&!s.used&&!s.left&&s.x===p.x&&s.y===p.y){shrineQ=true;G.stopWalk=true;}
}
function showShrine(){
 const s=G&&G.shrine;if(!s||s.used||G.over)return;walkTok++;
 const p=G.p,better=!!meta.unl.shrine||modIs('cursed'),heal=better?BAL.shrine.healBetter:BAL.shrine.healBase,loss=better?BAL.shrine.lossBetter:BAL.shrine.lossBase,pct=n=>Math.round(n*100);
 const done=function(t){s.used=1;closeModal();msg(t);save();render();afterModals();};
 const opts=[
  {k:'pray',html:'<b>'+ic('pray',18)+' Pray</b><span>'+pct(heal)+'% full heal, else lose '+pct(loss)+'% max HP.</span>',fn:function(){
   if(rf()<heal){const h=p.mhp-p.hp;p.hp=p.mhp;floatFx(p.x,p.y,'+'+h,'#6f6');done('The shrine glows. You are fully healed.');}
   else{const l=Math.max(1,Math.round(p.mhp*loss));p.hp=Math.max(1,p.hp-l);G.killer='a cursed shrine';floatFx(p.x,p.y,'-'+l,'#ff5a5a');playerHurtFx(l);done('The shrine rejects you: -'+l+' HP.');}}},
  {k:'sac',html:'<b>'+ic('coin',18)+' Sacrifice '+BAL.shrine.sacrificeGold+' gold</b><span>Random perk. You have '+p.gold+'.</span>',off:p.gold<BAL.shrine.sacrificeGold,fn:function(){
   const id=randomPerkId();if(!id){msg('No perks left to offer.');return;}
   p.gold-=BAL.shrine.sacrificeGold;addPerk(id);done('The shrine accepts your gold.');}},
  {k:'pact',html:'<b>'+ic('bloodlust',18)+' Blood pact</b><span>'+BAL.shrine.pactHp+' max HP for +'+BAL.shrine.pactAtk+' attack. Once per run.</span>',off:p.mhp<=BAL.shrine.pactMinHp||!!G.pact,fn:function(){
   G.pact=1;p.mhp=Math.max(BAL.shrine.pactMinHp,p.mhp-BAL.shrine.pactHp);p.hp=Math.min(p.hp,p.mhp);p.atk+=BAL.shrine.pactAtk;done('You sign in blood: -'+BAL.shrine.pactHp+' max HP, +'+BAL.shrine.pactAtk+' attack.');}}
 ];
 if(better)opts.splice(1,0,{k:'bless',html:'<b>'+ic('star',18)+' Blessing</b><span>Safe: heal '+pct(BAL.shrine.blessHeal)+' HP, +1 defense.</span>',fn:function(){
  const h=Math.round(p.mhp*BAL.shrine.blessHeal);p.hp=Math.min(p.mhp,p.hp+h);p.def++;floatFx(p.x,p.y,'+'+h,'#6f6');done('A warm light blesses you: +1 defense.');}});
 opts.push({k:'leave',esc:1,label:'Leave',c:1,fn:function(){s.left=1;closeModal();render();}});
 showModal('Shrine','',opts,'shrine',ic('shrine',30));
}
function showShop(){
 if(!G||G.over||!G.merchant)return;walkTok++;
 const m=G.merchant,p=G.p;
 const btns=m.stock.map(function(it,i){return {k:'buy'+i,html:'<b>'+ic(it.ic||'perk',18)+' '+it.n+(it.sold?' (sold)':'')+' <span class="nw">- <span class="gold">'+it.price+' '+ic('coin',14)+'</span></span></b><span>'+it.d+'</span>',off:!!it.sold||p.gold<it.price,fn:function(){buy(i);}};});
 btns.push({k:'leave',esc:1,label:'Leave',c:1,fn:closeModal});
 showModal('Merchant','<p class="sub">You have <span class="gold">'+p.gold+' '+ic('coin',14)+'</span></p>',btns,'shop',ic('merchant',30));
}
function buy(i){
 const m=G&&G.merchant,it=m&&m.stock[i],p=G&&G.p;if(!it||it.sold||p.gold<it.price)return;
 if(it.k==='pot'){if(G.inv.pot>=p.potCap){msg('Your potion belt is full.');return;}G.inv.pot++;}
 else if(it.k==='fire')G.inv.fire++;
 else if(it.k==='tele')G.inv.tele++;
 else if(it.k==='gear'){equipItem(it.item);}
 else if(it.k==='perk'){if(!addPerk(it.id)){msg('You cannot take that perk.');return;}}
 else if(it.k==='elixir'){p.mhp+=BAL.merchant.elixirHp;p.hp=p.mhp;}
 p.gold-=it.price;it.sold=1;msg('Bought: '+it.n.replace(/^\S+ /,'')+'.');save();render();showShop();
}
