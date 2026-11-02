// Sensor-reading ingestion service.
//
// This is the single place where a device payload becomes a persisted,
// classified reading. It is framework-free (no `next/*` imports) so it can be
// unit-tested directly against a throwaway SQLite database.
//
// Responsibilities:
//   • duplicate-packet detection (per-device monotonic sequence + unique index)
//   • calibration (raw -> cm only when configured; never claim cm otherwise)
//   • classification against configurable thresholds
//   • flow availability (never invent flow)
//   • data-quality + simulated labelling
//   • server reception timestamp
//   • device/gateway liveness update + escalation alerts

import { prisma } from "./db";
import type { ReadingPayload } from "./validation";
import type { AuthenticatedDevice } from "./deviceAuth";
import { getThresholds } from "./thresholds";
import { calibrateToCm } from "./calibration";
import { classifyReading } from "./classify";
import {
  ALERT_TYPE,
  DATA_QUALITY,
  FLOOD_STATUS,
  SEVERITY_RANK,
  type FloodStatus,
} from "./types";

export interface IngestResult {
  duplicate: boolean;
  status: FloodStatus;
  calibratedCm: number | null;
  readingId?: number;
  alertCreated: boolean;
  reason?: string;
}

export interface IngestContext {
  /** Optional gateway row to mark live (resolved by the caller). */
  gatewayDbId?: number | null;
  reportedIp?: string | null;
  now?: Date;
}

/**
 * Pure duplicate rule: a packet is a duplicate when its per-device sequence is
 * not strictly greater than the last accepted one. Exported for testing.
 */
export function isDuplicatePacket(reported: number, lastSeq: number): boolean {
  return reported <= lastSeq;
}

/**
 * Persist one reading for an already-authenticated device. The caller must have
 * verified the device token (see deviceAuth.authenticateDevice) — this function
 * trusts that `device.id` is legitimate.
 */
export async function ingestReading(
  payload: ReadingPayload,
  device: AuthenticatedDevice,
  ctx: IngestContext = {}
): Promise<IngestResult> {
  const now = ctx.now ?? new Date();

  const dev = await prisma.device.findUnique({
    where: { id: device.id },
    select: {
      id: true,
      deviceId: true,
      status: true,
      lastPacketSeq: true,
      calibrationConfigured: true,
      calibrationSlope: true,
      calibrationIntercept: true,
      hasLocation: true,
    },
  });
  if (!dev) {
    return {
      duplicate: false,
      status: FLOOD_STATUS.UNKNOWN,
      calibratedCm: null,
      alertCreated: false,
      reason: "device_not_found",
    };
  }

  // --- Duplicate packet handling ----------------------------------------
  // A packet is duplicate when its sequence is <= the last accepted sequence.
  if (isDuplicatePacket(payload.packet_sequence, dev.lastPacketSeq)) {
    return {
      duplicate: true,
      status: dev.status as FloodStatus,
      calibratedCm: null,
      alertCreated: false,
      reason: "duplicate_sequence",
    };
  }

  // --- Calibration ------------------------------------------------------
  // Prefer a device-provided calibrated value; otherwise derive from raw using
  // the stored calibration. Without calibration we return null (cm unknown).
  let calibratedCm: number | null = null;
  if (typeof payload.calibrated_water_level_cm === "number") {
    calibratedCm = dev.calibrationConfigured
      ? payload.calibrated_water_level_cm
      : null;
  } else {
    calibratedCm = calibrateToCm(payload.raw_sensor_value, {
      configured: dev.calibrationConfigured,
      slope: dev.calibrationSlope,
      intercept: dev.calibrationIntercept,
    });
  }

  // --- Classification ---------------------------------------------------
  const thresholds = await getThresholds();
  const status = classifyReading({
    calibratedCm,
    calibrationConfigured: dev.calibrationConfigured,
    thresholds,
  });

  // --- Data quality -----------------------------------------------------
  let dataQuality: string = DATA_QUALITY.OK;
  if (payload.simulated) dataQuality = DATA_QUALITY.SIMULATED;
  else if (payload.latitude == null || payload.longitude == null)
    dataQuality = DATA_QUALITY.UNVERIFIED_LOCATION;

  // --- Flow (never invented) --------------------------------------------
  const flowLpm =
    typeof payload.water_flow_lpm === "number" ? payload.water_flow_lpm : null;
  const flowSource = flowLpm != null ? "MEASURED" : null;

  // --- Persist reading (unique index guards duplicates concurrently) ----
  let reading;
  try {
    reading = await prisma.reading.create({
      data: {
        deviceId: dev.id,
        gatewayId: ctx.gatewayDbId ?? device.gatewayId ?? null,
        rawSensorValue: payload.raw_sensor_value,
        calibratedWaterLevelCm: calibratedCm,
        waterFlowLpm: flowLpm,
        flowSource,
        floodStatus: status,
        dataQuality,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        batteryVoltage: payload.battery_voltage ?? null,
        loraRssi: payload.lora_rssi ?? null,
        loraSnr: payload.lora_snr ?? null,
        packetSequence: payload.packet_sequence,
        firmwareVersion: payload.firmware_version ?? null,
        simulated: payload.simulated,
        receivedAt: now,
      },
    });
  } catch (e: unknown) {
    // Unique constraint (deviceId, packetSequence) race -> treat as duplicate.
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      return {
        duplicate: true,
        status: dev.status as FloodStatus,
        calibratedCm,
        alertCreated: false,
        reason: "duplicate_conflict",
      };
    }
    throw e;
  }

  // --- Update device liveness + latest status ---------------------------
  await prisma.device.update({
    where: { id: dev.id },
    data: {
      lastSeenAt: now,
      isOnline: true,
      lastPacketSeq: Math.max(dev.lastPacketSeq, payload.packet_sequence),
      status,
    },
  });

  // --- Gateway liveness -------------------------------------------------
  const gatewayId = ctx.gatewayDbId ?? device.gatewayId;
  if (gatewayId) {
    await prisma.gateway.update({
      where: { id: gatewayId },
      data: {
        lastSeenAt: now,
        isOnline: true,
        status: "ONLINE",
        packetsReceived: { increment: 1 },
        ...(ctx.reportedIp ? { lastReportedIp: ctx.reportedIp } : {}),
        ...(payload.lora_rssi != null ? { loraRssi: payload.lora_rssi } : {}),
        ...(payload.lora_snr != null ? { loraSnr: payload.lora_snr } : {}),
      },
    });
  }

  // --- Escalation alerts (only when severity increases) -----------------
  const prevRank = SEVERITY_RANK[dev.status as FloodStatus] ?? -1;
  const nowRank = SEVERITY_RANK[status] ?? 0;
  let alertCreated = false;
  if (
    (status === FLOOD_STATUS.WARNING || status === FLOOD_STATUS.CRITICAL) &&
    nowRank > prevRank
  ) {
    await prisma.alert.create({
      data: {
        deviceId: dev.id,
        type: status === FLOOD_STATUS.CRITICAL ? ALERT_TYPE.CRITICAL : ALERT_TYPE.WARNING,
        severity: status === FLOOD_STATUS.CRITICAL ? "CRITICAL" : "WARNING",
        message: `${dev.deviceId}: ${status} at ${
          calibratedCm != null ? `${calibratedCm.toFixed(1)} cm` : "calibration required"
        } (raw ${payload.raw_sensor_value}).`,
        valueCm: calibratedCm,
        valueRaw: payload.raw_sensor_value,
      },
    });
    alertCreated = true;
  }

  return { duplicate: false, status, calibratedCm, readingId: reading.id, alertCreated };
}

/**
 * Sweep every device and flag STALE / OFFLINE conditions, creating alerts on
 * transition. Called by a background tick or an admin action.
 */
export async function detectStaleAndOffline(
  now: Date = new Date(),
  staleSeconds: number
): Promise<{ stale: number; offline: number }> {
  const devices = await prisma.device.findMany({
    select: { id: true, deviceId: true, status: true, lastSeenAt: true, isOnline: true },
  });
  let stale = 0;
  let offline = 0;
  for (const d of devices) {
    const age = d.lastSeenAt ? (now.getTime() - d.lastSeenAt.getTime()) / 1000 : Infinity;
    const isOffline = age > staleSeconds * 2;
    const isStale = age > staleSeconds;
    if (isOffline) {
      offline++;
      if (d.status !== FLOOD_STATUS.SENSOR_OFFLINE) {
        await prisma.device.update({
          where: { id: d.id },
          data: { status: FLOOD_STATUS.SENSOR_OFFLINE, isOnline: false },
        });
        await prisma.alert.create({
          data: {
            deviceId: d.id,
            type: ALERT_TYPE.SENSOR_OFFLINE,
            severity: "WARNING",
            message: `${d.deviceId} is offline (no packet for ${Math.round(age)}s).`,
          },
        });
      }
    } else if (isStale) {
      stale++;
      if (d.status !== FLOOD_STATUS.DATA_STALE && d.status !== FLOOD_STATUS.SENSOR_OFFLINE) {
        await prisma.device.update({ where: { id: d.id }, data: { status: FLOOD_STATUS.DATA_STALE } });
        await prisma.alert.create({
          data: {
            deviceId: d.id,
            type: ALERT_TYPE.DATA_STALE,
            severity: "INFO",
            message: `${d.deviceId} data is stale (last packet ${Math.round(age)}s ago).`,
          },
        });
      }
    }
  }
  return { stale, offline };
}
