#!/bin/sh
# ============================================================================
# build-images.sh — (re)generate WebP versions of every photographic image.
#
# Why: the site serves images via <picture> with a WebP <source> and a JPEG
# fallback (see upgrade_images_to_webp() in build.py). build.py only adds the
# <source> when a sibling .webp exists on disk — so after you ADD or REPLACE a
# .jpg/.png photo, run this once to (re)create the .webp, then run build.py.
#
# Scope: photographs in assets/img/ and images/ only. It intentionally SKIPS:
#   - og-*.jpg            (social cards are referenced only in <meta>; scrapers
#                          want JPEG, and build.py never wraps them)
#   - assets/img/developers/*  (brand logos are SVG/PNG, normalised via CSS)
#   - *.svg, *.png icons  (favicon/app icons)
#
# Requires: cwebp  (macOS:  brew install webp   ·   Debian/Ubuntu: apt install webp)
#
# Usage:
#   ./build-images.sh          # generate/refresh all WebP
#   ./build-images.sh --force  # rebuild even if the .webp is newer than the .jpg
#   ./build-images.sh --clean  # delete every generated .webp (then exits)
#
# After running:  python3 build.py   (re-wraps <img> in <picture>)
# ============================================================================
set -eu

cd "$(dirname "$0")"

QUALITY=78          # visually lossless-ish for photos; tune if needed
METHOD=6            # 0..6, higher = slower but smaller
FORCE=0
CLEAN=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --clean) CLEAN=1 ;;
    *) echo "Unknown option: $arg"; exit 2 ;;
  esac
done

if ! command -v cwebp >/dev/null 2>&1; then
  echo "ERROR: cwebp not found. Install it first:"
  echo "  macOS:         brew install webp"
  echo "  Debian/Ubuntu: sudo apt-get install webp"
  exit 1
fi

if [ "$CLEAN" = "1" ]; then
  n=0
  for w in $(find assets/img images -type f -iname '*.webp' | grep -v '/developers/'); do
    rm -f "$w"; n=$((n+1))
  done
  echo "Removed $n generated .webp file(s)."
  exit 0
fi

# Candidate source photos (jpg/jpeg/png) from the two photo dirs, excluding OG
# cards and the developer-logo folder. POSIX-sh friendly (no mapfile/bashisms).
created=0; skipped=0; jpg_total=0; webp_total=0
for src in $(find assets/img images -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) 2>/dev/null \
              | grep -v '/developers/' \
              | grep -vE '/og-[^/]+\.(jpg|jpeg|png)$' \
              | sort); do
  webp="${src%.*}.webp"
  if [ "$FORCE" = "0" ] && [ -f "$webp" ] && [ "$webp" -nt "$src" ]; then
    skipped=$((skipped+1))
  else
    cwebp -quiet -q "$QUALITY" -m "$METHOD" "$src" -o "$webp"
    created=$((created+1))
  fi
  jpg_total=$(( jpg_total + $(wc -c < "$src") ))
  [ -f "$webp" ] && webp_total=$(( webp_total + $(wc -c < "$webp") ))
done

echo "WebP: $created created, $skipped up-to-date."
if [ "$jpg_total" -gt 0 ]; then
  pct=$(( 100 - webp_total * 100 / jpg_total ))
  printf "Payload: source %d KB -> webp %d KB (%d%% lighter)\n" \
    "$(( jpg_total / 1024 ))" "$(( webp_total / 1024 ))" "$pct"
fi
echo "Next: run  python3 build.py  to wrap images in <picture>."
