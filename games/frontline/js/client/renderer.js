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
      this.floats = [];
      this.atmo = new BW.Atmosphere(this);
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
      // keep the view on the map (centre it if the whole map fits)
      const hw = this.cw / 2 / c.tz, hh = this.ch / 2 / c.tz;
      c.tx = this.W > hw * 2 ? Math.max(hw, Math.min(this.W - hw, c.tx)) : this.W / 2;
      c.ty = this.H > hh * 2 ? Math.max(hh, Math.min(this.H - hh, c.ty)) : this.H / 2;
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

      for (const sh of sim.tradeShips) {
        const i0 = Math.floor(Math.min(sh.path.length - 1, sh.prog));
        ctx.strokeStyle = 'rgba(255,240,200,0.22)'; ctx.lineWidth = 0.45; ctx.beginPath();
        for (let i = Math.max(0, i0 - 8); i <= i0; i++) {
          const t = sh.path[i], x = t % this.W + 0.5, y = ((t / this.W) | 0) + 0.5;
          if (i === Math.max(0, i0 - 8)) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      this.atmo.drawWorld(ctx);

      // fx in world space
      ctx.globalCompositeOperation = 'lighter';
      for (const f of this.flashes) {
        f.life -= dt;
        const a = Math.max(0, f.life / f.max);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * (1.4 - a * 0.4));
        if (f.color === 'emp') { g.addColorStop(0, `rgba(230,250,255,${a})`); g.addColorStop(0.4, `rgba(90,180,255,${a * 0.6})`); g.addColorStop(1, 'rgba(40,120,255,0)'); }
        else { g.addColorStop(0, `rgba(255,255,240,${a})`); g.addColorStop(0.35, `rgba(255,200,120,${a * 0.7})`); g.addColorStop(1, 'rgba(255,80,20,0)'); }
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
        if (p.grav) p.vy += p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        const a = Math.max(0, p.life / p.max);
        if (p.glow) ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba(p.color, p.smoke ? a * a * 0.22 : a);
        const sz = p.smoke ? p.size * (1.8 - a) : Math.max(p.size * a, 1.2 / z);
        ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, 6.283); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      this.particles = this.particles.filter(p => p.life > 0);
      const pmax = this.game.settings.fx ? 3000 : 900;
      if (this.particles.length > pmax) this.particles.splice(0, this.particles.length - pmax);

      // clouds (fade out when zoomed in)
      const ca = Math.max(0, Math.min(0.42, 0.62 - z * 0.15));
      if (ca > 0.01 && this.game.settings.clouds) {
        const sc = 3.2, off = this.time * 1.4;
        const m = new DOMMatrix().translateSelf(off, off * 0.35).scaleSelf(sc, sc);
        this.cloudPat.setTransform(m);
        ctx.globalAlpha = ca; ctx.fillStyle = this.cloudPat;
        ctx.fillRect(0, 0, this.W, this.H);
        ctx.globalAlpha = 1;
      }

      // ---------- screen space overlays
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.atmo.drawScreen(ctx, dt);
      this._drawDeposits(ctx);
      this._drawCrates(ctx);
      this._drawStructures(ctx);
      this._drawTradeShips(ctx, alpha);
      this._drawBoats(ctx, alpha);
      this._drawNukes(ctx, alpha);
      this._drawLabels(ctx);
      this._drawFloats(ctx, dt);
      this._drawArrows(ctx, dt);
      this._drawHover(ctx);
    }

    _drawPreviews(ctx) {
      const g = this.game, ht = g.hoverTile;
      if (ht < 0) return;
      const x = ht % this.W + 0.5, y = ((ht / this.W) | 0) + 0.5;
      const pulse = 0.6 + 0.4 * Math.sin(this.time * 6);
      const lw = Math.max(0.3, 1.5 / this.cam.zoom);
      if (this.sim.phase === 'spawn') {
        const R = C.SPAWN_RADIUS + 0.5;
        ctx.fillStyle = rgba(g.me.color, 0.35 * pulse); ctx.strokeStyle = rgba(g.me.color, 0.9); ctx.lineWidth = 0.35;
        ctx.beginPath(); ctx.arc(x, y, R, 0, 6.283); ctx.fill(); ctx.stroke();
        return;
      }
      const mode = g.mode;
      if (!mode) return;
      if (C.NUKES[mode]) {
        const R = C.NUKES[mode].radius, emp = mode === 'emp';
        ctx.fillStyle = emp ? `rgba(80,180,255,${0.12 + 0.08 * pulse})` : `rgba(255,40,40,${0.12 + 0.08 * pulse})`;
        ctx.strokeStyle = emp ? 'rgba(120,200,255,0.95)' : 'rgba(255,70,70,0.95)';
        ctx.lineWidth = lw;
        ctx.setLineDash([2, 1.5]);
        ctx.beginPath(); ctx.arc(x, y, R, 0, 6.283); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(x - R * 1.2, y); ctx.lineTo(x + R * 1.2, y); ctx.moveTo(x, y - R * 1.2); ctx.lineTo(x, y + R * 1.2); ctx.stroke();
        return;
      }
      const d = C.BUILD[mode];
      if (!d) return;
      // snapped placement preview (cached per hover tile)
      const key = mode + '|' + ht + '|' + (this.sim.tick >> 3);
      if (this._pvKey !== key) { this._pvKey = key; this._pvTile = this.sim.canBuildAt(g.me, mode, ht); }
      const t = this._pvTile, ok = t >= 0;
      const px = ok ? t % this.W + 0.5 : x, py = ok ? ((t / this.W) | 0) + 0.5 : y;
      if (d.radius) {
        const R = d.radius;
        ctx.strokeStyle = 'rgba(120,220,255,0.8)'; ctx.fillStyle = 'rgba(120,220,255,0.07)'; ctx.lineWidth = lw;
        ctx.beginPath();
        if (mode === 'fort') ctx.rect(px - R, py - R, R * 2, R * 2); else ctx.arc(px, py, R, 0, 6.283);
        ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = ok ? `rgba(80,255,160,${0.25 + 0.2 * pulse})` : `rgba(255,60,60,${0.25 + 0.2 * pulse})`;
      ctx.beginPath(); ctx.arc(px, py, 2.2, 0, 6.283); ctx.fill();
      this._ghost = ok ? { e: d.e, x: px, y: py } : null;
    }

    _drawDeposits(ctx) {
      const z = this.cam.zoom;
      if (z < 1.1) return;
      const v = this.viewRect(), sim = this.sim, s = Math.max(11, Math.min(28, z * 3));
      for (const d of sim.deposits) {
        if (d.x < v.x0 - 2 || d.x > v.x1 + 2 || d.y < v.y0 - 2 || d.y > v.y1 + 2) continue;
        const [x, y] = this.worldToScreen(d.x + 0.5, d.y + 0.5);
        const st = sim.structAt.get(d.tile);
        const boosted = d.boost > sim.tick;
        const bob = Math.sin(this.time * 2 + d.id) * s * 0.06;
        const glow = d.kind === 'gems' ? '120,220,255' : d.kind === 'uranium' ? '140,255,90' : d.kind === 'gold' ? '255,210,80' : d.kind === 'oil' ? '40,40,40' : '230,230,240';
        const gr = ctx.createRadialGradient(x, y, 0, x, y, s * (boosted ? 1.4 : 0.9));
        gr.addColorStop(0, `rgba(${glow},${boosted ? 0.7 : 0.38})`); gr.addColorStop(1, `rgba(${glow},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, s * (boosted ? 1.4 : 0.9), 0, 6.283); ctx.fill();
        const e = C.DEPOSITS[d.kind].e;
        if (st) BW.Sprites.drawEmoji(ctx, e, x + s * 0.55, y - s * 0.55, s * 0.55);
        else BW.Sprites.drawEmoji(ctx, e, x, y + bob, s * (0.75 + d.rich * 0.08));
        if (z > 3 && !st) for (let i = 0; i < d.rich; i++) BW.Sprites.drawEmoji(ctx, '⭐', x - s * 0.3 + i * s * 0.3, y + s * 0.62, s * 0.28);
        if (boosted && Math.random() < 0.15) this.particles.push({ x: d.x + Math.random(), y: d.y + Math.random(), vx: 0, vy: -3, life: 0.8, max: 0.8, size: 0.35, color: [255, 230, 120], glow: true });
      }
    }

    _drawCrates(ctx) {
      const sim = this.sim, z = this.cam.zoom;
      for (const c of sim.crates) {
        const [x, y] = this.worldToScreen(c.x + 0.5, c.y + 0.5);
        const s = Math.max(16, Math.min(34, z * 4));
        const bob = Math.sin(this.time * 4) * s * 0.12;
        const pulse = (this.time * 0.8) % 1;
        ctx.strokeStyle = `rgba(255,220,100,${1 - pulse})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, s * (0.6 + pulse * 1.6), 0, 6.283); ctx.stroke();
        // light beam
        const g = ctx.createLinearGradient(x, y - s * 4, x, y);
        g.addColorStop(0, 'rgba(255,230,140,0)'); g.addColorStop(1, 'rgba(255,230,140,0.45)');
        ctx.fillStyle = g; ctx.fillRect(x - s * 0.18, y - s * 4, s * 0.36, s * 4);
        BW.Sprites.drawEmoji(ctx, '📦', x, y - s * 0.3 + bob, s);
      }
    }

    _drawStructures(ctx) {
      const z = this.cam.zoom, s = Math.max(12, Math.min(30, z * 3.6));
      const v = this.viewRect(), sim = this.sim;
      const small = z < 1.1;
      for (const st of sim.structures) {
        if (st.x < v.x0 - 2 || st.x > v.x1 + 2 || st.y < v.y0 - 2 || st.y > v.y1 + 2) continue;
        const [x, y] = this.worldToScreen(st.x + 0.5, st.y + 0.5);
        const col = sim.players[st.owner].color;
        const d = C.BUILD[st.kind];
        if (small) {
          if (st.kind !== 'wonder' && st.kind !== 'city' && st.kind !== 'silo') continue;
          BW.Sprites.drawEmoji(ctx, d.e, x, y, st.kind === 'wonder' ? 22 : 12);
          continue;
        }
        const building = st.done > sim.tick, off = st.off > sim.tick;
        const big = st.kind === 'wonder' ? 1.8 : st.kind === 'city' ? 1.15 : 1;
        const S = s * big;
        // badge
        ctx.fillStyle = 'rgba(8,10,18,0.78)';
        ctx.strokeStyle = rgba(col, building ? 0.5 : 1); ctx.lineWidth = Math.max(1.5, S * 0.09);
        ctx.beginPath(); ctx.arc(x, y, S * 0.6, 0, 6.283); ctx.fill(); ctx.stroke();
        if (st.kind === 'wonder' && !building) {
          const p = 0.5 + 0.5 * Math.sin(this.time * 3);
          ctx.strokeStyle = `rgba(255,215,90,${0.4 + p * 0.5})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(x, y, S * (0.8 + p * 0.15), 0, 6.283); ctx.stroke();
          const left = Math.max(0, C.WONDER_HOLD - (sim.tick - st.heldSince));
          this._text(ctx, '⏳ ' + Math.ceil(left / 10) + 's', x, y + S * 1.05, Math.max(11, S * 0.42), '#ffd75a');
        }
        if (building) {
          const u = (sim.tick - st.start) / Math.max(1, st.done - st.start);
          ctx.globalAlpha = 0.45; BW.Sprites.drawEmoji(ctx, d.e, x, y, S * 0.78); ctx.globalAlpha = 1;
          BW.Sprites.drawEmoji(ctx, '🏗️', x + S * 0.42, y - S * 0.42, S * 0.5);
          ctx.strokeStyle = '#ffd75a'; ctx.lineWidth = Math.max(2, S * 0.1);
          ctx.beginPath(); ctx.arc(x, y, S * 0.6, -Math.PI / 2, -Math.PI / 2 + u * 6.283); ctx.stroke();
        } else {
          BW.Sprites.drawEmoji(ctx, d.e, x, y, S * 0.78, off ? 0.35 : 1);
        }
        if (off) BW.Sprites.drawEmoji(ctx, '⚡', x + S * 0.4, y - S * 0.4, S * 0.5);
        const cdMax = st.kind === 'sam' ? 70 : 50;
        if (st.cd > sim.tick && !building) {
          ctx.strokeStyle = 'rgba(255,80,80,0.95)'; ctx.lineWidth = Math.max(1.5, S * 0.1);
          ctx.beginPath(); ctx.arc(x, y, S * 0.6, -Math.PI / 2, -Math.PI / 2 + ((st.cd - sim.tick) / cdMax) * 6.283); ctx.stroke();
        }
      }
      if (this._ghost && this.game.mode) {
        const [gx, gy] = this.worldToScreen(this._ghost.x, this._ghost.y);
        BW.Sprites.drawEmoji(ctx, this._ghost.e, gx, gy - 4, s * 0.9, 0.55 + 0.3 * Math.sin(this.time * 6));
      }
    }

    _drawTradeShips(ctx, alpha) {
      const sim = this.sim, z = this.cam.zoom, W = this.W;
      if (z < 0.9) return;
      const s = Math.max(10, Math.min(22, z * 2.4));
      const v = this.viewRect();
      for (const sh of sim.tradeShips) {
        const p = Math.min(sh.path.length - 1, sh.prog + sh.speed * alpha);
        const i0 = Math.floor(p), i1 = Math.min(sh.path.length - 1, i0 + 1), f = p - i0;
        const t0 = sh.path[i0], t1 = sh.path[i1];
        const wx = t0 % W + ((t1 % W) - (t0 % W)) * f + 0.5, wy = ((t0 / W) | 0) + (((t1 / W) | 0) - ((t0 / W) | 0)) * f + 0.5;
        if (wx < v.x0 - 2 || wx > v.x1 + 2 || wy < v.y0 - 2 || wy > v.y1 + 2) continue;
        const [x, y] = this.worldToScreen(wx, wy);
        ctx.fillStyle = rgba(sim.players[sh.owner].color, 0.85);
        ctx.beginPath(); ctx.ellipse(x, y + s * 0.35, s * 0.45, s * 0.14, 0, 0, 6.283); ctx.fill();
        BW.Sprites.drawEmoji(ctx, '⛵', x, y + Math.sin(this.time * 3 + sh.id) * 1.2, s);
      }
    }

    floatText(wx, wy, text, color = '#fff', size = 16) {
      this.floats.push({ x: wx, y: wy, text, color, size, life: 2.2, max: 2.2 });
      if (this.floats.length > 60) this.floats.shift();
    }
    _drawFloats(ctx, dt) {
      for (const f of this.floats) {
        f.life -= dt;
        const u = 1 - f.life / f.max;
        const [x, y] = this.worldToScreen(f.x, f.y);
        const a = Math.min(1, f.life / 0.6);
        ctx.globalAlpha = Math.max(0, a);
        const sc = u < 0.12 ? 0.6 + u / 0.12 * 0.5 : 1.1 - Math.min(0.1, (u - 0.12));
        this._text(ctx, f.text, x, y - u * 46, f.size * sc, f.color);
        ctx.globalAlpha = 1;
      }
      this.floats = this.floats.filter(f => f.life > 0);
    }

    empFx(x, y, R) {
      this.flashes.push({ x, y, r: R * 0.8, life: 0.5, max: 0.5, color: 'emp' });
      for (let i = 0; i < 3; i++) this.rings.push({ x, y, r0: 1, r1: R * (1 + i * 0.25), life: 1 + i * 0.3, max: 1 + i * 0.3, color: [110, 200, 255] });
      const n = this.game.settings.fx ? 120 : 50;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, s = R * (0.3 + Math.random());
        this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.9, max: 0.9, size: 0.5, color: [150, 220, 255], glow: true, drag: 2 });
      }
      this.shake = Math.min(28, this.shake + 8);
    }
    meteorFx(x, y, R) {
      // streak from the sky then a small blast
      for (let i = 0; i < 24; i++) {
        const k = i / 24;
        this.particles.push({ x: x - 30 * (1 - k), y: y - 40 * (1 - k), vx: 0, vy: 0, life: 0.25 + k * 0.4, max: 0.65, size: 0.6 + k, color: [255, 200, 120], glow: true });
      }
      this.explosion(x, y, R * 1.2, false);
    }
    volcanoFx(x, y, R) {
      this.explosion(x, y, R, false);
      for (let i = 0; i < (this.game.settings.fx ? 160 : 60); i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, s = 6 + Math.random() * 22;
        this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.5 + Math.random() * 2, max: 3.5, size: 0.5 + Math.random(),
          color: [255, 90 + Math.random() * 80, 20], glow: true, drag: 0.6, grav: 14 });
      }
    }
    sparkle(x, y, color = [255, 220, 120], n = 24) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, s = 2 + Math.random() * 6;
        this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, life: 1, max: 1, size: 0.45, color, glow: true, drag: 1.4 });
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
        const ny = y - size * 0.35;
        this._text(ctx, p.name, x, ny, size, nameCol);
        const w = ctx.measureText(p.name).width;
        BW.Sprites.drawEmoji(ctx, p.emblem, x - w / 2 - size * 0.62, ny, size * 0.95);
        if (leader && pid === leader.id) BW.Sprites.drawEmoji(ctx, '👑', x, ny - size * 0.95, size * 0.75);
        if (ally) BW.Sprites.drawEmoji(ctx, '🤝', x + w / 2 + size * 0.55, ny, size * 0.75);
        const tSize = size * 0.62;
        this._text(ctx, fmt(p.troops), x + tSize * 0.45, y + size * 0.55, tSize, 'rgba(255,255,255,0.92)', 600);
        const tw = ctx.measureText(fmt(p.troops)).width;
        BW.Sprites.drawEmoji(ctx, '⚔️', x + tSize * 0.45 - tw / 2 - tSize * 0.6, y + size * 0.55, tSize * 0.9);
        if (!p.fed && size > 12) BW.Sprites.drawEmoji(ctx, '🍖', x + tSize * 0.45 + tw / 2 + tSize * 0.6, y + size * 0.55, tSize * 0.8, 0.5 + 0.5 * Math.sin(this.time * 6));
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
      for (const d of this.sim.deposits) {
        mctx.fillStyle = d.kind === 'gold' ? '#ffd75a' : d.kind === 'gems' ? '#7fe3ff' : d.kind === 'uranium' ? '#8cff5a' : d.kind === 'oil' ? '#222' : '#ddd';
        mctx.fillRect(d.x * sx - 1.5, d.y * sy - 1.5, 3, 3);
      }
      for (const c of this.sim.crates) { mctx.fillStyle = '#ffcc55'; mctx.beginPath(); mctx.arc(c.x * sx, c.y * sy, 3 + Math.sin(this.time * 6), 0, 6.283); mctx.fill(); }
      if (this.sim.storm) { const [x, y] = this.sim.stormPos(); mctx.strokeStyle = 'rgba(200,210,255,0.7)'; mctx.beginPath(); mctx.arc(x * sx, y * sy, this.sim.storm.r * sx, 0, 6.283); mctx.stroke(); }
      for (const n of this.sim.nukes) {
        mctx.fillStyle = '#ff3040'; mctx.beginPath(); mctx.arc(n.tx * sx, n.ty * sy, 3 + Math.sin(this.time * 10) * 1.5, 0, 6.283); mctx.fill();
      }
    }
  }

  BW.Renderer = Renderer;
})(globalThis.BW = globalThis.BW || {});
