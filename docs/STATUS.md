# Status — first build (2026-09-02)

## Delivered in v1

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

## Known issues and limitations

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

## Backlog (suggested priority)

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
- Zoom out: nearby stars with real distances (HYG has parallaxes), exoplanet systems, then the Milky Way
  structure and beyond. Needs a hierarchical coordinate system (heliocentric km → parsecs) and streamed data
  from a CDN rather than the Pages bundle.
