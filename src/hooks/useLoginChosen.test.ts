import { renderHook, waitFor } from '@testing-library/react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useLoginChosen } from './useLoginChosen';

function clientReturning(result: { data: unknown; error: unknown }) {
  const maybeSingle = jest.fn().mockResolvedValue(result);
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));
  return { client: { from } as unknown as SupabaseClient, from, select, eq };
}

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
});
