/**
 * Two-body (Keplerian) propagation for elliptic, parabolic and hyperbolic
 * orbits. Frame-agnostic: elements are interpreted in whichever frame the
 * caller's Ω / i / ω refer to.
 */
import { DEG, rotX, rotZ, mmulAll, mapply, type Mat3, type Vec3 } from '@/core/math3';

export interface OrbitState {
  /** Position, km. */
  pos: Vec3;
  /** Velocity, km/s. */
  vel: Vec3;
}

/** Solve Kepler's equation M = E - e sin E for elliptic orbits. Inputs in radians. */
export function solveElliptic(M: number, e: number): number {
  M = M % (2 * Math.PI);
  if (M < 0) M += 2 * Math.PI;
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 30; k++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    const dE = -f / fp;
    E += dE;
    if (Math.abs(dE) < 1e-13) break;
  }
  return E;
}

/** Solve N = e sinh H - H for hyperbolic orbits. */
export function solveHyperbolic(N: number, e: number): number {
  let H = Math.asinh(N / e);
  if (Math.abs(N) > 1) H = Math.sign(N) * Math.log(2 * Math.abs(N) / e + 1.8);
  for (let k = 0; k < 50; k++) {
    const f = e * Math.sinh(H) - H - N;
    const fp = e * Math.cosh(H) - 1;
    const dH = -f / fp;
    H += dH;
    if (Math.abs(dH) < 1e-13) break;
  }
  return H;
}

/** Perifocal -> reference frame rotation for Ω, i, ω in degrees. */
export function perifocalMatrix(OmegaDeg: number, iDeg: number, omegaDeg: number): Mat3 {
  return mmulAll(rotZ(OmegaDeg * DEG), rotX(iDeg * DEG), rotZ(omegaDeg * DEG));
}

/**
 * State from mean anomaly (elliptic only), used for satellites whose elements
 * are expressed as mean longitude / longitude of periapsis.
 * @param a semi-major axis km, @param e eccentricity, @param MDeg mean anomaly deg, @param gm km^3/s^2
 */
export function ellipticState(a: number, e: number, MDeg: number, gm: number, R: Mat3): OrbitState {
  const E = solveElliptic(MDeg * DEG, e);
  const cE = Math.cos(E), sE = Math.sin(E);
  const b = a * Math.sqrt(1 - e * e);
  const xp = a * (cE - e), yp = b * sE;
  const r = a * (1 - e * cE);
  const n = Math.sqrt(gm / (a * a * a));
  const vx = -a * a * n * sE / r, vy = b * a * n * cE / r;
  return { pos: mapply(R, [xp, yp, 0]), vel: mapply(R, [vx, vy, 0]) };
}

export interface ConicElements {
  /** Perihelion distance, km. */
  q: number;
  e: number;
  /** Inclination, deg. */
  i: number;
  /** Longitude of ascending node, deg. */
  Omega: number;
  /** Argument of periapsis, deg. */
  omega: number;
  /** Time of periapsis passage, JD (TDB). */
  tp: number;
  /** Gravitational parameter of the central body, km^3/s^2. */
  gm: number;
}

/** State of any conic orbit at Julian date jd (TDB). */
export function conicState(el: ConicElements, jd: number): OrbitState {
  const R = perifocalMatrix(el.Omega, el.i, el.omega);
  const dt = (jd - el.tp) * 86400; // seconds since periapsis
  const { q, e, gm } = el;
  let xp: number, yp: number, vx: number, vy: number;

  if (Math.abs(e - 1) < 1e-7) {
    // Parabolic: Barker's equation.
    const p = 2 * q;
    const A = 1.5 * Math.sqrt(gm / (p * p * p)) * dt;
    const B = Math.cbrt(A + Math.sqrt(A * A + 1));
    const D = B - 1 / B; // tan(nu/2)
    const nu = 2 * Math.atan(D);
    const r = p / (1 + Math.cos(nu));
    xp = r * Math.cos(nu); yp = r * Math.sin(nu);
    const h = Math.sqrt(gm * p);
    vx = -(gm / h) * Math.sin(nu); vy = (gm / h) * (1 + Math.cos(nu));
  } else if (e < 1) {
    const a = q / (1 - e);
    const n = Math.sqrt(gm / (a * a * a));
    const E = solveElliptic(n * dt, e);
    const cE = Math.cos(E), sE = Math.sin(E);
    const b = a * Math.sqrt(1 - e * e);
    xp = a * (cE - e); yp = b * sE;
    const r = a * (1 - e * cE);
    vx = -a * a * n * sE / r; vy = b * a * n * cE / r;
  } else {
    const a = q / (e - 1); // positive
    const n = Math.sqrt(gm / (a * a * a));
    const H = solveHyperbolic(n * dt, e);
    const cH = Math.cosh(H), sH = Math.sinh(H);
    const b = a * Math.sqrt(e * e - 1);
    xp = a * (e - cH); yp = b * sH;
    const r = a * (e * cH - 1);
    vx = -a * a * n * sH / r; vy = b * a * n * cH / r;
  }
  return { pos: mapply(R, [xp, yp, 0]), vel: mapply(R, [vx, vy, 0]) };
}

/** Orbital period in days for elliptic elements (Infinity otherwise). */
export function periodDays(q: number, e: number, gm: number): number {
  if (e >= 1) return Infinity;
  const a = q / (1 - e);
  return 2 * Math.PI * Math.sqrt((a * a * a) / gm) / 86400;
}

/**
 * Sample one full orbit (or, for open orbits, the arc within maxRadius) as
 * positions in the elements' frame. Used to draw orbit lines.
 */
export function sampleConic(el: ConicElements, segments: number, maxRadiusKm: number): Vec3[] {
  const R = perifocalMatrix(el.Omega, el.i, el.omega);
  const pts: Vec3[] = [];
  const { q, e } = el;
  const p = q * (1 + e);
  let nuMax = Math.PI;
  if (e >= 1) {
    // True anomaly where r = maxRadius (or the asymptote).
    const cosNu = (p / maxRadiusKm - 1) / e;
    nuMax = Math.acos(Math.max(-1, Math.min(1, cosNu)));
    nuMax = Math.min(nuMax, Math.acos(-1 / e) - 1e-3);
  } else if (e > 0.9) {
    // Bound but very eccentric: still parametrise by true anomaly, but denser near perihelion.
  }
  for (let k = 0; k <= segments; k++) {
    // Non-uniform spacing: denser near perihelion for eccentric orbits.
    const t = k / segments; // 0..1
    const s = 2 * t - 1; // -1..1
    const nu = nuMax * Math.sign(s) * Math.pow(Math.abs(s), e > 0.5 ? 0.5 : 1);
    const r = p / (1 + e * Math.cos(nu));
    if (!isFinite(r) || r <= 0 || r > maxRadiusKm * 1.001) continue;
    pts.push(mapply(R, [r * Math.cos(nu), r * Math.sin(nu), 0]));
  }
  return pts;
}
