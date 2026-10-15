/* RDE // KONTRAKT — particles, persistent decals (blood, holes, scorch, skid marks), dynamic lights */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE;
  const DC = 256; // decal chunk size in world px

  class FX {
    constructor(r) {
      this.r = r; this.w = r.w;
      this.parts = []; this.tracers = []; this.lights = []; this.rings = []; this.floats = []; this.flashes = [];
      this.decals = new Map();
      this.tinted = new Map();
      this.gore = 1;
    }
    clearDecals() { this.decals.clear(); }
    blob(i, col) {
      const k = i + col;
      if (this.tinted.has(k)) return this.tinted.get(k);
      const src = K.bloodBlob(i), c = K.mkCanvas(64, 64), x = c.getContext('2d');
      x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, 64, 64);
      this.tinted.set(k, c); return c;
    }
    /** run fn(ctx) on every decal chunk the box touches, ctx translated to world coords */
    stamp(x, y, rad, fn) {
      const x0 = Math.floor((x - rad) / DC), x1 = Math.floor((x + rad) / DC), y0 = Math.floor((y - rad) / DC), y1 = Math.floor((y + rad) / DC);
      for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
        if (i < 0 || j < 0) continue;
        const k = i * 1000 + j;
        let c = this.decals.get(k);
        if (!c) { c = K.mkCanvas(DC, DC); c._x = i * DC; c._y = j * DC; this.decals.set(k, c); }
        c._age = Math.min(c._age || 0, 300);   // fresh dirt keeps the chunk around a while longer
        const ctx = c.getContext('2d');
        ctx.save(); ctx.translate(-i * DC, -j * DC); fn(ctx); ctx.restore();
      }
    }
    decal(kind, x, y, o = {}) {
      const g = this.gore;
      switch (kind) {
        case 'blood': {
          if (!g) return;
          const s = o.s || 10, col = o.col || (Math.random() < 0.5 ? '#5e0306' : '#7a070b');
          this.stamp(x, y, s, (c) => { c.globalAlpha = o.a || 0.85; c.translate(x, y); c.rotate(Math.random() * 6.3); c.drawImage(this.blob(U.rint(6), col), -s, -s, s * 2, s * 2); });
          break;
        }
        case 'streak': { // directional splatter (exit wound spray)
          if (!g) return;
          const len = o.len || 40, a = o.a || 0;
          this.stamp(x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2, len, (c) => {
            c.fillStyle = '#6a0509'; c.globalAlpha = 0.85;
            for (let k = 0; k < 14; k++) { const d = Math.random() * len, s = (1 - d / len) * 3.4 + 0.6, sp = (Math.random() - 0.5) * d * 0.35; c.beginPath(); c.ellipse(x + Math.cos(a) * d - Math.sin(a) * sp, y + Math.sin(a) * d + Math.cos(a) * sp, s * 1.8, s, a, 0, 6.3); c.fill(); }
          });
          break;
        }
        case 'drop': if (!g) return; this.stamp(x, y, 3, (c) => { c.fillStyle = o.col === 'oil' ? '#14110c' : o.col === 'water' ? '#3a4a5a' : '#5a0306'; c.globalAlpha = o.col === 'water' ? 0.35 : 0.8; c.beginPath(); c.arc(x, y, o.s || 1.4, 0, 6.3); c.fill(); }); break;
        case 'smear': {
          if (!g) return;
          const px = o.px ?? x - Math.cos(o.a) * 8, py = o.py ?? y - Math.sin(o.a) * 8, k = o.k ?? 1;
          this.stamp((x + px) / 2, (y + py) / 2, Math.hypot(x - px, y - py) / 2 + 12, (c) => {
            c.lineCap = 'round';
            c.strokeStyle = `rgba(92,4,9,${0.22 + 0.25 * k})`; c.lineWidth = 7 + 5 * k; c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke();
            // drag streaks inside the smear (clothes, fingers)
            c.strokeStyle = `rgba(70,2,6,${0.25 * k})`; c.lineWidth = 1.2;
            const nx = -(y - py), ny = x - px, nl = Math.hypot(nx, ny) || 1;
            for (const s of [-3.5, 0.5, 3]) { c.beginPath(); c.moveTo(px + nx / nl * s, py + ny / nl * s); c.lineTo(x + nx / nl * s, y + ny / nl * s); c.stroke(); }
          });
          break;
        }
        case 'foot': this.stamp(x, y, 6, (c) => { c.fillStyle = 'rgba(90,6,10,0.5)'; c.translate(x, y); c.rotate(o.a); c.beginPath(); c.ellipse(0, o.side ? 3 : -3, 3.2, 1.6, 0, 0, 6.3); c.fill(); }); break;
        case 'hole': this.stamp(x, y, 4, (c) => { c.fillStyle = 'rgba(15,15,15,0.85)'; c.beginPath(); c.arc(x, y, 1.6, 0, 6.3); c.fill(); c.strokeStyle = 'rgba(200,200,200,0.25)'; c.lineWidth = 0.8; c.beginPath(); c.arc(x, y, 2.6, 0, 6.3); c.stroke(); }); break;
        case 'scorch': { const s = o.s || 50; this.stamp(x, y, s, (c) => { const gr = c.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(10,8,6,0.85)'); gr.addColorStop(0.6, 'rgba(20,16,12,0.5)'); gr.addColorStop(1, 'rgba(20,16,12,0)'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, s, 0, 6.3); c.fill(); }); break; }
        case 'shell': this.stamp(x, y, 3, (c) => { c.fillStyle = '#b8902c'; c.translate(x, y); c.rotate(Math.random() * 6.3); c.fillRect(-1.6, -0.7, 3.2, 1.4); }); break;
        case 'glass': this.stamp(x, y, 14, (c) => { c.fillStyle = 'rgba(200,230,255,0.55)'; for (let k = 0; k < 9; k++) { c.fillRect(x + U.rnd(-12, 12), y + U.rnd(-12, 12), U.rnd(1, 3), U.rnd(1, 2)); } }); break;
        case 'skid': this.stamp(x, y, 40, (c) => {
          c.strokeStyle = 'rgba(12,12,12,0.22)'; c.lineWidth = 4; const fx = Math.cos(o.a), fy = Math.sin(o.a);
          for (const s of [-1, 1]) { const ox = -fy * (o.w / 2 - 3) * s, oy = fx * (o.w / 2 - 3) * s; c.beginPath(); c.moveTo(x - fx * o.l * 0.35 + ox, y - fy * o.l * 0.35 + oy); c.lineTo(x - fx * o.l * 0.35 + ox - fx * 6, y - fy * o.l * 0.35 + oy - fy * 6); c.stroke(); }
        }); break;
        case 'gib': if (!g) return; this.stamp(x, y, 6, (c) => { c.fillStyle = '#4a0205'; c.beginPath(); c.ellipse(x, y, 3 + Math.random() * 3, 2 + Math.random() * 2, Math.random() * 6, 0, 6.3); c.fill(); c.fillStyle = '#d9c9b0'; c.fillRect(x - 1, y - 0.5, 2.4, 1); }); break;
      }
    }
    /** wipe decals in a soft circle (k = how much of it goes per pass) */
    clean(x, y, r, k = 1) {
      this.stamp(x, y, r, (c) => {
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(0,0,0,${k})`); g.addColorStop(0.7, `rgba(0,0,0,${k * 0.8})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.globalCompositeOperation = 'destination-out'; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill();
      });
    }
    /** blood, skid marks and shell casings weather away: a dry street keeps them about a game day,
     *  rain washes them off in a few hours. Chunks are visited round-robin and faded with a
     *  destination-out fill (no pixel read-back); a chunk that has fully aged is dropped. */
    weather(dt, rain, now) {
      this.fadeT = (this.fadeT || 0) - dt;
      if (this.fadeT > 0 || !this.decals.size) return;
      this.fadeT = 0.5;
      const keys = [...this.decals.keys()], LIFE = 1500;
      for (let n = 0; n < Math.min(4, keys.length); n++) {
        this.fadeI = ((this.fadeI || 0) + 1) % keys.length;
        const key = keys[this.fadeI], c = this.decals.get(key);
        if (c._fadeT == null) { c._fadeT = now; c._age = c._age || 0; continue; }
        const el = (now - c._fadeT) * (1 + rain * 5); c._fadeT = now;
        c._age += el;
        if (c._age >= LIFE) { this.decals.delete(key); continue; }
        const k = 1 - Math.pow(0.02, el / LIFE);   // ~2 % left at the end of its life
        if (k < 0.004) continue;
        const x = c.getContext('2d');
        x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'destination-out'; x.fillStyle = `rgba(0,0,0,${k})`; x.fillRect(0, 0, c.width, c.height); x.restore();
      }
    }
    drawDecals(ctx, x0, y0, x1, y1) {
      for (const c of this.decals.values()) {
        if (c._x + DC < x0 || c._y + DC < y0 || c._x > x1 || c._y > y1) continue;
        ctx.drawImage(c, c._x, c._y);
      }
    }

    // ------------------------------------------------------------ particles
    add(p) { if (this.parts.length < 1400) this.parts.push(p); }
    blood(x, y, a, n, spd = 1, spread = 0.7) {
      if (!this.gore) return;
      for (let k = 0; k < n; k++) {
        const ang = a + U.gauss() * spread, s = (60 + Math.random() * 220) * spd;
        this.add({ k: 'blood', x, y, z: 8 + Math.random() * 6, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, vz: Math.random() * 90, life: 2, size: 0.8 + Math.random() * 1.8 });
      }
      for (let k = 0; k < Math.min(4, n / 3); k++) this.add({ k: 'mist', x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, life: 0.5 + Math.random() * 0.3, max: 0.8, size: 6 + Math.random() * 8 });
    }
    sparks(x, y, a, n, col = [255, 210, 120]) {
      for (let k = 0; k < n; k++) { const ang = a + Math.PI + U.gauss() * 0.9, s = 80 + Math.random() * 260; this.add({ k: 'spark', x, y, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, life: 0.15 + Math.random() * 0.25, max: 0.4, col }); }
    }
    dust(x, y, n, col = [150, 145, 135]) { for (let k = 0; k < n; k++) this.add({ k: 'smoke', x: x + U.rnd(-3, 3), y: y + U.rnd(-3, 3), vx: U.rnd(-30, 30), vy: U.rnd(-30, 30), life: 0.6 + Math.random() * 0.5, max: 1.1, size: 3 + Math.random() * 4, grow: 14, col, a: 0.45 }); }
    smoke(x, y, n, dark = 1) { for (let k = 0; k < n; k++) this.add({ k: 'smoke', x: x + U.rnd(-6, 6), y: y + U.rnd(-6, 6), vx: U.rnd(-14, 14) + 12, vy: U.rnd(-14, 14) - 6, life: 1.4 + Math.random() * 1.6, max: 3, size: 6 + Math.random() * 6, grow: 22, col: dark ? [40, 38, 36] : [170, 170, 165], a: 0.5 }); }
    fire(x, y, n) { for (let k = 0; k < n; k++) this.add({ k: 'fire', x: x + U.rnd(-8, 8), y: y + U.rnd(-8, 8), vx: U.rnd(-20, 20), vy: U.rnd(-40, 0), life: 0.3 + Math.random() * 0.5, max: 0.8, size: 4 + Math.random() * 7 }); }
    shell(x, y, a) { const ang = a + Math.PI / 2 + U.rnd(-0.4, 0.4), s = 90 + Math.random() * 60; this.add({ k: 'shell', x, y, z: 10, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, vz: 70 + Math.random() * 50, life: 3, rot: Math.random() * 6 }); }
    glass(x, y, n) { for (let k = 0; k < n; k++) { const a = Math.random() * 6.3, s = 40 + Math.random() * 160; this.add({ k: 'glass', x, y, z: 12, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: Math.random() * 60, life: 2, rot: Math.random() * 6 }); } }
    gibs(x, y, a, n) {
      if (!this.gore) return;
      for (let k = 0; k < n; k++) { const ang = a + U.gauss() * 1.4, s = 120 + Math.random() * 300; this.add({ k: 'gib', x, y, z: 10, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, vz: 60 + Math.random() * 140, life: 3, rot: Math.random() * 6, size: 2 + Math.random() * 3 }); }
      this.blood(x, y, a, 40, 1.6, 1.6);
    }
    light(x, y, r, c, i, life) { this.lights.push({ x, y, r, c, i, life, max: life }); }
    ring(x, y, r, col, life = 0.6) { this.rings.push({ x, y, r, col, life, max: life }); }
    float(x, y, text, col = '#fff', big) { this.floats.push({ x, y, text, col, life: 1.6, max: 1.6, big }); }

    update(dt) {
      const ps = this.parts, keep = [];
      for (const p of ps) {
        p.life -= dt;
        if (p.life <= 0) continue;
        if (p.z != null) {
          p.vz -= 520 * dt; p.z += p.vz * dt;
          if (p.z <= 0) {
            p.z = 0;
            if (p.k === 'blood') { this.decal(Math.random() < 0.3 ? 'blood' : 'drop', p.x, p.y, { s: p.size * 2.6 + 2, a: 0.8 }); continue; }
            if (p.k === 'gib') { this.decal('gib', p.x, p.y); this.decal('blood', p.x, p.y, { s: 8 }); continue; }
            if (p.k === 'shell' || p.k === 'glass') { if (Math.abs(p.vz) > 50) { p.vz = -p.vz * 0.35; p.vx *= 0.5; p.vy *= 0.5; if (p.k === 'shell') this.r.g.audio.casing(p.x, p.y); } else { this.decal(p.k, p.x, p.y); continue; } }
          }
        }
        const drag = p.k === 'smoke' || p.k === 'mist' ? 2 : p.k === 'spark' ? 3 : 1.2;
        p.vx *= Math.max(0, 1 - drag * dt); p.vy *= Math.max(0, 1 - drag * dt);
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.grow) p.size += p.grow * dt;
        if (p.rot != null) p.rot += dt * 12;
        keep.push(p);
      }
      this.parts = keep;
      this.tracers = this.tracers.filter((t) => (t.life -= dt) > 0);
      this.lights = this.lights.filter((l) => (l.life -= dt) > 0);
      this.rings = this.rings.filter((l) => (l.life -= dt) > 0);
      this.floats = this.floats.filter((f) => { f.life -= dt; f.y -= dt * 22; return f.life > 0; });
    }
    draw(ctx) {
      for (const p of this.parts) {
        const z = p.z || 0;
        switch (p.k) {
          case 'blood': ctx.fillStyle = '#8a0a10'; ctx.beginPath(); ctx.arc(p.x, p.y - z * 0.6, p.size, 0, 6.3); ctx.fill(); break;
          case 'mist': ctx.fillStyle = `rgba(140,8,14,${0.35 * p.life / p.max})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - p.life / p.max), 0, 6.3); ctx.fill(); break;
          case 'spark': ctx.strokeStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${p.life / p.max})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); ctx.stroke(); break;
          case 'smoke': ctx.fillStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${p.a * p.life / p.max})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.3); ctx.fill(); break;
          case 'fire': { const k = p.life / p.max; ctx.fillStyle = `rgba(255,${120 + k * 120},${40 * k},${0.8 * k})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, 6.3); ctx.fill(); break; }
          case 'shell': ctx.save(); ctx.translate(p.x, p.y - z * 0.6); ctx.rotate(p.rot); ctx.fillStyle = '#d4a63a'; ctx.fillRect(-1.8, -0.8, 3.6, 1.6); ctx.restore(); break;
          case 'glass': ctx.save(); ctx.translate(p.x, p.y - z * 0.6); ctx.rotate(p.rot); ctx.fillStyle = 'rgba(210,240,255,0.8)'; ctx.fillRect(-2, -0.8, 4, 1.6); ctx.restore(); break;
          case 'gib': ctx.save(); ctx.translate(p.x, p.y - z * 0.6); ctx.rotate(p.rot); ctx.fillStyle = '#6a0408'; ctx.beginPath(); ctx.ellipse(0, 0, p.size * 1.4, p.size, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#e8dcc8'; ctx.fillRect(-p.size * 0.3, -0.6, p.size, 1.2); ctx.restore(); break;
          case 'splash': ctx.strokeStyle = `rgba(200,220,255,${0.5 * p.life / p.max})`; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(p.x, p.y, (1 - p.life / p.max) * 4 + 1, 0, 6.3); ctx.stroke(); break;
        }
      }
      // tracers
      ctx.lineCap = 'round';
      for (const t of this.tracers) {
        const k = t.life / t.max;
        ctx.strokeStyle = `rgba(255,236,170,${0.75 * k})`; ctx.lineWidth = t.w || 1.4;
        ctx.beginPath(); ctx.moveTo(t.x0, t.y0); ctx.lineTo(t.x1, t.y1); ctx.stroke();
      }
      for (const r of this.rings) {
        const k = 1 - r.life / r.max;
        ctx.strokeStyle = r.col.replace('A', (1 - k) * 0.6); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.2 + k * 0.8), 0, 6.3); ctx.stroke();
      }
    }
  }
  K.FX = FX;
})(globalThis.K = globalThis.K || {});
