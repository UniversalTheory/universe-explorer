/**
 * A renderable celestial body: textured sphere with optional clouds,
 * atmosphere, rings and night lights; a marker sprite for when it is too
 * small to see; and per-frame scale exaggeration in "visual" mode.
 */
import * as THREE from 'three';
import type { BodyDef } from '@/data/catalog';
import type { Mat3 } from '@/core/math3';
import { ATMOSPHERE_FRAG, ATMOSPHERE_VERT, ECLIPSE_GLSL, RING_FRAG, RING_VERT } from './shaders';
import { discSprite, loadTexture, proceduralTexture } from './Textures';

const SPHERE_HI = new THREE.SphereGeometry(1, 96, 64);
const SPHERE_LO = new THREE.SphereGeometry(1, 40, 28);
let MARKER_TEX: THREE.Texture | null = null;

export interface EclipseUniforms {
  uSunPos: { value: THREE.Vector3 };
  uSunRadius: { value: number };
  uOccluders: { value: THREE.Vector4[] };
  uOccluderCount: { value: number };
}
const MAX_OCCLUDERS = 6;

const RING_SHADOW_GLSL = /* glsl */ `
#ifdef HAS_RING
uniform vec3 uRingNormal;
uniform vec3 uPlanetPos;
uniform float uRingInner;
uniform float uRingOuter;
uniform sampler2D uRingMap;
float ringShadow(vec3 P) {
  vec3 sDir = normalize(uSunPos - P);
  float denom = dot(sDir, uRingNormal);
  if (abs(denom) < 1e-6) return 1.0;
  float t = dot(uPlanetPos - P, uRingNormal) / denom;
  if (t <= 0.0) return 1.0;
  vec3 Q = P + sDir * t;
  float r = length(Q - uPlanetPos);
  if (r < uRingInner || r > uRingOuter) return 1.0;
  float a = texture2D(uRingMap, vec2((r - uRingInner) / (uRingOuter - uRingInner), 0.5)).a;
  return 1.0 - a * 0.92;
}
#else
float ringShadow(vec3 P) { return 1.0; }
#endif
`;

/** Patch a standard material so sunlight is attenuated by eclipses / ring shadows and night lights glow on the dark side. */
function patchMaterial(mat: THREE.MeshStandardMaterial, eclipse: EclipseUniforms, extra: Record<string, THREE.IUniform>) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, eclipse, extra);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNormal;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWorldNormal = normalize(mat3(modelMatrix) * objectNormal);');
    const lights = THREE.ShaderChunk.lights_fragment_begin.replace(
      'getPointLightInfo( pointLight, geometryPosition, directLight );',
      'getPointLightInfo( pointLight, geometryPosition, directLight );\n\t\tdirectLight.color *= sunVis;',
    );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNormal;\n' + ECLIPSE_GLSL + RING_SHADOW_GLSL + '\n#ifdef HAS_NIGHT\nuniform sampler2D uNightMap;\n#endif\n')
      .replace('void main() {', 'void main() {\n\tfloat sunVis = sunVisibility(vWorldPos) * ringShadow(vWorldPos);')
      .replace('#include <lights_fragment_begin>', lights)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#if defined(HAS_NIGHT) && defined(USE_MAP)
  float dayFactor = smoothstep(-0.05, 0.15, dot(normalize(vWorldNormal), normalize(uSunPos - vWorldPos))) * sunVis;
  totalEmissiveRadiance += texture2D(uNightMap, vMapUv).rgb * (1.0 - dayFactor) * 1.1;
#endif`);
  };
  mat.customProgramCacheKey = () => 'ue-body-' + Object.keys(mat.defines ?? {}).join(',');
}

export class BodyObject {
  readonly group = new THREE.Group();
  /** Rotates with the body (pole + prime meridian). */
  readonly spin = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshStandardMaterial;
  readonly marker: THREE.Sprite;
  clouds?: THREE.Mesh;
  atmosphere?: THREE.Mesh;
  ring?: THREE.Mesh;
  private ringUniforms?: Record<string, THREE.IUniform>;
  private atmoUniforms?: Record<string, THREE.IUniform>;
  private extra: Record<string, THREE.IUniform> = {};
  readonly eclipse: EclipseUniforms;
  /** Current exaggeration factor applied to the mesh. */
  displayScale = 1;
  /** Heliocentric ECL position (km, double precision), set by the Universe. */
  helio: [number, number, number] = [0, 0, 0];
  available = true;
  /** Screen-space info for labels / picking (set by Universe each frame). */
  screen = { x: 0, y: 0, visible: false, radiusPx: 0, distance: 0 };
  private hiLoaded = false;
  private hiRequested = false;

  constructor(readonly def: BodyDef, private quality: 'high' | 'low') {
    this.eclipse = {
      uSunPos: { value: new THREE.Vector3() },
      uSunRadius: { value: 695700 },
      uOccluders: { value: Array.from({ length: MAX_OCCLUDERS }, () => new THREE.Vector4()) },
      uOccluderCount: { value: 0 },
    };
    const big = def.type === 'planet' || def.type === 'moon' || def.type === 'dwarf';
    this.material = new THREE.MeshStandardMaterial({ color: def.texture || def.procedural ? 0xffffff : def.color, roughness: 1, metalness: 0 });
    const extra = this.extra;
    if (def.night) { this.material.defines = { HAS_NIGHT: '' }; extra.uNightMap = { value: null }; }
    this.mesh = new THREE.Mesh(big && quality === 'high' ? SPHERE_HI : SPHERE_LO, this.material);
    this.mesh.name = def.id;
    this.spin.add(this.mesh);
    this.group.add(this.spin);
    this.group.name = def.id;

    if (!MARKER_TEX) MARKER_TEX = discSprite(64, def.type === 'spacecraft' ? 0.2 : 0.4);
    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: MARKER_TEX, color: def.color, transparent: true, depthWrite: false, opacity: 0.9 }));
    this.marker.name = def.id;
    this.group.add(this.marker);

    if (def.ring) this.buildRing(def.ring, extra);
    if (def.atmosphere) this.buildAtmosphere(def.atmosphere);
    patchMaterial(this.material, this.eclipse, extra);
    void this.loadMaps(extra);
  }

  private async loadMaps(extra: Record<string, THREE.IUniform>) {
    const def = this.def;
    if (def.procedural && !def.texture) {
      this.material.map = proceduralTexture(def.id, def.procedural, this.quality === 'high' ? 1024 : 512);
      this.material.needsUpdate = true;
    }
    if (def.texture) {
      try {
        this.material.map = await loadTexture(def.texture);
        this.material.needsUpdate = true;
      } catch { if (def.procedural) { this.material.map = proceduralTexture(def.id, def.procedural); this.material.needsUpdate = true; } }
    }
    if (def.night && extra.uNightMap) {
      try { extra.uNightMap.value = await loadTexture(def.night); } catch { /* ignore */ }
    }
    if (def.clouds) {
      try {
        const tex = await loadTexture(def.clouds);
        const isEarth = def.id === 'earth';
        const mat = new THREE.MeshStandardMaterial({
          color: 0xffffff, roughness: 1, metalness: 0, transparent: true, depthWrite: false,
          ...(isEarth ? { alphaMap: tex, opacity: 0.95 } : { map: tex, opacity: 0.92 }),
        });
        patchMaterial(mat, this.eclipse, {});
        this.clouds = new THREE.Mesh(this.mesh.geometry, mat);
        this.clouds.scale.setScalar(isEarth ? 1.006 : 1.012);
        this.clouds.renderOrder = 1;
        this.spin.add(this.clouds);
      } catch { /* ignore */ }
    }
  }

  /** Swap in the 8K map once the body fills a large part of the screen. */
  requestHiRes() {
    if (this.hiRequested || !this.def.textureHi) return;
    this.hiRequested = true;
    void loadTexture(this.def.textureHi).then((t) => { this.material.map = t; this.material.needsUpdate = true; this.hiLoaded = true; });
    if (this.def.cloudsHi && this.clouds) {
      void loadTexture(this.def.cloudsHi).then((t) => {
        const m = this.clouds!.material as THREE.MeshStandardMaterial;
        if (m.alphaMap) m.alphaMap = t; else m.map = t;
        m.needsUpdate = true;
      });
    }
  }
  get hasHiRes() { return this.hiLoaded; }

  private buildRing(ring: { inner: number; outer: number; texture: string }, extra: Record<string, THREE.IUniform>) {
    const geo = new THREE.RingGeometry(ring.inner, ring.outer, 256, 4);
    const uniforms = {
      uMap: { value: null as THREE.Texture | null }, uInner: { value: ring.inner }, uOuter: { value: ring.outer },
      uPlanetPos: { value: new THREE.Vector3() }, uPlanetRadius: { value: this.def.radius }, ...this.eclipse,
    };
    this.ringUniforms = uniforms;
    const mat = new THREE.ShaderMaterial({ vertexShader: RING_VERT, fragmentShader: RING_FRAG, uniforms, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    this.ring = new THREE.Mesh(geo, mat);
    this.ring.rotation.x = -Math.PI / 2; // ring plane = equator (local XZ), normal = +Y (pole)
    this.ring.renderOrder = 2;
    this.spin.add(this.ring);
    // Ring shadow on the planet.
    this.material.defines = { ...(this.material.defines ?? {}), HAS_RING: '' };
    extra.uRingNormal = { value: new THREE.Vector3(0, 1, 0) };
    extra.uPlanetPos = uniforms.uPlanetPos;
    extra.uRingInner = { value: ring.inner };
    extra.uRingOuter = { value: ring.outer };
    extra.uRingMap = { value: null };
    void loadTexture(ring.texture, true).then((t) => { uniforms.uMap.value = t; extra.uRingMap.value = t; });
  }

  private buildAtmosphere(atm: { color: string; height: number; intensity?: number }) {
    const uniforms = { uColor: { value: new THREE.Color(atm.color) }, uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uIntensity: { value: atm.intensity ?? 1 } };
    this.atmoUniforms = uniforms;
    const mat = new THREE.ShaderMaterial({ vertexShader: ATMOSPHERE_VERT, fragmentShader: ATMOSPHERE_FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.atmosphere = new THREE.Mesh(this.mesh.geometry, mat);
    this.atmosphere.scale.setScalar(1 + atm.height);
    this.atmosphere.renderOrder = 3;
    this.spin.add(this.atmosphere);
  }

  /** Apply orientation (body-fixed -> ECL matrix) to the spin group. */
  setOrientation(m: Mat3) {
    // Three axes: R_three = P · R_ecl · Pᵀ with P: (x,y,z) -> (x,z,-y)
    const r = m;
    // P·R: rows permuted: row0 = r0, row1 = r2, row2 = -r1 ; then ·Pᵀ: cols permuted: col0 = c0, col1 = c2, col2 = -c1
    const e = [
      r[0], r[2], -r[1],
      r[6], r[8], -r[7],
      -r[3], -r[5], r[4],
    ];
    _m4.set(e[0], e[1], e[2], 0, e[3], e[4], e[5], 0, e[6], e[7], e[8], 0, 0, 0, 0, 1);
    this.spin.quaternion.setFromRotationMatrix(_m4);
  }

  /**
   * Per-frame update.
   * @param minAngular minimum apparent radius (radians) to enforce; 0 disables exaggeration.
   */
  update(cameraPos: THREE.Vector3, sunWorld: THREE.Vector3, minAngular: number, markerPx: number, pixelsPerRadian: number) {
    const def = this.def;
    const dist = this.group.position.distanceTo(cameraPos);
    this.screen.distance = dist;
    const R = def.radius;
    let scale = 1;
    if (minAngular > 0 && def.type !== 'spacecraft') {
      const wanted = minAngular * dist;
      if (wanted > R) scale = wanted / R;
    }
    this.displayScale = scale;
    const polar = (def.polarRadius ?? R) / R;
    this.mesh.scale.set(R * scale, R * scale * polar, R * scale);
    if (this.clouds) this.clouds.scale.copy(this.mesh.scale).multiplyScalar(def.id === 'earth' ? 1.006 : 1.012);
    if (this.atmosphere) this.atmosphere.scale.copy(this.mesh.scale).multiplyScalar(1 + (def.atmosphere?.height ?? 0));
    if (this.ring) this.ring.scale.setScalar(scale);

    const apparent = (R * scale) / Math.max(dist, 1e-6); // radians
    this.screen.radiusPx = apparent * pixelsPerRadian;
    // Marker: shown when the body is tiny on screen (always for spacecraft).
    const showMarker = def.type === 'spacecraft' || this.screen.radiusPx < markerPx * 0.5;
    this.marker.visible = showMarker;
    if (showMarker) {
      const s = (markerPx * dist) / pixelsPerRadian;
      this.marker.scale.set(s, s, 1);
    }
    this.mesh.visible = def.type !== 'spacecraft' && !(showMarker && this.screen.radiusPx < 0.3);

    // Sun direction for shaders.
    this.eclipse.uSunPos.value.copy(sunWorld);
    if (this.atmoUniforms) this.atmoUniforms.uSunDir.value.copy(sunWorld).sub(this.group.position).normalize();
    if (this.ringUniforms) {
      this.ringUniforms.uPlanetPos.value.copy(this.group.position);
      this.ringUniforms.uPlanetRadius.value = R * scale;
      this.ringUniforms.uInner.value = def.ring!.inner * scale;
      this.ringUniforms.uOuter.value = def.ring!.outer * scale;
    }
    if (this.extra.uRingNormal) {
      this.spin.getWorldQuaternion(_q);
      this.extra.uRingNormal.value.set(0, 1, 0).applyQuaternion(_q);
      this.extra.uRingInner.value = def.ring!.inner * scale;
      this.extra.uRingOuter.value = def.ring!.outer * scale;
    }
    if (this.def.textureHi && !this.hiRequested && this.screen.radiusPx > 260) this.requestHiRes();
  }

  setOccluders(list: { pos: THREE.Vector3; radius: number }[]) {
    const u = this.eclipse.uOccluders.value;
    const n = Math.min(list.length, MAX_OCCLUDERS);
    for (let i = 0; i < n; i++) u[i].set(list[i].pos.x, list[i].pos.y, list[i].pos.z, list[i].radius);
    this.eclipse.uOccluderCount.value = n;
  }

  setVisible(v: boolean) { this.group.visible = v; }

  dispose() {
    this.material.dispose();
    (this.marker.material as THREE.Material).dispose();
    if (this.ring) (this.ring.material as THREE.Material).dispose();
    if (this.atmosphere) (this.atmosphere.material as THREE.Material).dispose();
    if (this.clouds) (this.clouds.material as THREE.Material).dispose();
  }
}
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
