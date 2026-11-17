// title.js - title screen, class picker, permanent-upgrade shop and unlock list.

function showClassPicker(){
 const t=$('titleBox');t.innerHTML='';
 const h=document.createElement('h1');h.textContent='Choose your class';t.appendChild(h);
 for(const k of Object.keys(CLS)){
  const C=CLS[k],b=document.createElement('button'),open=k==='warrior'||!!meta.unl[k];b.style.minHeight='96px';
  if(open){b.innerHTML='<b style="font-size:18px">'+C.e+' '+C.n+'</b><span>'+C.d+'</span><span><br><i>'+C.ab+'</i></span>';b.addEventListener('click',function(){startRun(k);});}
  else{const u=UNLOCKS.find(x=>x.id===k);b.disabled=true;b.innerHTML='<b style="font-size:18px">🔒 '+C.e+' '+C.n+'</b><span>Locked. Buy it in the title screen shop for <span class="gold">'+(u?u.cost:'?')+' 💰</span> (you have '+meta.gold+').</span>';}
  t.appendChild(b);
 }
 const bk=document.createElement('button');bk.className='c';bk.textContent='Back';bk.addEventListener('click',showTitle);t.appendChild(bk);
}
function hideTitle(){$('title').style.display='none';}
function showTitle(keep){
 const t=$('titleBox'),st=keep?t.scrollTop:0;t.innerHTML='';
 const add=(tag,html,cls)=>{const e=document.createElement(tag);e.innerHTML=html;if(cls)e.className=cls;t.appendChild(e);return e;};
 add('h1','🗡 Depths of Emberfall');
 add('p','Descend 8 floors. Slay the dragon. Die often, grow stronger.').style.textAlign='center';
 add('div','Banked gold: <span class="gold">'+meta.gold+' 💰</span> &nbsp; Best floor: '+meta.best+' &nbsp; Wins: '+meta.wins,'row').style.justifyContent='center';
 if(hasSave()){const b=add('button','Continue run','c');b.addEventListener('click',continueRun);}
 const nb=add('button','New run','c');nb.addEventListener('click',function(){
  if(hasSave()&&!nb.dataset.arm){nb.dataset.arm=1;nb.textContent='Overwrite saved run? Tap again';return;}
  showClassPicker();});
 add('h2','Permanent upgrades').style.fontSize='16px';
 for(const s of SHOP){
  const c=cost(s),lv=meta[s.k],maxed=lv>=shopMax(s);
  const b=add('button','<b>'+s.n+' (Lv '+Math.min(lv,shopMax(s))+'/'+shopMax(s)+')</b><span>'+s.d+' - '+(maxed?'MAXED':'<span class="gold">'+c+' 💰</span>')+'</span>');
  b.disabled=maxed||meta.gold<c;
  b.addEventListener('click',function(){if(meta[s.k]>=shopMax(s)||meta.gold<cost(s))return;meta.gold-=cost(s);meta[s.k]++;saveMeta();showTitle(1);});
 }
 add('h2','Unlocks').style.fontSize='16px';
 add('p','Buy these with banked gold. Locked perks only appear in the level-up pool once unlocked; the last four unlock by playing.').style.fontSize='13px';
 for(const u of UNLOCKS){
  const have=!!meta.unl[u.id];let sub,dis=true;
  if(have)sub='<span style="color:#6fd08c">✓ Unlocked</span>';
  else if(u.ach)sub='🔒 Locked - '+u.ach+' ('+u.prog()+')';
  else{sub='🔒 <span class="gold">'+u.cost+' 💰</span>';dis=meta.gold<u.cost;}
  const b=add('button','<b>'+u.n+'</b><span>'+u.d+'<br>'+sub+'</span>');b.disabled=dis;
  if(have){b.style.opacity='.85';b.style.borderColor='#2a8a5a';}
  if(!have&&!u.ach)b.addEventListener('click',function(){if(meta.unl[u.id]||meta.gold<u.cost)return;meta.gold-=u.cost;meta.unl[u.id]=1;saveMeta();showTitle(1);});
 }
 const sb=add('button',soundLabel(),'c');sb.addEventListener('click',function(){toggleSound();sb.textContent=soundLabel();});
 const hb=add('button','Controls','c');hb.addEventListener('click',function(){showHelp(closeModal);});
 $('title').style.display='flex';
 if(keep)t.scrollTop=st;
}
