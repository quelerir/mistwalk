import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import CountryPlacesScreen, { type CountryPlacesScreenProps } from './CountryPlacesScreen';
import { loadWorldCities, type WorldCities } from '../lib/geo/countryRegions';
import type { CityStat } from '../lib/geo/cityStats';

jest.mock('../theme/fonts', () => ({ FONT: { display: 'display' }, CARD_SHADOW: {} }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../hooks/useCrests', () => ({ useCrests: () => ({}) }));
jest.mock('../components/KindIcon', () => () => null);
jest.mock('../lib/geo/countryRegions', () => ({ ...jest.requireActual('../lib/geo/countryRegions'), loadWorldCities: jest.fn() }));

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
    cities: [visitedCity],
    citiesPending: false,
    citiesFailed: false,
    origin: null,
    onBack: jest.fn(),
    onSelectHidden: jest.fn(),
    onOpenFound: jest.fn(),
    ...over,
  };
  return render(<CountryPlacesScreen {...props} />);
}

describe('CountryPlacesScreen regions', () => {
  it('lists regions collapsed, with progress, and expands one on a press', () => {
    (loadWorldCities as jest.Mock).mockReturnValue(data(12, ['XX-1', 'XX-2']));
    const { getByText, queryByText, getByTestId, queryByTestId } = setup();
    expect(getByText(/Регионы|Regions/)).toBeTruthy();
    expect(getByText(/Бета|Beta/)).toBeTruthy();
    expect(getByText(/1 из 6 городов|1 of 6 cities/)).toBeTruthy();
    expect(queryByText(/Город2|City2/)).toBeNull();
    fireEvent.press(getByText(/Бета|Beta/));
    expect(getByText(/Город2|City2/)).toBeTruthy();
    expect(getByTestId('city-visited-XX:City0')).toBeTruthy();
    expect(queryByTestId('city-visited-XX:City2')).toBeNull();
    fireEvent.press(getByText(/Бета|Beta/));
    expect(queryByText(/Город2|City2/)).toBeNull();
  });

  it('says "1 city", not "1 cities", for a region with a single city', () => {
    const odd = data(11, ['XX-1']);
    odd.cities[10].r = 'XX-2';
    (loadWorldCities as jest.Mock).mockReturnValue(odd);
    const { getByText } = setup({ cities: [] });
    expect(getByText(/0 из 1 города|0 of 1 city/)).toBeTruthy();
    expect(getByText(/0 из 10 городов|0 of 10 cities/)).toBeTruthy();
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
