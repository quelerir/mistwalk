import { routeBackgroundLocations, type RoutedLocation } from './routeBackgroundLocations';

const a: RoutedLocation = { lat: 1, lng: 2, accuracy: 5, ts: 100 };
const b: RoutedLocation = { lat: 3, lng: 4, accuracy: 6, ts: 200 };

describe('routeBackgroundLocations', () => {
  it('gives points to the live handler and does NOT buffer them (no duplicates on next launch)', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const append = jest.fn().mockResolvedValue(undefined);

    await routeBackgroundLocations([a, b], handler, append);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledWith({ lat: 1, lng: 2 }, 5);
    expect(append).not.toHaveBeenCalled();
  });

  it('buffers every point when no live handler is registered (headless launch)', async () => {
    const append = jest.fn().mockResolvedValue(undefined);

    await routeBackgroundLocations([a, b], null, append);

    expect(append).toHaveBeenCalledWith([
      { lat: 1, lng: 2, ts: 100 },
      { lat: 3, lng: 4, ts: 200 },
    ]);
  });

  it('buffers only the points whose handler call failed', async () => {
    const handler = jest.fn().mockRejectedValueOnce(new Error('store gone')).mockResolvedValueOnce(undefined);
    const append = jest.fn().mockResolvedValue(undefined);

    await routeBackgroundLocations([a, b], handler, append);

    expect(append).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledWith([{ lat: 1, lng: 2, ts: 100 }]);
  });

  it('does nothing for an empty batch', async () => {
    const append = jest.fn();
    await routeBackgroundLocations([], jest.fn(), append);
    expect(append).not.toHaveBeenCalled();
  });
});
