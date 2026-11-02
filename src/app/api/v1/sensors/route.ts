// GET /api/v1/sensors — list all sensors with current status.
import { ok } from "@/lib/http";
import { listSensors } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return ok(await listSensors());
}
