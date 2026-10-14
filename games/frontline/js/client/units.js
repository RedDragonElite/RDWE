/* RDE // FRONTLINE — army rendering: vector unit sprites, selection, march routes, combat & shells */
(function (BW) {
  'use strict';
  const C = BW.C, rgba = BW.rgba, fmt = BW.fmt;
  const mix = (c, d, f) => [c[0] + (d[0] - c[0]) * f, c[1] + (d[1] - c[1]) * f, c[2] + (d[2] - c[2]) * f];

  function body(ctx, kind, s, col, t, moving) {
    const dark = rgba(mix(col, [0, 0, 0], 0.55), 1), lite = rgba(mix(col, [255, 255, 255], 0.35), 1), base = rgba(col, 1);
    ctx.lineJoin = 'round';
    if (kind === 'tank') {
      // tracks
      ctx.fillStyle = '#1b1e26';
      const tw = s * 0.34;
      ctx.fillRect(-s * 0.78, -s * 0.62, s * 1.56, tw); ctx.fillRect(-s * 0.78, s * 0.62 - tw, s * 1.56, tw);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
      const off = moving ? (t * 30) % (s * 0.25) : 0;
      for (let x = -s * 0.78 + off; x < s * 0.78; x += s * 0.25) {
        ctx.beginPath(); ctx.moveTo(x, -s * 0.62); ctx.lineTo(x, -s * 0.62 + tw); ctx.moveTo(x, s * 0.62 - tw); ctx.lineTo(x, s * 0.62); ctx.stroke();
      }
      // hull
      const g = ctx.createLinearGradient(0, -s * 0.5, 0, s * 0.5);
      g.addColorStop(0, lite); g.addColorStop(0.5, base); g.addColorStop(1, dark);
      ctx.fillStyle = g; ctx.strokeStyle = '#0b0d14'; ctx.lineWidth = Math.max(1.2, s * 0.08);
      ctx.beginPath(); ctx.roundRect(-s * 0.7, -s * 0.45, s * 1.4, s * 0.9, s * 0.16); ctx.fill(); ctx.stroke();
      // barrel + turret
      ctx.fillStyle = '#2a2f3a'; ctx.fillRect(s * 0.1, -s * 0.08, s * 1.05, s * 0.16);
      ctx.fillStyle = dark; ctx.fillRect(s * 1.0, -s * 0.11, s * 0.16, s * 0.22);
      const tg = ctx.createRadialGradient(-s * 0.1, -s * 0.12, 0, 0, 0, s * 0.42);
      tg.addColorStop(0, lite); tg.addColorStop(1, dark);
      ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(0, 0, s * 0.38, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(-s * 0.1, -s * 0.1, s * 0.09, 0, 6.283); ctx.fill();
    } else if (kind === 'art') {
      ctx.strokeStyle = '#151820'; ctx.lineWidth = Math.max(1.5, s * 0.14); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-s * 0.2, 0); ctx.lineTo(-s * 0.95, -s * 0.38); ctx.moveTo(-s * 0.2, 0); ctx.lineTo(-s * 0.95, s * 0.38); ctx.stroke();
      ctx.fillStyle = '#2a2f3a'; ctx.fillRect(-s * 0.1, -s * 0.1, s * 1.35, s * 0.2);
      ctx.fillStyle = '#11141b';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.5, s * 0.32, s * 0.13, 0, 0, 6.283); ctx.ellipse(0, s * 0.5, s * 0.32, s * 0.13, 0, 0, 6.283); ctx.fill();
      const g = ctx.createRadialGradient(-s * 0.08, -s * 0.08, 0, 0, 0, s * 0.42);
      g.addColorStop(0, lite); g.addColorStop(1, dark);
      ctx.fillStyle = g; ctx.strokeStyle = '#0b0d14'; ctx.lineWidth = Math.max(1, s * 0.07);
      ctx.beginPath(); ctx.roundRect(-s * 0.34, -s * 0.36, s * 0.62, s * 0.72, s * 0.12); ctx.fill(); ctx.stroke();
    } else {
      // infantry squad in wedge formation
      const pts = [[0.45, 0], [-0.15, -0.5], [-0.15, 0.5], [-0.7, -0.15], [-0.7, 0.35]];
      for (let i = 0; i < pts.length; i++) {
        const bob = moving ? Math.sin(t * 12 + i * 1.7) * s * 0.05 : 0;
        const x = pts[i][0] * s + bob, y = pts[i][1] * s;
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(x + s * 0.06, y + s * 0.08, s * 0.24, 0, 6.283); ctx.fill();
        ctx.strokeStyle = '#1a1d25'; ctx.lineWidth = Math.max(1, s * 0.07);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.38, y + s * 0.1); ctx.stroke();
        const g = ctx.createRadialGradient(x - s * 0.06, y - s * 0.06, 0, x, y, s * 0.24);
        g.addColorStop(0, lite); g.addColorStop(1, dark);
        ctx.fillStyle = g; ctx.strokeStyle = '#0b0d14'; ctx.lineWidth = Math.max(1, s * 0.06);
        ctx.beginPath(); ctx.arc(x, y, s * 0.22, 0, 6.283); ctx.fill(); ctx.stroke();
      }
    }
  }

  class UnitView {
    constructor(r) { this.r = r; this.tracers = []; }

    pos(u, alpha) { return [u.px + (u.x - u.px) * alpha, u.py + (u.y - u.py) * alpha]; }
    size() { return Math.max(12, Math.min(30, this.r.cam.zoom * 3.4)); }

    hit(sx, sy, alpha, filter) {
      const s = this.size();
      let best = null, bd = (s * 1.2) ** 2;
      for (const u of this.r.sim.units) {
        if (filter && !filter(u)) continue;
        const [wx, wy] = this.pos(u, alpha), [x, y] = this.r.worldToScreen(wx, wy);
        const d = (x - sx) ** 2 + (y - sy) ** 2;
        if (d < bd) { bd = d; best = u; }
      }
      return best;
    }

    draw(ctx, alpha, dt) {
      const r = this.r, sim = r.sim, g = r.game, sel = g.sel, t = r.time;
      const s = this.size(), v = r.viewRect();
      // march routes of selected units
      ctx.lineCap = 'round';
      for (const u of sim.units) {
        if (!sel.has(u.id) || !u.path) continue;
        const [ux, uy] = this.pos(u, alpha);
        ctx.strokeStyle = 'rgba(255,230,140,0.75)'; ctx.lineWidth = 2; ctx.setLineDash([7, 7]); ctx.lineDashOffset = -t * 30;
        ctx.beginPath();
        let [sx, sy] = r.worldToScreen(ux, uy); ctx.moveTo(sx, sy);
        for (let i = Math.ceil(u.pi); i < u.path.length; i += 3) {
          const p = u.path[i];
          [sx, sy] = r.worldToScreen(p % r.W + 0.5, ((p / r.W) | 0) + 0.5); ctx.lineTo(sx, sy);
        }
        const last = u.path[u.path.length - 1];
        const [ex, ey] = r.worldToScreen(last % r.W + 0.5, ((last / r.W) | 0) + 0.5);
        ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
        BW.Sprites.drawEmoji(ctx, '🚩', ex + 5, ey - 8, 18);
      }
      // shells in flight
      for (const sh of sim.shells) {
        const u = Math.min(1, (sim.tick - 1 + alpha - sh.t0) / Math.max(1, sh.eta - sh.t0));
        const gx = sh.fx + (sh.tx - sh.fx) * u, gy = sh.fy + (sh.ty - sh.fy) * u;
        const h = Math.sin(Math.PI * u) * Math.hypot(sh.tx - sh.fx, sh.ty - sh.fy) * 0.35;
        const [x, y] = r.worldToScreen(gx, gy - h), [shx, shy] = r.worldToScreen(gx, gy);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(shx, shy, 3, 1.5, 0, 0, 6.283); ctx.fill();
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 7);
        gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(1, 'rgba(255,150,40,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.283); ctx.fill();
      }
      // units
      for (const u of sim.units) {
        const [wx, wy] = this.pos(u, alpha);
        if (wx < v.x0 - 3 || wx > v.x1 + 3 || wy < v.y0 - 3 || wy > v.y1 + 3) continue;
        const [x, y] = r.worldToScreen(wx, wy);
        const col = sim.players[u.owner].color, mine = u.owner === g.me.id, picked = sel.has(u.id);
        const moving = !!u.path && !u.fight;
        // ground glow / selection
        if (picked) {
          ctx.strokeStyle = 'rgba(255,220,100,0.95)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.lineDashOffset = t * 20;
          ctx.beginPath(); ctx.ellipse(x, y + s * 0.2, s * 1.25, s * 0.85, 0, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
          const gl = ctx.createRadialGradient(x, y, 0, x, y, s * 1.6);
          gl.addColorStop(0, 'rgba(255,220,100,0.25)'); gl.addColorStop(1, 'rgba(255,220,100,0)');
          ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, s * 1.6, 0, 6.283); ctx.fill();
        } else {
          ctx.fillStyle = rgba(col, 0.18); ctx.beginPath(); ctx.ellipse(x, y + s * 0.2, s * 1.05, s * 0.7, 0, 0, 6.283); ctx.fill();
        }
        ctx.save();
        ctx.translate(x, y); ctx.rotate(u.heading);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(s * 0.12, s * 0.18, s * 0.95, s * 0.6, 0, 0, 6.283); ctx.fill();
        body(ctx, u.kind, s, col, t, moving);
        // muzzle flash while fighting
        if (u.fight && Math.random() < 0.35) {
          const fx = u.kind === 'tank' ? s * 1.2 : s * 0.85;
          const fg = ctx.createRadialGradient(fx, 0, 0, fx, 0, s * 0.5);
          fg.addColorStop(0, 'rgba(255,255,220,1)'); fg.addColorStop(1, 'rgba(255,170,40,0)');
          ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(fx, 0, s * 0.5, 0, 6.283); ctx.fill();
        }
        ctx.restore();
        // tracers toward the enemy
        if (u.fight && Math.random() < 0.5) {
          const b = sim.unitById(u.fight);
          if (b) {
            const [bx, by] = r.worldToScreen(...this.pos(b, alpha));
            this.tracers.push({ x0: x, y0: y, x1: bx + (Math.random() - 0.5) * s, y1: by + (Math.random() - 0.5) * s, life: 0.12 });
          }
        }
        // dust behind moving tanks
        if (moving && u.kind === 'tank' && g.settings.fx && Math.random() < 0.4) {
          r.particles.push({ x: wx - Math.cos(u.heading) * 0.8, y: wy - Math.sin(u.heading) * 0.8, vx: (Math.random() - 0.5), vy: (Math.random() - 0.5), life: 1.2, max: 1.2, size: 0.5 + Math.random() * 0.5, color: [150, 135, 110], smoke: true, drag: 1 });
        }
        // strength plate
        if (s >= 11) {
          const label = fmt(u.str), fs = Math.max(10, s * 0.55);
          ctx.font = `700 ${fs}px Rajdhani, sans-serif`;
          const w = ctx.measureText(label).width + 10, py = y + s * 1.05;
          ctx.fillStyle = 'rgba(8,10,18,0.82)'; ctx.strokeStyle = rgba(col, mine ? 1 : 0.7); ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(x - w / 2, py, w, fs + 6, 5); ctx.fill(); ctx.stroke();
          ctx.fillStyle = mine ? '#ffe9a8' : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText(label, x, py + 3);
          const hp = Math.max(0, Math.min(1, u.str / u.max));
          ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x - w / 2 + 3, py + fs + 3.5, w - 6, 2);
          ctx.fillStyle = hp > 0.5 ? '#4dffa0' : hp > 0.25 ? '#ffcc55' : '#ff4d5e'; ctx.fillRect(x - w / 2 + 3, py + fs + 3.5, (w - 6) * hp, 2);
          if (u.fight) BW.Sprites.drawEmoji(ctx, '⚔️', x + s * 0.95, y - s * 0.9, s * 0.7);
        }
      }
      // tracer lines
      ctx.globalCompositeOperation = 'lighter';
      for (const tr of this.tracers) {
        tr.life -= dt;
        ctx.strokeStyle = `rgba(255,220,140,${Math.max(0, tr.life / 0.12)})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(tr.x0, tr.y0); ctx.lineTo(tr.x1, tr.y1); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      this.tracers = this.tracers.filter(tr => tr.life > 0);
      // box selection
      const box = g.input && g.input.box;
      if (box) {
        const x = Math.min(box.x0, box.x1), y = Math.min(box.y0, box.y1), w = Math.abs(box.x1 - box.x0), h = Math.abs(box.y1 - box.y0);
        ctx.fillStyle = 'rgba(255,220,100,0.08)'; ctx.strokeStyle = 'rgba(255,220,100,0.9)'; ctx.lineWidth = 1.5;
        ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
      }
    }
  }

  BW.UnitView = UnitView;
  BW.drawUnitIcon = body;
})(globalThis.BW = globalThis.BW || {});
