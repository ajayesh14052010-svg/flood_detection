// Safe Neon connectivity + round-trip check.
//
//   npx tsx scripts/check-db.ts
//
// Read-only by design:
//   • connects and runs SELECT 1
//   • counts rows in every model so we can see existing data is intact
//   • proves INSERT + RETRIEVE works inside a transaction that is ALWAYS rolled
//     back (we throw at the end), so no test rows are ever persisted
//
// It never prints DATABASE_URL or any credential.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  const [{ ok }] = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
  console.log(`connect: OK (SELECT 1 -> ${ok})`);

  const counts = {
    devices: await prisma.device.count(),
    gateways: await prisma.gateway.count(),
    readings: await prisma.reading.count(),
    zones: await prisma.zone.count(),
    zoneSensors: await prisma.zoneSensor.count(),
    alerts: await prisma.alert.count(),
    admins: await prisma.admin.count(),
    thresholds: await prisma.thresholdConfig.count(),
  };
  console.log("existing row counts:", JSON.stringify(counts));

  // Round-trip write proof — rolled back, leaves the database untouched.
  const marker = `__checkdb_${Date.now()}`;
  let readBack = false;
  try {
    await prisma.$transaction(async (tx) => {
      const device = await tx.device.create({
        data: {
          deviceId: marker,
          name: "connectivity-check",
          tokenHash: "0000000000000000000000000000000000000000000000000000000000000000",
          tokenPrefix: marker.slice(0, 8),
          status: "UNKNOWN",
        },
      });
      await tx.reading.create({
        data: {
          deviceId: device.id,
          rawSensorValue: 0,
          floodStatus: "NORMAL",
          dataQuality: "OK",
          packetSequence: 1,
        },
      });
      const found = await tx.reading.findFirst({ where: { deviceId: device.id } });
      readBack = !!found && found.rawSensorValue === 0;
      // Force a rollback so nothing is persisted.
      throw new Error("__rollback__");
    });
  } catch (err) {
    if ((err as Error).message !== "__rollback__") throw err;
  }

  const markerStillThere = await prisma.device.count({ where: { deviceId: marker } });
  console.log(`insert+retrieve round-trip: ${readBack ? "OK" : "FAILED"}`);
  console.log(`rollback verified (test rows remaining: ${markerStillThere})`);

  await prisma.$disconnect();

  if (!readBack || markerStillThere !== 0) {
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error("connectivity check FAILED:", (err as Error)?.name ?? "Error");
  await prisma.$disconnect();
  process.exit(1);
});
