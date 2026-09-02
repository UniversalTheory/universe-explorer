/**
 * Background: real stars (HYG catalogue) as points plus the ESO Milky Way
 * panorama on an inverted sphere, drawn in a separate rotation-only scene.
 */
import * as THREE from 'three';
import { EQJ_TO_ECL, GAL_TO_EQJ, raDecToVec, eclToThree } from '@/ephemeris/frames';
import { mapply, mmul } from '@/core/math3';
import { STARS_FRAG, STARS_VERT } from './shaders';
import { loadTexture } from './Textures';

/** B−V colour index -> approximate linear RGB. */
function bvToRgb(bv: number): [number, number, number] {
  const t = Math.max(-0.4, Math.min(2.0, bv));
  let r = 1, g = 1, b = 1;
  if (t < 0) { r = 0.62 + 0.38 * (t + 0.4) / 0.4; g = 0.75 + 0.25 * (t + 0.4) / 0.4; }
  else if (t < 0.4) { g = 1 - 0.05 * t / 0.4; b = 1 - 0.25 * t / 0.4; }
  else if (t < 1.5) { g = 0.95 - 0.35 * (t - 0.4) / 1.1; b = 0.75 - 0.55 * (t - 0.4) / 1.1; }
  else { g = 0.6 - 0.15 * (t - 1.5) / 0.5; b = 0.2; }
  return [r, g, b];
}

export class Starfield {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private stars?: THREE.Points;
  private sky?: THREE.Mesh;
  private material?: THREE.ShaderMaterial;
  readonly names: { dir: THREE.Vector3; name: string; mag: number }[] = [];

  constructor(private pixelRatio: number) {
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  }

  async load(base = 'data/') {
    const meta = (await (await fetch(base + 'ephemeris.json')).json()).stars as { file: string; count: number; stride: number; names: [number, string][] };
    const buf = new Float32Array(await (await fetch(base + meta.file)).arrayBuffer());
    const n = meta.count, stride = meta.stride;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), mag = new Float32Array(n);
    const eqjToThree = EQJ_TO_ECL;
    for (let i = 0; i < n; i++) {
      const ra = buf[i * stride], dec = buf[i * stride + 1];
      const v = eclToThree(mapply(eqjToThree, raDecToVec(ra, dec)));
      pos.set([v[0] * 90, v[1] * 90, v[2] * 90], i * 3);
      const [r, g, b] = bvToRgb(buf[i * stride + 3]);
      col.set([r, g, b], i * 3);
      mag[i] = buf[i * stride + 2];
    }
    const nameMap = new Map(meta.names);
    for (const [idx, name] of nameMap) {
      if (mag[idx] < 2.6) this.names.push({ dir: new THREE.Vector3(pos[idx * 3], pos[idx * 3 + 1], pos[idx * 3 + 2]).normalize(), name, mag: mag[idx] });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: STARS_VERT, fragmentShader: STARS_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uPixelRatio: { value: this.pixelRatio }, uScale: { value: 1 } },
    });
    this.stars = new THREE.Points(geo, this.material);
    this.scene.add(this.stars);

    // Milky Way panorama in galactic coordinates (loaded in the background; large file).
    void this.loadSky();
  }

  private async loadSky() {
    try {
      const tex = await loadTexture('textures/eso_milky_way.jpg');
      tex.repeat.x = -1; // inside of the sphere: un-mirror
      tex.wrapS = THREE.RepeatWrapping;
      const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, transparent: true, opacity: 0.85 });
      this.sky = new THREE.Mesh(new THREE.SphereGeometry(95, 48, 24), mat);
      // Local (galactic, Three-axised) -> world (ecliptic, Three-axised): P · EQJ_TO_ECL · GAL_TO_EQJ · Pᵀ
      const P: [number, number, number, number, number, number, number, number, number] = [1, 0, 0, 0, 0, 1, 0, -1, 0];
      const PT: typeof P = [1, 0, 0, 0, 0, -1, 0, 1, 0];
      const m = mmul(mmul(mmul(P, EQJ_TO_ECL), GAL_TO_EQJ), PT);
      const m4 = new THREE.Matrix4().set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
      this.sky.quaternion.setFromRotationMatrix(m4);
      this.sky.renderOrder = -1;
      this.scene.add(this.sky);
    } catch (e) { console.warn('Milky Way texture unavailable', e); }
  }

  /** Render behind the main scene. */
  render(renderer: THREE.WebGLRenderer, mainCamera: THREE.PerspectiveCamera, visible: boolean, fovScale: number) {
    if (!visible) return;
    this.camera.fov = mainCamera.fov;
    this.camera.aspect = mainCamera.aspect;
    this.camera.quaternion.copy(mainCamera.quaternion);
    this.camera.updateProjectionMatrix();
    if (this.material) this.material.uniforms.uScale.value = fovScale;
    renderer.render(this.scene, this.camera);
  }

  setPixelRatio(pr: number) { if (this.material) this.material.uniforms.uPixelRatio.value = pr; }
}
