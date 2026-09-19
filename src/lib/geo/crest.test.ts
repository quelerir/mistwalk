import { crestUrlFromFile, fetchCrestFile } from './crest';

describe('crest', () => {
  it('builds a PNG-rendering commons url', () => {
    expect(crestUrlFromFile('Wien Wappen.svg', 100)).toBe(
      'https://commons.wikimedia.org/wiki/Special:FilePath/Wien%20Wappen.svg?width=100'
    );
  });

  it('reads the coat of arms file name from Wikidata', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        entities: { Q1741: { claims: { P94: [{ mainsnak: { datavalue: { value: 'Wien Wappen.svg' } } }] } } },
      }),
    });
    expect(await fetchCrestFile('Q1741', fetchImpl as unknown as typeof fetch)).toBe('Wien Wappen.svg');
  });

  it('returns null when the city has no coat of arms', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ entities: { Q9: { claims: {} } } }) });
    expect(await fetchCrestFile('Q9', fetchImpl as unknown as typeof fetch)).toBeNull();
  });

  it('throws on a failed request', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchCrestFile('Q1', fetchImpl as unknown as typeof fetch)).rejects.toThrow('500');
  });
});
