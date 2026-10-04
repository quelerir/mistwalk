import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import NotificationsScreen from './NotificationsScreen';
import { fetchNotifications, markNotificationsRead, type AppNotification } from '../lib/social/notifications';

jest.mock('../theme/fonts', () => ({ FONT: { display: 'display' }, CARD_SHADOW: {} }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../lib/social/notifications');
jest.mock('../lib/social/profiles', () => ({ ...jest.requireActual('../lib/social/profiles'), avatarUrl: () => null }));

const client = {} as SupabaseClient;
const note = (over: Partial<AppNotification> = {}): AppNotification => ({
  id: 'n1',
  type: 'follow',
  actorId: 'u2',
  displayName: 'Аня',
  avatarPath: null,
  iFollow: false,
  createdAt: Date.now() - 5 * 60 * 1000,
  readAt: null,
  ...over,
});

async function setup(list: AppNotification[] | Error) {
  (fetchNotifications as jest.Mock).mockReset();
  if (list instanceof Error) (fetchNotifications as jest.Mock).mockRejectedValue(list);
  else (fetchNotifications as jest.Mock).mockResolvedValue(list);
  (markNotificationsRead as jest.Mock).mockReset().mockResolvedValue(undefined);
  const onOpenPlayer = jest.fn();
  const onRead = jest.fn();
  const utils = render(<NotificationsScreen client={client} onBack={jest.fn()} onOpenPlayer={onOpenPlayer} onRead={onRead} />);
  await act(async () => undefined);
  return { onOpenPlayer, onRead, ...utils };
}

describe('NotificationsScreen', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('shows who followed and how long ago', async () => {
    const { getByText } = await setup([note()]);
    expect(getByText(/Новый подписчик: Аня|Аня started following you/)).toBeTruthy();
    expect(getByText(/5 мин назад|5 min ago/)).toBeTruthy();
  });

  it('marks unread rows, and keeps them marked after the list is marked read on the server', async () => {
    const { getByTestId, queryByTestId, onRead } = await setup([note(), note({ id: 'n2', readAt: 1 })]);
    // only the rows that were shown as unread are marked, by id: one that arrives meanwhile stays unread
    expect(markNotificationsRead).toHaveBeenCalledTimes(1);
    expect(markNotificationsRead).toHaveBeenCalledWith(client, ['n1']);
    expect(onRead).toHaveBeenCalledTimes(1);
    expect(getByTestId('notification-unread-n1')).toBeTruthy();
    expect(queryByTestId('notification-unread-n2')).toBeNull();
  });

  it('opens the player when a row is pressed', async () => {
    const { getByText, onOpenPlayer } = await setup([note()]);
    fireEvent.press(getByText(/Новый подписчик: Аня|Аня started following you/));
    expect(onOpenPlayer).toHaveBeenCalledWith({ userId: 'u2', displayName: 'Аня' });
  });

  it('does not call the server when there is nothing unread to mark', async () => {
    const { onRead } = await setup([note({ readAt: 1 })]);
    expect(markNotificationsRead).not.toHaveBeenCalled();
    expect(onRead).not.toHaveBeenCalled();
  });

  it('shows the empty state', async () => {
    const { getByText } = await setup([]);
    expect(getByText(/Пока ничего нет|Nothing here yet/)).toBeTruthy();
  });

  it('shows an error and does not mark anything read when the list fails', async () => {
    const { getByText, onRead } = await setup(new Error('offline'));
    expect(getByText(/Не удалось загрузить|Could not load/)).toBeTruthy();
    expect(markNotificationsRead).not.toHaveBeenCalled();
    expect(onRead).not.toHaveBeenCalled();
  });

  it('does not clear the badge when marking read fails', async () => {
    (markNotificationsRead as jest.Mock).mockReset();
    (fetchNotifications as jest.Mock).mockReset().mockResolvedValue([note()]);
    (markNotificationsRead as jest.Mock).mockRejectedValue(new Error('offline'));
    const onRead = jest.fn();
    render(<NotificationsScreen client={client} onBack={jest.fn()} onOpenPlayer={jest.fn()} onRead={onRead} />);
    await act(async () => undefined);
    expect(onRead).not.toHaveBeenCalled();
  });
});
