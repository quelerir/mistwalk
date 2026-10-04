#!/usr/bin/env bash
# Downloads 80 px wide PNG flags of the five republics from Wikimedia Commons into assets/flags/ and writes
# assets/flags/README.md with each file's Commons page and licence. Stops if a licence is not public domain.
# Needs network, curl and python3.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets/flags"
mkdir -p "$OUT"

python3 - "$OUT" <<'PY'
import json, sys, urllib.parse, urllib.request

out = sys.argv[1]
FILES = {
    "xa": "Flag of Abkhazia.svg",
    "xs": "Flag of South Ossetia.svg",
    "xt": "Flag of Transnistria (state).svg",
    "xn": "Flag of the Turkish Republic of Northern Cyprus.svg",
    "xl": "Flag of Somaliland.svg",
}
lines = ["# Republic flags", "", "80 px wide PNG thumbnails from Wikimedia Commons, made by `scripts/build-republic-flags.sh`.", ""]
for code, title in FILES.items():
    api = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata"
           "&iiurlwidth=80&titles=" + urllib.parse.quote("File:" + title))
    req = urllib.request.Request(api, headers={"User-Agent": "mistwalk-build/1.0"})
    page = next(iter(json.load(urllib.request.urlopen(req))["query"]["pages"].values()))
    info = page["imageinfo"][0]
    licence = info["extmetadata"]["LicenseShortName"]["value"]
    if "public domain" not in licence.lower():
        sys.exit(f"{title}: licence is {licence}, not public domain")
    data = urllib.request.urlopen(urllib.request.Request(info["thumburl"], headers={"User-Agent": "mistwalk-build/1.0"})).read()
    open(f"{out}/{code}.png", "wb").write(data)
    lines.append(f"- `{code}.png`: https://commons.wikimedia.org/wiki/{urllib.parse.quote('File:' + title.replace(' ', '_'))} ({licence})")
open(f"{out}/README.md", "w").write("\n".join(lines) + "\n")
print("\n".join(lines))
PY
