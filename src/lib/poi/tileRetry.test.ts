import { retryDelayMs, RETRY_DELAYS_MS } from './tileRetry';

describe('retryDelayMs', () => {
  it('waits a little after the first failure and longer after each next one', () => {
    const delays = [1, 2, 3, 4].map(retryDelayMs);
    expect(delays).toEqual(RETRY_DELAYS_MS);
    expect(delays[0]).toBeLessThan(delays[1]!);
    expect(delays[1]).toBeLessThan(delays[2]!);
  });

  it('gives up after the last delay', () => {
    expect(retryDelayMs(RETRY_DELAYS_MS.length + 1)).toBeNull();
    expect(retryDelayMs(99)).toBeNull();
  });

  it('does not retry for nonsense counts', () => {
    expect(retryDelayMs(0)).toBeNull();
    expect(retryDelayMs(-1)).toBeNull();
    expect(retryDelayMs(1.5)).toBeNull();
  });
});
