import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type NativeSyntheticEvent, Platform } from 'react-native';
import {
  Camera,
  Map,
  UserLocation,
  type CameraRef,
  type MapRef,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import type { FogPalette } from '../lib/settings/fogStyle';
import FogOverlay, { type LivePosition } from '../components/FogOverlay';
import { routeProgress } from '../lib/routing/progress';
import RouteOverlay from '../components/RouteOverlay';
import PlaceCard from '../components/PlaceCard';
import RouteCard from '../components/RouteCard';
import type { RouteStatus } from '../hooks/useRoute';
import type { WalkingRoute } from '../lib/routing/walkingRoute';
import PoiMarkers from '../components/PoiMarkers';
import SvgIcon from '../components/icons/SvgIcon';
import type { MapView } from '../lib/geo/projection';
import { MAP_STYLES } from '../lib/map/styles';
import { useViewShared, writeView } from '../lib/map/viewShared';
import type { Poi } from '../lib/poi/types';
import type { Wind } from '../lib/weather/weather';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';

const FOLLOW_ZOOM = 16;
const FOLLOW_EASE_MS = 900;
const VIEW_PUBLISH_MS = 250;

export interface MapScreenProps {
  points: VisitedPoint[];
  livePosition: LivePosition | null;
  pois: Poi[];
  discoveredIds: ReadonlySet<string>;
  fog: FogPalette;
  fogAnimated: boolean;
  rain: number;
  wind: Wind | null;
  view: MapView | null;
  onViewChange: (view: MapView) => void;
  route: WalkingRoute | null;
  routeStatus: RouteStatus;
  active: boolean;
  selected: Poi | null;
  routing: boolean;
  onSelect: (poi: Poi) => void;
  onOpenFound: (poi: Poi) => void;
  onCloseSelected: () => void;
  onBuildRoute: () => void;
  onCancelRoute: () => void;
}

export default function MapScreen({
  points,
  livePosition,
  pois,
  discoveredIds,
  fog,
  fogAnimated,
  rain,
  wind,
  view,
  onViewChange,
  route,
  routeStatus,
  active,
  selected,
  routing,
  onSelect,
  onOpenFound,
  onCloseSelected,
  onBuildRoute,
  onCancelRoute,
}: MapScreenProps) {
  const styles = useStyles(makeStyles);
  const { colors: c, scheme } = useTheme();
  const mapRef = useRef<MapRef>(null) as React.RefObject<MapRef>;
  const cameraRef = useRef<CameraRef>(null);
  const shared = useViewShared();
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingView = useRef<MapView | null>(null);
  const hasCenteredRef = useRef(false);
  const [following, setFollowing] = useState(true);
  const fittedFor = useRef<string | null>(null);
  const progress = useMemo(
    () => (route && livePosition ? routeProgress(route, livePosition) : null),
    [route, livePosition]
  );
  const routeTargetId = routing && selected ? selected.id : null;

  // Bring a picked place into view. The native camera doesn't exist while the tab is hidden,
  // so wait until the map is on screen.
  const selectedId = selected?.id ?? null;
  useEffect(() => {
    if (!selected || !active) return;
    setFollowing(false);
    const timer = setTimeout(() => {
      cameraRef.current?.easeTo({ center: [selected.lng, selected.lat], duration: 600 });
    }, 80);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, active]);

  // Frame the whole route once per destination; reroutes must not steal the camera again.
  useEffect(() => {
    if (!routeTargetId) {
      fittedFor.current = null;
      return;
    }
    if (!route || fittedFor.current === routeTargetId) return;
    fittedFor.current = routeTargetId;
    const lngs = route.coordinates.map((c) => c[0]);
    const lats = route.coordinates.map((c) => c[1]);
    setFollowing(false);
    cameraRef.current?.fitBounds(
      [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
      { padding: { top: 90, right: 60, bottom: 110, left: 60 }, duration: 800 }
    );
  }, [route, routeTargetId]);

  useEffect(() => {
    if (!livePosition || !following) return;
    const center: [number, number] = [livePosition.lng, livePosition.lat];
    if (!hasCenteredRef.current) {
      hasCenteredRef.current = true;
      cameraRef.current?.jumpTo({ center, zoom: FOLLOW_ZOOM });
    } else {
      cameraRef.current?.easeTo({ center, duration: FOLLOW_EASE_MS });
    }
  }, [livePosition, following]);

  function handleRecenter() {
    hasCenteredRef.current = false;
    setFollowing(true);
  }

  // The overlays read the view from shared values on every frame; the rest of the app gets a copy a few times a
  // second while the map moves (and at once when it settles), so panning does not re-render the screens.
  function flushView() {
    if (publishTimer.current) clearTimeout(publishTimer.current);
    publishTimer.current = null;
    if (pendingView.current) onViewChange(pendingView.current);
    pendingView.current = null;
  }

  function handleRegion(e: NativeSyntheticEvent<ViewStateChangeEvent>, settled: boolean) {
    const { center, zoom, bearing, userInteraction } = e.nativeEvent;
    if (userInteraction) setFollowing(false);
    const next = { center, zoom, bearing };
    writeView(shared, next);
    pendingView.current = next;
    if (settled) flushView();
    else if (!publishTimer.current) publishTimer.current = setTimeout(flushView, VIEW_PUBLISH_MS);
  }

  async function handleMapLoaded() {
    try {
      const state = await mapRef.current?.getViewState();
      if (state) {
        const v = { center: state.center, zoom: state.zoom, bearing: state.bearing };
        writeView(shared, v);
        onViewChange(v);
      }
    } catch {
      // The native map isn't ready yet; region events will provide the view.
    }
  }

  return (
    <View style={styles.container}>
      <Map
        ref={mapRef}
        style={styles.map}
        mapStyle={MAP_STYLES[scheme]}
        touchPitch={false}
        onDidFinishLoadingMap={() => void handleMapLoaded()}
        onRegionIsChanging={(e) => handleRegion(e, false)}
        onRegionDidChange={(e) => handleRegion(e, true)}
      >
        <Camera ref={cameraRef} initialViewState={{ zoom: FOLLOW_ZOOM }} />
        {Platform.OS !== 'android' && <UserLocation />}
      </Map>
      <FogOverlay points={points} livePosition={livePosition} shared={shared} view={view} fog={fog} animated={fogAnimated} rain={rain} wind={wind} userDot={Platform.OS === 'android'} />
      <RouteOverlay coordinates={progress?.coordinates ?? route?.coordinates ?? null} shared={shared} />
      <PoiMarkers
        pois={pois}
        discoveredIds={discoveredIds}
        view={view}
        shared={shared}
        selectedId={selectedId}
        onSelect={onSelect}
        onOpenFound={onOpenFound}
      />
      {routing ? (
        <RouteCard
          status={routeStatus}
          route={route}
          remainingMeters={progress?.remainingMeters}
          remainingSeconds={progress?.remainingSeconds}
          title={selected ? `Маршрут: ${selected.name}` : 'Маршрут'}
          onCancel={onCancelRoute}
        />
      ) : (
        selected && (
          <PlaceCard
            poi={selected}
            origin={livePosition}
            onBuildRoute={onBuildRoute}
            onClose={onCloseSelected}
          />
        )
      )}
      {!following && (
        <Pressable
          style={styles.recenter}
          onPress={handleRecenter}
          accessibilityRole="button"
          accessibilityLabel="К моей позиции"
        >
          <SvgIcon name="locate" size={24} color={c.text} />
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  map: { flex: 1 },
  recenter: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
