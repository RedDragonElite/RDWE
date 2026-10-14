/* RDE // KONTRAKT — boot, game loop, saves, settings, title backdrop, intro, NPC voices */
(function (K) {
  'use strict';
  const U = K.U;
  const $ = (s) => document.querySelector(s);
  const SAVE = 'kontrakt.save.v1', SET = 'kontrakt.settings.v1';
  const DEF = { post: true, fov: true, gore: true, music: true, voice: true, barks: true, weather: true, clouds: true, shake: true, volume: 0.8, musicVol: 0.5, res: 1, difficulty: 1 };

  class Game {
    constructor() {
      let s = {}; try { s = JSON.parse(localStorage.getItem(SET) || '{}'); } catch (e) { /* private mode */ }
      this.settings = { ...DEF, ...s };
      this.view = $('#view'); this.postCv = $('#post'); this.over = $('#over');
      this.audio = new K.Audio();
      this.ui = new K.UI(this);
      this.menus = new K.Menus(this);
      this.input = new K.Input(this);
      this.zoomLevel = 1; this.paused = true; this.waypoint = null;
      this.hurtFlash = 0; this.flash = 0; this.saveT = 0; this.voiceT = 0;
      this.last = performance.now(); this.acc = 0;
      if (this.loadSave()) $('#t-continue').classList.remove('hidden');
      this.titleWorld();
      requestAnimationFrame((t) => this.frame(t));
    }
    loadSave() { try { const s = localStorage.getItem(SAVE); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

    // ------------------------------------------------------------ world lifecycle
    titleWorld() {
      this.title = true;
      this.world = new K.World({ seed: (Math.random() * 1e9) | 0, time: 21.5 * 60 });
      this.world.weather.kind = 'rain'; this.world.weather.rain = 0.7; this.world.weather.cloud = 0.9; this.world.weather.next = 1e9;
      this.setupWorld();
      this.titleT = 0;
      document.body.classList.remove('ingame');
      $('#hud').classList.add('hidden');
    }
    setupWorld() {
      this.renderer = new K.Renderer(this, this.view, this.over);
      this.post = new K.Post(this.view, this.postCv);
      this.ui.reset();
      this.applySettings();
    }
    startPlay() {
      this.title = false;
      $('#title').classList.add('hidden');
      this.menus.closeAll();
      $('#hud').classList.remove('hidden');
      document.body.classList.add('ingame');
      this.menus.sync();
      this.fadeIn();
    }
    newGame() {
      this.world = new K.World({ seed: (Math.random() * 1e9) | 0 });
      this.setupWorld();
      this.waypoint = null;
      this.startPlay();
      setTimeout(() => this.ui.banner('KRÄHENBURG', `${U.weekday(this.world.time)} · Tag 1 · ${U.clock(this.world.time)}`, 'gold', 4), 600);
      const tips = ['WASD bewegen · Maus zielen · Shift sprinten · C ducken', 'E interagieren · F Takedown / Auto · T Verkleidung nehmen', 'P öffnet dein Handy — dort kommen die Aufträge rein.', 'Q halten: Instinkt — sieh Wachen, Ziele und Verstecke durch Wände.'];
      tips.forEach((t, i) => setTimeout(() => this.world && this.ui.feed(t), 4500 + i * 4200));
      setTimeout(() => this.world && this.ui.feed('Vesna: „Willkommen zurück, Agent. Halt dein Handy bereit.“', 'phone'), 3000);
    }
    continueGame() {
      const s = this.loadSave(); if (!s) return this.newGame();
      try { this.world = new K.World({ seed: s.seed, save: s }); }
      catch (e) { console.error(e); this.ui.toast('Spielstand defekt — neues Spiel'); return this.newGame(); }
      this.setupWorld();
      this.startPlay();
      this.ui.banner('WILLKOMMEN ZURÜCK', `${U.weekday(this.world.time)} · Tag ${U.day(this.world.time)} · ${U.clock(this.world.time)}`, 'gold', 3);
    }
    toTitle() {
      if (!this.world.wanted) this.save(true);
      $('#title').classList.remove('hidden');
      if (this.loadSave()) $('#t-continue').classList.remove('hidden');
      this.titleWorld();
      this.menus.sync();
    }
    save(silent) {
      const w = this.world; if (!w || this.title) return false;
      if (!w.player.alive) return false;
      if (w.wanted > 0 && !silent) { this.ui.feed('Speichern nicht möglich, solange du gesucht wirst.', 'bad'); return false; }
      try { localStorage.setItem(SAVE, JSON.stringify(w.serialize())); } catch (e) { this.ui.feed('Speichern fehlgeschlagen.', 'bad'); return false; }
      if (!silent) this.ui.feed('Spiel gespeichert.', 'good');
      return true;
    }
    doSleep(h, prop) {
      const f = $('#fade'); f.classList.add('on');
      this.ui.toast('Z z z …', 1500);
      setTimeout(() => {
        this.world.sleep(h);
        this.world.P.home = this.world.P.home || prop;
        this.renderer.fx.clearDecals();
        this.save(true);
        f.classList.remove('on');
      }, 1300);
    }
    fadeIn() { const f = $('#fade'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 350); }
    applySettings() {
      const s = this.settings;
      try { localStorage.setItem(SET, JSON.stringify(s)); } catch (e) { /* ignore */ }
      this.audio.setVolume(s.volume); this.audio.setMusic(s.music ? s.musicVol : 0);
      const postOn = s.post && this.post && this.post.ok;
      document.body.classList.toggle('nopost', !postOn);
      if (this.renderer) { this.renderer.resScale = s.res; }
      if (this.world) this.world.difficulty = s.difficulty;
    }

    // ------------------------------------------------------------ frame
    frame(ts) {
      requestAnimationFrame((t) => this.frame(t));
      let dt = (ts - this.last) / 1000; this.last = ts;
      if (!(dt > 0)) dt = 0.016; dt = Math.min(dt, 0.1);
      const w = this.world;
      try {
        if (this.title) this.titleTick(dt);
        else if (!this.paused && w) {
          this.acc += dt;
          const inp = this.input.snapshot(w);
          let n = 0;
          while (this.acc >= 1 / 60 && n < 4) {
            w.update(1 / 60, inp);
            inp.pressed = {}; inp.slot = null; inp.wheel = 0;
            this.acc -= 1 / 60; n++;
          }
          if (n >= 4) this.acc = 0;
          this.input.consume();
          this.saveT += dt;
          if (this.saveT > 180 && !w.wanted && w.player.alive && !w.contract) { this.saveT = 0; this.save(true); }
        } else this.input.consume();
        if (w) {
          for (const e of w.events) { this.renderer.onEvent(e); this.audio.onEvent(e, w); this.ui.onEvent(e); this.speak(e); }
          w.events.length = 0;
          this.renderer.render(dt);
          const p = w.player, P = w.P;
          this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.4);
          this.flash = Math.max(0, this.flash - dt * 3);
          if (this.settings.post && this.post.ok) {
            this.post.render({ time: performance.now() / 1000, hurt: this.hurtFlash, low: p.alive ? U.clamp(1 - p.hp / 40, 0, 1) : 1, instinct: P.instinct ? 1 : 0, drunk: P.drunk, flash: this.flash + (w.weather.flash > 0.6 ? 0.2 : 0), bloom: 0.9 + (1 - w.daylight()) * 0.6, grain: 0.045, slow: w.slowmo > 0 ? 1 : 0, tired: P.energy < 12 ? (12 - P.energy) / 12 : 0 });
          }
          if (!this.title) this.ui.update(dt);
          // dynamic resolution: keep the frame rate up on weaker GPUs
          this.ft = (this.ft || 1 / 60) * 0.95 + dt * 0.05;
          this.dynT = (this.dynT || 0) + dt;
          if (this.dynT > 2 && !this.paused) {
            this.dynT = 0;
            const r = this.renderer, max = this.settings.res;
            if (this.ft > 1 / 38 && r.resScale > 0.5) r.resScale = Math.max(0.5, r.resScale - 0.1);
            else if (this.ft < 1 / 56 && r.resScale < max) r.resScale = Math.min(max, r.resScale + 0.05);
          }
          this.audio.update(dt, w, this);
        }
      } catch (err) {
        console.error(err);
        if (!this.errShown) { this.errShown = true; this.ui.feed('Fehler: ' + err.message, 'bad'); }
      }
    }
    titleTick(dt) {
      const w = this.world, r = this.renderer;
      this.titleT += dt;
      w.update(Math.min(dt, 1 / 30), {});
      // slow drone flight over the city
      const t = this.titleT * 0.03;
      const cx = (0.5 + Math.sin(t) * 0.32) * w.W * K.TILE, cy = (0.45 + Math.sin(t * 0.7 + 1) * 0.3) * w.city.W * K.TILE;
      r.cam.x = cx; r.cam.y = cy;
      w.player.x = cx; w.player.y = cy; w.player.inCar = null; w.player.hidden = true;
      this.input.consume();
    }

    // ------------------------------------------------------------ voices
    speak(e) {
      if (e.type !== 'bark' || !this.settings.voice || this.title || !window.speechSynthesis) return;
      if (!['cop', 'guard', 'bodyguard', 'target', 'gang', 'keeper'].includes(e.kind)) return;
      const r = this.renderer, d = Math.hypot(e.x - r.cam.x, e.y - r.cam.y);
      if (d > 700) return;
      const now = performance.now();
      if (now - this.voiceT < 2200) return;
      this.voiceT = now;
      try {
        const u = new SpeechSynthesisUtterance(e.text.replace(/[„“*]/g, ''));
        const vs = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.startsWith('de'));
        if (vs.length) u.voice = vs[(e.id || 0) % vs.length];
        u.lang = 'de-DE'; u.rate = 1.12; u.pitch = e.female ? 1.35 : e.kind === 'cop' ? 0.85 : 0.75;
        u.volume = U.clamp(1 - d / 700, 0.2, 1) * this.settings.volume;
        speechSynthesis.cancel(); speechSynthesis.speak(u);
      } catch (err) { /* TTS unavailable */ }
    }
  }

  window.addEventListener('load', () => { K.game = new Game(); });
})(globalThis.K = globalThis.K || {});
