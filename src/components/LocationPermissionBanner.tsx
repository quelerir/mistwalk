import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PermissionStage } from '../hooks/useLocationPermissions';

export interface LocationPermissionBannerProps {
  stage: PermissionStage;
  onRequestForeground: () => void;
}

export default function LocationPermissionBanner({ stage, onRequestForeground }: LocationPermissionBannerProps) {
  const insets = useSafeAreaInsets();
  if (stage === 'foreground-granted' || stage === 'background-granted') return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.text}>
        {stage === 'denied'
          ? 'Доступ к геолокации отклонён — включите его в настройках, чтобы открывать карту'
          : 'Включите геолокацию, чтобы открывать карту'}
      </Text>
      {stage !== 'denied' && <Button title="Разрешить" onPress={onRequestForeground} />}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: '#1f2937', padding: 8, alignItems: 'center', gap: 4 },
  text: { color: 'white', textAlign: 'center' },
});
