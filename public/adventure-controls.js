import { stationsFor, HEADINGS } from './core/travel.js';
const acEsc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const acCap = text => String(text).replace(/^./,c=>c.toUpperCase());
const acGlyph = {circle:'●',triangle:'▲',diamond:'◆',sun:'☀',moon:'☾',star:'✦',wave:'≈'};
export function adventureControls(view, near) {
  const s=view.scene, role=view.role, frozen=view.paused?'disabled':'', ch=view.chamber;
  if (!near) return `<div class="explore-card"><span class="explore-symbol" aria-hidden="true">◇</span><p class="kicker">Your next step</p><h2>Walk into the story.</h2><p class="instruction">Tap a named marker in the scene. Your traveller will walk there, then reveal what you can do.</p><div class="next-places">${stationsFor(ch,role).map(p=>`<button class="secondary" data-action="walk-to" data-value="${p.id}" ${frozen||(view.travel.blockedCrossing&&p.x>32?'disabled':'')}>Walk to ${acEsc(p.label)} <span aria-hidden="true">↗</span></button>`).join('')}</div><p class="action-note">Tap the stone path to explore. On a laptop, use arrow keys or WASD. Your partner travels through ${ch===6?'the same garden':'the other era'}.</p></div>`;
  const choices=(type,values,current,labels=null)=>`<div class="choices">${values.map((value,i)=>`<button id="${type}-${value}" class="choice ${current===value?'selected':''}" data-action="${type}" data-value="${value}" aria-pressed="${current===value}" ${frozen}>${acEsc(labels?.[i]||acCap(value))}</button>`).join('')}</div>`;
  const readout=(name,value)=>`<div class="readout"><span>${name}</span><strong>${acEsc(value)}</strong></div>`;
  const anchor=()=>`<button id="anchor-action" class="anchor-control ${view.anchor?'held':''}" data-action="${view.anchor?'release':'anchor'}" ${frozen}>${view.anchor?`Release ${acEsc(view.anchor.condition)} ${acEsc(view.anchor.kind)}`:'Preserve this moment ◈'}</button>`;
  const exitReasons={cross:'Future must preserve the grown roots, then Past must choose Drain.',ride:'Future must preserve the working drive, then Past must choose Lift power.',pulse:'Future must preserve the charged lens, then Past must choose Portal light. If your pulse is already sent, wait for your partner.',sail:'Future must preserve the floating boat, then Past must release the rope.',ascend:'Future must preserve the lit beacon, then Past must open the sky route.',meet:'You are already waiting here. Your partner must also arrive and tap I am here.'};
  const exit=(id,label,enabled)=>`<button id="${id}" class="primary mint" data-action="${id}" ${frozen||(!enabled?'disabled':'')}>${label}</button>${!enabled?`<p class="locked-reason">${exitReasons[id]}</p>`:''}`;
  const clue=(id,label,value)=>`<div class="secret-clue" data-testid="${id}"><span class="clue-eyebrow">${label}</span><div class="clue-shape">${value}</div></div><p class="action-note">Tell Past what you found, or use Share clue in the guide above.</p>`;
  let content='';
  if(ch===1) {
    if(near.id==='wheel') content=choices('water',['grow','drain'],s.water,['Grow','Drain'])+'<p class="action-note">Grow feeds the tree. Drain clears the exit. Ask your partner to preserve the grown roots before draining.</p>';
    if(near.id==='roots') content=readout('Root bridge',acCap(s.bridge))+readout('Exit',s.flooded?'Flooded':'Dry')+anchor();
    if(near.id==='gate') content=role==='past'?'<p class="instruction">Your partner must preserve the grown roots and cross the dry exit. You will travel onward together.</p>':readout('Crossing',s.canCross?'Ready':'Not ready')+exit('cross','Cross the root bridge →',s.canCross);
  }
  if(ch===2) {
    if(near.id==='bearing') content=choices('gear',['circle','triangle','diamond'],s.gear);
    if(near.id==='power') content=choices('power',['workshop','lift'],s.power);
    if(near.id==='blueprint') content=clue('gear-clue','SURVIVING BLUEPRINT',`${acGlyph[s.requiredGear]} ${acCap(s.requiredGear)} bearing`);
    if(near.id==='drive') content=readout('Drive assembly',acCap(s.drive))+anchor();
    if(near.id==='lift') content=readout('Lift power',s.liftPowered?'On':'Off')+exit('ride','Ride the clockwork lift →',s.canRide);
  }
  if(ch===3) {
    if(near.id==='rings') content=[0,1,2].map(i=>`<div class="ring-row"><span class="control-label">Ring ${i+1} · ${['Left','Middle','Right'][i]}</span><div class="choices">${['sun','moon','star','wave'].map(symbol=>`<button id="ring-${symbol}-${i}" class="choice ${s.rings[i]===symbol?'selected':''}" data-action="ring" data-value="${symbol}" data-index="${i}" aria-pressed="${s.rings[i]===symbol}" ${frozen}>${acGlyph[symbol]} ${acCap(symbol)}</button>`).join('')}</div></div>`).join('');
    if(near.id==='beam') content=choices('beam',['lens','portal'],s.beamPower);
    if(near.id==='stars') content=clue('constellation-clue','LEFT TO RIGHT',s.target.map((symbol,i)=>`<span>${i+1}. ${acGlyph[symbol]} ${acCap(symbol)}</span>`).join(' · '));
    if(near.id==='lens') content=readout('Focusing lens',acCap(s.lens))+anchor();
    if(near.id==='portal') content=readout('Portal',s.canPulse?'Open':'Waiting for light')+exit('pulse',s.pulses[role]?'Your pulse is waiting ✓':'Send your pulse ✦',s.canPulse&&!s.pulses[role]);
  }
  if(ch===4) {
    if(near.id==='sluice') content=choices('tide',[1,2,3],s.tide,['Mark 1','Mark 2','Mark 3']);
    if(near.id==='mooring') content=choices('mooring',['hold','release'],s.mooring,['Hold rope','Release rope']);
    if(near.id==='chart') content=clue('tide-clue','SAFE TIDE MARK',`Mark ${s.safeTide}`);
    if(near.id==='boat') content=readout('Skiff',acCap(s.skiff))+anchor();
    if(near.id==='jetty') content=readout('Mooring',s.released?'Released':'Held')+exit('sail','Sail to the storm tower →',s.canSail);
  }
  if(ch===5) {
    if(near.id==='compass') content=choices('heading',HEADINGS,s.heading);
    if(near.id==='shutter') content=choices('shutter',['closed','open'],s.shutter,['Shelter beacon','Open sky route']);
    if(near.id==='map') content=clue('heading-clue','CALM SKY DIRECTION',acCap(s.safeHeading));
    if(near.id==='beacon') content=readout('Beacon',acCap(s.beacon))+anchor();
    if(near.id==='skybridge') content=readout('Sky route',s.open?'Open':'Sheltered')+exit('ascend','Cross into the same tomorrow →',s.canAscend);
  }
  if(ch===6) content=`<p class="instruction">There you are. After everything, only a few steps remain.</p>${readout('Your partner',s.arrivals[role==='past'?'future':'past']?'Here in the circle':'Walking towards you')}${exit('meet',s.arrivals[role]?'Waiting here for your partner ♡':'I am here · Meet your partner ♡',!s.arrivals[role])}`;
  return `<p class="kicker">You reached ${acEsc(near.label)}</p><h2>${acEsc(near.label)}</h2><p class="instruction">${acEsc(near.description)}</p>${content}<button class="text-button explore-more" data-action="walk-away">← Keep exploring</button>`;
}
