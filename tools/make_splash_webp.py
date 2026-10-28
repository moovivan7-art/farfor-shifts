#!/usr/bin/env python3
"""Рендерит заставку в кадры и собирает assets/splash.webp (анимация)."""
from playwright.sync_api import sync_playwright
from PIL import Image
import io, os

BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC="file://"+os.path.join(BASE,"tools","splash_source.html")
OUT=os.path.join(BASE,"assets","splash.webp")
W,H=1440,2560; DUR=4200; STEP=50   # 70 кадров ≈ 12 кадров/сек
frames=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"])
    pg=b.new_page(viewport={"width":W,"height":H}, device_scale_factor=1)
    pg.goto(SRC); pg.wait_for_timeout(400)
    pg.evaluate("()=>document.getAnimations().forEach(a=>a.pause())")
    for i in range(DUR//STEP):
        t=i*STEP
        pg.evaluate("(t)=>document.getAnimations().forEach(a=>{try{a.currentTime=t}catch(e){}})",t)
        pg.wait_for_timeout(14)
        frames.append(Image.open(io.BytesIO(pg.screenshot())).convert("RGB"))
    b.close()
frames[0].save(OUT, save_all=True, append_images=frames[1:], duration=STEP, loop=0,
               lossless=False, quality=92, method=4, minimize_size=True)
print(f"WebP: {OUT} кадров={len(frames)} {os.path.getsize(OUT)//1024} КБ")
