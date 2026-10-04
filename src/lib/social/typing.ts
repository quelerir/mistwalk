import type { SupabaseClient } from '@supabase/supabase-js';

// One private broadcast channel per pair of users; the server policy (migration 0020) only lets the two of them in.
export function typingTopic(a: string, b: string): string {
  const [first, second] = a < b ? [a, b] : [b, a];
  return `typing:${first}:${second}`;
}

export interface TypingChannel {
  send: (typing: boolean) => void;
  close: () => void;
}

interface TypingPayload {
  typing?: unknown;
  from?: unknown;
}

// Calls onSignal(true/false) when the other user starts or stops typing. Signals are never stored.
export function openTypingChannel(
  client: SupabaseClient,
  myId: string,
  otherId: string,
  onSignal: (typing: boolean) => void
): TypingChannel {
  const channel = client
    .channel(typingTopic(myId, otherId), { config: { private: true, broadcast: { self: false } } })
    .on('broadcast', { event: 'typing' }, (message: { payload?: TypingPayload | null }) => {
      const payload = message.payload;
      if (payload && payload.from === otherId && typeof payload.typing === 'boolean') onSignal(payload.typing);
    })
    .subscribe();

  return {
    send: (typing) => {
      channel
        .send({ type: 'broadcast', event: 'typing', payload: { typing, from: myId } })
        .catch((err: unknown) => console.warn('[typing] send failed', err));
    },
    close: () => {
      void client.removeChannel(channel);
    },
  };
}
