import { isPlaceholderView, pickNextTile } from './tileQueue';

const t = (x: number, y: number) => ({ x, y, z: 13 });

describe('pickNextTile', () => {
  it('takes the tile nearest to the focus, not the one that has waited longest', () => {
    const queue = [t(100, 100), t(5, 5), t(52, 51)];
    expect(pickNextTile(queue, t(50, 50))).toBe(2);
  });

  it('takes the first one when there is no focus yet, and on a tie', () => {
    expect(pickNextTile([t(9, 9), t(1, 1)], null)).toBe(0);
    expect(pickNextTile([t(49, 50), t(51, 50)], t(50, 50))).toBe(0);
  });

  it('says -1 for an empty queue', () => {
    expect(pickNextTile([], t(1, 1))).toBe(-1);
  });
});

describe('isPlaceholderView', () => {
  it('is true only for the open-sea placeholder at 0, 0', () => {
    expect(isPlaceholderView([0, 0])).toBe(true);
    expect(isPlaceholderView([0.01, -0.02])).toBe(true);
    expect(isPlaceholderView([-122.4, 37.8])).toBe(false);
    expect(isPlaceholderView([41.6, 41.6])).toBe(false);
  });
});
