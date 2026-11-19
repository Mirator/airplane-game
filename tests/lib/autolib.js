// In-page runner for the in-game Auto (src/js/auto.js), used by `node tests/sim.js --auto`. Load it AFTER botlib.js: it keeps the bot's
// resetMeta / spend (so the upgrade levels are identical) and replaces only BOT.runOne, with the same result shape.
// Auto is driven synchronously (__dbg.auto.runSync = the same autoStep the timer calls, dialogs resolved without the flash).
(function(){
const $=id=>document.getElementById(id);
const norm=k=>{k=(k||'unknown');return /^elite /.test(k)?'elite '+k.split(' ')[1]:k;};
window.BOT.runOne=function(cls,cfg){
 cfg=cfg||{};const D=window.__dbg,A=D.auto,meta=D.api.meta(),g0=meta.gold;
 D.fn.startRun(cls);$('modal').style.display='none';
 A.start(true);
 const t0=D().turn;A.runSync(cfg.cap||8000);
 let G=D();const st=A.state();let stall=null;
 let dbg=null;
 if(!G.over){
  stall=st.err?'ERR:'+String(st.err).split('\n')[0]:(st.lastStop||'cap').replace(/^Auto stopped: /,'');
  const vis=G.enemies.filter(e=>G.vis[e.y*30+e.x]),tr=(st.tr||[]).slice(-24);
  const cause=tr.length&&tr.slice(-8).every(t=>/ wait$/.test(t))?'waiting: no reachable goal':vis.some(e=>e.awake)?'combat stalemate (awake enemies in sight)':'travel / explore loop';
  dbg={cause:cause,floor:G.floor,turn:G.turn,pos:[G.p.x,G.p.y],hp:G.p.hp+'/'+G.p.mhp,mod:G.mod,log:G.log.slice(-3),tr:tr,vis:vis.map(e=>e.t+(e.awake?'!':'z')+e.hp+(e.wind?'W':'')).slice(0,8),goal:st.fg,sleeper:st.sg,bad:[...st.bad],map:(()=>{let o=[];for(let y=0;y<30;y++){let l='';for(let x=0;x<30;x++){const k=y*30+x,t=G.map[k];let c=!G.seen[k]?(t===0?' ':'?'):t===0?'#':t===2?'>':t===3?'+':t===5?'L':t===4?'-':(G.exp[k]?'.':',');if(G.items.some(i=>i.x===x&&i.y===y))c='i';const en=G.enemies.find(e=>e.x===x&&e.y===y);if(en)c=en.awake?'E':'z';if(G.p.x===x&&G.p.y===y)c='@';l+=c;}o.push(l);}return o.join('\n');})()};
  D.api.finish('abandon');
 }
 G=D();
 const res={cls,floor:G.floor,won:!!G.won,turns:G.turn,killer:norm(G.killer),stall,lvl:G.p.lvl,kills:G.kills,perks:Object.keys(G.perks).join(','),uses:Object.assign({},st.uses),uses8:Object.assign({},st.uses8),
  gear:['weapon','armor','off','charm'].map(sl=>G.p.eq[sl]?G.p.eq[sl].k:'-').join('/'),mods:'',gold:meta.gold-g0,loops:st.loops||0,dbg:dbg,ticks:st.ticks,flashes:st.modals,auto:1};
 const bb=$('modalBox').querySelector('button');if(bb)bb.click();
 return res;
};
})();
