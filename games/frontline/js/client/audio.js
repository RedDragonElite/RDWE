/* RDE // FRONTLINE — Audio 2.0: procedural SFX with reverb & stereo space + adaptive generative score
 * Zero audio files: everything is synthesised live with the WebAudio API. */
(function (BW) {
  'use strict';

  // D minor world: frequencies for a handful of octaves
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);       // midi → Hz
  const PROG = [                                              // chord roots & voicings (midi), 2 bars each
    { root: 38, pad: [50, 53, 57, 62] },                      // Dm
    { root: 34, pad: [46, 50, 53, 58] },                      // Bb
    { root: 41, pad: [48, 53, 57, 60] },                      // F
    { root: 36, pad: [48, 52, 55, 60] },                      // C
  ];
  const BOSS_PROG = [{ root: 38, pad: [50, 53, 57] }, { root: 39, pad: [51, 55, 58] }, { root: 38, pad: [50, 53, 56] }, { root: 37, pad: [49, 53, 56] }];

  class Music {
    constructor(a) {
      this.a = a; const c = a.ctx;
      this.out = c.createGain(); this.out.gain.value = 0;
      this.out.connect(a.musicBus);
      const mk = (v) => { const g = c.createGain(); g.gain.value = v; g.connect(this.out); return g; };
      this.L = { pad: mk(0.6), bass: mk(0), arp: mk(0), drums: mk(0), boss: mk(0) };
      // arp echo
      this.delay = c.createDelay(1); this.delay.delayTime.value = 0.49;
      const fb = c.createGain(); fb.gain.value = 0.32;
      this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(this.L.arp);
      this.padFilter = c.createBiquadFilter(); this.padFilter.type = 'lowpass'; this.padFilter.frequency.value = 700; this.padFilter.Q.value = 0.7;
      this.padFilter.connect(this.L.pad);
      this.bpm = 88; this.step = 0; this.next = 0; this.intensity = 0; this.boss = false; this.on = false;
    }
    start() {
      if (this.on) return;
      this.on = true;
      const c = this.a.ctx;
      this.next = c.currentTime + 0.1;
      this.out.gain.setTargetAtTime(1, c.currentTime, 1.5);
      this.timer = setInterval(() => this._schedule(), 30);
    }
    stop() { this.on = false; clearInterval(this.timer); this.out.gain.setTargetAtTime(0, this.a.ctx.currentTime, 0.6); }
    /** 0 calm … 1 total war; boss = dragon theme */
    setMood(intensity, boss) {
      const c = this.a.ctx, t = c.currentTime;
      this.intensity += (Math.max(0, Math.min(1, intensity)) - this.intensity) * 0.15;
      this.boss = boss;
      const i = this.intensity, L = this.L;
      L.pad.gain.setTargetAtTime(boss ? 0.25 : 0.55, t, 1.2);
      L.bass.gain.setTargetAtTime(boss ? 0.5 : i > 0.15 ? 0.45 : 0.12, t, 1.2);
      L.arp.gain.setTargetAtTime(boss ? 0.15 : i > 0.35 ? 0.24 * Math.min(1, (i - 0.25) * 2) : 0, t, 1.5);
      L.drums.gain.setTargetAtTime(boss ? 0.9 : i > 0.55 ? 0.75 * Math.min(1, (i - 0.45) * 2.5) : 0, t, 1.0);
      L.boss.gain.setTargetAtTime(boss ? 0.55 : 0, t, 1.0);
      this.padFilter.frequency.setTargetAtTime(500 + i * 1600 + (boss ? 600 : 0), t, 2);
      this.bpm = boss ? 104 : 84 + i * 18;
    }
    _schedule() {
      const c = this.a.ctx;
      while (this.next < c.currentTime + 0.25) { this._play(this.step, this.next); this.next += 60 / this.bpm / 4; this.step++; }
    }
    _play(step, t) {
      const s16 = step % 16, bar = Math.floor(step / 16), prog = this.boss ? BOSS_PROG : PROG;
      const ch = prog[Math.floor(bar / 2) % prog.length];
      const beat = 60 / this.bpm, a = this.a, L = this.L, i = this.intensity;
      // pad: new chord every 2 bars
      if (s16 === 0 && bar % 2 === 0) for (const n of ch.pad) a.voice(NOTE(n), t, beat * 8.5, { type: 'sawtooth', vol: 0.05, attack: 1.2, release: 1.6, detune: 9, dest: this.padFilter });
      // bass
      const bassEvery = this.boss || i > 0.6 ? 2 : 4;
      if (s16 % bassEvery === 0) a.voice(NOTE(ch.root), t, beat * 0.45, { type: 'triangle', vol: 0.32, attack: 0.005, release: 0.2, dest: L.bass, sub: true });
      // arp: chord tones up the octaves
      if (s16 % (i > 0.75 || this.boss ? 1 : 2) === 0) {
        const tones = ch.pad.concat(ch.pad.map(n => n + 12));
        const n = tones[(step * 3 + bar) % tones.length] + 12;
        a.voice(NOTE(n), t, beat * 0.22, { type: 'triangle', vol: 0.06, attack: 0.003, release: 0.12, dest: L.arp, send: this.delay });
      }
      // drums: taiko war ensemble
      if (s16 === 0 || s16 === 8 || (i > 0.8 && s16 === 11)) a.kick(t, 0.8, L.drums);
      if (s16 === 4 || s16 === 12) a.taiko(t, 0.5, L.drums);
      if ((i > 0.7 || this.boss) && s16 % 2 === 1) a.hat(t, 0.12, L.drums);
      if (this.boss && (s16 === 14 || s16 === 15)) a.taiko(t, 0.35, L.drums);
      // boss ostinato + choir
      if (this.boss) {
        const osti = [38, 38, 41, 40, 38, 38, 43, 41];
        if (s16 % 2 === 0) a.voice(NOTE(osti[(s16 / 2) % 8] + 12), t, beat * 0.4, { type: 'sawtooth', vol: 0.08, attack: 0.01, release: 0.15, dest: L.boss, filter: 1400 });
        if (s16 === 0 && bar % 2 === 0) for (const n of ch.pad) a.choir(NOTE(n + 12), t, beat * 8, L.boss);
      }
    }
  }

  class Audio {
    constructor() { this.ctx = null; this.muted = false; this.volume = 0.55; this.musicVol = 0.45; this.musicOn = true; this.last = {}; }

    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : this.volume;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(c.destination);
      // reverb send (generated impulse response: 2.6 s decaying stereo noise)
      this.verb = c.createConvolver();
      const len = c.sampleRate * 2.6, ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      this.verb.buffer = ir;
      this.verbIn = c.createGain(); this.verbIn.gain.value = 0.35;
      this.verbIn.connect(this.verb); this.verb.connect(this.master);
      this.sfx = c.createGain(); this.sfx.connect(this.master); this.sfx.connect(this.verbIn);
      this.musicBus = c.createGain(); this.musicBus.gain.value = this.musicVol;
      this.musicBus.connect(this.master);
      const mv = c.createGain(); mv.gain.value = 0.5; this.musicBus.connect(mv); mv.connect(this.verbIn);
      // shared noise buffer
      const nb = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.noiseBuf = nb;
      this._ambient();
      this.music = new Music(this);
      if (this.musicOn) this.music.start();
    }
    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
    setVolume(v) {
      this.volume = v;
      if (this.master && !this.muted) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }
    setMusic(on, vol) {
      this.musicOn = on; if (vol !== undefined) this.musicVol = vol;
      if (!this.ctx) return;
      this.musicBus.gain.setTargetAtTime(on ? this.musicVol : 0, this.ctx.currentTime, 0.3);
      if (on) this.music.start(); else this.music.stop();
    }
    mood(intensity, boss) { if (this.music && this.musicOn) this.music.setMood(intensity, boss); }

    _throttle(key, ms) {
      const now = performance.now();
      if (this.last[key] && now - this.last[key] < ms) return true;
      this.last[key] = now; return false;
    }
    _noise(dur) {
      const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
      s._off = Math.random() * Math.max(0, 3 - dur);
      return s;
    }
    /** generic synth voice used by music & sfx */
    voice(freq, t, dur, o = {}) {
      const c = this.ctx, g = c.createGain();
      const vol = o.vol ?? 0.1, atk = o.attack ?? 0.01, rel = o.release ?? 0.2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + atk);
      g.gain.setValueAtTime(vol, t + Math.max(atk, dur - rel));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
      let node = g;
      if (o.filter) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.filter; g.connect(f); node = f; }
      node.connect(o.dest || this.sfx);
      if (o.send) node.connect(o.send);
      const oscs = o.detune ? [-o.detune, 0, o.detune] : [0];
      for (const d of oscs) {
        const os = c.createOscillator(); os.type = o.type || 'sine'; os.frequency.value = freq; os.detune.value = d;
        os.connect(g); os.start(t); os.stop(t + dur + rel + 0.05);
      }
      if (o.sub) { const os = c.createOscillator(); os.type = 'sine'; os.frequency.value = freq / 2; os.connect(g); os.start(t); os.stop(t + dur + rel + 0.05); }
    }
    kick(t, vol, dest) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.55);
    }
    taiko(t, vol, dest) {
      const c = this.ctx, n = this._noise(0.4), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.frequency.value = 180; f.Q.value = 1.4;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      n.connect(f); f.connect(g); g.connect(dest); n.start(t, n._off, 0.4);
      this.kick(t, vol * 0.6, dest);
    }
    hat(t, vol, dest) {
      const c = this.ctx, n = this._noise(0.08), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'highpass'; f.frequency.value = 7000;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      n.connect(f); f.connect(g); g.connect(dest); n.start(t, n._off, 0.08);
    }
    choir(freq, t, dur, dest) {
      const c = this.ctx;
      for (const fm of [700, 1150]) { // "aah" formants
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fm; f.Q.value = 6;
        const g = c.createGain(); g.gain.value = 1.4; f.connect(g); g.connect(dest);
        this.voice(freq, t, dur, { type: 'sawtooth', vol: 0.05, attack: 1, release: 1.2, detune: 12, dest: f });
      }
    }

    // ------------------------------------------------------------------ sfx
    _tone(freq, dur, type = 'sine', vol = 0.2, slideTo = 0, delay = 0) {
      const c = this.ctx, t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this._dest); o.start(t); o.stop(t + dur + 0.05);
    }
    _boom(vol, dur, cutoff = 1800) {
      const c = this.ctx, t = c.currentTime;
      const n = this._noise(Math.min(3, dur));
      const f = c.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(50, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(vol * 0.8, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(f); f.connect(g); g.connect(this._dest); n.start(t, n._off, Math.min(3, dur));
      this._tone(48, dur * 0.8, 'sine', vol * 0.6, 22);
    }
    _whoosh(dur, up, vol = 0.25) {
      const c = this.ctx, t = c.currentTime, n = this._noise(dur);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
      f.frequency.setValueAtTime(up ? 300 : 3000, t); f.frequency.exponentialRampToValueAtTime(up ? 4000 : 200, t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(f); f.connect(g); g.connect(this._dest); n.start(t, n._off, dur);
    }
    _ambient() {
      const c = this.ctx, n = this._noise(3); n.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
      const g = c.createGain(); g.gain.value = 0.035;
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 0.07; lg.gain.value = 180; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
      n.connect(f); f.connect(g); g.connect(this.master); n.start();
    }

    /** play a sound; pos = { pan: -1…1, vol: 0…1 } for spatialised world sounds */
    play(name, pos) {
      if (!this.ctx || this.muted) return;
      const c = this.ctx;
      let dest = this.sfx;
      if (pos) {
        if (pos.vol <= 0.02) return;
        const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pos.pan));
        const g = c.createGain(); g.gain.value = pos.vol;
        p.connect(g); g.connect(this.sfx); dest = p;
      }
      this._dest = dest;
      switch (name) {
        case 'click': if (!this._throttle(name, 40)) this._tone(1200, 0.04, 'triangle', 0.05, 900); break;
        case 'hover': if (!this._throttle(name, 50)) this._tone(2400, 0.02, 'sine', 0.015); break;
        case 'open': this._tone(500, 0.12, 'sine', 0.06, 900); this._whoosh(0.25, true, 0.06); break;
        case 'close': this._tone(800, 0.1, 'sine', 0.05, 400); break;
        case 'attack': if (!this._throttle(name, 120)) { this._tone(140, 0.25, 'sawtooth', 0.1, 60); this._tone(70, 0.3, 'sine', 0.2, 40); } break;
        case 'build': this._tone(523, 0.12, 'triangle', 0.1); this._tone(784, 0.2, 'triangle', 0.08, 0, 0.08); break;
        case 'boat': this._tone(196, 0.5, 'sawtooth', 0.05); this._tone(147, 0.6, 'sine', 0.12, 0, 0.1); break;
        case 'fail': if (!this._throttle(name, 200)) this._tone(220, 0.15, 'square', 0.05, 160); break;
        case 'ally': this._tone(659, 0.18, 'sine', 0.1); this._tone(988, 0.3, 'sine', 0.09, 0, 0.12); break;
        case 'betray': this._tone(300, 0.4, 'sawtooth', 0.1, 120); this._boom(0.3, 1); break;
        case 'launch': this._tone(200, 1.6, 'sawtooth', 0.06, 900); this._whoosh(1.6, true, 0.2); break;
        case 'alarm':
          for (let i = 0; i < 4; i++) { this._tone(880, 0.22, 'square', 0.06, 0, i * 0.5); this._tone(660, 0.22, 'square', 0.06, 0, i * 0.5 + 0.25); }
          break;
        case 'intercept': this._tone(1400, 0.15, 'square', 0.07, 300); this._boom(0.35, 0.4); break;
        case 'boom': this._boom(1, 2.6); break;
        case 'bigboom': this._boom(1.4, 4.5, 2400); this._tone(30, 3, 'sine', 0.5, 18); break;
        case 'lost': this._tone(392, 0.4, 'triangle', 0.1); this._tone(311, 0.5, 'triangle', 0.1, 0, 0.3); this._tone(196, 1.2, 'triangle', 0.12, 0, 0.6); break;
        case 'win': [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.8, 'triangle', 0.1, 0, i * 0.15)); this.play('stinger'); break;
        case 'spawn': this._tone(330, 0.2, 'sine', 0.12, 660); break;
        case 'coin': if (!this._throttle(name, 90)) { this._tone(1318, 0.08, 'square', 0.04); this._tone(1760, 0.18, 'square', 0.04, 0, 0.06); } break;
        case 'construct': this._tone(392, 0.1, 'triangle', 0.08); this._tone(523, 0.1, 'triangle', 0.08, 0, 0.09); this._tone(659, 0.25, 'triangle', 0.08, 0, 0.18); break;
        case 'fanfare': if (!this._throttle(name, 600)) [392, 523, 659, 784].forEach((f, i) => { this._tone(f, 0.35, 'sawtooth', 0.04, 0, i * 0.11); this._tone(f / 2, 0.35, 'triangle', 0.07, 0, i * 0.11); }); break;
        case 'achv': [880, 1175, 1568].forEach((f, i) => this._tone(f, 0.3, 'sine', 0.08, 0, i * 0.09)); break;
        case 'event': if (!this._throttle(name, 800)) { this._tone(147, 1.2, 'sawtooth', 0.06, 110); this._tone(220, 1.0, 'sawtooth', 0.04, 0, 0.15); this._boom(0.25, 1.5, 600); } break;
        case 'emp': this._tone(60, 0.8, 'square', 0.1, 2000); this._tone(3000, 0.4, 'sawtooth', 0.04, 80, 0.05); break;
        case 'thunder': if (!this._throttle(name, 1500)) this._boom(0.5, 3); break;
        case 'select': if (!this._throttle(name, 60)) { this._tone(660, 0.05, 'square', 0.035); this._tone(990, 0.07, 'square', 0.03, 0, 0.04); } break;
        case 'march': if (!this._throttle(name, 150)) { [0, 0.11, 0.22].forEach(d => this._tone(90, 0.08, 'square', 0.07, 50, d)); this._tone(523, 0.12, 'triangle', 0.05, 0, 0.05); } break;
        case 'deploy': this._tone(196, 0.15, 'sawtooth', 0.05); this._tone(294, 0.15, 'sawtooth', 0.05, 0, 0.12); this._tone(392, 0.3, 'sawtooth', 0.05, 0, 0.24); break;
        case 'cannon': if (!this._throttle(name, 120)) this._boom(0.25, 0.5); break;
        case 'thud': if (!this._throttle(name, 90)) this._boom(0.18, 0.7); break;
        case 'eliminated': if (!this._throttle(name, 300)) this._tone(110, 0.6, 'sawtooth', 0.07, 55); break;
        case 'typing': if (!this._throttle(name, 35)) this._tone(1800 + Math.random() * 600, 0.015, 'square', 0.012); break;
        case 'stinger': // orchestral hit
          [38, 50, 53, 57, 62].forEach(n => this.voice(NOTE(n), c.currentTime, 0.6, { type: 'sawtooth', vol: 0.05, attack: 0.005, release: 1.2, detune: 10, dest: this._dest }));
          this._boom(0.5, 1.6, 900); break;
        case 'whoosh': this._whoosh(1.2, false, 0.22); break;
        case 'roar': // dragon: growl through moving formants + rumble
          for (const f0 of [55, 82]) {
            const t = c.currentTime, o = c.createOscillator(), g = c.createGain(), bp = c.createBiquadFilter();
            o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 * 1.6, t); o.frequency.exponentialRampToValueAtTime(f0, t + 2.2);
            bp.type = 'bandpass'; bp.Q.value = 3; bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(300, t + 2.2);
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
            o.connect(bp); bp.connect(g); g.connect(this._dest); o.start(t); o.stop(t + 2.5);
          }
          this._boom(0.45, 2.4, 700); break;
        case 'fire': if (!this._throttle(name, 160)) { const t = c.currentTime, n = this._noise(0.6), f = c.createBiquadFilter(), g = c.createGain();
          f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 0.6; g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
          n.connect(f); f.connect(g); g.connect(this._dest); n.start(t, n._off, 0.6); } break;
        case 'sam': if (!this._throttle(name, 80)) { this._tone(2200, 0.18, 'sawtooth', 0.05, 400); this._whoosh(0.3, true, 0.08); } break;
        case 'ult_blitz': this._whoosh(0.9, true, 0.3); [440, 554, 659, 880].forEach((f, i) => this._tone(f, 0.25, 'sawtooth', 0.05, f * 1.5, i * 0.07)); break;
        case 'ult_bulwark': this._tone(98, 2.5, 'sine', 0.3); this._tone(196, 2.2, 'triangle', 0.12); this._tone(294, 2.0, 'sine', 0.08); this._boom(0.3, 1.2, 400); break;
        case 'ult_fire': this._whoosh(1.4, false, 0.35); this._boom(0.9, 3, 1200); this.play('fire'); break;
        case 'heart': this._tone(60, 0.12, 'sine', 0.25, 45); this._tone(60, 0.12, 'sine', 0.2, 45, 0.18); break;
      }
    }
  }

  BW.Audio = Audio;
})(globalThis.BW = globalThis.BW || {});
