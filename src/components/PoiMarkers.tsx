import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { projectToScreen, type MapView, type Size } from '../lib/geo/projection';
import { readView, type ViewShared } from '../lib/map/viewShared';
import { KIND_LABEL } from '../lib/poi/greeting';
import KindIcon from './KindIcon';
import type { Poi } from '../lib/poi/types';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { KIND_COLOR } from '../lib/poi/kindColors';

export interface PoiMarkersProps {
  pois: Poi[];
  discoveredIds: ReadonlySet<string>;
  // The slow copy of the view picks which markers exist; the shared view moves them every frame.
  view: MapView | null;
  shared: ViewShared;
  selectedId?: string | null;
  onSelect?: (poi: Poi) => void;
  onOpenFound?: (poi: Poi) => void;
}

const MAX_MARKERS = 60;
// Wide, because the list is refreshed a few times a second while the map keeps moving under the markers.
const MARGIN_PX = 400;

interface MarkerAnchorProps {
  shared: ViewShared;
  lng: number;
  lat: number;
  children: React.ReactNode;
}

// Positions itself from the shared view on the UI thread, so it stays glued to the map while it is dragged.
function MarkerAnchor({ shared, lng, lat, children }: MarkerAnchorProps) {
  const style = useAnimatedStyle(() => {
    const v = readView(shared);
    const p = projectToScreen(lng, lat, { center: [v.lng, v.lat], zoom: v.zoom, bearing: v.bearing }, { width: v.width, height: v.height });
    return { transform: [{ translateX: p.x - 60 }, { translateY: p.y - 16 }] };
  });
  return (
    <Animated.View pointerEvents="box-none" style={[markerStyles.anchor, style]}>
      {children}
    </Animated.View>
  );
}

const markerStyles = StyleSheet.create({
  anchor: { position: 'absolute', left: 0, top: 0, width: 120, alignItems: 'center' },
});

export default function PoiMarkers({
  pois,
  discoveredIds,
  view,
  shared,
  selectedId = null,
  onSelect,
  onOpenFound,
}: PoiMarkersProps) {
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
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
          <MarkerAnchor key={poi.id} shared={shared} lng={poi.lng} lat={poi.lat}>
            <Pressable
              onPress={() => onOpenFound?.(poi)}
              hitSlop={8}
              style={styles.found}
              accessibilityRole="button"
              accessibilityLabel={poi.name}
            >
              <KindIcon kind={poi.kind} size={18} color={c.foundIcon} />
            </Pressable>
            {showLabel && (
              <Text style={styles.label} numberOfLines={1} pointerEvents="none">
                {poi.name}
              </Text>
            )}
          </MarkerAnchor>
        ) : (
          <MarkerAnchor key={poi.id} shared={shared} lng={poi.lng} lat={poi.lat}>
            <Pressable
              onPress={() => onSelect?.(poi)}
              hitSlop={8}
              style={[styles.unknown, poi.id === selectedId && styles.selected]}
              accessibilityRole="button"
              accessibilityLabel={KIND_LABEL[poi.kind]}
            >
              <KindIcon kind={poi.kind} size={18} color={KIND_COLOR[poi.kind]} />
            </Pressable>
          </MarkerAnchor>
        )
      )}
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  unknown: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  selected: { borderWidth: 3, borderColor: c.accent, transform: [{ scale: 1.25 }] },
  unknownMark: { fontSize: 18, fontWeight: '800', color: '#1f2937' },
  found: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.foundFill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.foundBorder,
  },
  label: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: c.text,
    textShadowColor: c.bg,
    textShadowRadius: 4,
  },
});
