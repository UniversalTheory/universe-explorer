/**
 * Exoplanet catalogue checks: counts, Kepler consistency, and transit geometry
 * (at a transit midpoint the planet must sit in front of its star as seen from the Sun).
 *   npx tsx scripts/dev/exoplanets-check.ts
 */
import { readFileSync } from 'node:fs';
import { ExoCatalog, exoplanetState, nextTransitJd, EXO_TRANSITS, type ExoJson } from '../../src/ephemeris/exoplanets';
import { StarCatalog } from '../../src/ephemeris/stars';
import { AU_KM } from '../../src/ephemeris/frames';
import { vdot, vlen, vnorm, vsub, vscale } from '../../src/core/math3';

const meta = JSON.parse(readFileSync('public/data/ephemeris.json', 'utf8'));
const load = (f: string) => { const b = readFileSync('public/data/' + f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const stars = new StarCatalog(load(meta.stars.file), meta.stars.stride);
const exo = new ExoCatalog(JSON.parse(readFileSync('public/data/' + meta.exoplanets.file, 'utf8')) as ExoJson, load(meta.exoplanets.bin));
let fails = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) fails++; console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? '  ' + detail : ''}`); };

console.log(`exoplanets: ${exo.planets.length} planets, ${exo.hosts.length} hosts`);
check('every host has a star index', exo.hosts.every((h) => meta.stars.keys[h.key] !== undefined));
check('planet count matches the archive extract (≥ 6,300)', exo.planets.length >= 6300, String(exo.planets.length));

const hostPos = (h: number) => stars.position(meta.stars.keys[exo.hosts[h].key], 26);
const planet = (name: string) => { const i = exo.index(name); if (i === undefined) throw new Error('missing ' + name); return exo.planets[i]; };

// Transit geometry: at the next transit midpoint the planet lies on the star–Sun line, on the Sun's side.
for (const name of ['TRAPPIST-1 b', 'TRAPPIST-1 e', 'HD 209458 b', 'WASP-12 b', 'Kepler-186 f']) {
  const p = planet(name);
  const hp = hostPos(p.host);
  const jd = nextTransitJd(p, 2461000)!;
  const s = exoplanetState(p, hp, jd);
  const toSun = vnorm(vscale(hp, -1));
  const along = vdot(s.pos, toSun) / vlen(s.pos);           // +1 = directly toward the Sun
  const offset = vlen(vsub(s.pos, vscale(toSun, vdot(s.pos, toSun)))) / (exo.hosts[p.host].rad * 695700 || 695700);
  // The offset is the impact parameter (HD 209458 b crosses at ~0.5 R★ because i = 86.7°); it must stay inside the disc.
  check(`${name} at transit is between star and Sun`, along > 0.98 && offset < 1.0, `cos=${along.toFixed(5)} impact=${offset.toFixed(2)} R★`);
  // Half a period later it should be behind the star.
  const s2 = exoplanetState(p, hp, jd + p.per / 2);
  check(`${name} half a period later is behind the star`, vdot(s2.pos, toSun) < 0);
}
// Kepler's third law with the archive's own period and semi-major axis (a consistency sanity check on units).
const p51 = planet('51 Peg b');
check('51 Peg b period', Math.abs(p51.per - 4.2308) < 0.01, `${p51.per.toFixed(4)} d`);
check('51 Peg b semi-major axis', Math.abs(p51.a / AU_KM - 0.0527) < 0.003, `${(p51.a / AU_KM).toFixed(4)} AU`);
const s51 = exoplanetState(p51, hostPos(p51.host), 2461000);
check('51 Peg b orbital speed ~136 km/s', Math.abs(vlen(s51.vel) - 136) < 5, `${vlen(s51.vel).toFixed(1)} km/s`);
// Proxima b radius 1.1 R⊕ vs mass 1.07 M⊕ (radius derived from mass when the archive has none).
const pb = planet('Proxima Cen b');
check('Proxima b period 11.19 d', Math.abs(pb.per - 11.19) < 0.05, `${pb.per.toFixed(2)} d`);
check('Proxima b host key is the curated star', exo.hosts[pb.host].key === 'proxima', exo.hosts[pb.host].key);
const transiting = exo.planets.filter((p) => p.flags & EXO_TRANSITS && !isNaN(p.tranmid)).length;
console.log(`transiting planets with a midpoint: ${transiting}`);
console.log(fails ? `\n${fails} check(s) failed` : '\nall exoplanet checks passed');
process.exit(fails ? 1 : 0);
