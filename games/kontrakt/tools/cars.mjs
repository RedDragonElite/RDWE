// car systems: node tools/cars.mjs
import fs from 'fs'; import vm from 'vm';
const ctx = { console, Math, Date, JSON, globalThis: null }; ctx.globalThis = ctx; vm.createContext(ctx);
const files = fs.readFileSync('tools/scenarios.mjs', 'utf8').match(/for \(const f of (\[[^\]]+\])/)[1];
for (const f of eval(files)) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
const K = ctx.K, TILE = 32;
let ok = 0, fail = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const run = (w, n, inp = {}) => { for (let i = 0; i < n; i++) { w.update(1 / 60, { pressed: {}, ...inp }); w.events.length = 0; } };
const world = (seed = 31) => { const w = new K.World({ seed }); w.time = 12 * 60; w.godMode = true; w.thugT = 1e9; w.spawnTraffic = () => null; w.updatePolice = () => {}; return w; };
/** place a car on a straight road segment heading +x, clear of traffic */
function testCar(w, kind = 'sedan') {
  for (const c of w.cars) w.despawnCar(c);
  w.cars = [];
  const y = (2 * 26 + 2) * TILE - 32, x = (1 * 26 + 2) * TILE + 160;   // a lane east of node (1,2)
  const c = w.spawnCar(kind, x, y, 0, {});
  const p = w.player; p.x = c.x; p.y = c.y + 40; w.enterCar(c);
  return c;
}

console.log('1) driving costs fuel, an empty tank stalls the engine');
{
  const w = world(); const c = testCar(w);
  run(w, 200);
  check(c.engineOn, 'engine cranks (hot-wires) and starts on entering');
  const f0 = c.fuel; run(w, 60 * 4, { up: true });
  check(c.fuel < f0, `fuel drops while driving (${f0.toFixed(1)} → ${c.fuel.toFixed(1)}%)`);
  check(c.speed * K.KMH > 40, `the car accelerates (${Math.round(c.speed * K.KMH)} km/h)`);
  c.fuel = 0.02; run(w, 60 * 2, { up: true });
  check(!c.engineOn, 'empty tank → engine stalls');
}
console.log('2) crashing deforms the body and hurts the engine; no seatbelt → through the windshield');
{
  const w = world(); const c = testCar(w);
  run(w, 90);
  // aim at a building wall: turn north and floor it
  c.a = -Math.PI / 2; let crashed = false;
  for (let i = 0; i < 60 * 8 && !crashed; i++) { w.update(1 / 60, { pressed: {}, up: true }); crashed = w.events.some((e) => e.type === 'crash'); w.events.length = 0; }
  check(crashed, 'the car hits something');
  check(c.dents.some((d) => d > 0.5), `body is dented (max ${Math.max(...c.dents).toFixed(1)}px)`);
  check(c.eng < 100 || c.bodyHP < 100, `part damage (engine ${c.eng.toFixed(0)}, body ${c.bodyHP.toFixed(0)})`);
  const w2 = world(); const c2 = testCar(w2); run(w2, 90); c2.belt = false;
  c2.vx = 400; c2.vy = 0; c2.vf = 400; c2.speed = 400; w2.crashBelt(c2, 400);
  check(!w2.player.inCar && w2.player.stun > 0, 'unbelted at 128 km/h → ejected');
  const w3 = world(); const c3 = testCar(w3); run(w3, 90); c3.belt = true; w3.crashBelt(c3, 400);
  check(w3.player.inCar, 'belted → stays in the seat');
}
console.log('3) street lamps and hydrants go down');
{
  const w = world();
  const free = (x, y) => w.pmap[y * w.W + x] < 0 && !w.carTileBlocked((x + 0.5) * TILE, (y + 0.5) * TILE);
  const lamp = w.props.find((p) => p && p.k === 'lamp' && p.bld < 0 && [1, 2, 3, 4].every((k) => free(p.x - k, p.y) && free(p.x - k, p.y - 1) && free(p.x - k, p.y + 1)) && free(p.x, p.y - 1) && free(p.x, p.y + 1));
  const c = testCar(w); run(w, 90);
  const lx = (lamp.x + 0.5) * TILE, ly = (lamp.y + 0.5) * TILE;
  c.x = lx - 100; c.y = ly; c.a = 0; c.vx = 300; c.vy = 0; c.vf = 300; c.speed = 300; c.belt = true;
  for (let i = 0; i < 60 && !lamp.broken; i++) run(w, 1, { up: true });
  check(lamp.broken, 'lamp knocked over at speed');
  check(w.solid[lamp.y * w.W + lamp.x] === 0, 'the spot is free afterwards');
  check(w.lights.some((L) => L.dead), 'its light goes out');
  check((w.debris || []).length > 0, 'debris lies on the street');
}
console.log('4) shooting tyres, tuning makes it faster');
{
  const w = world(); const c = testCar(w); run(w, 90);
  const fx = Math.cos(c.a), fy = Math.sin(c.a);
  const hx = c.x + fx * (c.l / 2 - 13) + fy * (c.w / 2), hy = c.y + fy * (c.l / 2 - 13) - fx * (c.w / 2);
  w.carHit(c, hx, hy, 30, null, 'bullet');
  check(c.tires.some((t) => t < 1), 'a bullet bursts a tyre');
  const bc = testCar(world(), 'sedan'); bc.engineOn = true; const base = w.carMods(bc);
  const tc = testCar(world(), 'sedan'); tc.engineOn = true; tc.tune = { engine: 4, turbo: 1, trans: 3 };
  const tuned = w.carMods(tc);
  check(tuned.acc > base.acc * 1.4 && tuned.max > base.max, `tuning boosts acceleration ×${(tuned.acc / base.acc).toFixed(2)}`);
}
console.log('5) Autohaus: buy a car, it waits outside');
let bought = null;
{
  const w = world(); run(w, 2); w.P.money = 300000;
  check(w.cars.filter((c) => c.display).length === 4, 'four display cars in the lot');
  const r = w.buyCar('muscle', '#c87a00');
  const c = r && w.worldCarOf(r);
  check(r && c && c.owned && w.P.money === 300000 - 45000, `Bulldog V8 bought (${r && r.plate})`);
  const p = w.player; p.x = c.x + 50; p.y = c.y; w.enterCar(c);
  check(!c.hotwire, 'your own car starts with the key');
  bought = { w, r, c };
}
console.log('6) rde_fuel: nozzle, pump, pay');
{
  const w = world(); run(w, 2); w.P.money = 5000;
  const pump = w.props.find((q) => q && q.k === 'pump');
  const p = w.player; p.x = (pump.x + 0.5) * TILE; p.y = (pump.y + 1.5) * TILE; w.rebuildGrid();
  const take = w.contextActions().find((o) => o.label === 'Zapfpistole nehmen'); check(!!take, 'take the nozzle'); take.fn();
  const c = w.spawnCar('sedan', p.x + 50, p.y + 6, 0, {}); c.fuel = 20; c.engineOn = false; c.driver = null;
  const ins = w.contextActions().find((o) => o.label.startsWith('Zapfpistole einstecken')); check(!!ins, 'insert it into the tank'); ins.fn();
  const m0 = w.P.money; run(w, 60 * 40);
  check(c.fuel > 99 && !w.P.fueling, `tank full (${Math.round(c.fuel)}%)`);
  check(w.P.money < m0 && m0 - w.P.money < 140, `paid ${m0 - w.P.money}$ for ~80%`);
  p.x += 12 * TILE; run(w, 2);
  check(!w.P.nozzle, 'walking off snaps the hose back');
}
console.log('7) workshop: repair with a mechanic, tuning with preview');
{
  const { w, c } = bought; w.exitCar(true); run(w, 10);
  c.eng = 40; c.bodyHP = 50; c.dents = c.dents.map(() => 4); c.tires[2] = 0;
  const q = w.repairQuote(c); check(q && q.price > 500, `repair quote ${q && q.price}$ / ${q && q.dur.toFixed(0)}s`);
  w.P.money = 100000;
  check(w.startRepair(c), 'repair starts');
  run(w, 60 * 35);
  check(c.eng > 99 && c.tires[2] > 99 && c.dents.every((d) => d < 0.1) && !w.repairJob, 'car fully repaired');
  const engine = K.TUNING[0].parts.find((x) => x.id === 'engine');
  check(w.buyTune(c, 'engine', 4) && c.tune.engine === 4, `engine stage 4 (${K.tunePrice(c, engine, engine.opts[4])}$)`);
  check(w.buyTune(c, 'neon', 2) && c.tune.neon === '#0ae0ff', 'electric blue neon');
}
console.log('8) rde_carservice: pickup to the garage, delivery back');
{
  const { w, r, c } = bought; w.P.money = 100000;
  const p = w.player; p.x = c.x + 3 * TILE; p.y = c.y;
  check(w.servicePickup(), 'pickup ordered');
  for (let i = 0; i < 60 * 300 && r.state !== 'stored'; i++) run(w, 1);
  check(r.state === 'stored' && !w.worldCarOf(r), 'valet drove it to the garage');
  check(w.serviceDeliver(r.id), 'delivery ordered');
  const c2 = w.worldCarOf(r); const d0 = Math.hypot(c2.x - p.x, c2.y - p.y) / TILE;
  check(d0 > 10, `it starts far away (${Math.round(d0)} tiles)`);
  for (let i = 0; i < 60 * 300 && w.svc.stage !== 'done'; i++) run(w, 1);
  check(w.svc.stage === 'done' && Math.hypot(c2.x - p.x, c2.y - p.y) < 14 * TILE, `delivered and keys handed over (${Math.round(Math.hypot(c2.x - p.x, c2.y - p.y) / TILE)} tiles)`);
  check(c2.tune.engine === 4 && c2.tune.neon, 'tuning came along');
}
console.log(`\n${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
