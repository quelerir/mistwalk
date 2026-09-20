import * as Notifications from 'expo-notifications';

const IDENTIFIER = 'weekly-summary';

// The text is fixed: the numbers are on the "Коллекция" card, and the notification is scheduled
// once, so it could not know them anyway. Weekday 1 is Sunday.
export async function scheduleWeeklySummary(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(IDENTIFIER);
  await Notifications.scheduleNotificationAsync({
    identifier: IDENTIFIER,
    content: {
      title: 'Итоги недели',
      body: 'Посмотрите, сколько вы прошли и что открыли за неделю.',
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
