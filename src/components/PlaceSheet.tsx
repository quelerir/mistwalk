import React from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlaceInfo } from '../hooks/usePlaceInfo';
import { KIND_LABEL } from '../lib/poi/greeting';
import KindIcon from './KindIcon';
import type { Poi } from '../lib/poi/types';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { KIND_COLOR } from '../lib/poi/kindColors';
import SvgIcon from './icons/SvgIcon';
import { FONT } from '../theme/fonts';

export interface PlaceSheetProps {
  place: Poi | null;
  onClose: () => void;
}

export default function PlaceSheet({ place, onClose }: PlaceSheetProps) {
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const { info, status } = usePlaceInfo(place);

  return (
    <Modal visible={place !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />
      {place && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          {!info?.imageUrl && <View style={styles.handle} />}
          <View>
            {info?.imageUrl ? (
              <Image source={{ uri: info.imageUrl }} style={styles.photo} resizeMode="cover" />
            ) : null}
            <Pressable onPress={onClose} hitSlop={8} style={styles.close} accessibilityRole="button" accessibilityLabel="Закрыть">
              <SvgIcon name="close" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
          <ScrollView bounces={false}>
            <View style={styles.body}>
              <View style={styles.kindRow}>
                <KindIcon kind={place.kind} size={18} color={KIND_COLOR[place.kind]} />
                <Text style={[styles.kind, { color: KIND_COLOR[place.kind] }]}>{KIND_LABEL[place.kind].toUpperCase()}</Text>
              </View>
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
                      <View style={styles.sourceRow}>
                        <SvgIcon name="book" size={16} color={c.textMuted} />
                        <Text style={styles.source}>{info.source}</Text>
                      </View>
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

const makeStyles = (c: Colors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: c.card, maxHeight: '85%', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.sheetHandle, marginTop: 10, marginBottom: 10 },
  close: { position: 'absolute', right: 14, top: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: 220, backgroundColor: c.surfaceAlt },
  body: { padding: 20 },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  kind: { fontWeight: '700', fontSize: 13, letterSpacing: 0.8 },
  title: { fontSize: 26, fontFamily: FONT.display, letterSpacing: -0.6, lineHeight: 30, color: c.text, marginTop: 6, marginBottom: 12 },
  text: { fontSize: 15, lineHeight: 22, color: c.text },
  muted: { fontSize: 15, color: c.textMuted },
  loader: { marginTop: 16 },
  sourceRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  source: { color: c.textMuted, fontWeight: '600' },
});
