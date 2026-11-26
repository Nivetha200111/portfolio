import * as THREE from './vendor/three.module.js';

// A physically based sky for the island: single scattering through the air (Rayleigh,
// Mie and ozone) for every direction, rendered into a small float texture whenever the
// sun moves. The island's sky dome, reflections, haze and sunlight all come from it,
// so every colour in the scene agrees with the light that made it.
const LUT_FRAGMENT = `precision highp float;
in vec2 vUv; out vec4 frag;
uniform vec3 uSun;
const float PI = 3.14159265, Re = 6360e3, Ra = 6420e3, Hr = 8e3, Hm = 1.2e3;
const vec3 bR = vec3(5.8e-6, 13.5e-6, 33.1e-6), bM = vec3(21e-6), bO = vec3(.65e-6, 1.881e-6, .085e-6);
float ozone(float h) { return max(0., 1. - abs(h - 25e3) / 15e3); }
float exitDistance(vec3 o, vec3 d) { float b = dot(o, d), c = dot(o, o) - Ra * Ra; return -b + sqrt(max(b * b - c, 0.)); }
void main() {
  float az = (vUv.x - .5) * 2. * PI, el = vUv.y * vUv.y * PI * .5;
  vec3 rd = vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az));
  vec3 ro = vec3(0., Re + 10., 0.);
  float tmax = exitDistance(ro, rd), seg = tmax / 16.;
  float mu = dot(rd, uSun), g = .78;
  float pr = 3. / (16. * PI) * (1. + mu * mu);
  float pm = 3. / (8. * PI) * ((1. - g * g) * (1. + mu * mu)) / ((2. + g * g) * pow(1. + g * g - 2. * g * mu, 1.5));
  float odR = 0., odM = 0., odO = 0.; vec3 sR = vec3(0.), sM = vec3(0.);
  for (int i = 0; i < 16; i++) {
    vec3 p = ro + rd * seg * (float(i) + .5);
    float h = length(p) - Re, hr = exp(-h / Hr) * seg, hm = exp(-h / Hm) * seg;
    odR += hr; odM += hm; odO += ozone(h) * seg;
    float tl = exitDistance(p, uSun), sl = tl / 8., lR = 0., lM = 0., lO = 0.; bool lit = true;
    for (int j = 0; j < 8; j++) {
      vec3 q = p + uSun * sl * (float(j) + .5); float hl = length(q) - Re;
      if (hl < 0.) { lit = false; break; }
      lR += exp(-hl / Hr) * sl; lM += exp(-hl / Hm) * sl; lO += ozone(hl) * sl;
    }
    if (lit) { vec3 att = exp(-(bR * (odR + lR) + bM * 1.1 * (odM + lM) + bO * (odO + lO))); sR += att * hr; sM += att * hm; }
  }
  frag = vec4(22. * (sR * bR * pr + sM * bM * pm), 1.);
}`;

// GLSL shared by anything that samples the sky.
export const SKY_GLSL = `
uniform sampler2D uSkyLUT; uniform vec3 uSunDir, uSunColor; uniform float uTime, uNight;
float aHash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float aHash2(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float aNoise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f); return mix(mix(aHash2(i), aHash2(i + vec2(1, 0)), u.x), mix(aHash2(i + vec2(0, 1)), aHash2(i + vec2(1, 1)), u.x), u.y); }
float aFbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * aNoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= .5; } return v; }
vec3 skyLUT(vec3 d) {
  float az = atan(d.z, d.x), el = asin(clamp(d.y, 0., 1.));
  return texture2D(uSkyLUT, vec2(az * .15915494 + .5, sqrt(el / 1.5707963))).rgb;
}
vec3 skyAbove(vec3 d) {
  vec3 col = skyLUT(d);
  float mu = dot(d, uSunDir);
  col += uSunColor * (smoothstep(.99993, .99998, mu) * 40. + pow(max(mu, 0.), 700.) * .8);
  vec3 p = d * 230., cell = floor(p); float h = aHash(cell);
  float star = step(.9958, h) * smoothstep(.42, 0., length(fract(p) - .5)) * (.55 + .45 * sin(uTime * (1.2 + h * 3.) + h * 70.));
  col += vec3(1., .94, .86) * star * uNight * .5 * smoothstep(.08, .4, d.y);
  return col;
}
// Far below the island: a sea of cloud tops, lit by the low sun and fading into haze.
vec3 cloudSea(vec3 d) {
  float depth = -d.y;
  vec2 p = d.xz / max(depth, .015) * 1.4 + vec2(uTime * .012, uTime * .006);
  float n = aFbm(p * .45), billow = aFbm(p * 1.3 + 7.);
  float tops = smoothstep(.28, .72, n * .75 + billow * .35);
  vec3 lit = uSunColor * .045 * (.35 + .65 * smoothstep(.2, .9, billow + dot(normalize(vec3(p.x, 1., p.y) - vec3(0.)), uSunDir) * .2));
  vec3 shade = skyLUT(vec3(0., 1., 0.)) * 1.4;
  vec3 cloud = mix(shade * .55, shade + lit, tops);
  // Light from the sun's side glows through the cloud edges.
  cloud += uSunColor * .03 * pow(max(dot(normalize(vec3(d.x, 0., d.z)), normalize(vec3(uSunDir.x, 0., uSunDir.z))), 0.), 6.) * tops;
  vec3 haze = skyLUT(normalize(vec3(d.x, .02, d.z)));
  return mix(haze, cloud, smoothstep(.0, .12, depth));
}
vec3 skyColor(vec3 d) { return d.y >= 0. ? skyAbove(d) : cloudSea(d); }
`;

export function createAtmosphere(renderer) {
  const lut = new THREE.WebGLRenderTarget(192, 64, { type: THREE.FloatType, depthBuffer: false });
  lut.texture.wrapS = THREE.RepeatWrapping; lut.texture.minFilter = lut.texture.magFilter = THREE.LinearFilter;
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadScene = new THREE.Scene();
  const lutMaterial = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: { uSun: { value: new THREE.Vector3(0, .2, 1) } },
    vertexShader: `precision highp float; in vec3 position; out vec2 vUv; void main() { vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: LUT_FRAGMENT, depthTest: false, depthWrite: false
  });
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lutMaterial));

  // Sunlight through the air: reddened by the air mass near the horizon (Kasten–Young).
  function sunlight(elevation) {
    const z = 90 - THREE.MathUtils.radToDeg(Math.max(elevation, -.02));
    const m = 1 / (Math.cos(THREE.MathUtils.degToRad(Math.min(z, 90))) + .50572 * Math.pow(Math.max(96.07995 - z, .5), -1.6364));
    const tau = [5.8e-6 * 8e3 + 21e-6 * 1.2e3 * 1.1, 13.5e-6 * 8e3 + 21e-6 * 1.2e3 * 1.1, 33.1e-6 * 8e3 + 21e-6 * 1.2e3 * 1.1];
    const fade = THREE.MathUtils.smoothstep(elevation, -.025, .01);
    return new THREE.Color(22 * Math.exp(-tau[0] * m) * fade, 22 * Math.exp(-tau[1] * m) * fade, 22 * Math.exp(-tau[2] * m) * fade);
  }
  const pixels = new Float32Array(192 * 4);
  return {
    texture: lut.texture,
    sunlight,
    // Renders the sky for a sun direction and returns the haze colour at the horizon.
    update(direction) {
      lutMaterial.uniforms.uSun.value.copy(direction);
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(lut); renderer.render(quadScene, quadCamera);
      renderer.readRenderTargetPixels(lut, 0, 2, 192, 1, pixels);
      renderer.setRenderTarget(previous);
      const haze = new THREE.Color(0, 0, 0);
      for (let i = 0; i < 192; i++) haze.r += pixels[i * 4] / 192, haze.g += pixels[i * 4 + 1] / 192, haze.b += pixels[i * 4 + 2] / 192;
      return haze;
    },
    dispose() { lut.dispose(); lutMaterial.dispose(); }
  };
}
