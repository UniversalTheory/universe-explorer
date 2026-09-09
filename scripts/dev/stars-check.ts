/**
 * Sanity checks for the star catalogue: distances, apparent magnitudes recomputed from
 * absolute magnitude, proper motion over millennia, and the closest approach of a star.
 *   npx tsx scripts/dev/stars-check.ts
 */
import { readFileSync } from 'node:fs';
import { StarCatalog } from '../../src/ephemeris/stars';
import { LY_KM, PC_KM } from '../../src/ephemeris/frames';
import { vlen, vsub, vdot, vnorm } from '../../src/core/math3';

const meta = JSON.parse(readFileSync('public/data/ephemeris.json', 'utf8')).stars;
const buf = readFileSync('public/data/' + meta.file);
const cat = new StarCatalog(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), meta.stride);
const idx = (key: string) => { const i = meta.keys[key]; if (i === undefined) throw new Error('no key ' + key); return i as number; };
let fails = 0;
const check = (name: string, got: number, want: number, tol: number, unit = '') => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name.padEnd(44)} ${got.toFixed(3)}${unit}  (expected ${want}${unit} ± ${tol})`);
};

console.log(`catalogue: ${cat.count} stars, ${Object.keys(meta.keys).length} keys`);
// Distances (light-years) against published values.
check('Proxima distance', vlen(cat.position(idx('proxima'), 0)) / LY_KM, 4.24, 0.03, ' ly');
check('Sirius distance', vlen(cat.position(idx('sirius'), 0)) / LY_KM, 8.6, 0.1, ' ly');
check("Barnard's Star distance", vlen(cat.position(idx('barnard'), 0)) / LY_KM, 5.96, 0.05, ' ly');
check('Vega distance', vlen(cat.position(idx('vega'), 0)) / LY_KM, 25.0, 0.3, ' ly');
// Apparent magnitude from Earth = absolute + 5 log10(d/10pc).
const mFrom = (i: number) => cat.absMag[i] + 5 * Math.log10(cat.distPc[i] / 10);
check('Sirius apparent magnitude', mFrom(idx('sirius')), -1.44, 0.05);
check('Proxima apparent magnitude', mFrom(idx('proxima')), 11.01, 0.05);
// Proper motion: Barnard's Star moves 10.39"/yr => 0.2886° in 100 years, seen from the Sun (over
// millennia the motion accelerates because the star is approaching, so keep the baseline short).
const b0 = vnorm(cat.position(idx('barnard'), 0)), b1 = vnorm(cat.position(idx('barnard'), 100));
check("Barnard's Star sky motion in 100 yr", (Math.acos(Math.min(1, vdot(b0, b1))) * 180) / Math.PI, 0.2886, 0.003, '°');
// Space velocity: Kapteyn's Star 245 km/s radial + 160 km/s tangential = 293 km/s; Barnard's ~142 km/s.
check("Kapteyn's Star space velocity", cat.speed(idx('kapteyn')), 293, 10, ' km/s');
check("Barnard's Star space velocity", cat.speed(idx('barnard')), 142, 5, ' km/s');
// Closest approach: Barnard's Star reaches ~3.8 ly around AD 11,800.
let best = Infinity, bestYear = 0;
for (let y = 0; y < 30000; y += 10) { const d = vlen(cat.position(idx('barnard'), y)) / LY_KM; if (d < best) { best = d; bestYear = 2000 + y; } }
check("Barnard's Star closest approach distance", best, 3.75, 0.1, ' ly');
check("Barnard's Star closest approach year", bestYear, 11800, 300);
// Alpha Cen A and B share a distance; Proxima is ~13,000 AU (0.21 ly) from them.
const sep = vlen(vsub(cat.position(idx('proxima'), 0), cat.position(idx('alpha-cen-a'), 0))) / LY_KM;
check('Proxima – Alpha Cen separation', sep, 0.21, 0.08, ' ly');
// Deep tier appends cleanly.
if (meta.deep) {
  const dbuf = readFileSync('public/data/' + meta.deep.file);
  const first = cat.append(dbuf.buffer.slice(dbuf.byteOffset, dbuf.byteOffset + dbuf.byteLength), meta.stride);
  let nearest = Infinity;
  for (let i = first; i < cat.count; i++) nearest = Math.min(nearest, cat.distPc[i]);
  console.log(`deep tier: +${cat.count - first} stars, brightest mag ${cat.mag[first].toFixed(2)}, nearest ${((nearest * PC_KM) / LY_KM).toFixed(2)} ly`);
}
console.log(fails ? `\n${fails} check(s) failed` : '\nall star checks passed');
process.exit(fails ? 1 : 0);
