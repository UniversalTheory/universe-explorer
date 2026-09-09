/**
 * Deep-sky catalogue checks: every object has a position, sizes are sane, and the apparent
 * size from the Sun matches the catalogued angular size.
 *   npx tsx scripts/dev/deepsky-check.ts
 */
import { readFileSync } from 'node:fs';
import { DeepSkyCatalog, type DsoJson } from '../../src/ephemeris/deepsky';
import { LY_KM } from '../../src/ephemeris/frames';
import { vlen } from '../../src/core/math3';

const cat = new DeepSkyCatalog(JSON.parse(readFileSync('public/data/deepsky.json', 'utf8')) as DsoJson);
let fails = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) fails++; console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? '  ' + detail : ''}`); };
console.log(`deep sky: ${cat.objects.length} objects, ${cat.objects.filter((o) => o.image).length} with images`);
check('all objects have finite positions', cat.objects.every((o) => isFinite(o.ra) && isFinite(o.dec) && o.ly > 0));
const orion = cat.get('orion-nebula')!;
const d = vlen(DeepSkyCatalog.position(orion));
check('Orion Nebula distance 1,344 ly', Math.abs(d / LY_KM - 1344) < 1, `${(d / LY_KM).toFixed(1)} ly`);
const { a } = DeepSkyCatalog.sizeKm(orion);
const apparentDeg = (2 * Math.atan(a / d) * 180) / Math.PI;
check('Orion Nebula apparent size ≈ 1.5° (OpenNGC 90′)', Math.abs(apparentDeg - 1.5) < 0.05, `${apparentDeg.toFixed(2)}°`);
check('Orion Nebula physical diameter ≈ 35 ly at 90′', Math.abs((2 * a) / LY_KM - 35) < 3, `${((2 * a) / LY_KM).toFixed(1)} ly`);
const oc = cat.get('omega-centauri')!;
const oa = DeepSkyCatalog.sizeKm(oc).a;
check('Omega Centauri radius ≈ 65 ly at 27′', Math.abs(oa / LY_KM - 65) < 10, `${(oa / LY_KM).toFixed(0)} ly`);
const crab = cat.get('crab-nebula')!;
check('Crab Nebula declination +22°', Math.abs(crab.dec - 22.01) < 0.05, `${crab.dec.toFixed(2)}°`);
check('no object larger than 1,000 ly across', cat.objects.every((o) => (2 * DeepSkyCatalog.sizeKm(o).a) / LY_KM < 1000));
for (const o of cat.objects) if (o.image && !/^(CC BY|CC0|Public domain)/i.test(o.image.license)) { fails++; console.log(` FAIL  ${o.id} licence ${o.image.license}`); }
check('all image licences are CC BY / CC BY-SA / CC0 / public domain', true);
console.log(fails ? `\n${fails} check(s) failed` : '\nall deep-sky checks passed');
process.exit(fails ? 1 : 0);
