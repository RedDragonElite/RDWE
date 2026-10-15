/* RDE // KONTRAKT — core utilities: math, seeded RNG, noise, names, formatting */
(function (K) {
  'use strict';

  K.TILE = 32;
  const TAU = Math.PI * 2;

  const U = K.U = {
    TAU,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    smooth: (t) => t * t * (3 - 2 * t),
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    dist2: (ax, ay, bx, by) => (bx - ax) * (bx - ax) + (by - ay) * (by - ay),
    /** shortest signed angle from a to b (-PI..PI) */
    angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; },
    turnTo(a, b, max) { const d = U.angDiff(a, b); return a + U.clamp(d, -max, max); },
    rnd: (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a)),
    rint: (n) => (Math.random() * n) | 0,
    pick: (arr) => arr[(Math.random() * arr.length) | 0],
    pickW: (list) => { let t = 0; for (const [, w] of list) t += w; let r = Math.random() * t; for (const [v, w] of list) { if ((r -= w) < 0) return v; } return list[0][0]; },
    chance: (p) => Math.random() < p,
    gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; },
    /** segment (x0,y0)->(x1,y1) vs circle → t in 0..1 or -1 */
    segCircle(x0, y0, x1, y1, cx, cy, r) {
      const dx = x1 - x0, dy = y1 - y0, fx = x0 - cx, fy = y0 - cy;
      const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r * r;
      if (c <= 0) return 0;
      const disc = b * b - 4 * a * c;
      if (disc < 0 || a === 0) return -1;
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      return t >= 0 && t <= 1 ? t : -1;
    },
    rgba: (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`,
    hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; },
    shade(h, f) { // f<1 darker, >1 lighter
      const [r, g, b] = U.hex2rgb(h);
      const m = (v) => U.clamp(Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f), 0, 255);
      return `rgb(${m(r)},${m(g)},${m(b)})`;
    },
  };

  /** mulberry32 seeded RNG (city generation must be reproducible from the save seed) */
  class RNG {
    constructor(seed) { this.s = seed >>> 0 || 1; }
    next() { let t = (this.s += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    int(n) { return (this.next() * n) | 0; }
    range(a, b) { return a + this.next() * (b - a); }
    pick(a) { return a[this.int(a.length)]; }
    chance(p) { return this.next() < p; }
    shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = this.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  }
  K.RNG = RNG;

  // ---------------------------------------------------------------- value noise
  function hash2(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  U.hash2 = hash2;
  U.mod = (a, n) => ((a % n) + n) % n;
  U.noise = function (x, y, s = 0) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  U.fbm = function (x, y, s = 0, oct = 4) { let v = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { v += U.noise(x * f, y * f, s + i * 17) * a; f *= 2; a *= 0.5; } return v; };

  // ---------------------------------------------------------------- names
  K.NAMES = {
    first: ['Viktor', 'Elena', 'Marco', 'Svetlana', 'Dieter', 'Lukas', 'Mila', 'Jonas', 'Ines', 'Raffaele', 'Katja', 'Henrik', 'Yusuf', 'Aylin', 'Bruno', 'Greta', 'Dmitri', 'Sofia', 'Klaus', 'Nadia', 'Oskar', 'Lena', 'Pavel', 'Carla', 'Enzo', 'Frieda', 'Ivan', 'Jana', 'Mats', 'Nora', 'Tobias', 'Zoe', 'Hakan', 'Bianca', 'Ruben', 'Tamara', 'Gustav', 'Leonie', 'Anton', 'Vera'],
    last: ['Krause', 'Volkov', 'Moretti', 'Schreiber', 'Kowalski', 'Brandt', 'Petrov', 'Lindqvist', 'Yilmaz', 'Falk', 'Romano', 'Weber', 'Novak', 'Hartmann', 'Sokolov', 'Ricci', 'König', 'Becker', 'Orlov', 'Wolff', 'Castell', 'Dragunov', 'Engel', 'Fischer', 'Graf', 'Haas', 'Ivanova', 'Jäger', 'Kessler', 'Lorenz', 'Marek', 'Nowak', 'Ostrowski', 'Reuter', 'Stark', 'Vogel', 'Winter', 'Zimmer'],
    nick: ['“the Banker”', '“the Widow”', '“Toothpick”', '“the Count”', '“Icefist”', '“the Spider”', '“the Preacher”', '“Gold Tooth”', '“the Shadow”', '“the Vixen”', '“Necktie”', '“the Doctor”'],
  };

  U.money = (n) => '$' + Math.round(n).toLocaleString(K.lang === 'de' ? 'de-DE' : 'en-US');
  U.clock = (mins) => {
    const m = Math.floor(mins) % 1440;
    return String((m / 60) | 0).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  };
  U.day = (mins) => 1 + Math.floor(mins / 1440);
  U.hourOf = (mins) => (mins % 1440) / 60;
  const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  U.weekday = (mins) => WD[Math.floor(mins / 1440) % 7];
  if (K.i18nStrings) { K.i18nStrings(WD); K.i18nStrings(K.NAMES.nick); }
  U.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
})(globalThis.K = globalThis.K || {});
