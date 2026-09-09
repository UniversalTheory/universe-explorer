# Architecture

## Data flow per frame

```
Clock (ms, rate, live) ─► SimTime {ms, tt, jd, astro}
        │
        ▼
Universe.computePositions(t)  ─► Ephemeris.state(id, t) for every body (heliocentric ECL km, double)
        │
        ▼
origin = helio(focus)  (blended between old/new focus during a fly-to)
        │
        ▼
CameraController.update(dt) ─► spherical offset from origin; applyPose()
        │
        ▼
Universe.update(...)  ─► world positions = helio - origin (Three axes)
                          orientation quaternions (IAU models)
                          visual-scale exaggeration, markers, occluder lists, orbit lines, belts
                          screen projection for labels/picking
        │
        ▼
Labels.update(...)  (DOM)  ─►  render: Starfield scene (rotation only) then main scene
        │
        ▼
UI at low rate: TimeBar.render() each frame; info stats 4 Hz; events panel + EventService 1 Hz
```

## Source map

| Path | Role |
| --- | --- |
| `src/main.ts` | boots `App`; exposes `window.app` for dev tooling |
| `src/app/App.ts` | wires everything: renderer, Universe, camera, panels, keyboard, fly-to, live facts |
| `src/core/math3.ts` | double-precision vec3/mat3 (tuples), rotations, angle wrapping |
| `src/core/time.ts` | J2000/TT/JD helpers, `SimTime`, `makeSimTime` |
| `src/core/Clock.ts` | simulation clock: live / playing / rate (negative = reverse); `RATE_STEPS` |
| `src/core/Settings.ts` | persisted settings (localStorage) with change events |
| `src/data/catalog.ts` | `BodyDef` for every body: physical data, description, textures, ephemeris source; meteor showers; notable one-off events |
| `src/data/stars.ts` | ~115 curated stars (nearest, brightest, famous exoplanet hosts) with physical data and descriptions, keyed into the star catalogue |
| `src/data/exoplanets.ts` | Turns the archive into `BodyDef`s (hosts + planets, lazy), planet classes and procedural skins, curated notes for ~90 systems/planets |
| `src/data/deepsky.ts` | 90 deep-sky objects as `BodyDef`s with hand-written descriptions and aliases (M / NGC / Caldwell numbers) |
| `src/render/DeepSkyObject.ts` | Photo card in the sky plane (additive, vignetted, angle-faded) or a Plummer point cloud for clusters |
| `scripts/deepsky.ts` | Deep-sky list (OpenNGC names, curated distances, Commons image choice), `buildDeepSky`, licence-checked image fetch |
| `src/ephemeris/frames.ts` | EQJ↔ECL, GAL→EQJ, ECL→Three, AU/GM constants |
| `src/ephemeris/kepler.ts` | Kepler solvers (elliptic/parabolic/hyperbolic), conic state, orbit sampling |
| `src/ephemeris/iau.ts` | IAU WGCCRE pole/prime-meridian models for ~40 bodies; `bodyPole`, `bodyFixedToEqj`, `poleFrameToEqj` |
| `src/ephemeris/planets.ts` | astronomy-engine wrappers (planets, Moon, Galilean moons), GM table |
| `src/ephemeris/moons.ts` | fitted mean elements → state (Laplace frame → parent pole → EQJ → ECL) |
| `src/ephemeris/smallbodies.ts` | SBDB conic elements → heliocentric state |
| `src/ephemeris/spacecraft.ts` | `Trajectory`: binary state-vector file + cubic Hermite interpolation |
| `src/ephemeris/tle.ts` | SGP4 via satellite.js, TEME→EQJ→ECL |
| `src/ephemeris/stars.ts` | `StarCatalog`: star positions + space velocities from `stars.bin`, linear motion in time; B−V colour helper |
| `src/ephemeris/exoplanets.ts` | `ExoCatalog` + Keplerian state of a planet about its host in the sky frame (east, north, toward observer) |
| `src/ephemeris/deepsky.ts` | `DeepSkyCatalog`: fixed positions and physical sizes of nebulae / remnants / clusters from `deepsky.json` |
| `src/ephemeris/binary.ts` | Visual/spectroscopic binary orbits in the sky frame (north, east, toward observer); separation / position angle; Schwarzschild radius |
| `src/data/compact.ts` | Black holes, neutron stars, white dwarfs and their companions with masses, spins and orbital elements; S2; Alpha Cen B binding |
| `src/render/CompactObjects.ts` | `BlackHoleObject` (shadow, photon ring, accretion disc, far glow) and `PulsarBeams` |
| `src/data/galaxy.ts` | Galaxy parameters (R₀, Reid 2019 arms, disc/bulge/bar), Galactic-frame conversions, schematic regions and arm labels |
| `src/render/GalaxyModel.ts` | 275k-point disc / bulge / bar / arm model in the far scene + optional artwork map plane |
| `src/render/RegionObject.ts` | Wireframe shells, rings and curves for the heliopause, Oort cloud, Local Bubble, Gould Belt, Radcliffe Wave |
| `src/ephemeris/orbit-elements.ts` | osculating elements from a state vector (for drawing planet/moon orbits) |
| `src/ephemeris/Ephemeris.ts` | facade + per-frame cache; loads `public/data` |
| `src/ephemeris/types.ts` | shape of `public/data/ephemeris.json` |
| `src/events/compute.ts` | event prediction (pure); `events.worker.ts` runs it; `EventService.ts` is the main-thread client |
| `src/render/Universe.ts` | scene manager (bodies, Sun, orbits, belts, comets, labels data, picking) |
| `src/render/BodyObject.ts` | a body: sphere, clouds, atmosphere, rings, night lights, marker sprite, exaggeration, shader patching |
| `src/render/SunObject.ts` | animated Sun shader, glow billboard, the point light + tiny ambient |
| `src/render/Comet.ts` | coma sprite + anti-sunward tail line, activity ∝ 1/r² |
| `src/render/Belts.ts` | GPU-propagated Keplerian particle belts |
| `src/render/Starfield.ts` | ESO Milky Way sphere in a separate rotation-only scene |
| `src/render/StarCloud.ts` | 3D star point cloud in the main scene (origin-relative float32 rewrite, magnitude-from-camera sizing, proper motion) |
| `src/render/OrbitLine.ts` | polyline relative to a parent |
| `src/render/Labels.ts` | DOM labels with priority decluttering + selection ring |
| `src/render/CameraController.ts` | focus-orbit camera: inertia, wheel/pinch, fly-to with lit-side approach, mobile screen shift |
| `src/render/shaders.ts` | GLSL: eclipse visibility, Sun, atmosphere, glow, rings, stars, belts |
| `src/render/Textures.ts` | texture loader/cache, procedural planet textures, disc sprite |
| `src/ui/*` | TopBar (search + zoom ladder), TimeBar, ScaleBar, InfoPanel, EventsPanel, SettingsPanel, format helpers, styles.css |
| `scripts/build-data.ts` | data pipeline → `public/data` |
| `scripts/verify-ephemeris.ts` | `npm test` |
| `scripts/process-moon-maps.py` | map sheets → 2K textures |
| `scripts/fetch-textures.sh` | planet textures + Milky Way |
| `scripts/dev/` | `snap.mjs` (headless screenshot), `events-check.ts`, `rotation-check.ts`, `eclipse-check.ts` |

## Reference frames

- **EQJ**: J2000 mean equator/equinox ≈ ICRF. astronomy-engine, IAU models, star catalogue.
- **ECL**: J2000 ecliptic. The world frame. `EQJ_TO_ECL = Rx(-ε)`, ε = 84381.448″.
- **GAL**: galactic (Hipparcos matrix). Used only to orient the Milky Way sphere.
- **Three**: `(x, y, z)_ECL → (x, z, -y)`. A body's spin quaternion is `P · R_bodyfixed→ECL · Pᵀ`.
- **Body-fixed (IAU)**: x = prime meridian, z = north pole. `bodyfixed→EQJ = Rz(α0+90°)·Rx(90°-δ0)·Rz(W)`.
  Three's SphereGeometry puts +Y at the pole and u = 0.5 at +X, so equirectangular textures with 0°
  longitude at the centre and east to the right map correctly without flipping.
- Uranus follows the IAU convention (pole with negative declination, W decreasing); its moons therefore
  have inclinations near 180° in the body-equator frame. This is correct and consistent.

## Ephemeris sources and accuracy

| Bodies | Method | Verified error |
| --- | --- | --- |
| Sun, planets, Pluto, Moon, Io/Europa/Ganymede/Callisto | astronomy-engine `HelioState`, `GeoMoonState`, `JupiterMoons` | 0.001–0.01% of distance vs Horizons |
| 18 other moons | fitted mean elements (see below) | < 1% of orbit radius over 2020–2036; Miranda 2.7% |
| Dwarfs, asteroids, comets, interstellar | SBDB elements at their epoch, two-body | 0.3–1% of distance (planetary perturbations ignored) |
| Spacecraft (9) | Horizons vectors, Hermite | exact at samples; steps 12 h–30 d |
| ISS, Hubble | TLE + SGP4 | a few weeks after epoch |

### Moon element fitting (`scripts/build-data.ts` → `buildMoons`)

For each moon: (1) a dense short arc (≈2000 samples, step P/6) of Horizons osculating elements in the
parent's `BODY EQUATOR` frame gives an unambiguous mean motion n₁; (2) a 20-year arc (4000 samples)
is fetched; the orbit normals are fitted to a cone about a **Laplace pole** (minimum variance of n·p,
skipped when the normals move < 0.3°); elements are re-expressed in that Laplace frame; the mean
longitude is unwrapped with n₁ and fitted as `L0 + n·τ + nDot·τ²` (the quadratic captures resonance
libration such as Mimas–Tethys); node and periapsis rates are fitted by de-rotating (sin i·[sin Ω, cos Ω])
and (e·[sin ϖ, cos ϖ]). Stored: `frame` (Laplace axes in the body-equator frame), a, e, i, Ω0, Ω̇, ϖ0, ϖ̇,
L0, n, nDot, gm, epoch (JD 2461041.5 = 2026-01-01), plus independent Horizons test vectors at 2-year
intervals 2020–2036 used by `npm test`.

Runtime (`moons.ts`): Laplace-frame perifocal state → `frameᵀ` → parent pole at date (`poleFrameToEqj`)
→ `EQJ_TO_ECL`.

### Spacecraft binary format

`public/data/spacecraft/<id>.bin`: `uint32 count`, 4 bytes pad, `float64 jd[count]`, `float32 state[count*6]`
(x y z km, vx vy vz km/s, heliocentric ECL). Segments with different step sizes were merged and de-duplicated.

## Rendering

- `WebGLRenderer` with `logarithmicDepthBuffer`, sRGB output, no tone mapping. Pixel ratio ≤ 2 (≤ 1.5 low quality).
- Units: 1 world unit = 1 km. Camera near = max(0.02, (distance − radius)·0.002), far = 1e14.
- **Visual scale mode**: each body's mesh is scaled so its apparent radius is at least N px
  (`MIN_PX` in `Universe.ts`: star 9, planet 5.5, dwarf 3.5, moon 3.2, small 2.4). The physical
  radius is used for lighting/eclipse geometry and camera clamping, so exaggeration never changes physics.
  **True scale** disables this; tiny bodies show a marker sprite instead.
- **Lighting**: one `PointLight` at the Sun (intensity 2.6, decay 0) + ambient 0.06.
- **Eclipses**: `ECLIPSE_GLSL` (`shaders.ts`) computes the fraction of the Sun's disc hidden by up to 6
  spherical occluders per body (parent, siblings, children sorted by angular size, set each frame in
  `Universe.updateOccluders`). Injected into `MeshStandardMaterial` via `onBeforeCompile`
  (`BodyObject.patchMaterial`): `directLight.color *= sunVis` inside `lights_fragment_begin`.
- **Rings**: `RingGeometry` in the equatorial plane; `RING_FRAG` shades the planet's shadow on the
  rings; `RING_SHADOW_GLSL` shades the rings' shadow on the planet (define `HAS_RING`).
- **Night lights**: Earth's night map added as emissive where the Sun is below the horizon (`HAS_NIGHT`, guarded by `USE_MAP`).
- **Atmospheres**: additive Fresnel rim shell, colour/height/intensity from the catalogue.
- **Textures**: 2K by default; `textureHi` (8K) loaded once the body exceeds 260 px radius. Procedural
  textures (`Textures.ts`) for bodies with a `procedural` skin and no map: Perlin fBm + craters/bands/two-tone.
- **Orbits**: planets/dwarfs/moons draw osculating conics recomputed periodically; SBDB bodies draw
  their fixed conic; spacecraft draw the baked path. Minor bodies and spacecraft show their path only
  when selected or focused. Moon orbits hide below 12 px.
- **Belts**: vertex shader solves Kepler for 15,400 particles with plausible a/e/i distributions.
- **Starfield**: separate scene rendered first with `autoClear=false`; stars sized by magnitude,
  coloured by B−V; the Milky Way sphere is rotated by `P · EQJ_TO_ECL · GAL_TO_EQJ · Pᵀ` with the
  texture mirrored (`repeat.x = -1`) because it is viewed from inside.
- **Comets**: `CometVisual` (coma sprite + 40-segment tail line) attached to comet/interstellar bodies,
  visible within 4.5 AU, size ∝ 1/r².

## Camera

Spherical offset (theta, phi, distance) around the focus; camera.up = ecliptic north. Fly-to animates
distance in log space with a small zoom-out bump, and theta/phi toward a three-quarter-lit viewpoint
(`App.litViewDir`). Wall-clock based. Minimum distance 1.35 × physical radius. On narrow screens with a
panel open, the view is shifted so the body sits in the upper part (`screenShiftY`).

## Events

`computeEvents(startMs, horizonDays)` runs in a Worker (~0.2 s for 3 years): moon quarters, lunar/solar
eclipses (`SearchLunarEclipse`, `SearchGlobalSolarEclipse`), seasons, oppositions/conjunctions
(`SearchRelativeLongitude`), max elongations, Earth apsides, supermoons (full Moon within 1.2 d of
perigee), transits, planet–planet conjunctions (< 2.5°, daily scan + ternary refinement, skipped when
< 8° from the Sun), Moon–planet pairings (90 days), alignments (≥ 3 bright planets within 15° or ≥ 4
within 45°, > 15° from the Sun), meteor showers (static table), notable missions (static table).
`EventService` re-requests when the simulation time moves more than a day.

## UI

Plain DOM + CSS (`src/ui/styles.css`), glass look via `backdrop-filter`. Panels: info (right / bottom
sheet on mobile), events (left), settings popover. `#labels` layer holds body labels and the selection
ring. URL hash `#<bodyId>` selects and flies to a body on load.

## Galactic scale (Phase 2 foundations)

- **Units**: km stay the world unit for the whole Milky Way. `WORLD_UNIT_KM` (`frames.ts`, = 1) is applied in
  `Universe.worldFromHelio`, the one place heliocentric doubles become Three.js floats; it is the hook for a
  larger unit in the extragalactic phase. Constants `LY_KM`, `PC_KM`, `KPC_KM`, `GAL_NORTH_ECL`, `GAL_CENTRE_ECL`.
- **Camera**: far plane `CAMERA_FAR_KM` = 1e19, max distance `MAX_CAMERA_DISTANCE_KM` = 2e18 (≈ 65 kpc). Wheel
  zoom gain grows with log(distance) beyond 2e10 km so the Galaxy is reachable in a few dozen notches.
- **Zoom ladder** (`ZOOM_VIEWS` in `TopBar.ts`): Solar System (frames 32 AU), Stars (25 ly), Galaxy (22 kpc,
  viewed from galactic north on the anti-centre side). Keys 1 / 2 / 3; `App.jumpTo(view)`. The active step is
  highlighted from the camera distance while the Sun is the focus.
- **Scale bar** (`ScaleBar.ts`): map-style bar in the bottom-right, a round number of km / AU / ly / pc / kpc
  measured in the plane of the focus; `fmtKm` switches to light-years and parsecs above 0.1 ly, `fmtLightTime` to years.
- **Orbit lines** are hidden when the orbit spans < 3 px (moons < 12 px), so the planets' orbits vanish before the
  stars come into view.
- **Sun glow**: quad close up, point sprite (`GLOW_POINT_*`, `SunObject.glowPoint`) when the Sun is < 40 px.
- **Catalogue kinds** reserved for the coming stages: `exoplanet`, `nebula`, `cluster`, `blackhole`, `neutron`,
  `region`; ephemeris source `{ kind: 'fixed', pos }` for objects without measured motion.

## Stars (Phase 2, Stage B)

- **Data** (`scripts/build-data.ts` → `buildStars`): HYG v4.1 gives the standard tier (108k stars: everything with a
  measured distance, plus the 204 naked-eye stars without one, placed at 1,000 pc and flagged). AT-HYG v4.0 mag < 10
  gives the deep tier (221k stars not in HYG, `stars-deep.bin`, fetched on demand). Both files use the layout in
  `src/ephemeris/stars.ts`: 10 float32 per star, EQJ parsecs and pc/yr, sorted by apparent magnitude. Velocities are
  computed from proper motion + radial velocity in the pipeline (HYG clamps proper motions at 9999.99 mas/yr, so
  Barnard's Star and a few bad Hipparcos parallaxes are overridden in `STAR_OVERRIDES`). `STAR_KEYS` maps catalogue
  ids to HIP / Gliese designations or inline coordinates (TRAPPIST-1, Teegarden's Star, Luhman 16, WISE 0855, which
  HYG lacks); the resolved indices are written to `ephemeris.json` → `stars.keys`.
- **Ephemeris**: `{ kind: 'star', key }` → `StarCatalog.state(index, yearsSinceJ2000)`: position = p₀ + v·τ in
  heliocentric ECL km, linear in time (valid for ±10⁵ years; no galactic acceleration). Radial velocity is included,
  so Barnard's Star closes to 3.75 ly around AD 11,740 (`scripts/dev/stars-check.ts`).
- **Rendering**: `StarCloud` keeps positions as doubles and rewrites the float32 attribute only when the origin has
  moved > 1e7 km or time > 0.02 yr (throttled to ~12 Hz), so there is no jitter when parked at a star. The vertex
  shader computes the apparent magnitude *from the camera* (absolute magnitude + distance) for size/alpha; stars
  fainter than 7.2 from the camera are discarded. Catalogued stars are also `SunObject`s (`isSun = false`): the sphere
  (Sun shader with its granule palette `uHot`/`uCool` derived from the star's catalogue colour, so an A star is white-blue and an M dwarf orange-red while the pattern stays Sun-like) appears only when it exceeds 1.5 px,
  and the star's cloud point is hidden meanwhile (`setHidden`). No minimum pixel size for other stars.
- **Labels**: catalogued stars are labelled when brighter than magnitude 3 from the camera (dim above 1.5); the
  brightest uncatalogued named stars (mag < 2.2) get dim labels via `Universe.cloudLabels` (ids `star:<index>`, not
  selectable). Solar System bodies other than the Sun are hidden beyond 4e12 km from the camera.
- **Panorama fade**: the ESO sky sphere's opacity falls from 0.85 to 0.13 between 1e13 and 1e15 km from the Sun (`App.frame`), so the 3D cloud is what you see from the neighbourhood.
- **Deep tier**: loaded once when the camera is > 5e13 km from the Sun or a star is focused, if `settings.deepStars`
  (default on for high quality, off on low; `Settings.applyDefault`). `StarCatalog.append` + `StarCloud.rebuild`.

## Exoplanets (Phase 2, Stage C)

- **Data**: `scripts/build-data.ts` → `loadExoplanetRows` fetches every row of the NASA Exoplanet Archive `pscomppars`
  table (composite parameters; public domain) through its TAP endpoint (cached in `node_modules/.cache/pscomppars.csv`).
  Hosts become rows of `stars.bin`: matched to HYG by HIP, HD, name or Gliese designation (so 51 Peg's planets hang off
  the curated star), otherwise added inline from the archive's RA/Dec/distance/proper motion with a B−V estimated from
  Teff. `exoplanets.json` holds names/hosts/methods; `exoplanets.bin` holds 14 float32 per planet (period, a, e, i, ω,
  periastron and transit epochs as JD − 2450000, transit duration, radius, mass, T_eq, flags). Missing period or
  semi-major axis is derived from the other via Kepler's law with the stellar mass (flag `EXO_A_DERIVED`); missing
  radius from mass (Chen & Kipping-like); missing inclination is 90° for transiting planets, 60° otherwise (flag).
- **Orbit** (`exoplanetState`): conic elements in a sky frame at the host (x = east, y = north, z = toward the Sun),
  Ω = 0 because the node is unmeasured for nearly all systems, ω from the archive. The phase is real when the archive has
  a periastron epoch or a transit midpoint (transit ⇔ ν = 90° − ω); otherwise periastron is placed at J2000 and flagged.
  The mean motion uses the archive period exactly (gm is back-derived from a and P). Position is relative to the host,
  and `Ephemeris.state` adds the host's heliocentric state, so proper motion carries the whole system.
- **Bodies**: `buildExoplanetBodies` registers ~4,700 host `BodyDef`s (unless the host is a curated star) and 6,300
  planet defs at boot (`registerBodies`), all `lazy`: the renderer creates a system's `SunObject` + `BodyObject`s only
  when something in it is selected or focused (`Universe.ensure`). Planet skins: `classify` by radius/temperature into
  lava / rocky / temperate / icy / super-Earth / mini-Neptune / Neptune / hot Jupiter / gas giant, each a procedural skin
  with a per-planet hue variation.
- **Lighting**: exoplanet meshes and a second `PointLight` live on layer `EXO_LAYER`; the light sits at the active host
  (focused or selected system) with the host's colour, so planets are lit by their own star while the Sun's light on
  layer 0 never reaches them. The eclipse shader gets the host as its light source and radius (mutual transits work).
- **Info panel**: class, host, period, a, e, i (flagged when assumed), radius, mass or M sin i, next transit date and
  duration from the archive midpoint, phase/node caveats, discovery method and facility.
- **Search** ranks name-prefix matches first and curated entries above auto-generated ones.

## Deep sky (Phase 2, Stage D)

- **Data**: `scripts/deepsky.ts` lists 90 objects inside the Milky Way (26 emission/H II regions, reflection nebulae,
  7 supernova remnants, 14 planetary nebulae, 3 dark clouds, 17 open and 20 globular clusters). Positions, angular
  sizes, position angles, V magnitudes and constellations come from OpenNGC (NGC.csv + addendum; CC BY-SA 4.0);
  distances are curated in light-years (OpenNGC has none). Objects without an NGC/IC entry (Cas A, Vela SNR, Hyades,
  Westerlund 1…) carry inline coordinates. `npm run data:build -- --only=deepsky` writes `public/data/deepsky.json`.
- **Imagery**: `npm run data:deepsky-images` asks the Wikimedia Commons API for each object (an explicit `File:` or a
  search), accepts only files whose `LicenseShortName` is CC BY, CC BY-SA, CC0 or public domain, prefers ESO / NASA /
  ESA / Hubble credits and large originals, records credit + licence + source page, and downloads a 1024 px thumbnail
  to `public/textures/deepsky/<id>.jpg`, then `scripts/compress-deepsky.py` (Pillow) re-encodes everything as ≤ 1024 px JPEG q82
  (16 s between requests; picks cached in `node_modules/.cache/deepsky-images.json`,
  delete an entry to re-pick). Credits appear in the object's info panel. Photo orientation is as published (north-up
  is not guaranteed) and the position angle is not applied.
- **Rendering** (`DeepSkyObject`): nebulae are a `PlaneGeometry` card whose long side spans the catalogued major axis at
  the object's distance, oriented with its normal toward the Sun and up toward the celestial pole, drawn additively with
  an elliptical vignette so the frame never shows and stars shine through. Opacity = size fade (0.6–3 px apparent
  radius) × viewing-angle fade (0.12 + 0.88 cos²) × a thinning factor when the camera is inside the object. Textures load
  on first visibility. Clusters ≥ 700 ly are a Plummer-profile point cloud (2,600 points globular / 320 open, halved on
  low quality) with a per-star world size so the cloud resolves into stars on approach, plus a core glow for globulars;
  nearer clusters (Hyades, Pleiades, Beehive, Coma, Southern Pleiades, Alpha Persei) are already in the star catalogue
  star by star and get only a faint glow and a label.
- **Bodies**: `buildDeepSkyBodies` registers them at boot with `source: { kind: 'fixed' }`, `radius` = physical
  semi-major axis, type `nebula` or `cluster` (no minimum pixel size); labels appear above 2.5 px apparent radius.
- **Verification**: `scripts/dev/deepsky-check.ts` (positions, Orion at 1.5° from the Sun, licences).

## Compact objects (Phase 2, Stage E)

- **Catalogue** (`src/data/compact.ts`, all inline, no pipeline): 15 black holes (Sgr A*, Cygnus X-1, V404 Cygni,
  GRS 1915+105, A0620-00, XTE J1118+480, GRO J1655-40, MAXI J1820+070, V4641 Sgr, Gaia BH1/2/3, SS 433, Cygnus X-3,
  4U 1543-47), 11 neutron stars (Crab and Vela pulsars, PSR B1919+21, Geminga, PSR J0437-4715, the Hulse–Taylor binary,
  the double pulsar, SGR 1806-20, RX J1856.5-3754, Scorpius X-1, Hercules X-1; PSR B1257+12 is retyped from its exoplanet
  host entry), 4 white dwarfs (Sirius B, Procyon B, 40 Eridani B, Stein 2051 B) and the star S2. Positions are HYG rows
  through star keys where the system is a catalogued star (Cyg X-1 = HDE 226868, Stein 2051 A), otherwise fixed
  RA/Dec/distance. Radii default to the Schwarzschild radius (black holes), 12 km (neutron stars) or 0.012 R☉.
- **Binary orbits** (`src/ephemeris/binary.ts`, source `{ kind: 'binary', el, phaseKnown }`): the companion moves on a
  Kepler orbit about its parent with elements in the visual-binary convention (Ω from north through east, i to the sky
  plane, ω of the companion), sky frame x = north, y = east, z = toward the observer; the parent's heliocentric state is
  added by `Ephemeris.state`. Measured full orbits: Sirius B, Procyon B, Alpha Centauri B (now bound to A instead of a
  free HYG row), S2 about Sgr A*. X-ray binaries and the Gaia black holes have period, masses and inclination from the
  literature; their semi-major axis comes from Kepler's law, node and phase are unmeasured and flagged. 40 Eri B and
  Stein 2051 B get approximate wide circular orbits, flagged.
- **Rendering**: `BlackHoleObject` = black sphere of the shadow radius (exaggerated to `MIN_PX.blackhole` = 4 px in visual
  mode), camera-facing photon ring, and for accreting systems a tilted additive accretion disc (r⁻² brightness, orbiting
  streaks, Doppler asymmetry); a point sprite marks it when small. Neutron stars and white dwarfs are `SunObject`s with a
  minimum pixel size (`def.compact`) and, for pulsars, `PulsarBeams`: two additive cones on a magnetic axis tilted 34°
  from the spin axis, rotating at the spin period but no faster than one turn per 0.35 s for display.
- **Info panel**: type (supermassive / stellar-mass black hole, pulsar / millisecond pulsar / magnetar, white dwarf),
  mass, event-horizon radius, spin, current separation and position angle of binary companions, flags for unmeasured
  node/phase. `scripts/dev/compact-check.ts` verifies Sirius B's separation, S2's 2018 periastron (120 AU, 7,650 km/s) and
  Alpha Cen B's 2035 periastron.

## Galaxy model (Phase 2, Stage F)

- **Parameters** (`src/data/galaxy.ts`): R₀ = 8.15 kpc, Θ₀ = 236 km/s and the seven arm fits of Reid et al. 2019
  (ApJ 885, 131, Table 2: kink azimuth, kink radius, pitch angles on each side, azimuth range, width) — verified against
  the published table; disc scale length 2.6 kpc / height 0.3 kpc, thick disc 2.0 / 0.9 kpc, Hernquist bulge a = 0.7
  kpc, bar half-length 5 kpc at 28° (Bland-Hawthorn & Gerhard 2016); Sun 20.8 pc above the plane. Azimuth β is
  Galactocentric, 0 toward the Sun, increasing with longitude; `galactoToEcl(R, β, z)` maps model coordinates to the
  world frame through the Sun-centred Galactic frame (x̂ → centre, ŷ → l = 90°, ẑ → NGP) and GAL→EQJ→ECL.
- **Model** (`GalaxyModel`, far scene): ~275k additive point sprites (halved on low quality) generated deterministically:
  thin disc (exponential, mild warp beyond 10 kpc), thick disc, bulge, bar, and the arms as Gaussian ribbons weighted by
  arc length with 2.5% pink H II sprites and a dimmer, redder inner (dust-lane) edge. The fits cover only the measured
  azimuths (mostly our side of the Galaxy); each arm is extrapolated 240° further with its outer pitch angle, drawn
  dimmer and without H II regions, so the far side is an informed guess, and brightness tapers toward the centre so the
  bulge does not saturate. Points represent ~20 pc blobs:
  size from that world size (1–5 px), alpha fades to zero within 0.5 kpc of the camera where the real star catalogue
  takes over. The whole model sits in a group at the Galactic centre rotated by the Galactic-frame quaternion, so real
  stars, nebulae and Sgr A* land in the right arms (`scripts/dev/galaxy-check.ts`: Sagittarius arm 1.28 kpc inward,
  Perseus 1.92 kpc outward, centre within 0.1 kpc of Sgr A*).
- **Cross-fade**: model opacity rises from 0 at 10¹⁵ km (~100 ly) from the Sun to 1 at 10¹⁶·⁵ (~1 kpc); the ESO panorama
  fades out between 10¹³ and 10¹⁵ km. Arm labels appear once the model is ≥ 30% visible.
- **Map plane** (setting `galaxyMap`, off by default): the NASA/JPL-Caltech/ESO/R. Hurt artwork (`eso1339g`, 1280 px,
  CC BY 4.0) on a 34 kpc plane in the Galactic plane, image-bottom toward the Sun; scale and orientation approximate.
- **Regions** (`REGIONS`, type `region`, `RegionObject`): heliopause (120 AU shell), Oort cloud (100,000 AU shell), Local
  Interstellar Cloud (ellipsoid), Local Bubble (ellipsoid, Zucker 2022), Gould Belt (ring tilted 20°), Radcliffe Wave
  (Catmull-Rom curve through nine anchors, Alves 2020), plus label-only bodies for the bar and six arms. Shells hide
  while the camera is inside them unless selected. The info panel says "Schematic model, not a measured shape".
- **Galactic time rates**: `RATE_STEPS` gains 100, 1,000 and 100,000 yr/s. Above `FREEZE_RATE` (20 yr/s) Solar System
  bodies are hidden (`Universe.frozen`), the time bar says "planets hidden", and event requests stop beyond ±16,000
  years because astronomy-engine is not valid there. Star proper motions and binary orbits keep running.

