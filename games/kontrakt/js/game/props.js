/* RDE // KONTRAKT — prop system (after rde_props · rde_placeable_items · rde_props_interact).
 * Buy furniture, site gear, safes and stations, place them with a ghost that follows the mouse
 * ([R]/wheel rotates, LMB places, RMB/ESC cancels), open containers with slot + weight limits and
 * code locks, run crafting stations (time based — they keep cooking while you are away), pick
 * everything up again. All placed props are saved and come back with the save game. */
(function (K) {
  'use strict';
  const U = K.U, T = K.T, TF = K.TF, TILE = K.TILE, W8 = K.WEAPONS;

  // new prop kinds for the renderer / collision table (s: 1 move · 2 bullets · 4 sight)
  Object.assign(K.PROPK, {
    barrier: { s: 1 }, warnsign: { s: 1 }, spot: { s: 1 }, foldtable: { s: 1 }, foldchair: { s: 0 }, tent: { s: 0, low: 1 },
    armchair: { s: 1 }, floorlamp: { s: 1 }, jukebox: { s: 1 }, case: { s: 1 }, bigsafe: { s: 3 }, gunrack: { s: 3 },
    weedtable: { s: 1 }, methlab: { s: 1 }, cokelab: { s: 1 }, gunbench: { s: 1 }, alarm: { s: 0 },
  });
  Object.assign(K.BREAKABLE, {
    cone: { v: 15, keep: 0.97, dmg: 0 }, barrier: { v: 40, keep: 0.85, dmg: 2 }, warnsign: { v: 25, keep: 0.92, dmg: 1 },
    foldchair: { v: 15, keep: 0.96, dmg: 0 }, foldtable: { v: 30, keep: 0.9, dmg: 1 }, spot: { v: 30, keep: 0.9, dmg: 1 },
  });

  /** where: 'any' = street or your own property · 'own' = only inside a property you own */
  K.PLACE = {
    // street & site — Werkstatt
    cone:      { name: 'Leitkegel', e: '🔺', cat: 'street', price: 25, kg: 1, k: 'cone', where: 'any', desc: 'Sperrt Fahrspuren ab. Autos fahren ihn um.' },
    barrier:   { name: 'Absperrgitter', e: '🚧', cat: 'street', price: 90, kg: 5, w: 2, k: 'barrier', where: 'any', desc: 'Hält Fußgänger auf. Ein Auto mit Schwung nicht.' },
    warnsign:  { name: 'Warnschild', e: '⚠️', cat: 'street', price: 40, kg: 2, k: 'warnsign', where: 'any' },
    spot:      { name: 'Baustrahler', e: '💡', cat: 'street', price: 160, kg: 4, k: 'spot', where: 'any', light: { r: 250, c: [255, 240, 210], i: 1, kind: 'lamp' }, desc: 'Macht die Nacht zum Tag.' },
    foldtable: { name: 'Klapptisch', e: '🟫', cat: 'street', price: 60, kg: 5, w: 2, k: 'foldtable', where: 'any' },
    foldchair: { name: 'Klappstuhl', e: '🪑', cat: 'street', price: 25, kg: 2, k: 'foldchair', where: 'any' },
    tent:      { name: 'Pavillon', e: '⛺', cat: 'street', price: 240, kg: 8, w: 2, h: 2, k: 'tent', where: 'any', desc: 'Schatten am Strand, Sichtschutz für Geschäfte.' },
    // home — Einrichtungs-App
    sofa:      { name: 'Ledersofa', e: '🛋️', cat: 'home', price: 900, kg: 9, w: 2, k: 'sofa', where: 'own' },
    armchair:  { name: 'Clubsessel', e: '💺', cat: 'home', price: 380, kg: 5, k: 'armchair', where: 'own' },
    ctable:    { name: 'Couchtisch', e: '🟤', cat: 'home', price: 220, kg: 4, k: 'table', where: 'own' },
    houseplant:{ name: 'Monstera', e: '🪴', cat: 'home', price: 60, kg: 3, k: 'plant', where: 'own' },
    floorlamp: { name: 'Stehlampe', e: '🛋', cat: 'home', price: 140, kg: 3, k: 'floorlamp', where: 'own', light: { r: 130, c: [255, 190, 130], i: 0.5, kind: 'room' } },
    tv:        { name: 'OLED-TV 77"', e: '📺', cat: 'home', price: 1400, kg: 6, k: 'tv', where: 'own' },
    rug:       { name: 'Perserteppich', e: '🟥', cat: 'home', price: 300, kg: 4, w: 2, h: 2, k: 'rug', where: 'own' },
    bed:       { name: 'Boxspringbett', e: '🛏️', cat: 'home', price: 1100, kg: 12, w: 2, h: 2, k: 'bed', where: 'own', desc: 'Schlafen & speichern.' },
    jukebox:   { name: 'Jukebox', e: '🎶', cat: 'home', price: 2200, kg: 10, k: 'jukebox', where: 'own', desc: 'Neon, Vinyl und ein Knopf, der die Musik wechselt.' },
    pooltable: { name: 'Billardtisch', e: '🎱', cat: 'home', price: 3200, kg: 14, w: 2, k: 'pooltable', where: 'own' },
    alarm:     { name: 'Alarmanlage', e: '🚨', cat: 'home', price: 1500, kg: 1, k: 'alarm', where: 'own', desc: 'Schützt die ganze Immobilie vor Einbrechern.' },
    // storage
    crate:     { name: 'Holzkiste', e: '📦', cat: 'store', price: 120, kg: 6, k: 'crate', where: 'any', store: { slots: 6, kg: 40 }, desc: 'Unverschlossen. Draußen wird sie schnell geplündert.' },
    case:      { name: 'Alukoffer', e: '🧳', cat: 'store', price: 350, kg: 3, k: 'case', where: 'any', store: { slots: 5, kg: 20 }, lock: 1 },
    shelf:     { name: 'Lagerregal', e: '🗄️', cat: 'store', price: 280, kg: 8, w: 2, k: 'shelf', where: 'own', store: { slots: 10, kg: 80 } },
    safe:      { name: 'Tresor', e: '🔐', cat: 'store', price: 2500, kg: 14, k: 'safe', where: 'own', store: { slots: 10, kg: 50 }, lock: 2 },
    bigsafe:   { name: 'Waffentresor XL', e: '🏦', cat: 'store', price: 7500, kg: 22, w: 2, k: 'bigsafe', where: 'own', store: { slots: 20, kg: 200 }, lock: 3, desc: 'Den knackt kein Einbrecher.' },
    gunrack:   { name: 'Waffenständer', e: '🔫', cat: 'store', price: 900, kg: 7, k: 'gunrack', where: 'own', store: { slots: 6, kg: 80, only: 'w' }, desc: 'Nur Waffen. Sieht man von außen.' },
    // stations — Schwarzmarkt
    weedtable: { name: 'Verpackungstisch', e: '🌿', cat: 'craft', price: 1200, kg: 8, w: 2, k: 'weedtable', where: 'own', craft: 'pack', black: true },
    methlab:   { name: 'Chemielabor', e: '⚗️', cat: 'craft', price: 6500, kg: 12, w: 2, k: 'methlab', where: 'own', craft: 'meth', black: true, desc: 'Stinkt. Kann hochgehen.' },
    cokelab:   { name: 'Koks-Station', e: '❄️', cat: 'craft', price: 9000, kg: 10, w: 2, k: 'cokelab', where: 'own', craft: 'coke', black: true },
    gunbench:  { name: 'Waffen-Werkbank', e: '🛠️', cat: 'craft', price: 4800, kg: 14, w: 2, k: 'gunbench', where: 'own', craft: 'bench', black: true },
  };
  K.PLACE_CATS = { street: 'Straße & Baustelle', home: 'Einrichtung', store: 'Lager & Tresore', craft: 'Stationen' };
  K.PLACE_MAX = 60; K.PLACE_PER_PROP = 30;
  for (const id in K.PLACE) {
    const d = K.PLACE[id]; d.id = id; d.w = d.w || 1; d.h = d.h || 1;
    K.ITEMS['pl_' + id] = { id: 'pl_' + id, name: d.name, e: d.e, price: d.price, w: d.kg, place: id, desc: (d.desc ? d.desc + ' ' : '') + 'Benutzen: platzieren.' };
  }

  // ingredients & products of the stations
  Object.assign(K.ITEMS, {
    chem:      { id: 'chem', name: 'Chemikalien-Kanister', e: '🧪', price: 260, w: 2, desc: 'Für das Chemielabor.' },
    cocapaste: { id: 'cocapaste', name: 'Koka-Paste', e: '🟫', price: 1100, w: 1, hot: true, desc: 'Für die Koks-Station.' },
    cutting:   { id: 'cutting', name: 'Streckmittel', e: '🥛', price: 35, w: 0.2, desc: 'Mannit. Offiziell ein Abführmittel.' },
    parts:     { id: 'parts', name: 'Waffenteile', e: '⚙️', price: 150, w: 1, desc: 'Für die Werkbank: Munition, Dämpfer, Dietriche.' },
    weedbrick: { id: 'weedbrick', name: 'Gras-Paket (25 g)', e: '🧱', price: 0, sell: 480, w: 0.03, drug: true, sellOnly: true, desc: 'Vakuumiert. Der Schwarzmarkt zahlt gut.' },
    meth:      { id: 'meth', name: 'Kristall', e: '🔹', price: 0, sell: 30, street: 55, w: 0.002, drug: true, energy: 40, hp: -6, desc: 'Auf der Straße verkaufen [T bei Passanten].' },
    coke:      { id: 'coke', name: 'Koks', e: '❄️', price: 0, sell: 62, street: 110, w: 0.002, drug: true, energy: 30, desc: 'Auf der Straße verkaufen [T bei Passanten].' },
  });

  K.SHOPS.black.items.push('pl_weedtable', 'pl_methlab', 'pl_cokelab', 'pl_gunbench', 'chem', 'cocapaste', 'parts');
  K.SHOPS.mech.items.push('pl_cone', 'pl_barrier', 'pl_warnsign', 'pl_spot', 'pl_foldtable', 'pl_foldchair', 'pl_tent', 'pl_crate', 'pl_case');
  K.SHOPS.pharmacy.items.push('cutting');

  K.RECIPES = {
    pack: [{ id: 'brick', name: 'Gras-Paket pressen', in: { bud: 25 }, out: { weedbrick: 1 }, min: 20 }],
    meth: [{ id: 'meth', name: 'Kristall kochen (8)', in: { chem: 1 }, out: { meth: 8 }, min: 60, risk: 0.05, smell: 1 }],
    coke: [{ id: 'coke', name: 'Strecken & pressen (14)', in: { cocapaste: 1, cutting: 2 }, out: { coke: 14 }, min: 90, smell: 0.5 }],
    bench: [
      { id: 'a9', name: '9mm × 30', in: { parts: 1 }, out: { 'a:9mm': 30 }, min: 10 },
      { id: 'a556', name: '5.56 × 30', in: { parts: 2 }, out: { 'a:556': 30 }, min: 15 },
      { id: 'a762', name: '7.62 × 30', in: { parts: 2 }, out: { 'a:762': 30 }, min: 15 },
      { id: 'a308', name: '.308 × 10', in: { parts: 2 }, out: { 'a:308': 10 }, min: 15 },
      { id: 'a50', name: '.50 BMG × 5', in: { parts: 4 }, out: { 'a:50': 5 }, min: 30 },
      { id: 'sil', name: 'Schalldämpfer', in: { parts: 3 }, out: { silencer: 1 }, min: 25 },
      { id: 'pick', name: 'Dietriche × 3', in: { parts: 1 }, out: { lockpick: 3 }, min: 8 },
    ],
  };

  const footprint = (d, rot) => (rot & 1 ? [d.h, d.w] : [d.w, d.h]);
  const keyName = (k) => (k.startsWith('a:') ? K.AMMO[k.slice(2)].name : K.ITEMS[k] ? K.ITEMS[k].name : W8[k] ? W8[k].name : k);

  K.mixin({
    // ============================================================ bookkeeping
    placedList() { return this.P.placed || (this.P.placed = []); },
    placedRec(uid) { return this.placedList().find((r) => r.uid === uid); },
    placedProp(rec) { return (this.placedMap || (this.placedMap = new Map())).get(rec.uid); },
    /** put a record into the world: tiles, collision, nav, light */
    spawnPlaced(rec) {
      const d = K.PLACE[rec.id]; if (!d) return null;
      const W = this.W, s = K.PROPK[d.k].s;
      const b = this.bldAt((rec.x + 0.5) * TILE, (rec.y + 0.5) * TILE);
      const p = { id: this.props.length, k: d.k, x: rec.x, y: rec.y, w: rec.w, h: rec.h, face: rec.rot || 0, c: rec.c || 0, bld: b, placed: rec.uid, rec };
      this.props.push(p);
      for (let j = p.y; j < p.y + p.h; j++) for (let i = p.x; i < p.x + p.w; i++) {
        const ii = j * W + i; this.solid[ii] |= s; this.pmap[ii] = p.id;
        if (s & 4) this.opaque[ii] = 1;
        if (this.nav) this.nav.cost[ii] = this.nav.baseCost(ii);
      }
      if (d.light) {
        const L = { x: (p.x + p.w / 2) * TILE, y: (p.y + p.h / 2) * TILE, r: d.light.r, c: d.light.c, i: d.light.i, kind: d.light.kind, placed: rec.uid };
        const B = b >= 0 ? this.buildings[b] : null, room = B && B.rooms && B.rooms.find((r) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h);
        if (L.kind === 'room' && room) { L.bld = b; L.clip = { x: room.x * TILE, y: room.y * TILE, w: room.w * TILE, h: room.h * TILE }; } else L.kind = 'lamp';
        this.lights.push(L);
      }
      (this.placedMap || (this.placedMap = new Map())).set(rec.uid, p);
      this.emit('propChanged', { x: p.x, y: p.y, w: p.w, h: p.h });
      return p;
    },
    despawnPlaced(rec) {
      const p = this.placedProp(rec); if (!p) return;
      const W = this.W;
      for (let j = p.y; j < p.y + p.h; j++) for (let i = p.x; i < p.x + p.w; i++) {
        const ii = j * W + i; if (this.pmap[ii] !== p.id) continue;
        this.solid[ii] = 0; this.pmap[ii] = -1;
        this.opaque[ii] = TF[this.tiles[ii]] & 2 || this.tiles[ii] === T.DOOR ? 1 : 0;
        if (this.nav) this.nav.cost[ii] = this.nav.baseCost(ii);
      }
      this.props[p.id] = null;
      this.lights = this.lights.filter((L) => L.placed !== rec.uid);
      this.placedMap.delete(rec.uid);
      this.emit('propChanged', { x: p.x, y: p.y, w: p.w, h: p.h });
    },
    restorePlaced() {
      for (const rec of this.placedList()) if (!this.placedProp(rec)) this.spawnPlaced(rec);
    },
    /** a car flattened one of your props */
    placedBroken(p) {
      const rec = p.rec; if (!rec) return;
      this.P.placed = this.placedList().filter((r) => r !== rec);
      this.lights = this.lights.filter((L) => L.placed !== rec.uid);
      this.placedMap.delete(rec.uid);
      if (this.nav) for (let j = p.y; j < p.y + p.h; j++) for (let i = p.x; i < p.x + p.w; i++) this.nav.cost[j * this.W + i] = this.nav.baseCost(j * this.W + i);
    },

    // ============================================================ placement mode
    startPlace(id) {
      const d = K.PLACE[id];
      if (!d || !this.P.inv['pl_' + id]) return false;
      if (this.player.inCar) { this.notify('Erst aussteigen.', 'bad'); return false; }
      if (this.placedList().length >= K.PLACE_MAX) { this.notify(`Limit erreicht (${K.PLACE_MAX} Props).`, 'bad'); return false; }
      this.placing = { id, rot: 0, x: 0, y: 0, w: d.w, h: d.h, ok: false, why: '' };
      this.emit('sfx', { s: 'click' }); this.emit('placeMode', { on: true });
      return true;
    },
    cancelPlace() { if (!this.placing) return; this.placing = null; this.emit('sfx', { s: 'cloth' }); this.emit('placeMode', { on: false }); },
    rotatePlace(dir = 1) {
      const pl = this.placing; if (!pl) return;
      pl.rot = (pl.rot + (dir > 0 ? 1 : 3)) % 4;
      const d = K.PLACE[pl.id]; [pl.w, pl.h] = footprint(d, pl.rot);
      this.emit('sfx', { s: 'click' });
    },
    /** why a footprint can't take the prop ('' = fine) */
    placeCheck(id, x, y, w, h) {
      const d = K.PLACE[id], a = this.player, W = this.W;
      const cx = (x + w / 2) * TILE, cy = (y + h / 2) * TILE;
      if (Math.hypot(cx - a.x, cy - a.y) > 5 * TILE) return 'Zu weit weg';
      let bld = null;
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
        if (i < 1 || j < 1 || i >= W - 1 || j >= this.H - 1) return 'Außerhalb';
        const ii = j * W + i, t = this.tiles[ii];
        if (t === T.WATER || t === T.POOL) return 'Wasser';
        if (TF[t] & 1 || t === T.DOOR || t === T.WINDOW || t === T.GATE) return 'Wand oder Tür im Weg';
        if (this.pmap[ii] >= 0 || this.solid[ii]) return 'Platz belegt';
        const b = this.bmap[ii];
        if (bld === null) bld = b; else if (bld !== b) return 'Halb drin, halb draußen';
        // keep door approaches free
        if (K.PROPK[d.k].s & 1) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.tiles[ii + di + dj * W] === T.DOOR) return 'Versperrt eine Tür';
      }
      const B = bld >= 0 ? this.buildings[bld] : null;
      if (d.where === 'own' && !(B && B.owned)) return 'Nur in deiner Immobilie';
      if (B && !B.owned) return 'Nicht in fremden Gebäuden';
      if (B && this.placedList().filter((r) => r.prop === B.property).length >= K.PLACE_PER_PROP) return `Max. ${K.PLACE_PER_PROP} pro Immobilie`;
      for (const q of this.near(cx, cy, Math.max(w, h) * TILE)) if (q.alive && !q.inCar && q.x > x * TILE - q.r && q.x < (x + w) * TILE + q.r && q.y > y * TILE - q.r && q.y < (y + h) * TILE + q.r) return q === a ? 'Du stehst im Weg' : 'Jemand steht im Weg';
      for (const c of this.cars) if (!c.dead && Math.abs(c.x - cx) < (w * TILE + c.l) / 2 && Math.abs(c.y - cy) < (h * TILE + c.l) / 2 && Math.hypot(c.x - cx, c.y - cy) < (Math.max(w, h) * TILE + c.l) / 2) return 'Auto im Weg';
      return '';
    },
    updatePlacing(inp, pr) {
      const pl = this.placing; if (!pl) return;
      if (!this.P.inv['pl_' + pl.id]) { this.cancelPlace(); return; }
      if (pr.reload || pr.r) this.rotatePlace(1);
      if (inp.wheel) this.rotatePlace(Math.sign(inp.wheel));
      const ax = isFinite(this.aimX) ? this.aimX : this.player.x, ay = isFinite(this.aimY) ? this.aimY : this.player.y;
      pl.x = Math.round(ax / TILE - pl.w / 2); pl.y = Math.round(ay / TILE - pl.h / 2);
      pl.why = this.placeCheck(pl.id, pl.x, pl.y, pl.w, pl.h); pl.ok = !pl.why;
      if (pr.aim) { this.cancelPlace(); return; }
      if (pr.fire) { if (pl.ok) this.confirmPlace(); else { this.notify(pl.why, 'bad'); this.emit('sfx', { s: 'error' }); } }
    },
    confirmPlace() {
      const pl = this.placing, d = K.PLACE[pl.id];
      if (!this.takeItem('pl_' + pl.id)) { this.cancelPlace(); return null; }
      const b = this.bldAt((pl.x + pl.w / 2) * TILE, (pl.y + pl.h / 2) * TILE), B = b >= 0 ? this.buildings[b] : null;
      this.P.placeSeq = (this.P.placeSeq || 0) + 1;
      const rec = { uid: this.P.placeSeq, id: pl.id, x: pl.x, y: pl.y, w: pl.w, h: pl.h, rot: pl.rot, c: (Math.random() * 6) | 0, prop: B ? B.property : null };
      if (d.store) rec.store = { items: {}, weapons: [], ammo: {} };
      if (d.lock) { rec.code = String(1000 + ((Math.random() * 9000) | 0)); rec.locked = true; }
      this.placedList().push(rec);
      this.spawnPlaced(rec);
      this.emit('sfx', { s: 'propPlace' });
      this.notify(`${d.name} platziert${d.lock ? ` · Code ${rec.code}` : ''}.`, 'good');
      if (!this.P.inv['pl_' + pl.id]) { this.placing = null; this.emit('placeMode', { on: false }); }
      return rec;
    },
    /** pick a placed prop back up into the inventory (owner only — and it has to be empty) */
    pickupPlaced(rec) {
      const d = K.PLACE[rec.id];
      if (rec.store && this.storeUsed(rec).slots > 0) { this.notify('Erst ausräumen.', 'bad'); return false; }
      if (rec.job) { this.notify('Die Station arbeitet noch.', 'bad'); return false; }
      this.despawnPlaced(rec);
      this.P.placed = this.placedList().filter((r) => r !== rec);
      this.addItem('pl_' + rec.id);
      this.emit('sfx', { s: 'grab' }); this.notify(`${d.name} eingepackt.`);
      return true;
    },
    placedNear(r = 1.4) {
      const a = this.player, tx = (a.x / TILE) | 0, ty = (a.y / TILE) | 0;
      let best = null, bd = r * TILE;
      for (let j = ty - 3; j <= ty + 3; j++) for (let i = tx - 3; i <= tx + 3; i++) {
        if (i < 0 || j < 0 || i >= this.W || j >= this.H) continue;
        const pi = this.pmap[j * this.W + i]; if (pi < 0) continue;
        const p = this.props[pi]; if (!p || !p.rec) continue;
        const cx = U.clamp(a.x, p.x * TILE, (p.x + p.w) * TILE), cy = U.clamp(a.y, p.y * TILE, (p.y + p.h) * TILE);
        const d = Math.hypot(cx - a.x, cy - a.y); if (d < bd) { bd = d; best = p; }
      }
      return best;
    },
    propsContext(add) {
      if (this.placing || this.player.inCar) return false;
      const p = this.placedNear(); if (!p) return false;
      const rec = p.rec, d = K.PLACE[rec.id];
      if (d.store) add('E', `${d.name} öffnen${rec.locked ? ' 🔒' : ''} (${this.storeUsed(rec).slots}/${d.store.slots})`, () => this.emit('ui', { open: 'container', uid: rec.uid }));
      else if (d.craft) add('E', `${d.name}${rec.job ? (this.time >= rec.job.end ? ' — fertig, abholen' : ` — ${Math.ceil(rec.job.end - this.time)} min`) : ''}`, () => this.emit('ui', { open: 'station', uid: rec.uid }));
      else if (d.k === 'bed') add('E', 'Schlafen & speichern', () => { if (this.wanted > 0) return this.notify('Nicht mit der Polizei auf den Fersen.', 'bad'); this.emit('ui', { open: 'sleep', prop: rec.prop || this.P.home }); });
      else if (d.k === 'jukebox') add('E', 'Jukebox: nächster Song', () => { this.emit('jukebox', {}); this.emit('sfx', { s: 'click' }); });
      add('T', `${d.name} abbauen`, () => this.pickupPlaced(rec), 0.8);
      return true;
    },

    // ============================================================ containers
    storeUsed(rec) {
      const S = rec.store; if (!S) return { slots: 0, kg: 0 };
      let slots = S.weapons.length, kg = 0;
      for (const x of S.weapons) kg += (W8[x.id].w || 0) * (x.n || 1);
      for (const k in S.items) if (S.items[k] > 0) { slots++; kg += (K.ITEMS[k].w || 0) * S.items[k]; }
      for (const k in S.ammo) if (S.ammo[k] > 0) { slots++; kg += S.ammo[k] * 0.012; }
      return { slots, kg };
    },
    /** move a whole stack / one weapon from you into the container (kind: 'w' index · 'i' item · 'a' calibre) */
    storePut(rec, kind, key) {
      const P = this.P, d = K.PLACE[rec.id], S = rec.store, cap = d.store, u = this.storeUsed(rec);
      if (cap.only === 'w' && kind !== 'w') { this.notify('Hier passen nur Waffen rein.', 'bad'); return false; }
      let kg = 0, newSlot = true;
      if (kind === 'w') { const x = P.weapons[key]; if (!x || key === 0) return false; kg = (W8[x.id].w || 0) * (x.n || 1); }
      else if (kind === 'i') { if (!P.inv[key]) return false; kg = (K.ITEMS[key].w || 0) * P.inv[key]; newSlot = !(S.items[key] > 0); }
      else { if (!(P.ammo[key] > 0)) return false; kg = P.ammo[key] * 0.012; newSlot = !(S.ammo[key] > 0); }
      if (newSlot && u.slots >= cap.slots) { this.notify(`Kein Fach mehr frei (${cap.slots}).`, 'bad'); return false; }
      if (u.kg + kg > cap.kg + 1e-6) { this.notify(`Zu schwer (max. ${cap.kg} kg).`, 'bad'); return false; }
      if (kind === 'w') { S.weapons.push(P.weapons[key]); this.removeWeaponAt(key); }
      else if (kind === 'i') { S.items[key] = (S.items[key] || 0) + P.inv[key]; delete P.inv[key]; }
      else { S.ammo[key] = (S.ammo[key] || 0) + P.ammo[key]; P.ammo[key] = 0; }
      this.emit('sfx', { s: 'grab' }); this.emit('propChanged', { x: rec.x, y: rec.y, w: rec.w, h: rec.h });
      return true;
    },
    storeTake(rec, kind, key) {
      const P = this.P, S = rec.store;
      if (kind === 'w') {
        const x = S.weapons[key]; if (!x) return false; const d = W8[x.id];
        if (P.weapons.length >= 16) { this.notify('Kein Platz mehr für Waffen (max. 15).', 'bad'); return false; }
        if (!d.stack && !d.consumable && P.weapons.some((q) => q.id === x.id)) { this.notify('Hast du schon dabei.', 'bad'); return false; }
        if (d.stack || d.consumable) this.addWeapon(x.id, { n: x.n }); else { P.weapons.push(x); if (this.hotbarAdd) this.hotbarAdd('w', x.id); }
        S.weapons.splice(key, 1);
      } else if (kind === 'i') { if (!S.items[key]) return false; this.addItem(key, S.items[key]); delete S.items[key]; }
      else { if (!S.ammo[key]) return false; P.ammo[key] = (P.ammo[key] || 0) + S.ammo[key]; delete S.ammo[key]; }
      this.emit('sfx', { s: 'grab' }); this.emit('propChanged', { x: rec.x, y: rec.y, w: rec.w, h: rec.h });
      return true;
    },
    setCode(rec, code) {
      if (!/^\d{4}$/.test(code)) { this.notify('Der Code braucht 4 Ziffern.', 'bad'); return false; }
      rec.code = code; this.emit('sfx', { s: 'unlock' }); this.notify(`Neuer Code: ${code}`, 'good'); return true;
    },

    // ============================================================ crafting stations
    recipesOf(rec) { return K.RECIPES[K.PLACE[rec.id].craft] || []; },
    canCraft(rid) {
      for (const k in rid.in) if ((this.P.inv[k] || 0) < rid.in[k]) return false;
      return true;
    },
    startCraft(rec, rid) {
      const r = this.recipesOf(rec).find((q) => q.id === rid);
      if (!r || rec.job) return false;
      if (!this.canCraft(r)) { this.notify('Zutaten fehlen.', 'bad'); return false; }
      for (const k in r.in) this.takeItem(k, r.in[k]);
      rec.job = { rid, start: this.time, end: this.time + r.min * (1 - this.sk('survival') * 0.04) };
      this.emit('sfx', { s: K.PLACE[rec.id].craft === 'bench' ? 'wrench' : 'pour' });
      this.notify(`${r.name}: läuft (${r.min} min).`, 'good');
      return true;
    },
    collectCraft(rec) {
      const j = rec.job; if (!j || this.time < j.end) return false;
      const r = this.recipesOf(rec).find((q) => q.id === j.rid);
      rec.job = null;
      if (!r) return false;
      const got = [];
      for (const k in r.out) {
        if (k.startsWith('a:')) { const c = k.slice(2); this.P.ammo[c] = (this.P.ammo[c] || 0) + r.out[k]; } else this.addItem(k, r.out[k]);
        got.push(`${r.out[k]}× ${keyName(k)}`);
      }
      this.emit('sfx', { s: 'harvest' }); this.notify(`Fertig: ${got.join(', ')}`, 'loot'); this.addXP(10, 'Produktion');
      return true;
    },

    // ============================================================ ticking: stations, smell, explosions, burglars
    updateProps(dt) {
      if (this.placing && (this.player.inCar || !this.player.alive)) this.cancelPlace();
      this.propT = (this.propT || 0) - dt;
      if (this.propT > 0) return;
      this.propT = 1;
      const P = this.P, list = this.placedList();
      for (const rec of list.slice()) {
        const j = rec.job; if (!j) continue;
        const r = this.recipesOf(rec).find((q) => q.id === j.rid); if (!r) { rec.job = null; continue; }
        const done = this.time >= j.end;
        // the smell of a cooking lab makes neighbours call the police (once per batch)
        if (r.smell && !j.smelt && !done && this.time - j.start > r.min * 0.4) {
          j.smelt = true;
          if (Math.random() < 0.12 * r.smell) {
            const x = (rec.x + rec.w / 2) * TILE, y = (rec.y + rec.h / 2) * TILE;
            if (this.policeInvestigate) this.policeInvestigate(x, y);
            this.notify('Nachbarn beschweren sich über den Gestank. Eine Streife kommt vorbei.', 'bad');
          }
        }
        if (done && !j.told) {
          j.told = true;
          if (r.risk && Math.random() < r.risk * (1 - this.sk('survival') * 0.1)) { this.labBlast(rec); continue; }
          const d = K.PLACE[rec.id]; this.notify(`${d.name}: ${r.name} ist fertig.`, 'good');
        }
      }
      // night burglars, once a day at 03:00
      const night = Math.floor((this.time - 3 * 60) / 1440);
      if (P.burgleDay == null) P.burgleDay = night;
      if (night > P.burgleDay) { P.burgleDay = night; this.burglary(); }
    },
    labBlast(rec) {
      const d = K.PLACE[rec.id];
      const x = (rec.x + rec.w / 2) * TILE, y = (rec.y + rec.h / 2) * TILE;
      rec.job = null;
      this.despawnPlaced(rec);
      this.P.placed = this.placedList().filter((r) => r !== rec);
      this.explode(x, y, 110, 140, null);
      this.notify(`${d.name} ist in die Luft geflogen!`, 'bad');
      this.emit('banner', { title: 'LABOR EXPLODIERT', sub: 'Die Ware ist weg. Und die Station auch.', kind: 'red' });
    },
    /** burglars try your properties — and anything left unlocked on the street */
    burglary() {
      const P = this.P, out = [];
      const byProp = new Map();
      for (const rec of this.placedList()) { const k = rec.prop || '__street'; if (!byProp.has(k)) byProp.set(k, []); byProp.get(k).push(rec); }
      for (const [k, recs] of byProp) {
        const loot = recs.filter((r) => r.store && this.storeUsed(r).slots > 0);
        if (!loot.length) continue;
        const street = k === '__street';
        if (!street && recs.some((r) => r.id === 'alarm')) { if (Math.random() < 0.05) out.push(`Alarm in ${this.propertyDef(k).name} — Einbrecher geflohen.`); continue; }
        if (Math.random() > (street ? 0.35 : 0.1)) continue;
        const stolen = [];
        for (const r of loot) {
          const lock = r.locked ? K.PLACE[r.id].lock : 0;
          if (lock >= 3 || (lock === 2 && Math.random() > 0.15) || (lock === 1 && Math.random() > 0.5)) continue;
          const S = r.store, keys = [...S.weapons.map((_, i) => ['w', i]), ...Object.keys(S.items).map((i) => ['i', i]), ...Object.keys(S.ammo).filter((a) => S.ammo[a] > 0).map((a) => ['a', a])];
          for (let n = 0; n < 2 && keys.length; n++) {
            const [t, key] = keys.splice((Math.random() * keys.length) | 0, 1)[0];
            if (t === 'w') { const x = S.weapons[key]; if (!x) continue; stolen.push(W8[x.id].name); S.weapons[key] = null; }
            else if (t === 'i') { stolen.push(`${K.ITEMS[key].name} ×${S.items[key]}`); delete S.items[key]; }
            else { stolen.push(`${K.AMMO[key].name} ×${S.ammo[key]}`); delete S.ammo[key]; }
          }
          S.weapons = S.weapons.filter(Boolean);
        }
        if (stolen.length) out.push(`Einbruch ${street ? 'bei deinen Sachen auf der Straße' : 'in ' + this.propertyDef(k).name}! Weg: ${stolen.join(', ')}.`);
      }
      for (const m of out) this.notify(m, 'bad');
      if (out.length) this.emit('sfx', { s: 'phone' });
      return out;
    },
  });
})(globalThis.K = globalThis.K || {});
