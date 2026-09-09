/**
 * Black holes and pulsar beams.
 *
 * A black hole is drawn as a black sphere of its Schwarzschild radius (exaggerated to a
 * minimum pixel size in visual mode like every other body), a thin bright photon ring
 * facing the camera, and, for accreting systems, a tilted accretion disc whose
 * brightness falls off outward and is boosted on the approaching side (Doppler beaming).
 * Far away it is a small orange point sprite so it can be found at all.
 */
import * as THREE from 'three';
import type { BodyDef } from '@/data/catalog';
import { BH_DISC_FRAG, BH_DISC_VERT, BH_RING_FRAG, GLOW_POINT_FRAG, GLOW_POINT_VERT } from './shaders';

export class BlackHoleObject {
  readonly group = new THREE.Group();
  readonly sphere: THREE.Mesh;
  readonly ring: THREE.Mesh;
  readonly disc?: THREE.Mesh;
  readonly glowPoint: THREE.Points;
  private ringMat: THREE.ShaderMaterial;
  private discMat?: THREE.ShaderMaterial;
  private glowUniforms = { uColor: { value: new THREE.Color('#ffb070') }, uStrength: { value: 0.8 }, uSizePx: { value: 20 } };
  displayScale = 1;
  sphereVisible = true;
  available = true;
  helio: [number, number, number] = [0, 0, 0];
  screen = { x: 0, y: 0, visible: false, radiusPx: 0, distance: 0 };

  constructor(readonly def: BodyDef, readonly accreting: boolean) {
    this.sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    this.sphere.name = def.id;
    this.group.add(this.sphere);
    // Photon ring: a thin annulus just outside the shadow, always facing the camera.
    this.ringMat = new THREE.ShaderMaterial({ vertexShader: BH_DISC_VERT, fragmentShader: BH_RING_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uInner: { value: 1.0 }, uOuter: { value: 1.6 }, uTime: { value: 0 } } });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.6, 96), this.ringMat);
    this.ring.renderOrder = 2;
    this.group.add(this.ring);
    if (accreting) {
      this.discMat = new THREE.ShaderMaterial({ vertexShader: BH_DISC_VERT, fragmentShader: BH_DISC_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uInner: { value: 3.0 }, uOuter: { value: 14.0 }, uTime: { value: 0 } } });
      this.disc = new THREE.Mesh(new THREE.RingGeometry(3.0, 14.0, 128, 4), this.discMat);
      // Oriented each frame ~55° from the line of sight so it never degenerates into an edge-on sliver.
      this.disc.renderOrder = 1;
      this.group.add(this.disc);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    this.glowPoint = new THREE.Points(geo, new THREE.ShaderMaterial({ vertexShader: GLOW_POINT_VERT, fragmentShader: GLOW_POINT_FRAG, uniforms: this.glowUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glowPoint.frustumCulled = false;
    this.group.add(this.glowPoint);
  }

  update(cameraPos: THREE.Vector3, cameraQuat: THREE.Quaternion, minAngular: number, pixelsPerRadian: number, elapsed: number, pixelRatio = 1) {
    const R = this.def.radius;
    const dist = this.group.position.distanceTo(cameraPos);
    let scale = 1;
    if (minAngular > 0) { const wanted = minAngular * 0.8 * dist; if (wanted > R) scale = wanted / R; }
    this.displayScale = scale;
    const r = R * scale;
    this.sphere.scale.setScalar(r);
    this.ring.scale.setScalar(r);
    this.ring.quaternion.copy(cameraQuat);
    this.ringMat.uniforms.uTime.value = elapsed;
    if (this.disc && this.discMat) {
      this.disc.scale.setScalar(r);
      this.discMat.uniforms.uTime.value = elapsed;
      _d.copy(cameraPos).sub(this.group.position).normalize();
      _up.set(0, 1, 0).addScaledVector(_d, -_d.y).normalize();      // world up, made perpendicular to the view direction
      _n.copy(_d).multiplyScalar(0.6).addScaledVector(_up, 0.8).normalize();
      this.disc.quaternion.setFromUnitVectors(_z, _n);
    }
    const apparentPx = (r * pixelsPerRadian) / dist;
    this.sphereVisible = apparentPx >= 1.5;
    this.sphere.visible = this.ring.visible = this.sphereVisible;
    if (this.disc) this.disc.visible = this.sphereVisible;
    this.glowPoint.visible = apparentPx < 12;
    this.glowUniforms.uSizePx.value = Math.max(3, Math.min(40, apparentPx * 5)) * pixelRatio;
    this.screen.radiusPx = this.disc ? apparentPx * 6 : apparentPx * 1.6;
    this.screen.distance = dist;
  }

  setVisible(v: boolean) { this.group.visible = v; }
}

/** Two additive beam cones along a magnetic axis tilted from the spin axis, rotating at the pulsar's period (slowed for display when faster than 0.35 s). */
export class PulsarBeams {
  readonly group = new THREE.Group();
  private axis = new THREE.Group();
  readonly displayPeriod: number;
  constructor(readonly spinSeconds: number) {
    this.displayPeriod = Math.max(spinSeconds, 0.35);
    const mat = new THREE.MeshBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (const sgn of [1, -1]) {
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.01, 1, 24, 1, true), mat);
      cone.position.y = sgn * 0.5;
      if (sgn < 0) cone.rotation.x = Math.PI;
      this.axis.add(cone);
    }
    this.axis.rotation.z = 0.6; // magnetic axis tilted 34° from the spin axis
    this.group.add(this.axis);
  }
  /** @param lengthKm beam length in world km, @param elapsed wall-clock seconds */
  update(lengthKm: number, elapsed: number) {
    this.group.scale.setScalar(lengthKm);
    this.group.rotation.y = ((elapsed % this.displayPeriod) / this.displayPeriod) * 2 * Math.PI;
  }
}
const _d = new THREE.Vector3();
const _up = new THREE.Vector3();
const _n = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
