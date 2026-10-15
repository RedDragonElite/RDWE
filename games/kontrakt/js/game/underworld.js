/* RDE // KONTRAKT — underworld: charges & jail, surrender, mask, bank & ATMs, pickpocketing, hold-ups,
 * shop robberies, house searches, growing & dealing. A mixin like the rest of the sim (DOM-free). */
(function (K) {
  'use strict';
  const tr = K.tr;   // translate (K.T is the tile table)
  const U = K.U, T = K.T, TILE = K.TILE;
  const SEARCHABLE = ['wardrobe', 'shelf', 'desk', 'desk2', 'fridge', 'locker', 'crate'];
  const JAIL_SPEED = 14; // game minutes per real second while serving time

  K.mixin({
    // ============================================================ money helpers
    funds() { return this.P.money + (this.P.bank || 0); },
    canPay(n, cashOnly) { return (cashOnly ? this.P.money : this.funds()) >= n; },
    /** cash first, then card */
    pay(n, cashOnly) {
      const P = this.P;
      if (!this.canPay(n, cashOnly)) return false;
      const c = Math.min(P.money, n); P.money -= c; n -= c;
      if (n > 0) P.bank -= n;
      return true;
    },
    later(sec, fn) { (this.timers || (this.timers = [])).push({ t: this.t + sec, fn }); },
    today() { return Math.floor(this.time / 1440); },

    // ============================================================ charges, record, mask
    addCharge(type) {
      if (!K.CRIMES[type]) return;
      this.charges = this.charges || {};
      this.charges[type] = (this.charges[type] || 0) + 1;
      const R = this.P.record || (this.P.record = {});
      R[type] = (R[type] || 0) + 1;
    },
    chargeList() { return Object.entries(this.charges || {}).map(([k, n]) => ({ k, n, name: K.CRIMES[k].name, min: K.CRIMES[k].jail * n })); },
    seenByAnyone() { return this.actors.some((a) => a.alive && a.ko <= 0 && a.seesPlayer && a.kind !== 'player' && !a.removed && !a.inCar); },
    toggleMask() {
      const P = this.P;
      if (!P.inv.mask) return false;
      P.masked = !P.masked;
      this.emit('sfx', { s: 'cloth' });
      if (P.masked) { this.notify(tr("Balaclava on. Witnesses can't recognise you — but you look suspicious.")); return true; }
      if (this.wanted > 0) {
        if (this.seenByAnyone()) { this.heat.anon = false; this.notify(tr('They saw your face!'), 'bad'); }
        else if (this.heat.anon) {
          const was = Math.floor(this.wanted); this.wanted = 0; this.charges = {};
          for (const c of this.actors) if (c.kind === 'cop' && !c.station && !c.inCar) { this.calmDown(c); c.knowsPlayer = false; }
          this.emit('wanted', { level: 0, prev: was, why: tr('Mask off — unrecognised') });
        } else this.notify(tr('Mask off. They already knew your face.'), 'bad');
      } else this.notify(tr('Balaclava off.'));
      return true;
    },

    // ============================================================ surrender & jail
    toggleSurrender() {
      const P = this.P, a = this.player;
      if (P.surrender) { this.cancelSurrender(false); return; }
      if (this.wanted <= 0 || a.inCar || !a.alive || P.jail) { this.notify(P.jail ? tr("You're already locked up.") : tr('Nobody is looking for you.'), 'bad'); return; }
      P.surrender = true; P.surrenderT = 0;
      if (P.slot) { P.last = P.slot; P.slot = 0; a.wi = this.curWeapon(); }
      a.crouch = false; this.drag = null; this.td = null; this.action = null;
      this.bark(a, tr("Don't shoot! I surrender!"), 2.5);
      for (const c of this.near(a.x, a.y, 34 * TILE)) {
        if (c.kind !== 'cop' || !c.alive || c.ko > 0 || c.inCar) continue;
        c.state = 'arrest'; c.brain.arT = 0; c.path = null; c.goal = null;
      }
      const cop = this.actors.find((c) => c.kind === 'cop' && c.alive && c.seesPlayer);
      if (cop) this.bark(cop, U.pick([tr('Hands behind your head! Slowly!'), tr("On your knees! Don't move!"), tr('Stay right there!')]));
      this.emit('surrender', {});
    },
    cancelSurrender(resist) {
      const P = this.P; if (!P.surrender) return;
      P.surrender = false;
      if (resist) {
        const near = this.actors.find((c) => c.kind === 'cop' && c.alive && c.seesPlayer);
        if (near) { this.raiseWanted(2, 'resist'); this.bark(near, tr("He's running! Open fire!")); this.alarm(near, this.player); }
      }
    },
    policeBuilding() { return this.buildings.find((b) => b.type === 'police'); },
    jailRoom() {
      const b = this.policeBuilding();
      return b.rooms.find((r) => r.role === 'cells') || b.rooms[b.rooms.length - 1];
    },
    jailSpot() {
      const r = this.jailRoom(), out = [];
      for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) { const t = j * this.W + i; if (!this.blockedTile(t, null) && this.tiles[t] !== T.DOOR) out.push(t); }
      const t = out.length ? U.pick(out) : r.y * this.W + r.x;
      return { x: (t % this.W + 0.5) * TILE, y: (((t / this.W) | 0) + 0.5) * TILE };
    },
    /** taken into custody: frisk, confiscate, sentence, cell */
    arrest() {
      const P = this.P, a = this.player;
      if (a.downed) { a.downed = null; a.ko = 0; a.hp = Math.max(a.hp, 30); a.bleed = 0; }
      const surrendered = !!P.surrender;
      P.surrender = false;
      const lost = [];
      for (let i = P.weapons.length - 1; i > 0; i--) {
        const d = K.WEAPONS[P.weapons[i].id];
        if (d.type === 'gun' || d.explosive || d.type === 'syringe' || d.id === 'katana' || d.id === 'machete') { lost.push(d.name); this.addCharge('weapon'); P.weapons.splice(i, 1); }
      }
      let grams = 0;
      for (const k of Object.keys(P.inv)) {
        const it = K.ITEMS[k];
        if (it.drug || it.hot || k === 'lockpick' || k === 'hackkit' || k === 'mask') {
          if (it.drug) grams += P.inv[k];
          lost.push(`${it.name}${P.inv[k] > 1 ? ' ×' + P.inv[k] : ''}`);
          delete P.inv[k];
        }
      }
      if (grams > 0) for (let k = 0; k < 1 + Math.floor(grams / 25); k++) this.addCharge('drugs');
      for (const c in P.ammo) P.ammo[c] = 0;
      P.masked = false;
      P.slot = 0; a.wi = this.curWeapon();
      const charges = this.chargeList();
      let min = charges.reduce((s, c) => s + c.min, 0);
      min = U.clamp(Math.round(min * (surrendered ? 0.7 : 1)), 60, 2880);
      const bail = Math.round(min * 14 / 50) * 50;
      P.jail = { until: this.time + min, total: min, bail, prev: P.outfit === 'prisoner' ? 'suit' : P.outfit, charges, surrendered };
      P.outfit = 'prisoner'; a.outfit = 'prisoner';
      const s = this.jailSpot(); a.x = s.x; a.y = s.y; a.vx = a.vy = 0; a.inCar = null;
      this.wanted = 0; this.charges = {}; this.heat.seenT = 0; this.drag = null; this.td = null; this.action = null; this.arrestProgress = 0;
      for (const c of this.actors) if (c.kind === 'cop' && !c.station) this.removeActor(c);
      for (const c of this.cars) if (c.kind === 'police' && c.driver !== 'player') c.dead = true;
      this.emit('jailed', { min, bail, lost, charges, surrendered });
      this.emit('sfx', { s: 'cell' });
    },
    release(how) {
      const P = this.P, a = this.player, J = P.jail; if (!J) return;
      const b = this.policeBuilding();
      a.x = (b.entrance.x + 0.5) * TILE; a.y = (b.entrance.y + 0.5 + b.doors[0].oy) * TILE;
      if (P.outfit === 'prisoner') { P.outfit = J.prev; a.outfit = J.prev; }
      P.jail = null; this.timeScale = 1;
      P.hunger = Math.max(P.hunger, 60); P.thirst = Math.max(P.thirst, 60);
      this.emit('released', { how });
    },
    payBail() {
      const J = this.P.jail; if (!J || J.escaped) return false;
      if (!this.pay(J.bail)) { this.notify(tr('Bail {bail} — not enough money (cash + bank).', { bail: U.money(J.bail) }), 'bad'); this.emit('sfx', { s: 'error' }); return false; }
      this.emit('sfx', { s: 'cash' }); this.release('bail');
      return true;
    },
    updateJail(dt) {
      const P = this.P, J = P.jail, p = this.player;
      if (!J) { if (this.timeScale !== 1 && !this.sleeping) this.timeScale = 1; return; }
      if (J.escaped) {
        this.timeScale = 1;
        if (this.wanted <= 0) { P.jail = null; this.notify(tr('Gone to ground. The manhunt for the escapee runs dry.'), 'good'); }
        return;
      }
      this.timeScale = this.action ? 1 : JAIL_SPEED;
      P.hunger = Math.max(P.hunger, 45); P.thirst = Math.max(P.thirst, 45); P.energy = Math.min(100, P.energy + dt * 0.4);
      if (this.time >= J.until) { this.release('served'); return; }
      if (this.bldAt(p.x, p.y) !== this.policeBuilding().id) {
        J.escaped = true; this.timeScale = 1;
        this.raiseWanted(3, 'jailbreak');
        this.emit('banner', { title: tr('JAILBREAK'), sub: tr('Run! And get yourself some different clothes.'), kind: 'red' });
      }
    },
    jailbreakTick(dt) {
      const J = this.P.jail;
      const guard = this.actors.find((c) => c.kind === 'cop' && c.alive && c.ko <= 0 && c.station && this.sees(c, this.player.x, this.player.y, 9 * TILE, 1.1));
      if (guard) {
        this.action = null;
        J.until += 120;
        this.bark(guard, U.pick([tr('Hands off that door!'), tr('Nice try. Two extra hours.'), tr('Hey! Back on your bunk!')]));
        this.notify(tr('Caught! +2h in jail.'), 'bad');
        this.emit('sfx', { s: 'error' });
      } else if (Math.random() < dt * 2) this.emit('sfx', { s: 'pick' });
    },

    // ============================================================ hold-ups (aim a gun at people)
    updateHoldup(dt) {
      const p = this.player;
      if (!this.aiming || p.inCar) return;
      const d = this.wdef(p); if (d.type !== 'gun') return;
      let best = null, bd = 6 * TILE;
      for (const a of this.near(p.x, p.y, 6 * TILE)) {
        if (a === p || !a.alive || a.ko > 0 || a.inCar || a.hidden) continue;
        if (!['civ', 'keeper', 'staff', 'target'].includes(a.kind) || a.armedKeeper || a.state === 'hostile' || a.state === 'fight') continue;
        const dist = Math.hypot(a.x - p.x, a.y - p.y), ang = Math.atan2(a.y - p.y, a.x - p.x);
        if (Math.abs(U.angDiff(p.aim, ang)) > 0.26 + 12 / Math.max(20, dist)) continue;
        if (dist < bd && K.los(this, p.x, p.y, a.x, a.y)) { bd = dist; best = a; }
      }
      if (!best) return;
      const a = best;
      if (a.kind === 'target') { this.panic(a, p.x, p.y); return; }
      if (a.state !== 'cower') {
        a.state = 'cower'; a.brain.cowerBy = 0; a.crouch = true; a.path = null; a.goal = null;
        this.bark(a, a.kind === 'keeper' ? U.pick([tr('Okay, okay! Take the money!'), tr("Don't shoot! The till's yours!")]) : U.pick([tr("Don't shoot!"), tr('Please! I have kids!'), tr('Take it all, take it all!')]), 2.4);
        if (!a.heldUp) { a.heldUp = true; this.crimeEvent(p, 'weapon', p.x, p.y, null); }
      }
      a.brain.cowerT = Math.max(a.brain.cowerT || 0, 5);
    },

    // ============================================================ context actions for crime
    underworldContext(add) {
      const P = this.P, a = this.player;
      // jail
      if (P.jail && !P.jail.escaped) {
        add('K', tr('Pay bail ({bail})', { bail: U.money(P.jail.bail) }), () => this.payBail());
        const door = this.lockedDoorNear();
        if (door) add('E', tr('Tamper with the cell door'), () => { door.locked = false; door.picked = true; this.emit('sfx', { s: 'unlock' }); this.notify(tr('The door is open. Get out — quietly.'), 'good'); }, 9, { tick: (dt) => this.jailbreakTick(dt) });
        return true;
      }
      if (this.drag) return false;
      if (this.propsContext && this.propsContext(add)) return false;
      if (this.orgContext && this.orgContext(add)) return false;
      if (this.fuelContext && this.fuelContext(add)) return false;
      if (this.crewContext && this.crewContext(add)) return false;
      if (this.mechanicContext && this.mechanicContext(add)) return false;
      if (this.dealerContext && this.dealerContext(add)) return false;
      if (this.nightlifeContext && this.nightlifeContext(add)) return false;
      if (this.gangContext && this.gangContext(add)) return false;
      // people: rob / pickpocket / deal
      let civ = null, bd = 36;
      for (const b of this.near(a.x, a.y, 40)) {
        if (b === a || !b.alive || b.ko > 0 || b.inCar || b.hidden) continue;
        if (!['civ', 'keeper', 'staff', 'target'].includes(b.kind)) continue;
        const d = Math.hypot(b.x - a.x, b.y - a.y); if (d < bd) { bd = d; civ = b; }
      }
      if (civ) {
        if (civ.state === 'cower' && !civ.robbed && civ.kind !== 'keeper') add('E', tr('Rob'), () => this.robPerson(civ), 0.7);
        else if (civ.kind === 'civ' && !civ.picked && !['flee', 'cower', 'hostile', 'fight', 'report'].includes(civ.state) && Math.abs(U.angDiff(civ.angle, Math.atan2(a.y - civ.y, a.x - civ.x))) > 1.7)
          add('E', tr('Pickpocket'), () => this.pickpocket(civ), 1.1, { tick: () => { if (Math.hypot(civ.x - a.x, civ.y - a.y) > 46) { this.action = null; this.notify(tr('Too far away.'), 'bad'); } } });
        const dr = this.streetDrug();
        if (civ.kind === 'civ' && !civ.dealt && dr && !['flee', 'cower', 'hostile', 'fight', 'report'].includes(civ.state)) add('T', dr === 'bud' ? tr('Offer weed (2g)') : tr('Offer {item}', { item: K.ITEMS[dr].name }), () => this.offerDrugs(civ));
      }
      if (this.heistContext && this.heistContext(add)) return false;
      // shop till during a hold-up
      const shopB = a.inCar ? null : this.buildings[this.bldAt(a.x, a.y)];
      if (shopB && shopB.shop && shopB.counter) {
        const k = this.actors.find((x) => x.kind === 'keeper' && x.home === shopB.id && x.alive && x.ko <= 0);
        const c = shopB.counter, cx = (c.x + c.w / 2) * TILE, cy = (c.y + c.h / 2) * TILE;
        if (k && k.state === 'cower' && Math.hypot(cx - a.x, cy - a.y) < 3 * TILE) {
          if (shopB.tillDay === this.today()) add('E', tr('The till is empty'), null);
          else add('E', shopB.type === 'bank' ? tr('Clean out the bank counter') : tr('Empty the till'), () => this.robTill(shopB, k), 3.2, { tick: () => { if (k.state !== 'cower') { k.state = 'cower'; k.brain.cowerT = 4; k.brain.cowerBy = 0; } } });
        }
      }
      // plants
      const pl = this.plantNear();
      if (pl) {
        const g = pl.g >= 1 ? tr('Harvest (~{g}g)', { g: this.yieldOf(pl) }) : pl.hp <= 0 ? tr('Remove the dead plant') : pl.w < 95 ? tr('Water it ({w}% water)', { w: Math.round(pl.w) }) : null;
        if (g) add('E', g, () => this.tendPlant(pl), pl.g >= 1 ? 1.2 : 0.5);
        else add('E', tr('Plant: {g}% · Water {w}%', { g: Math.floor(pl.g * 100), w: Math.round(pl.w) }), null);
        if (P.inv.fert && pl.g < 1 && pl.hp > 0) add('T', tr('Fertilize'), () => { this.takeItem('fert'); pl.f = 1; this.emit('sfx', { s: 'pour' }); this.notify(tr('Fertilized.')); });
      }
      // ATMs
      const atm = this.propNear(['atm'], 1.2);
      if (atm) {
        add('E', tr('ATM (balance {money})', { money: U.money(P.bank || 0) }), () => this.emit('ui', { open: 'bank' }));
        if (P.inv.hackkit && atm.hackDay !== this.today()) add('T', tr('Hack the ATM'), () => this.hackAtm(atm), 6, { tick: (dt) => { if (Math.random() < dt * 3) this.emit('sfx', { s: 'beep' }); } });
      }
      // searchable furniture in buildings that aren't yours
      const b = a.inCar ? null : this.buildings[this.bldAt(a.x, a.y)];
      if (b && !b.owned) {
        const s = this.propNear(SEARCHABLE, 1.15);
        if (s && !s.searched && !(s.k === 'wardrobe' && this.drag)) add('E', tr('Search: {thing}', { thing: { wardrobe: tr('Closet'), shelf: tr('Shelf'), desk: tr('Desk'), desk2: tr('Desk'), fridge: tr('Fridge'), locker: tr('Locker'), crate: tr('Crate') }[s.k] }), () => this.searchProp(s, b), 1.5);
      }
      return false;
    },

    // ============================================================ crimes against people
    pickpocket(v) {
      const P = this.P, a = this.player;
      const chance = 0.7 + this.sk('stealth') * 0.06 - (v.state === 'idle' ? 0.08 : 0);
      v.picked = true;
      if (Math.random() < chance) {
        const cash = v.wallet || 0; v.wallet = 0;
        P.money += cash;
        let msg = tr('Pickpocketed: +{cash}', { cash: U.money(cash) });
        if (Math.random() < 0.3) { this.addItem('phone'); msg += ' ' + tr('+ phone'); }
        if (v.loot && Math.random() < 0.5) { this.addItem(v.loot); msg += ` + ${K.ITEMS[v.loot].name}`; v.loot = null; }
        this.notify(msg, 'money'); this.emit('sfx', { s: 'coins' }); this.addXP(6, tr('Pickpocket'));
        // a cop watching might still notice
        for (const c of this.near(a.x, a.y, 12 * TILE)) if (c.kind === 'cop' && c.alive && this.sees(c, a.x, a.y, 10 * TILE, 1) && Math.random() < 0.45) { this.crimeEvent(a, 'theft', a.x, a.y, null); break; }
      } else {
        this.bark(v, U.pick([tr('Hey! My wallet!'), tr('Thief! THIEF!'), tr('Hands off, you rat!')]), 2.4);
        v.angle = Math.atan2(a.y - v.y, a.x - v.x);
        this.crimeEvent(a, 'theft', a.x, a.y, v);
        this.notify(tr('Caught pickpocketing!'), 'bad');
      }
    },
    robPerson(v) {
      const P = this.P, a = this.player;
      v.robbed = true;
      const cash = (v.wallet || 0) + 20 + U.rint(80); v.wallet = 0;
      P.money += cash;
      let msg = tr('Robbed: +{cash}', { cash: U.money(cash) });
      if (Math.random() < 0.55) { this.addItem('phone'); msg += ' ' + tr('+ phone'); }
      if (v.loot) { this.addItem(v.loot); msg += ` + ${K.ITEMS[v.loot].name}`; v.loot = null; }
      else if (v.outfit === 'rich' || v.outfit === 'suitgrey') { this.addItem('jewelry'); msg += ' ' + tr('+ jewelry'); }
      this.notify(msg, 'money'); this.emit('sfx', { s: 'coins' }); this.addXP(10, tr('Mugging'));
      this.bark(v, U.pick([tr('Here! Now leave me alone!'), tr("Please don't hurt me…")]), 2);
      this.crimeEvent(a, 'robbery', a.x, a.y, v);
      v.reportT = v.reportT || 4 + Math.random() * 3; v.reportType = 'robbery'; v.reportX = a.x; v.reportY = a.y;
    },
    robTill(b, keeper) {
      const P = this.P, s = K.SHOPS[b.shop];
      const cash = Math.round((s.till || 400) * (0.7 + Math.random() * 0.6));
      b.tillDay = this.today();
      P.money += cash;
      this.notify(tr('Till emptied: +{cash}', { cash: U.money(cash) }), 'money'); this.emit('sfx', { s: 'cash' }); this.addXP(25, tr('Hold-up'));
      this.crimeEvent(this.player, 'robbery', this.player.x, this.player.y, keeper);
      keeper.reportT = 0.01; keeper.reportType = 'robbery'; keeper.reportX = this.player.x; keeper.reportY = this.player.y;
      if (b.type === 'bank') { this.crimeEvent(this.player, 'heist', this.player.x, this.player.y, keeper); this.heistAlarm(b, 6); return; }
      // silent alarm under the counter
      const x = this.player.x, y = this.player.y;
      this.later(9, () => { this.raiseWanted(2, 'robbery'); this.policeInvestigate(x, y); this.emit('notify', { text: tr('Silent alarm tripped — police on the way!'), kind: 'bad' }); });
    },
    searchProp(p, b) {
      const P = this.P;
      p.searched = true;
      const r = Math.random(), found = [];
      const give = (k, n = 1) => { this.addItem(k, n); found.push(K.ITEMS[k].name + (n > 1 ? ' ×' + n : '')); };
      const t = b.type;
      if (p.k === 'crate' && (t === 'warehouse' || t === 'black')) {
        if (r < 0.35) { const cal = U.pick(Object.keys(K.AMMO)); const n = K.AMMO[cal].box; P.ammo[cal] = (P.ammo[cal] || 0) + n; found.push(`${K.AMMO[cal].name} ×${n}`); }
        else if (r < 0.55) give('cash');
        else if (r < 0.62) { this.addWeapon('grenade', { n: 1 }); found.push(tr('Grenade')); }
        else if (r < 0.75) give('bud', 10 + U.rint(20));
      } else if (p.k === 'locker' && t === 'police') {
        if (r < 0.5) { P.ammo['9mm'] = (P.ammo['9mm'] || 0) + 30; found.push('9mm ×30'); } else if (r < 0.7) give('vest'); else give('bandage');
      } else if (p.k === 'fridge') { give(U.pick(['beer', 'cola', 'water', 'sandwich', 'apple', 'pizza'])); if (Math.random() < 0.4) give(U.pick(['beer', 'cola'])); }
      else {
        if (r < 0.4) { const c = 20 + U.rint(t === 'villa' || t === 'office' ? 600 : 160); P.money += c; found.push(U.money(c)); }
        if (Math.random() < (t === 'villa' ? 0.45 : 0.18)) give('jewelry');
        if (Math.random() < (p.k === 'desk' || p.k === 'desk2' ? 0.35 : 0.08)) give('laptop');
        if (Math.random() < 0.12) give('pills');
        if (Math.random() < 0.06) give('lockpick');
        if (Math.random() < 0.05 && t !== 'office') give('bud', 3 + U.rint(6));
      }
      this.emit('sfx', { s: found.length ? 'pickup' : 'cloth' });
      this.notify(found.length ? tr('Found: {item}', { item: found.join(', ') }) : tr('Nothing useful.'), found.length ? 'loot' : 'info');
      if (this.privateBuilding(b) || b.zone != null) this.crimeEvent(this.player, 'burglary', this.player.x, this.player.y, null);
    },
    hackAtm(atm) {
      atm.hackDay = this.today();
      const cash = 200 + U.rint(600);
      this.P.money += cash;
      this.emit('sfx', { s: 'cash' }); this.notify(tr('ATM cracked: +{cash}', { cash: U.money(cash) }), 'money'); this.addXP(20, tr('Hack'));
      this.crimeEvent(this.player, 'theft', this.player.x, this.player.y, null);
      if (Math.random() < 0.35) { const x = this.player.x, y = this.player.y; this.later(15, () => { this.policeInvestigate(x, y); this.notify(tr('The bank noticed the hack. A patrol is on the way.'), 'bad'); }); }
    },
    bankDeposit(n) { const P = this.P; n = Math.min(n, P.money); if (n <= 0) return; P.money -= n; P.bank = (P.bank || 0) + n; this.emit('sfx', { s: 'cash' }); },
    bankWithdraw(n) { const P = this.P; n = Math.min(n, P.bank || 0); if (n <= 0) return; P.bank -= n; P.money += n; this.emit('sfx', { s: 'cash' }); },

    // ============================================================ dealing
    /** the most valuable thing you can sell on the street right now */
    streetDrug() {
      const P = this.P;
      for (const k of ['coke', 'meth']) if ((P.inv[k] || 0) >= 1) return k;
      return (P.inv.bud || 0) >= 2 ? 'bud' : null;
    },
    offerDrugs(v) {
      const P = this.P, a = this.player, D = P.deal || (P.deal = { rep: 0, sold: 0 });
      v.dealt = true;
      const dist = this.districtAt(a.x, a.y);
      let chance = 0.3 + (this.isNight() ? 0.2 : 0) + ({ old: 0.12, docks: 0.18, park: 0.15, ind: 0.1 }[dist] || 0) + Math.min(0.25, D.rep * 0.01);
      if (v.outfit === 'rich') chance -= 0.1;
      if (Math.random() < chance) {
        const dr = this.streetDrug() || 'bud', it = K.ITEMS[dr];
        const n = dr === 'bud' ? (Math.random() < 0.25 + D.rep * 0.004 ? 4 : 2) : Math.random() < 0.3 + D.rep * 0.004 ? 2 : 1;
        const grams = Math.min(n, P.inv[dr]);
        const unit = dr === 'bud' ? 14 + Math.min(12, D.rep * 0.25) + Math.random() * 6 : it.street * (0.85 + Math.min(0.4, D.rep * 0.008) + Math.random() * 0.25);
        const price = Math.round(grams * unit * (this.ownTurfAt && this.ownTurfAt(a.x, a.y) ? 1.25 : 1));
        this.takeItem(dr, grams); P.money += price; D.rep++; D.sold += grams;
        this.bark(v, U.pick([tr('Nice. Just what I needed.'), tr("You're an angel, man."), tr("If it's good, I'll be back."), tr('Quick, before anyone looks.')]), 2.4);
        this.notify(dr === 'bud' ? tr('Sold: {n}g for {price} · Rep {rep}', { n: grams, price: U.money(price), rep: D.rep }) : tr('Sold: {n}× {item} for {price} · Rep {rep}', { n: grams, item: it.name, price: U.money(price), rep: D.rep }), 'money'); this.emit('sfx', { s: 'coins' }); this.addXP(5, tr('Deal'));
        this.crimeEvent(a, 'drugs', a.x, a.y, null);
      } else {
        this.bark(v, U.pick([tr('Piss off.'), tr('No thanks. Seriously?'), tr("I'm calling the cops!"), tr('Not my thing.')]), 2.2);
        if (Math.random() < 0.18) { v.reportT = 4 + Math.random() * 4; v.reportType = 'drugs'; v.reportX = a.x; v.reportY = a.y; this.flee(v, a.x, a.y, false); }
      }
    },

    // ============================================================ growing
    plantNear() {
      const a = this.player; let best = null, bd = 30;
      for (const pl of this.P.plants || []) { const d = Math.hypot(pl.x - a.x, pl.y - a.y); if (d < bd) { bd = d; best = pl; } }
      return best;
    },
    yieldOf(pl) { return Math.max(4, Math.round((12 + 22 * pl.q) * Math.max(0.3, pl.hp))); },
    plantSeed() {
      const P = this.P, a = this.player;
      const b = this.buildings[this.bldAt(a.x, a.y)];
      if (!b || !b.owned) { this.notify(tr('Only in a property you own.'), 'bad'); return false; }
      if (!P.inv.seed) { this.notify(tr('You need cannabis seeds.'), 'bad'); return false; }
      if (!P.inv.growkit) { this.notify(tr('You need a grow pot (garden centre).'), 'bad'); return false; }
      const tx = ((a.x / TILE) | 0) + 0.5, ty = ((a.y / TILE) | 0) + 0.5;
      const x = tx * TILE, y = ty * TILE;
      P.plants = P.plants || [];
      if (P.plants.some((p) => Math.hypot(p.x - x, p.y - y) < 20)) { this.notify(tr("There's already a plant here."), 'bad'); return false; }
      if (P.plants.filter((p) => p.prop === b.property).length >= 12) { this.notify(tr('Max. 12 plants per property.'), 'bad'); return false; }
      this.takeItem('seed'); this.takeItem('growkit');
      P.plants.push({ id: this.nid(), x, y, prop: b.property, g: 0, w: 80, f: 0, hp: 1, q: 0.5 });
      this.emit('sfx', { s: 'pour' }); this.notify(tr("Seed planted. Don't forget to water it!"), 'good'); this.addXP(5, tr('Gardener'));
      return true;
    },
    tendPlant(pl) {
      const P = this.P;
      if (pl.g >= 1) {
        const g = this.yieldOf(pl);
        this.addItem('bud', g); this.addItem('growkit');
        P.plants = P.plants.filter((p) => p !== pl);
        this.emit('sfx', { s: 'harvest' }); this.notify(tr('Harvested: {g}g of weed', { g }), 'loot'); this.addXP(15, tr('Harvest'));
        return;
      }
      if (pl.hp <= 0) { P.plants = P.plants.filter((p) => p !== pl); this.addItem('growkit'); this.notify(tr('Dead plant binned. Pot recovered.')); return; }
      if (P.inv.can) { pl.w = 100; }
      else if (this.takeItem('water')) { pl.w = Math.min(100, pl.w + 70); }
      else { this.notify(tr('You need water or a watering can.'), 'bad'); return; }
      this.emit('sfx', { s: 'pour' });
    },
    updatePlants(min) {
      for (const pl of this.P.plants || []) {
        if (pl.g >= 1 || pl.hp <= 0) continue;
        if (pl.w > 0) {
          pl.g = Math.min(1, pl.g + (min / (14 * 60)) * (1 + pl.f * 0.6) * (0.4 + pl.hp * 0.6));
          pl.w = Math.max(0, pl.w - min * 0.11);
          if (pl.f > 0) { pl.q = Math.min(1.4, pl.q + min * 0.0006 * pl.f); pl.f = Math.max(0, pl.f - min * 0.0015); }
          pl.hp = Math.min(1, pl.hp + min * 0.001);
        } else pl.hp = Math.max(0, pl.hp - min * 0.003);
      }
    },

    // ============================================================ per-frame
    updateUnderworld(dt, min) {
      const P = this.P;
      if (this.timers && this.timers.length) {
        const due = this.timers.filter((x) => x.t <= this.t);
        this.timers = this.timers.filter((x) => x.t > this.t);
        for (const x of due) x.fn();
      }
      this.updateJail(dt);
      this.updatePlants(min);
      this.updateHoldup(dt);
      if (this.updateCriminals) this.updateCriminals(dt);
      if (this.updateHeists) this.updateHeists(dt);
      if (this.updateCrew) this.updateCrew(dt);
      if (this.updateGangs) this.updateGangs(dt);
      if (this.updateCarService) this.updateCarService(dt);
      if (this.updateNightlife) this.updateNightlife(dt);
      if (P.surrender) {
        P.surrenderT += dt;
        if (this.wanted <= 0 && !this.actors.some((c) => c.kind === 'cop' && c.state === 'arrest')) P.surrender = false;
      }
    },
  });
})(globalThis.K = globalThis.K || {});
