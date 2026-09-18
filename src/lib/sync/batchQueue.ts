export interface SyncQueueOptions<T> {
  maxBatchSize: number;
  maxWaitMs: number;
  onFlush: (items: T[]) => Promise<void>;
}

export class SyncQueue<T> {
  private buffer: T[] = [];
  private timerHandle: ReturnType<typeof setTimeout> | null = null;
  private readonly maxBatchSize: number;
  private readonly maxWaitMs: number;
  private readonly onFlush: (items: T[]) => Promise<void>;

  constructor(options: SyncQueueOptions<T>) {
    this.maxBatchSize = options.maxBatchSize;
    this.maxWaitMs = options.maxWaitMs;
    this.onFlush = options.onFlush;
  }

  enqueue(item: T): void {
    this.buffer.push(item);

    if (this.buffer.length >= this.maxBatchSize) {
      this.flush().catch((err) => console.warn('[SyncQueue] auto-flush failed', err));
      return;
    }

    if (this.timerHandle === null) {
      this.timerHandle = setTimeout(() => {
        this.flush().catch((err) => console.warn('[SyncQueue] auto-flush failed', err));
      }, this.maxWaitMs);
    }
  }

  async flush(): Promise<void> {
    if (this.timerHandle !== null) {
      clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
    if (this.buffer.length === 0) return;

    const items = this.buffer;
    this.buffer = [];

    try {
      await this.onFlush(items);
    } catch (err) {
      this.buffer = [...items, ...this.buffer];
      throw err;
    }
  }
}
