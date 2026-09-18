import { buildOverpassQuery, parseOverpassResponse } from './overpass';

describe('buildOverpassQuery', () => {
  it('queries named tourism and historic objects inside the bounds', () => {
    const q = buildOverpassQuery({ south: 1, west: 2, north: 3, east: 4 });
    expect(q).toContain('[out:json]');
    expect(q).toContain('(1,2,3,4)');
    expect(q).toContain('viewpoint|attraction|artwork');
    expect(q).toContain('monument|memorial|castle|ruins|archaeological_site');
    expect(q).toContain('out center');
  });
});

describe('parseOverpassResponse', () => {
  it('maps nodes and way centers, prefers the Russian name and skips unusable elements', () => {
    const pois = parseOverpassResponse({
      elements: [
        { type: 'node', id: 1, lat: 10, lon: 20, tags: { tourism: 'viewpoint', name: 'View' } },
        {
          type: 'way',
          id: 2,
          center: { lat: 11, lon: 21 },
          tags: { historic: 'castle', name: 'Castle', 'name:ru': 'Замок' },
        },
        { type: 'node', id: 3, lat: 12, lon: 22, tags: { historic: 'memorial' } },
        { type: 'node', id: 4, lat: 13, lon: 23, tags: { tourism: 'hotel', name: 'Hotel' } },
        { type: 'node', id: 5, tags: { tourism: 'artwork', name: 'No coords' } },
      ],
    });
    expect(pois).toEqual([
      { id: 'node/1', name: 'View', kind: 'viewpoint', lat: 10, lng: 20 },
      { id: 'way/2', name: 'Замок', kind: 'castle', lat: 11, lng: 21 },
    ]);
  });

  it('returns an empty list for an empty response', () => {
    expect(parseOverpassResponse({})).toEqual([]);
  });
});
