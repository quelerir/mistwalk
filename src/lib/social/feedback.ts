import type { SupabaseClient } from '@supabase/supabase-js';

// Sent straight into the database (see supabase/migrations/0015_feedback.sql); nobody in the app reads it back.
export async function sendFeedback(
  client: SupabaseClient,
  userId: string,
  email: string | null,
  message: string
): Promise<void> {
  const { error } = await client.from('feedback').insert({ user_id: userId, email, message: message.trim() });
  if (error) throw error;
}
