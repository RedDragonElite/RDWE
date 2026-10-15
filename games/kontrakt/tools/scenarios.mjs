// AI behaviour scenarios: node tools/scenarios.mjs
import fs from 'fs'; import vm from 'vm';
const ctx = { console, Math, Date, JSON, globalThis: null, KONTRAKT_LANG: process.env.KONTRAKT_LANG || 'de' }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['js/core/i18n.js','js/lang/de.js','js/core/util.js','js/core/data.js','js/world/citygen.js','js/world/nav.js','js/game/world.js','js/game/economy.js','js/game/combat.js','js/game/crime.js','js/game/ai.js','js/game/contracts.js','js/game/vehicles.js','js/game/player.js','js/game/underworld.js','js/game/police.js','js/game/criminals.js','js/game/heists.js','js/game/crew.js','js/game/gangs.js','js/game/autos.js','js/game/carservice.js','js/game/nightlife.js','js/game/hotbar.js','js/game/props.js','js/game/manhunt.js','js/game/medical.js','js/game/org.js','js/game/residents.js','js/game/services.js']) vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
const K = ctx.K, TILE = 32;
let ok = 0, fail = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const run = (w, n, inp = {}) => { for (let i = 0; i < n; i++) { w.update(1/60, { pressed: {}, ...inp }); w.events.length = 0; } };
function villaSetup(seed) {
  const w = new K.World({ seed });
  w.time = 13 * 60; w.godMode = true;
  const z = w.zones.find(z => !z.dead && z.garden);
  const guards = w.actors.filter(a => a.kind === 'guard' && a.zone === z.id && a.alive);
  return { w, z, guards };
}
console.log('1) trespassing in a villa garden gets you warned, then shot at');
{
  let res = null;
  for (const seed of [11, 21, 31, 41, 51]) {
    const { w, z, guards } = villaSetup(seed);
    const p = w.player; w.P.slot = 0; p.wi = w.curWeapon();
    let g = null;
    for (const cand of guards) {
      for (let k = 0; k < 16 && !g; k++) {
        const a = k * 0.39, x = cand.x + Math.cos(a) * 90, y = cand.y + Math.sin(a) * 90;
        if (w.zoneAt(x, y) === z.id && !w.blockedTile(w.tileIdx(x, y), p) && K.los(w, cand.x, cand.y, x, y)) { p.x = x; p.y = y; cand.angle = a; cand.state = 'post'; cand.brain.post = { x: cand.x, y: cand.y }; cand.brain.face = a; g = cand; }
      }
      if (g) break;
    }
    if (!g) continue;
    let warned = false, hostile = false;
    for (let i = 0; i < 60 * 14 && !hostile; i++) { run(w, 1); if (g.state === 'warn') warned = true; if (g.state === 'hostile') hostile = true; }
    res = { warned, hostile }; break;
  }
  check(res && res.warned, 'guard warns the trespasser');
  check(res && res.hostile, 'guard turns hostile when you stay');
}
console.log('2) a guard disguise lets you walk past ordinary guards');
{
  const { w, z, guards } = villaSetup(12);
  const g = guards.find(g => !g.enforcer) || guards[0];
  for (const o of guards) if (o !== g) w.removeActor(o);
  w.setOutfit('guard', true);
  const p = w.player; g.brain.waitT = 30; g.state = 'patrol';
  p.x = g.x + Math.cos(g.angle) * 150; p.y = g.y + Math.sin(g.angle) * 150;
  if (w.zoneAt(p.x, p.y) !== z.id || w.blockedTile(w.tileIdx(p.x, p.y), p)) { p.x = g.x + 60; p.y = g.y; }
  w.P.slot = 0; p.wi = w.curWeapon();
  run(w, 60 * 6);
  check(g.state !== 'hostile' && g.state !== 'warn', `no reaction (state=${g.state}, susp=${g.susp.toFixed(2)})`);
}
console.log('3) a thrown coin lures a guard away');
{
  const { w, z, guards } = villaSetup(13);
  const g = guards[1] || guards[0];
  g.state = 'patrol'; g.brain.waitT = 30;
  let tx = g.x + 90, ty = g.y + 20;
  for (const [dx, dy] of [[90, 20], [-90, 20], [20, 90], [20, -90], [60, 60], [-60, -60], [-60, 60], [60, -60]]) { const pth = K.los(w, g.x, g.y, g.x + dx, g.y + dy) && !w.blockedTile(w.tileIdx(g.x + dx, g.y + dy), g) && w.nav.find(g, g.x, g.y, g.x + dx, g.y + dy); if (pth && pth.length < 7) { tx = g.x + dx; ty = g.y + dy; break; } }
  w.player.x = g.x - 400; w.player.y = g.y - 400; w.player.hidden = true;
  w.rebuildGrid(); w.noise(tx, ty, 7, 'coin', null);
  check(g.state === 'investigate', `guard investigates the noise (state=${g.state})`);
  const d0 = Math.hypot(tx - g.x, ty - g.y);
  let dmin = d0; for (let i = 0; i < 60 * 5; i++) { run(w, 1); dmin = Math.min(dmin, Math.hypot(tx - g.x, ty - g.y)); }
  check(dmin < d0 - 20, `guard walks toward the coin (${Math.round(d0)} → ${Math.round(dmin)})`);
}
console.log('4) a found body raises the alarm in the zone');
{
  const { w, z, guards } = villaSetup(14);
  const [a, b] = guards;
  w.player.x = 10; w.player.y = 10; w.player.hidden = true;
  w.kill(a, null, { kind: 'melee' });
  b.x = a.x - 60; b.y = a.y; b.angle = 0; b.state = 'patrol'; b.brain.waitT = 30;
  run(w, 60 * 2);
  check(a.found, 'body is found');
  check(z.alert > w.t, 'zone goes on alert');
  check(['search', 'investigate', 'hostile'].includes(b.state), `guard searches (state=${b.state})`);
}
console.log('5) shooting in public: witnesses call the police');
{
  const w = new K.World({ seed: 21 }); w.godMode = true; w.time = 12 * 60;
  run(w, 60 * 20);
  const civ = w.actors.find(a => a.kind === 'civ' && a.alive && !a.inCar);
  const p = w.player; p.x = civ.x - 70; p.y = civ.y; civ.angle = Math.PI; civ.state = 'idle'; civ.brain.t = 30;
  w.rebuildGrid(); w.P.slot = 1; p.wi = w.curWeapon(); w.forceCalls = true;
  w.attack(p, 0, true, true);
  run(w, 2);
  check(civ.state === 'flee' || civ.state === 'cower', `witness flees (state=${civ.state})`);
  w.forceCalls = true; p.x -= 12 * 32;   // walk off — standing next to a caller makes them hang up
  let wanted = 0; for (let i = 0; i < 60 * 12 && !wanted; i++) { run(w, 1); wanted = w.wanted; }
  check(wanted >= 1, `wanted level after report: ${wanted}`);
  const units = () => w.cars.filter(c => c.unit && c.unit.mode !== 'patrol' && !c.dead);
  let u = []; for (let i = 0; i < 60 * 5 && !u.length; i++) { run(w, 1); u = units(); }
  check(u.length > 0, `a police unit is dispatched (${u.length})`);
  const d0 = u.length ? Math.hypot(u[0].x - p.x, u[0].y - p.y) / TILE : 0;
  check(d0 > 8, `it starts out of sight (${Math.round(d0)} tiles)`);
  let arrived = false; for (let i = 0; i < 60 * 70 && !arrived; i++) { run(w, 1); arrived = w.cars.some(c => c.unit && c.unit.mode === 'onscene'); }
  check(arrived, 'unit drives in and deploys officers');
  check(!w.actors.some(a => a.kind === 'cop' && a.alive && !a.station && !a.unit), 'no officers appear out of thin air');
}
console.log('6) wire takedown from behind is silent and lethal');
{
  const { w, guards } = villaSetup(15);
  const g = guards[0]; for (const o of guards.slice(1)) w.removeActor(o);
  const p = w.player; g.state = 'post'; g.brain.post = { x: g.x, y: g.y }; g.brain.face = 0; g.angle = 0;
  p.x = g.x - 22; p.y = g.y; p.angle = 0; w.P.slot = w.P.weapons.findIndex(x => x.id === 'wire'); p.wi = w.curWeapon();
  w.rebuildGrid();
  check(w.tryTakedown(), 'takedown starts');
  run(w, 60 * 3);
  check(!g.alive && g.killInfo.silent, 'guard dead, silently');
  check(!g.bloody, 'no blood with the wire');
}
console.log('7) street criminals mug civilians; police respond against them, not you');
{
  let res = null;
  for (const seed of [17, 27, 37, 47]) {
    const w = new K.World({ seed }); w.time = 14 * 60; w.godMode = true; w.thugT = 1e9;
    const p = w.player; p.hidden = true;
    const t = w.spawnThug('mug'); if (!t) continue;
    let mugged = false, robbed = false, unit = false, stopped = false;
    for (let i = 0; i < 60 * 90 && !(unit && robbed) && !stopped; i++) {
      run(w, 1);
      if (t.state === 'mug') mugged = true;
      if (w.actors.some(c => c.robbed)) robbed = true;
      if (mugged && (t.state === 'cuffed' || !t.alive)) stopped = true;
      if (w.cars.some(c => c.unit && c.unit.foe === t.id)) unit = true;
    }
    res = { mugged, robbed, unit, stopped, wanted: w.wanted, w, t }; if (mugged) break;
  }
  check(res && res.mugged, 'a thug picks a victim and mugs them');
  check(res && (res.robbed || res.stopped), 'the victim loses their wallet (or police stop it first)');
  check(res && (res.unit || res.stopped), 'a police unit is dispatched against the thug');
  check(res && res.wanted === 0, `player stays clean (wanted=${res && res.wanted})`);
  if (res && res.t.alive && res.t.state !== 'cuffed') {
    const { w, t } = res; const p = w.player; p.hidden = false;
    t.crim = true; t.alive && (p.x = t.x - 20, p.y = t.y);
    const xp0 = w.P.xp + w.P.level * 1e6; w.hurt(t, 500, p, { kind: 'melee' }); run(w, 60 * 4);
    check(!t.alive && w.P.xp + w.P.level * 1e6 > xp0 && w.wanted === 0, `stopping a robber is rewarded, not a crime (wanted=${w.wanted})`);
  }
}
console.log('8) crew: hire, call, follow, ride along, fight, clinic');
{
  const w = new K.World({ seed: 23 }); w.time = 13 * 60; w.godMode = true; w.thugT = 1e9;
  const p = w.player; w.P.money = 1e6;
  const broker = w.actors.find(a => a.broker);
  check(!!broker, 'the broker waits in the bar');
  const offers = w.crewOffers();
  check(offers.length === 3 && offers.every(o => o.price > 0 && o.skills.shoot >= 5), 'three candidates with prices and skills');
  check(w.hireCrew(0) && w.hireCrew(1), 'hire two');
  const [m1, m2] = w.P.crew;
  check(w.callCrew(m1.id) && w.callCrew(m2.id), 'call them');
  const a1 = w.crewActor(m1);
  const d0 = Math.hypot(a1.x - p.x, a1.y - p.y) / TILE;
  check(d0 > 10, `they arrive from off-screen (${Math.round(d0)} tiles)`);
  let near = false; for (let i = 0; i < 60 * 40 && !near; i++) { run(w, 1); near = w.crewActors().every(a => Math.hypot(a.x - p.x, a.y - p.y) < 4 * TILE); }
  check(near, 'crew reaches you and falls into formation');
  // ride along
  const car = w.cars.find(c => !c.dead && c.kind !== 'police' && Math.hypot(c.x - p.x, c.y - p.y) < 30 * TILE) || w.spawnCar('police', p.x + 60, p.y, 0, { parked: true });
  if (car) {
    car.driver = null; car.speed = 0; car.vx = car.vy = 0; car.playerOwned = true;   // your own car — no theft
    for (const a of w.crewActors()) { a.x = car.x + 40; a.y = car.y + 10; }
    p.x = car.x; p.y = car.y + 30; w.enterCar(car); p.inCar = car.id; car.driver = 'player';
    let boarded = false; for (let i = 0; i < 60 * 12 && !boarded; i++) { run(w, 1); boarded = w.crewActors().every(a => a.inCar === car.id); }
    check(boarded, 'crew gets into your car');
    w.exitCar(true); run(w, 10);
    check(w.crewActors().every(a => !a.inCar), 'and out again when you get out');
  }
  // defend the boss: a hostile thug
  const ti = w.nav.nearestFree(w.tileIdx(p.x + 5 * TILE, p.y), null, 6);
  const t = w.spawnActor('thug', (ti % w.W + 0.5) * TILE, ((ti / w.W | 0) + 0.5) * TILE, { weapon: 'bat', state: 'prowl', outfit: 'hoodie' }); t.crim = true; w.alarm(t, p);
  w.rebuildGrid();
  for (let i = 0; i < 60 * 45 && t.alive && !(t.ko > 0); i++) run(w, 1);   // limb hits make fights last longer
  check(!t.alive || t.ko > 0, 'crew takes down the attacker');
  check(w.P.crew.some(m => m.kills > 0 || m.xp > 0), 'crew earns XP');
  check(w.wanted === 0, `defending you is not a crime (wanted=${w.wanted})`);
  // down → clinic
  const a2 = w.crewActor(m2); w.hurt(a2, 999, null, { kind: 'bullet' });
  check(m2.state === 'down' && m2.downUntil > w.time, 'a fallen crew member goes to the clinic');
  check(w.crewRevive(m2.id) && m2.state === 'idle', 'pay to get them out early');
  // wages
  const bank0 = w.P.money + (w.P.bank || 0); w.time += 24 * 60; run(w, 2);
  check(w.P.money + (w.P.bank || 0) < bank0, 'daily wages are paid');
}
console.log(`\n${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
