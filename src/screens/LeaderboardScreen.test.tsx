import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import LeaderboardScreen from './LeaderboardScreen';
import { fetchLeaderboard, searchPlayers } from '../lib/social/profiles';

jest.mock('../theme/fonts', () => ({ FONT: { display: 'display' }, CARD_SHADOW: {} }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../lib/social/profiles', () => ({
  ...jest.requireActual('../lib/social/profiles'),
  fetchLeaderboard: jest.fn(),
  searchPlayers: jest.fn(),
  avatarUrl: () => null,
}));

const client = {} as SupabaseClient;
const board = [{ userId: 'u1', displayName: 'boris', avatarPath: null, foundCount: 9, rank: 1 }];
const found = [{ userId: 'u2', displayName: 'anna_k', avatarPath: null, iFollow: true }];

function setup() {
  const onOpenPlayer = jest.fn();
  const utils = render(<LeaderboardScreen client={client} userId="me" onBack={jest.fn()} onOpenPlayer={onOpenPlayer} />);
  return { onOpenPlayer, ...utils };
}

describe('LeaderboardScreen search', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (fetchLeaderboard as jest.Mock).mockResolvedValue(board);
    (searchPlayers as jest.Mock).mockReset().mockResolvedValue(found);
  });
  afterEach(() => jest.useRealTimers());

  it('shows the ranking until something is typed', async () => {
    const { findByText } = setup();
    expect(await findByText('boris')).toBeTruthy();
    expect(searchPlayers).not.toHaveBeenCalled();
  });

  it('searches after a pause, shows the result and opens the player', async () => {
    const { findByText, getByTestId, queryByText, onOpenPlayer } = setup();
    await findByText('boris');
    fireEvent.changeText(getByTestId('search-input'), 'ann');
    expect(searchPlayers).not.toHaveBeenCalled(); // debounced
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(searchPlayers).toHaveBeenCalledWith(client, 'ann');
    fireEvent.press(await findByText('anna_k'));
    expect(queryByText('boris')).toBeNull();
    expect(onOpenPlayer).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u2', displayName: 'anna_k' }));
  });

  it('does not search for a single character and keeps the ranking', async () => {
    const { findByText, getByTestId } = setup();
    await findByText('boris');
    fireEvent.changeText(getByTestId('search-input'), 'a');
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(searchPlayers).not.toHaveBeenCalled();
    expect(await findByText('boris')).toBeTruthy();
  });

  it('says so when nobody is found', async () => {
    (searchPlayers as jest.Mock).mockResolvedValue([]);
    const { findByText, getByTestId } = setup();
    await findByText('boris');
    fireEvent.changeText(getByTestId('search-input'), 'zz');
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(await findByText(/Никого не найдено|Nobody found/)).toBeTruthy();
  });

  it('ignores a stale response that arrives after a newer query', async () => {
    let resolveFirst: (v: typeof found) => void = () => undefined;
    (searchPlayers as jest.Mock)
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce([{ userId: 'u3', displayName: 'ann_new', avatarPath: null, iFollow: false }]);
    const { findByText, getByTestId, queryByText } = setup();
    await findByText('boris');
    fireEvent.changeText(getByTestId('search-input'), 'an');
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    fireEvent.changeText(getByTestId('search-input'), 'ann');
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(await findByText('ann_new')).toBeTruthy();
    await act(async () => resolveFirst(found));
    await waitFor(() => expect(queryByText('anna_k')).toBeNull());
  });
});
