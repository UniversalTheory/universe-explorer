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
| T20 | **Phase 2 (Milky Way) keeps km as the world unit.** Positions relative to the floating origin stay < 1e18 km inside the Galaxy, so squared float32 lengths stay < 1e36. `WORLD_UNIT_KM` in `frames.ts` (= 1) is the single hook for the extragalactic phase, where a larger unit will be needed. Camera far plane 1e19 km, max camera distance 2e18 km (2026-09-09). | A full unit-tier system now would touch radii, camera distances and shader constants for no present benefit. |
| T21 | Star data comes only through HYG / AT-HYG (CC BY-SA 4.0), never the Gaia archive directly (2026-09-09). | Gaia data is CC BY-NC 3.0 IGO (non-commercial), which conflicts with P5. HYG/AT-HYG redistribute Gaia DR3 distances under CC BY-SA. |
| T22 | The Sun's glow is a pixel-sized point sprite whenever the Sun is small on screen, and a world-sized quad only close up (2026-09-09). | A camera-facing quad at > ~1e14 km rasterised as a bow-tie under SwiftShader (corners collapsed); a single-vertex point sprite has no large triangle to interpolate. The same pattern will be used for stars. |
| T23 | Headless screenshots use whichever Chromium-based browser is installed (Edge, Brave, Chrome, Chromium; `SNAP_BROWSER` overrides) (2026-09-09). | Edge was uninstalled; Brave is present. |
| T24 | **Far scene**: deep-sky cards, the galaxy model and schematic regions render in a second scene whose unit is 1e9 km (`FAR_UNIT_KM`), drawn before the main scene with its own camera and a depth clear (2026-09-09). | World-sized quads at 1e16–1e18 km rasterised as flat fills under SwiftShader (the Stage A bow-tie again); a smaller unit keeps GPU coordinates sane without touching the main scene's km convention. Objects there are always behind Solar System bodies in practice. |
| T25 | Exoplanet systems are **lazy** bodies (registered at boot for search, meshes on demand) and are lit by their own host through a second point light on render layer 1; the Sun's light stays on layer 0 (2026-09-09). | 4,700 systems cannot have meshes at boot; Three.js lights cannot be restricted per object except by layers. |
| T26 | Deep-sky imagery comes from Wikimedia Commons, chosen per object and **licence-checked through the Commons API** (CC BY / CC BY-SA / CC0 / public domain only), credited per object in the panel, re-encoded to ≤ 1024 px JPEG (2026-09-09). Photos are additive cards in the plane of the sky, fading off-axis. | Verifiable licences with zero manual bookkeeping; a photo is only right from our line of sight, so the card says so by fading. Manual `File:` overrides fix wrong picks. |
| T27 | The galaxy is a **model labelled as such**: Reid 2019 arm fits (verified against the published table) extrapolated beyond the measured azimuths and drawn dimmer there; bar / bulge / warp schematic; the artwork map plane off by default and described as approximate; region shells say "Schematic model, not a measured shape" (2026-09-09). | The Galaxy's far side is unmeasured; the owner's rule is that real positions are ground truth and models are declared. |
| T28 | Compact objects get a minimum pixel size only within 300 ly of the camera; beyond that a point glow marks them (2026-09-09). | With the size floor applied everywhere, accretion discs and pulsar beams scaled to kiloparsecs in the Galaxy view. |

## Phase 2 — Milky Way (2026-09-09)

Owner decisions taken when the phase was planned (plan page kept outside the repo; summary here):

| # | Decision | Rationale |
| --- | --- | --- |
| P11 **(user)** | Scope: everything inside the Milky Way — real 3D stars with proper motion, all confirmed exoplanets (plus ~40 curated systems), nebulae and clusters as image cards / point clouds, black holes and neutron stars, interstellar visitors and outbound probes extended past their data spans, the heliopause / Oort cloud / Local Bubble as schematic regions, and a procedural galaxy model (disc, bar, arms from Reid et al. 2019) with the ESO/NASA/JPL-Caltech/R. Hurt artwork as an optional map plane. | Owner chose the full recommended scope. |
| P12 **(user)** | Stars: a bundled standard tier (HYG, ~115k stars with distances) plus an on-demand deep tier (AT-HYG mag < 10, ~330k), off by default on mobile. | Density out to ~1 kpc without a 10 MB boot download. |
| P13 **(user)** | Build order A→G: foundations, 3D stars, exoplanets, deep sky, compact objects, galaxy model, polish/docs. Each stage ships a working app. | Dependencies: the galaxy model needs the star cloud and galactic time rates. |
| P14 **(user)** | Galactic time rates (1,000 and 100,000 yr/s) will be enabled with Solar System bodies frozen at those rates; hosting stays inside the GitHub Pages bundle (≈ +22 MB) for this phase. | Solar System ephemerides are not valid over millennia; the bundle is well under Pages limits. |
| P15 **(user)** | Stages A–F were reviewed as they landed and each committed on the owner's word; **Stage G (polish) does not start until the owner has reviewed A–F and approves** (2026-09-09). | Owner wants to go through everything before the polish pass. |
