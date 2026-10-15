/* RDE // KONTRAKT — input: keyboard (layout-proof movement), mouse aim/fire, wheel, global shortcuts */
(function (K) {
  'use strict';
  class Input {
    constructor(game) {
      this.g = game;
      this.down = new Set(); this.pressed = new Set();
      this.mx = innerWidth / 2; this.my = innerHeight / 2; this.lmb = false; this.rmb = false; this.wheel = 0; this.slot = null;
      this.hasMouse = false;
      const isGameTarget = (e) => e.target && (e.target.tagName === 'CANVAS' && !e.target.closest('#panel,#phone,#mapview')) || e.target === document.body || (e.target.id === 'hud');
      window.addEventListener('keydown', (e) => this.key(e, true));
      window.addEventListener('keyup', (e) => this.key(e, false));
      window.addEventListener('blur', () => { this.down.clear(); this.lmb = this.rmb = false; });
      window.addEventListener('mousemove', (e) => { this.mx = e.clientX; this.my = e.clientY; this.hasMouse = true; });
      window.addEventListener('mousedown', (e) => {
        this.g.audio.unlock();
        if (e.button === 1) e.preventDefault();
        if (!isGameTarget(e) || this.g.paused) return;
        if (e.button === 0) { this.lmb = true; this.pressed.add('fire'); }
        if (e.button === 2) { this.rmb = true; this.pressed.add('aim'); }
      });
      window.addEventListener('mouseup', (e) => { if (e.button === 0) this.lmb = false; if (e.button === 2) this.rmb = false; });
      window.addEventListener('wheel', (e) => { if (this.g.paused || !isGameTarget(e)) return; this.wheel += e.deltaY > 0 ? 1 : -1; }, { passive: true });
      // never show the browser context menu, never autoscroll
      window.addEventListener('contextmenu', (e) => { if (!(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) e.preventDefault(); }, true);
      // touch: tap to move toward + fire is out of scope; keep the page from scrolling
      window.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    }
    key(e, isDown) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const g = this.g, k = e.key.toLowerCase(), code = e.code;
      if (isDown) g.audio.unlock();
      if (code === 'F11') { e.preventDefault(); if (isDown) { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); } return; }
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code) || (e.ctrlKey && ['s', 'w', 'd'].includes(k))) e.preventDefault();
      const id = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'space' }[code] || k;
      if (!isDown) { this.down.delete(id); return; }
      if (e.repeat) return;
      this.down.add(id);
      if (!g.world) return;
      const m = g.menus;
      // global UI shortcuts
      if (m.panelKind === 'tag' && k === 'z' && m.tagKeys) { m.tagKeys(e); return; }
      if (code === 'Escape') { m.escape(); return; }
      if (!document.querySelector('#title').classList.contains('hidden')) return;
      if (code === 'Tab' || k === 'i') { if (m.panelKind === 'inv') m.closePanel(); else if (!g.paused || m.panelKind) m.inventory(); return; }
      if (m.panelKind === 'inv' && /^[1-9]$/.test(e.key) && m.assignHover(+e.key - 1)) return;
      if (k === 'p') { m.togglePhone(); return; }
      if (k === 'm') { m.toggleMap(); return; }
      if (!document.querySelector('#mapview').classList.contains('hidden')) {
        const mk = { '+': 'in', '=': 'in', '-': 'out', '_': 'out', '0': 'fit', l: 'leg' }[k] || (code === 'Space' ? 'me' : code === 'NumpadAdd' ? 'in' : code === 'NumpadSubtract' ? 'out' : null);
        if (mk) { m.mapKey(mk); return; }
        const pan = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] }[code];
        if (pan && m.mapView) { m.mapView.cx += pan[0] * 30 / m.mapView.z; m.mapView.cy += pan[1] * 30 / m.mapView.z; m.drawMap(); return; }
      }
      if (k === 'b' && g.world.player.inCar && !g.paused) { this.pressed.add('b'); return; }   // seatbelt while driving
      if (k === 'b') { if (m.panelKind === 'crew') m.closePanel(); else if (!g.paused || m.panelKind) m.crew(); return; }
      if (g.paused) return;
      if (k === 'z' || k === 'y' && false) { g.zoomLevel = g.zoomLevel === 1 ? 1.3 : g.zoomLevel === 1.3 ? 0.78 : 1; return; }
      if (/^[1-9]$/.test(e.key)) { this.slot = +e.key - 1; return; }
      if (e.key === '0') { this.slot = -1; return; }
      const map = { e: 'e', f: 'f', t: 't', g: 'g', r: 'reload', h: 'holster', l: 'l', c: 'crouch', x: 'x', k: 'k', v: 'v', n: 'n', q: 'q' };
      if (map[k]) { this.pressed.add(map[k]); if (k === 'h') this.pressed.add('h'); if (k === 'r') this.pressed.add('r'); }
    }
    snapshot(world) {
      const r = this.g.renderer;
      let ax = null, ay = null;
      if (r && this.hasMouse) [ax, ay] = r.screenToWorld(this.mx, this.my);
      const pr = {};
      for (const p of this.pressed) pr[p] = true;
      const d = this.down;
      return {
        up: d.has('up'), down: d.has('down'), left: d.has('left'), right: d.has('right'), sprint: d.has('sprint'), space: d.has('space'),
        fire: this.lmb, aim: this.rmb, instinct: d.has('q'), eHeld: d.has('e'), tHeld: d.has('t'),
        ax, ay, slot: this.slot, wheel: this.wheel, pressed: pr,
      };
    }
    consume() { this.pressed.clear(); this.wheel = 0; this.slot = null; }
  }
  K.Input = Input;
})(globalThis.K = globalThis.K || {});
