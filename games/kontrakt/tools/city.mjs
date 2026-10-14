// beach, nightlife & properties: node tools/city.mjs
import fs from 'fs'; import vm from 'vm';
const ctx = { console, Math, Date, JSON, globalThis: null }; ctx.globalThis = ctx; vm.createContext(ctx);
const files = fs.readFileSync('tools/scenarios.mjs', 'utf8').match(/for \(const f of (\[[^\]]+\])/)[1];
for (const f of eval(files)) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
const K = ctx.K, TILE = 32;
let ok = 0, fail = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const run = (w, n, inp = {}) => { for (let i = 0; i < n; i++) { w.update(1 / 60, { pressed: {}, ...inp }); w.events.length = 0; } };
for (const seed of [1337, 7]) {
  console.log(`seed ${seed}`);
  const w = new K.World({ seed }); w.time = 22 * 60; w.godMode = true; w.thugT = 1e9;
  run(w, 2);
  const missing = K.PROPERTIES.filter((d) => !w.buildings.some((b) => b.property === d.id)).map((d) => d.id);
  check(!missing.length, `all ${K.PROPERTIES.length} properties exist in the city ${missing.join(',')}`);
  check(w.buildings.filter((b) => b.type === 'beachclub').length === 2 && w.buildings.some((b) => b.type === 'beachhouse'), 'two beach clubs and a beach house at Ocean Beach');
  check(w.city.tiles[(w.city.W + 2) * w.W + 20] === K.T.SAND, 'sand down to the water');
  const dancers = w.actors.filter((a) => a.dancer);
  check(dancers.length === 2, 'two dancers on the Velvet stage');
  const p = w.player, d = dancers[0];
  p.x = d.x + 30; p.y = d.y + 20; w.rebuildGrid(); w.P.money = 5000;
  const acts = w.contextActions();
  check(acts.some((o) => o.label.startsWith('Trinkgeld')) && acts.some((o) => o.label.startsWith('Privattanz')), 'tip & private dance prompts');
  w.refreshOffers(); w.acceptContract(w.offers[0]);
  for (let k = 0; k < 4; k++) w.tipDancer(d);
  check(w.contract.intel, 'a regular hears things: free intel on the target');
  // beach crowd
  p.x = 30 * TILE; p.y = (w.city.W - 6) * TILE; w.time = 13 * 60; run(w, 60 * 12);
  check(w.actors.filter((a) => a.beachgoer && a.alive).length >= 4, `beach-goers on the sand (${w.actors.filter((a) => a.beachgoer).length})`);
  // buy a business, collect income
  w.P.money = 500000;
  check(w.buyProperty('velvet') && w.P.owned.includes('velvet'), 'buy the Velvet');
  const m0 = w.P.money + (w.P.bank || 0); w.time = Math.ceil(w.time / 1440) * 1440 + 8 * 60 - 5; run(w, 60 * 10);
  check(w.P.money + (w.P.bank || 0) >= m0 + 3400, `daily income arrives (+$${w.P.money + (w.P.bank || 0) - m0})`);
}
console.log(`\n${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
