/* RDE // KONTRAKT — contracts: random targets with routines, bodyguards, intel, bonuses, ratings */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE;
  const CLIENTS = ['Die Zentrale', 'Vesna (Vermittlerin)', 'Ein Unbekannter', 'Das Konsortium', 'Familie Moretti', 'Hafengewerkschaft', 'Ein besorgter Bürger'];

  K.mixin({
    initContracts() {
      this.offers = []; this.contract = null; this.contractsDone = 0; this.offerT = this.time + 20;
    },
    /** build a contract from compact seed data (so saves stay small) */
    makeContract(sd) {
      const r = new K.RNG(sd.seed);
      const prof = K.PROFESSIONS[sd.prof % K.PROFESSIONS.length];
      // routine: 3 stops at buildings of the kinds this profession frequents
      const stops = [];
      const kinds = prof.place;
      for (let k = 0; k < 3; k++) {
        const t = kinds[k % kinds.length];
        let cands = this.buildings.filter((b) => (b.type === t || b.shop === t) && !b.property);
        if (!cands.length) cands = this.buildings.filter((b) => b.type === 'office' || b.type === 'hotel');
        stops.push(cands[r.int(cands.length)].id);
      }
      const diff = sd.diff;
      const reward = Math.round((2500 + diff * 3500 + this.P.level * 600) * (0.85 + r.next() * 0.4) / 50) * 50;
      const bonusPool = K.BONUSES.filter((b) => b.id !== 'weapon');
      r.shuffle(bonusPool);
      const bonuses = bonusPool.slice(0, 2 + (diff > 3 ? 1 : 0)).map((b) => ({ ...b }));
      let wpn = null;
      if (r.chance(0.4)) { wpn = r.pick(['wire', 'knife', 'silber', 'jaeger', 'pump', 'katana', 'bat', 'fists', 'syringe']); bonuses.push({ ...K.BONUSES.find((b) => b.id === 'weapon'), w: wpn, desc: `Mit ${K.WEAPONS[wpn].name}` }); }
      const female = r.chance(0.4);
      const name = `${r.pick(K.NAMES.first)} ${r.chance(0.3) ? r.pick(K.NAMES.nick) + ' ' : ''}${r.pick(K.NAMES.last)}`;
      return {
        id: sd.seed, seedData: sd, status: 'offer', client: CLIENTS[r.int(CLIENTS.length)],
        title: prof.t, name, female, prof, outfit: prof.o, skin: r.pick(K.SKINS), hair: r.pick(K.HAIR.filter(Boolean)), hat: r.chance(0.35),
        bio: `${name} ${prof.d}`, diff, guards: Math.min(4, Math.max(0, diff - 1 + r.int(2))), reward, bonuses, wpn,
        stops, dwell: [40 + r.int(60), 30 + r.int(50), 40 + r.int(60)],
        deadline: sd.deadline, intel: false, notes: { spotted: 0, witnesses: 0, bodies: 0, kills: 0, wanted: 0 },
      };
    },
    newOffer() {
      const diff = 1 + Math.min(4, Math.floor(Math.random() * (2 + this.contractsDone * 0.4)));
      const sd = { seed: (Math.random() * 1e9) | 0, prof: U.rint(K.PROFESSIONS.length), diff, deadline: this.time + 60 * (18 + U.rint(16)) };
      return this.makeContract(sd);
    },
    refreshOffers(force) {
      this.offers = this.offers.filter((o) => o.deadline > this.time + 120);
      while (this.offers.length < 3) this.offers.push(this.newOffer());
      if (!force) { this.emit('phone', { text: 'Neuer Auftrag eingegangen.' }); }
    },

    acceptContract(c, silent) {
      if (this.contract && this.contract.status === 'active') return false;
      this.offers = this.offers.filter((o) => o !== c);
      c.status = 'active'; c.stopI = 0; c.since = this.time; c.lastPing = 0; c.killsAtStart = this.P.stats.kills; c.civAtStart = this.P.stats.civKills;
      this.contract = c;
      this.spawnTarget(c);
      if (!silent) { this.emit('banner', { title: 'AUFTRAG ANGENOMMEN', sub: `Ziel: ${c.name}`, kind: 'red' }); this.emit('sfx', { s: 'accept' }); }
      return true;
    },
    abortContract() {
      const c = this.contract; if (!c || c.status !== 'active') return;
      c.status = 'failed'; this.cleanupTarget(c);
      this.emit('banner', { title: 'AUFTRAG ABGEBROCHEN', sub: c.name, kind: 'grey' });
      this.contract = null;
    },
    buyIntel() {
      const c = this.contract; if (!c || c.intel) return false;
      const cost = Math.round(c.reward * 0.1 / 50) * 50;
      if (this.P.money < cost) { this.notify('Nicht genug Geld für Intel.', 'bad'); return false; }
      this.P.money -= cost; c.intel = true; this.emit('sfx', { s: 'cash' }); this.notify(`Intel gekauft (−${U.money(cost)}). Ziel wird markiert.`, 'money');
      return true;
    },
    spawnTarget(c) {
      const b = this.buildings[c.stops[0]];
      const pois = b.pois.length ? b.pois : [{ x: b.entrance.x, y: b.entrance.y }];
      const pt = U.pick(pois);
      let i = this.nav.nearestFree(pt.y * this.W + pt.x, null, 3);
      if (i < 0) i = b.entrance.y * this.W + b.entrance.x;
      const x = (i % this.W + 0.5) * TILE, y = (((i / this.W) | 0) + 0.5) * TILE;
      const t = this.spawnActor('target', x, y, { outfit: c.outfit, skin: c.skin, hair: c.hair, female: c.female, name: c.name, hp: 110 + c.diff * 15, state: 'routine', wallet: 400 + c.diff * 200 });
      t.target = true; t.hat = c.hat; t.contract = c.id; t.important = true; t.brain.dwell = this.time + c.dwell[0]; t.loot = 'watch';
      c.targetId = t.id;
      c.guardIds = [];
      for (let k = 0; k < c.guards; k++) {
        const g = this.spawnActor('bodyguard', x + U.rnd(-20, 20), y + U.rnd(-20, 20), { outfit: 'guard', weapon: c.diff >= 4 && k === 0 ? 'mpk' : 'p9', hp: 140, armor: 40, state: 'escort', reserve: -1, enforcer: k === 0 });
        g.guarding = t.id; g.brain.off = (k - (c.guards - 1) / 2) * 0.9; g.acc = 1.9; g.important = true;
        c.guardIds.push(g.id);
      }
    },
    cleanupTarget(c) {
      for (const id of [c.targetId, ...(c.guardIds || [])]) { const a = this.byId.get(id); if (a && a.alive) this.removeActor(a); }
    },
    targetActor() { const c = this.contract; return c && c.status === 'active' ? this.byId.get(c.targetId) : null; },

    // ------------------------------------------------------------ routine
    ai_routine(a, dt) {
      const c = this.contract && this.contract.id === a.contract ? this.contract : null;
      if (!c) { a.state = 'wander'; return; }
      const stop = this.buildings[c.stops[c.stopI % c.stops.length]];
      if (a.brain.atStop) {
        if (this.time > a.brain.dwell) { a.brain.atStop = false; c.stopI++; a.goal = null; a.path = null; this.emit('targetMove', {}); return; }
        // linger around POIs inside
        if (a.brain.waitT > 0) { a.brain.waitT -= dt; return; }
        if (!a.goal || a.arrived) {
          if (a.goal) { a.brain.waitT = 6 + Math.random() * 12; a.goal = null; return; }
          const pois = stop.pois.length ? stop.pois : [{ x: stop.entrance.x, y: stop.entrance.y }];
          const pt = U.pick(pois);
          this.goTo(a, (pt.x + 0.5) * TILE, (pt.y + 0.5) * TILE, { force: true });
        }
        a.dv = this.steer(a, 50, dt);
        return;
      }
      const pois = stop.pois.length ? stop.pois : [{ x: stop.entrance.x, y: stop.entrance.y }];
      if (!a.brain.dest) { const pt = U.pick(pois); a.brain.dest = [(pt.x + 0.5) * TILE, (pt.y + 0.5) * TILE]; a.goal = null; }
      this.goTo(a, a.brain.dest[0], a.brain.dest[1]);
      a.dv = this.steer(a, 62, dt);
      if (a.arrived || Math.hypot(a.brain.dest[0] - a.x, a.brain.dest[1] - a.y) < 20) {
        a.brain.atStop = true; a.brain.dest = null; a.brain.dwell = this.time + c.dwell[c.stopI % 3]; a.brain.waitT = 4; a.goal = null;
      }
    },
    ai_panic(a, dt) {
      const c = this.contract && this.contract.id === a.contract ? this.contract : null;
      // run to the safest building of the routine (villa/hotel/office first)
      if (!a.brain.safe) {
        const ids = c ? c.stops : [];
        const pick = ids.map((i) => this.buildings[i]).sort((p, q) => (q.restricted ? 1 : 0) - (p.restricted ? 1 : 0))[0] || this.buildings[0];
        const room = pick.rooms[pick.rooms.length - 1];
        a.brain.safe = [(room.x + room.w / 2) * TILE, (room.y + room.h / 2) * TILE];
        a.goal = null;
      }
      this.goTo(a, a.brain.safe[0], a.brain.safe[1]);
      a.dv = this.steer(a, 150, dt);
      if (a.arrived) { a.state = 'hide'; a.brain.calm = 0; }
    },
    ai_hide(a, dt) {
      a.brain.calm += dt;
      a.faceTo = a.angle + Math.sin(this.t) * 0.02;
      if (a.brain.calm > 90) { a.state = 'routine'; a.brain.safe = null; a.brain.atStop = false; a.goal = null; this.bark(a, 'Ich glaube, sie sind weg.'); }
    },

    // ------------------------------------------------------------ bookkeeping
    note(kind, d) {
      const c = this.contract; if (!c || c.status !== 'active') return;
      const n = c.notes;
      if (kind === 'spotted') n.spotted++;
      else if (kind === 'witness') { n.witnesses++; if (d.type === 'murder' || d.type === 'assault') n.spotted++; }
      else if (kind === 'bodyFound') n.bodies++;
      else if (kind === 'wanted') n.wanted = Math.max(n.wanted, d.level);
      else if (kind === 'shot' && !d.sup) n.loud = true;
    },
    contractTargetKilled(t, src, info) {
      const c = this.contract;
      if (!c || c.status !== 'active' || c.targetId !== t.id) return;
      c.status = 'killed';
      c.kill = { by: src && src.kind === 'player' ? 'player' : 'other', info, t: this.time, x: t.x, y: t.y, outfit: this.P.outfit, wpn: info.w || (info.kind === 'fist' ? 'fists' : null), kills: this.P.stats.kills - (c.killsAtStart || 0) };
      this.emit('targetDown', { x: t.x, y: t.y, name: c.name });
      this.slowmo = 1.4;
      c.evalAt = this.t + 4;
    },
    updateContracts(dt) {
      if (this.time > this.offerT) { this.offerT = this.time + 150 + Math.random() * 120; if (this.offers.length < 3) this.refreshOffers(false); }
      const c = this.contract;
      if (!c) return;
      if (c.killsAtStart == null) c.killsAtStart = this.P.stats.kills;
      if (c.status === 'active') {
        const t = this.byId.get(c.targetId);
        if (!t) { this.spawnTarget(c); return; }
        if (this.time > c.deadline) { c.status = 'failed'; this.cleanupTarget(c); this.emit('banner', { title: 'AUFTRAG VERFEHLT', sub: 'Die Frist ist abgelaufen.', kind: 'grey' }); this.contract = null; return; }
        // rough location ping for the map without intel
        if (this.time - c.lastPing > 15 || !c.ping) { c.lastPing = this.time; c.ping = { x: t.x + U.rnd(-6, 6) * TILE, y: t.y + U.rnd(-6, 6) * TILE }; }
        return;
      }
      if (c.status === 'killed' && this.t > c.evalAt) this.finishContract(c);
    },
    finishContract(c) {
      const k = c.kill, n = c.notes, P = this.P;
      const lines = [];
      let pay = c.reward;
      lines.push({ t: 'Grundhonorar', v: c.reward });
      if (k.by !== 'player') { pay = Math.round(c.reward * 0.5); lines[0] = { t: 'Ziel tot (nicht durch dich) — halbes Honorar', v: pay }; }
      const extraKills = Math.max(0, (this.P.stats.kills - c.killsAtStart) - 1);
      const civPen = Math.min(pay * 0.6, (this.P.stats.civKills - (c.civAtStart || this.P.stats.civKills)) * 1500);
      const got = [];
      if (k.by === 'player') {
        for (const b of c.bonuses) {
          let ok = false;
          if (b.id === 'silent') ok = n.spotted === 0 && n.bodies === 0 && !n.loud;
          else if (b.id === 'onlytarget') ok = extraKills === 0;
          else if (b.id === 'accident') ok = k.info.kind === 'poison' || k.info.accident;
          else if (b.id === 'weapon') ok = k.wpn === b.w || (b.w === 'syringe' && k.info.kind === 'poison');
          else if (b.id === 'headshot') ok = !!k.info.head;
          else if (b.id === 'disguise') ok = K.OUTFITS[k.outfit].disguise;
          const v = Math.round(c.reward * b.v / 50) * 50;
          lines.push({ t: b.name, v: ok ? v : 0, ok, bonus: true });
          if (ok) { pay += v; got.push(b.id); }
        }
      }
      if (civPen > 0) { lines.push({ t: 'Kollateralschaden', v: -civPen }); pay -= civPen; }
      pay = Math.max(0, Math.round(pay));
      let rating = 'AMATEUR';
      if (got.includes('silent') && extraKills === 0) rating = 'LAUTLOSER ASSASSINE';
      else if (n.spotted === 0) rating = 'PHANTOM';
      else if (extraKills <= 2 && n.wanted < 2) rating = 'PROFI';
      else if (extraKills > 6) rating = 'SCHLÄCHTER';
      else if (n.wanted >= 3) rating = 'STAATSFEIND';
      P.money += pay; P.stats.contracts++; P.stats.earned += pay; this.contractsDone++;
      if (rating === 'LAUTLOSER ASSASSINE') P.stats.silent++;
      const xp = 120 + c.diff * 80 + got.length * 40 + (rating === 'LAUTLOSER ASSASSINE' ? 200 : 0);
      this.addXP(xp, 'Auftrag');
      c.status = 'done';
      this.emit('contractDone', { c, lines, pay, rating, xp });
      this.emit('sfx', { s: 'complete' });
      this.contract = null;
      for (const id of c.guardIds || []) { const g = this.byId.get(id); if (g) g.important = false; }
    },
  });
})(globalThis.K = globalThis.K || {});
