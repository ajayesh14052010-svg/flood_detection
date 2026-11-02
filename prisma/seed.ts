// Demo / development seed. Creates clearly-labelled SIMULATED data so the
// interface can be exercised before hardware is connected. Every generated
// reading sets simulated=true and dataQuality=SIMULATED; real ingestion must
// never reuse these rows.
//
// Run with:  npm run db:seed

import { PrismaClient } from "@prisma/client";
import { generateDeviceToken, hashPassword, hashDeviceToken, tokenPrefix } from "../src/lib/crypto";
import { assignDevicesToZones } from "../src/lib/geo";
import { DEFAULT_THRESHOLDS } from "../src/lib/types";
import { env } from "../src/lib/env";

const prisma = new PrismaClient();

// Reference coordinates (Chennai area, flood-prone) used ONLY for demo zones.
const BASE = { lat: 13.0827, lng: 80.27 };
// ~0.00045 deg latitude ≈ 50 m; small offsets keep devices inside a zone.
const D = 0.0002;

interface DeviceSpec {
  deviceId: string;
  name: string;
  lat: number | null;
  lng: number | null;
  calibrated: boolean;
  // raw sequence to emit (ADC). For uncalibrated devices only raw is meaningful.
  rawSeries: number[];
  flow?: number | null;
  seenMinutesAgo: number; // staleness
  battery?: number;
}

const devices: DeviceSpec[] = [
  { deviceId: "FG-SENSOR-001", name: "Adyar Canal — Node A", lat: BASE.lat, lng: BASE.lng, calibrated: true, rawSeries: [1200, 1500, 1800, 2200, 2600, 3000, 3400, 3800], seenMinutesAgo: 1, battery: 3.9, flow: null },
  { deviceId: "FG-SENSOR-002", name: "Velachery — Node B", lat: BASE.lat + D, lng: BASE.lng + D, calibrated: true, rawSeries: [800, 900, 850, 950, 1000, 980, 1050, 1010], seenMinutesAgo: 2, battery: 4.1, flow: null },
  { deviceId: "FG-SENSOR-003", name: "Guindy — Node C", lat: BASE.lat + 2 * D, lng: BASE.lng - D, calibrated: true, rawSeries: [3000, 3600, 4200, 4600, 5000, 5300, 5600, 5900], seenMinutesAgo: 1, battery: 3.7, flow: null },
  { deviceId: "FG-SENSOR-004", name: "T. Nagar — Node D", lat: BASE.lat - 3 * D, lng: BASE.lng + 3 * D, calibrated: false, rawSeries: [1400, 1600, 1550, 1700, 1650, 1800, 1750, 1900], seenMinutesAgo: 3, battery: 3.8 },
  { deviceId: "FG-SENSOR-005", name: "Kodambakkam — Node E (stale)", lat: BASE.lat + 5 * D, lng: BASE.lng + 5 * D, calibrated: true, rawSeries: [2000, 2100, 2050], seenMinutesAgo: 25, battery: 3.2 },
  { deviceId: "FG-SENSOR-006", name: "Unplaced — Node F (offline)", lat: null, lng: null, calibrated: true, rawSeries: [], seenMinutesAgo: 240, battery: undefined },
];

const zones = [
  { zoneId: "FG-ZONE-001", name: "Adyar monitoring circle", centerLat: BASE.lat, centerLng: BASE.lng },
  { zoneId: "FG-ZONE-002", name: "Velachery–Guindy circle", centerLat: BASE.lat + 1.5 * D, centerLng: BASE.lng },
  { zoneId: "FG-ZONE-003", name: "T. Nagar circle", centerLat: BASE.lat - 3 * D, centerLng: BASE.lng + 3 * D },
];

// Classify a calibrated cm value for status labelling in seed output.
function classify(cm: number): string {
  const t = DEFAULT_THRESHOLDS;
  if (cm >= t.criticalCm) return "CRITICAL";
  if (cm >= t.warningCm) return "WARNING";
  if (cm >= t.watchCm) return "WATCH";
  return "NORMAL";
}
const SLOPE = 0.02; // demo calibration: cm = 0.02 * raw

async function main() {
  console.log("Seeding FloodGuard demo data (SIMULATED)…");

  await prisma.reading.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.zoneSensor.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.device.deleteMany();
  await prisma.gateway.deleteMany();
  await prisma.thresholdConfig.deleteMany();
  await prisma.admin.deleteMany();

  // Thresholds (so admin UI shows editable values)
  await prisma.thresholdConfig.createMany({
    data: [
      { key: "watch_cm", value: DEFAULT_THRESHOLDS.watchCm },
      { key: "warning_cm", value: DEFAULT_THRESHOLDS.warningCm },
      { key: "critical_cm", value: DEFAULT_THRESHOLDS.criticalCm },
      { key: "stale_seconds", value: DEFAULT_THRESHOLDS.staleSeconds },
    ],
  });

  // Admin
  const admin = await prisma.admin.create({
    data: {
      email: env.ADMIN_EMAIL,
      name: "Demo Administrator",
      passwordHash: hashPassword(env.ADMIN_PASSWORD),
    },
  });

  // Gateway — ESP32-2. Identified by a unique gateway id, NOT its IP.
  const gateway = await prisma.gateway.create({
    data: {
      gatewayId: "FG-GATEWAY-002",
      name: "ESP32-2 Gateway",
      firmwareVersion: "1.0.0",
      status: "ONLINE",
      isOnline: true,
      lastSeenAt: new Date(),
      latitude: BASE.lat + 4 * D,
      longitude: BASE.lng + 4 * D,
      gpsFix: true,
      lastReportedIp: "10.0.0.42",
      batteryVoltage: 4.0,
      loraRssi: -78,
      loraSnr: 9.5,
      packetsReceived: 0,
    },
  });

  // Devices + simulated readings
  const demoTokens: Array<{ device: string; token: string }> = [];
  for (const spec of devices) {
    const token = generateDeviceToken();
    demoTokens.push({ device: spec.deviceId, token });
    const seenAt = new Date(Date.now() - spec.seenMinutesAgo * 60_000);
    const isOffline = spec.seenMinutesAgo > 2 * (DEFAULT_THRESHOLDS.staleSeconds / 60);

    const dev = await prisma.device.create({
      data: {
        deviceId: spec.deviceId,
        name: spec.name,
        gatewayId: gateway.id,
        tokenHash: hashDeviceToken(token, env.DEVICE_TOKEN_SECRET),
        tokenPrefix: tokenPrefix(token),
        latitude: spec.lat,
        longitude: spec.lng,
        hasLocation: spec.lat != null && spec.lng != null,
        locationSource: spec.lat != null ? "MANUAL" : null,
        calibrationConfigured: spec.calibrated,
        calibrationSlope: SLOPE,
        calibrationIntercept: 0,
        lastSeenAt: seenAt,
        isOnline: !isOffline,
        status: isOffline ? "SENSOR_OFFLINE" : "UNKNOWN",
        lastPacketSeq: 0,
      },
    });

    let lastSeq = 0;
    const n = spec.rawSeries.length;
    for (let i = 0; i < n; i++) {
      const raw = spec.rawSeries[i];
      const seq = lastSeq + i + 1;
      const cm = spec.calibrated ? SLOPE * raw : null;
      const status = spec.calibrated ? classify(cm as number) : "CALIBRATION_REQUIRED";
      // spread historical readings across the last hour
      const ts = new Date(seenAt.getTime() - (n - 1 - i) * 5 * 60_000);
      await prisma.reading.create({
        data: {
          deviceId: dev.id,
          gatewayId: gateway.id,
          rawSensorValue: raw,
          calibratedWaterLevelCm: cm,
          waterFlowLpm: cm != null ? spec.flow ?? null : null,
          flowSource: spec.flow != null ? "MEASURED" : null,
          floodStatus: status,
          dataQuality: "SIMULATED",
          latitude: spec.lat,
          longitude: spec.lng,
          batteryVoltage: spec.battery ?? null,
          loraRssi: -70 - i,
          loraSnr: 10 - i * 0.2,
          packetSequence: seq,
          firmwareVersion: "1.0.0",
          simulated: true,
          receivedAt: ts,
        },
      });
      lastSeq = seq;
    }
    await prisma.device.update({
      where: { id: dev.id },
      data: {
        lastPacketSeq: lastSeq,
        status: isOffline
          ? "SENSOR_OFFLINE"
          : spec.calibrated && n
            ? classify(SLOPE * spec.rawSeries[n - 1])
            : "CALIBRATION_REQUIRED",
      },
    });
  }

  // Zone assignments via the real distance logic (dedupes overlaps).
  const deviceGeo = devices.map((d) => ({
    deviceId: d.deviceId,
    latitude: d.lat,
    longitude: d.lng,
    hasLocation: d.lat != null && d.lng != null,
  }));
  const zoneRows = [];
  for (const z of zones) {
    const created = await prisma.zone.create({ data: { ...z, radiusMeters: 50 } });
    zoneRows.push({ ...z, id: created.id });
  }
  const zoneInputs = zoneRows.map((z) => ({
    zoneId: z.zoneId,
    centerLat: z.centerLat,
    centerLng: z.centerLng,
    radiusMeters: 50,
  }));
  const assignments = assignDevicesToZones(deviceGeo, zoneInputs);
  for (const a of assignments) {
    const zone = zoneRows.find((z) => z.zoneId === a.zoneId)!;
    const device = await prisma.device.findUnique({ where: { deviceId: a.deviceId } });
    if (!device) continue;
    await prisma.zoneSensor.create({
      data: {
        zoneId: zone.id,
        deviceId: device.id,
        distanceMeters: a.distanceMeters,
      },
    });
  }

  // A couple of published demo alerts (clearly tied to simulated sensors).
  const s1 = await prisma.device.findUnique({ where: { deviceId: "FG-SENSOR-001" } });
  const s3 = await prisma.device.findUnique({ where: { deviceId: "FG-SENSOR-003" } });
  if (s3) {
    await prisma.alert.create({
      data: {
        deviceId: s3.id,
        type: "CRITICAL",
        severity: "CRITICAL",
        message: "FG-SENSOR-003 (SIMULATED): CRITICAL at 118.0 cm (raw 5900).",
        valueCm: 118,
        valueRaw: 5900,
      },
    });
  }
  if (s1) {
    await prisma.alert.create({
      data: {
        deviceId: s1.id,
        type: "WARNING",
        severity: "WARNING",
        message: "FG-SENSOR-001 (SIMULATED): WARNING at 76.0 cm (raw 3800).",
        valueCm: 76,
        valueRaw: 3800,
      },
    });
  }

  console.log("Seed complete.");
  console.log(`Admin login: ${env.ADMIN_EMAIL}`);
  console.log("Demo device tokens (dev only — do NOT commit):");
  for (const t of demoTokens) console.log(`  ${t.device}: ${t.token}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
