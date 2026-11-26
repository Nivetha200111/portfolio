import { HEADER, NOISE, ATMOSPHERE, sunFrom, smooth } from './common.js?v=1';

// Chapter two: a white marble staircase spirals up out of a sea of clouds and simply
// stops in the open sky. The camera climbs with the scroll.
const fragment = HEADER + NOISE + ATMOSPHERE + `
const vec3 AXIS = vec3(14., 0., 95.);
const float STEPS_PER_TURN = 22., RISE = .78, R_IN = 3.2, R_OUT = 9.5, K_MIN = -8., K_MAX = 118.;

// ---------------------------------------------------------------- clouds
float billow(vec2 p) { float n = noise(p); return 1. - abs(2. * n - 1.); }
float C(vec2 p) {
  p += vec2(uTime * .6, uTime * .25);
  // Rounded, cauliflower tops: soft bumps on soft bumps.
  float b = fbm(p * .010), m = noise(p * .045 + 3.1), s = noise(p * .14);
  return pow(b, 2.2) * 30. + pow(m, 2.) * 4.5 + s * .9 - 4.;
}
vec3 cloudNormal(vec2 p, float t) {
  float e = .6 + t * .004;
  return normalize(vec3(C(p - vec2(e, 0)) - C(p + vec2(e, 0)), 2. * e, C(p - vec2(0, e)) - C(p + vec2(0, e))));
}
float marchClouds(vec3 ro, vec3 rd, out bool hit) {
  hit = false; if (rd.y > 0. && ro.y > 26.) return 1e5;
  float t = rd.y < 0. ? max(0., (ro.y - 26.) / -rd.y) : 0., lt = t, ld = 1.;
  for (int i = 0; i < 90; i++) {
    vec3 p = ro + rd * t; float d = p.y - C(p.xz);
    if (d < .003 * t) { hit = true; return lt + (t - lt) * ld / (ld - d); }
    lt = t; ld = d; t += max(d * .6, .05 + t * .006);
    if (t > 2500. || (rd.y > 0. && p.y > 26.)) break;
  }
  return 1e5;
}

// ---------------------------------------------------------------- staircase
float box(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.); }
float stepAt(vec3 q, float j) {
  float dA = 2. * PI / STEPS_PER_TURN;
  float a = atan(q.z, q.x); if (a < 0.) a += 2. * PI;
  float m = floor((q.y / RISE - j) / STEPS_PER_TURN + .5);
  float k = j + m * STEPS_PER_TURN;
  if (k < K_MIN || k > K_MAX) return 1e3;
  vec3 r = q; r.xz = rot((j + .5) * dA) * r.xz;
  float mid = (R_IN + R_OUT) * .5;
  return box(r - vec3(mid, k * RISE - .19, 0.), vec3((R_OUT - R_IN) * .5, .19, mid * sin(dA * .5) + .06)) - .03;
}
float stairs(vec3 p) {
  vec3 q = p - AXIS;
  float dA = 2. * PI / STEPS_PER_TURN, a = atan(q.z, q.x); if (a < 0.) a += 2. * PI;
  float j = floor(a / dA);
  float d = min(stepAt(q, j), min(stepAt(q, mod(j + 1., STEPS_PER_TURN)), stepAt(q, mod(j + STEPS_PER_TURN - 1., STEPS_PER_TURN))));
  // Outside the helix's radius, step toward it quickly.
  float r = length(q.xz); return max(d, r - R_OUT - .5);
}
vec3 stairsNormal(vec3 p) { vec2 e = vec2(.004, 0); return normalize(vec3(stairs(p + e.xyy) - stairs(p - e.xyy), stairs(p + e.yxy) - stairs(p - e.yxy), stairs(p + e.yyx) - stairs(p - e.yyx))); }
float marchStairs(vec3 ro, vec3 rd) {
  float t = 0.;
  for (int i = 0; i < 110; i++) { float d = stairs(ro + rd * t); if (d < .002 * max(1., t * .05)) return t; t += d * .9; if (t > 600.) break; }
  return -1.;
}
float stairShadow(vec3 p) {
  // Only rays toward the sun that pass near the staircase's axis can be blocked by it.
  vec2 d2 = normalize(SUN.xz), rel = AXIS.xz - p.xz;
  if (abs(rel.x * d2.y - rel.y * d2.x) > R_OUT + 1. || dot(rel, d2) < -R_OUT) return 1.;
  float res = 1., t = .08;
  for (int i = 0; i < 28; i++) { float d = stairs(p + SUN * t); res = min(res, 10. * d / t); if (res < .002 || t > 120.) break; t += clamp(d, .1, 6.); }
  return clamp(res, 0., 1.);
}
float stairAO(vec3 p, vec3 n) { float o = 0.; for (int i = 1; i < 5; i++) { float h = float(i) * .25; o += (h - stairs(p + n * h)) / h; } return clamp(1. - o * .22, 0., 1.); }

vec3 marble(vec3 p) {
  float v = fbm(p.xz * .7 + p.y * .3) + fbm(p.xy * 1.3) * .5;
  float vein = smoothstep(.035, 0., abs(sin(v * 9.)));
  return mix(vec3(.93, .91, .87), vec3(.62, .6, .6), vein * .55);
}

void main() {
  vec2 uv = (vUv - .5) * vec2(uRes.x / uRes.y, 1.);
  SUN_EL = uSunEl; SUN = uSun;
  float climb = smoothstep(0., 1., uProg);
  vec3 ro = vec3(-26. + uMouse.x * 3., 24. + climb * 52. - uMouse.y * 2., 52. + climb * 6.);
  vec3 ta = vec3(9. + uMouse.x * 4., 30. + climb * 58., 95.);
  vec3 rd = camera(ro, ta, uv, 1.55);

  bool cloudHit; float tc = marchClouds(ro, rd, cloudHit);
  float ts = marchStairs(ro, rd);
  vec3 sun = sunLight(), col;
  if (ts > 0. && ts < tc) {
    vec3 p = ro + rd * ts, n = stairsNormal(p), alb = marble(p);
    float sh = stairShadow(p + n * .01), ao = stairAO(p, n), diff = max(dot(n, SUN), 0.);
    vec3 amb = skyLUT(vec3(0, 1, 0)) * (.6 + .4 * n.y) + vec3(1., .97, .94) * .35 * max(-n.y, 0.); // light bounced up from the clouds
    col = alb * (sun * diff * sh * .07 + amb * 1.2 * ao);
    col += sun * pow(max(dot(reflect(rd, n), SUN), 0.), 40.) * .012 * sh;
    col = mix(col, fogColor(rd), 1. - exp(-ts * .0011));
  } else if (cloudHit) {
    vec3 p = ro + rd * tc, n = cloudNormal(p.xz, tc);
    float h = clamp((p.y + 2.) / 15., 0., 1.);
    float wrap = clamp((dot(n, SUN) + .35) / 1.35, 0., 1.);
    float sh = stairShadow(p + vec3(0, .2, 0));
    vec3 amb = skyLUT(vec3(0, 1, 0)) * (.45 + .55 * h);
    col = vec3(.97, .97, .98) * (sun * wrap * .055 * sh * (.55 + .45 * h) + amb * 1.7 * (.6 + .4 * h));
    col += sun * .025 * pow(max(dot(rd, SUN), 0.), 5.) * (1. - h * .6);           // light glowing through thin edges
    // Haze lies low over the cloud sea and thickens with distance.
    col = mix(col, fogColor(rd) * 1.08, 1. - exp(-tc * .0011 - (1. - h) * .15));
  } else col = sky(rd);
  col *= mix(1.1, .8, smoothstep(.1, .35, SUN_EL));
  frag = vec4(col, 1.);
}`;

export const stairs = {
  id: 'stairs', fragment,
  // Morning: the sun climbs from just above the cloud sea to mid-morning, to the left of view.
  sun: p => sunFrom(.09 + .2 * smooth(p), Math.atan2(95 - 52, 14 + 26) + 1.25)
};
