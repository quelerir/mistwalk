import React from 'react';
import { render } from '@testing-library/react-native';
import TabBar, { type TabItem } from './TabBar';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('./icons/SvgIcon', () => () => null);

const tabs = (over: Partial<TabItem<'a' | 'b'>> = {}): TabItem<'a' | 'b'>[] => [
  { key: 'a', label: 'A', icon: 'map' },
  { key: 'b', label: 'B', icon: 'user', ...over },
];

describe('TabBar dot', () => {
  it('shows a dot only on a tab that asks for it', () => {
    const { getByTestId, queryByTestId } = render(<TabBar tabs={tabs({ dot: true })} active="a" onChange={jest.fn()} />);
    expect(getByTestId('tab-dot-b')).toBeTruthy();
    expect(queryByTestId('tab-dot-a')).toBeNull();
  });

  it('shows nothing without the flag', () => {
    const { queryByTestId } = render(<TabBar tabs={tabs()} active="a" onChange={jest.fn()} />);
    expect(queryByTestId('tab-dot-b')).toBeNull();
  });

  it('shows only the number when a tab has both a badge and a dot', () => {
    const { getByText, queryByTestId } = render(<TabBar tabs={tabs({ badge: 2, dot: true })} active="a" onChange={jest.fn()} />);
    expect(getByText('2')).toBeTruthy();
    expect(queryByTestId('tab-dot-b')).toBeNull();
  });
});
