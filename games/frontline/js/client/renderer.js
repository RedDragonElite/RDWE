/* RDE // FRONTLINE — Canvas2D renderer
 * Reads sim state, never writes it. Layers:
 * terrain → water shimmer → territory → fallout → structures → boats → nukes → labels → fx → clouds */
(function (BW) {
  'use strict';
  const C = BW.C, T = C.T;

  const fmt = (n) => {
    n = Math.max(0, n);
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'K';
    return String(Math.floor(n));
  };
  BW.fmt = fmt;

  const pack = (r, g, b, a) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  const mix = (c, d, f) => [c[0] + (d[0] - c[0]) * f, c[1] + (d[1] - c[1]) * f, c[2] + (d[2] - c[2]) * f];
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  BW.rgba = rgba;

  // terrain base colours
  const TC = {
    [T.BEACH]: [222, 206, 160], [T.PLAINS]: [150, 178, 104], [T.FOREST]: [84, 128, 72],
    [T.HILLS]: [160, 152, 108], [T.MOUNTAIN]: [128, 118, 108], [T.SNOW]: [236, 240, 246],
  };

  class Renderer {
    constructor(canvas, game) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.game = game;
      this.sim = game.sim;
      const { W, H } = this.sim;
      this.W = W; this.H = H;
      this.cam = { x: W / 2, y: H / 2, zoom: 2, tx: W / 2, ty: H / 2, tz: 2 };
      this.shake = 0;
      this.particles = [];
      this.rings = [];
      this.flashes = [];
      this.fallout = [];
      this.nukeTrails = new Map();
      this.labels = new Map();
      this.hoverOwner = 0;
      this.time = 0;
      this._labelTimer = 0;
      this.dist = new Uint16Array(W * H);
      this._buildPalette();
      this._buildTerrain();
      this._buildShimmer();
      this._buildClouds();
      this.terr = document.createElement('canvas');
      this.terr.width = W; this.terr.height = H;
      this.tctx = this.terr.getContext('2d');
      this.timg = this.tctx.createImageData(W, H);
      this.tpx = new Uint32Array(this.timg.data.buffer);
      this.repaintAll();
      this.resize();
      this.fitView(true);
    }

    _buildPalette() {
      const ps = this.sim.players;
      this.fill = new Uint32Array(ps.length);
      this.fillHi = new Uint32Array(ps.length);
      this.edge = new Uint32Array(ps.length);
      for (let i = 1; i < ps.length; i++) {
        const c = ps[i].color;
        this.fill[i] = pack(c[0], c[1], c[2], 112);
        this.fillHi[i] = pack(c[0], c[1], c[2], 170);
        const e = mix(c, [255, 255, 255], 0.25);
        this.edge[i] = pack(e[0] | 0, e[1] | 0, e[2] | 0, 245);
      }
    }

    _buildTerrain() {
      const { W, H } = this, m = this.sim.map;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const cx = cv.getContext('2d'), img = cx.createImageData(W, H), d = img.data;
      const deep = [12, 34, 70], mid = [24, 74, 128], shelf = [52, 150, 178];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, t = m.terrain[i];
        let c;
        if (t <= T.SHALLOW) {
          const wd = Math.min(m.waterDist[i], 40) / 40;
          c = wd < 0.12 ? mix(shelf, mid, wd / 0.12) : mix(mid, deep, Math.min(1, (wd - 0.12) / 0.6));
          const n = ((x * 73856093) ^ (y * 19349663)) & 7;
          c = mix(c, [0, 0, 0], n * 0.006);
        } else {
          c = TC[t];
          // hill shading from height field (light from north-west)
          const h0 = m.height[i];
          const hx = m.height[Math.min(W - 1, x + 1) + y * W], hy = m.height[x + Math.min(H - 1, y + 1) * W];
          const shade = Math.max(-0.35, Math.min(0.35, ((h0 - hx) + (h0 - hy)) * 9));
          c = shade > 0 ? mix(c, [255, 250, 230], shade * 0.8) : mix(c, [20, 20, 30], -shade);
          const e = (h0 - m.sea) / (m.maxH - m.sea);
          c = mix(c, [255, 255, 255], Math.max(0, e - 0.5) * 0.25);
          const n = ((x * 2654435761) ^ (y * 40503)) & 15;
          c = mix(c, [0, 0, 0], n * 0.004);
        }
        const o = i * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
      cx.putImageData(img, 0, 0);
      this.terrain = cv;
    }

    _buildShimmer() {
      const { W, H } = this, m = this.sim.map;
      const mk = (seed) => {
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const cx = cv.getContext('2d'), img = cx.createImageData(W, H), d = img.data;
        const nz = BW.MapGen.makeNoise(seed);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (m.terrain[i] > T.SHALLOW) continue;
          const v = nz(x / 3.2, y / 2.2);
          const a = Math.pow(Math.max(0, v - 0.55) / 0.45, 2) * (m.waterDist[i] < 3 ? 140 : 70);
          const o = i * 4; d[o] = 210; d[o + 1] = 235; d[o + 2] = 255; d[o + 3] = a;
        }
        cx.putImageData(img, 0, 0);
        return cv;
      };
      this.shimA = mk(77); this.shimB = mk(991);
    }

    _buildClouds() {
      const S = 256, P = [8, 16, 32];
      const grids = P.map(p => { const g = new Float32Array(p * p); for (let i = 0; i < g.length; i++) g[i] = Math.random(); return g; });
      const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
      const cx = cv.getContext('2d'), img = cx.createImageData(S, S), d = img.data;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        let v = 0, amp = 1, norm = 0;
        for (let k = 0; k < P.length; k++) {
          const p = P[k], g = grids[k], fx = x / S * p, fy = y / S * p;
          const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
          const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
          const a = g[(y0 % p) * p + (x0 % p)], b = g[(y0 % p) * p + ((x0 + 1) % p)];
          const c = g[((y0 + 1) % p) * p + (x0 % p)], e = g[((y0 + 1) % p) * p + ((x0 + 1) % p)];
          v += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy); norm += amp; amp *= 0.5;
        }
        v /= norm;
        const al = Math.max(0, Math.min(1, (v - 0.52) / 0.2));
        const o = (y * S + x) * 4; d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = al * al * 230;
      }
      cx.putImageData(img, 0, 0);
      this.clouds = cv;
      this.cloudPat = this.ctx.createPattern(cv, 'repeat');
    }

    // ------------------------------------------------------------ territory raster
    _paint(t) {
      const o = this.sim.owner[t];
      if (!o) { this.tpx[t] = 0; return; }
      const W = this.W, own = this.sim.owner, x = t % W;
      const edge = (t < W || own[t - W] !== o) || (t >= own.length - W || own[t + W] !== o) ||
        (x === 0 || own[t - 1] !== o) || (x === W - 1 || own[t + 1] !== o);
      this.tpx[t] = edge ? this.edge[o] : (o === this.hoverOwner ? this.fillHi[o] : this.fill[o]);
    }
    repaintAll() {
      for (let t = 0; t < this.tpx.length; t++) this._paint(t);
      this.dirty = true;
    }
    applyChanges(changed) {
      const W = this.W, N = this.tpx.length;
      for (let i = 0; i < changed.length; i++) {
        const t = changed[i];
        this._paint(t);
        if (t >= W) this._paint(t - W);
        if (t < N - W) this._paint(t + W);
        if (t % W) this._paint(t - 1);
        if ((t + 1) % W) this._paint(t + 1);
      }
      if (changed.length) this.dirty = true;
      // frontline sparks inside the viewport
      const v = this.viewRect(), budget = Math.min(changed.length, 40);
      for (let k = 0; k < budget; k++) {
        const t = changed[(Math.random() * changed.length) | 0];
        const x = t % W, y = (t / W) | 0;
        if (x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1) continue;
        const o = this.sim.owner[t];
        if (!o || Math.random() > 0.35) continue;
        const c = mix(this.sim.players[o].color, [255, 255, 255], 0.5);
        this.particles.push({ x: x + 0.5, y: y + 0.5, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2, life: 0.5, max: 0.5, size: 0.5, color: c, glow: true });
      }
    }
    setHoverOwner(o) {
      if (o === this.hoverOwner) return;
      const prev = this.hoverOwner; this.hoverOwner = o;
      const own = this.sim.owner;
      for (let t = 0; t < own.length; t++) if (own[t] && (own[t] === o || own[t] === prev)) this._paint(t);
      this.dirty = true;
    }

    // ------------------------------------------------------------ labels (distance transform)
    computeLabels() {
      const { W, H } = this, own = this.sim.owner, d = this.dist;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const t = y * W + x, o = own[t];
        if (!o) { d[t] = 0; continue; }
        const up = y > 0 && own[t - W] === o ? d[t - W] : 0;
        const lf = x > 0 && own[t - 1] === o ? d[t - 1] : 0;
        d[t] = Math.min(up, lf) + 1;
      }
      const best = new Map();
      for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
        const t = y * W + x, o = own[t];
        if (!o) continue;
        const dn = y < H - 1 && own[t + W] === o ? d[t + W] : 0;
        const rt = x < W - 1 && own[t + 1] === o ? d[t + 1] : 0;
        const v = Math.min(d[t], Math.min(dn, rt) + 1);
        d[t] = v;
        const b = best.get(o);
        if (!b || v > b.r) best.set(o, { r: v, x: x + 0.5, y: y + 0.5 });
      }
      for (const [pid, b] of best) {
        const l = this.labels.get(pid);
        if (!l) this.labels.set(pid, { x: b.x, y: b.y, r: b.r, tx: b.x, ty: b.y, tr: b.r });
        else { l.tx = b.x; l.ty = b.y; l.tr = b.r; if (Math.hypot(l.x - b.x, l.y - b.y) > 40) { l.x = b.x; l.y = b.y; } }
      }
      for (const pid of [...this.labels.keys()]) if (!best.has(pid)) this.labels.delete(pid);
    }
    labelPos(pid) {
      const l = this.labels.get(pid);
      if (l) return [l.x, l.y];
      return this.sim.centroid(this.sim.players[pid]);
    }

    // ------------------------------------------------------------ camera
    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.dpr = dpr;
      this.cw = window.innerWidth; this.ch = window.innerHeight;
      this.canvas.width = Math.floor(this.cw * dpr); this.canvas.height = Math.floor(this.ch * dpr);
      this.canvas.style.width = this.cw + 'px'; this.canvas.style.height = this.ch + 'px';
    }
    minZoom() { return Math.min(this.cw / this.W, this.ch / this.H) * 0.8; }
    fitView(instant) {
      const z = Math.min(this.cw / this.W, this.ch / this.H) * 0.98;
      this.cam.tx = this.W / 2; this.cam.ty = this.H / 2; this.cam.tz = z;
      if (instant) { this.cam.x = this.cam.tx; this.cam.y = this.cam.ty; this.cam.zoom = z; }
    }
    focus(x, y, zoom) { this.cam.tx = x; this.cam.ty = y; if (zoom) this.cam.tz = zoom; }
    screenToWorld(sx, sy) {
      const c = this.cam;
      return [(sx - this.cw / 2) / c.zoom + c.x, (sy - this.ch / 2) / c.zoom + c.y];
    }
    worldToScreen(wx, wy) {
      const c = this.cam;
      return [(wx - c.x) * c.zoom + this.cw / 2 + this._sx, (wy - c.y) * c.zoom + this.ch / 2 + this._sy];
    }
    zoomAt(sx, sy, factor) {
      const c = this.cam;
      const nz = Math.max(this.minZoom(), Math.min(40, c.tz * factor));
      const [wx, wy] = this.screenToWorld(sx, sy);
      // keep the point under the cursor fixed (relative to target camera)
      c.tx = wx - (sx - this.cw / 2) / nz;
      c.ty = wy - (sy - this.ch / 2) / nz;
      c.tz = nz;
    }
    pan(dx, dy) {
      this.cam.tx -= dx / this.cam.zoom; this.cam.ty -= dy / this.cam.zoom;
      this.cam.x = this.cam.tx; this.cam.y = this.cam.ty;
    }
    viewRect() {
      const [x0, y0] = this.screenToWorld(0, 0), [x1, y1] = this.screenToWorld(this.cw, this.ch);
      return { x0, y0, x1, y1 };
    }

    // ------------------------------------------------------------ fx api
    explosion(x, y, R, big) {
      this.flashes.push({ x, y, r: R * 2.2, life: big ? 1.1 : 0.7, max: big ? 1.1 : 0.7 });
      this.rings.push({ x, y, r0: R * 0.2, r1: R * 2.8, life: big ? 2.2 : 1.6, max: big ? 2.2 : 1.6, color: [255, 220, 170] });
      this.rings.push({ x, y, r0: R * 0.1, r1: R * 1.4, life: 1.0, max: 1.0, color: [255, 120, 40] });
      const n = big ? 260 : 140;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = Math.random() * R * (big ? 1.4 : 1.1);
        const fire = i < n * 0.55;
        this.particles.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (fire ? 0 : R * 0.15),
          life: fire ? 0.6 + Math.random() * 0.8 : 2 + Math.random() * 3, max: 0, drag: fire ? 2.2 : 1.2,
          size: fire ? R * (0.08 + Math.random() * 0.12) : R * (0.15 + Math.random() * 0.25),
          color: fire ? [255, 140 + Math.random() * 100, 40] : [120, 112, 104], glow: fire, smoke: !fire,
        });
      }
      for (const p of this.particles) if (!p.max) p.max = p.life;
      this.fallout.push({ x, y, r: R * 1.05, life: 70, max: 70 });
      this.shake = Math.min(28, this.shake + (big ? 26 : 14));
    }
    interceptFx(x, y) {
      this.flashes.push({ x, y, r: 6, life: 0.4, max: 0.4 });
      this.rings.push({ x, y, r0: 0.5, r1: 9, life: 0.7, max: 0.7, color: [120, 220, 255] });
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * 6.283, s = 2 + Math.random() * 8;
        this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.8, max: 0.8, size: 0.6, color: [160, 230, 255], glow: true, drag: 1.5 });
      }
    }
    pulse(x, y, color) {
      this.rings.push({ x, y, r0: 1, r1: 10, life: 0.9, max: 0.9, color });
    }

    // ------------------------------------------------------------ draw
    draw(dt, alpha) {
      this.time += dt;
      const ctx = this.ctx, c = this.cam, sim = this.sim, game = this.game;
      // camera easing
      const k = 1 - Math.pow(0.0005, dt);
      c.tx = Math.max(0, Math.min(this.W, c.tx)); c.ty = Math.max(0, Math.min(this.H, c.ty));
      c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k; c.zoom += (c.tz - c.zoom) * k;
      // labels
      this._labelTimer -= dt;
      if (this._labelTimer <= 0) { this.computeLabels(); this._labelTimer = 0.5; }
      for (const l of this.labels.values()) { const f = 1 - Math.pow(0.02, dt); l.x += (l.tx - l.x) * f; l.y += (l.ty - l.y) * f; l.r += (l.tr - l.r) * f; }
      if (this.dirty) { this.tctx.putImageData(this.timg, 0, 0); this.dirty = false; }

      this.shake *= Math.pow(0.04, dt);
      this._sx = (Math.random() - 0.5) * this.shake; this._sy = (Math.random() - 0.5) * this.shake;
      const dpr = this.dpr, z = c.zoom;
      const ox = this.cw / 2 - c.x * z + this._sx, oy = this.ch / 2 - c.y * z + this._sy;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#060b16';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // world space
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);
      ctx.imageSmoothingEnabled = z < 1;
      ctx.drawImage(this.terrain, 0, 0);
      const s = 0.5 + 0.5 * Math.sin(this.time * 0.9);
      ctx.globalAlpha = s; ctx.drawImage(this.shimA, 0, 0);
      ctx.globalAlpha = 1 - s; ctx.drawImage(this.shimB, 0, 0);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.terr, 0, 0);

      // fallout
      for (const f of this.fallout) {
        f.life -= dt;
        const a = Math.max(0, f.life / f.max);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, `rgba(30,24,20,${0.75 * a})`);
        g.addColorStop(0.6, `rgba(70,90,30,${0.45 * a})`);
        g.addColorStop(1, 'rgba(120,160,40,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
      }
      this.fallout = this.fallout.filter(f => f.life > 0);

      // defense zones of hovered owner / mode previews
      this._drawPreviews(ctx);

      // boats wake (world space)
      for (const b of sim.boats) {
        const p = Math.min(b.path.length - 1, b.prog + b.speed * alpha);
        const i0 = Math.floor(p);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.6; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = Math.max(0, i0 - 14); i <= i0; i++) {
          const t = b.path[i], x = t % this.W + 0.5, y = ((t / this.W) | 0) + 0.5;
          if (i === Math.max(0, i0 - 14)) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // fx in world space
      ctx.globalCompositeOperation = 'lighter';
      for (const f of this.flashes) {
        f.life -= dt;
        const a = Math.max(0, f.life / f.max);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * (1.4 - a * 0.4));
        g.addColorStop(0, `rgba(255,255,240,${a})`); g.addColorStop(0.35, `rgba(255,200,120,${a * 0.7})`); g.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 1.4, 0, 6.283); ctx.fill();
      }
      this.flashes = this.flashes.filter(f => f.life > 0);
      ctx.globalCompositeOperation = 'source-over';
      for (const r of this.rings) {
        r.life -= dt;
        const u = 1 - Math.max(0, r.life / r.max);
        const rad = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - u, 3));
        ctx.strokeStyle = rgba(r.color, (1 - u) * 0.85); ctx.lineWidth = Math.max(0.4, (1 - u) * 2.2);
        ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, 6.283); ctx.stroke();
      }
      this.rings = this.rings.filter(r => r.life > 0);
      for (const p of this.particles) {
        p.life -= dt;
        const dr = Math.pow(1 / (1 + (p.drag || 0)), dt);
        p.vx *= dr; p.vy *= dr;
        if (p.smoke) p.vy -= 0.8 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        const a = Math.max(0, p.life / p.max);
        if (p.glow) ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba(p.color, p.smoke ? a * a * 0.22 : a);
        const sz = p.smoke ? p.size * (1.8 - a) : Math.max(p.size * a, 1.2 / z);
        ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, 6.283); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      this.particles = this.particles.filter(p => p.life > 0);
      if (this.particles.length > 3000) this.particles.splice(0, this.particles.length - 3000);

      // clouds (fade out when zoomed in)
      const ca = Math.max(0, Math.min(0.42, 0.62 - z * 0.15));
      if (ca > 0.01) {
        const sc = 3.2, off = this.time * 1.4;
        const m = new DOMMatrix().translateSelf(off, off * 0.35).scaleSelf(sc, sc);
        this.cloudPat.setTransform(m);
        ctx.globalAlpha = ca; ctx.fillStyle = this.cloudPat;
        ctx.fillRect(0, 0, this.W, this.H);
        ctx.globalAlpha = 1;
      }

      // ---------- screen space overlays
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._drawStructures(ctx);
      this._drawBoats(ctx, alpha);
      this._drawNukes(ctx, alpha);
      this._drawLabels(ctx);
      this._drawArrows(ctx, dt);
      this._drawHover(ctx);
    }

    _drawPreviews(ctx) {
      const g = this.game, ht = g.hoverTile;
      if (ht < 0) return;
      const x = ht % this.W + 0.5, y = ((ht / this.W) | 0) + 0.5;
      const pulse = 0.6 + 0.4 * Math.sin(this.time * 6);
      if (this.sim.phase === 'spawn') {
        const R = C.SPAWN_RADIUS + 0.5;
        ctx.fillStyle = rgba(g.me.color, 0.35 * pulse); ctx.strokeStyle = rgba(g.me.color, 0.9); ctx.lineWidth = 0.35;
        ctx.beginPath(); ctx.arc(x, y, R, 0, 6.283); ctx.fill(); ctx.stroke();
        return;
      }
      const mode = g.mode;
      if (mode && C.NUKES[mode]) {
        const R = C.NUKES[mode].radius;
        ctx.fillStyle = `rgba(255,40,40,${0.12 + 0.08 * pulse})`; ctx.strokeStyle = 'rgba(255,70,70,0.95)';
        ctx.lineWidth = Math.max(0.3, 1.5 / this.cam.zoom);
        ctx.setLineDash([2, 1.5]);
        ctx.beginPath(); ctx.arc(x, y, R, 0, 6.283); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(x - R * 1.2, y); ctx.lineTo(x + R * 1.2, y); ctx.moveTo(x, y - R * 1.2); ctx.lineTo(x, y + R * 1.2); ctx.stroke();
      } else if (mode === 'defense' || mode === 'sam') {
        const R = C.BUILD[mode].radius;
        ctx.strokeStyle = 'rgba(120,220,255,0.8)'; ctx.fillStyle = 'rgba(120,220,255,0.08)';
        ctx.lineWidth = Math.max(0.3, 1.5 / this.cam.zoom);
        ctx.beginPath();
        if (mode === 'defense') ctx.rect(x - R, y - R, R * 2, R * 2); else ctx.arc(x, y, R, 0, 6.283);
        ctx.fill(); ctx.stroke();
      }
    }

    _icon(ctx, kind, x, y, s, col, cd) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = 'rgba(8,10,18,0.85)';
      ctx.strokeStyle = rgba(col, 1); ctx.lineWidth = Math.max(1.5, s * 0.12);
      ctx.beginPath(); ctx.arc(0, 0, s * 0.62, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, s * 0.09);
      const u = s * 0.32;
      ctx.beginPath();
      switch (kind) {
        case 'city':
          ctx.rect(-u, -u * 0.2, u * 0.8, u * 1.2); ctx.rect(-u * 0.1, -u, u * 0.7, u * 2); ctx.rect(u * 0.7, -u * 0.5, u * 0.45, u * 1.5); ctx.fill(); break;
        case 'port':
          ctx.arc(0, -u * 0.75, u * 0.25, 0, 6.283); ctx.moveTo(0, -u * 0.5); ctx.lineTo(0, u);
          ctx.moveTo(-u * 0.5, -u * 0.15); ctx.lineTo(u * 0.5, -u * 0.15);
          ctx.moveTo(-u * 0.9, u * 0.3); ctx.quadraticCurveTo(-u * 0.6, u, 0, u); ctx.quadraticCurveTo(u * 0.6, u, u * 0.9, u * 0.3); ctx.stroke(); break;
        case 'defense':
          ctx.moveTo(0, -u); ctx.lineTo(u * 0.9, -u * 0.6); ctx.lineTo(u * 0.75, u * 0.3); ctx.lineTo(0, u); ctx.lineTo(-u * 0.75, u * 0.3); ctx.lineTo(-u * 0.9, -u * 0.6); ctx.closePath(); ctx.fill(); break;
        case 'silo':
          ctx.moveTo(0, -u * 1.1); ctx.lineTo(u * 0.35, -u * 0.5); ctx.lineTo(u * 0.35, u * 0.6); ctx.lineTo(u * 0.7, u); ctx.lineTo(-u * 0.7, u); ctx.lineTo(-u * 0.35, u * 0.6); ctx.lineTo(-u * 0.35, -u * 0.5); ctx.closePath(); ctx.fill(); break;
        case 'sam':
          ctx.arc(0, u * 0.2, u * 0.75, Math.PI, 0); ctx.moveTo(0, u * 0.2); ctx.lineTo(u * 0.7, -u * 0.9); ctx.moveTo(-u * 0.5, u); ctx.lineTo(u * 0.5, u); ctx.stroke();
          ctx.beginPath(); ctx.arc(u * 0.7, -u * 0.9, u * 0.18, 0, 6.283); ctx.fill(); break;
      }
      if (cd > 0) {
        ctx.strokeStyle = 'rgba(255,80,80,0.95)'; ctx.lineWidth = Math.max(1.5, s * 0.12);
        ctx.beginPath(); ctx.arc(0, 0, s * 0.62, -Math.PI / 2, -Math.PI / 2 + cd * 6.283); ctx.stroke();
      }
      ctx.restore();
    }
    _drawStructures(ctx) {
      const z = this.cam.zoom, s = Math.max(9, Math.min(26, z * 3.4));
      if (z < 0.9) return;
      const v = this.viewRect(), sim = this.sim;
      for (const st of sim.structures) {
        if (st.x < v.x0 - 2 || st.x > v.x1 + 2 || st.y < v.y0 - 2 || st.y > v.y1 + 2) continue;
        const [x, y] = this.worldToScreen(st.x + 0.5, st.y + 0.5);
        const cd = st.cd > sim.tick ? (st.cd - sim.tick) / (st.kind === 'sam' ? 70 : 50) : 0;
        this._icon(ctx, st.kind, x, y, s, sim.players[st.owner].color, cd);
      }
    }
    _drawBoats(ctx, alpha) {
      const sim = this.sim, z = this.cam.zoom, W = this.W;
      for (const b of sim.boats) {
        const p = Math.min(b.path.length - 1, b.prog + b.speed * alpha);
        const i0 = Math.floor(p), i1 = Math.min(b.path.length - 1, i0 + 1), f = p - i0;
        const t0 = b.path[i0], t1 = b.path[i1];
        const x0 = t0 % W, y0 = (t0 / W) | 0, x1 = t1 % W, y1 = (t1 / W) | 0;
        const wx = x0 + (x1 - x0) * f + 0.5, wy = y0 + (y1 - y0) * f + 0.5;
        const ta = b.path[Math.min(b.path.length - 1, i0 + 3)];
        const ang = Math.atan2(((ta / W) | 0) - y0, ta % W - x0);
        const [sx, sy] = this.worldToScreen(wx, wy);
        const s = Math.max(7, Math.min(18, z * 2.2));
        const col = sim.players[b.owner].color;
        ctx.save(); ctx.translate(sx, sy + Math.sin(this.time * 4 + b.id) * 0.8); ctx.rotate(ang);
        ctx.fillStyle = rgba(col, 1); ctx.strokeStyle = '#0a0a12'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(s * 0.3, -s * 0.45); ctx.lineTo(-s * 0.8, -s * 0.4); ctx.lineTo(-s * 0.8, s * 0.4); ctx.lineTo(s * 0.3, s * 0.45); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillRect(-s * 0.4, -s * 0.15, s * 0.5, s * 0.3);
        ctx.restore();
        if (z > 2.5) this._text(ctx, fmt(b.troops), sx, sy - s - 2, 11, '#fff');
      }
    }
    _drawNukes(ctx, alpha) {
      const sim = this.sim;
      const live = new Set();
      for (const n of sim.nukes) {
        live.add(n.id);
        const u = Math.min(1, (sim.tick - 1 + alpha - n.launched) / (n.eta - n.launched));
        const gx = n.fx + (n.tx - n.fx) * u + 0.5, gy = n.fy + (n.ty - n.fy) * u + 0.5;
        const dist = Math.hypot(n.tx - n.fx, n.ty - n.fy);
        const hgt = Math.sin(Math.PI * u) * Math.max(25, dist * 0.35);
        const R = C.NUKES[n.kind].radius;
        // target reticle
        const [tx, ty] = this.worldToScreen(n.tx + 0.5, n.ty + 0.5);
        const rr = R * this.cam.zoom, pulse = 0.5 + 0.5 * Math.sin(this.time * 10);
        ctx.strokeStyle = `rgba(255,50,50,${0.5 + 0.5 * pulse})`; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.arc(tx, ty, rr, this.time, this.time + 6.283); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = `rgba(255,30,30,${0.08 + 0.1 * pulse})`; ctx.beginPath(); ctx.arc(tx, ty, rr, 0, 6.283); ctx.fill();
        // trail
        let tr = this.nukeTrails.get(n.id);
        if (!tr) { tr = []; this.nukeTrails.set(n.id, tr); }
        tr.push([gx, gy, hgt]); if (tr.length > 60) tr.shift();
        ctx.lineCap = 'round';
        for (let i = 1; i < tr.length; i++) {
          const [ax, ay] = this.worldToScreen(tr[i - 1][0], tr[i - 1][1] - tr[i - 1][2]);
          const [bx, by] = this.worldToScreen(tr[i][0], tr[i][1] - tr[i][2]);
          ctx.strokeStyle = `rgba(255,${180 + i},${120 + i * 2},${(i / tr.length) * 0.7})`; ctx.lineWidth = 1 + (i / tr.length) * 3;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        }
        // shadow + warhead
        const [sx, sy] = this.worldToScreen(gx, gy);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sx, sy, 6, 3, 0, 0, 6.283); ctx.fill();
        const [mx, my] = this.worldToScreen(gx, gy - hgt);
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, 16);
        g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.3, 'rgba(255,170,60,0.8)'); g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 16, 0, 6.283); ctx.fill();
        ctx.fillStyle = n.kind === 'hydro' ? '#ff4df0' : '#fff'; ctx.beginPath(); ctx.arc(mx, my, n.kind === 'hydro' ? 4.5 : 3.5, 0, 6.283); ctx.fill();
      }
      for (const id of [...this.nukeTrails.keys()]) if (!live.has(id)) this.nukeTrails.delete(id);
    }
    _text(ctx, s, x, y, size, color, weight = 700) {
      ctx.font = `${weight} ${size}px Rajdhani, 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(5,6,12,0.85)'; ctx.lineWidth = Math.max(2, size * 0.22);
      ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
    }
    _drawLabels(ctx) {
      const sim = this.sim, z = this.cam.zoom, me = this.game.me;
      const leader = sim.alivePlayers().reduce((a, b) => (!a || b.tiles > a.tiles ? b : a), null);
      for (const [pid, l] of this.labels) {
        const p = sim.players[pid];
        if (!p || !p.alive) continue;
        const size = Math.min(34, l.r * z * 0.42);
        if (size < 7) continue;
        const [x, y] = this.worldToScreen(l.x, l.y);
        if (x < -200 || y < -100 || x > this.cw + 200 || y > this.ch + 100) continue;
        const ally = me && me.allies.has(pid);
        const nameCol = pid === me?.id ? '#ffe28a' : ally ? '#9dffb0' : '#ffffff';
        let name = p.name;
        if (leader && pid === leader.id) name = '♛ ' + name;
        if (ally) name = '◆ ' + name;
        this._text(ctx, name, x, y - size * 0.35, size, nameCol);
        this._text(ctx, '⚔ ' + fmt(p.troops), x, y + size * 0.55, size * 0.62, 'rgba(255,255,255,0.92)', 600);
      }
    }
    _drawArrows(ctx, dt) {
      const arr = this.game.arrows;
      for (const a of arr) {
        a.life -= dt;
        const u = 1 - a.life / a.max;
        const [fx, fy] = this.worldToScreen(a.fx, a.fy), [tx, ty] = this.worldToScreen(a.tx, a.ty);
        const ex = fx + (tx - fx) * Math.min(1, u * 2.5), ey = fy + (ty - fy) * Math.min(1, u * 2.5);
        const al = Math.max(0, a.life / a.max);
        ctx.strokeStyle = rgba(a.color, al * 0.9); ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.setLineDash([10, 8]); ctx.lineDashOffset = -this.time * 60;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
        const ang = Math.atan2(ey - fy, ex - fx);
        ctx.fillStyle = rgba(a.color, al);
        ctx.beginPath(); ctx.moveTo(ex + Math.cos(ang) * 10, ey + Math.sin(ang) * 10);
        ctx.lineTo(ex + Math.cos(ang + 2.5) * 12, ey + Math.sin(ang + 2.5) * 12);
        ctx.lineTo(ex + Math.cos(ang - 2.5) * 12, ey + Math.sin(ang - 2.5) * 12); ctx.fill();
      }
      this.game.arrows = arr.filter(a => a.life > 0);
    }
    _drawHover(ctx) {
      const ht = this.game.hoverTile;
      if (ht < 0 || this.cam.zoom < 4) return;
      const [x, y] = this.worldToScreen(ht % this.W, (ht / this.W) | 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, this.cam.zoom, this.cam.zoom);
    }

    drawMinimap(mctx, mw, mh) {
      mctx.imageSmoothingEnabled = true;
      mctx.clearRect(0, 0, mw, mh);
      mctx.drawImage(this.terrain, 0, 0, mw, mh);
      mctx.drawImage(this.terr, 0, 0, mw, mh);
      const v = this.viewRect(), sx = mw / this.W, sy = mh / this.H;
      mctx.strokeStyle = '#ffe28a'; mctx.lineWidth = 1.5;
      mctx.strokeRect(v.x0 * sx, v.y0 * sy, (v.x1 - v.x0) * sx, (v.y1 - v.y0) * sy);
      for (const n of this.sim.nukes) {
        mctx.fillStyle = '#ff3040'; mctx.beginPath(); mctx.arc(n.tx * sx, n.ty * sy, 3 + Math.sin(this.time * 10) * 1.5, 0, 6.283); mctx.fill();
      }
    }
  }

  BW.Renderer = Renderer;
})(globalThis.BW = globalThis.BW || {});
