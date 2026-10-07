import React, { useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useLoginChosen } from '../hooks/useLoginChosen';
import { signOut } from '../lib/supabase/auth';
import ChooseLoginScreen from '../screens/ChooseLoginScreen';
import SignInScreen from '../screens/SignInScreen';

export interface RootNavigatorProps {
  client: SupabaseClient;
  session: Session | null;
  onSignedIn: () => void;
  onSignedOut: () => void;
  children: React.ReactNode;
}

export default function RootNavigator({ client, session, onSignedIn, onSignedOut, children }: RootNavigatorProps) {
  const userId = session?.user.id ?? '';
  const loginState = useLoginChosen(client, userId);
  // Set once the person has picked a login here, so the app opens without asking the server again.
  const [chosenFor, setChosenFor] = useState<string | null>(null);

  if (!session) {
    return <SignInScreen client={client} onSignedIn={onSignedIn} />;
  }
  const state = chosenFor === userId ? 'chosen' : loginState;
  if (state === 'loading') return null;
  if (state === 'needed') {
    return (
      <ChooseLoginScreen
        client={client}
        onDone={() => setChosenFor(userId)}
        onSignOut={() => {
          void signOut(client)
            .catch(() => undefined)
            .then(onSignedOut);
        }}
      />
    );
  }
  // 'error' lets the person in: a failed lookup must not lock anyone out.
  return <>{children}</>;
}
