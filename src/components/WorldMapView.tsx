import React, { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, type NativeSyntheticEvent } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map as MapLibreMap } from '@maplibre/maplibre-react-native';
import type { CountryStat } from '../lib/geo/countryStats';
import { fillColorExpression, levelColors, waterColor } from '../lib/geo/worldMapColors';
import { useTheme } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';

export interface WorldMapViewProps {
  countries: CountryStat[];
  pending: boolean;
  onOpenCountry: (country: CountryStat) => void;
}

interface Collection {
  type: 'FeatureCollection';
  features: Array<{ properties: { code: string } }>;
}

interface PressEventLike {
  features?: Array<{ properties?: { code?: string } | null }>;
}

// The default hitbox is 44 px, which would pick a neighbour at a border: keep it tight.
const HIT_COUNTRY = { top: 1, left: 1, bottom: 1, right: 1 };

// Loaded here, not at app start: the file is large and only this view needs it.
function loadBorders(): Collection | null {
  try {
    return require('../assets/world.json');
  } catch (err) {
    console.warn('[world-map] border data failed to load', err);
    return null;
  }
}

export default function WorldMapView({ countries, onOpenCountry }: WorldMapViewProps) {
  const { colors: c, scheme } = useTheme();
  const { t } = useI18n();
  const borders = useMemo(loadBorders, []);
  const byCode = useMemo(() => new Map(countries.map((s) => [s.code, s])), [countries]);
  const fill = useMemo(() => fillColorExpression(countries, scheme), [countries, scheme]);
  const palette = levelColors(scheme);
  const water = waterColor(scheme);
  const mapStyle = useMemo(
    () => ({
      version: 8 as const,
      sources: {},
      layers: [{ id: 'water', type: 'background' as const, paint: { 'background-color': water } }],
    }),
    [water]
  );

  // The native source takes text; handing it an object makes the library stringify 600 KB on every render
  // (each GPS fix re-renders the screen), so the text is made once.
  const polygonsText = useMemo(() => (borders ? JSON.stringify(borders) : ''), [borders]);

  // Stable across renders: the latest stats and callback are read from refs at press time.
  const latest = useRef({ byCode, onOpenCountry });
  latest.current = { byCode, onOpenCountry };
  const handlePress = useCallback((e: NativeSyntheticEvent<PressEventLike>) => {
    const code = e.nativeEvent.features?.[0]?.properties?.code;
    const stat = code ? latest.current.byCode.get(code) : undefined;
    if (stat) latest.current.onOpenCountry(stat);
  }, []);

  const fillPaint = useMemo(() => ({ 'fill-color': fill as never }), [fill]);
  const borderPaint = useMemo(() => ({ 'line-color': water, 'line-width': 0.5 }), [water]);

  if (!borders) {
    return <Text style={[styles.failed, { color: c.textMuted }]}>{t('worldMap.loadFailed')}</Text>;
  }

  const legend = [
    { color: palette[0], label: t('worldMap.legend.none') },
    { color: palette[1], label: t('worldMap.legend.low') },
    { color: palette[2], label: t('worldMap.legend.mid') },
    { color: palette[3], label: t('worldMap.legend.high') },
  ];

  return (
    <View style={styles.container}>
      <MapLibreMap
        style={styles.map}
        mapStyle={mapStyle}
        touchRotate={false}
        touchPitch={false}
        attribution={false}
        logo={false}
        compass={false}
      >
        <Camera initialViewState={{ center: [10, 20], zoom: -0.3 }} minZoom={-1} maxZoom={6} />
        <GeoJSONSource id="world" data={polygonsText} onPress={handlePress} hitbox={HIT_COUNTRY}>
          <Layer id="world-fill" type="fill" paint={fillPaint} />
          <Layer id="world-border" type="line" paint={borderPaint} />
        </GeoJSONSource>
      </MapLibreMap>
      <View style={[styles.legend, { backgroundColor: c.bg }]}>
        {legend.map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: item.color, borderColor: c.borderStrong }]} />
            <Text style={[styles.legendText, { color: c.textMuted }]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  failed: { marginTop: 24, paddingHorizontal: 16, textAlign: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, paddingHorizontal: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  swatch: { width: 14, height: 14, borderRadius: 3, borderWidth: StyleSheet.hairlineWidth, marginRight: 6 },
  legendText: { fontSize: 13 },
});
