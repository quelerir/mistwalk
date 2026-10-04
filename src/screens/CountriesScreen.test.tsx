import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import CountriesScreen from './CountriesScreen';
import type { CountryStat } from '../lib/geo/countryStats';

jest.mock('../theme/fonts', () => ({ FONT: { display: 'display' }, CARD_SHADOW: {} }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
// The real map is native; a stand-in with a button that "taps" the first country.
jest.mock('../components/WorldMapView', () => {
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ countries, onOpenCountry }: any) => (
      <Pressable testID="world-map" onPress={() => onOpenCountry(countries[0])}>
        <Text>map stub</Text>
      </Pressable>
    ),
  };
});

const stat = (code: string, name: string, percent: number): CountryStat => ({ code, name, exploredKm2: 0, totalKm2: 1, percent });
const countries = [stat('AT', 'Австрия', 2), stat('FR', 'Франция', 0)];

function setup() {
  const onOpenCountry = jest.fn();
  const utils = render(
    <CountriesScreen
      countries={countries}
      pending={false}
      failed={false}
      placesByCountry={new Map()}
      onBack={jest.fn()}
      onOpenCountry={onOpenCountry}
    />
  );
  return { onOpenCountry, ...utils };
}

describe('CountriesScreen list / map switch', () => {
  it('starts on the list', () => {
    const { getByText, queryByTestId } = setup();
    expect(getByText('Австрия')).toBeTruthy();
    expect(queryByTestId('world-map')).toBeNull();
  });

  it('shows the map and hides the list after pressing the map tab', () => {
    const { getByRole, getByTestId, queryByText } = setup();
    fireEvent.press(getByRole('tab', { name: /Карта|Map/ }));
    expect(getByTestId('world-map')).toBeTruthy();
    expect(queryByText('Австрия')).toBeNull();
  });

  it('opens a country from the map like from the list', () => {
    const { getByRole, getByTestId, onOpenCountry } = setup();
    fireEvent.press(getByRole('tab', { name: /Карта|Map/ }));
    fireEvent.press(getByTestId('world-map'));
    expect(onOpenCountry).toHaveBeenCalledWith(countries[0]);
  });

  it('returns to the list and keeps the status line in both modes', () => {
    const { getByRole, getByText, queryByTestId } = setup();
    const status = /Открыто стран: 1 из 2|Countries explored: 1 of 2/;
    expect(getByText(status)).toBeTruthy();
    fireEvent.press(getByRole('tab', { name: /Карта|Map/ }));
    expect(getByText(status)).toBeTruthy();
    fireEvent.press(getByRole('tab', { name: /Список|List/ }));
    expect(getByText('Австрия')).toBeTruthy();
    expect(queryByTestId('world-map')).toBeNull();
  });
});
