/* RDE // KONTRAKT — NPC brains: civilians, shopkeepers, staff, guards, police, gangs, targets & bodyguards */
(function (K) {
  'use strict';
  const tr = K.tr;   // translate (K.T is the tile table)
  const U = K.U, T = K.T, TILE = K.TILE, W8 = K.WEAPONS;
  const tc = (i, W) => [(i % W + 0.5) * TILE, (((i / W) | 0) + 0.5) * TILE];

  const LINES = {
    chat: ['Did you hear about the Kowalskis?', 'The rent around here… insane.', 'Supposed to rain tomorrow.', 'I need a vacation.', 'The docks aren’t safe at night.', 'Got a light?', 'The cops are asleep anyway.', 'Nice suit, by the way.', 'You know the club “Night Moth”?', 'My boss is a monster.'],
    scared: ['Help!!', 'Don’t shoot!', 'Oh my God!', 'Run!', 'Please don’t!', 'Police! POLICE!'],
    trespass: ['Hey! No entry here!', 'You’ve got no business here.', 'Out. Now.', 'Stop! Private property!'],
    disguise: ['Wait… I don’t know you.', 'Hey, you. New here?', 'Let’s see your ID.'],
    hostile: ['There he is!', 'Open fire!', 'Freeze!', 'He’s armed!', 'Get him!'],
    search: ['Where’d he go…?', 'Come out, I know you’re there.', 'Search everything!', 'Stay sharp.'],
    coin: ['What was that?', 'Huh? A coin?', 'Who’s there?'],
    body: ['Oh God… he’s dead!', 'A body!!', 'Man down!'],
    weaponDown: ['Weapon down!', 'Drop it!', 'Police! Drop the weapon!'],
    arrest: ['Freeze! Hands up!', 'Don’t move! You’re under arrest!'],
    keeper: ['Welcome!', 'What can I get you?', 'Take a look around.'],
  };
  K.LINES = K.i18nStrings(LINES);

  K.mixin({
    // ============================================================ population
    populate() {
      this.markOwned();
      const pos = this.homeBed('bude');
      const p = this.player = this.spawnActor('player', pos.x, pos.y, { outfit: 'suit', hp: 100, skin: '#e9c4a2', hair: null, female: false, name: 'Agent' });
      p.wi = this.curWeapon(); p.r = 10;
      const rpos = (t) => [(t.x + 0.5) * TILE, (t.y + 0.5) * TILE];
      for (const b of this.buildings) {
        if (b.keeperPos && b.shop) {
          const outfit = { gun: 'leather', black: 'gang', food: 'casual', pharmacy: 'doctor', cloth: 'suitgrey', diner: 'waiter', bar: 'waiter', hospital: 'doctor', bank: 'suitgrey', jewel: 'suit', gas: 'casual', cars: 'suit', mech: 'mechanic', beachbar: 'hawaii', strip: 'waiter' }[b.shop] || 'casual';
          const [x, y] = rpos(b.keeperPos);
          const k = this.spawnActor('keeper', x, y, { outfit, home: b.id, state: 'work', weapon: b.shop === 'gun' ? 'pump' : b.shop === 'black' ? 'p9' : 'fists', reserve: -1 });
          k.brain.post = { x, y }; k.armedKeeper = b.shop === 'gun' || b.shop === 'black'; k.shopB = b.id;
        }
        const roomOf = (role) => b.rooms.find((r) => r.role === role);
        const spawnStaff = (room, outfit, kind = 'staff', o = {}) => {
          if (!room) return null;
          const x = (room.x + 0.5 + Math.random() * (room.w - 1)) * TILE, y = (room.y + 0.5 + Math.random() * (room.h - 1)) * TILE;
          if (this.blockedTile(this.tileIdx(x, y), null)) return null;
          const s = this.spawnActor(kind, x, y, { outfit, home: b.id, state: 'work', zone: b.zone != null ? b.zone : -1, ...o });
          s.brain.room = room; return s;
        };
        if (b.type === 'diner') spawnStaff(roomOf('kitchen') || b.rooms[0], 'chef');
        if (b.type === 'hotel') { spawnStaff(b.rooms[1], 'waiter'); spawnStaff(b.rooms[2], 'waiter'); }
        if (b.type === 'hospital') { spawnStaff(b.rooms[1], 'doctor'); spawnStaff(b.rooms[2], 'doctor'); }
        if (b.type === 'office') spawnStaff(b.rooms[1], 'suitgrey', 'staff');
        if (b.type === 'bar') {   // the broker: hires out fighters
          const r = b.rooms[0];
          for (let k = 0; k < 12; k++) {
            const x = (r.x + 0.5 + Math.random() * (r.w - 1)) * TILE, y = (r.y + 0.5 + Math.random() * (r.h - 1)) * TILE;
            if (this.blockedTile(this.tileIdx(x, y), null)) continue;
            const m = this.spawnActor('staff', x, y, { outfit: 'leather', home: b.id, state: 'hang', female: false, name: tr('Fixer “Claw”') });
            m.broker = true; m.brain.post = { x, y }; m.important = true; break;
          }
        }
        if (b.type === 'bank') {   // the director carries the vault keycard
          let m = null; const offs = b.rooms.filter((r) => r.role === 'office');
          for (let k = 0; k < 12 && !m && offs.length; k++) m = spawnStaff(offs[k % offs.length], 'suit', 'staff');
          if (m) { m.loot = 'keycard'; m.director = true; m.name = tr('Director {name}', { name: U.pick(['Brandt', 'Vogel', 'Hartmann', 'Seidel']) }); }
        }
        if (b.type === 'club') { for (let k = 0; k < 5; k++) { const s = spawnStaff(b.rooms[0], U.pick(K.CIV_OUTFITS), 'civ'); if (s) { s.state = 'dance'; s.home = b.id; s.resident = true; } } spawnStaff(roomOf('vip'), 'waiter'); }
        if (b.type === 'villa' && b.zone != null) { spawnStaff(roomOf('kitchen') || b.rooms[1], 'chef'); spawnStaff(b.rooms[0], 'waiter'); }
        if (b.type === 'police') {
          for (let k = 0; k < 3; k++) { const r = b.rooms[k % b.rooms.length]; const x = (r.x + 0.5 + Math.random() * (r.w - 1)) * TILE, y = (r.y + 0.5 + Math.random() * (r.h - 1)) * TILE; if (this.blockedTile(this.tileIdx(x, y), null)) continue; const c = this.spawnCop(x, y, 'station'); c.station = true; c.home = b.id; c.brain.room = r; }
        }
      }
      // zone guards
      for (const z of this.zones) {
        if (z.dead || !z.guards) continue;
        const b = this.buildings[z.bld];
        for (let k = 0; k < z.guards; k++) {
          const pt = z.patrol[k % z.patrol.length];
          let i = this.nav.nearestFree(pt.y * this.W + pt.x, null, 3); if (i < 0) continue;
          const [x, y] = tc(i, this.W);
          const g = this.spawnActor('guard', x, y, { outfit: b.type === 'club' || b.type === 'stripclub' ? 'bouncer' : b.type === 'warehouse' ? 'gang' : 'guard', zone: z.id, home: b.id, weapon: Math.random() < 0.3 ? 'mpk' : 'p9', hp: 130, armor: 20, reserve: -1, state: 'patrol', female: Math.random() < 0.2, enforcer: k % 4 === 1 });
          g.acc = 2.2; g.brain.pi = k;
          if (b.type === 'warehouse') g.kind = 'gang';
          // the first guard at villas / clubs stands at the gate/door
          if (k === 0 && b.type === 'bank') {   // one guard watches the hall
            const md = b.doors[0], ii = this.nav.nearestFree((md.y - md.oy * 2) * this.W + md.x - md.ox * 2 + 2, g, 3);
            if (ii >= 0) { [g.x, g.y] = tc(ii, this.W); g.state = 'post'; g.brain.post = { x: g.x, y: g.y }; g.brain.face = -Math.PI / 2; g.zoneLobby = true; }
          }
          if (k === 0 && (b.type === 'villa' || b.type === 'club' || b.type === 'stripclub')) {
            const e = b.type === 'villa' && z.garden ? { x: z.garden.x + 8, y: z.garden.y + z.garden.h - 3 } : { x: b.entrance.x, y: b.entrance.y };
            const ii = this.nav.nearestFree(e.y * this.W + e.x, g, 3);
            if (ii >= 0) { [g.x, g.y] = tc(ii, this.W); g.state = 'post'; g.brain.post = { x: g.x, y: g.y }; g.brain.face = Math.PI / 2; }
          }
        }
      }
      // dock crew around the black market
      const bm = this.buildings.find((b) => b.type === 'black');
      if (bm) for (let k = 0; k < 3; k++) {
        const i = this.nav.nearestFree((bm.y + bm.h + 2) * this.W + bm.x + 3 + k * 4, null, 4); if (i < 0) continue;
        const [x, y] = tc(i, this.W);
        const g = this.spawnActor('gang', x, y, { outfit: 'gang', weapon: U.pick(['knife', 'bat', 'p9']), hp: 110, state: 'hang', reserve: -1 });
        g.brain.post = { x, y }; g.acc = 2.8;
      }
      this.bodies = [];
    },

    updatePopulation(dt) {
      const p = this.player;
      this.popT = (this.popT || 0) - dt;
      if (this.popT > 0) return;
      this.popT = 0.25;
      const h = this.hour();
      let want = h >= 8 && h < 20 ? 44 : h >= 20 ? 26 : h < 5 ? 10 : 22;
      want = Math.round(want * (1 - this.weather.rain * 0.45));
      let civs = 0, patrol = 0;
      for (const a of this.actors) {
        if (a.removed || !a.alive) continue;
        const d = Math.hypot(a.x - p.x, a.y - p.y);
        if (a.kind === 'civ' && !a.resident) {
          if (d > 50 * TILE && !a.reportT && !a.important) { this.removeActor(a); continue; }
          civs++;
        }
        if (a.kind === 'cop' && !a.station) {
          if (d > 60 * TILE && this.wanted === 0 && !a.unit) { this.removeActor(a); continue; }
          if (a.state === 'patrol') patrol++;
        }
      }
      let n = 0;
      while (civs < want && n++ < 3) { if (this.spawnCiv()) civs++; else break; }
      this.updateTraffic();
    },
    spawnCiv(near) {
      const p = this.player;
      for (let k = 0; k < 25; k++) {
        const i = U.pick(this.city.walk), [x, y] = tc(i, this.W);
        const d = Math.hypot(x - p.x, y - p.y);
        if (!near && (d < 16 * TILE || d > 42 * TILE)) continue;
        if (!near && d < 30 * TILE && K.los(this, p.x, p.y, x, y)) continue;
        const dist = this.districtAt(x, y);
        if ((dist === 'ind' || dist === 'docks') && Math.random() < 0.6) continue;
        const rich = dist === 'hill' || (dist === 'down' && Math.random() < 0.3);
        const a = this.spawnActor('civ', x, y, { outfit: rich && Math.random() < 0.5 ? U.pick(['rich', 'suitgrey', 'civ6', 'civ8']) : U.pick(K.CIV_OUTFITS), state: 'wander', wallet: rich ? 80 + U.rint(400) : 10 + U.rint(120) });
        a.speedMul = 0.85 + Math.random() * 0.3;
        if (Math.random() < 0.08) a.loot = 'watch';
        return a;
      }
      return null;
    },

    // ============================================================ movement
    goTo(a, x, y, opt = {}) {
      const g = a.goal;
      if (g && !opt.force && Math.hypot(g.x - x, g.y - y) < (opt.tol || 24) && (a.path || a.pendingPath)) return;
      a.goal = { x, y }; a.arrived = false;
      this.requestPath(a, x, y);
    },
    requestPath(a, x, y) {
      if ((this.pathBudget || 0) <= 0) { a.pendingPath = { x, y }; a.path = a.path || null; return false; }
      this.pathBudget--;
      const path = this.nav.find(a, a.x, a.y, x, y, 7000, a.crossOk ? 0.35 : 1);
      a.path = path; a.pathI = 0; a.pendingPath = null; a.stuckT = 0; a.smoothT = 0;
      if (!path) { a.arrived = true; a.goal = null; }
      else if (!path.length) a.arrived = true;
      return !!path;
    },
    steer(a, speed, dt) {
      if (a.pendingPath) { const g = a.pendingPath; this.requestPath(a, g.x, g.y); }
      const path = a.path;
      if (!path && a.pendingPath) return [0, 0]; // still waiting for the path finder
      if (!path || a.pathI >= path.length) {
        if (a.goal && path && Math.hypot(a.goal.x - a.x, a.goal.y - a.y) > 6) {
          const dx = a.goal.x - a.x, dy = a.goal.y - a.y, d = Math.hypot(dx, dy);
          if (d < 20) return [dx / d * speed * 0.6, dy / d * speed * 0.6];
        }
        a.arrived = true; return [0, 0];
      }
      a.smoothT -= dt;
      if (a.smoothT <= 0) {
        a.smoothT = 0.35;
        for (let k = Math.min(path.length - 1, a.pathI + 5); k > a.pathI; k--) {
          const [x, y] = tc(path[k], this.W);
          if (this.nav.clearLine(a, a.x, a.y, x, y)) { a.pathI = k; break; }
        }
      }
      const [tx, ty] = a.pathI === path.length - 1 && a.goal && Math.hypot(a.goal.x - tc(path[a.pathI], this.W)[0], a.goal.y - tc(path[a.pathI], this.W)[1]) < TILE ? [a.goal.x, a.goal.y] : tc(path[a.pathI], this.W);
      const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
      if (d < 9) { a.pathI++; if (a.pathI >= path.length) { a.arrived = true; } return [dx * 3, dy * 3]; }
      // stuck?
      if (a.speed < speed * 0.2) { a.stuckT = (a.stuckT || 0) + dt; if (a.stuckT > 1.4) { a.stuckT = 0; if (a.goal) this.requestPath(a, a.goal.x, a.goal.y); a.stuckN = (a.stuckN || 0) + 1; if (a.stuckN > 3) { a.stuckN = 0; a.path = null; a.arrived = true; a.goal = null; } } }
      else a.stuckT = 0;
      return [dx / d * speed, dy / d * speed];
    },
    randomWalkNear(a, rmin, rmax) {
      const W = this.W;
      for (let k = 0; k < 16; k++) {
        const i = U.pick(this.city.walk), [x, y] = tc(i, W);
        const d = Math.hypot(x - a.x, y - a.y);
        if (d >= rmin * TILE && d <= rmax * TILE) return [x, y];
      }
      const ang = Math.random() * U.TAU;
      return [a.x + Math.cos(ang) * rmin * TILE, a.y + Math.sin(ang) * rmin * TILE];
    },
    publicSpot(a) {
      // shop / diner / bar / park bench within reach
      const cands = this.buildings.filter((b) => (b.shop && b.shop !== 'black' && b.shop !== 'hospital' && this.shopOpen(K.SHOPS[b.shop])) && Math.hypot((b.x + b.w / 2) * TILE - a.x, (b.y + b.h / 2) * TILE - a.y) < 40 * TILE);
      if (!cands.length) return null;
      const b = U.pick(cands);
      const pois = b.pois.filter((p) => b.rooms[p.room] && b.rooms[p.room].front);
      const pt = pois.length ? U.pick(pois) : { x: b.entrance.x, y: b.entrance.y };
      return [(pt.x + 0.5) * TILE, (pt.y + 0.5) * TILE];
    },

    // ============================================================ main AI loop
    updateAI(dt) {
      this.pathBudget = 7;
      const p = this.player;
      this.bodyT = (this.bodyT || 0) - dt;
      if (this.bodyT <= 0) { this.bodyT = 0.4; this.bodies = this.actors.filter((x) => (!x.alive || x.ko > 0) && !x.hidden && !x.removed && x.kind !== 'player'); }
      for (const a of this.actors) {
        if (a.kind === 'player' || a.removed || !a.alive || a.inCar) continue;
        if (a.bark) { a.bark.t -= dt; if (a.bark.t <= 0) a.bark = null; }
        this.tickWeapon(a, dt);
        if (a.ko > 0 || a.dragBy) { a.vx *= 0.85; a.vy *= 0.85; a.seesPlayer = false; continue; }
        if (a.state === 'cuffed') { this.ai_cuffed(a, dt); a.vx *= 0.8; a.vy *= 0.8; a.seesPlayer = false; continue; }
        if (a.state === 'sleep') { this.ai_sleep(a, dt); continue; }   // eyes shut: only noise wakes them (hear)
        const far = Math.abs(a.x - p.x) > 55 * TILE || Math.abs(a.y - p.y) > 55 * TILE;
        a.thinkT = (a.thinkT || Math.random() * 0.2) - dt;
        if (a.thinkT <= 0) { const iv = far ? 1.2 : 0.16 + Math.random() * 0.06; this.perceive(a, iv); a.thinkT = iv; }
        if (far && a.kind !== 'target' && a.kind !== 'bodyguard' && a.state !== 'flee') { a.vx = a.vy = 0; continue; }
        a.dv = null; a.faceTo = null;
        const fn = this['ai_' + a.state] || this.ai_idle;
        fn.call(this, a, dt);
        let [dvx, dvy] = a.dv || [0, 0];
        if (a.inj && (a.inj.frac.legL || a.inj.frac.legR)) { dvx *= 0.55; dvy *= 0.55; }
        if (a.stun > 0) { dvx = 0; dvy = 0; }
        // look both ways before stepping onto the road
        if ((dvx || dvy) && a.state !== 'flee' && a.state !== 'hostile') {
          const ax = a.x + dvx * 0.35, ay = a.y + dvy * 0.35;
          if (this.tileAt(ax, ay) === T.ROAD) for (const c of this.cars) {
            if (c.dead || (c.speed || 0) < 30 || Math.abs(c.x - ax) > 170 || Math.abs(c.y - ay) > 170) continue;
            const dx = ax - c.x, dy = ay - c.y, f = dx * Math.cos(c.a) + dy * Math.sin(c.a);
            if (f > -30 && Math.abs(-dx * Math.sin(c.a) + dy * Math.cos(c.a)) < 46) { dvx = 0; dvy = 0; a.faceTo = Math.atan2(c.y - a.y, c.x - a.x); break; }
          }
        }
        this.moveActor(a, dvx, dvy, dt, a.stun > 0 ? 3 : 10);
        // facing
        if (a.faceTo != null) a.angle = U.turnTo(a.angle, a.faceTo, dt * 7);
        else if (Math.abs(dvx) + Math.abs(dvy) > 5) a.angle = U.turnTo(a.angle, Math.atan2(dvy, dvx), dt * 8);
        a.aim = a.angle;
      }
    },

    // ------------------------------------------------------------ perception
    playerArmed() {
      const p = this.player; if (p.inCar) return false;
      const d = W8[this.curWeapon().id];
      return d.type === 'gun' || (d.type === 'melee' && d.id !== 'knife') || (d.id === 'knife' && this.aiming) || d.id === 'grenade' || d.id === 'c4';
    },
    privateBuilding(b) { return b && (b.type === 'house' || b.type === 'flat') && !b.owned && !b.property; },
    suspicion(a, dist, range) {
      const p = this.player, P = this.P;
      if (P.jail && !P.jail.escaped) return [0, null];
      if (P.surrender) return [0, null];
      let r = 0, why = null;
      const z = this.zoneAt(p.x, p.y), role = this.role(p);
      if (z >= 0) {
        const Z = this.zones[z];
        const owner = a.kind === 'guard' || a.kind === 'bodyguard' || a.kind === 'cop' || a.kind === 'gang' || ((a.kind === 'staff' || a.kind === 'keeper') && a.home === Z.bld) || a.zone === z;
        if (!Z.roles.includes(role)) { if (owner) { r = 1.5; why = 'trespass'; } }
        else if (owner && (a.enforcer || P.compromised[P.outfit]) && this.role(a) === role && dist < 5 * TILE) { r = 0.55 * (1 - this.sk('disguise') * 0.15) * (P.compromised[P.outfit] ? 2 : 1); why = 'disguise'; }
      }
      const b = this.bldAt(p.x, p.y);
      if (b >= 0 && this.privateBuilding(this.buildings[b]) && this.bldAt(a.x, a.y) === b) { r = Math.max(r, 1.6); why = why || 'trespass'; }
      if (this.playerArmed()) {
        const k = a.kind;
        const base = k === 'cop' ? 2.2 : k === 'guard' || k === 'bodyguard' || k === 'gang' ? 1.4 : this.aiming ? 3 : 1.7;
        if (base > r) { r = base; why = 'weapon'; }
      }
      if (role === 'police' && a.kind === 'cop' && dist < 4 * TILE && !why) { r = 0.4; why = 'disguise'; }
      if (P.outfit === 'under' && !why) { r = 0.8; why = 'naked'; }
      if (P.outfit === 'prisoner' && !why) { r = a.kind === 'cop' ? 2.6 : 0.9; why = 'prisoner'; }
      if (P.masked && !why) { r = a.kind === 'cop' ? 1.3 : a.kind === 'guard' || a.kind === 'bodyguard' ? 1.1 : 0.55; why = 'masked'; }
      if (this.drag && !why) { r = 3; why = 'body'; }
      if (!r) return [0, null];
      const light = this.lightAt(p.x, p.y);
      r *= (0.4 + 0.6 * light) * U.clamp(1.7 - dist / range, 0.35, 1.7);
      if (p.crouch) r *= 0.78;
      r *= 1 - this.sk('stealth') * 0.12;
      if (a.alertness) r *= 1.4;
      return [r, why];
    },
    perceive(a, dt) {
      const p = this.player;
      a.seesPlayer = false;
      const range = this.viewRange(a) * (a.zone >= 0 && this.zones[a.zone] && this.zones[a.zone].alert > this.t ? 1.25 : 1);
      const dist = Math.hypot(p.x - a.x, p.y - a.y);
      if (p.alive && !p.hidden && dist < range) {
        let rng = range * (0.55 + 0.45 * this.lightAt(p.x, p.y));
        if (p.crouch) rng *= 0.72;
        rng *= 1 - this.sk('stealth') * 0.06;
        if (a.state === 'hostile' || a.state === 'search') rng = Math.max(rng, range * 0.8);
        const px = p.inCar ? this.carOf(p).x : p.x, py = p.inCar ? this.carOf(p).y : p.y;
        a.seesPlayer = this.sees(a, px, py, rng, a.state === 'hostile' ? 1.6 : 1.05);
      }
      if (a.seesPlayer && !p.inCar) {
        const [r, why] = this.suspicion(a, dist, range);
        if (r > 0 && a.state !== 'hostile') {
          a.susp = Math.min(1, a.susp + r * dt);
          a.suspWhy = why;
          if (a.susp >= 1 && a.state !== 'warn' && a.state !== 'flee' && a.state !== 'cower' && a.state !== 'arrest') this.onSuspicious(a, why);
          if (why === 'body' && a.susp >= 1) this.crimeEvent(p, this.byId.get(this.drag) && !this.byId.get(this.drag).alive ? 'murder' : 'assault', p.x, p.y, null);
        } else if (a.state !== 'hostile') a.susp = Math.max(0, a.susp - dt * 0.3);
        if (a.kind === 'cop' && this.wanted >= 1 && a.state !== 'hostile' && a.state !== 'arrest') {
          if (this.P.surrender || !this.copMayShoot()) this.startArrest(a); else this.alarm(a, p);
        }
        a.lastSeenX = p.x; a.lastSeenY = p.y;
      } else if (a.seesPlayer && p.inCar && a.kind === 'cop' && this.wanted >= 1 && this.copMayShoot()) this.alarm(a, p);
      else if (a.state !== 'hostile') a.susp = Math.max(0, a.susp - dt * 0.3);
      if (a.foe) { const f = this.byId.get(a.foe); a.seesFoe = !!(f && f.alive && !f.hidden && this.sees(a, f.x, f.y, range * 1.1, 1.7)); }
      if (this.scanThreats) this.scanThreats(a, range);
      // bodies
      for (const b of this.bodies) {
        if (b.found && b.ko <= 0) continue;
        if (b === a || Math.abs(b.x - a.x) > range || Math.abs(b.y - a.y) > range) continue;
        if (b.dragBy) continue;
        if (!this.sees(a, b.x, b.y, range * 0.85, 1.1)) continue;
        this.onBodyFound(a, b);
        break;
      }
    },

    // ------------------------------------------------------------ reactions
    alarm(a, perp) {
      if (a.state === 'cuffed') return;
      if (!a.alive || a.ko > 0) return;
      const civ = (a.kind === 'civ' && !(a.defender && a.gun)) || ((a.kind === 'keeper' || a.kind === 'staff') && !a.armedKeeper);
      if (civ) { this.flee(a, perp.x, perp.y, true); return; }
      if (a.defender) this.residentArm(a);
      a.foe = perp && perp.kind !== 'player' ? perp.id : 0;
      if (a.state !== 'hostile') {
        a.state = 'hostile'; a.brain.react = a.kind === 'cop' ? 0.9 + Math.random() * 0.7 : 0.35 + Math.random() * 0.45; a.brain.lost = 0; a.brain.sdir = Math.random() < 0.5 ? 1 : -1; a.brain.st = 0;
        a.susp = 1; a.path = null; a.goal = null;
        this.bark(a, a.kind === 'cop' ? U.pick([tr('Police! Drop your weapon!'), tr('Move in!'), tr('Suspect spotted!')]) : U.pick(LINES.hostile));
        this.emit('alert', { id: a.id, x: a.x, y: a.y });
        this.note('spotted', { n: a });
      }
      a.brain.lx = perp.x; a.brain.ly = perp.y;
      if (a.zone >= 0 && this.zones[a.zone] && !a.foe) this.zoneAlert(a.zone, perp.x, perp.y);
      if (a.wi.id === 'fists' && a.kind === 'guard') a.wi = { id: 'p9', mag: 15 };
    },
    zoneAlert(z, x, y) {
      const Z = this.zones[z]; if (!Z) return;
      const fresh = !(Z.alert > this.t);
      Z.alert = this.t + 60;
      if (!fresh) return;
      for (const g of this.actors) {
        if (g.zone !== z || !g.alive || g.ko > 0 || g.state === 'hostile') continue;
        if (g.kind === 'guard' || g.kind === 'gang' || g.kind === 'bodyguard') { g.state = 'search'; g.brain.sx = x; g.brain.sy = y; g.brain.searchT = 25; g.path = null; g.goal = null; }
        else if (g.kind === 'target') this.panic(g, x, y);
        else this.flee(g, x, y, false);
      }
    },
    flee(a, x, y, scream) {
      if (a.state === 'cuffed') return;
      if (!a.alive || a.ko > 0) return;
      if (a.kind === 'target') return this.panic(a, x, y);
      const was = a.state;
      a.state = 'flee'; a.brain.fx = x; a.brain.fy = y; a.brain.fleeT = 10 + Math.random() * 6; a.path = null; a.goal = null; a.crossOk = true;
      if (scream && was !== 'flee' && was !== 'cower') { this.bark(a, U.pick(LINES.scared), 2); this.emit('scream', { x: a.x, y: a.y, female: a.female }); }
    },
    onSuspicious(a, why) {
      const p = this.player;
      if (a.kind === 'thug') { if (why === 'weapon') { a.state = 'escape'; a.brain.ex = null; this.bark(a, tr('Shit, he’s got a gun!'), 1.8); } a.susp = 0.3; return; }
      if (a.kind === 'civ' || a.kind === 'keeper' || a.kind === 'staff' || a.kind === 'target') {
        if (why === 'weapon' || why === 'body') {
          if (a.kind === 'keeper' && a.armedKeeper && why === 'weapon') { this.bark(a, tr('Easy, friend. Put it away.')); a.susp = 0.6; return; }
          if (Math.hypot(p.x - a.x, p.y - a.y) < 6 * TILE && this.aiming && (a.kind !== 'civ' || Math.random() < 0.6)) { a.state = 'cower'; a.brain.cowerT = 6; a.brain.cowerBy = 0; a.crouch = true; this.bark(a, U.pick([tr('Please don’t!'), tr('I have a family!'), tr('Take whatever you want!')])); }
          else this.flee(a, p.x, p.y, true);
          this.crimeEvent(p, why === 'body' ? 'murder' : 'weapon', p.x, p.y, null);
          return;
        }
        if (why === 'trespass') {
          if (a.defender) {   // keeps a pistol in the nightstand
            this.residentArm(a);
            this.bark(a, U.pick([tr('I’m armed! Get out of my house!'), tr('One more step and I shoot!'), tr('Get lost, or I pull the trigger!')]), 2.4);
            a.state = 'warn'; a.brain.why = 'trespass'; a.brain.warnT = 2.2 + Math.random(); a.goal = null; a.path = null;
            a.reportT = 6 + Math.random() * 3; a.reportType = 'trespass'; a.reportX = p.x; a.reportY = p.y;
            return;
          }
          this.bark(a, U.pick([tr('What are you doing here?!'), tr('Get out of my house!'), tr('Help, a burglar!')]));
          this.flee(a, p.x, p.y, false); a.reportT = 4 + Math.random() * 3; a.reportType = 'trespass'; a.reportX = p.x; a.reportY = p.y;
          this.note('spotted', { n: a });
          return;
        }
        if (why === 'naked') { this.bark(a, U.pick([tr('Ugh, put some clothes on!'), tr('Pervert!')])); a.susp = 0; return; }
        if (why === 'masked') { this.bark(a, U.pick([tr('What’s with the mask?!'), tr('He’s up to something…'), tr('Oh no, a robbery?')]), 2); a.susp = 0.4; if (Math.random() < 0.35) this.flee(a, p.x, p.y, false); return; }
        if (why === 'prisoner') { this.bark(a, tr('Is that… an escaped convict?!')); this.flee(a, p.x, p.y, false); a.reportT = 4 + Math.random() * 3; a.reportType = 'jailbreak'; a.reportX = p.x; a.reportY = p.y; return; }
        a.susp = 0.5; return;
      }
      if (a.kind === 'cop') {
        if (why === 'weapon') { a.state = 'warn'; a.brain.warnT = 3; a.brain.why = why; this.bark(a, U.pick(LINES.weaponDown)); return; }
        if (why === 'trespass') { this.raiseWanted(1, 'trespass'); this.startArrest(a); return; }
        if (why === 'disguise') { this.P.compromised[this.P.outfit] = true; this.bark(a, tr('Wait… you’re not one of us!')); this.raiseWanted(1, 'trespass'); this.alarm(a, p); return; }
        if (why === 'masked') { a.state = 'warn'; a.brain.warnT = 3.5; a.brain.why = why; this.bark(a, U.pick([tr('Police! Mask off!'), tr('You there! Show your face!')])); return; }
        if (why === 'prisoner') { this.bark(a, tr('That’s the escapee! Move in!')); this.raiseWanted(3, 'jailbreak'); this.alarm(a, p); return; }
        if (why === 'body') { this.alarm(a, p); this.raiseWanted(2, 'murder'); return; }
        a.susp = 0.4; return;
      }
      // guards / gang / bodyguards
      if (why === 'weapon' || why === 'body') { this.alarm(a, p); return; }
      if (why === 'disguise') { this.P.compromised[this.P.outfit] = true; this.bark(a, U.pick(LINES.disguise)); a.state = 'warn'; a.brain.warnT = 3.5; a.brain.why = why; this.note('spotted', { n: a }); return; }
      if (why === 'trespass' || why === 'naked') { a.state = 'warn'; a.brain.warnT = 4.5; a.brain.why = why; this.bark(a, U.pick(LINES.trespass)); return; }
    },
    onBodyFound(a, b) {
      if (b.ko > 0 && (a.kind === 'guard' || a.kind === 'cop' || a.kind === 'bodyguard' || a.kind === 'gang')) {
        // go wake him up
        if (a.state !== 'hostile' && a.state !== 'wakeup') { a.state = 'wakeup'; a.brain.body = b.id; a.path = null; a.goal = null; this.bark(a, tr('Hey! You okay there?')); }
        b.found = true; return;
      }
      if (b.found) return;
      b.found = true;
      this.note('bodyFound', { body: b });
      this.emit('bodyFound', { x: b.x, y: b.y });
      if (a.kind === 'civ' || a.kind === 'keeper' || a.kind === 'staff') {
        this.bark(a, U.pick(LINES.body)); this.emit('scream', { x: a.x, y: a.y, female: a.female });
        this.flee(a, b.x, b.y, false); a.reportT = 4 + Math.random() * 4; a.reportType = 'body'; a.reportX = b.x; a.reportY = b.y;
      } else if (a.kind === 'target') this.panic(a, b.x, b.y);
      else {
        this.bark(a, U.pick([tr('Man down! Alarm!'), tr('We’ve got a dead man!'), tr('Damn… raise the alarm!')]));
        if (a.zone >= 0) this.zoneAlert(a.zone, b.x, b.y);
        if (a.state !== 'hostile') { a.state = 'search'; a.brain.sx = b.x; a.brain.sy = b.y; a.brain.searchT = 30; a.path = null; a.goal = null; }
        if (a.kind === 'cop') this.policeInvestigate(b.x, b.y);
      }
    },
    hear(a, kind, x, y, src) {
      if (a.state === 'cuffed') return;
      if (a.state === 'sleep') {
        if ((kind === 'coin' || kind === 'scuffle' || kind === 'step') && Math.random() > K.HOME.sleepWake) return;
        this.wakeResident(a, true);
        if (kind === 'coin' || kind === 'scuffle' || kind === 'step') { a.state = 'investigate'; a.brain.prev = 'home'; a.brain.ix = x; a.brain.iy = y; a.brain.lookT = 0; return; }
      }
      if (a.state === 'hostile' || a.state === 'dead') { if (kind === 'shot' && a.state === 'hostile' && src && src.kind === 'player') { a.brain.lx = x; a.brain.ly = y; } return; }
      const k = a.kind;
      if (kind === 'shot' || kind === 'explosion' || kind === 'glass') {
        if (k === 'civ' || ((k === 'keeper' || k === 'staff') && !a.armedKeeper)) {
          if (kind === 'glass' && Math.random() < 0.5) { a.faceTo = Math.atan2(y - a.y, x - a.x); return; }
          const close = Math.hypot(a.x - x, a.y - y) < 8 * TILE;
          if (close && Math.random() < 0.4) { a.state = 'cower'; a.brain.cowerBy = src && src.kind !== 'player' ? src.id : 0; a.brain.cowerT = 5 + Math.random() * 4; a.crouch = true; this.emit('scream', { x: a.x, y: a.y, female: a.female }); }
          else this.flee(a, x, y, Math.random() < 0.6);
          return;
        }
        if (k === 'target') return this.panic(a, x, y);
        if (k === 'cop' && a.state !== 'station') { a.state = 'respond'; a.brain.tx = x; a.brain.ty = y; a.path = null; a.goal = null; return; }
        // guards: alert and search the source
        a.state = 'search'; a.brain.sx = x; a.brain.sy = y; a.brain.searchT = 25; a.path = null; a.goal = null;
        this.bark(a, U.pick([tr('Shots fired! Spread out!'), tr('What the…?!'), tr('Contact!')]));
        if (a.zone >= 0) this.zoneAlert(a.zone, x, y);
        return;
      }
      if (kind === 'coin' || kind === 'scuffle') {
        if (k === 'civ' && Math.random() < 0.5) return;
        if (['guard', 'staff', 'civ', 'cop', 'gang', 'bodyguard', 'keeper'].includes(k) && !['flee', 'cower', 'warn', 'search', 'report'].includes(a.state)) {
          if (k === 'keeper' || k === 'bodyguard') { a.faceTo = Math.atan2(y - a.y, x - a.x); a.brain.lookT = 2; return; }
          a.brain.prev = a.state === 'investigate' ? a.brain.prev : a.state;
          a.state = 'investigate'; a.brain.ix = x; a.brain.iy = y; a.brain.lookT = 0; a.path = null; a.goal = null;
          this.bark(a, U.pick(LINES.coin), 1.8);
        }
        return;
      }
      if (kind === 'steps' && a.kind !== 'civ' && a.state !== 'flee') { a.faceTo = Math.atan2(y - a.y, x - a.x); a.brain.turnTo = a.faceTo; a.brain.turnT = 1.5; }
    },
    onAttacked(t, src, info) {
      if (t.state === 'cuffed') return;
      if (!src) return;
      if (src.kind !== 'player') {
        if (this.isFighter(t) && this.enemies(t, src)) { this.alarm(t, src); return; }
        if (t.kind === 'civ' || t.kind === 'staff' || t.kind === 'keeper') this.flee(t, src.x, src.y, true);
        return;
      }
      if (t.kind === 'crew') { this.bark(t, U.pick([tr('Hey! I’m on your side!'), tr('Watch where you’re shooting!')]), 2); return; }
      t.knowsPlayer = t.knowsPlayer || src.kind === 'player';
      if (t.kind === 'target') return this.panic(t, src.x, src.y);
      if (t.kind === 'civ' || t.kind === 'staff' || (t.kind === 'keeper' && !t.armedKeeper)) {
        if (info.kind === 'fist' && Math.random() < 0.25 && t.state !== 'fight' && src.kind === 'player' && !this.playerArmed()) { t.state = 'fight'; t.brain.react = 0.2; this.bark(t, U.pick([tr('Just you wait!'), tr('You want trouble?!'), tr('Come here!')])); return; }
        if (t.state !== 'fight') { this.flee(t, src.x, src.y, true); if (src.kind === 'player') { t.reportT = t.reportT || 3 + Math.random() * 3; t.reportType = 'assault'; t.reportX = src.x; t.reportY = src.y; } }
        return;
      }
      if (t.kind === 'cop' && src.kind === 'player') this.raiseWanted(info.kind === 'bullet' ? 2 : 1, 'assault');
      this.alarm(t, src);
    },
    onKill(t, src, info) {
      // nearby escorts react, contract bookkeeping
      if (t.kind === 'target' || t.target) this.contractTargetKilled(t, src, info);
      if (this.heroReward) this.heroReward(t, src);
      if (t.kind === 'crew' && this.crewDown) this.crewDown(t, src);
      if (src && src.kind === 'crew' && this.crewKill) this.crewKill(src, t);
      for (const g of this.near(t.x, t.y, 12 * TILE)) {
        if (!g.alive || g.ko > 0 || g === t) continue;
        if (g.kind === 'bodyguard' && g.guarding === t.id) { g.state = 'search'; g.brain.sx = t.x; g.brain.sy = t.y; g.brain.searchT = 40; }
      }
    },
    panic(a, x, y) {
      if (a.state === 'cuffed') return;
      if (!a.alive || a.ko > 0) return;
      if (a.state !== 'panic' && a.state !== 'hide') { this.bark(a, U.pick([tr('Protect me!'), tr('Get me out of here!'), tr('They’re after me!')])); this.emit('scream', { x: a.x, y: a.y, female: a.female }); }
      a.state = 'panic'; a.brain.fx = x; a.brain.fy = y; a.brain.calm = 0; a.path = null; a.goal = null; a.crossOk = true;
      for (const g of this.actors) if (g.kind === 'bodyguard' && g.guarding === a.id && g.alive && g.state !== 'hostile') { g.state = 'search'; g.brain.sx = x; g.brain.sy = y; g.brain.searchT = 30; }
      this.note('targetAlert', {});
    },
    startArrest(a) {
      if (a.state === 'arrest') return;
      a.state = 'arrest'; a.brain.arT = 0; this.bark(a, U.pick(LINES.arrest)); this.emit('alert', { id: a.id, x: a.x, y: a.y });
    },

    // ============================================================ states
    ai_idle(a, dt) {
      a.brain.t -= dt;
      if (a.brain.t <= 0) { a.state = a.kind === 'cop' ? 'patrol' : 'wander'; a.goal = null; a.path = null; return; }
      // chat with neighbours
      if (a.kind === 'civ') {
        a.brain.chatT = (a.brain.chatT || 2 + Math.random() * 4) - dt;
        const nb = this.near(a.x, a.y, 46).find((b) => b !== a && b.kind === 'civ' && b.alive && !b.ko && b.state === 'idle');
        if (nb) { a.faceTo = Math.atan2(nb.y - a.y, nb.x - a.x); if (a.brain.chatT <= 0) { a.brain.chatT = 4 + Math.random() * 6; if (Math.hypot(this.player.x - a.x, this.player.y - a.y) < 14 * TILE) this.bark(a, U.pick(LINES.chat), 3); } }
      }
      if (a.brain.turnT > 0) { a.brain.turnT -= dt; a.faceTo = a.brain.turnTo; }
    },
    ai_wander(a, dt) {
      if (!a.goal || a.arrived) {
        if (a.goal && a.arrived) { a.state = 'idle'; a.brain.t = a.brain.inShop ? 8 + Math.random() * 20 : 1 + Math.random() * 6; a.brain.inShop = false; a.goal = null; return; }
        let dest = null;
        if (a.kind === 'civ' && Math.random() < 0.22) { dest = this.publicSpot(a); if (dest) a.brain.inShop = true; }
        if (!dest) dest = this.randomWalkNear(a, 6, 24);
        a.crossOk = false;
        this.goTo(a, dest[0], dest[1], { force: true });
      }
      const sp = (a.kind === 'cop' ? 58 : 66) * a.speedMul * (this.weather.rain > 0.5 ? 1.25 : 1);
      a.dv = this.steer(a, sp, dt);
    },
    ai_patrol(a, dt) {
      if (a.kind === 'cop') { if (a.unit) { a.state = 'return'; return; } return this.ai_wander(a, dt); }
      const z = this.zones[a.zone];
      if (!z) return this.ai_wander(a, dt);
      if (a.brain.waitT > 0) {
        a.brain.waitT -= dt;
        a.faceTo = a.brain.look + Math.sin(this.t * 0.8 + a.id) * 1.1;
        return;
      }
      if (!a.goal || a.arrived) {
        if (a.goal && a.arrived) { a.brain.waitT = 2 + Math.random() * 4; a.brain.look = a.angle; a.goal = null; return; }
        a.brain.pi = (a.brain.pi + 1 + U.rint(Math.max(1, z.patrol.length - 1))) % z.patrol.length;
        const pt = z.patrol[a.brain.pi];
        this.goTo(a, (pt.x + 0.5) * TILE, (pt.y + 0.5) * TILE, { force: true });
      }
      a.dv = this.steer(a, 52, dt);
    },
    ai_post(a, dt) {
      const p = a.brain.post;
      if (Math.hypot(p.x - a.x, p.y - a.y) > 12) { this.goTo(a, p.x, p.y); a.dv = this.steer(a, 60, dt); return; }
      a.faceTo = a.brain.face + Math.sin(this.t * 0.5 + a.id) * 0.7;
      if (a.brain.turnT > 0) { a.brain.turnT -= dt; a.faceTo = a.brain.turnTo; }
    },
    ai_hang(a, dt) {
      if (!a.brain.post) { if (a.zone >= 0) { a.state = 'patrol'; return; } a.brain.post = { x: a.x, y: a.y }; }
      const p = a.brain.post;
      if (a.brain.waitT > 0) { a.brain.waitT -= dt; return; }
      if (!a.goal || a.arrived) {
        if (a.goal) { a.brain.waitT = 3 + Math.random() * 8; a.goal = null; return; }
        this.goTo(a, p.x + U.rnd(-4, 4) * TILE, p.y + U.rnd(-2, 3) * TILE, { force: true });
      }
      a.dv = this.steer(a, 45, dt);
    },
    ai_work(a, dt) {
      if (a.brain.post) {
        const p = a.brain.post;
        if (Math.hypot(p.x - a.x, p.y - a.y) > 8) { this.goTo(a, p.x, p.y); a.dv = this.steer(a, 60, dt); return; }
        a.dv = [0, 0];
        const b = this.buildings[a.home];
        if (b && b.counter) a.faceTo = Math.atan2((b.counter.y + b.counter.h / 2) * TILE - a.y, (b.counter.x + b.counter.w / 2) * TILE - a.x);
        if (a.brain.lookT > 0) a.brain.lookT -= dt;
        return;
      }
      // roaming staff inside their room
      const r = a.brain.room;
      if (!r) return this.ai_idle(a, dt);
      if (a.brain.waitT > 0) { a.brain.waitT -= dt; return; }
      if (!a.goal || a.arrived) {
        if (a.goal) { a.brain.waitT = 3 + Math.random() * 7; a.goal = null; return; }
        this.goTo(a, (r.x + 0.5 + Math.random() * (r.w - 1)) * TILE, (r.y + 0.5 + Math.random() * (r.h - 1)) * TILE, { force: true });
      }
      a.dv = this.steer(a, 48, dt);
    },
    ai_station(a, dt) { return this.ai_work(a, dt); },
    ai_dance(a, dt) {
      a.dv = [Math.cos(this.t * 2 + a.id) * 20, Math.sin(this.t * 2.6 + a.id) * 20];
      a.faceTo = this.t * 1.5 + a.id;
    },
    ai_flee(a, dt) {
      a.brain.fleeT -= dt;
      if (!a.goal || a.arrived) {
        if (a.brain.fleeT <= 0 && !a.reportT) { a.state = a.brain.post || a.brain.room ? 'work' : a.kind === 'cop' ? 'patrol' : 'wander'; a.goal = null; a.path = null; a.crossOk = false; return; }
        const ang = Math.atan2(a.y - a.brain.fy, a.x - a.brain.fx) + U.rnd(-0.6, 0.6);
        let tx = a.x + Math.cos(ang) * 18 * TILE, ty = a.y + Math.sin(ang) * 18 * TILE;
        tx = U.clamp(tx, TILE, (this.W - 1) * TILE); ty = U.clamp(ty, TILE, (this.city.W - 1) * TILE);
        this.goTo(a, tx, ty, { force: true });
        if (!a.path) { a.dv = [Math.cos(ang) * 150, Math.sin(ang) * 150]; return; }
      }
      a.dv = this.steer(a, 158 * a.speedMul, dt);
      if (a.reportT > 0 && a.brain.fleeT < 6) { a.dv[0] *= 0.4; a.dv[1] *= 0.4; a.phone = true; } else a.phone = false;
    },
    ai_cower(a, dt) {
      a.crouch = true; a.dv = [0, 0];
      a.brain.cowerT -= dt;
      const by = a.brain.cowerBy && this.byId.get(a.brain.cowerBy);
      if (by) {   // held up by an NPC robber, not by you
        a.faceTo = Math.atan2(by.y - a.y, by.x - a.x);
        if (a.brain.cowerT <= 0 || !by.alive || by.state === 'cuffed') { a.crouch = false; a.brain.cowerBy = 0; this.flee(a, by.x, by.y, false); }
        return;
      }
      const p = this.player;
      a.faceTo = Math.atan2(p.y - a.y, p.x - a.x);
      if (a.brain.cowerT <= 0 || (!this.aiming && Math.hypot(p.x - a.x, p.y - a.y) > 6 * TILE)) { a.crouch = false; this.flee(a, p.x, p.y, false); if (!a.reportT) { a.reportT = 3; a.reportType = 'weapon'; a.reportX = p.x; a.reportY = p.y; } }
    },
    ai_investigate(a, dt) {
      const x = a.brain.ix, y = a.brain.iy;
      if (a.brain.lookT > 0) {
        a.brain.lookT -= dt; a.faceTo = a.angle + Math.sin(this.t * 2) * 0.1 + dt * 1.5;
        if (a.brain.lookT <= 0) { a.state = a.brain.prev && a.brain.prev !== 'investigate' ? a.brain.prev : a.kind === 'civ' ? 'wander' : 'patrol'; a.goal = null; a.path = null; if (a.kind !== 'civ') this.bark(a, U.pick([tr('Nothing. Moving on.'), tr('Must have misheard.'), 'Hm.']), 1.6); }
        return;
      }
      this.goTo(a, x, y);
      a.dv = this.steer(a, 74, dt);
      if (a.arrived || Math.hypot(x - a.x, y - a.y) < 22) {
        a.brain.lookT = 3 + Math.random() * 2;
        // pocket the coin
        for (const o of this.throwables) if (o.kind === 'coin' && o.landed && Math.hypot(o.x - a.x, o.y - a.y) < 40) { o.fuse = 0.01; if (a.kind === 'civ') this.bark(a, tr('Oh, spare change!'), 1.5); }
      }
    },
    ai_warn(a, dt) {
      const p = this.player;
      a.brain.warnT -= dt;
      a.faceTo = Math.atan2(p.y - a.y, p.x - a.x);
      const d = Math.hypot(p.x - a.x, p.y - a.y);
      if (d > 3 * TILE) { this.goTo(a, p.x, p.y, { tol: 40 }); a.dv = this.steer(a, 70, dt); }
      // resolved?
      const why = a.brain.why;
      let still = false;
      if (why === 'weapon') still = this.playerArmed();
      else if (why === 'trespass') { const z = this.zoneAt(p.x, p.y); still = (z >= 0 && !this.zones[z].roles.includes(this.role(p))) || (this.bldAt(p.x, p.y) >= 0 && this.privateBuilding(this.buildings[this.bldAt(p.x, p.y)])); }
      else if (why === 'disguise') still = d < 6 * TILE && a.seesPlayer;
      else if (why === 'naked') still = this.P.outfit === 'under';
      else if (why === 'masked') still = this.P.masked;
      if (!still) { a.state = a.brain.post ? 'post' : a.kind === 'cop' ? 'patrol' : 'patrol'; a.susp = 0.3; a.goal = null; a.path = null; this.bark(a, why === 'disguise' ? tr('Alright. Carry on.') : tr('Good.'), 1.6); return; }
      if (a.brain.warnT <= 0) {
        if (a.kind === 'cop') { this.raiseWanted(1, why === 'weapon' ? 'weapon' : why === 'masked' ? 'masked' : 'trespass'); if (why === 'weapon') this.alarm(a, p); else this.startArrest(a); }
        else this.alarm(a, p);
      }
    },
    dutyState(a) {
      if (a.streetGang) return 'hang';
      if (a.brain.post) return a.kind === 'keeper' ? 'work' : 'post';
      return { cop: a.unit ? 'return' : 'patrol', crew: 'follow', gang: a.zone >= 0 ? 'patrol' : 'hang', thug: 'escape', bodyguard: 'escort', guard: 'patrol', staff: 'work', keeper: 'work' }[a.kind] || 'wander';
    },
    calmDown(a) { a.state = this.dutyState(a); a.foe = 0; a.goal = null; a.path = null; },
    ai_hostile(a, dt) {
      const isP = !a.foe;
      const p = isP ? this.player : this.byId.get(a.foe);
      if (!p || p.removed || !p.alive || (!isP && (p.hidden || p.ko > 0))) { this.calmDown(a); return; }
      if (isP && a.kind === 'cop') {
        if (this.wanted < 1) { this.calmDown(a); return; }
        if (p.downed) { a.state = 'arrest'; a.brain.arT = 0; return; }
        if (this.P.surrender || !this.copMayShoot()) { a.state = 'arrest'; a.brain.arT = 0; return; }
      }
      const sees = isP ? a.seesPlayer : a.seesFoe;
      const d = this.wdef(a);
      const tx = p.inCar ? this.carOf(p).x : p.x, ty = p.inCar ? this.carOf(p).y : p.y;
      if (sees) { a.brain.lx = tx; a.brain.ly = ty; a.brain.lost = 0; } else a.brain.lost += dt;
      const dist = Math.hypot(tx - a.x, ty - a.y);
      if (sees && !isP && a.kind === 'cop' && p.kind === 'thug' && this.wdef(p).type !== 'gun' && p.state !== 'hostile' && p.state !== 'cuffed') {
        // unarmed or knife-wielding robber: chase and cuff, don't shoot
        a.faceTo = Math.atan2(ty - a.y, tx - a.x);
        if (dist < 32) { this.copCuffs(a, p); return; }
        this.goTo(a, tx, ty, { tol: 20 }); a.dv = this.steer(a, 150, dt);
        if (!a.brain.yelled) { a.brain.yelled = true; this.bark(a, tr('Police! Freeze!')); }
        return;
      }
      if (sees) {
        const ang = Math.atan2(ty - a.y, tx - a.x);
        a.faceTo = ang;
        a.brain.react -= dt;
        if (d.type === 'gun') {
          if (a.wi.mag <= 0) this.reload(a);
          const ideal = (d.cls === 'shotgun' ? 3 : d.cls === 'smg' ? 5.5 : 7) * TILE;
          a.brain.st -= dt;
          if (a.brain.st <= 0) { a.brain.st = 1.2 + Math.random() * 2; a.brain.sdir = -a.brain.sdir; }
          if (dist > ideal + 3 * TILE) { this.goTo(a, tx, ty, { tol: 60 }); a.dv = this.steer(a, 120, dt); }
          else if (dist < ideal - 2 * TILE) a.dv = [-Math.cos(ang) * 80, -Math.sin(ang) * 80];
          else a.dv = [-Math.sin(ang) * 70 * a.brain.sdir, Math.cos(ang) * 70 * a.brain.sdir];
          if (a.brain.react <= 0 && Math.abs(U.angDiff(a.angle, ang)) < 0.3 && a.reloadT <= 0) {
            if (this.attack(a, a.angle, true, true) && !d.auto) a.cool += 0.25 + Math.random() * 0.55 * (this.npcSlow || 1);
            if (d.auto) { a.brain.burst = (a.brain.burst || 0) + 1; if (a.brain.burst > 4 + U.rint(4)) { a.brain.burst = 0; a.cool += 0.6 + Math.random() * 0.6; } }
          }
        } else {
          if (dist > 30) { if (dist < 6 * TILE) a.dv = [Math.cos(ang) * 150, Math.sin(ang) * 150]; else { this.goTo(a, tx, ty, { tol: 40 }); a.dv = this.steer(a, 150, dt); } }
          else if (a.brain.react <= 0) this.attack(a, ang, true, true);
        }
      } else {
        this.goTo(a, a.brain.lx, a.brain.ly, { tol: 40 });
        a.dv = this.steer(a, 125, dt);
        if (a.arrived || a.brain.lost > 7) { a.state = 'search'; a.brain.sx = a.brain.lx; a.brain.sy = a.brain.ly; a.brain.searchT = 20; a.goal = null; a.path = null; this.bark(a, U.pick(LINES.search)); }
      }
    },
    ai_fight(a, dt) { // civilian brawler
      const p = this.player;
      if (!p.alive || Math.hypot(p.x - a.x, p.y - a.y) > 8 * TILE) { a.state = 'wander'; return; }
      const ang = Math.atan2(p.y - a.y, p.x - a.x); a.faceTo = ang;
      if (Math.hypot(p.x - a.x, p.y - a.y) > 26) a.dv = [Math.cos(ang) * 120, Math.sin(ang) * 120];
      else if (a.cool <= 0) { this.attack(a, ang, true, true); a.cool += 0.3; }
      if (a.hp < 35) this.flee(a, p.x, p.y, true);
    },
    ai_search(a, dt) {
      if (a.kind === 'cop' && this.wanted > 0 && this.copSearch) return this.copSearch(a, dt);
      a.brain.searchT -= dt;
      if (a.brain.searchT <= 0) { this.calmDown(a); this.bark(a, U.pick([tr('Must be gone.'), tr('Back to position.'), tr('Keep your eyes open.')]), 1.8); return; }
      if (a.brain.waitT > 0) { a.brain.waitT -= dt; a.faceTo = a.angle + dt * 2.2; return; }
      if (!a.goal || a.arrived) {
        if (a.goal) { a.brain.waitT = 1 + Math.random() * 2; a.goal = null; return; }
        const r = 5 * TILE;
        this.goTo(a, a.brain.sx + U.rnd(-r, r), a.brain.sy + U.rnd(-r, r), { force: true });
      }
      a.dv = this.steer(a, 85, dt);
    },
    ai_respond(a, dt) {
      this.goTo(a, a.brain.tx, a.brain.ty, { tol: 48 });
      a.dv = this.steer(a, 150, dt);
      if (a.arrived || Math.hypot(a.brain.tx - a.x, a.brain.ty - a.y) < 3 * TILE) { a.state = 'search'; a.brain.sx = a.brain.tx; a.brain.sy = a.brain.ty; a.brain.searchT = 25; a.goal = null; a.path = null; }
      if (this.wanted > 0 && Math.random() < dt * 0.3) { a.brain.tx = this.heat.x; a.brain.ty = this.heat.y; }
    },
    ai_arrest(a, dt) {
      const p = this.player;
      if ((this.P.surrender || p.downed) && p.alive) {
        // suspect gave up: walk over, cuff
        const d = Math.hypot(p.x - a.x, p.y - a.y);
        a.faceTo = Math.atan2(p.y - a.y, p.x - a.x);
        if (d > 1.5 * TILE) { this.goTo(a, p.x, p.y, { tol: 26 }); a.dv = this.steer(a, 110, dt); return; }
        a.brain.arT = (a.brain.arT || 0) + dt;
        this.arrestProgress = a.brain.arT / 1.8;
        if (a.brain.arT > 1.8) { this.arrestProgress = 0; this.bark(a, U.pick([tr('You have the right to remain silent.'), tr('Cuffs are on. Come along.')])); this.arrest(); }
        return;
      }
      if (this.copMayShoot()) { this.alarm(a, p); return; }
      if (this.wanted <= 0) { this.calmDown(a); return; }
      const d = Math.hypot(p.x - a.x, p.y - a.y);
      a.faceTo = Math.atan2(p.y - a.y, p.x - a.x);
      // a drawn weapon gets one clear warning
      if (this.playerArmed() && a.seesPlayer) {
        if (!a.brain.armT) this.bark(a, U.pick([tr('Drop the weapon! NOW!'), tr('Police! Drop it or I shoot!')]), 2.4);
        a.brain.armT = (a.brain.armT || 0) + dt;
        if (a.brain.armT > 3.5) { this.raiseWanted(2, 'weapon'); this.lastThreatT = this.t; this.alarm(a, p); return; }
      } else a.brain.armT = 0;
      if (d > 1.6 * TILE) { this.goTo(a, p.x, p.y, { tol: 30 }); a.dv = this.steer(a, 140, dt); }
      if (d > 10 * TILE && a.seesPlayer && !a.brain.fled) { a.brain.fled = true; this.raiseWanted(Math.max(1, Math.floor(this.wanted)), 'resist'); this.bark(a, tr('He’s running! Stop!')); }
      // tackle a runner
      if (d < 1.3 * TILE && p.speed > 60 && !p.inCar && (a.brain.tackleCD || 0) <= this.t && p.stun <= 0) {
        // rde_aipd: a tackle lands with a chance that grows with the stars; a miss sends the officer sprawling
        a.brain.tackleCD = this.t + 12;
        const ch = K.HUNT ? K.HUNT.tackle[Math.min(5, Math.max(1, Math.floor(this.wanted)))] : 0.4;
        if (Math.random() < ch + (this.forceTackle || 0)) { p.stun = 2 + Math.random() * 1.5; p.vx = p.vy = 0; a.cool = 2.5; this.bark(a, tr('Stay down!')); this.emit('tackle', { x: p.x, y: p.y }); }
        else { a.stun = 1.2; this.bark(a, U.pick([tr('Damn!'), tr('Stop right there!')]), 1.4); this.emit('tackle', { x: a.x, y: a.y, miss: true }); }
      }
      if (d < 2.2 * TILE && (p.speed < 25 || p.stun > 0) && !p.inCar) {
        a.brain.arT += dt;
        this.arrestProgress = a.brain.arT / 2.5;
        if (a.brain.arT > 2.5) { this.arrestProgress = 0; this.arrest(); }
      } else { a.brain.arT = Math.max(0, a.brain.arT - dt); this.arrestProgress = a.brain.arT / 2.5; }
      if (!a.seesPlayer && d > 6 * TILE) { a.state = 'search'; a.brain.sx = p.x; a.brain.sy = p.y; a.brain.searchT = 15; }
    },
    ai_wake(a, dt) {
      a.brain.t += dt; a.faceTo = a.angle + dt * 3;
      if (a.brain.t > 2.2) {
        if (!a.knowsPlayer) { a.state = a.brain.post || a.brain.room ? 'work' : a.kind === 'cop' ? 'patrol' : a.kind === 'guard' ? 'patrol' : 'wander'; a.goal = null; a.path = null; return; }
        if (a.kind === 'civ' || a.kind === 'staff' || a.kind === 'keeper') { this.flee(a, this.player.x, this.player.y, false); a.reportT = 4; a.reportType = 'assault'; a.reportX = a.x; a.reportY = a.y; }
        else if (a.kind === 'target') this.panic(a, a.x, a.y);
        else { a.state = 'search'; a.brain.sx = a.x; a.brain.sy = a.y; a.brain.searchT = 25; this.bark(a, tr('Somebody knocked me out! Alarm!')); if (a.zone >= 0) this.zoneAlert(a.zone, a.x, a.y); }
      }
    },
    ai_wakeup(a, dt) {
      const b = this.byId.get(a.brain.body);
      if (!b || b.alive === false || b.ko <= 0 || b.hidden) { a.state = 'search'; a.brain.sx = a.x; a.brain.sy = a.y; a.brain.searchT = 20; return; }
      this.goTo(a, b.x, b.y, { tol: 20 }); a.dv = this.steer(a, 100, dt);
      if (Math.hypot(b.x - a.x, b.y - a.y) < 30) { b.ko = Math.min(b.ko, 1.5); a.state = 'search'; a.brain.sx = b.x; a.brain.sy = b.y; a.brain.searchT = 25; if (a.zone >= 0) this.zoneAlert(a.zone, b.x, b.y); }
    },
    ai_escort(a, dt) {
      const t = this.byId.get(a.guarding);
      if (!t || !t.alive) { a.state = 'search'; a.brain.sx = a.x; a.brain.sy = a.y; a.brain.searchT = 30; return; }
      const off = a.brain.off || 0;
      const bx = t.x - Math.cos(t.angle + off) * 28, by = t.y - Math.sin(t.angle + off) * 28;
      const d = Math.hypot(bx - a.x, by - a.y);
      if (d > 3 * TILE) { this.goTo(a, bx, by, { tol: 30 }); a.dv = this.steer(a, t.state === 'panic' ? 160 : 95, dt); }
      else if (d > 10) a.dv = [(bx - a.x) * 3, (by - a.y) * 3];
      else a.faceTo = t.angle + off * 2 + Math.sin(this.t + a.id) * 0.6;
    },
    ai_ko() {},
    ai_dead() {},
  });
})(globalThis.K = globalThis.K || {});
