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
| `src/ephemeris/frames.ts` | EQJ↔ECL, GAL→EQJ, ECL→Three, AU/GM constants |
| `src/ephemeris/kepler.ts` | Kepler solvers (elliptic/parabolic/hyperbolic), conic state, orbit sampling |
| `src/ephemeris/iau.ts` | IAU WGCCRE pole/prime-meridian models for ~40 bodies; `bodyPole`, `bodyFixedToEqj`, `poleFrameToEqj` |
| `src/ephemeris/planets.ts` | astronomy-engine wrappers (planets, Moon, Galilean moons), GM table |
| `src/ephemeris/moons.ts` | fitted mean elements → state (Laplace frame → parent pole → EQJ → ECL) |
| `src/ephemeris/smallbodies.ts` | SBDB conic elements → heliocentric state |
| `src/ephemeris/spacecraft.ts` | `Trajectory`: binary state-vector file + cubic Hermite interpolation |
| `src/ephemeris/tle.ts` | SGP4 via satellite.js, TEME→EQJ→ECL |
| `src/ephemeris/stars.ts` | `StarCatalog`: star positions + space velocities from `stars.bin`, linear motion in time; B−V colour helper |
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

