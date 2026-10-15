/* RDE // KONTRAKT — injuries & EMS (after rde_aimd, extended): every hit lands somewhere — head,
 * torso, an arm or a leg — with its own damage, bleeding and fracture odds. People who would die
 * often go down instead: lying, bleeding out (0–100 % blood loss), until a paramedic, a medic in
 * your crew or someone with a bandage gets there — or it's over. Witnesses call 112; ambulances
 * drive in from the clinic on the road network, the crew treats on scene and drives off again.
 * Same rules for you: [E] calls the ambulance, [X] gives up (clinic) after 20 s. */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE, W8 = K.WEAPONS, tr = K.tr;

  K.ZONES = {
    head:  { name: 'head', mult: 2.6, pmult: 1.5, bleed: 0.8 },
    torso: { name: 'torso', mult: 1, pmult: 1, bleed: 0.6, artery: 0.1 },
    armL:  { name: 'left arm', mult: 0.6, pmult: 0.6, bleed: 0.3, artery: 0.08, frac: 0.3, limb: true },
    armR:  { name: 'right arm', mult: 0.6, pmult: 0.6, bleed: 0.3, artery: 0.08, frac: 0.3, limb: true },
    legL:  { name: 'left leg', mult: 0.7, pmult: 0.7, bleed: 0.35, artery: 0.12, frac: 0.35, limb: true },
    legR:  { name: 'right leg', mult: 0.7, pmult: 0.7, bleed: 0.35, artery: 0.12, frac: 0.35, limb: true },
  };
  K.i18nData(K.ZONES);
  K.EMS = { base: 750, perKm: 50, treat: 10, giveUp: 20, bleedRate: [0.5, 1.6] };

  Object.assign(K.ITEMS, K.i18nData({
    tourniquet: { id: 'tourniquet', name: 'Tourniquet', e: '🩹', price: 90, w: 0.1, desc: 'Stops the bleeding on an arm or a leg instantly — even an artery.' },
    splint:     { id: 'splint', name: 'Splint', e: '🦴', price: 70, w: 0.3, desc: 'Stabilizes a fracture: no limping, a steady hand.' },
  }));
  K.ITEMS.bandage.desc = 'Stops light bleeding, +15 HP. [Hold E] on the wounded: first aid.';
  K.i18nData(K.ITEMS.bandage);
  K.SHOPS.pharmacy.items.push('tourniquet', 'splint');
  K.SHOPS.hospital.items.push('tourniquet', 'splint');
  K.OUTFITS.paramedic = K.i18nData({ name: 'Paramedic', body: '#e8452c', trim: '#f2f200', pants: '#c42a1e', role: 'medic', disguise: true });

  K.mixin({
    // ============================================================ hit zones
    hitZone(t, info) {
      if (info.zone) return info.zone;
      if (info.head) return 'head';
      const r = Math.random(), side = Math.random() < 0.5 ? 'L' : 'R';
      if (info.kind === 'bullet') return r < 0.55 ? 'torso' : r < 0.75 ? 'arm' + side : 'leg' + side;
      if (info.kind === 'car') return r < 0.55 ? 'leg' + side : 'torso';
      if (info.kind === 'explosion') return r < 0.6 ? 'torso' : 'leg' + side;
      if (info.sharp || info.kind === 'melee') return r < 0.6 ? 'torso' : r < 0.8 ? 'arm' + side : 'head';
      return 'torso';
    },
    zoneMult(t, zone) { const Z = K.ZONES[zone]; return Z ? (t.kind === 'player' ? Z.pmult : Z.mult) : 1; },
    /** wound bookkeeping: bleeding, arteries, fractures */
    applyInjury(t, zone, d, info) {
      const Z = K.ZONES[zone]; if (!Z || d <= 0) return;
      const I = t.inj || (t.inj = { wounds: {}, frac: {}, artery: null });
      I.wounds[zone] = Math.min(3, (I.wounds[zone] || 0) + 1);
      const pen = info.kind === 'bullet' || info.sharp || info.kind === 'explosion';
      if (pen) {
        let b = Z.bleed * U.clamp(d / 30, 0.4, 2);
        if (Z.artery && !I.artery && Math.random() < Z.artery * (d > 40 ? 1.6 : 1)) { I.artery = zone; b += 1.2; if (t.kind === 'player') this.notify(tr('Artery hit ({zone})! Tourniquet or medkit — fast.', { zone: Z.name }), 'bad'); }
        t.bleed = Math.min(4, (t.bleed || 0) + b);
      }
      const blunt = info.kind === 'car' || info.blunt || info.kind === 'explosion';
      if (Z.frac && !I.frac[zone] && ((pen && d >= 25) || (blunt && d >= 20)) && Math.random() < Z.frac * (blunt ? 1.4 : 1)) {
        I.frac[zone] = true;
        if (t.kind === 'player') this.notify(zone.startsWith('leg') ? tr("Your {zone} is broken — you're limping.", { zone: Z.name }) : tr('Your {zone} is broken — your hand is shaking.', { zone: Z.name }), 'bad');
        else if (zone.startsWith('arm')) t.acc = (t.acc || 2.2) * 1.6;
      }
      this.emit('wound', { id: t.id, zone, x: t.x, y: t.y });
    },
    limping(a) { return !!(a.inj && (a.inj.frac.legL || a.inj.frac.legR)); },
    shaky(a) { return !!(a.inj && (a.inj.frac.armL || a.inj.frac.armR)); },

    // ============================================================ going down
    /** critical instead of dead? (no for clean kills: big headshots, overkill, takedowns, poison) */
    shouldDown(t, d, info) {
      if (t.downed || info.takedown || info.silent || ['poison', 'wire', 'bleed', 'hunger', 'thirst'].includes(info.kind)) return false;
      if (t.kind === 'player' && this.godMode) return false;
      const over = -t.hp;
      if (info.head && d >= 35) return false;
      if (info.kind === 'explosion' && d > 150) return false;
      if (over > (t.kind === 'player' ? 80 : 45)) return false;
      if (t.inCar) return false;
      return t.kind === 'player' ? true : Math.random() < 0.7;
    },
    goDown(t, src, info) {
      const I = t.inj || { wounds: {}, frac: {} };
      const zone = Object.keys(I.wounds).sort((a, b) => (I.wounds[b] || 0) - (I.wounds[a] || 0))[0] || 'torso';
      const what = info.kind === 'bullet' ? tr('Gunshot wound') : info.kind === 'car' ? tr('Crash trauma') : info.kind === 'explosion' ? tr('Blast trauma') : info.sharp ? tr('Stab wound') : tr('Severe trauma');
      const [r0, r1] = K.EMS.bleedRate;
      t.hp = 1; t.flinch = 0;
      { const i = this.tileIdx(t.x, t.y); if (this.blockedTile(i, t)) { const f = this.nav.nearestFree(i, t, 3); if (f >= 0) { t.x = (f % this.W + 0.5) * TILE; t.y = (((f / this.W) | 0) + 0.5) * TILE; } } }
      t.downed = { loss: 0, rate: U.clamp(r0 + (t.bleed || 0) * 0.35 + (I.artery ? 0.4 : 0), r0, r1), t0: this.t, label: `${what} · ${K.ZONES[zone] ? K.ZONES[zone].name : ''}`, zone, stab: false, by: src ? src.id : 0 };
      t.koA = (info.dir != null ? info.dir : t.angle + Math.PI) + U.rnd(-0.4, 0.4);
      if (t.kind === 'player') {
        t.ko = 1e6; this.td = null; this.action = null; this.drag = null;
        if (t.inCar) this.exitCar(true);
        this.emit('playerDowned', { label: t.downed.label });
        this.emit('sfx', { s: 'heartbeat' });
        return;
      }
      t.ko = 1e6; t.state = 'ko'; t.path = null; t.vx *= 0.3; t.vy *= 0.3; t.susp = 0;
      this.emit('downed', { id: t.id, x: t.x, y: t.y });
      if (src && src.kind === 'crew' && this.crewKill) this.crewKill(src, t);   // putting someone down counts for your crew
      if (src && src.kind === 'player') { this.crimeEvent(src, t.kind === 'cop' ? 'assault' : 'assault', t.x, t.y, t); this.note('ko', { victim: t }); }
      // somebody who saw it phones for an ambulance
      for (const n of this.near(t.x, t.y, 16 * TILE)) {
        if (n === t || !n.alive || n.ko > 0 || n.kind === 'player' || n.inCar || n.kind === 'gang' || n.kind === 'thug') continue;
        if (!K.los(this, n.x, n.y, t.x, t.y)) continue;
        if (Math.random() < (n.kind === 'cop' ? 0.95 : 0.6)) { (this.emsCalls || (this.emsCalls = [])).push({ id: t.id, at: this.t + 5 + Math.random() * 8, by: n.id }); break; }
      }
    },
    revive(t, hpFrac = 0.35) {
      t.downed = null; t.ko = 0; t.hp = Math.max(t.hp, (t.maxHp || 100) * hpFrac); t.bleed = 0;
      if (t.inj) t.inj.artery = null;
      if (t.kind === 'player') { this.emit('playerRevived', {}); return; }
      t.state = 'wake'; t.brain.t = 0;
      this.bark(t, U.pick([tr('Thank you… thank you…'), tr('I\'m… still alive?'), tr('Get me out of here…')]), 2.2);
    },

    // ============================================================ every frame
    updateMedical(dt) {
      const p = this.player;
      // queued 112 calls
      if (this.emsCalls && this.emsCalls.length) this.emsCalls = this.emsCalls.filter((c) => {
        if (this.t < c.at) return true;
        const t = this.byId.get(c.id), by = this.byId.get(c.by);
        if (t && t.downed && (!by || (by.alive && by.ko <= 0))) { if (by) this.bark(by, U.pick([tr("911? Somebody's hurt here!"), tr('Quick, get an ambulance!'), tr("Emergency! Someone's bleeding badly!")]), 2.2); this.dispatchEMS(t, false); }
        return false;
      });
      for (const a of this.actors) {
        const D = a.downed; if (!D || !a.alive) continue;
        if (!D.stab) {
          const help = this.cars.some((c) => c.kind === 'ambulance' && c.unit && c.unit.ems === a.id && !c.dead);
          D.loss = Math.min(help ? 99 : 100, D.loss + D.rate * dt);   // rde_aimd: an ambulance on the way holds off death
          if (Math.random() < dt * (1.5 + D.rate)) this.emit('drip', { x: a.x + U.rnd(-6, 6), y: a.y + U.rnd(-6, 6) });
        } else if (a.kind !== 'player' && this.t - D.stabT > 25) { this.revive(a, 0.25); continue; }
        a.vx *= 0.8; a.vy *= 0.8;
        if (D.loss >= 100) {
          a.downed = null; a.ko = 0;
          this.kill(a, this.byId.get(a.lastHitBy) || null, { kind: 'bleed' });
        }
      }
      // a crew medic gets to you
      if (p.downed && this.crewActors) {
        for (const m of this.crewActors()) {
          if (!m.alive || m.ko > 0 || Math.hypot(m.x - p.x, m.y - p.y) > 8 * TILE) continue;
          const rec = this.crewMember ? this.crewMember(m.crewId) : null;
          if (rec && rec.kits > 0) { p.downed.crewT = (p.downed.crewT || 0) + dt; if (p.downed.crewT > 7) { rec.kits--; this.bark(m, tr("Hang in there, boss! I've got you."), 2); this.revive(p, 0.4); } }
          break;
        }
      }
      this.updateEMS(dt);
    },

    // ============================================================ player while down
    downedControls(inp, pr) {
      const p = this.player, D = p.downed;
      // crawl a little
      const mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), my = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
      if ((mx || my) && D.loss < 80) { const ang = Math.atan2(my, mx); this.moveActor(p, Math.cos(ang) * 16, Math.sin(ang) * 16, 1 / 60, 14); D.loss = Math.min(100, D.loss + 0.02); } else this.moveActor(p, 0, 0, 1 / 60, 14);
      const coming = this.cars.some((c) => c.kind === 'ambulance' && c.unit && c.unit.ems === p.id && !c.dead);
      this.ctx = [];
      if (!coming) this.ctx.push({ key: 'E', label: tr('Call an ambulance ({cost})', { cost: U.money(this.emsCost(p)) }) });
      if (this.t - D.t0 > K.EMS.giveUp) this.ctx.push({ key: 'X', label: tr('Give up → Clinic') });
      if (pr.e && !coming) this.callEMS();
      if (pr.x && this.t - D.t0 > K.EMS.giveUp) { p.downed = null; p.ko = 0; this.kill(p, null, { kind: 'bleed' }); }
    },
    emsCost(t) {
      const h = this.buildings.find((b) => b.type === 'hospital'); if (!h) return K.EMS.base;
      const km = Math.hypot((h.entrance.x + 0.5) * TILE - t.x, (h.entrance.y + 0.5) * TILE - t.y) / TILE * 1.4 / 1000;
      return Math.round(K.EMS.base + km * K.EMS.perKm * 10);
    },
    callEMS() {
      const p = this.player, cost = this.emsCost(p);
      const P = this.P;
      if (P.money + (P.bank || 0) < cost) { this.notify(tr('Not enough money for the ambulance.'), 'bad'); return false; }
      const fromBank = Math.max(0, cost - P.money); P.money -= cost - fromBank; P.bank -= fromBank;
      this.emit('sfx', { s: 'phone' });
      this.notify(tr('911 — ambulance on the way ({cost}).', { cost: U.money(cost) }), 'good');
      this.dispatchEMS(p, true);
      return true;
    },

    // ============================================================ ambulance
    dispatchEMS(t, paid) {
      if (this.cars.some((c) => c.kind === 'ambulance' && c.unit && c.unit.ems === t.id && !c.dead)) return null;
      const node = this.roadNodeFar(t.x, t.y, 22, 60) || this.roadNodeFar(t.x, t.y, 14, 90);
      if (!node) return null;
      const P_ = 26, LANE = 32, [i, j] = node, nb = this.roadNeighbors(i, j), [ni, nj] = U.pick(nb);
      const x0 = (i * P_ + 2) * TILE, y0 = (j * P_ + 2) * TILE, x1 = (ni * P_ + 2) * TILE, y1 = (nj * P_ + 2) * TILE;
      const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
      const c = this.spawnCar('ambulance', x0 + (x1 - x0) * 0.35 - dy * LANE, y0 + (y1 - y0) * 0.35 + dx * LANE, Math.atan2(dy, dx));
      c.ai = { fi: i, fj: j, ti: ni, tj: nj, stage: 'road', wp: null };
      c.unit = { mode: 'respond', dest: { x: t.x, y: t.y }, prio: 2, foe: 0, t0: this.t, crew: [], ems: t.id, paid: !!paid };
      c.siren = true; c.color = '#f4f4f0';
      for (let k = 0; k < 2; k++) {
        const m = this.spawnActor('medic', c.x, c.y, { outfit: 'paramedic', state: 'incar', female: Math.random() < 0.4, hp: 100 });
        m.inCar = c.id; m.unit = c.id; m.important = true; c.unit.crew.push(m.id);
      }
      c.driver = c.unit.crew[0]; c.passengers = c.unit.crew.slice(1);
      return c;
    },
    emsUnits() { return this.cars.filter((c) => c.kind === 'ambulance' && !c.dead && c.unit); },
    updateEMS(dt) {
      const p = this.player;
      for (const c of this.emsUnits()) {
        const u = c.unit, pt = this.byId.get(u.ems);
        for (const id of u.crew) { const a = this.byId.get(id); if (a && a.inCar === c.id) { a.x = c.x; a.y = c.y; a.angle = c.a; } }
        if (u.mode === 'respond') {
          if (!pt || !pt.alive || !pt.downed) { u.mode = 'leave'; c.siren = false; continue; }
          u.dest = { x: pt.x, y: pt.y };
          const d = Math.hypot(pt.x - c.x, pt.y - c.y);
          const atEnd = c.route && c.routeI >= c.route.length - 1 && c.speed < 30;
          if (d < 6 * TILE || (atEnd && d < 14 * TILE) || this.t - u.t0 > 140) {
            u.mode = 'onscene'; c.vx *= 0.3; c.vy *= 0.3; c.siren = false;
            if (d > 14 * TILE) { c.x = pt.x + 3 * TILE; c.y = pt.y; }   // gave up on the roads: arrive on foot range
            for (const id of u.crew) { const a = this.byId.get(id); if (!a || !a.alive) continue; this.ejectFrom(c, a, false); a.state = 'ems'; a.brain.ems = pt.id; a.brain.treat = 0; a.path = null; a.goal = null; }
            c.driver = null; c.passengers = [];
            this.emit('emsArrive', { x: c.x, y: c.y });
          }
        } else if (u.mode === 'onscene') {
          const alive = u.crew.map((id) => this.byId.get(id)).filter((a) => a && a.alive && !a.removed);
          const inside = alive.filter((a) => a.inCar === c.id);
          if (alive.length && inside.length === alive.length) { c.driver = inside[0].id; c.passengers = inside.slice(1).map((a) => a.id); u.mode = 'leave'; c.siren = false; }
          else if (!alive.length) { u.mode = 'abandoned'; }
        } else if (u.mode === 'leave') {
          if (Math.hypot(c.x - p.x, c.y - p.y) > 48 * TILE && !K.los(this, p.x, p.y, c.x, c.y)) this.despawnCar(c);
        }
      }
    },
    /** paramedics on foot: go to the patient, treat for 10 s, then back to the ambulance */
    ai_ems(a, dt) {
      const pt = this.byId.get(a.brain.ems), c = this.cars.find((q) => q.id === a.unit);
      if (!pt || !pt.alive || !pt.downed) { a.state = 'emsback'; a.goal = null; return; }
      const d = Math.hypot(pt.x - a.x, pt.y - a.y);
      a.brain.emsT = (a.brain.emsT || 0) + dt;
      if (d > 30 && !(a.brain.emsT > 20 && d < 2.5 * TILE)) {
        // last few metres straight to the patient (the path may end a tile short)
        if (d < 3 * TILE && K.los(this, a.x, a.y, pt.x, pt.y)) { const g = Math.atan2(pt.y - a.y, pt.x - a.x); a.dv = [Math.cos(g) * 110, Math.sin(g) * 110]; a.goal = null; a.path = null; }
        else { this.goTo(a, pt.x, pt.y, { tol: 22, force: true }); a.dv = this.steer(a, 140, dt); }
        return;
      }
      a.faceTo = Math.atan2(pt.y - a.y, pt.x - a.x); a.crouch = true;
      // only one of them does the compressions; both count
      const team = c ? c.unit.crew.map((id) => this.byId.get(id)).filter((q) => q && q.state === 'ems' && Math.hypot(q.x - pt.x, q.y - pt.y) <= 30).length : 1;
      a.brain.treat += dt / Math.max(1, team);
      pt.downed.loss = Math.max(0, pt.downed.loss - dt * 2);
      pt.treatK = Math.min(1, (pt.treatK || 0) + dt / K.EMS.treat / Math.max(1, team));
      if (pt.treatK >= 1) {
        pt.treatK = 0;
        this.revive(pt, pt.kind === 'player' ? 0.5 : 0.35);
        if (pt.kind === 'player') {
          const paid = c && c.unit.paid;
          if (!paid) { const bill = this.emsCost(pt); this.P.bank = (this.P.bank || 0) - bill; this.notify(tr('Ambulance bill: {bill} (from your account)', { bill: U.money(bill) }), 'bad'); }
          this.bark(a, tr('You got lucky. Go to the clinic, that wound needs stitches.'), 3);
        } else this.bark(a, tr("Patient's stable. We're taking him in."), 2);
        for (const id of c ? c.unit.crew : [a.id]) { const m = this.byId.get(id); if (m && m.alive) { m.state = 'emsback'; m.goal = null; m.crouch = false; } }
      }
    },
    ai_emsback(a, dt) {
      const c = this.cars.find((q) => q.id === a.unit && !q.dead);
      if (!c) { a.state = 'wander'; a.unit = 0; return; }
      a.crouch = false;
      this.goTo(a, c.x, c.y, { tol: 30 }); a.dv = this.steer(a, 110, dt);
      if (Math.hypot(c.x - a.x, c.y - a.y) < c.l / 2 + 18) { a.inCar = c.id; a.state = 'incar'; a.vx = a.vy = 0; }
    },

    // ============================================================ first aid by the player
    firstAidTarget() {
      const a = this.player; if (this.drag || a.inCar) return null;
      for (const t of this.near(a.x, a.y, 34)) if (t !== a && t.alive && t.downed && !t.downed.stab) return t;
      return null;
    },
    firstAid(t) {
      const P = this.P, kit = P.inv.medkit ? 'medkit' : P.inv.tourniquet && t.inj && t.inj.artery ? 'tourniquet' : P.inv.bandage ? 'bandage' : null;
      if (!kit || !t.downed) return;
      this.takeItem(kit);
      t.downed.stab = true; t.downed.stabT = this.t; t.bleed = 0;
      if (t.inj) t.inj.artery = null;
      this.emit('sfx', { s: 'heal' });
      this.bark(t, U.pick([tr('Thank you… thank you…'), tr('Stay with me…'), tr("I… can't feel my legs.")]), 2.4);
      this.notify(tr('{name} stabilized.', { name: t.name || tr('Casualty') }), 'good');
      if (t.kind !== 'cop' && t.kind !== 'gang') this.addXP(25, tr('Lifesaver'));
    },
    /** treatment items on yourself: bandage = light bleeding, tourniquet = limb/artery, splint = fracture */
    treatSelf(id) {
      const a = this.player, I = a.inj || (a.inj = { wounds: {}, frac: {}, artery: null });
      if (id === 'tourniquet') {
        if (!a.bleed && !I.artery) return this.notify(tr('No bleeding that needs a tourniquet.'), 'bad'), false;
        if (I.artery && !K.ZONES[I.artery].limb) return this.notify(tr("A tourniquet won't help on the torso — medkit or clinic!"), 'bad'), false;
        this.takeItem(id); I.artery = null; a.bleed = Math.max(0, a.bleed - 2.5); this.emit('sfx', { s: 'cloth' }); this.notify(tr('Tied off. The bleeding has stopped.'), 'good'); return true;
      }
      if (id === 'splint') {
        const z = Object.keys(I.frac).find((k) => I.frac[k]);
        if (!z) return this.notify(tr('Nothing broken.'), 'bad'), false;
        this.takeItem(id); I.frac[z] = false; this.emit('sfx', { s: 'cloth' }); this.notify(tr('Splinted your {zone}.', { zone: K.ZONES[z].name }), 'good'); return true;
      }
      return false;
    },
  });
})(globalThis.K = globalThis.K || {});
