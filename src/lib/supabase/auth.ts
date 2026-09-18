import type { SupabaseClient } from '@supabase/supabase-js';

export async function signUp(client: SupabaseClient, email: string, password: string) {
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(client: SupabaseClient, email: string, password: string) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut(client: SupabaseClient) {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function signOutLocal(client: SupabaseClient) {
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export async function getSession(client: SupabaseClient) {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}
