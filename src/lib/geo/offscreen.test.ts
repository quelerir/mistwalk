import { edgeIndicator } from './offscreen';

const size = { width: 400, height: 800 };

describe('edgeIndicator', () => {
  it('is null while the target is on screen', () => {
    expect(edgeIndicator({ x: 200, y: 400 }, size, 30)).toBeNull();
    expect(edgeIndicator({ x: 40, y: 790 - 30 }, size, 30)).toBeNull();
  });

  it('points up and sits on the top edge for a target straight above', () => {
    const e = edgeIndicator({ x: 200, y: -500 }, size, 30);
    expect(e?.x).toBeCloseTo(200, 5);
    expect(e?.y).toBeCloseTo(30, 5);
    expect(e?.angle).toBeCloseTo(0, 5);
  });

  it('points right on the right edge for a target far to the east', () => {
    const e = edgeIndicator({ x: 2000, y: 400 }, size, 30);
    expect(e?.x).toBeCloseTo(370, 5);
    expect(e?.y).toBeCloseTo(400, 5);
    expect(e?.angle).toBeCloseTo(90, 5);
  });

  it('clamps a diagonal target to a corner-side edge along the line to it', () => {
    const e = edgeIndicator({ x: 1400, y: 1600 }, size, 30);
    expect(e?.x).toBeLessThanOrEqual(370);
    expect(e?.y).toBeLessThanOrEqual(770);
    expect(Math.max(e!.x - 370, e!.y - 770)).toBeCloseTo(0, 5);
    expect(e?.angle).toBeGreaterThan(90);
    expect(e?.angle).toBeLessThan(180);
  });
});
