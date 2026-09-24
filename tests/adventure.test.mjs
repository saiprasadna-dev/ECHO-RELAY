import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdventureRoom,joinRoom,applyCommand,projectView,makeId} from '../public/core/game.js';
import {stationsFor,positionAt,nearbyStation} from '../public/core/travel.js';

function adventure(seed=731) {
  let now=1_000_000, room=createAdventureRoom('ABC234','Past','p','hp',seed,now);
  room=joinRoom(room,'Future','f','hf',now);
  const online=new Set(['p','f']);
  const g={
    get room(){return room;}, get now(){return now;}, online,
    command(role,type,values={},dt=250){now+=dt;room=applyCommand(room,room.players[role].id,{id:makeId(),epoch:room.epoch,type,...values},online,now);return room;},
    wait(ms=5000){now+=ms;},
    view(role){return projectView(room,room.players[role].id,online,now);},
    walk(role,id){const p=stationsFor(room.chamber,role).find(s=>s.id===id);g.command(role,'move',{x:p.x,y:p.y});g.wait();},
    use(role,type,values={}){const s=stationsFor(room.chamber,role).find(s=>s.actions.includes(type));g.walk(role,s.id);g.command(role,type,values);},
    bridge(){g.use('past','water',{value:'grow'});g.use('future','anchor');g.use('past','water',{value:'drain'});g.use('future','cross');},
    lift(){g.use('past','gear',{value:g.view('future').scene.requiredGear});g.use('future','anchor');g.use('past','power',{value:'lift'});g.use('future','ride');},
    portal(){g.view('future').scene.target.forEach((value,index)=>g.use('past','ring',{index,value}));g.use('future','anchor');g.use('past','beam',{value:'portal'});g.use('past','pulse');g.use('future','pulse');},
    canal(){g.use('past','tide',{value:g.view('future').scene.safeTide});g.use('future','anchor');g.use('past','mooring',{value:'release'});g.use('future','sail');},
    tower(){g.use('past','heading',{value:g.view('future').scene.safeHeading});g.use('future','anchor');g.use('past','shutter',{value:'open'});g.use('future','ascend');},
    finish(){g.bridge();g.lift();g.portal();g.canal();g.tower();g.use('past','meet');g.use('future','meet');}
  };
  g.command('past','ready',{value:true});g.command('future','ready',{value:true});
  return g;
}
const rejects=(fn,code)=>assert.throws(fn,e=>e.code===code);

test('new adventure has six destinations and starts away from interactions',()=>{
  const g=adventure();assert.equal(g.view('past').totalChambers,6);assert.equal(g.room.schema,2);
  rejects(()=>g.command('past','water',{value:'grow'}),'WALK');
});
test('walking takes time, stays on ground, and cannot unlock actions early',()=>{
  const g=adventure();g.command('past','move',{x:18,y:75});
  const m=g.room.journey.motion.past;
  assert.ok(positionAt(m,g.now+10).x<18);assert.equal(nearbyStation(1,'past',m,g.now+10),null);
  rejects(()=>g.command('past','water',{value:'grow'},1),'WALK');
  g.wait();g.command('past','water',{value:'grow'});assert.equal(g.room.world.water,'grow');
  for(const [x,y] of [[0,85],[93,85],[20,30],[NaN,85],[20,Infinity]]) rejects(()=>g.command('past','move',{x,y}),'GROUND');
});
test('changing walking destination starts at the interpolated position',()=>{
  const g=adventure();g.command('future','move',{x:32,y:75});g.wait(300);
  const previous=g.room.journey.motion.future,point=positionAt(previous,g.now+1);
  g.command('future','move',{x:26,y:75},1);
  assert.equal(g.room.journey.motion.future.fromX,point.x);
});
test('proximity is to the correct object, and disconnection pauses walking',()=>{
  const g=adventure();rejects(()=>g.walk('future','gate'),'BLOCKED');
  g.bridge();g.walk('future','blueprint');rejects(()=>g.command('future','anchor'),'WALK');
  g.online.delete('p');rejects(()=>g.command('future','move',{x:49,y:85}),'PAUSED');
});
test('checkpoints reset positions and continue beyond the original portal',()=>{
  const g=adventure();g.bridge();assert.equal(g.room.journey.motion.future.x,10);g.lift();g.portal();
  assert.equal(g.room.chamber,4);assert.equal(g.room.status,'playing');assert.equal(g.room.world.anchor,null);
});
test('new clues stay in the future and do not expose hidden player data',()=>{
  const g=adventure();g.bridge();g.lift();g.portal();
  assert.ok(!('safeTide' in g.view('past').scene));assert.ok([1,2,3].includes(g.view('future').scene.safeTide));
  assert.equal(g.view('past').travel.companion,null);g.canal();
  assert.ok(!('safeHeading' in g.view('past').scene));
  for(const role of ['past','future']) for(const forbidden of ['tokenHash','"rng"','safeTide','playerId']) assert.ok(!JSON.stringify(g.view(role)).includes(forbidden));
});
test('a grounded skiff stays grounded when anchored and requires release to recover',()=>{
  const g=adventure();g.bridge();g.lift();g.portal();const safe=g.view('future').scene.safeTide;
  g.use('past','tide',{value:safe%3+1});g.use('future','anchor');g.use('past','tide',{value:safe});
  g.use('past','mooring',{value:'release'});rejects(()=>g.use('future','sail'),'BLOCKED');
  g.use('future','release');g.use('future','anchor');g.use('future','sail');assert.equal(g.room.chamber,5);
});
test('storm beacon must be lit and preserved before opening the sky route',()=>{
  const g=adventure();g.bridge();g.lift();g.portal();g.canal();
  g.use('past','heading',{value:g.view('future').scene.safeHeading});g.use('past','shutter',{value:'open'});
  g.use('future','anchor');rejects(()=>g.use('future','ascend'),'BLOCKED');
  g.use('future','release');g.use('past','shutter',{value:'closed'});g.use('future','anchor');
  g.use('past','shutter',{value:'open'});g.use('future','ascend');assert.equal(g.room.chamber,6);
});
test('both travellers must reach the shared circle before the celebration',()=>{
  const g=adventure();g.bridge();g.lift();g.portal();g.canal();g.tower();
  assert.ok(g.view('past').travel.companion);rejects(()=>g.command('past','meet'),'WALK');
  g.use('past','meet');assert.equal(g.room.status,'playing');
  g.command('past','move',{x:10,y:88});g.wait();g.use('future','meet');assert.equal(g.room.status,'playing');
  g.use('past','meet');assert.equal(g.room.status,'won');
});
test('adventure reset retains the checkpoint; replay resets six destinations and swaps eras',()=>{
  const g=adventure();g.bridge();g.lift();g.portal();g.canal();const heading=g.room.world.safeHeading;
  g.use('past','heading',{value:heading});g.use('future','anchor');
  g.command('past','propose',{kind:'reset'});g.command('future','propose',{kind:'reset'});
  assert.equal(g.room.chamber,5);assert.equal(g.room.world.safeHeading,heading);assert.equal(g.room.world.anchor,null);assert.equal(g.room.journey.motion.past.x,10);
  g.tower();g.use('past','meet');g.use('future','meet');g.command('past','propose',{kind:'replay'});g.command('future','propose',{kind:'replay'});
  assert.equal(g.room.players.past.id,'f');assert.equal(g.room.chamber,1);assert.equal(g.room.status,'lobby');assert.equal(g.room.hints.length,6);assert.equal(g.room.journey.arrivals.past,false);
});
test('six-destination journeys are solvable for 100 deterministic seeds',()=>{
  for(let seed=1;seed<=100;seed++){const g=adventure(seed);g.finish();assert.equal(g.room.status,'won',`seed ${seed}`);assert.equal(g.room.chamber,6);}
});
