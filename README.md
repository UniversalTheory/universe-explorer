# Universe Explorer

A real-time, high-fidelity 3D map of the Solar System and the Milky Way in the browser. Every planet,
major moon, dwarf planet, comet and spacecraft is placed where it actually is right now, spinning with
the correct pole and rotation phase, with upcoming eclipses, conjunctions and alignments computed live.
Zoom out and the same rule holds: 108,000 stars at their measured distances moving with their proper
motions, every confirmed exoplanet on its orbit, nebulae and clusters at their true sizes, black holes
with their companions, and a model of the whole Galaxy that says where it is a model.

Fully static, no backend, free data only. Runs on desktop and mobile.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # static site in dist/ (deploy anywhere: GitHub Pages, Netlify, Vercel…)
```

The app makes no network calls at runtime beyond loading its own files, so it works offline after
the first load.

## What's in the Solar System (v1)

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
  propagated on the GPU, over the ESO Milky Way panorama in correct galactic orientation.

## What's in the Milky Way (Phase 2)

Press `1`, `2`, `3` for the Solar System, the 50-light-year neighbourhood and the Galaxy; the scale bar in
the corner switches from kilometres to AU, light-years, parsecs and kiloparsecs as you go.

- **Stars**: 108,000 stars (HYG v4.1) at their Gaia-era distances, moving with their proper motions and
  radial velocities as the clock runs, plus a 221,000-star deep tier (AT-HYG) fetched when you leave the
  Solar System. 116 curated stars have descriptions, aliases and physical data; fly to one and it becomes a
  sphere coloured by its spectral type. Barnard's Star closes to 3.75 light-years around AD 11,740.
- **Exoplanets**: all 6,331 confirmed planets from the NASA Exoplanet Archive, on Keplerian orbits about
  their hosts with real phases where the archive has a transit or periastron epoch, so the panel can say
  when TRAPPIST-1 e next transits. Planets are lit by their own star and skinned by class (lava world,
  temperate rocky, super-Earth, mini-Neptune, hot Jupiter…). ~90 famous systems have hand-written text.
  What is unmeasured (the node angle on the sky, some phases) is flagged in the panel.
- **Nebulae and clusters**: 90 objects from OpenNGC at curated distances: emission and reflection nebulae,
  supernova remnants, planetary nebulae, dark clouds, open and globular clusters. Nebulae are licence-checked
  Wikimedia Commons photographs on cards in the plane of the sky, scaled to the object's real size and
  credited in the panel; clusters are 3D point clouds sized to the real radius.
- **Compact objects**: 15 black holes (Sagittarius A*, Cygnus X-1, V404 Cygni, the Gaia black holes…), 11
  neutron stars and pulsars, 4 white dwarfs. Sirius B, Procyon B, Alpha Centauri B and the star S2 move on
  their measured binary orbits; X-ray binaries orbit with their published periods. Black holes show a shadow,
  photon ring and accretion disc; pulsars sweep their beams.
- **The Galaxy**: a 300,000-point model of the disc, bulge, bar and the spiral arms fitted by Reid et al.
  2019 to maser parallaxes, aligned so Sgr A*, the nebulae and the clusters land in the right arms, fading
  in as the ESO panorama fades out. An optional artist's-impression map plane can be switched on. The
  heliopause, Oort cloud, Local Bubble, Gould Belt and Radcliffe Wave are drawn as labelled schematic shapes.
- **Time at galactic scale**: speeds of 100, 1,000 and 100,000 years per second show stars drifting and
  S2 lapping Sgr A*; the Solar System is hidden at those rates because its ephemerides do not reach that far.

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
- Play, pause, speed presets from real time to 100,000 years per second, in both directions, and a
  date/time picker. One tap returns to now. Above 20 years per second the Solar System is hidden.

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
  `E` events, `S` settings, `/` search, `F` fly to selection, `1` `2` `3` zoom ladder, `Esc` close.
- Search covers planets, moons, spacecraft, 116 named stars, every exoplanet and host, all deep-sky objects
  (by common name or M / NGC / Caldwell number), compact objects, and Galaxy regions and arms.
- Mobile layout with bottom sheets that keep the focused body in view.

## Refresh the data

```bash
npm run data:textures        # free textures (Solar System Scope, ESO panorama and galaxy map; all CC BY 4.0)
npm run data:build           # Horizons / SBDB / HYG + AT-HYG / Exoplanet Archive / OpenNGC / Celestrak -> public/data
npm run data:deepsky-images  # licence-checked Commons photographs for the deep-sky list (slow)
npm test                     # compares the Solar System ephemeris against JPL Horizons
npm run check                # star, exoplanet, deep-sky, compact-object and galaxy checks (no network)
```

`data:build` accepts `-- --only=moons,smallbodies,spacecraft,stars,exoplanets,deepsky,tle` to refresh one
stage (stars and exoplanets build together).
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
| Stars | HYG v4.1 / AT-HYG v4.0 positions, distances and space velocities; linear motion in time (`src/ephemeris/stars.ts`) | Gaia DR3 parallaxes: ~1% nearby, tens of % at 1–2 kpc; motion valid ±10⁵ yr |
| Exoplanets | NASA Exoplanet Archive composite parameters; Kepler orbit in the sky frame, phase from transit / periastron epochs (`src/ephemeris/exoplanets.ts`) | period, size and phase as published; node angle unmeasured |
| Binary companions (Sirius B, S2…) | Visual-binary elements from the literature (`src/ephemeris/binary.ts`) | Sirius B separation and S2's 2018 periastron reproduced |
| Nebulae, clusters, regions | Fixed positions from OpenNGC / curated distances; the Galaxy from Reid et al. 2019 arm fits | positions real; shapes are models, labelled |

## Project layout

```
scripts/build-data.ts         data pipeline (Horizons, SBDB, HYG + AT-HYG, Exoplanet Archive, Celestrak)
scripts/deepsky.ts            deep-sky list, OpenNGC parsing, licence-checked Commons image fetch
scripts/verify-ephemeris.ts   accuracy checks against Horizons (npm test)
scripts/process-moon-maps.py  public-domain moon map sheets -> 2K textures
scripts/compress-deepsky.py   re-encodes deep-sky photos to ≤ 1024 px JPEG
scripts/dev/                  headless screenshot helper and the *-check.ts verification scripts
src/core                      math, time scales, clock (incl. galactic rates), settings
src/ephemeris                 frames, Kepler, IAU rotation, moons, small bodies, spacecraft, TLE, stars, exoplanets, binaries, deep sky
src/events                    event computation (Web Worker)
src/render                    Three.js scene: bodies, Sun/stars, star cloud, exoplanets, deep-sky cards, black holes, galaxy model, regions, camera
src/ui                        glass UI: top bar + zoom ladder, time bar, scale bar, info / events / settings panels
src/data/                     catalog.ts (Solar System), stars.ts, exoplanets.ts, deepsky.ts, compact.ts, galaxy.ts
public/data                   baked data: ephemeris.json, stars(.bin, -deep.bin), exoplanets(.json, .bin), deepsky.json (generated)
public/textures               textures (generated / processed), deepsky/ photographs
```

## Documentation

`CLAUDE.md` is the entry point for contributors (human or AI). `docs/ARCHITECTURE.md` explains the
frames, ephemeris, rendering and event engine; `docs/DECISIONS.md` records every decision and why;
`docs/STATUS.md` lists what exists, known issues and the backlog; `docs/DEV-WORKFLOW.md` covers testing,
data refresh and how to add bodies or textures.

## Status and roadmap

Phase 2 (the Milky Way) stages A–F are complete. Stage G (the polish pass) is under way: the performance work is
done — the galaxy model is generated in a Web Worker, the exoplanet catalogue loads after boot, and the events
worker no longer carries the body catalogue — and device QA, visual and UI polish and CI remain. See
`docs/STATUS.md` for the full list of what exists, the honesty flags, and the backlog. After that:

- Serverless proxy for live JPL Horizons data (fresh TLEs, more small bodies on demand)
- More moons and small bodies; real maps for the moons that still use procedural textures
- Observer mode: the sky from your location, with local eclipse visibility
- Beyond the Milky Way: the Magellanic Clouds, Andromeda, the Local Group and the large-scale structure

## Credits

Ephemerides: NASA/JPL Horizons and Small-Body Database. Positions in the browser: astronomy-engine
(MIT). Planet textures: Solar System Scope (CC BY 4.0). Moon maps: NASA/JPL/Space Science Institute
and Lunar and Planetary Institute (P. Schenk) Cassini and Voyager global maps, and USGS Galileo/Voyager
mosaics, public domain, via Wikimedia Commons. Milky Way panorama: ESO/S. Brunier (CC BY 4.0).
Star catalogues: HYG v4.1 and AT-HYG v4.0 by David Nash / astronexus (CC BY-SA 4.0), carrying Gaia DR3 distances. Exoplanets: NASA Exoplanet Archive (operated by Caltech/IPAC under contract with NASA), Planetary Systems Composite Parameters table. Deep-sky positions and sizes: OpenNGC (CC BY-SA 4.0); nebula photographs from Wikimedia Commons under CC BY / CC BY-SA / public-domain licences, credited individually in the app. Galaxy map artwork: NASA/JPL-Caltech/ESO/R. Hurt (CC BY 4.0). Rotation models: IAU Working Group on Cartographic
Coordinates and Rotational Elements.
