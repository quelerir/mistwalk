#!/usr/bin/env bash
# Builds src/assets/world-cities.json: every Natural Earth populated place with its region (admin-1) and Russian names.
# Needs network, node and npx (mapshaper runs through npx). Optional: WORLD_CITIES_CACHE=<dir> keeps the downloads.
# Usage: scripts/build-world-cities.sh
set -euo pipefail

BASE="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${WORLD_CITIES_CACHE:-$(mktemp -d)}"
mkdir -p "$DIR"
[ -z "${WORLD_CITIES_CACHE:-}" ] && trap 'rm -rf "$DIR"' EXIT

[ -s "$DIR/places.geojson" ] || curl -fsSL "$BASE/ne_10m_populated_places.geojson" -o "$DIR/places.geojson"
[ -s "$DIR/admin1.geojson" ] || curl -fsSL "$BASE/ne_10m_admin_1_states_provinces.geojson" -o "$DIR/admin1.geojson"

# Point in polygon: each place takes the properties of the admin-1 area that contains it.
npx --yes mapshaper "$DIR/places.geojson" \
  -join "$DIR/admin1.geojson" fields=adm1_code,name_ru,name_en \
  -o "$DIR/joined.geojson" format=geojson force

node "$ROOT/scripts/compact-world-cities.mjs" "$DIR/joined.geojson" "$ROOT/src/assets/world-cities.json"
ls -l "$ROOT/src/assets/world-cities.json"
