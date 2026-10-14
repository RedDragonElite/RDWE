/* RDE // KONTRAKT — procedural city: districts, roads, buildings with interiors, furniture, lights, zones */
(function (K) {
  'use strict';
  const T = K.T, TILE = K.TILE;
  const NB = 7, P = 26, R = 4;
  const W = NB * P + R, H = W + 14;

  const DMAP = [
    'OOODHHH',
    'OOODDHH',
    'OPDDDDH',
    'RRDPDDI',
    'RRRDDII',
    'RPRRIII',
    'KKKKKKK',
  ];
  const DCODE = { O: 'old', D: 'down', H: 'hill', P: 'park', R: 'res', I: 'ind', K: 'docks' };
  K.DISTRICTS = { old: 'Altstadt', down: 'Mitte', hill: 'Sonnenhang', park: 'Stadtpark', res: 'Kanalviertel', ind: 'Industriegebiet', docks: 'Hafen', road: 'Straße', sea: 'Hafenbecken' };

  // explicit block plans; others fall back to the district default
  const PLAN = {
    '0,0': ['house', 'grow', 'house', 'house'], '1,0': ['bar', 'house', 'house', 'food'], '2,0': ['diner', 'house', 'flat', 'house'],
    '3,0': ['cloth', 'flat', 'food', 'flat'], '0,1': ['house', 'house', 'house', 'house'], '1,1': ['house', 'flat', 'house', 'house'],
    '2,1': ['flat', 'jeweler', 'pharmacy', 'house'], '3,1': ['office'], '4,1': ['police'], '2,2': ['gun', 'flat', 'flat', 'food'], '0,2': ['gas'],
    '3,2': ['hotel'], '4,2': ['office'], '5,2': ['club'], '2,3': ['bank'], '4,3': ['flat', 'diner', 'flat', 'flat'],
    '5,3': ['office', 'flat'], '3,4': ['hospital'], '4,4': ['autohaus'], '6,3': ['warehouse', 'warehouse'],
    '5,4': ['werkstatt'], '6,4': ['warehouse', 'warehouse'], '4,5': ['gas'], '5,5': ['warehouse', 'warehouse'], '6,5': ['warehouse', 'warehouse'],
    '4,6': ['black'],
  };

  // prop kinds: s = blocks: 1 move · 2 bullets · 4 sight · hide = body container · inter = interaction
  const PK = K.PROPK = {
    bed: { s: 1 }, sofa: { s: 1 }, table: { s: 1 }, chair: { s: 0 }, desk: { s: 1 }, shelf: { s: 3 }, fridge: { s: 3 }, stove: { s: 1 }, sink: { s: 1 },
    toilet: { s: 1 }, plant: { s: 1 }, wardrobe: { s: 3, hide: 1, inter: 'wardrobe' }, safe: { s: 3, inter: 'safe' }, counter: { s: 1 }, rack: { s: 3 },
    barc: { s: 1 }, stool: { s: 0 }, pooltable: { s: 1 }, tv: { s: 1 }, rug: { s: 0, low: 1 }, crate: { s: 3 }, container: { s: 7 }, dumpster: { s: 3, hide: 1, inter: 'hide' },
    bench: { s: 1 }, tree: { s: 1, tall: 1 }, bush: { s: 0, bush: 1, tall: 1 }, lamp: { s: 1, tall: 1 }, vending: { s: 3, inter: 'vending' }, trash: { s: 1 },
    fountain: { s: 1 }, piano: { s: 1 }, hbed: { s: 1 }, locker: { s: 3, hide: 1, inter: 'hide' }, sign: { s: 0, inter: 'buy' }, dj: { s: 1 }, dance: { s: 0, low: 1 },
    boat: { s: 0 }, hydrant: { s: 1 }, umbrella: { s: 1, tall: 1 }, cell: { s: 1 }, bollard: { s: 1 }, crane: { s: 0, tall: 1 }, desk2: { s: 1 }, atm: { s: 3, inter: 'atm' },
    pump: { s: 1, inter: 'pump' }, gassign: { s: 1, tall: 1 }, lift: { s: 0, low: 1 }, toolbox: { s: 1 }, tires: { s: 1 }, flag: { s: 1, tall: 1 }, cone: { s: 0 },
    deposit: { s: 3, inter: 'deposit' }, showcase: { s: 1, inter: 'showcase' }, cart: { s: 1 },
  };

  K.generateCity = function (seed) {
    const rng = new K.RNG(seed);
    const N = W * H;
    const tiles = new Uint8Array(N).fill(T.ROAD);
    const solid = new Uint8Array(N);   // prop blocking bits
    const bmap = new Int16Array(N).fill(-1);
    const zmap = new Int16Array(N).fill(-1);
    const clear = new Uint8Array(N);   // keep free of props (door approaches)
    const pmap = new Int32Array(N).fill(-1); // prop index per tile
    const doors = new Map();
    const buildings = [], props = [], lights = [], zones = [], canopies = [], carSpots = [], bays = [], pumps = [];
    const idx = (x, y) => y * W + x;
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const set = (x, y, t) => { if (inb(x, y)) tiles[idx(x, y)] = t; };
    const fill = (x, y, w, h, t) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, t); };
    const get = (x, y) => (inb(x, y) ? tiles[idx(x, y)] : T.WATER);

    // ---------------------------------------------------------- seafront
    fill(0, W, W, 2, T.QUAY);
    fill(0, W + 2, W, H - W - 2, T.WATER);

    function addProp(k, x, y, w = 1, h = 1, o = {}) {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
        if (!inb(i, j)) return null;
        const t = get(i, j), ii = idx(i, j);
        if (pmap[ii] >= 0 || (K.TF[t] & 1 && t !== T.WATER) || t === T.DOOR || (clear[ii] && !o.force)) return null;
        if (t === T.WATER && k !== 'boat') return null;
      }
      const p = { id: props.length, k, x, y, w, h, face: o.face || 0, c: o.c != null ? o.c : rng.int(6), bld: o.bld != null ? o.bld : -1, ...o.extra };
      const d = PK[k];
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { solid[idx(i, j)] |= d.s; pmap[idx(i, j)] = p.id; }
      props.push(p);
      return p;
    }
    function removeProp(p) {
      for (let j = p.y; j < p.y + p.h; j++) for (let i = p.x; i < p.x + p.w; i++) { solid[idx(i, j)] = 0; pmap[idx(i, j)] = -1; }
      props[p.id] = null;
    }
    function lamp(x, y, c = [255, 196, 130], r = 235) {
      const p = addProp('lamp', x, y);
      if (p) lights.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, r, c, i: 0.95, kind: 'lamp', flick: rng.chance(0.06) });
      return p;
    }

    // ---------------------------------------------------------- buildings
    function makeBuilding(x, y, w, h, type, sides, opt = {}) {
      const bt = K.BTYPES[type];
      const id = buildings.length;
      const b = {
        id, type, x, y, w, h, name: opt.name || bt.name, floor: T[bt.floor], roof: bt.roof, color: rng.pick(bt.colors), doors: [], rooms: [], pois: [],
        shop: bt.shop || null, restricted: opt.restricted !== undefined ? opt.restricted : bt.restricted || null, property: null, owned: false, district: opt.district,
        lit: rng.chance(0.7), loot: 0, seed: rng.int(1e9),
      };
      buildings.push(b);
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
        const edge = i === x || j === y || i === x + w - 1 || j === y + h - 1;
        set(i, j, edge ? T.WALL : b.floor); bmap[idx(i, j)] = id;
      }
      // windows
      const winEvery = type === 'warehouse' || type === 'black' ? 5 : 3;
      for (let i = x + 1; i < x + w - 1; i++) { if ((i - x) % winEvery === 1) { set(i, y, T.WINDOW); set(i, y + h - 1, T.WINDOW); } }
      for (let j = y + 1; j < y + h - 1; j++) { if ((j - y) % winEvery === 1) { set(x, j, T.WINDOW); set(x + w - 1, j, T.WINDOW); } }
      // doors
      sides.forEach((s, k) => {
        let dx, dy, ox, oy;
        if (s === 'S') { dx = x + (w >> 1); dy = y + h - 1; ox = 0; oy = 1; } else if (s === 'N') { dx = x + (w >> 1); dy = y; ox = 0; oy = -1; }
        else if (s === 'E') { dx = x + w - 1; dy = y + (h >> 1); ox = 1; oy = 0; } else { dx = x; dy = y + (h >> 1); ox = -1; oy = 0; }
        if (k > 0 && (s === 'N' || s === 'S')) dx = x + 2 + rng.int(Math.max(1, w - 4));
        set(dx, dy, T.DOOR);
        // windows next to doors look odd → plain wall
        for (const [a, c] of ox ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]]) if (get(dx + a, dy + c) === T.WINDOW) set(dx + a, dy + c, T.WALL);
        const d = { i: idx(dx, dy), x: dx, y: dy, bld: id, outer: true, main: k === 0, horiz: !ox, ox, oy, locked: false, access: null, open: 0 };
        doors.set(d.i, d); b.doors.push(d);
        for (let a = -1; a <= 1; a++) for (let c = 0; c <= 2; c++) {
          const cx = dx + (ox ? ox * c : a), cy = dy + (oy ? oy * c : a);
          if (inb(cx, cy)) clear[idx(cx, cy)] = 1;
          const ix = dx - (ox ? ox * c : -a), iy = dy - (oy ? oy * c : -a);
          if (inb(ix, iy) && c <= 1) clear[idx(ix, iy)] = 1;
        }
      });
      b.entrance = { x: b.doors[0].x + b.doors[0].ox, y: b.doors[0].y + b.doors[0].oy };
      // rooms
      const leaves = [];
      const mainDoor = b.doors[0];
      const split = (rx, ry, rw, rh, depth) => {
        const big = Math.max(rw, rh);
        if (depth <= 0 || big < 5 || (rw < 5 && rh < 5)) { leaves.push({ x: rx, y: ry, w: rw, h: rh }); return; }
        const vert = rw >= rh;
        const len = vert ? rw : rh, minR = len >= 8 ? 3 : 2;
        const okAt = (at) => {
          const lx = vert ? rx + at : rx, ly = vert ? ry : ry + at;
          if (vert ? get(lx, ry - 1) === T.DOOR || get(lx, ry + rh) === T.DOOR : get(rx - 1, ly) === T.DOOR || get(rx + rw, ly) === T.DOOR) return false;
          for (const d of b.doors) {
            const ix = d.x - d.ox, iy = d.y - d.oy;
            if (vert && ix === lx && iy >= ry && iy < ry + rh) return false;
            if (!vert && iy === ly && ix >= rx && ix < rx + rw) return false;
          }
          return true;
        };
        const cands = [];
        if (opt.frontDeep && !vert) cands.push(mainDoor.oy > 0 ? Math.max(3, rh - Math.ceil(rh * 0.55) - 1) : Math.ceil(rh * 0.5));
        for (const c of rng.shuffle(Array.from({ length: Math.max(0, len - 2 * minR) }, (_, k) => k + minR))) cands.push(c);
        const at = cands.find(okAt);
        if (at === undefined) { leaves.push({ x: rx, y: ry, w: rw, h: rh }); return; }
        const lx = vert ? rx + at : rx, ly = vert ? ry : ry + at;
        const span = vert ? rh : rw;
        for (let k = 0; k < span; k++) set(vert ? lx : rx + k, vert ? ry + k : ly, T.WALL);
        const dk = 1 + rng.int(Math.max(1, span - 2));
        const ddx = vert ? lx : rx + dk, ddy = vert ? ry + dk : ly;
        set(ddx, ddy, T.DOOR);
        const d = { i: idx(ddx, ddy), x: ddx, y: ddy, bld: id, outer: false, horiz: !vert, ox: vert ? 1 : 0, oy: vert ? 0 : 1, locked: false, access: null, open: 0 };
        doors.set(d.i, d); b.doors.push(d);
        for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inb(ddx + a, ddy + c)) clear[idx(ddx + a, ddy + c)] = 1;
        if (vert) { split(rx, ry, at, rh, depth - 1); split(lx + 1, ry, rw - at - 1, rh, depth - 1); }
        else { split(rx, ry, rw, at, depth - 1); split(rx, ly + 1, rw, rh - at - 1, depth - 1); }
      };
      split(x + 1, y + 1, w - 2, h - 2, opt.depth != null ? opt.depth : w * h > 120 ? 2 : 1);
      const md = b.doors[0], mix = md.x - md.ox, miy = md.y - md.oy;
      for (const r of leaves) {
        r.front = mix >= r.x && mix < r.x + r.w && miy >= r.y && miy < r.y + r.h;
        b.rooms.push(r);
      }
      b.rooms.sort((a, c) => (c.front ? 1 : 0) - (a.front ? 1 : 0));
      return b;
    }

    function reachableOK(b) {
      // every free floor tile of the building must be reachable from the main door
      const start = idx(b.doors[0].x - b.doors[0].ox, b.doors[0].y - b.doors[0].oy);
      const seen = new Set([start]), q = [start];
      let free = 0;
      for (let j = b.y + 1; j < b.y + b.h - 1; j++) for (let i = b.x + 1; i < b.x + b.w - 1; i++) {
        const t = idx(i, j); if ((K.TF[tiles[t]] & 8) && !(solid[t] & 1)) free++;
      }
      while (q.length) {
        const c = q.pop(), cx = c % W, cy = (c / W) | 0;
        for (const [a, d] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + a, ny = cy + d; if (nx <= b.x || ny <= b.y || nx >= b.x + b.w - 1 || ny >= b.y + b.h - 1) continue;
          const n = idx(nx, ny); if (seen.has(n)) continue;
          if (!(K.TF[tiles[n]] & 8) || solid[n] & 1) continue;
          seen.add(n); q.push(n);
        }
      }
      return seen.size >= free;
    }
    function put(b, room, k, w, h, where, o = {}) {
      // where: 'wall' | 'center' | 'back' | 'any'
      for (let tries = 0; tries < 30; tries++) {
        let x, y, face = 0;
        const ww = w, hh = h;
        if (where === 'center') { x = room.x + 1 + rng.int(Math.max(1, room.w - ww - 1)); y = room.y + 1 + rng.int(Math.max(1, room.h - hh - 1)); }
        else {
          const side = rng.int(4);
          if (side === 0) { x = room.x + rng.int(Math.max(1, room.w - ww + 1)); y = room.y; face = 2; }
          else if (side === 1) { x = room.x + room.w - ww; y = room.y + rng.int(Math.max(1, room.h - hh + 1)); face = 3; }
          else if (side === 2) { x = room.x + rng.int(Math.max(1, room.w - ww + 1)); y = room.y + room.h - hh; face = 0; }
          else { x = room.x; y = room.y + rng.int(Math.max(1, room.h - hh + 1)); face = 1; }
        }
        if (x < room.x || y < room.y || x + ww > room.x + room.w || y + hh > room.y + room.h) continue;
        const p = addProp(k, x, y, ww, hh, { bld: b.id, face, ...o });
        if (!p) continue;
        if (PK[k].s & 1 && !reachableOK(b)) { removeProp(p); continue; }
        return p;
      }
      return null;
    }
    const putFlex = (b, room, k, len, where, o) => (rng.chance(0.5) ? put(b, room, k, len, 1, where, o) || put(b, room, k, 1, len, where, o) : put(b, room, k, 1, len, where, o) || put(b, room, k, len, 1, where, o));

    /** shop counter parallel to the wall opposite the main door, keeper behind it, customers in front */
    function placeCounter(b, r, k, extra) {
      const d = b.doors[0];
      const vertDoor = d.ox !== 0; // door on W/E wall → counter runs vertically
      const len = Math.min(3, (vertDoor ? r.h : r.w) - 2);
      if (len < 2 || (vertDoor ? r.w : r.h) < 4) return null;
      let cx, cy, kx, ky, w, h;
      if (!vertDoor) {
        const back = d.oy > 0 ? r.y : r.y + r.h - 1;           // row against the far wall
        const row = d.oy > 0 ? back + 1 : back - 1;
        cx = r.x + 1; cy = row; w = len; h = 1; kx = cx + 1; ky = back;
      } else {
        const back = d.ox > 0 ? r.x : r.x + r.w - 1;
        const col = d.ox > 0 ? back + 1 : back - 1;
        cx = col; cy = r.y + 1; w = 1; h = len; kx = back; ky = cy + 1;
      }
      const p = addProp(k, cx, cy, w, h, { bld: b.id, extra });
      if (!p) return null;
      if (!reachableOK(b)) { removeProp(p); return null; }
      b.counter = p; b.keeperPos = { x: kx, y: ky };
      clear[idx(kx, ky)] = 1;   // nothing may block the keeper's spot
      return p;
    }
    function roomLight(b, r, c, i = 0.85) {
      lights.push({ x: (r.x + r.w / 2) * TILE, y: (r.y + r.h / 2) * TILE, r: Math.max(r.w, r.h) * TILE * 0.85 + 40, c, i, kind: 'room', bld: b.id, clip: { x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE } });
    }
    function addPois(b, r, kind, n) {
      for (let k = 0; k < n * 4 && n > 0; k++) {
        const x = r.x + rng.int(r.w), y = r.y + rng.int(r.h), t = idx(x, y);
        if (solid[t] & 1 || clear[t]) continue;
        b.pois.push({ x, y, kind, room: b.rooms.indexOf(r) }); n--;
      }
    }

    /** the bank's vault: a back room with no outside door and as few inner doors as possible */
    function pickVault(b) {
      const doorsOf = (r) => b.doors.filter((d) => [[d.x + 1, d.y], [d.x - 1, d.y], [d.x, d.y + 1], [d.x, d.y - 1]].some(([i, j]) => i >= r.x && i < r.x + r.w && j >= r.y && j < r.y + r.h));
      let best = null;
      for (const r of b.rooms) {
        if (r.front) continue;
        const ds = doorsOf(r); if (ds.some((d) => d.outer) || !ds.length) continue;
        const sc = ds.length * 10 - r.w * r.h * 0.1;
        if (!best || sc < best.sc) best = { r, ds, sc };
      }
      return best;
    }

    function furnish(b) {
      const T0 = b.type, rooms = b.rooms;
      const vault = T0 === 'bank' ? pickVault(b) : null;
      const warm = [255, 206, 150], cool = [190, 220, 255], neutral = [240, 235, 225];
      rooms.forEach((r, ri) => {
        const front = r.front, area = r.w * r.h;
        let role;
        if (T0 === 'house' || T0 === 'flat') role = front ? 'living' : ri === 1 ? 'bedroom' : ri === 2 ? 'kitchen' : 'bedroom';
        else if (T0 === 'office') role = front ? 'lobby' : area >= 30 && ri === rooms.length - 1 ? 'boss' : 'office';
        else if (T0 === 'hotel') role = front ? 'lobby' : 'suite';
        else if (T0 === 'villa') role = front ? 'hall' : ['living', 'bedroom', 'study', 'kitchen'][(ri - 1) % 4];
        else if (T0 === 'warehouse') role = front ? 'storage' : 'backoffice';
        else if (T0 === 'black') role = front ? 'blackshop' : 'storage';
        else if (T0 === 'police') role = front ? 'desk' : ri === 1 ? 'cells' : ri === 2 ? 'armory' : 'office';
        else if (T0 === 'hospital') role = front ? 'reception' : 'ward';
        else if (T0 === 'diner') role = front ? 'dining' : 'kitchen';
        else if (T0 === 'bar') role = front ? 'bar' : 'storage';
        else if (T0 === 'autohaus') role = 'showroom';
        else if (T0 === 'bank') role = front ? 'banklobby' : vault && r === vault.r ? 'vault' : 'office';
        else if (T0 === 'club') role = front ? 'dance' : 'vip';
        else role = front ? 'shop' : 'storage';
        r.role = role;
        const B = (k, w, h, where, o) => put(b, r, k, w, h, where, o);
        const Bf = (k, len, where, o) => putFlex(b, r, k, len, where, o);
        switch (role) {
          case 'living': Bf('sofa', 2, 'wall'); B('tv', 1, 1, 'wall'); B('table', 1, 1, 'center'); B('plant', 1, 1, 'wall'); if (area > 12) B('rug', 2, 2, 'center'); B('shelf', 1, 1, 'wall'); addPois(b, r, 'sit', 2); break;
          case 'bedroom': Bf('bed', 2, 'wall'); B('wardrobe', 1, 1, 'wall'); B('plant', 1, 1, 'wall'); addPois(b, r, 'sleep', 1); break;
          case 'kitchen': B('fridge', 1, 1, 'wall'); B('stove', 1, 1, 'wall'); B('sink', 1, 1, 'wall'); B('table', 1, 1, 'center'); B('chair', 1, 1, 'center'); addPois(b, r, 'work', 2); break;
          case 'lobby': Bf('counter', 3, 'wall'); B('plant', 1, 1, 'wall'); B('plant', 1, 1, 'wall'); Bf('sofa', 2, 'wall'); if (T0 === 'hotel') { B('piano', 2, 1, 'center'); B('rug', 3, 2, 'center'); } addPois(b, r, 'stand', 4); break;
          case 'office': for (let k = 0; k < Math.max(1, area / 10); k++) Bf('desk', 2, 'wall'); B('shelf', 1, 1, 'wall'); B('plant', 1, 1, 'wall'); addPois(b, r, 'work', 3); break;
          case 'boss': Bf('desk2', 2, 'center'); B('rug', 3, 2, 'center'); B('safe', 1, 1, 'wall'); Bf('sofa', 2, 'wall'); B('plant', 1, 1, 'wall'); addPois(b, r, 'work', 2); break;
          case 'suite': Bf('bed', 2, 'wall'); Bf('sofa', 2, 'wall'); B('tv', 1, 1, 'wall'); B('wardrobe', 1, 1, 'wall'); addPois(b, r, 'sit', 2); break;
          case 'hall': B('rug', 3, 2, 'center'); B('plant', 1, 1, 'wall'); B('plant', 1, 1, 'wall'); B('piano', 2, 1, 'wall'); addPois(b, r, 'stand', 3); break;
          case 'study': Bf('desk2', 2, 'center'); B('shelf', 1, 1, 'wall'); B('shelf', 1, 1, 'wall'); B('safe', 1, 1, 'wall'); addPois(b, r, 'work', 2); break;
          case 'storage': for (let k = 0; k < area / 6; k++) B(rng.chance(0.5) ? 'crate' : 'shelf', 1, 1, 'wall'); B('locker', 1, 1, 'wall'); addPois(b, r, 'work', 2); break;
          case 'backoffice': Bf('desk', 2, 'wall'); B('locker', 1, 1, 'wall'); B('safe', 1, 1, 'wall'); addPois(b, r, 'work', 2); break;
          case 'blackshop': placeCounter(b, r, 'counter', { shop: 1 }) || Bf('counter', 3, 'wall', { extra: { shop: 1 } }); B('crate', 1, 1, 'wall'); B('crate', 1, 1, 'wall'); B('rack', 1, 1, 'wall'); addPois(b, r, 'stand', 3); break;
          case 'desk': Bf('counter', 3, 'wall'); B('plant', 1, 1, 'wall'); Bf('bench', 2, 'wall'); addPois(b, r, 'stand', 3); break;
          case 'cells': for (let k = 0; k < 2; k++) Bf('cell', 2, 'wall'); addPois(b, r, 'stand', 1); break;
          case 'armory': B('rack', 1, 1, 'wall'); B('rack', 1, 1, 'wall'); B('locker', 1, 1, 'wall'); B('locker', 1, 1, 'wall'); addPois(b, r, 'stand', 1); break;
          case 'reception': placeCounter(b, r, 'counter', { shop: 1 }) || Bf('counter', 3, 'wall', { extra: { shop: 1 } }); Bf('bench', 2, 'wall'); B('plant', 1, 1, 'wall'); addPois(b, r, 'stand', 3); break;
          case 'ward': for (let k = 0; k < area / 8; k++) Bf('hbed', 2, 'wall'); addPois(b, r, 'stand', 2); break;
          case 'dining': placeCounter(b, r, 'counter', { shop: 1 }) || Bf('counter', 3, 'wall', { extra: { shop: 1 } }); for (let k = 0; k < area / 9; k++) { B('table', 1, 1, 'center'); } B('plant', 1, 1, 'wall'); addPois(b, r, 'sit', 5); break;
          case 'bar': placeCounter(b, r, 'barc', { shop: 1 }) || Bf('barc', 4, 'wall', { extra: { shop: 1 } }); B('pooltable', 2, 1, 'center'); B('table', 1, 1, 'center'); B('stool', 1, 1, 'center'); addPois(b, r, 'sit', 5); break;
          case 'dance': B('dance', Math.min(4, r.w - 2), Math.min(4, r.h - 2), 'center'); Bf('barc', 3, 'wall'); B('dj', 2, 1, 'wall'); addPois(b, r, 'dance', 6); break;
          case 'banklobby': placeCounter(b, r, 'counter', { shop: 1 }) || Bf('counter', 3, 'wall', { extra: { shop: 1 } }); Bf('bench', 2, 'wall'); B('plant', 1, 1, 'wall'); B('plant', 1, 1, 'wall'); B('rug', 3, 2, 'center'); addPois(b, r, 'stand', 4); break;
          case 'showroom': placeCounter(b, r, 'counter', { shop: 1 }) || Bf('counter', 3, 'wall', { extra: { shop: 1 } }); Bf('sofa', 2, 'wall'); B('table', 1, 1, 'wall'); B('plant', 1, 1, 'wall'); B('plant', 1, 1, 'wall'); B('rug', 3, 2, 'center'); addPois(b, r, 'stand', 3); break;
          case 'vault':
            // no windows into the vault
            for (let j = r.y - 1; j <= r.y + r.h; j++) for (let i = r.x - 1; i <= r.x + r.w; i++) if (get(i, j) === T.WINDOW) set(i, j, T.WALL);
            for (let k = 0; k < Math.max(4, area / 3); k++) B('deposit', 1, 1, 'wall'); B('cart', 1, 1, 'center'); break;
          case 'vip': Bf('sofa', 2, 'wall'); Bf('sofa', 2, 'wall'); B('table', 1, 1, 'center'); B('safe', 1, 1, 'wall'); addPois(b, r, 'sit', 3); break;
          default: { // shop
            const c = placeCounter(b, r, 'counter', { shop: 1 }) || Bf('counter', 3, 'wall', { extra: { shop: 1 } });
            if (T0 === 'jeweler') { for (let k = 0; k < 3; k++) B('showcase', 1, 1, 'center'); for (let k = 0; k < 2; k++) B('showcase', 1, 1, 'wall'); }
            else for (let k = 0; k < 3; k++) B(T0 === 'gun' ? 'rack' : 'shelf', 1, 1, 'wall');
            if (c) b.counter = c;
            addPois(b, r, 'stand', 3);
          }
        }
        if (role === 'vault') { roomLight(b, r, [255, 236, 190], 0.7); return; }
        const lc = role === 'dance' ? [200, 90, 255] : role === 'vip' ? [255, 80, 120] : ['office', 'lobby', 'ward', 'reception', 'desk', 'cells', 'armory', 'shop'].includes(role) ? cool : role === 'storage' ? neutral : warm;
        roomLight(b, r, lc, role === 'dance' ? 1 : 0.85);
      });
      // a counter with shop flag marks where the keeper stands
      for (const p of props) if (p && p.bld === b.id && (p.k === 'counter' || p.k === 'barc') && (p.shop || b.shop) && !b.counter) b.counter = p;
      if (b.counter && !b.keeperPos) {
        const c = b.counter;
        // keeper tile: free tile adjacent to the counter on its wall side
        let best = null;
        for (let j = c.y - 1; j <= c.y + c.h; j++) for (let i = c.x - 1; i <= c.x + c.w; i++) {
          if (i >= c.x && i < c.x + c.w && j >= c.y && j < c.y + c.h) continue;
          const t = idx(i, j); if (!(K.TF[tiles[t]] & 8) || solid[t] & 1 || tiles[t] === T.DOOR) continue;
          const wallish = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, d]) => tiles[idx(i + a, j + d)] === T.WALL);
          const sc = (wallish ? 2 : 0) + rng.next();
          if (!best || sc > best.sc) best = { x: i, y: j, sc };
        }
        if (best) b.keeperPos = { x: best.x, y: best.y };
      }
      // restricted rooms / whole building
      const rr = b.restricted;
      if (rr) {
        const zid = zones.length;
        const z = { id: zid, roles: rr, bld: b.id, name: b.name, patrol: [], guards: 0 };
        zones.push(z);
        const wholeBuilding = ['villa', 'warehouse'].includes(T0);
        b.rooms.forEach((r) => {
          const pub = !wholeBuilding && (r.front || (T0 === 'club' && r.role === 'dance'));
          if (pub) return;
          for (let j = r.y - 1; j <= r.y + r.h; j++) for (let i = r.x - 1; i <= r.x + r.w; i++) if (bmap[idx(i, j)] === b.id && tiles[idx(i, j)] !== T.DOOR) zmap[idx(i, j)] = zid;
          for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) zmap[idx(i, j)] = zid;
          z.patrol.push({ x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) });
        });
        // doors into restricted space are locked for unauthorised people
        for (const d of b.doors) {
          const sides = d.horiz ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
          const into = sides.some(([a, c]) => zmap[idx(d.x + a, d.y + c)] === zid);
          if (into && (!d.outer || !d.main || wholeBuilding)) { d.locked = true; d.access = rr; zmap[d.i] = zid; }
        }
        b.zone = zid;
        if (vault) {
          for (const d of vault.ds) { d.locked = true; d.access = ['vault']; d.vault = true; zmap[d.i] = zid; }
          z.patrol = z.patrol.filter((p) => !(p.x >= vault.r.x && p.x < vault.r.x + vault.r.w && p.y >= vault.r.y && p.y < vault.r.y + vault.r.h));
          b.vault = vault.r;
        }
        z.guards = { villa: 0, office: 2, club: 2, bank: 2, police: 0, warehouse: rng.chance(0.5) ? 2 : 0, hotel: 1, diner: 0 }[T0] ?? 1;
        if (!z.patrol.length) z.patrol.push({ x: b.x + (b.w >> 1), y: b.y + (b.h >> 1) });
      }
      if (T0 === 'house' || T0 === 'flat') {
        // private homes: locked, a little loot in the safe for burglars
        for (const d of b.doors) if (d.outer) { d.locked = true; d.access = ['resident']; }
        b.loot = rng.chance(0.55) ? 200 + rng.int(1400) : 0;
        if (b.loot) { const br = b.rooms.find((r) => r.role === 'bedroom') || b.rooms[b.rooms.length - 1]; put(b, br, 'safe', 1, 1, 'wall'); }
      }
    }

    // ---------------------------------------------------------- layouts
    const alley = (x, y, w, h) => { fill(x, y, w, h, T.CONC); };
    function dumpster(x, y, w = 2, h = 1) { return addProp('dumpster', x, y, w, h); }

    function single(lot, type, d) {
      fill(lot.x, lot.y, lot.w, lot.h, T.PLAZA);
      const dims = { bank: [14, 12], office: [14, 13], hotel: [16, 12], police: [13, 12], hospital: [14, 12], club: [13, 12] }[type] || [12, 12];
      const [bw, bh] = dims;
      const bx = lot.x + ((lot.w - bw) >> 1), by = lot.y + 2;
      const b = makeBuilding(bx, by, bw, bh, type, type === 'bank' ? ['S'] : ['S', 'N'], { district: d, depth: 2, frontDeep: true });
      furnish(b);
      // plaza decor
      for (const [x, y] of [[lot.x, lot.y + lot.h - 1], [lot.x + lot.w - 1, lot.y + lot.h - 1], [lot.x, lot.y], [lot.x + lot.w - 1, lot.y]]) addProp('tree', x, y);
      addProp('bench', lot.x + 1, lot.y + lot.h - 1, 2, 1); addProp('bench', lot.x + lot.w - 3, lot.y + lot.h - 1, 2, 1);
      dumpster(bx + bw - 3, lot.y);
      lamp(lot.x + 3, lot.y + lot.h - 2, [255, 214, 160], 150); lamp(lot.x + lot.w - 4, lot.y + lot.h - 2, [255, 214, 160], 150);
      if (type === 'club' || type === 'hotel') lights.push({ x: (b.doors[0].x + 0.5) * TILE, y: (b.doors[0].y + 1.5) * TILE, r: 120, c: type === 'club' ? [255, 60, 200] : [255, 190, 90], i: 1, kind: 'neon', flick: type === 'club' });
      return [b];
    }
    function halves(lot, types, d) {
      fill(lot.x, lot.y, lot.w, lot.h, T.PLAZA);
      alley(lot.x, lot.y + 8, lot.w, 2);
      const out = [];
      out.push(makeBuilding(lot.x + 1, lot.y, lot.w - 2, 8, types[0], ['N', 'S'], { district: d }));
      out.push(makeBuilding(lot.x + 1, lot.y + 10, lot.w - 2, 8, types[1], ['S', 'N'], { district: d }));
      out.forEach(furnish);
      dumpster(lot.x, lot.y + 8, 1, 2); dumpster(lot.x + lot.w - 1, lot.y + 8, 1, 2);
      return out;
    }
    function quad(lot, types, d) {
      fill(lot.x, lot.y, lot.w, lot.h, T.PLAZA);
      alley(lot.x + 8, lot.y, 2, lot.h); alley(lot.x, lot.y + 8, lot.w, 2);
      const out = [];
      [[0, 0], [10, 0], [0, 10], [10, 10]].forEach(([ox, oy], k) => {
        const type = types[k];
        const small = type === 'house' && rng.chance(0.5);
        const bw = small ? 7 : 8, bh = small ? 7 : 8;
        const bx = lot.x + ox + (ox ? 0 : 8 - bw), by = lot.y + oy + (oy ? 0 : 8 - bh);
        const b = makeBuilding(bx, by, bw, bh, type, [oy ? 'S' : 'N'], { district: d, depth: K.BTYPES[type].shop || type === 'bar' ? 0 : undefined });
        furnish(b); out.push(b);
        if (b.shop || type === 'bar' || type === 'diner') lights.push({ x: (b.doors[0].x + 0.5) * TILE, y: (b.doors[0].y + 0.5 + b.doors[0].oy) * TILE, r: 90, c: type === 'bar' ? [80, 140, 255] : [255, 120, 60], i: 0.9, kind: 'neon', flick: false });
      });
      dumpster(lot.x + 8, lot.y + 3, 1, 2); addProp('trash', lot.x + 9, lot.y + 13);
      return out;
    }
    function residential(lot, d) {
      fill(lot.x, lot.y, lot.w, lot.h, T.GRASS);
      const out = [];
      [[0, 0], [10, 0], [0, 10], [10, 10]].forEach(([ox, oy]) => {
        const sx = lot.x + ox, sy = lot.y + oy;
        const b = makeBuilding(sx + 1, sy + 1, 6, 6, 'house', [oy ? 'S' : 'N'], { district: d });
        furnish(b); out.push(b);
        // garden path to the street + hedge on the inner sides
        const dx = b.doors[0].x;
        set(dx, oy ? sy + 7 : sy, T.PLAZA);
        for (let k = 0; k < 8; k++) { if (oy) set(sx + k, sy + 0, T.HEDGE); else set(sx + k, sy + 7, T.HEDGE); }
        for (let k = 0; k < 8; k++) set(ox ? sx + 7 : sx, sy + k, ox ? T.GRASS : T.GRASS);
        if (rng.chance(0.8)) addProp('tree', ox ? sx + 7 : sx, oy ? sy + 7 - 1 : sy + 1);
        if (rng.chance(0.6)) addProp('bush', ox ? sx + 7 : sx, oy ? sy + 3 : sy + 4);
      });
      // inner garden strips
      for (let k = 0; k < lot.w; k++) if (rng.chance(0.25)) addProp(rng.chance(0.5) ? 'tree' : 'bush', lot.x + k, lot.y + 8 + rng.int(2));
      return out;
    }
    function villa(lot, d, forSale) {
      fill(lot.x, lot.y, lot.w, lot.h, T.GRASS);
      for (let k = 0; k < lot.w; k++) { set(lot.x + k, lot.y, T.FENCE); set(lot.x + k, lot.y + lot.h - 1, T.FENCE); }
      for (let k = 0; k < lot.h; k++) { set(lot.x, lot.y + k, T.FENCE); set(lot.x + lot.w - 1, lot.y + k, T.FENCE); }
      const gx = lot.x + 8;
      set(gx, lot.y + lot.h - 1, T.GATE); set(gx + 1, lot.y + lot.h - 1, T.GATE);
      const b = makeBuilding(lot.x + 4, lot.y + 2, 10, 9, 'villa', ['S', 'N'], { district: d, depth: 2, restricted: forSale ? null : undefined });
      furnish(b);
      fill(gx, lot.y + 11, 2, lot.h - 12, T.PLAZA);
      for (let k = lot.y + 11; k < lot.y + lot.h - 1; k++) { clear[idx(gx, k)] = 1; clear[idx(gx + 1, k)] = 1; }
      fill(lot.x + 11, lot.y + 12, 6, 4, T.PLAZA); fill(lot.x + 12, lot.y + 13, 4, 2, T.POOL);
      lights.push({ x: (lot.x + 14) * TILE, y: (lot.y + 14) * TILE, r: 110, c: [90, 200, 255], i: 0.9, kind: 'pool' });
      addProp('umbrella', lot.x + 11, lot.y + 12); addProp('umbrella', lot.x + 16, lot.y + 15);
      for (let k = 0; k < 10; k++) { const x = lot.x + 1 + rng.int(lot.w - 2), y = lot.y + 1 + rng.int(lot.h - 2); if (get(x, y) === T.GRASS) addProp(rng.chance(0.6) ? 'tree' : 'bush', x, y); }
      lamp(gx - 1, lot.y + 13, [255, 220, 170], 120); lamp(gx + 2, lot.y + 15, [255, 220, 170], 120);
      // garden zone: everything inside the fence belongs to the villa
      if (b.zone != null) {
        const z = zones[b.zone];
        for (let j = lot.y; j < lot.y + lot.h; j++) for (let i = lot.x; i < lot.x + lot.w; i++) if (zmap[idx(i, j)] < 0 && get(i, j) !== T.FENCE) zmap[idx(i, j)] = b.zone;
        z.patrol.push({ x: lot.x + 2, y: lot.y + 2 }, { x: lot.x + lot.w - 3, y: lot.y + 2 }, { x: lot.x + 2, y: lot.y + lot.h - 3 }, { x: lot.x + lot.w - 3, y: lot.y + lot.h - 3 }, { x: gx, y: lot.y + lot.h - 3 });
        z.guards = 4; z.garden = { x: lot.x, y: lot.y, w: lot.w, h: lot.h };
      }
      b.lot = { ...lot };
      return [b];
    }
    function park(lot) {
      fill(lot.x, lot.y, lot.w, lot.h, T.GRASS);
      fill(lot.x, lot.y + 8, lot.w, 2, T.DIRT); fill(lot.x + 8, lot.y, 2, lot.h, T.DIRT);
      fill(lot.x + 6, lot.y + 6, 6, 6, T.PLAZA);
      addProp('fountain', lot.x + 8, lot.y + 8, 2, 2);
      lights.push({ x: (lot.x + 9) * TILE, y: (lot.y + 9) * TILE, r: 140, c: [120, 200, 255], i: 0.7, kind: 'pool' });
      const q = rng.int(4), px = lot.x + (q & 1 ? 12 : 1), py = lot.y + (q & 2 ? 12 : 1);
      fill(px, py, 5, 4, T.WATER);
      for (let k = 0; k < 26; k++) { const x = lot.x + rng.int(lot.w), y = lot.y + rng.int(lot.h); if (get(x, y) === T.GRASS) addProp(rng.chance(0.55) ? 'tree' : 'bush', x, y); }
      addProp('bench', lot.x + 3, lot.y + 7, 2, 1); addProp('bench', lot.x + 13, lot.y + 10, 2, 1); addProp('bench', lot.x + 7, lot.y + 3, 1, 2); addProp('bench', lot.x + 10, lot.y + 14, 1, 2);
      for (const [x, y] of [[lot.x + 5, lot.y + 10], [lot.x + 12, lot.y + 7], [lot.x + 7, lot.y + 13], [lot.x + 10, lot.y + 4]]) lamp(x, y, [210, 230, 255], 150);
      return [];
    }
    function industrial(lot, types, d) {
      fill(lot.x, lot.y, lot.w, lot.h, T.CONC);
      const out = [];
      out.push(makeBuilding(lot.x, lot.y, lot.w, 7, types[0], ['N', 'S'], { district: d, depth: 1 }));
      if (types[1]) out.push(makeBuilding(lot.x, lot.y + 11, lot.w, 7, types[1], ['S', 'N'], { district: d, depth: 1 }));
      out.forEach(furnish);
      for (let k = 0; k < 4; k++) addProp('container', lot.x + 1 + k * 4, lot.y + 8, 3, 2, { c: rng.int(6) });
      dumpster(lot.x + lot.w - 2, lot.y + 7);
      lamp(lot.x, lot.y + 7, [255, 170, 90], 170);
      return out;
    }
    function docks(lot, types, d) {
      fill(lot.x, lot.y, lot.w, lot.h, T.CONC);
      const type = types ? types[0] : 'warehouse';
      const b = makeBuilding(lot.x + 1, lot.y, 16, 8, type, ['S', 'N'], { district: d, depth: 1, restricted: type === 'black' ? null : undefined });
      furnish(b);
      for (let k = 0; k < 5; k++) for (let s = 0; s < 2; s++) addProp('container', lot.x + 1 + k * 3 + (s ? 0 : 0), lot.y + 10 + s * 4, 2, 3, { c: rng.int(6) });
      for (let k = 0; k < 4; k++) addProp('crate', lot.x + 16 + (k & 1), lot.y + 11 + (k >> 1));
      dumpster(lot.x + 16, lot.y + 15);
      lamp(lot.x + 17, lot.y + 9, [255, 160, 80], 190); lamp(lot.x, lot.y + 9, [255, 160, 80], 190);
      return [b];
    }

    /** filling station: kiosk, two pump islands under a lit canopy, price pylon */
    function gasStation(lot, d) {
      fill(lot.x, lot.y, lot.w, lot.h, T.CONC);
      const b = makeBuilding(lot.x + 5, lot.y + 1, 8, 6, 'gas', ['S'], { district: d, depth: 0 });
      furnish(b);
      canopies.push({ x: lot.x + 2, y: lot.y + 9, w: 14, h: 8, col: '#d9d9d4', stripe: '#1f8a4c', label: 'NORDLICHT' });
      for (const [k, y] of [[0, lot.y + 11], [1, lot.y + 14]]) for (let i = 0; i < 3; i++) {
        const x = lot.x + 4 + i * 4, p = addProp('pump', x, y, 1, 1, { extra: { pump: pumps.length, bldG: b.id } });
        if (p) pumps.push({ x, y, id: p.id, bld: b.id });
        void k;
      }
      for (let i = 0; i < 4; i++) lights.push({ x: (lot.x + 4 + i * 3.5) * TILE, y: (lot.y + 12.5) * TILE, r: 170, c: [235, 245, 255], i: 0.9, kind: 'lamp' });
      addProp('gassign', lot.x + lot.w - 1, lot.y + lot.h - 1);
      lights.push({ x: (b.doors[0].x + 0.5) * TILE, y: (b.doors[0].y + 1.5) * TILE, r: 90, c: [90, 255, 160], i: 0.9, kind: 'neon' });
      b.gas = true;
      return [b];
    }
    /** car dealership: glass showroom with a sales desk, display lot with spots */
    function dealership(lot, d) {
      fill(lot.x, lot.y, lot.w, lot.h, T.PLAZA);
      const b = makeBuilding(lot.x + 2, lot.y + 1, 14, 7, 'autohaus', ['S'], { district: d, depth: 0 });
      // glass front: windows all along the street side
      for (let i = b.x + 1; i < b.x + b.w - 1; i++) if (get(i, b.y + b.h - 1) === T.WALL) set(i, b.y + b.h - 1, T.WINDOW);
      furnish(b);
      for (let k = 0; k < 4; k++) carSpots.push({ x: lot.x + 2.5 + k * 4.2, y: lot.y + 11, a: Math.PI / 2, bld: b.id, display: k });
      b.delivery = { x: lot.x + 9, y: lot.y + 15.5, a: 0 };
      for (const x of [lot.x, lot.x + lot.w - 1]) addProp('flag', x, lot.y + 9);
      lamp(lot.x + 1, lot.y + 16, [235, 240, 255], 200); lamp(lot.x + lot.w - 2, lot.y + 16, [235, 240, 255], 200);
      lights.push({ x: (lot.x + 9) * TILE, y: (lot.y + 11.5) * TILE, r: 260, c: [235, 240, 255], i: 0.9, kind: 'lamp' });
      return [b];
    }
    /** workshop: office with counter + three open service bays with lifts under a roof */
    function workshop(lot, d) {
      fill(lot.x, lot.y, lot.w, lot.h, T.CONC);
      const b = makeBuilding(lot.x + 1, lot.y + 1, 6, 7, 'werkstatt', ['S'], { district: d, depth: 0 });
      furnish(b);
      canopies.push({ x: lot.x + 8, y: lot.y + 1, w: 10, h: 8, col: '#3a3d44', stripe: '#c87a00', label: 'WERKSTATT' });
      for (let k = 0; k < 3; k++) {
        const bx = lot.x + 8 + k * 3.33;
        addProp('lift', Math.floor(bx + 0.5), lot.y + 3, 2, 4);
        bays.push({ x: bx, y: lot.y + 1, w: 3.33, h: 8, cx: bx + 1.66, cy: lot.y + 5, bld: b.id, i: k });
        lights.push({ x: (bx + 1.66) * TILE, y: (lot.y + 4) * TILE, r: 150, c: [255, 240, 210], i: 0.9, kind: 'lamp' });
      }
      addProp('toolbox', lot.x + 8, lot.y + 9); addProp('toolbox', lot.x + 17, lot.y + 9);
      addProp('tires', lot.x + 1, lot.y + 10); addProp('tires', lot.x + 2, lot.y + 10); addProp('tires', lot.x + 1, lot.y + 11);
      for (let k = 0; k < 4; k++) addProp('cone', lot.x + 9 + k * 2, lot.y + 10);
      return [b];
    }

    // ---------------------------------------------------------- blocks
    const blocks = [];
    for (let bj = 0; bj < NB; bj++) for (let bi = 0; bi < NB; bi++) {
      const ox = bi * P + R, oy = bj * P + R;
      const d = DCODE[DMAP[bj][bi]];
      fill(ox, oy, 22, 22, T.WALK);
      const lot = { x: ox + 2, y: oy + 2, w: 18, h: 18 };
      const plan = PLAN[bi + ',' + bj];
      let bl;
      if (d === 'park') bl = park(lot);
      else if (d === 'hill') bl = villa(lot, d, false);
      else if (d === 'res' && !plan) bl = residential(lot, d);
      else if (d === 'docks') bl = docks(lot, plan, d);
      else if (d === 'ind' && !(plan && ['gas', 'werkstatt'].includes(plan[0]))) bl = industrial(lot, plan || ['warehouse', 'warehouse'], d);
      else {
        const pl = plan || (d === 'old' ? ['house', 'house', 'flat', 'house'] : ['flat', 'office']);
        bl = pl[0] === 'gas' ? gasStation(lot, d) : pl[0] === 'autohaus' ? dealership(lot, d) : pl[0] === 'werkstatt' ? workshop(lot, d) : pl.length === 1 ? single(lot, pl[0], d) : pl.length === 2 ? halves(lot, pl, d) : quad(lot, pl, d);
      }
      blocks.push({ bi, bj, d, ox, oy, b: bl });
      // sidewalk furniture
      const edgeRing = [];
      for (let k = 0; k < 22; k++) edgeRing.push([ox + k, oy], [ox + 21, oy + k], [ox + 21 - k, oy + 21], [ox, oy + 21 - k]);
      edgeRing.forEach(([x, y], k) => {
        if (k % 9 === 4) lamp(x, y);
        else if ((d === 'res' || d === 'old' || d === 'hill') && k % 7 === 0 && rng.chance(0.75)) addProp('tree', x, y);
        else if ((d === 'down' || d === 'old') && k % 13 === 9 && rng.chance(0.5)) addProp('trash', x, y);
        else if (k % 29 === 17 && rng.chance(0.4)) addProp('hydrant', x, y);
      });
      // vending machines and cash machines against the inner sidewalk edge
      if ((d === 'down' || d === 'old' || d === 'res') && rng.chance(0.65)) {
        const k = 4 + rng.int(14);
        addProp('vending', ox + 1 + k, oy + 1, 1, 1, { face: 0 }) || addProp('vending', ox + 1, oy + 1 + k, 1, 1, { face: 1 });
      }
      if ((d === 'down' || d === 'old' || d === 'docks' || d === 'res') && rng.chance(d === 'down' ? 0.9 : 0.45)) {
        const k = 3 + rng.int(15);
        addProp('atm', ox + 1 + k, oy + 20, 1, 1, { face: 2 }) || addProp('atm', ox + 20, oy + 1 + k, 1, 1, { face: 3 });
      }
    }

    // ---------------------------------------------------------- piers & boats
    for (let bi = 0; bi < NB; bi++) {
      const x0 = bi * P + R + 3;
      for (const px of [x0, x0 + 11]) {
        fill(px, W + 2, 3, 8, T.DOCK);
        addProp('boat', px + 3, W + 4, 2, 5, { c: rng.int(6) });
        lamp(px + 1, W + 9, [255, 180, 110], 140);
      }
      addProp('bollard', bi * P + 2, W + 1); addProp('crane', bi * P + R + 10, W, 3, 2);
    }

    // ---------------------------------------------------------- properties
    const used = new Set();
    for (const def of K.PROPERTIES) {
      const cands = buildings.filter((b) => b.type === def.btype && b.district === def.district && !used.has(b.id) && !b.shop || (def.btype === 'bar' && b.type === 'bar'));
      const b = cands.find((c) => c.type === def.btype && !used.has(c.id));
      if (!b) continue;
      used.add(b.id);
      b.property = def.id; b.price = def.price; b.name = def.name; b.loot = 0; b.lit = true;
      if (b.zone != null) { const z = zones[b.zone]; z.guards = 0; z.dead = true; for (let i = 0; i < N; i++) if (zmap[i] === b.zone) zmap[i] = -1; b.zone = null; b.restricted = null; }
      for (const d of b.doors) { d.locked = d.outer; d.access = d.outer ? ['owner'] : null; }
      // stash safe + bed + wardrobe for every home
      const rr = b.rooms.find((r) => r.role === 'bedroom' || r.role === 'backoffice' || r.role === 'storage') || b.rooms[b.rooms.length - 1];
      if (!props.some((p) => p && p.bld === b.id && p.k === 'safe')) put(b, rr, 'safe', 1, 1, 'wall');
      if (!props.some((p) => p && p.bld === b.id && p.k === 'bed')) putFlex(b, rr, 'bed', 2, 'wall');
      if (!props.some((p) => p && p.bld === b.id && p.k === 'wardrobe')) put(b, rr, 'wardrobe', 1, 1, 'wall');
      for (const p of props) if (p && p.bld === b.id && p.k === 'safe') p.stash = def.id;
      if (!def.start) {
        const e = b.entrance; const s = addProp('sign', e.x + 1, e.y, 1, 1, { force: true }) || addProp('sign', e.x - 1, e.y, 1, 1, { force: true });
        if (s) s.property = def.id;
      }
    }

    // ---------------------------------------------------------- walk spawn list & misc
    const walk = [], roadNodes = [];
    for (let i = 0; i < N; i++) if (tiles[i] === T.WALK && !(solid[i] & 1)) walk.push(i);
    for (let j = 0; j <= NB; j++) for (let i = 0; i <= NB; i++) roadNodes.push({ i, j, x: (i * P + 2) * TILE, y: (j * P + 2) * TILE });

    const world = {
      W, H, N, P, R, NB, seed, tiles, solid, bmap, zmap, pmap, doors, buildings, props, lights, zones, blocks, walk, roadNodes, canopies, carSpots, bays, pumps,
      districtAt(x, y) { // tile coords
        if (y >= W) return 'sea';
        if (x % P < R || y % P < R) return 'road';
        const bi = Math.min(NB - 1, Math.floor(x / P)), bj = Math.min(NB - 1, Math.floor(y / P));
        return DCODE[DMAP[bj][bi]];
      },
      byType(t) { return buildings.filter((b) => b.type === t); },
      prop(k) { return props.find((p) => p && p.property === k); },
    };
    return world;
  };
})(globalThis.K = globalThis.K || {});
