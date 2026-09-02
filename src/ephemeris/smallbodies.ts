/** Comets, asteroids and dwarf planets from JPL SBDB conic elements (heliocentric ECL). */
import type { Vec3 } from '@/core/math3';
import { conicState, sampleConic, type ConicElements, type OrbitState } from './kepler';
import { AU_KM, GM_SUN } from './frames';
import type { SmallBodyRecord } from './types';

export function smallBodyElements(r: SmallBodyRecord): ConicElements {
  return { q: r.q * AU_KM, e: r.e, i: r.i, Omega: r.Omega, omega: r.omega, tp: r.tp, gm: GM_SUN };
}
export function smallBodyState(r: SmallBodyRecord, jd: number): OrbitState {
  return conicState(smallBodyElements(r), jd);
}
export function smallBodyOrbitPath(r: SmallBodyRecord, segments = 256, maxRadiusAU = 300): Vec3[] {
  return sampleConic(smallBodyElements(r), segments, maxRadiusAU * AU_KM);
}
