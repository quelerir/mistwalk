// Which form of a word a number takes. Russian has one (1, 21, 31…), few (2–4, 22–24…), many (0, 5–20, 25–30…) and, for
// fractions, other; English has one and other. Written out here instead of asking the phone's Intl, which not every
// phone has for every language.
export type PluralForm = 'one' | 'few' | 'many' | 'other';

export function pluralForm(lang: string, n: number): PluralForm {
  if (!Number.isInteger(n)) return 'other';
  const abs = Math.abs(n);
  if (lang === 'ru' || lang === 'uk' || lang === 'be') {
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod10 === 1 && mod100 !== 11) return 'one';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
    return 'many';
  }
  return abs === 1 ? 'one' : 'other';
}
