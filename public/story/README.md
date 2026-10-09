# Nivetha's little world

The main portfolio is a Three.js floating garden. Everything visitors explore lives
at a landmark. Entering a destination takes the camera inside a modeled room.
Computer desktops and timber noticeboards are actual Three.js CSS3DObjects,
attached to the furniture rather than fixed to the browser window.

- Journal: four chapters of Nivetha's story.
- Cottage: a workshop with seven computer stations, project demos, source links,
  and the existing project refresh API.
- Windmill: TCS experience and recognition.
- Greenhouse: all 29 skills grow as logo-inspired plants. Java is a coffee shrub,
  Python has blue and gold vines, React has an atomic flower, and every other
  skill has its own themed species. Click the plant or its tag to approach it.
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

Doors swing on hinges as the camera approaches, crosses the threshold, and settles
inside. The same sequence runs in reverse on exit; reduced motion skips the travel.
Birds, clouds, and mountains belong to the outdoor group and disappear indoors.
Rooms include gramophones, woven rugs, drifting dust, brass door hardware, desk
tools, and tea steam.

Launch opens the live project in an iframe inside the physical monitor. Its small
browser toolbar includes back, reload, and a full-page option. Builds that are
currently offline or block embedding show an in-screen explanation and source
links. Only the active monitor loads an iframe; leaving it unmounts the app.

Original room scores and door creaks are synthesized with Web Audio after the
first visitor gesture. Each destination has a different melody; music fades
between rooms and stops outdoors or when the tab is hidden. The gramophone and
monitor provide mute controls, and the preference is remembered. No audio assets
or copyrighted recordings are downloaded. Verify the audio lifecycle with
`node --test tests/world-audio.test.mjs`.

All scenery is modeled procedurally. Three.js 0.180.0 and its controls/renderers
are vendored locally with their MIT license. There is no build step; serve the
existing `public` directory.
