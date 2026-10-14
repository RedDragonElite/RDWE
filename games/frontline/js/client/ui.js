/* RDE // FRONTLINE — DOM HUD: resource bar, build dock, leaderboard, stats, feed, banner, tooltip, radial menu */
(function (BW) {
  'use strict';
  const C = BW.C, fmt = BW.fmt, rgba = BW.rgba;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  BW.esc = esc;

  const resE = (k) => (k === 'gold' ? C.GOLD.e : C.RES[k].e);
  const resN = (k) => (k === 'gold' ? C.GOLD.name : C.RES[k].name);
  const have = (p, k) => (k === 'gold' ? p.gold : p.res[k]);
  /** cost object → chips; missing amounts are flagged red */
  function costHtml(cost, p) {
    return Object.entries(cost).map(([k, v]) =>
      `<span class="cost${p && have(p, k) < v ? ' miss' : ''}" title="${resN(k)}">${resE(k)}${fmt(v)}</span>`).join('');
  }
  BW.costHtml = costHtml;
  const signed = (v) => (v >= 0 ? '+' : '−') + fmt(Math.abs(v));

  const RADIAL_PREF = ['mine', 'derrick', 'city', 'farm', 'sawmill', 'port', 'fort', 'barracks', 'market', 'lab', 'bank', 'sam', 'radar', 'bunker', 'silo', 'wonder'];

  class UI {
    constructor(game) {
      this.game = game;
      this.feedEl = $('feed');
      this.toastsEl = $('toasts');
      this.tip = $('tooltip');
      this.radial = $('radial');
      this.toasts = new Map();
      this.tab = 'eco';
      this._buildResbar();
      this._buildDockTabs();
      this._bindStatic();
      if (innerWidth < 760) $('board').classList.add('collapsed');
    }

    // ---------------------------------------------------------------- resource bar
    _buildResbar() {
      const keys = ['gold', ...C.TRADE_RES, 'sci'];
      $('resbar').innerHTML = keys.map(k => `<div class="res" id="res-${k}" title="${resN(k)}"><span class="re">${resE(k)}</span><span class="rv">0</span><span class="rr">+0</span></div>`).join('');
      this.resEls = Object.fromEntries(keys.map(k => [k, { v: $('res-' + k).querySelector('.rv'), r: $('res-' + k).querySelector('.rr'), el: $('res-' + k) }]));
    }

    // ---------------------------------------------------------------- build dock
    _buildDockTabs() {
      $('dock-tabs').innerHTML = Object.entries(C.BUILD_CATS).map(([k, c]) => `<button class="dtab${k === this.tab ? ' on' : ''}" data-tab="${k}">${c.e} ${c.name}</button>`).join('');
      this._renderDock();
    }
    setTab(t) {
      this.tab = t;
      document.querySelectorAll('.dtab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
      this._renderDock();
    }
    cycleTab() {
      const k = Object.keys(C.BUILD_CATS);
      this.setTab(k[(k.indexOf(this.tab) + 1) % k.length]);
    }
    _dockItems() {
      if (this.tab === 'weapons') return Object.keys(C.NUKES).map(k => ({ k, d: C.NUKES[k], nuke: true }));
      if (this.tab === 'army') return Object.keys(C.UNITS).map(k => ({ k, d: C.UNITS[k], unit: true }));
      return Object.keys(C.BUILD).filter(k => C.BUILD[k].cat === this.tab).map(k => ({ k, d: C.BUILD[k], nuke: false }));
    }
    _renderDock() {
      const wrap = $('dock-cards');
      wrap.innerHTML = this._dockItems().map(({ k, d, nuke, unit }) => `
        <div class="card${nuke ? ' nukecard' : ''}${unit ? ' unitcard' : ''}" data-k="${k}">
          ${d.key ? `<span class="k">${d.key}</span>` : ''}<span class="n"></span>
          <div class="ce">${unit ? `<canvas class="uicon" data-kind="${k}" width="64" height="40"></canvas>` : d.e}</div>
          <div class="cn">${d.short || d.name}</div>
          <div class="cc"></div>
          <div class="lock hidden"></div>
          <div class="tip"><b>${d.e} ${d.name}</b><br>${esc(d.desc || ('Radius ' + d.radius + ' · startet aus einem Raketensilo'))}<div class="tip-why"></div></div>
        </div>`).join('');
      this.cards = {};
      wrap.querySelectorAll('.card').forEach(el => {
        const k = el.dataset.k;
        this.cards[k] = { el, cc: el.querySelector('.cc'), n: el.querySelector('.n'), lock: el.querySelector('.lock'), why: el.querySelector('.tip-why') };
        el.addEventListener('click', () => { this.game.audio.play('click'); this.game.setMode(this.game.mode === k ? null : k); });
      });
      this._cardKey = '';
      wrap.querySelectorAll('canvas.uicon').forEach(cv => {
        const x = cv.getContext('2d'); x.translate(32, 20); x.rotate(-0.35);
        BW.drawUnitIcon(x, cv.dataset.kind, 16, this.game.me.color, 0, false);
      });
      this.setMode(this.game.mode);
    }

    _bindStatic() {
      const g = this.game;
      // listeners outlive a Game instance (restart) → only the running game reacts
      const on = (el, ev, fn) => el.addEventListener(ev, (e) => { if (g.running) fn(e); });
      const ratio = $('ratio');
      on(ratio, 'input', () => g.setRatio(ratio.value / 100));
      document.querySelectorAll('.ratio-presets button').forEach((b) => on(b, 'click', () => g.setRatio(+b.dataset.r / 100)));
      on($('dock-tabs'), 'click', (e) => { const b = e.target.closest('.dtab'); if (b) { g.audio.play('click'); this.setTab(b.dataset.tab); } });
      on($('board-toggle'), 'click', () => $('board').classList.toggle('collapsed'));
      on($('btn-mute'), 'click', () => g.toggleMute());
      on($('btn-pause'), 'click', () => g.togglePause());
      on($('btn-speed'), 'click', () => g.cycleSpeed());
      on($('btn-full'), 'click', () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.();
      });
      document.querySelectorAll('.rail-btn').forEach(b => on(b, 'click', () => { g.audio.play('click'); g.panels.toggle(b.dataset.panel); }));
      on($('modal-close'), 'click', () => g.panels.close());
      on($('modal'), 'pointerdown', (e) => { if (e.target.id === 'modal') g.panels.close(); });
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
        if (tr) g.focusPlayer(+tr.dataset.pid);
      });
    }

    setRatio(r) {
      $('ratio').value = Math.round(r * 100);
      $('ratio-val').textContent = Math.round(r * 100) + '%';
      document.querySelectorAll('.ratio-presets button').forEach((b) => b.classList.toggle('on', +b.dataset.r === Math.round(r * 100)));
    }

    setMode(mode) {
      if (this.cards) for (const [k, c] of Object.entries(this.cards)) c.el.classList.toggle('active', k === mode);
      const hint = $('mode-hint');
      if (!mode) { hint.classList.add('hidden'); return; }
      const nuke = !!C.NUKES[mode], unit = !!C.UNITS[mode];
      const d = nuke ? C.NUKES[mode] : unit ? C.UNITS[mode] : C.BUILD[mode];
      hint.innerHTML = nuke ? `${d.e} ZIEL FÜR ${d.name.toUpperCase()} WÄHLEN · Rechtsklick/Esc = Abbruch`
        : unit ? `🎖️ ${d.name.toUpperCase()} AUFSTELLEN · Klick auf eigenes Land · nutzt ${Math.round(this.game.ratio * 100)}% deiner Truppen · Esc = Abbruch`
        : `${d.e} ${d.name.toUpperCase()} PLATZIEREN · grüner Punkt = gültig · Shift = mehrfach · Esc = Abbruch`;
      hint.classList.toggle('nuke', nuke);
      hint.classList.remove('hidden');
    }

    // ---------------------------------------------------------------- per-frame-ish refresh
    update() {
      const g = this.game, sim = g.sim, me = g.me;
      // resources
      for (const [k, o] of Object.entries(this.resEls)) {
        const v = have(me, k), r = me.rates[k] * 10;
        o.v.textContent = fmt(v);
        o.r.textContent = signed(r) + '/s';
        o.r.className = 'rr' + (r < -0.001 ? ' neg' : r < 0.05 ? ' zero' : '');
        o.el.classList.toggle('empty', v < 1 && k !== 'gold');
      }
      // troops & modifiers
      const max = sim.maxTroops(me);
      $('troops').textContent = fmt(me.troops);
      $('troops-max').textContent = fmt(max);
      $('troop-rate').textContent = '+' + fmt(sim.troopRate(me) * 10) + '/s';
      $('troop-bar').style.width = Math.min(100, (me.troops / max) * 100) + '%';
      $('ratio-troops').textContent = '→ ' + fmt(me.troops * g.ratio) + ' Truppen';
      const fs = $('food-state');
      fs.textContent = me.fed ? '🍖 Versorgt +15%' : '💀 HUNGER −30%';
      fs.className = 'chip ' + (me.fed ? 'good' : 'bad');
      const mods = [];
      if (me.counts.barracks) mods.push(`⛺ +${Math.min(5, me.counts.barracks) * 12}%`);
      if (me.counts.wonder) mods.push('🏛️ Wunder');
      if (sim.has(me, 'empire')) mods.push('👑 +20%');
      const mh = mods.map(m => `<span class="chip">${m}</span>`).join('');
      if (mh !== this._modsHtml) { $('mod-chips').innerHTML = mh; this._modsHtml = mh; }

      // dock cards
      const myUnits = sim.unitsOf(me.id);
      for (const { k, d, nuke, unit } of this._dockItems()) {
        const c = this.cards[k];
        if (!c) continue;
        const cost = nuke || unit ? d.cost : sim.costOf(me, k);
        let why = '';
        if (d.tech && !sim.has(me, d.tech)) why = `🔒 ${C.TECH[d.tech].e} ${C.TECH[d.tech].name}`;
        else if (!nuke && !unit && d.max && me.built[k] >= d.max) why = '✔ Bereits gebaut';
        else if (nuke && !me.counts.silo) why = '🚀 Silo nötig';
        else if (unit && myUnits.length >= C.MAX_UNITS) why = `Max. ${C.MAX_UNITS} Armeen`;
        const html = costHtml(cost, me) + (unit ? `<span class="cost">⚔️${fmt(me.troops * g.ratio)}</span>` : '');
        if (c._cost !== html) { c.cc.innerHTML = html; c._cost = html; }
        c.n.textContent = nuke ? '' : unit ? (myUnits.filter(u => u.kind === k).length || '') : (me.built[k] || '');
        c.lock.textContent = why; c.lock.classList.toggle('hidden', !why);
        c.why.textContent = why || (sim.canAfford(me, cost) ? '' : 'Ressourcen fehlen');
        c.el.classList.toggle('poor', !!why || !sim.canAfford(me, cost));
      }

      // fronts
      const fronts = [];
      for (const a of sim.attacks) {
        if (a.attacker === me.id) fronts.push(`<span class="front">⚔️ ${a.target ? sim.players[a.target].emblem + ' ' + esc(sim.players[a.target].name) : '🌲 Wildnis'} · ${fmt(a.troops)}</span>`);
        else if (a.target === me.id) fronts.push(`<span class="front in">🛡️ ${sim.players[a.attacker].emblem} ${esc(sim.players[a.attacker].name)} · ${fmt(a.troops)}</span>`);
      }
      for (const b of sim.boats) if (b.owner === me.id) fronts.push(`<span class="front">⛵ ${fmt(b.troops)}</span>`);
      const myShips = sim.tradeShips.filter(s => s.owner === me.id).length;
      if (myShips) fronts.push(`<span class="front gold">🚢 ${myShips} Handel</span>`);
      for (const n of sim.nukes) if (sim.owner[n.tile] === me.id && n.owner !== me.id) fronts.push(`<span class="front nuke">${C.NUKES[n.kind].e} INCOMING ${Math.max(0, Math.ceil((n.eta - sim.tick) / 10))}s</span>`);
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
        const tag = me.allies.has(p.id) ? ' 🤝' : sim.attacks.some(a => a.attacker === p.id && a.target === me.id) ? ' 🔥' : '';
        const medal = rank <= 3 ? `<span class="medal">${['🥇', '🥈', '🥉'][rank - 1]}</span>` : rank;
        html += `<tr class="${cls}" data-pid="${p.id}"><td>${medal}</td><td class="nm"><span class="dot" style="background:${rgba(p.color, 1)};color:${rgba(p.color, 1)}"></span>${p.emblem} ${esc(p.name)}${tag}</td><td>${fmt(p.troops)}</td><td>${((p.tiles / land) * 100).toFixed(1)}%</td></tr>`;
      }
      if (html !== this._boardHtml) { $('board-body').innerHTML = html; this._boardHtml = html; }

      // share bar
      const segs = ps.filter((p) => p.alive && p.tiles > 0).slice(0, 12);
      let sh = '';
      for (const p of segs) sh += `<div style="width:${(p.tiles / land) * 100}%;background:${rgba(p.color, 1)}" title="${esc(p.name)}"></div>`;
      if (sh !== this._shareHtml) { $('sharefill').innerHTML = sh; this._shareHtml = sh; }
      $('winmark').style.left = C.WIN_SHARE * 100 + '%';

      // clock, daytime & spawn
      const secs = Math.max(0, Math.floor((sim.tick - C.SPAWN_TICKS) / 10));
      $('clock').textContent = String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');
      const night = g.renderer.atmo.night;
      $('daytime').textContent = !g.settings.daynight ? '☀️' : night > 0.6 ? '🌙' : night > 0.05 ? '🌆' : g.renderer.atmo.dusk(sim.tick) > 0.3 ? '🌅' : '☀️';
      const spawning = sim.phase === 'spawn';
      $('spawn-banner').classList.toggle('hidden', !spawning);
      if (spawning) $('spawn-timer').textContent = Math.ceil((C.SPAWN_TICKS - sim.tick) / 10);

      // rail badges
      const ready = Object.keys(C.TECH).filter(k => sim.techState(me, k) === 'ready').length;
      $('badge-research').textContent = ready; $('badge-research').classList.toggle('hidden', !ready);
      const reqs = sim.allyRequests.filter(r => r.to === me.id).length;
      $('badge-diplo').textContent = reqs; $('badge-diplo').classList.toggle('hidden', !reqs);

      // ally request toasts lifetime
      for (const [from, t] of this.toasts) {
        const r = sim.allyRequests.find((x) => x.from === from && x.to === me.id);
        if (!r) { t.remove(); this.toasts.delete(from); continue; }
        t.querySelector('.t-bar').style.width = Math.max(0, ((r.expires - sim.tick) / 200) * 100) + '%';
      }
      this.renderSel();
      g.panels.refresh();
    }

    // ---------------------------------------------------------------- selected armies
    renderSel() {
      const g = this.game, bar = $('selbar');
      const units = [...g.sel].map(id => g.myUnit(id)).filter(Boolean);
      if (!units.length) { bar.classList.add('hidden'); bar.innerHTML = ''; this._selHtml = ''; return; }
      const by = {};
      for (const u of units) by[u.kind] = (by[u.kind] || 0) + 1;
      const total = units.reduce((a, u) => a + u.str, 0);
      const fighting = units.some(u => u.fight), moving = units.some(u => u.path);
      const html = `<div class="sel-l"><span class="sel-k">🎖️ ${units.length} ${units.length === 1 ? 'ARMEE' : 'ARMEEN'}</span>
          ${Object.entries(by).map(([k, n]) => `<span class="chip">${C.UNITS[k].e} ${n}× ${C.UNITS[k].name}</span>`).join('')}
          <span class="chip">⚔️ ${fmt(total)}</span>${fighting ? '<span class="chip bad">💥 IM GEFECHT</span>' : moving ? '<span class="chip good">🚶 MARSCHIERT</span>' : '<span class="chip">⏸️ BEREIT</span>'}</div>
        <div class="sel-hint">Klick auf Karte = Marschbefehl (erobert unterwegs) · Shift+Ziehen = Auswahl · Strg+A = alle</div>
        <div class="sel-b"><button class="mb" data-s="stop">🛑 Stopp</button><button class="mb sell" data-s="disband">🏳️ Auflösen</button><button class="mb" data-s="clear">✖</button></div>`;
      if (html !== this._selHtml) {
        bar.innerHTML = html; this._selHtml = html;
        bar.querySelectorAll('[data-s]').forEach(b => b.addEventListener('pointerdown', (e) => {
          e.preventDefault(); g.audio.play('click');
          ({ stop: () => g.stopSel(), disband: () => g.disbandSel(), clear: () => g.clearSel() })[b.dataset.s]();
        }));
      }
      bar.classList.remove('hidden');
    }

    feed(msg, cls = '', ttl = 7000) {
      const el = document.createElement('div');
      el.className = 'feed-item ' + cls;
      el.innerHTML = msg;
      this.feedEl.prepend(el);
      while (this.feedEl.children.length > 7) this.feedEl.lastChild.remove();
      setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 700); }, ttl);
    }

    /** Big cinematic banner for world events, research, wonders. */
    banner(emoji, title, sub, cls = '') {
      const b = $('banner');
      b.className = 'show ' + cls;
      b.innerHTML = `<div class="bn-e">${emoji}</div><div class="bn-t">${esc(title)}</div><div class="bn-s">${sub}</div>`;
      clearTimeout(this._bt);
      this._bt = setTimeout(() => { b.className = 'hide ' + cls; }, 4800);
    }

    allyToast(from) {
      if (this.toasts.has(from)) return;
      const g = this.game, p = g.sim.players[from];
      const t = document.createElement('div');
      t.className = 'toast glass';
      t.innerHTML = `<div class="t-title">🤝 <span style="color:${rgba(p.color, 1)}">${p.emblem} ${esc(p.name)}</span> bietet ein Bündnis an.</div>
        <div class="t-btns"><button class="tb-btn" data-a="1">✅ Annehmen</button><button class="tb-btn" data-a="0">❌ Ablehnen</button></div><div class="t-bar"></div>`;
      t.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        g.send({ type: 'allyReply', target: from, accept: b.dataset.a === '1' });
        t.remove(); this.toasts.delete(from);
      }));
      this.toastsEl.appendChild(t);
      this.toasts.set(from, t);
    }

    achievement(e, title, sub) {
      const t = document.createElement('div');
      t.className = 'achv glass';
      t.innerHTML = `<div class="a-e">${e}</div><div><div class="a-k">🏅 ERFOLG FREIGESCHALTET</div><div class="a-t">${esc(title)}</div><div class="a-s">${esc(sub)}</div></div>`;
      document.getElementById('hud').appendChild(t);
      setTimeout(() => t.classList.add('out'), 4200);
      setTimeout(() => t.remove(), 5000);
    }

    // ---------------------------------------------------------------- tooltip
    tooltip(sx, sy, tile, unit) {
      const g = this.game, sim = g.sim;
      if (tile < 0 || this.radialOpen) { this.tip.classList.add('hidden'); return; }
      const o = sim.owner[tile], ter = C.TERRAIN[sim.terrain[tile]];
      let html;
      if (unit) {
        const p = sim.players[unit.owner], d = C.UNITS[unit.kind];
        const tag = unit.owner === g.me.id ? '<span class="tag me">DEINE</span>' : g.me.allies.has(unit.owner) ? '<span class="tag ally">🤝</span>' : '<span class="tag foe">⚔️ FEIND</span>';
        html = `<div class="tt-name">${d.e} ${d.name}${tag}</div>
          <div class="tt-row">${p.emblem} Nation <b>${esc(p.name)}</b></div>
          <div class="tt-row">⚔️ Stärke <b>${fmt(unit.str)} / ${fmt(unit.max)}</b></div>
          <div class="tt-row">💪 Angriff · Abwehr <b>${d.atk} · ${d.def}</b></div>
          <div class="tt-row">📍 Status <b>${unit.fight ? '💥 Gefecht' : unit.path ? '🚶 Marsch' : '⏸️ Bereit'}</b></div>`;
      } else if (o) {
        const p = sim.players[o];
        const tag = o === g.me.id ? '<span class="tag me">DU</span>' : g.me.allies.has(o) ? '<span class="tag ally">🤝 VERBÜNDET</span>' : '<span class="tag foe">⚔️ FEIND</span>';
        html = `<div class="tt-name">${p.emblem} ${esc(p.name)}${tag}</div>
          <div class="tt-row">⚔️ Truppen <b>${fmt(p.troops)}</b></div>
          <div class="tt-row">🗺️ Land <b>${((p.tiles / sim.map.landCount) * 100).toFixed(2)}%</b></div>
          <div class="tt-row">💰 Gold <b>${fmt(p.gold)}</b></div>
          <div class="tt-row">🧪 Techs <b>${p.tech.size}/${Object.keys(C.TECH).length}</b></div>
          <div class="tt-row">⛰️ Gelände <b>${ter.name}</b></div>`;
      } else {
        html = `<div class="tt-name">${ter.water ? '🌊 ' + ter.name : '🌲 Wildnis'}</div><div class="tt-row">${ter.water ? 'Ozean' : 'Gelände'} <b>${ter.name}</b></div>`;
        if (!ter.water) html += `<div class="tt-row">Eroberungskosten <b>×${ter.cost}</b></div>`;
      }
      const s = sim.structAt.get(tile);
      if (s) {
        const d = C.BUILD[s.kind];
        const st = s.done > sim.tick ? `🏗️ ${Math.ceil((s.done - sim.tick) / 10)}s` : s.off > sim.tick ? '⚡ EMP' : '✔ aktiv';
        html += `<div class="tt-sep"></div><div class="tt-row">${d.e} ${d.name} <b>${st}</b></div>`;
      }
      const dep = sim.depAt.get(tile);
      if (dep) {
        const D = C.DEPOSITS[dep.kind];
        const per = D.yield * dep.rich * 10 * (s && (s.kind === 'mine' || s.kind === 'derrick') ? 4 : 1);
        html += `<div class="tt-sep"></div><div class="tt-row">${D.e} ${D.name} <b>${'⭐'.repeat(dep.rich)}</b></div><div class="tt-row">Ertrag <b>${fmt(per)} ${D.res === 'gold' ? '💰' : C.RES[D.res].e}/s</b></div>`;
        if (dep.boost > sim.tick) html += `<div class="tt-row" style="color:#ffd75a">💰 Goldrausch ×3 <b>${Math.ceil((dep.boost - sim.tick) / 10)}s</b></div>`;
      }
      const crate = sim.crates.find(c => c.tile === tile);
      if (crate) html += `<div class="tt-sep"></div><div class="tt-row">📦 Versorgungskiste <b>${Object.entries(crate.loot).map(([k, v]) => resE(k) + fmt(v)).join(' ')}</b></div>`;
      if (sim.rad[tile] > sim.tick) html += `<div class="tt-row" style="color:#b6ff4d">☢️ Verstrahlt ×4 <b>${Math.ceil((sim.rad[tile] - sim.tick) / 10)}s</b></div>`;
      if (html !== this._tipHtml) { this.tip.innerHTML = html; this._tipHtml = html; }
      this.tip.classList.remove('hidden');
      const w = this.tip.offsetWidth, h = this.tip.offsetHeight;
      let x = sx + 18, y = sy + 18;
      if (x + w > innerWidth - 8) x = sx - w - 14;
      if (y + h > innerHeight - 8) y = sy - h - 14;
      this.tip.style.left = x + 'px'; this.tip.style.top = y + 'px';
    }

    // ---------------------------------------------------------------- radial command wheel
    openRadial(sx, sy, tile) {
      const g = this.game, sim = g.sim, me = g.me;
      if (tile < 0 || sim.phase !== 'play' || !me.alive) return;
      const o = sim.owner[tile], land = sim.isLand(tile);
      const items = [];
      if (o === me.id) {
        for (const k of RADIAL_PREF) {
          if (items.length >= 7) break;
          const d = C.BUILD[k];
          if (d.tech && !sim.has(me, d.tech)) continue;
          if (d.max && me.built[k] >= d.max) continue;
          const t = sim.canBuildAt(me, k, tile);
          if (t < 0) continue;
          items.push({ icon: d.e, label: d.name, off: !sim.canAfford(me, sim.costOf(me, k)), fn: () => g.send({ type: 'build', kind: k, tile }) });
        }
      } else if (land) {
        const ally = me.allies.has(o);
        items.push({ icon: '⚔️', label: 'Angriff', off: ally, fn: () => g.attack(tile) });
        items.push({ icon: '⛵', label: 'Boot', off: ally, fn: () => g.send({ type: 'boat', tile, ratio: g.ratio }) });
        if (o) {
          items.push(ally
            ? { icon: '💔', label: 'Brechen', fn: () => g.send({ type: 'unally', target: o }) }
            : { icon: '🤝', label: 'Bündnis', fn: () => g.send({ type: 'ally', target: o }) });
          items.push({ icon: '🔍', label: 'Info', fn: () => g.panels.open('diplomacy') });
        }
      }
      if (me.counts.silo) {
        for (const [k, d] of Object.entries(C.NUKES)) {
          if (!sim.has(me, d.tech)) continue;
          items.push({ icon: d.e, label: d.short, off: !sim.canAfford(me, d.cost), fn: () => g.send({ type: 'nuke', kind: k, tile }) });
        }
      }
      if (!items.length) return;
      const title = o ? sim.players[o].emblem + '<br>' + esc(sim.players[o].name) : land ? '🌲<br>Wildnis' : '🌊<br>Ozean';
      const R = items.length > 6 ? 92 : 80;
      let html = `<div class="r-center">${title}</div>`;
      items.forEach((it, i) => {
        const a = -Math.PI / 2 + (i / items.length) * Math.PI * 2;
        html += `<div class="r-item${it.off ? ' off' : ''}" data-i="${i}" style="left:${Math.cos(a) * R}px;top:${Math.sin(a) * R}px;animation-delay:${i * 18}ms"><span class="ri">${it.icon}</span><span>${it.label}</span></div>`;
      });
      const r = this.radial;
      r.innerHTML = html;
      r.style.left = Math.max(130, Math.min(innerWidth - 130, sx)) + 'px';
      r.style.top = Math.max(130, Math.min(innerHeight - 130, sy)) + 'px';
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

    // ---------------------------------------------------------------- end screen
    showEnd(win, emoji, title, sub) {
      const g = this.game, me = g.me, sim = g.sim;
      $('end-emoji').textContent = emoji;
      $('end-title').textContent = title;
      $('end-title').className = 'end-title ' + (win ? 'win' : 'lose');
      $('end-sub').textContent = sub;
      const t = Math.floor((sim.tick - C.SPAWN_TICKS) / 10);
      $('end-stats').innerHTML = `
        <div><b>⏱️ ${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}</b><span>SPIELZEIT</span></div>
        <div><b>🗺️ ${((me.stats.peak / sim.map.landCount) * 100).toFixed(1)}%</b><span>MAX. LAND</span></div>
        <div><b>⚔️ ${fmt(me.stats.conquered)}</b><span>FELDER EROBERT</span></div>
        <div><b>💰 ${fmt(me.stats.goldEarned)}</b><span>GOLD VERDIENT</span></div>
        <div><b>🧪 ${me.tech.size}</b><span>TECHNOLOGIEN</span></div>
        <div><b>☢️ ${me.stats.nukes}</b><span>RAKETENSTARTS</span></div>`;
      $('end').classList.remove('hidden');
    }
  }

  BW.UI = UI;
})(globalThis.BW = globalThis.BW || {});
