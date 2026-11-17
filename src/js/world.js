// world.js - queries over the current game state (G): who/what is on a tile, walkability, message log.

function nm(e){return e.elite?'elite '+EN[e.t].n+' '+(e.name||''):EN[e.t].n;}
function merchantAt(x,y){return !!(G&&G.merchant&&G.merchant.x===x&&G.merchant.y===y);}
function walkable(x,y){return inb(x,y)&&G.map[ix(x,y)]!==0&&G.map[ix(x,y)]!==5&&!merchantAt(x,y);}
function trapAt(x,y){for(const t of G.traps)if(t.x===x&&t.y===y&&!t.done)return t;return null;}
function trapSet(){const st=new Set();if(G&&G.traps)for(const t of G.traps)if(t.rev&&!t.done)st.add(ix(t.x,t.y));return st;}
function enemyAt(x,y){for(const e of G.enemies)if(e.x===x&&e.y===y)return e;return null;}
function itemAt(x,y){for(const i of G.items)if(i.x===x&&i.y===y)return i;return null;}
function msg(t){
 const last=G.log[G.log.length-1],m=last&&last.match(/^(.*) \(x(\d+)\)$/),base=m?m[1]:last;
 if(base===t){G.log[G.log.length-1]=t+' (x'+((m?+m[2]:1)+1)+')';renderLog();return;}
 G.log.push(t);if(G.log.length>30)G.log.shift();renderLog();}
