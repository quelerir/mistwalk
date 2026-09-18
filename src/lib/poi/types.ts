export type PoiKind = 'viewpoint' | 'monument' | 'castle' | 'ruins' | 'attraction' | 'artwork';

export interface Poi {
  id: string;
  name: string;
  kind: PoiKind;
  lat: number;
  lng: number;
}

export interface DiscoveredPlace extends Poi {
  discoveredAt: number;
}
