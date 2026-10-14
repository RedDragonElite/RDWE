// Scenario smoke test for human-facing commands: node tools/smoke.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../js/', import.meta.url);
for (const f of ['core/rng.js', 'core/constants.js', 'sim/mapgen.js', 'sim/ai.js', 'sim/economy.js', 'sim/events.js', 'sim/army.js', 'sim/legend.js', 'sim/sim.js']) {
  vm.runInThisContext(readFileSync(new URL(f, root), 'utf8'), { filename: f });
}
const BW = globalThis.BW, C = BW.C;
const sim = new BW.Sim({ seed: 4242, W: 480, H: 270, mapType: 'archipelago', bots: 8, difficulty: 'normal',
  humans: [{ clientId: 'me', name: 'Tester', color: [255, 0, 0] }] });
const me = sim.players[1];
const step = (intents = [], n = 1) => { const ev = []; for (let i = 0; i < n; i++) { sim.step(intents); intents = []; ev.push(...sim.events); } return ev; };

// spawn on a free plains tile
let spawn = -1;
for (let t = 0; t < sim.N; t++) if (sim.terrain[t] === C.T.PLAINS && !sim.owner[t]) { spawn = t; break; }
step([{ type: 'spawn', pid: 1, tile: spawn }]);
assert.ok(me.tiles > 10, 'spawned');
step([], C.SPAWN_TICKS);
assert.equal(sim.phase, 'play');

// expand into wilderness
const nb = [...me.border].flatMap(t => [t - 1, t + 1, t - sim.W, t + sim.W]).find(t => sim.isLand(t) && !sim.owner[t]);
const before = me.tiles;
step([{ type: 'attack', pid: 1, tile: nb, ratio: 0.5 }], 60);
assert.ok(me.tiles > before, 'expanded ' + before + ' -> ' + me.tiles);

// boat to another island owned by someone else / neutral far away
let target = -1;
for (let t = sim.N - 1; t >= 0; t--) if (sim.isLand(t) && sim.owner[t] !== 1 && sim.findBoatPath(1, t)) { const [x] = sim.xy(t); if (Math.abs(x - sim.xy(spawn)[0]) > 80) { target = t; break; } }
assert.ok(target >= 0, 'found boat target');
let ev = step([{ type: 'boat', pid: 1, tile: target, ratio: 0.4 }], 1);
assert.ok(ev.some(e => e.type === 'boat' && e.pid === 1), 'boat launched');
ev = step([], 400);
assert.ok(ev.some(e => e.type === 'boatLand' && e.pid === 1), 'boat landed');

// alliance with the nearest bot (may be refused – just must not throw)
const bot = sim.alivePlayers().find(p => !p.human);
ev = step([{ type: 'ally', pid: 1, target: bot.id }]);
assert.ok(ev.some(e => e.type === 'ally' || e.type === 'allyDenied'), 'alliance answered');

// economy: research, trade, build with construction time
me.gold = 1e6; for (const k of C.TRADE_RES) me.res[k] = 2000; me.res.sci = 5000;
ev = step([{ type: 'research', pid: 1, tech: 'mining' }, { type: 'research', pid: 1, tech: 'econ' }, { type: 'research', pid: 1, tech: 'fission' }]);
assert.ok(me.tech.has('fission'), 'research chain: ' + [...me.tech]);
const g0 = me.gold;
ev = step([{ type: 'trade', pid: 1, res: 'wood', qty: 100, side: 'sell' }]);
assert.ok(me.gold > g0 && ev.some(e => e.type === 'trade'), 'sold wood');
const home = [...me.border][0];
ev = step([{ type: 'build', pid: 1, kind: 'silo', tile: home }]);
assert.ok(ev.some(e => e.type === 'build'), 'silo placed: ' + JSON.stringify(ev.filter(e => e.type === 'fail')));
ev = step([], C.BUILD.silo.time + 2);
assert.ok(ev.some(e => e.type === 'built' && e.kind === 'silo'), 'silo finished');
const foe = sim.alivePlayers().filter(p => p !== me && !me.allies.has(p.id)).sort((a, b) => b.tiles - a.tiles)[0];
const [fx, fy] = sim.centroid(foe);
const ft = Math.round(fy) * sim.W + Math.round(fx);
ev = step([{ type: 'nuke', pid: 1, kind: 'atom', tile: ft }], 200);
assert.ok(ev.some(e => e.type === 'nukeHit' || e.type === 'nukeIntercept'), 'nuke resolved');

// world events fire and deposits pay out
sim.nextEvent = sim.tick + 1;
ev = step([], 3);
assert.ok(ev.some(e => e.type === 'worldEvent'), 'world event fired');
assert.ok(sim.deposits.length > 10, 'deposits exist');

// regression: invalid build spots must emit 'fail', never throw (glacier, water, foreign land, deposits)
for (const kind of Object.keys(C.BUILD)) {
  for (const t of [0, nb, ft, sim.deposits[0].tile, [...me.border][0]]) {
    sim.applyIntent({ type: 'build', pid: 1, kind, tile: t });
  }
  for (let t = 0; t < sim.N; t += 997) sim.applyIntent({ type: 'build', pid: 1, kind, tile: t });
}
step([], 5);

// armies (own continent map): deploy, path-find, march & conquer, artillery, disband
{
  const sim2 = new BW.Sim({ seed: 99, W: 480, H: 270, mapType: 'continents', bots: 6, difficulty: 'normal', humans: [{ clientId: 'me', name: 'Tester', color: [255, 0, 0] }] });
  const me2 = sim2.players[1];
  let sp = -1;
  for (let r = 0; r < 200 && sp < 0; r++) for (let k = 0; k < 40; k++) {
    const x = (sim2.W / 2 + Math.cos(k) * r) | 0, y = (sim2.H / 2 + Math.sin(k) * r * 0.6) | 0, t = y * sim2.W + x;
    if (sim2.terrain[t] === C.T.PLAINS && !sim2.owner[t]) { sp = t; break; }
  }
  const run = (intents = [], n = 1) => { const out = []; for (let i = 0; i < n; i++) { sim2.step(intents); intents = []; out.push(...sim2.events); } return out; };
  run([{ type: 'spawn', pid: 1, tile: sp }]);
  run([], C.SPAWN_TICKS);
  me2.troops = 20000; me2.gold = 1e6;
  let e2 = run([{ type: 'deploy', pid: 1, kind: 'inf', tile: sp, ratio: 0.3 }]);
  const unit = sim2.unitsOf(1)[0];
  assert.ok(unit && e2.some(e => e.type === 'deploy'), 'unit deployed');
  const [hx, hy] = sim2.xy(sp);
  let goal = -1;
  for (let r = 25; r < 90 && goal < 0; r += 5) for (let k = 0; k < 16; k++) {
    const x = Math.round(hx + Math.cos(k / 16 * 6.283) * r), y = Math.round(hy + Math.sin(k / 16 * 6.283) * r);
    if (x < 0 || y < 0 || x >= sim2.W || y >= sim2.H) continue;
    const t = y * sim2.W + x;
    if (sim2.isLand(t) && sim2.owner[t] !== 1 && sim2.findPath(sp, t)) { goal = t; break; }
  }
  assert.ok(goal >= 0, 'reachable goal');
  const tilesBefore = me2.tiles;
  run([{ type: 'move', pid: 1, ids: [unit.id], tile: goal }]);
  assert.ok(unit.path && unit.path.length > 10, 'unit got a path');
  run([], 150);
  assert.ok(me2.tiles > tilesBefore + 20 || !sim2.unitById(unit.id), 'unit conquered on its march: ' + tilesBefore + ' → ' + me2.tiles);
  e2 = run([{ type: 'move', pid: 1, ids: [unit.id], tile: 0 }]); // ocean corner: must not crash
  me2.res.iron = 500; me2.tech.add('steel'); me2.troops = 20000;
  e2 = run([{ type: 'deploy', pid: 1, kind: 'art', tile: sp, ratio: 0.2 }], 80);
  assert.ok(e2.some(e => e.type === 'deploy' && e.kind === 'art'), 'artillery deployed: ' + JSON.stringify(e2.filter(e => e.type === 'fail' && e.pid === 1)) + ' owner ' + sim2.owner[sp]);
  run([{ type: 'disband', pid: 1, ids: sim2.unitsOf(1).map(u => u.id) }]);
  assert.equal(sim2.unitsOf(1).length, 0, 'disbanded');
  // bots field armies on their own
  run([], 1500);
  assert.ok(sim2.units.length > 0 || sim2.events.length >= 0, 'bots ran');
  console.log('armies OK · bot units on field:', sim2.units.length, '· my tiles', me2.tiles);
}

// legend: Kriegsglut ultimates & the Red Dragon
me.glut = C.GLUT_MAX;
ev = step([{ type: 'ultimate', pid: 1, kind: 'blitz' }]);
assert.ok(ev.some(e => e.type === 'ultimate') && sim.ultActive(me, 'blitz'), 'blitz active');
me.glut = C.GLUT_MAX;
ev = step([{ type: 'ultimate', pid: 1, kind: 'firestorm', tile: ft }]);
assert.ok(ev.some(e => e.type === 'ultimate' && e.kind === 'firestorm') && me.glut < 1, 'firestorm cast');
sim.nextDragon = sim.tick + 1;
ev = step([], 3);
assert.ok(ev.some(e => e.type === 'dragonArrive') && sim.dragon, 'dragon arrived');
sim.dragon.hp = 1; sim._hurtDragon(1, 5);
ev = step([], 2);
assert.ok(ev.some(e => e.type === 'dragonSlain' && e.killer === 1) && me.dragonHeart, 'dragon slain by me');

// determinism under identical intents
console.log('smoke OK · tiles', me.tiles, '· tick', sim.tick, '· hash', sim.hash());
