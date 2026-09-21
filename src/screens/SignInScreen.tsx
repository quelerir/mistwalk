import React, { useRef, useState } from 'react';
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import AuthField from '../components/AuthField';
import { useLoginAvailability } from '../hooks/useLoginAvailability';
import {
  mapAuthError,
  normalizeLogin,
  validateSignIn,
  validateSignUp,
  type ErrorCode,
  type Field,
} from '../lib/auth/validation';
import { signIn, signUp } from '../lib/supabase/auth';
import { useStyles } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { useT } from '../i18n/I18nProvider';
import type { Key } from '../i18n/ru';

export interface SignInScreenProps {
  client: SupabaseClient;
  onSignedIn: () => void;
}

type Mode = 'in' | 'up';

const ERROR_KEYS: Record<ErrorCode, Key> = {
  required: 'signin.err.required',
  tooLong: 'signin.err.tooLong',
  loginFormat: 'signin.err.loginFormat',
  email: 'signin.err.email',
  passwordShort: 'signin.err.passwordShort',
  passwordWeak: 'signin.err.passwordWeak',
  emailTaken: 'signin.err.emailTaken',
  loginTaken: 'signin.err.loginTaken',
  badCredentials: 'signin.err.badCredentials',
  network: 'signin.err.network',
  unknown: 'signin.failed',
};

const EMPTY = { firstName: '', lastName: '', login: '', email: '', password: '' };

export default function SignInScreen({ client, onSignedIn }: SignInScreenProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const [mode, setMode] = useState<Mode>('in');
  const [values, setValues] = useState(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  // What the server said: on a field, or about the form as a whole.
  const [serverError, setServerError] = useState<{ field: Field | null; code: ErrorCode } | null>(null);

  const lastNameRef = useRef<TextInput>(null);
  const loginRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const up = mode === 'up';
  const loginStatus = useLoginAvailability(client, up ? values.login : '');
  const errors: Partial<Record<Field, ErrorCode>> = up ? validateSignUp(values) : validateSignIn(values);

  function set(field: Field, text: string) {
    setValues((v) => ({ ...v, [field]: text }));
    setServerError((e) => (e && e.field === field ? null : e));
  }

  function touch(field: Field) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function switchMode(next: Mode) {
    setMode(next);
    setTouched({});
    setServerError(null);
  }

  // An error shows once the field was left; a server error shows at once.
  function fieldError(field: Field): string | null {
    if (serverError && serverError.field === field) return t(ERROR_KEYS[serverError.code]);
    const code = errors[field];
    return code && touched[field] ? t(ERROR_KEYS[code]) : null;
  }

  // The button waits for a valid form and, when signing up, for the live check to call the login free (or fail).
  const loginBlocked = up && (loginStatus === 'taken' || loginStatus === 'checking');
  const canSubmit = !busy && !loginBlocked && Object.keys(errors).length === 0;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setServerError(null);
    try {
      if (up) {
        await signUp(client, {
          email: values.email.trim(),
          password: values.password,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          login: normalizeLogin(values.login),
        });
      } else {
        await signIn(client, values.email.trim(), values.password);
      }
      onSignedIn();
    } catch (err) {
      setServerError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  const loginNote =
    loginStatus === 'checking'
      ? { text: t('signin.login.checking'), tone: 'muted' as const }
      : loginStatus === 'free'
        ? { text: t('signin.login.free'), tone: 'ok' as const }
        : loginStatus === 'taken'
          ? { text: t('signin.login.taken'), tone: 'bad' as const }
          : { text: t('signin.loginHint'), tone: 'muted' as const };

  return (
    <ImageBackground source={require('../../assets/icon.png')} style={styles.fill} resizeMode="cover">
      <View style={styles.scrim} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Mistwalk</Text>
            <Text style={styles.tagline}>{t('signin.tagline')}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.tabs}>
              {(['in', 'up'] as const).map((m) => (
                <Pressable
                  key={m}
                  testID={`signin-tab-${m}`}
                  style={[styles.tab, mode === m && styles.tabActive]}
                  onPress={() => switchMode(m)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === m }}
                >
                  <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                    {t(m === 'in' ? 'signin.tabIn' : 'signin.tabUp')}
                  </Text>
                </Pressable>
              ))}
            </View>

            {up && (
              <>
                <View style={styles.row}>
                  <View style={styles.half}>
                    <AuthField
                      testID="signin-firstName"
                      label={t('signin.firstName')}
                      value={values.firstName}
                      onChangeText={(x) => set('firstName', x)}
                      onBlur={() => touch('firstName')}
                      error={fieldError('firstName')}
                      autoCapitalize="words"
                      autoComplete="given-name"
                      textContentType="givenName"
                      returnKeyType="next"
                      onSubmitEditing={() => lastNameRef.current?.focus()}
                    />
                  </View>
                  <View style={styles.half}>
                    <AuthField
                      ref={lastNameRef}
                      testID="signin-lastName"
                      label={t('signin.lastName')}
                      value={values.lastName}
                      onChangeText={(x) => set('lastName', x)}
                      onBlur={() => touch('lastName')}
                      error={fieldError('lastName')}
                      autoCapitalize="words"
                      autoComplete="family-name"
                      textContentType="familyName"
                      returnKeyType="next"
                      onSubmitEditing={() => loginRef.current?.focus()}
                    />
                  </View>
                </View>
                <AuthField
                  ref={loginRef}
                  testID="signin-login"
                  label={t('signin.login')}
                  prefix="@"
                  value={values.login}
                  onChangeText={(x) => set('login', x)}
                  onBlur={() => touch('login')}
                  error={fieldError('login')}
                  note={loginNote}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username-new"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </>
            )}

            <AuthField
              ref={emailRef}
              testID="signin-email"
              label={t('signin.email')}
              value={values.email}
              onChangeText={(x) => set('email', x)}
              onBlur={() => touch('email')}
              error={fieldError('email')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <AuthField
              ref={passwordRef}
              testID="signin-password"
              label={t('signin.password')}
              value={values.password}
              onChangeText={(x) => set('password', x)}
              onBlur={() => touch('password')}
              error={fieldError('password')}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete={up ? 'password-new' : 'password'}
              textContentType={up ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              right={
                <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.toggle}>{t(showPassword ? 'signin.hide' : 'signin.show')}</Text>
                </Pressable>
              }
            />

            {serverError && serverError.field === null && (
              <Text style={styles.formError}>{t(ERROR_KEYS[serverError.code])}</Text>
            )}

            <Pressable
              testID="signin-submit"
              style={[styles.submit, !canSubmit && styles.submitOff]}
              onPress={() => void submit()}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit, busy }}
            >
              <Text style={styles.submitText}>{t(up ? 'signin.signUp' : 'signin.signIn')}</Text>
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
    tagline: { color: 'rgba(255,255,255,0.8)', fontSize: 15 },
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
    tabs: { flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: 14, padding: 4 },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 11 },
    tabActive: { backgroundColor: c.surface },
    tabText: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
    tabTextActive: { color: c.text },
    row: { flexDirection: 'row', gap: 10 },
    half: { flex: 1 },
    toggle: { color: c.link, fontSize: 14, fontWeight: '600' },
    formError: { color: c.danger, fontSize: 13, textAlign: 'center' },
    submit: { backgroundColor: c.buttonBg, borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    submitOff: { opacity: 0.5 },
    submitText: { color: c.buttonText, fontSize: 17, fontWeight: '700' },
  });
