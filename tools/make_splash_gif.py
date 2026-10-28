"""Снимает кадры с живой заставки через Chromium и собирает GIF."""
from playwright.sync_api import sync_playwright
from PIL import Image
import io, os, time

APP = "file:///workspace/farfor-shifts/index.html"
OUT = "/workspace/farfor-shifts/assets/splash.gif"
DUR = 3600          # мс длительности GIF
STEP = 40           # мс между кадрами
W, H = 480, 480

frames = []
with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--force-device-scale-factor=1"])
    pg = b.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
    pg.goto(APP)
    pg.wait_for_timeout(300)
    # прячем всё, кроме заставки, и фиксируем её
    pg.add_style_tag(content="#app,.topbar,.tabbar{display:none!important}")
    pg.evaluate("""() => {
        const sp = document.querySelector('#splash');
        sp.style.position='fixed'; sp.style.inset='0'; sp.style.margin='0';
        document.getAnimations().forEach(a => a.pause());
    }""")
    n = DUR // STEP
    for i in range(n):
        t = i * STEP
        pg.evaluate("""(t) => { document.getAnimations().forEach(a => { try { a.currentTime = t; } catch(e){} }); }""", t)
        pg.wait_for_timeout(16)
        data = pg.screenshot(clip={"x":0,"y":0,"width":W,"height":H})
        frames.append(Image.open(io.BytesIO(data)).convert("P", palette=Image.ADAPTIVE, colors=96))
    b.close()

frames[0].save(OUT, save_all=True, append_images=frames[1:], duration=STEP, loop=0,
               disposal=2, optimize=True)
print(f"GIF: {OUT}  кадров={len(frames)}  размер={os.path.getsize(OUT)//1024} КБ")
