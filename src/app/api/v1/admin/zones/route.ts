// POST /api/v1/admin/zones — create a monitoring zone and assign devices that
// fall within its radius using the geographic-distance calculation. Zones are
// monitoring circles (default 50 m), not administrative wards.

import type { NextRequest } from "next/server";
import { ok, fail, handleRouteError } from "@/lib/http";
import { getAdminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assignDevicesToZones } from "@/lib/geo";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    zone_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/),
    name: z.string().min(1).max(120),
    center_lat: z.number().min(-90).max(90),
    center_lng: z.number().min(-180).max(180),
    radius_meters: z.number().int().positive().max(1000).default(50),
  })
  .strict();

export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest();
  if (!admin) return fail(401, "admin_only");

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(422, "invalid_payload");
  const d = parsed.data;

  try {
    const existing = await prisma.zone.findUnique({ where: { zoneId: d.zone_id } });
    if (existing) return fail(409, "zone_exists");

    const zone = await prisma.zone.create({
      data: {
        zoneId: d.zone_id,
        name: d.name,
        centerLat: d.center_lat,
        centerLng: d.center_lng,
        radiusMeters: d.radius_meters,
      },
    });

    // Assign located devices within the radius.
    const devices = await prisma.device.findMany({ where: { hasLocation: true } });
    const assignments = assignDevicesToZones(
      devices.map((x) => ({
        deviceId: x.deviceId,
        latitude: x.latitude,
        longitude: x.longitude,
        hasLocation: true,
      })),
      [{ zoneId: d.zone_id, centerLat: d.center_lat, centerLng: d.center_lng, radiusMeters: d.radius_meters }]
    );

    for (const a of assignments) {
      const device = devices.find((x) => x.deviceId === a.deviceId);
      if (!device) continue;
      await prisma.zoneSensor.upsert({
        where: { zoneId_deviceId: { zoneId: zone.id, deviceId: device.id } },
        create: { zoneId: zone.id, deviceId: device.id, distanceMeters: a.distanceMeters },
        update: { distanceMeters: a.distanceMeters },
      });
    }

    return ok({
      ok: true,
      zone_id: zone.zoneId,
      assigned_devices: assignments.map((a) => a.deviceId),
      // expose the computed distance of the nearest assignment for the admin view
      nearest_meters: assignments.length
        ? Math.min(...assignments.map((a) => a.distanceMeters))
        : null,
    }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
