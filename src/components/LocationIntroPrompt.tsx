import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import SvgIcon from './icons/SvgIcon';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { FONT } from '../theme/fonts';
import { useT } from '../i18n/I18nProvider';

export interface LocationIntroPromptProps {
  visible: boolean;
  onContinue: () => void;
}

const POINT_KEYS = ['locIntro.point1', 'locIntro.point2', 'locIntro.point3'] as const;

// Shown once, before the system asks for the location: says why the app needs it. There is no "not now", the map does
// not open without a location.
export default function LocationIntroPrompt({ visible, onContinue }: LocationIntroPromptProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <View style={styles.badge}>
          <SvgIcon name="locate" size={44} color={c.text} />
        </View>
        <Text style={styles.title}>{t('locIntro.title')}</Text>
        {POINT_KEYS.map((key) => (
          <View key={key} style={styles.pointRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.pointText}>{t(key)}</Text>
          </View>
        ))}
        <Pressable testID="location-intro-continue" style={styles.primary} onPress={onContinue} accessibilityRole="button">
          <Text style={styles.primaryText}>{t('locIntro.continue')}</Text>
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
  primary: { backgroundColor: c.buttonBg, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  primaryText: { color: c.buttonText, fontSize: 16, fontWeight: '700' },
});
