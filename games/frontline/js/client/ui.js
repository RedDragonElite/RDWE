/* RDE // FRONTLINE — DOM HUD (leaderboard, stats, build bar, feed, tooltip, radial menu) */
(function (BW) {
  'use strict';
  const C = BW.C, fmt = BW.fmt, rgba = BW.rgba;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const SVG = {
    city: '<svg viewBox="0 0 32 32"><path fill="#ffcc55" d="M4 28V14l6-4 6 4v14zM16 28V6h8v22zM24 28V12h5v16z"/><path fill="#1a1d2a" d="M7 17h2v2H7zm4 0h2v2h-2zM7 22h2v2H7zm4 0h2v2h-2zm8-12h2v2h-2zm0 5h2v2h-2zm0 5h2v2h-2z"/></svg>',
    port: '<svg viewBox="0 0 32 32" fill="none" stroke="#7fd3ff" stroke-width="2.4" stroke-linecap="round"><circle cx="16" cy="6" r="2.6"/><path d="M16 9v18M10 14h12M5 19c1 6 6 8 11 8s10-2 11-8"/></svg>',
    defense: '<svg viewBox="0 0 32 32"><path fill="#9db4ff" d="M16 3l11 4v8c0 7-5 12-11 14C10 27 5 22 5 15V7z"/><path fill="#1a1d2a" d="M16 8v17c-4-2-7-5-7-10V10z" opacity=".35"/></svg>',
    silo: '<svg viewBox="0 0 32 32"><path fill="#d6d9e6" d="M16 2c3 3 4 7 4 11v9l4 5H8l4-5v-9c0-4 1-8 4-11z"/><circle cx="16" cy="12" r="2" fill="#ff2a3d"/></svg>',
    sam: '<svg viewBox="0 0 32 32" fill="none" stroke="#7dffb8" stroke-width="2.4" stroke-linecap="round"><path d="M5 24a11 11 0 0 1 22 0M16 24L25 8M9 28h14"/><circle cx="25" cy="8" r="2.5" fill="#7dffb8"/></svg>',
    atom: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#ffcc55"/><path fill="#1a1d2a" d="M16 16L9.5 4.7A13 13 0 0 1 22.5 4.7zM16 16l13 0a13 13 0 0 1-6.5 11.3zM16 16L9.5 27.3A13 13 0 0 1 3 16z"/><circle cx="16" cy="16" r="3" fill="#ffcc55" stroke="#1a1d2a" stroke-width="1.5"/></svg>',
    hydro: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#ff4df0"/><path fill="#1a1d2a" d="M16 16L9.5 4.7A13 13 0 0 1 22.5 4.7zM16 16l13 0a13 13 0 0 1-6.5 11.3zM16 16L9.5 27.3A13 13 0 0 1 3 16z"/><circle cx="16" cy="16" r="3" fill="#ff4df0" stroke="#1a1d2a" stroke-width="1.5"/></svg>',
  };
  BW.SVG = SVG;

  class UI {
    constructor(game) {
      this.game = game;
      this.feedEl = $('feed');
      this.toastsEl = $('toasts');
      this.tip = $('tooltip');
      this.radial = $('radial');
      this.toasts = new Map();
      this._buildBuildbar();
      this._bindStatic();
    }

    _buildBuildbar() {
      const bar = $('buildbar');
      bar.innerHTML = '';
      this.bbtns = {};
      const items = [...Object.entries(C.BUILD), ...Object.entries(C.NUKES)];
      for (const [k, d] of items) {
        const nuke = !!C.NUKES[k];
        const b = document.createElement('div');
        b.className = 'bbtn' + (nuke ? ' nukebtn' : '');
        b.innerHTML = `<span class="k">${d.key}</span><span class="n"></span>${SVG[k]}<div class="nm">${d.short || d.name}</div><div class="c"></div>
          <div class="tip">${esc(d.desc || (nuke ? 'Radius ' + d.radius + ' · benötigt Raketensilo' : ''))}</div>`;
        b.addEventListener('click', () => { this.game.audio.play('click'); this.game.setMode(this.game.mode === k ? null : k); });
        bar.appendChild(b);
        this.bbtns[k] = b;
      }
    }

    _bindStatic() {
      const g = this.game;
      // listeners outlive a Game instance (restart) → only the running game reacts
      const on = (el, ev, fn) => el.addEventListener(ev, (e) => { if (g.running) fn(e); });
      const ratio = $('ratio');
      on(ratio, 'input', () => g.setRatio(ratio.value / 100));
      document.querySelectorAll('.ratio-presets button').forEach((b) => on(b, 'click', () => g.setRatio(+b.dataset.r / 100)));
      on($('board-toggle'), 'click', () => $('board').classList.toggle('collapsed'));
      on($('btn-mute'), 'click', () => g.toggleMute());
      on($('btn-pause'), 'click', () => g.togglePause());
      on($('btn-speed'), 'click', () => g.cycleSpeed());
      on($('btn-full'), 'click', () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.();
      });
      const mm = $('minimap');
      const jump = (e) => {
        const r = mm.getBoundingClientRect();
        g.renderer.focus((e.clientX - r.left) / r.width * g.sim.W, (e.clientY - r.top) / r.height * g.sim.H);
      };
      let mmDown = false;
      on(mm, 'pointerdown', (e) => { mmDown = true; jump(e); });
      on(window, 'pointerup', () => { mmDown = false; });
      on(mm, 'pointermove', (e) => { if (mmDown) jump(e); });
      on($('board-body'), 'click', (e) => {
        const tr = e.target.closest('tr[data-pid]');
        if (!tr) return;
        const [x, y] = g.renderer.labelPos(+tr.dataset.pid);
        g.renderer.focus(x, y, Math.max(g.renderer.cam.tz, 3));
      });
    }

    setRatio(r) {
      $('ratio').value = Math.round(r * 100);
      $('ratio-val').textContent = Math.round(r * 100) + '%';
      document.querySelectorAll('.ratio-presets button').forEach((b) => b.classList.toggle('on', +b.dataset.r === Math.round(r * 100)));
    }

    setMode(mode) {
      for (const [k, b] of Object.entries(this.bbtns)) b.classList.toggle('active', k === mode);
      const hint = $('mode-hint');
      if (!mode) { hint.classList.add('hidden'); return; }
      const nuke = !!C.NUKES[mode];
      const d = nuke ? C.NUKES[mode] : C.BUILD[mode];
      hint.textContent = nuke ? `☢ ZIEL FÜR ${d.name.toUpperCase()} WÄHLEN · Rechtsklick/ESC = Abbruch` : `${d.name.toUpperCase()} PLATZIEREN · auf eigenes Land klicken · ESC = Abbruch`;
      hint.classList.toggle('nuke', nuke);
      hint.classList.remove('hidden');
    }

    update() {
      const g = this.game, sim = g.sim, me = g.me;
      // stats
      const max = sim.maxTroops(me);
      $('troops').textContent = fmt(me.troops);
      $('troops-max').textContent = fmt(max);
      $('troop-rate').textContent = '+' + fmt(sim.troopRate(me) * 10) + '/s';
      $('troop-bar').style.width = Math.min(100, (me.troops / max) * 100) + '%';
      $('gold').textContent = fmt(me.gold);
      $('gold-rate').textContent = '+' + fmt(sim.goldRate(me) * 10) + '/s';
      $('ratio-troops').textContent = '→ ' + fmt(me.troops * g.ratio) + ' Truppen';
      // build buttons
      const silo = me.counts.silo > 0;
      for (const [k, b] of Object.entries(this.bbtns)) {
        const nuke = !!C.NUKES[k];
        const cost = nuke ? C.NUKES[k].cost : sim.buildCost(me, k);
        b.querySelector('.c').textContent = fmt(cost);
        b.querySelector('.n').textContent = nuke ? '' : (me.counts[k] || '');
        b.classList.toggle('poor', me.gold < cost || (nuke && !silo));
      }
      // fronts
      const fronts = [];
      for (const a of sim.attacks) {
        if (a.attacker === me.id) fronts.push(`<span class="front">⚔ ${a.target ? esc(sim.players[a.target].name) : 'Wildnis'} · ${fmt(a.troops)}</span>`);
        else if (a.target === me.id) fronts.push(`<span class="front in">🛡 ${esc(sim.players[a.attacker].name)} · ${fmt(a.troops)}</span>`);
      }
      for (const b of sim.boats) if (b.owner === me.id) fronts.push(`<span class="front">⛵ ${fmt(b.troops)}</span>`);
      const fh = fronts.join('');
      if (fh !== this._frontsHtml) { $('fronts').innerHTML = fh; this._frontsHtml = fh; }

      // leaderboard
      const land = sim.map.landCount;
      const ps = sim.players.filter(Boolean).sort((a, b) => (b.alive - a.alive) || (b.tiles - a.tiles));
      const top = ps.slice(0, 10);
      if (!top.includes(me)) top.push(me);
      let html = '';
      for (const p of top) {
        const rank = ps.indexOf(p) + 1;
        const cls = (p === me ? 'me ' : '') + (p.alive ? '' : 'dead');
        const tag = me.allies.has(p.id) ? ' ◆' : '';
        html += `<tr class="${cls}" data-pid="${p.id}"><td>${rank}</td><td class="nm"><span class="dot" style="background:${rgba(p.color, 1)};color:${rgba(p.color, 1)}"></span>${esc(p.name)}${tag}</td><td>${fmt(p.troops)}</td><td>${((p.tiles / land) * 100).toFixed(1)}%</td></tr>`;
      }
      if (html !== this._boardHtml) { $('board-body').innerHTML = html; this._boardHtml = html; }

      // share bar
      const segs = ps.filter((p) => p.alive && p.tiles > 0).slice(0, 12);
      let sh = '';
      for (const p of segs) sh += `<div style="width:${(p.tiles / land) * 100}%;background:${rgba(p.color, 1)}" title="${esc(p.name)}"></div>`;
      if (sh !== this._shareHtml) { $('sharefill').innerHTML = sh; this._shareHtml = sh; }
      $('winmark').style.left = C.WIN_SHARE * 100 + '%';

      // clock & spawn
      const secs = Math.max(0, Math.floor((sim.tick - C.SPAWN_TICKS) / 10));
      $('clock').textContent = String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');
      const spawning = sim.phase === 'spawn';
      $('spawn-banner').classList.toggle('hidden', !spawning);
      if (spawning) $('spawn-timer').textContent = Math.ceil((C.SPAWN_TICKS - sim.tick) / 10);

      // ally request toasts lifetime
      for (const [from, t] of this.toasts) {
        const r = sim.allyRequests.find((x) => x.from === from && x.to === me.id);
        if (!r) { t.remove(); this.toasts.delete(from); continue; }
        t.querySelector('.t-bar').style.width = Math.max(0, ((r.expires - sim.tick) / 200) * 100) + '%';
      }
    }

    feed(msg, cls = '', ttl = 7000) {
      const el = document.createElement('div');
      el.className = 'feed-item ' + cls;
      el.innerHTML = msg;
      this.feedEl.prepend(el);
      while (this.feedEl.children.length > 7) this.feedEl.lastChild.remove();
      setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 700); }, ttl);
    }

    allyToast(from) {
      if (this.toasts.has(from)) return;
      const g = this.game, p = g.sim.players[from];
      const t = document.createElement('div');
      t.className = 'toast glass';
      t.innerHTML = `<div class="t-title"><span style="color:${rgba(p.color, 1)}">${esc(p.name)}</span> bietet ein Bündnis an.</div>
        <div class="t-btns"><button class="tb-btn" data-a="1">✔ Annehmen</button><button class="tb-btn" data-a="0">✖ Ablehnen</button></div><div class="t-bar"></div>`;
      t.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        g.send({ type: 'allyReply', target: from, accept: b.dataset.a === '1' });
        t.remove(); this.toasts.delete(from);
      }));
      this.toastsEl.appendChild(t);
      this.toasts.set(from, t);
    }

    tooltip(sx, sy, tile) {
      const g = this.game, sim = g.sim;
      if (tile < 0 || this.radialOpen) { this.tip.classList.add('hidden'); return; }
      const o = sim.owner[tile], ter = C.TERRAIN[sim.terrain[tile]];
      let html;
      if (o) {
        const p = sim.players[o];
        const tag = o === g.me.id ? '<span class="tag me">DU</span>' : g.me.allies.has(o) ? '<span class="tag ally">VERBÜNDET</span>' : '<span class="tag foe">FEIND</span>';
        html = `<div class="tt-name"><span class="dot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${rgba(p.color, 1)}"></span>${esc(p.name)}${tag}</div>
          <div class="tt-row">Truppen <b>${fmt(p.troops)}</b></div>
          <div class="tt-row">Land <b>${((p.tiles / sim.map.landCount) * 100).toFixed(2)}%</b></div>
          <div class="tt-row">Gold <b>${fmt(p.gold)}</b></div>
          <div class="tt-row">Gelände <b>${ter.name}</b></div>`;
        const s = sim.structAt.get(tile);
        if (s) html += `<div class="tt-row">Gebäude <b>${C.BUILD[s.kind].name}</b></div>`;
      } else {
        html = `<div class="tt-name">${ter.water ? '🌊 ' + ter.name : '🌿 Wildnis'}</div><div class="tt-row">${ter.water ? 'Ozean' : 'Gelände'} <b>${ter.name}</b></div>`;
        if (!ter.water) html += `<div class="tt-row">Kosten <b>×${ter.cost}</b></div>`;
        if (sim.rad[tile] > sim.tick) html += `<div class="tt-row" style="color:#b6ff4d">☢ Verstrahlt <b>${Math.ceil((sim.rad[tile] - sim.tick) / 10)}s</b></div>`;
      }
      if (html !== this._tipHtml) { this.tip.innerHTML = html; this._tipHtml = html; }
      this.tip.classList.remove('hidden');
      const w = this.tip.offsetWidth, h = this.tip.offsetHeight;
      let x = sx + 18, y = sy + 18;
      if (x + w > innerWidth - 8) x = sx - w - 14;
      if (y + h > innerHeight - 8) y = sy - h - 14;
      this.tip.style.left = x + 'px'; this.tip.style.top = y + 'px';
    }

    openRadial(sx, sy, tile) {
      const g = this.game, sim = g.sim, me = g.me;
      if (tile < 0 || sim.phase !== 'play' || !me.alive) return;
      const o = sim.owner[tile], land = sim.isLand(tile);
      const items = [];
      if (o === me.id) {
        for (const k of Object.keys(C.BUILD)) {
          const cost = sim.buildCost(me, k);
          items.push({ icon: SVG[k], label: C.BUILD[k].name, off: me.gold < cost, fn: () => g.send({ type: 'build', kind: k, tile }) });
        }
      } else if (land) {
        const ally = me.allies.has(o);
        items.push({ icon: '⚔', label: 'Angriff', off: ally, fn: () => g.attack(tile) });
        items.push({ icon: '⛵', label: 'Boot', off: ally, fn: () => g.send({ type: 'boat', tile, ratio: g.ratio }) });
        if (o) {
          items.push(ally
            ? { icon: '💔', label: 'Brechen', fn: () => g.send({ type: 'unally', target: o }) }
            : { icon: '🤝', label: 'Bündnis', fn: () => g.send({ type: 'ally', target: o }) });
        }
      }
      if (me.counts.silo) {
        items.push({ icon: SVG.atom, label: 'Atom', off: me.gold < C.NUKES.atom.cost, fn: () => g.send({ type: 'nuke', kind: 'atom', tile }) });
        items.push({ icon: SVG.hydro, label: 'H-Bombe', off: me.gold < C.NUKES.hydro.cost, fn: () => g.send({ type: 'nuke', kind: 'hydro', tile }) });
      }
      if (!items.length) return;
      const title = o ? esc(sim.players[o].name) : land ? 'Wildnis' : 'Ozean';
      const R = 78;
      let html = `<div class="r-center">${title}</div>`;
      items.forEach((it, i) => {
        const a = -Math.PI / 2 + (i / items.length) * Math.PI * 2;
        const ic = it.icon.startsWith('<svg') ? it.icon.replace('<svg', '<svg width="24" height="24"') : `<span class="ri">${it.icon}</span>`;
        html += `<div class="r-item${it.off ? ' off' : ''}" data-i="${i}" style="left:${Math.cos(a) * R}px;top:${Math.sin(a) * R}px;animation-delay:${i * 18}ms">${ic}<span>${it.label}</span></div>`;
      });
      const r = this.radial;
      r.innerHTML = html;
      r.style.left = Math.max(120, Math.min(innerWidth - 120, sx)) + 'px';
      r.style.top = Math.max(120, Math.min(innerHeight - 120, sy)) + 'px';
      r.classList.remove('hidden');
      this.radialOpen = true;
      this.tip.classList.add('hidden');
      r.querySelectorAll('.r-item').forEach((el) => el.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        g.audio.play('click');
        items[+el.dataset.i].fn();
        this.closeRadial();
      }));
    }
    closeRadial() { this.radial.classList.add('hidden'); this.radialOpen = false; }

    showEnd(win, title, sub) {
      const g = this.game, me = g.me, sim = g.sim;
      $('end-title').textContent = title;
      $('end-title').className = 'end-title ' + (win ? 'win' : 'lose');
      $('end-sub').textContent = sub;
      const t = Math.floor((sim.tick - C.SPAWN_TICKS) / 10);
      $('end-stats').innerHTML = `
        <div><b>${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}</b><span>SPIELZEIT</span></div>
        <div><b>${((me.stats.peak / sim.map.landCount) * 100).toFixed(1)}%</b><span>MAX. LAND</span></div>
        <div><b>${fmt(me.stats.conquered)}</b><span>FELDER EROBERT</span></div>
        <div><b>${me.stats.nukes}</b><span>ATOMSCHLÄGE</span></div>`;
      $('end').classList.remove('hidden');
    }
  }

  BW.UI = UI;
})(globalThis.BW = globalThis.BW || {});
