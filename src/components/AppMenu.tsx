import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, View } from 'react-native';
import Avatar from './Avatar';
import MenuSheet, { type MenuItem } from './MenuSheet';
import { useTheme } from '../theme/ThemeProvider';
import { nextThemePreference } from '../theme/palettes';
import { nextFogStyle, type FogSetting } from '../lib/settings/fogStyle';
import { useI18n } from '../i18n/I18nProvider';
import { LANGUAGES } from '../i18n';
import {
  getAccuracyProfile,
  setAccuracyProfile,
  type AccuracyProfile,
} from '../lib/settings/accuracyProfile';

export interface AppMenuProps {
  visible: boolean;
  onClose: () => void;
  fogStyle: FogSetting;
  onFogStyleChange: (style: FogSetting) => void;
  fogAnimated: boolean;
  onFogAnimatedChange: (next: boolean) => void;
  placeNotifications: boolean;
  onPlaceNotificationsChange: (next: boolean) => Promise<void>;
  weeklySummary: boolean;
  weatherFog: boolean;
  onWeatherFogChange: (next: boolean) => void;
  offlineMap: boolean;
  offlineMapMb: number | null;
  onOfflineMapChange: (next: boolean) => Promise<void>;
  onWeeklySummaryChange: (next: boolean) => Promise<void>;
  backgroundEnabled: boolean;
  onEnableBackground: () => Promise<boolean>;
  onSignOut: () => Promise<void>;
  email: string;
  leaderboardVisible: boolean | null;
  onLeaderboardVisibleChange: (next: boolean) => Promise<void>;
  avatarUri: string | null;
  displayName: string;
  onChangeAvatar: () => Promise<string | null>;
  onRemoveAvatar: () => Promise<void>;
}

export default function AppMenu({
  visible,
  onClose,
  fogStyle,
  onFogStyleChange,
  fogAnimated,
  onFogAnimatedChange,
  placeNotifications,
  onPlaceNotificationsChange,
  weeklySummary,
  weatherFog,
  onWeatherFogChange,
  offlineMap,
  offlineMapMb,
  onOfflineMapChange,
  onWeeklySummaryChange,
  backgroundEnabled,
  onEnableBackground,
  onSignOut,
  email,
  leaderboardVisible,
  onLeaderboardVisibleChange,
  avatarUri,
  displayName,
  onChangeAvatar,
  onRemoveAvatar,
}: AppMenuProps) {
  const [accuracy, setAccuracy] = useState<AccuracyProfile>('battery-saver');
  const { preference, setPreference, colors: c } = useTheme();
  const [note, setNote] = useState<string | null>(null);
  const [page, setPage] = useState<'main' | 'settings' | 'account' | 'language'>('main');
  const { t, setting, setSetting } = useI18n();
  // Settings are listed in these groups, in this order.
  const APPEARANCE = t('menu.group.appearance');
  const MAP_AND_POSITION = t('menu.group.mapPosition');
  const NOTIFICATIONS = t('menu.group.notifications');

  useEffect(() => {
    void getAccuracyProfile(AsyncStorage).then(setAccuracy);
  }, []);

  function chooseAccuracy(next: AccuracyProfile) {
    setAccuracy(next);
    void setAccuracyProfile(AsyncStorage, next);
  }

  function closeThen(action: () => void) {
    return () => {
      setPage('main');
      onClose();
      action();
    };
  }

  const mainItems: MenuItem[] = [
    { key: 'settings', icon: 'settings', label: t('menu.settings'), onPress: () => setPage('settings') },
    { key: 'account', icon: 'user', label: t('menu.account'), onPress: () => setPage('account') },
  ];

  const accountItems: MenuItem[] = [
    { key: 'back', icon: 'back', label: t('common.back'), onPress: () => setPage('main') },
    { key: 'email', icon: 'user', label: email || t('menu.noEmail'), onPress: () => {} },
    {
      key: 'photo',
      icon: 'user',
      label: avatarUri ? t('menu.changePhoto') : t('menu.addPhoto'),
      onPress: () => {
        setNote(null);
        void onChangeAvatar().then((message) => setNote(message));
      },
    },
    ...(avatarUri
      ? [
          {
            key: 'photo-remove',
            icon: 'logout' as const,
            label: t('menu.removePhoto'),
            onPress: () => {
              setNote(null);
              void onRemoveAvatar().catch(() => setNote(t('menu.removePhotoFailed')));
            },
          },
        ]
      : []),
    {
      key: 'visibility',
      icon: 'award',
      label: t('menu.inRating'),
      value: leaderboardVisible === null ? '…' : leaderboardVisible ? t('common.yes') : t('common.no'),
      onPress: () => {
        if (leaderboardVisible !== null) void onLeaderboardVisibleChange(!leaderboardVisible);
      },
    },
    {
      key: 'signout',
      icon: 'logout',
      label: t('menu.signOut'),
      destructive: true,
      onPress: closeThen(() => void onSignOut()),
    },
  ];

  const settingsItems: MenuItem[] = [
    { key: 'back', icon: 'back', label: t('common.back'), onPress: () => setPage('main') },
    {
      key: 'language',
      group: APPEARANCE,
      icon: 'globe',
      label: t('menu.language'),
      value: setting === 'auto' ? t('menu.languageAuto') : LANGUAGES.find((l) => l.code === setting)?.name,
      onPress: () => setPage('language'),
    },
    {
      key: 'theme',
      group: APPEARANCE,
      icon: 'moon',
      label: t('menu.theme'),
      value: t(`theme.${preference}`),
      onPress: () => setPreference(nextThemePreference(preference)),
    },
    {
      key: 'fog',
      group: APPEARANCE,
      hint: t('menu.fogStyleHint'),
      icon: 'cloud',
      label: t('menu.fogStyle'),
      value: t(`fog.${fogStyle}`),
      onPress: () => onFogStyleChange(nextFogStyle(fogStyle)),
    },
    {
      key: 'fogAnimation',
      group: APPEARANCE,
      icon: 'cloud',
      label: t('menu.fogAnimation'),
      on: fogAnimated,
      onPress: () => onFogAnimatedChange(!fogAnimated),
    },
    {
      key: 'weatherFog',
      group: APPEARANCE,
      hint: t('menu.rainHint'),
      icon: 'weather',
      label: t('menu.rain'),
      on: weatherFog,
      onPress: () => onWeatherFogChange(!weatherFog),
    },
    {
      key: 'accuracy',
      group: MAP_AND_POSITION,
      hint: t('menu.gpsHint'),
      icon: 'locate',
      label: t('menu.gps'),
      value: accuracy === 'precise' ? t('menu.gpsPrecise') : t('menu.gpsSaver'),
      onPress: () => chooseAccuracy(accuracy === 'precise' ? 'battery-saver' : 'precise'),
    },
    {
      key: 'background',
      group: MAP_AND_POSITION,
      hint: t('menu.backgroundHint'),
      icon: 'navigate',
      label: t('menu.background'),
      value: backgroundEnabled ? t('menu.backgroundOn') : t('menu.backgroundEnable'),
      onPress: () => {
        if (!backgroundEnabled) void onEnableBackground();
      },
    },
    {
      key: 'offlineMap',
      group: MAP_AND_POSITION,
      hint: t('menu.offlineMapHint'),
      icon: 'download',
      label: offlineMap && offlineMapMb ? t('menu.offlineMapSize', { mb: offlineMapMb }) : t('menu.offlineMap'),
      on: offlineMap,
      onPress: () => void onOfflineMapChange(!offlineMap),
    },
    {
      key: 'placeNotifications',
      group: NOTIFICATIONS,
      icon: 'bell',
      label: t('menu.placeNotifications'),
      on: placeNotifications,
      onPress: () => void onPlaceNotificationsChange(!placeNotifications),
    },
    {
      key: 'weeklySummary',
      group: NOTIFICATIONS,
      hint: t('menu.weeklySummaryHint'),
      icon: 'award',
      label: t('menu.weeklySummary'),
      on: weeklySummary,
      onPress: () => void onWeeklySummaryChange(!weeklySummary),
    },
  ];

  const languageItems: MenuItem[] = [
    { key: 'back', icon: 'back', label: t('common.back'), onPress: () => setPage('settings') },
    {
      key: 'auto',
      icon: 'globe',
      label: t('menu.languageAuto'),
      value: setting === 'auto' ? '✓' : undefined,
      onPress: () => {
        setSetting('auto');
        setPage('settings');
      },
    },
    ...LANGUAGES.map(
      (l): MenuItem => ({
        key: l.code,
        icon: 'globe',
        label: l.name,
        value: setting === l.code ? '✓' : undefined,
        onPress: () => {
          setSetting(l.code);
          setPage('settings');
        },
      })
    ),
  ];

  const items =
    page === 'main' ? mainItems : page === 'settings' ? settingsItems : page === 'language' ? languageItems : accountItems;

  const header =
    page === 'account' ? (
      <View style={{ alignItems: 'center', paddingVertical: 14 }}>
        <Avatar uri={avatarUri} name={displayName} size={88} />
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 17, marginTop: 10 }}>{displayName}</Text>
        {note && <Text style={{ color: c.textMuted, marginTop: 4 }}>{note}</Text>}
      </View>
    ) : null;

  // A user-driven close starts from the main page next time; the avatar flow reopens where it left off.
  function handleClose() {
    setPage('main');
    onClose();
  }

  return <MenuSheet visible={visible} items={items} header={header} onClose={handleClose} />;
}
