import React, { useEffect, useRef, useState } from 'react';
import { useFonts } from 'expo-font';
import { Linking, StatusBar, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';
import { FONT_ASSETS } from './src/theme/fonts';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { getEnvSupabaseClient } from './src/lib/supabase/client';
import { getSession } from './src/lib/supabase/auth';
import { getAccuracyProfile, onAccuracyProfileChange, DISTANCE_INTERVAL_METERS } from './src/lib/settings/accuracyProfile';
import { createProgressStore } from './src/store/progressStore';
import { startForegroundTracking, stopForegroundTracking } from './src/services/locationTracker';
import {
  setBackgroundLocationHandler,
  startBackgroundTracking,
  stopBackgroundTracking,
  BACKGROUND_LOCATION_TASK,
  drainPendingBackgroundPoints,
} from './src/services/backgroundLocationTask';
import { useLocationPermissions } from './src/hooks/useLocationPermissions';
import RootNavigator from './src/navigation/RootNavigator';
import MainScreen from './src/screens/MainScreen';
import BackgroundPermissionPrompt from './src/components/BackgroundPermissionPrompt';
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
const BACKGROUND_PERMISSION_POLLS = 12;
const BACKGROUND_PROMPT_DISMISSED_KEY = 'permissions.backgroundPrompt.dismissed.v1';

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
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

  // Titles use a bundled font; a failed load falls back to the system font instead of blocking.
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider>
      <AuthenticatedApp client={client} />
    </ThemeProvider>
  );
}

function AuthenticatedApp({ client }: { client: SupabaseClient }) {
  const { colors, scheme } = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [points, setPoints] = useState<VisitedPoint[]>([]);
  const [livePosition, setLivePosition] = useState<{ lat: number; lng: number } | null>(null);
  const { stage, requestForeground, requestBackground } = useLocationPermissions();
  const subscriptionRef = useRef<LocationSubscription | null>(null);
  const startBackgroundRef = useRef<(() => Promise<void>) | null>(null);
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);
  const [showBackgroundPrompt, setShowBackgroundPrompt] = useState(false);

  // iOS resolves the "Always" upgrade prompt asynchronously, so the status right
  // after requestBackground() can still be stale; re-check for a few seconds.
  async function awaitBackgroundPermission(): Promise<boolean> {
    if (await requestBackground()) return true;
    for (let i = 0; i < BACKGROUND_PERMISSION_POLLS; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const { status } = await Location.getBackgroundPermissionsAsync();
      if (status === 'granted') return true;
    }
    return false;
  }

  async function activateBackground(): Promise<boolean> {
    if (!(await awaitBackgroundPermission())) return false;
    await startBackgroundRef.current?.();
    setBackgroundEnabled(true);
    return true;
  }

  async function enableBackground(): Promise<boolean> {
    const granted = await activateBackground();
    // iOS shows the system prompt only once; afterwards the user must use Settings.
    if (!granted) await Linking.openSettings();
    return granted;
  }

  async function handleAcceptPrompt() {
    setShowBackgroundPrompt(false);
    await activateBackground();
  }

  function handleDeclinePrompt() {
    setShowBackgroundPrompt(false);
    void AsyncStorage.setItem(BACKGROUND_PROMPT_DISMISSED_KEY, '1');
  }

  useEffect(() => {
    getSession(client).then(setSession).catch(() => setSession(null));
  }, []);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    let unsubscribeStore: (() => void) | null = null;
    let unsubscribeNet: (() => void) | null = null;
    let unsubscribeProfile: (() => void) | null = null;

    void (async () => {
      // Read the accuracy profile before the store is constructed so its
      // 25m/75m radius also becomes the point-recording throttle, not just
      // the GPS distanceInterval.
      const profile = await getAccuracyProfile(AsyncStorage);
      let distanceInterval = DISTANCE_INTERVAL_METERS[profile];

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
        const startForeground = async () => {
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
        };
        await startForeground();

        startBackgroundRef.current = async () => {
          setBackgroundLocationHandler((coord, accuracy) =>
            store.useProgressStore
              .getState()
              .addPoint(coord, Math.max(accuracy || 0, distanceInterval))
          );
          await startBackgroundTracking(distanceInterval);
        };

        // A new accuracy setting applies at once: restart both trackers with the new interval.
        unsubscribeProfile = onAccuracyProfileChange((next) => {
          distanceInterval = DISTANCE_INTERVAL_METERS[next];
          store.setThrottleMeters(distanceInterval);
          void (async () => {
            stopForegroundTracking(subscriptionRef.current);
            await startForeground();
            if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
              await stopBackgroundTracking();
              await startBackgroundRef.current?.();
            }
          })().catch((err) => console.warn('[App] failed to apply accuracy change', err));
        });

        const existing = await Location.getBackgroundPermissionsAsync();
        if (existing.status === 'granted') {
          await startBackgroundRef.current();
          if (!cancelled) setBackgroundEnabled(true);
        } else {
          const dismissed = await AsyncStorage.getItem(BACKGROUND_PROMPT_DISMISSED_KEY);
          if (!cancelled && !dismissed) setShowBackgroundPrompt(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubscribeStore?.();
      unsubscribeNet?.();
      unsubscribeProfile?.();
      stopForegroundTracking(subscriptionRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Signed in, MainScreen handles the top inset itself so the map can run under the status bar.
  return (
    <SafeAreaProvider>
    <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={session ? [] : ['top']}>
      <RootNavigator client={client} session={session} onSignedIn={() => getSession(client).then(setSession)}>
        <OfflineBanner />
        <LocationPermissionBanner stage={stage} onRequestForeground={requestForeground} />
        <BackgroundPermissionPrompt
          visible={showBackgroundPrompt}
          onAccept={() => void handleAcceptPrompt()}
          onDecline={handleDeclinePrompt}
        />
        <MainScreen
          backgroundEnabled={backgroundEnabled}
          onEnableBackground={enableBackground}
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
