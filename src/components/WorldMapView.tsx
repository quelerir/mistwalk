import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type NativeSyntheticEvent } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map as MapLibreMap } from '@maplibre/maplibre-react-native';
import { COUNTRY_BY_CODE } from '../lib/geo/countries';
import type { CountryStat } from '../lib/geo/countryStats';
import { fillColorExpression, levelColors, SMALL_COUNTRY_KM2, waterColor } from '../lib/geo/worldMapColors';
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

// The default hitbox is 44 px: a dot next to a big country would steal the tap, so both are kept tight.
const HIT_COUNTRY = { top: 1, left: 1, bottom: 1, right: 1 };
const HIT_DOT = { top: 8, left: 8, bottom: 8, right: 8 };

// Loaded here, not at app start: the file is large and only this view needs it.
function loadBorders(): { polygons: Collection; points: Collection } | null {
  try {
    return { polygons: require('../assets/world.json'), points: require('../assets/world-points.json') };
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
  const smallPoints = useMemo(() => {
    if (!borders) return null;
    return {
      ...borders.points,
      features: borders.points.features.filter((f) => {
        const area = COUNTRY_BY_CODE[f.properties.code]?.areaKm2;
        return area !== undefined && area < SMALL_COUNTRY_KM2;
      }),
    };
  }, [borders]);

  if (!borders || !smallPoints) {
    return <Text style={[styles.failed, { color: c.textMuted }]}>{t('worldMap.loadFailed')}</Text>;
  }

  const handlePress = (e: NativeSyntheticEvent<PressEventLike>) => {
    const code = e.nativeEvent.features?.[0]?.properties?.code;
    const stat = code ? byCode.get(code) : undefined;
    if (stat) onOpenCountry(stat);
  };

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
        <GeoJSONSource id="world" data={borders.polygons as never} onPress={handlePress} hitbox={HIT_COUNTRY}>
          <Layer id="world-fill" type="fill" paint={{ 'fill-color': fill as never }} />
          <Layer id="world-border" type="line" paint={{ 'line-color': water, 'line-width': 0.5 }} />
        </GeoJSONSource>
        <GeoJSONSource id="world-points" data={smallPoints as never} onPress={handlePress} hitbox={HIT_DOT}>
          <Layer
            id="world-dots"
            type="circle"
            paint={{ 'circle-color': fill as never, 'circle-radius': 3.5, 'circle-stroke-color': c.textMuted, 'circle-stroke-width': 0.5 }}
          />
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
