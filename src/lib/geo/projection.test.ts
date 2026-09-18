import { metersPerPixel, projectToScreen } from './projection';

const size = { width: 400, height: 800 };

describe('projectToScreen', () => {
  it('puts the view center in the middle of the canvas', () => {
    const view = { center: [44.8271, 41.7151] as [number, number], zoom: 16, bearing: 0 };
    const p = projectToScreen(44.8271, 41.7151, view, size);
    expect(p.x).toBeCloseTo(200, 5);
    expect(p.y).toBeCloseTo(400, 5);
  });

  it('places a point to the east on the right and to the north above', () => {
    const view = { center: [0, 0] as [number, number], zoom: 10, bearing: 0 };
    const east = projectToScreen(0.01, 0, view, size);
    const north = projectToScreen(0, 0.01, view, size);
    expect(east.x).toBeGreaterThan(200);
    expect(east.y).toBeCloseTo(400, 5);
    expect(north.y).toBeLessThan(400);
    expect(north.x).toBeCloseTo(200, 5);
  });

  it('spans one 512px tile per zoom level: 180 degrees of longitude at zoom 0 is 256px', () => {
    const view = { center: [0, 0] as [number, number], zoom: 0, bearing: 0 };
    const p = projectToScreen(180, 0, view, size);
    expect(p.x - 200).toBeCloseTo(256, 5);
  });

  it('rotates the map so that with bearing 90 east points up', () => {
    const view = { center: [0, 0] as [number, number], zoom: 10, bearing: 90 };
    const east = projectToScreen(0.01, 0, view, size);
    expect(east.x).toBeCloseTo(200, 5);
    expect(east.y).toBeLessThan(400);
  });
});

describe('metersPerPixel', () => {
  it('is the equator circumference over the 512px world at zoom 0', () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(40075016.686 / 512, 3);
  });

  it('shrinks with latitude and halves with each zoom level', () => {
    expect(metersPerPixel(10, 60)).toBeCloseTo(metersPerPixel(10, 0) / 2, 3);
    expect(metersPerPixel(11, 0)).toBeCloseTo(metersPerPixel(10, 0) / 2, 6);
  });
});
