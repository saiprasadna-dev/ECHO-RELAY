import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdventureRoom,joinRoom,applyCommand,projectView,makeId} from '../public/core/game.js';
import {stationsFor,nearbyStation} from '../public/core/travel.js';
import {nextMove,guideMarkup} from '../public/journey-guide.js';

function guidedRoom() {
  let now=1_000_000,room=createAdventureRoom('ABC234','Past','p','hp',71,now);
  room=joinRoom(room,'Future','f','hf',now);
  const online=new Set(['p','f']);
  function command(role,type,values={}){now+=250;room=applyCommand(room,room.players[role].id,{id:makeId(),epoch:room.epoch,type,...values},online,now);}
  const game={
    view(role){return projectView(room,room.players[role].id,online,now);},
    walk(role,place){const p=stationsFor(room.chamber,role).find(s=>s.id===place);command(role,'move',{x:p.x,y:p.y});now+=5000;},
    use(role,type,values={}){const p=stationsFor(room.chamber,role).find(s=>s.actions.includes(type));game.walk(role,p.id);command(role,type,values);},
    bridge(){game.use('past','water',{value:'grow'});game.use('future','anchor');game.use('past','water',{value:'drain'});game.use('future','cross');},
    lift(){game.use('past','gear',{value:game.view('future').scene.requiredGear});game.use('future','anchor');game.use('past','power',{value:'lift'});game.use('future','ride');},
    portal(){game.view('future').scene.target.forEach((value,index)=>game.use('past','ring',{value,index}));game.use('future','anchor');game.use('past','beam',{value:'portal'});game.use('past','pulse');game.use('future','pulse');},
    canal(){game.use('past','tide',{value:game.view('future').scene.safeTide});game.use('future','anchor');game.use('past','mooring',{value:'release'});game.use('future','sail');},
    tower(){game.use('past','heading',{value:game.view('future').scene.safeHeading});game.use('future','anchor');game.use('past','shutter',{value:'open'});game.use('future','ascend');}
  };
  command('past','ready',{value:true});command('future','ready',{value:true});return game;
}
test('guide follows each bridge handoff on both screens without guessing partner state',()=>{
  const g=guidedRoom();assert.equal(nextMove(g.view('past'),null).action.value,'grow');
  g.use('past','water',{value:'grow'});
  assert.equal(nextMove(g.view('past'),null).waiting,true);
  assert.equal(nextMove(g.view('future'),null).action.type,'anchor');
  g.use('future','anchor');assert.equal(nextMove(g.view('past'),null).action.value,'drain');
  g.use('past','water',{value:'drain'});
  assert.equal(nextMove(g.view('past'),null).waiting,true);
  assert.equal(nextMove(g.view('future'),null).action.type,'cross');
});
test('guide walks first, exposes an action only after arrival, and removes actions when paused',()=>{
  const g=guidedRoom(),v=g.view('past');
  assert.match(guideMarkup(v,null),/data-action="walk-to"/);
  assert.doesNotMatch(guideMarkup(v,null),/data-action="water"/);
  g.walk('past','wheel');const arrived=g.view('past');
  const near=nearbyStation(1,'past',arrived.travel.motion,arrived.serverNow);
  assert.match(guideMarkup(arrived,near),/data-action="water"/);
  assert.doesNotMatch(guideMarkup({...arrived,paused:true},near),/data-action="(?:water|walk-to|guide-share)"/);
});
test('a wrongly saved object gets recovery advice, not instructions to open the exit',()=>{
  const g=guidedRoom();g.use('future','anchor');g.use('past','water',{value:'grow'});
  assert.equal(nextMove(g.view('future'),null).action.type,'release');
  assert.equal(nextMove(g.view('past'),null).waiting,true);
  g.use('future','release');assert.equal(nextMove(g.view('future'),null).action.type,'anchor');
});
test('clue sharing is available only at its station and never in the Past guide',()=>{
  const g=guidedRoom();g.bridge();
  const future=g.view('future');
  // Check the setup phase even if this seed happens to start with a matching bearing.
  future.guide.phase=0;
  const near=stationsFor(2,'future').find(s=>s.id==='blueprint');
  assert.equal(nextMove(future,null).message,undefined);
  assert.match(nextMove(future,near).message,/The bearing shape is/);
  const past=g.view('past');
  assert.ok(!('requiredGear' in past.scene));
  assert.deepEqual(Object.keys(past.guide).sort(),['phase','recovery']);
  assert.doesNotMatch(guideMarkup(past,null),/The bearing shape is/);
});
test('every guided location and action belongs to that role through all six destinations',()=>{
  const g=guidedRoom();
  const finishers=[()=>g.bridge(),()=>g.lift(),()=>g.portal(),()=>g.canal(),()=>g.tower()];
  for(let ch=1;ch<=6;ch++) {
    for(const role of ['past','future']) {
      const view=g.view(role),stations=stationsFor(ch,role);
      for(const phase of ch===6?[0]:[0,1,2,3]) for(const near of [null,...stations]) {
        const step=nextMove({...view,guide:{phase,recovery:false}},near);
        if(step.place) assert.ok(stations.some(s=>s.id===step.place),`${ch} ${role}: ${step.place}`);
        if(step.action) assert.ok(stations.find(s=>s.id===step.place)?.actions.includes(step.action.type));
      }
    }
    finishers[ch-1]?.();
  }
  g.use('past','meet');assert.equal(nextMove(g.view('past'),null).waiting,true);
  assert.equal(nextMove(g.view('future'),null).action.type,'meet');
});
test('pulse guide waits for the partner after sending, and solo guide offers role switching',()=>{
  const g=guidedRoom();g.bridge();g.lift();
  const v=g.view('past');v.guide.phase=3;v.scene.pulses.past=true;
  assert.equal(nextMove(v,null).waiting,true);
  assert.equal(nextMove(v,null).action,undefined);
  assert.match(guideMarkup(v,null,{practice:true}),/Now play Future/);
  assert.doesNotMatch(guideMarkup(v,null,{enabled:false}),/data-action="(?:walk-to|pulse)"/);
});
