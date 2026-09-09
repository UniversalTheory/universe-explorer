/**
 * Star catalogue: positions and space velocities of catalogued stars, so that any
 * star can be placed at the simulation time (linear motion: proper motion + radial
 * velocity, valid for ± a few hundred thousand years).
 *
 * Binary layout (`public/data/stars.bin`, Float32, stride STAR_STRIDE per star, sorted
 * by apparent magnitude): x y z (pc, EQJ) · vx vy vz (pc/yr, EQJ) · mag · ci (B−V) ·
 * hip (0 = none) · flags (bit 0: distance unknown, placeholder used).
 * DOM-free: runs in Node for the check scripts.
 */
import { mapply, type Vec3 } from '@/core/math3';
import { EQJ_TO_ECL, PC_KM } from './frames';
import type { OrbitState } from './kepler';

export const STAR_STRIDE = 10;
/** Julian year in seconds. */
const YEAR_S = 365.25 * 86400;

export const STAR_FLAG_NO_DISTANCE = 1;

export class StarCatalog {
  /** Number of stars in the standard tier (the first `count` entries). */
  count: number;
  /** Heliocentric ECL position at J2000, km (xyz per star). */
  ecl: Float64Array;
  /** ECL velocity, km per Julian year. */
  velKmYr: Float64Array;
  mag: Float32Array;
  ci: Float32Array;
  absMag: Float32Array;
  distPc: Float32Array;
  hip: Int32Array;
  flags: Uint8Array;
  private byHip = new Map<number, number>();

  constructor(buf: ArrayBuffer, stride = STAR_STRIDE) {
    const f = new Float32Array(buf);
    const n = Math.floor(f.length / stride);
    this.count = n;
    this.ecl = new Float64Array(n * 3);
    this.velKmYr = new Float64Array(n * 3);
    this.mag = new Float32Array(n);
    this.ci = new Float32Array(n);
    this.absMag = new Float32Array(n);
    this.distPc = new Float32Array(n);
    this.hip = new Int32Array(n);
    this.flags = new Uint8Array(n);
    this.ingest(f, 0, n, stride);
  }

  private ingest(f: Float32Array, offset: number, n: number, stride: number) {
    for (let i = 0; i < n; i++) {
      const o = i * stride, k = (offset + i) * 3;
      const p = mapply(EQJ_TO_ECL, [f[o], f[o + 1], f[o + 2]]);
      const v = mapply(EQJ_TO_ECL, [f[o + 3], f[o + 4], f[o + 5]]);
      this.ecl[k] = p[0] * PC_KM; this.ecl[k + 1] = p[1] * PC_KM; this.ecl[k + 2] = p[2] * PC_KM;
      this.velKmYr[k] = v[0] * PC_KM; this.velKmYr[k + 1] = v[1] * PC_KM; this.velKmYr[k + 2] = v[2] * PC_KM;
      const d = Math.hypot(f[o], f[o + 1], f[o + 2]);
      const j = offset + i;
      this.distPc[j] = d;
      this.mag[j] = f[o + 6];
      this.ci[j] = f[o + 7];
      this.absMag[j] = f[o + 6] - 5 * Math.log10(Math.max(d, 1e-3) / 10);
      this.hip[j] = f[o + 8];
      this.flags[j] = f[o + 9];
      if (this.hip[j] > 0) this.byHip.set(this.hip[j], j);
    }
  }

  /** Append a second chunk (the on-demand deep tier). Returns the index of its first star. */
  append(buf: ArrayBuffer, stride = STAR_STRIDE): number {
    const f = new Float32Array(buf);
    const m = Math.floor(f.length / stride);
    const n = this.count;
    const grow = <T extends Float64Array | Float32Array | Int32Array | Uint8Array>(a: T, per: number): T => {
      const b = new (a.constructor as new (n: number) => T)((n + m) * per);
      b.set(a as never);
      return b;
    };
    this.ecl = grow(this.ecl, 3); this.velKmYr = grow(this.velKmYr, 3);
    this.mag = grow(this.mag, 1); this.ci = grow(this.ci, 1); this.absMag = grow(this.absMag, 1); this.distPc = grow(this.distPc, 1);
    this.hip = grow(this.hip, 1); this.flags = grow(this.flags, 1);
    this.ingest(f, n, m, stride);
    this.count = n + m;
    return n;
  }

  indexOfHip(hip: number): number | undefined { return this.byHip.get(hip); }

  /** Heliocentric ECL position (km) at `years` Julian years after J2000. */
  position(i: number, years: number, out: Vec3 = [0, 0, 0]): Vec3 {
    const k = i * 3;
    out[0] = this.ecl[k] + this.velKmYr[k] * years;
    out[1] = this.ecl[k + 1] + this.velKmYr[k + 1] * years;
    out[2] = this.ecl[k + 2] + this.velKmYr[k + 2] * years;
    return out;
  }

  /** Heliocentric ECL state (km, km/s). */
  state(i: number, years: number): OrbitState {
    const k = i * 3;
    return { pos: this.position(i, years), vel: [this.velKmYr[k] / YEAR_S, this.velKmYr[k + 1] / YEAR_S, this.velKmYr[k + 2] / YEAR_S] };
  }

  /** Space velocity relative to the Sun, km/s. */
  speed(i: number): number {
    const k = i * 3;
    return Math.hypot(this.velKmYr[k], this.velKmYr[k + 1], this.velKmYr[k + 2]) / YEAR_S;
  }
}

/** Blackbody-ish colour from B−V (linear RGB 0..1), shared by the point cloud and star spheres. */
export function bvToRgb(bv: number): [number, number, number] {
  const t = Math.max(-0.4, Math.min(2.0, bv));
  let r = 1, g = 1, b = 1;
  if (t < 0) { r = 0.62 + 0.38 * (t + 0.4) / 0.4; g = 0.75 + 0.25 * (t + 0.4) / 0.4; }
  else if (t < 0.4) { g = 1 - 0.05 * t / 0.4; b = 1 - 0.25 * t / 0.4; }
  else if (t < 1.5) { g = 0.95 - 0.35 * (t - 0.4) / 1.1; b = 0.75 - 0.55 * (t - 0.4) / 1.1; }
  else { g = 0.6 - 0.15 * (t - 1.5) / 0.5; b = 0.2; }
  return [r, g, b];
}
