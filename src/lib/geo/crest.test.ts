import { crestUrlFromFile, fetchCrestFile, fetchCrestFiles } from './crest';

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

describe('fetchCrestFiles', () => {
  const claim = (value: string) => [{ mainsnak: { datavalue: { value } } }];
  const respond = (entities: Record<string, unknown>) =>
    jest.fn().mockResolvedValue({ ok: true, json: async () => ({ entities }) });

  it('asks for up to 50 ids per request', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `Q${i + 1}`);
    const fetchImpl = respond({});
    await fetchCrestFiles(ids, ['P94'], fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const urls = fetchImpl.mock.calls.map((call) => decodeURIComponent(call[0] as string));
    expect(urls[0]).toContain(`ids=${ids.slice(0, 50).join('|')}`);
    expect(urls[2]).toContain(`ids=${ids.slice(100).join('|')}`);
  });

  it('returns the coat of arms, null for an id with none or unknown', async () => {
    const fetchImpl = respond({ Q1: { claims: { P94: claim('A.svg') } }, Q2: { claims: {} } });
    const out = await fetchCrestFiles(['Q1', 'Q2', 'Q3'], ['P94'], fetchImpl as unknown as typeof fetch);
    expect(out).toEqual({ Q1: 'A.svg', Q2: null, Q3: null });
  });

  it('falls back to the next property: the flag when there is no coat of arms', async () => {
    const fetchImpl = respond({
      Q1: { claims: { P41: claim('Flag.svg') } },
      Q2: { claims: { P94: claim('Arms.svg'), P41: claim('Flag2.svg') } },
      Q3: { claims: {} },
    });
    const out = await fetchCrestFiles(['Q1', 'Q2', 'Q3'], ['P94', 'P41'], fetchImpl as unknown as typeof fetch);
    expect(out).toEqual({ Q1: 'Flag.svg', Q2: 'Arms.svg', Q3: null });
    expect(decodeURIComponent(fetchImpl.mock.calls[0][0] as string)).toContain('props=claims');
  });

  it('rejects when a request fails', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 429 });
    await expect(fetchCrestFiles(['Q1'], ['P94'], fetchImpl as unknown as typeof fetch)).rejects.toThrow('429');
  });

  it('does nothing for no ids', async () => {
    const fetchImpl = respond({});
    expect(await fetchCrestFiles([], ['P94'], fetchImpl as unknown as typeof fetch)).toEqual({});
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
