// Shared, dependency-free types and status constants used across the domain
// layer, API, and UI. Nothing here imports Node built-ins or Prisma, so these
// are safe to import from client components too.

export const FLOOD_STATUS = {
  NORMAL: "NORMAL",
  WATCH: "WATCH",
  WARNING: "WARNING",
  CRITICAL: "CRITICAL",
  SENSOR_OFFLINE: "SENSOR_OFFLINE",
  DATA_STALE: "DATA_STALE",
  CALIBRATION_REQUIRED: "CALIBRATION_REQUIRED",
  UNKNOWN: "UNKNOWN",
} as const;

export type FloodStatus = (typeof FLOOD_STATUS)[keyof typeof FLOOD_STATUS];

// Statuses that represent an actual measured condition (for badge colouring).
export const MEASURED_STATUSES: FloodStatus[] = [
  FLOOD_STATUS.NORMAL,
  FLOOD_STATUS.WATCH,
  FLOOD_STATUS.WARNING,
  FLOOD_STATUS.CRITICAL,
];

export const SEVERITY_RANK: Record<FloodStatus, number> = {
  [FLOOD_STATUS.NORMAL]: 0,
  [FLOOD_STATUS.CALIBRATION_REQUIRED]: 0,
  [FLOOD_STATUS.UNKNOWN]: 0,
  [FLOOD_STATUS.WATCH]: 1,
  [FLOOD_STATUS.DATA_STALE]: 2,
  [FLOOD_STATUS.SENSOR_OFFLINE]: 2,
  [FLOOD_STATUS.WARNING]: 3,
  [FLOOD_STATUS.CRITICAL]: 4,
};

export const DATA_QUALITY = {
  OK: "OK",
  STALE: "STALE",
  UNVERIFIED_LOCATION: "UNVERIFIED_LOCATION",
  SIMULATED: "SIMULATED",
} as const;

export type DataQuality = (typeof DATA_QUALITY)[keyof typeof DATA_QUALITY];

export const FLOW_SOURCE = {
  MEASURED: "MEASURED",
  ESTIMATED: "ESTIMATED",
} as const;

export type FlowSource = (typeof FLOW_SOURCE)[keyof typeof FLOW_SOURCE];

export const ALERT_TYPE = {
  WARNING: "WARNING",
  CRITICAL: "CRITICAL",
  SENSOR_OFFLINE: "SENSOR_OFFLINE",
  DATA_STALE: "DATA_STALE",
} as const;

export type AlertType = (typeof ALERT_TYPE)[keyof typeof ALERT_TYPE];

// Threshold keys persisted in the ThresholdConfig table.
export const THRESHOLD_KEYS = {
  WATCH_CM: "watch_cm",
  WARNING_CM: "warning_cm",
  CRITICAL_CM: "critical_cm",
  STALE_SECONDS: "stale_seconds",
} as const;

export interface Thresholds {
  watchCm: number;
  warningCm: number;
  criticalCm: number;
  staleSeconds: number;
}

// Default flood thresholds (centimetres of calibrated water level). These are
// starting points ONLY — administrators must tune them for the real installation.
export const DEFAULT_THRESHOLDS: Thresholds = {
  watchCm: 30,
  warningCm: 60,
  criticalCm: 100,
  staleSeconds: 900,
};

export const FLOW_UNAVAILABLE_MESSAGE =
  "Flow data unavailable — additional sensor or validated model required.";
export const CALIBRATION_REQUIRED_MESSAGE =
  "Raw sensor reading — calibration required.";
export const LOCATION_UNAVAILABLE_MESSAGE = "Location unavailable";
export const WAITING_FOR_DATA_MESSAGE = "Waiting for sensor data";
