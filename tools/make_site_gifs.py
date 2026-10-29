#!/usr/bin/env python3
"""Снимает живые GIF для сайта: реальный интерфейс приложения в браузере.

    python3 tools/make_site_gifs.py
"""
import os, io, json, math, base64
from PIL import Image, ImageDraw, ImageFilter
from playwright.sync_api import sync_playwright

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(BASE, "site", "assets")
os.makedirs(SITE, exist_ok=True)
APP = "file://" + os.path.join(BASE, "index.html")
CHROME = "/usr/bin/chromium"

# ── демо-данные: реальная точка, реальный график 2-2 ──
today = "2026-10-29"
shift_dates = []
d = 12
while len(shift_dates) < 12:
    shift_dates.append(f"2026-10-{d:02d}")
    d += 2
demo = {
    "profile": {"name": "Дима", "rate": 275, "hours": 13.75, "point": "Уфа, Айская",
                "advance": 1, "payday": 15, "nightPct": 0, "holPct": 0,
                "shiftStart": "10:00", "shiftEnd": "23:45",
                "payMode": "pct", "advPct": 40, "advDays": 20, "siteUrl": ""},
    "shifts": {dt: {"kind": "work", "hours": 13.75, "rate": 275, "bonus": 0,
                    "note": "", "slot": "day"} for dt in shift_dates},
    "bonuses": {"2026-10": {"amount": 20, "note": "план, скорость", "items": [
        {"id": "i1", "name": "Выполнил план", "amount": 10, "date": "2026-10-20"},
        {"id": "i2", "name": "Скорость", "amount": 10, "date": "2026-10-25"}]}},
    "plan": {"pattern": "2-2", "start": "2026-10-12", "hours": 13.75, "shortMode": "6",
             "cycle": "", "shiftsPerDay": 1},
    "mate": {"name": "Саня", "rate": 275, "hours": 13.75, "shifts": {}},
    "ui": {"range": "month", "theme": "dark", "tabRange": "month", "fs": 17, "sound": 0, "wall": ""},
    "onboarded": True, "pin": ""
}

def shot(pg):
    """playwright отдаёт bytes — оборачиваем в файл-объект для PIL"""
    return Image.open(io.BytesIO(pg.screenshot())).convert("RGB")


shots = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--disable-gpu",
                                                         "--disable-dev-shm-usage"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                        locale="ru-RU")
    ctx.add_init_script("localStorage.setItem('farfor.shifts.v1', %s);" % json.dumps(json.dumps(demo)))
    pg = ctx.new_page()
    pg.goto(APP)
    pg.wait_for_timeout(5600)                      # ждём, пока заставка уйдёт сама
    pg.evaluate("window.scrollTo(0,0)")
    pg.wait_for_timeout(400)
    shots["home"] = shot(pg)

    for tab, name in [("cal", "cal"), ("sched", "sched"), ("tab", "tab")]:
        pg.click(f'.tabbar button[data-tab="{tab}"]')
        pg.wait_for_timeout(700)
        pg.evaluate("window.scrollTo(0,0)")
        pg.wait_for_timeout(250)
        shots[name] = shot(pg)

    # шторка дня
    pg.click('.tabbar button[data-tab="cal"]')
    pg.wait_for_timeout(500)
    pg.click('.cal-grid .day:not(.blank)')
    pg.wait_for_timeout(700)
    shots["sheet"] = shot(pg)
    b.close()


def crop_phone(im, size=(390, 820)):
    """экран телефона целиком — для hero.gif"""
    return im.convert("RGB").resize(size, Image.LANCZOS)


def save_gif(frames, path, duration=100, colors=48, dither=False):
    """сохраняет GIF с общей палитрой — чтобы не мигал и не весил много"""
    dth = Image.Dither.NONE if not dither else Image.Dither.FLOYDSTEINBERG
    pal = frames[0].convert("RGB").quantize(colors=colors, method=Image.MEDIANCUT, dither=dth)
    conv = [f.convert("RGB").quantize(palette=pal, dither=dth) for f in frames]
    conv[0].save(path, save_all=True, append_images=conv[1:], duration=duration, loop=0,
                 optimize=True, disposal=2)
    return path


def crossfade(a, b, steps=8):
    out = []
    for i in range(steps):
        t = i / steps
        out.append(Image.blend(a, b, t))
    return out


def slide(a, b, steps=12):
    """плавный сдвиг — чище, чем наложение двух экранов"""
    w, h = a.size
    out = []
    for i in range(steps):
        t = i / steps
        canvas = Image.new("RGB", (w * 2, h))
        canvas.paste(a, (int(-w * t), 0))
        canvas.paste(b, (int(w - w * t), 0))
        out.append(canvas.crop((0, 0, w, h)))
    return out


def build_hero():
    """цикл экранов в вертикальном формате телефона"""
    seq = ["home", "cal", "sched", "tab", "home"]
    frames = []
    for i in range(len(seq) - 1):
        a = crop_phone(shots[seq[i]])
        b = crop_phone(shots[seq[i + 1]])
        frames += slide(a, b, 12)
    frames += [crop_phone(shots["home"])] * 10
    out = os.path.join(SITE, "hero.gif")
    save_gif(frames, out, 90)
    print("hero.gif", os.path.getsize(out) // 1024, "KB", len(frames), "кадров")


def build_demo():
    """широкая демонстрация: два экрана рядом + плавный зум"""
    W, H = 760, 430
    left = shots["home"].resize((340, 736), Image.LANCZOS).crop((0, 0, 340, 430))
    right = shots["tab"].resize((340, 736), Image.LANCZOS).crop((0, 0, 340, 430))
    bg = Image.new("RGB", (W, H), (10, 11, 15))
    d = ImageDraw.Draw(bg)
    for x in range(0, W, 40):
        d.line([(x, 0), (x, H)], fill=(255, 255, 255, 8))
    lx, rx = 40, W - 390 - 40
    frames = []
    for k in range(18):
        z = 1 + 0.035 * math.sin(k / 18 * math.pi * 2)
        l = left.resize((int(340 * z), int(430 * z)), Image.LANCZOS)
        r = right.resize((int(340 * z), int(430 * z)), Image.LANCZOS)
        canvas = bg.copy()
        canvas.paste(l, (int(lx - (340 * z - 340) // 2), int((H - 430 * z) // 2)))
        canvas.paste(r, (int(rx - (340 * z - 340) // 2), int((H - 430 * z) // 2)))
        frames.append(canvas.convert("RGB"))
    out = os.path.join(SITE, "demo.gif")
    save_gif(frames, out, 110)
    print("demo.gif", os.path.getsize(out) // 1024, "KB")


def build_split():
    """крупный план карточки «Разбивка выплат»"""
    home = shots["home"].convert("RGB")
    w, h = home.size
    card = home.crop((0, int(h * 0.30), w, int(h * 0.62)))
    card = card.resize((680, int(card.size[1] * 680 / card.size[0])), Image.LANCZOS)
    frames = []
    for k in range(16):
        z = 1 + 0.05 * math.sin(k / 16 * math.pi * 2)
        w2, h2 = int(card.size[0] * z), int(card.size[1] * z)
        c = card.resize((w2, h2), Image.LANCZOS)
        canvas = Image.new("RGB", (680, int(card.size[1] * 1.1)), (10, 11, 15))
        canvas.paste(c, (int((680 - w2) // 2), int((canvas.size[1] - h2) // 2)))
        frames.append(canvas)
    out = os.path.join(SITE, "split.gif")
    save_gif(frames, out, 110)
    print("split.gif", os.path.getsize(out) // 1024, "KB")


build_hero()
build_demo()
build_split()
print("САЙТОВЫЕ GIF ГОТОВЫ")
