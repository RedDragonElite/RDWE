/* RDE // KONTRAKT — procedural audio: spatial SFX, ambience, sirens, engines, generative noir score (no assets) */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE;

  // gunshot character per weapon: crack band, thump pitch, weight, tail, supersonic snap, echo
  const GUNSND = {
    pistol: { crack: 2000, thump: 150, boom: 0.85, tail: 0.25, vol: 0.75 },
    p9: { crack: 2100, thump: 155, boom: 0.82, tail: 0.24, vol: 0.75 },
    silber: { crack: 1700, thump: 125, boom: 0.95, tail: 0.3, vol: 0.8 },
    magnum: { crack: 1450, thump: 82, boom: 1.3, tail: 0.55, vol: 0.95, echo: 1.2 },
    smg: { crack: 2300, thump: 165, boom: 0.68, tail: 0.16, vol: 0.7 },
    mpk: { crack: 2300, thump: 165, boom: 0.68, tail: 0.16, vol: 0.7 },
    shotgun: { crack: 850, thump: 68, boom: 1.45, tail: 0.65, vol: 1.0, wide: true, echo: 1.2 },
    pump: { crack: 850, thump: 68, boom: 1.45, tail: 0.65, vol: 1.0, wide: true, echo: 1.2 },
    rifle: { crack: 2000, thump: 100, boom: 1.05, tail: 0.42, snap: 0.6, vol: 0.85, echo: 1.1 },
    k47: { crack: 1950, thump: 98, boom: 1.05, tail: 0.42, snap: 0.6, vol: 0.85, echo: 1.1 },
    lmg: { crack: 1850, thump: 92, boom: 1.1, tail: 0.45, snap: 0.55, vol: 0.88, echo: 1.1 },
    dmr: { crack: 1750, thump: 88, boom: 1.2, tail: 0.65, snap: 0.85, vol: 0.95, echo: 1.3, range: 4200 },
    sniper: { crack: 1550, thump: 70, boom: 1.45, tail: 0.95, snap: 1, vol: 1.05, echo: 1.5, range: 5200 },
    jaeger: { crack: 1550, thump: 70, boom: 1.45, tail: 0.95, snap: 1, vol: 1.05, echo: 1.5, range: 5200 },
    kodiak: { crack: 1150, thump: 46, boom: 1.95, tail: 1.35, snap: 1.25, vol: 1.2, echo: 1.8, range: 6500 },
    vss: { crack: 1300, thump: 120, boom: 0.9, tail: 0.3, snap: 0.3, vol: 0.6 },
  };
  const ENGCYL = { compact: 4, sedan: 4, taxi: 4, van: 4, coupe: 6, suv: 6, pickup: 8, muscle: 8, sport: 8, police: 8, super: 12, ev: 0 };
  const ENGBASE = { van: 0.8, pickup: 0.85, muscle: 0.9, super: 1.05, compact: 1.1 };

  class Audio {
    constructor() {
      this.ctx = null; this.vol = 0.8; this.musicVol = 0.5; this.muted = false;
      this.lx = 0; this.ly = 0; this.inside = false;
      this.mood = 0; this.moodT = 0; this.night = false;
      this.last = {};
    }
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : this.vol;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.2;   // a gentle limiter that keeps the punch
      this.master.connect(comp); comp.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.connect(this.master);
      this.muffle = c.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000; this.muffle.connect(this.sfx);
      this.musicBus = c.createGain(); this.musicBus.gain.value = this.musicVol; this.musicBus.connect(this.master);
      this.amb = c.createGain(); this.amb.gain.value = 0.9; this.amb.connect(this.master);
      // reverb
      this.verb = c.createConvolver(); this.verb.buffer = this.impulse(2.6, 2.8);
      this.verbIn = c.createGain(); this.verbIn.gain.value = 0.9; this.verbIn.connect(this.verb); this.verb.connect(this.sfx);
      // noise buffers
      const n = c.sampleRate * 2;
      this.white = c.createBuffer(1, n, c.sampleRate); const wd = this.white.getChannelData(0); for (let i = 0; i < n; i++) wd[i] = Math.random() * 2 - 1;
      this.brown = c.createBuffer(1, n, c.sampleRate); const bd = this.brown.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = l * 3.5; }
      // outdoor slap-back echo from the facades (two taps, darkening feedback)
      this.echoIn = c.createGain(); this.echoIn.gain.value = 1;
      const d1 = c.createDelay(1.5), d2 = c.createDelay(1.5), fb = c.createGain(), elp = c.createBiquadFilter(), eout = c.createGain();
      d1.delayTime.value = 0.19; d2.delayTime.value = 0.43; fb.gain.value = 0.28; elp.type = 'lowpass'; elp.frequency.value = 1900; eout.gain.value = 0.55;
      this.echoIn.connect(d1); this.echoIn.connect(d2); d1.connect(elp); d2.connect(elp); elp.connect(eout); elp.connect(fb); fb.connect(d1); eout.connect(this.sfx);
      // soft-clip curve for punchy transients
      this.sat = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; this.sat[i] = Math.tanh(x * 2.6) / Math.tanh(2.6); }
      this.startAmbience();
      this.music = new Music(this);
    }
    impulse(sec, decay) {
      const c = this.ctx, len = c.sampleRate * sec, b = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
      return b;
    }
    setVolume(v) { this.vol = v; if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.05); }
    setMusic(v) { this.musicVol = v; if (this.musicBus) this.musicBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }
    setMuted(m) { this.muted = m; this.setVolume(this.vol); }

    // ------------------------------------------------------------ primitives
    out(x, y, vol, maxD = 1400) {
      const c = this.ctx;
      const g = c.createGain();
      let gain = vol;
      let pan = 0, dist = 0;
      if (x != null) {
        dist = Math.hypot(x - this.lx, y - this.ly);
        const k = U.clamp(1 - dist / maxD, 0, 1); gain *= k * k;
        pan = U.clamp((x - this.lx) / 600, -1, 1);
      }
      if (gain < 0.003) return null;
      g.gain.value = gain;
      const p = c.createStereoPanner(); p.pan.value = pan;
      g.connect(p); p.connect(this.muffle);
      g.dist = dist;
      return g;
    }
    noise(dst, t, dur, type, f0, f1, q = 1, g0 = 1, buf) {
      const c = this.ctx, s = c.createBufferSource(); s.buffer = buf || this.white;
      s.playbackRate.value = 0.8 + Math.random() * 0.4;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); f.Q.value = q;
      const g = c.createGain(); g.gain.setValueAtTime(g0, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(f); f.connect(g); g.connect(dst);
      s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
      return g;
    }
    tone(dst, t, dur, type, f0, f1, g0 = 0.5, att = 0.002) {
      const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(g0, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dst); o.start(t); o.stop(t + dur + 0.05);
      return o;
    }
    send(g, amt) { if (!g) return; const s = this.ctx.createGain(); s.gain.value = amt; g.connect(s); s.connect(this.verbIn); }
    rate(key, gap) { const t = this.ctx.currentTime; if (this.last[key] && t - this.last[key] < gap) return false; this.last[key] = t; return true; }

    // ------------------------------------------------------------ recipes
    /** layered gunshot: action click · supersonic snap · saturated muzzle crack · low thump · body · facade echo */
    gun(x, y, w, sup, player) {
      const c = this.ctx, d = K.WEAPONS[w] || K.WEAPONS.p9;
      const P = GUNSND[w] || GUNSND[d.cls] || GUNSND.pistol;
      const dist = x != null ? Math.hypot(x - this.lx, y - this.ly) : 0;
      const t = c.currentTime + Math.min(0.45, dist * 0.07 / 343);   // sound travels: far shots arrive late
      const pv = 0.94 + Math.random() * 0.12;
      if (sup || d.sup) {
        const g = this.out(x, y, 0.45 * (P.boom > 1 ? 1.3 : 1), 800); if (!g) return;
        this.noise(g, t, 0.05, 'bandpass', 1100 * pv, 500, 1.2, 0.9);
        this.noise(g, t, 0.012, 'highpass', 5000, null, 0.7, 0.6);
        this.tone(g, t, 0.05, 'sine', 220 * pv, 90, 0.35);
        this.noise(g, t + 0.04, 0.09, 'bandpass', 2600, 1800, 3, 0.18);
        if (P.snap) this.noise(g, t, 0.01, 'highpass', 3500, null, 0.6, 0.5);
        return;
      }
      const g = this.out(x, y, (P.vol || 0.8) * (player ? 1 : 0.95), P.range || 3400);
      if (!g) return;
      const far = U.clamp(g.dist / 2600, 0, 1);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 12000 - far * 10200; lp.Q.value = 0.4; lp.connect(g);
      const sh = c.createWaveShaper(); sh.curve = this.sat; sh.oversample = '2x';
      const drive = c.createGain(); drive.gain.value = 1.6; drive.connect(sh); sh.connect(lp);
      if (far < 0.4) this.noise(lp, Math.max(c.currentTime, t - 0.004), 0.012, 'highpass', 5200, null, 0.7, 0.35 * (1 - far));
      if (P.snap) { this.noise(lp, t, 0.008, 'highpass', 2800, null, 0.6, 1.1 * P.snap); this.tone(lp, t, 0.012, 'square', 3300 * pv, 1800, 0.18 * P.snap); }
      this.noise(drive, t, 0.05 + 0.05 * P.boom, 'bandpass', P.crack * pv, P.crack * 0.35, 0.8, 1.25 * P.boom);
      this.noise(drive, t, 0.02, 'highpass', 3600, null, 0.6, 0.6);
      this.tone(drive, t, 0.12 + 0.1 * P.boom, 'sine', P.thump * 2 * pv, P.thump * 0.45, 1.0 * P.boom, 0.001);
      if (P.boom > 1.15) this.tone(drive, t, 0.25 + P.boom * 0.15, 'triangle', P.thump * pv, P.thump * 0.35, 0.6 * (P.boom - 0.8), 0.002);
      this.noise(lp, t + 0.01, P.tail, 'lowpass', 1100, 140, 0.7, 0.55 * P.boom, this.brown);
      if (P.wide) this.noise(lp, t, 0.18, 'bandpass', 420, 160, 0.6, 0.9);
      // room / street reflections are fed from the distance-attenuated signal
      if (this.inside) this.send(g, 0.55 + far * 0.3);
      else { const e = c.createGain(); e.gain.value = (0.3 + far * 0.5) * (P.echo || 1); g.connect(e); e.connect(this.echoIn); this.send(g, 0.1); }
    }
    hit(x, y, kind) {
      const t = this.ctx.currentTime;
      const g = this.out(x, y, 0.55, 900); if (!g) return;
      if (kind === 'fist') { this.noise(g, t, 0.09, 'lowpass', 500, 120, 1, 1.2); this.tone(g, t, 0.08, 'sine', 110, 50, 0.7); }
      else if (kind === 'blunt') { this.noise(g, t, 0.12, 'lowpass', 900, 150, 1, 1.1); this.tone(g, t, 0.1, 'sine', 90, 40, 0.8); }
      else { this.noise(g, t, 0.14, 'bandpass', 700, 250, 2.5, 0.9); this.noise(g, t + 0.04, 0.1, 'lowpass', 400, 120, 1, 0.6); }
    }
    flesh(x, y, big) {
      const t = this.ctx.currentTime;
      const g = this.out(x, y, big ? 0.6 : 0.35, 800); if (!g) return;
      this.noise(g, t, big ? 0.3 : 0.12, 'lowpass', 600, 120, 1, 1);
      if (big) { for (let k = 0; k < 4; k++) this.noise(g, t + k * 0.03, 0.04, 'highpass', 1800, null, 1, 0.5); }
    }
    step(x, y, surf, run, player, crouch) {
      const t = this.ctx.currentTime;
      const g = this.out(x, y, (player ? 0.22 : 0.12) * (run ? 1.4 : 1) * (crouch ? 0.4 : 1), player ? 400 : 260); if (!g) return;
      const T = K.T;
      if (this.wet > 0.3 && (surf === T.ROAD || surf === T.WALK || surf === T.PLAZA || surf === T.CONC)) { this.noise(g, t, 0.09, 'bandpass', 2200, 900, 1.2, 0.8); return; }
      if (surf === T.GRASS || surf === T.DIRT || surf === T.SAND) this.noise(g, t, 0.09, 'bandpass', 3200, 1600, 0.8, 0.6);
      else if (surf === T.WOOD || surf === T.DOCK) { this.tone(g, t, 0.06, 'sine', 210, 120, 0.6); this.noise(g, t, 0.04, 'bandpass', 900, null, 2, 0.4); }
      else if (surf === T.CARPET) this.noise(g, t, 0.06, 'lowpass', 500, null, 1, 0.5);
      else { this.noise(g, t, 0.035, 'highpass', 1800, null, 0.8, 0.8); this.tone(g, t, 0.03, 'sine', 160, 90, 0.35); }
    }
    explosion(x, y) {
      const c = this.ctx, t = c.currentTime;
      const g = this.out(x, y, 1.4, 4000); if (!g) return;
      this.noise(g, t, 1.8, 'lowpass', 1800, 60, 0.7, 1.5, this.brown);
      this.noise(g, t, 0.4, 'bandpass', 900, 200, 0.5, 1.2);
      this.tone(g, t, 1.2, 'sine', 70, 25, 1.4);
      for (let k = 0; k < 8; k++) this.noise(g, t + 0.1 + Math.random() * 0.8, 0.05, 'highpass', 2500, null, 1, 0.3);
      this.send(g, 0.7);
      // ears ring
      if (g.dist < 500) { this.muffle.frequency.cancelScheduledValues(t); this.muffle.frequency.setValueAtTime(600, t); this.muffle.frequency.exponentialRampToValueAtTime(20000, t + 2.5); const r = this.out(null, null, 0.05); if (r) this.tone(r, t, 2.2, 'sine', 3800, 3700, 0.6, 0.05); }
    }
    scream(x, y, female) {
      if (!this.rate('scream', 0.35)) return;
      const c = this.ctx, t = c.currentTime;
      const g = this.out(x, y, 0.22, 1200); if (!g) return;
      const o = c.createOscillator(); o.type = 'sawtooth';
      const b = female ? 520 : 300;
      o.frequency.setValueAtTime(b, t); o.frequency.linearRampToValueAtTime(b * 1.7, t + 0.15); o.frequency.linearRampToValueAtTime(b * 1.25, t + 0.7);
      const vib = c.createOscillator(); vib.frequency.value = 7; const vg = c.createGain(); vg.gain.value = 18; vib.connect(vg); vg.connect(o.frequency);
      const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = female ? 1100 : 800; f1.Q.value = 4;
      const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = female ? 2600 : 1900; f2.Q.value = 5;
      const env = c.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(0.9, t + 0.05); env.gain.setValueAtTime(0.8, t + 0.5); env.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
      o.connect(f1); o.connect(f2); f1.connect(env); f2.connect(env); env.connect(g);
      o.start(t); vib.start(t); o.stop(t + 0.9); vib.stop(t + 0.9);
      this.send(g, 0.4);
    }
    ui(s) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime, g = this.out(null, null, 0.5); if (!g) return;
      switch (s) {
        case 'click': this.tone(g, t, 0.04, 'sine', 900, 700, 0.25); break;
        case 'hover': this.tone(g, t, 0.03, 'sine', 1400, null, 0.08); break;
        case 'error': this.tone(g, t, 0.18, 'square', 140, 110, 0.18); break;
        case 'cash': case 'coins': this.tone(g, t, 0.12, 'sine', 2100, null, 0.25); this.tone(g, t + 0.06, 0.25, 'sine', 2800, null, 0.25); this.noise(g, t, 0.15, 'highpass', 5000, null, 1, 0.2); break;
        case 'purchase': [523, 659, 784, 1046].forEach((f, k) => this.tone(g, t + k * 0.07, 0.6, 'triangle', f, null, 0.22)); break;
        case 'levelup': [392, 523, 659, 784, 1046].forEach((f, k) => this.tone(g, t + k * 0.08, 0.8, 'triangle', f, null, 0.2)); break;
        case 'phone': for (let k = 0; k < 6; k++) { this.tone(g, t + k * 0.09, 0.07, 'sine', k & 1 ? 1700 : 1300, null, 0.2); } for (let k = 0; k < 6; k++) this.tone(g, t + 0.9 + k * 0.09, 0.07, 'sine', k & 1 ? 1700 : 1300, null, 0.2); break;
        case 'accept': this.tone(g, t, 0.6, 'sine', 70, 40, 0.9); [220, 261, 330].forEach((f) => this.tone(g, t, 1.4, 'sawtooth', f, null, 0.05, 0.1)); break;
        case 'complete': [196, 247, 294, 392].forEach((f, k) => this.tone(g, t + k * 0.05, 2.4, 'triangle', f, null, 0.14, 0.2)); this.tone(g, t, 1.5, 'sine', 55, 40, 0.8); break;
        case 'heal': this.tone(g, t, 0.3, 'sine', 600, 900, 0.18); break;
        case 'eat': for (let k = 0; k < 3; k++) this.noise(g, t + k * 0.12, 0.08, 'bandpass', 1800, 900, 1.5, 0.5); break;
        case 'drink': for (let k = 0; k < 3; k++) this.tone(g, t + k * 0.16, 0.12, 'sine', 300, 180, 0.3); break;
        case 'cloth': case 'grab': this.noise(g, t, 0.35, 'bandpass', 1600, 800, 0.8, 0.35); break;
        case 'vest': for (let k = 0; k < 6; k++) this.noise(g, t + k * 0.04, 0.03, 'highpass', 3000, null, 1, 0.4); break;
        case 'attach': case 'pickup': this.tone(g, t, 0.03, 'square', 1500, null, 0.12); this.noise(g, t + 0.04, 0.05, 'bandpass', 2500, null, 2, 0.4); break;
        case 'beep': this.tone(g, t, 0.08, 'square', 1800, null, 0.15); break;
        case 'unlock': this.tone(g, t, 0.03, 'square', 2200, null, 0.15); this.tone(g, t + 0.12, 0.04, 'square', 1600, null, 0.2); break;
        case 'crowbar': this.noise(g, t, 0.4, 'bandpass', 900, 400, 3, 0.6); this.tone(g, t + 0.3, 0.3, 'sine', 900, 600, 0.3); break;
        case 'safe': this.tone(g, t, 0.5, 'sine', 120, 60, 0.7); for (let k = 0; k < 5; k++) this.tone(g, t + 0.1 + k * 0.05, 0.03, 'square', 2000, null, 0.08); break;
        case 'vend': this.tone(g, t, 0.2, 'sine', 140, 70, 0.6); this.noise(g, t + 0.25, 0.3, 'bandpass', 1200, 600, 2, 0.3); break;
        case 'dry': this.tone(g, t, 0.02, 'square', 2600, null, 0.18); break;
        case 'cell': this.tone(g, t, 0.6, 'square', 90, 55, 0.25); this.noise(g, t, 0.5, 'bandpass', 700, 300, 2, 0.6); this.tone(g, t + 0.05, 1.2, 'sine', 420, 400, 0.15); this.send(g, 0.8); break;
        case 'pick': for (let k = 0; k < 2; k++) this.tone(g, t + k * 0.05, 0.015, 'square', 3200 + Math.random() * 1500, null, 0.07); break;
        case 'pour': this.noise(g, t, 0.6, 'bandpass', 900, 500, 3, 0.35); for (let k = 0; k < 5; k++) this.tone(g, t + k * 0.1, 0.06, 'sine', 400 + Math.random() * 300, 250, 0.08); break;
        case 'harvest': for (let k = 0; k < 4; k++) this.noise(g, t + k * 0.12, 0.15, 'highpass', 2500, null, 1, 0.3); break;
        case 'cough': for (let k = 0; k < 3; k++) this.noise(g, t + 0.2 + k * 0.22, 0.12, 'bandpass', 500, 250, 1.5, 0.5); break;
        case 'spray': this.noise(g, t, 0.45, 'highpass', 4500, 3500, 0.7, 0.22); this.tone(g, t, 0.05, 'square', 1200, null, 0.03); break;
        case 'sputter': for (let k = 0; k < 3; k++) this.noise(g, t + k * 0.09, 0.06, 'lowpass', 300, 120, 1, 0.6); break;
        case 'stall': this.tone(g, t, 0.6, 'sawtooth', 70, 25, 0.12); this.noise(g, t, 0.4, 'lowpass', 400, 80, 1, 0.4); break;
        case 'crank': for (let k = 0; k < 6; k++) { this.tone(g, t + k * 0.16, 0.12, 'sawtooth', 55 + Math.random() * 10, 40, 0.12); this.noise(g, t + k * 0.16, 0.1, 'bandpass', 900, 500, 2, 0.15); } break;
        case 'ignite': this.tone(g, t, 0.7, 'sawtooth', 50, 95, 0.18); this.noise(g, t, 0.5, 'lowpass', 700, 200, 1, 0.4); break;
        case 'belt': this.tone(g, t, 0.04, 'square', 1800, null, 0.12); this.tone(g, t + 0.06, 0.05, 'square', 1200, null, 0.15); break;
        case 'unbelt': this.tone(g, t, 0.05, 'square', 1100, null, 0.12); this.noise(g, t + 0.03, 0.15, 'bandpass', 2500, 1500, 2, 0.2); break;
        case 'nozzle': this.tone(g, t, 0.05, 'square', 600, null, 0.14); this.noise(g, t + 0.04, 0.12, 'bandpass', 1600, 900, 2, 0.3); break;
        case 'wrench': for (let k = 0; k < 3; k++) this.tone(g, t + k * 0.07, 0.05, 'triangle', 2200 + Math.random() * 800, null, 0.08); break;
        case 'keys': for (let k = 0; k < 5; k++) this.tone(g, t + Math.random() * 0.2, 0.08, 'sine', 3500 + Math.random() * 2500, null, 0.06); break;
        case 'rocket': this.noise(g, t, 0.9, 'bandpass', 1200, 300, 0.7, 0.8); this.tone(g, t, 0.6, 'sawtooth', 220, 90, 0.1); break;
        case 'drill': this.tone(g, t, 0.5, 'sawtooth', 820 + Math.random() * 60, 760, 0.07); this.noise(g, t, 0.5, 'bandpass', 3200, 2600, 4, 0.18); break;
        case 'vault': this.tone(g, t, 1.2, 'sine', 70, 40, 0.9); this.noise(g, t, 0.6, 'lowpass', 500, 120, 1, 0.8); this.tone(g, t + 0.5, 0.8, 'square', 180, 120, 0.06); this.send(g, 0.8); break;
        case 'heart': this.tone(g, t, 0.12, 'sine', 60, 40, 0.9); this.tone(g, t + 0.18, 0.12, 'sine', 55, 38, 0.7); break;
        case 'wanted': this.tone(g, t, 0.15, 'square', 880, null, 0.08); this.tone(g, t + 0.18, 0.15, 'square', 660, null, 0.08); break;
        case 'stinger': this.tone(g, t, 1.2, 'sawtooth', 110, 55, 0.12, 0.01); this.noise(g, t, 0.8, 'lowpass', 400, 80, 1, 0.6, this.brown); break;
        case 'slowmo': this.tone(g, t, 1.4, 'sine', 180, 60, 0.6, 0.02); this.noise(g, t, 1.2, 'lowpass', 300, 80, 1, 0.5, this.brown); break;
      }
    }
    casing(x, y) { if (!this.ctx || !this.rate('casing', 0.03)) return; const t = this.ctx.currentTime, g = this.out(x, y, 0.08, 300); if (!g) return; this.tone(g, t, 0.05, 'sine', 4200 + Math.random() * 1800, null, 0.4); this.tone(g, t + 0.06, 0.04, 'sine', 5200, null, 0.25); }

    // ------------------------------------------------------------ world events
    onEvent(e, w) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      switch (e.type) {
        case 'shot': this.gun(e.x, e.y, e.w, e.sup, e.player); break;
        case 'dry': if (e.id === w.player.id) this.ui('dry'); break;
        case 'reload': { const g = this.out(e.x, e.y, 0.3, 500); if (!g) break; if (e.stage === 'out') { this.tone(g, t, 0.03, 'square', 1200, null, 0.15); this.noise(g, t + 0.05, 0.08, 'bandpass', 1800, null, 2, 0.4); } else if (e.stage === 'shell') { this.tone(g, t, 0.05, 'sine', 500, 300, 0.4); this.noise(g, t, 0.05, 'bandpass', 1500, null, 2, 0.4); } else { this.noise(g, t, 0.05, 'bandpass', 2400, null, 2, 0.6); this.tone(g, t + 0.1, 0.04, 'square', 900, null, 0.15); this.noise(g, t + 0.12, 0.06, 'highpass', 2000, null, 1, 0.4); } break; }
        case 'equip': { const g = this.out(null, null, 0.18); if (g) { this.noise(g, t, 0.12, 'bandpass', 1500, 900, 1, 0.5); this.tone(g, t + 0.08, 0.03, 'square', 1700, null, 0.1); } break; }
        case 'swing': { const g = this.out(e.x, e.y, 0.18, 400); if (g) this.noise(g, t, 0.18, 'bandpass', 500, 2200, 1.2, 0.8); break; }
        case 'hurt': if (e.kind === 'fist') this.hit(e.x, e.y, 'fist'); else if (e.blunt) this.hit(e.x, e.y, 'blunt'); else if (e.kind === 'melee') this.hit(e.x, e.y, 'sharp'); else if (e.kind === 'bullet') this.flesh(e.x, e.y, e.head); if (e.player) { const g = this.out(null, null, 0.3); if (g) this.tone(g, t, 0.15, 'sine', 180, 80, 0.5); } break;
        case 'death': { const g = this.out(e.x, e.y, 0.4, 600); if (g) { this.tone(g, t + 0.15, 0.25, 'sine', 80, 40, 0.8); this.noise(g, t + 0.15, 0.25, 'lowpass', 400, 100, 1, 0.6); } if (e.gore) this.flesh(e.x, e.y, true); break; }
        case 'ko': { const g = this.out(e.x, e.y, 0.35, 500); if (g) this.tone(g, t + 0.1, 0.25, 'sine', 90, 40, 0.7); break; }
        case 'impact': { const g = this.out(e.x, e.y, 0.25, 700); if (!g) break; if (e.mat === 'metal') { this.tone(g, t, 0.25, 'sine', 2400 + Math.random() * 800, 1800, 0.25); this.noise(g, t, 0.04, 'highpass', 3000, null, 1, 0.5); } else { this.noise(g, t, 0.06, 'bandpass', e.mat === 'wood' ? 900 : 1600, null, 1.5, 0.7); if (Math.random() < 0.25) { this.tone(g, t, 0.18, 'sine', 3200, 1400, 0.12); } } break; }
        case 'glass': { const g = this.out(e.x, e.y, 0.5, 1000); if (!g) break; this.noise(g, t, 0.3, 'highpass', 2500, null, 1, 0.8); for (let k = 0; k < 8; k++) this.tone(g, t + Math.random() * 0.25, 0.1, 'sine', 3000 + Math.random() * 4000, null, 0.12); break; }
        case 'explosion': this.explosion(e.x, e.y); break;
        case 'alarmbell': { const g = this.out(e.x, e.y, 0.35 * e.v, 2600); if (!g) break; for (let k = 0; k < 10; k++) this.tone(g, t + k * 0.06, 0.05, 'square', 2300 + (k & 1) * 150, null, 0.12); for (let k = 0; k < 2; k++) this.tone(g, t + k * 0.6, 0.55, 'sawtooth', 880, 660, 0.05); break; }
        case 'step': if (Math.abs(e.x - this.lx) < 500 && Math.abs(e.y - this.ly) < 500) this.step(e.x, e.y, e.surf, e.run, e.player, e.crouch); break;
        case 'door': if (this.rate('door', 0.15)) { const g = this.out(e.x, e.y, 0.18, 400); if (g) { this.tone(g, t, 0.08, 'sine', 160, 100, 0.5); this.noise(g, t, 0.15, 'bandpass', 600, 300, 2, 0.2); } } break;
        case 'scream': this.scream(e.x, e.y, e.female); break;
        case 'struggle': { const g = this.out(e.x, e.y, 0.25, 400); if (g) { this.noise(g, t, 0.2, 'lowpass', 300, null, 1, 0.6); if (Math.random() < 0.5) this.tone(g, t, 0.15, 'sawtooth', 140, 110, 0.08); } break; }
        case 'takedown': if (e.stage === 'start') { const g = this.out(e.x, e.y, 0.3, 400); if (g) this.noise(g, t, 0.25, 'bandpass', 800, 300, 1, 0.6); } break;
        case 'coinLand': case 'clink': { const g = this.out(e.x, e.y, 0.3, 900); if (g) { this.tone(g, t, 0.15, 'sine', 2600, null, 0.25); this.tone(g, t + 0.07, 0.2, 'sine', 3300, null, 0.18); } break; }
        case 'throw': { const g = this.out(e.x, e.y, 0.2, 300); if (g) this.noise(g, t, 0.15, 'bandpass', 800, 2000, 1, 0.5); break; }
        case 'crash': { const g = this.out(e.x, e.y, U.clamp(e.v / 300, 0.3, 1), 1400); if (!g) break; this.noise(g, t, 0.35, 'lowpass', 1500, 200, 0.7, 1.2); for (let k = 0; k < 5; k++) this.tone(g, t + Math.random() * 0.15, 0.2, 'triangle', 600 + Math.random() * 1500, null, 0.12); if (Math.random() < 0.5) this.noise(g, t + 0.05, 0.3, 'highpass', 3000, null, 1, 0.3); break; }
        case 'carHit': this.flesh(e.x, e.y, true); break;
        case 'honk': { const g = this.out(e.x, e.y, 0.35, 1400); if (!g) break;
          if (e.horn === 1) [523, 659, 784].forEach((f, k) => this.tone(g, t + k * 0.12, 0.14, 'square', f, null, 0.1, 0.01));
          else if (e.horn === 2) { this.tone(g, t, 0.8, 'sawtooth', 160, null, 0.16, 0.02); this.tone(g, t, 0.8, 'sawtooth', 200, null, 0.12, 0.02); }
          else if (e.horn === 3) [392, 392, 392, 523, 659].forEach((f, k) => this.tone(g, t + [0, 0.12, 0.24, 0.36, 0.6][k], k > 2 ? 0.22 : 0.1, 'square', f, null, 0.09, 0.01));
          else { this.tone(g, t, 0.45, 'square', 420, null, 0.12, 0.01); this.tone(g, t, 0.45, 'square', 530, null, 0.1, 0.01); }
          break; }
        case 'propSmash': { const g = this.out(e.x, e.y, 0.6, 1600); if (!g) break; this.noise(g, t, 0.3, 'lowpass', 1200, 200, 0.8, 1); if (e.k === 'lamp' || e.k === 'bollard' || e.k === 'hydrant') { for (let k = 0; k < 4; k++) this.tone(g, t + k * 0.03, 0.5, 'triangle', 300 + k * 410 + Math.random() * 90, null, 0.1); } if (e.k === 'lamp') this.noise(g, t + 0.05, 0.4, 'highpass', 3500, null, 1, 0.4); if (e.k === 'hydrant') this.noise(g, t + 0.1, 2.5, 'bandpass', 1800, 900, 0.8, 0.3); break; }
        case 'tireBurst': { const g = this.out(e.x, e.y, 0.6, 1400); if (g) { this.noise(g, t, 0.12, 'lowpass', 2500, 300, 0.7, 1.4); this.noise(g, t + 0.05, 0.6, 'highpass', 2000, 800, 1, 0.3); } break; }
        case 'skid': if (this.rate('skid', 0.12)) { const g = this.out(e.x, e.y, 0.2, 800); if (g) this.noise(g, t, 0.2, 'bandpass', 1100, 900, 4, 0.6); } break;
        case 'carEnter': case 'carExit': { const g = this.out(null, null, 0.3); if (g) { this.tone(g, t, 0.1, 'sine', 120, 60, 0.6); this.noise(g, t, 0.08, 'lowpass', 600, null, 1, 0.5); } break; }
        case 'thunder': { const g = this.out(null, null, 0.9); if (g) { const d = e.delay || 0.5; this.noise(g, t + d, 3.5, 'lowpass', 300, 50, 0.7, 1.4, this.brown); this.noise(g, t + d + 0.2, 1.4, 'lowpass', 800, 100, 0.5, 0.6); } break; }
        case 'carBurn': { const g = this.out(e.x, e.y, 0.5, 1000); if (g) this.noise(g, t, 1, 'lowpass', 800, 200, 1, 0.8, this.brown); break; }
        case 'meleeHit': if (e.sharp) this.flesh(e.x, e.y, false); break;
        case 'sfx': this.ui(e.s); break;
        case 'phone': this.ui('phone'); break;
        case 'alert': if (this.rate('alert', 1.2)) this.ui('stinger'); break;
        case 'wanted': if (e.level > e.prev) this.ui('wanted'); break;
        case 'targetDown': this.ui('slowmo'); break;
      }
    }

    // ------------------------------------------------------------ ambience & loops
    loop(buf, type, f, q, g0) {
      const c = this.ctx, s = c.createBufferSource(); s.buffer = buf; s.loop = true;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = c.createGain(); g.gain.value = g0;
      s.connect(fl); fl.connect(g); g.connect(this.amb); s.start();
      return { s, f: fl, g };
    }
    /** a synthesized combustion engine: firing-frequency saw stack, sub, saturation, intake hiss, turbo whine */
    mkEngine() {
      const c = this.ctx, e = {};
      e.o1 = c.createOscillator(); e.o1.type = 'sawtooth';
      e.o2 = c.createOscillator(); e.o2.type = 'sawtooth';
      e.o3 = c.createOscillator(); e.o3.type = 'square';
      e.sh = c.createWaveShaper(); e.sh.curve = this.sat;
      e.lp = c.createBiquadFilter(); e.lp.type = 'lowpass'; e.lp.Q.value = 1.2;
      e.g = c.createGain(); e.g.gain.value = 0; e.pan = c.createStereoPanner();
      const sub = c.createGain(); sub.gain.value = 0.45;
      e.o1.connect(e.sh); e.o2.connect(e.sh); e.o3.connect(sub); sub.connect(e.sh); e.sh.connect(e.lp); e.lp.connect(e.g); e.g.connect(e.pan); e.pan.connect(this.sfx);
      e.am = c.createOscillator(); e.am.type = 'sine'; e.amG = c.createGain(); e.amG.gain.value = 0; e.am.connect(e.amG); e.amG.connect(e.g.gain);
      e.n = c.createBufferSource(); e.n.buffer = this.brown; e.n.loop = true; e.nf = c.createBiquadFilter(); e.nf.type = 'bandpass'; e.nf.Q.value = 0.8; e.ng = c.createGain(); e.ng.gain.value = 0;
      e.n.connect(e.nf); e.nf.connect(e.ng); e.ng.connect(e.pan);
      e.tw = c.createOscillator(); e.tw.type = 'sine'; e.tg = c.createGain(); e.tg.gain.value = 0; e.tw.connect(e.tg); e.tg.connect(e.pan);
      for (const o of [e.o1, e.o2, e.o3, e.am, e.tw]) { o.frequency.value = 40; o.start(); }
      e.n.start();
      e.gear = 'N'; e.thr = 0;
      return e;
    }
    engineVoice(e, car, vol, t, set) {
      if (!car || vol <= 0.001) { set(e.g.gain, 0, 0.15); set(e.ng.gain, 0, 0.15); set(e.tg.gain, 0, 0.15); set(e.amG.gain, 0, 0.15); return; }
      const M = K.CARMODELS ? K.CARMODELS[car.kind] : null, ev = M && M.ev;
      const r = K.carRPM ? K.carRPM(car) : { rpm: 1000 + (car.speed || 0) * 8, gear: '1' };
      const thr = Math.abs(car.thr || 0), cyl = ENGCYL[car.kind] || 4, base = ENGBASE[car.kind] || 1;
      const f = Math.max(12, r.rpm / 60 * cyl / 2 * base);
      if (ev) {
        set(e.g.gain, 0, 0.1); set(e.amG.gain, 0, 0.1); set(e.ng.gain, 0.012 * vol, 0.1);
        e.tw.frequency.setTargetAtTime(300 + (car.speed || 0) * 4, t, 0.05); set(e.tg.gain, (0.012 + thr * 0.02) * vol, 0.08);
        e.nf.frequency.setTargetAtTime(1800, t, 0.1);
        return;
      }
      e.o1.frequency.setTargetAtTime(f, t, 0.035); e.o2.frequency.setTargetAtTime(f * 1.007, t, 0.035); e.o3.frequency.setTargetAtTime(f / 2, t, 0.035);
      e.am.frequency.setTargetAtTime(f / 2, t, 0.035);
      const loud = (car.kind === 'muscle' || car.kind === 'super' || car.kind === 'sport' ? 1.3 : car.kind === 'compact' || car.kind === 'van' ? 0.8 : 1) * vol;
      set(e.g.gain, (0.035 + thr * 0.05) * loud * (car.sputter > 0 ? 0.25 : 1), 0.05);
      set(e.amG.gain, (0.012 + thr * 0.02) * loud, 0.05);
      set(e.lp.frequency, 260 + thr * 1500 + r.rpm * 0.18, 0.06);
      e.nf.frequency.setTargetAtTime(350 + r.rpm * 0.25, t, 0.08); set(e.ng.gain, (0.006 + thr * 0.03) * loud, 0.06);
      const turbo = car.tune && car.tune.turbo;
      e.tw.frequency.setTargetAtTime(1600 + r.rpm * 0.55, t, 0.08); set(e.tg.gain, turbo ? thr * 0.012 * Math.min(1, r.rpm / 4000) * vol : 0, 0.15);
      if (vol >= 1) {
        if (r.gear !== e.gear && /\d/.test(r.gear) && /\d/.test(e.gear) && +r.gear > +e.gear) {
          e.g.gain.cancelScheduledValues(t); e.g.gain.setValueAtTime(e.g.gain.value * 0.35, t); e.g.gain.linearRampToValueAtTime((0.035 + thr * 0.05) * loud, t + 0.14);
          const g = this.out(null, null, 0.12); if (g) this.noise(g, t, 0.05, 'bandpass', 900, 400, 2, 0.6);
        }
        if (e.thr > 0.6 && thr < 0.1 && r.rpm > 3200) {
          const g = this.out(null, null, 0.2);
          if (g && turbo) this.noise(g, t, 0.35, 'highpass', 2500, 5000, 0.7, 0.5);
          else if (g && (car.kind === 'muscle' || car.kind === 'super' || car.kind === 'sport')) for (let k = 0; k < 4; k++) this.noise(g, t + 0.05 + Math.random() * 0.4, 0.03, 'lowpass', 1400, 300, 1, 0.9);
        }
      }
      e.gear = r.gear; e.thr = thr;
    }
    startAmbience() {
      this.hum = this.loop(this.brown, 'lowpass', 380, 0.7, 0.05);
      this.rainL = this.loop(this.white, 'bandpass', 3200, 0.3, 0);
      this.rainLow = this.loop(this.brown, 'lowpass', 900, 0.5, 0);
      this.windL = this.loop(this.white, 'bandpass', 420, 2, 0);
      const c = this.ctx;
      // German two-tone siren (Martinshorn): brass-like tone, band-limited, switched between A4 and D5
      this.sirenO = c.createOscillator(); this.sirenO.type = 'sawtooth'; this.sirenO.frequency.value = 440;
      this.sirenO2 = c.createOscillator(); this.sirenO2.type = 'triangle'; this.sirenO2.frequency.value = 880;
      const sb = c.createBiquadFilter(); sb.type = 'bandpass'; sb.frequency.value = 1050; sb.Q.value = 0.9;
      this.sirenLP = c.createBiquadFilter(); this.sirenLP.type = 'lowpass'; this.sirenLP.frequency.value = 2600;
      const s2g = c.createGain(); s2g.gain.value = 0.35;
      this.sirenG = c.createGain(); this.sirenG.gain.value = 0; this.sirenP = c.createStereoPanner();
      this.sirenO.connect(sb); this.sirenO2.connect(s2g); s2g.connect(sb); sb.connect(this.sirenLP); this.sirenLP.connect(this.sirenG); this.sirenG.connect(this.sirenP); this.sirenP.connect(this.sfx);
      this.sirenO.start(); this.sirenO2.start();
      // engines: your car and the nearest one in traffic
      this.eng = this.mkEngine(); this.engT = this.mkEngine();
      // club bass when inside clubs/bars
      this.clubT = 0; this.critT = 0; this.gullT = 0; this.heartT = 0;
    }
    update(dt, w, game) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime, p = w.player;
      this.lx = game.renderer.cam.x; this.ly = game.renderer.cam.y;
      const b = w.bldAt(p.x, p.y);
      this.inside = b >= 0 && !p.inCar;
      const wx = w.weather;
      this.wet = game.renderer.wet;
      const set = (param, v, tc = 0.3) => param.setTargetAtTime(v, t, tc);
      const night = w.daylight() < 0.4;
      set(this.hum.g.gain, (night ? 0.025 : 0.055) * (this.inside ? 0.4 : 1));
      set(this.rainL.g.gain, wx.rain * (this.inside ? 0.04 : 0.11));
      set(this.rainL.f.frequency, this.inside ? 900 : 3200);
      set(this.rainLow.g.gain, wx.rain * (this.inside ? 0.08 : 0.05));
      set(this.windL.g.gain, (wx.wind - 0.3) * 0.05 + (w.districtAt(p.x, p.y) === 'docks' ? 0.02 : 0));
      set(this.windL.f.frequency, 300 + Math.sin(t * 0.3) * 120);
      // nearest siren — two-tone with doppler and distance filtering
      let sd = 1e9, sc = null;
      for (const car of w.cars) if (car.siren && !car.dead) { const d = Math.hypot(car.x - this.lx, car.y - this.ly); if (d < sd) { sd = d; sc = car; } }
      if (sc && sd < 2600) {
        const own = p.inCar === sc.id;
        const dx = this.lx - sc.x, dy = this.ly - sc.y, dd = Math.max(1, sd);
        const vr = ((sc.vx || 0) * dx + (sc.vy || 0) * dy) / dd * 0.07;
        const dop = own ? 1 : U.clamp(343 / (343 - vr), 0.85, 1.18);
        const hi = Math.floor((t + sc.id * 0.37) / 0.68) % 2;
        const f = (hi ? 587.3 : 440) * dop;
        this.sirenO.frequency.setTargetAtTime(f, t, 0.012); this.sirenO2.frequency.setTargetAtTime(f * 2, t, 0.012);
        const k = 1 - sd / 2600;
        set(this.sirenG.gain, own ? 0.012 : 0.03 * k * k, 0.08);
        set(this.sirenLP.frequency, own ? 1400 : 900 + k * 2200, 0.1);
        set(this.sirenP.pan, own ? 0 : U.clamp((sc.x - this.lx) / 700, -1, 1), 0.1);
      } else set(this.sirenG.gain, 0, 0.2);
      // engines
      const car = p.inCar ? w.carOf(p) : null;
      this.engineVoice(this.eng, car && car.engineOn !== false ? car : null, 1, t, set);
      let tc = null, td = 700;
      for (const q of w.cars) { if (q === car || q.dead || !q.driver || (q.speed || 0) < 15) continue; const d = Math.hypot(q.x - this.lx, q.y - this.ly); if (d < td) { td = d; tc = q; } }
      this.engineVoice(this.engT, tc, tc ? Math.pow(1 - td / 700, 2) * 0.45 : 0, t, set);
      if (tc) set(this.engT.pan.pan, U.clamp((tc.x - this.lx) / 600, -1, 1), 0.1);
      // critters
      const dist = w.districtAt(p.x, p.y);
      this.critT -= dt; this.gullT -= dt; this.heartT -= dt; this.clubT -= dt;
      if (night && wx.rain < 0.3 && (dist === 'park' || dist === 'res' || dist === 'hill') && this.critT <= 0) {
        this.critT = 0.4 + Math.random() * 1.6;
        const g = this.out(this.lx + U.rnd(-500, 500), this.ly + U.rnd(-400, 400), 0.05, 800);
        if (g) for (let k = 0; k < 3; k++) this.tone(g, t + k * 0.06, 0.04, 'sine', 4300 + Math.random() * 300, null, 0.4);
      }
      if (!night && dist === 'docks' && this.gullT <= 0) {
        this.gullT = 3 + Math.random() * 8;
        const g = this.out(this.lx + U.rnd(-600, 600), this.ly + U.rnd(-500, 500), 0.08, 1000);
        if (g) for (let k = 0; k < 3; k++) { const o = this.tone(g, t + k * 0.22, 0.2, 'sine', 1500, 900, 0.3, 0.02); void o; }
      }
      if (b >= 0 && (w.buildings[b].type === 'club' || w.buildings[b].type === 'bar') && this.clubT <= 0) {
        const club = w.buildings[b].type === 'club';
        this.clubT = club ? 0.5 : 2.5;
        const g = this.out(null, null, club ? 0.25 : 0.06);
        if (g) { if (club) { this.tone(g, t, 0.18, 'sine', 70, 40, 0.9); this.noise(g, t + 0.25, 0.05, 'highpass', 6000, null, 1, 0.3); } else this.tone(g, t, 1.6, 'triangle', U.pick([220, 247, 262, 294, 330]), null, 0.15, 0.05); }
      }
      if (p.alive && p.hp < 30 && this.heartT <= 0) { this.heartT = 0.85; this.ui('heart'); }
      // music mood
      let m = 0;
      if (w.wanted >= 2 || w.actors.some((a) => a.state === 'hostile' && a.alive && a.seesPlayer)) m = 2;
      else if (w.wanted >= 1 || w.zoneAt(p.x, p.y) >= 0 || w.actors.some((a) => a.alive && (a.susp > 0.3 || a.state === 'search') && Math.abs(a.x - p.x) < 600 && Math.abs(a.y - p.y) < 600)) m = 1;
      if (m >= this.mood) { this.mood = m; this.moodT = 6; } else { this.moodT -= dt; if (this.moodT <= 0) this.mood = m; }
      this.night = night;
      if (this.music && game.settings.music) this.music.tick(this.mood, night, p.alive);
    }
  }

  // ================================================================ generative score
  const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // A minor noir progression (jazzy voicings)
  const PROG = [
    { root: 45, ch: [57, 60, 64, 67, 71] },   // Am9
    { root: 50, ch: [60, 62, 65, 69, 72] },   // Dm9
    { root: 41, ch: [57, 60, 64, 65, 69] },   // Fmaj7#11-ish
    { root: 40, ch: [56, 59, 62, 65, 68] },   // E7b9
  ];
  class Music {
    constructor(a) {
      this.a = a; const c = a.ctx;
      this.bus = { calm: c.createGain(), tense: c.createGain(), fight: c.createGain() };
      for (const k in this.bus) { this.bus[k].gain.value = 0; this.bus[k].connect(a.musicBus); }
      const rv = c.createGain(); rv.gain.value = 0.35; this.bus.calm.connect(rv); rv.connect(a.verbIn);
      this.next = c.currentTime + 0.2; this.step = 0; this.bar = 0;
      this.mood = 0;
    }
    tick(mood, night, alive) {
      const a = this.a, c = a.ctx, t = c.currentTime;
      const tgt = alive ? [mood === 0 ? 1 : 0, mood === 1 ? 1 : 0, mood === 2 ? 1 : 0] : [0, 0, 0];
      this.bus.calm.gain.setTargetAtTime(tgt[0] * 0.55, t, 1.2);
      this.bus.tense.gain.setTargetAtTime(tgt[1] * 0.6, t, 0.8);
      this.bus.fight.gain.setTargetAtTime(tgt[2] * 0.6, t, 0.4);
      this.mood = mood; this.night = night;
      const bpm = mood === 2 ? 132 : night ? 68 : 84;
      const sixteenth = 60 / bpm / 4;
      while (this.next < t + 0.15) { this.play(this.next, sixteenth); this.next += sixteenth; this.step = (this.step + 1) % 16; if (!this.step) this.bar++; }
    }
    play(t, s) {
      const a = this.a, st = this.step, chord = PROG[Math.floor(this.bar / (this.mood === 2 ? 1 : 2)) % 4];
      const swing = st % 2 ? s * 0.18 : 0;
      const T = t + swing;
      // ---- calm: rhodes, upright bass, brushes
      if (this.bus.calm.gain.value > 0.01 || this.mood === 0) {
        const B = this.bus.calm;
        if (st === 0 || (st === 10 && Math.random() < 0.6) || (st === 6 && Math.random() < 0.3)) this.rhodes(B, T, chord.ch, this.night ? 0.05 : 0.06);
        if (st % 4 === 0) { const walk = [chord.root, chord.root + 7, chord.root + 3 + (Math.random() < 0.5 ? 0 : 2), chord.root + 5 + (Math.random() < 0.5 ? 0 : 2)]; this.bass(B, T, NOTE(walk[st / 4] - 12 + 12), 0.28); }
        if (st === 4 || st === 12) a.noise(B, T, 0.18, 'bandpass', 3200, 1800, 0.8, 0.06);
        if (st % 2 === 0 || (st % 4 === 3)) a.noise(B, T, 0.06, 'highpass', 7500, null, 1, st % 4 === 0 ? 0.05 : 0.03);
        if (this.night && st === 0 && this.bar % 2 === 0 && Math.random() < 0.7) this.horn(B, T, chord, s);
      }
      // ---- tense: drone, pulsing bass, ticks, tremolo strings
      if (this.bus.tense.gain.value > 0.01 || this.mood === 1) {
        const B = this.bus.tense;
        if (st === 0 && this.bar % 2 === 0) this.pad(B, T, [chord.root - 12, chord.root - 5, chord.root + 3], s * 32, 0.05);
        if (st % 2 === 0) this.bass(B, T, NOTE(chord.root - 12), 0.18, 0.12);
        if (st % 4 === 2) a.noise(B, T, 0.03, 'highpass', 6000, null, 1, 0.06);
        if (st === 0) a.tone(B, T, 0.4, 'sine', 55, 40, 0.35);
      }
      // ---- fight: driving bass, drums, stabs
      if (this.bus.fight.gain.value > 0.01 || this.mood === 2) {
        const B = this.bus.fight;
        this.bass(B, T, NOTE(chord.root - 12 + (st % 8 === 7 ? 7 : 0)), 0.22, 0.09, 'sawtooth');
        if (st % 4 === 0) { a.tone(B, T, 0.22, 'sine', 120, 42, 0.9); }
        if (st === 4 || st === 12) a.noise(B, T, 0.15, 'bandpass', 1800, 900, 0.8, 0.45);
        if (st % 2 === 1) a.noise(B, T, 0.04, 'highpass', 8000, null, 1, 0.12);
        if (st === 14 || st === 15) a.tone(B, T, 0.25, 'sine', 180 - (st - 14) * 40, 70, 0.5);
        if (st === 0 && this.bar % 2 === 0) for (const n of chord.ch.slice(0, 3)) a.tone(B, T, 0.3, 'sawtooth', NOTE(n), null, 0.05);
      }
    }
    rhodes(B, t, notes, g) {
      const a = this.a, c = a.ctx;
      for (const n of notes) {
        const f = NOTE(n + (Math.random() < 0.5 ? 0 : 0));
        const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), env = c.createGain();
        car.frequency.value = f; mod.frequency.value = f * 2; mg.gain.setValueAtTime(f * 1.4, t); mg.gain.exponentialRampToValueAtTime(f * 0.1, t + 0.8);
        mod.connect(mg); mg.connect(car.frequency);
        env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(g, t + 0.01); env.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
        car.connect(env); env.connect(B);
        car.start(t); mod.start(t); car.stop(t + 2.3); mod.stop(t + 2.3);
      }
    }
    bass(B, t, f, g, dur = 0.5, type = 'triangle') {
      const a = this.a, c = a.ctx, o = c.createOscillator(), fl = c.createBiquadFilter(), e = c.createGain();
      o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(type === 'sawtooth' ? 900 : 600, t); fl.frequency.exponentialRampToValueAtTime(180, t + dur);
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(fl); fl.connect(e); e.connect(B); o.start(t); o.stop(t + dur + 0.05);
    }
    pad(B, t, notes, dur, g) {
      const a = this.a, c = a.ctx;
      for (const n of notes) for (const det of [-6, 6]) {
        const o = c.createOscillator(), fl = c.createBiquadFilter(), e = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
        o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = det;
        fl.type = 'lowpass'; fl.frequency.value = 700;
        lfo.frequency.value = 5.5; lg.gain.value = g * 0.5; lfo.connect(lg); lg.connect(e.gain);
        e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + dur * 0.3); e.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(fl); fl.connect(e); e.connect(B); o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
      }
    }
    horn(B, t, chord, s) {
      const a = this.a, c = a.ctx;
      const scale = [0, 3, 5, 7, 10, 12].map((k) => chord.root + 24 + k);
      let tt = t;
      for (let k = 0; k < 4 + U.rint(3); k++) {
        const n = U.pick(scale), dur = s * (2 + U.rint(4));
        const o = c.createOscillator(), fl = c.createBiquadFilter(), e = c.createGain(), vib = c.createOscillator(), vg = c.createGain();
        o.type = 'sawtooth'; o.frequency.value = NOTE(n); vib.frequency.value = 5; vg.gain.value = 4; vib.connect(vg); vg.connect(o.frequency);
        fl.type = 'lowpass'; fl.frequency.value = 1500; fl.Q.value = 2;
        e.gain.setValueAtTime(0.0001, tt); e.gain.linearRampToValueAtTime(0.045, tt + 0.06); e.gain.setValueAtTime(0.04, tt + dur * 0.8); e.gain.exponentialRampToValueAtTime(0.0001, tt + dur * 1.2);
        o.connect(fl); fl.connect(e); e.connect(B); o.start(tt); vib.start(tt); o.stop(tt + dur * 1.3); vib.stop(tt + dur * 1.3);
        tt += dur;
      }
    }
  }
  K.Audio = Audio;
})(globalThis.K = globalThis.K || {});
