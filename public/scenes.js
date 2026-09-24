/* Cinematic environment plates with lightweight, state-driven visual layers. */
const environments = ['garden', 'workshop', 'observatory', 'canal', 'tower', 'reunion'];
const locations = ['The conservatory', 'The clockwork workshop', 'The observatory', 'The moonlit canal', 'The storm tower', 'The reunion garden'];
const worldGlyphs = { sun: '☀', moon: '☾', star: '✦', wave: '≈' };
const worldEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function worldState(view, kind = 'game') {
  const showcase = kind !== 'game', ending = kind === 'ending';
  const chamber = showcase ? 1 : view.chamber;
  const future = !showcase && view.role === 'future';
  const s = view?.scene || {};
  return {
    chamber, era: ending || chamber===6 ? 'restored' : showcase ? 'between' : view.role,
    bridge: showcase || (future && s.bridge === 'grown') ? 'grown' : 'stump',
    water: (future ? s.flooded : s.water === 'grow') ? 'high' : 'low',
    anchor: view?.anchor ? 'held' : 'free',
    drive: (future ? s.drive === 'working' : s.power === 'workshop') ? 'working' : 'still',
    lift: s.liftPowered || s.power === 'lift' ? 'on' : 'off',
    lens: (future ? s.lens === 'charged' : s.beamPower === 'lens') ? 'charged' : 'empty',
    portal: s.canPulse ? 'open' : 'closed',
    pulse: s.pulses?.[view?.role] ? 'sent' : 'waiting',
    paused: view?.paused ? 'true' : 'false',
    skiff: s.skiff || 'waiting', beacon:s.beacon || 'dark'
  };
}

function dust() {
  return `<div class="world-dust" aria-hidden="true">${Array.from({ length: 18 }, () => '<i></i>').join('')}</div>`;
}

function water() {
  return `<div class="world-water" aria-hidden="true"><img src="/assets/garden-flooded.webp" alt="" draggable="false" decoding="async"><div class="water-ripples"></div></div>`;
}

function anchorField() {
  return `<div class="anchor-field" aria-hidden="true"><div class="anchor-plane"><i></i><i></i><i></i><b>✦</b></div><div class="anchor-column"></div></div>`;
}

function mechanisms() {
  return `<div class="drive-light" aria-hidden="true"></div><div class="flywheel" aria-hidden="true"><img src="/assets/workshop.webp" alt="" draggable="false"></div>
    <div class="lift-light" aria-hidden="true"></div><div class="lift-travel" aria-hidden="true"></div>`;
}

function observatory(view) {
  const symbols = view?.adventure && view.role === 'future' ? [] : view?.role === 'future' ? view.scene.target : view?.scene.rings;
  return `<div class="lens-flare" aria-hidden="true"><i></i></div><div class="light-beam" aria-hidden="true"></div>
    <div class="portal-field" aria-hidden="true"><div class="portal-depth"></div><div class="portal-rim"></div><div class="portal-heart"></div></div>
    <div class="star-code" aria-hidden="true">${(symbols || []).map(symbol => `<span>${worldGlyphs[symbol] || '✧'}</span>`).join('')}</div>
    <div class="pulse-wave" aria-hidden="true"></div>`;
}

function worldSummary(view, state) {
  if (!view) return 'Two centuries. One place. A way home.';
  const s = view.scene;
  if(view.chamber===4) return view.role==='past'?`Tide mark ${s.tide} · Mooring ${s.mooring==='hold'?'held':'released'}`:`Skiff ${s.skiff} · ${s.released?'Mooring released':'Mooring held'}`;
  if(view.chamber===5) return view.role==='past'?`Beacon points ${s.heading} · Shutters ${s.shutter}`:`Beacon ${s.beacon} · ${s.open?'Sky route open':'Sky route sheltered'}`;
  if(view.chamber===6) return 'The same place. The same time. Find each other.';
  if (view.role === 'past') return view.chamber === 1 ? (s.water === 'grow' ? 'Water flowing to the roots' : 'Water diverted from the garden') : view.chamber === 2 ? `Power routed to the ${s.power}` : `Light routed to the ${s.beamPower}`;
  if (view.chamber === 1) return `${state.bridge === 'grown' ? 'Root bridge formed' : 'The crossing is broken'} · ${s.flooded ? 'Exit flooded' : 'Exit dry'}`;
  if (view.chamber === 2) return `Drive ${s.drive} · Lift ${s.liftPowered ? 'powered' : 'unpowered'}`;
  return `Lens ${s.lens} · Portal ${s.canPulse ? 'ready' : 'dormant'}`;
}

export function scene(view = null, kind = 'game') {
  const state = worldState(view, kind), chamber = state.chamber;
  const environment = environments[chamber - 1];
  const plate = chamber === 1 && state.era === 'past' ? 'garden-past' : environment;
  const plateFile = plate + (chamber>3?'.png':'.webp');
  const label = kind === 'game' ? `${view.title} in the ${view.role}. ${worldSummary(view, state)}.` : kind === 'ending' ? 'The conservatory restored in the first light of a new morning.' : 'A vast glass conservatory, weathered stone, ancient roots and a light across time.';
  return `<div class="cinematic-world world-${environment} world-${kind}" role="img" aria-label="${worldEscape(label)}" ${Object.entries(state).map(([key, value]) => `data-${key}="${value}"`).join(' ')}>
    <div class="environment-depth" aria-hidden="true">
      <img class="environment-image" src="/assets/${plateFile}" alt="" draggable="false" decoding="async" ${kind === 'hero' ? 'fetchpriority="high"' : ''}>
      ${chamber === 1 ? `<img class="environment-grown" src="/assets/garden-bridge.webp" alt="" draggable="false" decoding="async">` : ''}
      <div class="era-light"></div><div class="world-rays"></div>
      ${chamber === 1 ? water() : chamber === 2 ? mechanisms() : chamber===3 ? observatory(view) : '<div class="distant-travel-light" aria-hidden="true"></div>'}
      <div class="world-mist mist-back"></div><div class="world-mist mist-front"></div>
      ${anchorField()}${dust()}
    </div>
    <div class="world-vignette" aria-hidden="true"></div><div class="temporal-flash" aria-hidden="true"></div>
    ${kind === 'game' ? `<div class="world-coordinate" aria-hidden="true"><span>0${chamber} / ${locations[chamber - 1]}</span><b class="world-readout">${worldEscape(worldSummary(view, state))}</b></div><div class="anchor-badge" aria-hidden="true"><i></i> MOMENT PRESERVED</div><div class="chapter-reveal" aria-hidden="true"><span>CHAMBER 0${chamber}</span><strong>${worldEscape(view.title)}</strong></div>` : ''}
  </div>`;
}

/** Keep the scene mounted across messages and commands so ambient motion is continuous. */
export function updateScene(container, view) {
  const key = `${view.chamber}:${view.role}`;
  if (container.dataset.worldKey !== key) {
    container.innerHTML = scene(view);
    container.dataset.worldKey = key;
    return;
  }
  const world = container.firstElementChild, state = worldState(view);
  let changed = false;
  for (const [key, value] of Object.entries(state)) {
    if (world.dataset[key] !== String(value)) { world.dataset[key] = value; changed = true; }
  }
  const summary = worldSummary(view, state);
  world.querySelector('.world-readout').textContent = summary;
  world.setAttribute('aria-label', `${view.title} in the ${view.role}. ${summary}.`);
  if (view.chamber === 3) {
    const symbols = view.role === 'future' ? view.scene.target : view.scene.rings;
    world.querySelectorAll('.star-code span').forEach((span, i) => { span.textContent = worldGlyphs[symbols[i]]; });
  }
  if (changed && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    world.querySelector('.temporal-flash').animate([{ opacity: 0 }, { opacity: .3, offset: .18 }, { opacity: 0 }], { duration: 1200 });
  }
}
