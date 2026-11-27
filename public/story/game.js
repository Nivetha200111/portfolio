import * as THREE from './vendor/three.module.js';

// Island hop: the visitor steers a small wisp of light across the floating islands and
// collects eight glowing seeds. Stepping stones rise out of the clouds when the game
// starts and sink again when it ends. Ground heights come from the same function that
// shaped the islands, so the wisp stands exactly on the grass it sees.
//
// Moves: run, jump, a second jump in mid-air, hold jump to glide, and a dash. The pond's
// upward-pouring water is an updraft, glowing flowers bounce you high, and a few stones
// drift. A golden seed hides at the top of the water column.

const RX = 7.4, RZ = 6.2;          // the main island's footprint (see realism.js)
const GRAVITY = 24, JUMP = 9.1, AIR_JUMP = 8.2, SPEED = 5.6, STEP = .32, RADIUS = .22;
const GLIDE_FALL = 2.3, DASH_SPEED = 15, DASH_TIME = .2, BOUNCE = 15.5;
const COYOTE = .12, BUFFER = .14, FALL_LIMIT = -14;
const MEDALS = [[75, 'Gold'], [120, 'Silver'], [Infinity, 'Bronze']];
// Stepping stones as [x, y, z, scale, holds a seed, drift]. The route runs east off the
// island, drops to the low islet, climbs round the back and ends on top of the
// upside-down islet. Drift is [amplitude, speed]: the stone slides along x.
const STONES = [
  [9.4, .5, -2.6, .6],
  [11.2, .9, -4.6, .55, true],
  // ... the existing low islet sits here and holds a seed
  [12.6, -2.4, -8.6, .55],
  [11, -1, -11, .6, true],
  [8.2, .2, -11.6, .6, false, [1.1, .8]],
  [5, 1, -10.4, .7, true],
  [1.6, 1.8, -10.8, .6, false, [.9, 1.1]],
  [-1.8, 2.8, -10, .65, true],
  [-5, 3.8, -9.2, .6],
  [-7.6, 5.2, -9.8, .55, true, [.7, .9]],
  [-10.4, 6.4, -9, .55],
  [-12.2, 7.6, -6.6, .55, true],
  [-12, 9, -4.4, .55],
  [-11.2, 10.3, -7.2, .55],
  [-9.5, 11.75, -6, .6, true]
];
const START = new THREE.Vector3(6.1, 0, .5);
const UPDRAFT = { x: 2.95, z: 2.6, radius: .9, top: 9.2, lift: 40, max: 8 };
const GOLDEN = new THREE.Vector3(3, 10.1, 2.6);

function glowTexture(inner, outer) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d'), gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, inner); gradient.addColorStop(.35, outer); gradient.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gradient; g.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
const clockText = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

// Small synthesized sound effects: no files to download.
function createSounds() {
  let context = null, master = null, on = localStorage.getItem('island-hop-sound') !== 'off';
  const ready = () => {
    if (!on) return null;
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext(); master = context.createGain(); master.gain.value = .2; master.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume();
    return context;
  };
  function tone(from, to, duration, type = 'sine', volume = .5, delay = 0) {
    const c = ready(); if (!c) return;
    const t = c.currentTime + delay, osc = c.createOscillator(), gain = c.createGain();
    osc.type = type; osc.frequency.setValueAtTime(from, t); osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(volume, t + .012); gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    osc.connect(gain).connect(master); osc.start(t); osc.stop(t + duration + .02);
  }
  function whoosh(duration, volume, from, to) {
    const c = ready(); if (!c) return;
    const t = c.currentTime, buffer = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
    source.buffer = buffer; filter.type = 'bandpass'; filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(from, t); filter.frequency.exponentialRampToValueAtTime(to, t + duration);
    gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    source.connect(filter).connect(gain).connect(master); source.start(t);
  }
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19];
  return {
    get on() { return on; },
    toggle() { on = !on; localStorage.setItem('island-hop-sound', on ? 'on' : 'off'); if (!on && context) context.suspend(); return on; },
    jump: () => tone(380, 640, .13, 'triangle', .3),
    air: () => { tone(620, 1180, .16, 'sine', .28); tone(930, 1760, .12, 'sine', .12, .03); },
    land: force => whoosh(.12, Math.min(.45, .08 + force * .025), 700, 160),
    bounce: () => { tone(160, 760, .34, 'sine', .42); tone(240, 1140, .26, 'triangle', .14, .02); },
    dash: () => whoosh(.26, .32, 500, 2600),
    seed: n => { const base = 523.25 * 2 ** (SCALE[Math.min(n, SCALE.length - 1)] / 12); tone(base, base, .5, 'sine', .32); tone(base * 2, base * 2, .35, 'sine', .1, .04); tone(base * 1.5, base * 1.5, .4, 'triangle', .12, .09); },
    golden: () => [0, 4, 7, 12, 16].forEach((s, i) => tone(784 * 2 ** (s / 12), 784 * 2 ** (s / 12), .35, 'sine', .22, i * .06)),
    fall: () => tone(520, 110, .55, 'sine', .25),
    finish: () => [0, 4, 7, 12, 7, 12, 16, 19].forEach((s, i) => tone(523.25 * 2 ** (s / 12), 523.25 * 2 ** (s / 12), .45, i % 2 ? 'triangle' : 'sine', .2, i * .09)),
    dispose() { context?.close(); context = null; }
  };
}

export function createIslandGame({ scene, camera, host, world, kit, heightAt, solids = [], onExit }) {
  const owned = [], ownedTextures = [];
  const own = thing => { owned.push(thing); return thing; };
  const root = new THREE.Group(); scene.add(root);
  const sounds = createSounds();

  // ------------------------------------------------------------------ platforms
  const platforms = [];
  STONES.forEach(([x, y, z, s, seed, drift], i) => {
    const group = kit.isletTop.clone(); // shares geometry and materials with the islets
    group.scale.setScalar(s); group.rotation.y = i * 1.7;
    group.position.set(x, y - 18, z);
    kit.floating.add(group);
    platforms.push({ group, top: group.children[0], seed, made: { x, base: y, phase: i * .9, delay: .25 + i * .07, drift }, last: new THREE.Vector3() });
  });
  // The low islet already in the scenery is part of the route.
  platforms.splice(2, 0, { group: kit.upright, top: kit.upright.children[0].children[0], seed: true, made: null, last: new THREE.Vector3() });
  platforms.forEach(p => p.last.copy(p.group.position));

  const probe = new THREE.Vector3();
  // Height of the grass on one platform under (x, z), or -Infinity off its edge.
  function platformTop(p, x, z) {
    p.group.updateMatrixWorld(true);
    p.top.worldToLocal(probe.set(x, p.group.position.y, z));
    if ((probe.x / RX) ** 2 + (probe.z / RZ) ** 2 > .9) return -Infinity;
    probe.y = heightAt(probe.x, probe.z);
    return p.top.localToWorld(probe).y;
  }
  const mainTop = (x, z) => ((x / RX) ** 2 + (z / RZ) ** 2 > .94 ? -Infinity : heightAt(x, z) + world.position.y);

  // Buildings are boxes: walls from the side, roofs you can land on.
  const boxes = solids.filter(object => object.visible !== false).map(object => {
    const box = new THREE.Box3().setFromObject(object);
    return { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, top: box.max.y - world.position.y, bottom: box.min.y - world.position.y };
  }).filter(b => b.maxX - b.minX < 4 && b.maxZ - b.minZ < 4);
  const inBox = (b, x, z, pad) => x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad;

  // Highest surface under (x, z) that is no more than `reach` above `feet`. Also notes
  // which platform it was, so a drifting stone can carry the wisp.
  let groundPlatform = null;
  function groundAt(x, z, feet, reach = STEP) {
    let best = mainTop(x, z); groundPlatform = null;
    if (best > feet + reach) best = -Infinity;
    for (const p of platforms) { const h = platformTop(p, x, z); if (h <= feet + reach && h > best) { best = h; groundPlatform = p; } }
    for (const b of boxes) { const h = b.top + world.position.y; if (inBox(b, x, z, 0) && h <= feet + reach && h > best) { best = h; groundPlatform = null; } }
    return best;
  }

  // ------------------------------------------------------------------ the wisp
  const glow = glowTexture('rgba(255,247,220,1)', 'rgba(255,190,110,.55)'); ownedTextures.push(glow);
  const seedGlow = glowTexture('rgba(230,255,248,1)', 'rgba(120,230,210,.5)'); ownedTextures.push(seedGlow);
  const goldGlow = glowTexture('rgba(255,250,215,1)', 'rgba(255,196,64,.6)'); ownedTextures.push(goldGlow);
  const bloomGlow = glowTexture('rgba(255,235,255,1)', 'rgba(214,120,255,.55)'); ownedTextures.push(bloomGlow);
  const dustTexture = glowTexture('rgba(255,244,226,.85)', 'rgba(230,214,190,.3)'); ownedTextures.push(dustTexture);
  const shadowTexture = glowTexture('rgba(0,0,0,.75)', 'rgba(0,0,0,.35)'); ownedTextures.push(shadowTexture);
  const additive = (map, color) => own(new THREE.SpriteMaterial({ map, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const player = new THREE.Group(); root.add(player);
  const core = new THREE.Mesh(own(new THREE.SphereGeometry(.17, 24, 16)), own(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 2.3, 1.5) })));
  core.position.y = .34; player.add(core);
  const halo = new THREE.Sprite(additive(glow, '#ffd7a0'));
  halo.scale.setScalar(1.15); halo.position.y = .34; player.add(halo);
  const trailMaterial = additive(glow, '#ffc988');
  const trail = Array.from({ length: 14 }, () => { const sprite = new THREE.Sprite(trailMaterial.clone()); owned.push(sprite.material); root.add(sprite); return sprite; });
  const history = [];
  const shadow = new THREE.Mesh(own(new THREE.CircleGeometry(.34, 24)), own(new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: .55 })));
  shadow.rotation.x = -Math.PI / 2; root.add(shadow);

  // ------------------------------------------------------------------ seeds
  const seedGeometry = own(new THREE.IcosahedronGeometry(.14, 1));
  const seedMaterial = own(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 2.6, 2.3) }));
  const beamGeometry = own(new THREE.CylinderGeometry(.05, .05, 7, 8, 1, true));
  const beamMaterial = own(new THREE.MeshBasicMaterial({ color: '#9ef0dc', transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending }));
  const seeds = platforms.filter(p => p.seed).map(platform => {
    const group = new THREE.Group(); root.add(group);
    group.add(new THREE.Mesh(seedGeometry, seedMaterial));
    const sprite = new THREE.Sprite(additive(seedGlow, '#b8fff0')); sprite.scale.setScalar(.9); group.add(sprite);
    const beam = new THREE.Mesh(beamGeometry, beamMaterial); beam.position.y = 3.5; group.add(beam);
    return { group, platform, taken: false };
  });
  // The golden seed: a secret at the top of the water column, worth five seconds.
  const golden = new THREE.Group(); root.add(golden); golden.position.copy(GOLDEN);
  golden.add(new THREE.Mesh(own(new THREE.IcosahedronGeometry(.2, 1)), own(new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.3, .8) }))));
  const goldenHalo = new THREE.Sprite(additive(goldGlow, '#ffe3a0')); goldenHalo.scale.setScalar(1.4); golden.add(goldenHalo);
  let goldenTaken = false;

  // ------------------------------------------------------------------ bounce flowers
  // A glowing ring on the grass; land on it and it throws you high.
  const ringGeometry = own(new THREE.TorusGeometry(.42, .055, 10, 40));
  const ringMaterial = own(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.1, 2.6) }));
  const padGeometry = own(new THREE.CircleGeometry(.4, 32));
  const padMaterial = own(new THREE.MeshBasicMaterial({ map: bloomGlow, color: '#f0c8ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const flowers = [
    { x: -5.4, z: -3, platform: null },          // north-west of the island: a shortcut round the back
    { x: .9, z: 0, platform: platforms[2] },      // on the low islet, beside its tree
    { x: 6.6, z: 2.3, platform: null }            // by the start, just for fun
  ].map(flower => {
    const group = new THREE.Group(); root.add(group);
    const ring = new THREE.Mesh(ringGeometry, ringMaterial); ring.rotation.x = Math.PI / 2; group.add(ring);
    const pad = new THREE.Mesh(padGeometry, padMaterial); pad.rotation.x = -Math.PI / 2; pad.position.y = .02; group.add(pad);
    const petals = new THREE.Sprite(additive(bloomGlow, '#e6b0ff')); petals.scale.setScalar(1.3); petals.position.y = .3; group.add(petals);
    return { ...flower, group, ring, petals, squash: 0 };
  });
  function flowerPosition(flower, out) {
    if (!flower.platform) return out.set(flower.x, mainTop(flower.x, flower.z), flower.z);
    const g = flower.platform.group.position;
    return out.set(g.x + flower.x, platformTop(flower.platform, g.x + flower.x, g.z + flower.z), g.z + flower.z);
  }

  // ------------------------------------------------------------------ particles
  const sparks = [];
  function burst(position, { count = 16, map = seedGlow, color = '#c8fff2', speed = 2.4, lift = 2, size = .25, life = .8, gravity = 6 } = {}) {
    for (let i = 0; i < count; i++) {
      // Each spark owns its material and frees it when it fades.
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      sprite.position.copy(position); sprite.scale.setScalar(size); root.add(sprite);
      const a = i / count * Math.PI * 2 + Math.random() * .3, s = speed * (.7 + Math.random() * .6);
      sparks.push({ sprite, velocity: new THREE.Vector3(Math.cos(a) * s, lift * (.6 + Math.random() * .8), Math.sin(a) * s), life, max: life, gravity, size });
    }
  }
  const dust = position => burst(position, { count: 10, map: dustTexture, color: '#fff2dc', speed: 1.6, lift: .5, size: .32, life: .45, gravity: 1 });

  // ------------------------------------------------------------------ heads-up display
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const hud = document.createElement('div'); hud.className = 'hop-hud';
  hud.innerHTML = `
    <div class="hop-top"><span class="hop-seeds">✦ 0 / ${seeds.length}</span><span class="hop-time">0:00</span></div>
    <p class="hop-intro">Collect the ${seeds.length} glowing seeds. The last one waits on top of the upside-down island.</p>
    <p class="hop-flash" aria-live="polite"></p>
    <p class="hop-hint">${touch ? 'Left thumb to move · Jump twice · Hold jump to glide · Dash · Drag to look' : 'WASD to move · Space to jump (twice) · Hold to glide · Shift to dash · Drag to look · Esc to stop'}</p>
    <div class="hop-corner"><button class="hop-sound" type="button" aria-pressed="${sounds.on}">${sounds.on ? 'Sound on' : 'Sound off'}</button><button class="hop-exit" type="button">Leave the game ✕</button></div>
    <div class="hop-fade"></div>
    <div class="hop-card" hidden><p class="hop-eyebrow">Island hop</p><h2>All ${seeds.length} seeds.</h2><p class="hop-medal"></p><p class="hop-result"></p><div><button class="hop-again" type="button">Play again</button><button class="hop-back" type="button">Back to the island</button></div></div>
    ${touch ? '<div class="hop-stick"><i></i></div><button class="hop-dash" type="button" aria-label="Dash">Dash</button><button class="hop-jump" type="button" aria-label="Jump">Jump</button>' : ''}`;
  host.appendChild(hud);
  const $ = selector => hud.querySelector(selector);
  const seedCounter = $('.hop-seeds'), clock = $('.hop-time'), fade = $('.hop-fade'), card = $('.hop-card'), flashLine = $('.hop-flash');
  let flashTimer = 0;
  const flash = text => { flashLine.textContent = text; flashLine.classList.remove('hop-flash-on'); void flashLine.offsetWidth; flashLine.classList.add('hop-flash-on'); flashTimer = 1.6; };

  // ------------------------------------------------------------------ input
  const keys = new Set();
  let jumpHeld = false, jumpQueued = 0, dashQueued = 0, stick = { x: 0, y: 0 }, stickId = null, dragId = null, dragX = 0, lastDrag = -10;
  const pressJump = () => { if (!jumpHeld) jumpQueued = BUFFER; jumpHeld = true; };
  const onKeyDown = event => {
    if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    const key = event.key.toLowerCase();
    if (key === 'escape') { event.preventDefault(); onExit?.(); return; }
    if ([' ', 'shift', 'w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
    if (key === ' ') pressJump();
    if (key === 'shift' && !event.repeat) dashQueued = BUFFER;
    keys.add(key);
  };
  const onKeyUp = event => { const key = event.key.toLowerCase(); keys.delete(key); if (key === ' ') jumpHeld = false; };
  const onBlur = () => { keys.clear(); jumpHeld = false; stick = { x: 0, y: 0 }; };
  window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('blur', onBlur);
  // Drag anywhere on the scene to turn the camera.
  const onPointerDown = event => { if (event.target !== host && event.target.tagName !== 'CANVAS') return; dragId = event.pointerId; dragX = event.clientX; };
  const onPointerMove = event => {
    if (event.pointerId === dragId) { yaw -= (event.clientX - dragX) * .006; dragX = event.clientX; lastDrag = clockTime; }
    if (event.pointerId === stickId) moveStick(event);
  };
  const onPointerUp = event => {
    if (event.pointerId === dragId) dragId = null;
    if (event.pointerId === stickId) { stickId = null; stick = { x: 0, y: 0 }; const knob = $('.hop-stick i'); if (knob) knob.style.transform = ''; }
  };
  host.addEventListener('pointerdown', onPointerDown); window.addEventListener('pointermove', onPointerMove); window.addEventListener('pointerup', onPointerUp); window.addEventListener('pointercancel', onPointerUp);
  let stickCenter = [0, 0];
  function moveStick(event) {
    const dx = event.clientX - stickCenter[0], dy = event.clientY - stickCenter[1], length = Math.hypot(dx, dy), max = 46;
    const k = length > max ? max / length : 1;
    stick = { x: dx * k / max, y: dy * k / max };
    $('.hop-stick i').style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }
  if (touch) {
    const pad = $('.hop-stick');
    pad.addEventListener('pointerdown', event => { event.preventDefault(); const r = pad.getBoundingClientRect(); stickCenter = [r.left + r.width / 2, r.top + r.height / 2]; stickId = event.pointerId; moveStick(event); });
    const jump = $('.hop-jump');
    jump.addEventListener('pointerdown', event => { event.preventDefault(); pressJump(); });
    jump.addEventListener('pointerup', () => { jumpHeld = false; }); jump.addEventListener('pointercancel', () => { jumpHeld = false; });
    $('.hop-dash').addEventListener('pointerdown', event => { event.preventDefault(); dashQueued = BUFFER; });
  }
  $('.hop-exit').addEventListener('click', () => onExit?.());
  $('.hop-back').addEventListener('click', () => onExit?.());
  $('.hop-again').addEventListener('click', () => restart());
  $('.hop-sound').addEventListener('click', event => { const on = sounds.toggle(); event.currentTarget.textContent = on ? 'Sound on' : 'Sound off'; event.currentTarget.setAttribute('aria-pressed', String(on)); });

  // ------------------------------------------------------------------ state
  const position = new THREE.Vector3(), velocity = new THREE.Vector3(), checkpoint = new THREE.Vector3(), facing = new THREE.Vector3(1, 0, 0);
  let grounded = false, coyote = 0, yaw = 0, clockTime = 0, elapsed = 0, running = false, finished = false, taken = 0, respawning = 0, squash = 0;
  let airJumps = 1, dashTime = 0, dashReady = true, gliding = false, shake = 0, standing = null, bonus = 0, launched = false;
  const cameraTarget = new THREE.Vector3(), cameraWanted = new THREE.Vector3();
  const savedFov = camera.fov, baseFov = 52;
  camera.fov = baseFov; camera.updateProjectionMatrix();

  function place(at) {
    position.copy(at); position.y = groundAt(at.x, at.z, 50, 0); if (!isFinite(position.y)) position.y = at.y;
    velocity.set(0, 0, 0); grounded = true; standing = groundPlatform;
  }
  function restart() {
    taken = 0; elapsed = 0; bonus = 0; running = false; finished = false; card.hidden = true; goldenTaken = false; golden.visible = true;
    seeds.forEach(seed => { seed.taken = false; seed.group.visible = true; });
    seedCounter.textContent = `✦ 0 / ${seeds.length}`; clock.textContent = '0:00';
    checkpoint.copy(START); place(START);
    yaw = Math.atan2(-(STONES[0][0] - START.x), -(STONES[0][2] - START.z)); // face the first stepping stone
  }
  restart();
  cameraTarget.copy(position);
  camera.position.copy(position).add(new THREE.Vector3(Math.sin(yaw) * 7, 3, Math.cos(yaw) * 7));

  function finish() {
    finished = true; running = false;
    const total = Math.max(0, elapsed - bonus);
    const best = Number(localStorage.getItem('island-hop-best')) || Infinity, record = total < best;
    if (record) localStorage.setItem('island-hop-best', String(total));
    const medal = MEDALS.find(([limit]) => total <= limit)[1];
    $('.hop-medal').textContent = `${medal} medal`;
    $('.hop-medal').dataset.medal = medal.toLowerCase();
    $('.hop-result').textContent = `${clockText(total)}${bonus ? ' (golden seed −5 s)' : ''} · ${record ? 'a new best' : `best ${clockText(best)}`}`;
    card.hidden = false; sounds.finish();
    for (let i = 0; i < 5; i++) setTimeout(() => !disposed && burst(probe.set(position.x + (Math.random() - .5) * 3, position.y + 2 + Math.random() * 2, position.z + (Math.random() - .5) * 3), { count: 28, map: i % 2 ? goldGlow : seedGlow, color: i % 2 ? '#ffe3a0' : '#c8fff2', speed: 4, lift: 3, size: .3, life: 1.2, gravity: 3 }), i * 180);
  }
  let disposed = false;

  // ------------------------------------------------------------------ frame
  const move = new THREE.Vector3(), here = new THREE.Vector3(), flowerAt = new THREE.Vector3();
  function update(delta) {
    const dt = Math.min(delta || 1 / 60, 1 / 30);
    clockTime += dt;

    // Stones rise out of the clouds, then drift. A stone under the wisp carries it along.
    platforms.forEach(p => {
      p.last.copy(p.group.position);
      if (!p.made) return;
      const t = THREE.MathUtils.clamp((clockTime - p.made.delay) / 1.3, 0, 1), rise = 1 - Math.pow(1 - t, 3);
      p.group.position.y = p.made.base - 18 * (1 - rise) + Math.sin(clockTime * .5 + p.made.phase) * .22;
      if (p.made.drift) p.group.position.x = p.made.x + Math.sin(clockTime * p.made.drift[1] + p.made.phase) * p.made.drift[0];
    });
    if (grounded && standing) { position.x += standing.group.position.x - standing.last.x; position.z += standing.group.position.z - standing.last.z; }

    // Input relative to the camera.
    let ix = stick.x, iy = -stick.y;
    if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
    if (keys.has('d') || keys.has('arrowright')) ix += 1;
    if (keys.has('w') || keys.has('arrowup')) iy += 1;
    if (keys.has('s') || keys.has('arrowdown')) iy -= 1;
    const amount = Math.min(1, Math.hypot(ix, iy));
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    move.set(fx * iy + rx * ix, 0, fz * iy + rz * ix);
    if (move.lengthSq() > 0) { move.normalize(); facing.copy(move); move.multiplyScalar(SPEED * amount); }
    if (!finished && !running && (amount > 0 || jumpQueued > 0)) running = true;
    if (running && !finished) { elapsed += dt; clock.textContent = clockText(Math.max(0, elapsed - bonus)); }
    const frozen = finished || respawning > 0;
    if (frozen) move.set(0, 0, 0);

    // Dash: a burst along the way you're heading, once per time in the air.
    dashQueued -= dt;
    if (dashQueued > 0 && dashReady && !frozen) {
      dashQueued = 0; dashReady = false; dashTime = DASH_TIME; sounds.dash(); squash = .6;
      velocity.x = facing.x * DASH_SPEED; velocity.z = facing.z * DASH_SPEED; velocity.y = Math.max(velocity.y, .5);
      burst(core.getWorldPosition(here), { count: 8, map: glow, color: '#ffd7a0', speed: 1.2, lift: .2, size: .3, life: .35, gravity: 0 });
    }
    if (dashTime > 0) {
      dashTime -= dt;
    } else {
      // Steering is snappy on the ground and softer in the air.
      const response = 1 - Math.exp(-(grounded ? 14 : 5) * dt);
      velocity.x += (move.x - velocity.x) * response; velocity.z += (move.z - velocity.z) * response;
    }

    // Jumps forgive a late press (coyote time) and an early one (buffer). A second press
    // in mid-air jumps again; holding jump on the way down glides.
    coyote = grounded ? COYOTE : coyote - dt;
    jumpQueued -= dt;
    if (jumpQueued > 0 && !frozen) {
      if (coyote > 0) { velocity.y = JUMP; grounded = false; coyote = 0; jumpQueued = 0; squash = 1; sounds.jump(); }
      else if (airJumps > 0) {
        airJumps -= 1; velocity.y = AIR_JUMP; jumpQueued = 0; squash = 1; sounds.air();
        burst(core.getWorldPosition(here), { count: 12, map: glow, color: '#ffe0b0', speed: 2.2, lift: -.6, size: .22, life: .45, gravity: 2 });
      }
    }
    // The pond's water pours upward: ride it.
    const wx = position.x - UPDRAFT.x, wz = position.z - UPDRAFT.z;
    const inDraft = wx * wx + wz * wz < UPDRAFT.radius ** 2 && position.y < UPDRAFT.top + world.position.y && !frozen;
    if (velocity.y <= 0) launched = false;
    // Let go of jump early for a short hop (but not after a bounce or in the updraft).
    if (dashTime <= 0) velocity.y -= GRAVITY * (velocity.y > 0 && !jumpHeld && !launched && !inDraft ? 2.1 : 1) * dt;
    gliding = jumpHeld && !grounded && velocity.y < 0 && dashTime <= 0 && !frozen;
    if (gliding) velocity.y = Math.max(velocity.y, -GLIDE_FALL);
    velocity.y = Math.max(velocity.y, -26);
    if (inDraft) {
      velocity.y = Math.min(UPDRAFT.max, velocity.y + UPDRAFT.lift * dt); airJumps = 1; dashReady = true; grounded = false; launched = true;
      if (Math.random() < .3) burst(here.set(position.x, position.y + .2, position.z), { count: 1, map: seedGlow, color: '#d8fff8', speed: .4, lift: 3, size: .18, life: .5, gravity: -2 });
    }

    // Horizontal move, then push out of building walls.
    const feet = position.y;
    let nx = position.x + velocity.x * dt, nz = position.z + velocity.z * dt;
    for (const b of boxes) {
      if (!inBox(b, nx, nz, RADIUS) || feet >= b.top + world.position.y - STEP || feet + .7 < b.bottom + world.position.y) continue;
      const left = nx - (b.minX - RADIUS), right = b.maxX + RADIUS - nx, back = nz - (b.minZ - RADIUS), front = b.maxZ + RADIUS - nz;
      const m = Math.min(left, right, back, front);
      if (m === left) nx = b.minX - RADIUS; else if (m === right) nx = b.maxX + RADIUS; else if (m === back) nz = b.minZ - RADIUS; else nz = b.maxZ + RADIUS;
    }
    position.x = nx; position.z = nz;

    // Vertical: land on whatever is underneath, or keep falling.
    const next = feet + velocity.y * dt;
    const ground = groundAt(position.x, position.z, feet, grounded ? STEP + .2 : STEP);
    if (velocity.y <= 0 && next <= ground + (grounded ? .25 : 0)) {
      if (!grounded) {
        const impact = -velocity.y;
        squash = -Math.min(1, .4 + impact * .05);
        if (impact > 4) { dust(here.set(position.x, ground + .05, position.z)); sounds.land(impact); }
        if (impact > 13) shake = Math.min(.5, impact * .02);
      }
      position.y = ground; velocity.y = 0; grounded = true; airJumps = 1; dashReady = true; standing = groundPlatform;
    } else { position.y = next; grounded = false; standing = null; }

    // Bounce flowers.
    flowers.forEach(flower => {
      flowerPosition(flower, flowerAt);
      flower.group.position.copy(flowerAt);
      flower.squash *= Math.exp(-8 * dt);
      const pulse = 1 + Math.sin(clockTime * 3 + flower.x) * .06;
      flower.ring.scale.set(pulse * (1 + flower.squash * .4), pulse * (1 + flower.squash * .4), 1 - flower.squash * .5);
      flower.petals.scale.setScalar(1.3 + flower.squash * 1.2);
      if (!frozen && Math.hypot(position.x - flowerAt.x, position.z - flowerAt.z) < .55 && position.y - flowerAt.y < .25 && velocity.y <= 0) {
        velocity.y = BOUNCE; grounded = false; standing = null; airJumps = 1; dashReady = true; squash = 1.2; flower.squash = 1; launched = true;
        sounds.bounce(); burst(here.copy(flowerAt).setY(flowerAt.y + .2), { count: 14, map: bloomGlow, color: '#f2c8ff', speed: 2.6, lift: 1.2, size: .26, life: .6, gravity: 4 });
      }
    });

    // Fell off the world: fade, and return to the last seed.
    if (position.y < FALL_LIMIT && respawning <= 0) { respawning = .9; fade.classList.add('hop-fade-on'); sounds.fall(); }
    if (respawning > 0) {
      respawning -= dt;
      if (respawning <= .45 && fade.classList.contains('hop-fade-on')) { place(checkpoint); fade.classList.remove('hop-fade-on'); }
    }

    // Seeds.
    const wisp = core.getWorldPosition(here);
    seeds.forEach((seed, i) => {
      if (seed.taken) return;
      const p = seed.platform.group.position;
      seed.group.position.set(p.x, platformTop(seed.platform, p.x, p.z) + .75 + Math.sin(clockTime * 2 + i) * .08, p.z);
      seed.group.rotation.y += dt * 1.5;
      if (seed.group.position.distanceTo(wisp) < .8) {
        seed.taken = true; seed.group.visible = false; taken += 1; burst(seed.group.position); sounds.seed(taken - 1);
        checkpoint.set(p.x, 0, p.z);
        seedCounter.textContent = `✦ ${taken} / ${seeds.length}`;
        seedCounter.classList.remove('hop-pop'); void seedCounter.offsetWidth; seedCounter.classList.add('hop-pop');
        if (taken === seeds.length) finish(); else if (taken === seeds.length - 1) flash('One more. Look up: the top of the upside-down island.');
      }
    });
    if (!goldenTaken) {
      golden.rotation.y += dt * 2; goldenHalo.scale.setScalar(1.3 + Math.sin(clockTime * 5) * .15);
      golden.position.y = GOLDEN.y + world.position.y + Math.sin(clockTime * 1.6) * .12;
      if (golden.position.distanceTo(wisp) < .9) {
        goldenTaken = true; golden.visible = false; bonus = 5; sounds.golden(); flash('Golden seed · 5 seconds off');
        burst(golden.position, { count: 26, map: goldGlow, color: '#ffe3a0', speed: 3, lift: 2, size: .28, life: 1, gravity: 4 });
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const spark = sparks[i]; spark.life -= dt;
      spark.velocity.y -= spark.gravity * dt; spark.sprite.position.addScaledVector(spark.velocity, dt);
      spark.sprite.material.opacity = Math.max(0, spark.life / spark.max);
      spark.sprite.scale.setScalar(spark.size * (.6 + .4 * spark.life / spark.max));
      if (spark.life <= 0) { root.remove(spark.sprite); spark.sprite.material.dispose(); sparks.splice(i, 1); }
    }
    if (flashTimer > 0 && (flashTimer -= dt) <= 0) flashLine.classList.remove('hop-flash-on');

    // The wisp: squash on take-off and landing, wider while gliding, a trail of light.
    squash *= Math.exp(-10 * dt);
    player.position.copy(position);
    core.scale.set(1 - squash * .18, 1 + squash * .3, 1 - squash * .18);
    halo.scale.setScalar((gliding ? 1.6 : dashTime > 0 ? 1.4 : 1.05) + Math.sin(clockTime * 4) * .08);
    history.unshift(core.getWorldPosition(new THREE.Vector3())); history.length = Math.min(history.length, trail.length * 2);
    trail.forEach((sprite, i) => {
      const point = history[i * 2 + 1]; sprite.visible = !!point;
      if (!point) return;
      sprite.position.copy(point); const f = 1 - i / trail.length;
      sprite.scale.setScalar((dashTime > 0 ? .6 : .42) * f); sprite.material.opacity = (dashTime > 0 ? .8 : .55) * f;
    });
    const below = groundAt(position.x, position.z, position.y + .05, 0);
    shadow.visible = isFinite(below) && position.y - below < 12;
    if (shadow.visible) {
      shadow.position.set(position.x, below + .03, position.z);
      const lift = THREE.MathUtils.clamp((position.y - below) / 6, 0, 1);
      shadow.scale.setScalar(1 - lift * .5); shadow.material.opacity = .55 * (1 - lift * .7);
    }

    // Third-person camera; it eases round behind the wisp when the visitor isn't steering it.
    if (amount > .2 && clockTime - lastDrag > 1.5 && move.lengthSq() > 0) {
      const behind = Math.atan2(-move.x, -move.z);
      yaw += Math.atan2(Math.sin(behind - yaw), Math.cos(behind - yaw)) * Math.min(1, dt * .9 * amount);
    }
    cameraTarget.lerp(probe.set(position.x, position.y + .7, position.z), 1 - Math.exp(-9 * dt));
    // Pull the camera in when a building stands between it and the wisp, and keep it above the grass.
    let distance = touch ? 8.5 : 7.2;
    for (let i = 1; i <= 14; i++) {
      const f = i / 14, x = cameraTarget.x + Math.sin(yaw) * distance * f, z = cameraTarget.z + Math.cos(yaw) * distance * f, y = cameraTarget.y + 2.6 * f;
      if (boxes.some(b => inBox(b, x, z, .25) && y < b.top + world.position.y + .3 && y > b.bottom + world.position.y)) { distance = Math.max(1.8, distance * (f - 1 / 14)); break; }
    }
    cameraWanted.set(cameraTarget.x + Math.sin(yaw) * distance, cameraTarget.y + 2.6 * Math.min(1, distance / 5 + .3), cameraTarget.z + Math.cos(yaw) * distance);
    cameraWanted.y = Math.max(cameraWanted.y, mainTop(cameraWanted.x, cameraWanted.z) + .6);
    camera.position.lerp(cameraWanted, 1 - Math.exp(-6 * dt));
    shake *= Math.exp(-7 * dt);
    if (shake > .01) camera.position.add(probe.set((Math.random() - .5) * shake, (Math.random() - .5) * shake, (Math.random() - .5) * shake));
    camera.lookAt(cameraTarget);
    // A wider lens for a moment while dashing.
    const fov = baseFov + (dashTime > 0 ? 9 : 0) + Math.min(6, Math.max(0, -velocity.y - 10) * .4);
    if (Math.abs(camera.fov - fov) > .05) { camera.fov += (fov - camera.fov) * (1 - Math.exp(-8 * dt)); camera.updateProjectionMatrix(); }
  }

  function dispose() {
    disposed = true;
    window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur);
    host.removeEventListener('pointerdown', onPointerDown); window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp); window.removeEventListener('pointercancel', onPointerUp);
    hud.remove(); sounds.dispose();
    platforms.forEach(p => { if (p.made) kit.floating.remove(p.group); }); // clones share geometry: nothing to free
    scene.remove(root);
    sparks.forEach(spark => spark.sprite.material.dispose());
    owned.forEach(thing => thing.dispose?.()); ownedTextures.forEach(texture => texture.dispose());
    camera.fov = savedFov; camera.updateProjectionMatrix();
  }

  const api = { update, dispose, get finished() { return finished; } };
  if (new URLSearchParams(location.search).has('debug')) {
    window.__hop = {
      position, velocity, platforms, seeds, flowers, platformTop,
      get grounded() { return grounded; }, get taken() { return taken; }, get airJumps() { return airJumps; }, get goldenTaken() { return goldenTaken; },
      set yaw(v) { yaw = v; }, get yaw() { return yaw; },
      step: dt => update(dt), press: key => keys.add(key), release: key => keys.delete(key),
      jump: pressJump, letGo: () => { jumpHeld = false; }, dash: () => { dashQueued = BUFFER; }
    };
  }
  return api;
}
