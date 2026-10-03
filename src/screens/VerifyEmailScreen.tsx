import React, { useEffect, useRef, useState } from 'react';
import { ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SupabaseClient } from '@supabase/supabase-js';
import AuthField from '../components/AuthField';
import { ERROR_KEYS } from '../lib/auth/errorKeys';
import { mapAuthError, normalizeCode, validateCode, type ErrorCode } from '../lib/auth/validation';
import { resendCode, verifyEmail } from '../lib/supabase/auth';
import { useStyles } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { useT } from '../i18n/I18nProvider';

export interface VerifyEmailScreenProps {
  client: SupabaseClient;
  email: string;
  onVerified: () => void;
  onBack: () => void;
  // Seconds before the first "send again"; a prop so tests need not wait a minute.
  initialCooldown?: number;
}

const RESEND_SECONDS = 60;

// The second step of a sign-up: the person types the 6-digit code that came to their email.
export default function VerifyEmailScreen({ client, email, onVerified, onBack, initialCooldown = RESEND_SECONDS }: VerifyEmailScreenProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [cooldown, setCooldown] = useState(initialCooldown);
  // A ref as well as the state: two quick taps run before the state has redrawn.
  const working = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const canSubmit = !busy && validateCode(code) === null;

  async function run(action: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(mapAuthError(err).code);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  const submit = () => {
    if (validateCode(code) !== null) return;
    void run(async () => {
      await verifyEmail(client, email, normalizeCode(code));
      onVerified();
    });
  };

  const resend = () => {
    if (cooldown > 0) return;
    void run(async () => {
      await resendCode(client, email);
      setCooldown(RESEND_SECONDS);
    });
  };

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
            <Text style={styles.heading}>{t('verify.title')}</Text>
            <Text style={styles.body}>{t('verify.body', { email })}</Text>

            <AuthField
              testID="verify-code"
              label={t('verify.code')}
              value={code}
              onChangeText={(x) => {
                setCode(normalizeCode(x));
                setError(null);
              }}
              error={error ? t(ERROR_KEYS[error]) : null}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={submit}
            />

            <Pressable
              testID="verify-submit"
              style={[styles.submit, !canSubmit && styles.submitOff]}
              onPress={submit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit, busy }}
            >
              <Text style={styles.submitText}>{t('verify.submit')}</Text>
            </Pressable>

            <Pressable
              testID="verify-resend"
              onPress={resend}
              disabled={cooldown > 0 || busy}
              style={styles.link}
              accessibilityRole="button"
              accessibilityState={{ disabled: cooldown > 0 || busy }}
            >
              <Text style={[styles.linkText, (cooldown > 0 || busy) && styles.linkOff]}>
                {cooldown > 0 ? t('verify.resendIn', { n: cooldown }) : t('verify.resend')}
              </Text>
            </Pressable>

            <Pressable testID="verify-back" onPress={onBack} style={styles.link} accessibilityRole="button">
              <Text style={styles.linkText}>{t('verify.otherEmail')}</Text>
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
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8, 20, 22, 0.62)' },
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
    body: { color: c.textMuted, fontSize: 15, lineHeight: 21 },
    submit: { backgroundColor: c.buttonBg, borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    submitOff: { opacity: 0.5 },
    submitText: { color: c.buttonText, fontSize: 17, fontWeight: '700' },
    link: { alignItems: 'center', paddingVertical: 8 },
    linkText: { color: c.link, fontSize: 15, fontWeight: '600' },
    linkOff: { opacity: 0.5 },
  });
