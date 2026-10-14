// Headless sim run: node tools/headless.mjs [seed] [ticks]
// Verifies the simulation runs without DOM and is deterministic (same seed => same hash).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const root = new URL('../js/', import.meta.url);
for (const f of ['core/rng.js', 'core/constants.js', 'sim/mapgen.js', 'sim/ai.js', 'sim/sim.js']) {
  vm.runInThisContext(readFileSync(new URL(f, root), 'utf8'), { filename: f });
}
const BW = globalThis.BW;
const seed = +(process.argv[2] || 1337), ticks = +(process.argv[3] || 3000);
function run() {
  const t0 = performance.now();
  const sim = new BW.Sim({ seed, W: 640, H: 360, mapType: 'continents', bots: 16, difficulty: 'hard', humans: [] });
  const tGen = performance.now() - t0;
  const counts = {};
  for (let i = 0; i < ticks && sim.phase !== 'over'; i++) {
    sim.step([]);
    for (const e of sim.events) counts[e.type] = (counts[e.type] || 0) + 1;
  }
  return { sim, tGen, ms: performance.now() - t0, counts };
}
const a = run(), b = run();
const s = a.sim;
console.log('gen ms', a.tGen.toFixed(0), 'total ms', a.ms.toFixed(0), 'ticks', s.tick, 'phase', s.phase, 'land', s.map.landCount);
console.log('events', a.counts);
console.log(s.alivePlayers().sort((x, y) => y.tiles - x.tiles).slice(0, 8)
  .map(p => `${p.name} tiles=${p.tiles} troops=${p.troops | 0} gold=${p.gold | 0} ${JSON.stringify(p.counts)}`).join('\n'));
console.log('deterministic:', a.sim.hash() === b.sim.hash(), a.sim.hash(), b.sim.hash());
