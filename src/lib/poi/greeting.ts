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

export const KIND_LABEL: Record<PoiKind, string> = {
  viewpoint: 'Смотровая площадка',
  monument: 'Памятник',
  castle: 'Замок',
  ruins: 'Руины',
  attraction: 'Достопримечательность',
  artwork: 'Арт-объект',
  museum: 'Музей',
  park: 'Парк',
  beach: 'Пляж',
  worship: 'Храм',
  nature: 'Природа',
};

const GREETINGS: Record<PoiKind, string> = {
  viewpoint: 'Отсюда открывается вид. Остановитесь на минуту и оглядитесь.',
  monument: 'Вы дошли до памятного места. Здесь есть что вспомнить.',
  castle: 'Перед вами настоящая крепость. Добро пожаловать!',
  ruins: 'Древние руины хранят много историй. Вы их нашли.',
  attraction: 'Достопримечательность найдена. Хорошая прогулка!',
  artwork: 'Вы нашли произведение искусства прямо на улице.',
  museum: 'Здесь хранится много интересного. Загляните внутрь, если есть время.',
  park: 'Тенистое место для прогулки. Можно немного отдохнуть.',
  beach: 'Море совсем рядом. Самое время разуться.',
  worship: 'Тихое место с длинной историей. Вы его нашли.',
  nature: 'Красота, которую никто не строил. Хорошее место.',
};

export function greetingFor(kind: PoiKind): string {
  return GREETINGS[kind];
}
