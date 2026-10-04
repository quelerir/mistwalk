import React from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import ProfileScreen, { type ProfileScreenProps } from './ProfileScreen';

// The icons are drawn with Skia and the fonts come from Expo, native modules Jest cannot load.
jest.mock('../components/icons/SvgIcon', () => () => null);
jest.mock('../theme/fonts', () => ({ FONT: { display: 'display' }, CARD_SHADOW: {} }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

function setup(over: Partial<ProfileScreenProps> = {}) {
  const props: ProfileScreenProps = {
    displayName: 'anna_k',
    avatarUri: null,
    stats: { distanceKm: 12.5, discoveredCount: 7 },
    week: { km: 3.2, places: 2, days: 4, prev: { km: 1, places: 1, days: 2 } },
    daily: [0, 1, 0, 2, 0, 0, 3],
    countries: [],
    followCounts: { followers: 3, following: 5 },
    onOpenCountries: jest.fn(),
    onOpenLeaderboard: jest.fn(),
    onOpenFollows: jest.fn(),
    onChangeAvatar: jest.fn().mockResolvedValue(null),
    onRemoveAvatar: jest.fn().mockResolvedValue(undefined),
    renderMenu: (close) => (
      <Pressable testID="menu-close" onPress={close}>
        <Text>menu page</Text>
      </Pressable>
    ),
    ...over,
  };
  return { props, ...render(<ProfileScreen {...props} />) };
}

// The buttons of the last Alert.alert call, by their text.
function alertButtons() {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  return calls[calls.length - 1][2] as Array<{ text: string; onPress?: () => void }>;
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('shows the name and both counters', () => {
    const { getByText } = setup();
    expect(getByText('anna_k')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
    expect(getByText('5')).toBeTruthy();
  });

  it('shows a dash for each counter while the counts are unknown', () => {
    const { getAllByText } = setup({ followCounts: null });
    expect(getAllByText('–')).toHaveLength(2);
  });

  it('pressing a counter calls onOpenFollows with its tab', () => {
    const { getByTestId, props } = setup();
    fireEvent.press(getByTestId('profile-followers'));
    expect(props.onOpenFollows).toHaveBeenLastCalledWith('followers');
    fireEvent.press(getByTestId('profile-following'));
    expect(props.onOpenFollows).toHaveBeenLastCalledWith('following');
  });

  it('the burger shows the menu page and its close returns to the profile', () => {
    const { getByTestId, queryByText, getByText } = setup();
    expect(queryByText('menu page')).toBeNull();
    fireEvent.press(getByTestId('profile-burger'));
    expect(getByText('menu page')).toBeTruthy();
    expect(queryByText('anna_k')).toBeNull();
    fireEvent.press(getByTestId('menu-close'));
    expect(queryByText('menu page')).toBeNull();
    expect(getByText('anna_k')).toBeTruthy();
  });

  it('pressing the avatar offers choose and cancel without a photo', () => {
    const { getByTestId } = setup();
    fireEvent.press(getByTestId('profile-avatar'));
    expect(alertButtons().map((b) => b.text)).toEqual([
      expect.stringMatching(/Choose photo|Выбрать фото/),
      expect.stringMatching(/Cancel|Отмена/),
    ]);
  });

  it('pressing the avatar also offers remove when there is a photo', () => {
    const { getByTestId } = setup({ avatarUri: 'https://example.com/a.png' });
    fireEvent.press(getByTestId('profile-avatar'));
    expect(alertButtons().map((b) => b.text)).toEqual([
      expect.stringMatching(/Choose photo|Выбрать фото/),
      expect.stringMatching(/Remove photo|Удалить фото/),
      expect.stringMatching(/Cancel|Отмена/),
    ]);
  });

  it('choosing a photo calls onChangeAvatar and shows the message it returns', async () => {
    const onChangeAvatar = jest.fn().mockResolvedValue('Photo updated');
    const { getByTestId, findByText } = setup({ onChangeAvatar });
    fireEvent.press(getByTestId('profile-avatar'));
    await act(async () => alertButtons()[0].onPress?.());
    expect(onChangeAvatar).toHaveBeenCalledTimes(1);
    expect(await findByText('Photo updated')).toBeTruthy();
  });

  it('removing the photo calls onRemoveAvatar, and a failure shows the removal-failed message', async () => {
    const onRemoveAvatar = jest.fn().mockRejectedValue(new Error('x'));
    const { getByTestId, findByText } = setup({ avatarUri: 'https://example.com/a.png', onRemoveAvatar });
    fireEvent.press(getByTestId('profile-avatar'));
    await act(async () => alertButtons()[1].onPress?.());
    expect(onRemoveAvatar).toHaveBeenCalledTimes(1);
    expect(await findByText(/Could not remove the photo|Не удалось удалить фото/)).toBeTruthy();
  });

  it('renders with an empty name', () => {
    const { getByTestId } = setup({ displayName: '' });
    expect(getByTestId('profile-avatar')).toBeTruthy();
  });

  it('keeps the collection under the header', async () => {
    const { getByText, props } = setup();
    fireEvent.press(getByText(/^(Countries|Страны)$/));
    await waitFor(() => expect(props.onOpenCountries).toHaveBeenCalledTimes(1));
  });
});
