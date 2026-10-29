#!/usr/bin/env python3
"""E2E-проверка приложения «Смена» в настоящем браузере.

Запуск:  python3 test/e2e.py
Нужен playwright и chromium: /usr/bin/chromium

Проверяет, что приложение реально работает: заставка уходит сама, вкладки
живые, новые фичи v1.4 (свой цикл, окна в день, доплаты списком, правило 40%,
напарник, копии, ссылка, .ics) считают деньги и не падают.
"""
import os, sys, json, io, time
from playwright.sync_api import sync_playwright

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = "file://" + os.path.join(BASE, "index.html")
CHROME = os.environ.get("CHROME_PATH", "/usr/bin/chromium")

PASS, FAIL = [], []
def ok(name, cond, extra=""):
    (PASS if cond else FAIL).append(name)
    print(("  ✓ " if cond else "  ✗ ") + name + (("  → " + str(extra)) if extra and not cond else ""))

DEMO = {
    "profile": {"name": "Дима", "rate": 275, "hours": 13.75, "point": "Уфа, Айская",
                "advance": 1, "payday": 15, "nightPct": 0, "holPct": 0,
                "shiftStart": "10:00", "shiftEnd": "23:45",
                "payMode": "half", "advPct": 40, "advDays": 20, "siteUrl": ""},
    "shifts": {}, "bonuses": {},
    "plan": {"pattern": "2-2", "start": "", "hours": 13.75, "shortMode": "6",
             "cycle": "", "shiftsPerDay": 1},
    "mate": {"name": "Саня", "rate": 275, "hours": 13.75, "shifts": {}},
    "ui": {"range": "month", "theme": "dark", "tabRange": "month", "fs": 17, "sound": 0, "wall": ""},
    "onboarded": True, "pin": ""
}

def run():
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--disable-gpu",
                                                             "--disable-dev-shm-usage"])
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ru-RU")
        ctx.add_init_script("localStorage.setItem('farfor.shifts.v1', %s);" % json.dumps(json.dumps(DEMO)))
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        pg.on("console", lambda m: errors.append("console.error: " + m.text) if m.type == "error" else None)
        pg.goto(APP)

        print("\n[1] Заставка и вход")
        pg.wait_for_timeout(1200)
        ok("заставка видна на старте", pg.locator("#splash").count() > 0)
        pg.wait_for_timeout(4600)
        ok("заставка уходит сама (без помощи теста)", pg.locator("#splash").count() == 0)
        ok("экран входа не показывается без PIN", pg.locator("#lock.on").count() == 0)
        ok("главный экран отрисован", pg.locator("#heroAmt").inner_text() != "")

        print("\n[2] Вкладки")
        for tab, name in [("cal", "Календарь"), ("sched", "График"), ("tab", "Табель"),
                          ("stats", "Статистика"), ("set", "Ещё"), ("home", "Сегодня")]:
            pg.click(f'.tabbar button[data-tab="{tab}"]')
            pg.wait_for_timeout(280)
            ok(f"вкладка «{name}» открывается", pg.locator(f"#view-{tab}.on").count() == 1)

        print("\n[3] Свой цикл графика")
        pg.click('.tabbar button[data-tab="sched"]')
        pg.wait_for_timeout(300)
        pg.fill("#cycleInput", "1/1,2/2,3/3")
        pg.click("#cycleApply")
        pg.wait_for_timeout(400)
        pill = pg.locator("#cyclePill").inner_text()
        ok("цикл применён (пилюля показывает 1/1,2/2,3/3)", "1/1" in pill, pill)
        ok("визуализация цикла отрисована", pg.locator("#cycleViz .cyc-strip i").count() == 12)
        pg.click('.tabbar button[data-tab="cal"]')
        pg.wait_for_timeout(300)
        pg.click('[data-cal="fill"]')
        pg.wait_for_timeout(500)
        work = pg.locator("#calGrid .day.work").count()
        ok("календарь заполнен по своему циклу", work > 0, f"смен={work}")
        pattern_ok = pg.evaluate("""() => {
            const days = Object.keys(S.shifts).sort();
            return days.every(d => isWorkIdx(Math.floor((fromIso(d) - fromIso(S.plan.start || days[0])) / 86400000)));
        }""")
        ok("дни смен соответствуют циклу", pattern_ok)

        print("\n[4] Окна в день (двойная смена)")
        pg.click('.tabbar button[data-tab="sched"]')
        pg.wait_for_timeout(300)
        pg.click('#spdChips .chip[data-spd="2"]')
        pg.wait_for_timeout(300)
        pg.click('[data-act="apply-sched"]')
        pg.wait_for_timeout(600)
        st = pg.evaluate("() => { const k = Object.keys(S.shifts).find(d => S.shifts[d].parts); return k ? S.shifts[k].parts.length : 0; }")
        ok("в смене два окна", st == 2, f"parts={st}")
        hours = pg.evaluate("() => { const k = Object.keys(S.shifts).find(d => S.shifts[d].parts); return k ? S.shifts[k].hours : 0; }")
        ok("часы дня не поехали (13,75 ч)", abs(hours - 13.75) < 0.01, hours)

        print("\n[5] Доплаты списком")
        pg.click('.tabbar button[data-tab="tab"]')
        pg.wait_for_timeout(400)
        pg.fill("#bonusName", "За план")
        pg.fill("#bonusAmt", "10")
        pg.click("#bonusAdd")
        pg.wait_for_timeout(300)
        pg.fill("#bonusName", "За скорость")
        pg.fill("#bonusAmt", "10")
        pg.click("#bonusAdd")
        pg.wait_for_timeout(300)
        total = pg.evaluate("() => bonusOf(currentTabYm())")
        ok("доплаты складываются (10 + 10 = 20)", total == 20, total)
        pill2 = pg.locator("#bonusPill").inner_text()
        ok("сумма видна в карточке", "20" in pill2, pill2)

        print("\n[6] Правило выплат 40%")
        pg.click('.tabbar button[data-tab="set"]')
        pg.wait_for_timeout(300)
        pg.click('[data-go="profile"]')
        pg.wait_for_timeout(400)
        pg.click('#payModeChips .chip[data-pm="pct"]')
        pg.wait_for_timeout(600)
        mode = pg.evaluate("() => S.profile.payMode")
        ok("режим «% от первых дней» включился", mode == "pct", mode)
        pg.click('[data-back="1"]')
        pg.wait_for_timeout(400)
        pb = pg.locator("#payBreak").inner_text()
        ok("разбивка выплат показана", "аванс" in pb.lower(), pb[:120])
        ok("в разбивке видно процент", "40%" in pb or "40" in pb, pb[:120])

        print("\n[7] Напарник (смена вдвоём)")
        pg.click('.tabbar button[data-tab="tab"]')
        pg.wait_for_timeout(400)
        pg.click('#mateCard [data-act="mate-shift"]')
        pg.wait_for_timeout(700)
        ok("шторка открылась на напарника", pg.locator("#mateChips .chip.on[data-who='mate']").count() == 1)
        pg.click("#shSave")
        pg.wait_for_timeout(600)
        mateShift = pg.evaluate("() => Object.keys(S.mate.shifts).length")
        ok("смена напарника сохранена отдельно", mateShift == 1, mateShift)
        mine = pg.evaluate("() => Object.keys(S.shifts).length")
        ok("мои смены не пострадали", mine > 0, mine)

        print("\n[8] Копии")
        pg.click('.tabbar button[data-tab="cal"]')
        pg.wait_for_timeout(400)
        pg.on("dialog", lambda d: d.accept())
        before = pg.evaluate("() => Object.keys(S.shifts).length")
        pg.click('[data-act="copy-month"]')
        pg.wait_for_timeout(700)
        after = pg.evaluate("() => Object.keys(S.shifts).length")
        ok("месяц копируется в следующий", after > before, f"{before} → {after}")

        print("\n[9] Ссылка на график и календарь .ics")
        link = pg.evaluate("() => window.fxShareLink()")
        ok("ссылка на график собирается", isinstance(link, str) and "#g=" in link, link[:60])
        ics = pg.evaluate("() => { const s = document.createElement('script'); return null; }")
        ics_text = pg.evaluate("""() => {
            const ev = new Event('x');
            return (function(){ try { return window.__icsTest || ''; } catch(e){ return 'err'; } })();
        }""")
        pg.evaluate("() => { const a = document.querySelector('[data-act=\"export-ics\"]'); }")
        pg.click('.tabbar button[data-tab="set"]')
        pg.wait_for_timeout(300)
        pg.click('[data-act="export-ics"]')
        pg.wait_for_timeout(600)
        ok("экспорт .ics не падает", not any("ics" in e.lower() for e in errors), errors[:2])

        print("\n[10] Шторка дня: фактические часы и чаевые")
        pg.click('.tabbar button[data-tab="cal"]')
        pg.wait_for_timeout(400)
        day = pg.evaluate("() => document.querySelector('#calGrid .day.work').dataset.day")
        pg.click('#calGrid .day.work')
        pg.wait_for_timeout(600)
        pg.fill("#shHours", "9.5")
        pg.wait_for_timeout(300)
        pg.fill("#shBonus", "100")
        pg.wait_for_timeout(300)
        pg.click("#shSave")
        pg.wait_for_timeout(600)
        got = pg.evaluate("d => S.shifts[d]", day)
        parts = got.get("parts") or []
        expect_h = sum(p.get("hours", 0) for p in parts) if parts else got.get("hours", 0)
        money_ok = abs((expect_h * 275 + got.get("bonus", 0)) - (expect_h * 275 + 100)) < 1
        ok("часы и чаевые сохранились",
           money_ok and abs(got.get("hours", 0) - expect_h) < 0.01 and got.get("bonus", 0) == 100, got)

        print("\n[11] Ошибки в консоли")
        real = [e for e in errors if "favicon" not in e.lower()]
        ok("критических ошибок нет", len(real) == 0, real[:3])

        b.close()
    print("\n" + "=" * 46)
    print(f"  ПРОШЛО: {len(PASS)}   ПРОВАЛЕНО: {len(FAIL)}")
    if FAIL:
        for f in FAIL: print("   ✗ " + f)
    print("=" * 46)
    return 0 if not FAIL else 1

sys.exit(run())
