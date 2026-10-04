#!/usr/bin/env bash
# Builds src/assets/republics.json: the borders of the five republics from Natural Earth (public domain),
# layer ne_10m_admin_0_disputed_areas. Needs network, node and npx (mapshaper runs through npx).
# Optional: REPUBLICS_CACHE=<dir> keeps the download.
set -euo pipefail

URL="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_disputed_areas.geojson"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${REPUBLICS_CACHE:-$(mktemp -d)}"
mkdir -p "$DIR"
[ -z "${REPUBLICS_CACHE:-}" ] && trap 'rm -rf "$DIR"' EXIT

[ -s "$DIR/disputed.geojson" ] || curl -fsSL "$URL" -o "$DIR/disputed.geojson"

# B35 Abkhazia, B37 South Ossetia, B36 Transnistria, B20 Northern Cyprus, B30 Somaliland.
npx --yes mapshaper "$DIR/disputed.geojson" \
  -filter 'BRK_A3 == "B35" || BRK_A3 == "B37" || BRK_A3 == "B36" || BRK_A3 == "B20" || BRK_A3 == "B30"' \
  -filter-fields BRK_A3 \
  -o "$DIR/republics.geojson" format=geojson precision=0.001 force

node "$ROOT/scripts/compact-republics.mjs" "$DIR/republics.geojson" "$ROOT/src/assets/republics.json"
