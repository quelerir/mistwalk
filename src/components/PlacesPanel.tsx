import React, { useMemo, useState } from 'react';
import { Button, FlatList, Modal, StyleSheet, Text, View } from 'react-native';
import { haversineDistanceMeters } from '../lib/geo/distance';
import { bearingLabel } from '../lib/poi/discovery';
import { KIND_ICON } from '../lib/poi/greeting';
import type { Poi } from '../lib/poi/types';

export interface PlacesPanelProps {
  pois: Poi[];
  discoveredIds: ReadonlySet<string>;
  origin: { lat: number; lng: number } | null;
}

const MAX_LISTED = 30;
const NEARBY_RADIUS_METERS = 1000;

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} м` : `${(meters / 1000).toFixed(1)} км`;
}

export default function PlacesPanel({ pois, discoveredIds, origin }: PlacesPanelProps) {
  const [open, setOpen] = useState(false);

  const nearby = useMemo(() => {
    if (!origin) return [];
    return pois
      .filter((p) => !discoveredIds.has(p.id))
      .map((p) => ({ poi: p, meters: haversineDistanceMeters(origin, p) }))
      .filter((p) => p.meters <= NEARBY_RADIUS_METERS)
      .sort((a, b) => a.meters - b.meters)
      .slice(0, MAX_LISTED);
  }, [pois, discoveredIds, origin]);

  return (
    <>
      <View style={styles.buttonWrap}>
        <Button title="Рядом" onPress={() => setOpen(true)} />
      </View>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Рядом, ещё не открыто</Text>
            <Button title="Закрыть" onPress={() => setOpen(false)} />
          </View>
          {nearby.length === 0 ? (
            <Text style={styles.empty}>
              {origin ? 'В радиусе километра всё открыто. Пройдитесь дальше!' : 'Ждём вашу позицию…'}
            </Text>
          ) : (
            <FlatList
              data={nearby}
              keyExtractor={(item) => item.poi.id}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <Text style={styles.icon}>{KIND_ICON[item.poi.kind]}</Text>
                  <Text style={styles.name}>Тайное место</Text>
                  <Text style={styles.distance}>
                    {formatDistance(item.meters)}, {bearingLabel(origin!, item.poi)}
                  </Text>
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  buttonWrap: { position: 'absolute', bottom: 24, left: 8 },
  sheet: { flex: 1, padding: 16, backgroundColor: 'white' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800' },
  empty: { marginTop: 24, textAlign: 'center', color: '#555' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ccc' },
  icon: { fontSize: 22, marginRight: 10 },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
  distance: { color: '#555' },
});
