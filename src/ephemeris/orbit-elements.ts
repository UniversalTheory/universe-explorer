/** Osculating conic elements from a state vector, for drawing orbit curves. */
import { vcross, vdot, vlen, vscale, vsub, RAD, type Vec3 } from '@/core/math3';
import type { ConicElements } from './kepler';

export function elementsFromState(r: Vec3, v: Vec3, gm: number, jd: number): ConicElements {
  const rl = vlen(r), v2 = vdot(v, v);
  const h = vcross(r, v);
  const hl = vlen(h);
  const n: Vec3 = [-h[1], h[0], 0];
  const nl = vlen(n);
  const rv = vdot(r, v);
  const evec = vscale(vsub(vscale(r, v2 - gm / rl), vscale(v, rv)), 1 / gm);
  const e = vlen(evec);
  const p = (hl * hl) / gm;
  const q = p / (1 + e);
  const i = Math.acos(Math.max(-1, Math.min(1, h[2] / hl))) * RAD;
  let Omega = 0, omega = 0, nu = 0;
  if (nl > 1e-12) {
    Omega = Math.atan2(n[1], n[0]) * RAD;
    if (e > 1e-10) {
      omega = Math.acos(Math.max(-1, Math.min(1, vdot(n, evec) / (nl * e)))) * RAD;
      if (evec[2] < 0) omega = 360 - omega;
    }
  } else if (e > 1e-10) {
    omega = Math.atan2(evec[1], evec[0]) * RAD;
    if (h[2] < 0) omega = 360 - omega;
  }
  if (e > 1e-10) {
    nu = Math.acos(Math.max(-1, Math.min(1, vdot(evec, r) / (e * rl))));
    if (rv < 0) nu = 2 * Math.PI - nu;
  } else {
    // Circular: measure from the node (or x-axis).
    const ref: Vec3 = nl > 1e-12 ? n : [1, 0, 0];
    nu = Math.acos(Math.max(-1, Math.min(1, vdot(ref, r) / (vlen(ref) * rl))));
    if ((nl > 1e-12 ? r[2] : vcross(ref, r)[2]) < 0) nu = 2 * Math.PI - nu;
  }
  // Time of periapsis.
  let tp = jd;
  if (e < 1 - 1e-7) {
    const a = q / (1 - e);
    const E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2));
    const M = E - e * Math.sin(E);
    const nrate = Math.sqrt(gm / (a * a * a));
    tp = jd - M / nrate / 86400;
  } else if (e > 1 + 1e-7) {
    const a = q / (e - 1);
    const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2));
    const N = e * Math.sinh(H) - H;
    tp = jd - N / Math.sqrt(gm / (a * a * a)) / 86400;
  } else {
    const D = Math.tan(nu / 2);
    tp = jd - Math.sqrt((2 * q * q * q) / gm) * (D + (D * D * D) / 3) / 86400;
  }
  return { q, e, i, Omega, omega, tp, gm };
}
