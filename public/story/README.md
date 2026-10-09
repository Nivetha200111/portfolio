# Nivetha's little world

The main portfolio is a Three.js floating garden. Everything visitors explore lives
at a landmark. Entering a destination takes the camera inside a modeled room.
Computer desktops and timber noticeboards are actual Three.js CSS3DObjects,
attached to the furniture rather than fixed to the browser window.

- Journal: four chapters of Nivetha's story.
- Cottage: a workshop with seven computer stations, project demos, source links,
  and the existing project refresh API.
- Windmill: TCS experience and recognition.
- Meadow: the original technology skills.
- Wishing tree: patents, hackathons, and other achievements.
- Observatory: credentials and the ServiceNow portfolio.
- Mailbox: email, LinkedIn, and the original résumé.

Drag or swipe to orbit outdoors. Scroll or pinch to zoom. Tap a label or a building
to enter its room. Indoors, drag to look, use WASD/arrow keys to walk, or tap the
floor to move. Select a computer to sit at it and browse builds on its screen.
The exit door or Escape returns to the garden. Existing fragment links, such as
`#projects`, `#experience`, and `#resume`, open the appropriate place.

The journal includes a world map, golden-hour lighting, and a motion toggle.
Reduced-motion preferences are respected. If WebGL is unavailable, every journal
remains accessible in a text fallback. The separate ServiceNow page retains its
existing content and gains the story prologue.

All scenery is modeled procedurally. Three.js 0.180.0 and its controls/renderers
are vendored locally with their MIT license. There is no build step; serve the
existing `public` directory.
