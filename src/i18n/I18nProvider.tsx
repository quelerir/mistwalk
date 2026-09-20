import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deviceLocales } from './device';
import { getCurrentLang, makeT, setCurrentLang, type TFunc } from './index';
import { getLanguageSetting, resolveLanguage, setLanguageSetting, type Lang, type LanguageSetting } from './language';

interface I18nValue {
  lang: Lang;
  setting: LanguageSetting;
  setSetting: (next: LanguageSetting) => void;
  t: TFunc;
}

const I18nContext = createContext<I18nValue>({
  lang: getCurrentLang(),
  setting: 'auto',
  setSetting: () => {},
  t: makeT(getCurrentLang()),
});

// Holds the language for the whole app: the one the person picked in the menu, or the phone's own ("auto").
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [setting, setSettingState] = useState<LanguageSetting>('auto');
  const [loaded, setLoaded] = useState(false);
  const [locales] = useState(deviceLocales);

  useEffect(() => {
    void getLanguageSetting(AsyncStorage).then((saved) => {
      setSettingState(saved);
      setLoaded(true);
    });
  }, []);

  const setSetting = useCallback((next: LanguageSetting) => {
    setSettingState(next);
    void setLanguageSetting(AsyncStorage, next).catch(() => {});
  }, []);

  const lang = resolveLanguage(setting, locales);
  // Code outside the components reads the language from here.
  setCurrentLang(lang);

  const value = useMemo<I18nValue>(() => ({ lang, setting, setSetting, t: makeT(lang) }), [lang, setting, setSetting]);

  // Nothing is drawn until the saved choice is read, so the screen never flashes in the wrong language.
  if (!loaded) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

// The translator, and it changes when the language does, so the component draws again.
export function useT(): TFunc {
  return useContext(I18nContext).t;
}
