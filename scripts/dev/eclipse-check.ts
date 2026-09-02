import { readFileSync } from 'node:fs';
import { Ephemeris } from '../../src/ephemeris/Ephemeris';
import { makeSimTime } from '../../src/core/time';
import { vsub, vlen, vdot, vnorm, RAD } from '../../src/core/math3';
import type { EphemerisData } from '../../src/ephemeris/types';
const data = JSON.parse(readFileSync('public/data/ephemeris.json', 'utf8')) as EphemerisData;
const eph = new Ephemeris(data, new Map(), new Map());
const ms = +(process.argv[2] ?? Date.UTC(2026, 8, 2, 10, 47));
for (const [moon, parent, R] of [['enceladus', 'saturn', 60268], ['triton', 'neptune', 24764], ['moon', 'earth', 6378], ['io', 'jupiter', 71492]] as [string, string, number][]) {
  const t = makeSimTime(ms);
  const m = eph.state(moon, t)!.pos, p = eph.state(parent, t)!.pos;
  const toSun = vnorm(vsub([0, 0, 0], m)), toP = vsub(p, m);
  const d = vlen(toP);
  const ang = Math.acos(vdot(toSun, vnorm(toP))) * RAD;
  const rad = Math.asin(R / d) * RAD;
  console.log(`${moon.padEnd(10)} sun-parent angle ${ang.toFixed(2)}°, parent angular radius ${rad.toFixed(2)}° -> ${ang < rad ? 'IN SHADOW (eclipsed)' : 'lit'}`);
}
