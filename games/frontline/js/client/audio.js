/* RDE // FRONTLINE — procedural WebAudio sound (zero asset files) */
(function (BW) {
  'use strict';

  class Audio {
    constructor() { this.ctx = null; this.muted = false; this.master = null; this.last = {}; }
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(this.ctx.destination);
      this._ambient();
    }
    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05);
    }
    _throttle(key, ms) {
      const now = performance.now();
      if (this.last[key] && now - this.last[key] < ms) return true;
      this.last[key] = now; return false;
    }
    _noise(dur) {
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource(); src.buffer = buf; return src;
    }
    _tone(freq, dur, type = 'sine', vol = 0.2, slideTo = 0, delay = 0) {
      const c = this.ctx, t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
    }
    _ambient() {
      // slow filtered wind + low drone: war-room atmosphere
      const c = this.ctx, n = this._noise(4); n.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
      const g = c.createGain(); g.gain.value = 0.05;
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 0.07; lg.gain.value = 180; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
      n.connect(f); f.connect(g); g.connect(this.master); n.start();
      const d = c.createOscillator(), dg = c.createGain();
      d.type = 'sine'; d.frequency.value = 55; dg.gain.value = 0.025;
      d.connect(dg); dg.connect(this.master); d.start();
    }
    play(name) {
      if (!this.ctx || this.muted) return;
      switch (name) {
        case 'click': if (!this._throttle(name, 40)) this._tone(880, 0.06, 'triangle', 0.08); break;
        case 'attack': if (!this._throttle(name, 120)) { this._tone(140, 0.25, 'sawtooth', 0.12, 60); this._tone(70, 0.3, 'sine', 0.2, 40); } break;
        case 'build': this._tone(523, 0.12, 'triangle', 0.12); this._tone(784, 0.2, 'triangle', 0.1, 0, 0.08); break;
        case 'boat': this._tone(196, 0.5, 'sawtooth', 0.06); this._tone(147, 0.6, 'sine', 0.12, 0, 0.1); break;
        case 'fail': if (!this._throttle(name, 200)) this._tone(220, 0.15, 'square', 0.06, 160); break;
        case 'ally': this._tone(659, 0.18, 'sine', 0.12); this._tone(988, 0.3, 'sine', 0.1, 0, 0.12); break;
        case 'betray': this._tone(300, 0.4, 'sawtooth', 0.1, 120); break;
        case 'launch': this._tone(200, 1.6, 'sawtooth', 0.07, 900); break;
        case 'alarm':
          for (let i = 0; i < 4; i++) { this._tone(880, 0.22, 'square', 0.07, 0, i * 0.5); this._tone(660, 0.22, 'square', 0.07, 0, i * 0.5 + 0.25); }
          break;
        case 'intercept': this._tone(1400, 0.15, 'square', 0.08, 300); this._boom(0.35, 0.4); break;
        case 'boom': this._boom(1, 2.6); break;
        case 'bigboom': this._boom(1.4, 4.5); break;
        case 'lost': this._tone(392, 0.4, 'triangle', 0.12); this._tone(311, 0.5, 'triangle', 0.12, 0, 0.3); this._tone(196, 1.2, 'triangle', 0.14, 0, 0.6); break;
        case 'win': [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.6, 'triangle', 0.12, 0, i * 0.15)); break;
        case 'spawn': this._tone(330, 0.2, 'sine', 0.15, 660); break;
        case 'eliminated': if (!this._throttle(name, 300)) this._tone(110, 0.6, 'sawtooth', 0.08, 55); break;
      }
    }
    _boom(vol, dur) {
      const c = this.ctx, t = c.currentTime;
      const n = this._noise(dur);
      const f = c.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(60, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(vol * 0.8, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(f); f.connect(g); g.connect(this.master); n.start(t);
      this._tone(48, dur * 0.8, 'sine', vol * 0.6, 22);
    }
  }

  BW.Audio = Audio;
})(globalThis.BW = globalThis.BW || {});
