import React, { useRef, useState } from 'react';
import { ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SupabaseClient } from '@supabase/supabase-js';
import AuthField from '../components/AuthField';
import { useLoginAvailability } from '../hooks/useLoginAvailability';
import { ERROR_KEYS } from '../lib/auth/errorKeys';
import { mapAuthError, normalizeLogin, type ErrorCode } from '../lib/auth/validation';
import { setLogin } from '../lib/supabase/auth';
import { useStyles } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { useT } from '../i18n/I18nProvider';

export interface ChooseLoginScreenProps {
  client: SupabaseClient;
  onDone: () => void;
  onSignOut: () => void;
}

// Shown once to someone who signed in with a code from the email for the first time: they pick the login other players see.
export default function ChooseLoginScreen({ client, onDone, onSignOut }: ChooseLoginScreenProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  // A ref as well as the state: two quick taps run before the state has redrawn.
  const working = useRef(false);
  const status = useLoginAvailability(client, value);

  const canSubmit = !busy && status === 'free';

  const note =
    status === 'checking'
      ? { text: t('signin.login.checking'), tone: 'muted' as const }
      : status === 'free'
        ? { text: t('signin.login.free'), tone: 'ok' as const }
        : status === 'taken'
          ? { text: t('signin.login.taken'), tone: 'bad' as const }
          : status === 'invalid'
            ? { text: t('signin.err.loginFormat'), tone: 'bad' as const }
            : { text: t('signin.loginHint'), tone: 'muted' as const };

  async function submit() {
    if (working.current || status !== 'free') return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      await setLogin(client, normalizeLogin(value));
      onDone();
    } catch (err) {
      setError(mapAuthError(err).code);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  return (
    <ImageBackground source={require('../../assets/icon.png')} style={styles.fill} resizeMode="cover">
      <View style={styles.scrim} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: 20 + insets.top, paddingBottom: 20 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Mistwalk</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>{t('chooseLogin.title')}</Text>
            <Text style={styles.body}>{t('chooseLogin.body')}</Text>

            <AuthField
              testID="choose-login"
              label={t('signin.login')}
              prefix="@"
              value={value}
              onChangeText={(x) => {
                setValue(x);
                setError(null);
              }}
              error={error ? t(ERROR_KEYS[error]) : null}
              note={note}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username-new"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
            />

            <Pressable
              testID="choose-submit"
              style={[styles.submit, !canSubmit && styles.submitOff]}
              onPress={() => void submit()}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit, busy }}
            >
              <Text style={styles.submitText}>{t('chooseLogin.submit')}</Text>
            </Pressable>

            <Pressable testID="choose-signout" onPress={onSignOut} style={styles.link} accessibilityRole="button">
              <Text style={styles.linkText}>{t('chooseLogin.signOut')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    fill: { flex: 1 },
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 12, 16, 0.62)' },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 20, gap: 24 },
    header: { alignItems: 'center', gap: 6 },
    title: { color: '#FFFFFF', fontSize: 36, fontWeight: '800', letterSpacing: 0.5 },
    card: {
      backgroundColor: c.card,
      borderRadius: 24,
      padding: 20,
      gap: 14,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    heading: { color: c.text, fontSize: 20, fontWeight: '700' },
    body: { color: c.textMuted, fontSize: 14, lineHeight: 20 },
    submit: { backgroundColor: c.buttonBg, borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    submitOff: { opacity: 0.5 },
    submitText: { color: c.buttonText, fontSize: 17, fontWeight: '700' },
    link: { alignItems: 'center', paddingVertical: 6 },
    linkText: { color: c.link, fontSize: 14, fontWeight: '600' },
  });
