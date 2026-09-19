import { useEffect, useRef, useState } from 'react';
import type { Coordinate } from '../lib/geo/distance';
import type { Poi } from '../lib/poi/types';
import {
  distanceFromRoute,
  fetchWalkingRoute,
  type WalkingRoute,
} from '../lib/routing/walkingRoute';

export type RouteStatus = 'idle' | 'loading' | 'ready' | 'error';

// Walking further than this from the line triggers a reroute.
const REROUTE_DISTANCE_METERS = 60;

export function useRoute(target: Poi | null, origin: Coordinate | null) {
  const [route, setRoute] = useState<WalkingRoute | null>(null);
  const [status, setStatus] = useState<RouteStatus>('idle');
  const inFlight = useRef(false);
  const targetId = target?.id ?? null;
  const targetIdRef = useRef<string | null>(null);
  targetIdRef.current = targetId;

  useEffect(() => {
    setRoute(null);
    setStatus(targetId ? 'loading' : 'idle');
  }, [targetId]);

  useEffect(() => {
    if (!target || !origin || inFlight.current) return;
    if (route && distanceFromRoute(route, origin) <= REROUTE_DISTANCE_METERS) return;
    if (!route && status === 'error') return;

    inFlight.current = true;
    const requestedFor = target.id;
    fetchWalkingRoute(origin, target)
      .then((next) => {
        if (requestedFor !== targetIdRef.current) return;
        setRoute(next);
        setStatus('ready');
      })
      .catch((err) => {
        console.warn('[route] failed', err);
        if (requestedFor === targetIdRef.current) setStatus('error');
      })
      .finally(() => {
        inFlight.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, origin, route, status]);

  return { route, status };
}
