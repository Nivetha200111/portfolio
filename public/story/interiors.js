import * as THREE from './vendor/three.module.js';
import { CSS3DObject, CSS3DSprite } from './vendor/CSS3DRenderer.js';

// Actual rooms, furniture and computer screens. Their DOM surfaces live in 3D.
export function createInterior(kind, { material, projectCount = 7, onExit, onStation }) {
  const group = new THREE.Group();
  group.visible = false;
  const pickable = [], screens = [], moving = [], colliders = [];
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const sphereGeometry = new THREE.SphereGeometry(1, 16, 10);
  const box = (color, x, y, z, sx, sy, sz, parent = group) => {
    const object = new THREE.Mesh(boxGeometry, material(color));
    object.position.set(x, y, z); object.scale.set(sx, sy, sz);
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  };
  const ball = (color, x, y, z, sx, sy, sz, parent = group) => {
    const object = new THREE.Mesh(sphereGeometry, material(color));
    object.position.set(x, y, z); object.scale.set(sx, sy, sz); object.castShadow = true; parent.add(object); return object;
  };
  const cylinder = (color, x, y, z, radius, height, parent = group) => {
    const object = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), material(color));
    object.position.set(x, y, z); object.castShadow = true; parent.add(object); return object;
  };
  function plaque(text, x, y, z, width = 4, angle = 0) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#6c7655'; ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = '#c7b88c'; ctx.lineWidth = 10; ctx.strokeRect(18, 18, 988, 220);
    ctx.fillStyle = '#fff2cf'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '52px Georgia'; ctx.fillText(text, 512, 128, 930);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
    sign.position.set(x, y, z); sign.rotation.y = angle; group.add(sign); return sign;
  }
  function plant(x, z, size = 1) {
    const pot = cylinder('#bd8568', x, .32, z, .3 * size, .5 * size);
    cylinder('#5d7650', x, .8 * size, z, .045 * size, .8 * size);
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.4;
      const leaf = ball(i % 2 ? '#8baf70' : '#6c945e', x + Math.sin(angle) * .28 * size, (.8 + i * .09) * size, z + Math.cos(angle) * .25 * size, .3 * size, .15 * size, .2 * size);
      leaf.rotation.z = Math.sin(angle) * .4; moving.push({ object: leaf, kind: 'leaf', phase: i + x });
    }
    return pot;
  }

  // Floor boards, exposed beams, warm plaster, and a green door to the outside.
  const floor = box('#aa805a', 0, -.16, 0, 16, .3, 14);
  floor.userData.walk = true; pickable.push(floor);
  for (let i = 0; i < 27; i++) {
    const plank = box(i % 3 ? '#bb986c' : '#c9a778', -7.7 + i * .59, .005, 0, .55, .035, 14);
    plank.userData.walk = true; pickable.push(plank);
    for (const z of [-5.3, 0, 5.3]) box('#786b4c', -7.7 + i * .59, .03, z, .035, .009, .035);
  }
  const wallColor = kind === 'skills' ? '#d5e0c0' : kind === 'certifications' ? '#bacdc7' : '#eee1bc';
  box(wallColor, -8, 3.1, 0, .25, 6.2, 14);
  box(wallColor, 8, 3.1, 0, .25, 6.2, 14);
  box(wallColor, 0, 3.1, -7, 16, 6.2, .25);
  box(wallColor, -5, 3.1, 7, 6, 6.2, .25); box(wallColor, 5, 3.1, 7, 6, 6.2, .25);
  box(wallColor, 0, 5.1, 7, 4, 2.2, .25);
  for (const x of [-7.7, 0, 7.7]) box('#776448', x, 6.1, 0, .22, .35, 14);
  for (const z of [-6.7, 0, 6.7]) box('#776448', 0, 6.1, z, 16, .32, .23);
  for (const x of [-7.8, 7.8]) for (const z of [-6.8, 6.8]) box('#88704e', x, 3, z, .3, 6, .3);
  box('#768767', 0, 1.8, 6.95, 2.1, 3.6, .2).userData.exit = true;
  const door = box('#526d56', 0, 1.7, 6.8, 1.7, 3.2, .08); door.userData.exit = true; pickable.push(door);
  ball('#c7ad65', -.65, 1.7, 6.7, .08, .08, .06);
  const exitButton = document.createElement('button'); exitButton.className = 'room-exit'; exitButton.textContent = '← Back to the garden'; exitButton.addEventListener('click', onExit);
  const exitSign = new CSS3DSprite(exitButton); exitSign.position.set(0, 4.3, 6.8); exitSign.scale.setScalar(.012); group.add(exitSign);
  plaque('Drag to look · WASD to walk · Tap the floor to move', 0, 5.6, -6.7, 7);

  // An open window with a painted sky, timber mullions, drapes and a sill.
  box('#8db2a6', -7.82, 3.3, -1.6, .03, 3.4, 4.8);
  for (const z of [-4, -1.6, .8]) box('#88704e', -7.7, 3.3, z, .18, 3.8, .16);
  for (const y of [1.45, 3.3, 5.2]) box('#88704e', -7.7, y, -1.6, .2, .17, 5);
  box('#ccbc92', -7.5, 1.5, -1.6, .7, .2, 5.2);
  for (const z of [-4.2, 1]) {
    const curtain = box('#e8d5ad', -7.5, 3.4, z, .3, 3.8, .55);
    moving.push({ object: curtain, kind: 'curtain', phase: z });
  }
  const sunbeam = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ color: '#ffe6a1', transparent: true, opacity: .12, depthWrite: false, side: THREE.DoubleSide }));
  sunbeam.position.set(-4.6, .06, -1.8); sunbeam.rotation.x = -Math.PI / 2; sunbeam.rotation.z = .3; group.add(sunbeam);
  for (const [x, z] of [[-4, 0], [4, 0]]) {
    cylinder('#716349', x, 5.7, z, .025, .8);
    const lantern = ball('#f1d496', x, 5.1, z, .5, .62, .5); moving.push({ object: lantern, kind: 'lantern', phase: x });
    const light = new THREE.PointLight('#ffdaa2', 2.5, 11, 2); light.position.set(x, 4.8, z); group.add(light);
  }
  plant(-6.8, 4.9, 1.5); plant(6.8, 4.9, 1.3);

  function shelf(x, z, angle = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = angle; group.add(g);
    for (const xx of [-1.5, 1.5]) box('#8c704e', xx, 2, 0, .12, 4, .6, g);
    for (const y of [.3, 1.5, 2.7, 3.9]) {
      box('#b29262', 0, y, 0, 3.2, .13, .7, g);
      for (let i = 0; i < 9; i++) {
        const book = box(['#7a9a7a', '#ac7560', '#b4a575', '#729295'][i % 4], -1.2 + i * .28, y + .37, 0, .19, .55 + (i % 3) * .1, .4, g);
        book.rotation.z = i % 5 === 0 ? .15 : 0;
      }
    }
  }

  function station(index, x, z, angle = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = angle; g.userData.station = index; group.add(g); pickable.push(g);
    box('#bc9769', 0, 1.35, 0, 3.5, .17, 1.65, g);
    for (const xx of [-1.5, 1.5]) for (const zz of [-.65, .65]) box('#806546', xx, .65, zz, .13, 1.3, .13, g);
    box('#586b59', 0, 2.55, -.25, 2.72, 1.86, .19, g);
    box('#b8c6a1', 0, 1.69, -.3, .13, .5, .15, g);
    box('#667b61', 0, 1.47, -.15, .65, .07, .45, g);
    box('#d0c5a1', 0, 1.48, .57, 1.15, .08, .4, g);
    for (let row = 0; row < 3; row++) for (let key = 0; key < 10; key++) box('#8c957c', -.48 + key * .105, 1.53, .45 + row * .09, .07, .025, .055, g);
    cylinder('#ddbd89', 1.2, 1.63, .3, .14, .3, g); // tea, of course
    const saucer = cylinder('#d9ccaa', 1.2, 1.45, .3, .23, .025, g);
    box('#c4b790', -1.2, 1.46, .1, .47, .045, .65, g).rotation.y = -.25;
    // A little chair you can walk around.
    box('#879a70', 0, .62, 1.65, .85, .13, .8, g);
    box('#879a70', 0, 1.12, 1.99, .85, .95, .1, g);
    for (const xx of [-.34, .34]) for (const zz of [1.3, 1.98]) box('#806546', xx, .3, zz, .07, .6, .07, g);
    const element = document.createElement('div'); element.className = 'workshop-screen';
    const screen = new CSS3DObject(element); screen.position.set(0, 2.55, -.14); screen.scale.setScalar(.00325); g.add(screen);
    const normal = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const point = new THREE.Vector3(x, 2.55, z).addScaledVector(normal, -.14);
    screens.push({ element, object: screen, point, normal, index });
    colliders.push({ x, z, width: angle === 0 ? 1.9 : 1, depth: angle === 0 ? 1 : 1.9 });
  }

  if (kind === 'projects') {
    plaque('Nivetha’s little workshop', 0, 4.65, -6.65, 5.5);
    const positions = [[-4.8, -4.7, 0], [0, -4.7, 0], [4.8, -4.7, 0], [-6.1, -.2, Math.PI / 2], [6.1, -.2, -Math.PI / 2], [-6.1, 3.9, Math.PI / 2], [6.1, 3.9, -Math.PI / 2]];
    for (let i = 0; i < Math.min(projectCount, positions.length); i++) station(i, ...positions[i]);
    shelf(-4.8, -6.3); shelf(4.8, -6.3);
    // A central shared making table, sketches, tools, and a glowing lamp.
    box('#bb9464', 0, 1, .8, 3.8, .16, 2);
    colliders.push({ x: 0, z: .8, width: 2.1, depth: 1.2 });
    for (const x of [-1.5, 1.5]) for (const z of [0, 1.6]) box('#826747', x, .5, z, .13, 1, .13);
    box('#ede1bc', -.5, 1.11, .7, .9, .02, 1.2).rotation.y = .22;
    box('#698366', .9, 1.14, .8, .65, .14, .9).rotation.y = -.12;
    cylinder('#5e7459', 1.3, 1.45, .1, .07, .75);
    const lamp = new THREE.Mesh(new THREE.ConeGeometry(.32, .35, 16), material('#d6b66a')); lamp.position.set(1.3, 1.9, .1); group.add(lamp);
    plant(-3.2, -6.4, 1.1); plant(3.1, -6.4, .9);
  } else {
    const titles = { experience: 'The windmill · Systems & stories', skills: 'The greenhouse · Always growing', achievements: 'The wishing tree · Little milestones', certifications: 'The observatory · Look a little further', contact: 'The post office · Leave a little note', story: 'The reading nook · A wandering journal', map: 'The map room · Where shall we wander?' };
    plaque(titles[kind] || titles.story, 0, 5.25, -6.65, 7);
    // This physical timber noticeboard holds the corresponding journal.
    box('#7e6d4c', 0, 3.1, -3.8, 5.15, 5.7, .2);
    for (const x of [-2.6, 2.6]) box('#b4a078', x, 3.1, -3.65, .14, 5.8, .18);
    for (const y of [.25, 5.95]) box('#b4a078', 0, y, -3.65, 5.35, .14, .18);
    if (kind === 'experience') {
      for (let i = 0; i < 3; i++) {
        const gear = new THREE.Group(); gear.position.set(-5 + i * .9, 2 + i * .9, -6.2); group.add(gear);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.7, .13, 8, 24), material('#b29860')); gear.add(ring);
        for (let j = 0; j < 12; j++) { const tooth = box('#b29860', Math.cos(j / 12 * Math.PI * 2) * .8, Math.sin(j / 12 * Math.PI * 2) * .8, 0, .19, .25, .2, gear); tooth.rotation.z = j / 12 * Math.PI * 2; }
        moving.push({ object: gear, kind: 'gear', phase: i });
      }
      shelf(5, -5.7); cylinder('#857758', -5, 1.4, -1, .45, 2.8);
    } else if (kind === 'skills') {
      for (const x of [-5.7, 5.7]) for (const z of [-5.5, -2, 1.5]) plant(x, z, 1.2 + (z + 6) * .12);
      const glass = new THREE.Mesh(new THREE.SphereGeometry(8.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#b4d4c2', transparent: true, opacity: .12, side: THREE.DoubleSide })); glass.position.y = 4; group.add(glass);
      for (let i = 0; i < 5; i++) { const arch = new THREE.Mesh(new THREE.TorusGeometry(8, .055, 5, 48, Math.PI), material('#839b78')); arch.position.y = 4; arch.rotation.y = i * Math.PI / 5; group.add(arch); }
    } else if (kind === 'achievements') {
      cylinder('#876646', -5, 2.1, -3, .37, 4.2);
      for (let i = 0; i < 9; i++) ball(i % 2 ? '#98ae71' : '#c6b793', -5 + Math.sin(i * 2.4), 4.1 + Math.cos(i) * .4, -3 + Math.cos(i * 2.4), 1.1, .75, .95);
      shelf(5, -5.8);
      for (let i = 0; i < 3; i++) { cylinder('#d5b468', 4.4 + i * .6, 3.1, -5.3, .17, .55); ball('#d5b468', 4.4 + i * .6, 3.5, -5.3, .27, .2, .27); }
    } else if (kind === 'certifications') {
      cylinder('#6c8d86', 4.7, 1.1, -1.5, .13, 2.2);
      const telescope = cylinder('#a6b3a0', 4.7, 2.6, -1.5, .35, 2.8); telescope.rotation.z = .9;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(8.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshToonMaterial({ color: '#799a94', side: THREE.BackSide })); dome.position.y = 5.5; group.add(dome);
      for (let i = 0; i < 12; i++) ball('#f2d69b', Math.sin(i * 2.3) * 6, 5.7 + (i % 3) * .5, Math.cos(i * 2.3) * 6, .055, .055, .055);
    } else if (kind === 'contact') {
      for (const x of [-6, -5, -4]) for (const y of [1, 2, 3, 4]) { box('#9f7b59', x, y, -6.6, .8, .8, .65); box('#e4ca9d', x, y, -6.23, .66, .13, .025); }
      box('#bd9467', 4.8, 1.3, -2, 3.2, .2, 1.7); box('#617b61', 4.8, 1.6, -2, 1.15, .5, .8);
      box('#efdfbd', 4.8, 2.2, -2.2, .9, .8, .025);
      for (let i = 0; i < 10; i++) ball('#ded0ad', 4.4 + (i % 5) * .18, 1.72, -1.55 + Math.floor(i / 5) * .15, .055, .045, .055);
    } else {
      shelf(-5.3, -5.8); shelf(5.3, -5.8);
      box('#91a878', -4.8, .55, 1, 2.3, .5, 1.5); box('#91a878', -4.8, 1.35, 1.6, 2.3, 1.3, .35);
      box('#d6c8a5', -4.8, .96, 1, 1.95, .28, 1.15);
    }
  }
  return {
    group, screens, pickable, colliders,
    boardPoint: new THREE.Vector3(0, 3.1, -3.62),
    update(time) {
      moving.forEach(({ object, kind, phase }) => {
        if (kind === 'gear') object.rotation.z = time * .18 * (phase % 2 ? -1 : 1);
        else if (kind === 'leaf') object.rotation.z = Math.sin(time + phase) * .1;
        else if (kind === 'curtain') object.rotation.y = Math.sin(time * .6 + phase) * .025;
        else object.rotation.z = Math.sin(time * .65 + phase) * .035;
      });
    }
  };
}
