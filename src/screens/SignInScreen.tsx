import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signIn, signUp } from '../lib/supabase/auth';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { useT } from '../i18n/I18nProvider';

export interface SignInScreenProps {
  client: SupabaseClient;
  onSignedIn: () => void;
}

export default function SignInScreen({ client, onSignedIn }: SignInScreenProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(action: 'signIn' | 'signUp') {
    setBusy(true);
    setError(null);
    try {
      if (action === 'signIn') {
        await signIn(client, email, password);
      } else {
        await signUp(client, email, password);
      }
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('signin.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={c.textFaint}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder={t('signin.password')}
        placeholderTextColor={c.textFaint}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title={t('signin.signIn')} onPress={() => handle('signIn')} disabled={busy} />
      <Button title={t('signin.signUp')} onPress={() => handle('signUp')} disabled={busy} />
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: c.bg },
  input: { borderWidth: 1, borderColor: c.borderStrong, borderRadius: 8, padding: 12, color: c.text },
  error: { color: 'red' },
});
