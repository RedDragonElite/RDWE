/* RDE // FRONTLINE — bootstrap, main menu & game loop */
(function (BW) {
  'use strict';
  const C = BW.C, fmt = BW.fmt, rgba = BW.rgba;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const name = (p) => `<b style="color:${rgba(p.color, 1)}">${p.emblem} ${esc(p.name)}</b>`;
  const resE = (k) => (k === 'gold' ? C.GOLD.e : C.RES[k].e);

  const audio = new BW.Audio();
  const store = {
    get(k, d) { try { const v = localStorage.getItem('rde-frontline-' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('rde-frontline-' + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const DEFAULT_SETTINGS = { daynight: true, clouds: true, weather: true, fx: true, floats: true, shake: true, volume: 0.55 };

  const ACHIEVEMENTS = {
    firstBlood: { e: '🩸', t: 'Erstes Blut', s: 'Erobere Land einer anderen Nation.' },
    builder:    { e: '🏗️', t: 'Baumeister', s: 'Errichte 10 Gebäude.' },
    miner:      { e: '⛏️', t: 'Rohstoffbaron', s: 'Kontrolliere 5 Lagerstätten.' },
    scholar:    { e: '🎓', t: 'Gelehrter', s: 'Erforsche 5 Technologien.' },
    tycoon:     { e: '🤑', t: 'Tycoon', s: 'Besitze 100K Gold.' },
    atomic:     { e: '☢️', t: 'Atommacht', s: 'Starte deine erste Rakete.' },
    admiral:    { e: '⚓', t: 'Admiral', s: 'Gelungene Landung per Boot.' },
    empire10:   { e: '🗺️', t: 'Großreich', s: 'Kontrolliere 10% der Welt.' },
    empire25:   { e: '🌍', t: 'Weltmacht', s: 'Kontrolliere 25% der Welt.' },
    lucky:      { e: '📦', t: 'Glückspilz', s: 'Sichere einen Versorgungsabwurf.' },
    wonder:     { e: '🏛️', t: 'Für die Ewigkeit', s: 'Vollende ein Weltwunder.' },
    survivor:   { e: '🛡️', t: 'Überlebender', s: 'Überstehe einen Atomschlag.' },
  };

  // ======================================================================= GAME
  class Game {
    constructor(cfg) {
      this.audio = audio;
      this.sim = new BW.Sim(cfg);
      this.transport = new BW.Net.LocalTransport();
      this.me = this.sim.players.find((p) => p && p.human && p.clientId === cfg.myClientId);
      this.settings = Object.assign({}, DEFAULT_SETTINGS, store.get('settings', {}));
      audio.setVolume(this.settings.volume);
      this.ratio = store.get('ratio', 0.3);
      this.mode = null;
      this.hoverTile = -1;
      this.arrows = [];
      this.history = [];
      this.achv = new Set(store.get('achievements', []));
      this.speed = 1; this.paused = false;
      this.running = true;
      this.acc = 0;
      this.canvas = $('game');
      $('feed').innerHTML = ''; $('toasts').innerHTML = ''; $('end').classList.add('hidden');
      this.renderer = new BW.Renderer(this.canvas, this);
      this.panels = new BW.Panels(this);
      this.panels.close();
      this.ui = new BW.UI(this);
      this.input = new BW.Input(this, this.canvas);
      this.ui.setRatio(this.ratio);
      this._uiTimer = 0; this._mmTimer = 0;
      this.mm = $('minimap');
      this.mm.width = 240 * 2; this.mm.height = Math.round(240 * 2 * this.sim.H / this.sim.W);
      this.mmctx = this.mm.getContext('2d');
      this._onResize = () => this.renderer.resize();
      window.addEventListener('resize', this._onResize);
      this.last = performance.now();
      this.ui.feed('🐉 Wähle deinen Startpunkt auf freiem Land – nah an 🥇💎🛢️ lohnt sich!', 'gold', 10000);
      requestAnimationFrame((t) => this.frame(t));
    }

    destroy() {
      this.running = false;
      window.removeEventListener('resize', this._onResize);
    }

    // ---------------------------------------------------------------- actions
    send(intent) { intent.pid = this.me.id; this.transport.send(intent); }
    setRatio(r) { this.ratio = Math.max(0.01, Math.min(1, r)); this.ui.setRatio(this.ratio); store.set('ratio', this.ratio); }
    setMode(m) {
      this.mode = m;
      this.ui.setMode(m);
      this.canvas.classList.toggle('mode-build', !!m && !C.NUKES[m]);
      this.canvas.classList.toggle('mode-nuke', !!m && !!C.NUKES[m]);
      if (m) {
        const tab = C.NUKES[m] ? 'weapons' : C.BUILD[m].cat;
        if (this.ui.tab !== tab) this.ui.setTab(tab);
      }
    }
    setSetting(k, v) {
      if (k === 'volume') { v /= 100; audio.setVolume(v); } // slider is 0–100
      this.settings[k] = v;
      store.set('settings', this.settings);
    }
    attack(tile) {
      const sim = this.sim, o = sim.owner[tile];
      this.send({ type: 'attack', tile, ratio: this.ratio });
      const [fx, fy] = this.renderer.labelPos(this.me.id);
      this.arrows.push({ fx, fy, tx: tile % sim.W + 0.5, ty: ((tile / sim.W) | 0) + 0.5, life: 1.2, max: 1.2, color: o ? [255, 80, 90] : [255, 220, 120] });
      audio.play('attack');
    }
    click(tile) {
      const sim = this.sim;
      audio.unlock();
      if (tile < 0) return;
      if (sim.phase === 'spawn') {
        if (!sim.isLand(tile) || (sim.owner[tile] && sim.owner[tile] !== this.me.id)) { audio.play('fail'); return; }
        this.send({ type: 'spawn', tile });
        audio.play('spawn');
        return;
      }
      if (sim.phase !== 'play' || !this.me.alive) return;
      if (this.mode) {
        const m = this.mode;
        if (C.NUKES[m]) this.send({ type: 'nuke', kind: m, tile });
        else this.send({ type: 'build', kind: m, tile });
        if (!this.input.keys.has('shift')) this.setMode(null);
        return;
      }
      if (!sim.isLand(tile)) return;
      const o = sim.owner[tile];
      if (o === this.me.id) return;
      if (this.me.allies.has(o)) { this.ui.feed('🤝 Das ist dein Verbündeter. Rechtsklick → Bündnis brechen.', 'gold'); return; }
      this.attack(tile);
    }
    hover(sx, sy, tile) {
      this.hoverTile = tile;
      this.ui.tooltip(sx, sy, tile);
      const o = tile >= 0 ? this.sim.owner[tile] : 0;
      this.renderer.setHoverOwner(o && this.sim.phase === 'play' ? o : 0);
    }
    focusMe() { this.focusPlayer(this.me.id); }
    focusPlayer(pid) {
      const p = this.sim.players[pid];
      if (!p || !p.tiles) return;
      const [x, y] = this.renderer.labelPos(pid);
      this.renderer.focus(x, y, Math.max(this.renderer.cam.tz, 3));
    }
    togglePause() { if (this.transport.multiplayer) return; this.paused = !this.paused; $('btn-pause').textContent = this.paused ? '▶️' : '⏸️'; }
    toggleMute() { audio.setMuted(!audio.muted); $('btn-mute').textContent = audio.muted ? '🔇' : '🔊'; store.set('muted', audio.muted); }
    cycleSpeed() {
      if (this.transport.multiplayer) return;
      this.speed = this.speed >= 4 ? 1 : this.speed * 2;
      $('btn-speed').textContent = this.speed + '×';
    }
    unlock(key) {
      if (this.achv.has(key)) return;
      this.achv.add(key);
      store.set('achievements', [...this.achv]);
      const a = ACHIEVEMENTS[key];
      this.ui.achievement(a.e, a.t, a.s);
      audio.play('achv');
    }
    float(x, y, text, color, size) { if (this.settings.floats) this.renderer.floatText(x, y, text, color, size); }
    visible(x, y, pad = 30) {
      const v = this.renderer.viewRect();
      return x > v.x0 - pad && x < v.x1 + pad && y > v.y0 - pad && y < v.y1 + pad;
    }

    // ---------------------------------------------------------------- events → feedback
    handleEvents(events) {
      const sim = this.sim, me = this.me, P = (id) => sim.players[id], r = this.renderer, ui = this.ui;
      for (const e of events) {
        switch (e.type) {
          case 'phase':
            ui.banner('⚔️', 'DER KRIEG BEGINNT', 'Erobere Wildnis, sichere Lagerstätten 🥇💎🛢️ und baue dein Imperium.', 'war');
            audio.play('launch');
            this.focusMe();
            break;
          case 'spawn':
            if (e.pid === me.id) { r.pulse(e.x + 0.5, e.y + 0.5, me.color); r.focus(e.x, e.y, Math.max(r.cam.tz, 3.2)); }
            break;
          case 'attack':
            if (e.target === me.id && !e.merged) { ui.feed(`🛡️ ${name(P(e.pid))} greift dich an! (${fmt(e.troops)})`, 'bad'); audio.play('attack'); }
            break;
          case 'clash':
            if (e.pid === me.id || e.target === me.id) ui.feed('💥 Frontalzusammenstoß – Truppen heben sich auf.', '');
            break;
          case 'boat':
            if (e.pid === me.id) { audio.play('boat'); ui.feed('⛵ Transportschiff ausgelaufen.', ''); }
            else if (e.target === me.id) ui.feed(`⛵ ${name(P(e.pid))} schickt eine Flotte zu dir!`, 'bad');
            break;
          case 'boatLand':
            if (e.pid === me.id) {
              if (!e.ok) ui.feed('⛵ Landung abgewehrt – Truppen verloren.', 'bad');
              else if (e.target !== me.id) { this.unlock('admiral'); this.float(e.x + 0.5, e.y, '⚓ Gelandet!', '#7fd3ff'); }
            }
            break;
          case 'fail':
            if (e.pid === me.id) { ui.feed('⚠️ ' + esc(e.msg), 'bad', 4000); audio.play('fail'); }
            break;
          case 'build':
            if (e.pid === me.id) { audio.play('build'); r.pulse(e.x + 0.5, e.y + 0.5, [255, 204, 85]); ui.feed(`🏗️ ${C.BUILD[e.kind].e} ${C.BUILD[e.kind].name} im Bau…`, 'gold', 3000); }
            break;
          case 'built':
            if (e.pid === me.id) {
              audio.play('construct'); r.sparkle(e.x + 0.5, e.y + 0.5);
              this.float(e.x + 0.5, e.y, `${C.BUILD[e.kind].e} fertig!`, '#ffd75a');
              if (sim.structures.filter(s => s.owner === me.id).length >= 10) this.unlock('builder');
            }
            if (e.kind === 'wonder') {
              ui.banner('🏛️', e.pid === me.id ? 'DEIN WELTWUNDER STEHT!' : 'EIN WELTWUNDER IST VOLLENDET', `${name(P(e.pid))} gewinnt, wenn es ${C.WONDER_HOLD / 600} Minuten gehalten wird!`, 'gold');
              audio.play('fanfare');
              if (e.pid === me.id) this.unlock('wonder');
            }
            break;
          case 'wonderStart':
            if (e.pid !== me.id) ui.feed(`🏛️ ${name(P(e.pid))} beginnt den Bau eines Weltwunders!`, 'gold', 9000);
            break;
          case 'captured':
            if (e.from === me.id) ui.feed(`🏚️ ${C.BUILD[e.kind].e} ${C.BUILD[e.kind].name} an ${name(P(e.by))} verloren!`, 'bad');
            else if (e.by === me.id) { ui.feed(`🏴 ${C.BUILD[e.kind].e} ${C.BUILD[e.kind].name} erobert!`, 'good', 4000); this.float(e.x + 0.5, e.y, '🏴 ' + C.BUILD[e.kind].e, '#9dffb0'); }
            if (e.kind === 'wonder') ui.banner('🏛️', 'WELTWUNDER ERBEUTET', `${name(P(e.by))} hat das Wunder übernommen – der Countdown beginnt neu!`, 'gold');
            break;
          case 'depositTaken':
            if (e.pid === me.id) {
              const D = C.DEPOSITS[e.kind];
              this.float(e.x + 0.5, e.y, `+${D.e} ${D.name}`, '#ffe28a', 15);
              audio.play('coin');
              if (sim.deposits.filter(d => sim.owner[d.tile] === me.id).length >= 5) this.unlock('miner');
            } else if (e.from === me.id) ui.feed(`${C.DEPOSITS[e.kind].e} ${C.DEPOSITS[e.kind].name} an ${name(P(e.pid))} verloren!`, 'bad', 4000);
            if (e.from && e.from !== me.id && e.pid === me.id) this.unlock('firstBlood');
            break;
          case 'research':
            if (e.pid === me.id) {
              const t = C.TECH[e.tech];
              ui.banner(t.e, t.name.toUpperCase(), 'Technologie erforscht · ' + t.desc, 'tech');
              audio.play('fanfare');
              if (me.tech.size >= 5) this.unlock('scholar');
            }
            break;
          case 'trade':
            if (e.pid === me.id) {
              audio.play('coin');
              ui.feed(`📈 ${e.side === 'sell' ? 'Verkauft' : 'Gekauft'}: ${e.qty} ${C.RES[e.res].e} für 🪙 ${fmt(e.gold)}`, 'gold', 3000);
            }
            break;
          case 'tradeDone':
            if ((e.pid === me.id || e.partner === me.id) && this.visible(e.x, e.y)) {
              this.float(e.x + 0.5, e.y, '+🪙 ' + fmt(e.pid === me.id ? e.value : e.value * 0.5), '#ffd75a', 14);
            }
            break;
          case 'nukeLaunch': {
            const d = C.NUKES[e.kind];
            if (e.pid === me.id) this.unlock('atomic');
            if (e.victim === me.id) { ui.feed(`${d.e} <b>RAKETENALARM!</b> ${name(P(e.pid))} feuert eine ${d.name} auf dich!`, 'nuke', 9000); audio.play('alarm'); }
            else if (e.pid === me.id) { ui.feed(`🚀 ${d.name} gestartet!`, 'gold'); audio.play('launch'); }
            else ui.feed(`🚀 ${name(P(e.pid))} startet eine ${d.name}${e.victim ? ' auf ' + name(P(e.victim)) : ''}.`, e.kind === 'hydro' ? 'nuke' : '');
            break;
          }
          case 'nukeIntercept':
            r.interceptFx(e.x + 0.5, e.y + 0.5);
            audio.play('intercept');
            if (e.by === me.id) { ui.feed('🛰️ Deine Abwehr hat eine Rakete abgefangen!', 'good'); this.float(e.x + 0.5, e.y, '🛰️ ABGEFANGEN', '#7fd3ff', 18); }
            else if (e.owner === me.id) ui.feed(`🛰️ Deine Rakete wurde von ${name(P(e.by))} abgefangen.`, 'bad');
            break;
          case 'nukeHit': {
            const big = e.kind === 'hydro';
            r.explosion(e.x + 0.5, e.y + 0.5, e.r, big);
            if (!this.settings.shake) r.shake = 0;
            if (this.visible(e.x, e.y, 40)) audio.play(big ? 'bigboom' : 'boom'); else r.shake *= 0.3;
            if (e.victims.includes(me.id)) { ui.feed('☢️ Einschlag auf deinem Gebiet!', 'nuke'); if (me.tiles > 0) setTimeout(() => this.me.alive && this.unlock('survivor'), 3000); }
            break;
          }
          case 'empHit':
            r.empFx(e.x + 0.5, e.y + 0.5, e.r);
            if (!this.settings.shake) r.shake = 0;
            audio.play('emp');
            if (sim.owner[e.y * sim.W + e.x] === me.id) ui.feed(`⚡ EMP-Treffer! ${e.count} Gebäude 60 s lahmgelegt.`, 'nuke');
            break;
          case 'worldEvent': this._worldEvent(e); break;
          case 'crate':
            r.sparkle(e.x + 0.5, e.y + 0.5, [255, 230, 120], 50);
            if (e.pid === me.id) {
              const loot = Object.entries(e.loot).map(([k, v]) => resE(k) + fmt(v)).join(' ');
              ui.feed(`📦 Versorgungskiste gesichert: ${loot}`, 'good', 6000);
              this.float(e.x + 0.5, e.y, '📦 ' + loot, '#ffe28a', 16);
              audio.play('coin'); audio.play('fanfare');
              this.unlock('lucky');
            } else ui.feed(`📦 ${name(P(e.pid))} hat den Versorgungsabwurf geschnappt.`, '', 4000);
            break;
          case 'newDeposit':
            r.sparkle(e.x + 0.5, e.y + 0.5, [150, 230, 255], 30);
            break;
          case 'stormEnd': ui.feed('🌤️ Der Sturm hat sich gelegt.', '', 4000); break;
          case 'ally': {
            if (e.a === me.id || e.b === me.id) {
              const o = P(e.a === me.id ? e.b : e.a);
              ui.feed(`🤝 Bündnis mit ${name(o)} geschlossen.`, 'good'); audio.play('ally');
            }
            break;
          }
          case 'allyDenied':
            if (e.from === me.id) ui.feed(`❌ ${name(P(e.to))} lehnt dein Bündnis ab.`, 'bad', 4000);
            break;
          case 'unally':
            if (e.b === me.id) { ui.feed(`💔 ${name(P(e.a))} hat dich VERRATEN!`, 'bad', 9000); audio.play('betray'); }
            else if (e.a === me.id) ui.feed(`💔 Bündnis mit ${name(P(e.b))} gebrochen.`, '');
            break;
          case 'allyRequest':
            if (e.to === me.id) { ui.allyToast(e.from); audio.play('ally'); }
            break;
          case 'eliminated':
            if (e.pid === me.id) {
              audio.play('lost');
              ui.showEnd(false, '💀', 'NIEDERLAGE', 'Deine Nation ist gefallen.');
            } else { ui.feed(`☠️ ${name(P(e.pid))} wurde ausgelöscht.`, ''); audio.play('eliminated'); }
            break;
          case 'gameOver': {
            const w = P(e.winner);
            const why = { land: 'durch Eroberung', wonder: 'durch das Weltwunder 🏛️', last: 'als letzte Nation', peace: 'durch den Weltfrieden 🕊️' }[e.reason] || '';
            if (e.winner === me.id || me.allies.has(e.winner)) { audio.play('win'); ui.showEnd(true, '🏆', 'SIEG', e.winner === me.id ? `Die Welt gehört dir, Kommandant – ${why}.` : `Sieg im Bündnis mit ${w.name} – ${why}.`); }
            else if (me.alive) { audio.play('lost'); ui.showEnd(false, '🏳️', 'NIEDERLAGE', `${w.emblem} ${w.name} beherrscht die Welt ${why}.`); }
            break;
          }
        }
      }
    }

    _worldEvent(e) {
      const sim = this.sim, r = this.renderer, ui = this.ui, me = this.me, ev = C.EVENTS[e.kind];
      let sub = ev.desc;
      switch (e.kind) {
        case 'meteor':
          e.impacts.forEach((m) => setTimeout(() => { r.meteorFx(m.x + 0.5, m.y + 0.5, m.r); if (this.visible(m.x, m.y)) audio.play('boom'); }, m.delay * 120));
          break;
        case 'volcano':
          r.volcanoFx(e.x + 0.5, e.y + 0.5, e.r);
          if (this.visible(e.x, e.y)) audio.play('bigboom');
          break;
        case 'goldrush':
          sub = `${C.DEPOSITS[e.dep].e} ${C.DEPOSITS[e.dep].name} liefert 90 s den dreifachen Ertrag!${e.pid === me.id ? ' <b>Sie gehört DIR!</b>' : ''}`;
          r.sparkle(e.x + 0.5, e.y + 0.5, [255, 220, 100], 60);
          break;
        case 'plague':
          sub = `${sim.players[e.pid].emblem} ${esc(sim.players[e.pid].name)} verliert ${fmt(e.lost)} Truppen. 🧬 Medizin schützt.`;
          break;
        case 'supply': break;
        case 'storm': audio.play('thunder'); break;
      }
      if (e.kind !== 'storm' && e.kind !== 'plague' && !this.settings.shake) r.shake = 0;
      ui.banner(ev.e, ev.name.toUpperCase(), sub, 'event');
      ui.feed(`${ev.e} <b>${ev.name}</b> – <a class="feed-go" data-x="${e.x}" data-y="${e.y}">📍 ansehen</a>`, 'gold', 9000);
      audio.play('event');
    }

    _achvCheck() {
      const me = this.me, share = me.tiles / this.sim.map.landCount;
      if (share >= 0.1) this.unlock('empire10');
      if (share >= 0.25) this.unlock('empire25');
      if (me.gold >= 100000) this.unlock('tycoon');
    }

    // ---------------------------------------------------------------- loop
    frame(now) {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused) {
        this.acc += dt * 1000 * this.speed;
        let steps = 0;
        while (this.acc >= C.TICK_MS && steps < 8 && this.transport.canStep(this.sim.tick)) {
          const tick = this.sim.tick;
          this.sim.step(this.transport.intentsFor(tick));
          if (this.transport.multiplayer) this.transport.reportHash(tick, this.sim.hash());
          this.renderer.applyChanges(this.sim.changed);
          this.handleEvents(this.sim.events);
          if (this.sim.phase !== 'spawn' && tick % 20 === 0) this._sample();
          this.acc -= C.TICK_MS; steps++;
        }
        if (steps === 8) this.acc = 0;
      }
      this.input.update(dt);
      const alpha = this.paused ? 1 : Math.min(1, this.acc / C.TICK_MS);
      this.renderer.draw(dt, alpha);
      this._uiTimer -= dt; this._mmTimer -= dt;
      if (this._uiTimer <= 0) { this.ui.update(); this._achvCheck(); this._uiTimer = 0.15; }
      if (this._mmTimer <= 0) { this.renderer.drawMinimap(this.mmctx, this.mm.width, this.mm.height); this._mmTimer = 0.25; }
      requestAnimationFrame((t) => this.frame(t));
    }
    _sample() {
      const sim = this.sim, land = sim.map.landCount, s = {};
      for (const p of sim.players) if (p && p.tiles) s[p.id] = (p.tiles / land) * 100;
      this.history.push({ t: sim.tick, s });
      if (this.history.length > 400) this.history = this.history.filter((_, i) => i % 2 === 0); // keep it light
    }
  }

  // feed "ansehen" links
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.feed-go');
    if (a && BW.game) BW.game.renderer.focus(+a.dataset.x, +a.dataset.y, Math.max(BW.game.renderer.cam.tz, 3));
  });

  // ======================================================================= MENU
  const menu = {
    color: store.get('color', C.PALETTE[0]),
    emblem: store.get('emblem', '🐉'),
    init() {
      const sel = (el, obj, val) => {
        el.innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
        el.value = val;
      };
      sel($('m-type'), C.MAP_TYPES, store.get('type', 'continents'));
      sel($('m-size'), C.MAP_SIZES, store.get('size', 'medium'));
      sel($('m-diff'), C.DIFFICULTY, store.get('diff', 'normal'));
      $('m-name').value = store.get('name', 'SerpentsByte');
      $('m-bots').value = store.get('bots', 14); $('m-bots-val').textContent = $('m-bots').value;
      $('m-events').checked = store.get('events', true);
      $('m-seed').value = this.randSeed();
      const sw = $('m-colors');
      sw.innerHTML = C.PALETTE.map((c, i) => `<div class="sw" data-i="${i}" style="background:${rgba(c, 1)};color:${rgba(c, 1)}"></div>`).join('');
      const mark = () => sw.querySelectorAll('.sw').forEach((el) => el.classList.toggle('on', C.PALETTE[+el.dataset.i].join() === this.color.join()));
      sw.addEventListener('click', (e) => { const el = e.target.closest('.sw'); if (!el) return; this.color = C.PALETTE[+el.dataset.i]; mark(); audio.unlock(); audio.play('click'); });
      mark();
      const em = $('m-emblems');
      em.innerHTML = C.EMBLEMS.map(e => `<button class="emb" data-e="${e}">${e}</button>`).join('');
      const markE = () => em.querySelectorAll('.emb').forEach(el => el.classList.toggle('on', el.dataset.e === this.emblem));
      em.addEventListener('click', (e) => { const el = e.target.closest('.emb'); if (!el) return; this.emblem = el.dataset.e; markE(); audio.unlock(); audio.play('click'); });
      markE();
      $('m-bots').addEventListener('input', () => { $('m-bots-val').textContent = $('m-bots').value; });
      $('m-dice').addEventListener('click', () => { $('m-seed').value = this.randSeed(); this.preview(); audio.unlock(); audio.play('click'); });
      $('m-type').addEventListener('change', () => this.preview());
      $('m-seed').addEventListener('change', () => this.preview());
      $('m-play').addEventListener('click', () => this.start());
      $('end-again').addEventListener('click', () => { $('end').classList.add('hidden'); this.back(); });
      $('end-watch').addEventListener('click', () => $('end').classList.add('hidden'));
      audio.muted = store.get('muted', false);
      $('btn-mute').textContent = audio.muted ? '🔇' : '🔊';
      window.addEventListener('resize', () => this.drawPreview());
      this.preview();
      this.animate();
    },
    randSeed() { return Math.floor(Math.random() * 1e6).toString(36).toUpperCase(); },
    seedNum() { const s = $('m-seed').value.trim() || 'RDE'; return /^\d+$/.test(s) ? (+s >>> 0) : BW.hashString(s); },
    preview() {
      clearTimeout(this._pt);
      this._pt = setTimeout(() => {
        const map = BW.MapGen.generate({ seed: this.seedNum(), W: 320, H: 180, type: $('m-type').value });
        const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180;
        const cx = cv.getContext('2d'), img = cx.createImageData(320, 180);
        const col = [[14, 38, 76], [40, 110, 150], [222, 206, 160], [150, 178, 104], [84, 128, 72], [160, 152, 108], [128, 118, 108], [236, 240, 246]];
        for (let i = 0; i < map.N; i++) { const c = col[map.terrain[i]]; img.data.set([c[0], c[1], c[2], 255], i * 4); }
        cx.putImageData(img, 0, 0);
        this.pv = cv;
        this.drawPreview();
      }, 60);
    },
    drawPreview() {
      const bg = $('menu-bg'); if (!this.pv) return;
      bg.width = innerWidth; bg.height = innerHeight;
      const ctx = bg.getContext('2d');
      const s = Math.max(innerWidth / 320, innerHeight / 180);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.pv, (innerWidth - 320 * s) / 2, (innerHeight - 180 * s) / 2, 320 * s, 180 * s);
    },
    animate() {
      const bg = $('menu-bg');
      let t = 0;
      const loop = () => {
        if ($('menu').classList.contains('hidden')) { this._anim = null; return; }
        t += 0.002;
        bg.style.transform = `scale(${1.08 + Math.sin(t) * 0.03}) translate(${Math.sin(t * 0.7) * 1.5}%, ${Math.cos(t * 0.5) * 1}%)`;
        this._anim = requestAnimationFrame(loop);
      };
      loop();
    },
    start() {
      audio.unlock();
      audio.play('launch');
      const size = C.MAP_SIZES[$('m-size').value];
      const nm = ($('m-name').value.trim() || 'Kommandant').slice(0, 18);
      store.set('name', nm); store.set('color', this.color); store.set('type', $('m-type').value); store.set('emblem', this.emblem);
      store.set('size', $('m-size').value); store.set('diff', $('m-diff').value); store.set('bots', +$('m-bots').value);
      store.set('events', $('m-events').checked);
      $('m-play').textContent = '🌍 WELT WIRD ERSCHAFFEN…';
      setTimeout(() => {
        if (BW.game) BW.game.destroy();
        BW.game = new Game({
          seed: this.seedNum(), W: size.W, H: size.H, mapType: $('m-type').value,
          bots: +$('m-bots').value, difficulty: $('m-diff').value, events: $('m-events').checked,
          humans: [{ clientId: 'local', name: nm, color: this.color, emblem: this.emblem }], myClientId: 'local',
        });
        $('menu').classList.add('hidden');
        $('hud').classList.remove('hidden');
        $('m-play').textContent = '⚔️ IN DEN KRIEG ZIEHEN';
      }, 30);
    },
    back() {
      if (BW.game) { BW.game.destroy(); BW.game = null; }
      $('hud').classList.add('hidden');
      $('menu').classList.remove('hidden');
      $('m-seed').value = this.randSeed();
      this.preview(); this.animate();
    },
  };

  menu.init();
  BW.menu = menu;
})(globalThis.BW = globalThis.BW || {});
