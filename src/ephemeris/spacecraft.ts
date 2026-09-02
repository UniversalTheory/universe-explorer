/**
 * Spacecraft trajectories: baked heliocentric ECL state vectors, cubic Hermite
 * interpolation between samples using the stored velocities.
 */
import type { Vec3 } from '@/core/math3';
import type { OrbitState } from './kepler';

export class Trajectory {
  readonly count: number;
  readonly times: Float64Array; // JD TDB
  readonly states: Float32Array; // x y z vx vy vz (km, km/s)
  constructor(buf: ArrayBuffer) {
    this.count = new Uint32Array(buf, 0, 1)[0];
    this.times = new Float64Array(buf, 8, this.count);
    this.states = new Float32Array(buf, 8 + this.count * 8, this.count * 6);
  }
  get start() { return this.times[0]; }
  get end() { return this.times[this.count - 1]; }
  contains(jd: number) { return jd >= this.start && jd <= this.end; }

  /** State at jd; clamped to the trajectory span. */
  state(jd: number): OrbitState {
    const t = this.times, n = this.count;
    if (jd <= t[0]) return this.sample(0);
    if (jd >= t[n - 1]) return this.sample(n - 1);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (t[mid] <= jd) lo = mid; else hi = mid; }
    const h = (t[hi] - t[lo]) * 86400; // seconds
    const s = (jd - t[lo]) / (t[hi] - t[lo]);
    const s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    const d00 = 6 * s2 - 6 * s, d10 = 3 * s2 - 4 * s + 1, d01 = -6 * s2 + 6 * s, d11 = 3 * s2 - 2 * s;
    const a = lo * 6, b = hi * 6, st = this.states;
    const pos: Vec3 = [0, 0, 0], vel: Vec3 = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const p0 = st[a + k], p1 = st[b + k], v0 = st[a + 3 + k] * h, v1 = st[b + 3 + k] * h;
      pos[k] = h00 * p0 + h10 * v0 + h01 * p1 + h11 * v1;
      vel[k] = (d00 * p0 + d10 * v0 + d01 * p1 + d11 * v1) / h;
    }
    return { pos, vel };
  }
  sample(i: number): OrbitState {
    const o = i * 6, st = this.states;
    return { pos: [st[o], st[o + 1], st[o + 2]], vel: [st[o + 3], st[o + 4], st[o + 5]] };
  }
  /** Path points (every `stride`-th sample) for drawing the flown trajectory. */
  path(stride = 1): Vec3[] {
    const out: Vec3[] = [];
    for (let i = 0; i < this.count; i += stride) out.push(this.sample(i).pos);
    if ((this.count - 1) % stride !== 0) out.push(this.sample(this.count - 1).pos);
    return out;
  }
}
