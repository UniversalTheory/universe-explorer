#!/usr/bin/env python3
"""
Turn public-domain NASA/LPI/USGS map sheets into clean 2:1 equirectangular
textures (east-longitude, 0° at centre) for public/textures/moons.

Usage: python3 scripts/process-moon-maps.py <source-dir>
"""
import sys, os
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'textures', 'moons')
os.makedirs(OUT, exist_ok=True)
W, H = 2048, 1024

def map_bbox(img, white=245):
    """Bounding box of the largest non-white block at the top of an LPI/PIA map sheet."""
    g = np.asarray(img.convert('L'))
    nonwhite = g < white
    rows = nonwhite.mean(axis=1) > 0.5
    # First run of map rows.
    top = np.argmax(rows)
    bottom = top
    while bottom < len(rows) and rows[bottom]:
        bottom += 1
    cols = nonwhite[top:bottom].mean(axis=0) > 0.5
    left = np.argmax(cols)
    right = len(cols) - np.argmax(cols[::-1])
    return left, top, right, bottom

def fill_unmapped(a, thresh=14):
    """Replace near-black unmapped regions with the mean colour of the mapped area."""
    lum = a.astype(np.float32).mean(axis=-1)
    mask = lum < thresh
    if mask.mean() < 0.002:
        return a
    mean = a[~mask].reshape(-1, 3).mean(axis=0)
    out = a.copy()
    out[mask] = mean.astype(np.uint8)
    return out

def finish(img, name, roll=False, flip=False, fill=False):
    img = img.convert('RGB').resize((W, H), Image.LANCZOS)
    a = np.asarray(img)
    if fill:
        a = fill_unmapped(a)
    if roll:
        a = np.roll(a, W // 2, axis=1)
    if flip:
        a = a[:, ::-1]
    Image.fromarray(a).save(os.path.join(OUT, name + '.jpg'), quality=86, optimize=True)
    print('wrote', name, img.size)

def lpi(name, filename, roll=True, trim=6, fill=False):
    """LPI 'Global 3-Color Map' sheets: map at top, caption below; 360°W left → roll to put 0° at centre."""
    path = os.path.join(SRC, filename)
    if not os.path.exists(path) or os.path.getsize(path) < 10000:
        print('skip', name); return
    img = Image.open(path)
    l, t, r, b = map_bbox(img)
    img = img.crop((l + trim, t + trim, r - trim, b - trim))
    print(name, 'crop', (l, t, r, b), 'aspect', round((r - l) / (b - t), 3))
    finish(img, name, roll=roll, fill=fill)

def tinted(name, filename, tint, roll=False):
    """Grayscale mosaic -> colour-tinted texture (e.g. Titan's ISS map under its orange haze)."""
    path = os.path.join(SRC, filename)
    if not os.path.exists(path) or os.path.getsize(path) < 10000:
        print('skip', name); return
    g = np.asarray(Image.open(path).convert('L').resize((W, H), Image.LANCZOS)).astype(np.float32) / 255.0
    rgb = np.stack([g * tint[0], g * tint[1], g * tint[2]], axis=-1)
    a = np.clip(rgb * 255, 0, 255).astype(np.uint8)
    if roll: a = np.roll(a, W // 2, axis=1)
    Image.fromarray(a).save(os.path.join(OUT, name + '.jpg'), quality=86, optimize=True)
    print('wrote', name)

def band(name, filename, lat_max, roll=True, tint=None):
    """Cylindrical map covering only ±lat_max: place it on a 2:1 canvas and fill the poles by stretching the edge rows."""
    path = os.path.join(SRC, filename)
    if not os.path.exists(path) or os.path.getsize(path) < 10000:
        print('skip', name); return
    img = Image.open(path).convert('RGB')
    band_h = int(round(H * (2 * lat_max) / 180))
    top = (H - band_h) // 2
    a = np.asarray(img.resize((W, band_h), Image.LANCZOS)).astype(np.float32)
    if tint is not None:
        g = a.mean(axis=-1, keepdims=True)
        a = np.concatenate([g * tint[0], g * tint[1], g * tint[2]], axis=-1)
    out = np.zeros((H, W, 3), np.float32)
    out[top:top + band_h] = a
    # Polar caps: progressively blur the edge row (circular, in longitude) toward the pole so the cap is
    # seamless at the band edge and featureless at the pole, without vertical streaks.
    def blur_row(row, radius):
        if radius < 1: return row
        k = int(radius) * 2 + 1
        pad = np.concatenate([row[-k:], row, row[:k]], axis=0)
        ker = np.ones(k) / k
        return np.stack([np.convolve(pad[:, c], ker, mode='same') for c in range(3)], axis=-1)[k:-k]
    for rows, edge in ((list(range(0, top)), a[0]), (list(range(top + band_h, H)), a[-1])):
        n = len(rows)
        mean = edge.reshape(-1, 3).mean(axis=0)
        # A few blur levels, reused across rows.
        levels = [blur_row(edge, W * t / 6) for t in (0, 0.02, 0.06, 0.15, 0.35, 0.7)]
        for r in rows:
            g = (r - rows[0]) / max(1, n - 1)            # 0 at top of cap, 1 at bottom
            f = g if r < top else 1 - g                  # 1 at band edge, 0 at pole
            lvl = (1 - f) * (len(levels) - 1)
            i0 = int(np.floor(lvl)); i1 = min(len(levels) - 1, i0 + 1); w = lvl - i0
            row = levels[i0] * (1 - w) + levels[i1] * w
            out[r] = row * (0.35 + 0.65 * f) + mean * (0.65 * (1 - f))
    a8 = np.clip(out, 0, 255).astype(np.uint8)
    if roll: a8 = np.roll(a8, W // 2, axis=1)
    Image.fromarray(a8).save(os.path.join(OUT, name + '.jpg'), quality=86, optimize=True)
    print('wrote', name, 'band rows', top, top + band_h)

def plain(name, filename, roll=False, flip=False, box=None, fill=False):
    path = os.path.join(SRC, filename)
    if not os.path.exists(path) or os.path.getsize(path) < 10000:
        print('skip', name); return
    img = Image.open(path)
    if box: img = img.crop(box)
    print(name, 'source', img.size)
    finish(img, name, roll=roll, flip=flip, fill=fill)

if __name__ == '__main__':
    which = sys.argv[2:] or ['all']
    def want(n): return 'all' in which or n in which
    if want('enceladus'): lpi('enceladus', 'enceladus.jpg')
    if want('dione'): lpi('dione', 'dione.jpg')
    if want('rhea'): lpi('rhea', 'rhea.jpg')
    if want('tethys'): lpi('tethys', 'tethys.jpg')
    if want('iapetus'): lpi('iapetus', 'iapetus.jpg')
    if want('mimas'): lpi('mimas', 'mimas.jpg')
    if want('triton'): lpi('triton', 'triton.jpg', roll=False, fill=True)
    if want('titan'): tinted('titan', 'titan_thumb.png', (1.0, 0.72, 0.36))
    if want('io'): band('io', 'io2.jpg', 57)
    if want('europa'): plain('europa', 'europa2.jpg', roll=True, fill=True)
    if want('callisto'): band('callisto', 'callisto2.jpg', 70, tint=(0.78, 0.70, 0.62))
