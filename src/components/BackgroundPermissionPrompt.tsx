import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import SvgIcon from './icons/SvgIcon';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { FONT } from '../theme/fonts';
import { useT } from '../i18n/I18nProvider';

export interface BackgroundPermissionPromptProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

const POINT_KEYS = ['bg.point1', 'bg.point2', 'bg.point3'] as const;

export default function BackgroundPermissionPrompt({
  visible,
  onAccept,
  onDecline,
}: BackgroundPermissionPromptProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDecline}>
      <View style={styles.container}>
        <View style={styles.badge}>
          <SvgIcon name="locate" size={44} color={c.text} />
        </View>
        <Text style={styles.title}>{t('bg.title')}</Text>
        {POINT_KEYS.map((key) => (
          <View key={key} style={styles.pointRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.pointText}>{t(key)}</Text>
          </View>
        ))}
        <Text style={styles.note}>{t('bg.iosNote')}</Text>
        <Pressable style={styles.primary} onPress={onAccept}>
          <Text style={styles.primaryText}>{t('bg.continue')}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={onDecline}>
          <Text style={styles.secondaryText}>{t('bg.notNow')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg, padding: 24, justifyContent: 'center' },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 26, fontFamily: FONT.display, letterSpacing: -0.8, color: c.text, textAlign: 'center', marginBottom: 20 },
  pointRow: { flexDirection: 'row', marginBottom: 12, paddingRight: 8 },
  bullet: { fontSize: 18, lineHeight: 22, marginRight: 10, color: c.text },
  pointText: { flex: 1, fontSize: 16, lineHeight: 22, color: c.text },
  note: { marginTop: 8, marginBottom: 28, color: c.textMuted, fontSize: 13, lineHeight: 18 },
  primary: { backgroundColor: c.buttonBg, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: c.buttonText, fontSize: 16, fontWeight: '700' },
  secondary: { paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
});
