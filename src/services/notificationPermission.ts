import * as Notifications from 'expo-notifications';

// Asks for the permission when the system still allows a prompt. False means it is refused, and iOS
// asks only once, so the caller should send the player to the system settings.
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).status === 'granted';
}
