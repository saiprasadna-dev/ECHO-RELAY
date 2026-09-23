/* Original, lightweight vector scenery. No stock assets, font downloads or paid art APIs. */
const stars = Array.from({ length: 37 }, (_, i) => [80 + (i * 173) % 1040, 36 + (i * 89) % 315, 0.8 + (i % 3) * 0.6]);
const foliage = [[-106,-209,73,46],[-40,-257,85,55],[44,-245,79,48],[108,-203,75,47],[-153,-173,55,36],[145,-162,54,35],[-73,-164,72,46],[39,-176,96,57],[1,-306,52,31]];
function person(x, y, scale = 1, future = false, id = "s") {
  return `<g transform="translate(${x} ${y}) scale(${scale})" class="traveller">
    <ellipse cx="0" cy="6" rx="29" ry="7" fill="#050d12" opacity=".5"/>
    <path d="M-9-58-16-17-11 0-4 0 0-20 6 0 13 0 15-22 7-58Z" fill="#172b31" stroke="#6f938a" stroke-width="1.3"/>
    <path d="M-9-63Q0-78 10-63L14-38-17-36Z" fill="${future ? '#73978c' : '#a67e53'}"/>
    <ellipse cx="1" cy="-66" rx="9" ry="11" fill="#22373b"/>
    <path d="M12-49 25-29 31-31 22-54" fill="#2c4345"/>
    <path d="M31-31v13" stroke="#c6ae79" stroke-width="2"/>
    <rect x="25" y="-18" width="13" height="16" rx="4" fill="${future ? '#9cdfc8' : '#f1c77d'}" filter="url(#${id}-glow)"/>
    <path d="M26-18h12v15H26Z" fill="none" stroke="#d4bd85" stroke-width="2"/>
  </g>`;
}
function tree(x, y, scale, future, id, bloom = false) {
  return `<g transform="translate(${x} ${y}) scale(${scale})" class="time-tree">
    ${foliage.map(([a,b,c,d], i) => `<ellipse cx="${a}" cy="${b}" rx="${c}" ry="${d}" fill="${bloom ? ['#6d9a86','#90b194','#d8c997'][i%3] : future ? ['#294d49','#365e52','#547363'][i%3] : ['#778951','#abb171','#c1b775'][i%3]}" opacity=".94"/>`).join('')}
    <path d="M-40 8Q-16-57-21-126L-49-186-104-215M-21-127Q20-187 3-249M-16-84Q33-136 83-173L104-216M-24-134-77-151-135-170M-18-54Q7-21 37 9" fill="none" stroke="#343b2f" stroke-width="23" stroke-linecap="round"/>
    <path d="M-27 6Q-3-74-22-139L-48-183M-18-119Q22-175 8-233M-14-88Q26-132 81-173" fill="none" stroke="#8a8060" stroke-width="7" stroke-linecap="round"/>
    <path d="M-23 5Q-85-3-105 24M-8 3Q27 5 54 25" fill="none" stroke="#77765b" stroke-width="14" stroke-linecap="round"/>
    ${bloom ? Array.from({length:18},(_,i)=>`<circle class="bloom" cx="${-132+(i*61)%264}" cy="${-280+(i*47)%120}" r="${4+i%4}" fill="${i%2?'#f5d9aa':'#c6d8bb'}"/>`).join('') : ''}
  </g>`;
}
function gear(x,y,r,id,active) {
  const teeth = Array.from({length:14},(_,i)=>`<rect x="-7" y="${-r-8}" width="14" height="19" rx="2" transform="rotate(${i*360/14})" fill="#887858"/>`).join('');
  return `<g transform="translate(${x} ${y})"><g class="${active?'turning-gear':''}">${teeth}<circle r="${r}" fill="#233a3c" stroke="#a29471" stroke-width="9"/><circle r="${r*.64}" fill="none" stroke="#53685c" stroke-width="3"/>${Array.from({length:6},(_,i)=>`<path d="M0-11V-${r-4}" stroke="#a49673" stroke-width="8" transform="rotate(${i*60})"/>`).join('')}<circle r="14" fill="#abc2a9" stroke="#5c6f63" stroke-width="4"/></g></g>`;
}
function anchor(x,y,rx,ry,id) {
  return `<g class="anchor-aura"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="none" stroke="#b9f4cf" stroke-width="2" filter="url(#${id}-glow)"/><ellipse cx="${x}" cy="${y}" rx="${rx+9}" ry="${ry+6}" fill="none" stroke="#8ac5af" stroke-width=".8" stroke-dasharray="4 14"/><path d="M${x-8} ${y-ry}h16m-8-8v16" stroke="#e2ffdd" stroke-width="2"/></g>`;
}
export function scene(view = null, kind = 'game') {
  const hero = kind === 'hero', won = kind === 'ending';
  const future = hero || won || view?.role === 'future';
  const chamber = won || hero ? 1 : (view?.chamber || 1);
  const s = view?.scene || {}, anchored = Boolean(view?.anchor), id = hero ? 'hero' : won ? 'ending' : 'world';
  const gold = future ? '#4a7f79' : '#caa46c';
  let objects = '';
  if (chamber === 1) {
    const grown = hero || won || (future && s.bridge === 'grown');
    const wet = future ? s.flooded : s.water === 'grow';
    objects = `
      <path d="M350 532 737 520 831 718 234 718Z" fill="#0b2027"/>
      <path d="M342 535 351 587 336 639 323 718M743 526 750 568 779 623 799 718" fill="none" stroke="#3c5148" stroke-width="17"/>
      <g class="water-surface ${wet?'high-water':'low-water'}">
        <path d="M305 592Q489 564 735 574L799 718H228Z" fill="url(#${id}-water)"/>
        ${[0,1,2,3].map(i=>`<path class="water-line" d="M${330-i*11} ${611+i*23}q90-16 173-1t${210+i*15} 0" fill="none" stroke="#78adad" stroke-width="1.3" opacity="${.48-i*.07}"/>`).join('')}
      </g>
      <g transform="translate(197 422)">
        <path d="M-26 14-34 121H34L25 11Z" fill="#34423b" stroke="#8f8c6b" stroke-width="2"/>
        <circle r="52" fill="#1c3030" stroke="#ad986f" stroke-width="8"/>
        ${Array.from({length:8},(_,i)=>`<path d="M0-10V-46" stroke="#ac966b" stroke-width="5" transform="rotate(${i*45})"/>`).join('')}
        <circle r="12" fill="#d8c294"/>
        <path d="M0 0 35 ${s.water==='grow'?'-36':'36'}" stroke="#d9b77e" stroke-width="7" stroke-linecap="round"/>
        <path d="M-49 125h98l17 14h-132Z" fill="#78816a"/>
      </g>
      <path d="M101 528h199v14H101Z" fill="#747a60"/>
      <path d="M111 516h25v-174h-25M254 521h22V337h-22" fill="#4d5c4b" stroke="#939272" stroke-width="1"/>
      <path d="M103 345h181v-14H103Z" fill="#949174"/>
      ${grown?`<g class="root-bridge"><path d="M770 544Q600 497 332 571" fill="none" stroke="#344537" stroke-width="36"/><path d="M777 548Q603 512 332 571" fill="none" stroke="#999577" stroke-width="13"/><path d="M767 572Q591 538 347 602" fill="none" stroke="#6e8064" stroke-width="16"/><path d="M419 548l5 57m78-73 8 55m81-61 6 58m80-52 6 62" stroke="#526a4e" stroke-width="7"/></g>`:''}
      ${tree(790,548,grown?1:.38,future,id,won)}
      <g transform="translate(969 359)"><path d="M-62 167V11Q0-71 62 11v156Z" fill="${wet?'#24555c':'#102b31'}" stroke="#788979" stroke-width="10"/><path d="M-45 167V14Q0-43 45 14v153" fill="none" stroke="#adbc96" stroke-width="2" opacity=".5"/><path d="M-57 166H63L96 186H-85Z" fill="#536d5d"/>${!wet&&grown?`<ellipse cx="0" cy="95" rx="32" ry="64" fill="#c4d7a4" opacity=".12" filter="url(#${id}-soft)"/>`:''}</g>
      ${(anchored||hero)?anchor(573,555,217,48,id):''}
      ${person(256,579,1.18,future,id)}
      ${hero||won?person(894,574,1.15,false,id):''}
      ${hero?`<path d="M595 92V510" stroke="#e3d4a6" opacity=".12" stroke-dasharray="2 14"/><path d="M575 91h40m-20-20v40" stroke="#d5d8ab" stroke-width="1.5" opacity=".7"/>`:''}
    `;
  } else if (chamber === 2) {
    const working = future ? s.drive === 'working' : s.power === 'workshop';
    objects = `
      <path d="M140 570V212H657v362Z" fill="#20383a" stroke="#63796a" stroke-width="8"/>
      <path d="M168 233h461v307H168Z" fill="#13292f" stroke="#877b59" stroke-width="2"/>
      <path d="M173 246h446v42H173Z" fill="#3e5348"/>
      <path d="M282 243v-89h44v89M483 243v-113h35v113" fill="none" stroke="#8c8060" stroke-width="12"/>
      ${gear(316,398,80,id,working)}${gear(487,365,59,id,working)}${gear(487,488,42,id,working)}
      <circle cx="600" cy="308" r="10" fill="${working?'#b4d5a6':'#c38767'}" filter="url(#${id}-glow)"/>
      <rect x="272" y="517" width="123" height="36" rx="5" fill="#405249" stroke="#b1a579"/>
      <text x="334" y="543" text-anchor="middle" font-size="24" fill="#d8d6ad">${future?'◈':({circle:'●',triangle:'▲',diamond:'◆'}[s.gear]||'●')}</text>
      <path d="M743 160h307M761 163v432m270-432v432" stroke="#8fa287" stroke-width="9"/>
      <path d="M780 166v307m232-307v307" stroke="#50716c" stroke-width="3"/>
      <path d="M772 480h247v97H772Z" fill="#29474a" stroke="#a7b18d" stroke-width="7"/>
      <path d="M787 478v-95h218v95M798 393v82m48-82v82m49-82v82m48-82v82m49-82v82" fill="none" stroke="#93a785" stroke-width="4"/>
      <path d="M772 564h247" stroke="${s.liftPowered||s.power==='lift'?'#c6e0ae':'#557870'}" stroke-width="7"/>
      <circle cx="897" cy="163" r="30" fill="#1b3638" stroke="#aaae87" stroke-width="7"/>
      <path d="M670 545h62v-45h38" fill="none" stroke="${working?'#b9dcb0':'#576c5a'}" stroke-width="7"/>
      ${future?`<g transform="translate(568 187) rotate(6)"><rect x="-52" y="-39" width="104" height="84" rx="5" fill="#bec7a5"/><path d="M-39-24h76M-39 28h76" stroke="#5e796b"/><text x="0" y="16" text-anchor="middle" font-size="35" fill="#2d514f">${{circle:'●',triangle:'▲',diamond:'◆'}[s.requiredGear]||'◈'}</text></g>`:''}
      ${anchored?anchor(399,421,157,150,id):''}
      ${person(703,602,1.3,future,id)}
    `;
  } else {
    const charged = future ? s.lens === 'charged' : s.beamPower === 'lens';
    const symbols = future ? s.target : s.rings;
    objects = `
      <path d="M438 578V259Q615 43 797 259v319Z" fill="#10252e" stroke="#96a38a" stroke-width="12"/>
      <path d="M465 576V260Q615 84 770 260v316Z" fill="url(#${id}-portal)" stroke="#4d7a71" stroke-width="3"/>
      <ellipse cx="616" cy="403" rx="126" ry="161" fill="none" stroke="#aad2b4" stroke-width="1" opacity=".5"/>
      ${s.canPulse?`<g class="portal-awake"><ellipse cx="616" cy="401" rx="103" ry="156" fill="#a7dfc6" opacity=".18" filter="url(#${id}-soft)"/><path d="M616 239V553" stroke="#d0eed0" stroke-width="3" filter="url(#${id}-glow)"/></g>`:''}
      <g transform="translate(233 421)"><path d="M-49 30-60 173H63L42 30Z" fill="#3d574c" stroke="#8c9a7a" stroke-width="3"/><circle r="76" fill="#183139" stroke="#9f9f76" stroke-width="8"/><circle r="54" fill="#24494b" stroke="#819f7e" stroke-width="2"/><circle r="35" fill="${charged?'#c1e3b5':'#456a62'}" opacity=".85" filter="url(#${id}-glow)"/><path d="M-72 0H72M0-72V72" stroke="#99b790" stroke-width="2"/></g>
      ${charged?`<path d="M273 394 494 271 490 341 274 449Z" fill="#adcba4" opacity=".11"/>`:''}
      <g transform="translate(962 416)"><path d="M-104 46-118 158h236L105 46Z" fill="#314d48" stroke="#718c70" stroke-width="3"/>
      ${[0,1,2].map(i=>`<g transform="translate(${(i-1)*72} 0)"><circle r="36" fill="#19363b" stroke="#9eaa7b" stroke-width="5"/><circle r="27" fill="none" stroke="#588378" stroke-dasharray="2 8"/><text x="0" y="10" text-anchor="middle" font-size="31" fill="#d6d7a6">${{sun:'☀',moon:'☾',star:'✦',wave:'≈'}[symbols?.[i]]||'✧'}</text></g>`).join('')}
      <path d="M-111 161h222" stroke="#a6b28a" stroke-width="7"/></g>
      ${future?`<path d="m879 239 42-46 61 31 58-65" fill="none" stroke="#d1e3bb" stroke-width="1.5"/><g fill="#e0e9c0">${[[879,239],[921,193],[982,224],[1040,159]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="5" filter="url(#${id}-glow)"/>`).join('')}</g>`:''}
      ${anchored?anchor(233,421,95,95,id):''}
      ${person(442,624,1.25,future,id)}
    `;
  }
  const label = hero ? 'A glass conservatory split between golden sunlight and a mysterious blue future, connected by roots and a time anchor.' : won ? 'The restored conservatory. Two travellers finally stand in the same world.' : `${view?.title || 'Conservatory'} in the ${future?'future':'past'}. Use the labelled controls alongside the scene.`;
  return `<svg class="scene-svg ${future?'future-scene':'past-scene'} ${hero?'hero-scene':''}" viewBox="0 0 1200 730" role="img" aria-label="${label}">
    <defs>
      <linearGradient id="${id}-sky" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${hero?'#73594a':future?'#152c38':'#7a785e'}"/><stop offset=".55" stop-color="${future?'#203b43':'#b4a174'}"/><stop offset="1" stop-color="#102d32"/></linearGradient>
      <linearGradient id="${id}-floor" x2="0" y2="1"><stop stop-color="${future?'#29464a':'#666b51'}"/><stop offset="1" stop-color="#0b2027"/></linearGradient>
      <linearGradient id="${id}-water" x2="0" y2="1"><stop stop-color="#427a80" stop-opacity=".9"/><stop offset="1" stop-color="#102d3a"/></linearGradient>
      <radialGradient id="${id}-portal"><stop stop-color="${s.canPulse?'#aacdb2':'#305761'}" stop-opacity=".8"/><stop offset="1" stop-color="#0e232c"/></radialGradient>
      <linearGradient id="${id}-ray"><stop stop-color="${future?'#aed6c7':'#ffe5aa'}" stop-opacity=".17"/><stop offset="1" stop-color="#c8e0bb" stop-opacity="0"/></linearGradient>
      <filter id="${id}-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="${id}-soft" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="24"/></filter>
    </defs>
    <rect width="1200" height="730" fill="url(#${id}-sky)"/>
    <circle cx="${future?932:274}" cy="${future?124:169}" r="${future?47:69}" fill="${future?'#dce7c7':'#eed9a4'}" opacity=".65" filter="url(#${id}-soft)"/>
    <circle cx="${future?932:274}" cy="${future?124:169}" r="${future?27:45}" fill="${future?'#dce7c7':'#f5dba3'}" opacity=".73"/>
    ${future?`<g fill="#c8daca">${stars.map(([x,y,r],i)=>`<circle class="star star-${i%3}" cx="${x}" cy="${y}" r="${r}" opacity=".6"/>`).join('')}</g>`:''}
    <path d="M0 385 139 254 244 349 388 238 570 359 703 218 867 315 1009 244 1200 337V580H0Z" fill="#234348" opacity=".7"/>
    <path d="M0 420 156 355 312 415 472 326 632 408 803 321 959 365 1200 324V589H0Z" fill="#19383d" opacity=".74"/>
    <path d="M0 526V202L166 47 349 110 600 29 855 112 1047 45 1200 181V527" fill="#406052" fill-opacity=".1" stroke="#9fa889" stroke-opacity=".42" stroke-width="9"/>
    <path d="M112 552V231Q115 91 257 94Q402 96 402 231v321M405 552V230Q408 67 601 65Q792 67 795 230v322M798 551V231Q800 91 946 94Q1089 96 1092 231v321" fill="none" stroke="${gold}" stroke-opacity=".6" stroke-width="11"/>
    <path d="M110 232h291m5 0h387m6 0h294M258 97v446M601 67v477M946 95v450M132 164l249 141m55-126 329 127m58-146 246 146" stroke="#bdc1a0" stroke-opacity=".24" stroke-width="3"/>
    <path d="M89 100 332 87 735 623 253 649Z" fill="url(#${id}-ray)"/>
    <path d="M871 102 1000 129 646 575 366 664Z" fill="url(#${id}-ray)" opacity=".45"/>
    ${future?`<path d="m110 232 99-4 38 40-29 43 49 18m499-109-20 72 39 14m160-210-13 71 55 23-20 67" fill="none" stroke="#abc4ad" opacity=".35" stroke-width="2"/>`:''}
    <path d="M0 533Q605 499 1200 531V730H0Z" fill="url(#${id}-floor)"/>
    <path d="M0 578H1200M0 647H1200M113 533 22 730m231-201-42 201m365-210 31 210m302-202 85 202" stroke="#8a9a7d" stroke-width="1" opacity=".18"/>
    <path d="M0 543Q66 402 13 176M36 501Q116 380 66 162M1179 538Q1101 390 1194 122" fill="none" stroke="#244238" stroke-width="22"/>
    ${[0,1,2,3,4].map(i=>`<ellipse cx="${40+i%2*26}" cy="${222+i*51}" rx="52" ry="19" transform="rotate(-32 ${40+i%2*26} ${222+i*51})" fill="${future?'#24483e':'#697f51'}"/><ellipse cx="${1174-i%2*21}" cy="${226+i*51}" rx="51" ry="17" transform="rotate(25 ${1174-i%2*21} ${226+i*51})" fill="#254b43"/>`).join('')}
    ${objects}
    <ellipse cx="577" cy="698" rx="640" ry="48" fill="#123039" opacity=".33" filter="url(#${id}-soft)"/>
    <g class="fireflies" fill="${future?'#c0dfb1':'#ffe4a0'}">${Array.from({length:14},(_,i)=>`<circle cx="${146+i*71}" cy="${371+(i*47)%234}" r="${1.3+i%2}" opacity=".5"/>`).join('')}</g>
    <path d="M0 730v-67q105-54 158-10t168 52m874 25v-76q-102-64-190-22t-131 68" fill="#0a1c24"/>
  </svg>`;
}
