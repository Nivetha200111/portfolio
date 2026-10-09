Three.js 0.180.0, MIT license (see LICENSE).
Pinned browser ES modules downloaded from the official three npm package via jsDelivr:
https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js
https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.core.min.js
https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/renderers/CSS3DRenderer.js
https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js

Served locally so the story does not depend on an external runtime CDN.
Imports are rewritten to reference the local three.module.js and three.core.js.

CSS3DRenderer has a local perspective-camera adaptation: object transforms are
converted to camera space and the parent plane stays one pixel inside the CSS
perspective volume. This avoids Chromium dropping pointer targets when a close
camera moves behind the scene origin. Projection parity with the WebGL camera is
checked by tests/world-projection.test.mjs. Orthographic rendering is unchanged.
