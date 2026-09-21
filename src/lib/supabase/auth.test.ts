import { signUp, signIn, signOut, signOutLocal, getSession, checkLoginAvailable } from './auth';
import type { SupabaseClient } from '@supabase/supabase-js';

function makeFakeClient(overrides: Partial<SupabaseClient['auth']> = {}, rpc = jest.fn().mockResolvedValue({ data: true, error: null })) {
  return {
    rpc,
    auth: {
      signUp: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null }),
      ...overrides,
    },
  } as unknown as SupabaseClient;
}

const details = { email: 'a@b.com', password: 'password123', firstName: 'Anna', lastName: 'K', login: 'anna_k' };

describe('auth wrappers', () => {
  it('signUp sends the profile fields as user metadata and returns data', async () => {
    const client = makeFakeClient();
    const data = await signUp(client, details);
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'password123',
      options: { data: { first_name: 'Anna', last_name: 'K', login: 'anna_k' } },
    });
    expect(data.user?.id).toBe('u1');
  });

  it('signUp throws on error', async () => {
    const client = makeFakeClient({
      signUp: jest.fn().mockResolvedValue({ data: null, error: new Error('taken') }),
    });
    await expect(signUp(client, details)).rejects.toThrow('taken');
  });

  it('checkLoginAvailable returns the answer of the function', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: false, error: null });
    const client = makeFakeClient({}, rpc);
    await expect(checkLoginAvailable(client, 'anna_k')).resolves.toBe(false);
    expect(rpc).toHaveBeenCalledWith('login_available', { candidate: 'anna_k' });
  });

  it('checkLoginAvailable throws when the call fails', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: new Error('no such function') });
    await expect(checkLoginAvailable(makeFakeClient({}, rpc), 'anna_k')).rejects.toThrow('no such function');
  });

  it('signIn returns data on success', async () => {
    const client = makeFakeClient();
    const data = await signIn(client, 'a@b.com', 'password123');
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123' });
    expect(data.user?.id).toBe('u1');
  });

  it('signOut resolves on success', async () => {
    const client = makeFakeClient();
    await expect(signOut(client)).resolves.toBeUndefined();
  });

  it('signOutLocal clears only the local session and throws on error', async () => {
    const client = makeFakeClient();
    await signOutLocal(client);
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });

    const failing = makeFakeClient({ signOut: jest.fn().mockResolvedValue({ error: new Error('nope') }) });
    await expect(signOutLocal(failing)).rejects.toThrow('nope');
  });

  it('getSession returns the session', async () => {
    const client = makeFakeClient();
    const session = await getSession(client);
    expect(session?.user.id).toBe('u1');
  });
});
