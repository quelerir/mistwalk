import React from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import SignInScreen from '../screens/SignInScreen';

export interface RootNavigatorProps {
  client: SupabaseClient;
  session: Session | null;
  onSignedIn: () => void;
  children: React.ReactNode;
}

export default function RootNavigator({ client, session, onSignedIn, children }: RootNavigatorProps) {
  if (!session) {
    return <SignInScreen client={client} onSignedIn={onSignedIn} />;
  }
  return <>{children}</>;
}
