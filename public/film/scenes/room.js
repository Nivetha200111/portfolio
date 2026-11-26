import { HEADER, NOISE, ATMOSPHERE, sunFrom, smooth } from './common.js?v=1';

// Chapter three: the sea has come inside. A vast white hall stands in open water;
// sunlight falls through tall arches onto the waves, light reflected from the water
// dances over the walls, and the far wall opens onto the horizon.
const fragment = HEADER + NOISE + ATMOSPHERE + `
const float X = 26., Y = 34., Z0 = -40., Z1 = 170.;

// Signed distance to the nearest arched opening in the left wall (z, y) and the far wall (x, y).
float arch(float d, float y, float halfWidth, float spring) { return y < spring ? abs(d) - halfWidth : length(vec2(d, y - spring)) - halfWidth; }
float leftOpening(vec2 zy) { float zc = clamp(floor(zy.x / 26. + .5), 0., 6.) * 26.; return max(arch(zy.x - zc, zy.y, 5.5, 14.), -1.5 - zy.y); }
float endOpening(vec2 xy) { return max(arch(xy.x, xy.y, 12., 16.), -1.5 - xy.y); }

// How much direct sun reaches a point inside the hall: only what falls through the openings.
float sunVisible(vec3 p) {
  float v = 0.;
  if (SUN.x < 0.) { float t = (-X - p.x) / SUN.x; vec3 q = p + SUN * t; if (q.y < Y) v = max(v, smoothstep(.35, -.35, leftOpening(q.zy))); }
  if (SUN.z > 0.) { float t = (Z1 - p.z) / SUN.z; vec3 q = p + SUN * t; if (abs(q.x) < X && q.y < Y) v = max(v, smoothstep(.35, -.35, endOpening(q.xy))); }
  return v * smoothstep(-.02, .05, SUN_EL);
}

// ---------------------------------------------------------------- water
float waves(vec2 p) {
  float t = uTime * .9, h = 0.;
  h += sin(dot(p, vec2(.31, .95)) * .55 + t) * .22;
  h += sin(dot(p, vec2(-.8, .6)) * .9 + t * 1.3) * .12;
  h += sin(dot(p, vec2(.97, -.24)) * 1.7 + t * 1.9) * .05;
  return h + (noise(p * .6 + t * .3) - .5) * .12;
}
vec3 waterNormal(vec2 p, float t) {
  float e = .06 + t * .002;
  return normalize(vec3(waves(p - vec2(e, 0)) - waves(p + vec2(e, 0)), 2. * e, waves(p - vec2(0, e)) - waves(p + vec2(0, e))));
}
float hitWater(vec3 ro, vec3 rd) {
  if (rd.y >= 0.) return -1.;
  float t = (ro.y - .45) / -rd.y, lt = 0.;
  for (int i = 0; i < 8; i++) { vec3 p = ro + rd * t; float d = p.y - waves(p.xz); t += d / max(-rd.y, .05) * .8; }
  return t;
}

// ---------------------------------------------------------------- the hall
// Which wall a ray meets from inside the hall, and how far away.
float hall(vec3 ro, vec3 rd, out int face) {
  vec3 hi = vec3(X, Y, Z1), lo = vec3(-X, -10., Z0);
  vec3 t1 = (hi - ro) / rd, t0 = (lo - ro) / rd, tm = max(t0, t1);
  float t = min(tm.x, min(tm.y, tm.z));
  face = t == tm.x ? (rd.x < 0. ? 0 : 1) : t == tm.y ? 2 : (rd.z > 0. ? 3 : 4); // 0 left, 1 right, 2 ceiling, 3 far, 4 back
  return t;
}
float caustics(vec2 p) {
  float t = uTime * .6, c = 0.;
  for (int i = 0; i < 3; i++) { vec2 q = p * (1.3 + float(i) * .7) + vec2(t * (1. + float(i) * .3), -t * .7); c += pow(1. - abs(sin(q.x + sin(q.y * 1.3 + t)) * sin(q.y + sin(q.x * 1.1 - t))), 6.); }
  return c / 3.;
}
vec3 plaster(vec3 p, vec3 n) {
  float g = fbm((abs(n.x) > .5 ? p.zy : abs(n.y) > .5 ? p.xz : p.xy) * .35);
  return vec3(.9, .87, .82) * (.9 + .12 * g);
}
// The open sea beyond the arches reflects only the sky (no recursion back into the hall).
vec3 seaOutside(vec3 p, vec3 rd, float t) {
  vec3 n = waterNormal(p.xz, t), r = reflect(rd, n);
  float fres = .02 + .98 * pow(1. - max(dot(-rd, n), 0.), 5.);
  vec3 col = mix(vec3(.004, .03, .045) + vec3(.02, .14, .15) * .4, sky(r), fres);
  return col + sunLight() * pow(max(dot(r, SUN), 0.), 300.) * .5;
}
vec3 outside(vec3 ro, vec3 rd) {
  float tw = hitWater(ro, rd);
  if (tw > 0.) return mix(seaOutside(ro + rd * tw, rd, tw), fogColor(rd), 1. - exp(-tw * .0018));
  return sky(rd);
}
vec3 wall(vec3 p, vec3 n) {
  vec3 sun = sunLight(), alb = plaster(p, n);
  float direct = sunVisible(p + n * .05) * max(dot(n, SUN), 0.);
  // Sunlight reflected by the water: where it came from, and whether that water was lit.
  vec3 up = vec3(-SUN.x, SUN.y, -SUN.z);
  vec3 w = p - up * (p.y / max(up.y, .05));
  float bounce = sunVisible(vec3(w.x, .1, w.z)) * caustics(p.xz * .25 + p.y * .2) * smoothstep(30., 2., p.y) * max(dot(n, up), 0.);
  // Bounce light fills a white hall: sky through the arches, warm light off sunlit walls, teal light off the sea.
  vec3 amb = skyLUT(vec3(0, 1, 0)) * 1.25 + sunLight() * .012 * vec3(1., .93, .85) + vec3(.4, .7, .75) * .12 * max(-n.y, .3);
  float ao = smoothstep(0., 6., min(min(X - abs(p.x), Y - p.y), p.y + 1.)) * .35 + .65;
  return alb * (sun * (direct * .06 + bounce * .03) + amb * ao);
}
vec3 shadeHall(vec3 ro, vec3 rd) {
  int face; float t = hall(ro, rd, face);
  vec3 p = ro + rd * t;
  if (face == 0 && leftOpening(p.zy) < 0.) return outside(p, rd);
  if (face == 3 && endOpening(p.xy) < 0.) return outside(p, rd);
  vec3 n = face == 0 ? vec3(1, 0, 0) : face == 1 ? vec3(-1, 0, 0) : face == 2 ? vec3(0, -1, 0) : face == 3 ? vec3(0, 0, -1) : vec3(0, 0, 1);
  // A shallow reveal frames each arch so the openings read as thick stone.
  float frame = face == 0 ? smoothstep(.6, 0., abs(leftOpening(p.zy) - .3)) : face == 3 ? smoothstep(.6, 0., abs(endOpening(p.xy) - .3)) : 0.;
  return wall(p, n) * (1. - frame * .25);
}
vec3 sea(vec3 p, vec3 rd, float t) {
  vec3 n = waterNormal(p.xz, t), r = reflect(rd, n);
  float fres = .02 + .98 * pow(1. - max(dot(-rd, n), 0.), 5.);
  vec3 refl = shadeHall(p + n * .05, r);
  float lit = sunVisible(p);
  vec3 deep = vec3(.01, .06, .075) + vec3(.03, .2, .2) * lit * .6;   // turquoise where the sun reaches into the water
  vec3 col = mix(deep, refl, fres);
  col += sunLight() * pow(max(dot(r, SUN), 0.), 300.) * .5 * lit;
  return col;
}
void main() {
  vec2 uv = (vUv - .5) * vec2(uRes.x / uRes.y, 1.);
  SUN_EL = uSunEl; SUN = uSun;
  float walk = smoothstep(0., 1., uProg);
  vec3 ro = vec3(9. + uMouse.x * 2., 5.5 - uMouse.y * 1.5 + sin(uTime * .4) * .15, -22. + walk * 70.);
  vec3 ta = vec3(-4. + uMouse.x * 4., 9., 120. + walk * 40.);
  vec3 rd = camera(ro, ta, uv, 1.25);

  int face; float th = hall(ro, rd, face);
  float tw = hitWater(ro, rd);
  vec3 col; float tEnd;
  if (tw > 0. && tw < th) { col = sea(ro + rd * tw, rd, tw); tEnd = tw; }
  else { col = shadeHall(ro, rd); tEnd = th; }

  // Light shafts: sun in the air wherever it falls through an arch.
  float shaft = 0., len = min(tEnd, 150.), jitter = hash12(gl_FragCoord.xy + fract(uTime) * 17.);
  for (int i = 0; i < 22; i++) { float s = (float(i) + jitter) / 22. * len; shaft += sunVisible(ro + rd * s); }
  float phase = .35 + .65 * pow(max(dot(rd, SUN), 0.), 4.);
  col += sunLight() * shaft / 22. * len * .00022 * phase;
  col *= 1.25;
  frag = vec4(col, 1.);
}`;

export const room = {
  id: 'room', fragment,
  // Late morning sun from the left, swinging so its patches drift across the water.
  sun: p => sunFrom(.5 - .14 * smooth(p), 2.35 - .35 * smooth(p))
};
