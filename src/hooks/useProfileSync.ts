import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createDefaultProfile,
  fetchMyProfile,
  saveMyProfile,
  removeAvatar,
  setProfileVisibility,
  uploadAvatar,
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

  const setAvatar = useCallback(
    async (body: ArrayBuffer) => {
      const path = await uploadAvatar(client, userId, body, profile?.avatarPath ?? null);
      setProfile((current) => (current ? { ...current, avatarPath: path } : current));
    },
    [client, userId, profile?.avatarPath]
  );

  const clearAvatar = useCallback(async () => {
    if (!profile?.avatarPath) return;
    await removeAvatar(client, userId, profile.avatarPath);
    setProfile((current) => (current ? { ...current, avatarPath: null } : current));
  }, [client, userId, profile?.avatarPath]);

  return { profile, setVisible, setAvatar, clearAvatar };
}
