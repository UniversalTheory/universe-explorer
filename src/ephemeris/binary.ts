/**
 * Visual / spectroscopic binary orbits: a companion on a Keplerian orbit about its
 * primary, with elements in the usual sky-plane convention (Ω = position angle of the
 * ascending node from north through east, i = inclination to the sky plane, ω =
 * argument of periastron of the companion). Position angle θ is measured from north
 * toward east, so the sky frame here is x = north, y = east, z = toward the observer.
 * DOM-free.
 */
import { mapply, vadd, vcross, vnorm, vscale, type Vec3 } from '@/core/math3';
import { AU_KM, EQJ_TO_ECL } from './frames';
import { conicState, sampleConic, type ConicElements, type OrbitState } from './kepler';

export interface BinaryElements {
  /** Period, days. */
  per: number;
  /** Semi-major axis, km. */
  a: number;
  e: number;
  /** Inclination to the sky plane, degrees. */
  incl: number;
  /** Position angle of the ascending node, degrees east of north. */
  node: number;
  /** Argument of periastron, degrees. */
  argp: number;
  /** Time of periastron, JD. */
  tp: number;
}

/** Convenience: elements from the catalogue's units (years, AU or arcsec at a distance). */
export function binaryElements(o: { years: number; au?: number; arcsec?: number; distPc?: number; e?: number; i?: number; node?: number; argp?: number; tpYear?: number }): BinaryElements {
  const au = o.au ?? (o.arcsec !== undefined && o.distPc !== undefined ? o.arcsec * o.distPc : 1);
  const tpYear = o.tpYear ?? 2000;
  return { per: o.years * 365.25, a: au * AU_KM, e: o.e ?? 0, incl: o.i ?? 90, node: o.node ?? 0, argp: o.argp ?? 0, tp: 2451545.0 + (tpYear - 2000) * 365.25 };
}

function basis(primaryDirEcl: Vec3) {
  const d = vnorm(primaryDirEcl);
  const pole = mapply(EQJ_TO_ECL, [0, 0, 1]);
  const east = vnorm(vcross(pole, d));
  const north = vcross(d, east);
  return { north, east, toObserver: vscale(d, -1) };
}

function conic(el: BinaryElements): ConicElements {
  const gm = (4 * Math.PI * Math.PI * el.a * el.a * el.a) / ((el.per * 86400) ** 2);
  return { q: el.a * (1 - el.e), e: el.e, i: el.incl, Omega: el.node, omega: el.argp, tp: el.tp, gm };
}

const toEcl = (v: Vec3, b: ReturnType<typeof basis>): Vec3 => vadd(vadd(vscale(b.north, v[0]), vscale(b.east, v[1])), vscale(b.toObserver, v[2]));

/** Companion state relative to the primary (ECL km, km/s). `primaryDirEcl` = heliocentric direction of the primary. */
export function binaryState(el: BinaryElements, primaryDirEcl: Vec3, jd: number): OrbitState {
  const b = basis(primaryDirEcl);
  const s = conicState(conic(el), jd);
  return { pos: toEcl(s.pos, b), vel: toEcl(s.vel, b) };
}

export function binaryOrbitPath(el: BinaryElements, primaryDirEcl: Vec3, segments = 192): Vec3[] {
  const b = basis(primaryDirEcl);
  return sampleConic(conic(el), segments, 1e16).map((v) => toEcl(v, b));
}

/** Angular separation (arcsec) and position angle (deg E of N) of the companion as seen from the Sun. */
export function apparentSeparation(el: BinaryElements, distKm: number, jd: number): { rho: number; theta: number } {
  const s = conicState(conic(el), jd);
  const rho = (Math.hypot(s.pos[0], s.pos[1]) / distKm) * 206264.806;
  const theta = ((Math.atan2(s.pos[1], s.pos[0]) * 180) / Math.PI + 360) % 360;
  return { rho, theta };
}

/** Schwarzschild radius, km, for a mass in solar masses. */
export const schwarzschildKm = (solarMasses: number) => 2.953 * solarMasses;
