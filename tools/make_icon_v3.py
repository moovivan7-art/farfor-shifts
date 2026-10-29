#!/usr/bin/env python3
"""Иконка приложения «Ритм»: полоски рабочего ритма на графите."""
from PIL import Image, ImageDraw, ImageFilter
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORANGE = (254, 80, 0)
GOLD = (255, 200, 87)


def make(S, pad=0.0, bg=(18, 19, 23)):
    K = 4
    W = S * K
    im = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, W], fill=bg + (255,))

    # мягкое свечение за полосками
    glow = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.rounded_rectangle([W*0.16, W*0.30, W*0.84, W*0.70], radius=W*0.12, fill=(254, 80, 0, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(W * 0.10))
    im = Image.alpha_composite(im, glow)
    d = ImageDraw.Draw(im)

    # пять полосок ритма разной высоты
    heights = [0.30, 0.52, 0.74, 0.46, 0.26]
    bw = W * (0.085 - pad * 0.03)
    gap = W * 0.055
    total = len(heights) * bw + (len(heights) - 1) * gap
    x0 = (W - total) / 2
    base_y = W * 0.62
    for i, h in enumerate(heights):
        bh = W * h * 0.62
        x = x0 + i * (bw + gap)
        y1 = base_y
        y0 = base_y - bh
        t = i / (len(heights) - 1)
        col = tuple(int(ORANGE[j] + (GOLD[j] - ORANGE[j]) * t) for j in range(3))
        d.rounded_rectangle([x, y0, x + bw, y1], radius=bw * 0.42, fill=col + (255,))

    # золотая точка-акцент
    r = W * 0.032
    cx, cy = W * 0.5, base_y + W * 0.10
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=GOLD + (255,))
    return im.resize((S, S), Image.LANCZOS)


make(512).save(f"{BASE}/assets/icon-512.png")
make(192).save(f"{BASE}/assets/icon-192.png")
make(512, pad=0.55).save(f"{BASE}/assets/icon-maskable.png")

svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="112" fill="#121317"/>
  <g>
    <rect x="96"  y="256" width="44" height="98"  rx="20" fill="#fe5000"/>
    <rect x="158" y="200" width="44" height="154" rx="20" fill="#ff7033"/>
    <rect x="220" y="148" width="44" height="206" rx="20" fill="#ff9047"/>
    <rect x="282" y="214" width="44" height="140" rx="20" fill="#ffb05c"/>
    <rect x="344" y="268" width="44" height="86"  rx="20" fill="#ffc857"/>
  </g>
  <circle cx="256" cy="380" r="17" fill="#ffc857"/>
</svg>
'''
open(f"{BASE}/assets/icon.svg", "w", encoding="utf-8").write(svg)
print("иконка «Ритм» готова")
