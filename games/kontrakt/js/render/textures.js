/* RDE // KONTRAKT — procedural textures: ground tiles, light sprites, decal stamps, weapon icons */
(function (K) {
  'use strict';
  const U = K.U, T = K.T;
  const S = 64; // texture px per tile (chunk scale 2)
  K.TEX_S = S;
  K.mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  const cache = new Map();
  function noiseFill(ctx, w, h, base, amp, scale, seed, fn) {
    const id = ctx.createImageData(w, h), d = id.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = U.fbm(x / scale, y / scale, seed, 3) - 0.5, f = U.hash2(x, y, seed + 9) - 0.5;
      let r = base[0] + n * amp + f * amp * 0.5, g = base[1] + n * amp + f * amp * 0.5, b = base[2] + n * amp + f * amp * 0.5;
      if (fn) [r, g, b] = fn(x, y, n, f, r, g, b);
      const i = (y * w + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
  }

  /** base ground texture for a tile type; v = variant 0..3, tint = optional hex for floors/walls */
  K.tileTex = function (t, v = 0, tint = null) {
    const key = t + ':' + v + ':' + tint;
    if (cache.has(key)) return cache.get(key);
    const c = K.mkCanvas(S, S), x = c.getContext('2d');
    const seed = t * 31 + v * 7 + 3;
    switch (t) {
      case T.ROAD:
        noiseFill(x, S, S, [52, 54, 58], 22, 9, seed, (px, py, n, f, r, g, b) => (f > 0.47 ? [r + 30, g + 30, b + 30] : [r, g, b]));
        if (v === 1) { x.strokeStyle = 'rgba(15,15,18,0.55)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(8, 50); x.lineTo(20, 38); x.lineTo(26, 40); x.lineTo(40, 22); x.stroke(); }
        if (v === 2) { const g = x.createRadialGradient(36, 30, 2, 36, 30, 16); g.addColorStop(0, 'rgba(10,10,14,0.45)'); g.addColorStop(1, 'rgba(10,10,14,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); }
        break;
      case T.WALK: case T.QUAY: {
        noiseFill(x, S, S, t === T.QUAY ? [118, 116, 110] : [140, 138, 132], 18, 12, seed);
        x.strokeStyle = 'rgba(40,40,40,0.35)'; x.lineWidth = 1.5;
        const o = v & 1 ? 16 : 0;
        for (let k = 0; k <= 2; k++) { x.beginPath(); x.moveTo(0, k * 32); x.lineTo(S, k * 32); x.stroke(); }
        for (let k = 0; k <= 2; k++) { x.beginPath(); x.moveTo(k * 32 + o, 0); x.lineTo(k * 32 + o, 32); x.moveTo(k * 32 + 16 - o, 32); x.lineTo(k * 32 + 16 - o, 64); x.stroke(); }
        x.fillStyle = 'rgba(255,255,255,0.05)'; for (let k = 0; k < 4; k++) x.fillRect((k & 1) * 32 + 2, (k >> 1) * 32 + 2, 28, 3);
        break;
      }
      case T.GRASS:
        noiseFill(x, S, S, [62, 98, 46], 34, 7, seed, (px, py, n, f, r, g, b) => [r + n * 10, g + n * 20, b]);
        for (let k = 0; k < 26; k++) { const px = U.hash2(k, v, 3) * S, py = U.hash2(k, v, 5) * S; x.strokeStyle = `rgba(${120 + k * 3},${170 + (k & 7) * 6},80,0.35)`; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 1.5, py - 4); x.stroke(); }
        if (v === 3) for (let k = 0; k < 4; k++) { x.fillStyle = ['#f4e36b', '#f1f1f1', '#e07aa0', '#9bc4ff'][k]; x.beginPath(); x.arc(10 + k * 13, 14 + (k * 17) % 40, 1.6, 0, 7); x.fill(); }
        break;
      case T.PLAZA:
        noiseFill(x, S, S, [150, 144, 134], 16, 10, seed);
        x.strokeStyle = 'rgba(60,55,50,0.4)'; x.lineWidth = 1.2;
        x.strokeRect(1, 1, 31, 31); x.strokeRect(33, 1, 30, 31); x.strokeRect(1, 33, 31, 30); x.strokeRect(33, 33, 30, 30);
        break;
      case T.DIRT: case T.SAND:
        noiseFill(x, S, S, t === T.SAND ? [232, 208, 162] : [126, 100, 70], 26, 6, seed);
        for (let k = 0; k < 9; k++) { x.fillStyle = 'rgba(70,55,40,0.5)'; x.beginPath(); x.arc(U.hash2(k, v, 11) * S, U.hash2(k, v, 12) * S, 1 + U.hash2(k, v, 13) * 2, 0, 7); x.fill(); }
        break;
      case T.CONC:
        noiseFill(x, S, S, [104, 106, 108], 16, 14, seed);
        if (v === 2) { const g = x.createRadialGradient(30, 34, 3, 30, 34, 22); g.addColorStop(0, 'rgba(30,25,20,0.35)'); g.addColorStop(1, 'rgba(30,25,20,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); }
        x.strokeStyle = 'rgba(40,40,40,0.25)'; x.strokeRect(0.5, 0.5, S - 1, S - 1);
        break;
      case T.WOOD: {
        const base = tint ? U.hex2rgb(tint) : [128, 86, 52];
        noiseFill(x, S, S, base, 18, 3, seed, (px, py, n, f, r, g, b) => { const s = Math.sin(px * 0.35 + U.noise(px / 8, py / 2, seed) * 4) * 8; return [r + s, g + s * 0.7, b + s * 0.5]; });
        x.strokeStyle = 'rgba(40,24,12,0.55)'; x.lineWidth = 1.2;
        for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(0, k * 16 + 0.5); x.lineTo(S, k * 16 + 0.5); x.stroke(); const off = ((k * 23 + v * 17) % 48) + 8; x.beginPath(); x.moveTo(off, k * 16); x.lineTo(off, k * 16 + 16); x.stroke(); }
        break;
      }
      case T.TILEF: {
        const base = tint ? U.hex2rgb(tint) : [214, 216, 212];
        noiseFill(x, S, S, base, 8, 20, seed);
        x.strokeStyle = 'rgba(90,95,100,0.45)'; x.lineWidth = 1.5;
        for (let k = 0; k <= 4; k++) { x.beginPath(); x.moveTo(k * 16, 0); x.lineTo(k * 16, S); x.moveTo(0, k * 16); x.lineTo(S, k * 16); x.stroke(); }
        break;
      }
      case T.CARPET: {
        const base = tint ? U.hex2rgb(tint) : [92, 32, 40];
        noiseFill(x, S, S, base, 14, 1.5, seed);
        x.strokeStyle = 'rgba(255,255,255,0.05)'; for (let k = 0; k < S; k += 4) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, S); x.stroke(); }
        break;
      }
      case T.MARBLE:
        noiseFill(x, S, S, [226, 222, 214], 14, 16, seed, (px, py, n, f, r, g, b) => { const vein = Math.abs(Math.sin((px + py * 0.6) / 9 + U.fbm(px / 14, py / 14, seed, 3) * 6)); const k = vein < 0.06 ? -55 : 0; return [r + k, g + k, b + k * 0.8]; });
        x.strokeStyle = 'rgba(120,110,100,0.35)'; x.strokeRect(0.5, 0.5, 31, 31); x.strokeRect(32.5, 32.5, 31, 31); x.strokeRect(32.5, 0.5, 31, 31); x.strokeRect(0.5, 32.5, 31, 31);
        break;
      case T.WATER: case T.POOL:
        noiseFill(x, S, S, t === T.POOL ? [60, 170, 205] : [24, 58, 82], 16, 10, seed);
        if (t === T.POOL) { x.strokeStyle = 'rgba(255,255,255,0.18)'; for (let k = 0; k <= 4; k++) { x.beginPath(); x.moveTo(k * 16, 0); x.lineTo(k * 16, S); x.moveTo(0, k * 16); x.lineTo(S, k * 16); x.stroke(); } }
        break;
      case T.DOCK:
        noiseFill(x, S, S, [112, 84, 58], 20, 3, seed, (px, py, n, f, r, g, b) => (px % 16 < 2 ? [20, 40, 55] : [r, g + Math.sin(py * 0.4) * 4, b]));
        x.fillStyle = 'rgba(40,40,40,0.8)'; for (let k = 0; k < 4; k++) { x.fillRect(k * 16 + 7, 6, 2, 2); x.fillRect(k * 16 + 7, 56, 2, 2); }
        break;
      case T.HEDGE:
        noiseFill(x, S, S, [34, 74, 32], 40, 4, seed, (px, py, n, f, r, g, b) => [r, g + n * 30, b]);
        for (let k = 0; k < 12; k++) { x.fillStyle = 'rgba(120,180,90,0.25)'; x.beginPath(); x.arc(U.hash2(k, v, 21) * S, U.hash2(k, v, 22) * S, 4 + U.hash2(k, v, 23) * 5, 0, 7); x.fill(); }
        break;
      default:
        x.fillStyle = '#444'; x.fillRect(0, 0, S, S);
    }
    cache.set(key, c);
    return c;
  };

  /** soft radial light sprite tinted to rgb */
  const lightCache = new Map();
  K.lightSprite = function (c, soft = 0) {
    const key = c.join(',') + ':' + soft;
    if (lightCache.has(key)) return lightCache.get(key);
    const n = 128, cv = K.mkCanvas(n, n), x = cv.getContext('2d');
    const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    const [r, gg, b] = c;
    g.addColorStop(0, `rgba(${r},${gg},${b},1)`);
    g.addColorStop(soft ? 0.15 : 0.3, `rgba(${r},${gg},${b},0.75)`);
    g.addColorStop(0.65, `rgba(${r},${gg},${b},0.22)`);
    g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    x.fillStyle = g; x.fillRect(0, 0, n, n);
    lightCache.set(key, cv);
    return cv;
  };
  /** forward cone (headlights / flashlight) */
  K.coneSprite = (function () {
    let cv = null;
    return function () {
      if (cv) return cv;
      cv = K.mkCanvas(256, 128); const x = cv.getContext('2d');
      const g = x.createRadialGradient(0, 64, 0, 0, 64, 256);
      g.addColorStop(0, 'rgba(255,250,230,1)'); g.addColorStop(0.5, 'rgba(255,245,220,0.45)'); g.addColorStop(1, 'rgba(255,240,210,0)');
      x.fillStyle = g; x.beginPath(); x.moveTo(0, 64); x.lineTo(256, 0); x.lineTo(256, 128); x.closePath(); x.fill();
      return cv;
    };
  })();

  /** irregular blob stamps for blood */
  const blobs = [];
  K.bloodBlob = function (i) {
    if (!blobs.length) for (let k = 0; k < 6; k++) {
      const n = 64, cv = K.mkCanvas(n, n), x = cv.getContext('2d');
      x.fillStyle = '#fff';
      x.beginPath();
      for (let a = 0; a <= 24; a++) {
        const ang = (a / 24) * U.TAU, r = n * (0.28 + U.hash2(a % 24, k, 77) * 0.16);
        const px = n / 2 + Math.cos(ang) * r, py = n / 2 + Math.sin(ang) * r;
        a ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.fill();
      for (let s = 0; s < 7; s++) { const ang = U.hash2(s, k, 3) * U.TAU, r = n * (0.38 + U.hash2(s, k, 4) * 0.1); x.beginPath(); x.arc(n / 2 + Math.cos(ang) * r, n / 2 + Math.sin(ang) * r, 1.5 + U.hash2(s, k, 5) * 3, 0, 7); x.fill(); }
      blobs.push(cv);
    }
    return blobs[i % blobs.length];
  };

  // ------------------------------------------------------------------ weapon icons (side view)
  K.drawWeaponIcon = function (x, id, w, h, col = '#e9e6df') {
    x.save();
    x.translate(w / 2, h / 2);
    const s = Math.min(w / 120, h / 50);
    x.scale(s, s);
    x.fillStyle = col; x.strokeStyle = col; x.lineWidth = 3; x.lineCap = 'round'; x.lineJoin = 'round';
    const R = (a, b, c, d) => x.fillRect(a, b, c, d);
    const P = (pts) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fill(); };
    switch (id) {
      case 'fists': P([[-22, -10], [14, -14], [22, -6], [22, 10], [-6, 14], [-22, 8]]); x.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 0; k < 3; k++) x.fillRect(4, -8 + k * 6, 16, 1.5); break;
      case 'wire': x.beginPath(); x.moveTo(-40, 0); x.bezierCurveTo(-10, -18, 10, 18, 40, 0); x.lineWidth = 1.6; x.stroke(); R(-50, -6, 10, 12); R(40, -6, 10, 12); break;
      case 'knife': P([[-40, -4], [-4, -6], [44, -2], [46, 2], [-4, 6], [-40, 4]]); x.fillStyle = 'rgba(0,0,0,0.4)'; R(-40, -5, 30, 10); break;
      case 'bat': P([[-50, -3], [-30, -4], [50, -9], [54, 0], [50, 9], [-30, 4], [-50, 3]]); break;
      case 'crowbar': x.lineWidth = 6; x.beginPath(); x.moveTo(-50, 6); x.lineTo(40, -2); x.quadraticCurveTo(54, -4, 48, -14); x.stroke(); break;
      case 'machete': P([[-50, -4], [-24, -5], [44, -12], [52, -4], [40, 8], [-24, 5], [-50, 4]]); break;
      case 'katana': x.lineWidth = 5; x.beginPath(); x.moveTo(-36, 4); x.quadraticCurveTo(10, 0, 58, -10); x.stroke(); R(-58, 0, 20, 8); R(-38, -6, 4, 18); break;
      case 'syringe': case 'sedative': R(-30, -5, 50, 10); R(20, -1.5, 26, 3); R(-42, -8, 12, 16); break;
      case 'mask': x.beginPath(); x.ellipse(0, 0, 22, 24, 0, 0, 7); x.fill(); x.fillStyle = 'rgba(0,0,0,0.55)'; R(-14, -8, 28, 8); R(-6, 8, 12, 4); break;
      case 'pot': P([[-20, -14], [20, -14], [14, 20], [-14, 20]]); x.fillStyle = 'rgba(0,0,0,0.35)'; R(-20, -14, 40, 6); x.fillStyle = col; x.beginPath(); x.ellipse(0, -22, 8, 12, 0.6, 0, 7); x.fill(); break;
      case 'can': P([[-26, -12], [10, -12], [14, 18], [-22, 18]]); x.lineWidth = 4; x.beginPath(); x.moveTo(12, -2); x.lineTo(40, -22); x.stroke(); x.beginPath(); x.arc(-8, -18, 10, Math.PI, 0); x.stroke(); break;
      case 'p9': P([[-30, -12], [30, -12], [30, 0], [-6, 0], [-12, 22], [-26, 22], [-22, 0], [-30, 0]]); break;
      case 'silber': P([[-30, -12], [28, -12], [28, 0], [-6, 0], [-12, 22], [-26, 22], [-22, 0], [-30, 0]]); R(28, -10, 34, 9); break;
      case 'magnum': P([[-30, -10], [44, -10], [44, -2], [4, -2], [6, 8], [-10, 8], [-16, 24], [-30, 22], [-24, 0]]); x.beginPath(); x.arc(-4, -1, 7, 0, 7); x.fill(); break;
      case 'mpk': P([[-44, -10], [34, -10], [34, 0], [6, 0], [8, 26], [-4, 26], [-6, 0], [-16, 0], [-20, 16], [-32, 16], [-30, 0], [-44, 0]]); R(34, -7, 12, 4); break;
      case 'pump': R(-60, -8, 110, 8); R(-10, 0, 40, 7); P([[-60, -8], [-60, 4], [-80, 14], [-84, 6], [-66, -8]]); break;
      case 'k47': P([[-58, -8], [40, -8], [40, 0], [14, 0], [22, 24], [10, 26], [2, 0], [-16, 0], [-20, 14], [-30, 14], [-28, 0], [-40, 0], [-60, 12], [-64, 2]]); R(40, -6, 18, 3); break;
      case 'jaeger': R(-64, -4, 130, 7); R(-20, -14, 40, 8); P([[-64, -4], [-64, 8], [-84, 14], [-88, 2]]); P([[-10, 3], [0, 3], [-6, 14], [-14, 14]]); break;
      case 'ar15': P([[-60, -6], [36, -6], [36, 1], [16, 1], [20, 22], [10, 24], [4, 1], [-14, 1], [-18, 14], [-28, 14], [-26, 1], [-42, 1], [-58, 10], [-62, 0]]); R(36, -4, 20, 3); R(-6, -13, 22, 5); break;
      case 'lmg': P([[-70, -8], [44, -8], [44, 1], [8, 1], [12, 20], [0, 22], [-4, 1], [-20, 1], [-26, 14], [-36, 14], [-34, 1], [-50, 1], [-68, 12], [-74, 0]]); R(44, -5, 24, 4); R(-14, 2, 22, 16); x.lineWidth = 3; x.beginPath(); x.moveTo(54, -4); x.lineTo(50, 18); x.moveTo(58, -4); x.lineTo(64, 18); x.stroke(); break;
      case 'dmr': R(-62, -5, 118, 7); R(-18, -15, 36, 8); P([[-62, -5], [-62, 8], [-82, 14], [-86, 0]]); P([[-6, 2], [6, 2], [8, 18], [-2, 18]]); R(-28, 2, 8, 12); break;
      case 'vss': R(-56, -5, 70, 8); R(14, -7, 46, 11); R(-20, -15, 28, 8); P([[-56, -5], [-56, 8], [-78, 12], [-80, 0]]); R(-10, 3, 8, 14); break;
      case 'kodiak': R(-70, -5, 150, 8); R(-24, -17, 44, 10); R(80, -9, 12, 16); P([[-70, -6], [-70, 9], [-92, 14], [-94, -2]]); x.lineWidth = 3; x.beginPath(); x.moveTo(50, 3); x.lineTo(42, 22); x.moveTo(50, 3); x.lineTo(60, 22); x.stroke(); break;
      case 'coin': x.beginPath(); x.arc(0, 0, 16, 0, 7); x.fill(); x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.arc(0, 0, 10, 0, 7); x.fill(); break;
      case 'grenade': x.beginPath(); x.ellipse(0, 4, 16, 20, 0, 0, 7); x.fill(); R(-6, -22, 12, 8); R(4, -22, 16, 4); break;
      case 'c4': R(-36, -14, 72, 28); x.fillStyle = 'rgba(0,0,0,0.45)'; R(-30, -10, 24, 20); x.fillStyle = '#ff2a2a'; R(10, -6, 8, 6); break;
      // item glyphs
      case 'bandage': x.beginPath(); x.roundRect(-34, -12, 68, 24, 8); x.fill(); x.fillStyle = '#c8102e'; R(-4, -9, 8, 18); R(-9, -4, 18, 8); break;
      case 'medkit': x.beginPath(); x.roundRect(-30, -20, 60, 40, 6); x.fill(); x.fillStyle = '#c8102e'; R(-5, -14, 10, 28); R(-14, -5, 28, 10); break;
      case 'vest': P([[-26, -24], [-10, -24], [0, -14], [10, -24], [26, -24], [30, 22], [-30, 22]]); x.fillStyle = 'rgba(0,0,0,0.35)'; R(-24, 0, 48, 4); R(-24, 10, 48, 4); break;
      case 'lockpick': x.lineWidth = 3.5; x.beginPath(); x.moveTo(-40, 6); x.lineTo(30, 6); x.lineTo(36, -2); x.moveTo(-40, -6); x.lineTo(34, -6); x.stroke(); break;
      case 'silencer': R(-40, -9, 80, 18); x.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 0; k < 5; k++) R(-34 + k * 16, -9, 3, 18); break;
      case 'keycard': x.beginPath(); x.roundRect(-30, -18, 60, 36, 5); x.fill(); x.fillStyle = 'rgba(0,0,0,0.45)'; R(-24, -4, 48, 6); break;
      default: x.beginPath(); x.arc(0, 0, 14, 0, 7); x.fill();
    }
    x.restore();
  };
  /** icon as data URL (for DOM) */
  const iconURLs = new Map();
  K.iconURL = function (id, col = '#ece7dc', w = 120, h = 50) {
    const k = id + col + w + h;
    if (iconURLs.has(k)) return iconURLs.get(k);
    const c = K.mkCanvas(w * 2, h * 2), x = c.getContext('2d'); x.scale(2, 2);
    K.drawWeaponIcon(x, id, w, h, col);
    const u = c.toDataURL(); iconURLs.set(k, u); return u;
  };
})(globalThis.K = globalThis.K || {});
