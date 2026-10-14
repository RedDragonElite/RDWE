/* RDE // FRONTLINE — WebGL2 world renderer (pure JS, no libraries)
 *
 * One full-screen fragment shader paints the whole world per pixel:
 *  - smooth, noise-perturbed coastlines instead of tile pixels
 *  - height-field lighting (sun follows the day cycle), detail noise
 *  - animated water: depth gradient, wave normals, sun glints, shore foam
 *  - territories as smooth "majority" contours with glowing borders & inner glow
 *  - drifting volumetric-looking clouds that cast shadows
 * Falls back to the Canvas2D renderer when WebGL2 is unavailable.
 */
(function (BW) {
  'use strict';
  const C = BW.C, T = C.T;

  const VS = `#version 300 es
  in vec2 aPos;
  void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FS = `#version 300 es
  precision highp float;
  precision highp int;
  out vec4 outColor;
  uniform vec2 uRes;        // drawing buffer size (px)
  uniform vec3 uCam;        // camera centre (tiles) + zoom (buffer px per tile)
  uniform vec2 uMap;        // map size in tiles
  uniform float uTime, uNight, uDusk, uClouds, uCloudA;
  uniform vec3 uSun;
  uniform sampler2D uTerr;  // rgb: base colour, a: terrain id/7
  uniform sampler2D uData;  // r: height, g: water depth, b: land mask
  uniform sampler2D uOwn;   // rgb: owner colour, a: flags (0 none)

  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + 1.0), u.x), u.y);
  }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }

  vec4 own(ivec2 i) {
    ivec2 m = ivec2(uMap) - 1;
    return texelFetch(uOwn, clamp(i, ivec2(0), m), 0);
  }
  bool same(vec4 a, vec4 b) { return a.a > 0.0 == b.a > 0.0 && (a.a == 0.0 || distance(a.rgb, b.rgb) < 0.004); }

  void main() {
    vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 w = (px - uRes * 0.5) / uCam.z + uCam.xy;     // world position in tiles
    vec2 uv = w / uMap;
    float zoom = uCam.z;
    bool inside = all(greaterThanEqual(w, vec2(0.0))) && all(lessThan(w, uMap));

    vec4 d = texture(uData, clamp(uv, vec2(0.0), vec2(1.0)));
    if (!inside) d = vec4(0.0, 1.0, 0.0, 1.0);

    // ---------- land / water mask with organic coast
    float landN = d.b + (fbm(w * 0.85) - 0.5) * 0.42;
    float land = smoothstep(0.47, 0.53, landN);

    // ---------- terrain lighting
    vec2 tx = 1.0 / uMap;
    float hL = texture(uData, uv - vec2(tx.x, 0)).r, hR = texture(uData, uv + vec2(tx.x, 0)).r;
    float hU = texture(uData, uv - vec2(0, tx.y)).r, hD = texture(uData, uv + vec2(0, tx.y)).r;
    float det = fbm(w * 2.6);
    vec3 n = normalize(vec3((hL - hR) * 12.0 + (noise(w * 5.0) - 0.5) * 0.25, (hU - hD) * 12.0 + (noise(w * 5.0 + 9.0) - 0.5) * 0.25, 1.0));
    float diff = clamp(dot(n, uSun), 0.0, 1.0);
    vec4 tc = texture(uTerr, clamp(uv, vec2(0.0), vec2(1.0)));
    vec3 base = tc.rgb * (0.88 + 0.24 * det);
    float meadow = fbm(w * 0.07 + 3.0);                                           // regional colour drift
    base *= mix(vec3(1.08, 1.02, 0.82), vec3(0.86, 1.04, 0.98), meadow);
    float tid = tc.a * 7.0;
    // forests get canopy texture, mountains rock streaks
    base *= mix(1.0, 0.82 + 0.3 * noise(w * 9.0), smoothstep(3.5, 4.5, tid) * (1.0 - smoothstep(4.5, 5.5, tid)));
    base = mix(base, base * (0.8 + 0.35 * noise(vec2(w.x * 3.0, w.y * 12.0))), smoothstep(5.5, 6.5, tid));
    vec3 landCol = base * (0.42 + 0.78 * diff);
    landCol = mix(landCol * 0.72, landCol, smoothstep(0.53, 0.62, landN)); // wet sand rim

    // ---------- water
    float depth = d.g;
    vec2 q = w * 0.55;
    float t = uTime;
    float e = 0.15;
    float w1 = noise(q + vec2(t * 0.35, t * 0.22)) + 0.5 * noise(q * 2.3 - vec2(t * 0.28, -t * 0.4));
    float w2 = noise(q + vec2(e, 0) + vec2(t * 0.35, t * 0.22)) + 0.5 * noise((q + vec2(e, 0)) * 2.3 - vec2(t * 0.28, -t * 0.4));
    float w3 = noise(q + vec2(0, e) + vec2(t * 0.35, t * 0.22)) + 0.5 * noise((q + vec2(0, e)) * 2.3 - vec2(t * 0.28, -t * 0.4));
    vec3 wn = normalize(vec3((w1 - w2) * 0.7, (w1 - w3) * 0.7, 1.0));
    vec3 deep = vec3(0.02, 0.07, 0.17), mid = vec3(0.04, 0.24, 0.42), shallow = vec3(0.10, 0.52, 0.60);
    vec3 waterCol = mix(shallow, mid, smoothstep(0.0, 0.18, depth));
    waterCol = mix(waterCol, deep, smoothstep(0.18, 0.9, depth));
    waterCol *= 0.85 + 0.3 * dot(wn, uSun);
    float spec = pow(max(dot(reflect(-uSun, wn), vec3(0.0, 0.0, 1.0)), 0.0), 160.0);
    float glint = smoothstep(0.55, 0.8, noise(w * 0.9 + t * 0.6));          // sparse, drifting sparkle fields
    waterCol += spec * glint * mix(vec3(1.0, 0.95, 0.8), vec3(0.6, 0.7, 1.0), uNight) * (1.0 - uNight * 0.6) * 0.55;
    waterCol += vec3(0.02, 0.05, 0.07) * (fbm(w * 0.12 + t * 0.05) - 0.5);    // large-scale colour swell
    float shore = 1.0 - smoothstep(0.0, 0.11, depth + (1.0 - d.b) * 0.02);
    float foam = shore * smoothstep(0.35, 0.9, 0.5 + 0.5 * sin(depth * 70.0 - t * 2.2 + noise(w * 1.5) * 6.0)) * (0.55 + 0.45 * noise(w * 6.0 + t));
    foam += (1.0 - smoothstep(0.44, 0.49, landN)) * smoothstep(0.38, 0.47, landN) * 0.8;
    waterCol = mix(waterCol, vec3(0.92, 0.97, 1.0), clamp(foam, 0.0, 1.0) * 0.75);

    vec3 col = mix(waterCol, landCol, land);

    // ---------- territories: smooth majority contours
    vec2 pp = w - 0.5;
    ivec2 i0 = ivec2(floor(pp));
    vec2 f = fract(pp);
    vec4 c[4];
    c[0] = own(i0); c[1] = own(i0 + ivec2(1, 0)); c[2] = own(i0 + ivec2(0, 1)); c[3] = own(i0 + ivec2(1, 1));
    float wt[4];
    wt[0] = (1.0 - f.x) * (1.0 - f.y); wt[1] = f.x * (1.0 - f.y); wt[2] = (1.0 - f.x) * f.y; wt[3] = f.x * f.y;
    float sw[4];
    float best = -1.0, second = 0.0; int bi = 0;
    for (int a = 0; a < 4; a++) {
      float s = 0.0;
      for (int b = 0; b < 4; b++) if (same(c[a], c[b])) s += wt[b];
      sw[a] = s;
      if (s > best) { best = s; bi = a; }
    }
    for (int a = 0; a < 4; a++) if (!same(c[a], c[bi])) second = max(second, sw[a]);
    vec4 oc = c[bi];
    float edge = best - second;                       // 0 on a contour, → 1 deep inside
    // pick the owned side for the border colour
    vec4 bc = oc;
    if (oc.a == 0.0) for (int a = 0; a < 4; a++) if (c[a].a > 0.0) bc = c[a];
    float px1 = 1.0 / zoom;                            // one screen pixel in tiles
    float lw = max(0.07, 2.2 * px1);
    float border = 1.0 - smoothstep(lw, lw + max(0.05, 1.6 * px1), edge);
    if (!(second > 0.0)) border = 0.0;
    if (oc.a > 0.0) {
      float flag = oc.a;
      float hov = step(0.85, flag) * step(flag, 0.95);   // hovered owner
      float fillA = 0.30 + hov * 0.16;
      float inner = (1.0 - smoothstep(0.0, 0.85, edge)) * 0.32;   // inner glow toward the border
      col = mix(col, oc.rgb, (fillA + inner) * land);
      col += oc.rgb * 0.05 * land;
    }
    if (bc.a > 0.0) {
      vec3 bcol = mix(bc.rgb, vec3(1.0), 0.35);
      col = mix(col, bcol, border * 0.95);
      col += bc.rgb * border * 0.25;                      // emissive border
    }

    // ---------- clouds & their shadows
    if (uClouds > 0.5) {
      vec2 wind = vec2(t * 0.9, t * 0.35);
      float sh = smoothstep(0.52, 0.78, fbm((w + vec2(7.0, 9.0)) * 0.035 - wind * 0.035));
      col *= 1.0 - sh * 0.28 * (1.0 - uNight);
      float cl = smoothstep(0.52, 0.8, fbm(w * 0.035 - wind * 0.035));
      col = mix(col, mix(vec3(1.0), vec3(0.35, 0.4, 0.55), uNight), cl * uCloudA);
    }

    // ---------- time of day
    col = mix(col, col * vec3(1.18, 0.86, 0.62), uDusk * 0.45);
    col *= mix(vec3(1.0), vec3(0.22, 0.30, 0.55), uNight * 0.85);
    if (!inside) col *= 0.55;

    outColor = vec4(col, 1.0);
  }`;

  class GLMap {
    static create(canvas, sim) {
      try {
        const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
        if (!gl) return null;
        return new GLMap(canvas, gl, sim);
      } catch (e) { console.warn('WebGL2 unavailable, using Canvas2D', e); return null; }
    }

    constructor(canvas, gl, sim) {
      this.canvas = canvas; this.gl = gl; this.sim = sim;
      const prog = this.prog = this._program(VS, FS);
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = {};
      for (const n of ['uRes', 'uCam', 'uMap', 'uTime', 'uNight', 'uDusk', 'uClouds', 'uCloudA', 'uSun', 'uTerr', 'uData', 'uOwn']) this.u[n] = gl.getUniformLocation(prog, n);
      const { W, H } = sim;
      this.W = W; this.H = H;
      this._buildStatic();
      this.scale = 1;
      this._ft = [];
      this.ownPx = new Uint32Array(W * H);
      this.ownTex = this._tex(W, H, gl.NEAREST, new Uint8Array(this.ownPx.buffer));
      gl.uniform1i(this.u.uTerr, 0); gl.uniform1i(this.u.uData, 1); gl.uniform1i(this.u.uOwn, 2);
    }

    _program(vs, fs) {
      const gl = this.gl;
      const sh = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      return p;
    }
    _tex(w, h, filter, data) {
      const gl = this.gl, t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }

    _buildStatic() {
      const m = this.sim.map, { W, H } = this, N = W * H;
      const terr = new Uint8Array(N * 4), data = new Uint8Array(N * 4);
      const COL = {
        [T.DEEP]: [20, 50, 80], [T.SHALLOW]: [30, 90, 110], [T.BEACH]: [226, 208, 160], [T.PLAINS]: [128, 168, 86],
        [T.FOREST]: [62, 112, 58], [T.HILLS]: [150, 142, 96], [T.MOUNTAIN]: [124, 114, 104], [T.SNOW]: [240, 244, 250],
      };
      for (let i = 0; i < N; i++) {
        const t = m.terrain[i], c = COL[t], o = i * 4;
        // beaches borrow a bit of their neighbours so the sand band isn't a hard stripe
        terr[o] = c[0]; terr[o + 1] = c[1]; terr[o + 2] = c[2]; terr[o + 3] = Math.round(t / 7 * 255);
        const land = t >= T.BEACH;
        const e = land ? Math.max(0, Math.min(1, (m.height[i] - m.sea) / (m.maxH - m.sea))) : 0;
        data[o] = Math.round(e * 255);
        data[o + 1] = land ? 0 : Math.round(Math.min(m.waterDist[i], 30) / 30 * 255);
        data[o + 2] = land ? 255 : 0;
        data[o + 3] = 255;
      }
      // blur land mask & height so contours become curves instead of tile stairs
      const blur = (ch, passes) => {
        const tmp = new Float32Array(N);
        for (let i = 0; i < N; i++) tmp[i] = data[i * 4 + ch];
        const out = new Float32Array(N);
        for (let pss = 0; pss < passes; pss++) {
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = y * W + x;
            out[i] = (tmp[i] * 2 + tmp[x > 0 ? i - 1 : i] + tmp[x < W - 1 ? i + 1 : i]) / 4;
          }
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = y * W + x;
            tmp[i] = (out[i] * 2 + out[y > 0 ? i - W : i] + out[y < H - 1 ? i + W : i]) / 4;
          }
        }
        for (let i = 0; i < N; i++) data[i * 4 + ch] = Math.round(tmp[i]);
      };
      blur(2, 2);
      blur(0, 1);
      const gl = this.gl;
      this.terrTex = this._tex(W, H, gl.LINEAR, terr);
      this.dataTex = this._tex(W, H, gl.LINEAR, data);
    }

    /** owner colour per tile; flags in alpha: 255 normal, 230 hovered */
    paint(t, color, flag) {
      this.ownPx[t] = color ? ((flag << 24) | (color[2] << 16) | (color[1] << 8) | color[0]) >>> 0 : 0;
      this.dirty = true; this.miniDirty = true;
    }

    /** feed frame times; lowers/raises internal resolution to hold ~50 fps */
    adapt(dt) {
      const f = this._ft;
      f.push(dt); if (f.length < 45) return;
      const avg = f.reduce((a, b) => a + b, 0) / f.length; f.length = 0;
      if (avg > 1 / 40 && this.scale > 0.45) this.scale = Math.max(0.45, this.scale - 0.15);
      else if (avg < 1 / 58 && this.scale < 1) this.scale = Math.min(1, this.scale + 0.1);
    }

    destroy() {
      const gl = this.gl;
      for (const t of [this.terrTex, this.dataTex, this.ownTex]) gl.deleteTexture(t);
      gl.deleteProgram(this.prog);
    }

    render(cam, dpr, opts) {
      const gl = this.gl, cv = this.canvas;
      const r = dpr * this.scale;                       // dynamic resolution: buffer may be smaller than the screen
      if (cv.width !== Math.floor(opts.cw * r) || cv.height !== Math.floor(opts.ch * r)) {
        cv.width = Math.floor(opts.cw * r); cv.height = Math.floor(opts.ch * r);
        cv.style.width = opts.cw + 'px'; cv.style.height = opts.ch + 'px';
      }
      gl.viewport(0, 0, cv.width, cv.height);
      gl.useProgram(this.prog);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.terrTex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.dataTex);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.ownTex);
      if (this.dirty) {
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.W, this.H, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(this.ownPx.buffer));
        this.dirty = false;
      }
      const u = this.u;
      gl.uniform2f(u.uRes, cv.width, cv.height);
      gl.uniform3f(u.uCam, opts.cx, opts.cy, cam.zoom * r);
      gl.uniform2f(u.uMap, this.W, this.H);
      gl.uniform1f(u.uTime, opts.time);
      gl.uniform1f(u.uNight, opts.night);
      gl.uniform1f(u.uDusk, opts.dusk);
      gl.uniform1f(u.uClouds, opts.clouds ? 1 : 0);
      gl.uniform1f(u.uCloudA, Math.max(0, Math.min(0.55, 0.8 - cam.zoom * 0.17)));
      gl.uniform3f(u.uSun, opts.sun[0], opts.sun[1], opts.sun[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  BW.GLMap = GLMap;
})(globalThis.BW = globalThis.BW || {});
