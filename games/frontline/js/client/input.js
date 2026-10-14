/* RDE // FRONTLINE — mouse / touch / keyboard input → game actions */
(function (BW) {
  'use strict';
  const C = BW.C;

  class Input {
    constructor(game, canvas) {
      this.game = game;
      this.canvas = canvas;
      this.pointers = new Map();
      this.keys = new Set();
      this.drag = null;
      this.pinch = null;
      this.mx = -1; this.my = -1;

      // listeners outlive a Game instance (restart) → only the running game reacts
      const on = (el, ev, fn, opt) => el.addEventListener(ev, (e) => { if (game.running) fn(e); }, opt);
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      on(canvas, 'pointerdown', (e) => this.down(e));
      on(window, 'pointermove', (e) => this.move(e));
      on(window, 'pointerup', (e) => this.up(e));
      window.addEventListener('pointercancel', (e) => this.pointers.delete(e.pointerId));
      on(canvas, 'wheel', (e) => {
        e.preventDefault();
        const f = Math.pow(1.0018, -e.deltaY * (e.deltaMode ? 30 : 1));
        game.renderer.zoomAt(e.clientX, e.clientY, f);
      }, { passive: false });
      on(window, 'keydown', (e) => this.key(e, true));
      on(window, 'keyup', (e) => this.key(e, false));
      window.addEventListener('blur', () => this.keys.clear());
    }

    tileAt(sx, sy) {
      const r = this.game.renderer, [wx, wy] = r.screenToWorld(sx, sy);
      const x = Math.floor(wx), y = Math.floor(wy);
      if (x < 0 || y < 0 || x >= r.W || y >= r.H) return -1;
      return y * r.W + x;
    }

    down(e) {
      this.game.audio.unlock();
      this.canvas.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, t: performance.now() });
      if (this.game.ui.radialOpen && e.button !== 2) { this.game.ui.closeRadial(); this.pointers.delete(e.pointerId); return; }
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
      }
    }
    move(e) {
      this.mx = e.clientX; this.my = e.clientY;
      const p = this.pointers.get(e.pointerId);
      if (p) {
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        if (this.pointers.size === 2 && this.pinch) {
          const [a, b] = [...this.pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          this.game.renderer.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / this.pinch.d);
          this.pinch.d = d; p.moved = true;
          return;
        }
        if (!p.moved && Math.hypot(p.x - p.sx, p.y - p.sy) > 6) p.moved = true;
        if (p.moved) this.game.renderer.pan(dx, dy);
      }
      if (e.target === this.canvas || p) this.game.hover(e.clientX, e.clientY, this.tileAt(e.clientX, e.clientY));
      else this.game.hover(-1, -1, -1);
    }
    up(e) {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (!p || p.moved) return;
      const t = this.tileAt(e.clientX, e.clientY);
      const longPress = e.pointerType === 'touch' && performance.now() - p.t > 450;
      if (p.button === 2 || longPress) {
        if (this.game.mode) { this.game.setMode(null); return; }
        this.game.ui.openRadial(e.clientX, e.clientY, t);
      } else if (p.button === 0) {
        this.game.click(t);
      }
    }

    key(e, down) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (down) this.keys.add(k); else { this.keys.delete(k); return; }
      const g = this.game;
      if (!g.running) return;
      const presets = { 1: 0.1, 2: 0.2, 3: 0.3, 4: 0.5, 5: 0.75, 6: 1 };
      if (presets[e.key]) { g.setRatio(presets[e.key]); return; }
      if (k === 'escape') { if (g.panels.current) g.panels.close(); g.setMode(null); g.ui.closeRadial(); return; }
      if (k === 'tab') { e.preventDefault(); g.ui.cycleTab(); return; }
      if (k === ' ') { e.preventDefault(); g.focusMe(); return; }
      if (k === 'p') { g.togglePause(); return; }
      if (k === 'm') { g.toggleMute(); return; }
      if (k === 'q') { g.setRatio(Math.max(0.01, g.ratio - 0.05)); return; }
      if (k === 'e') { g.setRatio(Math.min(1, g.ratio + 0.05)); return; }
      if (k === 'home') { g.renderer.fitView(false); return; }
      for (const [kind, d] of [...Object.entries(C.BUILD), ...Object.entries(C.NUKES)]) {
        if (d.key && d.key.toLowerCase() === k) { g.setMode(g.mode === kind ? null : kind); return; }
      }
    }

    update(dt) {
      const r = this.game.renderer, s = 700 * dt;
      let dx = 0, dy = 0;
      if (this.keys.has('w') || this.keys.has('arrowup')) dy += s;
      if (this.keys.has('s') || this.keys.has('arrowdown')) dy -= s;
      if (this.keys.has('a') || this.keys.has('arrowleft')) dx += s;
      if (this.keys.has('d') || this.keys.has('arrowright')) dx -= s;
      if (dx || dy) { r.cam.tx -= dx / r.cam.zoom; r.cam.ty -= dy / r.cam.zoom; }
      if (this.keys.has('+') || this.keys.has('=')) r.zoomAt(r.cw / 2, r.ch / 2, 1 + dt * 2);
      if (this.keys.has('-')) r.zoomAt(r.cw / 2, r.ch / 2, 1 - dt * 2);
    }
  }

  BW.Input = Input;
})(globalThis.BW = globalThis.BW || {});
