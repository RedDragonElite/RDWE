/* RDE // KONTRAKT — hotbar: nine free slots for weapons AND items (mask, food, medkit, jerry can …).
 * Keys 1–9 use the slot (weapon: draw / put away again, item: use), 0 = fists, H = put everything away. */
(function (K) {
  'use strict';
  const W8 = K.WEAPONS;
  K.HOTBAR_N = 9;

  K.mixin({
    hotbar() {
      const P = this.P;
      if (!Array.isArray(P.hotbar) || P.hotbar.length !== K.HOTBAR_N) {
        P.hotbar = new Array(K.HOTBAR_N).fill(null);
        let i = 0;
        for (const w of P.weapons) if (w.id !== 'fists' && i < K.HOTBAR_N) P.hotbar[i++] = { t: 'w', id: w.id };
        for (const k of ['bandage', 'sandwich', 'water', 'mask']) if (P.inv[k] && i < K.HOTBAR_N) P.hotbar[i++] = { t: 'i', id: k };
      }
      // weapons you no longer carry leave the bar; items stay (empty, greyed) so you can restock
      for (let i = 0; i < K.HOTBAR_N; i++) { const e = P.hotbar[i]; if (e && e.t === 'w' && !P.weapons.some((w) => w.id === e.id)) P.hotbar[i] = null; }
      return P.hotbar;
    },
    hotbarIndexOf(t, id) { return this.hotbar().findIndex((e) => e && e.t === t && e.id === id); },
    hotbarAdd(t, id) {
      const hb = this.hotbar();
      if (this.hotbarIndexOf(t, id) >= 0) return;
      const i = hb.indexOf(null); if (i >= 0) hb[i] = { t, id };
    },
    hotbarSet(i, entry) {
      const hb = this.hotbar(); if (i < 0 || i >= K.HOTBAR_N) return;
      if (entry) { const j = this.hotbarIndexOf(entry.t, entry.id); if (j >= 0 && j !== i) hb[j] = hb[i]; }   // move, don't duplicate
      hb[i] = entry ? { t: entry.t, id: entry.id } : null;
    },
    hotbarSwap(i, j) { const hb = this.hotbar(); [hb[i], hb[j]] = [hb[j], hb[i]]; },
    /** equip a weapon by id (or put it away when it is already in hand) */
    equipWeapon(id, toggle) {
      const P = this.P, a = this.player, i = P.weapons.findIndex((w) => w.id === id);
      if (i < 0) return false;
      if (toggle && P.slot === i && !P.handsDown && i > 0) { this.holsterAll(); return true; }
      if (P.slot !== i) { if (P.slot) P.last = P.slot; P.slot = i; a.reloadT = 0; a.reloading = false; a.cool = Math.max(a.cool, 0.2); }
      P.handsDown = false; a.wi = this.curWeapon();
      this.emit('equip', { w: id });
      return true;
    },
    holsterAll() {
      const P = this.P, a = this.player;
      if (P.slot) P.last = P.slot;
      P.slot = 0; P.handsDown = true; a.reloadT = 0; a.reloading = false; a.wi = this.curWeapon();
      this.emit('sfx', { s: 'cloth' }); this.emit('equip', { w: 'fists' });
    },
    hotbarUse(i) {
      const e = this.hotbar()[i]; if (!e) return false;
      if (e.t === 'w') return this.equipWeapon(e.id, true);
      if (!(this.P.inv[e.id] > 0)) { this.notify(`${K.ITEMS[e.id] ? K.ITEMS[e.id].name : e.id}: keins mehr da.`, 'bad'); return false; }
      return this.useItem(e.id);
    },
    /** mouse wheel: step through the weapons on the bar */
    hotbarCycle(dir) {
      const P = this.P, hb = this.hotbar();
      const ws = hb.map((e, i) => (e && e.t === 'w' ? i : -1)).filter((i) => i >= 0);
      if (!ws.length) return;
      const cur = hb.findIndex((e) => e && e.t === 'w' && P.weapons[P.slot] && e.id === P.weapons[P.slot].id && !P.handsDown);
      const k = cur < 0 ? (dir > 0 ? 0 : ws.length - 1) : (ws.indexOf(cur) + dir + ws.length) % ws.length;
      this.equipWeapon(hb[ws[k]].id, false);
    },
  });
})(globalThis.K = globalThis.K || {});
