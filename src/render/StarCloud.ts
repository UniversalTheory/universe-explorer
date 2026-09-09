/**
 * The stars as a 3D point cloud in the main scene. Every catalogued star sits at its
 * true position for the simulation time (proper motion + radial velocity), relative
 * to the floating origin. Positions are kept as doubles on the CPU and the float32
 * attribute is rewritten only when the origin or the time has moved enough to matter,
 * so the cloud stays jitter-free when the camera is parked next to a star.
 *
 * Point size and brightness follow the apparent magnitude *from the camera's position*,
 * computed in the vertex shader from absolute magnitude and distance.
 */
import * as THREE from 'three';
import type { Vec3 } from '@/core/math3';
import { bvToRgb, type StarCatalog } from '@/ephemeris/stars';
import { STARCLOUD_FRAG, STARCLOUD_VERT } from './shaders';

/** Rewrite when the origin moved more than this (km) … */
const REBASE_ORIGIN_KM = 1e7;
/** … or the time moved more than this (Julian years). */
const REBASE_YEARS = 0.02;
const REBASE_MIN_INTERVAL_MS = 80;

export class StarCloud {
  readonly group = new THREE.Group();
  private points!: THREE.Points;
  private geometry!: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private pos!: Float32Array;
  private hide!: Float32Array;
  private lastOrigin: Vec3 = [NaN, NaN, NaN];
  private lastYears = NaN;
  private lastRebase = 0;
  private hidden = new Set<number>();
  private count = 0;

  constructor(private catalog: StarCatalog, pixelRatio: number) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: STARCLOUD_VERT, fragmentShader: STARCLOUD_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uPixelRatio: { value: pixelRatio }, uPxPerRad: { value: 1000 }, uBoost: { value: 1 } },
    });
    this.rebuild();
  }

  /** (Re)create the geometry for the catalogue's current size (called again after the deep tier loads). */
  rebuild() {
    const n = this.catalog.count;
    this.count = n;
    if (this.points) { this.group.remove(this.points); this.geometry.dispose(); }
    this.pos = new Float32Array(n * 3);
    this.hide = new Float32Array(n);
    const col = new Float32Array(n * 3), abs = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const [r, g, b] = bvToRgb(this.catalog.ci[i]);
      col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
      abs[i] = this.catalog.absMag[i];
    }
    for (const i of this.hidden) if (i < n) this.hide[i] = 1;
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    this.geometry.setAttribute('aAbsMag', new THREE.BufferAttribute(abs, 1));
    this.geometry.setAttribute('aHide', new THREE.BufferAttribute(this.hide, 1));
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = -2;
    this.group.add(this.points);
    this.lastOrigin = [NaN, NaN, NaN];
  }

  /** Hide the point of a star whose sphere mesh is being drawn instead. */
  setHidden(i: number, hidden: boolean) {
    if (hidden === this.hidden.has(i)) return;
    if (hidden) this.hidden.add(i); else this.hidden.delete(i);
    if (i < this.count) { this.hide[i] = hidden ? 1 : 0; this.geometry.getAttribute('aHide').needsUpdate = true; }
  }

  /**
   * @param origin  floating origin, heliocentric ECL km
   * @param years   Julian years since J2000
   */
  update(origin: Vec3, years: number, pxPerRad: number, pixelRatio: number, boost: number) {
    this.material.uniforms.uPxPerRad.value = pxPerRad;
    this.material.uniforms.uPixelRatio.value = pixelRatio;
    this.material.uniforms.uBoost.value = boost;
    const now = performance.now();
    const moved = !isFinite(this.lastOrigin[0]) || Math.abs(origin[0] - this.lastOrigin[0]) + Math.abs(origin[1] - this.lastOrigin[1]) + Math.abs(origin[2] - this.lastOrigin[2]) > REBASE_ORIGIN_KM;
    const aged = !isFinite(this.lastYears) || Math.abs(years - this.lastYears) > REBASE_YEARS;
    if ((moved || aged) && (now - this.lastRebase > REBASE_MIN_INTERVAL_MS || !isFinite(this.lastOrigin[0]))) this.rebase(origin, years, now);
  }

  private rebase(origin: Vec3, years: number, now: number) {
    const c = this.catalog, n = this.count, p = this.pos, e = c.ecl, v = c.velKmYr;
    const ox = origin[0], oy = origin[1], oz = origin[2];
    for (let i = 0, k = 0; i < n; i++, k += 3) {
      // ECL -> Three axes (x, z, -y) after subtracting the origin in double precision.
      const x = e[k] + v[k] * years - ox, y = e[k + 1] + v[k + 1] * years - oy, z = e[k + 2] + v[k + 2] * years - oz;
      p[k] = x; p[k + 1] = z; p[k + 2] = -y;
    }
    this.geometry.getAttribute('position').needsUpdate = true;
    this.lastOrigin = [ox, oy, oz];
    this.lastYears = years;
    this.lastRebase = now;
  }

  setVisible(v: boolean) { this.group.visible = v; }
}
