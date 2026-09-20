import type { PoiKind } from './types';

// Each kind of place has its own colour, so lists and markers are readable at a glance.
export const KIND_COLOR: Record<PoiKind, string> = {
  monument: '#E9765B',
  artwork: '#9B6BE8',
  viewpoint: '#3BA4D9',
  castle: '#C58B3A',
  attraction: '#F2A93B',
  ruins: '#8C8577',
  museum: '#4F7DF3',
  park: '#4BB878',
  beach: '#D9B86A',
  worship: '#C4629A',
  nature: '#7FA650',
};

// A soft tint of the kind colour for the badge behind its icon.
export function kindTint(kind: PoiKind): string {
  return `${KIND_COLOR[kind]}26`;
}
