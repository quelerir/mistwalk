import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LocationSubscription } from 'expo-location';
import AppMenu from '../components/AppMenu';
import DiscoveryCard from '../components/DiscoveryCard';
import TabBar, { type TabItem } from '../components/TabBar';
import type { LivePosition } from '../components/FogOverlay';
import { usePlaces } from '../hooks/usePlaces';
import type { MapView } from '../lib/geo/projection';
import { performSignOut } from '../lib/session/signOutFlow';
import { FOG_PALETTES, getFogStyle, setFogStyle, type FogStyle } from '../lib/settings/fogStyle';
import { signOut, signOutLocal } from '../lib/supabase/auth';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';
import { stopBackgroundTracking } from '../services/backgroundLocationTask';
import { stopForegroundTracking } from '../services/locationTracker';
import MapScreen from './MapScreen';
import NearbyScreen from './NearbyScreen';
import CollectionScreen from './CollectionScreen';
import { useStats } from '../hooks/useStats';

type TabKey = 'map' | 'nearby' | 'collection' | 'menu';

const TABS: Array<TabItem<TabKey>> = [
  { key: 'map', label: 'Карта', icon: 'map' },
  { key: 'nearby', label: 'Рядом', icon: 'compass' },
  { key: 'collection', label: 'Коллекция', icon: 'award' },
  { key: 'menu', label: 'Меню', icon: 'menu' },
];

export interface MainScreenProps {
  points: VisitedPoint[];
  livePosition: LivePosition | null;
  userId: string;
  email: string;
  client: SupabaseClient;
  subscription: LocationSubscription | null;
  onSignedOut: () => void;
  backgroundEnabled: boolean;
  onEnableBackground: () => Promise<boolean>;
}

export default function MainScreen({
  points,
  livePosition,
  userId,
  email,
  client,
  subscription,
  onSignedOut,
  backgroundEnabled,
  onEnableBackground,
}: MainScreenProps) {
  const [tab, setTab] = useState<Exclude<TabKey, 'menu'>>('map');
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<MapView | null>(null);
  const [fogStyle, setFogStyleState] = useState<FogStyle>('ink');
  const { pois, discovered, discoveredIds, greeting, dismissGreeting } = usePlaces({
    client,
    userId,
    view,
    livePosition,
  });

  const stats = useStats(points, discovered, tab === 'collection');

  useEffect(() => {
    void getFogStyle(AsyncStorage).then(setFogStyleState);
  }, []);

  function handleFogStyleChange(style: FogStyle) {
    setFogStyleState(style);
    void setFogStyle(AsyncStorage, style);
  }

  function handleSignOut() {
    return performSignOut({
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
      <View style={styles.content}>
        <View style={[StyleSheet.absoluteFill, tab !== 'map' && styles.hidden]}>
          <MapScreen
            points={points}
            livePosition={livePosition}
            pois={pois}
            discoveredIds={discoveredIds}
            fog={FOG_PALETTES[fogStyle]}
            view={view}
            onViewChange={setView}
          />
        </View>
        {tab === 'nearby' && (
          <NearbyScreen pois={pois} discoveredIds={discoveredIds} origin={livePosition} />
        )}
        {tab === 'collection' && <CollectionScreen stats={stats} discovered={discovered} />}
        <DiscoveryCard place={greeting} onDismiss={dismissGreeting} />
      </View>
      <TabBar
        tabs={TABS}
        active={tab}
        onChange={(key) => (key === 'menu' ? setMenuOpen(true) : setTab(key))}
      />
      <AppMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        fogStyle={fogStyle}
        onFogStyleChange={handleFogStyleChange}
        backgroundEnabled={backgroundEnabled}
        onEnableBackground={onEnableBackground}
        onOpenCollection={() => setTab('collection')}
        onOpenNearby={() => setTab('nearby')}
        onSignOut={handleSignOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { flex: 1 },
  hidden: { display: 'none' },
});
