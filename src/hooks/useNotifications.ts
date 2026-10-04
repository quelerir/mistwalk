import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchUnreadNotificationCount, subscribeToNotifications } from '../lib/social/notifications';

// How many notifications are unread. The number always comes from the server, which hides blocked and private
// actors; on a failure the last number stays.
export function useNotifications(client: SupabaseClient, myId: string) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setUnread(await fetchUnreadNotificationCount(client));
    } catch (err) {
      console.warn('[notifications] count failed', err);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
    const channel = subscribeToNotifications(client, myId, () => void refresh());
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      appState.remove();
      void client.removeChannel(channel);
    };
  }, [client, myId, refresh]);

  const clearUnread = useCallback(() => setUnread(0), []);

  return { unread, refresh, clearUnread };
}
