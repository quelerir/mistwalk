export interface AccountDeletionSteps {
  // Must throw on failure — a failed remote delete must not run any of the steps below or
  // call onDeleted, unlike sign-out this has no "fall back to local" mode: if this failed,
  // the account still exists and the user is still signed in.
  deleteRemote: () => Promise<void>;
  stopForeground: () => void;
  stopBackground: () => Promise<void>;
  clearLocalSession: () => Promise<void>;
  onDeleted: () => void;
  onWarn?: (message: string, error: unknown) => void;
}

export async function performAccountDeletion(steps: AccountDeletionSteps): Promise<void> {
  await steps.deleteRemote();

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
    await steps.clearLocalSession();
  } catch (err) {
    warn('clearing the local session failed', err);
  }

  steps.onDeleted();
}
