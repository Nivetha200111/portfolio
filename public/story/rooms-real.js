import * as THREE from './vendor/three.module.js';

// Realistic rooms. Each room keeps its layout, furniture and screens from interiors.js;
// this swaps the flat colours for physically based materials, puts scanned plants in
// the pots, and adds practical light: daylight through the window, glowing lanterns,
// a lit doorway. `kit` comes from realism.js once the garden's assets have loaded.
export function remasterRoom(room, kind, kit) {
  const { surfaces, models, standard, own, weave, random } = kit;
  const group = room.group;
  const tinted = (set, color, { tile = 1, roughness = 1, normalScale = 1 } = {}) => standard({ ...set, color: new THREE.Color('#ffffff').lerp(new THREE.Color(color), .55), roughness, normalScale: new THREE.Vector2(normalScale, normalScale) });
  const cache = new Map();
  const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

  // Re-project UVs in world units so textures keep their real size on any box.
  function projectUVs(mesh, tile) {
    if (!mesh.geometry.attributes.normal) return;
    const geometry = mesh.geometry.clone(), position = geometry.attributes.position, normal = geometry.attributes.normal;
    const scale = mesh.getWorldScale(new THREE.Vector3()), uv = new Float32Array(position.count * 2), n = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i) * scale.x, y = position.getY(i) * scale.y, z = position.getZ(i) * scale.z;
      n.set(normal.getX(i) / scale.x, normal.getY(i) / scale.y, normal.getZ(i) / scale.z);
      const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
      if (ax >= ay && ax >= az) { uv[i * 2] = z / tile; uv[i * 2 + 1] = y / tile; }
      else if (ay >= az) { uv[i * 2] = x / tile; uv[i * 2 + 1] = z / tile; }
      else { uv[i * 2] = x / tile; uv[i * 2 + 1] = y / tile; }
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); mesh.geometry = geometry;
  }

  const wood = color => once(`wood:${color}`, () => tinted(surfaces.wood_planks, color, { roughness: .82 }));
  const fabric = color => once(`fabric:${color}`, () => standard({ color, roughness: .95, normalMap: weave, normalScale: new THREE.Vector2(.6, .6), side: THREE.DoubleSide }));
  const plaster = color => once(`plaster:${color}`, () => standard({ ...surfaces.white_plaster_rough_01, color: new THREE.Color('#ffffff').lerp(new THREE.Color(color), .3), roughness: 1, normalScale: new THREE.Vector2(.7, .7) }));
  const plain = (color, roughness = .7, metalness = 0) => once(`plain:${color}:${roughness}:${metalness}`, () => standard({ color, roughness, metalness }));
  const brass = () => plain('#c9a45c', .3, 1);
  const glow = (color, intensity) => once(`glow:${color}:${intensity}`, () => standard({ color: '#000000', emissive: color, emissiveIntensity: intensity, roughness: 1 }));
  const books = ['#5b3a2e', '#2f4a3c', '#7a5a2c', '#2d3e56', '#6b2f2f', '#4d4a38'];

  // Colour → [material, uv tile]. Colours are the ones interiors.js and plants.js use.
  const floorWood = tinted(surfaces.wood_planks, '#a97d55', { roughness: .7 });
  const table = {
    // floor, beams, posts, trim
    aa805a: [floorWood, 1.3], bb986c: [floorWood, 1.3], c9a778: [floorWood, 1.3], '786b4c': [plain('#3a3328', .45, .8)],
    '776448': [wood('#5f4a33'), 1], '88704e': [wood('#6e5539'), 1], '957b52': [wood('#7d6443'), 1], '9c8059': [wood('#7d6443'), 1],
    // door, window, doorway light
    '526d56': [wood('#3f5a45'), .8], '678261': [wood('#4f6b4f'), .8], '9aa578': [wood('#77835c'), .8],
    b5a069: [brass()], d2b36b: [brass()], b4c8a1: [glow('#ffe2b0', 1.6)], '8db2a6': [glow('#dcecff', 2.4)],
    ccbc92: [plaster('#d8cdb4'), 1], e8d5ad: [fabric('#e9dcc0')],
    // lanterns, clock
    f1d496: [standard({ color: '#f3dcb4', roughness: .9, emissive: '#ff9c45', emissiveIntensity: 2.3 })], '716349': [plain('#2f2c27', .5, .8)], '927b56': [wood('#5d4630'), .6], efdfb8: [plain('#f2ead6', .35)], '566a50': [plain('#1c1c1a', .4, .7)],
    // gramophone
    '9d7853': [wood('#6b4a2e'), .7], '806546': [wood('#5a4330'), .6], '344b42': [plain('#0d0d0e', .22)], d3b571: [plain('#b8322a', .5)], b9a272: [brass()], c3a366: [brass()], c4b175: [brass()],
    // shelves
    '8c704e': [wood('#6a5136'), .8], b29262: [wood('#87683f'), .8], b4a575: [plain(books[2], .6)], '729295': [plain(books[3], .6)], '7a9a7a': [plain(books[1], .6)], ac7560: [plain(books[4], .6)],
    // workstations
    bc9769: [wood('#9b7447'), 1], '586b59': [plain('#1d2120', .35, .3)], b8c6a1: [plain('#9aa09a', .35, .8)], '667b61': [plain('#2a2d2b', .4, .5)],
    d0c5a1: [plain('#e6e1d6', .45)], '8c957c': [plain('#d8d3c7', .5)], ddbd89: [plain('#f3eee4', .12)], d9ccaa: [plain('#f3eee4', .12)], a8b794: [plain('#dcd8cf', .35)],
    ad9970: [plain('#8b6d4a', .5)], b78767: [plain('#c84a2b', .5)], '789474': [plain('#2d5a3a', .5)], e9cd83: [plain('#f4dd7a', .85)], '697c60': [plain('#1d1d1c', .6)], c4b790: [plain('#efe7d4', .9)],
    '879a70': [fabric('#5f7458')],
    // shared making table, lamp
    bb9464: [wood('#94683d'), 1], '826747': [wood('#5a4330'), .6], ede1bc: [plain('#f4eedf', .9)], '698366': [plain('#3c5a42', .6)], '5e7459': [plain('#2f2c27', .5, .8)], d6b66a: [brass()],
    // noticeboards, gears, telescope, trophies, desks, sofa
    '7e6d4c': [standard({ color: '#9b7a52', roughness: .95, normalMap: weave, normalScale: new THREE.Vector2(.25, .25) })], b4a078: [wood('#8a6a43'), .8],
    b29860: [brass()], '857758': [wood('#6b5a3f'), .8], '6c8d86': [plain('#2f3a37', .5, .8)], a6b3a0: [brass()], d5b468: [plain('#d4af37', .25, 1)],
    a18c62: [wood('#8a6c45'), 1], '7e7454': [plain('#3c3a33', .5, .8)], '839b78': [plain('#5f7560', .45, .7)],
    '9f7b59': [wood('#7a5a3b'), .8], e4ca9d: [plain('#efe2c6', .9)], bd9467: [wood('#9a6f43'), 1], '617b61': [plain('#36513d', .6)], efdfbd: [plain('#f5eedc', .9)], ded0ad: [plain('#f1e8d2', .9)],
    '91a878': [fabric('#6c8160')], d6c8a5: [fabric('#e3d8bf')], f2d69b: [glow('#ffd894', 4)]
  };
  const rugColors = { '839870': '#7d5a46', '8ea67e': '#6f7d55', ab8d70: '#8a4a3a', '708f95': '#3d566b', c0a07d: '#9b6a45', a29977: '#7a6a52' };
  const wallColors = ['eee1bc', 'd5e0c0', 'bacdc7'];
  const hideColors = ['5d7650', '8baf70', '6c945e', '876646', '98ae71', 'c6b793'];
  const pots = [];

  group.traverse(object => {
    if (object.isPointLight) { object.intensity = 34; object.distance = 16; object.decay = 2; return; }
    if (!object.isMesh || object.userData.realRoom) return;
    const material = object.material;
    // Painted signs become lit, printed boards; the fake floor sunbeam gives way to real light.
    if (material.isMeshBasicMaterial) {
      if (material.map) object.material = standard({ map: material.map, roughness: .85 });
      else if (material.color.getHexString() === 'ffe6a1') object.visible = false;
      return;
    }
    if (!material.isMeshToonMaterial) return;
    const hex = material.color.getHexString();
    if (hideColors.includes(hex) && !object.parent?.userData.plant) { object.visible = false; return; }
    if (hex === 'bd8568' || hex === 'b98667') pots.push(object);
    let [next, tile] = table[hex] || [];
    if (wallColors.includes(hex)) [next, tile] = [plaster(`#${hex}`), 1.6];
    else if (rugColors[hex]) [next, tile] = [fabric(rugColors[hex]), .6];
    else if (hex === 'd3c5a1') [next, tile] = [fabric('#e7dcc3'), .6];
    else if (hex === 'bd8568' || hex === 'b98667' || hex === 'd6a079') [next, tile] = [once('terracotta', () => standard({ ...surfaces.white_plaster_rough_01, color: '#c06a45', roughness: .88, normalScale: new THREE.Vector2(.5, .5) })), .4];
    else if (hex === '6d5b43') next = plain('#2d2219', 1);
    if (!next) next = plain(`#${hex}`, .75);
    if (tile) projectUVs(object, tile);
    object.material = next; object.castShadow = true; object.receiveShadow = true;
  });

  // Real plants in every pot. Each pot gets a variant scaled to its size.
  const potted = [...models.shrub_03, ...models.shrub_04, ...models.fern_02, ...models.searsia_lucida.slice(2), ...models.pine_sapling_small];
  const placePlant = (template, x, y, z, scale, parent = group) => {
    const plant = template.clone(); plant.position.set(x, y, z); plant.rotation.y = random() * Math.PI * 2; plant.scale.setScalar(scale);
    plant.traverse(node => { node.userData.realRoom = true; }); parent.add(plant); return plant;
  };
  pots.forEach((pot, i) => {
    if (pot.parent?.userData.plant !== undefined) return; // greenhouse plants are handled below
    const params = pot.geometry.parameters, size = (params.radiusTop || .3) / .3;
    const template = potted[i % potted.length], height = template.userData.size.y || 1;
    placePlant(template, pot.position.x, pot.position.y + (params.height || .5) / 2 - .02, pot.position.z, Math.min(1.6 * size / height, 2.2));
  });

  // Greenhouse: every skill grows as a real potted plant; its label and tap target stay.
  if (kind === 'skills') {
    const greens = [...models.shrub_03, ...models.shrub_04, ...models.fern_02, ...models.searsia_lucida.slice(3), ...models.pine_sapling_small, ...models.shrub_02];
    (room.skillPlants || []).forEach((entry, index) => {
      const plantGroup = group.children.find(child => child.userData.plant === index);
      if (!plantGroup) return;
      plantGroup.children.forEach((child, c) => { if (c > 2 && !child.isCSS3DObject && !child.isCSS3DSprite) child.visible = false; });
      plantGroup.traverse(child => { if (child.isMesh && child.visible && child.material.isMeshToonMaterial) child.material = plain('#4a3a2c', 1); });
      const template = greens[index % greens.length], height = template.userData.size.y || 1;
      placePlant(template, 0, .47, 0, Math.min(1.25 / height, 1.9), plantGroup);
    });
    group.traverse(object => {
      if (object.isMesh && object.material.isMeshBasicMaterial && object.material.transparent && object.geometry.type === 'SphereGeometry') {
        object.material = own(new THREE.MeshPhysicalMaterial({ color: '#dcefe6', roughness: .04, metalness: 0, transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, envMapIntensity: 1.4 }));
      }
    });
  }

  // Wishing tree: a real tree, strung with warm fairy lights.
  if (kind === 'achievements') {
    const tree = placePlant(models.island_tree_02[0], -5, 0, -3, 1.45);
    tree.rotation.y = .8;
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.035, 10, 8), glow('#ffcf7a', 6), 46);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 46; i++) {
      const a = random() * Math.PI * 2, r = .6 + random() * 1.7, y = 2.6 + random() * 2.2;
      bulbs.setMatrixAt(i, m.makeTranslation(-5 + Math.cos(a) * r, y, -3 + Math.sin(a) * r));
    }
    bulbs.userData.realRoom = true; group.add(bulbs);
  }

  // Observatory: the inside of the dome is a night sky.
  if (kind === 'certifications') {
    const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 1024;
    const ctx = canvas.getContext('2d'), gradient = ctx.createLinearGradient(0, 0, 0, 1024);
    gradient.addColorStop(0, '#070b1c'); gradient.addColorStop(1, '#1c2a4a'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 2048, 1024);
    for (let i = 0; i < 1600; i++) { const s = random() ** 3 * 2.6 + .4; ctx.fillStyle = `rgba(255,${235 + random() * 20 | 0},${200 + random() * 55 | 0},${.35 + random() * .65})`; ctx.beginPath(); ctx.arc(random() * 2048, random() * 1000, s, 0, Math.PI * 2); ctx.fill(); }
    const stars = new THREE.CanvasTexture(canvas); stars.colorSpace = THREE.SRGBColorSpace;
    group.traverse(object => {
      if (object.isMesh && object.geometry.type === 'SphereGeometry' && object.material.side === THREE.BackSide) {
        object.material = standard({ color: '#0b1022', roughness: .9, emissive: '#ffffff', emissiveMap: stars, emissiveIntensity: 1.3, side: THREE.BackSide });
      }
    });
  }

  // A timber ceiling above the beams (the greenhouse is open to the sky, and the
  // observatory has its painted dome).
  if (kind !== 'skills' && kind !== 'certifications') {
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(16.4, 14.4), tinted(surfaces.wood_planks, '#6b5137', { roughness: .9 }));
    ceiling.geometry.setAttribute('uv', new THREE.BufferAttribute(ceiling.geometry.attributes.uv.array.map((v, i) => v * (i % 2 ? 14.4 : 16.4) / 1.4), 2));
    ceiling.rotation.x = Math.PI / 2; ceiling.position.y = 6.28; ceiling.receiveShadow = true; ceiling.userData.realRoom = true;
    group.add(ceiling);
  }

  // Daylight pours in through the window: a soft, shadow-casting shaft on the floor.
  const daylight = new THREE.SpotLight('#ffe2b8', 90, 22, .62, .75, 1.4);
  daylight.position.set(-7.35, 5.3, -1.6); daylight.target.position.set(-3.2, 0, -1.2);
  daylight.castShadow = true; daylight.shadow.mapSize.set(1024, 1024); daylight.shadow.bias = -.0004; daylight.shadow.normalBias = .03;
  group.add(daylight, daylight.target);
  const shaftMaterial = own(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      void main() {
        float along = vUv.y, across = abs(vUv.x - .5) * 2.;
        float bars = smoothstep(.06, .0, abs(fract(vUv.x * 2.) - .5) - .44);
        float a = (1. - across * across) * smoothstep(0., .25, along) * smoothstep(1., .6, along) * (1. - bars * .6);
        a *= .75 + .25 * sin(along * 9. - uTime * .6 + vUv.x * 4.);
        gl_FragColor = vec4(vec3(1., .88, .65) * a * .55, a * .2);
      }`
  }));
  const shaft = new THREE.Group(); shaft.userData.realRoom = true;
  for (const angle of [0, Math.PI / 2]) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 7.2), shaftMaterial);
    plane.rotation.y = angle; shaft.add(plane);
  }
  shaft.position.set(-5.4, 2.7, -1.45); shaft.lookAt(-3.2, 0, -1.2); shaft.rotateX(Math.PI / 2);
  group.add(shaft);

  return {
    update(time) { shaftMaterial.uniforms.uTime.value = time; }
  };
}

// A woven fabric normal map: threads going over and under each other.
export function createWeave() {
  const size = 128, data = new Uint8Array(size * size * 4);
  const height = (x, y) => {
    const cellX = Math.floor(x / 8), cellY = Math.floor(y / 8), over = (cellX + cellY) % 2 === 0;
    const u = (x % 8) / 8, v = (y % 8) / 8;
    return over ? Math.sin(u * Math.PI) * .8 + Math.sin(v * Math.PI * 4) * .1 : Math.sin(v * Math.PI) * .8 + Math.sin(u * Math.PI * 4) * .1;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = height((x + 1) % size, y) - height((x + size - 1) % size, y), dy = height(x, (y + 1) % size) - height(x, (y + size - 1) % size);
    const n = new THREE.Vector3(-dx * 2, -dy * 2, 1).normalize(), i = (y * size + x) * 4;
    data[i] = (n.x * .5 + .5) * 255; data[i + 1] = (n.y * .5 + .5) * 255; data[i + 2] = (n.z * .5 + .5) * 255; data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.repeat.set(6, 6); texture.needsUpdate = true;
  return texture;
}
