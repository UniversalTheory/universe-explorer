/** GLSL for the custom materials. */

/** Shared: fraction of the Sun's disk hidden by up to N spherical occluders, as seen from world point P. */
export const ECLIPSE_GLSL = /* glsl */ `
#define MAX_OCCLUDERS 6
uniform vec3 uSunPos;
uniform float uSunRadius;
uniform vec4 uOccluders[MAX_OCCLUDERS]; // xyz = centre (world), w = radius (0 = unused)
uniform int uOccluderCount;

// Approximate overlap fraction of two discs with angular radii ra (sun) and rb (occluder), separated by angle d.
float discOverlap(float ra, float rb, float d) {
  if (d >= ra + rb) return 0.0;
  if (d <= abs(rb - ra)) return rb >= ra ? 1.0 : (rb * rb) / (ra * ra);
  // Smooth approximation of the lens area ratio.
  float t = (ra + rb - d) / (2.0 * min(ra, rb));
  t = clamp(t, 0.0, 1.0);
  float lens = t * t * (3.0 - 2.0 * t);
  float capRatio = rb >= ra ? 1.0 : (rb * rb) / (ra * ra);
  return lens * capRatio;
}

float sunVisibility(vec3 P) {
  vec3 toSun = uSunPos - P;
  float dSun = length(toSun);
  vec3 sDir = toSun / dSun;
  float ra = asin(clamp(uSunRadius / dSun, 0.0, 1.0));
  float vis = 1.0;
  for (int k = 0; k < MAX_OCCLUDERS; k++) {
    if (k >= uOccluderCount) break;
    vec4 o = uOccluders[k];
    if (o.w <= 0.0) continue;
    vec3 toO = o.xyz - P;
    float dO = length(toO);
    if (dO >= dSun || dO <= o.w) continue;
    float rb = asin(clamp(o.w / dO, 0.0, 1.0));
    float d = acos(clamp(dot(sDir, toO / dO), -1.0, 1.0));
    vis *= 1.0 - discOverlap(ra, rb, d);
  }
  return vis;
}
`;

export const SUN_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPos;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vPos = position;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
}
`;

export const SUN_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uTime;
uniform vec3 uHot;    // granule palette: bright cells …
uniform vec3 uCool;   // … and dark lanes (the Sun's are yellow-white / orange; other stars derive theirs from their colour)
uniform float uMono;  // 1 = use the texture's luminance only (other stars: keeps the Sun's orange out of their hue)
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPos;
#include <logdepthbuf_pars_fragment>

// Simplex-ish value noise
vec3 hash3(vec3 p) { p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return -1.0 + 2.0 * fract(sin(p) * 43758.5453123); }
float noise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)), dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                 mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)), dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
             mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)), dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                 mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)), dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
}
float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; } return v; }

void main() {
  #include <logdepthbuf_fragment>
  vec3 base = texture2D(uMap, vUv).rgb;
  vec3 p = normalize(vPos);
  float t = uTime * 0.02;
  float g = fbm(p * 6.0 + vec3(t, -t * 0.7, t * 0.3));
  float g2 = fbm(p * 18.0 - vec3(t * 1.3, t, -t * 0.5));
  float granules = 0.5 + 0.5 * g + 0.25 * g2;
  vec3 baseC = mix(base, vec3(dot(base, vec3(0.299, 0.587, 0.114))), uMono);
  vec3 col = mix(uCool, uHot, clamp(granules, 0.0, 1.0)) * (0.75 + 0.6 * baseC);
  // Limb darkening
  float mu = abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
  col *= 0.55 + 0.45 * pow(mu, 0.6);
  gl_FragColor = vec4(col * 1.35, 1.0);
}
`;

export const ATMOSPHERE_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPos;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
`;

export const ATMOSPHERE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uSunDir;   // world-space direction toward the Sun from the body
uniform float uIntensity;
varying vec3 vNormal;
varying vec3 vWorldPos;
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float rim = 1.0 - clamp(dot(vNormal, viewDir), 0.0, 1.0);
  float glow = pow(rim, 3.2);
  float lit = clamp(dot(vNormal, uSunDir) * 1.4 + 0.45, 0.0, 1.0);
  float a = glow * lit * uIntensity;
  gl_FragColor = vec4(uColor * (0.7 + 0.6 * lit), a);
}
`;

export const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;
export const GLOW_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vUv;
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  vec2 d = vUv - 0.5;
  float r = length(d) * 2.0;
  float core = exp(-r * r * 14.0);
  float halo = exp(-r * 3.2) * 0.5;
  float a = (core + halo) * uStrength * smoothstep(1.0, 0.6, r);
  gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0));
}
`;

/**
 * Same glow as a single point sprite, sized in pixels. Used when the Sun is far away:
 * a world-sized quad at > 1e14 km rasterises badly (its corners collapse into a bow-tie
 * under SwiftShader), while a point sprite needs no interpolation across a huge triangle.
 */
export const GLOW_POINT_VERT = /* glsl */ `
uniform float uSizePx;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = uSizePx;
  #include <logdepthbuf_vertex>
}
`;
export const GLOW_POINT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float core = exp(-r * r * 14.0);
  float halo = exp(-r * 3.2) * 0.5;
  float a = (core + halo) * uStrength * smoothstep(1.0, 0.6, r);
  gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0));
}
`;

export const RING_VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec2 vUv;
varying vec3 vLocal;
varying vec3 vRingNormal;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vUv = uv;
  vLocal = position;
  vRingNormal = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
`;
export const RING_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uInner;
uniform float uOuter;
uniform vec3 uPlanetPos;
uniform float uPlanetRadius;
varying vec3 vWorldPos;
varying vec3 vLocal;
varying vec3 vRingNormal;
#include <logdepthbuf_pars_fragment>
${ECLIPSE_GLSL}
void main() {
  #include <logdepthbuf_fragment>
  float r = length(vLocal.xy);
  float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
  vec4 tex = texture2D(uMap, vec2(t, 0.5));
  // Planet shadow on the rings: does the segment toward the Sun hit the planet?
  vec3 toSun = normalize(uSunPos - vWorldPos);
  vec3 toPlanet = uPlanetPos - vWorldPos;
  float along = dot(toPlanet, toSun);
  float shadow = 1.0;
  if (along > 0.0) {
    float perp = length(toPlanet - along * toSun);
    shadow = smoothstep(uPlanetRadius * 0.985, uPlanetRadius * 1.015, perp);
  }
  // Lighting: rings are lit from either side; back-lit side gets soft transmitted light.
  vec3 n = normalize(vRingNormal);
  float facing = dot(n, toSun);
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float sameSide = sign(dot(n, viewDir)) == sign(facing) ? 1.0 : 0.0;
  float lit = mix(0.45, 1.0, sameSide) * (0.6 + 0.4 * abs(facing));
  vec3 col = tex.rgb * lit * (0.25 + 0.75 * shadow);
  gl_FragColor = vec4(col, tex.a * 0.95);
}
`;

export const STARS_VERT = /* glsl */ `
attribute float aMag;
attribute vec3 aColor;
varying vec3 vColor;
varying float vAlpha;
uniform float uPixelRatio;
uniform float uScale;
void main() {
  vColor = aColor;
  float b = pow(10.0, -0.4 * aMag);       // relative brightness
  float size = clamp(1.2 + 2.2 * log2(1.0 + b * 12.0), 1.0, 9.0);
  vAlpha = clamp(0.35 + 0.65 * log2(1.0 + b * 4.0), 0.15, 1.0);
  gl_PointSize = size * uPixelRatio * uScale;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
export const STARS_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float a = smoothstep(1.0, 0.25, r) * vAlpha;
  gl_FragColor = vec4(vColor, a);
}
`;

export const BELT_VERT = /* glsl */ `
attribute float aSize;
uniform float uPixelRatio;
varying float vFade;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float dist = -mv.z;
  gl_PointSize = clamp(aSize * uPixelRatio * (2.0e8 / dist), 0.6, 2.5) * uPixelRatio;
  vFade = 1.0;
  gl_Position = projectionMatrix * mv;
}
`;
export const BELT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  if (length(d) > 0.5) discard;
  gl_FragColor = vec4(uColor, uOpacity * vFade);
}
`;

/**
 * 3D star cloud: one point per catalogued star, sized by the apparent magnitude seen from
 * the camera (absolute magnitude + distance), so stars brighten as you approach them.
 */
export const STARCLOUD_VERT = /* glsl */ `
attribute float aAbsMag;
attribute vec3 aColor;
attribute float aHide;
varying vec3 vColor;
varying float vAlpha;
uniform float uPixelRatio;
uniform float uBoost;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float distPc = max(length(mv.xyz) / 3.0856775814913673e13, 1e-6);
  float mag = aAbsMag + 5.0 * log2(distPc / 10.0) * 0.30103;   // 5 log10(d / 10 pc); GLSL has no log10
  float b = pow(10.0, -0.4 * mag) * uBoost;           // brightness relative to magnitude 0
  float size = clamp(1.2 + 2.2 * log2(1.0 + b * 12.0), 1.0, 14.0);
  vAlpha = clamp(0.35 + 0.65 * log2(1.0 + b * 4.0), 0.12, 1.0);
  if (mag > 7.2 || aHide > 0.5) { vAlpha = 0.0; size = 1.0; }
  gl_PointSize = size * uPixelRatio;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
`;
export const STARCLOUD_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
#include <logdepthbuf_pars_fragment>
void main() {
  if (vAlpha <= 0.0) discard;
  #include <logdepthbuf_fragment>
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float a = smoothstep(1.0, 0.25, r) * vAlpha;
  gl_FragColor = vec4(vColor, a);
}
`;

/** Deep-sky photo card: additive, vignetted so the picture's frame never shows. */
export const DSO_CARD_VERT = /* glsl */ `
varying vec2 vUv;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;
export const DSO_CARD_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uOpacity;
uniform vec3 uTint;
uniform float uHasImage;
varying vec2 vUv;
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  vec2 d = (vUv - 0.5) * 2.0;
  float r = length(d);
  // Elliptical vignette: full inside r < 0.75, gone at the corners.
  float vig = 1.0 - smoothstep(0.75, 1.0, r);
  vec3 c = texture2D(uMap, vUv).rgb;
  vec3 col = mix(c * uTint, c, uHasImage);
  gl_FragColor = vec4(col * vig * uOpacity, 1.0);
}
`;

/** Cluster point cloud: point size from the star's world-space size (∝ cluster radius) with a pixel floor. */
export const DSO_POINTS_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
varying vec3 vColor;
varying float vAlpha;
uniform float uPixelRatio;
uniform float uPxPerRad;
uniform float uRadiusKm;
uniform float uOpacity;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float dist = max(length(mv.xyz), 1.0);
  // A cluster star is drawn ~1/400 of the cluster radius wide, so the cloud thins into individual stars as you approach.
  float px = (uRadiusKm / 400.0 * aSize / dist) * uPxPerRad;
  float size = clamp(px, 1.0, 6.0) * uPixelRatio;
  vAlpha = uOpacity * clamp(px * 2.0, 0.25, 1.0) * (0.5 + 0.5 * aSize / 2.8);
  gl_PointSize = size;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
`;
export const DSO_POINTS_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float a = smoothstep(1.0, 0.3, r) * vAlpha;
  gl_FragColor = vec4(vColor, a);
}
`;

/** Black hole photon ring / accretion disc (RingGeometry in local units of the shadow radius). */
export const BH_DISC_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vLocal;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vUv = uv;
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;
export const BH_RING_FRAG = /* glsl */ `
uniform float uInner;
uniform float uOuter;
uniform float uTime;
varying vec3 vLocal;
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  float r = length(vLocal.xy);
  float t = (r - uInner) / (uOuter - uInner);
  float a = exp(-t * 6.0) * 1.4 * smoothstep(0.0, 0.08, t);
  vec3 col = mix(vec3(1.0, 0.95, 0.85), vec3(1.0, 0.6, 0.25), t);
  gl_FragColor = vec4(col * a, 1.0);
}
`;
export const BH_DISC_FRAG = /* glsl */ `
uniform float uInner;
uniform float uOuter;
uniform float uTime;
varying vec3 vLocal;
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  float r = length(vLocal.xy);
  float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
  float ang = atan(vLocal.y, vLocal.x);
  // Brightness ∝ r⁻², turbulent streaks that orbit faster inside, Doppler boost on the approaching side.
  float streaks = 0.75 + 0.25 * sin(ang * 9.0 - uTime * (2.2 / (0.3 + t)) + r * 2.0) * sin(ang * 4.0 + uTime * 0.7);
  float beam = 1.0 + 0.7 * sin(ang + uTime * 0.05);
  float b = pow(1.0 - t, 2.2) * streaks * beam * smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.85, 1.0, t));
  vec3 col = mix(vec3(1.0, 0.92, 0.75), vec3(1.0, 0.45, 0.15), t);
  gl_FragColor = vec4(col * b * 1.6, 1.0);
}
`;

