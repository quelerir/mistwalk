#!/usr/bin/env bash
# Builds src/assets/world.json (country polygons) and world-points.json (one point per country)
# from Natural Earth 1:50m admin_0_countries (public domain). Needs network and node (mapshaper runs through npx).
# Usage: scripts/build-world-geojson.sh [simplify-percent]   (default 40%)
set -euo pipefail

SIMPLIFY="${1:-40%}"
SRC_URL="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$SRC_URL" -o "$TMP/ne.geojson"

# ISO_A2_EH is -99 for nobody we care about (France and Norway have it right there, unlike ISO_A2).
npx --yes mapshaper "$TMP/ne.geojson" \
  -filter 'ISO_A2_EH != "-99"' \
  -each 'code = ISO_A2_EH' \
  -filter-fields code \
  -dissolve code \
  -simplify "$SIMPLIFY" keep-shapes \
  -o "$ROOT/src/assets/world.json" format=geojson precision=0.01 force

npx --yes mapshaper "$TMP/ne.geojson" \
  -filter 'ISO_A2_EH != "-99"' \
  -each 'code = ISO_A2_EH' \
  -filter-fields code \
  -dissolve code \
  -points inner \
  -o "$ROOT/src/assets/world-points.json" format=geojson precision=0.01 force

ls -l "$ROOT/src/assets/world.json" "$ROOT/src/assets/world-points.json"
