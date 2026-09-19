import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LocationSubscription } from 'expo-location';
import AppMenu from '../components/AppMenu';
import PlaceSheet from '../components/PlaceSheet';
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
import CountriesScreen from './CountriesScreen';
import CountryPlacesScreen from './CountryPlacesScreen';
import { cellKey, groupPlacesByCountry, type CountryStat } from '../lib/geo/countryStats';
import { useRoute } from '../hooks/useRoute';
import type { DiscoveredPlace, Poi } from '../lib/poi/types';
import { useStats } from '../hooks/useStats';
import { useCountryStats } from '../hooks/useCountryStats';
import { useCityStats } from '../hooks/useCityStats';

const NO_PLACES: DiscoveredPlace[] = [];

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
  const [showCountries, setShowCountries] = useState(false);
  const [openCountry, setOpenCountry] = useState<CountryStat | null>(null);
  const [selected, setSelected] = useState<Poi | null>(null);
  const [detailPlace, setDetailPlace] = useState<Poi | null>(null);
  const [routing, setRouting] = useState(false);
  const [view, setView] = useState<MapView | null>(null);
  const [fogStyle, setFogStyleState] = useState<FogStyle>('ink');
  const { pois, discovered, discoveredIds, greeting, dismissGreeting } = usePlaces({
    client,
    userId,
    view,
    livePosition,
  });

  const { route, status: routeStatus } = useRoute(routing ? selected : null, livePosition);

  // Arriving discovers the place, which ends the selection and its route.
  useEffect(() => {
    if (selected && discoveredIds.has(selected.id)) {
      setSelected(null);
      setRouting(false);
    }
  }, [selected, discoveredIds]);

  function handleSelect(poi: Poi) {
    setSelected(poi);
    setRouting(false);
    setTab('map');
  }

  function handleCloseSelected() {
    setSelected(null);
    setRouting(false);
  }

  const stats = useStats(points, discovered.length, tab === 'collection');

  const countryStats = useCountryStats(points, tab === 'collection');
  // Found places are stored without OpenStreetMap's wiki links; take them from the loaded POI.
  const detailWithTags = useMemo(() => {
    if (!detailPlace) return null;
    const loaded = pois.find((p) => p.id === detailPlace.id);
    return loaded ? { ...detailPlace, wikipedia: loaded.wikipedia, wikidata: loaded.wikidata } : detailPlace;
  }, [detailPlace, pois]);

  const openCountryCode = openCountry?.code ?? null;
  const openCountryPoints = useMemo(
    () =>
      openCountryCode
        ? points.filter((p) => countryStats.cells[cellKey(p.lat, p.lng)]?.code === openCountryCode)
        : [],
    [points, countryStats.cells, openCountryCode]
  );
  const placesByCountry = useMemo(
    () => groupPlacesByCountry(discovered, pois, discoveredIds, countryStats.cells),
    [discovered, pois, discoveredIds, countryStats.cells]
  );

  const cityStats = useCityStats(
    openCountryPoints,
    (openCountryCode && placesByCountry.get(openCountryCode)?.discovered) || NO_PLACES,
    openCountryCode !== null
  );

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
        <View
          style={[StyleSheet.absoluteFill, tab !== 'map' && styles.hidden]}
          pointerEvents={tab === 'map' ? 'auto' : 'none'}
        >
          <MapScreen
            points={points}
            livePosition={livePosition}
            pois={pois}
            discoveredIds={discoveredIds}
            fog={FOG_PALETTES[fogStyle]}
            view={view}
            onViewChange={setView}
            route={route}
            routeStatus={routeStatus}
            active={tab === 'map'}
            selected={selected}
            routing={routing}
            onSelect={handleSelect}
            onOpenFound={setDetailPlace}
            onCloseSelected={handleCloseSelected}
            onBuildRoute={() => setRouting(true)}
            onCancelRoute={() => setRouting(false)}
          />
        </View>
        {tab === 'nearby' && (
          <NearbyScreen
            pois={pois}
            discoveredIds={discoveredIds}
            origin={livePosition}
            onSelect={handleSelect}
          />
        )}
        {tab === 'collection' &&
          (showCountries && openCountry ? (
            <CountryPlacesScreen
              country={openCountry}
              places={placesByCountry.get(openCountry.code)}
              cities={cityStats.cities}
              citiesPending={cityStats.pending}
              citiesFailed={cityStats.failed}
              origin={livePosition}
              onBack={() => setOpenCountry(null)}
              onOpenFound={setDetailPlace}
              onSelectHidden={(poi) => {
                setShowCountries(false);
                setOpenCountry(null);
                handleSelect(poi);
              }}
            />
          ) : showCountries ? (
            <CountriesScreen
              countries={countryStats.countries}
              pending={countryStats.pending}
              failed={countryStats.failed}
              placesByCountry={placesByCountry}
              onBack={() => setShowCountries(false)}
              onOpenCountry={setOpenCountry}
            />
          ) : (
            <CollectionScreen
              stats={stats}
              countries={countryStats.countries}
              onOpenCountries={() => setShowCountries(true)}
            />
          ))}
        <DiscoveryCard place={greeting} onDismiss={dismissGreeting} onOpen={setDetailPlace} />
      </View>
      <TabBar
        tabs={TABS}
        active={tab}
        onChange={(key) => {
          if (key === 'menu') setMenuOpen(true);
          else {
            setTab(key);
            if (key !== 'collection') {
              setShowCountries(false);
              setOpenCountry(null);
            }
          }
        }}
      />
      <PlaceSheet place={detailWithTags} onClose={() => setDetailPlace(null)} />
      <AppMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        fogStyle={fogStyle}
        onFogStyleChange={handleFogStyleChange}
        backgroundEnabled={backgroundEnabled}
        onEnableBackground={onEnableBackground}
        onSignOut={handleSignOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { flex: 1 },
  // Keep the native map alive while another tab is on top; display: none tears it down.
  hidden: { opacity: 0 },
});
