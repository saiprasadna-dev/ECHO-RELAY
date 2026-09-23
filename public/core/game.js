/**
 * ECHO RELAY's deterministic, platform-independent rules.
 * The server owns the canonical Room; browsers only receive projectView().
 * The same rules also power the explicitly labelled, local-only practice mode.
 */
export const ROLES = ["past", "future"];
export const SHAPES = ["circle", "triangle", "diamond"];
export const SYMBOLS = ["sun", "moon", "star", "wave"];
/** UUID for action IDs; getRandomValues also works in local/offline practice. */
export function makeId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const h = Array.from(bytes, n => n.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export const ROOM_TTL = 24 * 60 * 60 * 1000;
export const CHAMBERS = ["The Root Bridge", "The Clockwork Lift", "The Last Light"];
export const GLYPHS = { circle: "●", triangle: "▲", diamond: "◆", sun: "☀", moon: "☾", star: "✦", wave: "≈" };

export class GameError extends Error {
  constructor(code, message, status = 400) { super(message); this.name = "GameError"; this.code = code; this.status = status; }
}
function need(condition, code, message, status) { if (!condition) throw new GameError(code, message, status); }
export function cleanName(value) {
  need(typeof value === "string", "NAME", "Enter a name for your traveller.");
  const name = value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").trim();
  need(name.length >= 1 && name.length <= 24, "NAME", "Use a name between 1 and 24 characters.");
  return name;
}
function randomInt(s, n) {
  // Seed is created on the server and NEVER included in a player's view.
  let x = s.rng | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng % n;
}
function makeWorld(s) {
  return {
    water: "drain", gear: "circle", power: "workshop",
    requiredGear: SHAPES[randomInt(s, SHAPES.length)],
    rings: ["sun", "sun", "sun"],
    target: Array.from({ length: 3 }, () => SYMBOLS[randomInt(s, SYMBOLS.length)]),
    beamPower: "lens", anchor: null, pulses: { past: false, future: false }
  };
}
export function createRoom(code, name, id, tokenHash, seed, now = Date.now()) {
  const room = {
    schema: 1, code, revision: 0, epoch: 1, rng: (seed >>> 0) || 18273921,
    status: "lobby", chamber: 1,
    players: { past: { id, name: cleanName(name), tokenHash, ready: false }, future: null },
    createdAt: now, lastActivity: now, startedAt: null, finishedAt: null,
    hints: [0, 0, 0], messages: [], proposal: null, seen: {},
    event: "One signal. Waiting for its echo."
  };
  room.world = makeWorld(room);
  return room;
}
export function joinRoom(original, name, id, tokenHash, now = Date.now()) {
  need(now < original.lastActivity + ROOM_TTL, "EXPIRED", "This relay has faded. Create a new one.", 404);
  need(original.status === "lobby" && !original.players.future, "FULL", "Both timelines already have a traveller. Ask your friend for a new room.", 409);
  const room = structuredClone(original);
  room.players.future = { id, name: cleanName(name), tokenHash, ready: false };
  room.lastActivity = now; room.revision++;
  room.event = "Two signals found each other. Your relay is ready.";
  return room;
}
export function roleFor(room, playerId) {
  return ROLES.find(role => room.players[role]?.id === playerId) || null;
}
export function physical(room) {
  const w = room.world, a = w.anchor;
  const bridge = a?.kind === "bridge" ? a.condition : (w.water === "grow" ? "grown" : "stump");
  const drive = a?.kind === "drive" ? a.condition : (w.gear !== w.requiredGear ? "jammed" : w.power === "workshop" ? "working" : "inactive");
  const aligned = w.rings.every((v, i) => v === w.target[i]);
  const lens = a?.kind === "lens" ? a.condition : (aligned && w.beamPower === "lens" ? "charged" : "empty");
  const flooded = w.water === "grow";
  return {
    bridge, flooded, drive, lens,
    canCross: bridge === "grown" && !flooded && a?.kind === "bridge" && a.condition === "grown",
    canRide: drive === "working" && w.power === "lift" && a?.kind === "drive" && a.condition === "working",
    canPulse: lens === "charged" && w.beamPower === "portal" && a?.kind === "lens" && a.condition === "charged"
  };
}
function validateEnvelope(c) {
  need(c && typeof c === "object" && !Array.isArray(c), "COMMAND", "That signal was unreadable.");
  need(typeof c.id === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(c.id), "COMMAND", "That signal needs a valid identifier.");
  need(Number.isSafeInteger(c.epoch) && c.epoch > 0, "COMMAND", "That signal is missing its timeline.");
  need(typeof c.type === "string", "COMMAND", "Choose an action first.");
}
function advance(room, now) {
  room.chamber++; room.epoch++; room.world.anchor = null; room.proposal = null;
  room.event = room.chamber === 2 ? "The garden gate remembers. One step closer." : "The lift is secured. The last light is waiting.";
}
function resetChamber(room) {
  const w = room.world;
  w.anchor = null; w.pulses = { past: false, future: false };
  if (room.chamber === 1) w.water = "drain";
  if (room.chamber === 2) { w.gear = "circle"; w.power = "workshop"; }
  if (room.chamber === 3) { w.rings = ["sun", "sun", "sun"]; w.beamPower = "lens"; }
  room.epoch++; room.proposal = null;
  room.event = "A fresh attempt. Your secured checkpoints are safe.";
}
function enactProposal(room, kind, now) {
  if (kind === "reset") { resetChamber(room); return; }
  const oldPast = room.players.past;
  room.players.past = room.players.future;
  room.players.future = oldPast;
  room.players.past.ready = false; room.players.future.ready = false;
  if (kind === "replay") {
    const oldTarget = room.world.target.join("-");
    room.world = makeWorld(room);
    if (room.world.target.join("-") === oldTarget) {
      room.world.target[0] = SYMBOLS[(SYMBOLS.indexOf(room.world.target[0]) + 1) % SYMBOLS.length];
    }
    room.status = "lobby"; room.chamber = 1; room.startedAt = null; room.finishedAt = null;
    room.hints = [0, 0, 0]; room.messages = [];
    room.event = "A new relay. This time, see the other side.";
  } else room.event = "Your timelines are swapped. Ready when you are.";
  room.epoch++; room.proposal = null;
}

/** Process one authenticated command transactionally. Does not mutate original. */
export function applyCommand(original, playerId, command, onlineIds, now = Date.now()) {
  validateEnvelope(command);
  const role = roleFor(original, playerId);
  need(role, "AUTH", "You do not own a role in this relay.", 401);
  need(now < original.lastActivity + ROOM_TTL, "EXPIRED", "This relay has faded. Start a new room.", 404);
  if (original.seen[playerId]?.includes(command.id)) return original; // Duplicate delivery is harmless.
  need(command.epoch === original.epoch, "STALE", "The timeline has moved on. Try that action again.", 409);
  const room = structuredClone(original), w = room.world, c = command;
  const bothHere = ROLES.every(r => room.players[r] && onlineIds.has(room.players[r].id));
  if (room.proposal && room.proposal.expiresAt <= now) room.proposal = null;
  const requirePlaying = () => {
    need(room.status === "playing", "PHASE", "That action belongs inside a chamber.");
    need(bothHere, "PAUSED", "Your partner is disconnected. Their place is safe; wait for them to rejoin.");
  };
  const requireRole = expected => need(role === expected, "ROLE", "Only the traveller in the other era can do that.", 403);
  switch (c.type) {
    case "ready":
      need(room.status === "lobby", "PHASE", "Your relay has already begun.");
      need(typeof c.value === "boolean", "VALUE", "Choose ready or not ready.");
      room.players[role].ready = c.value;
      if (bothHere && ROLES.every(r => room.players[r].ready)) {
        room.status = "playing"; room.startedAt = now; room.epoch++; room.proposal = null;
        room.event = "The garden is quiet. Someone is on the other side of time.";
      }
      break;
    case "chat": {
      need(typeof c.text === "string", "MESSAGE", "Write a message first.");
      const text = c.text.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").trim();
      need(text.length > 0 && text.length <= 220, "MESSAGE", "Keep your signal between 1 and 220 characters.");
      const previous = [...room.messages].reverse().find(m => m.playerId === playerId);
      need(!previous || now - previous.at >= 450, "RATE", "Give your last signal a moment to arrive.", 429);
      room.messages.push({ id: c.id, playerId, role, name: room.players[role].name, text, at: now });
      room.messages = room.messages.slice(-40);
      break;
    }
    case "propose":
      need(bothHere, "PAUSED", "Both travellers need to be connected first.");
      need(["swap", "reset", "replay"].includes(c.kind), "VALUE", "Choose a valid shared decision.");
      need((c.kind === "swap" && room.status === "lobby") || (c.kind === "reset" && room.status === "playing") || (c.kind === "replay" && room.status === "won"), "PHASE", "That shared decision is not available here.");
      need(!room.proposal || room.proposal.kind === c.kind, "PROPOSAL", "Answer the current shared decision first.");
      if (!room.proposal) room.proposal = { kind: c.kind, approvals: [], expiresAt: now + 120_000 };
      if (!room.proposal.approvals.includes(playerId)) room.proposal.approvals.push(playerId);
      if (room.proposal.approvals.length === 2) enactProposal(room, c.kind, now);
      break;
    case "decline": room.proposal = null; break;
    case "hint":
      requirePlaying();
      if (room.hints[room.chamber - 1] === 2) need(c.confirm === true, "CONFIRM", "Confirm before revealing the solution.");
      room.hints[room.chamber - 1] = Math.min(3, room.hints[room.chamber - 1] + 1);
      break;
    case "water":
      requirePlaying(); requireRole("past");
      need(room.chamber === 1, "CHAMBER", "The water wheel is in the garden.");
      need(["grow", "drain"].includes(c.value), "VALUE", "Choose Grow or Drain.");
      w.water = c.value; room.event = "The water wheel turns. Another world answers.";
      break;
    case "gear":
      requirePlaying(); requireRole("past");
      need(room.chamber === 2 && SHAPES.includes(c.value), "VALUE", "Choose a gear for the workshop.");
      w.gear = c.value; room.event = "A new bearing settles into the machine.";
      break;
    case "power":
      requirePlaying(); requireRole("past");
      need(room.chamber === 2 && ["workshop", "lift"].includes(c.value), "VALUE", "Route power to Workshop or Lift.");
      w.power = c.value; room.event = "Current changes course through the conservatory.";
      break;
    case "ring":
      requirePlaying(); requireRole("past");
      need(room.chamber === 3 && Number.isInteger(c.index) && c.index >= 0 && c.index < 3 && SYMBOLS.includes(c.value), "VALUE", "Choose a symbol for one of the three rings.");
      w.rings[c.index] = c.value; room.event = "A brass ring turns beneath an unfamiliar sky.";
      break;
    case "beam":
      requirePlaying(); requireRole("past");
      need(room.chamber === 3 && ["lens", "portal"].includes(c.value), "VALUE", "Route light to Lens or Portal.");
      w.beamPower = c.value; room.event = "The beam finds a different path.";
      break;
    case "anchor": {
      requirePlaying(); requireRole("future");
      if (w.anchor) break; // Capture only once, never silently recapture a different condition.
      const p = physical(room), kind = ["bridge", "drive", "lens"][room.chamber - 1];
      w.anchor = { kind, condition: p[kind] };
      room.event = "A small piece of the future refuses to disappear.";
      break;
    }
    case "release":
      requirePlaying(); requireRole("future"); w.anchor = null;
      room.event = "The anchor lets go. Time moves again.";
      break;
    case "cross":
      requirePlaying(); requireRole("future");
      need(room.chamber === 1 && physical(room).canCross, "BLOCKED", "The exit must be dry and the grown root bridge must be anchored.");
      advance(room, now); break;
    case "ride":
      requirePlaying(); requireRole("future");
      need(room.chamber === 2 && physical(room).canRide, "BLOCKED", "The lift needs power and an anchored, working drive.");
      advance(room, now); break;
    case "pulse":
      requirePlaying();
      need(room.chamber === 3 && physical(room).canPulse, "BLOCKED", "The portal needs power and an anchored, charged lens.");
      w.pulses[role] = true;
      room.event = "One pulse is waiting. There is no rush; find each other.";
      if (w.pulses.past && w.pulses.future) {
        room.status = "won"; room.finishedAt = now; room.epoch++; room.proposal = null;
        room.event = "You didn't escape time. You brought each other home.";
      }
      break;
    default: throw new GameError("COMMAND", "That action is not part of this relay.");
  }
  if (room.status === "playing" && room.chamber === 3 && !physical(room).canPulse) w.pulses = { past: false, future: false };
  room.seen[playerId] = [...(room.seen[playerId] || []), c.id].slice(-64);
  room.lastActivity = now; room.revision++;
  return room;
}

/** Explicit allow-list projection: no token hashes, ids, seed, or other-era secret clues. */
export function projectView(room, playerId, onlineIds, now = Date.now()) {
  const role = roleFor(room, playerId);
  need(role, "AUTH", "Join this relay before opening its timeline.", 401);
  const p = physical(room), w = room.world;
  const view = {
    code: room.code, role, revision: room.revision, epoch: room.epoch,
    status: room.status, chamber: room.chamber, title: CHAMBERS[room.chamber - 1],
    players: Object.fromEntries(ROLES.map(r => [r, room.players[r] ? {
      name: room.players[r].name, ready: room.players[r].ready, connected: onlineIds.has(room.players[r].id)
    } : null])),
    paused: room.status === "playing" && !ROLES.every(r => room.players[r] && onlineIds.has(room.players[r].id)),
    startedAt: room.startedAt, finishedAt: room.finishedAt, serverNow: now,
    hints: room.hints, event: room.event,
    messages: room.messages.map(({ id, role: senderRole, name, text, at }) => ({ id, role: senderRole, name, text, at })),
    proposal: room.proposal && room.proposal.expiresAt > now ? {
      kind: room.proposal.kind, agreed: room.proposal.approvals.includes(playerId), expiresAt: room.proposal.expiresAt
    } : null
  };
  // Anchors are visible in the future only; communicate before changing the past.
  if (role === "future") view.anchor = w.anchor ? { ...w.anchor } : null;
  if (room.chamber === 1) view.scene = role === "past" ? { water: w.water } : { bridge: p.bridge, flooded: p.flooded, canCross: p.canCross };
  if (room.chamber === 2) view.scene = role === "past" ? { gear: w.gear, power: w.power } : { requiredGear: w.requiredGear, drive: p.drive, liftPowered: w.power === "lift", canRide: p.canRide };
  if (room.chamber === 3) view.scene = role === "past" ? { rings: [...w.rings], beamPower: w.beamPower, canPulse: p.canPulse, pulses: { ...w.pulses } } : { target: [...w.target], lens: p.lens, portalPowered: w.beamPower === "portal", canPulse: p.canPulse, pulses: { ...w.pulses } };
  return view;
}

export const HINTS = [
  ["The same water can make a bridge and block a doorway.", "An anchor preserves one object, not the whole garden.", "Past: choose Grow. Future: anchor the grown bridge. Past: choose Drain. Future: cross the dry exit."],
  ["The old blueprint survived in the future, but only the past can install its bearing.", "The drive and the lift need power at different moments. Save the working drive before moving the power.", "Future: share the blueprint shape. Past: install that shape with Workshop power. Future: anchor the working drive. Past: switch to Lift. Future: ride."],
  ["The future's constellation is a sequence, not a set. Order matters.", "Charge something worth preserving before giving the portal its light.", "Future: share all three symbols in order. Past: match the rings with Lens power. Future: anchor the charged lens. Past: switch to Portal. Both: send your final pulse."]
];
