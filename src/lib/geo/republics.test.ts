import { countryCodeAt, hostAreaAdjustment, publicCountryCode, REPUBLIC_BY_CODE, REPUBLICS, republicAt, republicName } from './republics';

describe('republicAt', () => {
  it.each([
    ['Sukhumi', 43.0, 41.02, 'XA'],
    ['Tskhinvali', 42.23, 43.97, 'XS'],
    ['Tiraspol', 46.84, 29.63, 'XT'],
    ['North Nicosia', 35.19, 33.37, 'XN'],
    ['Hargeisa', 9.56, 44.06, 'XL'],
  ])('puts %s in %s', (_name, lat, lng, code) => {
    expect(republicAt(lat, lng)).toBe(code);
  });

  it.each([
    ['Tbilisi', 41.72, 44.79],
    ['Chisinau', 47.01, 28.86],
    ['Larnaca', 34.92, 33.63],
    ['Mogadishu', 2.05, 45.32],
    ['Paris', 48.85, 2.35],
  ])('leaves %s outside every republic', (_name, lat, lng) => {
    expect(republicAt(lat, lng)).toBeNull();
  });

  it('is null on the top edge of the bounding box away from the outline', () => {
    const points = REPUBLIC_BY_CODE.XA.polygons.flat(2);
    const top = Math.max(...points.map((p) => p[1]));
    const vertexLngs = new Set(points.filter((p) => p[1] === top).map((p) => p[0]));
    const lngs = points.map((p) => p[0]);
    // A longitude inside the box that is not the vertex at the top: the polygon does not reach this point.
    const lng = [Math.min(...lngs) + 0.3, Math.max(...lngs) - 0.3].find((x) => !vertexLngs.has(x))!;
    expect(republicAt(top, lng)).toBeNull();
  });

  it('is null just outside the bounding box of a republic', () => {
    const lats = REPUBLIC_BY_CODE.XA.polygons.flat(2).map((p) => p[1]);
    const lngs = REPUBLIC_BY_CODE.XA.polygons.flat(2).map((p) => p[0]);
    const middleLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    expect(republicAt(Math.min(...lats) - 0.01, middleLng)).toBeNull();
    expect(republicAt(Math.max(...lats) + 0.01, middleLng)).toBeNull();
  });
});

describe('countryCodeAt', () => {
  const georgiaCell = () => 'GE';
  it('prefers a republic over the country of the cell', () => {
    expect(countryCodeAt(43.0, 41.02, georgiaCell)).toBe('XA');
  });
  it('falls back to the country of the cell outside every republic', () => {
    expect(countryCodeAt(41.72, 44.79, georgiaCell)).toBe('GE');
  });
  it('is null when the cell has no country either', () => {
    expect(countryCodeAt(41.72, 44.79, () => null)).toBeNull();
    expect(countryCodeAt(41.72, 44.79, () => undefined)).toBeNull();
  });
});

describe('hostAreaAdjustment', () => {
  it('sums the areas of the republics inside a country', () => {
    expect(hostAreaAdjustment('GE')).toBe(REPUBLIC_BY_CODE.XA.areaKm2 + REPUBLIC_BY_CODE.XS.areaKm2);
    expect(hostAreaAdjustment('CY')).toBe(REPUBLIC_BY_CODE.XN.areaKm2);
    expect(hostAreaAdjustment('FR')).toBe(0);
  });
});

describe('republic names', () => {
  it('follows the language', () => {
    expect(republicName('XA', 'ru')).toBe('Абхазия');
    expect(republicName('XA', 'en')).toBe('Abkhazia');
    expect(republicName('ZZ', 'ru')).toBe('ZZ');
  });
  it('lists the five republics', () => {
    expect(REPUBLICS.map((r) => r.code).sort()).toEqual(['XA', 'XL', 'XN', 'XS', 'XT']);
  });
});

describe('publicCountryCode', () => {
  it('maps a republic to the country it lies in and leaves everything else alone', () => {
    expect(publicCountryCode('XA')).toBe('GE');
    expect(publicCountryCode('XS')).toBe('GE');
    expect(publicCountryCode('XT')).toBe('MD');
    expect(publicCountryCode('XN')).toBe('CY');
    expect(publicCountryCode('XL')).toBe('SO');
    expect(publicCountryCode('GE')).toBe('GE');
    expect(publicCountryCode(null)).toBeNull();
  });
});
