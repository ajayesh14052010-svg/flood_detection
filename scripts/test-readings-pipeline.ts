// Throwaway functional test of the /api/v1/readings ingestion path against Neon.
// Creates a temp device with a known token, authenticates it, runs the SAME
// ingestReading service the endpoint uses, verifies a Reading row landed, then
// deletes everything it created so no data persists.

import { prisma } from "../src/lib/db";
import { hashDeviceToken, generateDeviceToken } from "../src/lib/crypto";
import { authenticateDevice } from "../src/lib/deviceAuth";
import { ingestReading } from "../src/lib/ingest";
import type { ReadingPayload } from "../src/lib/validation";

async function main() {
  const deviceId = `FG-TEST-${Date.now()}`;
  const token = generateDeviceToken();

  const device = await prisma.device.create({
    data: {
      deviceId,
      name: "readings endpoint test",
      tokenHash: hashDeviceToken(token, (await import("../src/lib/env")).env.DEVICE_TOKEN_SECRET),
      tokenPrefix: token.slice(0, 8),
      status: "UNKNOWN",
      calibrationConfigured: false,
    },
  });

  // Payload shaped exactly like what the tolerant endpoint produces for a simple
  // ESP32 body { deviceId, waterLevel, timestamp }.
  const payload: ReadingPayload = {
    device_id: deviceId,
    gateway_id: "",
    raw_sensor_value: 512,
    packet_sequence: 1,
    simulated: false,
    latitude: 13.0,
    longitude: 80.2,
  };

  const auth = await authenticateDevice(deviceId, token);
  if (!auth) throw new Error("authenticateDevice returned null for a valid token");

  const badAuth = await authenticateDevice(deviceId, "wrong-token");
  if (badAuth) throw new Error("authenticateDevice accepted an invalid token");

  const result = await ingestReading(payload, auth, { reportedIp: "127.0.0.1" });
  if (result.duplicate) throw new Error("first reading flagged duplicate");

  const stored = await prisma.reading.findUnique({
    where: { deviceId_packetSequence: { deviceId: device.id, packetSequence: 1 } },
  });
  if (!stored) throw new Error("Reading was not persisted");

  // Duplicate: replay the same sequence -> must be rejected as duplicate, no new row.
  const replay = await ingestReading(payload, auth, {});
  if (!replay.duplicate) throw new Error("replayed packet was not detected as duplicate");
  const count = await prisma.reading.count({ where: { deviceId: device.id } });
  if (count !== 1) throw new Error(`expected exactly 1 reading, found ${count}`);

  // Alerts path must remain functional.
  const alerts = await prisma.alert.count();

  console.log(JSON.stringify({
    ok: true,
    ingest_status: result.status,
    calibrated_cm: result.calibratedCm,
    stored_reading_id: stored.id,
    stored_flood_status: stored.floodStatus,
    stored_data_quality: stored.dataQuality,
    duplicate_replay_detected: replay.duplicate,
    readings_for_device: count,
    alert_total: alerts,
  }));

  // Cleanup — remove only what this test created.
  await prisma.reading.deleteMany({ where: { deviceId: device.id } });
  await prisma.alert.deleteMany({ where: { deviceId: device.id } });
  await prisma.device.delete({ where: { id: device.id } });
  console.log("cleanup: test device + its readings removed");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("TEST FAILED:", e?.name ?? "Error", e?.code ?? "");
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
