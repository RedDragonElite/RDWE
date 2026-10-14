/* RDE // KONTRAKT — combat: guns, ballistics, melee, takedowns, throwables, explosions, damage & death */
(function (K) {
  'use strict';
  const U = K.U, T = K.T, TF = K.TF, TILE = K.TILE, W8 = K.WEAPONS;

  K.mixin({
    wdef(a) { return W8[(a.wi && a.wi.id) || 'fists']; },
    reserveOf(a, d) { return a.kind === 'player' ? this.P.ammo[d.ammo] || 0 : a.reserve; },
    takeReserve(a, d, n) {
      if (a.kind === 'player') { const have = this.P.ammo[d.ammo] || 0, t = Math.min(have, n); this.P.ammo[d.ammo] = have - t; return t; }
      if (a.reserve < 0) return n; const t = Math.min(a.reserve, n); a.reserve -= t; return t;
    },

    /** main attack entry for any actor */
    attack(a, aim, held, pressed) {
      if (a.cool > 0 || a.stun > 0 || !a.alive || a.ko > 0) return false;
      const d = this.wdef(a), wi = a.wi;
      if (a.reloadT > 0) {
        if (d.perShell && pressed && wi.mag > 0) { a.reloadT = 0; a.reloading = false; } else return false;
      }
      if (d.type === 'gun') {
        if (!d.auto && !pressed) return false;
        if (wi.mag <= 0) {
          if (pressed) this.emit('dry', { x: a.x, y: a.y, id: a.id });
          a.cool = 0.25;
          if (this.reserveOf(a, d) > 0) this.reload(a);
          return false;
        }
        this.fireGun(a, d, wi, aim);
        return true;
      }
      if (d.type === 'fist' || d.type === 'melee') { if (!pressed && a.kind === 'player' && !held) return false; this.melee(a, d, aim); return true; }
      if (d.type === 'throw') { if (!pressed) return false; return this.throwIt(a, d, wi, aim); }
      if (d.type === 'syringe' || d.type === 'wire') { if (!pressed) return false; if (a.kind === 'player') this.tryTakedown(); return true; }
      return false;
    },

    fireGun(a, d, wi, aim) {
      wi.mag--;
      a.cool = d.rate; a.attackT = 0;
      const isP = a.kind === 'player';
      let spread = d.spread;
      if (isP) {
        const P = this.P;
        spread *= 1 + Math.min(1.6, a.speed / 110);
        if (a.crouch) spread *= 0.72;
        if (this.aiming) spread *= d.scope ? (this.holdBreath ? 0.12 : 0.25) : 0.55;
        else if (d.scope) spread += 0.06 * d.scope;   // hip-firing a scoped rifle
        spread *= 1 - this.sk('marksman') * 0.1;
        spread *= 1 + P.drunk * 1.5;
        spread += P.recoil;
        P.recoil = Math.min(0.25, P.recoil + d.recoil * 0.6);
      } else {
        spread = spread * (a.acc || 2.2) + 0.03 + Math.min(1, a.speed / 120) * 0.06;
      }
      const sup = !!wi.sup;
      const mx = a.x + Math.cos(aim) * 18, my = a.y + Math.sin(aim) * 18;
      const n = d.pellets || 1;
      for (let k = 0; k < n; k++) {
        const ang = aim + U.gauss() * spread;
        this.projectiles.push({ x: a.x + Math.cos(aim) * 12, y: a.y + Math.sin(aim) * 12, vx: Math.cos(ang) * d.speed, vy: Math.sin(ang) * d.speed, dmg: d.dmg * (sup ? 0.92 : 1) * (isP ? 1 + this.sk('marksman') * 0.05 : a.dmgMul || 1), owner: a.id, car: a.inCar || 0, w: d.id, life: (d.range || (d.scope ? 3600 : d.pellets ? 520 : 1500)) / d.speed, pierce: d.pierce || 0, dist: 0, fall: d.falloff || 0 });
      }
      this.emit('shot', { x: mx, y: my, a: aim, w: d.id, sup, id: a.id, player: isP, cls: d.cls });
      this.noise(a.x, a.y, sup ? 3 : d.noise, 'shot', a);
      if (isP) {
        this.note('shot', { sup });
        this.lastPlayerShotT = this.t;
        for (const c of this.near(a.x, a.y, 18 * TILE)) if (c.kind === 'cop' && c.alive && !c.inCar && (!sup || Math.hypot(c.x - a.x, c.y - a.y) < 6 * TILE)) { this.lastThreatT = this.t; break; }
        const heroic = this.near(a.x, a.y, 14 * TILE).some((t) => t.kind === 'thug' && t.crim && t.alive && Math.abs(U.angDiff(aim, Math.atan2(t.y - a.y, t.x - a.x))) < 0.3);
        if (!sup && !heroic) this.crimeEvent(a, 'shots', a.x, a.y, null);
      }
      if (wi.mag <= 0 && this.reserveOf(a, d) > 0 && !isP) this.reload(a);
    },
    reload(a) {
      const d = this.wdef(a), wi = a.wi;
      if (d.type !== 'gun' || a.reloadT > 0 || wi.mag >= d.mag || this.reserveOf(a, d) <= 0) return false;
      const sk = a.kind === 'player' ? 1 - this.sk('marksman') * 0.08 : 1.1;
      a.reloadT = d.reload * sk; a.reloadMax = a.reloadT; a.reloading = true;
      this.emit('reload', { x: a.x, y: a.y, id: a.id, stage: 'out', w: d.id, shell: !!d.perShell, player: a.kind === 'player' });
      return true;
    },
    tickWeapon(a, dt) {
      if (a.cool > 0) a.cool -= dt;
      a.attackT += dt;
      if (a.reloadT > 0) {
        a.reloadT -= dt;
        if (a.reloadT <= 0) {
          const d = this.wdef(a), wi = a.wi;
          if (d.type === 'gun') {
            if (d.perShell) {
              wi.mag += this.takeReserve(a, d, 1);
              this.emit('reload', { x: a.x, y: a.y, id: a.id, stage: 'shell', w: d.id, player: a.kind === 'player' });
              if (wi.mag < d.mag && this.reserveOf(a, d) > 0) { a.reloadT = d.reload * (a.kind === 'player' ? 1 - this.sk('marksman') * 0.08 : 1); return; }
            } else wi.mag += this.takeReserve(a, d, d.mag - wi.mag);
            this.emit('reload', { x: a.x, y: a.y, id: a.id, stage: 'in', w: d.id, player: a.kind === 'player' });
          }
          a.reloading = false; a.reloadT = 0;
        }
      }
    },

    // ------------------------------------------------------------ ballistics
    updateProjectiles(dt) {
      const out = [];
      for (const p of this.projectiles) {
        const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
        const len = Math.hypot(nx - p.x, ny - p.y), steps = Math.max(1, Math.ceil(len / 10));
        let alive = true, sx = p.x, sy = p.y;
        for (let k = 1; k <= steps && alive; k++) {
          const x = p.x + (nx - p.x) * (k / steps), y = p.y + (ny - p.y) * (k / steps);
          const tx = (x / TILE) | 0, ty = (y / TILE) | 0;
          if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) { alive = false; break; }
          const i = ty * this.W + tx, t = this.tiles[i];
          // actors along this sub-segment
          const hit = this.bulletActor(p, sx, sy, x, y);
          if (hit) {
            const { a, head } = hit;
            const owner = this.byId.get(p.owner);
            const fall = p.fall ? Math.max(0.25, 1 - (p.dist / 380) * p.fall) : 1;
            this.hurt(a, p.dmg * fall, owner, { kind: 'bullet', dir: Math.atan2(p.vy, p.vx), head, w: p.w, x, y });
            if (p.pierce > 0) { p.pierce--; p.dmg *= 0.6; p.skip = a.id; } else { alive = false; break; }
          }
          if (this.heli && p.owner === this.player.id && this.heliHit && this.heliHit(x, y, p.dmg, p.w)) { alive = false; break; }
          const car = this.bulletCar(x, y, p.car);
          if (car && W8[p.w] && W8[p.w].amr && p.pierce > 0 && p.skipCar !== car.id) {
            // .50 BMG goes straight through the body work — and whoever sits behind it
            if (this.carHit) this.carHit(car, x, y, p.dmg * 0.6, this.byId.get(p.owner), 'bullet'); else this.damageCar(car, p.dmg * 0.25, this.byId.get(p.owner));
            this.emit('impact', { x, y, a: Math.atan2(p.vy, p.vx), mat: 'metal' });
            const occ = [car.driver, ...(car.passengers || [])].map((id) => (id === 'player' ? this.player : this.byId.get(id))).filter((o) => o && o.alive);
            if (occ.length && Math.random() < 0.6) this.hurt(U.pick(occ), p.dmg * 0.7, this.byId.get(p.owner), { kind: 'bullet', dir: Math.atan2(p.vy, p.vx), w: p.w });
            p.pierce--; p.dmg *= 0.7; p.skipCar = car.id;
          } else if (car && p.skipCar !== car.id) {
            if (this.carHit) this.carHit(car, x, y, p.dmg, this.byId.get(p.owner), 'bullet'); else this.damageCar(car, p.dmg * 0.35, this.byId.get(p.owner));
            this.emit('impact', { x, y, a: Math.atan2(p.vy, p.vx), mat: 'metal' });
            if (car.driver === 'player' && Math.random() < 0.3) this.hurt(this.player, p.dmg * 0.7, this.byId.get(p.owner), { kind: 'bullet', dir: Math.atan2(p.vy, p.vx), w: p.w });
            alive = false; break;
          }
          if (t === T.WINDOW && !this.brokenGlass(i)) { this.breakGlass(i, x, y); }
          if (t === T.DOOR && this.opaque[i] && p.pierce > 0 && p.skipDoor !== i && W8[p.w] && W8[p.w].amr) {
            this.emit('impact', { x, y, a: Math.atan2(p.vy, p.vx), mat: 'wood', tx, ty }); p.pierce--; p.dmg *= 0.8; p.skipDoor = i;
          }
          if (TF[t] & 4 || this.solid[i] & 2 || (t === T.DOOR && this.opaque[i] && p.skipDoor !== i)) {
            this.emit('impact', { x: sx, y: sy, a: Math.atan2(p.vy, p.vx), mat: t === T.DOOR ? 'wood' : this.solid[i] & 2 ? 'prop' : 'wall', tx, ty });
            alive = false; break;
          }
          sx = x; sy = y;
        }
        p.dist += len;
        p.x = nx; p.y = ny; p.life -= dt;
        if (alive && p.life > 0) out.push(p);
        this.emit('tracer', { x0: p.x - p.vx * dt, y0: p.y - p.vy * dt, x1: alive ? p.x : sx, y1: alive ? p.y : sy, w: p.w });
      }
      this.projectiles = out;
    },
    bulletActor(p, x0, y0, x1, y1) {
      let best = null, bt = 2;
      for (const a of this.near((x0 + x1) / 2, (y0 + y1) / 2, 40)) {
        if (a.id === p.owner || a.id === p.skip || a.inCar || a.hidden) continue;
        const r = a.alive && !a.ko ? a.r + 2 : a.r * 0.8;
        const t = U.segCircle(x0, y0, x1, y1, a.x, a.y, r);
        if (t >= 0 && t < bt) {
          bt = t;
          // closest approach of the bullet line to the centre → headshot
          const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
          const perp = Math.abs((a.x - x0) * dy - (a.y - y0) * dx) / l;
          best = { a, head: a.alive && !a.ko && perp < a.r * 0.36 };
        }
      }
      return best;
    },
    brokenGlass(i) { return this.broken && this.broken.has(i); },
    breakGlass(i, x, y) {
      (this.broken || (this.broken = new Set())).add(i);
      this.emit('glass', { x, y, tx: i % this.W, ty: (i / this.W) | 0 });
      this.noise(x, y, 6, 'glass', null);
    },

    // ------------------------------------------------------------ melee
    melee(a, d, aim) {
      const isP = a.kind === 'player';
      const speed = isP ? 1 - this.sk('melee') * 0.05 : 1;
      a.cool = d.rate * speed; a.attackT = 0; a.punchSide ^= 1;
      a.combo = a.lastMelee && this.t - a.lastMelee < 0.75 ? (a.combo + 1) % 3 : 0;
      a.lastMelee = this.t;
      this.emit('swing', { x: a.x, y: a.y, a: aim, w: d.id, id: a.id, side: a.punchSide });
      this.noise(a.x, a.y, 1.5, 'scuffle', a);
      const targets = [];
      for (const b of this.near(a.x, a.y, d.range + 16)) {
        if (b === a || b.inCar || b.hidden || (!b.alive && d.type === 'fist')) continue;
        const ang = Math.atan2(b.y - a.y, b.x - a.x), dist = Math.hypot(b.x - a.x, b.y - a.y);
        if (dist > d.range + b.r || Math.abs(U.angDiff(aim, ang)) > d.arc / 2 + (dist < 18 ? 0.8 : 0)) continue;
        if (!K.los(this, a.x, a.y, b.x, b.y)) continue;
        targets.push({ b, dist, ang });
      }
      targets.sort((p, q) => p.dist - q.dist);
      const hits = targets.slice(0, d.type === 'fist' || d.id === 'knife' ? 1 : 2);
      for (const { b, ang } of hits) {
        if (!b.alive) { this.emit('blood', { x: b.x, y: b.y, a: ang, n: 6 }); continue; }
        const unaware = b.kind !== 'player' && !['hostile', 'warn', 'fight'].includes(b.state) && Math.abs(U.angDiff(b.angle, Math.atan2(a.y - b.y, a.x - b.x))) > 1.8;
        let dmg = d.dmg * (isP ? 1 + this.sk('melee') * 0.15 : a.meleeMul || 1);
        if (a.combo === 2) dmg *= 1.6;
        if ((unaware || b.ko > 0) && d.sharp) { this.kill(b, a, { kind: 'melee', w: d.id, dir: ang, silent: true, sharp: true, backstab: true }); continue; }
        if (unaware && d.type === 'fist') dmg *= 1.8;
        this.hurt(b, dmg, a, { kind: d.type === 'fist' ? 'fist' : 'melee', blunt: d.blunt || d.type === 'fist', sharp: d.sharp, w: d.id, dir: ang, combo: a.combo });
        if (b.alive) {
          const kb = d.type === 'fist' ? (a.combo === 2 ? 260 : 110) : 170;
          b.vx += Math.cos(ang) * kb; b.vy += Math.sin(ang) * kb;
          b.stun = Math.max(b.stun, a.combo === 2 ? 0.9 : 0.35);
        }
      }
      if (hits.length) this.emit('meleeHit', { x: hits[0].b.x, y: hits[0].b.y, w: d.id, a: aim, combo: a.combo, sharp: !!d.sharp });
    },

    // ------------------------------------------------------------ takedowns (player)
    takedownTarget() {
      const a = this.player;
      let best = null, bd = 1e9;
      for (const b of this.near(a.x, a.y, 40)) {
        if (b === a || !b.alive || b.inCar || b.dragBy || b.kind === 'player') continue;
        const ang = Math.atan2(b.y - a.y, b.x - a.x), dist = Math.hypot(b.x - a.x, b.y - a.y);
        if (dist > 34 || Math.abs(U.angDiff(a.angle, ang)) > 1.2) continue;
        const behind = Math.abs(U.angDiff(b.angle, Math.atan2(a.y - b.y, a.x - b.x))) > 1.9;
        const aware = ['hostile', 'warn', 'fight', 'arrest'].includes(b.state) && b.seesPlayer;
        if (b.ko <= 0 && b.stun <= 0 && aware && !behind) continue;
        if (dist < bd) { bd = dist; best = b; }
      }
      return best;
    },
    tryTakedown() {
      if (this.td) return false;
      const b = this.takedownTarget();
      if (!b) return false;
      const a = this.player, w = this.curWeapon(), d = W8[w.id];
      let kind = 'choke', dur = 1.7 * (1 - this.sk('melee') * 0.08);
      if (d.type === 'wire') { kind = 'wire'; dur = 2.3 * (1 - this.sk('melee') * 0.08); }
      else if (d.sharp) { kind = 'knife'; dur = 0.75; }
      else if (d.type === 'syringe') { kind = d.lethal ? 'poison' : 'sedate'; dur = 0.55; }
      if (b.ko > 0 && kind === 'choke') return false;
      this.td = { b: b.id, kind, t: 0, dur };
      b.stun = dur + 0.3; b.vx = b.vy = 0;
      a.vx = a.vy = 0;
      this.emit('takedown', { kind, x: b.x, y: b.y, id: b.id, stage: 'start' });
      this.noise(a.x, a.y, kind === 'knife' ? 1.2 : 1.8, 'scuffle', a);
      this.crimeEvent(a, kind === 'choke' || kind === 'sedate' ? 'assault' : 'murder', b.x, b.y, b);
      if (d.type === 'syringe') { w.n = (w.n || 1) - 1; if (w.n <= 0) this.removeWeaponAt(this.P.slot); }
      return true;
    },
    updateTakedown(dt) {
      const td = this.td, a = this.player, b = this.byId.get(td.b);
      if (!b || !b.alive) { this.td = null; return; }
      td.t += dt;
      // pin the victim in front of us
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      a.angle = U.turnTo(a.angle, ang, dt * 10);
      const tx = a.x + Math.cos(a.angle) * 17, ty = a.y + Math.sin(a.angle) * 17;
      b.x += (tx - b.x) * Math.min(1, dt * 10); b.y += (ty - b.y) * Math.min(1, dt * 10);
      b.angle = a.angle; b.stun = 0.3;
      if (Math.random() < dt * 5) this.emit('struggle', { x: b.x, y: b.y, kind: td.kind });
      if (td.t < td.dur) return;
      this.td = null;
      this.P.stats.takedowns++;
      if (td.kind === 'choke' || td.kind === 'sedate') { this.knockout(b, a, 150); this.addXP(20, 'Takedown'); }
      else if (td.kind === 'poison') { b.poisoned = 2.8; b.poisonBy = a.id; this.bark(b, U.pick(['Mir… ist schlecht…', 'Mein Herz…', '*hust*'])); this.addXP(25, 'Vergiftet'); }
      else { this.kill(b, a, { kind: td.kind, w: td.kind === 'wire' ? 'wire' : 'knife', dir: a.angle, silent: true, takedown: true, sharp: td.kind === 'knife' }); this.addXP(30, 'Lautloser Kill'); }
    },

    // ------------------------------------------------------------ throwables
    throwIt(a, d, wi, aim) {
      const isP = a.kind === 'player';
      const tx = isP ? this.aimX : a.x + Math.cos(aim) * 200, ty = isP ? this.aimY : a.y + Math.sin(aim) * 200;
      const dist = Math.min(d.place ? 26 : 330, Math.hypot(tx - a.x, ty - a.y));
      const t = d.place ? 0.15 : 0.35 + dist / 900;
      const o = { id: this.nid(), kind: d.id, x: a.x + Math.cos(aim) * 12, y: a.y + Math.sin(aim) * 12, z: 14, vx: Math.cos(aim) * dist / t, vy: Math.sin(aim) * dist / t, vz: d.place ? 0 : 160 + dist * 0.25, owner: a.id, fuse: d.id === 'grenade' ? 2.4 : -1, landed: false, t: 0 };
      this.throwables.push(o);
      a.cool = d.rate; a.attackT = 0;
      this.emit('throw', { x: a.x, y: a.y, kind: d.id });
      if (isP) {
        wi.n = (wi.n || 1) - 1;
        if (wi.n <= 0) this.removeWeaponAt(this.P.slot);
        if (d.id === 'grenade') this.crimeEvent(a, 'weapon', a.x, a.y, null);
      }
      return true;
    },
    updateThrowables(dt) {
      const keep = [];
      for (const o of this.throwables) {
        o.t += dt;
        if (!o.landed) {
          const nx = o.x + o.vx * dt, ny = o.y + o.vy * dt;
          const ti = this.tileIdx(nx, ny);
          if (this.tiles[ti] === T.WALL || this.tiles[ti] === T.HEDGE || (this.tiles[ti] === T.DOOR && this.opaque[ti]) || this.solid[ti] & 2) {
            // bounce off walls
            const bx = this.tileIdx(nx, o.y) !== this.tileIdx(o.x, o.y) && this.blockedTile(this.tileIdx(nx, o.y), null);
            if (bx) o.vx *= -0.4; else o.vy *= -0.4;
            this.emit('clink', { x: o.x, y: o.y, kind: o.kind });
          } else { o.x = nx; o.y = ny; }
          o.vz -= 900 * dt; o.z += o.vz * dt;
          if (o.z <= 0) {
            o.z = 0;
            if (Math.abs(o.vz) > 120 && o.kind !== 'c4') { o.vz = -o.vz * 0.3; o.vx *= 0.5; o.vy *= 0.5; this.emit('clink', { x: o.x, y: o.y, kind: o.kind }); }
            else {
              o.landed = true; o.vx = o.vy = o.vz = 0;
              if (o.kind === 'coin') { this.emit('coinLand', { x: o.x, y: o.y }); this.noise(o.x, o.y, W8.coin.noise, 'coin', null); o.fuse = 6; }
              if (o.kind === 'c4') this.emit('c4', { x: o.x, y: o.y });
            }
          }
        }
        if (o.fuse > 0) {
          o.fuse -= dt;
          if (o.fuse <= 0) {
            if (o.kind === 'grenade') { this.explode(o.x, o.y, 130, 190, this.byId.get(o.owner)); continue; }
            if (o.kind === 'coin') continue;
          }
        }
        if (o.boom) { this.explode(o.x, o.y, 150, 240, this.byId.get(o.owner)); continue; }
        keep.push(o);
      }
      this.throwables = keep;
    },
    detonate() {
      let n = 0;
      for (const o of this.throwables) if (o.kind === 'c4' && o.owner === this.player.id) { o.boom = true; n++; }
      if (n) this.emit('sfx', { s: 'beep' });
      return n;
    },
    explode(x, y, R, dmg, src) {
      this.emit('explosion', { x, y, r: R });
      this.noise(x, y, 55, 'explosion', src);
      for (const a of this.near(x, y, R * 1.3)) {
        if (a.hidden || a.inCar) continue;
        const d = Math.hypot(a.x - x, a.y - y);
        if (d > R * 1.3 || !K.los(this, x, y, a.x, a.y)) continue;
        const f = 1 - d / (R * 1.3), ang = Math.atan2(a.y - y, a.x - x);
        if (a.alive) this.hurt(a, dmg * f, src, { kind: 'explosion', dir: ang, gore: f > 0.45 });
        else if (f > 0.5) this.emit('gib', { x: a.x, y: a.y, a: ang });
        a.vx += Math.cos(ang) * 520 * f; a.vy += Math.sin(ang) * 520 * f;
      }
      for (const c of this.cars) { const d = Math.hypot(c.x - x, c.y - y); if (d < R * 1.4) this.damageCar(c, 160 * (1 - d / (R * 1.4)), src); }
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
        const tx = ((x / TILE) | 0) + i, ty = ((y / TILE) | 0) + j;
        if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) continue;
        const k = ty * this.W + tx; if (this.tiles[k] === T.WINDOW && !this.brokenGlass(k) && Math.hypot(i, j) < 3.2) this.breakGlass(k, (tx + 0.5) * TILE, (ty + 0.5) * TILE);
      }
      if (this.blastDoors) this.blastDoors(x, y, R);
      if (src && src.kind === 'player') this.crimeEvent(src, 'murder', x, y, null, true);
    },

    // ------------------------------------------------------------ damage
    hurt(t, dmg, src, info = {}) {
      if (!t.alive) { if (info.kind === 'bullet' || info.kind === 'explosion') this.emit('corpseHit', { x: t.x, y: t.y, a: info.dir, id: t.id, gore: info.kind === 'explosion' }); return; }
      let d = dmg;
      const isP = t.kind === 'player';
      if (isP) {
        d *= this.difficulty || 1;
        if (this.P.painkiller > 0) d *= 0.7;
        if (this.godMode) d = 0;
      }
      if (info.head) d *= isP ? 1.5 : 2.6;
      if (t.armor > 0 && (info.kind === 'bullet' || info.kind === 'explosion')) {
        const ab = Math.min(t.armor, d * 0.65); t.armor -= ab * 1.1; d -= ab; if (t.armor < 0) t.armor = 0;
      }
      if (t.ko > 0 && info.blunt) d *= 2;
      t.hp -= d; t.flinch = 0.18; if (src) t.lastHitBy = src.id;
      if (info.kind === 'bullet' && d > 18) t.bleed = Math.min(3, t.bleed + (d > 40 ? 1 : 0.5));
      if (info.sharp) t.bleed = Math.min(3, t.bleed + 1);
      if (info.kind === 'bullet' || info.sharp || info.kind === 'explosion' || info.kind === 'car') t.bloodFeet = 0;
      this.emit('hurt', { id: t.id, x: t.x, y: t.y, dmg: d, a: info.dir, head: info.head, kind: info.kind, player: isP, blunt: !!info.blunt, w: info.w });
      if (t.hp <= 0) {
        if (info.blunt && !isP && t.ko <= 0 && info.kind !== 'explosion') { t.hp = 5; this.knockout(t, src, 120); return; }
        this.kill(t, src, info);
        return;
      }
      if (!isP) this.onAttacked(t, src, info);
      else if (src && src !== t && this.crewProtect) this.crewProtect(src);
      if (src && src.kind === 'player' && !isP) { if (t.kind === 'cop') this.lastThreatT = this.t; this.crimeEvent(src, 'assault', t.x, t.y, t); }
    },
    knockout(t, src, dur) {
      t.ko = dur; t.state = 'ko'; t.path = null; t.vx *= 0.3; t.vy *= 0.3; t.susp = 0; t.koA = t.angle + Math.PI * (Math.random() < 0.5 ? 0.5 : -0.5);
      this.emit('ko', { id: t.id, x: t.x, y: t.y });
      if (src && src.kind === 'player') { this.crimeEvent(src, 'assault', t.x, t.y, t); this.note('ko', { victim: t }); if (this.heroReward) this.heroReward(t, src); }
    },
    kill(t, src, info = {}) {
      if (!t.alive) return;
      t.alive = false; t.dead = true; t.hp = 0; t.ko = 0; t.deadT = 0; t.state = 'dead'; t.path = null;
      t.deathA = info.dir != null ? info.dir : t.angle + Math.PI;
      t.bloody = !['poison', 'wire', 'hunger', 'thirst'].includes(info.kind);
      t.killInfo = info; t.killer = src ? src.id : 0;
      const push = info.kind === 'explosion' ? 380 : info.kind === 'car' ? 320 : info.kind === 'bullet' ? (W8[info.w] && W8[info.w].pellets ? 260 : 120) : 50;
      t.vx = Math.cos(t.deathA) * push + t.vx * 0.3; t.vy = Math.sin(t.deathA) * push + t.vy * 0.3;
      const gore = !!(info.gore || (info.head && W8[info.w] && W8[info.w].dmg >= 75) || (info.kind === 'bullet' && W8[info.w] && W8[info.w].pellets && Math.random() < 0.45));
      this.emit('death', { id: t.id, x: t.x, y: t.y, a: t.deathA, head: !!info.head, gore, kind: info.kind, bloody: t.bloody, player: t.kind === 'player', who: t.kind, silent: !!info.silent });
      // armed NPCs drop their gun
      if (t.kind !== 'player' && t.wi && t.wi.id !== 'fists' && W8[t.wi.id].type !== 'syringe') {
        this.dropItem({ kind: 'weapon', wid: t.wi.id, mag: t.wi.mag, sup: t.wi.sup }, t.x + U.rnd(-10, 10), t.y + U.rnd(-10, 10));
      }
      if (this.drag === t.id) { /* keep dragging corpses */ }
      if (t.kind === 'player') { this.playerDown(info); return; }
      if (src && src.kind === 'player') {
        const P = this.P;
        P.stats.kills++;
        if (info.head) { P.stats.headshots++; this.addXP(12, 'Kopfschuss'); }
        if (['civ', 'keeper', 'staff'].includes(t.kind)) P.stats.civKills++;
        if (!info.takedown) this.addXP(t.kind === 'civ' ? 2 : 10, t.kind === 'civ' ? 'Zivilist' : 'Ausgeschaltet');
        this.crimeEvent(src, t.kind === 'cop' ? 'copkill' : 'murder', t.x, t.y, t);
      }
      this.onKill(t, src, info);
      if (t.inCar) { const c = this.cars.find((c) => c.id === t.inCar); if (c) c.driver = null; t.inCar = null; }
    },
    playerDown(info) {
      const a = this.player;
      this.td = null; this.drag = null; this.action = null;
      if (a.inCar) this.exitCar(true);
      this.emit('playerDead', { kind: info.kind });
      this.slowmo = 1.6;
    },
    dropItem(it, x, y) {
      it.id = this.nid(); it.x = x; it.y = y; it.t = this.t; it.taken = false;
      this.items.push(it);
      return it;
    },
  });
})(globalThis.K = globalThis.K || {});
