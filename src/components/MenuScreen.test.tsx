import React from 'react';
import { Modal, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import MenuScreen, { type MenuItem } from './MenuScreen';

// The icons are drawn with Skia and the fonts come from Expo, native modules Jest cannot load.
jest.mock('./icons/SvgIcon', () => () => null);
jest.mock('../theme/fonts', () => ({ FONT: { display: 'display' } }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const item = (over: Partial<MenuItem> = {}): MenuItem => ({ key: 'a', icon: 'settings', label: 'Settings', onPress: jest.fn(), ...over });

describe('MenuScreen', () => {
  it('is drawn in place, not in a modal sheet', () => {
    const { UNSAFE_queryByType } = render(<MenuScreen items={[item()]} />);
    expect(UNSAFE_queryByType(Modal)).toBeNull();
  });

  it('lists the items and calls onPress of the one tapped', () => {
    const settings = item({ onPress: jest.fn() });
    const account = item({ key: 'b', label: 'Account', onPress: jest.fn() });
    const { getByText } = render(<MenuScreen items={[settings, account]} />);
    fireEvent.press(getByText('Account'));
    expect(account.onPress).toHaveBeenCalledTimes(1);
    expect(settings.onPress).not.toHaveBeenCalled();
  });

  it('shows a switch item as a checked or unchecked switch', () => {
    const { getByLabelText } = render(<MenuScreen items={[item({ label: 'Rain', on: true })]} />);
    const row = getByLabelText('Rain');
    expect(row.props.accessibilityRole).toBe('switch');
    expect(row.props.accessibilityState).toEqual({ checked: true });
  });

  it('shows the group title once where the group starts, and the value and hint of an item', () => {
    const items = [
      item({ key: '1', label: 'One', group: 'Map', value: 'Auto', hint: 'Follows the clock' }),
      item({ key: '2', label: 'Two', group: 'Map' }),
    ];
    const { getAllByText, getByText } = render(<MenuScreen items={items} />);
    expect(getAllByText('Map')).toHaveLength(1);
    expect(getByText('Auto')).toBeTruthy();
    expect(getByText('Follows the clock')).toBeTruthy();
  });

  it('shows the header above and the footer below the list', () => {
    const { getByText } = render(<MenuScreen items={[item()]} header={<Text>head</Text>} footer={<Text>foot</Text>} />);
    expect(getByText('head')).toBeTruthy();
    expect(getByText('foot')).toBeTruthy();
  });

  it('shows the title above the list when there is one, and none otherwise', () => {
    const withTitle = render(<MenuScreen items={[item()]} title="Menu" />);
    expect(withTitle.getByText('Menu')).toBeTruthy();
    const without = render(<MenuScreen items={[item()]} />);
    expect(without.queryByText('Menu')).toBeNull();
  });
});
