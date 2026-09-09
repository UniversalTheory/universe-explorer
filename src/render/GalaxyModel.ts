/**
 * The Milky Way as a point-sprite model in the far scene (units of FAR_UNIT_KM), built from
 * the structural parameters in src/data/galaxy.ts: exponential thin and thick discs, a
 * Hernquist bulge, a bar at 28° to the Sun–centre line, and the Reid et al. 2019 spiral
 * arms as Gaussian ribbons of young blue stars with a sprinkling of pink H II regions.
 *
 * Everything is generated in the Sun-centred Galactic frame relative to the Galactic centre
 * (x toward the Sun–centre line, y toward l = 90°, z toward the north Galactic pole) and
 * placed inside a group rotated into Three axes, so the model lines up with the real stars,
 * nebulae and Sgr A* that sit on top of it.
 *
 * The optional map plane carries the NASA/JPL-Caltech/ESO/R. Hurt artist's impression
 * (CC BY 4.0), scaled so the Sun sits about 8 kpc from the centre. Its scale and
 * orientation are approximate: it is a picture, not a measurement.
 */
import * as THREE from 'three';
import { EQJ_TO_ECL, GAL_TO_EQJ, KPC_KM } from '@/ephemeris/frames';
import { mmul } from '@/core/math3';
import { ARMS, armRadius, BAR_ANGLE_DEG, BAR_HALF_KPC, R0_KPC, type ArmSpec } from '@/data/galaxy';
import { FAR_UNIT_KM } from './DeepSkyObject';
import { GALAXY_FRAG, GALAXY_VERT } from './shaders';
import { loadTexture } from './Textures';

const KPC = KPC_KM / FAR_UNIT_KM;   // far units per kpc

function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1000000) / 1000000; }; }
function gauss(r: () => number) { const u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/** Galactic-frame rotation (P · EQJ_TO_ECL · GAL_TO_EQJ · Pᵀ), as in Starfield. */
export function galacticQuaternion(): THREE.Quaternion {
  const P: [number, number, number, number, number, number, number, number, number] = [1, 0, 0, 0, 0, 1, 0, -1, 0];
  const PT: typeof P = [1, 0, 0, 0, 0, -1, 0, 1, 0];
  const m = mmul(mmul(mmul(P, EQJ_TO_ECL), GAL_TO_EQJ), PT);
  const m4 = new THREE.Matrix4().set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
  return new THREE.Quaternion().setFromRotationMatrix(m4);
}

export class GalaxyModel {
  /** Placed at the Galactic centre each frame (far units), rotated into Three axes. */
  readonly group = new THREE.Group();
  private points: THREE.Points;
  private material: THREE.ShaderMaterial;
  private map?: THREE.Mesh;
  private mapMat?: THREE.MeshBasicMaterial;
  private mapRequested = false;
  readonly count: number;

  constructor(quality: 'high' | 'low', pixelRatio: number) {
    this.group.quaternion.copy(galacticQuaternion());
    const q = quality === 'high' ? 1 : 0.5;
    const N = { thin: 150000 * q, thick: 20000 * q, bulge: 18000 * q, bar: 16000 * q, arms: 110000 * q };
    const total = Math.round(N.thin + N.thick + N.bulge + N.bar + N.arms);
    const pos = new Float32Array(total * 3), col = new Float32Array(total * 3), size = new Float32Array(total), alpha = new Float32Array(total);
    const r = rng(20260909);
    let i = 0;
    // The group's quaternion maps *Three-permuted* Galactic coordinates (gx, gz, −gy) to world axes (as the
    // panorama sphere does), so store points that way.
    const put = (x: number, y: number, z: number, c: [number, number, number], s: number, a: number) => {
      pos[i * 3] = x * KPC; pos[i * 3 + 1] = z * KPC; pos[i * 3 + 2] = -y * KPC;
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
    const weights = ARMS.map((a, i) => a.weight * armLen(a, ranges[i][0], ranges[i][1]));
    const wsum = weights.reduce((x, y) => x + y, 0);
    ARMS.forEach((a, ai) => {
      const n = Math.round((N.arms * weights[ai]) / wsum);
      const c = new THREE.Color(a.color);
      const [b0, b1] = ranges[ai];
      for (let k = 0; k < n; k++) {
        const beta = b0 + r() * (b1 - b0);
        const fitted = beta >= a.betaMin && beta <= a.betaMax;
        const R0 = armRadius(a, beta);
        if (R0 < 2.5 || R0 > 15) continue;
        const R = R0 + gauss(r) * a.width * (fitted ? 1 : 1.6);
        const hii = fitted && r() < 0.025;
        const inner = R < R0;   // dust lane on the inner (concave) edge: slightly dimmer and redder
        const colour: [number, number, number] = hii ? [1.0, 0.55, 0.7] : inner ? [c.r * 0.9, c.g * 0.8, c.b * 0.75] : [c.r, c.g, c.b];
        cyl(R, (beta * Math.PI) / 180, gauss(r) * 0.08, jitter(colour, 0.05), hii ? 2.4 + r() * 1.6 : 0.7 + r() * 0.9, (hii ? 0.7 : fitted ? 0.38 : 0.24) * Math.min(1, R / 4));
      }
    });
    this.count = i;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, i * 3), 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col.subarray(0, i * 3), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size.subarray(0, i), 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha.subarray(0, i), 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: GALAXY_VERT, fragmentShader: GALAXY_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uPixelRatio: { value: pixelRatio }, uPxPerRad: { value: 1000 }, uOpacity: { value: 0 }, uKpc: { value: KPC } },
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = -3;
    this.group.add(this.points);
  }

  /** Lazily add the artwork map plane (34 kpc across, in the Galactic plane, Sun toward image-bottom). */
  private ensureMap() {
    if (this.mapRequested) return;
    this.mapRequested = true;
    void loadTexture('textures/eso1339g_milky_way_map.jpg').then((tex) => {
      this.mapMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const size = 34 * KPC;
      this.map = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.mapMat);
      // Local axes are (gx, gz, −gy): lay the plane in local X–Z (normal = Galactic north), then turn it so image-up
      // points to Galactic +x (the Sun is at image-bottom) and image-right to Galactic −y.
      const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
      this.map.quaternion.copy(qy).multiply(qx);
      this.map.renderOrder = -4;
      this.map.frustumCulled = false;
      this.group.add(this.map);
    }).catch(() => { /* no map */ });
  }

  /**
   * @param centreFar   Galactic centre position in far units
   * @param opacity     cross-fade 0..1
   * @param showMap     draw the artwork plane
   */
  update(centreFar: THREE.Vector3, pxPerRad: number, pixelRatio: number, opacity: number, showPoints: boolean, showMap: boolean) {
    this.group.position.copy(centreFar);
    this.material.uniforms.uPxPerRad.value = pxPerRad;
    this.material.uniforms.uPixelRatio.value = pixelRatio;
    this.material.uniforms.uOpacity.value = opacity;
    this.points.visible = showPoints && opacity > 0.003;
    if (showMap) this.ensureMap();
    if (this.map && this.mapMat) { this.map.visible = showMap && opacity > 0.003; this.mapMat.opacity = 0.7 * opacity; }
  }

  setVisible(v: boolean) { this.group.visible = v; }
  /** Sun's position relative to the centre in the group's frame (far units): (+R₀, 0, +z☉). */
  static sunOffsetKpc(): [number, number, number] { return [R0_KPC, 0, 0.0208]; }
}
