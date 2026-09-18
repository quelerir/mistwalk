import { haversineDistanceMeters } from './distance';

describe('haversineDistanceMeters', () => {
  it('returns 0 for identical points', () => {
    const p = { lat: 55.751244, lng: 37.618423 };
    expect(haversineDistanceMeters(p, p)).toBeCloseTo(0, 3);
  });

  it('returns ~157km between Moscow and Tver (known reference distance)', () => {
    const moscow = { lat: 55.751244, lng: 37.618423 };
    const tver = { lat: 56.859611, lng: 35.911896 };
    const distance = haversineDistanceMeters(moscow, tver);
    expect(distance).toBeGreaterThan(150000);
    expect(distance).toBeLessThan(165000);
  });
});
