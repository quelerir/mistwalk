import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SupabaseClient } from '@supabase/supabase-js';
import SvgIcon from '../components/icons/SvgIcon';
import {
  fetchMessagesWith,
  markConversationRead,
  sendMessage,
  subscribeToIncomingMessages,
  type ChatMessage,
} from '../lib/social/messages';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { FONT } from '../theme/fonts';
import { useI18n } from '../i18n/I18nProvider';

export interface ChatScreenProps {
  client: SupabaseClient;
  myId: string;
  otherId: string;
  otherName: string;
  onBack: () => void;
}

export default function ChatScreen({ client, myId, otherId, otherName, onBack }: ChatScreenProps) {
  const { t, lang } = useI18n();
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const load = useCallback(async () => {
    try {
      const list = await fetchMessagesWith(client, myId, otherId);
      setMessages(list);
      setStatus('ready');
      void markConversationRead(client, otherId);
    } catch (err) {
      console.warn('[chat] load failed', err);
      setStatus('error');
    }
  }, [client, myId, otherId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = subscribeToIncomingMessages(client, myId, (message) => {
      if (message.senderId !== otherId) return;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      void markConversationRead(client, otherId);
    });
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, myId, otherId]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft('');
    try {
      const sent = await sendMessage(client, otherId, body);
      setMessages((prev) => [...prev, sent]);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      console.warn('[chat] send failed', err);
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.roundButton} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <SvgIcon name="back" size={22} color={c.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {otherName}
        </Text>
        <View style={styles.roundButton} />
      </View>

      {status === 'loading' ? (
        <ActivityIndicator style={styles.loader} />
      ) : status === 'error' ? (
        <Text style={styles.empty}>{t('chats.loadFailed')}</Text>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={styles.empty}>{t('chats.emptyThread')}</Text>}
          renderItem={({ item }) => {
            const mine = item.senderId === myId;
            return (
              <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={t('chats.placeholder')}
          placeholderTextColor={c.textFaint}
          multiline
          maxLength={2000}
        />
        <Pressable
          style={[styles.sendButton, !draft.trim() && styles.sendButtonOff]}
          disabled={!draft.trim() || sending}
          onPress={() => void handleSend()}
          accessibilityRole="button"
          accessibilityLabel={t('chats.send')}
        >
          {sending ? <ActivityIndicator size="small" color={c.buttonText} /> : <Text style={styles.sendText}>{t('chats.send')}</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  roundButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: c.text, marginHorizontal: 8 },
  loader: { marginTop: 32 },
  empty: { marginTop: 32, paddingHorizontal: 24, textAlign: 'center', color: c.textMuted },
  list: { paddingHorizontal: 12, paddingVertical: 8, flexGrow: 1, justifyContent: 'flex-end' },
  bubbleRow: { flexDirection: 'row', marginVertical: 3 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  bubbleMine: { backgroundColor: c.accent, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: c.surfaceAlt, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: c.text, lineHeight: 20 },
  bubbleTextMine: { color: c.buttonText },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: c.surfaceAlt,
    color: c.text,
    fontSize: 15,
  },
  sendButton: { paddingHorizontal: 16, height: 40, borderRadius: 20, backgroundColor: c.buttonBg, alignItems: 'center', justifyContent: 'center' },
  sendButtonOff: { opacity: 0.4 },
  sendText: { color: c.buttonText, fontWeight: '700' },
});
