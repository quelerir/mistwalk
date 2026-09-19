import { projectToScreen, worldPoint, worldTransform, originOnScreen, type ViewNumbers } from './projection';

// Apply the transform list the way Skia does: left to right, each one applied to the point after the ones on its right.
function apply(transform: Array<Record<string, number>>, p: { x: number; y: number }) {
  let { x, y } = p;
  for (let i = transform.length - 1; i >= 0; i--) {
    const t = transform[i];
    if ('translateX' in t) x += t.translateX;
    else if ('translateY' in t) y += t.translateY;
    else if ('scale' in t) {
      x *= t.scale;
      y *= t.scale;
    } else if ('rotate' in t) {
      const c = Math.cos(t.rotate);
      const s = Math.sin(t.rotate);
      [x, y] = [x * c - y * s, x * s + y * c];
    }
  }
  return { x, y };
}

const origin = { lng: 37.6, lat: 55.75 };
const size = { width: 390, height: 844 };

describe('world-space transform', () => {
  const cases: Array<[string, ViewNumbers]> = [
    ['street zoom', { lng: 37.601, lat: 55.751, zoom: 16.4, bearing: 0, ...size }],
    ['rotated', { lng: 37.598, lat: 55.749, zoom: 15, bearing: 40, ...size }],
    ['zoomed out, rotated back', { lng: 37.62, lat: 55.76, zoom: 12.3, bearing: -75, ...size }],
  ];

  it.each(cases)('puts a point on the same pixel as projectToScreen (%s)', (_name, v) => {
    const target = { lng: 37.6042, lat: 55.7527 };
    const expected = projectToScreen(target.lng, target.lat, { center: [v.lng, v.lat], zoom: v.zoom, bearing: v.bearing }, size);
    const got = apply(worldTransform(v, origin) as unknown as Array<Record<string, number>>, worldPoint(target.lng, target.lat, origin));
    expect(got.x).toBeCloseTo(expected.x, 3);
    expect(got.y).toBeCloseTo(expected.y, 3);
  });

  it.each(cases)('places the origin where projectToScreen does (%s)', (_name, v) => {
    const expected = projectToScreen(origin.lng, origin.lat, { center: [v.lng, v.lat], zoom: v.zoom, bearing: v.bearing }, size);
    const got = originOnScreen(v, origin);
    expect(got.x).toBeCloseTo(expected.x, 3);
    expect(got.y).toBeCloseTo(expected.y, 3);
  });
});
