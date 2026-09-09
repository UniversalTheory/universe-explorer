# Universe Explorer

A real-time, high-fidelity 3D map of the Solar System in the browser. Every planet, major moon,
dwarf planet, comet and spacecraft is placed where it actually is right now, spinning with the
correct pole and rotation phase, with upcoming eclipses, conjunctions and alignments computed live.

Fully static, no backend, free data only. Runs on desktop and mobile.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # static site in dist/ (deploy anywhere: GitHub Pages, Netlify, Vercel…)
```

The app makes no network calls at runtime beyond loading its own files, so it works offline after
the first load.

## What's in this first build

**Bodies (≈80)**
- The Sun with an animated photosphere and corona glow.
- All 8 planets with 2K textures, 8K textures streamed in when you zoom close, atmospheres, Earth's
  clouds and city lights, Saturn's rings.
- 23 major moons: the Moon, Phobos, Deimos, Io, Europa, Ganymede, Callisto, Mimas, Enceladus,
  Tethys, Dione, Rhea, Titan, Iapetus, Miranda, Ariel, Umbriel, Titania, Oberon, Triton, Proteus,
  Nereid, Charon. Eleven of them use real NASA/LPI global maps; the rest use procedural surfaces.
- 9 dwarf planets (Pluto, Ceres, Eris, Haumea, Makemake, Sedna, Gonggong, Quaoar, Orcus), 8
  asteroids (including Apophis and Bennu), 10 comets (Halley, Encke, 67P, Hale–Bopp, NEOWISE,
  Swift–Tuttle, Tempel–Tuttle, Tsuchinshan–ATLAS, Pons–Brooks) and both known interstellar
  visitors (1I/ʻOumuamua, 3I/ATLAS). Comets grow a coma and tail as they approach the Sun.
- Spacecraft: Voyager 1 and 2, Pioneer 10 and 11, New Horizons, JWST, Parker Solar Probe, Europa
  Clipper, Psyche, plus the ISS and Hubble around Earth.
- Asteroid belt, Jupiter-region and Kuiper belt / scattered disc as 15,000 Keplerian particles
  propagated on the GPU, and 108,000 real stars in 3D at their measured distances (330,000 with the on-demand deep tier), moving with their proper motions, over the ESO Milky Way panorama in
  correct galactic orientation.

**Physics and fidelity**
- Positions in J2000 ecliptic coordinates from JPL Horizons, JPL SBDB and astronomy-engine, with a
  floating origin so precision holds from the ISS (400 km up) to Neptune (4.5 billion km).
- Rotation from the IAU 2009/2015 models: Earth's sub-solar point is correct to 0.01°, and every
  moon shows the right face to its planet.
- Shadows and eclipses computed in the shaders: moons darken when they pass into their planet's
  shadow (solar and lunar eclipses included), Saturn's rings shade the planet and the planet shades
  the rings.
- A readable scale mode that enforces a minimum on-screen size for bodies without touching
  distances, and a true-scale mode where everything is exactly as small as it really is.

**Time**
- Opens at the real current moment and tracks it live.
- Play, pause, speed presets from real time to 10 years per second, in both directions, and a
  date/time picker. One tap returns to now.

**Events** (computed in a Web Worker for the next three years from the simulation time)
- Moon phases and supermoons, lunar and solar eclipses (with the location of greatest eclipse),
  equinoxes and solstices, oppositions and conjunctions, greatest elongations, Earth's perihelion
  and aphelion, transits of Mercury and Venus, planet–planet and Moon–planet conjunctions,
  multi-planet alignments, meteor shower peaks, and mission milestones such as Apophis's 2029
  flyby and Europa Clipper's arrival. Clicking an event jumps time and flies to the body.

**Interface**
- Minimal translucent glass panels over a full-window canvas. Search, clickable labels with
  decluttering, an info panel with live facts (distance from Sun and Earth, light-travel time,
  speed, phase, eclipse status, physical data, discovery), events panel, and display settings.
- Drag to orbit, scroll or pinch to zoom, click to select, double-click or "Fly to" to travel.
  Fly-to arrives on the sunlit side. Keyboard: `Space` play/pause, `[` `]` slower/faster, `N` now,
  `E` events, `S` settings, `/` search, `F` fly to selection, `Esc` close.
- Mobile layout with bottom sheets that keep the focused body in view.

## Refresh the data

```bash
npm run data:textures   # free textures (Solar System Scope CC BY 4.0, ESO Milky Way CC BY 4.0)
npm run data:build      # JPL Horizons / SBDB / HYG / Celestrak -> public/data
npm test                # compares the runtime ephemeris against JPL Horizons
```

`data:build` accepts `-- --only=moons,smallbodies,spacecraft,stars,tle` to refresh one stage.
Re-run it every few months: the ISS/Hubble orbits go stale within weeks, spacecraft trajectories
end between 2029 and 2070 depending on the mission, and the fitted moon elements are best within
±10 years of 2026. Moon maps are produced from public-domain sources by
`scripts/process-moon-maps.py` (see the credits below).

## How positions are computed

| Bodies | Method | Accuracy vs. JPL Horizons |
| --- | --- | --- |
| Sun, planets, Pluto, Earth's Moon, Galilean moons | [astronomy-engine](https://github.com/cosinekitty/astronomy) (VSOP87 / ELP-based), in the browser | 0.001–0.01% of distance |
| 18 other major moons | Mean elements fitted to 20 years of JPL Horizons osculating elements, in each moon's Laplace plane, with a quadratic longitude term for resonance libration (`scripts/build-data.ts`) | < 1% of orbit radius 2020–2036 (Miranda 2.7%) |
| Dwarf planets, asteroids, comets, interstellar objects | JPL SBDB conic elements, two-body propagation (elliptic, parabolic, hyperbolic) | ~0.5–1% of distance |
| Voyager 1/2, Pioneer 10/11, New Horizons, JWST, Parker Solar Probe, Europa Clipper, Psyche | JPL Horizons state vectors, cubic Hermite interpolation | exact to the sample spacing |
| ISS, Hubble | Bundled TLE + SGP4 (`satellite.js`) | good for a few weeks after the TLE epoch |
| Rotation & poles | IAU WGCCRE 2009/2015 models (`src/ephemeris/iau.ts`) | Earth sub-solar point verified to 0.01° |

## Project layout

```
scripts/build-data.ts         data pipeline (Horizons, SBDB, HYG, Celestrak)
scripts/verify-ephemeris.ts   accuracy checks against Horizons (npm test)
scripts/process-moon-maps.py  public-domain moon map sheets -> 2K textures
scripts/dev/                  headless screenshot / geometry check helpers
src/core                      math, time scales, clock, settings
src/ephemeris                 frames, Kepler, IAU rotation, moons, small bodies, spacecraft, TLE
src/events                    event computation (Web Worker)
src/render                    Three.js scene: bodies, Sun, rings, atmospheres, comets, belts, stars, camera
src/ui                        glass UI: top bar, time bar, info / events / settings panels
src/data/catalog.ts           physical data, descriptions, textures for every body
public/data                   baked ephemeris (generated)
public/textures               textures (generated / processed)
```

## Documentation

`CLAUDE.md` is the entry point for contributors (human or AI). `docs/ARCHITECTURE.md` explains the
frames, ephemeris, rendering and event engine; `docs/DECISIONS.md` records every decision and why;
`docs/STATUS.md` lists what exists, known issues and the backlog; `docs/DEV-WORKFLOW.md` covers testing,
data refresh and how to add bodies or textures.

## Roadmap

- Serverless proxy for live JPL Horizons data (fresh TLEs, more small bodies on demand)
- More moons and small bodies; real maps for the moons that still use procedural textures
- Observer mode: the sky from your location, with local eclipse visibility
- Zoom out beyond the Solar System: nearby stars at real distances, then the Milky Way and beyond

## Credits

Ephemerides: NASA/JPL Horizons and Small-Body Database. Positions in the browser: astronomy-engine
(MIT). Planet textures: Solar System Scope (CC BY 4.0). Moon maps: NASA/JPL/Space Science Institute
and Lunar and Planetary Institute (P. Schenk) Cassini and Voyager global maps, and USGS Galileo/Voyager
mosaics, public domain, via Wikimedia Commons. Milky Way panorama: ESO/S. Brunier (CC BY 4.0).
Star catalogues: HYG v4.1 and AT-HYG v4.0 by David Nash / astronexus (CC BY-SA 4.0), carrying Gaia DR3 distances. Rotation models: IAU Working Group on Cartographic
Coordinates and Rotational Elements.
