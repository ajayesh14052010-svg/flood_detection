// Load and update configurable flood thresholds. Persisted in the
// ThresholdConfig table so administrators can tune them per installation
// without redeploying. Falls back to documented defaults for any missing key.

import { prisma } from "./db";
import { DEFAULT_THRESHOLDS, THRESHOLD_KEYS, type Thresholds } from "./types";

export async function getThresholds(): Promise<Thresholds> {
  const rows = await prisma.thresholdConfig.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (key: string, fallback: number) => {
    const v = map.get(key);
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  };
  return {
    watchCm: num(THRESHOLD_KEYS.WATCH_CM, DEFAULT_THRESHOLDS.watchCm),
    warningCm: num(THRESHOLD_KEYS.WARNING_CM, DEFAULT_THRESHOLDS.warningCm),
    criticalCm: num(THRESHOLD_KEYS.CRITICAL_CM, DEFAULT_THRESHOLDS.criticalCm),
    staleSeconds: num(THRESHOLD_KEYS.STALE_SECONDS, DEFAULT_THRESHOLDS.staleSeconds),
  };
}

export async function setThreshold(
  key: keyof Thresholds,
  value: number
): Promise<void> {
  const dbKey: string =
    key === "watchCm"
      ? THRESHOLD_KEYS.WATCH_CM
      : key === "warningCm"
        ? THRESHOLD_KEYS.WARNING_CM
        : key === "criticalCm"
          ? THRESHOLD_KEYS.CRITICAL_CM
          : THRESHOLD_KEYS.STALE_SECONDS;

  await prisma.thresholdConfig.upsert({
    where: { key: dbKey },
    create: { key: dbKey, value },
    update: { value },
  });
}
