import { act, renderHook } from '@testing-library/react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useLoginAvailability } from './useLoginAvailability';

function clientAnswering(rpc: jest.Mock) {
  return { rpc } as unknown as SupabaseClient;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useLoginAvailability', () => {
  it('is idle for an empty login and invalid for a badly formed one, without asking the server', () => {
    const rpc = jest.fn();
    const client = clientAnswering(rpc);
    expect(renderHook(() => useLoginAvailability(client, '')).result.current).toBe('idle');
    expect(renderHook(() => useLoginAvailability(client, 'ab')).result.current).toBe('invalid');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('is checking, then free once the server says so', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: true, error: null });
    const client = clientAnswering(rpc);
    const { result } = renderHook(() => useLoginAvailability(client, '@anna_k'));
    expect(result.current).toBe('checking');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(rpc).toHaveBeenCalledWith('login_available', { candidate: 'anna_k' });
    expect(result.current).toBe('free');
  });

  it('is taken when the server says so', async () => {
    const client = clientAnswering(jest.fn().mockResolvedValue({ data: false, error: null }));
    const { result } = renderHook(() => useLoginAvailability(client, 'anna_k'));
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current).toBe('taken');
  });

  it('is error when the call fails (an old server without the function)', async () => {
    const client = clientAnswering(jest.fn().mockResolvedValue({ data: null, error: new Error('nope') }));
    const { result } = renderHook(() => useLoginAvailability(client, 'anna_k'));
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current).toBe('error');
  });

  it('asks once for a burst of typing, and ignores an answer to a login that is no longer typed', async () => {
    let answerFirst: (v: { data: boolean; error: null }) => void = () => {};
    const rpc = jest
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce({ data: false, error: null });
    const client = clientAnswering(rpc);
    const { result, rerender } = renderHook(({ login }: { login: string }) => useLoginAvailability(client, login), {
      initialProps: { login: 'anna' },
    });
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(rpc).toHaveBeenCalledTimes(1);

    rerender({ login: 'anna_k' });
    await act(async () => {
      answerFirst({ data: true, error: null });
    });
    expect(result.current).toBe('checking');

    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current).toBe('taken');
  });
});
