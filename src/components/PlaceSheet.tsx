import React from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlaceInfo } from '../hooks/usePlaceInfo';
import { KIND_ICON, KIND_LABEL } from '../lib/poi/greeting';
import type { Poi } from '../lib/poi/types';

export interface PlaceSheetProps {
  place: Poi | null;
  onClose: () => void;
}

export default function PlaceSheet({ place, onClose }: PlaceSheetProps) {
  const insets = useSafeAreaInsets();
  const { info, status } = usePlaceInfo(place);

  return (
    <Modal visible={place !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />
      {place && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <ScrollView bounces={false}>
            {info?.imageUrl ? (
              <Image source={{ uri: info.imageUrl }} style={styles.photo} resizeMode="cover" />
            ) : null}
            <View style={styles.body}>
              <Text style={styles.kind}>
                {KIND_ICON[place.kind]} {KIND_LABEL[place.kind]}
              </Text>
              <Text style={styles.title}>{place.name}</Text>

              {status === 'loading' && <ActivityIndicator style={styles.loader} />}
              {status === 'failed' && (
                <Text style={styles.muted}>Не удалось загрузить описание. Проверьте интернет.</Text>
              )}
              {status === 'ready' && (
                <>
                  <Text style={info?.description ? styles.text : styles.muted}>
                    {info?.description ?? 'Описания этого места пока нет.'}
                  </Text>
                  {info?.pageUrl && (
                    <Pressable onPress={() => void Linking.openURL(info.pageUrl!)} accessibilityRole="link">
                      <Text style={styles.source}>{info.source} ›</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#ffffff', maxHeight: '85%', paddingTop: 10 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#d0d0d0', marginBottom: 10 },
  photo: { width: '100%', height: 220, backgroundColor: '#efefef' },
  body: { padding: 16 },
  kind: { color: '#8a5a00', fontWeight: '700', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: '#262626', marginBottom: 12 },
  text: { fontSize: 15, lineHeight: 22, color: '#262626' },
  muted: { fontSize: 15, color: '#8e8e8e' },
  loader: { marginTop: 16 },
  source: { marginTop: 14, color: '#2f6fdd', fontWeight: '700' },
});
