import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LocationIntroPrompt from './LocationIntroPrompt';

// The icons are drawn with Skia and the fonts come from Expo, native modules Jest cannot load.
jest.mock('./icons/SvgIcon', () => () => null);
jest.mock('../theme/fonts', () => ({ FONT: { display: 'display' }, CARD_SHADOW: {} }));

describe('LocationIntroPrompt', () => {
  it('explains why the location is needed, in three points and a title', () => {
    const { getByText, getAllByText } = render(<LocationIntroPrompt visible onContinue={jest.fn()} />);
    expect(getByText(/Для карты нужна геолокация|Location is needed for the map/)).toBeTruthy();
    expect(getAllByText(/туман|fog/i).length).toBeGreaterThan(0);
    expect(getByText(/Друзья видят только то, что вы сами открыли|Friends only see what you have opened yourself/)).toBeTruthy();
  });

  it('the continue button calls onContinue', () => {
    const onContinue = jest.fn();
    const { getByTestId } = render(<LocationIntroPrompt visible onContinue={onContinue} />);
    fireEvent.press(getByTestId('location-intro-continue'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('shows nothing when it is not visible', () => {
    const { queryByTestId } = render(<LocationIntroPrompt visible={false} onContinue={jest.fn()} />);
    expect(queryByTestId('location-intro-continue')).toBeNull();
  });
});
