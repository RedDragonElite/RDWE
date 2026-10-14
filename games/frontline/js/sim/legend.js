/* RDE // FRONTLINE — legend mixin: the Red Dragon world boss & "Kriegsglut" commander ultimates
 * Deterministic like the rest of the sim (sim.rng only, intent-driven). */
(function (BW) {
  'use strict';
  const C = BW.C;

  BW.SimLegend = {
    _initLegend() {
      this.burn = new Uint32Array(this.N);   // tick until which a tile burns (conquest ×2.5)
      this.dragon = null;
      this.nextDragon = C.SPAWN_TICKS + C.DRAGON.first + this.rng.int(1200);
    },

    // ============================================================ KRIEGSGLUT
    addGlut(p, v) {
      if (!p || !p.alive) return;
      const before = p.glut;
      p.glut = Math.min(C.GLUT_MAX, p.glut + v);
      if (before < C.GLUT_MAX && p.glut >= C.GLUT_MAX) this.emit('glutFull', { pid: p.id });
    },
    ultActive(p, kind) { return p.ult && p.ult.kind === kind && p.ult.until > this.tick; },
    cmdUltimate(p, kind, tile) {
      const d = C.ULTS[kind];
      if (!d || p.glut < C.GLUT_MAX) return;
      if (kind === 'firestorm') {
        if (tile < 0 || tile >= this.N) return;
        const [x, y] = this.xy(tile);
        p.glut = 0;
        this._fire(x, y, d.radius, p.id, 1);
        if (this.dragon && (this.dragon.x - x) ** 2 + (this.dragon.y - y) ** 2 < (d.radius + 4) ** 2) this._hurtDragon(p.id, 9000);
        this.emit('ultimate', { pid: p.id, kind, x, y });
        return;
      }
      p.glut = 0;
      p.ult = { kind, until: this.tick + d.dur };
      const [x, y] = this.centroid(p);
      this.emit('ultimate', { pid: p.id, kind, x: Math.round(x), y: Math.round(y) });
    },

    /** set land ablaze: neutralises tiles (except `spare` owner), burns units, leaves embers */
    _fire(cx, cy, R, spare, power) {
      const hit = new Map();
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > R * R) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= this.W || y >= this.H) continue;
        const t = y * this.W + x;
        if (!this.isLand(t)) continue;
        const o = this.owner[t];
        if (spare && (o === spare || this.allied(o, spare))) continue;
        this.burn[t] = Math.max(this.burn[t], this.tick + 300);
        if (o && this.rng.next() < 0.75 * power * (1 - Math.sqrt(d2) / (R + 1) * 0.5)) {
          hit.set(o, (hit.get(o) || 0) + 1);
          this.setOwner(t, 0);
        }
      }
      for (const [o, c] of hit) {
        const P = this.players[o];
        P.troops -= P.troops * Math.min(0.5, (c / (P.tiles + c)) * 1.2 * power);
      }
      for (const u of this.units) {
        if (spare && (u.owner === spare || this.allied(u.owner, spare))) continue;
        if ((u.x - cx) ** 2 + (u.y - cy) ** 2 < (R + 1) ** 2) u.str -= u.str * 0.4 * power + 30;
      }
    },

    // ============================================================ THE RED DRAGON
    _spawnDragon() {
      const alive = this.alivePlayers().filter(p => p.tiles > 50).sort((a, b) => b.tiles - a.tiles);
      if (!alive.length) return;
      const side = this.rng.int(4);
      const x = side === 0 ? -20 : side === 1 ? this.W + 20 : this.rng.int(this.W);
      const y = side === 2 ? -20 : side === 3 ? this.H + 20 : this.rng.int(this.H);
      const mins = Math.max(1, (this.tick - C.SPAWN_TICKS) / 600);
      const hp = Math.round(C.DRAGON.hp + mins * 4000);
      this.dragon = {
        x, y, px: x, py: y, heading: 0, hp, max: hp, speed: C.DRAGON.speed,
        targets: alive.slice(0, 3).map(p => p.id), ti: 0, circle: 0, mode: 'hunt', dmgBy: {}, breath: 0, born: this.tick,
        exitX: side === 0 ? this.W + 40 : side === 1 ? -40 : this.W / 2, exitY: side === 2 ? this.H + 40 : side === 3 ? -40 : -40,
      };
      this.emit('dragonArrive', { x, y, hp, targets: this.dragon.targets.slice() });
    },
    _hurtDragon(pid, dmg) {
      const d = this.dragon;
      if (!d || dmg <= 0) return;
      d.hp -= dmg;
      if (pid) d.dmgBy[pid] = (d.dmgBy[pid] || 0) + dmg;
    },
    _dragonTick() {
      if (!this.dragon) {
        if (this.eventsOn && this.tick >= this.nextDragon) this._spawnDragon();
        return;
      }
      const d = this.dragon;
      d.px = d.x; d.py = d.y; d.breath = 0;
      // where to?
      let tx = d.exitX, ty = d.exitY;
      if (d.mode === 'hunt') {
        let tgt = this.players[d.targets[d.ti]];
        while (tgt && (!tgt.alive || tgt.tiles < 10) && d.ti < d.targets.length) tgt = this.players[d.targets[++d.ti]];
        if (!tgt) d.mode = 'leave';
        else { [tx, ty] = this.centroid(tgt); }
      }
      const dx = tx - d.x, dy = ty - d.y, dist = Math.hypot(dx, dy);
      if (d.mode === 'hunt' && dist < 8) {
        // circle the heart of the nation and rain fire
        d.circle++;
        const a = d.circle * 0.06;
        const cx = tx + Math.cos(a) * 7, cy = ty + Math.sin(a) * 7;
        d.heading = Math.atan2(cy - d.y, cx - d.x);
        d.x += (cx - d.x) * 0.25; d.y += (cy - d.y) * 0.25;
        if (d.circle % 4 === 0) {
          const fx = Math.round(d.x + Math.cos(d.heading) * 4), fy = Math.round(d.y + Math.sin(d.heading) * 4);
          this._fire(fx, fy, 3, 0, 0.8);
          d.breath = 1;
        }
        if (d.circle > 140) { d.circle = 0; d.ti++; this.emit('dragonMove', { x: Math.round(d.x), y: Math.round(d.y) }); if (d.ti >= d.targets.length) d.mode = 'leave'; }
      } else {
        d.heading = Math.atan2(dy, dx);
        const sp = d.mode === 'leave' ? d.speed * 1.4 : d.speed;
        d.x += Math.cos(d.heading) * sp; d.y += Math.sin(d.heading) * sp;
        // scorch a trail on the way in
        if (d.mode === 'hunt' && this.tick % 9 === 0 && d.x > 0 && d.y > 0 && d.x < this.W && d.y < this.H) {
          this._fire(Math.round(d.x), Math.round(d.y), 2, 0, 0.5); d.breath = 1;
        }
        if (d.mode === 'leave' && (d.x < -30 || d.y < -30 || d.x > this.W + 30 || d.y > this.H + 30)) {
          this.dragon = null;
          this.nextDragon = this.tick + C.DRAGON.every + this.rng.int(2400);
          this.emit('dragonLeave', {});
          return;
        }
      }
      // armies near the dragon fight it (and get scorched)
      for (const u of this.units) {
        const r2 = (u.x - d.x) ** 2 + (u.y - d.y) ** 2;
        if (r2 > 36) continue;
        u.fight = -1;
        this._hurtDragon(u.owner, u.str * C.UNITS[u.kind].atk * 0.02 + (u.kind === 'art' ? 60 : 0));
        u.str -= 20 + u.str * 0.012;
      }
      // air defence opens fire
      if (this.tick % 10 === 0) {
        for (const s of this.structures) {
          if (s.kind !== 'sam' || !this.active(s) || s.cd > this.tick) continue;
          if ((s.x - d.x) ** 2 + (s.y - d.y) ** 2 > 45 * 45) continue;
          s.cd = this.tick + 30;
          this._hurtDragon(s.owner, 700);
          this.emit('samShot', { owner: s.owner, sx: s.x, sy: s.y, x: d.x, y: d.y });
        }
      }
      if (d.hp <= 0) this._slayDragon();
    },
    _slayDragon() {
      const d = this.dragon;
      let killer = 0, best = 0;
      for (const k in d.dmgBy) if (d.dmgBy[k] > best || (d.dmgBy[k] === best && +k < killer)) { best = d.dmgBy[k]; killer = +k; }
      const x = Math.round(d.x), y = Math.round(d.y);
      this.dragon = null;
      this.nextDragon = this.tick + C.DRAGON.every + this.rng.int(2400);
      const P = this.players[killer];
      const loot = { gold: 60000, gems: 120, uranium: 60 };
      if (P && P.alive) {
        for (const k in loot) this.gain(P, k, loot[k]);
        P.dragonHeart = true;
        this.addGlut(P, C.GLUT_MAX);
      }
      // the hoard scatters: three crates around the fall site
      for (let i = 0; i < 3; i++) {
        const t = this._nearestLand(Math.max(0, Math.min(this.H - 1, y + this.rng.int(15) - 7)) * this.W + Math.max(0, Math.min(this.W - 1, x + this.rng.int(15) - 7)), 6);
        if (t >= 0) this.crates.push({ id: this.nextId++, tile: t, x: t % this.W, y: (t / this.W) | 0, loot: { gold: 8000, gems: 30 }, expires: this.tick + 1500 });
      }
      this.emit('dragonSlain', { killer, x, y, loot });
    },
  };
})(globalThis.BW = globalThis.BW || {});
