export interface RoutedLocation {
  lat: number;
  lng: number;
  accuracy: number;
  ts: number;
}

export type LiveHandler = (
  coord: { lat: number; lng: number },
  accuracy: number
) => void | Promise<void>;

export async function routeBackgroundLocations(
  locations: RoutedLocation[],
  handler: LiveHandler | null,
  appendPending: (points: Array<{ lat: number; lng: number; ts: number }>) => Promise<void>
): Promise<void> {
  const unhandled: RoutedLocation[] = [];

  for (const location of locations) {
    if (!handler) {
      unhandled.push(location);
      continue;
    }
    try {
      await handler({ lat: location.lat, lng: location.lng }, location.accuracy);
    } catch {
      unhandled.push(location);
    }
  }

  if (unhandled.length > 0) {
    await appendPending(unhandled.map(({ lat, lng, ts }) => ({ lat, lng, ts })));
  }
}
