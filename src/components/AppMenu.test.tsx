import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import AppMenu, { type AppMenuProps } from './AppMenu';

// The icons are drawn with Skia and the fonts come from Expo, native modules Jest cannot load.
jest.mock('./icons/SvgIcon', () => () => null);
jest.mock('../theme/fonts', () => ({ FONT: { display: 'display' } }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const asyncVoid = () => jest.fn().mockResolvedValue(undefined);

function props(): AppMenuProps {
  return {
    fogStyle: 'auto',
    onFogStyleChange: jest.fn(),
    fogAnimated: true,
    onFogAnimatedChange: jest.fn(),
    placeNotifications: true,
    onPlaceNotificationsChange: asyncVoid(),
    weeklySummary: true,
    weatherFog: true,
    onWeatherFogChange: jest.fn(),
    offlineMap: false,
    offlineMapMb: null,
    onOfflineMapChange: asyncVoid(),
    onWeeklySummaryChange: asyncVoid(),
    backgroundEnabled: false,
    onEnableBackground: jest.fn().mockResolvedValue(true),
    onSignOut: asyncVoid(),
    onDeleteAccount: asyncVoid(),
    onOpenBlocked: jest.fn(),
    onOpenCollection: jest.fn(),
    email: 'a@b.co',
    leaderboardVisible: true,
    onLeaderboardVisibleChange: asyncVoid(),
    avatarUri: null,
    displayName: 'Anna',
    onChangeAvatar: jest.fn().mockResolvedValue(null),
    onRemoveAvatar: asyncVoid(),
    onSubmitFeedback: asyncVoid(),
  } as AppMenuProps;
}

const ACCOUNT = /^(Account|Аккаунт)$/;
const PRIVACY = /Privacy Policy|Политика конфиденциальности/;
const TERMS = /Terms of Use|Условия использования/;

describe('AppMenu main page', () => {
  beforeEach(() => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });
  afterEach(() => jest.restoreAllMocks());

  it('lists account, collection, settings, feedback, privacy policy and terms of use, in that order', () => {
    const { getAllByRole } = render(<AppMenu {...props()} />);
    const labels = getAllByRole('button').map((row) => String(row.props.accessibilityLabel));
    const order = [ACCOUNT, /Collection|Коллекция/, /Settings|Настройки/, /Feedback|Обратная связь/, PRIVACY, TERMS];
    const positions = order.map((pattern) => labels.findIndex((label) => pattern.test(label)));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('opens the privacy policy and the terms of use in the browser', () => {
    const { getByLabelText } = render(<AppMenu {...props()} />);
    fireEvent.press(getByLabelText(PRIVACY));
    expect(Linking.openURL).toHaveBeenCalledWith('https://quelerir.github.io/mistwalk-legal/');
    fireEvent.press(getByLabelText(TERMS));
    expect(Linking.openURL).toHaveBeenCalledWith('https://quelerir.github.io/mistwalk-legal/terms.html');
  });

  it('no longer lists them on the account page', () => {
    const { getByLabelText, queryByLabelText } = render(<AppMenu {...props()} />);
    fireEvent.press(getByLabelText(ACCOUNT));
    expect(queryByLabelText(PRIVACY)).toBeNull();
    expect(queryByLabelText(TERMS)).toBeNull();
  });
});
