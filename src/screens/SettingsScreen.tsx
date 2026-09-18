import React, { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AccuracyProfile,
  getAccuracyProfile,
  setAccuracyProfile,
} from '../lib/settings/accuracyProfile';

export interface SettingsScreenProps {
  onProfileChanged: (profile: AccuracyProfile) => void;
}

export default function SettingsScreen({ onProfileChanged }: SettingsScreenProps) {
  const [profile, setProfile] = useState<AccuracyProfile>('battery-saver');

  useEffect(() => {
    getAccuracyProfile(AsyncStorage).then(setProfile);
  }, []);

  async function toggle(value: boolean) {
    const next: AccuracyProfile = value ? 'precise' : 'battery-saver';
    setProfile(next);
    await setAccuracyProfile(AsyncStorage, next);
    onProfileChanged(next);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Точный режим (чаще обновления, больше расход батареи)</Text>
      <Switch value={profile === 'precise'} onValueChange={toggle} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  label: { fontSize: 16 },
});
