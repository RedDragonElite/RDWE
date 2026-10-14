/* RDE // KONTRAKT — navigation: walkability, A* with typed arrays, line of sight, path smoothing */
(function (K) {
  'use strict';
  const T = K.T, TF = K.TF, TILE = K.TILE;

  class Nav {
    constructor(world) {
      this.w = world;
      const N = world.N;
      this.W = world.W; this.H = world.H;
      this.g = new Float32Array(N);
      this.came = new Int32Array(N);
      this.stamp = new Uint32Array(N);
      this.closed = new Uint32Array(N);
      this.gen = 1;
      this.heap = new Int32Array(N);
      this.f = new Float32Array(N);
      // base walk cost per tile (0 = blocked)
      this.cost = new Float32Array(N);
      this.rebuild();
    }
    rebuild() {
      const w = this.w, c = this.cost;
      for (let i = 0; i < w.N; i++) c[i] = this.baseCost(i);
    }
    baseCost(i) {
      const w = this.w, t = w.tiles[i];
      if (TF[t] & 1 || w.solid[i] & 1) return 0;
      switch (t) {
        case T.ROAD: return 3.2;
        case T.GRASS: return 1.5;
        case T.WALK: return 1;
        case T.DOOR: return 1.3;
        default: return 1.05;
      }
    }
    /** can actor `a` step on tile i (locked doors depend on access) */
    passable(i, a) {
      if (!this.cost[i]) return false;
      if (this.w.tiles[i] === T.DOOR) { const d = this.w.doors.get(i); if (d && d.locked && !this.w.hasAccess(a, d)) return false; }
      return true;
    }

    /** A* from px coords to px coords; returns array of tile indices (start excluded) or null */
    find(a, sx, sy, tx, ty, maxExp = 9000, roadOk = 1) {
      const W = this.W, H = this.H;
      const s = ((sy / TILE) | 0) * W + ((sx / TILE) | 0);
      let goal = ((ty / TILE) | 0) * W + ((tx / TILE) | 0);
      if (s < 0 || goal < 0 || s >= this.w.N || goal >= this.w.N) return null;
      if (!this.passable(goal, a)) goal = this.nearestFree(goal, a, 4);
      if (goal < 0) return null;
      if (s === goal) return [];
      const gen = ++this.gen;
      const g = this.g, came = this.came, stamp = this.stamp, closed = this.closed, heap = this.heap, f = this.f, cost = this.cost;
      const gx = goal % W, gy = (goal / W) | 0;
      let hn = 0;
      const push = (n) => { let i = hn++; heap[i] = n; while (i > 0) { const p = (i - 1) >> 1; if (f[heap[p]] <= f[n]) break; heap[i] = heap[p]; i = p; } heap[i] = n; };
      const pop = () => { const top = heap[0], last = heap[--hn]; let i = 0; for (;;) { let l = i * 2 + 1; if (l >= hn) break; if (l + 1 < hn && f[heap[l + 1]] < f[heap[l]]) l++; if (f[heap[l]] >= f[last]) break; heap[i] = heap[l]; i = l; } heap[i] = last; return top; };
      const hfun = (n) => { const dx = Math.abs((n % W) - gx), dy = Math.abs(((n / W) | 0) - gy); return (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy)) * 1.0; };
      stamp[s] = gen; g[s] = 0; came[s] = -1; f[s] = hfun(s); push(s);
      let best = s, bestH = f[s], exp = 0;
      while (hn) {
        const c = pop();
        if (closed[c] === gen) continue;
        closed[c] = gen;
        if (c === goal) { best = c; break; }
        if (++exp > maxExp) break;
        const h = f[c] - g[c];
        if (h < bestH) { bestH = h; best = c; }
        const cx = c % W, cy = (c / W) | 0;
        for (let k = 0; k < 8; k++) {
          const dx = DX[k], dy = DY[k];
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx;
          if (closed[n] === gen || !this.passable(n, a)) continue;
          if (dx && dy && (!this.passable(cy * W + nx, a) || !this.passable(ny * W + cx, a))) continue; // no corner cutting
          let cc = cost[n]; if (cc > 2.5) cc = 1 + (cc - 1) * roadOk;
          const ng = g[c] + cc * (dx && dy ? Math.SQRT2 : 1);
          if (stamp[n] !== gen || ng < g[n]) { stamp[n] = gen; g[n] = ng; came[n] = c; f[n] = ng + hfun(n); push(n); }
        }
      }
      if (best === s) return null;
      const out = [];
      for (let n = best; n !== s && n >= 0; n = came[n]) out.push(n);
      out.reverse();
      return out;
    }
    nearestFree(i, a, R) {
      const W = this.W, x0 = i % W, y0 = (i / W) | 0;
      for (let r = 1; r <= R; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = x0 + dx, y = y0 + dy; if (x < 0 || y < 0 || x >= W || y >= this.H) continue;
        const n = y * W + x; if (this.passable(n, a)) return n;
      }
      return -1;
    }
    /** walkable straight line for a body of radius r (used to smooth paths) */
    clearLine(a, x0, y0, x1, y1) {
      const d = Math.hypot(x1 - x0, y1 - y0), steps = Math.ceil(d / 10);
      for (let k = 1; k <= steps; k++) {
        const x = x0 + (x1 - x0) * (k / steps), y = y0 + (y1 - y0) * (k / steps);
        for (const [ox, oy] of OFFS) {
          const tx = ((x + ox) / TILE) | 0, ty = ((y + oy) / TILE) | 0;
          if (!this.passable(ty * this.W + tx, a)) return false;
          if (this.w.tiles[ty * this.W + tx] === T.ROAD && a && a.kind !== 'player' && !a.crossOk) return false;
        }
      }
      return true;
    }
  }
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
  const OFFS = [[0, 0], [9, 9], [-9, 9], [9, -9], [-9, -9]];
  K.Nav = Nav;

  /** line of sight across the opaque map (pixels). DDA tile walk. */
  K.los = function (w, x0, y0, x1, y1) {
    const W = w.W, op = w.opaque;
    let tx = Math.floor(x0 / TILE), ty = Math.floor(y0 / TILE);
    const ex = Math.floor(x1 / TILE), ey = Math.floor(y1 / TILE);
    const dx = x1 - x0, dy = y1 - y0;
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(TILE / dx) : 1e9, tdy = dy !== 0 ? Math.abs(TILE / dy) : 1e9;
    let tmx = dx !== 0 ? ((sx > 0 ? (tx + 1) * TILE - x0 : x0 - tx * TILE) / Math.abs(dx)) : 1e9;
    let tmy = dy !== 0 ? ((sy > 0 ? (ty + 1) * TILE - y0 : y0 - ty * TILE) / Math.abs(dy)) : 1e9;
    for (let k = 0; k < 400; k++) {
      if (tx === ex && ty === ey) return true;
      if (tmx < tmy) { tmx += tdx; tx += sx; } else { tmy += tdy; ty += sy; }
      if (tx < 0 || ty < 0 || tx >= W || ty >= w.H) return false;
      if (op[ty * W + tx] && !(tx === ex && ty === ey)) return false;
    }
    return true;
  };

  /** cast a ray, return distance to first opaque tile (pixels), capped at max */
  K.rayDist = function (w, x0, y0, ang, max) {
    const W = w.W, op = w.opaque;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let tx = Math.floor(x0 / TILE), ty = Math.floor(y0 / TILE);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(TILE / dx) : 1e9, tdy = dy !== 0 ? Math.abs(TILE / dy) : 1e9;
    let tmx = dx !== 0 ? (sx > 0 ? (tx + 1) * TILE - x0 : x0 - tx * TILE) / Math.abs(dx) : 1e9;
    let tmy = dy !== 0 ? (sy > 0 ? (ty + 1) * TILE - y0 : y0 - ty * TILE) / Math.abs(dy) : 1e9;
    let t = 0;
    while (t < max) {
      if (tmx < tmy) { t = tmx; tmx += tdx; tx += sx; } else { t = tmy; tmy += tdy; ty += sy; }
      if (tx < 0 || ty < 0 || tx >= W || ty >= w.H) return Math.min(t, max);
      if (op[ty * W + tx]) return Math.min(t + 6, max);
    }
    return max;
  };
})(globalThis.K = globalThis.K || {});
