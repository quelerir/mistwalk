import { SyncQueue } from './batchQueue';

describe('SyncQueue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('flushes automatically once maxBatchSize is reached', async () => {
    const onFlush = jest.fn().mockResolvedValue(undefined);
    const queue = new SyncQueue<number>({ maxBatchSize: 3, maxWaitMs: 10000, onFlush });

    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    await Promise.resolve();

    expect(onFlush).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('flushes automatically after maxWaitMs even below batch size', async () => {
    const onFlush = jest.fn().mockResolvedValue(undefined);
    const queue = new SyncQueue<number>({ maxBatchSize: 10, maxWaitMs: 5000, onFlush });

    queue.enqueue(1);
    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(onFlush).toHaveBeenCalledWith([1]);
  });

  it('re-buffers items if onFlush rejects, for the next flush attempt', async () => {
    const onFlush = jest
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(undefined);
    const queue = new SyncQueue<number>({ maxBatchSize: 1, maxWaitMs: 10000, onFlush });

    queue.enqueue(1);
    await Promise.resolve().catch(() => {});

    queue.enqueue(2);
    await Promise.resolve();

    expect(onFlush).toHaveBeenLastCalledWith([1, 2]);
  });

  it('does nothing on flush() when the buffer is empty', async () => {
    const onFlush = jest.fn().mockResolvedValue(undefined);
    const queue = new SyncQueue<number>({ maxBatchSize: 5, maxWaitMs: 10000, onFlush });

    await queue.flush();

    expect(onFlush).not.toHaveBeenCalled();
  });
});
