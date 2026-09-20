import { COUNTRIES, countryName } from './countries';
import { COUNTRY_NAMES_EN } from './countryNamesEn';

describe('country names', () => {
  it('has an English name for every country, and none for a code that is not in the table', () => {
    const codes = COUNTRIES.map((c) => c.code).sort();
    expect(Object.keys(COUNTRY_NAMES_EN).sort()).toEqual(codes);
    expect(codes.filter((c) => !COUNTRY_NAMES_EN[c].trim())).toEqual([]);
  });

  it('says a country in the language asked for', () => {
    expect(countryName('AT', 'ru')).toBe('Австрия');
    expect(countryName('AT', 'en')).toBe('Austria');
    expect(countryName('US', 'en')).toBe('United States');
  });

  it('falls back to the Russian name for a language it has no names in, and to the code for an unknown country', () => {
    expect(countryName('AT', 'de')).toBe('Австрия');
    expect(countryName('ZZ', 'en')).toBe('ZZ');
  });
});
