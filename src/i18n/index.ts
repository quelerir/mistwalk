import AsyncStorage from '@react-native-async-storage/async-storage';
import { deviceLocales } from './device';
import { en } from './en';
import { getLanguageSetting, pickLanguage, resolveLanguage, type Lang } from './language';
import { ru, type Key } from './ru';
import { render, type Params, type Text } from './translate';

export type { Key } from './ru';
export type { Params } from './translate';
export type { Lang, LanguageSetting } from './language';
export { LANGUAGES } from './language';

export type TFunc = (key: Key, params?: Params) => string;

const DICTIONARIES: Record<Lang, Record<Key, Text>> = { ru, en };

// The translator for a language. A key a language lacks falls back to Russian, then to the key itself, so a text is
// never blank.
export function makeT(lang: Lang): TFunc {
  return (key, params) => render(DICTIONARIES[lang][key] ?? ru[key] ?? key, lang, params);
}

// The language in use, for code that is not a component and so cannot ask the provider (the value follows the provider).
let currentLang: Lang = pickLanguage(deviceLocales());

export function getCurrentLang(): Lang {
  return currentLang;
}

export function setCurrentLang(lang: Lang): void {
  currentLang = lang;
}

// The translator for the language in use now.
export function tNow(key: Key, params?: Params): string {
  return makeT(currentLang)(key, params);
}

// For work done with the app closed (notifications from the background): the language the person chose, read from the
// phone's storage, or the phone's own.
export async function loadTranslator(): Promise<{ lang: Lang; t: TFunc }> {
  const setting = await getLanguageSetting(AsyncStorage);
  const lang = resolveLanguage(setting, deviceLocales());
  return { lang, t: makeT(lang) };
}
