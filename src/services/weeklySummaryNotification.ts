import * as Notifications from 'expo-notifications';
import { loadTranslator, type TFunc } from '../i18n';

const IDENTIFIER = 'weekly-summary';

// The text is fixed: the numbers are on the "Collection" card, and the notification is scheduled
// once, so it could not know them anyway. Weekday 1 is Sunday. The words are in the language given, or else the one
// chosen in the app; when the language changes it is scheduled again.
export async function scheduleWeeklySummary(t?: TFunc): Promise<void> {
  const say = t ?? (await loadTranslator()).t;
  await Notifications.cancelScheduledNotificationAsync(IDENTIFIER);
  await Notifications.scheduleNotificationAsync({
    identifier: IDENTIFIER,
    content: {
      title: say('notify.weeklyTitle'),
      body: say('notify.weeklyBody'),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1,
      hour: 19,
      minute: 0,
    },
  });
}

export async function cancelWeeklySummary(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(IDENTIFIER);
}
