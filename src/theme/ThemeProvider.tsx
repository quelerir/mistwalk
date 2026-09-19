import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PALETTES,
  parseThemePreference,
  resolveScheme,
  type ColorScheme,
  type Colors,
  type ThemePreference,
} from './palettes';

const STORAGE_KEY = 'settings.theme.v1';

interface ThemeValue {
  colors: Colors;
  scheme: ColorScheme;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue>({
  colors: PALETTES.light,
  scheme: 'light',
  preference: 'system',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setPreferenceState(parseThemePreference(raw)))
      .catch(() => {});
  }, []);

  // Native pieces (keyboard, alerts, status bar) follow the same choice.
  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const scheme = resolveScheme(preference, system);
    return { colors: PALETTES[scheme], scheme, preference, setPreference };
  }, [preference, system, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

// Styles are built from a module-level factory, so they only rebuild when the palette changes.
export function useStyles<T>(factory: (colors: Colors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
