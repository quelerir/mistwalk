import { lightenDarkStyle, type MapStyleJson } from './darkStyle';

const style = (): MapStyleJson => ({
  version: 8,
  sources: { openmaptiles: { type: 'vector', url: 'https://example.test/tiles' } },
  glyphs: 'https://example.test/fonts/{fontstack}/{range}.pbf',
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': 'rgb(12,12,12)' } },
    { id: 'water', type: 'fill', paint: { 'fill-color': 'rgb(27 ,27 ,29)' } },
    { id: 'building', type: 'fill', paint: { 'fill-color': 'rgb(10,10,10)', 'fill-outline-color': 'rgb(27 ,27 ,29)', 'fill-antialias': true } },
    {
      id: 'highway_motorway_inner',
      type: 'line',
      paint: { 'line-color': ['interpolate', ['linear'], ['zoom'], 5.8, 'hsla(0,0%,85%,0.53)', 6, '#000'], 'line-width': 3 },
    },
    { id: 'place_city', type: 'symbol', paint: { 'text-color': 'rgb(101,101,101)', 'text-halo-color': 'rgba(0,0,0,0.7)', 'text-halo-width': 1 } },
    { id: 'something_new', type: 'fill', paint: { 'fill-color': 'rgb(1,2,3)' } },
  ],
});

const layer = (s: MapStyleJson, id: string) => s.layers.find((l) => l.id === id)!;

describe('lightenDarkStyle', () => {
  it('lifts the colours of the layers it knows', () => {
    const out = lightenDarkStyle(style());
    expect(layer(out, 'background').paint!['background-color']).toBe('#1b2129');
    expect(layer(out, 'water').paint!['fill-color']).toBe('#173042');
    expect(layer(out, 'building').paint!['fill-color']).toBe('#2b323c');
    expect(layer(out, 'place_city').paint!['text-color']).toBe('#bfc6d0');
  });

  it('keeps the other paint properties, and the sources, glyphs and layer order', () => {
    const before = style();
    const out = lightenDarkStyle(before);
    expect(layer(out, 'building').paint!['fill-antialias']).toBe(true);
    expect(layer(out, 'place_city').paint!['text-halo-width']).toBe(1);
    expect(out.sources).toEqual(before.sources);
    expect(out.glyphs).toBe(before.glyphs);
    expect(out.layers.map((l) => l.id)).toEqual(before.layers.map((l) => l.id));
  });

  it('swaps the colour inside a zoom expression and keeps the rest of it', () => {
    const out = lightenDarkStyle(style());
    expect(layer(out, 'highway_motorway_inner').paint!['line-color']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      5.8,
      'hsla(0,0%,85%,0.53)',
      6,
      '#5b6573',
    ]);
  });

  it('leaves layers it does not know as they are', () => {
    const out = lightenDarkStyle(style());
    expect(layer(out, 'something_new').paint!['fill-color']).toBe('rgb(1,2,3)');
  });

  it('does not change the style it was given', () => {
    const before = style();
    const snapshot = JSON.stringify(before);
    lightenDarkStyle(before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('does not invent a paint property a layer does not have', () => {
    const s = style();
    delete layer(s, 'building').paint!['fill-outline-color'];
    expect(layer(lightenDarkStyle(s), 'building').paint).not.toHaveProperty('fill-outline-color');
  });

  it('copes with a style without the expected layers', () => {
    expect(lightenDarkStyle({ layers: [] })).toEqual({ layers: [] });
  });
});
