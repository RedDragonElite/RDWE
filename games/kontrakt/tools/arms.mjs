// sniper rifles, scope sway, breath, .50 penetration: node tools/arms.mjs
import fs from 'fs'; import vm from 'vm';
const ctx = { console, Math, Date, JSON, globalThis: null }; ctx.globalThis = ctx; vm.createContext(ctx);
const files = fs.readFileSync('tools/scenarios.mjs', 'utf8').match(/for \(const f of (\[[^\]]+\])/)[1];
for (const f of eval(files)) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
const K = ctx.K, TILE = 32;
let ok = 0, fail = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const run = (w, n, inp = {}) => { for (let i = 0; i < n; i++) { w.update(1 / 60, { pressed: {}, ...inp }); w.events.length = 0; } };
const W8 = K.WEAPONS;
console.log('arsenal');
for (const id of ['ar15', 'lmg', 'dmr', 'jaeger', 'vss', 'kodiak']) check(W8[id] && W8[id].type === 'gun' && K.AMMO[W8[id].ammo], `${W8[id].name} with ${K.AMMO[W8[id].ammo].name}`);
check(['ar15', 'dmr', 'a:556'].every((i) => K.SHOPS.gun.items.includes(i)), 'gun shop: AR-15, DMR, 5.56');
check(['vss', 'kodiak', 'lmg', 'a:50', 'a:9x39'].every((i) => K.SHOPS.black.items.includes(i)), 'black market: VSS, Kodiak, M60, .50, 9×39');
console.log('scope & breath');
{
  const w = new K.World({ seed: 1337 }); w.time = 12 * 60; w.godMode = true; w.spawnTraffic = () => null; w.updatePolice = () => {}; w.thugT = 1e9;
  run(w, 2);
  const p = w.player, P = w.P;
  w.addWeapon('jaeger'); w.equipWeapon('jaeger');
  const ax = p.x + 600, ay = p.y;
  let mx = 0; for (let i = 0; i < 180; i++) { run(w, 1, { aim: true, ax, ay }); mx = Math.max(mx, Math.hypot(w.aimX - ax, w.aimY - ay)); }
  check(w.scoped === 2 && mx > 6, `8× scope sways at 600 px (up to ${mx.toFixed(1)} px)`);
  let mh = 0; run(w, 20, { aim: true, ax, ay, sprint: true });
  for (let i = 0; i < 90; i++) { run(w, 1, { aim: true, ax, ay, sprint: true }); mh = Math.max(mh, Math.hypot(w.aimX - ax, w.aimY - ay)); }
  check(w.holdBreath && mh < mx * 0.4, `holding the breath steadies it (${mh.toFixed(1)} px)`);
  check(P.breath < 70, `…and costs air (${P.breath.toFixed(0)})`);
  run(w, 60 * 6, { aim: true, ax, ay, sprint: true });
  check(P.gasp > 0 && !w.holdBreath, 'lungs give out → gasping, no more holding');
  run(w, 60 * 8, { aim: true, ax, ay });
  check(P.gasp === 0 && P.breath > 40, 'breath comes back');
  // open plaza: a run of free road tiles
  let spot = null;
  for (let i = 0; i < w.W * w.H && !spot; i++) { const tx = i % w.W, ty = (i / w.W) | 0; if (tx > 5 && tx < w.W - 30 && ty > 5 && ty < w.H - 5 && [...Array(24).keys()].every((k) => w.tiles[ty * w.W + tx + k] === K.T.ROAD && !w.solid[ty * w.W + tx + k])) spot = [tx, ty]; }
  p.x = (spot[0] + 1.5) * TILE; p.y = (spot[1] + 0.5) * TILE;
  const ax2 = p.x + 2000;
  const x0 = p.x; run(w, 60, { aim: true, ax: ax2, ay: p.y, right: true }); const vScope = p.x - x0;
  p.x = (spot[0] + 1.5) * TILE; const x1 = p.x; run(w, 60, { right: true }); const vFree = p.x - x1;
  check(vScope < vFree * 0.6, `looking through the scope you creep (${vScope.toFixed(0)} vs ${vFree.toFixed(0)} px/s)`);
  w.addWeapon('lmg'); w.equipWeapon('lmg'); p.x = (spot[0] + 1.5) * TILE; const x2 = p.x; run(w, 60, { right: true });
  check(p.x - x2 < vFree * 0.9, `the M60 weighs you down (${(p.x - x2).toFixed(0)} px/s)`);
}
console.log('.50 BMG');
{
  const w = new K.World({ seed: 7 }); w.time = 12 * 60; w.godMode = true; w.thugT = 1e9;
  run(w, 120); w.spawnTraffic = () => null; w.updatePolice = () => {};
  const p = w.player;
  const c = w.cars.find((c) => !c.display && !c.siren && c.driver && c.driver !== 'player');
  c.vx = c.vy = 0; c.speed = 0; c.thr = 0;
  const nx = Math.cos(c.a), ny = Math.sin(c.a);   // shoot along the road, from behind
  p.x = c.x + nx * 220; p.y = c.y + ny * 220; w.rebuildGrid();
  // somebody standing on the far side of the car
  const victim = w.spawnActor('civ', c.x - nx * 60, c.y - ny * 60, { state: 'idle' }); w.rebuildGrid();
  w.addWeapon('kodiak'); w.equipWeapon('kodiak'); const wi = w.curWeapon(); wi.mag = 5;
  const ang = Math.atan2(c.y - p.y, c.x - p.x), hp0 = c.hp;
  w.aiming = true; w.P.recoil = 0;   // through the scope
  w.fireGun(p, W8.kodiak, wi, ang);
  for (let i = 0; i < 30; i++) w.updateProjectiles(1 / 60);
  check(c.hp < hp0 && c.hp > 0, `the car takes the hit but survives (${hp0} → ${c.hp.toFixed(0)})`);
  check(!victim.alive || victim.hp < victim.maxHp, 'the round goes through the car into the man behind it');
  const v2 = w.spawnActor('civ', c.x - nx * 60, c.y - ny * 60, { state: 'idle' }); w.rebuildGrid();
  w.addWeapon('p9'); w.equipWeapon('p9'); const pi = w.curWeapon(); pi.mag = 15;
  w.P.recoil = 0; w.fireGun(p, W8.p9, pi, ang); for (let i = 0; i < 30; i++) w.updateProjectiles(1 / 60);
  check(v2.alive && v2.hp === v2.maxHp, 'a 9 mm stops in the door panel');
}
console.log(`\n${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
