import { pluralForm, type PluralForm } from './plural';

// A text is a string with {name} places for values, or a set of forms for a number: {n} decides which is used.
export type Plural = Partial<Record<PluralForm, string>> & { other: string };
export type Text = string | Plural;
export type Params = Record<string, string | number>;

export function isPlural(text: Text): text is Plural {
  return typeof text === 'object';
}

function fill(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

// Picks the form for `params.n` (when the text has forms) and puts the values in.
export function render(text: Text, lang: string, params?: Params): string {
  if (!isPlural(text)) return fill(text, params);
  const n = typeof params?.n === 'number' ? params.n : Number(params?.n);
  const form = Number.isFinite(n) ? pluralForm(lang, n) : 'other';
  return fill(text[form] ?? text.other, params);
}
