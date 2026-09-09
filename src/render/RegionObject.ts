/**
 * Schematic regions (heliopause, Oort cloud, Local Bubble, Gould Belt, Radcliffe Wave):
 * translucent wireframe shells, rings and curves in the far scene, labelled as models.
 * A shell is hidden while the camera is inside it unless it is selected or focused,
 * so the Oort cloud does not draw lines across the Solar System view.
 */
import * as THREE from 'three';
import type { RegionDef } from '@/data/galaxy';
import { FAR_UNIT_KM } from './DeepSkyObject';

export class RegionObject {
  readonly group = new THREE.Group();
  available = true;
  helio: [number, number, number] = [0, 0, 0];
  screen = { x: 0, y: 0, visible: false, radiusPx: 0, distance: 0 };
  displayScale = 1;
  /** Bounding radius, far units. */
  readonly radius: number;
  private mesh?: THREE.Object3D;
  private mat?: THREE.Material;

  constructor(readonly def: RegionDef) {
    const sh = def.shape;
    this.radius = def.radius / FAR_UNIT_KM;
    const color = new THREE.Color(def.color);
    if (sh.kind === 'shell' || sh.kind === 'ellipsoid') {
      const mat = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: sh.opacity ?? 0.2, depthWrite: false, blending: THREE.AdditiveBlending });
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 18), mat);
      if (sh.kind === 'shell') m.scale.setScalar((sh.radiusKm ?? def.radius) / FAR_UNIT_KM);
      else { const [a, b, c] = sh.radii!; m.scale.set(a / FAR_UNIT_KM, b / FAR_UNIT_KM, c / FAR_UNIT_KM); }
      this.mesh = m; this.mat = mat;
    } else if (sh.kind === 'ring') {
      const R = (sh.radiusKm ?? def.radius) / FAR_UNIT_KM;
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: sh.opacity ?? 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 128; k++) { const t = (k / 128) * 2 * Math.PI; pts.push(new THREE.Vector3(R * Math.cos(t), 0, R * Math.sin(t))); }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
      line.rotation.x = ((sh.tiltDeg ?? 0) * Math.PI) / 180;
      this.mesh = line; this.mat = mat;
    } else if (sh.kind === 'wave' && sh.points) {
      // Points are heliocentric ECL km; the group sits at the def's fixed position, so make them relative.
      const [ox, oy, oz] = def.source.kind === 'fixed' ? def.source.pos : [0, 0, 0];
      const pts = sh.points.map((p) => new THREE.Vector3((p[0] - ox) / FAR_UNIT_KM, (p[2] - oz) / FAR_UNIT_KM, -(p[1] - oy) / FAR_UNIT_KM));
      const curve = new THREE.CatmullRomCurve3(pts);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: sh.opacity ?? 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
      this.mesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(120)), mat);
      this.mat = mat;
    }
    if (this.mesh) { this.mesh.frustumCulled = false; this.group.add(this.mesh); }
  }

  update(camFar: THREE.Vector3, pxPerRad: number, highlighted: boolean, layerOpacity: number) {
    const dist = this.group.position.distanceTo(camFar);
    this.screen.radiusPx = (this.radius / Math.max(dist, 1e-9)) * pxPerRad;
    this.screen.distance = dist * FAR_UNIT_KM;
    if (!this.mesh) return;
    const inside = this.def.shape.kind !== 'wave' && this.def.shape.kind !== 'ring' && dist < this.radius * 1.15;
    const big = this.screen.radiusPx > 3;
    this.mesh.visible = layerOpacity > 0 && big && (!inside || highlighted);
    if (this.mat && 'opacity' in this.mat) (this.mat as THREE.Material & { opacity: number }).opacity = (this.def.shape.opacity ?? 0.2) * layerOpacity * (highlighted ? 1.6 : 1);
  }

  setVisible(v: boolean) { this.group.visible = v; }
}
