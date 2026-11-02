// PUT /api/v1/admin/devices/[deviceId]/calibration — admin-only.
// Configures the linear calibration (cm = slope * raw + intercept) and/or the
// device's verified location. Until calibration is configured the app must not
// present raw values as centimetres.

import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { getAdminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    calibration_configured: z.boolean(),
    slope: z.number().finite().positive().default(1),
    intercept: z.number().finite().default(0),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    location_source: z.enum(["GPS", "MANUAL"]).nullable().optional(),
  })
  .strict();

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const admin = await getAdminFromRequest();
  if (!admin) return fail(401, "admin_only");

  const { deviceId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(422, "invalid_payload", { errors: parsed.error?.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });

  const device = await prisma.device.findUnique({ where: { deviceId } });
  if (!device) return fail(404, "device_not_found");

  const d = parsed.data;
  const hasLocation = d.latitude != null && d.longitude != null;

  const updated = await prisma.device.update({
    where: { id: device.id },
    data: {
      calibrationConfigured: d.calibration_configured,
      calibrationSlope: d.slope,
      calibrationIntercept: d.intercept,
      ...(d.latitude !== undefined ? { latitude: d.latitude } : {}),
      ...(d.longitude !== undefined ? { longitude: d.longitude } : {}),
      ...(d.location_source !== undefined ? { locationSource: d.location_source } : {}),
      hasLocation,
    },
  });

  return ok({
    ok: true,
    device_id: updated.deviceId,
    calibration_configured: updated.calibrationConfigured,
    has_location: updated.hasLocation,
  });
}
