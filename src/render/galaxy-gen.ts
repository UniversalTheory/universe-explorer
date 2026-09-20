/**
 * Point generation for the Milky Way model: ~300,000 points built from the structural parameters
 * in src/data/galaxy.ts (exponential thin and thick discs, a Hernquist bulge, the bar, and the
 * Reid et al. 2019 spiral arms as Gaussian ribbons).
 *
 * Kept free of Three.js and the DOM so it can run in a Web Worker — it costs ~130 ms on a desktop
 * and several times that on a phone, which is too much to spend on the boot thread. `GalaxyModel`
 * turns the buffers this returns into a `THREE.Points`.
 *
 * Everything is generated in the Sun-centred Galactic frame relative to the Galactic centre
 * (x toward the Sun–centre line, y toward l = 90°, z toward the north Galactic pole), stored
 * Three-permuted as (gx, gz, −gy) because the group carrying these points is rotated by the
 * Galactic quaternion.
 */
import { ARMS, armRadius, BAR_ANGLE_DEG, BAR_HALF_KPC, type ArmSpec } from '@/data/galaxy';

export interface GalaxyBuffers {
  pos: Float32Array;
  col: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
  count: number;
}

function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1000000) / 1000000; }; }
function gauss(r: () => number) { const u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/** sRGB hex to the linear working space, matching what THREE.Color would have done with colour management on. */
function linearRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => (c < 0.04045 ? c * 0.0773993808 : ((c * 0.9478672986 + 0.0521327014) ** 2.4));
  return [f(((n >> 16) & 255) / 255), f(((n >> 8) & 255) / 255), f((n & 255) / 255)];
}

/**
 * @param quality  'low' halves the point count
 * @param kpc      far-scene units per kiloparsec
 */
export function generateGalaxy(quality: 'high' | 'low', kpc: number): GalaxyBuffers {
  const q = quality === 'high' ? 1 : 0.5;
  const N = { thin: 150000 * q, thick: 20000 * q, bulge: 18000 * q, bar: 16000 * q, arms: 110000 * q };
  const total = Math.round(N.thin + N.thick + N.bulge + N.bar + N.arms);
  const pos = new Float32Array(total * 3), col = new Float32Array(total * 3), size = new Float32Array(total), alpha = new Float32Array(total);
  const r = rng(20260909);
  let i = 0;
  const put = (x: number, y: number, z: number, c: [number, number, number], s: number, a: number) => {
    pos[i * 3] = x * kpc; pos[i * 3 + 1] = z * kpc; pos[i * 3 + 2] = -y * kpc;
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    size[i] = s; alpha[i] = a; i++;
  };
  // Galactocentric cylindrical → frame relative to the centre: (−R cos β, R sin β, z).
  const cyl = (R: number, betaRad: number, z: number, c: [number, number, number], s: number, a: number) => put(-R * Math.cos(betaRad), R * Math.sin(betaRad), z, c, s, a);
  const jitter = (c: [number, number, number], k = 0.08): [number, number, number] => [c[0] + gauss(r) * k, c[1] + gauss(r) * k, c[2] + gauss(r) * k];

  // Thin disc: exponential, scale length 2.6 kpc, scale height 0.3 kpc, truncated at 15 kpc, mildly warped beyond 10 kpc.
  for (let k = 0; k < N.thin; k++) {
    let R = -2.6 * Math.log(Math.max(1e-9, r()));
    while (R > 15 || R < 0.5) R = -2.6 * Math.log(Math.max(1e-9, r()));
    const b = r() * 2 * Math.PI;
    const warp = R > 10 ? 0.15 * ((R - 10) / 5) ** 2 * Math.sin(b + 0.6) : 0;
    cyl(R, b, gauss(r) * 0.3 * (1 + R / 20) + warp, jitter([1.0, 0.92, 0.78]), 0.6 + r() * 0.7, 0.16 * Math.min(1, R / 3));
  }
  // Thick disc: scale length 2.0, height 0.9, older / redder, sparser.
  for (let k = 0; k < N.thick; k++) {
    let R = -2.0 * Math.log(Math.max(1e-9, r()));
    while (R > 14) R = -2.0 * Math.log(Math.max(1e-9, r()));
    cyl(R, r() * 2 * Math.PI, gauss(r) * 0.9, jitter([1.0, 0.85, 0.65]), 0.6 + r() * 0.6, 0.2);
  }
  // Bulge: Hernquist profile, a = 0.7 kpc, flattened 0.6, truncated at 3 kpc.
  for (let k = 0; k < N.bulge; k++) {
    let rad = Infinity;
    while (rad > 3) { const u = r(); const s = Math.sqrt(u); rad = (0.7 * s) / (1 - s + 1e-6); }
    const th = Math.acos(2 * r() - 1), ph = r() * 2 * Math.PI;
    put(rad * Math.sin(th) * Math.cos(ph), rad * Math.sin(th) * Math.sin(ph), rad * Math.cos(th) * 0.6, jitter([1.0, 0.86, 0.6]), 0.7 + r() * 0.8, 0.12);
  }
  // Bar: half-length 5 kpc at BAR_ANGLE from the Sun–centre line (near end toward positive longitudes).
  const bAng = (BAR_ANGLE_DEG * Math.PI) / 180;
  for (let k = 0; k < N.bar; k++) {
    const s = (r() * 2 - 1) * BAR_HALF_KPC * Math.sqrt(r());
    const across = gauss(r) * 0.6 * (1 - 0.5 * Math.abs(s) / BAR_HALF_KPC), zz = gauss(r) * 0.4;
    // Bar axis direction in the frame: azimuth β = BAR_ANGLE.
    const ax = -Math.cos(bAng), ay = Math.sin(bAng);
    put(s * ax - across * ay, s * ay + across * ax, zz, jitter([1.0, 0.88, 0.66]), 0.7 + r() * 0.8, 0.16);
  }
  // Arms: Gaussian ribbons; density ∝ weight × arc length. Young blue stars + pink H II regions.
  // The fits cover only the azimuths where masers were measured (mostly the Sun's side of the Galaxy); beyond
  // them each arm is *extrapolated* with its outer pitch angle for a further 240° (and 60° inward), drawn dimmer
  // and without H II regions, and truncated between 2.5 and 15 kpc. The far side of the Milky Way is a guess.
  const EXT_OUT = 240, EXT_IN = 60;
  const armLen = (a: ArmSpec, b0: number, b1: number) => { let L = 0; for (let b = b0; b < b1; b += 1) { const R1 = armRadius(a, b), R2 = armRadius(a, b + 1); L += Math.hypot(R2 - R1, ((R1 + R2) / 2) * (Math.PI / 180)); } return L; };
  const ranges = ARMS.map((a) => (a.id === 'arm-3kpc' ? [a.betaMin, a.betaMax] : [a.betaMin - EXT_IN, a.betaMax + EXT_OUT]));
  const weights = ARMS.map((a, i2) => a.weight * armLen(a, ranges[i2][0], ranges[i2][1]));
  const wsum = weights.reduce((x, y) => x + y, 0);
  ARMS.forEach((a, ai) => {
    const n = Math.round((N.arms * weights[ai]) / wsum);
    const c = linearRgb(a.color);
    const [b0, b1] = ranges[ai];
    for (let k = 0; k < n; k++) {
      const beta = b0 + r() * (b1 - b0);
      const fitted = beta >= a.betaMin && beta <= a.betaMax;
      const R0 = armRadius(a, beta);
      if (R0 < 2.5 || R0 > 15) continue;
      const R = R0 + gauss(r) * a.width * (fitted ? 1 : 1.6);
      const hii = fitted && r() < 0.025;
      const inner = R < R0;   // dust lane on the inner (concave) edge: slightly dimmer and redder
      const colour: [number, number, number] = hii ? [1.0, 0.55, 0.7] : inner ? [c[0] * 0.9, c[1] * 0.8, c[2] * 0.75] : [c[0], c[1], c[2]];
      cyl(R, (beta * Math.PI) / 180, gauss(r) * 0.08, jitter(colour, 0.05), hii ? 2.4 + r() * 1.6 : 0.7 + r() * 0.9, (hii ? 0.7 : fitted ? 0.38 : 0.24) * Math.min(1, R / 4));
    }
  });
  return { pos: pos.subarray(0, i * 3), col: col.subarray(0, i * 3), size: size.subarray(0, i), alpha: alpha.subarray(0, i), count: i };
}
