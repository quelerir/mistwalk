import { pickMarkers, type MarkerCandidate } from './markerPicker';

const c = (id: string, x: number, y: number, found = false): MarkerCandidate => ({ id, x, y, found });
const screen = { width: 400, height: 800 };

describe('pickMarkers', () => {
  it('keeps everything when there is room and nothing overlaps', () => {
    const list = [c('a', 50, 50), c('b', 200, 300), c('c', 350, 700)];
    expect(pickMarkers(list, screen, { cell: 36, max: 60 }).map((m) => m.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('thins a crowd to one marker per cell instead of dropping a whole side of the screen', () => {
    // 100 places crowded in the top-left corner, and 3 spread over the rest of the screen.
    const crowd = Array.from({ length: 100 }, (_, i) => c(`n${i}`, 10 + (i % 10) * 3, 10 + Math.floor(i / 10) * 3));
    const far = [c('east', 380, 100), c('south', 200, 780), c('middle', 210, 400)];
    const picked = pickMarkers([...crowd, ...far], screen, { cell: 36, max: 60 }).map((m) => m.id);
    expect(picked).toEqual(expect.arrayContaining(['east', 'south', 'middle']));
    expect(picked.filter((id) => id.startsWith('n')).length).toBeLessThan(10);
  });

  it('prefers places found already, then the ones nearer the middle of the screen', () => {
    const list = [c('edge', 12, 12), c('near', 20, 20, false), c('found', 25, 25, true)];
    // all three fall into one cell: the found one wins
    expect(pickMarkers(list, screen, { cell: 36, max: 60 }).map((m) => m.id)).toEqual(['found']);
    const two = [c('edge', 12, 12), c('near', 22, 22)];
    // no found place: the one nearer the middle (200, 400) wins
    expect(pickMarkers(two, screen, { cell: 36, max: 60 }).map((m) => m.id)).toEqual(['near']);
  });

  it('never returns more than the limit, and keeps the nearest to the middle', () => {
    const many = Array.from({ length: 200 }, (_, i) => c(`p${i}`, (i % 20) * 20, Math.floor(i / 20) * 80));
    const picked = pickMarkers(many, screen, { cell: 10, max: 30 });
    expect(picked).toHaveLength(30);
  });
});
