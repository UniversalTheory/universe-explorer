/**
 * Comet activity: a coma glow and an anti-sunward tail whose size grows as
 * the comet approaches the Sun (roughly ∝ 1/r²). Purely visual.
 */
import * as THREE from 'three';
import { AU_KM } from '@/ephemeris/frames';
import { discSprite } from './Textures';

let COMA_TEX: THREE.Texture | null = null;

export class CometVisual {
  readonly group = new THREE.Group();
  private coma: THREE.Sprite;
  private tail: THREE.Line;
  private tailGeo = new THREE.BufferGeometry();
  private readonly segments = 40;

  constructor(color: string) {
    if (!COMA_TEX) COMA_TEX = discSprite(128, 0.15);
    this.coma = new THREE.Sprite(new THREE.SpriteMaterial({ map: COMA_TEX, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
    this.group.add(this.coma);
    const pos = new Float32Array((this.segments + 1) * 3);
    const col = new Float32Array((this.segments + 1) * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i <= this.segments; i++) {
      const f = 1 - i / this.segments;
      col.set([c.r * f, c.g * f, c.b * f], i * 3);
    }
    this.tailGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.tailGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.tail = new THREE.Line(this.tailGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.tail.frustumCulled = false;
    this.group.add(this.tail);
  }

  /**
   * @param helioDistKm distance from the Sun
   * @param antiSun unit vector pointing away from the Sun (world axes)
   * @param velDir unit heliocentric velocity direction (dust tail curves slightly toward it)
   * @param camDist distance from the camera (for a minimum on-screen size)
   */
  update(helioDistKm: number, antiSun: THREE.Vector3, velDir: THREE.Vector3, camDist: number, pxPerRad: number) {
    const rAU = helioDistKm / AU_KM;
    const activity = Math.min(1, 1 / (rAU * rAU));           // 1 at 1 AU, fades beyond ~3 AU
    const visible = rAU < 4.5;
    this.group.visible = visible;
    if (!visible) return;
    // Coma: ~50,000 km at 1 AU, but never smaller than a few pixels.
    const comaKm = Math.max(5e4 * activity, (6 * camDist) / pxPerRad);
    this.coma.scale.set(comaKm, comaKm, 1);
    (this.coma.material as THREE.SpriteMaterial).opacity = 0.25 + 0.6 * activity;
    // Tail: up to ~0.3 AU at 1 AU, slightly curved against the motion.
    const lengthKm = 0.3 * AU_KM * activity;
    const arr = this.tailGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i <= this.segments; i++) {
      const s = i / this.segments;
      const t = s * lengthKm;
      const curve = -0.18 * s * s * lengthKm;
      arr.setXYZ(i, antiSun.x * t + velDir.x * curve, antiSun.y * t + velDir.y * curve, antiSun.z * t + velDir.z * curve);
    }
    arr.needsUpdate = true;
    (this.tail.material as THREE.LineBasicMaterial).opacity = 0.35 + 0.5 * activity;
  }
}
