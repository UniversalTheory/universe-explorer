/**
 * Binary-orbit checks for compact objects: Sirius B's separation, S2's periastron
 * distance and date, Alpha Centauri B's next periastron.
 *   npx tsx scripts/dev/compact-check.ts
 */
import { apparentSeparation, binaryElements, binaryState } from '../../src/ephemeris/binary';
import { AU_KM, PC_KM } from '../../src/ephemeris/frames';
import { vlen } from '../../src/core/math3';

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) fails++; console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? '  ' + detail : ''}`); };
const jd = (year: number) => 2451545.0 + (year - 2000) * 365.25;

// Sirius B (Bond et al. 2017): apastron ~11.3" around 2019–2022, ~10.5" in 2026, periastron 2044.
const sirB = binaryElements({ years: 50.1284, arcsec: 7.4957, distPc: 2.6371, e: 0.59142, i: 136.336, node: 45.4, argp: 149.161, tpYear: 1994.5715 });
const s26 = apparentSeparation(sirB, 2.6371 * PC_KM, jd(2026.7));
check('Sirius B separation in 2026 ≈ 10–11.5″', s26.rho > 9.5 && s26.rho < 11.6, `${s26.rho.toFixed(2)}″ PA ${s26.theta.toFixed(0)}°`);
const s44 = apparentSeparation(sirB, 2.6371 * PC_KM, jd(2044.7));
check('Sirius B periastron 2044 ≈ 3″', s44.rho < 3.5, `${s44.rho.toFixed(2)}″`);
// S2 around Sgr A* (GRAVITY 2020): periastron May 2018 at ~120 AU, ~7,650 km/s.
const s2 = binaryElements({ years: 16.046, arcsec: 0.12497, distPc: 8178, e: 0.88466, i: 134.567, node: 228.171, argp: 66.263, tpYear: 2018.379 });
const dir: [number, number, number] = [1, 0, 0];
let best = Infinity, bestYear = 0, vAt = 0;
for (let y = 2017; y < 2020; y += 0.002) { const st = binaryState(s2, dir, jd(y)); const d = vlen(st.pos); if (d < best) { best = d; bestYear = y; vAt = vlen(st.vel); } }
check('S2 periastron distance ≈ 120 AU', Math.abs(best / AU_KM - 120) < 8, `${(best / AU_KM).toFixed(1)} AU`);
check('S2 periastron in 2018.38', Math.abs(bestYear - 2018.38) < 0.02, `${bestYear.toFixed(3)}`);
check('S2 periastron speed ≈ 7,650 km/s', Math.abs(vAt - 7650) < 400, `${vAt.toFixed(0)} km/s`);
// Alpha Centauri B: periastron 1955.57 → next 2035.5 at 11.2 AU (a(1−e) = 23.3 × 0.482).
const acen = binaryElements({ years: 79.91, arcsec: 17.57, distPc: 1.3248, e: 0.5179, i: 79.205, node: 204.85, argp: 231.65, tpYear: 1955.57 });
let bMin = Infinity, bYear = 0;
for (let y = 2030; y < 2040; y += 0.01) { const d = vlen(binaryState(acen, dir, jd(y)).pos); if (d < bMin) { bMin = d; bYear = y; } }
check('Alpha Cen B next periastron ≈ 2035.5 at 11.2 AU', Math.abs(bYear - 2035.5) < 0.2 && Math.abs(bMin / AU_KM - 11.2) < 0.5, `${bYear.toFixed(2)}, ${(bMin / AU_KM).toFixed(1)} AU`);
const a26 = apparentSeparation(acen, 1.3248 * PC_KM, jd(2026.7));
check('Alpha Cen A–B separation in 2026 (≈ 9″, closing)', a26.rho > 6 && a26.rho < 12, `${a26.rho.toFixed(1)}″`);
console.log(fails ? `\n${fails} check(s) failed` : '\nall compact-object checks passed');
process.exit(fails ? 1 : 0);
