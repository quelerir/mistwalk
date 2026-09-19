import type { PoiKind } from './types';

// Each kind of place has its own colour, so lists and markers are readable at a glance.
export const KIND_COLOR: Record<PoiKind, string> = {
  monument: '#E9765B',
  artwork: '#9B6BE8',
  viewpoint: '#3BA4D9',
  castle: '#C58B3A',
  attraction: '#F2A93B',
  ruins: '#8C8577',
};

// A soft tint of the kind colour for the badge behind its icon.
export function kindTint(kind: PoiKind): string {
  return `${KIND_COLOR[kind]}26`;
}
