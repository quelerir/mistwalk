import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LocationSubscription } from 'expo-location';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import AppMenu from '../components/AppMenu';
import PlaceSheet from '../components/PlaceSheet';
import DiscoveryCard from '../components/DiscoveryCard';
import TabBar, { type TabItem } from '../components/TabBar';
import type { LivePosition } from '../components/FogOverlay';
import { usePlaces } from '../hooks/usePlaces';
import type { MapView } from '../lib/geo/projection';
import { performSignOut } from '../lib/session/signOutFlow';
import { FOG_PALETTES, getFogAnimated, getFogStyle, resolveFogStyle, setFogAnimated, setFogStyle, type FogSetting } from '../lib/settings/fogStyle';
import { getPlaceNotifications, setPlaceNotifications } from '../lib/settings/placeNotifications';
import { getWeeklySummary, setWeeklySummary } from '../lib/settings/weeklySummary';
import { getOfflineMap, setOfflineMap } from '../lib/settings/offlineMap';
import { getWeatherFog, setWeatherFog } from '../lib/settings/weatherFog';
import { useRain } from '../hooks/useRain';
import { MAP_STYLES } from '../lib/map/styles';
import { clearOfflineAreas, ensureOfflineArea, offlineMapBytes } from '../services/offlineMap';
import { dailyKm, weekSummary } from '../lib/stats/weekly';
import { ensureNotificationPermission } from '../services/notificationPermission';
import { cancelWeeklySummary, scheduleWeeklySummary } from '../services/weeklySummaryNotification';
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
import { cityCellKey } from '../lib/geo/cityStats';
import LeaderboardScreen from './LeaderboardScreen';
import FollowsScreen from './FollowsScreen';
import { fetchFollowState } from '../lib/social/follows';
import PlayerScreen from './PlayerScreen';
import { useProfileSync } from '../hooks/useProfileSync';
import { pickAvatar } from '../lib/social/pickAvatar';
import { avatarUrl, buildSnapshot, type LeaderboardEntry, type PlaceRegion } from '../lib/social/profiles';

const NO_PLACES: DiscoveredPlace[] = [];

type TabKey = 'map' | 'nearby' | 'collection' | 'menu';

const TABS: Array<TabItem<TabKey>> = [
  { key: 'map', label: 'Карта', icon: 'map' },
  { key: 'nearby', label: 'Рядом', icon: 'compass' },
  { key: 'collection', label: 'Достижения', icon: 'award' },
  { key: 'menu', label: 'Меню', icon: 'user' },
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
  const styles = useStyles(makeStyles);
  const [tab, setTab] = useState<Exclude<TabKey, 'menu'>>('map');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCountries, setShowCountries] = useState(false);
  const [openCountry, setOpenCountry] = useState<CountryStat | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [openPlayer, setOpenPlayer] = useState<{ userId: string; displayName: string } | null>(null);
  const [showFollows, setShowFollows] = useState(false);
  const [followsTab, setFollowsTab] = useState<'followers' | 'following'>('followers');
  const [followCounts, setFollowCounts] = useState<{ followers: number; following: number } | null>(null);
  const [selected, setSelected] = useState<Poi | null>(null);
  const [detailPlace, setDetailPlace] = useState<Poi | null>(null);
  const [routing, setRouting] = useState(false);
  const [view, setView] = useState<MapView | null>(null);
  const [fogStyle, setFogStyleState] = useState<FogSetting>('ink');
  const [fogAnimated, setFogAnimatedState] = useState(true);
  // Only "auto" fog reads the hour; checking once a minute is enough to switch at the boundary.
  const [hour, setHour] = useState(() => new Date().getHours());
  const [placeNotifications, setPlaceNotificationsState] = useState(false);
  const [weeklySummaryOn, setWeeklySummaryOn] = useState(false);
  const [weatherFogOn, setWeatherFogOn] = useState(true);
  const [offlineMapOn, setOfflineMapOn] = useState(true);
  const [offlineMb, setOfflineMb] = useState<number | null>(null);
  const { scheme } = useTheme();
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

  const stats = useStats(points, discovered.length, true);
  // Counters for the "Подписки" row; refreshed whenever the followers screen is left.
  useEffect(() => {
    if (showFollows) return;
    fetchFollowState(client, userId)
      .then((state) => setFollowCounts({ followers: state.followers, following: state.followingCount }))
      .catch(() => {});
  }, [client, userId, showFollows]);
  const insets = useSafeAreaInsets();
  const rain = useRain(livePosition, weatherFogOn);
  // Keep the area around you on the phone (Wi-Fi only; the service decides when a download is due).
  useEffect(() => {
    if (offlineMapOn && livePosition) void ensureOfflineArea(livePosition, MAP_STYLES[scheme]);
  }, [offlineMapOn, livePosition, scheme]);
  // The size shown in the menu is read when the menu opens.
  useEffect(() => {
    if (!menuOpen || !offlineMapOn) return;
    void offlineMapBytes().then((bytes) => setOfflineMb(bytes > 0 ? Math.max(1, Math.round(bytes / (1024 * 1024))) : null));
  }, [menuOpen, offlineMapOn]);
  const week = useMemo(() => weekSummary(points, discovered, Date.now()), [points, discovered]);
  const daily = useMemo(() => dailyKm(points, Date.now()), [points]);

  const countryStats = useCountryStats(points, true);
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

  // The public profile needs every city, so resolve them all in the background.
  const countryAt = useCallback(
    (lat: number, lng: number) => countryStats.cells[cellKey(lat, lng)]?.code ?? null,
    [countryStats.cells]
  );
  const allCityStats = useCityStats(points, discovered, true, countryAt);
  const placeRegions = useMemo(() => {
    const regions: Record<string, PlaceRegion> = {};
    for (const place of discovered) {
      const country = countryAt(place.lat, place.lng);
      if (!country) continue;
      regions[place.id] = {
        c: country,
        t: allCityStats.cells[cityCellKey(place.lat, place.lng)]?.name ?? null,
      };
    }
    return regions;
  }, [discovered, countryAt, allCityStats.cells]);
  const snapshot = useMemo(
    () => buildSnapshot(stats.distanceKm, countryStats.countries, allCityStats.cities, placeRegions),
    [stats.distanceKm, countryStats.countries, allCityStats.cities, placeRegions]
  );
  const profileSync = useProfileSync(client, userId, snapshot);
  const avatarUri = avatarUrl(client, profileSync.profile?.avatarPath ?? null);
  const tabs = useMemo(
    () => TABS.map((t) => (t.key === 'menu' ? { ...t, photoUri: avatarUri } : t)),
    [avatarUri]
  );

  async function handleChangeAvatar(): Promise<string | null> {
    // iOS cannot present the photo picker over the menu sheet, so hide the sheet while picking.
    setMenuOpen(false);
    await new Promise((resolve) => setTimeout(resolve, 450));
    try {
      const picked = await pickAvatar();
      if (picked.kind === 'denied') return 'Нет доступа к фото. Разрешите его в настройках iPhone.';
      if (picked.kind === 'cancelled') return null;
      await profileSync.setAvatar(picked.body);
      return 'Фото обновлено';
    } catch (err) {
      console.warn('[avatar] upload failed', err);
      return 'Не удалось загрузить фото. Проверьте интернет.';
    } finally {
      setMenuOpen(true);
    }
  }

  const cityStats = useCityStats(
    openCountryPoints,
    (openCountryCode && placesByCountry.get(openCountryCode)?.discovered) || NO_PLACES,
    openCountryCode !== null
  );

  useEffect(() => {
    void getFogStyle(AsyncStorage).then(setFogStyleState);
    const tick = setInterval(() => setHour(new Date().getHours()), 60000);
    void getFogAnimated(AsyncStorage).then(setFogAnimatedState);
    void getPlaceNotifications(AsyncStorage).then((s) => setPlaceNotificationsState(s.enabled && s.userId === userId));
    void getWeeklySummary(AsyncStorage).then(setWeeklySummaryOn);
    void getOfflineMap(AsyncStorage).then(setOfflineMapOn);
    void getWeatherFog(AsyncStorage).then(setWeatherFogOn);
    return () => clearInterval(tick);
  }, []);

  function handleFogStyleChange(style: FogSetting) {
    setFogStyleState(style);
    void setFogStyle(AsyncStorage, style);
  }

  function handleFogAnimatedChange(next: boolean) {
    setFogAnimatedState(next);
    void setFogAnimated(AsyncStorage, next);
  }

  async function handlePlaceNotificationsChange(next: boolean) {
    // iOS asks only once; after a refusal the switch has to be flipped in the system settings.
    if (next && !(await ensureNotificationPermission())) {
      await Linking.openSettings();
      return;
    }
    setPlaceNotificationsState(next);
    await setPlaceNotifications(AsyncStorage, { enabled: next, userId: next ? userId : null });
  }

  async function handleWeeklySummaryChange(next: boolean) {
    if (next && !(await ensureNotificationPermission())) {
      await Linking.openSettings();
      return;
    }
    setWeeklySummaryOn(next);
    await setWeeklySummary(AsyncStorage, next);
    if (next) await scheduleWeeklySummary();
    else await cancelWeeklySummary();
  }

  async function handleOfflineMapChange(next: boolean) {
    setOfflineMapOn(next);
    await setOfflineMap(AsyncStorage, next);
    if (!next) {
      await clearOfflineAreas();
      setOfflineMb(null);
    } else if (livePosition) {
      void ensureOfflineArea(livePosition, MAP_STYLES[scheme]);
    }
  }

  function handleWeatherFogChange(next: boolean) {
    setWeatherFogOn(next);
    void setWeatherFog(AsyncStorage, next);
  }

  function handleSignOut() {
    void setWeeklySummary(AsyncStorage, false);
    void cancelWeeklySummary();
    void setPlaceNotifications(AsyncStorage, { enabled: false, userId: null });
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
      <View style={[styles.content, { paddingTop: tab === 'map' ? 0 : insets.top }]}>
        <View
          style={[StyleSheet.absoluteFill, tab !== 'map' && styles.hidden]}
          pointerEvents={tab === 'map' ? 'auto' : 'none'}
        >
          <MapScreen
            points={points}
            livePosition={livePosition}
            pois={pois}
            discoveredIds={discoveredIds}
            fog={FOG_PALETTES[resolveFogStyle(fogStyle, hour)]}
            fogAnimated={fogAnimated}
            rain={rain}
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
          ((showLeaderboard || showFollows) && openPlayer ? (
            <PlayerScreen
              client={client}
              playerId={openPlayer.userId}
              fallbackName={openPlayer.displayName}
              onBack={() => setOpenPlayer(null)}
              isMe={openPlayer.userId === userId}
            />
          ) : showFollows ? (
            <FollowsScreen client={client} initialTab={followsTab} onBack={() => setShowFollows(false)} onOpenPlayer={setOpenPlayer} />
          ) : showLeaderboard ? (
            <LeaderboardScreen
              client={client}
              userId={userId}
              onBack={() => setShowLeaderboard(false)}
              onOpenPlayer={setOpenPlayer}
            />
          ) : showCountries && openCountry ? (
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
              week={week}
              daily={daily}
              countries={countryStats.countries}
              onOpenCountries={() => setShowCountries(true)}
              onOpenLeaderboard={() => setShowLeaderboard(true)}
              onOpenFollows={(tab) => {
                setFollowsTab(tab);
                setShowFollows(true);
              }}
              followCounts={followCounts}
            />
          ))}
        <DiscoveryCard place={greeting} onDismiss={dismissGreeting} onOpen={setDetailPlace} />
      </View>
      <TabBar
        tabs={tabs}
        active={tab}
        onChange={(key) => {
          if (key === 'menu') setMenuOpen(true);
          else {
            setTab(key);
            if (key !== 'collection') {
              setShowCountries(false);
              setOpenCountry(null);
              setShowLeaderboard(false);
              setShowFollows(false);
              setOpenPlayer(null);
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
        fogAnimated={fogAnimated}
        onFogAnimatedChange={handleFogAnimatedChange}
        placeNotifications={placeNotifications}
        onPlaceNotificationsChange={handlePlaceNotificationsChange}
        weeklySummary={weeklySummaryOn}
        weatherFog={weatherFogOn}
        onWeatherFogChange={handleWeatherFogChange}
        offlineMap={offlineMapOn}
        offlineMapMb={offlineMb}
        onOfflineMapChange={handleOfflineMapChange}
        onWeeklySummaryChange={handleWeeklySummaryChange}
        backgroundEnabled={backgroundEnabled}
        onEnableBackground={onEnableBackground}
        onSignOut={handleSignOut}
        email={email}
        leaderboardVisible={profileSync.profile?.isPublic ?? null}
        onLeaderboardVisibleChange={profileSync.setVisible}
        avatarUri={avatarUri}
        displayName={profileSync.profile?.displayName ?? email}
        onChangeAvatar={handleChangeAvatar}
        onRemoveAvatar={profileSync.clearAvatar}
      />
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { flex: 1 },
  // Keep the native map alive while another tab is on top; display: none tears it down.
  hidden: { opacity: 0 },
});
