import type { TFunc } from './index';
import type { Lang } from './language';

// 250 m, 1.4 km: the metres are rounded to ten.
export function formatDistance(t: TFunc, meters: number): string {
  return meters < 1000
    ? t('unit.m', { n: Math.round(meters / 10) * 10 })
    : t('unit.km', { n: (meters / 1000).toFixed(1) });
}

// A decimal number the way the language writes it: 3,3 in Russian, 3.3 in English.
export function decimal(lang: Lang, text: string): string {
  return lang === 'ru' ? text.replace('.', ',') : text;
}

// A day and a short month in the language: "19 сент." or "19 Sep".
export function formatDate(lang: Lang, ts: number): string {
  return new Date(ts).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short' });
}
