import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export type LoginChosenStatus = 'loading' | 'chosen' | 'needed' | 'error';

interface Answer {
  userId: string;
  status: Exclude<LoginChosenStatus, 'loading'>;
}

// Has this player picked their login yet? Someone who arrived with a code from the email starts with a temporary one.
// A missing profile row counts as chosen, so the older flows (the app makes a default profile) are untouched.
export function useLoginChosen(client: SupabaseClient, userId: string): LoginChosenStatus {
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    if (!userId) return;
    let stale = false;
    (async () => {
      let status: Answer['status'];
      try {
        const { data, error } = await client.from('player_profiles').select('login_chosen').eq('user_id', userId).maybeSingle();
        if (error) status = 'error';
        else status = data && data.login_chosen === false ? 'needed' : 'chosen';
      } catch {
        status = 'error';
      }
      if (!stale) setAnswer({ userId, status });
    })();
    return () => {
      stale = true;
    };
  }, [client, userId]);

  return userId && answer && answer.userId === userId ? answer.status : 'loading';
}
