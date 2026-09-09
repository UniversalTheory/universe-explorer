import * as THREE from 'three';
import type { BodyDef } from '@/data/catalog';
import { GLOW_FRAG, GLOW_POINT_FRAG, GLOW_POINT_VERT, GLOW_VERT, SUN_FRAG, SUN_VERT } from './shaders';
import { loadTexture } from './Textures';

/**
 * A star drawn as a sphere: animated surface shader (tinted by the star's colour), additive
 * glow, and, for the Sun only, the scene's point light. Other stars have no minimum pixel
 * size; below ~1.5 px they hand over to the point cloud (`sphereVisible` = false).
 */
export class SunObject {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly light: THREE.PointLight | null;
  readonly glow: THREE.Mesh;
  /** Pixel-sized glow used when the Sun is far away (see GLOW_POINT_VERT). */
  readonly glowPoint: THREE.Points;
  private uniforms = { uMap: { value: null as THREE.Texture | null }, uTime: { value: 0 }, uHot: { value: new THREE.Color(1.0, 0.95, 0.75) }, uCool: { value: new THREE.Color(1.0, 0.55, 0.15) }, uMono: { value: 0 } };
  /** Whether the sphere (rather than a catalogue point) is currently drawn. */
  sphereVisible = true;
  available = true;
  private glowUniforms = { uColor: { value: new THREE.Color('#ffd9a0') }, uStrength: { value: 1 } };
  private glowPointUniforms = { uColor: { value: new THREE.Color('#ffd9a0') }, uStrength: { value: 0.85 }, uSizePx: { value: 60 } };
  displayScale = 1;
  helio: [number, number, number] = [0, 0, 0];
  screen = { x: 0, y: 0, visible: false, radiusPx: 0, distance: 0 };

  constructor(readonly def: BodyDef, readonly isSun = true) {
    const mat = new THREE.ShaderMaterial({ vertexShader: SUN_VERT, fragmentShader: SUN_FRAG, uniforms: this.uniforms });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, isSun ? 96 : 48, isSun ? 64 : 32), mat);
    this.mesh.name = def.id;
    this.group.add(this.mesh);
    void loadTexture(def.texture ?? 'textures/2k_sun.jpg').then((t) => { this.uniforms.uMap.value = t; });
    if (!isSun) {
      // Granule palette from the star's colour: bright cells lean toward white, dark lanes are the colour dimmed.
      // (The texture is still the Sun's, so the pattern is Sun-like; the hue is the star's.)
      const c = new THREE.Color(def.color);
      const hot = c.clone().lerp(new THREE.Color(1, 1, 1), 0.45);
      const cool = c.clone().multiplyScalar(0.55);
      this.uniforms.uHot.value.copy(hot);
      this.uniforms.uCool.value.copy(cool);
      this.uniforms.uMono.value = 1;
      this.glowUniforms.uColor.value.copy(c);
      this.glowPointUniforms.uColor.value.copy(c);
    }

    const glowMat = new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, uniforms: this.glowUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
    this.glow.renderOrder = -1;
    this.group.add(this.glow);
    const pointGeo = new THREE.BufferGeometry();
    pointGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    const pointMat = new THREE.ShaderMaterial({ vertexShader: GLOW_POINT_VERT, fragmentShader: GLOW_POINT_FRAG, uniforms: this.glowPointUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.glowPoint = new THREE.Points(pointGeo, pointMat);
    this.glowPoint.renderOrder = -1;
    this.glowPoint.frustumCulled = false;
    this.group.add(this.glowPoint);

    if (isSun) {
      this.light = new THREE.PointLight(0xfff4e0, 2.6, 0, 0);
      this.group.add(this.light);
      this.group.add(new THREE.AmbientLight(0xffffff, 0.06));
    } else this.light = null;
  }

  setVisible(v: boolean) { this.group.visible = v; }

  update(cameraPos: THREE.Vector3, cameraQuat: THREE.Quaternion, minAngular: number, pixelsPerRadian: number, elapsed: number, pixelRatio = 1) {
    const R = this.def.radius;
    const dist = this.group.position.distanceTo(cameraPos);
    let scale = 1;
    if (minAngular > 0) { const wanted = minAngular * 0.8 * dist; if (wanted > R) scale = wanted / R; }
    this.displayScale = scale;
    this.mesh.scale.setScalar(R * scale);
    this.uniforms.uTime.value = elapsed;
    // Glow billboard, larger when the Sun is small on screen.
    const apparentPx = (R * scale * pixelsPerRadian) / dist;
    // Other stars: below ~1.5 px the point cloud draws them instead.
    this.sphereVisible = this.isSun || apparentPx >= 1.5;
    this.mesh.visible = this.sphereVisible;
    if (!this.sphereVisible) { this.glow.visible = this.glowPoint.visible = false; this.screen.radiusPx = apparentPx; this.screen.distance = dist; return; }
    const glowFactor = apparentPx < 40 ? 6.5 : apparentPx < 200 ? 4.0 : 2.6;
    // Far away (small on screen) the glow is a point sprite; close up it is a world-sized quad.
    const usePoint = apparentPx < 40;
    this.glow.visible = !usePoint;
    this.glowPoint.visible = usePoint;
    if (usePoint) this.glowPointUniforms.uSizePx.value = Math.max(2, apparentPx * glowFactor * 2 * pixelRatio);
    this.glow.scale.setScalar(R * scale * glowFactor);
    this.glow.quaternion.copy(cameraQuat);
    this.glowUniforms.uStrength.value = apparentPx < 40 ? 0.85 : 0.6;
    this.screen.radiusPx = apparentPx;
    this.screen.distance = dist;
  }
}
