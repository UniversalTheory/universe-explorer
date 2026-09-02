# Universe Explorer — guide for AI assistants (Claude Fable / Opus / Sonnet)

Read this first. Deeper material lives in `docs/`:

- `docs/ARCHITECTURE.md` — how the app is put together (frames, ephemeris, rendering, shaders, events, data pipeline)
- `docs/DECISIONS.md` — every product and technical decision made so far, with the reasoning
- `docs/STATUS.md` — what exists in v1, verification results, known issues, prioritised backlog
- `docs/DEV-WORKFLOW.md` — how to run, test, screenshot headlessly, refresh data, add a body or texture

## The project in one paragraph

A real-time, high-fidelity 3D map of the Solar System in the browser (later: the galaxy and beyond).
Every body is placed where it really is at the simulation time, spinning with its true pole and
rotation phase; eclipses and shadows are computed physically; upcoming sky events are predicted.
Fully static site, no backend, free data and assets only, desktop + mobile, minimal "glass" UI.
Owner: the user (GitHub `UniversalTheory`). Repo: https://github.com/UniversalTheory/universe-explorer

## Stack

Vite 6 · TypeScript (strict) · vanilla Three.js r170 (no React) · astronomy-engine · satellite.js.
Node 24, npm 11. Dev server `npm run dev` on port 5173. Data pipeline in `scripts/` runs with `tsx`.
Moon map processing uses Python 3 + Pillow + numpy (already installed on the user's Mac).

## Commands

```
npm run dev            # dev server
npm run build          # tsc --noEmit + vite build -> dist/
npm test               # scripts/verify-ephemeris.ts: compares positions with JPL Horizons (needs network)
npm run data:build     # rebuild public/data from Horizons / SBDB / HYG / Celestrak (-- --only=moons,...)
npm run data:textures  # download planet textures + Milky Way
python3 scripts/process-moon-maps.py <dir> [names]   # moon map sheets -> public/textures/moons
node scripts/dev/snap.mjs out.png --hash=earth --wait=18000 [--mobile] [--eval=js]   # headless screenshot
```

## Non-negotiable conventions

1. **World frame is J2000 ecliptic, kilometres, heliocentric.** Three.js axes are a permutation of
   it: `three = (x, z, -y)` of ECL so ecliptic north is +Y. Helpers in `src/ephemeris/frames.ts`.
   Never invent another frame; convert at the boundary.
2. **All positions come from `src/ephemeris/Ephemeris.ts`** (`state`, `relative`, `orientation`,
   `orbitCurve`, `periodDays`). Rendering and UI must not compute positions themselves.
3. **Time**: the simulation instant is a JS epoch ms (UTC). `makeSimTime(ms)` gives `tt` (days since
   J2000 TT) and `jd`. Ephemeris code takes `SimTime`, not Date. The time bar displays *local* time.
4. **Floating origin**: the focused body sits at the Three.js world origin each frame. Body positions
   are `helio - origin`. Keep double precision (plain number tuples) until the final subtraction.
5. **Ephemeris code must stay DOM-free** (it runs in Node for tests and in the events Web Worker).
6. `public/data` and `public/textures` are generated. Do not hand-edit; change the scripts.
7. Keep `npm test` passing after any change under `src/ephemeris` or `scripts/build-data.ts`.
8. Free/open assets only (public domain, CC BY, CC BY-SA, MIT). Credit new sources in README + settings panel.
9. Product scope decisions are the user's: static-only for now, scale toggle, time scrubber (see
   `docs/DECISIONS.md`). Do not add a backend or paid service unprompted.
10. Commit only when the user asks. Do not deploy to GitHub Pages yet (the user said to hold off).

## Gotchas that cost time before

- Custom vertex shaders must `#include <common>` before `<logdepthbuf_pars_vertex>` (log depth buffer is on).
- `modelMatrix` is not available in fragment shaders; pass what you need as varyings.
- Anything injected into MeshStandardMaterial via `onBeforeCompile` that reads `vMapUv` must be guarded
  with `#ifdef USE_MAP` (textures load asynchronously; the first compile has no map).
- Headless Edge under SwiftShader boots the page in ~10–18 s and renders ~2 fps. Base animations and UI
  timers on wall-clock time, never on accumulated frame `dt`.
- The page clock shows local time (machine is US Eastern). Convert to UTC before reproducing a
  screenshot's geometry in Node. A dark moon can be a real eclipse by its parent; check with
  `npx tsx scripts/dev/eclipse-check.ts <epoch-ms>`.
- Wikimedia Commons rate-limits aggressively. Use a descriptive User-Agent, 15–20 s gaps, and the
  `Special:FilePath/<file>&width=N` thumbnail URL rather than originals.
- Horizons: `REF_PLANE='B'` (body equator), CSV output, `TLIST` for single instants; spacecraft span errors
  say "prior to A.D. …" / "after A.D. …" and the pipeline clamps on them automatically.
