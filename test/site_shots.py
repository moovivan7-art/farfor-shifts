#!/usr/bin/env python3
"""Скриншоты сайта для портфолио и README."""
import os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_DIR = os.path.join(BASE, "site")
SHOTS = os.path.join(SITE_DIR, "shots")
os.makedirs(SHOTS, exist_ok=True)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=SITE_DIR))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
URL = "http://127.0.0.1:%d/index.html" % httpd.server_address[1]

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH", "/usr/bin/chromium"),
                          args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"])
    pg = b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1, locale="ru-RU")
    pg.goto(URL)
    pg.wait_for_timeout(1500)
    # для документации показываем всё сразу: без плавных появлений и прокрутки
    pg.add_style_tag(content="html{scroll-behavior:auto!important}.rv{opacity:1!important;transform:none!important}")

    def shot(sel, name, full=False):
        if sel:
            pg.evaluate("s => document.querySelector(s).scrollIntoView({behavior:'instant',block:'start'})", sel)
            pg.wait_for_timeout(700)
        pg.screenshot(path=os.path.join(SHOTS, name), full_page=full)
        print("  →", name)

    shot(None, "site-hero.png")
    shot("#features", "site-features.png")
    shot("#builder", "site-builder.png")
    shot("#money", "site-money.png")
    shot("#download", "site-download.png")
    shot("#support", "site-support.png")
    pg.screenshot(path=os.path.join(SHOTS, "site-full.png"), full_page=True)

    m = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ru-RU")
    m.goto(URL)
    m.wait_for_timeout(1500)
    m.add_style_tag(content="html{scroll-behavior:auto!important}.rv{opacity:1!important;transform:none!important}")
    m.screenshot(path=os.path.join(SHOTS, "site-mobile.png"))
    m.evaluate("() => document.querySelector('#builder').scrollIntoView({behavior:'instant',block:'start'})")
    m.wait_for_timeout(700)
    m.screenshot(path=os.path.join(SHOTS, "site-mobile-builder.png"))
    print("  → site-mobile.png, site-mobile-builder.png")
    b.close()
httpd.shutdown()
print("скриншоты в", SHOTS)
