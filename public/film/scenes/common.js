// Shared shader building blocks for the film's scenes.

export const HEADER = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 frag;
uniform vec2 uRes, uMouse; uniform float uTime, uProg, uSunEl; uniform vec3 uSun; uniform sampler2D tSky;
const float PI = 3.14159265;
`;

export const NOISE = `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= .5; } return v; }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec3 spectrum(float x) { return clamp(vec3(1.5 - abs(x * 4. - 3.), 1.5 - abs(x * 4. - 2.), 1.5 - abs(x * 4. - 1.)), 0., 1.); }
`;

// Sky from the per-frame atmosphere lookup, the sun's disc and its colour through the air.
export const ATMOSPHERE = `
vec3 SUN; float SUN_EL;
vec3 sunLight() {
  float z = 90. - degrees(max(SUN_EL, -.02));
  float m = 1. / (cos(radians(min(z, 90.))) + .50572 * pow(max(96.07995 - z, .5), -1.6364));
  vec3 tau = vec3(5.8e-6, 13.5e-6, 33.1e-6) * 8e3 + 21e-6 * 1.2e3 * 1.1;
  return 22. * exp(-tau * m) * smoothstep(-.025, .01, SUN_EL);
}
vec3 skyLUT(vec3 rd) {
  float az = atan(rd.z, rd.x), el = asin(clamp(rd.y, 0., 1.));
  return texture(tSky, vec2(az / (2. * PI) + .5, sqrt(el / (PI * .5)))).rgb;
}
float stars(vec3 rd, float density) {
  vec3 sp = rd * 260.; vec3 cell = floor(sp); float h = hash12(cell.xy + cell.z * 17.13);
  return step(1. - density, h) * smoothstep(.45, .0, length(fract(sp) - .5)) * (.6 + .4 * sin(uTime * (1. + h * 4.) + h * 90.));
}
vec3 sky(vec3 rd) {
  vec3 col = skyLUT(rd);
  float mu = dot(rd, SUN);
  col += sunLight() * smoothstep(.99994, .99998, mu) * 30.;
  col += sunLight() * pow(max(mu, 0.), 900.) * .6;
  col += vec3(.9, .95, 1.) * stars(rd, .0028) * .25 * (1. - smoothstep(-.03, .05, SUN_EL)) * smoothstep(.04, .3, rd.y);
  return col;
}
vec3 fogColor(vec3 rd) {
  return skyLUT(normalize(vec3(rd.x, .015, rd.z))) + sunLight() * pow(max(dot(rd, SUN), 0.), 6.) * .04;
}
vec3 camera(vec3 ro, vec3 ta, vec2 uv, float zoom) {
  vec3 f = normalize(ta - ro), r = normalize(cross(f, vec3(0, 1, 0))), u = cross(r, f);
  return normalize(f * zoom + r * uv.x + u * uv.y);
}
`;

// The atmosphere itself: physically based single scattering (Rayleigh, Mie, ozone),
// rendered once per frame into a small lookup texture for every upward direction.
export const SKY_LUT = `#version 300 es
precision highp float;
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
  float tmax = exitDistance(ro, rd), seg = tmax / 14.;
  float mu = dot(rd, uSun), g = .78;
  float pr = 3. / (16. * PI) * (1. + mu * mu);
  float pm = 3. / (8. * PI) * ((1. - g * g) * (1. + mu * mu)) / ((2. + g * g) * pow(1. + g * g - 2. * g * mu, 1.5));
  float odR = 0., odM = 0., odO = 0.; vec3 sR = vec3(0.), sM = vec3(0.);
  for (int i = 0; i < 14; i++) {
    vec3 p = ro + rd * seg * (float(i) + .5);
    float h = length(p) - Re, hr = exp(-h / Hr) * seg, hm = exp(-h / Hm) * seg;
    odR += hr; odM += hm; odO += ozone(h) * seg;
    float tl = exitDistance(p, uSun), sl = tl / 6., lR = 0., lM = 0., lO = 0.; bool lit = true;
    for (int j = 0; j < 6; j++) {
      vec3 q = p + uSun * sl * (float(j) + .5); float hl = length(q) - Re;
      if (hl < 0.) { lit = false; break; }
      lR += exp(-hl / Hr) * sl; lM += exp(-hl / Hm) * sl; lO += ozone(hl) * sl;
    }
    if (lit) { vec3 att = exp(-(bR * (odR + lR) + bM * 1.1 * (odM + lM) + bO * (odO + lO))); sR += att * hr; sM += att * hm; }
  }
  frag = vec4(22. * (sR * bR * pr + sM * bM * pm), 1.);
}`;

// A sun direction from an elevation and azimuth (radians).
export function sunFrom(elevation, azimuth) {
  return { elevation, direction: [Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.sin(azimuth)] };
}
export const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
