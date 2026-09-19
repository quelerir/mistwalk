import type { SupabaseClient } from '@supabase/supabase-js';
import type { CityStat } from '../geo/cityStats';
import type { CountryStat } from '../geo/countryStats';
import type { PoiKind } from '../poi/types';

export interface ProfileSnapshot {
  distanceKm: number;
  countries: Array<{ code: string; name: string; percent: number }>;
  cities: Array<{ name: string; percent: number | null; exploredKm2: number }>;
}

export interface MyProfile {
  displayName: string;
  isPublic: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  foundCount: number;
  rank: number;
}

export interface PlayerProfile extends ProfileSnapshot {
  userId: string;
  displayName: string;
  foundCount: number;
  places: Array<{ name: string; kind: PoiKind; discoveredAt: number }>;
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
  cities: CityStat[]
): ProfileSnapshot {
  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    countries: countries
      .filter((c) => c.percent > 0)
      .map((c) => ({ code: c.code, name: c.name, percent: c.percent })),
    cities: cities.slice(0, MAX_CITIES).map((c) => ({
      name: c.name,
      percent: c.percent,
      exploredKm2: c.exploredKm2,
    })),
  };
}

export async function fetchMyProfile(client: SupabaseClient, userId: string): Promise<MyProfile | null> {
  const { data, error } = await client
    .from('player_profiles')
    .select('display_name, is_public')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { displayName: data.display_name, isPublic: data.is_public } : null;
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
  found_count: number | string;
  rank: number | string;
}

export async function fetchLeaderboard(client: SupabaseClient): Promise<LeaderboardEntry[]> {
  const { data, error } = await client.rpc('leaderboard', { max_rows: 50 });
  if (error) throw error;
  return ((data ?? []) as LeaderboardRow[]).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    foundCount: Number(row.found_count),
    rank: Number(row.rank),
  }));
}

interface PlayerRow {
  user_id: string;
  display_name: string;
  distance_km: number;
  found_count: number | string;
  countries: Array<{ code: string; name: string; percent: number }>;
  cities: Array<{ name: string; percent: number | null; exploredKm2?: number; explored_km2?: number }>;
  places: Array<{ name: string; kind: PoiKind; discovered_at: string }>;
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
    distanceKm: row.distance_km,
    foundCount: Number(row.found_count),
    countries: row.countries ?? [],
    cities: (row.cities ?? []).map((c) => ({
      name: c.name,
      percent: c.percent,
      exploredKm2: c.exploredKm2 ?? c.explored_km2 ?? 0,
    })),
    places: (row.places ?? []).map((p) => ({
      name: p.name,
      kind: p.kind,
      discoveredAt: Date.parse(p.discovered_at),
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
    const profile: MyProfile = { displayName: `Игрок ${compact.slice(0, length)}`, isPublic: true };
    try {
      await saveMyProfile(client, userId, profile, snapshot);
      return profile;
    } catch (err) {
      if (!(err instanceof NameTakenError)) throw err;
    }
  }
  throw new Error('could not pick a display name');
}
