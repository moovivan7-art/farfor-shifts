#!/usr/bin/env python3
"""Проверка сайта «Смена» в браузере + скриншоты для портфолио.

Запуск:  python3 test/site_e2e.py
"""
import os, sys, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_DIR = os.path.join(BASE, "site")


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    handler = functools.partial(Quiet, directory=SITE_DIR)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)   # порт выбираем свободный
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd
CHROME = os.environ.get("CHROME_PATH", "/usr/bin/chromium")
SHOTS = os.path.join(BASE, "site", "shots")
os.makedirs(SHOTS, exist_ok=True)

PASS, FAIL = [], []
def ok(name, cond, extra=""):
    (PASS if cond else FAIL).append(name)
    print(("  ✓ " if cond else "  ✗ ") + name + (("  → " + str(extra)) if extra and not cond else ""))

# код приглашения из site/config.js (первый в списке)
CODE = "SMENA-F76"

SRV = serve()
PORT = SRV.server_address[1]
SITE = "http://127.0.0.1:%d/index.html" % PORT

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--disable-gpu",
                                                        "--disable-dev-shm-usage"])
    errors = []
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1, locale="ru-RU")
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
    pg.goto(SITE)
    pg.wait_for_timeout(900)

    print("\n[1] Страница")
    ok("заголовок на месте", pg.locator("h1").count() == 1)
    ok("секция фич отрисована", pg.locator(".fgrid .f").count() >= 12,
       pg.locator(".fgrid .f").count())
    ok("кнопка скачивания есть", pg.locator("[data-gate]").count() >= 1)

    print("\n[2] Конструктор графика")
    cells = pg.locator("#monthGrid .mcell").count()
    ok("сетка месяца построена", cells >= 28, cells)
    pg.fill("#cycInput", "1/1,2/2,3/3")
    pg.click("#cycApply")
    pg.wait_for_timeout(400)
    work = pg.locator("#monthGrid .mcell.w").count()
    ok("цикл применился, есть смены", work > 0, work)
    txt = pg.locator("#sum").inner_text()
    ok("посчитаны деньги", "₽" in txt, txt[:100])
    pg.click('#spdChips .chip[data-spd="2"]')
    pg.wait_for_timeout(300)
    ok("двойная смена отмечена", pg.locator("#monthGrid .mcell.w2").count() > 0)
    pg.click("#mateSw")
    pg.wait_for_timeout(300)
    ok("режим «вдвоём» включился", pg.locator("#mateRow").is_visible())

    print("\n[3] Доступ по коду")
    pg.click("[data-gate]")
    pg.wait_for_timeout(400)
    ok("окно кода открылось", pg.locator("#gate.on").count() == 1)
    pg.fill("#codeIn", "НЕТ-ТАКОГО")
    pg.click("#codeGo")
    pg.wait_for_timeout(300)
    ok("неверный код отклонён", pg.locator("#codeErr").inner_text().strip() != "")
    pg.fill("#codeIn", CODE)
    pg.click("#codeGo")
    pg.wait_for_timeout(500)
    ok("верный код принят", pg.evaluate("() => localStorage.getItem('smena.invite.ok') === '1'"))

    print("\n[4] Скриншоты")
    pg.screenshot(path=os.path.join(SHOTS, "site-hero.png"))
    pg.evaluate("document.querySelector('#builder').scrollIntoView()")
    pg.wait_for_timeout(900)
    pg.screenshot(path=os.path.join(SHOTS, "site-builder.png"))
    pg.evaluate("document.querySelector('#features').scrollIntoView()")
    pg.wait_for_timeout(900)
    pg.screenshot(path=os.path.join(SHOTS, "site-features.png"))
    pg.evaluate("document.querySelector('#money').scrollIntoView()")
    pg.wait_for_timeout(900)
    pg.screenshot(path=os.path.join(SHOTS, "site-money.png"))
    ok("скриншоты сохранены", os.path.exists(os.path.join(SHOTS, "site-hero.png")))

    print("\n[5] Мобильная версия")
    m = ctx.new_page()
    m.set_viewport_size({"width": 390, "height": 844})
    m.goto(SITE)
    m.wait_for_timeout(900)
    m.screenshot(path=os.path.join(SHOTS, "site-mobile.png"))
    ok("мобильный скриншот снят", os.path.exists(os.path.join(SHOTS, "site-mobile.png")))

    print("\n[6] Ошибки в консоли")
    # APK и zip лежат только в релизной папке (бинарники не коммитятся в git) —
    # в репо их нет, поэтому 404 на них ожидаем и не считаем ошибкой
    real = [e for e in errors
            if "ERR_FILE_NOT_FOUND" not in e and "favicon" not in e.lower()
            and "404" not in e]
    ok("критических ошибок нет", len(real) == 0, real[:3])
    b.close()
SRV.shutdown()

print("\n" + "=" * 46)
print(f"  ПРОШЛО: {len(PASS)}   ПРОВАЛЕНО: {len(FAIL)}")
for f in FAIL: print("   ✗ " + f)
print("=" * 46)
sys.exit(0 if not FAIL else 1)
