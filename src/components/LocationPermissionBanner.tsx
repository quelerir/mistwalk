import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PermissionStage } from '../hooks/useLocationPermissions';
import { useT } from '../i18n/I18nProvider';

export interface LocationPermissionBannerProps {
  stage: PermissionStage;
  onRequestForeground: () => void;
}

export default function LocationPermissionBanner({ stage, onRequestForeground }: LocationPermissionBannerProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  if (stage === 'foreground-granted' || stage === 'background-granted') return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.text}>
        {stage === 'denied'
          ? t('banner.locationDenied')
          : t('banner.locationOff')}
      </Text>
      {stage !== 'denied' && <Button title={t('banner.allow')} onPress={onRequestForeground} />}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: '#1f2937', padding: 8, alignItems: 'center', gap: 4 },
  text: { color: 'white', textAlign: 'center' },
});
