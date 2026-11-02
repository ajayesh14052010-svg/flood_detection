// POST /api/v1/devices/readings — authenticated sensor ingestion.
//
// Flow: rate limit -> validate payload -> verify device token -> persist via the
// ingestion service (duplicate handling, calibration, classification, alerts).
// Device tokens are never logged or echoed. Errors are generic.

import type { NextRequest } from "next/server";
import { ok, fail, deviceTokenFromRequest, handleRouteError } from "@/lib/http";
import { validateReadingPayload } from "@/lib/validation";
import { authenticateDevice } from "@/lib/deviceAuth";
import { ingestReading } from "@/lib/ingest";
import { prisma } from "@/lib/db";
import { rateLimit, clientIpFromHeaders } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = clientIpFromHeaders(req.headers);
  const rl = rateLimit(`device:${ip}`, undefined, 600, 60_000);
  if (!rl.ok) {
    return fail(429, "rate_limited", { retryAfterMs: rl.retryAfterMs });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "invalid_json");
  }

  const validation = validateReadingPayload(body);
  if (!validation.ok || !validation.data) {
    return fail(422, "invalid_payload", { errors: validation.errors });
  }
  const payload = validation.data;

  const token = deviceTokenFromRequest(req);

  try {
    const device = await authenticateDevice(payload.device_id, token);
    if (!device) {
      // Do not reveal whether the device exists or the token is wrong.
      return fail(401, "unauthorized");
    }

    // Resolve the gateway row (diagnostic only; ingestion tolerates an unknown id).
    const gateway = await prisma.gateway.findUnique({
      where: { gatewayId: payload.gateway_id },
      select: { id: true },
    });

    const reportedIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    const result = await ingestReading(
      payload,
      device,
      { gatewayDbId: gateway?.id ?? null, reportedIp }
    );
    if (result.reason === "device_not_found") {
      return fail(404, "device_not_found");
    }
    return ok({
      ok: true,
      duplicate: result.duplicate,
      status: result.status,
      calibrated_water_level_cm: result.calibratedCm,
      alert_created: result.alertCreated,
    });
  } catch (err) {
    // A database outage here must not surface as a generic 500 with a Prisma
    // message (which can contain the connection string); handleRouteError maps
    // connection failures to a safe 503 and other faults to a generic 500.
    return handleRouteError(err);
  }
}
