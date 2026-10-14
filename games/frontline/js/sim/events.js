/* RDE // FRONTLINE — world events mixin (meteors, volcanoes, gold rush, plague, supply drops, storms)
 * Deterministic: scheduled and resolved with sim.rng only. */
(function (BW) {
  'use strict';
  const C = BW.C, T = C.T;

  BW.SimEvents = {
    _initEvents() {
      this.crates = [];
      this.storm = null;
      this.nextEvent = C.SPAWN_TICKS + 1200 + this.rng.int(600);
      this.eventsOn = this.cfg.events !== false;
    },

    stormPos() {
      const s = this.storm;
      const u = (this.tick - s.start) / (s.end - s.start);
      return [s.x0 + (s.x1 - s.x0) * u, s.y0 + (s.y1 - s.y0) * u];
    },

    _randomLand(filter, tries = 300) {
      for (let k = 0; k < tries; k++) {
        const t = this.rng.int(this.N);
        if (this.isLand(t) && (!filter || filter(t))) return t;
      }
      return -1;
    },
    _addDeposit(kind, x, y, rich) {
      const t = y * this.W + x;
      if (!this.isLand(t) || this.depAt.has(t) || this.structAt.has(t)) return null;
      for (const d of this.deposits) if ((d.x - x) ** 2 + (d.y - y) ** 2 < 25) return null;
      const d = { id: this.deposits.length, kind, tile: t, x, y, rich, boost: 0 };
      this.deposits.push(d);
      this.depAt.set(t, d);
      this.emit('newDeposit', { kind, x, y });
      return d;
    },

    _eventsTick() {
      // supply crates
      for (const c of this.crates.slice()) {
        const o = this.owner[c.tile];
        if (o) {
          const P = this.players[o];
          for (const k in c.loot) this.gain(P, k, c.loot[k]);
          P.stats.crates++;
          this.crates.splice(this.crates.indexOf(c), 1);
          this.emit('crate', { pid: o, loot: c.loot, x: c.x, y: c.y });
        } else if (this.tick > c.expires) {
          this.crates.splice(this.crates.indexOf(c), 1);
          this.emit('crateGone', { x: c.x, y: c.y });
        }
      }
      if (this.storm && this.tick >= this.storm.end) { this.storm = null; this.emit('stormEnd', {}); }
      if (!this.eventsOn || this.tick < this.nextEvent) return;
      this.nextEvent = this.tick + 900 + this.rng.int(900);

      const kinds = Object.keys(C.EVENTS).filter(k => !(k === 'storm' && this.storm));
      const tot = kinds.reduce((a, k) => a + C.EVENTS[k].w, 0);
      let r = this.rng.next() * tot, kind = kinds[0];
      for (const k of kinds) { r -= C.EVENTS[k].w; if (r <= 0) { kind = k; break; } }
      this['_ev_' + kind]();
    },

    _ev_meteor() {
      const c = this._randomLand();
      if (c < 0) return;
      const [cx, cy] = this.xy(c);
      const n = 3 + this.rng.int(3), impacts = [];
      for (let i = 0; i < n; i++) {
        const x = Math.max(0, Math.min(this.W - 1, cx + this.rng.int(37) - 18));
        const y = Math.max(0, Math.min(this.H - 1, cy + this.rng.int(37) - 18));
        const R = 3 + this.rng.int(3);
        const victims = this._blast(x, y, R, { rad: 150, troop: 0.8 });
        impacts.push({ x, y, r: R, delay: i * 4, victims });
      }
      this._addDeposit('gems', cx, cy, 2);
      this.emit('worldEvent', { kind: 'meteor', x: cx, y: cy, impacts });
    },
    _ev_volcano() {
      const c = this._randomLand(t => this.terrain[t] >= T.MOUNTAIN, 600);
      if (c < 0) return this._ev_meteor();
      const [x, y] = this.xy(c);
      const victims = this._blast(x, y, 8, { rad: 400, troop: 1.2 });
      const kind = this.rng.chance(0.5) ? 'iron' : 'gold';
      this._addDeposit(kind, Math.min(this.W - 1, x + 3), y, 3);
      this.emit('worldEvent', { kind: 'volcano', x, y, r: 8, victims });
    },
    _ev_goldrush() {
      const pool = this.deposits.filter(d => d.kind === 'gold' || d.kind === 'silver' || d.kind === 'gems');
      if (!pool.length) return this._ev_supply();
      const d = pool[this.rng.int(pool.length)];
      d.boost = this.tick + 900;
      this.emit('worldEvent', { kind: 'goldrush', x: d.x, y: d.y, dep: d.kind, pid: this.owner[d.tile] });
    },
    _ev_plague() {
      const alive = this.alivePlayers().filter(p => !this.has(p, 'med'));
      if (!alive.length) return this._ev_supply();
      const p = alive.reduce((a, b) => (b.tiles > a.tiles ? b : a));
      const lost = Math.floor(p.troops * 0.25);
      p.troops -= lost;
      const [x, y] = this.centroid(p);
      this.emit('worldEvent', { kind: 'plague', pid: p.id, lost, x: Math.round(x), y: Math.round(y) });
    },
    _ev_supply() {
      let tile = this._randomLand(u => !this.owner[u]);
      if (tile < 0) tile = this._randomLand();
      if (tile < 0) return;
      const [x, y] = this.xy(tile);
      const loot = { gold: 4000 + this.rng.int(8000) };
      const pool = C.TRADE_RES;
      for (let i = 0; i < 2; i++) {
        const k = pool[this.rng.int(pool.length)];
        loot[k] = (loot[k] || 0) + Math.round(800 / C.RES[k].price * (0.6 + this.rng.next()));
      }
      this.crates.push({ id: this.nextId++, tile, x, y, loot, expires: this.tick + 1500 });
      this.emit('worldEvent', { kind: 'supply', x, y });
    },
    _ev_storm() {
      const west = this.rng.chance(0.5);
      const y0 = this.rng.int(this.H), y1 = this.rng.int(this.H);
      this.storm = { start: this.tick, end: this.tick + 1200, r: Math.round(Math.min(this.W, this.H) * 0.16),
        x0: west ? -40 : this.W + 40, x1: west ? this.W + 40 : -40, y0, y1 };
      const [x, y] = this.stormPos();
      this.emit('worldEvent', { kind: 'storm', x: Math.round(x), y: Math.round(y) });
    },
  };

})(globalThis.BW = globalThis.BW || {});
