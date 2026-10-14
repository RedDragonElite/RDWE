/* RDE // KONTRAKT — crime & heat: witnesses, reports, wanted stars, police dispatch, identity changes */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE;
  const SEV = { weapon: 1, trespass: 1, assault: 1, shots: 1, theft: 1, burglary: 1, murder: 2, copkill: 3, explosion: 2, body: 0, robbery: 2, drugs: 1, jailbreak: 3, resist: 2, masked: 1, heist: 3, graffiti: 1 };
  const WHAT = { weapon: 'Bewaffnete Person', trespass: 'Hausfriedensbruch', assault: 'Körperverletzung', shots: 'Schüsse gemeldet', theft: 'Autodiebstahl', burglary: 'Einbruch', murder: 'Mord', copkill: 'Polizistenmord', explosion: 'Explosion', robbery: 'Raubüberfall', drugs: 'Drogenhandel', jailbreak: 'Gefängnisausbruch', resist: 'Widerstand', masked: 'Vermummte Person', heist: 'Bankraub', graffiti: 'Graffiti-Sprayer' };
  K.CRIME_SEV = SEV;

  K.mixin({
    initCrime() {
      this.wanted = 0;
      this.heat = { x: 0, y: 0, seenT: 0, spawnT: 0, anon: false };
      this.charges = {};
    },
    /** player committed something at (x,y) — find who saw it */
    crimeEvent(perp, type, x, y, victim, force) {
      if (!perp || perp.kind !== 'player') return;
      for (const n of this.near(x, y, 24 * TILE)) {
        if (n === perp || !n.alive || n.ko > 0 || n.kind === 'player' || (n.inCar && !n.unit) || n.kind === 'crew') continue;
        if (victim && victim.crim && victim.kind === 'thug') continue; // stopping a robber is not a crime
        const close = Math.hypot(n.x - perp.x, n.y - perp.y) < 2.6 * TILE;
        const saw = n === victim || (close && K.los(this, n.x, n.y, perp.x, perp.y)) || this.sees(n, perp.x, perp.y, this.viewRange(n) * 1.15, 1.35);
        if (!saw) continue;
        this.witness(n, type, perp, x, y, victim);
      }
      if (force && type === 'murder') this.raiseWanted(0, type);
    },
    witness(n, type, perp, x, y, victim) {
      const sev = SEV[type] || 1;
      if (n.wit && n.wit.t > this.t - 1.5 && n.wit.sev >= sev) return;
      n.wit = { type, t: this.t, sev, x, y };
      n.knowsPlayer = true;
      if (type !== 'shots' || n.kind === 'cop') this.note('witness', { n, type });
      if (type === 'drugs' && n.kind !== 'cop') {
        // most people look away from a deal; some snitch
        if (Math.random() < 0.22 && !n.reportT) { n.reportT = 5 + Math.random() * 5; n.reportType = 'drugs'; n.reportX = x; n.reportY = y; }
        return;
      }
      switch (n.kind) {
        case 'cop': {
          this.raiseWanted(Math.max(sev, type === 'shots' || type === 'weapon' ? 1 : sev), type);
          if (type === 'shots' || type === 'murder' || type === 'copkill' || type === 'explosion') this.lastThreatT = this.t;
          if (n.inCar) { const c = this.cars.find((q) => q.id === n.inCar); if (c && c.unit && c.unit.mode === 'patrol') { c.unit.mode = 'respond'; c.unit.dest = { x, y }; c.siren = true; } break; }
          if (this.copMayShoot()) this.alarm(n, perp); else this.startArrest(n);
          break;
        }
        case 'guard': case 'bodyguard': case 'gang':
          if (type === 'trespass' && n.state !== 'hostile') { this.onSuspicious(n, 'trespass'); break; }
          this.alarm(n, perp);
          break;
        case 'target':
          this.panic(n, x, y);
          break;
        default: // civilians, shopkeepers, staff
          if (n.armedKeeper && (type === 'shots' || type === 'murder' || type === 'assault')) { this.alarm(n, perp); break; }
          this.flee(n, x, y, true);
          if (sev > 0 && !n.reportT) { n.reportT = 3.5 + Math.random() * 4; n.reportType = type; n.reportX = x; n.reportY = y; }
      }
    },
    /** a civilian finished the phone call */
    report(n) {
      const type = n.reportType; n.reportT = 0;
      if (n.reportFoe) {
        const f = this.byId.get(n.reportFoe); n.reportFoe = 0;
        this.bark(n, U.pick(['Polizei? Ich wurde überfallen!', 'Hallo? Hier ist gerade ein Raub passiert!']));
        if (f && f.alive) this.dispatch(f.x, f.y, 2, { foe: f.id });
        return;
      }
      if (type === 'body') { this.policeInvestigate(n.reportX, n.reportY); this.bark(n, 'Polizei?! Hier liegt eine Leiche!'); return; }
      this.bark(n, U.pick(['Polizei! Schnell!', 'Hallo, Polizei? Hier ist ein Irrer!', 'Kommen Sie sofort!']));
      this.raiseWanted(SEV[type] || 1, type);
    },
    raiseWanted(level, type) {
      const P = this.P;
      // already behind bars: crimes in the cell just add time
      if (P.jail && !P.jail.escaped) {
        const add = (K.CRIMES[type] && K.CRIMES[type].jail) || 60;
        P.jail.until += add; this.addCharge(type);
        this.notify(`${(K.CRIMES[type] || { name: type }).name}: +${Math.round(add / 60 * 10) / 10}h Haft`, 'bad');
        return;
      }
      const prev = this.wanted;
      if (prev <= 0) this.heat.anon = !!P.masked; else if (!P.masked) this.heat.anon = false;
      this.addCharge(type);
      let w = Math.max(prev, level);
      if (prev >= 2 && (type === 'murder' || type === 'copkill') && level >= 2) w = Math.min(5, prev + (type === 'copkill' ? 1 : 0.5));
      w = Math.min(5, w);
      this.wanted = w;
      const p = this.player;
      this.heat.x = p.x; this.heat.y = p.y; this.heat.seenT = 0;
      if (Math.floor(w) > Math.floor(prev)) {
        this.emit('wanted', { level: Math.floor(w), prev: Math.floor(prev), why: WHAT[type] || '' });
        this.note('wanted', { level: w });
      }
    },
    policeInvestigate(x, y) {
      const cops = this.actors.filter((c) => c.kind === 'cop' && c.alive && !c.ko && !c.removed && c.state === 'patrol');
      cops.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
      for (const c of cops.slice(0, 2)) { c.state = 'respond'; c.brain.tx = x; c.brain.ty = y; c.path = null; }
      if (cops.length < 2) this.spawnCopNear(x, y, 'respond', x, y);
    },
    identityChanged() {
      if (this.wanted <= 0) return;
      const seen = this.actors.some((c) => (c.kind === 'cop' || c.kind === 'guard') && c.alive && c.seesPlayer);
      if (seen) { this.notify('Sie haben dich beim Umziehen gesehen!', 'bad'); return; }
      const before = Math.floor(this.wanted);
      this.wanted = Math.max(0, this.wanted - 2);
      for (const c of this.actors) if (c.kind === 'cop' || c.kind === 'guard') { c.knowsPlayer = false; c.susp = 0; }
      if (this.wanted <= 0) { this.charges = {}; this.heat.anon = false; }
      if (Math.floor(this.wanted) < before) { this.emit('wanted', { level: Math.floor(this.wanted), prev: before, why: 'Identität gewechselt' }); }
    },
    updateCrime(dt) {
      const p = this.player;
      if (!p.alive) return;
      // civilians on the phone
      for (const n of this.actors) if (n.reportT > 0 && n.alive && !n.ko) { n.reportT -= dt; if (n.reportT <= 0) this.report(n); }
      this.updatePolice(dt);
      if (this.wanted <= 0) return;
      const seen = this.actors.some((c) => c.kind === 'cop' && c.alive && !c.ko && c.seesPlayer) || this.cars.some((c) => c.kind === 'police' && c.driver && c.driver !== 'player' && c.seesPlayer);
      if (seen) { this.heat.x = p.x; this.heat.y = p.y; this.heat.seenT = 0; }
      else if (!this.cars.some((c) => c.unit && c.unit.mode === 'respond' && this.t - c.unit.t0 < 60)) this.heat.seenT += dt; // the call stays open while units are en route
      const lose = 24 + this.wanted * 8;
      this.heatProgress = U.clamp(this.heat.seenT / lose, 0, 1);
      if (this.heat.seenT > lose) {
        const prev = Math.floor(this.wanted);
        this.wanted = Math.max(0, Math.floor(this.wanted) - 1);
        this.heat.seenT = 0;
        this.emit('wanted', { level: this.wanted, prev, why: this.wanted ? 'Spur verwischt' : 'Fahndung eingestellt' });
        if (!this.wanted) { this.charges = {}; this.heat.anon = false; for (const c of this.actors) if (c.kind === 'cop' && c.state !== 'station' && !c.inCar) this.calmDown(c); }
      }
    },
    spawnCopNear(x, y, state, tx, ty) {
      const p = this.player;
      for (let pass = 0; pass < 2; pass++) for (let k = 0; k < 24; k++) {
        const ang = Math.random() * U.TAU, dist = (16 + Math.random() * 12) * TILE;
        const cx = x + Math.cos(ang) * dist, cy = y + Math.sin(ang) * dist;
        if (cx < TILE || cy < TILE || cx > (this.W - 1) * TILE || cy > (this.city.W - 1) * TILE) continue;
        const i = this.nav.nearestFree(this.tileIdx(cx, cy), null, 3);
        if (i < 0 || this.bmap[i] >= 0 || this.zmap[i] >= 0) continue;
        const sx = (i % this.W + 0.5) * TILE, sy = (((i / this.W) | 0) + 0.5) * TILE;
        const dp = Math.hypot(sx - p.x, sy - p.y);
        if (dp < 13 * TILE || (pass === 0 && dp < 26 * TILE && K.los(this, p.x, p.y, sx, sy))) continue;
        return this.spawnCop(sx, sy, state, tx, ty);
      }
      return null;
    },
    spawnCop(x, y, state, tx, ty) {
      const swat = this.wanted >= 4;
      const c = this.spawnActor('cop', x, y, { outfit: 'police', weapon: swat ? (Math.random() < 0.5 ? 'k47' : 'pump') : Math.random() < 0.15 ? 'pump' : 'p9', hp: swat ? 160 : 120, armor: swat ? 60 : 20, state: state || 'patrol', reserve: -1, female: Math.random() < 0.3 });
      c.acc = swat ? 2.0 : 2.7; c.swat = swat; c.brain.tx = tx; c.brain.ty = ty; c.crossOk = true;
      return c;
    },
  });
})(globalThis.K = globalThis.K || {});
