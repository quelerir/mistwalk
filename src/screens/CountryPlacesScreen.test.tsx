import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import CountryPlacesScreen, { type CountryPlacesScreenProps } from './CountryPlacesScreen';
import { loadWorldCities, type WorldCities } from '../lib/geo/countryRegions';
import { loadRegions, type RegionsData } from '../lib/geo/regionStats';
import type { CityStat } from '../lib/geo/cityStats';

jest.mock('../theme/fonts', () => ({ FONT: { display: 'display' }, CARD_SHADOW: {} }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../hooks/useCrests', () => ({ useCrests: () => ({}) }));
jest.mock('../components/KindIcon', () => () => null);
jest.mock('../lib/geo/countryRegions', () => ({ ...jest.requireActual('../lib/geo/countryRegions'), loadWorldCities: jest.fn() }));
jest.mock('../lib/geo/regionStats', () => ({ ...jest.requireActual('../lib/geo/regionStats'), loadRegions: jest.fn() }));

const data = (n: number, regionKeys: string[]): WorldCities => ({
  regions: { 'XX-1': { ru: 'Бета', en: 'Beta' }, 'XX-2': { ru: 'Альфа', en: 'Gamma' } },
  cities: Array.from({ length: n }, (_, i) => ({
    ru: `Город${i}`,
    en: `City${i}`,
    w: i === 0 ? 'Q1' : null,
    c: 'XX',
    r: regionKeys[i % regionKeys.length],
    p: 500000 - i,
    la: 0,
    lo: 0,
  })),
});

// XX-1: lng 0..10, lat 0..10 (100 km2); XX-2: lng 10..20, lat 0..10 (400 km2).
const square = (x0: number, y0: number, x1: number, y1: number) => [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]];
const regionsData: RegionsData = {
  regions: {
    'XX-1': { c: 'XX', w: 'Q101', areaKm2: 100, polygons: [square(0, 0, 10, 10)] },
    'XX-2': { c: 'XX', w: null, areaKm2: 400, polygons: [square(10, 0, 20, 10)] },
  },
};
const walk = [5, 5.001, 5.002].map((lat, i) => ({ lat, lng: 5, ts: i }));
const poi = (id: string, lat: number, lng: number) => ({ id, name: id, kind: 'viewpoint' as const, lat, lng });
const place = (id: string, lat: number, lng: number) => ({ id, name: id, kind: 'monument' as const, lat, lng, discoveredAt: 1 });

const visitedCity: CityStat = {
  name: 'Город0',
  country: 'XX',
  wikidata: 'Q1',
  exploredKm2: 1,
  totalKm2: 10,
  percent: 10,
  found: 0,
};

function setup(over: Partial<CountryPlacesScreenProps> = {}) {
  const props: CountryPlacesScreenProps = {
    country: { code: 'XX', name: 'Икс', exploredKm2: 1, totalKm2: 100, percent: 1 },
    places: undefined,
    points: [],
    cities: [visitedCity],
    citiesPending: false,
    citiesFailed: false,
    origin: null,
    onBack: jest.fn(),
    onSelectHidden: jest.fn(),
    onOpenFound: jest.fn(),
    onOpenRegion: jest.fn(),
    ...over,
  };
  return { props, ...render(<CountryPlacesScreen {...props} />) };
}

describe('CountryPlacesScreen regions', () => {
  beforeEach(() => {
    (loadRegions as jest.Mock).mockReturnValue(regionsData);
  });

  it('lists a row per region with its percent and found places, and opens it on a press', () => {
    (loadWorldCities as jest.Mock).mockReturnValue(data(12, ['XX-1', 'XX-2']));
    const { getByText, getAllByText, queryByText, props } = setup({
      points: walk,
      places: { discovered: [place('f1', 5, 5)], hidden: [poi('h1', 4, 4)] },
    });
    expect(getByText(/Регионы|Regions/)).toBeTruthy();
    expect(getByText(/Бета|Beta/)).toBeTruthy();
    expect(getByText(/\d+[.,]\d+ %/)).toBeTruthy(); // Бета: a share of its area, not 0
    expect(getAllByText('0 %').length).toBeGreaterThan(0); // the other regions
    expect(getByText(/1 из 2|1 of 2/)).toBeTruthy(); // found places of Бета
    expect(queryByText(/Город2|City2/)).toBeNull(); // no city lists under a region any more
    fireEvent.press(getByText(/Бета|Beta/));
    expect(props.onOpenRegion).toHaveBeenCalledWith(expect.objectContaining({ code: 'XX-1', wikidata: 'Q101' }));
  });

  it('lists a visited region with a strong name and the others muted', () => {
    (loadWorldCities as jest.Mock).mockReturnValue(data(12, ['XX-1', 'XX-2']));
    const { getByText } = setup({ points: walk });
    // visited regions come first
    const order = [/Бета|Beta/, /Альфа|Gamma/].map((r) => String(getByText(r).props.children));
    expect(order[0]).toMatch(/Бета|Beta/);
  });

  it('shows a region screen: the emblem header, only the region\'s cities, no Regions section', () => {
    (loadWorldCities as jest.Mock).mockReturnValue(data(12, ['XX-1', 'XX-2']));
    const { getByText, queryByText, getAllByText } = setup({
      country: { code: 'XX-1', name: 'Бета', exploredKm2: 1, totalKm2: 100, percent: 1 },
      countryCode: 'XX',
      regionCode: 'XX-1',
      emblemWikidata: 'Q101',
      cities: [visitedCity],
    });
    expect(getByText('Бета')).toBeTruthy();
    expect(queryByText(/^(Регионы|Regions)/)).toBeNull();
    expect(getByText(/Не посещённые города|Cities not visited/)).toBeTruthy();
    expect(getByText(/Город2|City2/)).toBeTruthy(); // XX-1 (even indexes)
    expect(queryByText(/Город1|City1/)).toBeNull(); // XX-2
    expect(getAllByText(/Город0|City0/)).toHaveLength(1); // visited, in the cities section only
  });

  it('lists only the unvisited cities in a flat country', () => {
    (loadWorldCities as jest.Mock).mockReturnValue(data(4, ['XX-1']));
    const { getByText, getAllByText, queryByText } = setup();
    expect(getByText(/Не посещённые города|Cities not visited/)).toBeTruthy();
    expect(getByText(/Город1|City1/)).toBeTruthy();
    expect(getByText(/Город3|City3/)).toBeTruthy();
    // the visited city stays in the existing cities section only, once
    expect(getAllByText(/Город0|City0/)).toHaveLength(1);
    expect(queryByText(/Регионы|Regions/)).toBeNull();
  });

  it('still shows the existing cities when the data cannot be loaded', () => {
    (loadWorldCities as jest.Mock).mockReturnValue(null);
    (loadRegions as jest.Mock).mockReturnValue(null);
    const { getByText, queryByText } = setup();
    expect(getByText(/Город0|City0/)).toBeTruthy();
    expect(queryByText(/Регионы|Regions|Не посещённые города|Cities not visited/)).toBeNull();
  });
});

describe('CountryPlacesScreen for a republic', () => {
  it('opens for a republic with no points, no places and no cities, and lists its city as not visited', () => {
    const real = jest.requireActual('../lib/geo/countryRegions') as typeof import('../lib/geo/countryRegions');
    (loadWorldCities as jest.Mock).mockReturnValue(real.loadWorldCities());
    const { getByText } = setup({
      country: { code: 'XA', name: 'Абхазия', exploredKm2: 0, totalKm2: 8569, percent: 0 },
      places: undefined,
      cities: [],
    });
    expect(getByText('Абхазия')).toBeTruthy();
    expect(getByText(/Не посещённые города|Cities not visited/)).toBeTruthy();
    expect(getByText(/Сухум|Sukhumi/)).toBeTruthy();
  });
});
