// The film: full-screen shader scenes driven by scroll. Each scene is one fragment
// shader rendered at reduced resolution into a half-float target, then graded (bloom,
// ACES, vignette, grain, chromatic fringe) and upscaled. Between chapters the next
// scene dissolves in through a glowing seam. Scenes compile in the background, only
// when they are about to be needed.
import { SKY_LUT } from './scenes/common.js?v=1';

const VERTEX = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main() { vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0., 1.); }`;

const GRADE = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 frag;
uniform sampler2D tA, tB; uniform vec2 uRes; uniform float uTime, uFade, uMix;
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
vec3 aces(vec3 x) { const float a = 2.51, b = .03, c = 2.43, d = .59, e = .14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0., 1.); }
vec3 look(sampler2D t, vec2 uv, vec2 c) {
  float fringe = dot(c, c) * .006;
  vec3 col = vec3(textureLod(t, uv + c * fringe, 0.).r, textureLod(t, uv, 0.).g, textureLod(t, uv - c * fringe, 0.).b);
  vec3 glow = vec3(0.);
  for (int i = 2; i < 7; i++) { vec3 s = textureLod(t, uv, float(i)).rgb; glow += max(s - .9, 0.) * (1. + float(i) * .25); }
  return col + glow * .12;
}
void main() {
  vec2 uv = vUv, c = uv - .5;
  vec3 col = look(tA, uv, c);
  if (uMix > 0.) {
    // A dissolve that burns through like light through paper, with a warm glowing seam.
    // The next chapter washes up the screen behind a thin, ragged edge of warm light.
    float n = uv.y * .72 + noise(uv * vec2(uRes.x / uRes.y, 1.) * 2.4 + uTime * .04) * .22 + noise(uv * 14.) * .06;
    float edge = n - (uMix * 1.25 - .12);
    float k = smoothstep(.025, -.025, edge);
    col = mix(col, look(tB, uv, c), k) + vec3(1.5, 1., .62) * smoothstep(.035, 0., abs(edge)) * (1. - abs(uMix * 2. - 1.)) * .9;
  }
  col = aces(col * 1.05);
  col = pow(col, vec3(1. / 2.2));
  col *= 1. - dot(c, c) * .55;
  col += (hash(uv * uRes + fract(uTime) * 91.) - .5) * .028;
  frag = vec4(col * uFade, 1.);
}`;

export function createFilm(canvas, { scenes, onReady, onError, reducedMotion = false } = {}) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) { onError?.('webgl2'); return null; }
  const parallel = gl.getExtension('KHR_parallel_shader_compile');

  const compile = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); return s; };
  // Programs link asynchronously where the browser allows; `ready()` reports when they can be used.
  function build(fragment) {
    const vs = compile(gl.VERTEX_SHADER, VERTEX), fs = compile(gl.FRAGMENT_SHADER, fragment), p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    const entry = { p, u: null, failed: false };
    entry.ready = () => {
      if (entry.u || entry.failed) return !!entry.u;
      if (parallel && !gl.getProgramParameter(p, parallel.COMPLETION_STATUS_KHR)) return false;
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        entry.failed = true;
        console.error(gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(p));
        return false;
      }
      entry.u = {};
      const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < count; i++) { const { name } = gl.getActiveUniform(p, i); entry.u[name] = gl.getUniformLocation(p, name); }
      return true;
    };
    return entry;
  }

  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const skyPass = build(SKY_LUT), grade = build(GRADE);
  const programs = new Map();                     // one program per distinct fragment shader
  // Every scene's output is cleaned before it reaches the bloom mip chain: one stray
  // NaN or infinity would otherwise smear into a coloured blob across the frame.
  const sanitize = fragment => fragment.replace(/frag = vec4\(col, 1\.\);/g, 'col = clamp(col, 0., 60.); frag = vec4(isnan(col.r + col.g + col.b) ? vec3(0.) : col, 1.);');
  const programFor = scene => { if (!programs.has(scene.fragment)) programs.set(scene.fragment, build(sanitize(scene.fragment))); return programs.get(scene.fragment); };
  programFor(scenes[0]);

  const makeTarget = (w, h, mips) => {
    const t = { tex: gl.createTexture(), fbo: gl.createFramebuffer(), w: 0, h: 0, mips };
    t.resize = (nw, nh) => {
      if (nw === t.w && nh === t.h) return; t.w = nw; t.h = nh;
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, nw, nh, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, mips ? gl.CLAMP_TO_EDGE : gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    };
    t.resize(w, h); return t;
  };
  const skyTarget = makeTarget(192, 64, false);
  const targets = [makeTarget(1, 1, true), makeTarget(1, 1, true)];

  let scale = .55, width = 0, height = 0;
  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(canvas.clientWidth * ratio)); height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    canvas.width = width; canvas.height = height;
    targets.forEach(t => t.resize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))));
  }

  let position = 0, smoothPos = 0, mouseX = 0, mouseY = 0, smoothX = 0, smoothY = 0, fade = 0, time = 0, last = performance.now();
  let running = true, visible = true, frameAverage = 16, sinceChange = 0, ready = false, disposed = false, looping = false;

  function renderScene(scene, progress, target) {
    const program = programFor(scene);
    if (!program.ready() || !skyPass.ready()) return false;
    const sun = scene.sun(progress);
    gl.bindFramebuffer(gl.FRAMEBUFFER, skyTarget.fbo); gl.viewport(0, 0, skyTarget.w, skyTarget.h);
    gl.useProgram(skyPass.p); gl.uniform3fv(skyPass.u.uSun, sun.direction);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); gl.viewport(0, 0, target.w, target.h);
    const { p, u } = program; gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, skyTarget.tex); gl.uniform1i(u.tSky, 1);
    gl.uniform2f(u.uRes, target.w, target.h); gl.uniform1f(u.uTime, time); gl.uniform1f(u.uProg, progress);
    gl.uniform2f(u.uMouse, smoothX, smoothY); gl.uniform3fv(u.uSun, sun.direction); gl.uniform1f(u.uSunEl, sun.elevation);
    for (const [name, value] of Object.entries(scene.uniforms || {})) if (u[name]) gl.uniform1f(u[name], value);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, target.tex); gl.generateMipmap(gl.TEXTURE_2D);
    return true;
  }

  let shownA = -1;
  function frame(now, once = false) {
    if (!once) looping = false;
    if (disposed) return;
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (!reducedMotion) time += dt;
    smoothPos += (position - smoothPos) * Math.min(1, dt * 5);
    if (Math.abs(position - smoothPos) > 1.2 || reducedMotion) smoothPos = position;
    smoothX += (mouseX - smoothX) * Math.min(1, dt * 2); smoothY += (mouseY - smoothY) * Math.min(1, dt * 2);
    if (dt < .1) {
      frameAverage += (dt * 1000 - frameAverage) * .05; sinceChange += dt;
      if (sinceChange > 1.5) {
        const next = frameAverage > 26 ? Math.max(.35, scale - .07) : frameAverage < 15 ? Math.min(.8, scale + .05) : scale;
        if (next !== scale) { scale = next; sinceChange = 0; resize(); }
      }
    }
    const index = Math.min(scenes.length - 1, Math.max(0, Math.floor(smoothPos)));
    const local = Math.min(1, smoothPos - index);
    // Warm up the neighbours so they are compiled by the time they are needed.
    if (scenes[index + 1]) programFor(scenes[index + 1]);
    if (scenes[index - 1]) programFor(scenes[index - 1]);
    const mix = index < scenes.length - 1 ? Math.min(1, Math.max(0, (local - .86) / .14)) : 0;
    const drewA = renderScene(scenes[index], local, targets[0]);
    if (drewA) shownA = index;
    const drewB = mix > 0 && renderScene(scenes[index + 1], 0, targets[1]);
    if (grade.ready() && (drewA || shownA >= 0)) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, width, height);
      const { p, u } = grade; gl.useProgram(p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, targets[0].tex); gl.uniform1i(u.tA, 0);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, targets[1].tex); gl.uniform1i(u.tB, 2);
      gl.uniform2f(u.uRes, width, height); gl.uniform1f(u.uTime, time);
      gl.uniform1f(u.uMix, drewB ? mix : 0);
      fade = Math.min(1, fade + dt * .7); gl.uniform1f(u.uFade, fade * fade);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!ready && drewA) { ready = true; onReady?.(); }
    }
    if (!once) loop();
  }
  function loop() { if (!looping && !disposed && running && visible) { looping = true; requestAnimationFrame(frame); } }
  const onMouse = event => { mouseX = event.clientX / window.innerWidth - .5; mouseY = event.clientY / window.innerHeight - .5; };
  const onVisibility = () => { visible = !document.hidden; last = performance.now(); loop(); };
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  window.addEventListener('pointermove', onMouse); document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); running = false; onError?.('lost'); });
  resize(); loop();

  return {
    setPosition(value) { position = Math.max(0, Math.min(scenes.length - .001, value)); },
    setVisible(value) { running = value; last = performance.now(); loop(); },
    debug: {
      gl, programs, get scale() { return scale; }, set scale(value) { scale = value; resize(); },
      jump(value) { position = smoothPos = value; },
      render: () => frame(performance.now(), true)
    },
    dispose() {
      disposed = true; observer.disconnect(); window.removeEventListener('pointermove', onMouse); document.removeEventListener('visibilitychange', onVisibility);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  };
}
