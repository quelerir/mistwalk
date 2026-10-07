const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
// Wikidata answers up to 50 ids per request.
const BATCH_SIZE = 50;

export function crestUrlFromFile(file: string, width = 160): string {
  // Special:FilePath redirects to the file; ?width= makes Commons render SVG crests as PNG.
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
}

type Claims = Record<string, Array<{ mainsnak?: { datavalue?: { value?: string } } }> | undefined>;

interface EntityResponse {
  entities?: Record<string, { claims?: Claims }>;
}

// File names of the emblems of many Wikidata items at once (id -> file name, or null when the item has none), at most 50
// ids per request. For each id the first of `props` that has a value wins: P94 is the coat of arms, P41 the flag.
export async function fetchCrestFiles(
  ids: string[],
  props: string[] = ['P94'],
  fetchImpl: typeof fetch = fetch
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const url = `${WIKIDATA_API}?action=wbgetentities&ids=${encodeURIComponent(batch.join('|'))}&props=claims&format=json&origin=*`;
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`wikidata responded with ${response.status}`);
    const json = (await response.json()) as EntityResponse;
    for (const id of batch) {
      const claims = json.entities?.[id]?.claims;
      let file: string | null = null;
      for (const prop of props) {
        file = claims?.[prop]?.[0]?.mainsnak?.datavalue?.value ?? null;
        if (file) break;
      }
      out[id] = file;
    }
  }
  return out;
}

// File name of the settlement's coat of arms (Wikidata P94), or null when it has none.
export async function fetchCrestFile(wikidata: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  return (await fetchCrestFiles([wikidata], ['P94'], fetchImpl))[wikidata] ?? null;
}
