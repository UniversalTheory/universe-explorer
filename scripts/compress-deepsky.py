#!/usr/bin/env python3
"""Re-encode public/textures/deepsky/*.jpg as JPEG (some Commons thumbnails arrive as PNG), max 1024 px, quality 82."""
import os, sys
from PIL import Image

d = 'public/textures/deepsky'
total = 0
for name in sorted(os.listdir(d)):
    if not name.endswith('.jpg'):
        continue
    p = os.path.join(d, name)
    try:
        im = Image.open(p)
        im.load()
    except Exception as e:
        print(f'  {name}: unreadable ({e})'); continue
    fmt, size = im.format, os.path.getsize(p)
    if im.mode in ('RGBA', 'LA', 'P'):
        bg = Image.new('RGB', im.size, (0, 0, 0))
        bg.paste(im.convert('RGBA'), mask=im.convert('RGBA').split()[3])
        im = bg
    elif im.mode != 'RGB':
        im = im.convert('RGB')
    w, h = im.size
    if max(w, h) > 1024:
        s = 1024 / max(w, h)
        im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    if fmt != 'JPEG' or size > 350_000 or max(w, h) > 1024:
        im.save(p, 'JPEG', quality=82, optimize=True, progressive=True)
        print(f'  {name}: {fmt} {size // 1024} KB -> JPEG {os.path.getsize(p) // 1024} KB')
    total += os.path.getsize(p)
print(f'total {total / 1e6:.1f} MB')
