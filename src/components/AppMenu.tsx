import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MenuSheet, { type MenuItem } from './MenuSheet';
import { useTheme } from '../theme/ThemeProvider';
import { nextThemePreference, THEME_LABELS } from '../theme/palettes';
import { FOG_STYLE_LABELS, nextFogStyle, type FogStyle } from '../lib/settings/fogStyle';
import {
  getAccuracyProfile,
  setAccuracyProfile,
  type AccuracyProfile,
} from '../lib/settings/accuracyProfile';

export interface AppMenuProps {
  visible: boolean;
  onClose: () => void;
  fogStyle: FogStyle;
  onFogStyleChange: (style: FogStyle) => void;
  backgroundEnabled: boolean;
  onEnableBackground: () => Promise<boolean>;
  onSignOut: () => Promise<void>;
}

export default function AppMenu({
  visible,
  onClose,
  fogStyle,
  onFogStyleChange,
  backgroundEnabled,
  onEnableBackground,
  onSignOut,
}: AppMenuProps) {
  const [accuracy, setAccuracy] = useState<AccuracyProfile>('battery-saver');
  const { preference, setPreference } = useTheme();
  const [page, setPage] = useState<'main' | 'settings'>('main');

  useEffect(() => {
    if (!visible) setPage('main');
  }, [visible]);

  useEffect(() => {
    void getAccuracyProfile(AsyncStorage).then(setAccuracy);
  }, []);

  function chooseAccuracy(next: AccuracyProfile) {
    setAccuracy(next);
    void setAccuracyProfile(AsyncStorage, next);
  }

  function closeThen(action: () => void) {
    return () => {
      onClose();
      action();
    };
  }

  const mainItems: MenuItem[] = [
    { key: 'settings', icon: 'settings', label: 'Настройки', onPress: () => setPage('settings') },
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
      icon: 'moon',
      label: 'Тема',
      value: THEME_LABELS[preference],
      onPress: () => setPreference(nextThemePreference(preference)),
    },
    {
      key: 'fog',
      icon: 'cloud',
      label: 'Стиль тумана',
      value: FOG_STYLE_LABELS[fogStyle],
      onPress: () => onFogStyleChange(nextFogStyle(fogStyle)),
    },
    {
      key: 'accuracy',
      icon: 'locate',
      label: 'Точность GPS',
      value: accuracy === 'precise' ? 'Точный' : 'Экономия',
      onPress: () => chooseAccuracy(accuracy === 'precise' ? 'battery-saver' : 'precise'),
    },
    {
      key: 'background',
      icon: 'navigate',
      label: 'Работа в фоне',
      value: backgroundEnabled ? 'Включена' : 'Включить',
      onPress: () => {
        if (!backgroundEnabled) void onEnableBackground();
      },
    },
  ];

  const items = page === 'main' ? mainItems : settingsItems;

  return <MenuSheet visible={visible} items={items} onClose={onClose} />;
}
