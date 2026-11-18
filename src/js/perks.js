// perks.js - perk lookup, granting, synergies.

function pc(id){return (G&&G.perks&&G.perks[id])||0;}
function perkById(id){return PERKS.find(x=>x.id===id);}
function checkSyn(){
 for(const s of SYN)if(pc(s.a)&&pc(s.b)&&!G.syn[s.id]){G.syn[s.id]=1;msg('Synergy! '+s.n+': '+s.d+'.');}
}
function addPerk(id){
 const pk=perkById(id);if(!G||!pk||pc(id)>=pk.max)return false;
 G.perks[id]=pc(id)+1;if(pk.f)pk.f(G.p);
 msg('Perk gained: '+pk.n+(pk.max>1?' (Lv '+pc(id)+')':'')+'.');checkSyn();return true;
}

// perks the current player can still be offered: unlocked, not maxed, and for their class
function perkPool(){return PERKS.filter(pk=>(!pk.lock||meta.unl[pk.lock])&&(!pk.bp||bpOn(pk.id))&&(!pk.cls||pk.cls===G.p.cls)&&pc(pk.id)<pk.max);}
function randomPerkId(){const pool=perkPool();return pool.length?pick(pool).id:null;}
