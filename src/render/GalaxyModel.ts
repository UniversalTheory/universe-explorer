/**
 * The Milky Way as a point-sprite model in the far scene (units of FAR_UNIT_KM): exponential thin
 * and thick discs, a Hernquist bulge, a bar at 28° to the Sun–centre line, and the Reid et al. 2019
 * spiral arms as Gaussian ribbons of young blue stars with a sprinkling of pink H II regions.
 *
 * The ~300,000 points are generated in `galaxy-gen.ts` inside a Web Worker (`request()`), because
 * doing it inline costs ~130 ms on a desktop and more on a phone. Until the buffers arrive the model
 * is simply empty; nothing else waits on it. The points sit in a group rotated into Three axes, so
 * the model lines up with the real stars, nebulae and Sgr A* drawn on top of it.
 *
 * The optional map plane carries the NASA/JPL-Caltech/ESO/R. Hurt artist's impression
 * (CC BY 4.0), scaled so the Sun sits about 8 kpc from the centre. Its scale and
 * orientation are approximate: it is a picture, not a measurement.
 */
import * as THREE from 'three';
import { EQJ_TO_ECL, GAL_TO_EQJ, KPC_KM } from '@/ephemeris/frames';
import { mmul } from '@/core/math3';
import { R0_KPC } from '@/data/galaxy';
import { FAR_UNIT_KM } from './DeepSkyObject';
import { generateGalaxy, type GalaxyBuffers } from './galaxy-gen';
import { GALAXY_FRAG, GALAXY_VERT } from './shaders';
import { loadTexture } from './Textures';

const KPC = KPC_KM / FAR_UNIT_KM;   // far units per kpc

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
  private generated?: Promise<void>;
  /** Points in the model; 0 until the worker delivers. */
  count = 0;

  constructor(private quality: 'high' | 'low', pixelRatio: number) {
    this.group.quaternion.copy(galacticQuaternion());
    const geo = new THREE.BufferGeometry();
    for (const [name, items] of [['position', 3], ['aColor', 3], ['aSize', 1], ['aAlpha', 1]] as [string, number][]) {
      geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(0), items));
    }
    this.material = new THREE.ShaderMaterial({
      vertexShader: GALAXY_VERT, fragmentShader: GALAXY_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uPixelRatio: { value: pixelRatio }, uPxPerRad: { value: 1000 }, uOpacity: { value: 0 }, uKpc: { value: KPC } },
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = -3;
    this.group.add(this.points);
  }

  /**
   * Start generating the points off the main thread. Idempotent, and safe to call before the model is
   * needed: `update` shows nothing until the buffers land. Falls back to generating inline if the
   * browser refuses the worker.
   */
  request(): Promise<void> {
    this.generated ??= new Promise<void>((resolve) => {
      let worker: Worker;
      try {
        worker = new Worker(new URL('./galaxy.worker.ts', import.meta.url), { type: 'module' });
      } catch {
        this.fill(generateGalaxy(this.quality, KPC));
        resolve();
        return;
      }
      worker.onmessage = (e: MessageEvent<GalaxyBuffers>) => { this.fill(e.data); worker.terminate(); resolve(); };
      worker.onerror = () => { this.fill(generateGalaxy(this.quality, KPC)); worker.terminate(); resolve(); };
      worker.postMessage({ quality: this.quality, kpc: KPC });
    });
    return this.generated;
  }

  private fill(b: GalaxyBuffers) {
    const geo = this.points.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(b.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(b.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(b.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(b.alpha, 1));
    this.count = b.count;
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
    this.points.visible = showPoints && opacity > 0.003 && this.count > 0;
    if (showMap) this.ensureMap();
    if (this.map && this.mapMat) { this.map.visible = showMap && opacity > 0.003; this.mapMat.opacity = 0.7 * opacity; }
  }

  setVisible(v: boolean) { this.group.visible = v; }
  /** Sun's position relative to the centre in the group's frame (far units): (+R₀, 0, +z☉). */
  static sunOffsetKpc(): [number, number, number] { return [R0_KPC, 0, 0.0208]; }
}
