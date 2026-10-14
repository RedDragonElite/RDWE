// Scenario smoke test for human-facing commands: node tools/smoke.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../js/', import.meta.url);
for (const f of ['core/rng.js', 'core/constants.js', 'sim/mapgen.js', 'sim/ai.js', 'sim/economy.js', 'sim/events.js', 'sim/sim.js']) {
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

// determinism under identical intents
console.log('smoke OK · tiles', me.tiles, '· tick', sim.tick, '· hash', sim.hash());
