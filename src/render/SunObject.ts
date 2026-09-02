import * as THREE from 'three';
import type { BodyDef } from '@/data/catalog';
import { GLOW_FRAG, GLOW_VERT, SUN_FRAG, SUN_VERT } from './shaders';
import { loadTexture } from './Textures';

/** The Sun: animated surface shader, additive corona glow, and the scene's point light. */
export class SunObject {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly light: THREE.PointLight;
  readonly glow: THREE.Mesh;
  private uniforms = { uMap: { value: null as THREE.Texture | null }, uTime: { value: 0 } };
  private glowUniforms = { uColor: { value: new THREE.Color('#ffd9a0') }, uStrength: { value: 1 } };
  displayScale = 1;
  helio: [number, number, number] = [0, 0, 0];
  screen = { x: 0, y: 0, visible: false, radiusPx: 0, distance: 0 };

  constructor(readonly def: BodyDef) {
    const mat = new THREE.ShaderMaterial({ vertexShader: SUN_VERT, fragmentShader: SUN_FRAG, uniforms: this.uniforms });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), mat);
    this.mesh.name = 'sun';
    this.group.add(this.mesh);
    void loadTexture(def.texture!).then((t) => { this.uniforms.uMap.value = t; });

    const glowMat = new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, uniforms: this.glowUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
    this.glow.renderOrder = -1;
    this.group.add(this.glow);

    this.light = new THREE.PointLight(0xfff4e0, 2.6, 0, 0);
    this.group.add(this.light);
    this.group.add(new THREE.AmbientLight(0xffffff, 0.06));
  }

  update(cameraPos: THREE.Vector3, cameraQuat: THREE.Quaternion, minAngular: number, pixelsPerRadian: number, elapsed: number) {
    const R = this.def.radius;
    const dist = this.group.position.distanceTo(cameraPos);
    let scale = 1;
    if (minAngular > 0) { const wanted = minAngular * 0.8 * dist; if (wanted > R) scale = wanted / R; }
    this.displayScale = scale;
    this.mesh.scale.setScalar(R * scale);
    this.uniforms.uTime.value = elapsed;
    // Glow billboard, larger when the Sun is small on screen.
    const apparentPx = (R * scale * pixelsPerRadian) / dist;
    const glowFactor = apparentPx < 40 ? 6.5 : apparentPx < 200 ? 4.0 : 2.6;
    this.glow.scale.setScalar(R * scale * glowFactor);
    this.glow.quaternion.copy(cameraQuat);
    this.glowUniforms.uStrength.value = apparentPx < 40 ? 0.85 : 0.6;
    this.screen.radiusPx = apparentPx;
    this.screen.distance = dist;
  }
}
