import { Coordinate, haversineDistanceMeters } from './distance';

export function shouldRecordPoint(
  lastRecorded: Coordinate | null,
  candidate: Coordinate,
  thresholdMeters: number
): boolean {
  if (lastRecorded === null) return true;
  return haversineDistanceMeters(lastRecorded, candidate) >= thresholdMeters;
}
