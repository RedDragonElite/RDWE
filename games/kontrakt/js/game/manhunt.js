/* RDE // KONTRAKT — manhunt (after rde_aipd, plus a real search): the police only know what they
 * have seen or what was phoned in. Every sighting goes out over the radio (last known position +
 * heading); lose them and a search area opens at the predicted spot and grows. Officers split up,
 * check unsearched ground, corners and hiding places; cars sweep the streets around it; from three
 * stars a helicopter sweeps with its spotlight. Stars only drop after 15 s unseen, then one every
 * 20 s. Pursuits use PIT manoeuvres, roadblocks and spike strips. You can hide in dumpsters,
 * wardrobes and lockers — searchers do check them. */
(function (K) {
  'use strict';
  const U = K.U, T = K.T, TILE = K.TILE;
  const P_ = 26, NB = K.CITY.NB, LANE = 32;
  const nodeXY = (i, j) => [(i * P_ + 2) * TILE, (j * P_ + 2) * TILE];
  const CELL = 4;   // search grid cell in tiles
  K.HUNT = {
    units: [0, 2, 3, 4, 5, 6], cap: 8,
    tackle: [0, 0.15, 0.25, 0.35, 0.45, 0.55],
    unseenGrace: 15, starEvery: 20,
    radio: ['Zentrale, Sichtkontakt verloren!', 'Verdächtiger flüchtig, Suchgebiet wird eingerichtet.', 'Alle Einheiten: Umgebung absuchen!', 'Wir haben ihn verloren. Ausschwärmen!'],
    spotted: ['Da ist er!', 'Sichtkontakt! Verdächtiger gesichtet!', 'Zielperson gesichtet, ich bleib dran!', 'Hab ihn! Hier drüben!'],
    hideOut: ['Raus da! Hände wo ich sie sehen kann!', 'Hab ich dich! Raus da!'],
  };

  K.mixin({
    // ============================================================ the radio picture
    /** the best the police know right now: live while somebody has eyes on, else the predicted spot */
    huntTarget() {
      const h = this.heat;
      if (h.seenT < 1.2) return { x: h.x, y: h.y, live: true };
      const lead = Math.min(3, h.seenT) * 0.8;
      return { x: h.x + (h.vx || 0) * lead, y: h.y + (h.vy || 0) * lead, live: false };
    },
    /** called every frame from updateCrime with whether any unit sees the player */
    updateManhunt(dt, seen) {
      const p = this.player, h = this.heat;
      if (this.wanted <= 0) { h.search = null; if (this.heli) this.heliLeave(); this.updateHeli(dt); this.updateRoadblocks(dt); return; }
      const heliSees = this.heli && this.heli.sees;
      if (seen || heliSees) {
        const src = p.inCar ? this.carOf(p) : p;
        h.x = src.x; h.y = src.y; h.vx = src.vx || 0; h.vy = src.vy || 0; h.seenT = 0;
        if (h.search && this.t - (h.lastSpotBark || 0) > 6) {
          h.lastSpotBark = this.t;
          const c = this.actors.find((a) => a.kind === 'cop' && a.alive && a.seesPlayer);
          if (c) this.bark(c, U.pick(K.HUNT.spotted), 2);
          this.emit('radio', { text: 'Verdächtiger gesichtet!' });
        }
        h.search = null;
      } else if (!h.search && h.seenT > 2.5) {
        const t = this.huntTarget();
        h.search = { x: U.clamp(t.x, TILE * 2, (this.W - 2) * TILE), y: U.clamp(t.y, TILE * 2, (this.city.W - 1) * TILE), t0: this.t, cells: new Map(), claims: new Map() };
        const b = this.bldAt(h.search.x, h.search.y);
        h.search.bld = b >= 0 ? b : -1;
        const c = this.actors.find((a) => a.kind === 'cop' && a.alive && !a.inCar && Math.hypot(a.x - p.x, a.y - p.y) < 30 * TILE);
        if (c) this.bark(c, U.pick(K.HUNT.radio), 2.4);
        this.emit('radio', { text: 'Sichtkontakt verloren — Suchgebiet eingerichtet.' });
      }
      if (h.search) h.search.r = Math.min(30, 5 + (this.t - h.search.t0) * 0.45) * TILE;
      this.updateHeli(dt);
      this.updateRoadblocks(dt);
      // radio: officers who are searching converge on a fresh sighting
      if (h.seenT < 0.5) for (const a of this.actors) {
        if (a.kind !== 'cop' || !a.alive || a.ko > 0 || a.inCar || a.state !== 'search') continue;
        if (Math.hypot(a.x - h.x, a.y - h.y) < 28 * TILE) { a.state = 'respond'; a.brain.tx = h.x; a.brain.ty = h.y; a.goal = null; a.path = null; }
      }
    },

    // ============================================================ search on foot
    searchCell(x, y) { return (((x / TILE / CELL) | 0) << 12) | ((y / TILE / CELL) | 0); },
    /** a spot worth checking: unsearched ground, corners, hiding places — spread out between officers */
    pickSearchSpot(a) {
      const S = this.heat.search, W = this.W;
      let best = null, bs = -1e9;
      for (let k = 0; k < 18; k++) {
        const ang = Math.random() * U.TAU, r = Math.sqrt(Math.random()) * S.r;
        const x = S.x + Math.cos(ang) * r, y = S.y + Math.sin(ang) * r;
        const tx = (x / TILE) | 0, ty = (y / TILE) | 0;
        if (tx < 1 || ty < 1 || tx >= W - 1 || ty >= this.city.W) continue;
        const i = ty * W + tx;
        if (!this.nav.cost[i] || this.tiles[i] === T.WATER) continue;
        if (this.bmap[i] >= 0 && this.bmap[i] !== S.bld && Math.random() < 0.7) continue;   // other buildings: rarely
        const cell = this.searchCell(x, y), seen = S.cells.get(cell);
        let sc = seen == null ? 3 : this.t - seen > 30 ? 1.5 : -2;
        let walls = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const j = i + dx + dy * W; if (K.TF[this.tiles[j]] & 1 || this.solid[j] & 1) walls++; }
        sc += walls >= 3 ? 1.5 : walls >= 1 ? 0.5 : 0;
        const pi = this.pmap[i + 1] >= 0 ? this.pmap[i + 1] : this.pmap[i - 1] >= 0 ? this.pmap[i - 1] : this.pmap[i + W] >= 0 ? this.pmap[i + W] : this.pmap[i - W];
        if (pi >= 0 && this.props[pi] && K.PROPK[this.props[pi].k] && K.PROPK[this.props[pi].k].hide) sc += 2;
        sc -= Math.hypot(x - a.x, y - a.y) / TILE / 10;
        for (const [id, c] of S.claims) if (id !== a.id && Math.hypot(c.x - x, c.y - y) < 5 * TILE) sc -= 2.5;
        if (sc > bs) { bs = sc; best = { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE }; }
      }
      if (best) S.claims.set(a.id, best);
      return best;
    },
    /** what an officer standing here can see gets ticked off the search grid */
    markSearched(a) {
      const S = this.heat.search; if (!S) return;
      const cx = (a.x / TILE / CELL) | 0, cy = (a.y / TILE / CELL) | 0;
      for (let j = cy - 2; j <= cy + 2; j++) for (let i = cx - 2; i <= cx + 2; i++) {
        const x = (i + 0.5) * CELL * TILE, y = (j + 0.5) * CELL * TILE;
        if (Math.hypot(x - a.x, y - a.y) > 9 * TILE) continue;
        if (i === cx && j === cy || K.los(this, a.x, a.y, x, y)) S.cells.set((i << 12) | j, this.t);
      }
    },
    /** ai_search for police during a manhunt */
    copSearch(a, dt) {
      const S = this.heat.search, b = a.brain;
      if (!S) { b.tx = this.heat.x; b.ty = this.heat.y; a.state = 'respond'; return; }
      if (b.waitT > 0) {
        b.waitT -= dt;
        a.faceTo = (b.look || a.angle) + Math.sin(b.waitT * 2.2) * 1.3;
        this.checkHideSpots(a);
        return;
      }
      if (!a.goal || a.arrived) {
        if (a.goal && a.arrived) { this.markSearched(a); b.waitT = 1.2 + Math.random() * 1.8; b.look = a.angle; a.goal = null; if (Math.random() < 0.15) this.bark(a, U.pick(K.LINES ? K.LINES.search || ['Sauber.'] : ['Sauber.']), 1.6); return; }
        const sp = this.pickSearchSpot(a);
        if (!sp) { b.waitT = 1; return; }
        this.goTo(a, sp.x, sp.y, { force: true, tol: 20 });
      }
      a.dv = this.steer(a, 95, dt);
      if (this.tick % 20 === a.id % 20) this.markSearched(a);
    },
    /** searchers look into dumpsters, wardrobes and lockers right next to them */
    checkHideSpots(a) {
      const p = this.player; if (!p.hidden || p.hiddenIn == null || a.brain.checked === p.hiddenIn) return;
      const sp = this.props[p.hiddenIn]; if (!sp) return;
      const cx = (sp.x + sp.w / 2) * TILE, cy = (sp.y + sp.h / 2) * TILE;
      if (Math.hypot(cx - a.x, cy - a.y) > 2 * TILE) return;
      a.brain.checked = p.hiddenIn;
      if (Math.random() < 0.55) {
        this.unhide(true);
        p.stun = 1.2;
        this.bark(a, U.pick(K.HUNT.hideOut), 2.4);
        this.heat.x = p.x; this.heat.y = p.y; this.heat.seenT = 0;
        if (this.copMayShoot()) this.alarm(a, p); else this.startArrest(a);
      }
    },

    // ============================================================ hiding (player)
    hideSpotNearPlayer() {
      if (this.drag || this.player.inCar) return null;
      return this.propNear(['dumpster', 'wardrobe', 'locker'], 1.15);
    },
    hideIn(prop) {
      const p = this.player;
      if (prop.k === 'dumpster' && prop.bodies && prop.bodies >= 2) { this.notify('Da drin ist kein Platz mehr.', 'bad'); return; }
      const seen = this.actors.some((a) => a.alive && a.ko <= 0 && a.seesPlayer && (a.kind === 'cop' || a.kind === 'guard'));
      p.hidden = true; p.hiddenIn = prop.id; p.hideFrom = { x: p.x, y: p.y };
      p.x = (prop.x + prop.w / 2) * TILE; p.y = (prop.y + prop.h / 2) * TILE; p.vx = p.vy = 0;
      this.emit('sfx', { s: prop.k === 'dumpster' ? 'dumpster' : 'cloth' });
      if (seen) { this.notify('Sie haben gesehen, wo du hin bist!', 'bad'); this.heat.x = p.x; this.heat.y = p.y; this.heat.seenT = 0; }
      else this.notify('Versteckt. [E] zum Rauskommen.', 'good');
    },
    unhide(forced) {
      const p = this.player; if (!p.hidden) return;
      p.hidden = false; p.hiddenIn = null;
      if (p.hideFrom) { p.x = p.hideFrom.x; p.y = p.hideFrom.y; }
      if (!forced) this.emit('sfx', { s: 'cloth' });
    },

    // ============================================================ helicopter
    updateHeli(dt) {
      const p = this.player, h = this.heat;
      if (!this.heli && this.wanted >= 3 && p.alive && !(this.P.jail && !this.P.jail.escaped)) {
        const side = Math.random() < 0.5 ? -1 : 1;
        this.heli = { x: p.x + side * 50 * TILE, y: p.y - 30 * TILE, a: 0, sx: p.x, sy: p.y, sweep: 0, hp: 600, sees: false, leaving: false };
        this.emit('radio', { text: 'Polizeihubschrauber „Adler 1“ ist in der Luft.' });
      }
      const H = this.heli; if (!H) return;
      if (H.dead) { H.fallT -= dt; if (H.fallT <= 0) { this.explode(H.x, H.y, 140, 200, null); this.heli = null; } return; }
      let tx, ty;
      if (H.leaving) { tx = H.x + Math.cos(H.a) * 2000; ty = H.y + Math.sin(H.a) * 2000 - 400; if (Math.hypot(H.x - p.x, H.y - p.y) > 70 * TILE) { this.heli = null; return; } }
      else if (h.seenT < 2) { const o = this.t * 0.4; tx = h.x + Math.cos(o) * 5 * TILE; ty = h.y + Math.sin(o) * 5 * TILE; }
      else if (h.search) { H.sweep += dt * 0.35; const r = h.search.r * 0.75; tx = h.search.x + Math.sin(H.sweep) * r; ty = h.search.y + Math.sin(H.sweep * 1.7 + 1) * r; }
      else { tx = h.x; ty = h.y; }
      const dx = tx - H.x, dy = ty - H.y, d = Math.hypot(dx, dy), sp = Math.min(260, d * 1.2);
      if (d > 2) { H.a = U.turnTo(H.a, Math.atan2(dy, dx), dt * 1.4); H.x += Math.cos(H.a) * sp * dt; H.y += Math.sin(H.a) * sp * dt; }
      // the spotlight trails the target a little; it finds you only outdoors
      const ls = h.seenT < 2 ? { x: h.x, y: h.y } : { x: H.x + Math.cos(H.a) * 2 * TILE, y: H.y + Math.sin(H.a) * 2 * TILE };
      H.sx += (ls.x - H.sx) * Math.min(1, dt * 1.8); H.sy += (ls.y - H.sy) * Math.min(1, dt * 1.8);
      const night = this.isNight(), R = (night ? 3.6 : 5.5) * TILE;
      const src = p.inCar ? this.carOf(p) : p;
      const inside = this.bldAt(src.x, src.y) >= 0;
      H.sees = !H.leaving && p.alive && !p.hidden && !inside && Math.hypot(src.x - H.sx, src.y - H.sy) < R;
      H.spotR = R;
    },
    heliLeave() { if (this.heli && !this.heli.dead) this.heli.leaving = true; },
    /** rifles can bring it down (bullets passing right under it) */
    heliHit(x, y, dmg, w) {
      const H = this.heli; if (!H || H.dead || H.leaving) return false;
      const d = K.WEAPONS[w]; if (!d || !['rifle', 'sniper', 'dmr', 'lmg'].includes(d.cls)) return false;
      if (Math.hypot(x - H.x, y - H.y) > 22) return false;
      H.hp -= dmg; this.emit('impact', { x, y, a: 0, mat: 'metal' });
      if (H.hp <= 0) { H.dead = true; H.fallT = 2.2; this.raiseWanted(5, 'copkill', H.x, H.y); this.emit('banner', { title: 'HUBSCHRAUBER ABGESCHOSSEN', sub: 'Jetzt kommt alles, was sie haben.', kind: 'red' }); }
      return true;
    },

    // ============================================================ pursuit tactics: roadblocks, spikes, PIT
    updateRoadblocks(dt) {
      const p = this.player;
      this.spikes = (this.spikes || []).filter((s) => (s.life -= dt) > 0);
      for (const rb of this.roadblocks || []) rb.life -= dt;
      this.roadblocks = (this.roadblocks || []).filter((rb) => {
        if (rb.life > 0 && this.wanted > 0) return true;
        for (const id of rb.cars) { const c = this.cars.find((q) => q.id === id); if (c && c.unit && c.unit.mode === 'block') { c.unit.mode = 'onscene'; for (const cid of c.unit.crew) { const a = this.byId.get(cid); if (a && a.alive && a.state === 'block') { a.state = 'return'; a.goal = null; } } } }
        return false;
      });
      // spike strips puncture what drives over them
      for (const s of this.spikes) for (const c of this.cars) {
        if (c.dead || (c.speed || 0) < 20 || !c.tires) continue;
        if (Math.abs(c.x - s.x) > 120 || Math.abs(c.y - s.y) > 120) continue;
        const fx = Math.cos(c.a), fy = Math.sin(c.a), hl = c.l / 2;
        [[hl - 13, -c.w / 2], [hl - 13, c.w / 2], [-hl + 12, -c.w / 2], [-hl + 12, c.w / 2]].forEach(([u, v], i) => {
          const wx = c.x + fx * u - fy * v, wy = c.y + fy * u + fx * v;
          const dx = wx - s.x, dy = wy - s.y, along = dx * Math.cos(s.a) + dy * Math.sin(s.a), across = -dx * Math.sin(s.a) + dy * Math.cos(s.a);
          if (Math.abs(along) < s.len / 2 && Math.abs(across) < 7 && c.tires[i] > 0) { c.tires[i] = 0; this.emit('tireBurst', { x: wx, y: wy }); if (c.driver === 'player') this.notify('Nagelband! Reifen platt.', 'bad'); }
        });
      }
      // set up a block ahead of a fleeing car
      this.rbT = (this.rbT || 0) - dt;
      const car = p.inCar ? this.carOf(p) : null;
      if (this.wanted >= 3 && car && (car.speed || 0) * K.KMH > 45 && this.rbT <= 0 && (this.roadblocks || []).length < 1) {
        this.rbT = 25;
        this.spawnRoadblock(car);
      }
    },
    spawnRoadblock(car) {
      const p = this.player, v = Math.hypot(car.vx, car.vy) || 1, dir = Math.atan2(car.vy, car.vx);
      for (let k = 0; k < 8; k++) {
        const dist = (30 + k * 5) * TILE, px = car.x + Math.cos(dir) * dist, py = car.y + Math.sin(dir) * dist;
        // nearest road tile to the point ahead (roads bend, the car's heading is only a hint)
        let tx = -1, ty = -1, bd = 1e9;
        for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const qx = ((px / TILE) | 0) + i, qy = ((py / TILE) | 0) + j; if (qx < 2 || qy < 2 || qx >= this.W - 2 || qy >= this.city.W - 1 || this.tiles[qy * this.W + qx] !== T.ROAD) continue; const d = i * i + j * j; if (d < bd) { bd = d; tx = qx; ty = qy; } }
        if (tx < 0) continue;
        const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
        if (K.los(this, p.x, p.y, x, y) && Math.hypot(x - p.x, y - p.y) < 26 * TILE) continue;
        const across = dir + Math.PI / 2, rb = { x, y, cars: [], life: 50 };
        for (const off of [-1, 1]) {
          const cx = x + Math.cos(across) * off * 40, cy = y + Math.sin(across) * off * 40;
          if (this.carBlocked && this.carBlocked({ l: 60, w: 30, a: across }, cx, cy, across)) continue;
          const c = this.spawnCar('police', cx, cy, across);
          c.siren = true; c.vx = c.vy = 0;
          c.unit = { mode: 'block', dest: { x, y }, prio: 2, foe: 0, t0: this.t, crew: [] };
          for (let n = 0; n < 2; n++) {
            const cop = this.spawnCop(cx - Math.cos(dir) * 46 + Math.cos(across) * (n - 0.5) * 30, cy - Math.sin(dir) * 46 + Math.sin(across) * (n - 0.5) * 30, 'block');
            cop.unit = c.id; c.unit.crew.push(cop.id); cop.brain.face = dir + Math.PI;
          }
          rb.cars.push(c.id);
        }
        if (!rb.cars.length) continue;
        if (this.wanted >= 4) (this.spikes || (this.spikes = [])).push({ x: x - Math.cos(dir) * 3 * TILE, y: y - Math.sin(dir) * 3 * TILE, a: across, len: 5 * TILE, life: 50 });
        (this.roadblocks || (this.roadblocks = [])).push(rb);
        this.emit('radio', { text: this.wanted >= 4 ? 'Straßensperre mit Nagelband errichtet.' : 'Straßensperre errichtet.' });
        void v;
        return rb;
      }
      return null;
    },
    /** officers manning a roadblock: hold, weapons on the road */
    ai_block(a, dt) {
      const p = this.player;
      a.dv = [0, 0];
      a.faceTo = a.brain.face != null ? a.brain.face : a.angle;
      if (a.seesPlayer && this.wanted > 0) { if (this.copMayShoot()) this.alarm(a, p); else if (!p.inCar) this.startArrest(a); else a.faceTo = Math.atan2(p.y - a.y, p.x - a.x); }
    },
    /** PIT: a pursuing car aims for the rear quarter and kicks the tail out */
    pitSteer(c, dt) {
      const p = this.player, pc = p.inCar ? this.carOf(p) : null;
      c.pitCD = Math.max(0, (c.pitCD || 0) - dt);
      if (!pc || !c.seesPlayer || this.wanted < 2) return null;
      const d = Math.hypot(pc.x - c.x, pc.y - c.y);
      if (c.pitT > 0) {
        c.pitT -= dt;
        if (d < (c.l + pc.l) * 0.45 && !c.pitDone) {
          c.pitDone = true;
          const side = Math.sign((c.x - pc.x) * -Math.sin(pc.a) + (c.y - pc.y) * Math.cos(pc.a)) || 1;
          pc.yawKick = -side * 3.2; pc.yawT = 0.55;
          this.emit('crash', { x: (c.x + pc.x) / 2, y: (c.y + pc.y) / 2, v: 180, player: true });
          if (pc.driver === 'player') this.notify('PIT-Manöver!', 'bad');
        }
        const fx = Math.cos(pc.a), fy = Math.sin(pc.a), side = c.pitSide;
        return [pc.x - fx * pc.l * 0.35 - fy * side * pc.w * 0.6, pc.y - fy * pc.l * 0.35 + fx * side * pc.w * 0.6];
      }
      if (c.pitCD <= 0 && d < 5 * TILE && (pc.speed || 0) * K.KMH > 30) {
        const rel = U.angDiff(pc.a, Math.atan2(c.y - pc.y, c.x - pc.x));
        if (Math.abs(rel) > 1.6) { c.pitT = 2; c.pitDone = false; c.pitCD = 8; c.pitSide = Math.sign(rel) || 1; }
      }
      return null;
    },
    /** called from vehicles: a car that got PIT'd spins */
    applyYawKick(c, dt) {
      if (!(c.yawT > 0)) return;
      c.yawT -= dt; c.a += c.yawKick * dt; c.yawKick *= Math.max(0, 1 - dt * 2);
    },
  });
})(globalThis.K = globalThis.K || {});
