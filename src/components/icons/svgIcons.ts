export type IconName = 'map' | 'compass' | 'user' | 'locate';

export type LayerMode = 'stroke' | 'fill' | 'cutout';

export interface IconLayer {
  d: string;
  mode: LayerMode;
}

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const PIN_BODY = 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z';
const NEEDLE = 'M16.24 7.76L14.12 14.12L7.76 16.24L9.88 9.88Z';
const USER_BODY = 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2';

export const ICONS: Record<IconName, { outline: IconLayer[]; active: IconLayer[] }> = {
  map: {
    outline: [
      { d: PIN_BODY, mode: 'stroke' },
      { d: circle(12, 10, 3), mode: 'stroke' },
    ],
    active: [
      { d: PIN_BODY, mode: 'fill' },
      { d: circle(12, 10, 3), mode: 'cutout' },
    ],
  },
  compass: {
    outline: [
      { d: circle(12, 12, 10), mode: 'stroke' },
      { d: NEEDLE, mode: 'stroke' },
    ],
    active: [
      { d: circle(12, 12, 10), mode: 'fill' },
      { d: NEEDLE, mode: 'cutout' },
    ],
  },
  user: {
    outline: [
      { d: USER_BODY, mode: 'stroke' },
      { d: circle(12, 7, 4), mode: 'stroke' },
    ],
    active: [
      { d: `${USER_BODY}z`, mode: 'fill' },
      { d: circle(12, 7, 4), mode: 'fill' },
    ],
  },
  locate: {
    outline: [
      { d: circle(12, 12, 7), mode: 'stroke' },
      { d: 'M12 2v3M12 19v3M2 12h3M19 12h3', mode: 'stroke' },
      { d: circle(12, 12, 2), mode: 'fill' },
    ],
    active: [
      { d: circle(12, 12, 7), mode: 'stroke' },
      { d: 'M12 2v3M12 19v3M2 12h3M19 12h3', mode: 'stroke' },
      { d: circle(12, 12, 2), mode: 'fill' },
    ],
  },
};
