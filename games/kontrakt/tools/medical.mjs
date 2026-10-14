// injuries & EMS: zones, bleeding, fractures, going down, ambulance, first aid: node tools/medical.mjs
import fs from 'fs'; import vm from 'vm';
const ctx = { console, Math, Date, JSON, globalThis: null }; ctx.globalThis = ctx; vm.createContext(ctx);
const files = fs.readFileSync('tools/scenarios.mjs', 'utf8').match(/for \(const f of (\[[^\]]+\])/)[1];
for (const f of eval(files)) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
const K = ctx.K, TILE = 32, U = K.U;
let ok = 0, fail = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const run = (w, n, inp = {}) => { for (let i = 0; i < n; i++) { w.update(1 / 60, { pressed: {}, ...inp }); w.events.length = 0; } };
const mk = (seed = 21) => { const w = new K.World({ seed }); w.time = 12 * 60; w.thugT = 1e9; w.updatePolice = () => {}; run(w, 60 * 2); return w; };
/** shoot fresh people until one goes down (critical) */
const downOne = (w, x, y, zone = 'torso') => { for (let k = 0; k < 60; k++) { const a = w.spawnActor('civ', x, y, { state: 'idle' }); a.hp = 5; w.hurt(a, 10, null, { kind: 'bullet', zone }); if (a.downed) return a; w.removeActor(a); } return null; };
const civOut = (w) => w.actors.find((a) => a.kind === 'civ' && a.alive && !a.inCar && w.bldAt(a.x, a.y) < 0);

console.log('hit zones');
{
  const w = mk(), z = {};
  for (let k = 0; k < 400; k++) { const r = w.hitZone({ kind: 'civ' }, { kind: 'bullet' }); z[r] = (z[r] || 0) + 1; }
  check(z.torso > 180 && (z.armL + z.armR) > 50 && (z.legL + z.legR) > 60, `bullets land on torso/arms/legs (${JSON.stringify(z)})`);
  const a = civOut(w), b = w.actors.filter((q) => q.kind === 'civ' && q.alive && q !== a)[0];
  a.hp = b.hp = 100; w.hurt(a, 30, null, { kind: 'bullet', zone: 'armL' }); w.hurt(b, 30, null, { kind: 'bullet', zone: 'torso' });
  check(100 - a.hp < 100 - b.hp, `an arm hit hurts less than the torso (${100 - a.hp} vs ${100 - b.hp})`);
  const c = w.spawnActor('civ', a.x + 40, a.y, { armor: 100 }); w.hurt(c, 40, null, { kind: 'bullet', zone: 'legR' });
  check(c.armor === 100 && c.hp < 100, 'the vest doesn\'t cover the legs');
}
console.log('bleeding & fractures (you)');
{
  const w = mk(), p = w.player; w.difficulty = 1;
  let frac = 0, art = 0;
  for (let k = 0; k < 60; k++) { p.inj = null; p.bleed = 0; p.hp = 100; w.hurt(p, 45, null, { kind: 'bullet', zone: 'legL' }); if (p.inj.frac.legL) frac++; if (p.inj.artery) art++; }
  check(frac > 8 && frac < 40, `heavy leg hits break the leg sometimes (${frac}/60)`);
  check(art > 2 && art < 30, `…or hit the artery (${art}/60)`);
  p.inj = { wounds: { legL: 1 }, frac: { legL: true }, artery: 'legL' }; p.bleed = 2; p.hp = 100;
  let spot = null;
  for (let i = 0; i < w.W * w.H && !spot; i++) { const tx = i % w.W, ty = (i / w.W) | 0; if (tx > 5 && tx < w.W - 30 && ty > 5 && ty < w.H - 5 && [...Array(14).keys()].every((k) => w.tiles[ty * w.W + tx + k] === K.T.ROAD && !w.solid[ty * w.W + tx + k])) spot = [tx, ty]; }
  const home = () => { p.x = (spot[0] + 1.5) * TILE; p.y = (spot[1] + 0.5) * TILE; };
  home(); const x0 = p.x; run(w, 60, { right: true }); const limp = p.x - x0;
  w.addItem('bandage'); w.useItem('bandage');
  check(p.bleed >= 1.2, `a bandage can't hold an artery (bleed ${p.bleed.toFixed(1)})`);
  w.addItem('tourniquet'); w.useItem('tourniquet');
  check(!p.inj.artery && p.bleed < 1, 'a tourniquet does');
  w.addItem('splint'); w.useItem('splint');
  home(); const x1 = p.x; run(w, 60, { right: true }); const fine = p.x - x1;
  check(limp < fine * 0.75, `broken leg limps (${limp.toFixed(0)} vs ${fine.toFixed(0)} px/s after the splint)`);
  w.P.money = 5000; p.inj = { wounds: { torso: 2 }, frac: { armR: true }, artery: null }; w.heal();
  check(!p.inj, 'the clinic stitches and sets everything');
}
console.log('going down (NPCs)');
{
  const w = mk(); let down = 0, dead = 0;
  for (let k = 0; k < 40; k++) { const a = w.spawnActor('civ', w.player.x + 300, w.player.y, { state: 'idle' }); a.hp = 20; w.hurt(a, 30, w.player, { kind: 'bullet', zone: 'torso' }); if (a.downed) down++; else if (!a.alive) dead++; w.removeActor(a); }
  check(down > 15 && dead > 3, `a fatal torso hit: often critical, sometimes dead (${down} down / ${dead} dead)`);
  const h = w.spawnActor('civ', w.player.x + 300, w.player.y, { state: 'idle' }); h.hp = 20; w.hurt(h, 60, w.player, { kind: 'bullet', head: true });
  check(!h.alive, 'a big headshot kills outright');
  w.spawnTraffic = () => null; for (const c of w.cars) if (c.driver && c.driver !== 'player') { c.vx = c.vy = 0; c.driver = null; }   // nobody runs them over in this test
  const a = downOne(w, w.player.x + 600, w.player.y + 40);
  check(a.alive && a.ko > 0 && a.downed.rate >= 0.5 && a.downed.rate <= 1.6, `lying there, bleeding ${a.downed.rate.toFixed(2)} %/s`);
  w.emsCalls = []; run(w, 60 * 20);
  check(a.downed && a.downed.loss > 8, `blood loss climbs (${a.downed && a.downed.loss.toFixed(0)} %)`);
  a.downed.loss = 99.5; run(w, 60);
  check(!a.alive, 'at 100 % it\'s over');
  // finishing shot
  const f = downOne(w, w.player.x + 500, w.player.y);
  w.hurt(f, 20, null, { kind: 'bullet' });
  check(!f.alive, 'another bullet into someone lying there kills them');
}
console.log('first aid');
{
  const w = mk(), p = w.player;
  const a = downOne(w, p.x + 20, p.y, 'legL');
  w.emsCalls = []; w.rebuildGrid(); delete w.P.inv.bandage; delete w.P.inv.medkit; delete w.P.inv.tourniquet;
  const acts = w.contextActions();
  check(!acts.some((o) => o.label.startsWith('Erste Hilfe')), 'no kit, no first aid');
  w.addItem('bandage'); const acts2 = w.contextActions();
  check(acts2.some((o) => o.label.startsWith('Erste Hilfe')), 'with a bandage: "Erste Hilfe"');
  w.firstAid(a); const l0 = a.downed.loss; run(w, 60 * 5);
  check(a.downed.stab && a.downed.loss === l0 && !w.P.inv.bandage, 'stabilised: the bleeding stops');
  run(w, 60 * 25);
  check(!a.downed && a.alive && a.ko === 0, 'and after a while they get up');
}
console.log('ambulance');
{
  const w = mk(7), p = w.player;
  let a = null; for (let k = 0; k < 30 && !a; k++) { const c = civOut(w); if (c && Math.hypot(c.x - p.x, c.y - p.y) < 25 * TILE) a = c; else run(w, 30); }
  a = a || civOut(w);
  a = downOne(w, a.x, a.y);
  w.emsCalls = []; a.downed.rate = 0.5;
  const amb = w.dispatchEMS(a, false);
  check(amb && amb.kind === 'ambulance' && amb.siren && amb.unit.crew.length === 2, 'an ambulance with two paramedics sets off, siren on');
  p.x = a.x + 3 * TILE; p.y = a.y; p.hidden = true;
  let arrived = false, revived = false, n = 0;
  for (; n < 60 * 150 && !revived; n++) { run(w, 1); if (amb.unit.mode === 'onscene') arrived = true; if (!a.downed && a.alive) revived = true; }
  check(arrived, `it gets there on the roads (${(n / 60).toFixed(0)} s)`);
  check(revived, 'the paramedics treat on scene — patient up');
  run(w, 60 * 20);
  check(['leave', 'onscene'].includes(amb.unit.mode) || amb.dead || !w.cars.includes(amb), `…and drive off again (${amb.unit.mode})`);
}
console.log('you, critical');
{
  const w = mk(), p = w.player; w.P.money = 3000;
  p.hp = 10; w.hurt(p, 30, null, { kind: 'bullet', zone: 'torso' });
  check(p.downed && p.alive && p.ko > 0, 'you go down instead of dying');
  const acts = (run(w, 1), w.ctx || []);
  check(acts.some((o) => o.key === 'E' && o.label.startsWith('Rettungswagen')), '[E] call an ambulance');
  const m0 = w.P.money; run(w, 1, { pressed: { e: true } });
  check(w.P.money < m0 && w.cars.some((c) => c.kind === 'ambulance' && c.unit.ems === p.id), `112 called, paid ${m0 - w.P.money} $`);
  p.downed.loss = 99.9; run(w, 120);
  check(p.alive && p.downed && p.downed.loss < 100, 'while it\'s on the way you hang on');
  const w2 = mk(); const p2 = w2.player; p2.hp = 5; w2.hurt(p2, 30, null, { kind: 'bullet', zone: 'torso' });
  run(w2, 60 * 5, { pressed: { x: true } });
  check(p2.downed, 'no giving up in the first 20 s');
  run(w2, 60 * 17); run(w2, 2, { pressed: { x: true } });
  check(!p2.alive, '[X] after 20 s: give up → clinic');
  const w3 = mk(); const p3 = w3.player; w3.wanted = 2; p3.hp = 5; w3.hurt(p3, 30, null, { kind: 'bullet', zone: 'torso' });
  const cop = w3.spawnCop(p3.x + 60, p3.y, 'hostile'); cop.seesPlayer = true; w3.alarm(cop, p3);
  for (let i = 0; i < 60 * 15 && !w3.P.jail; i++) run(w3, 1);
  check(!!w3.P.jail && !p3.downed, 'police cuff you on the ground — treated in custody');
}
console.log(`\n${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
