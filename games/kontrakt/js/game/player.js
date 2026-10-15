/* RDE // KONTRAKT — player control: movement, weapons, driving, context interactions, bodies, lockpicking */
(function (K) {
  'use strict';
  const tr = K.tr;   // translate (K.T is the tile table)
  const U = K.U, T = K.T, TILE = K.TILE, W8 = K.WEAPONS;

  K.mixin({
    /** scoped rifles sway with your pulse; [Shift] holds the breath until the lungs give out */
    scopeSway(a, P, inp, dt) {
      const d = W8[this.curWeapon().id], sc = this.aiming && d && d.type === 'gun' && !P.handsDown ? d.scope | 0 : 0;
      if (P.breath == null) P.breath = 100;
      P.gasp = Math.max(0, (P.gasp || 0) - dt);
      const was = this.holdBreath;
      this.scoped = sc;
      this.holdBreath = !!(sc && inp.sprint && P.breath > 0 && P.gasp <= 0);
      if (this.holdBreath) { P.breath = Math.max(0, P.breath - dt * 20); if (P.breath <= 0) { P.gasp = 3.5; this.holdBreath = false; this.emit('sfx', { s: 'gasp' }); } }
      else P.breath = Math.min(100, P.breath + dt * (P.gasp > 0 ? 8 : 16));
      if (this.holdBreath && !was) this.emit('sfx', { s: 'breathIn' });
      if (!this.holdBreath && was && P.gasp <= 0) this.emit('sfx', { s: 'breathOut' });
      if (!sc) { this.swayX = this.swayY = 0; return; }
      this.swT = (this.swT || 0) + dt;
      const t = this.swT, dist = Math.hypot(this.aimX - a.x, this.aimY - a.y);
      const amp = (4 + dist * (sc === 2 ? 0.026 : 0.016))
        * (a.crouch ? 0.6 : 1) * (1 + Math.min(1.5, (a.speed || 0) / 60)) * (1 + P.drunk * 2)
        * (1 + Math.max(0, 60 - P.stamina) / 80) * (1 - this.sk('marksman') * 0.08)
        * (P.gasp > 0 ? 2.3 : this.holdBreath ? 0.1 : 1);
      const tx = (Math.sin(t * 1.27) + 0.45 * Math.sin(t * 2.91 + 1.3) + 0.2 * Math.sin(t * 7.3)) * amp * 0.7;
      const ty = (Math.sin(t * 1.63 + 2.1) * 0.8 + 0.4 * Math.cos(t * 3.37) + 0.2 * Math.sin(t * 6.1 + 0.5)) * amp * 0.7;
      const k = Math.min(1, dt * 8);
      this.swayX = (this.swayX || 0) + (tx - (this.swayX || 0)) * k; this.swayY = (this.swayY || 0) + (ty - (this.swayY || 0)) * k;
      this.aimX += this.swayX; this.aimY += this.swayY;
    },
    updatePlayer(dt, inp) {
      const a = this.player, P = this.P, pr = inp.pressed || {};
      this.aimX = inp.ax != null ? inp.ax : a.x + Math.cos(a.angle) * 100;
      this.aimY = inp.ay != null ? inp.ay : a.y + Math.sin(a.angle) * 100;
      this.aiming = !!inp.aim && !a.inCar && a.alive && !this.placing && !a.downed;
      this.scopeSway(a, P, inp, dt);
      P.recoil = Math.max(0, P.recoil - dt * 0.55);
      P.instinct = !!inp.instinct && a.alive;
      if (a.bark) { a.bark.t -= dt; if (a.bark.t <= 0) a.bark = null; }
      if (!a.alive) return;
      if (a.downed) { this.downedControls(inp, pr); return; }
      a.wi = this.curWeapon();
      this.tickWeapon(a, dt);
      const aimAng = Math.atan2(this.aimY - a.y, this.aimX - a.x);

      // -------------------------------------------------------- driving
      if (a.inCar) {
        const c = this.carOf(a);
        if (!c || c.dead) { a.inCar = null; return; }
        this.carInput = { thr: (inp.up ? 1 : 0) - (inp.down ? 1 : 0), steer: (inp.right ? 1 : 0) - (inp.left ? 1 : 0), hb: !!inp.space };
        a.x = c.x; a.y = c.y; a.vx = c.vx; a.vy = c.vy; a.angle = aimAng; a.speed = 0;
        if (pr.f) this.exitCar();
        if (pr.h && c.honk <= 0) { c.honk = 0.8; this.emit('honk', { x: c.x, y: c.y, player: true, horn: c.tune && c.tune.horn }); }
        if (c.kind === 'police' && pr.r) c.siren = !c.siren;
        const d = this.wdef(a);
        const carGun = this.driveControls ? this.driveControls(c, inp, pr) : false;
        if (!carGun && d.type === 'gun' && (d.cls === 'pistol' || d.cls === 'smg') && (inp.fire || pr.fire)) { a.aim = aimAng; this.attack(a, aimAng, inp.fire, pr.fire); }
        if (pr.reload && d.type === 'gun') this.reload(a);
        this.switchWeapons(inp, pr);
        if (c.fire > 0) { this.exitCar(true); this.hurt(a, 10, null, { kind: 'explosion' }); }
        this.ctx = [{ key: 'F', label: tr('Get out') }];
        if (this.carContext) this.carContext(c, (key, label, fn, hold, extra) => this.ctx.unshift({ key, label, fn, hold, ...extra }));
        if (pr.t) { const ac = this.ctx.find((o) => o.key === 'T' && o.fn); if (ac) ac.fn(); }
        return;
      }
      this.carInput = null;

      // -------------------------------------------------------- hidden in a container
      if (a.hidden) {
        a.vx = a.vy = 0; a.speed = 0;
        this.ctx = [{ key: 'E', label: tr('Come out'), fn: () => this.unhide() }];
        if (pr.e) this.unhide();
        return;
      }

      // -------------------------------------------------------- surrender
      if (pr.x) this.toggleSurrender();
      if (pr.v && this.crewActors && this.crewActors().length) this.crewCommand('attack');
      if (P.surrender) {
        if (inp.up || inp.down || inp.left || inp.right || pr.fire) this.cancelSurrender(true);
        else { this.moveActor(a, 0, 0, dt, 14); this.ctx = [{ key: 'X', label: tr('Take it back (resisting!)') }]; return; }
      }

      // -------------------------------------------------------- locked states
      if (a.stun > 0) { this.moveActor(a, 0, 0, dt, 6); this.ctx = []; return; }
      if (this.td) { this.updateTakedown(dt); a.vx *= 0.5; a.vy *= 0.5; this.ctx = []; return; }
      if (this.action) {
        const ac = this.action;
        const moving = inp.up || inp.down || inp.left || inp.right;
        if (moving || (ac.hold && !inp.eHeld && ac.key === 'E') || (ac.hold && !inp.tHeld && ac.key === 'T')) { this.action = null; this.emit('actionCancel', {}); }
        else {
          ac.t += dt;
          if (ac.tick) ac.tick(dt);
          if (ac.t >= ac.dur) { this.action = null; ac.done(); }
        }
        this.moveActor(a, 0, 0, dt, 14);
        a.angle = U.turnTo(a.angle, aimAng, dt * 12); a.aim = a.angle;
        return;
      }

      // -------------------------------------------------------- movement
      const mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), my = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
      if (pr.crouch) a.crouch = !a.crouch;
      a.sprint = !!inp.sprint && (mx || my) && P.stamina > 4 && !this.drag && !this.aiming;
      if (a.sprint) a.crouch = false;
      let sp = a.sprint ? 178 : a.crouch ? 58 : 98;
      if (a.slowT > 0) { a.slowT -= dt; sp *= 0.35; }
      if (this.drag) sp = 52;
      if (this.aiming) sp *= this.scoped ? 0.45 : 0.68;
      if (this.limping && this.limping(a)) { sp = Math.min(sp, 98) * 0.55; a.sprint = false; }
      const wd = W8[a.wi.id]; if (wd && wd.slow && !P.handsDown) sp *= wd.slow;
      if (P.energy < 12) sp *= 0.82;
      if (this.carried() > this.weightLimit()) sp *= 0.72;
      if (P.instinct) sp = Math.min(sp, 76);
      let mvx = 0, mvy = 0;
      if (mx || my) {
        let ang = Math.atan2(my, mx);
        if (P.drunk > 0.05) ang += Math.sin(this.t * 1.7) * P.drunk * 0.7;
        mvx = Math.cos(ang) * sp; mvy = Math.sin(ang) * sp;
      }
      this.moveActor(a, mvx, mvy, dt, 14);
      a.angle = U.turnTo(a.angle, aimAng, dt * 25); a.aim = a.angle;
      if (this.placing) { this.updatePlacing(inp, pr); this.ctx = []; return; }
      this.switchWeapons(inp, pr);
      if (pr.reload) this.reload(a);
      if (P.handsDown && P.slot === 0 && pr.fire) { P.handsDown = false; a.cool = Math.max(a.cool, 0.2); this.emit('equip', { w: 'fists' }); }   // first click raises the fists
      else if ((inp.fire || pr.fire) && !(P.handsDown && P.slot === 0)) this.attack(a, a.aim, inp.fire, pr.fire);
      if (pr.g) { if (!this.detonate()) this.notify(tr('No charges placed.'), 'bad'); }
      if (pr.l) { if (P.inv.flashlight) { P.flashlight = !P.flashlight; this.emit('sfx', { s: 'click' }); } else this.notify(tr('No flashlight.'), 'bad'); }
      this.updateDrag(dt);

      // -------------------------------------------------------- context
      this.ctx = this.focusContext(this.contextActions());
      const run = (act, auto) => {
        if (act.hold) this.action = { key: act.key, label: act.label, t: 0, dur: act.hold, hold: !auto && !act.auto, done: act.fn, tick: act.tick };
        else act.fn();
      };
      const tapE = () => this.ctx.find((c) => c.key === 'E' && !c.long && c.fn), longE = () => this.ctx.find((c) => c.key === 'E' && c.long && c.fn);
      // E: a tap and a long press are different actions (tap = pick up / search / use, hold = drag)
      if (this.ePend) {
        if (inp.eHeld) {
          this.ePend.t += dt;
          if (this.ePend.t >= K.HOLD_E) { this.ePend = null; const l = longE() || tapE(); if (l) run(l, !l.long); }
        } else { this.ePend = null; const t = tapE(); if (t) run(t, true); }
      } else if (pr.e) {
        if (longE() && inp.eHeld) this.ePend = { t: 0 };
        else { const t = tapE() || longE(); if (t) run(t, false); }
      }
      for (const k of ['t', 'f', 'k']) {
        if (!pr[k]) continue;
        const act = this.ctx.find((c) => c.key.toLowerCase() === k && c.fn);
        if (!act) continue;
        run(act, false);
        break;
      }
      // walk over cash
      for (const it of this.items) if (!it.taken && it.kind === 'cash' && Math.hypot(it.x - a.x, it.y - a.y) < 18) { it.taken = true; P.money += it.n; this.emit('sfx', { s: 'coins' }); this.notify(`+${U.money(it.n)}`, 'money'); }
    },
    switchWeapons(inp, pr) {
      const P = this.P, a = this.player;
      const set = (i) => { if (i === P.slot || i < 0 || i >= P.weapons.length) return; if (P.slot) P.last = P.slot; P.slot = i; a.reloadT = 0; a.reloading = false; a.wi = this.curWeapon(); a.cool = Math.max(a.cool, 0.25); this.emit('equip', { w: a.wi.id }); };
      void set;
      // hotbar: 1–9 use the slot (weapons toggle, items get used), 0 = fists, wheel cycles weapons
      if (inp.slot != null) { if (inp.slot < 0) this.equipWeapon('fists'); else this.hotbarUse(inp.slot); }
      if (inp.wheel) this.hotbarCycle(Math.sign(inp.wheel));
      // H: everything away (hands down) · again: draw the last weapon
      if (pr.holster) {
        if (P.slot || !P.handsDown) this.holsterAll();
        else if (P.last && P.weapons[P.last]) this.equipWeapon(P.weapons[P.last].id);
      }
    },

    // ------------------------------------------------------------ bodies
    nearestBody(r = 30) {
      const a = this.player; let best = null, bd = r;
      for (const b of this.near(a.x, a.y, r)) {
        if (b === a || b.hidden || b.dragBy || (b.alive && b.ko <= 0)) continue;
        const d = Math.hypot(b.x - a.x, b.y - a.y); if (d < bd) { bd = d; best = b; }
      }
      return best;
    },
    startDrag(b) {
      // the pool stays where the body lay; what comes along is only the smear
      if (!b.alive && b.bloody && b.pool > 0.05) {
        this.emit('poolStamp', { x: b.x, y: b.y, s: 8 + b.pool * 26, id: b.id });
        (b.poolSpots || (b.poolSpots = [])).push({ x: b.x, y: b.y });
        b.poolPeak = Math.max(b.poolPeak || 0, b.pool);
        b.poolCap = Math.max(0.15, (b.poolCap ?? 1) - b.pool * 0.75);   // most of the blood is already on the floor
        b.pool = 0;
      }
      this.drag = b.id; b.dragBy = this.player.id;
      this.emit('sfx', { s: 'grab' });
    },
    lootBody(b) {
      if (b.looted) return;
      b.looted = true;
      const P = this.P;
      const cash = b.wallet || 0;
      let found = false;
      if (cash) { P.money += cash; this.notify(tr('Emptied the pockets: +{cash}', { cash: U.money(cash) }), 'money'); found = true; }
      if (b.loot) { this.addItem(b.loot); this.notify(tr('Found: {item}', { item: K.ITEMS[b.loot].name }), 'loot'); found = true; }
      if (b.kind === 'guard' && Math.random() < 0.3) { this.addItem('keycard'); this.notify(tr('Found: {item}', { item: K.ITEMS.keycard ? K.ITEMS.keycard.name : 'Keycard' }), 'loot'); found = true; }
      if (!found) this.notify(tr('Nothing useful.'), 'info');
      this.emit('sfx', { s: 'pickup' });
      b.wallet = 0; b.loot = null;
    },
    dropDrag() {
      const b = this.byId.get(this.drag);
      if (b) b.dragBy = 0;
      this.drag = null;
    },
    updateDrag(dt) {
      if (!this.drag) return;
      const a = this.player, b = this.byId.get(this.drag);
      if (!b || b.hidden || (b.alive && b.ko <= 0)) { this.drag = null; if (b) b.dragBy = 0; return; }
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      if (d > 22) { b.x = a.x + dx / d * 22; b.y = a.y + dy / d * 22; }
      this.collide(b);
      b.deathA = Math.atan2(a.y - b.y, a.x - b.x) + Math.PI;
      if (b.ko > 0) b.koA = b.deathA;
      b.vx = b.vy = 0;
      // a fresh body still bleeds, an old one only leaves what had pooled under it
      const fresh = b.bloody && !b.alive ? U.clamp(1 - (b.deadT || 0) / 240, 0.25, 0.8) : 0, wet = Math.max(b.pool, b.poolPeak || 0, fresh);
      // a continuous streak behind the body: one segment every few pixels it is dragged
      if (b.smX == null) { b.smX = b.x; b.smY = b.y; }
      const seg = Math.hypot(b.x - b.smX, b.y - b.smY);
      if (seg >= 6) {
        if (wet > 0.2 && b.bloody) this.emit('smear', { x: b.x, y: b.y, px: b.smX, py: b.smY, k: Math.min(1, wet), a: Math.atan2(dy, dx) });
        b.smX = b.x; b.smY = b.y;
      }
      if (b.poolPeak) b.poolPeak = Math.max(0, b.poolPeak - dt * 0.015);   // the trail thins out the further you drag
    },
    hideSpot() {
      const a = this.player;
      let best = null, bd = 1.7 * TILE;
      const tx = (a.x / TILE) | 0, ty = (a.y / TILE) | 0;
      for (let j = ty - 2; j <= ty + 2; j++) for (let i = tx - 2; i <= tx + 2; i++) {
        if (i < 0 || j < 0 || i >= this.W || j >= this.H) continue;
        const pi = this.pmap[j * this.W + i]; if (pi < 0) continue;
        const p = this.props[pi]; if (!p || !K.PROPK[p.k].hide) continue;
        const cx = (p.x + p.w / 2) * TILE, cy = (p.y + p.h / 2) * TILE;
        const d = Math.hypot(cx - a.x, cy - a.y) - Math.max(p.w, p.h) * TILE / 2;
        if (d < bd && (p.bodies || 0) < 2) { bd = d; best = p; }
      }
      return best;
    },
    propNear(kinds, r = 1.3) {
      const a = this.player;
      const tx = (a.x / TILE) | 0, ty = (a.y / TILE) | 0;
      let best = null, bd = r * TILE;
      for (let j = ty - 2; j <= ty + 2; j++) for (let i = tx - 2; i <= tx + 2; i++) {
        if (i < 0 || j < 0 || i >= this.W || j >= this.H) continue;
        const pi = this.pmap[j * this.W + i]; if (pi < 0) continue;
        const p = this.props[pi]; if (!p || p.gone || !kinds.includes(p.k)) continue;
        const cx = U.clamp(a.x, p.x * TILE, (p.x + p.w) * TILE), cy = U.clamp(a.y, p.y * TILE, (p.y + p.h) * TILE);
        const d = Math.hypot(cx - a.x, cy - a.y);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    },
    lockedDoorNear() {
      const a = this.player;
      const tx = (a.x / TILE) | 0, ty = (a.y / TILE) | 0;
      for (let j = ty - 1; j <= ty + 1; j++) for (let i = tx - 1; i <= tx + 1; i++) {
        const d = this.doors.get(j * this.W + i);
        if (d && d.locked && !this.hasAccess(a, d) && Math.hypot((i + 0.5) * TILE - a.x, (j + 0.5) * TILE - a.y) < TILE * 1.3) return d;
      }
      return null;
    },

    // ------------------------------------------------------------ context actions
    /** among E actions on things around you, the one you are looking at comes first; flags timed
     *  E actions as auto-running when a long press means something else */
    focusContext(out) {
      const a = this.player, ids = [], acts = [];
      out.forEach((c, i) => { if (c.key === 'E' && c.at && !c.long) { ids.push(i); acts.push(c); } });
      if (acts.length > 1) {
        const score = (c) => { const d = Math.hypot(c.at.x - a.x, c.at.y - a.y); return Math.abs(U.angDiff(a.aim, Math.atan2(c.at.y - a.y, c.at.x - a.x))) * (d > 8 ? 1 : 0) * 1.4 + d / 30; };
        acts.sort((p, q) => score(p) - score(q));
        ids.forEach((i, k) => (out[i] = acts[k]));
      }
      if (out.some((c) => c.key === 'E' && c.long)) for (const c of out) if (c.key === 'E' && c.hold && !c.long) c.auto = true;
      return out;
    },
    contextActions() {
      const out = [], a = this.player, P = this.P;
      const add = (key, label, fn, hold, extra) => out.push({ key, label, fn, hold, ...extra });
      if (this.underworldContext(add)) return out;
      // bodies
      if (this.drag) {
        const spot = this.hideSpot();
        if (spot) add('E', tr('Hide the body ({spot})', { spot: { dumpster: tr('Dumpster'), wardrobe: tr('Closet'), locker: tr('Locker') }[spot.k] || tr('Hiding spot') }), () => this.hideBody(spot), 1.1);
        else add('E', tr('Let go'), () => this.dropDrag());
      } else {
        // first aid on somebody critical (needs a bandage, tourniquet or medkit) — the long press on them
        const fa = this.firstAidTarget && this.firstAidTarget();
        if (fa && (P.inv.medkit || P.inv.bandage || P.inv.tourniquet)) add('E', tr('First aid: {name} ({loss}% blood loss)', { name: fa.name || tr('Injured'), loss: Math.round(fa.downed.loss) }), () => this.firstAid(fa), 3.5, { long: true, at: fa });
        // ground items next to you: tap E, the one you look at first
        const its = this.items.filter((x) => !x.taken && Math.hypot(x.x - a.x, x.y - a.y) < 30).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y)).slice(0, 3);
        for (const it of its) add('E', tr('Pick up: {item}', { item: this.itemLabel(it) }), () => this.pickup(it), 0, { at: it });
        const b = this.nearestBody();
        if (b) {
          if (!b.looted) add('E', b.alive ? tr('Search the unconscious') : tr('Search the body'), () => this.lootBody(b), 0.9, { at: b, tick: () => { if (b.dragBy || b.hidden) this.action = null; } });
          if (!fa || fa !== b) add('E', b.alive ? tr('Drag the unconscious') : tr('Drag the body'), () => this.startDrag(b), 0, { long: true, at: b });
          if (!b.stripped && b.outfit !== P.outfit && K.OUTFITS[b.outfit]) add('T', tr('Disguise: {outfit}', { outfit: K.OUTFITS[b.outfit].name || tr('Clothes') }), () => this.takeDisguise(b), 1.4);
        }
        if (fa && (P.inv.medkit || P.inv.bandage || P.inv.tourniquet)) return out;
      }
      // doors
      const door = !this.drag && this.lockedDoorNear();
      if (door && !door.vault) {
        const hasPick = P.inv.lockpick > 0, hasBar = P.weapons.some((w) => w.id === 'crowbar');
        const b = this.buildings[door.bld];
        if (door.access && door.access.includes('owner') && b && !b.owned) add('E', tr('Locked — property for sale'), null);
        else if (hasPick || hasBar) add('E', hasBar && !hasPick ? tr('Pry the door open (crowbar)') : tr('Pick the lock'), () => this.pickDoor(door, !hasPick), hasPick ? 2.6 : 1.3, { tick: hasBar && !hasPick ? (dt) => { if (Math.random() < dt * 3) this.noise(a.x, a.y, 5, 'scuffle', a); } : null });
        else add('E', tr('Locked — needs a lockpick'), null);
        if (b && this.privateBuilding(b) && this.householdSounds) add('T', tr('Listen at the door'), () => this.notify(this.householdSounds(b), 'info'), 1.6);
      }
      // hide yourself
      if (!this.drag && this.hideSpotNearPlayer) {
        const hs = this.hideSpotNearPlayer();
        if (hs) add('T', tr('Hide ({spot})', { spot: { dumpster: tr('Dumpster'), wardrobe: tr('Closet'), locker: tr('Locker') }[hs.k] }), () => this.hideIn(hs), 0.6);
      }
      // props
      if (!this.drag) {
        const p = this.propNear(['counter', 'barc', 'safe', 'wardrobe', 'bed', 'vending', 'sign'], 1.25);
        if (p) {
          const b = p.bld >= 0 ? this.buildings[p.bld] : null;
          if (p.k === 'sign') {
            const d = this.propertyDef(p.property);
            if (d && !P.owned.includes(d.id)) add('E', tr('Property: {name} — {price}', { name: d.name, price: U.money(d.price) }), () => this.emit('ui', { open: 'property', id: d.id }));
          } else if (p.k === 'vending') add('E', tr('Vending machine: Cola ($3)'), () => { if (!this.pay(3)) return this.notify(tr('No change.'), 'bad'); this.addItem('cola'); this.emit('sfx', { s: 'vend' }); this.notify(tr('Got a cola.')); });
          else if ((p.k === 'counter' || p.k === 'barc') && b && b.shop && b.counter === p) {
            const s = K.SHOPS[b.shop];
            const keeper = this.actors.find((k) => k.kind === 'keeper' && k.home === b.id && k.alive && k.ko <= 0 && k.state === 'work' && Math.hypot(k.x - k.brain.post.x, k.y - k.brain.post.y) < 40);
            if (!this.shopOpen(s)) add('E', tr('{shop} — closed (opens {h}:00)', { shop: s.name, h: s.open[0] }), null);
            else if (!keeper) { if (!out.some((o) => o.label === tr('Empty the till') || o.label === tr('The till is empty'))) add('E', tr('{shop} — nobody here', { shop: s.name }), null); }
            else if (s.cars) add('E', tr('Dealership: catalog & purchase'), () => { this.emit('ui', { open: 'dealer' }); this.bark(keeper, tr('Looking for something fast? Or something discreet?'), 2.4); });
            else if (s.bank) add('E', tr('Bank counter: account'), () => { this.emit('ui', { open: 'bank' }); this.bark(keeper, tr('Good day, how can I help you?'), 2); });
            else add('E', b.shop === 'hospital' ? tr('Clinic: treatment & medicine') : tr('Shop: {shop}', { shop: s.name }), () => { this.emit('ui', { open: 'shop', shop: b.shop, b: b.id }); this.bark(keeper, U.pick(K.LINES.keeper), 2); });
          } else if (p.k === 'safe' && b) {
            if (b.owned) add('E', tr('Armory & storage'), () => this.emit('ui', { open: 'stash', prop: b.property }));
            else if (b.loot > 0) { if (P.inv.lockpick > 0) add('E', tr('Crack the safe'), () => this.crackSafe(b), 4.2, { tick: () => {} }); else add('E', tr('Safe — needs a lockpick'), null); }
          } else if (p.k === 'wardrobe' && b && b.owned) add('E', tr('Wardrobe'), () => this.emit('ui', { open: 'wardrobe' }));
          else if (p.k === 'bed' && b && b.owned) add('E', tr('Sleep & save'), () => { if (this.wanted > 0) return this.notify(tr('Not with the cops on your tail.'), 'bad'); this.emit('ui', { open: 'sleep', prop: b.property }); });
        }
      }
      // cars & takedowns
      if (!this.drag) {
        const t = this.takedownTarget();
        if (t) {
          const d = W8[this.curWeapon().id];
          const label = d.type === 'wire' ? tr('Strangle (fiber wire)') : d.sharp ? tr('Knife takedown') : d.type === 'syringe' ? (d.lethal ? tr('Inject poison') : tr('Sedate (syringe)')) : t.ko > 0 ? null : tr('Chokehold (knock out)');
          if (label) add('F', label, () => this.tryTakedown());
        }
        const c = this.carNear(a);
        if (c && !out.some((o) => o.key === 'F')) add('F', c.driver && c.driver !== 'player' ? (c.kind === 'police' ? tr('Hijack the police car') : tr('Steal the car')) : tr('Get in'), () => this.enterCar(c));
      }
      return out;
    },
    itemLabel(it) {
      if (it.kind === 'weapon') return W8[it.wid].name + (it.mag != null && W8[it.wid].type === 'gun' ? ` (${it.mag})` : '');
      if (it.kind === 'ammo') return `${K.AMMO[it.cal].name} ×${it.n}`;
      if (it.kind === 'cash') return U.money(it.n);
      return K.ITEMS[it.item] ? K.ITEMS[it.item].name : '?';
    },
    pickup(it) {
      it.taken = true;
      if (it.kind === 'weapon') {
        const d = W8[it.wid];
        const w = this.addWeapon(it.wid, { mag: it.mag, sup: it.sup });
        if (w) { this.notify(tr('Picked up: {item}', { item: d.name }), 'loot'); }
        else if (d.type !== 'gun') { it.taken = false; return; }
      } else if (it.kind === 'ammo') this.P.ammo[it.cal] = (this.P.ammo[it.cal] || 0) + it.n;
      else if (it.kind === 'cash') this.P.money += it.n;
      else this.addItem(it.item);
      this.emit('sfx', { s: 'pickup' });
    },
    hideBody(spot) {
      const b = this.byId.get(this.drag);
      if (!b) return;
      b.hidden = true; b.dragBy = 0; this.drag = null; b.hiddenSpot = spot.id;
      spot.bodies = (spot.bodies || 0) + 1;
      this.emit('hideBody', { x: (spot.x + spot.w / 2) * TILE, y: (spot.y + spot.h / 2) * TILE, k: spot.k });
      this.addXP(15, tr('Body hidden'));
      this.note('hid', {});
    },
    takeDisguise(b) {
      if (b.stripped) return;
      const o = b.outfit;
      if (!b.looted) this.lootBody(b);
      b.stripped = true; b.outfit = 'under';
      this.setOutfit(o, true);
      this.emit('banner', { title: K.OUTFITS[o].name.toUpperCase(), sub: K.OUTFITS[o].disguise ? tr('Disguise on') : tr('Changed clothes'), kind: 'disguise' });
      this.emit('sfx', { s: 'cloth' });
      this.crimeEvent(this.player, b.alive ? 'assault' : 'murder', b.x, b.y, null);
    },
    pickDoor(d, force) {
      d.locked = false; d.picked = true;
      this.emit('sfx', { s: force ? 'crowbar' : 'unlock' });
      if (force) this.noise(this.player.x, this.player.y, 7, 'scuffle', this.player);
      const b = this.buildings[d.bld];
      if (b && (this.privateBuilding(b) || b.zone != null)) this.crimeEvent(this.player, 'burglary', d.x * TILE, d.y * TILE, null);
      this.addXP(8, tr('Lock picked'));
    },
    crackSafe(b) {
      const cash = b.loot; b.loot = 0;
      this.P.money += cash;
      if (Math.random() < 0.35) this.addItem('watch');
      this.emit('sfx', { s: 'safe' });
      this.notify(tr('Safe cracked: +{cash}', { cash: U.money(cash) }), 'money');
      this.crimeEvent(this.player, 'burglary', this.player.x, this.player.y, null);
      this.addXP(30, tr('Burglary'));
    },
  });
})(globalThis.K = globalThis.K || {});
