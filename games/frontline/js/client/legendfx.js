/* RDE // FRONTLINE — legend visuals: the Red Dragon, ultimate abilities, SAM tracers */
(function (BW) {
  'use strict';

  class LegendView {
    constructor(r) { this.r = r; this.beams = []; this.auras = []; }

    /** vector dragon seen from above; s = body scale in px, flap 0..1 */
    _dragon(ctx, s, flap, t, breath) {
      const wingA = Math.sin(flap * Math.PI * 2) * 0.5 + 0.5;          // 0 down … 1 up
      const span = 1.25 + wingA * 0.35;
      const g = (x0, y0, x1, y1, a, b) => { const gr = ctx.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
      // wings (membranes with finger bones)
      for (const side of [-1, 1]) {
        ctx.save(); ctx.scale(1, side);
        ctx.fillStyle = g(0, 0, -s * 0.3, s * span, 'rgba(150,20,24,0.95)', 'rgba(60,6,10,0.9)');
        ctx.strokeStyle = '#2a0406'; ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.beginPath();
        ctx.moveTo(s * 0.25, s * 0.08);
        ctx.quadraticCurveTo(s * 0.2, s * span * 0.7, -s * 0.15, s * span);
        ctx.lineTo(-s * 0.3, s * span * 0.62); ctx.lineTo(-s * 0.48, s * span * 0.86);
        ctx.lineTo(-s * 0.55, s * span * 0.5); ctx.lineTo(-s * 0.78, s * span * 0.6);
        ctx.quadraticCurveTo(-s * 0.55, s * 0.25, -s * 0.3, s * 0.06);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,120,60,0.35)';
        for (const [ex, ey] of [[-0.15, 1], [-0.48, 0.86], [-0.78, 0.6]]) { ctx.beginPath(); ctx.moveTo(s * 0.18, s * 0.12); ctx.lineTo(s * ex, s * span * ey); ctx.stroke(); }
        ctx.restore();
      }
      // tail
      ctx.strokeStyle = g(-s * 0.3, 0, -s * 1.6, 0, '#9c141a', '#3a0508'); ctx.lineCap = 'round';
      ctx.lineWidth = s * 0.16;
      ctx.beginPath(); ctx.moveTo(-s * 0.3, 0);
      ctx.bezierCurveTo(-s * 0.8, Math.sin(t * 3) * s * 0.25, -s * 1.1, -Math.sin(t * 3) * s * 0.3, -s * 1.55, Math.sin(t * 3 + 1) * s * 0.2);
      ctx.stroke();
      ctx.fillStyle = '#5a0a0e';
      const tx = -s * 1.55, ty = Math.sin(t * 3 + 1) * s * 0.2;
      ctx.beginPath(); ctx.moveTo(tx - s * 0.15, ty); ctx.lineTo(tx + s * 0.05, ty - s * 0.1); ctx.lineTo(tx + s * 0.05, ty + s * 0.1); ctx.fill();
      // body
      ctx.fillStyle = g(0, -s * 0.2, 0, s * 0.2, '#d4262e', '#5c080d');
      ctx.strokeStyle = '#2a0406'; ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.2, 0, 0, 6.283); ctx.fill(); ctx.stroke();
      // glowing belly / spine
      ctx.fillStyle = `rgba(255,${140 + Math.sin(t * 5) * 40},40,0.55)`;
      ctx.beginPath(); ctx.ellipse(s * 0.02, 0, s * 0.26, s * 0.06, 0, 0, 6.283); ctx.fill();
      // neck & head
      ctx.strokeStyle = '#b81c23'; ctx.lineWidth = s * 0.14;
      ctx.beginPath(); ctx.moveTo(s * 0.3, 0); ctx.quadraticCurveTo(s * 0.5, Math.sin(t * 2) * s * 0.08, s * 0.66, 0); ctx.stroke();
      ctx.fillStyle = g(s * 0.6, 0, s * 0.95, 0, '#c71f27', '#6a0a10');
      ctx.beginPath(); ctx.moveTo(s * 0.6, -s * 0.11); ctx.lineTo(s * 0.92, -s * 0.05); ctx.lineTo(s * 0.98, 0); ctx.lineTo(s * 0.92, s * 0.05); ctx.lineTo(s * 0.6, s * 0.11); ctx.closePath(); ctx.fill(); ctx.stroke();
      // horns & eyes
      ctx.strokeStyle = '#e8d6b0'; ctx.lineWidth = Math.max(1, s * 0.025);
      ctx.beginPath(); ctx.moveTo(s * 0.64, -s * 0.09); ctx.lineTo(s * 0.52, -s * 0.2); ctx.moveTo(s * 0.64, s * 0.09); ctx.lineTo(s * 0.52, s * 0.2); ctx.stroke();
      ctx.fillStyle = '#ffd34d'; ctx.shadowColor = '#ffb000'; ctx.shadowBlur = s * 0.1;
      ctx.beginPath(); ctx.arc(s * 0.8, -s * 0.045, s * 0.022, 0, 6.283); ctx.arc(s * 0.8, s * 0.045, s * 0.022, 0, 6.283); ctx.fill();
      ctx.shadowBlur = 0;
      if (breath) {
        const fg = ctx.createRadialGradient(s * 1.0, 0, 0, s * 1.0, 0, s * 0.3);
        fg.addColorStop(0, 'rgba(255,255,200,0.9)'); fg.addColorStop(1, 'rgba(255,120,0,0)');
        ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(s * 1.0, 0, s * 0.3, 0, 6.283); ctx.fill();
      }
    }

    draw(ctx, alpha, dt) {
      const r = this.r, sim = r.sim, d = sim.dragon, t = r.time;
      // ultimate auras on nations
      for (const a of this.auras) {
        a.life -= dt;
        const [x, y] = r.worldToScreen(a.x, a.y), k = 1 - a.life / a.max;
        ctx.strokeStyle = a.color.replace('A', String(Math.max(0, a.life / a.max)));
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x, y, (20 + k * 260 + i * 30) * (r.cam.zoom / 3), 0, 6.283); ctx.stroke(); }
      }
      this.auras = this.auras.filter(a => a.life > 0);
      // SAM beams
      ctx.globalCompositeOperation = 'lighter';
      for (const b of this.beams) {
        b.life -= dt;
        const [x0, y0] = r.worldToScreen(b.sx, b.sy), [x1, y1] = r.worldToScreen(b.x, b.y);
        ctx.strokeStyle = `rgba(140,230,255,${Math.max(0, b.life / 0.4)})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      this.beams = this.beams.filter(b => b.life > 0);
      if (!d) return;
      const wx = d.px + (d.x - d.px) * alpha, wy = d.py + (d.y - d.py) * alpha;
      const s = Math.max(70, Math.min(420, r.cam.zoom * 13));
      const alt = s * 0.6;
      const [gx, gy] = r.worldToScreen(wx, wy);
      // ground shadow
      ctx.save(); ctx.translate(gx + alt * 0.35, gy + alt * 0.55); ctx.rotate(d.heading); ctx.globalAlpha = 0.28; ctx.filter = 'blur(6px)';
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.6, s * 1.1, 0, 0, 6.283); ctx.fill();
      ctx.restore(); ctx.filter = 'none'; ctx.globalAlpha = 1;
      // heat glow
      const hg = ctx.createRadialGradient(gx, gy, 0, gx, gy, s * 1.4);
      hg.addColorStop(0, 'rgba(255,90,30,0.22)'); hg.addColorStop(1, 'rgba(255,40,0,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(gx, gy, s * 1.4, 0, 6.283); ctx.fill();
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(d.heading);
      this._dragon(ctx, s, (t * 0.9) % 1, t, d.breath);
      ctx.restore();
      // fire breath stream (world particles)
      if (d.breath) {
        const hx = wx + Math.cos(d.heading) * 3.2, hy = wy + Math.sin(d.heading) * 3.2;
        for (let i = 0; i < (r.game.settings.fx ? 26 : 10); i++) {
          const a = d.heading + (Math.random() - 0.5) * 0.7, sp = 6 + Math.random() * 10;
          r.particles.push({ x: hx, y: hy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.4, max: 0.9, size: 0.6 + Math.random() * 0.9,
            color: [255, 120 + Math.random() * 120, 30], glow: true, drag: 2.5 });
        }
      }
      // embers trailing from the wings
      if (Math.random() < 0.5) r.particles.push({ x: wx + (Math.random() - 0.5) * 4, y: wy + (Math.random() - 0.5) * 4, vx: 0, vy: 1.5, life: 1.2, max: 1.2, size: 0.25, color: [255, 160, 60], glow: true });
    }
    ult(kind, x, y, color) {
      const c = kind === 'blitz' ? 'rgba(255,230,90,A)' : kind === 'bulwark' ? 'rgba(120,200,255,A)' : 'rgba(255,90,30,A)';
      this.auras.push({ x, y, life: 1.6, max: 1.6, color: c });
    }
    sam(e) { this.beams.push({ sx: e.sx + 0.5, sy: e.sy + 0.5, x: e.x, y: e.y, life: 0.4 }); }
  }

  BW.LegendView = LegendView;
})(globalThis.BW = globalThis.BW || {});
