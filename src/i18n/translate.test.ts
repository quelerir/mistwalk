import { pluralForm } from './plural';
import { render } from './translate';
import { getLanguageSetting, parseLanguageSetting, pickLanguage, resolveLanguage, setLanguageSetting } from './language';

describe('pluralForm', () => {
  it('follows the Russian forms', () => {
    expect([1, 21, 101].map((n) => pluralForm('ru', n))).toEqual(['one', 'one', 'one']);
    expect([2, 3, 4, 22, 24, 102].map((n) => pluralForm('ru', n))).toEqual(['few', 'few', 'few', 'few', 'few', 'few']);
    expect([0, 5, 11, 12, 13, 14, 20, 25, 111, 112].map((n) => pluralForm('ru', n))).toEqual(Array(10).fill('many'));
  });

  it('follows the English forms', () => {
    expect(pluralForm('en', 1)).toBe('one');
    expect([0, 2, 5, 21].map((n) => pluralForm('en', n))).toEqual(['other', 'other', 'other', 'other']);
  });

  it('calls a fraction "other"', () => {
    expect(pluralForm('ru', 1.5)).toBe('other');
    expect(pluralForm('en', 1.5)).toBe('other');
  });
});

describe('render', () => {
  it('puts the values in the {places}', () => {
    expect(render('Открыто {a} из {b}', 'ru', { a: 3, b: 10 })).toBe('Открыто 3 из 10');
  });

  it('leaves a place alone when there is no value for it, and does not touch plain text', () => {
    expect(render('Привет, {name}', 'ru', {})).toBe('Привет, {name}');
    expect(render('Привет', 'ru')).toBe('Привет');
  });

  it('picks the form of the word for the number', () => {
    const text = { one: '{n} место', few: '{n} места', many: '{n} мест', other: '{n} места' };
    expect(render(text, 'ru', { n: 1 })).toBe('1 место');
    expect(render(text, 'ru', { n: 3 })).toBe('3 места');
    expect(render(text, 'ru', { n: 12 })).toBe('12 мест');
    expect(render({ one: '{n} place', other: '{n} places' }, 'en', { n: 1 })).toBe('1 place');
    expect(render({ one: '{n} place', other: '{n} places' }, 'en', { n: 7 })).toBe('7 places');
  });

  it('falls back to "other" when a form is missing', () => {
    expect(render({ other: '{n} мест' }, 'ru', { n: 1 })).toBe('1 мест');
  });
});

describe('choosing the language', () => {
  it('takes the first language of the phone that the app has', () => {
    expect(pickLanguage(['ru-BY', 'en-US'])).toBe('ru');
    expect(pickLanguage(['be-BY', 'ru-BY'])).toBe('ru');
    expect(pickLanguage(['en_US'])).toBe('en');
    expect(pickLanguage(['de-DE', 'EN-gb'])).toBe('en');
  });

  it('uses English when the phone has nothing the app speaks', () => {
    expect(pickLanguage(['ja-JP'])).toBe('en');
    expect(pickLanguage([])).toBe('en');
    expect(pickLanguage([null, undefined, ''])).toBe('en');
  });

  it('lets a choice beat the phone, and "auto" follow it', () => {
    expect(resolveLanguage('en', ['ru-RU'])).toBe('en');
    expect(resolveLanguage('auto', ['ru-RU'])).toBe('ru');
  });

  it('reads and saves the setting, and shrugs off junk', async () => {
    const store: Record<string, string> = {};
    const storage = { getItem: async (k: string) => store[k] ?? null, setItem: async (k: string, v: string) => void (store[k] = v) };
    expect(await getLanguageSetting(storage)).toBe('auto');
    await setLanguageSetting(storage, 'en');
    expect(await getLanguageSetting(storage)).toBe('en');
    expect(parseLanguageSetting('klingon')).toBe('auto');
    expect(parseLanguageSetting(null)).toBe('auto');
  });
});
