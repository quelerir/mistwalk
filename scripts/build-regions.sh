#!/usr/bin/env bash
# Builds src/assets/regions.json: borders, area and Wikidata id of the regions (Natural Earth admin-1, public domain)
# that world-cities.json lists for countries with a regions list. Needs network, node and npx (mapshaper through npx).
# Optional: REGIONS_CACHE=<dir> keeps the download (admin1.geojson).
set -euo pipefail

URL="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${REGIONS_CACHE:-$(mktemp -d)}"
mkdir -p "$DIR"
[ -z "${REGIONS_CACHE:-}" ] && trap 'rm -rf "$DIR"' EXIT

[ -s "$DIR/admin1.geojson" ] || curl -fsSL "$URL" -o "$DIR/admin1.geojson"

# 1. The regions we need, with their area from the original (unsimplified) borders.
node "$ROOT/scripts/compact-regions.mjs" prepare "$DIR/admin1.geojson" "$ROOT/src/assets/world-cities.json" "$DIR"
# 2. Simplify the borders (about 4 % of the points; coordinates to about a kilometre).
npx --yes mapshaper "$DIR/regions-in.geojson" -simplify 4% keep-shapes -o "$DIR/regions-simplified.geojson" format=geojson precision=0.01 force
# 3. Join the simplified borders with the areas, countries and Wikidata ids.
node "$ROOT/scripts/compact-regions.mjs" finish "$DIR/regions-simplified.geojson" "$DIR/regions-meta.json" "$ROOT/src/assets/regions.json"
ls -l "$ROOT/src/assets/regions.json"
