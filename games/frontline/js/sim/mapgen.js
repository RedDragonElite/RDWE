/* RDE // FRONTLINE — deterministic procedural world generator
 * Pure function of (seed, W, H, type) -> identical map on every client. No DOM. */
(function (BW) {
  'use strict';
  const { T } = BW.C;

  function makeNoise(seed) {
    seed |= 0;
    function h(x, y) {
      let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      n ^= n >>> 16;
      return (n >>> 0) / 4294967296;
    }
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }

  function fbm(noise, x, y, oct) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * noise(x * freq, y * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  }

  function smoothstep(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  const TYPES = {
    continents:  { scale: 3.4, land: 0.42, edge: 0.55, radial: 0.0,  ridge: 0.12 },
    archipelago: { scale: 6.5, land: 0.30, edge: 0.35, radial: 0.0,  ridge: 0.08 },
    pangaea:     { scale: 2.6, land: 0.50, edge: 0.4,  radial: 0.55, ridge: 0.12 },
    highlands:   { scale: 3.0, land: 0.55, edge: 0.45, radial: 0.15, ridge: 0.30 },
  };

  function generate(opts) {
    const W = opts.W, H = opts.H, N = W * H;
    const seed = opts.seed >>> 0;
    const P = TYPES[opts.type] || TYPES.continents;
    const n1 = makeNoise(seed), n2 = makeNoise(seed ^ 0x5bd1e995), n3 = makeNoise(seed * 7 + 13);
    const nr = makeNoise(seed + 4242), nm = makeNoise(seed + 999);

    const height = new Float32Array(N);
    const moist = new Float32Array(N);
    const terrain = new Uint8Array(N);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = (x / W) * P.scale, ny = (y / W) * P.scale;
        const wx = nx + (fbm(n2, nx * 1.4 + 11, ny * 1.4, 4) - 0.5) * 1.1;
        const wy = ny + (fbm(n3, nx * 1.4, ny * 1.4 + 7, 4) - 0.5) * 1.1;
        let h = fbm(n1, wx, wy, 6);
        const r = 1 - Math.abs(2 * fbm(nr, wx * 1.8, wy * 1.8, 4) - 1);
        h += r * r * P.ridge;
        const dx = (x / W - 0.5) * 2, dy = (y / H - 0.5) * 2;
        h -= P.edge * 0.5 * smoothstep(0.6, 1.0, Math.max(Math.abs(dx), Math.abs(dy)));
        if (P.radial) h -= P.radial * 0.35 * Math.sqrt(dx * dx + dy * dy);
        const i = y * W + x;
        height[i] = h;
        moist[i] = fbm(nm, nx * 2.2, ny * 2.2, 4);
      }
    }

    // sea level by percentile so every seed gets the intended land share
    const sample = [];
    for (let i = 0; i < N; i += 7) sample.push(height[i]);
    sample.sort((a, b) => a - b);
    const sea = sample[Math.floor((1 - P.land) * (sample.length - 1))];
    let maxH = sea + 1e-6;
    for (let i = 0; i < N; i++) if (height[i] > maxH) maxH = height[i];

    for (let i = 0; i < N; i++) {
      const h = height[i];
      if (h < sea) { terrain[i] = T.DEEP; continue; }
      const e = (h - sea) / (maxH - sea), m = moist[i];
      const lat = Math.abs((Math.floor(i / W) / H) - 0.5) * 2; // 0 equator, 1 poles
      if (e < 0.035) terrain[i] = T.BEACH;
      else if (e > 0.82 || (lat > 0.9 && e > 0.2)) terrain[i] = T.SNOW;
      else if (e > 0.62) terrain[i] = T.MOUNTAIN;
      else if (e > 0.42) terrain[i] = m > 0.52 ? T.FOREST : T.HILLS;
      else terrain[i] = m > 0.55 ? T.FOREST : T.PLAINS;
    }

    // remove specks of land that would be unreadable / unplayable
    const comp = new Int32Array(N).fill(-1);
    const stack = new Int32Array(N);
    const minIsland = Math.max(24, Math.floor(N / 3500));
    const members = [];
    for (let s = 0; s < N; s++) {
      if (comp[s] !== -1 || terrain[s] < T.BEACH) continue;
      let sp = 0; stack[sp++] = s; comp[s] = s; members.length = 0;
      while (sp) {
        const t = stack[--sp]; members.push(t);
        const x = t % W;
        if (t >= W && comp[t - W] === -1 && terrain[t - W] >= T.BEACH) { comp[t - W] = s; stack[sp++] = t - W; }
        if (t < N - W && comp[t + W] === -1 && terrain[t + W] >= T.BEACH) { comp[t + W] = s; stack[sp++] = t + W; }
        if (x > 0 && comp[t - 1] === -1 && terrain[t - 1] >= T.BEACH) { comp[t - 1] = s; stack[sp++] = t - 1; }
        if (x < W - 1 && comp[t + 1] === -1 && terrain[t + 1] >= T.BEACH) { comp[t + 1] = s; stack[sp++] = t + 1; }
      }
      if (members.length < minIsland) for (const t of members) terrain[t] = T.DEEP;
    }

    // distance of water to nearest land (BFS, capped) → shallow shelf & depth shading
    const waterDist = new Uint8Array(N).fill(255);
    const q = new Int32Array(N);
    let qh = 0, qt = 0, landCount = 0;
    for (let i = 0; i < N; i++) if (terrain[i] >= T.BEACH) { waterDist[i] = 0; q[qt++] = i; landCount++; }
    while (qh < qt) {
      const t = q[qh++], d = waterDist[t] + 1;
      if (d > 40) continue;
      const x = t % W;
      if (t >= W && waterDist[t - W] > d) { waterDist[t - W] = d; q[qt++] = t - W; }
      if (t < N - W && waterDist[t + W] > d) { waterDist[t + W] = d; q[qt++] = t + W; }
      if (x > 0 && waterDist[t - 1] > d) { waterDist[t - 1] = d; q[qt++] = t - 1; }
      if (x < W - 1 && waterDist[t + 1] > d) { waterDist[t + 1] = d; q[qt++] = t + 1; }
    }
    for (let i = 0; i < N; i++) if (terrain[i] === T.DEEP && waterDist[i] <= 4) terrain[i] = T.SHALLOW;

    // resource deposits (gold, silver, iron, gems, oil, uranium)
    const deposits = [];
    const D = BW.C.DEPOSITS, kinds = Object.keys(D);
    const totalW = kinds.reduce((a, k) => a + D[k].w, 0);
    const drng = new BW.RNG((seed ^ 0x13579bdf) >>> 0);
    const want = Math.max(14, Math.min(110, Math.round(landCount / 1900)));
    for (let k = 0; k < want * 80 && deposits.length < want; k++) {
      let r = drng.next() * totalW, kind = kinds[0];
      for (const kk of kinds) { r -= D[kk].w; if (r <= 0) { kind = kk; break; } }
      const t = drng.int(N);
      if (D[kind].on.indexOf(terrain[t]) < 0) continue;
      const x = t % W, y = (t / W) | 0;
      let ok = true;
      for (const d of deposits) if ((d.x - x) ** 2 + (d.y - y) ** 2 < 100) { ok = false; break; }
      if (!ok) continue;
      const rr = drng.next();
      deposits.push({ id: deposits.length, kind, tile: t, x, y, rich: rr < 0.55 ? 1 : rr < 0.88 ? 2 : 3 });
    }

    return { W, H, N, seed, type: opts.type, terrain, height, sea, maxH, waterDist, landCount, deposits };
  }

  BW.MapGen = { generate, makeNoise, fbm };
})(globalThis.BW = globalThis.BW || {});
