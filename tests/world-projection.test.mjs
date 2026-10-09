import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, PerspectiveCamera, Vector3, Matrix4 } from '../public/story/vendor/three.module.js';
import { CSS3DRenderer, CSS3DObject } from '../public/story/vendor/CSS3DRenderer.js';

test('interactive CSS planes match the WebGL camera from close and angled views', () => {
  const previousDocument = globalThis.document;
  const element = () => ({ style: {}, children: [], setAttribute() {}, appendChild(child) { this.children.push(child); child.parentNode = this; } });
  globalThis.document = { createElement: element };
  try {
    for (const [width, height] of [[1280, 720], [390, 844]]) {
      const renderer = new CSS3DRenderer(); renderer.setSize(width, height);
      const scene = new Scene(), plane = new CSS3DObject(element());
      plane.position.set(0, 2.55, -4.84); plane.rotation.y = .3; plane.scale.setScalar(.00325); scene.add(plane);
      const camera = new PerspectiveCamera(48, width / height, .1, 160);
      for (const position of [[0, 2.55, -1.84], [2, 3, -2.7], [-4, 2.8, 3.6]]) {
        camera.position.set(...position); camera.lookAt(plane.position); renderer.render(scene, camera);
        const cameraElement = renderer.domElement.children[0].children[0];
        const transform = cameraElement.style.transform;
        const perspective = Number(transform.match(/perspective\(([^p]+)px\)/)[1]);
        const parentZ = Number(transform.match(/translateZ\(([^p]+)px\)/)[1]);
        assert.ok(1 - parentZ / perspective > 0, 'parent plane remains inside the CSS perspective volume');
        const cssMatrix = new Matrix4().fromArray(plane.element.style.transform.match(/matrix3d\(([^)]+)\)/)[1].split(',').map(Number));
        for (const point of [new Vector3(), new Vector3(200, 100, 0), new Vector3(-200, -100, 0)]) {
          const css = point.clone().applyMatrix4(cssMatrix), depth = css.z + parentZ;
          const projected = new Vector3(point.x, -point.y, point.z).applyMatrix4(plane.matrixWorld).project(camera);
          const divisor = 1 - depth / perspective;
          assert.ok(Math.abs(width / 2 + css.x / divisor - (projected.x + 1) * width / 2) < 1e-6);
          assert.ok(Math.abs(height / 2 - css.y / divisor - (1 - projected.y) * height / 2) < 1e-6);
        }
      }
    }
  } finally { globalThis.document = previousDocument; }
});
