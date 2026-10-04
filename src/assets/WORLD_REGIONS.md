# Region borders

`regions.json` holds the borders, area and Wikidata id of 2458 regions (Natural Earth `admin_1_states_provinces`,
public domain) of the countries that get a regions list (more than 10 cities in more than one region, 119 countries),
keyed by `adm1_code` like `world-cities.json`. Made by `scripts/build-regions.sh` (needs network, node, npx;
`REGIONS_CACHE=<dir>` keeps the 39 MB download). Do not edit by hand.

- `areaKm2` is computed from the original borders on the sphere, before simplification, so percentages of large regions
  are not distorted. The borders are then simplified to about 4 % of their points (mapshaper `keep-shapes`,
  coordinates to about a kilometre): about 1 MB in all.
- `c` is the country the region's cities belong to; `w` is the Wikidata id used for the emblem (null when Natural Earth
  has none).
- Names are in `world-cities.json`. Regions of countries with a flat list are not included.
- Limits: a point within a few kilometres of a region border (or on a coast) can land in the neighbour; percentages
  of very small regions are approximate. Natural Earth's borders and region membership are used as they are.
