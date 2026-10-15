/* RDE // KONTRAKT — renderer: baked ground chunks, roofs, shadows, line-of-sight fog, lightmap, weather, overlay */
(function (K) {
  'use strict';
  const tr = K.tr;   // translate (K.T is the tile table)
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
      this.skyCov = -1;
      this.fogTex = this.mkSkyTex(256, 3, 5, 91, (v) => { const e = U.clamp((v - 0.36) * 2.8, 0, 1); return e * e * (3 - 2 * e) * 0.95; });
      const wv = K.mkCanvas(128, 128), wx = wv.getContext('2d');
      wx.strokeStyle = 'rgba(255,255,255,0.10)'; wx.lineWidth = 2;
      for (let k = 0; k < 18; k++) { const y = (k * 37) % 128, x = (k * 53) % 128; wx.beginPath(); wx.moveTo(x, y); wx.quadraticCurveTo(x + 10, y - 4, x + 22, y); wx.stroke(); }
      this.waveTex = wv;
    }
    /** seamless fbm sky texture: every octave wraps on the texture edge, so tiling shows no seams */
    mkSkyTex(sz, base, oct, seed, f) {
      const c = K.mkCanvas(sz, sz), x = c.getContext('2d'), id = x.createImageData(sz, sz);
      const h = U.hash2;
      const pn = (px, py, per, s) => {
        const xi = Math.floor(px), yi = Math.floor(py), xf = px - xi, yf = py - yi;
        const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const x0 = ((xi % per) + per) % per, y0 = ((yi % per) + per) % per, x1 = (x0 + 1) % per, y1 = (y0 + 1) % per;
        const A = h(x0, y0, s), B = h(x1, y0, s), C = h(x0, y1, s), D = h(x1, y1, s);
        return A + (B - A) * u + (C - A) * v + (A - B - C + D) * u * v;
      };
      for (let j = 0; j < sz; j++) for (let i = 0; i < sz; i++) {
        let v = 0, a = 0.5, per = base, norm = 0;
        for (let o = 0; o < oct; o++) { v += pn((i / sz) * per, (j / sz) * per, per, seed + o * 31) * a; norm += a; a *= 0.5; per *= 2; }
        const k = (j * sz + i) * 4;
        id.data[k] = id.data[k + 1] = id.data[k + 2] = 255; id.data[k + 3] = f(v / norm) * 255;
      }
      x.putImageData(id, 0, 0);
      return c;
    }
    /** mist coloured for the light level: pale grey by day, a dim blue-grey at night (it must not glow in the dark) */
    fogTint(br) {
      const q = Math.round(br * 8) / 8;
      if (q !== this.fogQ) {
        this.fogQ = q;
        if (!this.fogCol) this.fogCol = K.mkCanvas(256, 256);
        const x = this.fogCol.getContext('2d');
        x.globalCompositeOperation = 'copy'; x.drawImage(this.fogTex, 0, 0);
        x.globalCompositeOperation = 'source-in'; x.fillStyle = `rgb(${200 * q | 0},${206 * q | 0},${214 * q | 0})`; x.fillRect(0, 0, 256, 256);
        x.globalCompositeOperation = 'source-over';
      }
      return this.fogCol;
    }
    /** cloud shadow mask for the current coverage; rebuilt only when coverage moves noticeably */
    cloudShadowTex(cov) {
      const q = Math.round(cov * 10) / 10;
      if (q !== this.skyCov) {
        this.skyCov = q;
        const t = 0.66 - q * 0.36;
        this.skyTex = this.mkSkyTex(256, 3, 6, 47, (v) => { const e = U.clamp((v - t) / 0.16, 0, 1); return e * e * (3 - 2 * e) * (0.65 + 0.35 * U.clamp((v - t) / 0.3, 0, 1)); });
        // tint: a cool shadow colour, drawn over the lightmap
        const x = this.skyTex.getContext('2d'); x.globalCompositeOperation = 'source-in'; x.fillStyle = 'rgb(62,70,86)'; x.fillRect(0, 0, 256, 256);
      }
      return this.skyTex;
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
          if (b.type === 'police') { x.fillStyle = '#1d3567'; x.fillRect(Wd / 2 - 30, H / 2 - 10, 60, 20); x.fillStyle = '#fff'; x.font = 'bold 13px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(tr('POLICE'), Wd / 2, H / 2 + 1); }
        }
      }
      // shop / landmark sign along the main door wall
      const d = b.doors[0];
      if (b.shop || ['club', 'hotel', 'bar', 'police'].includes(b.type) || b.property) {
        const label = (b.property && !b.shop) || ['beachclub', 'stripclub', 'gas', 'autohaus', 'werkstatt'].includes(b.type) ? b.name : (K.SHOPS[b.shop] && K.SHOPS[b.shop].name) || b.name;
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
      if (w.aiming) look = d.scope ? (d.scope > 1 ? 0.86 : 0.72) : 0.34;
      let tx = fx, ty = fy;
      if (!car && g.input.hasMouse && isFinite(w.aimX) && isFinite(w.aimY)) { const lim = w.scoped ? 1800 : 900; tx += U.clamp(w.aimX - p.x, -lim, lim) * look; ty += U.clamp(w.aimY - p.y, -lim * 0.66, lim * 0.66) * look; }
      if (car) { tx += car.vx * 0.35; ty += car.vy * 0.35; }
      const k = Math.min(1, dt * (car ? 5 : 7));
      cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
      if (!isFinite(cam.x) || !isFinite(cam.y)) { cam.x = fx; cam.y = fy; }
      let zm = g.zoomLevel || 1;
      if (car) zm *= U.clamp(1 - car.speed / 900, 0.62, 1);
      if (w.aiming && d.scope) zm *= d.scope > 1 ? 0.5 : 0.64;
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
      this.fx.weather(dt, w.weather.rain, this.time);
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
      // knocked-over street furniture
      for (const d of w.debris || []) if (d.x > vx0 - 60 && d.x < vx1 + 60 && d.y > vy0 - 60 && d.y < vy1 + 60) K.drawDebris(ctx, d, this.time);
      // prop placement ghost
      if (w.placing) this.drawGhost(ctx, w.placing);
      // spike strips
      for (const s of w.spikes || []) {
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
        ctx.fillStyle = '#1b1c1f'; ctx.fillRect(-s.len / 2, -5, s.len, 10);
        ctx.fillStyle = '#c9ced6'; for (let k = -s.len / 2 + 4; k < s.len / 2 - 2; k += 8) { ctx.beginPath(); ctx.moveTo(k, -6); ctx.lineTo(k + 3, 0); ctx.lineTo(k, 6); ctx.fill(); }
        ctx.fillStyle = '#e0a800'; ctx.fillRect(-s.len / 2 - 6, -6, 6, 12); ctx.fillRect(s.len / 2, -6, 6, 12);
        ctx.restore();
      }
      // fuel hose from the pump to your hand
      if (w.P.nozzle) {
        const nz = w.P.nozzle, f = w.P.fueling && w.cars.find((q) => q.id === w.P.fueling.car);
        const ex = f ? f.x - Math.cos(f.a) * f.l * 0.3 + Math.sin(f.a) * f.w * 0.5 : p.x, ey = f ? f.y - Math.sin(f.a) * f.l * 0.3 - Math.cos(f.a) * f.w * 0.5 : p.y;
        const sag = Math.min(40, Math.hypot(ex - nz.x, ey - nz.y) * 0.15);
        ctx.strokeStyle = '#111'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(nz.x, nz.y); ctx.quadraticCurveTo((nz.x + ex) / 2, (nz.y + ey) / 2 + sag, ex, ey); ctx.stroke();
        ctx.strokeStyle = '#2f3237'; ctx.lineWidth = 1.4; ctx.stroke();
      }
      // rockets
      for (const r of w.rockets || []) { ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(Math.atan2(r.vy, r.vx)); ctx.fillStyle = '#ddd'; ctx.fillRect(-7, -2, 14, 4); ctx.fillStyle = '#ff8a1a'; ctx.fillRect(-11, -1.5, 4, 3); ctx.restore(); }
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
        if (a.state === 'sleep') { K.drawSleeper(ctx, a); continue; }
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
      if (w.heli) this.drawHeli(ctx, w.heli);
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
          ctx.fillStyle = '#c8102e'; ctx.fillRect(X + 3, Y + 4, 26, 13); ctx.fillStyle = '#fff'; ctx.font = 'bold 5.5px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(tr('FOR SALE'), X + 16, Y + 12.5);
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
    /** translucent preview of the prop under the mouse: green = fits, red = doesn't */
    drawGhost(ctx, pl) {
      const d = K.PLACE[pl.id], p = this.w.player, X = pl.x * TILE, Y = pl.y * TILE, Wd = pl.w * TILE, H = pl.h * TILE;
      const pulse = 0.5 + Math.sin(this.time * 6) * 0.15, col = pl.ok ? '139,92,246' : '255,64,80';
      ctx.save();
      ctx.strokeStyle = 'rgba(139,92,246,0.25)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5 * TILE, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = pl.ok ? 0.75 : 0.45;
      K.drawProp(ctx, { k: d.k, x: pl.x, y: pl.y, w: pl.w, h: pl.h, face: pl.rot, c: 0, ghost: true });
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(${col},${0.16 * pulse * 2})`; ctx.fillRect(X, Y, Wd, H);
      ctx.strokeStyle = `rgba(${col},0.95)`; ctx.lineWidth = 2; ctx.strokeRect(X + 1, Y + 1, Wd - 2, H - 2);
      // facing marker
      const fa = [0, Math.PI / 2, Math.PI, -Math.PI / 2][pl.rot], cx = X + Wd / 2, cy = Y + H / 2, r = Math.min(Wd, H) * 0.5 + 6;
      ctx.fillStyle = `rgba(${col},0.95)`; ctx.beginPath(); ctx.moveTo(cx + Math.cos(fa) * (r + 6), cy + Math.sin(fa) * (r + 6)); ctx.lineTo(cx + Math.cos(fa + 2.6) * r * 0.25 + Math.cos(fa) * r, cy + Math.sin(fa + 2.6) * r * 0.25 + Math.sin(fa) * r); ctx.lineTo(cx + Math.cos(fa - 2.6) * r * 0.25 + Math.cos(fa) * r, cy + Math.sin(fa - 2.6) * r * 0.25 + Math.sin(fa) * r); ctx.fill();
      ctx.restore();
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
      // fuel-station & workshop canopies (fade when you are under them)
      for (const cn of w.city.canopies || []) {
        const X = cn.x * TILE, Y = cn.y * TILE, Wd = cn.w * TILE, H = cn.h * TILE;
        if (X > vx1 || X + Wd < vx0 || Y > vy1 || Y + H < vy0) continue;
        const pc = p.inCar ? w.carOf(p) : p, under = pc.x > X && pc.x < X + Wd && pc.y > Y && pc.y < Y + H;
        cn.a = U.lerp(cn.a == null ? 1 : cn.a, under ? 0.18 : 0.92, 0.12);
        ctx.globalAlpha = cn.a;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(X + 10, Y + 14, Wd, H);
        ctx.fillStyle = cn.col; ctx.fillRect(X, Y, Wd, H);
        ctx.fillStyle = 'rgba(0,0,0,0.08)'; for (let i = 0; i < Wd; i += 16) ctx.fillRect(X + i, Y, 1, H);
        ctx.fillStyle = cn.stripe; ctx.fillRect(X, Y, Wd, 6); ctx.fillRect(X, Y + H - 6, Wd, 6);
        ctx.fillStyle = '#fff'; ctx.font = '700 22px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(cn.label, X + Wd / 2, Y + H / 2);
        ctx.globalAlpha = 1;
      }
      const gx0 = Math.floor(vx0 / CPX) - 1, gx1 = Math.floor(vx1 / CPX) + 1, gy0 = Math.floor(vy0 / CPX) - 1, gy1 = Math.floor(vy1 / CPX) + 1;
      for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
        const arr = this.tallGrid.get(gx * 1000 + gy); if (!arr) continue;
        for (const pr of arr) {
          if (pr.broken) continue;
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
      // the lightmap is multiplied over the scene, so a shadow must darken it (never punch holes into it)
      if (d > 0.15 && this.g.settings.clouds) {
        const wx = w.weather, cov = U.clamp(0.12 + wx.cloud * 0.8, 0, 0.95);
        // under a closed overcast sky the shadows merge into an even grey; broken clouds cast the hardest shadows
        l.globalAlpha = d * (0.45 + 0.45 * (1 - Math.abs(cov - 0.5) * 1.4)) * (1 - wx.rain * 0.45);
        const tex = this.cloudShadowTex(cov), sc = 3200, sp = 14 + wx.wind * 40;
        // one seamless pattern fill (tiling with drawImage leaves visible seams where tiles meet)
        if (this.skyPatSrc !== tex || this.skyPatCov !== this.skyCov) { this.skyPat = l.createPattern(tex, 'repeat'); this.skyPatSrc = tex; this.skyPatCov = this.skyCov; }
        const k = sc / tex.width;
        this.skyPat.setTransform(new DOMMatrix([k, 0, 0, k, (this.time * sp) % sc, (this.time * sp * 0.38) % sc]));
        l.fillStyle = this.skyPat; l.fillRect(vx0 - 10, vy0 - 10, vx1 - vx0 + 20, vy1 - vy0 + 20);
        l.globalAlpha = 1;
      }
      l.globalCompositeOperation = 'lighter';
      const nightK = 1 - d;
      const pad = 260;
      const inside = w.bldAt(w.player.x, w.player.y);
      if (nightK > 0.05) {
        for (const L of w.lights) {
          if (L.dead) continue;
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
      if (w.heli && !w.heli.dead && !w.heli.leaving) { const H = w.heli, r = (H.spotR || 110) * 1.35; l.globalAlpha = Math.min(1, 0.25 + nightK); l.drawImage(K.lightSprite([235, 242, 255]), H.sx - r, H.sy - r, r * 2, r * 2); }
      for (const c of w.cars) {
        if (c.dead || c.x < vx0 - 300 || c.x > vx1 + 300 || c.y < vy0 - 300 || c.y > vy1 + 300) continue;
        if (c.lightsOn) {
          const ok = c.lightsOK || [1, 1, 1, 1], hw = c.w / 2 - 6;
          if (ok[0] || ok[1]) {
            // one beam per headlamp, each from its own lamp, aimed a touch outwards; they overlap ahead
            const hi = c.highBeam ? 1.55 : 1, xen = c.tune && c.tune.xenon ? K.lightSprite(U.hex2rgb(c.tune.xenon)) : null;
            l.save(); l.translate(c.x + Math.cos(c.a) * (c.l / 2 - 2), c.y + Math.sin(c.a) * (c.l / 2 - 2)); l.rotate(c.a);
            for (const [side, on] of [[-1, ok[0]], [1, ok[1]]]) {
              if (!on) continue;
              l.save(); l.translate(0, side * hw); l.rotate(side * (c.highBeam ? 0.03 : 0.07));
              l.globalAlpha = 0.62 * nightK; l.drawImage(K.coneSprite(), 0, -44 * hi, 250 * hi, 88 * hi);
              l.globalAlpha = 0.8 * nightK; l.drawImage(K.lightSprite([255, 248, 225]), -9, -9, 18, 18);   // the lamp itself
              if (xen) { l.globalAlpha = 0.3 * nightK; l.drawImage(xen, 16, -36, 170, 72); }
              l.restore();
            }
            l.restore();
          }
          // two tail lights
          l.globalAlpha = (c.brake ? 0.65 : 0.42) * nightK; const rs = K.lightSprite(c.brake ? [255, 30, 30] : [180, 20, 20]);
          for (const [side, on] of [[-1, ok[2]], [1, ok[3]]]) {
            if (!on) continue;
            const bx = c.x - Math.cos(c.a) * c.l / 2 - Math.sin(c.a) * side * hw, by = c.y - Math.sin(c.a) * c.l / 2 + Math.cos(c.a) * side * hw;
            l.drawImage(rs, bx - 20, by - 20, 40, 40);
          }
        }
        if (c.tune && c.tune.neon) { l.globalAlpha = 0.75; l.drawImage(K.lightSprite(U.hex2rgb(c.tune.neon)), c.x - 70, c.y - 70, 140, 140); }
        if (c.blink && Math.floor(this.time / 0.55) % 2 === 0) { l.globalAlpha = 0.6; l.drawImage(K.lightSprite([255, 170, 30]), c.x - 30, c.y - 30, 60, 60); }
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
          if ((L.kind !== 'lamp' && L.kind !== 'neon') || L.dead) continue;
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
      if (wx.fog > 0.04 || (wx.rain > 0.3 && g.settings.weather)) {
        // two seamless banks of mist at different heights drift with the wind (parallax), plus an even haze
        const fog = Math.max(wx.fog, (wx.rain - 0.3) * 0.35), br = 0.28 + w.daylight() * 0.72;
        ctx.fillStyle = `rgba(${150 * br | 0},${160 * br | 0},${172 * br | 0},${fog * 0.22})`; ctx.fillRect(0, 0, this.cw, this.ch);
        for (const [scW, sp, par, al] of [[1700, 9, 1, 0.55], [1100, 16, 1.18, 0.4]]) {
          const z = this.cam.z * par, sc = scW * z;
          const ox = U.mod((this.time * sp - this.cam.vx) * z, sc), oy = U.mod((this.time * sp * 0.3 - this.cam.vy) * z, sc);
          ctx.globalAlpha = Math.min(0.8, fog * al);
          const ft = this.fogTint(br);
          if (this.fogPatQ !== this.fogQ || !this.fogPat) { this.fogPat = ctx.createPattern(ft, 'repeat'); this.fogPatQ = this.fogQ; }
          const k = sc / ft.width;
          this.fogPat.setTransform(new DOMMatrix([k, 0, 0, k, ox, oy]));
          ctx.fillStyle = this.fogPat; ctx.fillRect(0, 0, this.cw, this.ch);
        }
        ctx.globalAlpha = 1;
      }
      if (wx.flash > 0.5) { ctx.fillStyle = `rgba(230,235,255,${(wx.flash - 0.5) * 0.5})`; ctx.fillRect(0, 0, this.cw, this.ch); }
      ctx.restore();
    }
    /** police helicopter: shadow on the ground, body, rotor disc, nav lights, beam */
    drawHeli(ctx, H) {
      const t = this.time, alt = H.dead ? Math.max(0, H.fallT / 2.2) : 1;
      // shadow
      ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#000';
      ctx.translate(H.x + 70 * alt, H.y + 110 * alt); ctx.rotate(H.a); ctx.beginPath(); ctx.ellipse(0, 0, 46, 16, 0, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.arc(-6, 0, 40, 0, 6.3); ctx.globalAlpha = 0.1; ctx.fill(); ctx.restore();
      // beam from the belly to the spot (night)
      if (!H.dead && this.w.daylight() < 0.5) {
        const g = ctx.createLinearGradient(H.x, H.y, H.sx, H.sy); g.addColorStop(0, 'rgba(230,240,255,0.22)'); g.addColorStop(1, 'rgba(230,240,255,0.04)');
        const a = Math.atan2(H.sy - H.y, H.sx - H.x), r = H.spotR || 110;
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(H.x, H.y); ctx.lineTo(H.sx + Math.cos(a + 1.57) * r, H.sy + Math.sin(a + 1.57) * r); ctx.lineTo(H.sx + Math.cos(a - 1.57) * r, H.sy + Math.sin(a - 1.57) * r); ctx.closePath(); ctx.fill();
      }
      ctx.save(); ctx.translate(H.x, H.y); ctx.rotate(H.a + (H.dead ? t * 6 : 0)); const k = 1.25 + 0.25 * alt; ctx.scale(k, k);
      ctx.fillStyle = '#1a2b4a'; ctx.beginPath(); ctx.ellipse(4, 0, 22, 11, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#e8e6e1'; ctx.fillRect(-10, -11, 14, 3); ctx.fillRect(-10, 8, 14, 3);
      ctx.fillStyle = '#9fc2e8'; ctx.beginPath(); ctx.ellipse(16, 0, 8, 7, 0, -1.3, 1.3); ctx.fill();
      ctx.fillStyle = '#1a2b4a'; ctx.fillRect(-42, -2.5, 26, 5); ctx.fillRect(-46, -8, 5, 16);
      ctx.strokeStyle = '#2b2d31'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, -14); ctx.lineTo(14, -14); ctx.moveTo(-6, 14); ctx.lineTo(14, 14); ctx.stroke();
      ctx.fillStyle = Math.floor(t * 2) % 2 ? '#ff2a2a' : '#2a2a2a'; ctx.beginPath(); ctx.arc(-44, 0, 2.2, 0, 6.3); ctx.fill();
      ctx.restore();
      // rotor: a soft disc with two blurred blades
      ctx.save(); ctx.translate(H.x, H.y); ctx.globalAlpha = 0.16; ctx.fillStyle = '#d0d4da'; ctx.beginPath(); ctx.arc(0, 0, 44, 0, 6.3); ctx.fill();
      ctx.globalAlpha = 0.5; ctx.strokeStyle = '#1b1c1f'; ctx.lineWidth = 3; ctx.rotate(t * 31);
      ctx.beginPath(); ctx.moveTo(-46, 0); ctx.lineTo(46, 0); ctx.moveTo(0, -46); ctx.lineTo(0, 46); ctx.stroke(); ctx.restore();
    }
    drawGlows(ctx, vx0, vy0, vx1, vy1) {
      const w = this.w, nightK = 1 - w.daylight();
      ctx.globalCompositeOperation = 'lighter';
      if (nightK > 0.1) {
        for (const L of w.lights) {
          if (L.dead || L.kind === 'room' || L.x < vx0 - 40 || L.x > vx1 + 40 || L.y < vy0 - 40 || L.y > vy1 + 40) continue;
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
        if (a.ko > 0 || st === 'sleep') { if (Math.floor(this.time * 1.5 + a.id) % 3 === 0) { o.fillStyle = 'rgba(200,220,255,0.8)'; o.font = `bold ${11 * s}px sans-serif`; o.textAlign = 'center'; o.fillText('z', sx + 8 * s, hy + 6 * s); } continue; }
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
        if (a.downed && a.alive) {
          // critical: a red cross with the blood loss ring
          const k = a.downed.loss / 100, by = sy - 18 * zs;
          o.lineWidth = 2.6 * s; o.strokeStyle = 'rgba(0,0,0,0.6)'; o.beginPath(); o.arc(sx, by, 9 * s, 0, 6.3); o.stroke();
          o.strokeStyle = a.downed.stab ? '#10b981' : '#e0182d'; o.beginPath(); o.arc(sx, by, 9 * s, -Math.PI / 2, -Math.PI / 2 + U.TAU * k); o.stroke();
          o.fillStyle = a.downed.stab ? '#10b981' : '#e0182d'; o.fillRect(sx - 1.5 * s, by - 5 * s, 3 * s, 10 * s); o.fillRect(sx - 5 * s, by - 1.5 * s, 10 * s, 3 * s);
        }
        if (a.reportT > 0 && (!a.call || w.t - a.call.t0 > a.call.dial)) {
          // phone at the ear: the ring shows how long until they get through
          const k = a.call ? U.clamp((w.t - a.call.t0) / a.call.dur, 0, 1) : 0.5;
          o.lineWidth = 2.4 * s; o.strokeStyle = 'rgba(0,0,0,0.6)'; o.beginPath(); o.arc(sx + 15 * s, hy, 8 * s, 0, 6.3); o.stroke();
          o.strokeStyle = '#e0182d'; o.beginPath(); o.arc(sx + 15 * s, hy, 8 * s, -Math.PI / 2, -Math.PI / 2 + U.TAU * k); o.stroke();
          o.fillStyle = '#fff'; o.font = `${10 * s}px sans-serif`; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillText('📞', sx + 15 * s, hy + 0.5 * s);
        }
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
          o.font = `600 ${10 * s}px "Oswald", sans-serif`; o.textAlign = 'center'; o.fillText(tr('TARGET'), sx, sy - 30 * zs - 15 * s + bob);
        } else if (!onScreen && c.intel) this.edgeArrow(o, sx, sy, '#ff2030', tr('TARGET'), s);
      }
      if (g.waypoint) { const [sx, sy] = toS(g.waypoint.x, g.waypoint.y); const onScreen = sx > 0 && sy > 0 && sx < this.ov.width && sy < this.ov.height; if (!onScreen) this.edgeArrow(o, sx, sy, '#ffd34d', 'WP', s); else { o.strokeStyle = '#ffd34d'; o.lineWidth = 2 * s; o.beginPath(); o.arc(sx, sy, 10 * s + Math.sin(this.time * 4) * 3 * s, 0, 6.3); o.stroke(); } }
      // floats
      for (const f of this.fx.floats) {
        const [sx, sy] = toS(f.x, f.y), a = Math.min(1, f.life / f.max * 2);
        o.globalAlpha = a; o.font = `800 ${(f.big ? 16 : 12) * s}px "Oswald", sans-serif`; o.textAlign = 'center'; o.lineWidth = 3 * s; o.strokeStyle = 'rgba(0,0,0,0.75)'; o.strokeText(f.text, sx, sy); o.fillStyle = f.col; o.fillText(f.text, sx, sy);
        o.globalAlpha = 1;
      }
      // your stations at work
      for (const rec of w.P.placed || []) {
        if (!rec.job) continue;
        const [sx, sy] = toS((rec.x + rec.w / 2) * TILE, (rec.y + rec.h / 2) * TILE);
        if (sx < 0 || sy < 0 || sx > this.ov.width || sy > this.ov.height) continue;
        const k = U.clamp((w.time - rec.job.start) / Math.max(1, rec.job.end - rec.job.start), 0, 1), y0 = sy - 22 * zs;
        o.fillStyle = 'rgba(15,23,42,0.85)'; o.beginPath(); o.arc(sx, y0, 11 * s, 0, 6.3); o.fill();
        o.strokeStyle = k >= 1 ? '#10b981' : '#8b5cf6'; o.lineWidth = 3 * s; o.beginPath(); o.arc(sx, y0, 9 * s, -Math.PI / 2, -Math.PI / 2 + U.TAU * k); o.stroke();
        o.font = `${10 * s}px sans-serif`; o.textAlign = 'center'; o.fillStyle = '#fff'; o.fillText(k >= 1 ? '✔' : K.PLACE[rec.id].e, sx, y0 + 3.5 * s);
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
      if (g.input.hasMouse && p.alive && !g.paused && !w.placing) this.crosshair(o, s);
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
    /** rifle scope: darkened surroundings, lens ring, mil-dot reticle, range and breath read-outs */
    scopeOverlay(o, s, x, y, d) {
      const w = this.w, p = w.player, W = o.canvas.width, H = o.canvas.height, P = w.P;
      const R = Math.min(W, H) * (d.scope > 1 ? 0.34 : 0.24);
      o.save();
      o.fillStyle = 'rgba(2,4,8,0.62)'; o.beginPath(); o.rect(0, 0, W, H); o.arc(x, y, R, 0, Math.PI * 2, true); o.fill();
      const vg = o.createRadialGradient(x, y, R * 0.72, x, y, R);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(0.85, 'rgba(0,0,0,0.35)'); vg.addColorStop(1, 'rgba(0,0,0,0.9)');
      o.fillStyle = vg; o.beginPath(); o.arc(x, y, R, 0, Math.PI * 2); o.fill();
      // faint lens tint + glare
      const gl = o.createLinearGradient(x - R, y - R, x + R, y + R); gl.addColorStop(0, 'rgba(120,200,255,0.07)'); gl.addColorStop(0.5, 'rgba(0,0,0,0)'); gl.addColorStop(1, 'rgba(255,120,200,0.05)');
      o.fillStyle = gl; o.beginPath(); o.arc(x, y, R, 0, Math.PI * 2); o.fill();
      o.strokeStyle = '#050608'; o.lineWidth = 7 * s; o.beginPath(); o.arc(x, y, R, 0, Math.PI * 2); o.stroke();
      o.strokeStyle = 'rgba(255,255,255,0.12)'; o.lineWidth = 1 * s; o.beginPath(); o.arc(x, y, R - 5 * s, 0, Math.PI * 2); o.stroke();
      // reticle: heavy posts outside, fine crosshair inside, mil dots
      const hit = this.hitMark > 0, rc = hit ? '#ff3a3a' : 'rgba(10,10,10,0.95)';
      o.fillStyle = rc;
      const post = 3.2 * s, gap = R * 0.42;
      o.fillRect(x - R, y - post / 2, R - gap, post); o.fillRect(x + gap, y - post / 2, R - gap, post);
      o.fillRect(x - post / 2, y + gap, post, R - gap); o.fillRect(x - post / 2, y - R, post, R - gap);
      o.strokeStyle = rc; o.lineWidth = 1 * s; o.beginPath(); o.moveTo(x - gap, y); o.lineTo(x + gap, y); o.moveTo(x, y - gap); o.lineTo(x, y + gap); o.stroke();
      for (let k = 1; k <= 4; k++) { const m = gap * k / 4.6; for (const [u, v] of [[m, 0], [-m, 0], [0, m], [0, -m]]) { o.beginPath(); o.arc(x + u, y + v, 1.7 * s, 0, 6.3); o.fill(); } }
      o.fillStyle = hit ? '#ff3a3a' : '#ff2a4a'; o.beginPath(); o.arc(x, y, 1.6 * s, 0, 6.3); o.fill();
      // target under the reticle?
      let tgt = null;
      for (const a of w.near(w.aimX, w.aimY, 22)) if (a !== p && a.alive && !a.inCar) { tgt = a; break; }
      const dist = Math.hypot(w.aimX - p.x, w.aimY - p.y), m = Math.round(dist / K.TILE * 1.4);
      o.font = `600 ${11 * s}px "Oswald", sans-serif`; o.textAlign = 'left'; o.fillStyle = 'rgba(180,255,200,0.85)';
      o.fillText(`${m} m`, x + R * 0.48, y + R * 0.2);
      o.fillText(d.name.toUpperCase(), x + R * 0.48, y + R * 0.2 + 14 * s);
      const wi = w.curWeapon(); o.fillText(`${wi.mag}/${P.ammo[d.ammo] || 0}`, x + R * 0.48, y + R * 0.2 + 28 * s);
      if (tgt) {
        const isT = w.contract && w.contract.targetId === tgt.id;
        o.fillStyle = isT ? '#ff3a5a' : 'rgba(255,220,120,0.9)'; o.textAlign = 'right';
        o.fillText(isT ? tr('TARGET · {name}', { name: tgt.name || '' }) : (tgt.name || K.KIND_NAMES?.[tgt.kind] || tgt.kind).toString().toUpperCase(), x - R * 0.48, y - R * 0.22);
      }
      // breath meter
      const bw = R * 0.8, by = y + R + 16 * s;
      o.fillStyle = 'rgba(0,0,0,0.6)'; o.fillRect(x - bw / 2, by, bw, 5 * s);
      o.fillStyle = P.gasp > 0 ? '#ff4d4d' : w.holdBreath ? '#7cf2ff' : 'rgba(255,255,255,0.7)';
      o.fillRect(x - bw / 2, by, bw * (P.breath || 0) / 100, 5 * s);
      o.textAlign = 'center'; o.font = `600 ${10 * s}px "Oswald", sans-serif`; o.fillStyle = 'rgba(255,255,255,0.75)';
      o.fillText(P.gasp > 0 ? tr('OUT OF BREATH') : w.holdBreath ? tr('HOLDING BREATH') : tr('SHIFT · HOLD BREATH'), x, by + 18 * s);
      if (wi.mag === 0 && (P.ammo[d.ammo] || 0) > 0) { o.fillStyle = '#ffb000'; o.fillText(tr('R — RELOAD'), x, y - R - 12 * s); }
      o.restore();
    }
    crosshair(o, s) {
      const g = this.g, w = this.w, inp = g.input;
      let x = inp.mx * s, y = inp.my * s;
      const d = K.WEAPONS[w.curWeapon().id];
      const p = w.player;
      if (w.scoped && w.aiming && isFinite(w.aimX)) {
        // the reticle sits where the swaying barrel actually points
        x = ((w.aimX - this.cam.vx) * this.cam.z) / this.dpr * s; y = ((w.aimY - this.cam.vy) * this.cam.z) / this.dpr * s;
        this.scopeOverlay(o, s, x, y, d);
        return;
      }
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
        if (wi.mag === 0 && (w.P.ammo[d.ammo] || 0) > 0) { o.fillStyle = '#ffb000'; o.font = `700 ${10 * s}px "Oswald", sans-serif`; o.textAlign = 'center'; o.fillText(tr('R — RELOAD'), x, y + 26 * s); }
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
          if (!e.sup) fx.light(e.x, e.y, d.amr ? 320 : d.cls === 'sniper' || d.cls === 'dmr' ? 240 : d.cls === 'shotgun' || d.cls === 'rifle' || d.cls === 'lmg' ? 200 : 150, [255, 200, 120], d.amr ? 1.4 : 1, 0.07);
          if (d.amr) { fx.dust(e.x - Math.cos(e.a) * 14, e.y - Math.sin(e.a) * 14, 10, [190, 180, 160]); for (const side of [-1.9, 1.9]) fx.add({ k: 'smoke', x: e.x, y: e.y, vx: Math.cos(e.a + side) * 160, vy: Math.sin(e.a + side) * 160, life: 0.8, max: 0.8, size: 6, grow: 40, col: [200, 195, 185], a: 0.45 }); }
          else fx.light(e.x, e.y, 50, [255, 220, 160], 0.4, 0.05);
          fx.add({ k: 'smoke', x: e.x, y: e.y, vx: Math.cos(e.a) * 40, vy: Math.sin(e.a) * 40, life: 0.5, max: 0.5, size: e.sup ? 2 : 4, grow: 20, col: [180, 180, 175], a: 0.35 });
          if (!e.sup) fx.sparks(e.x, e.y, e.a + Math.PI, 3, [255, 220, 140]);
          if (d.cls !== 'shotgun' || Math.random() < 0.5) fx.shell(e.x - Math.cos(e.a) * 10, e.y - Math.sin(e.a) * 10, e.a);
          if (e.player) { this.cam.shake = Math.min(1, this.cam.shake + d.recoil * 2.2); }
          if (!e.sup) fx.ring(e.x, e.y, d.noise * TILE * (1 - w.weather.rain * 0.25), 'rgba(255,90,60,A)', 0.8);
          else fx.ring(e.x, e.y, 3 * TILE, 'rgba(160,200,255,A)', 0.6);
          break;
        }
        case 'tracer': fx.tracers.push({ x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, life: 0.05, max: 0.05, w: K.WEAPONS[e.w] && K.WEAPONS[e.w].amr ? 3.4 : K.WEAPONS[e.w] && (K.WEAPONS[e.w].cls === 'sniper' || K.WEAPONS[e.w].cls === 'dmr') ? 2.2 : 1.2 }); break;
        case 'impact':
          fx.sparks(e.x, e.y, e.a, e.mat === 'metal' ? 8 : 4, e.mat === 'metal' ? [255, 230, 160] : [255, 200, 130]);
          fx.dust(e.x, e.y, e.mat === 'wood' ? 3 : 2, e.mat === 'wood' ? [140, 100, 60] : [150, 145, 135]);
          if (e.mat !== 'metal') fx.decal('hole', e.x, e.y);
          break;
        case 'glass': fx.glass(e.x, e.y, 14); fx.decal('glass', e.x, e.y); break;
        case 'sparks': fx.sparks(e.x, e.y, Math.random() * 6.3, 4); break;
        case 'carSmoke': fx.smoke(e.x, e.y, 1, e.k >= 3 ? 1 : 0); if (e.k >= 3 && Math.random() < 0.3) fx.fire(e.x, e.y, 1); break;
        case 'exhaustFlame': if (e.small) { fx.fire(e.x, e.y, 1); fx.light(e.x, e.y, 50, [255, 150, 60], 0.5, 0.08); } else { fx.fire(e.x, e.y, 2); fx.light(e.x, e.y, 70, [180, 120, 255], 0.6, 0.1); } break;
        case 'geyser': fx.add({ k: 'smoke', x: e.x + U.rnd(-4, 4), y: e.y + U.rnd(-4, 4), vx: U.rnd(-40, 40), vy: U.rnd(-90, -30), life: 0.7, max: 0.7, size: 3, grow: 10, col: [170, 210, 255], a: 0.7 }); if (Math.random() < 0.1) fx.decal('drop', e.x + U.rnd(-30, 30), e.y + U.rnd(-30, 30), { s: 2, col: 'water' }); break;
        case 'tireBurst': fx.sparks(e.x, e.y, Math.random() * 6.3, 8); fx.dust(e.x, e.y, 4, [60, 60, 60]); break;
        case 'clean': fx.clean(e.x, e.y, e.r, e.k); break;
        case 'poolStamp': if (fx.gore) { const s = e.s; fx.stamp(e.x, e.y, s, (c) => { c.globalAlpha = 0.9; c.translate(e.x, e.y); c.rotate(e.id); c.drawImage(fx.blob(e.id % 6, '#4e0205'), -s, -s, s * 2, s * 2); }); } break;
        case 'svcBag': fx.dust(e.x, e.y, 6, [40, 42, 48]); break;
        case 'svcMop': fx.dust(e.x, e.y, 1, [200, 210, 220]); fx.decal('drop', e.x + U.rnd(-6, 6), e.y + U.rnd(-6, 6), { col: 'water', s: 2.4 }); break;
        case 'svcSpark': fx.sparks(e.x, e.y, Math.random() * 6.3, 2, [255, 230, 160]); break;
        case 'propChanged': for (let j = e.y - 1; j <= e.y + e.h + 3; j++) for (let i = e.x - 1; i <= e.x + e.w + 3; i++) this.invalidateTile(i, j); break;
        case 'propSmash': this.invalidateTile(e.tx, e.ty); fx.sparks(e.x, e.y, Math.random() * 6.3, e.k === 'lamp' ? 14 : 6); if (e.k === 'lamp') { fx.glass(e.x, e.y, 10); fx.decal('glass', e.x, e.y); } if (e.player) this.cam.shake = Math.min(1, this.cam.shake + 0.25); break;
        case 'keys': fx.float(e.x, e.y - 30, tr('🔑 Keys'), '#ffd34d'); for (let k = 0; k < 8; k++) fx.sparks(e.x, e.y - 10, Math.random() * 6.3, 1, [255, 230, 140]); break;
        case 'rocketTrail': fx.smoke(e.x, e.y, 1, 0); break;
        case 'fuelDrip': fx.decal('drop', e.x, e.y, { s: 1.5, col: 'oil' }); break;
        case 'carJolt': this.cam.shake = Math.min(1, this.cam.shake + e.v / 700); break;
        case 'spraymist': { const h = parseInt((e.col || '#ffffff').slice(1), 16); fx.dust(e.x + U.rnd(-14, 14), e.y + U.rnd(-6, 6), 1, [(h >> 16) & 255, (h >> 8) & 255, h & 255]); break; }
        case 'turf': this.tagCache = null; break;
        case 'hurt': {
          const a = e.a != null ? e.a : Math.random() * 6.3;
          if (e.kind === 'bullet' || e.kind === 'melee' || e.kind === 'explosion' || e.kind === 'car') {
            const n = e.blunt ? 3 : Math.min(26, 6 + e.dmg * 0.3);
            fx.blood(e.x, e.y, a, n, e.head ? 1.4 : 1);
            if (e.kind === 'bullet' && g.settings.gore) fx.decal('streak', e.x, e.y, { a, len: 18 + e.dmg * 0.6 });
            if (e.head) { fx.blood(e.x, e.y, a, 18, 1.8, 0.35); fx.float(e.x, e.y - 20, tr('HEADSHOT'), '#ff4040'); }
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
        case 'targetDown': fx.float(e.x, e.y - 34, tr('TARGET ELIMINATED'), '#ff3a3a', true); break;
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
