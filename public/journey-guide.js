import { stationsFor } from './core/travel.js';

const guideEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const guideCap = value => String(value).replace(/^./, c => c.toUpperCase());
export const WALKTHROUGHS = [
  [['past','Water wheel → Grow. This makes the roots grow in the future.'],['future','Ancient roots → Preserve this moment. Keep the grown bridge.'],['past','Water wheel → Drain. The saved bridge stays while the water goes away.'],['future','Garden gate → Cross the root bridge. Both players move to the next level.']],
  [['future','Old blueprint → read the bearing shape and tell Past.'],['past','Bearing bench → choose that shape. At Power switch, choose Workshop.'],['future','Drive assembly → Preserve this moment when the drive is working.'],['past','Power switch → Lift.'],['future','Clockwork lift → Ride the clockwork lift.']],
  [['future','Star chart → share the three symbols, from left to right.'],['past','Star rings → match each symbol in order. At Light switch, choose Lens.'],['future','Focusing lens → Preserve this moment when the lens is charged.'],['past','Light switch → Portal.'],['both','Time portal → Send your pulse on both screens. There is no time limit.']],
  [['future','Tide chart → tell Past the safe mark.'],['past','Sluice wheel → choose that mark.'],['future','Waiting skiff → Preserve this moment when the boat is afloat.'],['past','Mooring winch → Release rope.'],['future','Departure jetty → Sail to the storm tower.']],
  [['future','Weather map → tell Past the calm sky direction.'],['past','Beacon compass → choose that direction. At Wind shutters, choose Shelter beacon.'],['future','Storm beacon → Preserve this moment when the beacon is lit.'],['past','Wind shutters → Open sky route.'],['future','Sky bridge → Cross into the same tomorrow.']],
  [['both','Walk to Meet your partner in the centre of the garden.'],['both','Tap I am here on both screens. Stay in the circle to celebrate together.']]
];

const guideObjects = ['roots','drive','lens','boat','beacon'];
const guideClues = [null,'blueprint','stars','chart','map'];
const guideSetup = ['wheel','bearing','rings','sluice','compass'];
const guideChanges = ['wheel','power','beam','mooring','shutter'];
const guideExits = ['gate','lift','portal','jetty','skybridge'];
const guideGood = ['grown','working','charged','afloat','lit'];
const guideNames = ['roots','drive','lens','boat','beacon'];

/** Advice uses public progress; clue text is only returned at its physical station. */
export function nextMove(view, near) {
  const { chamber:ch, role, scene:s } = view, i=ch-1, phase=view.guide?.phase ?? 0;
  const past=role==='past';
  if (view.paused) return {title:'Wait for your partner to reconnect',body:'Your progress is saved. Both players need to be connected to walk or use objects.'};
  if (ch===6) return s.arrivals[role]
    ? {title:'Stay here. Your partner is on the way.',body:'Ask your partner to walk into the circle and tap I am here.',waiting:true,message:'I am in the meeting circle. Walk here and tap I am here.'}
    : {title:'Meet in the middle',body:'Walk into the circle, then tap I am here. Both of you must stay here.',place:'meeting',action:{type:'meet',label:'I am here · Meet your partner ♡'}};
  if (view.guide?.recovery) return past
    ? {title:'Let Future release the saved object',body:'The object was saved before it was ready. Future can release it, then you can try again.',waiting:true,message:'Please release the saved object so we can try again.'}
    : {title:'Release it and try again',body:`This ${guideNames[i]} was saved too early. Release it first; wait until it is ${guideGood[i]} before preserving it again.`,place:guideObjects[i],action:{type:'release',label:'Release and try again'}};
  if (phase===3) {
    if(ch===3) return s.pulses[role]
      ? {title:'Your pulse is sent',body:'Wait here for your partner to send their pulse. You do not need to press again.',waiting:true,message:'My pulse is sent. Walk to the portal and send yours.'}
      : {title:'Send your pulse',body:'The portal is ready. Both players must walk to it and send one pulse.',place:'portal',action:{type:'pulse',label:'Send your pulse ✦'}};
    return past
      ? {title:'Your part is done for this level',body:'Future can now use the exit. Both of you will travel onward together.',waiting:true,message:'The exit is ready. Walk to it and continue.'}
      : {title:['Cross the bridge','Take the lift','','Sail to the tower','Cross the sky bridge'][i],body:'The way is ready. Walk to the exit and continue; your partner comes with you.',place:guideExits[i],action:{type:['cross','ride','pulse','sail','ascend'][i],label:['Cross the root bridge →','Ride the clockwork lift →','Send your pulse ✦','Sail to the storm tower →','Cross into the same tomorrow →'][i]}};
  }
  if (phase===2) {
    const changeLabels=['Drain','Lift','Portal','Release rope','Open sky route'];
    return past
      ? {title:`Now choose ${changeLabels[i]}`,body:`Future has saved the ${guideNames[i]}. You can safely change the ${['water','power','light','mooring','shutters'][i]} to open the way.`,place:guideChanges[i],action:{type:['water','power','beam','mooring','shutter'][i],value:['drain','lift','portal','release','open'][i],label:`Choose ${changeLabels[i]}`}}
      : {title:`Saved! Ask Past to choose ${changeLabels[i]}`,body:`Keep the ${guideNames[i]} preserved. Past must open the way before you can continue.`,waiting:true,message:`I saved the ${guideNames[i]}. Please choose ${changeLabels[i]} now.`};
  }
  if (phase===1) return past
    ? {title:'Ready. It is Future’s turn.',body:`Keep your settings as they are. Future needs to preserve the ${guideGood[i]} ${guideNames[i]} before you change anything.`,waiting:true,message:`The ${guideNames[i]} is ready. Please preserve it now.`}
    : {title:`Save the ${guideGood[i]} ${guideNames[i]}`,body:'Tap Preserve this moment. It keeps this object working when Past changes the world again.',place:guideObjects[i],action:{type:'anchor',label:'Preserve this moment ◈'}};
  if (past) {
    if(ch===1) return {title:'Give the tree water',body:'Walk to Water wheel, then choose Grow. Your partner will see roots form a bridge.',place:'wheel',action:{type:'water',value:'grow',label:'Choose Grow'}};
    if(ch===2 && s.power!=='workshop') return {title:'Power the workshop first',body:'Choose Workshop so the drive can work. Keep the bearing shape your partner told you.',place:'power',action:{type:'power',value:'workshop',label:'Choose Workshop'}};
    if(ch===3 && s.beamPower!=='lens') return {title:'Send light to the lens first',body:'Choose Lens to charge it. Match the rings to your partner’s three symbols.',place:'beam',action:{type:'beam',value:'lens',label:'Choose Lens'}};
    if(ch===5 && s.shutter!=='closed') return {title:'Shelter the beacon first',body:'Choose Shelter beacon so it can light. Use the direction from your partner’s weather map.',place:'shutter',action:{type:'shutter',value:'closed',label:'Choose Shelter beacon'}};
    return {title:['','Ask Future for the bearing shape','Ask Future for the three symbols','Ask Future for the tide mark','Ask Future for the direction'][i],body:['','Walk to Bearing bench and choose the shape they tell you.','Walk to Star rings and match their symbols from left to right.','Walk to Sluice wheel and choose the mark they tell you.','Walk to Beacon compass and choose the direction they tell you.'][i],place:guideSetup[i],message:['','What bearing shape is on your blueprint?','What are the three symbols, from left to right?','What is the safe tide mark?','Which direction is the calm sky?'][i]};
  }
  if(ch===1) return {title:'Wait for Past to grow the roots',body:'Ask Past to choose Grow at the Water wheel. Save the roots only when they are grown.',place:'roots',waiting:true,message:'Please choose Grow at the Water wheel.'};
  if(near?.id===guideClues[i]) {
    const clueText=['',`The bearing shape is ${guideCap(s.requiredGear)}.`,`The symbols from left to right are ${s.target?.map(guideCap).join(', ')}.`,`The safe tide is Mark ${s.safeTide}.`,`The calm sky direction is ${guideCap(s.safeHeading)}.`][i];
    return {title:'Tell Past what you found',body:`${clueText} Then inspect the ${guideNames[i]}; preserve it when it is ${guideGood[i]}.`,place:guideObjects[i],message:clueText,switchRole:true};
  }
  if(near?.id===guideObjects[i]) return {title:'Wait until the object is ready',body:`Ask Past to match your clue${ch===2?' and choose Workshop power':ch===3?' and choose Lens power':ch===5?' and shelter the beacon':''}. Preserve the ${guideNames[i]} only when it is ${guideGood[i]}.`,waiting:true,message:`Please match the clue${ch===2?' and choose Workshop power':ch===3?' and choose Lens power':ch===5?' and choose Shelter beacon':''}; the ${guideNames[i]} is not ready yet.`};
  return {title:'Find the clue for Past',body:'Walk to the highlighted clue. Read it there, then tell Past what it says.',place:guideClues[i]};
}

export function guideMarkup(view, near, {enabled=true,practice=false}={}) {
  if(!view.adventure) return '';
  const toggle=`<button class="guide-toggle" data-action="toggle-guide" aria-pressed="${enabled}">Easy guide: ${enabled?'On':'Off'}</button>`;
  if(!enabled) return `<div class="guide-toolbar">${toggle}<button class="text-button" data-action="guide">How to play</button></div>`;
  const step=nextMove(view,near),station=stationsFor(view.chamber,view.role).find(p=>p.id===step.place);
  const walking=view.travel.motion.arrivesAt>view.serverNow;
  const walkingHere=station && walking && view.travel.motion.x===station.x && view.travel.motion.y===station.y;
  let cta='';
  if(station && near?.id!==station.id) cta=`<button class="primary guide-primary" data-action="walk-to" data-value="${station.id}" ${walkingHere?'disabled':''}>${walkingHere?`Walking to ${guideEscape(station.label)}…`:`Walk to ${guideEscape(station.label)} →`}</button>`;
  else if(step.action) cta=`<button class="primary guide-primary" data-action="${step.action.type}" ${step.action.value?`data-value="${step.action.value}"`:''}>${guideEscape(step.action.label)}</button>`;
  else if(station) cta='<button class="primary guide-primary" data-action="show-controls">Choose below ↓</button>';
  const share=step.message&&!practice?`<button class="secondary" data-action="guide-share" data-value="${guideEscape(step.message)}">${near?.id===guideClues[view.chamber-1]?'Share clue with Past':'Tell my partner'}</button>`:'';
  const swap=practice&&(step.waiting||step.switchRole)?`<button class="secondary" data-action="practice-swap">Now play ${view.role==='past'?'Future':'Past'} ↔</button>`:'';
  return `<div class="guide-top"><span class="kicker">YOU ARE ${view.role.toUpperCase()} · YOUR NEXT MOVE</span>${toggle}</div><div class="guide-content" aria-live="polite"><h2>${guideEscape(step.title)}</h2><p>${guideEscape(step.body)}</p></div><div class="guide-actions">${cta}${share}${swap}<button class="text-button" data-action="guide">Level walkthrough</button></div>`;
}

export function walkthroughMarkup(chamber=1,role=null) {
  return `<ol class="walkthrough">${(WALKTHROUGHS[chamber-1]||WALKTHROUGHS[0]).map(([who,text])=>`<li class="${who===role||who==='both'?'your-step':''}"><strong>${who==='both'?'Both players':guideCap(who)}${who===role?' · You':''}</strong><span>${guideEscape(text)}</span></li>`).join('')}</ol>`;
}
