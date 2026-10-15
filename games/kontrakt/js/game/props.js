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
    cone:      { name: 'Traffic Cone', e: '🔺', cat: 'street', price: 25, kg: 1, k: 'cone', where: 'any', desc: 'Blocks off a lane. Cars knock it over.' },
    barrier:   { name: 'Crowd Barrier', e: '🚧', cat: 'street', price: 90, kg: 5, w: 2, k: 'barrier', where: 'any', desc: 'Stops people on foot. Not a car with a run-up.' },
    warnsign:  { name: 'Warning Sign', e: '⚠️', cat: 'street', price: 40, kg: 2, k: 'warnsign', where: 'any' },
    spot:      { name: 'Floodlight', e: '💡', cat: 'street', price: 160, kg: 4, k: 'spot', where: 'any', light: { r: 250, c: [255, 240, 210], i: 1, kind: 'lamp' }, desc: 'Turns night into day.' },
    foldtable: { name: 'Folding Table', e: '🟫', cat: 'street', price: 60, kg: 5, w: 2, k: 'foldtable', where: 'any' },
    foldchair: { name: 'Folding Chair', e: '🪑', cat: 'street', price: 25, kg: 2, k: 'foldchair', where: 'any' },
    tent:      { name: 'Gazebo', e: '⛺', cat: 'street', price: 240, kg: 8, w: 2, h: 2, k: 'tent', where: 'any', desc: 'Shade at the beach, a screen for shady business.' },
    // home — Einrichtungs-App
    sofa:      { name: 'Leather Sofa', e: '🛋️', cat: 'home', price: 900, kg: 9, w: 2, k: 'sofa', where: 'own' },
    armchair:  { name: 'Club Chair', e: '💺', cat: 'home', price: 380, kg: 5, k: 'armchair', where: 'own' },
    ctable:    { name: 'Coffee Table', e: '🟤', cat: 'home', price: 220, kg: 4, k: 'table', where: 'own' },
    houseplant:{ name: 'Monstera', e: '🪴', cat: 'home', price: 60, kg: 3, k: 'plant', where: 'own' },
    floorlamp: { name: 'Floor Lamp', e: '🛋', cat: 'home', price: 140, kg: 3, k: 'floorlamp', where: 'own', light: { r: 130, c: [255, 190, 130], i: 0.5, kind: 'room' } },
    tv:        { name: 'OLED TV 77"', e: '📺', cat: 'home', price: 1400, kg: 6, k: 'tv', where: 'own' },
    rug:       { name: 'Persian Rug', e: '🟥', cat: 'home', price: 300, kg: 4, w: 2, h: 2, k: 'rug', where: 'own' },
    bed:       { name: 'Box-Spring Bed', e: '🛏️', cat: 'home', price: 1100, kg: 12, w: 2, h: 2, k: 'bed', where: 'own', desc: 'Sleep & save.' },
    jukebox:   { name: 'Jukebox', e: '🎶', cat: 'home', price: 2200, kg: 10, k: 'jukebox', where: 'own', desc: 'Neon, vinyl and a button that changes the song.' },
    pooltable: { name: 'Pool Table', e: '🎱', cat: 'home', price: 3200, kg: 14, w: 2, k: 'pooltable', where: 'own' },
    alarm:     { name: 'Alarm System', e: '🚨', cat: 'home', price: 1500, kg: 1, k: 'alarm', where: 'own', desc: 'Protects the whole property from burglars.' },
    // storage
    crate:     { name: 'Wooden Crate', e: '📦', cat: 'store', price: 120, kg: 6, k: 'crate', where: 'any', store: { slots: 6, kg: 40 }, desc: 'Unlocked. Left outside, it gets looted fast.' },
    case:      { name: 'Aluminum Case', e: '🧳', cat: 'store', price: 350, kg: 3, k: 'case', where: 'any', store: { slots: 5, kg: 20 }, lock: 1 },
    shelf:     { name: 'Storage Shelf', e: '🗄️', cat: 'store', price: 280, kg: 8, w: 2, k: 'shelf', where: 'own', store: { slots: 10, kg: 80 } },
    safe:      { name: 'Safe', e: '🔐', cat: 'store', price: 2500, kg: 14, k: 'safe', where: 'own', store: { slots: 10, kg: 50 }, lock: 2 },
    bigsafe:   { name: 'Gun Safe XL', e: '🏦', cat: 'store', price: 7500, kg: 22, w: 2, k: 'bigsafe', where: 'own', store: { slots: 20, kg: 200 }, lock: 3, desc: 'No burglar cracks this one.' },
    gunrack:   { name: 'Gun Rack', e: '🔫', cat: 'store', price: 900, kg: 7, k: 'gunrack', where: 'own', store: { slots: 6, kg: 80, only: 'w' }, desc: 'Weapons only. Visible from outside.' },
    // stations — Schwarzmarkt
    weedtable: { name: 'Packing Table', e: '🌿', cat: 'craft', price: 1200, kg: 8, w: 2, k: 'weedtable', where: 'own', craft: 'pack', black: true },
    methlab:   { name: 'Chem Lab', e: '⚗️', cat: 'craft', price: 6500, kg: 12, w: 2, k: 'methlab', where: 'own', craft: 'meth', black: true, desc: 'Stinks. Can blow up.' },
    cokelab:   { name: 'Coke Station', e: '❄️', cat: 'craft', price: 9000, kg: 10, w: 2, k: 'cokelab', where: 'own', craft: 'coke', black: true },
    gunbench:  { name: 'Gun Workbench', e: '🛠️', cat: 'craft', price: 4800, kg: 14, w: 2, k: 'gunbench', where: 'own', craft: 'bench', black: true },
  };
  K.i18nData(K.PLACE);
  K.PLACE_CATS = K.i18nStrings({ street: 'Street & Site', home: 'Furniture', store: 'Storage & Safes', craft: 'Stations' });
  K.PLACE_MAX = 60; K.PLACE_PER_PROP = 30;
  for (const id in K.PLACE) {
    const d = K.PLACE[id]; d.id = id; d.w = d.w || 1; d.h = d.h || 1;
    K.ITEMS['pl_' + id] = K.i18nData({ id: 'pl_' + id, name: d.name, e: d.e, price: d.price, w: d.kg, place: id, desc: (d.desc ? d.desc + ' ' : '') + 'Use: place.' });
  }

  // ingredients & products of the stations
  Object.assign(K.ITEMS, K.i18nData({
    chem:      { id: 'chem', name: 'Chemical Canister', e: '🧪', price: 260, w: 2, desc: 'For the chem lab.' },
    cocapaste: { id: 'cocapaste', name: 'Coca Paste', e: '🟫', price: 1100, w: 1, hot: true, desc: 'For the coke station.' },
    cutting:   { id: 'cutting', name: 'Cutting Agent', e: '🥛', price: 35, w: 0.2, desc: 'Mannitol. Officially a laxative.' },
    parts:     { id: 'parts', name: 'Gun Parts', e: '⚙️', price: 150, w: 1, desc: 'For the workbench: ammo, suppressors, lockpicks.' },
    weedbrick: { id: 'weedbrick', name: 'Weed Brick (25 g)', e: '🧱', price: 0, sell: 480, w: 0.03, drug: true, sellOnly: true, desc: 'Vacuum-sealed. The black market pays well.' },
    meth:      { id: 'meth', name: 'Crystal', e: '🔹', price: 0, sell: 30, street: 55, w: 0.002, drug: true, energy: 40, hp: -6, desc: 'Sell it on the street [T on passers-by].' },
    coke:      { id: 'coke', name: 'Coke', e: '❄️', price: 0, sell: 62, street: 110, w: 0.002, drug: true, energy: 30, desc: 'Sell it on the street [T on passers-by].' },
  }));

  K.SHOPS.black.items.push('pl_weedtable', 'pl_methlab', 'pl_cokelab', 'pl_gunbench', 'chem', 'cocapaste', 'parts');
  K.SHOPS.mech.items.push('pl_cone', 'pl_barrier', 'pl_warnsign', 'pl_spot', 'pl_foldtable', 'pl_foldchair', 'pl_tent', 'pl_crate', 'pl_case');
  K.SHOPS.pharmacy.items.push('cutting');

  K.RECIPES = {
    pack: [{ id: 'brick', name: 'Press a weed brick', in: { bud: 25 }, out: { weedbrick: 1 }, min: 20 }],
    meth: [{ id: 'meth', name: 'Cook crystal (8)', in: { chem: 1 }, out: { meth: 8 }, min: 60, risk: 0.05, smell: 1 }],
    coke: [{ id: 'coke', name: 'Cut & press (14)', in: { cocapaste: 1, cutting: 2 }, out: { coke: 14 }, min: 90, smell: 0.5 }],
    bench: [
      { id: 'a9', name: '9mm × 30', in: { parts: 1 }, out: { 'a:9mm': 30 }, min: 10 },
      { id: 'a556', name: '5.56 × 30', in: { parts: 2 }, out: { 'a:556': 30 }, min: 15 },
      { id: 'a762', name: '7.62 × 30', in: { parts: 2 }, out: { 'a:762': 30 }, min: 15 },
      { id: 'a308', name: '.308 × 10', in: { parts: 2 }, out: { 'a:308': 10 }, min: 15 },
      { id: 'a50', name: '.50 BMG × 5', in: { parts: 4 }, out: { 'a:50': 5 }, min: 30 },
      { id: 'sil', name: 'Suppressor', in: { parts: 3 }, out: { silencer: 1 }, min: 25 },
      { id: 'pick', name: 'Lockpicks × 3', in: { parts: 1 }, out: { lockpick: 3 }, min: 8 },
    ],
  };
  K.i18nData(K.RECIPES);

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
      if (this.player.inCar) { this.notify(K.tr('Get out of the car first.'), 'bad'); return false; }
      if (this.placedList().length >= K.PLACE_MAX) { this.notify(K.tr('Limit reached ({n} props).', { n: K.PLACE_MAX }), 'bad'); return false; }
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
      if (Math.hypot(cx - a.x, cy - a.y) > 5 * TILE) return K.tr('Too far away');
      let bld = null;
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
        if (i < 1 || j < 1 || i >= W - 1 || j >= this.H - 1) return K.tr('Out of bounds');
        const ii = j * W + i, t = this.tiles[ii];
        if (t === T.WATER || t === T.POOL) return K.tr('Water');
        if (TF[t] & 1 || t === T.DOOR || t === T.WINDOW || t === T.GATE) return K.tr('Wall or door in the way');
        if (this.pmap[ii] >= 0 || this.solid[ii]) return K.tr('Spot taken');
        const b = this.bmap[ii];
        if (bld === null) bld = b; else if (bld !== b) return K.tr('Half inside, half outside');
        // keep door approaches free
        if (K.PROPK[d.k].s & 1) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.tiles[ii + di + dj * W] === T.DOOR) return K.tr('Blocks a door');
      }
      const B = bld >= 0 ? this.buildings[bld] : null;
      if (d.where === 'own' && !(B && B.owned)) return K.tr('Only inside your property');
      if (B && !B.owned) return K.tr("Not in other people's buildings");
      if (B && this.placedList().filter((r) => r.prop === B.property).length >= K.PLACE_PER_PROP) return K.tr('Max. {n} per property', { n: K.PLACE_PER_PROP });
      for (const q of this.near(cx, cy, Math.max(w, h) * TILE)) if (q.alive && !q.inCar && q.x > x * TILE - q.r && q.x < (x + w) * TILE + q.r && q.y > y * TILE - q.r && q.y < (y + h) * TILE + q.r) return q === a ? K.tr("You're in the way") : K.tr('Someone is in the way');
      for (const c of this.cars) if (!c.dead && Math.abs(c.x - cx) < (w * TILE + c.l) / 2 && Math.abs(c.y - cy) < (h * TILE + c.l) / 2 && Math.hypot(c.x - cx, c.y - cy) < (Math.max(w, h) * TILE + c.l) / 2) return K.tr('Car in the way');
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
      this.notify(d.lock ? K.tr('{name} placed · Code {code}.', { name: d.name, code: rec.code }) : K.tr('{name} placed.', { name: d.name }), 'good');
      if (!this.P.inv['pl_' + pl.id]) { this.placing = null; this.emit('placeMode', { on: false }); }
      return rec;
    },
    /** pick a placed prop back up into the inventory (owner only — and it has to be empty) */
    pickupPlaced(rec) {
      const d = K.PLACE[rec.id];
      if (rec.store && this.storeUsed(rec).slots > 0) { this.notify(K.tr('Empty it first.'), 'bad'); return false; }
      if (rec.job) { this.notify(K.tr('The station is still working.'), 'bad'); return false; }
      this.despawnPlaced(rec);
      this.P.placed = this.placedList().filter((r) => r !== rec);
      this.addItem('pl_' + rec.id);
      this.emit('sfx', { s: 'grab' }); this.notify(K.tr('{name} packed up.', { name: d.name }));
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
      if (d.store) add('E', K.tr('Open {name}{lock} ({used}/{slots})', { name: d.name, lock: rec.locked ? ' 🔒' : '', used: this.storeUsed(rec).slots, slots: d.store.slots }), () => this.emit('ui', { open: 'container', uid: rec.uid }));
      else if (d.craft) add('E', `${d.name}${rec.job ? ` — ${this.time >= rec.job.end ? K.tr('done, collect') : `${Math.ceil(rec.job.end - this.time)} min`}` : ''}`, () => this.emit('ui', { open: 'station', uid: rec.uid }));
      else if (d.k === 'bed') add('E', K.tr('Sleep & save'), () => { if (this.wanted > 0) return this.notify(K.tr('Not with the cops on your tail.'), 'bad'); this.emit('ui', { open: 'sleep', prop: rec.prop || this.P.home }); });
      else if (d.k === 'jukebox') add('E', K.tr('Jukebox: next song'), () => { this.emit('jukebox', {}); this.emit('sfx', { s: 'click' }); });
      add('T', K.tr('Pack up {name}', { name: d.name }), () => this.pickupPlaced(rec), 0.8);
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
      if (cap.only === 'w' && kind !== 'w') { this.notify(K.tr('Only weapons fit in here.'), 'bad'); return false; }
      let kg = 0, newSlot = true;
      if (kind === 'w') { const x = P.weapons[key]; if (!x || key === 0) return false; kg = (W8[x.id].w || 0) * (x.n || 1); }
      else if (kind === 'i') { if (!P.inv[key]) return false; kg = (K.ITEMS[key].w || 0) * P.inv[key]; newSlot = !(S.items[key] > 0); }
      else { if (!(P.ammo[key] > 0)) return false; kg = P.ammo[key] * 0.012; newSlot = !(S.ammo[key] > 0); }
      if (newSlot && u.slots >= cap.slots) { this.notify(K.tr('No free slot left ({slots}).', { slots: cap.slots }), 'bad'); return false; }
      if (u.kg + kg > cap.kg + 1e-6) { this.notify(K.tr('Too heavy (max. {kg} kg).', { kg: cap.kg }), 'bad'); return false; }
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
        if (P.weapons.length >= 16) { this.notify(K.tr('No room for more weapons (max. 15).'), 'bad'); return false; }
        if (!d.stack && !d.consumable && P.weapons.some((q) => q.id === x.id)) { this.notify(K.tr('You already carry one.'), 'bad'); return false; }
        if (d.stack || d.consumable) this.addWeapon(x.id, { n: x.n }); else { P.weapons.push(x); if (this.hotbarAdd) this.hotbarAdd('w', x.id); }
        S.weapons.splice(key, 1);
      } else if (kind === 'i') { if (!S.items[key]) return false; this.addItem(key, S.items[key]); delete S.items[key]; }
      else { if (!S.ammo[key]) return false; P.ammo[key] = (P.ammo[key] || 0) + S.ammo[key]; delete S.ammo[key]; }
      this.emit('sfx', { s: 'grab' }); this.emit('propChanged', { x: rec.x, y: rec.y, w: rec.w, h: rec.h });
      return true;
    },
    setCode(rec, code) {
      if (!/^\d{4}$/.test(code)) { this.notify(K.tr('The code needs 4 digits.'), 'bad'); return false; }
      rec.code = code; this.emit('sfx', { s: 'unlock' }); this.notify(K.tr('New code: {code}', { code }), 'good'); return true;
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
      if (!this.canCraft(r)) { this.notify(K.tr('Missing ingredients.'), 'bad'); return false; }
      for (const k in r.in) this.takeItem(k, r.in[k]);
      rec.job = { rid, start: this.time, end: this.time + r.min * (1 - this.sk('survival') * 0.04) };
      this.emit('sfx', { s: K.PLACE[rec.id].craft === 'bench' ? 'wrench' : 'pour' });
      this.notify(K.tr('{name}: running ({min} min).', { name: r.name, min: r.min }), 'good');
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
      this.emit('sfx', { s: 'harvest' }); this.notify(K.tr('Done: {items}', { items: got.join(', ') }), 'loot'); this.addXP(10, K.tr('Production'));
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
            this.notify(K.tr('The neighbors are complaining about the stink. A patrol is coming by.'), 'bad');
          }
        }
        if (done && !j.told) {
          j.told = true;
          if (r.risk && Math.random() < r.risk * (1 - this.sk('survival') * 0.1)) { this.labBlast(rec); continue; }
          const d = K.PLACE[rec.id]; this.notify(K.tr('{station}: {recipe} is done.', { station: d.name, recipe: r.name }), 'good');
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
      this.notify(K.tr('{name} blew up!', { name: d.name }), 'bad');
      this.emit('banner', { title: K.tr('LAB EXPLODED'), sub: K.tr('The product is gone. So is the station.'), kind: 'red' });
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
        if (!street && recs.some((r) => r.id === 'alarm')) { if (Math.random() < 0.05) out.push(K.tr('Alarm at {place} — the burglars fled.', { place: this.propertyDef(k).name })); continue; }
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
        if (stolen.length) out.push(street ? K.tr('Break-in at your stuff on the street! Gone: {list}.', { list: stolen.join(', ') }) : K.tr('Break-in at {place}! Gone: {list}.', { place: this.propertyDef(k).name, list: stolen.join(', ') }));
      }
      for (const m of out) this.notify(m, 'bad');
      if (out.length) this.emit('sfx', { s: 'phone' });
      return out;
    },
  });
})(globalThis.K = globalThis.K || {});
