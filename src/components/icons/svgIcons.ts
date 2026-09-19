export type IconName =
  | 'map'
  | 'compass'
  | 'award'
  | 'user'
  | 'locate'
  | 'menu'
  | 'cloud'
  | 'moon'
  | 'logout';

export type LayerMode = 'stroke' | 'fill' | 'cutout';

export interface IconLayer {
  d: string;
  mode: LayerMode;
}

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const PIN_BODY = 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z';
const NEEDLE = 'M16.24 7.76L14.12 14.12L7.76 16.24L9.88 9.88Z';
const RIBBON = 'M8.21 13.89L7 23l5-3 5 3-1.21-9.12';
const USER_BODY = 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2';

// Icons without a distinct selected look use the same stroke for both states.
const line = (d: string) => ({
  outline: [{ d, mode: 'stroke' as const }],
  active: [{ d, mode: 'stroke' as const }],
});

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
  award: {
    outline: [
      { d: circle(12, 8, 7), mode: 'stroke' },
      { d: RIBBON, mode: 'stroke' },
    ],
    active: [
      { d: circle(12, 8, 7), mode: 'fill' },
      { d: `${RIBBON}z`, mode: 'fill' },
      { d: circle(12, 8, 2.5), mode: 'cutout' },
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
  menu: line('M4 6h16M4 12h16M4 18h16'),
  cloud: line('M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z'),
  moon: line('M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'),
  logout: line('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'),
};
