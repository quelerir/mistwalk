import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

export type LoginChosenStatus = 'loading' | 'chosen' | 'needed' | 'error';

interface Answer {
  userId: string;
  status: Exclude<LoginChosenStatus, 'loading'>;
}

// After this long without an answer the app opens anyway: a hanging network must not hold the person at the gate.
const QUERY_TIMEOUT_MS = 3000;
const memoryKey = (userId: string) => `login_chosen:${userId}`;

// Has this player picked their login yet? Someone who arrived with a code from the email starts with a temporary one.
// A missing profile row counts as chosen, so the older flows (the app makes a default profile) are untouched.
// Once chosen is confirmed it is remembered on the device (it can never go back), so later launches do not wait for the
// network.
export function useLoginChosen(client: SupabaseClient, userId: string): LoginChosenStatus {
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    if (!userId) return;
    let settled = false;
    const settle = (status: Answer['status']) => {
      if (settled) return;
      settled = true;
      setAnswer({ userId, status });
    };
    const timer = setTimeout(() => settle('error'), QUERY_TIMEOUT_MS);

    (async () => {
      const remembered = await AsyncStorage.getItem(memoryKey(userId)).catch(() => null);
      if (remembered === '1') return settle('chosen');
      try {
        const { data, error } = await client.from('player_profiles').select('login_chosen').eq('user_id', userId).maybeSingle();
        if (error) return settle('error');
        if (data && data.login_chosen === false) return settle('needed');
        if (data && data.login_chosen === true) await AsyncStorage.setItem(memoryKey(userId), '1').catch(() => undefined);
        settle('chosen');
      } catch {
        settle('error');
      }
    })().finally(() => clearTimeout(timer));

    return () => {
      settled = true;
      clearTimeout(timer);
    };
  }, [client, userId]);

  return userId && answer && answer.userId === userId ? answer.status : 'loading';
}
