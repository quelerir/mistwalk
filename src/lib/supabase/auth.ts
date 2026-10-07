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

// Confirms a sign-up with the 6-digit code from the email; the returned data holds the new session.
export async function verifyEmail(client: SupabaseClient, email: string, code: string) {
  const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw error;
  return data;
}

export async function resendCode(client: SupabaseClient, email: string): Promise<void> {
  const { error } = await client.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

// Sends a 6-digit sign-in code to the address. Someone new gets an account; their login is chosen afterwards.
export async function sendLoginCode(client: SupabaseClient, email: string): Promise<void> {
  const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

// Sets the signed-in player's login; the server raises invalid_login, login_taken or no_profile.
export async function setLogin(client: SupabaseClient, login: string): Promise<void> {
  const { error } = await client.rpc('set_login', { candidate: login });
  if (error) throw error;
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

export async function deleteAccount(client: SupabaseClient): Promise<void> {
  const { error } = await client.functions.invoke('delete-account');
  if (error) throw error;
}

export async function getSession(client: SupabaseClient) {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}
