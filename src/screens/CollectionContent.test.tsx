import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import CollectionContent from './CollectionContent';
import type { CountryStat } from '../lib/geo/countryStats';

// The fonts come from Expo, a native module Jest cannot load.
jest.mock('../theme/fonts', () => ({ FONT: { display: 'display' }, CARD_SHADOW: {} }));

const country = (code: string, percent: number): CountryStat => ({ code, name: code, exploredKm2: 0, totalKm2: 1, percent });

function setup(over: Partial<React.ComponentProps<typeof CollectionContent>> = {}) {
  const props = {
    stats: { distanceKm: 12.5, discoveredCount: 7 },
    week: { km: 3.2, places: 2, days: 4, prev: { km: 1, places: 1, days: 2 } },
    daily: [0, 1, 0, 2, 0, 0, 3],
    countries: [country('FR', 0), country('DE', 12)],
    onOpenCountries: jest.fn(),
    onOpenLeaderboard: jest.fn(),
    ...over,
  };
  return { props, ...render(<CollectionContent {...props} />) };
}

describe('CollectionContent', () => {
  it('shows the distance and the places found', () => {
    const { getByText } = setup();
    expect(getByText(/12\.5/)).toBeTruthy();
    expect(getByText('7')).toBeTruthy();
  });

  it('shows the week numbers', () => {
    const { getByText } = setup();
    expect(getByText('3.2')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
    expect(getByText('4')).toBeTruthy();
  });

  it('counts only countries with a percent above zero in the Countries card', () => {
    const { getByText } = setup();
    expect(getByText(/^(1 of 2 visited|Открыто 1 из 2)$/)).toBeTruthy();
  });

  it('pressing the Countries card calls onOpenCountries', () => {
    const { getByText, props } = setup();
    fireEvent.press(getByText(/^(Countries|Страны)$/));
    expect(props.onOpenCountries).toHaveBeenCalledTimes(1);
  });

  it('pressing the Rating card calls onOpenLeaderboard', () => {
    const { getByText, props } = setup();
    fireEvent.press(getByText(/Player ranking|Рейтинг игроков/));
    expect(props.onOpenLeaderboard).toHaveBeenCalledTimes(1);
  });
});
