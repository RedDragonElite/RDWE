/* RDE // KONTRAKT — recorded sound: real engine recordings (rpm-stepped loops, crossfaded by the
 * engine speed), metal crash hits, turbo, gear shifts — plus physically modelled gunshot buffers
 * (Friedlander blast wave, microphone overload, street reflections, urban reverb tail) rendered once
 * at start-up. Credits: sfx/CREDITS.md. Missing files (e.g. opened via file://) fall back to synthesis. */
(function (K) {
  'use strict';
  const U = K.U;

  // engine loops: series → rpm steps (×1000; 0 = idle ≈ 700 rpm). Each file: 0.15 s pad · loop · 0.15 s pad
  const SERIES = {
    'su-mid': [1, 2, 3, 4, 5, 6, 7, 8], 'su-ss': [1, 2, 3, 4, 5, 6, 7, 8], 'b-i6r': [1, 2, 3, 4, 5, 6, 7, 8],
    gv8: [1, 2, 3, 4, 5, 6, 7], v8f: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], v12d: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    'b-v8': [1, 2, 3, 4, 5, 6, 7, 8], ds8: [0, 1, 2, 3, 4, 5], electric: [0, 1, 3, 7],
  };
  K.ENGINE_SERIES = {
    compact: 'su-mid', coupe: 'su-ss', sedan: 'b-i6r', taxi: 'b-i6r', police: 'b-i6r', muscle: 'gv8', sport: 'v8f',
    super: 'v12d', suv: 'b-v8', pickup: 'ds8', van: 'ds8', ambulance: 'ds8', ev: 'electric',
  };
  const PAD = 0.15;

  class Samples {
    constructor(audio) { this.a = audio; this.buf = {}; this.loops = {}; this.ready = false; this.guns = {}; }
    async load() {
      const c = this.a.ctx, base = 'sfx/';
      const get = async (key, path) => {
        try {
          const r = await fetch(base + path); if (!r.ok) return;
          this.buf[key] = await c.decodeAudioData(await r.arrayBuffer());
        } catch (e) { /* file:// or offline → synthesis stays */ }
      };
      const jobs = [];
      for (const s in SERIES) for (const n of SERIES[s]) jobs.push(get(`e:${s}:${n}`, `engines/${s}-${n}.mp3`));
      for (let k = 1; k <= 12; k++) jobs.push(get(`crash${k}`, `car/crash${String(k).padStart(2, '0')}.mp3`));
      for (const f of ['turbo2', 'turbo4', 'gear_shift1', 'gear_shift4a']) jobs.push(get(f, `car/${f}.mp3`));
      await Promise.all(jobs);
      this.ready = Object.keys(this.buf).some((k) => k.startsWith('e:'));
    }
    has(key) { return !!this.buf[key]; }
    /** one-shot */
    play(key, dst, t, gain = 1, rate = 1) {
      const b = this.buf[key]; if (!b) return null;
      const c = this.a.ctx, s = c.createBufferSource(), g = c.createGain();
      s.buffer = b; s.playbackRate.value = rate; g.gain.value = gain;
      s.connect(g); g.connect(dst); s.start(t); return s;
    }

    // ------------------------------------------------------------ engines
    /** a sampled engine voice: one looping source per rpm step, weights crossfade with rpm */
    mkEngine(series) {
      const c = this.a.ctx, steps = SERIES[series]; if (!steps) return null;
      const e = { series, steps: [], out: c.createGain(), lp: c.createBiquadFilter(), pan: c.createStereoPanner(), sat: c.createWaveShaper() };
      e.lp.type = 'lowpass'; e.lp.frequency.value = 2400; e.lp.Q.value = 0.5; e.out.gain.value = 0;
      e.sat.curve = this.a.sat;
      e.lp.connect(e.sat); e.sat.connect(e.out); e.out.connect(e.pan); e.pan.connect(this.a.sfx);
      for (const n of steps) {
        const b = this.buf[`e:${series}:${n}`]; if (!b) continue;
        const s = c.createBufferSource(), g = c.createGain();
        s.buffer = b; s.loop = true; s.loopStart = PAD; s.loopEnd = b.duration - PAD; g.gain.value = 0;
        s.connect(g); g.connect(e.lp); s.start(c.currentTime + Math.random() * 0.05, PAD + Math.random() * 0.5);
        e.steps.push({ rpm: n === 0 ? 700 : n * 1000, s, g });
      }
      if (!e.steps.length) return null;
      // turbo whistle loop
      if (this.buf.turbo2) {
        const s = c.createBufferSource(), g = c.createGain(); s.buffer = this.buf.turbo2; s.loop = true; g.gain.value = 0;
        s.connect(g); g.connect(e.pan); s.start(); e.turbo = { s, g };
      }
      return e;
    }
    killEngine(e) {
      if (!e) return;
      const t = this.a.ctx.currentTime;
      for (const st of e.steps) { st.g.gain.setTargetAtTime(0, t, 0.05); try { st.s.stop(t + 0.4); } catch (x) { /* already stopped */ } }
      if (e.turbo) try { e.turbo.s.stop(t + 0.4); } catch (x) { /* already stopped */ }
      e.out.gain.setTargetAtTime(0, t, 0.05);
    }
    /** drive the voice: rpm → which two recordings and at what speed; throttle → load (level + brightness) */
    engineSet(e, rpm, thr, vol, t, turbo) {
      const S = e.steps, last = S.length - 1;
      rpm = U.clamp(rpm, S[0].rpm * 0.75, S[last].rpm * 1.08);
      let i = 0; while (i < last && S[i + 1].rpm <= rpm) i++;
      const j = Math.min(last, i + 1), f = j === i ? 0 : U.clamp((rpm - S[i].rpm) / (S[j].rpm - S[i].rpm), 0, 1);
      for (let k = 0; k <= last; k++) {
        const w = k === i ? Math.cos(f * Math.PI / 2) : k === j ? Math.sin(f * Math.PI / 2) : 0;
        S[k].g.gain.setTargetAtTime(w, t, 0.04);
        if (w > 0.001) S[k].s.playbackRate.setTargetAtTime(rpm / S[k].rpm, t, 0.04);
      }
      const load = 0.45 + 0.55 * thr;
      e.out.gain.setTargetAtTime(vol * load * 0.55, t, 0.06);
      e.lp.frequency.setTargetAtTime(900 + thr * 3800 + rpm * 0.25, t, 0.08);
      if (e.turbo) {
        e.turbo.g.gain.setTargetAtTime(turbo ? vol * thr * 0.18 * U.clamp((rpm - 2500) / 3000, 0, 1) : 0, t, 0.12);
        e.turbo.s.playbackRate.setTargetAtTime(0.7 + rpm / 9000, t, 0.1);
      }
    }

    // ------------------------------------------------------------ gunshots (physical model)
    /** render the gunshot buffers once: [near variants, far variant] per sound profile */
    buildGuns(GUNSND) {
      const c = this.a.ctx, sr = c.sampleRate;
      const rnd = (s) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      const render = (P, far, seed) => {
        const R = rnd(seed), len = Math.floor(sr * (far ? 2.6 : 1.4 + P.tail * 0.9)), out = new Float32Array(len);
        // 1) muzzle blast: a sharp Friedlander pulse (the crack) + a long one (the low boom) — no tones
        const fried = (td, n) => { const a = new Float32Array(Math.floor(td * 7 * sr)); for (let i = 0; i < a.length; i++) { const tt = i / sr; a[i] = (1 - tt / td) * Math.exp(-1.6 * tt / td); } return a; };
        const sharp = fried((0.0006 + 0.0007 * P.boom) * (far ? 2.5 : 1)), boom = fried((0.004 + 0.007 * P.boom) * (far ? 1.6 : 1));
        // 2) the ground bounce and a few facade reflections (each one duller than the last)
        const refl = [[0, 1]];
        refl.push([0.0015 + R() * 0.0012, -0.5]);
        for (let k = 0; k < 9; k++) refl.push([0.012 + R() * (far ? 0.25 : 0.12) * (1 + k * 0.4), (0.12 + R() * 0.2) * Math.exp(-k * 0.3) * (R() < 0.5 ? -1 : 1)]);
        const put = (src, t0, a, lp) => {
          const o = Math.floor(t0 * sr); let y = 0;
          for (let n = 0; n < src.length && o + n < len; n++) { y += (src[n] - y) * lp; out[o + n] += y * a; }
        };
        const t0s = P.snap && !far ? 0.0009 : 0;
        for (const [d, a] of refl) {
          put(sharp, d + t0s, a * (far ? 0.35 : 1), Math.max(0.06, (far ? 0.2 : 0.95) - d * 4));
          put(boom, d + t0s, a * 0.55 * P.boom, 0.04);
        }
        // supersonic crack (N-wave) arrives before the blast for rifles
        if (P.snap && !far) { const nl = Math.floor(sr * 0.0005); for (let n = 0; n < nl; n++) out[n] += (1 - 2 * n / nl) * 0.7 * P.snap; }
        // a short burst of broadband "flash" noise right at the muzzle
        for (let n = 0; n < Math.floor(sr * 0.012) && !far; n++) out[Math.floor(t0s * sr) + n] += (R() * 2 - 1) * 0.35 * Math.exp(-n / (sr * 0.0025));
        // diffuse tail: noise with exponential decay, darkening over time (high frequencies die first)
        const T60 = (far ? 2.2 : 1.1) * (0.7 + P.tail), k = 6.9 / T60;
        let y1 = 0, y2 = 0;
        const t0 = 0.02;
        for (let n = Math.floor(t0 * sr); n < len; n++) {
          const tt = n / sr, env = Math.exp(-(tt - t0) * k) * (1 - Math.exp(-(tt - t0) * 60));
          const cut = U.clamp(0.5 * Math.exp(-(tt - t0) * 3.2), 0.01, 0.5) * (far ? 0.35 : 1);
          y1 += ((R() * 2 - 1) - y1) * cut; y2 += (y1 - y2) * cut;
          out[n] += y2 * env * 0.22 * (0.6 + P.boom * 0.5) * (P.echo || 1);
        }
        // microphone / ear overload: recorded gunshots are always clipped — soft-clip and normalise
        let pk = 0; for (let n = 0; n < len; n++) { out[n] = Math.tanh(out[n] * (far ? 1.4 : 2.2)); pk = Math.max(pk, Math.abs(out[n])); }
        // DC blocker
        let xp = 0, yp = 0; for (let n = 0; n < len; n++) { const x = out[n] / (pk || 1); yp = x - xp + 0.995 * yp; xp = x; out[n] = yp; }
        const ab = c.createBuffer(1, len, sr); ab.copyToChannel(out, 0); return ab;
      };
      for (const id in GUNSND) {
        const P = GUNSND[id];
        this.guns[id] = { near: [1, 2, 3].map((v) => render(P, false, 1000 + v * 77 + id.length)), far: render(P, true, 4242 + id.length) };
      }
    }
  }
  K.Samples = Samples;
})(globalThis.K = globalThis.K || {});
