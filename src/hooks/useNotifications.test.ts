import { AppState } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useNotifications } from './useNotifications';
import { fetchUnreadNotificationCount, subscribeToNotifications } from '../lib/social/notifications';

jest.mock('../lib/social/notifications');

const client = { removeChannel: jest.fn() } as unknown as SupabaseClient;
let onInsert: () => void = () => undefined;
let onAppState: (state: string) => void = () => undefined;
const removeListener = jest.fn();
const channel = { id: 'channel' };

beforeEach(() => {
  (client.removeChannel as jest.Mock).mockClear();
  removeListener.mockClear();
  (fetchUnreadNotificationCount as jest.Mock).mockReset().mockResolvedValue(1);
  (subscribeToNotifications as jest.Mock).mockReset().mockImplementation((_c, _id, cb) => {
    onInsert = cb;
    return channel;
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, cb: (s: string) => void) => {
    onAppState = cb;
    return { remove: removeListener };
  }) as never);
});
afterEach(() => jest.restoreAllMocks());

const setup = () => renderHook(() => useNotifications(client, 'me'));

describe('useNotifications', () => {
  it('starts at 0 and then shows the count from the server', async () => {
    const { result } = setup();
    expect(result.current.unread).toBe(0);
    await waitFor(() => expect(result.current.unread).toBe(1));
  });

  it('asks the server again on a Realtime insert instead of adding 1 blindly', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.unread).toBe(1));
    // the new notification is from a blocked actor: the server still says 1
    await act(async () => onInsert());
    expect(fetchUnreadNotificationCount).toHaveBeenCalledTimes(2);
    expect(result.current.unread).toBe(1);
    (fetchUnreadNotificationCount as jest.Mock).mockResolvedValue(2);
    await act(async () => onInsert());
    expect(result.current.unread).toBe(2);
  });

  it('refreshes when the app comes back to the foreground, not when it leaves', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.unread).toBe(1));
    (fetchUnreadNotificationCount as jest.Mock).mockResolvedValue(4);
    await act(async () => onAppState('background'));
    expect(fetchUnreadNotificationCount).toHaveBeenCalledTimes(1);
    await act(async () => onAppState('active'));
    expect(result.current.unread).toBe(4);
  });

  it('clearUnread sets 0 without asking the server', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.unread).toBe(1));
    act(() => result.current.clearUnread());
    expect(result.current.unread).toBe(0);
    expect(fetchUnreadNotificationCount).toHaveBeenCalledTimes(1);
  });

  it('keeps the last count when the server fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result } = setup();
    await waitFor(() => expect(result.current.unread).toBe(1));
    (fetchUnreadNotificationCount as jest.Mock).mockRejectedValue(new Error('offline'));
    await act(async () => onInsert());
    expect(result.current.unread).toBe(1);
    expect(warn).toHaveBeenCalled();
  });

  it('removes the channel and the app-state listener on unmount', async () => {
    const { unmount } = setup();
    await waitFor(() => expect(fetchUnreadNotificationCount).toHaveBeenCalled());
    unmount();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
    expect(removeListener).toHaveBeenCalled();
  });
});
