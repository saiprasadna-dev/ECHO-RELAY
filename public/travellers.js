import { stationsFor, nearbyStation, positionAt } from './core/travel.js';

const travelEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function travellerMarkup(role, name = '', extra = '') {
  return `<div class="traveller ${role} ${extra}" aria-hidden="true"><div class="traveller-shadow"></div><div class="traveller-facing"><div class="traveller-figure"><img src="/assets/traveller.png" alt="" draggable="false"><span class="traveller-scarf"></span></div></div>${name ? `<span class="traveller-name">${travelEscape(name)}</span>` : ''}</div>`;
}
let travelFrame = 0, travelSession = null;
document.addEventListener('keydown',event=>{
  const keys={ArrowLeft:[-9,0],a:[-9,0],ArrowRight:[9,0],d:[9,0],ArrowUp:[0,-3],w:[0,-3],ArrowDown:[0,3],s:[0,3]};
  if(!travelSession || !keys[event.key] || event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.('input,textarea,select,dialog,[role="dialog"]')) return;
  event.preventDefault();
  const state=travelSession,point=positionAt(state.view.travel.motion,Date.now()-state.offset),[dx,dy]=keys[event.key];
  state.move(point.x+dx,point.y+dy);
});
export function stopTravel() { cancelAnimationFrame(travelFrame); travelSession = null; }
export function updateTravel(container, view, onMove, onNear) {
  if (!view.adventure) { stopTravel(); return; }
  let layer = container.querySelector('.travel-layer');
  if (!layer) {
    stopTravel();
    layer = document.createElement('div'); layer.className = 'travel-layer';
    layer.setAttribute('role','group'); layer.setAttribute('aria-label',`Walk through ${view.title}`);
    layer.innerHTML = `<button class="walking-ground" aria-label="Walk on the stone path" tabindex="-1"></button><div class="path-line" aria-hidden="true"></div><div class="walk-destination" aria-hidden="true"></div>${stationsFor(view.chamber,view.role).map(s => `<button class="travel-spot" data-station="${s.id}" aria-label="Walk to ${s.label}"><span class="spot-label">${travelEscape(s.label)}</span><span class="spot-pin" aria-hidden="true">${s.id === 'meeting' ? '♡' : '◇'}</span><span class="spot-ring" aria-hidden="true"></span></button>`).join('')}${travellerMarkup(view.role,'You','your-traveller')}${view.chamber===6 ? travellerMarkup(view.role==='past'?'future':'past','Your partner','companion-traveller') : ''}`;
    for (const marker of layer.querySelectorAll('.travel-spot')) {
      const station=stationsFor(view.chamber,view.role).find(s=>s.id===marker.dataset.station);
      marker.removeAttribute('style'); marker.style.left=station.x+'%'; marker.style.top=station.y+'%';
    }
    container.append(layer);
    travelSession = { layer, view, onMove, onNear, offset:Date.now()-view.serverNow, nearest:undefined, lastMove:0 };
    const move = (x,y) => {
      const s = travelSession;
      if (!s || s.view.paused || Date.now()-s.lastMove < 180) return;
      const garden=s.view.chamber===1;
      s.lastMove=Date.now(); s.onMove({ type:'move',x:Math.min(s.view.travel.blockedCrossing?32:92,Math.max(8,x)),y:Math.min(garden?81:91,Math.max(garden?72:81,y)) });
    };
    travelSession.move=move;
    layer.addEventListener('click',event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.station) {
        const station = stationsFor(travelSession.view.chamber,travelSession.view.role).find(s=>s.id===button.dataset.station);
        move(station.x,station.y);
      } else if (button.classList.contains('walking-ground')) {
        const rect=layer.getBoundingClientRect(); move((event.clientX-rect.left)/rect.width*100,(event.clientY-rect.top)/rect.height*100);
      }
    });
    const frame = () => {
      const state=travelSession;
      if (!state || !state.layer.isConnected) { stopTravel(); return; }
      const now=Date.now()-state.offset, v=state.view;
      paintTraveller(state.layer.querySelector('.your-traveller'),v.travel.motion,now,v.paused,v.chamber===6?(v.role==='past'?-3:3):0);
      if (v.travel.companion) paintTraveller(state.layer.querySelector('.companion-traveller'),v.travel.companion,now,v.paused,v.role==='past'?3:-3);
      const near=nearbyStation(v.chamber,v.role,v.travel.motion,now);
      if (state.nearest!==near?.id) { state.nearest=near?.id; state.onNear(near); }
      const destination=state.layer.querySelector('.walk-destination');
      destination.style.left=v.travel.motion.x+'%'; destination.style.top=v.travel.motion.y+'%';
      destination.hidden=now>=v.travel.motion.arrivesAt;
      for (const button of state.layer.querySelectorAll('.travel-spot')) {
        const station=stationsFor(v.chamber,v.role).find(s=>s.id===button.dataset.station);
        button.classList.toggle('is-near',button.dataset.station===near?.id); button.disabled=v.paused || (v.travel.blockedCrossing&&station.x>32);
        button.title=button.disabled&&!v.paused?'Preserve the grown bridge and drain the water to reach this gate.':'';
      }
      travelFrame=requestAnimationFrame(frame);
    };
    travelFrame=requestAnimationFrame(frame);
  } else {
    Object.assign(travelSession,{ view,onMove,onNear,offset:Date.now()-view.serverNow });
  }
}
function paintTraveller(element,motion,now,paused,separation=0) {
  if (!element) return;
  const p=positionAt(motion,now), walking=now<motion.arrivesAt;
  element.style.left=(p.x+separation*Math.max(0,1-Math.abs(p.x-50)/15))+'%'; element.style.top=p.y+'%';
  element.style.setProperty('--depth',String(.87+(p.y-81)*.019));
  element.classList.toggle('walking',walking&&!paused);
  if (motion.x!==motion.fromX) element.classList.toggle('face-left',motion.x<motion.fromX);
}
export function reunionMarkup() {
  return `<div class="reunion-performance" aria-label="The two travellers walk together and celebrate"><div class="reunion-a">${travellerMarkup('past','','celebrating')}</div><div class="reunion-b">${travellerMarkup('future','','celebrating face-left')}</div><div class="reunion-glow"></div><div class="celebration-petals" aria-hidden="true">${Array.from({length:32},(_,i)=>`<i></i>`).join('')}</div><div class="reunion-caption">THE SAME PLACE. THE SAME TIME.<span>We made it.</span></div></div>`;
}
