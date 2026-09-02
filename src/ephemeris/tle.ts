/** Earth satellites from two-line elements via SGP4 (satellite.js). */
import { twoline2satrec, propagate, type SatRec } from 'satellite.js';
import { Rotation_EQD_EQJ, RotateVector, Vector, type AstroTime } from 'astronomy-engine';
import { mapply, type Vec3 } from '@/core/math3';
import { EQJ_TO_ECL } from './frames';
import type { OrbitState } from './kepler';

export class Satellite {
  readonly rec: SatRec;
  readonly name: string;
  readonly epochMs: number;
  constructor(tle: string[]) {
    this.name = tle[0];
    this.rec = twoline2satrec(tle[1], tle[2]);
    // satrec.jdsatepoch is the TLE epoch as a Julian date.
    this.epochMs = (this.rec.jdsatepoch - 2440587.5) * 86400000;
  }
  /** Geocentric ECL state (km, km/s); null if SGP4 fails (decayed / far outside epoch). */
  state(time: AstroTime): OrbitState | null {
    const r = propagate(this.rec, time.date);
    if (!r || typeof r.position === 'boolean' || !r.position || !r.velocity || typeof r.velocity === 'boolean') return null;
    // TEME ≈ true equator of date; rotate to J2000 then to the ecliptic.
    const rot = Rotation_EQD_EQJ(time);
    const p = RotateVector(rot, new Vector(r.position.x, r.position.y, r.position.z, time));
    const v = RotateVector(rot, new Vector(r.velocity.x, r.velocity.y, r.velocity.z, time));
    const pos: Vec3 = mapply(EQJ_TO_ECL, [p.x, p.y, p.z]);
    const vel: Vec3 = mapply(EQJ_TO_ECL, [v.x, v.y, v.z]);
    return { pos, vel };
  }
}
