import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import type { PermissionStage } from '../hooks/useLocationPermissions';

export interface LocationPermissionBannerProps {
  stage: PermissionStage;
  onRequestForeground: () => void;
}

export default function LocationPermissionBanner({ stage, onRequestForeground }: LocationPermissionBannerProps) {
  if (stage === 'foreground-granted' || stage === 'background-granted') return null;

  return (
    <View style={styles.banner}>
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
  banner: { backgroundColor: '#1f2937', padding: 8, alignItems: 'center', gap: 4 },
  text: { color: 'white', textAlign: 'center' },
});
