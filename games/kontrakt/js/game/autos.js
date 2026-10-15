/* RDE // KONTRAKT — the car update. Models, per-part damage with real body deformation, fuel (rde_fuel),
 * engine temperature / seatbelt / cruise / blinkers / nitro (rde_carhud), tuning effects (rde_mechanic)
 * and street furniture you can mow down: lamps, hydrants, benches, bins, bollards. */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE, TAU = Math.PI * 2;

  // ------------------------------------------------------------------ models
  Object.assign(K.CARK, {
    compact: { l: 54, w: 28, max: 400, acc: 240, colors: ['#e6e6e0', '#d94f30', '#5ab0d8', '#f2c94c', '#3d7a4f', '#2b2d31'] },
    coupe: { l: 60, w: 29, max: 520, acc: 330, colors: ['#1f3b63', '#c8102e', '#e6e6e6', '#111214', '#7a8590'] },
    muscle: { l: 68, w: 31, max: 560, acc: 430, grip: 0.82, colors: ['#111214', '#c87a00', '#7a0f14', '#1d4d2b', '#d8d8d2'] },
    suv: { l: 72, w: 35, max: 430, acc: 270, colors: ['#111214', '#e6e6e0', '#4b4f56', '#2b3a4f', '#5a4632'] },
    pickup: { l: 74, w: 33, max: 410, acc: 250, colors: ['#8a1c22', '#e6e6e0', '#2b2d31', '#3d5a3a', '#c8b07a'] },
    super: { l: 64, w: 32, max: 730, acc: 540, grip: 1.15, colors: ['#f2c200', '#c8102e', '#0e5fd8', '#e6e6e6', '#111214', '#2ec27e'] },
    ev: { l: 62, w: 30, max: 540, acc: 480, colors: ['#e6e6e6', '#1b1f24', '#5b6b7a', '#9b1b2a', '#2e6fd8'] },
  });
  /** catalogue for the dealership: name, price, class (repair/tuning multiplier, fuel use) */
  K.CARMODELS = {
    compact: { name: 'Brisa Mini', price: 9000, cls: 'compact', desc: 'Klein, sparsam, passt in jede Lücke.' },
    sedan: { name: 'Vela Limousine', price: 16000, cls: 'sedan', desc: 'Unauffällig. Genau richtig für Profis.' },
    van: { name: 'Kastenwagen K3', price: 14000, cls: 'commercial', desc: 'Platz für alles, was niemand sehen soll.' },
    pickup: { name: 'Hauler 2500', price: 22000, cls: 'suv', desc: 'Robust, ehrlich, laut.' },
    coupe: { name: 'Corsa GT', price: 32000, cls: 'sport', desc: 'Leicht, wendig, schnell genug.' },
    suv: { name: 'Ranger XL', price: 38000, cls: 'suv', desc: 'Schwer gepanzert wirkt er schon ab Werk.' },
    muscle: { name: 'Bulldog V8', price: 45000, cls: 'muscle', desc: 'Hubraum statt Grip. Driftet von selbst.' },
    ev: { name: 'Volta E', price: 58000, cls: 'ev', ev: true, desc: 'Elektrisch — kein Sprit, leise wie ein Messer.' },
    sport: { name: 'Furia S', price: 68000, cls: 'sport', desc: 'Italienisches Temperament.' },
    super: { name: 'Spectre RS', price: 185000, cls: 'super', desc: 'Das Schnellste in Krähenburg.' },
    taxi: { name: 'Taxi', price: 0, cls: 'sedan', hidden: true },
    police: { name: 'Streifenwagen', price: 0, cls: 'sedan', hidden: true },
  };
  K.CARCLS = {
    compact: { mult: 1, fuel: 0.18 }, sedan: { mult: 1.2, fuel: 0.22 }, sport: { mult: 1.6, fuel: 0.3 }, muscle: { mult: 1.5, fuel: 0.34 },
    suv: { mult: 1.4, fuel: 0.3 }, super: { mult: 2.4, fuel: 0.38 }, commercial: { mult: 1.3, fuel: 0.28 }, ev: { mult: 1.8, fuel: 0 },
  };
  K.carModel = (c) => K.CARMODELS[c.kind] || K.CARMODELS.sedan;
  K.carCls = (c) => K.CARCLS[K.carModel(c).cls] || K.CARCLS.sedan;
  K.KMH = 0.32;   // px/s → km/h on the dashboard
  /** which recorded engine each model uses, and how that engine behaves */
  K.ENGINE_SERIES = {
    compact: 'su-mid', coupe: 'su-ss', sedan: 'b-i6r', taxi: 'b-i6r', police: 'b-i6r', muscle: 'gv8', sport: 'v8f',
    super: 'v12d', suv: 'b-v8', pickup: 'ct-v8', van: 'ds8', ambulance: 'ds8', ev: 'electric',
  };
  //           idle, redline, gears, rev speed (rpm/s free-revving), sporty (overrun crackle), turbo flutter
  K.DRIVE = {
    'su-mid': { idle: 850, red: 7000, gears: 5, rev: 9000 }, 'su-ss': { idle: 900, red: 7600, gears: 6, rev: 11000, sporty: 1 },
    'b-i6r': { idle: 750, red: 6800, gears: 6, rev: 8000 }, gv8: { idle: 700, red: 6300, gears: 5, rev: 7000, sporty: 1, flutter: 1 },
    'ct-v8': { idle: 650, red: 5800, gears: 5, rev: 6000, flutter: 1 }, v8f: { idle: 1000, red: 8800, gears: 7, rev: 14000, sporty: 1 },
    v12d: { idle: 950, red: 8600, gears: 7, rev: 12000, sporty: 1 }, 'b-v8': { idle: 700, red: 6000, gears: 6, rev: 6500, flutter: 1 },
    ds8: { idle: 700, red: 4300, gears: 6, rev: 4000, flutter: 1 }, electric: { idle: 0, red: 11000, gears: 1, rev: 20000, ev: 1 },
  };
  K.driveOf = (c) => K.DRIVE[K.ENGINE_SERIES[c.kind] || 'b-i6r'] || K.DRIVE['b-i6r'];
  /** engine speed and gear (simulated drivetrain when the car has one, otherwise estimated from road speed) */
  K.carRPM = function (c) {
    if (c.engineOn === false) return { rpm: 0, gear: 'N' };
    if (c.drv) return { rpm: c.drv.rpm, gear: c.drv.gearS, lim: c.drv.lim, cut: c.drv.cut > 0, boost: c.drv.boost };
    const D = K.driveOf(c), d = K.CARK[c.kind] || K.CARK.sedan, vf = Math.abs(c.vf || 0);
    const g = Math.max(1, Math.min(D.gears, Math.ceil(vf / (d.max * 1.05) * D.gears)));
    return { rpm: Math.max(D.idle, D.red * 0.85 * vf / (d.max * Math.pow(g / D.gears, 0.8))), gear: String(g) };
  };
  /** an automatic gearbox with a real engine behind it: gear ratios, kick-down, a 0.2 s shift with
   *  the throttle cut, clutch slip when pulling away, rev inertia, rev limiter, turbo boost with lag */
  K.updateDrive = function (c, dt) {
    const D = K.driveOf(c), d = K.CARK[c.kind] || K.CARK.sedan, dr = c.drv || (c.drv = { rpm: D.idle, gear: 1, gearS: 'N', shiftT: 0, cut: 0, lim: false, boost: 0, bov: 0 });
    if (c.engineOn === false) { dr.rpm = Math.max(0, dr.rpm - dt * 4000); dr.boost = 0; dr.gearS = 'N'; return dr; }
    const thr = Math.max(0, c.thr || 0), vf = c.vf || 0, v = Math.abs(vf), vmax = d.max * 1.15;   // top speed comes a little below the redline
    const ratio = (g) => Math.pow(g / D.gears, 0.8);                    // share of top speed at the redline in gear g
    const wheel = (g) => D.red * v / (vmax * ratio(g));                 // rpm the wheels force in gear g
    dr.lim = false;
    if (dr.shiftT > 0) dr.shiftT -= dt;
    if (dr.cut > 0) dr.cut -= dt;
    let target, lock = 14;
    if (vf < -8) { dr.gearS = 'R'; target = Math.max(D.idle, wheel(1) * 1.2); }
    else if ((v < 6 && thr < 0.05) || (c.hbOn && v < 40)) { dr.gearS = 'N'; dr.gear = 1; target = D.idle; lock = 4; }   // idling, or revving it on the handbrake
    else {
      // automatic: shift up early when cruising, near the redline at full throttle; kick down for a burst
      const up = D.red * (0.33 + 0.6 * thr), down = Math.max(D.idle * 1.6, D.red * (0.2 + 0.4 * thr));
      if (D.gears > 1 && dr.shiftT <= 0) {
        if (dr.gear < D.gears && wheel(dr.gear) > up && vf > 0) { dr.gear++; dr.shiftT = 0.25; dr.cut = 0.16 + (thr > 0.8 ? 0 : 0.08); dr.shifted = (dr.shifted || 0) + 1; if (dr.boost > 0.35) dr.bov++; }
        else if (dr.gear > 1 && wheel(dr.gear) < down && wheel(dr.gear - 1) < Math.min(D.red * 0.92, up * 0.9)) { dr.gear--; dr.shiftT = 0.3; dr.down = (dr.down || 0) + 1; }
      }
      dr.gearS = String(dr.gear);
      target = wheel(dr.gear);
      // pulling away: the clutch slips, revs rise ahead of the wheels
      if (dr.gear === 1) { const slip = D.idle + thr * D.red * 0.42; if (target < slip) { target = U.lerp(target, slip, U.clamp(1 - v / 120, 0, 1)); lock = 8; } }
      if (dr.cut > 0) target = Math.min(target, dr.rpm);                 // clutch open: the revs fall towards the next gear
    }
    // free revving at a standstill
    if (dr.gearS === 'N' && thr > 0.05) { target = D.idle + thr * (D.red - D.idle); lock = 0; }
    if (target >= D.red) { dr.lim = true; target = D.red - ((c.limPh = (c.limPh || 0) + dt * 14) % 1 < 0.5 ? 0 : 320); }
    target = Math.max(D.idle * (dr.gearS === 'N' ? 1 : 0.92), target);
    if (lock) dr.rpm += (target - dr.rpm) * Math.min(1, dt * lock);
    else dr.rpm = target > dr.rpm ? Math.min(target, dr.rpm + D.rev * dt) : Math.max(target, dr.rpm - D.rev * 0.55 * dt);
    if (D.ev) { dr.gearS = vf < -8 ? 'R' : v < 6 ? 'N' : 'D'; dr.rpm = Math.max(0, D.red * v / vmax); }
    // turbo: spools with load and revs, dumps through the blow-off valve when you lift
    if (c.tune && c.tune.turbo && !D.ev) {
      const want = thr > 0.3 && dr.cut <= 0 ? U.clamp((dr.rpm - D.red * 0.3) / (D.red * 0.35), 0, 1) * thr : 0;
      const b0 = dr.boost;
      dr.boost += (want - dr.boost) * Math.min(1, dt * (want > dr.boost ? 1.6 : 7));
      if (b0 > 0.45 && want < 0.1 && dr.cut <= 0) dr.bov++;
    } else dr.boost = 0;
    return dr;
  };

  // body outline (rounded rectangle) sampled into points with outward normals — dents push points inward
  const OUTN = 28;
  K.carOutline = function (l, w) {
    const hl = l / 2, hw = w / 2, r = Math.min(9, hw - 2), pts = [];
    const per = 2 * (l + w - 4 * r) + TAU * r;
    for (let k = 0; k < OUTN; k++) {
      let s = (k / OUTN) * per;
      const seg = [[l - 2 * r, 0], [Math.PI / 2 * r, 1], [w - 2 * r, 2], [Math.PI / 2 * r, 3], [l - 2 * r, 4], [Math.PI / 2 * r, 5], [w - 2 * r, 6], [Math.PI / 2 * r, 7]];
      for (const [len, id] of seg) {
        if (s > len) { s -= len; continue; }
        const t = s / Math.max(1e-6, len);
        // segments start at the front-right straight edge and go clockwise (front = +u)
        if (id === 0) pts.push([hl, -hw + r + t * (w - 2 * r), 1, 0]);
        else if (id === 2) pts.push([hl - r - t * (l - 2 * r), hw, 0, 1]);
        else if (id === 4) pts.push([-hl, hw - r - t * (w - 2 * r), -1, 0]);
        else if (id === 6) pts.push([-hl + r + t * (l - 2 * r), -hw, 0, -1]);
        else {
          const base = { 1: [hl - r, hw - r, 0], 3: [-hl + r, hw - r, Math.PI / 2], 5: [-hl + r, -hw + r, Math.PI], 7: [hl - r, -hw + r, Math.PI * 1.5] }[id];
          const a = base[2] + t * Math.PI / 2;
          pts.push([base[0] + Math.cos(a) * r, base[1] + Math.sin(a) * r, Math.cos(a), Math.sin(a)]);
        }
        break;
      }
    }
    return pts;
  };

  // street furniture a car can flatten: min speed (px/s), speed kept, car damage
  K.BREAKABLE = {
    trash: { v: 25, keep: 0.92, dmg: 1 }, sign: { v: 30, keep: 0.88, dmg: 1 }, umbrella: { v: 20, keep: 0.95, dmg: 0 },
    bench: { v: 55, keep: 0.78, dmg: 3 }, hydrant: { v: 70, keep: 0.62, dmg: 5 }, lamp: { v: 95, keep: 0.55, dmg: 7 },
    vending: { v: 190, keep: 0.45, dmg: 10 }, bollard: { v: 260, keep: 0.4, dmg: 14 }, chair: { v: 20, keep: 0.95, dmg: 0 }, stool: { v: 20, keep: 0.95, dmg: 0 },
  };

  K.mixin({
    initCarState(c) {
      if (c.eng != null) return c;
      c.eng = 100; c.bodyHP = 100; c.tank = 100; c.tires = [100, 100, 100, 100];
      c.dents = new Array(OUTN).fill(0); c.scratches = []; c.lightsOK = [1, 1, 1, 1]; c.crack = 0;
      c.fuel = c.fuel != null ? c.fuel : 25 + Math.random() * 60;
      c.temp = 82; c.tune = c.tune || {}; c.odo = c.odo || 0; c.engineOn = true; c.nos = c.tune.nitro ? 100 : 0;
      c.blink = 0; c.lightMode = 0;
      return c;
    },
    /** combined performance multipliers from tuning, damage, heat, fuel and boost */
    carMods(c) {
      const t = c.tune || {}, d = K.CARK[c.kind] || {};
      let acc = 1 + (t.engine || 0) * 0.08 + (t.trans || 0) * 0.05 + (t.turbo ? 0.15 : 0) + (t.exhaust || 0) * 0.03;
      let max = 1 + (t.engine || 0) * 0.04 + (t.trans || 0) * 0.03 + (t.turbo ? 0.05 : 0);
      let grip = (d.grip || 1) * (1 + (t.susp || 0) * 0.07 + (t.tires === 'sport' ? 0.12 : t.tires === 'drift' ? -0.38 : 0));
      const brake = 1 + (t.brakes || 0) * 0.2;
      const e = c.eng != null ? c.eng : 100;
      let pow = e > 67 ? 1 : e > 31 ? 0.85 : e > 10 ? 0.5 : 0.08;
      const T = c.temp || 85; pow *= T >= 125 ? 0.55 : T >= 115 ? 0.8 : T >= 105 ? 0.95 : 1;
      let burst = 0, pull = 0;
      if (c.tires) c.tires.forEach((h, i) => { if (h < 20) { burst++; pull += i % 2 ? 1 : -1; } });
      max *= 1 - burst * 0.18; grip *= 1 - burst * 0.14;
      if (c.engineOn === false || (c.fuel != null && c.fuel <= 0 && !K.carModel(c).ev)) pow = 0;
      if (c.sputter > 0) pow *= 0.15;
      if (c.boost) { acc *= 1.9; max *= 1.25; }
      return { acc: acc * pow, max, grip, brake, pull: pull * 0.12, pow };
    },

    // ------------------------------------------------------------ damage
    /** localized impact: lx/ly in car space (lx forward, ly right), v = impact speed px/s */
    carImpact(c, lx, ly, v, src) {
      this.initCarState(c);
      const t = c.tune || {}, armor = 1 - (t.armor || 0) * 0.15;
      const hl = c.l / 2, hw = c.w / 2;
      const mag = U.clamp((v - 50) / 55, 0, 7) * armor;
      if (mag > 0.05) {
        const pts = K.carOutline(c.l, c.w);
        pts.forEach(([u, w], k) => {
          const d = Math.hypot(u - lx, w - ly);
          if (d > 24) return;
          const maxD = Math.abs(u) > hl - 6 ? 9 : 5.5;
          c.dents[k] = Math.min(maxD, c.dents[k] + mag * (1 - d / 24));
        });
      }
      const front = lx > hl * 0.45, rear = lx < -hl * 0.45, right = ly > 0;
      c.bodyHP = Math.max(0, c.bodyHP - v * 0.045 * armor);
      if (front) {
        c.eng = Math.max(0, c.eng - v * 0.035 * armor);
        if (v > 120) for (const i of right ? [1] : [0]) if (Math.random() < 0.6) c.lightsOK[i] = 0;
        if (v > 240) c.lightsOK[right ? 0 : 1] = Math.random() < 0.5 ? 0 : c.lightsOK[right ? 0 : 1];
        if (v > 170) c.crack = Math.min(100, c.crack + 20);
      } else if (rear) {
        if (v > 120 && Math.random() < 0.6) c.lightsOK[right ? 3 : 2] = 0;
        c.tank = Math.max(0, c.tank - v * 0.03 * armor);
      } else {
        // side swipe: wheels on that side + a scratch
        for (const i of right ? [1, 3] : [0, 2]) if (Math.abs(lx - (i < 2 ? hl - 13 : -hl + 12)) < 22) c.tires[i] = Math.max(0, c.tires[i] - v * 0.06 * (t.tires === 'bulletproof' ? 0.3 : 1));
        if (c.scratches.length < 14) c.scratches.push([U.clamp(lx + U.rnd(-14, 14), -hl + 4, hl - 4), right ? hw - 1 : -hw + 1, U.rnd(8, 22)]);
      }
      if (c.driver === 'player' && v > 160) this.emit('carJolt', { v });
    },
    /** bullets & blasts hit a specific spot of the car */
    carHit(c, x, y, dmg, src, kind) {
      this.initCarState(c);
      const fx = Math.cos(c.a), fy = Math.sin(c.a), dx = x - c.x, dy = y - c.y;
      const lx = dx * fx + dy * fy, ly = -dx * fy + dy * fx, hl = c.l / 2;
      const armor = 1 - ((c.tune && c.tune.armor) || 0) * 0.15;
      if (lx > hl * 0.45) c.eng = Math.max(0, c.eng - dmg * 0.25 * armor);
      if (lx < -hl * 0.55 && Math.random() < 0.25) { c.tank = Math.max(0, c.tank - dmg * 0.6); if (c.tank < 30) c.leak = true; }
      // tyres
      [[hl - 13, -c.w / 2], [hl - 13, c.w / 2], [-hl + 12, -c.w / 2], [-hl + 12, c.w / 2]].forEach(([u, v], i) => {
        if (Math.hypot(lx - u, ly - v) < 9 && !(c.tune && c.tune.tires === 'bulletproof')) { c.tires[i] = 0; this.emit('tireBurst', { x, y }); }
      });
      if (Math.abs(lx) < hl * 0.4 && Math.random() < 0.2) c.crack = Math.min(100, c.crack + 10);
      this.damageCar(c, dmg * 0.35 * armor, src);
    },

    // ------------------------------------------------------------ breakables
    carSmash(c, nx, ny) {
      if ((c.speed || 0) < 18) return;
      const fx = Math.cos(c.a), fy = Math.sin(c.a), hl = c.l / 2 + 2, hw = c.w / 2;
      for (const [u, v] of [[hl, -hw], [hl, 0], [hl, hw], [0, -hw], [0, hw], [-hl, -hw], [-hl, 0], [-hl, hw]]) {
        const x = nx + fx * u - fy * v, y = ny + fy * u + fx * v;
        const tx = (x / TILE) | 0, ty = (y / TILE) | 0;
        if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) continue;
        const pi = this.pmap[ty * this.W + tx]; if (pi < 0) continue;
        const p = this.props[pi]; if (!p || p.broken || p.bld >= 0) continue;
        const B = K.BREAKABLE[p.k]; if (!B || c.speed < B.v) continue;
        this.breakProp(p, c, u, v);
      }
    },
    breakProp(p, c, lu, lv) {
      const W = this.W, B = K.BREAKABLE[p.k] || { keep: 0.8, dmg: 2 };
      p.broken = true;
      for (let j = p.y; j < p.y + p.h; j++) for (let i = p.x; i < p.x + p.w; i++) { this.solid[j * W + i] = 0; this.pmap[j * W + i] = -1; this.opaque[j * W + i] = K.TF[this.tiles[j * W + i]] & 2 ? 1 : 0; }
      const cx = (p.x + p.w / 2) * K.TILE, cy = (p.y + p.h / 2) * K.TILE;
      for (const L of this.lights) if (L.kind === 'lamp' && Math.abs(L.x - cx) < 20 && Math.abs(L.y - cy) < 20) L.dead = true;
      const v = c ? c.speed : 200, a = c ? Math.atan2(c.vy, c.vx) : Math.random() * TAU;
      (this.debris || (this.debris = [])).push({ k: p.k, x: cx, y: cy, a: a + U.rnd(-0.6, 0.6), vx: Math.cos(a) * v * 0.7, vy: Math.sin(a) * v * 0.7, va: U.rnd(-6, 6), t: 0, life: p.k === 'hydrant' ? 40 : 1e9, w: p.w, h: p.h, seed: p.id });
      if (c) {
        c.vx *= B.keep; c.vy *= B.keep;
        this.carImpact(c, lu != null ? lu : c.l / 2, lv || 0, 60 + B.dmg * 18);
        this.damageCar(c, B.dmg, null);
      }
      this.emit('propSmash', { k: p.k, x: cx, y: cy, v, tx: p.x, ty: p.y, player: !!(c && c.driver === 'player') });
      this.noise(cx, cy, p.k === 'lamp' || p.k === 'hydrant' ? 9 : 5, 'crash', null);
      this.brokenProps = (this.brokenProps || 0) + 1;
      if (this.nav) for (let j = p.y; j < p.y + p.h; j++) for (let i = p.x; i < p.x + p.w; i++) this.nav.cost[j * W + i] = this.nav.baseCost(j * W + i);
      if (p.rec && this.placedBroken) this.placedBroken(p);
    },
    updateDebris(dt) {
      if (!this.debris) return;
      for (const d of this.debris) {
        d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.a += d.va * dt;
        const f = Math.max(0, 1 - 4.5 * dt); d.vx *= f; d.vy *= f; d.va *= f;
        if (d.k === 'hydrant' && d.t < d.life && Math.random() < dt * 40) this.emit('geyser', { x: (d.ox || (d.ox = d.x)), y: (d.oy || (d.oy = d.y)) });
      }
      if (this.debris.length > 160) this.debris.splice(0, this.debris.length - 160);
    },

    // ------------------------------------------------------------ the driver's car each frame
    updateAutos(dt) {
      this.updateDebris(dt);
      const p = this.player;
      for (const c of this.cars) {
        if (c.dead) continue;
        this.initCarState(c);
        // engine damage phases: degrading → critical (smoke) → limp → fire
        if (c.eng < 67.7 && c.eng > 0) c.eng = Math.max(0, c.eng - dt * (c.eng < 31 ? 0.15 : 0.038) * (c.engineOn ? 1 : 0.2));
        if (c.eng <= 0 && c.fire <= 0 && !c.dead && c.engineOn) { c.fire = 6; this.emit('carBurn', { x: c.x, y: c.y }); }
        if (c.leak && c.fuel > 0) { c.fuel = Math.max(0, c.fuel - dt * 0.6); if (Math.random() < dt * 4) this.emit('fuelDrip', { x: c.x - Math.cos(c.a) * c.l * 0.4, y: c.y - Math.sin(c.a) * c.l * 0.4 }); }
        if (c.tank <= 0 && c.fire <= 0 && Math.random() < dt * 0.3) { c.fire = 4; this.emit('carBurn', { x: c.x, y: c.y }); }
        const smoke = c.temp >= 135 ? 3 : c.eng < 10 ? 3 : c.temp >= 120 || c.eng < 31 ? 2 : c.temp >= 110 ? 1 : 0;
        if (smoke && Math.random() < dt * (4 + smoke * 4)) this.emit('carSmoke', { x: c.x + Math.cos(c.a) * c.l * 0.38, y: c.y + Math.sin(c.a) * c.l * 0.38, k: smoke });
        // burst tyres throw sparks on the rim
        if (c.speed > 120 && c.tires.some((h) => h < 1) && Math.random() < dt * 12) this.emit('sparks', { x: c.x + U.rnd(-c.l / 3, c.l / 3), y: c.y + U.rnd(-c.w / 3, c.w / 3) });
        if (c.driver !== 'player' && !c.owned) continue;
        // fuel (owned & driven cars only — NPC traffic always has gas)
        const mdl = K.carModel(c), d = K.CARK[c.kind];
        if (c.engineOn && !mdl.ev && c.driver === 'player') {
          const rate = K.carCls(c).fuel, th = Math.abs(c.thr || 0), sp = Math.min(1, (c.speed || 0) / d.max);
          c.fuel = Math.max(0, c.fuel - dt * rate * (0.12 + 0.88 * th * (0.3 + 0.7 * sp)) * (c.boost ? 1.6 : 1));
          if (c.fuel < 5 && c.fuel > 0) { c.sputT = (c.sputT || 0) - dt; if (c.sputT <= 0) { c.sputT = 0.25 + Math.random() * 0.5; c.sputter = Math.random() < 0.35 ? 0.25 : 0; if (c.sputter) this.emit('sfx', { s: 'sputter' }); } } else c.sputter = 0;
          if (c.fuel <= 0 && c.engineOn) { c.engineOn = false; this.notify('Tank leer — der Motor geht aus.', 'bad'); this.emit('sfx', { s: 'stall' }); }
        }
        if (c.sputter > 0) c.sputter -= dt;
        c.odo += (c.speed || 0) * K.KMH * dt / 3600;   // km
        if (c.driver !== 'player') continue;
        // engine temperature (°C)
        const kmh = (c.speed || 0) * K.KMH, hot = c.eng < 60 ? 3 : 1;
        let dT;
        if (!c.engineOn) dT = c.temp > 60 ? -0.6 : 0;
        else if (kmh < 3) dT = 0.02 * hot - 0.15 + (c.thr ? 0.4 : 0);
        else if (kmh < 80) dT = 0.05 * hot - 0.22 + Math.abs(c.thr) * 0.5;
        else if (kmh < 100) dT = 0.08 * hot - 0.35 + Math.abs(c.thr) * 0.6;
        else dT = -0.35 + Math.abs(c.thr) * 0.55 * hot;
        if (c.boost) dT += 2.2;
        c.temp = U.clamp(c.temp + dT * dt * 6, 20, 150);
        if (c.engineOn && c.temp < 88) c.temp += dt * 4;
        if (c.temp >= 140 && !c.cooked) { c.cooked = true; c.eng = Math.min(c.eng, 22); this.notify('Motorschaden durch Überhitzung!', 'bad'); }
        if (c.temp < 120) c.cooked = false;
        if (c.temp >= 110 && Math.random() < dt * 0.8) this.emit('sfx', { s: 'beep' });
        // crank / hot-wire
        if (c.crankT > 0) { c.crankT -= dt; if (c.crankT <= 0) { if (c.fuel > 0 || mdl.ev) { c.engineOn = true; this.emit('sfx', { s: 'ignite' }); } else this.notify('Kein Sprit.', 'bad'); } }
        // nitro
        c.boost = !!(this.nitroHeld && c.tune.nitro && c.nos > 0 && c.engineOn);
        if (c.boost) { c.nos = Math.max(0, c.nos - dt * 20); if (Math.random() < dt * 30) this.emit('exhaustFlame', { x: c.x - Math.cos(c.a) * c.l / 2, y: c.y - Math.sin(c.a) * c.l / 2, a: c.a }); }
        else if (c.tune.nitro) c.nos = Math.min(100, c.nos + dt * 2.5);
        // headlights
        c.lightsOn = c.lightMode > 0 || (c.lightMode === 0 && this.daylight() < 0.5);
        c.highBeam = c.lightMode === 2;
      }
      this.updateRockets(dt);
    },
    /** seatbelt & ejection (rde_carhud: >45 km/h crash without a belt throws you out) */
    crashBelt(c, v) {
      const p = this.player, kmh = v * K.KMH;
      if (c.driver !== 'player' || kmh < 25) return;
      if (c.cruise) c.cruise = 0;
      if (!c.belt && kmh > 75) {
        const sev = U.clamp((kmh - 75) / 60, 0, 2);
        this.exitCar(true);
        const fx = Math.cos(c.a), fy = Math.sin(c.a);
        p.x = c.x + fx * (c.l / 2 + 22); p.y = c.y + fy * (c.l / 2 + 22);
        if (this.blockedTile(this.tileIdx(p.x, p.y), p)) { p.x = c.x - fy * (c.w / 2 + 16); p.y = c.y + fx * (c.w / 2 + 16); }
        this.collide(p);
        p.vx = c.vx * 0.8; p.vy = c.vy * 0.8; p.stun = 2.6; p.slowT = 5;
        c.crack = 100;
        this.emit('glass', { x: p.x, y: p.y });
        this.emit('banner', { title: 'DURCHS FENSTER', sub: 'Ohne Gurt. [B] im Auto schnallt dich an.', kind: 'red' });
        this.hurt(p, 25 * (1 + sev), null, { kind: 'car', dir: c.a });
      } else if (c.belt && kmh > 120) this.hurt(p, (kmh - 120) * 0.25, null, { kind: 'car', dir: c.a });
      else if (!c.belt && kmh > 50) this.hurt(p, (kmh - 50) * 0.18, null, { kind: 'car', dir: c.a });
    },
    /** player-side controls while driving */
    driveControls(c, inp, pr) {
      this.initCarState(c);
      this.nitroHeld = !!inp.sprint;
      if (pr.b) { c.belt = !c.belt; this.emit('sfx', { s: c.belt ? 'belt' : 'unbelt' }); }
      if (pr.n) {
        if (c.engineOn) { c.engineOn = false; c.cruise = 0; this.emit('sfx', { s: 'stall' }); }
        else if (!(c.crankT > 0)) { c.crankT = c.hotwire ? 2.6 : 1.1; this.emit('sfx', { s: 'crank' }); }
      }
      if (pr.x) { if (c.cruise) c.cruise = 0; else if (c.speed * K.KMH >= 30 && c.engineOn) c.cruise = Math.min(c.vf, 250 / K.KMH); }
      if (pr.l) { c.lightMode = c.lightMode === 0 ? (this.daylight() < 0.5 ? 2 : 1) : c.lightMode === 1 ? 2 : c.lightMode === 2 ? -1 : 0; }
      if (pr.q) c.blink = c.blink === -1 ? 0 : -1;
      if (pr.e) c.blink = c.blink === 1 ? 0 : 1;
      if (pr.q && pr.e) c.blink = 2;
      if (inp.down && c.cruise) c.cruise = 0;
      // engine start on entering
      if (!c.engineOn && c.crankT == null && c.fuel > 0) { c.crankT = c.hotwire ? 2.6 : 1.1; this.emit('sfx', { s: 'crank' }); }
      // car weapons
      if (c.tune.mg && inp.fire && (this.mgT || 0) <= this.t) {
        this.mgT = this.t + 0.085;
        const fx = Math.cos(c.a), fy = Math.sin(c.a);
        for (const s of [-1, 1]) {
          const ang = c.a + U.gauss() * 0.03;
          this.projectiles.push({ x: c.x + fx * (c.l / 2 + 4) - fy * s * 8, y: c.y + fy * (c.l / 2 + 4) + fx * s * 8, vx: Math.cos(ang) * 1700 + c.vx, vy: Math.sin(ang) * 1700 + c.vy, dmg: 22, owner: this.player.id, car: c.id, w: 'mpk', life: 0.9, pierce: 0, dist: 0, fall: 0 });
        }
        this.emit('shot', { x: c.x + fx * c.l / 2, y: c.y + fy * c.l / 2, a: c.a, w: 'mpk', id: this.player.id, player: true, cls: 'smg' });
        this.noise(c.x, c.y, 14, 'shot', this.player);
        this.crimeEvent(this.player, 'shots', c.x, c.y, null);
        return true;
      }
      if (c.tune.rockets && pr.aim && (this.rocketT || 0) <= this.t) { this.rocketT = this.t + 1.4; this.fireRocket(c); }
      return !!c.tune.mg;
    },
    fireRocket(c) {
      const fx = Math.cos(c.a), fy = Math.sin(c.a);
      (this.rockets || (this.rockets = [])).push({ x: c.x + fx * (c.l / 2 + 10), y: c.y + fy * (c.l / 2 + 10), vx: fx * 900 + c.vx, vy: fy * 900 + c.vy, a: c.a, t: 0, car: c.id });
      this.emit('sfx', { s: 'rocket' }); this.noise(c.x, c.y, 12, 'shot', this.player);
    },
    updateRockets(dt) {
      if (!this.rockets || !this.rockets.length) return;
      this.rockets = this.rockets.filter((r) => {
        r.t += dt; r.x += r.vx * dt; r.y += r.vy * dt;
        if (Math.random() < dt * 60) this.emit('rocketTrail', { x: r.x, y: r.y });
        const tx = (r.x / TILE) | 0, ty = (r.y / TILE) | 0;
        const solid = tx < 0 || ty < 0 || tx >= this.W || ty >= this.H || (K.TF[this.tiles[ty * this.W + tx]] & 4) || (this.solid[ty * this.W + tx] & 2);
        const car = !solid && this.bulletCar(r.x, r.y, r.car);
        const hit = !solid && !car && this.near(r.x, r.y, 16).some((a) => a.alive && !a.inCar && a.kind !== 'player');
        if (solid || car || hit || r.t > 2.2) { this.explode(r.x - r.vx * dt, r.y - r.vy * dt, 120, 190, this.player); return false; }
        return true;
      });
    },
  });
})(globalThis.K = globalThis.K || {});
