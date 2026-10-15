/* RDE // KONTRAKT — residents: every private house and flat has a household. Each member has a job
 * and a daily routine (office hours, night shifts, students out partying, pensioners mostly home),
 * sleeps in their own bed at night, leaves through the front door and comes home again. Break in
 * while they are at work and the place is yours; break in at night and try not to wake anybody.
 * Some keep a pistol in the nightstand. Dead tenants stay dead — after a few days new people move in. */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE;
  const tc = (i, W) => [(i % W + 0.5) * TILE, (((i / W) | 0) + 0.5) * TILE];

  K.HOME = {
    spawnR: 34, despawnR: 46,        // tiles from the building: households materialise / dissolve
    refillDays: 3,                   // a flat stays empty this long after its tenants died
    jobs: { day: 0.42, shift: 0.16, night: 0.1, home: 0.18, student: 0.14 },
    armed: 0.14,                     // chance a member keeps a gun at home
    sleepWake: 0.45,                 // chance a quiet noise wakes a sleeper
  };
  const JOBNAME = { day: 'Büro', shift: 'Schichtdienst', night: 'Nachtschicht', home: 'meist zu Hause', student: 'Student' };

  K.mixin({
    // ============================================================ households
    household(b) {
      if (b.hh) return b.hh;
      const rng = new K.RNG((this.seed || 1) * 7919 + b.id * 104729);
      const n = b.type === 'house' ? 1 + (rng.chance(0.35) ? 1 : 0) + (rng.chance(0.4) ? 1 : 0) + (rng.chance(0.2) ? 1 : 0) : 1 + (rng.chance(0.45) ? 1 : 0) + (rng.chance(0.15) ? 1 : 0);
      b.hh = { members: [], gen: 0 };
      for (let k = 0; k < n; k++) b.hh.members.push(this.newResident(rng, b, k));
      return b.hh;
    },
    newResident(rng, b, k) {
      let r = rng.next(), job = 'day';
      for (const [j, p] of Object.entries(K.HOME.jobs)) { if (r < p) { job = j; break; } r -= p; }
      const female = rng.chance(0.5);
      return {
        k, job, female, seed: rng.int(1e9),
        name: rng.pick(K.NAMES.first) + ' ' + (k && b.hh && b.hh.members[0] && rng.chance(0.7) ? b.hh.members[0].name.split(' ').pop() : rng.pick(K.NAMES.last)),
        outfit: rng.pick(K.CIV_OUTFITS), skin: rng.pick(K.SKINS), hair: rng.pick(K.HAIR),
        bed: 22 + rng.next() * 2.5, wake: 5.8 + rng.next() * 2.2,
        armed: rng.chance(K.HOME.armed), wallet: 20 + rng.int(220),
        actor: 0, dead: false,
      };
    },
    /** is this member at home at absolute game minute t? (deterministic per member and day) */
    residentHome(m, t = this.time) {
      const day = Math.floor(t / 1440), dow = ((day % 7) + 7) % 7, h = (t % 1440) / 60;
      const r = (s) => U.hash2(m.seed % 100000, day, s);
      const j = (r(1) - 0.5) * 1.2, wk = dow < 5;
      const within = (a, b) => (a <= b ? h >= a && h < b : h >= a || h < b);
      switch (m.job) {
        case 'day':
          if (wk && within(7.4 + j, 17.4 + j)) return false;
          if (r(2) < 0.25 && within(19.5 + j, 23 + j * 0.5)) return false;            // out for the evening
          if (!wk && r(3) < 0.5 && within(11 + j * 2, 16 + j * 2)) return false;      // weekend errands
          return true;
        case 'shift':
          if (dow !== m.seed % 7 && dow !== (m.seed + 3) % 7 && within(11.5 + j, 20.5 + j)) return false;
          return true;
        case 'night':
          if (dow < 5 && within(20.5 + j, 6.5 + j)) return false;
          return !(r(4) < 0.4 && within(14, 16));
        case 'home':
          if (r(5) < 0.55 && within(9.5 + j, 11.5 + j)) return false;                  // shopping
          if (r(6) < 0.35 && within(15 + j, 17 + j)) return false;                     // a walk
          return true;
        case 'student':
          if (wk && within(8 + j, 14.5 + j)) return false;
          if ((dow === 4 || dow === 5) && within(21.5 + j, 3.5 + j)) return false;      // Friday and Saturday nights out
          if (dow === 6 && within(0, 4)) return false;
          return true;
      }
      return true;
    },
    residentAsleep(m, t = this.time) {
      const h = (t % 1440) / 60;
      if (m.job === 'night') return h >= 8 && h < 15;
      return h >= m.bed || h < m.wake;
    },
    privateHomes() { return this.homesC || (this.homesC = this.buildings.filter((b) => b.type === 'house' || b.type === 'flat')); },
    homeDoorOut(b) {
      const d = b.doors.find((q) => q.outer) || b.doors[0]; if (!d) return null;
      const i = this.nav.nearestFree((d.y + d.oy * 2) * this.W + d.x + d.ox * 2, null, 3);
      return i >= 0 ? tc(i, this.W) : null;
    },
    homeSpot(b, sleep, a) {
      if (sleep) {
        const beds = this.props.filter((p) => p && p.bld === b.id && p.k === 'bed');
        if (beds.length) {
          const bed = beds[(a ? a.member : 0) % beds.length], two = (a ? a.member : 0) >= beds.length;
          const along = bed.w >= bed.h, off = two ? 0.28 : -0.0;
          return { x: (bed.x + bed.w / 2 + (along ? 0 : off)) * TILE, y: (bed.y + bed.h / 2 + (along ? off : 0)) * TILE, a: along ? 0 : Math.PI / 2, bed: true };
        }
      }
      const pts = b.pois.filter((q) => q.kind === 'sit' || q.kind === 'sleep');
      for (let k = 0; k < 14; k++) {
        let x, y;
        if (pts.length && Math.random() < 0.5) { const q = U.pick(pts); x = q.x; y = q.y; }
        else { const r = U.pick(b.rooms); x = r.x + 1 + U.rint(Math.max(1, r.w - 2)); y = r.y + 1 + U.rint(Math.max(1, r.h - 2)); }
        const i = y * this.W + x;
        if (!this.blockedTile(i, null) && this.bmap[i] === b.id) return { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
      }
      return null;
    },
    spawnResident(b, m, where) {
      const a = this.spawnActor('civ', where.x, where.y, { outfit: m.outfit, skin: m.skin, hair: m.hair, female: m.female, name: m.name, home: b.id, state: 'home', wallet: m.wallet });
      a.resident = true; a.household = b.id; a.member = m.k; a.defender = m.armed; a.job = m.job;
      if (m.armed) { a.gun = { id: 'p9', mag: K.WEAPONS.p9.mag }; a.reserve = 15; }
      if (where.a != null) a.angle = where.a;
      m.actor = a.id;
      return a;
    },
    /** households near you come to life; the rest of the city's homes stay as data */
    updateResidents(dt) {
      this.resT = (this.resT || 0) - dt;
      if (this.resT > 0) return;
      this.resT = 0.5;
      const p = this.player, H = K.HOME, day = Math.floor(this.time / 1440);
      for (const b of this.privateHomes()) {
        if (b.owned || b.property) continue;
        const cx = (b.x + b.w / 2) * TILE, cy = (b.y + b.h / 2) * TILE, d = Math.hypot(cx - p.x, cy - p.y) / TILE;
        if (d > H.despawnR && !b.hh) continue;
        const hh = this.household(b), inside = this.bldAt(p.x, p.y) === b.id;
        for (const m of hh.members) {
          const a = m.actor ? this.byId.get(m.actor) : null;
          if (m.actor && (!a || a.removed)) m.actor = 0;
          if (a && !a.alive) { m.dead = true; m.diedDay = day; m.actor = 0; continue; }
          if (m.dead) {
            if (day - (m.diedDay ?? day) >= H.refillDays && !inside && d > 12) { Object.assign(m, this.newResident(new K.RNG(m.seed + day), b, m.k)); }
            continue;
          }
          const home = this.residentHome(m), asleep = home && this.residentAsleep(m);
          if (d > H.spawnR) m.wasHome = undefined;   // out of sight: no "arrival" to stage
          if (d > H.despawnR) { if (a && ['home', 'sleep', 'leave', 'arrive', 'idle'].includes(a.state) && a.ko <= 0) { this.removeActor(a); m.actor = 0; } continue; }
          if (d > H.spawnR && !a) continue;
          const cameHome = home && m.wasHome === false; m.wasHome = home;
          if (!a) {
            if (!home) continue;
            if (cameHome) {   // just got back: they walk in through the front door
              const o = this.homeDoorOut(b); if (!o) continue;
              const r = this.spawnResident(b, m, { x: o[0], y: o[1] }); r.state = 'arrive';
            } else {
              const s = this.homeSpot(b, asleep, { member: m.k }); if (!s) continue;
              const r = this.spawnResident(b, m, s); if (asleep && s.bed) { r.state = 'sleep'; r.brain.bed = s; }
            }
            continue;
          }
          if (a.ko > 0 || !['home', 'sleep', 'idle', 'arrive'].includes(a.state)) continue;   // busy: fleeing, calling, fighting…
          if (!home && a.state !== 'leave') {
            if (!inside && d > 14 && !this.inView(a)) { this.removeActor(a); m.actor = 0; continue; }
            this.wakeResident(a, false); a.state = 'leave'; a.goal = null; a.path = null;
          } else if (asleep && a.state === 'home' && !inside && !a.alertness) {
            const s = this.homeSpot(b, true, a);
            if (s && s.bed) { if (Math.hypot(s.x - a.x, s.y - a.y) < 30 || !this.inView(a)) { a.x = s.x; a.y = s.y; a.angle = s.a; a.state = 'sleep'; a.brain.bed = s; } else if (!a.brain.toBed) { a.brain.toBed = s; a.brain.waitT = 0; a.goal = null; } }
          } else if (!asleep && a.state === 'sleep') this.wakeResident(a, false);
        }
      }
    },
    /** could you see this person right now? (on screen and in line of sight) */
    inView(a) { const p = this.player; return Math.abs(a.x - p.x) < 26 * TILE && Math.abs(a.y - p.y) < 15 * TILE && K.los(this, p.x, p.y, a.x, a.y); },
    wakeResident(a, startled) {
      if (a.state !== 'sleep') return;
      const i = this.nav.nearestFree(this.tileIdx(a.x, a.y), a, 3);
      if (i >= 0) [a.x, a.y] = tc(i, this.W);
      a.state = 'home'; a.brain.waitT = startled ? 0 : 2 + Math.random() * 3; a.goal = null; a.path = null; a.brain.toBed = null;
      if (startled) { a.alertness = 1; this.bark(a, U.pick(['Hm…? Ist da wer?', 'Schatz, hast du das gehört?', 'Was war das?!']), 2.2); if (a.gun) this.residentArm(a); }
    },
    residentArm(a) { if (a.gun && a.wi.id === 'fists') { a.wi = { id: a.gun.id, mag: a.gun.mag, sup: false }; a.weapon = a.gun.id; } },

    // ============================================================ AI states
    ai_home(a, dt) {
      const b = this.buildings[a.home]; if (!b) return this.ai_wander(a, dt);
      const bed = a.brain.toBed;
      if (bed) {   // bedtime: walk over, lie down
        if (Math.hypot(bed.x - a.x, bed.y - a.y) < 34) { a.x = bed.x; a.y = bed.y; a.angle = bed.a; a.state = 'sleep'; a.brain.bed = bed; a.brain.toBed = null; a.goal = null; a.path = null; return; }
        this.goTo(a, bed.x, bed.y, { tol: 20 }); a.dv = this.steer(a, 40, dt);
        if (a.arrived) { a.x = bed.x; a.y = bed.y; }
        return;
      }
      if (a.brain.waitT > 0) { a.brain.waitT -= dt; a.dv = [0, 0]; return; }
      if (!a.goal || a.arrived) {
        if (a.goal) { a.brain.waitT = 6 + Math.random() * 16; a.goal = null; return; }
        const s = this.homeSpot(b, false); if (!s) { a.brain.waitT = 5; return; }
        this.goTo(a, s.x, s.y, { force: true });
      }
      a.dv = this.steer(a, 44, dt);
    },
    ai_sleep(a, dt) {
      const s = a.brain.bed;
      if (s) { a.x = s.x; a.y = s.y; a.angle = s.a; }
      a.dv = [0, 0]; a.vx = a.vy = 0; a.seesPlayer = false; a.susp = 0;
    },
    ai_leave(a, dt) {
      const b = this.buildings[a.home], o = b && this.homeDoorOut(b);
      if (!o) { this.removeActor(a); return; }
      a.brain.leaveT = (a.brain.leaveT || 0) + dt;
      if (!a.goal) this.goTo(a, o[0], o[1], { force: true });
      a.dv = this.steer(a, 62, dt);
      const out = this.bldAt(a.x, a.y) !== a.home;
      if ((out && Math.hypot(o[0] - a.x, o[1] - a.y) < 20) || a.brain.leaveT > 40 || (out && !this.inView(a))) {
        // they walk off into the city as an ordinary passer-by
        a.resident = false; a.household = null; a.state = 'wander'; a.goal = null; a.path = null; a.home = -1;
        const hh = b.hh; if (hh) { const m = hh.members[a.member]; if (m && m.actor === a.id) m.actor = 0; }
      }
    },
    ai_arrive(a, dt) {
      const b = this.buildings[a.home]; if (!b) return this.ai_wander(a, dt);
      if (!a.goal) { const s = this.homeSpot(b, false); if (!s) { a.state = 'home'; return; } this.goTo(a, s.x, s.y, { force: true }); }
      a.dv = this.steer(a, 58, dt);
      if (a.arrived || (a.goal && Math.hypot(a.goal.x - a.x, a.goal.y - a.y) < 14)) { a.state = 'home'; a.goal = null; a.brain.waitT = 3; }
    },

    /** what you hear through a front door: tells you whether anybody is home (and awake) */
    householdSounds(b) {
      const hh = this.household(b), home = hh.members.filter((m) => !m.dead && this.residentHome(m));
      if (!home.length) return U.pick(['Stille. Kein Licht, kein Laut — scheint niemand da zu sein.', 'Nichts. Nur der Kühlschrank brummt.']);
      if (home.every((m) => this.residentAsleep(m))) return home.length > 1 ? 'Leises Schnarchen… mindestens zwei schlafen.' : 'Leises Schnarchen. Jemand schläft.';
      return U.pick(home.length > 1 ? ['Stimmen, ein Fernseher — da sind mehrere wach.', 'Geschirrklappern und Gelächter. Mehrere Leute zu Hause.'] : ['Schritte. Ein Radio läuft. Jemand ist zu Hause.', 'Der Fernseher läuft. Jemand ist wach.']);
    },
    /** phone › household info for a home you are standing in or looking at (used by the burglary hint) */
    householdInfo(b) {
      const hh = this.household(b);
      return hh.members.map((m) => ({ name: m.name, job: JOBNAME[m.job], home: !m.dead && this.residentHome(m), dead: m.dead, armed: m.armed }));
    },
  });
})(K);
