import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false);
    });
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Нет сети — прогресс сохранится локально и синхронизируется позже</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#b45309', padding: 8 },
  text: { color: 'white', textAlign: 'center' },
});
