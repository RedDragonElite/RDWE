/* RDE // KONTRAKT — player control: movement, weapons, driving, context interactions, bodies, lockpicking */
(function (K) {
  'use strict';
  const U = K.U, T = K.T, TILE = K.TILE, W8 = K.WEAPONS;

  K.mixin({
    updatePlayer(dt, inp) {
      const a = this.player, P = this.P, pr = inp.pressed || {};
      this.aimX = inp.ax != null ? inp.ax : a.x + Math.cos(a.angle) * 100;
      this.aimY = inp.ay != null ? inp.ay : a.y + Math.sin(a.angle) * 100;
      this.aiming = !!inp.aim && !a.inCar && a.alive;
      P.recoil = Math.max(0, P.recoil - dt * 0.55);
      P.instinct = !!inp.instinct && a.alive;
      if (a.bark) { a.bark.t -= dt; if (a.bark.t <= 0) a.bark = null; }
      if (!a.alive) return;
      a.wi = this.curWeapon();
      this.tickWeapon(a, dt);
      const aimAng = Math.atan2(this.aimY - a.y, this.aimX - a.x);

      // -------------------------------------------------------- driving
      if (a.inCar) {
        const c = this.carOf(a);
        if (!c || c.dead) { a.inCar = null; return; }
        this.carInput = { thr: (inp.up ? 1 : 0) - (inp.down ? 1 : 0), steer: (inp.right ? 1 : 0) - (inp.left ? 1 : 0), hb: !!inp.space };
        a.x = c.x; a.y = c.y; a.vx = c.vx; a.vy = c.vy; a.angle = aimAng; a.speed = 0;
        if (pr.f || pr.e) this.exitCar();
        if (pr.h && c.honk <= 0) { c.honk = 0.8; this.emit('honk', { x: c.x, y: c.y, player: true }); }
        if (c.kind === 'police' && pr.r) c.siren = !c.siren;
        const d = this.wdef(a);
        if (d.type === 'gun' && (d.cls === 'pistol' || d.cls === 'smg') && (inp.fire || pr.fire)) { a.aim = aimAng; this.attack(a, aimAng, inp.fire, pr.fire); }
        if (pr.reload && d.type === 'gun') this.reload(a);
        this.switchWeapons(inp, pr);
        if (c.fire > 0) { this.exitCar(true); this.hurt(a, 10, null, { kind: 'explosion' }); }
        this.ctx = [{ key: 'F', label: 'Aussteigen' }];
        return;
      }
      this.carInput = null;

      // -------------------------------------------------------- surrender
      if (pr.x) this.toggleSurrender();
      if (P.surrender) {
        if (inp.up || inp.down || inp.left || inp.right || pr.fire) this.cancelSurrender(true);
        else { this.moveActor(a, 0, 0, dt, 14); this.ctx = [{ key: 'X', label: 'Doch nicht ergeben (Widerstand!)' }]; return; }
      }

      // -------------------------------------------------------- locked states
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
      if (this.drag) sp = 52;
      if (this.aiming) sp *= 0.68;
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
      this.switchWeapons(inp, pr);
      if (pr.reload) this.reload(a);
      if (inp.fire || pr.fire) this.attack(a, a.aim, inp.fire, pr.fire);
      if (pr.g) { if (!this.detonate()) this.notify('Keine Sprengladung platziert.', 'bad'); }
      if (pr.l) { if (P.inv.flashlight) { P.flashlight = !P.flashlight; this.emit('sfx', { s: 'click' }); } else this.notify('Keine Taschenlampe.', 'bad'); }
      this.updateDrag(dt);

      // -------------------------------------------------------- context
      this.ctx = this.contextActions();
      for (const k of ['e', 't', 'f', 'k']) {
        if (!pr[k]) continue;
        const act = this.ctx.find((c) => c.key.toLowerCase() === k && c.fn);
        if (!act) continue;
        if (act.hold) this.action = { key: act.key, label: act.label, t: 0, dur: act.hold, hold: true, done: act.fn, tick: act.tick };
        else act.fn();
        break;
      }
      // walk over cash
      for (const it of this.items) if (!it.taken && it.kind === 'cash' && Math.hypot(it.x - a.x, it.y - a.y) < 18) { it.taken = true; P.money += it.n; this.emit('sfx', { s: 'coins' }); this.notify(`+${U.money(it.n)}`, 'money'); }
    },
    switchWeapons(inp, pr) {
      const P = this.P, a = this.player;
      const set = (i) => { if (i === P.slot || i < 0 || i >= P.weapons.length) return; if (P.slot) P.last = P.slot; P.slot = i; a.reloadT = 0; a.reloading = false; a.wi = this.curWeapon(); a.cool = Math.max(a.cool, 0.25); this.emit('equip', { w: a.wi.id }); };
      if (inp.slot != null) set(inp.slot);
      if (inp.wheel) set((P.slot + inp.wheel + P.weapons.length) % P.weapons.length);
      if (pr.holster) set(P.slot ? 0 : P.last || 1);
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
      this.drag = b.id; b.dragBy = this.player.id;
      if (!b.looted) this.lootBody(b);
      this.emit('sfx', { s: 'grab' });
    },
    lootBody(b) {
      b.looted = true;
      const P = this.P;
      const cash = b.wallet || 0;
      if (cash) { P.money += cash; this.notify(`Taschen geleert: +${U.money(cash)}`, 'money'); }
      if (b.loot) { this.addItem(b.loot); this.notify(`Gefunden: ${K.ITEMS[b.loot].name}`, 'loot'); }
      if (b.kind === 'guard' && Math.random() < 0.3) { this.addItem('keycard'); }
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
      if (b.pool > 0.3 && Math.random() < dt * 6 && b.bloody) this.emit('smear', { x: b.x, y: b.y, a: Math.atan2(dy, dx) });
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
    contextActions() {
      const out = [], a = this.player, P = this.P;
      const add = (key, label, fn, hold, extra) => out.push({ key, label, fn, hold, ...extra });
      if (this.underworldContext(add)) return out;
      // bodies
      if (this.drag) {
        const spot = this.hideSpot();
        if (spot) add('E', `Leiche verstecken (${{ dumpster: 'Container', wardrobe: 'Schrank', locker: 'Spind' }[spot.k] || 'Versteck'})`, () => this.hideBody(spot), 1.1);
        else add('E', 'Loslassen', () => this.dropDrag());
      } else {
        const b = this.nearestBody();
        if (b) {
          add('E', b.alive ? 'Bewusstlosen ziehen' : 'Leiche ziehen', () => this.startDrag(b));
          if (!b.stripped && b.outfit !== P.outfit && K.OUTFITS[b.outfit]) add('T', `Verkleiden: ${K.OUTFITS[b.outfit].name || 'Kleidung'}`, () => this.takeDisguise(b), 1.4);
        }
      }
      // ground items
      if (!this.drag) {
        let it = null, bd = 26;
        for (const x of this.items) { if (x.taken) continue; const d = Math.hypot(x.x - a.x, x.y - a.y); if (d < bd) { bd = d; it = x; } }
        if (it) add('E', `Aufheben: ${this.itemLabel(it)}`, () => this.pickup(it));
      }
      // doors
      const door = !this.drag && this.lockedDoorNear();
      if (door) {
        const hasPick = P.inv.lockpick > 0, hasBar = P.weapons.some((w) => w.id === 'crowbar');
        const b = this.buildings[door.bld];
        if (door.access && door.access.includes('owner') && b && !b.owned) add('E', 'Verschlossen — Immobilie zu verkaufen', null);
        else if (hasPick || hasBar) add('E', hasBar && !hasPick ? 'Tür aufbrechen (Brecheisen)' : 'Schloss knacken', () => this.pickDoor(door, !hasPick), hasPick ? 2.6 : 1.3, { tick: hasBar && !hasPick ? (dt) => { if (Math.random() < dt * 3) this.noise(a.x, a.y, 5, 'scuffle', a); } : null });
        else add('E', 'Verschlossen — Dietrich nötig', null);
      }
      // props
      if (!this.drag) {
        const p = this.propNear(['counter', 'barc', 'safe', 'wardrobe', 'bed', 'vending', 'sign'], 1.25);
        if (p) {
          const b = p.bld >= 0 ? this.buildings[p.bld] : null;
          if (p.k === 'sign') {
            const d = this.propertyDef(p.property);
            if (d && !P.owned.includes(d.id)) add('E', `Immobilie: ${d.name} — ${U.money(d.price)}`, () => this.emit('ui', { open: 'property', id: d.id }));
          } else if (p.k === 'vending') add('E', 'Automat: Cola ($3)', () => { if (!this.pay(3)) return this.notify('Kein Kleingeld.', 'bad'); this.addItem('cola'); this.emit('sfx', { s: 'vend' }); this.notify('Cola gezogen.'); });
          else if ((p.k === 'counter' || p.k === 'barc') && b && b.shop && b.counter === p) {
            const s = K.SHOPS[b.shop];
            const keeper = this.actors.find((k) => k.kind === 'keeper' && k.home === b.id && k.alive && k.ko <= 0 && k.state === 'work' && Math.hypot(k.x - k.brain.post.x, k.y - k.brain.post.y) < 40);
            if (!this.shopOpen(s)) add('E', `${s.name} — geschlossen (öffnet ${s.open[0]}:00)`, null);
            else if (!keeper) { if (!out.some((o) => o.label === 'Kasse ausräumen' || o.label === 'Kasse ist leer')) add('E', `${s.name} — niemand da`, null); }
            else add('E', b.shop === 'hospital' ? 'Klinik: Behandlung & Medizin' : `Einkaufen: ${s.name}`, () => { this.emit('ui', { open: 'shop', shop: b.shop, b: b.id }); this.bark(keeper, U.pick(K.LINES.keeper), 2); });
          } else if (p.k === 'safe' && b) {
            if (b.owned) add('E', 'Waffenkammer & Lager', () => this.emit('ui', { open: 'stash', prop: b.property }));
            else if (b.loot > 0) { if (P.inv.lockpick > 0) add('E', 'Tresor knacken', () => this.crackSafe(b), 4.2, { tick: () => {} }); else add('E', 'Tresor — Dietrich nötig', null); }
          } else if (p.k === 'wardrobe' && b && b.owned) add('E', 'Kleiderschrank', () => this.emit('ui', { open: 'wardrobe' }));
          else if (p.k === 'bed' && b && b.owned) add('E', 'Schlafen & speichern', () => { if (this.wanted > 0) return this.notify('Nicht mit der Polizei auf den Fersen.', 'bad'); this.emit('ui', { open: 'sleep', prop: b.property }); });
        }
      }
      // cars & takedowns
      if (!this.drag) {
        const t = this.takedownTarget();
        if (t) {
          const d = W8[this.curWeapon().id];
          const label = d.type === 'wire' ? 'Erdrosseln (Klaviersaite)' : d.sharp ? 'Messer-Takedown' : d.type === 'syringe' ? (d.lethal ? 'Giftspritze setzen' : 'Betäuben (Spritze)') : t.ko > 0 ? null : 'Würgegriff (bewusstlos)';
          if (label) add('F', label, () => this.tryTakedown());
        }
        const c = this.carNear(a);
        if (c && !out.some((o) => o.key === 'F')) add('F', c.driver && c.driver !== 'player' ? (c.kind === 'police' ? 'Polizeiwagen kapern' : 'Auto klauen') : 'Einsteigen', () => this.enterCar(c));
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
        if (w) { this.notify(`Aufgenommen: ${d.name}`, 'loot'); }
        else if (d.type !== 'gun') { it.taken = false; return; }
      } else if (it.kind === 'ammo') this.P.ammo[it.cal] = (this.P.ammo[it.cal] || 0) + it.n;
      else if (it.kind === 'cash') this.P.money += it.n;
      else this.addItem(it.item);
      this.emit('sfx', { s: 'pickup' });
    },
    hideBody(spot) {
      const b = this.byId.get(this.drag);
      if (!b) return;
      b.hidden = true; b.dragBy = 0; this.drag = null;
      spot.bodies = (spot.bodies || 0) + 1;
      this.emit('hideBody', { x: (spot.x + spot.w / 2) * TILE, y: (spot.y + spot.h / 2) * TILE, k: spot.k });
      this.addXP(15, 'Leiche versteckt');
      this.note('hid', {});
    },
    takeDisguise(b) {
      if (b.stripped) return;
      const o = b.outfit;
      if (!b.looted) this.lootBody(b);
      b.stripped = true; b.outfit = 'under';
      this.setOutfit(o, true);
      this.emit('banner', { title: K.OUTFITS[o].name.toUpperCase(), sub: K.OUTFITS[o].disguise ? 'Verkleidung angelegt' : 'Kleidung gewechselt', kind: 'disguise' });
      this.emit('sfx', { s: 'cloth' });
      this.crimeEvent(this.player, b.alive ? 'assault' : 'murder', b.x, b.y, null);
    },
    pickDoor(d, force) {
      d.locked = false; d.picked = true;
      this.emit('sfx', { s: force ? 'crowbar' : 'unlock' });
      if (force) this.noise(this.player.x, this.player.y, 7, 'scuffle', this.player);
      const b = this.buildings[d.bld];
      if (b && (this.privateBuilding(b) || b.zone != null)) this.crimeEvent(this.player, 'burglary', d.x * TILE, d.y * TILE, null);
      this.addXP(8, 'Schloss geknackt');
    },
    crackSafe(b) {
      const cash = b.loot; b.loot = 0;
      this.P.money += cash;
      if (Math.random() < 0.35) this.addItem('watch');
      this.emit('sfx', { s: 'safe' });
      this.notify(`Tresor geknackt: +${U.money(cash)}`, 'money');
      this.crimeEvent(this.player, 'burglary', this.player.x, this.player.y, null);
      this.addXP(30, 'Einbruch');
    },
  });
})(globalThis.K = globalThis.K || {});
