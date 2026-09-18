import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEnvSupabaseClient } from './src/lib/supabase/client';
import { getSession } from './src/lib/supabase/auth';
import { getAccuracyProfile, DISTANCE_INTERVAL_METERS } from './src/lib/settings/accuracyProfile';
import { createProgressStore } from './src/store/progressStore';
import { startForegroundTracking, stopForegroundTracking } from './src/services/locationTracker';
import {
  setBackgroundLocationHandler,
  startBackgroundTracking,
} from './src/services/backgroundLocationTask';
import { useLocationPermissions } from './src/hooks/useLocationPermissions';
import RootNavigator from './src/navigation/RootNavigator';
import MapScreen from './src/screens/MapScreen';
import OfflineBanner from './src/components/OfflineBanner';
import LocationPermissionBanner from './src/components/LocationPermissionBanner';
import type { LocationSubscription } from 'expo-location';
import type { VisitedPoint } from './src/lib/supabase/visitedPoints';

const client = getEnvSupabaseClient();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [points, setPoints] = useState<VisitedPoint[]>([]);
  const { stage, requestForeground, requestBackground } = useLocationPermissions();
  const subscriptionRef = useRef<LocationSubscription | null>(null);
  const storeRef = useRef<ReturnType<typeof createProgressStore> | null>(null);

  useEffect(() => {
    getSession(client).then(setSession).catch(() => setSession(null));
  }, []);

  useEffect(() => {
    if (!session) return;

    const store = createProgressStore({ client, userId: session.user.id });
    storeRef.current = store;

    const unsubscribe = store.useProgressStore.subscribe((state) => setPoints(state.points));

    void (async () => {
      await store.useProgressStore.getState().loadFromDisk();
      await store.useProgressStore.getState().hydrateFromRemote();

      const profile = await getAccuracyProfile(AsyncStorage);
      const distanceInterval = DISTANCE_INTERVAL_METERS[profile];

      const foregroundOk = await requestForeground();
      if (foregroundOk) {
        subscriptionRef.current = await startForegroundTracking(
          { onPoint: (coord, accuracy) => void store.useProgressStore.getState().addPoint(coord, accuracy || distanceInterval) },
          distanceInterval
        );

        const backgroundOk = await requestBackground();
        if (backgroundOk) {
          setBackgroundLocationHandler((coord, accuracy) =>
            store.useProgressStore.getState().addPoint(coord, accuracy || distanceInterval)
          );
          await startBackgroundTracking(distanceInterval);
        }
      }
    })();

    return () => {
      unsubscribe();
      stopForegroundTracking(subscriptionRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  return (
    <SafeAreaView style={styles.container}>
      <RootNavigator client={client} session={session} onSignedIn={() => getSession(client).then(setSession)}>
        <OfflineBanner />
        <LocationPermissionBanner stage={stage} onRequestForeground={requestForeground} />
        <MapScreen points={points} />
      </RootNavigator>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
