# The film

The portfolio's front door: six full-screen shader scenes behind real HTML type, with
scroll as the timeline. Every word comes from the shared portfolio data in
`index.html`, so the film, Quick View and the 3D garden stay in step.

| Chapter | Scene (`scenes/`) | Content |
|---|---|---|
| 1 Code alchemist | `dunes.js`: a glass prism over sand dunes, blue hour to sunrise, a spectrum on the sand | Name, role, introduction |
| 2 Experience | `stairs.js`: a marble spiral staircase rising out of a sea of clouds | KeenStack, TCS |
| 3 Projects | `room.js`: the sea inside a white hall, sunlight through arches | Featured projects |
| 4 Skills | `door.js`: a door on a night lake, opening onto a sunlit desert | Skills |
| 5 Recognition | `moon.js`: a giant moon resting on the sea | Awards, credentials |
| 6 Contact | `dunes.js` (finale): the dunes at sunset | Email and links |

`film.js` renders each scene at reduced resolution into a half-float target and grades
it (bloom from the mip chain, ACES, vignette, grain, a faint chromatic fringe). The sky
comes from `common.js`: a physically based atmosphere (Rayleigh, Mie and ozone single
scattering) rendered into a small lookup each frame. Chapters dissolve into each other
behind a thin edge of warm light. Shaders compile in the background just before they
are needed, and the render resolution adapts to the measured frame rate.

No images, models or textures are downloaded. Fonts: Instrument Serif, Geist and Geist
Mono from Google Fonts. If WebGL2 is unavailable the page offers Quick View instead.
Reduced-motion preferences freeze the scenes' own motion; scroll still moves the story.
