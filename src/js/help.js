// help.js - the Controls / help screen text.

function showHelp(back){
 const r=(ic,n,d)=>'<div class="pl"><b>'+ic+' '+n+'</b><br><small>'+d+'</small></div>';
 let h='<p><b>Bottom bar</b></p>'+
  r('🧪','Potion','Heals about 40% of your max HP (min 12). Takes a turn. The badge shows potions carried.')+
  r('🔥','Fireball','Damages every enemy you can see. Takes a turn. Not used if no enemy is in sight.')+
  r('🌀','Teleport','Moves you to a random spot far away. Takes a turn.')+
  r('🧭','Explore','Auto-walks to unexplored areas (opening doors), then to the stairs. Keeps going past unnoticed enemies (avoiding stepping next to them); stops when one wakes up, a new one appears, or red danger tiles show up. It routes around known traps.')+
  r('⏳','Wait','Skips a turn (also: tap yourself).')+
  r('⬇️','Stairs','Goes down one floor when you stand on the ▼ tile.')+
  '<p><b>Tap controls</b></p>'+
  r('👆','Tap a tile','Walk there (stops if danger appears).')+
  r('⚔️','Tap an adjacent enemy','Attack it. Tap a distant enemy to see its info and walk toward it.')+
  r('🗺','Tap the minimap','Opens the big map; tap again to close.')+
  '<p><b>Combat tips</b></p>'+
  r('🟥','Danger tiles','Heavy enemies (troll, dragon) wind up for one turn. Red hatched tiles show exactly what is hit next turn. Step off them and you take nothing; stay and it hurts about double. Auto-walk and Explore stop and never path through them.')+
  r('💥','Knockback','Shield Bash and troll smashes push a target one tile. Into a wall, a closed door or another unit means bonus damage; into open floor it just moves. Bosses cannot be pushed.')+
  r('🚪','Doors','Tap a door to open it (it uses your turn). Closed doors block sight; monsters open them too. Fight in a doorway or corridor so only one enemy can reach you, and archers need a clear line.')+
  r('💤','Unaware enemies','Dim enemies with a z have not noticed you: the Rogue deals double damage to them. An hourglass on an Ogre means it is resting this turn.')+
  '<p><b>Dungeon features</b></p>'+
  r('🔺','Traps','Hidden until you are next to them, then drawn clearly. Spike (grey spikes) hurts, dart (green) poisons you, alarm (bell) wakes the whole floor. Auto-walk and Explore route around revealed traps; enemies can trigger them too. Pink dot on the minimap.')+
  r('🗿','Shrines','Some floors have one. Step on it (or tap yourself on it) for a risky choice - heal, perk, or power for a price. You can always Leave. Purple dot on the minimap.')+
  r('🔒','Locked room and key','A locked iron door hides a treasure room (gear with a trait plus gold). The key drops from the marked elite on that floor: a named, tougher enemy with a gold ring and a star (orange on the minimap). Tap the door with the key in hand to open it. Red-orange on the minimap.')+
  r('🧔','Merchant','On floors 3 and 6. He is not hostile and cannot be hit by accident: tap him to open the shop (potions, scrolls, gear, a perk) and spend run gold. Green dot on the minimap.')+
  r('🏰','Themes','Floors 1-3 are the Crypt, 4-6 the Caverns (irregular rooms), 7-8 the Embers. The name shows when you arrive.')+
  r('🔊','Sound & vibration','Off by default (handy on a plane). Switch it on in the ☰ menu or on the title screen. Sounds are generated in the page; no downloads.')+
  r('🔓','Unlocks','On the title screen, spend banked gold on unlocks: classes, extra perks for the level-up pool, a starting scroll and more. Some unlock by playing (reach floor 4, slay 50 enemies, slay an elite, defeat the dragon).')+
  r('🗺','Minimap colours','Cyan you, yellow stairs, red enemies, orange elite, pink traps, purple shrine, green merchant, orange-red locked door.')+
  '<p><b>Top bar</b></p>'+
  r('🏰','Floor','Current floor out of '+MAXF+'. Slay the dragon on the last one.')+
  r('Lv','Level / XP','Level up to choose a perk.')+
  r('⚔️','Attack','Your damage bonus. 🛡 is defense, which cuts damage taken. 💰 is gold, banked when the run ends.')+
  r('?','Controls','This screen. ☰ is the menu with gear and perks.');
 if(G&&!G.over){
  const C=clsOf(G.p);h+='<p><b>Your abilities</b></p>'+r(C.e,C.n,C.ab+' Ability buttons appear in a row above the bar: tap to arm, tap a target, tap again to cancel. Costs a turn.');
  for(const a of ABIL)if(!a.cls&&pc(a.perk)>0){const pk=perkById(a.perk);h+=r(a.e,pk.n,pk.d);}
 }else h+='<p>Pick a class when you start a run: each has its own ability. Perks like Dash and Arcane Bolt add more buttons.</p>';
 h+='<p>Gold collected is banked when a run ends and buys permanent upgrades on the title screen. Progress autosaves every turn. The game is strictly turn-based.</p>';
 showModal('Controls',h,[{label:'Back',c:1,big:1,fn:function(){if(back)back();else closeModal();}}]);
}
