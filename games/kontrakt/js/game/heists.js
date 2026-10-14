/* RDE // KONTRAKT — heists: the Sparkasse vault and Juwelier Goldmann.
 * Vault doors open with the director's keycard (quiet), a thermal drill (loud) or C4 (very loud).
 * Every heist trips an alarm sooner or later; banks bring three stars and a lot of police. */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE;

  K.mixin({
    vaultDoorNear() {
      const a = this.player, tx = (a.x / TILE) | 0, ty = (a.y / TILE) | 0;
      for (let j = ty - 1; j <= ty + 1; j++) for (let i = tx - 1; i <= tx + 1; i++) {
        const d = this.doors.get(j * this.W + i);
        if (d && d.vault && d.locked && Math.hypot((i + 0.5) * TILE - a.x, (j + 0.5) * TILE - a.y) < TILE * 1.4) return d;
      }
      return null;
    },
    /** context prompts for heists; returns true when something was offered */
    heistContext(add) {
      const P = this.P, a = this.player;
      if (a.inCar || this.drag) return false;
      const d = this.vaultDoorNear();
      if (d) {
        if (P.inv.keycard) add('E', 'Tresortür: Schlüsselkarte durchziehen', () => this.openVault(d, 'card'), 1.6, { tick: (dt) => { if (Math.random() < dt * 4) this.emit('sfx', { s: 'beep' }); } });
        if (P.inv.drill) add('T', 'Tresortür aufbohren (Thermobohrer)', () => this.openVault(d, 'drill'), 20, { tick: (dt) => this.drillTick(d, dt) });
        if (!P.inv.keycard && !P.inv.drill) add('E', 'Tresortür — Schlüsselkarte, Thermobohrer oder C4 nötig', null);
        return true;
      }
      const box = this.propNear(['deposit'], 1.2);
      if (box) {
        if (box.lootDay === this.today()) add('E', 'Schließfach — ausgeräumt', null);
        else add('E', 'Schließfach aufbrechen', () => this.lootDeposit(box), 2.2, { tick: (dt) => { if (Math.random() < dt * 5) this.emit('sfx', { s: 'pick' }); } });
        return true;
      }
      const sc = this.propNear(['showcase'], 1.2);
      if (sc) {
        if (sc.smashDay === this.today()) add('T', 'Vitrine — leer', null);
        else add('T', 'Vitrine einschlagen', () => this.smashCase(sc), 0.7);
        return true;
      }
      return false;
    },
    drillTick(d, dt) {
      const a = this.player;
      d.drillT = (d.drillT || 0) + dt;
      if (Math.random() < dt * 2.2) this.emit('sfx', { s: 'drill' });
      if (Math.random() < dt * 0.8) this.noise(a.x, a.y, 9, 'scuffle', a);
      if (Math.random() < dt * 6) this.emit('sparks', { x: (d.x + 0.5) * TILE, y: (d.y + 0.5) * TILE });
    },
    openVault(d, how) {
      const b = this.buildings[d.bld];
      for (const v of b.doors) if (v.vault) { v.locked = false; v.picked = true; v.vaultOpen = true; }
      if (how === 'card') this.takeItem('keycard');
      this.emit('sfx', { s: 'vault' });
      this.emit('banner', { title: 'TRESOR OFFEN', sub: how === 'card' ? 'Leise rein, schnell raus. Der Zeitschloss-Alarm läuft.' : how === 'c4' ? 'Das hat die ganze Straße gehört.' : 'Der Bohrer hat es geschafft.', kind: 'gold' });
      this.addXP(40, 'Tresor geöffnet');
      this.crimeEvent(this.player, 'heist', this.player.x, this.player.y, null);
      // the time lock reports an unscheduled opening — later with a card
      this.heistAlarm(b, how === 'card' ? 35 : how === 'drill' ? 4 : 0);
    },
    lootDeposit(box) {
      const P = this.P, b = this.buildings[box.bld];
      box.lootDay = this.today();
      const cash = 900 + U.rint(2600);
      P.money += cash;
      const extra = [];
      if (Math.random() < 0.3) { this.addItem('gold'); extra.push('Goldbarren'); }
      if (Math.random() < 0.25) { const n = 1 + U.rint(2); this.addItem('jewelry', n); extra.push(`Schmuck ×${n}`); }
      if (Math.random() < 0.1) { this.addItem('diamond'); extra.push('Diamant'); }
      this.notify(`Schließfach: +${U.money(cash)}${extra.length ? ' · ' + extra.join(', ') : ''}`, 'money');
      this.emit('sfx', { s: 'cash' });
      this.stats && (this.stats.heistLoot = (this.stats.heistLoot || 0) + cash);
      if (b && !(b.alarmUntil > this.t)) this.crimeEvent(this.player, 'theft', this.player.x, this.player.y, null);
    },
    smashCase(sc) {
      const b = this.buildings[sc.bld], a = this.player;
      sc.smashDay = this.today();
      const x = (sc.x + 0.5) * TILE, y = (sc.y + 0.5) * TILE;
      this.emit('glass', { x, y, tx: sc.x, ty: sc.y });
      this.noise(x, y, 8, 'glass', a);
      const n = 2 + U.rint(3), got = [`Schmuck ×${n}`];
      this.addItem('jewelry', n);
      if (Math.random() < 0.4) { this.addItem('watch'); got.push('Goldene Uhr'); }
      if (Math.random() < 0.15) { this.addItem('diamond'); got.push('Diamant'); }
      this.notify(`Vitrine: ${got.join(', ')}`, 'loot');
      // the shopkeeper hits the panic button
      for (const k of this.actors) if (k.kind === 'keeper' && k.home === sc.bld && k.alive && k.ko <= 0 && k.state !== 'cower') { k.state = 'cower'; k.crouch = true; k.brain.cowerT = 8; k.brain.cowerBy = 0; this.bark(k, 'Nein! Nicht die Vitrinen!', 2); }
      this.crimeEvent(a, 'robbery', a.x, a.y, null);
      this.heistAlarm(b, 5);
    },
    /** audible building alarm + dispatch; banks bring three stars */
    heistAlarm(b, delay) {
      if (!b || b.alarmUntil > this.t || b.alarmPending) return;
      b.alarmPending = true;
      const go = () => {
        b.alarmPending = false; b.alarmUntil = this.t + 180; b.alarmDay = this.today();
        const bank = b.type === 'bank';
        const cx = (b.x + b.w / 2) * TILE, cy = (b.y + b.h / 2) * TILE;
        const p = this.player, inside = this.bldAt(p.x, p.y) === b.id || Math.hypot(p.x - cx, p.y - cy) < 14 * TILE;
        if (inside) this.raiseWanted(bank ? 3 : 2, bank ? 'heist' : 'robbery');
        this.dispatch(cx, cy, 2, { foe: 0 });
        if (bank) this.dispatch(cx, cy, 2, { foe: 0 });
        if (b.zone != null) this.zoneAlert(b.zone, p.x, p.y);
        this.emit('notify', { text: bank ? 'BANKALARM! Die halbe Polizei ist unterwegs.' : 'Alarm beim Juwelier — Polizei unterwegs!', kind: 'bad' });
      };
      if (delay > 0) this.later(delay, go); else go();
    },
    /** explosions blow vault doors */
    blastDoors(x, y, R) {
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
        const tx = ((x / TILE) | 0) + i, ty = ((y / TILE) | 0) + j;
        const d = this.doors.get(ty * this.W + tx);
        if (!d || !d.locked || Math.hypot((tx + 0.5) * TILE - x, (ty + 0.5) * TILE - y) > Math.max(R, 2.2 * TILE)) continue;
        if (d.vault) { d.blown = true; this.openVault(d, 'c4'); }
        else { d.locked = false; d.picked = true; d.blown = true; d.open = 1; }
      }
    },
    updateHeists(dt) {
      // a new day: the bank has repaired and re-sealed its vault
      const day = this.today();
      if (this.heistDay !== day) {
        this.heistDay = day;
        for (const b of this.buildings) if (b.vault && this.bldAt(this.player.x, this.player.y) !== b.id)
          for (const d of b.doors) if (d.vault) { d.locked = true; d.picked = false; d.vaultOpen = false; d.blown = false; d.open = 0; }
      }
      this.alarmBellT = (this.alarmBellT || 0) - dt;
      if (this.alarmBellT > 0) return;
      this.alarmBellT = 1.3;
      const p = this.player;
      for (const b of this.buildings) {
        if (!(b.alarmUntil > this.t)) continue;
        const cx = (b.x + b.w / 2) * TILE, cy = (b.y + b.h / 2) * TILE, d = Math.hypot(p.x - cx, p.y - cy);
        if (d < 40 * TILE) this.emit('alarmbell', { x: cx, y: cy, v: Math.max(0.15, 1 - d / (40 * TILE)) });
      }
    },
  });
})(globalThis.K = globalThis.K || {});
