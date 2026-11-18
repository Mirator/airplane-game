// audio.js - WebAudio sound effects, vibration and the sound on/off toggle.

function ac(){
 try{
  if(!meta.sound)return null;
  if(!AC){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;AC=new C();}
  if(AC.state==='suspended'&&AC.resume)AC.resume();
  return AC;
 }catch(e){return null;}
}
// [freq, seconds, wave, volume, endFreq]
function sfx(k){
 try{
  const a=ac();if(!a||!SFX[k])return;let t=a.currentTime;
  for(const n of SFX[k]){
   const o=a.createOscillator(),g=a.createGain();o.type=n[2];o.frequency.setValueAtTime(n[0],t);
   if(n[4])o.frequency.exponentialRampToValueAtTime(n[4],t+n[1]);
   g.gain.setValueAtTime(n[3],t);g.gain.exponentialRampToValueAtTime(0.0001,t+n[1]);
   o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+n[1]+0.03);t+=n[1]*0.9;
  }
 }catch(e){}
}
function buzz(ms){try{if(meta.sound&&navigator.vibrate)navigator.vibrate(ms);}catch(e){}}
function soundLabel(){return meta.sound?'🔊 Sound: ON':'🔇 Sound: OFF';}
function toggleSound(){
 meta.sound=meta.sound?0:1;saveMeta();
 if(meta.sound){ac();sfx('pickup');buzz(25);}
}
document.addEventListener('pointerdown',function(){if(meta.sound&&!AC)ac();},true);
