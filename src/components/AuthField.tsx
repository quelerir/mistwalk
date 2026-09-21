import React, { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';

export interface AuthFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  // A line under the field that is not an error: the live login check.
  note?: { text: string; tone: 'ok' | 'bad' | 'muted' } | null;
  prefix?: string;
  right?: React.ReactNode;
}

// A labelled input: a ring that follows focus, a red ring and message on an error, an optional "@" in front and a
// slot on the right (the show / hide switch of a password).
const AuthField = forwardRef<TextInput, AuthFieldProps>(function AuthField(
  { label, error, note, prefix, right, onFocus, onBlur, ...input },
  ref
) {
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focused && styles.boxFocused, !!error && styles.boxError]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          ref={ref}
          style={styles.input}
          placeholderTextColor={c.textFaint}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...input}
        />
        {right}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : note ? (
        <Text style={[styles.note, note.tone === 'ok' && styles.noteOk, note.tone === 'bad' && styles.error]}>{note.text}</Text>
      ) : null}
    </View>
  );
});

export default AuthField;

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    wrap: { gap: 6 },
    label: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.borderStrong,
      backgroundColor: c.surface,
    },
    boxFocused: { borderColor: c.accent },
    boxError: { borderColor: c.danger },
    prefix: { color: c.textMuted, fontSize: 16, marginRight: 2 },
    input: { flex: 1, color: c.text, fontSize: 16, paddingVertical: 10 },
    error: { color: c.danger, fontSize: 12 },
    note: { color: c.textMuted, fontSize: 12 },
    noteOk: { color: c.accent },
  });
