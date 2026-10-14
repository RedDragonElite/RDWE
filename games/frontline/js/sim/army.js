/* RDE // FRONTLINE — army mixin: controllable units (infantry, tanks, artillery)
 *
 * Units are spearheads: they march along an A* path over land, conquer a swath of
 * land around them (paying from their own strength), fight enemy units they meet
 * and – for artillery – shell targets at range. Deterministic, intent-driven.
 */
(function (BW) {
  'use strict';
  const C = BW.C, T = C.T;
  const MOVE_COST = [99, 99, 1, 1, 1.3, 1.6, 2.4, 3];

  BW.SimArmy = {
    _initArmy() {
      this.units = [];
      this.shells = [];
      const N = this.N;
      this._aG = new Float32Array(N);
      this._aStamp = new Uint32Array(N);
      this._aClosed = new Uint32Array(N);
      this._aPrev = new Int32Array(N);
      this._hT = new Int32Array(N);
      this._hF = new Float32Array(N);
      this._aRun = 0;
    },

    unitsOf(pid) { return this.units.filter(u => u.owner === pid); },
    unitById(id) { return this.units.find(u => u.id === id); },

    // ------------------------------------------------------------ A* over land, terrain weighted
    findPath(start, goal) {
      if (start === goal) return Int32Array.of(start);
      const W = this.W, ter = this.terrain, g = this._aG, st = this._aStamp, cl = this._aClosed, prev = this._aPrev;
      const hT = this._hT, hF = this._hF;
      const run = ++this._aRun;
      const gx = goal % W, gy = (goal / W) | 0;
      let n = 0;
      const push = (t, f) => {
        let i = n++;
        while (i > 0) { const p = (i - 1) >> 1; if (hF[p] <= f) break; hT[i] = hT[p]; hF[i] = hF[p]; i = p; }
        hT[i] = t; hF[i] = f;
      };
      const pop = () => {
        const top = hT[0], lt = hT[--n], lf = hF[n];
        let i = 0;
        for (;;) {
          let c = 2 * i + 1;
          if (c >= n) break;
          if (c + 1 < n && hF[c + 1] < hF[c]) c++;
          if (hF[c] >= lf) break;
          hT[i] = hT[c]; hF[i] = hF[c]; i = c;
        }
        hT[i] = lt; hF[i] = lf;
        return top;
      };
      st[start] = run; g[start] = 0; prev[start] = -1;
      push(start, 0);
      let found = false, budget = 160000;
      while (n > 0 && budget-- > 0) {
        const t = pop();
        if (cl[t] === run) continue;
        cl[t] = run;
        if (t === goal) { found = true; break; }
        const k = this.nbrs(t), nb = [this._nb[0], this._nb[1], this._nb[2], this._nb[3]];
        for (let i = 0; i < k; i++) {
          const u = nb[i];
          if (ter[u] < T.BEACH || cl[u] === run) continue;
          const ng = g[t] + MOVE_COST[ter[u]];
          if (st[u] === run && ng >= g[u]) continue;
          st[u] = run; g[u] = ng; prev[u] = t;
          const ux = u % W, uy = (u / W) | 0;
          push(u, ng + Math.abs(ux - gx) + Math.abs(uy - gy));
        }
      }
      if (!found) return null;
      const path = [];
      for (let t = goal; t !== -1; t = prev[t]) path.push(t);
      path.reverse();
      return Int32Array.from(path);
    },
    _nearestLand(tile, r = 8) {
      if (this.isLand(tile)) return tile;
      const [cx, cy] = this.xy(tile);
      let best = -1, bd = 1e9;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= this.W || y >= this.H) continue;
        const t = y * this.W + x;
        if (this.isLand(t) && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = t; }
      }
      return best;
    },

    // ------------------------------------------------------------ commands
    cmdDeploy(p, kind, tile, ratio) {
      const d = C.UNITS[kind];
      if (!d || tile < 0 || tile >= this.N) return;
      if (d.tech && !this.has(p, d.tech)) { this.emit('fail', { pid: p.id, msg: 'Erst erforschen: ' + C.TECH[d.tech].e + ' ' + C.TECH[d.tech].name }); return; }
      if (this.owner[tile] !== p.id) { this.emit('fail', { pid: p.id, msg: 'Armeen nur auf eigenem Land aufstellen.' }); return; }
      if (this.unitsOf(p.id).length >= C.MAX_UNITS) { this.emit('fail', { pid: p.id, msg: 'Maximal ' + C.MAX_UNITS + ' Armeen.' }); return; }
      if (!this.canAfford(p, d.cost)) { this.emit('fail', { pid: p.id, msg: 'Nicht genug Ressourcen.' }); return; }
      const str = Math.floor(p.troops * Math.max(0.01, Math.min(1, +ratio || 0.3)));
      if (str < C.MIN_UNIT) { this.emit('fail', { pid: p.id, msg: 'Zu wenige Truppen (min. ' + C.MIN_UNIT + ').' }); return; }
      this.pay(p, d.cost);
      p.troops -= str;
      const [x, y] = this.xy(tile);
      const u = { id: this.nextId++, owner: p.id, kind, str, max: str, x: x + 0.5, y: y + 0.5, px: x + 0.5, py: y + 0.5,
        path: null, pi: 0, goal: -1, fight: 0, heading: 0, cd: 0, born: this.tick };
      this.units.push(u);
      this.emit('deploy', { pid: p.id, uid: u.id, kind, x, y, str });
      return u;
    },
    _order(p, u, tile) {
      const goal = this._nearestLand(tile);
      if (goal < 0) return false;
      const here = Math.floor(u.y) * this.W + Math.floor(u.x);
      const path = this.findPath(this.isLand(here) ? here : this._nearestLand(here, 3), goal);
      if (!path) return false;
      u.path = path; u.pi = 0; u.goal = goal;
      return true;
    },
    cmdMove(p, ids, tile) {
      if (!Array.isArray(ids) || tile < 0 || tile >= this.N) return;
      let ok = 0;
      for (const id of ids.slice(0, C.MAX_UNITS)) {
        const u = this.unitById(id);
        if (u && u.owner === p.id && this._order(p, u, tile)) ok++;
      }
      if (!ok && ids.length) this.emit('fail', { pid: p.id, msg: 'Kein Landweg zu diesem Ziel.' });
      else if (ok) { const [x, y] = this.xy(tile); this.emit('order', { pid: p.id, x, y, n: ok }); }
    },
    cmdStop(p, ids) {
      for (const id of ids || []) { const u = this.unitById(id); if (u && u.owner === p.id) { u.path = null; u.goal = -1; } }
    },
    cmdDisband(p, ids) {
      for (const id of ids || []) {
        const u = this.unitById(id);
        if (!u || u.owner !== p.id) continue;
        const t = Math.floor(u.y) * this.W + Math.floor(u.x);
        p.troops += this.owner[t] === p.id ? u.str : u.str * 0.5;
        this.units.splice(this.units.indexOf(u), 1);
        this.emit('disband', { pid: p.id, uid: u.id });
      }
    },

    // ------------------------------------------------------------ simulation
    _processUnits() {
      for (const p of this.players) if (p) p.armyStr = 0;
      if (!this.units.length && !this.shells.length) return;
      const units = this.units;
      for (const u of units) {
        this.players[u.owner].armyStr += u.str;
        u.px = u.x; u.py = u.y; u.fight = 0;
      }
      // ---- engagements (nearest hostile unit within reach)
      const dmg = new Map();
      for (const a of units) {
        if (a.kind === 'art') continue;
        let best = null, bd = 3.2 * 3.2;
        for (const b of units) {
          if (b.owner === a.owner || this.allied(a.owner, b.owner)) continue;
          const d2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
          if (d2 < bd) { bd = d2; best = b; }
        }
        if (!best) continue;
        a.fight = best.id;
        const A = C.UNITS[a.kind], B = C.UNITS[best.kind];
        const tile = Math.floor(best.y) * this.W + Math.floor(best.x);
        const home = this.owner[tile] === best.owner ? 1.25 : 1;
        dmg.set(best, (dmg.get(best) || 0) + a.str * A.atk * 0.022 / (B.def * home));
      }
      // ---- artillery fire
      for (const a of units) {
        if (a.kind !== 'art' || a.cd > this.tick) continue;
        const R = C.UNITS.art.range;
        let tx = -1, ty = -1, bd = R * R;
        for (const b of units) {
          if (b.owner === a.owner || this.allied(a.owner, b.owner)) continue;
          const d2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
          if (d2 < bd) { bd = d2; tx = b.x; ty = b.y; }
        }
        if (tx < 0) { // no unit in range → shell the nearest hostile territory
          const cx = Math.floor(a.x), cy = Math.floor(a.y);
          for (let r = 3; r <= R && tx < 0; r += 3) {
            for (let k = 0; k < 12; k++) {
              const ang = (k / 12) * Math.PI * 2 + r;
              const x = Math.round(cx + Math.cos(ang) * r), y = Math.round(cy + Math.sin(ang) * r);
              if (x < 0 || y < 0 || x >= this.W || y >= this.H) continue;
              const o = this.owner[y * this.W + x];
              if (o && o !== a.owner && !this.allied(o, a.owner)) { tx = x + 0.5; ty = y + 0.5; break; }
            }
          }
        }
        if (tx < 0) continue;
        a.cd = this.tick + C.UNITS.art.reload;
        a.heading = Math.atan2(ty - a.y, tx - a.x);
        const flight = 10 + Math.round(Math.sqrt(bd) * 0.4);
        const s = { id: this.nextId++, owner: a.owner, fx: a.x, fy: a.y, tx: tx + (this.rng.next() - 0.5) * 2, ty: ty + (this.rng.next() - 0.5) * 2, t0: this.tick, eta: this.tick + flight, pow: a.str };
        this.shells.push(s);
        this.emit('shellFired', { owner: a.owner, x: a.x, y: a.y });
      }
      for (const s of this.shells.slice()) {
        if (this.tick < s.eta) continue;
        this.shells.splice(this.shells.indexOf(s), 1);
        for (const b of units) {
          if (b.owner === s.owner || this.allied(b.owner, s.owner)) continue;
          if ((b.x - s.tx) ** 2 + (b.y - s.ty) ** 2 < 9) dmg.set(b, (dmg.get(b) || 0) + s.pow * 0.12 / C.UNITS[b.kind].def);
        }
        const tt = Math.floor(s.ty) * this.W + Math.floor(s.tx);
        const o = tt >= 0 && tt < this.N ? this.owner[tt] : 0;
        if (o && o !== s.owner && !this.allied(o, s.owner)) {
          const D = this.players[o];
          D.troops = Math.max(0, D.troops - Math.min(D.troops * 0.03, s.pow * 0.08));
        }
        this.emit('shellHit', { owner: s.owner, x: s.tx, y: s.ty });
      }
      for (const [u, d] of dmg) u.str -= d;

      // ---- movement & conquest
      for (const u of units) {
        const D = C.UNITS[u.kind];
        const P = this.players[u.owner];
        if (u.path && !u.fight) {
          let step = D.speed * (this.ultActive(P, 'blitz') ? 1.8 : 1);
          const here = u.path[Math.min(u.path.length - 1, Math.floor(u.pi))];
          step /= Math.sqrt(MOVE_COST[this.terrain[here]] || 1);
          u.pi = Math.min(u.path.length - 1, u.pi + step);
          const i0 = Math.floor(u.pi), i1 = Math.min(u.path.length - 1, i0 + 1), f = u.pi - i0;
          const t0 = u.path[i0], t1 = u.path[i1];
          const nx = (t0 % this.W) + ((t1 % this.W) - (t0 % this.W)) * f + 0.5;
          const ny = ((t0 / this.W) | 0) + (((t1 / this.W) | 0) - ((t0 / this.W) | 0)) * f + 0.5;
          if (nx !== u.x || ny !== u.y) u.heading = Math.atan2(ny - u.y, nx - u.x);
          u.x = nx; u.y = ny;
          if (u.pi >= u.path.length - 1) { u.path = null; this.emit('arrived', { pid: u.owner, uid: u.id }); }
        } else if (u.fight) {
          const b = this.unitById(u.fight);
          if (b) u.heading = Math.atan2(b.y - u.y, b.x - u.x);
        }
        // conquer the swath around the unit
        if (u.fight) continue;
        const R = D.radius, cx = u.x, cy = u.y;
        let taken = 0;
        for (let dy = -Math.ceil(R); dy <= Math.ceil(R) && taken < D.conquer; dy++) {
          for (let dx = -Math.ceil(R); dx <= Math.ceil(R) && taken < D.conquer; dx++) {
            const x = Math.floor(cx) + dx, y = Math.floor(cy) + dy;
            if (x < 0 || y < 0 || x >= this.W || y >= this.H) continue;
            if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > R * R) continue;
            const t = y * this.W + x;
            const o = this.owner[t];
            if (o === u.owner || !this.isLand(t) || this.allied(o, u.owner)) continue;
            const cost = this.tileCost(t, P, o) * 0.75 / D.atk;
            if (u.str - cost < C.MIN_UNIT * 0.3) break;
            u.str -= cost;
            if (o) { const Q = this.players[o]; Q.troops = Math.max(0, Q.troops - (Q.troops / Math.max(1, Q.tiles)) * 0.85); }
            this.setOwner(t, u.owner);
            P.stats.conquered++;
            this.addGlut(P, o ? 0.012 : 0.0012);
            taken++;
          }
        }
      }
      // ---- casualties
      for (const u of units.slice()) {
        if (u.str >= 20) continue;
        this.units.splice(this.units.indexOf(u), 1);
        const foe = u.fight > 0 ? this.unitById(u.fight) : null;
        if (foe) this.addGlut(this.players[foe.owner], 12);
        this.emit('unitLost', { pid: u.owner, uid: u.id, kind: u.kind, x: u.x, y: u.y, by: foe ? foe.owner : 0 });
      }
    },
  };
})(globalThis.BW = globalThis.BW || {});
