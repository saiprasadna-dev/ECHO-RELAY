import { scene, updateScene } from "./scenes.js";
import { api, RelayConnection } from "./transport.js";
import { createAdventureRoom, joinRoom, applyCommand, projectView, HINTS, SHAPES, SYMBOLS, GLYPHS, makeId } from "./core/game.js";
import { stationsFor, nearbyStation } from './core/travel.js';
import { updateTravel, stopTravel, reunionMarkup } from './travellers.js';
import { adventureControls } from './adventure-controls.js';
import { guideMarkup, nextMove, walkthroughMarkup } from './journey-guide.js';

const app = document.querySelector('#app');
const offlineOnly = document.querySelector('meta[name="echo-mode"]')?.content === 'offline';
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const cap = value => String(value || '').replace(/^./, ch => ch.toUpperCase());
const local = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key,value) { try { localStorage.setItem(key,value); } catch { /* Private browsers may disable persistence. */ } }
};
let view = null, mounted = '', busy = false, status = 'offline', practice = null, practiceRole = 'past';
let tab = 'create', nickname = local.get('echo-name') || '', roomInput = new URL(location.href).searchParams.get('room')?.toUpperCase() || '';
let lastRoom = local.get('echo-last-room'), toastTimer, sound = false, audio = null, chatDraft = '';
let easyGuide = local.get('echo-easy-guide') !== 'off';
let viewReceivedAt = Date.now();
let lastGuideStep = '';
if (roomInput) tab = 'join';

function replaceUrl(path) {
  try { history.replaceState(null, '', path); } catch { /* Offline practice may use an opaque/local origin. */ }
}
function notify(message) {
  const element = document.querySelector('#toast');
  element.textContent = message; element.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { element.hidden = true; }, 6500);
}
function put(id, markup) {
  const node = document.getElementById(id);
  if (!node || node._markup === markup) return;
  const active = document.activeElement;
  const focusId = node.contains(active) ? active.id : null;
  const selection = focusId && active.tagName === 'INPUT' ? [active.selectionStart, active.selectionEnd] : null;
  node.innerHTML = markup; node._markup = markup;
  if (focusId) {
    const next = document.getElementById(focusId);
    if (next && !next.disabled) { next.focus({ preventScroll:true }); if (selection) next.setSelectionRange(...selection); }
  }
}
function chime() {
  if (!sound || !audio || audio.state !== 'running') return;
  const now = audio.currentTime;
  [261.63, 392, 523.25].forEach((frequency, index) => {
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now + index * .09);
    gain.gain.linearRampToValueAtTime(.018, now + index * .09 + .04);
    gain.gain.exponentialRampToValueAtTime(.0001, now + index * .09 + 1.15);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(now + index * .09); oscillator.stop(now + index * .09 + 1.2);
  });
}
const connection = new RelayConnection({
  onState(next) {
    const previous = view;
    view = next; viewReceivedAt=Date.now(); busy = false;
    if (previous && (next.chamber > previous.chamber || next.status === 'won' && previous.status !== 'won')) chime();
    render();
  },
  onStatus(next) { status = next; render(); },
  onError(message) { busy = false; notify(message); render(); }
});
function header() {
  return `<header class="topbar"><button class="brand" data-action="home" aria-label="ECHO RELAY home"><img src="/favicon.svg" alt=""><span>ECHO RELAY<small>A COOPERATIVE TIME ADVENTURE</small></span></button><nav class="nav-actions" aria-label="Game help"><button class="text-button" data-action="guide">How to play</button><button class="icon-button" id="sound-toggle" data-action="sound" aria-label="${sound?'Turn sound off':'Turn sound on'}" aria-pressed="${sound}"><span class="sound-indicator">${sound?'♪ On':'♪ Off'}</span></button></nav></header>`;
}
function footer() {
  return `<footer class="quiet-footer"><span>One world. Two eras. A way back to each other.</span><span><button class="text-button tiny" data-action="privacy">Privacy</button> v0.1</span></footer>`;
}
function connectionLabel() {
  return `<span class="connection ${practice?'practice':status}" role="status">${practice?'Solo practice':({connected:'Relay connected',connecting:'Connecting…',reconnecting:'Reconnecting…',disconnected:'Disconnected',offline:'Offline'}[status] || status)}</span>`;
}
function invitationAddress() {
  const loopback = ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  return `<div class="invitation-address"><label for="invitation-url">FULL INVITATION ADDRESS</label><input id="invitation-url" aria-describedby="invitation-help" readonly value="${esc(`${location.origin}/?room=${view.code}`)}"><p id="invitation-help" class="action-note">Open this full address on your other device. A room code only works on the server where it was created.${loopback?' For a phone invitation, first open this page using your computer’s Wi-Fi address.':''}</p></div>`;
}
function roomError(error) {
  return error.status === 404 ? `This relay was not found at ${location.origin}. Open your partner’s full invitation link, or check their server address and room code.` : error.message;
}
function mount(key, markup) {
  if (mounted === key) return;
  mounted = key; app.innerHTML = `<div class="shell shell-${key}">${header()}${markup}${footer()}</div><div id="proposal-container"></div>`;
}
function renderHome() {
  if (offlineOnly) {
    mount('home', `<main id="main"><section class="hero"><div class="hero-copy"><p class="kicker">A signal across two hundred years</p><h1>ECHO<span>RELAY</span></h1><h2 class="tagline">Change my past.<br>Save our future.</h2><p class="hero-description">Walk through six destinations offline. Switch between past and future to learn how each timeline changes the other.</p><button class="primary" data-action="practice">Begin offline practice →</button><p class="action-note">For two players, return to the Android menu and connect both devices to the same game server.</p></div><div class="hero-art">${scene(null,'hero')}</div></section></main>`);
    return;
  }
  mount('home', `<main id="main"><section class="hero"><div class="hero-copy"><p class="kicker">A signal across two hundred years</p><h1>ECHO<span>RELAY</span></h1><h2 class="tagline">Change my past.<br>Save our future.</h2><p class="hero-description">You wake in the same conservatory, two centuries apart. One of you changes what was. The other holds on to what could be.</p><div class="hero-meta"><span>2 travellers</span><span>6 connected destinations</span><span>No ticking clock</span></div></div><div class="hero-art">${scene(null,'hero')}<div class="art-caption"><span class="art-coordinate">THE CONSERVATORY · 1874 / 2074</span><p>Some things are worth<br>holding on to.</p></div></div></section><section class="entry-card" aria-labelledby="entry-heading"><div class="entry-top"><h2 id="entry-heading">Find your other half of time.</h2><div id="home-tabs"></div></div><div id="home-form"></div><div class="entry-footer"><span>No sign-up. No download. Just you two.</span><button class="text-button" data-action="practice">Explore both eras in solo practice ↗</button></div><div id="resume-link"></div></section></main>`);
  put('home-tabs', `<div class="entry-tabs" role="group" aria-label="Create or join"><button data-action="tab-create" class="${tab==='create'?'active':''}" aria-pressed="${tab==='create'}">Create a relay</button><button data-action="tab-join" class="${tab==='join'?'active':''}" aria-pressed="${tab==='join'}">Join a friend</button></div>`);
  put('home-form', `<form id="entry-form" class="entry-form ${tab==='join'?'join':''}"><div><label for="nickname">YOUR TRAVELLER NAME</label><input id="nickname" name="nickname" autocomplete="nickname" maxlength="24" placeholder="What should your friend call you?" value="${esc(nickname)}" required></div>${tab==='join'?`<div><label for="room-input">SIX-CHARACTER RELAY CODE</label><input id="room-input" name="room" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC234" value="${esc(roomInput)}" required></div>`:''}<button class="primary" type="submit" ${busy?'disabled':''}>${busy?'Finding your signal…':tab==='join'?'Join their timeline →':'Create a relay →'}</button></form>`);
  put('resume-link', `${lastRoom ? `<button class="text-button tiny" data-action="resume">Return to relay ${esc(lastRoom)} →</button>` : ''}<p class="action-note server-address">Playing on <strong>${esc(location.origin)}</strong>. To join a friend, use their full invitation link or the same server address, including its port.</p>`);
}
function renderLobby() {
  mount('lobby', `<main id="main" class="lobby"><div class="lobby-copy"><p class="kicker">Your story begins together</p><h1>Two signals.<br>One way home.</h1><p>Share your invitation with a friend. Open it on another device, or in a separate browser profile. Your timelines will meet here.</p><div class="lobby-art">${scene(null,'hero')}</div></div><section class="lobby-card" id="lobby-core" aria-label="Relay waiting room"></section></main>`);
  const players = ['past','future'].map(role => {
    const player = view.players[role];
    return `<div class="player-slot ${role}"><span class="era-icon" aria-hidden="true">${role==='past'?'☀':'☾'}</span><div><strong>${player?esc(player.name):'Waiting for your friend…'}${role===view.role?' · You':''}</strong><small>${role==='past'?'THE PAST · Change the world':'THE FUTURE · Preserve what matters'}</small></div><span class="slot-status">${player?(player.connected?(player.ready?'Ready ✓':'Here'):'Away'):'Open'}</span></div>`;
  }).join('');
  put('lobby-core', `<h2>Your invitation through time</h2><p class="muted tiny">Only share this code with your playing partner.</p><div class="room-code" data-testid="room-code">${esc(view.code)}</div><div class="invite-actions"><button class="secondary" data-action="copy-link">Copy invitation link ↗</button><button class="secondary" data-action="copy-code">Copy code</button></div><div class="player-slots">${players}</div><button id="ready" class="primary wide" data-action="ready" ${status!=='connected'?'disabled':''}>${view.players[view.role]?.ready?'Not ready yet':'Ready to begin →'}</button><p class="lobby-note">The story starts when both travellers are here and ready.</p><button class="text-button" data-action="swap" ${!view.players.past?.connected||!view.players.future?.connected?'disabled':''}>Ask to swap eras</button><div class="lobby-note">${connectionLabel()}</div>`);
  const inviteActions = document.querySelector('.invite-actions');
  if (inviteActions && !document.getElementById('invitation-url')) inviteActions.insertAdjacentHTML('afterend', invitationAddress());
  renderProposal();
}
function practiceBanner() {
  return practice ? `<div class="practice-banner"><span><strong>SOLO PRACTICE</strong> · You control both eras. This is not an online room.</span><button class="secondary" data-action="practice-swap">Switch to ${view.role==='past'?'future':'past'} ↔</button></div>` : '';
}
function disabled() { return view.paused || (!practice && status !== 'connected') ? 'disabled' : ''; }
function choice(action,value,label,current,extra='') {
  return `<button id="${action}-${value}${extra?'-'+extra:''}" type="button" class="choice ${value===current?'selected':''}" data-action="${action}" data-value="${value}" ${extra?`data-index="${extra}"`:''} aria-pressed="${value===current}" ${disabled()}>${label}</button>`;
}
function anchorControl() {
  const held = view.anchor, object = ['bridge','drive','lens'][view.chamber-1];
  return `<button id="anchor-action" class="anchor-control ${held?'held':''}" data-action="${held?'release':'anchor'}" ${disabled()}><span class="anchor-icon" aria-hidden="true">◎</span>${held?`Release anchor · ${esc(held.condition)}`:`Anchor the ${object}`}</button><p class="action-note">${held?'You are preserving the state you captured. Release it to let time change this object again.':'One anchor. It freezes this object exactly as it is now, not as you hope it will be.'}</p>`;
}
function readout(label,value,kind='') { return `<div class="readout"><span>${label}</span><strong class="${kind}">${esc(value)}</strong></div>`; }
function controlMarkup() {
  const s = view.scene, past = view.role === 'past', ch = view.chamber;
  let body = '';
  if (ch===1 && past) body = `<p class="instruction">The young tree needs water. Turn the wheel and ask your partner what changes on their side of time.</p><span class="control-label">Water-routing wheel</span><div class="choices">${choice('water','grow','↗ Grow',s.water)}${choice('water','drain','↘ Drain',s.water)}</div><p class="action-note">Grow feeds the tree. Drain sends the water away. Only your partner can see what survives.</p>`;
  if (ch===1 && !past) body = `<p class="instruction">You can see what two centuries have changed. Find a way across the gap, then open the dry exit.</p>${readout('Root bridge',s.bridge==='grown'?'Grown':'Only a stump',s.bridge==='grown'?'good':'')}${readout('Exit',s.flooded?'Flooded':'Dry',s.flooded?'warn':'good')}${anchorControl()}<button id="cross" class="primary mint" data-action="cross" ${disabled()||(!s.canCross?'disabled':'')}>Cross the root bridge →</button>`;
  if (ch===2 && past) body = `<p class="instruction">The lift's drive needs a replacement bearing. Your partner has the surviving blueprint; ask which shape it shows.</p><span class="control-label">Replacement bearing</span><div class="choices">${SHAPES.map(shape=>choice('gear',shape,`<span class="glyph" aria-hidden="true">${GLYPHS[shape]}</span>${cap(shape)}`,s.gear)).join('')}</div><span class="control-label">Power-routing switch</span><div class="choices">${choice('power','workshop','Workshop',s.power)}${choice('power','lift','Lift',s.power)}</div><p class="action-note">Workshop powers the drive assembly. Lift powers the carriage. They cannot be powered at the same time.</p>`;
  if (ch===2 && !past) body = `<p class="instruction">The old blueprint is still readable. Share its shape, then inspect the drive before taking the lift.</p><div class="secret-clue" data-testid="gear-clue" data-shape="${s.requiredGear}"><span class="clue-eyebrow">ONLY YOUR ERA CAN SEE THIS</span><div class="clue-shape"><b aria-hidden="true">${GLYPHS[s.requiredGear]}</b>${cap(s.requiredGear)} bearing</div></div>${readout('Drive assembly',cap(s.drive),s.drive==='working'?'good':'warn')}${readout('Lift power',s.liftPowered?'On':'Off',s.liftPowered?'good':'')}${anchorControl()}<button id="ride" class="primary mint" data-action="ride" ${disabled()||(!s.canRide?'disabled':'')}>Ride the clockwork lift →</button>`;
  if (ch===3 && past) body = `<p class="instruction">Your partner sees the constellation. Match their symbols from left to right, then decide where the light should go.</p>${[0,1,2].map(index=>`<div class="ring-row"><span class="control-label">Ring ${index+1}${index===0?' · Left':index===2?' · Right':''}</span><div class="choices">${SYMBOLS.map(symbol=>choice('ring',symbol,`<span class="glyph" aria-hidden="true">${GLYPHS[symbol]}</span>${cap(symbol)}`,s.rings[index],String(index))).join('')}</div></div>`).join('')}<span class="control-label">Light-routing switch</span><div class="choices beam-choices">${choice('beam','lens','Lens',s.beamPower)}${choice('beam','portal','Portal',s.beamPower)}</div>${pulseControl()}`;
  if (ch===3 && !past) body = `<p class="instruction">The stars remember a sequence. Share it in order, then preserve the light that could bring you both home.</p><div class="secret-clue" data-testid="constellation-clue" data-target="${s.target.join(',')}"><span class="clue-eyebrow">YOUR CONSTELLATION · LEFT TO RIGHT</span><div class="constellation">${s.target.map((symbol,i)=>`<span><b aria-hidden="true">${GLYPHS[symbol]}</b>${i+1}. ${cap(symbol)}</span>`).join('')}</div></div>${readout('Lens',cap(s.lens),s.lens==='charged'?'good':'')}${readout('Portal power',s.portalPowered?'On':'Off',s.portalPowered?'good':'')}${anchorControl()}${pulseControl()}`;
  return `<p class="kicker ${past?'':'mint-text'}">Your part in the relay</p><h2>${past?'Change what was.':'Hold on to what could be.'}</h2>${body}`;
}
function pulseControl() {
  const s = view.scene, sent = s.pulses?.[view.role];
  return `<button id="pulse" class="primary ${view.role==='future'?'mint':''}" data-action="pulse" ${disabled()||(!s.canPulse||sent?'disabled':'')}>${sent?'Your pulse is waiting ✓':'Send your final pulse ✦'}</button>${sent?'<p class="waiting-pulse">There is no countdown. Your partner can answer when they are ready.</p>':''}`;
}
function renderGame() {
  mount('game', `<main id="main"><div id="practice-banner"></div><div class="game-header"><div id="game-heading"></div><div class="room-badge" id="room-badge"></div></div><div id="pause-banner"></div><div class="stage-layout"><section class="theatre" aria-label="Your timeline"><div class="stage-frame"><div class="stage-bar" id="stage-bar"></div><div class="stage-image" id="scene"></div><div class="event-line" id="event-line" aria-live="polite"></div></div><div class="chapter-progress" id="chapter-progress"></div></section><aside class="game-aside" aria-label="Game controls"><section id="controls" class="controls-card"></section><section id="hint" class="hint-card"></section><div class="utility-row"><button class="text-button" data-action="reset">↺ Restart this chamber</button><button class="text-button" data-action="guide">Rules & help</button></div></aside></div><section class="channel" aria-label="Private relay messages"><div><h2>A voice across time</h2><p class="channel-note" id="channel-note"></p><div class="signal-buttons" id="signals"></div></div><div><div class="messages" id="messages" role="log" aria-live="polite"></div><form id="chat-form" class="chat-form"><label for="chat-input" class="sr-only">Message your partner</label><input id="chat-input" maxlength="220" autocomplete="off" placeholder="Tell your partner what you see…" value="${esc(chatDraft)}"><button type="submit" class="secondary">Send</button></form></div></section></main>`);
  put('practice-banner',practiceBanner());
  if(!document.getElementById('journey-guide')) document.querySelector('.stage-layout').insertAdjacentHTML('beforebegin','<section id="journey-guide" class="journey-guide" aria-label="Easy guide"></section>');
  document.getElementById('journey-guide').hidden=!view.adventure;
  put('game-heading',`<p class="kicker">${view.adventure?'DESTINATION':'CHAMBER'} 0${view.chamber} OF 0${view.totalChambers||3}</p><h1>${esc(view.title)}</h1>`);
  put('room-badge',`${practice?'':`<button class="text-button" data-action="copy-link" title="Copy invitation link">RELAY ${esc(view.code)} ↗</button>`}${connectionLabel()}`);
  const paused = view.paused || (!practice && status !== 'connected');
  const travelNow=view.serverNow+Math.max(0,Date.now()-viewReceivedAt);
  put('pause-banner',paused?`<div class="pause-banner" role="status">${status!=='connected'?'Reconnecting to the relay. Your place and progress are saved.':'Your partner is away. The story is paused until they return to this room.'}</div>`:'');
  put('stage-bar',`<span class="era-tag ${view.role}">${view.chamber===6?'✦ TOGETHER':view.role==='past'?'☀ THE PAST':'☾ THE FUTURE'} · ${esc(view.players[view.role]?.name)}</span><span class="year">${view.chamber===6?'One shared tomorrow':view.role==='past'?'1874 · Before the silence':'2074 · After the fall'}</span>`);
  const destinationChanged=document.getElementById('scene').dataset.worldKey!==`${view.chamber}:${view.role}`;
  updateScene(document.getElementById('scene'),view);
  if(view.adventure){
    const walkingView={...view,paused,serverNow:travelNow};
    updateTravel(document.getElementById('scene'),walkingView,send,near=>{
      renderAdventureAdvice({...walkingView,serverNow:Math.max(walkingView.serverNow,near?walkingView.travel.motion.arrivesAt:walkingView.serverNow)},near);
      if(near && matchMedia('(max-width:820px)').matches) document.getElementById('controls').scrollIntoView({block:'nearest',behavior:'smooth'});
    });
    if(!document.getElementById('travel-help')) document.querySelector('.stage-frame').insertAdjacentHTML('beforeend','<div id="travel-help" class="travel-help"><strong>Tap a marker to walk & discover</strong><span>Arrow keys / WASD · Tap the stone path</span></div>');
  }
  put('event-line',esc(view.event));
  document.getElementById('chapter-progress').classList.toggle('journey-progress',view.adventure);
  put('chapter-progress',(view.adventure?['Garden','Workshop','Observatory','Canal','Storm tower','Reunion']:['The garden','The workshop','The observatory']).map((title,i)=>`<div class="${view.chamber===i+1?'current':view.chamber>i+1?'complete':''}">${view.chamber>i+1?'✓':`0${i+1}`} ${title}</div>`).join(''));
  if(view.adventure) renderAdventureAdvice({...view,paused,serverNow:travelNow},nearbyStation(view.chamber,view.role,view.travel.motion,travelNow));
  else put('controls',controlMarkup());
  const level=view.hints[view.chamber-1];
  put('hint',`<button data-action="hint" ${level>=3?'disabled':''}>${level>=3?'Solution revealed':level===2?'Reveal the solution':level?'Another nudge?':'Need a small nudge?'}<span aria-hidden="true">${level>=3?'✓':'+'}</span></button>${level?`<p>${esc(HINTS[view.chamber-1][level-1])}</p>`:''}`);
  put('channel-note',practice?'Use the signals to rehearse. Switch eras above to see the other side.':'No voice call needed. Your messages stay inside this relay.');
  const signalNames=['Hold on','Anchor now','Change it','Ready',...(view.chamber===2?SHAPES.map(cap):view.chamber===3?SYMBOLS.map(cap):view.chamber===4?['Mark 1','Mark 2','Mark 3']:view.chamber===5?['North','East','West']:[])];
  put('signals',signalNames.map(text=>`<button class="signal-button" data-action="signal" data-value="${text}" ${!practice&&status!=='connected'?'disabled':''}>${text}</button>`).join(''));
  const log=document.getElementById('messages');
  const nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<30;
  put('messages',view.messages.length?view.messages.map(m=>`<div class="message ${m.role}"><strong>${esc(m.name)}</strong>${esc(m.text)}</div>`).join(''):'<p class="empty-chat">Two centuries apart. Still close enough to listen.</p>');
  if(nearBottom)log.scrollTop=log.scrollHeight;
  renderProposal();
  if(view.adventure && destinationChanged) window.scrollTo({top:0,behavior:'instant'});
  const guideStep=`${view.code}:${view.chamber}:${view.role}:${view.guide?.phase}:${view.guide?.recovery}`;
  if(view.adventure && easyGuide && lastGuideStep!==guideStep && !destinationChanged && matchMedia('(max-width:820px)').matches) document.getElementById('journey-guide').scrollIntoView({block:'start',behavior:'smooth'});
  lastGuideStep=guideStep;
}
function elapsed() {
  const seconds=Math.max(0,Math.round(((view.finishedAt||view.serverNow)-(view.startedAt||view.serverNow))/1000));
  return `${Math.floor(seconds/60)}m ${String(seconds%60).padStart(2,'0')}s`;
}
function renderEnding() {
  stopTravel();
  const firstArrival=mounted!=='ending';
  mount('ending', `<main id="main" class="ending"><div id="ending-mode"></div>${view.adventure?`<div class="reunion-stage"><img src="/assets/reunion.png" alt="The restored garden at sunrise">${reunionMarkup()}</div>`:`<div class="ending-art">${scene(null,'ending')}</div>`}<p class="kicker">${view.adventure?'Six destinations. Two journeys. One tomorrow.':'The relay is complete'}</p><h1>You didn't escape time.<br>You brought each other home.</h1><p>The garden remembers. The conservatory is alive again.<br>And for the first time, you are standing in the same tomorrow.</p><div id="ending-core"></div></main>`);
  put('ending-mode',practice?'<div class="practice-banner"><span>SOLO PRACTICE COMPLETE · Try the real relay with a friend next.</span></div>':'');
  put('ending-core',`<div class="ending-stats"><span><b>0${view.totalChambers||3} / 0${view.totalChambers||3}</b>${view.adventure?'Destinations reached':'Chambers restored'}</span><span><b>${elapsed()}</b>Elapsed, including pauses</span><span><b>${view.hints.reduce((a,b)=>a+b,0)}</b>Hints revealed</span></div><div class="ending-actions"><button class="primary mint" data-action="replay">${practice?'Play practice again ↺':'Swap eras & play again ↔'}</button><button class="secondary" data-action="home">${practice?'Create a real relay →':'Return to the beginning'}</button></div><p class="small-print">${practice?'Practice runs are local to this screen.':`${esc(view.players.past?.name)} & ${esc(view.players.future?.name)} · A story you finished together.`}</p>`);
  renderProposal();
  if(firstArrival && view.adventure) window.scrollTo({top:0,behavior:'instant'});
}
function renderAdventureAdvice(current,near) {
  put('controls',adventureControls(current,near));
  put('journey-guide',guideMarkup(current,near,{enabled:easyGuide,practice:Boolean(practice)}));
  const recommended=easyGuide?nextMove(current,near).place:null;
  for(const marker of document.querySelectorAll('.travel-spot')) {
    const next=marker.dataset.station===recommended;
    marker.classList.toggle('is-recommended',next);
    if(next) marker.setAttribute('aria-current','step'); else marker.removeAttribute('aria-current');
  }
}
function renderProposal() {
  const proposal=view?.proposal;
  if(!proposal){put('proposal-container','');return;}
  const titles={swap:'Trade places in time?',reset:'Try this chamber again?',replay:'See the other side of the story?'};
  const descriptions={swap:'Both travellers must agree. Your readiness will reset.',reset:'Your earlier checkpoints stay secured. Only this chamber restarts.',replay:'Both travellers must agree. You will swap eras and begin a new relay with fresh clues.'};
  put('proposal-container',`<section class="proposal" role="dialog" aria-label="Shared decision"><h3>${titles[proposal.kind]}</h3><p>${proposal.agreed?'Waiting for your partner to agree. ':''}${descriptions[proposal.kind]}</p><div class="proposal-actions">${proposal.agreed?'':`<button class="primary mint" data-action="proposal-accept">Agree</button>`}<button class="secondary" data-action="decline">${proposal.agreed?'Cancel request':'Not now'}</button></div></section>`);
}
function render() {
  if(!view)renderHome(); else if(view.status==='lobby')renderLobby(); else if(view.status==='won')renderEnding(); else renderGame();
  const soundButton=document.getElementById('sound-toggle');
  if(soundButton){soundButton.setAttribute('aria-pressed',String(sound));soundButton.setAttribute('aria-label',sound?'Turn sound off':'Turn sound on');soundButton.innerHTML=`<span class="sound-indicator">${sound?'♪ On':'♪ Off'}</span>`;}
}
async function enter(code) {
  practice=null;status='connecting';busy=true;view=null;chatDraft='';render();
  replaceUrl(`/?room=${encodeURIComponent(code)}`);
  try {
    await connection.connect(code);
    lastRoom=code;local.set('echo-last-room',code);
  } catch(error) {
    connection.stop();busy=false;status='offline';roomInput=code;tab='join';render();
    if(error.status!==401)notify(roomError(error));
  }
}
async function enterFromForm() {
  if(busy)return;
  nickname=document.getElementById('nickname')?.value.trim()||nickname;
  if(!nickname){notify('Give your traveller a name first.');return;}
  local.set('echo-name',nickname);
  if(tab==='join'){
    roomInput=(document.getElementById('room-input')?.value||roomInput).trim().toUpperCase();
    if(!/^[A-HJ-NP-Z2-9]{6}$/.test(roomInput)){notify('Use the six-character code your friend shared. Codes do not contain I, O, 0 or 1.');return;}
  }
  busy=true;render();
  try {
    const data=await api(tab==='join'?`/api/rooms/${roomInput}/join`:'/api/rooms',{name:nickname});
    await enter(data.code);
  }catch(error){busy=false;notify(roomError(error));render();}
}
function practiceCommand(command,role=practiceRole) {
  const id=practice.players[role].id;
  practice=applyCommand(practice,id,{...command,id:makeId(),epoch:practice.epoch},new Set(Object.values(practice.players).filter(Boolean).map(p=>p.id)));
}
function startPractice() {
  connection.stop();status='practice';practiceRole='past';chatDraft='';
  const seed=crypto.getRandomValues(new Uint32Array(1))[0];
  practice=createAdventureRoom('SOLO','Your past self','practice-past','not-a-live-credential',seed);
  practice=joinRoom(practice,'Your future self','practice-future','not-a-live-credential');
  practiceCommand({type:'ready',value:true},'past');practiceCommand({type:'ready',value:true},'future');
  replaceUrl('/');refreshPractice();
}
function refreshPractice() {
  view=projectView(practice,practice.players[practiceRole].id,new Set(Object.values(practice.players).map(p=>p.id)));
  viewReceivedAt=Date.now();
  render();
}
function send(command) {
  if(practice){try{practiceCommand(command);refreshPractice();return true;}catch(error){notify(error.message);return false;}}
  return connection.send(command);
}
function home() {
  if(view?.status==='playing'&&!confirm(practice?'Leave this practice run?':'Return home? Your role stays reserved; rejoin with the same browser to continue.'))return;
  stopTravel();connection.stop();practice=null;view=null;status='offline';busy=false;mounted='';chatDraft='';tab='create';replaceUrl('/');render();
}
function showGuide() {
  let dialog=document.getElementById('guide-dialog');
  if(!dialog){
    dialog=document.createElement('dialog');dialog.id='guide-dialog';
    document.body.append(dialog);
  }
  dialog.setAttribute('aria-labelledby','guide-title');
  dialog.innerHTML=`<p class="kicker">Learn while you play</p><h2 id="guide-title">One small step at a time.</h2><p><strong>Past changes things. Future saves them.</strong> “Preserve this moment” keeps one object in its current condition, even after Past changes the water, power or light.</p><p>Tap the <strong>highlighted place</strong> to walk there. Its controls appear when you arrive. Follow <strong>Your next move</strong> above the scene; it tells you when to act and when to wait.</p><h3>${view?.status==='playing'?esc(view.title):'Try level 1: The Root Bridge'}</h3>${walkthroughMarkup(view?.status==='playing'?view.chamber:1,view?.role)}<p class="action-note">${practice?'Playing solo? Use “Now play Future” or “Now play Past” in the guide to take turns.':'Playing together? Send clues with the guide’s “Share clue” button, or talk to each other.'} If you saved the wrong object, release it and try again. There is no countdown.</p><button class="primary" data-action="close-guide">Got it · Back to the game</button>`;
  dialog.showModal();
}
function showPrivacy() {
  let dialog=document.getElementById('privacy-dialog');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='privacy-dialog';dialog.innerHTML=`<p class="kicker">A private relay</p><h2>Only what the game needs.</h2><p>When deployed to Cloudflare, online rooms store two display names, short messages and puzzle progress on the host's account. Rooms expire after 24 hours without a game action. Do not send sensitive information.</p><p>A private, HTTP-only browser cookie lets you return to your role. Invitation links contain only the room code, never your session credential. Use the same browser and device to reconnect.</p><p>Your browser remembers your traveller name and most recent room locally. Solo practice stays in this page's memory. This application adds no analytics, advertising, external AI calls, camera or microphone access. Cloudflare processes hosting traffic under its own policies.</p><button class="primary" data-action="close-privacy">Back to the relay</button>`;document.body.append(dialog);}dialog.showModal();
}

app.addEventListener('input',event=>{
  if(event.target.id==='nickname')nickname=event.target.value;
  if(event.target.id==='room-input'){event.target.value=event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');roomInput=event.target.value;}
  if(event.target.id==='chat-input')chatDraft=event.target.value;
});
app.addEventListener('submit',event=>{
  event.preventDefault();
  if(event.target.id==='entry-form'){enterFromForm();return;}
  if(event.target.id==='chat-form'){
    const input=document.getElementById('chat-input'),text=input.value.trim();
    if(text&&send({type:'chat',text})){chatDraft='';input.value='';input.focus();}
  }
});
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');
  if(!button||button.disabled)return;
  const action=button.dataset.action,value=button.dataset.value;
  try{
    if(action==='home'){home();return;}
    if(action==='tab-create'||action==='tab-join'){tab=action==='tab-create'?'create':'join';render();return;}
    if(action==='practice'){startPractice();return;}
    if(action==='practice-swap'){practiceRole=practiceRole==='past'?'future':'past';refreshPractice();return;}
    if(action==='resume'){await enter(lastRoom);return;}
    if(action==='guide'){showGuide();return;}
    if(action==='toggle-guide'){easyGuide=!easyGuide;local.set('echo-easy-guide',easyGuide?'on':'off');render();return;}
    if(action==='show-controls'){document.getElementById('controls')?.scrollIntoView({block:'center',behavior:'smooth'});return;}
    if(action==='privacy'){showPrivacy();return;}
    if(action==='close-guide'){document.getElementById('guide-dialog').close();return;}
    if(action==='close-privacy'){document.getElementById('privacy-dialog').close();return;}
    if(action==='sound'){
      if(!sound){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){notify('Sound is not available in this browser. All puzzles work without it.');return;}audio=audio||new Audio();await audio.resume();sound=true;chime();}
      else{sound=false;if(audio)await audio.suspend();}render();return;
    }
    if(action==='copy-code'||action==='copy-link'){
      const text=action==='copy-code'?view.code:`${location.origin}/?room=${view.code}`;
      try{await navigator.clipboard.writeText(text);notify(action==='copy-code'?'Relay code copied.':'Invitation copied. Send it to your playing partner.');}catch{
        if(action==='copy-link') { const address=document.getElementById('invitation-url'); if(address){address.focus();address.select();} }
        notify(action==='copy-code'?`Share this relay code: ${view.code}`:`Copy and share this full invitation: ${text}`);
      }return;
    }
    if(!view)return;
    if(action==='walk-to'){
      const station=stationsFor(view.chamber,view.role).find(s=>s.id===value);
      if(station)send({type:'move',x:station.x,y:station.y});return;
    }
    if(action==='walk-away'){send({type:'move',x:10,y:view.chamber===1?78:88});return;}
    if(action==='ready'){send({type:'ready',value:!view.players[view.role].ready});return;}
    if(['water','gear','power','beam','mooring','heading','shutter'].includes(action)){send({type:action,value});return;}
    if(action==='tide'){send({type:'tide',value:Number(value)});return;}
    if(action==='ring'){send({type:'ring',index:Number(button.dataset.index),value});return;}
    if(['anchor','release','cross','ride','pulse','decline','sail','ascend','meet'].includes(action)){send({type:action});return;}
    if(action==='signal'){send({type:'chat',text:value});return;}
    if(action==='guide-share'){if(send({type:'chat',text:value}))notify('Message sent to your partner.');return;}
    if(action==='hint'){
      const level=view.hints[view.chamber-1];
      if(level===2&&!confirm('Reveal the full solution for this chamber? Your partner will see it too.'))return;
      send({type:'hint',confirm:level===2});return;
    }
    if(['reset','swap','replay'].includes(action)){
      if(practice){
        if(action==='reset'&&!confirm('Restart this practice chamber? Earlier checkpoints stay secured.'))return;
        practiceCommand({type:'propose',kind:action},practiceRole);
        practiceCommand({type:'propose',kind:action},practiceRole==='past'?'future':'past');
        if(action==='replay'){practiceCommand({type:'ready',value:true},'past');practiceCommand({type:'ready',value:true},'future');}
        refreshPractice();
      }else send({type:'propose',kind:action});
      return;
    }
    if(action==='proposal-accept'){send({type:'propose',kind:view.proposal.kind});return;}
  }catch(error){notify(error.message||'That signal did not arrive. Please try again.');}
});
window.addEventListener('beforeunload',()=>connection.stop());
render();
if(offlineOnly && new URL(location.href).searchParams.get('practice') === '1') startPractice();
else if(!offlineOnly && roomInput&&/^[A-HJ-NP-Z2-9]{6}$/.test(roomInput))enter(roomInput);
