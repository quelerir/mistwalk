import type { KeyValueStorage } from './accuracyProfile';

const KEY = 'settings.placeNotifications.v1';

// The background task has no session, so the user id is stored with the switch to find the saved places.
export interface PlaceNotificationSetting {
  enabled: boolean;
  userId: string | null;
}

export async function getPlaceNotifications(
  storage: Pick<KeyValueStorage, 'getItem'>
): Promise<PlaceNotificationSetting> {
  try {
    const raw = await storage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && parsed.enabled === true && typeof parsed.userId === 'string') {
      return { enabled: true, userId: parsed.userId };
    }
  } catch {
    // unreadable value: treated as off
  }
  return { enabled: false, userId: null };
}

export async function setPlaceNotifications(
  storage: Pick<KeyValueStorage, 'setItem'>,
  setting: PlaceNotificationSetting
): Promise<void> {
  await storage.setItem(KEY, JSON.stringify(setting));
}
