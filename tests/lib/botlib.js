// Heuristic in-page bot used by tests/sim.js. Injected with page.addScriptTag; drives the game
// only through window.__dbg and visible buttons. Exposes window.BOT = {runOne, resetMeta, spend, think, handle}.
(function(){
const W=30,H=30,DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
const ix=(x,y)=>y*W+x;
const $=id=>document.getElementById(id);
const GG=()=>window.__dbg(),F=()=>window.__dbg.fn,A=()=>window.__dbg.api;
const click=id=>$(id).click();
const modalVisible=()=>$('modal').style.display!=='none';
const inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
function walk(G,x,y){if(!inb(x,y))return false;const t=G.map[ix(x,y)];if(t===0||t===5)return false;const m=G.merchant;if(m&&m.x===x&&m.y===y)return false;return true;}
function enemyAt(G,x,y){for(const e of G.enemies)if(e.x===x&&e.y===y)return e;return null;}
function los(G,x0,y0,x1,y1){
 let dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,err=dx-dy,x=x0,y=y0;
 while(!(x===x1&&y===y1)){
  if(!(x===x0&&y===y0)){const t=G.map[ix(x,y)];if(t===0||t===3||t===5)return false;}
  const e2=2*err;if(e2>-dy){err-=dy;x+=sx;}if(e2<dx){err+=dx;y+=sy;}
 }
 return true;
}
function bfs(G,sx,sy,block,passEnemies){
 const dist=new Int16Array(W*H).fill(-1),prev=new Int16Array(W*H).fill(-1),order=[];
 const q=[ix(sx,sy)];dist[q[0]]=0;
 const en=new Set(G.enemies.map(e=>ix(e.x,e.y)));
 for(let i=0;i<q.length;i++){
  const k=q[i],x=k%W,y=(k/W)|0;order.push(k);
  for(const d of DIRS){
   const nx=x+d[0],ny=y+d[1];if(!inb(nx,ny))continue;const nk=ix(nx,ny);
   if(dist[nk]>=0||!G.seen[nk]||!walk(G,nx,ny)||block.has(nk))continue;
   if(!passEnemies&&en.has(nk))continue;
   dist[nk]=dist[k]+1;prev[nk]=k;q.push(nk);
  }
 }
 return {dist,prev,order};
}
function pathTo(r,goal){const p=[];let k=goal;while(r.prev[k]>=0){p.push(k);k=r.prev[k];}p.reverse();return p;}
function stepK(G,k){
 const p=G.p,x=k%W,y=(k/W)|0;
 return F().tryMove(x-p.x,y-p.y);
}
const PW={Vitality:8,Might:8,Bulwark:7,Vampirism:6,'Keen Eye':4,Renewal:6,Thorns:3,'Deep Pockets':4,Evasion:3,Scholar:3,Pyromancer:3,Regeneration:5,'Treasure Hunter':2,Tempo:6,Venom:7,'Chain Lightning':5,Bloodlust:4,Riposte:5,'Second Wind':8,'Glass Cannon':3,Scavenger:4,Berserk:5,Executioner:6,Warlord:9,'Phoenix Heart':9,Trapfinder:3,'Midas Touch':3,Alchemist:4,
 Fury:6,Retribution:6,Stampede:4,'Arcane Mastery':8,Wellspring:8,'Deep Freeze':4,'Phase Step':4,Assassin:8,Bandolier:4,'Shadow Cloak':5};
const PKEYS=Object.keys(PW).sort((a,b)=>b.length-a.length);
function pickPerk(G,btns){
 let best=null,bs=-1;
 for(const b of btns){
  const nm=(b.querySelector('b').textContent||'').trim();let k=PKEYS.find(k=>nm.startsWith(k));let s=(PW[k]||1)+Math.random()*0.5;
  if(G.p.cls==='mage'&&(k==='Vitality'||k==='Bulwark'))s+=2;
  if(G.p.cls==='mage'&&k==='Pyromancer')s+=3;
  if(k==='Glass Cannon'&&G.p.mhp<45)s-=3;
  if(s>bs){bs=s;best=b;}
 }
 (best||btns[0]).click();
}
// ---- gear heuristic: score = rough "worth" of an item for this class; equip when clearly better ----
const TB={cursed:-2,vamp:1.5,brutal:-0.5,keen:0.8,heavy:-2,spiked:0.5,leaden:-1.5};
const WAFF={warrior:{sword:0.5,axe:1.5,spear:1,dagger:-1.5,staff:-4},mage:{sword:0,axe:-1,spear:-1,dagger:-2,staff:5},rogue:{sword:0,axe:-0.5,spear:0.5,dagger:3,staff:-4}};
const AAFF={warrior:{mail:0,plate:0.5,robe:0,leather:1.2},mage:{mail:0,plate:-3,robe:4,leather:0.5},rogue:{mail:0,plate:-0.5,robe:0,leather:2}};
const OAFF={tower:3,bulwark:2.5,totem:2.5,tome:3,prism:3,lens:2.5,dagger2:4,satchel:3,quiver:3};
const CAFF={fang:3,ward:4,eye:1,hourglass:3.5,veil:2.5,flask:3,soul:3};
function gscore(cls,slot,it){
 if(!it)return slot==='weapon'||slot==='armor'?0:-1;
 const T=window.__dbg.tables,tb=it.tr&&TB[it.tr]!=null?TB[it.tr]:0;
 if(slot==='weapon')return it.v+T.WP[it.k].atk+WAFF[cls][it.k]+tb;
 if(slot==='armor'){const a=T.ARM[it.k];const d=a.noDef?0:Math.max(0,it.v+(a.def||0));return d+AAFF[cls][it.k]+(it.k==='robe'?it.v*0.3:0)+tb;}
 if(slot==='off')return OAFF[it.k]||2;
 return CAFF[it.k]||2;
}
function handleGear(G,btns){
 const p=G.p,it=G.items.find(i=>i.x===p.x&&i.y===p.y&&['weapon','armor','off','charm'].indexOf(i.t)>=0);
 let take=false;
 if(it){take=gscore(p.cls,it.t,it)>gscore(p.cls,it.t,p.eq[it.t])+0.3;
  if(!take)BS.ignore.add(it.x+','+it.y+','+G.floor);}
 const eq=btns.find(b=>/Equip/.test(b.textContent)),lv=btns.find(b=>/Leave/.test(b.textContent));
 (take?eq:lv).click();
}
function handleShrine(G,btns){
 const p=G.p,f=re=>btns.find(b=>re.test(b.textContent));
 let b=null;const hpf=p.hp/p.mhp;
 const bless=f(/Blessing/),pray=f(/Pray/),sac=f(/Sacrifice/),pact=f(/Blood pact/),leave=f(/Leave/);
 if(hpf<0.6)b=bless||(pray);
 else if(sac)b=sac;
 else if(bless&&hpf<0.9)b=bless;
 else if(pact&&p.mhp>=40&&p.cls!=='mage')b=pact;
 (b||leave||btns[btns.length-1]).click();
}
function shopping(G){
 const p=G.p;let guard=0;
 A().showShop();
 while(guard++<12){
  const m=G.merchant;let bi=-1,bv=0;
  m.stock.forEach((it,i)=>{
   if(it.sold||p.gold<it.price)return;let v=0;
   if(it.k==='pot')v=G.inv.pot<p.potCap?(G.inv.pot<2?12:8):0;
   else if(it.k==='elixir')v=9;
   else if(it.k==='perk')v=8;
   else if(it.k==='fire')v=G.inv.fire<2?5:2;
   else if(it.k==='gear'){const sl=it.item.t,d=gscore(p.cls,sl,it.item)-gscore(p.cls,sl,p.eq[sl]);v=d>0.5?3+d*2:0;}
   if(v>bv){bv=v;bi=i;}
  });
  if(bi<0)break;
  A().buy(bi);
 }
 $('modal').style.display='none';
 BS.shopDone[G.floor]=1;
}
// exit choice: score each branch by its modifier (higher = safer for the bot); BOT_CFG.branch can override per modifier
const BRANCH_SCORE={'No modifier':5,Silent:4.5,Flooded:4,Dark:3.5,'Rich vein':3,'Cursed ground':2.5,Unstable:2,Hunted:1.5,Horde:1};
function handleBranch(G,btns){
 const opts=btns.filter(b=>!/Stay here/.test(b.textContent));
 const sc=b=>{const t=b.textContent;let best=-1;for(const k in BRANCH_SCORE)if(t.indexOf(k)>=0)best=(BOT_CFG.branch&&BOT_CFG.branch[k]!=null?BOT_CFG.branch[k]:BRANCH_SCORE[k]);return best;};
 if(BOT_CFG.branchRandom){opts[Math.floor(Math.random()*opts.length)].click();return;}
 opts.sort((a,b)=>sc(b)-sc(a));
 (opts[0]||btns[btns.length-1]).click();
}
function handleModal(G){
 const title=($('modalBox').querySelector('h2')||{}).textContent||'';
 const btns=[...$('modalBox').querySelectorAll('button')].filter(b=>!b.disabled);
 if(/^Level/.test(title))pickPerk(G,btns);
 else if(/found/.test(title))handleGear(G,btns);
 else if(/shrine/i.test(title))handleShrine(G,btns);
 else if(/path/i.test(title))handleBranch(G,btns);
 else (btns[btns.length-1]||{click(){$('modal').style.display='none';}}).click();
}
const lab=(s,v)=>{BS.lb=s;return v;};
const BOT_CFG={kite:1,snipe:1,kiteCap:150,kiteWaitCap:14,choke:1,mageRest:45};
let BS={ignore:new Set(),shopDone:{},wait:0,bad:new Set()};
function sidestep(G,dz){
 const p=G.p;let best=null,bs=-1e9;
 for(const d of DIRS){
  const nx=p.x+d[0],ny=p.y+d[1];if(!walk(G,nx,ny)||enemyAt(G,nx,ny)||G.map[ix(nx,ny)]===3)continue;
  const k=ix(nx,ny);if(dz.has(k))continue;
  let s=0;for(const e of G.enemies)if(e.wind)s+=Math.abs(e.x-nx)+Math.abs(e.y-ny);
  const tp=G.traps.find(t=>t.x===nx&&t.y===ny&&t.rev&&!t.done);if(tp)s-=50;
  if(s>bs){bs=s;best=[d[0],d[1]];}
 }
 if(best){return F().tryMove(best[0],best[1]);}
 return false;
}

// ---- human-style tactics (kiting, sniping sleepers, chokepoints) ----
function multiBfs(G,srcs){
 const d=new Int16Array(W*H).fill(9999),q=[];
 for(const s of srcs){d[ix(s[0],s[1])]=0;q.push(ix(s[0],s[1]));}
 for(let i=0;i<q.length;i++){const k=q[i],x=k%W,y=(k/W)|0;
  for(const dd of DIRS){const nx=x+dd[0],ny=y+dd[1];if(!inb(nx,ny))continue;const nk=ix(nx,ny);if(d[nk]!==9999)continue;const t=G.map[nk];if(t===0||t===5)continue;d[nk]=d[k]+1;q.push(nk);}}
 return d;
}
// number of tiles I can reach strictly before the enemies can (capped): how much room a retreat step really buys
function escapeSpace(G,sx,sy,ed,cap){
 const seenT=new Set([ix(sx,sy)]),q=[[sx,sy,0]];let n=0;
 for(let i=0;i<q.length&&n<cap;i++){const [x,y,s]=q[i];
  for(const d of DIRS){const nx=x+d[0],ny=y+d[1];if(!inb(nx,ny))continue;const k=ix(nx,ny);
   if(seenT.has(k)||!G.seen[k]||!walk(G,nx,ny)||G.map[k]===3)continue;
   if(G.traps.some(t=>t.x===nx&&t.y===ny&&t.rev&&!t.done))continue;
   if(s+1>=ed[k])continue;seenT.add(k);n++;q.push([nx,ny,s+1]);}}
 return n;
}
function kiteStep(G,foes,dz){
 const p=G.p,ed=multiBfs(G,foes.map(e=>[e.x,e.y])),cur=ed[ix(p.x,p.y)];
 let best=null,bs=-1e9;
 for(const d of DIRS){
  const nx=p.x+d[0],ny=p.y+d[1],k=ix(nx,ny);
  if(!walk(G,nx,ny)||enemyAt(G,nx,ny)||G.map[k]===3||dz.has(k)||!G.seen[k])continue;
  if(G.traps.some(t=>t.x===nx&&t.y===ny&&t.rev&&!t.done))continue;
  if(ed[k]<=cur)continue;
  const sp=escapeSpace(G,nx,ny,ed,40);
  if(sp<10)continue;
  const sc=sp+ed[k]*0.5;if(sc>bs){bs=sc;best=[d[0],d[1]];}
 }
 return best;
}
const openN=(G,x,y)=>{let n=0;for(const d of DIRS)if(walk(G,x+d[0],y+d[1]))n++;return n;};
const RANGED=new Set(['archer','warlock','cultist']),TOUGH=new Set(['troll','ogre','dragon','skeleton','guard']),BIG=new Set(['troll','ogre','dragon']);
const TB_=()=>window.__dbg.tables;
const U=(k,x,y)=>{const f8=GG().floor===8,ok=F().use(k,x,y);if(ok){BS.uses[k]=(BS.uses[k]||0)+1;if(f8)BS.uses8[k]=(BS.uses8[k]||0)+1;}return ok;};
const can=k=>!F().whyNot(k);
const cheb1=(G,e)=>Math.max(Math.abs(e.x-G.p.x),Math.abs(e.y-G.p.y))<=1;
const dist1=(G,e)=>Math.abs(e.x-G.p.x)+Math.abs(e.y-G.p.y);
const behind=(G,e)=>!!e.face&&e.face[0]*(G.p.x-e.x)+e.face[1]*(G.p.y-e.y)<0;
const unaware=(G,e)=>!e.awake||e.stun>0||e.frz>0||e.blind>0||behind(G,e);
const guarded=(G,e)=>e.t==='guard'&&!e.stun&&!e.frz&&!behind(G,e);
const prio=(G,e)=>(e.t==='cultist'?-200:RANGED.has(e.t)?-100:0)+(guarded(G,e)?150:0)+e.hp;
const enemyOf=(G,t)=>G.enemies.find(e=>e.x===t[0]&&e.y===t[1]);
// ---- per-class ability choices. Each returns true if it used the turn. ----
function warriorAct(G,awake,adj,hpf){
 const p=G.p,nearA=awake.filter(e=>cheb1(G,e));
 const big=adj.some(e=>BIG.has(e.t)||e.elite);
 if(can('brace')&&!G.brace&&(nearA.length>=2||(big&&hpf<0.9))&&U('brace'))return true;
 if(can('cleave')&&(nearA.length>=2||(nearA.length===1&&p.rage>=TB_().BAL.rage.max-10))&&U('cleave'))return true;
 if(can('bash')){
  const cand=adj.filter(e=>e.awake||hpf<0.6);
  let t=cand.find(e=>e.wind)||cand.find(e=>guarded(G,e))||cand.find(e=>BIG.has(e.t)||e.elite)||(hpf<0.6?cand[0]:null);
  if(!t&&p.eq.off&&p.eq.off.k==='tower'&&cand.length>=2)t=cand[0];
  if(t&&U('bash',t.x,t.y))return true;
 }
 if(can('charge')){
  const ts=F().targetTiles('charge').map(c=>enemyOf(G,c)).filter(e=>e&&e.awake);
  const t=ts.sort((a,b)=>prio(G,a)-prio(G,b)).find(e=>RANGED.has(e.t)||guarded(G,e)||e.t==='dragon'||(BIG.has(e.t)&&e.wind));
  if(t&&U('charge',t.x,t.y))return true;
 }
 return false;
}
function mageAct(G,awake,adj,hpf){
 const p=G.p,B=TB_().BAL.ability,nearA=awake.filter(e=>cheb1(G,e));
 if((hpf<0.7||p.mana>=40)&&nearA.some(e=>!e.stun&&!e.frz)&&p.mana>=B.blink.mana+B.bolt.mana+4&&can('blink')){
  const ed=multiBfs(G,awake.map(e=>[e.x,e.y]));let best=null,bs=-1e9;
  for(const t of F().targetTiles('blink')){const k=ix(t[0],t[1]),dd=ed[k];if(dd<3||G.traps.some(a=>a.x===t[0]&&a.y===t[1]&&a.rev&&!a.done))continue;
   const sc=Math.min(dd,8)+escapeSpace(G,t[0],t[1],ed,30)*0.1;if(sc>bs){bs=sc;best=t;}}
  if(best&&U('blink',best[0],best[1]))return true;
 }
 if(can('nova')&&(nearA.length>=2||(nearA.length===1&&nearA[0].t!=='rat'&&nearA[0].t!=='bat'))&&p.mana>=B.nova.mana+3&&U('nova'))return true;
 if(can('fire')){
  const R=B.fire.radius+(p.eq.off&&p.eq.off.k==='prism'?TB_().BAL.offhand.prismRadius:0);
  let best=null,bc=0,bw=0;
  for(const t of F().targetTiles('fire')){
   let c=0,w=0;for(const e of awake)if(Math.max(Math.abs(e.x-t[0]),Math.abs(e.y-t[1]))<=R){c++;w+=e.t==='dragon'?3:1;}
   if(w>bw||(w===bw&&c>bc)){bw=w;bc=c;best=t;}
  }
  const tough=awake.find(e=>(BIG.has(e.t)||e.elite||e.t==='skeleton'||e.t==='guard')&&e.hp>=25&&dist1(G,e)>=2);
  if(best&&(bw>=2||(awake.some(e=>e.t==='dragon')&&bw>=3))&&U('fire',best[0],best[1]))return true;
  if(tough&&p.mana>=B.fire.mana+6&&F().targetTiles('fire').some(t=>t[0]===tough.x&&t[1]===tough.y)&&U('fire',tough.x,tough.y))return true;
 }
 if(can('bolt')){
  const res=nearA.length?0:(hpf<0.6?0:6);
  if(p.mana>=B.bolt.mana+res){
   const ts=F().targetTiles('bolt').map(t=>enemyOf(G,t)).filter(e=>e&&e.awake).sort((a,b)=>prio(G,a)-prio(G,b));
   const t=ts.find(e=>!guarded(G,e))||ts[0];
   if(t&&U('bolt',t.x,t.y))return true;
  }
 }
 return false;
}
function rogueAct(G,awake,adj,hpf){
 const p=G.p,B=TB_().BAL.ability,near=awake.filter(e=>dist1(G,e)<=4);
 const big=near.some(e=>e.elite||BIG.has(e.t)||e.t==='guard');
 if(can('smoke')&&(near.length>=2||(big&&hpf<0.7&&near.length>=1)||near.some(e=>e.t==='dragon'&&!e.blind&&dist1(G,e)<=4))){
  const R=B.smoke.radius+(p.eq.off&&p.eq.off.k==='satchel'?TB_().BAL.offhand.satchelRadius:0);
  let best=null,bw=0;
  for(const t of F().targetTiles('smoke')){let w=0;for(const e of awake)if(!e.blind&&Math.max(Math.abs(e.x-t[0]),Math.abs(e.y-t[1]))<=R)w+=e.t==='dragon'?3:1;if(w>bw){bw=w;best=t;}}
  if(best&&bw>=2&&U('smoke',best[0],best[1]))return true;
 }
 if(can('backstab')){
  const c=adj.filter(e=>unaware(G,e)).sort((a,b)=>prio(G,b)-prio(G,a))[0];
  if(c&&U('backstab',c.x,c.y))return true;
 }
 if(can('vanish')&&adj.length&&(hpf<0.55||(big&&hpf<0.8)||adj.length>=3)&&U('vanish'))return true;
 if(!adj.length&&can('knife')){
  const ts=F().targetTiles('knife').map(t=>enemyOf(G,t)).filter(e=>e&&e.awake&&dist1(G,e)>=2).sort((a,b)=>prio(G,a)-prio(G,b));
  const t=ts.find(e=>RANGED.has(e.t));
  if(t&&U('knife',t.x,t.y))return true;
 }
 return false;
}
function think(G){
 const p=G.p,fl=G.floor,hpf=p.hp/p.mhp;
 const vis=G.enemies.filter(e=>G.vis[ix(e.x,e.y)]);
 let awake=vis.filter(e=>e.awake);
 if(G.turn<BS.hold)awake=awake.filter(e=>Math.abs(e.x-p.x)+Math.abs(e.y-p.y)<=1);
 const dzArr=F().dangerSet(),dz=new Set(dzArr);
 BS.pos=BS.pos||[];BS.pos.push(p.x+','+p.y);if(BS.pos.length>20)BS.pos.shift();
 if(BS.pos.length>=20&&new Set(BS.pos).size<=3&&awake.length&&!(G.turn<BS.hold)){BS.hold=G.turn+80;BS.pos=[];BS.loops=(BS.loops||0)+1;}
 if(BS.pos.length>=20&&new Set(BS.pos).size<=3&&!awake.length){const g=BS.goal;if(g)BS.bad.add(g.t+':'+(g.id||(g.x+','+g.y)));BS.goal=null;BS.hunt=null;BS.pos=[];BS.loops=(BS.loops||0)+1;}
 const pk=k=>G.perks[k]||0;
 if(dz.has(ix(p.x,p.y))&&sidestep(G,dz))return;
 const adj=G.enemies.filter(e=>Math.abs(e.x-p.x)+Math.abs(e.y-p.y)===1);
 {const rgv=awake.filter(e=>RANGED.has(e.t));if(rgv.length){const e=rgv[0];BS.hunt={x:e.x,y:e.y,t:G.turn,f:fl};}}
 if(awake.length||adj.length){
  if(G.ppois&&G.inv.pot>0&&p.hp<=G.ppois.d*G.ppois.t+3&&p.hp<p.mhp){click('b_pot');return;}
  if(hpf<0.4&&G.inv.pot>0){click('b_pot');return;}
  if(hpf<0.3&&G.inv.pot<=0){
   if(p.cls==='rogue'&&can('vanish')&&adj.length&&U('vanish'))return;
   if(G.inv.tele>0&&adj.length){click('b_tele');return;}
  }
  const big=awake.some(e=>e.elite||e.t==='dragon'||e.t==='troll'||e.t==='ogre');
  if(G.inv.fire>0&&awake.length>=1&&(awake.length>=3||(big&&awake.some(e=>Math.abs(e.x-p.x)+Math.abs(e.y-p.y)<=6))||(hpf<0.55&&awake.length>=2))){click('b_fire');return;}
  // abilities
  {const act=p.cls==='warrior'?warriorAct:p.cls==='mage'?mageAct:rogueAct;if(act(G,awake,adj,hpf))return;}
  // spear: free hit from two tiles away
  {const rt=awake.find(e=>F().reachOk(e));if(rt&&!adj.length){F().reachAttack(rt);return;}}
  // KITING (mage, out of mana): keep a gap to tough melee enemies while mana comes back
  if(BOT_CFG.kite&&p.cls==='mage'&&p.mana<TB_().BAL.ability.bolt.mana&&(BS.kites||0)<BOT_CFG.kiteCap&&!awake.some(e=>RANGED.has(e.t)&&los(G,e.x,e.y,p.x,p.y))){
   const foes=awake.filter(e=>!RANGED.has(e.t)&&e.t!=='rat'&&e.t!=='bat'&&e.t!=='dragon'&&!e.stun&&!e.frz&&e.hp>2*Math.max(1,p.atk));
   if(foes.length){
    const ed0=multiBfs(G,foes.map(e=>[e.x,e.y])),md=ed0[ix(p.x,p.y)];
    if(md<=2){const st=kiteStep(G,foes,dz);if(st&&F().tryMove(st[0],st[1])){BS.kites=(BS.kites||0)+1;return;}}
   }
  }
  // CHOKEPOINT: several melee enemies coming and none adjacent yet -> step into a corridor/doorway they reach later than I do, and hold there
  if(BOT_CFG.choke&&!adj.length&&!awake.some(e=>RANGED.has(e.t)&&los(G,e.x,e.y,p.x,p.y))){
   const fm=awake.filter(e=>!RANGED.has(e.t)&&e.t!=='dragon');
   if(fm.length>=2){
    const ed=multiBfs(G,fm.map(e=>[e.x,e.y])),my=ed[ix(p.x,p.y)];
    if(my>=3&&my<=9){
     if(openN(G,p.x,p.y)<=2){if((BS.cw||0)<10){BS.cw=(BS.cw||0)+1;click('b_wait');return;}}
     else{
      const blk=new Set(dzArr);for(const t of G.traps)if(t.rev&&!t.done)blk.add(ix(t.x,t.y));
      const rr=bfs(G,p.x,p.y,blk,false);let bk=-1,bdd=99;
      for(const k of rr.order){const d0=rr.dist[k];if(d0<1||d0>4||d0>=bdd)continue;const x=k%W,y=(k/W)|0;
       if(openN(G,x,y)<=2&&G.map[k]!==3&&ed[k]>d0+1){bk=k;bdd=d0;}}
      if(bk>=0){const path=pathTo(rr,bk);if(path.length&&stepK(G,path[0])){BS.cw=(BS.cw||0)+1;return;}}
     }
    }
   }
  }
  const adjE=adj.filter(e=>e.awake||hpf>0.5);
  if(adjE.length){
   const t=adjE.sort((a,b)=>(RANGED.has(a.t)?-100:0)+a.hp-(RANGED.has(b.t)?-100:0)-b.hp)[0];
   if(!(t.t==='ogre'&&false)){BS.wait=0;F().tryMove(t.x-p.x,t.y-p.y);return;}
  }
  if(awake.length){
   const block=new Set(dzArr);for(const t of G.traps)if(t.rev&&!t.done)block.add(ix(t.x,t.y));
   const r=bfs(G,p.x,p.y,block,false);
   const rg=awake.filter(e=>RANGED.has(e.t)&&los(G,e.x,e.y,p.x,p.y));
   if(rg.length&&(BS.hides||0)<8){
    const md=Math.min(...rg.map(e=>Math.abs(e.x-p.x)+Math.abs(e.y-p.y)));
    if(md>=3){
     let hb=null;
     for(const d of DIRS){const nx=p.x+d[0],ny=p.y+d[1];if(!walk(G,nx,ny)||enemyAt(G,nx,ny)||G.map[ix(nx,ny)]===3||dz.has(ix(nx,ny)))continue;
      if(G.traps.some(t=>t.x===nx&&t.y===ny&&t.rev&&!t.done))continue;
      if(rg.every(e=>!los(G,e.x,e.y,nx,ny))){hb=d;break;}}
     if(hb&&F().tryMove(hb[0],hb[1])){BS.hide=G.turn;BS.hides=(BS.hides||0)+1;return;}
    }
   }
   let tgt=null;
   if(rg.length)tgt=rg.sort((a,b)=>Math.abs(a.x-p.x)+Math.abs(a.y-p.y)-Math.abs(b.x-p.x)-Math.abs(b.y-p.y))[0];
   else if(BS.wait>=3)tgt=awake.sort((a,b)=>Math.abs(a.x-p.x)+Math.abs(a.y-p.y)-Math.abs(b.x-p.x)-Math.abs(b.y-p.y))[0];
   if(tgt){
    let bk=-1,bd=1e9;
    for(const d of DIRS){const nx=tgt.x+d[0],ny=tgt.y+d[1];if(!inb(nx,ny))continue;const k=ix(nx,ny);if(r.dist[k]>=0&&r.dist[k]<bd){bd=r.dist[k];bk=k;}}
    if(bk>=0&&bd>0){const path=pathTo(r,bk);if(path.length&&stepK(G,path[0])){BS.wait=0;return;}}
   }
   if(BS.wait<10){BS.wait++;click('b_wait');return;}
  }
 }
 if(!awake.length){BS.wait=0;BS.kw=0;BS.cw=0;}
 // out of combat
 if(hpf<0.35&&G.inv.pot>0&&p.hp<p.mhp){click('b_pot');return;}
 if(G.ppois&&G.inv.pot>1&&p.hp<=G.ppois.d*G.ppois.t+3){click('b_pot');return;}
 const block=new Set(dzArr);for(const t of G.traps)if(t.rev&&!t.done)block.add(ix(t.x,t.y));
 let r=bfs(G,p.x,p.y,block,false);
 const go=k=>{const path=pathTo(r,k);if(path.length){return stepK(G,path[0]);}return false;};
 // hunt memory (ranged enemies that broke line of sight)
 if(BS.hide!=null&&G.turn-BS.hide<7&&BS.hunt){click('b_wait');return;}
 if(BS.hunt){
  const h=BS.hunt;
  if(G.turn-h.t>14||G.floor!==h.f||(p.x===h.x&&p.y===h.y))BS.hunt=null;
  else{const k=ix(h.x,h.y);if(r.dist[k]>0&&lab('hunt',go(k)))return;BS.hunt=null;}
 }
 // sticky goal selection
 const nearAdj=(x,y)=>{let bk=-1,bdd=1e9;for(const d of DIRS){const nx=x+d[0],ny=y+d[1];if(!inb(nx,ny))continue;const k=ix(nx,ny);if(r.dist[k]>=0&&r.dist[k]<bdd){bdd=r.dist[k];bk=k;}}return [bk,bdd];};
 const front=rr=>{for(const k of rr.order){if(k===ix(p.x,p.y)||BS.bad.has('front:'+(k%W)+','+((k/W)|0)))continue;if(!G.exp[k]||G.map[k]===3)return k;}return -1;};
 const valid=g=>{
  if(!g||g.f!==fl)return -1;
  if(g.t==='item'){const it=G.items.find(i=>i.x===g.x&&i.y===g.y);if(!it||r.dist[ix(g.x,g.y)]<=0||BS.ignore.has(g.x+','+g.y+','+fl)||(it.t==='potion'&&G.inv.pot>=p.potCap)||(it.t==='knife'&&G.knives>=window.__dbg.gear.maxKnives()))return -1;return ix(g.x,g.y);}
  if(g.t==='sleeper'){const e=G.enemies.find(e=>e.id===g.id);if(!e||e.awake||hpf<=0.45)return -1;const [bk,bdd]=nearAdj(e.x,e.y);return bdd>0?bk:-1;}
  if(g.t==='front'){const k=ix(g.x,g.y);if(r.dist[k]<=0||!(!G.exp[k]||G.map[k]===3))return -1;return k;}
  return -1;
 };
 let tk=valid(BS.goal);
 if(tk>=0){if(lab(BS.goal.t,go(tk)))return;BS.goal=null;}
 // items
 let bi=-1,bd=1e9;
 for(const it of G.items){
  const k=ix(it.x,it.y);if(!G.seen[k]||r.dist[k]<0||r.dist[k]>=bd)continue;
  if(BS.ignore.has(it.x+','+it.y+','+fl)||BS.bad.has('item:'+it.x+','+it.y))continue;
  if(it.t==='potion'&&G.inv.pot>=p.potCap)continue;
  if(it.t==='knife'&&G.knives>=window.__dbg.gear.maxKnives())continue;
  bd=r.dist[k];bi=k;
 }
 if(bi>=0&&bd>0){BS.goal={t:'item',x:bi%W,y:(bi/W)|0,f:fl};if(lab('item',go(bi)))return;}
 // treasure door
 if(G.keys>0&&G.treasure&&G.map[ix(G.treasure.door[0],G.treasure.door[1])]===5){
  const dx=G.treasure.door[0],dy=G.treasure.door[1];
  if(Math.abs(dx-p.x)+Math.abs(dy-p.y)===1){if(F().tryMove(dx-p.x,dy-p.y))return;}
  const [bk,bdd]=nearAdj(dx,dy);
  if(bk>=0&&bdd>0&&lab('door',go(bk)))return;
 }
 // merchant
 const m=G.merchant;
 if(m&&G.seen[ix(m.x,m.y)]&&!BS.shopDone[fl]&&p.gold>=12){
  if(Math.abs(m.x-p.x)+Math.abs(m.y-p.y)===1){shopping(G);return;}
  const [bk,bdd]=nearAdj(m.x,m.y);
  if(bk>=0&&bdd>0&&lab('merch',go(bk)))return;
 }
 // shrine
 const sh=G.shrine;
 if(sh&&!sh.used&&!sh.left&&G.seen[ix(sh.x,sh.y)]){
  const k=ix(sh.x,sh.y);
  if(r.dist[k]>0&&lab('shrine',go(k)))return;
 }
 // sniping unaware enemies from range: mage bolts them, rogue knives the ranged ones (a free first strike either way)
 if(BOT_CFG.snipe&&hpf>0.5){
  const sv=G.enemies.filter(e=>!e.awake&&G.vis[ix(e.x,e.y)]&&dist1(G,e)<=8&&!BS.bad.has('sleeper:'+e.id));
  if(p.cls==='mage'&&sv.length&&can('bolt')&&p.mana>=TB_().BAL.ability.bolt.mana+8){
   const tg=sv.filter(e=>F().targetTiles('bolt').some(t=>t[0]===e.x&&t[1]===e.y)).sort((a,b)=>prio(G,a)-prio(G,b))[0];
   if(tg&&U('bolt',tg.x,tg.y))return;
  }
  if(p.cls==='rogue'&&sv.length&&G.knives>0){
   const tg=sv.filter(e=>RANGED.has(e.t)&&dist1(G,e)>=2&&F().targetTiles('knife').some(t=>t[0]===e.x&&t[1]===e.y))[0];
   if(tg&&U('knife',tg.x,tg.y))return;
  }
 }
 // mage: let mana come back before walking into the next room
 if(p.cls==='mage'&&p.mana<0.5*window.__dbg.gear.mmax()&&(BS.mrest||0)<BOT_CFG.mageRest&&!awake.length&&hpf>0.3){BS.mrest=(BS.mrest||0)+1;click('b_wait');return;}
 // sleepers
 const sl=G.enemies.filter(e=>!e.awake&&G.vis[ix(e.x,e.y)]&&!BS.bad.has('sleeper:'+e.id));
 if(sl.length&&hpf>(sl.some(e=>e.elite)?0.75:0.55)){
  let be=null,bdd=1e9,bk=-1;
  for(const e of sl){const [k2,d2]=nearAdj(e.x,e.y);if(k2>=0&&d2<bdd){bdd=d2;bk=k2;be=e;}}
  if(bk>=0&&bdd>0){BS.goal={t:'sleeper',id:be.id,f:fl};if(lab('sleeper',go(bk)))return;}
 }
 // frontier
 let fk=front(r);
 if(fk<0){r=bfs(G,p.x,p.y,block,true);fk=front(r);}
 if(fk<0){r=bfs(G,p.x,p.y,new Set(dzArr),true);fk=front(r);}
 if(fk>=0){BS.goal={t:'front',x:fk%W,y:(fk/W)|0,f:fl};if(lab('front',go(fk)))return;}
 // stairs
 for(let k=0;k<W*H;k++)if(G.map[k]===2&&G.seen[k]){
  if(k===ix(p.x,p.y)){
   if(fl>=2&&hpf<0.5&&BS.rest<60&&G.mod!=='cursed'){BS.rest=(BS.rest||0)+1;click('b_wait');return;}
   click('b_down');return;}
  let r2=bfs(G,p.x,p.y,block,true);if(r2.dist[k]<0)r2=bfs(G,p.x,p.y,new Set(dzArr),true);if(r2.dist[k]>0){const path=pathTo(r2,k);if(path.length&&stepK(G,path[0]))return;}
 }
 // dragon lair: go to dragon
 const dr=G.enemies.find(e=>e.t==='dragon');
 if(dr){
  const r2=bfs(G,p.x,p.y,block,true);let bk=-1,bdd=1e9;
  for(const d of DIRS){const nx=dr.x+d[0],ny=dr.y+d[1];if(!inb(nx,ny))continue;const k=ix(nx,ny);if(r2.dist[k]>=0&&r2.dist[k]<bdd){bdd=r2.dist[k];bk=k;}}
  if(bk>=0&&bdd>0){const path=pathTo(r2,bk);if(path.length&&stepK(G,path[0]))return;}
 }
 if(BS.bad.size){BS.bad=new Set();BS.goal=null;click('b_wait');return;}
 BS.wait++;BS.nogoal=(BS.nogoal||0)+1;click('b_wait');
}
const SEQ=['hp','atk','hp','pot','def','u:warlord','hp','atk','u:pick4','def','hp','goldp','u:shrine','u:elixir','atk','u:scroll','hp','def','pot','hp','atk','goldp','def','hp','atk','pot','def','goldp','hp','atk'];
function spend(meta,state){
 const a=A();
 for(let guard=0;guard<200;guard++){
  let item=state.i<SEQ.length?SEQ[state.i]:'*';
  let cost,apply;
  if(item==='*'){
   // cheapest shop item
   let best=null,bc=1e9;for(const s of a.SHOP){if(meta[s.k]>=(s.max||8))continue;const c=a.cost(s);if(c<bc){bc=c;best=s;}}
   if(!best)return;item=best.k;
  }
  if(item.startsWith('u:')){
   const id=item.slice(2),u=a.UNLOCKS.find(x=>x.id===id);
   if(meta.unl[id]){state.i++;continue;}
   if(meta.gold<u.cost)return;meta.gold-=u.cost;meta.unl[id]=1;
  }else{
   const s=a.SHOP.find(x=>x.k===item);if(meta[item]>=(s.max||8)){state.i++;continue;}
   const c=a.cost(s);if(meta.gold<c)return;meta.gold-=c;meta[item]++;
  }
  if(state.i<SEQ.length)state.i++;
 }
}
function normKiller(k){
 k=(k||'unknown');if(/^elite /.test(k))return 'elite '+k.split(' ')[1];
 return k;
}
function runOne(cls,cfg){
 cfg=cfg||{};const cap=cfg.cap||12000,fcap=cfg.fcap||1600;
 BS={ignore:new Set(),shopDone:{},wait:0,rest:0,nogoal:0,bad:new Set(),loops:0,hold:0,uses:{},uses8:{},mods:[]};
 const meta=A().meta(),g0=meta.gold;
 if(!cfg.resume)F().startRun(cls);
 $('modal').style.display='none';
 let G=GG(),acts=0,lastF=cfg.resume?GG().floor:1,fStart=cfg.resume?GG().turn:0,stall=null,maxPot=0;
 while(true){
  G=GG();if(!G||G.over)break;
  if(++acts>cap){stall='actions';break;}
  if(G.floor!==lastF){lastF=G.floor;BS.mods.push(G.mod||'-');if(cfg.onFloor)cfg.onFloor(G);fStart=G.turn;BS.rest=0;BS.nogoal=0;BS.bad=new Set();BS.goal=null;BS.hunt=null;BS.hides=0;BS.hide=null;BS.kites=0;BS.kw=0;BS.sw=0;BS.cw=0;BS.mrest=0;}
  if(G.turn-fStart>fcap){stall='floor'+G.floor;break;}
  if(BS.nogoal>60){stall='nogoal'+G.floor;break;}
  if(cfg.onTurn)cfg.onTurn(G);
  if(modalVisible()){handleModal(G);continue;}
  const t0=G.turn;(BS.tr=BS.tr||[]).push(G.p.x+','+G.p.y+(BS.lb||''));BS.lb='';if(BS.tr.length>16)BS.tr.shift();
  try{think(G);}catch(e){stall='ERR:'+e.message;break;}
 }
 G=GG();let res;
 let dbg=null;if(stall){const q=GG();dbg={st:(()=>{const k=q.map.indexOf(2);return k<0?null:[k%30,(k/30)|0,q.seen[k],q.exp[k]];})(),full:(()=>{let o=[];for(let y=0;y<30;y++){let l='';for(let x=0;x<30;x++){const k=y*30+x,t=q.map[k];let c=!q.seen[k]?(t===0?' ':'?'):t===0?'#':t===2?'>':t===3?'+':t===5?'L':t===4?'-':(q.exp[k]?'.':',');if(q.traps.some(a=>a.x===x&&a.y===y&&a.rev&&!a.done))c='T';if(q.enemies.some(e=>e.x===x&&e.y===y))c='E';if(q.p.x===x&&q.p.y===y)c='@';l+=c;}o.push(l);}return o.join('\n');})(),goal:BS.goal,exp:(BS.goal&&BS.goal.t==='front')?[q.exp[BS.goal.y*30+BS.goal.x],q.map[BS.goal.y*30+BS.goal.x],q.seen[BS.goal.y*30+BS.goal.x]]:null,tre:q.treasure,mp:(()=>{let o='';for(let y=q.p.y-3;y<=q.p.y+3;y++){for(let x=q.p.x-6;x<=q.p.x+6;x++)o+=(x<0||y<0||x>29||y>29)?'#':(x===q.p.x&&y===q.p.y)?'@':['#','.','>','+','-','L'][q.map[y*30+x]];o+='/';}return o;})(),tr:BS.tr.join(' '),itl:q.items.map(i=>i.t+':'+i.x+','+i.y).join(' '),shr:q.shrine,mer:q.merchant&&[q.merchant.x,q.merchant.y],log:q.log.slice(-4),pos:[q.p.x,q.p.y],hp:q.p.hp,en:q.enemies.map(e=>[e.t,e.x,e.y,e.awake?1:0,e.hp,e.wind?1:0,!!(q.vis[e.y*30+e.x])]),items:q.items.length,keys:q.keys,pot:q.inv.pot,onStairs:q.map[q.p.y*30+q.p.x]===2,seenStairs:q.map.some((t,k)=>t===2&&q.seen[k])};A().finish('abandon');}
 G=GG();
 res={cls,floor:G.floor,won:!!G.won,turns:G.turn,killer:normKiller(G.killer),stall,lvl:G.p.lvl,kills:G.kills,perks:Object.keys(G.perks).join(','),uses:BS.uses,uses8:BS.uses8,gear:['weapon','armor','off','charm'].map(sl=>G.p.eq[sl]?G.p.eq[sl].k:'-').join('/')};
 res.mods=BS.mods.join(',');res.gold=meta.gold-g0;res.loops=BS.loops;res.dbg=dbg;
 // back to title
 const bb=$('modalBox').querySelector('button');if(bb)bb.click();
 if(!stall&&G.won)res.winOk=true;
 return res;
}
function resetMeta(extra){
 const m=A().meta();
 Object.assign(m,{seenHelp:1,gold:0,hp:0,atk:0,pot:0,goldp:0,def:0,wins:0,best:0,kills:0,elites:0,unl:{rogue:1,mage:1},rec:{n:{},h:{}},ach:{},dly:{},dlyN:0,mods:{},runs:0,streak:0,bstreak:0,hwins:0,hardOn:0},extra||{});
}
window.BOT={cfg:BOT_CFG,runOne,resetMeta,spend,think,handle:handleModal};
})();
