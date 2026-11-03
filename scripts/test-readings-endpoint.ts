// End-to-end test of the live /api/v1/readings route over HTTP, using the
// gateway's real payload shape. Registers a throwaway device, POSTs via fetch,
// asserts a 201 and a persisted Reading in Neon, then removes the test rows.

import { prisma } from "../src/lib/db";
import { hashDeviceToken } from "../src/lib/crypto";
import { env } from "../src/lib/env";

const BASE = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3005";
const DEVICE_ID = "FLOOD_NODE_01";
const TOKEN = "fg_test_" + Date.now();

async function main() {
  // Register the device with a known token hash (what POST /admin/devices does).
  await prisma.device.deleteMany({ where: { deviceId: DEVICE_ID } });
  await prisma.device.create({
    data: {
      deviceId: DEVICE_ID,
      name: "Flood ESP32 node 01 (e2e test)",
      tokenHash: hashDeviceToken(TOKEN, env.DEVICE_TOKEN_SECRET),
      tokenPrefix: TOKEN.slice(0, 8),
      status: "UNKNOWN",
      calibrationConfigured: false,
    },
  });

  // Exact payload your gateway.ino builds (no packet_sequence).
  const gatewayBody = {
    device_id: DEVICE_ID,
    gateway_id: "FG-GATEWAY-002",
    raw_sensor_value: 620,
    latitude: null,
    longitude: null,
    water_level_cm: null,
    flood_status: "DANGER",
  };

  const res = await fetch(`${BASE}/api/v1/readings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(gatewayBody),
  });
  const json = await res.json();
  console.log("HTTP", res.status, JSON.stringify(json));
  if (res.status !== 201) throw new Error("expected 201 on first accepted reading");

  // A second post must succeed too (server-time sequence keeps advancing).
  const res2 = await fetch(`${BASE}/api/v1/readings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ ...gatewayBody, raw_sensor_value: 700 }),
  });
  if (res2.status !== 201) throw new Error(`expected 201 on second reading, got ${res2.status}`);
  await res2.json();

  const rows = await prisma.reading.findMany({
    where: { device: { deviceId: DEVICE_ID } },
    orderBy: { receivedAt: "asc" },
    select: { rawSensorValue: true, floodStatus: true, dataQuality: true, packetSequence: true },
  });
  const dev = await prisma.device.findUnique({
    where: { deviceId: DEVICE_ID },
    select: { isOnline: true, status: true, lastSeenAt: true },
  });

  console.log(JSON.stringify({ persisted: rows, device_after: dev }, null, 2));
  if (rows.length !== 2) throw new Error(`expected 2 readings, found ${rows.length}`);
  if (!dev?.isOnline) throw new Error("device not marked online after ingestion");

  // Cleanup only what this test created.
  await prisma.reading.deleteMany({ where: { device: { deviceId: DEVICE_ID } } });
  await prisma.alert.deleteMany({ where: { device: { deviceId: DEVICE_ID } } });
  await prisma.device.deleteMany({ where: { deviceId: DEVICE_ID } });
  console.log("E2E OK — test rows removed");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("E2E FAILED:", e?.message ?? e);
  await prisma.reading.deleteMany({ where: { device: { deviceId: DEVICE_ID } } }).catch(() => {});
  await prisma.device.deleteMany({ where: { deviceId: DEVICE_ID } }).catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
