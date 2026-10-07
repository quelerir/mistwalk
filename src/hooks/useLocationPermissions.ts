import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

export type PermissionStage =
  | 'unrequested'
  | 'foreground-granted'
  | 'background-granted'
  | 'denied';

// What the phone says about the permission when the app opens; 'unknown' when it could not be read.
type InitialStatus = 'granted' | 'denied' | 'undetermined' | 'unknown';

export function useLocationPermissions() {
  const [stage, setStage] = useState<PermissionStage>('unrequested');
  const [introVisible, setIntroVisible] = useState(false);
  // Settles once the first read of the permission is done (see the effect below).
  const initial = useRef<{ promise: Promise<InitialStatus>; settle: (s: InitialStatus) => void } | null>(null);
  if (!initial.current) {
    let settle!: (s: InitialStatus) => void;
    const promise = new Promise<InitialStatus>((resolve) => {
      settle = resolve;
    });
    initial.current = { promise, settle };
  }
  // The call in progress, shared by everyone who asks meanwhile, and the way to close its intro.
  const pending = useRef<Promise<boolean> | null>(null);
  const intro = useRef<{ done: () => void } | null>(null);
  // Set once the person has been through the intro, so it can never come up again in this run of the app.
  const introSeen = useRef(false);

  // The app only asks for the permission after it has loaded its data, which takes a few seconds. Until then it would
  // show "turn on location" even to someone who already allowed it, so read what is already set (this never prompts).
  // A stage the app has reached by asking is never overwritten by this late answer.
  useEffect(() => {
    let stale = false;
    Location.getForegroundPermissionsAsync()
      .then(({ status }) => {
        initial.current?.settle(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined');
        if (stale) return;
        if (status === 'granted') setStage((s) => (s === 'unrequested' ? 'foreground-granted' : s));
        else if (status === 'denied') setStage((s) => (s === 'unrequested' ? 'denied' : s));
      })
      .catch(() => initial.current?.settle('unknown'));
    return () => {
      stale = true;
    };
  }, []);

  const requestForeground = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setStage('denied');
      return false;
    }
    setStage('foreground-granted');
    return true;
  }, []);

  // Asks for the permission, but first, when the person has never been asked, shows the intro that explains why the
  // location is needed and waits for them to continue. Two callers at once share one intro and one system prompt.
  const requestForegroundWithIntro = useCallback((): Promise<boolean> => {
    if (!pending.current) {
      pending.current = (async () => {
        const status = await initial.current!.promise;
        if (status === 'undetermined' && !introSeen.current) {
          introSeen.current = true;
          let done!: () => void;
          const promise = new Promise<void>((resolve) => {
            done = resolve;
          });
          intro.current = { done };
          setIntroVisible(true);
          await promise;
          // The intro stays on screen under the system prompt and closes after the answer: on iOS, closing a modal
          // at the moment the system presents its alert can leave the modal stuck on screen.
          try {
            return await requestForeground();
          } finally {
            setIntroVisible(false);
          }
        }
        return requestForeground();
      })().finally(() => {
        pending.current = null;
        intro.current = null;
      });
    }
    return pending.current;
  }, [requestForeground]);

  // The person tapped continue: lets the waiting request go on to the system prompt. The intro closes itself after.
  const continueIntro = useCallback(() => {
    intro.current?.done();
  }, []);

  const requestBackground = useCallback(async () => {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      return false;
    }
    setStage('background-granted');
    return true;
  }, []);

  return { stage, requestForeground, requestBackground, requestForegroundWithIntro, introVisible, continueIntro };
}
