import { createClient } from "npm:@supabase/supabase-js@2";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TILE_ZOOM = 13;
const Q = String.fromCharCode(34);
// A dense city tile takes Overpass 15 s and more with the wider set of places (its own query limit is 25 s), so wait for it
// instead of giving up at 12 s, which left the cache empty and every phone asking Overpass by itself.
const MIRROR_TIMEOUT_MS = 28000;
// Tiles being fetched right now: a retry that comes while the first request is still running shares it.
const filling = new Map<string, Promise<any[]>>();
const OVERPASS_URLS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
// Builds that predate the wider set of places do not know the newer kinds and would crash on them, so only clients
// that say they understand them (kinds: 2 in the request) get those; the rest are sent the six original kinds.
const LEGACY_KINDS = new Set(["viewpoint", "monument", "castle", "ruins", "attraction", "artwork"]);
const CLIENT_KINDS_VERSION = 2;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

function reply(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function tileLng(x: number, z: number) {
  return (x / 2 ** z) * 360 - 180;
}

function tileLat(y: number, z: number) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function buildQuery(z: number, x: number, y: number) {
  const bbox = [tileLat(y + 1, z), tileLng(x, z), tileLat(y, z), tileLng(x + 1, z)].join(",");
  const clause = (filter: string) => "nwr" + filter + "(" + bbox + ");";
  const tag = (key: string, values: string) => "[" + Q + key + Q + "~" + Q + "^(" + values + ")$" + Q + "]";
  const name = "[" + Q + "name" + Q + "]";
  const wikidata = "[" + Q + "wikidata" + Q + "]";
  // Parks, temples and lesser historic buildings must also have a wikidata entry, otherwise a big city would fill the
  // map with every churchyard and lawn.
  return (
    "[out:json][timeout:25];(" +
    clause(tag("tourism", "viewpoint|attraction|artwork|museum|gallery|zoo|theme_park|aquarium") + name) +
    clause(tag("historic", "monument|memorial|castle|fort|ruins|archaeological_site") + name) +
    clause(tag("historic", "manor|city_gate|tower|tomb|building") + name + wikidata) +
    clause(tag("natural", "waterfall|peak|cave_entrance|beach") + name) +
    clause("[" + Q + "man_made" + Q + "=" + Q + "lighthouse" + Q + "]" + name) +
    clause("[" + Q + "leisure" + Q + "=" + Q + "park" + Q + "]" + name + wikidata) +
    clause("[" + Q + "amenity" + Q + "=" + Q + "place_of_worship" + Q + "]" + name + wikidata) +
    ");out center;"
  );
}

function kindOf(tags: any) {
  switch (tags.tourism) {
    case "viewpoint": return "viewpoint";
    case "attraction": case "zoo": case "theme_park": case "aquarium": return "attraction";
    case "artwork": return "artwork";
    case "museum": case "gallery": return "museum";
  }
  switch (tags.historic) {
    case "castle": case "fort": return "castle";
    case "ruins": case "archaeological_site": return "ruins";
    case "monument": case "memorial": return "monument";
    case "manor": case "city_gate": case "tower": case "tomb": case "building": return "attraction";
  }
  if (tags.natural === "beach") return "beach";
  if (tags.natural === "waterfall" || tags.natural === "peak" || tags.natural === "cave_entrance") return "nature";
  if (tags.man_made === "lighthouse") return "attraction";
  if (tags.leisure === "park") return "park";
  if (tags.amenity === "place_of_worship") return "worship";
  return null;
}

function parse(json: any) {
  const result: any[] = [];
  for (const el of json.elements ?? []) {
    const tags = el.tags;
    const name = tags ? tags["name:ru"] ?? tags.name : null;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!tags || !name || lat === undefined || lng === undefined) continue;
    const kind = kindOf(tags);
    if (!kind) continue;
    const poi: any = { id: el.type + "/" + el.id, name, kind, lat, lng };
    if (tags.wikipedia) poi.wikipedia = tags.wikipedia;
    if (tags.wikidata) poi.wikidata = tags.wikidata;
    result.push(poi);
  }
  return result;
}

async function fetchOverpass(query: string) {
  let errors = "";
  for (const url of OVERPASS_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mistwalk/1.0 (+https://github.com/quelerir/mistwalk)" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(MIRROR_TIMEOUT_MS),
      });
      if (response.ok) { console.log("overpass ok: " + url); return await response.json(); }
      errors += url + " responded " + response.status + "; ";
    } catch (err) {
      errors += url + " failed " + String(err) + "; ";
    }
  }
  console.log("overpass failed: " + errors);
  throw new Error(errors);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let input: any;
  try {
    input = await req.json();
  } catch {
    return reply({ error: "invalid json" }, 400);
  }

  const { z, x, y } = input ?? {};
  const forClient = (pois: any[]) => (input?.kinds === CLIENT_KINDS_VERSION ? pois : pois.filter((p) => LEGACY_KINDS.has(p.kind)));
  if (z !== TILE_ZOOM || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
    return reply({ error: "invalid tile" }, 400);
  }

  const key = "v3/" + z + "/" + x + "/" + y;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return reply({ error: "unauthorized" }, 401);

  const { data: cached } = await db.from("poi_tiles").select("pois, fetched_at").eq("tile_key", key).maybeSingle();
  if (cached && Date.now() - Date.parse(cached.fetched_at) < TTL_MS) return reply(forClient(cached.pois));

  let job = filling.get(key);
  if (!job) {
    job = (async () => {
      const pois = parse(await fetchOverpass(buildQuery(z, x, y)));
      await db.from("poi_tiles").upsert({ tile_key: key, pois, fetched_at: new Date().toISOString() });
      return pois;
    })().finally(() => filling.delete(key));
    filling.set(key, job);
    // Keep going after a phone has given up waiting, so a slow tile still lands in the cache for its next try.
    (globalThis as any).EdgeRuntime?.waitUntil?.(job.catch(() => {}));
  }
  try {
    return reply(forClient(await job));
  } catch (err) {
    if (cached) return reply(forClient(cached.pois));
    return reply({ error: String(err) }, 502);
  }
});
