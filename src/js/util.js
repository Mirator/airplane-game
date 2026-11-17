// util.js - tiny dependency-free helpers: random (one RNG for all game logic), grid indexing, reduced-motion check.

// rf() is THE random source for game logic. Normally it is Math.random (the test bots and the simulator seed Math.random
// themselves). A Daily run installs a seeded stream (rngS) so generation and combat rolls repeat for the same date.
let rngS=null;
function rf(){
 if(!rngS)return Math.random();
 const a=(rngS.a=(rngS.a+0x6d2b79f5)>>>0);let x=a;
 x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);
 return ((x^(x>>>14))>>>0)/4294967296;
}
function hashStr(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
// run fn with a fresh seeded stream, then put the previous stream back
function withStream(seed,fn){const keep=rngS;rngS={a:seed>>>0};try{return fn();}finally{rngS=keep;}}
function rnd(a,b){return a+Math.floor(rf()*(b-a+1));}
function pick(a){return a[Math.floor(rf()*a.length)];}
function shuf(a){return a.sort(()=>rf()-0.5);}
function rmo(){try{return !!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(e){return false;}}
const ix=(x,y)=>y*W+x;
const inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
