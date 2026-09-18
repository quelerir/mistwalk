import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FOG_COLORS,
  FOG_STYLES,
  FOG_STYLE_LABELS,
  type FogStyle,
} from '../lib/settings/fogStyle';
import {
  getAccuracyProfile,
  setAccuracyProfile,
  type AccuracyProfile,
} from '../lib/settings/accuracyProfile';

export interface ProfileScreenProps {
  email: string;
  discoveredCount: number;
  fogStyle: FogStyle;
  onFogStyleChange: (style: FogStyle) => void;
  onSignOut: () => Promise<void>;
}

const ACCURACY_OPTIONS: Array<{ key: AccuracyProfile; label: string }> = [
  { key: 'battery-saver', label: 'Экономия' },
  { key: 'precise', label: 'Точный' },
];

export default function ProfileScreen({
  email,
  discoveredCount,
  fogStyle,
  onFogStyleChange,
  onSignOut,
}: ProfileScreenProps) {
  const [accuracy, setAccuracy] = useState<AccuracyProfile>('battery-saver');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    void getAccuracyProfile(AsyncStorage).then(setAccuracy);
  }, []);

  function chooseAccuracy(next: AccuracyProfile) {
    setAccuracy(next);
    void setAccuracyProfile(AsyncStorage, next);
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  }

  const initial = (email.trim()[0] ?? '?').toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.email} numberOfLines={1}>
            {email || 'Без почты'}
          </Text>
          <Text style={styles.stat}>Открыто мест: {discoveredCount}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Туман</Text>
      <View style={styles.row}>
        {FOG_STYLES.map((style) => {
          const selected = style === fogStyle;
          return (
            <Pressable
              key={style}
              style={[styles.fogCard, selected && styles.fogCardSelected]}
              onPress={() => onFogStyleChange(style)}
            >
              <View style={[styles.swatch, { backgroundColor: FOG_COLORS[style] }]} />
              <Text style={[styles.fogLabel, selected && styles.fogLabelSelected]}>
                {FOG_STYLE_LABELS[style]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Точность GPS</Text>
      <View style={styles.segment}>
        {ACCURACY_OPTIONS.map((option) => {
          const selected = option.key === accuracy;
          return (
            <Pressable
              key={option.key}
              style={[styles.segmentItem, selected && styles.segmentItemSelected]}
              onPress={() => chooseAccuracy(option.key)}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>Применится после перезапуска приложения. Точный режим чаще обновляет позицию и быстрее расходует батарею.</Text>

      <Pressable
        style={[styles.signOut, signingOut && styles.signOutBusy]}
        onPress={() => void handleSignOut()}
        disabled={signingOut}
      >
        <Text style={styles.signOutText}>{signingOut ? 'Выходим…' : 'Выйти'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: { color: 'white', fontSize: 30, fontWeight: '700' },
  headerText: { flex: 1 },
  email: { fontSize: 17, fontWeight: '700', color: '#262626' },
  stat: { marginTop: 4, color: '#8e8e8e' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#262626', marginTop: 20, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  fogCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#dbdbdb',
  },
  fogCardSelected: { borderColor: '#262626' },
  swatch: { width: 44, height: 44, borderRadius: 22, marginBottom: 8 },
  fogLabel: { color: '#8e8e8e', fontWeight: '600' },
  fogLabelSelected: { color: '#262626' },
  segment: { flexDirection: 'row', backgroundColor: '#efefef', borderRadius: 10, padding: 3 },
  segmentItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentItemSelected: { backgroundColor: '#ffffff' },
  segmentText: { color: '#8e8e8e', fontWeight: '600' },
  segmentTextSelected: { color: '#262626' },
  hint: { marginTop: 8, color: '#8e8e8e', fontSize: 12 },
  signOut: {
    marginTop: 32,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ed4956',
  },
  signOutBusy: { opacity: 0.5 },
  signOutText: { color: '#ed4956', fontWeight: '700', fontSize: 15 },
});
