import * as THREE from 'three';
import type { Vec3 } from '@/core/math3';

/** A polyline orbit / trajectory, positioned relative to its parent body. */
export class OrbitLine {
  readonly line: THREE.Line;
  private geometry = new THREE.BufferGeometry();
  private material: THREE.LineBasicMaterial;
  pointCount = 0;

  constructor(color: string, opacity = 0.35) {
    this.material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    this.line = new THREE.Line(this.geometry, this.material);
    this.line.frustumCulled = false;
  }

  /** Points in ECL km relative to the parent. */
  setPoints(points: Vec3[]) {
    const arr = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      arr[i * 3] = p[0]; arr[i * 3 + 1] = p[2]; arr[i * 3 + 2] = -p[1];
    }
    this.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    this.geometry.computeBoundingSphere();
    this.pointCount = points.length;
  }
  set opacity(v: number) { this.material.opacity = v; }
  get opacity() { return this.material.opacity; }
  setVisible(v: boolean) { this.line.visible = v && this.pointCount > 1; }
  dispose() { this.geometry.dispose(); this.material.dispose(); }
}
