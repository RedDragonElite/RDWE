/* RDE // KONTRAKT — street criminals: muggers and shop robbers who live their own crime lives.
 * Victims and witnesses call it in, the police dispatch units against the robber (not you),
 * and stopping one is not a crime — it's a reward. */
(function (K) {
  'use strict';
  const tr = K.tr;   // translate (K.T is the tile table)
  const U = K.U, TILE = K.TILE;

  K.mixin({
    updateCriminals(dt) {
      this.thugT = (this.thugT == null ? 40 : this.thugT) - dt;
      if (this.thugT > 0) return;
      const night = this.isNight();
      this.thugT = (night ? 45 : 90) + Math.random() * 60;
      const live = this.actors.filter((a) => a.kind === 'thug' && a.alive && !a.removed).length;
      if (live < (night ? 3 : 2)) this.spawnThug();
    },
    spawnThug(plan) {
      const p = this.player;
      for (let k = 0; k < 150; k++) {
        const i = U.pick(this.city.walk), x = (i % this.W + 0.5) * TILE, y = (((i / this.W) | 0) + 0.5) * TILE;
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < 16 * TILE || d > 34 * TILE || (d < 26 * TILE && K.los(this, p.x, p.y, x, y))) continue;
        const gun = Math.random() < 0.35;
        const a = this.spawnActor('thug', x, y, { outfit: U.pick(['hoodie', 'leather', 'gang', 'civ5']), weapon: gun ? 'p9' : U.pick(['knife', 'bat', 'knife']), hp: 100, reserve: -1, state: 'prowl', female: Math.random() < 0.15, wallet: 20 + U.rint(60) });
        a.acc = 3.2; a.speedMul = 1.05;
        a.brain.plan = plan || (Math.random() < 0.6 ? 'mug' : 'shop');
        a.brain.giveUp = this.t + 150;
        return a;
      }
      return null;
    },
    /** an NPC committed a crime: witnesses flee and call it in, against the criminal */
    npcCrime(perp, type, victim) {
      perp.crim = true; perp.crimT = this.t;
      for (const n of this.near(perp.x, perp.y, 16 * TILE)) {
        if (n === perp || !n.alive || n.ko > 0 || n.inCar || n.kind === 'player' || n.kind === 'thug') continue;
        const saw = n === victim || this.sees(n, perp.x, perp.y, this.viewRange(n), 1.3);
        if (!saw) continue;
        if (n.kind === 'cop') { this.alarm(n, perp); continue; }
        if (n.kind === 'civ' || n.kind === 'keeper' || n.kind === 'staff') {
          if (n !== victim) this.flee(n, perp.x, perp.y, Math.random() < 0.5);
          if (!n.reportT) { n.reportT = 3 + Math.random() * 4; n.reportType = type; n.reportFoe = perp.id; n.reportX = perp.x; n.reportY = perp.y; }
        }
      }
      this.emit('npcCrime', { x: perp.x, y: perp.y, type });
    },

    // ------------------------------------------------------------ thug brain
    ai_prowl(a, dt) {
      if (this.t > a.brain.giveUp) { a.state = 'escape'; return; }
      const B = a.brain;
      if (B.plan === 'mug') {
        let v = B.victim && this.byId.get(B.victim);
        if (!v || !v.alive || v.ko > 0 || v.inCar || ['flee', 'cower'].includes(v.state)) {
          v = null; let bd = 26 * TILE;
          for (const c of this.near(a.x, a.y, 26 * TILE)) {
            if (c.kind !== 'civ' || !c.alive || c.ko > 0 || c.inCar || c.robbed || !['wander', 'idle'].includes(c.state)) continue;
            if (this.near(c.x, c.y, 10 * TILE).some((q) => q.kind === 'cop' && q.alive && !q.inCar)) continue;
            const d = Math.hypot(c.x - a.x, c.y - a.y); if (d < bd) { bd = d; v = c; }
          }
          B.victim = v ? v.id : 0;
          if (!v) { a.dv = this.steer(a, 60, dt); return; }
        }
        this.goTo(a, v.x, v.y, { tol: 30 });
        a.dv = this.steer(a, Math.hypot(v.x - a.x, v.y - a.y) < 6 * TILE ? 120 : 75, dt);
        if (Math.hypot(v.x - a.x, v.y - a.y) < 30) {
          a.state = 'mug'; B.t = 0; v.state = 'cower'; v.crouch = true; v.brain.cowerT = 5; v.brain.cowerBy = a.id; v.path = null;
          this.bark(a, U.pick([tr('Money! Now!'), tr('Wallet, quick!'), tr('Don’t move, hand it all over!')]), 2.2);
          this.bark(v, U.pick([tr('Please don’t!'), tr('Okay, okay…'), tr('Help…')]), 2);
          this.npcCrime(a, 'robbery', v);
        }
        return;
      }
      // shop hold-up
      let b = B.shop != null ? this.buildings[B.shop] : null;
      if (!b) {
        const cands = this.buildings.filter((q) => q.shop && q.counter && !['gun', 'black', 'hospital', 'bank'].includes(q.shop) && this.shopOpen(K.SHOPS[q.shop]) && q.tillDay !== this.today() && Math.hypot((q.x + q.w / 2) * TILE - a.x, (q.y + q.h / 2) * TILE - a.y) < 45 * TILE);
        if (!cands.length) { B.plan = 'mug'; return; }
        b = U.pick(cands); B.shop = b.id;
      }
      const c = b.counter, kp = b.keeperPos;
      const cx = (c.x + c.w / 2) * TILE, cy = (c.y + c.h / 2) * TILE;
      const fx = cx + (cx - (kp.x + 0.5) * TILE) * 1.2, fy = cy + (cy - (kp.y + 0.5) * TILE) * 1.2;
      this.goTo(a, fx, fy, { tol: 24 });
      a.dv = this.steer(a, 85, dt);
      if (Math.hypot(fx - a.x, fy - a.y) < 34) {
        const k = this.actors.find((q) => q.kind === 'keeper' && q.home === b.id && q.alive && q.ko <= 0);
        if (!k) { a.state = 'escape'; return; }
        a.state = 'holdup'; B.t = 0; B.keeper = k.id;
        k.state = 'cower'; k.crouch = true; k.brain.cowerT = 6; k.brain.cowerBy = a.id;
        this.bark(a, U.pick([tr('This is a robbery! Open the till!'), tr('Everything in the bag, move!')]), 2.4);
        this.bark(k, tr('Easy… easy…'), 2);
        this.npcCrime(a, 'robbery', k);
      }
    },
    ai_mug(a, dt) {
      const v = this.byId.get(a.brain.victim);
      a.brain.t += dt;
      if (v) { a.faceTo = Math.atan2(v.y - a.y, v.x - a.x); if (v.state === 'cower') v.brain.cowerT = Math.max(v.brain.cowerT, 1); }
      if (a.brain.t > 2.8) {
        if (v && v.alive) { a.wallet += v.wallet || 0; v.wallet = 0; v.robbed = true; this.flee(v, a.x, a.y, true); v.reportT = 2 + Math.random() * 3; v.reportType = 'robbery'; v.reportFoe = a.id; v.reportX = a.x; v.reportY = a.y; }
        this.bark(a, U.pick([tr('Thanks, sweetheart.'), tr('And not a word to the cops!')]), 1.8);
        a.state = 'escape';
      }
    },
    ai_holdup(a, dt) {
      const k = this.byId.get(a.brain.keeper), b = this.buildings[a.brain.shop];
      a.brain.t += dt;
      if (k) { a.faceTo = Math.atan2(k.y - a.y, k.x - a.x); if (k.state === 'cower') k.brain.cowerT = Math.max(k.brain.cowerT, 1); }
      if (a.brain.t > 4) {
        const loot = Math.round((K.SHOPS[b.shop].till || 400) * (0.6 + Math.random() * 0.5));
        a.wallet += loot; b.tillDay = this.today();
        this.dispatch(a.x, a.y, 2, { foe: a.id });   // silent alarm
        this.bark(a, tr('Have a nice day!'), 1.6);
        a.state = 'escape';
      }
    },
    ai_escape(a, dt) {
      if (!a.brain.ex) { const [x, y] = this.randomWalkNear(a, 24, 34); a.brain.ex = [x, y]; a.goal = null; a.crossOk = true; }
      this.goTo(a, a.brain.ex[0], a.brain.ex[1], { tol: 40 });
      a.dv = this.steer(a, 155, dt);
      if (a.crim && this.t - a.crimT > 90) a.crim = false;
      const p = this.player, d = Math.hypot(a.x - p.x, a.y - p.y);
      if (a.arrived) { a.brain.ex = null; if (d > 30 * TILE || !K.los(this, p.x, p.y, a.x, a.y)) { a.state = 'prowl'; a.brain.plan = Math.random() < 0.5 ? 'mug' : 'shop'; a.brain.victim = 0; a.brain.shop = null; a.brain.giveUp = this.t + 150; } }
      if (d > 45 * TILE && !a.crim) this.removeActor(a);
    },
    ai_cuffed(a, dt) {
      a.dv = [0, 0]; a.brain.t = (a.brain.t || 0) + dt;
      if (a.brain.t > 4) { this.removeActor(a); this.emit('notify', { text: tr('A robber was arrested and taken away.'), kind: 'good' }); }
    },
    /** a cop closing in on an unarmed robber cuffs instead of shooting */
    copCuffs(cop, t) {
      if (Math.hypot(t.x - cop.x, t.y - cop.y) > 32) return false;
      if (this.wdef(t).type === 'gun' && Math.random() < 0.5) return false;
      t.state = 'cuffed'; t.brain.t = 0; t.crim = false; t.vx = t.vy = 0;
      this.bark(cop, tr('Cuffs on! You’re under arrest.'), 2);
      this.bark(t, U.pick([tr('Okay, okay, I give up!'), tr('Shit…')]), 2);
      this.calmDown(cop);
      return true;
    },
    heroReward(t, src) {
      if (t.kind !== 'thug' || !t.crim || !src || src.kind !== 'player') return;
      t.crim = false;
      this.addXP(30, tr('Robber stopped'));
      this.emit('banner', { title: tr('STREET HERO'), sub: tr('You stopped a robber — the loot is on him.'), kind: 'gold' });
      for (const c of this.near(t.x, t.y, 10 * TILE)) if (c.kind === 'civ' && c.alive && Math.random() < 0.4) this.bark(c, U.pick([tr('Thank you!'), tr('Bravo!'), tr('Finally someone does something!')]), 2);
    },
  });
})(globalThis.K = globalThis.K || {});
