export type IconName =
  | 'map'
  | 'compass'
  | 'award'
  | 'user'
  | 'locate'
  | 'menu'
  | 'cloud'
  | 'moon'
  | 'bell'
  | 'flag'
  | 'download'
  | 'weather'
  | 'close'
  | 'book'
  | 'sort-distance'
  | 'sort-name'
  | 'sort-distance-desc'
  | 'sort-name-desc'
  | 'check'
  | 'feed'
  | 'grid'
  | 'logout'
  | 'navigate'
  | 'settings'
  | 'back'
  | 'poi-viewpoint'
  | 'poi-monument'
  | 'poi-castle'
  | 'poi-ruins'
  | 'poi-attraction'
  | 'poi-artwork'
  | 'poi-museum'
  | 'poi-park'
  | 'poi-beach'
  | 'poi-worship'
  | 'poi-nature';

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

const shapes = (layers: IconLayer[]) => ({ outline: layers, active: layers });

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
  // Bars that grow with distance, and А–Я letters, both with a "down" arrow.
  'sort-distance': shapes([
    { d: 'M3 6h5M3 12h9M3 18h13', mode: 'stroke' },
    { d: 'M20 5v14M16.5 15.5L20 19l3.5-3.5', mode: 'stroke' },
  ]),
  'sort-name': shapes([
    { d: 'M3 10l3.5-8L10 10M4.6 7h3.8', mode: 'stroke' },
    { d: 'M3 14h7l-7 8h7', mode: 'stroke' },
    { d: 'M20 5v14M16.5 15.5L20 19l3.5-3.5', mode: 'stroke' },
  ]),
  // The same two, backwards: long bars first, letters Я–А, and an "up" arrow.
  'sort-distance-desc': shapes([
    { d: 'M3 6h13M3 12h9M3 18h5', mode: 'stroke' },
    { d: 'M20 19V5M16.5 8.5L20 5l3.5 3.5', mode: 'stroke' },
  ]),
  'sort-name-desc': shapes([
    { d: 'M3 2h7l-7 8h7', mode: 'stroke' },
    { d: 'M3 22l3.5-8L10 22M4.6 19h3.8', mode: 'stroke' },
    { d: 'M20 19V5M16.5 8.5L20 5l3.5 3.5', mode: 'stroke' },
  ]),
  check: line('M5 12.5l4.5 4.5L19 7.5'),
  // A post card: a round avatar and lines of text, like an entry of a friend's feed.
  feed: shapes([
    { d: 'M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z', mode: 'stroke' },
    { d: circle(8.5, 9.5, 1.8), mode: 'stroke' },
    { d: 'M13.5 8.5h3.5M13.5 12h3.5M7 16h10', mode: 'stroke' },
  ]),
  // Four squares: "all kinds".
  grid: shapes([
    { d: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z', mode: 'stroke' },
  ]),
  close: line('M6 6l12 12M18 6L6 18'),
  book: line('M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5'),
  weather: line('M17.5 16H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9zM9 19v2M13 19v2M17 19v2'),
  download: line('M12 3v12M7 10l5 5 5-5M4 21h16'),
  flag: line('M4 22V4M4 4h13l-2 4 2 4H4'),
  bell: line('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0'),
  'poi-viewpoint': shapes([
    { d: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z', mode: 'stroke' },
    { d: circle(12, 12, 3), mode: 'stroke' },
  ]),
  'poi-monument': shapes([
    { d: 'M12 2l3 5v10H9V7z', mode: 'stroke' },
    { d: 'M6 22v-5h12v5z', mode: 'stroke' },
  ]),
  'poi-castle': shapes([
    { d: 'M4 21V6h3v3h3V6h4v3h3V6h3v15z', mode: 'stroke' },
    { d: 'M10 21v-4a2 2 0 0 1 4 0v4', mode: 'stroke' },
  ]),
  'poi-ruins': shapes([
    { d: 'M3 21h18', mode: 'stroke' },
    { d: 'M5 21V11l3-2v4l2-3v11', mode: 'stroke' },
    { d: 'M15 21V8h4v13', mode: 'stroke' },
  ]),
  'poi-attraction': shapes([
    { d: 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z', mode: 'stroke' },
  ]),
  'poi-artwork': shapes([
    { d: 'M12 3a9 9 0 1 0 0 18c1.6 0 2.2-1.1 1.6-2.2s-.1-2.3 1.4-2.3h2a4 4 0 0 0 4-4c0-5-4.5-9.5-9-9.5z', mode: 'stroke' },
    { d: circle(8, 11, 1), mode: 'fill' },
    { d: circle(12, 7.5, 1), mode: 'fill' },
    { d: circle(16, 10, 1), mode: 'fill' },
  ]),
  'poi-museum': shapes([
    { d: 'M3 10l9-6 9 6z', mode: 'stroke' },
    { d: 'M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18', mode: 'stroke' },
  ]),
  'poi-park': shapes([
    { d: circle(12, 9, 6), mode: 'stroke' },
    { d: 'M12 15v7M9 22h6', mode: 'stroke' },
  ]),
  'poi-beach': shapes([
    { d: circle(12, 8, 3), mode: 'stroke' },
    { d: 'M2 15c2-2 4-2 6 0s4 2 6 0 4-2 8 0M2 20c2-2 4-2 6 0s4 2 6 0 4-2 8 0', mode: 'stroke' },
  ]),
  'poi-worship': shapes([
    { d: 'M12 2v5M9.5 4.5h5', mode: 'stroke' },
    { d: 'M6 22V13l6-5 6 5v9z', mode: 'stroke' },
    { d: 'M10 22v-4a2 2 0 0 1 4 0v4', mode: 'stroke' },
  ]),
  'poi-nature': shapes([
    { d: 'M2 20l6.5-12 4.5 7 3-4 6 9z', mode: 'stroke' },
  ]),
  settings: shapes([
    { d: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1', mode: 'stroke' },
    { d: circle(15, 6, 2), mode: 'stroke' },
    { d: circle(9, 12, 2), mode: 'stroke' },
    { d: circle(17, 18, 2), mode: 'stroke' },
  ]),
  back: line('M15 18l-6-6 6-6'),
  navigate: line('M3 11l19-9-9 19-2-8-8-2z'),
  logout: line('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'),
};
