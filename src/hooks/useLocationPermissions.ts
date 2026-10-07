import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

export type PermissionStage =
  | 'unrequested'
  | 'foreground-granted'
  | 'background-granted'
  | 'denied';

export function useLocationPermissions() {
  const [stage, setStage] = useState<PermissionStage>('unrequested');

  // The app only asks for the permission after it has loaded its data, which takes a few seconds. Until then it would
  // show "turn on location" even to someone who already allowed it, so read what is already set (this never prompts).
  // A stage the app has reached by asking is never overwritten by this late answer.
  useEffect(() => {
    let stale = false;
    Location.getForegroundPermissionsAsync()
      .then(({ status }) => {
        if (stale) return;
        if (status === 'granted') setStage((s) => (s === 'unrequested' ? 'foreground-granted' : s));
        else if (status === 'denied') setStage((s) => (s === 'unrequested' ? 'denied' : s));
      })
      .catch(() => undefined);
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

  const requestBackground = useCallback(async () => {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      return false;
    }
    setStage('background-granted');
    return true;
  }, []);

  return { stage, requestForeground, requestBackground };
}
