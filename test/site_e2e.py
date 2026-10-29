#!/usr/bin/env python3
"""Проверка сайта «Обжиг» в браузере + скриншоты для портфолио.

Запуск:  python3 test/site_e2e.py
"""
import os, sys, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_DIR = os.path.join(BASE, "site")
SHOTS = os.path.join(SITE_DIR, "shots")
os.makedirs(SHOTS, exist_ok=True)
CHROME = os.environ.get("CHROME_PATH", "/usr/bin/chromium")
CODE = "SMENA-F76"


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=SITE_DIR))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


PASS, FAIL = [], []
def ok(name, cond, extra=""):
    (PASS if cond else FAIL).append(name)
    print(("  ✓ " if cond else "  ✗ ") + name + (("  → " + str(extra)) if extra and not cond else ""))


SRV = serve()
SITE = "http://127.0.0.1:%d/index.html" % SRV.server_address[1]

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--disable-gpu",
                                                        "--disable-dev-shm-usage"])
    errors = []
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1, locale="ru-RU")
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
    pg.goto(SITE)
    pg.wait_for_timeout(1200)

    print("\n[1] Закрытый доступ")
    ok("сайт закрыт гейтом", pg.locator("#gate:not(.off)").count() == 1)
    ok("контент под гейтом есть", pg.locator("#builder").count() == 1)
    pg.fill("#gateCode", "НЕТ-ТАКОГО")
    pg.click("#gateGo")
    pg.wait_for_timeout(300)
    ok("неверный код отклонён", pg.locator("#gateErr").inner_text().strip() != "")
    pg.fill("#gateCode", CODE)
    pg.click("#gateGo")
    pg.wait_for_timeout(700)
    ok("верный код открыл сайт", pg.locator("#gate.off").count() == 1)
    ok("доступ сохранён", pg.evaluate("() => localStorage.getItem('obzhig.access') === '1'"))

    print("\n[2] Конструктор")
    cells = pg.locator("#monthGrid .mcell").count()
    ok("сетка месяца построена", cells >= 28, cells)
    pg.fill("#cycInput", "1/1,2/2,3/3")
    pg.click("#cycApply")
    pg.wait_for_timeout(500)
    work = pg.locator("#monthGrid .mcell.w").count()
    ok("цикл применился, есть смены", work > 0, work)
    txt = pg.locator("#bSum").inner_text()
    ok("посчитаны деньги", "₽" in txt, txt[:110])
    pg.click('#spdChips .chip[data-spd="2"]')
    pg.wait_for_timeout(400)
    ok("двойная смена отмечена", pg.locator("#monthGrid .mcell.w2").count() > 0)
    pg.click('#bTabs button[data-tab="duo"]')
    pg.wait_for_timeout(400)
    ok("режим «вдвоём» включился", pg.locator("#duoRow").is_visible())
    ok("в сумме появился напарник", "напарник" in pg.locator("#bSum").inner_text().lower())

    print("\n[3] Связка с приложением")
    link = pg.evaluate("() => buildAppLink()")
    ok("ссылка для приложения собрана", isinstance(link, str) and "#g=" in link, link[-40:])
    pg.click("#toAppBtn")
    pg.wait_for_timeout(400)
    ok("подсказка про перенос показана", pg.locator("#toast.on").count() == 1)

    print("\n[4] Личный кабинет")
    pg.fill("#accName", "Дима")
    pg.fill("#accPoint", "Уфа, Айская")
    pg.click('#accRoles .chip[data-role="cook"]')
    pg.fill("#accCode", CODE)
    pg.click("#accGo")
    pg.wait_for_timeout(600)
    ok("кабинет создан", pg.locator("#accOut:not([hidden])").count() == 1)
    ok("имя в кабинете", pg.locator("#accNameOut").inner_text() == "Дима")
    ok("роль и точка", "Повар" in pg.locator("#accMeta").inner_text(), pg.locator("#accMeta").inner_text())

    print("\n[5] Скриншоты")
    pg.add_style_tag(content="html{scroll-behavior:auto!important}.rv{opacity:1!important;transform:none!important;filter:none!important}.word>span{transform:none!important}")
    pg.evaluate("() => window.scrollTo(0,0)")
    pg.wait_for_timeout(500)
    for sel, name in [(None, "site-hero.png"), ("#why", "site-why.png"), ("#features", "site-features.png"),
                       ("#builder", "site-builder.png"), ("#money", "site-money.png"),
                       ("#stack", "site-stack.png"), ("#account", "site-account.png")]:
        if sel:
            pg.evaluate("s => document.querySelector(s).scrollIntoView({behavior:'instant',block:'start'})", sel)
            pg.wait_for_timeout(700)
        pg.screenshot(path=os.path.join(SHOTS, name))
        print("  →", name)
    pg.screenshot(path=os.path.join(SHOTS, "site-full.png"), full_page=True)

    m = ctx.new_page()
    m.set_viewport_size({"width": 390, "height": 844})
    m.goto(SITE)
    m.wait_for_timeout(900)
    # доступ уже есть в этом контексте — гейт закрыт
    if pg.locator("#gate:not(.off)").count() == 0 and m.locator("#gate:not(.off)").count() == 1:
        m.fill("#gateCode", CODE); m.click("#gateGo"); m.wait_for_timeout(700)
    m.screenshot(path=os.path.join(SHOTS, "site-mobile.png"))
    print("  → site-mobile.png")

    print("\n[6] Ошибки в консоли")
    real = [e for e in errors if "404" not in e and "favicon" not in e.lower()]
    ok("критических ошибок нет", len(real) == 0, real[:3])
    b.close()
SRV.shutdown()

print("\n" + "=" * 46)
print(f"  ПРОШЛО: {len(PASS)}   ПРОВАЛЕНО: {len(FAIL)}")
for f in FAIL:
    print("   ✗ " + f)
print("=" * 46)
sys.exit(0 if not FAIL else 1)
