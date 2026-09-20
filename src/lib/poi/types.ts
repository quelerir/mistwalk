export type PoiKind =
  | 'viewpoint'
  | 'monument'
  | 'castle'
  | 'ruins'
  | 'attraction'
  | 'artwork'
  | 'museum'
  | 'park'
  | 'beach'
  | 'worship'
  | 'nature';

export interface Poi {
  id: string;
  name: string;
  kind: PoiKind;
  lat: number;
  lng: number;
  // OpenStreetMap links to the encyclopedia entry, e.g. "de:Palais Seilern" and "Q123".
  wikipedia?: string;
  wikidata?: string;
}

export interface DiscoveredPlace extends Poi {
  discoveredAt: number;
}
