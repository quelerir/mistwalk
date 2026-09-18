export interface SignOutSteps {
  stopForeground: () => void;
  stopBackground: () => Promise<void>;
  signOutRemote: () => Promise<void>;
  signOutLocal: () => Promise<void>;
  onSignedOut: () => void;
  onWarn?: (message: string, error: unknown) => void;
}

export async function performSignOut(steps: SignOutSteps): Promise<void> {
  const warn = steps.onWarn ?? (() => {});

  try {
    steps.stopForeground();
  } catch (err) {
    warn('stopping foreground tracking failed', err);
  }

  try {
    await steps.stopBackground();
  } catch (err) {
    warn('stopping background tracking failed', err);
  }

  try {
    await steps.signOutRemote();
  } catch (err) {
    warn('remote sign-out failed, clearing the local session instead', err);
    try {
      await steps.signOutLocal();
    } catch (localErr) {
      warn('local sign-out failed too', localErr);
    }
  }

  steps.onSignedOut();
}
