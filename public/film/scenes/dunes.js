import { HEADER, NOISE, ATMOSPHERE, sunFrom, smooth } from './common.js?v=1';

// Chapters one and six: a glass prism floating over sand dunes. In the opening, scroll
// carries the sun from blue hour to sunrise and the prism throws a spectrum across the
// sand. In the finale the same desert is seen at sunset, the sun going down behind it.
const fragment = HEADER + `uniform float uVariant;` + NOISE + ATMOSPHERE + `
const vec3 PRISM = vec3(6., 17., 52.);

float profile(float s) { float f = fract(s); return f < .74 ? pow(f / .74, 1.35) : pow((1. - f) / .26, 2.1); }
float H(vec2 p) {
  float low = noise(p * .008), amp = .5 + .5 * low;
  float big = profile(dot(p, vec2(.62, -.78)) / 44. + 2.2 * low + .55 * noise(p * .032)) * 9.5 * amp;
  float small = profile(dot(p, vec2(.5, -.87)) / 12.5 + 3.1 * low) * 1.4 * (1.25 - amp);
  return big + small + 4. * low - 2.;
}
vec3 duneNormal(vec2 p, float t) {
  float e = .02 + t * .0015;
  return normalize(vec3(H(p - vec2(e, 0)) - H(p + vec2(e, 0)), 2. * e, H(p - vec2(0, e)) - H(p + vec2(0, e))));
}
float marchDunes(vec3 ro, vec3 rd, out bool hit) {
  float t = 1., lt = 1., ld = ro.y - H(ro.xz); hit = false;
  for (int i = 0; i < 110; i++) {
    vec3 p = ro + rd * t; float d = p.y - H(p.xz);
    if (d < .002 * t) { hit = true; return lt + (t - lt) * ld / (ld - d); }
    lt = t; ld = d; t += max(d * .55, .02 + t * .006);
    if (t > 1400. || p.y > 60.) break;
  }
  return t;
}
float duneShadow(vec3 p) {
  if (SUN.y < -.01) return 0.;
  float res = 1., t = .4;
  for (int i = 0; i < 26; i++) {
    vec3 q = p + SUN * t; float d = q.y - H(q.xz);
    res = min(res, 8. * d / t); if (res < .001 || q.y > 22.) break;
    t += clamp(d * .8, .5, 10.);
  }
  return clamp(res, 0., 1.);
}

// ---------------------------------------------------------------- the prism
vec3 prismLocal(vec3 p) {
  p -= PRISM; p.y -= sin(uTime * .35) * .25;
  p.xz = rot(uTime * .06 + uProg * .9 + 2.2 + uVariant * 1.3) * p.xz;
  return vec3(p.x, p.z, p.y);                    // stand the triangular prism upright
}
float prismSDF(vec3 p) {
  vec3 q = prismLocal(p), a = abs(q);
  return max(a.z - 4.6, max(a.x * .866025 + q.y * .5, -q.y) - 1.25) - .12;
}
vec3 prismNormal(vec3 p) { vec2 e = vec2(.004, 0); return normalize(vec3(prismSDF(p + e.xyy) - prismSDF(p - e.xyy), prismSDF(p + e.yxy) - prismSDF(p - e.yxy), prismSDF(p + e.yyx) - prismSDF(p - e.yyx))); }
float marchPrism(vec3 ro, vec3 rd) {
  vec3 oc = ro - PRISM; float b = dot(oc, rd), c = dot(oc, oc) - 30.; if (b * b - c < 0.) return -1.;
  float t = max(-b - sqrt(b * b - c), 0.);
  for (int i = 0; i < 64; i++) { float d = prismSDF(ro + rd * t); if (d < .001) return t; t += d; if (t > -b + sqrt(b * b - c)) break; }
  return -1.;
}
float prismEdge(vec3 p) {
  vec3 q = prismLocal(p);
  float a = q.x * .866025 + q.y * .5, b = -q.x * .866025 + q.y * .5, c = -q.y, z = abs(q.z) - 4.6 + 1.25;
  float m1 = max(max(a, b), c), m2 = a + b + c - m1 - min(min(a, b), c);
  return max(smoothstep(.16, .02, m1 - m2), smoothstep(.16, .02, abs(m1 - z)));
}

// ---------------------------------------------------------------- light on sand
vec3 sand(vec3 p) { return mix(vec3(.74, .47, .28), vec3(.86, .6, .38), fbm(p.xz * .08)); }
vec3 caustic(vec3 p) {
  // The fan of colour runs from the prism's foot toward the camera's side of the sand.
  vec2 dir = mix(vec2(-.42, -1.), vec2(.55, -1.), uVariant);
  vec2 rel = p.xz - PRISM.xz, away = normalize(dir), side = vec2(-away.y, away.x);
  float along = dot(rel, away); if (along < 1.) return vec3(0.);
  float lat = dot(rel, side), width = 1.2 + along * .16, x = lat / width;
  float band = smoothstep(1.2, .5, abs(x)) * smoothstep(1., 9., along) * exp(-along * .028);
  return spectrum(clamp(x * .5 + .5, 0., 1.)) * band * 2.6 * smoothstep(-.01, .03, SUN_EL);
}
vec3 shadeSand(vec3 p, vec3 rd, float t) {
  vec3 n = duneNormal(p.xz, t);
  float fade = exp(-t * .045) * smoothstep(.75, .95, n.y);
  float w = dot(p.xz, vec2(-4., 5.2)) + noise(p.xz * .9) * 7.;
  n = normalize(n + vec3(4., 0., -5.2) * cos(w) * .018 * fade);
  vec3 sun = sunLight(), sh = vec3(duneShadow(p + n * .05));
  float diff = max(dot(n, SUN), 0.);
  vec3 amb = skyLUT(vec3(0., 1., 0.)) * (.55 + .45 * n.y) + skyLUT(normalize(vec3(-SUN.x, .2, -SUN.z))) * .25 * (1. - n.y);
  vec3 alb = sand(p);
  vec3 col = alb * (sun * diff * sh * .085 + amb * 1.05);
  float g = hash12(floor(p.xz * 40.));
  col += sun * step(.996, g) * pow(max(dot(reflect(rd, n), SUN), 0.), 6.) * sh * .12 * exp(-t * .08);
  col += caustic(p) * sun * .085 * sh * max(n.y, 0.) * alb * 2.;
  return col;
}
vec3 environment(vec3 o, vec3 d) {
  if (d.y > -.01) return sky(d);
  float t = (o.y - 1.) / -d.y; vec3 p = o + d * t;
  vec3 col = sand(p) * (sunLight() * max(SUN.y, 0.) * .085 + skyLUT(vec3(0, 1, 0)) * .75);
  return mix(col, fogColor(d), 1. - exp(-t * .0012));
}
vec3 shadePrism(vec3 p, vec3 rd) {
  vec3 n = prismNormal(p);
  float cosi = max(dot(-rd, n), 0.), fres = .04 + .96 * pow(1. - cosi, 5.);
  vec3 col = vec3(0.);
  for (int c = 0; c < 3; c++) {
    float ior = 1.46 + float(c) * .045;
    vec3 r1 = refract(rd, n, 1. / ior), q = p - n * .02;
    for (int k = 0; k < 24; k++) { float d = -prismSDF(q); if (d < .003) break; q += r1 * max(d, .02); }
    vec3 m = prismNormal(q), r2 = refract(r1, -m, ior);
    if (dot(r2, r2) < .5) r2 = reflect(r1, -m);
    col[c] = environment(q + r2 * .05, r2)[c];
  }
  col = col * vec3(.94, .98, 1.) + fres * environment(p, reflect(rd, n));
  float edge = prismEdge(p);
  vec3 rim = sunLight() * .03 * (.4 + .6 * max(dot(n, SUN), 0.)) + skyLUT(normalize(vec3(n.x, abs(n.y) + .2, n.z))) * 2.;
  col = mix(col, col * .6 + rim, edge * .85);
  col += sunLight() * pow(max(dot(reflect(rd, n), SUN), 0.), 60.) * .2;
  return col;
}

void main() {
  vec2 uv = (vUv - .5) * vec2(uRes.x / uRes.y, 1.);
  SUN_EL = uSunEl; SUN = uSun;
  vec3 ro, ta;
  if (uVariant < .5) {
    // A slow dolly toward the prism; the pointer adds a little parallax.
    ro = vec3(-2. + uMouse.x * 1.2, 0., -40. + uProg * 16. + sin(uTime * .05) * 1.5);
    ro.y = max(H(ro.xz), 6.) + 9. - uMouse.y * .8 - uProg * 2.;
    ta = vec3(1. + uMouse.x * 2., 11. + uProg * 2., 52.);
  } else {
    // The finale: a low arc around the prism as the sun goes down behind it.
    float a = .9 - uProg * .5;
    ro = PRISM + vec3(sin(a) * 46., 0., -cos(a) * 46.);
    ro.y = max(H(ro.xz), 5.) + 6. - uMouse.y * .8;
    ta = PRISM + vec3(uMouse.x * 3., -4. + uProg * 2., 0.);
  }
  vec3 rd = camera(ro, ta, uv, 1.75);

  bool hit; float t = marchDunes(ro, rd, hit);
  float tp = marchPrism(ro, rd);
  vec3 col;
  if (tp > 0. && (!hit || tp < t)) {
    col = shadePrism(ro + rd * tp, rd);
    col = mix(col, fogColor(rd), 1. - exp(-tp * .0012));
  } else if (hit) {
    vec3 p = ro + rd * t;
    col = shadeSand(p, rd, t);
    col = mix(col, fogColor(rd), 1. - exp(-t * .0011 - max(0., 4. - p.y) * t * .00005));
  } else col = sky(rd);
  col *= mix(4.8, .72, smoothstep(-.04, .14, SUN_EL)) * mix(1., .5, uVariant);
  frag = vec4(col, 1.);
}`;

const prismAzimuth = (x, z) => Math.atan2(52 - z, 6 - x);

export const dunes = {
  id: 'dunes', fragment, uniforms: { uVariant: 0 },
  // Blue hour to sunrise; the sun stands off to the right so its light rakes across the crests.
  sun: p => sunFrom(-.026 + .216 * smooth(p), prismAzimuth(0, -40) + .95 - .12 * p)
};
export const dunesFinale = {
  id: 'dunes-finale', fragment, uniforms: { uVariant: 1 },
  // Sunset: the sun sinks behind the prism as seen from the arcing camera.
  sun: p => {
    const a = .9 - p * .5, x = 6 + Math.sin(a) * 46, z = 52 - Math.cos(a) * 46;
    return sunFrom(.11 - .14 * smooth(p), prismAzimuth(x, z) + .06);
  }
};
