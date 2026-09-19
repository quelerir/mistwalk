import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { projectToScreen, type MapView, type Size } from '../lib/geo/projection';
import { KIND_ICON } from '../lib/poi/greeting';
import type { Poi } from '../lib/poi/types';

export interface PoiMarkersProps {
  pois: Poi[];
  discoveredIds: ReadonlySet<string>;
  view: MapView | null;
  selectedId?: string | null;
  onSelect?: (poi: Poi) => void;
}

const MAX_MARKERS = 60;
const MARGIN_PX = 30;

export default function PoiMarkers({
  pois,
  discoveredIds,
  view,
  selectedId = null,
  onSelect,
}: PoiMarkersProps) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  const visible = useMemo(() => {
    if (!view || size.width === 0) return [];
    const result: Array<{ poi: Poi; x: number; y: number; showLabel: boolean }> = [];
    const placed: Array<{ l: number; t: number; r: number; b: number }> = [];
    for (const poi of pois) {
      const { x, y } = projectToScreen(poi.lng, poi.lat, view, size);
      if (x < -MARGIN_PX || x > size.width + MARGIN_PX || y < -MARGIN_PX || y > size.height + MARGIN_PX) {
        continue;
      }
      let showLabel = false;
      if (discoveredIds.has(poi.id)) {
        const w = Math.min(120, poi.name.length * 7 + 8);
        const rect = { l: x - w / 2, t: y + 18, r: x + w / 2, b: y + 34 };
        showLabel = !placed.some((o) => rect.l < o.r && rect.r > o.l && rect.t < o.b && rect.b > o.t);
        if (showLabel) placed.push(rect);
      }
      result.push({ poi, x, y, showLabel });
      if (result.length >= MAX_MARKERS) break;
    }
    return result;
  }, [pois, discoveredIds, view, size]);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onLayout}>
      {visible.map(({ poi, x, y, showLabel }) =>
        discoveredIds.has(poi.id) ? (
          <View key={poi.id} pointerEvents="none" style={[styles.anchor, { left: x - 60, top: y - 16 }]}>
            <View style={styles.found}>
              <Text style={styles.foundIcon}>{KIND_ICON[poi.kind]}</Text>
            </View>
            {showLabel && (
              <Text style={styles.label} numberOfLines={1}>
                {poi.name}
              </Text>
            )}
          </View>
        ) : (
          <View key={poi.id} pointerEvents="box-none" style={[styles.anchor, { left: x - 60, top: y - 16 }]}>
            <Pressable
              onPress={() => onSelect?.(poi)}
              hitSlop={8}
              style={[styles.unknown, poi.id === selectedId && styles.selected]}
              accessibilityRole="button"
              accessibilityLabel="Тайное место"
            >
              <Text style={styles.unknownMark}>?</Text>
            </Pressable>
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', width: 120, alignItems: 'center' },
  unknown: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 200, 60, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ffc83c',
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  selected: { borderWidth: 3, borderColor: '#ffffff', transform: [{ scale: 1.25 }] },
  unknownMark: { fontSize: 18, fontWeight: '800', color: '#3a2a00' },
  found: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  foundIcon: { fontSize: 18, color: '#1d4ed8' },
  label: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: '#111',
    textShadowColor: 'white',
    textShadowRadius: 4,
  },
});
