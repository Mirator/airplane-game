// help.js - the Controls / help screen text. Every number is generated from BAL and the tables.

function showHelp(back){
 const r=(ic,n,d)=>'<div class="pl"><b>'+ic+' '+n+'</b><br><small>'+d+'</small></div>';
 const P=BAL.potion,A=BAL.ability;
 let h='<p><b>Bottom bar</b></p>'+
  r('🧪','Potion','Heals about '+pct(P.healFrac)+' of your max HP (min '+P.minHeal+'). Takes a turn. The badge shows potions carried.')+
  r('📜','Flames','A flame scroll: damages every enemy you can see. Takes a turn. Not used if no enemy is in sight.')+
  r('🌀','Teleport','Moves you to a random spot far away. Takes a turn.')+
  r('🧭','Explore','Auto-walks to unexplored areas (opening doors), then to the stairs. Keeps going past unnoticed enemies (avoiding stepping next to them); stops when one wakes up, a new one appears, or red danger tiles show up. It routes around known traps.')+
  r('⏳','Wait','Skips a turn (also: tap yourself).')+
  r('⬇️','Stairs','Goes down one floor when you stand on the ▼ tile.')+
  '<p><b>Ability buttons (the row above the bar)</b></p>'+
  r('🎯','Four abilities per class','Each button shows its icon, name and cost (or the turns until it recharges). A dim button cannot be used right now: tap it and the log says why. Self abilities fire at once. Targeted ones arm: valid tiles light up, tap one to use it, or tap yourself / the red Cancel button to back out. Every ability uses one turn.')+
  r('⚔️','Weapons','Sword: balanced. Axe: hits the enemies next to you or the target too. Spear: reach '+WP.spear.reach+' - tap an enemy two tiles away in a straight line. Dagger: crit and sneak bonus. Staff: spell power and mana, weak melee.')+
  r('🛡','Armor, off-hand, charm','Armor trades defense for resources (plate: strong but slows mana and rage; robe: spell power and mana but no defense; leather: dodge). Each class has its own off-hands that change one ability. A charm is one passive rule. Tap 🎒 to see everything you wear.')+
  '<p><b>Tap controls</b></p>'+
  r('👆','Tap a tile','Walk there (stops if danger appears).')+
  r('⚔️','Tap an adjacent enemy','Attack it. Tap a distant enemy to see its info and walk toward it.')+
  r('🗺','Tap the minimap','Opens the big map; tap again to close.')+
  '<p><b>Combat tips</b></p>'+
  r('🟥','Danger tiles','Heavy enemies (troll, dragon) wind up for one turn. Red hatched tiles show exactly what is hit next turn. Step off them and you take nothing; stay and it hurts about double. Auto-walk and Explore stop and never path through them.')+
  r('🛡️','Shielded enemies','The Guard shows a bar on the side it faces. It takes '+pct(BAL.weapon.shieldFront)+' damage from the front and '+pct(BAL.weapon.shieldRanged)+' from ranged hits. Stunned or frozen guards drop their guard; hitting from behind is full damage.')+
  r('💥','Knockback','Shield Bash and troll smashes push a target one tile. Into a wall, a closed door or another unit means bonus damage; into open floor it just moves. Bosses cannot be pushed.')+
  r('🚪','Doors','Tap a door to open it (it uses your turn). Closed doors block sight; monsters open them too. Fight in a doorway or corridor so only one enemy can reach you, and archers need a clear line.')+
  r('💤','Unaware enemies','Dim enemies with a z have not noticed you: the Rogue deals x'+BAL.combat.sneakMul+' damage to them, and anyone with a dagger gets a sneak bonus. An hourglass on an Ogre means it is resting this turn.')+
  r('🐉','The Dragon','It calls whelps at '+BAL.enemyAi.summonAt.map(pct).join(' and ')+' health (area attacks shine), breathes fire in a line and, once enraged, sweeps all tiles around itself. It cannot be pushed, but a stun, freeze or blind cancels its wind-up.')+
  '<p><b>Dungeon features</b></p>'+
  r('🔺','Traps','Hidden until you are next to them, then drawn clearly. Spike (grey spikes) hurts, dart (green) poisons you, alarm (bell) wakes the whole floor. Auto-walk and Explore route around revealed traps; enemies can trigger them too. Pink dot on the minimap.')+
  r('🗿','Shrines','Some floors have one. Step on it (or tap yourself on it) for a risky choice - heal, perk, or power for a price. You can always Leave. Purple dot on the minimap.')+
  r('🔒','Locked room and key','A locked iron door hides a treasure room (gear with a trait plus gold). The key drops from the marked elite on that floor: a named, tougher enemy with a gold ring and a star (orange on the minimap). Tap the door with the key in hand to open it. Red-orange on the minimap.')+
  r('🧔','Merchant','On floors '+BAL.merchant.floors.join(' and ')+'. He is not hostile and cannot be hit by accident: tap him to open the shop (potions, scrolls, gear, a perk) and spend run gold. Green dot on the minimap.')+
  r('🏰','Themes','Floors 1-3 are the Crypt, 4-6 the Caverns (irregular rooms), 7-8 the Embers. The name shows when you arrive.')+
  r('🔊','Sound & vibration','Off by default (handy on a plane). Switch it on in the ☰ menu or on the title screen. Sounds are generated in the page; no downloads.')+
  r('🔓','Unlocks','On the title screen, spend banked gold on unlocks: classes, extra perks for the level-up pool, a starting scroll and more. Some unlock by playing (reach floor 4, slay 50 enemies, slay an elite, defeat the dragon).')+
  r('🗺','Minimap colours','Cyan you, yellow stairs, red enemies, orange elite, pink traps, purple shrine, green merchant, orange-red locked door.')+
  '<p><b>Top bar</b></p>'+
  r('❤️','HP and resource','The red bar is HP. Next to it: Rage (Warrior), Mana (Mage) or your Knife count (Rogue).')+
  r('🏰','Floor','Current floor out of '+MAXF+'. Slay the dragon on the last one.')+
  r('Lv','Level / XP','Level up to choose a perk.')+
  r('⚔️','Attack','Your melee damage. 🛡 is defense, which cuts damage taken. 💰 is gold, banked when the run ends.')+
  r('🎒','Equipment, ? and ☰','🎒 shows your gear and abilities, ? is this screen, ☰ is the menu.');
 if(G&&!G.over){
  const C=clsOf(G.p);h+='<p><b>Your abilities - '+C.e+' '+C.n+'</b></p>';
  for(const k of C.kit){const a=ABIL[k];h+=r(a.e,a.n+' ('+abCost(k)+')',abilityDesc(k));}
 }else{
  h+='<p><b>The three classes</b></p>';
  for(const c of Object.keys(CLS)){const C=CLS[c];h+=r(C.e,C.n,classBlurb(c));for(const k of C.kit)h+=r(ABIL[k].e,ABIL[k].n+' ('+abCost(k)+')',abilityDesc(k));}
 }
 h+='<p>Gold collected is banked when a run ends and buys permanent upgrades on the title screen. Progress autosaves every turn. The game is strictly turn-based.</p>';
 showModal('Controls',h,[{label:'Back',c:1,big:1,fn:function(){if(back)back();else closeModal();}}]);
}
