import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { projectToScreen, type MapView, type Size } from '../lib/geo/projection';
import { readView, type ViewShared } from '../lib/map/viewShared';
import { kindLabel } from '../lib/poi/greeting';
import { DETAIL_ZOOM, layoutMarkers, type LocatedCandidate } from '../lib/poi/markerPicker';
import KindIcon from './KindIcon';
import type { Poi } from '../lib/poi/types';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { KIND_COLOR } from '../lib/poi/kindColors';
import { useT } from '../i18n/I18nProvider';

export interface PoiMarkersProps {
  pois: Poi[];
  discoveredIds: ReadonlySet<string>;
  // The slow copy of the view picks which markers exist; the shared view moves them every frame.
  view: MapView | null;
  shared: ViewShared;
  selectedId?: string | null;
  onSelect?: (poi: Poi) => void;
  onOpenFound?: (poi: Poi) => void;
  // A cluster of places was tapped: the map zooms in on it so the places come apart.
  onClusterPress?: (cluster: { lng: number; lat: number; pois: Poi[] }) => void;
}

const MAX_MARKERS = 90;
// Places closer than this many pixels (a marker is 30 px wide) become one cluster with a count.
const CLUSTER_RADIUS_PX = 44;
// Zoomed in this far the places are metres apart; only ones on almost the same spot are joined, otherwise two places
// next to each other could never be told apart however far you zoom.
const DETAIL_RADIUS_PX = 10;
// A new place this close to one you found gives way to it.
const FOUND_CLEARANCE_PX = 30;
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
  onClusterPress,
}: PoiMarkersProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  type Shown =
    | { type: 'place'; poi: Poi; x: number; y: number; showLabel: boolean }
    | { type: 'cluster'; key: string; pois: Poi[]; lng: number; lat: number };

  const visible = useMemo(() => {
    if (!view || size.width === 0) return [];
    const byId = new Map<string, Poi>();
    const candidates: LocatedCandidate[] = [];
    let selectedPoi: { poi: Poi; x: number; y: number } | null = null;
    for (const poi of pois) {
      const { x, y } = projectToScreen(poi.lng, poi.lat, view, size);
      if (x < -MARGIN_PX || x > size.width + MARGIN_PX || y < -MARGIN_PX || y > size.height + MARGIN_PX) continue;
      // The place picked from the list stays a marker of its own, never lost inside a cluster.
      if (poi.id === selectedId) {
        selectedPoi = { poi, x, y };
        continue;
      }
      byId.set(poi.id, poi);
      candidates.push({ id: poi.id, x, y, found: discoveredIds.has(poi.id), lng: poi.lng, lat: poi.lat });
    }

    // Spread over the whole view, not "the first ones loaded" (those are the places next to you).
    const result: Shown[] = [];
    const placed: Array<{ l: number; t: number; r: number; b: number }> = [];
    if (selectedPoi) result.push({ type: 'place', poi: selectedPoi.poi, x: selectedPoi.x, y: selectedPoi.y, showLabel: false });
    for (const item of layoutMarkers(candidates, size, { radius: view.zoom >= DETAIL_ZOOM ? DETAIL_RADIUS_PX : CLUSTER_RADIUS_PX, max: MAX_MARKERS, clearance: FOUND_CLEARANCE_PX })) {
      if (item.ids.length > 1) {
        result.push({ type: 'cluster', key: `cluster:${item.ids[0]}:${item.ids.length}`, pois: item.ids.map((id) => byId.get(id)!), lng: item.lng, lat: item.lat });
        continue;
      }
      const poi = byId.get(item.ids[0])!;
      let showLabel = false;
      if (item.foundSingle) {
        const w = Math.min(120, poi.name.length * 7 + 8);
        const rect = { l: item.x - w / 2, t: item.y + 18, r: item.x + w / 2, b: item.y + 34 };
        showLabel = !placed.some((o) => rect.l < o.r && rect.r > o.l && rect.t < o.b && rect.b > o.t);
        if (showLabel) placed.push(rect);
      }
      result.push({ type: 'place', poi, x: item.x, y: item.y, showLabel });
    }
    return result;
  }, [pois, discoveredIds, view, size, selectedId]);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onLayout}>
      {visible.map((entry) => {
        if (entry.type === 'cluster') {
          return (
            <MarkerAnchor key={entry.key} shared={shared} lng={entry.lng} lat={entry.lat}>
              <Pressable
                onPress={() => onClusterPress?.({ lng: entry.lng, lat: entry.lat, pois: entry.pois })}
                hitSlop={6}
                style={styles.cluster}
                accessibilityRole="button"
                accessibilityLabel={t('map.clusterZoom', { n: entry.pois.length })}
              >
                <Text style={styles.clusterText}>{entry.pois.length > 99 ? '99+' : entry.pois.length}</Text>
              </Pressable>
            </MarkerAnchor>
          );
        }
        const { poi, showLabel } = entry;
        return discoveredIds.has(poi.id) ? (
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
              accessibilityLabel={kindLabel(t, poi.kind)}
            >
              <KindIcon kind={poi.kind} size={18} color={KIND_COLOR[poi.kind]} />
            </Pressable>
          </MarkerAnchor>
        );
      })}
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
  cluster: {
    minWidth: 38,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 6,
    // Neutral, like the markers of places not found yet: the green ring means "found" and nothing else.
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 2,
    borderColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
  },
  clusterText: { fontSize: 14, fontWeight: '800', color: '#1f2937' },
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
