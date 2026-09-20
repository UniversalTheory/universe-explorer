# Status

## v1 — Solar System (2026-09-02)

*The v1 notes below are kept as written; Phase 2 follows.*

### Delivered in v1

- ~80 bodies: Sun, 8 planets, 23 moons, 9 dwarf planets, 8 asteroids, 10 comets, 2 interstellar objects,
  9 deep-space probes, ISS, Hubble. See `src/data/catalog.ts` for the exact list and facts.
- Real textures: all planets (2K + 8K), Moon, Ceres/Eris/Haumea/Makemake (artist maps from Solar System
  Scope), and processed public-domain maps for Io, Europa, Callisto, Mimas, Enceladus, Tethys, Dione, Rhea,
  Titan (tinted grayscale), Iapetus, Triton. Procedural: Ganymede, Uranian moons, Phobos, Deimos, Proteus,
  Nereid, Charon, Pluto, asteroids, comets, Sedna/Gonggong/Quaoar/Orcus.
- Physics: IAU rotation, eclipse/shadow shaders, ring shadows both ways, Earth night lights and clouds,
  atmospheres, comet tails, GPU belts, real stars + Milky Way.
- Time controls, events panel with ~110 predicted events over 3 years, search, info panel with live facts,
  settings (scale mode + layer toggles), mobile layout, keyboard shortcuts, URL hash deep links.
- Verification: `npm test` passes (all moons < 1% except Miranda 2.7%; planets/Moon/Galileans/spacecraft
  ≈ 0.001–0.01%). Earth rotation verified. Enceladus eclipse by Saturn observed in a screenshot and
  confirmed geometrically.
- Production build: 194 KB gzipped JS + 97 KB worker; site ≈ 93 MB with textures.
- Repo: https://github.com/UniversalTheory/universe-explorer (public, `main`). Not deployed.

### Known issues and limitations (v1)

1. **Data freshness**: ISS/Hubble TLEs stale within weeks; spacecraft spans end 2029 (Psyche, Parker),
   2031 (JWST), 2034 (Europa Clipper), 2050–2070 (others); moon fits best 2016–2036; SBDB elements are
   osculating at one epoch. Re-run `npm run data:build` periodically.
2. **Miranda** residual error up to 2.7% (periodic perturbations not modelled).
3. **Comet tails** exist but no bundled comet is currently within 4.5 AU, so they are untested visually.
4. **Moon map longitude conventions** for Io/Europa/Callisto/Titan were inferred (Io verified via Pele's
   position; others assumed West-longitude sheets rolled by 180°). Titan's map is a tinted grayscale
   ISS mosaic with unmapped grey patches.
5. **Procedural textures** are obviously synthetic up close (Ganymede especially).
6. **No real GPU testing yet**: everything was verified through headless SwiftShader screenshots. Real
   device performance, touch feel, and 8K texture memory on phones are unverified.
7. **Labels** can overlap the info panel on desktop; declutter is greedy by priority only.
8. **Events**: alignment detection is heuristic; meteor shower dates are fixed calendar dates; no local
   (observer) visibility; solar eclipse entries give only the point of greatest eclipse.
9. **Sun**: no limb-accurate size in visual mode (min 9 px); corona is a billboard.
10. **Saturn's rings** have no self-shadow structure/gaps beyond the alpha texture; no other planets' rings.
11. The Moon's phase-dependent brightness and Earthshine are not modelled.
12. Uranus/Neptune moon textures unavailable in the public domain at usable resolution (only partial Voyager coverage).

### v1 backlog (still open unless noted)

**Near term**
- Real-device QA pass (desktop GPU, iPhone/Android): frame rate, pinch/rotate feel, 8K memory. Add a
  quality setting that caps textures at 2K on mobile.
- GitHub Pages deploy workflow (deferred by the owner until asked).
- Observer mode: user location → sky view, local eclipse circumstances (`SearchLocalSolarEclipse`), rise/set.
- More moons (Amalthea, Hyperion, Phoebe, Nix/Hydra…) and named asteroids; Ganymede/Uranian moon maps if a free source appears.
- Time scrubber slider and "jump to next eclipse" quick actions; UTC display alongside local time.
- Better Sun close-up (prominences, corona shader) and lens flare.

**Medium term**
- Serverless proxy (Cloudflare Worker) for live TLEs and on-demand Horizons queries (owner-approved future item).
- Higher-fidelity small-body propagation (Horizons elements at current epoch, or n-body with planets).
- Trajectory previews for future missions (Dragonfly, Artemis) once Horizons has them.
- Shareable views (URL encodes time + camera).

**Long term (owner's vision)**
- ~~Zoom out: nearby stars with real distances, exoplanet systems, then the Milky Way structure~~ — delivered in
  Phase 2 (below), inside the Pages bundle and with km kept as the unit. Beyond the Milky Way remains future work.


## Phase 2 — Milky Way (2026-09-09)

Scope and decisions: `DECISIONS.md` P11–P16, T20–T31. Stages A–F are built, verified and pushed (commits c97d528,
dd61c1c, 8beb44b, 61cb099, 2300644). **Stage G started on 2026-09-20 with the owner's approval, performance first**
(P16); the performance items below are done, the rest of Stage G is still open.

### Delivered (Stages A–F)

| Stage | What exists | Verification |
| --- | --- | --- |
| A · Foundations | km kept as the world unit with `WORLD_UNIT_KM` as the future hook; far plane 1e19 km, camera cap 2e18 km, distance-scaled wheel zoom; zoom ladder (Solar System / Stars / Galaxy, keys 1–3); scale bar with km → AU → ly → pc → kpc; light-year formatting; orbit lines hidden when sub-pixel; point-sprite Sun glow at stellar distances; catalogue kinds for the later stages | screenshots 1e13–1e18 km, `npm test` |
| B · Stars | 108k stars (HYG v4.1) in 3D with proper motion + radial velocity, 221k-star deep tier (AT-HYG) on demand, magnitude-from-camera sizing, star spheres coloured by spectral type handing over to points, 116 curated stars with facts and aliases, star rows in the info panel, panorama fade with distance | `scripts/dev/stars-check.ts` |
| C · Exoplanets | 6,325 planets / 4,741 hosts (NASA Exoplanet Archive) on Kepler orbits in the sky frame with real phases from transit / periastron epochs, next-transit dates, lazy systems, own-star lighting on a render layer, procedural skins by class, ~90 curated write-ups, ranked search | `scripts/dev/exoplanets-check.ts` |
| D · Deep sky | 90 nebulae / remnants / planetary nebulae / dark clouds / clusters (OpenNGC + curated distances), 49 licence-checked Commons photographs (9.5 MB) on additive sky-plane cards in a far scene (unit 1e9 km), Plummer point clouds for clusters, per-object credits | `scripts/dev/deepsky-check.ts` |
| E · Compact objects | 15 black holes, 11 neutron stars, 4 white dwarfs, S2; binary-orbit ephemeris (Sirius B, Procyon B, Alpha Cen B bound to A, S2 around Sgr A*; X-ray binaries with flagged unknowns); black-hole shadow / photon ring / accretion disc, pulsar beams | `scripts/dev/compact-check.ts` |
| F · Galaxy | ~300k-point disc / bulge / bar / arm model from Reid et al. 2019 (verified against the published table) in the far scene, cross-fade with the panorama, optional artwork map plane, schematic regions (heliopause, Oort cloud, Local Interstellar Cloud, Local Bubble, Gould Belt, Radcliffe Wave) and arm labels, galactic time rates with the Solar System hidden | `scripts/dev/galaxy-check.ts` |

Numbers (2026-09-20): site ≈ 116 MB built (data 15 MB, textures 96 MB); main bundle 827 KB (245 KB gzipped),
events worker 70.6 KB, galaxy worker 5 KB. Boot fetches ephemeris.json, stars.bin (4.5 MB) and deepsky.json;
the exoplanet catalogue (1.06 MB), the galaxy model, the deep star tier (8.8 MB), nebula photos and the galaxy map
all load after boot or on demand. `npm run check` runs all five check scripts; `npm test` still compares the Solar
System against Horizons; `node scripts/dev/boot-profile.mjs` reports what boot costs.

### Stage G · performance (done 2026-09-20)

| Change | Effect | How it was measured |
| --- | --- | --- |
| Galaxy model generated in a Web Worker (`galaxy-gen.ts` + `galaxy.worker.ts`), requested at first idle or when the camera passes 1e14 km | `new Universe(eph, 'high', 1)` 175 ms → 53 ms; 300k points now cost the main thread nothing | three runs of each, same page, generation stashed in and out (`scripts/dev/boot-profile.mjs`) |
| Exoplanet catalogue fetched after boot (`Ephemeris.loadExoplanets`) instead of inside `Ephemeris.load` | 1.06 MB off the boot path; search, the PSR B1257+12 retype and `#planet` deep links catch up when it arrives | deep link `#trappist-1-e`, exoplanet search and the pulsar's info panel verified headlessly |
| Events worker takes its tables from `src/data/event-tables.ts`, not `catalog.ts` | worker bundle 141.2 KB → 70.6 KB | `npm run build` |

Arm colours in the worker are converted sRGB → linear by hand; verified bit-identical to the `THREE.Color`
conversion they replaced, so the model renders exactly as before.

Wall-clock boot time is *not* a useful check here: under headless SwiftShader it is dominated by an 8-second
GL-setup long task that swamps a 122 ms saving. Measure the constructor, or main-thread long tasks, instead.

### Known issues and limitations (Phase 2)

Honesty flags shown in the app are listed here so nobody mistakes a model for a measurement.

1. **Stars**: 204 naked-eye stars have no usable parallax in HYG and sit at 1,000 pc (flagged in the panel). Star
   spheres reuse the Sun's surface pattern, recoloured. Proper motion is linear (no Galactic acceleration), fine
   to ±100,000 years. Labels for uncatalogued companions use a luminosity estimate.
2. **Exoplanets**: the node angle on the sky is unmeasured for nearly all systems and drawn at 0°; non-transiting
   planets without a periastron epoch get an arbitrary phase (both flagged). Circumbinary planets orbit the archive's
   single host position; radii come from mass where unmeasured; 28 hosts (35 planets) without a distance are omitted.
   Hosts are lit by one point light (the active system only).
3. **Deep sky**: photographs are flat cards in the plane of the sky, thinning to a glow off-axis; orientation is as
   published (not rotated to the position angle). Kepler's SNR has no acceptable photo (drawn as a glow); the Heart and
   Soul share a wide-field photo; Trifid, Pacman and the Southern Ring use infrared / composite images. Cluster clouds
   are statistical. Distances are literature values rounded to 2–3 figures.
4. **Compact objects**: X-ray binaries and the Gaia black holes have unmeasured node/phase (flagged); 40 Eri B and
   Stein 2051 B have approximate orbits; pulsar beams are slowed to one turn per 0.35 s; no gravitational lensing of
   background stars; minimum pixel sizes for compact objects apply only within 300 ly.
5. **Galaxy**: a statistical model with no dust extinction; the arms are extrapolated beyond the measured azimuths
   (dimmer); the bar, warp and bulge are schematic; the artwork map's scale and orientation are approximate; regions
   are simple shells and curves; at galactic time rates the Solar System is hidden rather than propagated. The bulge is
   still bright at the Galaxy zoom level.
6. **Rendering**: two SwiftShader failure modes were found and worked around (world-sized quads beyond ~1e14 km
   rasterise as bow-ties / flat fills; hence point-sprite glows and the far scene). Real-GPU behaviour is unverified.
7. **Performance (unmeasured on devices)**: the galaxy model and the exoplanet catalogue are off the boot path and
   the events worker no longer carries the catalogue (Stage G, above). The star cloud is still built at boot, which
   measures 4 ms and is not worth moving. Nothing here has been measured on a real GPU or a phone.
8. **UI**: labels can overlap panels and each other in dense views (arm labels near the bulge, cluster labels through
   foreground spheres); search shows up to 12 results without grouping; the time bar has no year-only display for
   dates far from now; deep-sky and exoplanet layers have no loading indicator.

### Stage G — polish (in progress)

Performance is done (above). Still open:

- **Real-device QA**: desktop GPU, iPhone and Android: frame rate at each ladder step, pinch/rotate feel, memory with 8K
  planet textures plus the galaxy and star clouds. Decide the low-quality tier (already: halved galaxy/cluster points,
  deep tier off): add 2K-texture cap and optional galaxy-off on low-end devices.
- ~~**Performance**~~ — done 2026-09-20, see the table above.
- **Visual polish**: tame the bulge; dust lanes; better hot-star surfaces; apply position angles to nebula cards
  where the photo is north-up; replace the infrared / composite / missing nebula photos; label occlusion by
  foreground spheres; arm-label placement.
- **UI**: group search results by kind; loading indicators for on-demand layers; year display and a "jump to
  event" for S2's 2034 periastron, Alpha Cen B's 2035 periastron, Sirius B's 2044 periastron; a credits page listing
  every photograph.
- **Docs and tooling**: this file, README, ARCHITECTURE, DECISIONS, CLAUDE.md final pass; `npm run check` in a GitHub
  Actions workflow (typecheck + checks; `npm test` needs network); data-refresh cadence (stars/exoplanets monthly,
  TLEs weekly).
- **Deploy**: GitHub Pages workflow remains deferred by the owner (P7).

### Backlog beyond Phase 2

- Observer mode (sky from a location, rise/set, local eclipses) — from v1.
- Serverless proxy for live TLEs / Horizons — owner-approved future item (P4).
- More Solar System moons and named asteroids; real moon maps where free sources appear.
- Beyond the Milky Way: Magellanic Clouds, Andromeda, the Local Group and the large-scale structure. Needs the
  `WORLD_UNIT_KM` tier switch (positions beyond ~1e19 km overflow float32 lengths) and streamed data from a CDN.
- Lensing shader for black holes; volumetric nebulae for a handful of well-mapped objects; dust extinction in the
  galaxy model; the Sun's orbit around the Galaxy at galactic rates.
