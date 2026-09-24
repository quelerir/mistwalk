import { sendFeedback } from './feedback';
import type { SupabaseClient } from '@supabase/supabase-js';

function makeFakeClient(insertResult: { error: unknown }) {
  const insert = jest.fn().mockResolvedValue(insertResult);
  const from = jest.fn().mockReturnValue({ insert });
  return { client: { from } as unknown as SupabaseClient, from, insert };
}

describe('sendFeedback', () => {
  it('inserts the trimmed message with the user id and email', async () => {
    const { client, from, insert } = makeFakeClient({ error: null });

    await sendFeedback(client, 'user-1', 'a@b.co', '  Love the fog!  ');

    expect(from).toHaveBeenCalledWith('feedback');
    expect(insert).toHaveBeenCalledWith({ user_id: 'user-1', email: 'a@b.co', message: 'Love the fog!' });
  });

  it('sends a null email when there is none', async () => {
    const { client, insert } = makeFakeClient({ error: null });

    await sendFeedback(client, 'user-1', null, 'Hello');

    expect(insert).toHaveBeenCalledWith({ user_id: 'user-1', email: null, message: 'Hello' });
  });

  it('throws on error', async () => {
    const { client } = makeFakeClient({ error: new Error('nope') });

    await expect(sendFeedback(client, 'user-1', 'a@b.co', 'Hi')).rejects.toThrow('nope');
  });
});
