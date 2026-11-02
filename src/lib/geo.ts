// Geographic helpers for 50-metre monitoring zones.
//
// Zones are configured monitoring circles, NOT administrative wards. A device
// is assigned to a zone when its verified location falls within the zone
// radius. Overlapping zones are handled by keeping one (zone, device) pairing
// with its measured distance — a reading is never counted twice for the same
// zone, and callers dedupe by zoneId when aggregating.

const EARTH_RADIUS_M = 6371008.8; // mean Earth radius in metres

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in metres between two lat/lng points (haversine). */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function isWithinRadius(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  radiusMeters: number
): boolean {
  return haversineMeters(lat1, lng1, lat2, lng2) <= radiusMeters;
}

export interface GeoPoint {
  deviceId: string;
  latitude: number | null;
  longitude: number | null;
  hasLocation: boolean;
}

export interface ZoneLike {
  zoneId: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
}

export interface ZoneAssignment {
  zoneId: string;
  deviceId: string;
  distanceMeters: number;
}

/**
 * Assign devices to every zone they fall within. Devices without a verified
 * location are skipped (the UI shows "Location unavailable" for them).
 * A device in overlapping zones is listed once per zone with its own distance;
 * aggregation callers dedupe readings by zone.
 */
export function assignDevicesToZones(
  devices: GeoPoint[],
  zones: ZoneLike[]
): ZoneAssignment[] {
  const out: ZoneAssignment[] = [];
  for (const zone of zones) {
    for (const d of devices) {
      if (!d.hasLocation || d.latitude == null || d.longitude == null) {
        continue;
      }
      const dist = haversineMeters(
        zone.centerLat,
        zone.centerLng,
        d.latitude,
        d.longitude
      );
      if (dist <= zone.radiusMeters) {
        out.push({ zoneId: zone.zoneId, deviceId: d.deviceId, distanceMeters: dist });
      }
    }
  }
  return out;
}

/**
 * Highest severity across a set of statuses. Returns null for an empty set.
 * Used by zone rollups; pass each device's latest status once (deduped) so a
 * device shared between overlapping zones is not over-weighted.
 */
export function uniqueDeviceIds<T extends { deviceId: string }>(rows: T[]): string[] {
  return Array.from(new Set(rows.map((r) => r.deviceId)));
}
