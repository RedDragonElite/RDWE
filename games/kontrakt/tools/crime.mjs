// underworld systems: node tools/crime.mjs
import fs from 'fs'; import vm from 'vm';
const ctx = { console, Math, Date, JSON, globalThis: null }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['js/core/util.js','js/core/data.js','js/world/citygen.js','js/world/nav.js','js/game/world.js','js/game/economy.js','js/game/combat.js','js/game/crime.js','js/game/ai.js','js/game/contracts.js','js/game/vehicles.js','js/game/player.js','js/game/underworld.js']) vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
const K = ctx.K, TILE = 32;
let ok = 0, fail = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const run = (w, n, inp = {}) => { for (let i = 0; i < n; i++) { w.update(1/60, { pressed: {}, ...inp }); w.events.length = 0; } };
const ev = (w, n, inp = {}) => { const out = []; for (let i = 0; i < n; i++) { w.update(1/60, { pressed: {}, ...inp }); out.push(...w.events); w.events.length = 0; } return out; };

console.log('1) surrender → cuffed → jail with a sentence → bail');
{
  const w = new K.World({ seed: 5 }); w.time = 12 * 60;
  run(w, 60 * 5);
  const p = w.player;
  w.raiseWanted(2, 'robbery');
  const cop = w.spawnCop(p.x + 60, p.y, 'hostile'); cop.brain.react = 9;
  w.rebuildGrid(); w.perceive(cop, 0.2);
  run(w, 1, { pressed: { x: true } });
  check(w.P.surrender, 'player surrenders');
  let jailed = null;
  for (let i = 0; i < 60 * 15 && !jailed; i++) { for (const e of ev(w, 1)) if (e.type === 'jailed') jailed = e; }
  check(!!jailed, `arrested (${jailed && jailed.min} min, bail ${jailed && jailed.bail})`);
  check(jailed && jailed.surrendered && jailed.charges.some((c) => c.k === 'robbery'), 'robbery charge on the sheet, surrender discount');
  check(w.P.outfit === 'prisoner' && w.bldAt(p.x, p.y) === w.policeBuilding().id, 'in prison clothes, in the station');
  run(w, 60);
  check(w.timeScale > 1, 'time runs fast inside');
  w.P.money = 1e6;
  check(w.payBail() && !w.P.jail && w.P.outfit !== 'prisoner', 'bail frees you');
}
console.log('2) serving the full sentence and a jailbreak');
{
  const w = new K.World({ seed: 6 }); w.time = 12 * 60;
  run(w, 30);
  w.raiseWanted(1, 'theft'); w.arrest();
  const until = w.P.jail.until;
  let rel = null; for (let i = 0; i < 60 * 60 && !rel; i++) for (const e of ev(w, 1)) if (e.type === 'released') rel = e;
  check(rel && rel.how === 'served' && w.time >= until, 'released after serving');
  w.raiseWanted(2, 'murder'); w.arrest();
  // walk out through an open door → escaped
  const b = w.policeBuilding(); w.player.x = (b.entrance.x + 0.5) * TILE; w.player.y = (b.entrance.y + 0.5) * TILE;
  run(w, 2);
  check(w.P.jail && w.P.jail.escaped && w.wanted >= 3, 'leaving the station = jailbreak, 3 stars');
}
console.log('3) pickpocketing and hold-ups');
{
  const w = new K.World({ seed: 7 }); w.time = 14 * 60; w.godMode = true;
  run(w, 60 * 20);
  const p = w.player;
  const v = w.actors.find((a) => a.kind === 'civ' && a.alive && !a.inCar && a.wallet > 0);
  v.wallet = 120; v.state = 'idle'; v.brain.t = 60; v.angle = 0; p.x = v.x - 22; p.y = v.y; w.rebuildGrid();
  const m0 = w.P.money; w.pickpocket(v);
  check(v.picked && (w.P.money > m0 || v.reportT || v.state === 'flee'), 'pickpocket resolved (cash or caught)');
  const k = w.actors.find((a) => a.kind === 'keeper' && w.buildings[a.home].shop === 'food');
  const b = w.buildings[k.home];
  const cc = b.counter, cxx = (cc.x + cc.w / 2) * TILE, cyy = (cc.y + cc.h / 2) * TILE, dd = Math.hypot(cxx - k.x, cyy - k.y) || 1; p.x = cxx + (cxx - k.x) / dd * 40; p.y = cyy + (cyy - k.y) / dd * 40; w.P.slot = 1; p.wi = w.curWeapon(); w.rebuildGrid();
  const ang = Math.atan2(k.y - p.y, k.x - p.x);
  run(w, 20, { aim: true, ax: k.x, ay: k.y });
  check(k.state === 'cower', `shopkeeper raises hands (state=${k.state})`);
  const m1 = w.P.money; w.robTill(b, k);
  check(w.P.money > m1 && b.tillDay === w.today(), `till robbed (+$${w.P.money - m1})`);
  run(w, 60 * 11);
  check(w.wanted >= 2, 'silent alarm → 2 stars');
}
console.log('4) grow, water, fertilise, harvest, deal');
{
  const w = new K.World({ seed: 8 }); w.time = 10 * 60;
  const p = w.player;
  w.addItem('seed', 2); w.addItem('growkit', 2); w.addItem('can'); w.addItem('fert');
  check(w.useItem('growkit'), 'planted at home');
  const pl = w.P.plants[0];
  w.tendPlant(pl); pl.f = 1;
  for (let h = 0; h < 18; h++) { w.updatePlants(60); pl.w = 100; }
  check(pl.g >= 1, `grown (q=${pl.q.toFixed(2)})`);
  w.tendPlant(pl);
  check(w.P.inv.bud > 10 && w.P.plants.length === 0, `harvested ${w.P.inv.bud}g`);
  w.time = 23 * 60;
  run(w, 60 * 10);
  let sold = 0, tries = 0;
  for (const c of w.actors) { if (c.kind !== 'civ' || !c.alive || c.inCar || tries > 25) continue; tries++; const before = w.P.inv.bud || 0; w.offerDrugs(c); if ((w.P.inv.bud || 0) < before) sold++; }
  check(sold > 0, `sold to ${sold}/${tries} passers-by, rep ${w.P.deal.rep}`);
  const bud = w.P.inv.bud || 0, m = w.P.money; w.sellItem('bud', bud);
  check(!bud || w.P.money > m, 'fence buys the rest');
}
console.log('5) masks, bank and ATMs');
{
  const w = new K.World({ seed: 9 }); w.time = 13 * 60;
  run(w, 30);
  w.addItem('mask'); w.useItem('mask');
  check(w.P.masked, 'mask on');
  w.raiseWanted(2, 'robbery');
  check(w.heat.anon, 'crime committed anonymously');
  for (const a of w.actors) a.seesPlayer = false;
  w.useItem('mask');
  check(w.wanted === 0, 'mask off unseen → wanted cleared');
  w.P.money = 1000; w.bankDeposit(800);
  check(w.P.money === 200 && w.P.bank === 800, 'deposit');
  check(w.buy('knife', 'gun') && w.P.money === 0 && w.P.bank === 650, 'card pays the rest at a legal shop');
  check(!w.buy('silber', 'black'), 'black market wants cash');
}
console.log(`\n${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
