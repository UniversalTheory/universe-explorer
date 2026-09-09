/**
 * A deep-sky object in the scene.
 *
 *  - Nebulae, remnants and planetary nebulae: a photograph on a card in the plane of the sky
 *    (facing the Sun, north up), scaled to the object's physical size, drawn additively so its
 *    black background vanishes and stars shine through. The card fades as the viewing angle
 *    leaves the Sun's line of sight, because the picture is only right from here.
 *  - Clusters: a procedural point cloud (Plummer profile) sized to the real radius, plus a
 *    core glow for globulars.
 */
import * as THREE from 'three';
import type { BodyDef } from '@/data/catalog';
import type { DsoRecord } from '@/ephemeris/deepsky';
import { EQJ_TO_ECL, eclToThree } from '@/ephemeris/frames';
import { mapply } from '@/core/math3';
import { DSO_CARD_FRAG, DSO_CARD_VERT, DSO_POINTS_FRAG, DSO_POINTS_VERT } from './shaders';
import { discSprite, loadTexture } from './Textures';

/**
 * Deep-sky objects live in `Universe.farScene`, whose unit is FAR_UNIT_KM kilometres. World-sized quads at
 * 1e16–1e18 km rasterise wrongly (flat or bow-tie) when the GPU sees such coordinates; in the far scene the same
 * card is a few million units away and interpolates cleanly. Positions and sizes here are in far units.
 */
export const FAR_UNIT_KM = 1e9;

/** Celestial north pole in Three axes (constant). */
const POLE = (() => { const p = eclToThree(mapply(EQJ_TO_ECL, [0, 0, 1])); return new THREE.Vector3(p[0], p[1], p[2]); })();
let SOFT: THREE.Texture | null = null;

/** Deterministic pseudo-random in [0,1). */
function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }

export class DeepSkyObject {
  readonly group = new THREE.Group();
  available = true;
  helio: [number, number, number] = [0, 0, 0];
  screen = { x: 0, y: 0, visible: false, radiusPx: 0, distance: 0 };
  displayScale = 1;
  private card?: THREE.Mesh;
  private cardMat?: THREE.ShaderMaterial;
  private points?: THREE.Points;
  private pointsMat?: THREE.ShaderMaterial;
  private texRequested = false;
  /** Semi-axes, far units (km / FAR_UNIT_KM). */
  readonly a: number;
  readonly b: number;

  constructor(readonly def: BodyDef, readonly rec: DsoRecord, aKm: number, bKm: number, quality: 'high' | 'low') {
    this.a = aKm / FAR_UNIT_KM; this.b = bKm / FAR_UNIT_KM;
    this.group.name = def.id;
    // Clusters closer than ~700 ly (Hyades, Pleiades, Beehive…) are already in the star catalogue star by star,
    // so they get only a faint glow and a label rather than a synthetic cloud.
    if (def.type === 'cluster' && rec.ly >= 700) this.buildCluster(quality);
    else this.buildCard();
  }

  private buildCard() {
    if (!SOFT) SOFT = discSprite(128, 0.05);
    const aspect = this.rec.image?.aspect ?? 1;
    // The photo's long side spans the major axis; without a photo, a soft ellipse of the object's size.
    const w = 2 * this.a, h = this.rec.image ? (2 * this.a) / aspect : 2 * this.b;
    this.cardMat = new THREE.ShaderMaterial({
      vertexShader: DSO_CARD_VERT, fragmentShader: DSO_CARD_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uMap: { value: SOFT }, uOpacity: { value: 0 }, uTint: { value: new THREE.Color(this.rec.image ? '#ffffff' : this.def.color) }, uHasImage: { value: 0 } },
    });
    this.card = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.cardMat);
    this.card.renderOrder = -1;
    this.card.frustumCulled = false;
    this.group.add(this.card);
    if (this.rec.kind === 'dark' && !this.rec.image) this.card.visible = false;
  }

  private buildCluster(quality: 'high' | 'low') {
    const globular = this.rec.kind === 'globular';
    const n = (globular ? 2600 : 320) * (quality === 'high' ? 1 : 0.5);
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
    const r = rng(this.def.id.split('').reduce((h, c) => h * 31 + c.charCodeAt(0), 7));
    // Plummer sphere with scale radius a/3 (globular core is denser), truncated at the catalogued radius.
    const scale = globular ? this.a / 4 : this.a / 2;
    for (let i = 0; i < n; i++) {
      let rad = Infinity;
      while (rad > this.a) { const u = Math.max(1e-4, r()); rad = scale / Math.sqrt(Math.pow(u, -2 / 3) - 1); }
      const th = Math.acos(2 * r() - 1), ph = 2 * Math.PI * r();
      pos[i * 3] = rad * Math.sin(th) * Math.cos(ph); pos[i * 3 + 1] = rad * Math.sin(th) * Math.sin(ph); pos[i * 3 + 2] = rad * Math.cos(th);
      const t = r();
      // Globulars: old yellow/orange stars with a few blue stragglers; open clusters: blue-white with a few red giants.
      if (globular) { if (t < 0.06) col.set([0.75, 0.85, 1], i * 3); else if (t < 0.5) col.set([1, 0.92, 0.75], i * 3); else col.set([1, 0.8, 0.55], i * 3); }
      else { if (t < 0.08) col.set([1, 0.75, 0.5], i * 3); else if (t < 0.6) col.set([0.8, 0.88, 1], i * 3); else col.set([1, 1, 1], i * 3); }
      size[i] = 0.6 + 2.2 * Math.pow(r(), 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.pointsMat = new THREE.ShaderMaterial({
      vertexShader: DSO_POINTS_VERT, fragmentShader: DSO_POINTS_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uPixelRatio: { value: 1 }, uPxPerRad: { value: 1000 }, uRadiusKm: { value: this.a }, uOpacity: { value: 1 } },
    });
    this.points = new THREE.Points(geo, this.pointsMat);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    if (globular) {
      if (!SOFT) SOFT = discSprite(128, 0.05);
      this.cardMat = new THREE.ShaderMaterial({
        vertexShader: DSO_CARD_VERT, fragmentShader: DSO_CARD_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uMap: { value: SOFT }, uOpacity: { value: 0 }, uTint: { value: new THREE.Color('#ffe6b8') }, uHasImage: { value: 0 } },
      });
      this.card = new THREE.Mesh(new THREE.PlaneGeometry(this.a * 0.7, this.a * 0.7), this.cardMat);
      this.card.renderOrder = -1;
      this.card.frustumCulled = false;
      this.group.add(this.card);
    }
  }

  /**
   * @param camPos    camera position in far units
   * @param sunWorld  the Sun's position in far units (cards face it: the sky plane as seen from here)
   */
  update(camPos: THREE.Vector3, sunWorld: THREE.Vector3, pxPerRad: number, pixelRatio: number, layerOpacity: number) {
    const dist = this.group.position.distanceTo(camPos);
    const radiusPx = (this.a / dist) * pxPerRad;
    this.screen.radiusPx = radiusPx;
    this.screen.distance = dist * FAR_UNIT_KM;
    // Fade in between 0.6 and 3 px of apparent radius.
    const sizeFade = Math.min(1, Math.max(0, (radiusPx - 0.6) / 2.4));
    if (this.card && this.cardMat) {
      // Orient: normal toward the Sun, up toward celestial north.
      _n.copy(sunWorld).sub(this.group.position).normalize();
      _e.crossVectors(POLE, _n).normalize();      // east = pole × (Sun→object)… sign chosen so the picture is not mirrored
      if (_e.lengthSq() < 1e-6) _e.set(1, 0, 0);
      _u.crossVectors(_n, _e).normalize();
      _m.makeBasis(_e, _u, _n);
      this.card.quaternion.setFromRotationMatrix(_m);
      // Viewing-angle fade: the photo is only right along the Sun's line of sight.
      _v.copy(camPos).sub(this.group.position).normalize();
      const cosView = Math.abs(_v.dot(_n));
      const angleFade = 0.12 + 0.88 * cosView * cosView;
      const near = this.def.type === 'cluster' ? 1 : Math.min(1, dist / (this.a * 1.5));   // inside a nebula the card thins out
      const strength = this.def.type === 'cluster' ? (this.points ? 0.5 : 0.25) : 1;
      this.cardMat.uniforms.uOpacity.value = layerOpacity * sizeFade * angleFade * near * strength;
      this.card.visible = this.cardMat.uniforms.uOpacity.value > 0.005;
      if (this.rec.image && !this.texRequested && radiusPx > 0.8) {
        this.texRequested = true;
        void loadTexture(this.rec.image.file).then((t) => { if (this.cardMat) { this.cardMat.uniforms.uMap.value = t; this.cardMat.uniforms.uHasImage.value = 1; } }).catch(() => { /* keep the soft glow */ });
      }
    }
    if (this.points && this.pointsMat) {
      this.pointsMat.uniforms.uPixelRatio.value = pixelRatio;
      this.pointsMat.uniforms.uPxPerRad.value = pxPerRad;
      this.pointsMat.uniforms.uOpacity.value = layerOpacity * sizeFade;
      this.points.visible = sizeFade > 0.01;
    }
  }

  setVisible(v: boolean) { this.group.visible = v; }
}
const _n = new THREE.Vector3();
const _e = new THREE.Vector3();
const _u = new THREE.Vector3();
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
