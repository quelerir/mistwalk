import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, View } from 'react-native';
import Avatar from './Avatar';
import MenuSheet, { type MenuItem } from './MenuSheet';
import { useTheme } from '../theme/ThemeProvider';
import { nextThemePreference, THEME_LABELS } from '../theme/palettes';
import { FOG_STYLE_LABELS, nextFogStyle, type FogSetting } from '../lib/settings/fogStyle';
import {
  getAccuracyProfile,
  setAccuracyProfile,
  type AccuracyProfile,
} from '../lib/settings/accuracyProfile';

// Settings are listed in these groups, in this order.
const APPEARANCE = 'Внешний вид';
const MAP_AND_POSITION = 'Карта и позиция';
const NOTIFICATIONS = 'Уведомления';

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
  const [page, setPage] = useState<'main' | 'settings' | 'account'>('main');

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
    { key: 'settings', icon: 'settings', label: 'Настройки', onPress: () => setPage('settings') },
    { key: 'account', icon: 'user', label: 'Аккаунт', onPress: () => setPage('account') },
  ];

  const accountItems: MenuItem[] = [
    { key: 'back', icon: 'back', label: 'Назад', onPress: () => setPage('main') },
    { key: 'email', icon: 'user', label: email || 'Без почты', onPress: () => {} },
    {
      key: 'photo',
      icon: 'user',
      label: avatarUri ? 'Изменить фото' : 'Добавить фото',
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
            label: 'Удалить фото',
            onPress: () => {
              setNote(null);
              void onRemoveAvatar().catch(() => setNote('Не удалось удалить фото'));
            },
          },
        ]
      : []),
    {
      key: 'visibility',
      icon: 'award',
      label: 'Виден в рейтинге',
      value: leaderboardVisible === null ? '…' : leaderboardVisible ? 'Да' : 'Нет',
      onPress: () => {
        if (leaderboardVisible !== null) void onLeaderboardVisibleChange(!leaderboardVisible);
      },
    },
    {
      key: 'signout',
      icon: 'logout',
      label: 'Выйти',
      destructive: true,
      onPress: closeThen(() => void onSignOut()),
    },
  ];

  const settingsItems: MenuItem[] = [
    { key: 'back', icon: 'back', label: 'Назад', onPress: () => setPage('main') },
    {
      key: 'theme',
      group: APPEARANCE,
      icon: 'moon',
      label: 'Тема',
      value: THEME_LABELS[preference],
      onPress: () => setPreference(nextThemePreference(preference)),
    },
    {
      key: 'fog',
      group: APPEARANCE,
      hint: 'Авто: днём дымка, вечером чернила, ночью синий туман.',
      icon: 'cloud',
      label: 'Стиль тумана',
      value: FOG_STYLE_LABELS[fogStyle],
      onPress: () => onFogStyleChange(nextFogStyle(fogStyle)),
    },
    {
      key: 'fogAnimation',
      group: APPEARANCE,
      icon: 'cloud',
      label: 'Анимация тумана',
      on: fogAnimated,
      onPress: () => onFogAnimatedChange(!fogAnimated),
    },
    {
      key: 'weatherFog',
      group: APPEARANCE,
      hint: 'Рисует дождь, когда он идёт у вас, и пускает облака по ветру.',
      icon: 'weather',
      label: 'Дождь на карте',
      on: weatherFog,
      onPress: () => onWeatherFogChange(!weatherFog),
    },
    {
      key: 'accuracy',
      group: MAP_AND_POSITION,
      hint: 'Запоминать позицию каждые 25 м или 75 м; экономия бережёт батарею.',
      icon: 'locate',
      label: 'Точность GPS',
      value: accuracy === 'precise' ? 'Точный' : 'Экономия',
      onPress: () => chooseAccuracy(accuracy === 'precise' ? 'battery-saver' : 'precise'),
    },
    {
      key: 'background',
      group: MAP_AND_POSITION,
      hint: 'Запоминает путь, пока приложение свёрнуто или экран выключен.',
      icon: 'navigate',
      label: 'Работа в фоне',
      value: backgroundEnabled ? 'Включена' : 'Включить',
      onPress: () => {
        if (!backgroundEnabled) void onEnableBackground();
      },
    },
    {
      key: 'offlineMap',
      group: MAP_AND_POSITION,
      hint: 'Сохраняет в телефоне карту района 5×5 км вокруг вас, только по Wi-Fi.',
      icon: 'download',
      label: offlineMap && offlineMapMb ? `Карта без сети · ${offlineMapMb} МБ` : 'Карта без сети',
      on: offlineMap,
      onPress: () => void onOfflineMapChange(!offlineMap),
    },
    {
      key: 'placeNotifications',
      group: NOTIFICATIONS,
      icon: 'bell',
      label: 'Уведомления о местах',
      on: placeNotifications,
      onPress: () => void onPlaceNotificationsChange(!placeNotifications),
    },
    {
      key: 'weeklySummary',
      group: NOTIFICATIONS,
      hint: 'Раз в неделю: сколько километров и мест вы открыли.',
      icon: 'award',
      label: 'Итоги недели',
      on: weeklySummary,
      onPress: () => void onWeeklySummaryChange(!weeklySummary),
    },
  ];

  const items = page === 'main' ? mainItems : page === 'settings' ? settingsItems : accountItems;

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
