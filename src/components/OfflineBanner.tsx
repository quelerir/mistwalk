import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false);
    });
  }, []);

  if (!isOffline) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.text}>Нет сети — прогресс сохранится локально и синхронизируется позже</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Floats over the top of the screen, which the map now fills under the status bar.
  banner: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: '#b45309', padding: 8 },
  text: { color: 'white', textAlign: 'center' },
});
