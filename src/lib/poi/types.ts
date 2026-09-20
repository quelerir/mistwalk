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
  // Ids of the same real place that came as separate OpenStreetMap elements (a node and its outline, say) and were
  // merged into this one. A place found under any of them counts as found.
  aka?: string[];
}

export interface DiscoveredPlace extends Poi {
  discoveredAt: number;
}
