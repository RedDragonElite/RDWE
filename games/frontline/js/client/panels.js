/* RDE // FRONTLINE — modal panels: research tree, stock market, diplomacy, statistics, settings */
(function (BW) {
  'use strict';
  const C = BW.C, fmt = BW.fmt, rgba = BW.rgba, esc = BW.esc, costHtml = BW.costHtml;
  const $ = (id) => document.getElementById(id);

  const TITLES = {
    research: '🧪 Forschung', market: '🏪 Börse', diplomacy: '🤝 Diplomatie', stats: '📊 Statistik', settings: '⚙️ Optionen',
  };

  class Panels {
    constructor(game) {
      this.game = game;
      this.current = null;
      this._t = 0;
      // event delegation via pointerdown: content may re-render between press and release
      $('modal-body').onpointerdown = (e) => {
        if (!this.game.running) return;
        const b = e.target.closest('[data-act]');
        if (!b || b.classList.contains('off')) return;
        e.preventDefault();
        this.game.audio.play('click');
        this.act(b.dataset.act, b.dataset);
      };
      $('modal-body').onchange = (e) => {
        if (!this.game.running) return;
        const t = e.target;
        if (t.dataset.set) { this.game.setSetting(t.dataset.set, t.type === 'checkbox' ? t.checked : +t.value); }
      };
      $('modal-body').oninput = (e) => {
        if (!this.game.running) return;
        if (e.target.dataset.set === 'volume') this.game.setSetting('volume', +e.target.value);
      };
      $('modal-body').onpointermove = (e) => this._chartHover(e);
    }

    open(name) {
      this.current = name;
      $('modal-title').textContent = TITLES[name];
      $('modal').classList.remove('hidden');
      $('modal').dataset.panel = name;
      document.querySelectorAll('.rail-btn').forEach(b => b.classList.toggle('on', b.dataset.panel === name));
      this._html = '';
      this.refresh(true);
    }
    close() {
      this.current = null;
      $('modal').classList.add('hidden');
      document.querySelectorAll('.rail-btn').forEach(b => b.classList.remove('on'));
    }
    toggle(name) { if (this.current === name) this.close(); else this.open(name); }

    refresh(force) {
      if (!this.current) return;
      const now = performance.now();
      if (!force && now - this._t < 400) return;
      this._t = now;
      const html = this['_' + this.current]();
      if (html !== this._html) {
        $('modal-body').innerHTML = html;
        this._html = html;
        if (this.current === 'research') this._drawTreeLines();
        if (this.current === 'stats' && this._lastMove) this._chartHover(this._lastMove);
      }
    }

    act(a, d) {
      const g = this.game;
      switch (a) {
        case 'research': g.send({ type: 'research', tech: d.k }); break;
        case 'buy': g.send({ type: 'trade', res: d.k, qty: +d.q, side: 'buy' }); break;
        case 'sell': g.send({ type: 'trade', res: d.k, qty: d.q === 'all' ? Math.floor(g.me.res[d.k]) : +d.q, side: 'sell' }); break;
        case 'ally': g.send({ type: 'ally', target: +d.p }); break;
        case 'unally': g.send({ type: 'unally', target: +d.p }); break;
        case 'accept': g.send({ type: 'allyReply', target: +d.p, accept: true }); break;
        case 'decline': g.send({ type: 'allyReply', target: +d.p, accept: false }); break;
        case 'focus': g.focusPlayer(+d.p); this.close(); break;
        case 'menu': this.close(); BW.menu.back(); break;
      }
      setTimeout(() => this.refresh(true), 120);
    }

    // ------------------------------------------------------------ research tree
    _research() {
      const g = this.game, sim = g.sim, me = g.me;
      const tiers = [1, 2, 3, 4];
      let h = `<div class="pn-head">Verfügbar: <span class="cost">🧪 ${fmt(me.res.sci)}</span> <span class="muted">(+${fmt(me.rates.sci * 10)}/s · 🔬 Labore beschleunigen)</span></div><div class="tree" id="tree"><svg class="tree-lines" id="tree-lines"></svg>`;
      for (const t of tiers) {
        h += `<div class="tier"><div class="tier-h">STUFE ${['I', 'II', 'III', 'IV'][t - 1]}</div>`;
        for (const [k, d] of Object.entries(C.TECH)) {
          if (d.tier !== t) continue;
          const st = sim.techState(me, k);
          const reqTxt = d.req.length ? d.req.map(r => C.TECH[r].e).join(' ') : '';
          h += `<div class="tnode ${st}" id="tn-${k}" ${st === 'ready' ? `data-act="research" data-k="${k}"` : ''}>
            <div class="tn-e">${d.e}</div>
            <div class="tn-b"><div class="tn-n">${d.name}</div><div class="tn-d">${d.desc}</div>
            <div class="tn-c">${st === 'done' ? '<span class="cost ok">✅ Erforscht</span>' : costHtml(d.cost, me)}${st === 'locked' ? `<span class="muted"> 🔒 ${reqTxt}</span>` : ''}</div></div>
          </div>`;
        }
        h += '</div>';
      }
      return h + '</div>';
    }
    _drawTreeLines() {
      const tree = $('tree'), svg = $('tree-lines');
      if (!tree || !svg) return;
      // layout offsets (immune to the modal's open animation transform)
      const box = (el) => {
        let x = 0, y = 0; const w = el.offsetWidth, h = el.offsetHeight;
        while (el && el !== tree) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
        return { left: x, top: y, right: x + w, height: h };
      };
      svg.setAttribute('width', tree.scrollWidth); svg.setAttribute('height', tree.scrollHeight);
      let paths = '';
      for (const [k, d] of Object.entries(C.TECH)) {
        const b = box($('tn-' + k));
        for (const r of d.req) {
          const a = box($('tn-' + r));
          const x1 = a.right, y1 = a.top + a.height / 2, x2 = b.left, y2 = b.top + b.height / 2;
          const done = this.game.me.tech.has(r);
          paths += `<path d="M${x1},${y1} C${x1 + 30},${y1} ${x2 - 30},${y2} ${x2},${y2}" class="${done ? 'lit' : ''}"/>`;
        }
      }
      svg.innerHTML = paths;
    }

    // ------------------------------------------------------------ stock market
    _spark(hist, w = 120, h = 30) {
      const min = Math.min(...hist), max = Math.max(...hist), rng = max - min || 1;
      const pts = hist.map((v, i) => `${(i / Math.max(1, hist.length - 1)) * w},${h - 2 - ((v - min) / rng) * (h - 4)}`).join(' ');
      const up = hist[hist.length - 1] >= hist[0];
      return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" class="${up ? 'up' : 'down'}"/></svg>`;
    }
    _market() {
      const g = this.game, sim = g.sim, me = g.me, fee = sim.tradeFee(me);
      let h = `<div class="pn-head">Kasse: <span class="cost">💰 ${fmt(me.gold)}</span> · Gebühr <b>${Math.round(fee * 100)}%</b> <span class="muted">${me.counts.market ? '🏪 Markt-Rabatt aktiv' : '🏪 Baue einen Markt für weniger Gebühren'}</span></div>
        <table class="mkt"><thead><tr><th>WARE</th><th>LAGER</th><th>KURS</th><th>TREND</th><th>KAUFEN</th><th>VERKAUFEN</th></tr></thead><tbody>`;
      for (const k of C.TRADE_RES) {
        const r = C.RES[k], p = sim.prices[k], hist = sim.priceHist[k];
        const ref = hist[Math.max(0, hist.length - 10)];
        const ch = ((p - ref) / ref) * 100;
        const buy = p * (1 + fee), sell = p * (1 - fee);
        const cls = ch >= 0 ? 'up' : 'down';
        h += `<tr><td class="ware"><span class="we">${r.e}</span>${r.name}</td><td><b>${fmt(me.res[k])}</b></td>
          <td><b>${buy < 10 ? buy.toFixed(1) : fmt(buy)}</b> / <span class="muted">${sell < 10 ? sell.toFixed(1) : fmt(sell)}</span><div class="pct ${cls}">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(1)}%</div></td>
          <td>${this._spark(hist)}</td>
          <td><button class="mb buy${me.gold < buy * 10 ? ' off' : ''}" data-act="buy" data-k="${k}" data-q="10">+10</button><button class="mb buy${me.gold < buy * 100 ? ' off' : ''}" data-act="buy" data-k="${k}" data-q="100">+100</button></td>
          <td><button class="mb sell${me.res[k] < 10 ? ' off' : ''}" data-act="sell" data-k="${k}" data-q="10">−10</button><button class="mb sell${me.res[k] < 100 ? ' off' : ''}" data-act="sell" data-k="${k}" data-q="100">−100</button><button class="mb sell${me.res[k] < 1 ? ' off' : ''}" data-act="sell" data-k="${k}" data-q="all">ALLES</button></td></tr>`;
      }
      return h + '</tbody></table><div class="muted small">Links Kaufkurs, rechts Verkaufskurs pro Einheit inkl. Gebühr. Große Orders bewegen den Kurs. Preise schwanken alle 2 s.</div>';
    }

    // ------------------------------------------------------------ diplomacy
    _diplomacy() {
      const g = this.game, sim = g.sim, me = g.me, land = sim.map.landCount;
      let h = '';
      const reqs = sim.allyRequests.filter(r => r.to === me.id);
      if (reqs.length) {
        h += '<div class="pn-sub">📨 Offene Bündnisangebote</div>';
        for (const r of reqs) {
          const p = sim.players[r.from];
          h += `<div class="dreq">${p.emblem} <b style="color:${rgba(p.color, 1)}">${esc(p.name)}</b> <span class="muted">${Math.ceil((r.expires - sim.tick) / 10)}s</span>
            <span class="sp"></span><button class="mb buy" data-act="accept" data-p="${p.id}">✅ Annehmen</button><button class="mb sell" data-act="decline" data-p="${p.id}">❌</button></div>`;
        }
      }
      h += `<table class="dip"><thead><tr><th>NATION</th><th>LAND</th><th>⚔️</th><th>🧪</th><th>STATUS</th><th></th></tr></thead><tbody>`;
      const ps = sim.alivePlayers().filter(p => p !== me).sort((a, b) => b.tiles - a.tiles);
      for (const p of ps) {
        const ally = me.allies.has(p.id);
        const hostile = sim.attacks.some(a => (a.attacker === p.id && a.target === me.id));
        const war = sim.attacks.some(a => (a.attacker === me.id && a.target === p.id));
        const border = [...me.border].some(t => { const n = sim.nbrs(t); for (let i = 0; i < n; i++) if (sim.owner[sim._nb[i]] === p.id) return true; return false; });
        const status = ally ? '<span class="tag ally">🤝 Verbündet</span>' : hostile ? '<span class="tag foe">🔥 Greift an</span>' : war ? '<span class="tag foe">⚔️ Krieg</span>' : p.traitorUntil > sim.tick ? '<span class="tag warn">🐍 Verräter</span>' : '<span class="tag">🕊️ Neutral</span>';
        h += `<tr><td class="ware"><span class="dot" style="background:${rgba(p.color, 1)}"></span>${p.emblem} <b>${esc(p.name)}</b>${border ? ' <span class="muted" title="Gemeinsame Grenze">🧱</span>' : ''}</td>
          <td>${((p.tiles / land) * 100).toFixed(1)}%</td><td>${fmt(p.troops)}</td><td>${p.tech.size}</td><td>${status}</td>
          <td class="acts">${ally ? `<button class="mb sell" data-act="unally" data-p="${p.id}">💔 Brechen</button>` : `<button class="mb buy" data-act="ally" data-p="${p.id}">🤝 Anbieten</button>`}<button class="mb" data-act="focus" data-p="${p.id}">🔍</button></td></tr>`;
      }
      return h + '</tbody></table><div class="muted small">Verbündete greifen sich nicht an. Wer ein Bündnis bricht, gilt 60 s als 🐍 Verräter – die KI lehnt dann jedes Angebot ab.</div>';
    }

    // ------------------------------------------------------------ statistics
    _stats() {
      const g = this.game, sim = g.sim, me = g.me;
      const hist = g.history;
      const tiles = `<div class="stat-tiles">
        <div><b>💰 ${fmt(me.stats.goldEarned)}</b><span>Gold verdient</span></div>
        <div><b>⚔️ ${fmt(me.stats.conquered)}</b><span>Felder erobert</span></div>
        <div><b>🏗️ ${sim.structures.filter(s => s.owner === me.id).length}</b><span>Gebäude</span></div>
        <div><b>📦 ${me.stats.crates}</b><span>Kisten</span></div>
        <div><b>📈 ${me.stats.trades}</b><span>Börsen-Deals</span></div>
        <div><b>⛏️ ${sim.deposits.filter(d => sim.owner[d.tile] === me.id).length}</b><span>Lagerstätten</span></div>
      </div>`;
      if (hist.length < 2) return tiles + '<div class="muted">Diagramm erscheint nach den ersten Sekunden…</div>';
      // series: top 6 by current land + me (color follows the nation, as on the map)
      const ids = sim.players.filter(p => p && p.alive).sort((a, b) => b.tiles - a.tiles).slice(0, 6).map(p => p.id);
      if (!ids.includes(me.id)) ids.push(me.id);
      const W = 760, H = 260, L = 40, Rm = 110, Tm = 12, B = 26;
      const peak = Math.max(1, ...hist.flatMap(h => ids.map(id => h.s[id] || 0)));
      const step = [0.5, 1, 2, 5, 10, 20, 25].find(st => peak / st <= 5) || 25;
      const maxV = Math.ceil(peak / step) * step;
      const t0 = hist[0].t, t1 = hist[hist.length - 1].t;
      const X = (t) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - Rm), Y = (v) => Tm + (1 - v / maxV) * (H - Tm - B);
      let svg = `<svg id="chart" viewBox="0 0 ${W} ${H}" width="100%" data-t0="${t0}" data-t1="${t1}">`;
      for (let v = 0; v <= maxV + 1e-9; v += step) {
        const y = Y(v);
        svg += `<line x1="${L}" x2="${W - Rm}" y1="${y}" y2="${y}" class="grid"/><text x="${L - 6}" y="${y + 4}" class="ax" text-anchor="end">${step < 1 ? v.toFixed(1) : v.toFixed(0)}%</text>`;
      }
      const mins = Math.floor((t1 - C.SPAWN_TICKS) / 600);
      for (let m = 0; m <= mins; m++) {
        const t = C.SPAWN_TICKS + m * 600;
        if (t < t0) continue;
        svg += `<text x="${X(t)}" y="${H - 8}" class="ax" text-anchor="middle">${m}:00</text>`;
      }
      const labels = [];
      for (const id of ids) {
        const p = sim.players[id];
        const pts = hist.map(h => `${X(h.t).toFixed(1)},${Y(h.s[id] || 0).toFixed(1)}`).join(' ');
        svg += `<polyline points="${pts}" class="ln${id === me.id ? ' me' : ''}" style="stroke:${rgba(p.color, 1)}"/>`;
        const last = hist[hist.length - 1].s[id] || 0;
        labels.push({ y: Y(last), id, p, v: last });
      }
      // direct labels at line ends, nudged apart
      labels.sort((a, b) => a.y - b.y);
      for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 13) labels[i].y = labels[i - 1].y + 13;
      for (const l of labels) {
        svg += `<circle cx="${W - Rm}" cy="${Y(l.v)}" r="4" style="fill:${rgba(l.p.color, 1)}" class="end"/><text x="${W - Rm + 10}" y="${l.y + 4}" class="lbl">${l.p.emblem} ${esc(l.p.name.slice(0, 11))}</text>`;
      }
      svg += `<line id="xhair" class="xhair hidden" y1="${Tm}" y2="${H - B}"/></svg>`;
      const legend = ids.map(id => { const p = sim.players[id]; return `<span class="lg"><i style="background:${rgba(p.color, 1)}"></i>${p.emblem} ${esc(p.name)}</span>`; }).join('');
      this._chartMeta = { ids, X, t0, t1, L, W, Rm };
      return tiles + `<div class="pn-sub">🗺️ Landanteil über Zeit</div><div class="legend">${legend}</div><div class="chart-wrap">${svg}<div id="chart-tip" class="chart-tip hidden"></div></div>`;
    }
    _chartHover(e) {
      if (this.current !== 'stats') return;
      this._lastMove = { clientX: e.clientX, clientY: e.clientY };
      const svg = $('chart'), tip = $('chart-tip'), xh = $('xhair');
      if (!svg || !this._chartMeta) return;
      const r = svg.getBoundingClientRect();
      const m = this._chartMeta, sx = (e.clientX - r.left) / r.width * m.W;
      if (sx < m.L || sx > m.W - m.Rm || e.clientY < r.top || e.clientY > r.bottom) { tip.classList.add('hidden'); xh.classList.add('hidden'); return; }
      const hist = this.game.history;
      const t = m.t0 + (sx - m.L) / (m.W - m.L - m.Rm) * (m.t1 - m.t0);
      let best = hist[0];
      for (const h of hist) if (Math.abs(h.t - t) < Math.abs(best.t - t)) best = h;
      const x = m.X(best.t);
      xh.setAttribute('x1', x); xh.setAttribute('x2', x); xh.classList.remove('hidden');
      const sim = this.game.sim;
      const secs = Math.max(0, Math.floor((best.t - C.SPAWN_TICKS) / 10));
      const rows = m.ids.map(id => ({ p: sim.players[id], v: best.s[id] || 0 })).sort((a, b) => b.v - a.v)
        .map(o => `<div><i style="background:${rgba(o.p.color, 1)}"></i>${o.p.emblem} ${esc(o.p.name)}<b>${o.v.toFixed(1)}%</b></div>`).join('');
      tip.innerHTML = `<div class="ct-h">⏱️ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</div>${rows}`;
      tip.classList.remove('hidden');
      const wr = svg.parentElement.getBoundingClientRect();
      const px = x / m.W * r.width + (r.left - wr.left);
      tip.style.left = (px > wr.width / 2 ? px - tip.offsetWidth - 12 : px + 12) + 'px';
      tip.style.top = '10px';
    }

    // ------------------------------------------------------------ settings
    _settings() {
      const s = this.game.settings;
      const tg = (k, label) => `<label class="opt"><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}><span>${label}</span></label>`;
      return `<div class="opts">
        ${tg('webgl', '🎨 WebGL2-Grafik (Shader-Wasser, glatte Grenzen) · wirkt ab nächster Runde')}
        ${tg('daynight', '🌙 Tag-Nacht-Zyklus & Stadtlichter')}
        ${tg('clouds', '☁️ Wolken')}
        ${tg('weather', '🌧️ Wetter (Regen, Blitze, Stürme)')}
        ${tg('fx', '✨ Hohe Partikel-Qualität')}
        ${tg('floats', '💬 Schwebende Zahlen')}
        ${tg('shake', '📳 Screenshake')}
        <label class="opt vol"><span>🔊 Lautstärke</span><input type="range" min="0" max="100" data-set="volume" value="${Math.round(s.volume * 100)}"></label>
      </div>
      <div class="pn-sub">⌨️ Tastenkürzel</div>
      <div class="keys">
        ${Object.values(C.BUILD).map(d => `<span><kbd>${d.key}</kbd> ${d.e} ${d.name}</span>`).join('')}
        ${Object.values(C.NUKES).filter(d => d.key).map(d => `<span><kbd>${d.key}</kbd> ${d.e} ${d.name}</span>`).join('')}
        ${Object.values(C.UNITS).map(d => `<span><kbd>${d.key}</kbd> ${d.e} ${d.name}</span>`).join('')}
        <span><kbd>Shift+Ziehen</kbd> Armeen wählen</span><span><kbd>Strg+A</kbd> Alle Armeen</span><span><kbd>Entf</kbd> Auflösen</span>
        <span><kbd>Tab</kbd> Bau-Kategorie</span><span><kbd>1-6</kbd> Angriffsgröße</span><span><kbd>Q/E</kbd> ±5%</span>
        <span><kbd>Leertaste</kbd> Zu dir</span><span><kbd>Pos1</kbd> Ganze Karte</span><span><kbd>P</kbd> Pause</span><span><kbd>M</kbd> Ton</span>
      </div>
      <div class="opts-foot"><button class="mb sell" data-act="menu">🚪 Zurück zum Hauptmenü</button></div>`;
    }
  }

  BW.Panels = Panels;
})(globalThis.BW = globalThis.BW || {});
