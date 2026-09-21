import type { SupabaseClient } from '@supabase/supabase-js';

export interface SignUpInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  login: string;
}

// The name and the login travel as user metadata; a database trigger turns them into the player's profile.
export async function signUp(client: SupabaseClient, input: SignUpInput) {
  const { data, error } = await client.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { first_name: input.firstName, last_name: input.lastName, login: input.login } },
  });
  if (error) throw error;
  return data;
}

export async function checkLoginAvailable(client: SupabaseClient, login: string): Promise<boolean> {
  const { data, error } = await client.rpc('login_available', { candidate: login });
  if (error) throw error;
  // Anything but a plain yes or no means the function is not what we expect; the caller treats that as a failed check.
  if (typeof data !== 'boolean') throw new Error('login_available returned an unexpected result');
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
