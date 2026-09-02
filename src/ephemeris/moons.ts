/**
 * Satellites from fitted mean elements in the parent's body-equator frame
 * (see scripts/build-data.ts). Converted to J2000 ecliptic using the parent's
 * IAU pole at the requested epoch.
 */
import { mmulAll, mapply, mtranspose, wrap360, type Mat3, type Vec3 } from '@/core/math3';
import { ellipticState, perifocalMatrix, type OrbitState } from './kepler';
import { bodyPole, poleFrameToEqj } from './iau';
import { EQJ_TO_ECL } from './frames';
import type { FittedMoonElements } from './types';

/** Relative state (km, km/s) of a moon w.r.t. its parent, in the ECL frame. */
/** Laplace frame -> ECL for the parent's pole at time tt. */
function laplaceToEcl(el: FittedMoonElements, tt: number): Mat3 {
  // `frame` rows are the Laplace axes in the body-equator frame; its transpose maps Laplace -> body-equator.
  const lapToBody = mtranspose(el.frame as unknown as Mat3);
  return mmulAll(EQJ_TO_ECL, poleFrameToEqj(bodyPole(el.parent, tt)), lapToBody);
}

export function moonState(el: FittedMoonElements, jd: number, tt: number): OrbitState {
  const tau = jd - el.epoch;
  const Omega = wrap360(el.Omega0 + el.OmegaDot * tau);
  const varpi = el.varpi0 + el.varpiDot * tau;
  const L = el.L0 + el.n * tau + (el.nDot ?? 0) * tau * tau;
  const omega = wrap360(varpi - Omega);
  const M = wrap360(L - varpi);
  const R = perifocalMatrix(Omega, el.i, omega);
  const s = ellipticState(el.a, el.e, M, el.gm, R);
  const toEcl = laplaceToEcl(el, tt);
  return { pos: mapply(toEcl, s.pos), vel: mapply(toEcl, s.vel) };
}

/** Points (ECL, km, relative to parent) along the moon's current orbit. */
export function moonOrbitPath(el: FittedMoonElements, jd: number, tt: number, segments = 180): Vec3[] {
  const tau = jd - el.epoch;
  const Omega = wrap360(el.Omega0 + el.OmegaDot * tau);
  const varpi = el.varpi0 + el.varpiDot * tau;
  const omega = wrap360(varpi - Omega);
  const R = perifocalMatrix(Omega, el.i, omega);
  const toEcl = laplaceToEcl(el, tt);
  const pts: Vec3[] = [];
  for (let k = 0; k <= segments; k++) {
    const M = (360 * k) / segments;
    pts.push(mapply(toEcl, ellipticState(el.a, el.e, M, el.gm, R).pos));
  }
  return pts;
}
