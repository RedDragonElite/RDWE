/* RDE // KONTRAKT — your crew. Inspired by RDE Bodyguards: hire fighters from a broker, each with a
 * rarity, a personality and five skills. They follow you in formation, ride along in your car, fight
 * whoever threatens you, heal themselves, level up, grow a bond with you, want their daily wage —
 * and if they go down, the clinic keeps them for a day. */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE;

  const C = K.CREW = {
    maxOwned: 8, maxActive: 3,
    rarities: [
      { key: 'common', name: 'Gewöhnlich', w: 60, bonus: 0, price: 0, col: '#9ca3af' },
      { key: 'uncommon', name: 'Ungewöhnlich', w: 25, bonus: 10, price: 1500, col: '#4ade80' },
      { key: 'rare', name: 'Selten', w: 10, bonus: 25, price: 4000, col: '#60a5fa' },
      { key: 'epic', name: 'Episch', w: 4, bonus: 45, price: 9000, col: '#a78bfa' },
      { key: 'legendary', name: 'Legendär', w: 1, bonus: 70, price: 20000, col: '#fbbf24' },
    ],
    skills: { shoot: 'Schießen', melee: 'Nahkampf', stamina: 'Ausdauer', tactics: 'Taktik', medic: 'Medizin' },
    pers: {
      stoic: { name: 'Stoisch', idle: ['…', 'Ruhig hier.', 'Alles sauber.'], combat: ['Ziel erfasst.', 'Bin dran.', 'Feuer.'], protect: ['Ich hab dich.', 'Bleib zurück.', 'Deckung!'], level: ['Werde besser.', 'Schärfer.'], bond: ['…Respekt.', 'Bist selbst nicht schlecht.'] },
      loyal: { name: 'Loyal', idle: ['Ich pass auf dich auf.', 'Ich steh hinter dir, Boss.', 'Bei mir bist du sicher.'], combat: ['Keiner fasst den Boss an!', 'Ich regel das!', 'Bleib hinter mir!'], protect: ['Für dich fang ich jede Kugel.', 'Ich bin da!'], level: ['Werde stärker — für dich, Boss.'], bond: ['Du bedeutest mir was.', 'Durch dick und dünn.'] },
      aggressive: { name: 'Aggressiv', idle: ['Komm doch.', 'Soll’s einer versuchen.', 'Gib mir nur einen Grund.'], combat: ['LOS GEHT’S!', 'Na komm schon!', 'Ich leg euch alle um!'], protect: ['Bleib bloß weg!', 'Willst du was?!'], level: ['Unaufhaltsam.', 'Mehr. MEHR.'], bond: ['Du bist der Einzige, den ich respektiere.'] },
      caring: { name: 'Fürsorglich', idle: ['Alles okay bei dir?', 'Wie hältst du dich?', 'Ich bin da.'], combat: ['Ich beschütz dich!', 'Hinter mich!', 'Die rühren dich nicht an!'], protect: ['Bist du verletzt?', 'Ich hab dich!'], level: ['Wir werden zusammen stärker.'], bond: ['Für dich würd ich alles tun.', 'Du bist mehr als nur ein Auftraggeber.'] },
      pro: { name: 'Profi', idle: ['Alles klar.', 'Sektor gesichert.', 'Keine Bedrohung.'], combat: ['Bekämpfe Ziel.', 'Bedrohung neutralisiert.', 'Bereich sauber.'], protect: ['Bleiben Sie dicht bei mir.', 'Ich sichere die Umgebung.'], level: ['Fähigkeiten verbessert. Einsatzbereit.'], bond: ['Sie haben meine volle Loyalität.'] },
    },
    tiers: [
      { name: 'Angeheuert', req: 0, col: '#9ca3af' }, { name: 'Kamerad', req: 300, col: '#60a5fa' }, { name: 'Vertrauter', req: 1200, col: '#34d399' },
      { name: 'Blutsbruder', req: 3500, col: '#fbbf24' }, { name: 'Legendäre Bindung', req: 8000, col: '#a855f7' },
    ],
    morale: [
      { min: 80, name: 'Motiviert', mult: 1.2, col: '#10b981' }, { min: 50, name: 'Stabil', mult: 1, col: '#3b82f6' },
      { min: 25, name: 'Erschüttert', mult: 0.8, col: '#f59e0b' }, { min: 0, name: 'Gebrochen', mult: 0.55, col: '#ef4444' },
    ],
    formations: {
      follow: { name: 'Folgen', slots: [[180, 1.9], [145, 2.6], [215, 2.6]] },
      diamond: { name: 'Raute', slots: [[180, 2], [90, 2], [270, 2]] },
      wedge: { name: 'Keil', slots: [[150, 2.4], [210, 2.4], [180, 3.8]] },
      stack: { name: 'Kolonne', slots: [[180, 1.7], [180, 3], [180, 4.3]] },
    },
    stances: { peaceful: 'Friedlich', defensive: 'Defensiv', aggressive: 'Aggressiv' },
    outfits: ['leather', 'bouncer', 'casual', 'hoodie', 'suitgrey', 'gang', 'suit'],
  };
  const tierOf = (m) => { let t = 0; C.tiers.forEach((x, i) => { if (m.bond >= x.req) t = i; }); return t; };
  const moraleOf = (m) => C.morale.find((x) => m.morale >= x.min) || C.morale[3];
  const xpNeed = (l) => Math.round(200 * Math.pow(1.15, l - 1));
  K.crewTier = tierOf; K.crewMorale = moraleOf; K.crewXpNeed = xpNeed;

  K.mixin({
    // ============================================================ roster
    crewRoster() { return this.P.crew || (this.P.crew = []); },
    crewMember(id) { return this.crewRoster().find((m) => m.id === id); },
    crewActor(m) { return this.actors.find((a) => a.kind === 'crew' && a.crewId === m.id && !a.removed && a.alive); },
    crewActors() { return this.actors.filter((a) => a.kind === 'crew' && a.alive && !a.removed); },
    makeRecruit() {
      let r = Math.random() * 100, rar = C.rarities[0];
      for (const x of C.rarities) { if (r < x.w) { rar = x; break; } r -= x.w; }
      const female = Math.random() < 0.3, persKeys = Object.keys(C.pers);
      const skills = {};
      for (const k in C.skills) skills[k] = U.clamp(Math.round(12 + Math.random() * 30 + rar.bonus * (0.5 + Math.random() * 0.5)), 5, 100);
      const sum = Object.values(skills).reduce((a, b) => a + b, 0);
      const price = Math.round((1500 + Math.random() * 2500 + sum * 10 + rar.price) / 50) * 50;
      const best = skills.melee > skills.shoot + 15 ? 'bat' : rar.bonus >= 45 ? U.pick(['mpk', 'p9']) : 'p9';
      return {
        name: U.pick(K.NAMES.first) + ' ' + U.pick(K.NAMES.last), female, skin: U.pick(K.SKINS), hair: U.pick(K.HAIR),
        outfit: U.pick(C.outfits), rarity: rar.key, pers: U.pick(persKeys), skills, price, wage: Math.round(price * 0.03 / 10) * 10 + 60, weapon: best,
      };
    },
    crewOffers() {
      const P = this.P;
      if (!P.crewOffers || P.crewOffers.day !== this.today()) P.crewOffers = { day: this.today(), list: [0, 1, 2].map(() => this.makeRecruit()) };
      return P.crewOffers.list;
    },
    hireCrew(i) {
      const P = this.P, list = this.crewOffers(), c = list[i];
      if (!c || c.hired) return false;
      if (this.crewRoster().length >= C.maxOwned) { this.notify(`Mehr als ${C.maxOwned} Leute kannst du nicht bezahlen.`, 'bad'); return false; }
      if (!this.pay(c.price)) { this.notify('Nicht genug Geld.', 'bad'); return false; }
      P.crewSeq = (P.crewSeq || 0) + 1;
      const m = { ...c, id: P.crewSeq, level: 1, xp: 0, bond: 0, morale: 75, kills: 0, state: 'idle', kits: 2, hp: null, talkT: -999, since: this.today() };
      delete m.hired; delete m.price;
      c.hired = true;
      this.crewRoster().push(m);
      this.emit('sfx', { s: 'accept' });
      this.emit('banner', { title: m.name.toUpperCase(), sub: `${C.rarities.find((x) => x.key === m.rarity).name} · ${C.pers[m.pers].name} — gehört jetzt zu deiner Crew`, kind: 'gold' });
      return true;
    },
    crewMaxHp(m) { return Math.round(100 + m.skills.stamina * 0.6 + (m.level - 1) * 3); },
    applyCrewStats(a, m) {
      const mult = moraleOf(m).mult * (1 + tierOf(m) * 0.03);
      a.acc = U.clamp((3.6 - m.skills.shoot / 100 * 2.1) / mult, 1.2, 4.5);
      a.speedMul = 1 + m.skills.stamina * 0.0025;
      a.maxHp = this.crewMaxHp(m);
      a.meleeMul = (0.8 + m.skills.melee / 100 * 0.9) * mult;
    },
    callCrew(id) {
      const m = this.crewMember(id); if (!m) return false;
      if (m.state === 'down') { this.notify(`${m.name} liegt noch in der Klinik.`, 'bad'); return false; }
      if (m.state === 'active') return true;
      if (this.crewRoster().filter((x) => x.state === 'active').length >= C.maxActive) { this.notify(`Maximal ${C.maxActive} Leute gleichzeitig unterwegs.`, 'bad'); return false; }
      if (this.P.jail) return false;
      m.state = 'active';
      this.spawnCrewActor(m, false);
      this.notify(`${m.name} ist unterwegs zu dir.`, 'good');
      this.emit('sfx', { s: 'phone' });
      return true;
    },
    spawnCrewActor(m, close) {
      const p = this.player;
      let x = p.x, y = p.y;
      if (close) {
        for (let k = 0; k < 20; k++) { const a = Math.random() * U.TAU, r = 30 + Math.random() * 40; const tx = p.x + Math.cos(a) * r, ty = p.y + Math.sin(a) * r; if (!this.blockedTile(this.tileIdx(tx, ty), null) && K.los(this, p.x, p.y, tx, ty)) { x = tx; y = ty; break; } }
      } else {
        // a sidewalk tile 12–24 tiles away, preferably out of sight
        let alt = null;
        for (let k = 0; k < 400; k++) {
          const i = U.pick(this.city.walk), tx = (i % this.W + 0.5) * TILE, ty = (((i / this.W) | 0) + 0.5) * TILE;
          const d = Math.hypot(tx - p.x, ty - p.y);
          if (d < 12 * TILE || d > 24 * TILE) continue;
          if (d < 18 * TILE && K.los(this, p.x, p.y, tx, ty)) { alt = alt || [tx, ty]; continue; }
          alt = [tx, ty]; break;
        }
        if (alt) [x, y] = alt;
      }
      const a = this.spawnActor('crew', x, y, { outfit: m.outfit, female: m.female, skin: m.skin, hair: m.hair, name: m.name, weapon: this.P.crewHolster ? 'fists' : m.weapon, hp: this.crewMaxHp(m), reserve: -1, state: 'follow' });
      a.crewId = m.id; a.hp = m.hp != null ? U.clamp(m.hp, 20, this.crewMaxHp(m)) : this.crewMaxHp(m);
      a.brain.slot = this.crewActors().length - 1; a.brain.chatT = 30 + Math.random() * 60;
      this.applyCrewStats(a, m);
      return a;
    },
    sendHome(id) {
      const m = this.crewMember(id); if (!m || m.state !== 'active') return;
      m.state = 'idle';
      const a = this.crewActor(m);
      if (a) { m.hp = a.hp; if (a.inCar) { const c = this.cars.find((q) => q.id === a.inCar); if (c) this.ejectFrom(c, a, false); } a.state = 'crewleave'; a.brain.ex = null; a.foe = 0; this.bark(a, U.pick(['Bis später, Boss.', 'Ruf an, wenn du mich brauchst.', 'Feierabend.']), 2); }
    },
    fireCrew(id) {
      const R = this.crewRoster(), i = R.findIndex((m) => m.id === id); if (i < 0) return;
      const m = R[i];
      if (m.state === 'active') this.sendHome(id);
      R.splice(i, 1);
      this.notify(`${m.name} ist raus aus der Crew.`);
    },
    crewHospitalFee(m) { return 800 + m.level * 100; },
    crewRevive(id) {
      const m = this.crewMember(id); if (!m || m.state !== 'down') return false;
      if (!this.pay(this.crewHospitalFee(m))) { this.notify('Nicht genug Geld für die Klinik.', 'bad'); return false; }
      m.state = 'idle'; m.hp = null; this.notify(`${m.name} ist entlassen und wieder einsatzbereit.`, 'good');
      return true;
    },
    talkCrew(m) {
      const a = this.crewActor(m);
      if (this.time - m.talkT < 180) { if (a) this.bark(a, U.pick(C.pers[m.pers].idle), 2); return; }
      m.talkT = this.time;
      const t0 = tierOf(m);
      m.bond += 15 + U.rint(45); m.morale = Math.min(100, m.morale + 15);
      if (a) this.bark(a, U.pick(C.pers[m.pers].bond), 2.4);
      if (tierOf(m) > t0) this.crewTierUp(m);
      this.emit('sfx', { s: 'cloth' });
    },
    crewTierUp(m) {
      const t = C.tiers[tierOf(m)];
      this.emit('banner', { title: t.name.toUpperCase(), sub: `Deine Bindung zu ${m.name} wächst`, kind: 'gold' });
      const a = this.crewActor(m); if (a) this.applyCrewStats(a, m);
    },
    crewGain(m, xp, bond) {
      const t0 = tierOf(m);
      m.bond += bond || 0;
      if (tierOf(m) > t0) this.crewTierUp(m);
      m.xp += xp;
      while (m.xp >= xpNeed(m.level) && m.level < 50) {
        m.xp -= xpNeed(m.level); m.level++;
        const ks = Object.keys(C.skills), k1 = U.pick(ks), k2 = U.pick(ks);
        m.skills[k1] = Math.min(100, m.skills[k1] + 3); m.skills[k2] = Math.min(100, m.skills[k2] + 2);
        const a = this.crewActor(m);
        if (a) { this.applyCrewStats(a, m); this.bark(a, U.pick(C.pers[m.pers].level), 2.2); }
        this.notify(`${m.name} erreicht Stufe ${m.level} (+${C.skills[k1]}, +${C.skills[k2]})`, 'good');
      }
    },

    // ============================================================ commands
    crewCommand(cmd, arg) {
      const P = this.P, crew = this.crewActors(), p = this.player;
      const say = (lines) => { const a = U.pick(crew); if (a) { const m = this.crewMember(a.crewId); this.bark(a, U.pick(m ? C.pers[m.pers][lines] || lines : lines), 1.8); } };
      switch (cmd) {
        case 'follow': P.crewMode = 'follow'; for (const a of crew) if (a.state !== 'hostile') { a.state = 'follow'; a.goal = null; } say('idle'); break;
        case 'stay': P.crewMode = 'stay'; for (const a of crew) { a.brain.hold = { x: a.x, y: a.y }; if (a.state !== 'hostile') { a.state = 'stay'; a.goal = null; } } this.notify('Crew hält die Position.'); break;
        case 'formation': { const ks = Object.keys(C.formations); P.crewForm = ks[(ks.indexOf(P.crewForm || 'follow') + 1) % ks.length]; this.notify(`Formation: ${C.formations[P.crewForm].name}`); break; }
        case 'stance': P.crewStance = arg; this.notify(`Crew-Haltung: ${C.stances[arg]}`); if (arg === 'peaceful') for (const a of crew) if (a.state === 'hostile') this.calmDown(a); break;
        case 'attack': {
          let t = null, bd = 4 * TILE;
          for (const q of this.near(this.aimX, this.aimY, 4 * TILE)) {
            if (!q.alive || q.removed || q.kind === 'crew' || q === p || q.inCar) continue;
            const d = Math.hypot(q.x - this.aimX, q.y - this.aimY); if (d < bd) { bd = d; t = q; }
          }
          if (!t) { this.notify('Kein Ziel im Visier.', 'bad'); return false; }
          for (const a of crew) { this.alarm(a, t); a.brain.react = 0.2; }
          say('combat'); this.emit('sfx', { s: 'beep' });
          if (!t.crim && t.state !== 'hostile') this.crimeEvent(p, 'assault', t.x, t.y, t);
          break;
        }
        case 'attackAll': {
          P.crewStance = 'aggressive';
          for (const a of crew) this.scan_crew(a, 16 * TILE, true);
          say('combat'); break;
        }
        case 'holster': P.crewHolster = !P.crewHolster; for (const a of crew) { const m = this.crewMember(a.crewId); a.wi = { id: P.crewHolster ? 'fists' : m.weapon, mag: K.WEAPONS[m.weapon].mag || 0 }; } this.notify(P.crewHolster ? 'Crew: Waffen weg.' : 'Crew: Waffen ziehen.'); break;
        case 'heal': {
          let best = null;
          for (const a of crew) { const m = this.crewMember(a.crewId); if (Math.hypot(a.x - p.x, a.y - p.y) < 5 * TILE && m.kits > 0 && (!best || m.skills.medic > best.m.skills.medic)) best = { a, m }; }
          if (!best) { this.notify('Niemand mit Verbandszeug in der Nähe.', 'bad'); return false; }
          if (p.hp >= p.maxHp) { this.notify('Du bist nicht verletzt.'); return false; }
          best.m.kits--; p.hp = Math.min(p.maxHp, p.hp + 25 + best.m.skills.medic * 0.4); p.bleed = 0;
          this.bark(best.a, U.pick(['Halt still.', 'Das wird wieder.', 'Zähne zusammenbeißen.']), 2);
          this.emit('sfx', { s: 'heal' }); this.crewGain(best.m, 25, 30);
          break;
        }
        case 'give': {
          const m = this.crewMember(arg), w = P.weapons[P.slot];
          if (!m || !w || w.id === 'fists' || !['gun', 'melee'].includes(K.WEAPONS[w.id].type)) { this.notify('Nimm erst die Waffe in die Hand, die du abgeben willst.', 'bad'); return false; }
          P.weapons.splice(P.slot, 1); P.slot = 0;
          if (m.weapon !== 'fists' && m.weapon !== 'p9') this.addWeapon(m.weapon, {});
          m.weapon = w.id;
          const a = this.crewActor(m); if (a && !P.crewHolster) a.wi = { id: w.id, mag: K.WEAPONS[w.id].mag || 0, sup: !!w.sup };
          this.notify(`${m.name} trägt jetzt: ${K.WEAPONS[w.id].name}`, 'good');
          break;
        }
        case 'dismissAll': for (const m of this.crewRoster()) if (m.state === 'active') this.sendHome(m.id); break;
      }
      return true;
    },

    // ============================================================ AI
    scan_crew(a, range, force) {
      if (a.state === 'hostile' || a.ko > 0 || a.inCar) return;
      const stance = this.P.crewStance || 'defensive', ids = new Set(this.crewActors().map((x) => x.id));
      if (stance === 'peaceful' && !force) return;
      let best = null, bd = range;
      for (const t of this.near(a.x, a.y, range)) {
        if (!t.alive || t.removed || t.ko > 0 || t.kind === 'crew' || t.kind === 'player' || t.inCar || t.state === 'cuffed') continue;
        const threat = t.state === 'hostile' && (!t.foe || ids.has(t.foe));
        const prey = (stance === 'aggressive' || force) && ((t.kind === 'gang' && this.gangHostile && this.gangHostile(t)) || (t.kind === 'thug' && t.crim) || t.state === 'warn');
        if (!threat && !prey) continue;
        const d = Math.hypot(t.x - a.x, t.y - a.y);
        if (d >= bd || !(this.sees(a, t.x, t.y, range, 1.6) || (d < 6 * TILE && K.los(this, a.x, a.y, t.x, t.y)))) continue;
        bd = d; best = t;
      }
      if (!best) return;
      const m = this.crewMember(a.crewId);
      this.alarm(a, best);
      if (m) this.bark(a, U.pick(best.foe === 0 ? C.pers[m.pers].protect : C.pers[m.pers].combat), 1.8);
    },
    /** somebody hurt the boss: every crew member who isn't busy goes for them */
    crewProtect(src) {
      if (!src.alive || src.kind === 'crew' || (this.P.crewStance || 'defensive') === 'peaceful') return;
      for (const a of this.crewActors()) {
        if (a.inCar || a.ko > 0 || (a.state === 'hostile' && a.foe !== src.id && this.byId.get(a.foe))) continue;
        if (Math.hypot(a.x - src.x, a.y - src.y) > 22 * TILE) continue;
        const m = this.crewMember(a.crewId);
        if (a.state !== 'hostile' && m) this.bark(a, U.pick(C.pers[m.pers].protect), 1.8);
        this.alarm(a, src);
      }
    },
    crewSlot(a) {
      const p = this.player, f = C.formations[this.P.crewForm || 'follow'];
      const crew = this.crewActors().filter((x) => !x.inCar), i = Math.max(0, crew.indexOf(a));
      const [deg, dist] = f.slots[i % f.slots.length];
      const ang = p.angle + deg * Math.PI / 180;
      let x = p.x + Math.cos(ang) * dist * TILE, y = p.y + Math.sin(ang) * dist * TILE;
      if (this.blockedTile(this.tileIdx(x, y), a) || !K.los(this, p.x, p.y, x, y)) { x = p.x - Math.cos(p.angle) * TILE * (1 + i * 0.6); y = p.y - Math.sin(p.angle) * TILE * (1 + i * 0.6); }
      return [x, y, ang];
    },
    ai_follow(a, dt) {
      const p = this.player;
      if (this.P.crewMode === 'stay') { a.state = 'stay'; a.brain.hold = a.brain.hold || { x: a.x, y: a.y }; return; }
      if (!p.alive) { a.dv = [0, 0]; return; }
      if (p.inCar) {
        const c = this.carOf(p);
        const d = Math.hypot(c.x - a.x, c.y - a.y);
        if (d < 2.6 * TILE && (c.speed || 0) < 60 && (c.passengers || []).length < 3) {
          a.inCar = c.id; (c.passengers || (c.passengers = [])).push(a.id); a.path = null; a.goal = null; this.emit('door', { x: c.x, y: c.y }); return;
        }
        this.goTo(a, c.x, c.y, { tol: 40 }); a.dv = this.steer(a, 175 * a.speedMul, dt); return;
      }
      const [sx, sy, sa] = this.crewSlot(a);
      const d = Math.hypot(sx - a.x, sy - a.y), dp = Math.hypot(p.x - a.x, p.y - a.y);
      if (d > 0.7 * TILE) {
        this.goTo(a, sx, sy, { tol: 18 });
        const run = dp > 6 * TILE || (p.speed || 0) > 150;
        a.dv = this.steer(a, (run ? 178 : dp > 3 * TILE ? 140 : 105) * a.speedMul, dt);
        a.crouch = !!p.crouch && !run;
      } else { a.dv = [0, 0]; a.faceTo = sa + Math.PI; a.crouch = !!p.crouch; }
      a.brain.chatT -= dt;
      if (a.brain.chatT <= 0) { a.brain.chatT = 50 + Math.random() * 80; const m = this.crewMember(a.crewId); if (m && Math.random() < 0.5) this.bark(a, U.pick(C.pers[m.pers].idle), 2); }
    },
    ai_stay(a, dt) {
      if (this.P.crewMode !== 'stay') { a.state = 'follow'; return; }
      const h = a.brain.hold || (a.brain.hold = { x: a.x, y: a.y });
      if (Math.hypot(h.x - a.x, h.y - a.y) > 0.8 * TILE) { this.goTo(a, h.x, h.y, { tol: 16 }); a.dv = this.steer(a, 120, dt); return; }
      a.dv = [0, 0]; a.brain.look = (a.brain.look || 0) - dt;
      if (a.brain.look <= 0) { a.brain.look = 2 + Math.random() * 3; a.brain.face = Math.random() * U.TAU; }
      a.faceTo = a.brain.face;
    },
    ai_crewleave(a, dt) {
      if (!a.brain.ex) { a.brain.ex = this.randomWalkNear(a, 20, 30); a.goal = null; }
      this.goTo(a, a.brain.ex[0], a.brain.ex[1], { tol: 40 });
      a.dv = this.steer(a, 120, dt);
      const p = this.player;
      if (a.arrived || Math.hypot(a.x - p.x, a.y - p.y) > 30 * TILE) this.removeActor(a);
    },

    // ============================================================ upkeep
    updateCrew(dt) {
      const P = this.P, R = this.crewRoster(), p = this.player;
      if (!R.length) return;
      // daily wages at the start of each new day
      const day = this.today();
      if (P.crewDay == null) P.crewDay = day;
      if (P.crewDay !== day) {
        P.crewDay = day;
        const total = R.reduce((s, m) => s + m.wage, 0);
        if (total > 0 && this.pay(total)) this.notify(`Crew-Löhne bezahlt: −${U.money(total)}`, 'money');
        else if (total > 0) {
          for (const m of R) { m.morale = Math.max(0, m.morale - 25); m.bond = Math.max(0, m.bond - 100); }
          this.notify('Du konntest deine Crew nicht bezahlen. Die Stimmung kippt.', 'bad');
          for (const m of R.slice()) if (m.morale <= 0) { this.fireCrew(m.id); this.notify(`${m.name} hat gekündigt.`, 'bad'); }
        }
      }
      const actives = this.crewActors();
      for (const m of R) {
        if (m.state === 'down' && this.time >= m.downUntil) { m.state = 'idle'; m.hp = null; this.notify(`${m.name} ist aus der Klinik entlassen.`, 'good'); }
        if (m.state === 'idle') m.morale = Math.min(75, m.morale + dt / 60 * 3);
        if (m.state !== 'active') continue;
        let a = actives.find((x) => x.crewId === m.id);
        if (!a) { if (P.jail) { m.state = 'idle'; continue; } a = this.spawnCrewActor(m, true); }
        m.hp = a.hp;
        m.morale = Math.max(0, m.morale - dt / 60 * 1);
        m.bondT = (m.bondT || 0) + dt;
        if (m.bondT > 600) { m.bondT = 0; this.crewGain(m, 4, 6); }
        // riding along
        if (a.inCar) {
          const c = this.cars.find((q) => q.id === a.inCar);
          if (!c || c.dead || c.driver !== 'player' || !p.inCar) { if (c) this.ejectFrom(c, a, false); else a.inCar = null; if (c) c.passengers = (c.passengers || []).filter((id) => id !== a.id); a.state = 'follow'; }
          else { a.x = c.x; a.y = c.y; a.angle = c.a; }
          continue;
        }
        // lost behind? catch up off-screen
        if (!p.inCar && Math.hypot(a.x - p.x, a.y - p.y) > 40 * TILE && a.state !== 'hostile') { const n = this.spawnCrewActor(m, false); n.hp = a.hp; this.removeActor(a); a = n; }
        // self-heal when out of the fight
        if (a.hp < a.maxHp * 0.45 && a.state !== 'hostile' && m.kits > 0 && this.t > (a.healCd || 0)) {
          a.healCd = this.t + 20; m.kits--; a.hp = Math.min(a.maxHp, a.hp + 35 + m.skills.medic * 0.3); a.bleed = 0;
          this.bark(a, 'Verbinde mich kurz…', 1.6); this.emit('sfx', { s: 'heal' }); this.crewGain(m, 8, 0);
        }
        if (P.crewHolster && a.state === 'hostile' && a.wi.id === 'fists' && m.weapon !== 'fists') a.wi = { id: m.weapon, mag: K.WEAPONS[m.weapon].mag || 0 };
      }
    },
    crewDown(t) {
      const m = this.crewMember(t.crewId); if (!m) return;
      m.state = 'down'; m.downUntil = this.time + 24 * 60; m.hp = null;
      m.morale = Math.max(0, m.morale - 30); m.bond = Math.max(0, m.bond - 150);
      for (const o of this.crewRoster()) if (o !== m && o.state === 'active') o.morale = Math.max(0, o.morale - 10);
      this.emit('banner', { title: `${m.name.toUpperCase()} IST DOWN`, sub: `St. Marien Klinik · 24 Std. oder ${U.money(this.crewHospitalFee(m))} für sofort`, kind: 'red' });
    },
    crewKill(src, t) {
      const m = this.crewMember(src.crewId); if (!m) return;
      m.kills++; m.morale = Math.min(100, m.morale + 8);
      const protect = t.state === 'hostile' && !t.foe;
      this.crewGain(m, t.kind === 'cop' ? 120 : 60, protect ? 40 : 10);
      if (protect) m.morale = Math.min(100, m.morale + 12);
      // your people, your charge sheet
      if (t.kind === 'cop') { this.addCharge('copkill'); this.raiseWanted(Math.max(3, this.wanted), 'copkill'); }
      else if (t.state !== 'hostile' && !t.crim) this.crimeEvent(this.player, 'murder', t.x, t.y, t);
    },
    /** prompt near your own people and at the broker */
    crewContext(add) {
      const a = this.player;
      if (a.inCar || this.drag) return false;
      for (const b of this.near(a.x, a.y, 44)) {
        if (b.broker && b.alive && b.ko <= 0 && Math.hypot(b.x - a.x, b.y - a.y) < 44) { add('E', `${b.name}: Crew anheuern`, () => { this.bark(b, U.pick(['Ich hab da ein paar Leute für dich.', 'Gute Leute kosten. Die besten noch mehr.']), 2); this.emit('ui', { open: 'recruit' }); }); return true; }
        if (b.kind === 'crew' && b.alive && b.state !== 'hostile' && Math.hypot(b.x - a.x, b.y - a.y) < 40) { const m = this.crewMember(b.crewId); if (m) add('T', `Mit ${m.name.split(' ')[0]} reden`, () => this.talkCrew(m)); }
      }
      return false;
    },
  });
})(globalThis.K = globalThis.K || {});
