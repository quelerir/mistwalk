const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

export function crestUrlFromFile(file: string, width = 160): string {
  // Special:FilePath redirects to the file; ?width= makes Commons render SVG crests as PNG.
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
}

interface EntityResponse {
  entities?: Record<string, { claims?: { P94?: Array<{ mainsnak?: { datavalue?: { value?: string } } }> } }>;
}

// File name of the settlement's coat of arms (Wikidata P94), or null when it has none.
export async function fetchCrestFile(wikidata: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const url = `${WIKIDATA_API}?action=wbgetentities&ids=${wikidata}&props=claims&format=json&origin=*`;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`wikidata responded with ${response.status}`);
  const json = (await response.json()) as EntityResponse;
  return json.entities?.[wikidata]?.claims?.P94?.[0]?.mainsnak?.datavalue?.value ?? null;
}
