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
    'b-v8': [1, 2, 3, 4, 5, 6, 7, 8], ds8: [0, 1, 2, 3, 4, 5], electric: [0, 1, 3, 7], 'ct-v8': [1, 2, 3, 4, 5, 6, 7],
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
    /** a sampled engine voice: one looping recording per rpm step (crossfaded by rpm), then
     *  bass shelf → exhaust rasp → load filter → gentle saturation; plus turbo whistle and air */
    mkEngine(series) {
      const c = this.a.ctx, steps = SERIES[series]; if (!steps) return null;
      const bf = (type, f, q, g) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (g != null) b.gain.value = g; return b; };
      const e = { series, steps: [], mix: c.createGain(), bass: bf('lowshelf', 140, 0.7, 3), rasp: bf('peaking', 2300, 0.9, 0), lp: bf('lowpass', 6000, 0.6), sat: c.createWaveShaper(), out: c.createGain(), pan: c.createStereoPanner(), shots: 0, bovs: 0 };
      const big = /v8|v12/.test(series);
      e.bass.gain.value = big ? 5 : series === 'ds8' ? 4 : 2;
      e.sat.curve = this.soft || (this.soft = (() => { const a = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; a[i] = Math.tanh(x * 1.4) / Math.tanh(1.4); } return a; })());
      e.out.gain.value = 0;
      e.mix.connect(e.bass); e.bass.connect(e.rasp); e.rasp.connect(e.lp); e.lp.connect(e.sat); e.sat.connect(e.out); e.out.connect(e.pan); e.pan.connect(this.a.sfx);
      for (const n of steps) {
        const b = this.buf[`e:${series}:${n}`]; if (!b) continue;
        const s = c.createBufferSource(), g = c.createGain();
        s.buffer = b; s.loop = true; s.loopStart = PAD; s.loopEnd = b.duration - PAD; g.gain.value = 0;
        s.connect(g); g.connect(e.mix); s.start(c.currentTime + Math.random() * 0.05, PAD + Math.random() * (b.duration - 2 * PAD));
        e.steps.push({ rpm: n === 0 ? 700 : n * 1000, s, g });
      }
      if (!e.steps.length) return null;
      // turbo: a whistle that climbs with boost (the compressor wheel) and the rush of air
      e.tw = c.createOscillator(); e.tw.type = 'sine'; e.tw.frequency.value = 3000;
      e.tw2 = c.createOscillator(); e.tw2.type = 'sine'; e.tw2.frequency.value = 4500;
      e.twg = c.createGain(); e.twg.gain.value = 0; const t2g = c.createGain(); t2g.gain.value = 0.35;
      e.tw.connect(e.twg); e.tw2.connect(t2g); t2g.connect(e.twg); e.twg.connect(e.pan); e.tw.start(); e.tw2.start();
      if (this.buf.turbo2) {
        const s = c.createBufferSource(), g = c.createGain(), f = bf('bandpass', 3500, 0.8); s.buffer = this.buf.turbo2; s.loop = true; g.gain.value = 0;
        s.connect(f); f.connect(g); g.connect(e.pan); s.start(); e.air = { s, g, f };
      }
      return e;
    }
    killEngine(e) {
      if (!e) return;
      const t = this.a.ctx.currentTime;
      for (const st of e.steps) { st.g.gain.setTargetAtTime(0, t, 0.05); try { st.s.stop(t + 0.4); } catch (x) { /* already stopped */ } }
      for (const o of [e.tw, e.tw2, e.air && e.air.s]) if (o) try { o.stop(t + 0.4); } catch (x) { /* already stopped */ }
      e.twg.gain.setTargetAtTime(0, t, 0.05);
      e.out.gain.setTargetAtTime(0, t, 0.05);
    }
    /** drive the voice. st: rpm, load (0 = overrun … 1 = full throttle), red, lim, boost, sporty, pipe */
    engineSet(e, st, vol, t) {
      const S = e.steps, last = S.length - 1;
      const rpm = U.clamp(st.rpm, S[0].rpm * 0.7, S[last].rpm * 1.35);
      let i = 0; while (i < last && S[i + 1].rpm <= rpm) i++;
      const j = Math.min(last, i + 1), f = j === i ? 0 : U.clamp((rpm - S[i].rpm) / (S[j].rpm - S[i].rpm), 0, 1);
      for (let k = 0; k <= last; k++) {
        const w = k === i ? Math.cos(f * Math.PI / 2) : k === j ? Math.sin(f * Math.PI / 2) : 0;
        S[k].g.gain.setTargetAtTime(w, t, 0.03);
        if (w > 0.001) S[k].s.playbackRate.setTargetAtTime(rpm / S[k].rpm, t, 0.025);
      }
      const L = st.load, hi = U.clamp(rpm / (st.red || 7000), 0, 1.1), pipe = st.pipe || 0;
      // on the throttle the engine barks; off it (overrun) it goes hollow and quiet
      let g = vol * (0.42 + 0.58 * L) * (0.5 + 0.5 * hi) * (1 + pipe * 0.25) * 0.62;
      if (st.lim && Math.random() < 0.5) g *= 0.55;   // rev limiter stutter
      e.out.gain.setTargetAtTime(g, t, st.lim ? 0.008 : 0.045);
      e.lp.frequency.setTargetAtTime(U.lerp(1500 + rpm * 0.35, 5200 + rpm * 0.9 + pipe * 2500, L), t, 0.05);
      e.rasp.gain.setTargetAtTime(L * ((st.sporty ? 4.5 : 2) + pipe * 2.5) * hi, t, 0.06);
      const b = st.boost || 0;
      e.twg.gain.setTargetAtTime(vol * Math.pow(b, 1.6) * 0.035, t, 0.08);
      const tf = 2100 + b * 3200 + rpm * 0.12; e.tw.frequency.setTargetAtTime(tf, t, 0.12); e.tw2.frequency.setTargetAtTime(tf * 1.5, t, 0.12);
      if (e.air) { e.air.g.gain.setTargetAtTime(vol * b * 0.12, t, 0.1); e.air.f.frequency.setTargetAtTime(2200 + b * 3500, t, 0.1); e.air.s.playbackRate.setTargetAtTime(0.8 + b * 0.6, t, 0.1); }
    }
    /** blow-off valve: "pssscht" — or the compressor surge flutter "stu-tu-tu-tu" without one */
    blowOff(e, t, amt, flutter) {
      const c = this.a.ctx, n = this.a.white; if (!n) return;
      const s = c.createBufferSource(), f = c.createBiquadFilter(), h = c.createBiquadFilter(), g = c.createGain();
      s.buffer = n; s.playbackRate.value = 1; f.type = 'bandpass'; f.Q.value = flutter ? 1.6 : 0.8; h.type = 'highpass'; h.frequency.value = flutter ? 500 : 1200;
      const dur = flutter ? 0.55 : 0.42, a = Math.min(1, amt) * (flutter ? 0.3 : 0.2);
      f.frequency.setValueAtTime(flutter ? 1500 : 4200, t); f.frequency.exponentialRampToValueAtTime(flutter ? 800 : 1700, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.012);
      if (flutter) { let q = t + 0.012, k = 0; while (q < t + dur) { const v = a * Math.exp(-(q - t) * 4.5); g.gain.setValueAtTime(v, q); g.gain.setValueAtTime(v * 0.12, q + 0.022); q += 0.042 + k * 0.004; k++; } g.gain.setValueAtTime(0.0001, t + dur); }
      else g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(h); h.connect(f); f.connect(g); g.connect(e.pan); s.start(t); s.stop(t + dur + 0.05);
    }
    /** overrun crackle: unburnt fuel popping in the exhaust */
    pop(e, t, amt) {
      const c = this.a.ctx, n = this.a.white; if (!n) return;
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = n; s.playbackRate.value = 0.6 + Math.random() * 0.8; f.type = 'bandpass'; f.frequency.value = 500 + Math.random() * 1500; f.Q.value = 1.1;
      const d = 0.012 + Math.random() * 0.03;
      g.gain.setValueAtTime(amt, t); g.gain.exponentialRampToValueAtTime(0.0005, t + d);
      s.connect(f); f.connect(g); g.connect(e.pan); s.start(t, Math.random() * 1.5); s.stop(t + d + 0.02);
      const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110 + Math.random() * 60, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.05);
      og.gain.setValueAtTime(amt * 0.9, t); og.gain.exponentialRampToValueAtTime(0.0005, t + 0.06);
      o.connect(og); og.connect(e.pan); o.start(t); o.stop(t + 0.08);
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
