/**
 * Galaxy-model checks: arm distances along the Sun–centre line against known values,
 * the model centre against Sgr A*, and the frame orientation.
 *   npx tsx scripts/dev/galaxy-check.ts
 */
import { ARMS, armRadius, galactoToEcl, galacticToEcl, R0_KPC } from '../../src/data/galaxy';
import { EQJ_TO_ECL, KPC_KM, LY_KM, raDecToVec } from '../../src/ephemeris/frames';
import { mapply, vdot, vlen, vnorm, vsub } from '../../src/core/math3';

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) fails++; console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? '  ' + detail : ''}`); };
const arm = (id: string) => ARMS.find((a) => a.id === id)!;
const d0 = (id: string) => R0_KPC - armRadius(arm(id), 0);   // kpc from the Sun toward the centre (negative = away)
check('Sagittarius–Carina arm ≈ 1.3 kpc toward the centre (Lagoon / Trifid at 1.26 kpc)', Math.abs(d0('arm-sagittarius') - 1.28) < 0.15, `${d0('arm-sagittarius').toFixed(2)} kpc`);
check('Perseus arm ≈ 1.9 kpc away from the centre (Double Cluster at 2.3 kpc)', Math.abs(d0('arm-perseus') + 1.92) < 0.2, `${(-d0('arm-perseus')).toFixed(2)} kpc`);
check('Local arm passes just outside the Sun', d0('arm-local') < 0 && d0('arm-local') > -0.8, `${(-d0('arm-local')).toFixed(2)} kpc`);
check('Scutum–Centaurus arm ≈ 3 kpc toward the centre', Math.abs(d0('arm-scutum') - 3.1) < 0.5, `${d0('arm-scutum').toFixed(2)} kpc`);
// Model centre vs Sgr A* (RA 266.417, Dec −29.008, 8.178 kpc).
const gc = galactoToEcl(0, 0, 0);
const sgra = mapply(EQJ_TO_ECL, raDecToVec(266.41683, -29.00781)).map((x) => x * 8.178 * KPC_KM) as [number, number, number];
check('Model centre within 0.1 kpc of Sgr A*', vlen(vsub(gc, sgra)) / KPC_KM < 0.1, `${(vlen(vsub(gc, sgra)) / KPC_KM).toFixed(3)} kpc`);
check('Model centre is 8.15 kpc from the Sun', Math.abs(vlen(gc) / KPC_KM - R0_KPC) < 0.01, `${(vlen(gc) / KPC_KM).toFixed(3)} kpc`);
// Frame: l = 90° should be perpendicular to l = 0, and b = 90 toward the north Galactic pole (RA 192.86, Dec +27.13).
const l90 = vnorm(galacticToEcl(90, 0, KPC_KM)), l0 = vnorm(galacticToEcl(0, 0, KPC_KM));
check('l = 0 and l = 90 are perpendicular', Math.abs(vdot(l0, l90)) < 1e-6);
const ngp = vnorm(galacticToEcl(0, 90, KPC_KM)), ngpRef = vnorm(mapply(EQJ_TO_ECL, raDecToVec(192.8595, 27.1283)));
check('North Galactic pole direction', vdot(ngp, ngpRef) > 0.99999, `cos = ${vdot(ngp, ngpRef).toFixed(6)}`);
// Azimuth sense: β = +30° must lie toward positive longitude (l > 0 side).
const p30 = galactoToEcl(4, 30, 0);
check('β increases with Galactic longitude', vdot(vnorm(p30), l90) > 0);
check('Orion Nebula sits in / near the Local arm (1,344 ly from the Sun)', Math.abs(armRadius(arm('arm-local'), -2.5) - (R0_KPC + 0.4)) < 0.6, `arm R at β=−2.5° = ${armRadius(arm('arm-local'), -2.5).toFixed(2)} kpc`);
console.log(`(1 kpc = ${(KPC_KM / LY_KM).toFixed(0)} ly)`);
console.log(fails ? `\n${fails} check(s) failed` : '\nall galaxy checks passed');
process.exit(fails ? 1 : 0);
