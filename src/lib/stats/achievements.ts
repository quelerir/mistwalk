export interface Stats {
  areaKm2: number;
  distanceKm: number;
  streakDays: number;
  discoveredCount: number;
  discoveredKinds: number;
  totalPoints: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  progress: number;
  unlocked: boolean;
}

interface Rule {
  id: string;
  title: string;
  description: string;
  value: (s: Stats) => number;
  target: number;
}

const RULES: Rule[] = [
  { id: 'first-steps', title: 'Первые шаги', description: 'Откройте первый кусочек карты', value: (s) => s.totalPoints, target: 1 },
  { id: 'first-find', title: 'Первая находка', description: 'Найдите первое тайное место', value: (s) => s.discoveredCount, target: 1 },
  { id: 'walker-1', title: 'Первый километр', description: 'Пройдите 1 км', value: (s) => s.distanceKm, target: 1 },
  { id: 'walker-10', title: 'Десять километров', description: 'Пройдите 10 км', value: (s) => s.distanceKm, target: 10 },
  { id: 'area-01', title: 'Пятно света', description: 'Откройте 0,1 км²', value: (s) => s.areaKm2, target: 0.1 },
  { id: 'area-1', title: 'Квадратный километр', description: 'Откройте 1 км²', value: (s) => s.areaKm2, target: 1 },
  { id: 'explorer-10', title: 'Исследователь', description: 'Найдите 10 мест', value: (s) => s.discoveredCount, target: 10 },
  { id: 'collector', title: 'Коллекционер', description: 'Найдите 3 разных типа мест', value: (s) => s.discoveredKinds, target: 3 },
  { id: 'streak-3', title: 'Три дня подряд', description: 'Гуляйте 3 дня подряд', value: (s) => s.streakDays, target: 3 },
  { id: 'streak-7', title: 'Неделя в пути', description: 'Гуляйте 7 дней подряд', value: (s) => s.streakDays, target: 7 },
];

export function evaluateAchievements(stats: Stats): Achievement[] {
  return RULES.map((rule) => {
    const progress = Math.min(1, rule.value(stats) / rule.target);
    return {
      id: rule.id,
      title: rule.title,
      description: rule.description,
      progress,
      unlocked: progress >= 1,
    };
  });
}
