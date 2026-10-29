#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  Сборка APK «Смена» из исходников.
#
#  Нужно: JDK 17, Android SDK 34 (build-tools 34.0.0), Gradle 8.7
#  Переменные окружения:
#     ANDROID_HOME=/path/to/android-sdk
#     JAVA_HOME=/path/to/jdk-17
#
#  Ключ подписи: android/keystore.properties (в репозиторий не попадает)
#     storeFile=/workspace/farfor.keystore
#     storePassword=...
#     keyAlias=farfor
#     keyPassword=...
# ═══════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/opt/android/sdk}}"
GRADLE="${GRADLE_BIN:-gradle}"
APPDIR="$ROOT/android/app/src/main"
OUT="$ROOT/android/app/build/outputs/apk/release"

echo "▸ иконки"
python3 tools/make_icon_v2.py >/dev/null
python3 - "$ROOT" <<'PY'
from PIL import Image
import os, sys
BASE = sys.argv[1]
src = Image.open(f"{BASE}/assets/icon-512.png").convert("RGBA")
dens = {"mdpi":48, "hdpi":72, "xhdpi":96, "xxhdpi":144, "xxxhdpi":192}
for d, px in dens.items():
    out = f"{BASE}/android/app/src/main/res/mipmap-{d}"
    os.makedirs(out, exist_ok=True)
    src.resize((px, px), Image.LANCZOS).save(f"{out}/ic_launcher.png")
    # круглая иконка — та же картинка в круге
    sq = Image.new("RGBA", (px, px), (0,0,0,0))
    sq.paste(src.resize((px, px), Image.LANCZOS), (0,0))
    sq.save(f"{out}/ic_launcher_round.png")
print("  иконки на месте")
PY

echo "▸ ассеты веб-приложения → android assets"
rm -rf "$APPDIR/assets"
mkdir -p "$APPDIR/assets"
cp index.html app.js app-fx.js styles.css manifest.webmanifest sw.js "$APPDIR/assets/"
cp -r assets/. "$APPDIR/assets/assets/"
du -sh "$APPDIR/assets"

echo "▸ сборка"
cd "$ROOT/android"
export ANDROID_HOME="$SDK" ANDROID_SDK_ROOT="$SDK"
if [ -f keystore.properties ]; then
  echo "  ключ подписи найден"
  "$GRADLE" --no-daemon -q assembleRelease
else
  echo "  ВНИМАНИЕ: нет keystore.properties — собираем без подписи (unsigned)"
  "$GRADLE" --no-daemon -q assembleRelease
fi

APK=$(find "$ROOT/android/app/build/outputs/apk" -name "*.apk" | head -1)
echo "▸ APK: $APK"
ls -la "$APK"
sha256sum "$APK"
echo "$APK"
