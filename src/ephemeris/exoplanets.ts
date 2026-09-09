/**
 * Exoplanets: every confirmed planet from the NASA Exoplanet Archive (pscomppars),
 * placed on a Keplerian orbit around its host star.
 *
 * What is real: period, semi-major axis, eccentricity, inclination to the sky plane,
 * argument of periastron, and the orbital phase when the archive has a transit
 * midpoint or a periastron epoch. What is not measured for most systems: the
 * longitude of the ascending node on the sky (set to 0) and, for non-transiting
 * planets without a periastron epoch, the phase (periastron placed at J2000).
 * The info panel reports these via `ExoPlanet.flags`.
 *
 * Files: `exoplanets.json` (names, hosts, methods) and `exoplanets.bin`
 * (Float32, EXO_STRIDE per planet, NaN = unknown). DOM-free.
 */
import { mapply, vcross, vnorm, vscale, vadd, type Vec3 } from '@/core/math3';
import { AU_KM, EQJ_TO_ECL, GM_SUN } from './frames';
import { conicState, sampleConic, type ConicElements, type OrbitState } from './kepler';

export const EXO_STRIDE = 14;
/** JD offset applied to epochs in the binary (keeps float32 precision to ~40 s). */
export const EXO_JD0 = 2450000;
export const J2000_JD = 2451545.0;

/** Bits in `flags`. */
export const EXO_TRANSITS = 1;
export const EXO_MASS_IS_MSINI = 2;
export const EXO_PHASE_UNKNOWN = 4;     // no transit midpoint and no periastron epoch
export const EXO_INCL_ASSUMED = 8;      // inclination not measured; 90° if transiting, else 60°
export const EXO_A_DERIVED = 16;        // semi-major axis from period + stellar mass (or vice versa)

export interface ExoHost {
  name: string;
  /** Catalogue key into the star catalogue (stars.bin `keys`). */
  key: string;
  teff: number;
  /** Solar radii / masses / luminosities (NaN when unknown). */
  rad: number;
  mass: number;
  lum: number;
  spect: string;
  /** Number of known planets. */
  n: number;
  /** Distance, pc. */
  dist: number;
}

export interface ExoPlanet {
  name: string;
  host: number;
  method: string;
  year: number;
  facility: string;
  /** Period, days. */
  per: number;
  /** Semi-major axis, km. */
  a: number;
  e: number;
  incl: number;
  argp: number;
  /** JD, or NaN. */
  tper: number;
  tranmid: number;
  /** Transit duration, hours (NaN when unknown). */
  trandur: number;
  /** Earth radii / Earth masses / kelvin (NaN when unknown). */
  rade: number;
  masse: number;
  eqt: number;
  flags: number;
}

export interface ExoJson {
  hosts: [name: string, key: string, teff: number, rad: number, mass: number, lum: number, spect: string, n: number, dist: number][];
  planets: [name: string, host: number, method: string, year: number, facility: string][];
}

export class ExoCatalog {
  readonly hosts: ExoHost[] = [];
  readonly planets: ExoPlanet[] = [];
  private byName = new Map<string, number>();
  private byHost: number[][] = [];

  constructor(json: ExoJson, buf: ArrayBuffer) {
    for (const [name, key, teff, rad, mass, lum, spect, n, dist] of json.hosts) this.hosts.push({ name, key, teff, rad, mass, lum, spect, n, dist });
    const f = new Float32Array(buf);
    json.planets.forEach(([name, host, method, year, facility], i) => {
      const o = i * EXO_STRIDE;
      const jd = (v: number) => (isNaN(v) ? NaN : v + EXO_JD0);
      const p: ExoPlanet = {
        name, host, method, year, facility,
        per: f[o], a: f[o + 1] * AU_KM, e: f[o + 2], incl: f[o + 3], argp: f[o + 4], tper: jd(f[o + 5]), tranmid: jd(f[o + 6]), trandur: f[o + 7],
        rade: f[o + 8], masse: f[o + 9], eqt: f[o + 10], flags: f[o + 11],
      };
      this.planets.push(p);
      this.byName.set(name, i);
      (this.byHost[host] ??= []).push(i);
    });
  }

  index(name: string): number | undefined { return this.byName.get(name); }
  planetsOf(host: number): number[] { return this.byHost[host] ?? []; }
}

/** Sky-plane basis at a host: east, north, and the direction toward the observer (the Sun), all in ECL. */
export function skyBasis(hostDirEcl: Vec3): { east: Vec3; north: Vec3; toObserver: Vec3 } {
  const d = vnorm(hostDirEcl);
  const pole = mapply(EQJ_TO_ECL, [0, 0, 1]);          // north celestial pole in ECL
  const east = vnorm(vcross(pole, d));
  const north = vcross(d, east);
  return { east, north, toObserver: vscale(d, -1) };
}

/** Conic elements in the sky frame (x = east, y = north, z = toward the observer). */
export function exoElements(p: ExoPlanet): ConicElements {
  const n = (2 * Math.PI) / p.per;                       // rad/day
  const gm = (4 * Math.PI * Math.PI * p.a * p.a * p.a) / ((p.per * 86400) ** 2);  // consistent with the archive period
  let tp: number;
  if (!isNaN(p.tper)) tp = p.tper;
  else if (!isNaN(p.tranmid)) {
    // At transit the planet is at ν = 90° − ω (in front of the star); convert to time of periastron.
    const nu = (90 - p.argp) * (Math.PI / 180);
    const E = 2 * Math.atan(Math.sqrt((1 - p.e) / (1 + p.e)) * Math.tan(nu / 2));
    const M = E - p.e * Math.sin(E);
    tp = p.tranmid - M / n;
  } else tp = J2000_JD;
  return { q: p.a * (1 - p.e), e: p.e, i: p.incl, Omega: 0, omega: p.argp, tp, gm };
}

function toEcl(v: Vec3, b: ReturnType<typeof skyBasis>): Vec3 {
  return vadd(vadd(vscale(b.east, v[0]), vscale(b.north, v[1])), vscale(b.toObserver, v[2]));
}

/** State relative to the host (ECL km, km/s) at Julian date jd. */
export function exoplanetState(p: ExoPlanet, hostDirEcl: Vec3, jd: number): OrbitState {
  const b = skyBasis(hostDirEcl);
  const s = conicState(exoElements(p), jd);
  return { pos: toEcl(s.pos, b), vel: toEcl(s.vel, b) };
}

/** One full orbit relative to the host, ECL km. */
export function exoplanetOrbitPath(p: ExoPlanet, hostDirEcl: Vec3, segments = 192): Vec3[] {
  const b = skyBasis(hostDirEcl);
  return sampleConic(exoElements(p), segments, 1e15).map((v) => toEcl(v, b));
}

/** Next transit midpoint (JD) at or after jd, for transiting planets with a known midpoint. */
export function nextTransitJd(p: ExoPlanet, jd: number): number | null {
  if (!(p.flags & EXO_TRANSITS) || isNaN(p.tranmid) || !(p.per > 0)) return null;
  const k = Math.ceil((jd - p.tranmid) / p.per);
  return p.tranmid + k * p.per;
}

/** Gravitational parameter of a host from its mass in solar masses. */
export const hostGm = (solarMasses: number) => GM_SUN * (isNaN(solarMasses) ? 1 : solarMasses);
