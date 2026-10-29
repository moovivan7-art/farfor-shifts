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


def shot(pg):
    """playwright отдаёт bytes — оборачиваем в файл-объект для PIL"""
    return Image.open(io.BytesIO(pg.screenshot())).convert("RGB")


def crop_phone(im):
    """верх телефона с шапкой и героем — для hero.gif"""
    w, h = im.size
    return im.crop((0, 0, w, int(h * 0.62))).convert("RGB")


def crossfade(a, b, steps=8):
    out = []
    for i in range(steps):
        t = i / steps
        out.append(Image.blend(a, b, t))
    return out


def build_hero():
    """цикл экранов в вертикальном формате телефона"""
    seq = ["home", "cal", "sched", "tab", "home"]
    frames = []
    for i in range(len(seq) - 1):
        a = crop_phone(shots[seq[i]]).resize((390, 520), Image.LANCZOS)
        b = crop_phone(shots[seq[i + 1]]).resize((390, 520), Image.LANCZOS)
        frames += crossfade(a, b, 10)
    frames += [crop_phone(shots["home"]).resize((390, 520), Image.LANCZOS)] * 14
    frames = frames[::1]
    out = os.path.join(SITE, "hero.gif")
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=90, loop=0,
                   optimize=True, disposal=2)
    print("hero.gif", os.path.getsize(out) // 1024, "KB", len(frames), "кадров")


def build_demo():
    """широкая демонстрация: два экрана рядом + плавный зум"""
    W, H = 880, 520
    left = shots["home"].resize((390, 844), Image.LANCZOS).crop((0, 0, 390, 520))
    right = shots["tab"].resize((390, 844), Image.LANCZOS).crop((0, 0, 390, 520))
    bg = Image.new("RGB", (W, H), (10, 11, 15))
    d = ImageDraw.Draw(bg)
    for x in range(0, W, 40):
        d.line([(x, 0), (x, H)], fill=(255, 255, 255, 8))
    lx, rx = 40, W - 390 - 40
    frames = []
    for k in range(30):
        z = 1 + 0.035 * math.sin(k / 30 * math.pi * 2)
        l = left.resize((int(390 * z), int(520 * z)), Image.LANCZOS)
        r = right.resize((int(390 * z), int(520 * z)), Image.LANCZOS)
        canvas = bg.copy()
        canvas.paste(l, (lx - (390 * z - 390) // 2, (H - 520 * z) // 2))
        canvas.paste(r, (rx - (390 * z - 390) // 2, (H - 520 * z) // 2))
        frames.append(canvas.convert("RGB"))
    out = os.path.join(SITE, "demo.gif")
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=110, loop=0,
                   optimize=True, disposal=2)
    print("demo.gif", os.path.getsize(out) // 1024, "KB")


def build_split():
    """крупный план карточки «Разбивка выплат»"""
    home = shots["home"].convert("RGB")
    w, h = home.size
    card = home.crop((0, int(h * 0.30), w, int(h * 0.60)))
    card = card.resize((760, int(card.size[1] * 760 / card.size[0])), Image.LANCZOS)
    frames = []
    for k in range(24):
        z = 1 + 0.05 * math.sin(k / 24 * math.pi * 2)
        w2, h2 = int(card.size[0] * z), int(card.size[1] * z)
        c = card.resize((w2, h2), Image.LANCZOS)
        canvas = Image.new("RGB", (760, int(card.size[1] * 1.08)), (10, 11, 15))
        canvas.paste(c, ((760 - w2) // 2, (canvas.size[1] - h2) // 2))
        frames.append(canvas)
    out = os.path.join(SITE, "split.gif")
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=110, loop=0,
                   optimize=True, disposal=2)
    print("split.gif", os.path.getsize(out) // 1024, "KB")


build_hero()
build_demo()
build_split()
print("САЙТОВЫЕ GIF ГОТОВЫ")
