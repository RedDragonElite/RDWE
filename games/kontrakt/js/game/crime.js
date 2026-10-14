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
      this.heat = { x: 0, y: 0, vx: 0, vy: 0, seenT: 0, decayT: 0, spawnT: 0, anon: false, search: null };
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
          if (sev > 0 && !n.reportT && this.wouldCall(n, type, x, y)) this.startCall(n, type, x, y);
      }
    },
    /** does this witness pick up the phone? (rde_aipd: area, time of day, shock) */
    wouldCall(n, type, x, y) {
      for (const o of this.near(x, y, 20 * TILE)) if (o !== n && o.reportT > 0 && o.reportType === type) return false;   // someone's already on it
      let ch = { down: 0.6, old: 0.5, beach: 0.5, park: 0.42, res: 0.42, hill: 0.38, ind: 0.24, docks: 0.2 }[this.districtAt(x, y)] || 0.45;
      const h = this.hour();
      if (h >= 22 || h < 6) ch *= 0.6; else if (h >= 18) ch *= 0.85;
      if (this.t - (this.lastPlayerShotT || -99) < 5) ch *= 0.55;   // heads down while bullets fly
      if (SEV[type] >= 2) ch = Math.min(0.95, ch * 1.5);
      return Math.random() < ch || this.forceCalls;
    },
    /** react → panic → dial → talk: 5–9 s in which you can still stop the call */
    startCall(n, type, x, y) {
      const dur = 5 + Math.random() * 4;
      n.call = { t0: this.t, dial: 0.8 + Math.random() * 1.2 + 1.5 + Math.random() * 2, dur };
      n.reportT = dur; n.reportType = type; n.reportX = x; n.reportY = y;
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
      this.raiseWanted(SEV[type] || 1, type, n.reportX, n.reportY);
      n.call = null;
    },
    raiseWanted(level, type, sx, sy) {
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
      // the report gives the scene, not where you are now
      this.heat.x = sx != null ? sx : p.x; this.heat.y = sy != null ? sy : p.y; this.heat.seenT = 0; this.heat.decayT = 0; if (sx != null) { this.heat.vx = 0; this.heat.vy = 0; }
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
      for (const n of this.actors) if (n.reportT > 0 && n.alive && !n.ko) {
        if (!n.call && !n.reportFoe) n.call = { t0: this.t, dial: Math.min(2.5, n.reportT * 0.4), dur: n.reportT };   // every report is a phone call
        // walk up to a caller and they hang up (intimidated); knock them out or kill them and nobody calls
        if (n.call && this.t - n.call.t0 > n.call.dial && !p.hidden && Math.hypot(n.x - p.x, n.y - p.y) < 2.6 * TILE && K.los(this, n.x, n.y, p.x, p.y)) {
          n.reportT = 0; n.call = null;
          this.bark(n, U.pick(['Okay, okay! Ich leg auf!', 'Bitte nicht! Ich hab nichts gesagt!', 'Schon gut, kein Anruf!']), 2.2);
          this.flee(n, p.x, p.y, false); n.reportT = 0;
          continue;
        }
        n.reportT -= dt; if (n.reportT <= 0) this.report(n);
      }
      this.updatePolice(dt);
      if (this.wanted <= 0) { if (this.updateManhunt) this.updateManhunt(dt, false); return; }
      const seen = this.actors.some((c) => c.kind === 'cop' && c.alive && !c.ko && c.seesPlayer) || this.cars.some((c) => c.kind === 'police' && c.driver && c.driver !== 'player' && c.seesPlayer);
      if (this.updateManhunt) this.updateManhunt(dt, seen); else if (seen) { this.heat.x = p.x; this.heat.y = p.y; this.heat.seenT = 0; }
      const H = this.heat, HU = K.HUNT || { unseenGrace: 15, starEvery: 20 };
      if (H.seenT > 0 || !seen) H.seenT += dt;
      if (seen || (this.heli && this.heli.sees)) { H.seenT = 0; H.decayT = 0; }
      if (this.P.surrender || this.arrestProgress > 0.05) H.decayT = 0;
      else if (H.seenT > HU.unseenGrace) H.decayT = (H.decayT || 0) + dt;   // rde_aipd: 15 s unseen, then a star every 20 s
      this.heatProgress = H.seenT < HU.unseenGrace ? (H.seenT / HU.unseenGrace) * 0.35 : 0.35 + 0.65 * U.clamp((H.decayT || 0) / HU.starEvery, 0, 1);
      if ((H.decayT || 0) > HU.starEvery) {
        const prev = Math.floor(this.wanted);
        this.wanted = Math.max(0, Math.floor(this.wanted) - 1);
        H.decayT = 0;
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
      const c = this.spawnActor('cop', x, y, { outfit: 'police', weapon: swat ? U.pick(['ar15', 'ar15', 'pump', 'dmr']) : Math.random() < 0.15 ? 'pump' : 'p9', hp: swat ? 160 : 120, armor: swat ? 60 : 20, state: state || 'patrol', reserve: -1, female: Math.random() < 0.3 });
      c.acc = swat ? 2.0 : 2.7; c.swat = swat; c.brain.tx = tx; c.brain.ty = ty; c.crossOk = true;
      return c;
    },
  });
})(globalThis.K = globalThis.K || {});
