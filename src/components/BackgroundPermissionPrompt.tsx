import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import SvgIcon from './icons/SvgIcon';

export interface BackgroundPermissionPromptProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

const POINTS = [
  'Туман открывается по мере прогулки, даже когда экран заблокирован.',
  'Приложение не следит за вами: точки хранятся только в вашем аккаунте.',
  'Батарея расходуется умеренно, режим можно выключить в профиле.',
];

export default function BackgroundPermissionPrompt({
  visible,
  onAccept,
  onDecline,
}: BackgroundPermissionPromptProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDecline}>
      <View style={styles.container}>
        <View style={styles.badge}>
          <SvgIcon name="locate" size={44} color="#262626" />
        </View>
        <Text style={styles.title}>Открывайте карту, даже когда телефон в кармане</Text>
        {POINTS.map((point) => (
          <View key={point} style={styles.pointRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.pointText}>{point}</Text>
          </View>
        ))}
        <Text style={styles.note}>
          Дальше iOS спросит доступ к геолокации. Выберите «Всегда разрешать» (или «Оставить», если
          система предложит).
        </Text>
        <Pressable style={styles.primary} onPress={onAccept}>
          <Text style={styles.primaryText}>Продолжить</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={onDecline}>
          <Text style={styles.secondaryText}>Не сейчас</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', padding: 24, justifyContent: 'center' },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#262626', textAlign: 'center', marginBottom: 20 },
  pointRow: { flexDirection: 'row', marginBottom: 12, paddingRight: 8 },
  bullet: { fontSize: 18, lineHeight: 22, marginRight: 10, color: '#262626' },
  pointText: { flex: 1, fontSize: 16, lineHeight: 22, color: '#262626' },
  note: { marginTop: 8, marginBottom: 28, color: '#8e8e8e', fontSize: 13, lineHeight: 18 },
  primary: { backgroundColor: '#262626', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: 'white', fontSize: 16, fontWeight: '700' },
  secondary: { paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: '#8e8e8e', fontSize: 15, fontWeight: '600' },
});
