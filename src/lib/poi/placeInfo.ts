import { haversineDistanceMeters } from '../geo/distance';
import type { Poi } from './types';

export interface PlaceInfo {
  title: string;
  description: string | null;
  imageUrl: string | null;
  pageUrl: string | null;
  source: string;
}

const LANGUAGES = ['ru', 'en', 'de'];
const ARTICLE_RADIUS_METERS = 300;
const PHOTO_RADIUS_METERS = 50;
const WIKIDATA_RADIUS_METERS = 250;

interface WikiPage {
  title: string;
  extract?: string;
  fullurl?: string;
  thumbnail?: { source: string };
  index?: number;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((t) => t.length >= 3);
}

// A nearby article counts only if it is plausibly about this very place.
export function pageMatchesName(page: WikiPage, name: string): boolean {
  const wanted = normalize(name);
  if (!wanted) return false;
  const title = normalize(page.title);
  if (title.includes(wanted) || wanted.includes(title)) return true;
  const wantedTokens = tokens(name);
  if (wantedTokens.length === 0) return false;
  const titleTokens = new Set(tokens(page.title));
  const hits = wantedTokens.filter((t) => titleTokens.has(t)).length;
  if (hits >= Math.max(1, Math.ceil(wantedTokens.length * 0.6))) return true;
  return normalize(page.extract ?? '').includes(wanted);
}

export function pickPage(pages: WikiPage[], name: string): WikiPage | null {
  const sorted = [...pages].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return sorted.find((page) => pageMatchesName(page, name)) ?? null;
}

async function geosearch(
  host: string,
  poi: Pick<Poi, 'lat' | 'lng'>,
  radius: number,
  extra: string,
  fetchImpl: typeof fetch
): Promise<WikiPage[]> {
  const url =
    `https://${host}/w/api.php?action=query&generator=geosearch&ggscoord=${poi.lat}%7C${poi.lng}` +
    `&ggsradius=${radius}&ggslimit=10&format=json&formatversion=2&origin=*${extra}`;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`${host} responded with ${response.status}`);
  const json = (await response.json()) as { query?: { pages?: WikiPage[] } };
  return json.query?.pages ?? [];
}

const ARTICLE_PROPS =
  '&prop=extracts%7Cpageimages%7Cinfo&exintro=1&explaintext=1&exsentences=4&exlimit=max' +
  '&piprop=thumbnail&pithumbsize=700&inprop=url';

// Wikipedia article about the place (in the first language that has one), else a nearby
// Wikimedia Commons photo, else null.
export async function fetchPlaceInfo(
  poi: Pick<Poi, 'name' | 'lat' | 'lng'> & Partial<Pick<Poi, 'wikipedia' | 'wikidata'>>,
  fetchImpl: typeof fetch = fetch
): Promise<PlaceInfo | null> {
  // OpenStreetMap's own link to the encyclopedia entry is exact; use it before guessing by location.
  const tagged = await fetchFromOsmTags(poi, fetchImpl);
  if (tagged) return tagged;

  for (const lang of LANGUAGES) {
    const pages = await geosearch(`${lang}.wikipedia.org`, poi, ARTICLE_RADIUS_METERS, ARTICLE_PROPS, fetchImpl);
    const page = pickPage(pages, poi.name);
    if (page) {
      return {
        title: page.title,
        description: page.extract?.trim() || null,
        imageUrl: page.thumbnail?.source ?? null,
        pageUrl: page.fullurl ?? null,
        source: `Википедия (${lang})`,
      };
    }
  }

  const entity = await fetchWikidataInfo(poi, fetchImpl);
  if (entity) return entity;

  // A nearby photo is only trustworthy if the file is named after the place.
  const photos = await geosearch(
    'commons.wikimedia.org',
    poi,
    PHOTO_RADIUS_METERS,
    '&ggsnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=700',
    fetchImpl
  );
  const photo = photos
    .map((p) => p as WikiPage & { imageinfo?: Array<{ thumburl?: string; url?: string; descriptionurl?: string }> })
    .find((p) => pageMatchesName({ title: p.title.replace(/^File:/i, '').replace(/\.[a-z]+$/i, '') }, poi.name));
  const info = photo?.imageinfo?.[0];
  if (!photo || !(info?.thumburl ?? info?.url)) return null;
  return {
    title: poi.name,
    description: null,
    imageUrl: info?.thumburl ?? info?.url ?? null,
    pageUrl: info?.descriptionurl ?? null,
    source: 'Wikimedia Commons',
  };
}

interface WikidataEntity {
  id: string;
  labels?: Record<string, { value: string }>;
  sitelinks?: Record<string, { title: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: {
    P625?: Array<{ mainsnak?: { datavalue?: { value?: { latitude: number; longitude: number } } } }>;
    P18?: Array<{ mainsnak?: { datavalue?: { value?: string } } }>;
  };
}

async function wikidata(params: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(`https://www.wikidata.org/w/api.php?${params}&format=json&origin=*`);
  if (!response.ok) throw new Error(`wikidata responded with ${response.status}`);
  return response.json();
}

// Wikidata item for the place (checked by coordinates): a short "what is this" line and a photo.
export async function fetchWikidataInfo(
  poi: Pick<Poi, 'name' | 'lat' | 'lng'>,
  fetchImpl: typeof fetch = fetch
): Promise<PlaceInfo | null> {
  const search = (await wikidata(
    `action=wbsearchentities&search=${encodeURIComponent(poi.name)}&language=en&uselang=ru&limit=6`,
    fetchImpl
  )) as { search?: Array<{ id: string }> };
  const ids = (search.search ?? []).map((r) => r.id);
  if (ids.length === 0) return null;

  const data = (await wikidata(
    `action=wbgetentities&ids=${ids.join('%7C')}&props=claims%7Cdescriptions%7Clabels&languages=ru%7Cen%7Cde`,
    fetchImpl
  )) as { entities?: Record<string, WikidataEntity> };

  let best: { entity: WikidataEntity; meters: number } | null = null;
  for (const entity of Object.values(data.entities ?? {})) {
    const at = entity.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    if (!at) continue;
    const meters = haversineDistanceMeters(poi, { lat: at.latitude, lng: at.longitude });
    if (meters <= WIKIDATA_RADIUS_METERS && (!best || meters < best.meters)) best = { entity, meters };
  }
  if (!best) return null;

  return infoFromEntity(best.entity, poi.name);
}

function infoFromEntity(entity: WikidataEntity, fallbackName: string): PlaceInfo | null {
  const pick = (field: 'descriptions' | 'labels') =>
    LANGUAGES.map((l) => entity[field]?.[l]?.value).find(Boolean) ?? null;
  const file = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  const description = pick('descriptions');
  const imageUrl = file
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=700`
    : null;
  if (!description && !imageUrl) return null;
  return {
    title: pick('labels') ?? fallbackName,
    description: description ? description.charAt(0).toUpperCase() + description.slice(1) : null,
    imageUrl,
    pageUrl: `https://www.wikidata.org/wiki/${entity.id}`,
    source: 'Wikidata',
  };
}

interface Summary {
  title?: string;
  extract?: string;
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string } };
}

async function summaryFor(lang: string, title: string, fetchImpl: typeof fetch): Promise<PlaceInfo | null> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`;
  const response = await fetchImpl(url);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${lang}.wikipedia.org responded with ${response.status}`);
  const json = (await response.json()) as Summary;
  if (!json.extract) return null;
  return {
    title: json.title ?? title,
    description: json.extract.trim(),
    imageUrl: json.thumbnail?.source ?? null,
    pageUrl: json.content_urls?.desktop?.page ?? null,
    source: `Википедия (${lang})`,
  };
}

// The same article in Russian, when it exists.
async function russianTitle(lang: string, title: string, fetchImpl: typeof fetch): Promise<string | null> {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}` +
    '&prop=langlinks&lllang=ru&redirects=1&format=json&formatversion=2&origin=*';
  const response = await fetchImpl(url);
  if (!response.ok) return null;
  const json = (await response.json()) as { query?: { pages?: Array<{ langlinks?: Array<{ title: string }> }> } };
  return json.query?.pages?.[0]?.langlinks?.[0]?.title ?? null;
}

export function parseWikipediaTag(tag: string): { lang: string; title: string } | null {
  const match = /^([a-z]{2,3}(?:-[a-z]+)?):(.+)$/i.exec(tag.trim());
  return match ? { lang: match[1].toLowerCase(), title: match[2].trim() } : null;
}

async function fromArticle(lang: string, title: string, fetchImpl: typeof fetch): Promise<PlaceInfo | null> {
  if (lang !== 'ru') {
    const ru = await russianTitle(lang, title, fetchImpl).catch(() => null);
    if (ru) {
      const russian = await summaryFor('ru', ru, fetchImpl);
      if (russian) return russian;
    }
  }
  return summaryFor(lang, title, fetchImpl);
}

async function fetchFromOsmTags(
  poi: Pick<Poi, 'name'> & Partial<Pick<Poi, 'wikipedia' | 'wikidata'>>,
  fetchImpl: typeof fetch
): Promise<PlaceInfo | null> {
  const article = poi.wikipedia ? parseWikipediaTag(poi.wikipedia) : null;
  if (article) {
    const info = await fromArticle(article.lang, article.title, fetchImpl);
    if (info) return info;
  }

  if (poi.wikidata && /^Q\d+$/.test(poi.wikidata)) {
    const data = (await wikidata(
      `action=wbgetentities&ids=${poi.wikidata}&props=sitelinks%7Cdescriptions%7Clabels%7Cclaims` +
        '&sitefilter=ruwiki%7Cenwiki%7Cdewiki&languages=ru%7Cen%7Cde',
      fetchImpl
    )) as { entities?: Record<string, WikidataEntity> };
    const entity = data.entities?.[poi.wikidata];
    if (!entity) return null;
    for (const lang of LANGUAGES) {
      const title = entity.sitelinks?.[`${lang}wiki`]?.title;
      if (title) {
        const info = await summaryFor(lang, title, fetchImpl);
        if (info) return info;
      }
    }
    return infoFromEntity(entity, poi.name);
  }
  return null;
}
