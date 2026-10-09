import * as THREE from './vendor/three.module.js';
import { CSS3DSprite } from './vendor/CSS3DRenderer.js?v=2';

// Logo-inspired botany: every tool has a distinct silhouette, color and species.
const species = {
  Java: ['Coffee shrub', '#ca4a36', '#507648', 'coffee'],
  Python: ['Blue & gold twin vines', '#3776ab', '#ffd343', 'python'],
  React: ['Atomic blossom', '#61dafb', '#4c9c9e', 'react'],
  JavaScript: ['Sunshine succulent', '#f7df1e', '#6c8950', 'JS'],
  TypeScript: ['Bluebell bush', '#3178c6', '#79ae92', 'TS'],
  Flutter: ['Crystal fern', '#54c5f8', '#087bbc', 'flutter'],
  Angular: ['Ruby shield flower', '#dd0031', '#719064', 'A'],
  'Node.js': ['Emerald hex bloom', '#68a063', '#48764c', 'hex'],
  'Next.js': ['Midnight lily', '#343d39', '#9daea1', 'N'],
  Flask: ['Flask terrarium', '#64736b', '#accd93', 'flask'],
  Git: ['Coral branch tree', '#f05032', '#719566', 'git'],
  Figma: ['Five-petal orchid', '#a259ff', '#76a171', 'figma'],
  Postman: ['Citrus sapling', '#ff6c37', '#698e53', 'citrus'],
  'Power BI': ['Golden bamboo', '#f2c811', '#a2ad63', 'bars'],
  Pandas: ['Indigo bamboo', '#514480', '#c8a558', 'bars'],
  Azure: ['Azure mountain fern', '#0078d4', '#76afad', 'flutter'],
  GCP: ['Four-season blossom', '#4285f4', '#78a77c', 'gcp'],
  Vercel: ['Obsidian arrowleaf', '#2b3730', '#8e9e84', 'triangle'],
  'OpenAI API': ['Interwoven rosette', '#619f87', '#9bbc95', 'rosette'],
  Llama3: ['Alpaca topiary', '#5588ce', '#71975c', 'llama'],
  SQL: ['Query cactus', '#83b9d0', '#719783', 'database'],
  DB2: ['Blue data aloe', '#467cbc', '#83a38c', 'database'],
  IMS: ['Teal archive fern', '#5da597', '#78a278', 'database'],
  MySQL: ['Dolphin-blue succulent', '#00758f', '#e5a467', 'database'],
  PostgreSQL: ['Elephant-ear plant', '#336791', '#91aba8', 'elephant'],
  Cassandra: ['Violet eye flower', '#967bb2', '#8db9ad', 'eye'],
  COBOL: ['Amber heritage fern', '#bf9753', '#78925c', 'fern'],
  JCL: ['Copper script fern', '#bb8063', '#91a778', 'fern'],
  NLP: ['Word-leaf vine', '#cfb17f', '#75a594', 'vine']
};

export function createSkillPlants({ group, material, skills, onSelect, pickable, moving }) {
  const plants = [], sphere = new THREE.SphereGeometry(1, 12, 8);
  const ball = (parent, color, x, y, z, sx, sy, sz) => {
    const mesh = new THREE.Mesh(sphere, material(color)); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; parent.add(mesh); return mesh;
  };
  const cylinder = (parent, color, x, y, z, top, bottom, height, sides = 12) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, sides), material(color)); mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
  };
  const vine = (parent, color, points, radius = .035) => {
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 20, radius, 6, false), material(color)); parent.add(mesh); return mesh;
  };
  function emblem(parent, glyph, color, y = 1.4) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = ['JS'].includes(glyph) ? '#34443a' : '#fff8dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 122px sans-serif'; ctx.fillText(glyph, 128, 137);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const bloom = new THREE.Mesh(new THREE.PlaneGeometry(.58, .58), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })); bloom.position.set(0, y, .055); parent.add(bloom);
  }
  skills.forEach((skill, index) => {
    const column = index % 6, row = Math.floor(index / 6);
    const x = [-6.4, -4.4, -2.4, 2.4, 4.4, 6.4][column], z = -5.5 + row * 2.2;
    const [name, accent, leafColor, shape] = species[skill] || ['Curious little fern', '#a8ac77', '#7e9d68', 'fern'];
    const plant = new THREE.Group(); plant.position.set(x, .84, z); plant.userData.plant = index; group.add(plant); pickable.push(plant);
    cylinder(plant, '#b98667', 0, .22, 0, .36, .25, .44);
    cylinder(plant, '#d6a079', 0, .43, 0, .38, .38, .07);
    cylinder(plant, '#6d5b43', 0, .47, 0, .32, .32, .015);
    cylinder(plant, '#658257', 0, .9, 0, .025, .035, .9);
    const canopy = new THREE.Group(); canopy.position.y = .5; plant.add(canopy); moving.push({ object: canopy, kind: 'leaf', phase: index });
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4, y = .12 + i * .12;
      const leaf = ball(canopy, leafColor, Math.sin(a) * .22, y, Math.cos(a) * .22, .29, .09, .13); leaf.rotation.z = Math.cos(a) * .3; leaf.rotation.y = -a;
    }
    if (shape === 'coffee') {
      for (let i = 0; i < 9; i++) ball(canopy, i % 2 ? '#b94135' : '#8e392b', Math.sin(i * 2.4) * .26, .22 + i * .065, Math.cos(i * 2.4) * .25, .065, .075, .065);
      cylinder(plant, '#ede1ba', 0, 1.45, 0, .18, .13, .23);
      cylinder(plant, '#78533c', 0, 1.57, 0, .15, .15, .012);
      for (let i = 0; i < 3; i++) vine(plant, '#d4ba99', [[-.12 + i * .12, 1.6, 0], [-.06 + i * .12, 1.78, 0], [-.15 + i * .12, 1.95, 0]], .018);
    } else if (shape === 'python') {
      for (let i = 0; i < 2; i++) {
        vine(plant, i ? '#ffd343' : '#3776ab', [[i ? .25 : -.25, .5, 0], [i ? -.2 : .2, .85, .04], [i ? .2 : -.2, 1.15, .03], [i ? -.18 : .18, 1.53, 0]], .075);
        ball(plant, i ? '#ffd343' : '#3776ab', i ? -.18 : .18, 1.53, 0, .13, .09, .09);
        ball(plant, '#fff4cd', i ? -.2 : .2, 1.56, .079, .017, .017, .014);
      }
    } else if (shape === 'react' || shape === 'rosette') {
      const bloom = new THREE.Group(); bloom.position.y = 1.4; plant.add(bloom); moving.push({ object: bloom, kind: 'bloom', phase: index });
      for (let i = 0; i < (shape === 'react' ? 3 : 6); i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.37, .025, 6, 32), material(accent)); ring.scale.y = shape === 'react' ? .45 : .7; ring.rotation.z = i * Math.PI / 3; ring.position.x = shape === 'react' ? 0 : Math.cos(i * Math.PI / 3) * .13; bloom.add(ring);
      }
      ball(bloom, accent, 0, 0, 0, .07, .07, .07);
    } else if (shape === 'figma' || shape === 'gcp') {
      const colors = shape === 'figma' ? ['#f24e1e', '#ff7262', '#a259ff', '#1abcfe', '#0acf83'] : ['#4285f4', '#ea4335', '#fbbc05', '#34a853'];
      colors.forEach((color, i) => ball(plant, color, (i % 2 ? .13 : -.13), 1.65 - Math.floor(i / 2) * .23, .04, .13, .13, .08));
    } else if (shape === 'bars') {
      for (let i = 0; i < 4; i++) cylinder(plant, accent, -.27 + i * .18, .72 + i * .1, .03, .055, .065, .4 + i * .24, 6);
    } else if (shape === 'database') {
      for (let i = 0; i < 3; i++) cylinder(plant, accent, 0, 1.22 + i * .17, 0, .26, .26, .13, 16);
    } else if (shape === 'llama' || shape === 'elephant') {
      const body = ball(plant, accent, 0, 1.3, 0, .33, .23, .18);
      ball(plant, accent, .21, 1.56, 0, .16, .22, .15);
      if (shape === 'llama') for (const xx of [.13, .28]) ball(plant, accent, xx, 1.85, 0, .045, .17, .045);
      else { ball(plant, accent, .08, 1.58, .12, .21, .23, .045); vine(plant, accent, [[.32, 1.53, 0], [.43, 1.28, 0], [.46, 1.4, 0]], .065); }
      ball(plant, '#f7edca', .28, 1.61, .14, .026, .026, .02);
    } else if (shape === 'citrus') {
      for (let i = 0; i < 5; i++) ball(plant, accent, Math.sin(i * 2.4) * .28, 1.15 + i * .09, Math.cos(i * 2.4) * .2, .105, .105, .105);
    } else if (shape === 'eye') {
      ball(plant, accent, 0, 1.43, 0, .4, .18, .07); ball(plant, '#e5efe0', 0, 1.43, .075, .19, .13, .04); ball(plant, '#487d8f', 0, 1.43, .12, .09, .11, .03);
    } else if (shape === 'flask') {
      ball(plant, '#7f9c87', 0, 1.3, 0, .25, .24, .2); cylinder(plant, accent, 0, 1.6, 0, .09, .09, .32);
    } else if (['triangle', 'flutter', 'hex'].includes(shape)) {
      const blossom = new THREE.Mesh(new THREE.ConeGeometry(.38, .64, shape === 'hex' ? 6 : 3), material(accent)); blossom.position.y = 1.48; blossom.rotation.z = shape === 'flutter' ? -.6 : 0; plant.add(blossom);
      if (shape === 'flutter') { const wing = blossom.clone(); wing.position.x = .2; wing.position.y -= .26; wing.scale.setScalar(.7); wing.material = material(leafColor); plant.add(wing); }
    } else if (shape === 'git') {
      vine(plant, accent, [[-.2, 1.1, 0], [-.2, 1.6, 0], [.25, 1.3, 0]], .03);
      for (const [xx, yy] of [[-.2, 1.1], [-.2, 1.6], [.25, 1.3]]) ball(plant, accent, xx, yy, 0, .09, .09, .07);
    } else if (!['fern', 'vine'].includes(shape)) emblem(plant, shape, accent);
    const label = document.createElement('button'); label.className = 'skill-plant-label'; label.setAttribute('aria-label', `${skill} — ${name}`);
    const title = document.createElement('strong'); title.textContent = skill;
    const subtitle = document.createElement('span'); subtitle.textContent = name; label.append(title, subtitle); label.addEventListener('click', () => onSelect(index));
    const sign = new CSS3DSprite(label); sign.position.set(0, .22, .38); sign.scale.setScalar(.004); plant.add(sign);
    const point = new THREE.Vector3(x, 2, z);
    const normal = new THREE.Vector3(-Math.sign(x), 0, .6).normalize();
    plants.push({ point, normal, skill, label: sign, index });
  });
  return plants;
}
