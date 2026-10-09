# Nivetha's little world

The main portfolio is a Three.js floating garden. Everything visitors explore lives
at a landmark. Interactive journals are actual Three.js CSS3DObjects in the scene,
and the camera travels to them when opened.

- Journal: four chapters of Nivetha's story.
- Cottage: projects, demos, source links, and the existing project refresh API.
- Windmill: TCS experience and recognition.
- Meadow: the original technology skills.
- Wishing tree: patents, hackathons, and other achievements.
- Observatory: credentials and the ServiceNow portfolio.
- Mailbox: email, LinkedIn, and the original résumé.

Drag or swipe to orbit. Scroll or pinch to zoom. Tap a label or a building to open
its journal. Escape closes the journal. Existing fragment links, such as
`#projects`, `#experience`, and `#resume`, open the appropriate place.

The journal includes a world map, golden-hour lighting, and a motion toggle.
Reduced-motion preferences are respected. If WebGL is unavailable, every journal
remains accessible in a text fallback. The separate ServiceNow page retains its
existing content and gains the story prologue.

All scenery is modeled procedurally. Three.js 0.180.0 and its controls/renderers
are vendored locally with their MIT license. There is no build step; serve the
existing `public` directory.
