# Development workflow

## Environment

macOS (Apple Silicon), Node 24.14, npm 11.11, Python 3.11 with Pillow + numpy. Headless screenshots use
`playwright-core` driving whichever Chromium-based browser is installed (Edge, Brave, Chrome or Chromium are
probed in that order; `SNAP_BROWSER=/path/to/binary` overrides). As of 2026-09-09 Edge is gone and Brave is
used. The Claude-in-Chrome extension was declined. Machine timezone: US Eastern.

## Everyday loop

```bash
npm run dev                                  # http://localhost:5173  (network: 0.0.0.0)
npx tsc --noEmit                             # typecheck (also part of npm run build)
node scripts/dev/snap.mjs out.png --hash=saturn --wait=18000
node scripts/dev/snap.mjs out.png --mobile --hash=jupiter --wait=18000
node scripts/dev/snap.mjs out.png --wait=16000 --eval="app.settings.set('scaleMode','real'); 1" --after=4000
node scripts/dev/snap.mjs out.png --wait=16000 --eval="window.dispatchEvent(new KeyboardEvent('keydown',{key:'e'})); 1"
node scripts/dev/snap.mjs out.png --wait=18000 --eval="app.jumpTo('galaxy'); 1" --after=6000   # zoom ladder views: system / stars / galaxy
node scripts/dev/snap.mjs out.png --wait=18000 --eval="app.flyTo('sun', 1e15); 1" --after=5000  # any camera distance in km
```

`snap.mjs` prints deduplicated console/worker logs, including full Three.js shader compile errors.
`window.app` (an `App` instance) is exposed in the page; useful members: `app.cam` (CameraController),
`app.universe.bodies.get(id)` (BodyObject), `app.eph` (Ephemeris), `app.clock`, `app.settings`,
`app.flyTo(id, distanceKm?)`, `app.select(id)`.

Under SwiftShader: page boot 10–18 s, ~2 fps, several parallel captures slow each other down. Always use
`--wait ≥ 16000`. Screenshots reflect *local* time on the time bar.

## Verification scripts

```bash
npm test                                     # positions vs JPL Horizons (network)
npx tsx scripts/dev/rotation-check.ts        # Earth sub-solar longitude at Greenwich noon
npx tsx scripts/dev/events-check.ts          # timing + sample of computed events
npx tsx scripts/dev/eclipse-check.ts <epochMs>  # is moon X inside its parent's shadow?
npx tsx scripts/dev/stars-check.ts           # star distances, magnitudes, proper motion, Barnard's closest approach
npx tsx scripts/dev/exoplanets-check.ts      # exoplanet transit geometry, Kepler consistency, host keys
npx tsx scripts/dev/deepsky-check.ts         # deep-sky positions, Orion apparent size, image licences
```

## Data refresh

```bash
npm run data:build                           # everything (≈5 min; Horizons is polite-rate-limited in the script)
npm run data:build -- --only=tle             # fresh ISS/Hubble TLEs (do this most often)
npm run data:build -- --only=moons           # refit moons (20-year arcs around EPOCH_JD)
npm run data:build -- --only=stars           # HYG v4.1 (34 MB) + AT-HYG m10 (28 MB) + Exoplanet Archive (3 MB) downloads, cached in node_modules/.cache; rebuilds stars + exoplanets together
npm run data:textures                        # planet textures; skips files already present
npm run data:deepsky-images [id …]           # Commons imagery for the deep-sky list (slow, ~16 s per object); then data:build -- --only=deepsky
```

Horizons request notes: `REF_PLANE='B'` = parent body equator; `CSV_FORMAT='YES'`; `OUT_UNITS='KM-S'`
(then N is deg/s, GM in km³/s²); spacecraft ranges are clamped automatically from the error text.
SBDB: `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=<designation>&phys-par=1`.

## Adding a body

1. Add a `BodyDef` to `src/data/catalog.ts` (id, name, type, parent, radius, mass, rotationHours,
   color, texture/procedural, `source`, description, facts).
2. Source kinds: `planet` (astronomy-engine name), `moon-ae`, `galilean`, `moon` (needs an entry in the
   `MOONS` list of `scripts/build-data.ts` with its Horizons id, parent centre and period, then
   `--only=moons`), `sbdb` (add to `SMALL_BODIES`, then `--only=smallbodies`), `spacecraft` (add to
   `CRAFT` with segments, then `--only=spacecraft`), `tle` (add to `buildTle`).
3. Rotation: add an IAU model to `src/ephemeris/iau.ts` if one exists; otherwise set `rotationHours`.
4. Run `npm test`; the moon test vectors are generated automatically.

## Adding a star

1. Add the star to `STAR_KEYS` in `scripts/build-data.ts` (`{ hip }`, `{ gl: 'Gl 406' }`, or `{ inline: {...} }` for
   stars HYG lacks) and run `npm run data:build -- --only=stars`.
2. Add a `StarSpec` to `src/data/stars.ts` with the same id (radius in R☉, mass in M☉, temperature, spectral type,
   bolometric luminosity, description, aliases for search).
3. `npx tsx scripts/dev/stars-check.ts`, then `node scripts/dev/snap.mjs out.png --wait=20000 --eval="app.select('<id>'); app.flyTo('<id>'); 1" --after=8000`.

## Adding a deep-sky object

1. Add a line to `DEEP_SKY` in `scripts/deepsky.ts` (OpenNGC name or inline RA/Dec/size, kind, distance in ly, and a
   Commons search phrase or explicit `File:` name).
2. `npm run data:deepsky-images <id>` (checks the licence, downloads 1024 px), then `npm run data:build -- --only=deepsky`.
3. Add a description to `DSO_NOTES` in `src/data/deepsky.ts`; run `npx tsx scripts/dev/deepsky-check.ts`.
   To replace a wrong picture, delete the object's entry in `node_modules/.cache/deepsky-images.json` and the jpg, set an
   explicit `File:` name, and re-run step 2.

## Curating an exoplanet system

Planets and hosts come from the archive automatically; to add hand-written text, add an entry to `PLANET_NOTES`
(keyed by the archive planet name, e.g. `'TRAPPIST-1 e'`) or `HOST_NOTES` (archive host name) in
`src/data/exoplanets.ts`. Body ids are slugs of the archive names (`trappist-1-e`), so
`node scripts/dev/snap.mjs out.png --wait=20000 --eval="app.select('trappist-1-e'); app.flyTo('trappist1'); 1" --after=8000`
shows the system. Hosts with a HIP number attach to the curated star automatically; hosts without one need a line in
`HOST_ALIASES` in `scripts/build-data.ts` if a curated star exists for them.

## Adding a moon texture

1. Find a public-domain global map (NASA PIA, LPI "Global 3-Color Map", USGS mosaics on Wikimedia Commons).
   Query with a descriptive User-Agent; download via
   `https://commons.wikimedia.org/w/index.php?title=Special:FilePath/<File name>&width=4096`; wait 15–20 s
   between requests (rate limiting returns a small HTML error page, ~2 KB).
2. Add a line to `scripts/process-moon-maps.py`: `lpi()` for LPI sheets (auto-crop, roll 180° because they
   are West-longitude with 0° at the right edge), `band()` for partial-latitude mosaics (pads the poles),
   `plain()`/`tinted()` for clean maps. Output: `public/textures/moons/<id>.jpg` at 2048×1024, east
   longitude increasing to the right, 0° at the centre.
3. Set `texture: 'textures/moons/<id>.jpg'` on the body in the catalogue. Keep `procedural` as fallback.
4. Credit the source in README and `SettingsPanel.ts`.

## Style

- TypeScript strict, no unused locals. 2-space indent, single quotes, trailing commas, ~130-column lines.
- Keep modules DOM-free below `src/render` and `src/ui`.
- Comments explain physics/conventions, not mechanics.
- Commit messages: short imperative title, body with the why. Do not commit unless the owner asks.
