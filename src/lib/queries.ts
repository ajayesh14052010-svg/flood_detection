// Server-only data layer. Shared by API route handlers (for interactive client
// components) and by React Server Components (pages). All reads come from the
// database — never from hardcoded frontend values. Effective flood status is
// recomputed at read time so liveness (stale/offline) is always current.

import { prisma } from "./db";
import { getThresholds } from "./thresholds";
import { evaluateFreshness } from "./stale";
import { effectiveStatus } from "./classify";
import { resolveFlow } from "./flow";
import {
  FLOOD_STATUS,
  SEVERITY_RANK,
  type FloodStatus,
} from "./types";

type ReadingRow = {
  id: number;
  rawSensorValue: number;
  calibratedWaterLevelCm: number | null;
  waterFlowLpm: number | null;
  flowSource: string | null;
  floodStatus: string;
  dataQuality: string;
  latitude: number | null;
  longitude: number | null;
  batteryVoltage: number | null;
  loraRssi: number | null;
  loraSnr: number | null;
  packetSequence: number;
  firmwareVersion: string | null;
  simulated: boolean;
  receivedAt: Date;
};

export interface SensorView {
  deviceId: string;
  name: string;
  gatewayId: string | null;
  hasLocation: boolean;
  locationSource: string | null;
  latitude: number | null;
  longitude: number | null;
  calibrationConfigured: boolean;
  effectiveStatus: FloodStatus;
  storedStatus: FloodStatus;
  isOnline: boolean;
  isStale: boolean;
  isOffline: boolean;
  lastSeenAt: Date | null;
  ageSeconds: number | null;
  latest: {
    rawSensorValue: number | null;
    calibratedWaterLevelCm: number | null;
    waterFlowLpm: number | null;
    flowAvailable: boolean;
    flowEstimated: boolean;
    dataQuality: string | null;
    simulated: boolean;
    loraRssi: number | null;
    loraSnr: number | null;
    batteryVoltage: number | null;
    packetSequence: number | null;
    firmwareVersion: string | null;
    receivedAt: Date | null;
  };
}

function statusRank(s: string): number {
  return SEVERITY_RANK[s as FloodStatus] ?? -1;
}

async function latestReading(deviceId: number): Promise<ReadingRow | null> {
  return prisma.reading.findFirst({
    where: { deviceId },
    orderBy: { receivedAt: "desc" },
  }) as unknown as Promise<ReadingRow | null>;
}

function toSensorView(
  d: {
    deviceId: string;
    name: string;
    gatewayId: number | null;
    hasLocation: boolean;
    locationSource: string | null;
    latitude: number | null;
    longitude: number | null;
    calibrationConfigured: boolean;
    status: string;
    lastSeenAt: Date | null;
    gateway: { gatewayId: string } | null;
  },
  latest: ReadingRow | null,
  freshness: ReturnType<typeof evaluateFreshness>
): SensorView {
  const storedStatus = d.status as FloodStatus;
  const eff = effectiveStatus({
    lastMeasuredStatus: storedStatus,
    isOnline: !freshness.isOffline,
    isStale: freshness.isStale,
  });
  const flow = resolveFlow({
    waterFlowLpm: latest?.waterFlowLpm ?? null,
    flowSource: (latest?.flowSource as "MEASURED" | "ESTIMATED" | null) ?? null,
  });

  return {
    deviceId: d.deviceId,
    name: d.name,
    gatewayId: d.gateway?.gatewayId ?? null,
    hasLocation: d.hasLocation,
    locationSource: d.locationSource,
    latitude: d.hasLocation ? d.latitude : null,
    longitude: d.hasLocation ? d.longitude : null,
    calibrationConfigured: d.calibrationConfigured,
    effectiveStatus: eff,
    storedStatus,
    isOnline: !freshness.isOffline,
    isStale: freshness.isStale && !freshness.isOffline,
    isOffline: freshness.isOffline,
    lastSeenAt: d.lastSeenAt,
    ageSeconds: freshness.ageSeconds,
    latest: {
      rawSensorValue: latest?.rawSensorValue ?? null,
      calibratedWaterLevelCm: latest?.calibratedWaterLevelCm ?? null,
      waterFlowLpm: flow.available ? flow.valueLpm : null,
      flowAvailable: flow.available,
      flowEstimated: flow.estimated,
      dataQuality: latest?.dataQuality ?? null,
      simulated: latest?.simulated ?? false,
      loraRssi: latest?.loraRssi ?? null,
      loraSnr: latest?.loraSnr ?? null,
      batteryVoltage: latest?.batteryVoltage ?? null,
      packetSequence: latest?.packetSequence ?? null,
      firmwareVersion: latest?.firmwareVersion ?? null,
      receivedAt: latest?.receivedAt ?? null,
    },
  };
}

/** All sensors with current, DB-derived status. */
export async function listSensors(now: Date = new Date()): Promise<SensorView[]> {
  const devices = await prisma.device.findMany({
    include: { gateway: { select: { gatewayId: true } } },
  });
  const thresholds = await getThresholds();
  const out: SensorView[] = [];
  for (const d of devices) {
    const latest = await latestReading(d.id);
    const freshness = evaluateFreshness({
      lastSeenAt: d.lastSeenAt,
      now,
      staleSeconds: thresholds.staleSeconds,
    });
    out.push(toSensorView(d, latest, freshness));
  }
  return out;
}

export interface DashboardSummary {
  totalSensors: number;
  online: number;
  offline: number;
  warning: number;
  critical: number;
  monitoringZones: number;
  latestLevels: Array<{ deviceId: string; name: string; cm: number | null; status: FloodStatus; simulated: boolean }>;
  lastDataUpdate: Date | null;
  activeAlerts: number;
}

export async function getDashboardSummary(now: Date = new Date()): Promise<DashboardSummary> {
  const sensors = await listSensors(now);
  const zoneCount = await prisma.zone.count();
  const activeAlerts = await prisma.alert.count({ where: { acknowledged: false } });

  const online = sensors.filter((s) => s.isOnline && !s.isStale).length;
  const offline = sensors.filter((s) => s.isOffline).length;
  const warning = sensors.filter((s) => s.effectiveStatus === FLOOD_STATUS.WARNING).length;
  const critical = sensors.filter((s) => s.effectiveStatus === FLOOD_STATUS.CRITICAL).length;

  const latest = await prisma.reading.findFirst({
    orderBy: { receivedAt: "desc" },
    select: { receivedAt: true },
  });

  const latestLevels = sensors
    .map((s) => ({
      deviceId: s.deviceId,
      name: s.name,
      cm: s.latest.calibratedWaterLevelCm,
      status: s.effectiveStatus,
      simulated: s.latest.simulated,
    }))
    .sort((a, b) => (b.cm ?? -1) - (a.cm ?? -1))
    .slice(0, 6);

  return {
    totalSensors: sensors.length,
    online,
    offline,
    warning,
    critical,
    monitoringZones: zoneCount,
    latestLevels,
    lastDataUpdate: latest?.receivedAt ?? null,
    activeAlerts,
  };
}

export interface HistoryPoint {
  t: Date;
  raw: number;
  cm: number | null;
  flow: number | null;
  status: string;
}

export async function getSensorDetail(
  deviceId: string,
  limit = 100
): Promise<{ sensor: SensorView | null; history: HistoryPoint[]; zones: string[] }> {
  const all = await listSensors();
  const sensor = all.find((s) => s.deviceId === deviceId) ?? null;
  if (!sensor) return { sensor: null, history: [], zones: [] };

  const device = await prisma.device.findUnique({ where: { deviceId } });
  if (!device) return { sensor: null, history: [], zones: [] };

  const readings = await prisma.reading.findMany({
    where: { deviceId: device.id },
    orderBy: { receivedAt: "asc" },
    take: limit,
  });
  const history: HistoryPoint[] = readings.map((r) => ({
    t: r.receivedAt,
    raw: r.rawSensorValue,
    cm: r.calibratedWaterLevelCm,
    flow: r.waterFlowLpm,
    status: r.floodStatus,
  }));

  const memberships = await prisma.zoneSensor.findMany({
    where: { deviceId: device.id },
    include: { zone: { select: { zoneId: true } } },
  });
  return { sensor, history, zones: memberships.map((m) => m.zone.zoneId) };
}

export interface ZoneRollup {
  zoneId: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  sensors: Array<{ deviceId: string; name: string; cm: number | null; status: FloodStatus; distanceMeters: number }>;
  highestSeverity: FloodStatus | null;
  latestLevelCm: number | null;
  lastUpdate: Date | null;
  flowAvailable: boolean;
  hasFlowData: boolean;
}

export async function getZones(now: Date = new Date()): Promise<ZoneRollup[]> {
  const zones = await prisma.zone.findMany({
    include: { assignments: { include: { device: true } } },
  });
  const sensors = await listSensors(now);
  const byId = new Map(sensors.map((s) => [s.deviceId, s]));

  return zones.map((z) => {
    // Deduplicate by deviceId so overlapping zone rows don't double-count.
    const seen = new Set<string>();
    const members: ZoneRollup["sensors"] = [];
    for (const a of z.assignments) {
      const sv = byId.get(a.device.deviceId);
      if (!sv || seen.has(a.device.deviceId)) continue;
      seen.add(a.device.deviceId);
      members.push({
        deviceId: a.device.deviceId,
        name: a.device.name,
        cm: sv.latest.calibratedWaterLevelCm,
        status: sv.effectiveStatus,
        distanceMeters: a.distanceMeters,
      });
    }
    let highest: FloodStatus | null = null;
    let latestCm: number | null = null;
    let lastUpdate: Date | null = null;
    let hasFlow = false;
    for (const m of members) {
      const sv = byId.get(m.deviceId)!;
      if (!highest || statusRank(sv.effectiveStatus) > statusRank(highest)) {
        highest = sv.effectiveStatus;
      }
      if (sv.latest.calibratedWaterLevelCm != null) {
        latestCm =
          latestCm == null
            ? sv.latest.calibratedWaterLevelCm
            : Math.max(latestCm, sv.latest.calibratedWaterLevelCm);
      }
      if (sv.latest.receivedAt && (!lastUpdate || sv.latest.receivedAt > lastUpdate)) {
        lastUpdate = sv.latest.receivedAt;
      }
      if (sv.latest.flowAvailable) hasFlow = true;
    }
    return {
      zoneId: z.zoneId,
      name: z.name,
      centerLat: z.centerLat,
      centerLng: z.centerLng,
      radiusMeters: z.radiusMeters,
      sensors: members,
      highestSeverity: highest,
      latestLevelCm: latestCm,
      lastUpdate,
      flowAvailable: hasFlow,
      hasFlowData: hasFlow,
    };
  });
}

export interface LiveSnapshot {
  sensors: Array<{
    deviceId: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    hasLocation: boolean;
    status: FloodStatus;
    cm: number | null;
    simulated: boolean;
    lastSeenAt: Date | null;
  }>;
  zones: Array<{ zoneId: string; centerLat: number; centerLng: number; radiusMeters: number }>;
  gateways: Array<{
    gatewayId: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    isOnline: boolean;
    status: string;
  }>;
}

/** Compact payload for the interactive map (client polled / initial props). */
export async function getLiveSnapshot(now: Date = new Date()): Promise<LiveSnapshot> {
  const [sensors, zones, gateways] = await Promise.all([
    listSensors(now),
    prisma.zone.findMany(),
    prisma.gateway.findMany(),
  ]);
  return {
    sensors: sensors.map((s) => ({
      deviceId: s.deviceId,
      name: s.name,
      latitude: s.latitude,
      longitude: s.longitude,
      hasLocation: s.hasLocation,
      status: s.effectiveStatus,
      cm: s.latest.calibratedWaterLevelCm,
      simulated: s.latest.simulated,
      lastSeenAt: s.lastSeenAt,
    })),
    zones: zones.map((z) => ({
      zoneId: z.zoneId,
      centerLat: z.centerLat,
      centerLng: z.centerLng,
      radiusMeters: z.radiusMeters,
    })),
    gateways: gateways.map((g) => ({
      gatewayId: g.gatewayId,
      name: g.name,
      latitude: g.latitude,
      longitude: g.longitude,
      isOnline: g.isOnline,
      status: g.status,
    })),
  };
}

export interface AlertView {
  id: number;
  type: string;
  severity: string;
  message: string;
  deviceId: string | null;
  zoneId: string | null;
  acknowledged: boolean;
  createdAt: Date;
  simulated: boolean;
}

export async function getAlerts(includeAcknowledged = true): Promise<AlertView[]> {
  const alerts = await prisma.alert.findMany({
    where: includeAcknowledged ? {} : { acknowledged: false },
    orderBy: { createdAt: "desc" },
    include: { device: { select: { deviceId: true } } },
  });
  return alerts.map((a) => ({
    id: a.id,
    type: a.type,
    severity: a.severity,
    message: a.message,
    deviceId: a.device?.deviceId ?? null,
    zoneId: null,
    acknowledged: a.acknowledged,
    createdAt: a.createdAt,
    simulated: a.message.includes("SIMULATED"),
  }));
}

export interface GatewayDiagnostics {
  gatewayId: string;
  name: string;
  isOnline: boolean;
  status: string;
  lastSeenAt: Date | null;
  ageSeconds: number | null;
  firmwareVersion: string | null;
  lastReportedIp: string | null;
  latitude: number | null;
  longitude: number | null;
  gpsFix: boolean;
  batteryVoltage: number | null;
  loraRssi: number | null;
  loraSnr: number | null;
  packetsReceived: number;
  sensorsOnline: number;
  sensorsTotal: number;
}

export async function getGatewayDiagnostics(
  gatewayId: string,
  now: Date = new Date()
): Promise<GatewayDiagnostics | null> {
  const gw = await prisma.gateway.findUnique({
    where: { gatewayId },
    include: { devices: { select: { id: true, lastSeenAt: true } } },
  });
  if (!gw) return null;
  const thresholds = await getThresholds();
  const freshness = evaluateFreshness({
    lastSeenAt: gw.lastSeenAt,
    now,
    staleSeconds: thresholds.staleSeconds,
  });
  const sensorsOnline = gw.devices.filter((d) => {
    if (!d.lastSeenAt) return false;
    const age = (now.getTime() - d.lastSeenAt.getTime()) / 1000;
    return age <= thresholds.staleSeconds * 2;
  }).length;

  return {
    gatewayId: gw.gatewayId,
    name: gw.name,
    isOnline: gw.isOnline && !freshness.isOffline,
    status: gw.isOnline && !freshness.isOffline ? "ONLINE" : "OFFLINE",
    lastSeenAt: gw.lastSeenAt,
    ageSeconds: freshness.ageSeconds,
    firmwareVersion: gw.firmwareVersion,
    lastReportedIp: gw.lastReportedIp,
    latitude: gw.latitude,
    longitude: gw.longitude,
    gpsFix: gw.gpsFix,
    batteryVoltage: gw.batteryVoltage,
    loraRssi: gw.loraRssi,
    loraSnr: gw.loraSnr,
    packetsReceived: gw.packetsReceived,
    sensorsOnline,
    sensorsTotal: gw.devices.length,
  };
}
