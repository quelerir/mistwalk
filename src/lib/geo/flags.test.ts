import { flagSource } from './flags';

describe('flagSource', () => {
  it('uses the flag service for a country', () => {
    const source = flagSource('GE') as { uri: string };
    expect(source.uri).toBe('https://flagcdn.com/w80/ge.png');
  });

  it('uses the bundled image for a republic', () => {
    expect(flagSource('XA')).toBe(require('../../../assets/flags/xa.png'));
    expect(flagSource('XS')).toBe(require('../../../assets/flags/xs.png'));
    expect(flagSource('XA')).not.toBe(flagSource('XS'));
    // not the service fallback ({ uri }): a bundled image has no `uri`
    for (const code of ['XT', 'XN', 'XL']) expect(flagSource(code)).not.toHaveProperty('uri');
  });
});
