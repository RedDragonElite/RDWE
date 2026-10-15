/* RDE // KONTRAKT — owning cars. Autohaus (buy), rde_fuel-style pumps (nozzle, hose, pump display),
 * rde_mechanic-style workshop (repair with a mechanic at the hood, full tuning with preview) and the
 * rde_carservice phone app (valet delivers a stored car to you or drives one back to the garage). */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE;

  // ------------------------------------------------------------------ tuning catalogue (prices × class multiplier)
  const COLORS = [
    ['Klassik', [['Schwarz', '#111214'], ['Weiß', '#e6e6e0'], ['Rot', '#c8102e'], ['Blau', '#1f3b63'], ['Gelb', '#f2c200'], ['Grün', '#1d4d2b'], ['Orange', '#e0651a'], ['Silber', '#a9b0b8']]],
    ['Matt', [['Mattschwarz', '#1d1e20'], ['Oliv', '#4e5a3a'], ['Wüstensand', '#b59a6b'], ['Mattgrau', '#5a5d61']]],
    ['Metallic', [['Bordeaux', '#6b0f1e'], ['Petrol', '#0f4d5c'], ['Champagner', '#c8b07a'], ['Midnight', '#1a2340']]],
    ['Spezial', [['Neongrün', '#39ff14'], ['Hot Pink', '#ff2fa0'], ['Lila', '#6a2ea8'], ['Babyblau', '#8fd0ff']]],
    ['Chrom', [['Chrom', '#d8dde3'], ['Gold', '#d4af37']]],
  ];
  const NEON = [['Weiß', '#ffffff'], ['Electric Blue', '#0ae0ff'], ['Mint', '#3dffb5'], ['Lime', '#a6ff00'], ['Gelb', '#ffe400'], ['Golden', '#ffb000'], ['Orange', '#ff6a00'], ['Rot', '#ff1a1a'], ['Pony Pink', '#ff6ad5'], ['Hot Pink', '#ff00a0'], ['Lila', '#b000ff'], ['Blacklight', '#5b00ff'], ['Ice Blue', '#9fe8ff'], ['Grün', '#00ff3c']];
  const lv = (n, label = 'Stufe') => [{ v: 0, name: 'Serie' }].concat(Array.from({ length: n }, (_, i) => ({ v: i + 1, name: `${label} ${i + 1}` })));
  K.TUNING = [
    { cat: 'perf', icon: '⚙️', name: 'Leistung', col: '#f59e0b', parts: [
      { id: 'engine', name: 'Motor', price: 2500, opts: lv(4), desc: '+8% Beschleunigung, +4% Spitze pro Stufe' },
      { id: 'trans', name: 'Getriebe', price: 2000, opts: lv(3) },
      { id: 'brakes', name: 'Bremsen', price: 1500, opts: lv(3) },
      { id: 'susp', name: 'Fahrwerk', price: 1800, opts: lv(3) },
      { id: 'armor', name: 'Panzerung', price: 3000, opts: lv(4), desc: '−15% Schaden pro Stufe' },
      { id: 'turbo', name: 'Turbo', price: 5000, opts: [{ v: 0, name: 'Ohne' }, { v: 1, name: 'Turbo + Blow-off-Ventil' }, { v: 2, name: 'Turbo, flatternd (ohne Ventil)' }], desc: 'Pfeift beim Hochdrehen, zischt oder flattert beim Schalten und Gaswegnehmen' },
      { id: 'exhaust', name: 'Auspuff', price: 1800, opts: [{ v: 0, name: 'Serie' }, { v: 1, name: 'Sportauspuff' }, { v: 2, name: 'Straight Pipe', p: 3200 }], desc: 'Lauter, rauer, knallt beim Gaswegnehmen' },
      { id: 'tires', name: 'Reifen', price: 2000, opts: [{ v: 0, name: 'Serie' }, { v: 'sport', name: 'Sportreifen', p: 2000 }, { v: 'drift', name: 'Driftreifen', p: 3500 }, { v: 'bulletproof', name: 'Kugelsicher', p: 4500 }] },
      { id: 'nitro', name: 'Nitro', price: 7500, opts: [{ v: 0, name: 'Ohne' }, { v: 1, name: 'NOS-System' }], desc: 'Shift im Auto: Boost' },
    ] },
    { cat: 'paint', icon: '🎨', name: 'Lack', col: '#ec4899', parts: [
      { id: 'color', name: 'Primärfarbe', price: 800, opts: COLORS.flatMap(([g, l]) => l.map(([n, c]) => ({ v: c, name: n, group: g, finish: g === 'Matt' ? 'matte' : g === 'Chrom' ? 'chrome' : g === 'Metallic' ? 'metal' : '' }))) },
      { id: 'color2', name: 'Streifen / Zweitfarbe', price: 800, opts: [{ v: 0, name: 'Keine' }].concat(COLORS.flatMap(([, l]) => l.map(([n, c]) => ({ v: c, name: n })))) },
      { id: 'rims', name: 'Felgen', price: 1200, opts: [{ v: 0, name: 'Serie' }, { v: '#c9ced4', name: 'Chrom' }, { v: '#d4af37', name: 'Gold' }, { v: '#111214', name: 'Schwarz' }, { v: '#c8102e', name: 'Rot' }, { v: '#0ae0ff', name: 'Blau' }] },
    ] },
    { cat: 'light', icon: '💡', name: 'Licht', col: '#fbbf24', parts: [
      { id: 'xenon', name: 'Xenon', price: 1000, opts: [{ v: 0, name: 'Halogen' }, { v: '#e8f2ff', name: 'Xenon Weiß' }, { v: '#7fb2ff', name: 'Xenon Blau' }, { v: '#ffe08a', name: 'Xenon Gelb' }, { v: '#c79bff', name: 'Xenon Lila' }] },
      { id: 'neon', name: 'Neon-Unterboden', price: 1500, opts: [{ v: 0, name: 'Aus' }].concat(NEON.map(([n, c]) => ({ v: c, name: n }))) },
    ] },
    { cat: 'body', icon: '🏁', name: 'Karosserie', col: '#60a5fa', parts: [
      { id: 'spoiler', name: 'Spoiler', price: 500, opts: [{ v: 0, name: 'Ohne' }, { v: 1, name: 'Lippe' }, { v: 2, name: 'Flügel' }, { v: 3, name: 'GT-Flügel' }] },
      { id: 'hood', name: 'Motorhaube', price: 600, opts: [{ v: 0, name: 'Serie' }, { v: 1, name: 'Lufthutze' }, { v: 2, name: 'Carbon' }] },
      { id: 'tint', name: 'Scheibentönung', price: 500, opts: [{ v: 0, name: 'Keine' }, { v: 1, name: 'Light Smoke' }, { v: 2, name: 'Dark Smoke' }, { v: 3, name: 'Limo' }, { v: 4, name: 'Pure Black' }, { v: 5, name: 'Grün' }] },
      { id: 'horn', name: 'Hupe', price: 500, opts: [{ v: 0, name: 'Serie' }, { v: 1, name: 'Dreiklang' }, { v: 2, name: 'Truck' }, { v: 3, name: 'Fanfare' }] },
    ] },
    { cat: 'weap', icon: '🔫', name: 'Bordwaffen', col: '#ef4444', parts: [
      { id: 'mg', name: 'Maschinengewehr', price: 25000, opts: [{ v: 0, name: 'Ohne' }, { v: 1, name: 'Zwillings-MG' }], desc: 'LMB im Auto' },
      { id: 'rockets', name: 'Raketen', price: 35000, opts: [{ v: 0, name: 'Ohne' }, { v: 1, name: 'Raketenwerfer' }], desc: 'RMB im Auto' },
    ] },
  ];
  K.tunePrice = (c, part, opt) => Math.round((opt.p || part.price) * K.carCls(c).mult / 10) * 10;
  K.FUEL = { tick: 0.6, pct: 2.5, perPct: 1.6, jerry: 35, jerryFill: 50 };
  K.SERVICE = { deliver: 750, pickup: 500, insure: 0.15 };
  const plate = () => 'KR-' + String.fromCharCode(65 + U.rint(26)) + String.fromCharCode(65 + U.rint(26)) + ' ' + (100 + U.rint(900));

  K.mixin({
    // ============================================================ owned cars
    ownedCars() { return this.P.cars || (this.P.cars = []); },
    ownRec(c) { return c && c.ownId ? this.ownedCars().find((r) => r.id === c.ownId) : null; },
    worldCarOf(r) { return this.cars.find((c) => c.ownId === r.id && !c.dead); },
    /** copy the live car into its record (for saving) */
    syncOwned() {
      for (const r of this.ownedCars()) {
        if (r.state !== 'out') continue;
        const c = this.worldCarOf(r);
        if (!c) { if (!this.cars.some((q) => q.ownId === r.id)) continue; r.state = 'destroyed'; continue; }
        Object.assign(r, { x: c.x, y: c.y, a: c.a, color: c.color, tune: c.tune, fuel: c.fuel, eng: c.eng, bodyHP: c.bodyHP, hp: c.hp, tires: c.tires.slice(), dents: c.dents.slice(), crack: c.crack, lightsOK: c.lightsOK.slice(), odo: c.odo, tank: c.tank });
      }
    },
    /** a car you had tuned is yours now: it goes into the garage list and is saved like a bought one */
    adoptCar(c) {
      if (c.ownId || c.display || c.kind === 'police' || c.kind === 'ambulance' || c.svc) return null;
      const P = this.P, M = K.CARMODELS[c.kind]; P.carSeq = (P.carSeq || 0) + 1;
      c.plate = c.plate || plate();
      const r = { id: P.carSeq, kind: c.kind, name: M ? M.name : c.kind, color: c.color, plate: c.plate, tune: c.tune || {}, fuel: c.fuel ?? 100, state: 'out', x: c.x, y: c.y, a: c.a, bought: this.today(), stolen: !c.owned };
      this.ownedCars().push(r);
      c.owned = true; c.ownId = r.id; c.playerOwned = true;
      this.notify(`In deinen Fuhrpark übernommen — Kennzeichen ${r.plate}. Tuning bleibt gespeichert.`, 'good');
      return r;
    },
    spawnOwned(r, x, y, a) {
      const c = this.spawnCar(r.kind, x, y, a, { color: r.color, parked: true });
      c.owned = true; c.ownId = r.id; c.plate = r.plate; c.tune = r.tune || {};
      for (const k of ['fuel', 'eng', 'bodyHP', 'hp', 'crack', 'odo', 'tank']) if (r[k] != null) c[k] = r[k];
      if (r.tires) c.tires = r.tires.slice(); if (r.dents) c.dents = r.dents.slice(); if (r.lightsOK) c.lightsOK = r.lightsOK.slice();
      c.engineOn = false; c.nos = c.tune.nitro ? 100 : 0;
      r.state = 'out'; r.x = x; r.y = y; r.a = a;
      return c;
    },
    buyCar(kind, color) {
      const M = K.CARMODELS[kind]; if (!M || M.hidden) return false;
      const b = this.buildings.find((q) => q.type === 'autohaus');
      if (!this.pay(M.price)) { this.notify('Nicht genug Geld (Bargeld + Konto).', 'bad'); return false; }
      const P = this.P; P.carSeq = (P.carSeq || 0) + 1;
      const r = { id: P.carSeq, kind, name: M.name, color: color || K.CARK[kind].colors[0], plate: plate(), tune: {}, fuel: 100, state: 'stored', bought: this.today() };
      this.ownedCars().push(r);
      if (b && b.delivery) {
        const x = (b.delivery.x + 0.5) * TILE, y = (b.delivery.y + 0.5) * TILE;
        for (const q of this.cars) if (!q.dead && !q.owned && Math.hypot(q.x - x, q.y - y) < 90) this.despawnCar(q);
        this.spawnOwned(r, x, y, b.delivery.a);
        this.emit('waypoint', { x, y });
      }
      this.emit('sfx', { s: 'purchase' });
      this.emit('banner', { title: M.name.toUpperCase(), sub: `Gehört dir · Kennzeichen ${r.plate} · steht vor dem Autohaus`, kind: 'gold' });
      return r;
    },
    /** display cars in the showroom lot, one model per spot */
    spawnDisplayCars() {
      if (this.displayDone || !this.city.carSpots) return;
      this.displayDone = true;
      const order = ['super', 'sport', 'muscle', 'ev', 'coupe', 'suv'];
      this.city.carSpots.forEach((s, i) => {
        const kind = order[(i + this.today()) % order.length];
        const c = this.spawnCar(kind, (s.x + 0.5) * TILE, (s.y + 0.5) * TILE, s.a, { parked: true });
        c.display = kind; c.engineOn = false; c.fuel = 100;
      });
    },

    // ============================================================ fuel (rde_fuel)
    pumpNear() { return this.propNear(['pump'], 1.3); },
    fuelContext(add) {
      const P = this.P, a = this.player;
      const pump = this.pumpNear();
      if (P.nozzle) {
        const np = this.props[P.nozzle.prop];
        if (P.fueling) { add('E', `Tanken stoppen (${U.money(P.fueling.cost)})`, () => this.stopFueling()); return true; }
        const c = this.carNear(a);
        if (c && Math.hypot(c.x - a.x, c.y - a.y) < c.l / 2 + 26) {
          if (K.carModel(c).ev) add('E', 'Elektroauto — tankt keinen Sprit', null);
          else if (c.fuel >= 99.5) add('E', 'Tank ist voll', null);
          else add('E', `Zapfpistole einstecken (${Math.round(c.fuel)}%)`, () => this.startFueling(c));
        }
        if (pump && np && pump.id === np.id) add('T', 'Zapfpistole einhängen', () => this.hangNozzle());
        return true;
      }
      if (!pump) return false;
      add('E', 'Zapfpistole nehmen', () => { P.nozzle = { prop: pump.id, x: (pump.x + 0.5) * TILE, y: (pump.y + 0.5) * TILE }; this.emit('sfx', { s: 'nozzle' }); this.emit('pump', { on: true }); });
      if (P.inv.jerryempty) add('T', `Kanister füllen (${U.money(K.FUEL.jerryFill)})`, () => { if (!this.pay(K.FUEL.jerryFill)) return this.notify('Nicht genug Geld.', 'bad'); this.takeItem('jerryempty'); this.addItem('jerrycan'); this.emit('sfx', { s: 'pour' }); this.notify('Kanister gefüllt.'); });
      return true;
    },
    startFueling(c) { this.P.fueling = { car: c.id, cost: 0, pct: 0, t: 0 }; this.emit('sfx', { s: 'nozzle' }); },
    stopFueling(broke) {
      const P = this.P, f = P.fueling; if (!f) return;
      P.fueling = null;
      if (f.cost > 0) { this.pay(f.cost) || (P.money = Math.max(0, P.money - f.cost)); this.notify(`Getankt: +${Math.round(f.pct)}% für ${U.money(f.cost)}`, 'money'); }
      this.emit('pump', { on: !!P.nozzle, done: f, broke: !!broke });
    },
    hangNozzle() { if (this.P.fueling) this.stopFueling(); this.P.nozzle = null; this.emit('sfx', { s: 'nozzle' }); this.emit('pump', { on: false }); },
    updateFuelPump(dt) {
      const P = this.P, a = this.player;
      if (!P.nozzle) return;
      const d = Math.hypot(P.nozzle.x - a.x, P.nozzle.y - a.y);
      if (d > 7 * TILE || a.inCar || P.jail) {   // hose stretched too far: nozzle snaps back
        if (P.fueling) this.stopFueling();
        P.nozzle = null; this.notify('Der Schlauch reißt dir die Zapfpistole aus der Hand.', 'bad'); this.emit('pump', { on: false });
        return;
      }
      const f = P.fueling; if (!f) return;
      const c = this.cars.find((q) => q.id === f.car);
      if (!c || c.dead || Math.hypot(c.x - a.x, c.y - a.y) > c.l / 2 + 40) return this.stopFueling();
      f.t += dt;
      while (f.t >= K.FUEL.tick) {
        f.t -= K.FUEL.tick;
        const add = Math.min(K.FUEL.pct, 100 - c.fuel), cost = add * K.FUEL.perPct;
        if (this.funds() < Math.ceil(f.cost + cost)) { this.emit('banner', { title: 'NICHT GENUG GELD', sub: 'Die Zapfsäule stoppt.', kind: 'red' }); return this.stopFueling(true); }
        c.fuel += add; f.cost = Math.round((f.cost + cost) * 100) / 100; f.pct += add;
        if (Math.random() < 0.5) this.emit('sfx', { s: 'pour' });
        if (c.fuel >= 99.9) { c.fuel = 100; return this.stopFueling(); }
      }
    },
    useJerrycan() {
      const c = this.carNear(this.player);
      if (!c) { this.notify('Kein Auto in der Nähe.', 'bad'); return false; }
      if (K.carModel(c).ev) { this.notify('Das ist ein Elektroauto.', 'bad'); return false; }
      c.fuel = Math.min(100, (c.fuel || 0) + K.FUEL.jerry); this.takeItem('jerrycan'); this.addItem('jerryempty');
      this.emit('sfx', { s: 'pour' }); this.notify(`Kanister eingefüllt: Tank ${Math.round(c.fuel)}%`);
      return true;
    },
    useSpare() {
      const c = this.carNear(this.player); if (!c) { this.notify('Kein Auto in der Nähe.', 'bad'); return false; }
      const i = c.tires.findIndex((t) => t < 20);
      if (i < 0) { this.notify('Alle Reifen sind heil.'); return false; }
      c.tires[i] = 100; this.takeItem('spare'); this.emit('sfx', { s: 'attach' }); this.notify(`Reifen ${['vorne links', 'vorne rechts', 'hinten links', 'hinten rechts'][i]} gewechselt.`);
      return true;
    },
    useRepairKit() {
      const c = this.carNear(this.player); if (!c) { this.notify('Kein Auto in der Nähe.', 'bad'); return false; }
      c.hp = 100; c.fire = 0; c.eng = 100; c.bodyHP = 100; c.temp = 85; c.leak = false; c.tank = Math.max(c.tank, 60);
      c.dents = c.dents.map((d) => d * 0.5);
      this.takeItem('repair'); this.emit('sfx', { s: 'attach' }); this.notify('Notdürftig repariert: Motor und Karosserie laufen wieder.');
      return true;
    },

    // ============================================================ workshop (rde_mechanic)
    bayOf(c) {
      for (const b of this.city.bays || []) if (c.x > b.x * TILE && c.x < (b.x + b.w) * TILE && c.y > b.y * TILE && c.y < (b.y + b.h) * TILE) return b;
      return null;
    },
    repairQuote(c) {
      this.initCarState(c);
      const tires = c.tires.reduce((s, t) => s + (100 - t), 0) / 4, dents = c.dents.reduce((s, d) => s + d, 0);
      const dmg = ((100 - c.eng) + (100 - c.bodyHP) + (100 - c.hp)) / 3 * 10 + tires * 3 + dents * 12 + (100 - c.tank) * 2 + c.crack * 2;
      if (dmg < 8) return null;
      return { price: Math.round(Math.min(500 + dmg * 0.5, 10000) * K.carCls(c).mult / 10) * 10, dur: U.clamp(5 + dmg * 0.01, 5, 30), dmg };
    },
    startRepair(c) {
      const q = this.repairQuote(c); if (!q) { this.notify('Da gibt es nichts zu reparieren.'); return false; }
      if (this.repairJob) return false;
      if (!this.pay(q.price)) { this.notify('Nicht genug Geld.', 'bad'); return false; }
      const mech = this.actors.find((a) => a.mechanic && a.alive && a.ko <= 0 && !a.removed) || null;
      this.repairJob = { car: c.id, t: 0, dur: q.dur, mech: mech ? mech.id : 0, start: { eng: c.eng, bodyHP: c.bodyHP, hp: c.hp, dents: c.dents.slice(), tires: c.tires.slice(), crack: c.crack, tank: c.tank } };
      c.serviceLock = true;
      if (mech) { mech.state = 'mechwork'; mech.brain.car = c.id; this.bark(mech, U.pick(['Mal sehen, was du angestellt hast…', 'Uff. Das wird teuer.', 'Gib mir ein paar Minuten.']), 2.4); }
      this.emit('sfx', { s: 'accept' });
      return true;
    },
    updateRepair(dt) {
      const j = this.repairJob; if (!j) return;
      const c = this.cars.find((q) => q.id === j.car);
      if (!c || c.dead) { this.repairJob = null; return; }
      j.t += dt; const k = Math.min(1, j.t / j.dur), s = j.start;
      c.eng = U.lerp(s.eng, 100, k); c.bodyHP = U.lerp(s.bodyHP, 100, k); c.hp = U.lerp(s.hp, 100, k); c.tank = U.lerp(s.tank, 100, k); c.crack = U.lerp(s.crack, 0, k);
      c.dents = s.dents.map((d) => d * (1 - k)); c.tires = s.tires.map((t) => U.lerp(t, 100, k));
      if (Math.random() < dt * 6) this.emit('sparks', { x: c.x + Math.cos(c.a) * c.l * 0.4, y: c.y + Math.sin(c.a) * c.l * 0.4 });
      if (Math.random() < dt * 3) this.emit('sfx', { s: 'wrench' });
      if (k >= 1) {
        c.lightsOK = [1, 1, 1, 1]; c.leak = false; c.fire = 0; c.temp = 85; c.scratches = []; c.serviceLock = false;
        const m = this.byId.get(j.mech); if (m) { m.state = 'post'; this.bark(m, U.pick(['Läuft wieder wie neu.', 'Fertig. Fahr vorsichtig — oder auch nicht.']), 2.4); }
        this.repairJob = null; this.notify('Reparatur abgeschlossen. Frisch gewaschen ist er auch.', 'good'); this.emit('sfx', { s: 'complete' });
      }
    },
    ai_mechwork(a, dt) {
      const c = this.cars.find((q) => q.id === a.brain.car);
      if (!c || !this.repairJob) { a.state = 'post'; return; }
      const tx = c.x + Math.cos(c.a) * (c.l / 2 + 12), ty = c.y + Math.sin(c.a) * (c.l / 2 + 12);
      if (Math.hypot(tx - a.x, ty - a.y) > 14) { this.goTo(a, tx, ty, { tol: 10 }); a.dv = this.steer(a, 90, dt); return; }
      a.dv = [0, 0]; a.faceTo = c.a + Math.PI; a.attackT = (a.attackT || 0) > 0.4 ? 0 : (a.attackT || 0) + dt;
    },
    /** buy one tuning option for car c (preview already applied by the UI) */
    buyTune(c, partId, optIdx) {
      const part = K.TUNING.flatMap((g) => g.parts).find((p) => p.id === partId), opt = part && part.opts[optIdx];
      if (!part || !opt) return false;
      const price = K.tunePrice(c, part, opt);
      if (!this.pay(price)) { this.notify('Nicht genug Geld.', 'bad'); return false; }
      this.applyTune(c, partId, opt);
      const r = this.ownRec(c) || this.adoptCar(c); if (r) { r.tune = c.tune; r.color = c.color; }
      this.emit('sfx', { s: 'purchase' });
      this.notify(`${part.name}: ${opt.name} eingebaut (−${U.money(price)})`, 'good');
      return true;
    },
    applyTune(c, partId, opt) {
      c.tune = c.tune || {};
      if (partId === 'color') { c.color = opt.v; c.tune.finish = opt.finish || ''; c.tune.color = opt.v; }
      else c.tune[partId] = opt.v;
      if (partId === 'nitro') c.nos = opt.v ? 100 : 0;
    },
    mechanicContext(add) {
      const a = this.player; if (a.inCar || this.drag) return false;
      for (const m of this.near(a.x, a.y, 44)) {
        if (!m.mechanic || !m.alive || m.ko > 0) continue;
        const c = this.carNear({ x: m.x, y: m.y }) || this.cars.find((q) => !q.dead && (q.owned || q.playerOwned) && Math.hypot(q.x - a.x, q.y - a.y) < 7 * TILE);
        if (c) add('E', `${m.name.split(' ')[0]}: Reparatur & Tuning`, () => this.emit('ui', { open: 'tuning', car: c.id }));
        else add('E', 'Mechaniker — fahr dein Auto in eine Bühne', null);
        return true;
      }
      return false;
    },
    /** prompts while sitting in a car (T) */
    carContext(c, add) {
      if (this.bayOf(c) && (c.speed || 0) < 40) add('T', 'Werkstatt: Reparatur & Tuning', () => this.emit('ui', { open: 'tuning', car: c.id }));
      const near = this.buildings.find((b) => b.type === 'gas' && Math.hypot((b.x + b.w / 2) * TILE - c.x, (b.y + b.h + 6) * TILE - c.y) < 9 * TILE);
      if (near && c.fuel < 95 && !K.carModel(c).ev) add('T', 'Tanken: aussteigen, Zapfpistole nehmen [E]', null);
    },

    // ============================================================ car service (rde_carservice)
    serviceBusy() { return this.svc && this.svc.stage !== 'done'; },
    serviceDeliver(id) {
      const r = this.ownedCars().find((q) => q.id === id);
      if (this.serviceBusy()) return this.notify('Es läuft schon ein Auftrag.', 'bad'), false;
      if ((this.svcCD || 0) > this.t) return this.notify('Moment — die Zentrale ist noch beschäftigt.', 'bad'), false;
      if (!r || r.state !== 'stored') return this.notify('Das Auto steht nicht in der Garage.', 'bad'), false;
      if (this.P.jail || this.player.inCar) return this.notify('Gerade nicht möglich.', 'bad'), false;
      if (!this.pay(K.SERVICE.deliver)) return this.notify('Nicht genug Geld.', 'bad'), false;
      this.svcCD = this.t + 5;
      const p = this.player, node = this.roadNodeFar(p.x, p.y, 18, 40) || this.roadNodeFar(p.x, p.y, 12, 70);
      if (!node) { this.P.money += K.SERVICE.deliver; return this.notify('Kein Fahrer verfügbar.', 'bad'), false; }
      const [i, j] = node, nb = U.pick(this.roadNeighbors(i, j));
      const x0 = (i * 26 + 2) * TILE, y0 = (j * 26 + 2) * TILE, x1 = (nb[0] * 26 + 2) * TILE, y1 = (nb[1] * 26 + 2) * TILE;
      const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
      const c = this.spawnOwned(r, x0 + (x1 - x0) * 0.35 - dy * 32, y0 + (y1 - y0) * 0.35 + dx * 32, Math.atan2(dy, dx));
      c.engineOn = true; c.service = true;
      const d = this.putDriver(c, 'civ', { outfit: 'valet', name: 'Fahrer ' + U.pick(K.NAMES.first), state: 'driving' });
      d.valet = true; d.important = true;
      c.unit = { mode: 'valet', dest: { x: p.x, y: p.y }, prio: 1, t0: this.t };
      this.svc = { kind: 'deliver', stage: 'driving', car: c.id, driver: d.id, rec: r.id, t0: this.t, warned: false };
      this.emit('sfx', { s: 'phone' });
      this.notify(`Car Service: ${r.name} ist unterwegs (~${this.serviceEta()} s).`, 'good');
      return true;
    },
    serviceEta() {
      const s = this.svc; if (!s) return 0;
      const c = this.cars.find((q) => q.id === s.car), p = this.player;
      if (!c) return 0;
      return Math.max(5, Math.ceil(Math.hypot(c.x - p.x, c.y - p.y) / 260 * 2.5));
    },
    servicePickup() {
      if (this.serviceBusy()) return this.notify('Es läuft schon ein Auftrag.', 'bad'), false;
      const p = this.player;
      const c = this.cars.filter((q) => !q.dead && q.owned && q.driver !== 'player' && !q.service).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (!c || Math.hypot(c.x - p.x, c.y - p.y) > 25 * TILE) return this.notify('Kein eigenes Auto in der Nähe.', 'bad'), false;
      if (!this.pay(K.SERVICE.pickup)) return this.notify('Nicht genug Geld.', 'bad'), false;
      this.svcCD = this.t + 5;
      let pos = null;
      for (let k = 0; k < 200 && !pos; k++) { const i = U.pick(this.city.walk), x = (i % this.W + 0.5) * TILE, y = (((i / this.W) | 0) + 0.5) * TILE, d = Math.hypot(x - c.x, y - c.y); if (d > 12 * TILE && d < 24 * TILE && !K.los(this, p.x, p.y, x, y)) pos = [x, y]; }
      if (!pos) pos = [c.x + 10 * TILE, c.y];
      const d = this.spawnActor('civ', pos[0], pos[1], { outfit: 'valet', name: 'Fahrer ' + U.pick(K.NAMES.first), state: 'valetgo' });
      d.valet = true; d.important = true; d.brain.car = c.id;
      c.service = true;
      this.svc = { kind: 'pickup', stage: 'walking', car: c.id, driver: d.id, rec: c.ownId, t0: this.t };
      this.emit('sfx', { s: 'phone' });
      this.notify('Car Service: Ein Fahrer holt dein Auto ab.', 'good');
      return true;
    },
    serviceCancel() {
      const s = this.svc; if (!s || s.stage === 'done') return;
      const c = this.cars.find((q) => q.id === s.car), d = this.byId.get(s.driver);
      if (c) { c.unit = null; c.service = false; if (d && d.inCar === c.id) { this.ejectFrom(c, d, false); } c.parked = true; }
      if (d) { d.state = 'valetleave'; d.brain.ex = null; }
      s.stage = 'done';
      this.notify('Car Service storniert.');
    },
    insureCar(id) {
      const r = this.ownedCars().find((q) => q.id === id); if (!r || r.state !== 'destroyed') return false;
      const cost = Math.round(K.CARMODELS[r.kind].price * K.SERVICE.insure / 10) * 10;
      if (!this.pay(cost)) return this.notify('Nicht genug Geld.', 'bad'), false;
      Object.assign(r, { state: 'stored', fuel: 100, eng: 100, bodyHP: 100, hp: 100, tires: null, dents: null, crack: 0, lightsOK: null, tank: 100 });
      this.notify(`Versicherung: ${r.name} ist ersetzt und steht in der Garage.`, 'good');
      return true;
    },
    updateCarService(dt) {
      if (!this.ownedSpawned) {
        this.ownedSpawned = true;
        for (const r of this.ownedCars()) if (r.state === 'out' && r.x != null) this.spawnOwned(r, r.x, r.y, r.a || 0);
        this.spawnDisplayCars();
        for (const b of this.city.bays || []) {   // one mechanic per bay
          const x = (b.cx + 0.5) * TILE, y = (b.y + b.h + 0.6) * TILE;
          const m = this.spawnActor('staff', x, y, { outfit: 'mechanic', home: b.bld, state: 'post', name: U.pick(K.NAMES.first) + ' ' + U.pick(['Schrauber', 'Kolben', 'Bremse', 'Öl']) });
          m.mechanic = true; m.brain.post = { x, y }; m.brain.face = -Math.PI / 2; m.important = true;
        }
      }
      // owned cars burnt out → destroyed
      for (const r of this.ownedCars()) if (r.state === 'out') { const c = this.cars.find((q) => q.ownId === r.id); if (!c || (c.dead && c.fire <= 0)) { if (!c || c.wreck) { r.state = 'destroyed'; this.notify(`${r.name} ist ein Totalschaden. Die Versicherung hilft (Car Service).`, 'bad'); } } }
      this.syncT = (this.syncT || 0) - dt; if (this.syncT <= 0) { this.syncT = 2; this.syncOwned(); }
      this.updateFuelPump(dt);
      this.updateRepair(dt);
      const s = this.svc; if (!s || s.stage === 'done') return;
      const c = this.cars.find((q) => q.id === s.car), d = this.byId.get(s.driver), p = this.player;
      if (!c || c.dead || !d || !d.alive) { this.notify('Car Service: Der Auftrag ist geplatzt.', 'bad'); s.stage = 'done'; if (c) { c.service = false; c.unit = null; } return; }
      if (this.t - s.t0 > 600) { this.serviceCancel(); return; }
      if (s.kind === 'deliver') {
        if (s.stage === 'driving') {
          c.unit.dest = { x: p.inCar ? this.carOf(p).x : p.x, y: p.inCar ? this.carOf(p).y : p.y };
          const dd = Math.hypot(c.x - p.x, c.y - p.y);
          if (dd < 22 * TILE && !s.warned) { s.warned = true; this.notify('Car Service: Der Fahrer ist gleich da.'); c.honk = 0.8; this.emit('honk', { x: c.x, y: c.y }); }
          if (dd < 7 * TILE || (dd < 12 * TILE && this.t - s.t0 > 25 && c.speed < 20)) { s.stage = 'parking'; s.t = 0; c.unit = { mode: 'abandoned', dest: c.unit.dest }; }
        } else if (s.stage === 'parking') {
          s.t += dt;
          if (s.t > 1.2 && c.speed < 10) { c.unit = null; c.parked = true; c.engineOn = false; this.ejectFrom(c, d, false); d.state = 'valetwalk'; d.brain.car = c.id; s.stage = 'handover'; }
        } else if (s.stage === 'handover') {
          s.ht = (s.ht || 0) + dt;
          if (Math.hypot(d.x - p.x, d.y - p.y) < 40 || (d.arrived && Math.hypot(d.x - p.x, d.y - p.y) < 4 * TILE) || s.ht > 25) {
            this.bark(d, U.pick(['Ihr Wagen. Gute Fahrt!', 'Schlüssel, bitte schön.', 'Vollgetankt hab ich nicht — aber gewaschen.']), 2.4);
            this.emit('keys', { x: p.x, y: p.y }); this.emit('sfx', { s: 'keys' });
            c.service = false; s.stage = 'done'; d.state = 'valetleave'; d.brain.ex = null; d.brain.leaveT = 15 + Math.random() * 15;
            this.notify('Car Service: Schlüssel übergeben.', 'good');
          }
        }
      } else if (s.kind === 'pickup') {
        if (s.stage === 'walking' && d.inCar === c.id) {
          s.stage = 'leaving'; c.engineOn = true;
          const ang = Math.random() * Math.PI * 2;
          c.unit = { mode: 'valet', dest: { x: U.clamp(c.x + Math.cos(ang) * 40 * TILE, 4 * TILE, (this.W - 4) * TILE), y: U.clamp(c.y + Math.sin(ang) * 40 * TILE, 4 * TILE, (this.W - 4) * TILE) }, prio: 1, t0: this.t };
        } else if (s.stage === 'leaving') {
          const far = Math.hypot(c.x - p.x, c.y - p.y) > 30 * TILE && !K.los(this, p.x, p.y, c.x, c.y);
          if (far || this.t - s.t0 > 240) {
            this.syncOwned();
            const r = this.ownedCars().find((q) => q.id === c.ownId); if (r) r.state = 'stored';
            this.despawnCar(c); s.stage = 'done';
            this.notify(`Car Service: ${r ? r.name : 'Dein Auto'} steht in der Garage.`, 'good');
          }
        }
      }
    },
    ai_valetwalk(a, dt) {
      const p = this.player;
      this.goTo(a, p.x, p.y, { tol: 30 }); a.dv = this.steer(a, 110, dt);
    },
    ai_valetgo(a, dt) {
      const c = this.cars.find((q) => q.id === a.brain.car);
      if (!c || c.dead) { a.state = 'valetleave'; return; }
      if (Math.hypot(c.x - a.x, c.y - a.y) < c.l / 2 + 18) { a.inCar = c.id; c.driver = a.id; a.path = null; this.emit('door', { x: c.x, y: c.y }); return; }
      this.goTo(a, c.x, c.y, { tol: 30 }); a.dv = this.steer(a, 120, dt);
    },
    ai_valetleave(a, dt) {
      if (!a.brain.ex) { a.brain.ex = this.randomWalkNear(a, 18, 28); a.goal = null; }
      this.goTo(a, a.brain.ex[0], a.brain.ex[1], { tol: 40 }); a.dv = this.steer(a, 95, dt);
      a.brain.leaveT = (a.brain.leaveT == null ? 25 : a.brain.leaveT) - dt;
      if (a.arrived || a.brain.leaveT <= 0) { const p = this.player; if (Math.hypot(a.x - p.x, a.y - p.y) > 14 * TILE || !K.los(this, p.x, p.y, a.x, a.y)) this.removeActor(a); else a.brain.ex = null; }
    },
    /** dealership & display cars on foot */
    dealerContext(add) {
      const a = this.player; if (a.inCar || this.drag) return false;
      const c = this.carNear(a);
      if (c && c.display) { const M = K.CARMODELS[c.display]; add('E', `${M.name} ansehen — ${U.money(M.price)}`, () => this.emit('ui', { open: 'dealer', kind: c.display })); return true; }
      return false;
    },
  });
})(globalThis.K = globalThis.K || {});
