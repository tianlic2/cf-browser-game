// Saltline's compass uses four CSS pixels per degree. Extra ticks at both
// ends let the player cross north without a gap or an animated rewind.
const tape=document.getElementById('headingTape');
const readout=document.getElementById('headingValue');
const directions=['N','NE','E','SE','S','SW','W','NW'];
for(let angle=-90;angle<=450;angle+=5){
  const bearing=(angle+360)%360;
  const tick=document.createElement('i');
  tick.style.left=angle*4+'px';
  tick.className=bearing%45===0?'mj':bearing%15===0?'md':'mn';
  tape.append(tick);
  if(bearing%15)continue;
  const label=document.createElement('b');
  label.style.left=tick.style.left;
  label.className=bearing%90===0?'card':bearing%45===0?'ic':'num';
  label.textContent=directions[bearing/45] ?? String(bearing).padStart(3,'0');
  tape.append(label);
}
let lastStep=-1;
export function updateHeading(yaw){
  const bearing=(((-yaw*180/Math.PI)%360)+360)%360;
  const step=Math.round(bearing*8);
  if(step===lastStep)return;
  lastStep=step;
  tape.style.transform='translateX('+(-step/2)+'px)';
  readout.textContent=String(Math.round(bearing)%360).padStart(3,'0');
}

const pips=document.getElementById('magPips');
export function updateMagazine(rounds,capacity,melee,reloading,reserve){
  const panel=document.getElementById('ammoPanel');
  panel.hidden=melee;
  if(melee)return;
  const total=Math.min(40,Math.max(1,capacity));
  const filled=Math.ceil(total*Math.min(1,rounds/capacity));
  if(pips.childElementCount!==total){
    pips.replaceChildren(...Array.from({length:total},()=>document.createElement('i')));
  }
  Array.from(pips.children).forEach((pip,i)=>pip.classList.toggle('off',i>=filled));
  const low=rounds<=Math.ceil(capacity*.27);
  panel.classList.toggle('low',low);
  const cue=document.getElementById('magCue');
  cue.classList.toggle('urgent',rounds===0 && !reloading);
  cue.textContent=reloading?'RELOADING':rounds===0?(reserve===0?'EMPTY':'R — RELOAD'):low?'LOW AMMO':'';
}

const health=document.getElementById('vitals');
export function updateVitals(hp,max){
  health.classList.toggle('on',hp<max);
  health.classList.toggle('crit',hp/max<=.3);
  Array.from(document.getElementById('hpFill').children).forEach((pip,i)=>pip.classList.toggle('off',i>=Math.ceil(10*hp/max)));
}
let noticeTimer;
export function matchNotice(title,detail,duration=1100){
  const el=document.getElementById('matchNotice');
  el.firstElementChild.textContent=title;
  el.lastElementChild.textContent=detail;
  el.hidden=false;
  clearTimeout(noticeTimer);
  noticeTimer=setTimeout(()=>{el.hidden=true;},duration);
}
