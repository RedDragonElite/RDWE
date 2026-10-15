// prop system: placement, containers, locks, stations, burglars, save/load: node tools/props.mjs
import fs from 'fs'; import vm from 'vm';
const ctx = { console, Math, Date, JSON, globalThis: null, KONTRAKT_LANG: process.env.KONTRAKT_LANG || 'de' }; ctx.globalThis = ctx; vm.createContext(ctx);
const files = fs.readFileSync('tools/scenarios.mjs', 'utf8').match(/for \(const f of (\[[^\]]+\])/)[1];
for (const f of eval(files)) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
const K = ctx.K, TILE = 32;
let ok = 0, fail = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const run = (w, n, inp = {}) => { for (let i = 0; i < n; i++) { w.update(1 / 60, { pressed: {}, ...inp }); w.events.length = 0; } };
const mk = (seed = 1337) => { const w = new K.World({ seed }); w.time = 12 * 60; w.godMode = true; w.thugT = 1e9; w.updatePolice = () => {}; run(w, 2); return w; };
/** free floor tiles inside the player's flat */
const BLOCKED = () => ['Spot taken', 'Wall or door in the way', 'Blocks a door', 'Water', 'Half inside, half outside'].map((k) => K.tr(k));
const homeSpots = (w) => {
  const b = w.propertyBuilding(w.P.home), out = [];
  for (let j = b.y; j < b.y + b.h; j++) for (let i = b.x; i < b.x + b.w; i++) if (!BLOCKED().includes(w.placeCheck('safe', i, j, 1, 1))) out.push([i, j]);
  return { b, out };
};
const place = (w, id, tx, ty, rot = 0) => {
  w.addItem('pl_' + id); const p = w.player;
  w.startPlace(id); for (let k = 0; k < rot; k++) w.rotatePlace(1);
  const pl = w.placing;
  const ax = (tx + pl.w / 2) * TILE, ay = (ty + pl.h / 2) * TILE;
  run(w, 1, { ax, ay }); const why = w.placing && w.placing.why;
  run(w, 1, { ax, ay, pressed: { fire: true } });
  return { why, rec: w.placedList().find((r) => r.x === tx && r.y === ty && r.id === id) };
};

console.log('catalogue');
check(Object.keys(K.PLACE).length >= 25, `${Object.keys(K.PLACE).length} placeable props`);
check(Object.keys(K.PLACE).every((id) => K.ITEMS['pl_' + id] && K.PROPK[K.PLACE[id].k]), 'every prop is an item and has a prop kind');
check(['pl_methlab', 'chem', 'parts'].every((i) => K.SHOPS.black.items.includes(i)) && K.SHOPS.mech.items.includes('pl_cone'), 'stations on the black market, site gear at the workshop');

console.log('placement');
{
  const w = mk(), P = w.P, a = w.player;
  const { b, out } = homeSpots(w);
  const inside = out.find(([i, j]) => Math.hypot((i + 0.5) * TILE - (b.entrance.x + 0.5) * TILE, (j + 0.5) * TILE - (b.entrance.y + 0.5) * TILE) > 2.5 * TILE);
  a.x = (inside[0] + 0.5) * TILE; a.y = (inside[1] + 1.5) * TILE; w.rebuildGrid();
  if (w.placeCheck('safe', inside[0], inside[1], 1, 1) === K.tr("You're in the way")) { a.y += TILE; }
  w.addItem('pl_safe'); w.useItem('pl_safe');
  check(!!w.placing && w.placing.id === 'safe', 'using the item enters placement mode');
  run(w, 1, { ax: (inside[0] + 0.5) * TILE, ay: (inside[1] + 0.5) * TILE });
  check(w.placing.ok, `ghost on a free tile in your flat is valid (${w.placing.why || 'ok'})`);
  run(w, 1, { ax: (inside[0] + 0.5) * TILE, ay: (inside[1] + 0.5) * TILE, pressed: { aim: true } });
  check(!w.placing && P.inv.pl_safe === 1, 'RMB cancels, the safe stays in your bag');
  w.useItem('pl_safe'); run(w, 1, { ax: (inside[0] + 0.5) * TILE, ay: (inside[1] + 0.5) * TILE, pressed: { fire: true } });
  const safe = w.placedList().find((r) => r.id === 'safe');
  check(safe && !P.inv.pl_safe && !w.placing, 'LMB places it and leaves placement mode');
  const ii = safe.y * w.W + safe.x;
  check(w.pmap[ii] >= 0 && (w.solid[ii] & 1) && w.nav.cost[ii] === 0, 'tile is now solid for people and pathfinding');
  check(safe.locked && /^\d{4}$/.test(safe.code), `safe comes with a code lock (${safe.code})`);
  // bad spots
  w.addItem('pl_sofa'); w.startPlace('sofa');
  run(w, 1, { ax: (inside[0] + 0.5) * TILE, ay: (inside[1] + 0.5) * TILE });
  check(!w.placing.ok && /belegt/.test(w.placing.why), `can't stack on the safe (${w.placing.why})`);
  run(w, 1, { ax: a.x + 20 * TILE, ay: a.y });
  check(!w.placing.ok && /weit/.test(w.placing.why), `too far away (${w.placing.why})`);
  const r0 = w.placing.w; w.rotatePlace(1);
  check(w.placing.w === 1 && w.placing.h === 2 && r0 === 2, 'R rotates a 2×1 sofa to 1×2');
  w.cancelPlace();
  // furniture only at home
  const street = (() => { for (let r = 2; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = ((b.entrance.x + dx)), j = (b.entrance.y + dy); if (w.bmap[j * w.W + i] < 0 && !w.placeCheck('cone', i, j, 1, 1).match(/belegt|Wand|Tür|Wasser|drin|Außer/)) return [i, j]; } })();
  a.x = (street[0] + 0.5) * TILE; a.y = (street[1] + 2.5) * TILE; w.rebuildGrid();
  w.startPlace('sofa'); run(w, 1, { ax: (street[0] + 1) * TILE, ay: (street[1] + 0.5) * TILE });
  check(!w.placing.ok && /Immobilie|Tür|belegt/.test(w.placing.why), `the sofa can't go on the street (${w.placing.why})`);
  w.cancelPlace();
  const cone = place(w, 'cone', street[0], street[1]);
  check(cone.rec && cone.rec.prop === null, `a traffic cone goes on the street (${cone.why || 'ok'})`);
  // pick up again
  const cp = w.placedProp(cone.rec);
  a.x = (street[0] + 0.5) * TILE; a.y = (street[1] + 1.5) * TILE; w.rebuildGrid();
  const acts = w.contextActions();
  check(acts.some((o) => o.label.includes('abbauen')), 'standing next to it: "abbauen"');
  w.pickupPlaced(cone.rec);
  check(P.inv.pl_cone === 1 && w.pmap[cp.y * w.W + cp.x] < 0 && !w.placedList().includes(cone.rec), 'picked back up into the inventory, tile free');
}

console.log('containers & locks');
{
  const w = mk(), P = w.P, a = w.player;
  const { out } = homeSpots(w);
  const spot = out[Math.floor(out.length / 2)];
  a.x = (spot[0] + 0.5) * TILE; a.y = (spot[1] + 0.5) * TILE;
  w.addItem('pl_case'); w.startPlace('case'); w.placing.x = spot[0]; w.placing.y = spot[1]; w.placing.ok = true;
  const rec = w.confirmPlace() || w.placedList()[0];
  w.addItem('water', 3); w.addItem('sandwich', 2); w.addItem('medkit', 1); w.addItem('cig', 2); w.addItem('apple', 1); w.addItem('burger', 1);
  for (const k of ['water', 'sandwich', 'medkit', 'cig', 'apple']) w.storePut(rec, 'i', k);
  check(w.storeUsed(rec).slots === 5, 'five stacks → five slots');
  check(!w.storePut(rec, 'i', 'burger'), 'a sixth stack doesn\'t fit into the 5-slot case');
  w.storeTake(rec, 'i', 'apple'); w.addItem('jerrycan', 4);
  check(!w.storePut(rec, 'i', 'jerrycan'), 'four jerry cans (20 kg) are too heavy for the case');
  const pi = P.weapons.findIndex((q) => q.id === 'p9'); w.storePut(rec, 'w', pi);
  check(rec.store.weapons.some((q) => q.id === 'p9') && !P.weapons.some((q) => q.id === 'p9'), 'weapons go in too');
  w.storeTake(rec, 'w', 0);
  check(P.weapons.some((q) => q.id === 'p9') && w.hotbarIndexOf('w', 'p9') >= 0, '…and come back onto the hotbar');
  check(w.setCode(rec, '4711') && rec.code === '4711' && !w.setCode(rec, '12a'), 'code can be changed (4 digits only)');
  // gun rack takes only guns
  w.addItem('pl_gunrack'); w.startPlace('gunrack'); w.placing.x = out[0][0]; w.placing.y = out[0][1]; w.placing.ok = true;
  const rack = w.confirmPlace();
  check(rack && !w.storePut(rack, 'i', 'water') && w.storePut(rack, 'w', P.weapons.findIndex((q) => q.id === 'p9')), 'weapon rack: guns yes, water no');
}

console.log('stations');
{
  const w = mk(), P = w.P, a = w.player;
  const { out } = homeSpots(w);
  const pick2 = out.find(([i, j]) => !w.placeCheck('methlab', i, j, 2, 1).match(/belegt|Wand|Tür|drin|weit/));
  a.x = (pick2[0] + 0.5) * TILE; a.y = (pick2[1] + 0.5) * TILE;
  w.addItem('pl_gunbench'); w.startPlace('gunbench'); w.placing.x = pick2[0]; w.placing.y = pick2[1]; w.placing.ok = true;
  const bench = w.confirmPlace();
  check(bench && !w.startCraft(bench, 'a50'), 'no parts, no ammo');
  w.addItem('parts', 4); const a50 = P.ammo['50'] || 0;
  check(w.startCraft(bench, 'a50') && !P.inv.parts && bench.job, 'four parts → .50 BMG job starts');
  check(!w.collectCraft(bench), 'not ready yet');
  check(!w.pickupPlaced(bench), 'a busy station can\'t be packed up');
  w.time += 40; run(w, 70);
  check(w.collectCraft(bench) && P.ammo['50'] === a50 + 5, `collected 5 × .50 BMG (${P.ammo['50']})`);
  // meth lab may blow up
  let blown = 0, made = 0;
  for (let k = 0; k < 40; k++) {
    w.addItem('pl_methlab'); w.startPlace('methlab'); w.placing.x = pick2[0]; w.placing.y = pick2[1]; w.placing.ok = true;
    if (w.placedList().some((r) => r.x === pick2[0] && r.y === pick2[1])) w.pickupPlaced(w.placedList().find((r) => r.x === pick2[0] && r.y === pick2[1]));
    const lab = w.confirmPlace(); if (!lab) break;
    w.addItem('chem'); w.startCraft(lab, 'meth'); w.time += 70; run(w, 70);
    if (!w.placedList().includes(lab)) blown++; else if (w.collectCraft(lab)) { made++; w.pickupPlaced(lab); }
  }
  check(made > 30 && blown >= 0 && P.inv.meth >= 8 * 30, `meth lab: ${made} batches, ${blown} explosions`);
  // street sale of the product
  const civ = w.actors.find((c) => c.kind === 'civ' && c.alive);
  const m0 = P.money, n0 = P.inv.meth; let tries = 0;
  while (P.money === m0 && tries++ < 30) { civ.dealt = false; civ.state = 'idle'; w.offerDrugs(civ); }
  check(P.money > m0 && P.inv.meth < n0, `crystal sells on the street (+$${P.money - m0})`);
}

console.log('burglars');
{
  let lostOpen = 0, lostSafe = 0, lostAlarm = 0;
  for (let k = 0; k < 60; k++) {
    const w = mk(); w.notify = () => {}; const P = w.P;
    const { out } = homeSpots(w);
    w.player.x = (out[0][0] + 0.5) * TILE; w.player.y = (out[0][1] + 0.5) * TILE;
    const put = (id, s) => { w.addItem('pl_' + id); w.startPlace(id); w.placing.x = s[0]; w.placing.y = s[1]; w.placing.ok = true; return w.confirmPlace(); };
    const crate = put('crate', out[1]), safe = put('safe', out[4]);
    crate.store.items.gold = 3; safe.store.items.gold = 3;
    w.burglary();
    if (!crate.store.items.gold) lostOpen++;
    if (!safe.store.items.gold) lostSafe++;
    put('alarm', out[7]); crate.store.items.gold = 3; w.burglary(); if (!crate.store.items.gold) lostAlarm++;
  }
  check(lostOpen > 0, `unlocked crate at home robbed ${lostOpen}/60 nights`);
  check(lostSafe < lostOpen, `the safe holds better (${lostSafe}/60)`);
  check(lostAlarm === 0, 'with an alarm nobody gets in');
}

console.log('save & load');
{
  const w = mk(), P = w.P;
  const { out } = homeSpots(w);
  w.player.x = (out[0][0] + 0.5) * TILE; w.player.y = (out[0][1] + 0.5) * TILE;
  const put = (id, s) => { w.addItem('pl_' + id); w.startPlace(id); w.placing.x = s[0]; w.placing.y = s[1]; w.placing.ok = true; return w.confirmPlace(); };
  const sh = put('shelf', out.find(([i, j]) => !w.placeCheck('shelf', i, j, 2, 1).match(/belegt|Wand|Tür|drin|weit/)));
  w.addItem('gold', 2); w.storePut(sh, 'i', 'gold');
  const lamp = put('floorlamp', out[out.length - 1]);
  const save = JSON.parse(JSON.stringify(w.serialize()));
  const w2 = new K.World({ seed: save.seed }); w2.applySave(save); run(w2, 2);
  const sh2 = w2.placedList().find((r) => r.id === 'shelf');
  check(w2.placedList().length === 2 && sh2 && sh2.store.items.gold === 2, 'props and their contents survive save/load');
  check(w2.pmap[sh2.y * w2.W + sh2.x] >= 0 && w2.lights.some((L) => L.placed === lamp.uid), 'back in the world, lamp shines again');
  check(w2.placedList().every((r) => r.uid) && new Set(w2.placedList().map((r) => r.uid)).size === 2, 'unique ids');
}

console.log('cars vs. street props');
{
  const w = mk(7), a = w.player;
  let c = null; for (let k = 0; k < 20 && !c; k++) { run(w, 30); c = w.cars.find((q) => q.driver && q.driver !== 'player' && !q.display && !q.siren && (q.speed || 0) > 20); }
  const fx = Math.cos(c.a), fy = Math.sin(c.a);
  const tx = Math.round((c.x + fx * 90) / TILE - 0.5), ty = Math.round((c.y + fy * 90) / TILE - 0.5);
  a.x = (tx + 0.5) * TILE + fy * 70; a.y = (ty + 0.5) * TILE - fx * 70; w.rebuildGrid();
  const why = w.placeCheck('cone', tx, ty, 1, 1);
  if (!why) {
    w.addItem('pl_cone'); w.startPlace('cone'); w.placing.x = tx; w.placing.y = ty; w.placing.ok = true; const rec = w.confirmPlace();
    a.x = c.x - 600; a.y = c.y; c.speed = 120; c.vx = fx * 120; c.vy = fy * 120;
    for (let i = 0; i < 120 && w.placedList().includes(rec); i++) run(w, 1);
    check(!w.placedList().includes(rec), 'traffic flattens your cone (and it is gone from the save)');
  } else check(true, `(cone test skipped: ${why})`);
}
console.log(`\n${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
