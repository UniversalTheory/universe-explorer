import * as THREE from 'three';
import type { ProceduralSkin } from '@/data/catalog';

const loader = new THREE.TextureLoader();
const cache = new Map<string, Promise<THREE.Texture>>();
let maxAniso = 4;

export function configureTextures(renderer: THREE.WebGLRenderer) {
  maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
}

export function loadTexture(url: string, srgb = true): Promise<THREE.Texture> {
  let p = cache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      loader.load(url, (t) => {
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = maxAniso;
        t.wrapS = THREE.RepeatWrapping;
        resolve(t);
      }, undefined, reject);
    });
    cache.set(url, p);
  }
  return p;
}

// ---------------------------------------------------------------------------
// Procedural textures for bodies without a free map.
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable-in-longitude value noise on the sphere via 3D lattice noise. */
function makeNoise(seed: number) {
  const rnd = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h: number, x: number, y: number, z: number) => {
    switch (h & 15) {
      case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
      case 4: return x + z; case 5: return -x + z; case 6: return x - z; case 7: return -x - z;
      case 8: return y + z; case 9: return -y + z; case 10: return y - z; case 11: return -y - z;
      case 12: return y + x; case 13: return -y + z; case 14: return y - x; default: return -y - z;
    }
  };
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + t * (b - a);
  return (x: number, y: number, z: number) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z, B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    return lerp(
      lerp(lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u), lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u), lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v),
      w,
    );
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const procCache = new Map<string, THREE.Texture>();

export function proceduralTexture(id: string, skin: ProceduralSkin, width = 1024): THREE.Texture {
  const key = `${id}:${width}`;
  const hit = procCache.get(key);
  if (hit) return hit;
  const height = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const d = img.data;
  let seed = 0; for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
  const noise = makeNoise(seed);
  const rnd = mulberry32(seed ^ 0x9e3779b9);
  const base = hexToRgb(skin.base), accent = hexToRgb(skin.accent);
  const detail = skin.detail ?? 0.6;

  // Craters: random circles on the sphere.
  const craters: { x: number; y: number; z: number; r: number }[] = [];
  if (skin.style === 'cratered' || skin.style === 'rocky') {
    const n = skin.style === 'cratered' ? 260 : 90;
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1, phi = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      craters.push({ x: s * Math.cos(phi), y: s * Math.sin(phi), z: u, r: 0.015 + Math.pow(rnd(), 2.2) * 0.16 });
    }
  }

  for (let j = 0; j < height; j++) {
    const lat = Math.PI / 2 - (j / height) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < width; i++) {
      const lon = (i / width) * Math.PI * 2 - Math.PI;
      const x = cl * Math.cos(lon), y = cl * Math.sin(lon), z = sl;
      let v = 0, amp = 0.5, f = 2.5;
      for (let o = 0; o < 5; o++) { v += amp * noise(x * f, y * f, z * f); amp *= 0.5; f *= 2.1; }
      v = 0.5 + v * detail;
      let t = v;
      if (skin.style === 'banded') {
        t = 0.5 + 0.35 * Math.sin(sl * 9 + v * 2.5) + 0.15 * v;
      } else if (skin.style === 'dark') {
        // Iapetus-like: leading hemisphere dark, soft transition.
        const lead = (Math.cos(lon - Math.PI / 2) + 1) * 0.5;
        t = 1 - (0.2 + 0.8 * Math.pow(lead, 2.5)) * (0.8 + 0.4 * v);
        t = Math.max(0, Math.min(1, t));
      } else if (skin.style === 'icy') {
        t = 0.6 + 0.4 * v;
      }
      let shade = 1;
      for (const c of craters) {
        const dx = x - c.x, dy = y - c.y, dz = z - c.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < c.r) {
          const q = dist / c.r;
          shade *= q < 0.75 ? 0.72 + 0.28 * q : 1.18 - 0.18 * ((q - 0.75) / 0.25);
        }
      }
      const k = (j * width + i) * 4;
      const mixT = Math.max(0, Math.min(1, t));
      d[k] = (base[0] * mixT + accent[0] * (1 - mixT)) * shade;
      d[k + 1] = (base[1] * mixT + accent[1] * (1 - mixT)) * shade;
      d[k + 2] = (base[2] * mixT + accent[2] * (1 - mixT)) * shade;
      d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.wrapS = THREE.RepeatWrapping;
  procCache.set(key, tex);
  return tex;
}

/** Soft radial sprite for markers and glows. */
export function discSprite(size = 64, inner = 0.35): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(inner, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
