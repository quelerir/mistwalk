import { performSignOut, type SignOutSteps } from './signOutFlow';

function steps(overrides: Partial<SignOutSteps> = {}): SignOutSteps & { order: string[] } {
  const order: string[] = [];
  return {
    order,
    stopForeground: () => void order.push('stopForeground'),
    stopBackground: async () => void order.push('stopBackground'),
    signOutRemote: async () => void order.push('signOutRemote'),
    signOutLocal: async () => void order.push('signOutLocal'),
    onSignedOut: () => void order.push('onSignedOut'),
    ...overrides,
  };
}

describe('performSignOut', () => {
  it('stops tracking, signs out and returns to the sign-in screen, in that order', async () => {
    const s = steps();
    await performSignOut(s);
    expect(s.order).toEqual(['stopForeground', 'stopBackground', 'signOutRemote', 'onSignedOut']);
  });

  it('still returns to the sign-in screen when the server is unreachable, clearing the local session', async () => {
    const warn = jest.fn();
    const s = steps({ signOutRemote: async () => { throw new Error('offline'); }, onWarn: warn });
    await performSignOut(s);
    expect(s.order).toEqual(['stopForeground', 'stopBackground', 'signOutLocal', 'onSignedOut']);
    expect(warn).toHaveBeenCalled();
  });

  it('keeps going when stopping tracking fails', async () => {
    const s = steps({
      stopForeground: () => { throw new Error('boom'); },
      stopBackground: async () => { throw new Error('boom'); },
    });
    await performSignOut(s);
    expect(s.order).toEqual(['signOutRemote', 'onSignedOut']);
  });

  it('always calls onSignedOut, even if both sign-out attempts fail', async () => {
    const s = steps({
      signOutRemote: async () => { throw new Error('a'); },
      signOutLocal: async () => { throw new Error('b'); },
    });
    await performSignOut(s);
    expect(s.order).toEqual(['stopForeground', 'stopBackground', 'onSignedOut']);
  });
});
