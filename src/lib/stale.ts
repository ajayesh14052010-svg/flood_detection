// Staleness / offline detection.
//
// A device is STALE when its last packet is older than staleSeconds. It is
// OFFLINE when it has not reported for staleSeconds * 2 (configurable via a
// multiplier). "Never report a reading as current if it is old."

export interface StaleInput {
  lastSeenAt: Date | null;
  now: Date;
  staleSeconds: number;
  offlineMultiplier?: number; // default 2
}

export interface StaleResult {
  ageSeconds: number | null;
  isStale: boolean;
  isOffline: boolean;
}

export function evaluateFreshness(input: StaleInput): StaleResult {
  const { lastSeenAt, now, staleSeconds } = input;
  const multiplier = input.offlineMultiplier ?? 2;

  if (!lastSeenAt) {
    // Never seen a packet.
    return { ageSeconds: null, isStale: true, isOffline: true };
  }

  const ageSeconds = Math.max(0, (now.getTime() - lastSeenAt.getTime()) / 1000);
  const isStale = ageSeconds > staleSeconds;
  const isOffline = ageSeconds > staleSeconds * multiplier;
  return { ageSeconds, isStale, isOffline };
}

/** Human-friendly "last update" label used across the UI. */
export function formatAge(ageSeconds: number | null): string {
  if (ageSeconds == null) return "no data yet";
  if (ageSeconds < 60) return `${Math.round(ageSeconds)}s ago`;
  if (ageSeconds < 3600) return `${Math.round(ageSeconds / 60)}m ago`;
  if (ageSeconds < 86400) return `${Math.round(ageSeconds / 3600)}h ago`;
  return `${Math.round(ageSeconds / 86400)}d ago`;
}
