/* RDE // KONTRAKT — procedural audio: spatial SFX, ambience, sirens, engines, generative noir score (no assets) */
(function (K) {
  'use strict';
  const U = K.U, TILE = K.TILE;

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
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
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
    gun(x, y, w, sup) {
      const c = this.ctx, t = c.currentTime, d = K.WEAPONS[w] || K.WEAPONS.p9;
      if (sup) {
        const g = this.out(x, y, 0.35, 700); if (!g) return;
        this.noise(g, t, 0.07, 'bandpass', 1400, 600, 1.5, 0.9);
        this.tone(g, t, 0.03, 'square', 1800, 900, 0.12);
        this.noise(g, t + 0.02, 0.05, 'highpass', 4000, null, 0.7, 0.3);
        return;
      }
      const cls = d.cls;
      const g = this.out(x, y, cls === 'sniper' ? 1.1 : cls === 'shotgun' ? 1.0 : cls === 'rifle' ? 0.85 : 0.75, 3400);
      if (!g) return;
      const far = U.clamp(g.dist / 2500, 0, 1);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000 - far * 7600; lp.connect(g);
      const dec = { pistol: 0.16, smg: 0.1, shotgun: 0.38, rifle: 0.2, sniper: 0.55 }[cls] || 0.18;
      this.noise(lp, t, dec, 'bandpass', cls === 'shotgun' ? 700 : 1300, 200, 0.6, 1.2);
      this.noise(lp, t, 0.025, 'highpass', 3000, null, 0.5, 0.9);
      this.tone(lp, t, dec * 0.9, 'sine', cls === 'shotgun' || cls === 'sniper' ? 95 : 150, 40, 0.9);
      if (w === 'magnum') this.tone(lp, t, 0.3, 'sine', 80, 35, 0.8);
      this.send(lp, 0.35 + far * 0.4 + (this.inside ? -0.15 : 0.1));
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
        case 'shot': this.gun(e.x, e.y, e.w, e.sup); break;
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
        case 'step': if (Math.abs(e.x - this.lx) < 500 && Math.abs(e.y - this.ly) < 500) this.step(e.x, e.y, e.surf, e.run, e.player, e.crouch); break;
        case 'door': if (this.rate('door', 0.15)) { const g = this.out(e.x, e.y, 0.18, 400); if (g) { this.tone(g, t, 0.08, 'sine', 160, 100, 0.5); this.noise(g, t, 0.15, 'bandpass', 600, 300, 2, 0.2); } } break;
        case 'scream': this.scream(e.x, e.y, e.female); break;
        case 'struggle': { const g = this.out(e.x, e.y, 0.25, 400); if (g) { this.noise(g, t, 0.2, 'lowpass', 300, null, 1, 0.6); if (Math.random() < 0.5) this.tone(g, t, 0.15, 'sawtooth', 140, 110, 0.08); } break; }
        case 'takedown': if (e.stage === 'start') { const g = this.out(e.x, e.y, 0.3, 400); if (g) this.noise(g, t, 0.25, 'bandpass', 800, 300, 1, 0.6); } break;
        case 'coinLand': case 'clink': { const g = this.out(e.x, e.y, 0.3, 900); if (g) { this.tone(g, t, 0.15, 'sine', 2600, null, 0.25); this.tone(g, t + 0.07, 0.2, 'sine', 3300, null, 0.18); } break; }
        case 'throw': { const g = this.out(e.x, e.y, 0.2, 300); if (g) this.noise(g, t, 0.15, 'bandpass', 800, 2000, 1, 0.5); break; }
        case 'crash': { const g = this.out(e.x, e.y, U.clamp(e.v / 300, 0.3, 1), 1400); if (!g) break; this.noise(g, t, 0.35, 'lowpass', 1500, 200, 0.7, 1.2); for (let k = 0; k < 5; k++) this.tone(g, t + Math.random() * 0.15, 0.2, 'triangle', 600 + Math.random() * 1500, null, 0.12); if (Math.random() < 0.5) this.noise(g, t + 0.05, 0.3, 'highpass', 3000, null, 1, 0.3); break; }
        case 'carHit': this.flesh(e.x, e.y, true); break;
        case 'honk': { const g = this.out(e.x, e.y, 0.35, 1400); if (g) { this.tone(g, t, 0.45, 'square', 420, null, 0.12, 0.01); this.tone(g, t, 0.45, 'square', 530, null, 0.1, 0.01); } break; }
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
    startAmbience() {
      this.hum = this.loop(this.brown, 'lowpass', 380, 0.7, 0.05);
      this.rainL = this.loop(this.white, 'bandpass', 3200, 0.3, 0);
      this.rainLow = this.loop(this.brown, 'lowpass', 900, 0.5, 0);
      this.windL = this.loop(this.white, 'bandpass', 420, 2, 0);
      // siren
      const c = this.ctx;
      this.sirenO = c.createOscillator(); this.sirenO.type = 'sawtooth'; this.sirenO.frequency.value = 700;
      this.sirenLfo = c.createOscillator(); this.sirenLfo.frequency.value = 0.45; const lg = c.createGain(); lg.gain.value = 260; this.sirenLfo.connect(lg); lg.connect(this.sirenO.frequency);
      const sf = c.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 1800;
      this.sirenG = c.createGain(); this.sirenG.gain.value = 0; this.sirenP = c.createStereoPanner();
      this.sirenO.connect(sf); sf.connect(this.sirenG); this.sirenG.connect(this.sirenP); this.sirenP.connect(this.sfx);
      this.sirenO.start(); this.sirenLfo.start();
      // engine
      this.engO = c.createOscillator(); this.engO.type = 'sawtooth'; this.engO.frequency.value = 40;
      this.engO2 = c.createOscillator(); this.engO2.type = 'square'; this.engO2.frequency.value = 20;
      const ef = c.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 500; this.engF = ef;
      this.engG = c.createGain(); this.engG.gain.value = 0;
      this.engO.connect(ef); this.engO2.connect(ef); ef.connect(this.engG); this.engG.connect(this.sfx);
      this.engO.start(); this.engO2.start();
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
      // nearest siren
      let sd = 1e9, sx = 0;
      for (const car of w.cars) if (car.siren && !car.dead) { const d = Math.hypot(car.x - this.lx, car.y - this.ly); if (d < sd) { sd = d; sx = car.x; } }
      set(this.sirenG.gain, sd < 2500 ? 0.07 * Math.pow(1 - sd / 2500, 2) : 0, 0.1);
      set(this.sirenP.pan, U.clamp((sx - this.lx) / 700, -1, 1), 0.1);
      // engine
      const car = p.inCar ? w.carOf(p) : null;
      if (car) {
        const rpm = 1 + Math.abs(car.vf || 0) / 120 % 3.2 + Math.abs(car.thr) * 0.4;
        set(this.engO.frequency, 32 * rpm, 0.06); set(this.engO2.frequency, 16 * rpm, 0.06);
        set(this.engF.frequency, 300 + Math.abs(car.thr) * 900 + (car.speed || 0) * 0.8, 0.08);
        set(this.engG.gain, 0.06 + Math.abs(car.thr) * 0.05, 0.08);
      } else set(this.engG.gain, 0, 0.15);
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
