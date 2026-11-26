import { HEADER, NOISE, ATMOSPHERE, sunFrom, smooth } from './common.js?v=1';

// Chapter five: the moon has come down to the sea. At deep blue hour it fills a third
// of the sky, resting on the horizon, and lays a road of light across the swell toward
// a small boat.
const fragment = HEADER + NOISE + ATMOSPHERE + `
const vec3 MOON = vec3(-420., 230., 1500.);
const float MOON_R = 430.;
const vec3 BOAT = vec3(-60., .25, 230.);

float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  float a = hash13(i), b = hash13(i + vec3(1, 0, 0)), c = hash13(i + vec3(0, 1, 0)), d = hash13(i + vec3(1, 1, 0));
  float e = hash13(i + vec3(0, 0, 1)), f1 = hash13(i + vec3(1, 0, 1)), g = hash13(i + vec3(0, 1, 1)), h = hash13(i + vec3(1, 1, 1));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, f1, u.x), mix(g, h, u.x), u.y), u.z);
}
float fbm3(vec3 p) { float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise3(p); p = p * 2.03 + 1.7; a *= .5; } return v; }

// ---------------------------------------------------------------- the moon
float sphere(vec3 ro, vec3 rd, vec3 c, float r) { vec3 oc = ro - c; float b = dot(oc, rd), h = b * b - dot(oc, oc) + r * r; return h < 0. ? -1. : -b - sqrt(h); }
vec3 moonSurface(vec3 n, vec3 L) {
  float maria = smoothstep(.42, .62, fbm3(n * 2.2 + 3.));
  float craters = 0.;
  for (int i = 0; i < 3; i++) {
    vec3 q = n * (6. + float(i) * 9.); vec3 cell = floor(q); vec3 f = fract(q) - .5;
    float r = hash13(cell) * .35 + .1, d = length(f + (vec3(hash13(cell + 1.), hash13(cell + 2.), hash13(cell + 3.)) - .5) * .4);
    craters += (smoothstep(r, r * .8, d) * .35 - smoothstep(r * 1.15, r, d) * smoothstep(r * .8, r, d) * .5) * step(.55, hash13(cell + 9.));
  }
  float alb = (.62 - maria * .28 + fbm3(n * 24.) * .14) * (1. - craters * .35);
  // Rough surfaces stay bright right up to the terminator (no limb darkening).
  float lit = smoothstep(-.06, .25, dot(n, L));
  return vec3(1., .97, .92) * alb * lit * .3 + vec3(.006, .009, .015) * alb;          // faint earthshine on the dark side
}

// ---------------------------------------------------------------- the sea
float swell(vec2 p) {
  float t = uTime * .7, h = 0.;
  h += sin(dot(p, vec2(.2, .98)) * .11 + t) * .9;
  h += sin(dot(p, vec2(-.6, .8)) * .23 + t * 1.3) * .35;
  h += sin(dot(p, vec2(.9, .45)) * .47 + t * 1.8) * .15;
  return h + (noise(p * .35 + t * .2) - .5) * .25;
}
vec3 seaNormal(vec2 p, float t) {
  float e = .1 + t * .004;
  vec3 n = normalize(vec3(swell(p - vec2(e, 0)) - swell(p + vec2(e, 0)), 2. * e, swell(p - vec2(0, e)) - swell(p + vec2(0, e))));
  // Fine chop catches the moonlight in tiny glints.
  vec2 g = vec2(noise(p * 2.5 + uTime), noise(p * 2.5 + 9. - uTime)) - .5;
  return normalize(n + vec3(g.x, 0., g.y) * .35 * exp(-t * .004));
}
float hitSea(vec3 ro, vec3 rd) {
  if (rd.y >= 0.) return -1.;
  float t = (ro.y - 1.3) / -rd.y;
  for (int i = 0; i < 8; i++) { vec3 p = ro + rd * t; t += (p.y - swell(p.xz)) / max(-rd.y, .03) * .8; }
  return t;
}

// ---------------------------------------------------------------- a small boat
float boat(vec3 ro, vec3 rd) {
  vec3 o = ro - BOAT; o.y -= sin(uTime * .7 + 1.) * .2;
  vec3 r = vec3(2.6, .55, .8);                                      // the hull: a squashed ellipsoid cut at the waterline
  vec3 ocn = o / r, rdn = rd / r;
  float a = dot(rdn, rdn), b = dot(ocn, rdn), c = dot(ocn, ocn) - 1., h = b * b - a * c;
  float t = h < 0. ? -1. : (-b - sqrt(h)) / a;
  if (t > 0. && (o + rd * t).y < 0.) t = -1.;
  // A seated figure.
  float tf = sphere(ro, rd, BOAT + vec3(.4, .9 + sin(uTime * .7 + 1.) * .2, 0.), .42);
  if (tf > 0. && (t < 0. || tf < t)) t = tf;
  return t;
}

vec3 skyWithMoon(vec3 rd) {
  // Graded cooler: deep blue hour rather than the lookup's dusky grey.
  vec3 col = sky(rd) * vec3(.55, .75, 1.35) + mix(vec3(.012, .022, .05), vec3(.002, .004, .014), smoothstep(0., .6, rd.y)) + vec3(.9, .95, 1.) * stars(rd, .004) * .12 * smoothstep(.0, .25, rd.y);
  vec3 L = normalize(vec3(.75, .2, -.35));
  float tm = sphere(vec3(0., 3., 0.), rd, MOON, MOON_R);
  // A soft halo, then the disc itself seen through the air (reddened low down).
  vec3 toMoon = normalize(MOON - vec3(0, 3, 0));
  col += vec3(.9, .85, .8) * pow(max(dot(rd, toMoon), 0.), 18.) * .012;
  if (tm > 0.) {
    vec3 n = normalize(vec3(0., 3., 0.) + rd * tm - MOON);
    float air = exp(-max(rd.y, 0.) * 14.);
    vec3 trans = exp(-vec3(.12, .28, .62) * air * 2.2);
    col = moonSurface(n, L) * trans + skyLUT(rd) * vec3(.55, .75, 1.35) * .6;
  }
  return col;
}

void main() {
  vec2 uv = (vUv - .5) * vec2(uRes.x / uRes.y, 1.);
  SUN_EL = uSunEl; SUN = uSun;
  float rise = smoothstep(0., 1., uProg);
  vec3 ro = vec3(6. + uMouse.x * 2., 3.4 + rise * 9. - uMouse.y * 1.2, 40. - rise * 70.);
  vec3 ta = vec3(-30. + uMouse.x * 10., 120. - rise * 20., 1500.);
  vec3 rd = camera(ro, ta, uv, 1.5);

  vec3 col;
  float tb = boat(ro, rd), ts = hitSea(ro, rd);
  vec3 toMoon = normalize(MOON - ro);
  if (tb > 0. && (ts < 0. || tb < ts)) {
    col = vec3(.004, .005, .008) + vec3(.4, .38, .35) * .02 * pow(max(dot(normalize(ro + rd * tb - BOAT), toMoon), 0.), 2.);
  } else if (ts > 0.) {
    vec3 p = ro + rd * ts, n = seaNormal(p.xz, ts), r = reflect(rd, n);
    float fres = .02 + .98 * pow(1. - max(dot(-rd, n), 0.), 5.);
    vec3 refl = skyWithMoon(r);
    if (boat(p + n * .05, r) > 0.) refl *= .05;
    col = mix(vec3(.002, .006, .012), refl, fres);
    // The moon's road: glitter where the swell faces it.
    col += vec3(1., .95, .88) * pow(max(dot(r, toMoon), 0.), 120.) * .35 * smoothstep(0., .2, toMoon.y);
    col = mix(col, fogColor(rd) * vec3(.55, .75, 1.35), 1. - exp(-ts * .0012));
  } else col = skyWithMoon(rd);
  col *= 3.2;
  frag = vec4(col, 1.);
}`;

export const moon = {
  id: 'moon', fragment,
  // Deep blue hour: the sun just below the horizon behind and to the right.
  sun: p => sunFrom(-.075 - .03 * smooth(p), -.6)
};
