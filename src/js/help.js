// help.js - the Controls / help screen text. Short hints; every number is generated from BAL and the tables.

function showHelp(back){
 const r=(ic,n,d)=>'<div class="pl"><b>'+ic+' '+n+'</b> <small>'+d+'</small></div>';
 const sec=(t,body)=>'<details class="hsec"><summary>'+t+'</summary>'+body+'</details>';
 const P=BAL.potion;
 // essentials first (about 100 words), everything else folded away
 let h='<div class="hess">'+
  '<p><b>Tap</b> a tile to walk, an enemy to attack, yourself to wait.</p>'+
  '<p><b>Hold</b> (or right-click) a foe, a tile or yourself to inspect it. Tap to close.</p>'+
  '<p><b>Abilities:</b> tap one, then a lit tile. Dim ones say why.</p>'+
  '<p><b>Red tiles</b> hit next turn: step off. Walking onto danger or a trap needs a second tap.</p>'+
  '<p><b>Explore</b> finds new ground, then the stairs. <b>Items</b> holds potion, flames, teleport. ☰ has Auto, perks and sound.</p></div>'+
  sec('Buttons and bars',
   r('🎯','Ability row','Four class abilities. Tap again to cancel aiming.')+
   r('🎒','Items','Potion (heals '+pct(P.healFrac)+' HP), Flames (burns all in sight), Teleport (random far spot).')+
   r('🧭','Explore','Stops when an enemy appears or danger shows.')+
   r('⬇️','Stairs','Lit up when you stand on ▼.')+
   r('🎒☰','Top bar','🎒 gear and stats. ☰ menu.')+
   r('❤️','Bars','Red HP, then Rage / Mana / Knives. Thin bar = XP.')+
   r('🗺','Minimap','Tap for the big map.'))+
  sec('Fighting',
   r('🛡️','Guards','Take '+pct(BAL.weapon.shieldFront)+' from the front. Stun them or hit from behind.')+
   r('💥','Knockback','Pushing a foe into a wall, door or unit adds damage.')+
   r('🚪','Doors','Fight in doorways so one foe reaches you.')+
   r('💤','Unaware foes','Marked z. Rogues and daggers get sneak bonuses.')+
   r('🐉','Dragon','Floor '+MAXF+'. Breath along a line, whelps at '+BAL.enemyAi.summonAt.map(pct).join(' and ')+' HP.'))+
  sec('Dungeon',
   r('🔺','Traps','Shown when next to them. Paths and Explore avoid them.')+
   r('🗿','Shrine','Step on it for a gamble. You can Leave.')+
   r('🔒','Vault','The marked elite holds the key.')+
   r('🧔','Merchant','Floors '+BAL.merchant.floors.join(' and ')+'. Spend run gold.')+
   r('🛤','Paths','Each exit offers two routes.')+
   r('🌑','Modifiers','Icon at the map corner. '+MODS.map(m=>m.e+' '+m.n).join(', ')+'.')+
   r('📍','Minimap dots','You cyan, stairs yellow, foes red, elite orange, trap pink, shrine purple, merchant green.'))+
  sec('Modes',
   r('🤖','Auto','☰ → Auto play ('+(1000/BAL.auto.tickMs)+' turns/s at 1×). Any tap takes over. Banks '+autoGoldWord()+' gold.')+
   r('📅','Daily','Same dungeon for everyone today. Never Hard.')+
   r('💀','Hard','Unlocked by a win. '+HARD_RULES.map(x=>x.n).join(', ')+'.')+
   r('🛒','Upgrades','Spend banked gold on the title screen.')+
   r('🔊','Sound','Off by default. ☰ menu or More.'));
 if(G&&!G.over){
  const C=clsOf(G.p);let k2='';
  for(const k of C.kit){const a=ABIL[k];k2+=r(a.e,a.n+' <small>('+abCost(k)+')</small>',abilityDesc(k));}
  h+=sec(C.e+' '+C.n,k2);
 }else{
  let k2='';
  for(const c of Object.keys(CLS)){const C=CLS[c];k2+=r(C.e,C.n,classBlurb(c)+'<br>'+C.kit.map(k=>ABIL[k].e+' '+ABIL[k].n+': '+abilityDesc(k)).join('<br>'));}
  h+=sec('Classes',k2);
 }
 showModal('Controls',h,[{label:'Back',c:1,big:1,fn:function(){if(back)back();else closeModal();}}]);
}
