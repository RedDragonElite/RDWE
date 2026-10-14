/* RDE // FRONTLINE — atmosphere: day/night cycle, city lights, storms, rain & lightning (visual only) */
(function (BW) {
  'use strict';
  const C = BW.C;

  const LIT = { city: 1.4, port: 1.0, market: 0.9, bank: 0.9, lab: 1.0, wonder: 2.4, barracks: 0.6, fort: 0.5, silo: 0.5, sam: 0.4, radar: 0.5, farm: 0.25, sawmill: 0.25, mine: 0.4, derrick: 0.5, bunker: 0.3 };

  class Atmosphere {
    constructor(r) {
      this.r = r;
      this.rain = [];
      for (let i = 0; i < 260; i++) this.rain.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 });
      this.flash = 0;
      this.night = 0;
    }

    /** 0 = full day, 1 = deep night. Driven by sim ticks so pause / speed stay consistent. */
    nightFactor(tick) {
      const ph = (tick % C.DAY_TICKS) / C.DAY_TICKS;
      const sun = Math.cos(ph * Math.PI * 2); // 1 noon … -1 midnight
      return Math.max(0, Math.min(1, (0.15 - sun) / 0.75));
    }
    /** sun direction for the GL lighting: travels east→west, low at dawn/dusk, moonlight at night */
    sunDir(tick, cycle) {
      const ph = cycle ? (tick % C.DAY_TICKS) / C.DAY_TICKS : 0.12;
      const a = ph * Math.PI * 2;
      const elev = Math.max(0.25, Math.cos(a) * 0.6 + 0.55);
      const v = [-Math.sin(a) * 0.8 - 0.35, -0.55, elev];
      const l = Math.hypot(v[0], v[1], v[2]);
      return [v[0] / l, v[1] / l, v[2] / l];
    }
    dusk(tick) {
      const ph = (tick % C.DAY_TICKS) / C.DAY_TICKS;
      const sun = Math.cos(ph * Math.PI * 2);
      return Math.max(0, 1 - Math.abs(sun - 0.05) / 0.3);
    }

    /** world-space pass: storm clouds */
    drawWorld(ctx) {
      const sim = this.r.sim;
      if (!sim.storm || !this.r.game.settings.weather) return;
      const [sx, sy] = sim.stormPos(), R = sim.storm.r, t = this.r.time;
      ctx.save();
      ctx.beginPath(); ctx.arc(sx, sy, R * 1.15, 0, 6.283); ctx.clip();
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 1.15);
      g.addColorStop(0, 'rgba(20,24,34,0.65)'); g.addColorStop(0.7, 'rgba(30,36,50,0.45)'); g.addColorStop(1, 'rgba(30,36,50,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - R * 1.2, sy - R * 1.2, R * 2.4, R * 2.4);
      // rotating cloud bands
      ctx.translate(sx, sy); ctx.rotate(t * 0.25);
      ctx.globalAlpha = 0.5;
      const pat = this.r.cloudPat;
      pat.setTransform(new DOMMatrix().scaleSelf(2.2, 2.2));
      ctx.fillStyle = pat; ctx.fillRect(-R * 1.2, -R * 1.2, R * 2.4, R * 2.4);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    /** screen-space pass: night tint, lights, rain, lightning */
    drawScreen(ctx, dt) {
      const r = this.r, sim = r.sim, set = r.game.settings;
      const cw = r.cw, ch = r.ch;
      const n = set.daynight ? this.nightFactor(sim.tick + (sim.phase === 'play' ? 0 : 0)) : 0;
      this.night = n;
      const dk = set.daynight ? this.dusk(sim.tick) : 0;
      const gl = !!r.gl;
      if (dk > 0.01 && !gl) {
        ctx.globalCompositeOperation = 'soft-light';
        ctx.fillStyle = `rgba(255,120,40,${dk * 0.35})`;
        ctx.fillRect(0, 0, cw, ch);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (n > 0.01) {
        if (!gl) { ctx.fillStyle = `rgba(6,10,32,${n * 0.55})`; ctx.fillRect(0, 0, cw, ch); }
        // lights
        const z = r.cam.zoom, v = r.viewRect(), L = BW.Sprites.light();
        ctx.globalCompositeOperation = 'lighter';
        for (const s of sim.structures) {
          if (s.x < v.x0 - 10 || s.x > v.x1 + 10 || s.y < v.y0 - 10 || s.y > v.y1 + 10) continue;
          const k = LIT[s.kind] || 0.3;
          if (s.off > sim.tick || s.done > sim.tick) continue;
          const rad = Math.max(10, k * 9 * z);
          const [x, y] = r.worldToScreen(s.x + 0.5, s.y + 0.5);
          const flick = 0.85 + 0.15 * Math.sin(r.time * 3 + s.id);
          ctx.globalAlpha = n * 0.75 * flick;
          ctx.drawImage(L, x - rad, y - rad, rad * 2, rad * 2);
        }
        for (const b of sim.boats) this._boatLight(ctx, b, n);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      // weather
      if (sim.storm && set.weather) {
        const [sx, sy] = sim.stormPos();
        const [px, py] = r.worldToScreen(sx, sy);
        const rad = sim.storm.r * r.cam.zoom;
        const d = Math.hypot(px - cw / 2, py - ch / 2);
        const inten = Math.max(0, Math.min(1, 1.3 - d / (rad + Math.max(cw, ch) * 0.35)));
        if (inten > 0.02) {
          ctx.strokeStyle = `rgba(180,200,255,${0.35 * inten})`; ctx.lineWidth = 1;
          ctx.beginPath();
          for (const p of this.rain) {
            p.y += dt * 1.6 * p.s; p.x += dt * 0.25 * p.s;
            if (p.y > 1) { p.y -= 1; p.x = Math.random(); }
            if (p.x > 1) p.x -= 1;
            const x = p.x * cw, y = p.y * ch;
            ctx.moveTo(x, y); ctx.lineTo(x - 4 * p.s, y - 16 * p.s);
          }
          ctx.stroke();
          if (Math.random() < dt * 0.35 * inten) { this.flash = 1; r.game.audio.play('thunder'); }
        }
      }
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(220,230,255,${this.flash * 0.35})`;
        ctx.fillRect(0, 0, cw, ch);
        this.flash -= dt * 4;
      }
    }

    _boatLight(ctx, b, n) {
      const r = this.r, W = r.W;
      const t = b.path[Math.min(b.path.length - 1, Math.floor(b.prog))];
      const [x, y] = r.worldToScreen(t % W + 0.5, ((t / W) | 0) + 0.5);
      const L = BW.Sprites.light(), rad = 14;
      ctx.globalAlpha = n * 0.6;
      ctx.drawImage(L, x - rad, y - rad, rad * 2, rad * 2);
    }
  }

  BW.Atmosphere = Atmosphere;
})(globalThis.BW = globalThis.BW || {});
