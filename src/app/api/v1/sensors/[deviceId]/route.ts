// GET /api/v1/sensors/[deviceId] — sensor detail + historical readings.
import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { getSensorDetail } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;
  const detail = await getSensorDetail(decodeURIComponent(deviceId));
  if (!detail.sensor) return fail(404, "sensor_not_found");
  return ok(detail);
}
