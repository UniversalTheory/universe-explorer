/**
 * Checks the runtime ephemeris against independent JPL Horizons vectors:
 *  - fitted moon elements vs. baked Horizons test vectors (offline)
 *  - planets / Moon / small bodies vs. live Horizons queries (online, skipped on failure)
 */
import { readFileSync } from 'node:fs';
import { Ephemeris } from '../src/ephemeris/Ephemeris';
import { Trajectory } from '../src/ephemeris/spacecraft';
import { Satellite } from '../src/ephemeris/tle';
import { moonState } from '../src/ephemeris/moons';
import { makeSimTime, J2000_JD } from '../src/core/time';
import { vdist, vlen } from '../src/core/math3';
import type { EphemerisData } from '../src/ephemeris/types';

const data = JSON.parse(readFileSync('public/data/ephemeris.json', 'utf8')) as EphemerisData;
const traj = new Map<string, Trajectory>();
for (const [id, idx] of Object.entries(data.spacecraft)) {
  const b = readFileSync('public/data/' + idx.file);
  traj.set(id, new Trajectory(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)));
}
const sats = new Map<string, Satellite>();
for (const [id, tle] of Object.entries(data.tle)) if (Array.isArray(tle)) sats.set(id, new Satellite(tle));
const eph = new Ephemeris(data, traj, sats);

let failures = 0;
const pct = (x: number) => (x * 100).toFixed(3) + '%';

console.log('== Moons vs Horizons test vectors (position error as % of semi-major axis) ==');
for (const [id, el] of Object.entries(data.moons)) {
  let worst = 0, worstYear = '';
  for (const tv of el.test) {
    const tt = tv.jd - J2000_JD;
    const s = moonState(el, tv.jd, tt);
    const err = vdist(s.pos, tv.pos as [number, number, number]) / el.a;
    if (err > worst) { worst = err; worstYear = new Date((tv.jd - 2440587.5) * 86400000).toISOString().slice(0, 10); }
  }
  const ok = worst < 0.05;
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(10)} worst ${pct(worst).padStart(8)} at ${worstYear}`);
}

async function horizonsVec(cmd: string, iso: string, center = '500@10'): Promise<[number, number, number] | null> {
  const u = new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
  const p: Record<string, string> = { format: 'text', COMMAND: `'${cmd}'`, OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'VECTORS'", CENTER: `'${center}'`, REF_PLANE: "'E'", TLIST: `'${iso}'`, TLIST_TYPE: "'CAL'", OUT_UNITS: "'KM-S'", VEC_TABLE: "'1'", CSV_FORMAT: "'YES'" };
  for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
  try {
    const t = await (await fetch(u)).text();
    const a = t.indexOf('$$SOE'), b = t.indexOf('$$EOE');
    if (a < 0) { console.log('   horizons:', t.split('\n').find((l) => l.includes('No ') || l.includes('rror')) ?? t.slice(0, 200)); return null; }
    const row = t.slice(a + 5, b).trim().split('\n')[0].split(',').map((s) => s.trim());
    return [+row[2], +row[3], +row[4]];
  } catch (e) { console.log('   (offline)', (e as Error).message); return null; }
}

async function online() {
  console.log('== Bodies vs live Horizons at 2026-09-02 00:00 TT ==');
  const t = makeSimTime(Date.UTC(2026, 8, 1, 23, 58, 51)); // ≈ 2026-09-02 00:00 TT
  const cases: [string, string, string?][] = [
    ['earth', '399'], ['mars', '499'], ['jupiter', '599'], ['neptune', '899'], ['pluto', '999'],
    ['ceres', '1;'], ['vesta', '4;'], ['eris', '136199;'], ['apophis', '99942;'], ['halley', '90000030'],
    ['io', '501', '500@599'], ['titan', '606', '500@699'], ['triton', '801', '500@899'], ['moon', '301', '500@399'],
    ['voyager1', '-31'], ['jwst', '-170'], ['parker', '-96'],
  ];
  for (const [id, cmd, center] of cases) {
    const ref = await horizonsVec(cmd, `2026-09-02 00:00:00`, center);
    if (!ref) continue;
    const s = center ? eph.relative(id, t) : eph.state(id, t);
    if (!s) { console.log(`  ----  ${id}: unavailable`); continue; }
    const err = vdist(s.pos, ref), rel = err / vlen(ref);
    const ok = rel < (id === 'halley' ? 0.05 : 0.01);
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(10)} err ${err.toExponential(2).padStart(9)} km  (${pct(rel)} of distance)`);
  }
}
await online();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
