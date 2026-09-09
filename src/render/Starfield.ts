/**
 * Background: the ESO Milky Way panorama on an inverted sphere, drawn in a separate
 * rotation-only scene behind everything. (The stars themselves are 3D points in the
 * main scene, see StarCloud.)
 */
import * as THREE from 'three';
import { EQJ_TO_ECL, GAL_TO_EQJ } from '@/ephemeris/frames';
import { mmul } from '@/core/math3';
import { loadTexture } from './Textures';

export class Starfield {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private sky?: THREE.Mesh;
  private skyMat?: THREE.MeshBasicMaterial;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  }

  async load() {
    // Milky Way panorama in galactic coordinates (loaded in the background; large file).
    void this.loadSky();
  }

  private async loadSky() {
    try {
      const tex = await loadTexture('textures/eso_milky_way.jpg');
      tex.repeat.x = -1; // inside of the sphere: un-mirror
      tex.wrapS = THREE.RepeatWrapping;
      this.skyMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, transparent: true, opacity: 0.85 });
      this.sky = new THREE.Mesh(new THREE.SphereGeometry(95, 48, 24), this.skyMat);
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

  /** Render behind the main scene. `opacity` lets the panorama fade out far from the Sun. */
  render(renderer: THREE.WebGLRenderer, mainCamera: THREE.PerspectiveCamera, visible: boolean, opacity = 0.85) {
    if (!visible || !this.sky) return;
    this.camera.fov = mainCamera.fov;
    this.camera.aspect = mainCamera.aspect;
    this.camera.quaternion.copy(mainCamera.quaternion);
    this.camera.updateProjectionMatrix();
    if (this.skyMat) this.skyMat.opacity = opacity;
    renderer.render(this.scene, this.camera);
  }
}
