// headless simulation smoke test: node tools/sim.mjs
import fs from 'fs'; import vm from 'vm';
const ctx = { console, Math, Date, JSON, globalThis: null, performance: { now: () => Date.now() } }; ctx.globalThis = ctx; vm.createContext(ctx);
const files = ['js/core/util.js','js/core/data.js','js/world/citygen.js','js/world/nav.js','js/game/world.js','js/game/economy.js','js/game/combat.js','js/game/crime.js','js/game/ai.js','js/game/contracts.js','js/game/vehicles.js','js/game/player.js','js/game/underworld.js','js/game/police.js','js/game/criminals.js','js/game/heists.js','js/game/crew.js','js/game/gangs.js','js/game/autos.js','js/game/carservice.js','js/game/nightlife.js','js/game/hotbar.js','js/game/props.js','js/game/manhunt.js','js/game/medical.js'];
for (const f of files) vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
const K = ctx.K;
let ok = 0, fail = 0;
const check = (c, m) => { if (c) ok++; else { fail++; console.log('FAIL', m); } };
const w = new K.World({ seed: 777 });
console.log('actors', w.actors.length, 'player', Math.round(w.player.x), Math.round(w.player.y), 'district', w.districtAt(w.player.x, w.player.y));
const dt = 1/60;
let t0 = Date.now();
const types = {};
const inp = (o={}) => ({ pressed: {}, ...o });
for (let i = 0; i < 60*60; i++) { w.update(dt, inp({ ax: w.player.x + 100, ay: w.player.y })); for (const e of w.events) { types[e.type]=(types[e.type]||0)+1; if (e.type==='playerDead') console.log('player died', e.kind); if (e.type==='wanted') console.log('wanted', JSON.stringify(e), K.U.clock(w.time), JSON.stringify(w.actors.filter(a=>a.wit).map(a=>[a.kind,a.wit.type]))); } w.events.length = 0; }
console.log('60s sim ms', Date.now()-t0, 'actors', w.actors.length, 'cars', w.cars.length, 'time', K.U.clock(w.time));
console.log('events', JSON.stringify(types));
check(w.actors.filter(a=>a.kind==='civ').length > 10, 'civilians spawned');
check(w.cars.length > 3, 'traffic spawned');
check(w.offers.length === 3, 'offers arrived');
// walk out of the house
const p = w.player;
const sx = p.x, sy = p.y;
let maxd = 0;
for (const dir of ['down','up','left','right']) for (let i = 0; i < 40; i++) { w.update(dt, inp({ [dir]: true, ax: p.x, ay: p.y+100 })); w.events.length=0; maxd = Math.max(maxd, Math.hypot(p.x-sx,p.y-sy)); }
console.log('walked', Math.round(maxd), 'px');
check(maxd > 30, 'player can move');
// shoot a civilian
const civ = w.actors.find(a => a.kind==='civ' && a.alive);
p.x = civ.x - 60; p.y = civ.y; w.rebuildGrid(); w.P.slot = 1; p.wi = w.curWeapon();
let fired = 0;
for (let i = 0; i < 90; i++) { const pr = i%12===0 ? {fire:true} : {}; w.update(dt, inp({ ax: civ.x, ay: civ.y, pressed: pr })); for (const e of w.events) if (e.type==='shot') fired++; w.events.length=0; if (!civ.alive) break; }
console.log('fired', fired, 'civ alive', civ.alive, 'hp', Math.round(civ.hp), 'wanted', w.wanted);
check(fired > 0, 'gun fires');
w.godMode = true; console.log('player alive before contract', p.alive);
if (!p.alive) w.respawnAtHospital();
// accept a contract & teleport to target
const c = w.offers[0]; w.acceptContract(c);
const tg = w.targetActor(); check(!!tg, 'target spawned');
console.log('target', tg.name, 'at', w.buildings[c.stops[0]].type, 'guards', c.guards, 'reward', c.reward);
for (let i = 0; i < 600; i++) { w.update(dt, inp()); w.events.length=0; }
// kill target with a takedown from behind
w.wanted = 0;
for (let tries = 0; tries < 3 && tg.alive; tries++) {
  p.x = tg.x - Math.cos(tg.angle) * 24; p.y = tg.y - Math.sin(tg.angle) * 24; p.angle = tg.angle; w.P.slot = w.P.weapons.findIndex(x=>x.id==='wire'); w.rebuildGrid();
  tg.state = 'routine'; tg.seesPlayer = false;
  const okTd = w.tryTakedown();
  for (let i = 0; i < 200; i++) { w.update(dt, inp({ ax: tg.x, ay: tg.y })); w.events.length=0; }
  console.log('takedown started', okTd, 'target alive', tg.alive);
}
check(!tg.alive, 'target killed');
let done = null;
for (let i = 0; i < 600 && !done; i++) { w.update(dt, inp()); for (const e of w.events) if (e.type==='contractDone') done = e; w.events.length=0; }
check(!!done, 'contract finished');
if (done) console.log('rating', done.rating, 'pay', done.pay, done.lines.map(l=>l.t+':'+l.v).join(' | '));
// car: enter nearest car and drive
const car = w.cars.find(c=>!c.dead && !c.display && c.driver); p.x = car.x; p.y = car.y + 30; w.rebuildGrid(); w.enterCar(car); car.belt = true;
const cx = car.x, cy = car.y;
for (let i = 0; i < 180; i++) { w.update(dt, inp({ up: true })); w.events.length=0; }
console.log('drove', Math.round(Math.hypot(car.x-cx, car.y-cy)), 'speed', Math.round(car.speed), car.kind, 'eng', car.engineOn, car.fuel && car.fuel.toFixed(0), 'in', p.inCar === car.id, 'stun', p.stun);
check(p.inCar === car.id, 'in car');
w.exitCar(true); check(!p.inCar, 'exit car');
// long run stability: 5 game hours
t0 = Date.now();
let errs = 0;
for (let i = 0; i < 60*60*5; i++) { try { w.update(dt, inp({ ax: p.x+50, ay: p.y })); } catch (e) { errs++; if (errs < 3) console.log(e.stack); } w.events.length=0; }
console.log('5 min sim ms', Date.now()-t0, 'actors', w.actors.length, 'errors', errs, 'time', K.U.clock(w.time), 'wanted', w.wanted, 'alive', p.alive);
check(errs === 0, 'no runtime errors');
// save roundtrip
const s = JSON.stringify(w.serialize());
const w2 = new K.World({ seed: 777, save: JSON.parse(s) });
check(w2.P.money === w.P.money, 'save roundtrip');
console.log(`\n${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
