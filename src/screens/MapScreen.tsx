import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, StyleSheet, View } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LocationSubscription } from 'expo-location';
import {
  Camera,
  Map,
  UserLocation,
  type CameraRef,
  type MapRef,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import type { NativeSyntheticEvent } from 'react-native';
import FogOverlay, { type LivePosition } from '../components/FogOverlay';
import PoiMarkers from '../components/PoiMarkers';
import DiscoveryCard from '../components/DiscoveryCard';
import PlacesPanel from '../components/PlacesPanel';
import { usePlaces } from '../hooks/usePlaces';
import {
  FOG_COLORS,
  FOG_STYLE_LABELS,
  getFogStyle,
  nextFogStyle,
  setFogStyle,
  type FogStyle,
} from '../lib/settings/fogStyle';
import type { MapView } from '../lib/geo/projection';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';
import { stopForegroundTracking } from '../services/locationTracker';
import { stopBackgroundTracking } from '../services/backgroundLocationTask';
import { signOut, signOutLocal } from '../lib/supabase/auth';
import { performSignOut } from '../lib/session/signOutFlow';

const FOLLOW_ZOOM = 16;
const FOLLOW_EASE_MS = 900;
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export interface MapScreenProps {
  points: VisitedPoint[];
  livePosition: LivePosition | null;
  userId: string;
  client: SupabaseClient;
  subscription: LocationSubscription | null;
  onSignedOut: () => void;
}

export default function MapScreen({ points, livePosition, userId, client, subscription, onSignedOut }: MapScreenProps) {
  const mapRef = useRef<MapRef>(null) as React.RefObject<MapRef>;
  const cameraRef = useRef<CameraRef>(null);
  const hasCenteredRef = useRef(false);
  const [following, setFollowing] = useState(true);
  const [view, setView] = useState<MapView | null>(null);
  const [fogStyle, setFogStyleState] = useState<FogStyle>('ink');
  const { pois, discoveredIds, greeting, dismissGreeting } = usePlaces({
    client,
    userId,
    view,
    livePosition,
  });

  useEffect(() => {
    void getFogStyle(AsyncStorage).then(setFogStyleState);
  }, []);

  function handleCycleFogStyle() {
    const next = nextFogStyle(fogStyle);
    setFogStyleState(next);
    void setFogStyle(AsyncStorage, next);
  }

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
    setView({ center, zoom, bearing });
  }

  async function handleMapLoaded() {
    try {
      const state = await mapRef.current?.getViewState();
      if (state) setView({ center: state.center, zoom: state.zoom, bearing: state.bearing });
    } catch {
      // The native map isn't ready yet; region events will provide the view.
    }
  }

  async function handleSignOut() {
    await performSignOut({
      stopForeground: () => stopForegroundTracking(subscription),
      stopBackground: stopBackgroundTracking,
      signOutRemote: () => signOut(client),
      signOutLocal: () => signOutLocal(client),
      onSignedOut,
      onWarn: (message, err) => console.warn('[sign-out]', message, err),
    });
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
      <FogOverlay
        points={points}
        livePosition={livePosition}
        view={view}
        fogColor={FOG_COLORS[fogStyle]}
      />
      <PoiMarkers pois={pois} discoveredIds={discoveredIds} view={view} />
      <PlacesPanel pois={pois} discoveredIds={discoveredIds} origin={livePosition} />
      <View style={styles.fogStyleContainer}>
        <Button title={`Туман: ${FOG_STYLE_LABELS[fogStyle]}`} onPress={handleCycleFogStyle} />
      </View>
      <DiscoveryCard place={greeting} onDismiss={dismissGreeting} />
      {!following && (
        <View style={styles.recenterContainer}>
          <Button title="К моей позиции" onPress={handleRecenter} />
        </View>
      )}
      <View style={styles.signOutContainer}>
        <Button title="Выйти" onPress={() => void handleSignOut()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  signOutContainer: { position: 'absolute', top: 8, right: 8 },
  fogStyleContainer: { position: 'absolute', bottom: 24, right: 8 },
  recenterContainer: { position: 'absolute', bottom: 72, alignSelf: 'center' },
});
