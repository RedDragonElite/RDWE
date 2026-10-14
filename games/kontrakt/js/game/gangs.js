/* RDE // KONTRAKT — gangs, turf & gang war. Inspired by RDE Crew: every city block is turf.
 * Three street gangs hold the city; found your own crew, draw your tag freehand, spray it on a block's
 * tag spot to claim it (last spray wins). Enemy turf can only be sprayed over while you are at war —
 * and a gang at war hunts you on sight and raids your blocks. Turf pays daily and boosts dealing. */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE, PITCH = 26;

  const G = K.GANGS = {
    kraehen: { name: 'Schwarze Krähen', short: 'KRÄHEN', col: '#e0283c', outfits: ['gang', 'leather'], home: ['docks', 'ind'], weapons: ['p9', 'knife', 'bat', 'mpk'] },
    vipern: { name: 'Vipern', short: 'VIPERN', col: '#3ddc84', outfits: ['hoodie', 'civ5'], home: ['old'], weapons: ['knife', 'bat', 'p9'] },
    falken: { name: 'Goldfalken', short: 'FALKEN', col: '#f2c14e', outfits: ['leather', 'casual'], home: ['res'], weapons: ['p9', 'bat', 'pump'] },
  };
  K.GANG_FOUND_FEE = 5000;
  K.TURF_INCOME = 150;

  K.mixin({
    // ============================================================ turf map
    /** one tag spot per block: a 3-tile pavement strip in front of a building's outside wall */
    initTurf() {
      const W = this.W, T = K.T;
      this.turfSpots = {};
      for (const bl of this.city.blocks) {
        if (bl.d === 'park' || !bl.b || !bl.b.length) continue;
        let best = null;
        for (const b of bl.b) {
          for (const [y, oy] of [[b.y + b.h - 1, 1], [b.y, -1]]) for (let x = b.x + 1; x < b.x + b.w - 1; x++) {
            const gy = y + oy;
            let ok = true;
            for (let dx = -1; dx <= 1 && ok; dx++) {
              const i = gy * W + x + dx, t = this.tiles[i];
              if (![T.WALL, T.WINDOW].includes(this.tiles[y * W + x + dx]) || ![T.WALK, T.PLAZA, T.CONC, T.GRASS, T.DIRT].includes(t) || (this.solid[i] & 1) || this.doors.get(i)) ok = false;
            }
            if (!ok) continue;
            const sc = Math.abs(x - (b.x + b.w / 2)) + (oy > 0 ? 0 : 3);
            if (!best || sc < best.sc) best = { x, y: gy, wy: y, oy, sc };
          }
        }
        if (best) this.turfSpots[bl.bi + ',' + bl.bj] = { key: bl.bi + ',' + bl.bj, bi: bl.bi, bj: bl.bj, d: bl.d, x: best.x, y: best.y, oy: best.oy };
      }
      const P = this.P;
      if (!P.turf) {
        P.turf = {};
        for (const k in this.turfSpots) {
          const s = this.turfSpots[k];
          const g = Object.keys(G).find((id) => G[id].home.includes(s.d));
          P.turf[k] = g && Math.random() < 0.85 ? g : null;
        }
      }
      P.wars = P.wars || {};
    },
    turfKeyAt(x, y) { return Math.floor(x / TILE / PITCH) + ',' + Math.floor(y / TILE / PITCH); },
    turfOwner(k) { return this.P.turf ? this.P.turf[k] || null : null; },
    ownTurfAt(x, y) { return this.turfOwner(this.turfKeyAt(x, y)) === 'player'; },
    turfColor(o) { return o === 'player' ? (this.P.gang && this.P.gang.col) || '#a855f7' : o && G[o] ? G[o].col : null; },
    turfName(o) { return o === 'player' ? (this.P.gang && this.P.gang.name) || 'Deine Crew' : o && G[o] ? G[o].name : 'Niemand'; },
    playerBlocks() { return Object.values(this.P.turf || {}).filter((o) => o === 'player').length; },
    gangBlocks(g) { return Object.values(this.P.turf || {}).filter((o) => o === g).length; },
    gangHostile(t) { return !!(t.gang && this.P.wars && this.P.wars[t.gang]); },

    // ============================================================ the player's crew-gang
    foundGang(name, col, tag) {
      const P = this.P;
      if (P.gang) { P.gang.name = name || P.gang.name; P.gang.col = col || P.gang.col; if (tag) P.gang.tag = tag; this.emit('turf', {}); return true; }
      if (!this.pay(K.GANG_FOUND_FEE)) { this.notify('Eine Gang zu gründen kostet ' + U.money(K.GANG_FOUND_FEE) + '.', 'bad'); return false; }
      P.gang = { name: (name || 'Rote Drachen').slice(0, 24), col: col || '#c8102e', tag: tag || null, since: this.today() };
      this.addItem('spray', 3);
      this.emit('banner', { title: P.gang.name.toUpperCase(), sub: 'Deine Gang ist gegründet. Sprüh dein Tag auf einen Tag-Spot, um ein Revier zu claimen.', kind: 'gold' });
      this.emit('turf', {});
      return true;
    },
    declareWar(g) {
      const P = this.P;
      if (!P.gang || !G[g] || P.wars[g]) return false;
      P.wars[g] = { since: this.time };
      G[g].raidT = 120 + Math.random() * 120;
      this.emit('banner', { title: 'KRIEG', sub: `${G[g].name} jagen dich ab jetzt — und ihre Reviere sind zum Übersprühen frei.`, kind: 'red' });
      this.emit('sfx', { s: 'stinger' });
      for (const a of this.actors) if (a.gang === g && a.alive && a.seesPlayer) this.alarm(a, this.player);
      return true;
    },
    peacePrice(g) { return 2000 + this.gangBlocks(g) * 1500; },
    makePeace(g) {
      const P = this.P; if (!P.wars[g]) return false;
      if (!this.pay(this.peacePrice(g))) { this.notify('Nicht genug Geld für den Frieden.', 'bad'); return false; }
      delete P.wars[g];
      for (const a of this.actors) if (a.gang === g && a.alive && a.state === 'hostile') this.calmDown(a);
      this.notify(`Frieden mit ${G[g].name}. Teuer, aber ruhig.`, 'good');
      return true;
    },

    // ============================================================ spraying
    tagSpotNear() {
      const a = this.player; if (!this.turfSpots) return null;
      const s = this.turfSpots[this.turfKeyAt(a.x, a.y)];
      if (!s) return null;
      return Math.abs((s.x + 0.5) * TILE - a.x) < 2.2 * TILE && Math.abs((s.y + 0.5) * TILE - a.y) < 1.5 * TILE ? s : null;
    },
    gangContext(add) {
      const P = this.P, a = this.player;
      if (a.inCar || this.drag) return false;
      const s = this.tagSpotNear(); if (!s) return false;
      const o = this.turfOwner(s.key);
      if (!P.gang) { add('E', `Tag-Spot · Revier: ${this.turfName(o)} — gründe erst eine Gang (Vermittler „Kralle“)`, null); return true; }
      if (o === 'player') { add('E', `Dein Revier · +${U.money(K.TURF_INCOME)}/Tag`, null); return true; }
      if (o && !P.wars[o]) { add('E', `Revier der ${G[o].name} — nur im Krieg übersprühbar`, null); return true; }
      if (!P.inv.spray) { add('E', 'Tag-Spot — Sprühdose nötig (Späti, Schwarzmarkt)', null); return true; }
      add('E', o ? `${G[o].name}-Tag übersprühen` : 'Revier markieren (sprühen)', () => this.sprayTurf(s), 4.5, { tick: (dt) => { if (Math.random() < dt * 3) this.emit('sfx', { s: 'spray' }); if (Math.random() < dt * 8) this.emit('spraymist', { x: (s.x + 0.5) * TILE, y: (s.y + 0.5) * TILE, col: P.gang.col }); } });
      return true;
    },
    sprayTurf(s, by) {
      const P = this.P, prev = this.turfOwner(s.key);
      if (by) { P.turf[s.key] = by; }
      else {
        this.takeItem('spray');
        P.turf[s.key] = 'player';
        this.addXP(20, 'Revier markiert');
        this.crimeEvent(this.player, 'graffiti', this.player.x, this.player.y, null);
      }
      this.emit('turf', { key: s.key });
      const who = by ? G[by].name : P.gang.name;
      if (!by) this.emit('banner', { title: 'REVIER ÜBERNOMMEN', sub: `${K.DISTRICTS[s.d] || ''} · Block ${s.key} gehört jetzt ${who}${prev ? ` (vorher ${this.turfName(prev)})` : ''}`, kind: 'gold' });
      else this.notify(`${who} haben dein Revier ${K.DISTRICTS[s.d] || ''} (${s.key}) übersprüht!`, 'bad');
      if (prev && G[prev] && !by && this.gangBlocks(prev) === 0) {
        delete P.wars[prev];
        this.emit('banner', { title: `${G[prev].short} ZERSCHLAGEN`, sub: 'Kein einziges Revier mehr. Der Krieg ist vorbei.', kind: 'gold' });
      }
    },

    // ============================================================ gang members on the street
    spawnGangster(g, x, y, state) {
      const D = G[g];
      const a = this.spawnActor('gang', x, y, { outfit: U.pick(D.outfits), weapon: U.pick(D.weapons), hp: 110, reserve: -1, state: state || 'hang', female: Math.random() < 0.15 });
      a.gang = g; a.acc = 2.9; a.brain.post = { x, y }; a.streetGang = true;
      return a;
    },
    /** a walk tile inside block k, out of the player's sight */
    blockWalkTile(k, minD) {
      const [bi, bj] = k.split(',').map(Number), p = this.player;
      for (let n = 0; n < 160; n++) {
        const i = U.pick(this.city.walk), x = (i % this.W + 0.5) * TILE, y = (((i / this.W) | 0) + 0.5) * TILE;
        if (Math.floor(x / TILE / PITCH) !== bi || Math.floor(y / TILE / PITCH) !== bj) continue;
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < (minD || 14) * TILE || (d < 24 * TILE && K.los(this, p.x, p.y, x, y))) continue;
        return [x, y];
      }
      return null;
    },
    scan_gang(a, range) {
      if (!a.gang || a.state === 'hostile' || a.ko > 0 || !this.P.wars[a.gang]) return;
      const p = this.player, close = p.alive && !p.hidden && !p.inCar && Math.hypot(p.x - a.x, p.y - a.y) < 5 * TILE && K.los(this, a.x, a.y, p.x, p.y);
      if (a.seesPlayer || close) { this.bark(a, U.pick(['Da ist er! Macht ihn kalt!', `Für die ${G[a.gang].name}!`, 'Du bist tot, Mann!']), 2); this.alarm(a, this.player); return; }
      for (const c of this.crewActors()) if (Math.hypot(c.x - a.x, c.y - a.y) < range && this.sees(a, c.x, c.y, range, 1.3)) { this.alarm(a, c); return; }
    },
    updateGangs(dt) {
      if (!this.turfSpots) this.initTurf();
      const P = this.P, p = this.player;
      // street presence: a few members hang around their own turf near you
      this.gangT = (this.gangT || 3) - dt;
      if (this.gangT <= 0) {
        this.gangT = 6;
        const live = this.actors.filter((a) => a.streetGang && a.alive && !a.removed);
        for (const a of live) if (Math.hypot(a.x - p.x, a.y - p.y) > 60 * TILE && a.state !== 'raid') this.removeActor(a);
        const k = this.turfKeyAt(p.x, p.y), [bi, bj] = k.split(',').map(Number);
        const near = [];
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const kk = (bi + di) + ',' + (bj + dj), o = this.turfOwner(kk); if (o && G[o]) near.push([kk, o]); }
        if (near.length && !P.jail && live.filter((a) => Math.hypot(a.x - p.x, a.y - p.y) < 40 * TILE).length < (this.isNight() ? 5 : 3)) {
          const [kk, o] = U.pick(near), pos = this.blockWalkTile(kk);
          if (pos) { const n = 2 + (Math.random() < 0.4 ? 1 : 0); for (let i = 0; i < n; i++) this.spawnGangster(o, pos[0] + U.rnd(-30, 30), pos[1] + U.rnd(-30, 30)); }
        }
      }
      // raids against your turf while at war
      for (const g in P.wars) {
        const D = G[g]; if (!D) { delete P.wars[g]; continue; }
        D.raidT = (D.raidT == null ? 180 : D.raidT) - dt;
        if (D.raidT > 0) continue;
        D.raidT = 240 + Math.random() * 200;
        const mine = Object.keys(P.turf).filter((k) => P.turf[k] === 'player' && this.turfSpots[k]);
        if (!mine.length) continue;
        mine.sort((a, b) => { const sa = this.turfSpots[a], sb = this.turfSpots[b]; return Math.hypot(sa.x * TILE - p.x, sa.y * TILE - p.y) - Math.hypot(sb.x * TILE - p.x, sb.y * TILE - p.y); });
        const k = mine[0], s = this.turfSpots[k], pos = this.blockWalkTile(k, 10) || this.blockWalkTile(k, 4);
        if (!pos) continue;
        for (let i = 0; i < 3; i++) { const a = this.spawnGangster(g, pos[0] + U.rnd(-30, 30), pos[1] + U.rnd(-30, 30), 'raid'); a.brain.spot = k; a.brain.sprayT = 0; }
        this.emit('banner', { title: 'ÜBERFALL', sub: `${D.name} greifen dein Revier an — ${K.DISTRICTS[s.d] || ''} (${k})`, kind: 'red' });
        this.g_waypoint = { x: (s.x + 0.5) * TILE, y: (s.y + 0.5) * TILE };
        this.emit('waypoint', this.g_waypoint);
      }
      // daily turf income
      const day = this.today();
      if (P.turfDay == null) P.turfDay = day;
      if (P.turfDay !== day) {
        P.turfDay = day;
        const n = this.playerBlocks();
        if (n) { const v = n * K.TURF_INCOME; P.bank = (P.bank || 0) + v; this.notify(`Revier-Einnahmen: +${U.money(v)} (${n} Blöcke)`, 'money'); }
      }
    },
    ai_raid(a, dt) {
      const s = this.turfSpots && this.turfSpots[a.brain.spot];
      if (!s || this.turfOwner(s.key) !== 'player') { a.state = 'hang'; a.brain.post = { x: a.x, y: a.y }; return; }
      const tx = (s.x + 0.5) * TILE, ty = (s.y + 0.5) * TILE;
      if (Math.hypot(tx - a.x, ty - a.y) > 1.2 * TILE) { this.goTo(a, tx + U.rnd(-20, 20), ty, { tol: 24 }); a.dv = this.steer(a, 130, dt); return; }
      a.dv = [0, 0]; a.faceTo = s.oy > 0 ? -Math.PI / 2 : Math.PI / 2;
      a.brain.sprayT += dt;
      if (Math.random() < dt * 2) this.emit('spraymist', { x: tx, y: ty, col: G[a.gang].col });
      if (a.brain.sprayT > 9) { this.sprayTurf(s, a.gang); for (const o of this.actors) if (o.brain && o.brain.spot === s.key && o.state === 'raid') { o.state = 'hang'; o.brain.post = { x: o.x, y: o.y }; } }
    },
  });
})(globalThis.K = globalThis.K || {});
