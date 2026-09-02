# Decision log

Dates are 2026-09-02 unless noted. "User" = the project owner. Decisions marked **(user)** were made
explicitly by the owner and should not be reversed without asking.

## Product

| # | Decision | Rationale |
| --- | --- | --- |
| P1 **(user)** | Real distances and sizes are ground truth, with a "Readable" toggle that enforces a minimum on-screen size for bodies (default) and a "True scale" mode. Distances are never compressed. | Scientific accuracy first; pure true scale is unusable at overview zoom. |
| P2 **(user)** | The clock opens at real "now" and tracks it live; users can pause, run at preset speeds forwards or backwards, pick a date, and jump to events; one tap returns to live. | Previewing eclipses/alignments requires time travel. |
| P3 **(user)** | v1 body scope: Sun, 8 planets, ~23 major moons, dwarf planets, visual belts, spacecraft, comets. | Owner chose the largest option. |
| P4 **(user)** | Fully static and offline-capable now; a serverless proxy for live JPL Horizons data is a future backlog item, not part of v1. | Zero hosting cost, no runtime dependency. |
| P5 **(user)** | Free technologies and assets only. | Owner constraint. |
| P6 **(user)** | Full-window canvas, minimal transparent glass UI, desktop and mobile. | Owner brief. |
| P7 **(user)** | GitHub repo created public under `UniversalTheory`; GitHub Pages deployment deferred ("hold off for now"). | Owner asked to wait. |
| P8 | Fly-to lands on the sunlit side of the target. | A body seen from the night side looks broken to a user. |
| P9 | Minor bodies and spacecraft draw their orbit/trajectory only when selected or focused; planets, dwarfs and (when large enough on screen) moons always. | The overview was unreadable with ~50 orbit lines. |
| P10 | Info panel shows "In X's shadow right now (eclipsed)" when a moon is eclipsed by its parent. | A correctly rendered eclipse otherwise looks like a bug. |

## Technical

| # | Decision | Rationale / alternatives rejected |
| --- | --- | --- |
| T1 | Vite + TypeScript + vanilla Three.js; no React/R3F. | Tight control over floating origin, log depth, shader patching; UI is small enough for plain DOM. |
| T2 | World frame = J2000 ecliptic, km, heliocentric; Three axes = (x, z, −y). | Ecliptic north as "up" makes the solar system look flat and natural; astronomy-engine/IAU/stars are converted at the boundary. |
| T3 | Floating origin at the focused body; positions kept in double precision until subtraction. | Float32 in Three loses precision at 1e9 km; this keeps the ISS and Neptune both exact. |
| T4 | astronomy-engine for planets/Moon/Galileans; baked data for everything else. | Best free in-browser ephemeris; no runtime network. |
| T5 | Other moons: mean elements fitted to 20 years of Horizons osculating elements in a fitted Laplace frame, with a quadratic mean-longitude term. | A first attempt (linear elements in the parent's IAU frame, 2-year fit) failed for Phobos (8%), Mimas (25%), Enceladus, Miranda because of Laplace-plane offset and resonance libration. Dense Horizons sampling (Chebyshev/SPICE-like) rejected as too much data for v1. |
| T6 | Small bodies from SBDB osculating elements with two-body propagation, including hyperbolic and parabolic cases. | Simple and adequate (≈0.5–1%); improvement path: Horizons elements at a recent epoch or perturbed integration. |
| T7 | Spacecraft as baked Horizons state vectors with Hermite interpolation, adaptive step (dense during encounter years). | Exact where it matters, ~1 MB total. |
| T8 | ISS/Hubble via bundled TLE + SGP4; TEME treated as equator-of-date. | Only viable static approach; goes stale in weeks (documented). |
| T9 | IAU WGCCRE rotation models hand-coded for ~40 bodies; bodies without a model spin about the ecliptic pole at their known period. | Verified: Earth's sub-solar longitude 0.01° at Greenwich noon. |
| T10 | Eclipse/shadow computation in the fragment shader (disc-overlap approximation with up to 6 occluders per body) rather than shadow maps. | Shadow maps cannot span solar-system distances; the analytic approach gives penumbrae and works at any scale. |
| T11 | Visual-scale exaggeration by scaling meshes to a minimum apparent radius; physical radii used for lighting, eclipse geometry and camera clamps. | Keeps physics honest while readable. A fixed multiplier was rejected (moons would sit inside enlarged planets at all zooms). |
| T12 | Belts as GPU-propagated Keplerian particles with random elements. | Cheap, moves correctly with time. |
| T13 | Starfield in a separate rotation-only scene; HYG catalogue (mag ≤ 6.5, ~9,000 stars) as binary; ESO panorama in galactic coordinates. | Avoids depth/precision issues; real sky for the later galaxy phase. |
| T14 | Events computed in a Web Worker from the simulation time, 3-year horizon. | Keeps the main thread smooth; 0.2 s per compute. |
| T15 | All UI timers and camera transitions use wall-clock time, not frame dt. | Headless testing runs at ~2 fps; also robust to hiccups on real devices. |
| T16 | Textures: Solar System Scope 2K by default, 8K streamed on zoom; moon maps processed from public-domain NASA/LPI/USGS sheets; procedural fallback for the rest. | Free licences only; bandwidth-conscious. |
| T17 | Textures and baked data are committed to the repo (≈90 MB). | Clone-and-run simplicity. Revisit if repo history grows (move textures to CI download). |
| T18 | Headless visual testing via `playwright-core` driving the installed Microsoft Edge (`scripts/dev/snap.mjs`). | User declined the Chrome extension; no Chromium installed; plain headless Edge hung on the animation loop. |
| T19 | Hosting analysis: GitHub Pages is free and sufficient for v1 (site 93 MB, limits 1 GB / 100 GB per month); the future Horizons proxy would live on Cloudflare Workers or Vercel functions; large galaxy data would go to an object store/CDN. | Documented for the owner; deployment deferred (P7). |
