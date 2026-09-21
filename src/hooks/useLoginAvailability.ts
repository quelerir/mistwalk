import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkLoginAvailable } from '../lib/supabase/auth';
import { normalizeLogin, validateLogin } from '../lib/auth/validation';

export type LoginStatus = 'idle' | 'invalid' | 'checking' | 'free' | 'taken' | 'error';

interface Answer {
  login: string;
  status: 'free' | 'taken' | 'error';
}

// Asks the server whether a login is free, a little after the typing stops. A badly formed login is never sent, and
// an answer to a login that is no longer the one typed is dropped.
export function useLoginAvailability(client: SupabaseClient, raw: string, delayMs = 400): LoginStatus {
  const login = normalizeLogin(raw);
  const syntax: LoginStatus | null = login === '' ? 'idle' : validateLogin(login) ? 'invalid' : null;
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    if (syntax) return;
    let stale = false;
    const timer = setTimeout(() => {
      checkLoginAvailable(client, login)
        .then((free) => {
          if (!stale) setAnswer({ login, status: free ? 'free' : 'taken' });
        })
        .catch(() => {
          if (!stale) setAnswer({ login, status: 'error' });
        });
    }, delayMs);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [client, login, syntax, delayMs]);

  if (syntax) return syntax;
  return answer && answer.login === login ? answer.status : 'checking';
}
