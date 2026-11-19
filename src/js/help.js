// help.js - the Controls / help screen text. Short hints; every number is generated from BAL and the tables.

function showHelp(back){
 const r=(i,n,d)=>'<div class="pl"><b>'+ic(i,20)+' '+n+'</b> <small>'+d+'</small></div>';
 const sec=(t,body)=>'<details class="hsec"><summary>'+t+'</summary>'+body+'</details>';
 const P=BAL.potion;
 // essentials first (about 100 words), everything else folded away
 let h='<div class="hess">'+
  '<p><b>Tap</b> a tile to walk, an enemy to attack, yourself to wait.</p>'+
  '<p><b>Hold</b> (or right-click) a foe, a tile or yourself to inspect it. Tap to close.</p>'+
  '<p><b>Abilities:</b> tap one, then a lit tile. Self ones (Cleave, Nova, Brace, Vanish): tap again to use. Dim ones say why.</p>'+
  '<p><b>Red tiles</b> hit next turn: step off. Walking onto danger needs a second tap.</p>'+
  '<p><b>Explore</b> finds new ground, then the stairs. <b>Items</b> holds potion, flames, teleport. The menu has Auto, perks and sound.</p></div>'+
  sec('Buttons and bars',
   r('ab_bash','Ability row','Four class abilities. Tap again to cancel aiming.')+
   r('bag','Items','Potion (heals '+pct(P.healFrac)+' HP), Flames (burns all in sight), Teleport (random far spot).')+
   r('compass','Explore','Stops when an enemy appears or danger shows.')+
   r('down','Stairs','Lit up when you stand on ▼.')+
   r('equip','Top bar','Gear and stats, then the menu. A badge on gear counts waiting level-up perks: tap it (or P).')+
   r('heart','Bars','Red HP, then Rage / Mana / Knives. Thin bar = XP.')+
   r('map','Minimap','Tap for the big map.'))+
  sec('Keyboard','<p class="sub">Arrows or WASD move and attack. 1-4 abilities (again to use). Space wait, E explore, I items, Q potion, P perk, Enter stairs, Esc cancel or menu. Right-click inspects.</p>')+
  sec('Fighting',
   r('guard','Guards','Take '+pct(BAL.weapon.shieldFront)+' from the front. Stun them or hit from behind.')+
   r('ab_bolt','Mage shot','Tap a foe within '+BAL.shot.range+' tiles: free weak shot.')+
   r('ab_cleave','Straight lines','Melee and Bash go up, down, left, right. Cleave and Nova also reach diagonals. Foes cannot strike diagonally either.')+
   r('ab_bash','Knockback','Pushing a foe into a wall, door or unit adds damage.')+
   r('door','Doors','Fight in doorways so one foe reaches you.')+
   r('st_sleep','Unaware foes','Marked z. Rogues and daggers get sneak bonuses.')+
   r('dragon','Dragon','Floor '+MAXF+'. Breath along a line, whelps at '+BAL.enemyAi.summonAt.map(pct).join(' and ')+' HP.'))+
  sec('Dungeon',
   r('shrine','Shrine','Step on it for a gamble. You can Leave.')+
   r('door_locked','Vault','The marked elite holds the key.')+
   r('merchant','Merchant','Floors '+BAL.merchant.floors.join(' and ')+'. Spend run gold.')+
   r('path','Paths','Each exit offers two routes.')+
   r('m_dark','Modifiers','Icon at the map corner. '+MODS.map(m=>m.n).join(', ')+'.')+
   r('map','Minimap dots','You white, stairs gold, foes red, elite orange, shrine and merchant cyan.'))+
  sec('Modes',
   r('auto','Auto','Menu, Auto play ('+(1000/BAL.auto.tickMs)+' turns/s at 1×). Any tap takes over. Earns idle pay, not run gold.')+
   r('cal','Daily','Same dungeon for everyone today. Never Hard.')+
   r('skull','Heat','Win to unlock Heat 1 (Hard), then win at each Heat to unlock the next. Harder dungeon, more gold, rare blueprints.')+
   r('map','Expeditions','Send a hero away for 30 min to 8 h. It returns with gold and blueprints.')+
   r('cart','Upgrades','Spend gold on levels and blueprints on the title screen.')+
   r('snd','Sound','Off by default. menu or More.'));
 if(G&&!G.over){
  const C=clsOf(G.p);let k2='';
  for(const k of C.kit){const a=ABIL[k];k2+=r(a.e,a.n+' <small>('+abCost(k)+')</small>',abilityDesc(k));}
  h+=sec(ic(C.e,18)+' '+C.n,k2);
 }else{
  let k2='';
  for(const c of Object.keys(CLS)){const C=CLS[c];k2+=r(C.e,C.n,classBlurb(c)+'<br>'+C.kit.map(k=>ic(ABIL[k].e,16)+' '+ABIL[k].n+': '+abilityDesc(k)).join('<br>'));}
  h+=sec('Classes',k2);
 }
 showModal('Controls',h,[{label:'Back',c:1,big:1,fn:function(){if(back)back();else closeModal();}}],'help');
}
