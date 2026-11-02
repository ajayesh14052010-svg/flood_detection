// POST /api/v1/gateways/[gatewayId]/heartbeat — mark a gateway live and record
// gateway-level telemetry (GPS, battery, LoRa, firmware) independently of any
// sensor reading. This is a protected device-management API: it requires an
// authenticated admin session, so it cannot be called by an anonymous client.
// The gateway is identified by its unique id, never its IP; the IP is stored for
// diagnostics only.

import { z } from "zod";
import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { getAdminFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getGatewayDiagnostics } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const heartbeatSchema = z
  .object({
    firmware_version: z.string().min(1).max(40).optional(),
    battery_voltage: z.number().min(0).max(100).nullable().optional(),
    lora_rssi: z.number().int().min(-200).max(0).nullable().optional(),
    lora_snr: z.number().min(-50).max(50).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    gps_fix: z.boolean().optional(),
    last_reported_ip: z.string().max(64).nullable().optional(),
    packets_delta: z.number().int().min(0).max(100000).optional(),
  })
  .strict();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gatewayId: string }> }
) {
  const admin = await getAdminFromRequest();
  if (!admin) return fail(401, "unauthorized");

  const { gatewayId } = await params;
  const id = decodeURIComponent(gatewayId);

  const gw = await prisma.gateway.findUnique({
    where: { gatewayId: id },
    select: { id: true },
  });
  if (!gw) return fail(404, "gateway_not_found");

  let body: unknown = {};
  try {
    body = req.headers.get("content-length") === "0" ? {} : await req.json();
  } catch {
    body = {};
  }
  const parsed = heartbeatSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return fail(422, "invalid_payload", { errors: parsed.error.flatten() });
  }
  const h = parsed.data;
  const now = new Date();

  await prisma.gateway.update({
    where: { id: gw.id },
    data: {
      lastSeenAt: now,
      isOnline: true,
      status: "ONLINE",
      ...(h.firmware_version ? { firmwareVersion: h.firmware_version } : {}),
      ...(h.battery_voltage !== undefined ? { batteryVoltage: h.battery_voltage } : {}),
      ...(h.lora_rssi !== undefined ? { loraRssi: h.lora_rssi } : {}),
      ...(h.lora_snr !== undefined ? { loraSnr: h.lora_snr } : {}),
      ...(h.latitude !== undefined ? { latitude: h.latitude } : {}),
      ...(h.longitude !== undefined ? { longitude: h.longitude } : {}),
      ...(h.gps_fix !== undefined ? { gpsFix: h.gps_fix } : {}),
      ...(h.last_reported_ip !== undefined ? { lastReportedIp: h.last_reported_ip } : {}),
      ...(h.packets_delta ? { packetsReceived: { increment: h.packets_delta } } : {}),
    },
  });

  const diag = await getGatewayDiagnostics(id, now);
  return ok({ ok: true, gateway: diag });
}
