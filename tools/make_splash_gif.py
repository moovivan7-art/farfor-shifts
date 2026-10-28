#!/usr/bin/env python3
"""Снимает кадры с живой заставки через Chromium и собирает assets/splash.gif.

Требуется: playwright (с chromium) и Pillow.
    python3 tools/make_splash_gif.py
"""
from playwright.sync_api import sync_playwright
from PIL import Image
import io, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = "file://" + os.path.join(BASE, "index.html")
OUT = os.path.join(BASE, "assets", "splash.gif")
DUR, STEP, W, H = 3600, 40, 480, 480

raw = []
with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": W, "height": H})
    pg.goto(APP); pg.wait_for_timeout(300)
    pg.add_style_tag(content="#app,.topbar,.tabbar{display:none!important}")
    pg.evaluate("() => { document.getAnimations().forEach(a => a.pause()); }")
    for i in range(DUR // STEP):
        t = i * STEP
        pg.evaluate("(t) => document.getAnimations().forEach(a => { try { a.currentTime = t; } catch(e){} })", t)
        pg.wait_for_timeout(14)
        raw.append(pg.screenshot(clip={"x":0,"y":0,"width":W,"height":H}))
    b.close()

# общая палитра — иначе GIF «мигает» и кадры теряются
first = Image.open(io.BytesIO(raw[0])).convert("RGB")
pal = first.quantize(colors=128)
frames = [Image.open(io.BytesIO(r)).convert("RGB").quantize(palette=pal, dither=Image.NONE) for r in raw]
frames[0].save(OUT, save_all=True, append_images=frames[1:], duration=STEP, loop=0,
               disposal=1, optimize=False)
print(f"GIF: {OUT} кадров={len(frames)} размер={os.path.getsize(OUT)//1024} КБ "
      f"длительность={len(frames)*STEP/1000:.1f}с")
