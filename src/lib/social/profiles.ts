import { tNow } from '../../i18n';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CityStat } from '../geo/cityStats';
import type { CountryStat } from '../geo/countryStats';
import type { PoiKind } from '../poi/types';

export interface PlaceRegion {
  c: string;
  t: string | null;
}

export interface ProfileSnapshot {
  distanceKm: number;
  countries: Array<{ code: string; name: string; percent: number }>;
  cities: Array<{
    name: string;
    country: string | null;
    wikidata: string | null;
    percent: number | null;
    exploredKm2: number;
  }>;
  // Found place id -> its country (ISO code) and city, for browsing a player's page by country.
  placeRegions: Record<string, PlaceRegion>;
}

export interface MyProfile {
  displayName: string;
  isPublic: boolean;
  avatarPath: string | null;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarPath: string | null;
  foundCount: number;
  rank: number;
}

export interface PlayerProfile extends Omit<ProfileSnapshot, 'placeRegions'> {
  userId: string;
  displayName: string;
  avatarPath: string | null;
  foundCount: number;
  places: Array<{ name: string; kind: PoiKind; discoveredAt: number; country: string | null; city: string | null }>;
}

export class NameTakenError extends Error {
  constructor() {
    super('name_taken');
  }
}

const MAX_CITIES = 30;

export function buildSnapshot(
  distanceKm: number,
  countries: CountryStat[],
  cities: CityStat[],
  placeRegions: Record<string, PlaceRegion> = {}
): ProfileSnapshot {
  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    countries: countries
      .filter((c) => c.percent > 0)
      .map((c) => ({ code: c.code, name: c.name, percent: c.percent })),
    cities: cities.slice(0, MAX_CITIES).map((c) => ({
      name: c.name,
      country: c.country,
      wikidata: c.wikidata,
      percent: c.percent,
      exploredKm2: c.exploredKm2,
    })),
    placeRegions,
  };
}

export async function fetchMyProfile(client: SupabaseClient, userId: string): Promise<MyProfile | null> {
  const { data, error } = await client
    .from('player_profiles')
    .select('display_name, is_public, avatar_path')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? { displayName: data.display_name, isPublic: data.is_public, avatarPath: data.avatar_path ?? null }
    : null;
}

export async function saveMyProfile(
  client: SupabaseClient,
  userId: string,
  profile: MyProfile,
  snapshot: ProfileSnapshot
): Promise<void> {
  const { error } = await client.from('player_profiles').upsert(
    {
      user_id: userId,
      display_name: profile.displayName,
      is_public: profile.isPublic,
      distance_km: snapshot.distanceKm,
      countries: snapshot.countries,
      cities: snapshot.cities,
      place_regions: snapshot.placeRegions,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) {
    if (error.code === '23505') throw new NameTakenError();
    throw error;
  }
}

export async function setProfileVisibility(
  client: SupabaseClient,
  userId: string,
  isPublic: boolean
): Promise<void> {
  const { error } = await client
    .from('player_profiles')
    .update({ is_public: isPublic })
    .eq('user_id', userId);
  if (error) throw error;
}

interface LeaderboardRow {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  found_count: number | string;
  rank: number | string;
}

export async function fetchLeaderboard(client: SupabaseClient): Promise<LeaderboardEntry[]> {
  const { data, error } = await client.rpc('leaderboard', { max_rows: 50 });
  if (error) throw error;
  return ((data ?? []) as LeaderboardRow[]).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    avatarPath: row.avatar_path ?? null,
    foundCount: Number(row.found_count),
    rank: Number(row.rank),
  }));
}

interface PlayerRow {
  user_id: string;
  display_name: string;
  avatar_path?: string | null;
  distance_km: number;
  found_count: number | string;
  countries: Array<{ code: string; name: string; percent: number }>;
  cities: Array<{
    name: string;
    country?: string | null;
    wikidata?: string | null;
    percent: number | null;
    exploredKm2?: number;
    explored_km2?: number;
  }>;
  places: Array<{ name: string; kind: PoiKind; discovered_at: string; country?: string | null; city?: string | null }>;
}

export async function fetchPlayerProfile(
  client: SupabaseClient,
  playerId: string
): Promise<PlayerProfile | null> {
  const { data, error } = await client.rpc('player_profile', { target: playerId });
  if (error) throw error;
  if (!data) return null;
  const row = data as PlayerRow;
  return {
    userId: row.user_id,
    displayName: row.display_name,
    avatarPath: row.avatar_path ?? null,
    distanceKm: row.distance_km,
    foundCount: Number(row.found_count),
    countries: row.countries ?? [],
    cities: (row.cities ?? []).map((c) => ({
      name: c.name,
      country: c.country ?? null,
      wikidata: c.wikidata ?? null,
      percent: c.percent,
      exploredKm2: c.exploredKm2 ?? c.explored_km2 ?? 0,
    })),
    places: (row.places ?? []).map((p) => ({
      name: p.name,
      kind: p.kind,
      discoveredAt: Date.parse(p.discovered_at),
      country: p.country ?? null,
      city: p.city ?? null,
    })),
  };
}

// Everyone takes part by default under a neutral name; the email is never used.
export async function createDefaultProfile(
  client: SupabaseClient,
  userId: string,
  snapshot: ProfileSnapshot
): Promise<MyProfile> {
  const compact = userId.replace(/-/g, '');
  for (const length of [6, 10, 16]) {
    const profile: MyProfile = {
      displayName: tNow('player.default', { id: compact.slice(0, length) }),
      isPublic: true,
      avatarPath: null,
    };
    try {
      await saveMyProfile(client, userId, profile, snapshot);
      return profile;
    } catch (err) {
      if (!(err instanceof NameTakenError)) throw err;
    }
  }
  throw new Error('could not pick a display name');
}

const AVATAR_BUCKET = 'avatars';

export function avatarUrl(client: SupabaseClient, path: string | null): string | null {
  return path ? client.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl : null;
}

// Uploads a new avatar under the user's own folder, points the profile at it and removes the old file.
export async function uploadAvatar(
  client: SupabaseClient,
  userId: string,
  body: ArrayBuffer,
  previousPath: string | null
): Promise<string> {
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error } = await client.storage.from(AVATAR_BUCKET).upload(path, body, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  await setAvatarPath(client, userId, path);
  if (previousPath) await client.storage.from(AVATAR_BUCKET).remove([previousPath]).catch(() => undefined);
  return path;
}

export async function setAvatarPath(client: SupabaseClient, userId: string, path: string | null): Promise<void> {
  const { error } = await client.from('player_profiles').update({ avatar_path: path }).eq('user_id', userId);
  if (error) throw error;
}

export async function removeAvatar(client: SupabaseClient, userId: string, path: string): Promise<void> {
  await setAvatarPath(client, userId, null);
  await client.storage.from(AVATAR_BUCKET).remove([path]).catch(() => undefined);
}

export type ReportReason = 'name' | 'photo' | 'other';

export async function reportPlayer(client: SupabaseClient, playerId: string, reason: ReportReason): Promise<void> {
  const { error } = await client.rpc('report_player', { target: playerId, why: reason });
  if (error) throw error;
}
