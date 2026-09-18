import { shouldRecordPoint } from './throttle';

describe('shouldRecordPoint', () => {
  it('always records the first point (no last recorded)', () => {
    expect(shouldRecordPoint(null, { lat: 0, lng: 0 }, 30)).toBe(true);
  });

  it('rejects a point closer than the threshold', () => {
    const last = { lat: 55.751244, lng: 37.618423 };
    const near = { lat: 55.751250, lng: 37.618423 }; // a few meters away
    expect(shouldRecordPoint(last, near, 30)).toBe(false);
  });

  it('accepts a point farther than the threshold', () => {
    const last = { lat: 55.751244, lng: 37.618423 };
    const far = { lat: 55.752244, lng: 37.618423 }; // ~111m north
    expect(shouldRecordPoint(last, far, 30)).toBe(true);
  });
});
