// underworld systems: node tools/crime.mjs
import fs from 'fs'; import vm from 'vm';
const ctx = { console, Math, Date, JSON, globalThis: null, KONTRAKT_LANG: process.env.KONTRAKT_LANG || 'de' }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['js/core/i18n.js','js/lang/de.js','js/core/util.js','js/core/data.js','js/world/citygen.js','js/world/nav.js','js/game/world.js','js/game/economy.js','js/game/combat.js','js/game/crime.js','js/game/ai.js','js/game/contracts.js','js/game/vehicles.js','js/game/player.js','js/game/underworld.js','js/game/police.js','js/game/criminals.js','js/game/heists.js','js/game/crew.js','js/game/gangs.js','js/game/autos.js','js/game/carservice.js','js/game/nightlife.js','js/game/hotbar.js','js/game/props.js','js/game/manhunt.js','js/game/medical.js','js/game/org.js','js/game/residents.js','js/game/services.js']) vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
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
  check(w.wanted >= 2 || w.P.jail, `silent alarm → 2 stars or already arrested (wanted=${w.wanted} jail=${!!w.P.jail})`);
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
console.log('9) heists: bank vault (keycard, C4) and the jeweler');
{
  const w = new K.World({ seed: 9 }); w.time = 11 * 60; w.godMode = true; w.thugT = 1e9;
  const p = w.player, bank = w.buildings.find((b) => b.type === 'bank');
  const dir = w.actors.find((a) => a.director && a.home === bank.id);
  check(dir && dir.loot === 'keycard', 'the bank director carries the vault keycard');
  const vd = bank.doors.find((d) => d.vault);
  check(vd && vd.locked && !w.hasAccess(dir, vd), 'vault door is sealed, even for staff');
  // stand at the vault door with a keycard
  const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, c]) => [vd.x + a, vd.y + c]).find(([i, j]) => w.bldAt((i + .5) * TILE, (j + .5) * TILE) === bank.id && !(bank.vault && i >= bank.vault.x && i < bank.vault.x + bank.vault.w && j >= bank.vault.y && j < bank.vault.y + bank.vault.h));
  p.x = (side[0] + 0.5) * TILE; p.y = (side[1] + 0.5) * TILE; w.rebuildGrid();
  for (const a of w.actors) if (a.kind === 'guard' || a.kind === 'staff') w.removeActor(a);
  w.updatePolice = () => {};   // this test is about the alarm, not about getting caught first
  let acts = w.contextActions();
  check(acts.some((o) => o.label.startsWith('Tresortür —')), 'needs a card, drill or C4');
  w.addItem('keycard'); acts = w.contextActions();
  const card = acts.find((o) => o.label.includes('Schlüsselkarte'));
  check(!!card, 'keycard prompt'); card.fn();
  check(!vd.locked && !w.P.inv.keycard, 'vault open, card used');
  check(w.wanted === 0, `no alarm yet (time lock delay, wanted=${w.wanted})`);
  const box = w.props.find((q) => q && q.k === 'deposit' && q.bld === bank.id);
  const m0 = w.P.money; w.lootDeposit(box);
  check(w.P.money > m0 && box.lootDay === w.today(), `deposit box looted (+$${w.P.money - m0})`);
  for (let i = 0; i < 60 * 60 && !(bank.alarmUntil > w.t); i++) run(w, 1);   // the time lock waits 20–45 s
  run(w, 2);
  check(w.wanted >= 3, `time-lock alarm → 3 stars (wanted=${w.wanted})`);
  check(w.cars.some((c) => c.unit && c.unit.mode !== 'patrol'), 'police units respond to the bank');
}
{
  const w = new K.World({ seed: 10 }); w.time = 11 * 60; w.godMode = true; w.thugT = 1e9;
  const bank = w.buildings.find((b) => b.type === 'bank'), vd = bank.doors.find((d) => d.vault);
  w.explode((vd.x + 0.5) * TILE, (vd.y + 1.2) * TILE, 70, 10, w.player);
  check(!vd.locked && vd.blown, 'C4 blows the vault door');
}
{
  const w = new K.World({ seed: 11 }); w.time = 12 * 60; w.godMode = true; w.thugT = 1e9;
  const p = w.player, jw = w.buildings.find((b) => b.type === 'jeweler');
  const sc = w.props.find((q) => q && q.k === 'showcase' && q.bld === jw.id);
  p.x = (sc.x + 0.5) * TILE; p.y = (sc.y + 1.5) * TILE; if (w.blockedTile(w.tileIdx(p.x, p.y), p)) p.y = (sc.y - 0.5) * TILE;
  w.rebuildGrid();
  const acts = w.contextActions(), sm = acts.find((o) => o.label === 'Vitrine einschlagen');
  check(!!sm, 'showcase prompt'); if (sm) sm.fn();
  check((w.P.inv.jewelry || 0) >= 2, `jewelry grabbed (${w.P.inv.jewelry})`);
  run(w, 60 * 8);
  check(w.wanted >= 2, `jeweler alarm → 2 stars (wanted=${w.wanted})`);
}
console.log('10) gangs & turf: found, spray, war, raid, income');
{
  const w = new K.World({ seed: 12 }); w.time = 12 * 60; w.godMode = true; w.thugT = 1e9;
  run(w, 2);
  const p = w.player; w.P.money = 20000;
  const spots = Object.values(w.turfSpots);
  check(spots.length >= 30, `tag spots across the city (${spots.length})`);
  check(Object.keys(K.GANGS).every(g => w.gangBlocks(g) > 0), 'each street gang holds turf');
  const free = spots.find(s => !w.turfOwner(s.key));
  const goTo = (s) => { p.x = (s.x + 0.5) * TILE; p.y = (s.y + 0.5) * TILE; w.rebuildGrid(); };
  goTo(free);
  check(w.contextActions().some(o => o.label.includes('gründe erst')), 'no gang yet → no claiming');
  check(w.foundGang('Rote Drachen', '#c8102e', null) && w.P.gang && w.P.inv.spray === 3, 'found a gang (fee paid, spray cans)');
  const sp = w.contextActions().find(o => o.label === 'Revier markieren (sprühen)');
  check(!!sp, 'spray prompt at a free tag spot'); sp.fn();
  check(w.turfOwner(free.key) === 'player' && w.playerBlocks() === 1, 'block claimed');
  const enemy = spots.find(s => w.turfOwner(s.key) === 'vipern');
  goTo(enemy);
  check(w.contextActions().some(o => o.label.includes('nur im Krieg')), 'enemy turf locked while at peace');
  check(w.declareWar('vipern'), 'declare war on the Vipern');
  const ov = w.contextActions().find(o => o.label.includes('übersprühen')); check(!!ov, 'overspray allowed at war'); ov.fn();
  check(w.turfOwner(enemy.key) === 'player', 'enemy block taken');
  // a Viper who sees you attacks
  let vx = p.x, vy = p.y;
  for (const [dx, dy] of [[4, 0], [-4, 0], [3, 0], [-3, 0], [0, 3], [0, -3], [3, 2], [-3, 2], [3, -2], [-3, -2]]) { const x = p.x + dx * TILE, y = p.y + dy * TILE; if (!w.blockedTile(w.tileIdx(x, y), null) && K.los(w, p.x, p.y, x, y)) { vx = x; vy = y; break; } }
  const v = w.spawnGangster('vipern', vx, vy); v.angle = Math.atan2(p.y - v.y, p.x - v.x); w.rebuildGrid();
  let hostile = false; for (let i = 0; i < 60 * 3 && !hostile; i++) { run(w, 1); hostile = v.state === 'hostile'; }
  check(hostile, 'at war, gang members attack on sight');
  // raid: force it
  K.GANGS.vipern.raidT = 0; p.x += 30 * TILE; p.hidden = true;
  let raided = false; for (let i = 0; i < 60 * 70 && !raided; i++) { run(w, 1); raided = w.playerBlocks() < 2; }
  check(raided, 'raiders spray over your turf');
  const b0 = w.P.bank || 0; w.time += 24 * 60; run(w, 2);
  check((w.P.bank || 0) > b0, `turf pays daily (+$${(w.P.bank || 0) - b0})`);
}
console.log(`\n${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
