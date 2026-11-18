// help.js - the Controls / help screen text. Short hints; every number is generated from BAL and the tables.

function showHelp(back){
 const r=(ic,n,d)=>'<div class="pl"><b>'+ic+' '+n+'</b> <small>'+d+'</small></div>';
 const P=BAL.potion;
 let h='<p><b>Tap</b></p>'+
  r('👆','A tile','Walk there. Stops if danger appears.')+
  r('⚔️','An enemy','Next to you: attack. Farther: inspect and approach.')+
  r('🗺','The minimap','Big map. Tap again to close.')+
  r('⏳','Yourself','Wait one turn.')+
  '<p><b>Buttons</b></p>'+
  r('🎯','Ability row','Four class abilities. Dim = not usable now (tap for why). Targeted ones light up tiles: tap one, or tap the button again to cancel.')+
  r('🎒','Items','Potion (heals '+pct(P.healFrac)+' HP), Flames (burns all in sight), Teleport (random far spot). Badge = total carried.')+
  r('🧭','Explore','Auto-walks to unexplored areas, then the stairs. Stops when an enemy appears or danger shows.')+
  r('⬇️','Stairs','Lit up when you stand on ▼.')+
  r('🎒☰','Top bar','🎒 gear, stats, abilities, perks. ☰ menu: Auto, Perks, Controls, Sound.')+
  r('❤️','HP, resource','Red = HP. Next: Rage (Warrior), Mana (Mage) or Knives (Rogue). Thin bar = XP.')+
  '<p><b>Tips</b></p>'+
  r('🟥','Red tiles','Next big hit lands there. Step off and it misses.')+
  r('🛡️','Guards','Take '+pct(BAL.weapon.shieldFront)+' from the front. Stun them, or hit from behind.')+
  r('💥','Knockback','Pushing a foe into a wall, door or unit adds damage.')+
  r('🚪','Doors','Tap to open. Fight in doorways so one foe reaches you.')+
  r('💤','Unaware foes','Dim with a z. Rogues and daggers get sneak bonuses.')+
  r('🐉','Dragon','Floor '+MAXF+'. Breath along a line, whelps at '+BAL.enemyAi.summonAt.map(pct).join(' and ')+' HP.')+
  '<p><b>Dungeon</b></p>'+
  r('🔺','Traps','Shown when you are next to them. Explore avoids them.')+
  r('🗿','Shrine','Step on it for a gamble. You can Leave.')+
  r('🔒','Vault','Its key is on the marked elite. Tap the door holding the key.')+
  r('🧔','Merchant','Floors '+BAL.merchant.floors.join(' and ')+'. Tap him to spend run gold.')+
  r('🛤','Paths','Each exit offers two routes with a theme and modifier.')+
  r('🌑','Modifiers','Icon at the top left of the map; tap for a reminder. '+MODS.map(m=>m.e+' '+m.n).join(', ')+'.')+
  r('🗺','Minimap dots','You cyan, stairs yellow, foes red, elite orange, trap pink, shrine purple, merchant green.')+
  '<p><b>Modes</b></p>'+
  r('🤖','Auto','☰ → Auto play. Plays for you ('+(1000/BAL.auto.tickMs)+' turns/s at 1×). Top bar: speed and stop. Any tap takes over. Banks '+autoGoldWord()+' gold.')+
  r('📅','Daily','Same dungeon for everyone today. Never Hard.')+
  r('💀','Hard','Unlocked by a win; switch it on when picking a class. '+HARD_RULES.map(x=>x.n).join(', ')+'.')+
  r('🛒','Upgrades','Spend banked gold on boosts and unlocks (title screen).')+
  r('🔊','Sound','Off by default. ☰ menu or More on the title.');
 if(G&&!G.over){
  const C=clsOf(G.p);h+='<p><b>'+C.e+' '+C.n+'</b></p>';
  for(const k of C.kit){const a=ABIL[k];h+=r(a.e,a.n+' <small>('+abCost(k)+')</small>',abilityDesc(k));}
 }else{
  h+='<p><b>Classes</b></p>';
  for(const c of Object.keys(CLS)){const C=CLS[c];h+=r(C.e,C.n,classBlurb(c)+'<br>'+C.kit.map(k=>ABIL[k].e+' '+ABIL[k].n+': '+abilityDesc(k)).join('<br>'));}
 }
 showModal('Controls',h,[{label:'Back',c:1,big:1,fn:function(){if(back)back();else closeModal();}}]);
}
