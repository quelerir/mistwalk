import { buildOverpassQuery, kindFromTags, parseOverpassResponse } from './overpass';

describe('buildOverpassQuery', () => {
  it('queries named tourism and historic objects inside the bounds', () => {
    const q = buildOverpassQuery({ south: 1, west: 2, north: 3, east: 4 });
    expect(q).toContain('[out:json]');
    expect(q).toContain('(1,2,3,4)');
    expect(q).toContain('viewpoint|attraction|artwork');
    expect(q).toContain('monument|memorial|castle|fort|ruins|archaeological_site');
    expect(q).toContain('out center');
  });
});

describe('buildOverpassQuery: wider set of places', () => {
  const q = buildOverpassQuery({ south: 1, west: 2, north: 3, east: 4 });

  it('asks for museums, natural sights, beaches, lighthouses, parks and temples', () => {
    expect(q).toContain('museum|gallery|zoo|theme_park|aquarium');
    expect(q).toContain('waterfall|peak|cave_entrance|beach');
    expect(q).toContain('"man_made"="lighthouse"');
    expect(q).toContain('"leisure"="park"');
    expect(q).toContain('"amenity"="place_of_worship"');
  });

  it('keeps parks, temples and lesser historic buildings to those with a wikidata entry', () => {
    const clause = (needle: string) => q.split(';').find((c) => c.includes(needle)) ?? '';
    expect(clause('"leisure"="park"')).toContain('["wikidata"]');
    expect(clause('"amenity"="place_of_worship"')).toContain('["wikidata"]');
    expect(clause('manor|city_gate')).toContain('["wikidata"]');
    expect(clause('viewpoint|attraction')).not.toContain('["wikidata"]');
  });
});

describe('kindFromTags', () => {
  it('maps the new tags to kinds', () => {
    expect(kindFromTags({ tourism: 'museum' })).toBe('museum');
    expect(kindFromTags({ tourism: 'gallery' })).toBe('museum');
    expect(kindFromTags({ tourism: 'zoo' })).toBe('attraction');
    expect(kindFromTags({ historic: 'fort' })).toBe('castle');
    expect(kindFromTags({ historic: 'manor' })).toBe('attraction');
    expect(kindFromTags({ natural: 'beach' })).toBe('beach');
    expect(kindFromTags({ natural: 'waterfall' })).toBe('nature');
    expect(kindFromTags({ natural: 'peak' })).toBe('nature');
    expect(kindFromTags({ man_made: 'lighthouse' })).toBe('attraction');
    expect(kindFromTags({ leisure: 'park' })).toBe('park');
    expect(kindFromTags({ amenity: 'place_of_worship' })).toBe('worship');
  });

  it('keeps the old kinds and still ignores other tags', () => {
    expect(kindFromTags({ tourism: 'viewpoint' })).toBe('viewpoint');
    expect(kindFromTags({ historic: 'memorial' })).toBe('monument');
    expect(kindFromTags({ tourism: 'hotel' })).toBeNull();
    expect(kindFromTags({ shop: 'bakery' })).toBeNull();
  });

  it('prefers the tourism tag when a temple is also an attraction', () => {
    expect(kindFromTags({ tourism: 'attraction', amenity: 'place_of_worship' })).toBe('attraction');
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

describe('parseOverpassResponse wiki tags', () => {
  it('keeps the OpenStreetMap wikipedia and wikidata links when present', () => {
    const [withTags, without] = parseOverpassResponse({
      elements: [
        { type: 'node', id: 1, lat: 1, lon: 2, tags: { tourism: 'attraction', name: 'A', wikipedia: 'de:Palais Seilern', wikidata: 'Q42' } },
        { type: 'node', id: 2, lat: 1, lon: 2, tags: { tourism: 'attraction', name: 'B' } },
      ],
    });
    expect(withTags).toMatchObject({ wikipedia: 'de:Palais Seilern', wikidata: 'Q42' });
    expect(without).not.toHaveProperty('wikipedia');
    expect(without).not.toHaveProperty('wikidata');
  });
});
