/* RDE // FRONTLINE — bootstrap, main menu & game loop */
(function (BW) {
  'use strict';
  const C = BW.C, fmt = BW.fmt, rgba = BW.rgba;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const name = (p) => `<b style="color:${rgba(p.color, 1)}">${esc(p.name)}</b>`;

  const audio = new BW.Audio();
  const store = {
    get(k, d) { try { const v = localStorage.getItem('rde-frontline-' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('rde-frontline-' + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  // ======================================================================= GAME
  class Game {
    constructor(cfg) {
      this.audio = audio;
      this.sim = new BW.Sim(cfg);
      this.transport = new BW.Net.LocalTransport();
      this.me = this.sim.players.find((p) => p && p.human && p.clientId === cfg.myClientId);
      this.ratio = store.get('ratio', 0.3);
      this.mode = null;
      this.hoverTile = -1;
      this.arrows = [];
      this.speed = 1; this.paused = false;
      this.running = true;
      this.acc = 0;
      this.canvas = $('game');
      $('feed').innerHTML = ''; $('toasts').innerHTML = ''; $('end').classList.add('hidden');
      this.renderer = new BW.Renderer(this.canvas, this);
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
      this.ui.feed('Wähle deinen Startpunkt auf freiem Land.', 'gold', 10000);
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
      if (this.me.allies.has(o)) { this.ui.feed('Das ist dein Verbündeter. Rechtsklick → Bündnis brechen.', 'gold'); return; }
      this.attack(tile);
    }
    hover(sx, sy, tile) {
      this.hoverTile = tile;
      this.ui.tooltip(sx, sy, tile);
      const o = tile >= 0 ? this.sim.owner[tile] : 0;
      this.renderer.setHoverOwner(o && this.sim.phase === 'play' ? o : 0);
    }
    focusMe() {
      if (!this.me.tiles) return;
      const [x, y] = this.renderer.labelPos(this.me.id);
      this.renderer.focus(x, y, Math.max(this.renderer.cam.tz, 3));
    }
    togglePause() { if (this.transport.multiplayer) return; this.paused = !this.paused; $('btn-pause').textContent = this.paused ? '▶' : '❚❚'; }
    toggleMute() { audio.setMuted(!audio.muted); $('btn-mute').textContent = audio.muted ? '🔇' : '🔊'; store.set('muted', audio.muted); }
    cycleSpeed() {
      if (this.transport.multiplayer) return;
      this.speed = this.speed >= 4 ? 1 : this.speed * 2;
      $('btn-speed').textContent = this.speed + '×';
    }

    // ---------------------------------------------------------------- events → feedback
    handleEvents(events) {
      const sim = this.sim, me = this.me, P = (id) => sim.players[id], r = this.renderer;
      for (const e of events) {
        switch (e.type) {
          case 'phase':
            this.ui.feed('⚔ <b>DER KRIEG BEGINNT!</b> Klick auf Wildnis oder Feinde zum Angreifen.', 'bad', 9000);
            audio.play('launch');
            this.focusMe();
            break;
          case 'spawn':
            if (e.pid === me.id) { r.pulse(e.x + 0.5, e.y + 0.5, me.color); r.focus(e.x, e.y, Math.max(r.cam.tz, 3.2)); }
            break;
          case 'attack':
            if (e.target === me.id && !e.merged) { this.ui.feed(`🛡 ${name(P(e.pid))} greift dich an! (${fmt(e.troops)})`, 'bad'); audio.play('attack'); }
            break;
          case 'clash':
            if (e.pid === me.id || e.target === me.id) this.ui.feed('💥 Frontalzusammenstoß – Truppen heben sich auf.', '');
            break;
          case 'boat':
            if (e.pid === me.id) { audio.play('boat'); this.ui.feed('⛵ Transportschiff ausgelaufen.', ''); }
            else if (e.target === me.id) this.ui.feed(`⛵ ${name(P(e.pid))} schickt eine Flotte zu dir!`, 'bad');
            break;
          case 'boatLand':
            if (e.pid === me.id && !e.ok) this.ui.feed('⛵ Landung abgewehrt – Truppen verloren.', 'bad');
            break;
          case 'fail':
            if (e.pid === me.id) { this.ui.feed('⚠ ' + esc(e.msg), 'bad', 4000); audio.play('fail'); }
            break;
          case 'build':
            if (e.pid === me.id) { audio.play('build'); r.pulse(e.x + 0.5, e.y + 0.5, [255, 204, 85]); this.ui.feed(`🏗 ${C.BUILD[e.kind].name} gebaut.`, 'gold', 3500); }
            break;
          case 'captured':
            if (e.from === me.id) this.ui.feed(`🏚 ${C.BUILD[e.kind].name} an ${name(P(e.by))} verloren!`, 'bad');
            else if (e.by === me.id) this.ui.feed(`🏴 ${C.BUILD[e.kind].name} erobert!`, 'good', 4000);
            break;
          case 'nukeLaunch': {
            const big = e.kind === 'hydro';
            if (e.victim === me.id) { this.ui.feed(`☢ <b>ATOMALARM!</b> ${name(P(e.pid))} feuert eine ${C.NUKES[e.kind].name} auf dich!`, 'nuke', 9000); audio.play('alarm'); }
            else if (e.pid === me.id) { this.ui.feed(`🚀 ${C.NUKES[e.kind].name} gestartet!`, 'gold'); audio.play('launch'); }
            else this.ui.feed(`🚀 ${name(P(e.pid))} startet eine ${C.NUKES[e.kind].name}${e.victim ? ' auf ' + name(P(e.victim)) : ''}.`, big ? 'nuke' : '');
            break;
          }
          case 'nukeIntercept':
            r.interceptFx(e.x + 0.5, e.y + 0.5);
            audio.play('intercept');
            if (e.by === me.id) this.ui.feed('🛰 Deine Abwehr hat eine Rakete abgefangen!', 'good');
            else if (e.owner === me.id) this.ui.feed(`🛰 Deine Rakete wurde von ${name(P(e.by))} abgefangen.`, 'bad');
            break;
          case 'nukeHit': {
            const big = e.kind === 'hydro';
            r.explosion(e.x + 0.5, e.y + 0.5, e.r, big);
            const v = r.viewRect();
            const visible = e.x > v.x0 - 40 && e.x < v.x1 + 40 && e.y > v.y0 - 40 && e.y < v.y1 + 40;
            if (visible) audio.play(big ? 'bigboom' : 'boom'); else r.shake *= 0.3;
            if (e.victims.includes(me.id)) this.ui.feed('☢ Einschlag auf deinem Gebiet!', 'nuke');
            break;
          }
          case 'ally': {
            if (e.a === me.id || e.b === me.id) {
              const o = P(e.a === me.id ? e.b : e.a);
              this.ui.feed(`🤝 Bündnis mit ${name(o)} geschlossen.`, 'good'); audio.play('ally');
            }
            break;
          }
          case 'allyDenied':
            if (e.from === me.id) this.ui.feed(`✖ ${name(P(e.to))} lehnt dein Bündnis ab.`, 'bad', 4000);
            break;
          case 'unally':
            if (e.b === me.id) { this.ui.feed(`💔 ${name(P(e.a))} hat dich VERRATEN!`, 'bad', 9000); audio.play('betray'); }
            else if (e.a === me.id) this.ui.feed(`💔 Bündnis mit ${name(P(e.b))} gebrochen.`, '');
            break;
          case 'allyRequest':
            if (e.to === me.id) { this.ui.allyToast(e.from); audio.play('ally'); }
            break;
          case 'eliminated':
            if (e.pid === me.id) {
              audio.play('lost');
              this.ui.showEnd(false, 'NIEDERLAGE', 'Deine Nation ist gefallen.');
            } else { this.ui.feed(`☠ ${name(P(e.pid))} wurde ausgelöscht.`, ''); audio.play('eliminated'); }
            break;
          case 'gameOver': {
            const w = P(e.winner);
            if (e.winner === me.id || me.allies.has(e.winner)) { audio.play('win'); this.ui.showEnd(true, 'SIEG', e.winner === me.id ? 'Die Welt gehört dir, Kommandant.' : `Sieg im Bündnis mit ${w.name}.`); }
            else if (me.alive) { audio.play('lost'); this.ui.showEnd(false, 'NIEDERLAGE', `${w.name} beherrscht die Welt.`); }
            break;
          }
        }
      }
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
          this.acc -= C.TICK_MS; steps++;
        }
        if (steps === 8) this.acc = 0;
      }
      this.input.update(dt);
      const alpha = this.paused ? 1 : Math.min(1, this.acc / C.TICK_MS);
      this.renderer.draw(dt, alpha);
      this._uiTimer -= dt; this._mmTimer -= dt;
      if (this._uiTimer <= 0) { this.ui.update(); this._uiTimer = 0.15; }
      if (this._mmTimer <= 0) { this.renderer.drawMinimap(this.mmctx, this.mm.width, this.mm.height); this._mmTimer = 0.25; }
      requestAnimationFrame((t) => this.frame(t));
    }
  }

  // ======================================================================= MENU
  const menu = {
    color: store.get('color', C.PALETTE[0]),
    init() {
      const sel = (el, obj, val) => {
        el.innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
        el.value = val;
      };
      sel($('m-type'), C.MAP_TYPES, store.get('type', 'continents'));
      sel($('m-size'), C.MAP_SIZES, store.get('size', 'medium'));
      sel($('m-diff'), Object.fromEntries(Object.entries(C.DIFFICULTY)), store.get('diff', 'normal'));
      $('m-name').value = store.get('name', 'SerpentsByte');
      $('m-bots').value = store.get('bots', 14); $('m-bots-val').textContent = $('m-bots').value;
      $('m-seed').value = this.randSeed();
      const sw = $('m-colors');
      sw.innerHTML = C.PALETTE.map((c, i) => `<div class="sw" data-i="${i}" style="background:${rgba(c, 1)};color:${rgba(c, 1)}"></div>`).join('');
      const mark = () => sw.querySelectorAll('.sw').forEach((el) => el.classList.toggle('on', C.PALETTE[+el.dataset.i].join() === this.color.join()));
      sw.addEventListener('click', (e) => { const el = e.target.closest('.sw'); if (!el) return; this.color = C.PALETTE[+el.dataset.i]; mark(); audio.unlock(); audio.play('click'); });
      mark();
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
      store.set('name', nm); store.set('color', this.color); store.set('type', $('m-type').value);
      store.set('size', $('m-size').value); store.set('diff', $('m-diff').value); store.set('bots', +$('m-bots').value);
      $('m-play').textContent = 'WELT WIRD ERSCHAFFEN…';
      setTimeout(() => {
        if (BW.game) BW.game.destroy();
        BW.game = new Game({
          seed: this.seedNum(), W: size.W, H: size.H, mapType: $('m-type').value,
          bots: +$('m-bots').value, difficulty: $('m-diff').value,
          humans: [{ clientId: 'local', name: nm, color: this.color }], myClientId: 'local',
        });
        $('menu').classList.add('hidden');
        $('hud').classList.remove('hidden');
        $('m-play').textContent = 'IN DEN KRIEG ZIEHEN';
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
