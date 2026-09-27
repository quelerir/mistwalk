import { performAccountDeletion, type AccountDeletionSteps } from './deleteAccountFlow';

function steps(overrides: Partial<AccountDeletionSteps> = {}): AccountDeletionSteps & { order: string[] } {
  const order: string[] = [];
  return {
    order,
    deleteRemote: async () => void order.push('deleteRemote'),
    stopForeground: () => void order.push('stopForeground'),
    stopBackground: async () => void order.push('stopBackground'),
    clearLocalSession: async () => void order.push('clearLocalSession'),
    onDeleted: () => void order.push('onDeleted'),
    ...overrides,
  };
}

describe('performAccountDeletion', () => {
  it('deletes remotely, cleans up locally, then reports deletion, in that order', async () => {
    const s = steps();
    await performAccountDeletion(s);
    expect(s.order).toEqual(['deleteRemote', 'stopForeground', 'stopBackground', 'clearLocalSession', 'onDeleted']);
  });

  it('rethrows and does nothing else when the remote delete fails', async () => {
    const s = steps({ deleteRemote: async () => { throw new Error('offline'); } });
    await expect(performAccountDeletion(s)).rejects.toThrow('offline');
    expect(s.order).toEqual([]);
  });

  it('keeps going and still reports deletion when stopping tracking fails', async () => {
    const warn = jest.fn();
    const s = steps({
      stopForeground: () => { throw new Error('boom'); },
      stopBackground: async () => { throw new Error('boom'); },
      onWarn: warn,
    });
    await performAccountDeletion(s);
    expect(s.order).toEqual(['deleteRemote', 'clearLocalSession', 'onDeleted']);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('still reports deletion when clearing the local session fails', async () => {
    const warn = jest.fn();
    const s = steps({ clearLocalSession: async () => { throw new Error('nope'); }, onWarn: warn });
    await performAccountDeletion(s);
    expect(s.order).toEqual(['deleteRemote', 'stopForeground', 'stopBackground', 'onDeleted']);
    expect(warn).toHaveBeenCalledWith(expect.any(String), expect.any(Error));
  });
});
