#!/usr/bin/env python3
"""Новая иконка приложения: геометрическая «С» с часовой стрелкой."""
from PIL import Image, ImageDraw, ImageFilter
import math, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def make(S, pad=0.0, bg=(25, 26, 30)):
    K = 4
    W = S * K
    im = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, W], fill=bg + (255,))

    glow = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W * 0.08, W * 0.08, W * 0.92, W * 0.92], fill=(254, 80, 0, 60))
    glow = glow.filter(ImageFilter.GaussianBlur(W * 0.09))
    im = Image.alpha_composite(im, glow)
    d = ImageDraw.Draw(im)

    cx = cy = W / 2
    R = W * (0.29 - pad * 0.22)
    lw = int(W * 0.115)

    # «С» — дуга с разрывом справа
    d.arc([cx - R, cy - R, cx + R, cy + R], 42, 318, fill=(254, 80, 0, 255), width=lw)
    # золотой блик на конце дуги
    d.arc([cx - R, cy - R, cx + R, cy + R], 296, 344, fill=(255, 200, 87, 255), width=lw)

    def hand(ang, length, width, col):
        a = math.radians(ang)
        x = cx + math.cos(a) * R * length
        y = cy + math.sin(a) * R * length
        d.line([(cx, cy), (x, y)], fill=col, width=width)
        d.ellipse([cx - width / 2, cy - width / 2, cx + width / 2, cy + width / 2], fill=col)

    hand(-90, 0.62, int(W * 0.035), (255, 255, 255, 255))
    hand(28, 0.44, int(W * 0.030), (255, 255, 255, 235))

    a = math.radians(42)
    r = int(W * 0.030)
    x = cx + math.cos(a) * R
    y = cy + math.sin(a) * R
    d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 200, 87, 255))
    return im.resize((S, S), Image.LANCZOS)


make(512).save(f"{BASE}/assets/icon-512.png")
make(192).save(f"{BASE}/assets/icon-192.png")
make(512, pad=0.55).save(f"{BASE}/assets/icon-maskable.png")

svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="96" fill="#191a1e"/>
  <path d="M330 148a150 150 0 1 0 0 216" fill="none" stroke="#fe5000" stroke-width="59" stroke-linecap="round"/>
  <path d="M330 148a150 150 0 0 1 32 38" fill="none" stroke="#ffc857" stroke-width="59" stroke-linecap="round"/>
  <path d="M256 256V163" stroke="#fff" stroke-width="18" stroke-linecap="round"/>
  <path d="M256 256l63 33" stroke="#fff" stroke-width="15" stroke-linecap="round"/>
  <circle cx="256" cy="256" r="10" fill="#fff"/>
  <circle cx="330" cy="148" r="15" fill="#ffc857"/>
</svg>'''
open(f"{BASE}/assets/icon.svg", "w", encoding="utf-8").write(svg)
print("иконка v2 готова")
