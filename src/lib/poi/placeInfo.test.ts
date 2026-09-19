import { fetchPlaceInfo, pageMatchesName, pickPage } from './placeInfo';

const page = (title: string, extra = {}, index = 0) => ({ title, index, ...extra });

describe('pageMatchesName', () => {
  it('matches equal, contained and mostly-shared names', () => {
    expect(pageMatchesName(page('Palais Seilern'), 'Palais Seilern')).toBe(true);
    expect(pageMatchesName(page('Собор Святого Стефана'), 'Собор Святого Стефана в Вене')).toBe(true);
    expect(pageMatchesName(page('Дворец Зайлерн (Вена)'), 'Дворец Зайлерн')).toBe(true);
    expect(pageMatchesName(page('Mozarthaus Vienna'), 'Mozarthaus')).toBe(true);
  });

  it('matches by the name appearing in the intro text', () => {
    expect(pageMatchesName(page('Kärntner Straße', { extract: 'Am Ende steht das Palais Seilern.' }), 'Palais Seilern')).toBe(true);
  });

  it('rejects unrelated neighbours', () => {
    expect(pageMatchesName(page('Kaffee Alt Wien'), 'Palais Seilern')).toBe(false);
    expect(pageMatchesName(page('Фляйшмаркт'), '')).toBe(false);
  });
});

describe('pickPage', () => {
  it('prefers the closest matching page', () => {
    const pages = [page('Другое', {}, 0), page('Palais Seilern', {}, 3), page('Palais Seilern (Garten)', {}, 1)];
    expect(pickPage(pages, 'Palais Seilern')?.title).toBe('Palais Seilern (Garten)');
  });

  it('returns null when nothing matches', () => {
    expect(pickPage([page('Нечто')], 'Palais Seilern')).toBeNull();
  });
});

describe('fetchPlaceInfo', () => {
  const poi = { name: 'Palais Seilern', lat: 48.2, lng: 16.3 };
  const reply = (pages: unknown[]) => ({ ok: true, json: async () => ({ query: { pages } }) });

  it('returns the first language with a matching article', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(reply([page('Что-то другое')]))
      .mockResolvedValueOnce(
        reply([page('Palais Seilern', { extract: 'A palace.', fullurl: 'https://en.wikipedia.org/wiki/X', thumbnail: { source: 'https://img/x.jpg' } })])
      );
    const info = await fetchPlaceInfo(poi, fetchImpl as unknown as typeof fetch);
    expect(info).toMatchObject({ description: 'A palace.', imageUrl: 'https://img/x.jpg', source: 'Википедия (en)' });
    expect(fetchImpl.mock.calls[1][0]).toContain('en.wikipedia.org');
  });

  const wikidataMiss = { ok: true, json: async () => ({ search: [] }) };

  it('uses a Wikidata item confirmed by coordinates', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(reply([]))
      .mockResolvedValueOnce(reply([]))
      .mockResolvedValueOnce(reply([]))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ search: [{ id: 'Q1' }, { id: 'Q2' }] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entities: {
            Q1: {
              id: 'Q1',
              descriptions: { en: { value: 'palace in Vienna' } },
              claims: { P625: [{ mainsnak: { datavalue: { value: { latitude: 55, longitude: 30 } } } }] },
            },
            Q2: {
              id: 'Q2',
              descriptions: { ru: { value: 'дворец в Вене' } },
              claims: {
                P625: [{ mainsnak: { datavalue: { value: { latitude: 48.2001, longitude: 16.3001 } } } }],
                P18: [{ mainsnak: { datavalue: { value: 'Palais Seilern.jpg' } } }],
              },
            },
          },
        }),
      });
    const info = await fetchPlaceInfo(poi, fetchImpl as unknown as typeof fetch);
    expect(info).toMatchObject({ description: 'Дворец в Вене', source: 'Wikidata' });
    expect(info?.imageUrl).toContain('Special:FilePath/Palais%20Seilern.jpg');
  });

  it('accepts a nearby Commons photo only when its name matches the place', async () => {
    const files = (title: string) =>
      reply([{ title, imageinfo: [{ thumburl: 'https://img/p.jpg', descriptionurl: 'https://commons/x' }] }]);
    const run = async (title: string) => {
      const fetchImpl = jest
        .fn()
        .mockResolvedValueOnce(reply([]))
        .mockResolvedValueOnce(reply([]))
        .mockResolvedValueOnce(reply([]))
        .mockResolvedValueOnce(wikidataMiss)
        .mockResolvedValueOnce(files(title));
      return fetchPlaceInfo(poi, fetchImpl as unknown as typeof fetch);
    };
    expect(await run('File:Palais Seilern Vienna.jpg')).toMatchObject({ imageUrl: 'https://img/p.jpg', source: 'Wikimedia Commons' });
    expect(await run('File:Morawa Bookshop Wien.jpg')).toBeNull();
  });

  it('returns null when neither an article nor a photo exists', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply([]));
    expect(await fetchPlaceInfo(poi, fetchImpl as unknown as typeof fetch)).toBeNull();
  });
});
