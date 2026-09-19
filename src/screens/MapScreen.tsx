import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type NativeSyntheticEvent } from 'react-native';
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
import PoiMarkers from '../components/PoiMarkers';
import SvgIcon from '../components/icons/SvgIcon';
import type { MapView } from '../lib/geo/projection';
import type { Poi } from '../lib/poi/types';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';

const FOLLOW_ZOOM = 16;
const FOLLOW_EASE_MS = 900;
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export interface MapScreenProps {
  points: VisitedPoint[];
  livePosition: LivePosition | null;
  pois: Poi[];
  discoveredIds: ReadonlySet<string>;
  fog: FogPalette;
  view: MapView | null;
  onViewChange: (view: MapView) => void;
}

export default function MapScreen({
  points,
  livePosition,
  pois,
  discoveredIds,
  fog,
  view,
  onViewChange,
}: MapScreenProps) {
  const mapRef = useRef<MapRef>(null) as React.RefObject<MapRef>;
  const cameraRef = useRef<CameraRef>(null);
  const hasCenteredRef = useRef(false);
  const [following, setFollowing] = useState(true);

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

  function handleRegion(e: NativeSyntheticEvent<ViewStateChangeEvent>) {
    const { center, zoom, bearing, userInteraction } = e.nativeEvent;
    if (userInteraction) setFollowing(false);
    onViewChange({ center, zoom, bearing });
  }

  async function handleMapLoaded() {
    try {
      const state = await mapRef.current?.getViewState();
      if (state) onViewChange({ center: state.center, zoom: state.zoom, bearing: state.bearing });
    } catch {
      // The native map isn't ready yet; region events will provide the view.
    }
  }

  return (
    <View style={styles.container}>
      <Map
        ref={mapRef}
        style={styles.map}
        mapStyle={MAP_STYLE_URL}
        touchPitch={false}
        onDidFinishLoadingMap={() => void handleMapLoaded()}
        onRegionIsChanging={handleRegion}
        onRegionDidChange={handleRegion}
      >
        <Camera ref={cameraRef} initialViewState={{ zoom: FOLLOW_ZOOM }} />
        <UserLocation />
      </Map>
      <FogOverlay points={points} livePosition={livePosition} view={view} fog={fog} />
      <PoiMarkers pois={pois} discoveredIds={discoveredIds} view={view} />
      {!following && (
        <Pressable
          style={styles.recenter}
          onPress={handleRecenter}
          accessibilityRole="button"
          accessibilityLabel="К моей позиции"
        >
          <SvgIcon name="locate" size={24} color="#262626" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  recenter: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
