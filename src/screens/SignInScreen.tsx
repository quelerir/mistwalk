import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signIn, signUp } from '../lib/supabase/auth';

export interface SignInScreenProps {
  client: SupabaseClient;
  onSignedIn: () => void;
}

export default function SignInScreen({ client, onSignedIn }: SignInScreenProps) {
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
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Пароль"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title="Войти" onPress={() => handle('signIn')} disabled={busy} />
      <Button title="Зарегистрироваться" onPress={() => handle('signUp')} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  error: { color: 'red' },
});
