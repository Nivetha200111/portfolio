// The film's camera path around the island. Each chapter opens on one shot and slowly
// drifts to a second; between chapters the camera flies to the next place, rising in an
// arc so it never cuts through a building. Positions are in the island's world units.
const KEYS = [
  // 01 · Code alchemist: down out of the sky onto the floating island.
  { g: 0, position: [-6, 30, 74], target: [0, 3, 0], fov: 36 },
  { g: .85, position: [15, 8.5, 19], target: [0, 1.4, 0], fov: 36 },
  // 02 · Experience: the windmill, its sails turning.
  { g: 1.08, position: [11.5, 6.8, 7.5], target: [3.4, 3.4, -1.1], fov: 38 },
  { g: 1.88, position: [9.2, 5.2, 5.6], target: [3.5, 3.6, -.8], fov: 38 },
  // 03 · Projects: the workshop cottage.
  { g: 2.08, position: [.6, 2.8, 7.4], target: [-2.6, 1.6, .3], fov: 40 },
  { g: 2.88, position: [-1.1, 1.7, 4.9], target: [-2.7, 1.5, .3], fov: 40 },
  // 04 · Skills: the greenhouse door, beside the pond that pours upward.
  { g: 3.08, position: [-.2, 2, 8.8], target: [2.8, 1.8, 3.1], fov: 40 },
  { g: 3.88, position: [1.3, 1.4, 6.9], target: [2.9, 2.4, 2.8], fov: 40 },
  // 05 · Recognition: the wishing tree and the observatory as evening comes.
  { g: 4.08, position: [-6.4, 3.9, 3.6], target: [-.7, 2.6, -2.5], fov: 40 },
  { g: 4.88, position: [-3.6, 2.4, .4], target: [.1, 2.8, -3.3], fov: 40 },
  // 06 · Contact: the mailbox at magic hour, then all the way back out.
  { g: 5.08, position: [7.4, 1.9, 7], target: [4.5, 1.4, 2.7], fov: 40 },
  { g: 5.6, position: [9.5, 3.2, 10], target: [3.2, 1.5, 1.5], fov: 40 },
  { g: 6, position: [17, 9.5, 22], target: [0, 1.4, 0], fov: 36 }
];

const ease = t => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

export function islandShot(g, { mobile = false } = {}) {
  let i = 0;
  while (i < KEYS.length - 2 && g > KEYS[i + 1].g) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const raw = Math.min(1, Math.max(0, (g - a.g) / (b.g - a.g)));
  // Within a chapter the drift is gentle and linear-ish; the flights between chapters ease.
  const between = Math.floor(a.g) !== Math.floor(b.g - .001) || b.g - a.g < .3;
  const t = between ? ease(raw) : raw * .85 + ease(raw) * .15;
  const position = a.position.map((v, k) => lerp(v, b.position[k], t));
  const target = a.target.map((v, k) => lerp(v, b.target[k], t));
  if (between) position[1] += Math.sin(Math.PI * t) * 3.5;
  let fov = lerp(a.fov, b.fov, t);
  if (mobile) {
    // A portrait screen is narrow: step back along the line of sight and lift the subject.
    for (let k = 0; k < 3; k++) position[k] = target[k] + (position[k] - target[k]) * 1.45;
    target[1] -= .6; fov += 8;
  }
  return { position, target, fov, offset: mobile ? 0 : .17 };
}
