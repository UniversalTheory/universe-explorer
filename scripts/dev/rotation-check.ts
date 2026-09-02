// Sub-solar longitude check: at 12:00 UTC the Sun should be near longitude 0 (± equation of time, < 4°).
import { makeSimTime } from '../../src/core/time';
import { bodyFixedToEqj, bodyPole } from '../../src/ephemeris/iau';
import { EQJ_TO_ECL } from '../../src/ephemeris/frames';
import { planetState } from '../../src/ephemeris/planets';
import { mapply, mmul, mtranspose, RAD, vnorm, vscale } from '../../src/core/math3';
for (const [label, ms] of [['2026-09-02 12:00 UTC', Date.UTC(2026, 8, 2, 12)], ['2026-03-20 12:00 UTC', Date.UTC(2026, 2, 20, 12)], ['2026-09-02 00:00 UTC', Date.UTC(2026, 8, 2, 0)]] as [string, number][]) {
  const t = makeSimTime(ms);
  const earth = planetState('Earth', t.astro);
  const toSunEcl = vnorm(vscale(earth.pos, -1));
  const bodyToEcl = mmul(EQJ_TO_ECL, bodyFixedToEqj(bodyPole('earth', t.tt)));
  const s = mapply(mtranspose(bodyToEcl), toSunEcl); // sun direction in Earth-fixed frame
  const lon = Math.atan2(s[1], s[0]) * RAD, lat = Math.asin(s[2]) * RAD;
  console.log(`${label}: sub-solar lon ${lon.toFixed(2)}°, lat ${lat.toFixed(2)}°`);
}
