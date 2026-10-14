/* RDE // KONTRAKT — runtime world: entities, physics, doors, time, weather, light, noise.
 * DOM-free: runs in the browser and in Node (tools/sim.mjs). Feature mixins live in sibling files. */
(function (K) {
  'use strict';
  const T = K.T, TF = K.TF, TILE = K.TILE, U = K.U;

  let NEXT_ID = 1;

  class World {
    constructor(opt = {}) {
      this.seed = opt.seed || 1337;
      const c = this.city = K.generateCity(this.seed);
      Object.assign(this, { W: c.W, H: c.H, N: c.N, tiles: c.tiles, solid: c.solid, bmap: c.bmap, zmap: c.zmap, pmap: c.pmap, doors: c.doors, buildings: c.buildings, props: c.props, lights: c.lights, zones: c.zones });
      this.opaque = new Uint8Array(this.N);
      for (let i = 0; i < this.N; i++) this.opaque[i] = (TF[this.tiles[i]] & 2 || this.solid[i] & 4 || this.tiles[i] === T.DOOR) ? 1 : 0;
      this.nav = new K.Nav(this);
      // lamp grid for light queries (cells of 8 tiles)
      this.lgrid = new Map();
      for (const l of this.lights) {
        if (l.kind === 'room') continue;
        const k = ((l.x / 256) | 0) + ',' + ((l.y / 256) | 0);
        if (!this.lgrid.has(k)) this.lgrid.set(k, []);
        this.lgrid.get(k).push(l);
      }
      this.time = opt.time != null ? opt.time : 7 * 60 + 40; // minutes since day 1 00:00
      this.weather = { kind: 'clear', rain: 0, fog: 0, cloud: 0.2, wind: 0.3, next: this.time + 180, flash: 0 };
      this.actors = []; this.cars = []; this.projectiles = []; this.throwables = []; this.items = []; this.events = [];
      this.byId = new Map();
      this.grid = new Map();
      this.tick = 0; this.t = 0;
      this.slowmo = 0;
      this.crimes = [];
      this.initEconomy(opt.save);
      this.initCrime();
      this.initContracts(opt.save);
      this.populate();
      if (opt.save) this.applySave(opt.save);
    }

    // ------------------------------------------------------------ helpers
    emit(type, d = {}) { d.type = type; this.events.push(d); if (this.events.length > 600) this.events.splice(0, 200); }
    nid() { return NEXT_ID++; }
    tileIdx(x, y) { return ((y / TILE) | 0) * this.W + ((x / TILE) | 0); }
    tileAt(x, y) { const tx = (x / TILE) | 0, ty = (y / TILE) | 0; if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return T.WATER; return this.tiles[ty * this.W + tx]; }
    bldAt(x, y) { const tx = (x / TILE) | 0, ty = (y / TILE) | 0; if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return -1; return this.bmap[ty * this.W + tx]; }
    zoneAt(x, y) { const tx = (x / TILE) | 0, ty = (y / TILE) | 0; if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return -1; return this.zmap[ty * this.W + tx]; }
    districtAt(x, y) { return this.city.districtAt((x / TILE) | 0, (y / TILE) | 0); }
    hour() { return U.hourOf(this.time); }
    /** 0 = deep night … 1 = full day */
    daylight() {
      const h = this.hour();
      let d;
      if (h < 5) d = 0; else if (h < 7.5) d = (h - 5) / 2.5; else if (h < 18.5) d = 1; else if (h < 21.5) d = 1 - (h - 18.5) / 3; else d = 0;
      return U.smooth(U.clamp(d, 0, 1)) * (1 - this.weather.cloud * 0.25);
    }
    isNight() { return this.daylight() < 0.35; }
    /** how lit a point is (0..1) → stealth */
    lightAt(x, y) {
      let l = this.daylight();
      if (l > 0.85) return l;
      const cx = (x / 256) | 0, cy = (y / 256) | 0;
      for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) {
        const arr = this.lgrid.get(i + ',' + j); if (!arr) continue;
        for (const L of arr) { const d = Math.hypot(L.x - x, L.y - y); if (d < L.r) l += (1 - d / L.r) * 0.9 * L.i; }
      }
      const b = this.bldAt(x, y);
      if (b >= 0 && this.buildingLit(this.buildings[b])) l += 0.6;
      for (const c of this.cars) if (c.lightsOn && c.driver) { const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy); if (d < 260 && Math.abs(U.angDiff(c.a, Math.atan2(dy, dx))) < 0.45) l += 0.7 * (1 - d / 260); }
      return Math.min(1, l);
    }
    buildingLit(b) {
      const h = this.hour();
      if (b.owned) return true;
      if (b.shop) { const s = K.SHOPS[b.shop]; return this.shopOpen(s); }
      if (b.type === 'office') return h > 6 && h < 22;
      if (b.type === 'villa' || b.type === 'club' || b.type === 'hotel' || b.type === 'police' || b.type === 'hospital') return true;
      return b.lit && (h > 17 || h < 1 || (h > 5.5 && h < 8));
    }
    shopOpen(s) { const h = this.hour(); const [a, b] = s.open; return a < b ? h >= a && h < b : h >= a || h < b; }

    // ------------------------------------------------------------ actors
    spawnActor(kind, x, y, o = {}) {
      const a = {
        id: this.nid(), kind, x, y, vx: 0, vy: 0, r: 10, angle: o.angle || U.rnd(U.TAU), aim: 0,
        hp: o.hp || 100, maxHp: o.hp || 100, armor: o.armor || 0, alive: true, ko: 0, stun: 0, bleed: 0,
        outfit: o.outfit || U.pick(K.CIV_OUTFITS), skin: o.skin || U.pick(K.SKINS), hair: o.hair !== undefined ? o.hair : U.pick(K.HAIR), female: o.female != null ? o.female : U.chance(0.45),
        name: o.name || U.pick(K.NAMES.first) + ' ' + U.pick(K.NAMES.last),
        weapon: o.weapon || 'fists', mag: 0, reserve: 0, sup: !!o.sup, reloadT: 0, cool: 0, attackT: 9, punchSide: 0, combo: 0,
        walk: Math.random() * 10, moving: 0, crouch: false, sprint: false, speedMul: o.speedMul || 1,
        state: o.state || 'idle', brain: { t: Math.random() * 0.3, ...o.brain }, path: null, pathI: 0,
        susp: 0, alert: 0, seesPlayer: false, home: o.home != null ? o.home : -1, zone: o.zone != null ? o.zone : -1,
        dead: false, deadT: 0, deathA: 0, pool: 0, hidden: false, dragBy: 0, carry: null, bark: null, wallet: o.wallet != null ? o.wallet : U.rint(160) + 10,
        disguised: false, stripped: false, poisoned: 0, inCar: null, enforcer: !!o.enforcer, lastHitBy: 0, flinch: 0,
      };
      if (K.WEAPONS[a.weapon] && K.WEAPONS[a.weapon].type === 'gun') { a.mag = K.WEAPONS[a.weapon].mag; a.reserve = o.reserve != null ? o.reserve : 60; }
      a.wi = { id: a.weapon, mag: a.mag, sup: a.sup };
      this.actors.push(a); this.byId.set(a.id, a);
      return a;
    }
    removeActor(a) { a.removed = true; this.byId.delete(a.id); }
    role(a) {
      if (a.kind === 'player') return K.OUTFITS[this.P.outfit].role;
      return { cop: 'police', guard: 'guard', bodyguard: 'guard', staff: 'staff', gang: 'gang', keeper: 'staff' }[a.kind] || 'civ';
    }
    hasAccess(a, d) {
      if (!d.locked || !a) return true;
      if (!d.access) return false;
      if (a.kind === 'player') {
        if (d.access.includes('owner')) { const b = this.buildings[d.bld]; return !!(b && b.owned); }
        return d.access.includes(this.role(a));
      }
      if (a.kind === 'target' || a.kind === 'bodyguard') return true;
      return d.access.includes(this.role(a)) || (a.home === d.bld);
    }
    blockedTile(i, a) {
      const t = this.tiles[i];
      if (TF[t] & 1 || this.solid[i] & 1) return true;
      if (t === T.DOOR) { const d = this.doors.get(i); if (d && d.locked && !this.hasAccess(a, d)) return true; }
      return false;
    }
    collide(a) {
      const r = a.r;
      for (let it = 0; it < 2; it++) {
        const x0 = Math.floor((a.x - r) / TILE), x1 = Math.floor((a.x + r) / TILE), y0 = Math.floor((a.y - r) / TILE), y1 = Math.floor((a.y + r) / TILE);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
          if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) { a.x = U.clamp(a.x, r, this.W * TILE - r); a.y = U.clamp(a.y, r, this.H * TILE - r); continue; }
          if (!this.blockedTile(ty * this.W + tx, a)) continue;
          const bx0 = tx * TILE, by0 = ty * TILE;
          const cx = U.clamp(a.x, bx0, bx0 + TILE), cy = U.clamp(a.y, by0, by0 + TILE);
          let dx = a.x - cx, dy = a.y - cy, d = Math.hypot(dx, dy);
          if (d >= r) continue;
          if (d < 0.001) { // centre inside the tile: push out along the shallowest axis
            const l = a.x - bx0, rr = bx0 + TILE - a.x, u = a.y - by0, b = by0 + TILE - a.y, m = Math.min(l, rr, u, b);
            if (m === l) a.x = bx0 - r; else if (m === rr) a.x = bx0 + TILE + r; else if (m === u) a.y = by0 - r; else a.y = by0 + TILE + r;
            continue;
          }
          const push = r - d; a.x += (dx / d) * push; a.y += (dy / d) * push;
          if (Math.abs(dx) > Math.abs(dy)) a.vx *= 0.3; else a.vy *= 0.3;
          a.bumped = true;
        }
      }
    }
    /** integrate actor velocity toward desired (dvx, dvy) */
    moveActor(a, dvx, dvy, dt, acc = 12) {
      const k = Math.min(1, acc * dt);
      a.vx += (dvx - a.vx) * k; a.vy += (dvy - a.vy) * k;
      a.bumped = false;
      a.x += a.vx * dt; a.y += a.vy * dt;
      this.collide(a);
      const sp = Math.hypot(a.vx, a.vy);
      a.speed = sp;
      a.moving = Math.min(1, sp / 80);
      a.walk += sp * dt * 0.09;
      // footsteps
      const stepEvery = Math.PI;
      if (sp > 25 && Math.floor(a.walk / stepEvery) !== Math.floor((a.walk - sp * dt * 0.09) / stepEvery)) {
        const t = this.tileAt(a.x, a.y);
        this.emit('step', { x: a.x, y: a.y, id: a.id, surf: t, run: sp > 130, crouch: a.crouch, player: a.kind === 'player' });
        if (sp > 130 && a.kind === 'player') this.noise(a.x, a.y, a.crouch ? 1 : 3.2, 'steps', a);
        if (a.bloodFeet > 0) { a.bloodFeet--; this.emit('footprint', { x: a.x, y: a.y, a: Math.atan2(a.vy, a.vx), side: (Math.floor(a.walk / stepEvery) & 1) }); }
      }
    }
    separate() {
      const L = this.actors;
      for (let i = 0; i < L.length; i++) {
        const a = L[i]; if (!a.alive || a.ko > 0 || a.inCar || a.removed) continue;
        const near = this.near(a.x, a.y, 24);
        for (const b of near) {
          if (b.id <= a.id || !b.alive || b.ko > 0 || b.inCar || b.dragBy || a.dragBy) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r - 2;
          if (d >= m || d < 0.01) continue;
          const p = (m - d) / 2, nx = dx / d, ny = dy / d;
          const wa = a.kind === 'player' ? 0.25 : 1, wb = b.kind === 'player' ? 0.25 : 1;
          a.x -= nx * p * wa; a.y -= ny * p * wa; b.x += nx * p * wb; b.y += ny * p * wb;
        }
      }
    }
    rebuildGrid() {
      const g = this.grid; g.clear();
      for (const a of this.actors) {
        if (a.removed) continue;
        const k = ((a.x / 128) | 0) * 4096 + ((a.y / 128) | 0);
        let arr = g.get(k); if (!arr) g.set(k, (arr = [])); arr.push(a);
      }
    }
    near(x, y, r) {
      const out = [];
      const x0 = ((x - r) / 128) | 0, x1 = ((x + r) / 128) | 0, y0 = ((y - r) / 128) | 0, y1 = ((y + r) / 128) | 0;
      for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
        const arr = this.grid.get(i * 4096 + j); if (!arr) continue;
        for (const a of arr) if (!a.removed && (a.x - x) ** 2 + (a.y - y) ** 2 <= r * r) out.push(a);
      }
      return out;
    }

    // ------------------------------------------------------------ doors
    updateDoors(dt) {
      for (const a of this.actors) {
        if (!a.alive || a.ko > 0 || a.removed || a.inCar) continue;
        const tx = (a.x / TILE) | 0, ty = (a.y / TILE) | 0;
        for (let j = ty - 1; j <= ty + 1; j++) for (let i = tx - 1; i <= tx + 1; i++) {
          if (i < 0 || j < 0 || i >= this.W || j >= this.H) continue;
          const d = this.doors.get(j * this.W + i);
          if (!d) continue;
          if (Math.hypot((i + 0.5) * TILE - a.x, (j + 0.5) * TILE - a.y) > TILE * 1.25) continue;
          if (!d.locked || this.hasAccess(a, d)) { d.want = 1; if (d.open < 0.05) this.emit('door', { x: (i + 0.5) * TILE, y: (j + 0.5) * TILE }); }
        }
      }
      for (const d of this.doors.values()) {
        const tgt = d.want ? 1 : 0; d.want = 0;
        if (d.open === tgt) continue;
        d.open = U.clamp(d.open + (tgt ? 6 : -2.5) * dt, 0, 1);
        const op = d.open < 0.5 ? 1 : 0;
        if (this.opaque[d.i] !== op) this.opaque[d.i] = op;
      }
    }

    // ------------------------------------------------------------ perception
    /** can `a` (NPC) see point (x,y)? range px, cone half-angle rad */
    sees(a, x, y, range, half) {
      const dx = x - a.x, dy = y - a.y, d2 = dx * dx + dy * dy;
      if (d2 > range * range) return false;
      if (d2 > 34 * 34 && Math.abs(U.angDiff(a.angle, Math.atan2(dy, dx))) > half) return false;
      return K.los(this, a.x, a.y, x, y);
    }
    viewRange(a) {
      let r = (this.isNight() ? 8.5 : 13) * TILE;
      r *= 1 - this.weather.fog * 0.45 - this.weather.rain * 0.15;
      if (a.kind === 'guard' || a.kind === 'cop' || a.kind === 'bodyguard') r *= 1.15;
      return r;
    }
    noise(x, y, rTiles, kind, src) {
      if (rTiles <= 0) return;
      const R = rTiles * TILE * (1 - this.weather.rain * 0.25);
      for (const a of this.near(x, y, R)) {
        if (a === src || !a.alive || a.ko > 0 || a.kind === 'player') continue;
        const d = Math.hypot(a.x - x, a.y - y);
        if (d > R * 0.55 && !K.los(this, a.x, a.y, x, y)) continue;
        this.hear(a, kind, x, y, src);
      }
      if (kind === 'shot' || kind === 'explosion') this.emit('noiseRing', { x, y, r: R });
    }

    // ------------------------------------------------------------ main update
    update(dt, input) {
      const scale = this.slowmo > 0 ? 0.3 : 1;
      if (this.slowmo > 0) this.slowmo -= dt;
      dt *= scale;
      this.t += dt; this.tick++;
      const minutes = dt * (this.timeScale || 1);
      this.time += minutes;
      this.updateWeather(minutes);
      this.rebuildGrid();
      this.updatePlayer(dt, input || {});
      this.updateAI(dt);
      this.updateCars(dt);
      this.separate();
      this.updateDoors(dt);
      this.updateProjectiles(dt);
      this.updateThrowables(dt);
      this.updateBodies(dt);
      this.updateCrime(dt);
      this.updateContracts(dt);
      this.updateSurvival(dt, minutes);
      this.updateUnderworld(dt, minutes);
      this.updatePopulation(dt);
      if (this.tick % 120 === 0) this.cleanup();
    }
    updateWeather(min) {
      const w = this.weather;
      if (this.time > w.next) {
        const r = Math.random();
        w.kind = r < 0.38 ? 'clear' : r < 0.6 ? 'cloudy' : r < 0.78 ? 'rain' : r < 0.88 ? 'storm' : 'fog';
        w.next = this.time + 120 + Math.random() * 300;
        this.emit('weather', { kind: w.kind });
      }
      const tgt = { clear: [0, 0, 0.1], cloudy: [0, 0.05, 0.55], rain: [0.65, 0.1, 0.8], storm: [1, 0.15, 1], fog: [0, 0.85, 0.6] }[w.kind];
      const k = Math.min(1, min * 0.02);
      w.rain += (tgt[0] - w.rain) * k; w.fog += (tgt[1] - w.fog) * k; w.cloud += (tgt[2] - w.cloud) * k;
      w.wind = 0.3 + w.rain * 0.7;
      w.flash = Math.max(0, w.flash - min * 0.08);
      if (w.kind === 'storm' && Math.random() < min * 0.006) { w.flash = 1; this.emit('thunder', { delay: 0.3 + Math.random() * 2 }); }
    }
    updateBodies(dt) {
      for (const a of this.actors) {
        if (a.removed || a.hidden) continue;
        if (!a.alive) {
          a.deadT += dt;
          if (!a.dragBy && (a.vx || a.vy)) {
            a.x += a.vx * dt; a.y += a.vy * dt; a.vx *= Math.max(0, 1 - 7 * dt); a.vy *= Math.max(0, 1 - 7 * dt);
            if (Math.abs(a.vx) + Math.abs(a.vy) < 2) { a.vx = 0; a.vy = 0; }
            this.collide(a);
          }
          if (a.bloody && a.pool < 1 && !a.dragBy) a.pool = Math.min(1, a.pool + dt * 0.12);
          continue;
        }
        if (a.ko > 0 && !a.dragBy) {
          a.ko -= dt;
          if (a.ko <= 0) { a.ko = 0; a.state = 'wake'; a.brain.t = 0; this.bark(a, U.pick(['Was… wo bin ich?', 'Mein Kopf…', 'Jemand hat mich angegriffen!'])); }
        }
        if (a.poisoned > 0) {
          a.poisoned -= dt;
          a.stun = Math.max(a.stun, 0.2);
          if (a.poisoned <= 0) this.kill(a, this.byId.get(a.poisonBy) || null, { kind: 'poison', silent: true, accident: true });
        }
        if (a.bleed > 0 && a.kind !== 'player') {
          a.hp -= a.bleed * dt * 3;
          if (Math.random() < dt * 4) this.emit('drip', { x: a.x, y: a.y });
          if (a.hp <= 0) this.kill(a, this.byId.get(a.lastHitBy) || null, { kind: 'bleed' });
        }
        if (a.stun > 0) a.stun -= dt;
        if (a.flinch > 0) a.flinch -= dt;
      }
    }
    cleanup() {
      // forget far corpses, cap totals, compact arrays
      const p = this.player;
      let corpses = 0;
      for (let i = this.actors.length - 1; i >= 0; i--) {
        const a = this.actors[i];
        if (a.removed) { this.actors.splice(i, 1); continue; }
        if (!a.alive) {
          corpses++;
          const far = Math.hypot(a.x - p.x, a.y - p.y) > 70 * TILE;
          if ((far && a.deadT > 120) || corpses > 40) { if (!a.target && a.kind !== 'player') { this.removeActor(a); this.actors.splice(i, 1); } }
        }
      }
      this.items = this.items.filter((it) => !it.taken && this.t - it.t < 900);
    }
    bark(a, text, dur = 2.6) { a.bark = { text, t: dur }; this.emit('bark', { id: a.id, x: a.x, y: a.y, text, kind: a.kind, female: a.female }); }
    notify(text, kind = 'info') { this.emit('notify', { text, kind }); }
  }

  K.World = World;
  K.mixin = (obj) => Object.assign(World.prototype, obj);
})(globalThis.K = globalThis.K || {});
