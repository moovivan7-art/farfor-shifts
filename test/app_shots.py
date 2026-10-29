#!/usr/bin/env python3
"""Скриншоты приложения «Смена» для портфолио и README."""
import os, json
from playwright.sync_api import sync_playwright

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = "file://" + os.path.join(BASE, "index.html")
SHOTS = os.path.join(BASE, "site", "shots")
os.makedirs(SHOTS, exist_ok=True)

DEMO = {
    "profile": {"name": "Дима", "rate": 275, "hours": 13.75, "point": "Уфа, Айская",
                "advance": 1, "payday": 15, "nightPct": 0, "holPct": 0,
                "shiftStart": "10:00", "shiftEnd": "23:45",
                "payMode": "pct", "advPct": 40, "advDays": 20, "siteUrl": ""},
    "shifts": {}, "bonuses": {},
    "plan": {"pattern": "2-2", "start": "", "hours": 13.75, "shortMode": "6",
             "cycle": "1/1,2/2,3/3", "shiftsPerDay": 1},
    "mate": {"name": "Саня", "rate": 275, "hours": 13.75, "shifts": {}},
    "ui": {"range": "month", "theme": "dark", "tabRange": "month", "fs": 17, "sound": 0, "wall": ""},
    "onboarded": True, "pin": ""
}

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH", "/usr/bin/chromium"),
                          args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ru-RU")
    ctx.add_init_script("localStorage.setItem('farfor.shifts.v1', %s);" % json.dumps(json.dumps(DEMO)))
    pg = ctx.new_page()
    pg.goto(APP)
    pg.wait_for_timeout(5600)          # ждём, пока заставка уйдёт сама

    def shot(name):
        pg.evaluate("() => window.scrollTo(0,0)")
        pg.wait_for_timeout(350)
        pg.screenshot(path=os.path.join(SHOTS, name))
        print("  →", name)

    # заполняем месяц по циклу
    pg.click('.tabbar button[data-tab="cal"]')
    pg.wait_for_timeout(400)
    pg.click('[data-cal="fill"]')
    pg.wait_for_timeout(700)
    shot("app-calendar.png")

    # график со своим циклом
    pg.click('.tabbar button[data-tab="sched"]')
    pg.wait_for_timeout(600)
    shot("app-schedule.png")

    # табель: доплаты, списания, напарник
    pg.click('.tabbar button[data-tab="tab"]')
    pg.wait_for_timeout(600)
    pg.fill("#bonusName", "Выполнил план")
    pg.fill("#bonusAmt", "10")
    pg.click("#bonusAdd")
    pg.wait_for_timeout(300)
    pg.fill("#bonusName", "Скорость доставки")
    pg.fill("#bonusAmt", "10")
    pg.click("#bonusAdd")
    pg.wait_for_timeout(300)
    pg.fill("#dedName", "Опоздал на смену")
    pg.fill("#dedAmt", "200")
    pg.click("#dedAdd")
    pg.wait_for_timeout(400)
    pg.evaluate("() => document.querySelector('#bonusCard').scrollIntoView({block:'start'})")
    pg.wait_for_timeout(400)
    shot("app-tab.png")

    # сегодня с разбивкой выплат
    pg.click('.tabbar button[data-tab="home"]')
    pg.wait_for_timeout(700)
    shot("app-home.png")

    # шторка дня с окнами
    pg.click('.tabbar button[data-tab="cal"]')
    pg.wait_for_timeout(500)
    pg.click('#calGrid .day.work')
    pg.wait_for_timeout(700)
    pg.evaluate("() => document.querySelector('#partsBlock').scrollIntoView({block:'center'})")
    pg.wait_for_timeout(400)
    shot("app-sheet.png")
    b.close()
print("скриншоты в", SHOTS)
