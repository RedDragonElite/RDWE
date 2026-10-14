/* RDE // KONTRAKT — player state, inventory, shops, properties, survival, sleep, XP, saves */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE, W8 = K.WEAPONS;

  K.mixin({
    initEconomy(save) {
      this.P = {
        money: 1500, outfit: 'suit', outfits: ['suit'],
        weapons: [{ id: 'fists' }, { id: 'p9', mag: 15, sup: false }, { id: 'wire' }, { id: 'coin', n: 4 }],
        slot: 0, last: 1, handsDown: true,
        ammo: { '9mm': 45 }, inv: { sandwich: 1, water: 2, bandage: 2, lockpick: 1, coffee: 1 },
        hunger: 82, thirst: 76, energy: 88, stamina: 100, drunk: 0, painkiller: 0, instinct: false, flashlight: false,
        xp: 0, level: 1, sp: 0, skills: { stealth: 0, marksman: 0, melee: 0, fitness: 0, disguise: 0, survival: 0 },
        owned: ['bude'], home: 'bude', placed: [], stash: { bude: { items: { medkit: 1, whiskey: 1 }, weapons: [{ id: 'knife' }], ammo: { '9mm': 30 }, money: 0 } },
        stats: { kills: 0, civKills: 0, contracts: 0, earned: 0, headshots: 0, takedowns: 0, silent: 0, days: 1 },
        compromised: {}, lastIncome: 0, recoil: 0,
        bank: 0, plants: [], jail: null, masked: false, surrender: false, high: 0, deal: { rep: 0, sold: 0 }, record: {},
      };
    },
    sk(k) { return this.P.skills[k] || 0; },
    maxHp() { return 100 + this.sk('fitness') * 10; },
    weightLimit() { return 28 + this.sk('fitness') * 2; },
    carried() {
      const P = this.P; let w = 0;
      for (const x of P.weapons) w += (W8[x.id].w || 0) * (x.n || 1);
      for (const k in P.inv) w += (K.ITEMS[k].w || 0) * P.inv[k];
      for (const k in P.ammo) w += P.ammo[k] * 0.012;
      return w;
    },
    curWeapon() { return this.P.weapons[this.P.slot] || this.P.weapons[0]; },
    // ------------------------------------------------------------ inventory
    addItem(id, n = 1) { const P = this.P; P.inv[id] = (P.inv[id] || 0) + n; },
    takeItem(id, n = 1) { const P = this.P; if ((P.inv[id] || 0) < n) return false; P.inv[id] -= n; if (P.inv[id] <= 0) delete P.inv[id]; return true; },
    addWeapon(id, o = {}) {
      const P = this.P, d = W8[id];
      if (d.stack || d.consumable) {
        const ex = P.weapons.find((w) => w.id === id);
        if (ex) { ex.n = (ex.n || 1) + (o.n || 1); return ex; }
        const w = { id, n: o.n || 1 }; P.weapons.push(w); if (this.hotbarAdd) this.hotbarAdd('w', id); return w;
      }
      if (P.weapons.some((w) => w.id === id)) {
        // duplicate gun → keep the ammo
        if (d.type === 'gun') { P.ammo[d.ammo] = (P.ammo[d.ammo] || 0) + (o.mag != null ? o.mag : d.mag); this.notify(`+${o.mag != null ? o.mag : d.mag} ${K.AMMO[d.ammo].name}`, 'loot'); }
        return null;
      }
      if (P.weapons.length >= 16) { this.notify('Kein Platz mehr für Waffen (max. 15).', 'bad'); return null; }
      const w = { id, mag: d.type === 'gun' ? (o.mag != null ? o.mag : d.mag) : undefined, sup: !!(o.sup || d.sup), n: o.n };
      P.weapons.push(w);
      if (this.hotbarAdd) this.hotbarAdd('w', id);
      return w;
    },
    removeWeaponAt(i) {
      const P = this.P; if (i <= 0) return;
      P.weapons.splice(i, 1);
      if (P.slot >= P.weapons.length) P.slot = 0;
      this.player.wi = this.curWeapon();
    },
    useItem(id) {
      const it = K.ITEMS[id], P = this.P, a = this.player;
      if (!it || !P.inv[id]) return false;
      if (id === 'vest') { if (a.armor >= 100) return this.notify('Weste ist intakt.', 'bad'), false; a.armor = 100; this.takeItem(id); this.emit('sfx', { s: 'vest' }); this.notify('Schutzweste angelegt'); return true; }
      if (id === 'silencer') {
        const w = this.curWeapon(), d = W8[w.id];
        if (!d.canSup) return this.notify('Diese Waffe nimmt keinen Schalldämpfer.', 'bad'), false;
        if (w.sup) return this.notify('Bereits gedämpft.', 'bad'), false;
        w.sup = true; this.takeItem(id); this.emit('sfx', { s: 'attach' }); this.notify(`Schalldämpfer auf ${d.name} montiert`); return true;
      }
      if (it.place) return this.startPlace(it.place);
      if (id === 'flashlight') { P.flashlight = !P.flashlight; this.emit('sfx', { s: 'click' }); return true; }
      if (id === 'mask') return this.toggleMask();
      if (id === 'growkit' || id === 'seed') return this.plantSeed();
      if (id === 'can' || id === 'fert' || id === 'hackkit') { this.notify(id === 'hackkit' ? 'Stell dich an einen Geldautomaten.' : 'Stell dich an eine Pflanze.', 'bad'); return false; }
      if (id === 'jerrycan') return this.useJerrycan();
      if (id === 'spare') return this.useSpare();
      if (id === 'jerryempty') { this.notify('An einer Zapfsäule füllen [T].', 'bad'); return false; }
      if (id === 'repair' && this.useRepairKit) return this.useRepairKit();
      if (id === 'repair') {
        const c = this.carNear(a);
        if (!c) return this.notify('Kein Auto in der Nähe.', 'bad'), false;
        c.hp = 100; c.fire = 0; this.takeItem(id); this.emit('sfx', { s: 'attach' }); this.notify('Auto repariert.'); return true;
      }
      if (id === 'bud') { if (P.inv.bud < 1) return false; this.takeItem('bud'); P.high = Math.min(1, (P.high || 0) + 0.35); P.hunger = Math.max(0, P.hunger - 6); P.energy = Math.max(0, P.energy - 4); this.emit('sfx', { s: 'cough' }); this.notify('Ein Zug… alles wird langsam und bunt.'); return true; }
      if (it.sellOnly || it.quest || id === 'lockpick') return false;
      this.consume(it);
      this.takeItem(id);
      return true;
    },
    consume(it) {
      const P = this.P, a = this.player, sv = 1 + this.sk('survival') * 0.05;
      if (it.food) P.hunger = U.clamp(P.hunger + it.food * sv, 0, 100);
      if (it.water) P.thirst = U.clamp(P.thirst + it.water * sv, 0, 100);
      if (it.energy) P.energy = U.clamp(P.energy + it.energy, 0, 100);
      if (it.hp) a.hp = U.clamp(a.hp + it.hp, 1, this.maxHp());
      if (it.drunk) P.drunk = U.clamp(P.drunk + it.drunk, 0, 1);
      if (it.stopBleed) a.bleed = 0;
      if (it.painkiller) P.painkiller = it.painkiller;
      this.emit('sfx', { s: it.food ? 'eat' : it.water ? 'drink' : 'heal' });
      this.notify(`${it.name} ${it.food ? 'gegessen' : it.water ? 'getrunken' : 'benutzt'}`);
    },

    // ------------------------------------------------------------ shops
    priceOf(key, sell) {
      const disc = 1 - this.sk('disguise') * 0.04;
      let p = 0, name = '', icon = null;
      if (key.startsWith('a:')) { const a = K.AMMO[key.slice(2)]; p = a.price; name = `${a.name} ×${a.box}`; }
      else if (key.startsWith('o:')) { const o = K.OUTFITS[key.slice(2)]; p = o.price || (o.disguise ? 1400 : 300); name = o.name; }
      else if (W8[key]) { p = W8[key].price || 0; name = W8[key].name; }
      else if (K.ITEMS[key]) { p = K.ITEMS[key].sell || K.ITEMS[key].price; name = K.ITEMS[key].name; }
      if (sell) return Math.round(p * (K.ITEMS[key] && K.ITEMS[key].sell ? 1 : 0.4));
      return { price: Math.max(1, Math.round(p * disc)), name };
    },
    buy(key, shopId) {
      const { price, name } = this.priceOf(key);
      const P = this.P;
      const cashOnly = shopId === 'black';
      if (!this.canPay(price, cashOnly)) { this.emit('sfx', { s: 'error' }); return this.notify(cashOnly ? 'Hier nur Bargeld.' : 'Nicht genug Geld.', 'bad'), false; }
      if (key.startsWith('o:')) {
        const o = key.slice(2);
        if (P.outfits.includes(o)) return this.notify('Hast du schon.', 'bad'), false;
        P.outfits.push(o);
      } else if (key.startsWith('a:')) {
        const cal = key.slice(2); P.ammo[cal] = (P.ammo[cal] || 0) + K.AMMO[cal].box;
      } else if (W8[key]) {
        const d = W8[key];
        if (!d.stack && !d.consumable && P.weapons.some((w) => w.id === key)) return this.notify('Hast du schon.', 'bad'), false;
        if (!this.addWeapon(key, { n: key === 'coin' ? 5 : 1 })) return false;
      } else this.addItem(key);
      this.pay(price, cashOnly);
      this.emit('sfx', { s: 'cash' });
      this.notify(`Gekauft: ${name} (−${U.money(price)})`, 'money');
      return true;
    },
    sellWeapon(i) {
      const P = this.P, w = P.weapons[i]; if (!w || i === 0) return;
      const d = W8[w.id]; const v = Math.round((d.price || 0) * 0.4) * (w.n || 1);
      if (d.type === 'gun' && w.mag) P.ammo[d.ammo] = (P.ammo[d.ammo] || 0) + w.mag;
      this.removeWeaponAt(i); P.money += v; this.emit('sfx', { s: 'cash' }); this.notify(`Verkauft: ${d.name} (+${U.money(v)})`, 'money');
    },
    sellItem(id, n = 1) {
      n = Math.min(n, this.P.inv[id] || 0);
      const v = this.priceOf(id, true) * n; if (!v || !this.takeItem(id, n)) return;
      this.P.money += v; this.emit('sfx', { s: 'cash' }); this.notify(`Verkauft: ${K.ITEMS[id].name} (+${U.money(v)})`, 'money');
    },
    eatHere(key) {
      const it = K.ITEMS[key]; const { price } = this.priceOf(key);
      if (!this.pay(price)) { this.emit('sfx', { s: 'error' }); return this.notify('Nicht genug Geld.', 'bad'); }
      this.consume(it);
    },
    heal() {
      const cost = K.SHOPS.hospital.heal;
      if (!this.pay(cost)) return this.notify('Nicht genug Geld.', 'bad');
      this.player.hp = this.maxHp(); this.player.bleed = 0; this.emit('sfx', { s: 'heal' }); this.notify('Vollständig behandelt.', 'good');
    },
    setOutfit(o, silent) {
      const P = this.P;
      const was = P.outfit;
      P.outfit = o; this.player.outfit = o;
      if (!silent) { this.emit('sfx', { s: 'cloth' }); this.notify(`Outfit: ${K.OUTFITS[o].name}`); }
      if (was !== o) this.identityChanged();
    },

    // ------------------------------------------------------------ properties
    propertyDef(id) { return K.PROPERTIES.find((p) => p.id === id); },
    propertyBuilding(id) { return this.buildings.find((b) => b.property === id); },
    buyProperty(id) {
      const d = this.propertyDef(id), b = this.propertyBuilding(id), P = this.P;
      if (!d || !b || P.owned.includes(id)) return false;
      if (!this.pay(d.price)) { this.emit('sfx', { s: 'error' }); return this.notify('Nicht genug Geld (Bar + Konto).', 'bad'), false; }
      P.owned.push(id); P.stash[id] = P.stash[id] || { items: {}, weapons: [], ammo: {}, money: 0 };
      this.markOwned();
      this.emit('sfx', { s: 'purchase' }); this.emit('banner', { title: 'IMMOBILIE ERWORBEN', sub: d.name, kind: 'gold' });
      this.addXP(150, 'Immobilie');
      return true;
    },
    markOwned() {
      for (const b of this.buildings) if (b.property) b.owned = this.P.owned.includes(b.property);
      for (const p of this.props) if (p && p.k === 'sign' && this.P.owned.includes(p.property)) p.gone = true;
    },
    stashOf(b) { return b && b.property && b.owned ? this.P.stash[b.property] : null; },
    homeBed(id) {
      const b = this.propertyBuilding(id || this.P.home);
      const bed = this.props.find((p) => p && p.bld === b.id && p.k === 'bed');
      const cx = bed ? bed.x + bed.w / 2 : b.x + b.w / 2, cy = bed ? bed.y + bed.h / 2 : b.y + b.h / 2;
      // nearest free interior tile of that building
      let best = null, bd = 1e9;
      for (let j = b.y + 1; j < b.y + b.h - 1; j++) for (let i = b.x + 1; i < b.x + b.w - 1; i++) {
        const t = j * this.W + i;
        if (this.blockedTile(t, this.player) || this.tiles[t] === K.T.DOOR) continue;
        const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
        if (d < bd) { bd = d; best = { x: (i + 0.5) * TILE, y: (j + 0.5) * TILE }; }
      }
      return best || { x: (b.entrance.x + 0.5) * TILE, y: (b.entrance.y + 0.5) * TILE };
    },

    // ------------------------------------------------------------ survival
    updateSurvival(dt, min) {
      const P = this.P, a = this.player;
      if (!a.alive) return;
      const sv = 1 - this.sk('survival') * 0.1;
      const exert = a.sprint ? 2.2 : a.moving > 0.5 ? 1.2 : 1;
      P.hunger = Math.max(0, P.hunger - min * 0.075 * sv * exert);
      P.thirst = Math.max(0, P.thirst - min * 0.11 * sv * exert);
      P.energy = Math.max(0, P.energy - min * 0.05 * exert);
      P.drunk = Math.max(0, P.drunk - min * 0.006);
      P.high = Math.max(0, (P.high || 0) - min * 0.004);
      if (P.painkiller > 0) P.painkiller -= min;
      const mh = this.maxHp();
      if (P.hunger <= 0 || P.thirst <= 0) { a.hp -= min * 0.6; if (a.hp <= 0) this.kill(a, null, { kind: P.thirst <= 0 ? 'thirst' : 'hunger' }); }
      else if (P.hunger > 35 && P.thirst > 35 && !a.bleed && a.hp < mh) a.hp = Math.min(mh, a.hp + min * (0.35 + this.sk('survival') * 0.15));
      if (a.bleed > 0) {
        a.hp -= a.bleed * dt * 0.9;
        if (Math.random() < dt * 3) this.emit('drip', { x: a.x, y: a.y });
        if (a.hp <= 0) this.kill(a, this.byId.get(a.lastHitBy) || null, { kind: 'bleed' });
      }
      // passive income from businesses, once per day at 08:00
      const day = Math.floor((this.time - 8 * 60) / 1440);
      if (day > P.lastIncome) {
        if (P.lastIncome > 0 || day > 0) {
          let inc = 0; for (const id of P.owned) inc += this.propertyDef(id).income || 0;
          if (inc) { P.bank = (P.bank || 0) + inc; this.notify(`Einnahmen deiner Geschäfte aufs Konto: +${U.money(inc)}`, 'money'); this.emit('sfx', { s: 'cash' }); }
        }
        P.lastIncome = day;
        P.stats.days = U.day(this.time);
      }
      // stamina
      const fit = 1 + this.sk('fitness') * 0.15;
      if (a.sprint) P.stamina = Math.max(0, P.stamina - dt * 16 / fit);
      else P.stamina = Math.min(100, P.stamina + dt * (a.moving > 0.3 ? 9 : 16));
    },
    sleep(hours) {
      const P = this.P, a = this.player;
      const min = hours * 60;
      this.time += min;
      P.energy = Math.min(100, P.energy + hours * 13);
      P.hunger = Math.max(5, P.hunger - min * 0.03);
      P.thirst = Math.max(5, P.thirst - min * 0.045);
      P.drunk = 0; P.high = 0;
      this.updatePlants(min);
      a.hp = this.maxHp(); a.bleed = 0;
      this.weather.next = this.time;
      this.wanted = 0; this.heat.seenT = 0;
      // the city moved on while you slept
      for (const x of this.actors) if (x.kind === 'civ' || (x.kind === 'cop' && !x.station)) this.removeActor(x);
      for (const c of this.cars) if (c.driver !== 'player') c.dead = true;
      this.refreshOffers(true);
      this.emit('slept', { hours });
      this.addXP(5, 'Ausgeruht');
      return true;
    },

    // ------------------------------------------------------------ xp
    xpNeed(l) { return Math.round(400 * Math.pow(l, 1.45)); },
    addXP(n, why) {
      const P = this.P; n = Math.round(n);
      P.xp += n; this.emit('xp', { n, why });
      while (P.xp >= this.xpNeed(P.level)) {
        P.xp -= this.xpNeed(P.level); P.level++; P.sp++;
        this.emit('banner', { title: `STUFE ${P.level}`, sub: 'Neuer Fähigkeitspunkt — Handy › Profil', kind: 'level' });
        this.emit('sfx', { s: 'levelup' });
      }
    },
    learn(k) {
      const P = this.P;
      if (P.sp <= 0 || (P.skills[k] || 0) >= 5) return false;
      P.sp--; P.skills[k] = (P.skills[k] || 0) + 1;
      if (k === 'fitness') { this.player.maxHp = this.maxHp(); this.player.hp += 10; }
      this.emit('sfx', { s: 'levelup' });
      return true;
    },

    // ------------------------------------------------------------ death / arrest
    respawnAtHospital() {
      const P = this.P, a = this.player;
      const h = this.buildings.find((b) => b.type === 'hospital');
      const fee = Math.min(P.money, Math.round(Math.max(500, P.money * 0.15)));
      P.money -= fee;
      let lost = 0;
      if (this.wanted >= 2) { for (let i = P.weapons.length - 1; i > 0; i--) if (W8[P.weapons[i].id].type === 'gun') { P.weapons.splice(i, 1); lost++; } P.slot = 0; }
      if (P.jail) { if (P.outfit === 'prisoner') { P.outfit = P.jail.prev; a.outfit = P.outfit; } P.jail = null; }
      P.surrender = false; this.timeScale = 1; this.charges = {};
      a.alive = true; a.dead = false; a.hp = this.maxHp() * 0.6; a.bleed = 0; a.ko = 0; a.stun = 0; a.removed = false; a.vx = a.vy = 0;
      if (!this.byId.has(a.id)) this.byId.set(a.id, a);
      if (!this.actors.includes(a)) this.actors.push(a);
      a.x = (h.entrance.x + 0.5) * TILE; a.y = (h.entrance.y + 1.5) * TILE;
      this.time += 6 * 60;
      P.hunger = Math.max(P.hunger, 40); P.thirst = Math.max(P.thirst, 40);
      this.wanted = 0; this.drag = null;
      this.player.wi = this.curWeapon();
      this.emit('respawn', { fee, lost });
    },
    // ------------------------------------------------------------ save
    serialize() {
      if (this.syncOwned) this.syncOwned();
      const P = this.P, a = this.player;
      return {
        v: 1, seed: this.seed, time: this.time, weather: this.weather.kind,
        P: JSON.parse(JSON.stringify({ ...P, instinct: false })), hp: a.hp, armor: a.armor, x: a.x, y: a.y,
        offers: this.offers.map((o) => o.seedData), contract: this.contract && this.contract.status === 'active' ? this.contract.seedData : null,
        contractsDone: this.contractsDone,
      };
    },
    applySave(s) {
      Object.assign(this.P, s.P);
      this.time = s.time; this.weather.kind = s.weather || 'clear';
      const a = this.player;
      a.hp = s.hp || 100; a.armor = s.armor || 0; a.x = s.x; a.y = s.y; a.outfit = this.P.outfit; a.maxHp = this.maxHp();
      a.wi = this.curWeapon();
      this.markOwned();
      if (this.restorePlaced) { if (!Array.isArray(this.P.placed)) this.P.placed = []; this.restorePlaced(); }
      this.contractsDone = s.contractsDone || 0;
      this.offers = (s.offers || []).map((sd) => this.makeContract(sd)).filter(Boolean);
      if (s.contract) { const c = this.makeContract(s.contract); if (c) this.acceptContract(c, true); }
    },
  });
})(globalThis.K = globalThis.K || {});
