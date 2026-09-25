import { FOG_HEATMAP, fogHeatmapPaint, heatmapRadiusExpression, heatmapRadiusPx } from './fogHeatmap';
import { metersPerPixel } from '../geo/projection';
import { FOG_PALETTES } from '../settings/fogStyle';

const LAT = 41.6;

describe('heatmapRadiusPx', () => {
  it('is the kernel radius in metres over the metres one pixel covers', () => {
    const expected = (FOG_HEATMAP.clearRadiusMeters * FOG_HEATMAP.kernelFactor) / metersPerPixel(17, LAT);
    expect(heatmapRadiusPx(17, LAT)).toBeCloseTo(expected, 6);
  });

  it('doubles with every zoom level up to the cap and stops growing after it', () => {
    expect(heatmapRadiusPx(11, LAT) / heatmapRadiusPx(10, LAT)).toBeCloseTo(2, 6);
    expect(heatmapRadiusPx(FOG_HEATMAP.maxRadiusZoom + 2, LAT)).toBeCloseTo(heatmapRadiusPx(FOG_HEATMAP.maxRadiusZoom, LAT), 6);
  });
});

describe('heatmapRadiusExpression', () => {
  type Parts = [string, unknown[], unknown[], number, number, number, number];

  it('is an exponential zoom interpolation whose ends match heatmapRadiusPx', () => {
    const [kind, base, input, z0, r0, z1, r1] = heatmapRadiusExpression(LAT) as unknown as Parts;
    expect(kind).toBe('interpolate');
    expect(base).toEqual(['exponential', 2]);
    expect(input).toEqual(['zoom']);
    expect(z0).toBe(0);
    expect(r0).toBeCloseTo(heatmapRadiusPx(0, LAT), 9);
    expect(z1).toBe(FOG_HEATMAP.maxRadiusZoom);
    expect(r1).toBeCloseTo(heatmapRadiusPx(FOG_HEATMAP.maxRadiusZoom, LAT), 6);
  });

  it('gives the exact radius in between (base-2 interpolation of a 2^z curve)', () => {
    const [, , , z0, r0, z1, r1] = heatmapRadiusExpression(LAT) as unknown as Parts;
    const z = 15;
    const t = (2 ** z - 2 ** z0) / (2 ** z1 - 2 ** z0);
    expect(r0 + (r1 - r0) * t).toBeCloseTo(heatmapRadiusPx(z, LAT), 4);
  });
});

describe('fogHeatmapPaint', () => {
  const paint = fogHeatmapPaint(FOG_PALETTES.ink, LAT);

  it('is the fog colour where nothing has been visited and clear where a lot has', () => {
    const ramp = paint['heatmap-color'] as unknown[];
    expect(ramp.slice(0, 3)).toEqual(['interpolate', ['linear'], ['heatmap-density']]);
    expect(ramp[3]).toBe(0);
    expect(ramp[4]).toBe('rgba(59,64,77,1)');
    expect(ramp[5]).toBe(FOG_HEATMAP.clearAtDensity);
    expect(ramp[6]).toBe('rgba(59,64,77,0)');
  });

  it('uses the radius expression and full opacity', () => {
    expect(paint['heatmap-radius']).toEqual(heatmapRadiusExpression(LAT));
    expect(paint['heatmap-opacity']).toBe(1);
  });
});
