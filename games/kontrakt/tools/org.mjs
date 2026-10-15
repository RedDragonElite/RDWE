// criminal organisation: rank, protection rackets, street dealers, business upgrades, gang skirmishes: node tools/org.mjs
import fs from 'fs'; import vm from 'vm';
const ctx = { console, Math, Date, JSON, globalThis: null, KONTRAKT_LANG: process.env.KONTRAKT_LANG || 'de' }; ctx.globalThis = ctx; vm.createContext(ctx);
const files = fs.readFileSync('tools/scenarios.mjs', 'utf8').match(/for \(const f of (\[[^\]]+\])/)[1];
for (const f of eval(files)) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
const K = ctx.K, TILE = 32, U = K.U;
let ok = 0, fail = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const run = (w, n, inp = {}) => { for (let i = 0; i < n; i++) { w.update(1 / 60, { pressed: {}, ...inp }); w.events.length = 0; } };
const mk = (seed = 1337) => { const w = new K.World({ seed }); w.time = 12 * 60; w.thugT = 1e9; w.godMode = true; w.updatePolice = () => {}; run(w, 60 * 2); return w; };

console.log('rank & reputation');
{
  const w = mk();
  check(w.orgRankName() === 'Straßenratte' && w.maxDealers() === 1, 'start: Straßenratte, one corner');
  w.addRep(200);
  check(w.orgRankName() === 'Soldat' && w.maxDealers() === 3, `200 rep → ${w.orgRankName()}, ${w.maxDealers()} corners`);
}
console.log('protection racket');
{
  const w = mk(), p = w.player, O = w.org();
  const shops = w.buildings.filter((b) => w.racketShop(b) && w.shopKeeper(b));
  check(shops.length >= 6, `${shops.length} shops you can lean on`);
  const b = shops[0], k = w.shopKeeper(b);
  p.x = k.x + 40; p.y = k.y; w.rebuildGrid();
  const acts = w.contextActions();
  check(acts.some((o) => o.key === 'T' && o.label.startsWith('Schutzgeld fordern')), 'prompt in the shop: "Schutzgeld fordern"');
  const c0 = w.racketChance(b, k); w.aiming = true; w.P.slot = 1; p.wi = w.curWeapon(); w.P.handsDown = false; const c1 = w.racketChance(b, k); w.aiming = false;
  check(c1 > c0, `drawing a gun makes them more willing (${c0.toFixed(2)} → ${c1.toFixed(2)})`);
  w.forceRacket = true; const m0 = w.P.money; w.demandProtection(b, k); w.forceRacket = false;
  check(O.racket[b.id] && w.P.money > m0, `${b.name} pays ${O.racket[b.id] && O.racket[b.id].rate} $/day — first rate on the spot`);
  w.time += 1440; run(w, 120);
  check(O.racket[b.id].owed === O.racket[b.id].rate, 'next day the money waits for you');
  const acts2 = w.contextActions();
  check(acts2.some((o) => o.label.startsWith('Schutzgeld kassieren')), '"Schutzgeld kassieren" at the counter');
  const m1 = w.P.money; w.collectProtection(b, k);
  check(w.P.money - m1 === O.racket[b.id].rate && O.racket[b.id].owed === 0, 'collected');
  for (let d = 0; d < 7; d++) { w.time += 1440; run(w, 30); }
  check(!O.racket[b.id], 'stay away for a week and they stop paying');
  // refusal → call the police
  const b2 = shops[1], k2 = w.shopKeeper(b2); w.forceRacket = false;
  let refused = 0; for (let n = 0; n < 30 && !refused; n++) { b2.racketNo = -1; if (!w.demandProtection(b2, k2)) refused++; else delete O.racket[b2.id]; }
  check(refused && b2.racketNo === w.today(), 'refused → no second try today');
}
console.log('street dealers');
{
  const w = mk(), p = w.player, O = w.org();
  let spot = null; for (const a of w.actors) if (a.kind === 'civ' && a.alive && w.bldAt(a.x, a.y) < 0 && w.tiles[w.tileIdx(a.x, a.y)] !== K.T.ROAD) { spot = a; break; }
  p.x = spot.x; p.y = spot.y; w.P.money = 5000;
  const rec = w.openCorner();
  check(rec && w.P.money === 5000 - K.ORG.dealerFee && w.actors.some((a) => a.dealer === rec.uid), 'corner opened, dealer stands there');
  check(!w.openCorner(), 'rank 1: only one corner');
  w.addItem('bud', 40); w.addItem('coke', 10); w.dealerGive(rec, 'bud', 99); w.dealerGive(rec, 'coke', 99);
  check(rec.stock.bud === 40 && rec.stock.coke === 10 && !w.P.inv.coke, 'product handed over');
  w.time = 23 * 60; const s0 = rec.sold;
  for (let h = 0; h < 4; h++) { w.time += 60; run(w, 70); if (rec.gone) break; }
  check(rec.gone || rec.sold > s0, `he sells through the night (${rec.sold} units, ${rec.cash} $ in the till)`);
  if (!rec.gone) { const m = w.P.money; w.dealerCollect(rec); check(w.P.money > m, 'cash collected'); } else check(true, '(busted in this run — that happens too)');
  // busts happen
  let busts = 0;
  for (let n = 0; n < 40; n++) { const r = { uid: 900 + n, name: 'X', x: rec.x, y: rec.y, stock: { coke: 5 }, cash: 0, sold: 0 }; O.dealers.push(r); for (let m = 0; m < 600; m++) w.dealerTick(r, 1); if (r.gone) busts++; else O.dealers = O.dealers.filter((d) => d !== r); }
  check(busts > 0 && busts < 40, `police raids now and then (${busts}/40 over 10 h)`);
  // far away: still simulated
  const r2 = { uid: 77, name: 'Far', x: rec.x, y: rec.y, stock: { bud: 200 }, cash: 0, sold: 0 }; O.dealers.push(r2);
  p.x += 80 * TILE; w.time += 1; run(w, 60); const sold0 = r2.sold; w.time += 240; run(w, 70);
  check(r2.gone || r2.sold > sold0, 'out of sight he keeps selling');
}
console.log('legal businesses');
{
  const w = mk(); w.P.money = 900000; w.buyProperty('diner');
  const inc0 = Math.round(w.propertyDef('diner').income * w.bizMult('diner')); const c = w.bizUpgradeCost('diner');
  check(w.bizUpgrade('diner') && w.bizMult('diner') > 1.2, `renovation: ${U.money(inc0)} → ${U.money(Math.round(w.propertyDef('diner').income * w.bizMult('diner')))} a day (cost ${U.money(c)})`);
  w.bizUpgrade('diner'); w.bizUpgrade('diner');
  check(!w.bizUpgrade('diner') && w.bizLevel('diner') === 3, 'three upgrades, then done');
}
console.log('gang war (NPC vs NPC)');
{
  const w = mk(); run(w, 10);
  const before = JSON.stringify(w.P.turf); let moves = 0;
  for (let n = 0; n < 30; n++) if (w.gangSkirmish()) moves++;
  check(moves > 5 && JSON.stringify(w.P.turf) !== before, `gangs take blocks off each other (${moves} of 30 skirmishes)`);
  check(!Object.keys(w.P.turf).some((k) => w.P.turf[k] === 'player' && JSON.parse(before)[k] !== 'player'), 'never takes your blocks without a war');
}
console.log(`\n${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
