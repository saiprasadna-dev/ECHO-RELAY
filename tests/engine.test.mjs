import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, joinRoom, applyCommand, projectView, physical, roleFor,
  cleanName, makeId, SHAPES, SYMBOLS, ROOM_TTL } from '../public/core/game.js';

// Fixed clock and deterministic seed keep failures reproducible.
function game(start = true, seed = 124) {
  let now = 1_000_000;
  let room = createRoom('ABC234', 'Alice', 'alice', 'hash-a', seed, now);
  room = joinRoom(room, 'Bob', 'bob', 'hash-b', now);
  const g = {
    get room() { return room; },
    get now() { return now; },
    online: new Set(['alice', 'bob']),
    command(role, type, values = {}, advance = 500) {
      now += advance;
      const id = room.players[role]?.id || role;
      room = applyCommand(room, id, { id: makeId(), epoch: room.epoch, type, ...values }, g.online, now);
      return room;
    },
    view(role) { return projectView(room, room.players[role].id, g.online, now); },
    bridge() { g.command('past','water',{value:'grow'}); g.command('future','anchor'); g.command('past','water',{value:'drain'}); g.command('future','cross'); },
    lift() { g.command('past','gear',{value:g.view('future').scene.requiredGear}); g.command('future','anchor'); g.command('past','power',{value:'lift'}); g.command('future','ride'); },
    lens() { g.view('future').scene.target.forEach((value,index)=>g.command('past','ring',{index,value})); g.command('future','anchor'); g.command('past','beam',{value:'portal'}); },
    win() { g.bridge(); g.lift(); g.lens(); g.command('past','pulse'); g.command('future','pulse'); }
  };
  if (start) { g.command('past','ready',{value:true}); g.command('future','ready',{value:true}); }
  return g;
}
const rejects = (fn, code) => assert.throws(fn, error => error.code === code);

test('new room owns separate past and future roles', () => {
  const g=game(false); assert.equal(roleFor(g.room,'alice'),'past'); assert.equal(roleFor(g.room,'bob'),'future'); assert.equal(roleFor(g.room,'stranger'),null);
});
test('one ready traveller cannot start alone', () => {
  const g=game(false); g.command('past','ready',{value:true}); assert.equal(g.room.status,'lobby');
  g.command('future','ready',{value:true}); assert.equal(g.room.status,'playing');
});
test('both ready requires both connected', () => {
  const g=game(false); g.online.delete('bob'); g.command('past','ready',{value:true}); g.command('future','ready',{value:true}); assert.equal(g.room.status,'lobby');
});
test('an occupied room rejects a third participant', () => rejects(()=>joinRoom(game(false).room,'Eve','eve','hash-e',1_000_000),'FULL'));
test('an expired room rejects joining', () => {
  const r=createRoom('ABC234','Alice','alice','hash-a',1,1); rejects(()=>joinRoom(r,'Bob','bob','hash-b',ROOM_TTL+1),'EXPIRED');
});
for (const [label, value] of [['blank','  '],['long','a'.repeat(25)],['non-string',7],['control-only','\u0000\u202e']]) {
  test(`names reject ${label}`,()=>rejects(()=>cleanName(value),'NAME'));
}
test('names trim whitespace and remove control characters',()=>assert.equal(cleanName('  Al\u0000ice\u202e  '),'Alice'));
test('commands require authenticated role ownership',()=>rejects(()=>game().command('eve','water',{value:'grow'}),'AUTH'));
for (const [role,type,values] of [['future','water',{value:'grow'}],['past','anchor',{}],['past','release',{}],['past','cross',{}]]) {
  test(`${role} cannot issue ${type}`,()=>rejects(()=>game().command(role,type,values),'ROLE'));
}
test('disconnected partner pauses puzzle changes',()=>{
  const g=game(); g.online.delete('bob'); assert.equal(g.view('past').paused,true); rejects(()=>g.command('past','water',{value:'grow'}),'PAUSED');
});
test('rejected commands leave canonical room unchanged',()=>{
  const g=game(), before=JSON.stringify(g.room); rejects(()=>g.command('future','cross'),'BLOCKED'); assert.equal(JSON.stringify(g.room),before);
});
test('unknown commands cannot set solved flags',()=>rejects(()=>game().command('past','win',{status:'won',chamber:3}),'COMMAND'));
test('stale chamber epochs are rejected',()=>rejects(()=>game().command('past','water',{value:'grow',epoch:1}),'STALE'));
test('duplicate action IDs are idempotent',()=>{
  const g=game(); const id=makeId(); g.command('past','water',{id,value:'grow'}); const prior=g.room;
  g.command('past','water',{id,value:'drain'}); assert.equal(g.room,prior); assert.equal(g.room.world.water,'grow');
});
test('growing the bridge also floods the exit',()=>{
  const g=game(); g.command('past','water',{value:'grow'}); assert.equal(physical(g.room).bridge,'grown'); assert.equal(physical(g.room).flooded,true); rejects(()=>g.command('future','cross'),'BLOCKED');
});
test('unanchored bridge disappears when the past drains',()=>{
  const g=game(); g.command('past','water',{value:'grow'}); g.command('past','water',{value:'drain'}); assert.equal(physical(g.room).bridge,'stump');
});
test('anchoring a stump does not create a bridge',()=>{
  const g=game(); g.command('future','anchor'); g.command('past','water',{value:'grow'}); assert.equal(physical(g.room).bridge,'stump');
  g.command('future','anchor'); assert.equal(g.room.world.anchor.condition,'stump'); rejects(()=>g.command('future','cross'),'BLOCKED');
});
test('release restores the current consequences of the past',()=>{
  const g=game(); g.command('future','anchor'); g.command('past','water',{value:'grow'}); g.command('future','release'); assert.equal(physical(g.room).bridge,'grown');
});
test('root bridge solution secures checkpoint and frees anchor',()=>{
  const g=game(); g.bridge(); assert.equal(g.room.chamber,2); assert.equal(g.room.world.anchor,null); assert.equal(g.view('future').title,'The Clockwork Lift');
});
test('gear blueprint is only projected to future',()=>{
  const g=game(); g.bridge(); assert.ok(SHAPES.includes(g.view('future').scene.requiredGear)); assert.ok(!('requiredGear' in g.view('past').scene));
});
test('wrong gear cannot be repaired by anchoring it',()=>{
  const g=game(); g.bridge(); const right=g.room.world.requiredGear;
  g.command('past','gear',{value:SHAPES.find(x=>x!==right)}); g.command('future','anchor');
  g.command('past','gear',{value:right}); g.command('past','power',{value:'lift'});
  assert.equal(physical(g.room).drive,'jammed'); rejects(()=>g.command('future','ride'),'BLOCKED');
});
test('unanchored drive loses power when power moves to lift',()=>{
  const g=game(); g.bridge(); g.command('past','gear',{value:g.room.world.requiredGear});
  assert.equal(physical(g.room).drive,'working'); g.command('past','power',{value:'lift'}); assert.equal(physical(g.room).drive,'inactive');
});
test('working anchored drive permits powered lift',()=>{
  const g=game(); g.bridge(); g.lift(); assert.equal(g.room.chamber,3); assert.equal(g.room.world.anchor,null);
});
test('future constellation and server credentials are private',()=>{
  const g=game(); g.bridge(); g.lift(); const past=g.view('past'),future=g.view('future');
  assert.ok(!('target' in past.scene)); assert.equal(future.scene.target.length,3);
  for(const view of [past,future]) {
    const keys=JSON.stringify(view); for(const forbidden of ['tokenHash','hash-a','hash-b','"rng"','"seen"','"playerId"']) assert.ok(!keys.includes(forbidden),forbidden);
  }
});
test('wrong symbol sequence leaves the lens empty',()=>{
  const g=game(); g.bridge(); g.lift(); g.room.world.target.forEach((symbol,index)=>g.command('past','ring',{index,value:SYMBOLS[(SYMBOLS.indexOf(symbol)+1)%SYMBOLS.length]}));
  assert.equal(physical(g.room).lens,'empty'); g.command('future','anchor'); g.command('past','beam',{value:'portal'}); rejects(()=>g.command('past','pulse'),'BLOCKED');
});
test('one pulse waits without finishing the relay',()=>{
  const g=game(); g.bridge(); g.lift(); g.lens(); g.command('past','pulse'); assert.equal(g.room.status,'playing'); assert.equal(g.room.world.pulses.past,true);
});
test('invalid portal conditions cancel pending pulses',()=>{
  const g=game(); g.bridge(); g.lift(); g.lens(); g.command('past','pulse'); g.command('future','release'); assert.deepEqual(g.room.world.pulses,{past:false,future:false});
});
test('two independent pulses under valid conditions finish all three chambers',()=>{
  const g=game(); g.win(); assert.equal(g.room.status,'won'); assert.ok(g.room.finishedAt>g.room.startedAt);
});
test('restart requires both participants and preserves secret clue',()=>{
  const g=game(); g.bridge(); const clue=g.room.world.requiredGear; g.command('future','anchor');
  g.command('past','propose',{kind:'reset'}); assert.notEqual(g.room.world.anchor,null);
  g.command('future','propose',{kind:'reset'}); assert.equal(g.room.world.anchor,null); assert.equal(g.room.chamber,2); assert.equal(g.room.world.requiredGear,clue);
});
test('one participant cannot approve their own proposal twice',()=>{
  const g=game(); g.command('past','propose',{kind:'reset'}); const epoch=g.room.epoch;
  g.command('past','propose',{kind:'reset'}); assert.equal(g.room.epoch,epoch); assert.equal(g.room.proposal.approvals.length,1);
});
test('a proposal may be declined',()=>{
  const g=game(); g.command('past','propose',{kind:'reset'}); g.command('future','decline'); assert.equal(g.room.proposal,null);
});
test('lobby role swap requires both participants',()=>{
  const g=game(false); g.command('past','propose',{kind:'swap'}); assert.equal(g.room.players.past.id,'alice');
  g.command('future','propose',{kind:'swap'}); assert.equal(g.room.players.past.id,'bob'); assert.equal(g.room.players.past.ready,false);
});
test('mutual replay swaps roles and refreshes puzzle state',()=>{
  const g=game(); g.win(); const old=[...g.room.world.target]; g.command('past','propose',{kind:'replay'}); assert.equal(g.room.status,'won');
  g.command('future','propose',{kind:'replay'}); assert.equal(g.room.status,'lobby'); assert.equal(g.room.players.past.id,'bob'); assert.equal(g.room.chamber,1);
  assert.equal(g.room.world.anchor,null); assert.notDeepEqual(g.room.world.target,old); assert.deepEqual(g.room.hints,[0,0,0]);
});
test('full solution hint requires confirmation',()=>{
  const g=game(); g.command('past','hint'); g.command('past','hint'); rejects(()=>g.command('past','hint'),'CONFIRM');
  g.command('future','hint',{confirm:true}); assert.equal(g.room.hints[0],3);
});
test('chat intentionally communicates across eras',()=>{
  const g=game(); g.command('future','chat',{text:'Triangle bearing'}); assert.equal(g.view('past').messages.at(-1).text,'Triangle bearing');
});
test('chat enforces rate and length limits',()=>{
  const g=game(); rejects(()=>g.command('past','chat',{text:'a'.repeat(221)}),'MESSAGE');
  g.command('past','chat',{text:'Hold'}); rejects(()=>g.command('past','chat',{text:'Hold'},0),'RATE');
});
test('chat keeps only the 40 most recent messages',()=>{
  const g=game(); for(let i=0;i<45;i++)g.command('past','chat',{text:`Signal ${i}`});
  assert.equal(g.room.messages.length,40); assert.equal(g.room.messages[0].text,'Signal 5');
});
test('expired sessions cannot perform game actions',()=>{
  const g=game(); rejects(()=>g.command('past','water',{value:'grow'},ROOM_TTL),'EXPIRED');
});
test('one room cannot mutate another room',()=>{
  const a=game(),b=game(); a.command('past','water',{value:'grow'}); assert.equal(b.room.world.water,'drain');
});
test('every seeded puzzle is solvable through role-specific views',()=>{
  for(let seed=1;seed<=100;seed++){const g=game(true,seed);g.win();assert.equal(g.room.status,'won',`seed ${seed}`);}
});
