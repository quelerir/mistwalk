import type { KeyValueStorage } from '../lib/settings/accuracyProfile';

// The languages the app speaks. The name of each is written in itself, so a person can find theirs.
export const LANGUAGES = [
  { code: 'ru', name: 'Русский' },
  { code: 'en', name: 'English' },
] as const;

export type Lang = (typeof LANGUAGES)[number]['code'];
// What the person picks: a language, or "auto", which follows the phone.
export type LanguageSetting = 'auto' | Lang;

export const FALLBACK_LANGUAGE: Lang = 'en';
const STORAGE_KEY = 'settings.language.v1';

function isLang(value: unknown): value is Lang {
  return LANGUAGES.some((l) => l.code === value);
}

export function parseLanguageSetting(raw: string | null): LanguageSetting {
  return raw === 'auto' || isLang(raw) ? raw : 'auto';
}

// The first of the phone's languages (most wanted first, like "ru-BY" or "en_US") that the app has; English when none.
export function pickLanguage(deviceLocales: ReadonlyArray<string | null | undefined>): Lang {
  for (const locale of deviceLocales) {
    const code = locale?.split(/[-_]/)[0]?.toLowerCase();
    if (isLang(code)) return code;
  }
  return FALLBACK_LANGUAGE;
}

export function resolveLanguage(setting: LanguageSetting, deviceLocales: ReadonlyArray<string | null | undefined>): Lang {
  return setting === 'auto' ? pickLanguage(deviceLocales) : setting;
}

export async function getLanguageSetting(storage: Pick<KeyValueStorage, 'getItem'>): Promise<LanguageSetting> {
  try {
    return parseLanguageSetting(await storage.getItem(STORAGE_KEY));
  } catch {
    return 'auto';
  }
}

export async function setLanguageSetting(storage: Pick<KeyValueStorage, 'setItem'>, setting: LanguageSetting): Promise<void> {
  await storage.setItem(STORAGE_KEY, setting);
}
