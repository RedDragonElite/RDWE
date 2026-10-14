/* RDE // KONTRAKT — vehicles: arcade car physics, traffic on the lane graph, police pursuit, carjacking */
(function (K) {
  'use strict';
  const U = K.U, T = K.T, TF = K.TF, TILE = K.TILE;
  const CARK = K.CARK = {
    sedan: { l: 64, w: 30, max: 430, acc: 250, colors: ['#8a1c22', '#1f3b63', '#d8d8d2', '#2b2d31', '#4e5a3a', '#6b6f78', '#0f2a24', '#7a5c2e'] },
    sport: { l: 62, w: 30, max: 580, acc: 400, colors: ['#c8102e', '#f2c200', '#111214', '#e6e6e6', '#0e5fd8'] },
    van:   { l: 78, w: 34, max: 330, acc: 180, colors: ['#e8e8e4', '#3b4048', '#8b6a3a'] },
    taxi:  { l: 64, w: 30, max: 420, acc: 250, colors: ['#f2c200'] },
    police:{ l: 66, w: 31, max: 520, acc: 330, colors: ['#10141c'] },
  };
  const P = 26, NB = 7, LANE = 32;
  const nodeXY = (i, j) => [(i * P + 2) * TILE, (j * P + 2) * TILE];

  K.mixin({
    spawnCar(kind, x, y, a, o = {}) {
      const d = CARK[kind];
      const c = { id: this.nid(), kind, x, y, a, vx: 0, vy: 0, l: d.l, w: d.w, color: o.color || U.pick(d.colors), hp: 100, driver: null, ai: null, parked: !!o.parked, lightsOn: false, siren: false, brake: 0, honk: 0, steer: 0, thr: 0, fire: 0, dead: false, blockT: 0, skid: 0, crashCD: 0 };
      this.cars.push(c);
      if (this.initCarState) this.initCarState(c);
      return c;
    },
    carOf(a) { return this.cars.find((c) => c.id === a.inCar) || { x: a.x, y: a.y }; },
    putDriver(c, kind = 'civ', o = {}) {
      const dr = this.spawnActor(kind, c.x, c.y, { state: 'driving', ...o });
      dr.inCar = c.id; c.driver = dr.id;
      return dr;
    },

    // ------------------------------------------------------------ traffic management
    updateTraffic() {
      const p = this.player;
      const h = this.hour();
      const want = h >= 7 && h < 21 ? 13 : h >= 21 || h < 1 ? 8 : 4;
      let n = 0;
      for (const c of this.cars) {
        if (c.dead) continue;
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        const mine = c.driver === 'player' || c.playerOwned || c.owned || c.display || c.service;
        const busyUnit = c.unit && !['patrol', 'leave', 'abandoned'].includes(c.unit.mode);
        if (!mine && d > 60 * TILE && !busyUnit) { this.despawnCar(c); continue; }
        if (c.ai && c.driver && c.driver !== 'player' && c.kind !== 'police') n++;
      }
      if (n < want) this.spawnTraffic();
      this.cars = this.cars.filter((c) => !c.dead || c.fire > 0);
    },
    despawnCar(c) {
      c.dead = true; c.fire = 0;
      if (c.driver && c.driver !== 'player') { const d = this.byId.get(c.driver); if (d) this.removeActor(d); }
      for (const id of c.passengers || []) { const d = this.byId.get(id); if (d) this.removeActor(d); }
    },
    spawnTraffic(kind) {
      const p = this.player;
      for (let k = 0; k < 20; k++) {
        const i = U.rint(NB + 1), j = U.rint(NB + 1);
        const nb = this.roadNeighbors(i, j); if (!nb.length) continue;
        const [ni, nj] = U.pick(nb);
        const [x0, y0] = nodeXY(i, j), [x1, y1] = nodeXY(ni, nj);
        const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
        const t = 0.3 + Math.random() * 0.4;
        const x = x0 + (x1 - x0) * t - dy * LANE, y = y0 + (y1 - y0) * t + dx * LANE;
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < 24 * TILE || d > 50 * TILE) continue;
        if (this.cars.some((c) => !c.dead && Math.hypot(c.x - x, c.y - y) < 120)) continue;
        const kd = kind || U.pickW([['sedan', 30], ['compact', 18], ['taxi', 8], ['van', 7], ['suv', 9], ['pickup', 7], ['coupe', 6], ['muscle', 4], ['sport', 4], ['ev', 4], ['super', 1]]);
        const c = this.spawnCar(kd, x, y, Math.atan2(dy, dx));
        c.ai = { fi: i, fj: j, ti: ni, tj: nj, stage: 'road', wp: null };
        c.vx = dx * 120; c.vy = dy * 120;
        this.putDriver(c, kd === 'police' ? 'cop' : 'civ', kd === 'police' ? { outfit: 'police', weapon: 'p9', hp: 120 } : {});
        return c;
      }
      return null;
    },
    roadNeighbors(i, j) {
      const out = [];
      if (i > 0) out.push([i - 1, j]); if (i < NB) out.push([i + 1, j]);
      if (j > 0) out.push([i, j - 1]); if (j < NB) out.push([i, j + 1]);
      return out;
    },
    ensurePoliceCars(n) {
      const have = this.cars.filter((c) => c.kind === 'police' && !c.dead && c.pursuit).length;
      this.polT = (this.polT || 0) - 0.016;
      if (have >= n || this.polT > 0) return;
      this.polT = 6;
      const c = this.spawnTraffic('police');
      if (c) {
        c.pursuit = true; c.siren = true;
        c.passengers = [this.spawnCop(c.x, c.y, 'hostile').id];
        const pa = this.byId.get(c.passengers[0]); pa.inCar = c.id;
      }
    },

    // ------------------------------------------------------------ per-frame
    updateCars(dt) {
      const night = this.daylight() < 0.5;
      for (const c of this.cars) {
        if (c.dead && c.fire <= 0) continue;
        c.lightsOn = night && !!c.driver;
        if (c.crashCD > 0) c.crashCD -= dt;
        if (c.honk > 0) c.honk -= dt;
        if (c.fire > 0) {
          c.fire -= dt;
          if (Math.random() < dt * 8) this.emit('carFire', { x: c.x, y: c.y });
          if (c.fire <= 0) { this.explode(c.x, c.y, 150, 230, this.byId.get(c.lastHitBy) || null); c.dead = true; c.wreck = true; this.wrecks = (this.wrecks || []); this.wrecks.push({ x: c.x, y: c.y, a: c.a, l: c.l, w: c.w, t: this.t }); continue; }
        }
        let thr = 0, steer = 0, hb = false;
        if (c.driver === 'player') {
          const inp = this.carInput || {}; thr = inp.thr || 0; steer = inp.steer || 0; hb = !!inp.hb;
          if (c.cruise && thr >= 0) { const vf = c.vf || 0; thr = vf < c.cruise - 6 ? 1 : vf > c.cruise + 12 ? -0.25 : 0.25; }
        }
        else if (c.driver && !c.dead) { const dr = this.byId.get(c.driver); if (!dr || !dr.alive) { c.driver = null; } else [thr, steer, hb] = c.unit ? this.unitDrive(c, dt) : c.pursuit ? this.policeDrive(c, dt) : this.trafficDrive(c, dt); }
        if (c.serviceLock) thr = 0;
        c.thr = thr; c.steer = U.lerp(c.steer, steer, Math.min(1, dt * 10));
        this.carPhysics(c, thr, c.steer, hb, dt);
        if (c.yawT > 0 && this.applyYawKick) this.applyYawKick(c, dt);
      }
      this.carCollisions(dt);
    },
    carPhysics(c, thr, steer, hb, dt) {
      const d = CARK[c.kind];
      const m = this.carMods ? this.carMods(c) : { acc: 1, max: 1, grip: 1, brake: 1, pull: 0, pow: 1 };
      const fx = Math.cos(c.a), fy = Math.sin(c.a), sx = -fy, sy = fx;
      let vf = c.vx * fx + c.vy * fy, vs = c.vx * sx + c.vy * sy;
      const hpf = c.hp < 30 ? 0.6 : 1;
      if (thr > 0) vf += d.acc * m.acc * thr * dt * (vf < 0 ? 2.5 : 1) * hpf;
      else if (thr < 0) { if (vf > 15) vf += 700 * m.brake * thr * dt; else vf += d.acc * 0.6 * thr * dt * (m.pow > 0 ? 1 : 0); }
      else vf -= Math.sign(vf) * Math.min(Math.abs(vf), 90 * dt);
      vf = U.clamp(vf, -160, Math.max(Math.abs(vf) * (thr > 0 ? 0 : 1), d.max * m.max * hpf));
      vf *= 1 - 0.18 * dt;
      if (Math.abs(vf) > 30) steer = U.clamp(steer + m.pull, -1, 1);
      const grip = hb ? 1.4 : 8.5 * m.grip;
      c.skid = Math.abs(vs) > 80 || (hb && Math.abs(vf) > 120) ? 1 : 0;
      vs *= Math.max(0, 1 - grip * dt);
      if (hb) vf *= 1 - 1.4 * dt;
      c.brake = thr < 0 && vf > 10 ? 1 : 0;
      const turn = steer * 2.5 * U.clamp(vf / 170, -1, 1) * (hb ? 1.45 : 1);
      c.a += turn * dt;
      const nfx = Math.cos(c.a), nfy = Math.sin(c.a);
      c.vx = nfx * vf + -nfy * vs; c.vy = nfy * vf + nfx * vs;
      c.speed = Math.hypot(c.vx, c.vy); c.vf = vf;
      if (c.skid && c.speed > 60 && Math.random() < 0.6) this.emit('skid', { x: c.x, y: c.y, a: c.a, l: c.l, w: c.w, id: c.id });
      // integrate with tile collision
      const nx = c.x + c.vx * dt, ny = c.y + c.vy * dt;
      if (this.carSmash) this.carSmash(c, nx, ny);
      if (!this.carBlocked(c, nx, ny, c.a)) { c.x = nx; c.y = ny; return; }
      const impact = c.speed;
      // where did we hit? project the motion onto the body outline
      const mvx = c.vx * fx + c.vy * fy, mvy = -c.vx * fy + c.vy * fx, mm = Math.hypot(mvx, mvy) || 1;
      const sc = Math.min((c.l / 2) / Math.max(1e-3, Math.abs(mvx / mm)), (c.w / 2) / Math.max(1e-3, Math.abs(mvy / mm)));
      const hitU = mvx / mm * sc, hitV = mvy / mm * sc;
      if (!this.carBlocked(c, nx, c.y, c.a)) { c.x = nx; c.vy *= -0.25; }
      else if (!this.carBlocked(c, c.x, ny, c.a)) { c.y = ny; c.vx *= -0.25; }
      else { c.vx *= -0.3; c.vy *= -0.3; if (this.carBlocked(c, c.x, c.y, c.a)) { c.a -= turn * dt; } }
      if (impact > 70 && c.crashCD <= 0) { c.crashCD = 0.4; if (this.carImpact) this.carImpact(c, hitU, hitV, impact); if (impact > 130) { this.damageCar(c, impact * 0.06, null); this.emit('crash', { x: c.x + fx * hitU - fy * hitV, y: c.y + fy * hitU + fx * hitV, v: impact, player: c.driver === 'player' }); if (this.crashBelt) this.crashBelt(c, impact); } }
    },
    carTileBlocked(x, y) {
      const tx = (x / TILE) | 0, ty = (y / TILE) | 0;
      if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return true;
      const i = ty * this.W + tx, t = this.tiles[i];
      return !!(TF[t] & 1 || TF[t] & 8 || this.solid[i] & 1);
    },
    carBlocked(c, x, y, a) {
      const fx = Math.cos(a), fy = Math.sin(a), hl = c.l / 2 - 3, hw = c.w / 2 - 2;
      for (const [u, v] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [hl, 0], [-hl, 0], [0, hw], [0, -hw]]) {
        if (this.carTileBlocked(x + fx * u - fy * v, y + fy * u + fx * v)) return true;
      }
      return false;
    },
    carCollisions(dt) {
      const cars = this.cars.filter((c) => !c.dead);
      // car ↔ car (two circles each)
      for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j];
        if (Math.abs(a.x - b.x) > 90 || Math.abs(a.y - b.y) > 90) continue;
        for (const ka of [-1, 1]) for (const kb of [-1, 1]) {
          const ax = a.x + Math.cos(a.a) * a.l * 0.27 * ka, ay = a.y + Math.sin(a.a) * a.l * 0.27 * ka;
          const bx = b.x + Math.cos(b.a) * b.l * 0.27 * kb, by = b.y + Math.sin(b.a) * b.l * 0.27 * kb;
          const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy), m = (a.w + b.w) / 2;
          if (d >= m || d < 0.01) continue;
          const nx = dx / d, ny = dy / d, pen = (m - d) / 2;
          a.x -= nx * pen; a.y -= ny * pen; b.x += nx * pen; b.y += ny * pen;
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rv < 0) {
            const imp = -rv * 0.8;
            a.vx -= nx * imp; a.vy -= ny * imp; b.vx += nx * imp; b.vy += ny * imp;
            if (-rv > 90 && a.crashCD <= 0) {
              a.crashCD = b.crashCD = 0.4;
              const dm = -rv * 0.07; this.damageCar(a, dm, b.driver === 'player' ? this.player : null); this.damageCar(b, dm, a.driver === 'player' ? this.player : null);
              if (this.carImpact) for (const [q, cx, cy] of [[a, (ax + bx) / 2, (ay + by) / 2], [b, (ax + bx) / 2, (ay + by) / 2]]) {
                const qx = cx - q.x, qy = cy - q.y, qf = Math.cos(q.a), qs = Math.sin(q.a);
                this.carImpact(q, qx * qf + qy * qs, -qx * qs + qy * qf, -rv * 1.2);
              }
              if (this.crashBelt) { if (a.driver === 'player') this.crashBelt(a, -rv * 1.3); if (b.driver === 'player') this.crashBelt(b, -rv * 1.3); }
              this.emit('crash', { x: (ax + bx) / 2, y: (ay + by) / 2, v: -rv, player: a.driver === 'player' || b.driver === 'player' });
            }
          }
        }
      }
      // car ↔ people
      for (const c of cars) {
        if (c.speed < 5) continue;
        const fx = Math.cos(c.a), fy = Math.sin(c.a);
        for (const a of this.near(c.x, c.y, c.l)) {
          if (a.inCar || a.hidden || (a.carCD && a.carCD > this.t)) continue;
          const dx = a.x - c.x, dy = a.y - c.y;
          const lx = dx * fx + dy * fy, ly = -dx * fy + dy * fx;
          if (Math.abs(lx) > c.l / 2 + a.r || Math.abs(ly) > c.w / 2 + a.r) continue;
          const drv = c.driver === 'player' ? this.player : this.byId.get(c.driver);
          const front = (c.vf || 0) >= 0 ? lx > c.l / 2 - 16 : lx < -c.l / 2 + 16;
          if (c.speed > 85 && a.alive && front) {
            a.carCD = this.t + 0.6;
            a.vx = c.vx * 1.1 + (ly > 0 ? -fy : fy) * 120; a.vy = c.vy * 1.1 + (ly > 0 ? fx : -fx) * 120;
            this.emit('carHit', { x: a.x, y: a.y, v: c.speed });
            this.hurt(a, c.speed * 0.24, drv || null, { kind: 'car', dir: Math.atan2(c.vy, c.vx), blunt: false });
            if (this.carImpact) this.carImpact(c, (c.vf || 0) >= 0 ? c.l / 2 : -c.l / 2, ly * 0.8, Math.min(140, c.speed * 0.45));
            if (a.alive) { a.stun = 1.2; if (a.kind !== 'player') this.knockout(a, drv && drv.kind === 'player' ? drv : null, 20); }
            c.vx *= 0.85; c.vy *= 0.85;
          } else {
            // shove aside
            const push = (c.w / 2 + a.r - Math.abs(ly)) * Math.sign(ly || 1);
            a.x += -fy * push; a.y += fx * push;
            if (!a.alive && c.speed > 40 && Math.random() < 0.2) this.emit('corpseHit', { x: a.x, y: a.y, a: c.a, id: a.id });
          }
        }
      }
    },
    damageCar(c, dmg, src) {
      if (c.dead) return;
      if (c.tune && c.tune.armor) dmg *= 1 - c.tune.armor * 0.15;
      c.hp -= dmg;
      if (src) c.lastHitBy = src.id;
      if (c.hp <= 0 && c.fire <= 0) {
        c.fire = 4; c.hp = 0;
        this.emit('carBurn', { x: c.x, y: c.y });
        if (c.driver && c.driver !== 'player') { const d = this.byId.get(c.driver); if (d) this.ejectFrom(c, d, true); }
      }
    },

    // ------------------------------------------------------------ AI drivers
    obstacleAhead(c) {
      const fx = Math.cos(c.a), fy = Math.sin(c.a);
      const look = 60 + Math.max(0, c.vf || 0) * 0.55 + c.l / 2;
      for (const a of this.near(c.x + fx * look / 2, c.y + fy * look / 2, look)) {
        if (a.inCar || !a.alive && a.deadT > 0 && false) continue;
        if (a.inCar || a.hidden) continue;
        const dx = a.x - c.x, dy = a.y - c.y, lx = dx * fx + dy * fy, ly = -dx * fy + dy * fx;
        if (lx > c.l / 2 - 4 && lx < look && Math.abs(ly) < c.w / 2 + 12) return a.kind === 'player' ? 'player' : 'ped';
      }
      for (const o of this.cars) {
        if (o === c || o.dead) continue;
        const dx = o.x - c.x, dy = o.y - c.y; if (Math.abs(dx) > look + 40 || Math.abs(dy) > look + 40) continue;
        const lx = dx * fx + dy * fy, ly = -dx * fy + dy * fx;
        if (lx > 10 && lx < look + o.l / 2 && Math.abs(ly) < (c.w + o.w) / 2 - 4) return 'car';
      }
      return null;
    },
    trafficDrive(c, dt) {
      const ai = c.ai; if (!ai) return [0, 0, false];
      if (!ai.wp) this.planLeg(c);
      const [wx, wy] = ai.wp;
      const dx = wx - c.x, dy = wy - c.y, dist = Math.hypot(dx, dy);
      if (dist < 30) { this.advanceLeg(c); }
      const want = Math.atan2(dy, dx);
      const steer = U.clamp(U.angDiff(c.a, want) * 2.2, -1, 1);
      let tgt = ai.stage === 'turn' ? 105 : 175;
      if (Math.abs(U.angDiff(c.a, want)) > 0.6) tgt = Math.min(tgt, 90);
      if (c.flee > 0) { c.flee -= dt; tgt = 300; }
      const ob = this.obstacleAhead(c);
      if (ob) {
        c.blockT += dt;
        tgt = c.blockT > 7 ? 30 : 0;
        if (ob === 'player' && c.blockT > 1.4 && c.honk <= 0) { c.honk = 1.6; this.emit('honk', { x: c.x, y: c.y }); }
      } else c.blockT = Math.max(0, c.blockT - dt * 2);
      const vf = c.vf || 0;
      const thr = vf < tgt - 10 ? 1 : vf > tgt + 15 ? -0.8 : 0;
      return [thr, steer, false];
    },
    planLeg(c) {
      const ai = c.ai;
      const [x1, y1] = nodeXY(ai.ti, ai.tj), [x0, y0] = nodeXY(ai.fi, ai.fj);
      const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
      ai.dir = [dx, dy];
      ai.wp = [x1 - dx * 70 - dy * LANE, y1 - dy * 70 + dx * LANE];
      ai.stage = 'road';
    },
    advanceLeg(c) {
      const ai = c.ai;
      if (ai.stage === 'road') {
        // choose the next road at the intersection
        const opts = this.roadNeighbors(ai.ti, ai.tj).filter(([i, j]) => !(i === ai.fi && j === ai.fj));
        const [ni, nj] = opts.length ? U.pick(opts) : [ai.fi, ai.fj];
        const [x1, y1] = nodeXY(ai.ti, ai.tj), [x2, y2] = nodeXY(ni, nj);
        const ndx = Math.sign(x2 - x1), ndy = Math.sign(y2 - y1);
        ai.next = [ni, nj];
        ai.wp = [x1 + ndx * 70 - ndy * LANE, y1 + ndy * 70 + ndx * LANE];
        ai.stage = 'turn';
      } else {
        ai.fi = ai.ti; ai.fj = ai.tj; [ai.ti, ai.tj] = ai.next;
        this.planLeg(c);
      }
    },
    policeDrive(c, dt) {
      const p = this.player;
      const tgt = p.inCar ? this.carOf(p) : p;
      const d = Math.hypot(tgt.x - c.x, tgt.y - c.y);
      if (this.wanted < 1) { c.pursuit = false; c.siren = false; c.ai = c.ai || { fi: 0, fj: 0, ti: 1, tj: 0 }; c.ai.wp = null; return [0, 0, false]; }
      c.seesPlayer = d < 16 * TILE && K.los(this, c.x, c.y, tgt.x, tgt.y);
      // close in on foot target → deploy officers
      if (!p.inCar && d < 7 * TILE && c.seesPlayer) {
        if (!c.deployed) this.deployCops(c);
        return [c.vf > 5 ? -1 : 0, 0, false];
      }
      let wx, wy;
      if (c.seesPlayer) { wx = tgt.x; wy = tgt.y; }
      else {
        // greedy on the road graph
        const i = U.clamp(Math.round((c.x / TILE - 2) / P), 0, NB), j = U.clamp(Math.round((c.y / TILE - 2) / P), 0, NB);
        const [nx, ny] = nodeXY(i, j);
        if (Math.hypot(nx - c.x, ny - c.y) > 80) { wx = nx; wy = ny; }
        else {
          let best = null, bd = 1e9;
          for (const [a, b] of this.roadNeighbors(i, j)) { const [qx, qy] = nodeXY(a, b); const q = Math.hypot(qx - tgt.x, qy - tgt.y); if (q < bd) { bd = q; best = [qx, qy]; } }
          [wx, wy] = best;
        }
      }
      const want = Math.atan2(wy - c.y, wx - c.x);
      const steer = U.clamp(U.angDiff(c.a, want) * 2.5, -1, 1);
      const ob = !c.seesPlayer && this.obstacleAhead(c);
      let thr = ob === 'car' || ob === 'ped' ? -0.5 : Math.abs(U.angDiff(c.a, want)) > 1.2 && c.vf > 140 ? -0.6 : 1;
      if (c.speed < 20) { c.stuckT = (c.stuckT || 0) + dt; if (c.stuckT > 1.5) { thr = -1; if (c.stuckT > 2.6) c.stuckT = 0; } } else c.stuckT = 0;
      return [thr, steer, Math.abs(U.angDiff(c.a, want)) > 1.4 && c.vf > 200];
    },
    deployCops(c) {
      c.deployed = true; c.pursuit = false;
      for (const id of c.passengers || []) { const a = this.byId.get(id); if (a) this.ejectFrom(c, a, false); }
      c.passengers = [];
      const dr = this.byId.get(c.driver);
      if (dr) { this.ejectFrom(c, dr, false); this.alarm(dr, this.player); }
    },
    ejectFrom(c, a, flee) {
      a.inCar = null;
      const s = Math.random() < 0.5 ? 1 : -1;
      a.x = c.x - Math.sin(c.a) * (c.w / 2 + 14) * s; a.y = c.y + Math.cos(c.a) * (c.w / 2 + 14) * s;
      this.collide(a);
      if (c.driver === a.id) c.driver = null;
      if (flee) this.flee(a, c.x, c.y, true);
      else if (a.kind === 'cop') this.alarm(a, this.player);
    },

    // ------------------------------------------------------------ player ↔ car
    carNear(a) {
      let best = null, bd = 1e9;
      for (const c of this.cars) {
        if (c.dead || c.fire > 0) continue;
        const d = Math.hypot(c.x - a.x, c.y - a.y);
        if (d < c.l / 2 + 22 && d < bd) { bd = d; best = c; }
      }
      return best;
    },
    enterCar(c) {
      const a = this.player;
      const hadDriver = !!(c.driver && c.driver !== 'player');
      if (c.display) return this.notify(`Ausstellungsstück — ${K.CARMODELS[c.display].name} gibt es beim Verkäufer im Autohaus.`, 'bad');
      if (c.serviceLock) return this.notify('Der Wagen ist gerade auf der Bühne.', 'bad');
      if (c.service && this.svc && this.svc.car === c.id && this.serviceCancel) this.serviceCancel();
      if (c.driver && c.driver !== 'player') {
        const d = this.byId.get(c.driver);
        if (d) {
          this.ejectFrom(c, d, d.kind !== 'cop');
          this.bark(d, d.kind === 'cop' ? 'Hey! Das ist ein Polizeiwagen!' : U.pick(['Mein Auto!!', 'Hilfe, Autodieb!', 'Nimm es, nimm es!']));
          this.crimeEvent(a, 'theft', c.x, c.y, d);
          if (d.kind === 'cop') { this.raiseWanted(2, 'assault'); this.alarm(d, a); }
        }
      } else if (c.kind === 'police' && !c.playerOwned) this.crimeEvent(a, 'theft', c.x, c.y, null);
      else if (!c.owned && !c.playerOwned && !c.service) { c.hotwire = true; this.crimeEvent(a, 'theft', c.x, c.y, null); }
      // a car someone was just driving keeps running; a parked one has to be started (or hot-wired)
      if (!hadDriver) { c.engineOn = false; c.crankT = null; }
      c.belt = false;
      for (const id of c.passengers || []) { const p = this.byId.get(id); if (p) this.ejectFrom(c, p, p.kind !== 'cop'); }
      c.passengers = [];
      c.driver = 'player'; c.ai = null; c.pursuit = false; c.parked = false; c.siren = false; c.unit = null; c.route = null;
      a.inCar = c.id; this.drag = null;
      this.emit('carEnter', { id: c.id, kind: c.kind });
    },
    exitCar(force) {
      const a = this.player, c = this.carOf(a);
      if (!c || c.driver !== 'player') { a.inCar = null; return; }
      if (!force && c.speed > 120) return this.notify('Zu schnell zum Aussteigen!', 'bad');
      a.inCar = null; c.driver = null; c.playerOwned = true; c.cruise = 0; c.boost = false;
      for (const s of [-1, 1]) {
        a.x = c.x - Math.sin(c.a) * (c.w / 2 + 14) * s; a.y = c.y + Math.cos(c.a) * (c.w / 2 + 14) * s;
        if (!this.blockedTile(this.tileIdx(a.x, a.y), a)) break;
      }
      this.collide(a);
      a.vx = c.vx * 0.5; a.vy = c.vy * 0.5;
      this.emit('carExit', { id: c.id });
    },
    bulletCar(x, y, skip) {
      for (const c of this.cars) {
        if (c.dead || c.id === skip || Math.abs(c.x - x) > 45 || Math.abs(c.y - y) > 45) continue;
        const fx = Math.cos(c.a), fy = Math.sin(c.a), dx = x - c.x, dy = y - c.y;
        if (Math.abs(dx * fx + dy * fy) < c.l / 2 && Math.abs(-dx * fy + dy * fx) < c.w / 2) {
          return c;
        }
      }
      return null;
    },
  });
})(globalThis.K = globalThis.K || {});
