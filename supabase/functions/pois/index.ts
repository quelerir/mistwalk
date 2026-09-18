import { createClient } from "npm:@supabase/supabase-js@2";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TILE_ZOOM = 13;
const Q = String.fromCharCode(34);
const OVERPASS_URLS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
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
  const tourism = "nwr[" + Q + "tourism" + Q + "~" + Q + "^(viewpoint|attraction|artwork)$" + Q + "][" + Q + "name" + Q + "](" + bbox + ");";
  const historic = "nwr[" + Q + "historic" + Q + "~" + Q + "^(monument|memorial|castle|ruins|archaeological_site)$" + Q + "][" + Q + "name" + Q + "](" + bbox + ");";
  return "[out:json][timeout:25];(" + tourism + historic + ");out center;";
}

function kindOf(tags: any) {
  if (tags.tourism === "viewpoint") return "viewpoint";
  if (tags.tourism === "attraction") return "attraction";
  if (tags.tourism === "artwork") return "artwork";
  if (tags.historic === "castle") return "castle";
  if (tags.historic === "ruins" || tags.historic === "archaeological_site") return "ruins";
  if (tags.historic === "monument" || tags.historic === "memorial") return "monument";
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
    result.push({ id: el.type + "/" + el.id, name, kind, lat, lng });
  }
  return result;
}

async function fetchOverpass(query: string) {
  let errors = "";
  for (const url of OVERPASS_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "FogOfWarMap/0.1 (edge function)" },
        body: "data=" + encodeURIComponent(query),
      });
      if (response.ok) return await response.json();
      errors += url + " responded " + response.status + "; ";
    } catch (err) {
      errors += url + " failed " + String(err) + "; ";
    }
  }
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
  if (z !== TILE_ZOOM || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
    return reply({ error: "invalid tile" }, 400);
  }

  const key = z + "/" + x + "/" + y;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return reply({ error: "unauthorized" }, 401);

  const { data: cached } = await db.from("poi_tiles").select("pois, fetched_at").eq("tile_key", key).maybeSingle();
  if (cached && Date.now() - Date.parse(cached.fetched_at) < TTL_MS) return reply(cached.pois);

  try {
    const pois = parse(await fetchOverpass(buildQuery(z, x, y)));
    await db.from("poi_tiles").upsert({ tile_key: key, pois, fetched_at: new Date().toISOString() });
    return reply(pois);
  } catch (err) {
    if (cached) return reply(cached.pois);
    return reply({ error: String(err) }, 502);
  }
});
