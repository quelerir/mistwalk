import { en } from './en';
import { ru, type Key } from './ru';
import { isPlural, type Text } from './translate';

const languages: Array<[string, Record<Key, Text>]> = [['en', en]];
const keys = Object.keys(ru) as Key[];

// The {names} a text needs values for.
function placeholders(text: Text): string[] {
  const parts = isPlural(text) ? Object.values(text) : [text];
  return Array.from(new Set(parts.flatMap((p) => Array.from(p.matchAll(/\{(\w+)\}/g), (m) => m[1])))).sort();
}

describe('the dictionaries', () => {
  it.each(languages)('%s has exactly the keys of the Russian one', (_name, dictionary) => {
    expect(Object.keys(dictionary).sort()).toEqual([...keys].sort());
  });

  it.each(languages)('%s uses the same {names} as the Russian text of every key', (_name, dictionary) => {
    const wrong = keys.filter((k) => placeholders(dictionary[k]).join() !== placeholders(ru[k]).join());
    expect(wrong).toEqual([]);
  });

  it.each(languages)('%s has no empty texts', (_name, dictionary) => {
    const empty = keys.filter((k) => (isPlural(dictionary[k]) ? Object.values(dictionary[k]).some((v) => !v) : !dictionary[k]));
    expect(empty).toEqual([]);
  });

  it('gives every text with forms an "other" form', () => {
    for (const [name, dictionary] of [['ru', ru as Record<Key, Text>] as const, ...languages]) {
      const missing = keys.filter((k) => isPlural(dictionary[k]) && !(dictionary[k] as { other?: string }).other);
      expect([name, missing]).toEqual([name, []]);
    }
  });

  it('keeps forms wherever the Russian text counts things with {n}', () => {
    // A number followed by a word, written into a plain string, cannot say "1 place" and "5 places" correctly.
    const plainCounts = keys.filter((k) => !isPlural(ru[k]) && /\{n\}\s*(мест|места|место)/.test(ru[k] as string));
    expect(plainCounts).toEqual([]);
  });
});
