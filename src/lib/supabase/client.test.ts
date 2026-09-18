import { createSupabaseClient } from './client';

describe('createSupabaseClient', () => {
  it('throws when url is missing', () => {
    expect(() => createSupabaseClient('', 'anon-key')).toThrow(
      'createSupabaseClient: url and anonKey are required'
    );
  });

  it('throws when anonKey is missing', () => {
    expect(() => createSupabaseClient('https://example.supabase.co', '')).toThrow(
      'createSupabaseClient: url and anonKey are required'
    );
  });

  it('returns a client when both are provided', () => {
    const client = createSupabaseClient('https://example.supabase.co', 'anon-key');
    expect(client).toBeDefined();
    expect(typeof client.auth.signInWithPassword).toBe('function');
  });
});
