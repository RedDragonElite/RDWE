/* RDE // FRONTLINE — economy mixin: resources, buildings, research, stock market, trade ships
 * Mixed into Sim.prototype. Deterministic like the rest of the simulation. */
(function (BW) {
  'use strict';
  const C = BW.C, T = C.T;

  BW.SimEconomy = {
    _initEconomy() {
      this.prices = {};
      this.priceHist = {};
      for (const k of C.TRADE_RES) { this.prices[k] = C.RES[k].price; this.priceHist[k] = [C.RES[k].price]; }
      this.tradeShips = [];
    },

    active(s) { return s.done <= this.tick && s.off <= this.tick; },

    _recountStructures() {
      for (const p of this.players) if (p) for (const k in C.BUILD) { p.counts[k] = 0; p.built[k] = 0; }
      for (const s of this.structures) {
        const p = this.players[s.owner];
        p.built[s.kind]++;
        if (this.active(s)) p.counts[s.kind]++;
        if (!s.announced && s.done <= this.tick) {
          s.announced = true;
          if (s.kind === 'wonder') s.heldSince = this.tick;
          this.emit('built', { pid: s.owner, kind: s.kind, x: s.x, y: s.y });
        }
      }
    },

    // ------------------------------------------------------------ costs
    costOf(p, kind) {
      const d = C.BUILD[kind];
      const n = p.built[kind] || 0;
      const f = d.scale === 'double' ? Math.min(Math.pow(2, n), 16) : 1 + n * d.scale;
      const out = {};
      for (const k in d.cost) out[k] = Math.round(d.cost[k] * f * (k === 'gold' && this.has(p, 'arch') ? 0.75 : 1));
      return out;
    },
    canAfford(p, cost) {
      for (const k in cost) if ((k === 'gold' ? p.gold : p.res[k]) < cost[k]) return false;
      return true;
    },
    pay(p, cost) {
      for (const k in cost) { if (k === 'gold') p.gold -= cost[k]; else p.res[k] -= cost[k]; }
    },
    gain(p, k, v) {
      if (k === 'gold') { p.gold += v; if (v > 0) p.stats.goldEarned += v; } else p.res[k] += v;
    },

    // ------------------------------------------------------------ income
    _economyTick() {
      for (const p of this.players) {
        if (!p || !p.alive) continue;
        const r = p.rates;
        for (const k in r) r[k] = 0;
        const eco = p.human ? 1 : C.DIFFICULTY[p.diff].eco;
        let goldMult = 1;
        if (this.has(p, 'econ')) goldMult += 0.25;
        if (this.has(p, 'empire')) goldMult += 0.2;
        if (p.counts.wonder) goldMult += 0.3;
        const c = p.counts, tr = p.terr;
        r.gold += (1 + Math.sqrt(p.tiles) * 0.3 + c.city * 1 + c.port * 3 + c.market * 2) * goldMult * eco;
        if (c.bank) r.gold += c.bank * Math.min(Math.max(0, p.gold) * 0.00012, 30);
        r.food += (tr[T.PLAINS] * 0.0004 + tr[T.BEACH] * 0.0002 + c.farm * 0.25) * (this.has(p, 'agri') ? 1.35 : 1) * eco;
        r.wood += (tr[T.FOREST] * 0.0006 + c.sawmill * 0.3) * eco;
        r.sci += (0.02 + c.city * 0.03 + c.lab * 0.25) * eco;
        // armies eat
        r.food -= p.troops / 120000;
      }
      // deposits
      for (const d of this.deposits) {
        const o = this.owner[d.tile];
        if (!o) continue;
        const p = this.players[o];
        const D = C.DEPOSITS[d.kind];
        const s = this.structAt.get(d.tile);
        const mined = s && s.owner === o && (s.kind === 'mine' || s.kind === 'derrick') && this.active(s);
        let y = D.yield * d.rich * (mined ? 4 : 1);
        if (this.has(p, 'mining')) y *= 1.35;
        if (d.boost > this.tick) y *= 3;
        if (!p.human) y *= C.DIFFICULTY[p.diff].eco;
        p.rates[D.res] += y;
      }
      for (const p of this.players) {
        if (!p || !p.alive) continue;
        for (const k in p.rates) this.gain(p, k, p.rates[k]);
        if (p.res.food <= 0) { p.res.food = 0; p.fed = false; } else p.fed = true;
      }
      // market price drift (mean reverting random walk)
      if (this.tick % 20 === 0) {
        for (const k of C.TRADE_RES) {
          const base = C.RES[k].price;
          let v = this.prices[k];
          v += (base - v) * 0.03 + base * (this.rng.next() - 0.5) * 0.08;
          v = Math.max(base * 0.3, Math.min(base * 3, v));
          this.prices[k] = v;
          const h = this.priceHist[k];
          h.push(v); if (h.length > 60) h.shift();
        }
      }
      if (this.tick % 10 === 0) this._spawnTradeShips();
    },

    // ------------------------------------------------------------ building
    _isCoastal(t) {
      const n = this.nbrs(t);
      for (let i = 0; i < n; i++) if (!this.isLand(this._nb[i])) return true;
      return false;
    },
    _structNear(x, y, r) {
      for (const s of this.structures) if (Math.abs(s.x - x) <= r && Math.abs(s.y - y) <= r) return s;
      return null;
    },
    /** Snap a click to a legal build tile. Returns tile ≥ 0 or a negative error code. */
    canBuildAt(p, kind, tile) {
      const d = C.BUILD[kind];
      if (tile < 0 || tile >= this.N || this.owner[tile] !== p.id) return -1;
      const [cx, cy] = this.xy(tile);
      const ok = (u) => {
        if (this.owner[u] !== p.id) return false;
        if (d.coastal && !this._isCoastal(u)) return false;
        if (d.terrain && d.terrain.indexOf(this.terrain[u]) < 0) return false;
        if (d.deposit) {
          const dep = this.depAt.get(u);
          if (!dep || d.deposit.indexOf(dep.kind) < 0 || this.structAt.has(u)) return false;
          return true; // extractors sit right on their deposit
        }
        if (this.depAt.has(u)) return false;
        const [x, y] = this.xy(u);
        return !this._structNear(x, y, 2);
      };
      if (ok(tile)) return tile;
      const R = d.deposit ? 5 : 8;
      let best = -1, bd = 1e9;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= this.W || y >= this.H) continue;
        const u = y * this.W + x, dd = dx * dx + dy * dy;
        if (dd < bd && ok(u)) { bd = dd; best = u; }
      }
      if (best >= 0) return best;
      if (d.coastal) return -2;
      if (d.terrain) return -4;
      if (d.deposit) return -5;
      return -3;
    },
    buildBlocker(p, kind) {
      const d = C.BUILD[kind];
      if (d.tech && !this.has(p, d.tech)) return 'Erst erforschen: ' + C.TECH[d.tech].e + ' ' + C.TECH[d.tech].name;
      if (d.max && p.built[kind] >= d.max) return 'Nur ' + d.max + '× pro Nation';
      if (!this.canAfford(p, this.costOf(p, kind))) return 'Nicht genug Ressourcen';
      return '';
    },
    cmdBuild(p, kind, tile) {
      const d = C.BUILD[kind];
      if (!d) return;
      this._recountStructures();
      const block = this.buildBlocker(p, kind);
      if (block) { this.emit('fail', { pid: p.id, msg: block }); return; }
      const t = this.canBuildAt(p, kind, tile);
      if (t < 0) {
        let msg = 'Nur auf eigenem Land baubar.';
        if (t === -2) msg = 'Häfen brauchen Küste in der Nähe.';
        else if (t === -3) msg = 'Zu nah an einem anderen Gebäude oder einer Lagerstätte.';
        else if (t === -4) msg = d.name + ' braucht passendes Gelände (' + d.terrain.map(x => C.TERRAIN[x].name).join('/') + ').';
        else if (t === -5) msg = d.name + ' muss auf eine eigene Lagerstätte (' + d.deposit.map(k => C.DEPOSITS[k].e).join(' ') + ').';
        this.emit('fail', { pid: p.id, msg }); return;
      }
      const cost = this.costOf(p, kind);
      this.pay(p, cost);
      const [x, y] = this.xy(t);
      const s = { id: this.nextId++, kind, owner: p.id, tile: t, x, y, start: this.tick, done: this.tick + d.time, cd: 0, off: 0, nextTrade: this.tick + d.time + 50, heldSince: 0 };
      this.structures.push(s);
      this.structAt.set(t, s);
      p.built[kind]++;
      this.emit('build', { pid: p.id, kind, x, y });
      if (kind === 'wonder') this.emit('wonderStart', { pid: p.id, x, y });
    },
    _destroyStructure(s) {
      const i = this.structures.indexOf(s);
      if (i >= 0) this.structures.splice(i, 1);
      this.structAt.delete(s.tile);
      this.emit('destroyed', { kind: s.kind, x: s.x, y: s.y, owner: s.owner });
    },

    // ------------------------------------------------------------ research
    techState(p, key) {
      const t = C.TECH[key];
      if (p.tech.has(key)) return 'done';
      if (!t.req.every(r => p.tech.has(r))) return 'locked';
      return this.canAfford(p, t.cost) ? 'ready' : 'poor';
    },
    cmdResearch(p, key) {
      const t = C.TECH[key];
      if (!t || p.tech.has(key)) return;
      if (!t.req.every(r => p.tech.has(r))) { this.emit('fail', { pid: p.id, msg: 'Voraussetzungen fehlen.' }); return; }
      if (!this.canAfford(p, t.cost)) { this.emit('fail', { pid: p.id, msg: 'Nicht genug Ressourcen für ' + t.name + '.' }); return; }
      this.pay(p, t.cost);
      p.tech.add(key);
      this.emit('research', { pid: p.id, tech: key });
    },

    // ------------------------------------------------------------ stock market
    tradeFee(p) {
      return Math.max(0.05, 0.25 - (p.counts.market ? 0.13 : 0) - (this.has(p, 'econ') ? 0.05 : 0));
    },
    cmdTrade(p, res, qty, side) {
      if (C.TRADE_RES.indexOf(res) < 0) return;
      qty = Math.floor(+qty || 0);
      if (qty <= 0) return;
      const price = this.prices[res], fee = this.tradeFee(p);
      if (side === 'sell') {
        qty = Math.min(qty, Math.floor(p.res[res]));
        if (qty <= 0) return;
        const g = qty * price * (1 - fee);
        p.res[res] -= qty; this.gain(p, 'gold', g);
        this.prices[res] = price * (1 - Math.min(0.25, qty * price / 200000));
        this.emit('trade', { pid: p.id, res, qty, side, gold: g });
      } else {
        const unit = price * (1 + fee);
        qty = Math.min(qty, Math.floor(p.gold / unit));
        if (qty <= 0) { this.emit('fail', { pid: p.id, msg: 'Nicht genug Gold.' }); return; }
        p.gold -= qty * unit; p.res[res] += qty;
        this.prices[res] = price * (1 + Math.min(0.25, qty * price / 200000));
        this.emit('trade', { pid: p.id, res, qty, side, gold: qty * unit });
      }
      p.stats.trades++;
    },

    // ------------------------------------------------------------ trade ships
    findWaterPath(fromTile, toTile) {
      const q = this._bfsQ, prev = this._bfsPrev, seen = this._bfsSeen, ter = this.terrain;
      const stamp = ++this._bfsStamp;
      let h = 0, tl = 0;
      const seedN = this.nbrs(fromTile);
      for (let i = 0; i < seedN; i++) {
        const w = this._nb[i];
        if (ter[w] < T.BEACH && seen[w] !== stamp) { seen[w] = stamp; prev[w] = -1; q[tl++] = w; }
      }
      const goals = new Set();
      const gn = this.nbrs(toTile);
      for (let i = 0; i < gn; i++) if (ter[this._nb[i]] < T.BEACH) goals.add(this._nb[i]);
      if (!tl || !goals.size) return null;
      let goal = -1;
      while (h < tl) {
        const t = q[h++];
        if (goals.has(t)) { goal = t; break; }
        const n = this.nbrs(t);
        for (let i = 0; i < n; i++) {
          const u = this._nb[i];
          if (seen[u] === stamp || ter[u] >= T.BEACH) continue;
          seen[u] = stamp; prev[u] = t; q[tl++] = u;
        }
      }
      if (goal < 0) return null;
      const path = [];
      for (let t = goal; t !== -1; t = prev[t]) path.push(t);
      path.reverse();
      return Int32Array.from(path);
    },
    _spawnTradeShips() {
      if (this.tradeShips.length >= 70) return;
      const ports = this.structures.filter(s => s.kind === 'port' && this.active(s));
      if (ports.length < 2) return;
      for (const s of ports) {
        if (s.nextTrade > this.tick) continue;
        s.nextTrade = this.tick + 160 + this.rng.int(160);
        const P = this.players[s.owner];
        if (this.tradeShips.filter(t => t.owner === s.owner).length >= 4) continue;
        const partners = ports.filter(o => o.owner !== s.owner &&
          !this.attacks.some(a => (a.attacker === s.owner && a.target === o.owner) || (a.attacker === o.owner && a.target === s.owner)));
        if (!partners.length) continue;
        const o = partners[this.rng.int(partners.length)];
        const path = this.findWaterPath(s.tile, o.tile);
        if (!path || path.length < 12) continue;
        const ally = this.allied(s.owner, o.owner);
        this.tradeShips.push({ id: this.nextId++, owner: s.owner, partner: o.owner, path, prog: 0,
          speed: 1.3 * (this.has(P, 'nav') ? 1.3 : 1), value: Math.round((150 + path.length * 6) * (ally ? 1.5 : 1)) });
      }
    },
    _processTradeShips() {
      for (const sh of this.tradeShips.slice()) {
        const P = this.players[sh.owner];
        if (!P.alive) { this.tradeShips.splice(this.tradeShips.indexOf(sh), 1); continue; }
        sh.prog += this._shipSpeed(sh.path, sh.prog, sh.speed);
        if (sh.prog < sh.path.length - 1) continue;
        this.tradeShips.splice(this.tradeShips.indexOf(sh), 1);
        this.gain(P, 'gold', sh.value);
        const Q = this.players[sh.partner];
        if (Q && Q.alive) this.gain(Q, 'gold', Math.round(sh.value * 0.5));
        const [x, y] = this.xy(sh.path[sh.path.length - 1]);
        this.emit('tradeDone', { pid: sh.owner, partner: sh.partner, value: sh.value, x, y });
      }
    },
  };
})(globalThis.BW = globalThis.BW || {});
