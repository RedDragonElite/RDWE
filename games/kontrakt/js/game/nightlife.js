/* RDE // KONTRAKT — Ocean Beach & nightlife: beach-goers on the sand, party crowds in the beach clubs,
 * dancers at the poles of the Velvet. Tip them, book a private dance — and dancers hear things. */
(function (K) {
  'use strict';
  const tr = K.tr;   // translate (K.T is the tile table)
  const U = K.U, T = K.T, TILE = K.TILE;
  const BEACHWEAR = ['swim', 'hawaii', 'civ3', 'civ7', 'casual'];

  K.mixin({
    updateNightlife(dt) {
      const p = this.player;
      if (!this.nightDone) {
        this.nightDone = true;
        for (const b of this.buildings) {
          if (b.type === 'stripclub' && b.poles) b.poles.forEach(([px, py], i) => {
            const x = (px + 0.5) * TILE, y = (py + 0.5) * TILE;
            const d = this.spawnActor('staff', x, y, { outfit: 'dancer', female: true, home: b.id, state: 'pole', name: U.pick(['Candy', 'Jade', 'Roxy', 'Bella', 'Nikita', 'Luna', 'Destiny', 'Raven']) });
            d.dancer = true; d.brain.pole = { x, y }; d.brain.ph = i * Math.PI; d.important = true;
          });
          if (b.type === 'stripclub') { const r = b.rooms[0]; for (let k = 0; k < 4; k++) { const x = (r.x + 1 + Math.random() * (r.w - 2)) * TILE, y = (r.y + r.h - 1.5) * TILE; if (!this.blockedTile(this.tileIdx(x, y), null)) { const c = this.spawnActor('civ', x, y, { outfit: U.pick(['suit', 'suitgrey', 'leather', 'civ6']), state: 'post', home: b.id, female: Math.random() < 0.15 }); c.resident = true; c.brain.post = { x, y }; c.brain.face = -Math.PI / 2; } } }
        }
      }
      // keep the beach and the beach clubs alive when you are around
      this.beachT = (this.beachT || 0) - dt;
      if (this.beachT > 0) return;
      this.beachT = 4;
      const nearBeach = this.districtAt(p.x, p.y) === 'beach' || (p.y > (this.city.W - 30) * TILE && p.x < (this.city.BEACHW + 10) * TILE);
      if (!nearBeach) return;
      const night = this.isNight(), live = this.actors.filter((a) => a.beachgoer && a.alive && !a.removed);
      const want = night ? 4 : 12;
      if (live.length < want) {
        for (let n = 0; n < 3; n++) {
          const x = U.clamp(p.x / TILE + U.rnd(-35, 35), 2, this.city.BEACHW - 2) * TILE, y = (this.city.W + 0.5 + Math.random() * 4.5) * TILE;
          if (this.blockedTile(this.tileIdx(x, y), null) || (Math.hypot(x - p.x, y - p.y) < 10 * TILE && K.los(this, p.x, p.y, x, y))) continue;
          const a = this.spawnActor('civ', x, y, { outfit: U.pick(BEACHWEAR), state: 'hang' });
          a.beachgoer = true; a.brain.post = { x, y };
        }
      }
      if (night) for (const b of this.buildings) {
        if (b.type !== 'beachclub' || Math.hypot((b.x + b.w / 2) * TILE - p.x, (b.y + b.h / 2) * TILE - p.y) > 35 * TILE) continue;
        const crowd = this.actors.filter((a) => a.partyAt === b.id && a.alive && !a.removed).length;
        const r = b.rooms[0];
        for (let k = crowd; k < 6; k++) {
          const x = (r.x + 0.5 + Math.random() * (r.w - 1)) * TILE, y = (r.y + 0.5 + Math.random() * (r.h - 1)) * TILE;
          if (this.blockedTile(this.tileIdx(x, y), null)) continue;
          const a = this.spawnActor('civ', x, y, { outfit: U.pick(BEACHWEAR), state: 'dance', home: b.id }); a.partyAt = b.id; a.resident = true;
        }
      }
    },
    ai_pole(a, dt) {
      const P = a.brain.pole; if (!P) { a.state = 'idle'; return; }
      a.brain.ph = (a.brain.ph || 0) + dt * 0.9;
      const tx = P.x + Math.cos(a.brain.ph) * 11, ty = P.y + Math.sin(a.brain.ph) * 11;
      a.dv = [(tx - a.x) * 6, (ty - a.y) * 6];
      a.faceTo = a.brain.ph + Math.PI / 2;
    },
    /** tip a dancer or book a private dance */
    nightlifeContext(add) {
      const a = this.player; if (a.inCar || this.drag) return false;
      for (const d of this.near(a.x, a.y, 56)) {
        if (!d.dancer || !d.alive || d.ko > 0 || d.state !== 'pole') continue;
        add('E', tr('Tip {name} ($20)', { name: d.name }), () => this.tipDancer(d));
        add('T', tr('Private dance in the VIP lounge ($250)'), () => this.privateDance(d));
        return true;
      }
      return false;
    },
    tipDancer(d) {
      if (!this.pay(20)) return this.notify(tr('No cash for a tip.'), 'bad');
      d.tips = (d.tips || 0) + 1;
      this.emit('sfx', { s: 'cash' });
      this.bark(d, U.pick([tr('Thanks, sugar.'), tr('Keep it coming!'), tr('You know how to make a girl like you.'), '♥']), 1.8);
      this.dancerWhisper(d);
    },
    /** regulars hear things: after a few tips a dancer whispers about your target */
    dancerWhisper(d) {
      const c = this.contract;
      if (d.tips >= 4 && c && c.status === 'active' && !c.intel && !d.told) {
        d.told = true; c.intel = true;
        this.bark(d, tr("Psst… I know who you're looking for."), 2.6);
        this.emit('banner', { title: tr('WHISPERS'), sub: tr('{name} tells you where your target hangs out — intel unlocked.', { name: d.name }), kind: 'gold' });
      }
    },
    privateDance(d) {
      if (!this.pay(250)) return this.notify(tr('The VIP lounge costs $250.'), 'bad');
      const P = this.P;
      this.time += 20; P.energy = Math.min(100, P.energy + 8); P.drunk = Math.max(0, P.drunk - 0.1);
      this.emit('fadeBlink', {});
      this.emit('banner', { title: tr('VIP LOUNGE'), sub: tr('20 minutes with {name}. Velvet, neon, and not a word about it.', { name: d.name }), kind: 'gold' });
      this.emit('sfx', { s: 'cash' });
      d.tips = (d.tips || 0) + 3;
      this.dancerWhisper(d);
    },
  });
})(globalThis.K = globalThis.K || {});
