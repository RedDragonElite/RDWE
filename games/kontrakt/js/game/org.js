/* RDE // KONTRAKT — your criminal organisation: rank & reputation, protection rackets on the city's
 * shops (demand, collect, rivals muscling in), street dealers on corners (stock, cash, busts and
 * robberies — simulated even when you're across town), legal business upgrades, and the street
 * gangs fighting each other for blocks. Phone › Organisation shows the whole empire. */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE;

  K.ORG = {
    ranks: [[0, 'Straßenratte'], [60, 'Kleinkrimineller'], [180, 'Soldat'], [450, 'Capo'], [1000, 'Unterboss'], [2200, 'Pate']],
    dealerFee: 600, dealerCut: 0.2,
    noRacket: ['hospital', 'bank', 'black'],
    demand: { down: 1.3, old: 1.2, beach: 1.4, docks: 0.9, res: 0.8, hill: 0.7, ind: 0.6, park: 1 },
    bizUp: [{ name: 'Renovierung', mult: 0.25 }, { name: 'Mehr Personal', mult: 0.2 }, { name: 'Werbung & Neon', mult: 0.15 }],
  };
  K.CRIMES.extortion = K.CRIMES.extortion || { name: 'Schutzgelderpressung', jail: 120 };
  if (K.CRIME_SEV) K.CRIME_SEV.extortion = 1;

  K.mixin({
    org() { const P = this.P; return P.org || (P.org = { rep: 0, racket: {}, dealers: [], seq: 0, day: null, today: { racket: 0, dealers: 0 } }); },
    orgRank(rep = this.org().rep) { let r = 0; K.ORG.ranks.forEach(([n], i) => { if (rep >= n) r = i; }); return r; },
    orgRankName() { return K.ORG.ranks[this.orgRank()][1]; },
    addRep(n, why) {
      const O = this.org(), r0 = this.orgRank();
      O.rep = Math.max(0, O.rep + n);
      const r1 = this.orgRank();
      if (r1 > r0) this.emit('banner', { title: K.ORG.ranks[r1][1].toUpperCase(), sub: `Neuer Rang in der Unterwelt${why ? ' — ' + why : ''}. Mehr Ecken, mehr Respekt.`, kind: 'gold' });
    },
    maxDealers() { return 1 + this.orgRank(); },

    // ============================================================ protection racket
    racketShop(b) { return b && b.shop && K.SHOPS[b.shop] && !b.owned && !K.ORG.noRacket.includes(b.shop) && b.type !== 'police'; },
    shopKeeper(b) { return this.actors.find((k) => k.kind === 'keeper' && k.home === b.id && k.alive && k.ko <= 0); },
    racketRate(b) { const S = K.SHOPS[b.shop]; return Math.round(Math.max(60, (S.till || 600) * 0.12) / 10) * 10; },
    orgContext(add) {
      const p = this.player, bi = this.bldAt(p.x, p.y), b = bi >= 0 ? this.buildings[bi] : null;
      if (this.racketShop(b)) {
        const k = this.shopKeeper(b);
        if (k && Math.hypot(k.x - p.x, k.y - p.y) < 3.5 * TILE) {
          const R = this.org().racket[b.id];
          if (!R) { if (b.racketNo !== this.today()) add('T', `Schutzgeld fordern (${U.money(this.racketRate(b))}/Tag)`, () => this.demandProtection(b, k), 1.4); }
          else if (R.owed > 0) add('T', `Schutzgeld kassieren (+${U.money(R.owed)})`, () => this.collectProtection(b, k));
        }
      }
      const d = this.dealerNear();
      if (d) { add('E', `Dealer ${d.rec.name}: Ware & Kasse (${U.money(d.rec.cash)})`, () => this.emit('ui', { open: 'corner', uid: d.rec.uid })); return true; }
      return false;
    },
    /** how likely a shopkeeper gives in */
    racketChance(b, k) {
      const p = this.player, P = this.P, own = this.ownTurfAt && this.ownTurfAt(p.x, p.y), owner = this.turfOwner ? this.turfOwner(this.turfKeyAt(p.x, p.y)) : null;
      let c = 0.3 + this.orgRank() * 0.06;
      if (this.aiming && this.playerArmed()) c += 0.25; else if (this.playerArmed()) c += 0.12;
      if (own) c += 0.2; else if (owner && owner !== 'player') c -= 0.2;
      if (this.crewActors) c += Math.min(0.24, this.crewActors().filter((m) => Math.hypot(m.x - p.x, m.y - p.y) < 6 * TILE).length * 0.08);
      if (this.t - (b.scaredT || -999) < 300) c += 0.25;   // you shot the place up or smashed glass recently
      if (k.armedKeeper) c -= 0.15;
      if (P.masked) c += 0.05;
      return U.clamp(c, 0.05, 0.95);
    },
    demandProtection(b, k) {
      const O = this.org(), rate = this.racketRate(b), p = this.player;
      k.faceTo = Math.atan2(p.y - k.y, p.x - k.x);
      if (Math.random() < this.racketChance(b, k) || this.forceRacket) {
        O.racket[b.id] = { name: b.name, rate, owed: 0, since: this.today(), unpaid: 0 };
        this.P.money += rate;
        this.bark(k, U.pick(['Schon gut… schon gut. Ich zahle.', 'Nehmen Sie. Und lassen Sie mich in Ruhe.', 'Jede Woche? …Na gut.']), 2.6);
        this.emit('sfx', { s: 'cash' }); this.notify(`${b.name} zahlt dir jetzt ${U.money(rate)}/Tag. Erste Rate: +${U.money(rate)}`, 'money');
        this.addRep(8, 'Schutzgeld'); this.addXP(20, 'Schutzgeld');
        return true;
      }
      b.racketNo = this.today();
      this.bark(k, U.pick(['Raus aus meinem Laden!', 'Ich zahle niemandem was!', 'Ich ruf die Polizei!']), 2.4);
      if (Math.random() < 0.6) { k.reportT = 4 + Math.random() * 3; k.reportType = 'extortion'; k.reportX = p.x; k.reportY = p.y; }
      const owner = this.turfOwner ? this.turfOwner(this.turfKeyAt(b.x * TILE, b.y * TILE)) : null;
      if (owner && owner !== 'player' && K.GANGS[owner] && Math.random() < 0.5) {
        // the shop is under someone else's protection
        const pos = this.blockWalkTile ? this.blockWalkTile(this.turfKeyAt(b.x * TILE, b.y * TILE), 6) : null;
        if (pos) { for (let i = 0; i < 2; i++) { const g = this.spawnGangster(owner, pos[0] + U.rnd(-30, 30), pos[1] + U.rnd(-30, 30)); this.alarm(g, p); } this.notify(`${K.GANGS[owner].name}: „Das ist UNSER Laden.“`, 'bad'); }
      }
      return false;
    },
    collectProtection(b, k) {
      const R = this.org().racket[b.id]; if (!R || R.owed <= 0) return;
      this.P.money += R.owed; this.org().today.racket += R.owed;
      this.notify(`Schutzgeld ${b.name}: +${U.money(R.owed)}`, 'money'); this.emit('sfx', { s: 'cash' });
      if (k) this.bark(k, U.pick(['Hier. Alles da.', 'Pünktlich wie immer.', 'Bitte… es läuft gerade schlecht.']), 2);
      R.owed = 0; R.unpaid = 0;
      this.addRep(1);
    },

    // ============================================================ street dealers
    dealerNear() {
      const p = this.player;
      for (const a of this.near(p.x, p.y, 40)) if (a.kind === 'dealer' && a.alive && a.ko <= 0) { const rec = this.org().dealers.find((r) => r.uid === a.dealer); if (rec) return { a, rec }; }
      return null;
    },
    /** open a corner where you stand */
    openCorner() {
      const O = this.org(), p = this.player, P = this.P;
      if (O.dealers.filter((d) => !d.gone).length >= this.maxDealers()) { this.notify(`Mehr Ecken gibt dein Rang nicht her (${this.maxDealers()}).`, 'bad'); return null; }
      if (this.bldAt(p.x, p.y) >= 0 || p.inCar) { this.notify('Eine Ecke ist draußen auf der Straße.', 'bad'); return null; }
      if (O.dealers.some((d) => !d.gone && Math.hypot(d.x - p.x, d.y - p.y) < 12 * TILE)) { this.notify('Hier steht schon einer von dir.', 'bad'); return null; }
      if (!this.pay(K.ORG.dealerFee)) { this.notify(`Ein Dealer will ${U.money(K.ORG.dealerFee)} Startgeld.`, 'bad'); return null; }
      O.seq = (O.seq || 0) + 1;
      const rec = { uid: O.seq, name: U.pick(['Tico', 'Mo', 'Kurze', 'Dima', 'Jojo', 'Sami', 'Lenny', 'Kemal', 'Rico', 'Zoe']), x: p.x + 20, y: p.y, stock: {}, cash: 0, sold: 0, outfit: U.pick(['hoodie', 'civ5', 'leather', 'gang']), key: this.turfKeyAt ? this.turfKeyAt(p.x, p.y) : '', hired: this.today() };
      O.dealers.push(rec);
      this.spawnDealer(rec);
      this.notify(`${rec.name} übernimmt diese Ecke. Gib ihm Ware [E].`, 'good');
      return rec;
    },
    spawnDealer(rec) {
      const a = this.spawnActor('dealer', rec.x, rec.y, { outfit: rec.outfit, state: 'corner', name: rec.name, hp: 100 });
      a.dealer = rec.uid; a.brain.post = { x: rec.x, y: rec.y }; a.important = true;
      rec.actor = a.id;
      return a;
    },
    ai_corner(a, dt) {
      const P = a.brain.post; if (!P) return;
      if (Math.hypot(P.x - a.x, P.y - a.y) > 20) { this.goTo(a, P.x, P.y, { tol: 14 }); a.dv = this.steer(a, 70, dt); return; }
      a.dv = [0, 0]; a.brain.lookT = (a.brain.lookT || 0) - dt;
      if (a.brain.lookT <= 0) { a.brain.lookT = 2 + Math.random() * 4; a.faceTo = Math.random() * U.TAU; }
      else a.faceTo = a.faceTo != null ? a.faceTo : a.angle;
    },
    dealerGive(rec, item, n) {
      const P = this.P; n = Math.min(n, P.inv[item] || 0); if (n <= 0) return false;
      this.takeItem(item, n); rec.stock[item] = (rec.stock[item] || 0) + n; this.emit('sfx', { s: 'grab' }); return true;
    },
    dealerTake(rec, item) { const n = rec.stock[item] || 0; if (!n) return false; this.addItem(item, n); delete rec.stock[item]; return true; },
    dealerCollect(rec) { if (!rec.cash) return false; this.P.money += rec.cash; this.notify(`${rec.name}: +${U.money(rec.cash)}`, 'money'); this.emit('sfx', { s: 'cash' }); rec.cash = 0; return true; },
    dealerFire(rec) {
      this.dealerCollect(rec);
      for (const k in rec.stock) this.addItem(k, rec.stock[k]);
      rec.stock = {}; rec.gone = true;
      const a = this.byId.get(rec.actor); if (a && a.alive) { a.state = 'wander'; a.dealer = 0; a.important = false; }
      this.org().dealers = this.org().dealers.filter((d) => d !== rec);
    },
    dealerUnits(rec) { return Object.entries(rec.stock).reduce((s, [k, n]) => s + (K.ITEMS[k] && K.ITEMS[k].drug ? n : 0), 0); },
    /** one game minute on a corner */
    dealerTick(rec, min) {
      const O = this.org(), d = this.districtAt(rec.x, rec.y), own = this.ownTurfAt && this.ownTurfAt(rec.x, rec.y);
      const owner = this.turfOwner ? this.turfOwner(this.turfKeyAt(rec.x, rec.y)) : null, rival = owner && owner !== 'player';
      const night = this.isNight();
      const rate = 0.06 * (night ? 1.6 : 1) * (K.ORG.demand[d] || 1) * (own ? 1.3 : rival ? 0.6 : 1) * (1 + Math.min(0.5, (this.P.deal ? this.P.deal.rep : 0) * 0.005));
      if (this.dealerUnits(rec) > 0 && Math.random() < rate * min) {
        const drug = ['coke', 'meth', 'bud'].find((k) => (rec.stock[k] || 0) > (k === 'bud' ? 1 : 0));
        if (drug) {
          const it = K.ITEMS[drug], n = drug === 'bud' ? Math.min(rec.stock.bud, 2 + U.rint(3)) : Math.min(rec.stock[drug], 1 + (Math.random() < 0.3 ? 1 : 0));
          const unit = drug === 'bud' ? 16 : it.street, price = Math.round(n * unit * (0.85 + Math.random() * 0.3) * (own ? 1.15 : 1));
          rec.stock[drug] -= n; if (rec.stock[drug] <= 0) delete rec.stock[drug];
          const mine = Math.round(price * (1 - K.ORG.dealerCut));
          rec.cash += mine; rec.sold += n; O.today.dealers += mine;
          this.addRep(0.15);
        }
      }
      // risks (per hour → per minute)
      const bust = 0.03 * (d === 'down' ? 1.5 : 1) * (own ? 0.5 : 1) * (this.wanted > 0 ? 1.5 : 1) / 60;
      const rob = (rival ? (this.P.wars && this.P.wars[owner] ? 0.05 : 0.015) : 0.004) / 60;
      if (this.dealerUnits(rec) + rec.cash > 0 && Math.random() < bust * min) this.dealerLost(rec, 'bust');
      else if (rec.cash > 50 && Math.random() < rob * min) { const lost = rec.cash; rec.cash = 0; this.notify(`${rec.name} wurde ${rival ? 'von ' + K.GANGS[owner].name : ''} ausgeraubt: −${U.money(lost)}`, 'bad'); }
    },
    dealerLost(rec, why) {
      rec.gone = true; rec.stock = {}; rec.cash = 0;
      const a = this.byId.get(rec.actor); if (a && a.alive) { if (why === 'bust' && a.state !== 'cuffed') { a.state = 'cuffed'; a.dealer = 0; } }
      this.org().dealers = this.org().dealers.filter((d) => d !== rec);
      this.notify(why === 'bust' ? `Razzia! ${rec.name} wurde festgenommen — Ware und Kasse sind weg.` : `${rec.name} ist raus.`, 'bad');
      this.addRep(-6);
    },

    // ============================================================ legal businesses
    bizLevel(id) { return (this.P.bizUp && this.P.bizUp[id]) || 0; },
    bizMult(id) { let m = 1; for (let i = 0; i < this.bizLevel(id); i++) m += K.ORG.bizUp[i].mult; return m; },
    bizUpgradeCost(id) { const d = this.propertyDef(id); return d && d.income ? Math.round(d.income * 9 * (this.bizLevel(id) + 1) / 100) * 100 : 0; },
    bizUpgrade(id) {
      const lv = this.bizLevel(id); if (lv >= K.ORG.bizUp.length) return false;
      const cost = this.bizUpgradeCost(id);
      if (!this.pay(cost)) { this.notify('Nicht genug Geld.', 'bad'); return false; }
      (this.P.bizUp || (this.P.bizUp = {}))[id] = lv + 1;
      this.emit('sfx', { s: 'purchase' }); this.notify(`${this.propertyDef(id).name}: ${K.ORG.bizUp[lv].name} (+${Math.round(K.ORG.bizUp[lv].mult * 100)}% Umsatz)`, 'good');
      this.addRep(3);
      return true;
    },

    // ============================================================ the street war between gangs
    gangSkirmish() {
      if (!this.turfSpots || !this.P.turf) return null;
      const T = this.P.turf, keys = Object.keys(this.turfSpots).filter((k) => T[k] && K.GANGS[T[k]]);
      for (let tries = 0; tries < 12; tries++) {
        const k = U.pick(keys); if (!k) return null;
        const [bi, bj] = k.split(',').map(Number), att = T[k];
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (bi + dx) + ',' + (bj + dy)).filter((q) => this.turfSpots[q] && T[q] !== att && T[q] !== 'player');
        if (!nb.length) continue;
        const q = U.pick(nb), def = T[q];
        // the bigger gang tends to win
        const pa = this.gangBlocks(att) + 2, pd = def ? this.gangBlocks(def) + 3 : 1;
        if (Math.random() < pa / (pa + pd)) {
          T[q] = att; this.emit('turf', {});
          const s = this.turfSpots[q], near = Math.hypot((s.x + 0.5) * TILE - this.player.x, (s.y + 0.5) * TILE - this.player.y) < 60 * TILE;
          if (near) this.notify(`${K.GANGS[att].name} haben ${def ? 'den ' + K.GANGS[def].name + ' ' : ''}einen Block abgenommen (${K.DISTRICTS[s.d] || ''}).`, 'bad');
          // shops under your protection in that block may switch sides
          for (const bid in this.org().racket) { const b = this.buildings[bid]; if (b && this.turfKeyAt(b.x * TILE, b.y * TILE) === q && Math.random() < 0.5) { delete this.org().racket[bid]; this.notify(`${b.name} zahlt jetzt an ${K.GANGS[att].name}.`, 'bad'); } }
          return { from: def, to: att, key: q };
        }
      }
      return null;
    },

    // ============================================================ ticking
    updateOrg(dt) {
      const O = this.org(), p = this.player;
      // dealers: spawn when you're around, simulate always
      this.orgT = (this.orgT || 0) - dt;
      if (this.orgT <= 0) {
        this.orgT = 1;
        const min = Math.max(0, this.time - (this.orgLast == null ? this.time : this.orgLast)); this.orgLast = this.time;
        for (const rec of O.dealers.slice()) {
          if (rec.gone) continue;
          const a = this.byId.get(rec.actor), near = Math.hypot(rec.x - p.x, rec.y - p.y) < 50 * TILE;
          if (near && (!a || !a.alive || a.removed) && !rec.dead) { if (a && !a.alive) { rec.dead = true; this.dealerLost(rec, 'dead'); continue; } this.spawnDealer(rec); }
          else if (!near && a && a.alive && !a.removed) this.removeActor(a);
          if (min > 0) for (let m = 0; m < Math.min(min, 600); m += 1) this.dealerTick(rec, Math.min(1, min - m));
          // buyers walk up while you watch
          if (near && a && a.alive && (rec.stock && this.dealerUnits(rec) > 0) && Math.random() < 0.04) {
            const c = this.actors.find((q) => q.kind === 'civ' && q.alive && q.state === 'wander' && Math.hypot(q.x - a.x, q.y - a.y) < 14 * TILE && Math.hypot(q.x - a.x, q.y - a.y) > 3 * TILE);
            if (c) { c.state = 'buy'; c.brain.dealer = a.id; c.brain.buyT = 0; }
          }
        }
      }
      // daily: rackets accrue, unpaid ones lapse, rivals lean on your shops, the gangs fight
      const day = this.today();
      if (O.day == null) O.day = day;
      if (O.day !== day) {
        O.day = day; O.today = { racket: 0, dealers: 0 };
        for (const bid in O.racket) {
          const R = O.racket[bid], b = this.buildings[bid];
          if (!b) { delete O.racket[bid]; continue; }
          const own = this.ownTurfAt && this.ownTurfAt(b.x * TILE, b.y * TILE);
          if (own && this.P.gang) { const v = Math.round(R.rate * 0.9); this.P.bank = (this.P.bank || 0) + v; O.today.racket += v; continue; }   // your gang collects on your turf
          R.owed += R.rate; R.unpaid++;
          if (R.unpaid > 5) { delete O.racket[bid]; this.notify(`${b.name} zahlt nicht mehr — du hast dich zu lange nicht blicken lassen.`, 'bad'); this.addRep(-4); }
        }
        if (Math.random() < 0.6) this.gangSkirmish();
      }
    },
    /** a buyer walks to your dealer, does the handshake and goes */
    ai_buy(a, dt) {
      const d = this.byId.get(a.brain.dealer);
      if (!d || !d.alive) { a.state = 'wander'; return; }
      if (Math.hypot(d.x - a.x, d.y - a.y) > 26) { this.goTo(a, d.x, d.y, { tol: 20 }); a.dv = this.steer(a, 80, dt); return; }
      a.dv = [0, 0]; a.faceTo = Math.atan2(d.y - a.y, d.x - a.x); d.faceTo = a.faceTo + Math.PI;
      a.brain.buyT += dt;
      if (a.brain.buyT > 2) { a.state = 'wander'; this.emit('sfx', { s: 'coins' }); }
    },
  });
})(globalThis.K = globalThis.K || {});
