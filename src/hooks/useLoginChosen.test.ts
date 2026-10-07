import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useLoginChosen } from './useLoginChosen';

function clientReturning(result: { data: unknown; error: unknown }) {
  const maybeSingle = jest.fn().mockResolvedValue(result);
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));
  return { client: { from } as unknown as SupabaseClient, from, select, eq };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('useLoginChosen', () => {
  it('is loading first and needed when login_chosen is false', async () => {
    const { client, from, select, eq } = clientReturning({ data: { login_chosen: false }, error: null });
    const { result } = renderHook(() => useLoginChosen(client, 'u1'));
    expect(result.current).toBe('loading');
    await waitFor(() => expect(result.current).toBe('needed'));
    expect(from).toHaveBeenCalledWith('player_profiles');
    expect(select).toHaveBeenCalledWith('login_chosen');
    expect(eq).toHaveBeenCalledWith('user_id', 'u1');
  });

  it('is chosen when login_chosen is true', async () => {
    const { client } = clientReturning({ data: { login_chosen: true }, error: null });
    const { result } = renderHook(() => useLoginChosen(client, 'u1'));
    await waitFor(() => expect(result.current).toBe('chosen'));
  });

  it('is chosen when the person has no profile row', async () => {
    const { client } = clientReturning({ data: null, error: null });
    const { result } = renderHook(() => useLoginChosen(client, 'u1'));
    await waitFor(() => expect(result.current).toBe('chosen'));
  });

  it('is error when the query fails', async () => {
    const { client } = clientReturning({ data: null, error: { message: 'boom' } });
    const { result } = renderHook(() => useLoginChosen(client, 'u1'));
    await waitFor(() => expect(result.current).toBe('error'));
  });

  it('stays loading and asks nothing without a user id', () => {
    const { client, from } = clientReturning({ data: null, error: null });
    const { result } = renderHook(() => useLoginChosen(client, ''));
    expect(result.current).toBe('loading');
    expect(from).not.toHaveBeenCalled();
  });
  it('is chosen at once from the local memory, without asking the server', async () => {
    await AsyncStorage.setItem('login_chosen:u1', '1');
    const { client, from } = clientReturning({ data: { login_chosen: false }, error: null });
    const { result } = renderHook(() => useLoginChosen(client, 'u1'));
    await waitFor(() => expect(result.current).toBe('chosen'));
    expect(from).not.toHaveBeenCalled();
  });

  it('remembers a chosen login once the server confirms it, and never remembers needed', async () => {
    const chosen = clientReturning({ data: { login_chosen: true }, error: null });
    const a = renderHook(() => useLoginChosen(chosen.client, 'u1'));
    await waitFor(() => expect(a.result.current).toBe('chosen'));
    expect(await AsyncStorage.getItem('login_chosen:u1')).toBe('1');

    const needed = clientReturning({ data: { login_chosen: false }, error: null });
    const b = renderHook(() => useLoginChosen(needed.client, 'u2'));
    await waitFor(() => expect(b.result.current).toBe('needed'));
    expect(await AsyncStorage.getItem('login_chosen:u2')).toBeNull();
  });

  it('gives up after 3 seconds when the query hangs: error, and a late answer does not change it', async () => {
    jest.useFakeTimers();
    try {
      let answer!: (v: unknown) => void;
      const maybeSingle = jest.fn().mockReturnValue(new Promise((r) => (answer = r)));
      const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) } as unknown as SupabaseClient;
      const { result } = renderHook(() => useLoginChosen(client, 'u1'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current).toBe('loading');
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(result.current).toBe('error');
      await act(async () => answer({ data: { login_chosen: false }, error: null }));
      expect(result.current).toBe('error');
    } finally {
      jest.useRealTimers();
    }
  });
});
