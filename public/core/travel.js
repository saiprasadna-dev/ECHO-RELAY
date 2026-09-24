/** Shared walkable ground and interaction locations. Coordinates are percentages of the scene. */
export const DESTINATIONS = ['The Root Bridge', 'The Clockwork Lift', 'The Last Light', 'The Moonlit Canal', 'The Storm Tower', 'The Reunion Garden'];
export const WALK_SPEED = 29;
export const REACH = 7;
export const HEADINGS = ['north', 'east', 'west'];
const spot = (id, label, x, actions = [], description = '') => ({ id, label, x, y: 85, actions, description });
const STATIONS = [
  {
    past: [spot('wheel','Water wheel',18,['water'],'Send water to the young tree.'), spot('gate','Garden gate',30,[],'Your partner opens the crossing in the future.')],
    future: [spot('roots','Ancient roots',26,['anchor','release'],'Preserve the roots when they form a bridge.'), spot('gate','Garden gate',81,['cross'],'Cross once the bridge is preserved and the exit is dry.')]
  },
  {
    past: [spot('bearing','Bearing bench',30,['gear'],'Fit the shape from your partner’s blueprint.'), spot('power','Power switch',65,['power'],'Choose which machine receives power.')],
    future: [spot('blueprint','Old blueprint',23,[],'Read the surviving bearing shape.'), spot('drive','Drive assembly',49,['anchor','release'],'Preserve the working mechanism.'), spot('lift','Clockwork lift',82,['ride'],'Ride to the roof together.')]
  },
  {
    past: [spot('rings','Star rings',23,['ring'],'Match the three symbols your partner sees.'), spot('beam','Light switch',56,['beam'],'Route the light to the lens or portal.'), spot('portal','Time portal',83,['pulse'],'Send a pulse to open the road beyond.')],
    future: [spot('stars','Star chart',22,[],'Share the constellation from left to right.'), spot('lens','Focusing lens',51,['anchor','release'],'Preserve the charged lens.'), spot('portal','Time portal',83,['pulse'],'Send a pulse with your partner.')]
  },
  {
    past: [spot('sluice','Sluice wheel',26,['tide'],'Set the water to your partner’s safe tide mark.'), spot('mooring','Mooring winch',67,['mooring'],'Release the boat after your partner preserves it.')],
    future: [spot('chart','Tide chart',23,[],'Find the one safe water level.'), spot('boat','Waiting skiff',51,['anchor','release'],'Preserve the floating boat.'), spot('jetty','Departure jetty',83,['sail'],'Sail towards the storm tower.')]
  },
  {
    past: [spot('compass','Beacon compass',26,['heading'],'Point the beacon in the direction your partner sees.'), spot('shutter','Wind shutters',66,['shutter'],'Shelter the beacon, then open the sky route.')],
    future: [spot('map','Weather map',23,[],'Find the direction of the calm sky.'), spot('beacon','Storm beacon',51,['anchor','release'],'Preserve the beacon while it shines.'), spot('skybridge','Sky bridge',83,['ascend'],'Follow the light to the restored garden.')]
  },
  {
    past: [spot('meeting','Meet your partner',50,['meet'],'Walk into the circle. Your journeys end together.')],
    future: [spot('meeting','Meet your partner',50,['meet'],'Walk into the circle. Your journeys end together.')]
  }
];
export function stationsFor(chamber, role) {
  const stations=STATIONS[chamber - 1]?.[role] || [];
  return chamber===1 ? stations.map(s=>({...s,y:75})) : stations;
}
export function initialTravel(chamber = 1, now = 0) {
  return Object.fromEntries(['past','future'].map(role => {
    const x = chamber === 6 && role === 'future' ? 90 : 10;
    const y=chamber===1?78:88;
    return [role, { x, y, fromX: x, fromY: y, startedAt: now, arrivesAt: now }];
  }));
}
export function positionAt(motion, now) {
  const fraction = motion.arrivesAt <= motion.startedAt ? 1 : Math.max(0, Math.min(1, (now - motion.startedAt) / (motion.arrivesAt - motion.startedAt)));
  return { x: motion.fromX + (motion.x - motion.fromX) * fraction, y: motion.fromY + (motion.y - motion.fromY) * fraction };
}
export function nearbyStation(chamber, role, motion, now) {
  if (!motion || now < motion.arrivesAt) return null;
  const point = positionAt(motion, now);
  return stationsFor(chamber, role).find(s => Math.hypot(point.x - s.x, point.y - s.y) <= REACH) || null;
}
