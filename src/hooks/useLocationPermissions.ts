import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

export type PermissionStage =
  | 'unrequested'
  | 'foreground-granted'
  | 'background-granted'
  | 'denied';

export function useLocationPermissions() {
  const [stage, setStage] = useState<PermissionStage>('unrequested');

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
