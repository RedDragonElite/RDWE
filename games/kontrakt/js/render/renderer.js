/* RDE // KONTRAKT — renderer: baked ground chunks, roofs, shadows, line-of-sight fog, lightmap, weather, overlay */
(function (K) {
  'use strict';
  const U = K.U, T = K.T, TF = K.TF, TILE = K.TILE;
  const CH = 8, CS = 2, CPX = CH * TILE; // chunk = 8×8 tiles, baked at 2 px per world px
  const BH = { house: 34, flat: 64, office: 120, hotel: 140, villa: 46, warehouse: 50, police: 70, hospital: 90, gun: 38, food: 34, pharmacy: 38, cloth: 44, diner: 34, bar: 36, club: 56, black: 44 };
  const CARPETS = ['#5c1f28', '#1f3a5c', '#2f4a2a', '#4a2a4a', '#5a4a2a', '#2a2a32'];
  const WOODS = ['#8a5c36', '#6e4426', '#9a7048', '#5c3a22'];

  class Renderer {
    constructor(game, canvas, over) {
      this.g = game; this.w = game.world;
      this.cv = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
      this.ov = over; this.octx = over.getContext('2d');
      this.cam = { x: this.w.player.x, y: this.w.player.y, vx: this.w.player.x - 800, vy: this.w.player.y - 450, z: 1.8, zoomMul: 1, shake: 0, kick: 0, tz: 1 };
      this.chunks = new Map();
      this.roofs = new Map();
      this.roofA = new Float32Array(this.w.buildings.length).fill(1);
      this.lc = K.mkCanvas(4, 4); this.lctx = this.lc.getContext('2d');
      this.fc = K.mkCanvas(4, 4); this.fctx = this.fc.getContext('2d');
      this.fx = new K.FX(this);
      this.time = 0; this.resScale = 1;
      this.vis = []; this.visT = 0;
      this.rain = []; this.wet = 0;
      this.hitMark = 0; this.dmgDirs = [];
      this.npcVis = new Map();
      this.prepare();
      this.resize();
    }
    prepare() {
      const w = this.w;
      // per-building tints & window lists
      this.btint = w.buildings.map((b) => ({ carpet: CARPETS[b.seed % CARPETS.length], wood: WOODS[(b.seed >> 3) % WOODS.length], wall: U.shade(b.color, 0.55), wallIn: '#8f8a80' }));
      this.windows = w.buildings.map(() => []);
      for (let i = 0; i < w.N; i++) if (w.tiles[i] === T.WINDOW && w.bmap[i] >= 0) this.windows[w.bmap[i]].push(i);
      // water rects for the animated overlay
      this.waterRects = [];
      for (let y = 0; y < w.H; y++) {
        let x = 0;
        while (x < w.W) {
          const t = w.tiles[y * w.W + x];
          if (t === T.WATER || t === T.POOL) { let x2 = x; while (x2 < w.W && w.tiles[y * w.W + x2] === t) x2++; this.waterRects.push({ x, y, w: x2 - x, pool: t === T.POOL }); x = x2; } else x++;
        }
      }
      this.tallProps = w.props.filter((p) => p && K.PROPK[p.k] && (K.PROPK[p.k].tall));
      this.tallGrid = new Map();
      for (const p of this.tallProps) { const k = ((p.x / CH) | 0) * 1000 + ((p.y / CH) | 0); if (!this.tallGrid.has(k)) this.tallGrid.set(k, []); this.tallGrid.get(k).push(p); }
      // patterns
      const n = K.mkCanvas(128, 128), nx = n.getContext('2d'), id = nx.createImageData(128, 128);
      for (let i = 0; i < 128 * 128; i++) { const v = U.fbm((i % 128) / 16, ((i / 128) | 0) / 16, 5, 4); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255; id.data[i * 4 + 3] = Math.max(0, (v - 0.45) * 2.2) * 255; }
      nx.putImageData(id, 0, 0);
      this.cloudTex = n;
      const wv = K.mkCanvas(128, 128), wx = wv.getContext('2d');
      wx.strokeStyle = 'rgba(255,255,255,0.10)'; wx.lineWidth = 2;
      for (let k = 0; k < 18; k++) { const y = (k * 37) % 128, x = (k * 53) % 128; wx.beginPath(); wx.moveTo(x, y); wx.quadraticCurveTo(x + 10, y - 4, x + 22, y); wx.stroke(); }
      this.waveTex = wv;
    }
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.resScale;
      const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
      const odpr = Math.min(window.devicePixelRatio || 1, 2);
      this.cw = W; this.ch = H; this.dpr = dpr; this.odpr = odpr;
      if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; }
      const ow = Math.round(innerWidth * odpr), oh = Math.round(innerHeight * odpr);
      if (this.ov.width !== ow || this.ov.height !== oh) { this.ov.width = ow; this.ov.height = oh; }
      const lw = Math.ceil(W / 2), lh = Math.ceil(H / 2);
      if (this.lc.width !== lw || this.lc.height !== lh) { this.lc.width = lw; this.lc.height = lh; }
      const fw = Math.ceil(W / 3), fh = Math.ceil(H / 3);
      if (this.fc.width !== fw || this.fc.height !== fh) { this.fc.width = fw; this.fc.height = fh; }
    }
    worldToScreen(x, y) { const c = this.cam; return [(x - c.vx) * c.z, (y - c.vy) * c.z]; }
    screenToWorld(sx, sy) { const c = this.cam; return [sx * this.dpr / c.z + c.vx, sy * this.dpr / c.z + c.vy]; }

    // ------------------------------------------------------------ chunks
    chunk(cx, cy) {
      const k = cx * 1000 + cy;
      let c = this.chunks.get(k);
      if (c) { c._t = this.time; return c; }
      c = this.bakeChunk(cx, cy); c._t = this.time;
      this.chunks.set(k, c);
      if (this.chunks.size > 110) {
        let old = null; for (const [kk, v] of this.chunks) if (!old || v._t < old[1]._t) old = [kk, v];
        this.chunks.delete(old[0]);
      }
      return c;
    }
    invalidateTile(tx, ty) { this.chunks.delete(((tx / CH) | 0) * 1000 + ((ty / CH) | 0)); }
    bakeChunk(cx, cy) {
      const w = this.w, W = w.W;
      const c = K.mkCanvas(CPX * CS, CPX * CS), x = c.getContext('2d');
      x.scale(CS, CS);
      const tx0 = cx * CH, ty0 = cy * CH;
      x.translate(-tx0 * TILE, -ty0 * TILE);
      const tAt = (i, j) => (i < 0 || j < 0 || i >= W || j >= w.H ? T.WATER : w.tiles[j * W + i]);
      for (let j = ty0; j < ty0 + CH; j++) for (let i = tx0; i < tx0 + CH; i++) {
        if (i >= W || j >= w.H) continue;
        const t = tAt(i, j), X = i * TILE, Y = j * TILE, b = w.bmap[j * W + i];
        const v = (U.hash2(i, j, 1) * 4) | 0;
        const tint = b >= 0 ? this.btint[b] : null;
        let base = t;
        if (t === T.WALL || t === T.WINDOW || t === T.DOOR) base = b >= 0 ? w.buildings[b].floor : T.CONC;
        if (t === T.FENCE || t === T.GATE) base = [tAt(i - 1, j), tAt(i + 1, j), tAt(i, j - 1), tAt(i, j + 1)].find((q) => q === T.GRASS || q === T.WALK || q === T.CONC) || T.GRASS;
        const ttint = base === T.CARPET ? tint && tint.carpet : base === T.WOOD ? tint && tint.wood : null;
        x.drawImage(K.tileTex(base, v, ttint), X, Y, TILE, TILE);
        // ambient occlusion along walls
        if ((TF[base] & 8 || base === T.WALK || base === T.PLAZA || base === T.GRASS || base === T.CONC) && t !== T.WALL && t !== T.WINDOW) {
          for (const [di, dj, gx, gy, gw, gh] of [[-1, 0, X, Y, 6, TILE], [1, 0, X + TILE - 6, Y, 6, TILE], [0, -1, X, Y, TILE, 6], [0, 1, X, Y + TILE - 6, TILE, 6]]) {
            const n = tAt(i + di, j + dj);
            if (n !== T.WALL && n !== T.WINDOW && n !== T.HEDGE) continue;
            const g = x.createLinearGradient(di > 0 ? X + TILE : di < 0 ? X : 0, dj > 0 ? Y + TILE : dj < 0 ? Y : 0, di > 0 ? X + TILE - 6 : di < 0 ? X + 6 : 0, dj > 0 ? Y + TILE - 6 : dj < 0 ? Y + 6 : 0);
            g.addColorStop(0, 'rgba(0,0,0,0.38)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            x.fillStyle = g; x.fillRect(gx, gy, gw, gh);
          }
        }
        if (t === T.ROAD) this.roadMarks(x, i, j, tAt);
        if (t === T.WALK || t === T.PLAZA) for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          if (tAt(i + di, j + dj) !== T.ROAD) continue;
          x.fillStyle = '#b9b6ae';
          x.fillRect(di > 0 ? X + TILE - 3 : X, dj > 0 ? Y + TILE - 3 : Y, di ? 3 : TILE, dj ? 3 : TILE);
          x.fillStyle = 'rgba(0,0,0,0.3)';
          x.fillRect(di > 0 ? X + TILE : di < 0 ? X - 2 : X, dj > 0 ? Y + TILE : dj < 0 ? Y - 2 : Y, di ? 2 : TILE, dj ? 2 : TILE);
        }
        if ((t === T.QUAY || t === T.DOCK || t === T.GRASS || t === T.PLAZA) && tAt(i, j + 1) === T.WATER) { x.fillStyle = '#e0b000'; x.fillRect(X, Y + TILE - 3, TILE, 2); }
        if (t === T.WATER) for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const n = tAt(i + di, j + dj); if (n === T.WATER || n === T.POOL) continue; x.fillStyle = 'rgba(220,240,255,0.25)'; x.fillRect(di > 0 ? X + TILE - 3 : X, dj > 0 ? Y + TILE - 3 : Y, di ? 3 : TILE, dj ? 3 : TILE); }
        if (t === T.WALL || t === T.WINDOW) this.wallTile(x, i, j, t, b, tAt);
        if (t === T.HEDGE) { x.drawImage(K.tileTex(T.HEDGE, v), X, Y, TILE, TILE); x.strokeStyle = 'rgba(10,30,10,0.6)'; x.lineWidth = 1.5; for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { if (tAt(i + di, j + dj) === T.HEDGE) continue; x.beginPath(); if (di) { x.moveTo(di > 0 ? X + TILE : X, Y); x.lineTo(di > 0 ? X + TILE : X, Y + TILE); } else { x.moveTo(X, dj > 0 ? Y + TILE : Y); x.lineTo(X + TILE, dj > 0 ? Y + TILE : Y); } x.stroke(); } }
        if (t === T.FENCE || t === T.GATE) {
          const horiz = [T.FENCE, T.GATE].includes(tAt(i - 1, j)) || [T.FENCE, T.GATE].includes(tAt(i + 1, j));
          x.strokeStyle = t === T.GATE ? '#2a2a2a' : '#1d1d20'; x.lineWidth = t === T.GATE ? 1.4 : 2;
          if (t === T.GATE) { x.fillStyle = 'rgba(0,0,0,0.2)'; if (horiz) x.fillRect(X, Y + TILE / 2 - 1, TILE, 2); else x.fillRect(X + TILE / 2 - 1, Y, 2, TILE); }
          else {
            x.fillStyle = 'rgba(0,0,0,0.25)'; if (horiz) x.fillRect(X, Y + TILE / 2 + 2, TILE, 3); else x.fillRect(X + TILE / 2 + 2, Y, 3, TILE);
            x.beginPath(); if (horiz) { x.moveTo(X, Y + TILE / 2); x.lineTo(X + TILE, Y + TILE / 2); } else { x.moveTo(X + TILE / 2, Y); x.lineTo(X + TILE / 2, Y + TILE); } x.stroke();
            x.fillStyle = '#121214'; if (horiz) for (let k = 0; k < 4; k++) x.fillRect(X + k * 8 + 2, Y + TILE / 2 - 2.5, 3, 5); else for (let k = 0; k < 4; k++) x.fillRect(X + TILE / 2 - 2.5, Y + k * 8 + 2, 5, 3);
          }
        }
        if (t === T.DOOR) {
          const d = w.doors.get(j * W + i);
          x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(X, Y, TILE, TILE);
          x.fillStyle = b >= 0 ? this.btint[b].wall : '#333';
          if (d && d.horiz) { x.fillRect(X, Y + 6, 4, TILE - 12); x.fillRect(X + TILE - 4, Y + 6, 4, TILE - 12); } else { x.fillRect(X + 6, Y, TILE - 12, 4); x.fillRect(X + 6, Y + TILE - 4, TILE - 12, 4); }
        }
      }
      // props (low ones; tall ones get their base here and their crown later)
      const px0 = tx0 - 3, py0 = ty0 - 3;
      const list = [];
      for (let j = Math.max(0, py0); j < Math.min(w.H, ty0 + CH + 1); j++) for (let i = Math.max(0, px0); i < Math.min(W, tx0 + CH + 1); i++) {
        const pi = w.pmap[j * W + i]; if (pi < 0) continue;
        const p = w.props[pi]; if (!p || list.includes(p)) continue;
        if (p.x + p.w < tx0 || p.y + p.h < ty0 || p.x > tx0 + CH || p.y > ty0 + CH) continue;
        list.push(p);
      }
      list.sort((a, b) => (K.PROPK[b.k].low ? 1 : 0) - (K.PROPK[a.k].low ? 1 : 0));
      for (const p of list) if (p.k !== 'sign' && p.k !== 'boat' && p.k !== 'crane' && p.k !== 'bush') K.drawProp(x, p);
      return c;
    }
    roadMarks(x, i, j, tAt) {
      const P = this.w.city.P, R = this.w.city.R;
      const rx = i % P, ry = j % P, X = i * TILE, Y = j * TILE;
      if (j >= this.w.city.W) return;
      const vert = rx < R && ry >= R, horiz = ry < R && rx >= R;
      x.fillStyle = '#d9b43a';
      if (vert) {
        if (ry === R || ry === P - 1) { x.fillStyle = 'rgba(235,235,230,0.85)'; for (let k = 0; k < 4; k++) x.fillRect(X + 2 + k * 8, Y + 6, 5, TILE - 10); }
        else { if (rx === 1) x.fillRect(X + TILE - 3, Y, 2, TILE); if (rx === 2) x.fillRect(X + 1, Y, 2, TILE); }
        if (ry === R + 1 || ry === P - 2) { x.fillStyle = 'rgba(235,235,230,0.7)'; if (rx === 0 || rx === 1) x.fillRect(X, ry === R + 1 ? Y + 2 : Y + TILE - 5, TILE, 3); }
      } else if (horiz) {
        if (rx === R || rx === P - 1) { x.fillStyle = 'rgba(235,235,230,0.85)'; for (let k = 0; k < 4; k++) x.fillRect(X + 6, Y + 2 + k * 8, TILE - 10, 5); }
        else { if (ry === 1) x.fillRect(X, Y + TILE - 3, TILE, 2); if (ry === 2) x.fillRect(X, Y + 1, TILE, 2); }
      }
      if ((U.hash2(i, j, 99) < 0.012) && (vert || horiz)) { x.fillStyle = '#2a2b2e'; x.beginPath(); x.arc(X + 16, Y + 16, 7, 0, 6.3); x.fill(); x.strokeStyle = '#4a4b50'; x.lineWidth = 1; x.stroke(); }
      for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const n = tAt(i + di, j + dj); if (n === T.ROAD || n === T.WATER) continue; x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(di > 0 ? X + TILE - 4 : X, dj > 0 ? Y + TILE - 4 : Y, di ? 4 : TILE, dj ? 4 : TILE); }
    }
    wallTile(x, i, j, t, b, tAt) {
      const X = i * TILE, Y = j * TILE;
      const isW = (q) => q === T.WALL || q === T.WINDOW || q === T.DOOR;
      const outer = b >= 0 && (i === this.w.buildings[b].x || j === this.w.buildings[b].y || i === this.w.buildings[b].x + this.w.buildings[b].w - 1 || j === this.w.buildings[b].y + this.w.buildings[b].h - 1);
      const col = outer ? this.btint[b].wall : '#b9b2a6';
      x.fillStyle = col; x.fillRect(X, Y, TILE, TILE);
      // bevel only where the wall ends
      x.fillStyle = 'rgba(255,255,255,0.18)';
      if (!isW(tAt(i, j - 1))) x.fillRect(X, Y, TILE, 3);
      if (!isW(tAt(i - 1, j))) x.fillRect(X, Y, 3, TILE);
      x.fillStyle = 'rgba(0,0,0,0.35)';
      if (!isW(tAt(i, j + 1))) x.fillRect(X, Y + TILE - 3, TILE, 3);
      if (!isW(tAt(i + 1, j))) x.fillRect(X + TILE - 3, Y, 3, TILE);
      if (t === T.WINDOW) {
        const horiz = isW(tAt(i - 1, j)) && isW(tAt(i + 1, j));
        x.fillStyle = '#6f9bb8';
        if (horiz) x.fillRect(X + 2, Y + TILE / 2 - 3, TILE - 4, 6); else x.fillRect(X + TILE / 2 - 3, Y + 2, 6, TILE - 4);
        x.fillStyle = 'rgba(255,255,255,0.45)';
        if (horiz) x.fillRect(X + 4, Y + TILE / 2 - 2, 8, 1.5); else x.fillRect(X + TILE / 2 - 2, Y + 4, 1.5, 8);
      }
    }

    // ------------------------------------------------------------ roofs
    roof(b) {
      let c = this.roofs.get(b.id);
      if (c) { c._t = this.time; return c; }
      const Wd = b.w * TILE, H = b.h * TILE;
      c = K.mkCanvas(Wd, H); const x = c.getContext('2d');
      const col = b.color;
      const rng = new K.RNG(b.seed);
      const style = b.roof;
      if (style === 'gable' || style === 'hip') {
        const along = Wd >= H;
        const tile = (y0, h, light) => { x.fillStyle = U.shade(col, light); x.fillRect(0, y0, Wd, h); };
        if (style === 'gable') {
          if (along) { tile(0, H / 2, 1.15); tile(H / 2, H / 2, 0.72); }
          else { x.fillStyle = U.shade(col, 1.15); x.fillRect(0, 0, Wd / 2, H); x.fillStyle = U.shade(col, 0.72); x.fillRect(Wd / 2, 0, Wd / 2, H); }
          x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 1;
          for (let k = 4; k < (along ? H : Wd); k += 5) { x.beginPath(); if (along) { x.moveTo(0, k); x.lineTo(Wd, k); } else { x.moveTo(k, 0); x.lineTo(k, H); } x.stroke(); }
          x.strokeStyle = 'rgba(0,0,0,0.08)';
          for (let k = 3; k < (along ? Wd : H); k += 7) { x.beginPath(); if (along) { x.moveTo(k, 0); x.lineTo(k, H); } else { x.moveTo(0, k); x.lineTo(Wd, k); } x.stroke(); }
          x.fillStyle = U.shade(col, 0.5); if (along) x.fillRect(0, H / 2 - 2, Wd, 4); else x.fillRect(Wd / 2 - 2, 0, 4, H);
        } else {
          const m = Math.min(Wd, H) / 2;
          const tri = (pts, l) => { x.fillStyle = U.shade(col, l); x.beginPath(); pts.forEach(([a, bb], k) => (k ? x.lineTo(a, bb) : x.moveTo(a, bb))); x.closePath(); x.fill(); };
          tri([[0, 0], [Wd, 0], [Wd - m, m], [m, m]], 1.2); tri([[Wd, 0], [Wd, H], [Wd - m, H - m], [Wd - m, m]], 0.82);
          tri([[0, H], [Wd, H], [Wd - m, H - m], [m, H - m]], 0.68); tri([[0, 0], [0, H], [m, H - m], [m, m]], 1.0);
          x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(m, m); x.lineTo(Wd - m, m); x.lineTo(Wd, 0); x.moveTo(0, H); x.lineTo(m, H - m); x.lineTo(Wd - m, H - m); x.lineTo(Wd, H); x.moveTo(m, m); x.lineTo(m, H - m); x.moveTo(Wd - m, m); x.lineTo(Wd - m, H - m); x.stroke();
        }
        // shingles + weathering
        x.globalAlpha = 0.22; x.globalCompositeOperation = 'multiply'; x.drawImage(this.cloudTex, -rng.int(60), -rng.int(60), Wd + 80, H + 80); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
        x.fillStyle = 'rgba(0,0,0,0.12)';
        for (let r = 0; r < (along ? H : Wd); r += 6) for (let k = (r / 6) % 2 ? 0 : 5; k < (along ? Wd : H); k += 10) { if (along) x.fillRect(k, r, 1, 5); else x.fillRect(r, k, 5, 1); }
        x.fillStyle = 'rgba(255,255,255,0.05)'; for (let r = 0; r < (along ? H : Wd); r += 6) { if (along) x.fillRect(0, r, Wd, 1); else x.fillRect(r, 0, 1, H); }
        if (rng.chance(0.7)) { const cx = Wd * (0.2 + rng.next() * 0.6), cy = H * (0.2 + rng.next() * 0.6); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(cx + 3, cy + 4, 10, 10); x.fillStyle = '#6b4a3a'; x.fillRect(cx, cy, 10, 10); x.fillStyle = '#2a2420'; x.fillRect(cx + 2, cy + 2, 6, 6); }
        if (rng.chance(0.4)) { const cx = Wd * (0.2 + rng.next() * 0.6), cy = H * (0.2 + rng.next() * 0.6); x.strokeStyle = '#2b2d31'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + 14, cy - 6); x.moveTo(cx + 4, cy - 1.7); x.lineTo(cx + 6, cy + 5); x.moveTo(cx + 9, cy - 3.8); x.lineTo(cx + 11, cy + 3); x.stroke(); }
      } else {
        // flat / metal
        x.fillStyle = style === 'metal' ? U.shade(col, 1.0) : U.shade(col, 0.95); x.fillRect(0, 0, Wd, H);
        x.globalAlpha = 0.3; x.globalCompositeOperation = 'multiply'; x.drawImage(this.cloudTex, -rng.int(80), -rng.int(80), Wd + 120, H + 120); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
        if (style === 'metal') { x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 2; for (let k = 3; k < Wd; k += 6) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, H); x.stroke(); } x.strokeStyle = 'rgba(255,255,255,0.08)'; x.lineWidth = 1; for (let k = 5; k < Wd; k += 6) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, H); x.stroke(); } }
        else {
          x.globalAlpha = 0.25; x.drawImage(this.cloudTex, 0, 0, Wd, H); x.globalAlpha = 1;
          x.fillStyle = 'rgba(0,0,0,0.12)'; for (let k = 0; k < Wd * H / 90; k++) x.fillRect(rng.next() * Wd, rng.next() * H, 1.2, 1.2);
          x.strokeStyle = U.shade(col, 1.3); x.lineWidth = 5; x.strokeRect(2.5, 2.5, Wd - 5, H - 5);
          x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 1.5; x.strokeRect(5.5, 5.5, Wd - 11, H - 11);
          const n = 1 + rng.int(Math.max(1, (b.w * b.h) / 40));
          for (let k = 0; k < n; k++) {
            const aw = 14 + rng.int(14), ah = 12 + rng.int(10), ax = 10 + rng.next() * (Wd - aw - 20), ay = 10 + rng.next() * (H - ah - 20);
            x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(ax + 4, ay + 5, aw, ah);
            x.fillStyle = '#9da3a8'; x.fillRect(ax, ay, aw, ah); x.strokeStyle = '#6d7378'; x.lineWidth = 1; x.strokeRect(ax + 0.5, ay + 0.5, aw - 1, ah - 1);
            x.fillStyle = '#4a4f54'; x.beginPath(); x.arc(ax + aw / 2, ay + ah / 2, Math.min(aw, ah) / 3, 0, 6.3); x.fill();
          }
          if (b.type === 'hospital') { x.strokeStyle = '#e0b000'; x.lineWidth = 3; x.beginPath(); x.arc(Wd / 2, H / 2, 26, 0, 6.3); x.stroke(); x.fillStyle = '#e0b000'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', Wd / 2, H / 2 + 1); }
          if (b.type === 'office' || b.type === 'hotel') { x.fillStyle = 'rgba(120,170,210,0.35)'; x.fillRect(Wd * 0.55, H * 0.55, Wd * 0.25, H * 0.2); x.strokeStyle = 'rgba(255,255,255,0.2)'; x.strokeRect(Wd * 0.55, H * 0.55, Wd * 0.25, H * 0.2); }
          if (b.type === 'police') { x.fillStyle = '#1d3567'; x.fillRect(Wd / 2 - 30, H / 2 - 10, 60, 20); x.fillStyle = '#fff'; x.font = 'bold 13px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('POLIZEI', Wd / 2, H / 2 + 1); }
        }
      }
      // shop / landmark sign along the main door wall
      const d = b.doors[0];
      if (b.shop || ['club', 'hotel', 'bar', 'police'].includes(b.type) || b.property) {
        const label = b.property && !b.shop ? b.name : (K.SHOPS[b.shop] && K.SHOPS[b.shop].name) || b.name;
        x.font = '600 11px "Oswald", sans-serif';
        const tw = Math.min(Wd - 8, x.measureText(label).width + 14);
        const sy = d.oy > 0 ? H - 18 : d.oy < 0 ? 4 : H / 2 - 7;
        x.fillStyle = 'rgba(10,10,12,0.85)'; x.fillRect(Wd / 2 - tw / 2, sy, tw, 14);
        x.fillStyle = b.type === 'club' ? '#ff4fd8' : b.type === 'bar' ? '#6fb7ff' : b.shop === 'black' ? '#ff7a2a' : '#f2e2b8';
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, Wd / 2, sy + 7.5, tw - 6);
      }
      // outline
      x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 2; x.strokeRect(1, 1, Wd - 2, H - 2);
      c._t = this.time;
      this.roofs.set(b.id, c);
      if (this.roofs.size > 70) { let old = null; for (const [k, v] of this.roofs) if (!old || v._t < old[1]._t) old = [k, v]; this.roofs.delete(old[0]); }
      return c;
    }

    // ------------------------------------------------------------ frame
    updateCamera(dt) {
      const w = this.w, p = w.player, g = this.g, cam = this.cam;
      const car = p.inCar ? w.carOf(p) : null;
      const fx = car ? car.x : p.x, fy = car ? car.y : p.y;
      let look = 0.22;
      const d = K.WEAPONS[w.curWeapon().id];
      if (w.aiming) look = d.scope ? 0.62 : 0.34;
      let tx = fx, ty = fy;
      if (!car && g.input.hasMouse && isFinite(w.aimX) && isFinite(w.aimY)) { tx += U.clamp(w.aimX - p.x, -900, 900) * look; ty += U.clamp(w.aimY - p.y, -600, 600) * look; }
      if (car) { tx += car.vx * 0.35; ty += car.vy * 0.35; }
      const k = Math.min(1, dt * (car ? 5 : 7));
      cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
      if (!isFinite(cam.x) || !isFinite(cam.y)) { cam.x = fx; cam.y = fy; }
      let zm = g.zoomLevel || 1;
      if (car) zm *= U.clamp(1 - car.speed / 900, 0.62, 1);
      if (w.aiming && d.scope) zm *= 0.72;
      if (w.slowmo > 0) zm *= 1.12;
      cam.zoomMul += (zm - cam.zoomMul) * Math.min(1, dt * 3);
      const base = this.cw / (TILE * 28);
      cam.z = base * cam.zoomMul;
      cam.shake = Math.max(0, cam.shake - dt * 2.5);
      const sh = cam.shake * cam.shake * 14 * (g.settings.shake ? 1 : 0);
      cam.vx = cam.x - this.cw / 2 / cam.z + U.rnd(-sh, sh);
      cam.vy = cam.y - this.ch / 2 / cam.z + U.rnd(-sh, sh);
      // keep within the map
      cam.vx = U.clamp(cam.vx, 0, w.W * TILE - this.cw / cam.z);
      cam.vy = U.clamp(cam.vy, 0, w.H * TILE - this.ch / cam.z);
    }
    sun() {
      const h = this.w.hour();
      const t = U.clamp((h - 6) / 14, 0, 1); // 06:00 → 20:00
      const az = Math.PI * (1 - t);          // east → west
      const elev = Math.sin(t * Math.PI);
      const len = 0.3 + (1 - elev) * 0.6;
      return { dx: -Math.cos(az) * len, dy: 0.55 * len, a: this.w.daylight() };
    }
    ambient() {
      const w = this.w, d = w.daylight(), h = w.hour(), wx = w.weather;
      const day = [255, 250, 242], night = [60, 70, 108];
      let c = [U.lerp(night[0], day[0], d), U.lerp(night[1], day[1], d), U.lerp(night[2], day[2], d)];
      const dusk = (h > 16.5 && h < 21.5) || (h > 4.5 && h < 8) ? 1 - Math.abs(d - 0.5) * 2 : 0;
      if (dusk > 0) { const tint = h > 12 ? [255, 150, 110] : [210, 170, 200]; c = c.map((v, i) => U.lerp(v, tint[i] * (0.4 + d * 0.6), dusk * 0.55)); }
      const cl = (wx.cloud * 0.22 + wx.rain * 0.12) * (0.4 + d * 0.6);
      c = c.map((v, i) => v * (1 - cl) + [150, 160, 175][i] * cl * d);
      if (wx.flash > 0) c = c.map((v) => Math.min(255, v + wx.flash * 200));
      return c;
    }

    render(dt) {
      this.time += dt;
      this.resize();
      const w = this.w, g = this.g, ctx = this.ctx, cam = this.cam, p = w.player;
      this.updateCamera(dt);
      this.fx.gore = g.settings.gore ? 1 : 0;
      this.fx.update(dt);
      const z = cam.z;
      const vx0 = cam.vx, vy0 = cam.vy, vx1 = vx0 + this.cw / z, vy1 = vy0 + this.ch / z;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0b1820'; ctx.fillRect(0, 0, this.cw, this.ch);
      ctx.setTransform(z, 0, 0, z, -vx0 * z, -vy0 * z);
      ctx.imageSmoothingEnabled = true;
      // ground
      const cx0 = Math.max(0, Math.floor(vx0 / CPX)), cx1 = Math.floor(vx1 / CPX), cy0 = Math.max(0, Math.floor(vy0 / CPX)), cy1 = Math.floor(vy1 / CPX);
      let baked = 0;
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        if (cx * CH >= w.W || cy * CH >= w.H) continue;
        const key = cx * 1000 + cy;
        if (!this.chunks.has(key) && baked > 3) continue; // spread baking over frames
        if (!this.chunks.has(key)) baked++;
        ctx.drawImage(this.chunk(cx, cy), cx * CPX, cy * CPX, CPX, CPX);
      }
      this.drawWater(ctx, vx0, vy0, vx1, vy1);
      // sun shadows
      const sun = this.sun();
      if (sun.a > 0.05) this.drawShadows(ctx, sun, vx0, vy0, vx1, vy1);
      this.fx.drawDecals(ctx, vx0, vy0, vx1, vy1);
      this.drawDynamicFloor(ctx, vx0, vy0, vx1, vy1);
      this.drawPlants(ctx, vx0, vy0, vx1, vy1);
      // visibility from the player
      this.visT -= dt;
      const ex = p.inCar ? w.carOf(p).x : p.x, ey = p.inCar ? w.carOf(p).y : p.y;
      if (this.visT <= 0) { this.visT = 1 / 30; this.computeVis(ex, ey); }
      const instinct = w.P.instinct;
      // items & throwables
      for (const it of w.items) {
        if (it.taken || it.x < vx0 - 20 || it.x > vx1 + 20 || it.y < vy0 - 20 || it.y > vy1 + 20) continue;
        ctx.save(); ctx.translate(it.x, it.y);
        const pulse = 0.5 + Math.sin(this.time * 4 + it.id) * 0.5;
        ctx.fillStyle = `rgba(255,230,150,${0.12 + pulse * 0.12})`; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 6.3); ctx.fill();
        if (it.kind === 'weapon') { ctx.rotate(it.id); K.drawWeaponTop(ctx, it.wid, it.sup, -8); }
        else if (it.kind === 'cash') { ctx.fillStyle = '#3f8a3a'; ctx.fillRect(-6, -3, 12, 6); ctx.fillStyle = '#d6f0c8'; ctx.fillRect(-2, -1.5, 4, 3); }
        else { ctx.fillStyle = '#c9b98a'; ctx.fillRect(-4, -4, 8, 8); }
        ctx.restore();
      }
      for (const o of w.throwables) {
        ctx.save(); ctx.translate(o.x, o.y - o.z * 0.6);
        if (o.z > 0) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(0, o.z * 0.6, 3, 0, 6.3); ctx.fill(); }
        K.drawWeaponTop(ctx, o.kind, false, -2);
        if (o.kind === 'c4' && Math.floor(this.time * 3) % 2) { ctx.fillStyle = '#ff2020'; ctx.beginPath(); ctx.arc(2, -2, 1.6, 0, 6.3); ctx.fill(); }
        ctx.restore();
      }
      // bodies
      for (const a of w.actors) {
        if (a.removed || a.hidden || a.inCar || (a.alive && a.ko <= 0)) continue;
        if (a.x < vx0 - 40 || a.x > vx1 + 40 || a.y < vy0 - 40 || a.y > vy1 + 40) continue;
        if (!instinct && !this.visible(a)) continue;
        if (!a.alive && a.pool > 0 && a.bloody && this.fx.gore) {
          const s = 8 + a.pool * 26;
          ctx.globalAlpha = 0.9; ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.id);
          ctx.drawImage(this.fx.blob(a.id % 6, '#4e0205'), -s, -s, s * 2, s * 2);
          ctx.restore(); ctx.globalAlpha = 1;
        }
        K.drawBody(ctx, a, w);
      }
      // wrecks & cars
      for (const wr of w.wrecks || []) { if (wr.x < vx0 - 80 || wr.x > vx1 + 80 || wr.y < vy0 - 80 || wr.y > vy1 + 80) continue; K.drawCar(ctx, { x: wr.x, y: wr.y, a: wr.a, l: wr.l, w: wr.w, color: '#1a1714', wreck: true, kind: 'sedan', hp: 0 }, this.time, { sx: sun.dx * 6, sy: sun.dy * 6 }); }
      for (const c of w.cars) {
        if (c.dead && c.fire <= 0) continue;
        if (c.x < vx0 - 80 || c.x > vx1 + 80 || c.y < vy0 - 80 || c.y > vy1 + 80) continue;
        if (!instinct && c.driver !== 'player' && !this.visibleXY(c.x, c.y, c.id + 0.5)) continue;
        K.drawCar(ctx, c, this.time, { sx: 3 + sun.dx * 4, sy: 5 + sun.dy * 4 });
        if (c.hp < 35 && Math.random() < dt * 10) this.fx.smoke(c.x + Math.cos(c.a) * c.l * 0.4, c.y + Math.sin(c.a) * c.l * 0.4, 1, 1);
        if (c.fire > 0 && Math.random() < dt * 30) this.fx.fire(c.x + U.rnd(-14, 14), c.y + U.rnd(-10, 10), 2);
      }
      // people
      const td = w.td;
      for (const a of w.actors) {
        if (a.removed || a.hidden || a.inCar || !a.alive || a.ko > 0) continue;
        if (a.x < vx0 - 30 || a.x > vx1 + 30 || a.y < vy0 - 30 || a.y > vy1 + 30) continue;
        if (a !== p && !this.visible(a)) continue;
        if (a === p && p.hidden) continue;
        K.drawHuman(ctx, a, w, { sx: 2 + sun.dx * 3 * sun.a, sy: 3 + sun.dy * 3 * sun.a, td: a === p && td });
        if (a.bleed > 0 && Math.random() < dt * a.bleed * 3) this.fx.decal('drop', a.x + U.rnd(-5, 5), a.y + U.rnd(-5, 5));
      }
      this.fx.draw(ctx);
      // tall props
      this.drawTall(ctx, vx0, vy0, vx1, vy1);
      // line-of-sight fog (screen space)
      if (g.settings.fov && !g.title) this.drawFog(ctx, instinct);
      // roofs
      this.drawRoofs(ctx, dt, vx0, vy0, vx1, vy1, instinct);
      // lighting
      this.drawLighting(ctx, vx0, vy0, vx1, vy1);
      // weather & glows
      this.drawWeather(ctx, dt, vx0, vy0, vx1, vy1);
      this.drawGlows(ctx, vx0, vy0, vx1, vy1);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!g.post || !g.post.ok) this.vignette(ctx);
      this.drawOverlay(dt);
    }

    drawWater(ctx, vx0, vy0, vx1, vy1) {
      const t = this.time;
      ctx.save();
      for (const r of this.waterRects) {
        const X = r.x * TILE, Y = r.y * TILE, Wd = r.w * TILE;
        if (X > vx1 || X + Wd < vx0 || Y > vy1 || Y + TILE < vy0) continue;
        ctx.save(); ctx.beginPath(); ctx.rect(X, Y, Wd, TILE); ctx.clip();
        const ox = (t * (r.pool ? 6 : 14)) % 128, oy = (t * 5) % 128;
        ctx.globalAlpha = r.pool ? 0.5 : 0.8;
        for (let xx = Math.floor((X - ox) / 128) * 128 + ox - 128; xx < X + Wd; xx += 128) ctx.drawImage(this.waveTex, xx, Math.floor((Y - oy) / 128) * 128 + oy, 128, 128), ctx.drawImage(this.waveTex, xx, Math.floor((Y - oy) / 128) * 128 + oy - 128, 128, 128);
        ctx.restore();
      }
      ctx.restore(); ctx.globalAlpha = 1;
    }
    drawShadows(ctx, sun, vx0, vy0, vx1, vy1) {
      ctx.fillStyle = `rgba(10,12,24,${0.2 * sun.a})`;
      for (const b of this.w.buildings) {
        const h = BH[b.type] || 40;
        const X = b.x * TILE, Y = b.y * TILE, Wd = b.w * TILE, H = b.h * TILE;
        const sx = sun.dx * h, sy = sun.dy * h;
        if (X + Wd + Math.abs(sx) < vx0 || X - Math.abs(sx) > vx1 || Y + H + Math.abs(sy) < vy0 || Y - Math.abs(sy) > vy1) continue;
        const pts = [[X, Y], [X + Wd, Y], [X + Wd, Y + H], [X, Y + H], [X + sx, Y + sy], [X + Wd + sx, Y + sy], [X + Wd + sx, Y + H + sy], [X + sx, Y + H + sy]];
        const hull = convexHull(pts);
        ctx.beginPath(); hull.forEach(([a, c], k) => (k ? ctx.lineTo(a, c) : ctx.moveTo(a, c))); ctx.closePath(); ctx.fill();
      }
    }
    drawDynamicFloor(ctx, vx0, vy0, vx1, vy1) {
      const w = this.w, t = this.time;
      const tx0 = Math.max(0, Math.floor(vx0 / TILE)), tx1 = Math.min(w.W - 1, Math.ceil(vx1 / TILE)), ty0 = Math.max(0, Math.floor(vy0 / TILE)), ty1 = Math.min(w.H - 1, Math.ceil(vy1 / TILE));
      // doors
      for (let j = ty0; j <= ty1; j++) for (let i = tx0; i <= tx1; i++) {
        const d = w.doors.get(j * w.W + i); if (!d) continue;
        const X = i * TILE, Y = j * TILE, o = d.open;
        ctx.save();
        if (d.vault) {   // heavy steel vault door with a wheel
          const vo = d.vaultOpen ? 1 : 0;
          ctx.fillStyle = d.blown ? '#2a2a2c' : '#7d848c';
          if (d.horiz) { ctx.translate(X, Y + TILE / 2); ctx.rotate(vo * 1.5); ctx.fillRect(0, -5, TILE, 10); ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.arc(TILE / 2, 0, 3.5, 0, 6.3); ctx.fill(); }
          else { ctx.translate(X + TILE / 2, Y); ctx.rotate(-vo * 1.5); ctx.fillRect(-5, 0, 10, TILE); ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.arc(0, TILE / 2, 3.5, 0, 6.3); ctx.fill(); }
          ctx.restore(); continue;
        }
        const col = d.locked ? '#4a2a1a' : '#6b4426';
        ctx.fillStyle = col;
        if (d.horiz) { ctx.translate(X + 4, Y + TILE / 2); ctx.rotate(o * 1.45); ctx.fillRect(0, -2.5, TILE - 8, 5); }
        else { ctx.translate(X + TILE / 2, Y + 4); ctx.rotate(-o * 1.45); ctx.fillRect(-2.5, 0, 5, TILE - 8); }
        if (d.locked && !d.picked) { ctx.fillStyle = '#c9a227'; ctx.fillRect(d.horiz ? TILE - 14 : -1, d.horiz ? -1 : TILE - 14, 2, 2); }
        ctx.restore();
        // broken glass shows as dark gaps
      }
      if (w.broken) for (const i of w.broken) { const X = (i % w.W) * TILE, Y = ((i / w.W) | 0) * TILE; if (X < vx0 - 32 || X > vx1 || Y < vy0 - 32 || Y > vy1) continue; ctx.fillStyle = 'rgba(10,15,20,0.75)'; ctx.fillRect(X + 6, Y + 6, TILE - 12, TILE - 12); }
      // gang tags on the turf spots
      if (w.turfSpots) for (const k in w.turfSpots) {
        const sp = w.turfSpots[k], X = (sp.x - 1) * TILE, Y = sp.y * TILE;
        if (X > vx1 || X + 3 * TILE < vx0 || Y > vy1 || Y + TILE < vy0) continue;
        const o = w.turfOwner(k);
        if (!o) { if (w.P.gang) { ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.setLineDash([4, 4]); ctx.strokeRect(X + 3, Y + 4, 3 * TILE - 6, TILE - 8); ctx.setLineDash([]); } continue; }
        const img = this.tagImage(w, o);
        if (img && (img.complete === undefined || img.complete)) { ctx.save(); ctx.globalAlpha = 0.92; ctx.translate(X + 1.5 * TILE, Y + TILE / 2); ctx.drawImage(img, -1.5 * TILE + 2, -TILE / 2 + 2, 3 * TILE - 4, TILE - 4); ctx.restore(); }
      }
      // sale signs, boats, dance floor shimmer
      for (const p of this.tallProps) void p;
      for (const p of w.props) {
        if (!p || (p.k !== 'sign' && p.k !== 'boat' && p.k !== 'dance')) continue;
        const X = p.x * TILE, Y = p.y * TILE;
        if (X > vx1 || X + p.w * TILE < vx0 || Y > vy1 || Y + p.h * TILE < vy0) continue;
        if (p.k === 'sign' && !p.gone) {
          ctx.fillStyle = '#1b1b1f'; ctx.fillRect(X + 15, Y + 14, 2, 14);
          ctx.fillStyle = '#c8102e'; ctx.fillRect(X + 3, Y + 4, 26, 13); ctx.fillStyle = '#fff'; ctx.font = 'bold 5.5px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ZU VERKAUFEN', X + 16, Y + 12.5);
        } else if (p.k === 'boat') {
          const bob = Math.sin(t * 1.2 + p.id) * 1.5;
          ctx.save(); ctx.translate(X + p.w * TILE / 2, Y + p.h * TILE / 2 + bob); ctx.rotate(Math.sin(t * 0.8 + p.id) * 0.03);
          const col = ['#e9e6df', '#1f3b63', '#8a1c22', '#2f5a3a', '#c98a1e', '#555'][p.c];
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(4, 6, 24, 70, 0, 0, 6.3); ctx.fill();
          ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -78); ctx.quadraticCurveTo(26, -40, 24, 60); ctx.lineTo(-24, 60); ctx.quadraticCurveTo(-26, -40, 0, -78); ctx.fill();
          ctx.fillStyle = '#d8d0bf'; ctx.fillRect(-14, -10, 28, 40); ctx.fillStyle = '#5d7d98'; ctx.fillRect(-12, -10, 24, 8);
          ctx.restore();
        } else if (p.k === 'dance' && w.isNight()) {
          for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) { const k = Math.sin(t * 4 + i * 1.3 + j * 2.1); if (k < 0.4) continue; ctx.fillStyle = `hsla(${(t * 80 + (i + j) * 60) % 360},90%,60%,${(k - 0.4) * 0.5})`; ctx.fillRect(X + i * TILE + 2, Y + j * TILE + 2, TILE - 4, TILE - 4); }
        }
      }
    }
    drawPlants(ctx, vx0, vy0, vx1, vy1) {
      const t = this.time;
      for (const pl of this.w.P.plants || []) {
        if (pl.x < vx0 - 30 || pl.x > vx1 + 30 || pl.y < vy0 - 30 || pl.y > vy1 + 30) continue;
        ctx.save(); ctx.translate(pl.x, pl.y);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(2, 3, 11, 10, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#7a4a2c'; ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, 6.3); ctx.fill();
        ctx.fillStyle = pl.w > 30 ? '#2e2016' : '#5a4632'; ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, 6.3); ctx.fill();
        const dead = pl.hp <= 0, dry = pl.w <= 0;
        const sz = 3 + pl.g * 15, sway = Math.sin(t * 1.4 + pl.id) * 0.08;
        const leaf = dead ? '#6b5a3a' : dry ? '#7d8a3a' : pl.g >= 1 ? '#4f8f3a' : '#3f8a3a';
        ctx.rotate(sway);
        for (let k = 0; k < 7; k++) {
          const a = k * 0.9 + pl.id, r = sz * (0.65 + (k % 3) * 0.17);
          ctx.fillStyle = k % 2 ? leaf : U.shade(leaf, 1.25);
          ctx.save(); ctx.rotate(a);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(r * 0.5, -r * 0.22, r, 0); ctx.quadraticCurveTo(r * 0.5, r * 0.22, 0, 0); ctx.fill();
          ctx.restore();
        }
        if (pl.g > 0.55 && !dead) { ctx.fillStyle = pl.g >= 1 ? '#c9e08a' : '#9fc46a'; for (let k = 0; k < 5; k++) { const a = k * 1.3 + pl.id; ctx.beginPath(); ctx.arc(Math.cos(a) * sz * 0.4, Math.sin(a) * sz * 0.4, 1.6 + pl.g * 1.4, 0, 6.3); ctx.fill(); } }
        ctx.restore();
        if (pl.g >= 1 && !dead) { ctx.strokeStyle = `rgba(255,220,120,${0.35 + Math.sin(t * 3) * 0.2})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(pl.x, pl.y, sz + 4, 0, 6.3); ctx.stroke(); }
      }
    }
    drawTall(ctx, vx0, vy0, vx1, vy1) {
      const w = this.w, p = w.player, wind = w.weather.wind;
      const gx0 = Math.floor(vx0 / CPX) - 1, gx1 = Math.floor(vx1 / CPX) + 1, gy0 = Math.floor(vy0 / CPX) - 1, gy1 = Math.floor(vy1 / CPX) + 1;
      for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
        const arr = this.tallGrid.get(gx * 1000 + gy); if (!arr) continue;
        for (const pr of arr) {
          const cx = (pr.x + pr.w / 2) * TILE, cy = (pr.y + pr.h / 2) * TILE;
          const under = Math.hypot(cx - p.x, cy - p.y) < (pr.k === 'tree' ? 22 : 18);
          K.drawTallProp(ctx, pr, this.time, wind, under ? 0.4 : pr.k === 'bush' ? 0.95 : 1);
        }
      }
    }
    drawRoofs(ctx, dt, vx0, vy0, vx1, vy1, instinct) {
      const w = this.w, p = w.player;
      const inside = p.inCar ? -1 : w.bldAt(p.x, p.y);
      for (const b of w.buildings) {
        const X = b.x * TILE, Y = b.y * TILE, Wd = b.w * TILE, H = b.h * TILE;
        let tgt = b.id === inside ? 0 : instinct ? 0.25 : 1;
        // peek through a door you stand in
        if (b.id !== inside && !p.inCar && Math.abs(p.x - (X + Wd / 2)) < Wd / 2 + 20 && Math.abs(p.y - (Y + H / 2)) < H / 2 + 20) { for (const d of b.doors) if (d.outer && Math.hypot((d.x + 0.5) * TILE - p.x, (d.y + 0.5) * TILE - p.y) < 30 && d.open > 0.3) tgt = Math.min(tgt, 0.35); }
        this.roofA[b.id] += (tgt - this.roofA[b.id]) * Math.min(1, dt * 6);
        const a = this.roofA[b.id];
        if (a < 0.02) continue;
        if (X > vx1 || X + Wd < vx0 || Y > vy1 || Y + H < vy0) continue;
        ctx.globalAlpha = a;
        ctx.drawImage(this.roof(b), X, Y, Wd, H);
        if (b.owned) { ctx.strokeStyle = 'rgba(80,220,140,0.75)'; ctx.lineWidth = 3; ctx.strokeRect(X + 1.5, Y + 1.5, Wd - 3, H - 3); }
      }
      ctx.globalAlpha = 1;
    }
    computeVis(x, y) {
      const w = this.w, R = 30 * TILE, n = 420;
      const pts = this.vis.length === n * 2 ? this.vis : (this.vis = new Float32Array(n * 2));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * U.TAU, d = K.rayDist(w, x, y, a, R);
        pts[k * 2] = x + Math.cos(a) * d; pts[k * 2 + 1] = y + Math.sin(a) * d;
      }
      this.visOrigin = [x, y];
      this.npcVis.clear();
    }
    visibleXY(x, y, key) {
      if (!this.g.settings.fov || this.g.title) return true;
      let v = this.npcVis.get(key);
      if (v === undefined) {
        const [ox, oy] = this.visOrigin || [x, y];
        v = Math.hypot(x - ox, y - oy) < 40 || K.los(this.w, ox, oy, x, y) || K.los(this.w, ox, oy, x + 10, y) || K.los(this.w, ox, oy, x - 10, y) || K.los(this.w, ox, oy, x, y - 10);
        this.npcVis.set(key, v);
      }
      return v;
    }
    visible(a) { return this.visibleXY(a.x, a.y, a.id); }
    drawFog(ctx, instinct) {
      const f = this.fctx, fw = this.fc.width, fh = this.fc.height, s = fw / this.cw, z = this.cam.z * s;
      f.setTransform(1, 0, 0, 1, 0, 0);
      f.globalCompositeOperation = 'source-over';
      f.clearRect(0, 0, fw, fh);
      const night = 1 - this.w.daylight();
      f.fillStyle = `rgba(6,8,14,${instinct ? 0.28 : 0.34 + night * 0.18})`;
      f.fillRect(0, 0, fw, fh);
      f.globalCompositeOperation = 'destination-out';
      f.filter = 'blur(4px)';
      f.setTransform(z, 0, 0, z, -this.cam.vx * z, -this.cam.vy * z);
      f.fillStyle = '#000';
      f.beginPath();
      const v = this.vis;
      for (let k = 0; k < v.length; k += 2) (k ? f.lineTo(v[k], v[k + 1]) : f.moveTo(v[k], v[k + 1]));
      f.closePath(); f.fill();
      if (this.visOrigin) { f.beginPath(); f.arc(this.visOrigin[0], this.visOrigin[1], 34, 0, 6.3); f.fill(); }
      f.filter = 'none';
      f.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.fc, 0, 0, this.cw, this.ch);
      ctx.restore();
    }

    drawLighting(ctx, vx0, vy0, vx1, vy1) {
      const w = this.w, l = this.lctx, lw = this.lc.width, lh = this.lc.height, s = lw / this.cw, z = this.cam.z * s;
      const amb = this.ambient();
      const d = w.daylight();
      l.setTransform(1, 0, 0, 1, 0, 0);
      l.globalCompositeOperation = 'source-over'; l.globalAlpha = 1;
      l.fillStyle = `rgb(${amb[0] | 0},${amb[1] | 0},${amb[2] | 0})`; l.fillRect(0, 0, lw, lh);
      l.setTransform(z, 0, 0, z, -this.cam.vx * z, -this.cam.vy * z);
      // cloud shadows drift over the city by day
      if (d > 0.2 && this.g.settings.clouds) {
        l.globalCompositeOperation = 'destination-out';
        l.globalAlpha = 0.28 * d * (0.4 + w.weather.cloud);
        const sc = 1400, ox = (this.time * 18) % sc, oy = (this.time * 7) % sc;
        for (let x = Math.floor((vx0 - ox) / sc) * sc + ox; x < vx1; x += sc) for (let y = Math.floor((vy0 - oy) / sc) * sc + oy; y < vy1; y += sc) l.drawImage(this.cloudTex, x, y, sc, sc);
        l.globalCompositeOperation = 'source-over';
      }
      l.globalCompositeOperation = 'lighter';
      const nightK = 1 - d;
      const pad = 260;
      const inside = w.bldAt(w.player.x, w.player.y);
      if (nightK > 0.05) {
        for (const L of w.lights) {
          if (L.x < vx0 - pad || L.x > vx1 + pad || L.y < vy0 - pad || L.y > vy1 + pad) continue;
          let i = L.i * nightK;
          if (L.kind === 'room') {
            const b = w.buildings[L.bld];
            if (!w.buildingLit(b)) continue;
            i *= 0.95;
            l.save(); l.beginPath(); l.rect(L.clip.x - 2, L.clip.y - 2, L.clip.w + 4, L.clip.h + 4); l.clip();
            l.globalAlpha = Math.min(1, i); l.drawImage(K.lightSprite(L.c, 1), L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
            l.restore();
            continue;
          }
          if (L.flick && Math.random() < 0.08) continue;
          l.globalAlpha = Math.min(1, i);
          l.drawImage(K.lightSprite(L.c), L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
        }
        // window spill
        for (const b of w.buildings) {
          const X = b.x * TILE, Y = b.y * TILE;
          if (X > vx1 + 60 || X + b.w * TILE < vx0 - 60 || Y > vy1 + 60 || Y + b.h * TILE < vy0 - 60) continue;
          if (!w.buildingLit(b)) continue;
          l.globalAlpha = 0.55 * nightK;
          const spr = K.lightSprite([255, 200, 140]);
          for (const i of this.windows[b.id]) { const tx = i % w.W, ty = (i / w.W) | 0; l.drawImage(spr, tx * TILE - 26, ty * TILE - 26, 84, 84); }
        }
        // the shop you are in gets light even on the way out
        void inside;
      }
      // headlights & police lights
      for (const c of w.cars) {
        if (c.dead || c.x < vx0 - 300 || c.x > vx1 + 300 || c.y < vy0 - 300 || c.y > vy1 + 300) continue;
        if (c.lightsOn) {
          l.save(); l.translate(c.x + Math.cos(c.a) * c.l / 2, c.y + Math.sin(c.a) * c.l / 2); l.rotate(c.a);
          l.globalAlpha = 0.85 * nightK; l.drawImage(K.coneSprite(), 0, -70, 260, 140);
          l.restore();
          l.globalAlpha = 0.5 * nightK; const rs = K.lightSprite(c.brake ? [255, 30, 30] : [180, 20, 20]); l.drawImage(rs, c.x - Math.cos(c.a) * c.l / 2 - 26, c.y - Math.sin(c.a) * c.l / 2 - 26, 52, 52);
        }
        if (c.siren) { const on = Math.floor(this.time * 6) % 2; l.globalAlpha = 0.9; l.drawImage(K.lightSprite(on ? [255, 40, 40] : [40, 90, 255]), c.x - 110, c.y - 110, 220, 220); }
      }
      // flashlight
      const p = w.player;
      if (w.P.flashlight && p.alive && !p.inCar) {
        l.save(); l.translate(p.x, p.y); l.rotate(p.angle); l.globalAlpha = 0.95; l.drawImage(K.coneSprite(), 6, -90, 330, 180); l.restore();
      }
      // player always has a faint personal light so the night stays playable
      l.globalAlpha = 0.3 * nightK; l.drawImage(K.lightSprite([200, 210, 255]), p.x - 150, p.y - 150, 300, 300);
      // dynamic lights (muzzle flashes, explosions, fire)
      for (const L of this.fx.lights) { l.globalAlpha = Math.min(1, L.i * (L.life / L.max)); l.drawImage(K.lightSprite(L.c), L.x - L.r, L.y - L.r, L.r * 2, L.r * 2); }
      for (const c of w.cars) if (c.fire > 0) { l.globalAlpha = 0.8; l.drawImage(K.lightSprite([255, 140, 40]), c.x - 130, c.y - 130, 260, 260); }
      l.globalAlpha = 1; l.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(this.lc, 0, 0, this.cw, this.ch);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
    drawWeather(ctx, dt, vx0, vy0, vx1, vy1) {
      const w = this.w, wx = w.weather, g = this.g;
      this.wet = U.clamp(this.wet + (wx.rain > 0.2 ? dt * 0.02 : -dt * 0.004), 0, 1);
      // wet street reflections of lamps
      if (this.wet > 0.05 && w.daylight() < 0.6) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.18 * this.wet;
        for (const L of w.lights) {
          if (L.kind !== 'lamp' && L.kind !== 'neon') continue;
          if (L.x < vx0 || L.x > vx1 || L.y < vy0 || L.y > vy1 + 100) continue;
          ctx.drawImage(K.lightSprite(L.c), L.x - 14, L.y + 4, 28, 90);
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (wx.rain > 0.03 && g.settings.weather) {
        const n = Math.floor(wx.rain * 420 * (this.cw / 1920));
        while (this.rain.length < n) this.rain.push({ x: Math.random() * this.cw, y: Math.random() * this.ch, s: 0.6 + Math.random() * 0.8 });
        this.rain.length = n;
        const ang = 0.25 + wx.wind * 0.3, len = 26 * this.dpr;
        ctx.strokeStyle = 'rgba(190,210,235,0.32)'; ctx.lineWidth = 1 * this.dpr;
        ctx.beginPath();
        for (const r of this.rain) {
          r.y += 1400 * r.s * dt * this.dpr; r.x += 1400 * r.s * dt * Math.sin(ang) * this.dpr;
          if (r.y > this.ch) { r.y = -20; r.x = Math.random() * this.cw; if (Math.random() < 0.35) { const [wx2, wy2] = [r.x / this.cam.z + this.cam.vx, Math.random() * this.ch / this.cam.z + this.cam.vy]; this.fx.add({ k: 'splash', x: wx2, y: wy2, vx: 0, vy: 0, life: 0.35, max: 0.35 }); } }
          if (r.x > this.cw) r.x -= this.cw;
          ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - Math.sin(ang) * len * r.s, r.y - len * r.s);
        }
        ctx.stroke();
      }
      if (wx.fog > 0.04) {
        ctx.globalAlpha = Math.min(0.75, wx.fog * 0.75);
        const sc = 900 * this.cam.z, ox = ((this.time * 12 - this.cam.vx) * this.cam.z) % sc, oy = ((-this.cam.vy) * this.cam.z * 0.9) % sc;
        for (let x = ox - sc; x < this.cw; x += sc) for (let y = oy - sc; y < this.ch; y += sc) ctx.drawImage(this.cloudTex, x, y, sc, sc);
        ctx.fillStyle = `rgba(160,170,180,${wx.fog * 0.18})`; ctx.fillRect(0, 0, this.cw, this.ch);
        ctx.globalAlpha = 1;
      }
      if (wx.flash > 0.5) { ctx.fillStyle = `rgba(230,235,255,${(wx.flash - 0.5) * 0.5})`; ctx.fillRect(0, 0, this.cw, this.ch); }
      ctx.restore();
    }
    drawGlows(ctx, vx0, vy0, vx1, vy1) {
      const w = this.w, nightK = 1 - w.daylight();
      ctx.globalCompositeOperation = 'lighter';
      if (nightK > 0.1) {
        for (const L of w.lights) {
          if (L.kind === 'room' || L.x < vx0 - 40 || L.x > vx1 + 40 || L.y < vy0 - 40 || L.y > vy1 + 40) continue;
          const r = L.kind === 'neon' ? 34 : L.kind === 'pool' ? 0 : 18;
          if (!r) continue;
          ctx.globalAlpha = 0.55 * nightK; ctx.drawImage(K.lightSprite(L.c), L.x - r, L.y - r, r * 2, r * 2);
        }
      }
      for (const L of this.fx.lights) { if (L.r < 60) continue; ctx.globalAlpha = Math.min(1, (L.life / L.max) * 0.7); const r = L.r * 0.35; ctx.drawImage(K.lightSprite(L.c), L.x - r, L.y - r, r * 2, r * 2); }
      for (const c of w.cars) {
        if (c.dead || c.x < vx0 - 80 || c.x > vx1 + 80 || c.y < vy0 - 80 || c.y > vy1 + 80) continue;
        if (c.siren) { const on = Math.floor(this.time * 6) % 2; ctx.globalAlpha = 0.8; ctx.drawImage(K.lightSprite(on ? [255, 40, 50] : [50, 110, 255]), c.x - 30, c.y - 30, 60, 60); }
        if (c.lightsOn) { ctx.globalAlpha = 0.6; const fx = Math.cos(c.a), fy = Math.sin(c.a); for (const s of [-1, 1]) ctx.drawImage(K.lightSprite([255, 250, 220]), c.x + fx * c.l / 2 - fy * s * 10 - 8, c.y + fy * c.l / 2 + fx * s * 10 - 8, 16, 16); }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    vignette(ctx) {
      const g = ctx.createRadialGradient(this.cw / 2, this.ch / 2, this.ch * 0.35, this.cw / 2, this.ch / 2, this.ch * 0.85);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.cw, this.ch);
      const hurt = this.g.hurtFlash || 0;
      if (hurt > 0) { const h = ctx.createRadialGradient(this.cw / 2, this.ch / 2, this.ch * 0.25, this.cw / 2, this.ch / 2, this.ch * 0.8); h.addColorStop(0, 'rgba(120,0,0,0)'); h.addColorStop(1, `rgba(150,0,0,${hurt * 0.6})`); ctx.fillStyle = h; ctx.fillRect(0, 0, this.cw, this.ch); }
    }

    // ------------------------------------------------------------ overlay (crisp, not post-processed)
    drawOverlay(dt) {
      const o = this.octx, w = this.w, p = w.player, g = this.g, s = this.odpr;
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.clearRect(0, 0, this.ov.width, this.ov.height);
      const toS = (x, y) => [((x - this.cam.vx) * this.cam.z) / this.dpr * s, ((y - this.cam.vy) * this.cam.z) / this.dpr * s];
      const zs = this.cam.z / this.dpr * s;
      const instinct = w.P.instinct;
      const tgt = w.targetActor && w.targetActor();
      const c = w.contract;
      // instinct x-ray silhouettes
      if (instinct) {
        for (const a of w.actors) {
          if (a.removed || a.hidden || a.inCar || a === p) continue;
          const [sx, sy] = toS(a.x, a.y);
          if (sx < -20 || sy < -20 || sx > this.ov.width + 20 || sy > this.ov.height + 20) continue;
          const col = a === tgt ? '255,40,40' : !a.alive ? '150,150,150' : a.kind === 'guard' || a.kind === 'bodyguard' || a.kind === 'gang' ? '255,190,40' : a.kind === 'cop' ? '80,150,255' : a.enforcer ? '255,120,40' : '230,230,230';
          o.fillStyle = `rgba(${col},0.18)`; o.strokeStyle = `rgba(${col},0.9)`; o.lineWidth = 1.5 * s;
          o.beginPath(); o.arc(sx, sy, 11 * zs, 0, 6.3); o.fill(); o.stroke();
          if (a.alive && a.ko <= 0) { o.beginPath(); o.moveTo(sx, sy); o.lineTo(sx + Math.cos(a.angle) * 22 * zs, sy + Math.sin(a.angle) * 22 * zs); o.stroke(); }
          if (a.enforcer && a.alive) { o.fillStyle = 'rgba(255,140,40,0.95)'; o.font = `${10 * s}px sans-serif`; o.textAlign = 'center'; o.fillText('●', sx, sy - 16 * zs); }
        }
        // hiding spots
        for (const pr of w.props) {
          if (!pr || !K.PROPK[pr.k].hide) continue;
          const [sx, sy] = toS((pr.x + pr.w / 2) * TILE, (pr.y + pr.h / 2) * TILE);
          if (sx < 0 || sy < 0 || sx > this.ov.width || sy > this.ov.height) continue;
          o.strokeStyle = 'rgba(120,220,255,0.6)'; o.lineWidth = 1.2 * s; o.strokeRect(sx - pr.w * 16 * zs, sy - pr.h * 16 * zs, pr.w * 32 * zs, pr.h * 32 * zs);
        }
      }
      // noise rings
      for (const r of this.fx.rings) {
        const [sx, sy] = toS(r.x, r.y), k = 1 - r.life / r.max;
        o.strokeStyle = r.col.replace('A', ((1 - k) * 0.22).toFixed(3)); o.lineWidth = 1.2 * s;
        o.beginPath(); o.arc(sx, sy, r.r * zs * (0.15 + k * 0.85), 0, 6.3); o.stroke();
      }
      // suspicion meters & barks
      for (const a of w.actors) {
        if (a.removed || a.hidden || a.inCar || !a.alive || a === p) continue;
        const [sx, sy] = toS(a.x, a.y);
        if (sx < -40 || sy < -40 || sx > this.ov.width + 40 || sy > this.ov.height + 40) continue;
        const vis = this.visible(a);
        if (!vis && !instinct) continue;
        const hy = sy - 22 * zs;
        const st = a.state;
        if (a.ko > 0) { if (Math.floor(this.time * 1.5 + a.id) % 3 === 0) { o.fillStyle = 'rgba(200,220,255,0.8)'; o.font = `bold ${11 * s}px sans-serif`; o.textAlign = 'center'; o.fillText('z', sx + 8 * s, hy + 6 * s); } continue; }
        if (a.kind === 'crew') {   // your people: green chevron + name
          o.fillStyle = st === 'hostile' ? '#ffd34d' : '#3ddc84'; o.beginPath(); o.moveTo(sx - 5 * s, hy - 3 * s); o.lineTo(sx, hy + 3 * s); o.lineTo(sx + 5 * s, hy - 3 * s); o.closePath(); o.fill();
          o.font = `600 ${9.5 * s}px "Oswald", sans-serif`; o.textAlign = 'center'; o.textBaseline = 'bottom'; o.fillStyle = 'rgba(220,255,230,0.85)'; o.fillText(a.name.split(' ')[0], sx, hy - 5 * s);
          if (a.bark && g.settings.barks) this.bubble(o, sx, hy - 20 * s, a.bark.text, Math.min(1, a.bark.t * 2), a.kind, s);
          continue;
        }
        if (st === 'hostile' || a.susp > 0.04 || st === 'warn' || st === 'search' || st === 'investigate') {
          const k = st === 'hostile' ? 1 : a.susp;
          const col = st === 'hostile' ? '#ff2a2a' : st === 'search' ? '#ffb000' : k > 0.66 ? '#ff7a00' : '#f2f2f2';
          const R = 9 * s;
          o.lineWidth = 2.6 * s; o.strokeStyle = 'rgba(0,0,0,0.55)'; o.beginPath(); o.arc(sx, hy, R, 0, 6.3); o.stroke();
          o.strokeStyle = col; o.beginPath(); o.arc(sx, hy, R, -Math.PI / 2, -Math.PI / 2 + U.TAU * Math.min(1, k)); o.stroke();
          o.fillStyle = col; o.font = `900 ${12 * s}px "Oswald", sans-serif`; o.textAlign = 'center'; o.textBaseline = 'middle';
          o.fillText(st === 'hostile' || k >= 1 ? '!' : '?', sx, hy + 0.5 * s);
        }
        if (a.reportT > 0) { o.fillStyle = '#6fd0ff'; o.font = `${12 * s}px sans-serif`; o.textAlign = 'center'; o.fillText('📞', sx + 14 * s, hy); }
        if (a.bark && g.settings.barks) this.bubble(o, sx, hy - 16 * s, a.bark.text, Math.min(1, a.bark.t * 2), a.kind, s);
      }
      if (p.bark) { const [sx, sy] = toS(p.x, p.y); this.bubble(o, sx, sy - 34 * zs, p.bark.text, Math.min(1, p.bark.t * 2), 'player', s); }
      // target marker
      if (tgt && tgt.alive && (c.intel || instinct)) {
        const [sx, sy] = toS(tgt.x, tgt.y);
        const onScreen = sx > 20 && sy > 20 && sx < this.ov.width - 20 && sy < this.ov.height - 20;
        if (onScreen && (instinct || this.visible(tgt))) {
          const bob = Math.sin(this.time * 4) * 3 * s;
          o.fillStyle = '#ff2030'; o.beginPath(); o.moveTo(sx, sy - 30 * zs + bob); o.lineTo(sx - 7 * s, sy - 30 * zs - 9 * s + bob); o.lineTo(sx + 7 * s, sy - 30 * zs - 9 * s + bob); o.closePath(); o.fill();
          o.font = `600 ${10 * s}px "Oswald", sans-serif`; o.textAlign = 'center'; o.fillText('ZIEL', sx, sy - 30 * zs - 15 * s + bob);
        } else if (!onScreen && c.intel) this.edgeArrow(o, sx, sy, '#ff2030', 'ZIEL', s);
      }
      if (g.waypoint) { const [sx, sy] = toS(g.waypoint.x, g.waypoint.y); const onScreen = sx > 0 && sy > 0 && sx < this.ov.width && sy < this.ov.height; if (!onScreen) this.edgeArrow(o, sx, sy, '#ffd34d', 'WP', s); else { o.strokeStyle = '#ffd34d'; o.lineWidth = 2 * s; o.beginPath(); o.arc(sx, sy, 10 * s + Math.sin(this.time * 4) * 3 * s, 0, 6.3); o.stroke(); } }
      // floats
      for (const f of this.fx.floats) {
        const [sx, sy] = toS(f.x, f.y), a = Math.min(1, f.life / f.max * 2);
        o.globalAlpha = a; o.font = `800 ${(f.big ? 16 : 12) * s}px "Oswald", sans-serif`; o.textAlign = 'center'; o.lineWidth = 3 * s; o.strokeStyle = 'rgba(0,0,0,0.75)'; o.strokeText(f.text, sx, sy); o.fillStyle = f.col; o.fillText(f.text, sx, sy);
        o.globalAlpha = 1;
      }
      // thirsty plants
      for (const pl of w.P.plants || []) {
        if (pl.w > 25 || pl.g >= 1 || pl.hp <= 0) continue;
        const [sx, sy] = toS(pl.x, pl.y);
        if (sx < 0 || sy < 0 || sx > this.ov.width || sy > this.ov.height) continue;
        o.font = `${14 * s}px sans-serif`; o.textAlign = 'center'; o.globalAlpha = 0.6 + Math.sin(this.time * 4) * 0.4; o.fillText('💧', sx, sy - 18 * zs); o.globalAlpha = 1;
      }
      // damage direction
      const [px, py] = toS(p.x, p.y);
      this.dmgDirs = this.dmgDirs.filter((d) => (d.t -= dt) > 0);
      for (const d of this.dmgDirs) { o.strokeStyle = `rgba(255,30,30,${d.t})`; o.lineWidth = 5 * s; o.beginPath(); o.arc(px, py, 60 * s, d.a - 0.35, d.a + 0.35); o.stroke(); }
      // action progress
      if (w.action) { const k = w.action.t / w.action.dur; o.strokeStyle = 'rgba(0,0,0,0.6)'; o.lineWidth = 6 * s; o.beginPath(); o.arc(px, py, 26 * s, 0, 6.3); o.stroke(); o.strokeStyle = '#f2e2b8'; o.lineWidth = 4 * s; o.beginPath(); o.arc(px, py, 26 * s, -Math.PI / 2, -Math.PI / 2 + U.TAU * k); o.stroke(); }
      if (w.td) { const k = w.td.t / w.td.dur; o.strokeStyle = '#ff3040'; o.lineWidth = 4 * s; o.beginPath(); o.arc(px, py, 28 * s, -Math.PI / 2, -Math.PI / 2 + U.TAU * k); o.stroke(); }
      if (w.arrestProgress > 0.02 && w.wanted > 0) { o.strokeStyle = '#4f9bff'; o.lineWidth = 4 * s; o.beginPath(); o.arc(px, py, 32 * s, -Math.PI / 2, -Math.PI / 2 + U.TAU * w.arrestProgress); o.stroke(); }
      // crosshair
      if (g.input.hasMouse && p.alive && !g.paused) this.crosshair(o, s);
    }
    /** gang tags: procedural lettering for NPC gangs, the player's freehand PNG for their crew */
    tagImage(w, o) {
      this.tagCache = this.tagCache || {};
      const key = o === 'player' ? 'player:' + ((w.P.gang && w.P.gang.tag) || '').length + ':' + (w.P.gang && w.P.gang.name) : o;
      if (this.tagCache[key]) return this.tagCache[key];
      if (o === 'player' && w.P.gang && w.P.gang.tag) { const im = new Image(); im.src = w.P.gang.tag; this.tagCache[key] = im; return im; }
      const cv = document.createElement('canvas'); cv.width = 192; cv.height = 64;
      const x = cv.getContext('2d'), col = w.turfColor(o) || '#fff';
      const txt = o === 'player' ? (w.P.gang ? w.P.gang.name : 'CREW') : K.GANGS[o].short;
      let seed = 0; for (const ch of txt) seed = (seed * 31 + ch.charCodeAt(0)) & 0xffff;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      x.translate(96, 34); x.rotate(-0.08 + rnd() * 0.06); x.transform(1, 0, -0.25, 1, 0, 0);
      const fs = Math.min(40, 300 / Math.max(4, txt.length));
      x.font = `900 ${fs}px Impact, "Arial Black", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineJoin = 'round'; x.strokeStyle = '#0b0b0d'; x.lineWidth = 9; x.strokeText(txt, 0, 0);
      x.strokeStyle = '#f4f4f4'; x.lineWidth = 4; x.strokeText(txt, 0, 0);
      x.fillStyle = col; x.fillText(txt, 0, 0);
      x.fillStyle = col; for (let k = 0; k < 6; k++) { const dx = (rnd() - 0.5) * fs * txt.length * 0.5; x.fillRect(dx, fs * 0.3, 2, 6 + rnd() * 14); }
      x.strokeStyle = col; x.lineWidth = 2; x.beginPath(); x.moveTo(-fs * txt.length * 0.3, fs * 0.55); x.quadraticCurveTo(0, fs * 0.8, fs * txt.length * 0.32, fs * 0.45); x.stroke();
      this.tagCache[key] = cv;
      return cv;
    }
    bubble(o, x, y, text, a, kind, s) {
      o.globalAlpha = a;
      o.font = `500 ${11 * s}px "Inter", sans-serif`;
      const tw = Math.min(220 * s, o.measureText(text).width) + 14 * s, h = 20 * s;
      o.fillStyle = kind === 'cop' ? 'rgba(20,40,90,0.88)' : kind === 'guard' || kind === 'bodyguard' || kind === 'gang' ? 'rgba(60,40,10,0.88)' : 'rgba(12,12,16,0.82)';
      o.beginPath(); o.roundRect(x - tw / 2, y - h, tw, h, 6 * s); o.fill();
      o.beginPath(); o.moveTo(x - 4 * s, y); o.lineTo(x + 4 * s, y); o.lineTo(x, y + 5 * s); o.fill();
      o.fillStyle = '#f4efe6'; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillText(text, x, y - h / 2, 210 * s);
      o.globalAlpha = 1;
    }
    edgeArrow(o, sx, sy, col, label, s) {
      const cx = this.ov.width / 2, cy = this.ov.height / 2;
      const a = Math.atan2(sy - cy, sx - cx);
      const m = 40 * s;
      const r = Math.min((this.ov.width / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (this.ov.height / 2 - m) / Math.abs(Math.sin(a) || 1e-6));
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      o.save(); o.translate(x, y); o.rotate(a);
      o.fillStyle = col; o.beginPath(); o.moveTo(14 * s, 0); o.lineTo(-6 * s, -9 * s); o.lineTo(-6 * s, 9 * s); o.closePath(); o.fill();
      o.restore();
      o.fillStyle = col; o.font = `600 ${10 * s}px "Oswald", sans-serif`; o.textAlign = 'center'; o.fillText(label, x - Math.cos(a) * 20 * s, y - Math.sin(a) * 20 * s);
    }
    crosshair(o, s) {
      const g = this.g, w = this.w, inp = g.input;
      const x = inp.mx * s, y = inp.my * s;
      const d = K.WEAPONS[w.curWeapon().id];
      const p = w.player;
      if (d.type === 'gun') {
        let spread = d.spread * (1 + Math.min(1.6, p.speed / 110)) * (p.crouch ? 0.72 : 1) * (w.aiming ? (d.scope ? 0.25 : 0.55) : 1) + w.P.recoil;
        const dist = Math.hypot(w.aimX - p.x, w.aimY - p.y) * this.cam.z / this.dpr * s;
        const r = Math.max(6 * s, Math.tan(spread) * dist * 1.6);
        const col = this.hitMark > 0 ? '#ff3a3a' : 'rgba(255,255,255,0.92)';
        o.strokeStyle = 'rgba(0,0,0,0.6)'; o.lineWidth = 3 * s;
        const seg = (a) => { o.beginPath(); o.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); o.lineTo(x + Math.cos(a) * (r + 8 * s), y + Math.sin(a) * (r + 8 * s)); o.stroke(); };
        for (let k = 0; k < 4; k++) seg(k * Math.PI / 2);
        o.strokeStyle = col; o.lineWidth = 1.5 * s; for (let k = 0; k < 4; k++) seg(k * Math.PI / 2);
        o.fillStyle = col; o.beginPath(); o.arc(x, y, 1.6 * s, 0, 6.3); o.fill();
        if (d.scope && w.aiming) { o.strokeStyle = 'rgba(255,40,40,0.8)'; o.lineWidth = 1 * s; o.beginPath(); o.arc(x, y, 34 * s, 0, 6.3); o.stroke(); }
        // laser line when aiming
        if (w.aiming) { const [px, py] = [((p.x - this.cam.vx) * this.cam.z) / this.dpr * s, ((p.y - this.cam.vy) * this.cam.z) / this.dpr * s]; o.strokeStyle = 'rgba(255,40,40,0.28)'; o.lineWidth = 1 * s; o.beginPath(); o.moveTo(px, py); o.lineTo(x, y); o.stroke(); }
        const wi = w.curWeapon();
        if (wi.mag === 0 && (w.P.ammo[d.ammo] || 0) > 0) { o.fillStyle = '#ffb000'; o.font = `700 ${10 * s}px "Oswald", sans-serif`; o.textAlign = 'center'; o.fillText('R — NACHLADEN', x, y + 26 * s); }
      } else {
        o.strokeStyle = 'rgba(255,255,255,0.85)'; o.lineWidth = 1.5 * s;
        o.beginPath(); o.arc(x, y, 7 * s, 0, 6.3); o.stroke();
        o.fillStyle = 'rgba(255,255,255,0.9)'; o.beginPath(); o.arc(x, y, 1.5 * s, 0, 6.3); o.fill();
      }
      if (this.hitMark > 0) { const r = 10 * s; o.strokeStyle = `rgba(255,255,255,${this.hitMark * 2})`; o.lineWidth = 2 * s; o.beginPath(); o.moveTo(x - r, y - r); o.lineTo(x - r / 2, y - r / 2); o.moveTo(x + r, y - r); o.lineTo(x + r / 2, y - r / 2); o.moveTo(x - r, y + r); o.lineTo(x - r / 2, y + r / 2); o.moveTo(x + r, y + r); o.lineTo(x + r / 2, y + r / 2); o.stroke(); }
      this.hitMark = Math.max(0, this.hitMark - 0.016);
    }

    // ------------------------------------------------------------ world events → visuals
    onEvent(e) {
      const fx = this.fx, w = this.w, g = this.g, p = w.player;
      switch (e.type) {
        case 'shot': {
          const d = K.WEAPONS[e.w];
          if (!e.sup) fx.light(e.x, e.y, d.cls === 'shotgun' || d.cls === 'rifle' ? 200 : 150, [255, 200, 120], 1, 0.07);
          else fx.light(e.x, e.y, 50, [255, 220, 160], 0.4, 0.05);
          fx.add({ k: 'smoke', x: e.x, y: e.y, vx: Math.cos(e.a) * 40, vy: Math.sin(e.a) * 40, life: 0.5, max: 0.5, size: e.sup ? 2 : 4, grow: 20, col: [180, 180, 175], a: 0.35 });
          if (!e.sup) fx.sparks(e.x, e.y, e.a + Math.PI, 3, [255, 220, 140]);
          if (d.cls !== 'shotgun' || Math.random() < 0.5) fx.shell(e.x - Math.cos(e.a) * 10, e.y - Math.sin(e.a) * 10, e.a);
          if (e.player) { this.cam.shake = Math.min(1, this.cam.shake + d.recoil * 2.2); }
          if (!e.sup) fx.ring(e.x, e.y, d.noise * TILE * (1 - w.weather.rain * 0.25), 'rgba(255,90,60,A)', 0.8);
          else fx.ring(e.x, e.y, 3 * TILE, 'rgba(160,200,255,A)', 0.6);
          break;
        }
        case 'tracer': fx.tracers.push({ x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, life: 0.05, max: 0.05, w: K.WEAPONS[e.w] && K.WEAPONS[e.w].cls === 'sniper' ? 2.2 : 1.2 }); break;
        case 'impact':
          fx.sparks(e.x, e.y, e.a, e.mat === 'metal' ? 8 : 4, e.mat === 'metal' ? [255, 230, 160] : [255, 200, 130]);
          fx.dust(e.x, e.y, e.mat === 'wood' ? 3 : 2, e.mat === 'wood' ? [140, 100, 60] : [150, 145, 135]);
          if (e.mat !== 'metal') fx.decal('hole', e.x, e.y);
          break;
        case 'glass': fx.glass(e.x, e.y, 14); fx.decal('glass', e.x, e.y); break;
        case 'sparks': fx.sparks(e.x, e.y, Math.random() * 6.3, 4); break;
        case 'spraymist': { const h = parseInt((e.col || '#ffffff').slice(1), 16); fx.dust(e.x + U.rnd(-14, 14), e.y + U.rnd(-6, 6), 1, [(h >> 16) & 255, (h >> 8) & 255, h & 255]); break; }
        case 'turf': this.tagCache = null; break;
        case 'hurt': {
          const a = e.a != null ? e.a : Math.random() * 6.3;
          if (e.kind === 'bullet' || e.kind === 'melee' || e.kind === 'explosion' || e.kind === 'car') {
            const n = e.blunt ? 3 : Math.min(26, 6 + e.dmg * 0.3);
            fx.blood(e.x, e.y, a, n, e.head ? 1.4 : 1);
            if (e.kind === 'bullet' && g.settings.gore) fx.decal('streak', e.x, e.y, { a, len: 18 + e.dmg * 0.6 });
            if (e.head) { fx.blood(e.x, e.y, a, 18, 1.8, 0.35); fx.float(e.x, e.y - 20, 'KOPFSCHUSS', '#ff4040'); }
          } else if (e.kind === 'fist') fx.dust(e.x, e.y, 2, [200, 190, 180]);
          if (e.player) {
            g.hurtFlash = Math.min(1, (g.hurtFlash || 0) + e.dmg / 40);
            this.cam.shake = Math.min(1, this.cam.shake + 0.35);
            const src = e.a != null ? e.a + Math.PI : null;
            if (src != null) this.dmgDirs.push({ a: src, t: 1 });
          } else if (e.kind === 'bullet' || e.kind === 'melee' || e.kind === 'fist') {
            const att = w.byId.get(e.id); if (att && att.lastHitBy === p.id) this.hitMark = 0.3;
          }
          break;
        }
        case 'death':
          if (e.bloody) { fx.blood(e.x, e.y, e.a, e.head ? 30 : 18, 1.2); fx.decal('blood', e.x, e.y, { s: 16 }); }
          if (e.gore && g.settings.gore) { fx.gibs(e.x, e.y, e.a, 10); fx.decal('blood', e.x + Math.cos(e.a) * 26, e.y + Math.sin(e.a) * 26, { s: 26 }); }
          if (e.by === p.id || (w.byId.get(e.id) && w.byId.get(e.id).killer === p.id)) this.hitMark = 0.5;
          break;
        case 'corpseHit': fx.blood(e.x, e.y, e.a || 0, e.gore ? 20 : 6, 1); break;
        case 'gib': fx.gibs(e.x, e.y, e.a, 8); break;
        case 'explosion':
          fx.light(e.x, e.y, e.r * 3.5, [255, 160, 70], 1.6, 0.6);
          fx.fire(e.x, e.y, 40); fx.smoke(e.x, e.y, 26, 1); fx.sparks(e.x, e.y, 0, 30, [255, 180, 80]);
          fx.decal('scorch', e.x, e.y, { s: e.r * 0.8 });
          this.cam.shake = 1;
          g.flash = 1;
          break;
        case 'skid': fx.decal('skid', e.x, e.y, e); if (Math.random() < 0.3) fx.dust(e.x - Math.cos(e.a) * e.l * 0.35, e.y - Math.sin(e.a) * e.l * 0.35, 1, [190, 190, 190]); break;
        case 'crash': fx.sparks(e.x, e.y, Math.random() * 6.3, 10); fx.glass(e.x, e.y, 5); if (e.player) this.cam.shake = Math.min(1, this.cam.shake + e.v / 500); break;
        case 'carFire': fx.fire(e.x + U.rnd(-12, 12), e.y + U.rnd(-8, 8), 2); fx.smoke(e.x, e.y, 1, 1); break;
        case 'drip': fx.decal('drop', e.x + U.rnd(-4, 4), e.y + U.rnd(-4, 4), { s: 1 + Math.random() * 1.5 }); break;
        case 'footprint': fx.decal('foot', e.x, e.y, e); break;
        case 'smear': fx.decal('smear', e.x, e.y, e); break;
        case 'meleeHit': if (e.sharp) fx.blood(e.x, e.y, e.a, 10, 0.8); this.cam.shake = Math.min(1, this.cam.shake + 0.15); break;
        case 'noiseRing': break;
        case 'coinLand': fx.ring(e.x, e.y, K.WEAPONS.coin.noise * TILE, 'rgba(255,220,120,A)', 0.9); break;
        case 'hideBody': fx.dust(e.x, e.y, 4); break;
        case 'takedown': if (e.kind === 'knife') fx.blood(e.x, e.y, Math.random() * 6.3, 16, 0.8); break;
        case 'xp': if (e.n >= 8) fx.float(p.x, p.y - 30, `+${e.n} XP  ${e.why || ''}`, '#9fd2ff'); break;
        case 'targetDown': fx.float(e.x, e.y - 34, 'ZIEL ELIMINIERT', '#ff3a3a', true); break;
      }
    }
  }

  function convexHull(pts) {
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    up.pop(); lo.pop();
    return lo.concat(up);
  }

  K.Renderer = Renderer;
})(globalThis.K = globalThis.K || {});
