import { toCoordinate } from './locationTracker';
import type { LocationObject } from 'expo-location';

describe('toCoordinate', () => {
  it('extracts lat/lng/accuracy from a LocationObject', () => {
    const location = {
      coords: { latitude: 55.75, longitude: 37.61, accuracy: 12 },
      timestamp: 0,
    } as LocationObject;

    expect(toCoordinate(location)).toEqual({ lat: 55.75, lng: 37.61, accuracy: 12 });
  });

  it('defaults accuracy to 0 when null', () => {
    const location = {
      coords: { latitude: 1, longitude: 2, accuracy: null },
      timestamp: 0,
    } as unknown as LocationObject;

    expect(toCoordinate(location)).toEqual({ lat: 1, lng: 2, accuracy: 0 });
  });
});
