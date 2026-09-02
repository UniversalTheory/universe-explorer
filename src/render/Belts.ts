/**
 * Asteroid belt, Jupiter Trojans and Kuiper belt as statistically plausible
 * Keplerian point clouds, propagated in the vertex shader.
 */
import * as THREE from 'three';
import { AU_KM, GM_SUN } from '@/ephemeris/frames';

const VERT = /* glsl */ `
attribute vec4 aEl1; // a (km), e, i (rad), Omega (rad)
attribute vec4 aEl2; // omega (rad), M0 (rad), n (rad/day), size
uniform float uDays;       // days since epoch
uniform vec3 uOrigin;      // floating-origin offset (Three axes, km)
uniform float uPixelRatio;
uniform float uPxPerRad;
varying float vAlpha;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  float a = aEl1.x, e = aEl1.y, inc = aEl1.z, Om = aEl1.w;
  float w = aEl2.x, M = aEl2.y + aEl2.z * uDays;
  // Kepler: 4 Newton iterations are plenty for e < 0.4
  float E = M + e * sin(M);
  for (int k = 0; k < 4; k++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
  float xp = a * (cos(E) - e);
  float yp = a * sqrt(1.0 - e * e) * sin(E);
  float cO = cos(Om), sO = sin(Om), ci = cos(inc), si = sin(inc), cw = cos(w), sw = sin(w);
  // ECL position
  vec3 p = vec3(
    (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp,
    (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp,
    (si * sw) * xp + (si * cw) * yp);
  vec3 three = vec3(p.x, p.z, -p.y) - uOrigin;
  vec4 mv = modelViewMatrix * vec4(three, 1.0);
  float dist = -mv.z;
  float px = aEl2.w * uPxPerRad / dist;         // apparent size of a ~5000 km speck: always tiny
  gl_PointSize = clamp(max(px, 1.1) * uPixelRatio, 1.0, 3.0);
  vAlpha = clamp(0.25 + 0.75 * smoothstep(0.0, 1.0, px), 0.25, 1.0);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
`;
const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  vec2 d = gl_PointCoord - 0.5;
  if (dot(d, d) > 0.25) discard;
  gl_FragColor = vec4(uColor, uOpacity * vAlpha);
}
`;

function mulberry32(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = (rnd: () => number) => { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

interface BeltSpec { count: number; aMin: number; aMax: number; eMean: number; iSigmaDeg: number; color: string; opacity: number; seed: number; lonCenter?: () => number; lonSpread?: number }

export class Belts {
  readonly group = new THREE.Group();
  private materials: THREE.ShaderMaterial[] = [];

  constructor(pixelRatio: number) {
    this.add({ count: 9000, aMin: 2.06, aMax: 3.28, eMean: 0.14, iSigmaDeg: 7, color: '#b8a898', opacity: 0.55, seed: 11 }, pixelRatio);
    this.add({ count: 5000, aMin: 37, aMax: 48, eMean: 0.08, iSigmaDeg: 6, color: '#9fb8d8', opacity: 0.5, seed: 23 }, pixelRatio);
    this.add({ count: 1400, aMin: 30, aMax: 100, eMean: 0.35, iSigmaDeg: 15, color: '#8ca0c0', opacity: 0.35, seed: 29 }, pixelRatio); // scattered disc
  }

  private add(spec: BeltSpec, pixelRatio: number) {
    const rnd = mulberry32(spec.seed);
    const n = spec.count;
    const el1 = new Float32Array(n * 4), el2 = new Float32Array(n * 4), pos = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      // Semi-major axis with mild Kirkwood-gap-like structure for the main belt.
      let a = spec.aMin + (spec.aMax - spec.aMin) * Math.pow(rnd(), 0.9);
      if (spec.seed === 11) {
        for (const gap of [2.5, 2.82, 2.95, 3.27]) if (Math.abs(a - gap) < 0.02 && rnd() < 0.85) a += 0.05 * (rnd() < 0.5 ? -1 : 1);
      }
      const e = Math.min(0.6, Math.abs(gauss(rnd) * spec.eMean + spec.eMean * 0.6));
      const i = Math.abs(gauss(rnd)) * spec.iSigmaDeg * Math.PI / 180;
      const aKm = a * AU_KM;
      const nRad = Math.sqrt(GM_SUN / (aKm * aKm * aKm)) * 86400;
      el1.set([aKm, e, i, rnd() * 2 * Math.PI], k * 4);
      el2.set([rnd() * 2 * Math.PI, rnd() * 2 * Math.PI, nRad, 2000 + rnd() * 4000], k * 4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aEl1', new THREE.BufferAttribute(el1, 4));
    geo.setAttribute('aEl2', new THREE.BufferAttribute(el2, 4));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      uniforms: { uDays: { value: 0 }, uOrigin: { value: new THREE.Vector3() }, uPixelRatio: { value: pixelRatio }, uPxPerRad: { value: 1000 }, uColor: { value: new THREE.Color(spec.color) }, uOpacity: { value: spec.opacity } },
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
    this.materials.push(mat);
  }

  update(daysSinceJ2000: number, originThree: THREE.Vector3, pxPerRad: number, pixelRatio: number) {
    for (const m of this.materials) {
      m.uniforms.uDays.value = daysSinceJ2000;
      m.uniforms.uOrigin.value.copy(originThree);
      m.uniforms.uPxPerRad.value = pxPerRad;
      m.uniforms.uPixelRatio.value = pixelRatio;
    }
  }
  setVisible(v: boolean) { this.group.visible = v; }
}
