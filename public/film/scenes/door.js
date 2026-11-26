import { HEADER, NOISE, ATMOSPHERE, sunFrom } from './common.js?v=1';

// Chapter four: night over a still lake. A door stands alone in the water, half open,
// and through it is daylight: the golden desert from the opening chapter. Its light
// spills out across the lake.
const fragment = HEADER + NOISE + ATMOSPHERE + `
const vec3 DOOR = vec3(0., 0., 60.);
const float W = 1.25, HGT = 4.6;            // half width and height of the opening

// ---------------------------------------------------------------- night sky
vec3 milkyWay(vec3 rd) {
  // A band of light along a tilted great circle, with dark dust lanes through its core.
  vec3 axis = normalize(vec3(.35, .55, -.76));
  float b = dot(rd, axis), band = exp(-b * b * 22.);
  vec2 q = vec2(atan(rd.z, rd.x) * 3., b * 9.);
  float dust = smoothstep(.35, .7, fbm(q * 1.6 + 4.)) * exp(-b * b * 90.);
  float glow = band * (.55 + .45 * fbm(q * 2.5)) * (1. - dust * .8);
  vec3 tint = mix(vec3(.55, .6, .85), vec3(1., .86, .7), exp(-b * b * 60.));
  return tint * glow * .2;
}
vec3 nightSky(vec3 rd) {
  float h = max(rd.y, 0.);
  vec3 col = mix(vec3(.012, .02, .045), vec3(.002, .004, .012), pow(h, .5));
  col += vec3(.04, .03, .05) * exp(-h * 14.);                       // last light low on the horizon
  col += milkyWay(rd);
  col += vec3(.95, .95, 1.) * stars(rd, .006) * .55;
  col += vec3(1., .9, .8) * stars(rd * 1.7, .0015) * .9;
  return col;
}
float mountains(float az) { return .025 + .045 * fbm(vec2(az * 6., 1.3)) + .02 * noise(vec2(az * 30., 2.)); }

// ---------------------------------------------------------------- the world beyond the door
vec3 beyond(vec3 rd, vec3 hit) {
  // Daylight from another place, laid out across the doorway itself so it reads at any
  // distance: blue sky, a low sun inside the frame, and a line of dunes. A little
  // parallax from the view direction makes it feel deep.
  vec3 q = hit - DOOR;
  vec2 f = vec2(q.x / W, q.y / HGT) + rd.xy * vec2(.6, .5);
  float horizon = .3 + .03 * sin(f.x * 5. + 1.) + .02 * sin(f.x * 13.);
  vec3 col = mix(vec3(1.25, .9, .6), vec3(.25, .48, .95), smoothstep(horizon, horizon + .65, f.y));
  vec2 sunAt = vec2(.28, .44); float d = length((f - sunAt) * vec2(W / HGT * 2., 1.));
  col += vec3(4., 2.6, 1.4) * exp(-d * 9.) + vec3(16.) * smoothstep(.045, .035, d);
  if (f.y < horizon) {
    float shade = smoothstep(horizon, horizon - .25, f.y) * .5 + .5 * smoothstep(0., .6, sin(f.x * 8. + f.y * 14.) * .5 + .5);
    col = mix(vec3(1.05, .64, .33), vec3(.62, .33, .17), shade);
  }
  return col * .32;
}
// ---------------------------------------------------------------- the door
float box(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.); }
float doorSDF(vec3 p, out int part) {
  vec3 q = p - DOOR;
  float frame = max(box(q - vec3(0, HGT * .5 + .12, 0), vec3(W + .22, HGT * .5 + .22, .14)), -box(q - vec3(0, HGT * .5, 0), vec3(W, HGT * .5, .5)));
  // The leaf hangs from the left jamb, swung open toward us.
  vec3 l = q - vec3(-W, 0, 0); l.xz = rot(-1.05) * l.xz;
  float leaf = box(l - vec3(W, HGT * .5, -.06), vec3(W - .02, HGT * .5 - .02, .06));
  part = frame < leaf ? 0 : 1;
  return min(frame, leaf);
}
float doorMap(vec3 p) { int k; return doorSDF(p, k); }
vec3 doorNormal(vec3 p) { vec2 e = vec2(.003, 0); return normalize(vec3(doorMap(p + e.xyy) - doorMap(p - e.xyy), doorMap(p + e.yxy) - doorMap(p - e.yxy), doorMap(p + e.yyx) - doorMap(p - e.yyx))); }
float marchDoor(vec3 ro, vec3 rd) {
  float t = 0.;
  for (int i = 0; i < 90; i++) { float d = doorMap(ro + rd * t); if (d < .001) return t; t += d; if (t > 200.) break; }
  return -1.;
}
// Does a ray pass through the open doorway (from the front)? Returns the distance, or -1.
float throughDoor(vec3 ro, vec3 rd) {
  if (rd.z <= 0.) return -1.;
  float t = (DOOR.z - ro.z) / rd.z; vec3 p = ro + rd * t - DOOR;
  return (abs(p.x) < W && p.y > 0. && p.y < HGT) ? t : -1.;
}
// Light from the doorway falling on a point in front of it (a soft trapezoid on the water).
float spill(vec3 p) {
  if (p.z > DOOR.z) return 0.;
  vec3 L = normalize(vec3(-.12, .3, 1.));                              // toward the light inside the door
  float t = (DOOR.z - p.z) / L.z; vec3 q = p + L * t - DOOR;
  float dx = abs(q.x) - W, dy = max(-q.y, q.y - HGT);
  return smoothstep(.6, -.4, max(dx, dy)) * exp(-(DOOR.z - p.z) * .05);
}

void main() {
  vec2 uv = (vUv - .5) * vec2(uRes.x / uRes.y, 1.);
  SUN_EL = uSunEl; SUN = uSun;
  float near = smoothstep(0., 1., uProg);
  vec3 ro = vec3(3.2 + uMouse.x * 1.5, 1.7 - uMouse.y * .6, 34. + near * 16.);
  vec3 ta = vec3(-.6 + uMouse.x * 2., 2.6, 60.);
  vec3 rd = camera(ro, ta, uv, 1.6);

  vec3 col; float t;
  float td = marchDoor(ro, rd), tp = throughDoor(ro, rd), tw = rd.y < 0. ? -ro.y / rd.y : -1.;
  vec3 warm = vec3(1.3, .82, .48);
  if (td > 0. && (tw < 0. || td < tw)) {
    vec3 p = ro + rd * td, n = doorNormal(p); int part; doorSDF(p, part);
    vec3 alb = part == 0 ? vec3(.62, .52, .4) : vec3(.18, .3, .28);
    float wood = fbm(vec2(p.y * 9., (p.x + p.z) * 1.5));
    alb *= .75 + .4 * wood;
    // Lit by the starlit sky and, on its edges, by the daylight streaming through.
    col = alb * (vec3(.02, .03, .06) * (.5 + .5 * n.y) + warm * .9 * max(dot(n, normalize(vec3(.1, .2, -1.))), 0.) * smoothstep(1.4, .2, abs(p.x - DOOR.x) - W + .3) * step(p.z, DOOR.z + .2));
    t = td;
  } else if (tp > 0. && (tw < 0. || tp < tw)) {
    col = beyond(rd, ro + rd * tp); t = tp;
  } else if (tw > 0.) {
    vec3 p = ro + rd * tw;
    // Barely a ripple: the lake is a mirror.
    vec2 g = vec2(noise(p.xz * 1.5 + uTime * .2), noise(p.xz * 1.5 + 7. - uTime * .2)) - .5;
    vec3 n = normalize(vec3(g.x * .03, 1., g.y * .03)), r = reflect(rd, n);
    float fres = .03 + .97 * pow(1. - max(dot(-rd, n), 0.), 5.);
    vec3 refl;
    float rdoor = marchDoor(p + n * .01, r), rthrough = throughDoor(p, r);
    if (rdoor > 0. && (rthrough < 0. || rdoor < rthrough)) refl = vec3(.02, .02, .03);
    else if (rthrough > 0.) refl = beyond(r, p + r * rthrough);
    else refl = r.y < mountains(atan(r.z, r.x)) ? vec3(.004, .006, .012) : nightSky(r);
    col = refl * mix(.35, 1., fres) + vec3(.002, .004, .008);
    col += warm * spill(p) * .16;
    t = tw;
  } else {
    col = rd.y < mountains(atan(rd.z, rd.x)) ? vec3(.004, .006, .012) + vec3(.01, .012, .02) * smoothstep(-.02, .06, rd.y) : nightSky(rd);
    t = 1e3;
  }
  // The doorway's light hangs in the air in front of it.
  float glow = 0.;
  for (int i = 0; i < 12; i++) { float s = (float(i) + hash12(gl_FragCoord.xy)) / 12. * min(t, DOOR.z - ro.z + 4.); glow += spill(ro + rd * s); }
  col += warm * glow / 12. * .03;
  col *= 2.2;
  frag = vec4(col, 1.);
}`;

export const door = {
  id: 'door', fragment,
  // Deep night: the sun is far below the horizon so the sky lookup is dark.
  sun: () => sunFrom(-.35, 1.2)
};
