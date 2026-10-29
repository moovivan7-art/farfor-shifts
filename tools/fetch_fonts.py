#!/usr/bin/env python3
"""Скачивает шрифты Inter и Montserrat (латиница + кириллица) в assets/fonts.

Файлы нужны для крупной типографики приложения и сайта.
    python3 tools/fetch_fonts.py
"""
import urllib.request, re, os, ssl

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "assets", "fonts")
os.makedirs(OUT, exist_ok=True)
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")
CTX = ssl.create_default_context()


def grab(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=30, context=CTX).read()


SPECS = [
    ("Inter", "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"),
    ("Montserrat", "https://fonts.googleapis.com/css2?family=Montserrat:wght@800&display=swap"),
]

for fam, url in SPECS:
    css = grab(url).decode("utf-8")
    for block in re.findall(r"@font-face\s*\{(.*?)\}", css, re.S):
        wt = re.search(r"font-weight:\s*(\d+)", block)
        ur = re.search(r"unicode-range:\s*([^;]+);", block)
        src = re.search(r"url\((https://[^)]+\.woff2)\)", block)
        if not (wt and ur and src):
            continue
        urange = ur.group(1)
        if "U+0301" in urange or "U+0400-045F" in urange:
            subset = "cyrillic"
        elif "U+0000-00FF" in urange:
            subset = "latin"
        else:
            continue
        name = f"{fam}-{wt.group(1)}-{subset}.woff2"
        path = os.path.join(OUT, name)
        if not os.path.exists(path):
            open(path, "wb").write(grab(src.group(1)))
            print("шрифт:", name, os.path.getsize(path) // 1024, "КБ")
print("шрифты на месте:", OUT)
