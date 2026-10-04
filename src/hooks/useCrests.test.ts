import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useCrests } from './useCrests';
import { fetchCrestFiles } from '../lib/geo/crest';

jest.mock('../lib/geo/crest', () => ({
  ...jest.requireActual('../lib/geo/crest'),
  fetchCrestFiles: jest.fn(),
}));

const url = (file: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=160`;

beforeEach(async () => {
  await AsyncStorage.clear();
  (fetchCrestFiles as jest.Mock).mockReset().mockImplementation(async (ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, id === 'Q2' ? null : `${id}.svg`]))
  );
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('useCrests', () => {
  it('fetches the ids in one batch and gives urls, null for an id with no emblem', async () => {
    const { result } = renderHook(() => useCrests(['Q1', 'Q2', null, undefined]));
    await waitFor(() => expect(result.current.Q1).toBe(url('Q1.svg')));
    expect(result.current.Q2).toBeNull();
    expect(fetchCrestFiles).toHaveBeenCalledTimes(1);
    expect((fetchCrestFiles as jest.Mock).mock.calls[0][0]).toEqual(['Q1', 'Q2']);
  });

  it('splits a long list into batches of 50', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `Q${i + 10}`);
    const { result } = renderHook(() => useCrests(ids));
    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(120));
    expect((fetchCrestFiles as jest.Mock).mock.calls.map((c) => c[0].length)).toEqual([50, 50, 20]);
  });

  it('does not ask again for ids it has cached', async () => {
    const first = renderHook(() => useCrests(['Q1']));
    await waitFor(() => expect(first.result.current.Q1).toBeDefined());
    first.unmount();
    (fetchCrestFiles as jest.Mock).mockClear();
    const second = renderHook(() => useCrests(['Q1']));
    await waitFor(() => expect(second.result.current.Q1).toBe(url('Q1.svg')));
    expect(fetchCrestFiles).not.toHaveBeenCalled();
  });

  it('keeps cache entries of a city and of a region (other props) apart', async () => {
    const city = renderHook(() => useCrests(['Q1'], ['P94']));
    await waitFor(() => expect(city.result.current.Q1).toBeDefined());
    (fetchCrestFiles as jest.Mock).mockClear();
    const region = renderHook(() => useCrests(['Q1'], ['P94', 'P41']));
    await waitFor(() => expect(region.result.current.Q1).toBeDefined());
    expect(fetchCrestFiles).toHaveBeenCalledTimes(1);
    expect((fetchCrestFiles as jest.Mock).mock.calls[0][1]).toEqual(['P94', 'P41']);
  });

  it('survives a failed batch and retries those ids on the next change', async () => {
    (fetchCrestFiles as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    const { result, rerender } = renderHook(({ ids }: { ids: string[] }) => useCrests(ids), {
      initialProps: { ids: ['Q1'] },
    });
    await waitFor(() => expect(fetchCrestFiles).toHaveBeenCalledTimes(1));
    expect(result.current.Q1).toBeUndefined();
    rerender({ ids: ['Q1', 'Q5'] });
    await waitFor(() => expect(result.current.Q1).toBe(url('Q1.svg')));
    expect(result.current.Q5).toBe(url('Q5.svg'));
  });
});
