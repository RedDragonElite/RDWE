/* RDE // KONTRAKT — WebGL2 post-processing: bloom, chromatic aberration, grading, instinct vision, grain */
(function (K) {
  'use strict';
  const VS = `#version 300 es
in vec2 p; out vec2 vUv;
void main(){ vUv = p*0.5+0.5; vUv.y = 1.0-vUv.y; gl_Position = vec4(p,0.0,1.0); }`;
  const FS = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uRes;
uniform float uTime, uHurt, uLow, uInstinct, uDrunk, uFlash, uBloom, uGrain, uSlow, uTired, uVice, uDusk;
in vec2 vUv; out vec4 o;
vec3 tx(vec2 uv){ return texture(uTex, uv).rgb; }
void main(){
  vec2 uv = vUv;
  uv += uDrunk * 0.007 * vec2(sin(uv.y*17.0+uTime*1.9), cos(uv.x*15.0+uTime*1.6));
  vec2 c = uv - 0.5;
  float r2 = dot(c,c);
  float ca = (0.0018 + uHurt*0.012 + uSlow*0.004) * r2 * 4.0;
  vec3 col = vec3(tx(uv + c*ca).r, tx(uv).g, tx(uv - c*ca).b);
  if (uTired > 0.0) { vec2 px = 1.0/uRes; col = mix(col, (tx(uv+px*3.0)+tx(uv-px*3.0)+tx(uv+vec2(px.x,-px.y)*3.0)+tx(uv-vec2(px.x,-px.y)*3.0))*0.25, uTired*0.8); }
  vec3 bl = vec3(0.0);
  vec2 px = 1.0/uRes;
  for (int i=0;i<12;i++){ float a = float(i)*0.5236; for (int j=1;j<=2;j++){ vec2 off = vec2(cos(a),sin(a))*px*float(j*j)*6.0; bl += max(tx(uv+off)-0.6, 0.0); } }
  col += bl/24.0 * uBloom * 2.4;
  float l = dot(col, vec3(0.299,0.587,0.114));
  col = mix(col, col*vec3(0.9,1.0,1.08), (1.0-l)*0.4);
  col = mix(col, col*vec3(1.07,1.0,0.9), l*0.28);
  // Vice grade: violet shadows, teal mids, pink-orange highlights — stronger at golden hour
  if (uVice > 0.0) {
    float lv = dot(col, vec3(0.299,0.587,0.114));
    vec3 shadow = vec3(0.10, 0.02, 0.18), high = vec3(1.10, 0.90, 0.95) + vec3(0.06, 0.02, -0.08)*uDusk;
    col += shadow * (1.0-lv) * (1.0-lv) * 0.55 * uVice;
    col = mix(col, col*high, smoothstep(0.35, 1.0, lv) * 0.6 * uVice);
    col = mix(col, col*vec3(0.92,1.04,1.06), (1.0-abs(lv-0.45)*2.0) * 0.25 * uVice);
    col = mix(col, col*vec3(1.12,0.88,1.02), uDusk*0.35*uVice);
    float lv2 = dot(col, vec3(0.299,0.587,0.114));
    col = mix(vec3(lv2), col, 1.0 + 0.16*uVice);
  }
  float red = clamp((col.r - max(col.g,col.b))*3.0, 0.0, 1.0);
  float sat = 1.08 - uLow*0.75 - uInstinct*0.85;
  col = mix(vec3(l), col, clamp(mix(sat, 1.2, red*uInstinct), 0.0, 1.4));
  col = mix(col, col*vec3(0.8,0.92,1.2), uInstinct*0.35);
  col = (col-0.5)*1.07+0.5;
  float vig = smoothstep(0.95, 0.15, r2*2.4);
  col *= mix(0.5, 1.0, vig);
  float pulse = 0.6 + 0.4*sin(uTime*7.0);
  col = mix(col, vec3(0.45,0.0,0.02), clamp(uHurt*0.9 + uLow*0.35*pulse, 0.0, 1.0)*(1.0-vig));
  col += uFlash*0.55;
  float n = fract(sin(dot(uv*uRes + uTime*61.0, vec2(12.9898,78.233)))*43758.5453);
  col += (n-0.5)*uGrain;
  o = vec4(col,1.0);
}`;

  class Post {
    constructor(src, dst) {
      this.src = src; this.dst = dst; this.ok = false;
      try {
        const gl = this.gl = dst.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
        if (!gl) return;
        const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
        const pr = this.pr = gl.createProgram();
        gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
        gl.useProgram(pr);
        const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        this.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.u = {};
        for (const n of ['uTex', 'uRes', 'uTime', 'uHurt', 'uLow', 'uInstinct', 'uDrunk', 'uFlash', 'uBloom', 'uGrain', 'uSlow', 'uTired', 'uVice', 'uDusk']) this.u[n] = gl.getUniformLocation(pr, n);
        this.ok = true;
      } catch (e) { console.warn('post fx disabled:', e.message); this.ok = false; }
    }
    render(p) {
      if (!this.ok) return;
      const gl = this.gl, s = this.src, d = this.dst;
      if (d.width !== s.width || d.height !== s.height) { d.width = s.width; d.height = s.height; }
      gl.viewport(0, 0, d.width, d.height);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s);
      const u = this.u;
      gl.uniform1i(u.uTex, 0); gl.uniform2f(u.uRes, d.width, d.height);
      gl.uniform1f(u.uTime, p.time % 1000); gl.uniform1f(u.uHurt, p.hurt); gl.uniform1f(u.uLow, p.low); gl.uniform1f(u.uInstinct, p.instinct);
      gl.uniform1f(u.uDrunk, p.drunk); gl.uniform1f(u.uFlash, p.flash); gl.uniform1f(u.uBloom, p.bloom); gl.uniform1f(u.uGrain, p.grain); gl.uniform1f(u.uSlow, p.slow); gl.uniform1f(u.uTired, p.tired); gl.uniform1f(u.uVice, p.vice || 0); gl.uniform1f(u.uDusk, p.dusk || 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }
  K.Post = Post;
})(globalThis.K = globalThis.K || {});
