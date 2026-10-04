import type { SupabaseClient } from '@supabase/supabase-js';
import { openTypingChannel, typingTopic } from './typing';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

function fakeClient() {
  const handlers: Array<(msg: { payload: unknown }) => void> = [];
  const channel: any = {
    on: jest.fn((_type: string, _filter: unknown, cb: (msg: { payload: unknown }) => void) => {
      handlers.push(cb);
      return channel;
    }),
    subscribe: jest.fn(() => channel),
    send: jest.fn().mockResolvedValue('ok'),
  };
  const client = { channel: jest.fn(() => channel), removeChannel: jest.fn() } as unknown as SupabaseClient;
  return { client, channel, emit: (payload: unknown) => handlers.forEach((h) => h({ payload })) };
}

describe('typingTopic', () => {
  it('is the same for both users of a pair, ids sorted', () => {
    expect(typingTopic(B, A)).toBe(`typing:${A}:${B}`);
    expect(typingTopic(A, B)).toBe(`typing:${A}:${B}`);
  });
});

describe('openTypingChannel', () => {
  it('joins a private channel named after the pair', () => {
    const { client } = fakeClient();
    openTypingChannel(client, A, B, jest.fn());
    expect(client.channel).toHaveBeenCalledWith(`typing:${A}:${B}`, {
      config: { private: true, broadcast: { self: false } },
    });
  });

  it('reports the other user typing and stopping, and ignores everyone else and malformed payloads', () => {
    const { client, emit } = fakeClient();
    const onSignal = jest.fn();
    openTypingChannel(client, A, B, onSignal);
    emit({ typing: true, from: B });
    emit({ typing: false, from: B });
    emit({ typing: true, from: A });
    emit({ typing: true, from: '33333333-3333-3333-3333-333333333333' });
    emit({ typing: 'yes', from: B });
    emit(null);
    expect(onSignal.mock.calls).toEqual([[true], [false]]);
  });

  it('sends a broadcast signal and removes the channel on close', () => {
    const { client, channel } = fakeClient();
    const handle = openTypingChannel(client, A, B, jest.fn());
    handle.send(true);
    expect(channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'typing', payload: { typing: true, from: A } });
    handle.close();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('does not throw when sending fails', async () => {
    const { client, channel } = fakeClient();
    channel.send.mockRejectedValue(new Error('offline'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    openTypingChannel(client, A, B, jest.fn()).send(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
