import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/meshopt_decoder.module.js';
import { EffectComposer } from './vendor/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/postprocessing/OutputPass.js';
import { remasterRoom, createWeave } from './rooms-real.js?v=4';
import { createAtmosphere, SKY_GLSL } from './atmosphere.js?v=1';
import { ShaderPass } from './vendor/postprocessing/ShaderPass.js';

// The photoreal garden. Scanned CC0 plants, rocks, materials and sky from Poly Haven
// (see assets/README.md) replace the hand-modeled outdoor scenery. The buildings keep
// their shapes but get physically based materials. Rooms are untouched: everything
// here lives in `exterior`/`world`, and lighting is swapped back when going indoors.
const BASE = '/story/assets/';
const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make().catch(error => { cache.delete(key); throw error; }));
  return cache.get(key);
};
const loadModel = id => once(`model:${id}`, () => new Promise((resolve, reject) => {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(`${BASE}models/${id}.glb`, gltf => resolve(gltf.scene), undefined, reject);
}));
const textureLoader = new THREE.TextureLoader();
const loadTexture = (path, srgb) => once(`texture:${path}`, () => new Promise((resolve, reject) => textureLoader.load(`${BASE}textures/${path}`, texture => {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 8;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  resolve(texture);
}, undefined, reject)));
// Leaf, grass and petal cut-outs. The glTF colour maps are JPEG, so each plant's alpha
// mask is a separate texture; `match` picks the materials that use it.
const ALPHA = {
  grass_bermuda_01: null, fern_02: null, moss_01: null, searsia_lucida: null, shrub_02: null, shrub_03: null, shrub_04: null,
  flower_gazania: null, flower_ursinia: null, flower_empodium: null, dandelion_01: null,
  island_tree_02: /leaves/, pine_sapling_small: /twig/
};
const loadAlpha = id => once(`alpha:${id}`, () => new Promise((resolve, reject) => textureLoader.load(`${BASE}alpha/${id}.webp`, texture => {
  texture.flipY = false; texture.anisotropy = 4; resolve(texture);
}, undefined, reject)));
const loadSurface = id => Promise.all([loadTexture(`${id}/Diffuse.webp`, true), loadTexture(`${id}/nor_gl.webp`), loadTexture(`${id}/arm.webp`)])
  .then(([map, normalMap, roughnessMap]) => ({ map, normalMap, roughnessMap }));

const MODELS = ['island_tree_02', 'searsia_lucida', 'pine_sapling_small', 'shrub_02', 'shrub_03', 'shrub_04', 'fern_02', 'flower_gazania', 'flower_ursinia', 'flower_empodium', 'dandelion_01', 'grass_bermuda_01', 'moss_01', 'rock_moss_set_01', 'boulder_01'];
const SURFACES = ['aerial_grass_rock', 'cliff_side', 'clay_roof_tiles_02', 'plastered_stone_wall', 'white_plaster_rough_01', 'wood_planks', 'mossy_cobblestone'];

// Island footprint: an ellipse with a gently domed top and a rocky root below.
const RX = 7.4, RZ = 6.2;
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v);
}
const fbm = (x, y) => noise(x, y) * .5 + noise(x * 2.1 + 5, y * 2.1) * .25 + noise(x * 4.3, y * 4.3 + 9) * .125;
const radial = (x, z) => Math.sqrt((x / RX) ** 2 + (z / RZ) ** 2);
export function heightAt(x, z) {
  const r = radial(x, z);
  const plateau = .58 - .1 * r * r + (fbm(x * .45, z * .45) - .45) * .07;
  const edge = THREE.MathUtils.smoothstep(r, .9, 1.02);
  return plateau - edge * edge * .75;
}

export function createRealism({ renderer, scene, exterior, world, hemisphere, sun, hide, pond, path, buildings }) {
  // Phones and low-core machines get a lighter garden and a lower render resolution.
  const lite = Math.min(window.innerWidth, window.innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;
  // Visitors pick a quality mode. Auto adapts resolution to the frame rate. Sharp holds
  // full resolution even if frames slow down. Fast caps resolution and thins the
  // small plants (grass, moss, flowers), the main cost on integrated GPUs.
  const dpr = window.devicePixelRatio;
  const QUALITY = {
    auto: { ceiling: Math.min(dpr, lite ? 1 : 1.25), floor: .7, adaptive: true, density: 1, bloom: !lite, msaa: 0 },
    sharp: { ceiling: Math.min(dpr, 1.5), floor: Math.min(dpr, 1.5), adaptive: false, density: 1, bloom: true, msaa: 2 },
    fast: { ceiling: Math.min(dpr, .9), floor: .6, adaptive: true, density: .35, bloom: false, msaa: 0 }
  };
  let quality = 'auto', settings = QUALITY.auto;
  let pixelRatio = settings.ceiling, frameAverage = 16, lastFrame = 0, sinceChange = 0, frame = 0;
  const setRatio = value => {
    pixelRatio = value;
    const { width, height } = renderer.domElement.getBoundingClientRect();
    renderer.setPixelRatio(pixelRatio); if (width && height) renderer.setSize(width, height, false);
  };
  renderer.setPixelRatio(pixelRatio);
  function applyQuality() {
    settings = QUALITY[quality];
    if (composer && composer.renderTarget1.samples !== settings.msaa) dropComposer();
    frameAverage = 16; sinceChange = 0; setRatio(settings.ceiling);
    created.children.forEach(child => {
      if (child.isInstancedMesh && child.userData.fullCount) child.count = Math.max(1, Math.round(child.userData.fullCount * settings.density));
    });
  }
  // Auto and Fast: render resolution steps down on slow GPUs and back up on fast ones.
  function adaptResolution() {
    const now = performance.now(), interval = now - lastFrame; lastFrame = now;
    if (!settings.adaptive || interval > 100) return; // hidden tab or a one-off hitch, not a steady rate
    frameAverage += (interval - frameAverage) * .05; sinceChange += interval;
    if (sinceChange < 1500) return;
    const next = frameAverage > 24 ? Math.max(settings.floor, pixelRatio - .15) : frameAverage < 15 ? Math.min(settings.ceiling, pixelRatio + .1) : pixelRatio;
    if (next !== pixelRatio) { sinceChange = 0; setRatio(next); }
  }
  const magic = { value: 0 }; // 0 at golden hour, 1 at magic hour (the evening toggle)
  let windowGlass = null, lanternGlow = null;
  let disposed = false, loaded = false, outdoors = true, sky = null, sunDirection = new THREE.Vector3(-.5, .45, -.6), sunColor = new THREE.Color('#ffd9a8');
  const created = new THREE.Group(); world.add(created);
  const floating = new THREE.Group(); exterior.add(floating);
  created.visible = floating.visible = false;
  const ownTextures = new Set(), ownMaterials = new Set();
  let room = null, roomKit = null;
  const pendingRooms = [];
  // Rooms are built on demand; each one is made realistic as soon as assets are ready.
  function enchantRoom(target, kind) {
    if (target.real) return;
    if (!loaded) { pendingRooms.push([target, kind]); return; }
    target.real = remasterRoom(target, kind, roomKit);
    const update = target.update;
    target.update = time => { update(time); target.real.update(time); };
  }
  const saved = { hemisphere: hemisphere.intensity, sunIntensity: sun.intensity, sunColor: sun.color.clone(), sunPosition: sun.position.clone(), shadow: (({ left, right, top, bottom, near, far }) => ({ left, right, top, bottom, near, far }))(sun.shadow.camera), mapSize: sun.shadow.mapSize.clone() };
  const standard = options => { const material = new THREE.MeshStandardMaterial(options); ownMaterials.add(material); return material; };
  const surface = (set, { tint = '#ffffff', roughness = 1, normalScale = 1, metalness = 0 } = {}) => standard({ ...set, color: tint, roughness, metalness, normalScale: new THREE.Vector2(normalScale, normalScale) });

  // ---------------------------------------------------------------- terrain
  function islandTop(material) {
    const rings = 56, segments = 160, positions = [], uvs = [], index = [];
    positions.push(0, heightAt(0, 0), 0); uvs.push(0, 0);
    for (let i = 1; i <= rings; i++) {
      const r = (i / rings) ** .85 * 1.02;
      for (let j = 0; j < segments; j++) {
        const a = j / segments * Math.PI * 2, wobble = 1 + (fbm(Math.cos(a) * 2.2 + 3, Math.sin(a) * 2.2) - .45) * .12 * THREE.MathUtils.smoothstep(r, .7, 1);
        const x = Math.cos(a) * r * RX * wobble, z = Math.sin(a) * r * RZ * wobble;
        positions.push(x, heightAt(x, z), z); uvs.push(x / 3.4, z / 3.4);
      }
    }
    for (let j = 0; j < segments; j++) index.push(0, 1 + (j + 1) % segments, 1 + j);
    for (let i = 1; i < rings; i++) for (let j = 0; j < segments; j++) {
      const a = 1 + (i - 1) * segments + j, b = 1 + (i - 1) * segments + (j + 1) % segments, c = a + segments, d = b + segments;
      index.push(a, b, c, b, d, c);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(index); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material); mesh.receiveShadow = true;
    return { mesh, rim: positions.slice(positions.length - segments * 3), segments };
  }
  function islandRoot(rim, segments, material, depth = 7.5) {
    const layers = 30, positions = [], uvs = [], index = [];
    for (let k = 0; k <= layers; k++) {
      const t = k / layers, taper = Math.pow(1 - t, 1.6) * (1 - t * .05);
      // Strata: the rock steps inward in uneven ledges, with buttresses and gullies around it.
      const ledge = Math.floor(t * 9) / 9, strata = THREE.MathUtils.lerp(t, ledge, .45);
      for (let j = 0; j <= segments; j++) {
        const jj = j % segments, x0 = rim[jj * 3], y0 = rim[jj * 3 + 1], z0 = rim[jj * 3 + 2];
        const a = j / segments * Math.PI * 2, belly = Math.sin(Math.PI * Math.min(1, t * 1.15));
        const crag = 1 + ((fbm(a * 2.4, strata * 4.5) - .45) * .85 + (noise(a * 11, t * 14) - .5) * .22) * belly;
        const shrink = Math.pow(1 - strata, 1.6) * (1 - strata * .05) * .55 + taper * .45;
        const x = x0 * shrink * crag, z = z0 * shrink * crag;
        const y = y0 - t * depth - (fbm(x * .7 + a, z * .7) - .5) * 1.6 * t;
        positions.push(x, y, z); uvs.push(j / segments * 14, y / 3.2);
      }
    }
    const row = segments + 1;
    for (let k = 0; k < layers; k++) for (let j = 0; j < segments; j++) {
      const a = k * row + j, b = a + 1, c = a + row, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(index); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }

  // ----------------------------------------------- buildings: real materials
  // Each building piece keeps its geometry; UVs are re-projected in world units so
  // textures keep their real-world size on boxes of any proportion.
  function projectUVs(mesh, tile) {
    const geometry = mesh.geometry.clone(), position = geometry.attributes.position, normal = geometry.attributes.normal;
    if (!normal) return;
    const scale = mesh.getWorldScale(new THREE.Vector3()), uv = new Float32Array(position.count * 2), n = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i) * scale.x, y = position.getY(i) * scale.y, z = position.getZ(i) * scale.z;
      n.set(normal.getX(i) / scale.x, normal.getY(i) / scale.y, normal.getZ(i) / scale.z);
      const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
      if (ax >= ay && ax >= az) { uv[i * 2] = z / tile; uv[i * 2 + 1] = y / tile; }
      else if (ay >= az) { uv[i * 2] = x / tile; uv[i * 2 + 1] = z / tile; }
      else { uv[i * 2] = x / tile; uv[i * 2 + 1] = y / tile; }
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    mesh.geometry = geometry;
  }
  function remaster(surfaces) {
    const plaster = surface(surfaces.plastered_stone_wall, { tint: '#f4eadb', normalScale: .8 });
    const whitePlaster = surface(surfaces.white_plaster_rough_01, { tint: '#f6efe4' });
    const tiles = surface(surfaces.clay_roof_tiles_02, { normalScale: 1.2 });
    const greenTiles = surface(surfaces.clay_roof_tiles_02, { tint: '#9fb39a', normalScale: 1.2 });
    const stone = surface(surfaces.cliff_side, { tint: '#d8cfc4' });
    const woods = new Map();
    const wood = hex => { if (!woods.has(hex)) woods.set(hex, surface(surfaces.wood_planks, { tint: new THREE.Color('#ffffff').lerp(new THREE.Color(`#${hex}`), .45), roughness: .9 })); return woods.get(hex); };
    const brass = standard({ color: '#c9a45c', metalness: 1, roughness: .32 });
    const copper = standard({ color: '#6f9f92', metalness: .55, roughness: .48 });
    const darkMetal = standard({ color: '#3b3f38', metalness: .7, roughness: .45 });
    const paintedRed = standard({ color: '#9e4c3a', metalness: .25, roughness: .55 });
    const canvas = standard({ color: '#ece2cc', roughness: .95, side: THREE.DoubleSide });
    const leather = standard({ color: '#3f5e4b', roughness: .55 });
    const paper = standard({ color: '#f1e7cf', roughness: .9 });
    // Windows glow warm, as if someone is home at dusk; the glass still mirrors the sky.
    const glass = new THREE.MeshPhysicalMaterial({ color: '#1b2427', metalness: .1, roughness: .04, clearcoat: 1, envMapIntensity: 1.2, emissive: '#ffad55', emissiveIntensity: 1.1 }); ownMaterials.add(glass);
    windowGlass = glass;
    const water = new THREE.MeshPhysicalMaterial({ color: '#1d3d44', metalness: 0, roughness: .04, ior: 1.33, clearcoat: 1, clearcoatRoughness: .03, normalMap: pondNormals, normalScale: new THREE.Vector2(.45, .45), envMapIntensity: 1.4 }); ownMaterials.add(water);
    const generic = new Map();
    const table = {
      f1e4bc: [plaster, 1.6], e5d8b8: [plaster, 1.6], ebdfbc: [whitePlaster, 1.6],
      bd715d: [tiles, 1.1], d38b70: [tiles, 1.1], a6be9b: [greenTiles, 1.1],
      ad8d78: [stone, 1.4], d0b099: [stone, 1.4], a5a389: [stone, .8], afba94: [stone, 1.2], '877d6d': [stone, 1.4],
      dfbf69: [brass], dfb864: [brass], c7aa68: [brass], d0bc8d: [brass], e8c47b: [brass], a5976b: [brass], f0dfb3: [brass],
      '7faaa2': [copper], '799a9a': [glass], '779291': [glass], b37362: [paintedRed], '6a7960': [darkMetal],
      f3e7c7: [canvas], '476b56': [leather], eddfb8: [paper]
    };
    const woodHex = ['7a604d', '9b815b', 'bca379', 'bea98b', 'bdad84', '675a48', '486659', '6a8871', '68866a', 'a7775d', 'b29665', '8d9470', '3b4b3d', 'b3a788'];
    const flowerHex = ['e0a291', 'f4d48c'];
    for (const root of buildings) root.traverse(object => {
      if (!object.isMesh || object.isInstancedMesh || !object.material?.isMeshToonMaterial || object.userData.realism === 'hidden') return;
      const hex = object.material.color.getHexString();
      if (flowerHex.includes(hex) && object.parent?.userData.place === 'projects') { object.visible = false; return; }
      let [material, tile] = table[hex] || [];
      if (!material && woodHex.includes(hex)) [material, tile] = [wood(hex), 1];
      if (!material) {
        if (!generic.has(hex)) generic.set(hex, standard({ color: `#${hex}`, roughness: .82 }));
        material = generic.get(hex);
      }
      if (tile) projectUVs(object, tile);
      object.material = material; object.castShadow = true; object.receiveShadow = true;
    });
    pond.material = water; pond.receiveShadow = true;
    // The footpath becomes old mossy cobbles laid along its length.
    const ribbon = path.geometry, position = ribbon.attributes.position, uv = new Float32Array(position.count * 2);
    let length = 0;
    for (let i = 0; i < position.count; i++) {
      const pair = Math.floor(i / 2);
      if (i % 2 === 0 && pair > 0) length += Math.hypot(position.getX(i) - position.getX(i - 2), position.getZ(i) - position.getZ(i - 2));
      uv[i * 2] = (i % 2) * .76 / 1.3; uv[i * 2 + 1] = length / 1.3;
      position.setY(i, heightAt(position.getX(i), position.getZ(i)) + .025);
    }
    ribbon.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); position.needsUpdate = true; ribbon.computeVertexNormals();
    path.material = surface(surfaces.mossy_cobblestone, { roughness: 1, normalScale: 1.4 }); path.receiveShadow = true;
  }

  // ------------------------------------------------------------- vegetation
  const variantsOf = root => root.children.map(node => {
    const holder = new THREE.Group(), copy = node.clone(); holder.add(copy);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder), center = box.getCenter(new THREE.Vector3());
    copy.position.x -= center.x; copy.position.z -= center.z; copy.position.y -= box.min.y;
    holder.userData.size = box.getSize(new THREE.Vector3());
    holder.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = object.receiveShadow = true;
      const material = object.material;
      if (material.transparent) { material.transparent = false; material.alphaTest = .45; material.depthWrite = true; }
      if (material.alphaTest > 0) material.side = THREE.DoubleSide;
    });
    return holder;
  });
  const random = (() => { let seed = 1979; return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; })();
  const keepOut = [[-2.7, .3, 1.9], [3.5, -1.3, 1.25], [.15, -3.35, 1.45], [4.5, 2.7, .55], [2.95, 2.6, 1.45], [2.9, 3.6, .8], [4.55, 3.7, .8], [-1.1, -.1, .8], [-4.9, 3.5, .8], [-3.7, 4.1, .55], [-.1, 2, .35], [2.4, .1, .35], [1.4, -2.8, .35], [-3.5, 1.6, .35]];
  const pathPoints = [];
  if (path) { const p = path.geometry.attributes.position; for (let i = 0; i < p.count; i += 2) pathPoints.push([(p.getX(i) + p.getX(i + 1)) / 2, (p.getZ(i) + p.getZ(i + 1)) / 2]); }
  const blocked = (x, z, margin = 0) => keepOut.some(([kx, kz, r]) => Math.hypot(x - kx, z - kz) < r + margin)
    || pathPoints.some(([px, pz]) => Math.hypot(x - px, z - pz) < .55 + margin)
    || (z > 2.85 && z < 3.25 && x > -4.3 && x < .3);
  function place(template, x, z, scale, rotation = random() * Math.PI * 2, parent = created) {
    const object = template.clone(); object.position.set(x, heightAt(x, z) - .02, z); object.rotation.y = rotation; object.scale.setScalar(scale);
    parent.add(object); return object;
  }
  function scatter(count, minRadius, maxRadius, margin, accept = () => true) {
    const points = [];
    for (let tries = 0; points.length < count && tries < count * 40; tries++) {
      const a = random() * Math.PI * 2, r = minRadius + Math.sqrt(random()) * (maxRadius - minRadius);
      const x = Math.cos(a) * r * RX, z = Math.sin(a) * r * RZ;
      if (!blocked(x, z, margin) && accept(x, z)) points.push([x, z]);
    }
    return points;
  }
  // Small plants are instanced: one draw call per variant primitive however many grow.
  function instanced(templates, points, scaleRange) {
    const groups = templates.map(() => []);
    points.forEach(point => groups[Math.floor(random() * templates.length)].push(point));
    const matrix = new THREE.Matrix4(), placement = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    templates.forEach((template, t) => {
      const spots = groups[t]; if (!spots.length) return;
      template.updateMatrixWorld(true);
      template.traverse(node => {
        if (!node.isMesh) return;
        const batch = new THREE.InstancedMesh(node.geometry, node.material, spots.length);
        spots.forEach(([x, z], i) => {
          const size = THREE.MathUtils.lerp(scaleRange[0], scaleRange[1], random());
          placement.compose(p.set(x, heightAt(x, z) - .015, z), q.setFromAxisAngle(up, random() * Math.PI * 2), s.setScalar(size));
          batch.setMatrixAt(i, matrix.multiplyMatrices(placement, node.matrixWorld));
        });
        batch.castShadow = false; batch.receiveShadow = true; batch.userData.fullCount = spots.length; created.add(batch);
      });
    });
  }

  // ------------------------------------------------- dreamlike, but real
  // The pond pours upward. A column of water rises out of it, its surface rippling as it
  // flows, and thins until it breaks into droplets that keep falling up into the sky.
  // Ripples come from a tileable normal map built here from layered waves.
  const rippleTexture = (() => {
    const size = 256, data = new Uint8Array(size * size * 4), waves = [];
    for (let i = 0; i < 9; i++) waves.push([1 + Math.floor(random() * 6), Math.floor(random() * 9) - 4, random() * 6.28, .4 + random() * .6]);
    const height = (x, y) => waves.reduce((sum, [kx, ky, phase, amp]) => sum + Math.sin((kx * x + ky * y) * Math.PI * 2 / size + phase) * amp, 0);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = height(x + 1, y) - height(x - 1, y), dy = height(x, y + 1) - height(x, y - 1);
      const n = new THREE.Vector3(-dx * 3, -dy * 3, 1).normalize(), i = (y * size + x) * 4;
      data[i] = (n.x * .5 + .5) * 255; data[i + 1] = (n.y * .5 + .5) * 255; data[i + 2] = (n.z * .5 + .5) * 255; data[i + 3] = 255;
    }
    const texture = new THREE.DataTexture(data, size, size);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true; texture.needsUpdate = true; ownTextures.add(texture);
    return texture;
  })();
  const flowNormals = rippleTexture.clone(); flowNormals.repeat.set(9, 2); flowNormals.needsUpdate = true; ownTextures.add(flowNormals);
  const pondNormals = rippleTexture.clone(); pondNormals.repeat.set(3, 2); pondNormals.needsUpdate = true; ownTextures.add(pondNormals);

  const columnCurve = new THREE.CatmullRomCurve3([[2.95, .5, 2.6], [2.97, 1.5, 2.63], [2.86, 2.9, 2.52], [3.08, 4.4, 2.68], [2.92, 5.9, 2.56], [3.04, 7.3, 2.64]].map(point => new THREE.Vector3(...point)));
  const columnGeometry = new THREE.TubeGeometry(columnCurve, 160, 1, 28, false);
  {
    // Taper the tube: a wide foot where it leaves the pond, thinning toward the top.
    const position = columnGeometry.attributes.position, center = new THREE.Vector3(), vertex = new THREE.Vector3();
    for (let i = 0; i <= 160; i++) {
      const u = i / 160, radius = THREE.MathUtils.lerp(.62, .27, THREE.MathUtils.smoothstep(u, 0, .07)) * (1 - u * .62) * (1 + Math.sin(u * 23) * .05);
      columnCurve.getPointAt(u, center);
      for (let j = 0; j <= 28; j++) {
        const k = i * 29 + j;
        vertex.fromBufferAttribute(position, k).sub(center).multiplyScalar(radius).add(center);
        position.setXYZ(k, vertex.x, vertex.y, vertex.z);
      }
    }
    columnGeometry.computeVertexNormals();
  }
  const flowTime = { value: 0 };
  // Water is nearly clear where you look straight through it and mirror-like at grazing
  // angles, so its opacity follows a Fresnel term instead of a flat value.
  const fresnelWater = (shader, clear, edge) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      float facing = abs(dot(normalize(normal), normalize(vViewPosition)));
      diffuseColor.a = mix(${edge.toFixed(2)}, ${clear.toFixed(2)}, pow(facing, .7));
      #include <opaque_fragment>`);
  };
  const columnMaterial = new THREE.MeshPhysicalMaterial({
    color: '#3f6b73', roughness: .03, metalness: 0, ior: 1.33, transparent: true, opacity: 1, depthWrite: false,
    clearcoat: 1, clearcoatRoughness: .04, normalMap: flowNormals, normalScale: new THREE.Vector2(1.1, 1.1), envMapIntensity: 1.8, specularIntensity: 1
  });
  // Pulses travel up the column, the way a real stream of water swells and narrows.
  columnMaterial.onBeforeCompile = shader => {
    shader.uniforms.uFlow = flowTime;
    shader.vertexShader = 'uniform float uFlow;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed += objectNormal * (sin(uv.x * 46. - uFlow * 5.5) * .035 + sin(uv.x * 17. + uv.y * 6.2832 - uFlow * 3.1) * .02) * (1. - uv.x * .5);`);
    fresnelWater(shader, .1, .82);
  };
  columnMaterial.customProgramCacheKey = () => 'rising-water-v2';
  ownMaterials.add(columnMaterial);
  const column = new THREE.Mesh(columnGeometry, columnMaterial); column.renderOrder = 2; created.add(column);

  const dropletMaterial = new THREE.MeshPhysicalMaterial({ color: '#4d7a82', roughness: .02, metalness: 0, ior: 1.33, transparent: true, opacity: 1, clearcoat: 1, envMapIntensity: 2.4, depthWrite: false });
  dropletMaterial.onBeforeCompile = shader => fresnelWater(shader, .18, .9);
  dropletMaterial.customProgramCacheKey = () => 'water-droplet-v1';
  ownMaterials.add(dropletMaterial);
  const dropletCount = 150;
  const droplets = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), dropletMaterial, dropletCount);
  droplets.instanceMatrix.setUsage(THREE.DynamicDrawUsage); droplets.renderOrder = 3; droplets.frustumCulled = false; created.add(droplets);
  const dropletSeeds = Array.from({ length: dropletCount }, (_, i) => ({
    start: i < dropletCount * .7 ? .88 + random() * .12 : .3 + random() * .6, // most break off the top, some shed from the sides
    speed: .05 + random() * .05, offset: random(), angle: random() * Math.PI * 2, spin: (random() - .5) * 3,
    spread: .6 + random() * 1.9, rise: 3 + random() * 5, size: .02 + random() * .035
  }));
  const dropletMatrix = new THREE.Matrix4(), dropletPosition = new THREE.Vector3(), dropletScale = new THREE.Vector3(), dropletQuaternion = new THREE.Quaternion(), stretch = new THREE.Vector3(0, 1, 0);
  const islets = [];
  let kit = null; // what the island-hop game builds its stepping stones from

  // The sky: a physically based atmosphere (see atmosphere.js) with the sun's disc,
  // stars at magic hour, and a sea of cloud tops far below the island.
  const atmosphere = createAtmosphere(renderer);
  const skyUniforms = { uSkyLUT: { value: atmosphere.texture }, uSunDir: { value: new THREE.Vector3(0, .2, 1) }, uSunColor: { value: new THREE.Vector3(10, 8, 5) }, uTime: { value: 0 }, uNight: magic };
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(140, 64, 32), new THREE.ShaderMaterial({
    uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, depthTest: false,
    vertexShader: `varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }`,
    fragmentShader: SKY_GLSL + `varying vec3 vDir;
      void main() {
        gl_FragColor = vec4(skyColor(normalize(vDir)), 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  skyDome.renderOrder = -100; skyDome.frustumCulled = false; floating.add(skyDome); ownMaterials.add(skyDome.material);

  // ------------------------------------------------------------------ magic
  // Fireflies drift low among the plants and blink; golden motes float through the air.
  // Both are drawn in HDR so the bloom pass turns them into soft points of light.
  function drifting(count, place, { size, color, blink, wander, rise }) {
    const geometry = new THREE.BufferGeometry(), base = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) { const [x, y, z] = place(); base.set([x, y, z], i * 3); seed[i] = random(); }
    geometry.setAttribute('position', new THREE.BufferAttribute(base, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uMagic: magic },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uTime, uScale, uMagic; attribute float aSeed; varying float vGlow;
        void main() {
          float s = aSeed * 43.7, t = uTime;
          float lift = fract(t * ${(rise / 3).toFixed(4)} + aSeed);
          vec3 p = position + vec3(sin(t * .31 + s) * ${wander.toFixed(2)}, lift * 3. + sin(t * .53 + s * 1.7) * .25, cos(t * .27 + s * 2.3) * ${wander.toFixed(2)});
          float pulse = ${blink ? 'pow(max(0., sin(t * (.7 + aSeed * .9) + s)), 5.)' : '.55 + .45 * sin(t * (1.3 + aSeed) + s)'};
          vGlow = pulse * (${blink ? '.55 + uMagic * 1.1' : '.5 + uMagic * .5'}) * smoothstep(0., .1, lift) * (1. - smoothstep(.85, 1., lift));
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          gl_PointSize = uScale * ${size.toFixed(1)} * (.6 + aSeed * .8) * (24. / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vGlow;
        void main() { float d = length(gl_PointCoord - .5); if (d > .5) discard; float core = exp(-d * d * 28.);
          gl_FragColor = vec4(vec3(${color.map(c => c.toFixed(2)).join(', ')}) * core * vGlow * 4., core * vGlow); }`
    });
    const points = new THREE.Points(geometry, material); points.frustumCulled = false; points.renderOrder = 4; created.add(points);
    return material;
  }
  const fireflies = drifting(lite ? 70 : 150, () => {
    const a = random() * Math.PI * 2, r = Math.sqrt(random()) * .92;
    const x = Math.cos(a) * r * RX, z = Math.sin(a) * r * RZ;
    return [x, heightAt(x, z) + .3 + random() * 1.6, z];
  }, { size: 5, color: [1, .8, .32], blink: true, wander: .7, rise: .02 });
  const motes = drifting(lite ? 120 : 320, () => {
    const a = random() * Math.PI * 2, r = Math.sqrt(random()) * 1.15;
    return [Math.cos(a) * r * RX, .5 + random() * 6.5, Math.sin(a) * r * RZ];
  }, { size: 1.8, color: [1, .9, .72], blink: false, wander: 1.4, rise: .05 });

  // Lanterns throw a warm pool of light on the ground beneath them.
  const pools = [];
  function lightLanterns() {
    lanternGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc778').multiplyScalar(5) }); ownMaterials.add(lanternGlow);
    const poolMaterial = new THREE.ShaderMaterial({
      uniforms: { uMagic: magic, uFlicker: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      polygonOffset: true, polygonOffsetFactor: -2,
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `uniform float uMagic, uFlicker; varying vec2 vUv;
        void main() { float d = length(vUv - .5) * 2.; float glow = pow(max(0., 1. - d), 2.2); gl_FragColor = vec4(vec3(1., .66, .3) * glow * (.32 + uMagic * .55) * uFlicker, glow); }`
    });
    ownMaterials.add(poolMaterial);
    world.children.forEach(object => {
      if (!object.isMesh || !object.material?.isMeshBasicMaterial || object.material.color.getHexString() !== 'ffe3a0') return;
      object.material = lanternGlow;
      const pool = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40), poolMaterial);
      pool.rotation.x = -Math.PI / 2; pool.position.set(object.position.x, heightAt(object.position.x, object.position.z) + .05, object.position.z);
      created.add(pool); pools.push(pool);
    });
    return poolMaterial;
  }
  let poolMaterial = null;

  // Bloom: a soft glow around lanterns, lit windows, fireflies and bright highlights.
  let composer = null, renderPass = null, bloom = null, grade = null;
  function dropComposer() {
    composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); composer.dispose();
    composer = null; composerSize.set(-1, -1);
  }
  const composerSize = new THREE.Vector2(-1, -1), drawSize = new THREE.Vector2();
  function ensureComposer(camera) {
    if (!composer) {
      // Multisampling a half-float target is costly on integrated GPUs, so only Sharp uses it.
      const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: settings.msaa });
      composer = new EffectComposer(renderer, target);
      renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
      bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .5, .55, 1.6); composer.addPass(bloom);
      composer.addPass(new OutputPass());
      // The film grade, after tone mapping: a gentle S-curve, cool shadows and warm
      // highlights, a vignette, fine grain and a faint lens fringe toward the corners.
      grade = new ShaderPass({
        uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 1 } },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
        fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uAmount; varying vec2 vUv;
          float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
          void main() {
            vec2 c = vUv - .5; float r2 = dot(c, c);
            vec3 col = vec3(texture2D(tDiffuse, vUv + c * r2 * .012).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - c * r2 * .012).b);
            float l = dot(col, vec3(.2126, .7152, .0722));
            col = mix(col, col * col * (3. - 2. * col), .22 * uAmount);
            col += mix(vec3(-.012, .004, .03), vec3(.035, .012, -.025), smoothstep(.15, .75, l)) * uAmount;
            col *= 1. - r2 * .7 * uAmount;
            col += (hash(vUv * 1931. + fract(uTime * 7.) * 113.) - .5) * .035 * uAmount;
            gl_FragColor = vec4(col, 1.);
          }`
      });
      composer.addPass(grade);
    }
  }
  function render(camera) {
    if (!loaded || !settings.bloom) return false;
    ensureComposer(camera);
    renderer.getSize(drawSize);
    const ratio = renderer.getPixelRatio();
    if (drawSize.x !== composerSize.x || drawSize.y !== composerSize.y || ratio !== composer._pixelRatio) {
      composer.setPixelRatio(ratio); composer.setSize(drawSize.x, drawSize.y); composerSize.copy(drawSize);
    }
    renderPass.camera = camera;
    bloom.strength = .42 + magic.value * .38;
    grade.uniforms.uTime.value = performance.now() / 1000;
    composer.render();
    return true;
  }

  // ------------------------------------------------------------------ light
  // Golden hour by day; at magic hour the sun touches the horizon. Its azimuth puts the
  // light on the viewer's right so it rakes across the island in the opening view.
  const SUN_AZIMUTH = Math.atan2(.25, 1);
  let skyElevation = null, hazeColor = new THREE.Color('#9aa6c4'), envTarget = null, lastSkyUpdate = -1;
  const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(skyDome.geometry, skyDome.material));
  function computeSky(elevation) {
    if (skyElevation !== null && Math.abs(elevation - skyElevation) < .004) return;
    skyElevation = elevation;
    sunDirection.set(Math.cos(elevation) * Math.cos(SUN_AZIMUTH), Math.sin(elevation), Math.cos(elevation) * Math.sin(SUN_AZIMUTH));
    const light = atmosphere.sunlight(elevation);
    skyUniforms.uSunDir.value.copy(sunDirection); skyUniforms.uSunColor.value.set(light.r, light.g, light.b);
    hazeColor = atmosphere.update(sunDirection);
    const peak = Math.max(light.r, light.g, light.b, 1e-4);
    sunColor.setRGB(light.r / peak, light.g / peak, light.b / peak);
    sunStrength = Math.min(3.6, (light.r * .3 + light.g * .6 + light.b * .1) * .32);
    // Reflections and ambient light come from the same sky, so everything agrees.
    const next = pmrem.fromScene(envScene, 0, .1, 300);
    envTarget?.dispose(); envTarget = next; sky = next.texture;
    if (loaded) applyLighting();
  }
  let sunStrength = 3.2;
  const skyRotation = new THREE.Euler();
  function applyLighting() {
    if (!loaded) return;
    if (outdoors) {
      scene.background = null; scene.environment = sky; scene.environmentRotation.copy(skyRotation);
      scene.environmentIntensity = 1;
      // Aerial perspective: distance fades into the colour of the air at the horizon.
      scene.fog = new THREE.FogExp2(hazeColor, .0035);
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
      hemisphere.intensity = .1;
      sun.position.copy(sunDirection).multiplyScalar(30); sun.color.copy(sunColor); sun.intensity = sunStrength;
      Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 70 }); sun.shadow.camera.updateProjectionMatrix();
      if (sun.shadow.mapSize.x !== 2048) { sun.shadow.mapSize.set(2048, 2048); sun.shadow.map?.dispose(); sun.shadow.map = null; }
      sun.shadow.normalBias = .03;
      sun.castShadow = true;
    } else {
      // Indoors: the dusk sky gives soft reflections and the rooms' own lamps and
      // window light do the rest. The garden's sun is switched off.
      scene.fog = null;
      scene.background = room === 'skills' ? sky : null; scene.backgroundRotation.copy(skyRotation); scene.environment = sky; scene.environmentRotation.copy(skyRotation);
      scene.environmentIntensity = room === 'skills' ? .85 : .42;
      renderer.shadowMap.autoUpdate = true;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
      hemisphere.intensity = room === 'skills' ? .5 : .35;
      sun.intensity = 0; sun.castShadow = false;
    }
  }

  const alphaIds = Object.keys(ALPHA);
  const ready = Promise.all([Promise.all(MODELS.map(loadModel)), Promise.all(SURFACES.map(loadSurface)), Promise.all(alphaIds.map(loadAlpha))]).then(([modelList, surfaceList, alphaList]) => {
    if (disposed) return false;
    computeSky(.2);
    alphaIds.forEach((id, i) => modelList[MODELS.indexOf(id)].traverse(object => {
      if (!object.isMesh || (ALPHA[id] && !ALPHA[id].test(object.material.name))) return;
      Object.assign(object.material, { alphaMap: alphaList[i], alphaTest: .5, transparent: false, depthWrite: true, side: THREE.DoubleSide, vertexColors: false });
      object.material.needsUpdate = true;
    }));
    const models = Object.fromEntries(MODELS.map((id, i) => [id, variantsOf(modelList[i])]));
    const surfaces = Object.fromEntries(SURFACES.map((id, i) => [id, surfaceList[i]]));

    hide.forEach(object => object.traverse(child => { child.userData.realism = 'hidden'; }));
    const top = islandTop(surface(surfaces.aerial_grass_rock, { tint: '#e9f0dc', normalScale: 1.2 }));
    created.add(top.mesh);
    created.add(islandRoot(top.rim, top.segments, surface(surfaces.cliff_side, { tint: '#a39d95', normalScale: 1.6 })));
    remaster(surfaces);
    poolMaterial = lightLanterns();
    const weave = createWeave(); ownTextures.add(weave);
    roomKit = { surfaces, models, standard, weave, random, own: material => { ownMaterials.add(material); return material; } };

    // Trees stand where the old ones did; a broad searsia becomes the wishing tree.
    const [islandTree] = models.island_tree_02, searsia = models.searsia_lucida, pines = models.pine_sapling_small;
    // Budget: the hero tree is ~150k triangles, so it grows twice (once on small screens).
    for (const [x, z, s, r] of (lite ? [[-5.1, -1.4, 1.25, .4]] : [[-5.1, -1.4, 1.25, .4], [5.2, .7, 1, 2.2]])) place(islandTree, x, z, s, r);
    if (lite) place(searsia[3], 5.2, .7, 1.3, 2.2);
    place(searsia[4], 1.6, 3.7, 1.15, 4.1);
    place(searsia[0], -1.15, -1.75, 1.45, .3);
    [[-3.6, -3.2, 1.9], [2.2, -4.3, 1.6], [-5.3, 1.9, 1.5], [-6.3, -.2, 1.25], [5.9, -2.4, 1.4]].forEach(([x, z, s], i) => place(pines[i % pines.length], x, z, s));
    [[-.2, -5.2, .9], [4.8, -3.6, .8], [-4.6, -3.8, .85], [6.4, 2.2, .7]].forEach(([x, z, s], i) => place(searsia[1 + i % (searsia.length - 1)], x, z, s));
    // Shrubs and ferns gather around the buildings, rocks along the rim.
    scatter(16, .25, .9, .35).forEach(([x, z], i) => place(models.shrub_02[i % models.shrub_02.length], x, z, .45 + random() * .3));
    scatter(14, .2, .88, .25).forEach(([x, z], i) => place([...models.shrub_03, ...models.shrub_04][i % 5], x, z, 1.4 + random() * .8));
    scatter(18, .3, .9, .2).forEach(([x, z], i) => place(models.fern_02[i % models.fern_02.length], x, z, 1.1 + random() * .6));
    scatter(9, .86, .97, .2).forEach(([x, z], i) => place(models.rock_moss_set_01[i % models.rock_moss_set_01.length], x, z, .35 + random() * .35));
    [[3.9, 3.35, .55], [-6.4, 1.1, .7], [1.2, 5.3, .6], [-2.9, -5.1, .75]].forEach(([x, z, s]) => place(models.boulder_01[0], x, z, s));
    const light = templates => templates.filter(template => { let triangles = 0; template.traverse(node => { if (node.isMesh) triangles += node.geometry.index ? node.geometry.index.count / 3 : 0; }); return triangles < 1400; });
    instanced(models.grass_bermuda_01.filter((_, i) => i > 2), scatter(lite ? 450 : 1000, 0, .97, 0), [2.2, 3.4]);
    instanced(models.moss_01, scatter(lite ? 60 : 140, .55, .97, 0), [2.5, 4]);
    instanced(light([...models.flower_gazania, ...models.flower_ursinia, ...models.flower_empodium]), scatter(lite ? 70 : 170, .15, .93, .05), [1.4, 2]);
    instanced(light(models.dandelion_01), scatter(lite ? 20 : 45, .3, .95, .05), [1.6, 2.2]);

    // A small upside-down island drifts above the garden, a pine hanging from it.
    const isletTop = (() => { const g = new THREE.Group(); const t = islandTop(top.mesh.material); t.mesh.scale.set(.2, .35, .2); g.add(t.mesh); const root = islandRoot(top.rim, top.segments, created.children[1].material, 7.5); root.scale.set(.2, .35, .2); g.add(root); return g; })();
    const inverted = new THREE.Group(); inverted.add(isletTop); place(pines[1], 0, 0, 1.3, .5, inverted); inverted.children[1].position.y = .2;
    inverted.position.set(-9.5, 9, -6); inverted.rotation.set(Math.PI, .4, .12); floating.add(inverted);
    islets.push({ group: inverted, y: 9, phase: 0 });
    const upright = new THREE.Group(); const smallTop = isletTop.clone(); upright.add(smallTop); place(searsia[2], 0, 0, .9, 1.2, upright); upright.children[1].position.y = .2;
    upright.position.set(10.5, -3.6, -6.5); upright.scale.setScalar(1.2); floating.add(upright);
    islets.push({ group: upright, y: -3.6, phase: 2.1 });
    kit = { isletTop, upright, inverted, floating };

    hide.forEach(object => { object.visible = false; });
    created.visible = floating.visible = true; loaded = true; applyLighting(); applyQuality();
    pendingRooms.splice(0).forEach(([target, kind]) => enchantRoom(target, kind));
    return true;
  });

  // Compile the island's shaders in the background, for the buffer they will really be
  // drawn into (the bloom pipeline renders to a linear half-float target, which needs
  // different shader variants from the screen).
  async function warm(camera) {
    if (!loaded) return;
    const previous = renderer.getRenderTarget();
    if (settings.bloom) { ensureComposer(camera); renderer.setRenderTarget(composer.renderTarget1); }
    const compiling = renderer.compileAsync(scene, camera);
    renderer.setRenderTarget(previous);
    await compiling;
    // Upload textures a few at a time between frames; all at once, the first frame stalls.
    const textures = new Set();
    scene.traverse(object => {
      if (!object.material) return;
      for (const material of [object.material].flat()) for (const value of Object.values(material)) if (value?.isTexture && value.image) textures.add(value);
    });
    let budget = performance.now() + 12;
    for (const texture of textures) {
      if (disposed) return;
      renderer.initTexture(texture);
      // Yield a frame between batches (a timer too, since background tabs pause frames).
      if (performance.now() > budget) { await new Promise(resolve => { requestAnimationFrame(resolve); setTimeout(resolve, 50); }); budget = performance.now() + 12; }
    }
  }

  return {
    ready,
    warm,
    heightAt,
    get kit() { return kit; },
    get loaded() { return loaded; },
    setOutdoors(value, kind = null) { outdoors = value; room = value ? null : kind; applyLighting(); },
    enchantRoom,
    setQuality(value) { if (!QUALITY[value] || value === quality) return; quality = value; if (loaded) applyQuality(); else settings = QUALITY[value]; },
    update(time, camera, evening = 0) {
      if (!loaded) return;
      if (outdoors) {
        adaptResolution();
        // The sun never moves, so the shadow map only needs refreshing every few frames.
        renderer.shadowMap.autoUpdate = false;
        if (frame++ % 3 === 0) renderer.shadowMap.needsUpdate = true;
      }
      renderer.toneMappingExposure = outdoors ? 1.3 - evening * .3 : 1.2;
      skyDome.position.copy(camera.position); skyDome.material.uniforms.uTime.value = time;
      magic.value = evening;
      // Magic hour lowers the sun to the horizon; the sky is re-rendered as it moves.
      const wantedElevation = .2 - evening * .17;
      if (Math.abs(wantedElevation - skyElevation) > .004 && time - lastSkyUpdate > .25) { lastSkyUpdate = time; computeSky(wantedElevation); }
      const pointScale = renderer.domElement.height / 800;
      for (const material of [fireflies, motes]) { material.uniforms.uTime.value = time; material.uniforms.uScale.value = pointScale; }
      const flicker = .92 + Math.sin(time * 7.3) * .03 + Math.sin(time * 13.1) * .025;
      if (poolMaterial) poolMaterial.uniforms.uFlicker.value = flicker;
      if (lanternGlow) lanternGlow.color.set('#ffc778').multiplyScalar((4 + evening * 3) * flicker);
      if (windowGlass) windowGlass.emissiveIntensity = (1.1 + evening * 2.2) * (.97 + Math.sin(time * 2.1) * .03);
      // Water flows up the column; the pond surface drifts more slowly.
      flowTime.value = time; flowNormals.offset.set(-time * .32, time * .05); pondNormals.offset.set(time * .015, time * .01);
      dropletSeeds.forEach((drop, i) => {
        const t = (drop.offset + time * drop.speed) % 1, side = drop.start < .88 ? .35 : 1;
        columnCurve.getPointAt(drop.start, dropletPosition);
        const a = drop.angle + drop.spin * t, out = drop.spread * side * Math.pow(t, 1.2);
        dropletPosition.x += Math.cos(a) * (out + .12); dropletPosition.z += Math.sin(a) * (out + .12);
        dropletPosition.y += drop.rise * Math.pow(t, 1.6) * side + t * .4;
        const size = drop.size * Math.min(1, t * 14) * (1 - THREE.MathUtils.smoothstep(t, .65, 1)) + .0001;
        dropletScale.set(size, size * (1.25 + (1 - t) * .5), size); // stretched along their upward fall
        droplets.setMatrixAt(i, dropletMatrix.compose(dropletPosition, dropletQuaternion.setFromAxisAngle(stretch, a), dropletScale));
      });
      droplets.instanceMatrix.needsUpdate = true;
      islets.forEach(({ group, y, phase }) => { group.position.y = y + Math.sin(time * .4 + phase) * .35; });
    },
    render,
    dispose() {
      if (composer) dropComposer();
      disposed = true;
      ownMaterials.forEach(material => { material.normalMap?.dispose(); material.roughnessMap?.dispose(); material.dispose(); });
      ownTextures.forEach(texture => texture.dispose());
      envTarget?.dispose(); pmrem.dispose(); atmosphere.dispose();
    }
  };
}
