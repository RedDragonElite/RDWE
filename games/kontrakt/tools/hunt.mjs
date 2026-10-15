// police manhunt: witness calls, radio, search, hiding, helicopter, roadblocks, PIT: node tools/hunt.mjs
import fs from 'fs'; import vm from 'vm';
const ctx = { console, Math, Date, JSON, globalThis: null }; ctx.globalThis = ctx; vm.createContext(ctx);
const files = fs.readFileSync('tools/scenarios.mjs', 'utf8').match(/for \(const f of (\[[^\]]+\])/)[1];
for (const f of eval(files)) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
const K = ctx.K, TILE = 32;
let ok = 0, fail = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const run = (w, n, inp = {}) => { for (let i = 0; i < n; i++) { w.update(1 / 60, { pressed: {}, ...inp }); w.events.length = 0; } };
const mk = (seed = 21) => { const w = new K.World({ seed }); w.godMode = true; w.time = 12 * 60; w.thugT = 1e9; run(w, 60 * 3); return w; };
const roadSpot = (w, near) => { for (let r = 0; r < 40; r++) for (let k = 0; k < 40; k++) { const tx = ((near.x / TILE) | 0) + U.rint(2 * r + 1) - r, ty = ((near.y / TILE) | 0) + U.rint(2 * r + 1) - r; if (tx > 2 && ty > 2 && tx < w.W - 2 && ty < w.city.W - 2 && w.tiles[ty * w.W + tx] === K.T.ROAD) return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE }; } return null; };
const U = K.U;

console.log('witness calls (rde_aipd)');
{
  const w = mk(); w.updatePolice = () => {};
  const civ = w.actors.find((a) => a.kind === 'civ' && a.alive && !a.inCar && w.bldAt(a.x, a.y) < 0);
  const p = w.player; p.x = civ.x - 8 * TILE; p.y = civ.y; w.rebuildGrid();
  civ.state = 'idle'; w.startCall(civ, 'shots', civ.x, civ.y);
  check(civ.call && civ.call.dur >= 5 && civ.call.dur <= 9 && civ.call.dial > 0.8, `a witness phones the police (call ${civ.call.dur.toFixed(1)} s, phone out after ${civ.call.dial.toFixed(1)} s)`);
  const t0 = civ.call.t0, dur = civ.call.dur;
  for (let i = 0; i < 60 * 9 && civ.reportT > 0; i++) { if (w.t - t0 > civ.call.dial + 0.3) { p.x = civ.x - 50; p.y = civ.y; } run(w, 1); }
  check(civ.reportT <= 0 && !civ.call && w.wanted === 0 && w.t - t0 < dur, `walk up once the phone is out → they hang up (${(w.t - t0).toFixed(1)} s of ${dur.toFixed(1)} s)`);
  const w2 = mk(); w2.updatePolice = () => {};
  const c2 = w2.actors.find((a) => a.kind === 'civ' && a.alive && !a.inCar && w2.bldAt(a.x, a.y) < 0);
  const p2 = w2.player; p2.x = c2.x - 20 * TILE; p2.y = c2.y; w2.rebuildGrid();
  c2.state = 'idle'; c2.brain.t = 30;   // a wandering caller could stroll right up to you
  const sx = c2.x, sy = c2.y; w2.startCall(c2, 'shots', sx, sy);
  let n = 0; while (w2.wanted < 1 && n++ < 60 * 10) run(w2, 1);
  check(w2.wanted >= 1, `left alone the call goes through → stars (${w2.wanted})`);
  check(Math.hypot(w2.heat.x - sx, w2.heat.y - sy) < 2 * TILE, 'police get the crime scene, not where you are now');
  let calls = 0; for (let k = 0; k < 200; k++) if (w2.wouldCall(c2, 'assault', p2.x + 9999, p2.y)) calls++;
  check(calls > 40 && calls < 160, `not every witness calls (${calls}/200)`);
}

console.log('search & radio');
{
  const w = mk(), p = w.player;
  w.updatePolice = () => {};
  w.wanted = 2; w.heat.x = p.x; w.heat.y = p.y; w.heat.seenT = 0; w.heat.vx = 100; w.heat.vy = 0;
  const cops = [0, 1, 2].map((k) => { const c = w.spawnCop(p.x + 40 + k * 20, p.y + 30, 'search'); c.brain.sx = p.x; c.brain.sy = p.y; return c; });
  p.x += 200 * TILE > (w.W - 3) * TILE ? -40 * TILE : 40 * TILE; p.hidden = true;
  run(w, 60 * 5);
  const S = w.heat.search;
  check(S && S.x > w.heat.x + 50, `search area opens at the predicted spot (lead ${S ? Math.round(S.x - w.heat.x) : '-'} px)`);
  run(w, 60 * 20);
  check(S.r > 10 * TILE, `…and grows (${(S.r / TILE).toFixed(1)} tiles)`);
  check(S.cells.size >= 4, `officers tick off ground (${S.cells.size} cells searched)`);
  const spots = cops.map((c) => S.claims.get(c.id)).filter(Boolean);
  const spread = spots.length >= 2 ? Math.min(...spots.map((a, i) => Math.min(...spots.filter((_, j) => j !== i).map((b) => Math.hypot(a.x - b.x, a.y - b.y))))) : 0;
  check(spots.length >= 2 && spread > 2 * TILE, `they split up (${(spread / TILE).toFixed(1)} tiles apart)`);
  check(cops.every((c) => c.state === 'search'), 'still searching while the stars last');
}

console.log('stars fade only unseen (15 s + 20 s per star)');
{
  const w = mk(), p = w.player; w.updatePolice = () => {};
  w.wanted = 2; w.heat.seenT = 0; p.hidden = true;
  run(w, 60 * 14);
  check(w.wanted === 2, '14 s unseen: still 2 stars');
  run(w, 60 * 22);
  check(w.wanted === 1, `after 15 + 20 s one star drops (${w.wanted})`);
  run(w, 60 * 21);
  check(w.wanted === 0, `next 20 s: clean (${w.wanted})`);
}

console.log('hiding in containers');
{
  const w = mk(), p = w.player;
  const box = w.props.find((q) => q && (q.k === 'dumpster' || q.k === 'wardrobe' || q.k === 'locker') && q.bld < 0) || w.props.find((q) => q && q.k === 'dumpster');
  p.x = (box.x + box.w / 2) * TILE; p.y = (box.y + box.h + 0.6) * TILE; w.rebuildGrid();
  const acts = w.contextActions();
  check(acts.some((o) => o.label.startsWith('Verstecken')), 'prompt: Verstecken');
  w.hideIn(box);
  check(p.hidden && p.hiddenIn === box.id, 'inside the container');
  const cop = w.spawnCop(p.x + 60, p.y, 'patrol'); cop.angle = Math.PI; w.rebuildGrid(); w.perceive(cop, 0.2);
  check(!cop.seesPlayer, 'a cop looking right at it sees nothing');
  run(w, 2, { pressed: { e: true } });
  check(!p.hidden, '[E] → out again');
  // searchers check hiding spots
  let found = 0;
  for (let k = 0; k < 20; k++) {
    w.hideIn(box); const c = w.spawnCop((box.x + 0.5) * TILE, (box.y + box.h + 1) * TILE, 'search'); c.brain.checked = null;
    w.wanted = 1; w.checkHideSpots(c); if (!p.hidden) found++; else w.unhide(); w.removeActor(c);
  }
  check(found > 4 && found < 18, `searchers standing next to it look inside (${found}/20)`);
}

console.log('helicopter');
{
  const w = mk(), p = w.player; w.time = 23 * 60; w.updatePolice = () => {};
  const out = roadSpot(w, p); p.x = out.x; p.y = out.y; w.rebuildGrid();
  w.wanted = 3; w.heat.x = p.x; w.heat.y = p.y; w.heat.seenT = 0;
  run(w, 60 * 2);
  check(!!w.heli, 'three stars: a helicopter takes off');
  for (let i = 0; i < 60 * 12; i++) { w.heat.x = p.x; w.heat.y = p.y; w.heat.seenT = 0; run(w, 1); }
  check(Math.hypot(w.heli.sx - p.x, w.heli.sy - p.y) < 4 * TILE && w.heli.sees, 'its spotlight finds you in the open');
  const b = w.buildings.find((q) => q.rooms && q.rooms.length);
  const r = b.rooms[0]; p.x = (r.x + r.w / 2) * TILE; p.y = (r.y + r.h / 2) * TILE; w.heli.sx = p.x; w.heli.sy = p.y; run(w, 2);
  check(!w.heli.sees, '…but not under a roof');
  w.wanted = 0; run(w, 60 * 30);
  check(!w.heli, 'stars gone: it flies home');
}

console.log('pursuit: roadblock, spikes, PIT');
{
  const w = mk(7), p = w.player;
  let car = null; for (let k = 0; k < 20 && !car; k++) { run(w, 30); car = w.cars.find((q) => q.driver && q.driver !== 'player' && !q.display && !q.siren && !q.unit && (q.speed || 0) > 40); }
  p.x = car.x; p.y = car.y + 30; w.enterCar(car); car.belt = true;
  w.wanted = 4; w.heat.seenT = 0;
  car.vx = Math.cos(car.a) * 260; car.vy = Math.sin(car.a) * 260; car.speed = 260;
  w.rbT = 0; for (let k = 0; k < 4 && !(w.roadblocks || []).length; k++) { w.spawnRoadblock(car); car.a += Math.PI / 2; car.vx = Math.cos(car.a) * 260; car.vy = Math.sin(car.a) * 260; }
  check((w.roadblocks || []).length === 1 && w.roadblocks[0].cars.length >= 1, `roadblock ahead (${w.roadblocks && w.roadblocks[0] ? w.roadblocks[0].cars.length : 0} cars)`);
  check((w.spikes || []).length === 1, 'four stars: a spike strip in front of it');
  const s = w.spikes[0]; car.x = s.x - Math.cos(car.a) * 20; car.y = s.y - Math.sin(car.a) * 20; car.vx = Math.cos(car.a) * 200; car.vy = Math.sin(car.a) * 200; car.speed = 200;
  car.a = s.a - Math.PI / 2; car.vx = Math.cos(car.a) * 200; car.vy = Math.sin(car.a) * 200; car.x = s.x - Math.cos(car.a) * 40; car.y = s.y - Math.sin(car.a) * 40;
  w.initCarState(car); car.tires = [100, 100, 100, 100];
  for (let i = 0; i < 30; i++) w.updateRoadblocks(1 / 60), car.x += car.vx / 60, car.y += car.vy / 60;
  check(car.tires.some((t) => t === 0), `driving over it bursts tyres (${car.tires.join('/')})`);
  const a0 = car.a; car.yawKick = 3.2; car.yawT = 0.55; for (let i = 0; i < 30; i++) w.applyYawKick(car, 1 / 60);
  check(Math.abs(U.angDiff(car.a, a0)) > 0.8, `a PIT kicks the tail out (${Math.abs(U.angDiff(car.a, a0)).toFixed(2)} rad)`);
}
console.log('self-defence');
{
  const w = mk(); w.updatePolice = () => {}; w.forceCalls = true;
  const p = w.player; w.godMode = true;
  const civ = w.actors.find((a) => a.kind === 'civ' && a.alive && !a.inCar && w.bldAt(a.x, a.y) < 0);
  p.x = civ.x + 40; p.y = civ.y; w.rebuildGrid();
  // a thug jumps you, punches you; you fight back and knock him down — in front of witnesses
  const thug = w.spawnActor('gang', p.x - 30, p.y, { weapon: 'fists', state: 'idle' });
  w.hurt(p, 5, thug, { kind: 'melee' });
  w.equipWeapon && w.equipWeapon('fists');
  for (let k = 0; k < 8 && thug.alive && thug.ko <= 0; k++) w.hurt(thug, 30, p, { kind: 'melee', blunt: true });
  run(w, 60 * 12);
  check(w.wanted === 0, `fighting back against an attacker is self-defence (wanted ${w.wanted})`);
  // but starting it yourself is a crime
  const w2 = mk(); w2.updatePolice = () => {}; w2.forceCalls = true;
  const p2 = w2.player; const c2 = w2.actors.find((a) => a.kind === 'civ' && a.alive && !a.inCar && w2.bldAt(a.x, a.y) < 0);
  p2.x = c2.x + 40; p2.y = c2.y; w2.rebuildGrid();
  const v = w2.spawnActor('civ', p2.x - 30, p2.y, { state: 'idle' });
  w2.hurt(v, 20, p2, { kind: 'melee' });
  w2.hurt(p2, 3, v, { kind: 'melee' });   // he hits back
  for (let k = 0; k < 8 && v.alive && v.ko <= 0; k++) w2.hurt(v, 30, p2, { kind: 'melee', blunt: true });
  let n = 0; while (w2.wanted < 1 && n++ < 60 * 12) run(w2, 1);
  check(w2.wanted >= 1, `attacking someone first still gets you wanted (${w2.wanted})`);
}
console.log(`\n${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
