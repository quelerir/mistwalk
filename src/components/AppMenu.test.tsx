import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import AppMenu, { type AppMenuProps } from './AppMenu';

// The icons are drawn with Skia and the fonts come from Expo, native modules Jest cannot load.
jest.mock('./icons/SvgIcon', () => () => null);
jest.mock('../theme/fonts', () => ({ FONT: { display: 'display' } }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const asyncVoid = () => jest.fn().mockResolvedValue(undefined);

function props(over: Partial<AppMenuProps> = {}): AppMenuProps {
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
    email: 'a@b.co',
    onSubmitFeedback: asyncVoid(),
    ...over,
  } as AppMenuProps;
}

const SETTINGS = /^(Settings|Настройки)$/;
const FEEDBACK = /^(Feedback|Обратная связь)$/;
const RATING = /Visible in the ranking|Виден в рейтинге/;
const BLOCKED = /^(Blocked|Заблокированные)$/;
const PRIVACY = /Privacy Policy|Политика конфиденциальности/;
const TERMS = /Terms of Use|Условия использования/;
const SIGN_OUT = /^(Sign out|Выйти)$/;
const DELETE = /^(Delete account|Удалить аккаунт)$/;
const BACK = /^(Back|Назад)$/;

describe('AppMenu main page', () => {
  beforeEach(() => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });
  afterEach(() => jest.restoreAllMocks());

  it('lists the email, settings, feedback, blocked, privacy, terms, sign out and delete account, in that order', () => {
    const { getAllByLabelText } = render(<AppMenu {...props()} />);
    const onScreen = getAllByLabelText(/./).map((el) => String(el.props.accessibilityLabel));
    const order = [/^a@b\.co$/, SETTINGS, FEEDBACK, BLOCKED, PRIVACY, TERMS, SIGN_OUT, DELETE];
    const found = order.map((pattern) => onScreen.findIndex((label) => pattern.test(label)));
    expect(found.every((i) => i >= 0)).toBe(true);
    expect(found).toEqual([...found].sort((a, b) => a - b));
  });

  it('has no Account and no Collection item', () => {
    const { queryByLabelText } = render(<AppMenu {...props()} />);
    expect(queryByLabelText(/^(Account|Аккаунт)$/)).toBeNull();
    expect(queryByLabelText(/^(Collection|Коллекция)$/)).toBeNull();
  });

  it('opens the privacy policy and the terms of use in the browser', () => {
    const { getByLabelText } = render(<AppMenu {...props()} />);
    fireEvent.press(getByLabelText(PRIVACY));
    expect(Linking.openURL).toHaveBeenCalledWith('https://quelerir.github.io/mistwalk-legal/');
    fireEvent.press(getByLabelText(TERMS));
    expect(Linking.openURL).toHaveBeenCalledWith('https://quelerir.github.io/mistwalk-legal/terms.html');
  });

  it('has no "visible in the ranking" row: everyone is visible there', () => {
    const { queryByLabelText } = render(<AppMenu {...props()} />);
    expect(queryByLabelText(RATING)).toBeNull();
  });

  it('a Back row appears only when onBack is given, and it calls onBack', () => {
    const none = render(<AppMenu {...props()} />);
    expect(none.queryByLabelText(BACK)).toBeNull();
    none.unmount();
    const onBack = jest.fn();
    const { getByLabelText } = render(<AppMenu {...props({ onBack })} />);
    fireEvent.press(getByLabelText(BACK));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('Blocked calls onOpenBlocked', () => {
    const onOpenBlocked = jest.fn();
    const { getByLabelText } = render(<AppMenu {...props({ onOpenBlocked })} />);
    fireEvent.press(getByLabelText(BLOCKED));
    expect(onOpenBlocked).toHaveBeenCalledTimes(1);
  });

  it('shows "No email" when there is no email', () => {
    const { getByLabelText } = render(<AppMenu {...props({ email: '' })} />);
    expect(getByLabelText(/^(No email|Без почты)$/)).toBeTruthy();
  });
});
