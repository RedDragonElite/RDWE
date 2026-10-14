/* RDE // KONTRAKT — factions & realistic policing.
 * Nobody walks the beat any more: patrol cars cruise, dispatch sends units from far away that drive
 * in on the road network, park at the scene, deploy, investigate, and drive off again.
 * Rules of engagement: arrest first; weapons only against armed or shooting suspects. */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE;
  const P_ = 26, NB = 7, LANE = 32;
  const nodeXY = (i, j) => [(i * P_ + 2) * TILE, (j * P_ + 2) * TILE];

  K.mixin({
    // ============================================================ factions
    faction(a) {
      if (!a) return 'none';
      switch (a.kind) {
        case 'player': case 'crew': return 'P';
        case 'cop': return 'police';
        case 'guard': case 'bodyguard': case 'target': case 'keeper': case 'staff': return 'sec';
        case 'gang': return 'gang:' + (a.gang || 'docks');
        case 'thug': return 'thug';
        default: return 'civ';
      }
    },
    isFighter(a) { return ['cop', 'guard', 'bodyguard', 'gang', 'crew', 'thug'].includes(a.kind) || !!a.armedKeeper; },
    enemies(a, b) {
      const fa = this.faction(a), fb = this.faction(b);
      if (fa === fb || fa === 'civ' || fb === 'civ' && !b.crim) return false;
      return true;
    },
    /** may police open fire on the player right now? */
    copMayShoot() {
      const w = Math.floor(this.wanted), p = this.player;
      if (w >= 4) return true;
      if (this.t - (this.lastThreatT || -99) < 12) return true;   // shot near cops, hurt or aimed at a cop
      if (w >= 3 && (this.playerArmed() || p.inCar)) return true;
      return false;
    },
    /** per-kind threat scans (crew / gangs extend this) */
    scanThreats(a, range) {
      const fn = this['scan_' + a.kind];
      if (fn) fn.call(this, a, range);
    },
    scan_cop(a, range) {
      if (a.state === 'hostile' || a.ko > 0) return;
      for (const t of this.near(a.x, a.y, range)) {
        if (t.kind !== 'thug' || !t.alive || !t.crim) continue;
        if (!this.sees(a, t.x, t.y, range, 1.2)) continue;
        this.bark(a, U.pick(['Polizei! Stehen bleiben!', 'Hände hoch, du Ratte!']));
        this.alarm(a, t);
        if (a.unit) { const c = this.cars.find((q) => q.id === a.unit); if (c && c.unit) c.unit.busy = true; }
        return;
      }
    },

    // ============================================================ dispatch
    copUnits() { return this.cars.filter((c) => c.kind === 'police' && !c.dead && c.unit); },
    roadNodeFar(x, y, dmin, dmax) {
      const p = this.player;
      let best = null;
      for (let k = 0; k < 40; k++) {
        const i = U.rint(NB + 1), j = U.rint(NB + 1);
        const [nx, ny] = nodeXY(i, j);
        const d = Math.hypot(nx - x, ny - y), dp = Math.hypot(nx - p.x, ny - p.y);
        if (d < dmin * TILE || d > dmax * TILE) continue;
        if (dp < 22 * TILE || (dp < 40 * TILE && K.los(this, p.x, p.y, nx, ny))) continue;
        best = [i, j]; break;
      }
      return best;
    },
    spawnUnit(x, y, mode, o = {}) {
      const node = this.roadNodeFar(x, y, o.dmin || 26, o.dmax || 55) || this.roadNodeFar(x, y, 18, 80);
      if (!node) return null;
      const [i, j] = node, nb = this.roadNeighbors(i, j);
      const [ni, nj] = U.pick(nb);
      const [x0, y0] = nodeXY(i, j), [x1, y1] = nodeXY(ni, nj);
      const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
      const c = this.spawnCar('police', x0 + (x1 - x0) * 0.35 - dy * LANE, y0 + (y1 - y0) * 0.35 + dx * LANE, Math.atan2(dy, dx));
      c.ai = { fi: i, fj: j, ti: ni, tj: nj, stage: 'road', wp: null };
      c.unit = { mode, dest: { x, y }, prio: o.prio || 1, foe: o.foe || 0, t0: this.t, crew: [] };
      c.siren = (o.prio || 1) >= 2;
      const swat = this.wanted >= 4;
      for (let k = 0; k < 2; k++) {
        const cop = this.spawnCop(c.x, c.y, 'incar', x, y);
        cop.inCar = c.id; cop.unit = c.id; c.unit.crew.push(cop.id);
        if (swat) { cop.outfit = 'police'; cop.swat = true; }
      }
      c.driver = c.unit.crew[0]; c.passengers = c.unit.crew.slice(1);
      return c;
    },
    /** send the closest free unit, or a new one from out of town */
    dispatch(x, y, prio = 1, o = {}) {
      let best = null, bd = 1e9;
      for (const c of this.copUnits()) {
        if (c.unit.mode !== 'patrol' || !c.driver) continue;
        const d = Math.hypot(c.x - x, c.y - y);
        if (d < 45 * TILE && d < bd) { bd = d; best = c; }
      }
      if (best) { Object.assign(best.unit, { mode: 'respond', dest: { x, y }, prio, foe: o.foe || 0, t0: this.t }); best.siren = prio >= 2; return best; }
      return this.spawnUnit(x, y, 'respond', { prio, foe: o.foe });
    },
    policeInvestigate(x, y, foe) { this.dispatch(x, y, foe ? 2 : 1, { foe }); },
    spawnCopNear(x, y, state, tx, ty) { const c = this.dispatch(tx != null ? tx : x, ty != null ? ty : y, this.wanted >= 2 ? 2 : 1); return c ? this.byId.get(c.driver) : null; },
    ensurePoliceCars() {},

    // ============================================================ per-frame police logic
    updatePolice(dt) {
      const p = this.player;
      this.polT = (this.polT || 0) - dt;
      const units = this.copUnits();
      // keep the occupants glued to their car
      for (const c of units) for (const id of c.unit.crew) { const a = this.byId.get(id); if (a && a.inCar === c.id) { a.x = c.x; a.y = c.y; a.angle = c.a; } }
      // patrol cars cruising the city
      const h = this.hour(), patrolWant = this.wanted > 0 ? 0 : h >= 7 && h < 22 ? 2 : 1;
      const patrols = units.filter((c) => c.unit.mode === 'patrol').length;
      if (patrols < patrolWant && this.polT <= 0) {
        this.polT = 4;
        const c = this.spawnUnit(p.x, p.y, 'patrol', { dmin: 26, dmax: 50 });
        if (c) c.siren = false;
      }
      // reinforcements by wanted level
      if (this.wanted > 0) {
        const want = [0, 1, 2, 3, 4, 5][Math.floor(this.wanted)];
        const busy = units.filter((c) => c.unit.mode !== 'patrol' && c.unit.mode !== 'leave').length;
        this.heat.spawnT -= dt;
        if (busy < want && this.heat.spawnT <= 0) {
          this.heat.spawnT = 11 - this.wanted;
          this.dispatch(this.heat.x, this.heat.y, this.wanted >= 2 ? 2 : 1);
        }
      }
      for (const c of units) this.unitThink(c, dt);
    },
    unitThink(c, dt) {
      const u = c.unit, p = this.player;
      c.thinkT = (c.thinkT || 0) - dt;
      if (c.thinkT > 0) return;
      c.thinkT = 0.3;
      const tgt = p.inCar ? this.carOf(p) : p;
      const d = Math.hypot(tgt.x - c.x, tgt.y - c.y);
      c.seesPlayer = !!c.driver && d < 16 * TILE && K.los(this, c.x, c.y, tgt.x, tgt.y) && p.alive;
      if (c.seesPlayer && this.wanted > 0) { this.heat.x = tgt.x; this.heat.y = tgt.y; this.heat.seenT = 0; }
      if (u.mode === 'patrol') {
        if (c.seesPlayer && this.wanted > 0) { u.mode = p.inCar ? 'pursuit' : 'respond'; u.dest = { x: p.x, y: p.y }; c.siren = true; }
        else if (c.seesPlayer && !p.inCar && this.playerArmed() && d < 12 * TILE) { u.mode = 'respond'; u.dest = { x: p.x, y: p.y }; u.prio = 1; this.raiseWanted(1, 'weapon'); }
        else for (const t of this.near(c.x, c.y, 14 * TILE)) if (t.kind === 'thug' && t.alive && t.crim && K.los(this, c.x, c.y, t.x, t.y)) { u.mode = 'respond'; u.dest = { x: t.x, y: t.y }; u.foe = t.id; c.siren = true; break; }
      } else if (u.mode === 'respond') {
        if (this.wanted > 0 && c.seesPlayer && p.inCar) u.mode = 'pursuit';
        if (u.foe) { const f = this.byId.get(u.foe); if (f && f.alive) u.dest = { x: f.x, y: f.y }; }
        else if (this.wanted > 0 && c.seesPlayer) u.dest = { x: tgt.x, y: tgt.y };
        const dd = Math.hypot(u.dest.x - c.x, u.dest.y - c.y);
        const atEnd = c.route && c.routeI >= c.route.length - 1 && c.speed < 30 && Math.hypot(c.route[c.route.length - 1][0] - c.x, c.route[c.route.length - 1][1] - c.y) < 60;
        if (dd < 5 * TILE || atEnd || (dd < 9 * TILE && c.speed < 25 && this.t - u.t0 > 8) || (c.seesPlayer && this.wanted > 0 && !p.inCar && d < 9 * TILE) || this.t - u.t0 > 150) this.deployUnit(c);
      } else if (u.mode === 'pursuit') {
        if (!p.inCar && d < 9 * TILE) this.deployUnit(c);
        if (this.wanted <= 0) { u.mode = 'patrol'; c.siren = false; }
      } else if (u.mode === 'onscene') {
        // everyone back in the car?
        const inside = u.crew.filter((id) => { const a = this.byId.get(id); return a && a.alive && a.inCar === c.id; });
        const alive = u.crew.filter((id) => { const a = this.byId.get(id); return a && a.alive && !a.removed; });
        if (alive.length && inside.length === alive.length) {
          c.driver = inside[0]; c.passengers = inside.slice(1);
          u.mode = this.wanted > 0 ? 'respond' : 'leave'; u.dest = { x: this.heat.x, y: this.heat.y }; u.t0 = this.t; u.foe = 0;
          c.siren = this.wanted >= 2;
        } else if (!alive.length) { u.mode = 'abandoned'; c.siren = false; c.driver = null; }
      } else if (u.mode === 'leave') {
        if (Math.hypot(c.x - p.x, c.y - p.y) > 48 * TILE && !K.los(this, p.x, p.y, c.x, c.y)) this.despawnCar(c);
      }
    },
    deployUnit(c) {
      const u = c.unit;
      u.mode = 'onscene';
      c.vx *= 0.3; c.vy *= 0.3;
      for (const id of u.crew) {
        const a = this.byId.get(id); if (!a || !a.alive || a.inCar !== c.id) continue;
        this.ejectFrom(c, a, false);
        a.state = 'respond'; a.brain.tx = u.dest.x; a.brain.ty = u.dest.y; a.path = null; a.goal = null; a.foe = 0;
        if (u.foe) { const f = this.byId.get(u.foe); if (f && f.alive) this.alarm(a, f); }
        else if (this.wanted > 0 && a.seesPlayer) { if (this.copMayShoot()) this.alarm(a, this.player); else this.startArrest(a); }
      }
      c.driver = null; c.passengers = [];
      c.parkedUnit = true;
      this.emit('copsArrive', { x: c.x, y: c.y });
    },
    /** BFS over the intersection grid → lane waypoints → a road tile next to the destination */
    planRoute(c, dest) {
      const ni = (x) => U.clamp(Math.round((x / TILE - 2) / P_), 0, NB);
      // start from the intersection ahead of us so we never U-turn across the curb
      const s = [ni(c.x + Math.cos(c.a) * 140), ni(c.y + Math.sin(c.a) * 140)], g = [ni(dest.x), ni(dest.y)];
      const key = (n) => n[0] * 16 + n[1], prev = new Map([[key(s), null]]), q = [s];
      while (q.length) { const n = q.shift(); if (n[0] === g[0] && n[1] === g[1]) break; for (const m of this.roadNeighbors(n[0], n[1])) if (!prev.has(key(m))) { prev.set(key(m), n); q.push(m); } }
      const path = []; for (let n = g; n; n = prev.get(key(n))) path.unshift(n);
      const wps = [];
      { // join the lane into the first intersection
        const hx = Math.abs(Math.cos(c.a)) > Math.abs(Math.sin(c.a)) ? Math.sign(Math.cos(c.a)) : 0, hy = hx ? 0 : Math.sign(Math.sin(c.a));
        const [sx, sy] = nodeXY(...path[0]);
        wps.push([sx - hx * 80 - hy * LANE, sy - hy * 80 + hx * LANE]);
      }
      for (let k = 0; k < path.length - 1; k++) {
        const [ax, ay] = nodeXY(...path[k]), [bx, by] = nodeXY(...path[k + 1]);
        const dx = Math.sign(bx - ax), dy = Math.sign(by - ay);
        wps.push([ax + dx * 70 - dy * LANE, ay + dy * 70 + dx * LANE], [bx - dx * 70 - dy * LANE, by - dy * 70 + dx * LANE]);
      }
      // finish on the road tile closest to the destination
      let best = null, bd = 1e9;
      const tx = (dest.x / TILE) | 0, ty = (dest.y / TILE) | 0;
      for (let j = ty - 7; j <= ty + 7; j++) for (let i = tx - 7; i <= tx + 7; i++) {
        if (i < 0 || j < 0 || i >= this.W || j >= this.H || this.tiles[j * this.W + i] !== K.T.ROAD) continue;
        const d = Math.hypot(i - tx, j - ty); if (d < bd) { bd = d; best = [(i + 0.5) * TILE, (j + 0.5) * TILE]; }
      }
      if (best) wps.push(best);
      let i0 = 0;
      while (i0 < wps.length - 1 && ((wps[i0][0] - c.x) * Math.cos(c.a) + (wps[i0][1] - c.y) * Math.sin(c.a)) < 0) i0++;
      c.route = wps; c.routeI = i0; c.routeDest = { x: dest.x, y: dest.y }; c.routeT = this.t;
    },
    /** police car driving: patrol cruises traffic lanes, respond/pursuit follow a planned route */
    unitDrive(c, dt) {
      const u = c.unit;
      if (u.mode === 'patrol' || u.mode === 'leave') return this.trafficDrive(c, dt);
      if (u.mode === 'onscene' || u.mode === 'abandoned') return [c.vf > 5 ? -1 : 0, 0, false];
      const p = this.player;
      const tgt = u.mode === 'pursuit' ? (p.inCar ? this.carOf(p) : p) : u.dest;
      const d = Math.hypot(tgt.x - c.x, tgt.y - c.y);
      const direct = d < 11 * TILE && K.los(this, c.x, c.y, tgt.x, tgt.y);
      let wx, wy, last = false;
      if (direct && u.mode === 'pursuit') { wx = tgt.x; wy = tgt.y; }
      else {
        if (!c.route || Math.hypot(c.routeDest.x - tgt.x, c.routeDest.y - tgt.y) > 6 * TILE || (u.mode === 'pursuit' && this.t - c.routeT > 6)) this.planRoute(c, tgt);
        const behind = (q) => (q[0] - c.x) * Math.cos(c.a) + (q[1] - c.y) * Math.sin(c.a) < -12;
        while (c.routeI < c.route.length - 1 && (Math.hypot(c.route[c.routeI][0] - c.x, c.route[c.routeI][1] - c.y) < 40 || behind(c.route[c.routeI]))) c.routeI++;
        [wx, wy] = c.route[c.routeI] || [tgt.x, tgt.y];
        last = c.routeI >= c.route.length - 1;
      }
      const want = Math.atan2(wy - c.y, wx - c.x), dw = Math.hypot(wx - c.x, wy - c.y);
      const steer = U.clamp(U.angDiff(c.a, want) * 2.4, -1, 1);
      const top = u.prio >= 2 || u.mode === 'pursuit' ? 1 : 0.6;   // code 1: no rush, no siren
      let tgtV = 240 * top + 40;
      const turn = Math.abs(U.angDiff(c.a, want));
      if (turn > 0.5) tgtV = Math.min(tgtV, 110);
      if (last) tgtV = Math.min(tgtV, 40 + dw * 1.2);
      const ob = this.obstacleAhead(c);
      if (ob === 'car' || ob === 'ped') tgtV = c.siren ? Math.min(tgtV, 60) : 0;
      const vf = c.vf || 0;
      let thr = vf < tgtV - 10 ? 1 : vf > tgtV + 20 ? -0.8 : 0;
      if (last && dw < 26) thr = vf > 10 ? -1 : 0;
      if (c.speed < 15 && thr > 0) { c.stuckT = (c.stuckT || 0) + dt; c.stuckTot = (c.stuckTot || 0) + dt; if (c.stuckT > 1.4) { thr = -1; if (c.stuckT > 2.4) { c.stuckT = 0; c.route = null; } } } else { c.stuckT = 0; if (c.speed > 60) c.stuckTot = 0; }
      if (c.stuckTot > 6) this.unstickCar(c, wx, wy);
      // no real progress towards the target for a while → re-route / hop back onto the road (off-camera)
      c.progT = (c.progT || 0) + dt;
      if (c.bestD == null || d < c.bestD - 2 * TILE) { c.bestD = d; c.progT = 0; }
      if (c.progT > 14 && u.mode !== 'pursuit') { c.progT = 0; c.bestD = null; c.route = null; this.unstickCar(c, wx, wy); }
      return [thr, thr < 0 && c.stuckT > 1.4 ? -steer : steer, turn > 1.3 && vf > 200];
    },

    /** last resort when a car is wedged: hop back onto the nearest free road tile (only off-camera) */
    unstickCar(c, wx, wy) {
      c.stuckTot = 0;
      const p = this.player;
      if (Math.hypot(c.x - p.x, c.y - p.y) < 22 * TILE && K.los(this, p.x, p.y, c.x, c.y)) return;
      const tx = (c.x / TILE) | 0, ty = (c.y / TILE) | 0;
      let best = null, bd = 1e9;
      for (let j = ty - 9; j <= ty + 9; j++) for (let i = tx - 9; i <= tx + 9; i++) {
        if (i < 0 || j < 0 || i >= this.W || j >= this.H || this.tiles[j * this.W + i] !== K.T.ROAD) continue;
        const x = (i + 0.5) * TILE, y = (j + 0.5) * TILE, a = Math.atan2(wy - y, wx - x);
        if (this.carBlocked(c, x, y, a)) continue;
        const d = Math.hypot(x - c.x, y - c.y) + Math.hypot(wx - x, wy - y) * 0.2;
        if (d < bd) { bd = d; best = [x, y, a]; }
      }
      if (best) { [c.x, c.y, c.a] = best; c.vx = c.vy = 0; c.route = null; }
    },
    // ============================================================ cops on foot after a call
    ai_incar() {},
    ai_return(a, dt) {
      const c = this.cars.find((q) => q.id === a.unit && !q.dead && q.unit);
      if (!c) { a.unit = 0; a.state = 'patrol'; return; }
      if (this.wanted > 0 && a.seesPlayer) { if (this.copMayShoot()) this.alarm(a, this.player); else this.startArrest(a); return; }
      this.goTo(a, c.x, c.y, { tol: 30 });
      a.dv = this.steer(a, 90, dt);
      if (Math.hypot(c.x - a.x, c.y - a.y) < c.l / 2 + 16) { a.inCar = c.id; a.state = 'incar'; a.vx = a.vy = 0; }
    },
  });
})(globalThis.K = globalThis.K || {});
