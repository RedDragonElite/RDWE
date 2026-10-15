/* RDE // KONTRAKT — city services: the city cleans up after you, on a believable clock.
 *  · Bestatter / Gerichtsmedizin pick up bodies once they are found (unfound ones get found eventually)
 *  · Stadtreinigung mops the blood at a scene after the body is gone (everything else fades with time and rain)
 *  · Stadtwerke replace smashed street lamps, hydrants, benches…
 *  · Abschleppdienst tows burnt-out wrecks
 *  · Müllabfuhr empties the dumpsters every other morning — with whatever you hid in them
 * Near you a crew drives up in a van and does the job on foot; across town it simply happens.
 * All delays are game minutes (one real second is one game minute). */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE;

  K.SVC = {
    bodyFound: [25, 50],      // found body → coroner on scene
    bodyUnfound: [150, 300],  // nobody noticed it… until somebody does
    blood: [20, 60],          // after the body is gone: the scene is mopped
    lamp: [360, 840],         // smashed street lamp replaced
    prop: [150, 420],         // knocked-over street furniture put back
    wreck: [60, 160],         // burnt-out wreck towed
    near: 40,                 // tiles: within this the job is done in person
    work: { body: 7, blood: 9, lamp: 8, prop: 8, wreck: 6 },
    crew: {
      body: { car: 'van', color: '#1d2026', livery: 'coroner', outfit: 'coroner', n: 2, name: 'Bestatter' },
      blood: { car: 'van', color: '#e9792b', livery: 'clean', outfit: 'cleaner', n: 1, name: 'Stadtreinigung' },
      lamp: { car: 'van', color: '#f0c419', livery: 'power', outfit: 'worker', n: 1, name: 'Stadtwerke' },
      prop: { car: 'van', color: '#f0c419', livery: 'power', outfit: 'worker', n: 2, name: 'Stadtwerke' },
      wreck: { car: 'pickup', color: '#d9a21b', livery: 'tow', outfit: 'worker', n: 1, name: 'Abschleppdienst' },
    },
  };
  K.OUTFITS.coroner = { name: 'Bestatter', body: '#2a2d33', trim: '#c9ccd2', pants: '#1c1e22', role: 'civ', disguise: true };
  K.OUTFITS.cleaner = { name: 'Stadtreinigung', body: '#ef7d22', trim: '#e8e8e8', pants: '#3a3f47', role: 'civ', disguise: true };
  K.OUTFITS.worker = { name: 'Stadtwerke', body: '#f2c21b', trim: '#e8e8e8', pants: '#2d3a52', role: 'civ', disguise: true };
  const BARK = {
    body: ['Armer Kerl.', 'Sack zu. Wir nehmen ihn mit.', 'Der dritte diese Woche…', 'Fotos sind gemacht, ab damit.'],
    blood: ['Das kriegt man nie ganz raus.', 'Wer macht so eine Sauerei…', 'Noch mal mit Chlor drüber.'],
    lamp: ['Neue Birne, neues Glück.', 'Schon wieder umgefahren.'],
    prop: ['Wer fährt denn so?', 'Hoch damit.'],
    wreck: ['Den hat\'s erwischt.', 'Haken dran, ab zum Schrott.'],
  };
  const rnd = (r) => r[0] + Math.random() * (r[1] - r[0]);

  K.mixin({
    cityJobs() { return this.svcS || (this.svcS = { jobs: [], seq: 0, scanT: 0, trashDay: -1 }); },
    svcJob(kind, x, y, delay, ref) {
      const S = this.cityJobs(), j = { id: ++S.seq, kind, x, y, due: this.time + rnd(delay), ref, crew: 0 };
      S.jobs.push(j); return j;
    },
    /** find new mess: bodies, dead lamps, broken props, wrecks */
    svcScan() {
      const S = this.cityJobs(), V = K.SVC;
      for (const a of this.actors) {
        if (a.alive || a.removed || a.hidden || a.kind === 'player') continue;
        if (!a.svcJob) { a.svcJob = this.svcJob('body', a.x, a.y, a.found ? V.bodyFound : V.bodyUnfound, a.id).id; a.svcFound = !!a.found; }
        else if (a.found && !a.svcFound) {   // found since: the coroner is on the way now
          a.svcFound = true; const j = S.jobs.find((q) => q.id === a.svcJob);
          if (j && j.due > this.time + V.bodyFound[1]) j.due = this.time + rnd(V.bodyFound);
        }
      }
      for (const p of this.props) if (p && p.broken && p.bld < 0 && !p.rec && !p.svcJob) p.svcJob = this.svcJob(p.k === 'lamp' ? 'lamp' : 'prop', (p.x + p.w / 2) * TILE, (p.y + p.h / 2) * TILE, p.k === 'lamp' ? V.lamp : V.prop, p.id).id;
      for (const L of this.lights) if (L.dead && L.kind === 'lamp' && !L.svcJob && !this.props.some((p) => p && p.broken && p.k === 'lamp' && Math.abs((p.x + 0.5) * TILE - L.x) < 24 && Math.abs((p.y + 0.5) * TILE - L.y) < 24)) L.svcJob = this.svcJob('lamp', L.x, L.y, V.lamp, 'L' + this.lights.indexOf(L)).id;
      for (const w of this.wrecks || []) if (!w.svcJob) w.svcJob = this.svcJob('wreck', w.x, w.y, V.wreck, w).id;
    },
    updateServices(dt) {
      const S = this.cityJobs(), p = this.player;
      S.scanT -= dt;
      if (S.scanT <= 0) { S.scanT = 2; this.svcScan(); this.garbageRun(); }
      this.updateSvcUnits(dt);
      for (const j of S.jobs) {
        if (j.done || j.crew || this.time < j.due) continue;
        if (!this.svcValid(j)) { j.done = true; continue; }
        const d = Math.hypot(j.x - p.x, j.y - p.y) / TILE;
        // you are standing on it / dragging it / it's a fresh crime scene with cops around: come back later
        if (d < 3 || (j.kind === 'body' && this.byId.get(j.ref) && this.byId.get(j.ref).dragBy)) { j.due = this.time + 10; continue; }
        if (d > K.SVC.near || !this.svcDispatch(j)) this.svcDo(j, true);
      }
      if (S.jobs.length > 60) S.jobs = S.jobs.filter((j) => !j.done);
    },
    svcValid(j) {
      if (j.kind === 'body') { const a = this.byId.get(j.ref); return !!(a && !a.alive && !a.removed && !a.hidden); }
      if (j.kind === 'lamp' || j.kind === 'prop') {
        if (typeof j.ref === 'string') { const L = this.lights[+j.ref.slice(1)]; return !!(L && L.dead); }
        const pr = this.props.find((q) => q && q.id === j.ref); return !!(pr && pr.broken);
      }
      if (j.kind === 'wreck') return (this.wrecks || []).includes(j.ref);
      return true;
    },
    /** the effect itself (instant across town, or when the crew is done) */
    svcDo(j, remote) {
      if (j.done) return true;
      if (j.kind === 'body') {
        const a = this.byId.get(j.ref);
        if (a && !a.alive && !a.removed && !a.hidden) {
          if (a.dragBy) return false;
          this.removeActor(a);
          if (a.pool > 0.2 || a.bloody) this.svcJob('blood', a.x, a.y, K.SVC.blood, null);
          if (!remote) this.emit('svcBag', { x: a.x, y: a.y });
        }
      } else if (j.kind === 'blood') this.emit('clean', { x: j.x, y: j.y, r: 3.2 * TILE, k: 1 });
      else if (j.kind === 'lamp' || j.kind === 'prop') {
        if (typeof j.ref === 'string') { const L = this.lights[+j.ref.slice(1)]; if (L) { L.dead = false; L.svcJob = 0; } }
        else { const pr = this.props.find((q) => q && q.id === j.ref); if (pr && !this.restoreProp(pr)) { j.due = this.time + 15; j.crew = 0; return false; } }
      } else if (j.kind === 'wreck') { this.wrecks = (this.wrecks || []).filter((w) => w !== j.ref); this.emit('clean', { x: j.x, y: j.y, r: 2.5 * TILE, k: 0.5 }); }
      j.done = true;
      return true;
    },
    /** put knocked-over street furniture back (only when nothing stands on it) */
    restoreProp(p) {
      const W = this.W, x0 = p.x * TILE, y0 = p.y * TILE, x1 = (p.x + p.w) * TILE, y1 = (p.y + p.h) * TILE;
      for (const a of this.near((x0 + x1) / 2, (y0 + y1) / 2, 60)) if (a.alive && !a.inCar && a.x > x0 - 10 && a.x < x1 + 10 && a.y > y0 - 10 && a.y < y1 + 10) return false;
      for (const c of this.cars) if (!c.dead && Math.abs(c.x - (x0 + x1) / 2) < c.l / 2 + 20 && Math.abs(c.y - (y0 + y1) / 2) < c.l / 2 + 20) return false;
      const PK = K.PROPK[p.k] || {};
      p.broken = false; p.svcJob = 0;
      for (let j = p.y; j < p.y + p.h; j++) for (let i = p.x; i < p.x + p.w; i++) {
        const t = j * W + i; this.pmap[t] = p.id; this.solid[t] |= PK.s || 0;
        if (this.solid[t] & 4) this.opaque[t] = 1;
        if (this.nav) this.nav.cost[t] = this.nav.baseCost(t);
      }
      const cx = (p.x + p.w / 2) * TILE, cy = (p.y + p.h / 2) * TILE;
      for (const L of this.lights) if (L.kind === 'lamp' && Math.abs(L.x - cx) < 20 && Math.abs(L.y - cy) < 20) { L.dead = false; L.svcJob = 0; }
      if (this.debris) this.debris = this.debris.filter((d) => d.seed !== p.id);
      this.emit('propChanged', { x: p.x, y: p.y, w: p.w, h: p.h });
      return true;
    },

    // ============================================================ crews in person
    svcDispatch(j) {
      if (!this.roadNodeFar || !this.spawnCar) return false;
      const C = K.SVC.crew[j.kind]; if (!C) return false;
      const node = this.roadNodeFar(j.x, j.y, 22, 60) || this.roadNodeFar(j.x, j.y, 14, 90);
      if (!node) return false;
      const P_ = 26, LANE = 32, [i, k] = node, nb = this.roadNeighbors(i, k); if (!nb.length) return false;
      const [ni, nk] = U.pick(nb);
      const x0 = (i * P_ + 2) * TILE, y0 = (k * P_ + 2) * TILE, x1 = (ni * P_ + 2) * TILE, y1 = (nk * P_ + 2) * TILE;
      const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
      const c = this.spawnCar(C.car, x0 + (x1 - x0) * 0.35 - dy * LANE, y0 + (y1 - y0) * 0.35 + dx * LANE, Math.atan2(dy, dx));
      if (!c) return false;
      c.ai = { fi: i, fj: k, ti: ni, tj: nk, stage: 'road', wp: null };
      c.unit = { mode: 'respond', dest: { x: j.x, y: j.y }, prio: 1, foe: 0, t0: this.t, crew: [], svc: j.id };
      c.color = C.color; c.livery = C.livery; c.svc = true; c.locked = true;
      for (let n = 0; n < C.n; n++) {
        const m = this.spawnActor('civ', c.x, c.y, { outfit: C.outfit, state: 'incar', female: Math.random() < 0.3, hp: 100, wallet: 20 + U.rint(40) });
        m.inCar = c.id; m.unit = c.id; m.important = true; m.resident = true; m.svcCrew = true; c.unit.crew.push(m.id);
      }
      c.driver = c.unit.crew[0]; c.passengers = c.unit.crew.slice(1);
      j.crew = c.id;
      return true;
    },
    svcUnits() { return this.cars.filter((c) => c.svc && !c.dead && c.unit); },
    updateSvcUnits(dt) {
      const p = this.player, S = this.cityJobs();
      for (const c of this.svcUnits()) {
        const u = c.unit, j = S.jobs.find((q) => q.id === u.svc);
        for (const id of u.crew) { const a = this.byId.get(id); if (a && a.inCar === c.id) { a.x = c.x; a.y = c.y; a.angle = c.a; } }
        if (u.mode === 'respond') {
          if (!j || j.done || !this.svcValid(j)) { if (j) j.done = true; u.mode = 'leave'; continue; }
          const d = Math.hypot(j.x - c.x, j.y - c.y), atEnd = c.route && c.routeI >= c.route.length - 1 && c.speed < 30;
          const late = this.t - u.t0 > 120;
          if (d < 5 * TILE || (atEnd && d < 14 * TILE) || late) {
            if (late && d > 14 * TILE) {   // the roads beat them: if nobody's watching, they simply arrive
              if (K.los(this, p.x, p.y, c.x, c.y) && Math.hypot(c.x - p.x, c.y - p.y) < 30 * TILE) { u.t0 = this.t - 60; continue; }
              const n = this.nav.nearestFree(this.tileIdx(j.x, j.y + 3 * TILE), null, 4); if (n >= 0) { c.x = (n % this.W + 0.5) * TILE; c.y = (((n / this.W) | 0) + 0.5) * TILE; }
            }
            u.mode = 'onscene'; c.vx *= 0.3; c.vy *= 0.3; c.blink = 2;
            for (const id of u.crew) { const a = this.byId.get(id); if (!a || !a.alive) continue; this.ejectFrom(c, a, false); a.state = 'svc'; a.brain.job = j.id; a.brain.work = 0; a.path = null; a.goal = null; }
            c.driver = null; c.passengers = [];
            if (j.kind === 'wreck') j.towT = 0;
          }
        } else if (u.mode === 'onscene') {
          const alive = u.crew.map((id) => this.byId.get(id)).filter((a) => a && a.alive && !a.removed);
          const inside = alive.filter((a) => a.inCar === c.id), working = alive.filter((a) => a.state === 'svc' || a.state === 'emsback');
          if (j && j.kind === 'wreck' && !j.done) { j.towT = (j.towT || 0) + dt; if (j.towT > K.SVC.work.wreck) { this.svcDo(j, false); this.bark(alive[0] || c, U.pick(BARK.wreck), 2); } }
          if (alive.length && inside.length === alive.length) { c.driver = inside[0].id; c.passengers = inside.slice(1).map((a) => a.id); u.mode = 'leave'; c.blink = 0; }
          else if (!alive.length || (!working.length && !inside.length)) {   // scared off or dead: the job waits for another crew
            u.mode = 'abandoned'; if (j && !j.done) { j.crew = 0; j.due = this.time + 60; }
          }
        } else if (u.mode === 'leave' || u.mode === 'abandoned') {
          if (Math.hypot(c.x - p.x, c.y - p.y) > 44 * TILE && !K.los(this, p.x, p.y, c.x, c.y)) {
            for (const id of u.crew) { const a = this.byId.get(id); if (a && (a.inCar === c.id || u.mode === 'leave')) this.removeActor(a); }
            this.despawnCar(c);
          }
        }
      }
    },
    /** the crew on foot: walk to the job, do it, back to the van */
    ai_svc(a, dt) {
      const S = this.cityJobs(), j = S.jobs.find((q) => q.id === a.brain.job);
      if (!j || j.done) { a.state = 'emsback'; a.goal = null; a.crouch = false; return; }
      const team = this.actors.filter((q) => q.state === 'svc' && q.brain.job === j.id && q !== a);
      // the second one stands guard over the scene (or holds the bag)
      const tx = j.x + (team.length && team[0].id < a.id ? 26 : 0), ty = j.y + (team.length && team[0].id < a.id ? 10 : 0);
      const d = Math.hypot(tx - a.x, ty - a.y);
      if (d > 26) {
        if (d < 3 * TILE && K.los(this, a.x, a.y, tx, ty)) { const g = Math.atan2(ty - a.y, tx - a.x); a.dv = [Math.cos(g) * 80, Math.sin(g) * 80]; a.goal = null; a.path = null; }
        else { this.goTo(a, tx, ty, { tol: 22 }); a.dv = this.steer(a, 80, dt); }
        a.brain.walkT = (a.brain.walkT || 0) + dt;
        if (a.brain.walkT > 40) { a.x = tx; a.y = ty; }
        return;
      }
      a.faceTo = Math.atan2(j.y - a.y, j.x - a.x); a.dv = [0, 0];
      if (j.kind === 'wreck') return;   // the truck does the work
      a.crouch = j.kind === 'body' || j.kind === 'blood' || j.kind === 'prop';
      a.brain.work += dt;
      if (j.kind === 'blood' && Math.random() < dt * 2) this.emit('clean', { x: j.x + U.rnd(-40, 40), y: j.y + U.rnd(-40, 40), r: 1.4 * TILE, k: 0.35 });
      if (j.kind === 'blood' && Math.random() < dt * 3) this.emit('svcMop', { x: a.x + Math.cos(a.angle) * 14, y: a.y + Math.sin(a.angle) * 14 });
      if (j.kind === 'lamp' && Math.random() < dt * 4) this.emit('svcSpark', { x: j.x, y: j.y });
      if (!a.brain.said && a.brain.work > 1.5 && Math.hypot(this.player.x - a.x, this.player.y - a.y) < 10 * TILE) { a.brain.said = true; this.bark(a, U.pick(BARK[j.kind] || ['So.']), 2.4); }
      if (a.brain.work >= K.SVC.work[j.kind]) {
        if (!this.svcDo(j, false)) { a.brain.work = K.SVC.work[j.kind] - 2; return; }
        a.crouch = false;
        for (const q of [a, ...team]) { q.state = 'emsback'; q.goal = null; q.crouch = false; }
      }
    },

    // ============================================================ garbage collection
    /** every other morning at 06:00 the dumpsters are emptied — bodies inside go with them */
    garbageRun() {
      const S = this.cityJobs(), day = Math.floor(this.time / 1440), h = (this.time % 1440) / 60;
      if (h < 6 || day % 2 || S.trashDay === day) return;
      S.trashDay = day;
      let n = 0;
      for (const p of this.props) if (p && p.k === 'dumpster' && p.bodies) { n += p.bodies; p.bodies = 0; }
      for (const a of this.actors) if (!a.alive && a.hidden && !a.removed && a.hiddenSpot != null && this.props[a.hiddenSpot] && this.props[a.hiddenSpot].k === 'dumpster') this.removeActor(a);
      if (n && Math.random() < 0.35) {
        this.emit('radio', { text: 'Müllabfuhr meldet Leichenfund in einem Container — Ermittlungen laufen.' });
      }
    },
  });
})(K);
