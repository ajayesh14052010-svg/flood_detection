// Flood status classification from a calibrated water level and thresholds.
//
// Classification operates on CALIBRATED centimetres only. When a reading has
// no calibrated value (calibration not configured) the device is
// CALIBRATION_REQUIRED, and raw values must not be coloured as flood severity.

import { FLOOD_STATUS, type FloodStatus, type Thresholds } from "./types";

/**
 * Classify a calibrated water level (cm) against thresholds.
 * Pass `null` for cm to indicate "no calibrated value available".
 */
export function classifyLevel(
  calibratedCm: number | null,
  thresholds: Thresholds
): FloodStatus {
  if (calibratedCm == null || !Number.isFinite(calibratedCm)) {
    return FLOOD_STATUS.CALIBRATION_REQUIRED;
  }
  if (calibratedCm >= thresholds.criticalCm) return FLOOD_STATUS.CRITICAL;
  if (calibratedCm >= thresholds.warningCm) return FLOOD_STATUS.WARNING;
  if (calibratedCm >= thresholds.watchCm) return FLOOD_STATUS.WATCH;
  return FLOOD_STATUS.NORMAL;
}

/**
 * Higher-level entry point that also handles the "no calibration configured"
 * case explicitly, so callers can pass a raw value plus a calibration flag.
 */
export function classifyReading(input: {
  calibratedCm: number | null;
  calibrationConfigured: boolean;
  thresholds: Thresholds;
}): FloodStatus {
  if (!input.calibrationConfigured) return FLOOD_STATUS.CALIBRATION_REQUIRED;
  return classifyLevel(input.calibratedCm, input.thresholds);
}

/**
 * Compute an "effective" status for display that layers online/staleness on
 * top of the last measured status. Offline / stale take precedence.
 */
export function effectiveStatus(input: {
  lastMeasuredStatus: FloodStatus;
  isOnline: boolean;
  isStale: boolean;
}): FloodStatus {
  if (!input.isOnline) return FLOOD_STATUS.SENSOR_OFFLINE;
  if (input.isStale) return FLOOD_STATUS.DATA_STALE;
  return input.lastMeasuredStatus;
}
