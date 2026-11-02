// Client-safe display helpers. Depends only on the dependency-free types
// module, so it is safe to import from browser components.

import {
  FLOOD_STATUS,
  CALIBRATION_REQUIRED_MESSAGE,
  LOCATION_UNAVAILABLE_MESSAGE,
  WAITING_FOR_DATA_MESSAGE,
  type FloodStatus,
} from "./types";

export function statusLabel(status: FloodStatus | string): string {
  switch (status) {
    case FLOOD_STATUS.NORMAL:
      return "Normal";
    case FLOOD_STATUS.WATCH:
      return "Watch";
    case FLOOD_STATUS.WARNING:
      return "Warning";
    case FLOOD_STATUS.CRITICAL:
      return "Critical";
    case FLOOD_STATUS.SENSOR_OFFLINE:
      return "Sensor offline";
    case FLOOD_STATUS.DATA_STALE:
      return "Data stale";
    case FLOOD_STATUS.CALIBRATION_REQUIRED:
      return "Calibration required";
    default:
      return "Unknown";
  }
}

// Tailwind class string per status (text/bg/ring).
export function statusClasses(status: FloodStatus | string): string {
  switch (status) {
    case FLOOD_STATUS.NORMAL:
      return "bg-green-100 text-green-800 ring-green-600/20";
    case FLOOD_STATUS.WATCH:
      return "bg-yellow-100 text-yellow-800 ring-yellow-600/20";
    case FLOOD_STATUS.WARNING:
      return "bg-orange-100 text-orange-800 ring-orange-600/20";
    case FLOOD_STATUS.CRITICAL:
      return "bg-red-100 text-red-800 ring-red-600/20";
    case FLOOD_STATUS.SENSOR_OFFLINE:
      return "bg-slate-200 text-slate-700 ring-slate-500/20";
    case FLOOD_STATUS.DATA_STALE:
      return "bg-purple-100 text-purple-800 ring-purple-600/20";
    case FLOOD_STATUS.CALIBRATION_REQUIRED:
      return "bg-sky-100 text-sky-800 ring-sky-600/20";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-400/20";
  }
}

// Solid hex colour for map markers / chart series.
export function statusColor(status: FloodStatus | string): string {
  switch (status) {
    case FLOOD_STATUS.NORMAL:
      return "#16a34a";
    case FLOOD_STATUS.WATCH:
      return "#ca8a04";
    case FLOOD_STATUS.WARNING:
      return "#ea580c";
    case FLOOD_STATUS.CRITICAL:
      return "#dc2626";
    case FLOOD_STATUS.SENSOR_OFFLINE:
      return "#64748b";
    case FLOOD_STATUS.DATA_STALE:
      return "#9333ea";
    case FLOOD_STATUS.CALIBRATION_REQUIRED:
      return "#0284c7";
    default:
      return "#94a3b8";
  }
}

export function formatCm(cm: number | null): string {
  if (cm == null) return CALIBRATION_REQUIRED_MESSAGE;
  return `${cm.toFixed(1)} cm`;
}

export function formatTime(d: Date | null): string {
  if (!d) return WAITING_FOR_DATA_MESSAGE;
  return new Date(d).toLocaleString();
}

export function formatTimestamp(d: Date | string | null): string {
  if (!d) return WAITING_FOR_DATA_MESSAGE;
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

export function locationLabel(
  hasLocation: boolean,
  lat: number | null,
  lng: number | null
): string {
  if (!hasLocation || lat == null || lng == null) return LOCATION_UNAVAILABLE_MESSAGE;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
