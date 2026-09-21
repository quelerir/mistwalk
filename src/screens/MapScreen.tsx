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
import FogOverlay, { LIVE_GLIDE_MS, type LivePosition } from '../components/FogOverlay';
import { routeProgress } from '../lib/routing/progress';
import RouteOverlay from '../components/RouteOverlay';
import PlaceCard from '../components/PlaceCard';
import RouteCard from '../components/RouteCard';
import type { RouteStatus } from '../hooks/useRoute';
import type { WalkingRoute } from '../lib/routing/walkingRoute';
import PoiMarkers from '../components/PoiMarkers';
import SvgIcon from '../components/icons/SvgIcon';
import type { MapView } from '../lib/geo/projection';
import { useMapStyle } from '../hooks/useMapStyle';
import { useViewShared, writeView } from '../lib/map/viewShared';
import type { Poi, PoiKind } from '../lib/poi/types';
import type { PlacesStatus } from '../lib/poi/placesStatus';
import PlacesStatusPill from '../components/PlacesStatusPill';
import MapKindFilter from '../components/MapKindFilter';
import ClusterList from '../components/ClusterList';
import { DETAIL_ZOOM } from '../lib/poi/markerPicker';
import { countByKind, filterByKinds } from '../lib/poi/kindFilter';
import type { Wind } from '../lib/weather/weather';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { useT } from '../i18n/I18nProvider';

const FOLLOW_ZOOM = 16;
const FOLLOW_EASE_MS = LIVE_GLIDE_MS;
const VIEW_PUBLISH_MS = 250;
const CLUSTER_ZOOM_STEP = 2;
const MAX_CLUSTER_ZOOM = 19;

export interface MapScreenProps {
  points: VisitedPoint[];
  livePosition: LivePosition | null;
  pois: Poi[];
  discoveredIds: ReadonlySet<string>;
  fog: FogPalette;
  fogAnimated: boolean;
  rain: number;
  wind: Wind | null;
  placesStatus: PlacesStatus;
  // Kinds of places switched off in the filter on the map.
  hiddenKinds: ReadonlySet<PoiKind>;
  onHiddenKindsChange: (next: Set<PoiKind>) => void;
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
  placesStatus,
  hiddenKinds,
  onHiddenKindsChange,
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
  const t = useT();
  const styles = useStyles(makeStyles);
  const { colors: c, scheme } = useTheme();
  const mapStyle = useMapStyle(scheme);
  const mapRef = useRef<MapRef>(null) as React.RefObject<MapRef>;
  const cameraRef = useRef<CameraRef>(null);
  const shared = useViewShared();
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingView = useRef<MapView | null>(null);
  const hasCenteredRef = useRef(false);
  const [following, setFollowing] = useState(true);
  const [clusterPois, setClusterPois] = useState<Poi[] | null>(null);
  const fittedFor = useRef<string | null>(null);
  const progress = useMemo(
    () => (route && livePosition ? routeProgress(route, livePosition) : null),
    [route, livePosition]
  );
  const routeTargetId = routing && selected ? selected.id : null;


  const kindCounts = useMemo(() => countByKind(pois), [pois]);
  // The place picked from the list is shown even when its kind is switched off.
  const shownPois = useMemo(() => {
    const filtered = filterByKinds(pois, hiddenKinds);
    return selected && !filtered.some((p) => p.id === selected.id) ? [...filtered, selected] : filtered;
  }, [pois, hiddenKinds, selected]);

  // Bring a picked place into view. The native camera doesn't exist while the tab is hidden,
  // so wait until the map is on screen.
  const selectedId = selected?.id ?? null;
  // The list of places on one spot goes away when something else is picked or the map is left.
  useEffect(() => {
    setClusterPois(null);
  }, [selectedId, routing, active]);
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
    // The map is not there yet while its style is being looked up.
    if (!livePosition || !following || !mapStyle) return;
    const center: [number, number] = [livePosition.lng, livePosition.lat];
    if (!hasCenteredRef.current) {
      hasCenteredRef.current = true;
      cameraRef.current?.jumpTo({ center, zoom: FOLLOW_ZOOM });
    } else {
      cameraRef.current?.easeTo({ center, duration: FOLLOW_EASE_MS });
    }
  }, [livePosition, following, mapStyle]);

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

  // Tapping a cluster zooms in on it; the places come apart as they get farther apart on the screen. Zoomed in already
  // (places on the same spot), it lists them instead.
  function handleClusterPress({ lng, lat, pois: members }: { lng: number; lat: number; pois: Poi[] }) {
    if ((view?.zoom ?? 0) >= DETAIL_ZOOM) {
      setClusterPois(members);
      return;
    }
    setFollowing(false);
    cameraRef.current?.easeTo({ center: [lng, lat], zoom: Math.min(MAX_CLUSTER_ZOOM, (view?.zoom ?? FOLLOW_ZOOM) + CLUSTER_ZOOM_STEP), duration: 500 });
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
      {mapStyle && (
        <Map
          ref={mapRef}
          style={styles.map}
          mapStyle={mapStyle}
          touchPitch={false}
          onDidFinishLoadingMap={() => void handleMapLoaded()}
          onRegionIsChanging={(e) => handleRegion(e, false)}
          onRegionDidChange={(e) => handleRegion(e, true)}
        >
          <Camera ref={cameraRef} initialViewState={{ zoom: FOLLOW_ZOOM }} />
          {Platform.OS !== 'android' && <UserLocation />}
        </Map>
      )}
      {/* The map stays mounted under the other tabs; its fog and rain must not keep drawing frames nobody sees. */}
      <FogOverlay points={points} livePosition={livePosition} shared={shared} view={view} fog={fog} animated={fogAnimated && active} rain={active ? rain : 0} wind={wind} userDot={Platform.OS === 'android'} />
      <RouteOverlay coordinates={progress?.coordinates ?? route?.coordinates ?? null} shared={shared} />
      <PoiMarkers
        pois={shownPois}
        discoveredIds={discoveredIds}
        view={view}
        shared={shared}
        selectedId={selectedId}
        onSelect={onSelect}
        onOpenFound={onOpenFound}
        onClusterPress={handleClusterPress}
      />
      {clusterPois && !routing && !selected && active && (
        <ClusterList
          pois={clusterPois}
          foundIds={discoveredIds}
          onPick={(poi) => {
            setClusterPois(null);
            if (discoveredIds.has(poi.id)) onOpenFound(poi);
            else onSelect(poi);
          }}
          onClose={() => setClusterPois(null)}
        />
      )}
      {routing ? (
        <RouteCard
          status={routeStatus}
          route={route}
          remainingMeters={progress?.remainingMeters}
          remainingSeconds={progress?.remainingSeconds}
          title={selected ? t('map.routeTo', { name: selected.name }) : t('map.route')}
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
      {active && <PlacesStatusPill status={placesStatus} />}
      {active && <MapKindFilter counts={kindCounts} hidden={hiddenKinds} onChange={onHiddenKindsChange} />}
      {!following && (
        <Pressable
          style={styles.recenter}
          onPress={handleRecenter}
          accessibilityRole="button"
          accessibilityLabel={t('map.recenter')}
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
