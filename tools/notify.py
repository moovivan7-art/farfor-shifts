#!/usr/bin/env python3
"""Уведомилка в Telegram: присылает текст + картинки после важных шагов.

Один раз настрой:
    python3 tools/notify.py --setup
(впишет токен бота от @BotFather и твой chat_id)

Дальше:
    python3 tools/notify.py "Сделал: собрал APK v1.4" site/shots/app-home.png

Если токена нет — скрипт просто пишет отчёт в notify.out.txt, ничего не ломая.
"""
import json, os, sys, urllib.request, urllib.parse, mimetypes, uuid, time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(BASE, "tools", "notify.config.json")
FALLBACK = os.path.join(BASE, "notify.out.txt")
API = "https://api.telegram.org/bot{token}/{method}"


def load():
    if os.path.exists(CONFIG):
        try:
            return json.load(open(CONFIG, encoding="utf-8"))
        except Exception:
            pass
    return {}


def save(cfg):
    with open(CONFIG, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=1)
    os.chmod(CONFIG, 0o600)
    print("настройки сохранены:", CONFIG)


def api(token, method, payload=None):
    url = API.format(token=token, method=method)
    data = None
    if payload is not None:
        data = urllib.parse.urlencode(payload).encode()
    req = urllib.request.Request(url, data=data)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def send_photo(token, chat_id, path, caption=""):
    url = API.format(token=token, method="sendPhoto")
    boundary = uuid.uuid4().hex
    fields = {"chat_id": chat_id, "caption": caption[:1024]}
    body = b""
    for k, v in fields.items():
        body += ("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n" % (boundary, k, v)).encode()
    fname = os.path.basename(path)
    ctype = mimetypes.guess_type(fname)[0] or "application/octet-stream"
    body += ("--%s\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"%s\"\r\nContent-Type: %s\r\n\r\n" % (boundary, fname, ctype)).encode()
    with open(path, "rb") as f:
        body += f.read()
    body += ("\r\n--%s--\r\n" % boundary).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "multipart/form-data; boundary=%s" % boundary})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def main():
    args = sys.argv[1:]
    if args and args[0] == "--setup":
        cfg = load()
        cfg["bot_token"] = input("токен бота от @BotFather: ").strip()
        cfg["chat_id"] = input("твой chat_id (узнай: напиши боту /start и открой https://api.telegram.org/bot<ТОКЕН>/getUpdates): ").strip()
        save(cfg)
        try:
            me = api(cfg["bot_token"], "getMe")
            print("бот живой:", me.get("result", {}).get("username"))
        except Exception as e:
            print("не удалось проверить токен:", e)
        return

    if not args:
        print(__doc__)
        return
    text = args[0]
    photos = [a for a in args[1:] if os.path.exists(a)]
    cfg = load()
    token, chat = cfg.get("bot_token"), cfg.get("chat_id")
    if not token or not chat:
        with open(FALLBACK, "a", encoding="utf-8") as f:
            f.write("[%s] %s\n%s\n\n" % (time.strftime("%Y-%m-%d %H:%M"), text, "\n".join(photos)))
        print("нет настроек Telegram → записал в", FALLBACK)
        return
    try:
        api(token, "sendMessage", {"chat_id": chat, "text": text[:4000], "disable_web_page_preview": "false"})
        for p in photos:
            send_photo(token, chat, p, caption=os.path.basename(p))
            time.sleep(0.4)
        print("отправлено в Telegram ✓")
    except Exception as e:
        print("Telegram не отправил:", e)
        with open(FALLBACK, "a", encoding="utf-8") as f:
            f.write("[%s] %s\n%s\n\n" % (time.strftime("%Y-%m-%d %H:%M"), text, "\n".join(photos)))


if __name__ == "__main__":
    main()
