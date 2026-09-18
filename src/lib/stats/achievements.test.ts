import { evaluateAchievements, type Stats } from './achievements';

const empty: Stats = { areaKm2: 0, distanceKm: 0, streakDays: 0, discoveredCount: 0, discoveredKinds: 0, totalPoints: 0 };
const find = (stats: Stats, id: string) => evaluateAchievements(stats).find((a) => a.id === id)!;

describe('evaluateAchievements', () => {
  it('has nothing unlocked and zero progress for a brand-new user', () => {
    const all = evaluateAchievements(empty);
    expect(all.every((a) => !a.unlocked && a.progress === 0)).toBe(true);
    expect(new Set(all.map((a) => a.id)).size).toBe(all.length);
  });

  it('unlocks a milestone at its threshold and caps progress at 1', () => {
    expect(find({ ...empty, distanceKm: 1 }, 'walker-1').unlocked).toBe(true);
    expect(find({ ...empty, distanceKm: 50 }, 'walker-1').progress).toBe(1);
    expect(find({ ...empty, distanceKm: 0.99 }, 'walker-1').unlocked).toBe(false);
  });

  it('reports partial progress toward a bigger goal', () => {
    const a = find({ ...empty, discoveredCount: 4 }, 'explorer-10');
    expect(a.progress).toBeCloseTo(0.4);
    expect(a.unlocked).toBe(false);
  });

  it('unlocks streak and collector badges', () => {
    expect(find({ ...empty, streakDays: 7 }, 'streak-7').unlocked).toBe(true);
    expect(find({ ...empty, discoveredKinds: 3 }, 'collector').unlocked).toBe(true);
  });
});
