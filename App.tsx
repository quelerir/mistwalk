import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getEnvSupabaseClient } from './src/lib/supabase/client';
import { getSession } from './src/lib/supabase/auth';
import { getAccuracyProfile, DISTANCE_INTERVAL_METERS } from './src/lib/settings/accuracyProfile';
import { createProgressStore } from './src/store/progressStore';
import { startForegroundTracking, stopForegroundTracking } from './src/services/locationTracker';
import {
  setBackgroundLocationHandler,
  startBackgroundTracking,
  drainPendingBackgroundPoints,
} from './src/services/backgroundLocationTask';
import { useLocationPermissions } from './src/hooks/useLocationPermissions';
import RootNavigator from './src/navigation/RootNavigator';
import MainScreen from './src/screens/MainScreen';
import OfflineBanner from './src/components/OfflineBanner';
import LocationPermissionBanner from './src/components/LocationPermissionBanner';
import type { LocationSubscription } from 'expo-location';
import type { VisitedPoint } from './src/lib/supabase/visitedPoints';

let client: SupabaseClient | null = null;
try {
  client = getEnvSupabaseClient();
} catch (err) {
  console.warn('[App] failed to initialize Supabase client', err);
}

const LIVE_POSITION_INTERVAL_METERS = 5;

export default function App() {
  if (!client) {
    return (
      <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Ошибка конфигурации: проверьте .env файл (Supabase)</Text>
        </View>
      </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return <AuthenticatedApp client={client} />;
}

function AuthenticatedApp({ client }: { client: SupabaseClient }) {
  const [session, setSession] = useState<Session | null>(null);
  const [points, setPoints] = useState<VisitedPoint[]>([]);
  const [livePosition, setLivePosition] = useState<{ lat: number; lng: number } | null>(null);
  const { stage, requestForeground, requestBackground } = useLocationPermissions();
  const subscriptionRef = useRef<LocationSubscription | null>(null);

  useEffect(() => {
    getSession(client).then(setSession).catch(() => setSession(null));
  }, []);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    let unsubscribeStore: (() => void) | null = null;
    let unsubscribeNet: (() => void) | null = null;

    void (async () => {
      // Read the accuracy profile before the store is constructed so its
      // 25m/75m radius also becomes the point-recording throttle, not just
      // the GPS distanceInterval.
      const profile = await getAccuracyProfile(AsyncStorage);
      const distanceInterval = DISTANCE_INTERVAL_METERS[profile];

      const store = createProgressStore({
        client,
        userId: session.user.id,
        throttleMeters: distanceInterval,
      });
      if (cancelled) return;

      unsubscribeStore = store.useProgressStore.subscribe((state) => setPoints(state.points));

      // Local rendering must never depend on network/disk succeeding: a
      // corrupted-storage or offline failure in either step must not block
      // permission requests and tracking from starting below.
      try {
        await store.useProgressStore.getState().loadFromDisk();
      } catch (err) {
        console.warn('[App] loadFromDisk failed, continuing in local-only mode', err);
      }

      try {
        await store.useProgressStore.getState().hydrateFromRemote();
      } catch (err) {
        console.warn('[App] hydrateFromRemote failed, continuing offline', err);
      }

      try {
        const pending = await drainPendingBackgroundPoints();
        for (const point of pending) {
          await store.useProgressStore
            .getState()
            .addPoint({ lat: point.lat, lng: point.lng }, distanceInterval);
        }
      } catch (err) {
        console.warn('[App] failed to drain pending background points', err);
      }

      if (cancelled) return;

      unsubscribeNet = NetInfo.addEventListener((state) => {
        if (state.isConnected) {
          store.queue.flush().catch(() => {});
        }
      });

      const foregroundOk = await requestForeground();
      if (!cancelled && foregroundOk) {
        subscriptionRef.current = await startForegroundTracking(
          {
            onPoint: (coord, accuracy) => {
              setLivePosition({ lat: coord.lat, lng: coord.lng });
              void store.useProgressStore
                .getState()
                .addPoint(coord, Math.max(accuracy || 0, distanceInterval));
            },
          },
          Math.min(distanceInterval, LIVE_POSITION_INTERVAL_METERS)
        );

        const backgroundOk = await requestBackground();
        if (backgroundOk) {
          setBackgroundLocationHandler((coord, accuracy) =>
            store.useProgressStore
              .getState()
              .addPoint(coord, Math.max(accuracy || 0, distanceInterval))
          );
          await startBackgroundTracking(distanceInterval);
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubscribeStore?.();
      unsubscribeNet?.();
      stopForegroundTracking(subscriptionRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.container} edges={['top']}>
      <RootNavigator client={client} session={session} onSignedIn={() => getSession(client).then(setSession)}>
        <OfflineBanner />
        <LocationPermissionBanner stage={stage} onRequestForeground={requestForeground} />
        <MainScreen
          points={points}
          livePosition={livePosition}
          userId={session?.user.id ?? ''}
          email={session?.user.email ?? ''}
          client={client}
          subscription={subscriptionRef.current}
          onSignedOut={() => setSession(null)}
        />
      </RootNavigator>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { textAlign: 'center', fontSize: 16 },
});
