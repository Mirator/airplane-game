// mods.js - floor modifiers (rules for the 8 in MODS), the two-way exit choice and the HUD chip. Numbers: BAL.mod; text: MODS in balance.js.

function modIs(id){return !!G&&G.mod===id;}
function goldMod(){return modIs('rich')?BAL.mod.rich.goldMul:1;}
function visRadius(){return modIs('dark')?BAL.mod.dark.sight:modIs('silent')?BAL.mod.silent.sight:BAL.vis.radius;}
function enemySight(){return modIs('silent')?BAL.mod.silent.sight:BAL.enemyAi.sightRange;}
function waterSet(){const w=G&&G.water;if(!w||!w.length)return wsc.empty||(wsc.empty=new Set());if(wsc.arr!==w){wsc.arr=w;wsc.set=new Set(w);}return wsc.set;}
function crackSet(){const st=new Set();if(G&&G.cracks)for(const c of G.cracks)st.add(ix(c.x,c.y));return st;}
// hp / attack multipliers a modifier or Hard mode puts on a freshly created enemy of kind d
function enemyMul(d){
 let hp=1,atk=1;const M=BAL.mod,H=BAL.hard;
 if(!d.boss){
  if(modIs('horde')){hp*=M.horde.hpMul;atk*=M.horde.atkMul;}
  if(modIs('rich')){hp*=M.rich.hpMul;atk*=M.rich.atkMul;}
  if(G.hard){hp*=H.hpMul;atk*=H.atkMul;}
 }else if(G.hard)atk*=H.bossAtkMul;
 return [hp,atk];
}
// Flooded: a few pools per room on plain floor tiles that hold nothing else. Water never blocks movement, so reachability is untouched.
function placeWater(rooms,taken){
 const M=BAL.mod.flooded,out=[],used=new Set();
 for(const r of rooms){
  if(r.w>=BAL.map.bossRoomW)continue;
  const ok=(x,y)=>inb(x,y)&&G.map[ix(x,y)]===1&&!taken.has(ix(x,y))&&!used.has(ix(x,y))&&x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h;
  let sx=-1,sy=-1;
  for(let a=0;a<30;a++){const x=rnd(r.x,r.x+r.w-1),y=rnd(r.y,r.y+r.h-1);if(ok(x,y)){sx=x;sy=y;break;}}
  if(sx<0)continue;
  const want=rnd(M.poolMin,M.poolMax),cells=[[sx,sy]];used.add(ix(sx,sy));
  for(let i=0;i<cells.length&&cells.length<want;i++){
   for(const d of shuf(DIRS.slice())){
    const x=cells[i][0]+d[0],y=cells[i][1]+d[1];
    if(cells.length<want&&ok(x,y)){used.add(ix(x,y));cells.push([x,y]);}
   }
  }
  for(const c of cells)out.push(ix(c[0],c[1]));
 }
 G.water=out;
}
// Hunted: one tough enemy, awake and never losing track of you, placed far from the start
function addHunter(f,others,free,reach){
 const pool=Object.keys(EN).filter(k=>{const d=EN[k];return !d.boss&&!d.pack&&!d.flat&&!d.range&&d.hp>=12&&d.minF<=f&&(!d.maxF||f<=d.maxF);});
 const type=pick(pool.length?pool:['goblin']);
 const rs=others.slice().sort((a,b)=>reach[ix(b.cx,b.cy)]-reach[ix(a.cx,a.cy)]);
 for(const r of rs){
  const t=free(r,8);if(!t)continue;
  const e=makeEnemy(type,t[0],t[1],f),M=BAL.mod.hunted;
  e.hp=e.mhp=Math.round(e.mhp*M.hpMul);e.atk=Math.round(e.atk*M.atkMul);e.hunter=1;e.awake=true;e.alarm=1;
  return e;
 }
 return null;
}
function huntReward(e){
 const M=BAL.mod.hunted,g=newGear(['weapon','weapon','armor','armor','off','charm'][rnd(0,5)],G.floor,true);
 dropAt(e.x,e.y,{t:g.t,k:g.k,v:g.v,tr:g.tr});
 dropAt(e.x,e.y,{t:'gold',v:M.rewardGold+G.floor*M.rewardGoldPerFloor});
 dropAt(e.x,e.y,{t:'potion',v:0});
 floatFx(e.x,e.y,'SPOILS','#ffd24a',true);msg('The stalker falls and drops its spoils!');
 earn('hunt');
}
// Unstable: cracks appear near you, turn into a hole after BAL.mod.unstable.warn turns and hurt whatever stands there
function crackTick(){
 if(!modIs('unstable')||G.won)return;
 const U=BAL.mod.unstable,p=G.p,keep=[],boom=[];
 for(const c of G.cracks){if(--c.t>0)keep.push(c);else boom.push(c);}
 G.cracks=keep;
 for(const c of boom){
  puffAdd(c.x,c.y);
  const d=U.dmgBase+Math.floor(G.floor/U.dmgFloorDiv);
  if(p.hp>0&&p.x===c.x&&p.y===c.y){p.hp-=d;G.killer='a collapsing floor';playerHurtFx(d);floatFx(p.x,p.y,'-'+d,'#ff5a5a');msg('The floor collapses under you! -'+d+' HP.');secondWind();}
  const e=enemyAt(c.x,c.y);
  if(e&&!e.dead){hurtEnemy(e,d*U.enemyMul,'#ffb04a');if(G.vis[ix(c.x,c.y)])msg('The floor collapses under the '+nm(e)+'!');settle(e,'The floor');}
 }
 G.crackT=(G.crackT||0)+1;
 if(G.crackT%U.every===0){
  const have=crackSet();let onMe=false;
  for(let i=0;i<U.count;i++){
   let tgt=null;
   if(rf()<U.onPlayer&&!have.has(ix(p.x,p.y))&&G.map[ix(p.x,p.y)]===1)tgt=[p.x,p.y];
   for(let a=0;a<25&&!tgt;a++){
    const x=p.x+rnd(-U.radius,U.radius),y=p.y+rnd(-U.radius,U.radius);
    if(inb(x,y)&&G.map[ix(x,y)]===1&&!have.has(ix(x,y))&&!merchantAt(x,y)&&!(G.shrine&&G.shrine.x===x&&G.shrine.y===y))tgt=[x,y];
   }
   if(tgt){have.add(ix(tgt[0],tgt[1]));G.cracks.push({x:tgt[0],y:tgt[1],t:U.warn});if(tgt[0]===p.x&&tgt[1]===p.y)onMe=true;}
  }
  if(onMe)msg('The ground under you cracks - move!');
 }
}
// ---- exits: two ways down ----
// The two options for the floor below. Both lead to the same depth, so a merchant floor has its merchant on either branch. In a Daily
// the options come from the date alone (never from earlier choices).
let dbgForce=null;   // test/sim hook: every exit offers only this modifier
function rollOpts(nf){
 if(dbgForce&&modOf(dbgForce)&&modOf(dbgForce).minF<=nf)return [{mod:dbgForce,v:0},{mod:dbgForce,v:1}];
 const go=function(){
  const avail=MODS.filter(m=>m.minF<=nf),roll=()=>rf()<BAL.mod.chance?pick(avail).id:null;
  let a=roll(),b=roll();
  if(a&&a===b)b=pick(avail.filter(m=>m.id!==a)).id;
  if(!a&&!b){const m=pick(avail).id;if(rf()<0.5)a=m;else b=m;}
  const sw=rf()<0.5;
  return [{mod:a,v:sw?1:0},{mod:b,v:sw?0:1}];
 };
 return G.daily?withStream(hashStr(G.daily+'|O'+nf),go):go();
}
function optHtml(nf,o){
 const m=o.mod?modOf(o.mod):null,th=themeOf(nf,o.v);
 return '<b>'+th.n+' &middot; '+(m?ic(m.e,18)+' '+m.n:'Plain floor')+'</b><span>'+
  (m?'<i style="color:#ff9a8a;font-style:normal">Risk:</i> '+m.r+'<br><i style="color:#8fe39a;font-style:normal">Gain:</i> '+m.g:'No surprises, no extra loot.')+
  (BAL.merchant.floors.includes(nf)?'<br>'+ic('merchant',18)+' Merchant':'')+'</span>';
}
function showBranch(){
 if(!G||G.over)return;walkTok++;
 const nf=G.floor+1;if(!G.opts)G.opts=rollOpts(nf);
 const btns=G.opts.map(function(o,i){return {k:'opt'+i,html:optHtml(nf,o),fn:function(){closeModal();goDown(o);}};});
 btns.push({k:'stay',esc:1,label:'Stay here',c:1,fn:closeModal});
 showModal('Floor '+nf+': pick a path','',btns,'path');
}
// the one map chip: the floor modifier as a small icon; tap it for a one-line reminder (Daily / Hard show in the top bar)
function modChipHtml(){
 const m=G.mod?modOf(G.mod):null;
 return m?'<button class="chip mod" data-chip="mod" aria-label="'+m.n+'">'+ic(m.e,28)+'</button>':'';
}
function chipText(k){
 if(k==='mod'){const m=modOf(G.mod);return m?m.n+': '+m.tip:'';}
 return '';
}
$('chips').addEventListener('click',function(ev){
 const c=ev.target.closest&&ev.target.closest('[data-chip]');if(!c||!G)return;
 toast(chipText(c.getAttribute('data-chip')),5200);
});
