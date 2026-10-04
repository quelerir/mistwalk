import React, { useState } from 'react';
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

// The mode lives in the parent (MainScreen), so it survives opening a country and coming back.
const republic = (code: string, name: string, percent = 0): CountryStat => ({ code, name, exploredKm2: 0, totalKm2: 8000, percent });

function Host({
  onOpenCountry,
  initialMode = 'list',
  republics = [],
}: {
  onOpenCountry: (c: CountryStat) => void;
  initialMode?: 'list' | 'map';
  republics?: CountryStat[];
}) {
  const [mode, setMode] = useState<'list' | 'map'>(initialMode);
  return (
    <CountriesScreen
      countries={countries}
      republics={republics}
      pending={false}
      failed={false}
      placesByCountry={new Map()}
      mode={mode}
      onModeChange={setMode}
      onBack={jest.fn()}
      onOpenCountry={onOpenCountry}
    />
  );
}

function setup(initialMode: 'list' | 'map' = 'list', republics: CountryStat[] = []) {
  const onOpenCountry = jest.fn();
  const utils = render(<Host onOpenCountry={onOpenCountry} initialMode={initialMode} republics={republics} />);
  return { onOpenCountry, ...utils };
}

describe('CountriesScreen list / map switch', () => {
  it('shows the map when the parent says so and reports a tab press to the parent', () => {
    const onModeChange = jest.fn();
    const { getByTestId, getByRole } = render(
      <CountriesScreen
        countries={countries}
        republics={[]}
        pending={false}
        failed={false}
        placesByCountry={new Map()}
        mode="map"
        onModeChange={onModeChange}
        onBack={jest.fn()}
        onOpenCountry={jest.fn()}
      />
    );
    expect(getByTestId('world-map')).toBeTruthy();
    fireEvent.press(getByRole('tab', { name: /Список|List/ }));
    expect(onModeChange).toHaveBeenCalledWith('list');
  });

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

describe('CountriesScreen republics', () => {
  const republics = [republic('XA', 'Абхазия', 1), republic('XS', 'Южная Осетия')];

  it('shows a Republics header and one row per republic after the countries', () => {
    const { getByText } = setup('list', republics);
    expect(getByText(/Республики|Republics/)).toBeTruthy();
    expect(getByText('Абхазия')).toBeTruthy();
    expect(getByText('Южная Осетия')).toBeTruthy();
  });

  it('puts the Republics header after the last country and before the first republic', () => {
    const { getAllByText } = setup('list', republics);
    // The rendered texts, in screen order (not toJSON: it also carries the list's data prop).
    const order = getAllByText(/Франция|Республики|Republics|Абхазия/).map((node) => String(node.props.children));
    expect(order[0]).toBe('Франция');
    expect(order[1]).toMatch(/Республики|Republics/);
    expect(order[2]).toBe('Абхазия');
  });

  it('opens the republic like a country', () => {
    const { getByText, onOpenCountry } = setup('list', republics);
    fireEvent.press(getByText('Абхазия'));
    expect(onOpenCountry).toHaveBeenCalledWith(republics[0]);
  });

  it('does not count republics in the "opened countries" line', () => {
    const { getByText } = setup('list', republics);
    expect(getByText(/Открыто стран: 1 из 2|Countries explored: 1 of 2/)).toBeTruthy();
  });

  it('shows no header without republics', () => {
    const { queryByText } = setup('list', []);
    expect(queryByText(/Республики|Republics/)).toBeNull();
  });
});
