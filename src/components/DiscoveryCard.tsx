import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { greetingFor } from '../lib/poi/greeting';
import KindIcon from './KindIcon';
import type { Poi } from '../lib/poi/types';
import { useT } from '../i18n/I18nProvider';

export interface DiscoveryCardProps {
  place: Poi | null;
  onDismiss: () => void;
  onOpen: (place: Poi) => void;
}

export default function DiscoveryCard({ place, onDismiss, onOpen }: DiscoveryCardProps) {
  const t = useT();
  if (!place) return null;
  return (
    <Pressable
      style={styles.wrapper}
      onPress={() => {
        onDismiss();
        onOpen(place);
      }}
    >
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <KindIcon kind={place.kind} size={22} color="#ffffff" />
          <Text style={styles.title}>{t('place.found', { name: place.name })}</Text>
        </View>
        <Text style={styles.text}>{greetingFor(t, place.kind)}</Text>
        <Text style={styles.more}>{t('place.more')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 56, left: 16, right: 16 },
  card: {
    backgroundColor: 'rgba(20, 24, 40, 0.94)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { flex: 1, color: '#ffffff', fontSize: 18, fontWeight: '800' },
  text: { color: 'white', fontSize: 15 },
  more: { color: '#ffffff', fontWeight: '700', marginTop: 8 },
});
