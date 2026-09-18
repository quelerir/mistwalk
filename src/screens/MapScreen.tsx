import React, { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LocationSubscription } from 'expo-location';
import Mapbox, { Camera, MapView, UserLocation } from '@rnmapbox/maps';
import FogOverlay from '../components/FogOverlay';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';
import { stopForegroundTracking } from '../services/locationTracker';
import { stopBackgroundTracking } from '../services/backgroundLocationTask';
import { signOut } from '../lib/supabase/auth';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

if (MAPBOX_ACCESS_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
}

const CAMERA_DEBOUNCE_MS = 150;

export interface MapScreenProps {
  points: VisitedPoint[];
  client: SupabaseClient;
  subscription: LocationSubscription | null;
  onSignedOut: () => void;
}

export default function MapScreen({ points, client, subscription, onSignedOut }: MapScreenProps) {
  const mapRef = useRef<MapView>(null) as React.RefObject<MapView>;
  const cameraRef = useRef<Camera>(null);
  const [regionVersion, setRegionVersion] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!MAPBOX_ACCESS_TOKEN) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Ошибка конфигурации: проверьте .env файл (Mapbox)</Text>
        </View>
      </View>
    );
  }

  async function handleSignOut() {
    stopForegroundTracking(subscription);
    await stopBackgroundTracking();
    await signOut(client);
    onSignedOut();
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        onCameraChanged={() => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            setRegionVersion((v) => v + 1);
          }, CAMERA_DEBOUNCE_MS);
        }}
      >
        <Camera ref={cameraRef} followUserLocation followZoomLevel={16} />
        <UserLocation visible showsUserHeadingIndicator />
      </MapView>
      <FogOverlay points={points} mapRef={mapRef} regionVersion={regionVersion} />
      <View style={styles.signOutContainer}>
        <Button title="Выйти" onPress={() => void handleSignOut()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { textAlign: 'center', fontSize: 16 },
  signOutContainer: { position: 'absolute', top: 8, right: 8 },
});
