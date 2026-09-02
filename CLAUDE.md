# Universe Explorer — notes for AI assistants

- Vite + TypeScript + vanilla Three.js. No framework. `npm run dev` on port 5173.
- World frame is J2000 **ecliptic**, km, heliocentric; Three axes are (x, z, -y) of that frame so ecliptic north is +Y.
- Positions come from `src/ephemeris/Ephemeris.ts` (`state`, `relative`, `orientation`, `orbitCurve`). Never compute positions elsewhere.
- Everything in `public/data` and `public/textures` is generated (`npm run data:build`, `npm run data:textures`). Do not hand-edit.
- `npm test` verifies the ephemeris against JPL Horizons (needs network). Keep it passing after touching `src/ephemeris`.
- Headless visual check: `node scripts/dev/snap.mjs out.png --hash=earth --wait=18000` (uses the installed Microsoft Edge via playwright-core; frames are slow under SwiftShader, so allow long waits). `window.app` is exposed for `--eval`.
- Body catalogue and facts live in `src/data/catalog.ts`; adding a body = catalogue entry + (if needed) an entry in `scripts/build-data.ts` lists.
