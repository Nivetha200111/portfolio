import * as THREE from './vendor/three.module.js';
import { CSS3DRenderer, CSS3DObject, CSS3DSprite } from './vendor/CSS3DRenderer.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createInterior } from './interiors.js';
import { createWorldAudio } from './audio.js';

// Everything in this world is modeled here: no remote models or textures.
export function createStoryWorld(host, { onReady, onError, immersive = false, onSelect, onInterior, onStation, onSoundChange, projectCount = 7, skills = [] } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 160);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const cssRenderer = immersive ? new CSS3DRenderer() : null;
  if (cssRenderer) {
    cssRenderer.domElement.className = 'world-dom';
    Object.assign(cssRenderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    host.appendChild(cssRenderer.domElement);
    renderer.domElement.style.touchAction = 'none';
  }
  const controls = immersive ? new OrbitControls(camera, renderer.domElement) : null;
  if (controls) {
    controls.enableDamping = true; controls.dampingFactor = .06; controls.enablePan = false;
    controls.minPolarAngle = .45; controls.maxPolarAngle = 1.35;
    controls.minDistance = 16; controls.maxDistance = 65;
    controls.autoRotateSpeed = .32; controls.zoomSpeed = .6;
  }

  const exterior = new THREE.Group(); scene.add(exterior);
  const world = new THREE.Group(); exterior.add(world);
  const audio = immersive ? createWorldAudio({ onState: () => {
    rooms.forEach(room => room.setSound(audio.muted, audio.ready)); onSoundChange?.(audio.muted, audio.ready);
  } }) : null;
  const veil = document.createElement('div'); veil.className = 'world-threshold'; veil.setAttribute('aria-hidden', 'true');
  if (immersive) host.appendChild(veil);
  const hemisphere = new THREE.HemisphereLight(0xfff5dc, 0x72816b, 2.5);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffedcf, 3.1);
  sun.position.set(-8, 16, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: .1, far: 45 });
  sun.shadow.normalBias = .06;
  sun.shadow.bias = -.0001;
  scene.add(sun);

  let seed = 924;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const gradient = new THREE.DataTexture(new Uint8Array([120, 180, 225, 255]), 4, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  const materials = new Map();
  const mat = (color) => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshToonMaterial({ color, gradientMap: gradient }));
    return materials.get(color);
  };
  const palette = { grass: '#96ad6c', earth: '#a28b70', rock: '#877d6d', cream: '#f1e4bc', roof: '#bd715d', wood: '#7a604d', dark: '#3b5143', gold: '#dfb864' };
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const mesh = (geometry, color, parent = world) => {
    const object = new THREE.Mesh(geometry, mat(color));
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  const ellipsoid = (color, x, y, z, sx, sy, sz, parent = world) => {
    const object = mesh(sphere, color, parent);
    object.position.set(x, y, z);
    object.scale.set(sx, sy, sz);
    return object;
  };
  const block = (color, x, y, z, sx, sy, sz, parent = world) => {
    const object = mesh(box, color, parent);
    object.position.set(x, y, z);
    object.scale.set(sx, sy, sz);
    return object;
  };
  function hingedDoor(parent, x, y, z, width, height, color = palette.wood) {
    block('#3b4b3d', x, y + height / 2, z, width, height, .06, parent);
    const pivot = new THREE.Group(); pivot.position.set(x - width / 2, y, z + .06); parent.add(pivot);
    pivot.userData.height = height; pivot.userData.width = width;
    block(color, width / 2, height / 2, 0, width, height, .065, pivot);
    for (const yy of [.28, .75]) block('#8d9470', width / 2, height * yy, .04, width * .75, height * .33, .025, pivot);
    ellipsoid('#dfbf69', width * .82, height * .48, .08, .035, .035, .025, pivot);
    for (const xx of [x - width / 2 - .035, x + width / 2 + .035]) block('#9b815b', xx, y + height / 2, z + .03, .065, height + .13, .15, parent);
    block('#9b815b', x, y + height + .065, z + .03, width + .2, .07, .15, parent);
    for (const yy of [.2, .85]) cylinder('#a5976b', .018, .018, .09, 0, height * yy, .01, pivot);
    return pivot;
  }
  const cylinder = (color, top, bottom, height, x, y, z, parent = world, segments = 12) => {
    const object = mesh(new THREE.CylinderGeometry(top, bottom, height, segments), color, parent);
    object.position.set(x, y, z);
    return object;
  };
  function beam(from, to, radius, color, parent = world) {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const object = mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 6), color, parent);
    object.position.copy(start.add(end).multiplyScalar(.5));
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return object;
  }

  // Uneven hanging bedrock and softly rounded moss make the floating garden.
  ellipsoid(palette.earth, 0, -.95, 0, 6.7, 1.75, 5.5);
  const tip = mesh(new THREE.ConeGeometry(4.9, 4.6, 9), palette.rock);
  tip.rotation.z = Math.PI;
  tip.position.set(0, -2.6, -.2);
  ellipsoid(palette.grass, 0, -.1, 0, 6.85, .7, 5.6);
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    const x = Math.cos(a) * 6, z = Math.sin(a) * 4.8;
    ellipsoid(i % 3 ? '#8fa765' : '#abc084', x, -.05 + random() * .16, z, .85 + random() * .6, .4, .8);
    if (i % 2 === 0) ellipsoid(palette.rock, x * .95, -1.1, z * .93, .8, .8 + random(), .7);
  }

  // The winding footpath is a ribbon through the actual 3D terrain.
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.4, .59, 4.5), new THREE.Vector3(-2.1, .6, 2.7),
    new THREE.Vector3(.3, .6, 1.6), new THREE.Vector3(2.6, .6, .4),
    new THREE.Vector3(3.8, .55, -2.3), new THREE.Vector3(1.1, .58, -3.3)
  ]);
  const ribbonVertices = [], ribbonIndices = [];
  for (let i = 0; i <= 80; i++) {
    const p = path.getPoint(i / 80), tangent = path.getTangent(i / 80);
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(.38);
    ribbonVertices.push(p.x + side.x, p.y, p.z + side.z, p.x - side.x, p.y, p.z - side.z);
    if (i < 80) { const n = i * 2; ribbonIndices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
  }
  const ribbon = new THREE.BufferGeometry();
  ribbon.setAttribute('position', new THREE.Float32BufferAttribute(ribbonVertices, 3));
  ribbon.setIndex(ribbonIndices);
  ribbon.computeVertexNormals();
  mesh(ribbon, '#dfcf9f');

  function roof(parent, width, depth, y, color) {
    const s = new THREE.Shape();
    s.moveTo(-width / 2, 0); s.lineTo(0, width * .55); s.lineTo(width / 2, 0); s.closePath();
    const geometry = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    const object = mesh(geometry, color, parent);
    object.position.set(0, y, -depth / 2);
    // Little roof slats give the houses a handcrafted rhythm.
    for (let i = 0; i < 9; i++) {
      const z = -depth / 2 + i * depth / 8;
      beam([-width / 2, y + .02, z], [0, y + width * .55 + .02, z], .022, '#d38b70', parent);
      beam([0, y + width * .55 + .02, z], [width / 2, y + .02, z], .022, '#d38b70', parent);
    }
  }
  const cottage = new THREE.Group();
  cottage.position.set(-2.7, .4, .3);
  cottage.rotation.y = .2;
  world.add(cottage);
  block(palette.cream, 0, 1, 0, 2.3, 2, 1.9, cottage);
  roof(cottage, 2.8, 2.5, 2, palette.roof);
  const cottageDoor = hingedDoor(cottage, -.4, 0, 1, .56, 1.3);
  block('#799a9a', .66, 1.1, 1, .62, .66, .08, cottage);
  block(palette.cream, .66, 1.1, 1.06, .045, .7, .045, cottage);
  block(palette.cream, .66, 1.1, 1.06, .68, .045, .045, cottage);
  block(palette.wood, .66, .7, 1.1, .9, .16, .35, cottage);
  for (let i = 0; i < 5; i++) ellipsoid(i % 2 ? '#e0a291' : '#f4d48c', .35 + i * .16, .9, 1.12, .12, .16, .1, cottage);
  block('#ad8d78', -.6, 2.85, -.35, .4, 1.2, .45, cottage);
  block('#d0b099', -.6, 3.48, -.35, .53, .15, .57, cottage);
  for (let i = 0; i < 4; i++) block('#bea98b', -.4, .05 - i * .07, 1.2 + i * .18, .85, .16, .35, cottage);
  const smoke = [];
  const smokeMaterial = new THREE.MeshBasicMaterial({ color: '#fbf6e6', transparent: true, opacity: .38, depthWrite: false });
  for (let i = 0; i < 6; i++) {
    const puff = new THREE.Mesh(sphere, smokeMaterial);
    cottage.add(puff); smoke.push(puff);
  }

  // A windmill: a metaphor for flows, integrations and moving parts.
  const mill = new THREE.Group();
  mill.position.set(3.5, .45, -1.3);
  world.add(mill);
  cylinder('#ebdfbc', .6, .9, 3.6, 0, 1.8, 0, mill);
  const millRoof = mesh(new THREE.ConeGeometry(.9, 1.3, 12), '#829183', mill);
  millRoof.position.y = 4.15;
  const millDoor = hingedDoor(mill, 0, 0, .84, .45, 1.2, '#675a48');
  block('#779291', 0, 2.5, .66, .35, .45, .08, mill);
  const rotor = new THREE.Group(); rotor.position.set(0, 3.1, .95); mill.add(rotor);
  cylinder(palette.wood, .18, .18, .25, 0, 0, 0, rotor).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const sail = new THREE.Group(); sail.rotation.z = i * Math.PI / 2; rotor.add(sail);
    block(palette.wood, 0, 1.03, 0, .09, 2.15, .09, sail);
    block('#f3e7c7', .22, 1.3, .04, .53, 1.24, .06, sail);
    for (let j = 0; j < 5; j++) block('#b3a788', .22, .72 + j * .26, .09, .57, .035, .035, sail);
  }

  // The observatory looks toward the next thing to build.
  const observatory = new THREE.Group(); observatory.position.set(.15, .45, -3.35); world.add(observatory);
  cylinder('#e5d8b8', 1.1, 1.2, 1.8, 0, .9, 0, observatory);
  const dome = mesh(new THREE.SphereGeometry(1.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#7faaa2', observatory);
  dome.position.y = 1.8;
  const observatoryDoor = hingedDoor(observatory, 0, 0, 1.17, .48, 1.2, '#486659');
  cylinder('#d0bc8d', 1.24, 1.24, .12, 0, 1.8, 0, observatory, 24);
  const telescope = cylinder('#c7aa68', .17, .2, .95, .65, 2.65, .72, observatory);
  telescope.rotation.x = .9; telescope.rotation.z = -.55;
  for (const x of [-.8, .8]) block('#e8c47b', x, 1.05, .8, .25, .45, .16, observatory);

  const trees = [];
  function tree(x, z, scale = 1, color = '#698c61') {
    const g = new THREE.Group(); g.position.set(x, .45, z); g.scale.setScalar(scale); world.add(g);
    trees.push(g);
    cylinder(palette.wood, .12, .23, 1.7, 0, .85, 0, g);
    beam([0, 1, 0], [-.45, 1.9, .1], .08, palette.wood, g);
    ellipsoid(color, 0, 2.15, 0, .9, 1.05, .8, g);
    ellipsoid(color, -.55, 1.9, .15, .65, .75, .63, g);
    ellipsoid(color, .5, 2, -.1, .65, .8, .6, g);
    ellipsoid('#a6bc82', -.12, 2.65, .22, .62, .6, .55, g);
  }
  tree(-4.9, -1.2, 1.25); tree(-3.4, -3, .85); tree(4.9, .6, .95);
  tree(1.8, 3.3, .8); tree(-5, 1.8, .65); tree(2, -4, .65);
  // An airy peach blossom tree, with individual clusters rather than a texture.
  cylinder(palette.wood, .1, .22, 2.2, -1.1, 1.4, -1.65);
  for (let i = 0; i < 16; i++) {
    const a = random() * Math.PI * 2, r = random() * 1.1;
    ellipsoid(i % 3 ? '#ddb4a0' : '#edd0b9', -1.1 + Math.cos(a) * r, 2.6 + random() * .7, -1.65 + Math.sin(a) * r, .55, .42, .55);
  }

  // Meadow grass and flowers use instancing, keeping hundreds of stems inexpensive.
  const flowers = 230;
  const stemGeometry = new THREE.CylinderGeometry(.012, .018, .24, 4);
  const stems = new THREE.InstancedMesh(stemGeometry, mat('#6e8e53'), flowers);
  const blossoms = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.07, 0), mat('#fff0ca'), flowers);
  const dummy = new THREE.Object3D();
  let flowerCount = 0;
  for (let i = 0; i < flowers * 3 && flowerCount < flowers; i++) {
    const x = (random() - .5) * 12, z = (random() - .5) * 9;
    if (x * x / 36 + z * z / 20 > .9 || (x < -1.1 && x > -4.3 && z < 1.7 && z > -1.4)) continue;
    const y = .4 + .16 * (1 - x * x / 49 - z * z / 30);
    const size = .6 + random() * .7;
    dummy.position.set(x, y + .12, z); dummy.scale.setScalar(size); dummy.updateMatrix(); stems.setMatrixAt(flowerCount, dummy.matrix);
    dummy.position.y += .13 * size; dummy.updateMatrix(); blossoms.setMatrixAt(flowerCount, dummy.matrix);
    blossoms.setColorAt(flowerCount, new THREE.Color(['#fff0ca', '#eab79a', '#c9b9d2', '#e5c76f'][flowerCount % 4]));
    flowerCount++;
  }
  stems.count = blossoms.count = flowerCount;
  world.add(stems, blossoms);
  const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(.045, .3, 3), mat('#7e9b5e'), 340);
  for (let i = 0; i < 340; i++) {
    const a = random() * Math.PI * 2, r = Math.sqrt(random()) * .94;
    dummy.position.set(Math.cos(a) * r * 6.5, .55, Math.sin(a) * r * 5.1);
    dummy.scale.set(.8, .7 + random() * .8, .8); dummy.rotation.set(0, random() * 6, .15); dummy.updateMatrix(); grass.setMatrixAt(i, dummy.matrix);
  }
  world.add(grass);
  const windUniform = { value: 0 };
  const grassMaterial = mat('#7e9b5e');
  grassMaterial.onBeforeCompile = shader => {
    shader.uniforms.uGardenWind = windUniform;
    shader.vertexShader = 'uniform float uGardenWind;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.x += sin(uGardenWind + instanceMatrix[3].x * 2.0 + instanceMatrix[3].z) * (position.y + 0.15) * 0.2;');
  };
  grassMaterial.customProgramCacheKey = () => 'garden-wind-v1';

  // A small pond, stepping stones, fence and glowing garden lanterns.
  ellipsoid('#afba94', 2.95, .45, 2.6, 1.3, .13, .85);
  const pond = ellipsoid('#8ebdb8', 2.95, .54, 2.6, 1.13, .05, .68);
  pond.castShadow = false;
  for (let i = 0; i < 6; i++) ellipsoid('#a5a389', -3.6 + i * .33, .65, 3.7 - i * .37, .22, .06, .15);
  for (let i = 0; i < 8; i++) {
    const x = -4.1 + i * .6;
    cylinder('#bdad84', .045, .055, .65, x, .78, 3.05);
    if (i < 7) { block('#bdad84', x + .3, .83, 3.05, .65, .06, .06); block('#bdad84', x + .3, 1.02, 3.05, .65, .06, .06); }
  }
  const lanternMaterial = new THREE.MeshBasicMaterial({ color: '#ffe3a0' });
  for (const [x, z] of [[-.1, 2], [2.4, .1], [1.4, -2.8], [-3.5, 1.6]]) {
    cylinder(palette.wood, .045, .06, 1.05, x, .95, z);
    block(palette.wood, x, 1.5, z, .3, .34, .3);
    const glow = new THREE.Mesh(box, lanternMaterial); glow.position.set(x, 1.5, z); glow.scale.set(.22, .23, .32); world.add(glow);
    const cap = mesh(new THREE.ConeGeometry(.27, .18, 4), '#6a7960'); cap.position.set(x, 1.75, z); cap.rotation.y = Math.PI / 4;
  }
  // A tiny original forest keeper beside the path.
  const spirit = new THREE.Group(); spirit.position.set(-.35, .7, 2.75); world.add(spirit);
  ellipsoid('#f3eedb', 0, .35, 0, .26, .4, .23, spirit);
  ellipsoid('#f3eedb', -.12, .75, 0, .065, .2, .06, spirit);
  ellipsoid('#f3eedb', .12, .75, 0, .065, .2, .06, spirit);
  for (const x of [-.085, .085]) ellipsoid('#344c40', x, .45, .21, .035, .05, .025, spirit);
  const leaf = ellipsoid('#87a364', .1, .97, 0, .21, .045, .1, spirit); leaf.rotation.z = -.4;

  const mailbox = new THREE.Group(); mailbox.position.set(4.5, .5, 2.7); world.add(mailbox);
  cylinder(palette.wood, .065, .09, 1.2, 0, .6, 0, mailbox);
  block('#b37362', 0, 1.3, 0, .65, .43, .45, mailbox);
  ellipsoid('#b37362', 0, 1.52, 0, .325, .2, .225, mailbox);
  block('#f0dfb3', 0, 1.36, .235, .33, .12, .03, mailbox);
  const flag = block('#d6b066', .41, 1.6, 0, .2, .12, .025, mailbox);
  cylinder(palette.wood, .018, .018, .45, .33, 1.45, 0, mailbox);

  // Small magical doorways connect the outdoor landmarks to their larger rooms.
  const doors = { projects: cottageDoor, experience: millDoor, certifications: observatoryDoor };
  for (const [id, x, z, color] of [['skills', 2.9, 3.6, '#68866a'], ['contact', 4.55, 3.7, '#a7775d'], ['achievements', -1.1, -.1, '#b29665'], ['story', -4.9, 3.5, '#6a8871']]) {
    const porch = new THREE.Group(); porch.position.set(x, .45, z); porch.userData.place = id; world.add(porch);
    doors[id] = hingedDoor(porch, 0, 0, 0, .65, 1.55, color);
    roof(porch, .98, .55, 1.65, id === 'skills' ? '#a6be9b' : palette.roof);
    block('#bca379', 0, -.015, .3, 1.1, .09, .9, porch);
    for (const xx of [-.53, .53]) cylinder(palette.wood, .04, .06, 1.6, xx, .8, 0, porch);
    porch.userData.interactive = true;
  }
  doors.map = doors.story;

  const places = {
    story: { title: 'My story', subtitle: 'The wandering journal', point: [-5.3, 1.7, 4.8] },
    projects: { title: 'Projects', subtitle: 'The little workshop', point: [-4, 4.2, 1.1] },
    experience: { title: 'Experience', subtitle: 'The windmill', point: [5.3, 5.8, -2] },
    skills: { title: 'Skills', subtitle: 'The growing garden', point: [.5, 1.7, 4.8] },
    achievements: { title: 'Achievements', subtitle: 'The wishing tree', point: [-2.1, 6.2, -2] },
    certifications: { title: 'Certifications', subtitle: 'The observatory', point: [.9, 4.4, -4.1] },
    contact: { title: 'Say hello', subtitle: 'The garden mailbox', point: [5.6, 2.4, 4.1] }
  };
  const labels = [], interactiveObjects = [cottage, mill, observatory, mailbox, spirit, ...world.children.filter(object => object.userData.interactive)];
  [cottage, mill, observatory, mailbox, spirit].forEach((object, i) => { object.userData.place = ['projects', 'experience', 'certifications', 'contact', 'story'][i]; });
  const bookElement = document.createElement('div');
  bookElement.className = 'world-surface';
  bookElement.style.pointerEvents = 'auto';
  const book = immersive ? new CSS3DObject(bookElement) : null;
  let selectedPlace = null, flying = false, fitDistance = 28;
  const rooms = new Map(), walkKeys = new Set();
  let insideRoom = null, trip = null, lookYaw = 0, lookPitch = 0, lookDown = null, activeDesk = null;
  let journey = null, queuedPlace;
  let activeScreenMode = false;
  let pendingStation = null;
  let lastPlantLabels = -1;
  const destination = new THREE.Vector3(), destinationTarget = new THREE.Vector3();
  if (immersive) {
    scene.add(book); book.visible = false;
    for (const [id, place] of Object.entries(places)) {
      const button = document.createElement('button');
      button.className = 'world-place'; button.dataset.place = id;
      button.setAttribute('aria-label', `${place.title} — ${place.subtitle}`);
      const title = document.createElement('strong'); title.textContent = place.title;
      const subtitle = document.createElement('span'); subtitle.textContent = place.subtitle;
      button.append(title, subtitle);
      button.addEventListener('click', () => onSelect?.(id));
      const label = new CSS3DSprite(button); label.position.fromArray(place.point); label.scale.setScalar(.018);
      label.userData.anchor = label.position.clone();
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([label.position, label.position.clone().add(new THREE.Vector3(0, -.7, 0))]);
      const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: '#647d61', transparent: true, opacity: .4 }));
      world.add(line); label.userData.line = line;
      world.add(label); labels.push(label);
    }
    // A physical journal on a wooden pedestal is the story's entrance.
    cylinder(palette.wood, .13, .17, .7, -3.7, .9, 4.1);
    const journal = block('#476b56', -3.7, 1.3, 4.1, .65, .12, .85);
    journal.rotation.z = -.12; journal.userData.place = 'story'; interactiveObjects.push(journal);
    block('#eddfb8', -3.7, 1.38, 4.1, .58, .035, .77).rotation.z = -.12;
  }

  // Clouds are soft, translucent 3D volumes. Mountains are distant silhouettes.
  const clouds = [];
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: '#fff9e8', transparent: true, opacity: .64, depthWrite: false });
  for (let i = 0; i < 12; i++) {
    const cloud = new THREE.Group();
    cloud.position.set((random() - .5) * 40, -3 + random() * 13, -10 - random() * 12);
    for (let j = 0; j < 5; j++) {
      const p = new THREE.Mesh(sphere, cloudMaterial); p.position.set((j - 2) * 1.2, random() * .5, 0); p.scale.set(1.5, .55 + random() * .5, .75); cloud.add(p);
    }
    exterior.add(cloud); clouds.push({ group: cloud, x: cloud.position.x, phase: random() * 6 });
  }
  const mountainMaterial = new THREE.MeshBasicMaterial({ color: '#b8c9bd', transparent: true, opacity: .25, depthWrite: false });
  for (let i = 0; i < 8; i++) {
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(5 + random() * 4, 7 + random() * 8, 5), mountainMaterial);
    mountain.position.set(-28 + i * 9, -6, -28 - random() * 6); exterior.add(mountain);
  }
  const petalGeometry = new THREE.BufferGeometry();
  const petalPositions = new Float32Array(45 * 3);
  for (let i = 0; i < 45; i++) { petalPositions[i * 3] = (random() - .5) * 17; petalPositions[i * 3 + 1] = random() * 9; petalPositions[i * 3 + 2] = (random() - .5) * 12; }
  petalGeometry.setAttribute('position', new THREE.BufferAttribute(petalPositions, 3));
  const petalMaterial = new THREE.PointsMaterial({ color: '#fff2c7', size: .06, transparent: true, opacity: .8 });
  const petals = new THREE.Points(petalGeometry, petalMaterial); world.add(petals);
  const birds = [];
  for (let i = 0; i < 5; i++) {
    const bird = new THREE.Group();
    const left = block('#697b6d', -.14, 0, 0, .32, .025, .085, bird);
    const right = block('#697b6d', .14, 0, 0, .32, .025, .085, bird);
    exterior.add(bird); birds.push({ group: bird, left, right, phase: i * 1.3 });
  }

  let progress = 0, current = 0, playing = true, visible = true, disposed = false, localTime = 0, lastTime = 0, inFrame = false;
  const pointer = new THREE.Vector2(), smoothPointer = new THREE.Vector2();
  const views = [
    { position: [16, 11, 20], target: [0, .2, 0] },
    { position: [10, 7, 15], target: [-.6, 1, .2] },
    { position: [16, 8, 12], target: [.7, 1, -.8] },
    { position: [11, 9, 18], target: [0, .8, -1.4] }
  ];
  const pA = new THREE.Vector3(), pB = new THREE.Vector3(), target = new THREE.Vector3();
  const bookTilt = new THREE.Quaternion(), bookEuler = new THREE.Euler();
  function render(time = 0) {
    if (disposed || inFrame) return;
    inFrame = true;
    const elapsed = Math.max(0, (time - lastTime) / 1000);
    const delta = Math.min(elapsed, .05); lastTime = time;
    if (playing) localTime += delta;
    current = playing ? THREE.MathUtils.damp(current, progress, 4, delta || .016) : progress;
    if (immersive) {
      if (journey) advanceJourney(playing ? elapsed : Infinity);
      if (flying) {
        const amount = playing ? 1 - Math.exp(-3.8 * (elapsed || .016)) : 1;
        camera.position.lerp(destination, amount); controls.target.lerp(destinationTarget, amount);
        camera.lookAt(controls.target);
        if (camera.position.distanceTo(destination) < .035 && controls.target.distanceTo(destinationTarget) < .035) {
          flying = false;
          if (trip === 'outside') finishExit();
          else if (trip) finishEntrance(trip);
          camera.rotation.order = 'YXZ'; lookYaw = camera.rotation.y; lookPitch = camera.rotation.x;
          if (pendingStation !== null) { const index = pendingStation; pendingStation = null; onStation?.(index); }
          if (!journey) host.setAttribute('aria-busy', 'false');
        }
      }
      if (insideRoom) {
        insideRoom.screens.forEach(screen => { screen.element.style.pointerEvents = flying || journey ? 'none' : 'auto'; });
        insideRoom.update(localTime);
        if (insideRoom.kind === 'skills' && (!playing || localTime - lastPlantLabels > .14)) {
          lastPlantLabels = localTime; insideRoom.group.updateMatrixWorld(true); camera.updateMatrixWorld();
          const forward = camera.getWorldDirection(new THREE.Vector3());
          insideRoom.skillPlants.forEach(plant => {
            const offset = plant.label.getWorldPosition(new THREE.Vector3()).sub(camera.position), distance = offset.length();
            raycaster.set(camera.position, offset.normalize());
            const hit = raycaster.intersectObjects(insideRoom.pickable, true)[0];
            let object = hit?.object; while (object && object.userData.plant === undefined) object = object.parent;
            plant.label.visible = offset.dot(forward) > 0 && (!hit || hit.distance > distance - .15 || object?.userData.plant === plant.index);
          });
        }
        if (!flying && !journey) {
          camera.rotation.set(lookPitch, lookYaw, 0, 'YXZ');
          const speed = delta * 3.3;
          let dx = 0, dz = 0;
          if (walkKeys.has('w') || walkKeys.has('arrowup')) dz -= speed;
          if (walkKeys.has('s') || walkKeys.has('arrowdown')) dz += speed;
          if (walkKeys.has('a') || walkKeys.has('arrowleft')) dx -= speed;
          if (walkKeys.has('d') || walkKeys.has('arrowright')) dx += speed;
          const nextX = camera.position.x + dx * Math.cos(lookYaw) + dz * Math.sin(lookYaw);
          const nextZ = camera.position.z - dx * Math.sin(lookYaw) + dz * Math.cos(lookYaw);
          if (Math.abs(nextX) < 7.25 && Math.abs(nextZ) < 6.25 && !insideRoom.colliders.some(c => Math.abs(nextX - c.x) < c.width && Math.abs(nextZ - c.z) < c.depth)) { camera.position.x = nextX; camera.position.z = nextZ; }
        }
      } else {
        controls.autoRotate = playing && !selectedPlace && !flying && !journey;
        if (!flying && !journey) controls.update(delta);
      }
      if (book.visible) {
        if (insideRoom) { book.quaternion.identity(); book.scale.setScalar(.008); }
        else {
          book.quaternion.copy(camera.quaternion);
          bookEuler.set(.012 * Math.sin(localTime * .6), .055 + .015 * Math.sin(localTime * .4), -.012);
          book.quaternion.multiply(bookTilt.setFromEuler(bookEuler));
          const focal = host.clientHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
          const wantedWidth = Math.min(host.clientWidth - 44, host.clientHeight * .78, 500);
          const scale = wantedWidth * book.position.distanceTo(camera.position) / ((bookElement.offsetWidth || 520) * focal);
          book.scale.setScalar(scale);
        }
      }
      labels.forEach(label => { label.visible = !selectedPlace && !journey; });
      if (!selectedPlace && !journey) {
        world.updateMatrixWorld(true); camera.updateMatrixWorld();
        const focal = host.clientHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
        const rectangles = [];
        const ordered = labels.map(label => {
          const anchor = world.localToWorld(label.userData.anchor.clone());
          const screen = anchor.clone().project(camera);
          return { label, anchor, screen, y: (1 - screen.y) * host.clientHeight / 2 };
        }).sort((a, b) => a.y - b.y);
        for (const { label, anchor, screen } of ordered) {
          const wantedHeight = host.clientWidth < 600 ? 44 : 52;
          const height = label.element.offsetHeight || 70, width = label.element.offsetWidth || 150;
          label.scale.setScalar(wantedHeight * anchor.distanceTo(camera.position) / (height * focal));
          const screenWidth = width / height * wantedHeight;
          let x = (screen.x + 1) * host.clientWidth / 2, y = (1 - screen.y) * host.clientHeight / 2;
          x = THREE.MathUtils.clamp(x, screenWidth / 2 + 12, host.clientWidth - screenWidth / 2 - 12);
          for (const previous of rectangles) {
            if (Math.abs(x - previous.x) < (screenWidth + previous.width) / 2 + 6 && Math.abs(y - previous.y) < (wantedHeight + previous.height) / 2 + 8) y = previous.y + (wantedHeight + previous.height) / 2 + 9;
          }
          y = THREE.MathUtils.clamp(y, wantedHeight / 2 + 16, host.clientHeight - wantedHeight / 2 - 16);
          rectangles.push({ x, y, width: screenWidth, height: wantedHeight });
          const position = new THREE.Vector3(x / host.clientWidth * 2 - 1, 1 - y / host.clientHeight * 2, screen.z).unproject(camera);
          label.position.copy(world.worldToLocal(position));
          const line = label.userData.line;
          const vertices = line.geometry.attributes.position;
          vertices.setXYZ(0, ...label.userData.anchor.toArray()); vertices.setXYZ(1, ...label.position.toArray()); vertices.needsUpdate = true;
          line.visible = true;
        }
      } else labels.forEach(label => { label.userData.line.visible = false; });
    } else {
    smoothPointer.lerp(playing ? pointer : new THREE.Vector2(), .035);
    const stage = Math.min(2, Math.floor(current * 3)), blend = THREE.MathUtils.smoothstep(current * 3 - stage, 0, 1);
    pA.fromArray(views[stage].position); pB.fromArray(views[stage + 1].position); camera.position.lerpVectors(pA, pB, blend);
    pA.fromArray(views[stage].target); pB.fromArray(views[stage + 1].target); target.lerpVectors(pA, pB, blend);
    const mobile = window.innerWidth < 650;
    if (mobile) target.y -= .4;
    // Fit the island into its own column at every aspect ratio, keeping the story readable.
    const halfFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const minimumDistance = 7.5 / Math.sin(Math.min(halfFov, THREE.MathUtils.degToRad(camera.fov / 2)));
    const distance = camera.position.distanceTo(target);
    if (distance < minimumDistance) camera.position.sub(target).multiplyScalar(minimumDistance / distance).add(target);
    camera.position.x += smoothPointer.x * .65; camera.position.y += smoothPointer.y * .3;
    camera.lookAt(target);
    }
    if (!journey) world.position.y = playing ? Math.sin(localTime * .55) * .1 : 0;
    windUniform.value = localTime * 1.3;
    trees.forEach(tree => { tree.rotation.z = Math.sin(localTime * .65 + tree.position.x) * .018; });
    rotor.rotation.z = -localTime * .35;
    spirit.position.y = .7 + Math.sin(localTime * 1.3) * .055;
    clouds.forEach(({ group, x, phase }) => { group.position.x = x + Math.sin(localTime * .07 + phase) * 2; });
    smoke.forEach((puff, i) => { const phase = (localTime * .18 + i / 6) % 1; puff.position.set(-.6 + phase * .7, 3.5 + phase * 2, -.35); puff.scale.setScalar(.12 + phase * .4); });
    birds.forEach(({ group, left, right, phase }) => {
      const t = localTime * .15 + phase;
      group.position.set(Math.sin(t) * 12, 5 + Math.sin(t * 2) * .7, -8 + Math.cos(t) * 4);
      group.rotation.y = -t;
      left.rotation.z = Math.sin(localTime * 4 + phase) * .4; right.rotation.z = -left.rotation.z;
    });
    petals.rotation.y = localTime * .025;
    const evening = THREE.MathUtils.smoothstep(current, .55, 1);
    sun.color.setRGB(1, .92 - evening * .17, .78 - evening * .22);
    sun.intensity = 3.1 - evening * .55;
    renderer.render(scene, camera);
    if (cssRenderer) cssRenderer.render(scene, camera);
    inFrame = false;
  }
  function resize() {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    cssRenderer?.setSize(width, height);
    if (immersive && !insideRoom && !journey) {
      const halfHorizontal = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
      fitDistance = 7.6 / Math.sin(Math.min(halfHorizontal, THREE.MathUtils.degToRad(camera.fov / 2)));
      controls.maxDistance = Math.max(65, fitDistance * 1.6);
      if (!selectedPlace) {
        camera.position.set(16, 11, 20).normalize().multiplyScalar(fitDistance);
        controls.target.set(0, 1, 0);
      } else focus(selectedPlace);
    } else if (immersive && insideRoom && !journey) {
      if (activeDesk !== null) focusStation(activeDesk, false, activeScreenMode);
      else if (insideRoom.kind !== 'projects') finishEntrance(insideRoom.kind, false);
    }
    render(lastTime);
  }
  function move(event) {
    if (event.pointerType === 'touch') return;
    const rect = host.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width - .5, .5 - (event.clientY - rect.top) / rect.height);
  }
  function loop() { renderer.setAnimationLoop(playing && visible && !document.hidden ? render : null); render(lastTime); }
  function ensureRoom(id) {
    if (!rooms.has(id)) {
      const room = createInterior(id, { material: mat, projectCount, skills, onExit: () => onSelect?.(null), onNavigate: onSelect, onPlant: focusPlant, onSound: setSound, muted: audio.muted, audioReady: audio.ready });
      room.kind = id; rooms.set(id, room); scene.add(room.group);
    }
    return rooms.get(id);
  }
  function finishEntrance(id, notify = true) {
    trip = null;
    activeDesk = null;
    pendingStation = null;
    insideRoom?.group && (insideRoom.group.visible = false);
    insideRoom = ensureRoom(id); insideRoom.group.visible = true; world.visible = false; exterior.visible = false;
    camera.fov = 65; camera.updateProjectionMatrix();
    if (id === 'projects' || id === 'skills') {
      camera.position.set(0, 2.7, 5.6); controls.target.set(0, 2.5, -4.7); book.visible = false;
    } else {
      const halfHorizontal = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
      const distance = Math.max(4.8, 2.2 / Math.tan(halfHorizontal) * 1.15);
      book.position.copy(insideRoom.boardPoint); book.visible = true;
      camera.position.copy(insideRoom.boardPoint).add(new THREE.Vector3(0, 0, distance));
      controls.target.copy(insideRoom.boardPoint);
    }
    camera.lookAt(controls.target); camera.rotation.order = 'YXZ'; lookYaw = camera.rotation.y; lookPitch = camera.rotation.x;
    if (notify) { onInterior?.({ kind: id, screens: insideRoom.screens }); audio.room(id); }
  }
  function finishExit() {
    insideRoom.group.visible = false; insideRoom = null; trip = null; world.visible = true; exterior.visible = true;
    book.visible = false;
    camera.fov = 34; camera.updateProjectionMatrix();
    camera.position.set(-3.1, 2.2, 3.6); controls.target.set(0, 1, 0);
    destinationTarget.set(0, 1, 0); destination.set(16, 11, 20).normalize().multiplyScalar(fitDistance);
    controls.enabled = true; flying = false; activeDesk = null; onInterior?.({ kind: null, screens: [] });
    if (!playing) { camera.position.copy(destination); controls.target.copy(destinationTarget); flying = false; }
  }
  function focusStation(index, notify = true, browsing = false) {
    if (insideRoom?.kind !== 'projects' || journey) return;
    const station = insideRoom.screens[index]; if (!station) return;
    const halfHorizontal = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const distance = Math.max(browsing ? 1.65 : 3, 1.36 / Math.tan(halfHorizontal) * (browsing ? 1.08 : 1.18));
    destinationTarget.copy(station.point);
    destination.copy(station.point).addScaledVector(station.normal, distance);
    destination.y = 2.55; flying = true; trip = null;
    activeDesk = index; activeScreenMode = browsing;
    if (notify) pendingStation = index;
    insideRoom.screens.forEach(screen => { screen.element.style.pointerEvents = 'none'; });
    host.setAttribute('aria-busy', 'true');
    if (!playing) render(lastTime);
  }
  function focusPlant(index) {
    const plant = insideRoom?.skillPlants[index]; if (!plant || journey) return;
    const halfHorizontal = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    destinationTarget.copy(plant.point); destination.copy(plant.point).addScaledVector(plant.normal, Math.max(2.1, .85 / Math.tan(halfHorizontal)));
    destination.y = 2.5; flying = true; activeDesk = null;
    if (!playing) render(lastTime);
  }
  function setSound(muted) {
    audio.setMuted(muted); rooms.forEach(room => room.setSound(muted, audio.ready)); onSoundChange?.(muted, audio.ready);
  }
  const ease = t => t * t * t * (t * (t * 6 - 15) + 10);
  function threshold(opacity) {
    veil.style.opacity = String(opacity); cssRenderer.domElement.style.opacity = String(1 - opacity);
  }
  function cameraPhase(name, duration, view, { start, update, end } = {}) {
    let from, fromTarget, fromRotation, to, toRotation, fromFov;
    return { name, duration,
      begin() {
        start?.(); from = camera.position.clone(); fromFov = camera.fov;
        fromRotation = camera.quaternion.clone();
        fromTarget = camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(Math.max(1, camera.position.distanceTo(controls.target))).add(camera.position);
        to = view(); toRotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(to.position, to.target, camera.up));
      },
      tick(t) {
        const s = ease(t); camera.position.lerpVectors(from, to.position, s); controls.target.lerpVectors(fromTarget, to.target, s);
        camera.quaternion.slerpQuaternions(fromRotation, toRotation, s); camera.fov = THREE.MathUtils.lerp(fromFov, to.fov ?? fromFov, s); camera.updateProjectionMatrix(); update?.(s);
      },
      end() { lookYaw = camera.rotation.y; lookPitch = camera.rotation.x; end?.(); }
    };
  }
  function startJourney(phases, complete) {
    flying = false; trip = null; pendingStation = null; walkKeys.clear(); controls.enabled = false;
    journey = { phases, index: 0, elapsed: 0, begun: false, complete };
    veil.style.pointerEvents = 'auto'; host.setAttribute('aria-busy', 'true');
  }
  function advanceJourney(elapsed) {
    let remaining = elapsed;
    while (journey) {
      const phase = journey.phases[journey.index];
      if (!journey.begun) { phase.begin(); journey.begun = true; veil.dataset.phase = phase.name; }
      const used = Math.min(remaining, phase.duration - journey.elapsed);
      journey.elapsed += used; remaining -= used; phase.tick(journey.elapsed / phase.duration);
      if (journey.elapsed < phase.duration) break;
      phase.end(); journey.index++; journey.elapsed = 0; journey.begun = false;
      if (journey.index === journey.phases.length) {
        const complete = journey.complete; journey = null; threshold(0); veil.style.pointerEvents = 'none'; delete veil.dataset.phase;
        host.setAttribute('aria-busy', 'false'); controls.enabled = !insideRoom;
        if (queuedPlace !== undefined) { const id = queuedPlace; queuedPlace = undefined; focus(id); }
        else complete?.();
      }
      if (!remaining) break;
    }
  }
  function doorway(id) {
    const door = doors[id] || doors.story; door.rotation.y = 0; world.updateMatrixWorld(true);
    const point = door.localToWorld(new THREE.Vector3(door.userData.width / 2, door.userData.height * .55, 0));
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(door.parent.getWorldQuaternion(new THREE.Quaternion()));
    return { door, point, normal };
  }
  function beginEntrance(id) {
    const { door, point, normal } = doorway(id);
    const outside = distance => ({ position: point.clone().addScaledVector(normal, distance), target: point.clone().addScaledVector(normal, -.5), fov: 58 });
    let roomView;
    book.visible = false;
    startJourney([
      cameraPhase('approach-door', 1.35, () => outside(1.25)),
      cameraPhase('open-door', .8, () => outside(.75), { start: () => audio.door(true), update: t => { door.rotation.y = -t * 1.4; } }),
      cameraPhase('cross-threshold', .65, () => outside(.025), { update: t => threshold(ease(Math.max(0, (t - .35) / .65))), end: () => {
        finishEntrance(id); roomView = { position: camera.position.clone(), target: controls.target.clone(), fov: 65 };
        insideRoom.setDoor(1); camera.position.set(0, 2.5, 8.1); controls.target.set(0, 2.4, -4.7); camera.lookAt(controls.target);
      } }),
      cameraPhase('enter-room', 1.1, () => roomView, { update: t => { threshold(1 - Math.min(1, t * 2)); insideRoom.setDoor(1 - t); }, end: () => { if (playing) audio.door(false); } })
    ]);
  }
  function beginExit(next = null) {
    const leaving = insideRoom, { door, point, normal } = doorway(leaving.kind);
    audio.room(null); book.visible = false;
    startJourney([
      cameraPhase('walk-to-exit', 1.15, () => ({ position: new THREE.Vector3(0, 2.45, 5.15), target: new THREE.Vector3(0, 2.1, 6.82), fov: 65 })),
      cameraPhase('open-exit', .8, () => ({ position: new THREE.Vector3(0, 2.45, 6), target: new THREE.Vector3(0, 2.1, 7.2), fov: 65 }), { start: () => audio.door(true), update: t => leaving.setDoor(t) }),
      cameraPhase('leave-room', .65, () => ({ position: new THREE.Vector3(0, 2.45, 7.5), target: new THREE.Vector3(0, 2.1, 9), fov: 65 }), { update: t => threshold(ease(Math.max(0, (t - .3) / .7))), end: () => {
        finishExit(); door.rotation.y = -1.4;
        camera.position.copy(point).addScaledVector(normal, .2); controls.target.copy(point).addScaledVector(normal, 4); camera.lookAt(controls.target);
      } }),
      cameraPhase('return-to-garden', 1.4, () => ({ position: new THREE.Vector3(16, 11, 20).normalize().multiplyScalar(fitDistance), target: new THREE.Vector3(0, 1, 0), fov: 34 }), { start: () => { if (playing) audio.door(false); }, update: t => { threshold(1 - Math.min(1, t * 2)); door.rotation.y = -1.4 * (1 - t); } })
    ], () => { if (next) beginEntrance(next); });
  }
  function focus(id) {
    selectedPlace = id;
    if (journey) { queuedPlace = id; return; }
    if (id === insideRoom?.kind) return;
    if (insideRoom) beginExit(id);
    else if (id) beginEntrance(id);
    else {
      destinationTarget.set(0, 1, 0); destination.set(16, 11, 20).normalize().multiplyScalar(fitDistance);
      controls.enabled = true; flying = true;
    }
    if (!playing) render(lastTime);
  }
  const raycaster = new THREE.Raycaster();
  let pointerDown = null;
  const down = event => { if (journey) return; pointerDown = [event.clientX, event.clientY]; lookDown = [event.clientX, event.clientY]; if (insideRoom) renderer.domElement.setPointerCapture(event.pointerId); };
  function look(event) {
    if (!insideRoom || journey || !lookDown || !event.buttons) return;
    flying = false;
    pendingStation = null;
    lookYaw -= (event.clientX - lookDown[0]) * .004;
    lookPitch = THREE.MathUtils.clamp(lookPitch - (event.clientY - lookDown[1]) * .004, -.95, .95);
    lookDown = [event.clientX, event.clientY];
    if (!playing) render(lastTime);
  }
  function pick(event) {
    lookDown = null;
    if (!immersive || journey || flying || !pointerDown || Math.hypot(event.clientX - pointerDown[0], event.clientY - pointerDown[1]) > 8) return;
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    const hit = raycaster.intersectObjects(insideRoom ? insideRoom.pickable : interactiveObjects, true)[0];
    if (!hit) return;
    let object = hit.object;
    if (insideRoom) {
      while (object && !object.userData.exit && object.userData.station === undefined && object.userData.plant === undefined && !object.userData.walk) object = object.parent;
      if (object?.userData.exit) onSelect?.(null);
      else if (object?.userData.station !== undefined) focusStation(object.userData.station);
      else if (object?.userData.plant !== undefined) focusPlant(object.userData.plant);
      else if (object?.userData.walk) {
        destination.set(THREE.MathUtils.clamp(hit.point.x, -7, 7), 2.7, THREE.MathUtils.clamp(hit.point.z, -6, 6));
        destinationTarget.copy(destination).add(new THREE.Vector3(-Math.sin(lookYaw), Math.sin(lookPitch), -Math.cos(lookYaw))); flying = true;
      }
      return;
    }
    while (object && !object.userData.place) object = object.parent;
    if (object) onSelect?.(object.userData.place);
  }
  const controlsChanged = () => { if (!playing) render(lastTime); };
  const keyDown = event => {
    if (!insideRoom || journey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      walkKeys.add(key); event.preventDefault();
      if (!playing) {
        flying = false;
        const dx = ['a', 'arrowleft'].includes(key) ? -.18 : ['d', 'arrowright'].includes(key) ? .18 : 0;
        const dz = ['w', 'arrowup'].includes(key) ? -.18 : ['s', 'arrowdown'].includes(key) ? .18 : 0;
        const nextX = camera.position.x + dx * Math.cos(lookYaw) + dz * Math.sin(lookYaw);
        const nextZ = camera.position.z - dx * Math.sin(lookYaw) + dz * Math.cos(lookYaw);
        if (Math.abs(nextX) < 7.25 && Math.abs(nextZ) < 6.25 && !insideRoom.colliders.some(c => Math.abs(nextX - c.x) < c.width && Math.abs(nextZ - c.z) < c.depth)) camera.position.set(nextX, 2.7, nextZ);
        render(lastTime);
      }
    }
  };
  const keyUp = event => walkKeys.delete(event.key.toLowerCase());
  const blur = () => { walkKeys.clear(); lookDown = null; };
  controls?.addEventListener('change', controlsChanged);
  if (immersive) {
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointerup', pick);
    renderer.domElement.addEventListener('pointermove', look);
    document.addEventListener('keydown', keyDown); document.addEventListener('keyup', keyUp); window.addEventListener('blur', blur);
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const visibilityObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; loop(); }, { rootMargin: '80px' });
  visibilityObserver.observe(host);
  host.addEventListener('pointermove', move);
  document.addEventListener('visibilitychange', loop);
  const lost = event => { event.preventDefault(); renderer.setAnimationLoop(null); onError?.('The 3D garden is taking a rest. You can still read every chapter.'); };
  const restored = () => { loop(); onReady?.(); };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  renderer.domElement.addEventListener('webglcontextrestored', restored);
  resize(); loop(); if (audio) onSoundChange?.(audio.muted, audio.ready); onReady?.();
  return {
    panelElement: bookElement,
    setLocation(id) { if (immersive && (id === null || places[id] || id === 'map')) focus(id); },
    focusStation,
    setMuted: setSound,
    showRoom() { if (insideRoom?.kind === 'projects' && !journey) { activeDesk = null; destination.set(0, 2.7, 5.6); destinationTarget.set(0, 2.5, -4.7); flying = true; if (!playing) render(lastTime); } },
    setEvening(value) { progress = value ? 1 : 0; if (!playing) render(lastTime); },
    setProgress(value) { progress = THREE.MathUtils.clamp(value, 0, 1); if (!playing || !visible) render(lastTime); },
    setPlaying(value) { playing = value; loop(); },
    dispose() {
      disposed = true; audio?.dispose(); veil.remove(); renderer.setAnimationLoop(null); resizeObserver.disconnect(); visibilityObserver.disconnect();
      host.removeEventListener('pointermove', move); document.removeEventListener('visibilitychange', loop);
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', pick);
      renderer.domElement.removeEventListener('pointermove', look); document.removeEventListener('keydown', keyDown); document.removeEventListener('keyup', keyUp); window.removeEventListener('blur', blur);
      controls?.removeEventListener('change', controlsChanged); controls?.dispose(); cssRenderer?.domElement.remove();
      renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.domElement.removeEventListener('webglcontextrestored', restored);
      const geometries = new Set(), usedMaterials = new Set();
      scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) usedMaterials.add(object.material); if (object.isInstancedMesh) object.dispose(); });
      geometries.forEach(g => g.dispose()); usedMaterials.forEach(m => { m.map?.dispose(); m.dispose(); }); gradient.dispose(); renderer.dispose(); renderer.domElement.remove();
    }
  };
}
