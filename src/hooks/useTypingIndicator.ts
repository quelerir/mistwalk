import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { openTypingChannel, type TypingChannel } from '../lib/social/typing';

const SEND_EVERY_MS = 2000;
const HIDE_AFTER_MS = 4000;

// "The other user is typing" for an open chat, and the calls that tell them we are typing.
// A failing or missing channel just means no indicator: the chat itself never depends on it.
export function useTypingIndicator(client: SupabaseClient, myId: string, otherId: string) {
  const [otherTyping, setOtherTyping] = useState(false);
  const channel = useRef<TypingChannel | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef(0);
  const sentTyping = useRef(false);

  const clearTyping = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
    setOtherTyping(false);
  }, []);

  useEffect(() => {
    lastSent.current = 0;
    sentTyping.current = false;
    channel.current = openTypingChannel(client, myId, otherId, (typing) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = null;
      setOtherTyping(typing);
      if (typing) hideTimer.current = setTimeout(() => setOtherTyping(false), HIDE_AFTER_MS);
    });
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = null;
      channel.current?.close();
      channel.current = null;
    };
  }, [client, myId, otherId]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSent.current < SEND_EVERY_MS) return;
    lastSent.current = now;
    sentTyping.current = true;
    channel.current?.send(true);
  }, []);

  const stopTyping = useCallback(() => {
    if (!sentTyping.current) return;
    sentTyping.current = false;
    lastSent.current = 0;
    channel.current?.send(false);
  }, []);

  return { otherTyping, notifyTyping, stopTyping, clearTyping };
}
