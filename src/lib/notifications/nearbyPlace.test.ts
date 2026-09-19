import { NOTIFY_COOLDOWN_MS, NOTIFY_RADIUS_METERS, PLACE_REPEAT_MS, pickPlaceToNotify, recordNotified, type NotifyState } from './nearbyPlace';
import type { Poi } from '../poi/types';

const here = { lat: 55.75, lng: 37.6 };
const now = 10 * 24 * 3600 * 1000;
const empty: NotifyState = { lastAt: 0, places: {} };

// ~0.0009 degrees of latitude is about 100 m.
function poi(id: string, dLat: number): Poi {
  return { id, name: id, kind: 'monument', lat: here.lat + dLat, lng: here.lng };
}

describe('pickPlaceToNotify', () => {
  it('picks the nearest undiscovered place inside the radius', () => {
    const far = poi('far', 0.0012);
    const near = poi('near', 0.0006);
    expect(pickPlaceToNotify(here, [far, near], new Set(), empty, now)?.id).toBe('near');
  });

  it('ignores places outside the radius', () => {
    expect(pickPlaceToNotify(here, [poi('out', 0.004)], new Set(), empty, now)).toBeNull();
    expect(NOTIFY_RADIUS_METERS).toBe(150);
  });

  it('ignores places that are already discovered', () => {
    expect(pickPlaceToNotify(here, [poi('a', 0.0006)], new Set(['a']), empty, now)).toBeNull();
  });

  it('stays quiet during the cooldown after the last notification', () => {
    const state: NotifyState = { lastAt: now - NOTIFY_COOLDOWN_MS + 1000, places: {} };
    expect(pickPlaceToNotify(here, [poi('a', 0.0006)], new Set(), state, now)).toBeNull();
    const later: NotifyState = { lastAt: now - NOTIFY_COOLDOWN_MS - 1000, places: {} };
    expect(pickPlaceToNotify(here, [poi('a', 0.0006)], new Set(), later, now)?.id).toBe('a');
  });

  it('does not repeat the same place within a day, but offers another one', () => {
    const state: NotifyState = { lastAt: now - NOTIFY_COOLDOWN_MS - 1, places: { a: now - PLACE_REPEAT_MS + 1000 } };
    const a = poi('a', 0.0004);
    const b = poi('b', 0.0008);
    expect(pickPlaceToNotify(here, [a, b], new Set(), state, now)?.id).toBe('b');
    expect(pickPlaceToNotify(here, [a], new Set(), state, now)).toBeNull();
  });
});

describe('recordNotified', () => {
  it('stores the time and the place, and drops entries older than a day', () => {
    const state: NotifyState = { lastAt: 1, places: { old: now - PLACE_REPEAT_MS - 1, recent: now - 1000 } };
    const next = recordNotified(state, 'new', now);
    expect(next.lastAt).toBe(now);
    expect(next.places).toEqual({ recent: now - 1000, new: now });
  });
});
