import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useLoginChosen } from '../hooks/useLoginChosen';
import ChooseLoginScreen from '../screens/ChooseLoginScreen';
import SignInScreen from '../screens/SignInScreen';

export interface RootNavigatorProps {
  client: SupabaseClient;
  session: Session | null;
  onSignedIn: () => void;
  // Signs out on the choose-login screen; the app supplies the full flow (stops location tracking, local fallback).
  onSignOut: () => void;
  children: React.ReactNode;
}

export default function RootNavigator({ client, session, onSignedIn, onSignOut, children }: RootNavigatorProps) {
  const userId = session?.user.id ?? '';
  const loginState = useLoginChosen(client, userId);
  // Set once the person has picked a login here, so the app opens without asking the server again.
  const [chosenFor, setChosenFor] = useState<string | null>(null);

  if (!session) {
    return <SignInScreen client={client} onSignedIn={onSignedIn} />;
  }
  const state = chosenFor === userId ? 'chosen' : loginState;
  if (state === 'loading') {
    return (
      <View testID="login-gate-loading" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (state === 'needed') {
    return (
      <ChooseLoginScreen
        client={client}
        onDone={() => setChosenFor(userId)}
        onSignOut={onSignOut}
      />
    );
  }
  // 'error' lets the person in: a failed lookup must not lock anyone out.
  return <>{children}</>;
}
