// POST /api/v1/admin/devices — register a new sensor node (admin only).
// Generates a device token, stores ONLY its SHA-256 hash, and returns the raw
// token one time for the firmware to be provisioned with. The token is never
// persisted in plaintext or exposed on public endpoints.

import type { NextRequest } from "next/server";
import { ok, fail, handleRouteError } from "@/lib/http";
import { getAdminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateDeviceToken, hashDeviceToken, tokenPrefix } from "@/lib/crypto";
import { env } from "@/lib/env";
import { registerDeviceSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest();
  if (!admin) return fail(401, "admin_only");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "invalid_json");
  }
  const parsed = registerDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return fail(422, "invalid_payload", { errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  }
  const d = parsed.data;

  try {
    const existing = await prisma.device.findUnique({ where: { deviceId: d.device_id } });
    if (existing) return fail(409, "device_exists");

    let gatewayId: number | null = null;
    if (d.gateway_id) {
      const gw = await prisma.gateway.findUnique({ where: { gatewayId: d.gateway_id } });
      if (!gw) return fail(422, "unknown_gateway");
      gatewayId = gw.id;
    }

    const token = generateDeviceToken();
    const hasLocation = d.latitude != null && d.longitude != null;
    const device = await prisma.device.create({
      data: {
        deviceId: d.device_id,
        name: d.name,
        gatewayId,
        tokenHash: hashDeviceToken(token, env.DEVICE_TOKEN_SECRET),
        tokenPrefix: tokenPrefix(token),
        latitude: d.latitude ?? null,
        longitude: d.longitude ?? null,
        hasLocation,
        locationSource: hasLocation ? "MANUAL" : null,
        status: "UNKNOWN",
        calibrationConfigured: false,
      },
    });

    return ok(
      {
        ok: true,
        device_id: device.deviceId,
        // One-time secret. Shown only to the authenticated admin, once.
        device_token: token,
        note: "Store this token securely on the device. It will not be shown again.",
      },
      { status: 201 }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
