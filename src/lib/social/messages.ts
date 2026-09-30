import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export interface Conversation {
  otherUserId: string;
  displayName: string;
  avatarPath: string | null;
  lastBody: string;
  lastAt: number;
  lastFromMe: boolean;
  unreadCount: number;
}

interface ConversationRow {
  other_user_id: string;
  display_name: string;
  avatar_path: string | null;
  last_body: string;
  last_at: string;
  last_from_me: boolean;
  unread_count: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: number;
  readAt: number | null;
}

interface MessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

function fromRow(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    body: row.body,
    createdAt: Date.parse(row.created_at),
    readAt: row.read_at ? Date.parse(row.read_at) : null,
  };
}

export async function fetchConversations(client: SupabaseClient): Promise<Conversation[]> {
  const { data, error } = await client.rpc('conversations_list', { max_rows: 100 });
  if (error) throw error;
  return ((data ?? []) as ConversationRow[]).map((row) => ({
    otherUserId: row.other_user_id,
    displayName: row.display_name,
    avatarPath: row.avatar_path ?? null,
    lastBody: row.last_body,
    lastAt: Date.parse(row.last_at),
    lastFromMe: row.last_from_me,
    unreadCount: row.unread_count,
  }));
}

export async function fetchUnreadCount(client: SupabaseClient): Promise<number> {
  const { data, error } = await client.rpc('unread_message_count');
  if (error) throw error;
  return typeof data === 'number' ? data : Number(data ?? 0);
}

const HISTORY_LIMIT = 200;

export async function fetchMessagesWith(client: SupabaseClient, myId: string, otherId: string): Promise<ChatMessage[]> {
  const { data, error } = await client
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${myId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${myId})`)
    .order('created_at', { ascending: true })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  return ((data ?? []) as MessageRow[]).map(fromRow);
}

export async function sendMessage(client: SupabaseClient, recipient: string, body: string): Promise<ChatMessage> {
  const { data, error } = await client.rpc('send_message', { recipient, body }).single();
  if (error) throw error;
  return fromRow(data as MessageRow);
}

export async function markConversationRead(client: SupabaseClient, other: string): Promise<void> {
  const { error } = await client.rpc('mark_conversation_read', { other });
  if (error) throw error;
}

// Incoming messages addressed to me, from anyone; the caller filters by sender when it only
// cares about one open conversation.
export function subscribeToIncomingMessages(
  client: SupabaseClient,
  myId: string,
  onMessage: (message: ChatMessage) => void
): RealtimeChannel {
  return client
    .channel(`messages-in-${myId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${myId}` },
      (payload) => onMessage(fromRow(payload.new as MessageRow))
    )
    .subscribe();
}
