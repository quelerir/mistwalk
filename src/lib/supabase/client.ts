import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error('createSupabaseClient: url and anonKey are required');
  }
  return createClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export function getEnvSupabaseClient(): SupabaseClient {
  return createSupabaseClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''
  );
}
