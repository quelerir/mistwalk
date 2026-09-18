import type { PoiKind } from './types';

export const KIND_ICON: Record<PoiKind, string> = {
  viewpoint: '◉',
  monument: '▲',
  castle: '♜',
  ruins: '◆',
  attraction: '★',
  artwork: '✎',
};

const GREETINGS: Record<PoiKind, string> = {
  viewpoint: 'Отсюда открывается вид. Остановитесь на минуту и оглядитесь.',
  monument: 'Вы дошли до памятного места. Здесь есть что вспомнить.',
  castle: 'Перед вами настоящая крепость. Добро пожаловать!',
  ruins: 'Древние руины хранят много историй. Вы их нашли.',
  attraction: 'Достопримечательность найдена. Хорошая прогулка!',
  artwork: 'Вы нашли произведение искусства прямо на улице.',
};

export function greetingFor(kind: PoiKind): string {
  return GREETINGS[kind];
}
