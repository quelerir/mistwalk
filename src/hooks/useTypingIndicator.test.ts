import { act, renderHook } from '@testing-library/react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useTypingIndicator } from './useTypingIndicator';
import { openTypingChannel } from '../lib/social/typing';

jest.mock('../lib/social/typing');

const client = {} as SupabaseClient;
let onSignal: (typing: boolean) => void;
const send = jest.fn();
const close = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  send.mockClear();
  close.mockClear();
  (openTypingChannel as jest.Mock).mockReset().mockImplementation((_c, _me, _other, cb) => {
    onSignal = cb;
    return { send, close };
  });
});
afterEach(() => jest.useRealTimers());

const setup = () => renderHook(() => useTypingIndicator(client, 'me', 'other'));

describe('useTypingIndicator', () => {
  it('shows typing on a signal and hides it on stop', () => {
    const { result } = setup();
    expect(result.current.otherTyping).toBe(false);
    act(() => onSignal(true));
    expect(result.current.otherTyping).toBe(true);
    act(() => onSignal(false));
    expect(result.current.otherTyping).toBe(false);
  });

  it('hides typing after 4 s without a new signal, and a new signal restarts the wait', () => {
    const { result } = setup();
    act(() => onSignal(true));
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    act(() => onSignal(true));
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current.otherTyping).toBe(true);
    act(() => {
      jest.advanceTimersByTime(1100);
    });
    expect(result.current.otherTyping).toBe(false);
  });

  it('hides typing when a message from the other user arrives', () => {
    const { result } = setup();
    act(() => onSignal(true));
    act(() => result.current.clearTyping());
    expect(result.current.otherTyping).toBe(false);
  });

  it('sends typing at most once per 2 s while the user keeps typing', () => {
    const { result } = setup();
    act(() => result.current.notifyTyping());
    act(() => result.current.notifyTyping());
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith(true);
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    act(() => result.current.notifyTyping());
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('sends stop once after typing, and nothing when nothing was sent', () => {
    const { result } = setup();
    act(() => result.current.stopTyping());
    expect(send).not.toHaveBeenCalled();
    act(() => result.current.notifyTyping());
    act(() => result.current.stopTyping());
    act(() => result.current.stopTyping());
    expect(send.mock.calls).toEqual([[true], [false]]);
  });

  it('closes the channel on unmount and rejoins for another conversation', () => {
    const { unmount } = setup();
    unmount();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
