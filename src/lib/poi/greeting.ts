import type { TFunc } from '../../i18n';
import type { PoiKind } from './types';

export const KIND_ICON: Record<PoiKind, string> = {
  viewpoint: '◉',
  monument: '▲',
  castle: '♜',
  ruins: '◆',
  attraction: '★',
  artwork: '✎',
  museum: '▦',
  park: '❦',
  beach: '≈',
  worship: '✚',
  nature: '▲',
};

// The name of a kind of place, and the words said when one is found, in the language in use.
export function kindLabel(t: TFunc, kind: PoiKind): string {
  return t(`kind.${kind}`);
}

export function greetingFor(t: TFunc, kind: PoiKind): string {
  return t(`greet.${kind}`);
}
