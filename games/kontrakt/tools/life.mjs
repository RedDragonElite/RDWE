// city life: residents in their homes, clean-up crews, context keys: node tools/life.mjs
import fs from 'fs'; import vm from 'vm';
const ctx = { console, Math, Date, JSON, globalThis: null }; ctx.globalThis = ctx; vm.createContext(ctx);
const files = fs.readFileSync('tools/scenarios.mjs', 'utf8').match(/for \(const f of (\[[^\]]+\])/)[1];
for (const f of eval(files)) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
const K = ctx.K, TILE = 32, U = K.U;
let ok = 0, fail = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const run = (w, n, inp = {}) => { for (let i = 0; i < n; i++) { w.update(1 / 60, { pressed: {}, ...inp }); w.events.length = 0; } };
const mk = (seed = 21, hour = 12) => { const w = new K.World({ seed }); w.time = hour * 60; w.thugT = 1e9; w.updatePolice = () => {}; run(w, 30); return w; };
const stand = (w, b, dx = 0) => { const o = w.homeDoorOut(b); w.player.x = o[0] + dx; w.player.y = o[1] + 4 * TILE; };

console.log('households');
{
  const w = mk(), homes = w.privateHomes();
  check(homes.length > 40, `${homes.length} private houses and flats`);
  let n = 0, jobs = {};
  for (const b of homes) { const hh = w.household(b); n += hh.members.length; for (const m of hh.members) jobs[m.job] = (jobs[m.job] || 0) + 1; }
  check(homes.every((b) => b.hh.members.length >= 1), `every home is lived in (${n} residents)`);
  check(Object.keys(jobs).length >= 4, `mixed routines ${JSON.stringify(jobs)}`);
  // a week of schedules: day workers are out during office hours, home at night
  const day = homes.flatMap((b) => b.hh.members).filter((m) => m.job === 'day');
  const at = (d, h) => day.filter((m) => w.residentHome(m, d * 1440 + h * 60)).length / day.length;
  check(at(1, 11) < 0.25 && at(1, 3) > 0.9, `office workers: ${Math.round(at(1, 11) * 100)}% home at 11:00 on Tuesday, ${Math.round(at(1, 3) * 100)}% at 03:00`);
  check(at(6, 11) > 0.4, `…and more of them home on Sunday (${Math.round(at(6, 11) * 100)}%)`);
  const all = homes.flatMap((b) => b.hh.members), h = (t) => all.filter((m) => w.residentHome(m, t)).length / all.length;
  check(h(1440 + 11 * 60) > 0.2 && h(1440 + 11 * 60) < 0.7, `Tuesday 11:00: ${Math.round(h(1440 + 11 * 60) * 100)}% of all residents home — some flats empty, some not`);
}
console.log('residents come to life near you');
{
  const w = mk(21, 2.5), b = w.privateHomes().find((q) => !q.owned && !q.property && q.type === 'house');
  stand(w, b); run(w, 60);
  const hh = w.household(b), home = hh.members.filter((m) => w.residentHome(m));
  const acts = w.actors.filter((a) => a.household === b.id && !a.removed);
  check(acts.length === home.length && acts.length > 0, `night: ${acts.length}/${hh.members.length} members spawned at home`);
  check(acts.some((a) => a.state === 'sleep'), 'someone is asleep in bed at 02:30');
  const sl = acts.find((a) => a.state === 'sleep');
  w.player.x = sl.x + 3 * TILE; w.player.y = sl.y; run(w, 30);
  check(sl.state === 'sleep' && !sl.seesPlayer, 'a sleeper doesn\'t see you');
  w.noise(sl.x + TILE, sl.y, 6, 'shot', w.player); run(w, 2);
  check(sl.state !== 'sleep', `a shot wakes them (${sl.state})`);
  // walk away: the household dissolves back into data
  w.player.x = 10 * TILE; w.player.y = 10 * TILE; if (Math.hypot(b.x * TILE - w.player.x, b.y * TILE - w.player.y) < 60 * TILE) { w.player.x = (w.W - 10) * TILE; w.player.y = (w.H - 40) * TILE; }
  run(w, 60);
  check(w.actors.filter((a) => a.household === b.id && !a.removed && a.state !== 'flee' && a.state !== 'cower').length === 0, 'far away the house is just data again');
}
console.log('daytime: workers leave, the flat may be empty');
{
  const w = mk(21, 7), homes = w.privateHomes().filter((q) => !q.owned && !q.property);
  const b = homes.find((q) => w.household(q).members.every((m) => m.job === 'day') && w.household(q).members.every((m) => w.residentHome(m)) && !w.household(q).members.every((m) => w.residentHome(m, w.time + 120)));
  check(!!b, 'found a home of office workers');
  if (b) {
    stand(w, b); run(w, 60);
    const n0 = w.actors.filter((a) => a.household === b.id && !a.removed).length;
    w.time += 115; run(w, 60 * 40);
    const left = w.actors.filter((a) => a.household === b.id && !a.removed && a.resident).length;
    check(n0 > 0 && left < n0, `at 07:00 ${n0} home, after 09:00 ${left} left inside`);
  }
}
console.log('burglary: residents react');
{
  const w = mk(21, 15), b = w.privateHomes().find((q) => !q.owned && !q.property && w.household(q).members.some((m) => w.residentHome(m)));
  stand(w, b); run(w, 60);
  const r = w.actors.find((a) => a.household === b.id && !a.removed && a.alive);
  check(!!r, 'someone home in the afternoon');
  if (r) {
    let best = null;
    for (let ty = b.y; ty < b.y + b.h; ty++) for (let tx = b.x; tx < b.x + b.w; tx++) {
      const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE, d = Math.hypot(x - r.x, y - r.y), i = ty * w.W + tx;
      if (w.bmap[i] !== b.id || w.blockedTile(i, null) || d < 2 * TILE || d > 5 * TILE || !K.los(w, x, y, r.x, r.y)) continue;
      if (!best || d < best.d) best = { x, y, d };
    }
    if (best) { w.player.x = best.x; w.player.y = best.y; }
    r.angle = Math.atan2(w.player.y - r.y, w.player.x - r.x); r.state = 'idle'; r.brain.t = 30;
    w.P.outfit = 'casual'; w.forceCalls = true;
    let st = new Set(); for (let i = 0; i < 60 * 6; i++) { run(w, 1); st.add(r.state); }
    check(w.bldAt(w.player.x, w.player.y) !== b.id || st.has('flee') || st.has('warn') || st.has('report') || r.reportT > 0 || st.has('hostile'), `they notice the intruder (${[...st].join(',')})`);
  }
  // armed resident draws on you
  const w2 = mk(21, 15); const b2 = w2.privateHomes().find((q) => !q.owned && !q.property && w2.household(q).members.some((m) => w2.residentHome(m)));
  for (const m of w2.household(b2).members) { m.armed = true; const x = m.actor && w2.byId.get(m.actor); if (x) w2.removeActor(x); m.actor = 0; }
  stand(w2, b2); run(w2, 60);
  const r2 = w2.actors.find((a) => a.household === b2.id && !a.removed && a.alive);
  if (r2) { w2.onSuspicious(r2, 'trespass'); check(r2.wi.id === 'p9' && r2.state === 'warn', 'an armed tenant pulls a pistol and warns you'); }
  // dead tenants are replaced after a few days
  const m = w2.household(b2).members[0]; const a = m.actor && w2.byId.get(m.actor);
  if (a) { w2.kill(a, null); run(w2, 40); check(m.dead, 'a killed tenant stays dead'); w2.time += 1440 * 3.2; w2.player.x = (w2.W - 10) * TILE; w2.player.y = 30 * TILE; w2.resT = 0; run(w2, 2); w2.player.x = b2.x * TILE; w2.player.y = (b2.y - 20) * TILE; w2.resT = 0; run(w2, 2); check(!m.dead, `new tenant after three days: ${m.name}`); }
}
console.log('context keys');
{
  const w = mk(), p = w.player;
  const v = w.spawnActor('civ', p.x + 20, p.y, {}); v.wallet = 77; w.kill(v, null);
  const gun = { id: 9999, kind: 'weapon', wid: 'p9', mag: 7, x: p.x - 20, y: p.y, t: w.t }; w.items.push(gun); run(w, 1);
  p.aim = p.angle = Math.PI;   // look at the pistol
  let ctxs = w.focusContext(w.contextActions());
  const first = ctxs.find((c) => c.key === 'E' && !c.long);
  check(first && first.label.startsWith('Aufheben'), `looking at the pistol: E = ${first && first.label}`);
  check(ctxs.some((c) => c.long && c.label.includes('ziehen')), 'dragging is the long press');
  p.aim = p.angle = 0;  // look at the body
  ctxs = w.focusContext(w.contextActions());
  const f2 = ctxs.find((c) => c.key === 'E' && !c.long);
  check(f2 && f2.label.includes('durchsuchen'), `looking at the body: E = ${f2 && f2.label}`);
  const m0 = w.P.money;
  run(w, 1, { pressed: { e: true }, eHeld: true }); run(w, 4, { eHeld: true }); run(w, 70);   // tap: search
  check(w.P.money === m0 + 77 && !w.drag, `tap E searches the body (+$${w.P.money - m0}), no drag`);
  run(w, 1, { pressed: { e: true }, eHeld: true }); run(w, 30, { eHeld: true });
  check(w.drag === v.id, 'hold E drags it');
  const let_ = w.ctx.find((c) => c.key === 'E');
  run(w, 1, { pressed: { e: true }, eHeld: true }); run(w, 80, { eHeld: true }); run(w, 2);
  check(!w.drag, `E while dragging: ${let_ && let_.label}`);
  p.aim = p.angle = Math.PI; run(w, 1); 
  run(w, 1, { pressed: { e: true }, eHeld: true }); run(w, 3);
  check(gun.taken, 'tap E while looking at the pistol picks it up');
}
console.log('city services');
{
  // across town: the body is collected, then the scene is mopped
  const w = mk(), p = w.player, ev = [];
  const v = w.spawnActor('civ', p.x + 60, p.y, {}); v.bloody = true; w.kill(v, null); run(w, 200);
  const j = w.cityJobs().jobs.find((q) => q.kind === 'body' && q.ref === v.id);
  check(!!j && j.due - w.time > 100, `unfound body: collected in ~${Math.round((j.due - w.time) / 60)} h`);
  v.found = true; run(w, 200);
  check(j.due - w.time < 55, `found: the coroner comes within ${Math.round(j.due - w.time)} min`);
  p.x = (w.W - 12) * TILE; p.y = 40 * TILE; if (Math.hypot(p.x - v.x, p.y - v.y) < 50 * TILE) p.y = (w.H - 40) * TILE;
  w.time = j.due + 1;
  for (let i = 0; i < 60 * 4; i++) { w.update(1 / 60, { pressed: {} }); ev.push(...w.events); w.events.length = 0; }
  check(v.removed, 'off-screen the body is simply gone');
  const bj = w.cityJobs().jobs.find((q) => q.kind === 'blood' && Math.hypot(q.x - v.x, q.y - v.y) < 5);
  check(!!bj, `a cleaning job follows (${bj ? Math.round(bj.due - w.time) : '?'} min)`);
  if (bj) { w.time = bj.due + 1; for (let i = 0; i < 60 * 4; i++) { w.update(1 / 60, { pressed: {} }); ev.push(...w.events); w.events.length = 0; } }
  check(ev.some((e) => e.type === 'clean' && Math.hypot(e.x - v.x, e.y - v.y) < 5), 'the blood is cleaned up');
}
{
  // in view: a coroner van drives up and the crew bags the body
  const w = mk(), p = w.player;
  let spot = null;
  for (let i = 0; i < w.W * w.H && !spot; i += 7) { const tx = i % w.W, ty = (i / w.W) | 0; if (tx > 30 && ty > 30 && tx < w.W - 40 && ty < w.H - 40 && w.tiles[ty * w.W + tx] === K.T.WALK && !w.solid[ty * w.W + tx] && w.bldAt((tx + 0.5) * TILE, (ty + 0.5) * TILE) < 0) spot = [tx, ty]; }
  const v = w.spawnActor('civ', (spot[0] + 0.5) * TILE, (spot[1] + 0.5) * TILE, {}); w.kill(v, null); v.found = true;
  p.x = v.x + 8 * TILE; p.y = v.y; run(w, 200);
  const j = w.cityJobs().jobs.find((q) => q.kind === 'body' && q.ref === v.id); w.time = j.due + 1;
  let van = null, bagged = false, crewSeen = false;
  for (let i = 0; i < 60 * 150 && !bagged; i++) {
    run(w, 1); if (!van) van = w.cars.find((c) => c.svc && c.livery === 'coroner');
    if (w.actors.some((a) => a.state === 'svc' && a.outfit === 'coroner')) crewSeen = true;
    bagged = v.removed;
  }
  check(!!van, 'a coroner van is dispatched');
  check(crewSeen && bagged, `the crew gets out and takes the body (${bagged ? 'done' : 'not done'})`);
  for (let i = 0; i < 60 * 60 && van && van.unit && van.unit.mode !== 'leave'; i++) run(w, 1);
  check(van && van.unit && van.unit.mode === 'leave', 'they drive off again');
}
{
  // a smashed lamp: dark for hours, then the city fixes it
  const w = mk(), lampP = w.props.find((q) => q && q.k === 'lamp' && q.bld < 0);
  w.breakProp(lampP, null);
  const L = w.lights.find((l) => l.kind === 'lamp' && Math.abs(l.x - (lampP.x + 0.5) * TILE) < 20 && Math.abs(l.y - (lampP.y + 0.5) * TILE) < 20);
  w.player.x = (w.W - 12) * TILE; w.player.y = 40 * TILE; if (Math.hypot(w.player.x - lampP.x * TILE, w.player.y - lampP.y * TILE) < 50 * TILE) w.player.y = (w.H - 40) * TILE;
  run(w, 200);
  const j = w.cityJobs().jobs.find((q) => q.kind === 'lamp' && q.ref === lampP.id);
  check(!!j && j.due - w.time > 300, `lamp stays broken ~${j ? Math.round((j.due - w.time) / 60) : '?'} h`);
  w.time = j.due + 1; run(w, 200);
  check(!lampP.broken && (!L || !L.dead) && w.solid[lampP.y * w.W + lampP.x], 'Stadtwerke replaced the lamp');
}
{
  // dumpsters are emptied every other morning
  const w = mk(), p = w.player, dump = w.props.find((q) => q && q.k === 'dumpster');
  const v = w.spawnActor('civ', (dump.x + 0.5) * TILE, (dump.y + 1.5) * TILE, {}); w.kill(v, null); v.hidden = true; v.hiddenSpot = dump.id; dump.bodies = 1;
  w.time = 2 * 1440 + 5.9 * 60; run(w, 200);
  check(!v.removed, 'hidden body stays until the garbage run');
  w.time = 2 * 1440 + 6.2 * 60; run(w, 200);
  check(v.removed && !dump.bodies, 'the Müllabfuhr takes it at 06:00');
}
console.log('traffic');
{
  const w = mk(); w.player.x = (5 * 26 + 2) * TILE + 200; w.player.y = (5 * 26 + 12) * TILE;
  let crashes = 0, n = 0, stopped = 0, off = 0, blink = 0, turning = 0;
  for (let i = 0; i < 60 * 120; i++) {
    w.update(1 / 60, { pressed: {} }); for (const e of w.events) if (e.type === 'crash') crashes++; w.events.length = 0;
    if (i % 30 === 0) for (const c of w.cars) if (c.ai && c.driver && c.driver !== 'player' && !c.dead && !c.unit) {
      n++; if ((c.speed || 0) < 5) stopped++;
      const t = w.tiles[((c.y / TILE) | 0) * w.W + ((c.x / TILE) | 0)]; if (t !== K.T.ROAD) off++;
      if (c.ai.stage === 'turn' && c.ai.leg && c.ai.leg.turn !== 'straight') { turning++; if (c.blink) blink++; }
    }
  }
  check(crashes <= 2, `two minutes of traffic: ${crashes} crashes`);
  check(stopped / n < 0.2, `cars keep moving (${Math.round(stopped / n * 100)}% waiting at a given moment)`);
  check(off / n < 0.01, `they stay on the road (${off}/${n} samples off it)`);
  check(turning > 0 && blink === turning, `they indicate when turning (${blink}/${turning})`);
}
console.log(`\n${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
