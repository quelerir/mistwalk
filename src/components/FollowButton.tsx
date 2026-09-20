import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { useT } from '../i18n/I18nProvider';
import type { TFunc } from '../i18n';

export interface FollowButtonProps {
  iFollow: boolean;
  followsMe: boolean;
  busy?: boolean;
  compact?: boolean;
  onPress: () => void;
}

export function followLabel(t: TFunc, iFollow: boolean, followsMe: boolean): string {
  if (iFollow) return t('follow.following');
  return t(followsMe ? 'follow.back' : 'follow.follow');
}

// Green when it will subscribe you, grey when you already are (a tap unsubscribes).
export default function FollowButton({ iFollow, followsMe, busy = false, compact = false, onPress }: FollowButtonProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const label = followLabel(t, iFollow, followsMe);
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        iFollow ? styles.secondary : styles.primary,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={iFollow ? t('follow.unfollow') : label}
    >
      {busy ? (
        <ActivityIndicator size="small" color={iFollow ? c.text : c.buttonText} />
      ) : (
        <Text style={[styles.text, compact && styles.textCompact, iFollow ? styles.textSecondary : styles.textPrimary]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  button: { minHeight: 44, borderRadius: 22, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  compact: { minHeight: 34, borderRadius: 17, paddingHorizontal: 14 },
  primary: { backgroundColor: c.buttonBg },
  secondary: { backgroundColor: c.surfaceAlt },
  pressed: { opacity: 0.7 },
  text: { fontSize: 16, fontWeight: '700' },
  textCompact: { fontSize: 13 },
  textPrimary: { color: c.buttonText },
  textSecondary: { color: c.text },
});
