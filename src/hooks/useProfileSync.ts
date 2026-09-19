import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createDefaultProfile,
  fetchMyProfile,
  saveMyProfile,
  setProfileVisibility,
  type MyProfile,
  type ProfileSnapshot,
} from '../lib/social/profiles';

const SYNC_DELAY_MS = 5000;

// Creates the player's profile right after sign-in and keeps its public numbers fresh.
export function useProfileSync(client: SupabaseClient, userId: string, snapshot: ProfileSnapshot) {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const lastSynced = useRef('');

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const existing = await fetchMyProfile(client, userId);
        const mine = existing ?? (await createDefaultProfile(client, userId, snapshotRef.current));
        if (!cancelled) setProfile(mine);
      } catch (err) {
        console.warn('[profile] setup failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, userId]);

  const key = JSON.stringify(snapshot);
  useEffect(() => {
    if (!profile || key === lastSynced.current) return;
    const timer = setTimeout(() => {
      lastSynced.current = key;
      saveMyProfile(client, userId, profile, snapshotRef.current).catch((err) => {
        lastSynced.current = '';
        console.warn('[profile] sync failed', err);
      });
    }, SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [client, userId, profile, key]);

  const setVisible = useCallback(
    async (isPublic: boolean) => {
      await setProfileVisibility(client, userId, isPublic);
      setProfile((current) => (current ? { ...current, isPublic } : current));
    },
    [client, userId]
  );

  return { profile, setVisible };
}
